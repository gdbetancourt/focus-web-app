"""
Social Followers Router - Daily checklist for contacting social media followers
Implements tracking, history, and daily task management
"""
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime, timezone, timedelta
import uuid

from database import db
from routers.auth import get_current_user

router = APIRouter(prefix="/social-followers", tags=["social-followers"])


# ============ MODELS ============

class FollowerCreate(BaseModel):
    platform: str  # instagram, twitter, linkedin, tiktok
    username: str
    profile_url: Optional[str] = None
    name: Optional[str] = None
    bio: Optional[str] = None
    followers_count: Optional[int] = None
    engagement_score: Optional[int] = None  # 1-10
    notes: Optional[str] = None
    priority: int = 5  # 1=highest, 10=lowest


class FollowerUpdate(BaseModel):
    name: Optional[str] = None
    bio: Optional[str] = None
    followers_count: Optional[int] = None
    engagement_score: Optional[int] = None
    notes: Optional[str] = None
    priority: Optional[int] = None
    status: Optional[str] = None  # pending, contacted, converted, ignored


class ContactLog(BaseModel):
    message_type: str  # dm, comment, mention, email
    message_preview: Optional[str] = None
    notes: Optional[str] = None


# ============ FOLLOWERS CRUD ============

@router.get("/")
async def list_followers(
    platform: Optional[str] = None,
    status: Optional[str] = None,
    limit: int = 100,
    current_user: dict = Depends(get_current_user)
):
    """List all tracked social followers"""
    query = {}
    if platform:
        query["platform"] = platform
    if status:
        query["status"] = status
    
    followers = await db.social_followers.find(
        query,
        {"_id": 0}
    ).sort([("priority", 1), ("created_at", -1)]).limit(limit).to_list(limit)
    
    # Get stats
    total = await db.social_followers.count_documents({})
    pending = await db.social_followers.count_documents({"status": "pending"})
    contacted = await db.social_followers.count_documents({"status": "contacted"})
    converted = await db.social_followers.count_documents({"status": "converted"})
    
    return {
        "followers": followers,
        "stats": {
            "total": total,
            "pending": pending,
            "contacted": contacted,
            "converted": converted
        }
    }


@router.post("/")
async def add_follower(
    data: FollowerCreate,
    current_user: dict = Depends(get_current_user)
):
    """Add a new follower to track"""
    now = datetime.now(timezone.utc).isoformat()
    
    # Check if already exists
    existing = await db.social_followers.find_one({
        "platform": data.platform,
        "username": data.username.lower().strip()
    })
    
    if existing:
        raise HTTPException(status_code=400, detail="Follower already exists")
    
    follower = {
        "id": str(uuid.uuid4()),
        "platform": data.platform,
        "username": data.username.lower().strip(),
        "profile_url": data.profile_url or f"https://{data.platform}.com/{data.username}",
        "name": data.name,
        "bio": data.bio,
        "followers_count": data.followers_count,
        "engagement_score": data.engagement_score,
        "notes": data.notes,
        "priority": data.priority,
        "status": "pending",
        "contact_count": 0,
        "last_contacted_at": None,
        "created_at": now,
        "created_by": current_user.get("email")
    }
    
    await db.social_followers.insert_one(follower)
    
    return {"success": True, "follower": {k: v for k, v in follower.items() if k != "_id"}}


@router.post("/bulk")
async def add_followers_bulk(
    followers: List[FollowerCreate],
    current_user: dict = Depends(get_current_user)
):
    """Add multiple followers at once"""
    now = datetime.now(timezone.utc).isoformat()
    added = 0
    skipped = 0
    
    for data in followers:
        existing = await db.social_followers.find_one({
            "platform": data.platform,
            "username": data.username.lower().strip()
        })
        
        if existing:
            skipped += 1
            continue
        
        follower = {
            "id": str(uuid.uuid4()),
            "platform": data.platform,
            "username": data.username.lower().strip(),
            "profile_url": data.profile_url or f"https://{data.platform}.com/{data.username}",
            "name": data.name,
            "bio": data.bio,
            "followers_count": data.followers_count,
            "engagement_score": data.engagement_score,
            "notes": data.notes,
            "priority": data.priority,
            "status": "pending",
            "contact_count": 0,
            "last_contacted_at": None,
            "created_at": now,
            "created_by": current_user.get("email")
        }
        
        await db.social_followers.insert_one(follower)
        added += 1
    
    return {"success": True, "added": added, "skipped": skipped}


@router.put("/{follower_id}")
async def update_follower(
    follower_id: str,
    data: FollowerUpdate,
    current_user: dict = Depends(get_current_user)
):
    """Update follower info"""
    update_data = {k: v for k, v in data.dict().items() if v is not None}
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    result = await db.social_followers.update_one(
        {"id": follower_id},
        {"$set": update_data}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Follower not found")
    
    return {"success": True}


@router.delete("/{follower_id}")
async def delete_follower(
    follower_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Remove a follower from tracking"""
    result = await db.social_followers.delete_one({"id": follower_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Follower not found")
    return {"success": True}


# ============ DAILY CHECKLIST ============

@router.get("/daily-checklist")
async def get_daily_checklist(
    limit: int = 20,
    current_user: dict = Depends(get_current_user)
):
    """Get followers to contact today (pending + not contacted in last 7 days)"""
    seven_days_ago = (datetime.now(timezone.utc) - timedelta(days=7)).isoformat()
    
    # Get pending followers first, then those not contacted recently
    followers = await db.social_followers.find(
        {
            "status": {"$in": ["pending", "contacted"]},
            "$or": [
                {"last_contacted_at": None},
                {"last_contacted_at": {"$lt": seven_days_ago}}
            ]
        },
        {"_id": 0}
    ).sort([("priority", 1), ("last_contacted_at", 1)]).limit(limit).to_list(limit)
    
    # Get today's completed contacts
    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0).isoformat()
    
    contacted_today = await db.social_contact_logs.count_documents({
        "contacted_at": {"$gte": today_start}
    })
    
    return {
        "checklist": followers,
        "stats": {
            "to_contact": len(followers),
            "contacted_today": contacted_today
        }
    }


# ============ DAILY OUTREACH CHECKLIST ============

DAILY_OUTREACH_TASKS = [
    {"id": "tiktok_messages", "platform": "tiktok", "task": "TikTok: Enviar mensajes a nuevos seguidores", "icon": "message"},
    {"id": "linkedin_leaderlix", "platform": "linkedin", "task": "LinkedIn Leaderlix: Mensajes a nuevos seguidores", "icon": "linkedin"},
    {"id": "linkedin_gerardo", "platform": "linkedin", "task": "LinkedIn Gerardo Betancourt: Mensajes a nuevos seguidores", "icon": "linkedin"},
    {"id": "linkedin_mariadelmar", "platform": "linkedin", "task": "LinkedIn María del Mar: Mensajes a nuevos seguidores", "icon": "linkedin"},
]


@router.get("/outreach-checklist")
async def get_outreach_checklist(current_user: dict = Depends(get_current_user)):
    """Get daily outreach checklist with completion status for today"""
    # Get today's date (weekday check - only Mon-Fri)
    today = datetime.now(timezone.utc)
    weekday = today.weekday()  # 0=Monday, 6=Sunday
    
    # Return empty if weekend
    if weekday > 4:  # Saturday=5, Sunday=6
        return {
            "is_weekend": True,
            "message": "El checklist se reinicia el lunes",
            "tasks": [],
            "completed_count": 0,
            "total_count": 0
        }
    
    today_str = today.strftime("%Y-%m-%d")
    
    # Get today's completion records
    completions = await db.social_outreach_checklist.find(
        {"date": today_str},
        {"_id": 0}
    ).to_list(100)
    
    completed_task_ids = {c["task_id"] for c in completions}
    
    # Build response with completion status
    tasks_with_status = []
    for task in DAILY_OUTREACH_TASKS:
        tasks_with_status.append({
            **task,
            "completed": task["id"] in completed_task_ids,
            "completed_at": next((c["completed_at"] for c in completions if c["task_id"] == task["id"]), None)
        })
    
    return {
        "is_weekend": False,
        "date": today_str,
        "weekday": ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes"][weekday],
        "tasks": tasks_with_status,
        "completed_count": len(completed_task_ids),
        "total_count": len(DAILY_OUTREACH_TASKS)
    }


@router.post("/outreach-checklist/{task_id}/toggle")
async def toggle_outreach_task(
    task_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Toggle completion status of an outreach task for today"""
    # Validate task exists
    valid_task_ids = {t["id"] for t in DAILY_OUTREACH_TASKS}
    if task_id not in valid_task_ids:
        raise HTTPException(status_code=400, detail="Invalid task ID")
    
    today = datetime.now(timezone.utc)
    weekday = today.weekday()
    
    if weekday > 4:
        raise HTTPException(status_code=400, detail="El checklist solo funciona de lunes a viernes")
    
    today_str = today.strftime("%Y-%m-%d")
    
    # Check if already completed
    existing = await db.social_outreach_checklist.find_one({
        "date": today_str,
        "task_id": task_id
    })
    
    if existing:
        # Remove completion
        await db.social_outreach_checklist.delete_one({
            "date": today_str,
            "task_id": task_id
        })
        return {"success": True, "completed": False, "message": "Tarea desmarcada"}
    else:
        # Add completion
        await db.social_outreach_checklist.insert_one({
            "id": str(uuid.uuid4()),
            "date": today_str,
            "task_id": task_id,
            "completed_by": current_user.get("id"),
            "completed_at": today.isoformat()
        })
        return {"success": True, "completed": True, "message": "Tarea completada"}


@router.post("/{follower_id}/contact")
async def log_contact_interaction(
    follower_id: str,
    data: ContactLog,
    current_user: dict = Depends(get_current_user)
):
    """Log a contact attempt with a follower"""
    now = datetime.now(timezone.utc).isoformat()
    
    # Update follower
    result = await db.social_followers.update_one(
        {"id": follower_id},
        {
            "$set": {
                "last_contacted_at": now,
                "status": "contacted"
            },
            "$inc": {"contact_count": 1}
        }
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Follower not found")
    
    # Log the contact
    log_entry = {
        "id": str(uuid.uuid4()),
        "follower_id": follower_id,
        "message_type": data.message_type,
        "message_preview": data.message_preview,
        "notes": data.notes,
        "contacted_at": now,
        "contacted_by": current_user.get("email")
    }
    
    await db.social_contact_logs.insert_one(log_entry)
    
    return {"success": True, "log": {k: v for k, v in log_entry.items() if k != "_id"}}


@router.post("/{follower_id}/convert")
async def mark_as_converted(
    follower_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Mark a follower as converted (became a contact/lead)"""
    now = datetime.now(timezone.utc).isoformat()
    
    result = await db.social_followers.update_one(
        {"id": follower_id},
        {
            "$set": {
                "status": "converted",
                "converted_at": now
            }
        }
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Follower not found")
    
    return {"success": True}


# ============ HISTORY ============

@router.get("/history")
async def get_contact_history(
    days: int = 30,
    current_user: dict = Depends(get_current_user)
):
    """Get contact history for the last N days"""
    cutoff = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()
    
    logs = await db.social_contact_logs.find(
        {"contacted_at": {"$gte": cutoff}},
        {"_id": 0}
    ).sort("contacted_at", -1).to_list(500)
    
    # Group by date
    by_date = {}
    for log in logs:
        date = log["contacted_at"][:10]
        if date not in by_date:
            by_date[date] = []
        by_date[date].append(log)
    
    # Get daily counts
    daily_counts = [{"date": date, "count": len(logs)} for date, logs in sorted(by_date.items(), reverse=True)]
    
    return {
        "logs": logs,
        "daily_counts": daily_counts,
        "total_contacts": len(logs)
    }


@router.get("/history/{follower_id}")
async def get_follower_history(
    follower_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get contact history for a specific follower"""
    follower = await db.social_followers.find_one({"id": follower_id}, {"_id": 0})
    if not follower:
        raise HTTPException(status_code=404, detail="Follower not found")
    
    logs = await db.social_contact_logs.find(
        {"follower_id": follower_id},
        {"_id": 0}
    ).sort("contacted_at", -1).to_list(100)
    
    return {
        "follower": follower,
        "contact_history": logs
    }


# ============ STATS ============

@router.get("/stats")
async def get_stats(current_user: dict = Depends(get_current_user)):
    """Get overall stats"""
    total = await db.social_followers.count_documents({})
    pending = await db.social_followers.count_documents({"status": "pending"})
    contacted = await db.social_followers.count_documents({"status": "contacted"})
    converted = await db.social_followers.count_documents({"status": "converted"})
    
    # Platform breakdown
    platforms = await db.social_followers.aggregate([
        {"$group": {"_id": "$platform", "count": {"$sum": 1}}}
    ]).to_list(10)
    
    # This week's contacts
    week_start = (datetime.now(timezone.utc) - timedelta(days=7)).isoformat()
    contacts_this_week = await db.social_contact_logs.count_documents({
        "contacted_at": {"$gte": week_start}
    })
    
    # Today's contacts
    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0).isoformat()
    contacts_today = await db.social_contact_logs.count_documents({
        "contacted_at": {"$gte": today_start}
    })
    
    return {
        "total": total,
        "by_status": {
            "pending": pending,
            "contacted": contacted,
            "converted": converted
        },
        "by_platform": {p["_id"]: p["count"] for p in platforms},
        "contacts_this_week": contacts_this_week,
        "contacts_today": contacts_today,
        "conversion_rate": round(converted / total * 100, 1) if total > 0 else 0
    }
