"""
Mensajes de Hoy Router - Daily message generation for WhatsApp and LinkedIn
Generates contact lists and varied transactional messages using AI
"""
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import List, Optional, Dict
from datetime import datetime, timezone, timedelta
import uuid
import os
import logging
import re

from database import db
from utils.contact_helpers import (
    is_student, is_coachee, STUDENT_ROLES_QUERY, COACHEE_ROLES_QUERY,
    build_cadence_query, CADENCE_PERIODS,
    get_primary_phone
)


def strip_emojis(text: str) -> str:
    """Remove emojis from text to avoid WhatsApp URL encoding issues"""
    if not text:
        return text
    # Remove emoji characters using regex pattern
    emoji_pattern = re.compile(
        "["
        "\U0001F600-\U0001F64F"  # emoticons
        "\U0001F300-\U0001F5FF"  # symbols & pictographs
        "\U0001F680-\U0001F6FF"  # transport & map symbols
        "\U0001F1E0-\U0001F1FF"  # flags (iOS)
        "\U00002702-\U000027B0"  # dingbats
        "\U000024C2-\U0001F251"
        "\U0001F900-\U0001F9FF"  # supplemental symbols
        "\U0001FA00-\U0001FA6F"  # chess symbols
        "\U0001FA70-\U0001FAFF"  # symbols extended
        "\U00002600-\U000026FF"  # misc symbols
        "\U00002700-\U000027BF"  # dingbats extended
        "]+", 
        flags=re.UNICODE
    )
    return emoji_pattern.sub('', text).strip()


def clean_llm_meta_comments(text: str) -> str:
    """Remove meta-comments and notes that LLM might add to responses"""
    if not text:
        return text
    
    # Patterns to remove (LLM meta-comments about emojis, instructions, etc.)
    patterns_to_remove = [
        r'\(?\s*[Nn]ota:?\s*[^)]*(?:emoji|codificación|instrucción|WhatsApp|omitido|pautas)[^)]*\)?\.?',
        r'\(?\s*[Ii]mportante:?\s*[^)]*(?:emoji|codificación)[^)]*\)?\.?',
        r'[Ss]iguiendo (?:nuestras|mis|las) (?:pautas|instrucciones|directrices)[^.]*\.',
        r'[Hh]e omitido (?:el uso de )?(?:los )?emojis?[^.]*\.',
        r'[Aa]unque se solicitó[^.]*emojis?[^.]*\.',
        r'¡?[Gg]racias por tu comprensión!?',
    ]
    
    result = text
    for pattern in patterns_to_remove:
        result = re.sub(pattern, '', result, flags=re.IGNORECASE)
    
    # Clean up multiple spaces and trim
    result = re.sub(r'\s+', ' ', result).strip()
    # Remove trailing/leading punctuation artifacts
    result = re.sub(r'^[\s\-\.\,]+|[\s\-]+$', '', result).strip()
    
    return result


from routers.auth import get_current_user
from routers.calendar import get_settings, refresh_credentials_if_needed, CALENDAR_SCOPES
from config import GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET

from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build

# Gemini integration
from emergentintegrations.llm.chat import LlmChat, UserMessage

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/mensajes-hoy", tags=["mensajes-hoy"])

# ============ MODELS ============

class MessageContact(BaseModel):
    contact_id: str
    name: str
    email: str
    phone: Optional[str] = ""
    company: Optional[str] = ""
    meeting_date: Optional[str] = None
    meeting_title: Optional[str] = None
    last_contacted: Optional[str] = None
    message: str
    message_type: str  # whatsapp or linkedin
    category: str  # meeting_confirmation, student_followup, quote_followup, linkedin_outreach


class MarkContactedRequest(BaseModel):
    contact_ids: List[str]
    message_type: str  # whatsapp or linkedin


# ============ GEMINI MESSAGE GENERATION ============

async def generate_varied_message(
    template_type: str,
    contact_name: str,
    meeting_date: Optional[str] = None,
    meeting_title: Optional[str] = None,
    company: Optional[str] = None
) -> str:
    """Generate a slightly varied transactional message using Gemini"""
    
    api_key = os.environ.get("EMERGENT_LLM_KEY")
    if not api_key:
        # Fallback to template if no API key
        return get_fallback_message(template_type, contact_name, meeting_date, meeting_title)
    
    # Build prompt based on template type
    prompts = {
        "meeting_21_days_new": f"""Genera un mensaje de WhatsApp muy breve en español para {contact_name} confirmando su cita el {meeting_date}. 
Es la primera vez que contactamos. Sé amable, usa "tú". Máximo 2 líneas. Un emoji opcional. Firma: Equipo Leaderlix""",
        
        "meeting_21_days_followup": f"""Genera un mensaje de WhatsApp breve en español para {contact_name} recordando su cita el {meeting_date}.
Ya lo contactamos antes. Sé cordial, usa "tú". Máximo 2 líneas. Un emoji opcional. Firma: Equipo Leaderlix""",
        
        "meeting_tomorrow": f"""Genera un mensaje de WhatsApp breve en español para {contact_name} recordando que su cita es MAÑANA ({meeting_date}).
Sé amable y directo, usa "tú". Máximo 2 líneas. Un emoji. Firma: Equipo Leaderlix""",
        
        "meeting_today": f"""Genera un mensaje de WhatsApp muy breve en español para {contact_name} recordando que su cita es HOY.
{f"Tema: {meeting_title}" if meeting_title else ""}
Sé entusiasta pero profesional, usa "tú". Máximo 2 líneas. Un emoji. Firma: Equipo Leaderlix""",
        
        "student_coaching": f"""Genera un mensaje de WhatsApp breve en español para {contact_name} invitándolo a agendar su próxima sesión de coaching.
No tiene cita programada. Sé amable y motivador, usa "tú". Máximo 2-3 líneas. Un emoji. Firma: Equipo Leaderlix""",
        
        "quote_followup": f"""Genera un mensaje de WhatsApp breve en español para {contact_name} de {company or "su empresa"} dando seguimiento a la cotización enviada.
Pregunta si tiene dudas o está listo para arrancar. Sé cortés y servicial, usa "tú". Máximo 2-3 líneas. Un emoji. Firma: Equipo Leaderlix""",
        
        "linkedin_outreach": f"""Genera un mensaje de LinkedIn muy breve en español para {contact_name}.
Mensaje de conexión profesional. Sé cordial y profesional, usa "tú". Máximo 2 líneas. Sin emojis o máximo uno. Firma: Perla, Leaderlix""",

        "alumni_checkin_whatsapp": f"""Genera un mensaje de WhatsApp breve y amigable en español para {contact_name}.

CONTEXTO: {contact_name} es un EXALUMNO de Leaderlix. Le escribimos porque está en nuestra lista de exalumnos y queremos saber cómo le ha ido aplicando el método en su día a día.

INSTRUCCIONES:
- Escribe EN NOMBRE DE Leaderlix (usa "nosotros", "te escribimos", "estamos")
- Menciona de forma natural que le escribes porque es parte de la comunidad de exalumnos
- Pregunta cómo le ha ido usando/aplicando el método
- Usa signos de admiración (¡!) para dar energía y calidez al mensaje
- Sé genuinamente amigable y cercano, como un amigo que se preocupa
- MUY breve: 2-3 líneas máximo
- Usa "tú" no "usted"
- NO uses emojis
- Varía la estructura y las palabras en cada mensaje
- Firma: Equipo Leaderlix

EJEMPLO DE TONO (pero varía las palabras):
"¡Hola [nombre]! Te escribimos desde Leaderlix porque eres parte de nuestra comunidad de exalumnos. ¿Cómo te ha ido aplicando el método? ¡Nos encantaría saber de ti! - Equipo Leaderlix"
""",

        "alumni_checkin_email": f"""Genera un correo breve en español para {contact_name}, un exalumno de Leaderlix.

CONTEXTO: Le escribimos porque está en nuestra lista de exalumnos y queremos saber cómo le ha ido con el método.

INSTRUCCIONES:
- Escribe EN NOMBRE DE Leaderlix (usa "nosotros", "te escribimos", "estamos")
- Menciona que le escribes porque es parte de la comunidad de exalumnos
- Pregunta cómo le ha ido usando el método
- Usa signos de admiración para dar calidez
- Sé genuinamente amigable y cercano
- CONCISO: máximo 4-5 líneas
- Formato: Primera línea el asunto (sin "Asunto:"), luego línea vacía, luego el cuerpo
- Usa "tú" no "usted"
- NO uses emojis
- Firma: Equipo Leaderlix"""
    }
    
    prompt = prompts.get(template_type, prompts["meeting_21_days_new"])
    
    try:
        chat = LlmChat(
            api_key=api_key,
            session_id=f"mensajes-{uuid.uuid4()}",
            system_message="""Eres un asistente que genera mensajes cortos para WhatsApp en español.

REGLAS ESTRICTAS:
1. Responde ÚNICAMENTE con el mensaje final, sin explicaciones ni notas
2. NO incluyas comentarios como "Nota:", "Importante:", "(Nota:", etc.
3. NO menciones emojis, codificación, ni instrucciones que recibiste
4. NO uses emojis
5. Usa "tú" no "usted"
6. Máximo 2-3 líneas
7. Tono amable y profesional

Tu respuesta debe ser SOLO el mensaje que se enviará, nada más."""
        ).with_model("gemini", "gemini-2.5-flash")
        
        user_message = UserMessage(text=prompt)
        response = await chat.send_message(user_message)
        
        # Clean up response
        message = response.strip()
        # Remove any markdown formatting
        message = message.replace("**", "").replace("*", "")
        # Remove any emojis that might have slipped through
        message = strip_emojis(message)
        # Remove any meta-comments or notes the LLM might have added
        message = clean_llm_meta_comments(message)
        
        return message
        
    except Exception as e:
        logger.error(f"Error generating message with Gemini: {e}")
        return get_fallback_message(template_type, contact_name, meeting_date, meeting_title)


def get_fallback_message(template_type: str, contact_name: str, meeting_date: Optional[str], meeting_title: Optional[str]) -> str:
    """Fallback messages when AI is not available - NO EMOJIS to avoid WhatsApp URL encoding issues"""
    # Include meeting title if available
    title_part = f" ({meeting_title})" if meeting_title and meeting_title != "Reunión" else ""
    
    templates = {
        "meeting_21_days_new": f"Hola {contact_name}! Te escribo para confirmar tu cita{title_part} del {meeting_date}. Todo bien para esa fecha y hora? - Equipo Leaderlix",
        "meeting_21_days_followup": f"Hola {contact_name}! Solo un recordatorio de tu cita{title_part} el {meeting_date}. Te esperamos! - Equipo Leaderlix",
        "meeting_tomorrow": f"Hola {contact_name}! Te recordamos que tu cita{title_part} es MANANA {meeting_date}. Nos vemos! - Equipo Leaderlix",
        "meeting_today": f"Hola {contact_name}! Tu cita{title_part} es HOY {meeting_date}. Te esperamos! - Equipo Leaderlix",
        "student_coaching": f"Hola {contact_name}! Ya agendaste tu proxima sesion de coaching? Estamos listos para continuar. - Equipo Leaderlix",
        "quote_followup": f"Hola {contact_name}! Tuviste oportunidad de revisar la cotizacion? Estoy a tus ordenes para cualquier duda. - Equipo Leaderlix",
        "linkedin_outreach": f"Hola {contact_name}, fue un gusto conocer tu perfil. Me encantaria conectar. - Perla, Leaderlix",
        "alumni_checkin_whatsapp": f"¡Hola {contact_name}! Te escribimos desde Leaderlix porque eres parte de nuestra comunidad de exalumnos. ¿Cómo te ha ido aplicando el método? ¡Nos encantaría saber de ti! - Equipo Leaderlix",
        "alumni_checkin_email": f"¿Cómo te ha ido con el método?\n\n¡Hola {contact_name}!\n\nTe escribimos desde Leaderlix porque eres parte de nuestra comunidad de exalumnos. Queremos saber cómo te ha ido aplicando el método en tu día a día. ¡Nos encantaría escuchar de ti!\n\nUn abrazo,\nEquipo Leaderlix"
    }
    return strip_emojis(templates.get(template_type, templates["meeting_21_days_new"]))


# ============ HELPER FUNCTIONS ============

async def get_calendar_events_for_messages(days: int = 21) -> List[Dict]:
    """Get calendar events for the next N days"""
    settings = await get_settings()
    
    if not settings.get("calendar_connected"):
        return []
    
    calendar_credentials = settings.get("calendar_credentials", {})
    if not calendar_credentials:
        return []
    
    try:
        calendar_credentials = refresh_credentials_if_needed(calendar_credentials)
        
        credentials = Credentials(
            token=calendar_credentials.get("token"),
            refresh_token=calendar_credentials.get("refresh_token"),
            token_uri=calendar_credentials.get("token_uri", "https://oauth2.googleapis.com/token"),
            client_id=calendar_credentials.get("client_id", GOOGLE_CLIENT_ID),
            client_secret=calendar_credentials.get("client_secret", GOOGLE_CLIENT_SECRET),
            scopes=calendar_credentials.get("scopes", CALENDAR_SCOPES)
        )
        
        service = build('calendar', 'v3', credentials=credentials)
        
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
        
        # Filter out cancelled events and events without valid status
        events = events_result.get('items', [])
        valid_events = []
        
        # Get the user's email to check their response status
        user_email = settings.get("calendar_credentials", {}).get("email", "").lower()
        if not user_email:
            # Try to get from token info
            user_email = calendar_credentials.get("email", "").lower()
        
        for event in events:
            event_status = event.get('status', 'confirmed')
            event_summary = event.get('summary', 'No title')
            
            # Skip cancelled events
            if event_status not in ['confirmed', 'tentative']:
                logger.debug(f"Filtered out event with status '{event_status}': {event_summary}")
                continue
            
            # Check if user declined this event
            attendees = event.get('attendees', [])
            user_declined = False
            has_external_attendees = False
            
            for attendee in attendees:
                attendee_email = (attendee.get('email') or '').lower()
                
                # Check if this is the user and they declined
                if user_email and attendee_email == user_email:
                    if attendee.get('responseStatus') == 'declined':
                        user_declined = True
                        break
                
                # Check if there are external attendees (not @leaderlix.com)
                if attendee_email and not attendee_email.endswith('@leaderlix.com'):
                    has_external_attendees = True
            
            # Skip events the user declined
            if user_declined:
                logger.debug(f"Filtered out declined event: {event_summary}")
                continue
            
            # Skip events with no attendees or only internal attendees (personal events)
            # But keep events where user is the organizer and has external attendees
            organizer_email = (event.get('organizer', {}).get('email') or '').lower()
            is_user_organizer = user_email and organizer_email == user_email
            
            if not attendees:
                # No attendees - skip (personal event like "Oración", "Revisión de tasks")
                logger.debug(f"Filtered out event with no attendees: {event_summary}")
                continue
            
            if not has_external_attendees and not is_user_organizer:
                # Only internal attendees and user is not organizer - skip
                logger.debug(f"Filtered out internal-only event: {event_summary}")
                continue
            
            valid_events.append(event)
        
        logger.info(f"Calendar events: {len(events)} total, {len(valid_events)} after filtering")
        return valid_events
        
    except Exception as e:
        logger.error(f"Error fetching calendar events: {e}")
        return []


async def get_contact_by_email(email: str) -> Optional[Dict]:
    """Find contact in unified_contacts by email"""
    contact = await db.unified_contacts.find_one(
        {"email": {"$regex": f"^{email}$", "$options": "i"}},
        {"_id": 0}
    )
    return contact


def days_since_date(date_str: Optional[str]) -> int:
    """Calculate days since a given ISO date string"""
    if not date_str:
        return 9999  # Never contacted
    try:
        dt = datetime.fromisoformat(date_str.replace("Z", "+00:00"))
        now = datetime.now(timezone.utc)
        return (now - dt).days
    except Exception:
        return 9999


def is_date_tomorrow(date_str: str) -> bool:
    """Check if a date is tomorrow"""
    try:
        # Parse the date (could be datetime or date string)
        if "T" in date_str:
            dt = datetime.fromisoformat(date_str.replace("Z", "+00:00"))
        else:
            dt = datetime.fromisoformat(date_str)
        
        tomorrow = datetime.now(timezone.utc).date() + timedelta(days=1)
        return dt.date() == tomorrow
    except Exception:
        return False


def is_date_today(date_str: str) -> bool:
    """Check if a date is today"""
    try:
        if "T" in date_str:
            dt = datetime.fromisoformat(date_str.replace("Z", "+00:00"))
        else:
            dt = datetime.fromisoformat(date_str)
        
        today = datetime.now(timezone.utc).date()
        return dt.date() == today
    except Exception:
        return False


def format_date_spanish(date_str: str, include_time: bool = True) -> str:
    """Format date in Spanish-friendly format with optional time"""
    try:
        if "T" in date_str:
            dt = datetime.fromisoformat(date_str.replace("Z", "+00:00"))
            has_time = True
        else:
            dt = datetime.fromisoformat(date_str)
            has_time = False
        
        months = ["enero", "febrero", "marzo", "abril", "mayo", "junio",
                  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"]
        
        date_part = f"{dt.day} de {months[dt.month-1]}"
        
        # Include time if available and requested
        if include_time and has_time:
            # Format time in 12-hour format
            hour = dt.hour
            minute = dt.minute
            am_pm = "am" if hour < 12 else "pm"
            hour_12 = hour if hour <= 12 else hour - 12
            if hour_12 == 0:
                hour_12 = 12
            
            if minute == 0:
                time_part = f"{hour_12}{am_pm}"
            else:
                time_part = f"{hour_12}:{minute:02d}{am_pm}"
            
            return f"{date_part} a las {time_part}"
        
        return date_part
    except Exception:
        return date_str


# ============ ENDPOINTS ============

@router.get("/whatsapp/meeting-confirmations")
async def get_whatsapp_meeting_confirmations(
    option: int = 1,  # 1-4 based on rules
    current_user: dict = Depends(get_current_user)
):
    """
    Get WhatsApp messages for meeting confirmations.
    Returns contacts with TEMPLATE messages (fast). AI generation on demand.
    
    Option 1: Meetings in next 21 days, NEVER contacted
    Option 2: Meetings in next 21 days, contacted more than 1 week ago  
    Option 3: Meeting tomorrow
    Option 4: Meeting today
    """
    events = await get_calendar_events_for_messages(21)
    
    if not events:
        return {"contacts": [], "count": 0, "option": option, "message": "No calendar events found or calendar not connected"}
    
    contacts = []
    
    for event in events:
        # Get attendees
        attendees = event.get('attendees', [])
        start = event.get('start', {})
        event_date = start.get('dateTime') or start.get('date', '')
        event_title = event.get('summary', 'Reunión')
        
        for attendee in attendees:
            if attendee.get('self'):
                continue  # Skip organizer
            
            email = attendee.get('email', '')
            if not email:
                continue
            
            # Find contact in database
            contact = await get_contact_by_email(email)
            
            if not contact:
                # Create contact entry from attendee info
                contact = {
                    "id": str(uuid.uuid4()),
                    "name": attendee.get('displayName', email.split('@')[0]),
                    "email": email,
                    "phone": "",
                    "company": ""
                }
            
            # Check last_contacted_whatsapp
            last_contacted = contact.get("last_contacted_whatsapp")
            days_since = days_since_date(last_contacted)
            
            # Apply option filter
            include = False
            template_type = ""
            
            if option == 1:
                # Never contacted
                if days_since >= 9999:
                    include = True
                    template_type = "meeting_21_days_new"
            elif option == 2:
                # Contacted more than 7 days ago
                if 7 < days_since < 9999:
                    include = True
                    template_type = "meeting_21_days_followup"
            elif option == 3:
                # Meeting tomorrow
                if is_date_tomorrow(event_date):
                    include = True
                    template_type = "meeting_tomorrow"
            elif option == 4:
                # Meeting today
                if is_date_today(event_date):
                    include = True
                    template_type = "meeting_today"
            
            if include:
                # Use TEMPLATE message for fast loading (AI generation happens on demand)
                first_name = contact.get("name", "").split()[0] if contact.get("name") else ""
                message = get_fallback_message(
                    template_type=template_type,
                    contact_name=first_name,
                    meeting_date=format_date_spanish(event_date),
                    meeting_title=event_title
                )
                
                contacts.append({
                    "contact_id": contact.get("id"),
                    "name": contact.get("name", ""),
                    "email": email,
                    "phone": contact.get("phone", ""),
                    "company": contact.get("company", ""),
                    "meeting_date": event_date,
                    "meeting_title": event_title,
                    "last_contacted": last_contacted,
                    "message": message,
                    "message_type": "whatsapp",
                    "category": "meeting_confirmation"
                })
    
    # Remove duplicates by email
    seen_emails = set()
    unique_contacts = []
    for c in contacts:
        if c["email"] not in seen_emails:
            seen_emails.add(c["email"])
            unique_contacts.append(c)
    
    return {
        "contacts": unique_contacts,
        "count": len(unique_contacts),
        "option": option,
        "option_description": {
            1: "Meetings in next 21 days - Never contacted",
            2: "Meetings in next 21 days - Contacted >7 days ago",
            3: "Meeting tomorrow",
            4: "Meeting today"
        }.get(option, "Unknown option")
    }


@router.get("/whatsapp/students")
async def get_whatsapp_students(
    current_user: dict = Depends(get_current_user)
):
    """
    Get WhatsApp messages for Stage 4 coachees who:
    - Are in Stage 4
    - Have coachee role (receive coaching sessions)
    - Have no meeting scheduled in next 4 weeks
    - Haven't been contacted in the last week
    
    Note: Students (non-coachees) don't receive coaching session reminders.
    """
    # Get events for next 4 weeks
    events = await get_calendar_events_for_messages(28)
    event_emails = set()
    
    for event in events:
        for attendee in event.get('attendees', []):
            email = attendee.get('email', '').lower()
            if email:
                event_emails.add(email)
    
    # Get Stage 4 contacts that are coachees (not just students)
    coachees = await db.unified_contacts.find(
        {
            "stage": 4,
            "$or": [
                {"roles": COACHEE_ROLES_QUERY},
                {"contact_types": COACHEE_ROLES_QUERY}
            ]
        },
        {"_id": 0}
    ).to_list(1000)
    
    contacts = []
    
    for coachee in coachees:
        email = (coachee.get("email") or "").lower()
        
        # Skip if they have a meeting scheduled
        if email in event_emails:
            continue
        
        # Check last contacted
        last_contacted = coachee.get("last_contacted_whatsapp")
        days_since = days_since_date(last_contacted)
        
        # Only include if not contacted in the last week
        if days_since < 7:
            continue
        
        # Use TEMPLATE message for fast loading
        first_name = coachee.get("name", "").split()[0] if coachee.get("name") else ""
        message = get_fallback_message(
            template_type="student_coaching",
            contact_name=first_name,
            meeting_date=None,
            meeting_title=None
        )
        
        contacts.append({
            "contact_id": coachee.get("id"),
            "name": coachee.get("name", ""),
            "email": coachee.get("email", ""),
            "phone": coachee.get("phone", ""),
            "company": coachee.get("company", ""),
            "meeting_date": None,
            "meeting_title": None,
            "last_contacted": last_contacted,
            "message": message,
            "message_type": "whatsapp",
            "category": "coachee_followup"
        })
    
    return {
        "contacts": contacts,
        "count": len(contacts),
        "description": "Stage 4 students without meetings in next 4 weeks, not contacted in 7+ days"
    }


@router.get("/whatsapp/quotes")
async def get_whatsapp_quote_followups(
    current_user: dict = Depends(get_current_user)
):
    """
    Get WhatsApp messages for Stage 3 contacts who have a quote generated.
    Follow-up message about their quote.
    """
    # Get contacts in Stage 3 with quotes
    # First, get all quotes
    quotes = await db.quotes.find(
        {"status": {"$ne": "cancelled"}},
        {"_id": 0, "contact_id": 1, "client_email": 1, "client_name": 1, "company": 1}
    ).to_list(500)
    
    quote_emails = {q.get("client_email", "").lower(): q for q in quotes if q.get("client_email")}
    
    # Get Stage 3 contacts
    stage3_contacts = await db.unified_contacts.find(
        {"stage": 3},
        {"_id": 0}
    ).to_list(1000)
    
    contacts = []
    
    for contact in stage3_contacts:
        email = (contact.get("email") or "").lower()
        
        # Check if they have a quote
        if email not in quote_emails:
            continue
        
        # Check last contacted
        last_contacted = contact.get("last_contacted_whatsapp")
        days_since = days_since_date(last_contacted)
        
        # Only include if not contacted in the last week
        if days_since < 7:
            continue
        
        # Use TEMPLATE message for fast loading
        first_name = contact.get("name", "").split()[0] if contact.get("name") else ""
        message = get_fallback_message(
            template_type="quote_followup",
            contact_name=first_name,
            meeting_date=None,
            meeting_title=None
        )
        
        contacts.append({
            "contact_id": contact.get("id"),
            "name": contact.get("name", ""),
            "email": contact.get("email", ""),
            "phone": contact.get("phone", ""),
            "company": contact.get("company", ""),
            "meeting_date": None,
            "meeting_title": None,
            "last_contacted": last_contacted,
            "message": message,
            "message_type": "whatsapp",
            "category": "quote_followup"
        })
    
    return {
        "contacts": contacts,
        "count": len(contacts),
        "description": "Stage 3 contacts with quotes, not contacted in 7+ days"
    }


@router.get("/linkedin/by-keyword")
async def get_linkedin_messages_by_keyword(
    current_user: dict = Depends(get_current_user)
):
    """
    Get LinkedIn messages for Stage 1 and Stage 2 contacts.
    Groups contacts by buyer_persona first, then by keyword.
    Includes all contacts - those without linkedin_url are flagged.
    """
    # Get Stage 1 and 2 contacts - ONLY qualified contacts
    # Contacts must have been qualified in "To Qualify" tab to appear here
    contacts_cursor = db.unified_contacts.find(
        {
            "stage": {"$in": [1, 2]},
            "qualification_status": "qualified"
        },
        {"_id": 0}
    )
    contacts = await contacts_cursor.to_list(10000)
    
    # Group by buyer_persona -> keyword (hierarchical)
    persona_groups = {}
    
    for contact in contacts:
        # Check last contacted via LinkedIn
        last_contacted = contact.get("last_contacted_linkedin")
        days_since = days_since_date(last_contacted)
        
        # Only include if not contacted in 8 days
        if days_since < 8:
            continue
        
        # Get buyer persona
        buyer_persona = contact.get("buyer_persona") or "sin_clasificar"
        
        # Get keyword - check multiple sources
        keyword = (
            contact.get("source_keyword") or 
            contact.get("keyword") or 
            contact.get("source_details", {}).get("keyword") if isinstance(contact.get("source_details"), dict) else None
        )
        
        # If no keyword, check source to determine label
        if not keyword:
            source = contact.get("source", "")
            if source in ["import", "manual", "hubspot"]:
                keyword = "Importados"
            else:
                keyword = "Sin keyword"
        
        # Initialize persona group if needed
        if buyer_persona not in persona_groups:
            persona_groups[buyer_persona] = {
                "keywords": {},
                "total_contacts": 0,
                "with_linkedin": 0,
                "without_linkedin": 0
            }
        
        # Initialize keyword group if needed
        if keyword not in persona_groups[buyer_persona]["keywords"]:
            persona_groups[buyer_persona]["keywords"][keyword] = []
        
        has_linkedin = bool(contact.get("linkedin_url"))
        
        persona_groups[buyer_persona]["keywords"][keyword].append({
            "contact_id": contact.get("id"),
            "name": contact.get("name", ""),
            "email": contact.get("email", ""),
            "linkedin_url": contact.get("linkedin_url", ""),
            "has_linkedin": has_linkedin,
            "company": contact.get("company", ""),
            "job_title": contact.get("job_title", ""),
            "last_contacted": last_contacted,
            "stage": contact.get("stage"),
            "buyer_persona": buyer_persona
        })
        
        # Update counts
        persona_groups[buyer_persona]["total_contacts"] += 1
        if has_linkedin:
            persona_groups[buyer_persona]["with_linkedin"] += 1
        else:
            persona_groups[buyer_persona]["without_linkedin"] += 1
    
    # Sort keywords within each persona by contact count (descending)
    for persona in persona_groups:
        sorted_keywords = dict(
            sorted(
                persona_groups[persona]["keywords"].items(),
                key=lambda x: len(x[1]),
                reverse=True
            )
        )
        persona_groups[persona]["keywords"] = sorted_keywords
    
    # Sort personas by total contact count (descending)
    sorted_personas = dict(
        sorted(
            persona_groups.items(),
            key=lambda x: x[1]["total_contacts"],
            reverse=True
        )
    )
    
    # Calculate totals
    total_contacts = sum(p["total_contacts"] for p in sorted_personas.values())
    total_with_linkedin = sum(p["with_linkedin"] for p in sorted_personas.values())
    total_without_linkedin = sum(p["without_linkedin"] for p in sorted_personas.values())
    
    return {
        "persona_groups": sorted_personas,
        "total_personas": len(sorted_personas),
        "total_contacts": total_contacts,
        "total_with_linkedin": total_with_linkedin,
        "total_without_linkedin": total_without_linkedin,
        "description": "Stage 1 & 2 contacts grouped by persona → keyword, not contacted via LinkedIn in 8+ days"
    }


@router.post("/linkedin/generate-messages/{keyword}")
async def generate_linkedin_messages_for_keyword(
    keyword: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Generate LinkedIn messages for contacts of a specific keyword.
    Returns contacts with generated messages.
    """
    # Get contacts for this keyword
    contacts = await db.unified_contacts.find(
        {
            "stage": {"$in": [1, 2]},
            "$or": [
                {"source_keyword": keyword},
                {"keyword": keyword}
            ]
        },
        {"_id": 0}
    ).to_list(500)
    
    result_contacts = []
    ai_count = 0
    MAX_AI_MESSAGES = 10  # Limit AI-generated messages to avoid slow response
    
    for contact in contacts:
        # Check last contacted via LinkedIn
        last_contacted = contact.get("last_contacted_linkedin")
        days_since = days_since_date(last_contacted)
        
        if days_since < 8:
            continue
        
        first_name = contact.get("name", "").split()[0] if contact.get("name") else ""
        
        # Generate AI message for first 10 contacts, template for rest
        if ai_count < MAX_AI_MESSAGES:
            message = await generate_varied_message(
                template_type="linkedin_outreach",
                contact_name=first_name
            )
            ai_count += 1
        else:
            message = get_fallback_message(
                template_type="linkedin_outreach",
                contact_name=first_name,
                meeting_date=None,
                meeting_title=None
            )
        
        result_contacts.append({
            "contact_id": contact.get("id"),
            "name": contact.get("name", ""),
            "email": contact.get("email", ""),
            "linkedin_url": contact.get("linkedin_url", ""),
            "company": contact.get("company", ""),
            "job_title": contact.get("job_title", ""),
            "last_contacted": last_contacted,
            "message": message,
            "message_type": "linkedin",
            "category": "linkedin_outreach"
        })
    
    return {
        "keyword": keyword,
        "contacts": result_contacts,
        "count": len(result_contacts)
    }


@router.post("/mark-contacted")
async def mark_contacts_as_contacted(
    data: MarkContactedRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Mark contacts as contacted with current timestamp.
    Updates last_contacted_whatsapp or last_contacted_linkedin based on message_type.
    """
    now = datetime.now(timezone.utc).isoformat()
    
    field_name = f"last_contacted_{data.message_type}"
    
    updated = 0
    for contact_id in data.contact_ids:
        result = await db.unified_contacts.update_one(
            {"id": contact_id},
            {"$set": {field_name: now}}
        )
        if result.modified_count > 0:
            updated += 1
    
    return {
        "success": True,
        "updated": updated,
        "total": len(data.contact_ids),
        "field_updated": field_name,
        "timestamp": now
    }


@router.get("/stats")
async def get_message_stats(
    current_user: dict = Depends(get_current_user)
):
    """Get statistics for today's messages"""
    
    # Count contacts by stage
    stage_counts = {}
    for stage in [1, 2, 3, 4]:
        count = await db.unified_contacts.count_documents({"stage": stage})
        stage_counts[f"stage_{stage}"] = count
    
    # Count contacts contacted today
    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0).isoformat()
    
    whatsapp_today = await db.unified_contacts.count_documents({
        "last_contacted_whatsapp": {"$gte": today_start}
    })
    
    linkedin_today = await db.unified_contacts.count_documents({
        "last_contacted_linkedin": {"$gte": today_start}
    })
    
    return {
        "stage_counts": stage_counts,
        "contacted_today": {
            "whatsapp": whatsapp_today,
            "linkedin": linkedin_today
        }
    }



class RegenerateMessagesRequest(BaseModel):
    contact_ids: List[str]
    template_type: str
    meeting_dates: Optional[Dict[str, str]] = {}  # contact_id -> date


@router.post("/regenerate-messages")
async def regenerate_messages_with_ai(
    data: RegenerateMessagesRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Regenerate messages for specific contacts using AI.
    Called when user clicks "Copy" to get varied messages.
    """
    messages = {}
    
    # Validate template type - meeting_today/meeting_tomorrow require meeting_date
    meeting_templates = ["meeting_today", "meeting_tomorrow", "meeting_21_days_new", "meeting_21_days_followup"]
    
    for contact_id in data.contact_ids[:20]:  # Limit to 20 at a time
        # Get contact info
        contact = await db.unified_contacts.find_one({"id": contact_id}, {"_id": 0})
        if not contact:
            continue
        
        first_name = contact.get("name", "").split()[0] if contact.get("name") else ""
        meeting_date = data.meeting_dates.get(contact_id)
        
        # If using meeting template but no meeting date provided, fall back to alumni check-in
        actual_template = data.template_type
        if data.template_type in meeting_templates and not meeting_date:
            logger.warning(f"Contact {contact_id} requested {data.template_type} but has no meeting_date, falling back to alumni_checkin_whatsapp")
            actual_template = "alumni_checkin_whatsapp"
        
        message = await generate_varied_message(
            template_type=actual_template,
            contact_name=first_name,
            meeting_date=format_date_spanish(meeting_date) if meeting_date else None,
            meeting_title=None,
            company=contact.get("company")
        )
        
        messages[contact_id] = message
    
    return {
        "success": True,
        "messages": messages,
        "count": len(messages)
    }



@router.get("/linkedin/active-events")
async def get_active_linkedin_events(
    current_user: dict = Depends(get_current_user)
):
    """
    Get list of active LinkedIn event URLs (1.3.2)
    Returns events with status 'published' or 'draft' - includes those missing LinkedIn URL
    """
    # Get events from webinar_events collection
    now = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    
    events = await db.webinar_events.find(
        {
            "$or": [
                {"status": "published"},
                {"status": "draft"},
                {"date": {"$gte": now}}  # Future events
            ]
        },
        {"_id": 0, "id": 1, "name": 1, "date": 1, "url_linkedin": 1, "url": 1, "status": 1, "buyer_personas": 1}
    ).sort("date", 1).to_list(50)
    
    # Also check webinar_events_v2
    events_v2 = await db.webinar_events_v2.find(
        {
            "$or": [
                {"status": "published"},
                {"status": "active"},
                {"webinar_date": {"$gte": now}}
            ]
        },
        {"_id": 0, "id": 1, "name": 1, "webinar_date": 1, "linkedin_url": 1, "website_url": 1, "status": 1}
    ).sort("webinar_date", 1).to_list(50)
    
    # Normalize format
    all_events = []
    
    for e in events:
        linkedin_url = e.get("url_linkedin") or ""
        all_events.append({
            "id": e.get("id"),
            "name": e.get("name"),
            "date": e.get("date"),
            "linkedin_url": linkedin_url,
            "website_url": e.get("url", ""),
            "status": e.get("status"),
            "buyer_personas": e.get("buyer_personas", []),
            "collection": "webinar_events",
            "has_linkedin_url": bool(linkedin_url)
        })
    
    for e in events_v2:
        linkedin_url = e.get("linkedin_url") or ""
        all_events.append({
            "id": e.get("id"),
            "name": e.get("name"),
            "date": e.get("webinar_date"),
            "linkedin_url": linkedin_url,
            "website_url": e.get("website_url", ""),
            "status": e.get("status"),
            "buyer_personas": [],
            "collection": "webinar_events_v2",
            "has_linkedin_url": bool(linkedin_url)
        })
    
    # Remove duplicates by ID
    seen_ids = set()
    unique_events = []
    for e in all_events:
        event_id = e.get("id", "")
        if event_id and event_id not in seen_ids:
            seen_ids.add(event_id)
            unique_events.append(e)
    
    # Separate events with and without LinkedIn URL
    with_url = [e for e in unique_events if e.get("has_linkedin_url")]
    without_url = [e for e in unique_events if not e.get("has_linkedin_url")]
    
    # Build copyable text (just URLs, one per line)
    urls_text = "\n".join(e.get("linkedin_url", "") for e in with_url if e.get("linkedin_url"))
    
    return {
        "events": unique_events,
        "events_with_url": with_url,
        "events_missing_url": without_url,
        "count": len(unique_events),
        "missing_url_count": len(without_url),
        "urls_copyable": urls_text
    }


class UpdateLinkedInUrlRequest(BaseModel):
    event_id: str
    linkedin_url: str
    collection: str = "webinar_events"  # or "webinar_events_v2"


@router.post("/linkedin/update-event-url")
async def update_event_linkedin_url(
    data: UpdateLinkedInUrlRequest,
    current_user: dict = Depends(get_current_user)
):
    """Update the LinkedIn URL for an event"""
    if data.collection == "webinar_events_v2":
        result = await db.webinar_events_v2.update_one(
            {"id": data.event_id},
            {"$set": {"linkedin_url": data.linkedin_url}}
        )
    else:
        result = await db.webinar_events.update_one(
            {"id": data.event_id},
            {"$set": {"url_linkedin": data.linkedin_url}}
        )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Event not found")
    
    return {"success": True, "updated": True}


@router.get("/whatsapp/small-businesses")
async def get_whatsapp_small_businesses(
    cooldown_days: int = 7,  # Days since last contact
    current_user: dict = Depends(get_current_user)
):
    """
    Get WhatsApp messages for small businesses (1.3.3)
    Only returns businesses not contacted in the last N days (cooldown)
    """
    # Calculate cutoff date for cooldown
    cutoff_date = (datetime.now(timezone.utc) - timedelta(days=cooldown_days)).isoformat()
    
    # Get businesses that either:
    # 1. Have never been contacted
    # 2. Were contacted more than cooldown_days ago
    businesses = await db.small_businesses.find(
        {
            "$or": [
                {"whatsapp_contacted": {"$ne": True}},
                {"last_contacted_at": {"$lt": cutoff_date}},
                {"last_contacted_at": {"$exists": False}}
            ]
        },
        {"_id": 0}
    ).sort("created_at", -1).to_list(200)
    
    contacts = []
    
    for biz in businesses:
        phone = biz.get("phone") or biz.get("formatted_phone_number")
        if not phone:
            continue
        
        # Generate template message
        first_name = (biz.get("name", "").split()[0] if biz.get("name") else "Amigo")
        message = get_fallback_message(
            template_type="quote_followup",  # Reuse the friendly follow-up template
            contact_name=first_name,
            meeting_date=None,
            meeting_title=None
        )
        
        contacts.append({
            "contact_id": biz.get("id"),
            "name": biz.get("name", ""),
            "phone": phone,
            "address": biz.get("address", ""),
            "business_type": biz.get("business_type", ""),
            "city": biz.get("city", ""),
            "last_contacted": biz.get("last_contacted_at"),
            "contact_count": biz.get("contact_count", 0),
            "message": message,
            "message_type": "whatsapp",
            "category": "small_business"
        })
    
    return {
        "contacts": contacts,
        "count": len(contacts),
        "cooldown_days": cooldown_days,
        "description": f"Small businesses not contacted in {cooldown_days}+ days"
    }


@router.post("/whatsapp/mark-business-contacted")
async def mark_business_as_contacted(
    business_ids: List[str],
    current_user: dict = Depends(get_current_user)
):
    """Mark small businesses as contacted via WhatsApp"""
    now = datetime.now(timezone.utc).isoformat()
    updated = 0
    
    for biz_id in business_ids:
        result = await db.small_businesses.update_one(
            {"id": biz_id},
            {
                "$set": {
                    "whatsapp_contacted": True,
                    "last_contacted_at": now
                },
                "$inc": {"contact_count": 1}
            }
        )
        if result.modified_count > 0:
            updated += 1
    
    return {
        "success": True,
        "updated": updated,
        "timestamp": now
    }



# ============ NEW UNIFIED WHATSAPP ENDPOINT ============

# Contacts to always ignore from messaging list
IGNORED_EMAILS = [
    "maria.gargari@leaderlix.com"
]

class DismissContactRequest(BaseModel):
    contact_id: str
    contact_type: str  # "contact" or "business"


class AddPhoneRequest(BaseModel):
    contact_id: str
    contact_type: str  # "contact" or "business"
    phone: str


class IgnoredContactCreate(BaseModel):
    email: str
    reason: Optional[str] = None


@router.get("/ignored-contacts")
async def list_ignored_contacts(
    current_user: dict = Depends(get_current_user)
):
    """List all permanently ignored contacts"""
    ignored = await db.ignored_contacts.find(
        {},
        {"_id": 0}
    ).to_list(100)
    
    # Combine with hardcoded list
    all_ignored = set(IGNORED_EMAILS)
    for i in ignored:
        if i.get("email"):
            all_ignored.add(i["email"].lower())
    
    return {
        "ignored_emails": list(all_ignored),
        "count": len(all_ignored)
    }


@router.post("/ignored-contacts")
async def add_ignored_contact(
    data: IgnoredContactCreate,
    current_user: dict = Depends(get_current_user)
):
    """Add a contact to the permanently ignored list"""
    email = data.email.lower().strip()
    
    # Check if already ignored
    existing = await db.ignored_contacts.find_one({"email": email})
    if existing or email in [e.lower() for e in IGNORED_EMAILS]:
        return {"success": True, "already_ignored": True}
    
    await db.ignored_contacts.insert_one({
        "id": str(uuid.uuid4()),
        "email": email,
        "reason": data.reason,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "created_by": current_user["id"]
    })
    
    return {"success": True, "added": True}


@router.delete("/ignored-contacts/{email}")
async def remove_ignored_contact(
    email: str,
    current_user: dict = Depends(get_current_user)
):
    """Remove a contact from the ignored list"""
    result = await db.ignored_contacts.delete_one({"email": email.lower()})
    return {"success": True, "removed": result.deleted_count > 0}


@router.get("/whatsapp/all-contacts")
async def get_all_whatsapp_contacts(
    current_user: dict = Depends(get_current_user)
):
    """
    UNIFIED endpoint: Returns ALL contacts that match ANY messaging rule.
    No more dropdown selection - shows everyone that needs a message today.
    
    Rules:
    1. Meeting today (not yet occurred)
    2. Students in Stage 4 (role="estudiante") without meeting in 60 days - every 8 days
    3. Quotes (Step 3 with quote) without meeting in 30 days - every 9 days
    4. New businesses (never contacted or contacted once 10+ days ago)
    
    IMPORTANT: Contacts that have been contacted TODAY are filtered out.
    They will reappear tomorrow if they match any rule again.
    """
    all_contacts = []
    now = datetime.now(timezone.utc)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0).isoformat()
    
    # Get ignored emails
    ignored_db = await db.ignored_contacts.find({}, {"_id": 0, "email": 1}).to_list(100)
    ignored_emails = set(e.lower() for e in IGNORED_EMAILS)
    for i in ignored_db:
        if i.get("email"):
            ignored_emails.add(i["email"].lower())
    
    # Get contacts contacted today (to filter them out)
    contacted_today_ids = set()
    contacted_today = await db.unified_contacts.find(
        {"last_contacted_whatsapp": {"$gte": today_start}},
        {"_id": 0, "id": 1}
    ).to_list(1000)
    for c in contacted_today:
        contacted_today_ids.add(c.get("id"))
    
    # Get businesses contacted today
    businesses_contacted_today = await db.small_businesses.find(
        {"last_contacted_at": {"$gte": today_start}},
        {"_id": 0, "id": 1}
    ).to_list(1000)
    for b in businesses_contacted_today:
        contacted_today_ids.add(b.get("id"))
    
    # Get ignored emails
    ignored_db = await db.ignored_contacts.find({}, {"_id": 0, "email": 1}).to_list(100)
    ignored_emails = set(e.lower() for e in IGNORED_EMAILS)
    for i in ignored_db:
        if i.get("email"):
            ignored_emails.add(i["email"].lower())
    
    # Get all calendar events for the next 60 days (for meeting check)
    # Wrap in try-catch to handle calendar auth errors gracefully
    try:
        events = await get_calendar_events_for_messages(60)
    except Exception as e:
        print(f"Calendar error (continuing without calendar data): {e}")
        events = []
    
    # Build set of emails with upcoming meetings
    emails_with_meetings_60d = set()
    emails_with_meetings_30d = set()
    today_meeting_contacts = []
    
    for event in events:
        attendees = event.get('attendees', [])
        start = event.get('start', {})
        event_date_str = start.get('dateTime') or start.get('date', '')
        event_title = event.get('summary', 'Reunión')
        
        # Parse event datetime
        try:
            if "T" in event_date_str:
                event_dt = datetime.fromisoformat(event_date_str.replace("Z", "+00:00"))
            else:
                event_dt = datetime.fromisoformat(event_date_str).replace(tzinfo=timezone.utc)
        except:
            continue
        
        days_until = (event_dt.date() - now.date()).days
        is_today = days_until == 0
        is_future_today = is_today and event_dt > now  # Meeting today but hasn't happened yet
        
        for attendee in attendees:
            if attendee.get('self'):
                continue
            
            email = attendee.get('email', '').lower()
            if not email:
                continue
            
            if days_until <= 60:
                emails_with_meetings_60d.add(email)
            if days_until <= 30:
                emails_with_meetings_30d.add(email)
            
            # RULE 1: Meeting today (not yet occurred)
            if is_future_today:
                contact = await get_contact_by_email(email)
                if not contact:
                    contact = {
                        "id": str(uuid.uuid4()),
                        "name": attendee.get('displayName', email.split('@')[0]),
                        "email": email,
                        "phone": "",
                        "company": ""
                    }
                
                first_name = contact.get("name", "").split()[0] if contact.get("name") else ""
                message = get_fallback_message(
                    template_type="meeting_today",
                    contact_name=first_name,
                    meeting_date=format_date_spanish(event_date_str),
                    meeting_title=event_title
                )
                
                today_meeting_contacts.append({
                    "contact_id": contact.get("id"),
                    "name": contact.get("name", ""),
                    "email": email,
                    "phone": contact.get("phone", ""),
                    "company": contact.get("company", ""),
                    "meeting_date": event_date_str,
                    "meeting_title": event_title,
                    "last_contacted": contact.get("last_contacted_whatsapp"),
                    "message": message,
                    "message_type": "whatsapp",
                    "category": "meeting_today",
                    "rule_matched": "Appointment today",
                    "contact_type": "contact"
                })
            
            # RULE 1b: Meeting tomorrow
            is_tomorrow = days_until == 1
            if is_tomorrow:
                contact = await get_contact_by_email(email)
                if not contact:
                    contact = {
                        "id": str(uuid.uuid4()),
                        "name": attendee.get('displayName', email.split('@')[0]),
                        "email": email,
                        "phone": "",
                        "company": ""
                    }
                
                first_name = contact.get("name", "").split()[0] if contact.get("name") else ""
                message = get_fallback_message(
                    template_type="meeting_tomorrow",
                    contact_name=first_name,
                    meeting_date=format_date_spanish(event_date_str),
                    meeting_title=event_title
                )
                
                today_meeting_contacts.append({
                    "contact_id": contact.get("id"),
                    "name": contact.get("name", ""),
                    "email": email,
                    "phone": contact.get("phone", ""),
                    "company": contact.get("company", ""),
                    "meeting_date": event_date_str,
                    "meeting_title": event_title,
                    "last_contacted": contact.get("last_contacted_whatsapp"),
                    "message": message,
                    "message_type": "whatsapp",
                    "category": "meeting_tomorrow",
                    "rule_matched": "Appointment tomorrow",
                    "contact_type": "contact"
                })
            
            # RULE 1c: Meeting in next 21 days (not today, not tomorrow) - never contacted or contacted >7 days ago
            if 2 <= days_until <= 21:
                contact = await get_contact_by_email(email)
                if not contact:
                    contact = {
                        "id": str(uuid.uuid4()),
                        "name": attendee.get('displayName', email.split('@')[0]),
                        "email": email,
                        "phone": "",
                        "company": ""
                    }
                
                last_contacted = contact.get("last_contacted_whatsapp")
                days_since_contact = days_since_date(last_contacted)
                
                # Include if never contacted OR contacted more than 7 days ago
                if days_since_contact >= 7:
                    first_name = contact.get("name", "").split()[0] if contact.get("name") else ""
                    
                    if days_since_contact >= 9999:
                        template_type = "meeting_21_days_new"
                        rule_matched = "Appointment in 21 days (never contacted)"
                    else:
                        template_type = "meeting_21_days_followup"
                        rule_matched = "Appointment in 21 days (followup)"
                    
                    message = get_fallback_message(
                        template_type=template_type,
                        contact_name=first_name,
                        meeting_date=format_date_spanish(event_date_str),
                        meeting_title=event_title
                    )
                    
                    today_meeting_contacts.append({
                        "contact_id": contact.get("id"),
                        "name": contact.get("name", ""),
                        "email": email,
                        "phone": contact.get("phone", ""),
                        "company": contact.get("company", ""),
                        "meeting_date": event_date_str,
                        "meeting_title": event_title,
                        "last_contacted": last_contacted,
                        "message": message,
                        "message_type": "whatsapp",
                        "category": "meeting_confirmation",
                        "rule_matched": rule_matched,
                        "contact_type": "contact"
                    })
    
    # Deduplicate meeting contacts by email and filter out ignored AND already contacted today
    seen_emails = set()
    for c in today_meeting_contacts:
        email = c["email"].lower() if c.get("email") else ""
        contact_id = c.get("contact_id")
        
        # Skip if contacted today
        if contact_id and contact_id in contacted_today_ids:
            continue
        
        if email and email not in seen_emails and email not in ignored_emails:
            seen_emails.add(email)
            all_contacts.append(c)
    
    # RULE 2: Coachees in Stage 4 (role="coachee") without meeting in 60 days, every 8 days
    # Note: Only coachees receive coaching session reminders, not regular students
    # This applies to ALL Stage 4 coachees. They move to Stage 5 when project reaches "concluidos"
    coachee_cadence_query = build_cadence_query("last_contacted_whatsapp", CADENCE_PERIODS["whatsapp_student"])
    coachees = await db.unified_contacts.find(
        {
            "$or": [
                {"roles": COACHEE_ROLES_QUERY},
                {"contact_types": COACHEE_ROLES_QUERY}
            ],
            "stage": 4,  # All Stage 4 coachees
            **coachee_cadence_query
        },
        {"_id": 0}
    ).to_list(500)
    
    for coachee in coachees:
        email = (coachee.get("email") or "").lower()
        
        # Skip if ignored
        if email and email in ignored_emails:
            continue
        
        # Skip if they have a meeting in the next 60 days
        if email and email in emails_with_meetings_60d:
            continue
        
        # Skip if already in list
        if email and email in seen_emails:
            continue
        
        # Skip if contacted today
        coachee_id = coachee.get("id")
        if coachee_id and coachee_id in contacted_today_ids:
            continue
        
        first_name = coachee.get("name", "").split()[0] if coachee.get("name") else ""
        message = f"Hola {first_name}! Ya agendaste tu proxima sesion de coaching? Te dejo el link: leaderlix.com/coaching - Equipo Leaderlix"
        
        all_contacts.append({
            "id": coachee.get("id"),
            "contact_id": coachee.get("id"),
            "name": coachee.get("name", ""),
            "email": coachee.get("email", ""),
            "phone": coachee.get("phone", ""),
            "company": coachee.get("company", ""),
            "buyer_persona": coachee.get("buyer_persona", "mateo"),
            "meeting_date": None,
            "meeting_title": None,
            "last_contacted": coachee.get("last_contacted_whatsapp"),
            "message": message,
            "message_type": "whatsapp",
            "category": "coachee_coaching",
            "rule_matched": "Coachee sin cita (8 días)",
            "contact_type": "contact"
        })
        
        if email:
            seen_emails.add(email)
    
    # RULE 3: Quotes (Step 3 with quote) without meeting in 30 days, every 9 days
    quote_cadence_query = build_cadence_query("last_contacted_whatsapp", CADENCE_PERIODS["whatsapp_quote"])
    
    # Get all quotes
    quotes = await db.quotes.find(
        {"status": {"$ne": "cancelled"}},
        {"_id": 0, "contact_id": 1, "client_email": 1, "client_name": 1, "company": 1}
    ).to_list(500)
    
    quote_emails = {q.get("client_email", "").lower(): q for q in quotes if q.get("client_email")}
    
    # Get Stage 3 contacts
    stage3_contacts = await db.unified_contacts.find(
        {
            "stage": 3,
            **quote_cadence_query
        },
        {"_id": 0}
    ).to_list(500)
    
    for contact in stage3_contacts:
        email = (contact.get("email") or "").lower()
        
        # Skip if ignored
        if email and email in ignored_emails:
            continue
        
        # Must have a quote
        if email not in quote_emails:
            continue
        
        # Skip if they have a meeting in the next 30 days
        if email in emails_with_meetings_30d:
            continue
        
        # Skip if already in list
        if email in seen_emails:
            continue
        
        # Skip if contacted today
        contact_id = contact.get("id")
        if contact_id and contact_id in contacted_today_ids:
            continue
        
        first_name = contact.get("name", "").split()[0] if contact.get("name") else ""
        company = contact.get("company", "tu empresa")
        message = f"Hola {first_name}! Tuviste oportunidad de revisar la cotizacion para {company}? Estoy a tus ordenes para cualquier duda. - Equipo Leaderlix"
        
        all_contacts.append({
            "id": contact.get("id"),
            "contact_id": contact.get("id"),
            "name": contact.get("name", ""),
            "email": contact.get("email", ""),
            "phone": contact.get("phone", ""),
            "company": contact.get("company", ""),
            "buyer_persona": contact.get("buyer_persona", "mateo"),
            "meeting_date": None,
            "meeting_title": None,
            "last_contacted": contact.get("last_contacted_whatsapp"),
            "message": message,
            "message_type": "whatsapp",
            "category": "quote_followup",
            "rule_matched": "Pending quote (9 days)",
            "contact_type": "contact"
        })
        
        seen_emails.add(email)
    
    # RULE 4: New businesses from 1.1.2
    # First message: identify business type
    # Second message: "Hola qué tal" after 10 days
    # Then stop
    ten_days_ago = (now - timedelta(days=10)).isoformat()
    
    # Get business types for category names
    business_types = await db.business_types.find({}, {"_id": 0}).to_list(100)
    bt_map = {bt["id"]: bt["category_name"] for bt in business_types}
    
    # Get businesses that need first contact (never contacted)
    new_businesses = await db.small_businesses.find(
        {
            "contact_count": {"$in": [0, None]},
            "$or": [
                {"whatsapp_contacted": {"$ne": True}},
                {"whatsapp_contacted": {"$exists": False}}
            ]
        },
        {"_id": 0}
    ).sort("created_at", -1).to_list(200)
    
    for biz in new_businesses:
        phone = biz.get("phone") or biz.get("formatted_phone_number")
        if not phone:
            continue
        
        # Skip if contacted today
        biz_id = biz.get("id")
        if biz_id and biz_id in contacted_today_ids:
            continue
        
        # Get business type name for message
        bt_id = biz.get("business_type_id")
        category_name = bt_map.get(bt_id) or biz.get("business_type") or "negocio"
        
        # First message: identify business type
        message = f"Hola, ¿estoy escribiendo a la {category_name}?"
        
        all_contacts.append({
            "contact_id": biz.get("id"),
            "name": biz.get("name", ""),
            "email": "",
            "phone": phone,
            "company": "",
            "address": biz.get("address", ""),
            "business_type": category_name,
            "city": biz.get("city", ""),
            "meeting_date": None,
            "meeting_title": None,
            "last_contacted": None,
            "contact_count": 0,
            "message": message,
            "message_type": "whatsapp",
            "category": "new_business_first",
            "rule_matched": "New business (first contact)",
            "contact_type": "business"
        })
    
    # Get businesses contacted once, more than 10 days ago
    followup_businesses = await db.small_businesses.find(
        {
            "contact_count": 1,
            "last_contacted_at": {"$lt": ten_days_ago}
        },
        {"_id": 0}
    ).sort("last_contacted_at", 1).to_list(200)
    
    for biz in followup_businesses:
        phone = biz.get("phone") or biz.get("formatted_phone_number")
        if not phone:
            continue
        
        # Skip if contacted today
        biz_id = biz.get("id")
        if biz_id and biz_id in contacted_today_ids:
            continue
        
        # Second message: simple greeting
        message = "Hola que tal"
        
        all_contacts.append({
            "contact_id": biz.get("id"),
            "name": biz.get("name", ""),
            "email": "",
            "phone": phone,
            "company": "",
            "address": biz.get("address", ""),
            "business_type": biz.get("business_type", ""),
            "city": biz.get("city", ""),
            "meeting_date": None,
            "meeting_title": None,
            "last_contacted": biz.get("last_contacted_at"),
            "contact_count": 1,
            "message": message,
            "message_type": "whatsapp",
            "category": "new_business_followup",
            "rule_matched": "New business (second contact)",
            "contact_type": "business"
        })
    
    # RULE 5: Alumni check-in (coachees and students in Stage 5) - every 90 days
    # Messages are NOT generated automatically - user selects contacts and clicks "Generate"
    # This includes both coachees and regular students who have completed their programs
    alumni_cadence_query = build_cadence_query("last_contacted_whatsapp", CADENCE_PERIODS["whatsapp_alumni"])
    alumni_contacts = await db.unified_contacts.find(
        {
            "$or": [
                {"roles": STUDENT_ROLES_QUERY},
                {"roles": COACHEE_ROLES_QUERY},
                {"contact_types": STUDENT_ROLES_QUERY},
                {"contact_types": COACHEE_ROLES_QUERY}
            ],
            "stage": 5,  # Stage 5 (Repurchase) estudiantes/coachees = alumni check-in
            **alumni_cadence_query
        },
        {"_id": 0}
    ).to_list(500)
    
    for alumni in alumni_contacts:
        email = (alumni.get("email") or "").lower()
        
        # Skip if ignored
        if email and email in ignored_emails:
            continue
        
        # Skip if already in list (higher priority rule matched)
        if email and email in seen_emails:
            continue
        
        # Skip if they have a meeting in the next 60 days (appointment rules take priority)
        if email and email in emails_with_meetings_60d:
            continue
        
        # Skip if no phone
        phone = get_primary_phone(alumni)
        if not phone:
            continue
        
        # Skip if contacted today
        alumni_id = alumni.get("id")
        if alumni_id and alumni_id in contacted_today_ids:
            continue
        
        # No message generated - user will select and click "Generate"
        all_contacts.append({
            "id": alumni.get("id"),
            "name": alumni.get("name", ""),
            "first_name": alumni.get("first_name", ""),
            "last_name": alumni.get("last_name", ""),
            "email": alumni.get("email", ""),
            "phone": phone,
            "company": alumni.get("company", ""),
            "buyer_persona": alumni.get("buyer_persona", "mateo"),
            "meeting_date": None,
            "meeting_title": None,
            "last_contacted": alumni.get("last_contacted_whatsapp"),
            "message": "",  # Empty - will be generated on demand
            "message_type": "whatsapp",
            "category": "alumni_checkin",
            "rule_matched": "Alumni check-in (90 days)",
            "contact_type": "contact"
        })
        
        if email:
            seen_emails.add(email)
    
    # RULE 6: Deal Makers from Cases - Stage 3 Propuestas (Presentado / Con Interés)
    # Get Stage 3 active cases in "presentado" or "con_interes" stages
    propuesta_cases = await db.cases.find(
        {
            "stage": {"$in": ["caso_presentado", "interes_en_caso"]},
            "status": "active",
            "delivery_stage": {"$exists": False}
        },
        {"_id": 0, "id": 1, "name": 1, "contact_ids": 1, "company_names": 1, "stage": 1}
    ).to_list(500)
    
    for case in propuesta_cases:
        contact_ids = case.get("contact_ids", [])
        if not contact_ids:
            continue
        
        # Find deal makers for this case
        deal_makers = await db.unified_contacts.find(
            {
                "id": {"$in": contact_ids},
                "roles": "deal_maker"
            },
            {"_id": 0}
        ).to_list(50)
        
        for dm in deal_makers:
            dm_id = dm.get("id")
            email = (dm.get("email") or "").lower()
            phone = dm.get("phone", "")
            
            # Skip if no phone
            if not phone:
                continue
            
            # Skip if contacted today
            if dm_id and dm_id in contacted_today_ids:
                continue
            
            # Skip if already in list
            if email and email in seen_emails:
                continue
            
            first_name = dm.get("name", "").split()[0] if dm.get("name") else ""
            case_stage_label = "propuesta" if case.get("stage") == "caso_presentado" else "interés mostrado"
            company_names = [n for n in case.get("company_names", []) if n]  # Filter None values
            
            all_contacts.append({
                "id": dm_id,
                "contact_id": dm_id,
                "name": dm.get("name", ""),
                "email": dm.get("email", ""),
                "phone": phone,
                "company": ", ".join(company_names) if company_names else dm.get("company", ""),
                "buyer_persona": dm.get("buyer_persona", "mateo"),
                "meeting_date": None,
                "meeting_title": None,
                "last_contacted": dm.get("last_contacted_whatsapp"),
                "message": f"¡Hola {first_name}! Solo te mando este mensajito de recordatorio de que cualquier cosa sobre la propuesta que les hicimos, estoy a tus órdenes. ¡Saludos! - Perla",
                "message_type": "whatsapp",
                "category": "dealmaker_propuesta",
                "rule_matched": "Deal Maker - Propuesta (Stage 3)",
                "contact_type": "contact",
                "case_name": case.get("name", ""),
                "case_stage": case_stage_label
            })
            
            if email:
                seen_emails.add(email)
    
    # RULE 7: Deal Makers from Cases - Stage 3 Cierre Administrativo
    cierre_cases = await db.cases.find(
        {
            "stage": "cierre_administrativo",
            "status": "active",
            "delivery_stage": {"$exists": False}
        },
        {"_id": 0, "id": 1, "name": 1, "contact_ids": 1, "company_names": 1}
    ).to_list(500)
    
    for case in cierre_cases:
        contact_ids = case.get("contact_ids", [])
        if not contact_ids:
            continue
        
        # Find deal makers for this case
        deal_makers = await db.unified_contacts.find(
            {
                "id": {"$in": contact_ids},
                "roles": "deal_maker"
            },
            {"_id": 0}
        ).to_list(50)
        
        for dm in deal_makers:
            dm_id = dm.get("id")
            email = (dm.get("email") or "").lower()
            phone = dm.get("phone", "")
            
            # Skip if no phone
            if not phone:
                continue
            
            # Skip if contacted today
            if dm_id and dm_id in contacted_today_ids:
                continue
            
            # Skip if already in list
            if email and email in seen_emails:
                continue
            
            first_name = dm.get("name", "").split()[0] if dm.get("name") else ""
            company_names = [n for n in case.get("company_names", []) if n]  # Filter None values
            
            all_contacts.append({
                "id": dm_id,
                "contact_id": dm_id,
                "name": dm.get("name", ""),
                "email": dm.get("email", ""),
                "phone": phone,
                "company": ", ".join(company_names) if company_names else dm.get("company", ""),
                "buyer_persona": dm.get("buyer_persona", "mateo"),
                "meeting_date": None,
                "meeting_title": None,
                "last_contacted": dm.get("last_contacted_whatsapp"),
                "message": f"¡Hola {first_name}! Solo te mando este mensajito de recordatorio de que cualquier cosa sobre el proyecto que tenemos en puerta, estoy a tus órdenes. ¡Saludos! - Perla",
                "message_type": "whatsapp",
                "category": "dealmaker_cierre",
                "rule_matched": "Deal Maker - Cierre Admin (Stage 3)",
                "contact_type": "contact",
                "case_name": case.get("name", ""),
                "case_stage": "cierre_administrativo"
            })
            
            if email:
                seen_emails.add(email)
    
    # Calculate status for traffic light
    # Green = all contacts for today have been contacted (list is empty)
    # Red = there are pending contacts to message
    all_done = len(all_contacts) == 0
    contacted_today_count = len(contacted_today_ids)
    
    return {
        "contacts": all_contacts,
        "count": len(all_contacts),
        "rules_summary": {
            "meeting_today": sum(1 for c in all_contacts if c["category"] == "meeting_today"),
            "meeting_tomorrow": sum(1 for c in all_contacts if c["category"] == "meeting_tomorrow"),
            "meeting_confirmation": sum(1 for c in all_contacts if c["category"] == "meeting_confirmation"),
            "student_coaching": sum(1 for c in all_contacts if c["category"] == "student_coaching"),
            "quote_followup": sum(1 for c in all_contacts if c["category"] == "quote_followup"),
            "new_business_first": sum(1 for c in all_contacts if c["category"] == "new_business_first"),
            "new_business_followup": sum(1 for c in all_contacts if c["category"] == "new_business_followup"),
            "alumni_checkin": sum(1 for c in all_contacts if c["category"] == "alumni_checkin"),
            "dealmaker_propuesta": sum(1 for c in all_contacts if c["category"] == "dealmaker_propuesta"),
            "dealmaker_cierre": sum(1 for c in all_contacts if c["category"] == "dealmaker_cierre"),
        },
        "traffic_light": {
            "status": "green" if all_done else "red",
            "all_done": all_done,
            "contacted_today": contacted_today_count,
            "pending": len(all_contacts)
        }
    }


@router.post("/whatsapp/dismiss-contact")
async def dismiss_contact_for_today(
    data: DismissContactRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Dismiss a contact without phone for today. It will reappear tomorrow.
    Stores dismissal in dismissed_contacts collection.
    """
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    
    dismissal = {
        "id": str(uuid.uuid4()),
        "contact_id": data.contact_id,
        "contact_type": data.contact_type,
        "dismissed_date": today,
        "dismissed_by": current_user["id"],
        "dismissed_at": datetime.now(timezone.utc).isoformat()
    }
    
    # Upsert to avoid duplicates
    await db.dismissed_contacts.update_one(
        {
            "contact_id": data.contact_id,
            "dismissed_date": today
        },
        {"$set": dismissal},
        upsert=True
    )
    
    return {"success": True, "dismissed": True, "reappears": "tomorrow"}


@router.post("/whatsapp/add-phone")
async def add_phone_to_contact(
    data: AddPhoneRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Add a phone number to a contact or business that's missing one.
    """
    if data.contact_type == "contact":
        result = await db.unified_contacts.update_one(
            {"id": data.contact_id},
            {"$set": {"phone": data.phone}}
        )
    else:  # business
        result = await db.small_businesses.update_one(
            {"id": data.contact_id},
            {"$set": {"phone": data.phone}}
        )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Contact not found")
    
    return {"success": True, "phone_added": True}


@router.get("/whatsapp/dismissed-today")
async def get_dismissed_today(
    current_user: dict = Depends(get_current_user)
):
    """Get list of contact IDs dismissed today"""
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    
    dismissed = await db.dismissed_contacts.find(
        {"dismissed_date": today},
        {"_id": 0, "contact_id": 1}
    ).to_list(500)
    
    return {
        "dismissed_ids": [d["contact_id"] for d in dismissed],
        "count": len(dismissed)
    }



# ============ CONTACT SEARCH & DIAGNOSIS ============

@router.get("/whatsapp/search-contacts")
async def search_contacts_for_diagnosis(
    q: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Search contacts by name, email, or phone for diagnosis.
    Returns top 10 matches for dropdown selection.
    """
    if not q or len(q) < 2:
        return {"contacts": [], "total": 0}
    
    query_lower = q.lower().strip()
    results = []
    
    # Search in unified_contacts
    contacts = await db.unified_contacts.find(
        {
            "$or": [
                {"name": {"$regex": query_lower, "$options": "i"}},
                {"email": {"$regex": query_lower, "$options": "i"}},
                {"phone": {"$regex": query_lower, "$options": "i"}}
            ]
        },
        {"_id": 0, "id": 1, "name": 1, "email": 1, "phone": 1, "stage": 1, "roles": 1}
    ).limit(10).to_list(10)
    
    for c in contacts:
        results.append({
            "id": c.get("id"),
            "name": c.get("name", ""),
            "email": c.get("email", ""),
            "phone": c.get("phone", ""),
            "type": "contact",
            "stage": c.get("stage"),
            "roles": c.get("roles")
        })
    
    # Search in small_businesses if we have room
    if len(results) < 10:
        businesses = await db.small_businesses.find(
            {
                "$or": [
                    {"name": {"$regex": query_lower, "$options": "i"}},
                    {"phone": {"$regex": query_lower, "$options": "i"}}
                ]
            },
            {"_id": 0, "id": 1, "name": 1, "phone": 1, "business_type": 1}
        ).limit(10 - len(results)).to_list(10 - len(results))
        
        for b in businesses:
            results.append({
                "id": b.get("id"),
                "name": b.get("name", ""),
                "email": "",
                "phone": b.get("phone") or b.get("formatted_phone_number", ""),
                "type": "business",
                "business_type": b.get("business_type")
            })
    
    return {
        "contacts": results,
        "total": len(results)
    }


@router.get("/whatsapp/diagnose/{contact_id}")
async def diagnose_contact_rules(
    contact_id: str,
    contact_type: str = "contact",
    current_user: dict = Depends(get_current_user)
):
    """
    Diagnose why a contact does or doesn't qualify for a WhatsApp message.
    Checks all rules and returns detailed explanation for each.
    """
    now = datetime.now(timezone.utc)
    today = now.strftime("%Y-%m-%d")
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0).isoformat()
    
    # Thresholds
    eight_days_ago = (now - timedelta(days=8)).isoformat()
    nine_days_ago = (now - timedelta(days=9)).isoformat()
    ten_days_ago = (now - timedelta(days=10)).isoformat()
    sixty_days_from_now = (now + timedelta(days=60)).isoformat()
    thirty_days_from_now = (now + timedelta(days=30)).isoformat()
    
    diagnosis = {
        "should_receive_message": False,
        "matched_rule": None,
        "rules_checked": [],
        "contacted_today": False,
        "last_contacted_whatsapp": None,
        "days_since_contact": None
    }
    
    if contact_type == "business":
        # Get business
        business = await db.small_businesses.find_one({"id": contact_id}, {"_id": 0})
        if not business:
            raise HTTPException(status_code=404, detail="Business not found")
        
        contact_info = {
            "id": business.get("id"),
            "name": business.get("name", ""),
            "email": "",
            "phone": business.get("phone") or business.get("formatted_phone_number", ""),
            "type": "business",
            "business_type": business.get("business_type"),
            "contact_count": business.get("contact_count", 0),
            "last_contacted_at": business.get("last_contacted_at")
        }
        
        has_phone = bool(contact_info["phone"])
        
        # Check if contacted today
        if business.get("last_contacted_at") and business.get("last_contacted_at") >= today_start:
            diagnosis["contacted_today"] = True
        
        diagnosis["last_contacted_whatsapp"] = business.get("last_contacted_at")
        if business.get("last_contacted_at"):
            try:
                last_contact_date = datetime.fromisoformat(business["last_contacted_at"].replace("Z", "+00:00"))
                diagnosis["days_since_contact"] = (now - last_contact_date).days
            except:
                pass
        
        # Rule: New business first contact
        rule_new_first = {
            "rule": "new_business_first",
            "rule_name": "Negocio nuevo (primer contacto)",
            "passed": False,
            "reason": ""
        }
        
        if not has_phone:
            rule_new_first["reason"] = "No tiene número de teléfono registrado"
        elif business.get("contact_count", 0) > 0:
            rule_new_first["reason"] = f"Ya ha sido contactado {business.get('contact_count', 0)} vez(es)"
        else:
            rule_new_first["passed"] = True
            rule_new_first["reason"] = "Negocio nuevo sin contactar - CUMPLE"
            diagnosis["should_receive_message"] = True
            diagnosis["matched_rule"] = "new_business_first"
        
        diagnosis["rules_checked"].append(rule_new_first)
        
        # Rule: New business followup (contacted once, 10+ days ago)
        rule_followup = {
            "rule": "new_business_followup",
            "rule_name": "Negocio (segundo contacto)",
            "passed": False,
            "reason": ""
        }
        
        if not has_phone:
            rule_followup["reason"] = "No tiene número de teléfono registrado"
        elif business.get("contact_count", 0) != 1:
            rule_followup["reason"] = f"Requiere exactamente 1 contacto previo, tiene {business.get('contact_count', 0)}"
        elif not business.get("last_contacted_at") or business.get("last_contacted_at") >= ten_days_ago:
            days = diagnosis["days_since_contact"] or 0
            rule_followup["reason"] = f"Último contacto hace {days} días, requiere 10+ días"
        else:
            rule_followup["passed"] = True
            rule_followup["reason"] = f"Contactado 1 vez hace {diagnosis['days_since_contact']} días - CUMPLE"
            if not diagnosis["should_receive_message"]:
                diagnosis["should_receive_message"] = True
                diagnosis["matched_rule"] = "new_business_followup"
        
        diagnosis["rules_checked"].append(rule_followup)
        
        # Rules that don't apply to businesses
        for rule_name, rule_display in [
            ("meeting_today", "Cita programada hoy"),
            ("student_coaching", "Estudiante sin cita (coaching)"),
            ("quote_followup", "Seguimiento de cotización")
        ]:
            diagnosis["rules_checked"].append({
                "rule": rule_name,
                "rule_name": rule_display,
                "passed": False,
                "reason": "No aplica a negocios, solo a contactos"
            })
        
        # Check if contacted today blocks message
        if diagnosis["contacted_today"] and diagnosis["should_receive_message"]:
            diagnosis["should_receive_message"] = False
            diagnosis["matched_rule"] = None
            for rule in diagnosis["rules_checked"]:
                if rule["passed"]:
                    rule["reason"] += " - PERO ya fue contactado hoy"
        
        return {
            "contact": contact_info,
            "has_phone": has_phone,
            "diagnosis": diagnosis
        }
    
    else:
        # Get contact
        contact = await db.unified_contacts.find_one({"id": contact_id}, {"_id": 0})
        if not contact:
            raise HTTPException(status_code=404, detail="Contact not found")
        
        contact_info = {
            "id": contact.get("id"),
            "name": contact.get("name", ""),
            "email": contact.get("email", ""),
            "phone": contact.get("phone", ""),
            "type": "contact",
            "stage": contact.get("stage"),
            "roles": contact.get("roles"),
            "buyer_persona": contact.get("buyer_persona")
        }
        
        has_phone = bool(contact_info["phone"])
        email = (contact.get("email") or "").lower()
        
        # Check if contacted today
        if contact.get("last_contacted_whatsapp") and contact.get("last_contacted_whatsapp") >= today_start:
            diagnosis["contacted_today"] = True
        
        diagnosis["last_contacted_whatsapp"] = contact.get("last_contacted_whatsapp")
        if contact.get("last_contacted_whatsapp"):
            try:
                last_contact_date = datetime.fromisoformat(contact["last_contacted_whatsapp"].replace("Z", "+00:00"))
                diagnosis["days_since_contact"] = (now - last_contact_date).days
            except:
                pass
        
        # Get calendar events from Google Calendar API (same source as all-contacts)
        has_meeting_today = False
        has_meeting_tomorrow = False
        has_meeting_future = False
        has_meeting_60d = False
        has_meeting_30d = False
        next_meeting_date = None
        next_meeting_days = None
        next_meeting_title = None
        
        if email:
            try:
                # Fetch events from Google Calendar for consistency with all-contacts endpoint
                events = await get_calendar_events_for_messages(60)
                
                for event in events:
                    attendees = event.get('attendees', [])
                    start = event.get('start', {})
                    event_date_str = start.get('dateTime') or start.get('date', '')
                    
                    # Check if this contact is an attendee
                    is_attendee = any(
                        a.get('email', '').lower() == email and not a.get('self')
                        for a in attendees
                    )
                    
                    if not is_attendee:
                        continue
                    
                    # Check my response status - skip if I declined
                    my_response = None
                    for att in attendees:
                        if att.get('self'):
                            my_response = att.get('responseStatus', 'needsAction')
                            break
                    
                    if my_response == 'declined':
                        continue  # Skip events I declined
                    
                    # Parse event date
                    try:
                        if "T" in event_date_str:
                            event_dt = datetime.fromisoformat(event_date_str.replace("Z", "+00:00"))
                        else:
                            event_dt = datetime.fromisoformat(event_date_str).replace(tzinfo=timezone.utc)
                    except:
                        continue
                    
                    days_until = (event_dt.date() - now.date()).days
                    
                    if days_until == 0:
                        has_meeting_today = True
                        if not next_meeting_date:
                            next_meeting_date = event_date_str
                            next_meeting_days = 0
                            next_meeting_title = event.get('summary', 'Reunión')
                    elif days_until == 1:
                        has_meeting_tomorrow = True
                        if not next_meeting_date or next_meeting_days > 1:
                            next_meeting_date = event_date_str
                            next_meeting_days = 1
                            next_meeting_title = event.get('summary', 'Reunión')
                    elif days_until >= 2:
                        has_meeting_future = True
                        if not next_meeting_date or next_meeting_days > days_until:
                            next_meeting_date = event_date_str
                            next_meeting_days = days_until
                            next_meeting_title = event.get('summary', 'Reunión')
                    
                    if days_until >= 0 and days_until <= 60:
                        has_meeting_60d = True
                    if days_until >= 0 and days_until <= 30:
                        has_meeting_30d = True
                        
            except Exception as e:
                logger.warning(f"Calendar error in diagnose (continuing without calendar data): {e}")
        
        # Check if has quote
        has_quote = False
        quote_date = None
        if email:
            quote = await db.quotes.find_one(
                {"client_email": {"$regex": email, "$options": "i"}, "status": {"$ne": "cancelled"}},
                {"_id": 0, "created_at": 1}
            )
            if quote:
                has_quote = True
                quote_date = quote.get("created_at")
        
        # ============ RULE 1: Meeting Today ============
        rule_meeting = {
            "rule": "meeting_today",
            "rule_name": "Cita programada hoy",
            "passed": False,
            "reason": ""
        }
        
        if not has_phone:
            rule_meeting["reason"] = "No tiene número de teléfono registrado"
        elif not email:
            rule_meeting["reason"] = "No tiene email para buscar citas en calendario"
        elif not has_meeting_today:
            rule_meeting["reason"] = "No tiene cita programada para hoy"
        else:
            rule_meeting["passed"] = True
            rule_meeting["reason"] = f"Tiene cita hoy ({next_meeting_date}) - CUMPLE"
            diagnosis["should_receive_message"] = True
            diagnosis["matched_rule"] = "meeting_today"
        
        diagnosis["rules_checked"].append(rule_meeting)
        
        # ============ RULE W02: Meeting Tomorrow ============
        rule_tomorrow = {
            "rule": "W02",
            "rule_name": "Cita programada mañana",
            "passed": False,
            "reason": ""
        }
        
        if not has_phone:
            rule_tomorrow["reason"] = "No tiene número de teléfono registrado"
        elif not email:
            rule_tomorrow["reason"] = "No tiene email para buscar citas en calendario"
        elif not has_meeting_tomorrow:
            rule_tomorrow["reason"] = "No tiene cita programada para mañana"
        else:
            rule_tomorrow["passed"] = True
            rule_tomorrow["reason"] = f"Tiene cita mañana: {next_meeting_title} - CUMPLE"
            if not diagnosis["should_receive_message"]:
                diagnosis["should_receive_message"] = True
                diagnosis["matched_rule"] = "W02"
        
        diagnosis["rules_checked"].append(rule_tomorrow)
        
        # ============ RULE W03/W04: Meeting in Future Days ============
        rule_future = {
            "rule": "W03/W04",
            "rule_name": "Cita programada próximos días",
            "passed": False,
            "reason": ""
        }
        
        if not has_phone:
            rule_future["reason"] = "No tiene número de teléfono registrado"
        elif not email:
            rule_future["reason"] = "No tiene email para buscar citas en calendario"
        elif not has_meeting_future and not has_meeting_tomorrow and not has_meeting_today:
            rule_future["reason"] = "No tiene citas programadas en el calendario"
        elif has_meeting_today or has_meeting_tomorrow:
            rule_future["reason"] = "Tiene cita hoy o mañana (aplica otra regla)"
        else:
            # Check if it's first contact (W03) or followup (W04)
            last_wa = contact.get("last_contacted_whatsapp")
            is_followup = bool(last_wa)
            rule_id = "W04" if is_followup else "W03"
            
            rule_future["passed"] = True
            rule_future["rule"] = rule_id
            days_text = f"en {next_meeting_days} días" if next_meeting_days else ""
            contact_type = "Seguimiento" if is_followup else "Primer contacto"
            rule_future["reason"] = f"{contact_type} - Tiene cita {days_text}: {next_meeting_title} - CUMPLE"
            if not diagnosis["should_receive_message"]:
                diagnosis["should_receive_message"] = True
                diagnosis["matched_rule"] = rule_id
        
        diagnosis["rules_checked"].append(rule_future)
        
        # ============ RULE 2: Coachee Coaching ============
        rule_coachee = {
            "rule": "coachee_coaching",
            "rule_name": "Coachee sin cita (coaching)",
            "passed": False,
            "reason": ""
        }
        
        # Use centralized helper for coachee check
        contact_is_coachee = is_coachee(contact)
        roles = contact.get("roles") or []
        contact_stage = contact.get("stage", 1)
        
        if not has_phone:
            rule_coachee["reason"] = "No tiene número de teléfono registrado"
        elif not contact_is_coachee:
            rule_coachee["reason"] = f"No tiene rol 'coachee' (roles: {roles or 'ninguno'}). Los students no reciben recordatorios de coaching."
        elif contact_stage != 4:
            rule_coachee["reason"] = f"Está en Stage {contact_stage}, solo aplica a Stage 4 (Deliver)"
        elif has_meeting_60d:
            rule_coachee["reason"] = "Ya tiene cita en los próximos 60 días"
        elif contact.get("last_contacted_whatsapp") and contact.get("last_contacted_whatsapp") >= eight_days_ago:
            days = diagnosis["days_since_contact"] or 0
            rule_coachee["reason"] = f"Contactado hace {days} días, requiere 8+ días sin contacto"
        else:
            rule_coachee["passed"] = True
            days_info = f", último contacto hace {diagnosis['days_since_contact']} días" if diagnosis["days_since_contact"] else ""
            rule_coachee["reason"] = f"Coachee Stage 4 sin cita en 60 días{days_info} - CUMPLE"
            if not diagnosis["should_receive_message"]:
                diagnosis["should_receive_message"] = True
                diagnosis["matched_rule"] = "coachee_coaching"
        
        diagnosis["rules_checked"].append(rule_coachee)
        
        # ============ RULE 3: Quote Followup ============
        rule_quote = {
            "rule": "quote_followup",
            "rule_name": "Seguimiento de cotización",
            "passed": False,
            "reason": ""
        }
        
        if not has_phone:
            rule_quote["reason"] = "No tiene número de teléfono registrado"
        elif contact.get("stage") != 3:
            rule_quote["reason"] = f"No está en Stage 3 (está en Stage {contact.get('stage', 'sin asignar')})"
        elif not has_quote:
            rule_quote["reason"] = "No tiene cotización registrada"
        elif has_meeting_30d:
            rule_quote["reason"] = "Ya tiene cita en los próximos 30 días"
        elif contact.get("last_contacted_whatsapp") and contact.get("last_contacted_whatsapp") >= nine_days_ago:
            days = diagnosis["days_since_contact"] or 0
            rule_quote["reason"] = f"Contactado hace {days} días, requiere 9+ días sin contacto"
        else:
            rule_quote["passed"] = True
            quote_info = f" (cotización del {quote_date[:10]})" if quote_date else ""
            rule_quote["reason"] = f"Stage 3 con cotización{quote_info}, sin cita en 30 días - CUMPLE"
            if not diagnosis["should_receive_message"]:
                diagnosis["should_receive_message"] = True
                diagnosis["matched_rule"] = "quote_followup"
        
        diagnosis["rules_checked"].append(rule_quote)
        
        # ============ RULE 4: New Business (doesn't apply to contacts) ============
        diagnosis["rules_checked"].append({
            "rule": "new_business",
            "rule_name": "Negocio nuevo",
            "passed": False,
            "reason": "No aplica a contactos, solo a negocios"
        })
        
        # ============ RULE 5: Alumni Check-in (coachees/students Stage 5, cada 90 días) ============
        rule_alumni = {
            "rule": "alumni_checkin",
            "rule_name": "Alumni check-in (Coachee/Student Stage 5)",
            "passed": False,
            "reason": ""
        }
        
        ninety_days_ago = (now - timedelta(days=90)).isoformat()
        contact_is_student = is_student(contact)
        is_alumni = contact_is_coachee or contact_is_student
        
        if not has_phone:
            rule_alumni["reason"] = "No tiene número de teléfono registrado"
        elif not is_alumni:
            rule_alumni["reason"] = f"No tiene rol 'coachee' ni 'student' (roles: {roles or 'ninguno'})"
        elif contact_stage != 5:
            rule_alumni["reason"] = f"Está en Stage {contact_stage}, solo aplica a Stage 5 (Repurchase)"
        elif contact.get("last_contacted_whatsapp") and contact.get("last_contacted_whatsapp") >= ninety_days_ago:
            days = diagnosis["days_since_contact"] or 0
            rule_alumni["reason"] = f"Contactado hace {days} días, requiere 90+ días sin contacto"
        else:
            rule_alumni["passed"] = True
            days_info = f", último contacto hace {diagnosis['days_since_contact']} días" if diagnosis["days_since_contact"] else ""
            rule_alumni["reason"] = f"Alumni Stage 5{days_info} - CUMPLE"
            if not diagnosis["should_receive_message"]:
                diagnosis["should_receive_message"] = True
                diagnosis["matched_rule"] = "alumni_checkin"
        
        diagnosis["rules_checked"].append(rule_alumni)
        
        # Check if contacted today blocks message
        if diagnosis["contacted_today"] and diagnosis["should_receive_message"]:
            diagnosis["should_receive_message"] = False
            diagnosis["matched_rule"] = None
            for rule in diagnosis["rules_checked"]:
                if rule["passed"]:
                    rule["reason"] += " - PERO ya fue contactado hoy"
        
        return {
            "contact": contact_info,
            "has_phone": has_phone,
            "diagnosis": diagnosis
        }


@router.get("/linkedin/diagnose/{contact_id}")
async def diagnose_linkedin_contact_rules(
    contact_id: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Diagnose why a contact does or doesn't qualify for a LinkedIn message.
    LinkedIn rules: Stage 1 or 2, not contacted via LinkedIn in 8+ days.
    """
    now = datetime.now(timezone.utc)
    eight_days_ago = (now - timedelta(days=8)).isoformat()
    
    diagnosis = {
        "should_receive_message": False,
        "matched_rule": None,
        "rules_checked": [],
        "last_contacted_linkedin": None,
        "days_since_contact": None
    }
    
    # Get contact
    contact = await db.unified_contacts.find_one({"id": contact_id}, {"_id": 0})
    if not contact:
        raise HTTPException(status_code=404, detail="Contact not found")
    
    contact_info = {
        "id": contact.get("id"),
        "name": contact.get("name", ""),
        "email": contact.get("email", ""),
        "linkedin_url": contact.get("linkedin_url", ""),
        "stage": contact.get("stage"),
        "buyer_persona": contact.get("buyer_persona"),
        "company": contact.get("company", ""),
        "job_title": contact.get("job_title", ""),
        "last_contacted_linkedin": contact.get("last_contacted_linkedin")
    }
    
    has_linkedin = bool(contact.get("linkedin_url"))
    
    # Calculate days since last contact
    last_contacted = contact.get("last_contacted_linkedin")
    diagnosis["last_contacted_linkedin"] = last_contacted
    if last_contacted:
        try:
            last_contact_date = datetime.fromisoformat(last_contacted.replace("Z", "+00:00"))
            diagnosis["days_since_contact"] = (now - last_contact_date).days
        except:
            pass
    
    # Rule 1: Stage Check
    rule_stage = {
        "rule": "stage_check",
        "rule_name": "Stage 1 o 2 (Prospección/Nurturing)",
        "passed": False,
        "reason": ""
    }
    
    stage = contact.get("stage")
    if stage in [1, 2]:
        rule_stage["passed"] = True
        rule_stage["reason"] = f"Está en Stage {stage} - CUMPLE"
    else:
        rule_stage["reason"] = f"Está en Stage {stage}, solo aplica a Stage 1 y 2"
    
    diagnosis["rules_checked"].append(rule_stage)
    
    # Rule 2: LinkedIn URL
    rule_linkedin = {
        "rule": "has_linkedin",
        "rule_name": "Tiene URL de LinkedIn",
        "passed": False,
        "reason": ""
    }
    
    if has_linkedin:
        rule_linkedin["passed"] = True
        rule_linkedin["reason"] = f"Tiene LinkedIn: {contact.get('linkedin_url')[:50]}..."
    else:
        rule_linkedin["reason"] = "No tiene URL de LinkedIn registrada"
    
    diagnosis["rules_checked"].append(rule_linkedin)
    
    # Rule 3: Not contacted in 8+ days
    rule_cadence = {
        "rule": "cadence_8_days",
        "rule_name": "No contactado en 8+ días",
        "passed": False,
        "reason": ""
    }
    
    if not last_contacted:
        rule_cadence["passed"] = True
        rule_cadence["reason"] = "Nunca contactado por LinkedIn - CUMPLE"
    elif last_contacted < eight_days_ago:
        days = diagnosis["days_since_contact"] or 0
        rule_cadence["passed"] = True
        rule_cadence["reason"] = f"Último contacto hace {days} días (>= 8) - CUMPLE"
    else:
        days = diagnosis["days_since_contact"] or 0
        rule_cadence["reason"] = f"Contactado hace {days} días, requiere 8+ días sin contacto"
    
    diagnosis["rules_checked"].append(rule_cadence)
    
    # Determine final result
    all_passed = all(r["passed"] for r in diagnosis["rules_checked"])
    if all_passed:
        diagnosis["should_receive_message"] = True
        diagnosis["matched_rule"] = "linkedin_outreach"
    
    return {
        "contact": contact_info,
        "has_linkedin": has_linkedin,
        "diagnosis": diagnosis
    }


@router.get("/email/diagnose/{contact_id}")
async def diagnose_email_contact_rules(
    contact_id: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Diagnose why a contact does or doesn't qualify for an email based on E1-E4 rules.
    """
    now = datetime.now(timezone.utc)
    seven_days_ago = (now - timedelta(days=7)).isoformat()
    ninety_days_ago = (now - timedelta(days=90)).isoformat()
    
    diagnosis = {
        "should_receive_message": False,
        "matched_rule": None,
        "rules_checked": [],
        "email_history": {}
    }
    
    # Get contact
    contact = await db.unified_contacts.find_one({"id": contact_id}, {"_id": 0})
    if not contact:
        raise HTTPException(status_code=404, detail="Contact not found")
    
    contact_info = {
        "id": contact.get("id"),
        "name": contact.get("name", ""),
        "email": contact.get("email", ""),
        "stage": contact.get("stage"),
        "buyer_persona": contact.get("buyer_persona"),
        "company": contact.get("company", ""),
        "roles": contact.get("roles", [])
    }
    
    has_email = bool(contact.get("email"))
    email_lower = (contact.get("email") or "").lower()
    stage = contact.get("stage")
    
    # Get calendar data for E3 - use same function as WhatsApp diagnosis
    emails_with_calendar_60d = set()
    try:
        events = await get_calendar_events_for_messages(60)
        for event in events:
            for attendee in event.get('attendees', []):
                if not attendee.get('self'):
                    attendee_email = attendee.get('email', '').lower()
                    if attendee_email:
                        emails_with_calendar_60d.add(attendee_email)
        logger.info(f"Email diagnosis: Found {len(emails_with_calendar_60d)} emails with calendar events in next 60 days")
    except Exception as e:
        logger.warning(f"Calendar error in email diagnose: {e}")
    
    # Webinar registrations for E1
    from routers.email_individual import get_all_future_webinar_registered_emails, get_upcoming_webinars
    try:
        registered_emails = await get_all_future_webinar_registered_emails()
        upcoming_webinars = await get_upcoming_webinars()
    except:
        registered_emails = set()
        upcoming_webinars = []
    
    # Quote data for E2
    quotes = await db.quotes.find(
        {"status": {"$ne": "cancelled"}},
        {"_id": 0, "client_email": 1}
    ).to_list(500)
    quote_emails = {q.get("client_email", "").lower() for q in quotes if q.get("client_email")}
    
    # Track email history
    diagnosis["email_history"] = {
        "E1": contact.get("last_email_e1_sent"),
        "E2": contact.get("last_email_e2_sent"),
        "E3": contact.get("last_email_e3_sent"),
        "E4": contact.get("last_email_e4_sent"),
        "E5": contact.get("last_email_e5_sent")
    }
    
    # ========= E1: Webinar Invitation (Stage 2) =========
    rule_e1 = {
        "rule": "E1",
        "rule_name": "E1 - Invitación a Webinar (Stage 2)",
        "passed": False,
        "reason": ""
    }
    
    if not has_email:
        rule_e1["reason"] = "No tiene email registrado"
    elif stage != 2:
        rule_e1["reason"] = f"Está en Stage {stage}, solo aplica a Stage 2"
    elif email_lower in registered_emails:
        rule_e1["reason"] = "Ya está registrado a un webinar próximo"
    elif not upcoming_webinars:
        rule_e1["reason"] = "No hay webinars programados"
    elif contact.get("last_email_e1_sent") and contact.get("last_email_e1_sent") >= seven_days_ago:
        rule_e1["reason"] = "Ya se envió E1 en los últimos 7 días"
    else:
        rule_e1["passed"] = True
        rule_e1["reason"] = "Stage 2, no registrado a webinar, cadencia OK - CUMPLE"
        if not diagnosis["should_receive_message"]:
            diagnosis["should_receive_message"] = True
            diagnosis["matched_rule"] = "E1"
    
    diagnosis["rules_checked"].append(rule_e1)
    
    # ========= E2: Quote Follow-up (Stage 3) =========
    rule_e2 = {
        "rule": "E2",
        "rule_name": "E2 - Seguimiento de Cotización (Stage 3)",
        "passed": False,
        "reason": ""
    }
    
    if not has_email:
        rule_e2["reason"] = "No tiene email registrado"
    elif stage != 3:
        rule_e2["reason"] = f"Está en Stage {stage}, solo aplica a Stage 3"
    elif email_lower not in quote_emails:
        rule_e2["reason"] = "No tiene cotización registrada"
    elif contact.get("last_email_e2_sent") and contact.get("last_email_e2_sent") >= seven_days_ago:
        rule_e2["reason"] = "Ya se envió E2 en los últimos 7 días"
    else:
        rule_e2["passed"] = True
        rule_e2["reason"] = "Stage 3, tiene cotización, cadencia OK - CUMPLE"
        if not diagnosis["should_receive_message"]:
            diagnosis["should_receive_message"] = True
            diagnosis["matched_rule"] = "E2"
    
    diagnosis["rules_checked"].append(rule_e2)
    
    # ========= E3: Coaching Reminder (Stage 4, rol estudiante) =========
    rule_e3 = {
        "rule": "E3",
        "rule_name": "E3 - Recordatorio de Coaching (Stage 4, Estudiante)",
        "passed": False,
        "reason": ""
    }
    
    # Use centralized helper for student check
    contact_is_student = is_student(contact)
    roles = contact.get("roles", []) or []
    has_calendar_appointment = email_lower in emails_with_calendar_60d
    
    # Add debug info to diagnosis
    diagnosis["debug_calendar"] = {
        "email_checked": email_lower,
        "has_appointment": has_calendar_appointment,
        "total_calendar_emails": len(emails_with_calendar_60d)
    }
    
    if not has_email:
        rule_e3["reason"] = "No tiene email registrado"
    elif stage != 4:
        rule_e3["reason"] = f"Está en Stage {stage}, solo aplica a Stage 4"
    elif not contact_is_student:
        rule_e3["reason"] = f"No tiene rol estudiante (roles: {roles})"
    elif has_calendar_appointment:
        rule_e3["reason"] = "Ya tiene cita programada en los próximos 60 días"
    elif contact.get("last_email_e3_sent") and contact.get("last_email_e3_sent") >= seven_days_ago:
        rule_e3["reason"] = "Ya se envió E3 en los últimos 7 días"
    else:
        rule_e3["passed"] = True
        rule_e3["reason"] = "Stage 4, estudiante, sin cita, cadencia OK - CUMPLE"
        if not diagnosis["should_receive_message"]:
            diagnosis["should_receive_message"] = True
            diagnosis["matched_rule"] = "E3"
    
    diagnosis["rules_checked"].append(rule_e3)
    
    # ========= E4: Repurchase (Stage 5, NO estudiantes, 90+ days) =========
    rule_e4 = {
        "rule": "E4",
        "rule_name": "E4 - Recompra (Stage 5, NO estudiante, 90+ días)",
        "passed": False,
        "reason": ""
    }
    
    if not has_email:
        rule_e4["reason"] = "No tiene email registrado"
    elif stage != 5:
        rule_e4["reason"] = f"Está en Stage {stage}, solo aplica a Stage 5"
    elif contact_is_student:
        rule_e4["reason"] = "Es estudiante - aplica E5 (Alumni check-in) en vez de E4"
    elif contact.get("last_email_e4_sent") and contact.get("last_email_e4_sent") >= ninety_days_ago:
        rule_e4["reason"] = "Ya se envió E4 en los últimos 90 días"
    else:
        rule_e4["passed"] = True
        rule_e4["reason"] = "Stage 5, NO estudiante, cadencia 90 días OK - CUMPLE"
        if not diagnosis["should_receive_message"]:
            diagnosis["should_receive_message"] = True
            diagnosis["matched_rule"] = "E4"
    
    diagnosis["rules_checked"].append(rule_e4)
    
    # ========= E5: Alumni Check-in (Stage 5, estudiantes, 90+ days) =========
    rule_e5 = {
        "rule": "E5",
        "rule_name": "E5 - Alumni Check-in (Stage 5, Estudiante, 90+ días)",
        "passed": False,
        "reason": ""
    }
    
    if not has_email:
        rule_e5["reason"] = "No tiene email registrado"
    elif stage != 5:
        rule_e5["reason"] = f"Está en Stage {stage}, solo aplica a Stage 5"
    elif not contact_is_student:
        rule_e5["reason"] = f"No es estudiante (roles: {roles}) - aplica E4 (Recompra) en vez de E5"
    elif contact.get("last_email_e5_sent") and contact.get("last_email_e5_sent") >= ninety_days_ago:
        rule_e5["reason"] = "Ya se envió E5 en los últimos 90 días"
    else:
        rule_e5["passed"] = True
        rule_e5["reason"] = "Stage 5, estudiante (alumni), cadencia 90 días OK - CUMPLE"
        if not diagnosis["should_receive_message"]:
            diagnosis["should_receive_message"] = True
            diagnosis["matched_rule"] = "E5"
    
    diagnosis["rules_checked"].append(rule_e5)
    
    return {
        "contact": contact_info,
        "has_email": has_email,
        "diagnosis": diagnosis
    }




@router.get("/debug/calendar-events")
async def debug_calendar_events(
    current_user: dict = Depends(get_current_user)
):
    """Debug endpoint to see raw calendar events"""
    settings = await get_settings()
    
    if not settings.get("calendar_connected"):
        return {"error": "Calendar not connected", "events": []}
    
    calendar_credentials = settings.get("calendar_credentials", {})
    if not calendar_credentials:
        return {"error": "No calendar credentials", "events": []}
    
    try:
        calendar_credentials = refresh_credentials_if_needed(calendar_credentials)
        
        credentials = Credentials(
            token=calendar_credentials.get("token"),
            refresh_token=calendar_credentials.get("refresh_token"),
            token_uri=calendar_credentials.get("token_uri", "https://oauth2.googleapis.com/token"),
            client_id=calendar_credentials.get("client_id", GOOGLE_CLIENT_ID),
            client_secret=calendar_credentials.get("client_secret", GOOGLE_CLIENT_SECRET),
            scopes=calendar_credentials.get("scopes", CALENDAR_SCOPES)
        )
        
        service = build('calendar', 'v3', credentials=credentials)
        
        now = datetime.now(timezone.utc)
        time_min = now.isoformat()
        time_max = (now + timedelta(days=7)).isoformat()
        
        events_result = service.events().list(
            calendarId='primary',
            timeMin=time_min,
            timeMax=time_max,
            singleEvents=True,
            orderBy='startTime',
            showDeleted=False
        ).execute()
        
        events = events_result.get('items', [])
        
        # Return detailed info about each event
        event_details = []
        for event in events:
            event_details.append({
                "id": event.get("id"),
                "summary": event.get("summary", "Sin título"),
                "status": event.get("status"),
                "start": event.get("start"),
                "end": event.get("end"),
                "recurrence": event.get("recurrence"),
                "recurringEventId": event.get("recurringEventId"),
                "attendees": [
                    {
                        "email": a.get("email"),
                        "displayName": a.get("displayName"),
                        "responseStatus": a.get("responseStatus")
                    }
                    for a in event.get("attendees", [])
                ],
                "organizer": event.get("organizer"),
                "creator": event.get("creator"),
                "visibility": event.get("visibility"),
                "transparency": event.get("transparency")
            })
        
        return {
            "total_events": len(events),
            "time_range": {"from": time_min, "to": time_max},
            "events": event_details
        }
        
    except Exception as e:
        logger.error(f"Error in debug calendar: {e}")
        return {"error": str(e), "events": []}
