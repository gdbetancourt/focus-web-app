"""
Events V2 Router - Enhanced Event Management with Automatic Schedule
Includes: Auto-generated landing pages, Nano Banana images, task chronogram
"""
import os
import re
import uuid
import base64
from datetime import datetime, timezone, timedelta
from typing import Optional, List
from fastapi import APIRouter, HTTPException, Depends, Query, BackgroundTasks
from pydantic import BaseModel, Field
from dotenv import load_dotenv

load_dotenv()

from database import db
from routers.auth import get_current_user
from routers.webinar_emails import send_registration_confirmation
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/events-v2", tags=["events-v2"])


# ============ HELPER: CLASSIFY BUYER PERSONA BY JOB TITLE ============
# MIGRATION NOTE: This function now delegates to the centralized classifier service.
# All classification logic is in /backend/services/persona_classifier_service.py

from services.persona_classifier_service import classify_job_title_simple

async def classify_buyer_persona_by_job_title(job_title: str) -> str:
    """
    Classify a contact's buyer persona based on job title keywords.
    Returns the buyer_persona code (e.g., "ricardo", "mateo").
    Falls back to "mateo" if no keyword matches.
    
    MIGRATION: Now uses centralized persona_classifier_service.
    """
    return await classify_job_title_simple(db, job_title, use_cache=True)


# ============ MODELS ============

class EventTask(BaseModel):
    """A task in the event chronogram"""
    id: str
    name: str
    description: str
    due_date: str  # ISO date
    completed: bool = False
    completed_at: Optional[str] = None
    auto_generated: bool = False
    file_url: Optional[str] = None  # For document uploads
    requires_file: bool = False  # Whether task requires file upload before completion
    order: int = 0


class EventRegistrant(BaseModel):
    """A registrant for an event"""
    id: str
    treatment: str  # Sr., Sra., Dr., etc.
    first_name: str
    last_name: str
    email: str
    phone: str
    country_code: str
    registered_at: str
    source: str = "landing_page"


class CreateEventV2Request(BaseModel):
    """Request to create a new event with auto-generated schedule"""
    name: str
    description: Optional[str] = ""
    webinar_date: str  # The actual webinar date (1 month from creation suggested)
    webinar_time: Optional[str] = "10:00"
    buyer_personas: Optional[List[str]] = []
    industries: Optional[List[str]] = []  # Industry codes this event targets
    hubspot_list_url: Optional[str] = None  # URL of HubSpot list to import contacts from
    # Event categorization
    category: Optional[str] = None  # dominant_industry, leadership, sales, thought_leadership
    format: Optional[str] = "en_linea"  # presencial, en_linea
    linkedin_event_url: Optional[str] = None  # LinkedIn event URL
    # New fields for Content Matrix integration
    content_item_id: Optional[str] = None  # Link to Content Matrix item
    course_id: Optional[str] = None  # Course for LMS auto-enrollment
    competency_id: Optional[str] = None
    level: Optional[int] = None
    auto_enroll_lms: bool = True  # Whether to auto-enroll registrants in LMS course
    youtube_video_id: Optional[str] = None  # For manual YouTube setup
    create_youtube_live: bool = False  # Whether to auto-create YouTube Live broadcast


class CreateWebinarFromContentRequest(BaseModel):
    """Request to create a webinar from a Content Matrix item"""
    content_item_id: str
    webinar_date: str
    webinar_time: Optional[str] = "10:00"
    auto_enroll_lms: bool = True
    create_youtube_live: bool = True  # Auto-create YouTube Live broadcast
    youtube_video_id: Optional[str] = None  # If not creating, use existing video


class ImportContactsRequest(BaseModel):
    """Request to import contacts to a webinar"""
    contacts: List[dict]  # CSV parsed contacts
    import_as: str = "registered"  # "registered" or "attended"
    send_calendar_invite: bool = True


class WatchPingRequest(BaseModel):
    """Heartbeat for tracking watch time"""
    contact_id: str


class UpdateEventTaskRequest(BaseModel):
    """Request to update a task"""
    completed: Optional[bool] = None
    file_url: Optional[str] = None


class EventRegistrationRequest(BaseModel):
    """Public registration request"""
    treatment: str
    first_name: str
    last_name: str
    email: str
    phone: str
    country_code: str = "MX"
    specialty: Optional[str] = None
    accept_news: bool = True
    turnstile_token: Optional[str] = None


class TeamRegistrationRequest(BaseModel):
    """Request to register team members"""
    team_members: List[dict]  # [{first_name, last_name, email, phone}]
    registered_by: str  # Email of the person who registered first


async def verify_turnstile_token(token: str) -> bool:
    """Verify Cloudflare Turnstile token"""
    import httpx
    import os
    
    secret_key = os.environ.get("TURNSTILE_SECRET_KEY", "1x0000000000000000000000000000000AA")
    
    # Test keys always pass
    if secret_key.startswith("1x0000000000"):
        return True
    
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                "https://challenges.cloudflare.com/turnstile/v0/siteverify",
                data={
                    "secret": secret_key,
                    "response": token
                }
            )
            result = response.json()
            return result.get("success", False)
    except Exception as e:
        logger.error(f"Turnstile verification error: {e}")
        return False


# ============ HELPER FUNCTIONS ============

def get_business_days_from_date(start_date: datetime, days: int) -> datetime:
    """Calculate date after N business days (Mon-Fri)"""
    current = start_date
    added = 0
    while added < days:
        current += timedelta(days=1)
        if current.weekday() < 5:  # Monday = 0, Friday = 4
            added += 1
    return current


def generate_event_schedule(creation_date: datetime, webinar_date: datetime) -> List[EventTask]:
    """Generate the automatic task schedule for an event - simplified without sponsor tasks"""
    # Return empty list - no automatic tasks needed
    return []


# ============ HUBSPOT INTEGRATION ============

# Import centralized HubSpot token helper
from utils.hubspot_helpers import get_hubspot_token, get_hubspot_headers

def parse_hubspot_list_url(url: str) -> Optional[str]:
    """Extract list ID from HubSpot list URL"""
    import re
    # Pattern 1: /views/ID/list or /views/ID
    match1 = re.search(r'/views/(\d+)', url)
    # Pattern 2: /lists/ID
    match2 = re.search(r'/lists/(\d+)', url)
    # Pattern 3: /objectLists/ID (new HubSpot UI format)
    match3 = re.search(r'/objectLists/(\d+)', url)
    
    if match1:
        return match1.group(1)
    elif match2:
        return match2.group(1)
    elif match3:
        return match3.group(1)
    return None


async def get_hubspot_list_members(list_id: str) -> List[str]:
    """Get all contact IDs from a HubSpot list"""
    import httpx
    
    headers = await get_hubspot_headers()
    
    async with httpx.AsyncClient() as client:
        all_ids = []
        after = None
        
        while True:
            url = f"https://api.hubapi.com/crm/v3/lists/{list_id}/memberships?limit=500"
            if after:
                url += f"&after={after}"
            
            response = await client.get(
                url,
                headers=headers,
                timeout=30.0
            )
            
            if response.status_code != 200:
                logger.error(f"HubSpot list error: {response.status_code} - {response.text}")
                break
                
            data = response.json()
            ids = [r["recordId"] for r in data.get("results", [])]
            all_ids.extend(ids)
            
            paging = data.get("paging", {})
            if "next" in paging:
                after = paging["next"].get("after")
            else:
                break
        
        return all_ids


async def get_hubspot_contacts_batch(contact_ids: List[str]) -> List[dict]:
    """Get full details for a batch of contacts from HubSpot"""
    import httpx
    
    if not contact_ids:
        return []
    
    headers = await get_hubspot_headers()
    
    async with httpx.AsyncClient() as client:
        response = await client.post(
            "https://api.hubapi.com/crm/v3/objects/contacts/batch/read",
            headers=headers,
            json={
                "properties": [
                    "firstname", "lastname", "email", "hs_additional_emails",
                    "phone", "mobilephone", "other_phone",
                    "company", "jobtitle", "associatedcompanyid"
                ],
                "inputs": [{"id": str(cid)} for cid in contact_ids]
            },
            timeout=60.0
        )
        
        if response.status_code == 200:
            return response.json().get("results", [])
        else:
            logger.error(f"HubSpot batch error: {response.status_code} - {response.text}")
            return []


async def get_hubspot_company(company_id: str) -> Optional[dict]:
    """Get company details from HubSpot by ID"""
    import httpx
    
    if not company_id:
        return None
    
    headers = await get_hubspot_headers()
    
    async with httpx.AsyncClient() as client:
        response = await client.get(
            f"https://api.hubapi.com/crm/v3/objects/companies/{company_id}",
            headers=headers,
            params={"properties": "name,domain,industry,phone,city,country"},
            timeout=30.0
        )
        
        if response.status_code == 200:
            return response.json()
        else:
            logger.warning(f"Could not fetch HubSpot company {company_id}: {response.status_code}")
            return None


async def ensure_company_exists(company_id: str, company_name: str = None) -> Optional[str]:
    """
    Ensure a company exists in unified_companies collection.
    Returns the internal company ID if found/created, None otherwise.
    """
    if not company_id and not company_name:
        return None
    
    # First, check if company already exists by HubSpot ID in unified_companies
    if company_id:
        existing = await db.unified_companies.find_one(
            {"$or": [
                {"hs_object_id": company_id}, 
                {"hs_object_id": str(company_id)},
                {"hubspot_id": str(company_id)},
                {"id": str(company_id)}
            ]},
            {"_id": 0, "id": 1, "hubspot_id": 1, "hs_object_id": 1, "name": 1}
        )
        
        if existing:
            return existing.get("id") or existing.get("hubspot_id") or str(existing.get("hs_object_id"))
        
        # Fetch from HubSpot and create in unified_companies
        hs_company = await get_hubspot_company(company_id)
        if hs_company:
            props = hs_company.get("properties", {})
            new_company = {
                "id": str(uuid.uuid4()),
                "hubspot_id": str(company_id),
                "hs_object_id": company_id,
                "name": props.get("name", company_name or "Unknown"),
                "domain": props.get("domain", ""),
                "domains": [props.get("domain")] if props.get("domain") else [],
                "industry": props.get("industry", ""),
                "phone": props.get("phone", ""),
                "city": props.get("city", ""),
                "country": props.get("country", ""),
                "source": "hubspot_import",
                "classification": "inbound",
                "is_merged": False,
                "created_at": datetime.now(timezone.utc).isoformat(),
                "updated_at": datetime.now(timezone.utc).isoformat()
            }
            await db.unified_companies.insert_one(new_company)
            logger.info(f"Created company from HubSpot: {new_company['name']} (hs_id: {company_id})")
            return new_company["id"]
    
    # If no HubSpot ID but we have a name, check by name
    if company_name:
        existing = await db.unified_companies.find_one(
            {"name": {"$regex": f"^{re.escape(company_name)}$", "$options": "i"}, "is_merged": {"$ne": True}},
            {"_id": 0, "id": 1, "hubspot_id": 1, "name": 1}
        )
        if existing:
            return existing.get("id") or existing.get("hubspot_id")
    
    return None


async def import_hubspot_list_to_event(list_url: str, event_id: str, event_name: str) -> dict:
    """
    Import contacts from a HubSpot list and link them to an event.
    
    Returns:
        dict with import stats: created, updated, total
    """
    # Parse list ID from URL
    list_id = parse_hubspot_list_url(list_url)
    if not list_id:
        logger.error(f"Could not parse HubSpot list URL: {list_url}")
        return {"error": "Invalid HubSpot list URL", "created": 0, "updated": 0, "total": 0}
    
    logger.info(f"Importing HubSpot list {list_id} to event {event_id}")
    
    # Get all contact IDs from the list
    contact_ids = await get_hubspot_list_members(list_id)
    if not contact_ids:
        logger.warning(f"No contacts found in HubSpot list {list_id}")
        return {"created": 0, "updated": 0, "total": 0}
    
    logger.info(f"Found {len(contact_ids)} contacts in HubSpot list")
    
    # Fetch contact details in batches of 100
    all_contacts = []
    batch_size = 100
    for i in range(0, len(contact_ids), batch_size):
        batch = contact_ids[i:i + batch_size]
        contacts = await get_hubspot_contacts_batch(batch)
        all_contacts.extend(contacts)
    
    logger.info(f"Fetched details for {len(all_contacts)} contacts")
    
    # Process and save contacts
    created = 0
    updated = 0
    now = datetime.now(timezone.utc).isoformat()
    
    for contact in all_contacts:
        props = contact.get("properties", {})
        hubspot_id = contact.get("id")
        
        # Build name
        firstname = (props.get("firstname") or "").strip()
        lastname = (props.get("lastname") or "").strip()
        name = f"{firstname} {lastname}".strip() or "Sin nombre"
        
        # Get primary email
        primary_email = (props.get("email") or "").strip().lower()
        if not primary_email:
            continue  # Skip contacts without email
        
        # Get additional emails
        additional_emails_str = props.get("hs_additional_emails") or ""
        additional_emails = [e.strip().lower() for e in additional_emails_str.split(";") if e.strip()]
        all_emails = [primary_email] + [e for e in additional_emails if e != primary_email]
        
        # Get phones (up to 3)
        phone1 = (props.get("phone") or "").strip()
        phone2 = (props.get("mobilephone") or "").strip()
        phone3 = (props.get("other_phone") or "").strip()
        phones = [p for p in [phone1, phone2, phone3] if p]
        
        # Get company and job title
        company_name = (props.get("company") or "").strip()
        job_title = (props.get("jobtitle") or "").strip()
        associated_company_id = props.get("associatedcompanyid")
        
        # Ensure company exists in hubspot_companies and get internal ID
        company_id = await ensure_company_exists(associated_company_id, company_name)
        
        # Classify buyer persona based on job title
        buyer_persona = await classify_buyer_persona_by_job_title(job_title)
        
        # Check if contact exists
        existing = await db.unified_contacts.find_one({"email": primary_email})
        
        # Webinar history entry
        webinar_entry = {
            "event_id": event_id,
            "event_name": event_name,
            "status": "registered",
            "registered_at": now,
            "source": "hubspot_import"
        }
        
        if existing:
            # Update existing contact
            current_stage = existing.get("stage", 1)
            new_stage = 2 if current_stage in [1, 2] else current_stage
            
            # Check if already registered for this event
            existing_webinar_history = existing.get("webinar_history", [])
            already_registered = any(w.get("event_id") == event_id for w in existing_webinar_history)
            
            update_data = {
                "updated_at": now,
                "stage": new_stage
            }
            
            # Update fields if they're empty in existing record
            if not existing.get("first_name"):
                update_data["first_name"] = firstname
            if not existing.get("last_name"):
                update_data["last_name"] = lastname
            if not existing.get("company"):
                update_data["company"] = company_name
            if not existing.get("job_title"):
                update_data["job_title"] = job_title
            if not existing.get("buyer_persona"):
                update_data["buyer_persona"] = buyer_persona
            if company_id and not existing.get("company_id"):
                update_data["company_id"] = company_id
            
            # Add phones if not present
            existing_phone = existing.get("phone", "")
            if not existing_phone and phones:
                update_data["phone"] = phones[0]
            
            # Add webinar history if not already registered
            if not already_registered:
                update_data["webinar_history"] = existing_webinar_history + [webinar_entry]
            
            await db.unified_contacts.update_one(
                {"id": existing["id"]},
                {"$set": update_data}
            )
            updated += 1
        else:
            # Create new contact
            new_contact = {
                "id": str(uuid.uuid4()),
                "hubspot_id": hubspot_id,
                "name": name,
                "first_name": firstname,
                "last_name": lastname,
                "email": primary_email,
                "emails": all_emails,
                "phone": phones[0] if phones else "",
                "phones": phones,
                "company": company_name,
                "company_id": company_id,
                "job_title": job_title,
                "buyer_persona": buyer_persona,
                "stage": 2,  # Stage 2 for event imports
                "status": "active",
                "source": "hubspot",
                "source_details": {
                    "list_id": list_id,
                    "imported_at": now
                },
                "webinar_history": [webinar_entry],
                "created_at": now,
                "updated_at": now
            }
            await db.unified_contacts.insert_one(new_contact)
            created += 1
    
    logger.info(f"HubSpot import complete: {created} created, {updated} updated")
    
    return {
        "created": created,
        "updated": updated,
        "total": created + updated,
        "list_id": list_id
    }


async def generate_landing_page_image(event_name: str, event_id: str) -> Optional[str]:
    """Generate a dynamic, disruptive banner image using Nano Banana"""
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage
        
        api_key = os.environ.get("EMERGENT_LLM_KEY")
        if not api_key:
            logger.error("EMERGENT_LLM_KEY not found")
            return None
        
        image_prompt = f"""Create a DYNAMIC and DISRUPTIVE professional event banner image.
Theme: {event_name}
Style: Bold, modern, innovative - NOT corporate and boring
Visual elements:
- Dynamic geometric shapes with motion blur effects
- Vibrant gradient overlays (orange #ff3300 to deep purple)
- Abstract tech/innovation elements
- High contrast, eye-catching composition
- Dark background (#0a0a0a) with glowing accent colors
Do NOT include any text in the image.
The image should feel energetic, forward-thinking, and exciting.
Horizontal 16:9 aspect ratio, suitable for a landing page hero section."""

        chat = LlmChat(
            api_key=api_key,
            session_id=f"event-banner-{event_id}",
            system_message="You are an expert graphic designer creating bold, disruptive event banners."
        )
        chat.with_model("gemini", "gemini-3-pro-image-preview").with_params(modalities=["image", "text"])
        
        msg = UserMessage(text=image_prompt)
        text_response, images = await chat.send_message_multimodal_response(msg)
        
        if images and len(images) > 0:
            img_data = images[0]
            image_bytes = base64.b64decode(img_data['data'])
            
            # Save to static folder
            static_folder = "/app/frontend/public/event-banners"
            os.makedirs(static_folder, exist_ok=True)
            
            image_filename = f"{event_id}.png"
            image_path = f"{static_folder}/{image_filename}"
            
            with open(image_path, "wb") as f:
                f.write(image_bytes)
            
            # Return relative URL
            return f"/event-banners/{image_filename}"
        
        return None
        
    except Exception as e:
        logger.error(f"Error generating landing page image: {e}")
        return None


def calculate_event_traffic_light(event: dict) -> dict:
    """Calculate traffic light status for an event based on task completion"""
    tasks = event.get("tasks", [])
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    
    total_tasks = len(tasks)
    completed_tasks = sum(1 for t in tasks if t.get("completed", False))
    overdue_tasks = sum(1 for t in tasks if not t.get("completed", False) and t.get("due_date", "") < today)
    pending_tasks = sum(1 for t in tasks if not t.get("completed", False) and t.get("due_date", "") >= today)
    
    if overdue_tasks > 0:
        status = "red"
        message = f"{overdue_tasks} tarea(s) vencida(s)"
    elif pending_tasks > 0:
        status = "yellow"
        message = f"{pending_tasks} tarea(s) pendiente(s)"
    else:
        status = "green"
        message = "Todas las tareas completadas"
    
    return {
        "status": status,
        "message": message,
        "total": total_tasks,
        "completed": completed_tasks,
        "overdue": overdue_tasks,
        "pending": pending_tasks,
        "progress": int((completed_tasks / total_tasks * 100)) if total_tasks > 0 else 0
    }


# ============ ROUTES ============

@router.get("/")
async def get_events_v2(
    status_filter: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Get all events with their task status and total registrants count"""
    query = {}
    if status_filter:
        query["status"] = status_filter
    
    events = await db.webinar_events_v2.find(query, {"_id": 0}).sort("created_at", -1).to_list(100)
    
    # Get all event IDs for batch counting
    event_ids = [e.get("id") for e in events if e.get("id")]
    
    # Count imported contacts per event with status breakdown
    imported_counts = {}
    attended_counts = {}
    registered_counts = {}
    
    if event_ids:
        # Get total counts per event
        pipeline = [
            {"$match": {"webinar_history.event_id": {"$in": event_ids}}},
            {"$unwind": "$webinar_history"},
            {"$match": {"webinar_history.event_id": {"$in": event_ids}}},
            {"$group": {"_id": "$webinar_history.event_id", "count": {"$sum": 1}}}
        ]
        counts = await db.unified_contacts.aggregate(pipeline).to_list(None)
        imported_counts = {c["_id"]: c["count"] for c in counts}
        
        # Get attended counts per event
        pipeline_attended = [
            {"$match": {"webinar_history.event_id": {"$in": event_ids}}},
            {"$unwind": "$webinar_history"},
            {"$match": {
                "webinar_history.event_id": {"$in": event_ids},
                "webinar_history.status": "attended"
            }},
            {"$group": {"_id": "$webinar_history.event_id", "count": {"$sum": 1}}}
        ]
        attended = await db.unified_contacts.aggregate(pipeline_attended).to_list(None)
        attended_counts = {c["_id"]: c["count"] for c in attended}
        
        # Get registered-only counts per event
        pipeline_registered = [
            {"$match": {"webinar_history.event_id": {"$in": event_ids}}},
            {"$unwind": "$webinar_history"},
            {"$match": {
                "webinar_history.event_id": {"$in": event_ids},
                "webinar_history.status": "registered"
            }},
            {"$group": {"_id": "$webinar_history.event_id", "count": {"$sum": 1}}}
        ]
        registered = await db.unified_contacts.aggregate(pipeline_registered).to_list(None)
        registered_counts = {c["_id"]: c["count"] for c in registered}
    
    # Add traffic light status and registrant counts to each event
    for event in events:
        event["traffic_light"] = calculate_event_traffic_light(event)
        event_id = event.get("id")
        
        # Total = registrants from landing page + imported contacts
        landing_registrants = len(event.get("registrants", []))
        imported = imported_counts.get(event_id, 0)
        
        # Get status counts
        total_attended = attended_counts.get(event_id, 0)
        total_registered_only = registered_counts.get(event_id, 0)
        
        # Total registrants = all with any status (attended also counts as registered)
        event["total_registrants"] = landing_registrants + imported
        event["total_attended"] = total_attended
        event["total_registered_only"] = total_registered_only
        
        # Calculate show-up rate
        total_all = event["total_registrants"]
        if total_all > 0 and total_attended > 0:
            event["showup_rate"] = round((total_attended / total_all) * 100, 1)
        else:
            event["showup_rate"] = 0
    
    return events


@router.get("/showup-stats")
async def get_showup_statistics(current_user: dict = Depends(get_current_user)):
    """
    Get show-up rate statistics across all qualifying events.
    
    Qualifying events:
    - Have at least 10 total registrants
    - Have at least 1 attendee
    - Event date is in the past
    """
    from datetime import date
    
    today = date.today().isoformat()
    current_year = date.today().year
    
    # Get all events with dates in the past
    events = await db.webinar_events_v2.find(
        {"webinar_date": {"$lte": today}},
        {"_id": 0, "id": 1, "name": 1, "webinar_date": 1}
    ).to_list(None)
    
    if not events:
        return {
            "overall": {"average_showup": 0, "total_events": 0, "total_registrants": 0, "total_attended": 0},
            "current_year": {"average_showup": 0, "total_events": 0, "year": current_year},
            "by_year": [],
            "comparison": None
        }
    
    event_ids = [e.get("id") for e in events if e.get("id")]
    
    # Get counts per event
    # Total counts
    pipeline_total = [
        {"$match": {"webinar_history.event_id": {"$in": event_ids}}},
        {"$unwind": "$webinar_history"},
        {"$match": {"webinar_history.event_id": {"$in": event_ids}}},
        {"$group": {"_id": "$webinar_history.event_id", "count": {"$sum": 1}}}
    ]
    total_results = await db.unified_contacts.aggregate(pipeline_total).to_list(None)
    total_counts = {c["_id"]: c["count"] for c in total_results}
    
    # Attended counts
    pipeline_attended = [
        {"$match": {"webinar_history.event_id": {"$in": event_ids}}},
        {"$unwind": "$webinar_history"},
        {"$match": {"webinar_history.event_id": {"$in": event_ids}, "webinar_history.status": "attended"}},
        {"$group": {"_id": "$webinar_history.event_id", "count": {"$sum": 1}}}
    ]
    attended_results = await db.unified_contacts.aggregate(pipeline_attended).to_list(None)
    attended_counts = {c["_id"]: c["count"] for c in attended_results}
    
    # Build event data with show-up rates
    qualifying_events = []
    for event in events:
        event_id = event.get("id")
        total = total_counts.get(event_id, 0)
        attended = attended_counts.get(event_id, 0)
        
        # Filter: at least 10 registrants AND at least 1 attendee
        if total >= 10 and attended > 0:
            showup_rate = min((attended / total) * 100, 100)  # Cap at 100%
            
            # Parse year from webinar_date
            try:
                year = int(event.get("webinar_date", "")[:4])
            except:
                year = None
            
            qualifying_events.append({
                "event_id": event_id,
                "name": event.get("name"),
                "date": event.get("webinar_date"),
                "year": year,
                "total": total,
                "attended": attended,
                "showup_rate": round(showup_rate, 1)
            })
    
    if not qualifying_events:
        return {
            "overall": {"average_showup": 0, "total_events": 0, "total_registrants": 0, "total_attended": 0},
            "current_year": {"average_showup": 0, "total_events": 0, "year": current_year},
            "by_year": [],
            "comparison": None
        }
    
    # Calculate overall average
    overall_avg = sum(e["showup_rate"] for e in qualifying_events) / len(qualifying_events)
    overall_total_registrants = sum(e["total"] for e in qualifying_events)
    overall_total_attended = sum(e["attended"] for e in qualifying_events)
    
    # Calculate by year
    years_data = {}
    for event in qualifying_events:
        year = event.get("year")
        if year:
            if year not in years_data:
                years_data[year] = {"rates": [], "total": 0, "attended": 0}
            years_data[year]["rates"].append(event["showup_rate"])
            years_data[year]["total"] += event["total"]
            years_data[year]["attended"] += event["attended"]
    
    by_year = []
    sorted_years = sorted(years_data.keys(), reverse=True)
    
    for i, year in enumerate(sorted_years):
        data = years_data[year]
        avg = sum(data["rates"]) / len(data["rates"]) if data["rates"] else 0
        
        # Calculate trend compared to previous year
        trend = None
        if i < len(sorted_years) - 1:
            prev_year = sorted_years[i + 1]
            prev_avg = sum(years_data[prev_year]["rates"]) / len(years_data[prev_year]["rates"])
            if avg > prev_avg + 2:
                trend = "up"
            elif avg < prev_avg - 2:
                trend = "down"
            else:
                trend = "stable"
        
        by_year.append({
            "year": year,
            "average_showup": round(avg, 1),
            "events": len(data["rates"]),
            "total_registrants": data["total"],
            "total_attended": data["attended"],
            "trend": trend
        })
    
    # Current year stats
    current_year_events = [e for e in qualifying_events if e.get("year") == current_year]
    current_year_avg = 0
    if current_year_events:
        current_year_avg = sum(e["showup_rate"] for e in current_year_events) / len(current_year_events)
    
    # Comparison: current year vs overall
    comparison = None
    if current_year_avg > 0 and overall_avg > 0:
        diff = current_year_avg - overall_avg
        if diff > 2:
            comparison = "above"
        elif diff < -2:
            comparison = "below"
        else:
            comparison = "equal"
    
    return {
        "overall": {
            "average_showup": round(overall_avg, 1),
            "total_events": len(qualifying_events),
            "total_registrants": overall_total_registrants,
            "total_attended": overall_total_attended
        },
        "current_year": {
            "average_showup": round(current_year_avg, 1),
            "total_events": len(current_year_events),
            "year": current_year
        },
        "by_year": by_year,
        "comparison": comparison
    }


@router.get("/traffic-light")
async def get_events_traffic_light(current_user: dict = Depends(get_current_user)):
    """Get aggregated traffic light status for all events (for navigation)"""
    events = await db.webinar_events_v2.find({}, {"_id": 0}).to_list(100)
    
    if not events:
        return {"status": "gray", "message": "Sin eventos", "total": 0}
    
    all_green = True
    any_red = False
    
    for event in events:
        tl = calculate_event_traffic_light(event)
        if tl["status"] == "red":
            any_red = True
            all_green = False
        elif tl["status"] == "yellow":
            all_green = False
    
    if any_red:
        status = "red"
        message = "Hay tareas vencidas en algunos eventos"
    elif all_green:
        status = "green"
        message = "Todos los eventos al día"
    else:
        status = "yellow"
        message = "Hay tareas pendientes"
    
    return {
        "status": status,
        "message": message,
        "total_events": len(events)
    }


# Event categories for marketing planning
EVENT_CATEGORIES = ["dominant_industry", "leadership", "sales", "thought_leadership"]
CATEGORY_LABELS = {
    "dominant_industry": "Dominant Industry Specific",
    "leadership": "Leadership Specific",
    "sales": "Sales Specific",
    "thought_leadership": "Thought Leadership Specific"
}


@router.get("/marketing-planning-traffic-light")
async def get_marketing_planning_traffic_light(current_user: dict = Depends(get_current_user)):
    """
    Get traffic light status for Marketing Event Planning based on 4 placeholders.
    Green: All 4 categories have at least one upcoming event
    Yellow: Some categories have upcoming events but not all
    Red: No upcoming events in any category
    """
    from datetime import date
    today = date.today().isoformat()
    
    # Get all future events with categories
    events = await db.webinar_events_v2.find(
        {"webinar_date": {"$gte": today}},
        {"_id": 0, "id": 1, "name": 1, "category": 1, "webinar_date": 1}
    ).to_list(500)
    
    # Count events per category
    category_counts = {cat: 0 for cat in EVENT_CATEGORIES}
    category_events = {cat: [] for cat in EVENT_CATEGORIES}
    
    for event in events:
        cat = event.get("category")
        if cat in category_counts:
            category_counts[cat] += 1
            category_events[cat].append({
                "id": event.get("id"),
                "name": event.get("name"),
                "date": event.get("webinar_date")
            })
    
    # Calculate status
    categories_with_events = sum(1 for count in category_counts.values() if count > 0)
    empty_categories = [CATEGORY_LABELS[cat] for cat, count in category_counts.items() if count == 0]
    
    if categories_with_events == 4:
        status = "green"
        message = "Eventos programados en todas las categorías"
    elif categories_with_events > 0:
        status = "yellow"
        message = f"Faltan eventos en: {', '.join(empty_categories)}"
    else:
        status = "red"
        message = "No hay eventos programados en ninguna categoría"
    
    return {
        "status": status,
        "message": message,
        "category_counts": category_counts,
        "category_events": category_events,
        "empty_categories": empty_categories,
        "total_future_events": len(events)
    }


# Email rules related to webinars
WEBINAR_EMAIL_RULES = ["E06", "E07", "E08", "E09", "E10"]
WEBINAR_EMAIL_RULE_NAMES = {
    "E06": "Confirmación Pre-registro (7 días antes)",
    "E07": "Recordatorio: Hora Exacta",
    "E08": "Recordatorio: 1 Hora Antes",
    "E09": "Recordatorio: 24 Horas Hábiles",
    "E10": "Recordatorio: 7 Días Antes"
}


@router.get("/{event_id}/email-status")
async def get_event_email_status(event_id: str, current_user: dict = Depends(get_current_user)):
    """
    Get the status of webinar-related emails for an event.
    Returns which emails have been sent, scheduled, or pending.
    """
    from datetime import date
    
    event = await db.webinar_events_v2.find_one(
        {"id": event_id},
        {"_id": 0, "name": 1, "webinar_date": 1, "webinar_time": 1}
    )
    
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    
    webinar_date = event.get("webinar_date")
    webinar_time = event.get("webinar_time", "10:00")
    today = date.today().isoformat()
    
    email_statuses = []
    
    for rule_id in WEBINAR_EMAIL_RULES:
        # Count sent emails for this event and rule
        sent_count = await db.email_queue.count_documents({
            "event_id": event_id,
            "rule": rule_id,
            "status": "sent"
        })
        
        # Count pending emails
        pending_count = await db.email_queue.count_documents({
            "event_id": event_id,
            "rule": rule_id,
            "status": "pending"
        })
        
        # Determine status based on rule timing
        if rule_id == "E06":
            # 7 days before
            from datetime import datetime, timedelta
            event_dt = datetime.strptime(webinar_date, "%Y-%m-%d")
            send_date = (event_dt - timedelta(days=7)).strftime("%Y-%m-%d")
            status = "sent" if sent_count > 0 else ("scheduled" if today < send_date else "pending")
            scheduled_for = f"{send_date}"
        elif rule_id == "E09":
            # 24 hours before
            from datetime import datetime, timedelta
            event_dt = datetime.strptime(webinar_date, "%Y-%m-%d")
            send_date = (event_dt - timedelta(days=1)).strftime("%Y-%m-%d")
            status = "sent" if sent_count > 0 else ("scheduled" if today < send_date else "pending")
            scheduled_for = f"{send_date}"
        elif rule_id == "E08":
            # 1 hour before
            status = "sent" if sent_count > 0 else ("scheduled" if today < webinar_date else "pending")
            scheduled_for = f"{webinar_date} {webinar_time}"
        elif rule_id == "E07":
            # At webinar time
            status = "sent" if sent_count > 0 else ("scheduled" if today <= webinar_date else "pending")
            scheduled_for = f"{webinar_date} {webinar_time}"
        elif rule_id == "E10":
            # 1 day after
            from datetime import datetime, timedelta
            event_dt = datetime.strptime(webinar_date, "%Y-%m-%d")
            send_date = (event_dt + timedelta(days=1)).strftime("%Y-%m-%d")
            status = "sent" if sent_count > 0 else ("scheduled" if today < send_date else "pending")
            scheduled_for = f"{send_date}"
        else:
            status = "unknown"
            scheduled_for = None
        
        email_statuses.append({
            "rule_id": rule_id,
            "name": WEBINAR_EMAIL_RULE_NAMES.get(rule_id, rule_id),
            "status": status,
            "sent_count": sent_count,
            "pending_count": pending_count,
            "scheduled_for": scheduled_for
        })
    
    return {
        "event_id": event_id,
        "event_name": event.get("name"),
        "webinar_date": webinar_date,
        "email_statuses": email_statuses
    }


@router.post("/")
async def create_event_v2(
    data: CreateEventV2Request,
    current_user: dict = Depends(get_current_user)
):
    """Create a new event with auto-generated schedule and landing page"""
    import unicodedata
    
    # Log incoming date for debugging
    logger.info(f"Creating event - received webinar_date: '{data.webinar_date}', webinar_time: '{data.webinar_time}'")
    
    event_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc)
    webinar_date = datetime.fromisoformat(data.webinar_date)
    
    logger.info(f"Parsed webinar_date: {webinar_date}")
    
    # Generate slug for landing page URL (normalize accents)
    slug = unicodedata.normalize('NFKD', data.name.lower())
    slug = slug.encode('ASCII', 'ignore').decode('ASCII')  # Remove accents
    slug = "".join(c if c.isalnum() or c == " " else "" for c in slug)
    slug = slug.replace(" ", "-")[:50]
    slug = f"{slug}-{event_id[:8]}"
    
    # Generate task schedule
    tasks = generate_event_schedule(now, webinar_date)
    
    # Create event document
    event = {
        "id": event_id,
        "name": data.name,
        "description": data.description or "",
        "webinar_date": data.webinar_date,
        "webinar_time": data.webinar_time,
        "buyer_personas": data.buyer_personas or [],
        "industries": data.industries or [],
        "category": data.category,  # dominant_industry, leadership, sales, thought_leadership
        "format": data.format or "en_linea",  # presencial, en_linea
        "linkedin_event_url": data.linkedin_event_url,
        "slug": slug,
        "landing_page_url": f"/evento/{slug}",
        "banner_image": None,
        "tasks": [t.model_dump() for t in tasks],
        "registrants": [],
        "status": "active",
        "created_at": now.isoformat(),
        "updated_at": now.isoformat()
    }
    
    await db.webinar_events_v2.insert_one(event)
    
    # Generate landing page image asynchronously
    banner_url = await generate_landing_page_image(data.name, event_id)
    
    if banner_url:
        # Update event with banner and mark landing page task as complete
        tasks_updated = event["tasks"]
        for task in tasks_updated:
            if task["name"] == "Landing Page del evento":
                task["completed"] = True
                task["completed_at"] = datetime.now(timezone.utc).isoformat()
                break
        
        await db.webinar_events_v2.update_one(
            {"id": event_id},
            {"$set": {
                "banner_image": banner_url,
                "tasks": tasks_updated,
                "updated_at": datetime.now(timezone.utc).isoformat()
            }}
        )
        event["banner_image"] = banner_url
        event["tasks"] = tasks_updated
    
    # Create Google Calendar event for future webinars
    google_calendar_event_id = None
    try:
        google_calendar_event_id = await create_webinar_calendar_event(
            event_id=event_id,
            event_name=data.name,
            event_description=data.description or "",
            event_date=data.webinar_date,
            event_time=data.webinar_time,
            landing_page_url=f"/evento/{slug}"
        )
        
        if google_calendar_event_id:
            await db.webinar_events_v2.update_one(
                {"id": event_id},
                {"$set": {"google_calendar_event_id": google_calendar_event_id}}
            )
            event["google_calendar_event_id"] = google_calendar_event_id
            logger.info(f"Created Google Calendar event for webinar: {google_calendar_event_id}")
    except Exception as e:
        logger.error(f"Error creating calendar event for webinar: {e}")
    
    # Import contacts from HubSpot if URL provided
    hubspot_import_result = None
    if data.hubspot_list_url:
        try:
            hubspot_import_result = await import_hubspot_list_to_event(
                data.hubspot_list_url, 
                event_id, 
                data.name
            )
            logger.info(f"HubSpot import for event {event_id}: {hubspot_import_result}")
        except Exception as e:
            logger.error(f"HubSpot import error: {e}")
            hubspot_import_result = {"error": str(e), "created": 0, "updated": 0}
    
    # Remove MongoDB _id
    event.pop("_id", None)
    event["traffic_light"] = calculate_event_traffic_light(event)
    
    # Add HubSpot import result to response
    if hubspot_import_result:
        event["hubspot_import"] = hubspot_import_result
    
    logger.info(f"Created event v2: {data.name} with {len(tasks)} tasks")
    return event


@router.get("/{event_id}")
async def get_event_v2(
    event_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get a single event with all details"""
    event = await db.webinar_events_v2.find_one({"id": event_id}, {"_id": 0})
    if not event:
        raise HTTPException(status_code=404, detail="Evento no encontrado")
    
    event["traffic_light"] = calculate_event_traffic_light(event)
    return event


@router.put("/{event_id}/tasks/{task_id}")
async def update_event_task(
    event_id: str,
    task_id: str,
    data: UpdateEventTaskRequest,
    current_user: dict = Depends(get_current_user)
):
    """Update a task (mark complete, upload file, etc.)"""
    event = await db.webinar_events_v2.find_one({"id": event_id})
    if not event:
        raise HTTPException(status_code=404, detail="Evento no encontrado")
    
    tasks = event.get("tasks", [])
    task_found = False
    
    for task in tasks:
        if task["id"] == task_id:
            task_found = True
            if data.completed is not None:
                task["completed"] = data.completed
                task["completed_at"] = datetime.now(timezone.utc).isoformat() if data.completed else None
            if data.file_url is not None:
                task["file_url"] = data.file_url
            break
    
    if not task_found:
        raise HTTPException(status_code=404, detail="Tarea no encontrada")
    
    await db.webinar_events_v2.update_one(
        {"id": event_id},
        {"$set": {"tasks": tasks, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    updated_event = await db.webinar_events_v2.find_one({"id": event_id}, {"_id": 0})
    updated_event["traffic_light"] = calculate_event_traffic_light(updated_event)
    
    return updated_event


class UpdateEventRequest(BaseModel):
    """Request to update event details"""
    name: Optional[str] = None
    description: Optional[str] = None
    webinar_date: Optional[str] = None
    webinar_time: Optional[str] = None
    buyer_personas: Optional[List[str]] = None
    industries: Optional[List[str]] = None
    linkedin_event_url: Optional[str] = None
    category: Optional[str] = None  # dominant_industry, leadership, sales, thought_leadership
    format: Optional[str] = None  # presencial, en_linea
    status: Optional[str] = None


@router.put("/{event_id}")
async def update_event_v2(
    event_id: str,
    data: UpdateEventRequest,
    current_user: dict = Depends(get_current_user)
):
    """Update event details"""
    event = await db.webinar_events_v2.find_one({"id": event_id})
    if not event:
        raise HTTPException(status_code=404, detail="Evento no encontrado")
    
    update_data = {k: v for k, v in data.dict().items() if v is not None}
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    await db.webinar_events_v2.update_one(
        {"id": event_id},
        {"$set": update_data}
    )
    
    updated_event = await db.webinar_events_v2.find_one({"id": event_id}, {"_id": 0})
    updated_event["traffic_light"] = calculate_event_traffic_light(updated_event)
    
    return updated_event


@router.delete("/{event_id}")
async def delete_event_v2(
    event_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Delete an event. Protected: cannot delete events with associated contacts."""
    event = await db.webinar_events_v2.find_one({"id": event_id})
    if not event:
        raise HTTPException(status_code=404, detail="Evento no encontrado")
    
    # Check if event has registrants in its document
    if event.get("registrants") and len(event.get("registrants", [])) > 0:
        raise HTTPException(
            status_code=409, 
            detail=f"No se puede eliminar: el evento tiene {len(event['registrants'])} registrados. Elimina los contactos primero."
        )
    
    # Check if there are contacts in unified_contacts linked to this event
    linked_contacts_count = await db.unified_contacts.count_documents(
        {"webinar_history.event_id": event_id}
    )
    if linked_contacts_count > 0:
        raise HTTPException(
            status_code=409,
            detail=f"No se puede eliminar: hay {linked_contacts_count} contactos vinculados a este evento."
        )
    
    result = await db.webinar_events_v2.delete_one({"id": event_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Evento no encontrado")
    
    return {"success": True, "message": "Evento eliminado"}


# ============ PUBLIC LANDING PAGE ROUTES (No auth required) ============

@router.get("/public/upcoming")
async def get_public_upcoming_events():
    """Get upcoming public events for homepage display (no auth required)"""
    from datetime import datetime
    
    today = datetime.now().strftime("%Y-%m-%d")
    
    # Find events with webinar_date >= today, sorted by date ascending
    events = await db.webinar_events_v2.find(
        {"webinar_date": {"$gte": today}},
        {"_id": 0, "id": 1, "name": 1, "description": 1, "webinar_date": 1, 
         "webinar_time": 1, "banner_image": 1, "slug": 1, "buyer_personas": 1}
    ).sort("webinar_date", 1).limit(3).to_list(3)
    
    return {
        "events": events,
        "count": len(events)
    }

@router.get("/public/landing/{slug}")
async def get_public_landing_page(slug: str):
    """Get event data for public landing page (no auth)"""
    event = await db.webinar_events_v2.find_one({"slug": slug}, {"_id": 0})
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    
    # Get display title and course/competency/level from content item if available
    display_title = event.get("name")
    short_description = None
    course_name = None
    competency_name = None
    level_name = None
    
    content_item_id = event.get("content_item_id")
    if content_item_id:
        content_item = await db.content_items.find_one(
            {"id": content_item_id}, 
            {"_id": 0, "title": 1, "course_id": 1, "competency_id": 1, "level": 1}
        )
        if content_item:
            # Get title
            if content_item.get("title") and content_item.get("title") != "Nuevo contenido":
                display_title = content_item.get("title")
            
            # Get course name
            if content_item.get("course_id"):
                course = await db.courses.find_one({"id": content_item.get("course_id")}, {"_id": 0, "name": 1, "title": 1})
                if course:
                    course_name = course.get("name") or course.get("title")
            
            # Get competency name
            if content_item.get("competency_id"):
                competency = await db.competencies.find_one({"id": content_item.get("competency_id")}, {"_id": 0, "name": 1})
                if competency:
                    competency_name = competency.get("name")
            
            # Get level name from niveles_certificacion (Foundations)
            level_num = content_item.get("level")
            if level_num:
                nivel = await db.niveles_certificacion.find_one({"order": level_num}, {"_id": 0, "advancement_es": 1, "advancement_en": 1})
                if nivel:
                    level_name = nivel.get("advancement_es")
                else:
                    # Fallback if nivel not found
                    level_name = f"Nivel {level_num}"
    
    # Clean description - remove Wikipedia-like content
    description = event.get("description", "")
    if description:
        # If description looks like scraped content, use a cleaner version
        if "Wikipedia" in description or len(description) > 1000:
            short_description = None  # Don't show messy descriptions
        else:
            short_description = description[:300] + "..." if len(description) > 300 else description
    
    # Return only public data
    return {
        "id": event.get("id"),
        "name": event.get("name"),
        "display_title": display_title,
        "description": event.get("description"),
        "short_description": short_description,
        "webinar_date": event.get("webinar_date"),
        "webinar_time": event.get("webinar_time"),
        "banner_image": event.get("banner_image"),
        "slug": event.get("slug"),
        "course_name": course_name,
        "competency_name": competency_name,
        "level_name": level_name
    }


@router.post("/public/register/{slug}")
async def register_for_event(slug: str, data: EventRegistrationRequest):
    """Public endpoint to register for an event (no auth)"""
    
    # Verify CAPTCHA token
    if data.turnstile_token:
        is_valid = await verify_turnstile_token(data.turnstile_token)
        if not is_valid:
            raise HTTPException(status_code=400, detail="Verificación de seguridad fallida. Por favor, intenta de nuevo.")
    
    event = await db.webinar_events_v2.find_one({"slug": slug})
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    
    # Validate phone number format based on country
    phone_lengths = {
        "MX": 10, "US": 10, "CO": 10, "AR": 10, "ES": 9, "CL": 9, "PE": 9
    }
    expected_length = phone_lengths.get(data.country_code, 10)
    clean_phone = "".join(filter(str.isdigit, data.phone))
    
    if len(clean_phone) != expected_length:
        raise HTTPException(
            status_code=400, 
            detail=f"El número de teléfono debe tener {expected_length} dígitos para {data.country_code}"
        )
    
    # Check for duplicate email
    existing = next((r for r in event.get("registrants", []) if r.get("email") == data.email), None)
    if existing:
        raise HTTPException(status_code=400, detail="Este email ya está registrado")
    
    # Create registrant
    registrant_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc)
    
    registrant = {
        "id": registrant_id,
        "treatment": data.treatment,
        "first_name": data.first_name,
        "last_name": data.last_name,
        "email": data.email,
        "phone": clean_phone,
        "country_code": data.country_code,
        "registered_at": now.isoformat(),
        "source": "landing_page",
        "accept_news": data.accept_news
    }
    
    # Add to event registrants
    await db.webinar_events_v2.update_one(
        {"slug": slug},
        {"$push": {"registrants": registrant}}
    )
    
    # Also create/update contact in unified_contacts
    full_name = f"{data.treatment} {data.first_name} {data.last_name}".strip()
    
    existing_contact = await db.unified_contacts.find_one({"email": data.email})
    
    event_record = {
        "event_id": event.get("id"),
        "event_name": event.get("name"),
        "registered": True,
        "attended": False,
        "date": event.get("webinar_date")
    }
    
    contact_id = None
    
    if existing_contact:
        contact_id = existing_contact.get("id")
        current_stage = existing_contact.get("stage", 1)
        
        # Stage logic: 1->2, new->2, keep 3/4/5
        new_stage = current_stage
        if current_stage == 1:
            new_stage = 2
        elif current_stage in [3, 4, 5]:
            new_stage = current_stage  # Keep current stage
        else:
            new_stage = 2  # Stage 2 or any other -> Stage 2
        
        # Update existing contact
        events = existing_contact.get("events", [])
        event_ids = {e.get("event_id") for e in events}
        if event.get("id") not in event_ids:
            events.append(event_record)
        
        update_data = {
            "events": events,
            "stage": new_stage,
            "updated_at": now.isoformat()
        }
        
        # Update accept_news if they opted in
        if data.accept_news:
            update_data["accept_news"] = True
        
        await db.unified_contacts.update_one(
            {"email": data.email},
            {"$set": update_data}
        )
    else:
        # Create new contact in Stage 2
        contact_id = str(uuid.uuid4())
        new_contact = {
            "id": contact_id,
            "name": full_name,
            "treatment": data.treatment,
            "first_name": data.first_name,
            "last_name": data.last_name,
            "email": data.email,
            "phone": clean_phone,
            "country_code": data.country_code,
            "stage": 2,  # Stage 2 - Nurture
            "source": "event_registration",
            "buyer_persona": "mateo",  # Default
            "events": [event_record],
            "accept_news": data.accept_news,
            "created_at": now.isoformat(),
            "updated_at": now.isoformat()
        }
        await db.unified_contacts.insert_one(new_contact)
    
    logger.info(f"New registration for event {event.get('name')}: {data.email}")
    
    # Send E06 confirmation email (async, won't block response)
    try:
        await send_registration_confirmation(
            event_id=event.get("id"),
            contact={
                "id": contact_id,
                "contact_id": contact_id,
                "first_name": data.first_name,
                "last_name": data.last_name,
                "name": full_name,
                "email": data.email
            }
        )
        logger.info(f"E06 email queued for {data.email}")
    except Exception as e:
        logger.error(f"Error queueing E06 email: {e}")
        # Don't fail registration if email fails
    
    return {
        "success": True,
        "message": "¡Registro exitoso!",
        "registrant_id": registrant_id,
        "contact_id": contact_id
    }


@router.post("/public/register-team/{slug}")
async def register_team_for_event(slug: str, data: TeamRegistrationRequest):
    """Public endpoint to register team members for an event (no auth)"""
    event = await db.webinar_events_v2.find_one({"slug": slug})
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    
    now = datetime.now(timezone.utc)
    registered_count = 0
    
    event_record = {
        "event_id": event.get("id"),
        "event_name": event.get("name"),
        "registered": True,
        "attended": False,
        "date": event.get("webinar_date")
    }
    
    for member in data.team_members:
        # Skip if missing required fields
        if not member.get("first_name") or not member.get("last_name") or not member.get("email"):
            continue
        
        email = member.get("email", "").lower().strip()
        
        # Check if already registered for this event
        existing = next((r for r in event.get("registrants", []) if r.get("email") == email), None)
        if existing:
            continue
        
        # Clean phone
        phone = "".join(filter(str.isdigit, member.get("phone", "")))
        
        # Add to event registrants
        registrant_id = str(uuid.uuid4())
        registrant = {
            "id": registrant_id,
            "first_name": member.get("first_name"),
            "last_name": member.get("last_name"),
            "email": email,
            "phone": phone,
            "registered_at": now.isoformat(),
            "source": "team_invitation",
            "invited_by": data.registered_by
        }
        
        await db.webinar_events_v2.update_one(
            {"slug": slug},
            {"$push": {"registrants": registrant}}
        )
        
        # Create or update contact
        existing_contact = await db.unified_contacts.find_one({"email": email})
        
        if existing_contact:
            contact_id = existing_contact.get("id")
            current_stage = existing_contact.get("stage", 1)
            
            # Stage logic: 1->2, new->2, keep 3/4/5
            new_stage = current_stage
            if current_stage == 1:
                new_stage = 2
            elif current_stage in [3, 4, 5]:
                new_stage = current_stage
            else:
                new_stage = 2
            
            events = existing_contact.get("events", [])
            event_ids = {e.get("event_id") for e in events}
            if event.get("id") not in event_ids:
                events.append(event_record)
            
            await db.unified_contacts.update_one(
                {"email": email},
                {"$set": {
                    "events": events,
                    "stage": new_stage,
                    "updated_at": now.isoformat()
                }}
            )
        else:
            # Create new contact in Stage 2
            contact_id = str(uuid.uuid4())
            full_name = f"{member.get('first_name')} {member.get('last_name')}".strip()
            new_contact = {
                "id": contact_id,
                "name": full_name,
                "first_name": member.get("first_name"),
                "last_name": member.get("last_name"),
                "email": email,
                "phone": phone,
                "stage": 2,
                "source": "team_invitation",
                "invited_by": data.registered_by,
                "buyer_persona": "mateo",
                "events": [event_record],
                "created_at": now.isoformat(),
                "updated_at": now.isoformat()
            }
            await db.unified_contacts.insert_one(new_contact)
        
        # Send E06 confirmation email to team member
        try:
            await send_registration_confirmation(
                event_id=event.get("id"),
                contact={
                    "id": contact_id,
                    "contact_id": contact_id,
                    "first_name": member.get("first_name"),
                    "last_name": member.get("last_name"),
                    "name": f"{member.get('first_name')} {member.get('last_name')}".strip(),
                    "email": email
                }
            )
        except Exception as e:
            logger.error(f"Error queueing E06 email for team member {email}: {e}")
        
        registered_count += 1
    
    logger.info(f"Team registration for event {event.get('name')}: {registered_count} members by {data.registered_by}")
    
    return {
        "success": True,
        "message": f"{registered_count} miembros del equipo registrados",
        "registered_count": registered_count
    }


@router.get("/{event_id}/registrants")
async def get_event_registrants(
    event_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get all registrants for an event, combining event registrants and imported contacts.
    Includes buyer_persona for grouping in frontend."""
    event = await db.webinar_events_v2.find_one({"id": event_id}, {"_id": 0})
    if not event:
        raise HTTPException(status_code=404, detail="Evento no encontrado")
    
    def normalize_email(email_value):
        """Handle email as string or list"""
        if isinstance(email_value, list):
            return email_value[0].lower() if email_value else ""
        return (email_value or "").lower()
    
    # Get registrants from event document
    event_registrants = event.get("registrants", [])
    
    # Get contacts who were imported for this event (from unified_contacts)
    imported_contacts = await db.unified_contacts.find(
        {"webinar_history.event_id": event_id},
        {"_id": 0, "id": 1, "name": 1, "first_name": 1, "last_name": 1, "email": 1, "phone": 1, "company": 1, "job_title": 1, "buyer_persona": 1, "webinar_history": 1}
    ).to_list(None)
    
    # Combine and dedupe by email
    all_registrants = []
    seen_emails = set()
    
    for r in event_registrants:
        email = normalize_email(r.get("email", ""))
        if email and email not in seen_emails:
            seen_emails.add(email)
            all_registrants.append({
                **r,
                "email": email,  # Normalize to string
                "buyer_persona": r.get("buyer_persona", "mateo"),
                "source": "public_registration",
                "attended": r.get("attended", False)  # Default to not attended
            })
    
    for c in imported_contacts:
        email = normalize_email(c.get("email", ""))
        if email and email not in seen_emails:
            seen_emails.add(email)
            # Find the specific webinar entry
            webinar_entry = next(
                (w for w in c.get("webinar_history", []) if w.get("event_id") == event_id),
                {}
            )
            all_registrants.append({
                "id": c.get("id"),
                "name": c.get("name") or f"{c.get('first_name', '')} {c.get('last_name', '')}".strip(),
                "email": email,  # Normalized string
                "phone": c.get("phone", ""),
                "company": c.get("company"),
                "job_title": c.get("job_title"),
                "buyer_persona": c.get("buyer_persona", "mateo"),
                "registered_at": webinar_entry.get("registered_at"),
                "attended": webinar_entry.get("status") == "attended",
                "source": "csv_import"
            })
    
    return {
        "event_id": event_id,
        "event_name": event.get("name"),
        "registrants": all_registrants,
        "total": len(all_registrants),
        "attended_count": sum(1 for r in all_registrants if r.get("attended")),
        "registered_count": sum(1 for r in all_registrants if not r.get("attended"))
    }


@router.post("/{event_id}/regenerate-image")
async def regenerate_event_image(
    event_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Regenerate the banner image for an event"""
    event = await db.webinar_events_v2.find_one({"id": event_id})
    if not event:
        raise HTTPException(status_code=404, detail="Evento no encontrado")
    
    banner_url = await generate_landing_page_image(event.get("name"), event_id)
    
    if banner_url:
        await db.webinar_events_v2.update_one(
            {"id": event_id},
            {"$set": {"banner_image": banner_url, "updated_at": datetime.now(timezone.utc).isoformat()}}
        )
        return {"success": True, "banner_image": banner_url}
    
    raise HTTPException(status_code=500, detail="Error al generar imagen")


# ============ YOUTUBE LIVE INTEGRATION ============

async def get_youtube_credentials():
    """Get YouTube credentials from settings (shared with Calendar OAuth)"""
    settings = await db.settings.find_one({}, {"_id": 0})
    if not settings:
        return None
    
    calendar_creds = settings.get("calendar_credentials")
    if not calendar_creds:
        return None
    
    return calendar_creds


# ============ YOUTUBE CHANNEL SELECTION ============

@router.get("/youtube/channels")
async def list_youtube_channels(
    current_user: dict = Depends(get_current_user)
):
    """List all YouTube channels for the authenticated user"""
    from google.oauth2.credentials import Credentials
    from google.auth.transport.requests import Request as GoogleRequest
    from googleapiclient.discovery import build
    from config import GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET
    
    try:
        creds_dict = await get_youtube_credentials()
        if not creds_dict:
            raise HTTPException(status_code=400, detail="Google credentials not configured")
        
        credentials = Credentials(
            token=creds_dict.get("token"),
            refresh_token=creds_dict.get("refresh_token"),
            token_uri="https://oauth2.googleapis.com/token",
            client_id=GOOGLE_CLIENT_ID,
            client_secret=GOOGLE_CLIENT_SECRET,
            scopes=['https://www.googleapis.com/auth/youtube.force-ssl']
        )
        
        if credentials.expired and credentials.refresh_token:
            credentials.refresh(GoogleRequest())
        
        youtube = build('youtube', 'v3', credentials=credentials)
        
        # List all channels the user has access to (owned + managed)
        channels = []
        
        # First get owned channels
        owned_response = youtube.channels().list(
            part="snippet,contentDetails,statistics",
            mine=True
        ).execute()
        
        for ch in owned_response.get("items", []):
            channels.append({
                "id": ch["id"],
                "title": ch["snippet"]["title"],
                "description": ch["snippet"].get("description", "")[:100],
                "thumbnail": ch["snippet"]["thumbnails"].get("default", {}).get("url"),
                "subscriber_count": ch["statistics"].get("subscriberCount", "0"),
                "video_count": ch["statistics"].get("videoCount", "0"),
                "type": "owned"
            })
        
        # Try to get managed channels (Brand Accounts)
        try:
            managed_response = youtube.channels().list(
                part="snippet,contentDetails,statistics",
                managedByMe=True
            ).execute()
            
            for ch in managed_response.get("items", []):
                if ch["id"] not in [c["id"] for c in channels]:
                    channels.append({
                        "id": ch["id"],
                        "title": ch["snippet"]["title"],
                        "description": ch["snippet"].get("description", "")[:100],
                        "thumbnail": ch["snippet"]["thumbnails"].get("default", {}).get("url"),
                        "subscriber_count": ch["statistics"].get("subscriberCount", "0"),
                        "video_count": ch["statistics"].get("videoCount", "0"),
                        "type": "managed"
                    })
        except Exception as e:
            logger.warning(f"Could not list managed channels: {e}")
        
        # Get current selected channel
        settings = await db.settings.find_one({})
        selected_channel = settings.get("youtube_channel_id") if settings else None
        
        return {
            "success": True,
            "channels": channels,
            "selected_channel_id": selected_channel
        }
        
    except Exception as e:
        logger.error(f"Error listing YouTube channels: {e}")
        raise HTTPException(status_code=500, detail=f"Error: {str(e)}")


@router.post("/youtube/select-channel")
async def select_youtube_channel(
    channel_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Select which YouTube channel to use for live streaming"""
    await db.settings.update_one(
        {},
        {"$set": {"youtube_channel_id": channel_id}},
        upsert=True
    )
    
    return {"success": True, "selected_channel_id": channel_id}


def sanitize_youtube_description(description: str, max_length: int = 4500) -> str:
    """
    Sanitize description for YouTube API.
    YouTube has strict rules: max 5000 chars, no HTML, limited special chars.
    """
    import re
    import html
    
    if not description:
        return ""
    
    # Decode HTML entities
    text = html.unescape(description)
    
    # Remove HTML tags
    text = re.sub(r'<[^>]+>', '', text)
    
    # Remove markdown-style links but keep text
    text = re.sub(r'\[([^\]]+)\]\([^\)]+\)', r'\1', text)
    
    # Remove URLs (YouTube doesn't like certain URL patterns in descriptions)
    text = re.sub(r'https?://\S+', '', text)
    
    # Replace multiple newlines with double newline
    text = re.sub(r'\n{3,}', '\n\n', text)
    
    # Remove control characters except newline and tab
    text = re.sub(r'[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]', '', text)
    
    # Replace tabs with spaces
    text = text.replace('\t', ' ')
    
    # Remove multiple spaces
    text = re.sub(r' {2,}', ' ', text)
    
    # Strip whitespace
    text = text.strip()
    
    # Truncate to max length
    if len(text) > max_length:
        text = text[:max_length - 3] + "..."
    
    return text


async def create_youtube_live_broadcast(event_name: str, event_description: str, 
                                         scheduled_start: datetime) -> Optional[dict]:
    """Create a YouTube Live broadcast for a webinar"""
    from google.oauth2.credentials import Credentials
    from google.auth.transport.requests import Request as GoogleRequest
    from googleapiclient.discovery import build
    from config import GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET
    
    try:
        creds_dict = await get_youtube_credentials()
        if not creds_dict:
            logger.warning("No YouTube/Calendar credentials found")
            return None
        
        credentials = Credentials(
            token=creds_dict.get("token"),
            refresh_token=creds_dict.get("refresh_token"),
            token_uri="https://oauth2.googleapis.com/token",
            client_id=GOOGLE_CLIENT_ID,
            client_secret=GOOGLE_CLIENT_SECRET,
            scopes=['https://www.googleapis.com/auth/youtube.force-ssl']
        )
        
        # Refresh if needed
        if credentials.expired and credentials.refresh_token:
            credentials.refresh(GoogleRequest())
            # Update stored credentials
            await db.settings.update_one(
                {},
                {"$set": {
                    "calendar_credentials.token": credentials.token,
                    "calendar_credentials.expiry": credentials.expiry.isoformat() if credentials.expiry else None
                }}
            )
        
        youtube = build('youtube', 'v3', credentials=credentials)
        
        # Sanitize title and description for YouTube API
        safe_title = sanitize_youtube_description(event_name, max_length=100)
        if not safe_title:
            safe_title = "Webinar"
        
        safe_description = sanitize_youtube_description(event_description, max_length=4500)
        if not safe_description:
            safe_description = f"Webinar: {safe_title}"
        
        logger.info(f"Creating YouTube broadcast with title: '{safe_title}' (len={len(safe_title)})")
        logger.info(f"Description preview: '{safe_description[:100]}...' (len={len(safe_description)})")
        
        # Format scheduled time properly for YouTube API (ISO 8601 with Z suffix)
        # Convert to UTC and format without timezone suffix, then add Z
        if scheduled_start.tzinfo is not None:
            scheduled_start_utc = scheduled_start.astimezone(timezone.utc)
        else:
            scheduled_start_utc = scheduled_start.replace(tzinfo=timezone.utc)
        
        # Format as ISO 8601 without microseconds and with Z suffix
        scheduled_time_str = scheduled_start_utc.strftime("%Y-%m-%dT%H:%M:%S") + "Z"
        logger.info(f"Formatted scheduledStartTime: {scheduled_time_str}")
        
        # Create the broadcast
        broadcast_body = {
            "snippet": {
                "title": safe_title,
                "description": safe_description,
                "scheduledStartTime": scheduled_time_str
            },
            "status": {
                "privacyStatus": "unlisted",  # unlisted until ready
                "selfDeclaredMadeForKids": False
            },
            "contentDetails": {
                "enableAutoStart": False,
                "enableAutoStop": True
            }
        }
        
        broadcast_response = youtube.liveBroadcasts().insert(
            part="snippet,status,contentDetails",
            body=broadcast_body
        ).execute()
        
        broadcast_id = broadcast_response.get("id")
        
        # Create a live stream to bind to the broadcast
        stream_body = {
            "snippet": {
                "title": f"Stream for {event_name}"
            },
            "cdn": {
                "frameRate": "30fps",
                "ingestionType": "rtmp",
                "resolution": "1080p"
            }
        }
        
        stream_response = youtube.liveStreams().insert(
            part="snippet,cdn",
            body=stream_body
        ).execute()
        
        stream_id = stream_response.get("id")
        
        # Bind the stream to the broadcast
        youtube.liveBroadcasts().bind(
            id=broadcast_id,
            part="id,contentDetails",
            streamId=stream_id
        ).execute()
        
        logger.info(f"Created YouTube Live broadcast: {broadcast_id}")
        
        return {
            "broadcast_id": broadcast_id,
            "stream_id": stream_id,
            "embed_url": f"https://www.youtube.com/embed/{broadcast_id}",
            "watch_url": f"https://www.youtube.com/watch?v={broadcast_id}",
            "stream_key": stream_response.get("cdn", {}).get("ingestionInfo", {}).get("streamName"),
            "rtmp_url": stream_response.get("cdn", {}).get("ingestionInfo", {}).get("ingestionAddress")
        }
        
    except Exception as e:
        logger.error(f"Error creating YouTube Live broadcast: {e}")
        return None


# ============ YOUTUBE PRIVACY CONTROL ============

@router.post("/{event_id}/youtube-privacy")
async def update_youtube_privacy(
    event_id: str,
    privacy: str = Query(..., regex="^(public|private|unlisted)$"),
    current_user: dict = Depends(get_current_user)
):
    """Update YouTube broadcast privacy status (unlisted → public)"""
    from google.oauth2.credentials import Credentials
    from google.auth.transport.requests import Request as GoogleRequest
    from googleapiclient.discovery import build
    from config import GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET
    
    event = await db.webinar_events_v2.find_one({"id": event_id})
    if not event:
        raise HTTPException(status_code=404, detail="Webinar not found")
    
    broadcast_id = event.get("youtube_broadcast_id")
    if not broadcast_id:
        raise HTTPException(status_code=400, detail="No YouTube broadcast associated with this webinar")
    
    try:
        creds_dict = await get_youtube_credentials()
        if not creds_dict:
            raise HTTPException(status_code=400, detail="Google credentials not configured")
        
        credentials = Credentials(
            token=creds_dict.get("token"),
            refresh_token=creds_dict.get("refresh_token"),
            token_uri="https://oauth2.googleapis.com/token",
            client_id=GOOGLE_CLIENT_ID,
            client_secret=GOOGLE_CLIENT_SECRET,
            scopes=['https://www.googleapis.com/auth/youtube.force-ssl']
        )
        
        if credentials.expired and credentials.refresh_token:
            credentials.refresh(GoogleRequest())
        
        youtube = build('youtube', 'v3', credentials=credentials)
        
        # Update the broadcast privacy status
        update_body = {
            "id": broadcast_id,
            "status": {
                "privacyStatus": privacy,
                "selfDeclaredMadeForKids": False
            }
        }
        
        response = youtube.liveBroadcasts().update(
            part="status",
            body=update_body
        ).execute()
        
        new_privacy = response.get("status", {}).get("privacyStatus")
        
        # Update in database
        await db.webinar_events_v2.update_one(
            {"id": event_id},
            {"$set": {
                "youtube_privacy": new_privacy,
                "updated_at": datetime.now(timezone.utc).isoformat()
            }}
        )
        
        logger.info(f"Updated YouTube privacy for {broadcast_id} to {new_privacy}")
        
        return {
            "success": True,
            "broadcast_id": broadcast_id,
            "privacy_status": new_privacy,
            "youtube_url": f"https://youtube.com/watch?v={broadcast_id}"
        }
        
    except Exception as e:
        logger.error(f"Error updating YouTube privacy: {e}")
        raise HTTPException(status_code=500, detail=f"YouTube error: {str(e)}")


# ============ GOOGLE CALENDAR MULTI-EVENT ============

async def create_webinar_calendar_event(event_id: str, event_name: str, 
                                        event_description: str, event_date: str,
                                        event_time: str, landing_page_url: str = "") -> Optional[str]:
    """Create a single Google Calendar event for the webinar (organizer's calendar only, no attendees)
    
    Args:
        event_id: Unique event identifier
        event_name: Name/title of the event
        event_description: Description to show in calendar
        event_date: Date in YYYY-MM-DD format
        event_time: Time in HH:MM format
        landing_page_url: URL to the event landing page
        
    Returns:
        Google Calendar event ID if created, None otherwise
    """
    from google.oauth2.credentials import Credentials
    from google.auth.transport.requests import Request as GoogleRequest
    from googleapiclient.discovery import build
    from config import GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET
    
    # Only create for future events
    try:
        event_datetime = datetime.fromisoformat(f"{event_date}T{event_time}:00")
        now = datetime.now()
        if event_datetime <= now:
            logger.info(f"Skipping calendar creation for past/current event: {event_name}")
            return None
    except Exception as e:
        logger.error(f"Error parsing event date: {e}")
        return None
    
    try:
        creds_dict = await get_youtube_credentials()  # Same credentials
        if not creds_dict:
            logger.warning("No Calendar credentials found for webinar event creation")
            return None
        
        credentials = Credentials(
            token=creds_dict.get("token"),
            refresh_token=creds_dict.get("refresh_token"),
            token_uri="https://oauth2.googleapis.com/token",
            client_id=GOOGLE_CLIENT_ID,
            client_secret=GOOGLE_CLIENT_SECRET,
            scopes=['https://www.googleapis.com/auth/calendar.events']
        )
        
        if credentials.expired and credentials.refresh_token:
            credentials.refresh(GoogleRequest())
        
        calendar = build('calendar', 'v3', credentials=credentials)
        
        # Parse date and time
        start_datetime = datetime.fromisoformat(f"{event_date}T{event_time}:00")
        end_datetime = start_datetime + timedelta(hours=2)  # 2 hour default duration
        
        # Build description
        full_description = event_description or ""
        if landing_page_url:
            full_description += f"\n\nLanding page: {landing_page_url}"
        
        calendar_event = {
            "summary": f"📅 Webinar: {event_name}",
            "description": full_description,
            "start": {
                "dateTime": start_datetime.isoformat(),
                "timeZone": "America/Mexico_City"
            },
            "end": {
                "dateTime": end_datetime.isoformat(),
                "timeZone": "America/Mexico_City"
            },
            "reminders": {
                "useDefault": False,
                "overrides": [
                    {"method": "email", "minutes": 24 * 60},  # 1 day before
                    {"method": "popup", "minutes": 60}  # 1 hour before
                ]
            }
        }
        
        result = calendar.events().insert(
            calendarId='primary',
            body=calendar_event,
            sendUpdates='none'  # No notifications for organizer's own event
        ).execute()
        
        logger.info(f"Created calendar event {result.get('id')} for webinar: {event_name}")
        return result.get('id')
        
    except Exception as e:
        logger.error(f"Error creating webinar calendar event: {e}")
        return None


async def create_calendar_events_for_webinar(event_id: str, event_name: str, 
                                              event_description: str, event_date: str,
                                              event_time: str, watching_room_url: str,
                                              attendee_emails: List[str],
                                              location: str = "") -> List[str]:
    """Create Google Calendar events for webinar attendees (max 100 per event)
    
    Args:
        event_id: Unique event identifier
        event_name: Name/title of the event
        event_description: Description to show in calendar
        event_date: Date in YYYY-MM-DD format
        event_time: Time in HH:MM format
        watching_room_url: URL to join the webinar
        attendee_emails: List of attendee email addresses
        location: Physical or virtual location (optional)
    """
    from google.oauth2.credentials import Credentials
    from google.auth.transport.requests import Request as GoogleRequest
    from googleapiclient.discovery import build
    from config import GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET
    
    try:
        creds_dict = await get_youtube_credentials()  # Same credentials
        if not creds_dict:
            logger.warning("No Calendar credentials found")
            return []
        
        credentials = Credentials(
            token=creds_dict.get("token"),
            refresh_token=creds_dict.get("refresh_token"),
            token_uri="https://oauth2.googleapis.com/token",
            client_id=GOOGLE_CLIENT_ID,
            client_secret=GOOGLE_CLIENT_SECRET,
            scopes=['https://www.googleapis.com/auth/calendar.events']
        )
        
        if credentials.expired and credentials.refresh_token:
            credentials.refresh(GoogleRequest())
        
        calendar = build('calendar', 'v3', credentials=credentials)
        
        # Parse date and time
        start_datetime = datetime.fromisoformat(f"{event_date}T{event_time}:00")
        end_datetime = start_datetime + timedelta(hours=2)  # 2 hour default duration
        
        created_event_ids = []
        
        # Split attendees into groups of 100
        batch_size = 100
        for i in range(0, len(attendee_emails), batch_size):
            batch_emails = attendee_emails[i:i + batch_size]
            group_num = (i // batch_size) + 1
            
            event_title = event_name
            if len(attendee_emails) > batch_size:
                event_title = f"{event_name} (Grupo {group_num})"
            
            # Build full description with webinar link
            full_description = event_description
            if watching_room_url:
                full_description += f"\n\nÚnete al webinar: {watching_room_url}"
            
            calendar_event = {
                "summary": event_title,
                "description": full_description,
                "location": location,
                "start": {
                    "dateTime": start_datetime.isoformat(),
                    "timeZone": "America/Mexico_City"
                },
                "end": {
                    "dateTime": end_datetime.isoformat(),
                    "timeZone": "America/Mexico_City"
                },
                "attendees": [{"email": email} for email in batch_emails],
                "guestsCanSeeOtherGuests": False,  # IMPORTANT: Hide guest list from attendees
                "guestsCanInviteOthers": False,    # Prevent attendees from inviting others
                "conferenceData": {
                    "createRequest": {
                        "requestId": f"{event_id}-{group_num}",
                        "conferenceSolutionKey": {"type": "hangoutsMeet"}
                    }
                },
                "reminders": {
                    "useDefault": False,
                    "overrides": [
                        {"method": "email", "minutes": 24 * 60},  # 1 day before
                        {"method": "email", "minutes": 60},  # 1 hour before
                        {"method": "popup", "minutes": 15}
                    ]
                }
            }
            
            try:
                result = calendar.events().insert(
                    calendarId='primary',
                    body=calendar_event,
                    sendUpdates='all',  # Send email invitations
                    conferenceDataVersion=1  # Required for Meet link
                ).execute()
                
                created_event_ids.append(result.get('id'))
                logger.info(f"Created calendar event {result.get('id')} for {len(batch_emails)} attendees")
                
            except Exception as e:
                logger.error(f"Error creating calendar event batch {group_num}: {e}")
        
        return created_event_ids
        
    except Exception as e:
        logger.error(f"Error in create_calendar_events_for_webinar: {e}")
        return []


# ============ WEBINAR FROM CONTENT MATRIX ============

@router.post("/from-content-item")
async def create_webinar_from_content_item(
    data: CreateWebinarFromContentRequest,
    current_user: dict = Depends(get_current_user)
):
    """Create a webinar linked to a Content Matrix item"""
    import unicodedata
    
    # Get the content item
    content_item = await db.content_items.find_one({"id": data.content_item_id}, {"_id": 0})
    if not content_item:
        raise HTTPException(status_code=404, detail="Content item not found")
    
    # Check if content item already has a webinar
    existing_webinar = await db.webinar_events_v2.find_one(
        {"content_item_id": data.content_item_id}
    )
    if existing_webinar:
        raise HTTPException(
            status_code=409, 
            detail=f"Content item already has a webinar: {existing_webinar.get('name')}"
        )
    
    event_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc)
    webinar_date = datetime.fromisoformat(data.webinar_date)
    
    event_name = content_item.get("title", "Webinar")
    event_description = content_item.get("notes", "") or content_item.get("dictation_draft_text", "")
    
    # Generate slug
    slug = unicodedata.normalize('NFKD', event_name.lower())
    slug = slug.encode('ASCII', 'ignore').decode('ASCII')
    slug = "".join(c if c.isalnum() or c == " " else "" for c in slug)
    slug = slug.replace(" ", "-")[:50]
    slug = f"{slug}-{event_id[:8]}"
    
    # Generate task schedule
    tasks = generate_event_schedule(now, webinar_date)
    
    # Create YouTube Live broadcast if requested
    youtube_data = None
    if data.create_youtube_live:
        scheduled_start = datetime.fromisoformat(f"{data.webinar_date}T{data.webinar_time}:00")
        youtube_data = await create_youtube_live_broadcast(
            event_name, event_description, scheduled_start
        )
    
    # Build event document
    event = {
        "id": event_id,
        "name": event_name,
        "description": event_description,
        "webinar_date": data.webinar_date,
        "webinar_time": data.webinar_time,
        "buyer_personas": [],
        "slug": slug,
        "landing_page_url": f"/evento/{slug}",
        "banner_image": None,
        "tasks": [t.model_dump() for t in tasks],
        "registrants": [],
        "status": "active",
        # Content Matrix integration fields
        "content_item_id": data.content_item_id,
        "course_id": content_item.get("course_id"),
        "competency_id": content_item.get("competency_id"),
        "level": content_item.get("level"),
        "auto_enroll_lms": data.auto_enroll_lms,
        # YouTube Live fields
        "youtube_broadcast_id": youtube_data.get("broadcast_id") if youtube_data else None,
        "youtube_stream_id": youtube_data.get("stream_id") if youtube_data else None,
        "youtube_embed_url": youtube_data.get("embed_url") if youtube_data else None,
        "youtube_video_id": data.youtube_video_id,  # Manual fallback
        "youtube_stream_key": youtube_data.get("stream_key") if youtube_data else None,
        "youtube_rtmp_url": youtube_data.get("rtmp_url") if youtube_data else None,
        # Google Calendar
        "google_calendar_event_ids": [],
        # Timestamps
        "created_at": now.isoformat(),
        "updated_at": now.isoformat()
    }
    
    await db.webinar_events_v2.insert_one(event)
    
    # Generate banner image
    banner_url = await generate_landing_page_image(event_name, event_id)
    if banner_url:
        tasks_updated = event["tasks"]
        for task in tasks_updated:
            if task["name"] == "Landing Page del evento":
                task["completed"] = True
                task["completed_at"] = datetime.now(timezone.utc).isoformat()
                break
        
        await db.webinar_events_v2.update_one(
            {"id": event_id},
            {"$set": {
                "banner_image": banner_url,
                "tasks": tasks_updated,
                "updated_at": datetime.now(timezone.utc).isoformat()
            }}
        )
        event["banner_image"] = banner_url
        event["tasks"] = tasks_updated
    
    event.pop("_id", None)
    event["traffic_light"] = calculate_event_traffic_light(event)
    
    logger.info(f"Created webinar from content item: {event_name}")
    
    return {
        "success": True,
        "event": event,
        "youtube_created": youtube_data is not None,
        "youtube_info": youtube_data
    }


# ============ ADD YOUTUBE LIVE TO EXISTING WEBINAR ============

@router.post("/{event_id}/create-youtube-live")
async def add_youtube_live_to_webinar(
    event_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Add YouTube Live broadcast to an existing webinar that doesn't have one"""
    event = await db.webinar_events_v2.find_one({"id": event_id})
    if not event:
        raise HTTPException(status_code=404, detail="Webinar not found")
    
    # Check if already has YouTube
    if event.get("youtube_broadcast_id") or event.get("youtube_video_id"):
        return {
            "success": True,
            "already_exists": True,
            "youtube_url": f"https://youtube.com/watch?v={event.get('youtube_video_id') or event.get('youtube_broadcast_id')}"
        }
    
    # Create YouTube Live
    try:
        # Parse scheduled date from webinar_date and webinar_time
        webinar_date = event.get("webinar_date")
        webinar_time = event.get("webinar_time", "10:00")
        
        if webinar_date:
            try:
                # Combine date and time
                scheduled_start = datetime.fromisoformat(f"{webinar_date}T{webinar_time}:00")
                # Make it timezone-aware (UTC)
                scheduled_start = scheduled_start.replace(tzinfo=timezone.utc)
            except ValueError:
                # Fallback to 1 hour from now if date parsing fails
                scheduled_start = datetime.now(timezone.utc) + timedelta(hours=1)
        else:
            # Fallback to 1 hour from now
            scheduled_start = datetime.now(timezone.utc) + timedelta(hours=1)
        
        logger.info(f"Scheduling YouTube broadcast for: {scheduled_start.isoformat()}")
        
        youtube_data = await create_youtube_live_broadcast(
            event_name=event.get("name", "Webinar"),
            event_description=event.get("description", ""),
            scheduled_start=scheduled_start
        )
        
        if youtube_data:
            # Update webinar with YouTube data
            await db.webinar_events_v2.update_one(
                {"id": event_id},
                {"$set": {
                    "youtube_broadcast_id": youtube_data.get("broadcast_id"),
                    "youtube_video_id": youtube_data.get("video_id"),
                    "youtube_stream_key": youtube_data.get("stream_key"),
                    "youtube_stream_url": youtube_data.get("stream_url"),
                    "updated_at": datetime.now(timezone.utc).isoformat()
                }}
            )
            
            video_id = youtube_data.get("video_id") or youtube_data.get("broadcast_id")
            youtube_url = f"https://youtube.com/watch?v={video_id}" if video_id else None
            
            logger.info(f"YouTube Live created for webinar {event_id}: {youtube_url}")
            
            return {
                "success": True,
                "youtube_url": youtube_url,
                "broadcast_id": youtube_data.get("broadcast_id"),
                "stream_key": youtube_data.get("stream_key"),
                "stream_url": youtube_data.get("stream_url")
            }
        else:
            raise HTTPException(status_code=500, detail="Failed to create YouTube Live - check credentials")
            
    except Exception as e:
        logger.error(f"Error creating YouTube Live: {e}")
        raise HTTPException(status_code=500, detail=f"YouTube error: {str(e)}")


# ============ IMPORT CONTACTS TO WEBINAR ============

@router.post("/{event_id}/import-contacts")
async def import_contacts_to_webinar(
    event_id: str,
    data: ImportContactsRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Import contacts to a webinar with stage logic:
    - New contacts → Stage 2
    - Stage 1 contacts → Stage 2
    - Stage 3,4,5 contacts → No change
    Also handles LMS auto-enrollment and calendar invitations.
    """
    event = await db.webinar_events_v2.find_one({"id": event_id})
    if not event:
        raise HTTPException(status_code=404, detail="Evento no encontrado")
    
    now = datetime.now(timezone.utc)
    imported = 0
    updated = 0
    already_registered = 0
    errors = []
    new_emails_for_calendar = []
    
    course_id = event.get("course_id")
    auto_enroll = event.get("auto_enroll_lms", True)
    
    for contact_data in data.contacts:
        email = contact_data.get("email", "").strip().lower()
        if not email or "@" not in email:
            errors.append({"email": email or "empty", "error": "Invalid email"})
            continue
        
        # Check if contact exists
        existing = await db.unified_contacts.find_one({"email": email})
        
        # Build webinar history entry
        webinar_entry = {
            "event_id": event_id,
            "event_name": event.get("name"),
            "status": data.import_as,  # "registered" or "attended"
            "registered_at": now.isoformat(),
            "attended_at": now.isoformat() if data.import_as == "attended" else None,
            "watch_time_seconds": 0,
            "last_watch_ping": None
        }
        
        if existing:
            contact_id = existing.get("id")
            current_stage = existing.get("stage", 1)
            
            # Check if already registered for this webinar
            webinar_history = existing.get("webinar_history", [])
            already_in_webinar = any(w.get("event_id") == event_id for w in webinar_history)
            
            if already_in_webinar:
                # Update status if importing as attended
                if data.import_as == "attended":
                    for wh in webinar_history:
                        if wh.get("event_id") == event_id:
                            wh["status"] = "attended"
                            wh["attended_at"] = now.isoformat()
                            break
                    await db.unified_contacts.update_one(
                        {"id": contact_id},
                        {"$set": {"webinar_history": webinar_history, "updated_at": now.isoformat()}}
                    )
                already_registered += 1
                continue
            
            # Stage logic: only change if stage 1
            new_stage = current_stage
            if current_stage == 1:
                new_stage = 2
            
            # Update contact
            update_data = {
                "stage": new_stage,
                "updated_at": now.isoformat()
            }
            
            # Fill empty fields
            first_name = contact_data.get("firstname", "").strip()
            last_name = contact_data.get("lastname", "").strip()
            if first_name and not existing.get("first_name"):
                update_data["first_name"] = first_name
            if last_name and not existing.get("last_name"):
                update_data["last_name"] = last_name
            if contact_data.get("company") and not existing.get("company"):
                update_data["company"] = contact_data.get("company")
            if contact_data.get("jobtitle") and not existing.get("job_title"):
                update_data["job_title"] = contact_data.get("jobtitle")
            
            await db.unified_contacts.update_one(
                {"id": contact_id},
                {
                    "$set": update_data,
                    "$push": {"webinar_history": webinar_entry}
                }
            )
            
            # Auto-enroll in LMS course if enabled
            if auto_enroll and course_id:
                await db.lms_courses.update_one(
                    {"id": course_id},
                    {"$addToSet": {"enrolled_student_ids": contact_id}}
                )
            
            updated += 1
            new_emails_for_calendar.append(email)
            
        else:
            # Create new contact in Stage 2
            contact_id = str(uuid.uuid4())
            first_name = contact_data.get("firstname", "").strip()
            last_name = contact_data.get("lastname", "").strip()
            full_name = f"{first_name} {last_name}".strip() or email.split("@")[0]
            job_title = contact_data.get("jobtitle", "")
            
            # Classify buyer persona based on job title keywords
            buyer_persona = await classify_buyer_persona_by_job_title(job_title)
            
            new_contact = {
                "id": contact_id,
                "name": full_name,
                "first_name": first_name,
                "last_name": last_name,
                "email": email,
                "phone": contact_data.get("phone", ""),
                "stage": 2,  # New contacts go to Stage 2
                "company": contact_data.get("company", ""),
                "job_title": job_title,
                "buyer_persona": buyer_persona,
                "source": "webinar_import",
                "webinar_history": [webinar_entry],
                "created_at": now.isoformat(),
                "updated_at": now.isoformat()
            }
            
            await db.unified_contacts.insert_one(new_contact)
            
            # Auto-enroll in LMS course if enabled
            if auto_enroll and course_id:
                await db.lms_courses.update_one(
                    {"id": course_id},
                    {"$addToSet": {"enrolled_student_ids": contact_id}}
                )
            
            imported += 1
            new_emails_for_calendar.append(email)
    
    # Create Google Calendar events for new registrants
    calendar_event_ids = []
    if data.send_calendar_invite and new_emails_for_calendar:
        frontend_url = os.environ.get('REACT_APP_BACKEND_URL', 'https://persona-assets.preview.emergentagent.com')
        watching_room_url = f"{frontend_url}/lms/webinar/{event_id}"
        
        calendar_event_ids = await create_calendar_events_for_webinar(
            event_id=event_id,
            event_name=event.get("name"),
            event_description=event.get("description", ""),
            event_date=event.get("webinar_date"),
            event_time=event.get("webinar_time", "10:00"),
            watching_room_url=watching_room_url,
            attendee_emails=new_emails_for_calendar
        )
        
        # Save calendar event IDs to webinar
        if calendar_event_ids:
            await db.webinar_events_v2.update_one(
                {"id": event_id},
                {
                    "$addToSet": {"google_calendar_event_ids": {"$each": calendar_event_ids}},
                    "$set": {"updated_at": now.isoformat()}
                }
            )
    
    return {
        "success": True,
        "imported": imported,
        "updated": updated,
        "already_registered": already_registered,
        "total": len(data.contacts),
        "errors": errors[:10],
        "calendar_events_created": len(calendar_event_ids),
        "lms_enrolled": auto_enroll and course_id is not None
    }


# ============ HUBSPOT IMPORT FOR EXISTING EVENT ============

class HubSpotImportRequest(BaseModel):
    """Request to import contacts from HubSpot list to existing event"""
    hubspot_list_url: str
    import_type: str = "attended"  # "registered" or "attended"


# In-memory progress tracking for HubSpot imports
hubspot_import_progress = {}


async def import_hubspot_with_progress(event_id: str, event_name: str, list_url: str, import_type: str = "attended"):
    """
    Import contacts from HubSpot with progress tracking.
    Updates hubspot_import_progress dict in real-time.
    """
    import httpx
    
    # Initialize progress
    hubspot_import_progress[event_id] = {
        "status": "starting",
        "phase": "Obteniendo lista de HubSpot...",
        "total": 0,
        "processed": 0,
        "created": 0,
        "updated": 0,
        "errors": 0,
        "percent": 0
    }
    
    try:
        # Parse list ID
        list_id = parse_hubspot_list_url(list_url)
        if not list_id:
            hubspot_import_progress[event_id] = {
                "status": "error",
                "phase": "URL de HubSpot inválida",
                "error": "Could not parse HubSpot list URL"
            }
            return
        
        # Get contact IDs from list
        contact_ids = await get_hubspot_list_members(list_id)
        if not contact_ids:
            hubspot_import_progress[event_id] = {
                "status": "complete",
                "phase": "Lista vacía",
                "total": 0, "processed": 0, "created": 0, "updated": 0, "errors": 0, "percent": 100
            }
            return
        
        total = len(contact_ids)
        hubspot_import_progress[event_id].update({
            "status": "fetching",
            "phase": f"Obteniendo {total} contactos de HubSpot...",
            "total": total
        })
        
        # Fetch contact details in batches
        all_contacts = []
        batch_size = 100
        for i in range(0, len(contact_ids), batch_size):
            batch = contact_ids[i:i + batch_size]
            contacts = await get_hubspot_contacts_batch(batch)
            all_contacts.extend(contacts)
            hubspot_import_progress[event_id].update({
                "phase": f"Descargando contactos... ({len(all_contacts)}/{total})",
                "percent": int((len(all_contacts) / total) * 30)  # First 30% is fetching
            })
        
        # Process contacts
        hubspot_import_progress[event_id].update({
            "status": "importing",
            "phase": "Importando contactos...",
            "percent": 30
        })
        
        created = 0
        updated = 0
        errors = 0
        now = datetime.now(timezone.utc).isoformat()
        
        # Set status based on import_type
        status = "attended" if import_type == "attended" else "registered"
        
        webinar_entry = {
            "event_id": event_id,
            "event_name": event_name,
            "status": status,
            "registered_at": now,
            "attended_at": now if status == "attended" else None,
            "source": "hubspot_import"
        }
        
        for idx, contact in enumerate(all_contacts):
            try:
                props = contact.get("properties", {})
                hubspot_id = contact.get("id")
                
                primary_email = (props.get("email") or "").strip().lower()
                if not primary_email:
                    continue
                
                firstname = (props.get("firstname") or "").strip()
                lastname = (props.get("lastname") or "").strip()
                name = f"{firstname} {lastname}".strip() or "Sin nombre"
                
                # Check if exists
                existing = await db.unified_contacts.find_one({"email": primary_email})
                
                if existing:
                    # Update existing
                    existing_history = existing.get("webinar_history", [])
                    existing_event_entry = next((w for w in existing_history if w.get("event_id") == event_id), None)
                    
                    if existing_event_entry:
                        # Already has this event - update status if attending
                        if status == "attended" and existing_event_entry.get("status") == "registered":
                            # Upgrade from registered to attended
                            for i, w in enumerate(existing_history):
                                if w.get("event_id") == event_id:
                                    existing_history[i]["status"] = "attended"
                                    existing_history[i]["attended_at"] = now
                                    break
                            await db.unified_contacts.update_one(
                                {"email": primary_email}, 
                                {"$set": {"webinar_history": existing_history, "hubspot_id": hubspot_id, "updated_at": now}}
                            )
                            updated += 1
                    else:
                        # Add new event entry
                        update_data = {"updated_at": now, "hubspot_id": hubspot_id}
                        update_data["webinar_history"] = existing_history + [webinar_entry]
                        await db.unified_contacts.update_one({"email": primary_email}, {"$set": update_data})
                        updated += 1
                else:
                    # Create new - handle unique constraint
                    try:
                        company_name = (props.get("company") or "").strip()
                        job_title = (props.get("jobtitle") or "").strip()
                        phone = (props.get("phone") or "").strip()
                        
                        await db.unified_contacts.insert_one({
                            "id": str(uuid.uuid4()),
                            "hubspot_id": hubspot_id,
                            "name": name,
                            "first_name": firstname,
                            "last_name": lastname,
                            "email": primary_email,
                            "phone": phone,
                            "company": company_name,
                            "job_title": job_title,
                            "buyer_persona": "mateo",
                            "stage": 2,
                            "status": "active",
                            "source": "hubspot",
                            "webinar_history": [webinar_entry],
                            "created_at": now,
                            "updated_at": now
                        })
                        created += 1
                    except Exception as dup_err:
                        # Duplicate key - update instead
                        if "duplicate key" in str(dup_err).lower():
                            existing = await db.unified_contacts.find_one({"email": primary_email})
                            if existing:
                                existing_history = existing.get("webinar_history", [])
                                if not any(w.get("event_id") == event_id for w in existing_history):
                                    await db.unified_contacts.update_one(
                                        {"email": primary_email},
                                        {"$set": {"webinar_history": existing_history + [webinar_entry], "hubspot_id": hubspot_id}}
                                    )
                                    updated += 1
                        else:
                            errors += 1
                
                # Update progress every 10 contacts
                if idx % 10 == 0:
                    percent = 30 + int((idx / total) * 70)
                    hubspot_import_progress[event_id].update({
                        "phase": f"Importando... ({idx}/{total})",
                        "processed": idx,
                        "created": created,
                        "updated": updated,
                        "errors": errors,
                        "percent": percent
                    })
            except Exception as e:
                errors += 1
                logger.error(f"Error importing contact: {e}")
        
        # Complete
        hubspot_import_progress[event_id] = {
            "status": "complete",
            "phase": "¡Importación completada!",
            "total": total,
            "processed": total,
            "created": created,
            "updated": updated,
            "errors": errors,
            "percent": 100
        }
        
        # Update event with import info
        await db.webinar_events_v2.update_one(
            {"id": event_id},
            {"$set": {
                "last_hubspot_import": {
                    "url": list_url,
                    "result": {"created": created, "updated": updated, "total": total, "errors": errors},
                    "imported_at": now
                }
            }}
        )
        
        logger.info(f"HubSpot import complete for event {event_id}: {created} created, {updated} updated")
        
    except Exception as e:
        logger.error(f"HubSpot import error: {e}")
        hubspot_import_progress[event_id] = {
            "status": "error",
            "phase": "Error en importación",
            "error": str(e)
        }


@router.post("/{event_id}/import-hubspot")
async def import_hubspot_to_event(
    event_id: str,
    data: HubSpotImportRequest,
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(get_current_user)
):
    """
    Start HubSpot import in background and return immediately.
    Use GET /{event_id}/import-hubspot/progress to check progress.
    """
    from fastapi import BackgroundTasks
    
    # Verify event exists
    event = await db.webinar_events_v2.find_one({"id": event_id})
    if not event:
        raise HTTPException(status_code=404, detail="Evento no encontrado")
    
    event_name = event.get("name", "Event")
    
    # Check if import already in progress
    if event_id in hubspot_import_progress:
        current = hubspot_import_progress[event_id]
        if current.get("status") in ["starting", "fetching", "importing"]:
            return {
                "success": True,
                "message": "Import already in progress",
                "status": "in_progress",
                **current
            }
    
    # Start background import
    background_tasks.add_task(import_hubspot_with_progress, event_id, event_name, data.hubspot_list_url, data.import_type)
    
    return {
        "success": True,
        "message": "Import started in background",
        "status": "started",
        "import_type": data.import_type
    }


@router.get("/{event_id}/import-hubspot/progress")
async def get_hubspot_import_progress(
    event_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get current progress of HubSpot import for an event."""
    if event_id not in hubspot_import_progress:
        return {
            "status": "not_started",
            "phase": "No hay importación en progreso",
            "percent": 0
        }
    
    return hubspot_import_progress[event_id]


# ============ WATCHING ROOM ============

@router.get("/{event_id}/watching-room")
async def get_watching_room(
    event_id: str,
    contact_id: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Get watching room data for a webinar.
    Marks contact as attended and requires LMS enrollment.
    """
    event = await db.webinar_events_v2.find_one({"id": event_id}, {"_id": 0})
    if not event:
        raise HTTPException(status_code=404, detail="Evento no encontrado")
    
    # Verify contact exists and is enrolled
    contact = await db.unified_contacts.find_one({"id": contact_id}, {"_id": 0})
    if not contact:
        raise HTTPException(status_code=404, detail="Contacto no encontrado")
    
    course_id = event.get("course_id")
    if course_id:
        # Check if enrolled in LMS course
        course = await db.lms_courses.find_one({"id": course_id})
        if course and contact_id not in course.get("enrolled_student_ids", []):
            raise HTTPException(
                status_code=403, 
                detail="No estás inscrito en este curso. Por favor regístrate primero."
            )
    
    now = datetime.now(timezone.utc)
    
    # Mark as attended in webinar_history
    webinar_history = contact.get("webinar_history", [])
    found = False
    for wh in webinar_history:
        if wh.get("event_id") == event_id:
            found = True
            if wh.get("status") != "attended":
                wh["status"] = "attended"
                wh["attended_at"] = now.isoformat()
            wh["last_watch_ping"] = now.isoformat()
            break
    
    if not found:
        # Add new entry if not registered
        webinar_history.append({
            "event_id": event_id,
            "event_name": event.get("name"),
            "status": "attended",
            "registered_at": now.isoformat(),
            "attended_at": now.isoformat(),
            "watch_time_seconds": 0,
            "last_watch_ping": now.isoformat()
        })
    
    await db.unified_contacts.update_one(
        {"id": contact_id},
        {"$set": {"webinar_history": webinar_history, "updated_at": now.isoformat()}}
    )
    
    # Build YouTube embed URL
    embed_url = event.get("youtube_embed_url")
    if not embed_url:
        video_id = event.get("youtube_video_id") or event.get("youtube_broadcast_id")
        if video_id:
            embed_url = f"https://www.youtube.com/embed/{video_id}?autoplay=1"
    
    return {
        "event_id": event_id,
        "name": event.get("name"),
        "description": event.get("description"),
        "webinar_date": event.get("webinar_date"),
        "webinar_time": event.get("webinar_time"),
        "youtube_embed_url": embed_url,
        "banner_image": event.get("banner_image")
    }


@router.post("/{event_id}/watch-ping")
async def watch_ping(
    event_id: str,
    data: WatchPingRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Heartbeat endpoint to track watch time.
    Called every 30 seconds from the watching room.
    """
    contact = await db.unified_contacts.find_one({"id": data.contact_id})
    if not contact:
        raise HTTPException(status_code=404, detail="Contacto no encontrado")
    
    now = datetime.now(timezone.utc)
    webinar_history = contact.get("webinar_history", [])
    
    for wh in webinar_history:
        if wh.get("event_id") == event_id:
            last_ping = wh.get("last_watch_ping")
            if last_ping:
                try:
                    last_ping_dt = datetime.fromisoformat(last_ping.replace("Z", "+00:00"))
                    time_diff = (now - last_ping_dt).total_seconds()
                    # Only add time if ping is within reasonable interval (max 60 seconds)
                    if time_diff <= 60:
                        wh["watch_time_seconds"] = wh.get("watch_time_seconds", 0) + 30
                except Exception:
                    pass
            wh["last_watch_ping"] = now.isoformat()
            break
    
    await db.unified_contacts.update_one(
        {"id": data.contact_id},
        {"$set": {"webinar_history": webinar_history, "updated_at": now.isoformat()}}
    )
    
    # Get current watch time
    current_watch_time = 0
    for wh in webinar_history:
        if wh.get("event_id") == event_id:
            current_watch_time = wh.get("watch_time_seconds", 0)
            break
    
    return {
        "success": True,
        "watch_time_seconds": current_watch_time
    }


# ============ CONTACT WEBINAR HISTORY ============

@router.get("/contact/{contact_id}/history")
async def get_contact_webinar_history(
    contact_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get webinar participation history for a contact"""
    contact = await db.unified_contacts.find_one({"id": contact_id}, {"_id": 0})
    if not contact:
        raise HTTPException(status_code=404, detail="Contacto no encontrado")
    
    webinar_history = contact.get("webinar_history", [])
    
    # Enrich with event details
    enriched_history = []
    for wh in webinar_history:
        event = await db.webinar_events_v2.find_one(
            {"id": wh.get("event_id")},
            {"_id": 0, "name": 1, "webinar_date": 1, "banner_image": 1}
        )
        enriched_history.append({
            **wh,
            "event_details": event
        })
    
    return {
        "contact_id": contact_id,
        "contact_name": contact.get("name"),
        "webinar_history": enriched_history,
        "total_webinars": len(webinar_history),
        "attended_count": sum(1 for w in webinar_history if w.get("status") == "attended"),
        "total_watch_time": sum(w.get("watch_time_seconds", 0) for w in webinar_history)
    }

