"""
Media Opportunities Router - Track collaboration opportunities with media contacts
"""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timezone
from database import db
from routers.auth import get_current_user
import uuid

router = APIRouter(prefix="/media-opportunities", tags=["media-opportunities"])

# Opportunity states
OPPORTUNITY_STATES = [
    {"value": "open", "label": "Oportunidad Abierta"},
    {"value": "interested", "label": "Interés en Colaboración"},
    {"value": "closed", "label": "Colaboración Concretada"}
]


class MediaOpportunityCreate(BaseModel):
    contact_id: str
    contact_name: str
    title: str
    notes: Optional[str] = None
    state: str = "open"


class MediaOpportunityUpdate(BaseModel):
    title: Optional[str] = None
    notes: Optional[str] = None
    state: Optional[str] = None


@router.get("")
async def get_media_opportunities(
    state: Optional[str] = None,
    contact_id: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Get all media opportunities"""
    query = {}
    if state:
        query["state"] = state
    if contact_id:
        query["contact_id"] = contact_id
    
    opportunities = await db.media_opportunities.find(query, {"_id": 0}).sort("created_at", -1).to_list(500)
    
    # Get stats
    stats = {
        "total": len(opportunities),
        "open": sum(1 for o in opportunities if o.get("state") == "open"),
        "interested": sum(1 for o in opportunities if o.get("state") == "interested"),
        "closed": sum(1 for o in opportunities if o.get("state") == "closed")
    }
    
    return {
        "success": True,
        "opportunities": opportunities,
        "stats": stats,
        "states": OPPORTUNITY_STATES
    }


@router.post("")
async def create_media_opportunity(
    data: MediaOpportunityCreate,
    current_user: dict = Depends(get_current_user)
):
    """Create a new media opportunity"""
    now = datetime.now(timezone.utc).isoformat()
    
    opportunity = {
        "id": str(uuid.uuid4()),
        "contact_id": data.contact_id,
        "contact_name": data.contact_name,
        "title": data.title,
        "notes": data.notes,
        "state": data.state,
        "created_at": now,
        "updated_at": now,
        "created_by": current_user.get("email", "unknown")
    }
    
    await db.media_opportunities.insert_one(opportunity)
    
    return {"success": True, "opportunity": {k: v for k, v in opportunity.items() if k != "_id"}}


@router.put("/{opportunity_id}")
async def update_media_opportunity(
    opportunity_id: str,
    data: MediaOpportunityUpdate,
    current_user: dict = Depends(get_current_user)
):
    """Update a media opportunity"""
    update_data = {"updated_at": datetime.now(timezone.utc).isoformat()}
    
    if data.title is not None:
        update_data["title"] = data.title
    if data.notes is not None:
        update_data["notes"] = data.notes
    if data.state is not None:
        if data.state not in [s["value"] for s in OPPORTUNITY_STATES]:
            raise HTTPException(status_code=400, detail="Invalid state")
        update_data["state"] = data.state
    
    result = await db.media_opportunities.update_one(
        {"id": opportunity_id},
        {"$set": update_data}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Opportunity not found")
    
    return {"success": True, "message": "Opportunity updated"}


@router.delete("/{opportunity_id}")
async def delete_media_opportunity(
    opportunity_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Delete a media opportunity"""
    result = await db.media_opportunities.delete_one({"id": opportunity_id})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Opportunity not found")
    
    return {"success": True, "message": "Opportunity deleted"}


@router.get("/states")
async def get_opportunity_states():
    """Get available opportunity states"""
    return {"success": True, "states": OPPORTUNITY_STATES}
