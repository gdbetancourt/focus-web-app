"""
Prospection Router - Manage Stage 1 qualification, LinkedIn prospection and active companies
"""
from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, BackgroundTasks
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timezone, timedelta
import csv
import io
import re
import uuid
import asyncio
import logging
import threading
import os

from .auth import get_current_user
from .legacy import db

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/prospection", tags=["Prospection"])

# LinkedIn profiles
LINKEDIN_PROFILES = {
    "GB": "Gerardo Betancourt",
    "MG": "María del Mar Gargari"
}

# ============ MODELS ============

class Stage1StatusUpdate(BaseModel):
    status: str  # "pending_accept", "accepted", "conversation_open"
    linkedin_profile: Optional[str] = None  # "GB" or "MG"


class QualifyContactRequest(BaseModel):
    buyer_persona: str
    add_keyword: bool = False
    keyword_text: Optional[str] = None
    reclassify_existing: bool = False


class LinkedInSearchCreate(BaseModel):
    keyword: str
    url: str


class MarkSearchCopiedRequest(BaseModel):
    profile: str  # "GB" or "MG"


class MergeCompaniesRequest(BaseModel):
    source_ids: List[str]
    target_id: str
    target_name: str


class MarkExportRequestedRequest(BaseModel):
    profile: str  # "GB" or "MG"


# ============ STAGE 1 STATUS MANAGEMENT ============

@router.patch("/contacts/{contact_id}/stage-1-status")
async def update_stage_1_status(
    contact_id: str,
    request: Stage1StatusUpdate,
    current_user: dict = Depends(get_current_user)
):
    """Update Stage 1 status for a contact"""
    valid_statuses = ["pending_accept", "accepted", "conversation_open"]
    if request.status not in valid_statuses:
        raise HTTPException(status_code=400, detail=f"Invalid status. Must be one of: {valid_statuses}")
    
    # If moving to accepted or conversation_open, require linkedin_profile
    if request.status in ["accepted", "conversation_open"] and not request.linkedin_profile:
        raise HTTPException(status_code=400, detail="linkedin_profile required when status is 'accepted' or 'conversation_open'")
    
    if request.linkedin_profile and request.linkedin_profile not in LINKEDIN_PROFILES:
        raise HTTPException(status_code=400, detail=f"Invalid profile. Must be one of: {list(LINKEDIN_PROFILES.keys())}")
    
    # Get contact
    contact = await db.unified_contacts.find_one({"id": contact_id})
    if not contact:
        raise HTTPException(status_code=404, detail="Contact not found")
    
    if contact.get("stage") != 1:
        raise HTTPException(status_code=400, detail="Contact is not in Stage 1")
    
    now = datetime.now(timezone.utc).isoformat()
    
    update_data = {
        "stage_1_status": request.status,
        "updated_at": now
    }
    
    # If going back to pending_accept, reset linkedin_accepted_by
    if request.status == "pending_accept":
        update_data["linkedin_accepted_by"] = None
    elif request.linkedin_profile:
        update_data["linkedin_accepted_by"] = request.linkedin_profile
    
    await db.unified_contacts.update_one(
        {"id": contact_id},
        {"$set": update_data}
    )
    
    return {
        "success": True,
        "contact_id": contact_id,
        "status": request.status,
        "linkedin_accepted_by": update_data.get("linkedin_accepted_by")
    }


# ============ TO QUALIFY ENDPOINTS ============

@router.get("/to-qualify/next")
async def get_next_to_qualify(
    current_user: dict = Depends(get_current_user)
):
    """Get the next contact to qualify (Stage 1 or 2, pending qualification)
    
    Only returns contacts that are:
    - Marked as outbound (classification: "outbound"), OR
    - Associated with an outbound company
    
    Sorting order:
    1. Contacts with most recent LinkedIn connection date first
    2. Contacts with older connection dates
    3. Contacts without connection date at the bottom
    """
    
    # Get list of outbound company names for filtering
    outbound_companies = await db.unified_companies.find(
        {"classification": "outbound", "is_merged": False},
        {"_id": 0, "name": 1}
    ).to_list(2000)
    outbound_company_names = [c["name"] for c in outbound_companies if c.get("name")]
    
    # Base filter: Stage 1 or 2, pending qualification, not discarded
    # AND (contact is outbound OR company is outbound)
    base_filter = {
        "stage": {"$in": [1, 2]},
        "$or": [
            {"qualification_status": "pending"},
            {"qualification_status": {"$exists": False}}
        ],
        "discarded_at": {"$exists": False},
        "$and": [
            {"$or": [
                {"classification": "outbound"},
                {"company": {"$in": outbound_company_names}}
            ]}
        ]
    }
    
    # First, try to get a pending contact WITH a LinkedIn connection date (most recent first)
    contact = await db.unified_contacts.find_one(
        {
            **base_filter,
            "first_connected_on_linkedin": {"$exists": True, "$ne": None, "$ne": ""}
        },
        {"_id": 0},
        sort=[("first_connected_on_linkedin", -1)]  # Most recent first
    )
    
    if not contact:
        # No pending with date, try pending WITHOUT date
        contact = await db.unified_contacts.find_one(
            {
                **base_filter,
                "$or": [
                    {"first_connected_on_linkedin": {"$exists": False}},
                    {"first_connected_on_linkedin": None},
                    {"first_connected_on_linkedin": ""}
                ]
            },
            {"_id": 0},
            sort=[("created_at", -1)]  # Most recent created first
        )
    
    if not contact:
        # No pending, try postponed WITH date (most recent first)
        postponed_filter = {
            "stage": {"$in": [1, 2]},
            "qualification_status": "postponed",
            "discarded_at": {"$exists": False},
            "$or": [
                {"classification": "outbound"},
                {"company": {"$in": outbound_company_names}}
            ],
            "first_connected_on_linkedin": {"$exists": True, "$ne": None, "$ne": ""}
        }
        contact = await db.unified_contacts.find_one(
            postponed_filter,
            {"_id": 0},
            sort=[("first_connected_on_linkedin", -1)]
        )
    
    if not contact:
        # Try postponed WITHOUT date
        postponed_no_date_filter = {
            "stage": {"$in": [1, 2]},
            "qualification_status": "postponed",
            "discarded_at": {"$exists": False},
            "$or": [
                {"classification": "outbound"},
                {"company": {"$in": outbound_company_names}}
            ],
            "$and": [
                {"$or": [
                    {"first_connected_on_linkedin": {"$exists": False}},
                    {"first_connected_on_linkedin": None},
                    {"first_connected_on_linkedin": ""}
                ]}
            ]
        }
        contact = await db.unified_contacts.find_one(
            postponed_no_date_filter,
            {"_id": 0},
            sort=[("last_postponed_at", 1)]
        )
    
    if not contact:
        return {"contact": None, "message": "No hay contactos outbound pendientes de calificación"}
    
    return {"contact": contact}


@router.get("/to-qualify/stats")
async def get_qualification_stats(
    current_user: dict = Depends(get_current_user)
):
    """Get stats for Stage 1 and 2 qualification including weekly progress.
    
    Only counts contacts that are:
    - Marked as outbound (classification: "outbound"), OR
    - Associated with an outbound company
    
    Goal: Qualify ALL pending outbound contacts (no fixed weekly number).
    """
    from datetime import timedelta
    
    # Get list of outbound company names for filtering
    outbound_companies = await db.unified_companies.find(
        {"classification": "outbound", "is_merged": False},
        {"_id": 0, "name": 1}
    ).to_list(2000)
    outbound_company_names = [c["name"] for c in outbound_companies if c.get("name")]
    
    # Filter for outbound contacts only (base filter)
    outbound_condition = {
        "$or": [
            {"classification": "outbound"},
            {"company": {"$in": outbound_company_names}}
        ]
    }
    
    # Combined filter with stage
    outbound_filter = {
        "stage": {"$in": [1, 2]},
        **outbound_condition
    }
    
    # Count by status (only outbound contacts)
    pipeline = [
        {"$match": outbound_filter},
        {"$group": {
            "_id": "$qualification_status",
            "count": {"$sum": 1}
        }}
    ]
    
    results = await db.unified_contacts.aggregate(pipeline).to_list(100)
    
    stats = {
        "pending": 0,
        "qualified": 0,
        "discarded": 0,
        "postponed": 0
    }
    
    for r in results:
        status = r["_id"] or "pending"
        if status in stats:
            stats[status] = r["count"]
        elif status is None or status == "":
            stats["pending"] += r["count"]
    
    # Also count discarded separately (outbound only)
    discarded_count = await db.unified_contacts.count_documents({
        "stage": {"$in": [1, 2]},
        "discarded_at": {"$exists": True},
        **outbound_condition
    })
    stats["discarded"] = discarded_count
    
    # Weekly progress (excluding Mateo/Ramona, outbound only)
    today = datetime.now(timezone.utc)
    monday = today - timedelta(days=today.weekday())
    monday = monday.replace(hour=0, minute=0, second=0, microsecond=0)
    monday_str = monday.isoformat()
    
    qualified_this_week = await db.unified_contacts.count_documents({
        "stage": {"$in": [1, 2]},
        "qualification_status": "qualified",
        "qualification_date": {"$gte": monday_str},
        "buyer_persona": {"$nin": ["mateo", "ramona"]},
        **outbound_condition
    })
    
    # Pending count (contacts that still need qualification) - CORRECT with $and
    pending_count = await db.unified_contacts.count_documents({
        "stage": {"$in": [1, 2]},
        "$and": [
            {"$or": [
                {"qualification_status": "pending"},
                {"qualification_status": {"$exists": False}},
                {"qualification_status": "postponed"}
            ]},
            outbound_condition
        ],
        "discarded_at": {"$exists": False}
    })
    
    # Goal is to qualify ALL pending - percentage based on remaining
    total_to_qualify = qualified_this_week + pending_count
    percentage = round((qualified_this_week / total_to_qualify) * 100, 1) if total_to_qualify > 0 else 100
    
    stats["weekly_progress"] = {
        "qualified": qualified_this_week,
        "pending": pending_count,
        "total": total_to_qualify,
        "percentage": percentage
    }
    
    return stats


@router.post("/to-qualify/{contact_id}/qualify")
async def qualify_contact(
    contact_id: str,
    request: QualifyContactRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Qualify a contact - confirm or change buyer persona.
    Optionally:
    - Add keyword to job_keywords collection
    - Reclassify existing contacts with exact keyword match
    
    MIGRATION: Now integrates with centralized persona_classifier_service:
    - Invalidates classifier cache when keywords are added
    - Sets buyer_persona_locked and buyer_persona_assigned_manually flags
    """
    # Import centralized classifier service
    from services.persona_classifier_service import (
        invalidate_classifier_cache,
        normalize_job_title
    )
    
    contact = await db.unified_contacts.find_one({"id": contact_id})
    if not contact:
        raise HTTPException(status_code=404, detail="Contact not found")
    
    now = datetime.now(timezone.utc).isoformat()
    buyer_persona = request.buyer_persona
    reclassified_count = 0
    keyword_added = False
    
    # Normalize job title for future queries
    job_title = contact.get("job_title", "")
    job_title_normalized = normalize_job_title(job_title)
    
    # 1. Qualify the current contact (with lock flags for manual override)
    await db.unified_contacts.update_one(
        {"id": contact_id},
        {"$set": {
            "qualification_status": "qualified",
            "qualification_date": now,
            "buyer_persona": buyer_persona,
            "buyer_persona_locked": True,  # Lock to prevent reclassification
            "buyer_persona_assigned_manually": True,  # Mark as manual
            "job_title_normalized": job_title_normalized,
            "updated_at": now
        }}
    )
    
    # 2. Add keyword to job_keywords if requested (exact match)
    if request.add_keyword and request.keyword_text and request.keyword_text.strip():
        keyword = request.keyword_text.strip().lower()  # Normalize to lowercase
        
        # Check if keyword already exists for this buyer persona
        existing = await db.job_keywords.find_one({
            "keyword": keyword,
            "buyer_persona_id": buyer_persona
        })
        
        if not existing:
            await db.job_keywords.insert_one({
                "id": str(uuid.uuid4()),
                "keyword": keyword,
                "buyer_persona_id": buyer_persona,
                "match_type": "exact",
                "created_at": now,
                "created_by": current_user.get("email", "system"),
                "source": "manual_qualification"
            })
            keyword_added = True
            
            # Invalidate classifier cache since keywords changed
            invalidate_classifier_cache()
    
    # 3. Reclassify existing contacts if requested
    if request.reclassify_existing and request.keyword_text and request.keyword_text.strip():
        keyword = request.keyword_text.strip()
        
        # Find contacts with EXACT job_title match that:
        # - Have Mateo/Ramona as buyer_persona OR
        # - Have no buyer_persona OR
        # - Were not manually qualified (qualification_status != "qualified")
        # - Are NOT locked
        reclassify_query = {
            "job_title": keyword,  # Exact match
            "id": {"$ne": contact_id},  # Exclude current contact
            "$or": [
                {"buyer_persona_locked": {"$exists": False}},
                {"buyer_persona_locked": False},
                {"buyer_persona_locked": None}
            ],
            "$and": [
                {"$or": [
                    {"buyer_persona": {"$in": ["mateo", "ramona", None, ""]}},
                    {"buyer_persona": {"$exists": False}},
                    {"qualification_status": {"$ne": "qualified"}}
                ]}
            ]
        }
        
        result = await db.unified_contacts.update_many(
            reclassify_query,
            {"$set": {
                "buyer_persona": buyer_persona,
                "qualification_status": "qualified",
                "qualification_date": now,
                "auto_qualified_by_keyword": keyword,
                "job_title_normalized": normalize_job_title(keyword),
                "updated_at": now
            }}
        )
        reclassified_count = result.modified_count
    
    return {
        "success": True,
        "contact_id": contact_id,
        "buyer_persona": buyer_persona,
        "keyword_added": keyword_added,
        "reclassified_count": reclassified_count
    }


@router.post("/to-qualify/{contact_id}/discard")
async def discard_contact(
    contact_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Discard a contact - classify as Mateo (usuario final)"""
    contact = await db.unified_contacts.find_one({"id": contact_id})
    if not contact:
        raise HTTPException(status_code=404, detail="Contact not found")
    
    now = datetime.now(timezone.utc).isoformat()
    
    # Instead of archiving, classify as "mateo" (usuario final)
    await db.unified_contacts.update_one(
        {"id": contact_id},
        {"$set": {
            "qualification_status": "qualified",
            "qualification_date": now,
            "buyer_persona": "mateo",
            "updated_at": now
        }}
    )
    
    return {
        "success": True,
        "contact_id": contact_id,
        "contact_name": contact.get("name") or f"{contact.get('first_name', '')} {contact.get('last_name', '')}".strip(),
        "buyer_persona": "mateo"
    }


@router.post("/to-qualify/{contact_id}/undo-discard")
async def undo_discard_contact(
    contact_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Undo discard - only works within 60 seconds"""
    contact = await db.unified_contacts.find_one({"id": contact_id})
    if not contact:
        raise HTTPException(status_code=404, detail="Contact not found")
    
    discarded_at = contact.get("discarded_at")
    if not discarded_at:
        raise HTTPException(status_code=400, detail="Contact was not discarded")
    
    # Check if within 60 seconds
    discarded_time = datetime.fromisoformat(discarded_at.replace('Z', '+00:00'))
    now = datetime.now(timezone.utc)
    
    if (now - discarded_time).total_seconds() > 60:
        raise HTTPException(status_code=400, detail="Undo window expired (60 seconds)")
    
    await db.unified_contacts.update_one(
        {"id": contact_id},
        {
            "$set": {
                "qualification_status": "pending",
                "updated_at": now.isoformat()
            },
            "$unset": {"discarded_at": ""}
        }
    )
    
    return {"success": True, "contact_id": contact_id}


@router.post("/to-qualify/{contact_id}/postpone")
async def postpone_contact(
    contact_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Postpone a contact - review later"""
    contact = await db.unified_contacts.find_one({"id": contact_id})
    if not contact:
        raise HTTPException(status_code=404, detail="Contact not found")
    
    now = datetime.now(timezone.utc).isoformat()
    current_count = contact.get("postpone_count", 0)
    
    await db.unified_contacts.update_one(
        {"id": contact_id},
        {"$set": {
            "qualification_status": "postponed",
            "last_postponed_at": now,
            "postpone_count": current_count + 1,
            "updated_at": now
        }}
    )
    
    return {
        "success": True,
        "contact_id": contact_id,
        "postpone_count": current_count + 1
    }


# ============ LINKEDIN IMPORT TASKS ============

def get_current_week_start():
    """Get Monday of the current week"""
    today = datetime.now(timezone.utc).date()
    monday = today - timedelta(days=today.weekday())
    return monday.isoformat()


@router.get("/linkedin-import/status")
async def get_linkedin_import_status(
    current_user: dict = Depends(get_current_user)
):
    """Get the current week's LinkedIn import status for both profiles"""
    week_start = get_current_week_start()
    
    result = {
        "week_start": week_start,
        "linkedin_export_url": "https://www.linkedin.com/mypreferences/d/categories/privacy",
        "profiles": {}
    }
    
    for profile in ["GB", "MG"]:
        task = await db.linkedin_import_tasks.find_one(
            {"profile": profile, "week_start": week_start},
            {"_id": 0}
        )
        
        if not task:
            task = {
                "profile": profile,
                "week_start": week_start,
                "export_requested": False,
                "export_requested_at": None,
                "import_completed": False,
                "import_completed_at": None,
                "contacts_imported": 0
            }
        
        # Calculate if import should be available (2 days after request)
        import_available = False
        if task.get("export_requested") and task.get("export_requested_at"):
            requested_at = datetime.fromisoformat(task["export_requested_at"].replace('Z', '+00:00'))
            import_available = datetime.now(timezone.utc) >= requested_at + timedelta(days=2)
        
        task["import_available"] = import_available or not task.get("export_requested")  # Always allow upload
        task["profile_name"] = LINKEDIN_PROFILES[profile]
        result["profiles"][profile] = task
    
    return result


@router.post("/linkedin-import/mark-export-requested")
async def mark_export_requested(
    request: MarkExportRequestedRequest,
    current_user: dict = Depends(get_current_user)
):
    """Mark that export was requested for a profile this week"""
    if request.profile not in LINKEDIN_PROFILES:
        raise HTTPException(status_code=400, detail=f"Invalid profile. Must be one of: {list(LINKEDIN_PROFILES.keys())}")
    
    week_start = get_current_week_start()
    now = datetime.now(timezone.utc).isoformat()
    
    await db.linkedin_import_tasks.update_one(
        {"profile": request.profile, "week_start": week_start},
        {"$set": {
            "export_requested": True,
            "export_requested_at": now
        }},
        upsert=True
    )
    
    return {
        "success": True,
        "profile": request.profile,
        "week_start": week_start,
        "export_requested_at": now
    }


@router.post("/linkedin-import/upload")
async def upload_linkedin_contacts(
    profile: str,
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user)
):
    """
    Upload LinkedIn contacts CSV export - processes in background for large files (10k+ contacts).
    Returns immediately with a job_id to track progress.
    """
    if profile not in LINKEDIN_PROFILES:
        raise HTTPException(status_code=400, detail=f"Invalid profile. Must be one of: {list(LINKEDIN_PROFILES.keys())}")
    
    if not file.filename.endswith('.csv'):
        raise HTTPException(status_code=400, detail="File must be a CSV")
    
    # Check that export was requested first
    week_start = get_current_week_start()
    task = await db.linkedin_import_tasks.find_one({"profile": profile, "week_start": week_start})
    if not task or not task.get("export_requested"):
        raise HTTPException(
            status_code=400, 
            detail="You must first mark the export request checkbox before uploading the file"
        )
    
    # Read file content
    content = await file.read()
    
    # Try to decode
    decoded = None
    for encoding in ['utf-8', 'utf-8-sig', 'latin-1', 'cp1252']:
        try:
            decoded = content.decode(encoding)
            break
        except UnicodeDecodeError:
            continue
    
    if decoded is None:
        raise HTTPException(status_code=400, detail="Could not decode CSV file")
    
    # Auto-detect delimiter (tab or comma)
    first_line = decoded.split('\n')[0] if decoded else ''
    delimiter = '\t' if '\t' in first_line else ','
    
    # Count total rows for progress tracking
    reader = csv.DictReader(io.StringIO(decoded), delimiter=delimiter)
    rows = list(reader)
    total_rows = len(rows)
    
    if total_rows == 0:
        raise HTTPException(status_code=400, detail="CSV file is empty")
    
    # Create import job
    job_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    
    import_job = {
        "job_id": job_id,
        "profile": profile,
        "week_start": week_start,
        "file_name": file.filename,
        "status": "processing",
        "total_rows": total_rows,
        "processed_rows": 0,
        "contacts_created": 0,
        "contacts_updated": 0,
        "contacts_skipped": 0,
        "error": None,
        "started_at": now,
        "completed_at": None
    }
    
    await db.linkedin_import_jobs.insert_one(import_job)
    
    # Start background processing
    background_tasks.add_task(
        process_linkedin_import_background,
        job_id,
        profile,
        week_start,
        rows,
        file.filename
    )
    
    return {
        "success": True,
        "job_id": job_id,
        "message": f"Import started in background. Processing {total_rows} contacts.",
        "total_rows": total_rows
    }


class LinkedInMappedImportRequest(BaseModel):
    data: List[dict]
    column_mapping: dict
    duplicate_policy: str = "merge"  # merge, skip, create


class LinkedInDataImportRequest(BaseModel):
    """Request for importing parsed CSV data directly"""
    data: List[dict]
    column_mapping: dict
    duplicate_policy: str = "merge"


class LinkedInChunkStartRequest(BaseModel):
    """Request to start a chunked import job"""
    column_mapping: dict
    duplicate_policy: str = "merge"


class LinkedInChunkImportRequest(BaseModel):
    """Request for chunked import - processes a batch at a time"""
    job_id: str
    chunk_data: List[dict]
    chunk_index: int
    is_last_chunk: bool = False


@router.post("/linkedin-import/upload-mapped")
async def upload_linkedin_contacts_mapped(
    profile: str,
    request: LinkedInMappedImportRequest,
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(get_current_user)
):
    """
    Upload LinkedIn contacts with custom column mapping and duplicate policy.
    Processes in background for large files.
    """
    if profile not in LINKEDIN_PROFILES:
        raise HTTPException(status_code=400, detail=f"Invalid profile. Must be one of: {list(LINKEDIN_PROFILES.keys())}")
    
    # Check that export was requested first
    week_start = get_current_week_start()
    task = await db.linkedin_import_tasks.find_one({"profile": profile, "week_start": week_start})
    if not task or not task.get("export_requested"):
        raise HTTPException(
            status_code=400, 
            detail="You must first mark the export request checkbox before uploading"
        )
    
    rows = request.data
    total_rows = len(rows)
    
    if total_rows == 0:
        raise HTTPException(status_code=400, detail="No data to import")
    
    # Create import job
    job_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    
    import_job = {
        "job_id": job_id,
        "profile": profile,
        "week_start": week_start,
        "file_name": "mapped_import",
        "status": "processing",
        "total_rows": total_rows,
        "processed_rows": 0,
        "contacts_created": 0,
        "contacts_updated": 0,
        "contacts_skipped": 0,
        "error": None,
        "started_at": now,
        "completed_at": None,
        "column_mapping": request.column_mapping,
        "duplicate_policy": request.duplicate_policy
    }
    
    await db.linkedin_import_jobs.insert_one(import_job)
    
    # Start background processing with mapping
    background_tasks.add_task(
        process_linkedin_import_mapped,
        job_id,
        profile,
        week_start,
        rows,
        request.column_mapping,
        request.duplicate_policy
    )
    
    return {
        "success": True,
        "job_id": job_id,
        "message": f"Import started in background. Processing {total_rows} contacts.",
        "total_rows": total_rows
    }


@router.post("/linkedin-import/start-chunked")
async def start_chunked_import(
    profile: str,
    total_rows: int,
    request: LinkedInChunkStartRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Start a chunked import job - creates job record, client sends chunks.
    This approach is more reliable for large files because:
    1. Each chunk is processed synchronously
    2. Progress is saved after each chunk
    3. If connection drops, import can resume from last chunk
    """
    if profile not in LINKEDIN_PROFILES:
        raise HTTPException(status_code=400, detail="Invalid profile")
    
    week_start = get_current_week_start()
    
    # Check export was requested
    task = await db.linkedin_import_tasks.find_one({"profile": profile, "week_start": week_start})
    if not task or not task.get("export_requested"):
        raise HTTPException(status_code=400, detail="You must first mark the export request checkbox")
    
    job_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    
    import_job = {
        "job_id": job_id,
        "profile": profile,
        "week_start": week_start,
        "file_name": "chunked_import",
        "status": "processing",
        "total_rows": total_rows,
        "processed_rows": 0,
        "contacts_created": 0,
        "contacts_updated": 0,
        "contacts_skipped": 0,
        "contacts_errors": 0,
        "error": None,
        "started_at": now,
        "completed_at": None,
        "column_mapping": request.column_mapping,
        "duplicate_policy": request.duplicate_policy,
        "last_chunk_index": -1,
        "is_chunked": True
    }
    
    await db.linkedin_import_jobs.insert_one(import_job)
    
    return {
        "success": True,
        "job_id": job_id,
        "message": "Chunked import started. Send chunks using /linkedin-import/process-chunk"
    }


@router.post("/linkedin-import/process-chunk")
async def process_import_chunk(
    request: LinkedInChunkImportRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Process a single chunk of contacts synchronously.
    Returns immediately with results - client controls the pace.
    Dedup is ONLY by linkedin_url. Merge overwrites existing values.
    """
    job = await db.linkedin_import_jobs.find_one({"job_id": request.job_id})
    
    if not job:
        raise HTTPException(status_code=404, detail="Import job not found")
    
    if job.get("status") not in ["processing", "paused"]:
        raise HTTPException(status_code=400, detail=f"Job is {job.get('status')}, cannot process chunks")
    
    # Process this chunk
    profile = job["profile"]
    column_mapping = job["column_mapping"]
    duplicate_policy = job["duplicate_policy"]
    
    chunk_created = 0
    chunk_updated = 0
    chunk_skipped = 0
    chunk_errors = 0
    
    for row in request.chunk_data:
        try:
            # Map columns to contact fields
            linkedin_url = row.get(column_mapping.get("linkedin_url", ""), "").strip() if column_mapping.get("linkedin_url") else ""
            email = row.get(column_mapping.get("email", ""), "").strip().lower() if column_mapping.get("email") else ""
            firstname = row.get(column_mapping.get("firstname", ""), "").strip() if column_mapping.get("firstname") else ""
            lastname = row.get(column_mapping.get("lastname", ""), "").strip() if column_mapping.get("lastname") else ""
            company = row.get(column_mapping.get("company", ""), "").strip() if column_mapping.get("company") else ""
            jobtitle = row.get(column_mapping.get("jobtitle", ""), "").strip() if column_mapping.get("jobtitle") else ""
            country = row.get(column_mapping.get("country", ""), "").strip() if column_mapping.get("country") else ""
            connected_on = row.get(column_mapping.get("connected_on", ""), "").strip() if column_mapping.get("connected_on") else ""
            
            # Normalize linkedin_url
            if linkedin_url and not linkedin_url.startswith('http'):
                linkedin_url = f"https://www.linkedin.com/in/{linkedin_url}"
            
            # Skip rows without linkedin_url (required field)
            if not linkedin_url:
                chunk_skipped += 1
                continue
            
            # Check for existing contact by linkedin_url ONLY
            existing = await db.unified_contacts.find_one({"linkedin_url": linkedin_url})
            
            # Apply duplicate policy
            if existing:
                if duplicate_policy == "skip":
                    chunk_skipped += 1
                    continue
                elif duplicate_policy == "merge":
                    # Update existing contact - OVERWRITE with new values if present
                    update_data = {"updated_at": datetime.now(timezone.utc).isoformat()}
                    
                    if firstname:
                        update_data["first_name"] = firstname
                    if lastname:
                        update_data["last_name"] = lastname
                    if company:
                        update_data["company"] = company
                    if jobtitle:
                        update_data["job_title"] = jobtitle
                    if country:
                        update_data["country"] = country
                    if email:
                        update_data["email"] = email
                    
                    if firstname or lastname:
                        full_name = f"{firstname} {lastname}".strip()
                        if full_name:
                            update_data["name"] = full_name
                    
                    update_data["linkedin_accepted_by"] = profile
                    
                    if connected_on:
                        parsed_date = parse_linkedin_date(connected_on)
                        if parsed_date:
                            update_data["linkedin_connected_on"] = parsed_date
                    
                    await db.unified_contacts.update_one(
                        {"_id": existing["_id"]},
                        {"$set": update_data}
                    )
                    chunk_updated += 1
                    continue
            
            # Create new contact (even without email)
            full_name = f"{firstname} {lastname}".strip() or linkedin_url.split("/in/")[-1].split("/")[0].replace("-", " ").title()
            buyer_persona = detect_buyer_persona(jobtitle) if jobtitle else "desconocido"
            
            new_contact = {
                "id": f"contact_{uuid.uuid4().hex[:12]}",
                "linkedin_url": linkedin_url,
                "email": email if email else None,
                "name": full_name,
                "first_name": firstname,
                "last_name": lastname,
                "company": company,
                "job_title": jobtitle,
                "country": country,
                "linkedin_accepted_by": profile,
                "linkedin_connected_on": parse_linkedin_date(connected_on) if connected_on else None,
                "stage": 1,
                "buyer_persona": buyer_persona,
                "source": "linkedin_import",
                "created_at": datetime.now(timezone.utc).isoformat(),
                "updated_at": datetime.now(timezone.utc).isoformat()
            }
            
            await db.unified_contacts.insert_one(new_contact)
            chunk_created += 1
            
        except Exception as e:
            logger.error(f"Error processing row: {e}")
            chunk_errors += 1
    
    # Update job with chunk results
    chunk_processed = len(request.chunk_data)
    
    update_data = {
        "$inc": {
            "processed_rows": chunk_processed,
            "contacts_created": chunk_created,
            "contacts_updated": chunk_updated,
            "contacts_skipped": chunk_skipped,
            "contacts_errors": chunk_errors
        },
        "$set": {
            "last_chunk_index": request.chunk_index
        }
    }
    
    # If last chunk, mark as completed
    if request.is_last_chunk:
        update_data["$set"]["status"] = "completed"
        update_data["$set"]["completed_at"] = datetime.now(timezone.utc).isoformat()
        
        # Mark task as completed
        await db.linkedin_import_tasks.update_one(
            {"profile": profile, "week_start": job["week_start"]},
            {"$set": {"import_completed": True}}
        )
    
    await db.linkedin_import_jobs.update_one({"job_id": request.job_id}, update_data)
    
    # Get updated job
    updated_job = await db.linkedin_import_jobs.find_one({"job_id": request.job_id}, {"_id": 0})
    
    return {
        "success": True,
        "chunk_index": request.chunk_index,
        "chunk_results": {
            "processed": chunk_processed,
            "created": chunk_created,
            "updated": chunk_updated,
            "skipped": chunk_skipped,
            "errors": chunk_errors
        },
        "job_totals": {
            "processed_rows": updated_job["processed_rows"],
            "contacts_created": updated_job["contacts_created"],
            "contacts_updated": updated_job["contacts_updated"],
            "contacts_skipped": updated_job["contacts_skipped"],
            "status": updated_job["status"]
        },
        "is_complete": request.is_last_chunk
    }


async def process_linkedin_import_mapped(
    job_id: str,
    profile: str,
    week_start: str,
    rows: List[dict],
    column_mapping: dict,
    duplicate_policy: str
):
    """Process LinkedIn import with custom column mapping in background.
    Dedup is ONLY by linkedin_url. Merge overwrites existing values."""
    contacts_created = 0
    contacts_updated = 0
    contacts_skipped = 0
    processed_rows = 0
    
    try:
        for row in rows:
            # Map columns to contact fields
            linkedin_url = row.get(column_mapping.get("linkedin_url", ""), "").strip() if column_mapping.get("linkedin_url") else ""
            email = row.get(column_mapping.get("email", ""), "").strip().lower() if column_mapping.get("email") else ""
            firstname = row.get(column_mapping.get("firstname", ""), "").strip() if column_mapping.get("firstname") else ""
            lastname = row.get(column_mapping.get("lastname", ""), "").strip() if column_mapping.get("lastname") else ""
            company = row.get(column_mapping.get("company", ""), "").strip() if column_mapping.get("company") else ""
            jobtitle = row.get(column_mapping.get("jobtitle", ""), "").strip() if column_mapping.get("jobtitle") else ""
            country = row.get(column_mapping.get("country", ""), "").strip() if column_mapping.get("country") else ""
            connected_on = row.get(column_mapping.get("connected_on", ""), "").strip() if column_mapping.get("connected_on") else ""
            
            # Normalize linkedin_url
            if linkedin_url and not linkedin_url.startswith('http'):
                linkedin_url = f"https://www.linkedin.com/in/{linkedin_url}"
            
            # Skip rows without linkedin_url (required field)
            if not linkedin_url:
                contacts_skipped += 1
                processed_rows += 1
                continue
            
            # Check for existing contact by linkedin_url ONLY
            existing = await db.unified_contacts.find_one({"linkedin_url": linkedin_url})
            
            # Apply duplicate policy
            if existing:
                if duplicate_policy == "skip":
                    contacts_skipped += 1
                    processed_rows += 1
                    continue
                elif duplicate_policy == "merge":
                    # Update existing contact - OVERWRITE with new values if present
                    update_data = {"updated_at": datetime.now(timezone.utc).isoformat()}
                    
                    if firstname:
                        update_data["first_name"] = firstname
                    if lastname:
                        update_data["last_name"] = lastname
                    if company:
                        update_data["company"] = company
                    if jobtitle:
                        update_data["job_title"] = jobtitle
                    if country:
                        update_data["country"] = country
                    if email:
                        update_data["email"] = email
                    
                    if firstname or lastname:
                        full_name = f"{firstname} {lastname}".strip()
                        if full_name:
                            update_data["name"] = full_name
                    
                    update_data["linkedin_accepted_by"] = profile
                    
                    if connected_on:
                        parsed_date = parse_linkedin_date(connected_on)
                        if parsed_date:
                            update_data["linkedin_connected_on"] = parsed_date
                    
                    await db.unified_contacts.update_one(
                        {"_id": existing["_id"]},
                        {"$set": update_data}
                    )
                    contacts_updated += 1
                    processed_rows += 1
                    continue
            
            # Create new contact (even without email)
            full_name = f"{firstname} {lastname}".strip() or linkedin_url.split("/in/")[-1].split("/")[0].replace("-", " ").title()
            buyer_persona = detect_buyer_persona(jobtitle) if jobtitle else "desconocido"
            
            new_contact = {
                "id": f"contact_{uuid.uuid4().hex[:12]}",
                "linkedin_url": linkedin_url,
                "email": email if email else None,
                "name": full_name,
                "first_name": firstname,
                "last_name": lastname,
                "company": company,
                "job_title": jobtitle,
                "country": country,
                "linkedin_accepted_by": profile,
                "linkedin_connected_on": parse_linkedin_date(connected_on) if connected_on else None,
                "stage": 1,
                "buyer_persona": buyer_persona,
                "source": "linkedin_import",
                "created_at": datetime.now(timezone.utc).isoformat(),
                "updated_at": datetime.now(timezone.utc).isoformat()
            }
            
            await db.unified_contacts.insert_one(new_contact)
            contacts_created += 1
            processed_rows += 1
            
            # Update job progress every 50 rows
            if processed_rows % 50 == 0:
                await db.linkedin_import_jobs.update_one(
                    {"job_id": job_id},
                    {"$set": {
                        "processed_rows": processed_rows,
                        "contacts_created": contacts_created,
                        "contacts_updated": contacts_updated,
                        "contacts_skipped": contacts_skipped
                    }}
                )
        
        # Mark job as completed
        await db.linkedin_import_jobs.update_one(
            {"job_id": job_id},
            {"$set": {
                "status": "completed",
                "processed_rows": processed_rows,
                "contacts_created": contacts_created,
                "contacts_updated": contacts_updated,
                "contacts_skipped": contacts_skipped,
                "completed_at": datetime.now(timezone.utc).isoformat()
            }}
        )
        
        # Mark task as completed
        await db.linkedin_import_tasks.update_one(
            {"profile": profile, "week_start": week_start},
            {"$set": {"import_completed": True}}
        )
        
    except Exception as e:
        # Mark job as failed
        await db.linkedin_import_jobs.update_one(
            {"job_id": job_id},
            {"$set": {
                "status": "failed",
                "error_message": str(e),
                "completed_at": datetime.now(timezone.utc).isoformat()
            }}
        )


def detect_buyer_persona(job_title: str) -> str:
    """Detect buyer persona from job title"""
    if not job_title:
        return "desconocido"
    
    title_lower = job_title.lower()
    
    # Executive/C-Level
    if any(x in title_lower for x in ["ceo", "cfo", "coo", "cto", "cmo", "director general", "presidente", "owner", "fundador", "founder"]):
        return "tomador_de_decision"
    
    # Director level
    if any(x in title_lower for x in ["director", "vp", "vice president", "head of", "chief"]):
        return "tomador_de_decision"
    
    # Manager level
    if any(x in title_lower for x in ["manager", "gerente", "jefe", "lead", "supervisor", "coordinador"]):
        return "influenciador"
    
    # Specialist level
    if any(x in title_lower for x in ["specialist", "especialista", "analyst", "analista", "consultant", "consultor"]):
        return "usuario"
    
    return "desconocido"


@router.get("/linkedin-import/status/{job_id}")
async def get_import_status(
    job_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get the status of a background import job"""
    job = await db.linkedin_import_jobs.find_one({"job_id": job_id}, {"_id": 0})
    
    if not job:
        raise HTTPException(status_code=404, detail="Import job not found")
    
    # Calculate progress percentage
    progress = 0
    if job.get("total_rows", 0) > 0:
        progress = round((job.get("processed_rows", 0) / job["total_rows"]) * 100, 1)
    
    # Check if job is stuck (processing for more than 30 minutes without progress)
    is_stuck = False
    if job.get("status") == "processing" and job.get("started_at"):
        started = datetime.fromisoformat(job["started_at"].replace('Z', '+00:00'))
        elapsed = datetime.now(timezone.utc) - started
        if elapsed.total_seconds() > 1800:  # 30 minutes
            is_stuck = True
    
    return {
        **job,
        "progress_percent": progress,
        "is_stuck": is_stuck
    }


@router.post("/linkedin-import/cancel/{job_id}")
async def cancel_import_job(
    job_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Cancel a stuck or processing import job"""
    job = await db.linkedin_import_jobs.find_one({"job_id": job_id})
    
    if not job:
        raise HTTPException(status_code=404, detail="Import job not found")
    
    if job.get("status") == "completed":
        raise HTTPException(status_code=400, detail="Cannot cancel a completed job")
    
    now = datetime.now(timezone.utc).isoformat()
    
    await db.linkedin_import_jobs.update_one(
        {"job_id": job_id},
        {"$set": {
            "status": "cancelled",
            "error": "Cancelled by user",
            "completed_at": now
        }}
    )
    
    # Reset the task so user can retry
    await db.linkedin_import_tasks.update_one(
        {"profile": job["profile"], "week_start": job["week_start"]},
        {"$set": {"import_completed": False}}
    )
    
    return {
        "success": True,
        "message": "Job cancelled. You can now retry the import.",
        "job_id": job_id
    }


@router.post("/linkedin-import/reset-stuck")
async def reset_stuck_jobs(
    current_user: dict = Depends(get_current_user)
):
    """Reset all stuck jobs (processing for more than 1 hour)"""
    now = datetime.now(timezone.utc)
    one_hour_ago = (now - timedelta(hours=1)).isoformat()
    
    # Find stuck jobs
    stuck_jobs = await db.linkedin_import_jobs.find({
        "status": "processing",
        "started_at": {"$lt": one_hour_ago}
    }).to_list(100)
    
    reset_count = 0
    for job in stuck_jobs:
        await db.linkedin_import_jobs.update_one(
            {"job_id": job["job_id"]},
            {"$set": {
                "status": "failed",
                "error": "Job timed out after 1 hour. Please retry with smaller file or contact support.",
                "completed_at": now.isoformat()
            }}
        )
        
        # Reset task
        await db.linkedin_import_tasks.update_one(
            {"profile": job["profile"], "week_start": job["week_start"]},
            {"$set": {"import_completed": False}}
        )
        reset_count += 1
    
    return {
        "success": True,
        "reset_count": reset_count,
        "message": f"Reset {reset_count} stuck jobs. You can now retry imports."
    }


@router.get("/linkedin-import/all-jobs")
async def get_all_import_jobs(
    current_user: dict = Depends(get_current_user)
):
    """Get all import jobs for debugging"""
    jobs = await db.linkedin_import_jobs.find(
        {},
        {"_id": 0}
    ).sort("started_at", -1).to_list(50)
    
    return {"jobs": jobs}


@router.get("/linkedin-import/profile-status/{profile}")
async def get_profile_import_status(
    profile: str,
    current_user: dict = Depends(get_current_user)
):
    """Get the latest import job status for a profile this week"""
    if profile not in LINKEDIN_PROFILES:
        raise HTTPException(status_code=400, detail="Invalid profile")
    
    week_start = get_current_week_start()
    
    # Get latest job for this profile/week
    job = await db.linkedin_import_jobs.find_one(
        {"profile": profile, "week_start": week_start},
        {"_id": 0},
        sort=[("started_at", -1)]
    )
    
    # Get task info
    task = await db.linkedin_import_tasks.find_one(
        {"profile": profile, "week_start": week_start},
        {"_id": 0}
    )
    
    return {
        "profile": profile,
        "week_start": week_start,
        "export_requested": task.get("export_requested", False) if task else False,
        "import_completed": task.get("import_completed", False) if task else False,
        "latest_job": job
    }


async def process_linkedin_import_background(
    job_id: str,
    profile: str,
    week_start: str,
    rows: list,
    file_name: str
):
    """
    Background task to process LinkedIn contacts import.
    Updates progress in database so frontend can poll for status.
    Dedup is ONLY by linkedin_url. Merge overwrites existing values.
    """
    from motor.motor_asyncio import AsyncIOMotorClient
    import os
    
    # Create new database connection for background task
    mongo_url = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
    db_name = os.environ.get("DB_NAME", "leaderlix")
    client = AsyncIOMotorClient(mongo_url)
    bg_db = client[db_name]
    
    try:
        # Import buyer persona classifier
        from routers.events_v2 import classify_buyer_persona_by_job_title
        
        contacts_created = 0
        contacts_updated = 0
        contacts_skipped = 0
        processed_rows = 0
        now = datetime.now(timezone.utc).isoformat()
        
        # Process in batches for better performance and progress updates
        batch_size = 100
        
        for i, row in enumerate(rows):
            try:
                # Map CSV columns to fields (standard LinkedIn export format)
                first_name = row.get('First Name', '').strip()
                last_name = row.get('Last Name', '').strip()
                linkedin_url = row.get('URL', '').strip()
                email = row.get('Email Address', '').strip().lower() if row.get('Email Address') else ''
                company = row.get('Company', '').strip()
                position = row.get('Position', '').strip()
                connected_on_raw = row.get('Connected On', '').strip()
                
                # Normalize linkedin_url
                if linkedin_url and not linkedin_url.startswith('http'):
                    linkedin_url = f"https://www.linkedin.com/in/{linkedin_url}"
                
                # Skip rows without linkedin_url (required field)
                if not linkedin_url:
                    contacts_skipped += 1
                    processed_rows += 1
                    continue
                
                name = f"{first_name} {last_name}".strip() or linkedin_url.split("/in/")[-1].split("/")[0].replace("-", " ").title()
                
                # Parse Connected On date
                connected_on_date = parse_linkedin_date(connected_on_raw) if connected_on_raw else None
                
                # DEDUP: ONLY by linkedin_url
                existing = await bg_db.unified_contacts.find_one({"linkedin_url": linkedin_url})
                
                if existing:
                    # MERGE: Update existing contact - OVERWRITE with new values
                    update_data = {"updated_at": now}
                    
                    if first_name:
                        update_data["first_name"] = first_name
                    if last_name:
                        update_data["last_name"] = last_name
                    if name:
                        update_data["name"] = name
                    if company:
                        update_data["company"] = company
                    if position:
                        update_data["job_title"] = position
                    if email:
                        update_data["email"] = email
                    if connected_on_date:
                        update_data["first_connected_on_linkedin"] = connected_on_date
                    
                    update_data["linkedin_accepted_by"] = profile
                    
                    # Buyer Persona - update if better classification available
                    if position:
                        new_bp = await classify_buyer_persona_by_job_title(position)
                        if new_bp and new_bp != "mateo":
                            update_data["buyer_persona"] = new_bp
                    
                    await bg_db.unified_contacts.update_one(
                        {"id": existing["id"]},
                        {"$set": update_data}
                    )
                    contacts_updated += 1
                else:
                    # CREATE: New contact (even without email)
                    contact_id = str(uuid.uuid4())
                    
                    buyer_persona = "mateo"
                    if position:
                        buyer_persona = await classify_buyer_persona_by_job_title(position)
                    
                    new_contact = {
                        "id": contact_id,
                        "name": name,
                        "first_name": first_name,
                        "last_name": last_name,
                        "email": email if email else None,
                        "company": company if company else None,
                        "job_title": position if position else None,
                        "linkedin_url": linkedin_url,
                        "first_connected_on_linkedin": connected_on_date,
                        "linkedin_accepted_by": profile,
                        "stage": 2,
                        "qualification_status": "pending",
                        "buyer_persona": buyer_persona,
                        "source": f"linkedin_connections_{profile.lower()}",
                        "source_details": {
                            "imported_by": profile,
                            "imported_at": now,
                            "file_name": file_name
                        },
                        "created_at": now,
                        "updated_at": now
                    }
                    
                    await bg_db.unified_contacts.insert_one(new_contact)
                    contacts_created += 1
                
                processed_rows += 1
                
                # Update progress every batch_size rows
                if processed_rows % batch_size == 0:
                    await bg_db.linkedin_import_jobs.update_one(
                        {"job_id": job_id},
                        {"$set": {
                            "processed_rows": processed_rows,
                            "contacts_created": contacts_created,
                            "contacts_updated": contacts_updated,
                            "contacts_skipped": contacts_skipped
                        }}
                    )
                    
            except Exception as row_error:
                logger.error(f"Error processing row {i}: {row_error}")
                contacts_skipped += 1
                processed_rows += 1
        
        # Final update
        completion_time = datetime.now(timezone.utc).isoformat()
        await bg_db.linkedin_import_jobs.update_one(
            {"job_id": job_id},
            {"$set": {
                "status": "completed",
                "processed_rows": processed_rows,
                "contacts_created": contacts_created,
                "contacts_updated": contacts_updated,
                "contacts_skipped": contacts_skipped,
                "completed_at": completion_time
            }}
        )
        
        # Update import task to mark as completed
        await bg_db.linkedin_import_tasks.update_one(
            {"profile": profile, "week_start": week_start},
            {
                "$set": {
                    "import_completed": True,
                    "import_completed_at": completion_time
                },
                "$inc": {"contacts_imported": contacts_created + contacts_updated}
            },
            upsert=True
        )
        
        logger.info(f"Import job {job_id} completed: {contacts_created} created, {contacts_updated} updated, {contacts_skipped} skipped")
        
    except Exception as e:
        logger.error(f"Import job {job_id} failed: {e}")
        await bg_db.linkedin_import_jobs.update_one(
            {"job_id": job_id},
            {"$set": {
                "status": "failed",
                "error": str(e),
                "completed_at": datetime.now(timezone.utc).isoformat()
            }}
        )
    finally:
        client.close()


# ============ ROBUST SERVER-SIDE IMPORT ============

def process_import_in_thread(job_id: str, profile: str, week_start: str, rows: list, column_mapping: dict, duplicate_policy: str):
    """
    Process import in a separate thread - completely server-side.
    This runs independently of the HTTP request lifecycle.
    """
    # Create new event loop for this thread
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    
    try:
        loop.run_until_complete(
            _process_import_async(job_id, profile, week_start, rows, column_mapping, duplicate_policy)
        )
    except Exception as e:
        logger.error(f"Thread import failed for job {job_id}: {e}")
    finally:
        loop.close()


async def _process_import_async(job_id: str, profile: str, week_start: str, rows: list, column_mapping: dict, duplicate_policy: str):
    """Async implementation of the import processing."""
    from motor.motor_asyncio import AsyncIOMotorClient
    
    mongo_url = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
    db_name = os.environ.get("DB_NAME", "leaderlix")
    client = AsyncIOMotorClient(mongo_url)
    bg_db = client[db_name]
    
    contacts_created = 0
    contacts_updated = 0
    contacts_skipped = 0
    contacts_errors = 0
    processed_rows = 0
    
    try:
        # Import buyer persona classifier
        from routers.events_v2 import classify_buyer_persona_by_job_title
        
        batch_size = 100  # Update progress every 100 rows
        
        for i, row in enumerate(rows):
            # Check if job was cancelled
            if i % 50 == 0:  # Check every 50 rows
                job = await bg_db.linkedin_import_jobs.find_one({"job_id": job_id})
                if job and job.get("status") == "cancelled":
                    logger.info(f"Job {job_id} was cancelled at row {i}")
                    break
            
            try:
                # Extract fields based on column mapping
                linkedin_url = row.get(column_mapping.get("linkedin_url", ""), "").strip() if column_mapping.get("linkedin_url") else ""
                email = row.get(column_mapping.get("email", ""), "").strip().lower() if column_mapping.get("email") else ""
                firstname = row.get(column_mapping.get("firstname", ""), "").strip() if column_mapping.get("firstname") else ""
                lastname = row.get(column_mapping.get("lastname", ""), "").strip() if column_mapping.get("lastname") else ""
                company = row.get(column_mapping.get("company", ""), "").strip() if column_mapping.get("company") else ""
                jobtitle = row.get(column_mapping.get("jobtitle", ""), "").strip() if column_mapping.get("jobtitle") else ""
                country = row.get(column_mapping.get("country", ""), "").strip() if column_mapping.get("country") else ""
                connected_on = row.get(column_mapping.get("connected_on", ""), "").strip() if column_mapping.get("connected_on") else ""
                
                # Normalize linkedin_url
                if linkedin_url and not linkedin_url.startswith('http'):
                    linkedin_url = f"https://www.linkedin.com/in/{linkedin_url}"
                
                # Skip rows without linkedin_url
                if not linkedin_url:
                    contacts_skipped += 1
                    processed_rows += 1
                    continue
                
                # Dedup by linkedin_url only
                existing = await bg_db.unified_contacts.find_one({"linkedin_url": linkedin_url})
                
                now = datetime.now(timezone.utc).isoformat()
                
                if existing:
                    if duplicate_policy == "skip":
                        contacts_skipped += 1
                    elif duplicate_policy == "merge":
                        # Overwrite with new values
                        update_data = {"updated_at": now, "linkedin_accepted_by": profile}
                        
                        if firstname:
                            update_data["first_name"] = firstname
                        if lastname:
                            update_data["last_name"] = lastname
                        if company:
                            update_data["company"] = company
                        if jobtitle:
                            update_data["job_title"] = jobtitle
                        if country:
                            update_data["country"] = country
                        if email:
                            update_data["email"] = email
                        if firstname or lastname:
                            full_name = f"{firstname} {lastname}".strip()
                            if full_name:
                                update_data["name"] = full_name
                        if connected_on:
                            parsed_date = parse_linkedin_date(connected_on)
                            if parsed_date:
                                update_data["linkedin_connected_on"] = parsed_date
                        
                        # Update buyer persona if we have job title
                        if jobtitle:
                            new_bp = await classify_buyer_persona_by_job_title(jobtitle)
                            if new_bp and new_bp != "mateo":
                                update_data["buyer_persona"] = new_bp
                        
                        await bg_db.unified_contacts.update_one(
                            {"_id": existing["_id"]},
                            {"$set": update_data}
                        )
                        contacts_updated += 1
                else:
                    # Create new contact
                    full_name = f"{firstname} {lastname}".strip() or linkedin_url.split("/in/")[-1].split("/")[0].replace("-", " ").title()
                    
                    buyer_persona = "desconocido"
                    if jobtitle:
                        buyer_persona = await classify_buyer_persona_by_job_title(jobtitle)
                    
                    new_contact = {
                        "id": f"contact_{uuid.uuid4().hex[:12]}",
                        "linkedin_url": linkedin_url,
                        "email": email if email else None,
                        "name": full_name,
                        "first_name": firstname,
                        "last_name": lastname,
                        "company": company,
                        "job_title": jobtitle,
                        "country": country,
                        "linkedin_accepted_by": profile,
                        "linkedin_connected_on": parse_linkedin_date(connected_on) if connected_on else None,
                        "stage": 1,
                        "buyer_persona": buyer_persona,
                        "source": "linkedin_import",
                        "created_at": now,
                        "updated_at": now
                    }
                    
                    await bg_db.unified_contacts.insert_one(new_contact)
                    contacts_created += 1
                
                processed_rows += 1
                
                # Update progress periodically
                if processed_rows % batch_size == 0:
                    await bg_db.linkedin_import_jobs.update_one(
                        {"job_id": job_id},
                        {"$set": {
                            "processed_rows": processed_rows,
                            "contacts_created": contacts_created,
                            "contacts_updated": contacts_updated,
                            "contacts_skipped": contacts_skipped,
                            "contacts_errors": contacts_errors,
                            "last_activity": datetime.now(timezone.utc).isoformat()
                        }}
                    )
                    
            except Exception as row_error:
                logger.error(f"Error processing row {i}: {row_error}")
                contacts_errors += 1
                processed_rows += 1
        
        # Check if cancelled
        final_job = await bg_db.linkedin_import_jobs.find_one({"job_id": job_id})
        was_cancelled = final_job and final_job.get("status") == "cancelled"
        
        # Final update
        final_status = "cancelled" if was_cancelled else "completed"
        await bg_db.linkedin_import_jobs.update_one(
            {"job_id": job_id},
            {"$set": {
                "status": final_status,
                "processed_rows": processed_rows,
                "contacts_created": contacts_created,
                "contacts_updated": contacts_updated,
                "contacts_skipped": contacts_skipped,
                "contacts_errors": contacts_errors,
                "completed_at": datetime.now(timezone.utc).isoformat()
            }}
        )
        
        # Mark task as completed if not cancelled
        if not was_cancelled:
            await bg_db.linkedin_import_tasks.update_one(
                {"profile": profile, "week_start": week_start},
                {"$set": {"import_completed": True, "import_completed_at": datetime.now(timezone.utc).isoformat()}},
                upsert=True
            )
        
        logger.info(f"Import job {job_id} {final_status}: {contacts_created} created, {contacts_updated} updated, {contacts_skipped} skipped, {contacts_errors} errors")
        
    except Exception as e:
        logger.error(f"Import job {job_id} failed: {e}")
        await bg_db.linkedin_import_jobs.update_one(
            {"job_id": job_id},
            {"$set": {
                "status": "failed",
                "error": str(e),
                "completed_at": datetime.now(timezone.utc).isoformat()
            }}
        )
    finally:
        client.close()



@router.post("/linkedin-import/import-data")
async def import_linkedin_data(
    profile: str,
    request: LinkedInDataImportRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Import parsed CSV data directly. Frontend sends JSON, backend processes in background.
    This is the simplest and most reliable approach.
    """
    if profile not in LINKEDIN_PROFILES:
        raise HTTPException(status_code=400, detail="Invalid profile")
    
    week_start = get_current_week_start()
    
    task = await db.linkedin_import_tasks.find_one({"profile": profile, "week_start": week_start})
    if not task or not task.get("export_requested"):
        raise HTTPException(status_code=400, detail="Primero marca la casilla de solicitud de exportación")
    
    if not request.data:
        raise HTTPException(status_code=400, detail="No hay datos para importar")
    
    if not request.column_mapping.get("linkedin_url"):
        raise HTTPException(status_code=400, detail="Falta el mapeo de la columna URL de LinkedIn")
    
    job_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    total_rows = len(request.data)
    
    import_job = {
        "job_id": job_id,
        "profile": profile,
        "week_start": week_start,
        "file_name": "data_import",
        "status": "processing",
        "total_rows": total_rows,
        "processed_rows": 0,
        "contacts_created": 0,
        "contacts_updated": 0,
        "contacts_skipped": 0,
        "contacts_errors": 0,
        "error": None,
        "started_at": now,
        "completed_at": None,
        "last_activity": now,
        "column_mapping": request.column_mapping,
        "duplicate_policy": request.duplicate_policy,
        "is_server_side": True
    }
    
    await db.linkedin_import_jobs.insert_one(import_job)
    
    # Start processing in background thread
    thread = threading.Thread(
        target=process_import_in_thread,
        args=(job_id, profile, week_start, request.data, request.column_mapping, request.duplicate_policy),
        daemon=True
    )
    thread.start()
    
    return {
        "success": True,
        "job_id": job_id,
        "total_rows": total_rows,
        "message": f"Importación iniciada. Procesando {total_rows} contactos."
    }



@router.post("/linkedin-import/upload-server-side")
async def upload_linkedin_import_server_side(
    profile: str,
    file: UploadFile = File(...),
    duplicate_policy: str = "merge",
    current_user: dict = Depends(get_current_user)
):
    """
    Upload CSV file for server-side processing.
    The file is parsed and processed entirely on the server in a background thread.
    Frontend can poll for status - processing continues even if browser is closed.
    """
    if profile not in LINKEDIN_PROFILES:
        raise HTTPException(status_code=400, detail="Invalid profile")
    
    if not file.filename.endswith('.csv'):
        raise HTTPException(status_code=400, detail="File must be CSV")
    
    week_start = get_current_week_start()
    
    # Check export was requested
    task = await db.linkedin_import_tasks.find_one({"profile": profile, "week_start": week_start})
    if not task or not task.get("export_requested"):
        raise HTTPException(status_code=400, detail="You must first mark the export request checkbox")
    
    # Read and parse CSV
    content = await file.read()
    logger.info(f"[UPLOAD] File size: {len(content)} bytes")
    
    # Decode
    decoded = None
    for encoding in ['utf-8', 'utf-8-sig', 'latin-1', 'cp1252']:
        try:
            decoded = content.decode(encoding)
            break
        except UnicodeDecodeError:
            continue
    
    if not decoded:
        raise HTTPException(status_code=400, detail="Could not decode CSV file")
    
    logger.info(f"[UPLOAD] Decoded content length: {len(decoded)}, first 200 chars: {decoded[:200]}")
    
    # Detect delimiter
    first_line = decoded.split('\n')[0] if decoded else ''
    delimiter = '\t' if '\t' in first_line else ','
    logger.info(f"[UPLOAD] Detected delimiter: {'TAB' if delimiter == chr(9) else 'COMMA'}")
    
    # Parse CSV
    reader = csv.DictReader(io.StringIO(decoded), delimiter=delimiter)
    rows = list(reader)
    total_rows = len(rows)
    logger.info(f"[UPLOAD] Parsed {total_rows} rows")
    
    if total_rows == 0:
        raise HTTPException(status_code=400, detail="CSV file is empty")
    
    # Get headers for auto-mapping
    headers = list(rows[0].keys()) if rows else []
    logger.info(f"[UPLOAD] Headers found: {headers}")
    
    # Log first row for debugging
    if rows:
        logger.info(f"[UPLOAD] First row: {rows[0]}")
    
    # Auto-detect column mapping
    column_mapping = auto_detect_column_mapping(headers)
    logger.info(f"[UPLOAD] Column mapping: {column_mapping}")
    
    # Check if we have linkedin_url mapped
    if not column_mapping.get("linkedin_url"):
        raise HTTPException(
            status_code=400, 
            detail=f"Could not find LinkedIn URL column. Found columns: {headers}"
        )
    
    # Create job
    job_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    
    import_job = {
        "job_id": job_id,
        "profile": profile,
        "week_start": week_start,
        "file_name": file.filename,
        "status": "processing",
        "total_rows": total_rows,
        "processed_rows": 0,
        "contacts_created": 0,
        "contacts_updated": 0,
        "contacts_skipped": 0,
        "contacts_errors": 0,
        "error": None,
        "started_at": now,
        "completed_at": None,
        "last_activity": now,
        "column_mapping": column_mapping,
        "duplicate_policy": duplicate_policy,
        "is_server_side": True
    }
    
    await db.linkedin_import_jobs.insert_one(import_job)
    
    # Start processing in background thread
    thread = threading.Thread(
        target=process_import_in_thread,
        args=(job_id, profile, week_start, rows, column_mapping, duplicate_policy),
        daemon=True
    )
    thread.start()
    
    # Return detailed info for debugging
    return {
        "success": True,
        "job_id": job_id,
        "total_rows": total_rows,
        "column_mapping": column_mapping,
        "headers_detected": headers,
        "first_row_sample": rows[0] if rows else None,
        "message": f"Import started. Processing {total_rows} contacts server-side."
    }


def auto_detect_column_mapping(headers: list) -> dict:
    """Auto-detect column mapping from CSV headers."""
    mapping = {}
    headers_lower = [h.lower().strip() for h in headers]
    
    patterns = {
        "linkedin_url": ["url", "linkedin url", "profile url", "linkedin", "profile"],
        "email": ["email", "e-mail", "correo", "email address"],
        "firstname": ["first name", "firstname", "nombre", "first"],
        "lastname": ["last name", "lastname", "apellido", "apellidos", "last"],
        "company": ["company", "empresa", "organization", "compañía", "company name"],
        "jobtitle": ["position", "job title", "jobtitle", "cargo", "title", "puesto"],
        "country": ["country", "país", "pais", "location", "region"],
        "connected_on": ["connected on", "connection date", "fecha conexión", "date"],
    }
    
    for field, keywords in patterns.items():
        for i, header in enumerate(headers_lower):
            if any(k in header for k in keywords):
                mapping[field] = headers[i]  # Use original case
                break
    
    return mapping




def parse_linkedin_date(date_str: str) -> str:
    """
    Parse LinkedIn date format: "04 nov 2024" (supports ES/EN month names)
    Returns ISO format string or None if parsing fails
    """
    if not date_str:
        return None
    
    # Month mappings (first 3 letters) - ES and EN
    month_map = {
        # English
        'jan': 1, 'feb': 2, 'mar': 3, 'apr': 4, 'may': 5, 'jun': 6,
        'jul': 7, 'aug': 8, 'sep': 9, 'oct': 10, 'nov': 11, 'dec': 12,
        # Spanish
        'ene': 1, 'abr': 4, 'ago': 8, 'dic': 12,
        # Spanish full forms that might appear
        'enero': 1, 'febrero': 2, 'marzo': 3, 'abril': 4, 'mayo': 5, 'junio': 6,
        'julio': 7, 'agosto': 8, 'septiembre': 9, 'octubre': 10, 'noviembre': 11, 'diciembre': 12,
    }
    
    try:
        # Clean and split: "04 nov 2024" -> ["04", "nov", "2024"]
        parts = date_str.lower().strip().split()
        if len(parts) != 3:
            return None
        
        day = int(parts[0])
        month_str = parts[1][:3]  # First 3 letters
        year = int(parts[2])
        
        month = month_map.get(month_str)
        if not month:
            return None
        
        # Return ISO format
        return f"{year}-{month:02d}-{day:02d}"
    except (ValueError, IndexError):
        return None


# ============ ACTIVE COMPANIES ============

@router.get("/active-companies")
async def get_active_companies(
    current_user: dict = Depends(get_current_user)
):
    """
    Get list of outbound companies from unified_companies.
    Returns companies with classification='outbound', sorted by case count.
    Optimized: pre-loads all searches in one query.
    """
    # Get all outbound companies from unified_companies
    companies_list = await db.unified_companies.find(
        {"classification": "outbound", "is_merged": {"$ne": True}},
        {"_id": 0}
    ).to_list(500)
    
    if not companies_list:
        return {"companies": [], "total": 0}
    
    # Get company IDs for bulk search lookup
    company_ids = [c.get("id") for c in companies_list if c.get("id")]
    
    # Bulk load all searches for these companies
    all_searches = await db.linkedin_searches.find(
        {"company_id": {"$in": company_ids}},
        {"_id": 0}
    ).to_list(1000)
    
    # Index searches by company_id
    searches_by_company = {}
    for search in all_searches:
        cid = search.get("company_id")
        if cid not in searches_by_company:
            searches_by_company[cid] = []
        searches_by_company[cid].append(search)
    
    # Build result with searches (skip case count for performance)
    companies = []
    for company in companies_list:
        name = company.get("name", "")
        if not name:
            continue
        
        company["searches"] = searches_by_company.get(company.get("id"), [])
        company["case_count"] = 0  # Skip expensive regex query
        company["is_active"] = True
        companies.append(company)
    
    # Sort by name since we're not counting cases anymore
    companies.sort(key=lambda x: x.get("name", "").lower())
    
    return {
        "companies": companies,
        "total": len(companies)
    }


@router.post("/companies/{company_id}/searches")
async def add_search_to_company(
    company_id: str,
    request: LinkedInSearchCreate,
    current_user: dict = Depends(get_current_user)
):
    """Add a LinkedIn search URL to a company"""
    # Check unified_companies (single source)
    company = await db.unified_companies.find_one({
        "$or": [{"id": company_id}, {"hubspot_id": company_id}],
        "is_merged": {"$ne": True}
    })
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    
    import uuid
    now = datetime.now(timezone.utc).isoformat()
    
    search = {
        "id": str(uuid.uuid4()),
        "company_id": company_id,
        "keyword": request.keyword,
        "url": request.url,
        "created_at": now,
        "last_prospected_at": None,
        "last_prospected_by": None
    }
    
    await db.linkedin_searches.insert_one(search)
    
    return {
        "success": True,
        "search": {k: v for k, v in search.items() if k != "_id"}
    }


@router.delete("/searches/{search_id}")
async def delete_search(
    search_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Delete a LinkedIn search"""
    result = await db.linkedin_searches.delete_one({"id": search_id})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Search not found")
    
    return {"success": True}


@router.post("/searches/{search_id}/mark-copied")
async def mark_search_copied(
    search_id: str,
    request: MarkSearchCopiedRequest,
    current_user: dict = Depends(get_current_user)
):
    """Mark a search as copied/used for prospection"""
    if request.profile not in LINKEDIN_PROFILES:
        raise HTTPException(status_code=400, detail=f"Invalid profile. Must be one of: {list(LINKEDIN_PROFILES.keys())}")
    
    now = datetime.now(timezone.utc).isoformat()
    
    result = await db.linkedin_searches.update_one(
        {"id": search_id},
        {"$set": {
            "last_prospected_at": now,
            "last_prospected_by": request.profile
        }}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Search not found")
    
    return {
        "success": True,
        "search_id": search_id,
        "prospected_at": now,
        "prospected_by": request.profile,
        "prospected_by_name": LINKEDIN_PROFILES[request.profile]
    }


@router.get("/queue/{profile}")
async def get_prospection_queue(
    profile: str,
    current_user: dict = Depends(get_current_user)
):
    """Get the prospection queue for a profile, ordered by oldest first"""
    if profile not in LINKEDIN_PROFILES:
        raise HTTPException(status_code=400, detail=f"Invalid profile. Must be one of: {list(LINKEDIN_PROFILES.keys())}")
    
    # Get all searches, excluding ones already done today by this profile
    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0).isoformat()
    
    # Get searches not done today by this profile
    searches = await db.linkedin_searches.find(
        {
            "$or": [
                {"last_prospected_at": {"$lt": today_start}},
                {"last_prospected_at": {"$exists": False}},
                {"last_prospected_at": None},
                {"last_prospected_by": {"$ne": profile}}
            ]
        },
        {"_id": 0}
    ).sort("last_prospected_at", 1).to_list(500)
    
    # Enrich with company info from unified_companies
    for search in searches:
        company = await db.unified_companies.find_one(
            {"$or": [{"id": search["company_id"]}, {"hubspot_id": search["company_id"]}]},
            {"_id": 0, "name": 1}
        )
        search["company_name"] = company["name"] if company else "Unknown"
    
    return {
        "profile": profile,
        "profile_name": LINKEDIN_PROFILES[profile],
        "queue": searches,
        "total": len(searches)
    }


# ============ COMPANY MANAGEMENT ============

@router.patch("/companies/{company_id}/toggle-active")
async def toggle_company_active(
    company_id: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Toggle a company's classification between inbound and outbound.
    For backward compatibility, returns is_active (outbound=True, inbound=False).
    """
    # Check unified_companies (single source)
    company = await db.unified_companies.find_one({
        "$or": [{"id": company_id}, {"hubspot_id": company_id}],
        "is_merged": {"$ne": True}
    })
    
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    
    now = datetime.now(timezone.utc).isoformat()
    
    # Toggle classification
    current_classification = company.get("classification", "inbound")
    new_classification = "inbound" if current_classification == "outbound" else "outbound"
    
    update_data = {
        "classification": new_classification,
        "updated_at": now
    }
    
    if new_classification == "outbound":
        update_data["outbound_since"] = now
        update_data["outbound_source"] = "manual_toggle"
    
    await db.unified_companies.update_one(
        {"$or": [{"id": company_id}, {"hubspot_id": company_id}]},
        {"$set": update_data}
    )
    
    return {
        "success": True,
        "company_id": company_id,
        "is_active": new_classification == "outbound",
        "classification": new_classification
    }


@router.post("/companies/merge")
async def merge_companies(
    request: MergeCompaniesRequest,
    current_user: dict = Depends(get_current_user)
):
    """Merge multiple companies into one"""
    if request.target_id in request.source_ids:
        raise HTTPException(status_code=400, detail="Target company cannot be in source list")
    
    # Get target from unified_companies
    target = await db.unified_companies.find_one({
        "$or": [{"id": request.target_id}, {"hubspot_id": request.target_id}],
        "is_merged": {"$ne": True}
    })
    
    if not target:
        raise HTTPException(status_code=404, detail="Target company not found")
    
    now = datetime.now(timezone.utc).isoformat()
    
    # Get source companies from unified_companies
    sources = []
    sources_unified = await db.unified_companies.find(
        {"$or": [
            {"id": {"$in": request.source_ids}},
            {"hubspot_id": {"$in": request.source_ids}}
        ], "is_merged": {"$ne": True}}
    ).to_list(100)
    
    sources = sources_unified
    source_names = [s.get("name") for s in sources]
    
    # Update all contacts referencing source companies
    contacts_updated = 0
    for source in sources:
        source_name = source.get("name")
        if source_name:
            result = await db.unified_contacts.update_many(
                {"company": {"$regex": f"^{re.escape(source_name)}$", "$options": "i"}},
                {"$set": {"company": request.target_name, "updated_at": now}}
            )
            contacts_updated += result.modified_count
    
    # Update all cases referencing source companies (both company_name and company_names)
    cases_updated = 0
    for source in sources:
        source_name = source.get("name")
        if source_name:
            # Update company_name field
            result = await db.cases.update_many(
                {"company_name": {"$regex": f"^{re.escape(source_name)}$", "$options": "i"}},
                {"$set": {"company_name": request.target_name, "updated_at": now}}
            )
            cases_updated += result.modified_count
            
            # Update company_names array - replace the matching name
            await db.cases.update_many(
                {"company_names": {"$elemMatch": {"$regex": f"^{re.escape(source_name)}$", "$options": "i"}}},
                {"$set": {"company_names.$[elem]": request.target_name, "updated_at": now}},
                array_filters=[{"elem": {"$regex": f"^{re.escape(source_name)}$", "$options": "i"}}]
            )
    
    # Move searches from source companies to target
    searches_moved = 0
    for source_id in request.source_ids:
        result = await db.linkedin_searches.update_many(
            {"company_id": source_id},
            {"$set": {"company_id": request.target_id}}
        )
        searches_moved += result.modified_count
    
    # Mark source companies as merged in unified_companies only
    await db.unified_companies.update_many(
        {"$or": [
            {"id": {"$in": request.source_ids}},
            {"hubspot_id": {"$in": request.source_ids}}
        ]},
        {"$set": {
            "is_merged": True,
            "merged_into_company_id": request.target_id,
            "merged_at": now
        }}
    )
    
    # Collect all aliases and domains from source companies
    all_aliases = set(source_names)  # Add source names as aliases
    all_domains = set()
    
    for source in sources:
        # Add existing aliases from source
        for alias in source.get("aliases", []):
            if alias:
                all_aliases.add(alias)
        # Add domains from source
        if source.get("domain"):
            all_domains.add(source["domain"])
        for domain in source.get("domains", []):
            if domain:
                all_domains.add(domain)
    
    # Remove target name from aliases (shouldn't be alias of itself)
    all_aliases.discard(request.target_name)
    all_aliases.discard(request.target_name.lower())
    
    # Update target company in unified_companies
    await db.unified_companies.update_one(
        {"$or": [{"id": request.target_id}, {"hubspot_id": request.target_id}]},
        {"$set": {
            "name": request.target_name,
            "normalized_name": request.target_name.lower().strip(),
            "updated_at": now
        },
        "$addToSet": {
            "merged_from": {"$each": request.source_ids},
            "aliases": {"$each": list(all_aliases)},
            "domains": {"$each": list(all_domains)}
        }}
    )
    
    return {
        "success": True,
        "target_company_id": request.target_id,
        "target_name": request.target_name,
        "source_companies_merged": len(request.source_ids),
        "source_names": source_names,
        "aliases_added": list(all_aliases),
        "contacts_updated": contacts_updated,
        "cases_updated": cases_updated,
        "searches_moved": searches_moved
    }


@router.get("/companies/all")
async def get_all_managed_companies(
    include_inactive: bool = False,
    current_user: dict = Depends(get_current_user)
):
    """
    Get all companies from unified_companies collection with full details.
    
    Now uses the new classification system:
    - classification="outbound" replaces is_active=True
    - classification="inbound" replaces is_active=False
    
    Returns companies in the old format for backward compatibility.
    """
    # Use unified_companies as primary source
    query = {"is_merged": {"$ne": True}}
    
    companies = await db.unified_companies.find(
        query,
        {"_id": 0}
    ).sort("name", 1).to_list(1000)
    
    # Map classification to is_active for backward compatibility
    for c in companies:
        c["is_active"] = c.get("classification") == "outbound"
    
    # Separate by classification (outbound = active, inbound = inactive)
    active = [c for c in companies if c.get("classification") == "outbound"]
    inactive = [c for c in companies if c.get("classification") != "outbound"]
    
    if not include_inactive:
        inactive = []
    
    return {
        "active": active,
        "inactive": inactive,
        "total_active": len(active),
        "total_inactive": len(inactive)
    }
