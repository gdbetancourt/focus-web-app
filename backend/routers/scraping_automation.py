"""
Scraping Automation Router - Automated search queues and Apify monitoring
Implements weekly quotas, duplicate avoidance, and credit alerts
"""
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone, timedelta
import uuid
import os
import httpx
import logging

from database import db
from routers.auth import get_current_user

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/scraping-automation", tags=["scraping-automation"])

# Apify configuration
APIFY_TOKEN = os.environ.get("APIFY_TOKEN", "")
APIFY_API_BASE = "https://api.apify.com/v2"

# Weekly quotas configuration
DEFAULT_QUOTAS = {
    "contacts_per_week": 500,  # New contacts from scraping
    "decision_makers_per_week": 200,  # Decision makers (1.1.1.2)
    "companies_per_week": 100,  # Companies (1.1.1.3)
    "phone_enrichment_per_week": 100,  # Phone numbers (1.1.2)
}


# ============ MODELS ============

class SearchQueueItem(BaseModel):
    search_type: str  # molecules, decision_makers, companies, phone_enrichment
    keyword: Optional[str] = None
    company: Optional[str] = None
    therapeutic_area: Optional[str] = None
    buyer_persona: Optional[str] = None
    priority: int = 5  # 1 = highest, 10 = lowest


class QuotaUpdate(BaseModel):
    contacts_per_week: Optional[int] = None
    decision_makers_per_week: Optional[int] = None
    companies_per_week: Optional[int] = None
    phone_enrichment_per_week: Optional[int] = None


# ============ APIFY STATUS ============

@router.get("/apify/status")
async def get_apify_status(current_user: dict = Depends(get_current_user)):
    """
    Get Apify account status including credits and connection health.
    Returns alerts if credits are low or connection issues detected.
    """
    if not APIFY_TOKEN:
        return {
            "connected": False,
            "error": "APIFY_TOKEN not configured",
            "alerts": [{"type": "error", "message": "Apify token not configured. Add APIFY_TOKEN to environment."}]
        }
    
    alerts = []
    
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            # Get user info including credits
            response = await client.get(
                f"{APIFY_API_BASE}/users/me",
                params={"token": APIFY_TOKEN}
            )
            
            if response.status_code != 200:
                return {
                    "connected": False,
                    "error": f"API error: {response.status_code}",
                    "alerts": [{"type": "error", "message": f"Apify API returned status {response.status_code}"}]
                }
            
            user_data = response.json().get("data", {})
            
            # Extract credit info
            plan = user_data.get("plan", {})
            usage = user_data.get("usage", {})
            
            # Check for monthly usage limits
            monthly_usage = usage.get("monthlyUsageUsd", 0)
            monthly_limit = plan.get("monthlyUsageLimitUsd", 0)
            
            # Calculate remaining
            remaining_usd = monthly_limit - monthly_usage if monthly_limit else None
            usage_percentage = (monthly_usage / monthly_limit * 100) if monthly_limit else 0
            
            # Generate alerts based on usage
            if remaining_usd is not None and remaining_usd < 5:
                alerts.append({
                    "type": "critical",
                    "message": f"Apify credits critically low: ${remaining_usd:.2f} remaining"
                })
            elif remaining_usd is not None and remaining_usd < 20:
                alerts.append({
                    "type": "warning", 
                    "message": f"Apify credits low: ${remaining_usd:.2f} remaining"
                })
            elif usage_percentage > 80:
                alerts.append({
                    "type": "warning",
                    "message": f"Apify usage at {usage_percentage:.0f}% of monthly limit"
                })
            
            # Get recent actor runs for health check
            runs_response = await client.get(
                f"{APIFY_API_BASE}/actor-runs",
                params={"token": APIFY_TOKEN, "limit": 5}
            )
            
            recent_runs = []
            failed_runs = 0
            
            if runs_response.status_code == 200:
                runs_data = runs_response.json().get("data", {}).get("items", [])
                for run in runs_data:
                    run_status = run.get("status")
                    if run_status in ["FAILED", "TIMED-OUT", "ABORTED"]:
                        failed_runs += 1
                    recent_runs.append({
                        "id": run.get("id"),
                        "actor": run.get("actorId"),
                        "status": run_status,
                        "started": run.get("startedAt"),
                        "finished": run.get("finishedAt")
                    })
            
            if failed_runs >= 3:
                alerts.append({
                    "type": "warning",
                    "message": f"{failed_runs} of last 5 runs failed - check actor configuration"
                })
            
            return {
                "connected": True,
                "username": user_data.get("username"),
                "email": user_data.get("email"),
                "plan": {
                    "name": plan.get("name", "Unknown"),
                    "monthly_limit_usd": monthly_limit,
                    "monthly_usage_usd": round(monthly_usage, 2),
                    "remaining_usd": round(remaining_usd, 2) if remaining_usd else None,
                    "usage_percentage": round(usage_percentage, 1)
                },
                "recent_runs": recent_runs,
                "alerts": alerts,
                "last_checked": datetime.now(timezone.utc).isoformat()
            }
            
    except httpx.TimeoutException:
        return {
            "connected": False,
            "error": "Connection timeout",
            "alerts": [{"type": "error", "message": "Apify connection timed out - check network"}]
        }
    except Exception as e:
        logger.error(f"Error checking Apify status: {e}")
        return {
            "connected": False,
            "error": str(e),
            "alerts": [{"type": "error", "message": f"Error connecting to Apify: {str(e)}"}]
        }


# ============ WEEKLY QUOTAS ============

@router.get("/quotas")
async def get_weekly_quotas(current_user: dict = Depends(get_current_user)):
    """Get current weekly quotas and usage"""
    
    # Get or create quota settings
    settings = await db.scraping_settings.find_one({"type": "quotas"}, {"_id": 0})
    if not settings:
        settings = {
            "type": "quotas",
            **DEFAULT_QUOTAS,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.scraping_settings.insert_one(settings)
    
    # Calculate current week's start (Monday)
    now = datetime.now(timezone.utc)
    week_start = now - timedelta(days=now.weekday())
    week_start = week_start.replace(hour=0, minute=0, second=0, microsecond=0)
    
    # Get usage for current week
    week_start_iso = week_start.isoformat()
    
    # Count new contacts added this week
    contacts_this_week = await db.unified_contacts.count_documents({
        "created_at": {"$gte": week_start_iso}
    })
    
    # Count phone enrichments this week
    phone_enrichments = await db.scraping_logs.count_documents({
        "type": "phone_enrichment",
        "created_at": {"$gte": week_start_iso}
    })
    
    # Count decision maker searches this week
    dm_searches = await db.scraping_logs.count_documents({
        "type": "decision_makers",
        "created_at": {"$gte": week_start_iso}
    })
    
    # Count company searches this week
    company_searches = await db.scraping_logs.count_documents({
        "type": "companies",
        "created_at": {"$gte": week_start_iso}
    })
    
    return {
        "quotas": {
            "contacts_per_week": settings.get("contacts_per_week", DEFAULT_QUOTAS["contacts_per_week"]),
            "decision_makers_per_week": settings.get("decision_makers_per_week", DEFAULT_QUOTAS["decision_makers_per_week"]),
            "companies_per_week": settings.get("companies_per_week", DEFAULT_QUOTAS["companies_per_week"]),
            "phone_enrichment_per_week": settings.get("phone_enrichment_per_week", DEFAULT_QUOTAS["phone_enrichment_per_week"]),
        },
        "usage": {
            "contacts_this_week": contacts_this_week,
            "decision_makers_this_week": dm_searches,
            "companies_this_week": company_searches,
            "phone_enrichments_this_week": phone_enrichments
        },
        "week_start": week_start_iso,
        "week_end": (week_start + timedelta(days=7)).isoformat()
    }


@router.put("/quotas")
async def update_weekly_quotas(
    data: QuotaUpdate,
    current_user: dict = Depends(get_current_user)
):
    """Update weekly quota settings"""
    update_data = {k: v for k, v in data.dict().items() if v is not None}
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    await db.scraping_settings.update_one(
        {"type": "quotas"},
        {"$set": update_data},
        upsert=True
    )
    
    return {"success": True, "updated": update_data}


# ============ SEARCH QUEUE ============

@router.get("/queue")
async def get_search_queue(current_user: dict = Depends(get_current_user)):
    """Get pending searches in the queue"""
    queue = await db.search_queue.find(
        {"status": "pending"},
        {"_id": 0}
    ).sort([("priority", 1), ("created_at", 1)]).to_list(100)
    
    return {"queue": queue, "count": len(queue)}


@router.post("/queue")
async def add_to_search_queue(
    item: SearchQueueItem,
    current_user: dict = Depends(get_current_user)
):
    """Add a search to the queue"""
    now = datetime.now(timezone.utc).isoformat()
    
    queue_item = {
        "id": str(uuid.uuid4()),
        "search_type": item.search_type,
        "keyword": item.keyword,
        "company": item.company,
        "therapeutic_area": item.therapeutic_area,
        "buyer_persona": item.buyer_persona,
        "priority": item.priority,
        "status": "pending",
        "created_at": now,
        "created_by": current_user.get("email")
    }
    
    await db.search_queue.insert_one(queue_item)
    
    return {"success": True, "item": {k: v for k, v in queue_item.items() if k != "_id"}}


@router.delete("/queue/{item_id}")
async def remove_from_queue(
    item_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Remove an item from the queue"""
    result = await db.search_queue.delete_one({"id": item_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Item not found")
    return {"success": True}


# ============ KEYWORD TRACKING (Avoid Repetition) ============

@router.get("/keyword-history")
async def get_keyword_search_history(
    search_type: Optional[str] = None,
    days: int = 30,
    current_user: dict = Depends(get_current_user)
):
    """Get recent keyword search history to avoid repetition"""
    cutoff = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()
    
    query = {"searched_at": {"$gte": cutoff}}
    if search_type:
        query["search_type"] = search_type
    
    history = await db.keyword_search_history.find(
        query,
        {"_id": 0}
    ).sort("searched_at", -1).to_list(200)
    
    return {"history": history, "count": len(history)}


@router.get("/keyword-status/{keyword}")
async def get_keyword_status(
    keyword: str,
    current_user: dict = Depends(get_current_user)
):
    """Check when a specific keyword was last searched"""
    record = await db.keyword_search_history.find_one(
        {"keyword": keyword.lower()},
        {"_id": 0}
    )
    
    if not record:
        return {
            "keyword": keyword,
            "searched": False,
            "recommendation": "Safe to search - never searched before"
        }
    
    last_searched = record.get("searched_at")
    days_ago = (datetime.now(timezone.utc) - datetime.fromisoformat(last_searched.replace("Z", "+00:00"))).days
    
    return {
        "keyword": keyword,
        "searched": True,
        "last_searched": last_searched,
        "days_ago": days_ago,
        "results_count": record.get("results_count", 0),
        "recommendation": "Safe to search again" if days_ago >= 7 else f"Wait {7 - days_ago} more days"
    }


async def record_keyword_search(keyword: str, search_type: str, results_count: int):
    """Record a keyword search to avoid repetition"""
    now = datetime.now(timezone.utc).isoformat()
    
    await db.keyword_search_history.update_one(
        {"keyword": keyword.lower()},
        {
            "$set": {
                "keyword": keyword.lower(),
                "search_type": search_type,
                "searched_at": now,
                "results_count": results_count
            },
            "$inc": {"search_count": 1}
        },
        upsert=True
    )


# ============ PHONE ENRICHMENT ============

@router.get("/phone-enrichment/pending")
async def get_pending_phone_enrichment(
    limit: int = 100,
    current_user: dict = Depends(get_current_user)
):
    """Get contacts that need phone enrichment"""
    # Find contacts without phone numbers
    contacts = await db.unified_contacts.find(
        {
            "$or": [
                {"phone": {"$exists": False}},
                {"phone": None},
                {"phone": ""}
            ],
            "email": {"$exists": True, "$ne": None, "$ne": ""}
        },
        {"_id": 0, "id": 1, "name": 1, "email": 1, "company": 1, "linkedin_url": 1}
    ).limit(limit).to_list(limit)
    
    return {
        "contacts": contacts,
        "count": len(contacts),
        "description": "Contacts without phone numbers that could be enriched"
    }


@router.post("/phone-enrichment/enrich")
async def enrich_contact_phone(
    contact_id: str,
    phone: str,
    current_user: dict = Depends(get_current_user)
):
    """Manually add phone number to a contact"""
    # Normalize phone
    phone_cleaned = ''.join(filter(str.isdigit, phone))
    if phone_cleaned.startswith('52') and len(phone_cleaned) >= 10:
        phone_formatted = f"+{phone_cleaned}"
    elif len(phone_cleaned) == 10:
        phone_formatted = f"+52{phone_cleaned}"
    else:
        phone_formatted = phone
    
    result = await db.unified_contacts.update_one(
        {"id": contact_id},
        {
            "$set": {
                "phone": phone_formatted,
                "phone_enriched_at": datetime.now(timezone.utc).isoformat(),
                "phone_enriched_by": current_user.get("email")
            }
        }
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Contact not found")
    
    # Log enrichment
    await db.scraping_logs.insert_one({
        "type": "phone_enrichment",
        "contact_id": contact_id,
        "phone": phone_formatted,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "created_by": current_user.get("email")
    })
    
    return {"success": True, "phone": phone_formatted}


@router.get("/phone-enrichment/stats")
async def get_phone_enrichment_stats(current_user: dict = Depends(get_current_user)):
    """Get phone enrichment statistics"""
    
    # Total contacts
    total = await db.unified_contacts.count_documents({})
    
    # Contacts with phone
    with_phone = await db.unified_contacts.count_documents({
        "phone": {"$exists": True, "$ne": None, "$ne": ""}
    })
    
    # Contacts without phone
    without_phone = total - with_phone
    
    # This week enrichments
    week_start = datetime.now(timezone.utc) - timedelta(days=7)
    enriched_this_week = await db.scraping_logs.count_documents({
        "type": "phone_enrichment",
        "created_at": {"$gte": week_start.isoformat()}
    })
    
    return {
        "total_contacts": total,
        "with_phone": with_phone,
        "without_phone": without_phone,
        "coverage_percentage": round(with_phone / total * 100, 1) if total > 0 else 0,
        "enriched_this_week": enriched_this_week,
        "weekly_goal": DEFAULT_QUOTAS["phone_enrichment_per_week"],
        "goal_progress": round(enriched_this_week / DEFAULT_QUOTAS["phone_enrichment_per_week"] * 100, 1)
    }


# ============ AUTOMATION STATUS ============

@router.get("/status")
async def get_automation_status(current_user: dict = Depends(get_current_user)):
    """Get overall automation status"""
    
    # Get active schedules
    active_schedules = await db.search_schedules.count_documents({"active": True})
    
    # Get queue size
    queue_size = await db.search_queue.count_documents({"status": "pending"})
    
    # Get recent logs
    recent_logs = await db.scraping_logs.find(
        {},
        {"_id": 0}
    ).sort("created_at", -1).limit(10).to_list(10)
    
    # Get Apify status (simplified)
    apify_connected = bool(APIFY_TOKEN)
    
    return {
        "active_schedules": active_schedules,
        "queue_size": queue_size,
        "apify_connected": apify_connected,
        "recent_activity": recent_logs,
        "last_updated": datetime.now(timezone.utc).isoformat()
    }


# ============ ALERTS SYSTEM ============

class AlertCreate(BaseModel):
    type: str  # critical, warning, info
    category: str  # apify, quota, search, phone, system
    title: str
    message: str


@router.get("/alerts")
async def get_alerts(
    unread_only: bool = False,
    limit: int = 50,
    current_user: dict = Depends(get_current_user)
):
    """Get automation alerts"""
    query = {}
    if unread_only:
        query["read"] = False
    
    alerts = await db.automation_alerts.find(
        query, {"_id": 0}
    ).sort("created_at", -1).limit(limit).to_list(limit)
    
    unread_count = await db.automation_alerts.count_documents({"read": False})
    
    return {
        "alerts": alerts,
        "unread_count": unread_count
    }


@router.post("/alerts")
async def create_alert(
    data: AlertCreate,
    current_user: dict = Depends(get_current_user)
):
    """Create a new alert (typically called by automation processes)"""
    now = datetime.now(timezone.utc).isoformat()
    
    alert = {
        "id": str(uuid.uuid4()),
        "type": data.type,
        "category": data.category,
        "title": data.title,
        "message": data.message,
        "read": False,
        "created_at": now
    }
    
    await db.automation_alerts.insert_one(alert)
    
    return {"success": True, "alert": {k: v for k, v in alert.items() if k != "_id"}}


@router.put("/alerts/{alert_id}/read")
async def mark_alert_read(
    alert_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Mark an alert as read"""
    result = await db.automation_alerts.update_one(
        {"id": alert_id},
        {"$set": {"read": True, "read_at": datetime.now(timezone.utc).isoformat()}}
    )
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Alert not found")
    return {"success": True}


@router.put("/alerts/mark-all-read")
async def mark_all_alerts_read(current_user: dict = Depends(get_current_user)):
    """Mark all alerts as read"""
    now = datetime.now(timezone.utc).isoformat()
    result = await db.automation_alerts.update_many(
        {"read": False},
        {"$set": {"read": True, "read_at": now}}
    )
    return {"success": True, "marked_count": result.modified_count}


@router.delete("/alerts/{alert_id}")
async def delete_alert(
    alert_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Delete an alert"""
    result = await db.automation_alerts.delete_one({"id": alert_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Alert not found")
    return {"success": True}


@router.delete("/alerts/clear-old")
async def clear_old_alerts(
    days: int = 30,
    current_user: dict = Depends(get_current_user)
):
    """Clear alerts older than N days"""
    cutoff = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()
    result = await db.automation_alerts.delete_many({
        "created_at": {"$lt": cutoff},
        "read": True
    })
    return {"success": True, "deleted_count": result.deleted_count}


# Helper function to check and create alerts (can be called by scheduled jobs)
async def check_and_create_apify_alerts():
    """Check Apify status and create alerts if needed"""
    if not APIFY_TOKEN:
        return
    
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            response = await client.get(
                f"{APIFY_API_BASE}/users/me",
                params={"token": APIFY_TOKEN}
            )
            
            if response.status_code != 200:
                # Create connection error alert
                await db.automation_alerts.insert_one({
                    "id": str(uuid.uuid4()),
                    "type": "critical",
                    "category": "apify",
                    "title": "Apify Connection Error",
                    "message": f"Failed to connect to Apify API. Status code: {response.status_code}",
                    "read": False,
                    "created_at": datetime.now(timezone.utc).isoformat()
                })
                return
            
            user_data = response.json().get("data", {})
            plan = user_data.get("plan", {})
            usage = user_data.get("usage", {})
            
            monthly_usage = usage.get("monthlyUsageUsd", 0)
            monthly_limit = plan.get("monthlyUsageLimitUsd", 0)
            remaining_usd = monthly_limit - monthly_usage if monthly_limit else None
            
            # Check for existing recent alert to avoid duplicates
            one_hour_ago = (datetime.now(timezone.utc) - timedelta(hours=1)).isoformat()
            recent_alert = await db.automation_alerts.find_one({
                "category": "apify",
                "created_at": {"$gte": one_hour_ago}
            })
            
            if recent_alert:
                return  # Don't create duplicate alert within an hour
            
            # Create alerts based on credit levels
            if remaining_usd is not None and remaining_usd <= 0:
                # EXHAUSTED - Most critical
                await db.automation_alerts.insert_one({
                    "id": str(uuid.uuid4()),
                    "type": "critical",
                    "category": "apify",
                    "title": "⚠️ Créditos Apify Agotados",
                    "message": "Los créditos de Apify se han agotado. El scraping de DMs y contactos se ha detenido. Agrega créditos para continuar.",
                    "read": False,
                    "created_at": datetime.now(timezone.utc).isoformat()
                })
            elif remaining_usd is not None and remaining_usd < 5:
                await db.automation_alerts.insert_one({
                    "id": str(uuid.uuid4()),
                    "type": "critical",
                    "category": "apify",
                    "title": "Créditos Apify Críticos",
                    "message": f"Los créditos de Apify están críticamente bajos: ${remaining_usd:.2f} restantes. El scraping puede detenerse pronto.",
                    "read": False,
                    "created_at": datetime.now(timezone.utc).isoformat()
                })
            elif remaining_usd is not None and remaining_usd < 20:
                await db.automation_alerts.insert_one({
                    "id": str(uuid.uuid4()),
                    "type": "warning",
                    "category": "apify",
                    "title": "Créditos Apify Bajos",
                    "message": f"Los créditos de Apify están bajos: ${remaining_usd:.2f} restantes. Considera agregar más créditos.",
                    "read": False,
                    "created_at": datetime.now(timezone.utc).isoformat()
                })
    except Exception as e:
        logger.error(f"Error checking Apify status for alerts: {e}")
