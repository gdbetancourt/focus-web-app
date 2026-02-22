"""
Industries V2 Router - Normalized industry management with classification support

This router provides:
- CRUD operations for normalized industries (using stable IDs)
- Classification support (inbound/outbound)
- Industry merging capability
- Propagation of classification to companies
"""
from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timezone
import uuid
import re

from .auth import get_current_user
from .legacy import db

router = APIRouter(prefix="/industries-v2", tags=["Industries V2"])


# =============================================================================
# MODELS
# =============================================================================

class IndustryCreate(BaseModel):
    """Request to create a new industry"""
    name: str
    code: Optional[str] = None
    description: Optional[str] = ""
    color: Optional[str] = "#6366f1"
    classification: str = "inbound"


class IndustryUpdate(BaseModel):
    """Request to update an industry"""
    name: Optional[str] = None
    code: Optional[str] = None
    description: Optional[str] = None
    color: Optional[str] = None
    classification: Optional[str] = None


class ClassificationUpdate(BaseModel):
    """Request to update classification"""
    classification: str  # "inbound" or "outbound"


class MergeIndustriesRequest(BaseModel):
    """Request to merge multiple industries into one"""
    primary_industry_id: str
    industries_to_merge: List[str]


# =============================================================================
# HELPER FUNCTIONS
# =============================================================================

def normalize_code(name: str) -> str:
    """Generate a code from industry name"""
    return re.sub(r'[^a-z0-9]+', '_', name.lower().strip()).strip('_')


# =============================================================================
# CRUD ENDPOINTS
# =============================================================================

@router.get("")
async def list_industries(
    classification: Optional[str] = None,
    search: Optional[str] = None,
    limit: int = Query(default=200, le=500),
    skip: int = 0,
    current_user: dict = Depends(get_current_user)
):
    """
    List all industries with optional filters.
    
    - classification: "inbound" or "outbound"
    - search: Search in name or code
    """
    query = {"is_merged": {"$ne": True}}
    
    if classification:
        if classification not in ["inbound", "outbound"]:
            raise HTTPException(status_code=400, detail="Classification must be 'inbound' or 'outbound'")
        query["classification"] = classification
    
    if search:
        search_regex = {"$regex": re.escape(search), "$options": "i"}
        query["$or"] = [
            {"name": search_regex},
            {"code": search_regex}
        ]
    
    total = await db.industries.count_documents(query)
    
    industries = []
    cursor = db.industries.find(
        query,
        {"_id": 0}
    ).sort("name", 1).skip(skip).limit(limit)
    
    async for doc in cursor:
        # Ensure classification exists
        if "classification" not in doc:
            doc["classification"] = "inbound"
        industries.append(doc)
    
    return {
        "industries": industries,
        "total": total,
        "limit": limit,
        "skip": skip
    }


@router.get("/outbound")
async def list_outbound_industries(
    current_user: dict = Depends(get_current_user)
):
    """List only outbound industries"""
    industries = []
    cursor = db.industries.find(
        {"classification": "outbound", "is_merged": {"$ne": True}},
        {"_id": 0}
    ).sort("name", 1)
    
    async for doc in cursor:
        industries.append(doc)
    
    return {"industries": industries, "total": len(industries)}


@router.get("/{industry_id}")
async def get_industry(
    industry_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get a single industry by ID"""
    industry = await db.industries.find_one(
        {"id": industry_id},
        {"_id": 0}
    )
    
    if not industry:
        raise HTTPException(status_code=404, detail="Industry not found")
    
    # Ensure classification exists
    if "classification" not in industry:
        industry["classification"] = "inbound"
    
    return industry


@router.post("")
async def create_industry(
    request: IndustryCreate,
    current_user: dict = Depends(get_current_user)
):
    """Create a new industry"""
    
    if request.classification not in ["inbound", "outbound"]:
        raise HTTPException(status_code=400, detail="Classification must be 'inbound' or 'outbound'")
    
    # Generate code if not provided
    code = request.code or normalize_code(request.name)
    
    # Check if code already exists
    existing = await db.industries.find_one({"code": code, "is_merged": {"$ne": True}})
    if existing:
        raise HTTPException(status_code=400, detail=f"Industry with code '{code}' already exists")
    
    now = datetime.now(timezone.utc).isoformat()
    
    industry = {
        "id": str(uuid.uuid4()),
        "code": code,
        "name": request.name,
        "description": request.description or "",
        "color": request.color or "#6366f1",
        "classification": request.classification,
        "is_merged": False,
        "created_at": now,
        "updated_at": now
    }
    
    await db.industries.insert_one(industry)
    
    # Audit log
    await db.audit_logs.insert_one({
        "id": str(uuid.uuid4()),
        "type": "industry_create",
        "entity_type": "industry",
        "entity_id": industry["id"],
        "user_id": current_user.get("id"),
        "user_email": current_user.get("email"),
        "timestamp": now
    })
    
    return {"success": True, "industry": {k: v for k, v in industry.items() if not k.startswith("_")}}


@router.patch("/{industry_id}")
async def update_industry(
    industry_id: str,
    request: IndustryUpdate,
    current_user: dict = Depends(get_current_user)
):
    """Update an industry"""
    
    industry = await db.industries.find_one({"id": industry_id})
    if not industry:
        raise HTTPException(status_code=404, detail="Industry not found")
    
    now = datetime.now(timezone.utc).isoformat()
    update_data = {"updated_at": now}
    
    if request.name is not None:
        update_data["name"] = request.name
    
    if request.code is not None:
        # Check for duplicate code
        existing = await db.industries.find_one({
            "code": request.code, 
            "id": {"$ne": industry_id},
            "is_merged": {"$ne": True}
        })
        if existing:
            raise HTTPException(status_code=400, detail=f"Industry with code '{request.code}' already exists")
        update_data["code"] = request.code
    
    if request.description is not None:
        update_data["description"] = request.description
    
    if request.color is not None:
        update_data["color"] = request.color
    
    if request.classification is not None:
        if request.classification not in ["inbound", "outbound"]:
            raise HTTPException(status_code=400, detail="Classification must be 'inbound' or 'outbound'")
        update_data["classification"] = request.classification
    
    await db.industries.update_one(
        {"id": industry_id},
        {"$set": update_data}
    )
    
    return {"success": True, "updated": update_data}


@router.delete("/{industry_id}")
async def delete_industry(
    industry_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Delete an industry (soft delete by marking as merged)"""
    
    industry = await db.industries.find_one({"id": industry_id})
    if not industry:
        raise HTTPException(status_code=404, detail="Industry not found")
    
    now = datetime.now(timezone.utc).isoformat()
    
    # Check if any companies use this industry
    company_count = await db.unified_companies.count_documents({
        "$or": [
            {"industry_id": industry_id},
            {"industry": {"$regex": f"^{re.escape(industry.get('name', ''))}$", "$options": "i"}}
        ]
    })
    
    if company_count > 0:
        raise HTTPException(
            status_code=400, 
            detail=f"Cannot delete industry: {company_count} companies are using it. Merge it into another industry first."
        )
    
    # Soft delete
    await db.industries.update_one(
        {"id": industry_id},
        {"$set": {
            "is_merged": True,
            "deleted_at": now,
            "deleted_by": current_user.get("email")
        }}
    )
    
    return {"success": True, "message": "Industry deleted"}


# =============================================================================
# CLASSIFICATION ENDPOINTS
# =============================================================================

@router.patch("/{industry_id}/classification")
async def update_industry_classification(
    industry_id: str,
    request: ClassificationUpdate,
    current_user: dict = Depends(get_current_user)
):
    """Update the classification of an industry and propagate to all associated companies"""
    
    if request.classification not in ["inbound", "outbound"]:
        raise HTTPException(status_code=400, detail="Classification must be 'inbound' or 'outbound'")
    
    industry = await db.industries.find_one({"id": industry_id})
    if not industry:
        raise HTTPException(status_code=404, detail="Industry not found")
    
    old_classification = industry.get("classification", "inbound")
    now = datetime.now(timezone.utc).isoformat()
    
    # Update industry
    await db.industries.update_one(
        {"id": industry_id},
        {"$set": {
            "classification": request.classification,
            "updated_at": now
        }}
    )
    
    # Also update in active_sectors
    await db.active_sectors.update_one(
        {"id": industry_id},
        {"$set": {
            "classification": request.classification,
            "updated_at": now
        }}
    )
    
    # Propagate to all companies with this industry_code
    companies_updated = 0
    contacts_updated = 0
    industry_code = industry.get("code")
    if industry_code and old_classification != request.classification:
        # Get company IDs before updating
        company_ids = []
        async for comp in db.unified_companies.find(
            {"industry_code": industry_code, "is_merged": {"$ne": True}},
            {"id": 1}
        ):
            company_ids.append(comp["id"])
        
        # Update companies
        result = await db.unified_companies.update_many(
            {"industry_code": industry_code, "is_merged": {"$ne": True}},
            {"$set": {
                "classification": request.classification,
                "updated_at": now
            }}
        )
        companies_updated = result.modified_count
        
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
                    # Also add aliases
                    for alias in comp.get("aliases", []):
                        if alias:
                            company_names.append(alias)
            
            # Update contacts by company_id OR company_name
            result_contacts = await db.unified_contacts.update_many(
                {"$or": [
                    {"company_id": {"$in": company_ids}},
                    {"companies.company_id": {"$in": company_ids}},
                    {"companies.company_name": {"$in": company_names}}
                ]},
                {"$set": {
                    "classification": request.classification,
                    "updated_at": now
                }}
            )
            contacts_updated = result_contacts.modified_count
    
    # Audit log
    await db.audit_logs.insert_one({
        "id": str(uuid.uuid4()),
        "type": "classification_change",
        "entity_type": "industry",
        "entity_id": industry_id,
        "before": {"classification": old_classification},
        "after": {"classification": request.classification},
        "companies_updated": companies_updated,
        "contacts_updated": contacts_updated,
        "user_id": current_user.get("id"),
        "user_email": current_user.get("email"),
        "timestamp": now
    })
    
    return {
        "success": True,
        "industry_id": industry_id,
        "industry_code": industry_code,
        "old_classification": old_classification,
        "new_classification": request.classification,
        "companies_updated": companies_updated,
        "contacts_updated": contacts_updated
    }


@router.get("/{industry_id}/propagation-preview")
async def get_industry_propagation_preview(
    industry_id: str,
    target_classification: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Preview impact of propagating classification to companies.
    Returns count and list of affected companies.
    """
    if target_classification not in ["inbound", "outbound"]:
        raise HTTPException(status_code=400, detail="Classification must be 'inbound' or 'outbound'")
    
    industry = await db.industries.find_one({"id": industry_id})
    if not industry:
        raise HTTPException(status_code=404, detail="Industry not found")
    
    industry_name = industry.get("name", "")
    
    # Find companies that would be affected
    query = {
        "$or": [
            {"industry_id": industry_id},
            {"industry": {"$regex": f"^{re.escape(industry_name)}$", "$options": "i"}}
        ],
        "classification": {"$ne": target_classification},
        "is_merged": {"$ne": True}
    }
    
    affected = []
    async for company in db.unified_companies.find(query, {"_id": 0, "id": 1, "name": 1}):
        affected.append({
            "id": company["id"],
            "name": company.get("name", "Unknown")
        })
    
    return {
        "industry_id": industry_id,
        "industry_name": industry_name,
        "target_classification": target_classification,
        "affected_count": len(affected),
        "affected_companies": affected[:100]  # Limit preview
    }


@router.post("/{industry_id}/propagate-classification")
async def propagate_industry_classification(
    industry_id: str,
    request: ClassificationUpdate,
    current_user: dict = Depends(get_current_user)
):
    """
    Propagate industry classification to all associated companies.
    """
    if request.classification not in ["inbound", "outbound"]:
        raise HTTPException(status_code=400, detail="Classification must be 'inbound' or 'outbound'")
    
    industry = await db.industries.find_one({"id": industry_id})
    if not industry:
        raise HTTPException(status_code=404, detail="Industry not found")
    
    industry_name = industry.get("name", "")
    now = datetime.now(timezone.utc).isoformat()
    
    # First update the industry itself
    old_classification = industry.get("classification", "inbound")
    await db.industries.update_one(
        {"id": industry_id},
        {"$set": {
            "classification": request.classification,
            "updated_at": now
        }}
    )
    
    # Find and update associated companies
    query = {
        "$or": [
            {"industry_id": industry_id},
            {"industry": {"$regex": f"^{re.escape(industry_name)}$", "$options": "i"}}
        ],
        "is_merged": {"$ne": True}
    }
    
    result = await db.unified_companies.update_many(
        query,
        {"$set": {
            "classification": request.classification,
            "updated_at": now
        }}
    )
    
    companies_updated = result.modified_count
    
    # Audit log
    await db.audit_logs.insert_one({
        "id": str(uuid.uuid4()),
        "type": "propagation",
        "source_type": "industry",
        "source_id": industry_id,
        "target_type": "company",
        "target_classification": request.classification,
        "affected_count": companies_updated,
        "user_id": current_user.get("id"),
        "user_email": current_user.get("email"),
        "timestamp": now
    })
    
    return {
        "success": True,
        "industry_id": industry_id,
        "classification": request.classification,
        "companies_updated": companies_updated
    }


# =============================================================================
# MERGE ENDPOINTS
# =============================================================================

@router.get("/merge/preview")
async def preview_industry_merge(
    primary_id: str,
    secondary_ids: str,  # Comma-separated list
    current_user: dict = Depends(get_current_user)
):
    """
    Preview what would happen if industries are merged.
    Returns affected companies for each industry.
    """
    secondary_id_list = [s.strip() for s in secondary_ids.split(",") if s.strip()]
    
    if not secondary_id_list:
        raise HTTPException(status_code=400, detail="At least one secondary industry ID is required")
    
    # Get primary industry
    primary = await db.industries.find_one({"id": primary_id, "is_merged": {"$ne": True}}, {"_id": 0})
    if not primary:
        raise HTTPException(status_code=404, detail="Primary industry not found")
    
    preview = {
        "primary": {
            "id": primary["id"],
            "name": primary.get("name"),
            "company_count": 0
        },
        "to_merge": [],
        "total_companies_affected": 0
    }
    
    # Count companies for primary
    primary_name = primary.get("name", "")
    primary_count = await db.unified_companies.count_documents({
        "$or": [
            {"industry_id": primary_id},
            {"industry": {"$regex": f"^{re.escape(primary_name)}$", "$options": "i"}}
        ],
        "is_merged": {"$ne": True}
    })
    preview["primary"]["company_count"] = primary_count
    
    # Count companies for each secondary
    for sec_id in secondary_id_list:
        secondary = await db.industries.find_one({"id": sec_id, "is_merged": {"$ne": True}}, {"_id": 0})
        if secondary:
            sec_name = secondary.get("name", "")
            sec_count = await db.unified_companies.count_documents({
                "$or": [
                    {"industry_id": sec_id},
                    {"industry": {"$regex": f"^{re.escape(sec_name)}$", "$options": "i"}}
                ],
                "is_merged": {"$ne": True}
            })
            preview["to_merge"].append({
                "id": secondary["id"],
                "name": secondary.get("name"),
                "company_count": sec_count
            })
            preview["total_companies_affected"] += sec_count
    
    return preview


@router.post("/merge")
async def merge_industries(
    request: MergeIndustriesRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Merge multiple industries into a primary industry.
    
    Actions:
    - Companies using merged industries are updated to use the primary
    - Merged industries are marked as merged
    - Audit log is created
    """
    primary_id = request.primary_industry_id
    merge_ids = request.industries_to_merge
    
    if primary_id in merge_ids:
        raise HTTPException(status_code=400, detail="Primary industry cannot be in merge list")
    
    if len(merge_ids) == 0:
        raise HTTPException(status_code=400, detail="No industries to merge")
    
    # Get primary industry
    primary = await db.industries.find_one({"id": primary_id, "is_merged": {"$ne": True}})
    if not primary:
        raise HTTPException(status_code=404, detail="Primary industry not found")
    
    primary_name = primary.get("name", "")
    now = datetime.now(timezone.utc).isoformat()
    
    total_companies_updated = 0
    merged_industries = []
    
    for merge_id in merge_ids:
        secondary = await db.industries.find_one({"id": merge_id, "is_merged": {"$ne": True}})
        if not secondary:
            continue
        
        sec_name = secondary.get("name", "")
        merged_industries.append(sec_name)
        
        # Update companies using this industry
        # By industry_id
        result1 = await db.unified_companies.update_many(
            {"industry_id": merge_id},
            {"$set": {
                "industry_id": primary_id,
                "industry": primary_name,
                "updated_at": now
            }}
        )
        
        # By industry name string
        result2 = await db.unified_companies.update_many(
            {
                "industry": {"$regex": f"^{re.escape(sec_name)}$", "$options": "i"},
                "industry_id": {"$ne": primary_id}
            },
            {"$set": {
                "industry_id": primary_id,
                "industry": primary_name,
                "updated_at": now
            }}
        )
        
        total_companies_updated += result1.modified_count + result2.modified_count
        
        # Mark industry as merged
        await db.industries.update_one(
            {"id": merge_id},
            {"$set": {
                "is_merged": True,
                "merged_into_id": primary_id,
                "merged_into_name": primary_name,
                "merged_at": now,
                "merged_by": current_user.get("email")
            }}
        )
    
    # Audit log
    await db.audit_logs.insert_one({
        "id": str(uuid.uuid4()),
        "type": "industry_merge",
        "primary_id": primary_id,
        "primary_name": primary_name,
        "merged_ids": merge_ids,
        "merged_names": merged_industries,
        "companies_updated": total_companies_updated,
        "user_id": current_user.get("id"),
        "user_email": current_user.get("email"),
        "timestamp": now
    })
    
    return {
        "success": True,
        "primary_industry": primary_name,
        "industries_merged": merged_industries,
        "companies_updated": total_companies_updated
    }


# =============================================================================
# STATS & LOOKUP
# =============================================================================

@router.get("/stats/overview")
async def get_industry_stats(
    current_user: dict = Depends(get_current_user)
):
    """Get overview statistics for industries"""
    
    total = await db.industries.count_documents({"is_merged": {"$ne": True}})
    inbound = await db.industries.count_documents({"classification": "inbound", "is_merged": {"$ne": True}})
    outbound = await db.industries.count_documents({"classification": "outbound", "is_merged": {"$ne": True}})
    
    # Get companies per industry
    pipeline = [
        {"$match": {"is_merged": {"$ne": True}}},
        {"$group": {
            "_id": "$industry",
            "count": {"$sum": 1}
        }},
        {"$sort": {"count": -1}},
        {"$limit": 10}
    ]
    
    top_industries = []
    async for doc in db.unified_companies.aggregate(pipeline):
        if doc["_id"]:
            top_industries.append({
                "name": doc["_id"],
                "company_count": doc["count"]
            })
    
    return {
        "total_industries": total,
        "inbound_count": inbound,
        "outbound_count": outbound,
        "top_industries_by_company_count": top_industries
    }


@router.get("/lookup/by-name/{name}")
async def lookup_industry_by_name(
    name: str,
    current_user: dict = Depends(get_current_user)
):
    """Lookup an industry by name (case-insensitive)"""
    
    industry = await db.industries.find_one(
        {
            "name": {"$regex": f"^{re.escape(name)}$", "$options": "i"},
            "is_merged": {"$ne": True}
        },
        {"_id": 0}
    )
    
    if not industry:
        return {"found": False, "industry": None}
    
    return {"found": True, "industry": industry}
