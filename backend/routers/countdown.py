"""
Hero Countdown Router - Event/Launch Countdown Management
"""

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timezone
import uuid

from database import db
from routers.auth import get_current_user

router = APIRouter(prefix="/countdown", tags=["countdown"])


# ============ Models ============

class CountdownCreate(BaseModel):
    title: str
    description: Optional[str] = ""
    target_date: Optional[str] = None  # ISO format (optional for weekly_reset)
    type: str = "event"  # event, launch, promotion, custom
    style: str = "default"  # default, minimal, hero, dark
    cta_text: Optional[str] = "Regístrate Ahora"
    cta_url: Optional[str] = None
    background_image: Optional[str] = None
    is_public: bool = True
    show_on_homepage: bool = False
    weekly_reset: bool = False  # Reset every Monday at midnight
    settings: dict = {}

class CountdownUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    target_date: Optional[str] = None
    type: Optional[str] = None
    style: Optional[str] = None
    cta_text: Optional[str] = None
    cta_url: Optional[str] = None
    background_image: Optional[str] = None
    is_public: Optional[bool] = None
    is_active: Optional[bool] = None
    show_on_homepage: Optional[bool] = None
    weekly_reset: Optional[bool] = None
    settings: Optional[dict] = None


# ============ CRUD Endpoints ============

@router.get("/countdowns")
async def list_countdowns(
    active_only: bool = False,
    current_user: dict = Depends(get_current_user)
):
    """List all countdowns"""
    query = {}
    if active_only:
        query["is_active"] = True
        query["target_date"] = {"$gt": datetime.now(timezone.utc).isoformat()}
    
    countdowns = await db.countdowns.find(query, {"_id": 0}).sort("target_date", 1).to_list(50)
    
    # Helper to get next Monday at midnight
    def get_next_monday():
        now = datetime.now(timezone.utc)
        days_until_monday = (7 - now.weekday()) % 7
        if days_until_monday == 0:
            days_until_monday = 7  # If today is Monday, get next Monday
        next_monday = now.replace(hour=0, minute=0, second=0, microsecond=0)
        next_monday = next_monday.replace(day=now.day + days_until_monday)
        return next_monday
    
    # Add time remaining
    now = datetime.now(timezone.utc)
    for c in countdowns:
        try:
            if c.get("weekly_reset"):
                # For weekly reset, calculate to next Monday
                target = get_next_monday()
            else:
                target = datetime.fromisoformat(c["target_date"].replace("Z", "+00:00"))
            
            delta = target - now
            c["time_remaining"] = {
                "days": max(0, delta.days),
                "hours": max(0, delta.seconds // 3600),
                "minutes": max(0, (delta.seconds % 3600) // 60),
                "seconds": max(0, delta.seconds % 60),
                "expired": delta.total_seconds() < 0 and not c.get("weekly_reset")
            }
        except:
            c["time_remaining"] = {"expired": True}
    
    return {"success": True, "countdowns": countdowns}


@router.post("/countdowns")
async def create_countdown(
    countdown: CountdownCreate,
    current_user: dict = Depends(get_current_user)
):
    """Create a new countdown"""
    countdown_dict = countdown.dict()
    countdown_dict["id"] = str(uuid.uuid4())
    countdown_dict["slug"] = countdown_dict["id"][:8]
    countdown_dict["is_active"] = True
    countdown_dict["created_at"] = datetime.now(timezone.utc).isoformat()
    countdown_dict["created_by"] = current_user.get("email", "")
    
    await db.countdowns.insert_one(countdown_dict)
    
    return {"success": True, "countdown": {k: v for k, v in countdown_dict.items() if k != "_id"}}


@router.get("/countdowns/{countdown_id}")
async def get_countdown(
    countdown_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get countdown by ID"""
    countdown = await db.countdowns.find_one(
        {"$or": [{"id": countdown_id}, {"slug": countdown_id}]},
        {"_id": 0}
    )
    
    if not countdown:
        raise HTTPException(status_code=404, detail="Countdown not found")
    
    return {"success": True, "countdown": countdown}


@router.put("/countdowns/{countdown_id}")
async def update_countdown(
    countdown_id: str,
    updates: CountdownUpdate,
    current_user: dict = Depends(get_current_user)
):
    """Update a countdown"""
    update_dict = {k: v for k, v in updates.dict().items() if v is not None}
    update_dict["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    result = await db.countdowns.update_one(
        {"id": countdown_id},
        {"$set": update_dict}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Countdown not found")
    
    updated = await db.countdowns.find_one({"id": countdown_id}, {"_id": 0})
    return {"success": True, "countdown": updated}


@router.delete("/countdowns/{countdown_id}")
async def delete_countdown(
    countdown_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Delete a countdown"""
    result = await db.countdowns.delete_one({"id": countdown_id})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Countdown not found")
    
    return {"success": True, "message": "Countdown deleted"}


# ============ Public Endpoints ============

@router.get("/public/active")
async def get_active_public_countdowns():
    """Get active public countdowns (no auth required)"""
    now = datetime.now(timezone.utc)
    
    countdowns = await db.countdowns.find(
        {
            "is_active": True,
            "is_public": True,
            "target_date": {"$gt": now.isoformat()}
        },
        {"_id": 0, "created_by": 0}
    ).sort("target_date", 1).to_list(10)
    
    # Add time remaining
    for c in countdowns:
        try:
            target = datetime.fromisoformat(c["target_date"].replace("Z", "+00:00"))
            delta = target - now
            c["time_remaining"] = {
                "days": max(0, delta.days),
                "hours": max(0, delta.seconds // 3600),
                "minutes": max(0, (delta.seconds % 3600) // 60),
                "seconds": max(0, delta.seconds % 60),
                "total_seconds": max(0, int(delta.total_seconds()))
            }
        except:
            pass
    
    return {"success": True, "countdowns": countdowns}


@router.get("/public/homepage")
async def get_homepage_countdown():
    """Get the countdown shown on homepage"""
    now = datetime.now(timezone.utc)
    
    countdown = await db.countdowns.find_one(
        {
            "is_active": True,
            "is_public": True,
            "show_on_homepage": True,
            "target_date": {"$gt": now.isoformat()}
        },
        {"_id": 0, "created_by": 0}
    )
    
    if countdown:
        try:
            target = datetime.fromisoformat(countdown["target_date"].replace("Z", "+00:00"))
            delta = target - now
            countdown["time_remaining"] = {
                "days": max(0, delta.days),
                "hours": max(0, delta.seconds // 3600),
                "minutes": max(0, (delta.seconds % 3600) // 60),
                "seconds": max(0, delta.seconds % 60),
                "total_seconds": max(0, int(delta.total_seconds()))
            }
        except:
            pass
    
    return {"success": True, "countdown": countdown}


@router.get("/public/{slug}")
async def get_public_countdown(slug: str):
    """Get a specific public countdown"""
    countdown = await db.countdowns.find_one(
        {"slug": slug, "is_public": True},
        {"_id": 0, "created_by": 0}
    )
    
    if not countdown:
        raise HTTPException(status_code=404, detail="Countdown not found")
    
    now = datetime.now(timezone.utc)
    try:
        target = datetime.fromisoformat(countdown["target_date"].replace("Z", "+00:00"))
        delta = target - now
        countdown["time_remaining"] = {
            "days": max(0, delta.days),
            "hours": max(0, delta.seconds // 3600),
            "minutes": max(0, (delta.seconds % 3600) // 60),
            "seconds": max(0, delta.seconds % 60),
            "total_seconds": max(0, int(delta.total_seconds())),
            "expired": delta.total_seconds() < 0
        }
    except:
        countdown["time_remaining"] = {"expired": True}
    
    return {"success": True, "countdown": countdown}
