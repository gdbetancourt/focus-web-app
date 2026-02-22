"""
Newsletter Router - Manage newsletters and subscriber lists
"""
from fastapi import APIRouter, HTTPException, Depends, BackgroundTasks
from pydantic import BaseModel, EmailStr
from typing import List, Optional
from datetime import datetime, timezone
import uuid

from database import db
from routers.auth import get_current_user
from services.email_service import email_service

router = APIRouter(prefix="/newsletters", tags=["newsletters"])


# ============ MODELS ============

class NewsletterCreate(BaseModel):
    name: str
    subject: str
    content_html: str
    thematic_area: Optional[str] = None  # Linked to enfoque/thematic axis
    scheduled_at: Optional[str] = None  # ISO datetime for scheduled send


class NewsletterUpdate(BaseModel):
    name: Optional[str] = None
    subject: Optional[str] = None
    content_html: Optional[str] = None
    thematic_area: Optional[str] = None
    scheduled_at: Optional[str] = None
    status: Optional[str] = None


class SubscriberCreate(BaseModel):
    email: EmailStr
    name: Optional[str] = None
    nombre: Optional[str] = None  # First name for Spanish form
    apellido: Optional[str] = None  # Last name for Spanish form
    phone: str  # Required field - must be at least 10 digits
    thematic_areas: Optional[List[str]] = None  # Subscribe to specific areas


class SendNewsletterRequest(BaseModel):
    thematic_area: Optional[str] = None  # Filter subscribers by area
    test_email: Optional[str] = None  # Send test to specific email


# ============ THEMATIC AREAS ============

THEMATIC_AREAS = [
    {"id": "ventas", "name": "Ventas y Negociación", "color": "#ff3300"},
    {"id": "liderazgo", "name": "Liderazgo y Equipos", "color": "#3b82f6"},
    {"id": "comunicacion", "name": "Comunicación Efectiva", "color": "#10b981"},
    {"id": "productividad", "name": "Productividad Personal", "color": "#f59e0b"},
    {"id": "innovacion", "name": "Innovación y Creatividad", "color": "#8b5cf6"},
]


# ============ NEWSLETTER ENDPOINTS ============

@router.get("/")
async def list_newsletters(
    status: Optional[str] = None,
    thematic_area: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """List all newsletters with optional filters"""
    query = {}
    if status:
        query["status"] = status
    if thematic_area:
        query["thematic_area"] = thematic_area
    
    newsletters = await db.newsletters.find(query, {"_id": 0}).sort("created_at", -1).to_list(100)
    
    return {
        "success": True,
        "newsletters": newsletters,
        "total": len(newsletters)
    }


@router.get("/campaigns")
async def list_campaigns(current_user: dict = Depends(get_current_user)):
    """List newsletter campaigns (sent and scheduled only) for Mensajes de Hoy"""
    # Get newsletters that are sent or scheduled (exclude drafts for cleaner view)
    campaigns = await db.newsletters.find(
        {"status": {"$in": ["sent", "scheduled"]}},
        {"_id": 0}
    ).sort("created_at", -1).to_list(50)
    
    return {
        "success": True,
        "campaigns": campaigns,
        "total": len(campaigns)
    }


class AutoNewsletterConfig(BaseModel):
    thematic_axis_id: str
    frequency: str = "weekly"  # weekly, biweekly, monthly
    day_of_week: int = 1  # 0=Monday, 6=Sunday
    hour: int = 9  # Hour in 24h format
    enabled: bool = True


@router.post("/auto-config")
async def configure_auto_newsletter(
    config: AutoNewsletterConfig,
    current_user: dict = Depends(get_current_user)
):
    """Configure automatic newsletter generation for a thematic axis"""
    # Get the thematic axis
    axis = await db.thematic_axes.find_one({"id": config.thematic_axis_id})
    if not axis:
        raise HTTPException(status_code=404, detail="Thematic axis not found")
    
    auto_config = {
        "id": str(uuid.uuid4()),
        "thematic_axis_id": config.thematic_axis_id,
        "thematic_axis_name": axis.get("name"),
        "frequency": config.frequency,
        "day_of_week": config.day_of_week,
        "hour": config.hour,
        "enabled": config.enabled,
        "last_sent": None,
        "created_by": current_user.get("email"),
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    # Upsert - update if exists for this axis
    await db.newsletter_auto_configs.update_one(
        {"thematic_axis_id": config.thematic_axis_id},
        {"$set": auto_config},
        upsert=True
    )
    
    return {"success": True, "config": auto_config}


@router.get("/auto-config")
async def get_auto_newsletter_configs(
    current_user: dict = Depends(get_current_user)
):
    """Get all automatic newsletter configurations"""
    configs = await db.newsletter_auto_configs.find({}, {"_id": 0}).to_list(100)
    return {"success": True, "configs": configs}


@router.delete("/auto-config/{config_id}")
async def delete_auto_newsletter_config(
    config_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Delete an automatic newsletter configuration"""
    result = await db.newsletter_auto_configs.delete_one({"id": config_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Config not found")
    return {"success": True}


@router.post("/")
async def create_newsletter(
    data: NewsletterCreate,
    current_user: dict = Depends(get_current_user)
):
    """Create a new newsletter draft"""
    now = datetime.now(timezone.utc).isoformat()
    
    newsletter = {
        "id": str(uuid.uuid4()),
        "name": data.name,
        "subject": data.subject,
        "content_html": data.content_html,
        "thematic_area": data.thematic_area,
        "scheduled_at": data.scheduled_at,
        "status": "draft",  # draft, scheduled, sent
        "sent_count": 0,
        "open_count": 0,
        "click_count": 0,
        "created_by": current_user.get("email"),
        "created_at": now,
        "updated_at": now
    }
    
    await db.newsletters.insert_one(newsletter)
    
    return {"success": True, "newsletter": {k: v for k, v in newsletter.items() if k != "_id"}}


@router.get("/{newsletter_id}")
async def get_newsletter(
    newsletter_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get newsletter details"""
    newsletter = await db.newsletters.find_one({"id": newsletter_id}, {"_id": 0})
    if not newsletter:
        raise HTTPException(status_code=404, detail="Newsletter not found")
    return newsletter


@router.put("/{newsletter_id}")
async def update_newsletter(
    newsletter_id: str,
    data: NewsletterUpdate,
    current_user: dict = Depends(get_current_user)
):
    """Update newsletter"""
    update_data = {k: v for k, v in data.dict().items() if v is not None}
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    result = await db.newsletters.update_one(
        {"id": newsletter_id},
        {"$set": update_data}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Newsletter not found")
    
    return {"success": True}


@router.delete("/{newsletter_id}")
async def delete_newsletter(
    newsletter_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Delete a newsletter"""
    result = await db.newsletters.delete_one({"id": newsletter_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Newsletter not found")
    return {"success": True}


@router.post("/{newsletter_id}/schedule")
async def schedule_newsletter(
    newsletter_id: str,
    scheduled_at: str,
    current_user: dict = Depends(get_current_user)
):
    """Schedule a newsletter for automatic sending"""
    newsletter = await db.newsletters.find_one({"id": newsletter_id}, {"_id": 0})
    if not newsletter:
        raise HTTPException(status_code=404, detail="Newsletter not found")
    
    # Validate date format
    try:
        datetime.fromisoformat(scheduled_at.replace('Z', '+00:00'))
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format. Use ISO format.")
    
    await db.newsletters.update_one(
        {"id": newsletter_id},
        {"$set": {
            "scheduled_at": scheduled_at,
            "status": "scheduled",
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    return {
        "success": True, 
        "message": f"Newsletter scheduled for {scheduled_at}",
        "status": "scheduled"
    }


@router.post("/{newsletter_id}/send")
async def send_newsletter(
    newsletter_id: str,
    request: SendNewsletterRequest,
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(get_current_user)
):
    """Send newsletter to subscribers"""
    newsletter = await db.newsletters.find_one({"id": newsletter_id}, {"_id": 0})
    if not newsletter:
        raise HTTPException(status_code=404, detail="Newsletter not found")
    
    # If test email specified, send only to that email
    if request.test_email:
        result = await email_service.send_email(
            to_email=request.test_email,
            subject=f"[TEST] {newsletter['subject']}",
            html_content=newsletter["content_html"]
        )
        return {"success": result.get("success"), "test": True, "email": request.test_email}
    
    # Get subscribers
    query = {"unsubscribed": {"$ne": True}}
    if request.thematic_area:
        query["thematic_areas"] = request.thematic_area
    elif newsletter.get("thematic_area"):
        query["thematic_areas"] = newsletter["thematic_area"]
    
    subscribers = await db.newsletter_subscribers.find(query, {"_id": 0}).to_list(10000)
    
    if not subscribers:
        raise HTTPException(status_code=400, detail="No subscribers found for this newsletter")
    
    recipient_emails = [s["email"] for s in subscribers]
    
    # Send in background
    async def send_batch():
        result = await email_service.send_newsletter(
            recipients=recipient_emails,
            subject=newsletter["subject"],
            html_content=newsletter["content_html"],
            newsletter_name=newsletter["name"]
        )
        # Update newsletter stats
        await db.newsletters.update_one(
            {"id": newsletter_id},
            {"$set": {
                "status": "sent",
                "sent_count": result["sent"],
                "sent_at": datetime.now(timezone.utc).isoformat()
            }}
        )
    
    background_tasks.add_task(send_batch)
    
    # Update status to sending
    await db.newsletters.update_one(
        {"id": newsletter_id},
        {"$set": {"status": "sending"}}
    )
    
    return {
        "success": True,
        "message": f"Sending to {len(recipient_emails)} subscribers",
        "recipient_count": len(recipient_emails)
    }


# ============ SUBSCRIBER ENDPOINTS ============

@router.get("/subscribers/list")
async def list_subscribers(
    thematic_area: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """List all subscribers"""
    query = {"unsubscribed": {"$ne": True}}
    if thematic_area:
        query["thematic_areas"] = thematic_area
    
    subscribers = await db.newsletter_subscribers.find(query, {"_id": 0}).sort("subscribed_at", -1).to_list(1000)
    
    return {
        "success": True,
        "subscribers": subscribers,
        "total": len(subscribers)
    }


@router.post("/public/subscribe", tags=["public"])
async def public_subscribe(data: SubscriberCreate):
    """
    Public endpoint for newsletter subscription.
    No authentication required - for use on public website.
    """
    # Check if already subscribed
    existing = await db.newsletter_subscribers.find_one({"email": data.email})
    if existing:
        if existing.get("unsubscribed"):
            # Re-subscribe
            await db.newsletter_subscribers.update_one(
                {"email": data.email},
                {"$set": {
                    "unsubscribed": False,
                    "thematic_areas": data.thematic_areas or [],
                    "resubscribed_at": datetime.now(timezone.utc).isoformat()
                }}
            )
            return {"success": True, "message": "¡Te has re-suscrito exitosamente!"}
        return {"success": True, "message": "Ya estás suscrito a nuestro newsletter"}
    
    # Build full name from nombre and apellido if provided
    full_name = data.name
    if data.nombre or data.apellido:
        full_name = f"{data.nombre or ''} {data.apellido or ''}".strip()
    
    subscriber = {
        "id": str(uuid.uuid4()),
        "email": data.email,
        "name": full_name,
        "nombre": data.nombre,
        "apellido": data.apellido,
        "phone": data.phone,
        "thematic_areas": data.thematic_areas or [],
        "unsubscribed": False,
        "source": "public_website",
        "subscribed_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.newsletter_subscribers.insert_one(subscriber)
    
    return {"success": True, "message": "¡Gracias por suscribirte!"}


@router.get("/subscribers")
async def get_subscribers_count():
    """Get subscriber count (public endpoint for stats)"""
    count = await db.newsletter_subscribers.count_documents({"unsubscribed": {"$ne": True}})
    return {"count": count}


@router.post("/subscribers")
async def add_subscriber(
    data: SubscriberCreate,
    current_user: dict = Depends(get_current_user)
):
    """Add a new subscriber"""
    # Check if already subscribed
    existing = await db.newsletter_subscribers.find_one({"email": data.email})
    if existing:
        if existing.get("unsubscribed"):
            # Re-subscribe
            await db.newsletter_subscribers.update_one(
                {"email": data.email},
                {"$set": {
                    "unsubscribed": False,
                    "thematic_areas": data.thematic_areas or [],
                    "resubscribed_at": datetime.now(timezone.utc).isoformat()
                }}
            )
            return {"success": True, "message": "Re-subscribed successfully"}
        return {"success": False, "message": "Already subscribed"}
    
    subscriber = {
        "id": str(uuid.uuid4()),
        "email": data.email,
        "name": data.name,
        "thematic_areas": data.thematic_areas or [],
        "unsubscribed": False,
        "subscribed_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.newsletter_subscribers.insert_one(subscriber)
    
    return {"success": True, "subscriber": {k: v for k, v in subscriber.items() if k != "_id"}}


@router.delete("/subscribers/{subscriber_id}")
async def remove_subscriber(
    subscriber_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Unsubscribe a user"""
    result = await db.newsletter_subscribers.update_one(
        {"id": subscriber_id},
        {"$set": {
            "unsubscribed": True,
            "unsubscribed_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Subscriber not found")
    return {"success": True}


# ============ OPTIONS ENDPOINTS ============

@router.get("/options/thematic-areas")
async def get_thematic_areas():
    """Get available thematic areas for newsletters"""
    return {"thematic_areas": THEMATIC_AREAS}


@router.get("/stats/overview")
async def get_newsletter_stats(current_user: dict = Depends(get_current_user)):
    """Get newsletter statistics overview"""
    total_newsletters = await db.newsletters.count_documents({})
    sent_newsletters = await db.newsletters.count_documents({"status": "sent"})
    draft_newsletters = await db.newsletters.count_documents({"status": "draft"})
    total_subscribers = await db.newsletter_subscribers.count_documents({"unsubscribed": {"$ne": True}})
    
    # Get total sent emails
    pipeline = [
        {"$match": {"status": "sent"}},
        {"$group": {"_id": None, "total_sent": {"$sum": "$sent_count"}}}
    ]
    sent_agg = await db.newsletters.aggregate(pipeline).to_list(1)
    total_sent = sent_agg[0]["total_sent"] if sent_agg else 0
    
    # Get total opens and clicks
    total_opens = await db.email_events.count_documents({"event_type": "open"})
    total_clicks = await db.email_events.count_documents({"event_type": "click"})
    unique_opens = len(await db.email_events.distinct("email", {"event_type": "open"}))
    
    # Calculate rates
    open_rate = round((unique_opens / total_sent * 100), 1) if total_sent > 0 else 0
    click_rate = round((total_clicks / total_sent * 100), 1) if total_sent > 0 else 0
    
    return {
        "total_newsletters": total_newsletters,
        "sent_newsletters": sent_newsletters,
        "draft_newsletters": draft_newsletters,
        "total_subscribers": total_subscribers,
        "total_emails_sent": total_sent,
        "total_opens": total_opens,
        "unique_opens": unique_opens,
        "total_clicks": total_clicks,
        "open_rate": open_rate,
        "click_rate": click_rate
    }


@router.get("/analytics/summary")
async def get_analytics_summary(current_user: dict = Depends(get_current_user)):
    """Get email analytics summary for dashboard"""
    # Get total sent emails from newsletters
    pipeline = [
        {"$match": {"status": "sent"}},
        {"$group": {"_id": None, "total_sent": {"$sum": {"$ifNull": ["$sent_count", 0]}}}}
    ]
    sent_agg = await db.newsletters.aggregate(pipeline).to_list(1)
    total_sent = sent_agg[0]["total_sent"] if sent_agg else 0
    
    # Get open and click events
    total_opened = await db.email_events.count_documents({"event_type": "open"})
    total_clicked = await db.email_events.count_documents({"event_type": "click"})
    
    # Calculate rates
    open_rate = round((total_opened / total_sent * 100), 1) if total_sent > 0 else 0
    click_rate = round((total_clicked / total_sent * 100), 1) if total_sent > 0 else 0
    
    return {
        "total_sent": total_sent,
        "total_opened": total_opened,
        "total_clicked": total_clicked,
        "open_rate": open_rate,
        "click_rate": click_rate
    }


# ============ EMAIL TRACKING ENDPOINTS ============

@router.get("/track/open/{newsletter_id}/{email_hash}")
async def track_email_open(newsletter_id: str, email_hash: str):
    """Track email open via tracking pixel - returns 1x1 transparent GIF"""
    from fastapi.responses import Response
    import base64
    
    # Record the open event
    await db.email_events.insert_one({
        "id": str(uuid.uuid4()),
        "newsletter_id": newsletter_id,
        "email_hash": email_hash,
        "event_type": "open",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "user_agent": None  # Could capture from request headers
    })
    
    # Update newsletter open count
    await db.newsletters.update_one(
        {"id": newsletter_id},
        {"$inc": {"open_count": 1}}
    )
    
    # Return 1x1 transparent GIF
    gif_bytes = base64.b64decode("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7")
    return Response(content=gif_bytes, media_type="image/gif")


@router.get("/track/click/{newsletter_id}/{link_id}")
async def track_email_click(newsletter_id: str, link_id: str, url: str = "", email: str = ""):
    """Track email link click and redirect"""
    from fastapi.responses import RedirectResponse
    
    # Record the click event
    await db.email_events.insert_one({
        "id": str(uuid.uuid4()),
        "newsletter_id": newsletter_id,
        "link_id": link_id,
        "email": email,
        "event_type": "click",
        "url": url,
        "timestamp": datetime.now(timezone.utc).isoformat()
    })
    
    # Update newsletter click count
    await db.newsletters.update_one(
        {"id": newsletter_id},
        {"$inc": {"click_count": 1}}
    )
    
    # Redirect to actual URL
    if url:
        return RedirectResponse(url=url)
    return {"success": True}


@router.get("/stats/newsletter/{newsletter_id}")
async def get_newsletter_detailed_stats(
    newsletter_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get detailed stats for a specific newsletter"""
    newsletter = await db.newsletters.find_one({"id": newsletter_id}, {"_id": 0})
    if not newsletter:
        raise HTTPException(status_code=404, detail="Newsletter not found")
    
    # Get events for this newsletter
    opens = await db.email_events.count_documents({"newsletter_id": newsletter_id, "event_type": "open"})
    clicks = await db.email_events.count_documents({"newsletter_id": newsletter_id, "event_type": "click"})
    unique_opens = len(await db.email_events.distinct("email_hash", {"newsletter_id": newsletter_id, "event_type": "open"}))
    
    sent_count = newsletter.get("sent_count", 0)
    
    # Get click breakdown by URL
    click_pipeline = [
        {"$match": {"newsletter_id": newsletter_id, "event_type": "click"}},
        {"$group": {"_id": "$url", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}},
        {"$limit": 10}
    ]
    top_links = await db.email_events.aggregate(click_pipeline).to_list(10)
    
    # Get opens over time (last 7 days)
    opens_timeline = []
    for i in range(7):
        day = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
        day = day.replace(day=day.day - i)
        day_str = day.strftime("%Y-%m-%d")
        count = await db.email_events.count_documents({
            "newsletter_id": newsletter_id,
            "event_type": "open",
            "timestamp": {"$regex": f"^{day_str}"}
        })
        opens_timeline.append({"date": day_str, "opens": count})
    
    return {
        "newsletter": newsletter,
        "stats": {
            "sent": sent_count,
            "total_opens": opens,
            "unique_opens": unique_opens,
            "total_clicks": clicks,
            "open_rate": round((unique_opens / sent_count * 100), 1) if sent_count > 0 else 0,
            "click_rate": round((clicks / sent_count * 100), 1) if sent_count > 0 else 0
        },
        "top_links": [{"url": l["_id"], "clicks": l["count"]} for l in top_links],
        "opens_timeline": list(reversed(opens_timeline))
    }


@router.get("/stats/dashboard")
async def get_email_dashboard(
    days: int = 30,
    current_user: dict = Depends(get_current_user)
):
    """Get comprehensive email marketing dashboard data"""
    from datetime import timedelta
    
    start_date = datetime.now(timezone.utc) - timedelta(days=days)
    start_str = start_date.isoformat()
    
    # Get recent newsletters
    recent_newsletters = await db.newsletters.find(
        {"status": "sent"},
        {"_id": 0}
    ).sort("sent_at", -1).limit(10).to_list(10)
    
    # Calculate totals
    total_sent = sum(n.get("sent_count", 0) for n in recent_newsletters)
    total_opens = sum(n.get("open_count", 0) for n in recent_newsletters)
    total_clicks = sum(n.get("click_count", 0) for n in recent_newsletters)
    
    # Get subscriber growth
    new_subscribers = await db.newsletter_subscribers.count_documents({
        "subscribed_at": {"$gte": start_str}
    })
    unsubscribes = await db.newsletter_subscribers.count_documents({
        "unsubscribed_at": {"$gte": start_str}
    })
    
    # Get performance by thematic area
    area_stats = {}
    for newsletter in recent_newsletters:
        area = newsletter.get("thematic_area", "general")
        if area not in area_stats:
            area_stats[area] = {"sent": 0, "opens": 0, "clicks": 0}
        area_stats[area]["sent"] += newsletter.get("sent_count", 0)
        area_stats[area]["opens"] += newsletter.get("open_count", 0)
        area_stats[area]["clicks"] += newsletter.get("click_count", 0)
    
    # Daily send volume for chart
    daily_volume = []
    for i in range(min(days, 14)):
        day = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
        day = day - timedelta(days=i)
        day_str = day.strftime("%Y-%m-%d")
        
        # Count events on this day
        opens = await db.email_events.count_documents({
            "event_type": "open",
            "timestamp": {"$regex": f"^{day_str}"}
        })
        clicks = await db.email_events.count_documents({
            "event_type": "click", 
            "timestamp": {"$regex": f"^{day_str}"}
        })
        
        daily_volume.append({
            "date": day_str,
            "opens": opens,
            "clicks": clicks
        })
    
    return {
        "summary": {
            "total_sent": total_sent,
            "total_opens": total_opens,
            "total_clicks": total_clicks,
            "open_rate": round((total_opens / total_sent * 100), 1) if total_sent > 0 else 0,
            "click_rate": round((total_clicks / total_sent * 100), 1) if total_sent > 0 else 0,
            "new_subscribers": new_subscribers,
            "unsubscribes": unsubscribes
        },
        "recent_newsletters": [
            {
                "id": n.get("id"),
                "name": n.get("name"),
                "subject": n.get("subject"),
                "sent_at": n.get("sent_at"),
                "sent_count": n.get("sent_count", 0),
                "open_count": n.get("open_count", 0),
                "click_count": n.get("click_count", 0),
                "open_rate": round((n.get("open_count", 0) / n.get("sent_count", 1) * 100), 1) if n.get("sent_count", 0) > 0 else 0
            }
            for n in recent_newsletters
        ],
        "by_thematic_area": area_stats,
        "daily_activity": list(reversed(daily_volume))
    }



# ============ AUTO-NEWSLETTER ENDPOINTS ============

@router.post("/auto-send/trigger")
async def trigger_auto_newsletters(
    force: bool = False,
    current_user: dict = Depends(get_current_user)
):
    """
    Manually trigger automatic newsletter generation and sending.
    Use force=true to run even if not Monday.
    """
    from scheduler_worker import process_auto_newsletters_monday
    import asyncio
    
    # If force is true, temporarily modify the check
    if force:
        # Run directly regardless of day
        from datetime import datetime, timezone
        now = datetime.now(timezone.utc)
        
        # Get enabled auto configs
        auto_configs = await db.newsletter_auto_configs.find({"enabled": True}).to_list(100)
        
        if not auto_configs:
            return {
                "success": False,
                "message": "No auto-newsletter configurations found. Create one first.",
                "configs_count": 0
            }
        
        # Trigger the process
        await process_auto_newsletters_monday()
        
        return {
            "success": True,
            "message": f"Auto-newsletter process triggered for {len(auto_configs)} configs",
            "configs_count": len(auto_configs),
            "triggered_at": now.isoformat()
        }
    else:
        # Normal trigger - will only work on Mondays
        await process_auto_newsletters_monday()
        return {
            "success": True,
            "message": "Auto-newsletter check triggered (will only send on Mondays)"
        }


@router.get("/auto-send/status")
async def get_auto_send_status(
    current_user: dict = Depends(get_current_user)
):
    """Get status of automatic newsletter sending"""
    # Get all auto configs
    configs = await db.newsletter_auto_configs.find({}, {"_id": 0}).to_list(100)
    
    # Get recent auto-generated newsletters
    auto_newsletters = await db.newsletters.find(
        {"auto_generated": True},
        {"_id": 0}
    ).sort("created_at", -1).limit(10).to_list(10)
    
    # Calculate next Monday
    from datetime import datetime, timezone, timedelta
    now = datetime.now(timezone.utc)
    days_until_monday = (7 - now.weekday()) % 7
    if days_until_monday == 0 and now.hour >= 9:
        days_until_monday = 7
    next_monday = (now + timedelta(days=days_until_monday)).replace(hour=9, minute=0, second=0, microsecond=0)
    
    return {
        "configs": configs,
        "configs_count": len(configs),
        "enabled_count": len([c for c in configs if c.get("enabled")]),
        "recent_auto_newsletters": auto_newsletters,
        "next_scheduled_run": next_monday.isoformat(),
        "days_until_next_run": days_until_monday
    }
