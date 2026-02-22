"""
Traffic Light System - Calculates status for all navigation sections
Colors: green (ok), yellow (attention), red (critical), gray (not implemented)
"""
from datetime import datetime, timezone, timedelta
from database import db


async def calculate_all_traffic_lights():
    """Calculate traffic light status for all sections"""
    now = datetime.now(timezone.utc)
    one_week_ago = now - timedelta(days=7)
    one_month_ago = now - timedelta(days=30)
    
    status = {}
    
    # ============ 1. PROSPECT ============
    
    # 1.1.1.1 By Molecules - Weekly goal of 50 new contacts
    molecules_contacts = await db.scraper_runs.find({
        "scrapper_id": {"$regex": "molecules", "$options": "i"},
        "started_at": {"$gte": one_week_ago.isoformat()}
    }).to_list(100)
    molecules_count = sum(r.get("results", {}).get("deal_makers_added", 0) or 0 for r in molecules_contacts)
    status["1.1.1.1"] = "green" if molecules_count >= 50 else "yellow" if molecules_count >= 25 else "red"
    
    # 1.1.1.2 By Post
    posts_contacts = await db.scraper_runs.find({
        "scrapper_id": {"$regex": "posts|post", "$options": "i"},
        "started_at": {"$gte": one_week_ago.isoformat()}
    }).to_list(100)
    posts_count = sum(r.get("results", {}).get("deal_makers_added", 0) or 0 for r in posts_contacts)
    status["1.1.1.2"] = "green" if posts_count >= 50 else "yellow" if posts_count >= 25 else "red"
    
    # 1.1.1.3 By Position
    position_contacts = await db.scraper_runs.find({
        "scrapper_id": {"$regex": "position", "$options": "i"},
        "started_at": {"$gte": one_week_ago.isoformat()}
    }).to_list(100)
    position_count = sum(r.get("results", {}).get("deal_makers_added", 0) or 0 for r in position_contacts)
    status["1.1.1.3"] = "green" if position_count >= 50 else "yellow" if position_count >= 25 else "red"
    
    # 1.1.1 Via LinkedIn (aggregate)
    status["1.1.1"] = aggregate_status([status["1.1.1.1"], status["1.1.1.2"], status["1.1.1.3"]])
    
    # 1.1.2 Via Google Maps - Coming Soon
    status["1.1.2"] = "gray"
    
    # 1.1 Find (aggregate)
    status["1.1"] = aggregate_status([status["1.1.1"], status["1.1.2"]])
    
    # 1.2 Attract - All Coming Soon
    status["1.2.1"] = "gray"
    status["1.2.2"] = "gray"
    status["1.2.3"] = "gray"
    status["1.2.4"] = "gray"
    status["1.2"] = "gray"
    
    # 1.3.1 Deal Makers - Check unprocessed contacts
    total_dms = await db.unified_contacts.count_documents({"stage": 1})
    processed_dms = await db.unified_contacts.count_documents({"stage": 1, "status": {"$ne": "new"}})
    dm_ratio = processed_dms / total_dms if total_dms > 0 else 1
    status["1.3.1"] = "green" if dm_ratio >= 0.8 else "yellow" if dm_ratio >= 0.5 else "red"
    
    # 1.3.2 Max LinkedIn Invitations - Check today's activity
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    invitations_today = await db.linkedin_invitations.count_documents({
        "sent_at": {"$gte": today_start.isoformat()}
    })
    status["1.3.2"] = "green" if invitations_today > 0 else "red"
    
    # 1.3.3 Small Business WhatsApp
    # Green if weekly task is checked (completed) or no pending messages
    weekly_task = await db.weekly_tasks.find_one({"task_id": "small_business", "sub_task": "all"})
    weekly_task_checked = False
    if weekly_task:
        last_checked = weekly_task.get("last_checked")
        if last_checked:
            try:
                if isinstance(last_checked, str):
                    last_checked = datetime.fromisoformat(last_checked.replace("Z", "+00:00"))
                # Task is valid if checked within current week
                week_start = now - timedelta(days=now.weekday())
                week_start = week_start.replace(hour=0, minute=0, second=0, microsecond=0)
                weekly_task_checked = last_checked >= week_start
            except:
                pass
    
    whatsapp_pending = await db.whatsapp_messages.count_documents({"status": "pending"})
    status["1.3.3"] = "green" if weekly_task_checked or whatsapp_pending == 0 else "red"
    
    # 1.3.4 Social Media Followers - Coming Soon
    status["1.3.4"] = "gray"
    
    # 1.3 Connect (aggregate)
    status["1.3"] = aggregate_status([status["1.3.1"], status["1.3.2"], status["1.3.3"], status["1.3.4"]])
    
    # Step 1 (aggregate)
    status["step1"] = aggregate_status([status["1.1"], status["1.2"], status["1.3"]])
    
    # ============ 2. NURTURE ============
    
    # 2.1.1 Import LinkedIn Event Contacts
    last_import = await db.linkedin_imports.find_one({}, sort=[("created_at", -1)])
    if last_import:
        import_date = datetime.fromisoformat(last_import.get("created_at", "2000-01-01").replace("Z", "+00:00"))
        days_since = (now - import_date).days
        status["2.1.1"] = "green" if days_since < 7 else "yellow" if days_since < 30 else "red"
    else:
        status["2.1.1"] = "red"
    
    # 2.1.2 Booklets & Cases
    cases_count = await db.success_cases.count_documents({})
    status["2.1.2"] = "green" if cases_count >= 3 else "yellow" if cases_count >= 1 else "red"
    
    # 2.1.3 Nurture Deal Makers
    nurture_contacts = await db.unified_contacts.count_documents({"stage": 2})
    nurtured = await db.unified_contacts.count_documents({"stage": 2, "status": {"$in": ["contacted", "nurturing", "qualified"]}})
    nurture_ratio = nurtured / nurture_contacts if nurture_contacts > 0 else 1
    status["2.1.3"] = "green" if nurture_ratio >= 0.8 else "yellow" if nurture_ratio >= 0.5 else "red"
    
    # 2.1 Individual (aggregate)
    status["2.1"] = aggregate_status([status["2.1.1"], status["2.1.2"], status["2.1.3"]])
    
    # 2.2.1 Website - Coming Soon
    status["2.2.1"] = "gray"
    
    # 2.2.2 Campaigns
    active_campaigns = await db.campaigns.count_documents({"status": "active"})
    status["2.2.2"] = "green" if active_campaigns > 0 else "red"
    
    # 2.2.3 Testimonials
    testimonials = await db.testimonials.count_documents({})
    status["2.2.3"] = "green" if testimonials >= 5 else "yellow" if testimonials >= 1 else "red"
    
    # 2.2.4 Newsletters - Based on newsletters sent
    newsletters_sent = await db.newsletters.count_documents({"status": "sent"})
    status["2.2.4"] = "green" if newsletters_sent > 0 else "red"
    
    # 2.2.4.1 Email Metrics - Based on tracked events
    email_events = await db.email_events.count_documents({})
    status["2.2.4.1"] = "green" if email_events > 0 else "yellow"
    
    # 2.2.5 Learning (LMS) - Published courses
    published_courses = await db.courses.count_documents({"is_published": True})
    status["2.2.5"] = "green" if published_courses > 0 else "yellow"
    
    # 2.2.6 Blog - Published posts
    published_posts = await db.blog_posts.count_documents({"is_published": True})
    status["2.2.6"] = "green" if published_posts > 0 else "red"
    
    # 2.2.6.1 Content AI - AI history exists
    ai_history = await db.ai_content_history.count_documents({})
    status["2.2.6.1"] = "green" if ai_history > 0 else "yellow"
    
    # 2.2.7 Media Relations - Coming Soon
    status["2.2.7"] = "gray"
    
    # 2.2.8 Editorial Relations - Opportunities
    editorial_opps = await db.editorial_opportunities.count_documents({})
    status["2.2.8"] = "green" if editorial_opps > 0 else "yellow"
    
    # 2.2.9 Long Form Videos
    videos_count = await db.youtube_videos.count_documents({})
    scheduled_videos = await db.youtube_videos.count_documents({"status": "scheduled"})
    status["2.2.9"] = "green" if scheduled_videos > 0 else "yellow" if videos_count > 0 else "red"
    
    # 2.2.10 Own Events - Check for overdue tasks
    events = await db.events.find({}).to_list(100)
    has_overdue = False
    has_upcoming = False
    for event in events:
        for task in event.get("tasks", []):
            if not task.get("completed"):
                due_date_str = task.get("due_date")
                if due_date_str:
                    try:
                        due_date = datetime.fromisoformat(due_date_str.replace("Z", "+00:00"))
                        if due_date < now:
                            has_overdue = True
                        elif due_date < now + timedelta(days=7):
                            has_upcoming = True
                    except:
                        pass
    status["2.2.10"] = "red" if has_overdue else "yellow" if has_upcoming else "green"
    
    # 2.2.11 Medical Society Events
    society_events = await db.medical_society_events.count_documents({})
    status["2.2.11"] = "green" if society_events > 0 else "red"
    
    # 2.2.12 Write Books
    books_count = await db.books.count_documents({})
    status["2.2.12"] = "green" if books_count > 0 else "yellow"
    
    # 2.2 Bulk (aggregate)
    status["2.2"] = aggregate_status([
        status["2.2.1"], status["2.2.2"], status["2.2.3"], status["2.2.4"],
        status["2.2.4.1"], status["2.2.5"], status["2.2.6"], status["2.2.6.1"],
        status["2.2.7"], status["2.2.8"], status["2.2.9"], status["2.2.10"],
        status["2.2.11"], status["2.2.12"]
    ])
    
    # Step 2 (aggregate)
    status["step2"] = aggregate_status([status["2.1"], status["2.2"]])
    
    # ============ 3. CLOSE ============
    
    # 3.1 Venue Finder
    venues = await db.venues.count_documents({})
    status["3.1"] = "green" if venues > 0 else "red"
    
    # 3.2 Quote Deal Makers
    recent_quotes = await db.quotes.count_documents({
        "created_at": {"$gte": one_month_ago.isoformat()}
    })
    old_quotes = await db.quotes.count_documents({})
    status["3.2"] = "green" if recent_quotes > 0 else "yellow" if old_quotes > 0 else "red"
    
    # 3.3 Close Deal Makers
    closing = await db.unified_contacts.count_documents({"stage": 3, "status": {"$in": ["negotiating", "closing"]}})
    status["3.3"] = "green" if closing > 0 else "red"
    
    # Step 3 (aggregate)
    status["step3"] = aggregate_status([status["3.1"], status["3.2"], status["3.3"]])
    
    # ============ 4. DELIVER ============
    
    # 4.1 Deliver Deal Makers
    delivering = await db.unified_contacts.count_documents({"stage": 4})
    overdue_deliveries = await db.deliveries.count_documents({
        "status": "pending",
        "due_date": {"$lt": now.isoformat()}
    })
    status["4.1"] = "red" if overdue_deliveries > 0 else "green" if delivering > 0 else "yellow"
    
    # 4.2 Coach Students - Hours tracked this week
    time_entries = await db.time_entries.count_documents({
        "date": {"$gte": one_week_ago.isoformat()}
    })
    status["4.2"] = "green" if time_entries > 0 else "red"
    
    # 4.3 Certificate Students
    pending_certs = await db.certificates.count_documents({"status": "pending"})
    issued_certs = await db.certificates.count_documents({"status": "issued"})
    status["4.3"] = "green" if issued_certs > 0 and pending_certs == 0 else "yellow" if pending_certs > 0 else "red"
    
    # Step 4 (aggregate)
    status["step4"] = aggregate_status([status["4.1"], status["4.2"], status["4.3"]])
    
    # ============ 5. REPURCHASE ============
    
    # 5.1 Deal Makers for Recommendations
    repurchase_contacts = await db.unified_contacts.count_documents({"stage": 5})
    recommendations_requested = await db.recommendations.count_documents({})
    status["5.1"] = "green" if recommendations_requested > 0 else "red" if repurchase_contacts > 0 else "yellow"
    
    # 5.2 Students for Recommendations - Coming Soon
    status["5.2"] = "gray"
    
    # Step 5 (aggregate)
    status["step5"] = aggregate_status([status["5.1"], status["5.2"]])
    
    # ============ FOUNDATIONS ============
    
    # Buyer Personas
    personas = await db.buyer_personas.count_documents({})
    status["foundations-who-personas"] = "green" if personas > 0 else "red"
    
    # Companies
    companies_with_contacts = await db.unified_contacts.distinct("company")
    companies_with_relations = await db.unified_contacts.count_documents({"related_contacts": {"$exists": True, "$ne": []}})
    status["foundations-who-companies"] = "green" if companies_with_relations > 0 else "yellow" if len(companies_with_contacts) > 0 else "red"
    
    # All Contacts - Coming Soon
    status["foundations-who-all"] = "gray"
    
    # Who (aggregate)
    status["foundations-who"] = aggregate_status([
        status["foundations-who-personas"],
        status["foundations-who-companies"],
        status["foundations-who-all"]
    ])
    
    # What (Success Cases)
    cases = await db.success_cases.count_documents({})
    status["foundations-what"] = "green" if cases >= 3 else "yellow" if cases >= 1 else "red"
    
    # How (Services)
    services = await db.services.count_documents({})
    status["foundations-how"] = "green" if services > 0 else "red"
    
    # How Much (Pricing)
    pricing = await db.pricing.count_documents({})
    status["foundations-howmuch"] = "green" if pricing > 0 else "red"
    
    # Foundations (aggregate)
    status["foundations"] = aggregate_status([
        status["foundations-who"],
        status["foundations-what"],
        status["foundations-how"],
        status["foundations-howmuch"]
    ])
    
    # ============ INFOSTRUCTURE ============
    
    # Pharma Pipelines
    pharma_total = await db.pharma_pipelines.count_documents({})
    pharma_scraped = await db.pharma_pipelines.count_documents({"last_scrape_status": {"$in": ["success", "manual"]}})
    status["pharma"] = "green" if pharma_scraped == pharma_total and pharma_total > 0 else "red"
    
    # Medical Societies
    societies_total = await db.medical_societies.count_documents({})
    societies_scraped = await db.medical_societies.count_documents({"last_scrape_status": {"$in": ["success", "manual"]}})
    status["med-societies"] = "green" if societies_scraped == societies_total and societies_total > 0 else "red"
    
    # Medical Specialties
    specialties = await db.medical_specialties.count_documents({})
    status["med-specialties"] = "green" if specialties >= 10 else "red"
    
    # Keywords
    keywords = await db.job_keywords.count_documents({})
    status["keywords"] = "green" if keywords > 0 else "red"
    
    # Data Sources
    sources = await db.data_sources.count_documents({})
    status["sources"] = "green" if sources > 0 else "yellow"
    
    # Infostructure (aggregate)
    status["infostructure"] = aggregate_status([
        status["pharma"],
        status["med-societies"],
        status["med-specialties"],
        status["keywords"],
        status["sources"]
    ])
    
    return status


def aggregate_status(statuses):
    """
    Aggregate multiple statuses into one:
    - green: all green (ignoring gray)
    - yellow: at least one yellow, no red
    - red: at least one red
    - gray: all gray (not implemented)
    """
    # Filter out gray for aggregation
    active_statuses = [s for s in statuses if s != "gray"]
    
    if not active_statuses:
        return "gray"
    
    if "red" in active_statuses:
        return "red"
    
    if "yellow" in active_statuses:
        return "yellow"
    
    return "green"
