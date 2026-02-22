"""
Leaderlix Automation API - Main Server
Refactored modular structure
"""
from fastapi import FastAPI, APIRouter, HTTPException, Depends, Request, Response, BackgroundTasks, Body
from fastapi.responses import RedirectResponse
from starlette.middleware.cors import CORSMiddleware
import logging

# Configuration and Database
from config import CORS_ORIGINS
from database import db, close_db

# Rate Limiting
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from rate_limiter import limiter

# Import routers
from routers.auth import router as auth_router, get_current_user
from routers.cotizador import router as cotizador_router
from routers.certificados import router as certificados_router
from routers.scrappers import router as scrappers_router
from routers.content_flow import router as content_flow_router
from routers.contacts import router as contacts_router
from routers.testimonials import router as testimonials_router
from routers.search import router as search_router
from routers.scheduler import router as scheduler_router
from routers.attract import router as attract_router
from routers.youtube import router as youtube_router
from routers.job_keywords import router as job_keywords_router
from routers.events_v2 import router as events_v2_router
from routers.medical import router as medical_router
from routers.position_search import router as position_search_router
from routers.industries import router as industries_router
from routers.sponsorship import router as sponsorship_router
from routers.calendar import router as calendar_router
from routers.whatsapp_confirmations import router as whatsapp_confirmations_router
from routers.contact_imports import router as contact_imports_router
from routers.media_documents import router as media_contacts_router, documents_router, booklets_router
from routers.companies import router as companies_router
from routers.media_companies import router as media_companies_router
from routers.media_opportunities import router as media_opportunities_router
from routers.public_website import router as public_router
from routers.website_config import router as website_config_router
from routers.lms import router as lms_router
from routers.blog import router as blog_router
from routers.time_tracker import router as time_tracker_router
from routers.mensajes_hoy import router as mensajes_hoy_router
from routers.scraping_automation import router as scraping_automation_router
from routers.social_followers import router as social_followers_router
from routers.editorial import router as editorial_router
from routers.books import router as books_router
from routers.venues import router as venues_router
from routers.newsletters import router as newsletters_router
from routers.video_processing import router as video_processing_router
from routers.quiz import router as quiz_router
from routers.countdown import router as countdown_router
from routers.business_search import router as business_search_router
from routers.tasks import router as tasks_router
from routers.focus import router as focus_router
from routers.webinar_emails import router as webinar_emails_router
from routers.admin_sync import router as admin_sync_router

# For backwards compatibility, import everything else from legacy module
from routers.legacy import (
    events_router,
    hubspot_router,
    templates_router,
    campaigns_router,
    tracking_router,
    settings_router,
    emails_router,
    preview_router,
    gmail_router,
    buyer_personas_router,
    thematic_axes_router,
    dashboard_router,
    misc_router
)
from routers.dev_kanban import router as dev_kanban_router
from routers.google_drive import router as google_drive_router
from routers.convenios import router as convenios_router
from routers.foundations import router as foundations_router
from routers.email_individual import router as email_individual_router
from routers.email_rules import router as email_rules_router
from routers.content_items import router as content_items_router
from routers.cases import router as cases_router
from routers.delivery import router as delivery_router
from routers.todays_focus import router as todays_focus_router
from routers.prospection import router as prospection_router
from routers.whatsapp_rules import router as whatsapp_rules_router
from routers.unified_companies import router as unified_companies_router
from routers.industries_v2 import router as industries_v2_router
from routers.linkedin_import import router as linkedin_import_router
from routers.persona_classifier import router as persona_classifier_router

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Create the main app
app = FastAPI(title="Leaderlix Automation API")

# Add rate limiter to app state
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# CORS Middleware - MUST be added before routers
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=CORS_ORIGINS,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Create main API router
api_router = APIRouter(prefix="/api")

@api_router.get("/")
async def root():
    return {"message": "Leaderlix Automation API", "version": "2.1.0"}

@api_router.get("/debug/db-info")
async def debug_db_info():
    """Diagnostic endpoint to check database connection"""
    from config import DB_NAME, MONGO_URL
    from database import db
    
    # Count contacts to verify connection
    try:
        contact_count = await db.unified_contacts.count_documents({})
        # Get sample contact ID to identify database
        sample = await db.unified_contacts.find_one({}, {"_id": 0, "id": 1, "email": 1})
    except Exception as e:
        contact_count = f"Error: {str(e)}"
        sample = None
    
    # Mask the connection string for security
    masked_url = MONGO_URL[:30] + "..." if len(MONGO_URL) > 30 else MONGO_URL
    
    return {
        "db_name": DB_NAME,
        "mongo_url_prefix": masked_url,
        "unified_contacts_count": contact_count,
        "sample_contact": sample
    }

# Include all routers
api_router.include_router(auth_router)
api_router.include_router(contact_imports_router)  # Must be before contacts_router to avoid route conflict
api_router.include_router(contacts_router)
api_router.include_router(testimonials_router)
api_router.include_router(search_router)
api_router.include_router(scheduler_router)
api_router.include_router(attract_router)
api_router.include_router(cotizador_router)
api_router.include_router(certificados_router)
api_router.include_router(scrappers_router)
api_router.include_router(content_flow_router)
api_router.include_router(events_router)
api_router.include_router(hubspot_router)
api_router.include_router(templates_router)
api_router.include_router(campaigns_router)
api_router.include_router(tracking_router)
api_router.include_router(settings_router)
api_router.include_router(emails_router)
api_router.include_router(preview_router)
api_router.include_router(gmail_router)
api_router.include_router(buyer_personas_router)
api_router.include_router(thematic_axes_router)
api_router.include_router(dashboard_router)
api_router.include_router(misc_router)
api_router.include_router(youtube_router)
api_router.include_router(job_keywords_router)
api_router.include_router(events_v2_router)
api_router.include_router(medical_router)
api_router.include_router(position_search_router)
api_router.include_router(industries_router)
api_router.include_router(sponsorship_router)
api_router.include_router(calendar_router)
api_router.include_router(whatsapp_confirmations_router)
api_router.include_router(media_contacts_router)
api_router.include_router(documents_router)
api_router.include_router(booklets_router)
api_router.include_router(companies_router)
api_router.include_router(media_companies_router)
api_router.include_router(media_opportunities_router)
api_router.include_router(public_router)
api_router.include_router(website_config_router)
api_router.include_router(lms_router)
api_router.include_router(blog_router)
api_router.include_router(time_tracker_router)
api_router.include_router(mensajes_hoy_router)
api_router.include_router(scraping_automation_router)
api_router.include_router(social_followers_router)
api_router.include_router(editorial_router)
api_router.include_router(books_router)
api_router.include_router(venues_router)
api_router.include_router(newsletters_router)
api_router.include_router(video_processing_router)
api_router.include_router(quiz_router)
api_router.include_router(countdown_router)
api_router.include_router(business_search_router)
api_router.include_router(dev_kanban_router)
api_router.include_router(google_drive_router)
api_router.include_router(convenios_router)
api_router.include_router(foundations_router)
api_router.include_router(email_individual_router)
api_router.include_router(email_rules_router)
api_router.include_router(content_items_router)
api_router.include_router(cases_router)
api_router.include_router(delivery_router)
api_router.include_router(todays_focus_router)
api_router.include_router(prospection_router)
api_router.include_router(tasks_router)
api_router.include_router(focus_router)
api_router.include_router(whatsapp_rules_router)
api_router.include_router(webinar_emails_router)
api_router.include_router(unified_companies_router)
api_router.include_router(industries_v2_router)
api_router.include_router(admin_sync_router)
api_router.include_router(linkedin_import_router)
api_router.include_router(persona_classifier_router)

app.include_router(api_router)

# Import and start background scheduler
from scheduler_worker import start_scheduler, stop_scheduler, get_scheduler_info
from database import ensure_indexes

@app.on_event("startup")
async def startup_event():
    """Start background schedulers on app startup"""
    # Create database indexes for performance
    await ensure_indexes()
    
    # Start the main scheduler
    start_scheduler()
    
    # Start email queue processor (processes queue every 60 seconds)
    try:
        from services.email_scheduler import email_scheduler
        email_scheduler.start_background_task()
    except Exception as e:
        print(f"Warning: Could not start email scheduler: {e}")

@app.on_event("shutdown")
async def shutdown_db_client():
    """Stop schedulers and close DB on shutdown"""
    stop_scheduler()
    
    # Stop email scheduler
    try:
        from services.email_scheduler import email_scheduler
        email_scheduler.stop_background_task()
    except Exception:
        pass
    
    await close_db()

# Endpoint to check scheduler status
@app.get("/api/scheduler/worker-status")
async def scheduler_worker_status():
    """Get background scheduler status"""
    return await get_scheduler_info()

