"""
Background Worker - Executes scheduled searches automatically
Uses APScheduler to run jobs in the background
"""
import asyncio
import logging
from datetime import datetime, timezone, timedelta
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.interval import IntervalTrigger
from database import db

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("scheduler_worker")

# Frequency mapping (days)
FREQUENCY_DAYS = {
    "daily": 1,
    "weekly": 7,
    "biweekly": 15,
    "monthly": 30,
    "bimonthly": 60,
    "quarterly": 90,
    "semiannual": 180,
    "annual": 365
}

# Global scheduler instance
scheduler = AsyncIOScheduler()


async def execute_business_unit_search(schedule: dict):
    """Execute a business unit search (1.1.1 Molecules)"""
    from routers.scrappers import search_molecules_deal_makers_internal
    
    params = schedule.get("params", {})
    company = params.get("company")
    therapeutic_area = params.get("therapeutic_area")
    
    if not company or not therapeutic_area:
        logger.error(f"Missing params for business_unit schedule {schedule['id']}")
        return False
    
    try:
        logger.info(f"Executing business unit search: {company} - {therapeutic_area}")
        # This calls the internal search function
        result = await search_molecules_deal_makers_internal(company, therapeutic_area)
        return True
    except Exception as e:
        logger.error(f"Error executing business unit search: {e}")
        return False


async def execute_keyword_search(schedule: dict):
    """Execute a keyword search (1.1.2 Posts)"""
    from routers.scrappers import search_deal_makers_by_post_internal
    
    params = schedule.get("params", {})
    keyword = params.get("keyword")
    
    if not keyword:
        logger.error(f"Missing keyword for schedule {schedule['id']}")
        return False
    
    try:
        logger.info(f"Executing keyword search: {keyword}")
        result = await search_deal_makers_by_post_internal([keyword])
        return True
    except Exception as e:
        logger.error(f"Error executing keyword search: {e}")
        return False


async def execute_buyer_persona_search(schedule: dict):
    """Execute a buyer persona search (1.1.3 Position)"""
    from routers.scrappers import search_deal_makers_by_position_internal
    
    params = schedule.get("params", {})
    keywords = params.get("keywords", [])
    persona_code = params.get("persona_code")
    
    if not keywords:
        logger.error(f"Missing keywords for buyer_persona schedule {schedule['id']}")
        return False
    
    try:
        logger.info(f"Executing buyer persona search: {persona_code} with {len(keywords)} keywords")
        result = await search_deal_makers_by_position_internal(keywords, persona_code)
        return True
    except Exception as e:
        logger.error(f"Error executing buyer persona search: {e}")
        return False


async def execute_small_business_search(schedule: dict):
    """Execute a small business search (1.1.4)"""
    from routers.scrappers import search_small_business_internal
    
    params = schedule.get("params", {})
    business_type = params.get("business_type")
    city = params.get("city")
    
    if not business_type or not city:
        logger.error(f"Missing params for small_business schedule {schedule['id']}")
        return False
    
    try:
        logger.info(f"Executing small business search: {business_type} in {city}")
        result = await search_small_business_internal(business_type, city)
        return True
    except Exception as e:
        logger.error(f"Error executing small business search: {e}")
        return False


async def execute_medical_society_scrape(schedule: dict):
    """Execute medical society scraping - scrapes all societies with websites"""
    from routers.medical import scrape_society_website
    
    try:
        logger.info("Starting medical society batch scrape...")
        
        # Get all societies with websites that haven't been scraped recently
        societies = await db.medical_societies.find({
            "website": {"$exists": True, "$ne": None, "$ne": ""}
        }).to_list(500)
        
        logger.info(f"Found {len(societies)} societies with websites")
        
        scraped_count = 0
        for society in societies:
            society_id = society.get("id")
            website = society.get("website")
            name = society.get("name", "Unknown")
            
            if not website:
                continue
            
            try:
                logger.info(f"Scraping: {name}")
                await scrape_society_website(society_id, website, name)
                scraped_count += 1
                # Small delay to avoid overwhelming
                await asyncio.sleep(2)
            except Exception as e:
                logger.error(f"Error scraping {name}: {e}")
                continue
        
        logger.info(f"Medical society scrape complete: {scraped_count} societies processed")
        return True
    except Exception as e:
        logger.error(f"Error in medical society batch scrape: {e}")
        return False


async def execute_pharma_pipeline_scrape(schedule: dict):
    """Execute pharma pipeline scraping"""
    from routers.scrappers import scrape_pharma_pipelines_internal
    
    try:
        logger.info("Starting pharma pipeline scrape...")
        result = await scrape_pharma_pipelines_internal()
        logger.info(f"Pharma scrape complete: {result}")
        return True
    except Exception as e:
        logger.error(f"Error in pharma pipeline scrape: {e}")
        return False


async def process_due_schedules():
    """Main job that checks and executes due schedules"""
    logger.info("Checking for due schedules...")
    
    now = datetime.now(timezone.utc)
    
    # Find all active schedules that are due
    due_schedules = await db.search_schedules.find({
        "active": True,
        "next_run": {"$lte": now.isoformat()}
    }).to_list(100)
    
    if not due_schedules:
        logger.info("No due schedules found")
        return
    
    logger.info(f"Found {len(due_schedules)} due schedules")
    
    for schedule in due_schedules:
        schedule_id = schedule["id"]
        schedule_type = schedule["schedule_type"]
        entity_name = schedule.get("entity_name", schedule_id)
        
        logger.info(f"Processing schedule: {schedule_id} ({schedule_type})")
        
        # Mark as running
        await db.search_schedules.update_one(
            {"id": schedule_id},
            {"$set": {"last_run_status": "running"}}
        )
        
        # Execute based on type
        success = False
        error_message = None
        try:
            if schedule_type == "business_unit":
                success = await execute_business_unit_search(schedule)
            elif schedule_type == "keyword":
                success = await execute_keyword_search(schedule)
            elif schedule_type == "buyer_persona":
                success = await execute_buyer_persona_search(schedule)
            elif schedule_type == "small_business":
                success = await execute_small_business_search(schedule)
            elif schedule_type == "medical_society":
                success = await execute_medical_society_scrape(schedule)
            elif schedule_type == "pharma_pipeline":
                success = await execute_pharma_pipeline_scrape(schedule)
            else:
                logger.warning(f"Unknown schedule type: {schedule_type}")
                error_message = f"Unknown schedule type: {schedule_type}"
        except Exception as e:
            logger.error(f"Error executing schedule {schedule_id}: {e}")
            error_message = str(e)
            success = False
        
        # Calculate next run date
        frequency = schedule.get("frequency", "monthly")
        frequency_days = FREQUENCY_DAYS.get(frequency, 30)
        next_run = now + timedelta(days=frequency_days)
        
        # Update schedule
        await db.search_schedules.update_one(
            {"id": schedule_id},
            {"$set": {
                "last_run": now.isoformat(),
                "last_run_status": "completed" if success else "failed",
                "last_run_error": error_message,
                "next_run": next_run.isoformat(),
                "updated_at": now.isoformat()
            }}
        )
        
        # Create notification if failed
        if not success:
            await create_failure_notification(schedule_id, schedule_type, entity_name, error_message)
        
        logger.info(f"Schedule {schedule_id} {'completed' if success else 'failed'}. Next run: {next_run.date()}")


async def create_failure_notification(schedule_id: str, schedule_type: str, entity_name: str, error_message: str = None):
    """Create a notification when a schedule fails"""
    import uuid
    
    now = datetime.now(timezone.utc)
    
    notification = {
        "id": str(uuid.uuid4()),
        "type": "schedule_failure",
        "schedule_id": schedule_id,
        "schedule_type": schedule_type,
        "entity_name": entity_name,
        "title": f"Schedule Failed: {entity_name}",
        "message": f"The {schedule_type.replace('_', ' ')} schedule '{entity_name}' failed to execute.",
        "error": error_message,
        "severity": "error",
        "read": False,
        "created_at": now.isoformat()
    }
    
    await db.notifications.insert_one(notification)
    logger.info(f"Created failure notification for schedule {schedule_id}")


async def process_scheduled_newsletters():
    """Process newsletters that are scheduled to be sent"""
    now = datetime.now(timezone.utc)
    logger.info(f"Checking for scheduled newsletters at {now.isoformat()}")
    
    # Find newsletters that are scheduled and due
    scheduled = await db.newsletters.find({
        "status": "scheduled",
        "scheduled_at": {"$lte": now.isoformat()}
    }).to_list(100)
    
    logger.info(f"Found {len(scheduled)} newsletters to send")
    
    for newsletter in scheduled:
        try:
            # Get subscribers for this newsletter's thematic areas
            query = {"unsubscribed": {"$ne": True}}
            if newsletter.get("thematic_axes"):
                query["thematic_areas"] = {"$in": newsletter["thematic_axes"]}
            
            subscribers = await db.newsletter_subscribers.find(query).to_list(10000)
            
            if not subscribers:
                logger.warning(f"No subscribers found for newsletter {newsletter['id']}")
                await db.newsletters.update_one(
                    {"id": newsletter["id"]},
                    {"$set": {"status": "sent", "sent_at": now.isoformat(), "recipients_count": 0}}
                )
                continue
            
            # Send emails (simplified - in production would use email service)
            sent_count = 0
            for subscriber in subscribers:
                # Here we would call the email service
                # For now, just log and count
                logger.info(f"Would send newsletter to {subscriber.get('email')}")
                sent_count += 1
            
            # Update newsletter status
            await db.newsletters.update_one(
                {"id": newsletter["id"]},
                {"$set": {
                    "status": "sent",
                    "sent_at": now.isoformat(),
                    "recipients_count": sent_count
                }}
            )
            
            logger.info(f"Newsletter {newsletter['id']} sent to {sent_count} subscribers")
            
        except Exception as e:
            logger.error(f"Error sending newsletter {newsletter['id']}: {str(e)}")
            await db.newsletters.update_one(
                {"id": newsletter["id"]},
                {"$set": {"status": "failed", "error": str(e)}}
            )


async def process_auto_newsletters_monday():
    """
    Process automatic newsletters configured to send on Mondays.
    This runs every Monday morning and generates/sends newsletters based on auto-config.
    """
    import uuid
    now = datetime.now(timezone.utc)
    today_weekday = now.weekday()  # 0 = Monday
    
    # Only run on Mondays (or force run for testing)
    if today_weekday != 0:
        logger.info(f"Auto newsletter check skipped - not Monday (today is {today_weekday})")
        return
    
    logger.info("Processing automatic Monday newsletters...")
    
    # Get all enabled auto-newsletter configs set for Monday
    auto_configs = await db.newsletter_auto_configs.find({
        "enabled": True,
        "day_of_week": 0  # Monday
    }).to_list(100)
    
    logger.info(f"Found {len(auto_configs)} auto-newsletter configs for Monday")
    
    for config in auto_configs:
        try:
            thematic_axis_id = config.get("thematic_axis_id")
            thematic_axis_name = config.get("thematic_axis_name", "General")
            last_sent = config.get("last_sent")
            
            # Check if already sent this week
            if last_sent:
                last_sent_date = datetime.fromisoformat(last_sent.replace("Z", "+00:00"))
                days_since_last = (now - last_sent_date).days
                if days_since_last < 6:  # Less than a week ago
                    logger.info(f"Skipping {thematic_axis_name} - already sent {days_since_last} days ago")
                    continue
            
            # Generate newsletter content (could use AI in the future)
            newsletter_content = await generate_auto_newsletter_content(thematic_axis_id, thematic_axis_name)
            
            if not newsletter_content:
                logger.warning(f"No content generated for {thematic_axis_name}")
                continue
            
            # Create the newsletter
            newsletter_id = str(uuid.uuid4())
            newsletter = {
                "id": newsletter_id,
                "name": f"Weekly {thematic_axis_name} - {now.strftime('%Y-%m-%d')}",
                "subject": newsletter_content.get("subject", f"Weekly Update: {thematic_axis_name}"),
                "content_html": newsletter_content.get("html", ""),
                "thematic_area": thematic_axis_id,
                "status": "scheduled",
                "scheduled_at": now.isoformat(),
                "auto_generated": True,
                "auto_config_id": config.get("id"),
                "created_at": now.isoformat(),
                "updated_at": now.isoformat()
            }
            
            await db.newsletters.insert_one(newsletter)
            logger.info(f"Created auto-newsletter: {newsletter['name']}")
            
            # Update last_sent
            await db.newsletter_auto_configs.update_one(
                {"id": config.get("id")},
                {"$set": {"last_sent": now.isoformat()}}
            )
            
        except Exception as e:
            logger.error(f"Error processing auto-newsletter for {config.get('thematic_axis_name')}: {e}")
            continue
    
    logger.info("Auto newsletter processing complete")


async def generate_auto_newsletter_content(thematic_axis_id: str, thematic_axis_name: str) -> dict:
    """
    Generate newsletter content for a thematic axis.
    Pulls recent blog posts, events, and creates a summary.
    """
    import os
    now = datetime.now(timezone.utc)
    week_ago = (now - timedelta(days=7)).isoformat()
    
    # Get recent blog posts for this thematic area
    recent_posts = await db.blog_posts.find({
        "is_published": True,
        "$or": [
            {"thematic_area": thematic_axis_id},
            {"tags": thematic_axis_name}
        ],
        "created_at": {"$gte": week_ago}
    }, {"_id": 0}).limit(3).to_list(3)
    
    # Get upcoming events
    upcoming_events = await db.webinar_events_v2.find({
        "webinar_date": {"$gte": now.strftime("%Y-%m-%d")},
        "status": {"$in": ["active", "published"]}
    }, {"_id": 0}).limit(2).to_list(2)
    
    # Build HTML content
    html_parts = []
    
    # Header
    html_parts.append(f"""
    <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #ff3300; margin-bottom: 20px;">Weekly Update: {thematic_axis_name}</h1>
        <p style="color: #666; margin-bottom: 30px;">¡Hola! Aquí está tu resumen semanal.</p>
    """)
    
    # Recent articles
    if recent_posts:
        html_parts.append("""
        <h2 style="color: #333; border-bottom: 2px solid #ff3300; padding-bottom: 10px;">📚 Artículos Recientes</h2>
        """)
        for post in recent_posts:
            html_parts.append(f"""
            <div style="margin-bottom: 20px; padding: 15px; background: #f9f9f9; border-radius: 8px;">
                <h3 style="margin: 0 0 10px 0;"><a href="https://leaderlix.com/blog/{post.get('slug')}" style="color: #333; text-decoration: none;">{post.get('title')}</a></h3>
                <p style="color: #666; margin: 0;">{post.get('excerpt', '')[:150]}...</p>
            </div>
            """)
    
    # Upcoming events
    if upcoming_events:
        html_parts.append("""
        <h2 style="color: #333; border-bottom: 2px solid #ff3300; padding-bottom: 10px;">📅 Próximos Eventos</h2>
        """)
        for event in upcoming_events:
            html_parts.append(f"""
            <div style="margin-bottom: 15px; padding: 15px; background: #fff3f0; border-radius: 8px; border-left: 4px solid #ff3300;">
                <h3 style="margin: 0 0 5px 0; color: #333;">{event.get('name')}</h3>
                <p style="color: #666; margin: 0;">📆 {event.get('webinar_date')}</p>
                <a href="https://leaderlix.com/evento/{event.get('slug')}" style="color: #ff3300; text-decoration: none;">Ver más →</a>
            </div>
            """)
    
    # Footer
    html_parts.append("""
        <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
        <p style="color: #999; font-size: 12px; text-align: center;">
            Equipo Leaderlix | <a href="https://leaderlix.com" style="color: #ff3300;">leaderlix.com</a>
        </p>
    </div>
    """)
    
    html_content = "".join(html_parts)
    
    # Generate subject
    subject = f"🚀 Weekly {thematic_axis_name} | Leaderlix"
    
    return {
        "subject": subject,
        "html": html_content
    }


async def process_webinar_scheduled_emails():
    """
    Process scheduled webinar emails (E07-E10).
    Called every 5 minutes to check for emails that need to be sent.
    """
    from routers.webinar_emails import process_scheduled_emails
    
    try:
        logger.info("Processing scheduled webinar emails...")
        await process_scheduled_emails()
        logger.info("Webinar email processing completed")
    except Exception as e:
        logger.error(f"Error processing webinar emails: {e}")


async def refresh_merge_candidates_cache_job():
    """
    Refresh the merge candidates cache daily.
    This pre-computes duplicate domains and similar names for the Merge Companies feature.
    Running this nightly ensures the semaphore status is always accurate without
    expensive real-time calculations.
    """
    from services.merge_candidates_cache import refresh_merge_candidates_cache
    
    try:
        logger.info("Starting daily merge candidates cache refresh...")
        result = await refresh_merge_candidates_cache(db)
        
        if result.get("success"):
            logger.info(f"Merge candidates cache refreshed: {result.get('domain_groups', 0)} domain groups, {result.get('name_groups', 0)} name groups")
        else:
            logger.error(f"Merge candidates cache refresh failed: {result.get('error')}")
    except Exception as e:
        logger.error(f"Error refreshing merge candidates cache: {e}")


async def process_linkedin_import_jobs():
    """
    Process LinkedIn import jobs - V2 robust worker.
    
    Features:
    - Streaming file processing (not loading all in memory)
    - Bulk database operations
    - Heartbeat for liveness detection
    - Orphaned job recovery
    - Automatic retries
    - Profile locking to prevent concurrent imports
    
    Called every 10 seconds to check for pending jobs.
    """
    from linkedin_import_worker import (
        find_next_job, process_job, recover_orphaned_jobs, ensure_indexes, WORKER_ID
    )
    
    try:
        # Ensure indexes exist (idempotent - safe to call multiple times)
        await ensure_indexes()
        
        # First, recover any orphaned jobs
        await recover_orphaned_jobs()
        
        # Find and process next job
        job = await find_next_job()
        
        if job:
            logger.info(f"LinkedIn Import Worker: Processing job {job['job_id']}")
            await process_job(job)
            logger.info(f"LinkedIn Import Worker: Completed job {job['job_id']}")
        
    except Exception as e:
        logger.error(f"LinkedIn Import Worker error: {e}")
        import traceback
        logger.error(traceback.format_exc())


def start_scheduler():
    """Start the background scheduler"""
    from apscheduler.triggers.cron import CronTrigger
    
    if scheduler.running:
        logger.info("Scheduler already running")
        return
    
    # Add job to check schedules every hour
    scheduler.add_job(
        process_due_schedules,
        trigger=IntervalTrigger(hours=1),
        id="process_due_schedules",
        name="Process due scheduled searches",
        replace_existing=True
    )
    
    # Add job to check newsletters every 15 minutes
    scheduler.add_job(
        process_scheduled_newsletters,
        trigger=IntervalTrigger(minutes=15),
        id="process_scheduled_newsletters",
        name="Process scheduled newsletters",
        replace_existing=True
    )
    
    # Add job to process webinar emails every 5 minutes
    scheduler.add_job(
        process_webinar_scheduled_emails,
        trigger=IntervalTrigger(minutes=5),
        id="process_webinar_emails",
        name="Process scheduled webinar emails",
        replace_existing=True
    )
    
    # Add job for automatic Monday newsletters at 9 AM UTC
    scheduler.add_job(
        process_auto_newsletters_monday,
        trigger=CronTrigger(day_of_week='mon', hour=9, minute=0),
        id="auto_newsletters_monday",
        name="Auto-generate Monday newsletters",
        replace_existing=True
    )
    
    # Add job to refresh merge candidates cache daily at 3 AM UTC
    scheduler.add_job(
        refresh_merge_candidates_cache_job,
        trigger=CronTrigger(hour=3, minute=0),
        id="refresh_merge_candidates_cache",
        name="Refresh merge candidates cache daily",
        replace_existing=True
    )
    
    # Add LinkedIn Import Worker - runs every 10 seconds to process pending imports
    scheduler.add_job(
        process_linkedin_import_jobs,
        trigger=IntervalTrigger(seconds=10),
        id="linkedin_import_worker",
        name="LinkedIn Import Worker V2",
        replace_existing=True,
        max_instances=1  # Ensure only one instance runs at a time
    )
    
    # Add Persona Reclassification Worker - runs every 30 seconds
    from services.persona_reclassification_worker import process_reclassification_jobs
    scheduler.add_job(
        process_reclassification_jobs,
        trigger=IntervalTrigger(seconds=30),
        id="persona_reclassification_worker",
        name="Persona Reclassification Worker",
        replace_existing=True,
        max_instances=1
    )
    
    # Add Persona Classifier Metrics Worker - runs every 6 hours
    from services.persona_classifier_metrics import process_metrics_job
    scheduler.add_job(
        process_metrics_job,
        trigger=IntervalTrigger(hours=6),
        id="persona_classifier_metrics_worker",
        name="Persona Classifier Metrics Worker",
        replace_existing=True,
        max_instances=1
    )
    
    # Also run immediately on startup (after 30 seconds to let DB connect)
    scheduler.add_job(
        process_due_schedules,
        trigger="date",
        run_date=datetime.now() + timedelta(seconds=30),
        id="initial_schedule_check",
        name="Initial schedule check on startup"
    )
    
    scheduler.start()
    logger.info("Background scheduler started - checking every hour")


def stop_scheduler():
    """Stop the background scheduler"""
    if scheduler.running:
        scheduler.shutdown()
        logger.info("Background scheduler stopped")


async def get_scheduler_info():
    """Get info about the scheduler for debugging"""
    jobs = scheduler.get_jobs()
    return {
        "running": scheduler.running,
        "jobs": [
            {
                "id": job.id,
                "name": job.name,
                "next_run": str(job.next_run_time) if job.next_run_time else None
            }
            for job in jobs
        ]
    }
