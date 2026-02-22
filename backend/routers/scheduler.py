"""
Scheduler Router - Manages automatic search schedules
"""
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timezone, timedelta
from database import db
from routers.auth import get_current_user
import uuid

router = APIRouter(prefix="/scheduler", tags=["scheduler"])


# Schedule frequency options (in days)
FREQUENCY_OPTIONS = {
    "daily": 1,
    "weekly": 7,
    "biweekly": 15,
    "monthly": 30,
    "bimonthly": 60,
    "quarterly": 90,
    "semiannual": 180,
    "annual": 365
}


class ScheduleCreate(BaseModel):
    schedule_type: str  # "business_unit", "keyword", "buyer_persona", "small_business", "medical_society", "pharma_pipeline"
    entity_id: str  # ID of the entity being scheduled
    entity_name: str  # Human readable name
    frequency: str  # "daily", "weekly", "biweekly", "monthly", etc.
    params: dict = {}  # Additional parameters for the search


class ScheduleUpdate(BaseModel):
    frequency: Optional[str] = None
    active: Optional[bool] = None
    params: Optional[dict] = None


# ============ SCHEDULE CRUD ============

@router.get("/schedules")
async def list_schedules(
    schedule_type: Optional[str] = None,
    active_only: bool = True,
    current_user: dict = Depends(get_current_user)
):
    """List all search schedules"""
    query = {}
    if schedule_type:
        query["schedule_type"] = schedule_type
    if active_only:
        query["active"] = True
    
    schedules = await db.search_schedules.find(query, {"_id": 0}).sort("next_run", 1).to_list(500)
    
    return {"schedules": schedules, "total": len(schedules)}


@router.get("/schedules/{schedule_id}")
async def get_schedule(
    schedule_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get a specific schedule"""
    schedule = await db.search_schedules.find_one({"id": schedule_id}, {"_id": 0})
    if not schedule:
        raise HTTPException(status_code=404, detail="Schedule not found")
    return schedule


@router.post("/schedules")
async def create_schedule(
    data: ScheduleCreate,
    current_user: dict = Depends(get_current_user)
):
    """Create a new search schedule or update existing one"""
    if data.frequency not in FREQUENCY_OPTIONS:
        raise HTTPException(status_code=400, detail=f"Invalid frequency. Options: {list(FREQUENCY_OPTIONS.keys())}")
    
    now = datetime.now(timezone.utc)
    frequency_days = FREQUENCY_OPTIONS[data.frequency]
    
    # Check if schedule already exists for this entity
    existing = await db.search_schedules.find_one({
        "schedule_type": data.schedule_type,
        "entity_id": data.entity_id
    })
    
    if existing:
        # Update existing schedule - set last_run to now and calculate next_run
        next_run = now + timedelta(days=frequency_days)
        await db.search_schedules.update_one(
            {"id": existing["id"]},
            {"$set": {
                "frequency": data.frequency,
                "frequency_days": frequency_days,
                "params": data.params,
                "active": True,
                "last_run": now.isoformat(),
                "last_run_status": "running",
                "next_run": next_run.isoformat(),
                "updated_at": now.isoformat()
            }}
        )
        updated = await db.search_schedules.find_one({"id": existing["id"]}, {"_id": 0})
        return {"success": True, "schedule": updated, "action": "updated"}
    
    schedule_doc = {
        "id": str(uuid.uuid4()),
        "schedule_type": data.schedule_type,
        "entity_id": data.entity_id,
        "entity_name": data.entity_name,
        "frequency": data.frequency,
        "frequency_days": frequency_days,
        "params": data.params,
        "active": True,
        "last_run": None,
        "last_run_status": None,
        "last_run_results": None,
        "next_run": now.isoformat(),  # Run immediately first time
        "created_by": current_user.get("email"),
        "created_at": now.isoformat(),
        "updated_at": now.isoformat()
    }
    
    await db.search_schedules.insert_one(schedule_doc)
    schedule_doc.pop("_id", None)
    
    return {"success": True, "schedule": schedule_doc, "action": "created"}


@router.put("/schedules/{schedule_id}")
async def update_schedule(
    schedule_id: str,
    data: ScheduleUpdate,
    current_user: dict = Depends(get_current_user)
):
    """Update a schedule"""
    update_data = {}
    
    if data.frequency is not None:
        if data.frequency not in FREQUENCY_OPTIONS:
            raise HTTPException(status_code=400, detail=f"Invalid frequency. Options: {list(FREQUENCY_OPTIONS.keys())}")
        update_data["frequency"] = data.frequency
        update_data["frequency_days"] = FREQUENCY_OPTIONS[data.frequency]
    
    if data.active is not None:
        update_data["active"] = data.active
    
    if data.params is not None:
        update_data["params"] = data.params
    
    if not update_data:
        raise HTTPException(status_code=400, detail="No data to update")
    
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    result = await db.search_schedules.update_one(
        {"id": schedule_id},
        {"$set": update_data}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Schedule not found")
    
    return {"success": True}


@router.delete("/schedules/{schedule_id}")
async def delete_schedule(
    schedule_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Delete a schedule"""
    result = await db.search_schedules.delete_one({"id": schedule_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Schedule not found")
    return {"success": True}


# ============ SCHEDULE STATUS ============

@router.get("/status")
async def get_scheduler_status(
    current_user: dict = Depends(get_current_user)
):
    """Get overall scheduler status for navigation indicators"""
    now = datetime.now(timezone.utc)
    
    # Get all active schedules
    schedules = await db.search_schedules.find({"active": True}, {"_id": 0}).to_list(500)
    
    status = {
        "business_units": {"status": "ok", "overdue": 0, "total": 0, "last_error": None},
        "keywords": {"status": "ok", "overdue": 0, "total": 0, "last_error": None},
        "buyer_personas": {"status": "ok", "overdue": 0, "total": 0, "last_error": None},
        "small_business": {"status": "ok", "overdue": 0, "total": 0, "last_error": None}
    }
    
    type_mapping = {
        "business_unit": "business_units",
        "keyword": "keywords",
        "buyer_persona": "buyer_personas",
        "small_business": "small_business"
    }
    
    for schedule in schedules:
        schedule_type = type_mapping.get(schedule.get("schedule_type"), "business_units")
        status[schedule_type]["total"] += 1
        
        # Check if overdue (more than 1 day past next_run)
        if schedule.get("next_run"):
            next_run = datetime.fromisoformat(schedule["next_run"].replace("Z", "+00:00"))
            if now > next_run + timedelta(days=1):
                status[schedule_type]["overdue"] += 1
                status[schedule_type]["status"] = "attention"
        
        # Check for errors
        if schedule.get("last_run_status") == "failed":
            status[schedule_type]["status"] = "attention"
            status[schedule_type]["last_error"] = schedule.get("last_run_error")
    
    return status


@router.get("/status/{schedule_type}")
async def get_type_status(
    schedule_type: str,
    current_user: dict = Depends(get_current_user)
):
    """Get status for a specific schedule type"""
    now = datetime.now(timezone.utc)
    
    schedules = await db.search_schedules.find(
        {"schedule_type": schedule_type, "active": True},
        {"_id": 0}
    ).to_list(500)
    
    overdue = 0
    failed = 0
    pending = 0
    completed = 0
    
    for schedule in schedules:
        if schedule.get("next_run"):
            next_run = datetime.fromisoformat(schedule["next_run"].replace("Z", "+00:00"))
            if now > next_run:
                overdue += 1
        
        if schedule.get("last_run_status") == "failed":
            failed += 1
        elif schedule.get("last_run_status") == "completed":
            completed += 1
        else:
            pending += 1
    
    return {
        "schedule_type": schedule_type,
        "total": len(schedules),
        "overdue": overdue,
        "failed": failed,
        "pending": pending,
        "completed": completed,
        "status": "attention" if (overdue > 0 or failed > 0) else "ok"
    }


# ============ MANUAL TRIGGER ============

@router.post("/run/{schedule_id}")
async def trigger_schedule(
    schedule_id: str,
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(get_current_user)
):
    """Manually trigger a scheduled search"""
    schedule = await db.search_schedules.find_one({"id": schedule_id}, {"_id": 0})
    if not schedule:
        raise HTTPException(status_code=404, detail="Schedule not found")
    
    # Mark as running
    await db.search_schedules.update_one(
        {"id": schedule_id},
        {"$set": {"last_run_status": "running", "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    return {"success": True, "message": "Search triggered", "schedule": schedule}


# ============ SUMMARY STATS ============

@router.get("/summary/{schedule_type}")
async def get_search_summary(
    schedule_type: str,
    current_user: dict = Depends(get_current_user)
):
    """Get summary of deal makers found from recent searches"""
    # Get recent runs for this type
    runs = await db.scraper_runs.find(
        {"scrapper_id": {"$regex": schedule_type, "$options": "i"}},
        {"_id": 0}
    ).sort("started_at", -1).limit(50).to_list(50)
    
    total_dms_found = 0
    total_searches = len(runs)
    successful_searches = 0
    failed_searches = 0
    
    for run in runs:
        if run.get("status") == "completed":
            successful_searches += 1
            results = run.get("results", {})
            total_dms_found += results.get("deal_makers_added", 0) or results.get("results_count", 0) or 0
        elif run.get("status") == "failed":
            failed_searches += 1
    
    return {
        "schedule_type": schedule_type,
        "total_searches": total_searches,
        "successful_searches": successful_searches,
        "failed_searches": failed_searches,
        "total_deal_makers_found": total_dms_found
    }


@router.get("/history/{entity_id}")
async def get_entity_search_history(
    entity_id: str,
    limit: int = 5,
    current_user: dict = Depends(get_current_user)
):
    """Get search history for a specific entity (business unit, keyword, buyer persona)"""
    # Find runs that match this entity
    # Entity ID format is like "CompanyName_TherapeuticArea"
    runs = await db.scraper_runs.find(
        {"$or": [
            {"entity_id": entity_id},
            {"params.entity_id": entity_id},
            {"scrapper_id": {"$regex": entity_id.replace("_", ".*"), "$options": "i"}}
        ]},
        {"_id": 0}
    ).sort("started_at", -1).limit(limit).to_list(limit)
    
    # Also check by company/area params
    if not runs:
        parts = entity_id.split("_")
        if len(parts) >= 2:
            company = parts[0]
            area = "_".join(parts[1:])
            runs = await db.scraper_runs.find(
                {"$or": [
                    {"params.company": {"$regex": company, "$options": "i"}},
                    {"params.therapeutic_area": {"$regex": area, "$options": "i"}}
                ]},
                {"_id": 0}
            ).sort("started_at", -1).limit(limit).to_list(limit)
    
    return {
        "entity_id": entity_id,
        "history": runs,
        "total": len(runs)
    }


@router.post("/schedules/{entity_id}/complete")
async def mark_schedule_complete(
    entity_id: str,
    results: dict = None,
    current_user: dict = Depends(get_current_user)
):
    """Mark a schedule's last run as complete and store results"""
    schedule = await db.search_schedules.find_one({"entity_id": entity_id})
    if not schedule:
        raise HTTPException(status_code=404, detail="Schedule not found")
    
    now = datetime.now(timezone.utc)
    
    # Store the run in history
    run_doc = {
        "id": str(uuid.uuid4()),
        "entity_id": entity_id,
        "schedule_id": schedule["id"],
        "scrapper_id": f"{schedule['schedule_type']}_{entity_id}",
        "status": "completed",
        "started_at": schedule.get("last_run", now.isoformat()),
        "completed_at": now.isoformat(),
        "results": results or {},
        "params": schedule.get("params", {})
    }
    await db.scraper_runs.insert_one(run_doc)
    
    # Update schedule status
    await db.search_schedules.update_one(
        {"entity_id": entity_id},
        {"$set": {
            "last_run_status": "completed",
            "last_run_results": results,
            "updated_at": now.isoformat()
        }}
    )
    
    return {"success": True, "message": "Schedule marked as complete"}



# ============ WEEKLY CHECKBOXES FOR MANUAL TASKS ============

@router.get("/weekly-tasks")
async def get_weekly_tasks(
    current_user: dict = Depends(get_current_user)
):
    """Get weekly task checkboxes status (resets every Monday)"""
    now = datetime.now(timezone.utc)
    
    # Calculate start of current week (Monday)
    days_since_monday = now.weekday()
    week_start = (now - timedelta(days=days_since_monday)).replace(hour=0, minute=0, second=0, microsecond=0)
    week_key = week_start.strftime("%Y-W%W")
    
    # Get or create weekly tasks document
    tasks = await db.weekly_tasks.find_one({"week_key": week_key}, {"_id": 0})
    
    if not tasks:
        # Initialize with default structure
        tasks = {
            "week_key": week_key,
            "week_start": week_start.isoformat(),
            "deal_makers": {},  # buyer_persona_id: { checked: bool, checked_at: datetime }
            "small_business": {},  # same structure
            "social_followers": {},  # same structure
            "linkedin_invitations": {},  # profile_id (gb, mg): { checked: bool, checked_at: datetime }
            "created_at": now.isoformat()
        }
        await db.weekly_tasks.insert_one(tasks)
        tasks.pop("_id", None)
    
    return {
        "success": True,
        "week_key": week_key,
        "week_start": week_start.isoformat(),
        "tasks": tasks
    }


@router.post("/weekly-tasks/{task_type}/{entity_id}")
async def toggle_weekly_task(
    task_type: str,  # "deal_makers", "small_business", "social_followers", "linkedin_invitations"
    entity_id: str,  # buyer_persona_id or category or profile_id
    current_user: dict = Depends(get_current_user)
):
    """Toggle a weekly task checkbox"""
    if task_type not in ["deal_makers", "small_business", "social_followers", "linkedin_invitations"]:
        raise HTTPException(status_code=400, detail="Invalid task type")
    
    now = datetime.now(timezone.utc)
    days_since_monday = now.weekday()
    week_start = (now - timedelta(days=days_since_monday)).replace(hour=0, minute=0, second=0, microsecond=0)
    week_key = week_start.strftime("%Y-W%W")
    
    # Get current task status
    tasks = await db.weekly_tasks.find_one({"week_key": week_key})
    
    if not tasks:
        tasks = {
            "week_key": week_key,
            "week_start": week_start.isoformat(),
            "deal_makers": {},
            "small_business": {},
            "social_followers": {},
            "created_at": now.isoformat()
        }
        await db.weekly_tasks.insert_one(tasks)
    
    # Toggle the checkbox
    current_status = tasks.get(task_type, {}).get(entity_id, {}).get("checked", False)
    new_status = not current_status
    
    await db.weekly_tasks.update_one(
        {"week_key": week_key},
        {"$set": {
            f"{task_type}.{entity_id}": {
                "checked": new_status,
                "checked_at": now.isoformat() if new_status else None,
                "checked_by": current_user.get("email")
            }
        }}
    )
    
    return {
        "success": True,
        "task_type": task_type,
        "entity_id": entity_id,
        "checked": new_status,
        "week_key": week_key
    }


# ============ ENHANCED TRAFFIC LIGHT STATUS ============

# Weekly goals for LinkedIn finders
LINKEDIN_WEEKLY_GOAL_PER_FINDER = 50  # Goal per individual finder (Molecules, Posts, Position)
LINKEDIN_WEEKLY_GOAL_TOTAL = 150  # Total goal for Via LinkedIn (50 x 3)

import logging
logger = logging.getLogger(__name__)


async def calculate_current_cases_status(now, week_start, week_end) -> dict:
    """
    Calculate traffic light status for Current Cases (Stage 4 Ganados) section.
    
    IMPORTANT: Gray is NOT allowed for the current week.
    
    Definition of "pending task": unchecked AND due_date <= today (date-only comparison)
    
    Rules per project:
    1. First determine if project has any PENDING tasks
    2. If NO pending tasks → GREEN (no work to do)
       - This includes: no tasks exist, all checked, or unchecked but due in future
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
    # Today at start of day for due date comparison
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    
    # Fetch eligible cases (Stage 4 "ganados" with status "active")
    cases = await db.cases.find(
        {"stage": "ganados", "status": "active"},
        {"_id": 0, "id": 1, "name": 1, "contact_ids": 1}
    ).to_list(500)
    
    # If no eligible cases → GREEN
    if not cases:
        return {
            "status": "green",
            "message": "No eligible cases",
            "cases_count": 0,
            "has_tasks": False
        }
    
    total_tasks_globally = 0
    case_statuses = []
    
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
                    total_tasks_globally += 1
                    
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
            case_status = "green"
        elif has_activity_this_week:
            # Pending work exists and team started this week → YELLOW
            case_status = "yellow"
        else:
            # Pending work exists and no activity this week → RED
            case_status = "red"
        
        case_statuses.append(case_status)
    
    # Aggregate section status
    if "red" in case_statuses:
        section_status = "red"
    elif "yellow" in case_statuses:
        section_status = "yellow"
    else:
        section_status = "green"
    
    return {
        "status": section_status,
        "cases_count": len(cases),
        "has_tasks": total_tasks_globally > 0,
        "tasks_count": total_tasks_globally,
        "case_statuses": {
            "green": case_statuses.count("green"),
            "yellow": case_statuses.count("yellow"),
            "red": case_statuses.count("red")
        }
    }

@router.get("/traffic-light")
async def get_traffic_light_status(
    current_user: dict = Depends(get_current_user)
):
    """Get comprehensive traffic light status for all navigation items - Hierarchical System"""
    now = datetime.now(timezone.utc)
    
    # Calculate week boundaries (Monday to Sunday)
    days_since_monday = now.weekday()
    week_start = (now - timedelta(days=days_since_monday)).replace(hour=0, minute=0, second=0, microsecond=0)
    week_end = week_start + timedelta(days=7)
    week_key = week_start.strftime("%Y-W%W")
    
    # Get all schedules
    schedules = await db.search_schedules.find({"active": True}, {"_id": 0}).to_list(None)
    
    # Get weekly tasks
    weekly_tasks = await db.weekly_tasks.find_one({"week_key": week_key}, {"_id": 0})
    
    # Get buyer personas for checkbox status
    buyer_personas = await db.buyer_personas_db.find({}, {"_id": 0, "code": 1, "name": 1}).to_list(100)
    
    # Get contacts created this week for each LinkedIn finder source
    molecules_contacts_this_week = await db.unified_contacts.count_documents({
        "source": {"$in": ["molecules_deal_makers", "linkedin_molecules", "molecules"]},
        "created_at": {"$gte": week_start.isoformat(), "$lt": week_end.isoformat()},
        "stage": 1
    })
    
    posts_contacts_this_week = await db.unified_contacts.count_documents({
        "source": {"$in": ["deal_makers_by_post", "linkedin_post", "posts"]},
        "created_at": {"$gte": week_start.isoformat(), "$lt": week_end.isoformat()},
        "stage": 1
    })
    
    position_contacts_this_week = await db.unified_contacts.count_documents({
        "source": {"$in": ["deal_makers_by_position", "linkedin_position", "position", "linkedin"]},
        "created_at": {"$gte": week_start.isoformat(), "$lt": week_end.isoformat()},
        "stage": 1
    })
    
    total_linkedin_contacts_this_week = molecules_contacts_this_week + posts_contacts_this_week + position_contacts_this_week
    
    # Build status for each navigation item
    status = {}
    
    # === Helper function for parent status aggregation ===
    def calc_parent_status(children_keys):
        """
        Aggregate status with strict hierarchy propagation:
        Priority: Gray > Red > Yellow > Green
        - If ANY child is gray → parent is gray
        - If ANY child is red → parent is red  
        - If ANY child is yellow → parent is yellow
        - Only green if ALL children are green
        """
        children = [status.get(k, {}).get("status", "gray") for k in children_keys]
        if "gray" in children:
            return "gray"
        if "red" in children:
            return "red"
        if "yellow" in children:
            return "yellow"
        if all(c == "green" for c in children):
            return "green"
        return "yellow"
    
    # ================================================================
    # STEP 1: PROSPECT DAILY FANATICALLY
    # ================================================================
    
    # === 1.1.1.1 By Molecules (LinkedIn) ===
    if molecules_contacts_this_week >= LINKEDIN_WEEKLY_GOAL_PER_FINDER:
        molecules_status = "green"
    elif molecules_contacts_this_week > 0:
        molecules_status = "yellow"
    else:
        molecules_status = "red"
    
    status["1.1.1.1"] = {
        "status": molecules_status, 
        "contacts_this_week": molecules_contacts_this_week,
        "goal": LINKEDIN_WEEKLY_GOAL_PER_FINDER,
        "progress": f"{molecules_contacts_this_week}/{LINKEDIN_WEEKLY_GOAL_PER_FINDER}"
    }
    
    # === 1.1.1.2 By Post (LinkedIn) ===
    if posts_contacts_this_week >= LINKEDIN_WEEKLY_GOAL_PER_FINDER:
        posts_status = "green"
    elif posts_contacts_this_week > 0:
        posts_status = "yellow"
    else:
        posts_status = "red"
    
    status["1.1.1.2"] = {
        "status": posts_status,
        "contacts_this_week": posts_contacts_this_week,
        "goal": LINKEDIN_WEEKLY_GOAL_PER_FINDER,
        "progress": f"{posts_contacts_this_week}/{LINKEDIN_WEEKLY_GOAL_PER_FINDER}"
    }
    
    # === 1.1.1.3 By Position (LinkedIn) - Check for Apify rate limit ===
    # Check for active rate limit alert
    rate_limit_alert = await db.position_search_alerts.find_one(
        {"type": "rate_limit", "week_key": week_key, "resolved": False},
        {"_id": 0}
    )
    
    if rate_limit_alert:
        position_status = "red"
        position_message = "Límite de Apify alcanzado"
    elif position_contacts_this_week >= LINKEDIN_WEEKLY_GOAL_PER_FINDER:
        position_status = "green"
        position_message = "Meta alcanzada"
    elif position_contacts_this_week > 0:
        position_status = "yellow"
        position_message = "En progreso"
    else:
        position_status = "red"
        position_message = "Sin contactos"
    
    status["1.1.1.3"] = {
        "status": position_status,
        "contacts_this_week": position_contacts_this_week,
        "goal": LINKEDIN_WEEKLY_GOAL_PER_FINDER,
        "progress": f"{position_contacts_this_week}/{LINKEDIN_WEEKLY_GOAL_PER_FINDER}",
        "message": position_message,
        "rate_limit_alert": rate_limit_alert is not None
    }
    
    # === 1.1.1 Via LinkedIn (Parent) - Use aggregation ===
    status["1.1.1"] = {
        "status": calc_parent_status(["1.1.1.1", "1.1.1.2", "1.1.1.3"]),
        "contacts_this_week": total_linkedin_contacts_this_week,
        "goal": LINKEDIN_WEEKLY_GOAL_TOTAL,
        "progress": f"{total_linkedin_contacts_this_week}/{LINKEDIN_WEEKLY_GOAL_TOTAL}",
        "breakdown": {
            "molecules": molecules_contacts_this_week,
            "posts": posts_contacts_this_week,
            "position": position_contacts_this_week
        }
    }
    
    # === 1.1.2 Via Google Maps (Coming Soon placeholder) ===
    status["1.1.2"] = {"status": "gray", "reason": "coming_soon"}
    
    # === 1.2.x Attract items - All Coming Soon ===
    status["1.2.1"] = {"status": "gray", "reason": "coming_soon"}
    status["1.2.2"] = {"status": "gray", "reason": "coming_soon"}
    status["1.2.3"] = {"status": "gray", "reason": "coming_soon"}
    status["1.2.4"] = {"status": "gray", "reason": "coming_soon"}
    
    # === 1.3.1 Deal Makers (Weekly Checkbox) ===
    dm_tasks = weekly_tasks.get("deal_makers", {}) if weekly_tasks else {}
    dm_total = len(buyer_personas)
    dm_checked = sum(1 for bp in buyer_personas if dm_tasks.get(bp.get("code"), {}).get("checked", False))
    
    if dm_checked == dm_total and dm_total > 0:
        dm_status = "green"
    elif dm_checked > 0:
        dm_status = "yellow"
    else:
        dm_status = "yellow"
    
    status["1.3.1"] = {"status": dm_status, "checked": dm_checked, "total": dm_total}
    
    # === 1.3.2 LinkedIn Invitations (Weekly - GB & MG profiles) ===
    li_tasks = weekly_tasks.get("linkedin_invitations", {}) if weekly_tasks else {}
    li_gb_checked = li_tasks.get("gb", {}).get("checked", False)
    li_mg_checked = li_tasks.get("mg", {}).get("checked", False)
    li_all_checked = li_gb_checked and li_mg_checked
    
    status["1.3.2"] = {
        "status": "green" if li_all_checked else "yellow",
        "profiles": {"gb": li_gb_checked, "mg": li_mg_checked}
    }
    
    # === 1.3.3 Small Business WhatsApp (Weekly Checkbox + Pending Messages) ===
    sb_tasks = weekly_tasks.get("small_business", {}) if weekly_tasks else {}
    sb_checked = sb_tasks.get("all", {}).get("checked", False)
    
    # Also check for pending WhatsApp messages
    whatsapp_pending = await db.whatsapp_messages.count_documents({"status": "pending"})
    
    # Green if: checkbox is checked OR no pending messages
    # Yellow if: has some activity but not complete
    # Red if: unchecked AND has pending messages
    if sb_checked:
        sb_status = "green"
    elif whatsapp_pending == 0:
        sb_status = "green"  # No pending = all done
    else:
        sb_status = "red"  # Has pending messages and not checked
    
    status["1.3.3"] = {
        "status": sb_status, 
        "checked": sb_checked,
        "pending_messages": whatsapp_pending
    }
    
    # === 1.3.4 Social Followers - Coming Soon ===
    status["1.3.4"] = {"status": "gray", "reason": "coming_soon"}
    
    # === Step 1 parent aggregations ===
    status["1.1"] = {"status": calc_parent_status(["1.1.1", "1.1.2"])}
    status["1.2"] = {"status": calc_parent_status(["1.2.1", "1.2.2", "1.2.3", "1.2.4"])}
    status["1.3"] = {"status": calc_parent_status(["1.3.1", "1.3.2", "1.3.3", "1.3.4"])}
    status["step1"] = {"status": calc_parent_status(["1.1", "1.2", "1.3"])}
    
    # ================================================================
    # STEP 2: NURTURE
    # ================================================================
    
    # === 2.1.x Individual items ===
    status["2.1.1"] = {"status": "green"}  # Import LinkedIn Event Contacts - functional
    status["2.1.2"] = {"status": "gray", "reason": "coming_soon"}  # Booklets & Cases
    status["2.1.3"] = {"status": "green"}  # Nurture Deal Makers - functional
    
    # === 2.2.x Bulk items ===
    status["2.2.1"] = {"status": "gray", "reason": "coming_soon"}  # Website
    status["2.2.2"] = {"status": "green"}  # Campaigns - functional
    status["2.2.3"] = {"status": "green"}  # Testimonials - functional
    status["2.2.4"] = {"status": "gray", "reason": "coming_soon"}  # Media Relations
    status["2.2.5"] = {"status": "gray", "reason": "coming_soon"}  # Editorial Relations
    status["2.2.6"] = {"status": "green"}  # Long Form Videos - functional
    
    # === 2.2.7 Own Events ===
    try:
        events_v2 = await db.webinar_events_v2.find({}, {"_id": 0, "tasks": 1}).to_list(100)
        today = now.strftime("%Y-%m-%d")
        
        if not events_v2:
            events_status = "green"
            events_message = "No events"
        else:
            all_green = True
            any_red = False
            
            for event in events_v2:
                tasks = event.get("tasks", [])
                overdue = sum(1 for t in tasks if not t.get("completed", False) and t.get("due_date", "") < today)
                pending = sum(1 for t in tasks if not t.get("completed", False) and t.get("due_date", "") >= today)
                
                if overdue > 0:
                    any_red = True
                    all_green = False
                elif pending > 0:
                    all_green = False
            
            if any_red:
                events_status = "red"
                events_message = "Overdue tasks"
            elif all_green:
                events_status = "green"
                events_message = "All on track"
            else:
                events_status = "yellow"
                events_message = "Pending tasks"
        
        status["2.2.7"] = {"status": events_status, "message": events_message, "total_events": len(events_v2)}
    except Exception:
        status["2.2.7"] = {"status": "green"}
    
    # === 2.2.8 Medical Society Events ===
    try:
        society_events = await db.events.count_documents({"source": "scrape"})
        status["2.2.8"] = {"status": "green" if society_events > 0 else "yellow", "total_events": society_events}
    except Exception:
        status["2.2.8"] = {"status": "green"}
    
    status["2.2.9"] = {"status": "gray", "reason": "coming_soon"}  # Long Form Videos
    
    # === 2.2.10 Own Events ===
    try:
        own_events = await db.events.count_documents({"source": {"$ne": "scrape"}})
        upcoming_own = await db.events.count_documents({
            "source": {"$ne": "scrape"},
            "event_date": {"$gte": now.isoformat()}
        })
        status["2.2.10"] = {
            "status": "green" if upcoming_own > 0 else "yellow" if own_events > 0 else "red",
            "total": own_events,
            "upcoming": upcoming_own
        }
    except Exception:
        status["2.2.10"] = {"status": "yellow"}
    
    # === 2.2.11 Medical Society Events ===
    try:
        med_events = await db.medical_society_events.count_documents({})
        status["2.2.11"] = {
            "status": "green" if med_events > 0 else "yellow",
            "total": med_events
        }
    except Exception:
        status["2.2.11"] = {"status": "yellow"}
    
    # === 2.2.12 Write Books ===
    status["2.2.12"] = {"status": "gray", "reason": "coming_soon"}
    
    # === 2.2.13 Quiz System ===
    try:
        quizzes_count = await db.quizzes.count_documents({"is_active": True})
        quiz_responses = await db.quiz_responses.count_documents({})
        status["2.2.13"] = {
            "status": "green" if quiz_responses > 0 else "yellow" if quizzes_count > 0 else "red",
            "quizzes": quizzes_count,
            "responses": quiz_responses
        }
    except Exception:
        status["2.2.13"] = {"status": "yellow"}
    
    # === 2.2.14 Hero Countdown ===
    try:
        active_countdowns = await db.countdowns.count_documents({
            "is_active": True,
            "target_date": {"$gt": now.isoformat()}
        })
        status["2.2.14"] = {
            "status": "green" if active_countdowns > 0 else "yellow",
            "active_countdowns": active_countdowns
        }
    except Exception:
        status["2.2.14"] = {"status": "yellow"}
    
    # === 2.2.4.1 Email Metrics ===
    try:
        email_events_count = await db.email_events.count_documents({})
        status["2.2.4.1"] = {
            "status": "green" if email_events_count > 0 else "yellow",
            "total_events": email_events_count
        }
    except Exception:
        status["2.2.4.1"] = {"status": "yellow"}
    
    # === 2.2.6.1 Content AI ===
    try:
        ai_history = await db.ai_content_history.count_documents({})
        status["2.2.6.1"] = {
            "status": "green" if ai_history > 0 else "yellow",
            "total_generated": ai_history
        }
    except Exception:
        status["2.2.6.1"] = {"status": "yellow"}
    
    # === 2.2.6.2 Video Processing ===
    try:
        video_transcriptions = await db.video_transcriptions.count_documents({})
        status["2.2.6.2"] = {
            "status": "green" if video_transcriptions > 0 else "yellow",
            "total_transcriptions": video_transcriptions
        }
    except Exception:
        status["2.2.6.2"] = {"status": "yellow"}
    
    # === Step 2 parent aggregations ===
    status["2.1"] = {"status": calc_parent_status(["2.1.1", "2.1.2", "2.1.3"])}
    status["2.2"] = {"status": calc_parent_status([
        "2.2.1", "2.2.2", "2.2.3", "2.2.4", "2.2.4.1", "2.2.5", "2.2.6", "2.2.6.1", "2.2.6.2",
        "2.2.7", "2.2.8", "2.2.9", "2.2.10", "2.2.11", "2.2.12", "2.2.13", "2.2.14"
    ])}
    status["step2"] = {"status": calc_parent_status(["2.1", "2.2"])}
    
    # ================================================================
    # STEP 3: CLOSE
    # ================================================================
    
    # Check if there are contacts in Stage 3
    stage3_contacts = await db.unified_contacts.count_documents({"stage": 3})
    status["3.1"] = {"status": "green"}  # Venue Finder - functional
    status["3.2"] = {"status": "green"}  # Quote Deal Makers - functional
    status["3.3"] = {"status": "green" if stage3_contacts > 0 else "yellow", "contacts": stage3_contacts}
    status["step3"] = {"status": calc_parent_status(["3.1", "3.2", "3.3"])}
    
    # ================================================================
    # STEP 4: DELIVER
    # ================================================================
    
    # === 4.0 WhatsApp Confirmations ===
    # Traffic light: Green if executed on last Monday, Wednesday, or Friday
    try:
        settings = await db.settings.find_one({}, {"_id": 0, "calendar_connected": 1})
        calendar_connected = settings.get("calendar_connected", False) if settings else False
        
        last_wa_exec = await db.whatsapp_confirmations_log.find_one(
            {},
            sort=[("executed_at", -1)]
        )
        
        if not calendar_connected:
            wa_status = "red"
            wa_message = "Calendar not connected"
        elif not last_wa_exec:
            wa_status = "yellow"
            wa_message = "No executions yet"
        else:
            # Check if executed on most recent required day (Mon, Wed, Fri)
            today = now.date()
            weekday = today.weekday()
            required_days = [0, 2, 4]  # Monday, Wednesday, Friday
            
            days_since_last_required = None
            for i in range(7):
                check_day = (weekday - i) % 7
                if check_day in required_days:
                    days_since_last_required = i
                    break
            
            last_exec_date = datetime.fromisoformat(last_wa_exec["executed_at"].replace('Z', '+00:00')).date()
            days_since_execution = (today - last_exec_date).days
            
            if days_since_execution <= days_since_last_required:
                wa_status = "green"
                wa_message = "Up to date"
            else:
                wa_status = "yellow"
                wa_message = f"Last run {days_since_execution} days ago"
        
        status["4.0"] = {
            "status": wa_status,
            "message": wa_message,
            "calendar_connected": calendar_connected,
            "last_execution": last_wa_exec["executed_at"] if last_wa_exec else None
        }
    except Exception as e:
        status["4.0"] = {"status": "yellow", "message": "Status unknown"}
    
    stage4_contacts = await db.unified_contacts.count_documents({"stage": 4})
    status["4.1"] = {"status": "green" if stage4_contacts > 0 else "yellow", "contacts": stage4_contacts}
    status["4.2"] = {"status": "green"}  # Coach Students - functional
    status["4.3"] = {"status": "green"}  # Certificate Students - functional
    
    # === 4.4 Current Cases (Stage 4 Ganados) ===
    try:
        current_cases_status = await calculate_current_cases_status(now, week_start, week_end)
        status["current-cases"] = current_cases_status
    except Exception as e:
        logger.error(f"Error calculating current-cases status: {e}")
        status["current-cases"] = {"status": "green", "message": "Status unknown"}
    
    status["step4"] = {"status": calc_parent_status(["4.0", "4.1", "4.2", "4.3", "current-cases"])}
    
    # ================================================================
    # STEP 5: REPURCHASE
    # ================================================================
    
    stage5_contacts = await db.unified_contacts.count_documents({"stage": 5})
    status["5.1"] = {"status": "green" if stage5_contacts > 0 else "yellow", "contacts": stage5_contacts}
    status["5.2"] = {"status": "gray", "reason": "coming_soon"}  # Students for Recommendations
    status["step5"] = {"status": calc_parent_status(["5.1", "5.2"])}
    
    # ================================================================
    # FOUNDATIONS
    # ================================================================
    
    # Check buyer personas
    bp_count = len(buyer_personas)
    status["foundations-who-bp"] = {"status": "green" if bp_count > 0 else "yellow", "count": bp_count}
    
    # Check companies
    companies_count = await db.unified_contacts.distinct("company", {"company": {"$ne": None, "$ne": ""}})
    status["foundations-who-companies"] = {"status": "green" if len(companies_count) > 0 else "yellow", "count": len(companies_count)}
    
    status["foundations-who-all"] = {"status": "gray", "reason": "coming_soon"}  # All Contacts
    
    # Check success cases
    cases_count = await db.success_cases.count_documents({})
    status["foundations-what"] = {"status": "green" if cases_count > 0 else "yellow", "count": cases_count}
    
    # Check services
    services_count = await db.services.count_documents({})
    status["foundations-how"] = {"status": "green" if services_count > 0 else "yellow", "count": services_count}
    
    # Check pricing
    pricing_count = await db.pricing.count_documents({})
    status["foundations-howmuch"] = {"status": "green" if pricing_count > 0 else "yellow", "count": pricing_count}
    
    # Foundations parent
    status["foundations-who"] = {"status": calc_parent_status(["foundations-who-bp", "foundations-who-companies", "foundations-who-all"])}
    status["foundations"] = {"status": calc_parent_status(["foundations-who", "foundations-what", "foundations-how", "foundations-howmuch"])}
    
    # ================================================================
    # INFOSTRUCTURE
    # ================================================================
    
    # === Pharma Pipelines ===
    try:
        pharma_count = await db.pharma_pipelines.count_documents({})
        # Check if any have scrape errors
        pharma_errors = await db.pharma_pipelines.count_documents({"scrape_status": "failed"})
        if pharma_errors > 0:
            pharma_status = "red"
        elif pharma_count > 0:
            pharma_status = "green"
        else:
            pharma_status = "yellow"
        status["pharma"] = {"status": pharma_status, "count": pharma_count, "errors": pharma_errors}
    except Exception:
        status["pharma"] = {"status": "green", "count": 0}
    
    # === Medical Societies ===
    try:
        societies = await db.medical_societies.find({}, {"_id": 0, "last_scrape_status": 1}).to_list(100)
        if not societies:
            med_soc_status = "yellow"
        else:
            failed = sum(1 for s in societies if s.get("last_scrape_status") == "failed")
            pending = sum(1 for s in societies if s.get("last_scrape_status") in ["pending", None])
            if failed > 0:
                med_soc_status = "red"
            elif pending > 0:
                med_soc_status = "yellow"
            else:
                med_soc_status = "green"
        status["med-societies"] = {"status": med_soc_status, "total": len(societies)}
    except Exception:
        status["med-societies"] = {"status": "green"}
    
    # === Medical Specialties ===
    try:
        specialties_count = await db.medical_specialties.count_documents({})
        status["med-specialties"] = {"status": "green" if specialties_count > 0 else "yellow", "count": specialties_count}
    except Exception:
        status["med-specialties"] = {"status": "green"}
    
    # === Keywords ===
    try:
        keywords_count = await db.job_keywords.count_documents({})
        status["keywords"] = {"status": "green" if keywords_count > 0 else "yellow", "count": keywords_count}
    except Exception:
        status["keywords"] = {"status": "green"}
    
    # === Data Sources ===
    status["sources"] = {"status": "green"}  # Always green - static config
    
    # Infostructure parent
    status["infostructure"] = {"status": calc_parent_status(["pharma", "med-societies", "med-specialties", "keywords", "sources"])}
    
    return {
        "success": True,
        "timestamp": now.isoformat(),
        "week_key": week_key,
        "status": status
    }



# ============ NOTIFICATIONS ============

@router.get("/notifications")
async def get_notifications(
    unread_only: bool = False,
    limit: int = 50,
    current_user: dict = Depends(get_current_user)
):
    """Get notifications for schedule failures and other system events"""
    query = {}
    if unread_only:
        query["read"] = False
    
    notifications = await db.notifications.find(
        query,
        {"_id": 0}
    ).sort("created_at", -1).limit(limit).to_list(limit)
    
    unread_count = await db.notifications.count_documents({"read": False})
    
    return {
        "success": True,
        "notifications": notifications,
        "total": len(notifications),
        "unread_count": unread_count
    }


@router.put("/notifications/{notification_id}/read")
async def mark_notification_read(
    notification_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Mark a notification as read"""
    result = await db.notifications.update_one(
        {"id": notification_id},
        {"$set": {"read": True}}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Notification not found")
    
    return {"success": True, "message": "Notification marked as read"}


@router.put("/notifications/read-all")
async def mark_all_notifications_read(
    current_user: dict = Depends(get_current_user)
):
    """Mark all notifications as read"""
    result = await db.notifications.update_many(
        {"read": False},
        {"$set": {"read": True}}
    )
    
    return {
        "success": True, 
        "message": f"Marked {result.modified_count} notifications as read"
    }


@router.delete("/notifications/{notification_id}")
async def delete_notification(
    notification_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Delete a notification"""
    result = await db.notifications.delete_one({"id": notification_id})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Notification not found")
    
    return {"success": True, "message": "Notification deleted"}


@router.delete("/notifications/clear-all")
async def clear_all_notifications(
    current_user: dict = Depends(get_current_user)
):
    """Clear all notifications"""
    result = await db.notifications.delete_many({})
    
    return {
        "success": True,
        "message": f"Deleted {result.deleted_count} notifications"
    }
