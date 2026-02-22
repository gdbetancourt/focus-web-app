"""
LinkedIn Import Worker V2 - Robust Background Processor

This worker is integrated into the scheduler_worker.py system.
It processes LinkedIn import jobs with:
- Streaming file processing (not loading all in memory)
- Bulk database operations
- Heartbeat for liveness detection
- Orphaned job recovery
- Automatic retries
- Profile locking to prevent concurrent imports

Architecture:
- Called every 10 seconds by APScheduler
- Uses MongoDB for job queue (persistent)
- Locks prevent concurrent processing of same profile
"""

import asyncio
import os
import csv
import re
import uuid
import traceback
from datetime import datetime, timezone, timedelta
from typing import Optional, Dict, List, Any
from pymongo import UpdateOne, InsertOne
from pymongo.errors import BulkWriteError
import logging

# Import database from main app
from database import db

# Configure logging
logger = logging.getLogger('linkedin_import_worker')

# Configuration
BATCH_SIZE = 500
HEARTBEAT_INTERVAL = 30  # seconds
ORPHAN_TIMEOUT = 300  # 5 minutes - job considered orphaned if no heartbeat
MAX_ATTEMPTS = 3
WORKER_ID = f"worker_{os.getpid()}"
CONFLICT_TTL_DAYS = 90  # Days to retain conflicts before auto-deletion
ERROR_DETAIL_TTL_DAYS = 90  # Days to retain error details

# Retry backoff delays (in seconds)
RETRY_BACKOFF = {
    1: 60,      # 1st retry after 1 minute
    2: 300,     # 2nd retry after 5 minutes
    3: 0        # 3rd attempt = final (no more retries)
}

# Error reason codes
class ErrorReasonCode:
    INVALID_MISSING_IDENTIFIERS = "invalid_missing_identifiers"
    CONFLICT_EMAIL_URL_MISMATCH = "conflict_email_url_mismatch"
    CONNECTED_ON_PARSE_FAILED = "connected_on_parse_failed"
    EMAIL_INVALID_FORMAT = "email_invalid_format"
    LINKEDIN_URL_INVALID_FORMAT = "linkedin_url_invalid_format"
    COMPANY_RESOLUTION_FAILURE = "company_resolution_failure"
    UNHANDLED_EXCEPTION = "unhandled_exception"


def get_current_week_start() -> str:
    """Get Monday 00:00 of current week as ISO string"""
    today = datetime.now(timezone.utc)
    monday = today - timedelta(days=today.weekday())
    monday = monday.replace(hour=0, minute=0, second=0, microsecond=0)
    return monday.date().isoformat()


def normalize_linkedin_url(url: str) -> Optional[str]:
    """Normalize LinkedIn URL for consistent matching"""
    if not url:
        return None
    url = str(url).strip().lower()
    url = url.rstrip('/')
    url = re.sub(r'\?.*$', '', url)
    url = re.sub(r'/overlay/.*$', '', url)
    return url if url else None


def normalize_email(email: str) -> Optional[str]:
    """Normalize email for consistent matching"""
    if not email:
        return None
    return str(email).strip().lower()


def parse_linkedin_date(date_str: str) -> Optional[str]:
    """
    Parse LinkedIn date format robustly.
    
    Supported formats:
    - "09 feb 2026"
    - "02 Dic 2025" 
    - "02 Dec 2025"
    - "09-feb-2026"
    - "09/feb/2026"
    
    Supports months in Spanish and English (case-insensitive).
    Returns ISO format string (YYYY-MM-DD) or None if parsing fails.
    """
    if not date_str or not isinstance(date_str, str):
        return None
    
    # Month mappings (lowercase, 3-letter abbreviations)
    month_map = {
        # English
        'jan': 1, 'feb': 2, 'mar': 3, 'apr': 4, 'may': 5, 'jun': 6,
        'jul': 7, 'aug': 8, 'sep': 9, 'oct': 10, 'nov': 11, 'dec': 12,
        # Spanish (those that differ from English)
        'ene': 1, 'abr': 4, 'ago': 8, 'dic': 12,
        # Spanish full month names
        'enero': 1, 'febrero': 2, 'marzo': 3, 'abril': 4, 'mayo': 5, 'junio': 6,
        'julio': 7, 'agosto': 8, 'septiembre': 9, 'octubre': 10, 'noviembre': 11, 'diciembre': 12,
    }
    
    try:
        # Clean the string
        cleaned = date_str.strip().lower()
        
        # Replace common separators with spaces
        for sep in ['-', '/', '.', ',']:
            cleaned = cleaned.replace(sep, ' ')
        
        # Split and filter empty parts
        parts = [p for p in cleaned.split() if p]
        
        if len(parts) != 3:
            return None
        
        # Extract day, month, year
        day = int(parts[0])
        month_str = parts[1][:3]  # First 3 letters for abbreviation matching
        year = int(parts[2])
        
        # Try full month name first, then abbreviation
        month = month_map.get(parts[1]) or month_map.get(month_str)
        
        if not month:
            return None
        
        # Validate date ranges
        if year < 1900 or year > 2100:
            return None
        if month < 1 or month > 12:
            return None
        if day < 1 or day > 31:
            return None
        
        # Additional validation for specific months
        days_in_month = {
            1: 31, 2: 29, 3: 31, 4: 30, 5: 31, 6: 30,
            7: 31, 8: 31, 9: 30, 10: 31, 11: 30, 12: 31
        }
        if day > days_in_month.get(month, 31):
            return None
        
        # Extra check for February in non-leap years
        if month == 2 and day == 29:
            is_leap = (year % 4 == 0 and year % 100 != 0) or (year % 400 == 0)
            if not is_leap:
                return None
        
        # Return ISO format YYYY-MM-DD
        return f"{year}-{month:02d}-{day:02d}"
        
    except (ValueError, IndexError, TypeError):
        return None


async def ensure_indexes():
    """Ensure required indexes exist"""
    try:
        await db.linkedin_import_jobs.create_index("status")
        await db.linkedin_import_jobs.create_index([("status", 1), ("heartbeat_at", 1)])
        await db.linkedin_import_jobs.create_index([("profile", 1), ("week_start", 1)])
        await db.linkedin_import_locks.create_index("profile", unique=True)
        
        # TTL index for conflicts - auto-delete after 90 days
        await db.linkedin_import_conflicts.create_index(
            "created_at",
            expireAfterSeconds=CONFLICT_TTL_DAYS * 24 * 60 * 60
        )
        await db.linkedin_import_conflicts.create_index("job_id")
        
        # TTL index for invalid rows - auto-delete after 90 days
        await db.linkedin_import_invalid_rows.create_index(
            "created_at",
            expireAfterSeconds=ERROR_DETAIL_TTL_DAYS * 24 * 60 * 60
        )
        await db.linkedin_import_invalid_rows.create_index("job_id")
        
        # TTL index for parse failures - auto-delete after 90 days
        await db.linkedin_import_parse_failures.create_index(
            "created_at",
            expireAfterSeconds=ERROR_DETAIL_TTL_DAYS * 24 * 60 * 60
        )
        await db.linkedin_import_parse_failures.create_index("job_id")
        
        logger.info(f"TTL indexes created: errors expire after {ERROR_DETAIL_TTL_DAYS} days")
    except Exception as e:
        logger.warning(f"Index creation warning (may already exist): {e}")


async def acquire_profile_lock(profile: str, job_id: str) -> bool:
    """
    Acquire exclusive lock for a profile using MongoDB.
    Uses TTL index for automatic expiration.
    """
    try:
        expires_at = datetime.now(timezone.utc) + timedelta(seconds=ORPHAN_TIMEOUT)
        
        result = await db.linkedin_import_locks.update_one(
            {
                "profile": profile,
                "$or": [
                    {"expires_at": {"$lt": datetime.now(timezone.utc)}},
                    {"job_id": job_id}  # Allow same job to re-acquire
                ]
            },
            {
                "$set": {
                    "profile": profile,
                    "job_id": job_id,
                    "worker_id": WORKER_ID,
                    "acquired_at": datetime.now(timezone.utc),
                    "expires_at": expires_at
                }
            },
            upsert=True
        )
        
        if result.modified_count > 0 or result.upserted_id:
            logger.info(f"Acquired lock for profile {profile}, job {job_id}")
            return True
        
        # Check if we already have the lock
        existing = await db.linkedin_import_locks.find_one({"profile": profile, "job_id": job_id})
        if existing:
            return True
            
        return False
        
    except Exception as e:
        logger.warning(f"Failed to acquire lock for {profile}: {e}")
        return False


async def release_profile_lock(profile: str, job_id: str):
    """Release the profile lock"""
    await db.linkedin_import_locks.delete_one({
        "profile": profile,
        "job_id": job_id
    })
    logger.info(f"Released lock for profile {profile}")


async def refresh_lock(profile: str, job_id: str):
    """Refresh lock expiration time"""
    expires_at = datetime.now(timezone.utc) + timedelta(seconds=ORPHAN_TIMEOUT)
    await db.linkedin_import_locks.update_one(
        {"profile": profile, "job_id": job_id},
        {"$set": {"expires_at": expires_at}}
    )


async def update_heartbeat(job_id: str, progress_data: dict):
    """Update job heartbeat and progress"""
    await db.linkedin_import_jobs.update_one(
        {"job_id": job_id},
        {
            "$set": {
                "heartbeat_at": datetime.now(timezone.utc).isoformat(),
                "worker_id": WORKER_ID,
                **progress_data
            }
        }
    )


async def recover_orphaned_jobs():
    """Find and recover jobs that were abandoned (no heartbeat)"""
    cutoff = datetime.now(timezone.utc) - timedelta(seconds=ORPHAN_TIMEOUT)
    cutoff_str = cutoff.isoformat()
    
    orphaned = await db.linkedin_import_jobs.find({
        "status": "processing",
        "$or": [
            {"heartbeat_at": {"$lt": cutoff_str}},
            {"heartbeat_at": {"$exists": False}}
        ]
    }).to_list(100)
    
    now = datetime.now(timezone.utc)
    
    for job in orphaned:
        attempts = job.get("attempts", 0)
        job_id = job["job_id"]
        
        if attempts >= MAX_ATTEMPTS:
            logger.warning(f"Job {job_id} exceeded max attempts ({MAX_ATTEMPTS}), marking as failed")
            await db.linkedin_import_jobs.update_one(
                {"job_id": job_id},
                {
                    "$set": {
                        "status": "failed",
                        "error_summary": f"Exceeded max attempts ({MAX_ATTEMPTS}). Last worker: {job.get('worker_id')}",
                        "completed_at": now.isoformat()
                    }
                }
            )
            await db.linkedin_import_locks.delete_one({"job_id": job_id})
        else:
            # Calculate retry_after with backoff
            next_attempt = attempts + 1
            backoff_seconds = RETRY_BACKOFF.get(next_attempt, 300)
            retry_after = now + timedelta(seconds=backoff_seconds)
            
            logger.info(f"Recovering orphaned job {job_id} (attempt {next_attempt}, retry after {backoff_seconds}s)")
            await db.linkedin_import_jobs.update_one(
                {"job_id": job_id},
                {
                    "$set": {
                        "status": "pending_retry",
                        "last_error": f"Worker {job.get('worker_id')} died or timed out",
                        "retry_after": retry_after.isoformat()
                    },
                    "$inc": {"attempts": 1}
                }
            )
            await db.linkedin_import_locks.delete_one({"job_id": job_id})


async def find_next_job() -> Optional[dict]:
    """Find next job to process (uploaded or pending_retry with backoff respected)"""
    # First, recover any orphaned jobs
    await recover_orphaned_jobs()
    
    now = datetime.now(timezone.utc)
    now_str = now.isoformat()
    
    # Find next available job, respecting retry_after backoff
    job = await db.linkedin_import_jobs.find_one_and_update(
        {
            "column_mapping": {"$exists": True},
            "$or": [
                # Jobs ready to start
                {"status": "uploaded"},
                # Jobs ready to retry (backoff expired)
                {
                    "status": "pending_retry",
                    "$or": [
                        {"retry_after": {"$lt": now_str}},
                        {"retry_after": {"$exists": False}}
                    ]
                }
            ]
        },
        {
            "$set": {
                "status": "processing",
                "started_at": now_str,
                "heartbeat_at": now_str,
                "worker_id": WORKER_ID
            },
            "$setOnInsert": {"attempts": 0}
        },
        sort=[("created_at", 1)],  # FIFO
        return_document=True
    )
    
    return job


# ============ CLASSIFICATION (MIGRATED TO CENTRALIZED SERVICE) ============
# MIGRATION NOTE: All classification logic is now in /backend/services/persona_classifier_service.py

from services.persona_classifier_service import (
    classify_job_title,
    classify_job_title_with_name,
    normalize_job_title,
    invalidate_classifier_cache,
    pre_classify_for_import,
    ClassificationResult
)


async def classify_buyer_persona(job_title: str) -> str:
    """
    Classify buyer persona based on job title.
    
    MIGRATION: Now uses centralized persona_classifier_service.
    Returns buyer_persona_name for backwards compatibility.
    """
    result = await classify_job_title(db, job_title, use_cache=True)
    return result.buyer_persona_name


async def get_or_create_company(company_name: str) -> Optional[dict]:
    """Get existing company or create new one atomically (single company)"""
    if not company_name:
        return None
    
    normalized_name = company_name.strip().lower()
    now = datetime.now(timezone.utc).isoformat()
    company_id = str(uuid.uuid4())
    
    # Try to find existing (match by normalized_name for case-insensitive matching)
    existing = await db.unified_companies.find_one({
        "normalized_name": normalized_name
    })
    
    if existing:
        return existing
    
    # Create new with upsert to avoid race conditions
    try:
        await db.unified_companies.update_one(
            {"normalized_name": normalized_name},
            {
                "$setOnInsert": {
                    "id": company_id,
                    "name": company_name,
                    "normalized_name": normalized_name,
                    "classification": "outbound",
                    "is_merged": False,
                    "aliases": [],
                    "domains": [],
                    "created_at": now,
                    "updated_at": now,
                    "source": "linkedin_import"
                }
            },
            upsert=True
        )
        
        # Fetch the created/existing document
        return await db.unified_companies.find_one({"normalized_name": normalized_name})
        
    except Exception as e:
        logger.warning(f"Error creating company {company_name}: {e}")
        return await db.unified_companies.find_one({"normalized_name": normalized_name})


async def resolve_companies_bulk(company_names: set) -> dict:
    """
    Resolve multiple companies in bulk - returns dict mapping normalized_name to company doc.
    
    Strategy:
    1. Normalize all names
    2. Find all existing companies with $in query
    3. Create missing companies with bulk upsert
    4. Return mapping
    """
    if not company_names:
        return {}
    
    # Normalize names
    name_mapping = {}  # normalized -> original
    for name in company_names:
        if name:
            normalized = name.strip().lower()
            name_mapping[normalized] = name
    
    if not name_mapping:
        return {}
    
    normalized_names = list(name_mapping.keys())
    now = datetime.now(timezone.utc).isoformat()
    
    # Step 1: Find all existing companies in bulk
    existing_companies = {}
    cursor = db.unified_companies.find({
        "normalized_name": {"$in": normalized_names}
    })
    async for doc in cursor:
        existing_companies[doc["normalized_name"]] = doc
    
    # Step 2: Identify missing companies
    missing_normalized = set(normalized_names) - set(existing_companies.keys())
    
    # Step 3: Create missing companies with bulk upsert
    if missing_normalized:
        bulk_ops = []
        for normalized in missing_normalized:
            original_name = name_mapping[normalized]
            company_id = str(uuid.uuid4())
            
            bulk_ops.append(UpdateOne(
                {"normalized_name": normalized},
                {
                    "$setOnInsert": {
                        "id": company_id,
                        "name": original_name,
                        "normalized_name": normalized,
                        "classification": "outbound",
                        "is_merged": False,
                        "aliases": [],
                        "domains": [],
                        "created_at": now,
                        "updated_at": now,
                        "source": "linkedin_import"
                    }
                },
                upsert=True
            ))
        
        if bulk_ops:
            try:
                await db.unified_companies.bulk_write(bulk_ops, ordered=False)
            except BulkWriteError as e:
                logger.warning(f"Bulk company creation partial error: {e.details}")
        
        # Fetch newly created companies
        cursor = db.unified_companies.find({
            "normalized_name": {"$in": list(missing_normalized)}
        })
        async for doc in cursor:
            existing_companies[doc["normalized_name"]] = doc
    
    return existing_companies


async def process_batch(
    batch: List[dict],
    column_mapping: dict,
    profile: str,
    job_id: str,
    stats: dict,
    company_cache: dict
) -> dict:
    """
    Process a batch of rows using bulk operations.
    Returns updated stats.
    
    company_cache: dict mapping normalized_name -> company document
    """
    now = datetime.now(timezone.utc).isoformat()
    now_dt = datetime.now(timezone.utc)
    
    # Prepare data for all rows - collect errors
    prepared_rows = []
    invalid_rows_to_insert = []
    parse_failures_to_insert = []
    
    for row_number, row in batch:
        data = prepare_row_data(row, column_mapping, row_number)
        
        if not data.get("valid"):
            # Invalid row - save details
            stats["invalid"] += 1
            invalid_rows_to_insert.append({
                "job_id": job_id,
                "profile": profile,
                "week_start": get_current_week_start(),
                "row_number": data.get("row_number"),
                "raw_row": data.get("raw_row", {}),
                "reason_code": data.get("reason_code"),
                "reason_detail": data.get("reason_detail"),
                "created_at": now_dt
            })
        else:
            prepared_rows.append(data)
            
            # Track connected_on parse failures
            if data.get("connected_on_parse_failed"):
                stats["connected_on_parse_failed"] = stats.get("connected_on_parse_failed", 0) + 1
                parse_failures_to_insert.append({
                    "job_id": job_id,
                    "profile": profile,
                    "row_number": data.get("row_number"),
                    "field_name": "connected_on",
                    "raw_value": data.get("connected_on_raw"),
                    "reason_code": ErrorReasonCode.CONNECTED_ON_PARSE_FAILED,
                    "reason_detail": f"Could not parse date: {data.get('connected_on_raw')}",
                    "created_at": now_dt
                })
            
            # Track other parse errors (email format, linkedin format)
            for error in data.get("errors", []):
                if error["reason_code"] == ErrorReasonCode.EMAIL_INVALID_FORMAT:
                    stats["email_invalid_format"] = stats.get("email_invalid_format", 0) + 1
                    parse_failures_to_insert.append({
                        "job_id": job_id,
                        "profile": profile,
                        "row_number": data.get("row_number"),
                        "field_name": error["field_name"],
                        "raw_value": error["raw_value"],
                        "reason_code": error["reason_code"],
                        "reason_detail": error["reason_detail"],
                        "created_at": now_dt
                    })
                elif error["reason_code"] == ErrorReasonCode.LINKEDIN_URL_INVALID_FORMAT:
                    stats["linkedin_url_invalid_format"] = stats.get("linkedin_url_invalid_format", 0) + 1
                    parse_failures_to_insert.append({
                        "job_id": job_id,
                        "profile": profile,
                        "row_number": data.get("row_number"),
                        "field_name": error["field_name"],
                        "raw_value": error["raw_value"][:200] if error["raw_value"] else None,
                        "reason_code": error["reason_code"],
                        "reason_detail": error["reason_detail"],
                        "created_at": now_dt
                    })
    
    if not prepared_rows:
        # Save invalid rows and parse failures even if no valid rows
        if invalid_rows_to_insert:
            await db.linkedin_import_invalid_rows.insert_many(invalid_rows_to_insert)
        if parse_failures_to_insert:
            await db.linkedin_import_parse_failures.insert_many(parse_failures_to_insert)
        return stats
    
    # Enrich prepared_rows with company data from cache
    for data in prepared_rows:
        if data.get("company"):
            normalized_company = data["company"].strip().lower()
            company_doc = company_cache.get(normalized_company)
            if company_doc:
                data["company_id"] = company_doc.get("id")
                data["company_name"] = company_doc.get("name")
    
    # Collect all emails and linkedin URLs for batch lookup
    emails = [r["email"] for r in prepared_rows if r.get("email")]
    linkedin_urls = [r["linkedin_url_normalized"] for r in prepared_rows if r.get("linkedin_url_normalized")]
    
    # Batch lookup existing contacts
    existing_by_email = {}
    existing_by_linkedin = {}
    
    if emails:
        cursor = db.unified_contacts.find({
            "$or": [
                {"email": {"$in": emails}},
                {"emails.email": {"$in": emails}}
            ]
        })
        async for doc in cursor:
            email_key = doc.get("email", "").lower()
            if email_key:
                existing_by_email[email_key] = doc
            for e in doc.get("emails", []):
                if e.get("email"):
                    existing_by_email[e["email"].lower()] = doc
    
    if linkedin_urls:
        cursor = db.unified_contacts.find({
            "linkedin_url_normalized": {"$in": linkedin_urls}
        })
        async for doc in cursor:
            li_key = doc.get("linkedin_url_normalized")
            if li_key:
                existing_by_linkedin[li_key] = doc
    
    # Prepare bulk operations
    bulk_ops = []
    conflicts_to_insert = []
    
    for data in prepared_rows:
        email = data.get("email")
        linkedin_normalized = data.get("linkedin_url_normalized")
        row_number = data["row_number"]
        
        contact_by_email = existing_by_email.get(email) if email else None
        contact_by_linkedin = existing_by_linkedin.get(linkedin_normalized) if linkedin_normalized else None
        
        # Handle conflict: email matches X, linkedin matches Y (different contacts)
        if contact_by_email and contact_by_linkedin:
            if contact_by_email.get("id") != contact_by_linkedin.get("id"):
                conflicts_to_insert.append({
                    "job_id": job_id,
                    "row_number": row_number,
                    "email": email,
                    "linkedin_url": data.get("linkedin_url"),
                    "conflict_type": "email_url_mismatch",
                    "details": f"Email matches {contact_by_email.get('id')} ({contact_by_email.get('name')}), LinkedIn matches {contact_by_linkedin.get('id')} ({contact_by_linkedin.get('name')})",
                    "created_at": now_dt  # For TTL index
                })
                
                # Update email contact only, don't touch linkedin
                op = create_update_operation(
                    contact_by_email, data, profile, now,
                    skip_linkedin=True
                )
                if op:
                    bulk_ops.append(op)
                stats["conflicts"] += 1
                continue
        
        existing = contact_by_email or contact_by_linkedin
        
        if existing:
            # Update existing contact
            op = create_update_operation(existing, data, profile, now)
            if op:
                bulk_ops.append(op)
            stats["updated"] += 1
            
            # Track buyer persona
            bp = data.get("buyer_persona", "Mateo")
            stats["buyer_persona_counts"][bp] = stats["buyer_persona_counts"].get(bp, 0) + 1
        else:
            # Create new contact using upsert
            op = create_upsert_operation(data, profile, now)
            if op:
                bulk_ops.append(op)
            stats["created"] += 1
            
            # Track buyer persona
            bp = data.get("buyer_persona", "Mateo")
            stats["buyer_persona_counts"][bp] = stats["buyer_persona_counts"].get(bp, 0) + 1
    
    # Execute bulk operations
    if bulk_ops:
        try:
            result = await db.unified_contacts.bulk_write(bulk_ops, ordered=False)
            logger.debug(f"Bulk write: {result.modified_count} modified, {result.upserted_count} upserted")
        except BulkWriteError as e:
            logger.warning(f"Bulk write partial error: {e.details}")
            # Continue processing - some ops may have succeeded
    
    # Insert conflicts
    if conflicts_to_insert:
        await db.linkedin_import_conflicts.insert_many(conflicts_to_insert)
    
    # Insert invalid rows
    if invalid_rows_to_insert:
        await db.linkedin_import_invalid_rows.insert_many(invalid_rows_to_insert)
    
    # Insert parse failures
    if parse_failures_to_insert:
        await db.linkedin_import_parse_failures.insert_many(parse_failures_to_insert)
    
    return stats


def prepare_row_data(row: dict, column_mapping: dict, row_number: int) -> dict:
    """
    Extract and normalize data from a CSV row.
    Returns a dict with parsed data and any validation errors.
    """
    
    def get_field(field_name: str) -> Optional[str]:
        for csv_col, mapped_field in column_mapping.items():
            if mapped_field == field_name:
                value = row.get(csv_col, "").strip()
                return value if value else None
        return None
    
    errors = []  # List of {reason_code, reason_detail, field_name, raw_value}
    
    first_name = get_field('first_name') or ""
    last_name = get_field('last_name') or ""
    email_raw = get_field('email')
    email = normalize_email(email_raw)
    company = get_field('company')
    job_title = get_field('job_title')
    linkedin_url = get_field('linkedin_url')
    connected_on_raw = get_field('connected_on')
    
    linkedin_url_normalized = normalize_linkedin_url(linkedin_url)
    
    # Validate email format (basic check)
    if email_raw and not email:
        errors.append({
            "reason_code": ErrorReasonCode.EMAIL_INVALID_FORMAT,
            "reason_detail": f"Email '{email_raw}' has invalid format",
            "field_name": "email",
            "raw_value": email_raw
        })
    
    # Validate LinkedIn URL format
    if linkedin_url and not linkedin_url_normalized:
        errors.append({
            "reason_code": ErrorReasonCode.LINKEDIN_URL_INVALID_FORMAT,
            "reason_detail": f"LinkedIn URL '{linkedin_url[:50]}...' could not be normalized",
            "field_name": "linkedin_url",
            "raw_value": linkedin_url
        })
    
    # Must have at least name or linkedin - this is a critical error
    if not (first_name or last_name) and not linkedin_url_normalized:
        return {
            "valid": False,
            "row_number": row_number,
            "raw_row": dict(row),
            "reason_code": ErrorReasonCode.INVALID_MISSING_IDENTIFIERS,
            "reason_detail": "Row has no name (first_name/last_name) and no valid linkedin_url",
            "errors": errors
        }
    
    full_name = f"{first_name} {last_name}".strip()
    
    # Parse connected_on date
    connected_on_parsed = None
    connected_on_parse_failed = False
    if connected_on_raw:
        connected_on_parsed = parse_linkedin_date(connected_on_raw)
        if not connected_on_parsed:
            connected_on_parse_failed = True
            errors.append({
                "reason_code": ErrorReasonCode.CONNECTED_ON_PARSE_FAILED,
                "reason_detail": f"Could not parse date '{connected_on_raw}'",
                "field_name": "connected_on",
                "raw_value": connected_on_raw
            })
            logger.debug(f"Row {row_number}: Failed to parse connected_on: '{connected_on_raw}'")
    
    return {
        "valid": True,
        "row_number": row_number,
        "first_name": first_name,
        "last_name": last_name,
        "full_name": full_name,
        "email": email,
        "company": company,
        "job_title": job_title,
        "linkedin_url": linkedin_url,
        "linkedin_url_normalized": linkedin_url_normalized,
        "connected_on": connected_on_parsed,
        "connected_on_raw": connected_on_raw,
        "connected_on_parse_failed": connected_on_parse_failed,
        "raw_row": dict(row),
        "errors": errors
    }
    if connected_on_raw:
        connected_on_parsed = parse_linkedin_date(connected_on_raw)
        if not connected_on_parsed:
            connected_on_parse_failed = True
            logger.debug(f"Row {row_number}: Failed to parse connected_on: '{connected_on_raw}'")
    
    return {
        "row_number": row_number,
        "first_name": first_name,
        "last_name": last_name,
        "full_name": full_name,
        "email": email,
        "company": company,
        "job_title": job_title,
        "linkedin_url": linkedin_url,
        "linkedin_url_normalized": linkedin_url_normalized,
        "connected_on": connected_on_parsed,  # Now ISO format or None
        "connected_on_raw": connected_on_raw,  # Original value for debugging
        "connected_on_parse_failed": connected_on_parse_failed
    }


def create_update_operation(
    existing: dict,
    data: dict,
    profile: str,
    now: str,
    skip_linkedin: bool = False
) -> Optional[UpdateOne]:
    """
    Create bulk update operation for existing contact.
    
    Company logic:
    - If contact has NO company and file has company → set as primary
    - If contact HAS company and file has DIFFERENT company → add as secondary
    - If same company → no change
    """
    
    update_fields = {
        "updated_at": now,
        "stage_1_status": "accepted",
        "linkedin_accepted_by": profile
    }
    
    add_to_set_ops = {}
    
    # Update name if not present
    if data["first_name"] and not existing.get("first_name"):
        update_fields["first_name"] = data["first_name"]
    if data["last_name"] and not existing.get("last_name"):
        update_fields["last_name"] = data["last_name"]
    if data["full_name"] and not existing.get("name"):
        update_fields["name"] = data["full_name"]
    
    # ALWAYS update job_title and reclassify if different
    if data.get("job_title"):
        existing_title = existing.get("job_title", "")
        if data["job_title"].lower() != existing_title.lower():
            update_fields["job_title"] = data["job_title"]
            data["needs_classification"] = True
    
    # Update linkedin if not conflict
    if not skip_linkedin and data.get("linkedin_url") and data.get("linkedin_url_normalized"):
        if not existing.get("linkedin_url"):
            update_fields["linkedin_url"] = data["linkedin_url"]
            update_fields["linkedin_url_normalized"] = data["linkedin_url_normalized"]
    
    # Update first_connected_on_linkedin if we have a parsed date and contact doesn't have one
    if data.get("connected_on"):
        if not existing.get("first_connected_on_linkedin"):
            update_fields["first_connected_on_linkedin"] = data["connected_on"]
    
    # Handle company linking
    if data.get("company_id") and data.get("company_name"):
        existing_company_id = existing.get("company_id")
        existing_companies = existing.get("companies", [])
        existing_company_ids = {c.get("company_id") for c in existing_companies if c.get("company_id")}
        
        if not existing_company_id:
            # Contact has NO company - set as primary
            update_fields["company"] = data["company_name"]
            update_fields["company_id"] = data["company_id"]
            add_to_set_ops["companies"] = {
                "company_id": data["company_id"],
                "company_name": data["company_name"],
                "is_primary": True
            }
        elif data["company_id"] not in existing_company_ids and data["company_id"] != existing_company_id:
            # Contact HAS company but this is different - add as secondary
            add_to_set_ops["companies"] = {
                "company_id": data["company_id"],
                "company_name": data["company_name"],
                "is_primary": False
            }
    
    # Add email as secondary if new
    if data.get("email"):
        existing_emails = set()
        if existing.get("email"):
            existing_emails.add(existing["email"].lower())
        for e in existing.get("emails", []):
            if e.get("email"):
                existing_emails.add(e["email"].lower())
        
        if data["email"].lower() not in existing_emails:
            add_to_set_ops["emails"] = {"email": data["email"], "is_primary": False}
    
    # Build the update operation
    if add_to_set_ops:
        return UpdateOne(
            {"id": existing["id"]},
            {
                "$set": update_fields,
                "$addToSet": add_to_set_ops
            }
        )
    
    return UpdateOne(
        {"id": existing["id"]},
        {"$set": update_fields}
    )


def create_upsert_operation(data: dict, profile: str, now: str) -> Optional[UpdateOne]:
    """
    Create upsert operation for new contact (atomic insert).
    
    Includes company_id and companies[] if company data is available.
    """
    
    contact_id = str(uuid.uuid4())
    
    # Build filter for upsert - use linkedin_url_normalized if available, else email
    if data.get("linkedin_url_normalized"):
        filter_doc = {"linkedin_url_normalized": data["linkedin_url_normalized"]}
    elif data.get("email"):
        filter_doc = {
            "$or": [
                {"email": data["email"]},
                {"emails.email": data["email"]}
            ]
        }
    else:
        # No unique identifier - skip
        return None
    
    emails = []
    if data.get("email"):
        emails.append({"email": data["email"], "is_primary": True})
    
    # Build companies array if company data available
    companies = []
    company_id = data.get("company_id")
    company_name = data.get("company_name") or data.get("company")
    
    if company_id and company_name:
        companies.append({
            "company_id": company_id,
            "company_name": company_name,
            "is_primary": True
        })
    
    new_contact = {
        "id": contact_id,
        "first_name": data.get("first_name", ""),
        "last_name": data.get("last_name", ""),
        "name": data.get("full_name") or f"{data.get('first_name', '')} {data.get('last_name', '')}".strip(),
        "email": data.get("email"),
        "emails": emails,
        "phones": [],
        "linkedin_url": data.get("linkedin_url"),
        "linkedin_url_normalized": data.get("linkedin_url_normalized"),
        "company": company_name,
        "company_id": company_id,
        "companies": companies,
        "job_title": data.get("job_title"),
        "stage": 1,
        "stage_1_status": "accepted",
        "linkedin_accepted_by": profile,
        "buyer_persona": data.get("buyer_persona", "Mateo"),
        "classification": "outbound",
        "source": f"linkedin_connections_{profile.lower()}",
        "source_details": {"profile": profile, "imported_at": now},
        "first_connected_on_linkedin": data.get("connected_on"),
        "created_at": now,
        "updated_at": now
    }
    
    return UpdateOne(
        filter_doc,
        {
            "$setOnInsert": new_contact
        },
        upsert=True
    )


async def process_job(job: dict):
    """
    Process a single import job using streaming and bulk operations.
    """
    job_id = job["job_id"]
    profile = job["profile"]
    file_path = job["file_storage_path"]
    column_mapping = job.get("column_mapping", {})
    
    logger.info(f"Starting job {job_id} for profile {profile}")
    
    # Acquire lock
    if not await acquire_profile_lock(profile, job_id):
        logger.warning(f"Could not acquire lock for {profile}, skipping job {job_id}")
        await db.linkedin_import_jobs.update_one(
            {"job_id": job_id},
            {"$set": {"status": "pending_retry", "last_error": "Could not acquire lock"}}
        )
        return
    
    try:
        if not os.path.exists(file_path):
            raise FileNotFoundError(f"File not found: {file_path}")
        
        # Initialize stats
        stats = {
            "processed": 0,
            "created": 0,
            "updated": 0,
            "conflicts": 0,
            "invalid": 0,
            "buyer_persona_counts": {}
        }
        
        # Count total rows first (streaming)
        total_rows = 0
        with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
            for _ in csv.DictReader(f):
                total_rows += 1
        
        logger.info(f"Job {job_id}: {total_rows} rows to process")
        
        # Pre-classify buyer personas for all job titles (batch lookup)
        job_titles_to_classify = set()
        with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
            reader = csv.DictReader(f)
            for row in reader:
                for csv_col, mapped_field in column_mapping.items():
                    if mapped_field == 'job_title':
                        title = row.get(csv_col, "").strip()
                        if title:
                            job_titles_to_classify.add(title)
        
        # Batch classify
        classification_cache = {}
        for title in job_titles_to_classify:
            classification_cache[title] = await classify_buyer_persona(title)
        
        # Pre-cache/create companies using BULK operation
        companies_to_process = set()
        with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
            reader = csv.DictReader(f)
            for row in reader:
                for csv_col, mapped_field in column_mapping.items():
                    if mapped_field == 'company':
                        company = row.get(csv_col, "").strip()
                        if company:
                            companies_to_process.add(company)
        
        # Use bulk company resolution (single $in query + bulk upsert)
        company_cache = await resolve_companies_bulk(companies_to_process)
        logger.info(f"Job {job_id}: Resolved {len(company_cache)} companies in bulk")
        
        # Process file with STREAMING
        batch = []
        row_number = 0
        last_heartbeat = datetime.now(timezone.utc)
        
        with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
            reader = csv.DictReader(f)
            
            for row in reader:
                row_number += 1
                
                # Add buyer persona from cache
                for csv_col, mapped_field in column_mapping.items():
                    if mapped_field == 'job_title':
                        title = row.get(csv_col, "").strip()
                        if title and title in classification_cache:
                            row['_buyer_persona'] = classification_cache[title]
                
                # Add company info from cache
                for csv_col, mapped_field in column_mapping.items():
                    if mapped_field == 'company':
                        company = row.get(csv_col, "").strip()
                        if company:
                            company_key = company.lower()
                            if company_key in company_cache:
                                row['_company_doc'] = company_cache[company_key]
                
                batch.append((row_number, row))
                
                # Process batch when full
                if len(batch) >= BATCH_SIZE:
                    stats = await process_batch(batch, column_mapping, profile, job_id, stats, company_cache)
                    stats["processed"] += len(batch)
                    batch = []
                    
                    # Update heartbeat and progress
                    now = datetime.now(timezone.utc)
                    if (now - last_heartbeat).total_seconds() >= HEARTBEAT_INTERVAL:
                        progress_percent = int((stats["processed"] / total_rows) * 100)
                        await update_heartbeat(job_id, {
                            "processed_rows": stats["processed"],
                            "contacts_created": stats["created"],
                            "contacts_updated": stats["updated"],
                            "conflicts_count": stats["conflicts"],
                            "invalid_rows_count": stats["invalid"],
                            "progress_percent": progress_percent,
                            "buyer_persona_counts": stats["buyer_persona_counts"]
                        })
                        await refresh_lock(profile, job_id)
                        last_heartbeat = now
                        logger.info(f"Job {job_id}: {stats['processed']}/{total_rows} ({progress_percent}%)")
                    
                    # Check for cancellation
                    job_check = await db.linkedin_import_jobs.find_one(
                        {"job_id": job_id}, 
                        {"status": 1}
                    )
                    if job_check and job_check.get("status") == "cancelled":
                        logger.info(f"Job {job_id} was cancelled")
                        return
        
        # Process remaining batch
        if batch:
            stats = await process_batch(batch, column_mapping, profile, job_id, stats, company_cache)
            stats["processed"] += len(batch)
        
        # Mark as completed - include all error stats
        now = datetime.now(timezone.utc).isoformat()
        
        # Build error breakdown
        error_breakdown = {
            "invalid_rows": {
                "count": stats["invalid"],
                "reason": "Row has no name (first_name/last_name) and no valid linkedin_url"
            },
            "conflicts": {
                "count": stats["conflicts"],
                "reason": "Email matches one contact but LinkedIn URL matches a different contact"
            },
            "connected_on_parse_failed": {
                "count": stats.get("connected_on_parse_failed", 0),
                "reason": "Date format not recognized or invalid date"
            },
            "email_invalid_format": {
                "count": stats.get("email_invalid_format", 0),
                "reason": "Email has invalid format"
            },
            "linkedin_url_invalid_format": {
                "count": stats.get("linkedin_url_invalid_format", 0),
                "reason": "LinkedIn URL could not be normalized"
            }
        }
        
        await db.linkedin_import_jobs.update_one(
            {"job_id": job_id},
            {
                "$set": {
                    "status": "completed",
                    "completed_at": now,
                    "processed_rows": stats["processed"],
                    "contacts_created": stats["created"],
                    "contacts_updated": stats["updated"],
                    "conflicts_count": stats["conflicts"],
                    "invalid_rows_count": stats["invalid"],
                    "connected_on_parse_failed": stats.get("connected_on_parse_failed", 0),
                    "email_invalid_format": stats.get("email_invalid_format", 0),
                    "linkedin_url_invalid_format": stats.get("linkedin_url_invalid_format", 0),
                    "error_breakdown": error_breakdown,
                    "progress_percent": 100,
                    "buyer_persona_counts": stats["buyer_persona_counts"]
                }
            }
        )
        
        # Mark import completed for profile/week
        await db.linkedin_import_tasks.update_one(
            {"profile": profile, "week_start": job["week_start"]},
            {
                "$set": {
                    "import_completed": True,
                    "import_completed_at": now,
                    "last_job_id": job_id
                }
            },
            upsert=True
        )
        
        # Cleanup file
        try:
            os.remove(file_path)
        except Exception as e:
            logger.warning(f"Could not delete file {file_path}: {e}")
        
        logger.info(f"Job {job_id} completed: {stats['created']} created, {stats['updated']} updated, {stats['conflicts']} conflicts")
        
    except Exception as e:
        error_msg = f"{type(e).__name__}: {str(e)}"
        full_error = traceback.format_exc()
        logger.error(f"Job {job_id} failed: {error_msg}")
        logger.error(full_error)
        
        attempts = job.get("attempts", 0) + 1
        now_iso = datetime.now(timezone.utc).isoformat()
        
        # Build attempt history entry
        attempt_entry = {
            "attempt": attempts,
            "started_at": job.get("started_at"),
            "failed_at": now_iso,
            "error": error_msg[:500],
            "full_error": full_error[:2000],
            "worker_id": WORKER_ID
        }
        
        if attempts >= MAX_ATTEMPTS:
            await db.linkedin_import_jobs.update_one(
                {"job_id": job_id},
                {
                    "$set": {
                        "status": "failed",
                        "completed_at": now_iso,
                        "error_summary": error_msg[:500],
                        "last_error": full_error[:2000],
                        "attempts": attempts
                    },
                    "$push": {
                        "attempt_history": attempt_entry
                    }
                }
            )
        else:
            # Calculate retry_after with exponential backoff
            backoff_seconds = RETRY_BACKOFF.get(attempts, 300)
            retry_after = datetime.now(timezone.utc) + timedelta(seconds=backoff_seconds)
            
            await db.linkedin_import_jobs.update_one(
                {"job_id": job_id},
                {
                    "$set": {
                        "status": "pending_retry",
                        "last_error": error_msg[:500],
                        "attempts": attempts,
                        "retry_after": retry_after.isoformat()
                    },
                    "$push": {
                        "attempt_history": attempt_entry
                    }
                }
            )
            logger.info(f"Job {job_id} set to retry after {backoff_seconds}s (attempt {attempts})")
    
    finally:
        await release_profile_lock(profile, job_id)
