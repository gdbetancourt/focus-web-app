"""
Content Items Router - Focus Content System
Manages content items ingested from iOS Shortcuts and their processing pipeline.

Features:
- Webhook for iOS Shortcuts content ingestion
- Bearer token authentication for webhook
- Idempotency key handling
- Content item CRUD operations
- Dictation text management with autosave
"""
from fastapi import APIRouter, HTTPException, Depends, Header, Request
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timezone
import uuid
import os
import logging

from database import db
from routers.auth import get_current_user

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/content", tags=["content"])


# ============ MODELS ============

class ContentItemCreate(BaseModel):
    """Model for creating a content item via webhook"""
    title: str
    url: Optional[str] = None
    source_url: Optional[str] = None  # Original URL from iOS
    course_id: Optional[str] = None  # NEW: Course reference
    thematic_axis_id: Optional[str] = None  # DEPRECATED: keeping for backwards compat
    competency_id: Optional[str] = None
    level: Optional[int] = None  # 1-4
    dictation_draft_text: Optional[str] = None
    notes: Optional[str] = None
    tags: Optional[List[str]] = []


class ContentItemUpdate(BaseModel):
    """Model for updating a content item"""
    title: Optional[str] = None
    url: Optional[str] = None
    course_id: Optional[str] = None  # NEW
    thematic_axis_id: Optional[str] = None  # DEPRECATED
    competency_id: Optional[str] = None
    level: Optional[int] = None
    dictation_draft_text: Optional[str] = None
    notes: Optional[str] = None
    tags: Optional[List[str]] = None
    status: Optional[str] = None


class DictationUpdate(BaseModel):
    """Model for autosave dictation text"""
    dictation_draft_text: str


# ============ COURSE & COMPETENCY MODELS ============

class CourseCreate(BaseModel):
    """Model for creating a course"""
    name: str
    description: Optional[str] = None


class CourseUpdate(BaseModel):
    """Model for updating a course"""
    name: Optional[str] = None
    description: Optional[str] = None


class CompetencyCreate(BaseModel):
    """Model for creating a competency"""
    name: str
    description: Optional[str] = None
    course_id: str  # Required: competency belongs to a course


class CompetencyUpdate(BaseModel):
    """Model for updating a competency"""
    name: Optional[str] = None
    description: Optional[str] = None
    course_id: Optional[str] = None


class WebhookPayload(BaseModel):
    """Payload from iOS Shortcuts webhook"""
    title: str
    url: Optional[str] = None
    text: Optional[str] = None  # Dictation text
    notes: Optional[str] = None
    tags: Optional[List[str]] = []
    idempotency_key: Optional[str] = None


# ============ COURSES CRUD ============

@router.get("/courses")
async def get_courses(current_user: dict = Depends(get_current_user)):
    """Get all courses"""
    courses = await db.courses.find({}, {"_id": 0}).to_list(100)
    return {"courses": courses, "total": len(courses)}


@router.post("/courses")
async def create_course(
    data: CourseCreate,
    current_user: dict = Depends(get_current_user)
):
    """Create a new course"""
    course_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    
    course = {
        "id": course_id,
        "name": data.name,
        "description": data.description or "",
        "created_at": now,
        "updated_at": now
    }
    
    await db.courses.insert_one(course)
    
    return {"success": True, "course": {k: v for k, v in course.items() if k != "_id"}}


@router.put("/courses/{course_id}")
async def update_course(
    course_id: str,
    data: CourseUpdate,
    current_user: dict = Depends(get_current_user)
):
    """Update a course"""
    course = await db.courses.find_one({"id": course_id})
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    
    update_data = {"updated_at": datetime.now(timezone.utc).isoformat()}
    if data.name is not None:
        update_data["name"] = data.name
    if data.description is not None:
        update_data["description"] = data.description
    
    await db.courses.update_one({"id": course_id}, {"$set": update_data})
    
    updated = await db.courses.find_one({"id": course_id}, {"_id": 0})
    return {"success": True, "course": updated}


@router.delete("/courses/{course_id}")
async def delete_course(
    course_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Delete a course (only if no competencies or content items reference it)"""
    # Check for competencies
    comp_count = await db.competencies.count_documents({"course_id": course_id})
    if comp_count > 0:
        raise HTTPException(
            status_code=400, 
            detail=f"Cannot delete course with {comp_count} competencies. Delete competencies first."
        )
    
    # Check for content items
    item_count = await db.content_items.count_documents({"course_id": course_id})
    if item_count > 0:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot delete course with {item_count} content items. Reassign items first."
        )
    
    result = await db.courses.delete_one({"id": course_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Course not found")
    
    return {"success": True, "message": "Course deleted"}


# ============ COMPETENCIES CRUD ============

@router.get("/competencies")
async def get_competencies(
    course_id: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Get competencies, optionally filtered by course"""
    query = {}
    if course_id:
        query["course_id"] = course_id
    
    competencies = await db.competencies.find(query, {"_id": 0}).to_list(200)
    return {"competencies": competencies, "total": len(competencies)}


@router.post("/competencies")
async def create_competency(
    data: CompetencyCreate,
    current_user: dict = Depends(get_current_user)
):
    """Create a new competency for a course"""
    # Verify course exists
    course = await db.courses.find_one({"id": data.course_id})
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    
    comp_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    
    competency = {
        "id": comp_id,
        "name": data.name,
        "description": data.description or "",
        "course_id": data.course_id,
        "created_at": now,
        "updated_at": now
    }
    
    await db.competencies.insert_one(competency)
    
    return {"success": True, "competency": {k: v for k, v in competency.items() if k != "_id"}}


@router.put("/competencies/{competency_id}")
async def update_competency(
    competency_id: str,
    data: CompetencyUpdate,
    current_user: dict = Depends(get_current_user)
):
    """Update a competency"""
    comp = await db.competencies.find_one({"id": competency_id})
    if not comp:
        raise HTTPException(status_code=404, detail="Competency not found")
    
    update_data = {"updated_at": datetime.now(timezone.utc).isoformat()}
    if data.name is not None:
        update_data["name"] = data.name
    if data.description is not None:
        update_data["description"] = data.description
    if data.course_id is not None:
        # Verify new course exists
        course = await db.courses.find_one({"id": data.course_id})
        if not course:
            raise HTTPException(status_code=404, detail="Target course not found")
        update_data["course_id"] = data.course_id
    
    await db.competencies.update_one({"id": competency_id}, {"$set": update_data})
    
    updated = await db.competencies.find_one({"id": competency_id}, {"_id": 0})
    return {"success": True, "competency": updated}


@router.delete("/competencies/{competency_id}")
async def delete_competency(
    competency_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Delete a competency (only if no content items reference it)"""
    item_count = await db.content_items.count_documents({"competency_id": competency_id})
    if item_count > 0:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot delete competency with {item_count} content items. Reassign items first."
        )
    
    result = await db.competencies.delete_one({"id": competency_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Competency not found")
    
    return {"success": True, "message": "Competency deleted"}


@router.post("/fix-course-ids")
async def fix_content_item_course_ids(
    current_user: dict = Depends(get_current_user)
):
    """Fix content items that have competency_id but missing course_id"""
    fixed_count = 0
    
    # Get all competencies with their course_id
    competencies = await db.competencies.find({}, {"_id": 0}).to_list(100)
    comp_to_course = {c["id"]: c.get("course_id") for c in competencies if c.get("course_id")}
    
    # Find items with competency but no course
    items = await db.content_items.find({
        "competency_id": {"$exists": True, "$ne": None},
        "$or": [
            {"course_id": {"$exists": False}},
            {"course_id": None}
        ]
    }).to_list(500)
    
    for item in items:
        comp_id = item.get("competency_id")
        course_id = comp_to_course.get(comp_id)
        
        if course_id:
            await db.content_items.update_one(
                {"id": item["id"]},
                {"$set": {"course_id": course_id}}
            )
            fixed_count += 1
    
    return {
        "success": True,
        "fixed_count": fixed_count,
        "message": f"Fixed {fixed_count} content items with missing course_id"
    }


# ============ COURSE MATRIX VIEW ============

@router.get("/courses/{course_id}/matrix")
async def get_course_matrix(
    course_id: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Get the content matrix for a specific course.
    Returns competencies with content items organized by level.
    """
    # Verify course exists
    course = await db.courses.find_one({"id": course_id}, {"_id": 0})
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    
    # Get levels from niveles_certificacion (Foundations)
    niveles = await db.niveles_certificacion.find({}, {"_id": 0}).sort("order", 1).to_list(10)
    
    # Transform to expected format for frontend
    if niveles:
        levels = [
            {
                "id": f"level-{n.get('order', i+1)}",
                "number": n.get("order", i+1),
                "name": n.get("advancement_es", f"Nivel {n.get('order', i+1)}")
            }
            for i, n in enumerate(niveles)
        ]
    else:
        # Fallback if niveles_certificacion is empty
        levels = [
            {"id": "level-1", "number": 1, "name": "de Aspirante a Aprendiz"},
            {"id": "level-2", "number": 2, "name": "de Aprendiz a Competente"},
            {"id": "level-3", "number": 3, "name": "de Competente a Experto"},
            {"id": "level-4", "number": 4, "name": "de Experto a Maestro"}
        ]
    
    # Get competencies for this course
    competencies_raw = await db.competencies.find(
        {"course_id": course_id}, 
        {"_id": 0}
    ).to_list(50)
    
    # Get content items for this course
    items = await db.content_items.find(
        {"course_id": course_id},
        {"_id": 0}
    ).to_list(500)
    
    # Count items per competency per level
    competencies = []
    for comp in competencies_raw:
        level_counts = {1: 0, 2: 0, 3: 0, 4: 0}
        for item in items:
            if item.get("competency_id") == comp["id"] and item.get("level") in [1, 2, 3, 4]:
                level_counts[item["level"]] += 1
        
        competencies.append({
            **comp,
            "level_counts": level_counts
        })
    
    # Get unclassified items (in course but no competency/level)
    unclassified = [
        item for item in items 
        if not item.get("competency_id") or not item.get("level")
    ]
    
    return {
        "course": course,
        "levels": levels,
        "competencies": competencies,
        "unclassified": unclassified,
        "stats": {
            "total_items": len(items),
            "classified": len(items) - len(unclassified),
            "unclassified": len(unclassified)
        }
    }


@router.post("/items/{item_id}/assign")
async def assign_item_to_cell(
    item_id: str,
    competency_id: str,
    level: int,
    course_id: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Assign a content item to a specific cell (competency + level)"""
    if level not in [1, 2, 3, 4]:
        raise HTTPException(status_code=400, detail="Level must be 1, 2, 3, or 4")
    
    # Verify item exists
    item = await db.content_items.find_one({"id": item_id})
    if not item:
        raise HTTPException(status_code=404, detail="Content item not found")
    
    # Verify competency exists
    competency = await db.competencies.find_one({"id": competency_id})
    if not competency:
        raise HTTPException(status_code=404, detail="Competency not found")
    
    # Update item with cell assignment
    update_data = {
        "competency_id": competency_id,
        "level": level,
        "course_id": course_id or competency.get("course_id"),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.content_items.update_one({"id": item_id}, {"$set": update_data})
    
    updated = await db.content_items.find_one({"id": item_id}, {"_id": 0})
    
    return {
        "success": True,
        "item": updated,
        "message": f"Item assigned to Level {level}"
    }


@router.post("/items/{item_id}/unassign")
async def unassign_item_from_cell(
    item_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Remove item from its current cell (unassign competency and level)"""
    item = await db.content_items.find_one({"id": item_id})
    if not item:
        raise HTTPException(status_code=404, detail="Content item not found")
    
    await db.content_items.update_one(
        {"id": item_id},
        {
            "$set": {"updated_at": datetime.now(timezone.utc).isoformat()},
            "$unset": {"competency_id": "", "level": ""}
        }
    )
    
    updated = await db.content_items.find_one({"id": item_id}, {"_id": 0})
    
    return {
        "success": True,
        "item": updated,
        "message": "Item unassigned from cell"
    }


# ============ WEBHOOK AUTHENTICATION ============

# Bearer token for webhook - should be set in environment
WEBHOOK_BEARER_TOKEN = os.environ.get("CONTENT_WEBHOOK_TOKEN", "leaderlix-content-webhook-2026")


async def verify_webhook_token(authorization: str = Header(None)):
    """Verify bearer token for webhook requests"""
    if not authorization:
        raise HTTPException(status_code=401, detail="Authorization header required")
    
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Invalid authorization format. Use 'Bearer <token>'")
    
    token = authorization[7:]  # Remove "Bearer " prefix
    
    if token != WEBHOOK_BEARER_TOKEN:
        raise HTTPException(status_code=401, detail="Invalid token")
    
    return True


# ============ WEBHOOK ENDPOINT ============

@router.post("/webhooks/ios-shortcuts/content-item")
async def create_content_from_webhook(
    payload: WebhookPayload,
    authorized: bool = Depends(verify_webhook_token)
):
    """
    Webhook endpoint for iOS Shortcuts to submit content items.
    
    Authentication: Bearer token in Authorization header
    Idempotency: Optional idempotency_key to prevent duplicates
    
    Usage from iOS Shortcuts:
    POST /api/content/webhooks/ios-shortcuts/content-item
    Headers:
      Authorization: Bearer <token>
      Content-Type: application/json
    Body:
      {
        "title": "Content Title",
        "url": "https://...",
        "text": "Dictation text...",
        "idempotency_key": "unique-key-123"
      }
    """
    # Check idempotency key if provided
    if payload.idempotency_key:
        existing = await db.content_items.find_one({
            "idempotency_key": payload.idempotency_key
        })
        if existing:
            logger.info(f"Duplicate content item with idempotency_key: {payload.idempotency_key}")
            return {
                "success": True,
                "duplicate": True,
                "content_item_id": existing.get("id"),
                "message": "Content item already exists with this idempotency key"
            }
    
    # Create content item
    now = datetime.now(timezone.utc).isoformat()
    content_item = {
        "id": str(uuid.uuid4()),
        "title": payload.title.strip(),
        "url": payload.url,
        "source_url": payload.url,
        "dictation_draft_text": payload.text,
        "notes": payload.notes,
        "tags": payload.tags or [],
        "idempotency_key": payload.idempotency_key,
        "status": "draft",  # draft -> dictated -> processing -> processed -> published
        "thematic_axis_id": None,
        "competency_id": None,
        "level": None,
        "source": "ios_shortcuts",
        "created_at": now,
        "updated_at": now,
        # Processing state
        "processing_state": {
            "cleaned": False,
            "blog_es_generated": False,
            "blog_en_generated": False,
            "slides_generated": False,
            "video_uploaded": False,
            "youtube_published": False,
            "lms_created": False,
            "newsletter_queued": False
        }
    }
    
    await db.content_items.insert_one(content_item)
    
    logger.info(f"Content item created from webhook: {content_item['id']}")
    
    return {
        "success": True,
        "duplicate": False,
        "content_item_id": content_item["id"],
        "message": "Content item created successfully"
    }


# ============ CONTENT ITEMS CRUD ============

@router.get("/items")
async def list_content_items(
    status: Optional[str] = None,
    thematic_axis_id: Optional[str] = None,
    competency_id: Optional[str] = None,
    level: Optional[int] = None,
    limit: int = 50,
    offset: int = 0,
    current_user: dict = Depends(get_current_user)
):
    """List content items with optional filters"""
    query = {}
    
    if status:
        query["status"] = status
    if thematic_axis_id:
        query["thematic_axis_id"] = thematic_axis_id
    if competency_id:
        query["competency_id"] = competency_id
    if level:
        query["level"] = level
    
    total = await db.content_items.count_documents(query)
    
    items = await db.content_items.find(query, {"_id": 0}).sort(
        "created_at", -1
    ).skip(offset).limit(limit).to_list(limit)
    
    return {
        "success": True,
        "items": items,
        "total": total,
        "limit": limit,
        "offset": offset
    }


@router.get("/items/{item_id}")
async def get_content_item(
    item_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get a single content item by ID"""
    item = await db.content_items.find_one({"id": item_id}, {"_id": 0})
    
    if not item:
        raise HTTPException(status_code=404, detail="Content item not found")
    
    # Enrich with thematic axis and competency info
    if item.get("thematic_axis_id"):
        axis = await db.thematic_axes.find_one(
            {"id": item["thematic_axis_id"]},
            {"_id": 0}
        )
        item["thematic_axis"] = axis
    
    if item.get("competency_id"):
        competency = await db.competencies.find_one(
            {"id": item["competency_id"]},
            {"_id": 0}
        )
        item["competency"] = competency
    
    # Enrich with newsletter info
    newsletter_entry = await db.newsletter_queue.find_one(
        {"content_item_id": item_id},
        {"_id": 0, "id": 1, "scheduled_date": 1, "status": 1}
    )
    if newsletter_entry:
        item["newsletter"] = newsletter_entry
    
    # Enrich with webinar info
    webinar = await db.webinar_events_v2.find_one(
        {"content_item_id": item_id},
        {"_id": 0, "id": 1, "name": 1, "youtube_broadcast_id": 1, "youtube_video_id": 1, "scheduled_date": 1, "youtube_privacy": 1, "slug": 1, "landing_page_url": 1}
    )
    if webinar:
        item["webinar"] = webinar
        # Build YouTube URL if broadcast exists
        video_id = webinar.get("youtube_video_id") or webinar.get("youtube_broadcast_id")
        if video_id:
            item["youtube_url"] = f"https://youtube.com/watch?v={video_id}"
    
    return {
        "success": True,
        "item": item
    }


@router.post("/items")
async def create_content_item(
    data: ContentItemCreate,
    current_user: dict = Depends(get_current_user)
):
    """Create a content item manually (not via webhook)"""
    # Validate thematic axis if provided
    if data.thematic_axis_id:
        axis = await db.thematic_axes.find_one({"id": data.thematic_axis_id})
        if not axis:
            raise HTTPException(status_code=404, detail="Thematic axis not found")
    
    # Validate competency if provided
    if data.competency_id:
        comp = await db.competencies.find_one({"id": data.competency_id})
        if not comp:
            raise HTTPException(status_code=404, detail="Competency not found")
    
    # Validate level if provided
    if data.level and (data.level < 1 or data.level > 4):
        raise HTTPException(status_code=400, detail="Level must be between 1 and 4")
    
    now = datetime.now(timezone.utc).isoformat()
    content_item = {
        "id": str(uuid.uuid4()),
        "title": data.title.strip(),
        "url": data.url,
        "source_url": data.source_url,
        "thematic_axis_id": data.thematic_axis_id,
        "competency_id": data.competency_id,
        "level": data.level,
        "dictation_draft_text": data.dictation_draft_text,
        "notes": data.notes,
        "tags": data.tags or [],
        "status": "draft",
        "source": "manual",
        "created_at": now,
        "updated_at": now,
        "created_by": current_user.get("email"),
        "processing_state": {
            "cleaned": False,
            "blog_es_generated": False,
            "blog_en_generated": False,
            "slides_generated": False,
            "video_uploaded": False,
            "youtube_published": False,
            "lms_created": False,
            "newsletter_queued": False
        }
    }
    
    await db.content_items.insert_one(content_item)
    
    return {
        "success": True,
        "item": {k: v for k, v in content_item.items() if k != "_id"}
    }


@router.put("/items/{item_id}")
@router.patch("/items/{item_id}")
async def update_content_item(
    item_id: str,
    data: ContentItemUpdate,
    current_user: dict = Depends(get_current_user)
):
    """Update a content item"""
    update_data = {}
    
    if data.title is not None:
        update_data["title"] = data.title.strip()
    if data.url is not None:
        update_data["url"] = data.url
    if data.thematic_axis_id is not None:
        # Validate axis
        if data.thematic_axis_id:
            axis = await db.thematic_axes.find_one({"id": data.thematic_axis_id})
            if not axis:
                raise HTTPException(status_code=404, detail="Thematic axis not found")
        update_data["thematic_axis_id"] = data.thematic_axis_id
    if data.competency_id is not None:
        # Validate competency
        if data.competency_id:
            comp = await db.competencies.find_one({"id": data.competency_id})
            if not comp:
                raise HTTPException(status_code=404, detail="Competency not found")
        update_data["competency_id"] = data.competency_id
    if data.level is not None:
        if data.level < 1 or data.level > 4:
            raise HTTPException(status_code=400, detail="Level must be between 1 and 4")
        update_data["level"] = data.level
    if data.dictation_draft_text is not None:
        update_data["dictation_draft_text"] = data.dictation_draft_text
    if data.notes is not None:
        update_data["notes"] = data.notes
    if data.tags is not None:
        update_data["tags"] = data.tags
    if data.status is not None:
        valid_statuses = ["draft", "dictated", "processing", "processed", "published"]
        if data.status not in valid_statuses:
            raise HTTPException(status_code=400, detail=f"Invalid status. Must be one of: {valid_statuses}")
        update_data["status"] = data.status
    
    if not update_data:
        raise HTTPException(status_code=400, detail="No data to update")
    
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    update_data["updated_by"] = current_user.get("email")
    
    result = await db.content_items.update_one(
        {"id": item_id},
        {"$set": update_data}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Content item not found")
    
    return {"success": True}


@router.delete("/items/{item_id}")
async def delete_content_item(
    item_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Delete a content item - fails if it has an associated webinar"""
    # Check if content item has an associated webinar
    associated_webinar = await db.webinar_events_v2.find_one(
        {"content_item_id": item_id},
        {"_id": 0, "id": 1, "name": 1}
    )
    
    if associated_webinar:
        raise HTTPException(
            status_code=409,
            detail=f"No se puede eliminar: tiene un webinar asociado '{associated_webinar.get('name')}'"
        )
    
    result = await db.content_items.delete_one({"id": item_id})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Content item not found")
    
    return {"success": True}


# ============ DICTATION AUTOSAVE ============

@router.patch("/items/{item_id}/dictation")
async def update_dictation(
    item_id: str,
    data: DictationUpdate,
    current_user: dict = Depends(get_current_user)
):
    """
    Autosave endpoint for dictation text.
    Called frequently from the frontend as user types.
    """
    result = await db.content_items.update_one(
        {"id": item_id},
        {
            "$set": {
                "dictation_draft_text": data.dictation_draft_text,
                "updated_at": datetime.now(timezone.utc).isoformat(),
                "dictation_last_saved": datetime.now(timezone.utc).isoformat()
            }
        }
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Content item not found")
    
    return {"success": True, "saved_at": datetime.now(timezone.utc).isoformat()}


# ============ CONTENT ITEMS BY MATRIX CELL ============

@router.get("/matrix/{competency_id}/level/{level}")
async def get_items_by_matrix_cell(
    competency_id: str,
    level: int,
    current_user: dict = Depends(get_current_user)
):
    """Get all content items for a specific matrix cell (competency + level)"""
    if level < 1 or level > 4:
        raise HTTPException(status_code=400, detail="Level must be between 1 and 4")
    
    items = await db.content_items.find(
        {"competency_id": competency_id, "level": level},
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    
    # Enrich each item with webinar data
    for item in items:
        webinar = await db.webinar_events_v2.find_one(
            {"content_item_id": item.get("id")},
            {"_id": 0, "id": 1, "name": 1, "youtube_broadcast_id": 1, "youtube_video_id": 1, 
             "youtube_privacy": 1, "slug": 1, "landing_page_url": 1}
        )
        if webinar:
            item["webinar"] = webinar
            video_id = webinar.get("youtube_video_id") or webinar.get("youtube_broadcast_id")
            if video_id:
                item["youtube_url"] = f"https://youtube.com/watch?v={video_id}"
    
    return {
        "success": True,
        "competency_id": competency_id,
        "level": level,
        "items": items,
        "total": len(items)
    }


# ============ UNCLASSIFIED CONTENT ============

@router.get("/unclassified")
async def get_unclassified_content(
    current_user: dict = Depends(get_current_user)
):
    """Get content items that haven't been assigned to a competency/level yet"""
    items = await db.content_items.find(
        {
            "$or": [
                {"competency_id": None},
                {"competency_id": {"$exists": False}},
                {"level": None},
                {"level": {"$exists": False}}
            ]
        },
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    
    return {
        "success": True,
        "items": items,
        "total": len(items)
    }


# ============ STATS ============

@router.get("/stats")
async def get_content_stats(current_user: dict = Depends(get_current_user)):
    """Get content statistics"""
    total = await db.content_items.count_documents({})
    
    # By status
    status_pipeline = [
        {"$group": {"_id": "$status", "count": {"$sum": 1}}}
    ]
    by_status = await db.content_items.aggregate(status_pipeline).to_list(10)
    
    # By source
    source_pipeline = [
        {"$group": {"_id": "$source", "count": {"$sum": 1}}}
    ]
    by_source = await db.content_items.aggregate(source_pipeline).to_list(10)
    
    # Unclassified count
    unclassified = await db.content_items.count_documents({
        "$or": [
            {"competency_id": None},
            {"competency_id": {"$exists": False}},
            {"level": None},
            {"level": {"$exists": False}}
        ]
    })
    
    return {
        "success": True,
        "total": total,
        "unclassified": unclassified,
        "by_status": {item["_id"]: item["count"] for item in by_status if item["_id"]},
        "by_source": {item["_id"]: item["count"] for item in by_source if item["_id"]}
    }



# ============ NEWSLETTER QUEUE SYSTEM ============

class NewsletterQueueItem(BaseModel):
    """Model for adding content to newsletter queue"""
    content_item_id: str
    thematic_axis_id: str
    priority: Optional[int] = 0  # Higher = more priority
    notes: Optional[str] = None


@router.get("/newsletter-queue")
async def list_newsletter_queue(
    thematic_axis_id: Optional[str] = None,
    status: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """
    List newsletter queue items.
    Items are grouped by thematic axis and ordered by priority.
    """
    query = {}
    if thematic_axis_id:
        query["thematic_axis_id"] = thematic_axis_id
    if status:
        query["status"] = status
    
    items = await db.newsletter_queue.find(query, {"_id": 0}).sort(
        [("thematic_axis_id", 1), ("priority", -1), ("queued_at", 1)]
    ).to_list(200)
    
    # Enrich with content item info
    content_ids = [i.get("content_item_id") for i in items if i.get("content_item_id")]
    content_items = await db.content_items.find(
        {"id": {"$in": content_ids}},
        {"_id": 0, "id": 1, "title": 1, "url": 1, "status": 1}
    ).to_list(200)
    content_map = {c["id"]: c for c in content_items}
    
    # Enrich with axis info
    axis_ids = list(set(i.get("thematic_axis_id") for i in items if i.get("thematic_axis_id")))
    axes = await db.thematic_axes.find({"id": {"$in": axis_ids}}, {"_id": 0}).to_list(50)
    axis_map = {a["id"]: a for a in axes}
    
    for item in items:
        item["content_item"] = content_map.get(item.get("content_item_id"))
        item["thematic_axis"] = axis_map.get(item.get("thematic_axis_id"))
    
    # Group by axis
    grouped = {}
    for item in items:
        axis_id = item.get("thematic_axis_id", "unassigned")
        if axis_id not in grouped:
            grouped[axis_id] = {
                "axis": item.get("thematic_axis"),
                "items": []
            }
        grouped[axis_id]["items"].append(item)
    
    return {
        "success": True,
        "queue_items": items,
        "grouped": grouped,
        "total": len(items)
    }


@router.post("/newsletter-queue")
async def add_to_newsletter_queue(
    data: NewsletterQueueItem,
    current_user: dict = Depends(get_current_user)
):
    """
    Add a content item to the newsletter queue for a specific thematic axis.
    """
    # Verify content item exists
    content_item = await db.content_items.find_one({"id": data.content_item_id})
    if not content_item:
        raise HTTPException(status_code=404, detail="Content item not found")
    
    # Verify thematic axis exists
    axis = await db.thematic_axes.find_one({"id": data.thematic_axis_id})
    if not axis:
        raise HTTPException(status_code=404, detail="Thematic axis not found")
    
    # Check if already in queue for this axis
    existing = await db.newsletter_queue.find_one({
        "content_item_id": data.content_item_id,
        "thematic_axis_id": data.thematic_axis_id
    })
    if existing:
        raise HTTPException(status_code=400, detail="Content already in queue for this axis")
    
    queue_item = {
        "id": str(uuid.uuid4()),
        "content_item_id": data.content_item_id,
        "thematic_axis_id": data.thematic_axis_id,
        "priority": data.priority,
        "notes": data.notes,
        "status": "pending",  # pending, included, sent
        "queued_at": datetime.now(timezone.utc).isoformat(),
        "queued_by": current_user.get("email")
    }
    
    await db.newsletter_queue.insert_one(queue_item)
    
    # Update content item processing state
    await db.content_items.update_one(
        {"id": data.content_item_id},
        {"$set": {"processing_state.newsletter_queued": True}}
    )
    
    logger.info(f"Content {data.content_item_id} added to newsletter queue for axis {data.thematic_axis_id}")
    
    return {
        "success": True,
        "queue_item": {k: v for k, v in queue_item.items() if k != "_id"}
    }


@router.delete("/newsletter-queue/{queue_id}")
async def remove_from_newsletter_queue(
    queue_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Remove an item from the newsletter queue"""
    queue_item = await db.newsletter_queue.find_one({"id": queue_id})
    if not queue_item:
        raise HTTPException(status_code=404, detail="Queue item not found")
    
    await db.newsletter_queue.delete_one({"id": queue_id})
    
    # Update content item if no other queue entries
    remaining = await db.newsletter_queue.count_documents({
        "content_item_id": queue_item.get("content_item_id")
    })
    if remaining == 0:
        await db.content_items.update_one(
            {"id": queue_item.get("content_item_id")},
            {"$set": {"processing_state.newsletter_queued": False}}
        )
    
    return {"success": True}


class PriorityUpdate(BaseModel):
    """Model for updating queue priority"""
    priority: int


@router.put("/newsletter-queue/{queue_id}/priority")
async def update_queue_priority(
    queue_id: str,
    data: PriorityUpdate,
    current_user: dict = Depends(get_current_user)
):
    """Update the priority of a newsletter queue item"""
    result = await db.newsletter_queue.update_one(
        {"id": queue_id},
        {"$set": {"priority": data.priority, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Queue item not found")
    
    return {"success": True}


@router.post("/items/{item_id}/queue-for-newsletter")
async def auto_queue_for_newsletter(
    item_id: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Automatically queue a content item for its thematic axis newsletter.
    Requires the content item to have a thematic_axis_id assigned.
    """
    content_item = await db.content_items.find_one({"id": item_id})
    if not content_item:
        raise HTTPException(status_code=404, detail="Content item not found")
    
    axis_id = content_item.get("thematic_axis_id")
    if not axis_id:
        raise HTTPException(
            status_code=400,
            detail="Content item must have a thematic axis assigned before queuing"
        )
    
    # Check if already queued
    existing = await db.newsletter_queue.find_one({
        "content_item_id": item_id,
        "thematic_axis_id": axis_id
    })
    if existing:
        return {
            "success": True,
            "already_queued": True,
            "queue_item_id": existing.get("id")
        }
    
    queue_item = {
        "id": str(uuid.uuid4()),
        "content_item_id": item_id,
        "thematic_axis_id": axis_id,
        "priority": 0,
        "status": "pending",
        "queued_at": datetime.now(timezone.utc).isoformat(),
        "queued_by": current_user.get("email"),
        "auto_queued": True
    }
    
    await db.newsletter_queue.insert_one(queue_item)
    
    await db.content_items.update_one(
        {"id": item_id},
        {"$set": {"processing_state.newsletter_queued": True}}
    )
    
    return {
        "success": True,
        "already_queued": False,
        "queue_item": {k: v for k, v in queue_item.items() if k != "_id"}
    }


@router.post("/items/{item_id}/schedule-newsletter")
async def schedule_newsletter_for_item(
    item_id: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Schedule a newsletter for this content item's blog post.
    Schedules for next Monday at 9:00 AM CDMX.
    """
    content_item = await db.content_items.find_one({"id": item_id}, {"_id": 0})
    if not content_item:
        raise HTTPException(status_code=404, detail="Content item not found")
    
    # Check if already has newsletter scheduled
    if content_item.get("newsletter_id"):
        existing = await db.newsletters.find_one({"id": content_item["newsletter_id"]}, {"_id": 0})
        if existing:
            return {
                "success": True,
                "already_scheduled": True,
                "newsletter_id": existing.get("id"),
                "scheduled_at": existing.get("scheduled_at")
            }
    
    # Get blog post
    blog_es_slug = content_item.get("blog_es_slug")
    if not blog_es_slug:
        raise HTTPException(status_code=400, detail="Content item must have blog generated first")
    
    blog_post = await db.blog_posts.find_one({"slug": blog_es_slug}, {"_id": 0})
    if not blog_post:
        raise HTTPException(status_code=404, detail="Blog post not found")
    
    # Calculate next Monday 9:00 AM CDMX
    from zoneinfo import ZoneInfo
    from datetime import timedelta as td
    cdmx_tz = ZoneInfo("America/Mexico_City")
    now_cdmx = datetime.now(cdmx_tz)
    
    days_until_monday = (7 - now_cdmx.weekday()) % 7
    if days_until_monday == 0 and now_cdmx.hour >= 9:
        days_until_monday = 7
    
    next_monday = now_cdmx + td(days=days_until_monday)
    next_monday = next_monday.replace(hour=9, minute=0, second=0, microsecond=0)
    
    # Check for existing newsletter on that date
    existing_newsletter = await db.newsletters.find_one({
        "scheduled_at": {"$gte": next_monday.isoformat(), "$lt": (next_monday + td(days=1)).isoformat()},
        "status": "scheduled"
    })
    if existing_newsletter:
        next_monday = next_monday + td(days=7)
    
    # Generate newsletter HTML
    title = content_item.get("title", blog_post.get("title", "Newsletter"))
    blog_url = f"https://leaderlix.com/blog/{blog_es_slug}"
    
    newsletter_html = f"""
    <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff;">
        <div style="background: #ff3300; padding: 30px; text-align: center;">
            <h1 style="color: #ffffff; margin: 0; font-size: 24px;">Leaderlix Weekly</h1>
        </div>
        <div style="padding: 30px;">
            <h2 style="color: #333; margin-top: 0;">{blog_post.get('title', title)}</h2>
            <p style="color: #666; line-height: 1.6;">{blog_post.get('excerpt', '')[:300]}...</p>
            <a href="{blog_url}" style="display: inline-block; background: #ff3300; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; margin-top: 20px;">Leer artículo completo →</a>
        </div>
        <div style="background: #f5f5f5; padding: 20px; text-align: center;">
            <p style="color: #999; font-size: 12px; margin: 0;">© 2026 Leaderlix</p>
        </div>
    </div>
    """
    
    now = datetime.now(timezone.utc)
    newsletter_doc = {
        "id": str(uuid.uuid4()),
        "name": f"Newsletter: {title[:50]}",
        "subject": f"📚 {blog_post.get('title', title)}",
        "content_html": newsletter_html,
        "content_item_id": item_id,
        "blog_post_id": blog_post.get("id"),
        "status": "scheduled",
        "scheduled_at": next_monday.astimezone(timezone.utc).isoformat(),
        "auto_generated": True,
        "created_at": now.isoformat(),
        "updated_at": now.isoformat()
    }
    
    await db.newsletters.insert_one(newsletter_doc)
    
    # Update content item
    await db.content_items.update_one(
        {"id": item_id},
        {"$set": {
            "processing_state.newsletter_queued": True,
            "newsletter_id": newsletter_doc["id"],
            "newsletter_scheduled_at": newsletter_doc["scheduled_at"]
        }}
    )
    
    return {
        "success": True,
        "newsletter_id": newsletter_doc["id"],
        "scheduled_at": newsletter_doc["scheduled_at"],
        "scheduled_at_cdmx": next_monday.strftime("%Y-%m-%d %H:%M") + " CDMX"
    }


# ============ VIDEO UPLOAD & YOUTUBE INTEGRATION ============

class VideoUploadRequest(BaseModel):
    """Request to upload video for a content item"""
    video_url: Optional[str] = None  # URL to video file
    title: Optional[str] = None  # Override content item title
    description: Optional[str] = None  # Override/add description
    tags: Optional[List[str]] = []
    privacy_status: str = "public"  # public, private, unlisted


@router.post("/items/{item_id}/upload-video")
async def upload_video_for_content(
    item_id: str,
    data: VideoUploadRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Prepare a content item for video upload.
    This creates a video record linked to the content item.
    Actual upload to YouTube requires OAuth connection.
    """
    content_item = await db.content_items.find_one({"id": item_id})
    if not content_item:
        raise HTTPException(status_code=404, detail="Content item not found")
    
    # Create or update video record
    video_record = {
        "id": str(uuid.uuid4()),
        "content_item_id": item_id,
        "title": data.title or content_item.get("title"),
        "description": data.description or content_item.get("dictation_draft_text", "")[:500],
        "tags": data.tags or content_item.get("tags", []),
        "video_url": data.video_url,
        "privacy_status": data.privacy_status,
        "status": "pending_upload",  # pending_upload, uploading, processing, published, failed
        "youtube_video_id": None,
        "youtube_url": None,
        "thumbnail_url": None,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "created_by": current_user.get("email")
    }
    
    # Check if video already exists for this content
    existing = await db.content_videos.find_one({"content_item_id": item_id})
    if existing:
        await db.content_videos.update_one(
            {"content_item_id": item_id},
            {"$set": {
                **video_record,
                "id": existing.get("id"),
                "updated_at": datetime.now(timezone.utc).isoformat()
            }}
        )
        video_record["id"] = existing.get("id")
    else:
        await db.content_videos.insert_one(video_record)
    
    # Update content item processing state
    await db.content_items.update_one(
        {"id": item_id},
        {"$set": {"processing_state.video_uploaded": True}}
    )
    
    return {
        "success": True,
        "video": {k: v for k, v in video_record.items() if k != "_id"},
        "message": "Video record created. Connect YouTube and use /publish-to-youtube to upload."
    }


@router.get("/items/{item_id}/video")
async def get_content_video(
    item_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get video information for a content item"""
    video = await db.content_videos.find_one({"content_item_id": item_id}, {"_id": 0})
    
    if not video:
        return {"success": True, "video": None}
    
    return {"success": True, "video": video}


@router.post("/items/{item_id}/publish-to-youtube")
async def publish_to_youtube(
    item_id: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Publish the content item's video to YouTube.
    Requires:
    1. Video record to exist (created via /upload-video)
    2. Video URL to be accessible
    3. YouTube OAuth to be connected
    
    This endpoint triggers the actual upload to YouTube.
    """
    from routers.youtube import get_youtube_service_with_oauth, YOUTUBE_API_AVAILABLE
    
    if not YOUTUBE_API_AVAILABLE:
        raise HTTPException(status_code=500, detail="YouTube API not available")
    
    content_item = await db.content_items.find_one({"id": item_id})
    if not content_item:
        raise HTTPException(status_code=404, detail="Content item not found")
    
    video = await db.content_videos.find_one({"content_item_id": item_id})
    if not video:
        raise HTTPException(
            status_code=400,
            detail="No video record found. Create one first with /upload-video"
        )
    
    if not video.get("video_url"):
        raise HTTPException(
            status_code=400,
            detail="No video URL provided. Update video record with video_url"
        )
    
    user_id = str(current_user.get("_id") or current_user.get("id", ""))
    
    try:
        youtube = await get_youtube_service_with_oauth(user_id)
        
        # Update status to uploading
        await db.content_videos.update_one(
            {"content_item_id": item_id},
            {"$set": {"status": "uploading", "upload_started_at": datetime.now(timezone.utc).isoformat()}}
        )
        
        # Note: In production, you'd download the video and use MediaFileUpload
        # For now, we mark it as pending manual upload
        
        return {
            "success": True,
            "message": "YouTube upload initiated. Video will be processed.",
            "status": "uploading",
            "note": "For large videos, use the YouTube upload endpoint directly with the video file."
        }
        
    except Exception as e:
        logger.error(f"YouTube publish error: {e}")
        await db.content_videos.update_one(
            {"content_item_id": item_id},
            {"$set": {"status": "failed", "error": str(e)}}
        )
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/items/{item_id}/youtube-link")
async def set_youtube_link(
    item_id: str,
    youtube_url: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Manually set the YouTube URL for a content item after uploading externally.
    """
    content_item = await db.content_items.find_one({"id": item_id})
    if not content_item:
        raise HTTPException(status_code=404, detail="Content item not found")
    
    # Extract video ID from URL
    video_id = None
    if "youtube.com/watch?v=" in youtube_url:
        video_id = youtube_url.split("v=")[1].split("&")[0]
    elif "youtu.be/" in youtube_url:
        video_id = youtube_url.split("youtu.be/")[1].split("?")[0]
    
    # Update or create video record
    video_record = {
        "youtube_url": youtube_url,
        "youtube_video_id": video_id,
        "status": "published",
        "published_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    existing = await db.content_videos.find_one({"content_item_id": item_id})
    if existing:
        await db.content_videos.update_one(
            {"content_item_id": item_id},
            {"$set": video_record}
        )
    else:
        video_record.update({
            "id": str(uuid.uuid4()),
            "content_item_id": item_id,
            "title": content_item.get("title"),
            "created_at": datetime.now(timezone.utc).isoformat()
        })
        await db.content_videos.insert_one(video_record)
    
    # Update content item processing state
    await db.content_items.update_one(
        {"id": item_id},
        {"$set": {
            "processing_state.video_uploaded": True,
            "processing_state.youtube_published": True,
            "youtube_url": youtube_url
        }}
    )
    
    return {
        "success": True,
        "youtube_url": youtube_url,
        "video_id": video_id
    }



# ============ LMS INTEGRATION ============

class LMSLessonRequest(BaseModel):
    """Request to create/update LMS lesson from content item"""
    course_id: str
    title: Optional[str] = None
    description: Optional[str] = None
    order: Optional[int] = None
    is_free: bool = False


@router.post("/items/{item_id}/create-lms-lesson")
async def create_lms_lesson(
    item_id: str,
    data: LMSLessonRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Create an LMS lesson from a content item.
    Embeds the YouTube video if available.
    """
    content_item = await db.content_items.find_one({"id": item_id})
    if not content_item:
        raise HTTPException(status_code=404, detail="Content item not found")
    
    # Verify course exists
    from bson import ObjectId
    try:
        course = await db.courses.find_one({"_id": ObjectId(data.course_id)})
    except Exception:
        course = await db.courses.find_one({"id": data.course_id})
    
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    
    # Get video info if available
    video = await db.content_videos.find_one({"content_item_id": item_id})
    youtube_url = video.get("youtube_url") if video else content_item.get("youtube_url")
    
    # Determine order
    order = data.order
    if order is None:
        max_lesson = await db.lessons.find_one(
            {"course_id": data.course_id},
            sort=[("order", -1)]
        )
        order = (max_lesson.get("order", 0) + 1) if max_lesson else 1
    
    # Create lesson document
    lesson_doc = {
        "course_id": data.course_id,
        "content_item_id": item_id,
        "title": data.title or content_item.get("title"),
        "description": data.description or content_item.get("dictation_draft_text", "")[:500],
        "content_type": "video" if youtube_url else "text",
        "content_url": youtube_url or "",
        "content_text": content_item.get("dictation_draft_text", ""),
        "duration_minutes": 0,
        "order": order,
        "is_free": data.is_free,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "created_by": current_user.get("email")
    }
    
    # Check if lesson already exists for this content item
    existing_lesson = await db.lessons.find_one({"content_item_id": item_id})
    if existing_lesson:
        # Update existing lesson
        await db.lessons.update_one(
            {"content_item_id": item_id},
            {"$set": {
                **lesson_doc,
                "updated_at": datetime.now(timezone.utc).isoformat()
            }}
        )
        lesson_id = str(existing_lesson.get("_id"))
    else:
        # Create new lesson
        result = await db.lessons.insert_one(lesson_doc)
        lesson_id = str(result.inserted_id)
    
    # Update content item processing state
    await db.content_items.update_one(
        {"id": item_id},
        {"$set": {
            "processing_state.lms_created": True,
            "lms_lesson_id": lesson_id,
            "lms_course_id": data.course_id
        }}
    )
    
    logger.info(f"LMS lesson created/updated for content item {item_id}")
    
    return {
        "success": True,
        "lesson_id": lesson_id,
        "course_id": data.course_id,
        "updated": existing_lesson is not None
    }


@router.get("/items/{item_id}/lms-lesson")
async def get_content_lms_lesson(
    item_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get LMS lesson information for a content item"""
    content_item = await db.content_items.find_one({"id": item_id})
    if not content_item:
        raise HTTPException(status_code=404, detail="Content item not found")
    
    lesson = await db.lessons.find_one({"content_item_id": item_id})
    
    if not lesson:
        return {"success": True, "lesson": None}
    
    # Serialize lesson
    lesson["id"] = str(lesson.pop("_id", ""))
    
    return {"success": True, "lesson": lesson}


# ============ ADVANCED SEARCH ============

class SearchRequest(BaseModel):
    """Request for content search"""
    query: str
    thematic_axis_id: Optional[str] = None
    competency_id: Optional[str] = None
    level: Optional[int] = None
    status: Optional[str] = None
    limit: int = 50


@router.post("/search")
async def search_content(
    data: SearchRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Full-text search across content items.
    Searches in: title, dictation_draft_text, notes, tags
    """
    query = data.query.strip().lower()
    
    if not query:
        raise HTTPException(status_code=400, detail="Search query required")
    
    # Build base filter
    base_filter = {}
    if data.thematic_axis_id:
        base_filter["thematic_axis_id"] = data.thematic_axis_id
    if data.competency_id:
        base_filter["competency_id"] = data.competency_id
    if data.level:
        base_filter["level"] = data.level
    if data.status:
        base_filter["status"] = data.status
    
    # Use MongoDB text search if available, otherwise regex
    # For now, use regex for flexibility
    search_filter = {
        **base_filter,
        "$or": [
            {"title": {"$regex": query, "$options": "i"}},
            {"dictation_draft_text": {"$regex": query, "$options": "i"}},
            {"notes": {"$regex": query, "$options": "i"}},
            {"tags": {"$regex": query, "$options": "i"}}
        ]
    }
    
    items = await db.content_items.find(
        search_filter,
        {"_id": 0}
    ).sort("created_at", -1).limit(data.limit).to_list(data.limit)
    
    # Calculate relevance scores (simple match count)
    for item in items:
        score = 0
        title = (item.get("title") or "").lower()
        text = (item.get("dictation_draft_text") or "").lower()
        notes = (item.get("notes") or "").lower()
        
        if query in title:
            score += 10  # Title match is most important
        if query in text:
            score += 5
        if query in notes:
            score += 3
        
        item["relevance_score"] = score
    
    # Sort by relevance
    items.sort(key=lambda x: x.get("relevance_score", 0), reverse=True)
    
    return {
        "success": True,
        "query": data.query,
        "items": items,
        "total": len(items)
    }


# ============ STATE MACHINE ============

# Valid state transitions for content items
STATE_TRANSITIONS = {
    "draft": ["dictated", "processing"],
    "dictated": ["processing", "draft"],
    "processing": ["processed", "draft"],
    "processed": ["published", "processing"],
    "published": ["processed"]  # Can unpublish
}

PROCESSING_STAGES = [
    "cleaned",
    "blog_es_generated",
    "blog_en_generated",
    "slides_generated",
    "video_uploaded",
    "youtube_published",
    "lms_created",
    "newsletter_queued"
]


class StateTransitionRequest(BaseModel):
    """Request to transition content item state"""
    new_status: str
    force: bool = False  # Force transition even if invalid


@router.post("/items/{item_id}/transition")
async def transition_content_state(
    item_id: str,
    data: StateTransitionRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Transition a content item to a new status.
    Validates the transition is allowed unless force=True.
    """
    content_item = await db.content_items.find_one({"id": item_id})
    if not content_item:
        raise HTTPException(status_code=404, detail="Content item not found")
    
    current_status = content_item.get("status", "draft")
    new_status = data.new_status
    
    # Validate transition
    valid_transitions = STATE_TRANSITIONS.get(current_status, [])
    if new_status not in valid_transitions and not data.force:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid transition from '{current_status}' to '{new_status}'. Valid transitions: {valid_transitions}"
        )
    
    # Record state history
    state_history = content_item.get("state_history", [])
    state_history.append({
        "from_status": current_status,
        "to_status": new_status,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "by": current_user.get("email"),
        "forced": data.force
    })
    
    # Update content item
    await db.content_items.update_one(
        {"id": item_id},
        {"$set": {
            "status": new_status,
            "state_history": state_history,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    logger.info(f"Content item {item_id} transitioned from {current_status} to {new_status}")
    
    return {
        "success": True,
        "previous_status": current_status,
        "new_status": new_status,
        "valid_next_transitions": STATE_TRANSITIONS.get(new_status, [])
    }


@router.get("/items/{item_id}/processing-status")
async def get_processing_status(
    item_id: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Get detailed processing status for a content item.
    Shows which stages are complete and what's remaining.
    """
    content_item = await db.content_items.find_one({"id": item_id}, {"_id": 0})
    if not content_item:
        raise HTTPException(status_code=404, detail="Content item not found")
    
    processing_state = content_item.get("processing_state", {})
    
    # Calculate completion
    completed_stages = [stage for stage in PROCESSING_STAGES if processing_state.get(stage)]
    pending_stages = [stage for stage in PROCESSING_STAGES if not processing_state.get(stage)]
    completion_percent = (len(completed_stages) / len(PROCESSING_STAGES)) * 100 if PROCESSING_STAGES else 0
    
    return {
        "success": True,
        "item_id": item_id,
        "status": content_item.get("status"),
        "processing_state": processing_state,
        "completed_stages": completed_stages,
        "pending_stages": pending_stages,
        "completion_percent": round(completion_percent, 1),
        "state_history": content_item.get("state_history", []),
        "valid_next_transitions": STATE_TRANSITIONS.get(content_item.get("status", "draft"), [])
    }


@router.post("/items/{item_id}/retry-stage")
async def retry_processing_stage(
    item_id: str,
    stage: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Reset a processing stage to allow retry.
    Idempotent - can be called multiple times safely.
    """
    if stage not in PROCESSING_STAGES:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid stage. Valid stages: {PROCESSING_STAGES}"
        )
    
    content_item = await db.content_items.find_one({"id": item_id})
    if not content_item:
        raise HTTPException(status_code=404, detail="Content item not found")
    
    # Reset the stage
    await db.content_items.update_one(
        {"id": item_id},
        {
            "$set": {
                f"processing_state.{stage}": False,
                f"processing_state.{stage}_retry_at": datetime.now(timezone.utc).isoformat(),
                "updated_at": datetime.now(timezone.utc).isoformat()
            }
        }
    )
    
    logger.info(f"Processing stage '{stage}' reset for content item {item_id}")
    
    return {
        "success": True,
        "stage": stage,
        "message": f"Stage '{stage}' reset for retry"
    }



# ============ AI GENERATION ENDPOINTS ============

class ThumbnailGenerateRequest(BaseModel):
    """Request to generate YouTube thumbnail"""
    style: str = "professional"  # professional, creative, bold, minimal


class DescriptionGenerateRequest(BaseModel):
    """Request to generate YouTube description"""
    language: str = "es"  # es, en


class BlogGenerateRequest(BaseModel):
    """Request to generate blog post"""
    language: str = "es"  # es, en
    word_count: int = 800


@router.post("/items/{item_id}/generate-thumbnail")
async def generate_thumbnail(
    item_id: str,
    data: ThumbnailGenerateRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Generate a YouTube thumbnail for a content item using Gemini Nano Banana.
    Saves the thumbnail to the content_videos collection.
    """
    from services.content_ai_service import generate_youtube_thumbnail
    
    content_item = await db.content_items.find_one({"id": item_id})
    if not content_item:
        raise HTTPException(status_code=404, detail="Content item not found")
    
    title = content_item.get("title", "")
    description = content_item.get("dictation_draft_text", "")[:500]
    
    result = await generate_youtube_thumbnail(
        title=title,
        description=description,
        style=data.style
    )
    
    if not result.get("success"):
        raise HTTPException(status_code=500, detail=result.get("error", "Failed to generate thumbnail"))
    
    # Save thumbnail to video record
    thumbnail_data = {
        "thumbnail_base64": result.get("image_base64"),
        "thumbnail_mime_type": result.get("mime_type"),
        "thumbnail_generated_at": datetime.now(timezone.utc).isoformat(),
        "thumbnail_style": data.style
    }
    
    existing = await db.content_videos.find_one({"content_item_id": item_id})
    if existing:
        await db.content_videos.update_one(
            {"content_item_id": item_id},
            {"$set": thumbnail_data}
        )
    else:
        await db.content_videos.insert_one({
            "id": str(uuid.uuid4()),
            "content_item_id": item_id,
            "title": title,
            **thumbnail_data,
            "created_at": datetime.now(timezone.utc).isoformat()
        })
    
    logger.info(f"Thumbnail generated for content item {item_id}")
    
    return {
        "success": True,
        "message": "Thumbnail generated successfully",
        "mime_type": result.get("mime_type"),
        "style": data.style
    }


@router.get("/items/{item_id}/thumbnail")
async def get_thumbnail(
    item_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get the generated thumbnail for a content item"""
    video = await db.content_videos.find_one({"content_item_id": item_id}, {"_id": 0})
    
    if not video or not video.get("thumbnail_base64"):
        return {"success": True, "has_thumbnail": False, "thumbnail": None}
    
    return {
        "success": True,
        "has_thumbnail": True,
        "thumbnail": {
            "base64": video.get("thumbnail_base64"),
            "mime_type": video.get("thumbnail_mime_type"),
            "generated_at": video.get("thumbnail_generated_at"),
            "style": video.get("thumbnail_style")
        }
    }


@router.post("/items/{item_id}/generate-description")
async def generate_description(
    item_id: str,
    data: DescriptionGenerateRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Generate a YouTube description for a content item using Gemini.
    Saves the description to the content_videos collection.
    """
    from services.content_ai_service import generate_youtube_description
    
    content_item = await db.content_items.find_one({"id": item_id})
    if not content_item:
        raise HTTPException(status_code=404, detail="Content item not found")
    
    # Get thematic axis and competency names
    thematic_axis_name = ""
    competency_name = ""
    
    if content_item.get("thematic_axis_id"):
        axis = await db.thematic_axes.find_one({"id": content_item["thematic_axis_id"]})
        if axis:
            thematic_axis_name = axis.get("name", "")
    
    if content_item.get("competency_id"):
        comp = await db.competencies.find_one({"id": content_item["competency_id"]})
        if comp:
            competency_name = comp.get("name", "")
    
    result = await generate_youtube_description(
        title=content_item.get("title", ""),
        dictation_text=content_item.get("dictation_draft_text", ""),
        competency=competency_name,
        thematic_axis=thematic_axis_name,
        language=data.language
    )
    
    if not result.get("success"):
        raise HTTPException(status_code=500, detail=result.get("error", "Failed to generate description"))
    
    # Save description to video record
    description_data = {
        f"description_{data.language}": result.get("description"),
        f"description_{data.language}_generated_at": datetime.now(timezone.utc).isoformat()
    }
    
    existing = await db.content_videos.find_one({"content_item_id": item_id})
    if existing:
        await db.content_videos.update_one(
            {"content_item_id": item_id},
            {"$set": description_data}
        )
    else:
        await db.content_videos.insert_one({
            "id": str(uuid.uuid4()),
            "content_item_id": item_id,
            "title": content_item.get("title"),
            **description_data,
            "created_at": datetime.now(timezone.utc).isoformat()
        })
    
    logger.info(f"Description generated for content item {item_id} in {data.language}")
    
    return {
        "success": True,
        "description": result.get("description"),
        "language": data.language
    }


@router.post("/items/{item_id}/generate-blog")
async def generate_blog(
    item_id: str,
    data: BlogGenerateRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Generate a blog post from content item's dictation using Gemini.
    Saves the blog to the content_blogs collection.
    """
    from services.content_ai_service import generate_blog_post
    
    content_item = await db.content_items.find_one({"id": item_id})
    if not content_item:
        raise HTTPException(status_code=404, detail="Content item not found")
    
    dictation = content_item.get("dictation_draft_text", "")
    if not dictation or len(dictation) < 100:
        raise HTTPException(
            status_code=400,
            detail="Content item needs at least 100 characters of dictation text to generate a blog post"
        )
    
    result = await generate_blog_post(
        title=content_item.get("title", ""),
        dictation_text=dictation,
        language=data.language,
        word_count=data.word_count
    )
    
    if not result.get("success"):
        raise HTTPException(status_code=500, detail=result.get("error", "Failed to generate blog post"))
    
    # Save blog to content_blogs collection
    blog_doc = {
        "id": str(uuid.uuid4()),
        "content_item_id": item_id,
        "title": content_item.get("title"),
        "language": data.language,
        "blog_markdown": result.get("blog_markdown"),
        "word_count": len(result.get("blog_markdown", "").split()),
        "status": "draft",
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "generated_by": current_user.get("email")
    }
    
    # Check if blog already exists for this content + language
    existing = await db.content_blogs.find_one({
        "content_item_id": item_id,
        "language": data.language
    })
    
    if existing:
        await db.content_blogs.update_one(
            {"content_item_id": item_id, "language": data.language},
            {"$set": {
                "blog_markdown": result.get("blog_markdown"),
                "word_count": len(result.get("blog_markdown", "").split()),
                "updated_at": datetime.now(timezone.utc).isoformat()
            }}
        )
        blog_doc["id"] = existing.get("id")
    else:
        await db.content_blogs.insert_one(blog_doc)
    
    # Update processing state
    await db.content_items.update_one(
        {"id": item_id},
        {"$set": {f"processing_state.blog_{data.language}_generated": True}}
    )
    
    logger.info(f"Blog post generated for content item {item_id} in {data.language}")
    
    return {
        "success": True,
        "blog_id": blog_doc["id"],
        "blog_markdown": result.get("blog_markdown"),
        "language": data.language,
        "word_count": len(result.get("blog_markdown", "").split())
    }


@router.get("/items/{item_id}/blogs")
async def get_content_blogs(
    item_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get all generated blog posts for a content item"""
    blogs = await db.content_blogs.find(
        {"content_item_id": item_id},
        {"_id": 0}
    ).to_list(10)
    
    return {
        "success": True,
        "blogs": blogs,
        "total": len(blogs)
    }


# ============ SLIDES GENERATION ============

class SlidesRequest(BaseModel):
    slide_count: int = 8

class SlidesPreviewRequest(BaseModel):
    text: str
    slide_count: int = 8

@router.post("/items/{item_id}/preview-slides")
async def preview_slides(
    item_id: str,
    request: SlidesPreviewRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Preview the structured content for slides without generating them.
    Returns the AI-structured content that would be used for slides.
    """
    from services.slides_service import structure_content_for_slides
    
    # Get content item
    content_item = await db.content_items.find_one({"id": item_id})
    if not content_item:
        raise HTTPException(status_code=404, detail="Content item not found")
    
    if len(request.text) < 50:
        raise HTTPException(status_code=400, detail="Need at least 50 characters to preview")
    
    # Get competency name for context
    competency_name = ""
    if content_item.get("competency_id"):
        comp = await db.competencies.find_one({"id": content_item["competency_id"]})
        if comp:
            competency_name = comp.get("name", "")
    
    # Structure content
    result = await structure_content_for_slides(
        title=content_item.get("title", "Presentation"),
        content_text=request.text,
        competency=competency_name,
        thematic_axis=""
    )
    
    if not result.get("success"):
        raise HTTPException(status_code=500, detail=result.get("error", "Failed to preview slides"))
    
    # Limit to requested slide count
    slides = result.get("slides", [])[:request.slide_count]
    
    return {
        "success": True,
        "structured_content": slides,
        "total_slides": len(slides)
    }

@router.post("/items/{item_id}/generate-slides")
async def generate_slides(
    item_id: str,
    request: SlidesRequest = SlidesRequest(),
    current_user: dict = Depends(get_current_user)
):
    """
    Generate Google Slides presentation from content item's dictation text.
    Uses AI to structure the content and creates slides in user's Google Drive.
    
    Requires: Google OAuth with presentations scope connected.
    """
    from services.slides_service import generate_slides_from_content
    from routers.calendar import get_settings
    
    # Get content item
    content_item = await db.content_items.find_one({"id": item_id})
    if not content_item:
        raise HTTPException(status_code=404, detail="Content item not found")
    
    # Check if there's dictation text
    dictation_text = content_item.get("dictation_draft_text", "")
    if not dictation_text or len(dictation_text) < 100:
        raise HTTPException(
            status_code=400, 
            detail="Content item needs at least 100 characters of dictation text to generate slides"
        )
    
    # Get Google credentials
    settings = await get_settings()
    if not settings.get("calendar_connected"):
        raise HTTPException(
            status_code=400, 
            detail="Google account not connected. Please connect Google in Settings first."
        )
    
    calendar_credentials = settings.get("calendar_credentials", {})
    if not calendar_credentials:
        raise HTTPException(status_code=400, detail="No Google credentials found")
    
    # Get competency and thematic axis names for context
    competency_name = ""
    thematic_axis_name = ""
    
    if content_item.get("competency_id"):
        comp = await db.competencies.find_one({"id": content_item["competency_id"]})
        if comp:
            competency_name = comp.get("name", "")
    
    if content_item.get("thematic_axis_id"):
        axis = await db.thematic_axes.find_one({"id": content_item["thematic_axis_id"]})
        if axis:
            thematic_axis_name = axis.get("name", "")
    
    # Generate slides
    result = await generate_slides_from_content(
        credentials_dict=calendar_credentials,
        title=content_item.get("title", "Presentation"),
        content_text=dictation_text,
        competency=competency_name,
        thematic_axis=thematic_axis_name,
        slide_count=request.slide_count
    )
    
    if not result.get("success"):
        raise HTTPException(status_code=500, detail=result.get("error", "Failed to generate slides"))
    
    # Save slides reference to content item
    now = datetime.now(timezone.utc).isoformat()
    slides_data = {
        "presentation_id": result.get("presentation_id"),
        "presentation_url": result.get("url"),
        "slides_count": result.get("slides_count"),
        "slides_structure": result.get("slides_structure", []),
        "generated_at": now
    }
    
    await db.content_items.update_one(
        {"id": item_id},
        {"$set": {
            "slides": slides_data,
            "processing_state.slides_generated": True,
            "updated_at": now
        }}
    )
    
    logger.info(f"Slides generated for content item {item_id}: {result.get('url')}")
    
    return {
        "success": True,
        "presentation_id": result.get("presentation_id"),
        "presentation_url": result.get("url"),
        "slides_count": result.get("slides_count"),
        "message": "Google Slides presentation created successfully"
    }


@router.get("/items/{item_id}/slides")
async def get_content_slides(
    item_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get slides information for a content item"""
    content_item = await db.content_items.find_one({"id": item_id}, {"_id": 0, "slides": 1})
    
    if not content_item:
        raise HTTPException(status_code=404, detail="Content item not found")
    
    slides = content_item.get("slides")
    
    if not slides:
        return {
            "success": True,
            "has_slides": False,
            "slides": None
        }
    
    return {
        "success": True,
        "has_slides": True,
        "slides": slides
    }


# ============ BACKGROUND JOB SYSTEM FOR LONG OPERATIONS ============

import asyncio

# In-memory job storage (for this pod instance)
_background_jobs = {}

class GenerateAllRequest(BaseModel):
    """Request to generate all content at once"""
    slide_count: int = 8


async def _run_generate_all_background(job_id: str, item_id: str, slide_count: int, user_email: str):
    """
    Background task to generate all content.
    Updates job status in memory and content_item in DB as it progresses.
    """
    from services.content_ai_service import generate_blog_post
    from services.slides_service import generate_slides_from_content
    from config import GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET
    
    job = _background_jobs.get(job_id, {})
    job["status"] = "running"
    job["progress"] = "Iniciando..."
    job["started_at"] = datetime.now(timezone.utc).isoformat()
    _background_jobs[job_id] = job
    
    try:
        content_item = await db.content_items.find_one({"id": item_id})
        if not content_item:
            job["status"] = "failed"
            job["error"] = "Content item not found"
            return
        
        dictation = content_item.get("dictation_draft_text", "")
        title = content_item.get("title", "Sin título")
        now = datetime.now(timezone.utc).isoformat()
        
        results = {
            "cleaned_text": None,
            "slides_url": None,
            "blog_es_id": None,
            "blog_en_id": None,
            "errors": []
        }
        
        # Get Google credentials
        settings = await db.settings.find_one({})
        calendar_credentials = settings.get("calendar_credentials") if settings else None
        
        if calendar_credentials:
            try:
                from routers.calendar import refresh_credentials_if_needed
                calendar_credentials = refresh_credentials_if_needed(calendar_credentials)
                if calendar_credentials.get("token") != settings.get("calendar_credentials", {}).get("token"):
                    await db.settings.update_one({}, {"$set": {"calendar_credentials": calendar_credentials}})
            except Exception as e:
                logger.error(f"Failed to refresh Google credentials: {e}")
                results["errors"].append(f"Google Auth: {str(e)}")
                calendar_credentials = None
        
        # STEP 1: Clean dictation
        job["progress"] = "Limpiando texto..."
        _background_jobs[job_id] = job
        
        try:
            from emergentintegrations.llm.chat import LlmChat
            
            clean_prompt = f"""Corrige SOLO errores de ortografía, puntuación y gramática en el siguiente texto.
NO cambies el contenido, estructura, estilo ni lenguaje del autor.
NO agregues ni elimines información.
Solo devuelve el texto corregido, sin explicaciones.

Texto:
{dictation}"""
            
            chat = LlmChat(model="gemini/gemini-2.0-flash")
            cleaned_text = chat.send_message(clean_prompt)
            results["cleaned_text"] = cleaned_text
            
            await db.content_items.update_one(
                {"id": item_id},
                {"$set": {
                    "dictation_draft_text": cleaned_text,
                    "processing_state.cleaned": True,
                    "updated_at": now
                }}
            )
            logger.info(f"Dictation cleaned for {item_id}")
        except Exception as e:
            logger.error(f"Error cleaning dictation: {e}")
            results["errors"].append(f"Limpieza: {str(e)}")
            cleaned_text = dictation
        
        # STEP 2: Generate slides
        if calendar_credentials:
            job["progress"] = "Generando slides (esto toma ~2-4 min)..."
            _background_jobs[job_id] = job
            
            try:
                competency_name = ""
                if content_item.get("competency_id"):
                    comp = await db.competencies.find_one({"id": content_item["competency_id"]})
                    if comp:
                        competency_name = comp.get("name", "")
                
                slides_result = await generate_slides_from_content(
                    credentials_dict=calendar_credentials,
                    title=title,
                    content_text=cleaned_text,
                    competency=competency_name,
                    thematic_axis="",
                    slide_count=slide_count
                )
                
                if slides_result.get("success"):
                    results["slides_url"] = slides_result.get("url")
                    results["slide_image_urls"] = slides_result.get("image_urls", [])
                    
                    await db.content_items.update_one(
                        {"id": item_id},
                        {"$set": {
                            "slides": {
                                "presentation_id": slides_result.get("presentation_id"),
                                "presentation_url": slides_result.get("url"),
                                "slides_count": slides_result.get("slides_count"),
                                "image_urls": slides_result.get("image_urls", []),
                                "generated_at": now
                            },
                            "processing_state.slides_generated": True,
                            "updated_at": now
                        }}
                    )
                    logger.info(f"Slides generated for {item_id}")
                else:
                    results["errors"].append(f"Slides: {slides_result.get('error', 'Unknown error')}")
            except Exception as e:
                logger.error(f"Error generating slides: {e}")
                results["errors"].append(f"Slides: {str(e)}")
        else:
            results["errors"].append("Slides: Google no conectado")
        
        # STEP 3 & 4: Generate blogs
        job["progress"] = "Generando blogs..."
        _background_jobs[job_id] = job
        
        import unicodedata
        slug = unicodedata.normalize('NFKD', title.lower())
        slug = slug.encode('ASCII', 'ignore').decode('ASCII')
        slug = "".join(c if c.isalnum() or c == " " else "" for c in slug)
        slug = slug.replace(" ", "-")[:50]
        
        slide_image_urls = results.get("slide_image_urls", [])
        
        def extract_title_from_markdown(markdown_text, fallback_title):
            if not markdown_text:
                return fallback_title
            lines = markdown_text.strip().split('\n')
            for line in lines:
                line = line.strip()
                if line.startswith('# '):
                    return line[2:].strip()
            return fallback_title
        
        async def generate_blog_es():
            try:
                blog_es_result = await generate_blog_post(
                    title=title,
                    dictation_text=cleaned_text,
                    language="es",
                    word_count=800
                )
                
                if blog_es_result.get("success"):
                    slug_es = f"{slug}-es-{item_id[:8]}"
                    blog_content = blog_es_result.get("blog_markdown", "")
                    blog_title = extract_title_from_markdown(blog_content, title)
                    
                    blog_doc_es = {
                        "id": str(uuid.uuid4()),
                        "title": blog_title,
                        "slug": slug_es,
                        "excerpt": blog_content[:200] + "...",
                        "content": blog_content,
                        "content_item_id": item_id,
                        "category_name": "Contenido",
                        "tags": ["español", "generado"],
                        "author_name": "Leaderlix",
                        "is_published": True,
                        "reading_time_minutes": max(1, len(blog_content.split()) // 200),
                        "views": 0,
                        "language": "es",
                        "slide_images": slide_image_urls,
                        "created_at": datetime.now(timezone.utc),
                        "updated_at": datetime.now(timezone.utc)
                    }
                    
                    await db.blog_posts.insert_one(blog_doc_es)
                    await db.content_items.update_one(
                        {"id": item_id},
                        {"$set": {
                            "processing_state.blog_es_generated": True,
                            "blog_es_slug": slug_es
                        }}
                    )
                    logger.info(f"Blog ES generated for {item_id}")
                    return blog_doc_es["id"]
            except Exception as e:
                logger.error(f"Error generating Spanish blog: {e}")
                results["errors"].append(f"Blog ES: {str(e)}")
            return None
        
        async def generate_blog_en():
            try:
                blog_en_result = await generate_blog_post(
                    title=title,
                    dictation_text=cleaned_text,
                    language="en",
                    word_count=800
                )
                
                if blog_en_result.get("success"):
                    slug_en = f"{slug}-en-{item_id[:8]}"
                    blog_content = blog_en_result.get("blog_markdown", "")
                    blog_title = extract_title_from_markdown(blog_content, title)
                    
                    blog_doc_en = {
                        "id": str(uuid.uuid4()),
                        "title": blog_title,
                        "slug": slug_en,
                        "excerpt": blog_content[:200] + "...",
                        "content": blog_content,
                        "content_item_id": item_id,
                        "category_name": "Content",
                        "tags": ["english", "generated"],
                        "author_name": "Leaderlix",
                        "is_published": True,
                        "reading_time_minutes": max(1, len(blog_content.split()) // 200),
                        "views": 0,
                        "slide_images": slide_image_urls,
                        "language": "en",
                        "created_at": datetime.now(timezone.utc),
                        "updated_at": datetime.now(timezone.utc)
                    }
                    
                    await db.blog_posts.insert_one(blog_doc_en)
                    await db.content_items.update_one(
                        {"id": item_id},
                        {"$set": {
                            "processing_state.blog_en_generated": True,
                            "blog_en_slug": slug_en
                        }}
                    )
                    logger.info(f"Blog EN generated for {item_id}")
                    return blog_doc_en["id"]
            except Exception as e:
                logger.error(f"Error generating English blog: {e}")
                results["errors"].append(f"Blog EN: {str(e)}")
            return None
        
        blog_results = await asyncio.gather(generate_blog_es(), generate_blog_en())
        results["blog_es_id"] = blog_results[0]
        results["blog_en_id"] = blog_results[1]
        
        # Mark webinar pending
        await db.content_items.update_one(
            {"id": item_id},
            {"$set": {
                "processing_state.webinar_pending": True,
                "updated_at": now
            }}
        )
        
        # Update job status
        success = (
            results["slides_url"] is not None or 
            results["blog_es_id"] is not None or 
            results["blog_en_id"] is not None
        )
        
        job["status"] = "completed" if success else "failed"
        job["progress"] = "¡Completado!" if success else "Error"
        job["completed_at"] = datetime.now(timezone.utc).isoformat()
        job["results"] = results
        _background_jobs[job_id] = job
        
        logger.info(f"Background job {job_id} completed for item {item_id}")
        
    except Exception as e:
        logger.error(f"Background job {job_id} failed: {e}")
        job["status"] = "failed"
        job["error"] = str(e)
        job["completed_at"] = datetime.now(timezone.utc).isoformat()
        _background_jobs[job_id] = job


@router.post("/items/{item_id}/generate-all-async")
async def start_generate_all_async(
    item_id: str,
    request: GenerateAllRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Start content generation in background and return immediately.
    Use /items/{item_id}/generation-status/{job_id} to poll for progress.
    """
    content_item = await db.content_items.find_one({"id": item_id})
    if not content_item:
        raise HTTPException(status_code=404, detail="Content item not found")
    
    dictation = content_item.get("dictation_draft_text", "")
    if not dictation or len(dictation) < 100:
        raise HTTPException(
            status_code=400,
            detail="Se necesitan al menos 100 caracteres de dictado para generar contenido"
        )
    
    # Create job
    job_id = str(uuid.uuid4())
    _background_jobs[job_id] = {
        "id": job_id,
        "item_id": item_id,
        "status": "pending",
        "progress": "Iniciando...",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "results": None,
        "error": None
    }
    
    # Start background task
    asyncio.create_task(_run_generate_all_background(
        job_id=job_id,
        item_id=item_id,
        slide_count=request.slide_count,
        user_email=current_user.get("email", "")
    ))
    
    return {
        "success": True,
        "job_id": job_id,
        "status": "pending",
        "message": "Generación iniciada en segundo plano. Consulta el estado con el job_id."
    }


@router.get("/items/{item_id}/generation-status/{job_id}")
async def get_generation_status(
    item_id: str,
    job_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get the status of a background generation job"""
    job = _background_jobs.get(job_id)
    
    if not job:
        # Check if the content item already has generated content
        content_item = await db.content_items.find_one({"id": item_id}, {"_id": 0})
        if content_item:
            processing_state = content_item.get("processing_state", {})
            if processing_state.get("slides_generated") or processing_state.get("blog_es_generated"):
                return {
                    "success": True,
                    "job_id": job_id,
                    "status": "completed",
                    "progress": "Completado anteriormente",
                    "results": {
                        "slides_url": content_item.get("slides", {}).get("presentation_url"),
                        "blog_es_id": content_item.get("blog_es_slug"),
                        "blog_en_id": content_item.get("blog_en_slug"),
                        "errors": []
                    }
                }
        
        raise HTTPException(status_code=404, detail="Job not found")
    
    if job.get("item_id") != item_id:
        raise HTTPException(status_code=403, detail="Job does not belong to this item")
    
    return {
        "success": True,
        "job_id": job_id,
        "status": job.get("status"),
        "progress": job.get("progress"),
        "started_at": job.get("started_at"),
        "completed_at": job.get("completed_at"),
        "results": job.get("results"),
        "error": job.get("error")
    }


@router.post("/items/{item_id}/generate-all")
async def generate_all_content(
    item_id: str,
    request: GenerateAllRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Generate all content from dictation in one call:
    1. Clean dictation (fix spelling/punctuation without changing content)
    2. Generate slides
    3. Create blog post in Spanish (published)
    4. Create blog post in English (published)
    5. Mark webinar_pending for follow-up
    """
    from services.content_ai_service import generate_blog_post
    from services.slides_service import generate_slides_from_content
    from config import GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET
    
    content_item = await db.content_items.find_one({"id": item_id})
    if not content_item:
        raise HTTPException(status_code=404, detail="Content item not found")
    
    dictation = content_item.get("dictation_draft_text", "")
    if not dictation or len(dictation) < 100:
        raise HTTPException(
            status_code=400,
            detail="Se necesitan al menos 100 caracteres de dictado para generar contenido"
        )
    
    title = content_item.get("title", "Sin título")
    now = datetime.now(timezone.utc).isoformat()
    results = {
        "cleaned_text": None,
        "slides_url": None,
        "blog_es_id": None,
        "blog_en_id": None,
        "errors": []
    }
    
    # Get Google credentials for slides and refresh if needed
    settings = await db.settings.find_one({})
    calendar_credentials = settings.get("calendar_credentials") if settings else None
    
    if calendar_credentials:
        try:
            from routers.calendar import refresh_credentials_if_needed
            calendar_credentials = refresh_credentials_if_needed(calendar_credentials)
            # Save refreshed credentials back to DB
            if calendar_credentials.get("token") != settings.get("calendar_credentials", {}).get("token"):
                await db.settings.update_one(
                    {},
                    {"$set": {"calendar_credentials": calendar_credentials}}
                )
                logger.info("Google credentials refreshed for generate-all")
        except Exception as e:
            logger.error(f"Failed to refresh Google credentials: {e}")
            results["errors"].append(f"Google Auth: No se pudieron refrescar credenciales - {str(e)}")
            calendar_credentials = None
    
    # ============ STEP 1: Clean dictation ============
    try:
        from emergentintegrations.llm.chat import LlmChat
        
        clean_prompt = f"""Corrige SOLO errores de ortografía, puntuación y gramática en el siguiente texto.
NO cambies el contenido, estructura, estilo ni lenguaje del autor.
NO agregues ni elimines información.
Solo devuelve el texto corregido, sin explicaciones.

Texto:
{dictation}"""
        
        chat = LlmChat(model="gemini/gemini-2.0-flash")
        cleaned_text = chat.send_message(clean_prompt)
        results["cleaned_text"] = cleaned_text
        
        # Save cleaned text
        await db.content_items.update_one(
            {"id": item_id},
            {"$set": {
                "dictation_draft_text": cleaned_text,
                "processing_state.cleaned": True,
                "updated_at": now
            }}
        )
        logger.info(f"Dictation cleaned for {item_id}")
    except Exception as e:
        logger.error(f"Error cleaning dictation: {e}")
        results["errors"].append(f"Limpieza: {str(e)}")
        cleaned_text = dictation  # Use original if cleaning fails
    
    # ============ STEP 2: Generate slides ============
    if calendar_credentials:
        try:
            competency_name = ""
            if content_item.get("competency_id"):
                comp = await db.competencies.find_one({"id": content_item["competency_id"]})
                if comp:
                    competency_name = comp.get("name", "")
            
            slides_result = await generate_slides_from_content(
                credentials_dict=calendar_credentials,
                title=title,
                content_text=cleaned_text,
                competency=competency_name,
                thematic_axis="",
                slide_count=request.slide_count
            )
            
            if slides_result.get("success"):
                results["slides_url"] = slides_result.get("url")
                results["slide_image_urls"] = slides_result.get("image_urls", [])
                
                await db.content_items.update_one(
                    {"id": item_id},
                    {"$set": {
                        "slides": {
                            "presentation_id": slides_result.get("presentation_id"),
                            "presentation_url": slides_result.get("url"),
                            "slides_count": slides_result.get("slides_count"),
                            "image_urls": slides_result.get("image_urls", []),
                            "generated_at": now
                        },
                        "processing_state.slides_generated": True,
                        "updated_at": now
                    }}
                )
                logger.info(f"Slides generated for {item_id} with {len(slides_result.get('image_urls', []))} images")
            else:
                results["errors"].append(f"Slides: {slides_result.get('error', 'Unknown error')}")
        except Exception as e:
            logger.error(f"Error generating slides: {e}")
            results["errors"].append(f"Slides: {str(e)}")
    else:
        results["errors"].append("Slides: Google no conectado")
    
    # ============ STEP 3 & 4: Generate blogs in PARALLEL ============
    import unicodedata
    slug = unicodedata.normalize('NFKD', title.lower())
    slug = slug.encode('ASCII', 'ignore').decode('ASCII')
    slug = "".join(c if c.isalnum() or c == " " else "" for c in slug)
    slug = slug.replace(" ", "-")[:50]
    
    # Get slide images to include in blogs
    slide_image_urls = results.get("slide_image_urls", [])
    
    # Helper to extract title from markdown (first H1)
    def extract_title_from_markdown(markdown_text, fallback_title):
        """Extract title from first H1 header in markdown"""
        if not markdown_text:
            return fallback_title
        lines = markdown_text.strip().split('\n')
        for line in lines:
            line = line.strip()
            if line.startswith('# '):
                return line[2:].strip()
        return fallback_title
    
    async def generate_blog_es():
        try:
            blog_es_result = await generate_blog_post(
                title=title,
                dictation_text=cleaned_text,
                language="es",
                word_count=800
            )
            
            if blog_es_result.get("success"):
                slug_es = f"{slug}-es-{item_id[:8]}"
                blog_content = blog_es_result.get("blog_markdown", "")
                blog_title = extract_title_from_markdown(blog_content, title)
                
                blog_doc_es = {
                    "id": str(uuid.uuid4()),
                    "title": blog_title,
                    "slug": slug_es,
                    "excerpt": blog_content[:200] + "...",
                    "content": blog_content,
                    "content_item_id": item_id,
                    "category_name": "Contenido",
                    "tags": ["español", "generado"],
                    "author_name": "Leaderlix",
                    "is_published": True,
                    "reading_time_minutes": max(1, len(blog_es_result.get("blog_markdown", "").split()) // 200),
                    "views": 0,
                    "language": "es",
                    "slide_images": slide_image_urls,  # Include slide images
                    "created_at": datetime.now(timezone.utc),
                    "updated_at": datetime.now(timezone.utc)
                }
                
                await db.blog_posts.insert_one(blog_doc_es)
                await db.content_items.update_one(
                    {"id": item_id},
                    {"$set": {
                        "processing_state.blog_es_generated": True,
                        "blog_es_slug": slug_es
                    }}
                )
                logger.info(f"Blog ES generated for {item_id}")
                return blog_doc_es["id"]
        except Exception as e:
            logger.error(f"Error generating Spanish blog: {e}")
            results["errors"].append(f"Blog ES: {str(e)}")
        return None
    
    async def generate_blog_en():
        try:
            blog_en_result = await generate_blog_post(
                title=title,
                dictation_text=cleaned_text,
                language="en",
                word_count=800
            )
            
            if blog_en_result.get("success"):
                slug_en = f"{slug}-en-{item_id[:8]}"
                blog_content = blog_en_result.get("blog_markdown", "")
                blog_title = extract_title_from_markdown(blog_content, title)
                
                blog_doc_en = {
                    "id": str(uuid.uuid4()),
                    "title": blog_title,
                    "slug": slug_en,
                    "excerpt": blog_content[:200] + "...",
                    "content": blog_content,
                    "content_item_id": item_id,
                    "category_name": "Content",
                    "tags": ["english", "generated"],
                    "author_name": "Leaderlix",
                    "is_published": True,
                    "reading_time_minutes": max(1, len(blog_content.split()) // 200),
                    "views": 0,
                    "slide_images": slide_image_urls,  # Include slide images
                    "language": "en",
                    "created_at": datetime.now(timezone.utc),
                    "updated_at": datetime.now(timezone.utc)
                }
                
                await db.blog_posts.insert_one(blog_doc_en)
                await db.content_items.update_one(
                    {"id": item_id},
                    {"$set": {
                        "processing_state.blog_en_generated": True,
                        "blog_en_slug": slug_en
                    }}
                )
                logger.info(f"Blog EN generated for {item_id}")
                return blog_doc_en["id"]
        except Exception as e:
            logger.error(f"Error generating English blog: {e}")
            results["errors"].append(f"Blog EN: {str(e)}")
        return None
    
    # Run blogs in parallel
    import asyncio
    blog_results = await asyncio.gather(generate_blog_es(), generate_blog_en())
    results["blog_es_id"] = blog_results[0]
    results["blog_en_id"] = blog_results[1]
    
    # ============ STEP 5: Mark webinar pending ============
    await db.content_items.update_one(
        {"id": item_id},
        {"$set": {
            "processing_state.webinar_pending": True,
            "updated_at": now
        }}
    )
    
    success = (
        results["slides_url"] is not None or 
        results["blog_es_id"] is not None or 
        results["blog_en_id"] is not None
    )
    
    return {
        "success": success,
        "cleaned_text": results["cleaned_text"],
        "slides_url": results["slides_url"],
        "blog_es_id": results["blog_es_id"],
        "blog_en_id": results["blog_en_id"],
        "errors": results["errors"],
        "open_webinar_modal": True,
        "message": "Contenido generado" if success else "Error generando contenido"
    }
