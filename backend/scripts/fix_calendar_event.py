"""
Script to fix Google Calendar event date for "Un Sistema de Toma de Decisiones"
This event needs to be moved from April 30 to April 29, 2026
"""
import asyncio
import os
import sys
sys.path.insert(0, '/app/backend')

from google.oauth2.credentials import Credentials
from google.auth.transport.requests import Request as GoogleRequest
from googleapiclient.discovery import build
from motor.motor_asyncio import AsyncIOMotorClient

# Load environment from .env file
from pathlib import Path
env_path = Path('/app/backend/.env')
env_vars = {}
with open(env_path) as f:
    for line in f:
        line = line.strip()
        if line and not line.startswith('#') and '=' in line:
            key, value = line.split('=', 1)
            # Remove quotes from value
            value = value.strip('"').strip("'")
            env_vars[key] = value

GOOGLE_CLIENT_ID = env_vars.get('GOOGLE_CLIENT_ID', '')
GOOGLE_CLIENT_SECRET = env_vars.get('GOOGLE_CLIENT_SECRET', '')
MONGO_URL = env_vars.get('MONGO_URL', '')
DB_NAME = env_vars.get('DB_NAME', '')


async def main():
    print("=" * 60)
    print("Google Calendar Event Date Correction Script")
    print("=" * 60)
    
    # Connect to MongoDB
    print("\n1. Connecting to MongoDB...")
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
    print(f"   Connected to database: {DB_NAME}")
    
    # Get calendar credentials from settings
    print("\n2. Loading calendar credentials...")
    settings = await db.settings.find_one({}, {"_id": 0})
    if not settings:
        print("   ERROR: No settings found")
        return
    
    creds_dict = settings.get("calendar_credentials")
    if not creds_dict:
        print("   ERROR: No calendar_credentials in settings")
        return
    
    print(f"   Token found: {'Yes' if creds_dict.get('token') else 'No'}")
    print(f"   Refresh token found: {'Yes' if creds_dict.get('refresh_token') else 'No'}")
    
    # Build credentials
    print("\n3. Building Google credentials...")
    credentials = Credentials(
        token=creds_dict.get("token"),
        refresh_token=creds_dict.get("refresh_token"),
        token_uri="https://oauth2.googleapis.com/token",
        client_id=GOOGLE_CLIENT_ID,
        client_secret=GOOGLE_CLIENT_SECRET,
        scopes=['https://www.googleapis.com/auth/calendar.events']
    )
    
    # Refresh if expired
    try:
        if credentials.expired and credentials.refresh_token:
            print("   Token expired, refreshing...")
            credentials.refresh(GoogleRequest())
            # Update stored credentials
            await db.settings.update_one({}, {
                "$set": {
                    "calendar_credentials.token": credentials.token,
                    "calendar_credentials.expiry": credentials.expiry.isoformat() if credentials.expiry else None
                }
            })
            print("   Credentials refreshed and saved")
        else:
            # Force refresh to ensure we have a valid token
            print("   Forcing token refresh...")
            credentials.refresh(GoogleRequest())
            await db.settings.update_one({}, {
                "$set": {
                    "calendar_credentials.token": credentials.token,
                    "calendar_credentials.expiry": credentials.expiry.isoformat() if credentials.expiry else None
                }
            })
            print("   Credentials refreshed")
    except Exception as e:
        print(f"   ERROR refreshing credentials: {e}")
        return
    
    # Build calendar service
    print("\n4. Building Google Calendar service...")
    calendar = build('calendar', 'v3', credentials=credentials)
    print("   Calendar service ready")
    
    # The event ID to update
    event_id = '8fqhi96sme8jt7dpp1a9n49r60'
    
    # First, get the current event details
    print(f"\n5. Fetching event {event_id}...")
    try:
        event = calendar.events().get(calendarId='primary', eventId=event_id).execute()
        print(f"   Current event details:")
        print(f"   - Summary: {event.get('summary')}")
        print(f"   - Start: {event.get('start')}")
        print(f"   - End: {event.get('end')}")
        attendees = event.get('attendees', [])
        print(f"   - Attendees: {len(attendees)} people")
    except Exception as e:
        print(f"   ERROR fetching event: {e}")
        return
    
    # Update to the correct date: April 29, 2026, 10:00 AM
    new_start = {
        'dateTime': '2026-04-29T10:00:00',
        'timeZone': 'America/Mexico_City'
    }
    new_end = {
        'dateTime': '2026-04-29T11:00:00',
        'timeZone': 'America/Mexico_City'
    }
    
    print(f"\n6. Updating event to:")
    print(f"   - New start: April 29, 2026 at 10:00 AM")
    print(f"   - New end: April 29, 2026 at 11:00 AM")
    
    # Update the event with sendUpdates to notify attendees
    try:
        updated_event = calendar.events().patch(
            calendarId='primary',
            eventId=event_id,
            body={
                'start': new_start,
                'end': new_end
            },
            sendUpdates='all'  # Send updates to all attendees
        ).execute()
        
        print(f"\n" + "=" * 60)
        print("✅ EVENT UPDATED SUCCESSFULLY!")
        print("=" * 60)
        print(f"   New start: {updated_event.get('start')}")
        print(f"   New end: {updated_event.get('end')}")
        print(f"\n   ➡️  All {len(attendees)} attendees will be notified of the change.")
    except Exception as e:
        print(f"\n   ERROR updating event: {e}")


if __name__ == "__main__":
    asyncio.run(main())
