"""
Persona Reclassification Worker - Background job processor for bulk reclassification

This worker handles:
- Batch reclassification of contacts based on keyword changes
- Progress tracking and reporting
- Dry-run capability for previewing changes
- Respects buyer_persona_locked flag

Architecture:
- Called every 30 seconds by APScheduler
- Uses MongoDB for job queue (persistent)
- Processes in batches for performance
- Logs all changes for auditing
"""

import asyncio
import uuid
import logging
import traceback
from datetime import datetime, timezone, timedelta
from typing import Optional, Dict, List, Any
from pymongo import UpdateOne

from database import db
from services.persona_classifier_service import (
    classify_job_title_simple,
    normalize_job_title,
    invalidate_classifier_cache
)

# Configure logging
logger = logging.getLogger('persona_reclassification_worker')

# Configuration
BATCH_SIZE = 500
HEARTBEAT_INTERVAL = 30  # seconds
ORPHAN_TIMEOUT = 300  # 5 minutes
MAX_ATTEMPTS = 3
WORKER_ID = f"reclassify_worker_{id(asyncio.get_event_loop())}"

# Job statuses
STATUS_PENDING = "pending"
STATUS_PROCESSING = "processing"
STATUS_COMPLETED = "completed"
STATUS_FAILED = "failed"
STATUS_CANCELLED = "cancelled"


# =============================================================================
# JOB MANAGEMENT
# =============================================================================

async def create_reclassification_job(
    job_type: str,
    params: Dict[str, Any],
    created_by: str,
    dry_run: bool = False
) -> Dict[str, Any]:
    """
    Create a new reclassification job.
    
    Args:
        job_type: Type of reclassification:
            - "all": Reclassify all contacts
            - "by_keyword": Reclassify contacts matching a specific keyword
            - "by_persona": Reclassify contacts of a specific buyer persona
            - "affected": Reclassify only contacts affected by keyword changes
        params: Parameters for the job (keyword_id, buyer_persona_id, etc.)
        created_by: User email who created the job
        dry_run: If True, calculate changes without applying them
    
    Returns:
        Created job document
    """
    job_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    
    job = {
        "job_id": job_id,
        "job_type": job_type,
        "params": params,
        "dry_run": dry_run,
        "status": STATUS_PENDING,
        "created_by": created_by,
        "created_at": now,
        "started_at": None,
        "completed_at": None,
        "progress": {
            "total_contacts": 0,
            "processed": 0,
            "updated": 0,
            "skipped_locked": 0,
            "skipped_same": 0,
            "errors": 0,
            "percent": 0
        },
        "result": None,
        "error": None,
        "attempt": 0,
        "worker_id": None,
        "heartbeat_at": None
    }
    
    await db.persona_reclassification_jobs.insert_one(job)
    
    logger.info(f"Created reclassification job {job_id} (type={job_type}, dry_run={dry_run})")
    
    return {k: v for k, v in job.items() if k != "_id"}


async def get_job_status(job_id: str) -> Optional[Dict[str, Any]]:
    """Get current status of a reclassification job."""
    job = await db.persona_reclassification_jobs.find_one(
        {"job_id": job_id},
        {"_id": 0}
    )
    return job


async def cancel_job(job_id: str) -> bool:
    """
    Cancel a pending or processing job.
    
    Returns True if job was cancelled, False if not cancellable.
    """
    result = await db.persona_reclassification_jobs.update_one(
        {
            "job_id": job_id,
            "status": {"$in": [STATUS_PENDING, STATUS_PROCESSING]}
        },
        {
            "$set": {
                "status": STATUS_CANCELLED,
                "completed_at": datetime.now(timezone.utc).isoformat()
            }
        }
    )
    
    if result.modified_count > 0:
        logger.info(f"Cancelled reclassification job {job_id}")
        return True
    
    return False


async def list_jobs(
    status: Optional[str] = None,
    limit: int = 50,
    skip: int = 0
) -> List[Dict[str, Any]]:
    """List reclassification jobs with optional status filter."""
    query = {}
    if status:
        query["status"] = status
    
    jobs = await db.persona_reclassification_jobs.find(
        query,
        {"_id": 0}
    ).sort("created_at", -1).skip(skip).limit(limit).to_list(None)
    
    return jobs


# =============================================================================
# WORKER LOGIC
# =============================================================================

async def find_next_job() -> Optional[Dict[str, Any]]:
    """
    Find and lock the next available job for processing.
    Uses atomic find_one_and_update to prevent race conditions.
    """
    now = datetime.now(timezone.utc)
    
    # First, check for orphaned jobs (processing but heartbeat stale)
    orphan_cutoff = (now - timedelta(seconds=ORPHAN_TIMEOUT)).isoformat()
    
    orphan_job = await db.persona_reclassification_jobs.find_one_and_update(
        {
            "status": STATUS_PROCESSING,
            "heartbeat_at": {"$lt": orphan_cutoff},
            "attempt": {"$lt": MAX_ATTEMPTS}
        },
        {
            "$set": {
                "status": STATUS_PENDING,
                "worker_id": None
            },
            "$inc": {"attempt": 1}
        },
        return_document=True
    )
    
    if orphan_job:
        logger.warning(f"Recovered orphaned reclassification job {orphan_job['job_id']}")
    
    # Now find next pending job
    job = await db.persona_reclassification_jobs.find_one_and_update(
        {"status": STATUS_PENDING},
        {
            "$set": {
                "status": STATUS_PROCESSING,
                "started_at": now.isoformat(),
                "worker_id": WORKER_ID,
                "heartbeat_at": now.isoformat()
            }
        },
        sort=[("created_at", 1)],  # FIFO
        return_document=True
    )
    
    return job


async def update_heartbeat(job_id: str):
    """Update job heartbeat to indicate worker is alive."""
    await db.persona_reclassification_jobs.update_one(
        {"job_id": job_id},
        {"$set": {"heartbeat_at": datetime.now(timezone.utc).isoformat()}}
    )


async def update_progress(job_id: str, progress: Dict[str, int]):
    """Update job progress."""
    # Calculate percentage
    total = progress.get("total_contacts", 0)
    processed = progress.get("processed", 0)
    percent = round((processed / total * 100) if total > 0 else 0, 1)
    progress["percent"] = percent
    
    await db.persona_reclassification_jobs.update_one(
        {"job_id": job_id},
        {
            "$set": {
                "progress": progress,
                "heartbeat_at": datetime.now(timezone.utc).isoformat()
            }
        }
    )


async def complete_job(job_id: str, progress: Dict[str, int], result: Dict[str, Any]):
    """Mark job as completed with final results."""
    progress["percent"] = 100
    
    await db.persona_reclassification_jobs.update_one(
        {"job_id": job_id},
        {
            "$set": {
                "status": STATUS_COMPLETED,
                "completed_at": datetime.now(timezone.utc).isoformat(),
                "progress": progress,
                "result": result
            }
        }
    )
    
    logger.info(f"Reclassification job {job_id} completed: {progress}")


async def fail_job(job_id: str, error: str, progress: Dict[str, int]):
    """Mark job as failed with error details."""
    await db.persona_reclassification_jobs.update_one(
        {"job_id": job_id},
        {
            "$set": {
                "status": STATUS_FAILED,
                "completed_at": datetime.now(timezone.utc).isoformat(),
                "error": error,
                "progress": progress
            }
        }
    )
    
    logger.error(f"Reclassification job {job_id} failed: {error}")


# =============================================================================
# RECLASSIFICATION LOGIC
# =============================================================================

async def build_contact_query(job_type: str, params: Dict[str, Any]) -> Dict[str, Any]:
    """
    Build MongoDB query for contacts to reclassify based on job type.
    """
    base_query = {
        # Exclude locked contacts
        "$or": [
            {"buyer_persona_locked": {"$exists": False}},
            {"buyer_persona_locked": False},
            {"buyer_persona_locked": None}
        ]
    }
    
    if job_type == "all":
        # All contacts with job_title
        query = {
            **base_query,
            "job_title": {"$exists": True, "$nin": [None, ""]}
        }
    
    elif job_type == "by_keyword":
        # Contacts matching a specific keyword
        keyword_id = params.get("keyword_id")
        keyword_doc = await db.job_keywords.find_one({"id": keyword_id}, {"_id": 0})
        
        if not keyword_doc:
            raise ValueError(f"Keyword {keyword_id} not found")
        
        keyword = keyword_doc.get("keyword", "").lower()
        keyword_normalized = normalize_job_title(keyword)
        
        # Use regex to match keyword in normalized job title
        query = {
            **base_query,
            "$or": [
                {"job_title_normalized": {"$regex": keyword_normalized, "$options": "i"}},
                {"job_title": {"$regex": keyword, "$options": "i"}}
            ]
        }
    
    elif job_type == "by_persona":
        # All contacts of a specific buyer persona
        buyer_persona_id = params.get("buyer_persona_id")
        
        query = {
            **base_query,
            "buyer_persona": buyer_persona_id,
            "job_title": {"$exists": True, "$nin": [None, ""]}
        }
    
    elif job_type == "affected":
        # Contacts affected by recently modified keywords
        # This requires knowing which keywords changed (passed in params)
        keywords = params.get("keywords", [])
        
        if not keywords:
            raise ValueError("No keywords specified for 'affected' reclassification")
        
        # Build regex pattern for all keywords
        keyword_patterns = [normalize_job_title(kw) for kw in keywords if kw]
        
        if not keyword_patterns:
            raise ValueError("No valid keywords after normalization")
        
        # Use $or with multiple regex patterns
        keyword_conditions = [
            {"job_title_normalized": {"$regex": pattern, "$options": "i"}}
            for pattern in keyword_patterns
        ]
        
        query = {
            **base_query,
            "$or": keyword_conditions
        }
    
    else:
        raise ValueError(f"Unknown job type: {job_type}")
    
    return query


async def process_reclassification_job(job: Dict[str, Any]):
    """
    Process a single reclassification job.
    """
    job_id = job["job_id"]
    job_type = job["job_type"]
    params = job.get("params", {})
    dry_run = job.get("dry_run", False)
    
    logger.info(f"Processing reclassification job {job_id} (type={job_type}, dry_run={dry_run})")
    
    progress = {
        "total_contacts": 0,
        "processed": 0,
        "updated": 0,
        "skipped_locked": 0,
        "skipped_same": 0,
        "errors": 0,
        "percent": 0
    }
    
    changes = []  # Track individual changes for result
    
    try:
        # Build query for contacts to reclassify
        query = await build_contact_query(job_type, params)
        
        # Count total contacts
        total = await db.unified_contacts.count_documents(query)
        progress["total_contacts"] = total
        
        if total == 0:
            await complete_job(job_id, progress, {
                "message": "No contacts match the criteria",
                "changes": []
            })
            return
        
        # Process in batches
        batch = []
        batch_changes = []
        cursor = db.unified_contacts.find(
            query,
            {"_id": 0, "id": 1, "job_title": 1, "job_title_normalized": 1, "buyer_persona": 1}
        )
        
        async for contact in cursor:
            # Check if job was cancelled
            current_job = await db.persona_reclassification_jobs.find_one(
                {"job_id": job_id},
                {"status": 1}
            )
            if current_job and current_job.get("status") == STATUS_CANCELLED:
                logger.info(f"Job {job_id} was cancelled, stopping")
                return
            
            job_title = contact.get("job_title", "")
            contact_id = contact.get("id")
            current_persona = contact.get("buyer_persona")
            
            try:
                # Classify using centralized service
                new_persona = await classify_job_title_simple(db, job_title, use_cache=True)
                
                # Normalize job title
                normalized = contact.get("job_title_normalized") or normalize_job_title(job_title)
                
                progress["processed"] += 1
                
                # Check if persona changed
                if new_persona != current_persona:
                    progress["updated"] += 1
                    
                    change = {
                        "contact_id": contact_id,
                        "job_title": job_title,
                        "old_persona": current_persona,
                        "new_persona": new_persona
                    }
                    batch_changes.append(change)
                    
                    if not dry_run:
                        batch.append(UpdateOne(
                            {"id": contact_id},
                            {"$set": {
                                "buyer_persona": new_persona,
                                "job_title_normalized": normalized,
                                "reclassified_at": datetime.now(timezone.utc).isoformat(),
                                "reclassified_by_job": job_id,
                                "updated_at": datetime.now(timezone.utc).isoformat()
                            }}
                        ))
                else:
                    progress["skipped_same"] += 1
                
                # Execute batch and update progress
                if len(batch) >= BATCH_SIZE:
                    if not dry_run and batch:
                        await db.unified_contacts.bulk_write(batch, ordered=False)
                    
                    changes.extend(batch_changes)
                    batch = []
                    batch_changes = []
                    
                    # Update progress and heartbeat
                    await update_progress(job_id, progress)
                    
            except Exception as e:
                progress["errors"] += 1
                logger.error(f"Error processing contact {contact_id}: {e}")
        
        # Process remaining batch
        if not dry_run and batch:
            await db.unified_contacts.bulk_write(batch, ordered=False)
        
        changes.extend(batch_changes)
        
        # Limit changes in result (keep first 100 for preview)
        result = {
            "message": "Dry run completed" if dry_run else "Reclassification completed",
            "dry_run": dry_run,
            "total_changes": len(changes),
            "sample_changes": changes[:100],  # First 100 changes as sample
            "persona_breakdown": {}
        }
        
        # Calculate persona breakdown
        persona_counts = {}
        for change in changes:
            new_p = change["new_persona"]
            persona_counts[new_p] = persona_counts.get(new_p, 0) + 1
        result["persona_breakdown"] = persona_counts
        
        await complete_job(job_id, progress, result)
        
    except Exception as e:
        error_msg = f"{type(e).__name__}: {str(e)}"
        logger.error(f"Reclassification job {job_id} error: {error_msg}")
        logger.error(traceback.format_exc())
        await fail_job(job_id, error_msg, progress)


async def process_reclassification_jobs():
    """
    Main worker loop - called periodically by APScheduler.
    Finds and processes pending reclassification jobs.
    """
    try:
        job = await find_next_job()
        
        if job:
            logger.info(f"Reclassification Worker: Processing job {job['job_id']}")
            await process_reclassification_job(job)
            logger.info(f"Reclassification Worker: Completed job {job['job_id']}")
        
    except Exception as e:
        logger.error(f"Reclassification Worker error: {e}")
        logger.error(traceback.format_exc())


# =============================================================================
# UTILITY FUNCTIONS
# =============================================================================

async def estimate_affected_contacts(
    job_type: str,
    params: Dict[str, Any]
) -> Dict[str, Any]:
    """
    Estimate how many contacts would be affected by a reclassification.
    Useful for UI preview before starting a job.
    """
    try:
        query = await build_contact_query(job_type, params)
        
        # Count total matching
        total = await db.unified_contacts.count_documents(query)
        
        # Sample first 10 for preview
        sample = await db.unified_contacts.find(
            query,
            {"_id": 0, "id": 1, "first_name": 1, "last_name": 1, 
             "job_title": 1, "buyer_persona": 1, "email": 1}
        ).limit(10).to_list(None)
        
        return {
            "success": True,
            "estimated_contacts": total,
            "sample_contacts": sample
        }
        
    except ValueError as e:
        return {
            "success": False,
            "error": str(e)
        }
    except Exception as e:
        logger.error(f"Error estimating affected contacts: {e}")
        return {
            "success": False,
            "error": f"Internal error: {str(e)}"
        }
