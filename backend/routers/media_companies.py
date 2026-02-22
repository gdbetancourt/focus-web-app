"""
Media Companies Router - Simple CRUD for media outlets
"""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timezone
from database import db
from routers.auth import get_current_user
import uuid

router = APIRouter(prefix="/media-companies", tags=["media-companies"])


class MediaCompanyCreate(BaseModel):
    name: str
    website: Optional[str] = None


class MediaCompanyUpdate(BaseModel):
    name: Optional[str] = None
    website: Optional[str] = None


@router.get("")
async def get_media_companies(
    search: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Get all media companies"""
    query = {}
    if search:
        query["$or"] = [
            {"name": {"$regex": search, "$options": "i"}},
            {"website": {"$regex": search, "$options": "i"}}
        ]
    
    companies = await db.media_companies.find(query, {"_id": 0}).sort("name", 1).to_list(500)
    
    return {
        "success": True,
        "companies": companies,
        "total": len(companies)
    }


@router.post("")
async def create_media_company(
    data: MediaCompanyCreate,
    current_user: dict = Depends(get_current_user)
):
    """Create a new media company"""
    now = datetime.now(timezone.utc).isoformat()
    
    company = {
        "id": str(uuid.uuid4()),
        "name": data.name,
        "website": data.website,
        "created_at": now,
        "updated_at": now
    }
    
    await db.media_companies.insert_one(company)
    
    return {"success": True, "company": {k: v for k, v in company.items() if k != "_id"}}


@router.put("/{company_id}")
async def update_media_company(
    company_id: str,
    data: MediaCompanyUpdate,
    current_user: dict = Depends(get_current_user)
):
    """Update a media company"""
    update_data = {"updated_at": datetime.now(timezone.utc).isoformat()}
    
    if data.name is not None:
        update_data["name"] = data.name
    if data.website is not None:
        update_data["website"] = data.website
    
    result = await db.media_companies.update_one(
        {"id": company_id},
        {"$set": update_data}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Company not found")
    
    return {"success": True, "message": "Company updated"}


@router.delete("/{company_id}")
async def delete_media_company(
    company_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Delete a media company"""
    result = await db.media_companies.delete_one({"id": company_id})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Company not found")
    
    return {"success": True, "message": "Company deleted"}
