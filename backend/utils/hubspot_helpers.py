"""
HubSpot utilities - centralized token management
"""
import os
from database import db

# Fallback token from environment
_ENV_HUBSPOT_TOKEN = os.environ.get('HUBSPOT_TOKEN', '')

async def get_hubspot_token() -> str:
    """
    Get HubSpot token - prioritize MongoDB settings over env var.
    This allows users to update the token via Settings UI without restarting the server.
    """
    try:
        settings = await db.settings.find_one({})
        if settings and settings.get('hubspot_token'):
            return settings['hubspot_token']
    except Exception:
        pass
    return _ENV_HUBSPOT_TOKEN

async def get_hubspot_headers() -> dict:
    """Get headers for HubSpot API calls"""
    token = await get_hubspot_token()
    return {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }
