"""
Scrappers Router - LinkedIn and Pharma scrapping tools for Leaderlix
Migrated from Railway with internal database storage (no HubSpot/ClickUp)
"""
from fastapi import APIRouter, HTTPException, Depends, BackgroundTasks
from pydantic import BaseModel, HttpUrl
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone, timedelta
import uuid
import asyncio
import httpx
import os
import json
import re
from bs4 import BeautifulSoup

from database import db
from routers.auth import get_current_user

router = APIRouter(prefix="/scrappers", tags=["scrappers"])

# Default therapeutic areas (medical specialties) with LinkedIn keywords
DEFAULT_THERAPEUTIC_AREAS = [
    {"code": "oncology", "name": "Oncology", "description": "Cancer treatments and therapies", 
     "linkedin_keywords": ["oncology director", "cancer research", "medical oncologist", "oncology lead", "head of oncology", "VP oncology", "oncology business unit"]},
    {"code": "cardiology", "name": "Cardiology", "description": "Cardiovascular diseases",
     "linkedin_keywords": ["cardiology director", "cardiovascular lead", "head of cardiology", "cardiac research", "VP cardiology", "cardiovascular business unit"]},
    {"code": "neurology", "name": "Neurology", "description": "Nervous system disorders",
     "linkedin_keywords": ["neurology director", "neuroscience lead", "head of neurology", "CNS research", "VP neurology", "neuroscience business unit"]},
    {"code": "immunology", "name": "Immunology", "description": "Immune system disorders and autoimmune diseases",
     "linkedin_keywords": ["immunology director", "autoimmune lead", "head of immunology", "immunology research", "VP immunology", "I&I business unit"]},
    {"code": "infectious_disease", "name": "Infectious Disease", "description": "Bacterial, viral, and fungal infections",
     "linkedin_keywords": ["infectious disease director", "anti-infectives lead", "head of infectious disease", "virology research", "VP infectious disease"]},
    {"code": "respiratory", "name": "Respiratory", "description": "Lung and respiratory conditions",
     "linkedin_keywords": ["respiratory director", "pulmonology lead", "head of respiratory", "lung research", "VP respiratory", "respiratory business unit"]},
    {"code": "gastroenterology", "name": "Gastroenterology", "description": "Digestive system disorders",
     "linkedin_keywords": ["gastroenterology director", "GI lead", "head of gastroenterology", "digestive research", "VP gastroenterology"]},
    {"code": "endocrinology", "name": "Endocrinology", "description": "Hormonal and metabolic disorders",
     "linkedin_keywords": ["endocrinology director", "metabolic lead", "head of endocrinology", "diabetes research", "VP endocrinology", "metabolic business unit"]},
    {"code": "dermatology", "name": "Dermatology", "description": "Skin conditions",
     "linkedin_keywords": ["dermatology director", "skin research lead", "head of dermatology", "VP dermatology", "dermatology business unit"]},
    {"code": "ophthalmology", "name": "Ophthalmology", "description": "Eye diseases",
     "linkedin_keywords": ["ophthalmology director", "eye research lead", "head of ophthalmology", "VP ophthalmology", "retina research"]},
    {"code": "hematology", "name": "Hematology", "description": "Blood disorders",
     "linkedin_keywords": ["hematology director", "blood disorders lead", "head of hematology", "VP hematology", "hematology business unit"]},
    {"code": "rheumatology", "name": "Rheumatology", "description": "Joint and autoimmune diseases",
     "linkedin_keywords": ["rheumatology director", "arthritis lead", "head of rheumatology", "VP rheumatology", "musculoskeletal research"]},
    {"code": "nephrology", "name": "Nephrology", "description": "Kidney diseases",
     "linkedin_keywords": ["nephrology director", "renal lead", "head of nephrology", "kidney research", "VP nephrology"]},
    {"code": "psychiatry", "name": "Psychiatry", "description": "Mental health conditions",
     "linkedin_keywords": ["psychiatry director", "mental health lead", "head of psychiatry", "CNS psychiatry", "VP psychiatry", "behavioral health"]},
    {"code": "rare_diseases", "name": "Rare Diseases", "description": "Orphan diseases and genetic disorders",
     "linkedin_keywords": ["rare disease director", "orphan drug lead", "head of rare diseases", "genetic disorders", "VP rare diseases"]},
    {"code": "vaccines", "name": "Vaccines", "description": "Preventive vaccines and immunizations",
     "linkedin_keywords": ["vaccines director", "immunization lead", "head of vaccines", "vaccine research", "VP vaccines", "vaccine business unit"]},
    {"code": "gene_therapy", "name": "Gene Therapy", "description": "Genetic and cell therapies",
     "linkedin_keywords": ["gene therapy director", "cell therapy lead", "head of gene therapy", "CGT research", "VP gene therapy", "advanced therapies"]},
    {"code": "pain_management", "name": "Pain Management", "description": "Chronic pain and anesthesia",
     "linkedin_keywords": ["pain management director", "anesthesia lead", "head of pain", "analgesics research", "VP pain management"]},
    {"code": "womens_health", "name": "Women's Health", "description": "Gynecology and reproductive health",
     "linkedin_keywords": ["women's health director", "gynecology lead", "head of women's health", "reproductive health", "VP women's health"]},
    {"code": "urology", "name": "Urology", "description": "Urinary tract and male reproductive conditions",
     "linkedin_keywords": ["urology director", "urology lead", "head of urology", "VP urology", "men's health director"]},
]

# Development phases
DEVELOPMENT_PHASES = [
    {"code": "preclinical", "name": "Preclinical", "order": 1},
    {"code": "phase_1", "name": "Phase 1", "order": 2},
    {"code": "phase_2", "name": "Phase 2", "order": 3},
    {"code": "phase_3", "name": "Phase 3", "order": 4},
    {"code": "filed", "name": "Filed/NDA", "order": 5},
    {"code": "approved", "name": "Approved", "order": 6},
]

# Known pharma company domains
PHARMA_COMPANY_DOMAINS = {
    'pfizer': 'pfizer.com',
    'novartis': 'novartis.com',
    'roche': 'roche.com',
    'johnson & johnson': 'jnj.com',
    'merck': 'merck.com',
    'gsk': 'gsk.com',
    'glaxosmithkline': 'gsk.com',
    'astrazeneca': 'astrazeneca.com',
    'sanofi': 'sanofi.com',
    'bayer': 'bayer.com',
    'bristol myers squibb': 'bms.com',
    'bms': 'bms.com',
    'abbvie': 'abbvie.com',
    'amgen': 'amgen.com',
    'gilead': 'gilead.com',
    'eli lilly': 'lilly.com',
    'lilly': 'lilly.com',
    'boehringer ingelheim': 'boehringer-ingelheim.com',
    'takeda': 'takeda.com',
    'biogen': 'biogen.com',
    'regeneron': 'regeneron.com',
    'moderna': 'modernatx.com',
    'biontech': 'biontech.com',
}


# ============ MODELS ============

class KeywordCreate(BaseModel):
    keyword: str
    category: Optional[str] = "general"
    active: bool = True

class KeywordUpdate(BaseModel):
    keyword: Optional[str] = None
    category: Optional[str] = None
    active: Optional[bool] = None

class ScrapperConfig(BaseModel):
    scrapper_id: str
    enabled: bool = True
    interval_minutes: int = 60
    max_per_day: int = 50
    settings: Dict[str, Any] = {}

class ManualScrapeRequest(BaseModel):
    scrapper_id: str
    keywords: Optional[List[str]] = None
    profile_urls: Optional[List[str]] = None

class OpportunityCreate(BaseModel):
    source_scrapper: str
    linkedin_url: Optional[str] = None
    profile_url: Optional[str] = None
    author_name: Optional[str] = None
    author_headline: Optional[str] = None
    author_location: Optional[str] = None
    company: Optional[str] = None
    post_content: Optional[str] = None
    post_url: Optional[str] = None
    keyword_matched: Optional[str] = None
    raw_data: Dict[str, Any] = {}


# Models for Pharma Companies and Therapeutic Areas
class PharmaCompanyCreate(BaseModel):
    name: str
    domain: Optional[str] = None
    pipeline_url: Optional[str] = None
    has_research: bool = True  # Con investigación / Sin investigación
    active: bool = True
    notes: Optional[str] = None

class PharmaCompanyUpdate(BaseModel):
    name: Optional[str] = None
    domain: Optional[str] = None
    pipeline_url: Optional[str] = None
    has_research: Optional[bool] = None
    active: Optional[bool] = None
    notes: Optional[str] = None

class TherapeuticAreaCreate(BaseModel):
    code: str
    name: str
    description: Optional[str] = None
    linkedin_keywords: Optional[List[str]] = None
    active: bool = True

class TherapeuticAreaUpdate(BaseModel):
    code: Optional[str] = None
    name: Optional[str] = None
    description: Optional[str] = None
    linkedin_keywords: Optional[List[str]] = None
    active: Optional[bool] = None

class MedicationFilter(BaseModel):
    empresa: Optional[str] = None
    area_terapeutica: Optional[str] = None
    fase: Optional[str] = None


# ============ APIFY SERVICE ============

APIFY_TOKEN = os.environ.get("APIFY_TOKEN", "")

# Actor IDs from the original scrappers
APIFY_ACTORS = {
    "linkedin_posts_keywords": "buIWk2uOUzTmcLsuB",  # LinkedIn Posts by Keywords
    "linkedin_posts_profile": "A3cAPGpwBEG8RJwse",   # LinkedIn Posts from Profile
    "linkedin_profile": "2SyF0bVxmgGr8IVCZ",        # LinkedIn Profile Scraper
    "linkedin_profile_search": "harvestapi/linkedin-profile-search",  # LinkedIn Profile Search
    "google_maps": "compass/crawler-google-places",  # Google Maps Scraper
}


@router.get("/apify/status")
async def get_apify_status(current_user: dict = Depends(get_current_user)):
    """Get Apify account status including credits and usage"""
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            # Get user info
            user_response = await client.get(
                "https://api.apify.com/v2/users/me",
                headers={"Authorization": f"Bearer {APIFY_TOKEN}"}
            )
            
            if user_response.status_code != 200:
                return {
                    "success": False,
                    "error": "Could not fetch Apify status",
                    "status_code": user_response.status_code
                }
            
            user_data = user_response.json().get("data", {})
            plan = user_data.get("plan", {})
            
            # Get monthly usage
            usage_response = await client.get(
                "https://api.apify.com/v2/users/me/usage/monthly",
                headers={"Authorization": f"Bearer {APIFY_TOKEN}"}
            )
            
            usage_data = {}
            if usage_response.status_code == 200:
                usage_data = usage_response.json().get("data", {})
            
            # Calculate remaining credits
            # Use prepaidUsageUsd if available, otherwise calculate from limit
            monthly_usage = plan.get("monthlyUsageCreditsUsd", 0)
            limit_usd = plan.get("usageLimitUsd", 0)
            prepaid_usd = user_data.get("prepaidUsageUsd", 0)
            
            # If there's prepaid credit, use that as the base
            if prepaid_usd > 0:
                remaining_usd = prepaid_usd
            elif limit_usd > 0:
                remaining_usd = limit_usd - monthly_usage
            else:
                # No limit set - show monthly usage as negative (overage)
                remaining_usd = -monthly_usage if monthly_usage > 0 else 0
            
            is_limit_exceeded = plan.get("isUsageLimitExceeded", False)
            
            return {
                "success": True,
                "username": user_data.get("username"),
                "plan_name": plan.get("name", "Free" if limit_usd == 0 else "Unknown"),
                "credits": {
                    "monthly_usage_usd": monthly_usage,
                    "limit_usd": limit_usd,
                    "remaining_usd": max(remaining_usd, 0),  # Don't show negative
                    "prepaid_usd": prepaid_usd
                },
                "usage": {
                    "actor_runs": usage_data.get("actorRuns", 0),
                    "total_cost_usd": usage_data.get("totalCostUsd", 0)
                },
                "is_active": not is_limit_exceeded,
                "status": "limit_exceeded" if is_limit_exceeded else ("low" if remaining_usd < 5 else "active")
            }
    except Exception as e:
        logging.error(f"Error fetching Apify status: {e}")
        return {
            "success": False,
            "error": str(e),
            "status": "error"
        }


async def run_apify_actor(actor_id: str, input_data: dict) -> List[dict]:
    """Run an Apify actor and return results"""
    try:
        # Handle actor IDs with namespaces (e.g., "harvestapi/linkedin-profile-search" -> "harvestapi~linkedin-profile-search")
        api_actor_id = actor_id.replace("/", "~")
        
        async with httpx.AsyncClient(timeout=300.0) as client:
            # Start the actor run
            run_response = await client.post(
                f"https://api.apify.com/v2/acts/{api_actor_id}/runs",
                headers={"Authorization": f"Bearer {APIFY_TOKEN}"},
                json=input_data
            )
            
            if run_response.status_code != 201:
                raise Exception(f"Failed to start actor: {run_response.text}")
            
            run_data = run_response.json()
            run_id = run_data["data"]["id"]
            
            # Wait for the run to finish
            max_wait = 300  # 5 minutes
            waited = 0
            while waited < max_wait:
                status_response = await client.get(
                    f"https://api.apify.com/v2/actor-runs/{run_id}",
                    headers={"Authorization": f"Bearer {APIFY_TOKEN}"}
                )
                status_data = status_response.json()
                status = status_data["data"]["status"]
                
                if status == "SUCCEEDED":
                    break
                elif status in ["FAILED", "ABORTED", "TIMED-OUT"]:
                    raise Exception(f"Actor run failed with status: {status}")
                
                await asyncio.sleep(5)
                waited += 5
            
            # Get the results
            dataset_id = status_data["data"]["defaultDatasetId"]
            results_response = await client.get(
                f"https://api.apify.com/v2/datasets/{dataset_id}/items",
                headers={"Authorization": f"Bearer {APIFY_TOKEN}"}
            )
            
            return results_response.json()
            
    except Exception as e:
        print(f"Apify error: {e}")
        raise


# ============ KEYWORDS ENDPOINTS ============

@router.get("/keywords")
async def list_keywords(
    category: Optional[str] = None,
    active_only: bool = True,
    current_user: dict = Depends(get_current_user)
):
    """List all keywords"""
    query = {}
    if category:
        query["category"] = category
    if active_only:
        query["active"] = True
    
    keywords = await db.scraper_keywords.find(query, {"_id": 0}).sort("category", 1).to_list(1000)
    
    # Get categories for filtering
    categories = await db.scraper_keywords.distinct("category")
    
    return {
        "keywords": keywords,
        "total": len(keywords),
        "categories": categories
    }


@router.post("/keywords")
async def create_keyword(
    data: KeywordCreate,
    current_user: dict = Depends(get_current_user)
):
    """Create a new keyword"""
    # Check if keyword already exists
    existing = await db.scraper_keywords.find_one({"keyword": data.keyword})
    if existing:
        raise HTTPException(status_code=400, detail="Keyword already exists")
    
    keyword_doc = {
        "id": str(uuid.uuid4()),
        "keyword": data.keyword,
        "category": data.category,
        "active": data.active,
        "created_by": current_user.get("email"),
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    
    await db.scraper_keywords.insert_one(keyword_doc)
    
    # Exclude MongoDB _id from response
    keyword_doc.pop("_id", None)
    
    return {"success": True, "keyword": keyword_doc}


@router.post("/keywords/bulk")
async def create_keywords_bulk(
    keywords: List[KeywordCreate],
    current_user: dict = Depends(get_current_user)
):
    """Create multiple keywords at once"""
    created = 0
    skipped = 0
    
    for kw in keywords:
        existing = await db.scraper_keywords.find_one({"keyword": kw.keyword})
        if existing:
            skipped += 1
            continue
        
        keyword_doc = {
            "id": str(uuid.uuid4()),
            "keyword": kw.keyword,
            "category": kw.category,
            "active": kw.active,
            "created_by": current_user.get("email"),
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        await db.scraper_keywords.insert_one(keyword_doc)
        created += 1
    
    return {"success": True, "created": created, "skipped": skipped}


@router.put("/keywords/{keyword_id}")
async def update_keyword(
    keyword_id: str,
    data: KeywordUpdate,
    current_user: dict = Depends(get_current_user)
):
    """Update a keyword"""
    update_data = {k: v for k, v in data.dict().items() if v is not None}
    if not update_data:
        raise HTTPException(status_code=400, detail="No data to update")
    
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    result = await db.scraper_keywords.update_one(
        {"id": keyword_id},
        {"$set": update_data}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Keyword not found")
    
    return {"success": True}


@router.delete("/keywords/{keyword_id}")
async def delete_keyword(
    keyword_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Delete a keyword"""
    result = await db.scraper_keywords.delete_one({"id": keyword_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Keyword not found")
    return {"success": True}


# ============ CONFIGURATION ENDPOINTS ============

@router.get("/config")
async def get_all_configs(current_user: dict = Depends(get_current_user)):
    """Get all scrapper configurations"""
    configs = await db.scraper_config.find({}, {"_id": 0}).to_list(100)
    
    # Default configs if none exist
    default_configs = [
        {
            "scrapper_id": "linkedin_posts_keywords",
            "name": "LinkedIn Posts por Keywords",
            "description": "Busca posts de LinkedIn usando keywords (solo México)",
            "enabled": False,
            "interval_minutes": 60,
            "max_per_day": 10,
            "settings": {
                "author_location": "Mexico",
                "max_posts_per_keyword": 20
            }
        },
        {
            "scrapper_id": "linkedin_posts_profile",
            "name": "LinkedIn Posts por Perfil",
            "description": "Extrae posts de perfiles específicos de LinkedIn",
            "enabled": False,
            "interval_minutes": 60,
            "max_per_day": 50,
            "settings": {
                "max_posts": 5,
                "include_reposts": False
            }
        },
        {
            "scrapper_id": "linkedin_cargos",
            "name": "LinkedIn Cargos",
            "description": "Extrae información de cargos y posiciones",
            "enabled": False,
            "interval_minutes": 120,
            "max_per_day": 30,
            "settings": {}
        },
        {
            "scrapper_id": "dealmakers",
            "name": "Dealmakers",
            "description": "Extrae perfiles de LinkedIn desde oportunidades existentes",
            "enabled": False,
            "interval_minutes": 60,
            "max_per_day": 100,
            "settings": {}
        },
        {
            "scrapper_id": "pharma_pipelines",
            "name": "Pharma Pipelines",
            "description": "Extrae medicamentos de pipelines de empresas farmacéuticas",
            "enabled": False,
            "interval_minutes": 4320,  # Every 3 days
            "max_per_day": 500,
            "settings": {}
        },
    ]
    
    # Return existing configs merged with defaults
    existing_ids = {c["scrapper_id"] for c in configs}
    for default in default_configs:
        if default["scrapper_id"] not in existing_ids:
            configs.append(default)
    
    return {"configs": configs}


@router.put("/config/{scrapper_id}")
async def update_config(
    scrapper_id: str,
    data: ScrapperConfig,
    current_user: dict = Depends(get_current_user)
):
    """Update scrapper configuration"""
    config_doc = {
        "scrapper_id": scrapper_id,
        "enabled": data.enabled,
        "interval_minutes": data.interval_minutes,
        "max_per_day": data.max_per_day,
        "settings": data.settings,
        "updated_by": current_user.get("email"),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    
    await db.scraper_config.update_one(
        {"scrapper_id": scrapper_id},
        {"$set": config_doc},
        upsert=True
    )
    
    return {"success": True, "config": config_doc}


# ============ OPPORTUNITIES ENDPOINTS ============

@router.get("/opportunities")
async def list_opportunities(
    source: Optional[str] = None,
    status: Optional[str] = None,
    limit: int = 100,
    skip: int = 0,
    current_user: dict = Depends(get_current_user)
):
    """List all opportunities (scrapped contacts/posts)"""
    query = {}
    if source:
        query["source_scrapper"] = source
    if status:
        query["status"] = status
    
    opportunities = await db.scraper_opportunities.find(
        query, {"_id": 0}
    ).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    
    total = await db.scraper_opportunities.count_documents(query)
    
    # Get stats by source
    pipeline = [
        {"$group": {"_id": "$source_scrapper", "count": {"$sum": 1}}}
    ]
    stats_by_source = await db.scraper_opportunities.aggregate(pipeline).to_list(100)
    
    return {
        "opportunities": opportunities,
        "total": total,
        "stats_by_source": {s["_id"]: s["count"] for s in stats_by_source}
    }


@router.get("/opportunities/{opportunity_id}")
async def get_opportunity(
    opportunity_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get a specific opportunity"""
    opp = await db.scraper_opportunities.find_one({"id": opportunity_id}, {"_id": 0})
    if not opp:
        raise HTTPException(status_code=404, detail="Opportunity not found")
    return opp


@router.put("/opportunities/{opportunity_id}/status")
async def update_opportunity_status(
    opportunity_id: str,
    status: str,
    current_user: dict = Depends(get_current_user)
):
    """Update opportunity status"""
    valid_statuses = ["new", "contacted", "qualified", "converted", "discarded"]
    if status not in valid_statuses:
        raise HTTPException(status_code=400, detail=f"Invalid status. Use: {valid_statuses}")
    
    result = await db.scraper_opportunities.update_one(
        {"id": opportunity_id},
        {"$set": {"status": status, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Opportunity not found")
    
    return {"success": True, "status": status}


@router.delete("/opportunities/{opportunity_id}")
async def delete_opportunity(
    opportunity_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Delete an opportunity"""
    result = await db.scraper_opportunities.delete_one({"id": opportunity_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Opportunity not found")
    return {"success": True}


# ============ LOGS ENDPOINTS ============

@router.get("/logs")
async def list_logs(
    scrapper_id: Optional[str] = None,
    level: Optional[str] = None,
    limit: int = 100,
    current_user: dict = Depends(get_current_user)
):
    """List scrapper logs"""
    query = {}
    if scrapper_id:
        query["scrapper_id"] = scrapper_id
    if level:
        query["level"] = level
    
    logs = await db.scraper_logs.find(
        query, {"_id": 0}
    ).sort("timestamp", -1).limit(limit).to_list(limit)
    
    return {"logs": logs, "total": len(logs)}


@router.get("/logs/runs")
async def list_runs(
    scrapper_id: Optional[str] = None,
    limit: int = 50,
    current_user: dict = Depends(get_current_user)
):
    """List scrapper run history"""
    query = {}
    if scrapper_id:
        query["scrapper_id"] = scrapper_id
    
    runs = await db.scraper_runs.find(
        query, {"_id": 0}
    ).sort("started_at", -1).limit(limit).to_list(limit)
    
    return {"runs": runs, "total": len(runs)}


async def log_scrapper_event(
    scrapper_id: str,
    level: str,
    message: str,
    details: Dict[str, Any] = None,
    run_id: str = None
):
    """Log a scrapper event"""
    log_doc = {
        "id": str(uuid.uuid4()),
        "scrapper_id": scrapper_id,
        "run_id": run_id,
        "level": level,  # INFO, WARN, ERROR, SUCCESS
        "message": message,
        "details": details or {},
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
    await db.scraper_logs.insert_one(log_doc)
    return log_doc


# ============ SCRAPPER EXECUTION ENDPOINTS ============

@router.post("/run/{scrapper_id}")
async def run_scrapper_manually(
    scrapper_id: str,
    background_tasks: BackgroundTasks,
    request: ManualScrapeRequest = None,
    current_user: dict = Depends(get_current_user)
):
    """Manually trigger a scrapper run"""
    
    # Create run record
    run_id = str(uuid.uuid4())
    run_doc = {
        "id": run_id,
        "scrapper_id": scrapper_id,
        "status": "running",
        "started_at": datetime.now(timezone.utc).isoformat(),
        "started_by": current_user.get("email"),
        "results": {}
    }
    await db.scraper_runs.insert_one(run_doc)
    
    await log_scrapper_event(scrapper_id, "INFO", f"Manual run started by {current_user.get('email')}", run_id=run_id)
    
    # Run in background
    if scrapper_id == "linkedin_posts_keywords":
        background_tasks.add_task(run_linkedin_posts_keywords_scrapper, run_id, request)
    elif scrapper_id == "linkedin_posts_profile":
        background_tasks.add_task(run_linkedin_posts_profile_scrapper, run_id, request)
    elif scrapper_id == "dealmakers":
        background_tasks.add_task(run_dealmakers_scrapper, run_id, request)
    elif scrapper_id == "pharma_pipelines":
        background_tasks.add_task(run_pharma_pipelines_scrapper, run_id, request)
    else:
        await db.scraper_runs.update_one(
            {"id": run_id},
            {"$set": {"status": "failed", "error": "Unknown scrapper"}}
        )
        raise HTTPException(status_code=400, detail="Unknown scrapper")
    
    return {"success": True, "run_id": run_id, "message": "Scrapper started in background"}


@router.get("/run/{run_id}/status")
async def get_run_status(
    run_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get status of a scrapper run"""
    run = await db.scraper_runs.find_one({"id": run_id}, {"_id": 0})
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")
    return run


# ============ SCRAPPER IMPLEMENTATIONS ============

async def run_linkedin_posts_keywords_scrapper(run_id: str, request: ManualScrapeRequest = None):
    """LinkedIn Posts by Keywords Scrapper"""
    scrapper_id = "linkedin_posts_keywords"
    
    try:
        # Get keywords
        if request and request.keywords:
            keywords = request.keywords
        else:
            kw_docs = await db.scraper_keywords.find({"active": True}, {"_id": 0}).to_list(100)
            keywords = [k["keyword"] for k in kw_docs]
        
        if not keywords:
            await log_scrapper_event(scrapper_id, "WARN", "No keywords found", run_id=run_id)
            await db.scraper_runs.update_one(
                {"id": run_id},
                {"$set": {"status": "completed", "results": {"message": "No keywords"}}}
            )
            return
        
        await log_scrapper_event(scrapper_id, "INFO", f"Processing {len(keywords)} keywords", run_id=run_id)
        
        total_posts = 0
        total_opportunities = 0
        
        # Get config
        config = await db.scraper_config.find_one({"scrapper_id": scrapper_id})
        max_posts_per_keyword = config.get("settings", {}).get("max_posts_per_keyword", 20) if config else 20
        author_location = config.get("settings", {}).get("author_location", "Mexico") if config else "Mexico"
        
        for keyword in keywords[:10]:  # Limit to 10 keywords per run
            try:
                await log_scrapper_event(scrapper_id, "INFO", f"Searching for: {keyword}", run_id=run_id)
                
                # Call Apify actor
                input_data = {
                    "searchKeywords": [keyword],
                    "limitPerSearch": max_posts_per_keyword,
                    "authorLocation": author_location,
                    "profileScraperMode": "short",
                    "scrapeReactions": False,
                    "scrapeComments": False,
                    "includeReposts": False,
                }
                
                results = await run_apify_actor(APIFY_ACTORS["linkedin_posts_keywords"], input_data)
                
                for post in results:
                    # Check for duplicates
                    post_url = post.get("url") or post.get("postUrl")
                    if post_url:
                        existing = await db.scraper_opportunities.find_one({"post_url": post_url})
                        if existing:
                            continue
                    
                    # Create opportunity
                    opp_doc = {
                        "id": str(uuid.uuid4()),
                        "source_scrapper": scrapper_id,
                        "keyword_matched": keyword,
                        "author_name": post.get("authorName") or post.get("author", {}).get("name"),
                        "author_headline": post.get("authorHeadline") or post.get("author", {}).get("headline"),
                        "author_location": post.get("authorLocation") or post.get("author", {}).get("location"),
                        "profile_url": post.get("authorProfileUrl") or post.get("author", {}).get("profileUrl"),
                        "company": post.get("authorCompany") or post.get("author", {}).get("company"),
                        "post_url": post_url,
                        "post_content": (post.get("text") or post.get("content", ""))[:2000],
                        "post_date": post.get("postedAt") or post.get("date"),
                        "reactions": post.get("numLikes") or post.get("reactions"),
                        "comments": post.get("numComments") or post.get("comments"),
                        "status": "new",
                        "raw_data": post,
                        "created_at": datetime.now(timezone.utc).isoformat(),
                    }
                    
                    await db.scraper_opportunities.insert_one(opp_doc)
                    total_opportunities += 1
                
                total_posts += len(results)
                await log_scrapper_event(
                    scrapper_id, "SUCCESS",
                    f"Keyword '{keyword}': Found {len(results)} posts",
                    {"keyword": keyword, "posts_found": len(results)},
                    run_id=run_id
                )
                
            except Exception as e:
                await log_scrapper_event(
                    scrapper_id, "ERROR",
                    f"Error processing keyword '{keyword}': {str(e)}",
                    run_id=run_id
                )
        
        # Update run status
        await db.scraper_runs.update_one(
            {"id": run_id},
            {"$set": {
                "status": "completed",
                "completed_at": datetime.now(timezone.utc).isoformat(),
                "results": {
                    "keywords_processed": len(keywords[:10]),
                    "total_posts_found": total_posts,
                    "opportunities_created": total_opportunities
                }
            }}
        )
        
        await log_scrapper_event(
            scrapper_id, "SUCCESS",
            f"Run completed. Created {total_opportunities} opportunities from {total_posts} posts",
            run_id=run_id
        )
        
    except Exception as e:
        await log_scrapper_event(scrapper_id, "ERROR", f"Run failed: {str(e)}", run_id=run_id)
        await db.scraper_runs.update_one(
            {"id": run_id},
            {"$set": {"status": "failed", "error": str(e)}}
        )


async def run_linkedin_posts_profile_scrapper(run_id: str, request: ManualScrapeRequest = None):
    """LinkedIn Posts from Profile Scrapper"""
    scrapper_id = "linkedin_posts_profile"
    
    try:
        profile_urls = request.profile_urls if request and request.profile_urls else []
        
        if not profile_urls:
            await log_scrapper_event(scrapper_id, "WARN", "No profile URLs provided", run_id=run_id)
            await db.scraper_runs.update_one(
                {"id": run_id},
                {"$set": {"status": "completed", "results": {"message": "No profiles"}}}
            )
            return
        
        await log_scrapper_event(scrapper_id, "INFO", f"Processing {len(profile_urls)} profiles", run_id=run_id)
        
        # Get config
        config = await db.scraper_config.find_one({"scrapper_id": scrapper_id})
        max_posts = config.get("settings", {}).get("max_posts", 5) if config else 5
        
        total_posts = 0
        total_opportunities = 0
        
        # Call Apify actor
        input_data = {
            "profileUrls": profile_urls,
            "maxPosts": max_posts,
            "includeQuotePosts": True,
            "includeReposts": False,
            "scrapeReactions": False,
            "scrapeComments": False,
        }
        
        results = await run_apify_actor(APIFY_ACTORS["linkedin_posts_profile"], input_data)
        
        for post in results:
            post_url = post.get("url") or post.get("postUrl")
            if post_url:
                existing = await db.scraper_opportunities.find_one({"post_url": post_url})
                if existing:
                    continue
            
            opp_doc = {
                "id": str(uuid.uuid4()),
                "source_scrapper": scrapper_id,
                "author_name": post.get("authorName") or post.get("author", {}).get("name"),
                "author_headline": post.get("authorHeadline"),
                "profile_url": post.get("authorProfileUrl") or post.get("profileUrl"),
                "post_url": post_url,
                "post_content": (post.get("text") or "")[:2000],
                "post_date": post.get("postedAt"),
                "reactions": post.get("numLikes"),
                "comments": post.get("numComments"),
                "status": "new",
                "raw_data": post,
                "created_at": datetime.now(timezone.utc).isoformat(),
            }
            
            await db.scraper_opportunities.insert_one(opp_doc)
            total_opportunities += 1
        
        total_posts = len(results)
        
        await db.scraper_runs.update_one(
            {"id": run_id},
            {"$set": {
                "status": "completed",
                "completed_at": datetime.now(timezone.utc).isoformat(),
                "results": {
                    "profiles_processed": len(profile_urls),
                    "total_posts_found": total_posts,
                    "opportunities_created": total_opportunities
                }
            }}
        )
        
        await log_scrapper_event(
            scrapper_id, "SUCCESS",
            f"Run completed. Created {total_opportunities} opportunities",
            run_id=run_id
        )
        
    except Exception as e:
        await log_scrapper_event(scrapper_id, "ERROR", f"Run failed: {str(e)}", run_id=run_id)
        await db.scraper_runs.update_one(
            {"id": run_id},
            {"$set": {"status": "failed", "error": str(e)}}
        )


async def run_dealmakers_scrapper(run_id: str, request: ManualScrapeRequest = None):
    """Dealmakers Scrapper - Extract profiles from existing opportunities"""
    scrapper_id = "dealmakers"
    
    try:
        # Get opportunities that have profile_url but not fully scraped
        opportunities = await db.scraper_opportunities.find(
            {"profile_url": {"$exists": True, "$ne": None}, "profile_scraped": {"$ne": True}},
            {"_id": 0}
        ).limit(50).to_list(50)
        
        if not opportunities:
            await log_scrapper_event(scrapper_id, "INFO", "No opportunities to process", run_id=run_id)
            await db.scraper_runs.update_one(
                {"id": run_id},
                {"$set": {"status": "completed", "results": {"message": "No opportunities"}}}
            )
            return
        
        await log_scrapper_event(scrapper_id, "INFO", f"Processing {len(opportunities)} profiles", run_id=run_id)
        
        profile_urls = [o["profile_url"] for o in opportunities if o.get("profile_url")]
        
        if not profile_urls:
            await db.scraper_runs.update_one(
                {"id": run_id},
                {"$set": {"status": "completed", "results": {"message": "No valid URLs"}}}
            )
            return
        
        # Scrape profiles
        input_data = {
            "profileUrls": profile_urls,
        }
        
        results = await run_apify_actor(APIFY_ACTORS["linkedin_profile"], input_data)
        
        profiles_updated = 0
        for profile in results:
            profile_url = profile.get("url") or profile.get("profileUrl")
            if not profile_url:
                continue
            
            # Update the opportunity with profile data
            update_data = {
                "profile_scraped": True,
                "full_name": profile.get("fullName") or profile.get("name"),
                "headline": profile.get("headline"),
                "location": profile.get("location"),
                "connections": profile.get("connectionsCount"),
                "followers": profile.get("followersCount"),
                "about": profile.get("about"),
                "experience": profile.get("experience", [])[:5],
                "education": profile.get("education", [])[:3],
                "skills": profile.get("skills", [])[:10],
                "profile_raw_data": profile,
                "profile_scraped_at": datetime.now(timezone.utc).isoformat(),
            }
            
            result = await db.scraper_opportunities.update_one(
                {"profile_url": profile_url},
                {"$set": update_data}
            )
            
            if result.modified_count > 0:
                profiles_updated += 1
        
        await db.scraper_runs.update_one(
            {"id": run_id},
            {"$set": {
                "status": "completed",
                "completed_at": datetime.now(timezone.utc).isoformat(),
                "results": {
                    "profiles_processed": len(profile_urls),
                    "profiles_updated": profiles_updated
                }
            }}
        )
        
        await log_scrapper_event(
            scrapper_id, "SUCCESS",
            f"Run completed. Updated {profiles_updated} profiles",
            run_id=run_id
        )
        
    except Exception as e:
        await log_scrapper_event(scrapper_id, "ERROR", f"Run failed: {str(e)}", run_id=run_id)
        await db.scraper_runs.update_one(
            {"id": run_id},
            {"$set": {"status": "failed", "error": str(e)}}
        )


async def run_pharma_pipelines_scrapper(run_id: str, request: ManualScrapeRequest = None):
    """Pharma Pipelines Scrapper - Extract medications from pharma company pipelines"""
    scrapper_id = "pharma_pipelines"
    
    try:
        await log_scrapper_event(scrapper_id, "INFO", "Pharma pipelines scrapper started", run_id=run_id)
        
        # Get pharma companies to scrape from config or use defaults
        companies = await get_pharma_companies_to_scrape()
        
        if not companies:
            await log_scrapper_event(scrapper_id, "WARN", "No pharma companies configured for scraping", run_id=run_id)
            await db.scraper_runs.update_one(
                {"id": run_id},
                {"$set": {
                    "status": "completed",
                    "completed_at": datetime.now(timezone.utc).isoformat(),
                    "results": {"message": "No companies configured", "medications_found": 0}
                }}
            )
            return
        
        await log_scrapper_event(scrapper_id, "INFO", f"Processing {len(companies)} pharma companies", run_id=run_id)
        
        total_medications = 0
        total_phase_changes = 0
        processed_companies = 0
        
        for company in companies:
            company_name = company.get("name", "Unknown")
            try:
                await log_scrapper_event(scrapper_id, "INFO", f"Processing: {company_name}", run_id=run_id)
                
                # Find pipeline URLs for the company (pass company data for configured URLs)
                urls = await find_pharma_pipeline_urls(company_name, company)
                
                if not urls:
                    await log_scrapper_event(scrapper_id, "WARN", f"No URLs found for {company_name}", run_id=run_id)
                    continue
                
                await log_scrapper_event(scrapper_id, "INFO", f"Found {len(urls)} URLs for {company_name}: {urls[0]}", run_id=run_id)
                
                company_medications = []
                
                # Scrape each URL until we get content
                for url in urls[:3]:  # Limit to 3 URLs per company
                    try:
                        await log_scrapper_event(scrapper_id, "INFO", f"Scraping: {url}", run_id=run_id)
                        
                        # Scrape the webpage
                        content = await scrape_pharma_website(url)
                        
                        if not content or len(content) < 500:
                            await log_scrapper_event(scrapper_id, "WARN", f"Content too short ({len(content) if content else 0} chars) for {url}", run_id=run_id)
                            continue
                        
                        await log_scrapper_event(scrapper_id, "INFO", f"Got {len(content)} chars from {url}", run_id=run_id)
                        
                        # Extract medications using LLM
                        medications = await extract_medications_with_llm(content, url, company_name)
                        
                        if medications:
                            company_medications.extend(medications)
                            await log_scrapper_event(
                                scrapper_id, "SUCCESS", 
                                f"Extracted {len(medications)} medications from {url}",
                                run_id=run_id
                            )
                            # Once we get medications, we can stop trying more URLs for this company
                            break
                        
                    except Exception as url_error:
                        await log_scrapper_event(scrapper_id, "WARN", f"Error scraping {url}: {str(url_error)}", run_id=run_id)
                        continue
                
                # Process and save medications, detect phase changes
                if company_medications:
                    phase_changes = await process_pharma_medications(company_medications, company_name, scrapper_id, run_id)
                    total_medications += len(company_medications)
                    total_phase_changes += phase_changes
                    
                processed_companies += 1
                
            except Exception as company_error:
                await log_scrapper_event(scrapper_id, "ERROR", f"Error processing {company_name}: {str(company_error)}", run_id=run_id)
                continue
        
        # Update run status
        await db.scraper_runs.update_one(
            {"id": run_id},
            {"$set": {
                "status": "completed",
                "completed_at": datetime.now(timezone.utc).isoformat(),
                "results": {
                    "companies_processed": processed_companies,
                    "medications_found": total_medications,
                    "phase_changes_detected": total_phase_changes,
                    "opportunities_created": total_phase_changes
                }
            }}
        )
        
        await log_scrapper_event(
            scrapper_id, "SUCCESS",
            f"Completed. Processed {processed_companies} companies, found {total_medications} medications, {total_phase_changes} phase changes",
            run_id=run_id
        )
        
    except Exception as e:
        await log_scrapper_event(scrapper_id, "ERROR", f"Run failed: {str(e)}", run_id=run_id)
        await db.scraper_runs.update_one(
            {"id": run_id},
            {"$set": {"status": "failed", "error": str(e)}}
        )


@router.post("/pharma/scrape-company/{company_id}")
async def scrape_single_company(
    company_id: str,
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(get_current_user)
):
    """Scrape pipeline for a single company"""
    # Find the company
    company = await db.companies.find_one(
        {"$or": [{"hubspot_id": company_id}, {"name": company_id}], "industry": "PHARMACEUTICALS"},
        {"_id": 0}
    )
    
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    
    pipeline_url = company.get("pharma_pipeline_url")
    if not pipeline_url:
        raise HTTPException(status_code=400, detail="Company has no pipeline URL configured")
    
    company_name = company.get("name")
    
    # Update status to running
    await db.companies.update_one(
        {"$or": [{"hubspot_id": company_id}, {"name": company_id}]},
        {"$set": {
            "pharma_scrape_status": "running",
            "pharma_last_scrape": datetime.now(timezone.utc).isoformat(),
            "pharma_scrape_error": None
        }}
    )
    
    # Run in background
    background_tasks.add_task(run_single_company_scrape, company_id, company_name, pipeline_url)
    
    return {
        "success": True,
        "message": f"Started scraping pipeline for {company_name}",
        "company": company_name,
        "pipeline_url": pipeline_url
    }


async def run_single_company_scrape(company_id: str, company_name: str, pipeline_url: str):
    """Background task to scrape a single company's pipeline"""
    scrapper_id = "pharma_pipelines_single"
    
    try:
        # Scrape the webpage
        content = await scrape_pharma_website(pipeline_url)
        
        if not content or len(content) < 500:
            await db.companies.update_one(
                {"$or": [{"hubspot_id": company_id}, {"name": company_id}]},
                {"$set": {
                    "pharma_scrape_status": "failed",
                    "pharma_scrape_error": f"Content too short ({len(content) if content else 0} chars)"
                }}
            )
            return
        
        # Extract medications using LLM
        medications = await extract_medications_with_llm(content, pipeline_url, company_name)
        
        if not medications:
            await db.companies.update_one(
                {"$or": [{"hubspot_id": company_id}, {"name": company_id}]},
                {"$set": {
                    "pharma_scrape_status": "completed",
                    "pharma_scrape_error": "No medications found in pipeline page"
                }}
            )
            return
        
        # Process and save medications
        phase_changes = await process_pharma_medications(medications, company_name, scrapper_id, None)
        
        # Update company status
        await db.companies.update_one(
            {"$or": [{"hubspot_id": company_id}, {"name": company_id}]},
            {"$set": {
                "pharma_scrape_status": "success",
                "pharma_scrape_error": None,
                "pharma_medications_found": len(medications),
                "pharma_phase_changes": phase_changes
            }}
        )
        
    except Exception as e:
        await db.companies.update_one(
            {"$or": [{"hubspot_id": company_id}, {"name": company_id}]},
            {"$set": {
                "pharma_scrape_status": "failed",
                "pharma_scrape_error": str(e)
            }}
        )


async def get_pharma_companies_to_scrape():
    """Get list of pharma companies to scrape from main companies collection
    ONLY those with pipeline_url configured and has_research=True"""
    # Query the main companies collection for pharmaceuticals
    query = {
        "is_active": True,
        "industry": "PHARMACEUTICALS",
        "pharma_has_research": True,
        "pharma_pipeline_url": {"$ne": "", "$exists": True, "$ne": None}
    }
    
    companies = await db.companies.find(query, {"_id": 0}).to_list(200)
    
    # Map fields for compatibility with scrapper
    result = []
    for c in companies:
        result.append({
            "id": c.get("hubspot_id"),
            "name": c.get("name"),
            "domain": c.get("domain"),
            "pipeline_url": c.get("pharma_pipeline_url", ""),
            "has_research": c.get("pharma_has_research", False),
            "active": c.get("is_active", True),
        })
    
    return result


# Known working pipeline URLs for major pharma companies
KNOWN_PIPELINE_URLS = {
    'pfizer': [
        'https://www.pfizer.com/science/drug-product-pipeline',
        'https://www.pfizer.com/science/clinical-trials/pipeline'
    ],
    'novartis': [
        'https://www.novartis.com/research-development/novartis-pipeline',
        'https://www.novartis.com/investors/novartis-pipeline'
    ],
    'roche': [
        'https://www.roche.com/solutions/pipeline',
        'https://www.roche.com/about/business/pharmaceuticals/pipeline'
    ],
    'astrazeneca': [
        'https://www.astrazeneca.com/our-therapy-areas/pipeline.html',
        'https://www.astrazeneca.com/r-d/pipeline.html'
    ],
    'merck': [
        'https://www.merck.com/research/pipeline/',
        'https://www.merck.com/company-overview/pipeline/'
    ],
    'sanofi': [
        'https://www.sanofi.com/en/our-science/research-and-development/pipeline',
        'https://www.sanofi.com/en/science-and-innovation/research-and-development'
    ],
    'bms': [
        'https://www.bms.com/researchers-and-partners/in-the-pipeline.html',
        'https://www.bms.com/about-us/our-company/our-pipeline.html'
    ],
    'bristol myers squibb': [
        'https://www.bms.com/researchers-and-partners/in-the-pipeline.html'
    ],
    'abbvie': [
        'https://www.abbviescience.com/en/pipeline.html',
        'https://www.abbvie.com/science/pipeline.html'
    ],
    'eli lilly': [
        'https://www.lilly.com/science/research-development/pipeline',
        'https://investor.lilly.com/pipeline'
    ],
    'lilly': [
        'https://www.lilly.com/science/research-development/pipeline'
    ],
    'takeda': [
        'https://www.takeda.com/science/pipeline/',
        'https://www.takedaoncology.com/science/pipeline/'
    ],
    'johnson & johnson': [
        'https://www.investor.jnj.com/pipeline/Innovative-Medicine-pipeline/default.aspx',
        'https://www.investor.jnj.com/pipeline/development-pipeline/default.aspx'
    ],
    'jnj': [
        'https://www.investor.jnj.com/pipeline/Innovative-Medicine-pipeline/default.aspx'
    ],
    'janssen': [
        'https://www.investor.jnj.com/pipeline/Innovative-Medicine-pipeline/default.aspx'
    ],
    'gsk': [
        'https://www.gsk.com/en-gb/research-and-development/pipeline/',
        'https://www.gsk.com/en-gb/innovation/pipeline/'
    ],
    'glaxosmithkline': [
        'https://www.gsk.com/en-gb/research-and-development/pipeline/'
    ],
    'bayer': [
        'https://www.bayer.com/en/pharma/our-focus-areas',
        'https://pharma.bayer.com/pipeline'
    ],
    'amgen': [
        'https://www.amgenpipeline.com',
        'https://www.amgen.com/science-research/research-and-development'
    ],
    'gilead': [
        'https://www.gilead.com/science-and-medicine/pipeline',
        'https://www.gilead.com/science/pipeline'
    ],
    'biogen': [
        'https://www.biogen.com/science-and-innovation/pipeline.html',
        'https://www.biogen.com/en_us/pipeline.html'
    ],
    'regeneron': [
        'https://www.regeneron.com/pipeline-medicines',
        'https://www.regeneron.com/science/pipeline'
    ],
    'moderna': [
        'https://www.modernatx.com/research/product-pipeline',
        'https://www.modernatx.com/pipeline'
    ],
    'boehringer ingelheim': [
        'https://www.boehringer-ingelheim.com/human-health/pipeline',
        'https://www.boehringer-ingelheim.com/science/pipeline'
    ],
}


async def find_pharma_pipeline_urls(company_name: str, company_data: dict = None) -> List[str]:
    """Find pipeline URLs for a pharma company"""
    urls = []
    
    # First check if company has a configured pipeline_url in database
    if company_data and company_data.get("pipeline_url"):
        urls.append(company_data["pipeline_url"])
    
    # Check known pipeline URLs
    company_lower = company_name.lower().strip()
    
    # Try exact match first
    if company_lower in KNOWN_PIPELINE_URLS:
        urls.extend(KNOWN_PIPELINE_URLS[company_lower])
    else:
        # Try partial match
        for key, known_urls in KNOWN_PIPELINE_URLS.items():
            if key in company_lower or company_lower in key:
                urls.extend(known_urls)
                break
    
    # If still no URLs, try to construct from domain
    if not urls:
        domain = PHARMA_COMPANY_DOMAINS.get(company_lower)
        if not domain:
            for key, dom in PHARMA_COMPANY_DOMAINS.items():
                if key in company_lower or company_lower in key:
                    domain = dom
                    break
        
        if domain:
            # Common pipeline URL patterns
            pipeline_paths = [
                "/science/pipeline",
                "/pipeline",
                "/research/pipeline",
                "/our-science/pipeline",
                "/research-development/pipeline",
            ]
            for path in pipeline_paths:
                urls.append(f"https://www.{domain}{path}")
    
    # Remove duplicates while preserving order
    seen = set()
    unique_urls = []
    for url in urls:
        if url not in seen:
            seen.add(url)
            unique_urls.append(url)
    
    return unique_urls[:5]  # Limit to 5 URLs per company


async def scrape_pharma_website(url: str) -> str:
    """Scrape a pharma pipeline webpage and extract text content.
    Uses Playwright for JavaScript-heavy sites that block simple requests."""
    
    # List of user agents for rotation
    USER_AGENTS = [
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15',
        'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    ]
    
    # Sites known to block simple requests - use Playwright
    PLAYWRIGHT_REQUIRED_DOMAINS = [
        'abbvie.com', 'bayer.com', 'lilly.com', 'biogen.com',
        'regeneron.com', 'investor.jnj.com', 'amgenpipeline.com'
    ]
    
    # Check if Playwright is needed for this domain
    use_playwright = any(domain in url.lower() for domain in PLAYWRIGHT_REQUIRED_DOMAINS)
    
    if use_playwright:
        return await scrape_with_playwright(url)
    
    # Try simple httpx first
    try:
        import random
        headers = {
            'User-Agent': random.choice(USER_AGENTS),
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9',
            'Accept-Encoding': 'gzip, deflate',
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1',
            'Cache-Control': 'max-age=0',
            'Sec-Fetch-Dest': 'document',
            'Sec-Fetch-Mode': 'navigate',
            'Sec-Fetch-Site': 'none',
            'Sec-Fetch-User': '?1',
        }
        
        # Add random delay to avoid rate limiting
        await asyncio.sleep(random.uniform(1.0, 3.0))
        
        async with httpx.AsyncClient(timeout=30.0, follow_redirects=True) as client:
            response = await client.get(url, headers=headers)
            
            # If blocked, try with Playwright
            if response.status_code == 403:
                print(f"Blocked (403) for {url} - trying Playwright")
                return await scrape_with_playwright(url)
            
            if response.status_code != 200:
                print(f"HTTP {response.status_code} for {url}")
                return ""
            
            html = response.text
            
            # Check if content looks like compressed/binary data
            if html and (html[0] in ['\x1f', '\x8b', ''] or not html.strip().startswith('<')):
                try:
                    headers_no_compress = {**headers, 'Accept-Encoding': 'identity'}
                    response = await client.get(url, headers=headers_no_compress)
                    html = response.text
                except Exception:
                    pass
            
            if not html or (not html.strip().startswith('<!') and not html.strip().startswith('<')):
                return ""
            
            return extract_text_from_html(html)
            
    except Exception as e:
        print(f"Error scraping {url} with httpx: {e} - trying Playwright")
        return await scrape_with_playwright(url)


async def scrape_with_playwright(url: str) -> str:
    """Use Playwright to scrape JavaScript-heavy pages that block simple requests"""
    try:
        from playwright.async_api import async_playwright
        import random
        
        USER_AGENTS = [
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        ]
        
        async with async_playwright() as p:
            browser = await p.chromium.launch(
                headless=True,
                args=['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
            )
            
            context = await browser.new_context(
                user_agent=random.choice(USER_AGENTS),
                viewport={'width': 1920, 'height': 1080},
                locale='en-US',
            )
            
            page = await context.new_page()
            
            # Add stealth modifications
            await page.add_init_script("""
                Object.defineProperty(navigator, 'webdriver', {get: () => undefined});
                Object.defineProperty(navigator, 'plugins', {get: () => [1, 2, 3, 4, 5]});
            """)
            
            try:
                await page.goto(url, wait_until='networkidle', timeout=45000)
                await page.wait_for_timeout(2000)  # Wait for dynamic content
                
                # Scroll to load lazy content
                await page.evaluate("window.scrollTo(0, document.body.scrollHeight / 2)")
                await page.wait_for_timeout(1000)
                
                html = await page.content()
                await browser.close()
                
                if html:
                    print(f"Successfully scraped {url} with Playwright")
                    return extract_text_from_html(html)
                return ""
                
            except Exception as e:
                print(f"Playwright error for {url}: {e}")
                await browser.close()
                return ""
                
    except Exception as e:
        print(f"Playwright setup error for {url}: {e}")
        return ""


def extract_text_from_html(html: str) -> str:
    """Extract clean text from HTML content"""
    soup = BeautifulSoup(html, 'html.parser')
    
    # Remove unwanted elements
    for element in soup(['script', 'style', 'nav', 'footer', 'header', 'iframe', 'noscript', 'aside', 'svg']):
        element.decompose()
    
    # Extract text
    text = soup.get_text(separator=' ', strip=True)
    
    # Clean up whitespace
    text = re.sub(r'\s+', ' ', text)
    
    return text[:30000]  # Limit content length


async def extract_medications_with_llm(content: str, url: str, company_name: str) -> List[Dict]:
    """Use LLM to extract medication data from scraped content"""
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage
        from dotenv import load_dotenv
        load_dotenv()
        
        api_key = os.environ.get("EMERGENT_LLM_KEY")
        if not api_key:
            print("EMERGENT_LLM_KEY not found")
            return []
        
        # Get registered therapeutic areas from database
        db_areas = await db.therapeutic_areas.find({"active": True}, {"_id": 0, "name": 1}).to_list(50)
        area_names = [a["name"] for a in db_areas] if db_areas else [a["name"] for a in DEFAULT_THERAPEUTIC_AREAS]
        areas_list = ", ".join(area_names)
        
        # Truncate content for LLM
        truncated_content = content[:15000]
        
        prompt = f"""Analyze this pharmaceutical pipeline content and extract medications/drugs in development.

CONTENT FROM {company_name}:
{truncated_content}

EXTRACT ONLY:
✅ Medications/drugs (e.g., "Pembrolizumab", "Keytruda")
✅ Molecules/compounds (e.g., "PF-07321332", "BNT162b2")  
✅ Biologic therapies (antibodies, therapeutic vaccines)
✅ Gene or cell therapies
✅ Any product in CLINICAL DEVELOPMENT (Phase I/II/III) or approved

❌ DO NOT extract:
- Cosmetic products
- Nutritional supplements
- Medical devices
- Consumer products

For each medication found, provide:
- molecula: medication/molecule name
- area_terapeutica: therapeutic area. MUST be one of: {areas_list}
- fase: development phase (Preclinical, Phase 1, Phase 2, Phase 3, Filed, Approved)

Respond ONLY with valid JSON:
{{"productos": [{{"molecula": "name", "area_terapeutica": "area", "fase": "phase"}}]}}

If no medications found, respond: {{"productos": []}}"""

        chat = LlmChat(
            api_key=api_key,
            session_id=f"pharma-extract-{uuid.uuid4()}",
            system_message="You are an expert pharmaceutical analyst. Extract only verified medications from pipeline content. Return valid JSON only."
        ).with_model("openai", "gpt-4o-mini")
        
        user_message = UserMessage(text=prompt)
        response = await chat.send_message(user_message)
        
        # Parse response
        try:
            # Try to extract JSON from response
            json_match = re.search(r'\{.*\}', response, re.DOTALL)
            if json_match:
                data = json.loads(json_match.group())
                productos = data.get("productos", [])
                
                # Add company name to each medication and normalize area
                for prod in productos:
                    prod["empresa"] = company_name
                    prod["source_url"] = url
                    
                    # Normalize therapeutic area to match database
                    area = prod.get("area_terapeutica", "")
                    if area:
                        # Try to match with registered areas
                        for registered_area in area_names:
                            if registered_area.lower() in area.lower() or area.lower() in registered_area.lower():
                                prod["area_terapeutica"] = registered_area
                                break
                
                return productos
        except json.JSONDecodeError:
            print(f"Failed to parse LLM response as JSON: {response[:200]}")
        
        return []
        
    except Exception as e:
        print(f"Error extracting medications with LLM: {e}")
        return []


async def process_pharma_medications(medications: List[Dict], company_name: str, scrapper_id: str, run_id: str) -> int:
    """Process medications, detect phase changes, and create opportunities"""
    phase_changes = 0
    
    for med in medications:
        try:
            molecula = med.get("molecula", "").strip()
            if not molecula:
                continue
            
            fase = med.get("fase", "").strip()
            area = med.get("area_terapeutica", "").strip()
            
            # Check if medication exists in database
            existing = await db.pharma_medications.find_one({
                "molecula": {"$regex": f"^{re.escape(molecula)}$", "$options": "i"},
                "empresa": company_name
            })
            
            if existing:
                # Check for phase change
                old_fase = existing.get("fase", "")
                if old_fase and fase and old_fase != fase:
                    # Phase change detected - this is an opportunity!
                    phase_changes += 1
                    
                    await log_scrapper_event(
                        scrapper_id, "SUCCESS",
                        f"PHASE CHANGE: {molecula} moved from {old_fase} to {fase}",
                        {"molecula": molecula, "old_fase": old_fase, "new_fase": fase, "empresa": company_name},
                        run_id=run_id
                    )
                    
                    # Create opportunity for this phase change
                    opp_doc = {
                        "id": str(uuid.uuid4()),
                        "source_scrapper": scrapper_id,
                        "author_name": company_name,
                        "author_headline": f"Pharmaceutical Company - {area}",
                        "company": company_name,
                        "post_content": f"Phase Change Alert: {molecula} has advanced from {old_fase} to {fase}. Therapeutic Area: {area}. This represents a significant milestone in drug development.",
                        "keyword_matched": "pipeline phase change",
                        "status": "new",
                        "raw_data": {
                            "type": "pharma_phase_change",
                            "molecula": molecula,
                            "area_terapeutica": area,
                            "old_fase": old_fase,
                            "new_fase": fase,
                            "empresa": company_name,
                            "source_url": med.get("source_url", "")
                        },
                        "created_at": datetime.now(timezone.utc).isoformat(),
                    }
                    await db.scraper_opportunities.insert_one(opp_doc)
                
                # Update existing medication
                await db.pharma_medications.update_one(
                    {"_id": existing["_id"]},
                    {"$set": {
                        "fase": fase,
                        "area_terapeutica": area,
                        "last_updated": datetime.now(timezone.utc).isoformat(),
                        "source_url": med.get("source_url", "")
                    }}
                )
            else:
                # New medication - insert it
                med_doc = {
                    "id": str(uuid.uuid4()),
                    "molecula": molecula,
                    "area_terapeutica": area,
                    "fase": fase,
                    "empresa": company_name,
                    "source_url": med.get("source_url", ""),
                    "created_at": datetime.now(timezone.utc).isoformat(),
                    "last_updated": datetime.now(timezone.utc).isoformat(),
                }
                await db.pharma_medications.insert_one(med_doc)
                
                # Also create opportunity for new medication discovery
                opp_doc = {
                    "id": str(uuid.uuid4()),
                    "source_scrapper": scrapper_id,
                    "author_name": company_name,
                    "author_headline": f"Pharmaceutical Company - {area}",
                    "company": company_name,
                    "post_content": f"New Drug Discovery: {molecula} found in {company_name}'s pipeline. Phase: {fase}. Therapeutic Area: {area}.",
                    "keyword_matched": "new pipeline drug",
                    "status": "new",
                    "raw_data": {
                        "type": "pharma_new_drug",
                        "molecula": molecula,
                        "area_terapeutica": area,
                        "fase": fase,
                        "empresa": company_name,
                        "source_url": med.get("source_url", "")
                    },
                    "created_at": datetime.now(timezone.utc).isoformat(),
                }
                await db.scraper_opportunities.insert_one(opp_doc)
                
        except Exception as e:
            print(f"Error processing medication {med}: {e}")
            continue
    
    return phase_changes


# ============ STATS ENDPOINTS ============

@router.get("/stats")
async def get_scrapper_stats(current_user: dict = Depends(get_current_user)):
    """Get overall scrapper statistics"""
    
    # Total opportunities
    total_opportunities = await db.scraper_opportunities.count_documents({})
    
    # By status
    status_pipeline = [
        {"$group": {"_id": "$status", "count": {"$sum": 1}}}
    ]
    by_status = await db.scraper_opportunities.aggregate(status_pipeline).to_list(100)
    
    # By source
    source_pipeline = [
        {"$group": {"_id": "$source_scrapper", "count": {"$sum": 1}}}
    ]
    by_source = await db.scraper_opportunities.aggregate(source_pipeline).to_list(100)
    
    # Recent runs
    recent_runs = await db.scraper_runs.find(
        {}, {"_id": 0}
    ).sort("started_at", -1).limit(10).to_list(10)
    
    # Today's activity
    today = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    today_opportunities = await db.scraper_opportunities.count_documents({
        "created_at": {"$gte": today.isoformat()}
    })
    
    # Keywords count
    total_keywords = await db.scraper_keywords.count_documents({})
    active_keywords = await db.scraper_keywords.count_documents({"active": True})
    
    return {
        "total_opportunities": total_opportunities,
        "today_opportunities": today_opportunities,
        "by_status": {s["_id"]: s["count"] for s in by_status if s["_id"]},
        "by_source": {s["_id"]: s["count"] for s in by_source if s["_id"]},
        "recent_runs": recent_runs,
        "keywords": {
            "total": total_keywords,
            "active": active_keywords
        }
    }


# ============ PHARMA COMPANIES ENDPOINTS ============

@router.get("/pharma/companies")
async def get_pharma_companies(
    active_only: bool = False,
    has_research: Optional[bool] = None,
    has_pipeline_url: Optional[bool] = None,
    current_user: dict = Depends(get_current_user)
):
    """Get all pharmaceutical companies from main companies collection"""
    # Base query: only PHARMACEUTICALS industry
    query = {"industry": "PHARMACEUTICALS"}
    
    if active_only:
        query["is_active"] = True
    if has_research is not None:
        query["pharma_has_research"] = has_research
    if has_pipeline_url is True:
        query["pharma_pipeline_url"] = {"$ne": "", "$exists": True, "$ne": None}
    elif has_pipeline_url is False:
        query["$or"] = [
            {"pharma_pipeline_url": ""},
            {"pharma_pipeline_url": None},
            {"pharma_pipeline_url": {"$exists": False}}
        ]
    
    companies_raw = await db.companies.find(query, {"_id": 0}).to_list(1000)
    
    # Get last medication update per company
    med_updates = await db.pharma_medications.aggregate([
        {"$group": {
            "_id": "$empresa",
            "last_medication_update": {"$max": "$last_updated"},
            "medication_count": {"$sum": 1}
        }}
    ]).to_list(500)
    med_updates_map = {m["_id"]: {"last_update": m["last_medication_update"], "count": m["medication_count"]} for m in med_updates}
    
    # Get last scrape attempt per company
    scrape_attempts = await db.scraper_runs.aggregate([
        {"$match": {"scrapper_id": "pharma_pipelines"}},
        {"$unwind": "$params.companies"},
        {"$group": {
            "_id": "$params.companies",
            "last_scrape_attempt": {"$max": "$started_at"},
            "last_status": {"$last": "$status"}
        }}
    ]).to_list(500)
    scrape_map = {s["_id"]: {"last_attempt": s["last_scrape_attempt"], "status": s["last_status"]} for s in scrape_attempts}
    
    # Also get per-company scrape status from company document
    # Map to pharma-specific format for frontend compatibility
    companies = []
    for c in companies_raw:
        company_name = c.get("name")
        med_info = med_updates_map.get(company_name, {})
        scrape_info = scrape_map.get(company_name, {})
        companies.append({
            "id": c.get("hubspot_id"),
            "name": company_name,
            "domain": c.get("domain"),
            "pipeline_url": c.get("pharma_pipeline_url", ""),
            "has_research": c.get("pharma_has_research", False),
            "active": c.get("is_active", True),
            "notes": c.get("pharma_notes", ""),
            "source": "companies",
            "city": c.get("city"),
            "country": c.get("country"),
            "website": c.get("website"),
            "updated_at": c.get("updated_at"),
            "last_medication_update": med_info.get("last_update"),
            "medication_count": med_info.get("count", 0),
            # Pipeline scraping status
            "last_pipeline_scrape": c.get("pharma_last_scrape"),
            "pipeline_scrape_status": c.get("pharma_scrape_status", "never"),
            "pipeline_scrape_error": c.get("pharma_scrape_error")
        })
    
    # Calculate stats
    total = len(companies)
    with_research = sum(1 for c in companies if c.get("has_research"))
    with_pipeline = sum(1 for c in companies if c.get("pipeline_url"))
    active = sum(1 for c in companies if c.get("active", True))
    
    return {
        "companies": companies,
        "total": total,
        "stats": {
            "active": active,
            "with_research": with_research,
            "without_research": total - with_research,
            "with_pipeline_url": with_pipeline,
            "without_pipeline_url": total - with_pipeline,
            "ready_for_scraping": sum(1 for c in companies if c.get("pipeline_url") and c.get("has_research") and c.get("active", True))
        }
    }


@router.post("/pharma/companies")
async def create_pharma_company(
    company: PharmaCompanyCreate,
    current_user: dict = Depends(get_current_user)
):
    """Add a new pharma company - creates in main companies collection with PHARMACEUTICALS industry"""
    # Check if company already exists
    existing = await db.companies.find_one({"name": {"$regex": f"^{re.escape(company.name)}$", "$options": "i"}})
    if existing:
        raise HTTPException(status_code=400, detail="Company already exists. Update it instead.")
    
    doc = {
        "hubspot_id": f"local-{uuid.uuid4().hex[:8]}",
        "name": company.name,
        "domain": company.domain or "",
        "industry": "PHARMACEUTICALS",
        "pharma_pipeline_url": company.pipeline_url or "",
        "pharma_has_research": company.has_research,
        "pharma_notes": company.notes or "",
        "is_active": company.active,
        "migrated_from_hubspot": False,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    await db.companies.insert_one(doc)
    
    return {
        "success": True,
        "company": {
            "id": doc["hubspot_id"],
            "name": doc["name"],
            "domain": doc["domain"],
            "pipeline_url": doc["pharma_pipeline_url"],
            "has_research": doc["pharma_has_research"],
            "active": doc["is_active"]
        }
    }


@router.put("/pharma/companies/{company_id}")
async def update_pharma_company(
    company_id: str,
    updates: PharmaCompanyUpdate,
    current_user: dict = Depends(get_current_user)
):
    """Update a pharma company's pipeline-specific fields in companies collection"""
    update_data = {}
    
    # Map pharma-specific fields to companies collection fields
    if updates.pipeline_url is not None:
        update_data["pharma_pipeline_url"] = updates.pipeline_url
    if updates.has_research is not None:
        update_data["pharma_has_research"] = updates.has_research
    if updates.active is not None:
        update_data["is_active"] = updates.active
    if updates.notes is not None:
        update_data["pharma_notes"] = updates.notes
    if updates.domain is not None:
        update_data["domain"] = updates.domain
    if updates.name is not None:
        update_data["name"] = updates.name
    
    if not update_data:
        raise HTTPException(status_code=400, detail="No updates provided")
    
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    # Try to find by hubspot_id first, then by name
    result = await db.companies.update_one(
        {"$or": [{"hubspot_id": company_id}, {"name": company_id}]},
        {"$set": update_data}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Company not found")
    
    return {"success": True, "message": "Company updated"}


@router.delete("/pharma/companies/{company_id}")
async def delete_pharma_company(
    company_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Soft delete a pharma company (set is_active to False)"""
    result = await db.companies.update_one(
        {"$or": [{"hubspot_id": company_id}, {"name": company_id}], "industry": "PHARMACEUTICALS"},
        {"$set": {"is_active": False, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Company not found")
    return {"success": True, "message": "Company deactivated"}


@router.post("/pharma/companies/sync-from-hubspot")
async def sync_pharma_companies_from_hubspot(
    current_user: dict = Depends(get_current_user)
):
    """DEPRECATED - Companies already migrated to main collection"""
    return {"success": False, "message": "This endpoint is deprecated. Use the main companies collection with industry=PHARMACEUTICALS"}


@router.post("/pharma/companies/add-big-pharma")
async def add_big_pharma_companies(
    current_user: dict = Depends(get_current_user)
):
    """Add/update major multinational pharma companies with known pipeline URLs"""
    big_pharma = [
        {"name": "Pfizer", "domain": "pfizer.com", "pipeline_url": "https://www.pfizer.com/science/drug-product-pipeline"},
        {"name": "Novartis", "domain": "novartis.com", "pipeline_url": "https://www.novartis.com/research-development/novartis-pipeline"},
        {"name": "Roche", "domain": "roche.com", "pipeline_url": "https://www.roche.com/solutions/pipeline"},
        {"name": "AstraZeneca", "domain": "astrazeneca.com", "pipeline_url": "https://www.astrazeneca.com/our-therapy-areas/pipeline.html"},
        {"name": "Merck", "domain": "merck.com", "pipeline_url": "https://www.merck.com/research/pipeline/"},
        {"name": "Sanofi", "domain": "sanofi.com", "pipeline_url": "https://www.sanofi.com/en/our-science/research-and-development/pipeline"},
        {"name": "Bristol Myers Squibb", "domain": "bms.com", "pipeline_url": "https://www.bms.com/researchers-and-partners/in-the-pipeline.html"},
        {"name": "AbbVie", "domain": "abbvie.com", "pipeline_url": "https://www.abbvie.com/our-science/pipeline.html"},
        {"name": "Eli Lilly", "domain": "lilly.com", "pipeline_url": "https://www.lilly.com/discovery/clinical-development-pipeline"},
        {"name": "Takeda", "domain": "takeda.com", "pipeline_url": "https://www.takeda.com/what-we-do/pipeline/"},
        {"name": "Amgen", "domain": "amgen.com", "pipeline_url": "https://www.amgen.com/science/pipeline"},
        {"name": "Gilead", "domain": "gilead.com", "pipeline_url": "https://www.gilead.com/science-and-medicine/pipeline"},
        {"name": "Biogen", "domain": "biogen.com", "pipeline_url": "https://www.biogen.com/science-and-innovation/pipeline.html"},
        {"name": "Regeneron", "domain": "regeneron.com", "pipeline_url": "https://www.regeneron.com/pipeline-medicines"},
        {"name": "Moderna", "domain": "modernatx.com", "pipeline_url": "https://www.modernatx.com/research/product-pipeline"},
        {"name": "Bayer", "domain": "bayer.com", "pipeline_url": "https://www.bayer.com/en/pharma/development-pipeline"},
        {"name": "GSK", "domain": "gsk.com", "pipeline_url": "https://www.gsk.com/en-gb/research-and-development/pipeline/"},
        {"name": "Boehringer Ingelheim", "domain": "boehringer-ingelheim.com", "pipeline_url": "https://www.boehringer-ingelheim.com/human-health/pipeline"},
        {"name": "Johnson & Johnson", "domain": "jnj.com", "pipeline_url": "https://www.jnj.com/innovative-medicine/areas-of-focus/development-pipeline"},
    ]
    
    added = 0
    updated = 0
    
    for company in big_pharma:
        # Check if company exists in main companies collection
        existing = await db.companies.find_one({
            "name": {"$regex": f"^{re.escape(company['name'])}$", "$options": "i"}
        })
        
        if not existing:
            # Create new company with PHARMACEUTICALS industry
            doc = {
                "hubspot_id": f"bigpharma-{uuid.uuid4().hex[:8]}",
                "name": company["name"],
                "domain": company["domain"],
                "industry": "PHARMACEUTICALS",
                "pharma_pipeline_url": company["pipeline_url"],
                "pharma_has_research": True,
                "is_active": True,
                "migrated_from_hubspot": False,
                "created_at": datetime.now(timezone.utc).isoformat(),
                "updated_at": datetime.now(timezone.utc).isoformat()
            }
            await db.companies.insert_one(doc)
            added += 1
        else:
            # Update existing with pipeline URL and pharma fields
            await db.companies.update_one(
                {"_id": existing["_id"]},
                {"$set": {
                    "pharma_pipeline_url": company["pipeline_url"],
                    "pharma_has_research": True,
                    "industry": "PHARMACEUTICALS",
                    "updated_at": datetime.now(timezone.utc).isoformat()
                }}
            )
            updated += 1
    
    return {"success": True, "added": added, "updated": updated, "total_big_pharma": len(big_pharma)}


@router.post("/pharma/companies/seed-pipeline-urls")
async def seed_pipeline_urls(
    current_user: dict = Depends(get_current_user)
):
    """Update existing PHARMACEUTICALS companies with known pipeline URLs"""
    big_pharma_urls = {
        "pfizer": "https://www.pfizer.com/science/drug-product-pipeline",
        "novartis": "https://www.novartis.com/research-development/novartis-pipeline",
        "roche": "https://www.roche.com/solutions/pipeline",
        "astrazeneca": "https://www.astrazeneca.com/our-therapy-areas/pipeline.html",
        "merck": "https://www.merck.com/research/pipeline/",
        "sanofi": "https://www.sanofi.com/en/our-science/research-and-development/pipeline",
        "bristol myers squibb": "https://www.bms.com/researchers-and-partners/in-the-pipeline.html",
        "bms": "https://www.bms.com/researchers-and-partners/in-the-pipeline.html",
        "abbvie": "https://www.abbvie.com/our-science/pipeline.html",
        "eli lilly": "https://www.lilly.com/discovery/clinical-development-pipeline",
        "lilly": "https://www.lilly.com/discovery/clinical-development-pipeline",
        "takeda": "https://www.takeda.com/what-we-do/pipeline/",
        "amgen": "https://www.amgen.com/science/pipeline",
        "gilead": "https://www.gilead.com/science-and-medicine/pipeline",
        "biogen": "https://www.biogen.com/science-and-innovation/pipeline.html",
        "regeneron": "https://www.regeneron.com/pipeline-medicines",
        "moderna": "https://www.modernatx.com/research/product-pipeline",
        "bayer": "https://www.bayer.com/en/pharma/development-pipeline",
        "gsk": "https://www.gsk.com/en-gb/research-and-development/pipeline/",
        "glaxosmithkline": "https://www.gsk.com/en-gb/research-and-development/pipeline/",
        "boehringer ingelheim": "https://www.boehringer-ingelheim.com/human-health/pipeline",
        "johnson & johnson": "https://www.jnj.com/innovative-medicine/areas-of-focus/development-pipeline",
        "j&j": "https://www.jnj.com/innovative-medicine/areas-of-focus/development-pipeline",
    }
    
    # Get all pharmaceutical companies
    pharma_companies = await db.companies.find(
        {"industry": "PHARMACEUTICALS"},
        {"_id": 1, "name": 1, "pharma_pipeline_url": 1}
    ).to_list(1000)
    
    updated = 0
    for company in pharma_companies:
        name = company.get("name")
        if not name:
            continue
        name_lower = name.lower()
        
        # Check if we have a known pipeline URL for this company
        pipeline_url = None
        for key, url in big_pharma_urls.items():
            if key in name_lower or name_lower in key:
                pipeline_url = url
                break
        
        if pipeline_url and not company.get("pharma_pipeline_url"):
            await db.companies.update_one(
                {"_id": company["_id"]},
                {"$set": {
                    "pharma_pipeline_url": pipeline_url,
                    "pharma_has_research": True,
                    "updated_at": datetime.now(timezone.utc).isoformat()
                }}
            )
            updated += 1
    
    return {"success": True, "updated": updated, "total_pharma": len(pharma_companies)}


@router.delete("/pharma/companies/clear-hubspot")
async def clear_hubspot_companies(
    current_user: dict = Depends(get_current_user)
):
    """DEPRECATED - Companies are now managed in main companies collection"""
    return {"success": False, "message": "This endpoint is deprecated. Companies are managed in the main companies collection with industry=PHARMACEUTICALS"}


@router.post("/pharma/companies/reset")
async def reset_pharma_companies(
    current_user: dict = Depends(get_current_user)
):
    """Reset pharma-specific fields on all PHARMACEUTICALS companies"""
    # Reset pharma fields but don't delete the companies
    result = await db.companies.update_many(
        {"industry": "PHARMACEUTICALS"},
        {"$set": {
            "pharma_pipeline_url": "",
            "pharma_has_research": False,
            "pharma_notes": "",
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    return {"success": True, "reset": result.modified_count}


@router.post("/pharma/companies/import-from-contacts")
async def import_pharma_from_contacts(
    current_user: dict = Depends(get_current_user)
):
    """DEPRECATED - Pharma companies come from main companies collection filtered by PHARMACEUTICALS industry"""
    return {"success": False, "message": "This endpoint is deprecated. Pharma companies are filtered from the main companies collection with industry=PHARMACEUTICALS"}


@router.post("/pharma/companies/cleanup-non-pharma")
async def remove_non_pharma_companies(
    current_user: dict = Depends(get_current_user)
):
    """DEPRECATED - Not needed as companies are filtered by industry"""
    return {"success": False, "message": "This endpoint is deprecated. Companies are filtered by industry=PHARMACEUTICALS"}


@router.post("/pharma/companies/add-big-pharma-keep-existing")
async def add_big_pharma_keep_existing(
    current_user: dict = Depends(get_current_user)
):
    """Add Big Pharma companies WITHOUT deleting existing ones"""
    big_pharma = [
        {"name": "Pfizer", "domain": "pfizer.com", "pipeline_url": "https://www.pfizer.com/science/drug-product-pipeline"},
        {"name": "Novartis", "domain": "novartis.com", "pipeline_url": "https://www.novartis.com/research-development/novartis-pipeline"},
        {"name": "Roche", "domain": "roche.com", "pipeline_url": "https://www.roche.com/solutions/pipeline"},
        {"name": "AstraZeneca", "domain": "astrazeneca.com", "pipeline_url": "https://www.astrazeneca.com/our-therapy-areas/pipeline.html"},
        {"name": "Merck", "domain": "merck.com", "pipeline_url": "https://www.merck.com/research/pipeline/"},
        {"name": "Sanofi", "domain": "sanofi.com", "pipeline_url": "https://www.sanofi.com/en/our-science/research-and-development/pipeline"},
        {"name": "Bristol Myers Squibb", "domain": "bms.com", "pipeline_url": "https://www.bms.com/researchers-and-partners/in-the-pipeline.html"},
        {"name": "AbbVie", "domain": "abbvie.com", "pipeline_url": "https://www.abbvie.com/our-science/pipeline.html"},
        {"name": "Eli Lilly", "domain": "lilly.com", "pipeline_url": "https://www.lilly.com/discovery/clinical-development-pipeline"},
        {"name": "Takeda", "domain": "takeda.com", "pipeline_url": "https://www.takeda.com/what-we-do/pipeline/"},
        {"name": "Amgen", "domain": "amgen.com", "pipeline_url": "https://www.amgen.com/science/pipeline"},
        {"name": "Gilead", "domain": "gilead.com", "pipeline_url": "https://www.gilead.com/science-and-medicine/pipeline"},
        {"name": "Biogen", "domain": "biogen.com", "pipeline_url": "https://www.biogen.com/science-and-innovation/pipeline.html"},
        {"name": "Regeneron", "domain": "regeneron.com", "pipeline_url": "https://www.regeneron.com/pipeline-medicines"},
        {"name": "Moderna", "domain": "modernatx.com", "pipeline_url": "https://www.modernatx.com/research/product-pipeline"},
        {"name": "Bayer", "domain": "bayer.com", "pipeline_url": "https://www.bayer.com/en/pharma/development-pipeline"},
        {"name": "GSK", "domain": "gsk.com", "pipeline_url": "https://www.gsk.com/en-gb/research-and-development/pipeline/"},
        {"name": "Boehringer Ingelheim", "domain": "boehringer-ingelheim.com", "pipeline_url": "https://www.boehringer-ingelheim.com/human-health/pipeline"},
        {"name": "Johnson & Johnson", "domain": "jnj.com", "pipeline_url": "https://www.jnj.com/innovative-medicine/areas-of-focus/development-pipeline"},
    ]
    
    added = 0
    updated = 0
    
    for company in big_pharma:
        existing = await db.pharma_companies.find_one({
            "name": {"$regex": f"^{re.escape(company['name'])}$", "$options": "i"}
        })
        
        if not existing:
            doc = {
                "id": str(uuid.uuid4()),
                "name": company["name"],
                "domain": company["domain"],
                "pipeline_url": company["pipeline_url"],
                "has_research": True,
                "active": True,
                "notes": "",
                "source": "big_pharma",
                "created_at": datetime.now(timezone.utc).isoformat()
            }
            await db.pharma_companies.insert_one(doc)
            added += 1
        else:
            # Update with pipeline URL if missing
            if not existing.get("pipeline_url"):
                await db.pharma_companies.update_one(
                    {"id": existing["id"]},
                    {"$set": {
                        "pipeline_url": company["pipeline_url"],
                        "has_research": True,
                        "source": "big_pharma"
                    }}
                )
                updated += 1
    
    return {"success": True, "added": added, "updated": updated}


# ============ THERAPEUTIC AREAS ENDPOINTS ============

@router.get("/pharma/therapeutic-areas")
async def get_therapeutic_areas(
    active_only: bool = False,
    current_user: dict = Depends(get_current_user)
):
    """Get all therapeutic areas (medical specialties)"""
    query = {"active": True} if active_only else {}
    areas = await db.therapeutic_areas.find(query, {"_id": 0}).to_list(100)
    
    # Seed defaults if empty
    if not areas:
        for area in DEFAULT_THERAPEUTIC_AREAS:
            doc = {
                "id": str(uuid.uuid4()),
                **area,
                "active": True,
                "created_at": datetime.now(timezone.utc).isoformat()
            }
            await db.therapeutic_areas.insert_one(doc)
        areas = await db.therapeutic_areas.find({}, {"_id": 0}).to_list(100)
    
    return {
        "therapeutic_areas": areas,
        "total": len(areas),
        "active": sum(1 for a in areas if a.get("active", True))
    }


@router.post("/pharma/therapeutic-areas")
async def create_therapeutic_area(
    area: TherapeuticAreaCreate,
    current_user: dict = Depends(get_current_user)
):
    """Add a new therapeutic area"""
    # Check for duplicate code
    existing = await db.therapeutic_areas.find_one({"code": area.code})
    if existing:
        raise HTTPException(status_code=400, detail="Therapeutic area code already exists")
    
    doc = {
        "id": str(uuid.uuid4()),
        "code": area.code,
        "name": area.name,
        "description": area.description or "",
        "linkedin_keywords": area.linkedin_keywords or [],
        "active": area.active,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.therapeutic_areas.insert_one(doc)
    return {"success": True, "therapeutic_area": {k: v for k, v in doc.items() if k != "_id"}}


@router.put("/pharma/therapeutic-areas/{area_id}")
async def update_therapeutic_area(
    area_id: str,
    updates: TherapeuticAreaUpdate,
    current_user: dict = Depends(get_current_user)
):
    """Update a therapeutic area"""
    update_data = {k: v for k, v in updates.model_dump().items() if v is not None}
    if not update_data:
        raise HTTPException(status_code=400, detail="No updates provided")
    
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    result = await db.therapeutic_areas.update_one(
        {"id": area_id},
        {"$set": update_data}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Therapeutic area not found")
    
    return {"success": True, "message": "Therapeutic area updated"}


@router.delete("/pharma/therapeutic-areas/{area_id}")
async def delete_therapeutic_area(
    area_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Delete a therapeutic area"""
    result = await db.therapeutic_areas.delete_one({"id": area_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Therapeutic area not found")
    return {"success": True, "message": "Therapeutic area deleted"}


@router.post("/pharma/therapeutic-areas/seed-keywords")
async def seed_therapeutic_area_keywords(
    current_user: dict = Depends(get_current_user)
):
    """Update existing therapeutic areas with default LinkedIn keywords"""
    # Create a map from code to keywords
    keywords_map = {area["code"]: area.get("linkedin_keywords", []) for area in DEFAULT_THERAPEUTIC_AREAS}
    
    updated = 0
    for code, keywords in keywords_map.items():
        result = await db.therapeutic_areas.update_one(
            {"code": code, "$or": [{"linkedin_keywords": {"$exists": False}}, {"linkedin_keywords": []}]},
            {"$set": {"linkedin_keywords": keywords, "updated_at": datetime.now(timezone.utc).isoformat()}}
        )
        if result.modified_count > 0:
            updated += 1
    
    return {"success": True, "updated": updated, "message": f"Updated {updated} therapeutic areas with LinkedIn keywords"}


@router.post("/pharma/find-decision-makers")
async def find_decision_makers(
    company_name: str,
    therapeutic_area: str,
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(get_current_user)
):
    """Find decision makers for a specific company and therapeutic area using LinkedIn scraping"""
    
    # Get therapeutic area keywords
    area = await db.therapeutic_areas.find_one({"$or": [{"code": therapeutic_area}, {"name": therapeutic_area}]})
    if not area:
        raise HTTPException(status_code=404, detail="Therapeutic area not found")
    
    keywords = area.get("linkedin_keywords", [])
    if not keywords:
        raise HTTPException(status_code=400, detail="No LinkedIn keywords configured for this therapeutic area")
    
    # Create search run
    run_id = str(uuid.uuid4())
    run_doc = {
        "id": run_id,
        "scrapper_id": "decision_makers",
        "status": "running",
        "started_at": datetime.now(timezone.utc).isoformat(),
        "started_by": current_user.get("email"),
        "params": {
            "company": company_name,
            "therapeutic_area": area.get("name"),
            "keywords": keywords
        },
        "results": {}
    }
    await db.scraper_runs.insert_one(run_doc)
    
    # Run in background
    background_tasks.add_task(run_decision_makers_scrapper, run_id, company_name, area, keywords)
    
    return {
        "success": True,
        "run_id": run_id,
        "message": f"Searching for {area.get('name')} decision makers at {company_name}",
        "keywords_used": keywords
    }


async def run_decision_makers_scrapper(run_id: str, company_name: str, area: dict, keywords: List[str]):
    """LinkedIn scrapper to find decision makers for a company and therapeutic area"""
    scrapper_id = "decision_makers"
    
    try:
        await log_scrapper_event(scrapper_id, "INFO", f"Starting search for {area.get('name')} decision makers at {company_name}", run_id=run_id)
        
        # Build search queries combining company + therapeutic area keywords
        search_queries = []
        for keyword in keywords[:5]:  # Limit to 5 keywords
            search_queries.append(f"{company_name} {keyword}")
        
        await log_scrapper_event(scrapper_id, "INFO", f"Search queries: {search_queries}", run_id=run_id)
        
        # Use LinkedIn Posts by Keywords actor to find relevant people
        input_data = {
            "searchKeywords": search_queries,
            "limitPerKeyword": 10,
            "maxResults": 50
        }
        
        results = await run_apify_actor(APIFY_ACTORS["linkedin_posts_keywords"], input_data)
        
        # Extract unique profiles from results
        profiles_found = {}
        for result in results:
            author_name = result.get("authorName") or result.get("author", {}).get("name")
            author_headline = result.get("authorHeadline") or result.get("author", {}).get("headline", "")
            profile_url = result.get("authorProfileUrl") or result.get("profileUrl")
            
            if not author_name or not profile_url:
                continue
            
            # Check if headline matches our criteria (contains company or area keywords)
            headline_lower = (author_headline or "").lower()
            company_lower = company_name.lower()
            
            # Score the profile relevance
            score = 0
            if company_lower in headline_lower:
                score += 5
            for kw in keywords:
                if kw.lower() in headline_lower:
                    score += 2
            
            if score > 0 and profile_url not in profiles_found:
                profiles_found[profile_url] = {
                    "name": author_name,
                    "headline": author_headline,
                    "profile_url": profile_url,
                    "relevance_score": score,
                    "matched_company": company_name,
                    "matched_area": area.get("name")
                }
        
        # Sort by relevance score
        sorted_profiles = sorted(profiles_found.values(), key=lambda x: x["relevance_score"], reverse=True)
        
        # Save as opportunities
        opportunities_created = 0
        for profile in sorted_profiles[:20]:  # Top 20 profiles
            opp_doc = {
                "id": str(uuid.uuid4()),
                "source_scrapper": scrapper_id,
                "author_name": profile["name"],
                "author_headline": profile["headline"],
                "profile_url": profile["profile_url"],
                "company": company_name,
                "post_content": f"Decision maker candidate for {area.get('name')} at {company_name}",
                "keyword_matched": area.get("name"),
                "status": "new",
                "raw_data": {
                    "type": "decision_maker",
                    "therapeutic_area": area.get("name"),
                    "therapeutic_area_code": area.get("code"),
                    "target_company": company_name,
                    "relevance_score": profile["relevance_score"]
                },
                "created_at": datetime.now(timezone.utc).isoformat(),
            }
            await db.scraper_opportunities.insert_one(opp_doc)
            opportunities_created += 1
        
        await db.scraper_runs.update_one(
            {"id": run_id},
            {"$set": {
                "status": "completed",
                "completed_at": datetime.now(timezone.utc).isoformat(),
                "results": {
                    "profiles_found": len(sorted_profiles),
                    "opportunities_created": opportunities_created,
                    "top_profiles": sorted_profiles[:5]
                }
            }}
        )
        
        await log_scrapper_event(
            scrapper_id, "SUCCESS",
            f"Found {len(sorted_profiles)} potential decision makers, created {opportunities_created} opportunities",
            run_id=run_id
        )
        
    except Exception as e:
        await log_scrapper_event(scrapper_id, "ERROR", f"Run failed: {str(e)}", run_id=run_id)
        await db.scraper_runs.update_one(
            {"id": run_id},
            {"$set": {"status": "failed", "error": str(e)}}
        )


@router.post("/pharma/medications/{medication_id}/find-decision-makers")
async def find_decision_makers_for_medication(
    medication_id: str,
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(get_current_user)
):
    """Find decision makers for a specific medication's therapeutic area and company"""
    # Find the medication
    medication = await db.pharma_medications.find_one({"id": medication_id})
    
    if not medication:
        raise HTTPException(status_code=404, detail="Medication not found")
    
    company_name = medication.get("empresa")
    therapeutic_area_name = medication.get("area_terapeutica")
    medication_name = medication.get("nombre")
    
    if not company_name or not therapeutic_area_name:
        raise HTTPException(status_code=400, detail="Medication missing company or therapeutic area")
    
    # Get therapeutic area keywords
    area = await db.therapeutic_areas.find_one({
        "$or": [
            {"code": therapeutic_area_name.lower().replace(" ", "_")},
            {"name": {"$regex": therapeutic_area_name, "$options": "i"}}
        ]
    })
    
    keywords = area.get("linkedin_keywords", []) if area else []
    
    # If no keywords configured, use default search terms
    if not keywords:
        keywords = [
            f"{therapeutic_area_name} director",
            f"{therapeutic_area_name} lead",
            f"head of {therapeutic_area_name}",
            f"VP {therapeutic_area_name}"
        ]
    
    # Update medication with search status
    await db.pharma_medications.update_one(
        {"id": medication_id},
        {"$set": {
            "dm_search_status": "running",
            "dm_last_search": datetime.now(timezone.utc).isoformat(),
            "dm_search_error": None
        }}
    )
    
    # Create run record
    run_id = str(uuid.uuid4())
    run_doc = {
        "id": run_id,
        "scrapper_id": "decision_makers_medication",
        "status": "running",
        "started_at": datetime.now(timezone.utc).isoformat(),
        "started_by": current_user.get("email"),
        "params": {
            "medication_id": medication_id,
            "medication_name": medication_name,
            "company": company_name,
            "therapeutic_area": therapeutic_area_name,
            "keywords": keywords
        },
        "results": {}
    }
    await db.scraper_runs.insert_one(run_doc)
    
    # Run in background
    background_tasks.add_task(
        run_medication_decision_makers_search,
        run_id, medication_id, medication_name, company_name, therapeutic_area_name, keywords
    )
    
    return {
        "success": True,
        "run_id": run_id,
        "message": f"Searching for {therapeutic_area_name} decision makers at {company_name} for {medication_name}",
        "keywords_used": keywords
    }


async def run_medication_decision_makers_search(
    run_id: str,
    medication_id: str, 
    medication_name: str,
    company_name: str, 
    therapeutic_area: str,
    keywords: List[str]
):
    """Background task to search for decision makers related to a medication"""
    scrapper_id = "decision_makers_medication"
    
    try:
        await log_scrapper_event(
            scrapper_id, "INFO",
            f"Starting search for {therapeutic_area} decision makers at {company_name} (medication: {medication_name})",
            run_id=run_id
        )
        
        # Build search queries
        search_queries = []
        for keyword in keywords[:5]:
            search_queries.append(f"{company_name} {keyword}")
        
        # Try to use Apify
        try:
            input_data = {
                "searchKeywords": search_queries,
                "limitPerKeyword": 10,
                "maxResults": 50
            }
            
            results = await run_apify_actor(APIFY_ACTORS["linkedin_posts_keywords"], input_data)
            
            # Process results
            profiles_found = {}
            for result in results:
                author_name = result.get("authorName") or result.get("author", {}).get("name")
                author_headline = result.get("authorHeadline") or result.get("author", {}).get("headline", "")
                profile_url = result.get("authorProfileUrl") or result.get("profileUrl")
                
                if not author_name or not profile_url:
                    continue
                
                headline_lower = (author_headline or "").lower()
                company_lower = company_name.lower()
                
                score = 0
                if company_lower in headline_lower:
                    score += 5
                for kw in keywords:
                    if kw.lower() in headline_lower:
                        score += 2
                
                if score > 0 and profile_url not in profiles_found:
                    profiles_found[profile_url] = {
                        "name": author_name,
                        "headline": author_headline,
                        "profile_url": profile_url,
                        "relevance_score": score
                    }
            
            sorted_profiles = sorted(profiles_found.values(), key=lambda x: x["relevance_score"], reverse=True)
            
            # Save as decision makers
            dm_created = 0
            for profile in sorted_profiles[:20]:
                dm_doc = {
                    "id": str(uuid.uuid4()),
                    "source": "medication_search",
                    "medication_id": medication_id,
                    "medication_name": medication_name,
                    "company_name": company_name,
                    "therapeutic_area": therapeutic_area,
                    "name": profile["name"],
                    "headline": profile["headline"],
                    "profile_url": profile["profile_url"],
                    "relevance_score": profile["relevance_score"],
                    "status": "new",
                    "created_at": datetime.now(timezone.utc).isoformat()
                }
                await db.decision_makers.insert_one(dm_doc)
                dm_created += 1
            
            # Update medication
            await db.pharma_medications.update_one(
                {"id": medication_id},
                {"$set": {
                    "dm_search_status": "success",
                    "dm_found_count": dm_created,
                    "dm_search_error": None
                }}
            )
            
            # Update run
            await db.scraper_runs.update_one(
                {"id": run_id},
                {"$set": {
                    "status": "completed",
                    "completed_at": datetime.now(timezone.utc).isoformat(),
                    "results": {
                        "profiles_found": len(sorted_profiles),
                        "decision_makers_created": dm_created
                    }
                }}
            )
            
            await log_scrapper_event(
                scrapper_id, "SUCCESS",
                f"Found {len(sorted_profiles)} profiles, created {dm_created} decision maker records",
                run_id=run_id
            )
            
        except Exception as apify_error:
            # Apify failed - mark as pending
            await db.pharma_medications.update_one(
                {"id": medication_id},
                {"$set": {
                    "dm_search_status": "pending",
                    "dm_search_error": f"Apify error: {str(apify_error)}"
                }}
            )
            await log_scrapper_event(scrapper_id, "WARN", f"Apify error: {str(apify_error)}", run_id=run_id)
            raise
            
    except Exception as e:
        await db.pharma_medications.update_one(
            {"id": medication_id},
            {"$set": {
                "dm_search_status": "failed",
                "dm_search_error": str(e)
            }}
        )
        await db.scraper_runs.update_one(
            {"id": run_id},
            {"$set": {"status": "failed", "error": str(e)}}
        )


@router.get("/pharma/decision-makers")
async def get_decision_makers(
    company: Optional[str] = None,
    therapeutic_area: Optional[str] = None,
    status: Optional[str] = None,
    limit: int = 100,
    skip: int = 0,
    current_user: dict = Depends(get_current_user)
):
    """Get decision makers found from medication searches"""
    query = {}
    
    if company:
        query["company_name"] = {"$regex": company, "$options": "i"}
    if therapeutic_area:
        query["therapeutic_area"] = {"$regex": therapeutic_area, "$options": "i"}
    if status:
        query["status"] = status
    
    decision_makers = await db.decision_makers.find(
        query, {"_id": 0}
    ).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    
    total = await db.decision_makers.count_documents(query)
    
    # Get stats
    stats = {
        "total": total,
        "new": await db.decision_makers.count_documents({"status": "new"}),
        "contacted": await db.decision_makers.count_documents({"status": "contacted"}),
        "qualified": await db.decision_makers.count_documents({"status": "qualified"})
    }
    
    # Get company/area aggregations for filters
    companies_agg = await db.decision_makers.aggregate([
        {"$group": {"_id": "$company_name", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}}
    ]).to_list(50)
    
    areas_agg = await db.decision_makers.aggregate([
        {"$group": {"_id": "$therapeutic_area", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}}
    ]).to_list(50)
    
    return {
        "decision_makers": decision_makers,
        "total": total,
        "stats": stats,
        "filters": {
            "companies": [{"value": c["_id"], "count": c["count"]} for c in companies_agg if c["_id"]],
            "therapeutic_areas": [{"value": a["_id"], "count": a["count"]} for a in areas_agg if a["_id"]]
        }
    }


@router.put("/pharma/decision-makers/{dm_id}/status")
async def update_decision_maker_status(
    dm_id: str,
    status: str,
    current_user: dict = Depends(get_current_user)
):
    """Update decision maker status (new, contacted, qualified, rejected)"""
    valid_statuses = ["new", "contacted", "qualified", "rejected"]
    if status not in valid_statuses:
        raise HTTPException(status_code=400, detail=f"Invalid status. Must be one of: {valid_statuses}")
    
    result = await db.decision_makers.update_one(
        {"id": dm_id},
        {"$set": {"status": status, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Decision maker not found")
    
    return {"success": True, "message": f"Status updated to {status}"}


# ============ MEDICATIONS ENDPOINTS (with filters) ============

@router.get("/pharma/medications")
async def get_medications(
    empresa: Optional[str] = None,
    area_terapeutica: Optional[str] = None,
    fase: Optional[str] = None,
    limit: int = 100,
    skip: int = 0,
    current_user: dict = Depends(get_current_user)
):
    """Get medications with multi-dimensional filtering"""
    query = {}
    
    # Apply filters
    if empresa:
        query["empresa"] = {"$regex": empresa, "$options": "i"}
    if area_terapeutica:
        query["area_terapeutica"] = {"$regex": area_terapeutica, "$options": "i"}
    if fase:
        query["fase"] = {"$regex": fase, "$options": "i"}
    
    # Get medications
    medications = await db.pharma_medications.find(
        query, {"_id": 0}
    ).sort("last_updated", -1).skip(skip).limit(limit).to_list(limit)
    
    total = await db.pharma_medications.count_documents(query)
    
    # Get aggregations for filters
    empresas_agg = await db.pharma_medications.aggregate([
        {"$group": {"_id": "$empresa", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}}
    ]).to_list(100)
    
    areas_agg = await db.pharma_medications.aggregate([
        {"$group": {"_id": "$area_terapeutica", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}}
    ]).to_list(100)
    
    fases_agg = await db.pharma_medications.aggregate([
        {"$group": {"_id": "$fase", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}}
    ]).to_list(100)
    
    return {
        "medications": medications,
        "total": total,
        "filters": {
            "empresas": [{"value": e["_id"], "count": e["count"]} for e in empresas_agg if e["_id"]],
            "areas_terapeuticas": [{"value": a["_id"], "count": a["count"]} for a in areas_agg if a["_id"]],
            "fases": [{"value": f["_id"], "count": f["count"]} for f in fases_agg if f["_id"]]
        },
        "applied_filters": {
            "empresa": empresa,
            "area_terapeutica": area_terapeutica,
            "fase": fase
        }
    }


@router.get("/pharma/medications/stats")
async def get_medications_stats(current_user: dict = Depends(get_current_user)):
    """Get medication statistics"""
    total = await db.pharma_medications.count_documents({})
    
    # By company
    by_company = await db.pharma_medications.aggregate([
        {"$group": {"_id": "$empresa", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}},
        {"$limit": 20}
    ]).to_list(20)
    
    # By therapeutic area
    by_area = await db.pharma_medications.aggregate([
        {"$group": {"_id": "$area_terapeutica", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}}
    ]).to_list(50)
    
    # By phase
    by_phase = await db.pharma_medications.aggregate([
        {"$group": {"_id": "$fase", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}}
    ]).to_list(10)
    
    # Phase changes (opportunities)
    phase_changes = await db.scraper_opportunities.count_documents({
        "raw_data.type": "pharma_phase_change"
    })
    
    return {
        "total_medications": total,
        "phase_changes_detected": phase_changes,
        "by_company": {c["_id"]: c["count"] for c in by_company if c["_id"]},
        "by_therapeutic_area": {a["_id"]: a["count"] for a in by_area if a["_id"]},
        "by_phase": {p["_id"]: p["count"] for p in by_phase if p["_id"]}
    }


@router.get("/pharma/phases")
async def get_development_phases(current_user: dict = Depends(get_current_user)):
    """Get list of development phases"""
    return {"phases": DEVELOPMENT_PHASES}


# ============ UNIFIED DEAL MAKERS (1.1) ============

@router.get("/deal-makers")
async def get_deal_makers(
    buyer_persona: Optional[str] = None,
    status: Optional[str] = None,
    source: Optional[str] = None,
    limit: int = 500,
    skip: int = 0,
    current_user: dict = Depends(get_current_user)
):
    """Get all deal makers from all sources (unified view)"""
    query = {}
    
    if buyer_persona:
        query["buyer_persona"] = buyer_persona
    if status:
        query["status"] = status
    if source:
        query["source"] = source
    
    deal_makers = await db.deal_makers.find(
        query, {"_id": 0}
    ).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    
    total = await db.deal_makers.count_documents(query)
    
    # Stats
    stats = {
        "total": await db.deal_makers.count_documents({}),
        "new": await db.deal_makers.count_documents({"status": "new"}),
        "contacted": await db.deal_makers.count_documents({"status": "contacted"}),
        "qualified": await db.deal_makers.count_documents({"status": "qualified"}),
        "rejected": await db.deal_makers.count_documents({"status": "rejected"})
    }
    
    # Group by persona for stats
    persona_groups = await db.deal_makers.aggregate([
        {"$group": {"_id": "$buyer_persona", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}}
    ]).to_list(50)
    
    return {
        "deal_makers": deal_makers,
        "total": total,
        "stats": stats,
        "persona_groups": [{"persona": p["_id"] or "Unassigned", "count": p["count"]} for p in persona_groups]
    }

@router.post("/deal-makers")
async def create_deal_maker(
    name: str,
    linkedin_url: str,
    headline: str = "",
    company: str = "",
    buyer_persona: str = "",
    source: str = "manual",
    source_details: dict = None,
    current_user: dict = Depends(get_current_user)
):
    """Create a new deal maker"""
    # Check for duplicate LinkedIn URL
    if linkedin_url:
        existing = await db.deal_makers.find_one({"linkedin_url": linkedin_url})
        if existing:
            return {"success": False, "message": "Deal maker with this LinkedIn URL already exists", "existing_id": existing.get("id")}
    
    doc = {
        "id": str(uuid.uuid4()),
        "name": name,
        "linkedin_url": linkedin_url,
        "headline": headline,
        "company": company,
        "buyer_persona": buyer_persona,
        "source": source,
        "source_details": source_details or {},
        "status": "new",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "created_by": current_user.get("email")
    }
    
    await db.deal_makers.insert_one(doc)
    return {"success": True, "id": doc["id"]}

@router.put("/deal-makers/{dm_id}/status")
async def update_deal_maker_status(
    dm_id: str,
    status: str,
    current_user: dict = Depends(get_current_user)
):
    """Update deal maker status"""
    valid_statuses = ["new", "contacted", "qualified", "rejected"]
    if status not in valid_statuses:
        raise HTTPException(status_code=400, detail=f"Invalid status. Must be one of: {valid_statuses}")
    
    result = await db.deal_makers.update_one(
        {"id": dm_id},
        {"$set": {"status": status, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Deal maker not found")
    
    return {"success": True}

@router.put("/deal-makers/{dm_id}/persona")
async def update_deal_maker_persona(
    dm_id: str,
    buyer_persona: str,
    current_user: dict = Depends(get_current_user)
):
    """Assign buyer persona to deal maker"""
    result = await db.deal_makers.update_one(
        {"id": dm_id},
        {"$set": {"buyer_persona": buyer_persona, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Deal maker not found")
    
    return {"success": True}

@router.delete("/deal-makers/{dm_id}")
async def delete_deal_maker(dm_id: str, current_user: dict = Depends(get_current_user)):
    """Delete a deal maker"""
    result = await db.deal_makers.delete_one({"id": dm_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Deal maker not found")
    return {"success": True}


# ============ 1.2 FIND MOLECULES DEAL MAKERS ============

@router.post("/search/molecules-deal-makers")
async def search_molecules_deal_makers(
    company_name: str,
    therapeutic_area: str,
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(get_current_user)
):
    """Search for deal makers based on molecule/therapeutic area"""
    # Get therapeutic area keywords
    area = await db.therapeutic_areas.find_one({
        "$or": [
            {"code": therapeutic_area.lower().replace(" ", "_")},
            {"name": {"$regex": therapeutic_area, "$options": "i"}}
        ]
    })
    
    keywords = area.get("linkedin_keywords", []) if area else []
    
    if not keywords:
        keywords = [
            f"{therapeutic_area} director",
            f"{therapeutic_area} lead",
            f"head of {therapeutic_area}",
            f"VP {therapeutic_area}"
        ]
    
    # Create search run
    run_id = str(uuid.uuid4())
    run_doc = {
        "id": run_id,
        "scrapper_id": "molecules_deal_makers",
        "status": "running",
        "started_at": datetime.now(timezone.utc).isoformat(),
        "started_by": current_user.get("email"),
        "params": {
            "company": company_name,
            "therapeutic_area": therapeutic_area,
            "keywords": keywords
        }
    }
    await db.scraper_runs.insert_one(run_doc)
    
    # Run search in background
    background_tasks.add_task(
        run_linkedin_profile_search,
        run_id, company_name, keywords, "molecules_deal_makers", therapeutic_area
    )
    
    return {"success": True, "run_id": run_id, "keywords": keywords}


# ============ 1.3 FIND DEAL MAKERS BY POST ============

class PostSearchRequest(BaseModel):
    keywords: Optional[List[str]] = None
    use_saved_keywords: bool = True
    limit: int = 50

@router.post("/search/deal-makers-by-post")
async def search_deal_makers_by_post(
    request: PostSearchRequest = None,
    background_tasks: BackgroundTasks = None,
    current_user: dict = Depends(get_current_user)
):
    """Search for deal makers by LinkedIn posts"""
    # Handle both body and query params for backwards compatibility
    if request is None:
        request = PostSearchRequest()
    
    search_keywords = request.keywords or []
    
    if request.use_saved_keywords:
        saved = await db.linkedin_search_keywords.find({"active": True}, {"_id": 0, "keyword": 1}).to_list(100)
        search_keywords.extend([k["keyword"] for k in saved])
    
    if not search_keywords:
        raise HTTPException(status_code=400, detail="No keywords provided")
    
    # Create run
    run_id = str(uuid.uuid4())
    run_doc = {
        "id": run_id,
        "scrapper_id": "deal_makers_by_post",
        "status": "running",
        "started_at": datetime.now(timezone.utc).isoformat(),
        "started_by": current_user.get("email"),
        "params": {"keywords": search_keywords[:20], "limit": request.limit}
    }
    await db.scraper_runs.insert_one(run_doc)
    
    # Run in background
    background_tasks.add_task(
        run_linkedin_posts_search,
        run_id, search_keywords[:20], request.limit
    )
    
    return {"success": True, "run_id": run_id, "keywords_count": len(search_keywords)}


async def run_linkedin_posts_search(run_id: str, keywords: List[str], limit: int, location: str = "Mexico"):
    """Search LinkedIn posts and extract authors as deal makers - filtered to Mexico"""
    scrapper_id = "deal_makers_by_post"
    
    try:
        await log_scrapper_event(scrapper_id, "INFO", f"Starting post search with {len(keywords)} keywords in {location}", run_id=run_id)
        
        # Add location to keywords to filter results
        location_keywords = [f"{kw} {location}" for kw in keywords]
        
        # Use Apify LinkedIn Posts by Keywords actor
        input_data = {
            "keywords": location_keywords,
            "maxPosts": limit,
            "proxy": {"useApifyProxy": True}
        }
        
        await log_scrapper_event(scrapper_id, "INFO", f"Calling Apify with keywords: {location_keywords[:5]}", run_id=run_id)
        
        results = await run_apify_actor(APIFY_ACTORS["linkedin_posts_keywords"], input_data)
        
        await log_scrapper_event(scrapper_id, "INFO", f"Apify returned {len(results)} posts", run_id=run_id)
        
        # Extract unique authors
        authors_added = 0
        for post in results:
            author_name = post.get("authorName") or post.get("author", {}).get("name") or post.get("authorFullName")
            author_url = post.get("authorProfileUrl") or post.get("authorUrl") or post.get("authorLinkedinUrl")
            author_headline = post.get("authorHeadline") or post.get("author", {}).get("headline", "") or post.get("authorTitle", "")
            
            if not author_name or not author_url:
                continue
            
            # Normalize URL
            if not author_url.startswith("http"):
                author_url = f"https://linkedin.com{author_url}" if author_url.startswith("/") else f"https://linkedin.com/in/{author_url}"
            
            # Check if already exists
            existing = await db.deal_makers.find_one({"linkedin_url": author_url})
            if existing:
                continue
            
            # Create deal maker
            doc = {
                "id": str(uuid.uuid4()),
                "name": author_name,
                "linkedin_url": author_url,
                "headline": author_headline,
                "company": post.get("authorCompany", ""),
                "location": location,
                "buyer_persona": "mateo",
                "source": "linkedin_post",
                "source_details": {
                    "post_content": (post.get("text") or post.get("postContent") or "")[:500],
                    "post_url": post.get("url") or post.get("postUrl"),
                    "matched_keyword": post.get("searchKeyword") or post.get("keyword")
                },
                "status": "new",
                "created_at": datetime.now(timezone.utc).isoformat()
            }
            await db.deal_makers.insert_one(doc)
            authors_added += 1
        
        await db.scraper_runs.update_one(
            {"id": run_id},
            {"$set": {
                "status": "completed",
                "completed_at": datetime.now(timezone.utc).isoformat(),
                "results": {"posts_found": len(results), "deal_makers_added": authors_added}
            }}
        )
        
        await log_scrapper_event(scrapper_id, "SUCCESS", f"Added {authors_added} new deal makers from {len(results)} posts", run_id=run_id)
        
    except Exception as e:
        await log_scrapper_event(scrapper_id, "ERROR", str(e), run_id=run_id)
        await db.scraper_runs.update_one(
            {"id": run_id},
            {"$set": {"status": "failed", "error": str(e)}}
        )


# ============ 1.4 FIND DEAL MAKERS BY POSITION ============

class PositionSearchRequest(BaseModel):
    job_titles: Optional[List[str]] = None
    use_buyer_personas: bool = True
    location: str = "Mexico"
    limit: int = 50

@router.post("/search/deal-makers-by-position")
async def search_deal_makers_by_position(
    request: PositionSearchRequest = None,
    background_tasks: BackgroundTasks = None,
    current_user: dict = Depends(get_current_user)
):
    """Search for deal makers by job position/title"""
    # Handle both body and query params for backwards compatibility
    if request is None:
        request = PositionSearchRequest()
    
    search_titles = request.job_titles or []
    
    if request.use_buyer_personas:
        # Get keywords from buyer personas
        personas = await db.buyer_personas_db.find({"active": True}, {"_id": 0}).to_list(50)
        for persona in personas:
            if persona.get("job_titles"):
                search_titles.extend(persona["job_titles"])
            elif persona.get("keywords"):
                search_titles.extend(persona["keywords"])
    
    if not search_titles:
        raise HTTPException(status_code=400, detail="No job titles provided")
    
    # Remove duplicates
    search_titles = list(set(search_titles))[:30]
    
    # Create run
    run_id = str(uuid.uuid4())
    run_doc = {
        "id": run_id,
        "scrapper_id": "deal_makers_by_position",
        "status": "running",
        "started_at": datetime.now(timezone.utc).isoformat(),
        "started_by": current_user.get("email"),
        "params": {"job_titles": search_titles, "location": request.location, "limit": request.limit}
    }
    await db.scraper_runs.insert_one(run_doc)
    
    # Run in background
    background_tasks.add_task(
        run_linkedin_profile_search_by_title,
        run_id, search_titles, request.location, request.limit
    )
    
    return {"success": True, "run_id": run_id, "titles_count": len(search_titles)}


async def run_linkedin_profile_search_by_title(run_id: str, titles: List[str], location: str = "Mexico", limit: int = 50):
    """Search LinkedIn profiles by job title - filtered by location (default: Mexico)
    
    Location is added directly to the search query for more accurate geo-filtering.
    """
    scrapper_id = "deal_makers_by_position"
    
    try:
        await log_scrapper_event(scrapper_id, "INFO", f"Searching profiles with {len(titles)} titles in {location}", run_id=run_id)
        
        # Build search query from titles AND location for accurate geo-filtering
        search_query = f"{' OR '.join(titles[:5])} {location}"
        
        # Use Apify LinkedIn Profile Search with correct format
        input_data = {
            "searchQuery": search_query,
            "profileScraperMode": "Short",
            "takePages": 2,
        }
        
        await log_scrapper_event(scrapper_id, "INFO", f"Calling Apify with query: {search_query}", run_id=run_id)
        
        results = await run_apify_actor(APIFY_ACTORS["linkedin_profile_search"], input_data)
        
        await log_scrapper_event(scrapper_id, "INFO", f"Apify returned {len(results)} results", run_id=run_id)
        
        profiles_added = 0
        profiles_filtered = 0
        for profile in results:
            # Handle the actual field names from harvestapi/linkedin-profile-search
            first_name = profile.get("firstName", "")
            last_name = profile.get("lastName", "")
            name = f"{first_name} {last_name}".strip()
            
            url = profile.get("linkedinUrl", "")
            
            # Get headline from summary or current position
            headline = profile.get("summary", "")[:200] if profile.get("summary") else ""
            current_positions = profile.get("currentPositions", [])
            if current_positions and not headline:
                pos = current_positions[0]
                headline = f"{pos.get('title', '')} at {pos.get('companyName', '')}"
            
            # Get company from current position
            company = ""
            if current_positions:
                company = current_positions[0].get("companyName", "")
            
            # Get location
            profile_location = ""
            if profile.get("location"):
                profile_location = profile["location"].get("linkedinText", "")
            
            if not name or not url:
                continue
            
            # FILTER: Only save profiles from Mexico (the country, not New Mexico US state)
            mexico_indicators = ["mexico city", "méxico", "cdmx", "guadalajara", "monterrey", "puebla", "tijuana", "león", "juárez", "cancún", "mérida", "querétaro", "chihuahua", "hermosillo", "saltillo", "aguascalientes", "morelia", "veracruz", "toluca", "acapulco", "oaxaca", "tabasco", "tampico"]
            location_lower = profile_location.lower()
            
            # Exclude "New Mexico" (US state)
            if "new mexico" in location_lower:
                profiles_filtered += 1
                continue
            
            # Check if it's from Mexico
            is_from_mexico = any(indicator in location_lower for indicator in mexico_indicators)
            # Also check for ", mexico" pattern
            if not is_from_mexico and ", mexico" in location_lower:
                is_from_mexico = True
            
            if not is_from_mexico:
                profiles_filtered += 1
                continue  # Skip profiles not from Mexico
            
            # Normalize URL
            if not url.startswith("http"):
                url = f"https://linkedin.com{url}" if url.startswith("/") else f"https://linkedin.com/in/{url}"
            
            # Check for duplicates in unified_contacts
            existing = await db.unified_contacts.find_one({"linkedin_url": url})
            if existing:
                # Add search tag if not already present
                tag_exists = any(t.get("name") == search_query for t in existing.get("tags", []))
                if not tag_exists:
                    await db.unified_contacts.update_one(
                        {"id": existing["id"]},
                        {"$push": {"tags": {
                            "id": str(uuid.uuid4()),
                            "name": search_query,
                            "type": "search",
                            "created_at": datetime.now(timezone.utc).isoformat(),
                            "details": {"search_location": location}
                        }},
                        "$set": {"updated_at": datetime.now(timezone.utc).isoformat()}}
                    )
                continue
            
            # Try to match buyer persona
            matched_persona = ""
            headline_lower = headline.lower()
            personas = await db.buyer_personas_db.find({"active": True}, {"_id": 0}).to_list(50)
            for persona in personas:
                persona_keywords = persona.get("keywords", []) + persona.get("job_titles", [])
                for kw in persona_keywords:
                    if kw.lower() in headline_lower:
                        matched_persona = persona.get("code") or persona.get("name")
                        break
                if matched_persona:
                    break
            
            # Create tag for this search/opportunity
            now = datetime.now(timezone.utc).isoformat()
            search_tag = {
                "id": str(uuid.uuid4()),
                "name": search_query,
                "type": "search",
                "created_at": now,
                "details": {"search_location": location, "source": "linkedin_position"}
            }
            
            doc = {
                "id": str(uuid.uuid4()),
                "name": name,
                "email": None,
                "phone": None,
                "linkedin_url": url,
                "stage": 1,  # Stage 1 = Prospect
                "company": company,
                "job_title": headline,
                "buyer_persona": matched_persona,
                "status": "new",
                "location": profile_location,
                "tags": [search_tag],
                "source": "linkedin_position",
                "source_keyword": search_query,  # Top-level field for grouping
                "source_details": {"search_location": location, "search_query": search_query},
                "created_at": now,
                "updated_at": now,
                "notes": None
            }
            await db.unified_contacts.insert_one(doc)
            
            # Also keep in deal_makers for backwards compatibility
            await db.deal_makers.insert_one({
                "id": doc["id"],
                "name": name,
                "linkedin_url": url,
                "headline": headline,
                "company": company,
                "location": profile_location,
                "buyer_persona": matched_persona,
                "source": "linkedin_position",
                "source_keyword": search_query,  # Top-level field for grouping
                "source_details": {"search_location": location, "search_query": search_query},
                "status": "new",
                "created_at": now
            })
            profiles_added += 1
        
        await db.scraper_runs.update_one(
            {"id": run_id},
            {"$set": {
                "status": "completed",
                "completed_at": datetime.now(timezone.utc).isoformat(),
                "results": {"profiles_found": len(results), "deal_makers_added": profiles_added, "filtered_non_mexico": profiles_filtered},
                "search_query": search_query
            }}
        )
        
        await log_scrapper_event(scrapper_id, "SUCCESS", f"Added {profiles_added} deal makers from Mexico ({profiles_filtered} filtered out)", run_id=run_id)
        
    except Exception as e:
        await log_scrapper_event(scrapper_id, "ERROR", str(e), run_id=run_id)
        await db.scraper_runs.update_one(
            {"id": run_id},
            {"$set": {"status": "failed", "error": str(e)}}
        )


async def run_linkedin_profile_search(run_id: str, company: str, keywords: List[str], source: str, context: str, location: str = "Mexico"):
    """Generic LinkedIn profile search using Apify harvestapi/linkedin-profile-search
    
    Makes ONE SEARCH PER KEYWORD to maximize coverage.
    Each search query = "{company} {keyword} {location}"
    
    Args:
        company: Company name to search for
        keywords: List of keywords from therapeutic area (one search per keyword)
        location: Filter profiles by location. Default is 'Mexico' for all searches.
    """
    try:
        await log_scrapper_event(source, "INFO", f"Starting multi-keyword search for {company} with {len(keywords)} keywords in {location}", run_id=run_id)
        
        all_search_queries = []
        total_profiles_found = 0
        profiles_added = 0
        profiles_filtered = 0
        profiles_duplicated = 0
        seen_urls = set()  # Track URLs within this run to avoid duplicates
        
        # Make one search per keyword
        for keyword in keywords:
            # Build search query: company + single keyword + location
            search_query = f"{company} {keyword} {location}"
            all_search_queries.append(search_query)
            
            input_data = {
                "searchQuery": search_query,
                "profileScraperMode": "Short",
                "takePages": 1,  # 1 page per keyword to avoid too many API calls
            }
            
            await log_scrapper_event(source, "INFO", f"Searching: {search_query}", run_id=run_id)
            
            try:
                results = await run_apify_actor(APIFY_ACTORS["linkedin_profile_search"], input_data)
                total_profiles_found += len(results)
                
                await log_scrapper_event(source, "INFO", f"Query '{keyword}' returned {len(results)} results", run_id=run_id)
                
                for profile in results:
                    # Handle the actual field names from harvestapi/linkedin-profile-search
                    first_name = profile.get("firstName", "")
                    last_name = profile.get("lastName", "")
                    name = f"{first_name} {last_name}".strip()
                    
                    url = profile.get("linkedinUrl", "")
                    
                    if not name or not url:
                        continue
                    
                    # Normalize URL if needed
                    if not url.startswith("http"):
                        url = f"https://linkedin.com{url}" if url.startswith("/") else f"https://linkedin.com/in/{url}"
                    
                    # Skip if already seen in this run (avoid duplicates across keywords)
                    if url in seen_urls:
                        profiles_duplicated += 1
                        continue
                    seen_urls.add(url)
                    
                    # Get headline from summary or current position
                    headline = profile.get("summary", "")[:200] if profile.get("summary") else ""
                    current_positions = profile.get("currentPositions", [])
                    if current_positions and not headline:
                        pos = current_positions[0]
                        headline = f"{pos.get('title', '')} at {pos.get('companyName', '')}"
                    
                    # Get company from current position
                    profile_company = ""
                    if current_positions:
                        profile_company = current_positions[0].get("companyName", "")
                    
                    # Get location
                    profile_location = ""
                    if profile.get("location"):
                        profile_location = profile["location"].get("linkedinText", "")
                    
                    # FILTER: Only save profiles from Mexico (the country, not New Mexico US state)
                    mexico_indicators = ["mexico city", "méxico", "cdmx", "guadalajara", "monterrey", "puebla", "tijuana", "león", "juárez", "cancún", "mérida", "querétaro", "chihuahua", "hermosillo", "saltillo", "aguascalientes", "morelia", "veracruz", "toluca", "acapulco", "oaxaca", "tabasco", "tampico"]
                    location_lower = profile_location.lower()
                    
                    # Exclude "New Mexico" (US state)
                    if "new mexico" in location_lower:
                        profiles_filtered += 1
                        continue
                    
                    # Check if it's from Mexico
                    is_from_mexico = any(indicator in location_lower for indicator in mexico_indicators)
                    if not is_from_mexico and ", mexico" in location_lower:
                        is_from_mexico = True
                    
                    if not is_from_mexico:
                        profiles_filtered += 1
                        continue
                    
                    # Check for duplicates in unified_contacts by LinkedIn URL
                    existing = await db.unified_contacts.find_one({"linkedin_url": url})
                    if existing:
                        # Add search tag if not already present
                        tag_exists = any(t.get("name") == search_query for t in existing.get("tags", []))
                        if not tag_exists:
                            await db.unified_contacts.update_one(
                                {"id": existing["id"]},
                                {"$push": {"tags": {
                                    "id": str(uuid.uuid4()),
                                    "name": search_query,
                                    "type": "search",
                                    "created_at": datetime.now(timezone.utc).isoformat(),
                                    "details": {"therapeutic_area": context, "company": company, "keyword": keyword}
                                }},
                                "$set": {"updated_at": datetime.now(timezone.utc).isoformat()}}
                            )
                        profiles_duplicated += 1
                        continue
                    
                    # Also check for duplicates by email if available
                    profile_email = profile.get("email") or profile.get("workEmail")
                    if profile_email:
                        existing_by_email = await db.unified_contacts.find_one({
                            "email": {"$elemMatch": {"$eq": profile_email}}
                        })
                        if existing_by_email:
                            profiles_duplicated += 1
                            continue
                    
                    # Create tag for this search/opportunity
                    now = datetime.now(timezone.utc).isoformat()
                    search_tag = {
                        "id": str(uuid.uuid4()),
                        "name": search_query,
                        "type": "search",
                        "created_at": now,
                        "details": {"therapeutic_area": context, "company": company, "keyword": keyword, "source": source}
                    }
                    
                    doc = {
                        "id": str(uuid.uuid4()),
                        "name": name,
                        "email": None,
                        "phone": None,
                        "linkedin_url": url,
                        "stage": 1,
                        "company": profile_company or company,
                        "job_title": headline,
                        "buyer_persona": "mateo",
                        "status": "new",
                        "location": profile_location,
                        "tags": [search_tag],
                        "source": source,
                        "source_keyword": keyword,  # Top-level field for grouping in DealMakers UI
                        "source_details": {"therapeutic_area": context, "company": company, "keyword": keyword, "search_query": search_query},
                        "created_at": now,
                        "updated_at": now,
                        "notes": None
                    }
                    await db.unified_contacts.insert_one(doc)
                    
                    # Also keep in deal_makers for backwards compatibility
                    await db.deal_makers.insert_one({
                        "id": doc["id"],
                        "name": name,
                        "linkedin_url": url,
                        "headline": headline,
                        "company": profile_company or company,
                        "location": profile_location,
                        "buyer_persona": "mateo",
                        "source": source,
                        "source_keyword": keyword,  # Top-level field for grouping
                        "source_details": {"therapeutic_area": context, "company": company, "keyword": keyword, "search_query": search_query},
                        "status": "new",
                        "created_at": now
                    })
                    profiles_added += 1
                    
            except Exception as keyword_error:
                await log_scrapper_event(source, "WARN", f"Error searching '{keyword}': {str(keyword_error)}", run_id=run_id)
                continue
        
        # Update run with all search queries
        await db.scraper_runs.update_one(
            {"id": run_id},
            {"$set": {
                "status": "completed",
                "completed_at": datetime.now(timezone.utc).isoformat(),
                "results": {
                    "total_profiles_found": total_profiles_found,
                    "deal_makers_added": profiles_added,
                    "filtered_non_mexico": profiles_filtered,
                    "duplicates_skipped": profiles_duplicated,
                    "searches_performed": len(all_search_queries)
                },
                "search_queries": all_search_queries,
                "results_count": profiles_added
            }}
        )
        
        await log_scrapper_event(source, "SUCCESS", f"Completed {len(all_search_queries)} searches: {profiles_added} new DMs added, {profiles_duplicated} duplicates, {profiles_filtered} filtered", run_id=run_id)
        
    except Exception as e:
        error_msg = str(e)
        await log_scrapper_event(source, "ERROR", f"Search failed: {error_msg}", run_id=run_id)
        await db.scraper_runs.update_one(
            {"id": run_id},
            {"$set": {"status": "failed", "error": error_msg}}
        )


# ============ 1.5 FIND SMALL BUSINESS (Google Maps) ============

@router.post("/search/small-business")
async def search_small_business(
    business_type: str,
    city: str,
    limit: int = 50,
    background_tasks: BackgroundTasks = None,
    current_user: dict = Depends(get_current_user)
):
    """Search for small businesses using Google Maps scraping"""
    run_id = str(uuid.uuid4())
    run_doc = {
        "id": run_id,
        "scrapper_id": "small_business_maps",
        "status": "running",
        "started_at": datetime.now(timezone.utc).isoformat(),
        "started_by": current_user.get("email"),
        "params": {"business_type": business_type, "city": city, "limit": limit}
    }
    await db.scraper_runs.insert_one(run_doc)
    
    background_tasks.add_task(
        run_google_maps_search,
        run_id, business_type, city, limit
    )
    
    return {"success": True, "run_id": run_id}


async def run_google_maps_search(run_id: str, business_type: str, city: str, limit: int):
    """Search Google Maps for businesses"""
    scrapper_id = "small_business_maps"
    
    try:
        await log_scrapper_event(scrapper_id, "INFO", f"Searching {business_type} in {city}", run_id=run_id)
        
        # Use Apify Google Maps Scraper
        input_data = {
            "searchStringsArray": [f"{business_type} in {city}"],
            "maxCrawledPlacesPerSearch": limit,
            "language": "es",
            "maxImages": 0,
            "maxReviews": 0
        }
        
        results = await run_apify_actor("compass/crawler-google-places", input_data)
        
        businesses = []
        for place in results:
            business = {
                "id": str(uuid.uuid4()),
                "name": place.get("title") or place.get("name"),
                "address": place.get("address"),
                "phone": place.get("phone"),
                "website": place.get("website"),
                "rating": place.get("totalScore") or place.get("rating"),
                "reviews_count": place.get("reviewsCount"),
                "category": place.get("categoryName") or business_type,
                "city": city,
                "google_maps_url": place.get("url"),
                "lat": place.get("location", {}).get("lat"),
                "lng": place.get("location", {}).get("lng"),
                "search_query": f"{business_type} in {city}",
                "created_at": datetime.now(timezone.utc).isoformat()
            }
            businesses.append(business)
            await db.small_businesses.insert_one(business)
        
        await db.scraper_runs.update_one(
            {"id": run_id},
            {"$set": {
                "status": "completed",
                "completed_at": datetime.now(timezone.utc).isoformat(),
                "results": {"businesses_found": len(businesses)}
            }}
        )
        
        await log_scrapper_event(scrapper_id, "SUCCESS", f"Found {len(businesses)} businesses", run_id=run_id)
        
    except Exception as e:
        await log_scrapper_event(scrapper_id, "ERROR", str(e), run_id=run_id)
        await db.scraper_runs.update_one(
            {"id": run_id},
            {"$set": {"status": "failed", "error": str(e)}}
        )


@router.get("/small-business")
async def get_small_businesses(
    city: str = None,
    category: str = None,
    limit: int = 100,
    current_user: dict = Depends(get_current_user)
):
    """Get small businesses from previous searches"""
    query = {}
    if city:
        query["city"] = {"$regex": city, "$options": "i"}
    if category:
        query["category"] = {"$regex": category, "$options": "i"}
    
    businesses = await db.small_businesses.find(query, {"_id": 0}).sort("created_at", -1).limit(limit).to_list(limit)
    
    return {"businesses": businesses, "total": len(businesses)}


@router.delete("/small-business/{business_id}")
async def delete_small_business(
    business_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Delete a small business"""
    result = await db.small_businesses.delete_one({"id": business_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Business not found")
    return {"success": True, "message": "Business deleted"}


@router.delete("/small-business")
async def delete_all_small_businesses(
    current_user: dict = Depends(get_current_user)
):
    """Delete ALL small businesses from Google Maps scraping (1.3.3 cleanup)"""
    # Count before deletion
    count_before = await db.small_businesses.count_documents({})
    
    if count_before == 0:
        return {
            "success": True,
            "deleted_count": 0,
            "message": "No small businesses found to delete"
        }
    
    # Delete all
    result = await db.small_businesses.delete_many({})
    
    # Also clear related WhatsApp message logs
    logs_deleted = await db.whatsapp_message_logs.delete_many({})
    
    return {
        "success": True,
        "deleted_count": result.deleted_count,
        "logs_deleted": logs_deleted.deleted_count,
        "message": f"Deleted {result.deleted_count} small businesses and {logs_deleted.deleted_count} message logs"
    }


# ============ WHATSAPP MESSAGING HISTORY ============

class WhatsAppMessageLog(BaseModel):
    business_id: str
    business_name: str
    phone: str
    template_used: str
    message_sent: str
    notes: Optional[str] = None

@router.post("/whatsapp/log-message")
async def log_whatsapp_message(
    message_log: WhatsAppMessageLog,
    current_user: dict = Depends(get_current_user)
):
    """Log a WhatsApp message sent to a business"""
    log_entry = {
        "id": str(uuid.uuid4()),
        "business_id": message_log.business_id,
        "business_name": message_log.business_name,
        "phone": message_log.phone,
        "template_used": message_log.template_used,
        "message_sent": message_log.message_sent,
        "notes": message_log.notes,
        "sent_by": current_user.get("email"),
        "sent_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.whatsapp_message_logs.insert_one(log_entry)
    
    # Also update the business to mark it as contacted
    await db.small_businesses.update_one(
        {"id": message_log.business_id},
        {
            "$set": {
                "whatsapp_contacted": True,
                "last_contacted_at": datetime.now(timezone.utc).isoformat()
            },
            "$inc": {"contact_count": 1}
        }
    )
    
    return {"success": True, "log_id": log_entry["id"]}

@router.get("/whatsapp/message-logs")
async def get_whatsapp_message_logs(
    business_id: str = None,
    limit: int = 100,
    current_user: dict = Depends(get_current_user)
):
    """Get WhatsApp message logs"""
    query = {}
    if business_id:
        query["business_id"] = business_id
    
    logs = await db.whatsapp_message_logs.find(query, {"_id": 0}).sort("sent_at", -1).limit(limit).to_list(limit)
    
    return {"logs": logs, "total": len(logs)}

@router.get("/whatsapp/contacted-businesses")
async def get_contacted_businesses(
    current_user: dict = Depends(get_current_user)
):
    """Get list of business IDs that have been contacted via WhatsApp"""
    contacted = await db.small_businesses.find(
        {"whatsapp_contacted": True},
        {"_id": 0, "id": 1, "last_contacted_at": 1, "contact_count": 1}
    ).to_list(1000)
    
    # Return as a dict for easy lookup
    contacted_map = {b["id"]: {
        "last_contacted_at": b.get("last_contacted_at"),
        "contact_count": b.get("contact_count", 1)
    } for b in contacted}
    
    return {"contacted": contacted_map, "total": len(contacted_map)}

@router.delete("/whatsapp/clear-contacted/{business_id}")
async def clear_contacted_status(
    business_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Clear the contacted status for a business"""
    await db.small_businesses.update_one(
        {"id": business_id},
        {"$set": {"whatsapp_contacted": False, "contact_count": 0}}
    )
    
    return {"success": True}


# ============ INTERNAL FUNCTIONS FOR SCHEDULER WORKER ============
# These functions can be called directly by the background scheduler

async def search_molecules_deal_makers_internal(company_name: str, therapeutic_area: str):
    """Internal function to search molecules deal makers - called by scheduler"""
    # Get therapeutic area keywords
    area = await db.therapeutic_areas.find_one({
        "$or": [
            {"code": therapeutic_area.lower().replace(" ", "_")},
            {"name": {"$regex": therapeutic_area, "$options": "i"}}
        ]
    })
    
    keywords = area.get("linkedin_keywords", []) if area else []
    
    if not keywords:
        keywords = [
            f"{therapeutic_area} director",
            f"{therapeutic_area} lead",
            f"head of {therapeutic_area}",
            f"VP {therapeutic_area}"
        ]
    
    # Create search run
    run_id = str(uuid.uuid4())
    run_doc = {
        "id": run_id,
        "scrapper_id": "molecules_deal_makers",
        "status": "running",
        "started_at": datetime.now(timezone.utc).isoformat(),
        "started_by": "scheduler_worker",
        "params": {
            "company": company_name,
            "therapeutic_area": therapeutic_area,
            "keywords": keywords
        }
    }
    await db.scraper_runs.insert_one(run_doc)
    
    # Run search directly (not in background since we're already in background)
    await run_linkedin_profile_search(
        run_id, company_name, keywords, "molecules_deal_makers", therapeutic_area
    )
    
    return {"success": True, "run_id": run_id}


async def search_deal_makers_by_post_internal(keywords: List[str]):
    """Internal function to search deal makers by post - called by scheduler"""
    run_id = str(uuid.uuid4())
    run_doc = {
        "id": run_id,
        "scrapper_id": "deal_makers_by_post",
        "status": "running",
        "started_at": datetime.now(timezone.utc).isoformat(),
        "started_by": "scheduler_worker",
        "params": {
            "keywords": keywords
        }
    }
    await db.scraper_runs.insert_one(run_doc)
    
    # Search LinkedIn posts (simplified - uses same profile search)
    search_query = " OR ".join([f'"{kw}"' for kw in keywords[:5]])
    
    try:
        await run_linkedin_profile_search(
            run_id, "", keywords, "deal_makers_by_post", "LinkedIn Posts"
        )
    except Exception as e:
        await db.scraper_runs.update_one(
            {"id": run_id},
            {"$set": {"status": "failed", "error": str(e)}}
        )
    
    return {"success": True, "run_id": run_id}


async def search_deal_makers_by_position_internal(keywords: List[str], buyer_persona: str = None):
    """Internal function to search deal makers by position - called by scheduler"""
    run_id = str(uuid.uuid4())
    run_doc = {
        "id": run_id,
        "scrapper_id": "deal_makers_by_position",
        "status": "running",
        "started_at": datetime.now(timezone.utc).isoformat(),
        "started_by": "scheduler_worker",
        "params": {
            "job_titles": keywords,
            "buyer_persona": buyer_persona
        }
    }
    await db.scraper_runs.insert_one(run_doc)
    
    # Search for each job title
    try:
        await run_linkedin_profile_search(
            run_id, "", keywords, "deal_makers_by_position", buyer_persona or "Position Search"
        )
    except Exception as e:
        await db.scraper_runs.update_one(
            {"id": run_id},
            {"$set": {"status": "failed", "error": str(e)}}
        )
    
    return {"success": True, "run_id": run_id}


async def search_small_business_internal(business_type: str, city: str, limit: int = 50):
    """Internal function to search small businesses - called by scheduler"""
    run_id = str(uuid.uuid4())
    run_doc = {
        "id": run_id,
        "scrapper_id": "small_business_maps",
        "status": "running",
        "started_at": datetime.now(timezone.utc).isoformat(),
        "started_by": "scheduler_worker",
        "params": {
            "business_type": business_type,
            "city": city,
            "limit": limit
        }
    }
    await db.scraper_runs.insert_one(run_doc)
    
    try:
        # Run the actual Google Maps search
        await run_google_maps_search(run_id, business_type, city, limit)
    except Exception as e:
        await db.scraper_runs.update_one(
            {"id": run_id},
            {"$set": {"status": "failed", "error": str(e)}}
        )
    
    return {"success": True, "run_id": run_id}



async def scrape_pharma_pipelines_internal():
    """Internal function to trigger pharma pipeline scraping from scheduler"""
    import uuid
    
    run_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    
    run_doc = {
        "id": run_id,
        "scrapper_id": "pharma_pipelines",
        "status": "running",
        "started_at": now,
        "started_by": "scheduler_worker",
        "params": {}
    }
    await db.scraper_runs.insert_one(run_doc)
    
    try:
        await run_pharma_pipelines_scrapper(run_id)
        return {"success": True, "run_id": run_id}
    except Exception as e:
        await db.scraper_runs.update_one(
            {"id": run_id},
            {"$set": {"status": "failed", "error": str(e)}}
        )
        return {"success": False, "error": str(e)}
