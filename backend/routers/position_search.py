"""
Position Search Router - Automated LinkedIn search by buyer persona keywords
Features:
- Auto-sync keywords from buyer personas
- Keyword rotation (no repeats until full cycle)
- Weekly goal: 10 unique contacts per buyer persona
- Scheduled execution every Sunday via Apify
- Rate limit detection and alerting
"""
from fastapi import APIRouter, HTTPException, Depends, BackgroundTasks
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timezone, timedelta
import uuid
import asyncio
import httpx
import os

from database import db
from routers.auth import get_current_user

router = APIRouter(prefix="/position-search", tags=["position-search"])

# Apify configuration
APIFY_TOKEN = os.environ.get("APIFY_TOKEN", "")
LINKEDIN_ACTOR_ID = "curious_coder/linkedin-search"

# Weekly goal per buyer persona
WEEKLY_GOAL_PER_PERSONA = 10


class SearchConfig(BaseModel):
    buyer_persona_id: str
    max_results: int = 50


class ApifyRateLimitError(Exception):
    """Raised when Apify rate limit is reached"""
    pass


# ============ KEYWORD SYNC ============

@router.post("/sync-keywords")
async def sync_keywords_from_personas(
    current_user: dict = Depends(get_current_user)
):
    """
    Sync keywords from buyer personas (keywords field) to position_search_keywords.
    Uses batch operations for efficiency.
    """
    # Get existing keywords to avoid duplicates
    existing_keys = set()
    existing = await db.position_search_keywords.find({}, {"_id": 0, "keyword": 1, "buyer_persona_id": 1}).to_list(None)
    for e in existing:
        existing_keys.add(f"{e.get('keyword')}|{e.get('buyer_persona_id')}")
    
    # Get all buyer personas with their keywords
    personas = await db.buyer_personas_db.find({}, {"_id": 0}).to_list(None)
    
    to_insert = []
    now = datetime.now(timezone.utc).isoformat()
    
    for persona in personas:
        persona_id = persona.get("code") or persona.get("name", "").lower().replace(" ", "_")
        persona_name = persona.get("display_name") or persona.get("name", "")
        
        # Get keywords from the 'keywords' field (array)
        keywords = persona.get("keywords", [])
        
        # Also check linkedin_keywords as fallback
        if not keywords:
            keywords = persona.get("linkedin_keywords", [])
            if isinstance(keywords, str):
                keywords = [k.strip() for k in keywords.split(";") if k.strip()]
        
        for keyword in keywords:
            keyword_lower = keyword.lower().strip()
            if not keyword_lower:
                continue
            
            key = f"{keyword_lower}|{persona_id}"
            if key in existing_keys:
                continue
            
            existing_keys.add(key)  # Prevent duplicates in same batch
            
            to_insert.append({
                "id": str(uuid.uuid4()),
                "keyword": keyword_lower,
                "buyer_persona_id": persona_id,
                "buyer_persona_name": persona_name,
                "last_used": None,
                "use_count": 0,
                "contacts_found": 0,
                "created_at": now
            })
    
    # Batch insert
    if to_insert:
        await db.position_search_keywords.insert_many(to_insert)
    
    # Get total count
    total_keywords = await db.position_search_keywords.count_documents({})
    
    return {
        "success": True,
        "synced": len(to_insert),
        "total_keywords": total_keywords,
        "personas_processed": len(personas)
    }


@router.get("/keywords/{buyer_persona_id}")
async def get_keywords_for_persona(
    buyer_persona_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get all keywords for a specific buyer persona with rotation status"""
    keywords = await db.position_search_keywords.find(
        {"buyer_persona_id": buyer_persona_id},
        {"_id": 0}
    ).sort("last_used", 1).to_list(None)  # Sort by last_used (oldest first)
    
    return {
        "success": True,
        "keywords": keywords,
        "total": len(keywords)
    }


@router.get("/next-keyword/{buyer_persona_id}")
async def get_next_keyword(
    buyer_persona_id: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Get the next keyword to use for a buyer persona.
    Returns the keyword that was used least recently (rotation).
    """
    # Get the keyword with the oldest last_used (or None = never used)
    keyword = await db.position_search_keywords.find_one(
        {"buyer_persona_id": buyer_persona_id},
        {"_id": 0},
        sort=[("last_used", 1)]
    )
    
    if not keyword:
        return {"success": False, "message": "No keywords found for this buyer persona"}
    
    return {
        "success": True,
        "keyword": keyword
    }


# ============ WEEKLY PROGRESS TRACKING ============

@router.get("/weekly-progress")
async def get_weekly_progress(
    current_user: dict = Depends(get_current_user)
):
    """
    Get weekly progress for all buyer personas.
    Shows how many unique contacts were found this week for each.
    """
    now = datetime.now(timezone.utc)
    
    # Calculate week start (Monday)
    days_since_monday = now.weekday()
    week_start = (now - timedelta(days=days_since_monday)).replace(hour=0, minute=0, second=0, microsecond=0)
    week_key = week_start.strftime("%Y-W%W")
    
    # Get all buyer personas
    personas = await db.buyer_personas_db.find({}, {"_id": 0, "code": 1, "name": 1, "display_name": 1}).to_list(None)
    
    progress = []
    total_found = 0
    total_goal = 0
    
    for persona in personas:
        persona_id = persona.get("code") or persona.get("name", "").lower().replace(" ", "_")
        persona_name = persona.get("display_name") or persona.get("name", "")
        
        # Count unique contacts found this week for this persona
        contacts_this_week = await db.unified_contacts.count_documents({
            "buyer_persona": persona_name,
            "source": {"$in": ["position_search", "deal_makers_by_position", "linkedin_position", "linkedin"]},
            "created_at": {"$gte": week_start.isoformat()}
        })
        
        status = "green" if contacts_this_week >= WEEKLY_GOAL_PER_PERSONA else \
                 "yellow" if contacts_this_week > 0 else "red"
        
        progress.append({
            "buyer_persona_id": persona_id,
            "buyer_persona_name": persona_name,
            "contacts_this_week": contacts_this_week,
            "goal": WEEKLY_GOAL_PER_PERSONA,
            "remaining": max(0, WEEKLY_GOAL_PER_PERSONA - contacts_this_week),
            "status": status,
            "progress_percent": min(100, int((contacts_this_week / WEEKLY_GOAL_PER_PERSONA) * 100))
        })
        
        total_found += contacts_this_week
        total_goal += WEEKLY_GOAL_PER_PERSONA
    
    # Check for rate limit alerts
    rate_limit_alert = await db.position_search_alerts.find_one(
        {"type": "rate_limit", "week_key": week_key, "resolved": False},
        {"_id": 0}
    )
    
    return {
        "success": True,
        "week_key": week_key,
        "week_start": week_start.isoformat(),
        "progress": progress,
        "total_found": total_found,
        "total_goal": total_goal,
        "overall_status": "green" if total_found >= total_goal else "yellow" if total_found > 0 else "red",
        "rate_limit_alert": rate_limit_alert
    }


# ============ SEARCH EXECUTION ============

@router.post("/search/{buyer_persona_id}")
async def search_for_persona(
    buyer_persona_id: str,
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(get_current_user)
):
    """
    Execute a search for a specific buyer persona.
    Uses keyword rotation and checks for duplicates.
    """
    # Get persona info
    persona = await db.buyer_personas_db.find_one(
        {"$or": [{"code": buyer_persona_id}, {"name": buyer_persona_id}]},
        {"_id": 0}
    )
    
    if not persona:
        raise HTTPException(status_code=404, detail="Buyer persona not found")
    
    persona_name = persona.get("display_name") or persona.get("name", "")
    
    # Check weekly progress
    now = datetime.now(timezone.utc)
    days_since_monday = now.weekday()
    week_start = (now - timedelta(days=days_since_monday)).replace(hour=0, minute=0, second=0, microsecond=0)
    
    contacts_this_week = await db.unified_contacts.count_documents({
        "buyer_persona": persona_name,
        "source": {"$in": ["position_search", "deal_makers_by_position", "linkedin_position", "linkedin"]},
        "created_at": {"$gte": week_start.isoformat()}
    })
    
    if contacts_this_week >= WEEKLY_GOAL_PER_PERSONA:
        return {
            "success": True,
            "message": f"Weekly goal already reached for {persona_name}",
            "contacts_this_week": contacts_this_week,
            "goal": WEEKLY_GOAL_PER_PERSONA
        }
    
    # Get next keyword to use (rotation)
    keyword_doc = await db.position_search_keywords.find_one(
        {"buyer_persona_id": buyer_persona_id},
        {"_id": 0},
        sort=[("last_used", 1)]
    )
    
    if not keyword_doc:
        # Try to sync keywords first
        await sync_keywords_from_personas(current_user)
        keyword_doc = await db.position_search_keywords.find_one(
            {"buyer_persona_id": buyer_persona_id},
            {"_id": 0},
            sort=[("last_used", 1)]
        )
        
        if not keyword_doc:
            raise HTTPException(status_code=404, detail=f"No keywords found for {persona_name}. Add keywords in WHO section.")
    
    # Create search run record
    run_id = str(uuid.uuid4())
    run_doc = {
        "id": run_id,
        "type": "position_search",
        "buyer_persona_id": buyer_persona_id,
        "buyer_persona_name": persona_name,
        "keyword": keyword_doc["keyword"],
        "status": "running",
        "started_at": now.isoformat(),
        "created_by": current_user.get("email")
    }
    await db.position_search_runs.insert_one(run_doc)
    
    # Execute search in background
    background_tasks.add_task(
        execute_position_search,
        run_id,
        buyer_persona_id,
        persona_name,
        keyword_doc["keyword"],
        keyword_doc["id"],
        WEEKLY_GOAL_PER_PERSONA - contacts_this_week
    )
    
    return {
        "success": True,
        "message": f"Search started for {persona_name}",
        "run_id": run_id,
        "keyword": keyword_doc["keyword"],
        "remaining_goal": WEEKLY_GOAL_PER_PERSONA - contacts_this_week
    }


async def execute_position_search(
    run_id: str,
    buyer_persona_id: str,
    persona_name: str,
    keyword: str,
    keyword_id: str,
    remaining_goal: int
):
    """Background task to execute the actual LinkedIn search via Apify"""
    now = datetime.now(timezone.utc)
    
    try:
        if not APIFY_TOKEN:
            raise Exception("APIFY_TOKEN not configured")
        
        # Prepare LinkedIn search query
        search_query = f'"{keyword}" Mexico'
        
        async with httpx.AsyncClient(timeout=300) as client:
            # Start Apify actor
            input_data = {
                "searchQuery": search_query,
                "maxResults": min(50, remaining_goal * 3),  # Get extra to account for duplicates
                "proxyConfiguration": {"useApifyProxy": True}
            }
            
            run_response = await client.post(
                f"https://api.apify.com/v2/acts/{LINKEDIN_ACTOR_ID}/runs",
                headers={"Authorization": f"Bearer {APIFY_TOKEN}"},
                json=input_data
            )
            
            # Check for rate limit
            if run_response.status_code == 429:
                await handle_rate_limit(buyer_persona_id, persona_name)
                raise ApifyRateLimitError("Apify rate limit reached")
            
            if run_response.status_code != 201:
                error_text = run_response.text
                if "limit" in error_text.lower() or "quota" in error_text.lower():
                    await handle_rate_limit(buyer_persona_id, persona_name)
                    raise ApifyRateLimitError(f"Apify limit reached: {error_text}")
                raise Exception(f"Failed to start actor: {error_text}")
            
            run_data = run_response.json()
            apify_run_id = run_data["data"]["id"]
            
            # Wait for completion
            max_wait = 300
            waited = 0
            while waited < max_wait:
                status_response = await client.get(
                    f"https://api.apify.com/v2/actor-runs/{apify_run_id}",
                    headers={"Authorization": f"Bearer {APIFY_TOKEN}"}
                )
                status_data = status_response.json()
                status = status_data["data"]["status"]
                
                if status == "SUCCEEDED":
                    break
                elif status in ["FAILED", "ABORTED", "TIMED-OUT"]:
                    error_msg = status_data["data"].get("statusMessage", "")
                    if "limit" in error_msg.lower() or "quota" in error_msg.lower():
                        await handle_rate_limit(buyer_persona_id, persona_name)
                        raise ApifyRateLimitError(f"Apify limit: {error_msg}")
                    raise Exception(f"Actor run failed: {status}")
                
                await asyncio.sleep(5)
                waited += 5
            
            # Get results
            dataset_id = status_data["data"]["defaultDatasetId"]
            results_response = await client.get(
                f"https://api.apify.com/v2/datasets/{dataset_id}/items",
                headers={"Authorization": f"Bearer {APIFY_TOKEN}"}
            )
            
            results = results_response.json()
        
        # Process results - check for duplicates
        new_contacts = 0
        duplicates = 0
        
        for profile in results:
            # Get clean LinkedIn URL - prioritize publicId for clean vanity URL
            public_id = profile.get("publicId")
            if public_id:
                linkedin_url = f"https://www.linkedin.com/in/{public_id}"
            else:
                # Fallback to profileUrl or url from response
                linkedin_url = profile.get("profileUrl") or profile.get("url")
            
            email = profile.get("email")
            
            if not linkedin_url:
                continue
            
            # Check for duplicate by LinkedIn URL or email
            existing = await db.unified_contacts.find_one({
                "$or": [
                    {"linkedin_url": linkedin_url},
                    {"email": email} if email else {"email": None}
                ]
            })
            
            if existing:
                duplicates += 1
                continue
            
            # Create new contact
            contact_doc = {
                "id": str(uuid.uuid4()),
                "name": f"{profile.get('firstName', '')} {profile.get('lastName', '')}".strip() or profile.get("fullName", ""),
                "email": email,
                "linkedin_url": linkedin_url,
                "linkedin_public_id": public_id,  # Store for reference
                "job_title": profile.get("headline") or profile.get("title", ""),
                "company": profile.get("company") or profile.get("companyName", ""),
                "location": profile.get("location", "Mexico"),
                "stage": 1,
                "buyer_persona": persona_name,
                "source": "position_search",
                "source_keyword": keyword,  # Top-level field for grouping in DealMakers UI
                "source_details": {
                    "keyword": keyword,
                    "run_id": run_id,
                    "buyer_persona_id": buyer_persona_id
                },
                "created_at": now.isoformat(),
                "updated_at": now.isoformat()
            }
            
            await db.unified_contacts.insert_one(contact_doc)
            new_contacts += 1
            
            # Stop if we've reached the goal
            if new_contacts >= remaining_goal:
                break
        
        # Update keyword usage
        await db.position_search_keywords.update_one(
            {"id": keyword_id},
            {
                "$set": {"last_used": now.isoformat()},
                "$inc": {"use_count": 1, "contacts_found": new_contacts}
            }
        )
        
        # Update run record
        await db.position_search_runs.update_one(
            {"id": run_id},
            {"$set": {
                "status": "completed",
                "completed_at": now.isoformat(),
                "results": {
                    "total_found": len(results),
                    "new_contacts": new_contacts,
                    "duplicates": duplicates
                }
            }}
        )
        
    except ApifyRateLimitError as e:
        await db.position_search_runs.update_one(
            {"id": run_id},
            {"$set": {
                "status": "rate_limited",
                "completed_at": now.isoformat(),
                "error": str(e)
            }}
        )
    except Exception as e:
        await db.position_search_runs.update_one(
            {"id": run_id},
            {"$set": {
                "status": "failed",
                "completed_at": now.isoformat(),
                "error": str(e)
            }}
        )


async def handle_rate_limit(buyer_persona_id: str, persona_name: str):
    """Create an alert when rate limit is reached"""
    now = datetime.now(timezone.utc)
    days_since_monday = now.weekday()
    week_start = (now - timedelta(days=days_since_monday)).replace(hour=0, minute=0, second=0, microsecond=0)
    week_key = week_start.strftime("%Y-W%W")
    
    # Check if alert already exists for this week
    existing = await db.position_search_alerts.find_one({
        "type": "rate_limit",
        "week_key": week_key,
        "resolved": False
    })
    
    if not existing:
        alert_doc = {
            "id": str(uuid.uuid4()),
            "type": "rate_limit",
            "week_key": week_key,
            "message": "Se alcanzó el límite de búsquedas de Apify. El semáforo se mostrará en rojo hasta que se resuelva.",
            "buyer_persona_id": buyer_persona_id,
            "buyer_persona_name": persona_name,
            "created_at": now.isoformat(),
            "resolved": False
        }
        await db.position_search_alerts.insert_one(alert_doc)


@router.post("/resolve-alert/{alert_id}")
async def resolve_rate_limit_alert(
    alert_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Mark a rate limit alert as resolved"""
    result = await db.position_search_alerts.update_one(
        {"id": alert_id},
        {"$set": {
            "resolved": True,
            "resolved_at": datetime.now(timezone.utc).isoformat(),
            "resolved_by": current_user.get("email")
        }}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Alert not found")
    
    return {"success": True, "message": "Alert resolved"}


# ============ SCHEDULED SEARCH (SUNDAY) ============

@router.post("/run-weekly-search")
async def run_weekly_search(
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(get_current_user)
):
    """
    Manually trigger the weekly search for all buyer personas.
    Normally runs automatically every Sunday.
    """
    # First sync keywords
    await sync_keywords_from_personas(current_user)
    
    # Get all buyer personas
    personas = await db.buyer_personas_db.find({}, {"_id": 0}).to_list(None)
    
    started = 0
    skipped = 0
    
    for persona in personas:
        persona_id = persona.get("code") or persona.get("name", "").lower().replace(" ", "_")
        persona_name = persona.get("display_name") or persona.get("name", "")
        
        # Check if already at goal
        now = datetime.now(timezone.utc)
        days_since_monday = now.weekday()
        week_start = (now - timedelta(days=days_since_monday)).replace(hour=0, minute=0, second=0, microsecond=0)
        
        contacts_this_week = await db.unified_contacts.count_documents({
            "buyer_persona": persona_name,
            "source": {"$in": ["position_search", "deal_makers_by_position", "linkedin_position", "linkedin"]},
            "created_at": {"$gte": week_start.isoformat()}
        })
        
        if contacts_this_week >= WEEKLY_GOAL_PER_PERSONA:
            skipped += 1
            continue
        
        # Get next keyword
        keyword_doc = await db.position_search_keywords.find_one(
            {"buyer_persona_id": persona_id},
            {"_id": 0},
            sort=[("last_used", 1)]
        )
        
        if not keyword_doc:
            skipped += 1
            continue
        
        # Create run record and start search
        run_id = str(uuid.uuid4())
        run_doc = {
            "id": run_id,
            "type": "position_search_weekly",
            "buyer_persona_id": persona_id,
            "buyer_persona_name": persona_name,
            "keyword": keyword_doc["keyword"],
            "status": "running",
            "started_at": now.isoformat()
        }
        await db.position_search_runs.insert_one(run_doc)
        
        background_tasks.add_task(
            execute_position_search,
            run_id,
            persona_id,
            persona_name,
            keyword_doc["keyword"],
            keyword_doc["id"],
            WEEKLY_GOAL_PER_PERSONA - contacts_this_week
        )
        
        started += 1
        
        # Small delay between starting searches to avoid rate limits
        await asyncio.sleep(2)
    
    return {
        "success": True,
        "message": f"Weekly search started for {started} buyer personas",
        "started": started,
        "skipped": skipped
    }


# ============ STATUS FOR TRAFFIC LIGHT ============

@router.get("/status")
async def get_position_search_status(
    current_user: dict = Depends(get_current_user)
):
    """
    Get the overall status for the traffic light system.
    Returns red if rate limit alert exists or no progress.
    """
    now = datetime.now(timezone.utc)
    days_since_monday = now.weekday()
    week_start = (now - timedelta(days=days_since_monday)).replace(hour=0, minute=0, second=0, microsecond=0)
    week_key = week_start.strftime("%Y-W%W")
    
    # Check for rate limit alert
    rate_limit_alert = await db.position_search_alerts.find_one(
        {"type": "rate_limit", "week_key": week_key, "resolved": False},
        {"_id": 0}
    )
    
    if rate_limit_alert:
        return {
            "status": "red",
            "reason": "rate_limit",
            "message": rate_limit_alert.get("message", "Rate limit reached"),
            "alert_id": rate_limit_alert.get("id")
        }
    
    # Count total contacts this week
    total_contacts = await db.unified_contacts.count_documents({
        "source": {"$in": ["position_search", "deal_makers_by_position", "linkedin_position", "linkedin"]},
        "created_at": {"$gte": week_start.isoformat()}
    })
    
    # Get persona count for total goal
    personas_count = await db.buyer_personas_db.count_documents({})
    total_goal = personas_count * WEEKLY_GOAL_PER_PERSONA
    
    if total_contacts >= total_goal:
        status = "green"
    elif total_contacts > 0:
        status = "yellow"
    else:
        status = "red"
    
    return {
        "status": status,
        "contacts_this_week": total_contacts,
        "goal": total_goal,
        "progress": f"{total_contacts}/{total_goal}"
    }



# ============ URL MIGRATION: URN to Clean URLs ============

# Actor for searching profiles by name
NAME_SEARCH_ACTOR = "harvestapi~linkedin-profile-search-by-name"

class UrlMigrationStatus(BaseModel):
    """Status of URL migration job"""
    total_to_migrate: int
    migrated: int
    failed: int
    in_progress: bool
    message: str


def clean_name_for_search(full_name: str) -> tuple:
    """Extract first and last name from full name, removing titles"""
    # Remove common suffixes/prefixes
    for suffix in [", PhD.", "PhD", ", MD", "MD", ", MBA", "MBA", "Dr.", "Dra.", "Ing.", "Lic.", "Mtro.", "Mtra."]:
        full_name = full_name.replace(suffix, "")
    full_name = full_name.strip()
    
    name_parts = full_name.split()
    if len(name_parts) < 2:
        return full_name, ""
    
    first_name = name_parts[0]
    last_name = " ".join(name_parts[1:])
    return first_name, last_name


def company_matches(company_from_db: str, company_from_linkedin: str) -> bool:
    """Check if companies match (partial match allowed)"""
    if not company_from_db or not company_from_linkedin:
        return False
    
    db_words = [w.lower() for w in company_from_db.split() if len(w) > 3]
    linkedin_lower = company_from_linkedin.lower()
    
    # Check if any significant word from DB company is in LinkedIn company
    for word in db_words[:3]:  # Check first 3 significant words
        if word in linkedin_lower:
            return True
    return False


@router.get("/url-migration/status")
async def get_url_migration_status(
    current_user: dict = Depends(get_current_user)
):
    """Get status of URL migration - how many contacts have URN URLs vs clean URLs"""
    
    # Count contacts with URN-style URLs (ACwAAA...)
    urn_count = await db.unified_contacts.count_documents({
        "linkedin_url": {"$regex": "^https://www.linkedin.com/in/ACw"}
    })
    
    # Count contacts with clean URLs (not ACw pattern)
    clean_count = await db.unified_contacts.count_documents({
        "linkedin_url": {
            "$regex": "^https://www.linkedin.com/in/[a-z]",
            "$options": "i",
            "$not": {"$regex": "ACw"}
        }
    })
    
    # Check for ongoing migration
    migration_job = await db.url_migration_jobs.find_one(
        {"status": "in_progress"},
        {"_id": 0}
    )
    
    return {
        "urn_urls_count": urn_count,
        "clean_urls_count": clean_count,
        "migration_in_progress": migration_job is not None,
        "migration_job": migration_job
    }


@router.post("/url-migration/start")
async def start_url_migration(
    background_tasks: BackgroundTasks,
    limit: int = None,
    current_user: dict = Depends(get_current_user)
):
    """
    Start migration of URN URLs to clean URLs using Apify name search.
    This runs in the background and updates contacts as results come in.
    
    Args:
        limit: Optional limit for testing (e.g., 10 for a small test)
    
    Cost: ~$0.008 per profile (search + details)
    """
    
    # Check if migration already in progress
    existing_job = await db.url_migration_jobs.find_one({"status": "in_progress"})
    if existing_job:
        raise HTTPException(
            status_code=400, 
            detail="Migration already in progress. Check status or wait for completion."
        )
    
    # Get contacts with URN URLs
    query = db.unified_contacts.find(
        {"linkedin_url": {"$regex": "^https://www.linkedin.com/in/ACw"}},
        {"_id": 0, "id": 1, "name": 1, "linkedin_url": 1, "company": 1}
    )
    
    if limit:
        query = query.limit(limit)
    
    contacts_to_migrate = await query.to_list(None)
    
    if not contacts_to_migrate:
        return {"message": "No contacts with URN URLs found. Nothing to migrate."}
    
    # Create migration job
    job_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    
    job_doc = {
        "id": job_id,
        "status": "in_progress",
        "total": len(contacts_to_migrate),
        "processed": 0,
        "migrated": 0,
        "failed": 0,
        "skipped": 0,
        "started_at": now,
        "updated_at": now,
        "contacts": [{"id": c["id"], "name": c["name"], "company": c.get("company", ""), "old_url": c["linkedin_url"], "status": "pending"} for c in contacts_to_migrate]
    }
    
    await db.url_migration_jobs.insert_one(job_doc)
    
    # Start background task
    background_tasks.add_task(run_url_migration, job_id, contacts_to_migrate)
    
    return {
        "message": f"Migration started for {len(contacts_to_migrate)} contacts",
        "job_id": job_id,
        "estimated_cost": f"${len(contacts_to_migrate) * 0.008:.2f} USD (search + profile)"
    }

async def run_url_migration(job_id: str, contacts: list):
    """Background task to migrate URLs by searching profiles by name"""
    
    async with httpx.AsyncClient(timeout=300.0) as client:
        processed = 0
        migrated = 0
        failed = 0
        skipped = 0
        
        # Process one contact at a time (search by name is individual)
        for contact in contacts:
            try:
                contact_id = contact["id"]
                full_name = contact.get("name", "")
                company = contact.get("company", "")
                
                # Clean and split name
                first_name, last_name = clean_name_for_search(full_name)
                
                if not first_name or not last_name:
                    # Can't search without proper name
                    await db.url_migration_jobs.update_one(
                        {"id": job_id, "contacts.id": contact_id},
                        {"$set": {"contacts.$.status": "skipped", "contacts.$.error": "Invalid name format"}}
                    )
                    skipped += 1
                    processed += 1
                    continue
                
                # Search by name using Apify
                run_response = await client.post(
                    f"https://api.apify.com/v2/acts/{NAME_SEARCH_ACTOR}/runs",
                    headers={"Authorization": f"Bearer {APIFY_TOKEN}"},
                    json={
                        "firstName": first_name,
                        "lastName": last_name,
                        "profileScraperMode": "Full",
                        "maxItems": 10
                    }
                )
                
                if run_response.status_code != 201:
                    await db.url_migration_jobs.update_one(
                        {"id": job_id, "contacts.id": contact_id},
                        {"$set": {"contacts.$.status": "failed", "contacts.$.error": f"Apify error: {run_response.status_code}"}}
                    )
                    failed += 1
                    processed += 1
                    continue
                
                run_data = run_response.json()
                run_id = run_data["data"]["id"]
                
                # Wait for completion (max 2 minutes per search)
                max_wait = 120
                waited = 0
                status = "RUNNING"
                
                while waited < max_wait:
                    await asyncio.sleep(5)
                    waited += 5
                    
                    status_response = await client.get(
                        f"https://api.apify.com/v2/actor-runs/{run_id}",
                        headers={"Authorization": f"Bearer {APIFY_TOKEN}"}
                    )
                    status_data = status_response.json()
                    status = status_data["data"]["status"]
                    
                    if status in ["SUCCEEDED", "FAILED", "ABORTED", "TIMED-OUT"]:
                        break
                
                if status != "SUCCEEDED":
                    await db.url_migration_jobs.update_one(
                        {"id": job_id, "contacts.id": contact_id},
                        {"$set": {"contacts.$.status": "failed", "contacts.$.error": f"Search failed: {status}"}}
                    )
                    failed += 1
                    processed += 1
                    continue
                
                # Get results
                dataset_id = status_data["data"]["defaultDatasetId"]
                results_response = await client.get(
                    f"https://api.apify.com/v2/datasets/{dataset_id}/items",
                    headers={"Authorization": f"Bearer {APIFY_TOKEN}"}
                )
                
                results = results_response.json()
                
                if not results:
                    await db.url_migration_jobs.update_one(
                        {"id": job_id, "contacts.id": contact_id},
                        {"$set": {"contacts.$.status": "skipped", "contacts.$.error": "No results found"}}
                    )
                    skipped += 1
                    processed += 1
                    continue
                
                # Find best match by company
                best_match = None
                for result in results:
                    # Get company from experience
                    current_company = ""
                    experience = result.get("experience") or []
                    if experience:
                        current_company = experience[0].get("companyName", "")
                    
                    if company_matches(company, current_company):
                        best_match = result
                        break
                
                if not best_match:
                    await db.url_migration_jobs.update_one(
                        {"id": job_id, "contacts.id": contact_id},
                        {"$set": {"contacts.$.status": "skipped", "contacts.$.error": "No company match"}}
                    )
                    skipped += 1
                    processed += 1
                    continue
                
                # Found match - update contact
                public_id = best_match.get("publicIdentifier")
                clean_url = best_match.get("linkedinUrl") or f"https://www.linkedin.com/in/{public_id}"
                
                await db.unified_contacts.update_one(
                    {"id": contact_id},
                    {"$set": {
                        "linkedin_url": clean_url,
                        "linkedin_public_id": public_id,
                        "linkedin_url_migrated_at": datetime.now(timezone.utc).isoformat()
                    }}
                )
                
                await db.url_migration_jobs.update_one(
                    {"id": job_id, "contacts.id": contact_id},
                    {"$set": {
                        "contacts.$.status": "migrated",
                        "contacts.$.new_url": clean_url
                    }}
                )
                migrated += 1
                
            except Exception as e:
                await db.url_migration_jobs.update_one(
                    {"id": job_id, "contacts.id": contact["id"]},
                    {"$set": {"contacts.$.status": "failed", "contacts.$.error": str(e)[:100]}}
                )
                failed += 1
            
            processed += 1
            
            # Update job progress
            await db.url_migration_jobs.update_one(
                {"id": job_id},
                {"$set": {
                    "processed": processed,
                    "migrated": migrated,
                    "failed": failed,
                    "skipped": skipped,
                    "updated_at": datetime.now(timezone.utc).isoformat()
                }}
            )
            
            # Rate limit - wait between searches
            await asyncio.sleep(3)
        
        # Mark job as completed
        await db.url_migration_jobs.update_one(
            {"id": job_id},
            {"$set": {
                "status": "completed",
                "processed": processed,
                "migrated": migrated,
                "failed": failed,
                "skipped": skipped,
                "completed_at": datetime.now(timezone.utc).isoformat()
            }}
        )


@router.get("/url-migration/job/{job_id}")
async def get_migration_job(
    job_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get details of a specific migration job"""
    job = await db.url_migration_jobs.find_one(
        {"id": job_id},
        {"_id": 0}
    )
    
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    
    return job


@router.post("/url-migration/cancel/{job_id}")
async def cancel_migration_job(
    job_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Cancel a running migration job"""
    result = await db.url_migration_jobs.update_one(
        {"id": job_id, "status": "in_progress"},
        {"$set": {
            "status": "cancelled",
            "cancelled_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Job not found or already completed")
    
    return {"message": "Job cancelled"}

