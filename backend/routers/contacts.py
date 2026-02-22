"""
Unified Contacts Router - Single source of truth for all contacts across stages
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from typing import List, Optional
from datetime import datetime, timezone
from pydantic import BaseModel
import uuid
import re
import logging

from .auth import get_current_user
from database import db
from services.company_association import associate_contact_with_company, find_company_by_email_domain

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/contacts", tags=["contacts"])

def escape_regex(text: str) -> str:
    """Escape special regex characters in search text"""
    return re.escape(text) if text else text

# ============ SCHEMA ============

class EmailEntry(BaseModel):
    """Email entry with primary flag"""
    email: str
    is_primary: bool = False

class PhoneEntry(BaseModel):
    """Phone entry with validation info"""
    raw_input: str  # Original input
    country_code: str = "+52"  # Default Mexico
    national_number: Optional[str] = None
    e164: Optional[str] = None  # Normalized E.164 format
    label: str = "mobile"  # mobile, work, home
    is_primary: bool = False
    is_valid: bool = True

class ContactTag(BaseModel):
    """Tag representing a business opportunity or search source"""
    id: str
    name: str
    type: str = "search"  # search, opportunity, manual
    created_at: str
    details: Optional[dict] = None

class CompanyAssociation(BaseModel):
    """Company association for a contact - supports multiple companies"""
    company_id: Optional[str] = None  # Reference to companies collection
    company_name: str  # Company name (denormalized for display)
    is_primary: bool = False  # Only one company can be primary

class ContactBase(BaseModel):
    """Unified contact schema with all properties"""
    id: str
    name: str
    email: Optional[str] = None  # Legacy single email (primary)
    phone: Optional[str] = None  # Legacy single phone (primary)
    
    # New multivalor fields
    emails: List[EmailEntry] = []  # Multiple emails
    phones: List[PhoneEntry] = []  # Multiple phones with validation
    
    linkedin_url: Optional[str] = None
    
    # Identity fields
    salutation: Optional[str] = None  # Tratamiento (Dr., Lic., Ing., etc.)
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    
    # Stage (1-5)
    stage: int = 1  # 1=Prospect, 2=Nurture, 3=Close, 4=Deliver, 5=Repurchase
    
    # Company info - Multiple companies support
    company: Optional[str] = None  # Legacy single company (primary)
    companies: List[CompanyAssociation] = []  # Multiple companies with primary flag
    job_title: Optional[str] = None  # Cargo
    
    # Classification
    buyer_persona: Optional[str] = None
    contact_types: List[str] = []  # deal_maker, influencer, student, advisor
    roles: List[str] = []  # Alias for contact_types
    status: str = "new"  # new, contacted, qualified, etc.
    
    # Specialty (only for Ramona persona)
    specialty: Optional[str] = None
    
    # Location
    location: Optional[str] = None
    country: Optional[str] = None  # País
    
    # Related contacts (for org chart visualization)
    related_contacts: List[dict] = []  # [{contact_id, relationship_type}]
    
    # Events participation
    events: List[dict] = []  # [{event_id, event_name, registered: bool, attended: bool, date}]
    
    # Tags for business opportunities
    tags: List[ContactTag] = []
    
    # Source tracking
    source: Optional[str] = None  # hubspot, linkedin_search, manual, import, etc.
    source_details: Optional[dict] = None
    
    # Timestamps
    created_at: str
    updated_at: Optional[str] = None
    
    # Notes
    notes: Optional[str] = None
    
    # Merge tracking
    merged_from_contact_ids: List[str] = []  # IDs of contacts merged into this one
    merged_into_contact_id: Optional[str] = None  # If this contact was merged into another
    is_merged: bool = False  # True if this contact has been merged into another

class ContactCreate(BaseModel):
    salutation: Optional[str] = None  # Tratamiento (Dr., Lic., Ing., etc.)
    title: Optional[str] = None  # Alias for salutation (legacy)
    first_name: Optional[str] = None  # Nombre
    last_name: Optional[str] = None  # Apellido
    name: Optional[str] = None  # Full name (legacy/computed)
    email: Optional[str] = None  # Primary email (legacy)
    emails: List[dict] = []  # Multiple emails [{email, is_primary}]
    phone: Optional[str] = None  # Primary phone (legacy)
    phones: List[dict] = []  # Multiple phones
    linkedin_url: Optional[str] = None
    stage: int = 1
    company: Optional[str] = None  # Legacy single company
    companies: List[dict] = []  # Multiple companies [{company_id, company_name, is_primary}]
    job_title: Optional[str] = None
    buyer_persona: Optional[str] = None
    contact_types: List[str] = []  # deal_maker, influencer, student, advisor
    roles: List[str] = []  # Alias for contact_types
    status: str = "new"  # new, contacted, qualified, rejected
    specialty: Optional[str] = None  # For Ramona persona
    location: Optional[str] = None
    country: Optional[str] = None
    tags: List[dict] = []
    notes: Optional[str] = None
    source: Optional[str] = None

class ContactUpdate(BaseModel):
    salutation: Optional[str] = None  # Tratamiento
    title: Optional[str] = None  # Alias for salutation
    first_name: Optional[str] = None  # Nombre
    last_name: Optional[str] = None  # Apellido
    name: Optional[str] = None
    email: Optional[str] = None  # Primary email
    emails: Optional[List[dict]] = None  # Multiple emails
    phone: Optional[str] = None  # Primary phone
    phones: Optional[List[dict]] = None  # Multiple phones
    linkedin_url: Optional[str] = None
    stage: Optional[int] = None
    stage_1_status: Optional[str] = None  # pending_accept, accepted, conversation_open
    linkedin_accepted_by: Optional[str] = None  # GB or MG
    company: Optional[str] = None  # Legacy single company
    companies: Optional[List[dict]] = None  # Multiple companies [{company_id, company_name, is_primary}]
    job_title: Optional[str] = None
    buyer_persona: Optional[str] = None
    specialty: Optional[str] = None  # Medical specialty (for doctors - Ramona persona)
    contact_types: Optional[List[str]] = None  # deal_maker, influencer, student, advisor
    roles: Optional[List[str]] = None  # Alias for contact_types
    related_contacts: Optional[List[dict]] = None  # [{contact_id, relationship_type}]
    status: Optional[str] = None
    location: Optional[str] = None
    country: Optional[str] = None
    notes: Optional[str] = None
    qualification_status: Optional[str] = None  # pending, qualified, discarded, postponed
    classification: Optional[str] = None  # inbound or outbound

# Contact type options
CONTACT_TYPES = ["deal_maker", "influencer", "student", "advisor"]

# Stage names for reference
STAGE_NAMES = {
    1: "Prospect",
    2: "Nurture", 
    3: "Close",
    4: "Deliver",
    5: "Repurchase"
}

# Salutation options
SALUTATION_OPTIONS = ["Dr.", "Dra.", "Lic.", "Ing.", "Mtro.", "Mtra.", "Sr.", "Sra.", ""]

# Default buyer persona for unassigned contacts
DEFAULT_BUYER_PERSONA = "mateo"
DEFAULT_BUYER_PERSONA_NAME = "Mateo"


def normalize_phone_to_e164(phone: str, default_country: str = "+52") -> dict:
    """
    Normalize phone number to E.164 format.
    Returns a PhoneEntry-compatible dict.
    """
    if not phone:
        return None
    
    raw_input = phone
    
    # Handle case where phone might be a list
    if isinstance(phone, list):
        phone = phone[0] if phone else ""
    if not isinstance(phone, str):
        return None
    
    # Remove all non-digit characters except leading +
    cleaned = re.sub(r'[^\d+]', '', phone)
    
    # Determine country code and national number
    country_code = default_country
    national_number = ""
    e164 = ""
    is_valid = False
    
    if cleaned.startswith('+'):
        # Already has country code
        digits = cleaned[1:]
        if cleaned.startswith('+52') and len(digits) >= 12:
            country_code = "+52"
            national_number = digits[2:]
            e164 = cleaned
            is_valid = len(national_number) == 10
        elif cleaned.startswith('+1') and len(digits) >= 11:
            country_code = "+1"
            national_number = digits[1:]
            e164 = cleaned
            is_valid = len(national_number) == 10
        else:
            e164 = cleaned
            is_valid = len(digits) >= 10
    elif cleaned.startswith('52') and len(cleaned) >= 12:
        country_code = "+52"
        national_number = cleaned[2:]
        e164 = f"+{cleaned}"
        is_valid = len(national_number) == 10
    elif cleaned.startswith('1') and len(cleaned) >= 11:
        country_code = "+1"
        national_number = cleaned[1:]
        e164 = f"+{cleaned}"
        is_valid = len(national_number) == 10
    elif len(cleaned) == 10:
        # Assume Mexican number
        country_code = "+52"
        national_number = cleaned
        e164 = f"+52{cleaned}"
        is_valid = True
    elif len(cleaned) > 10:
        # Might have country code without +
        e164 = f"+{cleaned}"
        is_valid = True
    else:
        e164 = f"{default_country}{cleaned}"
        is_valid = False
    
    return {
        "raw_input": raw_input,
        "country_code": country_code,
        "national_number": national_number,
        "e164": e164,
        "label": "mobile",
        "is_primary": True,
        "is_valid": is_valid
    }


def normalize_email_entry(email: str) -> dict:
    """Normalize email to EmailEntry-compatible dict."""
    if not email:
        return None
    
    # Handle case where email might be a list
    if isinstance(email, list):
        email = email[0] if email else ""
    if not isinstance(email, str):
        return None
    
    normalized = email.strip().lower()
    return {
        "email": normalized,
        "is_primary": True
    }


async def ensure_buyer_persona(contact: dict) -> dict:
    """Ensure contact has a buyer persona, assign Mateo if missing"""
    if not contact.get("buyer_persona"):
        contact["buyer_persona"] = DEFAULT_BUYER_PERSONA
    return contact


# ============ ENDPOINTS ============

@router.post("/migrate-to-new-schema")
async def migrate_contacts_to_new_schema(
    current_user: dict = Depends(get_current_user)
):
    """
    Migrate existing contacts to the new schema with multivalor fields.
    - Converts single email to emails[]
    - Converts single phone to phones[] with E.164 validation
    - Adds salutation field from title
    """
    contacts = await db.unified_contacts.find({
        "$or": [
            {"emails": {"$exists": False}},
            {"emails": []},
            {"phones": {"$exists": False}},
            {"phones": []}
        ]
    }).to_list(10000)
    
    migrated = 0
    errors = []
    
    for contact in contacts:
        try:
            update_data = {"updated_at": datetime.now(timezone.utc).isoformat()}
            
            # Migrate email to emails[]
            if not contact.get("emails") or len(contact.get("emails", [])) == 0:
                email = contact.get("email")
                if email:
                    email_entry = normalize_email_entry(email)
                    if email_entry:
                        update_data["emails"] = [email_entry]
                else:
                    update_data["emails"] = []
            
            # Migrate phone to phones[]
            if not contact.get("phones") or len(contact.get("phones", [])) == 0:
                phone = contact.get("phone")
                if phone:
                    phone_entry = normalize_phone_to_e164(phone)
                    if phone_entry:
                        update_data["phones"] = [phone_entry]
                else:
                    update_data["phones"] = []
            
            # Migrate title to salutation
            if not contact.get("salutation") and contact.get("title"):
                update_data["salutation"] = contact.get("title")
            
            # Ensure roles field exists (alias for contact_types)
            if not contact.get("roles"):
                update_data["roles"] = contact.get("contact_types", [])
            
            # Ensure merge tracking fields exist
            if "merged_from_contact_ids" not in contact:
                update_data["merged_from_contact_ids"] = []
            if "is_merged" not in contact:
                update_data["is_merged"] = False
            
            await db.unified_contacts.update_one(
                {"id": contact["id"]},
                {"$set": update_data}
            )
            migrated += 1
            
        except Exception as e:
            errors.append({"contact_id": contact.get("id"), "error": str(e)})
    
    return {
        "success": True,
        "message": f"Migrated {migrated} contacts to new schema",
        "migrated": migrated,
        "errors": errors[:10] if errors else []
    }


@router.post("/assign-mateo-global")
async def assign_mateo_to_unassigned(
    current_user: dict = Depends(get_current_user)
):
    """Assign Mateo buyer persona to all contacts without a buyer persona"""
    # Find all contacts without buyer_persona
    query = {
        "$or": [
            {"buyer_persona": None},
            {"buyer_persona": ""},
            {"buyer_persona": {"$exists": False}}
        ]
    }
    
    result = await db.unified_contacts.update_many(
        query,
        {"$set": {"buyer_persona": DEFAULT_BUYER_PERSONA}}
    )
    
    return {
        "success": True,
        "message": f"Assigned Mateo to {result.modified_count} contacts",
        "modified_count": result.modified_count
    }


@router.post("/migrate-to-multi-company")
async def migrate_contacts_to_multi_company(
    current_user: dict = Depends(get_current_user)
):
    """
    Migrate existing contacts from single company field to multi-company array.
    - Converts single company to companies[] with is_primary=True
    - Preserves the legacy company field for backward compatibility
    - Uses bulk operations for speed
    """
    from pymongo import UpdateOne
    
    # Find contacts that have company but no companies array or empty companies array
    contacts = await db.unified_contacts.find({
        "$and": [
            {"company": {"$nin": [None, ""]}},
            {"$or": [
                {"companies": {"$exists": False}},
                {"companies": []},
                {"companies": {"$size": 0}}
            ]}
        ]
    }, {"_id": 0, "id": 1, "company": 1}).to_list(50000)
    
    if not contacts:
        return {
            "success": True,
            "message": "No contacts to migrate",
            "migrated": 0,
            "total_with_company": 0,
            "errors": []
        }
    
    # Build bulk operations - simply create the company entry without looking up company IDs
    # This is much faster and company IDs can be linked later if needed
    now = datetime.now(timezone.utc).isoformat()
    bulk_ops = []
    
    for contact in contacts:
        company_name = contact.get("company", "")
        if not company_name:
            continue
        
        company_entry = {
            "company_id": None,  # Will be null initially - can be linked later
            "company_name": company_name,
            "is_primary": True
        }
        
        bulk_ops.append(UpdateOne(
            {"id": contact["id"]},
            {"$set": {
                "companies": [company_entry],
                "updated_at": now
            }}
        ))
    
    migrated = 0
    errors = []
    
    if bulk_ops:
        try:
            # Execute in batches of 1000
            batch_size = 1000
            for i in range(0, len(bulk_ops), batch_size):
                batch = bulk_ops[i:i + batch_size]
                result = await db.unified_contacts.bulk_write(batch, ordered=False)
                migrated += result.modified_count
        except Exception as e:
            errors.append({"error": str(e)})
    
    return {
        "success": True,
        "message": f"Migrated {migrated} contacts to multi-company schema",
        "migrated": migrated,
        "total_with_company": len(contacts),
        "errors": errors[:10] if errors else []
    }
    
    return {
        "success": True,
        "message": f"Migrated {migrated} contacts to multi-company schema",
        "migrated": migrated,
        "total_with_company": len(contacts),
        "errors": errors[:10] if errors else []
    }


@router.get("/search")
async def search_contacts_simple(
    q: str = Query(..., min_length=2, description="Search query"),
    limit: int = Query(10, ge=1, le=50),
    current_user: dict = Depends(get_current_user)
):
    """
    Simple search endpoint for contact autocomplete.
    Searches by name, email, phone, company, job_title.
    """
    safe_query = escape_regex(q)
    
    # Normalize phone search (extract digits)
    normalized_phone = re.sub(r'\D', '', q)
    
    search_conditions = [
        {"name": {"$regex": safe_query, "$options": "i"}},
        {"email": {"$regex": safe_query, "$options": "i"}},
        {"company": {"$regex": safe_query, "$options": "i"}},
        {"job_title": {"$regex": safe_query, "$options": "i"}},
    ]
    
    # Add phone search if there are digits
    if len(normalized_phone) >= 3:
        search_conditions.append({"phone": {"$regex": normalized_phone, "$options": "i"}})
    
    contacts = await db.unified_contacts.find(
        {"$or": search_conditions},
        {"_id": 0, "id": 1, "name": 1, "email": 1, "phone": 1, "company": 1, "job_title": 1, "stage": 1}
    ).limit(limit).to_list(limit)
    
    return {"contacts": contacts, "total": len(contacts)}


@router.get("")
async def get_contacts(
    stage: Optional[int] = None,
    buyer_persona: Optional[str] = None,
    status: Optional[str] = None,
    search: Optional[str] = None,
    tag: Optional[str] = None,
    source: Optional[str] = None,
    company: Optional[str] = None,
    companies: Optional[str] = None,  # Comma-separated list of companies
    role: Optional[str] = None,
    limit: int = 100,
    skip: int = 0,
    current_user: dict = Depends(get_current_user)
):
    """Get all contacts with optional filters"""
    query = {}
    
    if stage is not None:
        query["stage"] = stage
    if buyer_persona:
        query["buyer_persona"] = buyer_persona
    if status:
        query["status"] = status
    if tag:
        query["tags.name"] = {"$regex": tag, "$options": "i"}
    if source:
        query["source"] = {"$regex": source, "$options": "i"}
    # Build company filter
    company_filter = None
    if companies:
        # Multiple companies filter - case insensitive
        company_list = [c.strip() for c in companies.split(",") if c.strip()]
        if company_list:
            # Use $or with regex for case-insensitive matching
            company_conditions = [{"company": {"$regex": f"^{escape_regex(c)}$", "$options": "i"}} for c in company_list]
            company_filter = {"$or": company_conditions}
    elif company:
        company_filter = {"company": {"$regex": company, "$options": "i"}}
    
    if role:
        # Filter by role - check in both 'roles' and 'contact_types' arrays
        role_filter = {"$or": [
            {"roles": role},
            {"contact_types": role}
        ]}
        if company_filter:
            # Combine company and role filters
            query["$and"] = [company_filter, role_filter]
        else:
            query["$or"] = role_filter["$or"]
    elif company_filter:
        if "$or" in company_filter:
            query["$or"] = company_filter["$or"]
        else:
            query.update(company_filter)
    
    if search:
        safe_search = escape_regex(search)
        search_conditions = [
            {"name": {"$regex": safe_search, "$options": "i"}},
            {"email": {"$regex": safe_search, "$options": "i"}},
            {"company": {"$regex": safe_search, "$options": "i"}},
            {"job_title": {"$regex": safe_search, "$options": "i"}}
        ]
        search_filter = {"$or": search_conditions}
        # Combine with existing filters
        if "$and" in query:
            query["$and"].append(search_filter)
        elif "$or" in query:
            query["$and"] = [
                {"$or": query.pop("$or")},
                search_filter
            ]
        else:
            query["$or"] = search_conditions
    
    total = await db.unified_contacts.count_documents(query)
    contacts = await db.unified_contacts.find(
        query, {"_id": 0}
    ).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    
    # Count by stage - optimized single aggregation query
    stage_pipeline = [
        {"$group": {"_id": "$stage", "count": {"$sum": 1}}}
    ]
    stage_results = await db.unified_contacts.aggregate(stage_pipeline).to_list(None)
    stage_counts = {}
    for s in range(1, 6):
        count = next((r["count"] for r in stage_results if r["_id"] == s), 0)
        stage_counts[s] = {"count": count, "name": STAGE_NAMES[s]}
    
    return {
        "contacts": contacts,
        "total": total,
        "stage_counts": stage_counts
}

@router.get("/by-stage/{stage}")
async def get_contacts_by_stage(
    stage: int,
    search: Optional[str] = None,
    buyer_persona: Optional[str] = None,
    limit: int = 100,
    skip: int = 0,
    current_user: dict = Depends(get_current_user)
):
    """Get contacts for a specific stage"""
    if stage < 1 or stage > 5:
        raise HTTPException(status_code=400, detail="Stage must be between 1 and 5")
    
    query = {"stage": stage}
    
    if buyer_persona:
        query["buyer_persona"] = buyer_persona
    if search:
        safe_search = escape_regex(search)
        query["$or"] = [
            {"name": {"$regex": safe_search, "$options": "i"}},
            {"email": {"$regex": safe_search, "$options": "i"}},
            {"company": {"$regex": safe_search, "$options": "i"}}
        ]
    
    total = await db.unified_contacts.count_documents(query)
    contacts = await db.unified_contacts.find(
        query, {"_id": 0}
    ).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    
    return {
        "contacts": contacts,
        "total": total,
        "stage": stage,
        "stage_name": STAGE_NAMES[stage]
    }


@router.get("/companies")
async def get_companies(
    search: Optional[str] = None,
    limit: int = 100,
    current_user: dict = Depends(get_current_user)
):
    """Get list of unique companies from contacts with optional search"""
    match_query = {"company": {"$exists": True, "$nin": [None, ""]}}
    
    if search:
        match_query["company"] = {"$regex": search, "$options": "i"}
    
    pipeline = [
        {"$match": match_query},
        {"$group": {"_id": "$company"}},
        {"$sort": {"_id": 1}},
        {"$limit": limit}
    ]
    
    result = await db.unified_contacts.aggregate(pipeline).to_list(limit)
    companies = [r["_id"] for r in result if r["_id"]]
    
    return {"companies": companies}


@router.get("/stats")
async def get_contact_stats(current_user: dict = Depends(get_current_user)):
    """Get contact statistics across all stages"""
    total = await db.unified_contacts.count_documents({})
    
    # Get new contacts this month
    from datetime import datetime, timezone
    now = datetime.now(timezone.utc)
    first_of_month = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    new_this_month = await db.unified_contacts.count_documents({
        "created_at": {"$gte": first_of_month.isoformat()}
    })
    
    stats = {
        "total": total,
        "new_this_month": new_this_month,
        "by_stage": {},
        "by_status": {},
        "by_persona": {}
    }
    
    # Count by stage (use numeric keys for frontend compatibility)
    for s in range(1, 6):
        count = await db.unified_contacts.count_documents({"stage": s})
        stats["by_stage"][str(s)] = count
    
    # Count by status
    pipeline = [
        {"$group": {"_id": "$status", "count": {"$sum": 1}}}
    ]
    status_counts = await db.unified_contacts.aggregate(pipeline).to_list(20)
    for item in status_counts:
        stats["by_status"][item["_id"] or "unknown"] = item["count"]
    
    # Count by persona
    pipeline = [
        {"$match": {"buyer_persona": {"$ne": ""}}},
        {"$group": {"_id": "$buyer_persona", "count": {"$sum": 1}}}
    ]
    persona_counts = await db.unified_contacts.aggregate(pipeline).to_list(50)
    for item in persona_counts:
        if item["_id"]:
            stats["by_persona"][item["_id"]] = item["count"]
    
    return stats

@router.get("/sources")
async def get_contact_sources(current_user: dict = Depends(get_current_user)):
    """Get all unique sources from contacts"""
    pipeline = [
        {"$match": {"source": {"$nin": [None, ""]}}},
        {"$group": {"_id": "$source", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}}
    ]
    results = await db.unified_contacts.aggregate(pipeline).to_list(100)
    sources = [item["_id"] for item in results if item["_id"]]
    return {"sources": sources, "total": len(sources)}

@router.get("/{contact_id}")
async def get_contact(contact_id: str, current_user: dict = Depends(get_current_user)):
    """Get a single contact by ID"""
    contact = await db.unified_contacts.find_one({"id": contact_id}, {"_id": 0})
    if not contact:
        raise HTTPException(status_code=404, detail="Contact not found")
    return contact

@router.post("/")
async def create_contact(
    contact: ContactCreate,
    current_user: dict = Depends(get_current_user)
):
    """Create a new contact with duplicate check and automatic company association"""
    # Build full name from title/first/last if not provided
    first_name = contact.first_name or ""
    last_name = contact.last_name or ""
    title = contact.title or ""
    
    full_name = contact.name
    if not full_name and (first_name or last_name):
        full_name = f"{first_name} {last_name}".strip()
    
    # If only full_name provided, try to split it
    if full_name and not first_name and not last_name:
        parts = full_name.split()
        first_name = parts[0] if parts else ""
        last_name = " ".join(parts[1:]) if len(parts) > 1 else ""
    
    # Check for duplicates by LinkedIn URL or email (only if provided)
    duplicate_query = {"$or": []}
    if contact.linkedin_url:
        duplicate_query["$or"].append({"linkedin_url": contact.linkedin_url})
    if contact.email:
        duplicate_query["$or"].append({"email": contact.email})
    
    if duplicate_query["$or"]:
        existing = await db.unified_contacts.find_one(duplicate_query, {"_id": 0})
        if existing:
            raise HTTPException(
                status_code=409, 
                detail=f"Contact already exists with ID: {existing['id']}"
            )
    
    now = datetime.now(timezone.utc).isoformat()
    
    # Build companies array from legacy company field or new companies array
    companies_list = []
    company_id = None
    primary_company = contact.company
    classification = "inbound"  # Default classification
    
    if contact.companies:
        companies_list = contact.companies
        primary_company = next(
            (c.get("company_name") for c in companies_list if c.get("is_primary")),
            companies_list[0].get("company_name") if companies_list else None
        )
    elif contact.company:
        # Automatic company association - Phase 5 feature
        company_id, canonical_name, was_created = await associate_contact_with_company(
            db,
            company_name=contact.company,
            contact_email=contact.email,
            auto_create=True
        )
        
        # Use canonical company name (from existing company) if found
        primary_company = canonical_name or contact.company
        
        companies_list = [{
            "company_id": company_id,
            "company_name": primary_company,
            "is_primary": True
        }]
        
        if was_created:
            logger.info(f"Auto-created company '{primary_company}' for new contact")
    elif contact.email:
        # No company name provided, but has email - try to find company by email domain
        company_match = await find_company_by_email_domain(db, contact.email)
        if company_match:
            company_id = company_match["company_id"]
            primary_company = company_match["company_name"]
            classification = company_match["classification"]  # Inherit from company
            companies_list = [{
                "company_id": company_id,
                "company_name": primary_company,
                "is_primary": True
            }]
            logger.info(f"Auto-associated contact with company '{primary_company}' by email domain")
    
    new_contact = {
        "id": str(uuid.uuid4()),
        "title": title,  # Tratamiento
        "first_name": first_name,  # Nombre
        "last_name": last_name,  # Apellido
        "name": full_name or f"{first_name} {last_name}".strip(),  # Full name (computed)
        "email": contact.email if contact.email else None,  # Convert empty string to None to avoid unique index violation
        "phone": contact.phone if contact.phone else None,
        "linkedin_url": contact.linkedin_url,
        "stage": contact.stage,
        "classification": classification,  # Inherit from company if matched, otherwise inbound
        "company": primary_company,  # Legacy field - stores primary company name
        "company_id": company_id,  # Reference to company document
        "companies": companies_list,  # New multi-company field
        "job_title": contact.job_title,
        "buyer_persona": contact.buyer_persona or DEFAULT_BUYER_PERSONA,
        "status": contact.status or "new",
        "roles": contact.roles or contact.contact_types or [],
        "contact_types": contact.contact_types or contact.roles or [],
        "specialty": contact.specialty,
        "location": contact.location,
        "country": contact.country,
        "events": [],
        "tags": contact.tags,
        "source": contact.source or "manual",
        "source_details": {},
        "created_at": now,
        "updated_at": now,
        "notes": contact.notes
    }
    
    await db.unified_contacts.insert_one(new_contact)
    del new_contact["_id"]
    return new_contact

@router.put("/{contact_id}")
async def update_contact(
    contact_id: str,
    updates: ContactUpdate,
    current_user: dict = Depends(get_current_user)
):
    """Update a contact, or create it if it doesn't exist (upsert). Automatically associates company."""
    existing = await db.unified_contacts.find_one({"id": contact_id})
    
    update_data = {k: v for k, v in updates.dict().items() if v is not None}
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    # Sync company and companies fields with automatic association
    if "companies" in update_data:
        # Update legacy company field with primary company name
        companies_list = update_data["companies"]
        primary_company = next(
            (c.get("company_name") for c in companies_list if c.get("is_primary")),
            companies_list[0].get("company_name") if companies_list else None
        )
        update_data["company"] = primary_company
    elif "company" in update_data and update_data["company"]:
        # Automatic company association - Phase 5 feature
        contact_email = updates.email or (existing.get("email") if existing else None)
        
        company_id, canonical_name, was_created = await associate_contact_with_company(
            db,
            company_name=update_data["company"],
            contact_email=contact_email,
            auto_create=True
        )
        
        # Use canonical company name (from existing company) if different
        if canonical_name and canonical_name != update_data["company"]:
            logger.info(f"Normalized company name from '{update_data['company']}' to '{canonical_name}'")
            update_data["company"] = canonical_name
        
        # Store company_id reference
        update_data["company_id"] = company_id
        
        # Update companies array
        existing_companies = existing.get("companies", []) if existing else []
        if not existing_companies or not any(c.get("company_name", "").lower() == canonical_name.lower() for c in existing_companies):
            update_data["companies"] = [{
                "company_id": company_id,
                "company_name": canonical_name or update_data["company"],
                "is_primary": True
            }]
        
        if was_created:
            logger.info(f"Auto-created company '{canonical_name}' for contact update")
    elif "email" in update_data and update_data["email"]:
        # Email is being updated - check if we should associate by domain
        existing_company = existing.get("company") if existing else None
        existing_company_id = existing.get("company_id") if existing else None
        
        # Only auto-associate if contact doesn't have a company already
        if not existing_company and not existing_company_id:
            company_match = await find_company_by_email_domain(db, update_data["email"])
            if company_match:
                update_data["company_id"] = company_match["company_id"]
                update_data["company"] = company_match["company_name"]
                update_data["classification"] = company_match["classification"]
                update_data["companies"] = [{
                    "company_id": company_match["company_id"],
                    "company_name": company_match["company_name"],
                    "is_primary": True
                }]
                logger.info(f"Auto-associated contact with company '{company_match['company_name']}' by email domain on update")
    
    if not existing:
        # Contact doesn't exist - create it (upsert behavior)
        # This handles contacts from calendar that don't have a DB record yet
        new_contact = {
            "id": contact_id,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "status": "active",
            "source": "calendar_import",
            "stage": 1,
            "classification": "inbound",  # Default classification for upserted contacts
            **update_data
        }
        await db.unified_contacts.insert_one(new_contact)
        logger.info(f"Created new contact from upsert: {contact_id}")
        created = await db.unified_contacts.find_one({"id": contact_id}, {"_id": 0})
        return created
    
    await db.unified_contacts.update_one(
        {"id": contact_id},
        {"$set": update_data}
    )
    
    updated = await db.unified_contacts.find_one({"id": contact_id}, {"_id": 0})
    return updated

@router.put("/{contact_id}/stage")
async def update_contact_stage(
    contact_id: str,
    stage: int,
    current_user: dict = Depends(get_current_user)
):
    """Move a contact to a different stage"""
    if stage < 1 or stage > 5:
        raise HTTPException(status_code=400, detail="Stage must be between 1 and 5")
    
    existing = await db.unified_contacts.find_one({"id": contact_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Contact not found")
    
    old_stage = existing.get("stage", 1)
    
    await db.unified_contacts.update_one(
        {"id": contact_id},
        {"$set": {
            "stage": stage,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    # NOTE: Automatic Stage 4/5 → Outbound classification was REMOVED per design decision.
    # Company classification is now ONLY set via:
    # 1. Manual edit in Company Editor
    # 2. Inheritance from Industry classification
    # 3. Propagation from Industry → Company
    
    return {
        "success": True,
        "contact_id": contact_id,
        "old_stage": old_stage,
        "new_stage": stage,
        "stage_name": STAGE_NAMES[stage]
    }

@router.post("/{contact_id}/tags")
async def add_contact_tag(
    contact_id: str,
    tag_name: str,
    tag_type: str = "manual",
    details: Optional[dict] = None,
    current_user: dict = Depends(get_current_user)
):
    """Add a tag (business opportunity) to a contact"""
    existing = await db.unified_contacts.find_one({"id": contact_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Contact not found")
    
    new_tag = {
        "id": str(uuid.uuid4()),
        "name": tag_name,
        "type": tag_type,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "details": details or {}
    }
    
    await db.unified_contacts.update_one(
        {"id": contact_id},
        {
            "$push": {"tags": new_tag},
            "$set": {"updated_at": datetime.now(timezone.utc).isoformat()}
        }
    )
    
    return {"success": True, "tag": new_tag}

@router.delete("/{contact_id}/tags/{tag_id}")
async def remove_contact_tag(
    contact_id: str,
    tag_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Remove a tag from a contact"""
    result = await db.unified_contacts.update_one(
        {"id": contact_id},
        {
            "$pull": {"tags": {"id": tag_id}},
            "$set": {"updated_at": datetime.now(timezone.utc).isoformat()}
        }
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Tag not found")
    
    return {"success": True}

@router.delete("/{contact_id}")
async def delete_contact(contact_id: str, current_user: dict = Depends(get_current_user)):
    """Delete a contact"""
    result = await db.unified_contacts.delete_one({"id": contact_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Contact not found")
    return {"success": True, "deleted_id": contact_id}

@router.post("/cleanup/non-mexico")
async def cleanup_non_mexico_contacts(current_user: dict = Depends(get_current_user)):
    """Remove all contacts whose location doesn't contain 'Mexico'"""
    import re
    
    # Find all contacts that don't have Mexico in location (case insensitive)
    # But exclude 'New Mexico' as that's in US
    contacts = await db.unified_contacts.find({}, {"_id": 0, "id": 1, "name": 1, "location": 1}).to_list(10000)
    
    non_mexico_ids = []
    for c in contacts:
        location = (c.get("location") or "").lower()
        # Skip if no location
        if not location:
            continue
        # Check if Mexico is in location
        if "mexico" not in location:
            non_mexico_ids.append(c["id"])
        # Also exclude 'New Mexico' which is in US
        elif "new mexico" in location and "united states" in location:
            non_mexico_ids.append(c["id"])
    
    if non_mexico_ids:
        result = await db.unified_contacts.delete_many({"id": {"$in": non_mexico_ids}})
        return {
            "success": True, 
            "deleted_count": result.deleted_count,
            "deleted_ids": non_mexico_ids[:20],  # First 20 for reference
            "message": f"Deleted {result.deleted_count} non-Mexico contacts"
        }
    
    return {"success": True, "deleted_count": 0, "message": "No non-Mexico contacts found"}

@router.delete("/bulk")
async def delete_contacts_bulk(
    contact_ids: List[str],
    current_user: dict = Depends(get_current_user)
):
    """Delete multiple contacts at once"""
    if not contact_ids:
        raise HTTPException(status_code=400, detail="No contact IDs provided")
    
    result = await db.unified_contacts.delete_many({"id": {"$in": contact_ids}})
    return {
        "success": True, 
        "deleted_count": result.deleted_count,
        "requested_count": len(contact_ids)
    }


# ============ MERGE CONTACTS ============

class MergeContactsRequest(BaseModel):
    primary_id: str  # Contact to keep
    secondary_ids: List[str]  # Contacts to merge into primary


@router.post("/merge")
async def merge_contacts(
    request: MergeContactsRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Merge multiple contacts into one.
    The primary contact is kept, secondary contacts are merged and deleted.
    - Events from all contacts are combined
    - Tags from all contacts are combined
    - Empty fields in primary are filled from secondary contacts
    """
    primary = await db.unified_contacts.find_one({"id": request.primary_id})
    if not primary:
        raise HTTPException(status_code=404, detail="Primary contact not found")
    
    # Get all secondary contacts
    secondaries = await db.unified_contacts.find(
        {"id": {"$in": request.secondary_ids}},
        {"_id": 0}
    ).to_list(100)
    
    if not secondaries:
        raise HTTPException(status_code=404, detail="No secondary contacts found")
    
    now = datetime.now(timezone.utc).isoformat()
    
    # Merge data from secondary contacts into primary
    merged_events = list(primary.get("events", []))
    merged_tags = list(primary.get("tags", []))
    
    for secondary in secondaries:
        # Merge events (avoid duplicates by event_id)
        existing_event_ids = {e.get("event_id") for e in merged_events}
        for event in secondary.get("events", []):
            if event.get("event_id") not in existing_event_ids:
                merged_events.append(event)
                existing_event_ids.add(event.get("event_id"))
            else:
                # Update attendance if secondary has attended
                for me in merged_events:
                    if me.get("event_id") == event.get("event_id") and event.get("attended"):
                        me["attended"] = True
        
        # Merge tags (avoid duplicates by name)
        existing_tag_names = {t.get("name", "").lower() for t in merged_tags}
        for tag in secondary.get("tags", []):
            if tag.get("name", "").lower() not in existing_tag_names:
                merged_tags.append(tag)
                existing_tag_names.add(tag.get("name", "").lower())
        
        # Fill empty fields in primary from secondary
        fields_to_fill = [
            "title", "first_name", "last_name", "phone", "linkedin_url",
            "company", "job_title", "location", "country", "buyer_persona"
        ]
        for field in fields_to_fill:
            if not primary.get(field) and secondary.get(field):
                primary[field] = secondary[field]
    
    # Update primary contact
    update_data = {
        "events": merged_events,
        "tags": merged_tags,
        "updated_at": now,
        "title": primary.get("title", ""),
        "first_name": primary.get("first_name", ""),
        "last_name": primary.get("last_name", ""),
        "phone": primary.get("phone", ""),
        "linkedin_url": primary.get("linkedin_url", ""),
        "company": primary.get("company", ""),
        "job_title": primary.get("job_title", ""),
        "location": primary.get("location", ""),
        "country": primary.get("country", ""),
        "buyer_persona": primary.get("buyer_persona", "")
    }
    
    # Recompute full name
    first = update_data.get("first_name", "") or ""
    last = update_data.get("last_name", "") or ""
    update_data["name"] = f"{first} {last}".strip() or primary.get("name", "")
    
    await db.unified_contacts.update_one(
        {"id": request.primary_id},
        {"$set": update_data}
    )
    
    # Delete secondary contacts
    await db.unified_contacts.delete_many({"id": {"$in": request.secondary_ids}})
    
    # Get updated primary contact
    updated = await db.unified_contacts.find_one({"id": request.primary_id}, {"_id": 0})
    
    return {
        "success": True,
        "merged_count": len(secondaries),
        "deleted_ids": request.secondary_ids,
        "contact": updated
    }


@router.get("/duplicates")
async def find_duplicate_contacts_by_email(
    current_user: dict = Depends(get_current_user)
):
    """Find potential duplicate contacts based on email"""
    # Aggregation to find emails that appear more than once
    pipeline = [
        {"$match": {"email": {"$nin": [None, ""]}}},
        {"$group": {
            "_id": {"$toLower": "$email"},
            "count": {"$sum": 1},
            "contacts": {"$push": {
                "id": "$id",
                "name": "$name",
                "first_name": "$first_name",
                "last_name": "$last_name",
                "company": "$company",
                "stage": "$stage"
            }}
        }},
        {"$match": {"count": {"$gt": 1}}},
        {"$sort": {"count": -1}},
        {"$limit": 50}
    ]
    
    duplicates = await db.unified_contacts.aggregate(pipeline).to_list(50)
    
    return {
        "success": True,
        "duplicate_groups": duplicates,
        "total_groups": len(duplicates)
    }


# ============ MIGRATION ENDPOINT ============

@router.post("/migrate")
async def migrate_contacts(current_user: dict = Depends(get_current_user)):
    """Migrate existing deal_makers to unified contacts"""
    migrated = 0
    skipped = 0
    
    # Get all deal_makers
    deal_makers = await db.deal_makers.find({}, {"_id": 0}).to_list(10000)
    
    for dm in deal_makers:
        # Check if already exists in unified_contacts
        existing = None
        if dm.get("linkedin_url"):
            existing = await db.unified_contacts.find_one({"linkedin_url": dm["linkedin_url"]})
        
        if existing:
            # Just add a tag if from different search
            search_query = dm.get("source_details", {}).get("search_query", "")
            if search_query:
                tag_exists = any(t.get("name") == search_query for t in existing.get("tags", []))
                if not tag_exists:
                    await db.unified_contacts.update_one(
                        {"id": existing["id"]},
                        {"$push": {"tags": {
                            "id": str(uuid.uuid4()),
                            "name": search_query,
                            "type": "search",
                            "created_at": dm.get("created_at", datetime.now(timezone.utc).isoformat()),
                            "details": dm.get("source_details", {})
                        }}}
                    )
            skipped += 1
            continue
        
        # Create new unified contact
        now = datetime.now(timezone.utc).isoformat()
        
        # Build tags from source
        tags = []
        search_query = dm.get("source_details", {}).get("search_query", "")
        if search_query:
            tags.append({
                "id": str(uuid.uuid4()),
                "name": search_query,
                "type": "search",
                "created_at": dm.get("created_at", now),
                "details": dm.get("source_details", {})
            })
        
        new_contact = {
            "id": dm.get("id") or str(uuid.uuid4()),
            "name": dm.get("name", ""),
            "email": dm.get("email"),
            "phone": dm.get("phone"),
            "linkedin_url": dm.get("linkedin_url"),
            "stage": 1,  # All deal_makers start in Prospect
            "classification": "inbound",  # Default classification
            "company": dm.get("company", ""),
            "job_title": dm.get("headline", "")[:200] if dm.get("headline") else None,
            "buyer_persona": dm.get("buyer_persona", ""),
            "status": dm.get("status", "new"),
            "location": dm.get("location", ""),
            "tags": tags,
            "source": dm.get("source", "linkedin_search"),
            "source_details": dm.get("source_details", {}),
            "created_at": dm.get("created_at", now),
            "updated_at": now,
            "notes": None
        }
        
        await db.unified_contacts.insert_one(new_contact)
        migrated += 1
    
    return {
        "success": True,
        "migrated": migrated,
        "skipped_duplicates": skipped,
        "total_unified": await db.unified_contacts.count_documents({})
    }



# ============ CSV IMPORT WITH EVENTS ============

class CSVImportRequest(BaseModel):
    contacts: List[dict]
    classify: bool = True
    event_id: Optional[str] = None
    event_name: Optional[str] = None
    import_type: str = "registered"  # "registered" or "attended"


# ============ CLASSIFICATION (MIGRATED TO CENTRALIZED SERVICE) ============
# MIGRATION NOTE: All classification logic is now in /backend/services/persona_classifier_service.py

from services.persona_classifier_service import (
    classify_job_title_simple,
    classify_job_title_with_name,
    normalize_job_title
)

async def classify_buyer_persona_db(job_title: str) -> str:
    """
    Classify a contact based on job title using database keywords with priority.
    
    MIGRATION: Now delegates to centralized persona_classifier_service.
    Returns buyer_persona_name for backwards compatibility with existing code.
    """
    bp_id, bp_name = await classify_job_title_with_name(db, job_title, use_cache=True)
    return bp_name


# Legacy fallback removed - centralized service handles all classification


@router.post("/import-csv")
async def import_csv_contacts(
    request: CSVImportRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Import contacts from CSV with event association.
    Handles duplicates by updating event participation.
    """
    imported = 0
    updated = 0
    skipped = 0
    errors = []
    
    now = datetime.now(timezone.utc).isoformat()
    
    for contact_data in request.contacts:
        email = contact_data.get("email", "").strip().lower()
        
        if not email or "@" not in email:
            skipped += 1
            continue
        
        # Check if contact exists
        existing = await db.unified_contacts.find_one({"email": email})
        
        # Build event participation record
        event_record = None
        if request.event_id and request.event_name:
            event_record = {
                "event_id": request.event_id,
                "event_name": request.event_name,
                "registered": True,
                "attended": request.import_type == "attended",
                "date": now
            }
        
        if existing:
            # Auto-merge: Update existing contact with new data
            update_ops = {"$set": {"updated_at": now}}
            
            if event_record:
                # Check if event already exists
                existing_events = existing.get("events", [])
                event_exists = False
                
                for i, evt in enumerate(existing_events):
                    if evt.get("event_id") == request.event_id:
                        event_exists = True
                        # Update attendance if importing attendees
                        if request.import_type == "attended":
                            existing_events[i]["attended"] = True
                        break
                
                if not event_exists:
                    update_ops["$push"] = {"events": event_record}
                else:
                    update_ops["$set"]["events"] = existing_events
            
            # Auto-merge: Fill empty fields from imported data
            first_name = contact_data.get("firstname", "").strip()
            last_name = contact_data.get("lastname", "").strip()
            
            if first_name and not existing.get("first_name"):
                update_ops["$set"]["first_name"] = first_name
            if last_name and not existing.get("last_name"):
                update_ops["$set"]["last_name"] = last_name
            if contact_data.get("country") and not existing.get("country"):
                update_ops["$set"]["country"] = contact_data.get("country")
            if contact_data.get("company") and not existing.get("company"):
                update_ops["$set"]["company"] = contact_data.get("company")
            if contact_data.get("jobtitle") and not existing.get("job_title"):
                update_ops["$set"]["job_title"] = contact_data.get("jobtitle")
            if contact_data.get("phone") and not existing.get("phone"):
                update_ops["$set"]["phone"] = contact_data.get("phone")
            
            # Update full name if we have new first/last
            if update_ops["$set"].get("first_name") or update_ops["$set"].get("last_name"):
                new_first = update_ops["$set"].get("first_name") or existing.get("first_name", "")
                new_last = update_ops["$set"].get("last_name") or existing.get("last_name", "")
                update_ops["$set"]["name"] = f"{new_first} {new_last}".strip()
            
            await db.unified_contacts.update_one({"email": email}, update_ops)
            updated += 1
        else:
            # Create new contact
            first_name = contact_data.get("firstname", "").strip()
            last_name = contact_data.get("lastname", "").strip()
            full_name = f"{first_name} {last_name}".strip()
            
            if not full_name:
                full_name = email.split("@")[0]
            
            job_title = contact_data.get("jobtitle", "").strip()
            buyer_persona = "Mateo"  # Default catch-all
            if request.classify:
                buyer_persona = await classify_buyer_persona_db(job_title)
            
            new_contact = {
                "id": str(uuid.uuid4()),
                "title": "",  # Tratamiento - empty by default for imports
                "first_name": first_name,
                "last_name": last_name,
                "name": full_name,
                "email": email,
                "phone": contact_data.get("phone", ""),
                "linkedin_url": contact_data.get("linkedin_url", ""),
                "stage": 2,  # Imported contacts go to Nurture
                "classification": "inbound",  # Default classification
                "company": contact_data.get("company", "").strip(),
                "job_title": job_title,
                "buyer_persona": buyer_persona,
                "status": "new",
                "location": "",
                "country": contact_data.get("country", "").strip(),
                "events": [event_record] if event_record else [],
                "tags": [],
                "source": "csv_import",
                "source_details": {
                    "event_id": request.event_id,
                    "event_name": request.event_name,
                    "import_type": request.import_type
                },
                "created_at": now,
                "updated_at": now,
                "notes": ""
            }
            
            try:
                await db.unified_contacts.insert_one(new_contact)
                imported += 1
            except Exception as e:
                errors.append({"email": email, "error": str(e)})
                skipped += 1
    
    return {
        "success": True,
        "imported": imported,
        "updated": updated,
        "skipped": skipped,
        "total": len(request.contacts),
        "errors": errors[:10]  # First 10 errors
    }


@router.post("/{contact_id}/add-event")
async def add_event_to_contact(
    contact_id: str,
    event_id: str,
    event_name: str,
    attended: bool = False,
    current_user: dict = Depends(get_current_user)
):
    """Add an event to a contact's participation list"""
    existing = await db.unified_contacts.find_one({"id": contact_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Contact not found")
    
    now = datetime.now(timezone.utc).isoformat()
    
    # Check if event already exists
    events = existing.get("events", [])
    for evt in events:
        if evt.get("event_id") == event_id:
            # Update attendance status
            evt["attended"] = evt.get("attended", False) or attended
            await db.unified_contacts.update_one(
                {"id": contact_id},
                {"$set": {"events": events, "updated_at": now}}
            )
            return {"success": True, "action": "updated"}
    
    # Add new event
    new_event = {
        "event_id": event_id,
        "event_name": event_name,
        "registered": True,
        "attended": attended,
        "date": now
    }
    
    await db.unified_contacts.update_one(
        {"id": contact_id},
        {"$push": {"events": new_event}, "$set": {"updated_at": now}}
    )
    
    return {"success": True, "action": "added"}



# ============ ORG CHART / RELATED CONTACTS ============

class RelationshipCreate(BaseModel):
    """Model for creating a relationship between contacts"""
    target_contact_id: str
    relationship_type: str = "reports_to"  # reports_to, works_with, manages


@router.get("/company/{company_name}/orgchart")
async def get_company_orgchart(
    company_name: str,
    current_user: dict = Depends(get_current_user)
):
    """Get all contacts for a company formatted for org chart visualization"""
    # Get all contacts for this company
    contacts = await db.unified_contacts.find(
        {"company": {"$regex": f"^{company_name}$", "$options": "i"}},
        {"_id": 0}
    ).to_list(500)
    
    if not contacts:
        return {
            "company": company_name,
            "contacts": [],
            "relationships": [],
            "root_contacts": []
        }
    
    # Build relationship map
    relationships = []
    contact_ids = {c["id"] for c in contacts}
    
    for contact in contacts:
        related = contact.get("related_contacts", [])
        for rel in related:
            if rel.get("contact_id") in contact_ids:
                relationships.append({
                    "source_id": contact["id"],
                    "target_id": rel["contact_id"],
                    "type": rel.get("relationship_type", "reports_to")
                })
    
    # Find root contacts (those who don't report to anyone in this company)
    contacts_who_report = {r["source_id"] for r in relationships if r["type"] == "reports_to"}
    root_contacts = [c["id"] for c in contacts if c["id"] not in contacts_who_report]
    
    # Simplify contact data for frontend
    simplified_contacts = []
    for c in contacts:
        simplified_contacts.append({
            "id": c["id"],
            "name": c.get("name", ""),
            "job_title": c.get("job_title", ""),
            "linkedin_url": c.get("linkedin_url", ""),
            "buyer_persona": c.get("buyer_persona", ""),
            "contact_types": c.get("contact_types", []),
            "related_contacts": c.get("related_contacts", [])
        })
    
    return {
        "company": company_name,
        "contacts": simplified_contacts,
        "relationships": relationships,
        "root_contacts": root_contacts
    }


@router.post("/{contact_id}/relationships")
async def add_contact_relationship(
    contact_id: str,
    relationship: RelationshipCreate,
    current_user: dict = Depends(get_current_user)
):
    """Add a relationship between two contacts"""
    # Verify source contact exists
    source = await db.unified_contacts.find_one({"id": contact_id})
    if not source:
        raise HTTPException(status_code=404, detail="Source contact not found")
    
    # Verify target contact exists
    target = await db.unified_contacts.find_one({"id": relationship.target_contact_id})
    if not target:
        raise HTTPException(status_code=404, detail="Target contact not found")
    
    # Check if relationship already exists
    existing_relations = source.get("related_contacts", [])
    for rel in existing_relations:
        if rel.get("contact_id") == relationship.target_contact_id:
            # Update existing relationship
            rel["relationship_type"] = relationship.relationship_type
            await db.unified_contacts.update_one(
                {"id": contact_id},
                {
                    "$set": {
                        "related_contacts": existing_relations,
                        "updated_at": datetime.now(timezone.utc).isoformat()
                    }
                }
            )
            return {"success": True, "action": "updated", "relationship": rel}
    
    # Add new relationship
    new_rel = {
        "contact_id": relationship.target_contact_id,
        "relationship_type": relationship.relationship_type
    }
    
    await db.unified_contacts.update_one(
        {"id": contact_id},
        {
            "$push": {"related_contacts": new_rel},
            "$set": {"updated_at": datetime.now(timezone.utc).isoformat()}
        }
    )
    
    # Also add reverse relationship if "reports_to"
    if relationship.relationship_type == "reports_to":
        reverse_rel = {
            "contact_id": contact_id,
            "relationship_type": "manages"
        }
        target_relations = target.get("related_contacts", [])
        # Check if reverse already exists
        has_reverse = any(r.get("contact_id") == contact_id for r in target_relations)
        if not has_reverse:
            await db.unified_contacts.update_one(
                {"id": relationship.target_contact_id},
                {
                    "$push": {"related_contacts": reverse_rel},
                    "$set": {"updated_at": datetime.now(timezone.utc).isoformat()}
                }
            )
    
    return {
        "success": True,
        "action": "created",
        "relationship": new_rel,
        "source": {"id": contact_id, "name": source.get("name")},
        "target": {"id": relationship.target_contact_id, "name": target.get("name")}
    }


@router.delete("/{contact_id}/relationships/{target_contact_id}")
async def remove_contact_relationship(
    contact_id: str,
    target_contact_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Remove a relationship between two contacts"""
    # Remove from source
    result = await db.unified_contacts.update_one(
        {"id": contact_id},
        {
            "$pull": {"related_contacts": {"contact_id": target_contact_id}},
            "$set": {"updated_at": datetime.now(timezone.utc).isoformat()}
        }
    )
    
    # Remove reverse relationship from target
    await db.unified_contacts.update_one(
        {"id": target_contact_id},
        {
            "$pull": {"related_contacts": {"contact_id": contact_id}},
            "$set": {"updated_at": datetime.now(timezone.utc).isoformat()}
        }
    )
    
    return {
        "success": True,
        "modified": result.modified_count > 0
    }


# ============ ADMIN OPERATIONS ============

class PhoneResetRequest(BaseModel):
    """Request model for phone reset operation"""
    confirmation_text: str  # Must be "RESET PHONES"


@router.post("/admin/reset-phones")
async def reset_all_phone_numbers(
    request: PhoneResetRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    ADMIN OPERATION: Reset all phone numbers from all contacts.
    This is a destructive operation that clears all phone data.
    
    Security requirements:
    - User must provide confirmation_text = "RESET PHONES"
    - Operation is logged in admin_operations collection
    """
    # Security check - require exact confirmation text
    if request.confirmation_text != "RESET PHONES":
        raise HTTPException(
            status_code=400, 
            detail="Invalid confirmation. Please type 'RESET PHONES' to confirm this operation."
        )
    
    now = datetime.now(timezone.utc).isoformat()
    
    # Create audit log entry
    operation_id = str(uuid.uuid4())
    audit_log = {
        "operation_id": operation_id,
        "operation_type": "reset_all_phones",
        "initiated_by_user_id": current_user.get("id"),
        "initiated_by_email": current_user.get("email"),
        "run_at": now,
        "status": "running",
        "contacts_updated_count": 0,
        "errors_count": 0,
        "error_details": []
    }
    
    await db.admin_operations.insert_one(audit_log)
    
    # Execute the phone reset
    try:
        # Update all contacts - clear phone fields
        result = await db.unified_contacts.update_many(
            {},  # All contacts
            {
                "$set": {
                    "phones": [],
                    "phone": None,
                    "updated_at": now
                },
                "$unset": {
                    "phone_e164": "",
                    "is_phone_valid": "",
                    "phone_country_code": "",
                    "primary_phone": "",
                    "whatsapp_phone": ""
                }
            }
        )
        
        contacts_updated = result.modified_count
        
        # Update audit log with success
        await db.admin_operations.update_one(
            {"operation_id": operation_id},
            {"$set": {
                "status": "completed",
                "contacts_updated_count": contacts_updated,
                "completed_at": datetime.now(timezone.utc).isoformat()
            }}
        )
        
        return {
            "success": True,
            "operation_id": operation_id,
            "contacts_updated_count": contacts_updated,
            "message": f"Successfully reset phone numbers for {contacts_updated} contacts"
        }
        
    except Exception as e:
        # Update audit log with error
        await db.admin_operations.update_one(
            {"operation_id": operation_id},
            {"$set": {
                "status": "failed",
                "errors_count": 1,
                "error_details": [str(e)],
                "completed_at": datetime.now(timezone.utc).isoformat()
            }}
        )
        raise HTTPException(status_code=500, detail=f"Phone reset failed: {str(e)}")


@router.get("/admin/duplicate-email-check")
async def check_duplicate_emails(
    current_user: dict = Depends(get_current_user)
):
    """
    Check for contacts that share the same email address.
    This is important before import operations to identify conflicts.
    Returns groups of contacts sharing the same email.
    """
    # Aggregation to find emails that appear in multiple contacts
    # Check both legacy email field and emails array
    
    # First, get all contacts with emails
    contacts = await db.unified_contacts.find(
        {"is_merged": {"$ne": True}},
        {"_id": 0, "id": 1, "email": 1, "emails": 1, "name": 1, "first_name": 1, "last_name": 1, "company": 1}
    ).to_list(50000)
    
    # Build email -> contacts mapping
    email_to_contacts = {}
    
    for contact in contacts:
        contact_emails = set()
        
        # Legacy email field
        email_val = contact.get("email")
        if email_val:
            if isinstance(email_val, list):
                email_val = email_val[0] if email_val else ""
            if isinstance(email_val, str) and email_val.strip():
                contact_emails.add(email_val.strip().lower())
        
        # Emails array
        for email_entry in contact.get("emails", []):
            email_str = email_entry.get("email")
            if isinstance(email_str, str) and email_str.strip():
                contact_emails.add(email_str.strip().lower())
        
        # Add contact to each email group
        for email in contact_emails:
            if email not in email_to_contacts:
                email_to_contacts[email] = []
            
            contact_name = contact.get("name") or f"{contact.get('first_name', '')} {contact.get('last_name', '')}".strip() or "(No name)"
            email_to_contacts[email].append({
                "id": contact.get("id"),
                "name": contact_name,
                "company": contact.get("company", "")
            })
    
    # Filter to only emails with more than one contact (duplicates)
    duplicate_groups = []
    for email, contacts_list in email_to_contacts.items():
        if len(contacts_list) > 1:
            duplicate_groups.append({
                "email": email,
                "count": len(contacts_list),
                "contacts": contacts_list
            })
    
    # Sort by count descending
    duplicate_groups.sort(key=lambda x: x["count"], reverse=True)
    
    return {
        "total_duplicate_groups": len(duplicate_groups),
        "total_affected_contacts": sum(g["count"] for g in duplicate_groups),
        "duplicate_groups": duplicate_groups[:100],  # Return top 100
        "has_duplicates": len(duplicate_groups) > 0,
        "recommendation": "Resolve duplicate emails before import to ensure proper merge by email" if duplicate_groups else "No duplicate emails found. Safe to proceed with import."
    }


@router.get("/admin/pre-import-check")
async def pre_import_readiness_check(
    current_user: dict = Depends(get_current_user)
):
    """
    Pre-import readiness check.
    Verifies:
    1. Import merge by email is configured
    2. No blocking duplicate email conflicts exist
    3. Phone reset has been performed (if needed)
    """
    # Check for duplicate emails
    duplicate_check = await check_duplicate_emails(current_user)
    
    # Check last phone reset operation
    last_phone_reset = await db.admin_operations.find_one(
        {"operation_type": "reset_all_phones", "status": "completed"},
        sort=[("completed_at", -1)]
    )
    
    # Check total contacts with phones
    contacts_with_phones = await db.unified_contacts.count_documents({
        "$or": [
            {"phones": {"$exists": True, "$ne": []}},
            {"phone": {"$exists": True, "$nin": [None, ""]}}
        ]
    })
    
    total_contacts = await db.unified_contacts.count_documents({})
    
    # Determine readiness
    is_ready = True
    warnings = []
    blockers = []
    
    if duplicate_check.get("has_duplicates"):
        blockers.append({
            "code": "DUPLICATE_EMAILS",
            "message": f"Found {duplicate_check['total_duplicate_groups']} email groups with duplicates affecting {duplicate_check['total_affected_contacts']} contacts",
            "action": "Resolve duplicate emails before import to ensure proper merge by email"
        })
        is_ready = False
    
    if contacts_with_phones > 0:
        warnings.append({
            "code": "PHONES_EXIST",
            "message": f"{contacts_with_phones} contacts currently have phone data",
            "action": "If phones need to be reimported from CSV, run phone reset first"
        })
    
    phone_reset_info = None
    if last_phone_reset:
        phone_reset_info = {
            "performed_at": last_phone_reset.get("completed_at"),
            "contacts_affected": last_phone_reset.get("contacts_updated_count"),
            "performed_by": last_phone_reset.get("initiated_by_email")
        }
    
    return {
        "is_ready_for_import": is_ready,
        "blockers": blockers,
        "warnings": warnings,
        "stats": {
            "total_contacts": total_contacts,
            "contacts_with_phones": contacts_with_phones,
            "duplicate_email_groups": duplicate_check.get("total_duplicate_groups", 0)
        },
        "import_config": {
            "merge_strategy": "EMAIL",
            "email_normalization": "trim + lowercase",
            "upsert_enabled": True
        },
        "last_phone_reset": phone_reset_info
    }


@router.get("/admin/operations")
async def list_admin_operations(
    limit: int = 20,
    current_user: dict = Depends(get_current_user)
):
    """List recent admin operations for audit trail"""
    operations = await db.admin_operations.find(
        {},
        {"_id": 0}
    ).sort("run_at", -1).limit(limit).to_list(limit)
    
    return {
        "operations": operations,
        "count": len(operations)
    }


# ============ MERGE DUPLICATES ============

class MergeRequest(BaseModel):
    """Request to merge duplicate contacts"""
    primary_contact_id: str  # Contact to keep
    contacts_to_merge: List[str]  # Contact IDs to merge into primary


@router.get("/admin/find-duplicates")
async def admin_find_duplicate_contacts(
    method: str = "name_company",  # name_company, email, phone
    threshold: float = 0.8,
    current_user: dict = Depends(get_current_user)
):
    """
    Find potential duplicate contacts based on various matching methods.
    
    Methods:
    - name_company: Match by similar name + same company
    - email: Match by shared email addresses
    - phone: Match by shared phone numbers
    """
    import re
    from difflib import SequenceMatcher
    
    contacts = await db.unified_contacts.find(
        {"is_merged": {"$ne": True}},
        {"_id": 0, "id": 1, "name": 1, "first_name": 1, "last_name": 1, 
         "email": 1, "emails": 1, "phone": 1, "phones": 1, "company": 1, 
         "job_title": 1, "linkedin_url": 1, "stage": 1, "buyer_persona": 1}
    ).to_list(20000)
    
    duplicate_groups = []
    processed_ids = set()
    
    def normalize_name(name):
        if not name:
            return ""
        return re.sub(r'[^a-z0-9]', '', name.lower())
    
    def get_all_emails(contact):
        emails = set()
        if contact.get("email"):
            emails.add(contact["email"].lower().strip())
        for e in contact.get("emails", []):
            if e.get("email"):
                emails.add(e["email"].lower().strip())
        return emails
    
    def get_all_phones(contact):
        phones = set()
        if contact.get("phone"):
            # Normalize: keep only digits
            normalized = re.sub(r'[^0-9]', '', contact["phone"])
            if len(normalized) >= 10:
                phones.add(normalized[-10:])  # Last 10 digits
        for p in contact.get("phones", []):
            raw = p.get("raw_input", "") or p.get("e164", "")
            normalized = re.sub(r'[^0-9]', '', raw)
            if len(normalized) >= 10:
                phones.add(normalized[-10:])
        return phones
    
    if method == "name_company":
        # Group by company first
        by_company = {}
        for c in contacts:
            company = normalize_name(c.get("company", ""))
            if company:
                if company not in by_company:
                    by_company[company] = []
                by_company[company].append(c)
        
        # Find similar names within each company
        for company, company_contacts in by_company.items():
            if len(company_contacts) < 2:
                continue
                
            for i, c1 in enumerate(company_contacts):
                if c1["id"] in processed_ids:
                    continue
                    
                name1 = normalize_name(c1.get("name") or f"{c1.get('first_name', '')} {c1.get('last_name', '')}".strip())
                if not name1:
                    continue
                
                group = [c1]
                
                for j, c2 in enumerate(company_contacts):
                    if i >= j or c2["id"] in processed_ids:
                        continue
                    
                    name2 = normalize_name(c2.get("name") or f"{c2.get('first_name', '')} {c2.get('last_name', '')}".strip())
                    if not name2:
                        continue
                    
                    # Calculate similarity
                    similarity = SequenceMatcher(None, name1, name2).ratio()
                    if similarity >= threshold:
                        group.append(c2)
                
                if len(group) > 1:
                    for c in group:
                        processed_ids.add(c["id"])
                    duplicate_groups.append({
                        "match_type": "name_company",
                        "match_key": c1.get("company", ""),
                        "contacts": group,
                        "confidence": round(similarity * 100)
                    })
    
    elif method == "email":
        # Group by email
        email_map = {}
        for c in contacts:
            for email in get_all_emails(c):
                if email not in email_map:
                    email_map[email] = []
                email_map[email].append(c)
        
        for email, email_contacts in email_map.items():
            if len(email_contacts) > 1:
                ids = [c["id"] for c in email_contacts]
                if not any(id in processed_ids for id in ids):
                    for id in ids:
                        processed_ids.add(id)
                    duplicate_groups.append({
                        "match_type": "email",
                        "match_key": email,
                        "contacts": email_contacts,
                        "confidence": 100
                    })
    
    elif method == "phone":
        # Group by phone
        phone_map = {}
        for c in contacts:
            for phone in get_all_phones(c):
                if phone not in phone_map:
                    phone_map[phone] = []
                phone_map[phone].append(c)
        
        for phone, phone_contacts in phone_map.items():
            if len(phone_contacts) > 1:
                ids = [c["id"] for c in phone_contacts]
                if not any(id in processed_ids for id in ids):
                    for id in ids:
                        processed_ids.add(id)
                    duplicate_groups.append({
                        "match_type": "phone",
                        "match_key": phone,
                        "contacts": phone_contacts,
                        "confidence": 95
                    })
    
    # Sort by confidence descending
    duplicate_groups.sort(key=lambda x: (x["confidence"], len(x["contacts"])), reverse=True)
    
    return {
        "method": method,
        "threshold": threshold,
        "total_groups": len(duplicate_groups),
        "total_duplicates": sum(len(g["contacts"]) for g in duplicate_groups),
        "groups": duplicate_groups[:50]  # Return top 50 groups
    }


@router.post("/admin/merge")
async def admin_merge_contacts(
    request: MergeRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Merge multiple contacts into a primary contact.
    
    The primary contact will:
    - Keep its ID
    - Receive all emails/phones from merged contacts (deduplicated)
    - Receive all notes appended
    - Receive all tags combined
    - Keep its stage (or use highest stage from merged)
    
    Merged contacts will be marked as is_merged=True and hidden from lists.
    """
    primary_id = request.primary_contact_id
    merge_ids = request.contacts_to_merge
    
    if primary_id in merge_ids:
        raise HTTPException(status_code=400, detail="Primary contact cannot be in merge list")
    
    if len(merge_ids) == 0:
        raise HTTPException(status_code=400, detail="No contacts to merge")
    
    # Get primary contact
    primary = await db.unified_contacts.find_one({"id": primary_id}, {"_id": 0})
    if not primary:
        raise HTTPException(status_code=404, detail="Primary contact not found")
    
    # Get contacts to merge
    contacts_to_merge = await db.unified_contacts.find(
        {"id": {"$in": merge_ids}},
        {"_id": 0}
    ).to_list(100)
    
    if len(contacts_to_merge) != len(merge_ids):
        raise HTTPException(status_code=404, detail="Some contacts to merge not found")
    
    now = datetime.now(timezone.utc).isoformat()
    
    # Prepare merged data
    all_emails = set()
    all_phones = []
    all_notes = []
    all_tags = []
    merged_from_ids = []
    highest_stage = primary.get("stage", 1)
    
    # Add primary's data
    if primary.get("email"):
        all_emails.add(primary["email"].lower().strip())
    for e in primary.get("emails", []):
        if e.get("email"):
            all_emails.add(e["email"].lower().strip())
    
    all_phones.extend(primary.get("phones", []))
    if primary.get("notes"):
        all_notes.append(f"[Primary] {primary['notes']}")
    all_tags.extend(primary.get("tags", []))
    
    # Add data from contacts to merge
    for contact in contacts_to_merge:
        merged_from_ids.append(contact["id"])
        
        # Emails
        if contact.get("email"):
            all_emails.add(contact["email"].lower().strip())
        for e in contact.get("emails", []):
            if e.get("email"):
                all_emails.add(e["email"].lower().strip())
        
        # Phones (check for duplicates)
        for phone in contact.get("phones", []):
            # Simple dedup by raw_input
            if not any(p.get("raw_input") == phone.get("raw_input") for p in all_phones):
                all_phones.append(phone)
        
        # Notes
        if contact.get("notes"):
            contact_name = contact.get("name") or f"{contact.get('first_name', '')} {contact.get('last_name', '')}".strip()
            all_notes.append(f"[Merged from {contact_name}] {contact['notes']}")
        
        # Tags
        all_tags.extend(contact.get("tags", []))
        
        # Stage (keep highest)
        if contact.get("stage", 1) > highest_stage:
            highest_stage = contact["stage"]
    
    # Convert emails set to list of EmailEntry format
    final_emails = []
    primary_email = primary.get("email", "").lower().strip() if primary.get("email") else None
    for email in all_emails:
        final_emails.append({
            "email": email,
            "is_primary": email == primary_email
        })
    
    # If no primary set, set first one
    if final_emails and not any(e["is_primary"] for e in final_emails):
        final_emails[0]["is_primary"] = True
    
    # Update primary contact
    update_data = {
        "emails": final_emails,
        "email": final_emails[0]["email"] if final_emails else primary.get("email"),
        "phones": all_phones,
        "phone": all_phones[0].get("raw_input") if all_phones else primary.get("phone"),
        "notes": "\n\n".join(all_notes) if all_notes else primary.get("notes"),
        "tags": all_tags,
        "stage": highest_stage,
        "merged_from_contact_ids": list(set(primary.get("merged_from_contact_ids", []) + merged_from_ids)),
        "updated_at": now,
        "last_merge_at": now
    }
    
    await db.unified_contacts.update_one(
        {"id": primary_id},
        {"$set": update_data}
    )
    
    # Mark merged contacts as merged
    await db.unified_contacts.update_many(
        {"id": {"$in": merge_ids}},
        {"$set": {
            "is_merged": True,
            "merged_into_contact_id": primary_id,
            "merged_at": now,
            "updated_at": now
        }}
    )
    
    # Create audit log
    await db.admin_operations.insert_one({
        "operation_id": str(uuid.uuid4()),
        "operation_type": "merge_contacts",
        "primary_contact_id": primary_id,
        "merged_contact_ids": merge_ids,
        "run_at": now,
        "status": "completed",
        "initiated_by_user_id": current_user.get("id"),
        "initiated_by_email": current_user.get("email"),
        "details": {
            "primary_name": primary.get("name"),
            "merged_count": len(merge_ids)
        }
    })
    
    return {
        "success": True,
        "primary_contact_id": primary_id,
        "merged_contacts": len(merge_ids),
        "message": f"Successfully merged {len(merge_ids)} contacts into {primary.get('name')}"
    }


@router.post("/admin/unmerge/{contact_id}")
async def unmerge_contact(
    contact_id: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Restore a previously merged contact.
    This marks the contact as no longer merged, making it visible again.
    Note: Data that was combined into the primary is not automatically removed.
    """
    contact = await db.unified_contacts.find_one({"id": contact_id})
    if not contact:
        raise HTTPException(status_code=404, detail="Contact not found")
    
    if not contact.get("is_merged"):
        raise HTTPException(status_code=400, detail="Contact is not merged")
    
    now = datetime.now(timezone.utc).isoformat()
    
    await db.unified_contacts.update_one(
        {"id": contact_id},
        {"$set": {
            "is_merged": False,
            "merged_into_contact_id": None,
            "updated_at": now
        }}
    )
    
    return {
        "success": True,
        "message": "Contact restored successfully"
    }


# ============ ADMIN: LIST DISTINCT SOURCES ============

@router.get("/admin/distinct-sources")
async def get_distinct_sources(
    current_user: dict = Depends(get_current_user)
):
    """
    List all distinct source values in the unified_contacts collection.
    Useful for identifying which source names to target for cleanup.
    """
    sources = await db.unified_contacts.distinct("source")
    
    # Count contacts per source
    source_counts = {}
    for source in sources:
        count = await db.unified_contacts.count_documents({"source": source})
        source_counts[source or "null"] = count
    
    return {
        "success": True,
        "sources": sources,
        "source_counts": source_counts,
        "total_sources": len(sources)
    }


# ============ ADMIN: DELETE GOOGLE MAPS CONTACTS ============

@router.delete("/admin/delete-google-maps-contacts")
async def delete_google_maps_contacts(
    current_user: dict = Depends(get_current_user)
):
    """
    ADMIN OPERATION: Delete all contacts where source is 'google_maps'.
    This is for cleaning up contacts from early Google Maps scraping 
    that were not properly tagged.
    """
    now = datetime.now(timezone.utc).isoformat()
    
    # Count contacts to delete
    count_before = await db.unified_contacts.count_documents({"source": "google_maps"})
    
    if count_before == 0:
        return {
            "success": True,
            "deleted_count": 0,
            "message": "No contacts found with source 'google_maps'"
        }
    
    # Create audit log entry
    operation_id = str(uuid.uuid4())
    audit_log = {
        "operation_id": operation_id,
        "operation_type": "delete_google_maps_contacts",
        "initiated_by_user_id": current_user.get("id"),
        "initiated_by_email": current_user.get("email"),
        "run_at": now,
        "status": "running",
        "contacts_count_before": count_before
    }
    
    await db.admin_operations.insert_one(audit_log)
    
    try:
        # Delete all contacts with source = google_maps
        result = await db.unified_contacts.delete_many({"source": "google_maps"})
        deleted_count = result.deleted_count
        
        # Update audit log with success
        await db.admin_operations.update_one(
            {"operation_id": operation_id},
            {"$set": {
                "status": "completed",
                "deleted_count": deleted_count,
                "completed_at": datetime.now(timezone.utc).isoformat()
            }}
        )
        
        return {
            "success": True,
            "deleted_count": deleted_count,
            "operation_id": operation_id,
            "message": f"Successfully deleted {deleted_count} contacts with source 'google_maps'"
        }
        
    except Exception as e:
        # Update audit log with error
        await db.admin_operations.update_one(
            {"operation_id": operation_id},
            {"$set": {
                "status": "failed",
                "error": str(e),
                "completed_at": datetime.now(timezone.utc).isoformat()
            }}
        )
        raise HTTPException(status_code=500, detail=f"Delete operation failed: {str(e)}")


@router.get("/{contact_id}/relationships")
async def get_contact_relationships(
    contact_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get all relationships for a contact with full contact details"""
    contact = await db.unified_contacts.find_one({"id": contact_id}, {"_id": 0})
    if not contact:
        raise HTTPException(status_code=404, detail="Contact not found")
    
    related = contact.get("related_contacts", [])
    detailed_relations = []
    
    for rel in related:
        related_contact = await db.unified_contacts.find_one(
            {"id": rel["contact_id"]},
            {"_id": 0, "id": 1, "name": 1, "job_title": 1, "linkedin_url": 1, "company": 1}
        )
        if related_contact:
            detailed_relations.append({
                "contact": related_contact,
                "relationship_type": rel.get("relationship_type", "works_with")
            })
    
    return {
        "contact_id": contact_id,
        "contact_name": contact.get("name"),
        "relationships": detailed_relations
    }


@router.get("/{contact_id}/cases")
async def get_contact_cases(
    contact_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get all cases associated with a contact"""
    contact = await db.unified_contacts.find_one({"id": contact_id}, {"_id": 0})
    if not contact:
        raise HTTPException(status_code=404, detail="Contact not found")
    
    # Find all cases where this contact is in contact_ids
    cases = await db.cases.find(
        {"contact_ids": contact_id},
        {"_id": 0}
    ).to_list(1000)
    
    # Get role for each case
    for case in cases:
        role_doc = await db.case_contact_roles.find_one(
            {"case_id": case.get("id"), "contact_id": contact_id},
            {"_id": 0}
        )
        case["contact_role"] = role_doc.get("role") if role_doc else None
    
    return {
        "contact_id": contact_id,
        "contact_name": contact.get("name"),
        "cases": cases
    }
