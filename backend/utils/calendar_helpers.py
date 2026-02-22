"""
Calendar helper utilities for consistent calendar access across modules.
Centralizes Google Calendar API interactions.
"""
from typing import List, Dict, Set, Optional
from datetime import datetime, timezone, timedelta
import logging
import os

from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build

logger = logging.getLogger(__name__)

# Google OAuth config
GOOGLE_CLIENT_ID = os.environ.get("GOOGLE_CLIENT_ID", "")
GOOGLE_CLIENT_SECRET = os.environ.get("GOOGLE_CLIENT_SECRET", "")
CALENDAR_SCOPES = ["https://www.googleapis.com/auth/calendar.readonly"]


async def get_calendar_events(days: int = 21, settings_getter=None, credentials_refresher=None) -> List[Dict]:
    """
    Get calendar events for the next N days.
    
    Args:
        days: Number of days to look ahead
        settings_getter: Async function to get settings (injected dependency)
        credentials_refresher: Function to refresh credentials if needed
        
    Returns:
        List of calendar event dictionaries
    """
    if not settings_getter:
        logger.warning("No settings_getter provided to get_calendar_events")
        return []
    
    settings = await settings_getter()
    
    if not settings.get("calendar_connected"):
        return []
    
    calendar_credentials = settings.get("calendar_credentials", {})
    if not calendar_credentials:
        return []
    
    try:
        if credentials_refresher:
            calendar_credentials = credentials_refresher(calendar_credentials)
        
        credentials = Credentials(
            token=calendar_credentials.get("token"),
            refresh_token=calendar_credentials.get("refresh_token"),
            token_uri=calendar_credentials.get("token_uri", "https://oauth2.googleapis.com/token"),
            client_id=calendar_credentials.get("client_id", GOOGLE_CLIENT_ID),
            client_secret=calendar_credentials.get("client_secret", GOOGLE_CLIENT_SECRET),
            scopes=calendar_credentials.get("scopes", CALENDAR_SCOPES)
        )
        
        service = build('calendar', 'v3', credentials=credentials, cache_discovery=False)
        
        now = datetime.now(timezone.utc)
        time_min = now.isoformat()
        time_max = (now + timedelta(days=days)).isoformat()
        
        events_result = service.events().list(
            calendarId='primary',
            timeMin=time_min,
            timeMax=time_max,
            singleEvents=True,
            orderBy='startTime',
            showDeleted=False
        ).execute()
        
        return events_result.get('items', [])
        
    except Exception as e:
        logger.error(f"Error fetching calendar events: {e}")
        return []


def extract_attendee_emails(events: List[Dict], exclude_self: bool = True) -> Set[str]:
    """
    Extract all attendee emails from a list of calendar events.
    
    Args:
        events: List of calendar event dictionaries
        exclude_self: Whether to exclude the calendar owner's email
        
    Returns:
        Set of lowercase email addresses
    """
    emails = set()
    for event in events:
        for attendee in event.get('attendees', []):
            if exclude_self and attendee.get('self'):
                continue
            email = attendee.get('email', '').lower()
            if email:
                emails.add(email)
    return emails


def has_meeting_with_contact(events: List[Dict], contact_email: str) -> bool:
    """
    Check if any event has the contact as an attendee.
    
    Args:
        events: List of calendar event dictionaries
        contact_email: Email to search for
        
    Returns:
        True if contact is an attendee in any event
    """
    if not contact_email:
        return False
    
    contact_email_lower = contact_email.lower()
    
    for event in events:
        for attendee in event.get('attendees', []):
            if attendee.get('email', '').lower() == contact_email_lower:
                return True
    return False


def get_next_meeting_date(events: List[Dict], contact_email: str) -> Optional[str]:
    """
    Get the next meeting date for a contact.
    
    Args:
        events: List of calendar event dictionaries (should be sorted by start time)
        contact_email: Email to search for
        
    Returns:
        ISO date string of next meeting, or None
    """
    if not contact_email:
        return None
    
    contact_email_lower = contact_email.lower()
    
    for event in events:
        for attendee in event.get('attendees', []):
            if attendee.get('email', '').lower() == contact_email_lower:
                start = event.get('start', {})
                return start.get('dateTime') or start.get('date')
    return None


def categorize_events_by_timing(events: List[Dict]) -> Dict[str, List[Dict]]:
    """
    Categorize events into today, tomorrow, this week, etc.
    
    Args:
        events: List of calendar event dictionaries
        
    Returns:
        Dict with keys: 'today', 'tomorrow', 'this_week', 'later'
    """
    now = datetime.now(timezone.utc)
    today = now.date()
    tomorrow = today + timedelta(days=1)
    week_end = today + timedelta(days=7)
    
    categorized = {
        'today': [],
        'tomorrow': [],
        'this_week': [],
        'later': []
    }
    
    for event in events:
        start = event.get('start', {})
        date_str = start.get('dateTime') or start.get('date', '')
        
        try:
            if 'T' in date_str:
                event_date = datetime.fromisoformat(date_str.replace('Z', '+00:00')).date()
            else:
                event_date = datetime.fromisoformat(date_str).date()
            
            if event_date == today:
                categorized['today'].append(event)
            elif event_date == tomorrow:
                categorized['tomorrow'].append(event)
            elif event_date <= week_end:
                categorized['this_week'].append(event)
            else:
                categorized['later'].append(event)
        except (ValueError, TypeError):
            categorized['later'].append(event)
    
    return categorized
