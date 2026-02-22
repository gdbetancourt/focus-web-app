"""
Persona Classifier Router - API endpoints for Persona Classifier V3

Handles:
- Reclassification jobs (create, status, cancel, list)
- Classification diagnostics
- Statistics and metrics
- Precomputed metrics
"""

from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from datetime import datetime, timezone

from database import db
from routers.auth import get_current_user
from services.persona_classifier_service import (
    classify_job_title,
    diagnose_classification,
    normalize_job_title,
    invalidate_classifier_cache,
    ensure_classifier_indexes,
    normalize_contacts_job_titles
)
from services.persona_reclassification_worker import (
    create_reclassification_job,
    get_job_status,
    cancel_job,
    list_jobs,
    estimate_affected_contacts
)
from services.persona_classifier_metrics import (
    compute_classifier_metrics,
    store_metrics,
    get_latest_metrics,
    get_metrics_history,
    ensure_metrics_indexes
)

router = APIRouter(prefix="/persona-classifier", tags=["persona-classifier"])


# =============================================================================
# SCHEMAS
# =============================================================================

class ReclassifyAllRequest(BaseModel):
    dry_run: bool = True  # Default to dry run for safety


class ReclassifyByKeywordRequest(BaseModel):
    keyword_id: str
    dry_run: bool = True


class ReclassifyByPersonaRequest(BaseModel):
    buyer_persona_id: str
    dry_run: bool = True


class ReclassifyAffectedRequest(BaseModel):
    keywords: List[str]
    dry_run: bool = True


class DiagnoseRequest(BaseModel):
    job_title: str


class LockContactRequest(BaseModel):
    locked: bool = True


# =============================================================================
# CLASSIFICATION ENDPOINTS
# =============================================================================

@router.post("/classify")
async def classify_single_job_title(
    request: DiagnoseRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Classify a single job title and return detailed results.
    
    Returns:
    - buyer_persona_id and name
    - matched keywords
    - priority used
    - normalized job title
    """
    result = await classify_job_title(db, request.job_title, use_cache=True)
    return {"success": True, "classification": result.to_dict()}


@router.post("/diagnose")
async def diagnose_job_title(
    request: DiagnoseRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Full diagnostic for a job title classification.
    
    Returns detailed information about:
    - Input normalization
    - All matching keywords
    - Priority resolution
    - Cache status
    """
    diagnosis = await diagnose_classification(db, request.job_title)
    return {"success": True, "diagnosis": diagnosis}


@router.post("/normalize")
async def normalize_single_job_title(
    request: DiagnoseRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Normalize a job title without classifying.
    
    Useful for understanding how a job title will be processed.
    """
    normalized = normalize_job_title(request.job_title)
    return {
        "success": True,
        "original": request.job_title,
        "normalized": normalized
    }


# =============================================================================
# RECLASSIFICATION JOB ENDPOINTS
# =============================================================================

@router.post("/reclassify/all")
async def start_reclassify_all(
    request: ReclassifyAllRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Start a job to reclassify ALL contacts (respecting locked flag).
    
    WARNING: This can affect thousands of contacts.
    Use dry_run=True first to preview changes.
    """
    job = await create_reclassification_job(
        job_type="all",
        params={},
        created_by=current_user.get("email", "unknown"),
        dry_run=request.dry_run
    )
    
    return {
        "success": True,
        "message": "Reclassification job created" + (" (dry run)" if request.dry_run else ""),
        "job": job
    }


@router.post("/reclassify/by-keyword")
async def start_reclassify_by_keyword(
    request: ReclassifyByKeywordRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Start a job to reclassify contacts matching a specific keyword.
    """
    # Verify keyword exists
    keyword = await db.job_keywords.find_one({"id": request.keyword_id}, {"_id": 0})
    if not keyword:
        raise HTTPException(status_code=404, detail="Keyword not found")
    
    job = await create_reclassification_job(
        job_type="by_keyword",
        params={"keyword_id": request.keyword_id, "keyword": keyword.get("keyword")},
        created_by=current_user.get("email", "unknown"),
        dry_run=request.dry_run
    )
    
    return {
        "success": True,
        "message": f"Reclassification job for keyword '{keyword.get('keyword')}' created",
        "job": job
    }


@router.post("/reclassify/by-persona")
async def start_reclassify_by_persona(
    request: ReclassifyByPersonaRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Start a job to reclassify contacts currently assigned to a specific buyer persona.
    """
    job = await create_reclassification_job(
        job_type="by_persona",
        params={"buyer_persona_id": request.buyer_persona_id},
        created_by=current_user.get("email", "unknown"),
        dry_run=request.dry_run
    )
    
    return {
        "success": True,
        "message": f"Reclassification job for persona '{request.buyer_persona_id}' created",
        "job": job
    }


@router.post("/reclassify/affected")
async def start_reclassify_affected(
    request: ReclassifyAffectedRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Start a job to reclassify contacts affected by specific keyword changes.
    
    Use this after modifying keywords to update affected contacts.
    """
    if not request.keywords:
        raise HTTPException(status_code=400, detail="At least one keyword required")
    
    job = await create_reclassification_job(
        job_type="affected",
        params={"keywords": request.keywords},
        created_by=current_user.get("email", "unknown"),
        dry_run=request.dry_run
    )
    
    return {
        "success": True,
        "message": f"Reclassification job for {len(request.keywords)} keywords created",
        "job": job
    }


@router.post("/reclassify/estimate")
async def estimate_reclassification(
    job_type: str = Query(..., description="Type: all, by_keyword, by_persona, affected"),
    keyword_id: Optional[str] = None,
    buyer_persona_id: Optional[str] = None,
    keywords: Optional[str] = None,  # Comma-separated
    current_user: dict = Depends(get_current_user)
):
    """
    Estimate how many contacts would be affected by a reclassification.
    
    Use this before starting a job to preview the impact.
    """
    params = {}
    
    if job_type == "by_keyword":
        if not keyword_id:
            raise HTTPException(status_code=400, detail="keyword_id required for by_keyword type")
        params["keyword_id"] = keyword_id
    
    elif job_type == "by_persona":
        if not buyer_persona_id:
            raise HTTPException(status_code=400, detail="buyer_persona_id required for by_persona type")
        params["buyer_persona_id"] = buyer_persona_id
    
    elif job_type == "affected":
        if not keywords:
            raise HTTPException(status_code=400, detail="keywords required for affected type")
        params["keywords"] = [k.strip() for k in keywords.split(",")]
    
    result = await estimate_affected_contacts(job_type, params)
    return result


@router.get("/jobs")
async def get_reclassification_jobs(
    status: Optional[str] = None,
    limit: int = Query(50, ge=1, le=200),
    skip: int = Query(0, ge=0),
    current_user: dict = Depends(get_current_user)
):
    """
    List reclassification jobs with optional status filter.
    """
    jobs = await list_jobs(status=status, limit=limit, skip=skip)
    
    return {
        "success": True,
        "jobs": jobs,
        "count": len(jobs)
    }


@router.get("/jobs/{job_id}")
async def get_reclassification_job(
    job_id: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Get status and progress of a specific reclassification job.
    """
    job = await get_job_status(job_id)
    
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    
    return {"success": True, "job": job}


@router.post("/jobs/{job_id}/cancel")
async def cancel_reclassification_job(
    job_id: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Cancel a pending or processing reclassification job.
    """
    cancelled = await cancel_job(job_id)
    
    if not cancelled:
        raise HTTPException(
            status_code=400, 
            detail="Job cannot be cancelled (already completed, failed, or not found)"
        )
    
    return {"success": True, "message": "Job cancelled"}


# =============================================================================
# CONTACT LOCK MANAGEMENT
# =============================================================================

@router.post("/contacts/{contact_id}/lock")
async def lock_contact_persona(
    contact_id: str,
    request: LockContactRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Lock or unlock a contact's buyer persona.
    
    When locked, the contact will be excluded from bulk reclassification.
    """
    result = await db.unified_contacts.update_one(
        {"id": contact_id},
        {"$set": {
            "buyer_persona_locked": request.locked,
            "buyer_persona_lock_changed_by": current_user.get("email"),
            "buyer_persona_lock_changed_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Contact not found")
    
    return {
        "success": True,
        "message": f"Contact {'locked' if request.locked else 'unlocked'}",
        "contact_id": contact_id,
        "locked": request.locked
    }


@router.get("/contacts/{contact_id}/classification")
async def get_contact_classification(
    contact_id: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Get classification details for a specific contact.
    
    Shows current persona, lock status, and what the classifier would assign.
    """
    contact = await db.unified_contacts.find_one(
        {"id": contact_id},
        {"_id": 0, "id": 1, "first_name": 1, "last_name": 1, "email": 1,
         "job_title": 1, "job_title_normalized": 1, "buyer_persona": 1,
         "buyer_persona_locked": 1, "buyer_persona_assigned_manually": 1}
    )
    
    if not contact:
        raise HTTPException(status_code=404, detail="Contact not found")
    
    # Get what classifier would assign
    job_title = contact.get("job_title", "")
    classification = await classify_job_title(db, job_title, use_cache=True)
    
    return {
        "success": True,
        "contact": contact,
        "current_classification": {
            "buyer_persona": contact.get("buyer_persona"),
            "locked": contact.get("buyer_persona_locked", False),
            "manually_assigned": contact.get("buyer_persona_assigned_manually", False)
        },
        "classifier_result": classification.to_dict(),
        "would_change": contact.get("buyer_persona") != classification.buyer_persona_id
    }


# =============================================================================
# STATISTICS & MAINTENANCE
# =============================================================================

@router.get("/stats")
async def get_classifier_statistics(
    current_user: dict = Depends(get_current_user)
):
    """
    Get comprehensive statistics about the classifier system.
    """
    # Count keywords by buyer persona
    keyword_pipeline = [
        {"$group": {"_id": "$buyer_persona_id", "count": {"$sum": 1}}}
    ]
    keyword_counts = await db.job_keywords.aggregate(keyword_pipeline).to_list(None)
    
    # Count contacts by buyer persona
    contact_pipeline = [
        {"$group": {"_id": "$buyer_persona", "count": {"$sum": 1}}}
    ]
    contact_counts = await db.unified_contacts.aggregate(contact_pipeline).to_list(None)
    
    # Count locked contacts
    locked_count = await db.unified_contacts.count_documents({"buyer_persona_locked": True})
    
    # Count manually assigned
    manual_count = await db.unified_contacts.count_documents({"buyer_persona_assigned_manually": True})
    
    # Count contacts with normalized job titles
    normalized_count = await db.unified_contacts.count_documents({
        "job_title_normalized": {"$exists": True, "$nin": [None, ""]}
    })
    
    # Total contacts
    total_contacts = await db.unified_contacts.count_documents({})
    
    # Total keywords
    total_keywords = await db.job_keywords.count_documents({})
    
    # Recent jobs
    recent_jobs = await db.persona_reclassification_jobs.find(
        {},
        {"_id": 0, "job_id": 1, "job_type": 1, "status": 1, "created_at": 1, "progress": 1}
    ).sort("created_at", -1).limit(5).to_list(None)
    
    return {
        "success": True,
        "keywords": {
            "total": total_keywords,
            "by_persona": {kc["_id"]: kc["count"] for kc in keyword_counts if kc["_id"]}
        },
        "contacts": {
            "total": total_contacts,
            "by_persona": {cc["_id"]: cc["count"] for cc in contact_counts if cc["_id"]},
            "locked": locked_count,
            "manually_assigned": manual_count,
            "with_normalized_job_title": normalized_count,
            "normalization_coverage": round(normalized_count / total_contacts * 100, 1) if total_contacts > 0 else 0
        },
        "recent_jobs": recent_jobs
    }


@router.post("/maintenance/normalize-job-titles")
async def run_normalize_job_titles(
    limit: Optional[int] = Query(None, description="Max contacts to process (None = all)"),
    current_user: dict = Depends(get_current_user)
):
    """
    Backfill job_title_normalized field for existing contacts.
    
    Safe to run multiple times - only processes contacts without normalized field.
    """
    result = await normalize_contacts_job_titles(db, batch_size=500, limit=limit)
    return {"success": True, "migration_result": result}


@router.post("/maintenance/ensure-indexes")
async def run_ensure_indexes(
    current_user: dict = Depends(get_current_user)
):
    """
    Ensure all classifier indexes exist in the database.
    """
    result = await ensure_classifier_indexes(db)
    return {"success": True, "indexes": result}


@router.post("/maintenance/invalidate-cache")
async def invalidate_cache_endpoint(
    current_user: dict = Depends(get_current_user)
):
    """
    Manually invalidate the classifier cache.
    
    Normally this happens automatically when keywords change,
    but this endpoint allows manual invalidation if needed.
    """
    invalidate_classifier_cache()
    return {"success": True, "message": "Classifier cache invalidated"}


# =============================================================================
# PRECOMPUTED METRICS
# =============================================================================

@router.get("/metrics/latest")
async def get_latest_precomputed_metrics(
    current_user: dict = Depends(get_current_user)
):
    """
    Get the most recent precomputed metrics.
    
    These are computed every 6 hours by the background worker.
    If no precomputed metrics exist, returns empty result.
    """
    metrics = await get_latest_metrics()
    
    if not metrics:
        return {
            "success": True,
            "metrics": None,
            "message": "No precomputed metrics available yet"
        }
    
    return {"success": True, "metrics": metrics}


@router.get("/metrics/history")
async def get_metrics_history_endpoint(
    days: int = Query(30, ge=1, le=90, description="Number of days of history"),
    current_user: dict = Depends(get_current_user)
):
    """
    Get metrics history for trend analysis.
    
    Returns metrics records for the specified number of days.
    """
    history = await get_metrics_history(days)
    
    return {
        "success": True,
        "count": len(history),
        "history": history
    }


@router.post("/metrics/compute")
async def trigger_metrics_computation(
    current_user: dict = Depends(get_current_user)
):
    """
    Manually trigger metrics computation.
    
    Normally metrics are computed every 6 hours, but this allows
    immediate computation when needed.
    """
    metrics = await compute_classifier_metrics()
    await store_metrics(metrics)
    
    return {
        "success": True,
        "message": "Metrics computed and stored",
        "metrics": metrics
    }


@router.post("/metrics/ensure-indexes")
async def ensure_metrics_indexes_endpoint(
    current_user: dict = Depends(get_current_user)
):
    """
    Create indexes for the metrics collection.
    """
    await ensure_metrics_indexes()
    return {"success": True, "message": "Metrics indexes created"}
