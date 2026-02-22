"""
Router for Job Title Keywords (Cargos) Management
Handles keyword-to-buyer-persona mapping with priority

MIGRATION NOTE: Classification logic has been centralized to:
/backend/services/persona_classifier_service.py

This router now:
1. Manages keywords CRUD
2. Manages priorities
3. Triggers cache invalidation when keywords change
4. Uses centralized classifier for classification endpoints
"""
from fastapi import APIRouter, HTTPException, Depends, Request
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timezone
import uuid
from database import db

# Import centralized classifier service
from services.persona_classifier_service import (
    classify_job_title,
    diagnose_classification,
    invalidate_classifier_cache,
    normalize_job_title
)

router = APIRouter(prefix="/job-keywords", tags=["job-keywords"])

# Import auth dependency
from .auth import get_current_user


class JobKeyword(BaseModel):
    keyword: str
    buyer_persona_id: str
    buyer_persona_name: str


class JobKeywordBulk(BaseModel):
    keywords: str  # Can be comma-separated or newline-separated
    buyer_persona_id: str
    buyer_persona_name: str


class BuyerPersonaPriority(BaseModel):
    buyer_persona_id: str
    priority: int


@router.get("/")
async def get_job_keywords(
    buyer_persona_id: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Get all job keywords, optionally filtered by buyer persona"""
    query = {}
    if buyer_persona_id:
        query["buyer_persona_id"] = buyer_persona_id
    
    # No limit - fetch all keywords
    keywords = await db.job_keywords.find(query, {"_id": 0}).sort("keyword", 1).to_list(None)
    
    return {"success": True, "keywords": keywords, "total": len(keywords)}


@router.post("/")
async def create_job_keyword(
    keyword_data: JobKeyword,
    current_user: dict = Depends(get_current_user)
):
    """Create a single job keyword. If keyword exists, keeps the one with highest priority buyer persona."""
    keyword = keyword_data.keyword.strip().lower()
    
    if not keyword:
        raise HTTPException(status_code=400, detail="Keyword is required")
    
    # Check if keyword already exists
    existing = await db.job_keywords.find_one({"keyword": keyword})
    if existing:
        # Get priorities to determine which buyer persona has higher priority
        priorities = await db.buyer_persona_priorities.find({}, {"_id": 0}).sort("priority", 1).to_list(None)
        priority_map = {p["buyer_persona_id"]: p["priority"] for p in priorities}
        
        new_persona_priority = priority_map.get(keyword_data.buyer_persona_id, 999)
        existing_priority = priority_map.get(existing.get("buyer_persona_id"), 999)
        
        if new_persona_priority < existing_priority:
            # New persona has higher priority - replace
            await db.job_keywords.update_one(
                {"keyword": keyword},
                {"$set": {
                    "buyer_persona_id": keyword_data.buyer_persona_id,
                    "buyer_persona_name": keyword_data.buyer_persona_name,
                    "updated_at": datetime.now(timezone.utc).isoformat()
                }}
            )
            # Invalidate cache after modification
            invalidate_classifier_cache()
            return {"success": True, "action": "replaced", "message": f"Keyword '{keyword}' updated to higher priority persona"}
        else:
            raise HTTPException(
                status_code=409, 
                detail=f"Keyword '{keyword}' already exists with higher or equal priority persona '{existing.get('buyer_persona_name')}'"
            )
    
    now = datetime.now(timezone.utc).isoformat()
    new_keyword = {
        "id": str(uuid.uuid4()),
        "keyword": keyword,
        "buyer_persona_id": keyword_data.buyer_persona_id,
        "buyer_persona_name": keyword_data.buyer_persona_name,
        "created_at": now
    }
    
    await db.job_keywords.insert_one(new_keyword)
    
    # Invalidate cache after creation
    invalidate_classifier_cache()
    
    return {"success": True, "action": "created", "keyword": {k: v for k, v in new_keyword.items() if k != "_id"}}


@router.post("/bulk")
async def create_job_keywords_bulk(
    data: JobKeywordBulk,
    current_user: dict = Depends(get_current_user)
):
    """Create multiple keywords at once from text (comma or newline separated).
    If a keyword already exists, it keeps the one with the highest priority buyer persona."""
    # Parse keywords from text
    raw_keywords = data.keywords.replace('\n', ',').replace(';', ',')
    keywords_list = [k.strip().lower() for k in raw_keywords.split(',') if k.strip()]
    
    if not keywords_list:
        raise HTTPException(status_code=400, detail="No valid keywords provided")
    
    # Get priorities to determine which buyer persona has higher priority
    priorities = await db.buyer_persona_priorities.find({}, {"_id": 0}).sort("priority", 1).to_list(None)
    priority_map = {p["buyer_persona_id"]: p["priority"] for p in priorities}
    new_persona_priority = priority_map.get(data.buyer_persona_id, 999)
    
    now = datetime.now(timezone.utc).isoformat()
    created = 0
    skipped = 0
    replaced = 0
    
    for keyword in keywords_list:
        # Check if keyword already exists
        existing = await db.job_keywords.find_one({"keyword": keyword})
        if existing:
            # Check if new buyer persona has higher priority (lower number = higher priority)
            existing_priority = priority_map.get(existing.get("buyer_persona_id"), 999)
            if new_persona_priority < existing_priority:
                # New persona has higher priority - replace
                await db.job_keywords.update_one(
                    {"keyword": keyword},
                    {"$set": {
                        "buyer_persona_id": data.buyer_persona_id,
                        "buyer_persona_name": data.buyer_persona_name,
                        "updated_at": now
                    }}
                )
                replaced += 1
            else:
                # Existing has higher or equal priority - skip
                skipped += 1
            continue
        
        new_keyword = {
            "id": str(uuid.uuid4()),
            "keyword": keyword,
            "buyer_persona_id": data.buyer_persona_id,
            "buyer_persona_name": data.buyer_persona_name,
            "created_at": now
        }
        
        await db.job_keywords.insert_one(new_keyword)
        created += 1
    
    # Invalidate cache after bulk modification
    if created > 0 or replaced > 0:
        invalidate_classifier_cache()
    
    return {
        "success": True,
        "created": created,
        "skipped": skipped,
        "replaced": replaced,
        "total_input": len(keywords_list)
    }


# ============ BUYER PERSONA PRIORITY ============
# NOTE: These routes MUST come BEFORE /{keyword_id} routes to avoid path conflicts

@router.get("/priorities")
async def get_buyer_persona_priorities(
    current_user: dict = Depends(get_current_user)
):
    """Get buyer persona priorities for keyword matching"""
    priorities = await db.buyer_persona_priorities.find({}, {"_id": 0}).sort("priority", 1).to_list(None)
    
    # Get all personas for reference
    personas = await db.buyer_personas_db.find({}, {"_id": 0}).to_list(None)
    persona_map = {p.get("code", p.get("name", "").lower()): p for p in personas}
    
    # If no priorities exist, create defaults from existing buyer personas
    if not priorities:
        for i, persona in enumerate(personas):
            # Use code as id, or fallback to lowercase name
            persona_id = persona.get("code") or persona.get("name", "").lower()
            priority_doc = {
                "buyer_persona_id": persona_id,
                "buyer_persona_name": persona.get("name", ""),
                "priority": i + 1
            }
            await db.buyer_persona_priorities.insert_one(priority_doc)
            priorities.append(priority_doc)
    else:
        # Fix any existing priorities that have empty buyer_persona_id
        needs_update = False
        for priority in priorities:
            if not priority.get("buyer_persona_id"):
                # Try to find the persona by name
                persona_name = priority.get("buyer_persona_name", "")
                for code, persona in persona_map.items():
                    if persona.get("name") == persona_name:
                        priority["buyer_persona_id"] = code
                        needs_update = True
                        break
        
        # Update in database if we fixed any
        if needs_update:
            for priority in priorities:
                if priority.get("buyer_persona_id"):
                    await db.buyer_persona_priorities.update_one(
                        {"buyer_persona_name": priority["buyer_persona_name"]},
                        {"$set": {"buyer_persona_id": priority["buyer_persona_id"]}}
                    )
    
    return {"success": True, "priorities": priorities}


@router.put("/priorities")
async def update_buyer_persona_priorities(
    request: Request,
    current_user: dict = Depends(get_current_user)
):
    """Update buyer persona priorities (for drag-and-drop reordering)"""
    priorities = await request.json()
    now = datetime.now(timezone.utc).isoformat()
    
    for priority_data in priorities:
        await db.buyer_persona_priorities.update_one(
            {"buyer_persona_id": priority_data["buyer_persona_id"]},
            {"$set": {
                "priority": priority_data["priority"],
                "updated_at": now
            }},
            upsert=True
        )
    
    # Invalidate cache after priority changes
    invalidate_classifier_cache()
    
    return {"success": True, "message": "Priorities updated"}


# ============ CLASSIFY CONTACT ============
# MIGRATION: Now uses centralized classifier service

@router.post("/classify-contact")
async def classify_contact_by_job_title_endpoint(
    job_title: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Classify a single contact's job title to determine buyer persona.
    
    MIGRATION: Now uses centralized persona_classifier_service.
    """
    result = await classify_job_title(db, job_title, use_cache=True)
    
    return {
        "success": True,
        "buyer_persona_id": result.buyer_persona_id if not result.is_default else None,
        "buyer_persona_name": result.buyer_persona_name,
        "match": result.matched_keywords[0] if result.matched_keywords else None,
        "all_matches": result.all_matches,
        "normalized_job_title": result.normalized_job_title,
        "reason": "no_keyword_match" if result.is_default else "keyword_match"
    }


@router.post("/diagnose")
async def diagnose_job_title(
    job_title: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Diagnose classification for a job title.
    Returns detailed information for debugging.
    """
    return await diagnose_classification(db, job_title)


# ============ RECLASSIFICATION (MIGRATED TO CENTRALIZED SERVICE) ============

from services.persona_classifier_service import (
    classify_job_title_simple,
    normalize_job_title as normalize_title,
    should_reclassify_contact
)
from pymongo import UpdateOne


@router.post("/reclassify-all-contacts")
async def reclassify_all_contacts(
    respect_lock: bool = True,
    current_user: dict = Depends(get_current_user)
):
    """
    Reclassify all contacts based on their job titles and current keywords.
    
    MIGRATION: Now uses centralized persona_classifier_service.
    
    Args:
        respect_lock: If True (default), skip contacts with buyer_persona_locked=True
    """
    # Get all contacts - exclude locked if requested
    query = {}
    if respect_lock:
        query["$or"] = [
            {"buyer_persona_locked": {"$exists": False}},
            {"buyer_persona_locked": False},
            {"buyer_persona_locked": None}
        ]
    
    contacts = await db.unified_contacts.find(
        query, 
        {"_id": 0, "id": 1, "job_title": 1, "buyer_persona": 1, "buyer_persona_locked": 1}
    ).to_list(None)
    
    updated = 0
    no_match = 0
    skipped_locked = 0
    batch_size = 500
    batch = []
    
    for contact in contacts:
        # Double-check lock status
        if respect_lock and contact.get("buyer_persona_locked"):
            skipped_locked += 1
            continue
        
        job_title = contact.get("job_title", "")
        
        # Use centralized classifier
        new_persona = await classify_job_title_simple(db, job_title, use_cache=True)
        
        # Normalize job title for future queries
        normalized = normalize_title(job_title)
        
        if new_persona == "mateo":
            no_match += 1
        else:
            updated += 1
        
        # Add to batch
        batch.append(UpdateOne(
            {"id": contact["id"]},
            {"$set": {
                "buyer_persona": new_persona,
                "job_title_normalized": normalized,
                "updated_at": datetime.now(timezone.utc).isoformat()
            }}
        ))
        
        # Execute batch
        if len(batch) >= batch_size:
            await db.unified_contacts.bulk_write(batch, ordered=False)
            batch = []
    
    # Execute remaining batch
    if batch:
        await db.unified_contacts.bulk_write(batch, ordered=False)
    
    return {
        "success": True,
        "total_contacts": len(contacts),
        "updated_with_persona": updated,
        "assigned_mateo": no_match,
        "skipped_locked": skipped_locked
    }


@router.post("/reclassify-by-keyword/{keyword_id}")
async def reclassify_contacts_by_keyword(
    keyword_id: str,
    respect_lock: bool = True,
    current_user: dict = Depends(get_current_user)
):
    """
    Reclassify all contacts that match a specific keyword.
    
    MIGRATION: Now uses centralized classifier for final persona assignment,
    respects buyer_persona_locked flag, and uses bulk_write.
    """
    # Get the keyword
    keyword_doc = await db.job_keywords.find_one({"id": keyword_id}, {"_id": 0})
    if not keyword_doc:
        raise HTTPException(status_code=404, detail="Keyword not found")
    
    keyword = keyword_doc["keyword"]
    keyword_normalized = normalize_title(keyword)
    
    # Build query - exclude locked contacts if requested
    query = {
        "job_title": {"$exists": True, "$nin": ["", None]}
    }
    if respect_lock:
        query["$or"] = [
            {"buyer_persona_locked": {"$exists": False}},
            {"buyer_persona_locked": False},
            {"buyer_persona_locked": None}
        ]
    
    contacts = await db.unified_contacts.find(
        query,
        {"_id": 0, "id": 1, "job_title": 1, "job_title_normalized": 1, "buyer_persona": 1}
    ).to_list(None)
    
    updated = 0
    matched = 0
    skipped_locked = 0
    batch = []
    
    for contact in contacts:
        job_title = contact.get("job_title", "")
        # Use normalized version if available, otherwise normalize on the fly
        job_normalized = contact.get("job_title_normalized") or normalize_title(job_title)
        
        # Check if keyword matches
        if keyword_normalized in job_normalized:
            matched += 1
            
            # Use centralized classifier to get the correct final persona
            new_persona = await classify_job_title_simple(db, job_title, use_cache=True)
            
            # Only update if buyer persona is different
            if contact.get("buyer_persona") != new_persona:
                batch.append(UpdateOne(
                    {"id": contact["id"]},
                    {"$set": {
                        "buyer_persona": new_persona,
                        "job_title_normalized": job_normalized,
                        "updated_at": datetime.now(timezone.utc).isoformat()
                    }}
                ))
                updated += 1
    
    # Execute batch
    if batch:
        await db.unified_contacts.bulk_write(batch, ordered=False)
    
    return {
        "success": True,
        "keyword": keyword,
        "buyer_persona_id": keyword_doc["buyer_persona_id"],
        "buyer_persona_name": keyword_doc["buyer_persona_name"],
        "contacts_matched": matched,
        "contacts_updated": updated,
        "skipped_locked": skipped_locked
    }


@router.post("/reclassify-by-persona/{buyer_persona_id}")
async def reclassify_contacts_by_persona(
    buyer_persona_id: str,
    respect_lock: bool = True,
    current_user: dict = Depends(get_current_user)
):
    """
    Reclassify all contacts that match any keyword of a specific buyer persona.
    
    MIGRATION: Now uses centralized classifier for final persona assignment,
    respects buyer_persona_locked flag, and uses bulk_write.
    """
    # Get all keywords for this buyer persona
    keywords = await db.job_keywords.find(
        {"buyer_persona_id": buyer_persona_id},
        {"_id": 0}
    ).to_list(None)
    
    if not keywords:
        return {
            "success": True,
            "buyer_persona_id": buyer_persona_id,
            "message": "No keywords found for this buyer persona",
            "contacts_matched": 0,
            "contacts_updated": 0
        }
    
    buyer_persona_name = keywords[0]["buyer_persona_name"]
    keyword_list = [normalize_title(kw["keyword"]) for kw in keywords]
    
    # Build query - exclude locked contacts if requested
    query = {
        "job_title": {"$exists": True, "$nin": ["", None]}
    }
    if respect_lock:
        query["$or"] = [
            {"buyer_persona_locked": {"$exists": False}},
            {"buyer_persona_locked": False},
            {"buyer_persona_locked": None}
        ]
    
    contacts = await db.unified_contacts.find(
        query,
        {"_id": 0, "id": 1, "job_title": 1, "job_title_normalized": 1, "buyer_persona": 1}
    ).to_list(None)
    
    updated = 0
    matched = 0
    batch = []
    
    for contact in contacts:
        job_title = contact.get("job_title", "")
        job_normalized = contact.get("job_title_normalized") or normalize_title(job_title)
        
        # Check if any keyword matches
        keyword_matches = any(kw in job_normalized for kw in keyword_list)
        
        if keyword_matches:
            matched += 1
            
            # Use centralized classifier to get the correct final persona
            new_persona = await classify_job_title_simple(db, job_title, use_cache=True)
            
            # Only update if buyer persona is different
            if contact.get("buyer_persona") != new_persona:
                batch.append(UpdateOne(
                    {"id": contact["id"]},
                    {"$set": {
                        "buyer_persona": new_persona,
                        "job_title_normalized": job_normalized,
                        "updated_at": datetime.now(timezone.utc).isoformat()
                    }}
                ))
                updated += 1
    
    # Execute batch
    if batch:
        await db.unified_contacts.bulk_write(batch, ordered=False)
    
    return {
        "success": True,
        "buyer_persona_id": buyer_persona_id,
        "buyer_persona_name": buyer_persona_name,
        "keywords_count": len(keyword_list),
        "contacts_matched": matched,
        "contacts_updated": updated
    }


# ============ KEYWORD CRUD (parameterized routes MUST come LAST) ============

@router.delete("/{keyword_id}")
async def delete_job_keyword(
    keyword_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Delete a job keyword"""
    result = await db.job_keywords.delete_one({"id": keyword_id})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Keyword not found")
    
    # Invalidate cache after deletion
    invalidate_classifier_cache()
    
    return {"success": True, "message": "Keyword deleted"}


@router.put("/{keyword_id}")
async def update_job_keyword(
    keyword_id: str,
    keyword_data: JobKeyword,
    current_user: dict = Depends(get_current_user)
):
    """Update a job keyword's buyer persona assignment"""
    result = await db.job_keywords.update_one(
        {"id": keyword_id},
        {"$set": {
            "buyer_persona_id": keyword_data.buyer_persona_id,
            "buyer_persona_name": keyword_data.buyer_persona_name,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Keyword not found")
    
    # Invalidate cache after update
    invalidate_classifier_cache()
    
    return {"success": True, "message": "Keyword updated"}


# ============ MIGRATION & MAINTENANCE ============

from services.persona_classifier_service import (
    normalize_contacts_job_titles,
    ensure_classifier_indexes
)


@router.post("/migrate/normalize-job-titles")
async def migrate_normalize_job_titles(
    limit: Optional[int] = None,
    current_user: dict = Depends(get_current_user)
):
    """
    Migrate existing contacts to add job_title_normalized field.
    
    This endpoint should be run once to backfill existing data.
    Safe to run multiple times - only processes contacts without normalized field.
    
    Args:
        limit: Maximum number of contacts to process (None = all)
    """
    result = await normalize_contacts_job_titles(db, batch_size=500, limit=limit)
    return {"success": True, "migration_result": result}


@router.post("/migrate/ensure-indexes")
async def migrate_ensure_indexes(
    current_user: dict = Depends(get_current_user)
):
    """
    Ensure all classifier indexes exist.
    
    Creates indexes on:
    - job_keywords.keyword
    - job_keywords.buyer_persona_id
    - unified_contacts.job_title_normalized
    - unified_contacts.buyer_persona
    - unified_contacts.buyer_persona_locked
    """
    result = await ensure_classifier_indexes(db)
    return {"success": True, "indexes": result}


@router.get("/classifier/stats")
async def get_classifier_stats(
    current_user: dict = Depends(get_current_user)
):
    """
    Get statistics about the classifier system.
    """
    # Count keywords by buyer persona
    pipeline = [
        {"$group": {"_id": "$buyer_persona_id", "count": {"$sum": 1}}}
    ]
    keyword_counts = await db.job_keywords.aggregate(pipeline).to_list(None)
    
    # Count contacts by buyer persona
    contact_pipeline = [
        {"$group": {"_id": "$buyer_persona", "count": {"$sum": 1}}}
    ]
    contact_counts = await db.unified_contacts.aggregate(contact_pipeline).to_list(None)
    
    # Count locked contacts
    locked_count = await db.unified_contacts.count_documents({"buyer_persona_locked": True})
    
    # Count contacts with normalized job titles
    normalized_count = await db.unified_contacts.count_documents({
        "job_title_normalized": {"$exists": True, "$nin": [None, ""]}
    })
    
    # Total contacts
    total_contacts = await db.unified_contacts.count_documents({})
    
    return {
        "success": True,
        "keywords": {
            "total": sum(kc["count"] for kc in keyword_counts),
            "by_persona": {kc["_id"]: kc["count"] for kc in keyword_counts if kc["_id"]}
        },
        "contacts": {
            "total": total_contacts,
            "by_persona": {cc["_id"]: cc["count"] for cc in contact_counts if cc["_id"]},
            "locked": locked_count,
            "with_normalized_job_title": normalized_count
        }
    }

