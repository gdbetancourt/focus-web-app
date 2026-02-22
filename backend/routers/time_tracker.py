"""
Time Tracker Router - Track coaching sessions and time spent with students
"""
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime, timezone, timedelta
import uuid

from database import db
from routers.auth import get_current_user

router = APIRouter(prefix="/time-tracker", tags=["time-tracker"])


# ============ MODELS ============

class TimeEntryCreate(BaseModel):
    contact_id: Optional[str] = None
    contact_name: str
    contact_email: Optional[str] = ""
    description: str = ""
    duration_minutes: int  # Duration in minutes
    session_date: str  # YYYY-MM-DD format
    session_type: str = "coaching"  # coaching, mentoring, training, other


class TimeEntryUpdate(BaseModel):
    contact_name: Optional[str] = None
    description: Optional[str] = None
    duration_minutes: Optional[int] = None
    session_date: Optional[str] = None
    session_type: Optional[str] = None


# ============ ENDPOINTS ============

@router.get("/entries")
async def list_time_entries(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    contact_id: Optional[str] = None,
    limit: int = 100,
    current_user: dict = Depends(get_current_user)
):
    """List time entries with optional date filtering"""
    query = {}
    
    if start_date:
        query["session_date"] = {"$gte": start_date}
    if end_date:
        if "session_date" in query:
            query["session_date"]["$lte"] = end_date
        else:
            query["session_date"] = {"$lte": end_date}
    if contact_id:
        query["contact_id"] = contact_id
    
    entries = await db.time_entries.find(
        query, 
        {"_id": 0}
    ).sort("session_date", -1).limit(limit).to_list(limit)
    
    return {"entries": entries, "total": len(entries)}


@router.get("/stats")
async def get_time_stats(
    period: str = "week",  # week, month, year
    current_user: dict = Depends(get_current_user)
):
    """Get time tracking statistics"""
    now = datetime.now(timezone.utc)
    
    if period == "week":
        start_date = (now - timedelta(days=7)).strftime("%Y-%m-%d")
    elif period == "month":
        start_date = (now - timedelta(days=30)).strftime("%Y-%m-%d")
    else:
        start_date = (now - timedelta(days=365)).strftime("%Y-%m-%d")
    
    # Get entries for period
    entries = await db.time_entries.find(
        {"session_date": {"$gte": start_date}},
        {"_id": 0}
    ).to_list(1000)
    
    # Calculate stats
    total_minutes = sum(e.get("duration_minutes", 0) for e in entries)
    total_sessions = len(entries)
    
    # Group by contact
    contacts_time = {}
    for entry in entries:
        contact_name = entry.get("contact_name", "Unknown")
        if contact_name not in contacts_time:
            contacts_time[contact_name] = {"minutes": 0, "sessions": 0}
        contacts_time[contact_name]["minutes"] += entry.get("duration_minutes", 0)
        contacts_time[contact_name]["sessions"] += 1
    
    # Group by type
    types_time = {}
    for entry in entries:
        session_type = entry.get("session_type", "other")
        if session_type not in types_time:
            types_time[session_type] = {"minutes": 0, "sessions": 0}
        types_time[session_type]["minutes"] += entry.get("duration_minutes", 0)
        types_time[session_type]["sessions"] += 1
    
    return {
        "period": period,
        "start_date": start_date,
        "total_minutes": total_minutes,
        "total_hours": round(total_minutes / 60, 1),
        "total_sessions": total_sessions,
        "by_contact": contacts_time,
        "by_type": types_time
    }


@router.post("/entries")
async def create_time_entry(
    data: TimeEntryCreate,
    current_user: dict = Depends(get_current_user)
):
    """Create a new time entry"""
    now = datetime.now(timezone.utc)
    
    entry_doc = {
        "id": str(uuid.uuid4()),
        "contact_id": data.contact_id,
        "contact_name": data.contact_name,
        "contact_email": data.contact_email,
        "description": data.description,
        "duration_minutes": data.duration_minutes,
        "session_date": data.session_date,
        "session_type": data.session_type,
        "created_by": current_user.get("email"),
        "created_at": now.isoformat()
    }
    
    await db.time_entries.insert_one(entry_doc)
    
    return {"success": True, "entry": {k: v for k, v in entry_doc.items() if k != "_id"}}


@router.put("/entries/{entry_id}")
async def update_time_entry(
    entry_id: str,
    data: TimeEntryUpdate,
    current_user: dict = Depends(get_current_user)
):
    """Update a time entry"""
    update_data = {k: v for k, v in data.dict().items() if v is not None}
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    result = await db.time_entries.find_one_and_update(
        {"id": entry_id},
        {"$set": update_data},
        return_document=True
    )
    
    if not result:
        raise HTTPException(status_code=404, detail="Entry not found")
    
    return {"success": True, "entry": {k: v for k, v in result.items() if k != "_id"}}


@router.delete("/entries/{entry_id}")
async def delete_time_entry(
    entry_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Delete a time entry"""
    result = await db.time_entries.delete_one({"id": entry_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Entry not found")
    return {"success": True, "message": "Entry deleted"}


@router.get("/contacts/students")
async def get_students(current_user: dict = Depends(get_current_user)):
    """Get contacts tagged as students (stage 4)"""
    # Get contacts in Stage 4 that have 'student' role
    # Get contacts in stage 4 (Deliver) from unified_contacts only
    contacts = await db.unified_contacts.find(
        {"stage": 4},
        {"_id": 0, "id": 1, "name": 1, "first_name": 1, "last_name": 1, "email": 1, "company": 1, "roles": 1}
    ).limit(500).to_list(500)
    
    # Process contacts
    all_contacts = []
    seen_emails = set()
    
    for c in contacts:
        email = c.get("email", "").lower()
        if email and email not in seen_emails:
            seen_emails.add(email)
            # Build name from available fields
            name = c.get("name", "")
            if not name:
                firstname = c.get("first_name", "") or ""
                lastname = c.get("last_name", "") or ""
                name = f"{firstname} {lastname}".strip()
            all_contacts.append({
                "id": c.get("id"),
                "name": name,
                "email": email,
                "company": c.get("company", "")
            })
    
    return {"contacts": all_contacts}
