"""
Industries Router - Manage industry list for events and sponsors
"""
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timezone
import uuid

from database import db
from routers.auth import get_current_user

router = APIRouter(prefix="/industries", tags=["industries"])


# ============ MODELS ============

class IndustryCreate(BaseModel):
    name: str
    code: str
    description: Optional[str] = ""
    color: Optional[str] = "#6366f1"


class IndustryUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    color: Optional[str] = None
    classification: Optional[str] = None


# ============ DEFAULT INDUSTRIES ============

DEFAULT_INDUSTRIES = [
    {"code": "pharma", "name": "Pharmaceutical", "description": "Pharmaceutical companies and drug manufacturers", "color": "#8b5cf6"},
    {"code": "medical_devices", "name": "Medical Devices", "description": "Medical device and equipment manufacturers", "color": "#06b6d4"},
    {"code": "biotech", "name": "Biotechnology", "description": "Biotechnology and life sciences companies", "color": "#10b981"},
    {"code": "healthcare", "name": "Healthcare Services", "description": "Hospitals, clinics, and healthcare providers", "color": "#f59e0b"},
    {"code": "health_insurance", "name": "Health Insurance", "description": "Health insurance and managed care organizations", "color": "#ef4444"},
    {"code": "diagnostics", "name": "Diagnostics & Labs", "description": "Diagnostic laboratories and testing services", "color": "#ec4899"},
    {"code": "digital_health", "name": "Digital Health", "description": "Digital health, telemedicine, and health tech", "color": "#3b82f6"},
    {"code": "cro_cmo", "name": "CRO/CMO", "description": "Contract research and manufacturing organizations", "color": "#14b8a6"},
    {"code": "nutrition", "name": "Nutrition & Supplements", "description": "Nutritional products and dietary supplements", "color": "#84cc16"},
    {"code": "consumer_health", "name": "Consumer Health", "description": "OTC products and consumer healthcare", "color": "#f97316"},
]


# ============ ENDPOINTS ============

@router.get("/")
async def get_industries(
    current_user: dict = Depends(get_current_user)
):
    """Get all industries"""
    industries = await db.industries.find({}, {"_id": 0}).sort("name", 1).to_list(None)
    return {"success": True, "industries": industries, "total": len(industries)}


@router.get("/public")
async def get_industries_public():
    """Get all industries (public endpoint for forms)"""
    industries = await db.industries.find({}, {"_id": 0}).sort("name", 1).to_list(None)
    return {"success": True, "industries": industries}


@router.post("/")
async def create_industry(
    data: IndustryCreate,
    current_user: dict = Depends(get_current_user)
):
    """Create a new industry"""
    # Check if code already exists
    existing = await db.industries.find_one({"code": data.code})
    if existing:
        raise HTTPException(status_code=400, detail=f"Industry with code '{data.code}' already exists")
    
    industry = {
        "id": str(uuid.uuid4()),
        "code": data.code.lower().replace(" ", "_"),
        "name": data.name,
        "description": data.description or "",
        "color": data.color or "#6366f1",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.industries.insert_one(industry)
    industry.pop("_id", None)
    
    return {"success": True, "industry": industry}


@router.put("/{industry_id}")
async def update_industry(
    industry_id: str,
    data: IndustryUpdate,
    current_user: dict = Depends(get_current_user)
):
    """Update an industry. If classification changes, also updates all associated companies."""
    update_data = {k: v for k, v in data.dict().items() if v is not None}
    if not update_data:
        raise HTTPException(status_code=400, detail="No data to update")
    
    # Get current industry to check for classification change
    current_industry = await db.industries.find_one({"id": industry_id})
    if not current_industry:
        raise HTTPException(status_code=404, detail="Industry not found")
    
    # Validate classification if provided
    classification_changed = False
    new_classification = None
    if "classification" in update_data:
        if update_data["classification"] not in ["inbound", "outbound"]:
            raise HTTPException(status_code=400, detail="Classification must be 'inbound' or 'outbound'")
        if current_industry.get("classification") != update_data["classification"]:
            classification_changed = True
            new_classification = update_data["classification"]
    
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    # Update the industry
    result = await db.industries.update_one(
        {"id": industry_id},
        {"$set": update_data}
    )
    
    # Also update in active_sectors if exists
    await db.active_sectors.update_one(
        {"id": industry_id},
        {"$set": update_data}
    )
    
    # If classification changed, update all companies with this industry
    companies_updated = 0
    contacts_updated = 0
    if classification_changed:
        industry_code = current_industry.get("code")
        if industry_code:
            # Get company IDs before updating
            company_ids = []
            async for comp in db.unified_companies.find(
                {"industry_code": industry_code, "is_merged": {"$ne": True}},
                {"id": 1}
            ):
                company_ids.append(comp["id"])
            
            # Update unified_companies
            result_companies = await db.unified_companies.update_many(
                {"industry_code": industry_code, "is_merged": {"$ne": True}},
                {"$set": {
                    "classification": new_classification,
                    "updated_at": update_data["updated_at"]
                }}
            )
            companies_updated = result_companies.modified_count
            
            # Note: active_companies is deprecated, unified_companies is the single source
            # Classification is already updated above in unified_companies
            
            # Propagate to contacts of these companies
            if company_ids:
                # Get company names for matching contacts that only have company_name
                company_names = []
                async for comp in db.unified_companies.find(
                    {"id": {"$in": company_ids}},
                    {"name": 1, "aliases": 1}
                ):
                    if comp.get("name"):
                        company_names.append(comp["name"])
                        for alias in comp.get("aliases", []):
                            if alias:
                                company_names.append(alias)
                
                result_contacts = await db.unified_contacts.update_many(
                    {"$or": [
                        {"company_id": {"$in": company_ids}},
                        {"companies.company_id": {"$in": company_ids}},
                        {"companies.company_name": {"$in": company_names}}
                    ]},
                    {"$set": {
                        "classification": new_classification,
                        "updated_at": update_data["updated_at"]
                    }}
                )
                contacts_updated = result_contacts.modified_count
    
    response = {"success": True, "message": "Industry updated"}
    if classification_changed:
        response["classification_changed"] = True
        response["new_classification"] = new_classification
        response["companies_updated"] = companies_updated
        response["contacts_updated"] = contacts_updated
    
    return response


@router.delete("/{industry_id}")
async def delete_industry(
    industry_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Delete an industry"""
    result = await db.industries.delete_one({"id": industry_id})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Industry not found")
    
    return {"success": True, "message": "Industry deleted"}


@router.post("/load-defaults")
async def load_default_industries(
    current_user: dict = Depends(get_current_user)
):
    """Load default industries (only adds missing ones)"""
    added = 0
    skipped = 0
    
    for ind in DEFAULT_INDUSTRIES:
        existing = await db.industries.find_one({"code": ind["code"]})
        if existing:
            skipped += 1
            continue
        
        industry = {
            "id": str(uuid.uuid4()),
            **ind,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.industries.insert_one(industry)
        added += 1
    
    return {"success": True, "added": added, "skipped": skipped}
