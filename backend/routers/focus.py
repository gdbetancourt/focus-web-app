"""
Focus Router - Backend endpoints for the new Focus system

Handles:
- Traffic light status for all sections
- Weekly/daily check tracking
- Section-specific data endpoints
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, Dict
from datetime import datetime, timedelta, timezone
from database import db
from bson import ObjectId

router = APIRouter(prefix="/focus", tags=["Focus"])

# LinkedIn profiles for prospecting (fixed)
LINKEDIN_PROFILES = ["gb", "mg"]

# Section IDs
SECTIONS = [
    "max-linkedin-conexions",
    "import-new-connections",  # New LinkedIn import section
    "marketing-event-planning",  # New section for event planning with 4 placeholders
    "bulk-event-invitations",
    "import-registrants",
    "qualify-new-contacts",
    "personal-invitations",
    "assign-dm",
    "role-assignment",
    "merge-companies",  # Company merge candidates review
    "whatsapp-follow-up",
    "email-follow-up",
    "pre-projects",
    "youtube-ideas",
    "current-cases",  # Stage 4 Ganados - Weekly checklist tracking
    "merge-duplicates",
    "tasks-outside-system",
]

# Helper to get current week boundaries (Monday to Sunday)
def get_current_week_range():
    today = datetime.now()
    # Monday of current week
    monday = today - timedelta(days=today.weekday())
    monday = monday.replace(hour=0, minute=0, second=0, microsecond=0)
    # Sunday of current week
    sunday = monday + timedelta(days=6, hours=23, minutes=59, seconds=59)
    return monday, sunday

# Helper to get current quarter boundaries for daily tracking
def get_current_quarter_range():
    today = datetime.now()
    quarter = (today.month - 1) // 3
    quarter_start = datetime(today.year, quarter * 3 + 1, 1)
    if quarter == 3:
        quarter_end = datetime(today.year + 1, 1, 1) - timedelta(seconds=1)
    else:
        quarter_end = datetime(today.year, (quarter + 1) * 3 + 1, 1) - timedelta(seconds=1)
    return quarter_start, quarter_end


# ============================================
# Traffic Light Status
# ============================================

@router.get("/traffic-light-status")
async def get_traffic_light_status():
    """Get traffic light status for all sections"""
    status = {}
    
    for section_id in SECTIONS:
        try:
            # Get section-specific status based on rules
            status[section_id] = await calculate_section_status(section_id)
        except Exception as e:
            print(f"Error calculating status for {section_id}: {e}")
            status[section_id] = "gray"
    
    return status


async def calculate_section_status(section_id: str) -> str:
    """Calculate traffic light status for a specific section"""
    monday, sunday = get_current_week_range()
    today = datetime.now()
    today_start = today.replace(hour=0, minute=0, second=0, microsecond=0)
    today_end = today_start + timedelta(days=1) - timedelta(seconds=1)
    
    # Section-specific logic
    if section_id == "max-linkedin-conexions":
        return await calculate_max_linkedin_status()
    
    elif section_id == "import-new-connections":
        from routers.linkedin_import import calculate_import_new_connections_status
        return await calculate_import_new_connections_status()
    
    elif section_id == "marketing-event-planning":
        return await calculate_marketing_event_planning_status()
    
    elif section_id == "bulk-event-invitations":
        return await calculate_bulk_invitations_status()
    
    elif section_id == "import-registrants":
        return await calculate_import_registrants_status()
    
    elif section_id == "qualify-new-contacts":
        return await calculate_qualify_contacts_status()
    
    elif section_id == "personal-invitations":
        return await calculate_personal_invitations_status()
    
    elif section_id == "assign-dm":
        return await calculate_assign_dm_status()
    
    elif section_id == "role-assignment":
        return await calculate_role_assignment_status()
    
    elif section_id == "merge-companies":
        return await calculate_merge_companies_status()
    
    elif section_id == "whatsapp-follow-up":
        return await calculate_whatsapp_status()
    
    elif section_id == "email-follow-up":
        return await calculate_email_status()
    
    elif section_id == "pre-projects":
        return await calculate_pre_projects_status()
    
    elif section_id == "current-cases":
        return await calculate_current_cases_status()
    
    elif section_id == "tasks-outside-system":
        return await calculate_tasks_status()
    
    return "gray"


# ============================================
# Max LinkedIn Conexions
# ============================================

class ProfileCheckRequest(BaseModel):
    profile_id: str
    checked: bool

@router.get("/max-linkedin/weekly-checks")
async def get_max_linkedin_weekly_checks():
    """Get weekly profile check status for Max LinkedIn Conexions"""
    monday, sunday = get_current_week_range()
    
    # Get checks for this week
    checks_doc = await db.focus_checks.find_one({
        "section": "max-linkedin-conexions",
        "week_start": monday
    })
    
    # Build response
    checks = {}
    for profile in LINKEDIN_PROFILES:
        checks[profile] = checks_doc.get("profiles", {}).get(profile, False) if checks_doc else False
    
    # Calculate status
    checked_count = sum(1 for v in checks.values() if v)
    if checked_count == 0:
        status = "red"
    elif checked_count < len(LINKEDIN_PROFILES):
        status = "yellow"
    else:
        status = "green"
    
    return {
        "checks": checks,
        "status": status,
        "week_start": monday.isoformat(),
        "week_end": sunday.isoformat()
    }


@router.post("/max-linkedin/toggle-check")
async def toggle_max_linkedin_check(request: ProfileCheckRequest):
    """Toggle a profile check for Max LinkedIn Conexions"""
    if request.profile_id not in LINKEDIN_PROFILES:
        raise HTTPException(status_code=400, detail=f"Invalid profile: {request.profile_id}")
    
    monday, sunday = get_current_week_range()
    
    # Upsert the check
    result = await db.focus_checks.update_one(
        {
            "section": "max-linkedin-conexions",
            "week_start": monday
        },
        {
            "$set": {
                f"profiles.{request.profile_id}": request.checked,
                "updated_at": datetime.now()
            },
            "$setOnInsert": {
                "created_at": datetime.now()
            }
        },
        upsert=True
    )
    
    # Get updated status
    checks_doc = await db.focus_checks.find_one({
        "section": "max-linkedin-conexions", 
        "week_start": monday
    })
    
    checks = checks_doc.get("profiles", {}) if checks_doc else {}
    checked_count = sum(1 for p in LINKEDIN_PROFILES if checks.get(p, False))
    
    if checked_count == 0:
        status = "red"
    elif checked_count < len(LINKEDIN_PROFILES):
        status = "yellow"
    else:
        status = "green"
    
    return {
        "success": True,
        "status": status,
        "profile_id": request.profile_id,
        "checked": request.checked
    }


async def calculate_max_linkedin_status() -> str:
    """Calculate status for Max LinkedIn Conexions section"""
    monday, _ = get_current_week_range()
    
    checks_doc = await db.focus_checks.find_one({
        "section": "max-linkedin-conexions",
        "week_start": monday
    })
    
    if not checks_doc:
        return "red"
    
    checks = checks_doc.get("profiles", {})
    checked_count = sum(1 for p in LINKEDIN_PROFILES if checks.get(p, False))
    
    if checked_count == 0:
        return "red"
    elif checked_count < len(LINKEDIN_PROFILES):
        return "yellow"
    return "green"


# ============================================
# Marketing Event Planning
# ============================================

# Event categories
EVENT_CATEGORIES = ["dominant_industry", "leadership", "sales", "thought_leadership"]

async def calculate_marketing_event_planning_status() -> str:
    """
    Status based on 4 event category placeholders.
    
    Rules:
    - RED: No upcoming events in any category
    - YELLOW: Upcoming events in some categories but not all 4
    - GREEN: All 4 categories have at least one upcoming event
    """
    from datetime import date
    today = date.today().isoformat()
    
    # Get all future events with their categories
    events = await db.webinar_events_v2.find(
        {"webinar_date": {"$gte": today}},
        {"_id": 0, "category": 1}
    ).to_list(500)
    
    # Count categories with events
    categories_with_events = set()
    for event in events:
        cat = event.get("category")
        if cat in EVENT_CATEGORIES:
            categories_with_events.add(cat)
    
    num_categories = len(categories_with_events)
    
    if num_categories == 0:
        return "red"
    elif num_categories < 4:
        return "yellow"
    return "green"


# ============================================
# Bulk Event Invitations
# ============================================

async def calculate_bulk_invitations_status() -> str:
    """
    Status based on event invitations this week.
    
    Rules:
    - RED: 0 events with invitations this week
    - YELLOW: At least one event with invitations, but not all available events
    - GREEN: ALL available events have received invitations this week
    """
    from datetime import datetime
    
    # Get current ISO week
    current_week = datetime.now().strftime("%Y-W%V")
    
    # Get all available events (future events that can receive invitations)
    today = datetime.now().strftime("%Y-%m-%d")
    available_events = await db.webinar_events_v2.distinct(
        "id",
        {"webinar_date": {"$gte": today}}
    )
    total_available = len(available_events)
    
    # If no events available, show green (nothing to do)
    if total_available == 0:
        return "green"
    
    # Count distinct events that have received invitations this week
    events_with_invitations = await db.event_company_invitations.distinct(
        "event_id",
        {"last_invited_week": current_week}
    )
    events_invited_count = len(events_with_invitations)
    
    if events_invited_count == 0:
        return "red"
    elif events_invited_count < total_available:
        return "yellow"
    return "green"


# ============================================
# Import Registrants
# ============================================

async def calculate_import_registrants_status() -> str:
    """
    Status based on registrant imports this week.
    
    Rules:
    - RED: 0 events with registrants imported this week
    - YELLOW: At least one event with imports, but not all available events
    - GREEN: ALL available events have registrants imported this week
    """
    from datetime import datetime
    
    # Get current ISO week
    current_week = datetime.now().strftime("%Y-W%V")
    today = datetime.now().strftime("%Y-%m-%d")
    
    # Get all available events (future events)
    available_events = await db.webinar_events_v2.find(
        {"webinar_date": {"$gte": today}},
        {"_id": 0, "id": 1, "last_import_week": 1}
    ).to_list(100)
    
    total_available = len(available_events)
    
    # If no events available, show green (nothing to do)
    if total_available == 0:
        return "green"
    
    # Count events that have been imported this week
    events_imported_count = sum(
        1 for e in available_events 
        if e.get("last_import_week") == current_week
    )
    
    if events_imported_count == 0:
        return "red"
    elif events_imported_count < total_available:
        return "yellow"
    return "green"


# ============================================
# Qualify New Contacts
# ============================================

async def calculate_qualify_contacts_status() -> str:
    """
    Status based on contact qualification for OUTBOUND contacts.
    
    Goal: Qualify ALL pending outbound contacts (no fixed weekly number).
    Only considers contacts that:
    - Are in Stage 1 or 2
    - Have qualification_status = "pending" or field doesn't exist
    - AND meet at least ONE of:
      - Contact has classification: "outbound"
      - Contact is associated with a company that has classification: "outbound"
    
    Rules:
    - GREEN: Zero contacts pending qualification
    - YELLOW: At least one qualified this week, but still have pending
    - RED: No contacts qualified this week AND there are pending contacts
    """
    from datetime import datetime, timedelta
    
    # Get list of outbound company names for filtering
    outbound_companies = await db.unified_companies.find(
        {"classification": "outbound", "is_merged": False},
        {"_id": 0, "name": 1}
    ).to_list(2000)
    outbound_company_names = [c["name"] for c in outbound_companies if c.get("name")]
    
    # Filter for outbound contacts in Stage 1 or 2 with pending qualification
    outbound_pending_filter = {
        "stage": {"$in": [1, 2]},
        "$or": [
            {"qualification_status": "pending"},
            {"qualification_status": {"$exists": False}},
            {"qualification_status": "postponed"}
        ],
        "discarded_at": {"$exists": False},
        "$and": [
            {"$or": [
                {"classification": "outbound"},
                {"company": {"$in": outbound_company_names}}
            ]}
        ]
    }
    
    # Count pending contacts
    pending_count = await db.unified_contacts.count_documents(outbound_pending_filter)
    
    # If no pending contacts, we're green!
    if pending_count == 0:
        return "green"
    
    # Count contacts qualified THIS WEEK (outbound only, excluding Mateo/Ramona)
    monday, sunday = get_current_week_range()
    monday_str = monday.isoformat() if hasattr(monday, 'isoformat') else str(monday)
    
    qualified_this_week = await db.unified_contacts.count_documents({
        "stage": {"$in": [1, 2]},
        "qualification_status": "qualified",
        "qualification_date": {"$gte": monday_str},
        "buyer_persona": {"$nin": ["mateo", "ramona"]},
        "$or": [
            {"classification": "outbound"},
            {"company": {"$in": outbound_company_names}}
        ]
    })
    
    if qualified_this_week > 0:
        return "yellow"  # Some progress but still have pending
    return "red"  # No progress this week and have pending


# ============================================
# Personal Invitations (Ice Breaker)
# ============================================

async def calculate_personal_invitations_status() -> str:
    """
    Status based on ice breaker searches and LinkedIn contacts.
    
    Rules:
    - RED: There are ready searches (≥14 days) or contacts due today, and nothing has been done
    - YELLOW: Some activities done but there are still pending items
    - GREEN: All ready searches completed AND all contacts for today processed
    """
    from datetime import datetime, timedelta, timezone
    
    now = datetime.now(timezone.utc)
    today = now.date().isoformat()
    eight_days_ago = (now - timedelta(days=8)).isoformat()
    
    # PART 1: Ice Breaker Searches (ready after 14 days)
    searches = await db.linkedin_searches.find(
        {"last_prospected_at": {"$exists": True, "$ne": None}},
        {"_id": 0, "last_prospected_at": 1, "ice_breaker_done_at": 1}
    ).to_list(500)
    
    searches_ready = 0
    searches_done = 0
    
    for s in searches:
        prospected_at_str = s.get("last_prospected_at")
        if not prospected_at_str:
            continue
        try:
            if prospected_at_str.endswith('Z'):
                prospected_at = datetime.fromisoformat(prospected_at_str.replace('Z', '+00:00'))
            elif '+' in prospected_at_str:
                prospected_at = datetime.fromisoformat(prospected_at_str)
            else:
                prospected_at = datetime.fromisoformat(prospected_at_str).replace(tzinfo=timezone.utc)
        except:
            continue
        
        ready_date = prospected_at + timedelta(days=14)
        is_ready = now >= ready_date
        
        if not is_ready:
            continue  # Not ready yet, skip
        
        # Check if done for this cycle
        ice_breaker_done_at = s.get("ice_breaker_done_at")
        is_done = False
        if ice_breaker_done_at:
            try:
                if ice_breaker_done_at.endswith('Z'):
                    done_at = datetime.fromisoformat(ice_breaker_done_at.replace('Z', '+00:00'))
                elif '+' in ice_breaker_done_at:
                    done_at = datetime.fromisoformat(ice_breaker_done_at)
                else:
                    done_at = datetime.fromisoformat(ice_breaker_done_at).replace(tzinfo=timezone.utc)
                is_done = done_at > prospected_at
            except:
                pass
        
        if is_done:
            searches_done += 1
        else:
            searches_ready += 1
    
    # PART 2: LinkedIn Contacts (due every 8 days)
    # Contacts that need to be messaged (qualified, 8+ days since last contact)
    contacts_due = await db.unified_contacts.count_documents({
        "stage": {"$in": [1, 2]},
        "qualification_status": "qualified",
        "$or": [
            {"last_contacted_linkedin": {"$exists": False}},
            {"last_contacted_linkedin": None},
            {"last_contacted_linkedin": {"$lt": eight_days_ago}}
        ]
    })
    
    # Contacts processed today
    contacts_done_today = await db.unified_contacts.count_documents({
        "stage": {"$in": [1, 2]},
        "qualification_status": "qualified",
        "last_contacted_linkedin": {"$gte": today}
    })
    
    # Determine status
    total_pending = searches_ready + contacts_due
    total_done = searches_done + contacts_done_today
    
    if total_pending == 0:
        return "green"  # All complete
    elif total_done > 0:
        return "yellow"  # Some done, more to do
    return "red"  # Nothing done, things pending


# ============================================
# Assign DM
# ============================================

async def calculate_assign_dm_status() -> str:
    """Status based on cases without deal makers in Stage 3 and 4"""
    cases_without_dm = await db.cases.count_documents({
        "current_stage": {"$in": [3, 4]},
        "$or": [
            {"deal_maker_id": None},
            {"deal_maker_id": ""},
            {"deal_maker_id": {"$exists": False}}
        ]
    })
    
    if cases_without_dm == 0:
        return "green"
    
    monday, sunday = get_current_week_range()
    assignments_this_week = await db.cases.count_documents({
        "current_stage": {"$in": [3, 4]},
        "deal_maker_id": {"$ne": None, "$exists": True},
        "updated_at": {"$gte": monday, "$lte": sunday}
    })
    
    if assignments_this_week > 0:
        return "yellow"
    return "red"


# ============================================
# Role Assignment
# ============================================

async def calculate_role_assignment_status() -> str:
    """Status based on contacts without roles in Stage 3, 4, 5"""
    contacts_without_roles = await db.unified_contacts.count_documents({
        "current_stage": {"$in": [3, 4, 5]},
        "$or": [
            {"assigned_role": None},
            {"assigned_role": ""},
            {"assigned_role": {"$exists": False}}
        ]
    })
    
    if contacts_without_roles == 0:
        return "green"
    
    monday, sunday = get_current_week_range()
    assignments_this_week = await db.unified_contacts.count_documents({
        "current_stage": {"$in": [3, 4, 5]},
        "assigned_role": {"$ne": None, "$exists": True},
        "updated_at": {"$gte": monday, "$lte": sunday}
    })
    
    if assignments_this_week > 0:
        return "yellow"
    return "red"


# ============================================
# WhatsApp Follow Up (Daily)
# ============================================

async def calculate_whatsapp_status() -> str:
    """
    Daily status based on WhatsApp messages sent today via the new whatsapp_queue.
    - Red: No messages sent today (but there are pending)
    - Yellow: Some messages sent but more pending
    - Green: All today's messages have been sent (no pending)
    """
    today = datetime.now(timezone.utc)
    today_start = today.replace(hour=0, minute=0, second=0, microsecond=0)
    today_end = today_start + timedelta(days=1) - timedelta(seconds=1)
    
    # Get pending WhatsApp messages from new queue
    pending_count = await db.whatsapp_queue.count_documents({
        "status": "pending"
    })
    
    # Get sent messages today from whatsapp_logs
    sent_today = await db.whatsapp_logs.count_documents({
        "status": "sent",
        "sent_at": {"$gte": today_start.isoformat(), "$lte": today_end.isoformat()}
    })
    
    # Traffic light rules
    if pending_count == 0:
        return "green"
    elif sent_today > 0:
        return "yellow"
    return "red"


# ============================================
# Email Follow Up (Daily)
# ============================================

async def calculate_email_status() -> str:
    """
    Daily status based on emails sent today via the email queue.
    - Red: No messages sent today (but there are pending)
    - Yellow: Some messages sent but more pending
    - Green: All today's messages have been sent (no pending)
    """
    today = datetime.now(timezone.utc)
    today_start = today.replace(hour=0, minute=0, second=0, microsecond=0)
    today_end = today_start + timedelta(days=1) - timedelta(seconds=1)
    
    # Get pending emails scheduled for today or earlier (including those without scheduled_at)
    pending_count = await db.email_queue.count_documents({
        "status": "pending",
        "$or": [
            {"scheduled_at": {"$lte": today_end.isoformat()}},
            {"scheduled_at": {"$exists": False}},
            {"scheduled_at": None}
        ]
    })
    
    # Get sent emails today from email_logs
    sent_today = await db.email_logs.count_documents({
        "status": "sent",
        "sent_at": {"$gte": today_start.isoformat(), "$lte": today_end.isoformat()}
    })
    
    # Traffic light rules:
    # Green: All messages sent (no pending)
    # Yellow: Some sent but more pending
    # Red: None sent today (but there are pending)
    
    if pending_count == 0:
        return "green"
    elif sent_today > 0:
        return "yellow"
    else:
        return "red"


# ============================================
# Pre-projects (Daily)
# ============================================

async def calculate_pre_projects_status() -> str:
    """Daily status based on quotes/pre-projects processed today"""
    today = datetime.now()
    today_start = today.replace(hour=0, minute=0, second=0, microsecond=0)
    today_end = today_start + timedelta(days=1) - timedelta(seconds=1)
    
    # Cases waiting for quotes
    pending_quotes = await db.cases.count_documents({
        "current_stage": 3,
        "quote_status": {"$in": [None, "pending", "requested"]}
    })
    
    # Quotes created today
    quotes_today = await db.cases.count_documents({
        "quote_created_at": {"$gte": today_start, "$lte": today_end}
    })
    
    if pending_quotes == 0:
        return "green"
    elif quotes_today > 0:
        return "yellow"
    return "red"


# ============================================
# Tasks Outside System (Daily)
# ============================================

async def calculate_tasks_status() -> str:
    """Daily status based on tasks due today"""
    today = datetime.now()
    today_start = today.replace(hour=0, minute=0, second=0, microsecond=0)
    today_end = today_start + timedelta(days=1) - timedelta(seconds=1)
    
    # Tasks due today
    pending_tasks = await db.tasks.count_documents({
        "due_date": {"$lte": today_end},
        "status": {"$ne": "completed"}
    })
    
    # Tasks completed today
    completed_today = await db.tasks.count_documents({
        "status": "completed",
        "completed_at": {"$gte": today_start, "$lte": today_end}
    })
    
    if pending_tasks == 0:
        return "green"
    elif completed_today > 0:
        return "yellow"
    return "red"



# ============================================
# Current Cases (Stage 4 Ganados) - Weekly
# ============================================

async def calculate_current_cases_status() -> str:
    """
    Calculate traffic light status for Current Cases section (Stage 4 Ganados).
    
    CRITICAL: Gray is NOT allowed for the current week.
    
    Definition of "pending task": unchecked AND due_date <= today (date-only comparison)
    
    Rules per project:
    1. First determine if project has PENDING tasks
    2. If NO pending tasks → project is GREEN (no work to do)
       - This includes: no columns/tasks, all checked, or unchecked but due in future
    3. If pending tasks exist:
       - YELLOW if at least one checkbox was checked this ISO week
       - RED if no checkbox was checked this ISO week
    
    Section aggregation:
    - If any project is RED → section is RED
    - Else if any project is YELLOW → section is YELLOW  
    - Else → section is GREEN
    
    IMPORTANT: A task only exists if there's an active column.
    We count tasks only for contacts that are in the case's contact list.
    """
    now = datetime.now(timezone.utc)
    
    # Get current ISO week boundaries
    iso_year, iso_week, _ = now.isocalendar()
    week_start = datetime.fromisocalendar(iso_year, iso_week, 1).replace(
        hour=0, minute=0, second=0, microsecond=0, tzinfo=timezone.utc
    )
    week_end = week_start + timedelta(days=7)
    
    # Today at start of day (for due date comparison - date only)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    
    # Fetch eligible cases (Stage 4 "ganados" with status "active")
    cases = await db.cases.find(
        {"stage": "ganados", "status": "active"},
        {"_id": 0, "id": 1, "contact_ids": 1}
    ).to_list(500)
    
    # If no eligible cases → GREEN (no work to do)
    if not cases:
        return "green"
    
    project_statuses = []
    
    for case in cases:
        case_id = case.get("id")
        contact_ids = case.get("contact_ids", [])
        contact_ids_set = set(contact_ids) if contact_ids else set()
        
        # Get checklist data for this case
        checklist_data = await db.case_checklists.find_one(
            {"case_id": case_id},
            {"_id": 0}
        )
        
        checklist = checklist_data.get("groups", {}) if checklist_data else {}
        
        # Calculate project status
        has_pending_tasks = False
        has_activity_this_week = False
        
        for group_id, group_data in checklist.items():
            columns = group_data.get("columns", [])
            cells = group_data.get("cells", {})
            
            # Filter out deleted columns - only active columns count
            active_columns = [col for col in columns if not col.get("deleted")]
            
            # No active columns = no tasks for this group
            if not active_columns:
                continue
            
            for col in active_columns:
                col_id = col.get("id")
                col_due_date = col.get("due_date")
                
                # Parse due date
                due_dt = None
                if col_due_date:
                    try:
                        due_dt = datetime.fromisoformat(col_due_date.replace("Z", "+00:00"))
                    except (ValueError, TypeError):
                        pass
                
                # Only check cells for contacts that are actually in this case
                for contact_id in contact_ids_set:
                    contact_cells = cells.get(contact_id, {})
                    cell = contact_cells.get(col_id)
                    
                    # If no cell exists for this contact+column, it means the task hasn't been interacted with
                    # This counts as an unchecked task
                    if cell is None:
                        # Check if this is a PENDING task (unchecked AND due today or earlier)
                        if due_dt and due_dt <= today_start:
                            has_pending_tasks = True
                    elif cell.get("checked"):
                        # Check if checked this ISO week
                        checked_at = cell.get("checked_at")
                        if checked_at:
                            try:
                                checked_dt = datetime.fromisoformat(checked_at.replace("Z", "+00:00"))
                                if week_start <= checked_dt < week_end:
                                    has_activity_this_week = True
                            except (ValueError, TypeError):
                                pass
                    else:
                        # Cell exists but is unchecked
                        # Check if PENDING (due today or earlier)
                        if due_dt and due_dt <= today_start:
                            has_pending_tasks = True
        
        # Determine project status
        # Rule: If no pending tasks → GREEN (regardless of activity)
        if not has_pending_tasks:
            # No pending work → GREEN
            # This covers: no tasks, all checked, or unchecked but due in future
            project_status = "green"
        elif has_activity_this_week:
            # Pending work exists and team started this week → YELLOW
            project_status = "yellow"
        else:
            # Pending work exists and no activity this week → RED
            project_status = "red"
        
        project_statuses.append(project_status)
    
    # Aggregate section status
    # Priority: RED > YELLOW > GREEN
    if "red" in project_statuses:
        return "red"
    elif "yellow" in project_statuses:
        return "yellow"
    else:
        return "green"



# ============================================
# Merge Companies Status
# ============================================

async def calculate_merge_companies_status():
    """
    Calculate traffic light status for Merge Companies section.
    
    OPTIMIZED: Uses pre-computed cache instead of expensive real-time calculations.
    
    Rules:
    - Red: There are candidates "to review" and 0 reviewed this week
    - Yellow: There are candidates "to review" and >0 reviewed this week
    - Green: 0 candidates "to review"
    - Gray: Cache not available (needs refresh)
    """
    from services.merge_candidates_cache import get_cached_counts
    
    # Get current ISO week boundaries
    now = datetime.now(timezone.utc)
    iso_cal = now.isocalendar()
    iso_year, iso_week = iso_cal.year, iso_cal.week
    
    jan4 = datetime(iso_year, 1, 4, tzinfo=timezone.utc)
    start_of_week1 = jan4 - timedelta(days=jan4.weekday())
    week_start = start_of_week1 + timedelta(weeks=iso_week - 1)
    week_end = week_start + timedelta(days=7)
    
    try:
        # Get counts from pre-computed cache (fast!)
        cache_counts = await get_cached_counts(db)
        
        if not cache_counts.get("cache_exists"):
            # Cache doesn't exist, return gray to indicate needs setup
            return "gray"
        
        pending_count = cache_counts.get("total_count", 0)
        
        # Count merges done this week from unified_companies.merged_at
        merges_this_week = await db.unified_companies.count_documents({
            "is_merged": True,
            "merged_at": {"$gte": week_start.isoformat(), "$lt": week_end.isoformat()}
        })
        
        # Also count dismissed candidates this week
        dismissed_this_week = await db.merge_candidate_reviews.count_documents({
            "reviewed_at": {"$gte": week_start, "$lt": week_end}
        })
        
        total_reviewed = merges_this_week + dismissed_this_week
        
        # Determine status
        if pending_count == 0:
            return "green"
        elif total_reviewed == 0:
            return "red"
        else:
            return "yellow"
    except Exception as e:
        print(f"Error calculating merge-companies status: {e}")
        return "gray"
