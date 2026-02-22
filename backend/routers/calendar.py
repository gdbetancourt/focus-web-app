"""
Google Calendar Integration Router
Handles OAuth connection and event fetching for WhatsApp confirmations
"""
from fastapi import APIRouter, HTTPException, Depends, Request
from datetime import datetime, timezone, timedelta
from typing import Optional, List
import logging
import os

from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import Flow
from googleapiclient.discovery import build
from google.auth.transport.requests import Request as GoogleRequest

from database import db
from config import GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET
from routers.auth import get_current_user

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/calendar", tags=["calendar"])

# Google Calendar, Gmail, and YouTube scopes
CALENDAR_SCOPES = [
    'https://www.googleapis.com/auth/calendar.readonly',
    'https://www.googleapis.com/auth/calendar.events',
    'https://www.googleapis.com/auth/userinfo.email',
    'https://www.googleapis.com/auth/userinfo.profile',
    'https://www.googleapis.com/auth/gmail.send',
    'https://www.googleapis.com/auth/gmail.compose',
    'https://www.googleapis.com/auth/gmail.readonly',  # For reading starred emails
    'https://www.googleapis.com/auth/presentations',
    'https://www.googleapis.com/auth/drive.file',
    'https://www.googleapis.com/auth/youtube.force-ssl'  # YouTube Live streaming
]


async def get_settings() -> dict:
    """Get settings from database"""
    settings = await db.settings.find_one({}, {"_id": 0})
    return settings or {}


def refresh_credentials_if_needed(credentials_dict: dict) -> dict:
    """Refresh Google credentials if expired"""
    try:
        credentials = Credentials(
            token=credentials_dict.get("token"),
            refresh_token=credentials_dict.get("refresh_token"),
            token_uri=credentials_dict.get("token_uri", "https://oauth2.googleapis.com/token"),
            client_id=credentials_dict.get("client_id", GOOGLE_CLIENT_ID),
            client_secret=credentials_dict.get("client_secret", GOOGLE_CLIENT_SECRET),
            scopes=credentials_dict.get("scopes", CALENDAR_SCOPES)
        )
        
        if credentials.expired and credentials.refresh_token:
            credentials.refresh(GoogleRequest())
            # Return updated credentials dict
            return {
                **credentials_dict,
                "token": credentials.token,
                "expiry": credentials.expiry.isoformat() if credentials.expiry else None
            }
        
        return credentials_dict
    except Exception as e:
        logger.error(f"Error refreshing credentials: {e}")
        raise


@router.get("/auth-url")
async def get_calendar_auth_url(request: Request, current_user: dict = Depends(get_current_user)):
    """Generate Google OAuth authorization URL for Calendar access"""
    
    # Get the frontend URL for redirect
    frontend_url = os.environ.get('FRONTEND_URL', '')
    if not frontend_url:
        origin = request.headers.get('origin', '')
        if origin:
            frontend_url = origin
        else:
            frontend_url = 'https://persona-assets.preview.emergentagent.com'
    
    # Use the same callback as Gmail (which is already registered in Google Cloud Console)
    # We'll distinguish by oauth_type stored in state
    redirect_uri = f"{frontend_url.rstrip('/')}/settings/gmail-callback"
    
    logger.info(f"OAuth: origin={origin}, frontend_url={frontend_url}, redirect_uri={redirect_uri}")
    
    # Create OAuth flow
    client_config = {
        "web": {
            "client_id": GOOGLE_CLIENT_ID,
            "client_secret": GOOGLE_CLIENT_SECRET,
            "auth_uri": "https://accounts.google.com/o/oauth2/auth",
            "token_uri": "https://oauth2.googleapis.com/token",
            "redirect_uris": [redirect_uri]
        }
    }
    
    flow = Flow.from_client_config(
        client_config,
        scopes=CALENDAR_SCOPES,
        redirect_uri=redirect_uri
    )
    
    # Generate authorization URL
    # Note: Removed include_granted_scopes to avoid scope mismatch errors
    auth_url, state = flow.authorization_url(
        access_type='offline',
        prompt='consent'  # Force consent to get new refresh token
    )
    
    # Store state for verification - mark as calendar type
    await db.oauth_states.insert_one({
        "state": state,
        "user_id": current_user["id"],
        "redirect_uri": redirect_uri,
        "oauth_type": "calendar",
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    return {
        "auth_url": auth_url,
        "state": state,
        "redirect_uri": redirect_uri
    }


async def handle_calendar_oauth_callback(code: str, state: str, state_doc: dict):
    """Handle Google OAuth callback for Calendar and store tokens - called from gmail callback"""
    import httpx
    
    logger.info(f"Calendar OAuth callback started - state: {state[:20]}...")
    
    redirect_uri = state_doc.get("redirect_uri")
    logger.info(f"Using redirect_uri: {redirect_uri}")
    
    # Clean up state
    await db.oauth_states.delete_one({"state": state})
    
    try:
        # Exchange code for tokens manually to avoid scope validation issues
        # Google combines all previously granted scopes when include_granted_scopes=true
        logger.info("Exchanging code for tokens...")
        async with httpx.AsyncClient() as client:
            token_response = await client.post(
                "https://oauth2.googleapis.com/token",
                data={
                    "code": code,
                    "client_id": GOOGLE_CLIENT_ID,
                    "client_secret": GOOGLE_CLIENT_SECRET,
                    "redirect_uri": redirect_uri,
                    "grant_type": "authorization_code"
                }
            )
            
            logger.info(f"Token response status: {token_response.status_code}")
            
            if token_response.status_code != 200:
                error_data = token_response.json()
                logger.error(f"Token exchange failed: {error_data}")
                raise Exception(f"Token exchange failed: {error_data}")
            
            tokens = token_response.json()
            logger.info(f"Got tokens, scopes: {tokens.get('scope', 'none')}")
        
        # Build credentials from the tokens
        credentials = Credentials(
            token=tokens.get("access_token"),
            refresh_token=tokens.get("refresh_token"),
            token_uri="https://oauth2.googleapis.com/token",
            client_id=GOOGLE_CLIENT_ID,
            client_secret=GOOGLE_CLIENT_SECRET,
            scopes=tokens.get("scope", "").split()
        )
        
        # Build a simple service to get user info
        service = build('oauth2', 'v2', credentials=credentials)
        user_info = service.userinfo().get().execute()
        email_address = user_info.get('email', '')
        
        # Store credentials in settings
        calendar_credentials = {
            "token": credentials.token,
            "refresh_token": credentials.refresh_token,
            "token_uri": credentials.token_uri,
            "client_id": credentials.client_id,
            "client_secret": credentials.client_secret,
            "scopes": list(credentials.scopes) if credentials.scopes else CALENDAR_SCOPES,
            "email": email_address,
            "connected_at": datetime.now(timezone.utc).isoformat()
        }
        
        await db.settings.update_one(
            {},
            {"$set": {
                "calendar_credentials": calendar_credentials,
                "calendar_connected": True,
                "calendar_email": email_address,
                "updated_at": datetime.now(timezone.utc).isoformat()
            }},
            upsert=True
        )
        
        logger.info(f"Calendar credentials saved successfully for {email_address}")
        
        # Verify it was saved
        verify = await db.settings.find_one({}, {"calendar_connected": 1})
        logger.info(f"Verification - calendar_connected: {verify.get('calendar_connected')}")
        
        return {
            "success": True,
            "email": email_address,
            "message": f"Google Calendar connected successfully for {email_address}"
        }
        
    except Exception as e:
        logger.error(f"Calendar OAuth error: {e}")
        raise HTTPException(status_code=400, detail=f"Error connecting Calendar: {str(e)}")


@router.post("/callback")
async def calendar_oauth_callback(code: str, state: str):
    """Handle Google OAuth callback for Calendar and store tokens - direct endpoint"""
    
    # Verify state
    state_doc = await db.oauth_states.find_one({"state": state, "oauth_type": "calendar"})
    if not state_doc:
        logger.error(f"Calendar OAuth state not found: {state}")
        raise HTTPException(status_code=400, detail="Invalid state parameter")
    
    return await handle_calendar_oauth_callback(code, state, state_doc)


@router.get("/status")
async def get_calendar_status(current_user: dict = Depends(get_current_user)):
    """Check Google Calendar connection status"""
    settings = await get_settings()
    
    calendar_connected = settings.get("calendar_connected", False)
    calendar_credentials = settings.get("calendar_credentials", {})
    
    if calendar_connected and calendar_credentials:
        return {
            "connected": True,
            "email": calendar_credentials.get("email", ""),
            "connected_at": calendar_credentials.get("connected_at", "")
        }
    
    return {
        "connected": False,
        "email": None,
        "connected_at": None
    }


@router.post("/disconnect")
async def disconnect_calendar(current_user: dict = Depends(get_current_user)):
    """Disconnect Google Calendar account"""
    await db.settings.update_one(
        {},
        {
            "$unset": {"calendar_credentials": "", "calendar_connected": "", "calendar_email": ""},
            "$set": {"updated_at": datetime.now(timezone.utc).isoformat()}
        }
    )
    
    return {"success": True, "message": "Google Calendar disconnected"}


@router.get("/events")
async def get_calendar_events(
    days: int = 7,
    current_user: dict = Depends(get_current_user)
):
    """
    Get calendar events for the next N days (default 7).
    Includes tentative/pending events, excludes cancelled.
    Returns attendees list for each event.
    """
    settings = await get_settings()
    
    if not settings.get("calendar_connected"):
        raise HTTPException(status_code=400, detail="Google Calendar not connected. Please connect in Settings.")
    
    calendar_credentials = settings.get("calendar_credentials", {})
    if not calendar_credentials:
        raise HTTPException(status_code=400, detail="Calendar credentials not found")
    
    try:
        # Refresh credentials if needed
        calendar_credentials = refresh_credentials_if_needed(calendar_credentials)
        
        # Update stored credentials if they were refreshed
        if calendar_credentials.get("token") != settings.get("calendar_credentials", {}).get("token"):
            await db.settings.update_one(
                {},
                {"$set": {"calendar_credentials": calendar_credentials}}
            )
        
        # Build credentials object
        credentials = Credentials(
            token=calendar_credentials.get("token"),
            refresh_token=calendar_credentials.get("refresh_token"),
            token_uri=calendar_credentials.get("token_uri", "https://oauth2.googleapis.com/token"),
            client_id=calendar_credentials.get("client_id", GOOGLE_CLIENT_ID),
            client_secret=calendar_credentials.get("client_secret", GOOGLE_CLIENT_SECRET),
            scopes=calendar_credentials.get("scopes", CALENDAR_SCOPES)
        )
        
        # Build Calendar service
        service = build('calendar', 'v3', credentials=credentials)
        
        # Calculate time range
        now = datetime.now(timezone.utc)
        time_min = now.isoformat()
        time_max = (now + timedelta(days=days)).isoformat()
        
        # Fetch events
        events_result = service.events().list(
            calendarId='primary',
            timeMin=time_min,
            timeMax=time_max,
            singleEvents=True,
            orderBy='startTime',
            showDeleted=False  # Exclude cancelled events
        ).execute()
        
        events = events_result.get('items', [])
        
        # Get calendar timezone
        calendar_info = service.calendars().get(calendarId='primary').execute()
        default_timezone = calendar_info.get('timeZone', 'America/Mexico_City')
        
        # Process events
        processed_events = []
        for event in events:
            # Skip cancelled events (double check)
            if event.get('status') == 'cancelled':
                continue
            
            # Extract timezone from event or use calendar default
            start = event.get('start', {})
            end = event.get('end', {})
            event_timezone = start.get('timeZone') or end.get('timeZone') or default_timezone
            
            # Extract attendees
            attendees = []
            for attendee in event.get('attendees', []):
                attendees.append({
                    'name': attendee.get('displayName', ''),
                    'email': attendee.get('email', ''),
                    'response_status': attendee.get('responseStatus', 'needsAction'),
                    'optional': attendee.get('optional', False),
                    'organizer': attendee.get('organizer', False),
                    'self': attendee.get('self', False)
                })
            
            processed_event = {
                'event_id': event.get('id'),
                'summary': event.get('summary', 'No Title'),
                'description': event.get('description', ''),
                'location': event.get('location', ''),
                'start_datetime': start.get('dateTime') or start.get('date'),
                'end_datetime': end.get('dateTime') or end.get('date'),
                'timezone': event_timezone,
                'status': event.get('status', 'confirmed'),
                'attendees': attendees,
                'html_link': event.get('htmlLink'),
                'hangout_link': event.get('hangoutLink')
            }
            processed_events.append(processed_event)
        
        return {
            "success": True,
            "events": processed_events,
            "count": len(processed_events),
            "time_range": {
                "from": time_min,
                "to": time_max
            },
            "calendar_timezone": default_timezone
        }
        
    except Exception as e:
        logger.error(f"Error fetching calendar events: {e}")
        raise HTTPException(status_code=500, detail=f"Error fetching calendar events: {str(e)}")
