"""
WhatsApp Confirmations Router
Generates WhatsApp confirmation messages for upcoming calendar events
by matching attendees with FOCUS contacts
"""
from fastapi import APIRouter, HTTPException, Depends
from datetime import datetime, timezone, timedelta
from typing import Optional, List
from pydantic import BaseModel
import logging
import re
from urllib.parse import quote

from database import db
from routers.auth import get_current_user
from routers.calendar import get_calendar_events, get_settings

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/whatsapp-confirmations", tags=["whatsapp-confirmations"])


class WhatsAppConfirmationItem(BaseModel):
    contact_id: str
    contact_name: str
    contact_email: str
    to_phone_e164: str
    event_id: str
    start_datetime: str
    timezone: str
    message_text: str
    whatsapp_link: str


class WhatsAppAlert(BaseModel):
    type: str
    contact_id: str
    contact_email: str
    event_id: str
    event_start_datetime: str
    contact_name: Optional[str] = None


class GenerateConfirmationsResponse(BaseModel):
    items: List[WhatsAppConfirmationItem]
    alerts: List[WhatsAppAlert]
    clipboard_text: str
    total_events: int
    matched_contacts: int
    unmatched_attendees: int


def normalize_email(email) -> str:
    """Normalize email for comparison: trim whitespace and lowercase"""
    if not email:
        return ""
    # Handle case where email might be a list
    if isinstance(email, list):
        email = email[0] if email else ""
    if not isinstance(email, str):
        return ""
    return email.strip().lower()


def normalize_phone_to_e164(phone) -> Optional[str]:
    """
    Normalize phone number to E.164 format.
    Returns None if phone is invalid or missing.
    """
    if not phone:
        return None
    
    # Handle case where phone might be a list
    if isinstance(phone, list):
        phone = phone[0] if phone else None
    if not phone or not isinstance(phone, str):
        return None
    
    # Remove all non-digit characters except leading +
    cleaned = re.sub(r'[^\d+]', '', phone)
    
    # If starts with +, keep it
    if cleaned.startswith('+'):
        digits = cleaned[1:]
        if len(digits) >= 10:
            return cleaned
    # If starts with country code (52 for Mexico, 1 for US, etc.)
    elif cleaned.startswith('52') and len(cleaned) >= 12:
        return f"+{cleaned}"
    elif cleaned.startswith('1') and len(cleaned) >= 11:
        return f"+{cleaned}"
    # Assume Mexican number if 10 digits
    elif len(cleaned) == 10:
        return f"+52{cleaned}"
    # If longer than 10, might already have country code
    elif len(cleaned) > 10:
        return f"+{cleaned}"
    
    return None


def format_datetime_for_message(datetime_str: str, tz: str) -> tuple:
    """
    Parse datetime and format for message.
    Returns (date_str, time_str) in Spanish format.
    """
    try:
        # Parse ISO datetime
        if 'T' in datetime_str:
            dt = datetime.fromisoformat(datetime_str.replace('Z', '+00:00'))
        else:
            # All-day event, just a date
            dt = datetime.strptime(datetime_str, '%Y-%m-%d')
            return (dt.strftime('%d de %B de %Y'), "todo el día")
        
        # Format date in Spanish style
        months_es = {
            1: 'enero', 2: 'febrero', 3: 'marzo', 4: 'abril',
            5: 'mayo', 6: 'junio', 7: 'julio', 8: 'agosto',
            9: 'septiembre', 10: 'octubre', 11: 'noviembre', 12: 'diciembre'
        }
        
        date_str = f"{dt.day} de {months_es[dt.month]} de {dt.year}"
        time_str = dt.strftime('%H:%M')
        
        return (date_str, time_str)
    except Exception as e:
        logger.error(f"Error parsing datetime {datetime_str}: {e}")
        return (datetime_str, "")


def generate_whatsapp_message(first_name: str, date: str, time: str, timezone: str) -> str:
    """
    Generate the exact WhatsApp confirmation message as specified.
    Template: Hola! {first_name}. Te escribo para confirmar la reunión que tienes con Gerardo 
    el {date} a las {time} ({timezone}). Me reconfirmas tu participación por favor?
    """
    message = f"Hola! {first_name}. Te escribo para confirmar la reunión que tienes con Gerardo el {date} a las {time} ({timezone}). Me reconfirmas tu participación por favor?"
    return message


def generate_whatsapp_link(phone_e164: str, message: str) -> str:
    """Generate WhatsApp API link with URL-encoded message"""
    # Remove the + from phone for WhatsApp link
    phone_clean = phone_e164.replace('+', '')
    encoded_message = quote(message)
    return f"https://api.whatsapp.com/send?phone={phone_clean}&text={encoded_message}"


@router.post("/generate", response_model=GenerateConfirmationsResponse)
async def generate_whatsapp_confirmations(
    days: int = 7,
    current_user: dict = Depends(get_current_user)
):
    """
    Generate WhatsApp confirmation messages for meetings in the next N days.
    
    1. Reads calendar events for the next N days (default 7)
    2. Includes tentative/pending events, excludes cancelled
    3. Matches attendees with FOCUS contacts by email
    4. For contacts with multiple meetings, only generates message for the NEAREST meeting
    5. Generates WhatsApp links for contacts with valid phone numbers
    6. Returns alerts for contacts without valid phone numbers
    """
    
    # Step 1: Get calendar events
    try:
        events_response = await get_calendar_events(days=days, current_user=current_user)
        events = events_response.get("events", [])
    except HTTPException as e:
        raise e
    except Exception as e:
        logger.error(f"Error fetching calendar events: {e}")
        raise HTTPException(status_code=500, detail=f"Error fetching calendar events: {str(e)}")
    
    # Step 2: Get all contacts from FOCUS (unified_contacts collection)
    contacts_cursor = db.unified_contacts.find({}, {
        "_id": 0,
        "id": 1,
        "name": 1,
        "first_name": 1,
        "last_name": 1,
        "email": 1,
        "emails": 1,
        "phone": 1,
        "phones": 1
    })
    contacts_list = await contacts_cursor.to_list(length=10000)
    
    # Build email -> contact map (normalized) - include both legacy email and emails array
    contacts_by_email = {}
    for contact in contacts_list:
        # Legacy email field
        email = normalize_email(contact.get("email", ""))
        if email:
            contacts_by_email[email] = contact
        
        # Emails array
        for email_entry in contact.get("emails", []):
            email = normalize_email(email_entry.get("email", ""))
            if email and email not in contacts_by_email:
                contacts_by_email[email] = contact
    
    # Step 3: Process events and collect per-contact meetings
    # Group by contact_id -> list of (event, start_datetime)
    contact_meetings = {}  # contact_id -> {"contact": {...}, "meetings": [(event, start_datetime), ...]}
    alerts = []
    unmatched_count = 0
    
    for event in events:
        event_id = event.get("event_id")
        start_datetime = event.get("start_datetime")
        event_timezone = event.get("timezone", "America/Mexico_City")
        attendees = event.get("attendees", [])
        
        for attendee in attendees:
            attendee_email = normalize_email(attendee.get("email", ""))
            
            # Skip if no email
            if not attendee_email:
                unmatched_count += 1
                continue
            
            # Skip self (the calendar owner)
            if attendee.get("self"):
                continue
            
            # Try to match with FOCUS contact
            contact = contacts_by_email.get(attendee_email)
            
            if not contact:
                # Attendee not found in FOCUS - don't generate message, just count
                unmatched_count += 1
                continue
            
            contact_id = contact.get("id", attendee_email)
            
            # Add meeting to contact's list
            if contact_id not in contact_meetings:
                contact_meetings[contact_id] = {
                    "contact": contact,
                    "attendee_email": attendee_email,
                    "meetings": []
                }
            
            contact_meetings[contact_id]["meetings"].append({
                "event_id": event_id,
                "start_datetime": start_datetime,
                "timezone": event_timezone
            })
    
    # Step 4: For each contact, select only the NEAREST meeting
    items = []
    
    for contact_id, data in contact_meetings.items():
        contact = data["contact"]
        attendee_email = data["attendee_email"]
        meetings = data["meetings"]
        
        # Sort meetings by start_datetime and take the nearest one
        meetings.sort(key=lambda m: m["start_datetime"])
        nearest_meeting = meetings[0]
        
        event_id = nearest_meeting["event_id"]
        start_datetime = nearest_meeting["start_datetime"]
        event_timezone = nearest_meeting["timezone"]
        
        # Format date/time for message
        date_str, time_str = format_datetime_for_message(start_datetime, event_timezone)
        
        # Get phone - try phones array first, then legacy phone field
        phone = None
        if contact.get("phones") and len(contact["phones"]) > 0:
            # Get primary phone or first phone
            for p in contact["phones"]:
                if p.get("is_primary"):
                    phone = p.get("raw_input") or p.get("e164")
                    break
            if not phone:
                phone = contact["phones"][0].get("raw_input") or contact["phones"][0].get("e164")
        if not phone:
            phone = contact.get("phone")
        
        phone_e164 = normalize_phone_to_e164(phone)
        
        # Get first name for message
        first_name = contact.get("first_name")
        if not first_name and contact.get("name"):
            first_name = contact.get("name").split()[0]
        if not first_name:
            first_name = "Hola"
        
        contact_name = contact.get("name") or f"{contact.get('first_name', '')} {contact.get('last_name', '')}".strip()
        
        if not phone_e164:
            # Contact exists but no valid phone - create alert
            alerts.append(WhatsAppAlert(
                type="MISSING_PHONE_FOR_WHATSAPP",
                contact_id=contact.get("id", ""),
                contact_email=attendee_email,
                event_id=event_id,
                event_start_datetime=start_datetime,
                contact_name=contact_name
            ))
            continue
        
        # Generate message and link
        message = generate_whatsapp_message(first_name, date_str, time_str, event_timezone)
        whatsapp_link = generate_whatsapp_link(phone_e164, message)
        
        items.append(WhatsAppConfirmationItem(
            contact_id=contact.get("id", ""),
            contact_name=contact_name,
            contact_email=attendee_email,
            to_phone_e164=phone_e164,
            event_id=event_id,
            start_datetime=start_datetime,
            timezone=event_timezone,
            message_text=message,
            whatsapp_link=whatsapp_link
        ))
    
    # Sort items by start_datetime
    items.sort(key=lambda x: x.start_datetime)
    
    # Step 5: Generate clipboard text (all links, one per line)
    clipboard_text = "\n".join([item.whatsapp_link for item in items])
    
    return GenerateConfirmationsResponse(
        items=items,
        alerts=alerts,
        clipboard_text=clipboard_text,
        total_events=len(events),
        matched_contacts=len(items),
        unmatched_attendees=unmatched_count
    )


@router.get("/status")
async def get_whatsapp_confirmations_status(current_user: dict = Depends(get_current_user)):
    """
    Get the status of WhatsApp confirmations feature.
    Traffic light logic:
    - Green: Executed on last Monday, Wednesday, or Friday
    - Yellow: Not executed on last required day but within acceptable range
    - Red: Not executed or calendar not connected
    """
    settings = await get_settings()
    
    # Check if calendar is connected
    if not settings.get("calendar_connected"):
        return {
            "status": "red",
            "message": "Google Calendar not connected",
            "calendar_connected": False,
            "last_execution": None
        }
    
    # Get last execution record
    last_execution = await db.whatsapp_confirmations_log.find_one(
        {},
        sort=[("executed_at", -1)]
    )
    
    now = datetime.now(timezone.utc)
    today = now.date()
    weekday = today.weekday()  # Monday=0, Sunday=6
    
    # Determine the last required execution day
    # Monday=0, Wednesday=2, Friday=4
    required_days = [0, 2, 4]  # Monday, Wednesday, Friday
    
    # Find the most recent required day
    days_since_last_required = None
    for i in range(7):
        check_day = (weekday - i) % 7
        if check_day in required_days:
            days_since_last_required = i
            break
    
    if not last_execution:
        return {
            "status": "yellow",
            "message": "No executions recorded yet",
            "calendar_connected": True,
            "last_execution": None,
            "next_required_day": get_next_required_day_name(weekday)
        }
    
    last_exec_date = datetime.fromisoformat(last_execution["executed_at"].replace('Z', '+00:00')).date()
    days_since_execution = (today - last_exec_date).days
    
    # Green if executed on the most recent required day (or more recently)
    if days_since_execution <= days_since_last_required:
        return {
            "status": "green",
            "message": "Confirmations up to date",
            "calendar_connected": True,
            "last_execution": last_execution["executed_at"],
            "items_generated": last_execution.get("items_count", 0)
        }
    else:
        return {
            "status": "yellow",
            "message": f"Last executed {days_since_execution} days ago",
            "calendar_connected": True,
            "last_execution": last_execution["executed_at"],
            "next_required_day": get_next_required_day_name(weekday)
        }


def get_next_required_day_name(current_weekday: int) -> str:
    """Get the name of the next required execution day"""
    required_days = {0: "Monday", 2: "Wednesday", 4: "Friday"}
    days_order = [0, 2, 4]
    
    for day in days_order:
        if day > current_weekday:
            return required_days[day]
    
    return required_days[0]  # Next Monday


@router.post("/log-execution")
async def log_whatsapp_confirmation_execution(
    items_count: int,
    alerts_count: int,
    current_user: dict = Depends(get_current_user)
):
    """Log an execution of the WhatsApp confirmations generator"""
    
    log_entry = {
        "executed_at": datetime.now(timezone.utc).isoformat(),
        "executed_by": current_user.get("email", current_user.get("id")),
        "items_count": items_count,
        "alerts_count": alerts_count
    }
    
    await db.whatsapp_confirmations_log.insert_one(log_entry)
    
    return {"success": True, "message": "Execution logged"}
