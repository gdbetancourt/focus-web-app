"""
Email Individual Router (E1-E10)
Implements transactional email rules with Gemini generation and Amazon SES sending.

Rules:
- E1: Webinar invitation (Stage 1-2) - contacts not registered to any future webinar
- E2: Quote follow-up (Stage 3) - contacts with sent quote AND past calendar event
- E3: Coaching reminder (Stage 4) - Coachees without calendar event in 60 days
- E4: Repurchase (Stage 5) - Deal Makers, every 3 months
- E5: Alumni check-in (Stage 5) - Coachees, every 3 months
- E6: Pre-registration confirmation - contacts imported to webinar in last week
- E7-E10: Webinar reminders (time-based)

Features:
- Gemini generates email (subject + body) at send time
- Amazon SES for sending (replaces Gmail API)
- Email queue with rate limiting
- Track last_email_sent per type per contact
- Cadence: E1-E3 weekly, E4-E5 every 3 months
"""
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timezone, timedelta
import uuid
import os
import logging

from database import db
from utils.contact_helpers import (
    STUDENT_ROLES_QUERY, 
    build_cadence_query, CADENCE_PERIODS
)
from routers.auth import get_current_user
from services.email_service import email_service
from services.email_queue import email_queue

# Gemini integration
from emergentintegrations.llm.chat import LlmChat, UserMessage

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/email-individual", tags=["email-individual"])


# ============ MODELS ============

class EmailContact(BaseModel):
    contact_id: str
    name: str
    email: str
    company: Optional[str] = None
    buyer_persona: Optional[str] = None
    stage: int
    rule_type: str  # E1, E2, E3, E4
    rule_description: str
    webinar_name: Optional[str] = None  # For E1
    webinar_date: Optional[str] = None  # For E1
    webinar_link: Optional[str] = None  # For E1
    last_email_sent: Optional[str] = None


class GenerateEmailRequest(BaseModel):
    contact_id: str
    rule_type: str
    webinar_name: Optional[str] = None
    webinar_date: Optional[str] = None
    webinar_link: Optional[str] = None


class GeneratedEmail(BaseModel):
    subject: str
    body: str
    contact_id: str
    rule_type: str


class SendEmailRequest(BaseModel):
    contact_id: str
    rule_type: str
    subject: str
    body: str


# ============ AMAZON SES HELPERS ============

# Fixed sender identity for all E1-E10 emails
SENDER_EMAIL = os.environ.get("SENDER_EMAIL", "contact@leaderlix.com")
SENDER_NAME = os.environ.get("SENDER_NAME", "María Gargari")
SENDER_NAME = os.environ.get("SENDER_NAME", "María Gargari")


async def send_email_ses(to_email: str, subject: str, body: str, email_id: str = None, tracking_url: str = None) -> dict:
    """Send email using Amazon SES with optional tracking pixel.
    
    IMPORTANT: All emails are sent from configured SENDER_EMAIL
    """
    import re
    
    try:
        # Plain text version
        plain_text = body.replace('<br>', '\n').replace('<p>', '\n').replace('</p>', '\n')
        plain_text = re.sub('<[^<]+?>', '', plain_text)
        
        # Build tracking pixel if email_id provided
        tracking_pixel = ""
        if email_id and tracking_url:
            tracking_pixel = f'<img src="{tracking_url}/api/email-individual/track/open/{email_id}" width="1" height="1" style="display:none" alt="" />'
        
        # HTML version with Leaderlix branding
        html_body = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <style>
                body {{ font-family: 'Segoe UI', Arial, sans-serif; line-height: 1.6; color: #333; }}
                .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
                .signature {{ margin-top: 20px; padding-top: 20px; border-top: 1px solid #eee; color: #666; font-size: 14px; }}
            </style>
        </head>
        <body>
            <div class="container">
                {body.replace(chr(10), '<br>')}
                <div class="signature">
                    <p>{SENDER_NAME}</p>
                    <p>Equipo Leaderlix</p>
                    <p style="font-size: 12px; color: #999;">
                        <a href="https://leaderlix.com" style="color: #ff3300;">leaderlix.com</a>
                    </p>
                </div>
            </div>
            {tracking_pixel}
        </body>
        </html>
        """
        
        # Send using Amazon SES
        result = await email_service.send_email(
            to_email=to_email,
            subject=subject,
            html_content=html_body,
            plain_content=plain_text,
            from_email=SENDER_EMAIL,
            from_name=SENDER_NAME
        )
        
        if result.get("success"):
            logger.info(f"Email sent via SES from {SENDER_EMAIL} to {to_email}")
            return {
                "success": True,
                "message_id": result.get("message_id"),
                "sent_from": SENDER_EMAIL
            }
        else:
            logger.error(f"SES Error: {result.get('error')}")
            return {
                "success": False,
                "error": result.get("error")
            }
        
    except Exception as e:
        logger.error(f"Error sending email via SES: {e}")
        return {
            "success": False,
            "error": str(e)
        }


# Alias for backwards compatibility
send_gmail = send_email_ses


# ============ GEMINI EMAIL GENERATION ============

async def generate_email_with_gemini(
    rule_type: str,
    contact_name: str,
    contact_company: Optional[str] = None,
    webinar_name: Optional[str] = None,
    webinar_date: Optional[str] = None,
    webinar_link: Optional[str] = None,
    last_email_content: Optional[str] = None
) -> dict:
    """Generate email subject and body using Gemini"""
    
    api_key = os.environ.get("EMERGENT_LLM_KEY")
    if not api_key:
        return get_fallback_email(rule_type, contact_name, contact_company, webinar_name, webinar_date, webinar_link)
    
    # Base prompt requirements
    base_requirements = """
IMPORTANT REQUIREMENTS:
- Write in Spanish
- Tone: cordial, transactional, short - NOT persuasive or salesy
- Use "tú" (informal) not "usted"
- Maximum 4-5 short sentences
- Be direct and helpful
- Generate a NEW variant each time (different structure, phrases)
- Sign: "Equipo Leaderlix"
"""

    # Specific prompts by rule type
    prompts = {
        "E1": f"""Generate a short email to invite {contact_name} to a webinar.
{base_requirements}

Webinar details:
- Event: {webinar_name}
- Date: {webinar_date}
- Registration link: {webinar_link}

Content should:
- Briefly mention the event topic
- Include minimal event info
- Include registration link
- Be friendly but not pushy
""",
        "E2": f"""Generate a short follow-up email for {contact_name} about their quote.
{base_requirements}

Company: {contact_company or 'their company'}

Content should:
- Follow up on a previously sent quote
- Ask if they received it / have questions
- Offer to clarify next steps
- Be helpful, not aggressive
""",
        "E3": f"""Generate a short reminder email for {contact_name} to schedule coaching.
{base_requirements}

Content should:
- Remind them to schedule their next coaching session
- Include link: leaderlix.com/coaching
- Be motivating but brief
- Express availability to help
""",
        "E4": f"""Generate a short repurchase email for {contact_name}.
{base_requirements}

Content should:
- Remind them about communication training availability
- Mention possibility of referrals
- Be very brief and cordial
- No aggressive sales tactics
"""
    }
    
    prompt = prompts.get(rule_type, prompts["E1"])
    
    # Add instruction to vary from previous email if exists
    if last_email_content:
        prompt += f"""

IMPORTANT: The previous email sent to this contact was:
---
{last_email_content[:500]}
---
Make sure your new email has DIFFERENT structure, phrasing, and opening. Do NOT repeat similar sentences.
"""
    
    try:
        chat = LlmChat(
            api_key=api_key,
            session_id=f"email-gen-{uuid.uuid4()}",
            system_message="You are an expert email writer creating short, cordial, transactional emails in Spanish. Each email must be unique and different from previous ones."
        ).with_model("gemini", "gemini-2.5-flash")
        
        user_message = UserMessage(text=f"""{prompt}

Return ONLY a JSON object with this exact format:
{{"subject": "...", "body": "..."}}

No markdown, no code blocks, just the JSON.""")
        
        response = await chat.send_message(user_message)
        
        # Parse JSON response
        import json
        # Clean response
        response = response.strip()
        if response.startswith("```"):
            response = response.split("```")[1]
            if response.startswith("json"):
                response = response[4:]
        response = response.strip()
        
        try:
            email_data = json.loads(response)
            return {
                "subject": email_data.get("subject", ""),
                "body": email_data.get("body", "")
            }
        except json.JSONDecodeError:
            logger.error(f"Failed to parse Gemini response: {response}")
            return get_fallback_email(rule_type, contact_name, contact_company, webinar_name, webinar_date, webinar_link)
        
    except Exception as e:
        logger.error(f"Error generating email with Gemini: {e}")
        return get_fallback_email(rule_type, contact_name, contact_company, webinar_name, webinar_date, webinar_link)


def get_fallback_email(
    rule_type: str,
    contact_name: str,
    company: Optional[str],
    webinar_name: Optional[str],
    webinar_date: Optional[str],
    webinar_link: Optional[str]
) -> dict:
    """Fallback emails when Gemini is not available"""
    first_name = contact_name.split()[0] if contact_name else "amigo"
    
    templates = {
        "E1": {
            "subject": f"Te invitamos al webinar: {webinar_name or 'próximo evento'}",
            "body": f"""Hola {first_name},

Te escribo para invitarte a nuestro próximo webinar "{webinar_name or 'evento'}".

Fecha: {webinar_date or 'próximamente'}
Regístrate aquí: {webinar_link or 'leaderlix.com'}

¡Esperamos verte ahí!"""
        },
        "E2": {
            "subject": "Seguimiento a tu cotización",
            "body": f"""Hola {first_name},

Espero que te encuentres bien. Te escribo para dar seguimiento a la cotización que enviamos para {company or 'tu empresa'}.

¿Tuviste oportunidad de revisarla? Estoy a tus órdenes para cualquier duda o aclaración.

¡Quedo pendiente!"""
        },
        "E3": {
            "subject": "¿Ya agendaste tu sesión de coaching?",
            "body": f"""Hola {first_name},

Te escribo para recordarte que tienes disponibles tus sesiones de coaching.

Puedes agendar tu próxima sesión aquí: leaderlix.com/coaching

¡Te esperamos!"""
        },
        "E4": {
            "subject": "Seguimos a tus órdenes",
            "body": f"""Hola {first_name},

Espero que todo marche bien. Quería recordarte que seguimos disponibles para entrenamientos de comunicación.

Si conoces a alguien que pueda beneficiarse de nuestros programas, ¡no dudes en recomendarnos!

Un abrazo."""
        }
    }
    
    return templates.get(rule_type, templates["E1"])


# ============ CONTACT FETCHING HELPERS ============

async def get_calendar_emails_next_n_days(days: int) -> set:
    """Get emails of contacts with calendar events in next N days"""
    settings = await get_settings()
    
    if not settings.get("calendar_connected"):
        return set()
    
    calendar_credentials = settings.get("calendar_credentials", {})
    if not calendar_credentials:
        return set()
    
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
        
        emails = set()
        for event in events_result.get('items', []):
            for attendee in event.get('attendees', []):
                email = attendee.get('email', '').lower()
                if email:
                    emails.add(email)
        
        return emails
        
    except Exception as e:
        logger.error(f"Error fetching calendar events: {e}")
        return set()


async def get_upcoming_webinars() -> list:
    """Get upcoming webinars for E1 invitations"""
    today = datetime.now().strftime("%Y-%m-%d")
    
    # Check both event collections
    events_v2 = await db.webinar_events_v2.find(
        {"webinar_date": {"$gte": today}, "status": {"$in": ["active", "published"]}},
        {"_id": 0, "id": 1, "name": 1, "webinar_date": 1, "slug": 1, "buyer_personas": 1}
    ).sort("webinar_date", 1).to_list(10)
    
    events_v1 = await db.webinar_events.find(
        {"date": {"$gte": today}},
        {"_id": 0, "id": 1, "name": 1, "date": 1, "url": 1, "buyer_personas": 1}
    ).sort("date", 1).to_list(10)
    
    # Normalize format
    webinars = []
    for e in events_v2:
        webinars.append({
            "id": e.get("id"),
            "name": e.get("name"),
            "date": e.get("webinar_date"),
            "link": f"https://leaderlix.com/evento/{e.get('slug')}",
            "buyer_personas": e.get("buyer_personas", [])
        })
    
    for e in events_v1:
        webinars.append({
            "id": e.get("id"),
            "name": e.get("name"),
            "date": e.get("date"),
            "link": e.get("url", "https://leaderlix.com"),
            "buyer_personas": e.get("buyer_personas", [])
        })
    
    # Sort by date
    webinars.sort(key=lambda x: x.get("date", ""))
    return webinars


async def get_registered_contact_emails_for_webinar(webinar_id: str) -> set:
    """Get emails of contacts already registered for a webinar"""
    # Check event registrants
    event = await db.webinar_events_v2.find_one({"id": webinar_id})
    if event:
        return {r.get("email", "").lower() for r in event.get("registrants", [])}
    
    # Check v1 events
    event = await db.webinar_events.find_one({"id": webinar_id})
    if event:
        return {r.get("email", "").lower() for r in event.get("registrants", [])}
    
    return set()


async def get_all_future_webinar_registered_emails() -> set:
    """Get all emails registered to any future webinar"""
    today = datetime.now().strftime("%Y-%m-%d")
    registered_emails = set()
    
    # From events_v2
    events = await db.webinar_events_v2.find(
        {"webinar_date": {"$gte": today}},
        {"registrants": 1}
    ).to_list(100)
    
    for event in events:
        for r in event.get("registrants", []):
            email = r.get("email", "").lower()
            if email:
                registered_emails.add(email)
    
    # From contacts with events array
    contacts_with_events = await db.unified_contacts.find(
        {"events": {"$exists": True, "$ne": []}},
        {"email": 1, "events": 1}
    ).to_list(10000)
    
    for contact in contacts_with_events:
        email = contact.get("email", "").lower()
        events = contact.get("events", [])
        for e in events:
            if e.get("registered") and e.get("date", "") >= today:
                registered_emails.add(email)
                break
    
    return registered_emails


# ============ ENDPOINTS ============

@router.get("/contacts")
async def get_email_contacts(
    current_user: dict = Depends(get_current_user),
    debug: bool = False
):
    """
    Get all contacts that need an email based on E1-E4 rules.
    Returns contacts grouped by rule type.
    
    Query params:
    - debug: If true, return detailed diagnostics about filtering
    """
    now = datetime.now(timezone.utc)
    today = now.strftime("%Y-%m-%d")
    
    # Cadence thresholds are now managed by contact_helpers.CADENCE_PERIODS
    
    all_contacts = []
    
    # Diagnostics object for debugging
    diagnostics = {
        "timestamp": now.isoformat(),
        "cadence_periods": CADENCE_PERIODS,
        "pool_sizes": {},
        "filtering_details": {},
        "exclusion_reasons": []
    }
    
    # Get calendar data for E3
    try:
        emails_with_calendar_60d = await get_calendar_emails_next_n_days(60)
        diagnostics["calendar_emails_60d"] = len(emails_with_calendar_60d)
    except Exception as e:
        emails_with_calendar_60d = set()
        diagnostics["calendar_error"] = str(e)
    
    # Get webinar data for E1
    upcoming_webinars = await get_upcoming_webinars()
    registered_emails = await get_all_future_webinar_registered_emails()
    diagnostics["upcoming_webinars"] = len(upcoming_webinars)
    diagnostics["registered_to_webinars"] = len(registered_emails)
    
    # ============ E1: Webinar Invitation (Stage 1-2) ============
    # Target: Stage 1-2 contacts NOT registered to any future webinar
    e1_cadence_query = build_cadence_query("last_email_e1_sent", CADENCE_PERIODS["email_e1"])
    stage1_2_contacts = await db.unified_contacts.find(
        {
            "stage": {"$in": [1, 2]},
            "email": {"$exists": True, "$ne": ""},
            **e1_cadence_query
        },
        {"_id": 0}
    ).to_list(500)
    
    diagnostics["pool_sizes"]["E1_stage1_2_initial"] = len(stage1_2_contacts)
    e1_excluded = {"no_email": 0, "already_registered": 0, "no_webinar": 0}
    
    for contact in stage1_2_contacts:
        email = (contact.get("email") or "").lower()
        if not email:
            e1_excluded["no_email"] += 1
            continue
        if email in registered_emails:
            e1_excluded["already_registered"] += 1
            if debug and len(diagnostics.get("exclusion_reasons", [])) < 10:
                diagnostics["exclusion_reasons"].append({
                    "rule": "E1", "email": email, "reason": "ALREADY_REGISTERED"
                })
            continue
        
        # Find appropriate webinar based on buyer persona
        buyer_persona = contact.get("buyer_persona", "mateo")
        best_webinar = None
        
        for webinar in upcoming_webinars:
            wp_personas = webinar.get("buyer_personas", [])
            if not wp_personas or buyer_persona in wp_personas:
                best_webinar = webinar
                break
        
        if not best_webinar and upcoming_webinars:
            best_webinar = upcoming_webinars[0]  # Default to nearest
        
        if not best_webinar:
            e1_excluded["no_webinar"] += 1
            continue
        
        all_contacts.append({
            "contact_id": contact.get("id"),
            "name": contact.get("name", ""),
            "email": email,
            "company": contact.get("company"),
            "buyer_persona": buyer_persona,
            "stage": contact.get("stage", 2),
            "rule_type": "E1",
            "rule_description": "Webinar invitation (not registered)",
            "webinar_name": best_webinar.get("name"),
            "webinar_date": best_webinar.get("date"),
            "webinar_link": best_webinar.get("link"),
            "last_email_sent": contact.get("last_email_e1_sent")
        })
    
    diagnostics["filtering_details"]["E1"] = e1_excluded
    
    # ============ E2: Quote Follow-up (Stage 3) ============
    # Target: Stage 3 contacts with a quote sent AND a past calendar event after quote
    quotes = await db.quotes.find(
        {"status": {"$ne": "cancelled"}},
        {"_id": 0, "client_email": 1, "created_at": 1}
    ).to_list(500)
    # Build map of email -> latest quote date
    quote_data = {}
    for q in quotes:
        email = (q.get("client_email") or "").lower()
        if email:
            created = q.get("created_at", "")
            if email not in quote_data or created > quote_data[email]:
                quote_data[email] = created
    quote_emails = set(quote_data.keys())
    diagnostics["pool_sizes"]["E2_quotes_count"] = len(quote_emails)
    
    e2_cadence_query = build_cadence_query("last_email_e2_sent", CADENCE_PERIODS["email_e2"])
    stage3_contacts = await db.unified_contacts.find(
        {
            "stage": 3,
            "email": {"$exists": True, "$ne": ""},
            **e2_cadence_query
        },
        {"_id": 0}
    ).to_list(500)
    
    diagnostics["pool_sizes"]["E2_stage3_initial"] = len(stage3_contacts)
    e2_excluded = {"no_email": 0, "no_quote": 0, "no_past_event": 0}
    
    # Get calendar events for checking
    now = datetime.now(timezone.utc)
    calendar_events = await db.calendar_events.find(
        {"event_date": {"$lt": now.isoformat()}},
        {"_id": 0, "attendees": 1, "event_date": 1}
    ).to_list(10000)
    
    # Build map of email -> list of event dates
    email_event_dates = {}
    for event in calendar_events:
        event_date = event.get("event_date", "")
        for attendee in event.get("attendees", []):
            attendee_email = attendee.lower() if isinstance(attendee, str) else ""
            if attendee_email:
                if attendee_email not in email_event_dates:
                    email_event_dates[attendee_email] = []
                email_event_dates[attendee_email].append(event_date)
    
    for contact in stage3_contacts:
        email = (contact.get("email") or "").lower()
        if not email:
            e2_excluded["no_email"] += 1
            continue
        if email not in quote_emails:
            e2_excluded["no_quote"] += 1
            if debug and len(diagnostics.get("exclusion_reasons", [])) < 10:
                diagnostics["exclusion_reasons"].append({
                    "rule": "E2", "email": email, "reason": "NO_QUOTE_FOUND"
                })
            continue
        
        # Check if contact has a past calendar event AFTER the quote was sent
        quote_date = quote_data.get(email, "")
        contact_events = email_event_dates.get(email, [])
        has_past_event_after_quote = any(
            event_date > quote_date and event_date < now.isoformat()
            for event_date in contact_events
        )
        
        if not has_past_event_after_quote:
            e2_excluded["no_past_event"] += 1
            if debug and len(diagnostics.get("exclusion_reasons", [])) < 10:
                diagnostics["exclusion_reasons"].append({
                    "rule": "E2", "email": email, "reason": "NO_PAST_EVENT_AFTER_QUOTE"
                })
            continue
        
        all_contacts.append({
            "contact_id": contact.get("id"),
            "name": contact.get("name", ""),
            "email": email,
            "company": contact.get("company"),
            "buyer_persona": contact.get("buyer_persona"),
            "stage": 3,
            "rule_type": "E2",
            "rule_description": "Quote follow-up",
            "webinar_name": None,
            "webinar_date": None,
            "webinar_link": None,
            "last_email_sent": contact.get("last_email_e2_sent")
        })
    
    diagnostics["filtering_details"]["E2"] = e2_excluded
    
    # ============ E3: Coaching Reminder (Stage 4 Coachees) ============
    # Target: Stage 4 with role "coachee", no calendar event in 60 days
    COACHEE_ROLES_QUERY = {"$in": ["coachee", "Coachee", "COACHEE"]}
    
    stage4_coachees = await db.unified_contacts.find(
        {
            "stage": 4,
            "roles": COACHEE_ROLES_QUERY,
            "email": {"$exists": True, "$ne": ""},
            **build_cadence_query("last_email_e3_sent", CADENCE_PERIODS["email_e3"])
        },
        {"_id": 0}
    ).to_list(500)
    
    diagnostics["pool_sizes"]["E3_stage4_coachees_initial"] = len(stage4_coachees)
    e3_excluded = {"no_email": 0, "has_calendar_event": 0}
    
    for contact in stage4_coachees:
        email = (contact.get("email") or "").lower()
        if not email:
            e3_excluded["no_email"] += 1
            continue
        
        # Skip if they have a calendar event in next 60 days
        if email in emails_with_calendar_60d:
            e3_excluded["has_calendar_event"] += 1
            if debug and len(diagnostics.get("exclusion_reasons", [])) < 10:
                diagnostics["exclusion_reasons"].append({
                    "rule": "E3", "email": email, "reason": "HAS_CAL_EVENT_60D"
                })
            continue
        
        all_contacts.append({
            "contact_id": contact.get("id"),
            "name": contact.get("name", ""),
            "email": email,
            "company": contact.get("company"),
            "buyer_persona": contact.get("buyer_persona"),
            "stage": 4,
            "rule_type": "E3",
            "rule_description": "Coaching reminder (coachee, no appointment)",
            "webinar_name": None,
            "webinar_date": None,
            "webinar_link": "https://leaderlix.com/coaching",
            "last_email_sent": contact.get("last_email_e3_sent")
        })
    
    diagnostics["filtering_details"]["E3"] = e3_excluded
    
    # ============ E4: Repurchase (Stage 5, Deal Makers) ============
    # Target: Stage 5 contacts who are Deal Makers, every 3 months
    DEAL_MAKER_ROLES_QUERY = {"$in": ["deal_maker", "Deal Maker", "dealmaker", "DealMaker", "DEAL_MAKER"]}
    
    e4_cadence_query = build_cadence_query("last_email_e4_sent", CADENCE_PERIODS["email_e4"])
    stage5_deal_makers = await db.unified_contacts.find(
        {
            "stage": 5,
            "email": {"$exists": True, "$ne": ""},
            "roles": DEAL_MAKER_ROLES_QUERY,
            **e4_cadence_query
        },
        {"_id": 0}
    ).to_list(500)
    
    diagnostics["pool_sizes"]["E4_stage5_deal_makers_initial"] = len(stage5_deal_makers)
    e4_excluded = {"no_email": 0}
    
    for contact in stage5_deal_makers:
        email = (contact.get("email") or "").lower()
        if not email:
            e4_excluded["no_email"] += 1
            continue
        
        all_contacts.append({
            "contact_id": contact.get("id"),
            "name": contact.get("name", ""),
            "email": email,
            "company": contact.get("company"),
            "buyer_persona": contact.get("buyer_persona", "mateo"),
            "stage": 5,
            "rule_type": "E4",
            "rule_description": "Repurchase reminder (3 months)",
            "webinar_name": None,
            "webinar_date": None,
            "webinar_link": None,
            "last_email_sent": contact.get("last_email_e4_sent")
        })
    
    diagnostics["filtering_details"]["E4"] = e4_excluded
    
    # ============ E5: Alumni Check-in (Stage 5, Coachees) ============
    # Target: Stage 5 coachees (alumni), every 3 months
    e5_cadence_query = build_cadence_query("last_email_e5_sent", CADENCE_PERIODS["email_e5"])
    stage5_coachees = await db.unified_contacts.find(
        {
            "stage": 5,
            "email": {"$exists": True, "$ne": ""},
            "roles": COACHEE_ROLES_QUERY,  # Only coachees
            **e5_cadence_query
        },
        {"_id": 0}
    ).to_list(500)
    
    diagnostics["pool_sizes"]["E5_stage5_coachees_initial"] = len(stage5_coachees)
    e5_excluded = {"no_email": 0}
    
    for contact in stage5_coachees:
        email = (contact.get("email") or "").lower()
        if not email:
            e5_excluded["no_email"] += 1
            continue
        
        all_contacts.append({
            "contact_id": contact.get("id"),
            "name": contact.get("name", ""),
            "email": email,
            "company": contact.get("company"),
            "buyer_persona": contact.get("buyer_persona", "mateo"),
            "stage": 5,
            "rule_type": "E5",
            "rule_description": "Alumni check-in (3 months)",
            "webinar_name": None,
            "webinar_date": None,
            "webinar_link": None,
            "last_email_sent": contact.get("last_email_e5_sent")
        })
    
    diagnostics["filtering_details"]["E5"] = e5_excluded
    
    # Group by rule type for summary
    summary = {
        "E1": len([c for c in all_contacts if c["rule_type"] == "E1"]),
        "E2": len([c for c in all_contacts if c["rule_type"] == "E2"]),
        "E3": len([c for c in all_contacts if c["rule_type"] == "E3"]),
        "E4": len([c for c in all_contacts if c["rule_type"] == "E4"]),
        "E5": len([c for c in all_contacts if c["rule_type"] == "E5"]),
    }
    
    response = {
        "contacts": all_contacts,
        "count": len(all_contacts),
        "summary": summary,
        "rules": {
            "E1": "Webinar invitation (Stage 1-2, not registered) - Weekly",
            "E2": "Quote follow-up (Stage 3, has quote + past event) - Weekly",
            "E3": "Coaching reminder (Stage 4 coachees, no appointment 60d) - Weekly",
            "E4": "Repurchase (Stage 5, Deal Makers) - Every 3 months",
            "E5": "Alumni check-in (Stage 5, coachees) - Every 3 months"
        }
    }
    
    # Include diagnostics if debug mode enabled
    if debug:
        response["diagnostics"] = diagnostics
        logger.info(f"Email contacts diagnostics: {diagnostics}")
    
    return response


@router.post("/generate")
async def generate_email(
    data: GenerateEmailRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Generate email subject and body using Gemini.
    Returns generated content for preview/editing.
    """
    # Get contact info
    contact = await db.unified_contacts.find_one({"id": data.contact_id}, {"_id": 0})
    if not contact:
        raise HTTPException(status_code=404, detail="Contact not found")
    
    # Get last email sent of this type
    last_email_field = f"last_email_{data.rule_type.lower()}_content"
    last_email_content = contact.get(last_email_field)
    
    # Generate email
    email = await generate_email_with_gemini(
        rule_type=data.rule_type,
        contact_name=contact.get("name", ""),
        contact_company=contact.get("company"),
        webinar_name=data.webinar_name,
        webinar_date=data.webinar_date,
        webinar_link=data.webinar_link,
        last_email_content=last_email_content
    )
    
    return {
        "success": True,
        "contact_id": data.contact_id,
        "rule_type": data.rule_type,
        "subject": email.get("subject", ""),
        "body": email.get("body", "")
    }


@router.post("/send")
async def send_email(
    data: SendEmailRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Send email via Gmail API after preview/edit.
    Updates last_email_sent timestamp for the contact.
    Includes tracking pixel for open rate measurement.
    """
    import os
    
    # Get contact info
    contact = await db.unified_contacts.find_one({"id": data.contact_id}, {"_id": 0})
    if not contact:
        raise HTTPException(status_code=404, detail="Contact not found")
    
    email = contact.get("email")
    if not email:
        raise HTTPException(status_code=400, detail="Contact has no email address")
    
    # Generate email ID for tracking before sending
    email_id = str(uuid.uuid4())
    tracking_url = os.environ.get("REACT_APP_BACKEND_URL", "https://persona-assets.preview.emergentagent.com")
    
    # Send via Gmail with tracking
    result = await send_gmail(
        to_email=email,
        subject=data.subject,
        body=data.body,
        email_id=email_id,
        tracking_url=tracking_url
    )
    
    if not result.get("success"):
        raise HTTPException(status_code=500, detail=f"Failed to send email: {result.get('error')}")
    
    # Update contact with last sent info
    now = datetime.now(timezone.utc).isoformat()
    rule_type_lower = data.rule_type.lower()
    
    update_fields = {
        f"last_email_{rule_type_lower}_sent": now,
        f"last_email_{rule_type_lower}_content": f"Subject: {data.subject}\n\n{data.body}"
    }
    
    await db.unified_contacts.update_one(
        {"id": data.contact_id},
        {"$set": update_fields}
    )
    
    # Log email sent with tracking fields
    email_log = {
        "id": email_id,
        "contact_id": data.contact_id,
        "contact_email": email,
        "rule_type": data.rule_type,
        "subject": data.subject,
        "body": data.body,
        "gmail_message_id": result.get("message_id"),
        "sent_at": now,
        "sent_by": current_user.get("id"),
        "opened": False,
        "opened_at": None,
        "replied": False,
        "replied_at": None,
        "clicked": False,
        "clicked_at": None
    }
    await db.email_logs.insert_one(email_log)
    
    return {
        "success": True,
        "message_id": result.get("message_id"),
        "email_log_id": email_id,
        "sent_to": email,
        "sent_at": now
    }


@router.get("/stats")
async def get_email_stats(
    current_user: dict = Depends(get_current_user)
):
    """Get email sending statistics"""
    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0).isoformat()
    
    # Count emails sent today
    today_count = await db.email_logs.count_documents({
        "sent_at": {"$gte": today_start}
    })
    
    # Count by rule type today
    pipeline = [
        {"$match": {"sent_at": {"$gte": today_start}}},
        {"$group": {"_id": "$rule_type", "count": {"$sum": 1}}}
    ]
    by_type = await db.email_logs.aggregate(pipeline).to_list(10)
    by_type_dict = {r["_id"]: r["count"] for r in by_type}
    
    return {
        "today": {
            "total": today_count,
            "E1": by_type_dict.get("E1", 0),
            "E2": by_type_dict.get("E2", 0),
            "E3": by_type_dict.get("E3", 0),
            "E4": by_type_dict.get("E4", 0),
        }
    }


@router.get("/history/{contact_id}")
async def get_contact_email_history(
    contact_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get email history for a specific contact"""
    emails = await db.email_logs.find(
        {"contact_id": contact_id},
        {"_id": 0}
    ).sort("sent_at", -1).to_list(50)
    
    return {
        "contact_id": contact_id,
        "emails": emails,
        "count": len(emails)
    }



# ============ EMAIL METRICS & TRACKING ============

@router.get("/metrics/dashboard")
async def get_email_metrics_dashboard(
    days: int = 30,
    current_user: dict = Depends(get_current_user)
):
    """
    Get comprehensive email metrics for dashboard.
    Includes: sent count, open rate, reply rate by rule type.
    """
    start_date = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()
    
    # Get all emails in period
    emails = await db.email_logs.find(
        {"sent_at": {"$gte": start_date}},
        {"_id": 0}
    ).to_list(10000)
    
    # Calculate metrics by rule type
    metrics_by_rule = {}
    for rule in ["E1", "E2", "E3", "E4"]:
        rule_emails = [e for e in emails if e.get("rule_type") == rule]
        sent = len(rule_emails)
        opened = len([e for e in rule_emails if e.get("opened")])
        replied = len([e for e in rule_emails if e.get("replied")])
        clicked = len([e for e in rule_emails if e.get("clicked")])
        
        metrics_by_rule[rule] = {
            "sent": sent,
            "opened": opened,
            "replied": replied,
            "clicked": clicked,
            "open_rate": round((opened / sent * 100), 1) if sent > 0 else 0,
            "reply_rate": round((replied / sent * 100), 1) if sent > 0 else 0,
            "click_rate": round((clicked / sent * 100), 1) if sent > 0 else 0,
        }
    
    # Total metrics
    total_sent = len(emails)
    total_opened = len([e for e in emails if e.get("opened")])
    total_replied = len([e for e in emails if e.get("replied")])
    total_clicked = len([e for e in emails if e.get("clicked")])
    
    # Daily breakdown for chart
    daily_metrics = {}
    for email in emails:
        sent_date = email.get("sent_at", "")[:10]  # YYYY-MM-DD
        if sent_date not in daily_metrics:
            daily_metrics[sent_date] = {"sent": 0, "opened": 0, "replied": 0}
        daily_metrics[sent_date]["sent"] += 1
        if email.get("opened"):
            daily_metrics[sent_date]["opened"] += 1
        if email.get("replied"):
            daily_metrics[sent_date]["replied"] += 1
    
    # Sort daily metrics by date
    daily_sorted = [
        {"date": date, **data}
        for date, data in sorted(daily_metrics.items())
    ]
    
    # Best performing rule
    best_rule = max(
        metrics_by_rule.items(),
        key=lambda x: x[1]["open_rate"] if x[1]["sent"] > 0 else 0,
        default=("N/A", {"open_rate": 0})
    )
    
    return {
        "period_days": days,
        "total": {
            "sent": total_sent,
            "opened": total_opened,
            "replied": total_replied,
            "clicked": total_clicked,
            "open_rate": round((total_opened / total_sent * 100), 1) if total_sent > 0 else 0,
            "reply_rate": round((total_replied / total_sent * 100), 1) if total_sent > 0 else 0,
        },
        "by_rule": metrics_by_rule,
        "daily": daily_sorted,
        "best_performing_rule": {
            "rule": best_rule[0],
            "open_rate": best_rule[1]["open_rate"]
        },
        "insights": generate_email_insights(metrics_by_rule, total_sent)
    }


def generate_email_insights(metrics_by_rule: dict, total_sent: int) -> list:
    """Generate actionable insights based on metrics"""
    insights = []
    
    if total_sent == 0:
        insights.append({
            "type": "info",
            "message": "No emails sent yet. Start sending to see metrics!"
        })
        return insights
    
    # Find best and worst performers
    rules_with_data = [(r, m) for r, m in metrics_by_rule.items() if m["sent"] > 0]
    
    if rules_with_data:
        best = max(rules_with_data, key=lambda x: x[1]["open_rate"])
        worst = min(rules_with_data, key=lambda x: x[1]["open_rate"])
        
        if best[1]["open_rate"] > 30:
            insights.append({
                "type": "success",
                "message": f"{best[0]} has excellent engagement ({best[1]['open_rate']}% open rate). Consider using similar tone for other rules."
            })
        
        if worst[1]["open_rate"] < 15 and worst[1]["sent"] >= 5:
            insights.append({
                "type": "warning",
                "message": f"{worst[0]} has low engagement ({worst[1]['open_rate']}% open rate). Consider adjusting the subject line or sending time."
            })
    
    # Check reply rates
    total_replied = sum(m["replied"] for m in metrics_by_rule.values())
    if total_replied > 0:
        insights.append({
            "type": "success",
            "message": f"You've received {total_replied} replies! Great engagement."
        })
    
    return insights


@router.get("/metrics/by-contact")
async def get_metrics_by_contact(
    limit: int = 50,
    current_user: dict = Depends(get_current_user)
):
    """Get email metrics grouped by contact - who engages most"""
    pipeline = [
        {
            "$group": {
                "_id": "$contact_email",
                "contact_id": {"$first": "$contact_id"},
                "total_sent": {"$sum": 1},
                "total_opened": {"$sum": {"$cond": ["$opened", 1, 0]}},
                "total_replied": {"$sum": {"$cond": ["$replied", 1, 0]}},
                "last_email": {"$max": "$sent_at"},
                "rules_used": {"$addToSet": "$rule_type"}
            }
        },
        {"$sort": {"total_replied": -1, "total_opened": -1}},
        {"$limit": limit}
    ]
    
    results = await db.email_logs.aggregate(pipeline).to_list(limit)
    
    # Calculate engagement score
    for r in results:
        sent = r.get("total_sent", 1)
        opened = r.get("total_opened", 0)
        replied = r.get("total_replied", 0)
        r["engagement_score"] = round((opened * 1 + replied * 3) / sent * 100, 1)
        r["open_rate"] = round(opened / sent * 100, 1) if sent > 0 else 0
    
    return {
        "contacts": results,
        "total_contacts": len(results)
    }


@router.post("/track/open/{email_id}")
async def track_email_open(email_id: str):
    """
    Track email open via pixel or click.
    This endpoint is called when the tracking pixel loads or link is clicked.
    No auth required - called from email client.
    """
    result = await db.email_logs.update_one(
        {"id": email_id, "opened": {"$ne": True}},
        {
            "$set": {
                "opened": True,
                "opened_at": datetime.now(timezone.utc).isoformat()
            }
        }
    )
    
    # Return 1x1 transparent PNG
    from fastapi.responses import Response
    PIXEL = b'\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15\xc4\x89\x00\x00\x00\nIDATx\x9cc\x00\x01\x00\x00\x05\x00\x01\r\n-\xb4\x00\x00\x00\x00IEND\xaeB`\x82'
    
    return Response(content=PIXEL, media_type="image/png")


@router.post("/track/click/{email_id}")
async def track_email_click(email_id: str, url: str = ""):
    """Track link click in email"""
    await db.email_logs.update_one(
        {"id": email_id},
        {
            "$set": {"clicked": True, "clicked_at": datetime.now(timezone.utc).isoformat()},
            "$push": {"clicked_urls": {"url": url, "at": datetime.now(timezone.utc).isoformat()}}
        }
    )
    
    # Redirect to original URL
    from fastapi.responses import RedirectResponse
    if url:
        return RedirectResponse(url=url)
    return {"success": True}


@router.post("/track/reply/{email_id}")
async def mark_email_replied(
    email_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Manually mark an email as replied (admin action)"""
    result = await db.email_logs.update_one(
        {"id": email_id},
        {
            "$set": {
                "replied": True,
                "replied_at": datetime.now(timezone.utc).isoformat(),
                "replied_marked_by": current_user.get("id")
            }
        }
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Email not found")
    
    return {"success": True, "marked_as_replied": True}


@router.get("/metrics/weekly-report")
async def get_weekly_report(
    current_user: dict = Depends(get_current_user)
):
    """Get a weekly summary report for quick review"""
    start_date = (datetime.now(timezone.utc) - timedelta(days=7)).isoformat()
    
    emails = await db.email_logs.find(
        {"sent_at": {"$gte": start_date}},
        {"_id": 0}
    ).to_list(1000)
    
    # Calculate weekly stats
    sent = len(emails)
    opened = len([e for e in emails if e.get("opened")])
    replied = len([e for e in emails if e.get("replied")])
    
    # By rule breakdown
    by_rule = {}
    for rule in ["E1", "E2", "E3", "E4"]:
        rule_emails = [e for e in emails if e.get("rule_type") == rule]
        by_rule[rule] = {
            "sent": len(rule_emails),
            "opened": len([e for e in rule_emails if e.get("opened")]),
            "replied": len([e for e in rule_emails if e.get("replied")])
        }
    
    # Top engaged contacts this week
    contact_engagement = {}
    for email in emails:
        contact = email.get("contact_email", "")
        if contact not in contact_engagement:
            contact_engagement[contact] = {"sent": 0, "opened": 0, "replied": 0}
        contact_engagement[contact]["sent"] += 1
        if email.get("opened"):
            contact_engagement[contact]["opened"] += 1
        if email.get("replied"):
            contact_engagement[contact]["replied"] += 1
    
    top_engaged = sorted(
        contact_engagement.items(),
        key=lambda x: x[1]["opened"] + x[1]["replied"] * 2,
        reverse=True
    )[:5]
    
    return {
        "period": "Last 7 days",
        "summary": {
            "sent": sent,
            "opened": opened,
            "replied": replied,
            "open_rate": round(opened / sent * 100, 1) if sent > 0 else 0,
            "reply_rate": round(replied / sent * 100, 1) if sent > 0 else 0
        },
        "by_rule": by_rule,
        "top_engaged_contacts": [
            {"email": email, **stats}
            for email, stats in top_engaged
        ]
    }
