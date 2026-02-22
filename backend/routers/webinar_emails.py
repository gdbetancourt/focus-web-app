"""
Webinar Emails Router - Automatic email system for webinar events

This module handles:
- Configuration of 5 universal webinar emails (E06-E10)
- Automatic sending based on event timing
- Email logging and status tracking
- Preview and resend functionality

Emails:
- E06: Registration confirmation (sent immediately when someone registers)
- E07: Webinar starting NOW (sent at exact webinar time)
- E08: 1 hour before reminder
- E09: 24 hours before reminder  
- E10: 7 days before reminder
"""

from fastapi import APIRouter, HTTPException, Depends, BackgroundTasks
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from datetime import datetime, timezone, timedelta
from database import db
from routers.auth import get_current_user
import logging
import uuid
import os

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/webinar-emails", tags=["webinar-emails"])


# ============ MODELS ============

class EmailTemplateConfig(BaseModel):
    """Configuration for a single webinar email"""
    email_id: str  # E06, E07, E08, E09, E10
    subject: str
    body: str
    # Timing config (not applicable for E06 which is immediate)
    hours_before: Optional[int] = None  # For E07, E08
    days_before: Optional[int] = None   # For E09, E10


class WebinarEmailSettings(BaseModel):
    """All webinar email settings"""
    templates: List[EmailTemplateConfig]


class EmailLogEntry(BaseModel):
    """Log entry for a sent email"""
    id: str
    event_id: str
    email_id: str  # E06, E07, etc.
    contact_id: str
    contact_email: str
    contact_name: str
    status: str  # "sent", "error", "pending"
    error_message: Optional[str] = None
    sent_at: Optional[str] = None
    scheduled_for: Optional[str] = None


# ============ DEFAULT TEMPLATES ============

DEFAULT_TEMPLATES = [
    {
        "email_id": "E06",
        "name": "Confirmación de Registro",
        "description": "Se envía inmediatamente cuando alguien se registra",
        "subject": "¡Registro confirmado! {webinar_name}",
        "body": """<p>¡Hola {contact_name}!</p>

<p>Tu registro al webinar <strong>{webinar_name}</strong> está confirmado.</p>

<p>📅 <strong>Fecha:</strong> {webinar_date}<br/>
🕐 <strong>Hora:</strong> {webinar_time}</p>

<p>Guarda este enlace para unirte al webinar:</p>
<p>👉 <a href="{webinar_link}">ACCEDER AL WEBINAR</a></p>

<p>¡Te esperamos!</p>""",
        "hours_before": None,
        "days_before": None,
        "trigger": "immediate"
    },
    {
        "email_id": "E07",
        "name": "¡El webinar comienza AHORA!",
        "description": "Se envía a la hora exacta del webinar",
        "subject": "🔴 ¡{webinar_name} comienza AHORA!",
        "body": """<p>¡Hola {contact_name}!</p>

<p>El webinar <strong>{webinar_name}</strong> está comenzando en este momento.</p>

<p>👉 <a href="{webinar_link}">ENTRAR AL WEBINAR AHORA</a></p>

<p>¡No te lo pierdas!</p>""",
        "hours_before": 0,
        "days_before": None,
        "trigger": "time_based"
    },
    {
        "email_id": "E08",
        "name": "Recordatorio: 1 Hora Antes",
        "description": "Se envía 1 hora antes del webinar",
        "subject": "⏰ {webinar_name} comienza en 1 hora",
        "body": """<p>¡Hola {contact_name}!</p>

<p>Te recordamos que el webinar <strong>{webinar_name}</strong> comienza en <strong>1 hora</strong>.</p>

<p>📅 <strong>Fecha:</strong> {webinar_date}<br/>
🕐 <strong>Hora:</strong> {webinar_time}</p>

<p>Prepárate y asegúrate de tener una buena conexión a internet.</p>

<p>👉 <a href="{webinar_link}">ACCEDER AL WEBINAR</a></p>""",
        "hours_before": 1,
        "days_before": None,
        "trigger": "time_based"
    },
    {
        "email_id": "E09",
        "name": "Recordatorio: 24 Horas Antes",
        "description": "Se envía 24 horas antes del webinar",
        "subject": "📅 Mañana: {webinar_name}",
        "body": """<p>¡Hola {contact_name}!</p>

<p>Te recordamos que <strong>mañana</strong> es el webinar <strong>{webinar_name}</strong>.</p>

<p>📅 <strong>Fecha:</strong> {webinar_date}<br/>
🕐 <strong>Hora:</strong> {webinar_time}</p>

<p>Marca tu calendario y prepárate para una sesión llena de aprendizajes.</p>

<p>👉 <a href="{webinar_link}">GUARDAR ENLACE</a></p>""",
        "hours_before": 24,
        "days_before": None,
        "trigger": "time_based"
    },
    {
        "email_id": "E10",
        "name": "Recordatorio: 7 Días Antes",
        "description": "Se envía 7 días antes del webinar",
        "subject": "🗓️ En 7 días: {webinar_name}",
        "body": """<p>¡Hola {contact_name}!</p>

<p>Faltan <strong>7 días</strong> para el webinar <strong>{webinar_name}</strong>.</p>

<p>📅 <strong>Fecha:</strong> {webinar_date}<br/>
🕐 <strong>Hora:</strong> {webinar_time}</p>

<p>Reserva este tiempo en tu agenda. Será una sesión que no querrás perderte.</p>

<p>¡Nos vemos pronto!</p>""",
        "hours_before": None,
        "days_before": 7,
        "trigger": "time_based"
    }
]


# ============ HELPER FUNCTIONS ============

def get_frontend_url():
    """Get frontend URL for webinar links"""
    return os.environ.get("FRONTEND_URL", "https://persona-assets.preview.emergentagent.com")


def build_webinar_link(event_id: str) -> str:
    """Build the watching room URL for a webinar"""
    frontend_url = get_frontend_url()
    return f"{frontend_url}/lms/webinar/{event_id}"


def replace_merge_fields(text: str, variables: dict) -> str:
    """Replace merge fields in text with actual values"""
    result = text
    for key, value in variables.items():
        result = result.replace(f"{{{key}}}", str(value) if value else "")
    return result


async def get_email_settings() -> List[dict]:
    """Get email settings from database, or return defaults"""
    settings = await db.webinar_email_settings.find_one({"type": "templates"})
    if settings and "templates" in settings:
        return settings["templates"]
    return DEFAULT_TEMPLATES


async def save_email_settings(templates: List[dict]):
    """Save email settings to database"""
    await db.webinar_email_settings.update_one(
        {"type": "templates"},
        {"$set": {"templates": templates, "updated_at": datetime.now(timezone.utc).isoformat()}},
        upsert=True
    )


# ============ ENDPOINTS ============

@router.get("/settings")
async def get_webinar_email_settings(current_user: dict = Depends(get_current_user)):
    """Get all webinar email template settings"""
    templates = await get_email_settings()
    return {"templates": templates}


@router.put("/settings")
async def update_webinar_email_settings(
    data: dict,
    current_user: dict = Depends(get_current_user)
):
    """Update webinar email template settings"""
    templates = data.get("templates", [])
    
    # Validate that all 5 emails are present
    email_ids = {t.get("email_id") for t in templates}
    required_ids = {"E06", "E07", "E08", "E09", "E10"}
    
    if email_ids != required_ids:
        raise HTTPException(
            status_code=400, 
            detail=f"Must include all 5 email templates: {required_ids}"
        )
    
    await save_email_settings(templates)
    
    return {"success": True, "message": "Settings updated"}


@router.get("/settings/reset")
async def reset_webinar_email_settings(current_user: dict = Depends(get_current_user)):
    """Reset email settings to defaults"""
    await save_email_settings(DEFAULT_TEMPLATES)
    return {"success": True, "templates": DEFAULT_TEMPLATES}


@router.get("/event/{event_id}/status")
async def get_event_email_status(
    event_id: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Get the status of all webinar emails for an event.
    Returns status for each email type (E06-E10) with counts and details.
    """
    # Get event details
    event = await db.webinar_events_v2.find_one(
        {"id": event_id},
        {"_id": 0, "name": 1, "webinar_date": 1, "webinar_time": 1, "registrants": 1}
    )
    
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    
    # Get email settings for timing info
    templates = await get_email_settings()
    template_map = {t["email_id"]: t for t in templates}
    
    # Get all email logs for this event
    logs = await db.webinar_email_log.find(
        {"event_id": event_id},
        {"_id": 0}
    ).to_list(10000)
    
    # Group logs by email_id
    logs_by_email = {}
    for log in logs:
        email_id = log.get("email_id")
        if email_id not in logs_by_email:
            logs_by_email[email_id] = []
        logs_by_email[email_id].append(log)
    
    # Calculate status for each email type
    total_registrants = len(event.get("registrants", []))
    webinar_date = event.get("webinar_date")
    webinar_time = event.get("webinar_time", "10:00")
    
    # Parse webinar datetime
    try:
        webinar_dt = datetime.strptime(f"{webinar_date} {webinar_time}", "%Y-%m-%d %H:%M")
    except ValueError:
        webinar_dt = None
    
    now = datetime.now()
    
    email_statuses = []
    
    for email_id in ["E06", "E07", "E08", "E09", "E10"]:
        template = template_map.get(email_id, {})
        email_logs = logs_by_email.get(email_id, [])
        
        sent_count = len([log for log in email_logs if log.get("status") == "sent"])
        error_count = len([log for log in email_logs if log.get("status") == "error"])
        pending_count = total_registrants - sent_count - error_count
        
        # Calculate scheduled time
        scheduled_for = None
        if webinar_dt and email_id != "E06":
            hours_before = template.get("hours_before")
            days_before = template.get("days_before")
            
            if hours_before is not None:
                scheduled_dt = webinar_dt - timedelta(hours=hours_before)
                scheduled_for = scheduled_dt.strftime("%Y-%m-%d %H:%M")
            elif days_before is not None:
                scheduled_dt = webinar_dt - timedelta(days=days_before)
                scheduled_for = scheduled_dt.strftime("%Y-%m-%d %H:%M")
        
        # Determine overall status
        if sent_count == total_registrants and total_registrants > 0:
            status = "sent"
        elif error_count > 0:
            status = "error"
        elif email_id == "E06":
            # E06 is sent immediately on registration
            status = "sent" if sent_count > 0 else "pending"
        elif scheduled_for:
            scheduled_dt = datetime.strptime(scheduled_for, "%Y-%m-%d %H:%M")
            if now >= scheduled_dt:
                status = "sent" if sent_count > 0 else "pending"
            else:
                status = "scheduled"
        else:
            status = "pending"
        
        email_statuses.append({
            "email_id": email_id,
            "name": template.get("name", email_id),
            "description": template.get("description", ""),
            "status": status,
            "scheduled_for": scheduled_for,
            "sent_count": sent_count,
            "error_count": error_count,
            "pending_count": max(0, pending_count),
            "total_registrants": total_registrants
        })
    
    return {
        "event_id": event_id,
        "event_name": event.get("name"),
        "webinar_date": webinar_date,
        "webinar_time": webinar_time,
        "total_registrants": total_registrants,
        "email_statuses": email_statuses
    }


@router.get("/event/{event_id}/logs/{email_id}")
async def get_event_email_logs(
    event_id: str,
    email_id: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Get detailed logs for a specific email type for an event.
    Shows all recipients and their status.
    """
    if email_id not in ["E06", "E07", "E08", "E09", "E10"]:
        raise HTTPException(status_code=400, detail="Invalid email_id")
    
    # Get event
    event = await db.webinar_events_v2.find_one(
        {"id": event_id},
        {"_id": 0, "name": 1, "registrants": 1}
    )
    
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    
    # Get email template
    templates = await get_email_settings()
    template = next((t for t in templates if t["email_id"] == email_id), None)
    
    # Get logs
    logs = await db.webinar_email_log.find(
        {"event_id": event_id, "email_id": email_id},
        {"_id": 0}
    ).to_list(10000)
    
    # Create a map of contact_id to log
    log_map = {log_entry.get("contact_id"): log_entry for log_entry in logs}
    
    # Build recipient list with status
    recipients = []
    for reg in event.get("registrants", []):
        contact_id = reg.get("id") or reg.get("contact_id")
        log = log_map.get(contact_id)
        
        recipients.append({
            "contact_id": contact_id,
            "contact_name": f"{reg.get('first_name', '')} {reg.get('last_name', '')}".strip(),
            "contact_email": reg.get("email"),
            "status": log.get("status") if log else "pending",
            "sent_at": log.get("sent_at") if log else None,
            "error_message": log.get("error_message") if log else None
        })
    
    return {
        "event_id": event_id,
        "event_name": event.get("name"),
        "email_id": email_id,
        "email_name": template.get("name") if template else email_id,
        "email_subject": template.get("subject") if template else "",
        "recipients": recipients
    }


@router.get("/event/{event_id}/preview/{email_id}")
async def preview_webinar_email(
    event_id: str,
    email_id: str,
    contact_id: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """
    Preview a webinar email with real data.
    If contact_id is provided, uses that contact's data.
    Otherwise uses the first registrant.
    """
    if email_id not in ["E06", "E07", "E08", "E09", "E10"]:
        raise HTTPException(status_code=400, detail="Invalid email_id")
    
    # Get event
    event = await db.webinar_events_v2.find_one(
        {"id": event_id},
        {"_id": 0, "id": 1, "name": 1, "webinar_date": 1, "webinar_time": 1, "registrants": 1}
    )
    
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    
    # Get template
    templates = await get_email_settings()
    template = next((t for t in templates if t["email_id"] == email_id), None)
    
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    
    # Get contact data
    registrants = event.get("registrants", [])
    contact = None
    
    if contact_id:
        contact = next((r for r in registrants if r.get("id") == contact_id or r.get("contact_id") == contact_id), None)
    
    if not contact and registrants:
        contact = registrants[0]
    
    if not contact:
        # Use placeholder data
        contact = {
            "first_name": "Juan",
            "last_name": "Pérez",
            "email": "ejemplo@email.com"
        }
    
    # Build merge variables
    variables = {
        "contact_name": f"{contact.get('first_name', '')} {contact.get('last_name', '')}".strip() or contact.get('name', 'Participante'),
        "webinar_name": event.get("name", "Webinar"),
        "webinar_date": event.get("webinar_date", ""),
        "webinar_time": event.get("webinar_time", ""),
        "webinar_link": build_webinar_link(event.get("id"))
    }
    
    # Replace merge fields
    subject = replace_merge_fields(template.get("subject", ""), variables)
    body = replace_merge_fields(template.get("body", ""), variables)
    
    return {
        "email_id": email_id,
        "email_name": template.get("name"),
        "subject": subject,
        "body": body,
        "variables_used": variables,
        "contact": {
            "name": variables["contact_name"],
            "email": contact.get("email", "")
        }
    }


@router.post("/event/{event_id}/resend/{email_id}")
async def resend_failed_emails(
    event_id: str,
    email_id: str,
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(get_current_user)
):
    """
    Resend emails that had errors for a specific email type.
    """
    if email_id not in ["E06", "E07", "E08", "E09", "E10"]:
        raise HTTPException(status_code=400, detail="Invalid email_id")
    
    # Get failed logs
    failed_logs = await db.webinar_email_log.find(
        {"event_id": event_id, "email_id": email_id, "status": "error"},
        {"_id": 0, "contact_id": 1, "contact_email": 1}
    ).to_list(10000)
    
    if not failed_logs:
        return {"success": True, "message": "No failed emails to resend", "count": 0}
    
    # Mark them as pending for resend
    contact_ids = [log_entry.get("contact_id") for log_entry in failed_logs]
    
    await db.webinar_email_log.update_many(
        {"event_id": event_id, "email_id": email_id, "contact_id": {"$in": contact_ids}},
        {"$set": {"status": "pending", "error_message": None, "retry_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    # Note: Actual sending will be done by the scheduler when SES is ready
    
    return {
        "success": True,
        "message": f"{len(failed_logs)} emails marked for resend",
        "count": len(failed_logs)
    }


# ============ SENDING FUNCTIONS (to be used by scheduler) ============

async def send_registration_confirmation(event_id: str, contact: dict):
    """
    Send E06 registration confirmation email.
    Called immediately when someone registers.
    
    Note: Actual sending via SES is disabled until sandbox is resolved.
    This function logs the email as "pending" for now.
    """
    # Get event
    event = await db.webinar_events_v2.find_one(
        {"id": event_id},
        {"_id": 0, "id": 1, "name": 1, "webinar_date": 1, "webinar_time": 1}
    )
    
    if not event:
        logger.error(f"Event {event_id} not found for registration confirmation")
        return
    
    # Get template
    templates = await get_email_settings()
    template = next((t for t in templates if t["email_id"] == "E06"), None)
    
    if not template:
        logger.error("E06 template not found")
        return
    
    # Build merge variables
    contact_name = f"{contact.get('first_name', '')} {contact.get('last_name', '')}".strip()
    if not contact_name:
        contact_name = contact.get('name', 'Participante')
    
    variables = {
        "contact_name": contact_name,
        "webinar_name": event.get("name", ""),
        "webinar_date": event.get("webinar_date", ""),
        "webinar_time": event.get("webinar_time", ""),
        "webinar_link": build_webinar_link(event_id)
    }
    
    # Create log entry (pending until SES is ready)
    log_entry = {
        "id": str(uuid.uuid4()),
        "event_id": event_id,
        "email_id": "E06",
        "contact_id": contact.get("id") or contact.get("contact_id"),
        "contact_email": contact.get("email"),
        "contact_name": contact_name,
        "subject": replace_merge_fields(template.get("subject", ""), variables),
        "status": "pending",  # Will be "sent" when SES is active
        "created_at": datetime.now(timezone.utc).isoformat(),
        "variables": variables
    }
    
    await db.webinar_email_log.insert_one(log_entry)
    
    logger.info(f"E06 email logged for {contact.get('email')} - Event: {event.get('name')}")
    
    # TODO: When SES is ready, uncomment this:
    # try:
    #     await send_email_via_ses(
    #         to_email=contact.get("email"),
    #         subject=log_entry["subject"],
    #         body=replace_merge_fields(template.get("body", ""), variables)
    #     )
    #     await db.webinar_email_log.update_one(
    #         {"id": log_entry["id"]},
    #         {"$set": {"status": "sent", "sent_at": datetime.now(timezone.utc).isoformat()}}
    #     )
    # except Exception as e:
    #     await db.webinar_email_log.update_one(
    #         {"id": log_entry["id"]},
    #         {"$set": {"status": "error", "error_message": str(e)}}
    #     )


async def process_scheduled_emails():
    """
    Process scheduled webinar emails (E07-E10).
    Called by the background scheduler.
    
    Note: Actual sending via SES is disabled until sandbox is resolved.
    """
    now = datetime.now()
    templates = await get_email_settings()
    
    # Get all future events
    today = now.strftime("%Y-%m-%d")
    events = await db.webinar_events_v2.find(
        {"webinar_date": {"$gte": today}},
        {"_id": 0, "id": 1, "name": 1, "webinar_date": 1, "webinar_time": 1, "registrants": 1}
    ).to_list(500)
    
    for event in events:
        webinar_date = event.get("webinar_date")
        webinar_time = event.get("webinar_time", "10:00")
        
        try:
            webinar_dt = datetime.strptime(f"{webinar_date} {webinar_time}", "%Y-%m-%d %H:%M")
        except ValueError:
            continue
        
        for template in templates:
            email_id = template.get("email_id")
            if email_id == "E06":
                continue  # E06 is handled at registration time
            
            # Calculate when this email should be sent
            hours_before = template.get("hours_before")
            days_before = template.get("days_before")
            
            if hours_before is not None:
                send_time = webinar_dt - timedelta(hours=hours_before)
            elif days_before is not None:
                send_time = webinar_dt - timedelta(days=days_before)
            else:
                continue
            
            # Check if it's time to send (within 5 minute window)
            time_diff = (now - send_time).total_seconds()
            if 0 <= time_diff <= 300:  # Within 5 minutes after scheduled time
                await queue_email_for_event(event, email_id, template)


async def queue_email_for_event(event: dict, email_id: str, template: dict):
    """Queue emails for all registrants of an event"""
    event_id = event.get("id")
    registrants = event.get("registrants", [])
    
    for contact in registrants:
        contact_id = contact.get("id") or contact.get("contact_id")
        
        # Check if already sent
        existing = await db.webinar_email_log.find_one({
            "event_id": event_id,
            "email_id": email_id,
            "contact_id": contact_id,
            "status": {"$in": ["sent", "pending"]}
        })
        
        if existing:
            continue
        
        # Build merge variables
        contact_name = f"{contact.get('first_name', '')} {contact.get('last_name', '')}".strip()
        if not contact_name:
            contact_name = contact.get('name', 'Participante')
        
        variables = {
            "contact_name": contact_name,
            "webinar_name": event.get("name", ""),
            "webinar_date": event.get("webinar_date", ""),
            "webinar_time": event.get("webinar_time", ""),
            "webinar_link": build_webinar_link(event_id)
        }
        
        # Create log entry
        log_entry = {
            "id": str(uuid.uuid4()),
            "event_id": event_id,
            "email_id": email_id,
            "contact_id": contact_id,
            "contact_email": contact.get("email"),
            "contact_name": contact_name,
            "subject": replace_merge_fields(template.get("subject", ""), variables),
            "status": "pending",
            "created_at": datetime.now(timezone.utc).isoformat(),
            "scheduled_for": datetime.now(timezone.utc).isoformat(),
            "variables": variables
        }
        
        await db.webinar_email_log.insert_one(log_entry)
        
        logger.info(f"{email_id} email queued for {contact.get('email')} - Event: {event.get('name')}")
