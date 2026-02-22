"""
Editorial Relations Router - Manage relationships with publishers, editors, and media contacts
"""
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime, timezone, timedelta
import uuid

from database import db
from routers.auth import get_current_user

router = APIRouter(prefix="/editorial", tags=["editorial"])


# ============ MODELS ============

class PublisherCreate(BaseModel):
    name: str
    type: str = "magazine"  # magazine, blog, newspaper, podcast, publisher
    website: Optional[str] = None
    industry: Optional[str] = None
    audience_size: Optional[str] = None  # small, medium, large
    notes: Optional[str] = None


class ContactCreate(BaseModel):
    publisher_id: Optional[str] = None
    name: str
    role: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    linkedin_url: Optional[str] = None
    notes: Optional[str] = None


class OpportunityCreate(BaseModel):
    publisher_id: Optional[str] = None
    contact_id: Optional[str] = None
    type: str = "guest_article"  # guest_article, interview, podcast, book_review, collaboration
    title: str
    description: Optional[str] = None
    deadline: Optional[str] = None
    status: str = "idea"  # idea, pitched, negotiating, accepted, published, rejected
    url: Optional[str] = None
    notes: Optional[str] = None


class StatusUpdate(BaseModel):
    status: str
    notes: Optional[str] = None


# ============ PUBLISHERS ============

@router.get("/publishers")
async def list_publishers(
    type: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """List all publishers"""
    query = {}
    if type:
        query["type"] = type
    
    publishers = await db.editorial_publishers.find(
        query, {"_id": 0}
    ).sort("name", 1).to_list(200)
    
    return {"publishers": publishers}


@router.post("/publishers")
async def create_publisher(
    data: PublisherCreate,
    current_user: dict = Depends(get_current_user)
):
    """Add a new publisher"""
    now = datetime.now(timezone.utc).isoformat()
    
    publisher = {
        "id": str(uuid.uuid4()),
        **data.dict(),
        "contact_count": 0,
        "opportunity_count": 0,
        "created_at": now,
        "created_by": current_user.get("email")
    }
    
    await db.editorial_publishers.insert_one(publisher)
    return {"success": True, "publisher": {k: v for k, v in publisher.items() if k != "_id"}}


@router.put("/publishers/{publisher_id}")
async def update_publisher(
    publisher_id: str,
    data: PublisherCreate,
    current_user: dict = Depends(get_current_user)
):
    """Update publisher info"""
    result = await db.editorial_publishers.update_one(
        {"id": publisher_id},
        {"$set": {**data.dict(), "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Publisher not found")
    return {"success": True}


@router.delete("/publishers/{publisher_id}")
async def delete_publisher(
    publisher_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Delete a publisher"""
    result = await db.editorial_publishers.delete_one({"id": publisher_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Publisher not found")
    return {"success": True}


# ============ CONTACTS ============

@router.get("/contacts")
async def list_contacts(
    publisher_id: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """List editorial contacts"""
    query = {}
    if publisher_id:
        query["publisher_id"] = publisher_id
    
    contacts = await db.editorial_contacts.find(
        query, {"_id": 0}
    ).sort("name", 1).to_list(500)
    
    return {"contacts": contacts}


@router.post("/contacts")
async def create_contact(
    data: ContactCreate,
    current_user: dict = Depends(get_current_user)
):
    """Add a new editorial contact"""
    now = datetime.now(timezone.utc).isoformat()
    
    contact = {
        "id": str(uuid.uuid4()),
        **data.dict(),
        "last_contacted_at": None,
        "created_at": now,
        "created_by": current_user.get("email")
    }
    
    await db.editorial_contacts.insert_one(contact)
    
    # Update publisher contact count
    if data.publisher_id:
        await db.editorial_publishers.update_one(
            {"id": data.publisher_id},
            {"$inc": {"contact_count": 1}}
        )
    
    return {"success": True, "contact": {k: v for k, v in contact.items() if k != "_id"}}


@router.delete("/contacts/{contact_id}")
async def delete_contact(
    contact_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Delete a contact"""
    contact = await db.editorial_contacts.find_one({"id": contact_id})
    if not contact:
        raise HTTPException(status_code=404, detail="Contact not found")
    
    await db.editorial_contacts.delete_one({"id": contact_id})
    
    if contact.get("publisher_id"):
        await db.editorial_publishers.update_one(
            {"id": contact["publisher_id"]},
            {"$inc": {"contact_count": -1}}
        )
    
    return {"success": True}


# ============ OPPORTUNITIES ============

@router.get("/opportunities")
async def list_opportunities(
    status: Optional[str] = None,
    type: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """List all opportunities"""
    query = {}
    if status:
        query["status"] = status
    if type:
        query["type"] = type
    
    opportunities = await db.editorial_opportunities.find(
        query, {"_id": 0}
    ).sort("created_at", -1).to_list(200)
    
    return {"opportunities": opportunities}


@router.post("/opportunities")
async def create_opportunity(
    data: OpportunityCreate,
    current_user: dict = Depends(get_current_user)
):
    """Create a new opportunity"""
    now = datetime.now(timezone.utc).isoformat()
    
    opportunity = {
        "id": str(uuid.uuid4()),
        **data.dict(),
        "created_at": now,
        "updated_at": now,
        "created_by": current_user.get("email")
    }
    
    await db.editorial_opportunities.insert_one(opportunity)
    
    if data.publisher_id:
        await db.editorial_publishers.update_one(
            {"id": data.publisher_id},
            {"$inc": {"opportunity_count": 1}}
        )
    
    return {"success": True, "opportunity": {k: v for k, v in opportunity.items() if k != "_id"}}


@router.put("/opportunities/{opportunity_id}/status")
async def update_opportunity_status(
    opportunity_id: str,
    data: StatusUpdate,
    current_user: dict = Depends(get_current_user)
):
    """Update opportunity status"""
    now = datetime.now(timezone.utc).isoformat()
    
    update = {
        "status": data.status,
        "updated_at": now
    }
    if data.notes:
        update["notes"] = data.notes
    
    result = await db.editorial_opportunities.update_one(
        {"id": opportunity_id},
        {"$set": update}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Opportunity not found")
    
    return {"success": True}


@router.delete("/opportunities/{opportunity_id}")
async def delete_opportunity(
    opportunity_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Delete an opportunity"""
    opp = await db.editorial_opportunities.find_one({"id": opportunity_id})
    if not opp:
        raise HTTPException(status_code=404, detail="Opportunity not found")
    
    await db.editorial_opportunities.delete_one({"id": opportunity_id})
    
    if opp.get("publisher_id"):
        await db.editorial_publishers.update_one(
            {"id": opp["publisher_id"]},
            {"$inc": {"opportunity_count": -1}}
        )
    
    return {"success": True}


# ============ STATS ============

@router.get("/stats")
async def get_stats(current_user: dict = Depends(get_current_user)):
    """Get editorial stats"""
    publishers = await db.editorial_publishers.count_documents({})
    contacts = await db.editorial_contacts.count_documents({})
    
    # Opportunities by status
    pipeline = [
        {"$group": {"_id": "$status", "count": {"$sum": 1}}}
    ]
    status_counts = await db.editorial_opportunities.aggregate(pipeline).to_list(10)
    by_status = {s["_id"]: s["count"] for s in status_counts}
    
    # Opportunities by type
    pipeline = [
        {"$group": {"_id": "$type", "count": {"$sum": 1}}}
    ]
    type_counts = await db.editorial_opportunities.aggregate(pipeline).to_list(10)
    by_type = {t["_id"]: t["count"] for t in type_counts}
    
    total_opportunities = sum(by_status.values())
    published = by_status.get("published", 0)
    
    return {
        "publishers": publishers,
        "contacts": contacts,
        "total_opportunities": total_opportunities,
        "by_status": by_status,
        "by_type": by_type,
        "success_rate": round(published / total_opportunities * 100, 1) if total_opportunities > 0 else 0
    }
