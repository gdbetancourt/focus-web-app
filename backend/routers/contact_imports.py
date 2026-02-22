"""
Contact Import Router - CSV Import functionality for FOCUS contacts
Supports upload, mapping, validation, duplicate detection, and batch import
"""
from fastapi import APIRouter, HTTPException, Depends, UploadFile, File
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone, timedelta
from pydantic import BaseModel
import uuid
import csv
import io
import re
import logging

from database import db
from routers.auth import get_current_user
from routers.contacts import normalize_phone_to_e164, normalize_email_entry, CONTACT_TYPES

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/contacts/imports", tags=["contact-imports"])

# ============ SCHEMAS ============

class ColumnMapping(BaseModel):
    csv_column: str
    focus_field: str  # salutation, first_name, last_name, email, phone, linkedin_url, buyer_persona, roles, specialty, stage, notes, company, job_title
    is_primary: bool = False  # For email/phone
    separator: Optional[str] = None  # For multi-value columns: ";", "|", ","

class ImportConfig(BaseModel):
    delimiter: str = ","
    has_headers: bool = True
    default_country_code: str = "+52"
    multivalue_separator: str = ";"
    upsert_policy: str = "UPDATE_EXISTING"  # CREATE_ONLY, UPDATE_EXISTING, CREATE_DUPLICATE
    strict_mode: bool = False  # If true, block import on validation errors
    overwrite_empty: bool = False  # If true, empty CSV values overwrite existing data

class MappingRequest(BaseModel):
    mappings: List[ColumnMapping]
    config: ImportConfig

class ImportBatchSummary(BaseModel):
    batch_id: str
    total_rows: int
    to_create: int
    to_update: int
    to_skip: int
    warnings: int
    errors: int

# ============ UTILITY FUNCTIONS ============

def detect_delimiter(content: str) -> str:
    """Auto-detect CSV delimiter"""
    first_lines = content.split('\n')[:5]
    sample = '\n'.join(first_lines)
    
    comma_count = sample.count(',')
    semicolon_count = sample.count(';')
    tab_count = sample.count('\t')
    
    if semicolon_count > comma_count and semicolon_count > tab_count:
        return ';'
    elif tab_count > comma_count:
        return '\t'
    return ','

def parse_csv_content(content: str, delimiter: str = ',', has_headers: bool = True) -> tuple:
    """Parse CSV content and return headers + rows as dictionaries.
    
    Handles duplicate column names by:
    1. Detecting duplicates and renaming them (e.g., 'Phone', 'Phone_2')
    2. When converting to dict, preferring the first non-empty value for duplicates
    """
    # Handle BOM
    if content.startswith('\ufeff'):
        content = content[1:]
    
    reader = csv.reader(io.StringIO(content), delimiter=delimiter)
    rows = list(reader)
    
    if not rows:
        return [], []
    
    if has_headers:
        raw_headers = rows[0]
        data_rows = rows[1:]
        
        # Handle duplicate headers - track original positions
        header_counts = {}
        headers = []
        duplicate_groups = {}  # maps base_name -> list of column indices
        
        for idx, h in enumerate(raw_headers):
            base_name = h.strip()
            if base_name in header_counts:
                header_counts[base_name] += 1
                new_name = f"{base_name}_{header_counts[base_name]}"
                headers.append(new_name)
                if base_name not in duplicate_groups:
                    # Find the original column index
                    orig_idx = headers.index(base_name)
                    duplicate_groups[base_name] = [orig_idx]
                duplicate_groups[base_name].append(idx)
            else:
                header_counts[base_name] = 1
                headers.append(base_name)
        
        # Log duplicate detection
        if duplicate_groups:
            logger.warning(f"CSV has duplicate columns: {list(duplicate_groups.keys())}")
        
        # Store duplicate info for later use
        return headers, data_rows, duplicate_groups
    else:
        # Generate column names
        headers = [f"Column_{i+1}" for i in range(len(rows[0]))]
        data_rows = rows
        return headers, data_rows, {}

def normalize_role(role_value: str) -> Optional[str]:
    """Normalize role values to internal format"""
    if not role_value:
        return None
    
    role_map = {
        'deal_maker': 'deal_maker',
        'dealmaker': 'deal_maker',
        'deal maker': 'deal_maker',
        'dm': 'deal_maker',
        'influencer': 'influencer',
        'student': 'student',
        'estudiante': 'student',
        'advisor': 'advisor',
        'asesor': 'advisor',
    }
    
    normalized = role_value.strip().lower()
    return role_map.get(normalized)

def normalize_stage(stage_value: str) -> Optional[int]:
    """Normalize stage values to integer 1-5"""
    if not stage_value:
        return None
    
    stage_str = str(stage_value).strip().lower()
    
    # Direct number
    if stage_str.isdigit():
        stage_int = int(stage_str)
        if 1 <= stage_int <= 5:
            return stage_int
    
    # Step X format
    stage_patterns = {
        'step 1': 1, 'step_1': 1, 'prospect': 1, '1': 1,
        'step 2': 2, 'step_2': 2, 'nurture': 2, '2': 2,
        'step 3': 3, 'step_3': 3, 'close': 3, '3': 3,
        'step 4': 4, 'step_4': 4, 'deliver': 4, '4': 4,
        'step 5': 5, 'step_5': 5, 'repurchase': 5, '5': 5,
    }
    
    return stage_patterns.get(stage_str)

def validate_email_format(email: str) -> bool:
    """Basic email format validation"""
    if not email:
        return False
    pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    return bool(re.match(pattern, email.strip()))

def normalize_linkedin_url(url: str) -> Optional[str]:
    """Normalize LinkedIn URL"""
    if not url:
        return None
    
    url = url.strip()
    
    # Already a valid LinkedIn URL
    if 'linkedin.com/in/' in url.lower():
        return url
    
    # Just the username
    if not url.startswith('http'):
        return f"https://linkedin.com/in/{url}"
    
    return url

def split_multivalue(value: str, separator: str = ";") -> List[str]:
    """Split a multi-value field"""
    if not value:
        return []
    
    if separator in value:
        return [v.strip() for v in value.split(separator) if v.strip()]
    
    # Try common separators if specified one not found
    for sep in [';', '|', ',']:
        if sep in value and sep != separator:
            return [v.strip() for v in value.split(sep) if v.strip()]
    
    return [value.strip()] if value.strip() else []


# ============ ENDPOINTS ============

@router.post("/upload")
async def upload_csv(
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user)
):
    """
    Step 1: Upload CSV file and get preview
    Returns batch_id, detected settings, headers, and preview rows
    """
    if not file.filename.endswith('.csv'):
        raise HTTPException(status_code=400, detail="File must be a CSV")
    
    # Read file content
    content = await file.read()
    try:
        # Try UTF-8 first
        text_content = content.decode('utf-8')
    except UnicodeDecodeError:
        try:
            # Try Latin-1 as fallback
            text_content = content.decode('latin-1')
        except UnicodeDecodeError:
            raise HTTPException(status_code=400, detail="Unable to decode file. Please use UTF-8 encoding.")
    
    # Detect delimiter
    delimiter = detect_delimiter(text_content)
    
    # Parse CSV
    parse_result = parse_csv_content(text_content, delimiter, has_headers=True)
    headers = parse_result[0]
    rows = parse_result[1]
    duplicate_groups = parse_result[2] if len(parse_result) > 2 else {}
    
    if not headers:
        raise HTTPException(status_code=400, detail="CSV file is empty or invalid")
    
    # Create batch record
    batch_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    
    batch = {
        "batch_id": batch_id,
        "user_id": current_user.get("id"),
        "user_email": current_user.get("email"),
        "created_at": now,
        "updated_at": now,
        "status": "uploaded",  # uploaded, mapped, validated, running, completed, failed
        "original_filename": file.filename,
        "raw_content": text_content,  # Store for later processing
        "detected_delimiter": delimiter,
        "detected_columns": len(headers),
        "total_rows": len(rows),
        "headers": headers,
        "duplicate_column_groups": duplicate_groups,  # Track duplicate columns
        "config": {
            "delimiter": delimiter,
            "has_headers": True,
            "default_country_code": "+52",
            "multivalue_separator": ";",
            "upsert_policy": "UPDATE_EXISTING",
            "strict_mode": False,
            "overwrite_empty": False
        },
        "mappings": [],
        "results": {
            "created": 0,
            "updated": 0,
            "skipped": 0,
            "errors": 0,
            "warnings": 0
        }
    }
    
    await db.import_batches.insert_one(batch)
    
    # Return preview (first 20 rows)
    preview_rows = []
    for i, row in enumerate(rows[:20]):
        row_dict = {}
        for j, header in enumerate(headers):
            row_dict[header] = row[j] if j < len(row) else ""
        preview_rows.append({"index": i, "data": row_dict})
    
    return {
        "batch_id": batch_id,
        "filename": file.filename,
        "detected_delimiter": delimiter,
        "has_headers": True,
        "headers": headers,
        "total_rows": len(rows),
        "preview_rows": preview_rows,
        "suggested_mappings": suggest_mappings(headers)
    }


def suggest_mappings(headers: List[str]) -> List[dict]:
    """Auto-suggest column mappings based on header names"""
    suggestions = []
    
    mapping_hints = {
        'salutation': ['salutation', 'tratamiento', 'title', 'titulo', 'prefix'],
        'first_name': ['first_name', 'firstname', 'nombre', 'first', 'given_name'],
        'last_name': ['last_name', 'lastname', 'apellido', 'last', 'surname', 'family_name'],
        'email': ['email', 'correo', 'e-mail', 'mail', 'email_address'],
        'phone': ['phone', 'telefono', 'tel', 'mobile', 'celular', 'phone_number'],
        'linkedin_url': ['linkedin', 'linkedin_url', 'linkedin_profile'],
        'company': ['company', 'empresa', 'organization', 'org', 'compañia'],
        'job_title': ['job_title', 'title', 'cargo', 'position', 'puesto', 'job'],
        'buyer_persona': ['buyer_persona', 'persona', 'buyer', 'segment'],
        'roles': ['roles', 'role', 'rol', 'type', 'tipo', 'contact_type'],
        'specialty': ['specialty', 'especialidad', 'specialization'],
        'stage': ['stage', 'etapa', 'step', 'pipeline_stage'],
        'notes': ['notes', 'notas', 'comments', 'comentarios'],
    }
    
    for header in headers:
        header_lower = header.lower().strip()
        suggested_field = None
        
        for field, hints in mapping_hints.items():
            for hint in hints:
                if hint in header_lower or header_lower in hint:
                    suggested_field = field
                    break
            if suggested_field:
                break
        
        suggestions.append({
            "csv_column": header,
            "suggested_field": suggested_field,
            "is_primary": suggested_field in ['email', 'phone'] and '2' not in header_lower and '3' not in header_lower
        })
    
    return suggestions


@router.post("/{batch_id}/map")
async def save_mapping(
    batch_id: str,
    request: MappingRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Step 2: Save column mappings and configuration
    """
    batch = await db.import_batches.find_one({"batch_id": batch_id})
    if not batch:
        raise HTTPException(status_code=404, detail="Import batch not found")
    
    # Update batch with mappings
    await db.import_batches.update_one(
        {"batch_id": batch_id},
        {"$set": {
            "mappings": [m.dict() for m in request.mappings],
            "config": request.config.dict(),
            "status": "mapped",
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    return {"success": True, "message": "Mapping saved", "batch_id": batch_id}


@router.post("/{batch_id}/validate")
async def validate_import(
    batch_id: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Step 3 & 4: Validate data and detect duplicates
    Returns validation results and duplicate detection summary
    """
    batch = await db.import_batches.find_one({"batch_id": batch_id})
    if not batch:
        raise HTTPException(status_code=404, detail="Import batch not found")
    
    if not batch.get("mappings"):
        raise HTTPException(status_code=400, detail="No mappings configured. Please complete step 2.")
    
    config = batch.get("config", {})
    mappings = batch.get("mappings", [])
    duplicate_groups = batch.get("duplicate_column_groups", {})
    
    # Parse CSV again
    parse_result = parse_csv_content(
        batch.get("raw_content", ""),
        config.get("delimiter", ","),
        config.get("has_headers", True)
    )
    headers = parse_result[0]
    rows = parse_result[1]
    
    # Build mapping dict: csv_column -> {focus_field, is_primary, separator}
    mapping_dict = {}
    for m in mappings:
        if m.get("focus_field") and m.get("focus_field") != "ignore":
            mapping_dict[m.get("csv_column")] = m
    
    # Get all existing emails for duplicate detection
    existing_contacts = await db.unified_contacts.find(
        {"is_merged": {"$ne": True}},
        {"_id": 0, "id": 1, "email": 1, "emails": 1, "name": 1, "first_name": 1, "last_name": 1}
    ).to_list(50000)
    
    # Build email -> contact_id lookup
    email_to_contact = {}
    for contact in existing_contacts:
        # Check legacy email field
        email_val = contact.get("email")
        if email_val:
            # Handle case where email is a list
            if isinstance(email_val, list):
                email_val = email_val[0] if email_val else ""
            if isinstance(email_val, str) and email_val:
                email_to_contact[email_val.strip().lower()] = contact
        # Check emails array - handle both dict format and string format
        for email_entry in contact.get("emails", []):
            if isinstance(email_entry, dict):
                email_str = email_entry.get("email")
            elif isinstance(email_entry, str):
                email_str = email_entry
            else:
                continue
            if isinstance(email_str, str) and email_str:
                email_to_contact[email_str.strip().lower()] = contact
    
    # Validate each row
    validation_results = []
    to_create = 0
    to_update = 0
    to_skip = 0
    total_warnings = 0
    total_errors = 0
    
    for row_idx, row in enumerate(rows):
        row_data = {}
        for j, header in enumerate(headers):
            value = row[j] if j < len(row) else ""
            
            # Handle duplicate columns - prefer first non-empty value
            # Headers like "Número de teléfono" and "Número de teléfono_2" should consolidate
            base_header = header
            # Check if this is a duplicate suffix (e.g., "Phone_2")
            if '_' in header:
                parts = header.rsplit('_', 1)
                if parts[1].isdigit():
                    base_header = parts[0]
            
            if base_header in row_data:
                # This is a duplicate column - only override if current is empty and new has value
                if not row_data[base_header].strip() and value.strip():
                    row_data[base_header] = value
            else:
                row_data[header] = value
        
        # Process row according to mappings
        processed = process_row(row_data, mapping_dict, config)
        
        # Duplicate detection by email
        matched_contact = None
        for email_entry in processed.get("emails", []):
            email_lower = email_entry.get("email", "").lower()
            if email_lower in email_to_contact:
                matched_contact = email_to_contact[email_lower]
                break
        
        # Determine action based on upsert policy
        upsert_policy = config.get("upsert_policy", "UPDATE_EXISTING")
        action = "create"
        
        if matched_contact:
            if upsert_policy == "CREATE_ONLY":
                action = "skip"
                to_skip += 1
            elif upsert_policy == "UPDATE_EXISTING":
                action = "update"
                to_update += 1
            else:  # CREATE_DUPLICATE
                action = "create"
                to_create += 1
        else:
            to_create += 1
        
        # Count warnings and errors
        row_warnings = len(processed.get("warnings", []))
        row_errors = len(processed.get("errors", []))
        total_warnings += row_warnings
        total_errors += row_errors
        
        validation_results.append({
            "row_index": row_idx,
            "original_data": row_data,
            "processed_data": {k: v for k, v in processed.items() if k not in ["warnings", "errors"]},
            "action": action,
            "matched_contact": {
                "id": matched_contact.get("id"),
                "name": matched_contact.get("name") or f"{matched_contact.get('first_name', '')} {matched_contact.get('last_name', '')}".strip()
            } if matched_contact else None,
            "warnings": processed.get("warnings", []),
            "errors": processed.get("errors", [])
        })
    
    # Store validation results
    await db.import_batches.update_one(
        {"batch_id": batch_id},
        {"$set": {
            "status": "validated",
            "validation_results": validation_results,
            "validation_summary": {
                "to_create": to_create,
                "to_update": to_update,
                "to_skip": to_skip,
                "warnings": total_warnings,
                "errors": total_errors
            },
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    return {
        "batch_id": batch_id,
        "total_rows": len(rows),
        "to_create": to_create,
        "to_update": to_update,
        "to_skip": to_skip,
        "warnings": total_warnings,
        "errors": total_errors,
        "can_proceed": total_errors == 0 or not config.get("strict_mode", False),
        "preview_results": validation_results[:20]  # First 20 for preview
    }


def process_row(row_data: dict, mapping_dict: dict, config: dict) -> dict:
    """Process a single row according to mappings"""
    result = {
        "emails": [],
        "phones": [],
        "roles": [],
        "warnings": [],
        "errors": []
    }
    
    default_country = config.get("default_country_code", "+52")
    multivalue_sep = config.get("multivalue_separator", ";")
    
    for csv_column, value in row_data.items():
        if csv_column not in mapping_dict:
            continue
        
        mapping = mapping_dict[csv_column]
        focus_field = mapping.get("focus_field")
        is_primary = mapping.get("is_primary", False)
        separator = mapping.get("separator") or multivalue_sep
        
        if not value or not value.strip():
            continue
        
        value = value.strip()
        
        # Process based on field type
        if focus_field == "email":
            emails = split_multivalue(value, separator)
            for i, email in enumerate(emails):
                email_normalized = email.strip().lower()
                if validate_email_format(email_normalized):
                    result["emails"].append({
                        "email": email_normalized,
                        "is_primary": is_primary and i == 0
                    })
                else:
                    result["warnings"].append(f"Invalid email format: {email}")
        
        elif focus_field == "phone":
            # PHONE IMPORT: Store raw values without blocking validation
            # Phones are stored as-is from CSV, normalization is optional and non-blocking
            phones = split_multivalue(value, separator)
            for i, phone in enumerate(phones):
                phone_raw = phone.strip()
                if phone_raw:
                    # Create phone entry with raw value
                    phone_entry = {
                        "raw_input": phone_raw,
                        "is_primary": is_primary and i == 0,
                        "is_valid": None,  # Validation is deferred/optional
                        "e164": None,  # E.164 normalization is optional
                        "country_code": None,
                        "national_number": None,
                        "label": "mobile"
                    }
                    
                    # Attempt optional normalization (non-blocking)
                    try:
                        normalized = normalize_phone_to_e164(phone_raw, config.get("default_country_code", "+52"))
                        if normalized:
                            phone_entry["e164"] = normalized.get("e164")
                            phone_entry["country_code"] = normalized.get("country_code")
                            phone_entry["national_number"] = normalized.get("national_number")
                            phone_entry["is_valid"] = normalized.get("is_valid", None)
                            # Only add warning if normalization suggests potential issue
                            if normalized.get("is_valid") == False:
                                result["warnings"].append({
                                    "code": "PHONE_NOT_VALIDATED",
                                    "detail": phone_raw,
                                    "message": f"Phone format may need review: {phone_raw}"
                                })
                    except Exception:
                        # Normalization failed - not an error, just store raw
                        result["warnings"].append({
                            "code": "PHONE_NOT_VALIDATED", 
                            "detail": phone_raw,
                            "message": f"Phone stored as-is: {phone_raw}"
                        })
                    
                    result["phones"].append(phone_entry)
        
        elif focus_field == "roles":
            roles = split_multivalue(value, separator)
            for role in roles:
                normalized_role = normalize_role(role)
                if normalized_role:
                    if normalized_role not in result["roles"]:
                        result["roles"].append(normalized_role)
                else:
                    result["warnings"].append(f"Unknown role: {role}")
        
        elif focus_field == "stage":
            stage = normalize_stage(value)
            if stage:
                result["stage"] = stage
            else:
                result["warnings"].append(f"Invalid stage value: {value}")
        
        elif focus_field == "linkedin_url":
            result["linkedin_url"] = normalize_linkedin_url(value)
        
        elif focus_field in ["salutation", "first_name", "last_name", "company", "job_title", 
                            "buyer_persona", "specialty", "notes", "location", "country"]:
            result[focus_field] = value
    
    # Set primary email/phone if none marked
    if result["emails"] and not any(e.get("is_primary") for e in result["emails"]):
        result["emails"][0]["is_primary"] = True
    
    if result["phones"] and not any(p.get("is_primary") for p in result["phones"]):
        result["phones"][0]["is_primary"] = True
    
    # Compute name if not provided
    if result.get("first_name") or result.get("last_name"):
        parts = [result.get("salutation", ""), result.get("first_name", ""), result.get("last_name", "")]
        result["name"] = " ".join(p for p in parts if p).strip()
    
    return result


@router.post("/{batch_id}/run")
async def run_import(
    batch_id: str,
    event_id: str = None,
    send_calendar_invite: bool = True,
    calendar_description: str = None,
    calendar_location: str = None,
    current_user: dict = Depends(get_current_user)
):
    """
    Step 5: Execute the import
    Creates/updates contacts based on validation results
    If event_id is provided, also adds webinar_history entry
    If send_calendar_invite is True, creates Google Calendar events for attendees
    
    Args:
        calendar_description: Custom description for calendar invite (overrides event description)
        calendar_location: Location to show in calendar invite
    """
    batch = await db.import_batches.find_one({"batch_id": batch_id})
    if not batch:
        raise HTTPException(status_code=404, detail="Import batch not found")
    
    if batch.get("status") not in ["validated", "mapped"]:
        raise HTTPException(status_code=400, detail="Please validate the import first")
    
    validation_results = batch.get("validation_results", [])
    if not validation_results:
        raise HTTPException(status_code=400, detail="No validation results found. Please run validation first.")
    
    # If importing for an event with calendar invites, verify calendar is connected FIRST
    if event_id and send_calendar_invite:
        from routers.events_v2 import get_youtube_credentials
        creds = await get_youtube_credentials()
        if not creds:
            raise HTTPException(
                status_code=400, 
                detail="Google Calendar no está conectado. Ve a Configuración → Integraciones para conectarlo antes de importar registrantes."
            )
    
    config = batch.get("config", {})
    
    # If importing for an event, get event details
    event = None
    if event_id:
        event = await db.webinar_events_v2.find_one({"id": event_id}, {"_id": 0})
    
    # Update status to running
    await db.import_batches.update_one(
        {"batch_id": batch_id},
        {"$set": {"status": "running", "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    created = 0
    updated = 0
    skipped = 0
    errors = 0
    error_details = []
    new_emails_for_calendar = []  # Track new emails for calendar invites
    
    now = datetime.now(timezone.utc).isoformat()
    
    # Prepare webinar_history entry if importing for event
    webinar_entry = None
    if event:
        webinar_entry = {
            "event_id": event_id,
            "event_name": event.get("name", ""),
            "status": "registered",
            "registered_at": now,
            "source": "csv_import"
        }
    
    for result in validation_results:
        action = result.get("action")
        processed_data = result.get("processed_data", {})
        matched_contact = result.get("matched_contact")
        row_index = result.get("row_index")
        
        try:
            if action == "skip":
                skipped += 1
                continue
            
            # Auto-classify buyer persona based on job title keywords if not provided
            # MIGRATION: Now uses centralized persona_classifier_service
            job_title = processed_data.get("job_title", "")
            if job_title and not processed_data.get("buyer_persona"):
                from services.persona_classifier_service import classify_job_title_with_name, normalize_job_title
                bp_id, bp_name = await classify_job_title_with_name(db, job_title, use_cache=True)
                processed_data["buyer_persona"] = bp_name
                processed_data["job_title_normalized"] = normalize_job_title(job_title)
            
            if action == "create":
                # Create new contact
                # For phone field, prefer raw_input over e164 to preserve original format
                phone_list = processed_data.get("phones", [])
                primary_phone = ""
                if phone_list:
                    first_phone = phone_list[0]
                    primary_phone = first_phone.get("raw_input") or first_phone.get("e164") or ""
                
                new_contact = {
                    "id": str(uuid.uuid4()),
                    "salutation": processed_data.get("salutation", ""),
                    "first_name": processed_data.get("first_name", ""),
                    "last_name": processed_data.get("last_name", ""),
                    "name": processed_data.get("name", ""),
                    "email": processed_data.get("emails", [{}])[0].get("email", "") if processed_data.get("emails") else "",
                    "emails": processed_data.get("emails", []),
                    "phone": primary_phone,
                    "phones": processed_data.get("phones", []),
                    "linkedin_url": processed_data.get("linkedin_url", ""),
                    "company": processed_data.get("company", ""),
                    "job_title": processed_data.get("job_title", ""),
                    "buyer_persona": processed_data.get("buyer_persona") or "mateo",
                    "roles": processed_data.get("roles", []),
                    "contact_types": processed_data.get("roles", []),
                    "specialty": processed_data.get("specialty", ""),
                    "location": processed_data.get("location", ""),
                    "country": processed_data.get("country", ""),
                    "stage": processed_data.get("stage", 2 if event else 1),  # Stage 2 if for event
                    "notes": processed_data.get("notes", ""),
                    "source": "event_import" if event else "import",
                    "source_details": {"batch_id": batch_id, "row_index": row_index, "event_id": event_id} if event else {"batch_id": batch_id, "row_index": row_index},
                    "status": "new",
                    "created_at": now,
                    "updated_at": now,
                    "is_merged": False,
                    "merged_from_contact_ids": [],
                    "webinar_history": [webinar_entry] if webinar_entry else []
                }
                
                await db.unified_contacts.insert_one(new_contact)
                created += 1
                # Track email for calendar invite
                email = processed_data.get("emails", [{}])[0].get("email", "") if processed_data.get("emails") else ""
                if email and event:
                    new_emails_for_calendar.append(email)
            
            elif action == "update" and matched_contact:
                # Update existing contact
                contact_id = matched_contact.get("id")
                existing = await db.unified_contacts.find_one({"id": contact_id})
                
                if existing:
                    update_data = {"updated_at": now}
                    overwrite_empty = config.get("overwrite_empty", False)
                    
                    # Update simple fields (don't overwrite with empty unless configured)
                    for field in ["salutation", "first_name", "last_name", "name", "linkedin_url", 
                                  "company", "job_title", "buyer_persona", "specialty", "notes",
                                  "location", "country"]:
                        new_value = processed_data.get(field)
                        if new_value or overwrite_empty:
                            update_data[field] = new_value or ""
                    
                    # Auto-classify buyer persona if existing contact doesn't have one
                    # MIGRATION: Now uses centralized persona_classifier_service
                    # Respects buyer_persona_locked flag
                    existing_bp = existing.get("buyer_persona")
                    is_locked = existing.get("buyer_persona_locked", False)
                    
                    if not is_locked and (not existing_bp or existing_bp == "mateo"):
                        new_job_title = processed_data.get("job_title") or existing.get("job_title", "")
                        if new_job_title:
                            from services.persona_classifier_service import classify_job_title_with_name, normalize_job_title
                            bp_id, auto_bp = await classify_job_title_with_name(db, new_job_title, use_cache=True)
                            if auto_bp != "Mateo" or not existing_bp:
                                update_data["buyer_persona"] = auto_bp
                                update_data["job_title_normalized"] = normalize_job_title(new_job_title)
                    
                    # Update stage - special logic for event imports
                    current_stage = existing.get("stage", 1)
                    if event:
                        # For event imports: set to Stage 2 only if current stage is 1 or 2
                        # Keep stages 3, 4, 5 intact
                        if current_stage in [1, 2]:
                            update_data["stage"] = 2
                        # else: don't modify stage (keep 3, 4, or 5)
                    elif processed_data.get("stage"):
                        # For regular imports: use the stage from CSV if provided
                        update_data["stage"] = processed_data["stage"]
                    
                    # Merge emails (add new, don't duplicate)
                    existing_emails = {e.get("email", "").lower() for e in existing.get("emails", [])}
                    new_emails = existing.get("emails", [])[:]
                    for email_entry in processed_data.get("emails", []):
                        if email_entry.get("email", "").lower() not in existing_emails:
                            new_emails.append(email_entry)
                    update_data["emails"] = new_emails
                    update_data["email"] = new_emails[0].get("email", "") if new_emails else ""
                    
                    # Merge phones - use raw_input as the key for deduplication
                    existing_phones = set()
                    for p in existing.get("phones", []):
                        phone_key = p.get("raw_input", "") or p.get("e164", "")
                        if phone_key:
                            existing_phones.add(phone_key)
                    
                    new_phones = existing.get("phones", [])[:]
                    for phone_entry in processed_data.get("phones", []):
                        phone_key = phone_entry.get("raw_input", "") or phone_entry.get("e164", "")
                        if phone_key and phone_key not in existing_phones:
                            new_phones.append(phone_entry)
                            existing_phones.add(phone_key)
                    
                    update_data["phones"] = new_phones
                    # Use raw_input for the legacy phone field
                    if new_phones:
                        first_phone = new_phones[0]
                        update_data["phone"] = first_phone.get("raw_input") or first_phone.get("e164") or ""
                    else:
                        update_data["phone"] = ""
                    
                    # Merge roles
                    existing_roles = set(existing.get("roles", []) + existing.get("contact_types", []))
                    new_roles = list(existing_roles.union(set(processed_data.get("roles", []))))
                    update_data["roles"] = new_roles
                    update_data["contact_types"] = new_roles
                    
                    # Add webinar_history if importing for an event
                    if webinar_entry:
                        existing_webinar_history = existing.get("webinar_history", [])
                        # Check if already registered for this event
                        already_registered = any(
                            w.get("event_id") == event_id for w in existing_webinar_history
                        )
                        if not already_registered:
                            update_data["webinar_history"] = existing_webinar_history + [webinar_entry]
                            # Track email for calendar invite (only new registrations)
                            contact_email = existing.get("email", "")
                            if contact_email:
                                new_emails_for_calendar.append(contact_email)
                    
                    await db.unified_contacts.update_one(
                        {"id": contact_id},
                        {"$set": update_data}
                    )
                    updated += 1
                else:
                    errors += 1
                    error_details.append({"row_index": row_index, "error": "Matched contact not found"})
        
        except Exception as e:
            errors += 1
            error_details.append({"row_index": row_index, "error": str(e)})
            logger.error(f"Import error at row {row_index}: {e}")
    
    # Create Google Calendar events if requested and importing for an event
    # Note: Calendar credentials are already verified at the start of this function
    calendar_events_created = 0
    if event and send_calendar_invite and new_emails_for_calendar:
        try:
            from routers.events_v2 import create_calendar_events_for_webinar
            import os
            
            frontend_url = os.environ.get('REACT_APP_BACKEND_URL', 'https://persona-assets.preview.emergentagent.com')
            watching_room_url = f"{frontend_url}/lms/webinar/{event_id}"
            
            # Use custom description/location if provided, otherwise use event defaults
            final_description = calendar_description if calendar_description is not None else event.get("description", "")
            final_location = calendar_location if calendar_location is not None else ""
            
            calendar_event_ids = await create_calendar_events_for_webinar(
                event_id=event_id,
                event_name=event.get("name", ""),
                event_description=final_description,
                event_date=event.get("webinar_date", ""),
                event_time=event.get("webinar_time", "10:00"),
                watching_room_url=watching_room_url,
                attendee_emails=new_emails_for_calendar,
                location=final_location
            )
            calendar_events_created = len(calendar_event_ids)
            
            # Save calendar event IDs to webinar
            if calendar_event_ids:
                await db.webinar_events_v2.update_one(
                    {"id": event_id},
                    {
                        "$addToSet": {"google_calendar_event_ids": {"$each": calendar_event_ids}},
                        "$set": {"updated_at": datetime.now(timezone.utc).isoformat()}
                    }
                )
        except Exception as e:
            logger.error(f"Error creating calendar events: {e}")
            raise HTTPException(status_code=500, detail=f"Error al crear invitaciones de calendario: {str(e)}")
    
    # Schedule email reminders (E6-E10) for the imported registrants
    email_scheduled = {"E6": 0, "E7": 0, "E8": 0, "E9": 0, "E10": 0}
    try:
        from services.email_scheduler import email_scheduler
        
        # Schedule E6 (pre-registration confirmation) for new imports
        e6_count = await schedule_e6_for_batch(event_id, created + updated)
        email_scheduled["E6"] = e6_count
        
        # Schedule E7-E10 (webinar reminders) for the event
        reminder_counts = await email_scheduler.schedule_webinar_reminders(event_id)
        email_scheduled.update(reminder_counts)
        
        logger.info(f"Scheduled emails for event {event_id}: {email_scheduled}")
    except Exception as e:
        logger.error(f"Error scheduling email reminders: {e}")
        # Don't fail the import if email scheduling fails
    
    # Update batch with final results
    await db.import_batches.update_one(
        {"batch_id": batch_id},
        {"$set": {
            "status": "completed",
            "results": {
                "created": created,
                "updated": updated,
                "skipped": skipped,
                "errors": errors,
                "warnings": batch.get("validation_summary", {}).get("warnings", 0),
                "calendar_events_created": calendar_events_created
            },
            "error_details": error_details[:100],  # Store first 100 errors
            "completed_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    return {
        "batch_id": batch_id,
        "status": "completed",
        "created": created,
        "updated": updated,
        "skipped": skipped,
        "errors": errors,
        "error_details": error_details[:10],  # Return first 10 errors
        "calendar_events_created": calendar_events_created,
        "emails_scheduled": email_scheduled
    }


async def schedule_e6_for_batch(event_id: str, contacts_imported: int) -> int:
    """
    Schedule E6 confirmation emails for contacts imported to a webinar.
    E6 is sent once per webinar to confirm pre-registration.
    """
    from services.email_queue import email_queue
    
    if contacts_imported == 0:
        return 0
    
    # Get event details
    event = await db.webinar_events_v2.find_one({"id": event_id}, {"_id": 0, "name": 1})
    event_name = event.get("name", "Webinar") if event else "Webinar"
    
    # Find contacts recently added to this event
    now = datetime.now(timezone.utc)
    one_hour_ago = (now - timedelta(hours=1)).isoformat()
    
    # Get contacts with recent registration to this event
    contacts = await db.unified_contacts.find({
        "webinar_history": {
            "$elemMatch": {
                "event_id": event_id,
                "registered_at": {"$gte": one_hour_ago}
            }
        },
        f"last_email_e6_sent.{event_id}": {"$exists": False}  # Not already sent E6 for this event
    }, {"_id": 0, "id": 1, "email": 1, "emails": 1, "name": 1, "first_name": 1}).to_list(1000)
    
    scheduled = 0
    for contact in contacts:
        contact_id = contact.get("id")
        contact_email = contact.get("email") or (contact.get("emails", [{}])[0].get("email") if contact.get("emails") else None)
        contact_name = contact.get("name") or contact.get("first_name") or "Participante"
        
        if not contact_email:
            continue
        
        # Check if already queued
        existing = await db.email_queue.find_one({
            "contact_id": contact_id,
            "rule": "E6",
            "metadata.webinar_id": event_id,
            "status": {"$in": ["pending", "sent"]}
        })
        
        if existing:
            continue
        
        # Queue E6 email
        await email_queue.add_to_queue(
            rule="E6",
            contact_id=contact_id,
            contact_email=contact_email,
            contact_name=contact_name,
            subject=f"✅ Tu pre-registro a {event_name} está completo",
            body_html=_get_e6_template(contact_name, event_name),
            scheduled_at=now,  # Send immediately
            metadata={"webinar_id": event_id, "event_name": event_name}
        )
        scheduled += 1
    
    return scheduled


def _get_e6_template(contact_name: str, event_name: str) -> str:
    """Get HTML template for E6 pre-registration confirmation"""
    first_name = contact_name.split()[0] if contact_name else "Participante"
    return f"""
    <p>¡Hola {first_name}!</p>
    <p>Tu <strong>pre-registro</strong> a <strong>{event_name}</strong> se ha completado con éxito. 🎉</p>
    <p>Para <strong>completar tu registro</strong>, necesitamos que nos confirmes los datos de los participantes.</p>
    <p><strong>Por favor responde este correo con la siguiente información:</strong></p>
    <ul>
        <li>Nombre completo de cada participante</li>
        <li>Correo electrónico de cada participante</li>
        <li>Teléfono de contacto de cada participante</li>
    </ul>
    <p><em>Puedes registrar hasta 10 participantes de tu equipo.</em></p>
    <p>Ejemplo de respuesta:</p>
    <div style="background: #f5f5f5; padding: 15px; border-radius: 8px; margin: 15px 0; color: #333;">
        <p style="margin: 5px 0;">1. Juan Pérez - juan@empresa.com - +52 55 1234 5678</p>
        <p style="margin: 5px 0;">2. María García - maria@empresa.com - +52 55 8765 4321</p>
    </div>
    <p>Una vez que recibamos esta información, te enviaremos la confirmación final con los detalles del evento.</p>
    <p>¡Gracias por tu interés!</p>
    """


@router.get("/{batch_id}/status")
async def get_import_status(
    batch_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get the current status of an import batch"""
    batch = await db.import_batches.find_one({"batch_id": batch_id}, {"_id": 0, "raw_content": 0})
    if not batch:
        raise HTTPException(status_code=404, detail="Import batch not found")
    
    return batch


@router.get("/{batch_id}/report")
async def get_import_report(
    batch_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get detailed import report"""
    batch = await db.import_batches.find_one({"batch_id": batch_id}, {"_id": 0, "raw_content": 0})
    if not batch:
        raise HTTPException(status_code=404, detail="Import batch not found")
    
    return {
        "batch_id": batch_id,
        "filename": batch.get("original_filename"),
        "status": batch.get("status"),
        "created_at": batch.get("created_at"),
        "completed_at": batch.get("completed_at"),
        "config": batch.get("config"),
        "results": batch.get("results"),
        "validation_summary": batch.get("validation_summary"),
        "error_details": batch.get("error_details", []),
        "total_rows": batch.get("total_rows")
    }


@router.get("")
async def list_import_batches(
    limit: int = 20,
    current_user: dict = Depends(get_current_user)
):
    """List recent import batches"""
    pipeline = [
        {"$project": {"raw_content": 0, "validation_results": 0, "_id": 0}},
        {"$sort": {"created_at": -1}},
        {"$limit": limit}
    ]
    batches = await db.import_batches.aggregate(pipeline, allowDiskUse=True).to_list(limit)
    
    return {"batches": batches}
