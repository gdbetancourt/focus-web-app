"""
Companies Router - Manage companies and merge duplicates

All endpoints use unified_companies as the single source of truth.
Migration from legacy collections (hubspot_companies, active_companies, companies)
was completed on Feb 20, 2025.
"""
from fastapi import APIRouter, HTTPException, Depends, BackgroundTasks
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timezone
import uuid
import re
from difflib import SequenceMatcher
import logging

from .auth import get_current_user
from .legacy import db
from services.company_auto_merge import (
    run_auto_merge,
    get_duplicate_domains_preview,
    find_duplicate_domains
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/companies", tags=["Companies"])


class MergeCompaniesRequest(BaseModel):
    """Request to merge duplicate companies"""
    primary_company_id: str
    companies_to_merge: List[str]


@router.get("/admin/find-duplicates")
async def find_duplicate_companies(
    threshold: float = 0.85,
    limit: int = 50,
    current_user: dict = Depends(get_current_user)
):
    """
    Find potential duplicate companies based on exact name matches.
    Optimized for speed - only finds exact duplicates, not fuzzy matches.
    """
    import logging
    logger = logging.getLogger(__name__)
    
    # Use aggregation pipeline to find duplicates efficiently
    pipeline = [
        {"$match": {"is_merged": {"$ne": True}, "name": {"$exists": True, "$nin": [None, ""]}}},
        {"$group": {
            "_id": {"$toLower": "$name"},
            "companies": {"$push": {
                "id": {"$ifNull": ["$id", {"$toString": "$hs_object_id"}]},
                "hs_object_id": "$hs_object_id",
                "name": "$name",
                "domain": "$domain",
                "industry": "$industry"
            }},
            "count": {"$sum": 1}
        }},
        {"$match": {"count": {"$gt": 1}}},
        {"$sort": {"count": -1}},
        {"$limit": limit}
    ]
    
    try:
        # Use unified_companies as the single source of truth
        results = await db.unified_companies.aggregate(pipeline).to_list(limit)
    except Exception as e:
        logger.error(f"Error finding duplicates: {e}")
        return {"total_groups": 0, "total_duplicates": 0, "groups": []}
    
    duplicate_groups = []
    
    for result in results:
        companies = result.get("companies", [])
        # Ensure each company has an id
        for company in companies:
            if not company.get("id") and company.get("hs_object_id"):
                company["id"] = str(company["hs_object_id"])
            company["contact_count"] = 0  # Skip contact count for speed
        
        duplicate_groups.append({
            "match_type": "exact_name",
            "match_key": companies[0].get("name", result["_id"]) if companies else result["_id"],
            "companies": companies,
            "confidence": 100
        })
    
    return {
        "total_groups": len(duplicate_groups),
        "total_duplicates": sum(len(g["companies"]) for g in duplicate_groups),
        "groups": duplicate_groups
    }


@router.post("/admin/merge")
async def merge_companies(
    request: MergeCompaniesRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Merge multiple companies into a primary company.
    
    - Primary company keeps its ID and data
    - Contacts referencing merged companies are updated to reference primary
    - Merged companies are marked as is_merged=True
    """
    primary_id = request.primary_company_id
    merge_ids = request.companies_to_merge
    
    if primary_id in merge_ids:
        raise HTTPException(status_code=400, detail="Primary company cannot be in merge list")
    
    if len(merge_ids) == 0:
        raise HTTPException(status_code=400, detail="No companies to merge")
    
    # Get primary company from unified_companies
    primary = await db.unified_companies.find_one(
        {"$or": [{"id": primary_id}, {"hs_object_id": primary_id}, {"hubspot_id": primary_id}], "is_merged": {"$ne": True}},
        {"_id": 0}
    )
    if not primary:
        raise HTTPException(status_code=404, detail="Primary company not found")
    
    primary_name = primary.get("name", "")
    
    # Get companies to merge from unified_companies
    companies_to_merge = await db.unified_companies.find(
        {"$or": [{"id": {"$in": merge_ids}}, {"hs_object_id": {"$in": merge_ids}}, {"hubspot_id": {"$in": merge_ids}}], "is_merged": {"$ne": True}},
        {"_id": 0}
    ).to_list(100)
    
    if len(companies_to_merge) == 0:
        raise HTTPException(status_code=404, detail="No companies to merge found")
    
    now = datetime.now(timezone.utc).isoformat()
    merged_company_names = [c.get("name", "") for c in companies_to_merge]
    
    # Update contacts: change company name from merged companies to primary
    contacts_updated = 0
    for company in companies_to_merge:
        company_name = company.get("name", "")
        if company_name:
            result = await db.unified_contacts.update_many(
                {"company": {"$regex": f"^{re.escape(company_name)}$", "$options": "i"}},
                {"$set": {
                    "company": primary_name,
                    "updated_at": now
                }}
            )
            contacts_updated += result.modified_count
    
    # Mark merged companies as merged in unified_companies
    for merge_id in merge_ids:
        await db.unified_companies.update_one(
            {"$or": [{"id": merge_id}, {"hs_object_id": merge_id}, {"hubspot_id": merge_id}]},
            {"$set": {
                "is_merged": True,
                "merged_into_company_id": primary_id,
                "merged_at": now
            }}
        )
    
    # Update primary company in unified_companies
    await db.unified_companies.update_one(
        {"$or": [{"id": primary_id}, {"hs_object_id": primary_id}, {"hubspot_id": primary_id}]},
        {"$set": {
            "merged_from_company_ids": merge_ids,
            "last_merge_at": now
        }}
    )
    
    # Create audit log
    await db.admin_operations.insert_one({
        "operation_id": str(uuid.uuid4()),
        "operation_type": "merge_companies",
        "primary_company_id": primary_id,
        "primary_company_name": primary_name,
        "merged_company_ids": merge_ids,
        "merged_company_names": merged_company_names,
        "contacts_updated": contacts_updated,
        "run_at": now,
        "status": "completed",
        "initiated_by_user_id": current_user.get("id"),
        "initiated_by_email": current_user.get("email")
    })
    
    return {
        "success": True,
        "primary_company_id": primary_id,
        "merged_companies": len(merge_ids),
        "contacts_updated": contacts_updated,
        "message": f"Merged {len(merge_ids)} companies into {primary_name}. Updated {contacts_updated} contacts."
    }


@router.get("")
async def list_companies(
    search: Optional[str] = None,
    industry: Optional[str] = None,
    limit: int = 100,
    skip: int = 0,
    current_user: dict = Depends(get_current_user)
):
    """List companies with optional filtering from unified_companies"""
    # Build query for unified_companies (single source of truth)
    query = {"is_merged": {"$ne": True}}
    
    if search:
        safe_search = re.escape(search)
        query["name"] = {"$regex": safe_search, "$options": "i"}
    
    if industry:
        query["industry"] = industry
    
    # Get companies from unified_companies
    companies = await db.unified_companies.find(
        query,
        {"_id": 0, "id": 1, "hs_object_id": 1, "hubspot_id": 1, "name": 1, "domain": 1, "domains": 1, "industry": 1, "industry_code": 1, "classification": 1}
    ).sort("name", 1).skip(skip).limit(limit).to_list(limit)
    
    # Get total count
    total = await db.unified_companies.count_documents(query)
    
    # Ensure each company has an id field
    for c in companies:
        if not c.get("id"):
            c["id"] = c.get("hs_object_id") or c.get("hubspot_id")
    
    return {
        "companies": companies,
        "total": total,
        "limit": limit,
        "skip": skip
    }


class CreateCompanyRequest(BaseModel):
    name: str
    domain: Optional[str] = None
    industry: Optional[str] = None


@router.post("")
async def create_company(
    request: CreateCompanyRequest,
    current_user: dict = Depends(get_current_user)
):
    """Create a new company in unified_companies"""
    # Check if company with same name already exists
    existing = await db.unified_companies.find_one({
        "name": {"$regex": f"^{re.escape(request.name)}$", "$options": "i"},
        "is_merged": {"$ne": True}
    })
    
    if existing:
        return {
            "success": True,
            "company": {
                "id": existing.get("id") or existing.get("hubspot_id") or str(existing.get("hs_object_id")),
                "name": existing.get("name"),
                "domain": existing.get("domain"),
                "industry": existing.get("industry")
            },
            "created": False,
            "message": "Company already exists"
        }
    
    # Create new company in unified_companies
    now = datetime.now(timezone.utc)
    company_id = f"auto_{str(uuid.uuid4())[:8]}"
    
    new_company = {
        "id": company_id,
        "hubspot_id": company_id,
        "name": request.name,
        "domain": request.domain or "",
        "domains": [request.domain] if request.domain else [],
        "industry": request.industry or "",
        "classification": "inbound",  # Manual companies default to inbound
        "is_merged": False,
        "source": "manual",
        "created_at": now.isoformat(),
        "updated_at": now.isoformat()
    }
    
    await db.unified_companies.insert_one(new_company)
    
    return {
        "success": True,
        "company": {
            "id": company_id,
            "name": request.name,
            "domain": request.domain,
            "industry": request.industry
        },
        "created": True,
        "message": f"Company '{request.name}' created"
    }


# ============ COMPANY SEARCH (must be before /{company_id} routes) ============

@router.get("/search")
async def search_companies(
    q: str,
    limit: int = 10,
    exclude_id: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """
    Search companies by name, domain, or alias for autocomplete/merge functionality.
    Searches in unified_companies (single source of truth).
    
    Args:
        q: Search query
        limit: Max results
        exclude_id: Company ID to exclude from results (for merge - exclude current company)
    """
    if not q or len(q) < 2:
        return {"companies": []}
    
    safe_q = re.escape(q)
    search_query = {"$regex": safe_q, "$options": "i"}
    
    # Build exclusion list
    exclude_ids = []
    if exclude_id:
        exclude_ids = [exclude_id]
    
    # Search in unified_companies (single source)
    results = await db.unified_companies.find(
        {
            "is_merged": {"$ne": True},
            "$or": [
                {"name": search_query},
                {"domain": search_query},
                {"domains": search_query},
                {"aliases": search_query}
            ]
        },
        {"_id": 0, "id": 1, "hs_object_id": 1, "hubspot_id": 1, "name": 1, "domain": 1, "domains": 1, 
         "industry": 1, "industry_code": 1, "aliases": 1, "classification": 1}
    ).limit(limit * 2).to_list(limit * 2)
    
    # Process results
    seen_ids = set()
    companies = []
    
    for c in results:
        # Normalize ID
        company_id = c.get("id") or c.get("hubspot_id") or str(c.get("hs_object_id", ""))
        c["id"] = company_id
        
        # Skip if this is the excluded company
        if company_id in exclude_ids:
            continue
        
        # Skip if already seen by ID
        if company_id in seen_ids:
            continue
        
        seen_ids.add(company_id)
        companies.append(c)
        
        if len(companies) >= limit:
            break
    
    return {"companies": companies}


# ============ COMPANY NAME MIGRATION ============

@router.get("/migration/check-numeric-names")
async def check_numeric_company_names(
    current_user: dict = Depends(get_current_user)
):
    """
    Check for contacts with numeric company names (HubSpot IDs instead of names)
    """
    # Find contacts with numeric company values
    pipeline = [
        {"$match": {
            "company": {"$exists": True, "$nin": [None, ""]},
            "$expr": {"$regexMatch": {"input": "$company", "regex": "^[0-9]+$"}}
        }},
        {"$group": {
            "_id": "$company",
            "count": {"$sum": 1},
            "sample_contacts": {"$push": {"id": "$id", "name": "$name"}}
        }},
        {"$project": {
            "_id": 1,
            "count": 1,
            "sample_contacts": {"$slice": ["$sample_contacts", 3]}
        }}
    ]
    
    results = await db.unified_contacts.aggregate(pipeline).to_list(100)
    
    total_affected = sum(r["count"] for r in results)
    
    return {
        "total_numeric_company_ids": len(results),
        "total_contacts_affected": total_affected,
        "numeric_ids": [
            {
                "hubspot_company_id": r["_id"],
                "contacts_count": r["count"],
                "sample_contacts": r["sample_contacts"]
            }
            for r in results
        ]
    }


@router.post("/migration/fix-numeric-names")
async def fix_numeric_company_names(
    current_user: dict = Depends(get_current_user)
):
    """
    Fix contacts with numeric company names by looking up the real name from HubSpot companies
    """
    import logging
    logger = logging.getLogger(__name__)
    
    # Step 1: Find all unique numeric company IDs in contacts
    pipeline = [
        {"$match": {
            "company": {"$exists": True, "$nin": [None, ""]},
            "$expr": {"$regexMatch": {"input": "$company", "regex": "^[0-9]+$"}}
        }},
        {"$group": {"_id": "$company"}}
    ]
    
    numeric_ids = await db.unified_contacts.aggregate(pipeline).to_list(1000)
    numeric_id_list = [r["_id"] for r in numeric_ids]
    
    if not numeric_id_list:
        return {
            "success": True,
            "message": "No numeric company IDs found",
            "fixed": 0,
            "not_found": 0
        }
    
    logger.info(f"Found {len(numeric_id_list)} unique numeric company IDs to fix")
    
    # Step 2: Look up each ID in unified_companies
    fixed_count = 0
    not_found_count = 0
    not_found_ids = []
    
    for company_id in numeric_id_list:
        # Try to find in unified_companies (single source)
        company = await db.unified_companies.find_one({
            "$or": [
                {"hs_object_id": company_id},
                {"hs_object_id": int(company_id) if company_id.isdigit() else company_id},
                {"hubspot_id": company_id},
                {"id": company_id}
            ]
        })
        
        if company and company.get("name"):
            real_name = company["name"]
            logger.info(f"Found name for ID {company_id}: {real_name}")
            
            # Update all contacts with this numeric ID
            result = await db.unified_contacts.update_many(
                {"company": company_id},
                {"$set": {
                    "company": real_name,
                    "company_hubspot_id": company_id,
                    "updated_at": datetime.now(timezone.utc).isoformat()
                }}
            )
            fixed_count += result.modified_count
        else:
            logger.warning(f"Company not found for ID: {company_id}")
            not_found_count += 1
            not_found_ids.append(company_id)
    
    return {
        "success": True,
        "message": f"Migration complete. Fixed {fixed_count} contacts, {not_found_count} IDs not found.",
        "fixed": fixed_count,
        "not_found": not_found_count,
        "not_found_ids": not_found_ids[:20]  # Limit to first 20
    }


@router.post("/migration/manual-name-fix")
async def manual_fix_company_name(
    company_id: str,
    new_name: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Manually fix a specific numeric company ID with a provided name
    """
    if not new_name or not new_name.strip():
        raise HTTPException(status_code=400, detail="New name is required")
    
    # Update all contacts with this company ID
    result = await db.unified_contacts.update_many(
        {"company": company_id},
        {"$set": {
            "company": new_name.strip(),
            "company_hubspot_id": company_id,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    # Also update cases if they use company_name
    cases_result = await db.cases.update_many(
        {"company_name": company_id},
        {"$set": {
            "company_name": new_name.strip(),
            "company_hubspot_id": company_id,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    return {
        "success": True,
        "company_id": company_id,
        "new_name": new_name.strip(),
        "contacts_updated": result.modified_count,
        "cases_updated": cases_result.modified_count
    }



# ============ COMPANY DETAIL & EDIT ============

class UpdateCompanyRequest(BaseModel):
    name: Optional[str] = None
    domain: Optional[str] = None
    domains: Optional[List[str]] = None  # Multiple domains support
    industry: Optional[str] = None
    industries: Optional[List[str]] = None  # Multiple industries support
    description: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    country: Optional[str] = None
    linkedin_url: Optional[str] = None
    website: Optional[str] = None
    notes: Optional[str] = None
    is_active: Optional[bool] = None
    aliases: Optional[List[str]] = None  # Alias support for future


def normalize_domain(url: str) -> str:
    """
    Normalize a domain/URL:
    - Remove http://, https:// 
    - Remove www. prefix
    - Remove paths/directories
    - Keep subdomains (except www)
    """
    if not url:
        return ""
    
    url = url.strip().lower()
    
    # Remove protocol
    for prefix in ['https://', 'http://']:
        if url.startswith(prefix):
            url = url[len(prefix):]
            break
    
    # Remove path (keep only host)
    url = url.split('/')[0]
    
    # Remove www. prefix
    if url.startswith('www.'):
        url = url[4:]
    
    return url


@router.get("/{company_id}/detail")
async def get_company_detail(
    company_id: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Get complete company details including associated contacts and cases
    """
    # Find company in unified_companies (single source of truth)
    company = await db.unified_companies.find_one(
        {"$or": [
            {"id": company_id},
            {"hs_object_id": company_id},
            {"hs_object_id": int(company_id) if company_id.isdigit() else company_id},
            {"hubspot_id": company_id}
        ], "is_merged": {"$ne": True}},
        {"_id": 0}
    )
    
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    
    company_name = company.get("name", "")
    
    # Get count of associated contacts first
    contacts_count = 0
    if company_name:
        contacts_count = await db.unified_contacts.count_documents(
            {"company": {"$regex": f"^{re.escape(company_name)}$", "$options": "i"}}
        )
    
    # Get associated contacts (no practical limit - up to 100k)
    contacts = []
    if company_name:
        contacts = await db.unified_contacts.find(
            {"company": {"$regex": f"^{re.escape(company_name)}$", "$options": "i"}},
            {"_id": 0, "id": 1, "name": 1, "email": 1, "phone": 1, "job_title": 1, 
             "stage": 1, "roles": 1, "buyer_persona": 1}
        ).sort("name", 1).to_list(100000)
    
    # Get count of associated WON cases (Stage 4 = delivery_stage exists, or Stage 5)
    # Search in company_name, company_names array, AND in case name/title
    cases_count = 0
    if company_name:
        cases_count = await db.cases.count_documents({
            "$and": [
                # Stage 4 (delivery) or Stage 5
                {"$or": [
                    {"delivery_stage": {"$exists": True, "$ne": ""}},
                    {"stage": 5}
                ]},
                # Match company name
                {"$or": [
                    {"company_name": {"$regex": f"^{re.escape(company_name)}$", "$options": "i"}},
                    {"company_names": {"$elemMatch": {"$regex": f"^{re.escape(company_name)}$", "$options": "i"}}},
                    {"name": {"$regex": re.escape(company_name), "$options": "i"}}
                ]}
            ]
        })
    
    # Get associated cases (all stages, no practical limit)
    # Search in company_name, company_names, AND case name
    cases = []
    if company_name:
        cases = await db.cases.find(
            {"$or": [
                {"company_name": {"$regex": f"^{re.escape(company_name)}$", "$options": "i"}},
                {"company_names": {"$elemMatch": {"$regex": f"^{re.escape(company_name)}$", "$options": "i"}}},
                {"name": {"$regex": re.escape(company_name), "$options": "i"}}
            ]},
            {"_id": 0, "id": 1, "name": 1, "stage": 1, "status": 1, "amount": 1, 
             "delivery_stage": 1, "created_at": 1}
        ).sort("created_at", -1).to_list(100000)
    
    # Get LinkedIn searches if active company
    searches = []
    if company.get("id"):
        searches = await db.linkedin_searches.find(
            {"company_id": company.get("id")},
            {"_id": 0}
        ).to_list(50)
    
    return {
        "company": company,
        "contacts": contacts,
        "cases": cases,
        "searches": searches,
        "stats": {
            "total_contacts": contacts_count,
            "total_cases": cases_count,
            "total_searches": len(searches),
            "contacts_by_stage": _count_by_field(contacts, "stage"),
            "cases_by_status": _count_by_field(cases, "status"),
            "contacts_displayed": len(contacts),
            "cases_displayed": len(cases)
        }
    }


def _count_by_field(items: list, field: str) -> dict:
    """Helper to count items by a field value"""
    counts = {}
    for item in items:
        value = item.get(field)
        if value is not None:
            key = str(value)
            counts[key] = counts.get(key, 0) + 1
    return counts


@router.put("/{company_id}")
async def update_company(
    company_id: str,
    request: UpdateCompanyRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Update company details. Also updates the company name in all associated contacts and cases.
    """
    # Find company in unified_companies (single source)
    company = await db.unified_companies.find_one({
        "$or": [
            {"id": company_id},
            {"hs_object_id": company_id},
            {"hs_object_id": int(company_id) if company_id.isdigit() else company_id},
            {"hubspot_id": company_id}
        ]
    })
    
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    
    now = datetime.now(timezone.utc).isoformat()
    old_name = company.get("name", "")
    
    # Build update data (only include provided fields)
    update_data = {"updated_at": now}
    
    if request.name is not None:
        update_data["name"] = request.name.strip()
    if request.domain is not None:
        update_data["domain"] = normalize_domain(request.domain)
    if request.domains is not None:
        # Normalize and deduplicate domains
        normalized = list(set(normalize_domain(d) for d in request.domains if d.strip()))
        update_data["domains"] = normalized
        # Keep primary domain as first one or existing domain
        if normalized and not request.domain:
            update_data["domain"] = normalized[0]
    if request.industry is not None:
        update_data["industry"] = request.industry.strip()
    if request.industries is not None:
        # Deduplicate industries
        update_data["industries"] = list(set(i.strip() for i in request.industries if i.strip()))
        # Keep primary industry as first one
        if update_data["industries"] and not request.industry:
            update_data["industry"] = update_data["industries"][0]
    if request.description is not None:
        update_data["description"] = request.description.strip()
    if request.phone is not None:
        update_data["phone"] = request.phone.strip()
    if request.address is not None:
        update_data["address"] = request.address.strip()
    if request.city is not None:
        update_data["city"] = request.city.strip()
    if request.country is not None:
        update_data["country"] = request.country.strip()
    if request.linkedin_url is not None:
        update_data["linkedin_url"] = request.linkedin_url.strip()
    if request.website is not None:
        update_data["website"] = request.website.strip()
    if request.notes is not None:
        update_data["notes"] = request.notes.strip()
    if request.is_active is not None:
        update_data["is_active"] = request.is_active
    if request.aliases is not None:
        update_data["aliases"] = list(set(a.strip() for a in request.aliases if a.strip()))
    
    # Update company in unified_companies
    await db.unified_companies.update_one(
        {"$or": [
            {"id": company_id},
            {"hs_object_id": company_id},
            {"hubspot_id": company_id}
        ]},
        {"$set": update_data}
    )
    
    # If name changed, update all related contacts and cases
    contacts_updated = 0
    cases_updated = 0
    
    new_name = request.name.strip() if request.name else old_name
    
    if request.name and old_name and new_name != old_name:
        # Update contacts
        result = await db.unified_contacts.update_many(
            {"company": {"$regex": f"^{re.escape(old_name)}$", "$options": "i"}},
            {"$set": {"company": new_name, "updated_at": now}}
        )
        contacts_updated = result.modified_count
        
        # Update cases
        result = await db.cases.update_many(
            {"company_name": {"$regex": f"^{re.escape(old_name)}$", "$options": "i"}},
            {"$set": {"company_name": new_name, "updated_at": now}}
        )
        cases_updated = result.modified_count
    
    return {
        "success": True,
        "company_id": company_id,
        "old_name": old_name,
        "new_name": new_name,
        "contacts_updated": contacts_updated,
        "cases_updated": cases_updated
    }


@router.get("/by-name/{company_name}")
async def get_company_by_name(
    company_name: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Get company details by name from unified_companies
    """
    # Search in unified_companies (single source)
    company = await db.unified_companies.find_one(
        {"name": {"$regex": f"^{re.escape(company_name)}$", "$options": "i"}, "is_merged": {"$ne": True}},
        {"_id": 0}
    )
    
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    
    # Get company ID for detail lookup
    company_id = company.get("id") or company.get("hubspot_id") or str(company.get("hs_object_id", ""))
    
    if company_id:
        # Use the detail endpoint logic
        return await get_company_detail(company_id, current_user)
    
    return {"company": company, "contacts": [], "cases": [], "searches": [], "stats": {}}



# ============ CONTACT ASSOCIATION ENDPOINTS ============

@router.post("/{company_id}/contacts/{contact_id}")
async def associate_contact_with_company_endpoint(
    company_id: str,
    contact_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Associate a contact with a company"""
    from datetime import datetime, timezone
    now = datetime.now(timezone.utc).isoformat()
    
    # Find the company in unified_companies first (canonical source)
    company = await db.unified_companies.find_one(
        {"$or": [
            {"id": company_id}, 
            {"hubspot_id": company_id},
            {"name": {"$regex": f"^{re.escape(company_id)}$", "$options": "i"}}
        ], "is_merged": {"$ne": True}},
        {"_id": 0, "name": 1, "id": 1, "hubspot_id": 1}
    )
    
    if not company:
        raise HTTPException(status_code=404, detail="Empresa no encontrada")
    
    # Find the contact
    contact = await db.unified_contacts.find_one({"id": contact_id}, {"_id": 0, "id": 1, "name": 1})
    if not contact:
        raise HTTPException(status_code=404, detail="Contacto no encontrado")
    
    company_name = company.get("name", "")
    company_id_to_use = company.get("id") or company.get("hubspot_id")
    
    # Update the contact with the company association
    await db.unified_contacts.update_one(
        {"id": contact_id},
        {
            "$set": {
                "company": company_name,
                "company_id": company_id_to_use,
                "updated_at": now
            },
            "$addToSet": {
                "companies": {
                    "company_id": company_id_to_use,
                    "company_name": company_name,
                    "is_primary": True
                }
            }
        }
    )
    
    return {"success": True, "message": f"Contacto asociado a {company_name}"}


@router.delete("/{company_id}/contacts/{contact_id}")
async def disassociate_contact_from_company(
    company_id: str,
    contact_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Disassociate a contact from a company"""
    from datetime import datetime, timezone
    now = datetime.now(timezone.utc).isoformat()
    
    # Find the company to get its name - unified_companies first
    company = await db.unified_companies.find_one(
        {"$or": [
            {"id": company_id}, 
            {"hubspot_id": company_id},
            {"name": {"$regex": f"^{re.escape(company_id)}$", "$options": "i"}}
        ], "is_merged": {"$ne": True}},
        {"_id": 0, "name": 1, "id": 1, "hubspot_id": 1}
    )
    
    company_name = company.get("name", "") if company else ""
    company_id_to_use = company.get("id") or company.get("hubspot_id") if company else company_id
    
    # Update the contact to remove company association
    await db.unified_contacts.update_one(
        {"id": contact_id},
        {
            "$set": {
                "company": None,
                "company_id": None,
                "updated_at": now
            },
            "$pull": {
                "companies": {"company_id": company_id_to_use}
            }
        }
    )
    
    return {"success": True, "message": "Contacto desasociado"}


# ============ CASE ASSOCIATION ENDPOINTS ============

@router.post("/{company_id}/cases/{case_id}")
async def associate_case_with_company(
    company_id: str,
    case_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Associate a case/project with a company"""
    from datetime import datetime, timezone
    now = datetime.now(timezone.utc).isoformat()
    
    # Find the company in unified_companies
    company = await db.unified_companies.find_one(
        {"$or": [
            {"id": company_id}, 
            {"hubspot_id": company_id}, 
            {"hs_object_id": company_id},
            {"name": {"$regex": f"^{re.escape(company_id)}$", "$options": "i"}}
        ]},
        {"_id": 0, "name": 1, "id": 1, "hubspot_id": 1}
    )
    
    if not company:
        raise HTTPException(status_code=404, detail="Empresa no encontrada")
    
    # Find the case
    case = await db.cases.find_one({"id": case_id}, {"_id": 0, "id": 1, "name": 1})
    if not case:
        raise HTTPException(status_code=404, detail="Caso no encontrado")
    
    company_name = company.get("name", "")
    company_id_to_use = company.get("id") or company.get("hubspot_id")
    
    # Update the case with the company association
    await db.cases.update_one(
        {"id": case_id},
        {
            "$set": {"updated_at": now},
            "$addToSet": {
                "company_names": company_name,
                "company_ids": company_id_to_use
            }
        }
    )
    
    return {"success": True, "message": f"Caso asociado a {company_name}"}


@router.delete("/{company_id}/cases/{case_id}")
async def disassociate_case_from_company(
    company_id: str,
    case_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Disassociate a case/project from a company"""
    from datetime import datetime, timezone
    now = datetime.now(timezone.utc).isoformat()
    
    # Find the company in unified_companies
    company = await db.unified_companies.find_one(
        {"$or": [
            {"id": company_id}, 
            {"hubspot_id": company_id}, 
            {"hs_object_id": company_id},
            {"name": {"$regex": f"^{re.escape(company_id)}$", "$options": "i"}}
        ]},
        {"_id": 0, "name": 1, "id": 1, "hubspot_id": 1}
    )
    
    company_name = company.get("name", "") if company else ""
    company_id_to_use = company.get("id") or company.get("hubspot_id") if company else company_id
    
    # Update the case to remove company association
    await db.cases.update_one(
        {"id": case_id},
        {
            "$set": {"updated_at": now},
            "$pull": {
                "company_names": company_name,
                "company_ids": company_id_to_use
            }
        }
    )
    
    return {"success": True, "message": "Caso desasociado"}


# ============ COMPANY MERGE (for two companies) ============

class MergeTwoCompaniesRequest(BaseModel):
    """Request to merge two companies (primary absorbs secondary)"""
    primary_id: str
    secondary_id: str


@router.post("/merge")
async def merge_two_companies(
    request: MergeTwoCompaniesRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Merge two companies: secondary company is absorbed into primary company.
    
    Actions performed:
    - Secondary company's name is added as alias to primary
    - Secondary company's domains are merged into primary
    - Secondary company's industries are merged into primary
    - Contacts referencing secondary are updated to reference primary
    - Cases referencing secondary are updated to reference primary
    - Secondary company is marked as merged
    """
    import logging
    logger = logging.getLogger(__name__)
    
    primary_id = request.primary_id
    secondary_id = request.secondary_id
    
    if primary_id == secondary_id:
        raise HTTPException(status_code=400, detail="No se puede combinar una empresa consigo misma")
    
    now = datetime.now(timezone.utc).isoformat()
    
    # Find primary company
    primary = await _find_company_by_id(primary_id)
    if not primary:
        raise HTTPException(status_code=404, detail="Empresa principal no encontrada")
    
    # Find secondary company
    secondary = await _find_company_by_id(secondary_id)
    if not secondary:
        raise HTTPException(status_code=404, detail="Empresa secundaria no encontrada")
    
    # Check if secondary is already merged
    if secondary.get("is_merged"):
        raise HTTPException(status_code=400, detail="La empresa seleccionada ya fue combinada con otra")
    
    primary_name = primary.get("name", "")
    secondary_name = secondary.get("name", "")
    primary_collection = primary.get("_source_collection", "hubspot_companies")
    
    # Check if secondary name is already an alias of ANOTHER company
    if secondary_name:
        existing_with_alias = await db.unified_companies.find_one(
            {
                "aliases": {"$regex": f"^{re.escape(secondary_name)}$", "$options": "i"},
                "$and": [
                    {"id": {"$ne": primary_id}},
                    {"hubspot_id": {"$ne": primary_id}},
                    {"hs_object_id": {"$ne": primary_id}}
                ],
                "is_merged": {"$ne": True}
            },
            {"_id": 0, "name": 1}
        )
        if existing_with_alias:
            raise HTTPException(
                status_code=400, 
                detail=f"Este alias ya pertenece a otra empresa: {existing_with_alias.get('name')}"
            )
    
    logger.info(f"Merging '{secondary_name}' into '{primary_name}'")
    
    # Prepare update for primary company
    update_data = {"updated_at": now}
    
    # 1. Add secondary name as alias
    current_aliases = primary.get("aliases", []) or []
    if secondary_name and secondary_name.lower() not in [a.lower() for a in current_aliases]:
        current_aliases.append(secondary_name)
    # Also add secondary's aliases
    for alias in (secondary.get("aliases") or []):
        if alias and alias.lower() not in [a.lower() for a in current_aliases]:
            current_aliases.append(alias)
    update_data["aliases"] = current_aliases
    
    # 2. Merge domains
    primary_domains = set(primary.get("domains") or [])
    if primary.get("domain"):
        primary_domains.add(normalize_domain(primary["domain"]))
    secondary_domains = set(secondary.get("domains") or [])
    if secondary.get("domain"):
        secondary_domains.add(normalize_domain(secondary["domain"]))
    merged_domains = list(primary_domains | secondary_domains)
    if merged_domains:
        update_data["domains"] = merged_domains
        update_data["domain"] = merged_domains[0]  # Keep primary domain
    
    # 3. Merge industries
    primary_industries = set(primary.get("industries") or [])
    if primary.get("industry"):
        primary_industries.add(primary["industry"])
    secondary_industries = set(secondary.get("industries") or [])
    if secondary.get("industry"):
        secondary_industries.add(secondary["industry"])
    merged_industries = list(primary_industries | secondary_industries)
    if merged_industries:
        update_data["industries"] = merged_industries
        update_data["industry"] = merged_industries[0]
    
    # 4. Update primary company in unified_companies
    await db.unified_companies.update_one(
        {"$or": [
            {"id": primary_id}, 
            {"hs_object_id": primary_id},
            {"hubspot_id": primary_id}
        ]},
        {"$set": update_data}
    )
    
    # 5. Update contacts: change company name from secondary to primary
    contacts_updated = 0
    if secondary_name:
        result = await db.unified_contacts.update_many(
            {"company": {"$regex": f"^{re.escape(secondary_name)}$", "$options": "i"}},
            {"$set": {"company": primary_name, "updated_at": now}}
        )
        contacts_updated = result.modified_count
    
    # 6. Update cases: change company_name and company_names
    cases_updated = 0
    if secondary_name:
        # Update cases where secondary is the primary company_name
        result = await db.cases.update_many(
            {"company_name": {"$regex": f"^{re.escape(secondary_name)}$", "$options": "i"}},
            {"$set": {"company_name": primary_name, "updated_at": now}}
        )
        cases_updated = result.modified_count
        
        # Update company_names array - must be done in two steps to avoid MongoDB conflict
        # Step 1: Remove secondary name from company_names array
        await db.cases.update_many(
            {"company_names": {"$elemMatch": {"$regex": f"^{re.escape(secondary_name)}$", "$options": "i"}}},
            {
                "$pull": {"company_names": {"$regex": f"^{re.escape(secondary_name)}$", "$options": "i"}},
                "$set": {"updated_at": now}
            }
        )
        # Step 2: Add primary name to company_names array (if not already present)
        await db.cases.update_many(
            {"company_name": {"$regex": f"^{re.escape(primary_name)}$", "$options": "i"}},
            {
                "$addToSet": {"company_names": primary_name},
                "$set": {"updated_at": now}
            }
        )
    
    # 7. Mark secondary company as merged in unified_companies
    merge_marker = {
        "is_merged": True,
        "merged_into_company_id": primary_id,
        "merged_into_company_name": primary_name,
        "merged_at": now,
        "is_active": False
    }
    
    await db.unified_companies.update_one(
        {"$or": [
            {"id": secondary_id}, 
            {"hs_object_id": secondary_id},
            {"hubspot_id": secondary_id}
        ]},
        {"$set": merge_marker}
    )
    
    # 8. Create audit log
    await db.admin_operations.insert_one({
        "operation_id": str(uuid.uuid4()),
        "operation_type": "merge_two_companies",
        "primary_company_id": primary_id,
        "primary_company_name": primary_name,
        "secondary_company_id": secondary_id,
        "secondary_company_name": secondary_name,
        "contacts_updated": contacts_updated,
        "cases_updated": cases_updated,
        "domains_merged": merged_domains,
        "industries_merged": merged_industries,
        "aliases_after": current_aliases,
        "run_at": now,
        "status": "completed",
        "initiated_by_user_id": current_user.get("id"),
        "initiated_by_email": current_user.get("email")
    })
    
    return {
        "success": True,
        "message": f"'{secondary_name}' combinada con '{primary_name}'",
        "primary_company_id": primary_id,
        "primary_company_name": primary_name,
        "secondary_company_name": secondary_name,
        "contacts_updated": contacts_updated,
        "cases_updated": cases_updated,
        "new_aliases": current_aliases,
        "new_domains": merged_domains,
        "new_industries": merged_industries
    }


async def _find_company_by_id(company_id: str) -> Optional[dict]:
    """Helper to find a company by ID in unified_companies"""
    # Search in unified_companies (single source of truth)
    company = await db.unified_companies.find_one(
        {"$or": [
            {"id": company_id},
            {"hs_object_id": company_id},
            {"hs_object_id": int(company_id) if company_id.isdigit() else company_id},
            {"hubspot_id": company_id}
        ], "is_merged": {"$ne": True}},
        {"_id": 0}
    )
    if company:
        company["_source_collection"] = "unified_companies"
        company["id"] = company.get("id") or company.get("hubspot_id") or str(company.get("hs_object_id", ""))
        return company
    
    return None


# ============ AUTO-MERGE BY DOMAIN (Phase 8) ============

@router.get("/auto-merge/preview")
async def preview_auto_merge(
    limit: int = 20,
    current_user: dict = Depends(get_current_user)
):
    """
    Preview companies with duplicate domains that would be merged.
    Returns a list of domain groups with primary/secondary company info.
    """
    preview = await get_duplicate_domains_preview(db, limit=limit)
    
    total_companies = sum(item['company_count'] for item in preview)
    potential_merges = sum(item['company_count'] - 1 for item in preview)
    
    return {
        "duplicate_domain_groups": len(preview),
        "total_companies_affected": total_companies,
        "potential_merges": potential_merges,
        "groups": preview
    }


class AutoMergeRequest(BaseModel):
    """Request to run auto-merge"""
    max_merges: int = 50
    dry_run: bool = True


@router.post("/auto-merge/run")
async def run_domain_auto_merge(
    request: AutoMergeRequest,
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(get_current_user)
):
    """
    Run automatic domain-based company merging.
    
    - dry_run=True (default): Only preview what would be merged
    - dry_run=False: Actually perform the merges
    
    The operation runs in the background and results are logged to admin_operations.
    """
    user_id = current_user.get("id") or current_user.get("email", "unknown")
    
    if request.dry_run:
        # Dry run - execute immediately and return results
        result = await run_auto_merge(
            db,
            max_merges=request.max_merges,
            dry_run=True,
            initiated_by=user_id
        )
        return result
    else:
        # Real merge - run in background
        background_tasks.add_task(
            run_auto_merge,
            db,
            request.max_merges,
            False,
            user_id
        )
        
        return {
            "status": "started",
            "message": f"Auto-merge iniciado en segundo plano (max {request.max_merges} merges)",
            "note": "Los resultados se guardarán en admin_operations"
        }


@router.get("/auto-merge/history")
async def get_auto_merge_history(
    limit: int = 10,
    current_user: dict = Depends(get_current_user)
):
    """
    Get history of auto-merge operations.
    """
    operations = await db.admin_operations.find(
        {"operation_type": "auto_domain_merge"},
        {"_id": 0}
    ).sort("run_at", -1).limit(limit).to_list(limit)
    
    return {
        "operations": operations,
        "count": len(operations)
    }


@router.get("/auto-merge/stats")
async def get_duplicate_domain_stats(
    current_user: dict = Depends(get_current_user)
):
    """
    Get statistics about companies with duplicate domains.
    """
    duplicates = await find_duplicate_domains(db, limit=500)
    
    total_groups = len(duplicates)
    total_companies = sum(len(companies) for companies in duplicates.values())
    potential_merges = sum(len(companies) - 1 for companies in duplicates.values())
    
    # Top domains by duplicate count
    top_domains = sorted(
        [
            {"domain": domain, "count": len(companies)}
            for domain, companies in duplicates.items()
        ],
        key=lambda x: x['count'],
        reverse=True
    )[:10]
    
    return {
        "duplicate_domain_groups": total_groups,
        "total_companies_with_duplicates": total_companies,
        "potential_merges": potential_merges,
        "top_duplicate_domains": top_domains
    }


# ============================================================================
# MERGE COMPANIES SEMAPHORE & CANDIDATES
# ============================================================================

def get_iso_week_range(year: int, week: int):
    """Get start and end datetime for an ISO week."""
    from datetime import datetime, timedelta
    # ISO week 1 is the week containing the first Thursday of the year
    jan4 = datetime(year, 1, 4, tzinfo=timezone.utc)
    start_of_week1 = jan4 - timedelta(days=jan4.weekday())
    week_start = start_of_week1 + timedelta(weeks=week - 1)
    week_end = week_start + timedelta(days=7)
    return week_start, week_end


def get_current_iso_week():
    """Get current ISO year and week number."""
    now = datetime.now(timezone.utc)
    iso_cal = now.isocalendar()
    return iso_cal.year, iso_cal.week


@router.get("/merge-candidates/semaphore")
async def get_merge_candidates_semaphore(
    current_user: dict = Depends(get_current_user)
):
    """
    Get semaphore status for merge companies section.
    
    OPTIMIZED: Uses pre-computed cache for fast response.
    
    Rules:
    - Red: There are candidates "to review" and 0 reviewed this week
    - Yellow: There are candidates "to review" and >0 reviewed this week
    - Green: 0 candidates "to review"
    
    "To review" = candidates not marked as merged or dismissed (both domain and name duplicates)
    "Reviewed" = marked as merged or dismissed this week
    """
    from services.merge_candidates_cache import get_cached_counts
    
    iso_year, iso_week = get_current_iso_week()
    week_start, week_end = get_iso_week_range(iso_year, iso_week)
    
    # Get counts from pre-computed cache (fast!)
    cache_counts = await get_cached_counts(db)
    
    domain_pending = cache_counts.get("domain_count", 0)
    names_pending = cache_counts.get("name_count", 0)
    pending_count = cache_counts.get("total_count", 0)
    cache_last_updated = cache_counts.get("last_updated")
    
    # Count merges done this week from unified_companies.merged_at
    merges_this_week = await db.unified_companies.count_documents({
        "is_merged": True,
        "merged_at": {"$gte": week_start.isoformat(), "$lt": week_end.isoformat()}
    })
    
    # Count dismissed candidates this week
    dismissed_this_week = await db.merge_candidate_reviews.count_documents({
        "reviewed_at": {"$gte": week_start, "$lt": week_end}
    })
    
    total_reviewed = merges_this_week + dismissed_this_week
    
    # Determine semaphore status
    if not cache_counts.get("cache_exists"):
        status = "gray"  # Cache needs to be initialized
    elif pending_count == 0:
        status = "green"
    elif total_reviewed == 0:
        status = "red"
    else:
        status = "yellow"
    
    return {
        "status": status,
        "pending_count": pending_count,
        "domain_pending": domain_pending,
        "names_pending": names_pending,
        "reviewed_this_week": total_reviewed,
        "merges_this_week": merges_this_week,
        "dismissed_this_week": dismissed_this_week,
        "iso_year": iso_year,
        "iso_week": iso_week,
        "cache_last_updated": cache_last_updated
    }


@router.get("/merge-candidates/weekly-history")
async def get_merge_candidates_weekly_history(
    current_user: dict = Depends(get_current_user)
):
    """
    Get weekly history of merge candidates review for the current year.
    Returns all weeks with activity data.
    """
    iso_year, current_week = get_current_iso_week()
    
    weeks_data = []
    
    for week_num in range(1, current_week + 1):
        week_start, week_end = get_iso_week_range(iso_year, week_num)
        
        # Count merges this week from unified_companies.merged_at
        merged = await db.unified_companies.count_documents({
            "is_merged": True,
            "merged_at": {"$gte": week_start.isoformat(), "$lt": week_end.isoformat()}
        })
        
        # Count dismissed this week
        dismissed = await db.merge_candidate_reviews.count_documents({
            "reviewed_at": {"$gte": week_start, "$lt": week_end}
        })
        
        total = merged + dismissed
        
        weeks_data.append({
            "week": week_num,
            "year": iso_year,
            "reviewed_count": total,
            "merged_count": merged,
            "dismissed_count": dismissed,
            "week_start": week_start.isoformat(),
            "week_end": week_end.isoformat()
        })
    
    return {
        "year": iso_year,
        "current_week": current_week,
        "weeks": weeks_data
    }


class DismissCandidateRequest(BaseModel):
    """Request to dismiss a merge candidate."""
    domain: str
    reason: Optional[str] = None


@router.post("/merge-candidates/dismiss")
async def dismiss_merge_candidate(
    request: DismissCandidateRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Dismiss a merge candidate (mark as reviewed without merging).
    """
    now = datetime.now(timezone.utc)
    
    review = {
        "id": str(uuid.uuid4()),
        "domain": request.domain,
        "action": "dismissed",
        "reason": request.reason,
        "reviewed_by": current_user.get("email", "unknown"),
        "reviewed_at": now,
        "created_at": now
    }
    
    await db.merge_candidate_reviews.insert_one(review)
    
    return {
        "success": True,
        "message": f"Candidate {request.domain} dismissed"
    }


@router.get("/merge-candidates/dismissed")
async def get_dismissed_candidates(
    limit: int = 100,
    current_user: dict = Depends(get_current_user)
):
    """
    Get list of dismissed merge candidates.
    """
    dismissed = await db.merge_candidate_reviews.find(
        {"action": "dismissed"},
        {"_id": 0}
    ).sort("reviewed_at", -1).limit(limit).to_list(limit)
    
    return {
        "dismissed": dismissed,
        "total": len(dismissed)
    }


@router.get("/merge-candidates/similar-names")
async def get_similar_name_candidates(
    limit: int = 50,
    min_similarity: int = 80,
    current_user: dict = Depends(get_current_user)
):
    """
    Get companies with similar names that might be duplicates.
    
    OPTIMIZED: Uses pre-computed cache for fast response.
    Falls back to live calculation only if cache is empty.
    
    Parameters:
    - limit: Maximum number of groups to return
    - min_similarity: Minimum similarity score (0-100) for fuzzy matches (only used for live fallback)
    """
    from services.merge_candidates_cache import get_cached_name_candidates
    
    # Try to get from cache first (fast!)
    candidates = await get_cached_name_candidates(db, limit=limit)
    
    if candidates:
        # Filter by similarity if needed
        if min_similarity > 80:
            candidates = [c for c in candidates if c.get('similarity_score', 100) >= min_similarity]
        
        return {
            "groups": candidates[:limit],
            "total": len(candidates[:limit]),
            "from_cache": True
        }
    
    # Fallback to live calculation if cache is empty (slower but works)
    from services.company_auto_merge import find_similar_names
    
    groups = await find_similar_names(db, limit=limit, min_similarity=min_similarity)
    
    # Transform to frontend-friendly format
    result_candidates = []
    for group in groups:
        companies = group.get('companies', [])
        if len(companies) < 2:
            continue
        
        # Sort by completeness (prefer ones with hubspot_id)
        sorted_companies = sorted(
            companies,
            key=lambda c: (1 if c.get('hubspot_id') else 0, len(c.get('domains', []))),
            reverse=True
        )
        
        primary = sorted_companies[0]
        secondaries = sorted_companies[1:]
        
        result_candidates.append({
            "normalized_name": group.get('normalized_name'),
            "match_type": group.get('match_type'),
            "similarity_score": group.get('similarity_score'),
            "company_count": len(companies),
            "primary": {
                "id": primary.get('id') or primary.get('hubspot_id'),
                "name": primary.get('name'),
                "domain": primary.get('domain'),
                "domains": primary.get('domains', [])
            },
            "secondaries": [
                {
                    "id": s.get('id') or s.get('hubspot_id'),
                    "name": s.get('name'),
                    "domain": s.get('domain'),
                    "score": group.get('similarity_score')
                }
                for s in secondaries
            ]
        })
    
    return {
        "groups": result_candidates,
        "total": len(result_candidates),
        "from_cache": False
    }


# ============================================================================
# CACHE MANAGEMENT ENDPOINTS
# ============================================================================

@router.post("/merge-candidates/refresh-cache")
async def refresh_merge_candidates_cache_endpoint(
    background_tasks: BackgroundTasks,
    run_sync: bool = False,
    current_user: dict = Depends(get_current_user)
):
    """
    Refresh the merge candidates cache.
    
    This is an expensive operation that pre-computes all duplicate domain
    and similar name candidates. Should be run:
    - After major data imports
    - Periodically (e.g., daily or weekly)
    - When cache is empty (gray semaphore)
    
    Parameters:
    - run_sync: If True, run synchronously and wait for result. 
                If False (default), run in background.
    """
    from services.merge_candidates_cache import refresh_merge_candidates_cache
    
    if run_sync:
        # Run synchronously (for testing or admin use)
        result = await refresh_merge_candidates_cache(db)
        return result
    else:
        # Run in background
        background_tasks.add_task(refresh_merge_candidates_cache, db)
        return {
            "status": "started",
            "message": "Cache refresh started in background. Check /merge-candidates/cache-status for progress."
        }


@router.get("/merge-candidates/cache-status")
async def get_merge_candidates_cache_status(
    current_user: dict = Depends(get_current_user)
):
    """
    Get the current status of the merge candidates cache.
    """
    from services.merge_candidates_cache import get_cached_counts
    
    cache_counts = await get_cached_counts(db)
    
    return {
        "cache_exists": cache_counts.get("cache_exists", False),
        "domain_count": cache_counts.get("domain_count", 0),
        "name_count": cache_counts.get("name_count", 0),
        "total_count": cache_counts.get("total_count", 0),
        "last_updated": cache_counts.get("last_updated"),
        "needs_refresh": not cache_counts.get("cache_exists", False)
    }


@router.get("/merge-candidates/domain-duplicates")
async def get_domain_duplicate_candidates(
    limit: int = 50,
    current_user: dict = Depends(get_current_user)
):
    """
    Get companies with duplicate domains that might need merging.
    
    OPTIMIZED: Uses pre-computed cache for fast response.
    """
    from services.merge_candidates_cache import get_cached_domain_candidates
    
    # Try to get from cache first (fast!)
    candidates = await get_cached_domain_candidates(db, limit=limit)
    
    if candidates:
        return {
            "groups": candidates[:limit],
            "total": len(candidates[:limit]),
            "from_cache": True
        }
    
    # Fallback to live calculation if cache is empty
    duplicates = await find_duplicate_domains(db, limit=limit)
    
    # Transform to same format as cache
    result_candidates = []
    for domain, companies in list(duplicates.items())[:limit]:
        if len(companies) < 2:
            continue
        
        sorted_companies = sorted(
            companies,
            key=lambda c: (
                1 if c.get('hs_object_id') else 0,
                len(c.get('domains', []))
            ),
            reverse=True
        )
        
        primary = sorted_companies[0]
        secondaries = sorted_companies[1:]
        
        result_candidates.append({
            "type": "domain",
            "domain": domain,
            "company_count": len(companies),
            "primary": {
                "id": primary.get('_company_id'),
                "name": primary.get('name'),
                "domain": primary.get('domain'),
                "domains": primary.get('domains', [])
            },
            "secondaries": [
                {
                    "id": s.get('_company_id'),
                    "name": s.get('name'),
                    "domain": s.get('domain')
                }
                for s in secondaries
            ]
        })
    
    return {
        "groups": result_candidates,
        "total": len(result_candidates),
        "from_cache": False
    }

