"""
Venue Finder Router - Manage event venues for close stage
"""
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime, timezone
import uuid

from database import db
from routers.auth import get_current_user

router = APIRouter(prefix="/venues", tags=["venues"])


# ============ MODELS ============

class VenueCreate(BaseModel):
    name: str
    type: str = "hotel"  # hotel, conference_center, restaurant, coworking, auditorium, university, hospital, other
    address: Optional[str] = None
    city: Optional[str] = None
    capacity: Optional[str] = None
    price_range: Optional[str] = None
    contact_name: Optional[str] = None
    contact_phone: Optional[str] = None
    contact_email: Optional[str] = None
    website: Optional[str] = None
    status: str = "researching"  # researching, contacted, quoted, approved, rejected
    rating: Optional[str] = None
    notes: Optional[str] = None


class VenueUpdate(BaseModel):
    name: Optional[str] = None
    type: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    capacity: Optional[str] = None
    price_range: Optional[str] = None
    contact_name: Optional[str] = None
    contact_phone: Optional[str] = None
    contact_email: Optional[str] = None
    website: Optional[str] = None
    status: Optional[str] = None
    rating: Optional[str] = None
    notes: Optional[str] = None


# ============ ROUTES ============

@router.get("/")
async def list_venues(
    type_filter: Optional[str] = None,
    status_filter: Optional[str] = None,
    city: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """List all venues with optional filters"""
    query = {}
    
    if type_filter:
        query["type"] = type_filter
    if status_filter:
        query["status"] = status_filter
    if city:
        query["city"] = {"$regex": city, "$options": "i"}
    
    venues = await db.venues.find(query, {"_id": 0}).sort("updated_at", -1).to_list(500)
    
    return {"venues": venues, "count": len(venues)}


@router.post("/")
async def create_venue(
    data: VenueCreate,
    current_user: dict = Depends(get_current_user)
):
    """Create a new venue"""
    now = datetime.now(timezone.utc).isoformat()
    
    venue = {
        "id": str(uuid.uuid4()),
        "name": data.name,
        "type": data.type,
        "address": data.address,
        "city": data.city,
        "capacity": data.capacity,
        "price_range": data.price_range,
        "contact_name": data.contact_name,
        "contact_phone": data.contact_phone,
        "contact_email": data.contact_email,
        "website": data.website,
        "status": data.status,
        "rating": data.rating,
        "notes": data.notes,
        "created_at": now,
        "updated_at": now,
        "created_by": current_user.get("email")
    }
    
    await db.venues.insert_one(venue)
    
    return {"success": True, "venue": {k: v for k, v in venue.items() if k != "_id"}}


@router.get("/{venue_id}")
async def get_venue(
    venue_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get venue details"""
    venue = await db.venues.find_one({"id": venue_id}, {"_id": 0})
    if not venue:
        raise HTTPException(status_code=404, detail="Venue not found")
    return venue


@router.put("/{venue_id}")
async def update_venue(
    venue_id: str,
    data: VenueUpdate,
    current_user: dict = Depends(get_current_user)
):
    """Update venue details"""
    update_data = {k: v for k, v in data.dict().items() if v is not None}
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    result = await db.venues.update_one(
        {"id": venue_id},
        {"$set": update_data}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Venue not found")
    
    return {"success": True}


@router.delete("/{venue_id}")
async def delete_venue(
    venue_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Delete a venue"""
    result = await db.venues.delete_one({"id": venue_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Venue not found")
    return {"success": True}


@router.get("/stats/overview")
async def get_venue_stats(current_user: dict = Depends(get_current_user)):
    """Get venue statistics"""
    total = await db.venues.count_documents({})
    by_status = {}
    for status in ["researching", "contacted", "quoted", "approved", "rejected"]:
        by_status[status] = await db.venues.count_documents({"status": status})
    
    by_type = {}
    for venue_type in ["hotel", "conference_center", "restaurant", "coworking", "auditorium", "university", "hospital", "other"]:
        count = await db.venues.count_documents({"type": venue_type})
        if count > 0:
            by_type[venue_type] = count
    
    return {
        "total": total,
        "by_status": by_status,
        "by_type": by_type
    }
