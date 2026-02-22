"""
Unified Companies Router - CRUD operations for unified companies entity

This router replaces the multi-collection approach with a single canonical entity.
All company operations now go through unified_companies collection.
"""
from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timezone
import uuid
import re

from .auth import get_current_user
from .legacy import db

router = APIRouter(prefix="/unified-companies", tags=["Unified Companies"])


# =============================================================================
# MODELS
# =============================================================================

class CompanyClassification(BaseModel):
    """Classification update request"""
    classification: str  # "inbound" or "outbound"


class CompanyUpdate(BaseModel):
    """Company update request"""
    name: Optional[str] = None
    classification: Optional[str] = None
    domain: Optional[str] = None
    industry: Optional[str] = None
    description: Optional[str] = None
    website: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    country: Optional[str] = None
    linkedin_url: Optional[str] = None
    aliases: Optional[List[str]] = None


class PropagationPreview(BaseModel):
    """Preview of propagation impact"""
    affected_count: int
    affected_ids: List[str]
    affected_names: List[str]


class CreateCompanyRequest(BaseModel):
    """Request to create a new company"""
    name: str
    classification: str = "inbound"
    domain: Optional[str] = None
    industry: Optional[str] = None
    description: Optional[str] = None


# =============================================================================
# ENDPOINTS
# =============================================================================

@router.get("")
async def list_unified_companies(
    classification: Optional[str] = None,
    search: Optional[str] = None,
    industry: Optional[str] = None,
    industry_code: Optional[str] = None,
    limit: int = Query(default=100, le=5000),
    skip: int = 0,
    current_user: dict = Depends(get_current_user)
):
    """
    List unified companies with optional filters.
    
    - classification: "inbound" or "outbound"
    - search: Search in name, domain, aliases
    - industry: Filter by industry string (legacy)
    - industry_code: Filter by exact industry code
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
            {"domain": search_regex},
            {"aliases": search_regex},
            {"normalized_name": search_regex}
        ]
    
    if industry_code:
        # Exact match for industry_code, or fallback to industry name
        if industry_code == "sin_industria":
            query["$and"] = query.get("$and", []) + [
                {"$or": [
                    {"industry_code": {"$exists": False}},
                    {"industry_code": None},
                    {"industry_code": ""},
                    {"industry_code": "sin_industria"}
                ]}
            ]
        else:
            query["industry_code"] = industry_code
    elif industry:
        query["$or"] = query.get("$or", []) + [
            {"industry": {"$regex": re.escape(industry), "$options": "i"}},
            {"industries": {"$regex": re.escape(industry), "$options": "i"}}
        ]
    
    # Get total count
    total = await db.unified_companies.count_documents(query)
    
    # Get companies
    companies = []
    cursor = db.unified_companies.find(
        query,
        {"_id": 0, "_legacy_ids": 0, "_legacy_sources": 0}
    ).sort("name", 1).skip(skip).limit(limit)
    
    async for doc in cursor:
        companies.append(doc)
    
    return {
        "companies": companies,
        "total": total,
        "limit": limit,
        "skip": skip,
        "page": (skip // limit) + 1 if limit > 0 else 1,
        "pages": (total + limit - 1) // limit if limit > 0 else 1
    }


@router.get("/counts-by-industry")
async def get_company_counts_by_industry(
    current_user: dict = Depends(get_current_user)
):
    """
    Get company counts grouped by industry_code.
    This is a lightweight endpoint that returns only counts, not company data.
    Used by the frontend to display accurate totals without loading all companies.
    """
    pipeline = [
        {"$match": {"is_merged": {"$ne": True}}},
        {"$group": {
            "_id": {
                "$ifNull": ["$industry_code", "sin_industria"]
            },
            "count": {"$sum": 1}
        }},
        {"$sort": {"count": -1}}
    ]
    
    results = await db.unified_companies.aggregate(pipeline).to_list(500)
    
    # Build counts dict
    counts = {}
    total = 0
    for r in results:
        industry_code = r["_id"] if r["_id"] else "sin_industria"
        counts[industry_code] = r["count"]
        total += r["count"]
    
    return {
        "counts": counts,
        "total": total
    }


@router.get("/find-by-name/{name}")
async def find_company_by_name_or_alias(
    name: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Find a company by exact name or alias match.
    Used for associating contacts to companies by name.
    Returns the company if found, or null if not found.
    """
    escaped_name = re.escape(name)
    
    # Try exact name match first
    company = await db.unified_companies.find_one(
        {"name": {"$regex": f"^{escaped_name}$", "$options": "i"}, "is_merged": {"$ne": True}},
        {"_id": 0, "id": 1, "name": 1, "classification": 1, "industry": 1}
    )
    
    # Try alias match
    if not company:
        company = await db.unified_companies.find_one(
            {"aliases": {"$regex": f"^{escaped_name}$", "$options": "i"}, "is_merged": {"$ne": True}},
            {"_id": 0, "id": 1, "name": 1, "classification": 1, "industry": 1, "aliases": 1}
        )
        if company:
            company["matched_by"] = "alias"
    
    if company:
        return {"found": True, "company": company}
    
    return {"found": False, "company": None}


@router.get("/outbound")
async def list_outbound_companies(
    search: Optional[str] = None,
    limit: int = Query(default=50, le=500),
    skip: int = 0,
    current_user: dict = Depends(get_current_user)
):
    """
    List only outbound companies (replaces 'active companies' concept).
    Used by prospection, max-linkedin, bulk-event features.
    """
    query = {
        "classification": "outbound",
        "is_merged": {"$ne": True}
    }
    
    if search:
        search_regex = {"$regex": re.escape(search), "$options": "i"}
        query["$or"] = [
            {"name": search_regex},
            {"domain": search_regex},
            {"aliases": search_regex}
        ]
    
    total = await db.unified_companies.count_documents(query)
    
    companies = []
    cursor = db.unified_companies.find(
        query,
        {"_id": 0}
    ).sort("name", 1).skip(skip).limit(limit)
    
    async for doc in cursor:
        companies.append(doc)
    
    return {
        "companies": companies,
        "total": total
    }


@router.get("/search")
async def search_unified_companies(
    q: str,
    classification: Optional[str] = None,
    limit: int = 20,
    current_user: dict = Depends(get_current_user)
):
    """
    Search companies by name, domain, or aliases.
    Returns matches from unified_companies collection.
    """
    if not q or len(q) < 2:
        return {"companies": []}
    
    search_regex = {"$regex": re.escape(q), "$options": "i"}
    
    query = {
        "is_merged": {"$ne": True},
        "$or": [
            {"name": search_regex},
            {"domain": search_regex},
            {"aliases": search_regex},
            {"normalized_name": search_regex}
        ]
    }
    
    if classification:
        query["classification"] = classification
    
    companies = []
    cursor = db.unified_companies.find(
        query,
        {"_id": 0, "id": 1, "name": 1, "domain": 1, "classification": 1, "industry": 1, "aliases": 1}
    ).limit(limit)
    
    async for doc in cursor:
        companies.append(doc)
    
    return {"companies": companies}


@router.get("/{company_id}")
async def get_unified_company(
    company_id: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Get a single unified company by ID with associated contacts.
    Searches by: id, hubspot_id, name, or alias (in that order).
    """
    
    # Try by id first
    company = await db.unified_companies.find_one(
        {"id": company_id, "is_merged": {"$ne": True}},
        {"_id": 0}
    )
    
    # Try by hubspot_id
    if not company:
        company = await db.unified_companies.find_one(
            {"hubspot_id": company_id, "is_merged": {"$ne": True}},
            {"_id": 0}
        )
    
    # Try by exact name match
    if not company:
        company = await db.unified_companies.find_one(
            {"name": {"$regex": f"^{re.escape(company_id)}$", "$options": "i"}, "is_merged": {"$ne": True}},
            {"_id": 0}
        )
    
    # Try by alias match
    if not company:
        company = await db.unified_companies.find_one(
            {"aliases": {"$regex": f"^{re.escape(company_id)}$", "$options": "i"}, "is_merged": {"$ne": True}},
            {"_id": 0}
        )
    
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    
    # Get associated contacts from unified_contacts
    # Contacts can be associated by: company_id, company name, aliases, or companies array
    company_name = company.get("name", "")
    actual_id = company.get("id", company_id)
    hubspot_id = company.get("hubspot_id")
    aliases = company.get("aliases", []) or []
    
    # Build query to find contacts - check multiple ID formats
    contact_query = {
        "$or": [
            {"company_id": actual_id},
            {"company_id": company_id},  # The ID used in the URL
            {"companies.company_id": actual_id},
            {"companies.company_id": company_id},
        ]
    }
    
    # Also add hubspot_id if present
    if hubspot_id:
        contact_query["$or"].extend([
            {"company_id": hubspot_id},
            {"companies.company_id": hubspot_id}
        ])
    
    # Search by company name (exact match, case insensitive)
    if company_name:
        contact_query["$or"].extend([
            {"company": {"$regex": f"^{re.escape(company_name)}$", "$options": "i"}},
            {"companies.company_name": {"$regex": f"^{re.escape(company_name)}$", "$options": "i"}}
        ])
    
    # Search by aliases (exact match, case insensitive)
    for alias in aliases:
        if alias and alias.strip():
            contact_query["$or"].extend([
                {"company": {"$regex": f"^{re.escape(alias.strip())}$", "$options": "i"}},
                {"companies.company_name": {"$regex": f"^{re.escape(alias.strip())}$", "$options": "i"}}
            ])
    
    # Get total count first (before limiting)
    total_contacts = await db.unified_contacts.count_documents(contact_query)
    
    # Get contacts with limit for display
    contacts = await db.unified_contacts.find(
        contact_query,
        {"_id": 0, "id": 1, "name": 1, "email": 1, "stage": 1, "job_title": 1, "classification": 1}
    ).limit(100000).to_list(100000)
    
    company["contacts"] = contacts
    company["stats"] = {
        "total_contacts": total_contacts
    }
    
    return company


@router.patch("/{company_id}")
async def update_unified_company(
    company_id: str,
    request: CompanyUpdate,
    current_user: dict = Depends(get_current_user)
):
    """
    Update a unified company.
    Finds company by: id, hubspot_id, or name (in that order).
    """
    
    # Try by id first
    company = await db.unified_companies.find_one({"id": company_id, "is_merged": {"$ne": True}})
    
    # Try by hubspot_id
    if not company:
        company = await db.unified_companies.find_one({"hubspot_id": company_id, "is_merged": {"$ne": True}})
    
    # Try by exact name match
    if not company:
        company = await db.unified_companies.find_one({
            "name": {"$regex": f"^{re.escape(company_id)}$", "$options": "i"},
            "is_merged": {"$ne": True}
        })
    
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    
    # Use the actual company id for the update
    actual_id = company["id"]
    
    update_data = {"updated_at": datetime.now(timezone.utc).isoformat()}
    
    if request.name is not None:
        update_data["name"] = request.name
        update_data["normalized_name"] = request.name.lower().strip()
    
    if request.classification is not None:
        if request.classification not in ["inbound", "outbound"]:
            raise HTTPException(status_code=400, detail="Classification must be 'inbound' or 'outbound'")
        
        old_classification = company.get("classification")
        update_data["classification"] = request.classification
        
        # Track when changed to outbound
        if request.classification == "outbound" and old_classification != "outbound":
            update_data["outbound_since"] = datetime.now(timezone.utc).isoformat()
            update_data["outbound_source"] = "manual"
    
    if request.domain is not None:
        update_data["domain"] = request.domain
    
    if request.industry is not None:
        update_data["industry"] = request.industry
    
    if request.description is not None:
        update_data["description"] = request.description
    
    if request.website is not None:
        update_data["website"] = request.website
    
    if request.phone is not None:
        update_data["phone"] = request.phone
    
    if request.address is not None:
        update_data["address"] = request.address
    
    if request.city is not None:
        update_data["city"] = request.city
    
    if request.country is not None:
        update_data["country"] = request.country
    
    if request.linkedin_url is not None:
        update_data["linkedin_url"] = request.linkedin_url
    
    # Handle aliases with automatic merge
    merged_companies = []
    if request.aliases is not None:
        new_aliases = list(set(a.strip() for a in request.aliases if a.strip()))
        existing_aliases = set(company.get("aliases", []))
        
        # Find newly added aliases
        added_aliases = [a for a in new_aliases if a not in existing_aliases]
        
        # For each new alias, check if there's a company with that name to merge
        for alias in added_aliases:
            # Search for company with this exact name (case-insensitive)
            company_to_merge = await db.unified_companies.find_one({
                "name": {"$regex": f"^{re.escape(alias)}$", "$options": "i"},
                "is_merged": {"$ne": True},
                "id": {"$ne": actual_id}  # Don't merge with self
            })
            
            if company_to_merge:
                merge_id = company_to_merge["id"]
                merge_name = company_to_merge.get("name", "")
                
                # Collect data from company to merge
                # Add its aliases to our list
                for a in company_to_merge.get("aliases", []):
                    if a and a not in new_aliases:
                        new_aliases.append(a)
                
                # Add its domains
                current_domains = set(company.get("domains", []))
                if company.get("domain"):
                    current_domains.add(company["domain"])
                if company_to_merge.get("domain"):
                    current_domains.add(company_to_merge["domain"])
                for d in company_to_merge.get("domains", []):
                    if d:
                        current_domains.add(d)
                update_data["domains"] = list(current_domains)
                
                # Copy hubspot_id if principal doesn't have one
                if not company.get("hubspot_id") and company_to_merge.get("hubspot_id"):
                    update_data["hubspot_id"] = company_to_merge["hubspot_id"]
                
                # Copy industry if principal doesn't have one
                if not company.get("industry_code") and company_to_merge.get("industry_code"):
                    update_data["industry_code"] = company_to_merge["industry_code"]
                    update_data["industry"] = company_to_merge.get("industry")
                
                # If merged company is outbound, make principal outbound too
                if company_to_merge.get("classification") == "outbound":
                    update_data["classification"] = "outbound"
                
                # Move linkedin_searches to principal
                await db.linkedin_searches.update_many(
                    {"company_id": merge_id},
                    {"$set": {"company_id": actual_id}}
                )
                
                # Move contact associations to principal
                await db.unified_contacts.update_many(
                    {"companies.company_id": merge_id},
                    {"$set": {"companies.$.company_id": actual_id}}
                )
                
                # Also update company_id direct field
                await db.unified_contacts.update_many(
                    {"company_id": merge_id},
                    {"$set": {"company_id": actual_id}}
                )
                
                # Mark the company as merged
                await db.unified_companies.update_one(
                    {"id": merge_id},
                    {"$set": {
                        "is_merged": True,
                        "merged_into": actual_id,
                        "merged_at": datetime.now(timezone.utc).isoformat()
                    }}
                )
                
                merged_companies.append({
                    "id": merge_id,
                    "name": merge_name
                })
        
        update_data["aliases"] = new_aliases
        
        # Normalize contact's company field: update all contacts that have an alias as company
        # to use the principal company name instead
        company_principal_name = company.get("name", "")
        if company_principal_name:
            for alias in new_aliases:
                if alias and alias.lower() != company_principal_name.lower():
                    # Update contacts where company field matches this alias
                    await db.unified_contacts.update_many(
                        {"company": {"$regex": f"^{re.escape(alias)}$", "$options": "i"}},
                        {"$set": {"company": company_principal_name}}
                    )
                    # Also update in companies array
                    await db.unified_contacts.update_many(
                        {"companies.company_name": {"$regex": f"^{re.escape(alias)}$", "$options": "i"}},
                        {"$set": {"companies.$[elem].company_name": company_principal_name}},
                        array_filters=[{"elem.company_name": {"$regex": f"^{re.escape(alias)}$", "$options": "i"}}]
                    )
    
    await db.unified_companies.update_one(
        {"id": actual_id},
        {"$set": update_data}
    )
    
    # Propagate classification change to contacts
    contacts_updated = 0
    if request.classification and company.get("classification") != request.classification:
        # Get company names for matching
        company_names = [company.get("name")]
        for alias in company.get("aliases", []):
            if alias:
                company_names.append(alias)
        
        # Update contacts that have this company_id or company_name
        result = await db.unified_contacts.update_many(
            {"$or": [
                {"company_id": actual_id},
                {"companies.company_id": actual_id},
                {"companies.company_name": {"$in": company_names}}
            ]},
            {"$set": {
                "classification": request.classification,
                "updated_at": datetime.now(timezone.utc).isoformat()
            }}
        )
        contacts_updated = result.modified_count
    
    # Create audit log
    await db.audit_logs.insert_one({
        "id": str(uuid.uuid4()),
        "type": "classification_change" if request.classification else "company_update",
        "entity_type": "company",
        "entity_id": actual_id,
        "before": {"classification": company.get("classification")},
        "after": {"classification": request.classification} if request.classification else update_data,
        "merged_companies": merged_companies if merged_companies else None,
        "contacts_updated": contacts_updated if contacts_updated else None,
        "user_id": current_user.get("id"),
        "user_email": current_user.get("email"),
        "timestamp": datetime.now(timezone.utc).isoformat()
    })
    
    response = {"success": True, "updated": update_data, "id": actual_id}
    if merged_companies:
        response["merged_companies"] = merged_companies
        response["message"] = f"Se fusionaron {len(merged_companies)} empresa(s) automáticamente"
    if contacts_updated:
        response["contacts_updated"] = contacts_updated
    
    return response


@router.patch("/{company_id}/classification")
async def update_company_classification(
    company_id: str,
    request: CompanyClassification,
    current_user: dict = Depends(get_current_user)
):
    """Update only the classification of a company"""
    
    if request.classification not in ["inbound", "outbound"]:
        raise HTTPException(status_code=400, detail="Classification must be 'inbound' or 'outbound'")
    
    company = await db.unified_companies.find_one({"id": company_id})
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    
    old_classification = company.get("classification")
    
    update_data = {
        "classification": request.classification,
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    # Track outbound metadata
    if request.classification == "outbound" and old_classification != "outbound":
        update_data["outbound_since"] = datetime.now(timezone.utc).isoformat()
        update_data["outbound_source"] = "manual"
    
    await db.unified_companies.update_one(
        {"id": company_id},
        {"$set": update_data}
    )
    
    # Create audit log
    await db.audit_logs.insert_one({
        "id": str(uuid.uuid4()),
        "type": "classification_change",
        "entity_type": "company",
        "entity_id": company_id,
        "before": {"classification": old_classification},
        "after": {"classification": request.classification},
        "user_id": current_user.get("id"),
        "user_email": current_user.get("email"),
        "timestamp": datetime.now(timezone.utc).isoformat()
    })
    
    return {
        "success": True,
        "company_id": company_id,
        "old_classification": old_classification,
        "new_classification": request.classification
    }


@router.get("/{company_id}/propagation-preview")
async def get_company_propagation_preview(
    company_id: str,
    target_classification: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Preview impact of propagating classification to contacts.
    Returns count and list of affected contacts.
    """
    if target_classification not in ["inbound", "outbound"]:
        raise HTTPException(status_code=400, detail="Classification must be 'inbound' or 'outbound'")
    
    company = await db.unified_companies.find_one({"id": company_id})
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    
    company_name = company.get("name", "")
    
    # Find contacts associated with this company
    # They can be linked by company_id, company name, or companies array
    query = {
        "$or": [
            {"company_id": company_id},
            {"company": {"$regex": f"^{re.escape(company_name)}$", "$options": "i"}},
            {"companies.company_id": company_id},
            {"companies.company_name": {"$regex": f"^{re.escape(company_name)}$", "$options": "i"}}
        ],
        "classification": {"$ne": target_classification}  # Only those that would change
    }
    
    affected = []
    async for contact in db.unified_contacts.find(query, {"_id": 0, "id": 1, "name": 1, "first_name": 1, "last_name": 1}):
        name = contact.get("name") or f"{contact.get('first_name', '')} {contact.get('last_name', '')}".strip()
        affected.append({
            "id": contact["id"],
            "name": name
        })
    
    return {
        "company_id": company_id,
        "company_name": company_name,
        "target_classification": target_classification,
        "affected_count": len(affected),
        "affected_contacts": affected[:100]  # Limit to first 100 for preview
    }


@router.post("/{company_id}/propagate-classification")
async def propagate_company_classification(
    company_id: str,
    request: CompanyClassification,
    current_user: dict = Depends(get_current_user)
):
    """
    Propagate company classification to all associated contacts.
    For outbound: all contacts become outbound.
    For inbound: contacts become inbound only if ALL their companies are inbound.
    """
    if request.classification not in ["inbound", "outbound"]:
        raise HTTPException(status_code=400, detail="Classification must be 'inbound' or 'outbound'")
    
    company = await db.unified_companies.find_one({"id": company_id})
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    
    company_name = company.get("name", "")
    
    # First update the company itself
    old_classification = company.get("classification")
    await db.unified_companies.update_one(
        {"id": company_id},
        {"$set": {
            "classification": request.classification,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    # Find associated contacts
    query = {
        "$or": [
            {"company_id": company_id},
            {"company": {"$regex": f"^{re.escape(company_name)}$", "$options": "i"}},
            {"companies.company_id": company_id},
            {"companies.company_name": {"$regex": f"^{re.escape(company_name)}$", "$options": "i"}}
        ]
    }
    
    affected_ids = []
    async for contact in db.unified_contacts.find(query, {"_id": 0, "id": 1, "companies": 1}):
        contact_id = contact["id"]
        
        if request.classification == "outbound":
            # Always propagate outbound
            await db.unified_contacts.update_one(
                {"id": contact_id},
                {"$set": {
                    "classification": "outbound",
                    "updated_at": datetime.now(timezone.utc).isoformat()
                }}
            )
            affected_ids.append(contact_id)
        else:
            # For inbound: only if ALL companies are inbound
            # Check other companies
            other_companies = contact.get("companies", [])
            all_inbound = True
            
            for comp in other_companies:
                other_id = comp.get("company_id")
                if other_id and other_id != company_id:
                    other = await db.unified_companies.find_one({"id": other_id}, {"classification": 1})
                    if other and other.get("classification") == "outbound":
                        all_inbound = False
                        break
            
            if all_inbound:
                await db.unified_contacts.update_one(
                    {"id": contact_id},
                    {"$set": {
                        "classification": "inbound",
                        "updated_at": datetime.now(timezone.utc).isoformat()
                    }}
                )
                affected_ids.append(contact_id)
    
    # Create audit log
    await db.audit_logs.insert_one({
        "id": str(uuid.uuid4()),
        "type": "propagation",
        "source_type": "company",
        "source_id": company_id,
        "target_type": "contact",
        "target_classification": request.classification,
        "affected_count": len(affected_ids),
        "affected_ids": affected_ids[:1000],  # Store up to 1000
        "user_id": current_user.get("id"),
        "user_email": current_user.get("email"),
        "timestamp": datetime.now(timezone.utc).isoformat()
    })
    
    return {
        "success": True,
        "company_id": company_id,
        "classification": request.classification,
        "contacts_updated": len(affected_ids)
    }


@router.post("")
async def create_unified_company(
    request: CreateCompanyRequest,
    current_user: dict = Depends(get_current_user)
):
    """Create a new unified company. Prevents duplicates by checking name and aliases."""
    
    normalized_name = request.name.lower().strip()
    
    # Check if company already exists by exact name
    existing = await db.unified_companies.find_one({
        "normalized_name": normalized_name,
        "is_merged": {"$ne": True}
    })
    
    if existing:
        return {
            "success": False,
            "error": "duplicate",
            "message": f"Ya existe una empresa con el nombre '{existing.get('name')}'",
            "existing_company": {
                "id": existing.get("id"),
                "name": existing.get("name"),
                "classification": existing.get("classification")
            }
        }
    
    # Check if this name is an alias of another company
    alias_match = await db.unified_companies.find_one({
        "aliases": {"$regex": f"^{re.escape(request.name)}$", "$options": "i"},
        "is_merged": {"$ne": True}
    })
    
    if alias_match:
        return {
            "success": False,
            "error": "is_alias",
            "message": f"'{request.name}' es un alias de la empresa '{alias_match.get('name')}'",
            "existing_company": {
                "id": alias_match.get("id"),
                "name": alias_match.get("name"),
                "classification": alias_match.get("classification")
            }
        }
    
    now = datetime.now(timezone.utc).isoformat()
    
    company = {
        "id": str(uuid.uuid4()),
        "name": request.name,
        "normalized_name": normalized_name,
        "classification": request.classification,
        "domain": request.domain,
        "industry": request.industry,
        "description": request.description,
        "aliases": [],
        "domains": [request.domain] if request.domain else [],
        "searches": [],
        "is_merged": False,
        "_legacy_sources": ["manual"],
        "created_at": now,
        "updated_at": now
    }
    
    if request.classification == "outbound":
        company["outbound_since"] = now
        company["outbound_source"] = "manual"
    
    await db.unified_companies.insert_one(company)
    
    # Audit log
    await db.audit_logs.insert_one({
        "id": str(uuid.uuid4()),
        "type": "company_create",
        "entity_type": "company",
        "entity_id": company["id"],
        "user_id": current_user.get("id"),
        "user_email": current_user.get("email"),
        "timestamp": now
    })
    
    return {"success": True, "company": {k: v for k, v in company.items() if not k.startswith("_")}}


# =============================================================================
# ACTIVITY / AUDIT LOGS
# =============================================================================

@router.get("/{company_id}/activities")
async def get_company_activities(
    company_id: str,
    limit: int = Query(default=50, le=200),
    current_user: dict = Depends(get_current_user)
):
    """
    Get activity history for a company.
    Includes: classification changes, merges, propagations, contact associations.
    """
    company = await db.unified_companies.find_one(
        {"id": company_id},
        {"_id": 0, "name": 1, "id": 1}
    )
    
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    
    company_name = company.get("name", "")
    
    # Get audit logs for this company
    activities = []
    
    # By company ID
    cursor = db.audit_logs.find(
        {"$or": [
            {"entity_id": company_id},
            {"company_id": company_id},
            {"source_id": company_id},
            {"target_id": company_id}
        ]},
        {"_id": 0}
    ).sort("timestamp", -1).limit(limit)
    
    async for log in cursor:
        activities.append({
            "id": log.get("id"),
            "type": log.get("type"),
            "timestamp": log.get("timestamp"),
            "user_email": log.get("user_email"),
            "before": log.get("before"),
            "after": log.get("after"),
            "details": log.get("details"),
            "affected_count": log.get("affected_count")
        })
    
    # Also get case-related activities if any
    case_activities = []
    cursor = db.cases.find(
        {"company_name": {"$regex": f"^{re.escape(company_name)}$", "$options": "i"}},
        {"_id": 0, "id": 1, "name": 1, "stage": 1, "created_at": 1, "stage_changes": 1}
    ).sort("created_at", -1).limit(20)
    
    async for case in cursor:
        # Add case creation as activity
        case_activities.append({
            "id": f"case-{case.get('id')}",
            "type": "case_associated",
            "timestamp": case.get("created_at"),
            "details": {
                "case_name": case.get("name"),
                "case_id": case.get("id"),
                "stage": case.get("stage")
            }
        })
        
        # Add stage changes
        for change in (case.get("stage_changes") or []):
            case_activities.append({
                "id": f"case-stage-{case.get('id')}-{change.get('timestamp', '')}",
                "type": "case_stage_change",
                "timestamp": change.get("timestamp"),
                "user_email": change.get("changed_by"),
                "details": {
                    "case_name": case.get("name"),
                    "from_stage": change.get("from_stage"),
                    "to_stage": change.get("to_stage")
                }
            })
    
    # Combine and sort by timestamp
    all_activities = activities + case_activities
    all_activities.sort(key=lambda x: x.get("timestamp") or "", reverse=True)
    
    return {
        "company_id": company_id,
        "company_name": company_name,
        "activities": all_activities[:limit],
        "total": len(all_activities)
    }


# =============================================================================
# LOOKUP HELPER (for other routers)
# =============================================================================

async def lookup_company(identifier: str):
    """
    Lookup a company by ID, name, or alias.
    Used by other routers for backward compatibility.
    """
    # Try by ID first
    company = await db.unified_companies.find_one(
        {"id": identifier, "is_merged": {"$ne": True}},
        {"_id": 0}
    )
    if company:
        return company
    
    # Try by name (exact, case-insensitive)
    company = await db.unified_companies.find_one(
        {
            "normalized_name": identifier.lower().strip(),
            "is_merged": {"$ne": True}
        },
        {"_id": 0}
    )
    if company:
        return company
    
    # Try by alias
    company = await db.unified_companies.find_one(
        {
            "aliases": {"$regex": f"^{re.escape(identifier)}$", "$options": "i"},
            "is_merged": {"$ne": True}
        },
        {"_id": 0}
    )
    
    return company



# =============================================================================
# STATS AND INDUSTRY ENDPOINTS
# =============================================================================

@router.get("/stats/summary")
async def get_companies_stats(
    current_user: dict = Depends(get_current_user)
):
    """Get statistics about companies grouped by industry."""
    pipeline = [
        {"$match": {"is_merged": {"$ne": True}}},
        {"$group": {
            "_id": "$industry",
            "count": {"$sum": 1}
        }},
        {"$sort": {"count": -1}}
    ]
    
    results = await db.unified_companies.aggregate(pipeline).to_list(100)
    
    total = sum(r["count"] for r in results)
    outbound = await db.unified_companies.count_documents({
        "classification": "outbound",
        "is_merged": {"$ne": True}
    })
    inbound = await db.unified_companies.count_documents({
        "classification": "inbound", 
        "is_merged": {"$ne": True}
    })
    
    return {
        "total": total,
        "outbound": outbound,
        "inbound": inbound,
        "by_industry": results
    }


@router.get("/stats/industries")
async def get_company_industries(
    current_user: dict = Depends(get_current_user)
):
    """Get list of industries with company counts."""
    pipeline = [
        {"$match": {"is_merged": {"$ne": True}, "industry": {"$exists": True, "$ne": None}}},
        {"$group": {
            "_id": "$industry",
            "count": {"$sum": 1}
        }},
        {"$sort": {"count": -1}}
    ]
    
    results = await db.unified_companies.aggregate(pipeline).to_list(100)
    
    # Also count companies without industry
    no_industry = await db.unified_companies.count_documents({
        "is_merged": {"$ne": True},
        "$or": [
            {"industry": {"$exists": False}},
            {"industry": None},
            {"industry": ""}
        ]
    })
    
    industries = [{"industry": r["_id"], "count": r["count"]} for r in results if r["_id"]]
    
    return {
        "industries": industries,
        "no_industry_count": no_industry
    }


@router.get("/by-industry/{industry}")
async def get_companies_by_industry(
    industry: str,
    limit: int = Query(default=100, le=500),
    current_user: dict = Depends(get_current_user)
):
    """Get companies in a specific industry."""
    if industry == "NO_INDUSTRY":
        query = {
            "is_merged": {"$ne": True},
            "$or": [
                {"industry": {"$exists": False}},
                {"industry": None},
                {"industry": ""}
            ]
        }
    else:
        query = {
            "is_merged": {"$ne": True},
            "industry": {"$regex": f"^{re.escape(industry)}$", "$options": "i"}
        }
    
    companies = await db.unified_companies.find(
        query,
        {"_id": 0}
    ).sort("name", 1).limit(limit).to_list(limit)
    
    return companies


# =============================================================================
# ALIASES MANAGEMENT
# =============================================================================

class AliasRequest(BaseModel):
    alias: str


@router.post("/{company_id}/aliases")
async def add_company_alias(
    company_id: str,
    request: AliasRequest,
    current_user: dict = Depends(get_current_user)
):
    """Add an alias to a company. Alias can be any text string."""
    # Find company by id, hubspot_id, or name
    company = await db.unified_companies.find_one({"id": company_id, "is_merged": {"$ne": True}})
    if not company:
        company = await db.unified_companies.find_one({"hubspot_id": company_id, "is_merged": {"$ne": True}})
    if not company:
        company = await db.unified_companies.find_one({
            "name": {"$regex": f"^{re.escape(company_id)}$", "$options": "i"},
            "is_merged": {"$ne": True}
        })
    
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    
    actual_id = company["id"]
    alias = request.alias.strip()
    if not alias:
        raise HTTPException(status_code=400, detail="Alias cannot be empty")
    
    # Get current aliases
    aliases = company.get("aliases", [])
    
    # Check if alias already exists (case insensitive)
    if any(a.lower() == alias.lower() for a in aliases):
        raise HTTPException(status_code=400, detail="Alias already exists")
    
    # Add alias
    aliases.append(alias)
    
    now = datetime.now(timezone.utc).isoformat()
    await db.unified_companies.update_one(
        {"id": actual_id},
        {"$set": {"aliases": aliases, "updated_at": now}}
    )
    
    return {
        "success": True,
        "aliases": aliases,
        "id": actual_id
    }


@router.delete("/{company_id}/aliases/{alias}")
async def remove_company_alias(
    company_id: str,
    alias: str,
    current_user: dict = Depends(get_current_user)
):
    """Remove an alias from a company."""
    # Find company by id, hubspot_id, or name
    company = await db.unified_companies.find_one({"id": company_id, "is_merged": {"$ne": True}})
    if not company:
        company = await db.unified_companies.find_one({"hubspot_id": company_id, "is_merged": {"$ne": True}})
    if not company:
        company = await db.unified_companies.find_one({
            "name": {"$regex": f"^{re.escape(company_id)}$", "$options": "i"},
            "is_merged": {"$ne": True}
        })
    
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    
    actual_id = company["id"]
    aliases = company.get("aliases", [])
    
    # Find and remove alias (case insensitive match)
    new_aliases = [a for a in aliases if a.lower() != alias.lower()]
    
    if len(new_aliases) == len(aliases):
        raise HTTPException(status_code=404, detail="Alias not found")
    
    now = datetime.now(timezone.utc).isoformat()
    await db.unified_companies.update_one(
        {"id": actual_id},
        {"$set": {"aliases": new_aliases, "updated_at": now}}
    )
    
    return {
        "success": True,
        "aliases": new_aliases
    }


# =============================================================================
# SECONDARY INDUSTRIES
# =============================================================================

class SecondaryIndustryRequest(BaseModel):
    industry: str


@router.post("/{company_id}/industries")
async def add_secondary_industry(
    company_id: str,
    request: SecondaryIndustryRequest,
    current_user: dict = Depends(get_current_user)
):
    """Add a secondary industry to a company."""
    # Find company by id, hubspot_id, or name
    company = await db.unified_companies.find_one({"id": company_id, "is_merged": {"$ne": True}})
    if not company:
        company = await db.unified_companies.find_one({"hubspot_id": company_id, "is_merged": {"$ne": True}})
    if not company:
        company = await db.unified_companies.find_one({
            "name": {"$regex": f"^{re.escape(company_id)}$", "$options": "i"},
            "is_merged": {"$ne": True}
        })
    
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    
    actual_id = company["id"]
    industry = request.industry.strip()
    if not industry:
        raise HTTPException(status_code=400, detail="Industry cannot be empty")
    
    # Get current industries
    industries = company.get("industries", [])
    primary = company.get("industry")
    
    # Check duplicates
    all_industries = [primary] if primary else []
    all_industries.extend(industries)
    
    if any(i and i.lower() == industry.lower() for i in all_industries):
        raise HTTPException(status_code=400, detail="Industry already assigned")
    
    industries.append(industry)
    
    now = datetime.now(timezone.utc).isoformat()
    await db.unified_companies.update_one(
        {"id": actual_id},
        {"$set": {"industries": industries, "updated_at": now}}
    )
    
    return {
        "success": True,
        "industries": industries,
        "primary_industry": primary,
        "id": actual_id
    }


@router.delete("/{company_id}/industries/{industry}")
async def remove_secondary_industry(
    company_id: str,
    industry: str,
    current_user: dict = Depends(get_current_user)
):
    """Remove a secondary industry from a company."""
    # Find company by id, hubspot_id, or name
    company = await db.unified_companies.find_one({"id": company_id, "is_merged": {"$ne": True}})
    if not company:
        company = await db.unified_companies.find_one({"hubspot_id": company_id, "is_merged": {"$ne": True}})
    if not company:
        company = await db.unified_companies.find_one({
            "name": {"$regex": f"^{re.escape(company_id)}$", "$options": "i"},
            "is_merged": {"$ne": True}
        })
    
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    
    actual_id = company["id"]
    industries = company.get("industries", [])
    new_industries = [i for i in industries if i.lower() != industry.lower()]
    
    if len(new_industries) == len(industries):
        raise HTTPException(status_code=404, detail="Industry not found in secondary industries")
    
    now = datetime.now(timezone.utc).isoformat()
    await db.unified_companies.update_one(
        {"id": actual_id},
        {"$set": {"industries": new_industries, "updated_at": now}}
    )
    
    return {
        "success": True,
        "industries": new_industries
    }
