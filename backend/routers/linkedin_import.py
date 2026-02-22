"""
LinkedIn Import Router V2 - Import New Connections Section

API endpoints for LinkedIn connection imports.
Processing is done by a SEPARATE WORKER PROCESS (linkedin_import_worker.py).

Features:
- File upload and validation
- Preview with column mapping
- Job status and progress tracking
- Conflict reporting and download
- Traffic light semaphore integration

Worker handles:
- Streaming file processing
- Bulk database operations
- Automatic retry on failure
- Orphaned job recovery
"""

from fastapi import APIRouter, HTTPException, UploadFile, File, Form, Depends
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone, timedelta
from database import db
from routers.auth import get_current_user
import uuid
import csv
import io
import re
import os

router = APIRouter(prefix="/linkedin-import", tags=["LinkedIn Import"])

# Constants
LINKEDIN_PROFILES = {"GB": "Gerardo Betancourt", "MG": "María del Mar Gargari"}
UPLOAD_DIR = "/tmp/linkedin_imports"

# Ensure upload directory exists
os.makedirs(UPLOAD_DIR, exist_ok=True)


# ============ HELPER FUNCTIONS ============

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
    # Remove query params
    url = re.sub(r'\?.*$', '', url)
    # Remove trailing /overlay/... 
    url = re.sub(r'/overlay/.*$', '', url)
    return url if url else None


def normalize_email(email: str) -> Optional[str]:
    """Normalize email for consistent matching"""
    if not email:
        return None
    return str(email).strip().lower()


# ============ MODELS ============

class RequestExportRequest(BaseModel):
    profile: str
    export_requested: Optional[bool] = True  # Allow toggle true/false  # "GB" or "MG"


class PreviewRequest(BaseModel):
    job_id: str


class StartImportRequest(BaseModel):
    job_id: str
    column_mapping: Dict[str, str]


class ImportProgress(BaseModel):
    job_id: str
    status: str
    progress_percent: int
    total_rows: int
    processed_rows: int
    contacts_created: int
    contacts_updated: int
    conflicts_count: int


# ============ ENDPOINTS ============

@router.post("/request-export")
async def request_export(
    request: RequestExportRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Toggle export_requested status for a profile.
    
    Body:
    - profile: "GB" or "MG"
    - export_requested: true or false (default true)
    
    Rules:
    - Cannot set export_requested=false if import_completed=true (409)
    """
    if request.profile not in LINKEDIN_PROFILES:
        raise HTTPException(status_code=400, detail=f"Invalid profile. Must be one of: {list(LINKEDIN_PROFILES.keys())}")
    
    week_start = get_current_week_start()
    now = datetime.now(timezone.utc).isoformat()
    
    # Check current state
    current_task = await db.linkedin_import_tasks.find_one(
        {"profile": request.profile, "week_start": week_start}
    )
    
    # If trying to uncheck and import is already completed, block it
    if request.export_requested == False and current_task and current_task.get("import_completed"):
        raise HTTPException(
            status_code=409,
            detail="No se puede desmarcar el export porque ya se completó una importación esta semana"
        )
    
    # Update the task
    if request.export_requested:
        # Marking as requested
        await db.linkedin_import_tasks.update_one(
            {"profile": request.profile, "week_start": week_start},
            {
                "$set": {
                    "export_requested": True,
                    "export_requested_at": now,
                    "export_requested_by": current_user.get("id"),
                    "updated_at": now
                },
                "$setOnInsert": {
                    "profile": request.profile,
                    "week_start": week_start,
                    "import_completed": False,
                    "created_at": now
                }
            },
            upsert=True
        )
    else:
        # Unmarking
        await db.linkedin_import_tasks.update_one(
            {"profile": request.profile, "week_start": week_start},
            {
                "$set": {
                    "export_requested": False,
                    "export_requested_at": None,
                    "updated_at": now
                }
            }
        )
    
    # Get updated state
    updated_task = await db.linkedin_import_tasks.find_one(
        {"profile": request.profile, "week_start": week_start},
        {"_id": 0}
    )
    
    return {
        "success": True,
        "profile": request.profile,
        "week_start": week_start,
        "export_requested": updated_task.get("export_requested") if updated_task else False,
        "import_completed": updated_task.get("import_completed") if updated_task else False,
        "message": f"Export {'marcado' if request.export_requested else 'desmarcado'} para {LINKEDIN_PROFILES[request.profile]}"
    }


@router.post("/reset-week")
async def reset_week_status(
    request: RequestExportRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Reset the weekly status for a profile (for testing/development).
    This will:
    - Set export_requested=false
    - Set import_completed=false
    - NOT delete jobs (they remain for audit)
    """
    if request.profile not in LINKEDIN_PROFILES:
        raise HTTPException(status_code=400, detail=f"Invalid profile. Must be one of: {list(LINKEDIN_PROFILES.keys())}")
    
    week_start = get_current_week_start()
    now = datetime.now(timezone.utc).isoformat()
    
    await db.linkedin_import_tasks.update_one(
        {"profile": request.profile, "week_start": week_start},
        {
            "$set": {
                "export_requested": False,
                "export_requested_at": None,
                "import_completed": False,
                "import_completed_at": None,
                "last_job_id": None,
                "updated_at": now,
                "reset_at": now,
                "reset_by": current_user.get("id")
            }
        }
    )
    
    return {
        "success": True,
        "profile": request.profile,
        "week_start": week_start,
        "message": f"Estado semanal reseteado para {LINKEDIN_PROFILES[request.profile]}"
    }


@router.get("/status")
async def get_import_status(current_user: dict = Depends(get_current_user)):
    """
    Get current week's import status for both profiles.
    
    Returns:
    - week_start: current week start date (source of truth)
    - Per profile:
      - export_requested: boolean
      - import_completed: boolean (derived from tasks OR jobs)
      - completed_jobs_count: number of completed jobs this week
      - latest_job: most recent job details with calculated metrics
    """
    week_start = get_current_week_start()
    
    result = {
        "week_start": week_start
    }
    
    for profile in LINKEDIN_PROFILES:
        task = await db.linkedin_import_tasks.find_one(
            {"profile": profile, "week_start": week_start},
            {"_id": 0}
        )
        
        # Count completed jobs this week for this profile
        completed_jobs_count = await db.linkedin_import_jobs.count_documents({
            "profile": profile,
            "week_start": week_start,
            "status": "completed"
        })
        
        # Get latest job for this profile/week (completed ones first)
        latest_job = await db.linkedin_import_jobs.find_one(
            {"profile": profile, "week_start": week_start},
            {"_id": 0},
            sort=[("completed_at", -1), ("created_at", -1)]
        )
        
        # Enrich latest job with calculated metrics
        if latest_job:
            duration_sec = None
            throughput = None
            if latest_job.get("started_at") and latest_job.get("completed_at"):
                try:
                    start = datetime.fromisoformat(latest_job["started_at"].replace("Z", "+00:00"))
                    end = datetime.fromisoformat(latest_job["completed_at"].replace("Z", "+00:00"))
                    duration_sec = (end - start).total_seconds()
                    if duration_sec > 0 and latest_job.get("total_rows"):
                        throughput = round(latest_job["total_rows"] / duration_sec, 2)
                except:
                    pass
            
            latest_job["duration_sec"] = duration_sec
            latest_job["throughput_rows_per_sec"] = throughput
        
        # import_completed comes from the persisted task value only
        # This is set by the worker when a job completes, or can be reset via reset-week
        import_completed = task.get("import_completed", False) if task else False
        
        result[profile] = {
            "profile_name": LINKEDIN_PROFILES[profile],
            "export_requested": task.get("export_requested", False) if task else False,
            "export_requested_at": task.get("export_requested_at") if task else None,
            "import_completed": import_completed,
            "completed_jobs_count": completed_jobs_count,
            "latest_job": latest_job
        }
    
    return result


@router.post("/upload")
async def upload_file(
    file: UploadFile = File(...),
    profile: str = Form(...),
    current_user: dict = Depends(get_current_user)
):
    """Upload CSV file for import"""
    if profile not in LINKEDIN_PROFILES:
        raise HTTPException(status_code=400, detail=f"Invalid profile. Must be one of: {list(LINKEDIN_PROFILES.keys())}")
    
    if not file.filename.endswith('.csv'):
        raise HTTPException(status_code=400, detail="Only CSV files are supported")
    
    # Check for existing processing job for this profile
    existing = await db.linkedin_import_jobs.find_one({
        "profile": profile,
        "status": "processing"
    })
    if existing:
        raise HTTPException(
            status_code=409, 
            detail=f"Another import is already processing for profile {profile}. Job ID: {existing['job_id']}"
        )
    
    # Read and save file
    content = await file.read()
    job_id = str(uuid.uuid4())
    week_start = get_current_week_start()
    
    # Save file to disk
    file_path = os.path.join(UPLOAD_DIR, f"{job_id}.csv")
    with open(file_path, 'wb') as f:
        f.write(content)
    
    # Count rows
    content_str = content.decode('utf-8', errors='ignore')
    reader = csv.DictReader(io.StringIO(content_str))
    rows = list(reader)
    total_rows = len(rows)
    
    if total_rows == 0:
        os.remove(file_path)
        raise HTTPException(status_code=400, detail="CSV file is empty")
    
    # Get headers for preview
    headers = list(rows[0].keys()) if rows else []
    
    now = datetime.now(timezone.utc).isoformat()
    
    # Create job record
    job = {
        "job_id": job_id,
        "profile": profile,
        "week_start": week_start,
        "file_name": file.filename,
        "file_storage_path": file_path,
        "status": "uploaded",
        "total_rows": total_rows,
        "processed_rows": 0,
        "contacts_created": 0,
        "contacts_updated": 0,
        "conflicts_count": 0,
        "invalid_rows_count": 0,
        "progress_percent": 0,
        "started_at": None,
        "completed_at": None,
        "error_summary": None,
        "created_by_user_id": current_user.get("id"),
        "created_at": now,
        "headers": headers
    }
    
    await db.linkedin_import_jobs.insert_one(job)
    
    return {
        "success": True,
        "job_id": job_id,
        "file_name": file.filename,
        "total_rows": total_rows,
        "headers": headers,
        "message": "File uploaded. Use /preview to see data and /start to begin import."
    }


@router.get("/preview/{job_id}")
async def preview_import(
    job_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Preview first 50 rows and suggest column mapping"""
    job = await db.linkedin_import_jobs.find_one({"job_id": job_id}, {"_id": 0})
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    
    if job["status"] not in ["uploaded"]:
        raise HTTPException(status_code=400, detail=f"Job is in status '{job['status']}', cannot preview")
    
    # Read file
    file_path = job["file_storage_path"]
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="File not found on server")
    
    with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
        reader = csv.DictReader(f)
        preview_rows = []
        for i, row in enumerate(reader):
            if i >= 50:
                break
            preview_rows.append(row)
    
    headers = list(preview_rows[0].keys()) if preview_rows else []
    
    # Get saved mapping for this profile
    saved_mapping = await db.linkedin_import_mappings.find_one(
        {"profile": job["profile"]},
        {"_id": 0, "mapping": 1}
    )
    
    # Auto-suggest mapping
    suggested_mapping = suggest_column_mapping(headers)
    
    # Use saved mapping if exists, otherwise use suggested
    column_mapping = saved_mapping.get("mapping", suggested_mapping) if saved_mapping else suggested_mapping
    
    return {
        "job_id": job_id,
        "file_name": job["file_name"],
        "total_rows": job["total_rows"],
        "headers": headers,
        "preview_rows": preview_rows,
        "column_mapping": column_mapping,
        "suggested_mapping": suggested_mapping
    }


def suggest_column_mapping(headers: List[str]) -> Dict[str, str]:
    """Suggest column mapping based on header names"""
    mapping = {}
    
    # Common LinkedIn export column names
    mappings_dict = {
        'first_name': ['first name', 'firstname', 'nombre', 'first_name'],
        'last_name': ['last name', 'lastname', 'apellido', 'last_name'],
        'email': ['email', 'email address', 'correo', 'e-mail'],
        'company': ['company', 'empresa', 'organization', 'company name'],
        'job_title': ['position', 'title', 'job title', 'cargo', 'puesto', 'job_title'],
        'linkedin_url': ['url', 'profile url', 'linkedin url', 'linkedin', 'profile_url'],
        'connected_on': ['connected on', 'connected_on', 'fecha conexión', 'connection date']
    }
    
    headers_lower = {h.lower().strip(): h for h in headers}
    
    for field, variants in mappings_dict.items():
        for variant in variants:
            if variant in headers_lower:
                mapping[headers_lower[variant]] = field
                break
    
    return mapping


@router.post("/start/{job_id}")
async def start_import(
    job_id: str,
    column_mapping: Dict[str, str],
    current_user: dict = Depends(get_current_user)
):
    """
    Mark job as ready for processing by the worker.
    
    V2: Does NOT use BackgroundTasks.
    Worker process picks up jobs with status 'uploaded' and column_mapping set.
    """
    job = await db.linkedin_import_jobs.find_one({"job_id": job_id}, {"_id": 0})
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    
    if job["status"] not in ["uploaded", "failed", "pending_retry"]:
        raise HTTPException(status_code=400, detail=f"Job is in status '{job['status']}', cannot start")
    
    # Check for existing processing job for this profile
    existing = await db.linkedin_import_jobs.find_one({
        "profile": job["profile"],
        "status": "processing",
        "job_id": {"$ne": job_id}
    })
    if existing:
        raise HTTPException(
            status_code=409,
            detail=f"Another import is processing for profile {job['profile']}. Wait for it to complete."
        )
    
    # Validate mapping has required fields
    mapped_fields = set(column_mapping.values())
    if "first_name" not in mapped_fields and "last_name" not in mapped_fields and "linkedin_url" not in mapped_fields:
        raise HTTPException(
            status_code=400,
            detail="Mapping must include at least one of: first_name, last_name, or linkedin_url"
        )
    
    # Save mapping for future use
    await db.linkedin_import_mappings.update_one(
        {"profile": job["profile"]},
        {
            "$set": {
                "mapping": column_mapping,
                "updated_at": datetime.now(timezone.utc).isoformat()
            },
            "$setOnInsert": {"profile": job["profile"]}
        },
        upsert=True
    )
    
    now = datetime.now(timezone.utc).isoformat()
    
    # Update job with mapping - worker will pick it up
    # Status stays "uploaded" - worker changes it to "processing"
    await db.linkedin_import_jobs.update_one(
        {"job_id": job_id},
        {
            "$set": {
                "column_mapping": column_mapping,
                "queued_at": now,
                "queued_by_user_id": current_user.get("id"),
                "processed_rows": 0,
                "contacts_created": 0,
                "contacts_updated": 0,
                "conflicts_count": 0,
                "error_summary": None,
                "attempts": 0,
                "max_attempts": 3
            }
        }
    )
    
    return {
        "success": True,
        "job_id": job_id,
        "status": "queued",
        "message": "Import queued. Worker will process it shortly. Use /progress/{job_id} to track."
    }


@router.get("/progress/{job_id}")
async def get_progress(
    job_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get import job progress"""
    job = await db.linkedin_import_jobs.find_one({"job_id": job_id}, {"_id": 0})
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    
    return {
        "job_id": job["job_id"],
        "status": job["status"],
        "progress_percent": job.get("progress_percent", 0),
        "total_rows": job["total_rows"],
        "processed_rows": job.get("processed_rows", 0),
        "contacts_created": job.get("contacts_created", 0),
        "contacts_updated": job.get("contacts_updated", 0),
        "conflicts_count": job.get("conflicts_count", 0),
        "invalid_rows_count": job.get("invalid_rows_count", 0),
        "error_summary": job.get("error_summary"),
        "started_at": job.get("started_at"),
        "completed_at": job.get("completed_at")
    }


@router.post("/cancel/{job_id}")
async def cancel_import(
    job_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Cancel a running import job"""
    job = await db.linkedin_import_jobs.find_one({"job_id": job_id})
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    
    if job["status"] != "processing":
        raise HTTPException(status_code=400, detail=f"Job is in status '{job['status']}', cannot cancel")
    
    await db.linkedin_import_jobs.update_one(
        {"job_id": job_id},
        {
            "$set": {
                "status": "cancelled",
                "completed_at": datetime.now(timezone.utc).isoformat(),
                "error_summary": "Cancelled by user"
            }
        }
    )
    
    return {"success": True, "message": "Job cancelled"}


@router.get("/{job_id}/conflicts")
async def get_conflicts(
    job_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get conflicts for a job"""
    job = await db.linkedin_import_jobs.find_one({"job_id": job_id}, {"_id": 0})
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    
    conflicts = await db.linkedin_import_conflicts.find(
        {"job_id": job_id},
        {"_id": 0}
    ).sort("row_number", 1).to_list(10000)
    
    return {
        "job_id": job_id,
        "total_conflicts": len(conflicts),
        "conflicts": conflicts
    }


@router.get("/{job_id}/conflicts/download")
async def download_conflicts_csv(
    job_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Download conflicts as CSV"""
    from fastapi.responses import StreamingResponse
    
    job = await db.linkedin_import_jobs.find_one({"job_id": job_id}, {"_id": 0})
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    
    conflicts = await db.linkedin_import_conflicts.find(
        {"job_id": job_id},
        {"_id": 0}
    ).sort("row_number", 1).to_list(10000)
    
    # Generate CSV
    output = io.StringIO()
    writer = csv.DictWriter(output, fieldnames=["row_number", "email", "linkedin_url", "conflict_type", "details"])
    writer.writeheader()
    for conflict in conflicts:
        writer.writerow({
            "row_number": conflict.get("row_number"),
            "email": conflict.get("email"),
            "linkedin_url": conflict.get("linkedin_url"),
            "conflict_type": conflict.get("conflict_type"),
            "details": conflict.get("details")
        })
    
    output.seek(0)
    
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=conflicts_{job_id}.csv"}
    )


@router.get("/jobs")
async def list_jobs(
    profile: Optional[str] = None,
    week_start: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """List import jobs with optional filters"""
    query = {}
    if profile:
        query["profile"] = profile
    if week_start:
        query["week_start"] = week_start
    
    jobs = await db.linkedin_import_jobs.find(
        query,
        {"_id": 0, "file_storage_path": 0}
    ).sort("created_at", -1).to_list(100)
    
    return {"jobs": jobs}

# ============ SEMAPHORE CALCULATION ============

async def calculate_import_new_connections_status() -> str:
    """
    Calculate traffic light status for Import New Connections section.
    
    Rules:
    - RED: Neither profile has requested export this week
    - YELLOW: At least one requested but not both imported
    - GREEN: Both profiles have at least one completed import this week
    """
    week_start = get_current_week_start()
    
    gb_task = await db.linkedin_import_tasks.find_one({"profile": "GB", "week_start": week_start})
    mg_task = await db.linkedin_import_tasks.find_one({"profile": "MG", "week_start": week_start})
    
    gb_requested = gb_task.get("export_requested", False) if gb_task else False
    mg_requested = mg_task.get("export_requested", False) if mg_task else False
    
    gb_imported = gb_task.get("import_completed", False) if gb_task else False
    mg_imported = mg_task.get("import_completed", False) if mg_task else False
    
    # GREEN: Both profiles have completed imports
    if gb_imported and mg_imported:
        return "green"
    
    # RED: Nothing requested
    if not gb_requested and not mg_requested:
        return "red"
    
    # YELLOW: Something started but not complete
    return "yellow"


# ============ REPORTING ENDPOINTS ============

@router.get("/job/{job_id}")
async def get_job_detail(
    job_id: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Get full details for a specific job.
    Returns all job data including headers, column_mapping, buyer_persona_counts, etc.
    """
    job = await db.linkedin_import_jobs.find_one(
        {"job_id": job_id},
        {"_id": 0}
    )
    
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    
    # Calculate duration if completed
    duration_sec = None
    throughput = None
    if job.get("started_at") and job.get("completed_at"):
        try:
            start = datetime.fromisoformat(job["started_at"].replace("Z", "+00:00"))
            end = datetime.fromisoformat(job["completed_at"].replace("Z", "+00:00"))
            duration_sec = (end - start).total_seconds()
            if duration_sec > 0 and job.get("total_rows"):
                throughput = round(job["total_rows"] / duration_sec, 2)
        except:
            pass
    
    # Get user info
    user_info = None
    if job.get("created_by_user_id"):
        user = await db.unified_contacts.find_one(
            {"id": job["created_by_user_id"]},
            {"_id": 0, "id": 1, "first_name": 1, "last_name": 1, "email": 1}
        )
        if user:
            user_info = {
                "id": user.get("id"),
                "name": f"{user.get('first_name', '')} {user.get('last_name', '')}".strip(),
                "email": user.get("email")
            }
    
    # Get conflicts count
    conflicts_count = await db.linkedin_import_conflicts.count_documents({"job_id": job_id})
    
    # Get invalid rows count
    invalid_rows_count = await db.linkedin_import_invalid_rows.count_documents({"job_id": job_id})
    
    # Get parse failures count
    parse_failures_count = await db.linkedin_import_parse_failures.count_documents({"job_id": job_id})
    
    # Get sample invalid rows (for preview)
    invalid_rows_sample = await db.linkedin_import_invalid_rows.find(
        {"job_id": job_id},
        {"_id": 0}
    ).sort("row_number", 1).limit(5).to_list(5)
    
    # Get sample parse failures (for preview)
    parse_failures_sample = await db.linkedin_import_parse_failures.find(
        {"job_id": job_id},
        {"_id": 0}
    ).sort("row_number", 1).limit(5).to_list(5)
    
    # Get sample conflicts (for preview)
    conflicts_sample = await db.linkedin_import_conflicts.find(
        {"job_id": job_id},
        {"_id": 0}
    ).sort("row_number", 1).limit(5).to_list(5)
    
    # Build comprehensive error summary
    error_summary_detail = {
        "total_errors": conflicts_count + invalid_rows_count,
        "conflicts": {
            "count": conflicts_count,
            "reason": "Email matches one contact but LinkedIn URL matches a different contact",
            "has_download": conflicts_count > 0,
            "sample": conflicts_sample
        },
        "invalid_rows": {
            "count": invalid_rows_count,
            "reason": "Row has no name (first_name/last_name) and no valid linkedin_url",
            "has_download": invalid_rows_count > 0,
            "sample": invalid_rows_sample
        },
        "connected_on_parse_failed": {
            "count": job.get("connected_on_parse_failed", 0),
            "reason": "Date format not recognized or invalid date",
            "has_download": parse_failures_count > 0,
            "sample": [p for p in parse_failures_sample if p.get("field_name") == "connected_on"][:3]
        },
        "email_invalid_format": {
            "count": job.get("email_invalid_format", 0),
            "reason": "Email has invalid format"
        },
        "linkedin_url_invalid_format": {
            "count": job.get("linkedin_url_invalid_format", 0),
            "reason": "LinkedIn URL could not be normalized"
        }
    }
    
    return {
        **job,
        "duration_sec": duration_sec,
        "throughput_rows_per_sec": throughput,
        "created_by_user": user_info,
        "conflicts_list_count": conflicts_count,
        "invalid_rows_list_count": invalid_rows_count,
        "parse_failures_list_count": parse_failures_count,
        "error_summary_detail": error_summary_detail
    }


@router.get("/history")
async def get_import_history(
    weeks: int = 12,
    profile: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """
    Get aggregated import history by week.
    
    Args:
        weeks: Number of weeks to include (default 12, max 52)
        profile: Filter by profile (GB, MG, or None for all)
    
    Returns:
        Array of weekly aggregates with totals, counts, averages.
    """
    weeks = min(weeks, 52)  # Cap at 52 weeks
    
    # Calculate date range
    today = datetime.now(timezone.utc)
    monday = today - timedelta(days=today.weekday())
    monday = monday.replace(hour=0, minute=0, second=0, microsecond=0)
    
    # Generate list of week_starts
    week_starts = []
    for i in range(weeks):
        week_date = monday - timedelta(weeks=i)
        week_starts.append(week_date.date().isoformat())
    
    # Build query
    query = {"week_start": {"$in": week_starts}}
    if profile and profile in LINKEDIN_PROFILES:
        query["profile"] = profile
    
    # Get all jobs in range
    jobs = await db.linkedin_import_jobs.find(
        query,
        {"_id": 0, "file_storage_path": 0, "headers": 0, "column_mapping": 0}
    ).to_list(5000)
    
    # Aggregate by week
    weekly_data = {}
    for week in week_starts:
        weekly_data[week] = {
            "week_start": week,
            "jobs_total": 0,
            "jobs_completed": 0,
            "jobs_failed": 0,
            "jobs_cancelled": 0,
            "total_rows_sum": 0,
            "processed_rows_sum": 0,
            "created_sum": 0,
            "updated_sum": 0,
            "conflicts_sum": 0,
            "invalid_sum": 0,
            "connected_on_parse_failed_sum": 0,
            "companies_created_sum": 0,
            "duration_sum_sec": 0,
            "duration_count": 0,
            "last_completed_at": None,
            "profiles": {"GB": False, "MG": False}
        }
    
    for job in jobs:
        week = job.get("week_start")
        if week not in weekly_data:
            continue
        
        w = weekly_data[week]
        w["jobs_total"] += 1
        
        status = job.get("status")
        if status == "completed":
            w["jobs_completed"] += 1
            w["profiles"][job.get("profile", "GB")] = True
        elif status == "failed":
            w["jobs_failed"] += 1
        elif status == "cancelled":
            w["jobs_cancelled"] += 1
        
        w["total_rows_sum"] += job.get("total_rows", 0) or 0
        w["processed_rows_sum"] += job.get("processed_rows", 0) or 0
        w["created_sum"] += job.get("contacts_created", 0) or 0
        w["updated_sum"] += job.get("contacts_updated", 0) or 0
        w["conflicts_sum"] += job.get("conflicts_count", 0) or 0
        w["invalid_sum"] += job.get("invalid_rows_count", 0) or 0
        w["connected_on_parse_failed_sum"] += job.get("connected_on_parse_failed", 0) or 0
        w["companies_created_sum"] += job.get("companies_created", 0) or 0
        
        # Calculate duration
        if job.get("started_at") and job.get("completed_at"):
            try:
                start = datetime.fromisoformat(job["started_at"].replace("Z", "+00:00"))
                end = datetime.fromisoformat(job["completed_at"].replace("Z", "+00:00"))
                duration = (end - start).total_seconds()
                if duration > 0:
                    w["duration_sum_sec"] += duration
                    w["duration_count"] += 1
            except:
                pass
        
        # Track last completed
        if job.get("completed_at"):
            if not w["last_completed_at"] or job["completed_at"] > w["last_completed_at"]:
                w["last_completed_at"] = job["completed_at"]
    
    # Calculate averages and throughput
    result = []
    for week in week_starts:
        w = weekly_data[week]
        
        # Average duration
        w["duration_avg_sec"] = round(w["duration_sum_sec"] / w["duration_count"], 2) if w["duration_count"] > 0 else None
        
        # Throughput (rows per second)
        if w["duration_sum_sec"] > 0 and w["processed_rows_sum"] > 0:
            w["throughput_avg"] = round(w["processed_rows_sum"] / w["duration_sum_sec"], 2)
        else:
            w["throughput_avg"] = None
        
        # Week complete flag
        w["week_complete"] = w["profiles"]["GB"] and w["profiles"]["MG"]
        
        result.append(w)
    
    return {
        "weeks_requested": weeks,
        "profile_filter": profile,
        "data": result
    }


@router.get("/jobs-by-week")
async def get_jobs_by_week(
    week_start: str,
    profile: Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
    current_user: dict = Depends(get_current_user)
):
    """
    Get jobs for a specific week with pagination.
    Used for drill-down in the historical view.
    """
    limit = min(limit, 100)  # Cap at 100
    
    query = {"week_start": week_start}
    if profile and profile in LINKEDIN_PROFILES:
        query["profile"] = profile
    
    # Get total count
    total = await db.linkedin_import_jobs.count_documents(query)
    
    # Get paginated jobs
    jobs = await db.linkedin_import_jobs.find(
        query,
        {"_id": 0, "file_storage_path": 0}
    ).sort("created_at", -1).skip(offset).limit(limit).to_list(limit)
    
    # Enrich with calculated fields
    enriched_jobs = []
    for job in jobs:
        duration_sec = None
        throughput = None
        if job.get("started_at") and job.get("completed_at"):
            try:
                start = datetime.fromisoformat(job["started_at"].replace("Z", "+00:00"))
                end = datetime.fromisoformat(job["completed_at"].replace("Z", "+00:00"))
                duration_sec = (end - start).total_seconds()
                if duration_sec > 0 and job.get("total_rows"):
                    throughput = round(job["total_rows"] / duration_sec, 2)
            except:
                pass
        
        enriched_jobs.append({
            **job,
            "duration_sec": duration_sec,
            "throughput_rows_per_sec": throughput
        })
    
    return {
        "week_start": week_start,
        "profile_filter": profile,
        "total": total,
        "limit": limit,
        "offset": offset,
        "jobs": enriched_jobs
    }


# ============ ERROR DOWNLOAD ENDPOINTS ============

@router.get("/job/{job_id}/invalid-rows")
async def get_invalid_rows(
    job_id: str,
    limit: int = 50,
    offset: int = 0,
    current_user: dict = Depends(get_current_user)
):
    """Get invalid rows for a job with pagination"""
    total = await db.linkedin_import_invalid_rows.count_documents({"job_id": job_id})
    
    rows = await db.linkedin_import_invalid_rows.find(
        {"job_id": job_id},
        {"_id": 0}
    ).sort("row_number", 1).skip(offset).limit(min(limit, 100)).to_list(100)
    
    return {
        "job_id": job_id,
        "total": total,
        "limit": limit,
        "offset": offset,
        "rows": rows
    }


@router.get("/job/{job_id}/invalid-rows/download")
async def download_invalid_rows(
    job_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Download invalid rows as CSV"""
    rows = await db.linkedin_import_invalid_rows.find(
        {"job_id": job_id},
        {"_id": 0}
    ).sort("row_number", 1).to_list(10000)
    
    if not rows:
        raise HTTPException(status_code=404, detail="No invalid rows found for this job")
    
    output = io.StringIO()
    
    # Get all unique keys from raw_row across all rows
    all_raw_keys = set()
    for row in rows:
        if row.get("raw_row"):
            all_raw_keys.update(row["raw_row"].keys())
    
    fieldnames = ["job_id", "row_number", "reason_code", "reason_detail"] + sorted(list(all_raw_keys))
    writer = csv.DictWriter(output, fieldnames=fieldnames, extrasaction='ignore')
    writer.writeheader()
    
    for row in rows:
        flat_row = {
            "job_id": row.get("job_id"),
            "row_number": row.get("row_number"),
            "reason_code": row.get("reason_code"),
            "reason_detail": row.get("reason_detail")
        }
        # Add raw row data
        if row.get("raw_row"):
            flat_row.update(row["raw_row"])
        writer.writerow(flat_row)
    
    output.seek(0)
    return Response(
        content=output.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=invalid_rows_{job_id}.csv"}
    )


@router.get("/job/{job_id}/parse-failures")
async def get_parse_failures(
    job_id: str,
    limit: int = 50,
    offset: int = 0,
    current_user: dict = Depends(get_current_user)
):
    """Get parse failures for a job with pagination"""
    total = await db.linkedin_import_parse_failures.count_documents({"job_id": job_id})
    
    rows = await db.linkedin_import_parse_failures.find(
        {"job_id": job_id},
        {"_id": 0}
    ).sort("row_number", 1).skip(offset).limit(min(limit, 100)).to_list(100)
    
    return {
        "job_id": job_id,
        "total": total,
        "limit": limit,
        "offset": offset,
        "rows": rows
    }


@router.get("/job/{job_id}/parse-failures/download")
async def download_parse_failures(
    job_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Download parse failures as CSV"""
    rows = await db.linkedin_import_parse_failures.find(
        {"job_id": job_id},
        {"_id": 0}
    ).sort("row_number", 1).to_list(10000)
    
    if not rows:
        raise HTTPException(status_code=404, detail="No parse failures found for this job")
    
    output = io.StringIO()
    fieldnames = ["job_id", "row_number", "field_name", "raw_value", "reason_code", "reason_detail"]
    writer = csv.DictWriter(output, fieldnames=fieldnames, extrasaction='ignore')
    writer.writeheader()
    
    for row in rows:
        writer.writerow({
            "job_id": row.get("job_id"),
            "row_number": row.get("row_number"),
            "field_name": row.get("field_name"),
            "raw_value": row.get("raw_value"),
            "reason_code": row.get("reason_code"),
            "reason_detail": row.get("reason_detail")
        })
    
    output.seek(0)
    return Response(
        content=output.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=parse_failures_{job_id}.csv"}
    )
