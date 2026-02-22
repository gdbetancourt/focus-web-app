"""
Global Search Router - Search across all entities
"""
from fastapi import APIRouter, Depends, Query
from typing import Optional, List
from database import db
from routers.auth import get_current_user
import re

router = APIRouter(prefix="/search", tags=["search"])


def normalize_phone(phone: str) -> str:
    """Extract only digits from phone number for comparison"""
    if not phone:
        return ""
    return re.sub(r'\D', '', phone)


@router.get("/global")
async def global_search(
    q: str = Query(..., min_length=2, description="Search query"),
    limit: int = Query(20, ge=1, le=100),
    current_user: dict = Depends(get_current_user)
):
    """
    Global search across all entities:
    - Companies
    - Contacts (unified_contacts) - by name, email, phone (normalized), company, job_title
    - Small Businesses
    - Opportunities
    - Keywords
    """
    results = {
        "query": q,
        "contacts": [],
        "companies": [],
        "small_businesses": [],
        "opportunities": [],
        "keywords": [],
        "total": 0
    }
    
    # Create case-insensitive regex pattern
    pattern = {"$regex": re.escape(q), "$options": "i"}
    
    # Normalize query for phone search (extract digits only)
    normalized_query = normalize_phone(q)
    
    # Build contact search conditions
    contact_conditions = [
        {"name": pattern},
        {"email": pattern},
        {"emails": pattern},  # Search in emails array
        {"company": pattern},
        {"job_title": pattern},
        {"linkedin_url": pattern},
        {"location": pattern}
    ]
    
    # Add phone search if query has digits (at least 3 digits for phone search)
    if len(normalized_query) >= 3:
        phone_pattern = {"$regex": normalized_query, "$options": "i"}
        contact_conditions.extend([
            {"phone": phone_pattern},
            {"phones": phone_pattern},  # Search in phones array
        ])
    
    # Search in unified_contacts
    contacts = await db.unified_contacts.find(
        {"$or": contact_conditions},
        {"_id": 0, "id": 1, "name": 1, "email": 1, "phone": 1, "company": 1, "job_title": 1, "stage": 1, "linkedin_url": 1}
    ).limit(limit).to_list(limit)
    results["contacts"] = contacts
    
    # Search in unified_companies (canonical source)
    companies = await db.unified_companies.find(
        {"$or": [
            {"name": pattern},
            {"domain": pattern},
            {"industry": pattern},
            {"aliases": pattern},  # Also search in aliases
            {"normalized_name": pattern}
        ],
        "is_merged": {"$ne": True}  # Exclude merged companies
        },
        {"_id": 0, "id": 1, "hubspot_id": 1, "name": 1, "domain": 1, "industry": 1, "classification": 1, "aliases": 1}
    ).limit(limit).to_list(limit)
    results["companies"] = companies
    
    # Search in small_businesses
    small_businesses = await db.small_businesses.find(
        {"$or": [
            {"name": pattern},
            {"address": pattern},
            {"phone": pattern},
            {"city": pattern}
        ]},
        {"_id": 0, "id": 1, "name": 1, "address": 1, "phone": 1, "city": 1}
    ).limit(limit).to_list(limit)
    results["small_businesses"] = small_businesses
    
    # Search in scraper_opportunities
    opportunities = await db.scraper_opportunities.find(
        {"$or": [
            {"author_name": pattern},
            {"company": pattern},
            {"post_content": pattern},
            {"keyword_matched": pattern}
        ]},
        {"_id": 0, "id": 1, "author_name": 1, "company": 1, "keyword_matched": 1, "status": 1}
    ).limit(limit).to_list(limit)
    results["opportunities"] = opportunities
    
    # Search in scraper_keywords
    keywords = await db.scraper_keywords.find(
        {"keyword": pattern},
        {"_id": 0, "id": 1, "keyword": 1, "category": 1, "active": 1}
    ).limit(limit).to_list(limit)
    results["keywords"] = keywords
    
    # Calculate total
    results["total"] = (
        len(results["contacts"]) + 
        len(results["companies"]) + 
        len(results["small_businesses"]) + 
        len(results["opportunities"]) + 
        len(results["keywords"])
    )
    
    return results
