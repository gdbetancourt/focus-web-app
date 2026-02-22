"""
Google Drive Integration Router
Handles OAuth connection for Google Drive and Docs access (for Cotizador)
"""
from fastapi import APIRouter, HTTPException, Depends, Request
from datetime import datetime, timezone
import logging
import os

from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import Flow
from google.auth.transport.requests import Request as GoogleRequest

from database import db
from config import GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET
from routers.auth import get_current_user

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/drive", tags=["google-drive"])

# Google Drive and Docs scopes
DRIVE_SCOPES = [
    'https://www.googleapis.com/auth/drive',
    'https://www.googleapis.com/auth/documents',
    'https://www.googleapis.com/auth/userinfo.email',
    'https://www.googleapis.com/auth/userinfo.profile'
]


@router.get("/auth-url")
async def get_drive_auth_url(request: Request, current_user: dict = Depends(get_current_user)):
    """Generate Google OAuth authorization URL for Drive/Docs access"""
    import uuid
    
    # Get the frontend URL for redirect
    frontend_url = os.environ.get('FRONTEND_URL', '')
    if not frontend_url:
        origin = request.headers.get('origin', '')
        if origin:
            frontend_url = origin
        else:
            frontend_url = 'https://persona-assets.preview.emergentagent.com'
    
    # Use a callback URL
    redirect_uri = f"{frontend_url.rstrip('/')}/settings/gmail-callback"
    
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
        scopes=DRIVE_SCOPES,
        redirect_uri=redirect_uri
    )
    
    # Generate a unique state with drive_ prefix
    state = f"drive_{uuid.uuid4().hex}"
    
    # Store state in database for verification
    await db.oauth_states.insert_one({
        "state": state,
        "user_id": current_user.get("id"),
        "oauth_type": "drive",
        "redirect_uri": redirect_uri,
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    # Generate authorization URL
    auth_url, _ = flow.authorization_url(
        access_type='offline',
        include_granted_scopes='true',
        prompt='consent',
        state=state
    )
    
    return {"auth_url": auth_url, "state": state}


@router.post("/callback")
async def drive_oauth_callback(
    request: Request,
    current_user: dict = Depends(get_current_user)
):
    """Handle OAuth callback for Google Drive"""
    data = await request.json()
    code = data.get("code")
    state = data.get("state")
    
    if not code:
        raise HTTPException(status_code=400, detail="Authorization code required")
    
    if not state:
        raise HTTPException(status_code=400, detail="State parameter required")
    
    # Verify state from database
    state_doc = await db.oauth_states.find_one({"state": state, "oauth_type": "drive"})
    if not state_doc:
        logger.error(f"Drive OAuth state not found: {state}")
        raise HTTPException(status_code=400, detail="Invalid or expired state parameter")
    
    redirect_uri = state_doc.get("redirect_uri")
    user_id = state_doc.get("user_id")
    
    # Clean up state
    await db.oauth_states.delete_one({"state": state})
    
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
    
    try:
        # Exchange code for tokens directly (to avoid scope mismatch errors)
        import requests
        token_response = requests.post(
            "https://oauth2.googleapis.com/token",
            data={
                "code": code,
                "client_id": GOOGLE_CLIENT_ID,
                "client_secret": GOOGLE_CLIENT_SECRET,
                "redirect_uri": redirect_uri,
                "grant_type": "authorization_code"
            }
        )
        
        if token_response.status_code != 200:
            error_data = token_response.json()
            raise HTTPException(
                status_code=400, 
                detail=f"Error de Google: {error_data.get('error_description', error_data.get('error', 'Unknown error'))}"
            )
        
        token_data = token_response.json()
        
        # Store credentials in google_tokens collection
        token_doc = {
            "user_id": user_id,
            "service": "drive",
            "access_token": token_data.get("access_token"),
            "refresh_token": token_data.get("refresh_token"),
            "token_uri": "https://oauth2.googleapis.com/token",
            "client_id": GOOGLE_CLIENT_ID,
            "client_secret": GOOGLE_CLIENT_SECRET,
            "scopes": token_data.get("scope", "").split(" "),
            "expiry": None,  # Will be refreshed as needed
            "connected_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat()
        }
        
        # Upsert token
        await db.google_tokens.update_one(
            {"user_id": user_id, "service": "drive"},
            {"$set": token_doc},
            upsert=True
        )
        
        logger.info(f"Google Drive connected for user {user_id}")
        
        return {
            "success": True,
            "message": "Google Drive conectado exitosamente"
        }
        
    except Exception as e:
        logger.error(f"Drive OAuth error: {str(e)}")
        raise HTTPException(status_code=400, detail=f"Error de autenticación: {str(e)}")


@router.get("/status")
async def get_drive_status(current_user: dict = Depends(get_current_user)):
    """Get Google Drive connection status"""
    user_id = current_user.get("id")
    
    token_doc = await db.google_tokens.find_one(
        {"user_id": user_id, "service": "drive"},
        {"_id": 0, "access_token": 0, "refresh_token": 0, "client_secret": 0}
    )
    
    if not token_doc:
        return {
            "connected": False,
            "email": None,
            "connected_at": None
        }
    
    return {
        "connected": True,
        "connected_at": token_doc.get("connected_at"),
        "scopes": token_doc.get("scopes", [])
    }


@router.post("/disconnect")
async def disconnect_drive(current_user: dict = Depends(get_current_user)):
    """Disconnect Google Drive"""
    user_id = current_user.get("id")
    
    result = await db.google_tokens.delete_one({"user_id": user_id, "service": "drive"})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Google Drive no estaba conectado")
    
    return {"success": True, "message": "Google Drive desconectado"}
