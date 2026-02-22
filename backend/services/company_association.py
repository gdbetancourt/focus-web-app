"""
Company Association Service - Automatic company matching and creation for contacts

This service provides functionality to:
1. Find existing companies by name, alias, or normalized domain
2. Create new (inactive) companies when no match is found
3. Associate contacts with companies automatically
"""
import re
import uuid
import logging
from datetime import datetime, timezone
from typing import Optional, Tuple

logger = logging.getLogger(__name__)


def normalize_company_name(name: str) -> str:
    """
    Normalize a company name for matching:
    - Convert to lowercase
    - Remove common suffixes (S.A., S.A. de C.V., Inc., LLC, etc.)
    - Remove extra whitespace
    """
    if not name:
        return ""
    
    normalized = name.strip().lower()
    
    # Remove common company suffixes (Spanish and English)
    suffixes = [
        r'\s*,?\s*s\.?\s*a\.?\s*de\s*c\.?\s*v\.?\s*$',  # S.A. de C.V.
        r'\s*,?\s*s\.?\s*de\s*r\.?\s*l\.?\s*$',         # S. de R.L.
        r'\s*,?\s*s\.?\s*a\.?\s*$',                      # S.A.
        r'\s*,?\s*s\.?\s*c\.?\s*$',                      # S.C.
        r'\s*,?\s*inc\.?\s*$',                           # Inc.
        r'\s*,?\s*llc\.?\s*$',                           # LLC
        r'\s*,?\s*ltd\.?\s*$',                           # Ltd.
        r'\s*,?\s*corp\.?\s*$',                          # Corp.
        r'\s*,?\s*corporation\s*$',                      # Corporation
    ]
    
    for suffix in suffixes:
        normalized = re.sub(suffix, '', normalized, flags=re.IGNORECASE)
    
    # Remove extra whitespace
    normalized = ' '.join(normalized.split())
    
    return normalized


def extract_domain_from_email(email: str) -> Optional[str]:
    """Extract and normalize domain from email address"""
    if not email or '@' not in email:
        return None
    
    domain = email.split('@')[1].lower().strip()
    
    # Skip common email providers
    common_providers = {
        'gmail.com', 'hotmail.com', 'outlook.com', 'yahoo.com', 'live.com',
        'icloud.com', 'me.com', 'protonmail.com', 'mail.com', 'aol.com',
        'gmx.com', 'zoho.com', 'yandex.com', 'inbox.com', 'fastmail.com'
    }
    
    if domain in common_providers:
        return None
    
    return domain


async def find_company_by_name_or_alias(db, company_name: str) -> Optional[dict]:
    """
    Find a company by exact name match or alias match.
    Returns the company document if found, None otherwise.
    Uses unified_companies as the canonical source.
    """
    if not company_name:
        return None
    
    normalized_name = normalize_company_name(company_name)
    
    # First, try exact name match (case-insensitive) in unified_companies
    safe_name = re.escape(company_name)
    query = {
        "is_merged": {"$ne": True},
        "$or": [
            {"name": {"$regex": f"^{safe_name}$", "$options": "i"}},
            {"normalized_name": {"$regex": f"^{re.escape(normalized_name)}$", "$options": "i"}},
        ]
    }
    
    # Search in unified_companies (canonical source)
    company = await db.unified_companies.find_one(query, {"_id": 0})
    if company:
        company["_source"] = "unified_companies"
        return company
    
    # Second, try alias match in unified_companies
    alias_query = {
        "is_merged": {"$ne": True},
        "aliases": {"$regex": f"^{safe_name}$", "$options": "i"}
    }
    
    company = await db.unified_companies.find_one(alias_query, {"_id": 0})
    if company:
        company["_source"] = "unified_companies"
        return company
    
    return None


async def find_company_by_domain(db, domain: str) -> Optional[dict]:
    """
    Find a company by domain match in unified_companies.
    Searches in domain field and domains array.
    """
    if not domain:
        return None
    
    # Normalize domain (remove www.)
    normalized_domain = domain.lower().strip()
    if normalized_domain.startswith('www.'):
        normalized_domain = normalized_domain[4:]
    
    safe_domain = re.escape(normalized_domain)
    
    domain_query = {
        "is_merged": {"$ne": True},
        "$or": [
            {"domain": {"$regex": f"^(www\\.)?{safe_domain}$", "$options": "i"}},
            {"domains": {"$elemMatch": {"$regex": f"^(www\\.)?{safe_domain}$", "$options": "i"}}}
        ]
    }
    
    company = await db.unified_companies.find_one(domain_query, {"_id": 0})
    if company:
        company["_source"] = "unified_companies"
        return company
    
    return None


async def create_inactive_company(db, name: str, domain: Optional[str] = None) -> dict:
    """
    Create a new company in unified_companies.
    New companies are created as inbound by default.
    """
    now = datetime.now(timezone.utc).isoformat()
    company_id = str(uuid.uuid4())
    
    new_company = {
        "id": company_id,
        "name": name,
        "normalized_name": normalize_company_name(name),
        "domain": domain or "",
        "domains": [domain] if domain else [],
        "industry": "",
        "industries": [],
        "aliases": [],
        "classification": "inbound",  # Default to inbound
        "is_merged": False,
        "_legacy_sources": ["auto_created"],
        "created_at": now,
        "updated_at": now
    }
    
    # Insert into unified_companies (canonical collection)
    await db.unified_companies.insert_one(new_company)
    
    logger.info(f"Created company in unified_companies: {name} (ID: {company_id})")
    
    # Return without _id
    new_company.pop("_id", None)
    return new_company


async def associate_contact_with_company(
    db,
    company_name: str,
    contact_email: Optional[str] = None,
    auto_create: bool = True
) -> Tuple[Optional[str], Optional[str], bool]:
    """
    Find or create a company for a contact and return association data.
    
    Args:
        db: Database connection
        company_name: The company name from the contact
        contact_email: Optional email to extract domain for matching
        auto_create: Whether to create a new company if not found
    
    Returns:
        Tuple of (company_id, company_name, was_created)
        - company_id: The ID of the found/created company (or None)
        - company_name: The canonical company name (or original if not found)
        - was_created: True if a new company was created
    """
    if not company_name or not company_name.strip():
        return None, None, False
    
    company_name = company_name.strip()
    
    # Step 1: Try to find by name or alias
    company = await find_company_by_name_or_alias(db, company_name)
    
    if company:
        company_id = company.get("id") or company.get("hubspot_id") or str(company.get("hs_object_id", ""))
        canonical_name = company.get("name", company_name)
        logger.info(f"Found existing company '{canonical_name}' for contact company '{company_name}'")
        return company_id, canonical_name, False
    
    # Step 2: Try to find by email domain
    if contact_email:
        domain = extract_domain_from_email(contact_email)
        if domain:
            company = await find_company_by_domain(db, domain)
            if company:
                company_id = company.get("id") or company.get("hubspot_id") or str(company.get("hs_object_id", ""))
                canonical_name = company.get("name", company_name)
                logger.info(f"Found company '{canonical_name}' by email domain '{domain}'")
                return company_id, canonical_name, False
    
    # Step 3: Create new inactive company if auto_create is enabled
    if auto_create:
        domain = extract_domain_from_email(contact_email) if contact_email else None
        new_company = await create_inactive_company(db, company_name, domain)
        logger.info(f"Created new inactive company '{company_name}'")
        return new_company["id"], company_name, True
    
    # No company found and auto_create is disabled
    return None, company_name, False


async def find_company_by_email_domain(db, contact_email: str) -> Optional[dict]:
    """
    Find a company by matching the email domain.
    Used when a contact has an email but no company name.
    
    Returns company info with id, name, and classification if found, None otherwise.
    """
    if not contact_email:
        return None
    
    domain = extract_domain_from_email(contact_email)
    if not domain:
        return None
    
    company = await find_company_by_domain(db, domain)
    if company:
        company_id = company.get("id") or company.get("hubspot_id") or str(company.get("hs_object_id", ""))
        return {
            "company_id": company_id,
            "company_name": company.get("name", ""),
            "classification": company.get("classification", "inbound")
        }
    
    return None
