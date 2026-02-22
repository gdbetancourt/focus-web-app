"""
Legacy module containing all existing routers
This file contains the original code that will be gradually refactored into separate modules
"""
from fastapi import APIRouter, HTTPException, Depends, Request, Response, BackgroundTasks, Body
from fastapi.responses import RedirectResponse
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone, timedelta
import uuid
import httpx
import base64
import re
import json
import logging
import os

# Emergent LLM Integration
from emergentintegrations.llm.chat import LlmChat

# Google OAuth imports
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import Flow
from googleapiclient.discovery import build
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

from database import db
from config import (
    EMERGENT_LLM_KEY, HUBSPOT_TOKEN, HUBSPOT_LIST_ID, HUBSPOT_ACCOUNT_ID,
    PIPELINE_COHORTES_ID, PIPELINE_PROYECTOS_ID,
    STAGE_DM_IDENTIFICADO_ID, STAGE_INTERES_CASO_ID,
    GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_SCOPES
)
from routers.auth import get_current_user

logger = logging.getLogger(__name__)

# 1x1 transparent GIF pixel
TRACKING_PIXEL = base64.b64decode("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7")

# Google OAuth redirect URI (set dynamically)
GOOGLE_REDIRECT_URI = None

# Create routers
events_router = APIRouter(prefix="/events", tags=["events"])
hubspot_router = APIRouter(prefix="/hubspot", tags=["hubspot"])
templates_router = APIRouter(prefix="/templates", tags=["templates"])
campaigns_router = APIRouter(prefix="/campaigns", tags=["campaigns"])
tracking_router = APIRouter(prefix="/tracking", tags=["tracking"])
settings_router = APIRouter(prefix="/settings", tags=["settings"])
emails_router = APIRouter(prefix="/emails", tags=["emails"])
preview_router = APIRouter(prefix="/preview", tags=["preview"])
gmail_router = APIRouter(prefix="/gmail", tags=["gmail"])
thematic_axes_router = APIRouter(prefix="/thematic-axes", tags=["thematic-axes"])
buyer_personas_router = APIRouter(prefix="/buyer-personas-db", tags=["buyer-personas-db"])
dashboard_router = APIRouter(prefix="/dashboard", tags=["dashboard"])
misc_router = APIRouter(tags=["misc"])  # For endpoints without prefix

# Helper functions
async def get_settings() -> dict:
    settings = await db.settings.find_one({}, {"_id": 0})
    return settings or {}

async def get_hubspot_token() -> str:
    """Get HubSpot token - prioritize MongoDB settings over env var"""
    # Try to get from MongoDB settings first
    settings = await db.settings.find_one({})
    if settings and settings.get('hubspot_token'):
        return settings['hubspot_token']
    # Fallback to env var
    return HUBSPOT_TOKEN

async def get_hubspot_headers() -> dict:
    token = await get_hubspot_token()
    return {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }

# Import models that were defined inline
from models.schemas import (
    WebinarEvent, HubSpotContact, HubSpotCompany, 
    EmailTemplateCreate, EmailTemplateResponse,
    CampaignCreate, CampaignResponse, SettingsUpdate,
    EmailPreviewRequest, EmailPreviewResponse, ScheduledEmail,
    CampaignConfirmationRequest, CampaignConfirmationResponse,
    CreateEventRequest, UpdateEventRequest, CSVContact, CSVImportRequest,
    IndustryMapping, BuyerPersonaDB, BuyerPersonaDBUpdate,
    ReviewContactsRequest, GenerateEventTitleRequest,
    ThematicAxisCreate, ThematicAxisUpdate
)

# ============ EVENTS ROUTES ============

@events_router.get("/", response_model=List[WebinarEvent])
async def get_events(
    buyer_persona: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    status: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Get events with optional filters"""
    query = {}
    
    if buyer_persona:
        query["buyer_personas"] = buyer_persona
    
    if date_from:
        query["date"] = {"$gte": date_from}
    
    if date_to:
        if "date" in query:
            query["date"]["$lte"] = date_to
        else:
            query["date"] = {"$lte": date_to}
    
    if status:
        query["status"] = status
    
    events = await db.webinar_events.find(query, {"_id": 0}).sort("date", -1).to_list(100)
    return events

@events_router.get("/public")
async def get_public_events(date_from: Optional[str] = None):
    """Get published events for public display (no auth required)"""
    query = {"status": "published"}
    
    if date_from:
        query["date"] = {"$gte": date_from}
    else:
        # Default to today
        today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        query["date"] = {"$gte": today}
    
    events = await db.webinar_events.find(
        query, 
        {"_id": 0, "buyer_personas": 0}  # Exclude buyer_personas from public view
    ).sort("date", 1).to_list(100)
    
    return events

@events_router.get("/checklist")
async def get_events_checklist(current_user: dict = Depends(get_current_user)):
    """Get events with completion status for checklist view"""
    events = await db.webinar_events.find({}, {"_id": 0}).sort("date", -1).to_list(100)
    
    checklist = []
    for event in events:
        item = {
            "id": event.get("id"),
            "name": event.get("name"),
            "date": event.get("date"),
            "status": event.get("status", "draft"),
            "buyer_personas": event.get("buyer_personas", []),
            "checks": {
                "has_name": bool(event.get("name")),
                "has_description": bool(event.get("description")),
                "has_date": bool(event.get("date")),
                "has_time": bool(event.get("time")),
                "has_url_website": bool(event.get("url_website")),
                "has_url_linkedin": bool(event.get("url_linkedin")),
                "has_buyer_personas": bool(event.get("buyer_personas") and len(event.get("buyer_personas")) > 0),
                "has_cover_image": bool(event.get("cover_image")),
            },
            "completion_percentage": 0
        }
        # Calculate completion percentage
        checks = item["checks"]
        completed = sum(1 for v in checks.values() if v)
        item["completion_percentage"] = int((completed / len(checks)) * 100)
        
        # Auto-publish if 100% complete
        if item["completion_percentage"] == 100 and event.get("status") != "published":
            await db.webinar_events.update_one(
                {"id": event.get("id")},
                {"$set": {"status": "published", "updated_at": datetime.now(timezone.utc).isoformat()}}
            )
            item["status"] = "published"
            logger.info(f"Auto-published event {event.get('id')} - 100% complete")
        
        checklist.append(item)
    
    return checklist

@events_router.get("/{event_id}", response_model=WebinarEvent)
async def get_event(event_id: str, current_user: dict = Depends(get_current_user)):
    """Get a single event by ID"""
    event = await db.webinar_events.find_one({"id": event_id}, {"_id": 0})
    if not event:
        raise HTTPException(status_code=404, detail="Evento no encontrado")
    return event

@events_router.post("/", response_model=WebinarEvent)
async def create_event(event_data: CreateEventRequest, current_user: dict = Depends(get_current_user)):
    """Create a new event"""
    event_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc)
    
    event = WebinarEvent(
        id=event_id,
        name=event_data.name,
        description=event_data.description,
        date=event_data.date,
        time=event_data.time,
        url_website=event_data.url_website,
        url_linkedin=event_data.url_linkedin,
        buyer_personas=event_data.buyer_personas,
        status=event_data.status,
        created_at=now,
        updated_at=now
    )
    
    event_dict = event.model_dump()
    event_dict['created_at'] = event_dict['created_at'].isoformat()
    event_dict['updated_at'] = event_dict['updated_at'].isoformat()
    
    await db.webinar_events.insert_one(event_dict)
    
    logger.info(f"Created event: {event.name}")
    return event

@events_router.put("/{event_id}", response_model=WebinarEvent)
async def update_event(event_id: str, event_data: UpdateEventRequest, current_user: dict = Depends(get_current_user)):
    """Update an existing event"""
    existing = await db.webinar_events.find_one({"id": event_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Evento no encontrado")
    
    update_data = {k: v for k, v in event_data.model_dump().items() if v is not None}
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    await db.webinar_events.update_one(
        {"id": event_id},
        {"$set": update_data}
    )
    
    updated = await db.webinar_events.find_one({"id": event_id}, {"_id": 0})
    logger.info(f"Updated event: {event_id}")
    return updated

@events_router.delete("/{event_id}")
async def delete_event(event_id: str, current_user: dict = Depends(get_current_user)):
    """Delete an event"""
    result = await db.webinar_events.delete_one({"id": event_id})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Evento no encontrado")
    
    logger.info(f"Deleted event: {event_id}")
    return {"success": True, "message": "Evento eliminado"}

@events_router.post("/{event_id}/generate-content")
async def generate_event_content(event_id: str, current_user: dict = Depends(get_current_user)):
    """Generate description and cover image for an event using AI"""
    event = await db.webinar_events.find_one({"id": event_id}, {"_id": 0})
    if not event:
        raise HTTPException(status_code=404, detail="Evento no encontrado")
    
    # Get buyer persona details
    buyer_persona_descriptions = []
    if event.get("buyer_personas"):
        headers = await get_hubspot_headers()
        try:
            async with httpx.AsyncClient(timeout=30.0) as http_client:
                url = "https://api.hubapi.com/crm/v3/properties/contacts/hs_persona"
                response = await http_client.get(url, headers=headers)
                if response.status_code == 200:
                    data = response.json()
                    for opt in data.get('options', []):
                        if opt.get('value') in event.get("buyer_personas", []):
                            name = opt.get('description') or opt.get('label', '')
                            desc = opt.get('label', '')
                            buyer_persona_descriptions.append(f"{name}: {desc}")
        except Exception as e:
            logger.error(f"Error fetching buyer personas: {e}")
    
    persona_context = "\n".join(buyer_persona_descriptions) if buyer_persona_descriptions else "Profesionales de negocios"
    
    # Get LLM key
    import os as os_module
    llm_key = os_module.environ.get("EMERGENT_LLM_KEY")
    
    # Generate description using emergentintegrations
    generated_description = None
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage
        
        desc_prompt = f"""Genera una descripción corta y atractiva (máximo 3 oraciones) para un evento corporativo.

Título del evento: {event.get('name')}
Fecha: {event.get('date', 'Por confirmar')}
Audiencia objetivo: {persona_context}

La descripción debe:
- Ser profesional pero cercana
- Mencionar brevemente el valor del evento
- Invitar a participar sin ser muy comercial
- Estar en español

Responde SOLO con la descripción, sin comillas ni formato adicional."""

        chat = LlmChat(
            api_key=llm_key,
            session_id=f"event-desc-{event_id}",
            system_message="Eres un experto en marketing de eventos corporativos."
        )
        chat.with_model("gemini", "gemini-2.0-flash")
        
        msg = UserMessage(text=desc_prompt)
        response = await chat.send_message(msg)
        generated_description = response.strip()
        
    except Exception as e:
        logger.error(f"Error generating description: {e}")
        generated_description = None
    
    # Generate cover image using Nano Banana (Gemini Image Generation)
    generated_cover = None
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage
        import base64 as b64_module
        
        image_prompt = f"""Create a professional, modern corporate event banner image.
Theme: {event.get('name')}
Style: Clean, minimalist, professional
Colors: Use warm orange/red accents (#ff3300) with dark backgrounds (#1c1e2c)
Do NOT include any text in the image.
The image should convey innovation, professionalism, and business growth.
Abstract geometric shapes or subtle business-related imagery would work well.
Horizontal 16:9 aspect ratio."""

        chat = LlmChat(
            api_key=llm_key, 
            session_id=f"event-cover-{event_id}", 
            system_message="You are an expert graphic designer creating professional event banners."
        )
        chat.with_model("gemini", "gemini-3-pro-image-preview").with_params(modalities=["image", "text"])
        
        msg = UserMessage(text=image_prompt)
        text_response, images = await chat.send_message_multimodal_response(msg)
        
        if images and len(images) > 0:
            # Save image to a file and create a URL
            img_data = images[0]
            image_bytes = b64_module.b64decode(img_data['data'])
            
            # Save to static folder
            static_folder = "/app/frontend/public/event-covers"
            os_module.makedirs(static_folder, exist_ok=True)
            
            image_filename = f"{event_id}.png"
            image_path = f"{static_folder}/{image_filename}"
            
            with open(image_path, "wb") as f:
                f.write(image_bytes)
            
            # Return relative URL
            generated_cover = f"/event-covers/{image_filename}"
            logger.info(f"Generated cover image for event {event_id}")
            
    except Exception as e:
        logger.error(f"Error generating cover image: {e}")
    
    # Update event with generated content
    update_data = {"updated_at": datetime.now(timezone.utc).isoformat()}
    if generated_description:
        update_data["description"] = generated_description
    if generated_cover:
        update_data["cover_image"] = generated_cover
    
    await db.webinar_events.update_one(
        {"id": event_id},
        {"$set": update_data}
    )
    
    return {
        "success": True,
        "description": generated_description,
        "cover_image": generated_cover,
        "message": "Contenido generado exitosamente"
    }

# ============ HUBSPOT CONTACTS ROUTES ============
# DEPRECATED: These endpoints use legacy hubspot_contacts collection
# Use /api/contacts instead which reads from unified_contacts

# HubSpot List ID for contacts
HUBSPOT_CONTACT_LIST_ID = "13417"

@hubspot_router.get("/contacts", response_model=List[HubSpotContact], deprecated=True)
async def get_hubspot_contacts(current_user: dict = Depends(get_current_user)):
    """
    DEPRECATED: Use GET /api/contacts instead.
    This endpoint reads from legacy hubspot_contacts collection.
    """
    logger.warning("DEPRECATED: /api/hubspot/contacts called - use /api/contacts instead")
    headers = await get_hubspot_headers()
    
    # First try to return cached contacts
    cached = await db.hubspot_contacts.find({}, {"_id": 0}).to_list(2000)
    if cached:
        # Build company industry map with flexible matching
        company_industry_map = {}
        companies = await db.unified_companies.find({"is_merged": {"$ne": True}}, {"_id": 0, "name": 1, "industry": 1}).to_list(10000)
        for company in companies:
            if company.get("name") and company.get("industry"):
                # Normalize company name: lowercase, remove special chars
                name_lower = company["name"].lower().strip()
                name_normalized = ''.join(c for c in name_lower if c.isalnum() or c == ' ')
                company_industry_map[name_lower] = company["industry"]
                company_industry_map[name_normalized] = company["industry"]
        
        enriched = []
        needs_update = []
        for contact in cached:
            if not contact.get("company_industry") and contact.get("company"):
                company_name = contact["company"].lower().strip()
                company_normalized = ''.join(c for c in company_name if c.isalnum() or c == ' ')
                
                # Try different matching strategies
                industry = company_industry_map.get(company_name) or \
                           company_industry_map.get(company_normalized) or \
                           company_industry_map.get(company_name.replace('-', ' ')) or \
                           company_industry_map.get(company_name.replace(',', ''))
                
                # Partial match as last resort
                if not industry:
                    for key, val in company_industry_map.items():
                        if company_normalized in key or key in company_normalized:
                            industry = val
                            break
                
                if industry:
                    contact["company_industry"] = industry
                    needs_update.append(contact)
            enriched.append(contact)
        
        # Batch update contacts that were enriched
        if needs_update:
            logger.info(f"Enriching {len(needs_update)} contacts with company_industry")
            for contact in needs_update:
                await db.hubspot_contacts.update_one(
                    {"id": contact["id"]},
                    {"$set": {"company_industry": contact.get("company_industry")}}
                )
        
        return enriched
    
    try:
        async with httpx.AsyncClient(timeout=60.0) as http_client:
            # Get contacts from the specific list using Lists API
            list_url = f"https://api.hubapi.com/crm/v3/lists/{HUBSPOT_CONTACT_LIST_ID}/memberships"
            
            all_contact_ids = []
            after = None
            
            # Paginate to get all contact IDs in the list
            while True:
                params = {"limit": 100}
                if after:
                    params["after"] = after
                    
                response = await http_client.get(list_url, headers=headers, params=params)
                
                if response.status_code != 200:
                    logger.error(f"Failed to get list memberships: {response.text}")
                    break
                    
                data = response.json()
                results = data.get("results", [])
                
                for item in results:
                    contact_id = item.get("recordId")
                    if contact_id:
                        all_contact_ids.append(contact_id)
                
                # Check for pagination
                paging = data.get("paging", {})
                next_page = paging.get("next", {})
                after = next_page.get("after")
                
                if not after:
                    break
            
            logger.info(f"Found {len(all_contact_ids)} contacts in list {HUBSPOT_CONTACT_LIST_ID}")
            
            if not all_contact_ids:
                return []
            
            # Now fetch contact details in batches
            contacts = []
            batch_size = 100
            
            for i in range(0, len(all_contact_ids), batch_size):
                batch_ids = all_contact_ids[i:i + batch_size]
                
                # Use batch read API to get contact properties
                batch_url = "https://api.hubapi.com/crm/v3/objects/contacts/batch/read"
                batch_payload = {
                    "inputs": [{"id": str(cid)} for cid in batch_ids],
                    "properties": ["firstname", "lastname", "email", "phone", "company", "jobtitle", "hs_persona"]
                }
                
                batch_response = await http_client.post(batch_url, headers=headers, json=batch_payload)
                
                if batch_response.status_code == 200:
                    batch_data = batch_response.json()
                    
                    for result in batch_data.get("results", []):
                        props = result.get("properties", {})
                        contact = HubSpotContact(
                            id=result.get("id"),
                            email=props.get("email"),
                            firstname=props.get("firstname"),
                            lastname=props.get("lastname"),
                            company=props.get("company"),
                            phone=props.get("phone"),
                            jobtitle=props.get("jobtitle"),
                            buyer_persona=props.get("hs_persona"),
                            properties=props
                        )
                        contacts.append(contact)
                        
                        # Cache contact - preserve classification fields
                        contact_dict = contact.model_dump()
                        try:
                            # Get existing contact to preserve classification fields
                            existing = await db.hubspot_contacts.find_one({"id": contact.id}, {"_id": 0})
                            if existing:
                                # Preserve classification fields
                                for field in ['buyer_persona', 'buyer_persona_name', 'buyer_persona_display_name',
                                              'classified_area', 'classified_sector', 'classification_confidence']:
                                    if existing.get(field) and not contact_dict.get(field):
                                        contact_dict[field] = existing[field]
                            
                            await db.hubspot_contacts.update_one(
                                {"id": contact.id},
                                {"$set": contact_dict},
                                upsert=True
                            )
                        except Exception as cache_error:
                            logger.error(f"Failed to cache contact {contact.id}: {cache_error}")
                else:
                    logger.error(f"Batch read failed: {batch_response.text}")
            
            return contacts
                
    except httpx.RequestError as e:
        logger.error(f"HubSpot request error: {e}")
        if cached:
            return cached
        raise HTTPException(status_code=500, detail="Failed to connect to HubSpot")

@hubspot_router.post("/sync", deprecated=True)
async def sync_hubspot_contacts(current_user: dict = Depends(get_current_user)):
    """
    DEPRECATED: HubSpot sync is no longer needed.
    All contacts are now managed in unified_contacts collection.
    """
    logger.warning("DEPRECATED: /api/hubspot/sync called - HubSpot sync is no longer needed")
    headers = await get_hubspot_headers()
    
    # First, get all existing contacts with their classifications to preserve them
    existing_classifications = {}
    existing_contacts = await db.hubspot_contacts.find({}, {"_id": 0}).to_list(2000)
    for contact in existing_contacts:
        if contact.get("id"):
            existing_classifications[contact["id"]] = {
                "buyer_persona": contact.get("buyer_persona"),
                "buyer_persona_name": contact.get("buyer_persona_name"),
                "buyer_persona_display_name": contact.get("buyer_persona_display_name"),
                "classified_area": contact.get("classified_area"),
                "classified_sector": contact.get("classified_sector"),
                "classification_confidence": contact.get("classification_confidence"),
                "company_industry": contact.get("company_industry")
            }
    
    try:
        async with httpx.AsyncClient(timeout=60.0) as http_client:
            # Get contacts from the specific list using Lists API
            list_url = f"https://api.hubapi.com/crm/v3/lists/{HUBSPOT_CONTACT_LIST_ID}/memberships"
            
            all_contact_ids = []
            after = None
            
            while True:
                params = {"limit": 100}
                if after:
                    params["after"] = after
                    
                response = await http_client.get(list_url, headers=headers, params=params)
                
                if response.status_code != 200:
                    logger.error(f"Failed to get list memberships: {response.text}")
                    break
                    
                data = response.json()
                results = data.get("results", [])
                
                for item in results:
                    contact_id = item.get("recordId")
                    if contact_id:
                        all_contact_ids.append(contact_id)
                
                paging = data.get("paging", {})
                next_page = paging.get("next", {})
                after = next_page.get("after")
                
                if not after:
                    break
            
            logger.info(f"Found {len(all_contact_ids)} contacts in list {HUBSPOT_CONTACT_LIST_ID}")
            
            if not all_contact_ids:
                return {"message": "No contacts found in list", "count": 0}
            
            # Build company -> industry map from local companies database
            company_industry_map = {}
            companies = await db.companies.find({"is_active": True}, {"_id": 0, "name": 1, "industry": 1}).to_list(10000)
            for company in companies:
                if company.get("name"):
                    company_industry_map[company["name"].lower()] = company.get("industry", "")
            
            # Fetch contact details in batches
            synced_count = 0
            batch_size = 100
            
            for i in range(0, len(all_contact_ids), batch_size):
                batch_ids = all_contact_ids[i:i + batch_size]
                
                batch_url = "https://api.hubapi.com/crm/v3/objects/contacts/batch/read"
                batch_payload = {
                    "inputs": [{"id": str(cid)} for cid in batch_ids],
                    "properties": ["firstname", "lastname", "email", "phone", "company", "jobtitle"]
                }
                
                batch_response = await http_client.post(batch_url, headers=headers, json=batch_payload)
                
                if batch_response.status_code == 200:
                    batch_data = batch_response.json()
                    
                    for result in batch_data.get("results", []):
                        props = result.get("properties", {})
                        contact_id = result.get("id")
                        
                        # Get company industry from our companies database
                        company_name = props.get("company", "")
                        company_industry = ""
                        if company_name:
                            company_industry = company_industry_map.get(company_name.lower(), "")
                        
                        # Build contact dict - DO NOT use hs_persona from HubSpot
                        contact_dict = {
                            "id": contact_id,
                            "email": props.get("email"),
                            "firstname": props.get("firstname"),
                            "lastname": props.get("lastname"),
                            "company": company_name,
                            "phone": props.get("phone"),
                            "jobtitle": props.get("jobtitle"),
                            "company_industry": company_industry,
                            "properties": props
                        }
                        
                        # Restore preserved classification if exists
                        if contact_id in existing_classifications:
                            saved = existing_classifications[contact_id]
                            contact_dict["buyer_persona"] = saved.get("buyer_persona")
                            contact_dict["buyer_persona_name"] = saved.get("buyer_persona_name")
                            contact_dict["buyer_persona_display_name"] = saved.get("buyer_persona_display_name")
                            contact_dict["classified_area"] = saved.get("classified_area")
                            contact_dict["classified_sector"] = saved.get("classified_sector")
                            contact_dict["classification_confidence"] = saved.get("classification_confidence")
                            # Also preserve company_industry if we had it
                            if saved.get("company_industry") and not company_industry:
                                contact_dict["company_industry"] = saved.get("company_industry")
                        
                        await db.hubspot_contacts.update_one(
                            {"id": contact_id},
                            {"$set": contact_dict},
                            upsert=True
                        )
                        synced_count += 1
                else:
                    logger.error(f"Batch read failed: {batch_response.text}")
            
            return {"message": f"Synced {synced_count} contacts (classification preserved)", "count": synced_count}
                
    except httpx.RequestError as e:
        logger.error(f"HubSpot sync error: {e}")
        raise HTTPException(status_code=500, detail="Failed to sync with HubSpot")

@hubspot_router.get("/contact/{contact_id}/deals")
async def get_contact_deals(contact_id: str, current_user: dict = Depends(get_current_user)):
    """Get deals associated with a contact"""
    headers = await get_hubspot_headers()
    
    try:
        async with httpx.AsyncClient(timeout=30.0) as http_client:
            # Get associations
            assoc_url = f"https://api.hubapi.com/crm/v4/objects/contacts/{contact_id}/associations/deals"
            response = await http_client.get(assoc_url, headers=headers)
            
            if response.status_code != 200:
                return {"deals": [], "error": "Could not fetch associations"}
            
            data = response.json()
            deal_ids = [r.get("toObjectId") for r in data.get("results", [])]
            
            if not deal_ids:
                return {"deals": []}
            
            # Get deal details
            deals = []
            for deal_id in deal_ids:
                deal_url = f"https://api.hubapi.com/crm/v3/objects/deals/{deal_id}?properties=dealname,pipeline,dealstage"
                deal_response = await http_client.get(deal_url, headers=headers)
                if deal_response.status_code == 200:
                    deals.append(deal_response.json())
            
            return {"deals": deals}
            
    except Exception as e:
        logger.error(f"Error fetching contact deals: {e}")
        return {"deals": [], "error": str(e)}


# ============ CSV IMPORT ENDPOINT ============

    
    imported = 0
    classified = 0
    duplicates = 0
    errors = []
    
    # Validate event if provided
    event_info = None
    if request.event_id:
        event = await db.webinar_events.find_one({"id": request.event_id}, {"_id": 0, "id": 1, "name": 1})
        if event:
            event_info = {"id": event["id"], "name": event.get("name", "Evento sin nombre")}
    
    # Get existing emails to check for duplicates
    existing_contacts = await db.hubspot_contacts.find({}, {"_id": 0, "email": 1}).to_list(10000)
    existing_emails = set(c.get("email", "").lower() for c in existing_contacts if c.get("email"))
    
    # Get company industry map from local database
    company_industry_map = {}
    companies = await db.companies.find({"is_active": True}, {"_id": 0, "name": 1, "industry": 1}).to_list(10000)
    for company in companies:
        if company.get("name") and company.get("industry"):
            company_industry_map[company["name"].lower()] = company["industry"]
    
    # Get buyer personas and functional areas for classification
    buyer_personas = await db.buyer_personas_db.find({}, {"_id": 0}).to_list(200)
    functional_areas = await db.functional_areas.find({}, {"_id": 0}).to_list(20)
    
    # Build keywords map by area
    area_keywords = {}
    for area in functional_areas:
        area_keywords[area.get("code", "")] = area.get("keywords", [])
    
    # Get active sectors
    active_sectors_docs = await db.industry_mappings.find({"is_active": True}, {"_id": 0}).to_list(50)
    active_sector_values = set(s.get("hubspot_value", "") for s in active_sectors_docs)
    
    now = datetime.now(timezone.utc).isoformat()
    
    for contact in request.contacts:
        try:
            email_lower = contact.email.lower().strip()
            
            # Check for duplicate
            if email_lower in existing_emails:
                duplicates += 1
                continue
            
            # Generate unique ID
            contact_id = f"csv_{str(uuid.uuid4())[:8]}"
            
            # Get company industry
            company_industry = ""
            if contact.company:
                company_industry = company_industry_map.get(contact.company.lower(), "")
            
            # Classify contact
            buyer_persona_code = None
            buyer_persona_display_name = None
            classified_area = None
            classified_sector = None
            classification_confidence = "low"
            
            if request.classify and contact.jobtitle:
                jobtitle_lower = contact.jobtitle.lower()
                
                # Find matching area based on keywords
                matched_area = None
                for area_code, keywords in area_keywords.items():
                    for keyword in keywords:
                        if keyword.lower() in jobtitle_lower:
                            matched_area = area_code
                            break
                    if matched_area:
                        break
                
                if not matched_area:
                    matched_area = "otras"  # Default to "Otras Direcciones"
                
                # Determine sector
                sector_short = "otros_sectores"
                if company_industry and company_industry in active_sector_values:
                    # Map industry to sector short
                    sector_mapping = {
                        "PHARMACEUTICALS": "farma",
                        "MEDICAL_DEVICES": "dispositivos_medicos",
                        "RETAIL": "retail",
                        "BANKING": "banca",
                        "TELECOMMUNICATIONS": "telecomunicaciones",
                        "CONSUMER_GOODS": "consumo",
                        "AUTOMOTIVE": "automotriz",
                        "COMPUTER_SOFTWARE": "tecnologia",
                        "TECHNOLOGY": "tecnologia",
                        "OIL_ENERGY": "energia",
                        "ENERGY": "energia",
                        "INSURANCE": "seguros"
                    }
                    sector_short = sector_mapping.get(company_industry, "otros_sectores")
                
                # Build buyer persona code
                buyer_persona_code = f"{matched_area}_{sector_short}"
                
                # Find matching buyer persona for display name
                for bp in buyer_personas:
                    if bp.get("code") == buyer_persona_code:
                        buyer_persona_display_name = bp.get("display_name") or bp.get("name")
                        classified_area = bp.get("area")
                        classified_sector = bp.get("sector")
                        classification_confidence = "medium"
                        break
                
                if buyer_persona_display_name:
                    classified += 1
            
            # Build contact document
            contact_doc = {
                "id": contact_id,
                "email": email_lower,
                "firstname": contact.firstname or "",
                "lastname": contact.lastname or "",
                "company": contact.company or "",
                "jobtitle": contact.jobtitle or "",
                "phone": contact.phone or "",
                "company_industry": company_industry,
                "buyer_persona": buyer_persona_code,
                "buyer_persona_display_name": buyer_persona_display_name,
                "classified_area": classified_area,
                "classified_sector": classified_sector,
                "classification_confidence": classification_confidence,
                "source": "csv_import",
                "source_event_id": request.event_id,
                "source_event_name": event_info.get("name") if event_info else None,
                "imported_at": now,
                "properties": {}
            }
            
            # Insert into database
            await db.hubspot_contacts.insert_one(contact_doc)
            existing_emails.add(email_lower)
            imported += 1
            
        except Exception as e:
            logger.error(f"Error importing contact {contact.email}: {e}")
            errors.append({"email": contact.email, "error": str(e)})
    
    # Save import record to history
    import_record = {
        "id": f"import_{str(uuid.uuid4())[:8]}",
        "filename": request.event_name or f"csv_import_{now[:10]}",
        "total_rows": len(request.contacts),
        "event_id": request.event_id,
        "event_name": event_info.get("name") if event_info else request.event_name,
        "imported": imported,
        "classified": classified,
        "duplicates": duplicates,
        "errors": len(errors),
        "imported_by": current_user.get("email", "unknown"),
        "imported_at": now,
        "status": "completed" if len(errors) == 0 else "completed_with_errors"
    }
    await db.csv_imports.insert_one(import_record)
    
    return {
        "success": True,
        "imported": imported,
        "classified": classified,
        "duplicates": duplicates,
        "errors": len(errors),
        "error_details": errors[:10] if errors else [],
        "import_id": import_record["id"]
    }


@hubspot_router.get("/imports/history")
async def get_import_history(current_user: dict = Depends(get_current_user), limit: int = 20):
    """Get CSV import history"""
    imports = await db.csv_imports.find(
        {}, 
        {"_id": 0}
    ).sort("imported_at", -1).limit(limit).to_list(limit)
    
    return {"imports": imports, "total": len(imports)}


@hubspot_router.get("/events/stats")
async def get_event_stats(current_user: dict = Depends(get_current_user)):
    """Get contact statistics grouped by source event"""
    
    # Get all contacts with source_event_id
    pipeline = [
        {"$match": {"source_event_id": {"$ne": None}}},
        {"$group": {
            "_id": "$source_event_id",
            "event_name": {"$first": "$source_event_name"},
            "total_contacts": {"$sum": 1},
            "classified_contacts": {
                "$sum": {"$cond": [{"$ne": ["$buyer_persona_display_name", None]}, 1, 0]}
            },
            "areas": {"$push": "$classified_area"},
            "contacts_list": {
                "$push": {
                    "email": "$email",
                    "name": {"$concat": [{"$ifNull": ["$firstname", ""]}, " ", {"$ifNull": ["$lastname", ""]}]},
                    "company": "$company",
                    "jobtitle": "$jobtitle",
                    "area": "$classified_area",
                    "persona": "$buyer_persona_display_name"
                }
            }
        }},
        {"$sort": {"total_contacts": -1}}
    ]
    
    results = await db.hubspot_contacts.aggregate(pipeline).to_list(100)
    
    # Process results to get area distribution
    event_stats = []
    for r in results:
        # Count areas
        area_counts = {}
        for area in r.get("areas", []):
            if area:
                area_counts[area] = area_counts.get(area, 0) + 1
        
        # Get top areas
        top_areas = sorted(area_counts.items(), key=lambda x: x[1], reverse=True)[:5]
        
        event_stats.append({
            "event_id": r["_id"],
            "event_name": r.get("event_name") or "Sin nombre",
            "total_contacts": r["total_contacts"],
            "classified_contacts": r["classified_contacts"],
            "classification_rate": round((r["classified_contacts"] / r["total_contacts"]) * 100, 1) if r["total_contacts"] > 0 else 0,
            "top_areas": [{"area": a[0], "count": a[1]} for a in top_areas],
            "contacts_preview": r.get("contacts_list", [])[:5]
        })
    
    # Get total stats
    total_from_events = sum(e["total_contacts"] for e in event_stats)
    total_classified = sum(e["classified_contacts"] for e in event_stats)
    
    return {
        "events": event_stats,
        "summary": {
            "total_events_with_contacts": len(event_stats),
            "total_contacts_from_events": total_from_events,
            "total_classified": total_classified,
            "overall_classification_rate": round((total_classified / total_from_events) * 100, 1) if total_from_events > 0 else 0
        }
    }


@hubspot_router.get("/events/{event_id}/contacts")
async def get_event_contacts(event_id: str, current_user: dict = Depends(get_current_user)):
    """Get all contacts from a specific event"""
    contacts = await db.hubspot_contacts.find(
        {"source_event_id": event_id},
        {"_id": 0, "id": 1, "email": 1, "firstname": 1, "lastname": 1, "company": 1, 
         "jobtitle": 1, "classified_area": 1, "classified_sector": 1, 
         "buyer_persona_display_name": 1, "imported_at": 1}
    ).to_list(1000)
    
    return {"contacts": contacts, "total": len(contacts), "event_id": event_id}


# ============ CIERRE (CLOSING) ENDPOINTS ============

@hubspot_router.put("/contact/{contact_id}/move-to-cierre")
async def move_contact_to_cierre(
    contact_id: str, 
    reason: str = Body(default="Solicitó propuesta"),
    notes: str = Body(default=""),
    current_user: dict = Depends(get_current_user)
):
    """Move a contact from Nurturing to Cierre stage"""
    from datetime import datetime, timezone
    
    # Check if contact exists
    contact = await db.hubspot_contacts.find_one({"id": contact_id}, {"_id": 0})
    if not contact:
        raise HTTPException(status_code=404, detail="Contacto no encontrado")
    
    now = datetime.now(timezone.utc).isoformat()
    
    # Update contact with cierre stage
    update_data = {
        "pipeline_stage": "cierre",
        "moved_to_cierre_at": now,
        "moved_to_cierre_by": current_user.get("email"),
        "cierre_reason": reason,
        "cierre_notes": notes,
        "cierre_status": "nuevo"  # nuevo, en_proceso, propuesta_enviada, ganado, perdido
    }
    
    await db.hubspot_contacts.update_one(
        {"id": contact_id},
        {"$set": update_data}
    )
    
    # Log the movement
    movement_log = {
        "id": str(uuid.uuid4()),
        "contact_id": contact_id,
        "contact_name": f"{contact.get('firstname', '')} {contact.get('lastname', '')}".strip(),
        "contact_email": contact.get("email"),
        "contact_company": contact.get("company"),
        "from_stage": "nurturing",
        "to_stage": "cierre",
        "reason": reason,
        "notes": notes,
        "moved_by": current_user.get("email"),
        "moved_at": now
    }
    await db.cierre_movements.insert_one(movement_log)
    
    return {
        "success": True, 
        "message": f"Contacto movido a Cierre",
        "contact_id": contact_id,
        "stage": "cierre"
    }


@hubspot_router.get("/cierre/contacts")
async def get_cierre_contacts(
    status: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Get all contacts in Cierre stage"""
    query = {"pipeline_stage": "cierre"}
    
    if status:
        query["cierre_status"] = status
    
    contacts = await db.hubspot_contacts.find(
        query,
        {"_id": 0}
    ).sort("moved_to_cierre_at", -1).to_list(500)
    
    # Get stats
    stats = {
        "total": len(contacts),
        "nuevo": sum(1 for c in contacts if c.get("cierre_status") == "nuevo"),
        "en_proceso": sum(1 for c in contacts if c.get("cierre_status") == "en_proceso"),
        "propuesta_enviada": sum(1 for c in contacts if c.get("cierre_status") == "propuesta_enviada"),
        "ganado": sum(1 for c in contacts if c.get("cierre_status") == "ganado"),
        "perdido": sum(1 for c in contacts if c.get("cierre_status") == "perdido")
    }
    
    return {"contacts": contacts, "stats": stats}


@hubspot_router.put("/cierre/contact/{contact_id}/status")
async def update_cierre_status(
    contact_id: str,
    status: str = Body(..., embed=True),
    current_user: dict = Depends(get_current_user)
):
    """Update the status of a contact in Cierre"""
    valid_statuses = ["nuevo", "en_proceso", "propuesta_enviada", "ganado", "perdido"]
    
    if status not in valid_statuses:
        raise HTTPException(status_code=400, detail=f"Status inválido. Opciones: {valid_statuses}")
    
    result = await db.hubspot_contacts.update_one(
        {"id": contact_id, "pipeline_stage": "cierre"},
        {"$set": {"cierre_status": status, "cierre_status_updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Contacto no encontrado en Cierre")
    
    return {"success": True, "message": f"Status actualizado a '{status}'"}


@hubspot_router.get("/cierre/movements")
async def get_cierre_movements(
    limit: int = 50,
    current_user: dict = Depends(get_current_user)
):
    """Get movement history to Cierre"""
    movements = await db.cierre_movements.find(
        {},
        {"_id": 0}
    ).sort("moved_at", -1).limit(limit).to_list(limit)
    
    return {"movements": movements, "total": len(movements)}


@hubspot_router.put("/contact/{contact_id}/buyer-persona")
async def update_contact_buyer_persona(contact_id: str, buyer_persona: str, current_user: dict = Depends(get_current_user)):
    """Update buyer persona for a contact in HubSpot and local DB"""
    headers = await get_hubspot_headers()
    
    try:
        async with httpx.AsyncClient(timeout=30.0) as http_client:
            # Update in HubSpot
            update_url = f"https://api.hubapi.com/crm/v3/objects/contacts/{contact_id}"
            update_payload = {
                "properties": {
                    "hs_persona": buyer_persona
                }
            }
            
            response = await http_client.patch(update_url, headers=headers, json=update_payload)
            
            if response.status_code != 200:
                raise HTTPException(status_code=response.status_code, detail=f"HubSpot error: {response.text}")
            
            # Update local cache
            await db.hubspot_contacts.update_one(
                {"id": contact_id},
                {"$set": {"buyer_persona": buyer_persona}}
            )
            
            return {"success": True, "message": "Buyer persona actualizado"}
            
    except httpx.RequestError as e:
        logger.error(f"Error updating buyer persona: {e}")
        raise HTTPException(status_code=500, detail="Error al conectar con HubSpot")

@hubspot_router.get("/buyer-personas")
async def get_buyer_personas(current_user: dict = Depends(get_current_user)):
    """Get list of unique buyer personas from contacts with their names and descriptions"""
    # Get unique persona keys from contacts
    persona_keys = await db.hubspot_contacts.distinct("buyer_persona")
    persona_keys = [p for p in persona_keys if p]
    
    # Get persona details from HubSpot
    headers = await get_hubspot_headers()
    persona_details = {}  # key -> {name, description}
    
    try:
        async with httpx.AsyncClient(timeout=30.0) as http_client:
            url = "https://api.hubapi.com/crm/v3/properties/contacts/hs_persona"
            response = await http_client.get(url, headers=headers)
            
            if response.status_code == 200:
                data = response.json()
                for opt in data.get('options', []):
                    key = opt.get('value')
                    # 'description' field contains the short name (e.g., "Mateo")
                    # 'label' field contains the long description
                    persona_details[key] = {
                        "name": opt.get('description') or opt.get('label', key),  # Use description as name, fallback to label
                        "description": opt.get('label', '')
                    }
    except Exception as e:
        logger.error(f"Error fetching persona details: {e}")
    
    # Build response with keys, names and descriptions
    buyer_personas = []
    for key in sorted(persona_keys):
        details = persona_details.get(key, {"name": key, "description": ""})
        buyer_personas.append({
            "key": key,
            "name": details["name"],
            "description": details["description"]
        })
    
    # Build persona_map for backward compatibility (key -> name)
    persona_map = {key: details["name"] for key, details in persona_details.items()}
    
    return {"buyer_personas": buyer_personas, "persona_map": persona_map}


# ============ COMPANIES ROUTES (LOCAL DATABASE) ============

# All HubSpot company properties to fetch during migration
HUBSPOT_COMPANY_PROPERTIES = [
    "name", "domain", "industry", "city", "state", "country", "zip",
    "address", "address2", "phone", "website", "description",
    "numberofemployees", "annualrevenue", "founded_year", "type",
    "linkedin_company_page", "facebook_company_page", "twitterhandle",
    "hs_analytics_source", "hs_analytics_source_data_1", "hs_analytics_source_data_2",
    "createdate", "hs_lastmodifieddate", "hs_object_id",
    "hubspot_owner_id", "notes_last_updated", "notes_last_contacted",
    "num_contacted_notes", "num_notes", "hs_lead_status",
    "lifecyclestage", "hs_num_open_deals", "hs_total_deal_value"
]

@hubspot_router.get("/companies", deprecated=True)
async def get_companies(
    current_user: dict = Depends(get_current_user),
    limit: int = 1000,
    skip: int = 0
):
    """
    DEPRECATED: Use GET /api/unified-companies instead.
    This endpoint reads from legacy companies collection.
    """
    logger.warning("DEPRECATED: /api/hubspot/companies called - use /api/unified-companies instead")
    # Read from unified_companies for backward compatibility
    companies = await db.unified_companies.find(
        {"is_merged": {"$ne": True}}, 
        {"_id": 0}
    ).skip(skip).limit(limit).to_list(limit)
    # Add is_active for backward compatibility
    for c in companies:
        c["is_active"] = c.get("classification") == "outbound"
    return companies

@hubspot_router.post("/companies/migrate-from-hubspot", deprecated=True)
async def migrate_companies_from_hubspot(current_user: dict = Depends(get_current_user)):
    """
    One-time migration: Import ALL companies from HubSpot with ALL available properties.
    After this, companies will be managed locally.
    """
    logger.warning("DEPRECATED: /api/hubspot/companies/migrate-from-hubspot called - migration already complete")
    headers = await get_hubspot_headers()
    companies_imported = 0
    companies_updated = 0
    errors = []
    
    try:
        async with httpx.AsyncClient(timeout=120.0) as http_client:
            url = "https://api.hubapi.com/crm/v3/objects/companies"
            params = {
                "limit": 100,
                "properties": ",".join(HUBSPOT_COMPANY_PROPERTIES)
            }
            
            after = None
            
            while True:
                if after:
                    params["after"] = after
                
                response = await http_client.get(url, headers=headers, params=params)
                
                if response.status_code == 403:
                    raise HTTPException(
                        status_code=403, 
                        detail="No tienes permisos para acceder a Companies en HubSpot"
                    )
                
                if response.status_code != 200:
                    logger.error(f"HubSpot error: {response.status_code} - {response.text}")
                    break
                
                data = response.json()
                results = data.get("results", [])
                
                for result in results:
                    props = result.get("properties", {})
                    hubspot_id = result.get("id")
                    
                    # Build complete company record
                    company = {
                        "hubspot_id": hubspot_id,
                        "name": props.get("name"),
                        "domain": props.get("domain"),
                        "industry": props.get("industry"),
                        "city": props.get("city"),
                        "state": props.get("state"),
                        "country": props.get("country"),
                        "zip": props.get("zip"),
                        "address": props.get("address"),
                        "address2": props.get("address2"),
                        "phone": props.get("phone"),
                        "website": props.get("website"),
                        "description": props.get("description"),
                        "employees": props.get("numberofemployees"),
                        "annual_revenue": props.get("annualrevenue"),
                        "founded_year": props.get("founded_year"),
                        "type": props.get("type"),
                        "linkedin_url": props.get("linkedin_company_page"),
                        "facebook_url": props.get("facebook_company_page"),
                        "twitter_handle": props.get("twitterhandle"),
                        "analytics_source": props.get("hs_analytics_source"),
                        "lifecycle_stage": props.get("lifecyclestage"),
                        "lead_status": props.get("hs_lead_status"),
                        "open_deals": props.get("hs_num_open_deals"),
                        "total_deal_value": props.get("hs_total_deal_value"),
                        "hubspot_created_at": props.get("createdate"),
                        "hubspot_modified_at": props.get("hs_lastmodifieddate"),
                        # Local management fields
                        "is_active": True,
                        "migrated_from_hubspot": True,
                        "migrated_at": datetime.now(timezone.utc).isoformat(),
                        "updated_at": datetime.now(timezone.utc).isoformat(),
                        # Store all original properties for reference
                        "hubspot_properties": props
                    }
                    
                    # Upsert by hubspot_id
                    result_db = await db.companies.update_one(
                        {"hubspot_id": hubspot_id},
                        {"$set": company},
                        upsert=True
                    )
                    
                    if result_db.upserted_id:
                        companies_imported += 1
                    else:
                        companies_updated += 1
                
                # Check for pagination
                paging = data.get("paging", {})
                next_link = paging.get("next", {})
                after = next_link.get("after")
                
                if not after or len(results) < 100:
                    break
                
                logger.info(f"Migrated {companies_imported + companies_updated} companies so far...")
        
        # Create indexes for better performance
        await db.companies.create_index("hubspot_id", unique=True)
        await db.companies.create_index("name")
        await db.companies.create_index("domain")
        await db.companies.create_index("industry")
        await db.companies.create_index("is_active")
        
        total = companies_imported + companies_updated
        logger.info(f"Migration complete: {total} companies ({companies_imported} new, {companies_updated} updated)")
        
        return {
            "success": True,
            "message": f"Migración completada: {total} empresas",
            "imported": companies_imported,
            "updated": companies_updated,
            "total": total,
            "errors": errors
        }
        
    except httpx.RequestError as e:
        logger.error(f"HubSpot request error: {e}")
        raise HTTPException(status_code=500, detail=f"Error de conexión con HubSpot: {str(e)}")

@hubspot_router.post("/companies/sync")
async def sync_companies(current_user: dict = Depends(get_current_user)):
    """
    Sync: Re-import companies from HubSpot (updates existing, adds new).
    Use migrate-from-hubspot for initial full migration.
    """
    return await migrate_companies_from_hubspot(current_user)

@hubspot_router.get("/companies/industries")
async def get_company_industries(current_user: dict = Depends(get_current_user)):
    """Get unique industries/sectors from unified_companies database"""
    # Try unified_companies first
    industries = await db.unified_companies.distinct("industry", {"is_merged": {"$ne": True}})
    industries = [i for i in industries if i]  # Filter out None/empty
    
    # Count companies per industry
    industry_stats = []
    for industry in sorted(industries):
        count = await db.unified_companies.count_documents({
            "industry": industry, 
            "is_merged": {"$ne": True}
        })
        industry_stats.append({"industry": industry, "count": count})
    
    return {"industries": industry_stats, "total": len(industry_stats)}

@hubspot_router.get("/companies/stats")
async def get_companies_stats(current_user: dict = Depends(get_current_user)):
    """Get statistics about companies from unified_companies"""
    total = await db.unified_companies.count_documents({"is_merged": {"$ne": True}})
    with_industry = await db.unified_companies.count_documents({
        "is_merged": {"$ne": True}, 
        "industry": {"$nin": [None, ""]}
    })
    without_industry = total - with_industry
    
    # Classification distribution (replaces is_active)
    outbound_count = await db.unified_companies.count_documents({
        "is_merged": {"$ne": True}, 
        "classification": "outbound"
    })
    inbound_count = total - outbound_count
    
    # Industry distribution
    industries = await db.unified_companies.aggregate([
        {"$match": {"is_merged": {"$ne": True}, "industry": {"$nin": [None, ""]}}},
        {"$group": {"_id": "$industry", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}},
        {"$limit": 10}
    ]).to_list(10)
    
    return {
        "total": total,
        "with_industry": with_industry,
        "without_industry": without_industry,
        "outbound": outbound_count,
        "inbound": inbound_count,
        "from_hubspot": outbound_count,  # Backward compatibility
        "local_only": inbound_count,     # Backward compatibility
        "top_industries": [{"industry": i["_id"], "count": i["count"]} for i in industries]
    }

@hubspot_router.get("/companies/by-industry/{industry}")
async def get_companies_by_industry(industry: str, current_user: dict = Depends(get_current_user)):
    """Get companies filtered by industry from unified_companies"""
    if industry == "NO_INDUSTRY":
        # Special case: get companies without industry
        companies = await db.unified_companies.find(
            {
                "$or": [{"industry": None}, {"industry": ""}, {"industry": {"$exists": False}}], 
                "is_merged": {"$ne": True}
            }, 
            {"_id": 0}
        ).sort("name", 1).to_list(500)
    else:
        companies = await db.unified_companies.find(
            {"industry": industry, "is_merged": {"$ne": True}}, 
            {"_id": 0}
        ).sort("name", 1).to_list(500)
    
    # Add is_active for backward compatibility
    for c in companies:
        c["is_active"] = c.get("classification") == "outbound"
    
    return companies

@hubspot_router.get("/companies/{company_id}")
async def get_company_by_id(company_id: str, current_user: dict = Depends(get_current_user)):
    """Get a single company by id, hubspot_id or name from unified_companies"""
    # Try unified_companies first
    company = await db.unified_companies.find_one(
        {"$or": [
            {"id": company_id}, 
            {"hubspot_id": company_id}, 
            {"hs_object_id": company_id},
            {"name": {"$regex": f"^{company_id}$", "$options": "i"}}
        ], "is_merged": {"$ne": True}},
        {"_id": 0}
    )
    
    # Fallback to companies collection
    if not company:
        company = await db.companies.find_one(
            {"$or": [{"hubspot_id": company_id}, {"name": company_id}]},
            {"_id": 0}
        )
    
    if not company:
        raise HTTPException(status_code=404, detail="Empresa no encontrada")
    
    # Add is_active for backward compatibility
    company["is_active"] = company.get("classification") == "outbound"
    return company

@hubspot_router.put("/companies/{company_id}")
async def update_company(
    company_id: str,
    updates: dict = Body(...),
    current_user: dict = Depends(get_current_user)
):
    """Update company properties in unified_companies"""
    # Remove protected fields
    protected_fields = ["hubspot_id", "migrated_from_hubspot", "migrated_at", "hubspot_properties", "_id"]
    for field in protected_fields:
        updates.pop(field, None)
    
    updates["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    # Handle classification conversion from is_active
    if "is_active" in updates:
        updates["classification"] = "outbound" if updates.pop("is_active") else "inbound"
    
    # Try unified_companies first
    result = await db.unified_companies.update_one(
        {"$or": [
            {"id": company_id}, 
            {"hubspot_id": company_id},
            {"hs_object_id": company_id}
        ], "is_merged": {"$ne": True}},
        {"$set": updates}
    )
    
    # Fallback to companies collection
    if result.matched_count == 0:
        result = await db.companies.update_one(
            {"$or": [{"hubspot_id": company_id}, {"name": company_id}]},
            {"$set": updates}
        )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Empresa no encontrada")
    
    return {"success": True, "message": "Empresa actualizada"}

@hubspot_router.put("/companies/{company_id}/industry")
async def update_company_industry(
    company_id: str, 
    industry: str,
    current_user: dict = Depends(get_current_user)
):
    """Update company industry in unified_companies"""
    now = datetime.now(timezone.utc).isoformat()
    
    # Try unified_companies first
    result = await db.unified_companies.update_one(
        {"$or": [
            {"id": company_id}, 
            {"hubspot_id": company_id},
            {"hs_object_id": company_id}
        ], "is_merged": {"$ne": True}},
        {"$set": {"industry": industry, "updated_at": now}}
    )
    
    # Fallback to companies collection
    if result.matched_count == 0:
        result = await db.companies.update_one(
            {"$or": [{"hubspot_id": company_id}, {"name": company_id}]},
            {"$set": {"industry": industry, "updated_at": now}}
        )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Empresa no encontrada")
    
    return {"success": True, "message": "Industria actualizada"}

@hubspot_router.post("/companies")
async def create_company(
    company: dict = Body(...),
    current_user: dict = Depends(get_current_user)
):
    """Create a new company in unified_companies"""
    import re
    name = company.get("name", "").strip()
    
    if not name:
        raise HTTPException(status_code=400, detail="El nombre de la empresa es requerido")
    
    # Check if company already exists in unified_companies
    existing = await db.unified_companies.find_one({
        "name": {"$regex": f"^{re.escape(name)}$", "$options": "i"},
        "is_merged": {"$ne": True}
    })
    if existing:
        raise HTTPException(status_code=400, detail="Ya existe una empresa con ese nombre")
    
    now = datetime.now(timezone.utc).isoformat()
    company_id = str(uuid.uuid4())
    
    new_company = {
        "id": company_id,
        "name": name,
        "normalized_name": name.lower().strip(),
        "classification": "inbound",  # New companies start as inbound
        "domain": company.get("domain", ""),
        "industry": company.get("industry", ""),
        "description": company.get("description", ""),
        "is_merged": False,
        "_legacy_sources": ["manual"],
        "created_at": now,
        "updated_at": now
    }
    
    await db.unified_companies.insert_one(new_company)
    
    return {
        "success": True, 
        "message": "Empresa creada", 
        "id": company_id,
        "hubspot_id": company_id  # Backward compatibility
    }

@hubspot_router.delete("/companies/{company_id}")
async def delete_company(company_id: str, current_user: dict = Depends(get_current_user)):
    """Soft delete a company (mark as merged in unified_companies)"""
    now = datetime.now(timezone.utc).isoformat()
    
    # Try unified_companies first
    result = await db.unified_companies.update_one(
        {"$or": [
            {"id": company_id}, 
            {"hubspot_id": company_id},
            {"hs_object_id": company_id}
        ], "is_merged": {"$ne": True}},
        {"$set": {"is_merged": True, "deleted_at": now, "updated_at": now}}
    )
    
    # Fallback to companies collection
    if result.matched_count == 0:
        result = await db.companies.update_one(
            {"$or": [{"hubspot_id": company_id}, {"name": company_id}]},
            {"$set": {"is_active": False, "updated_at": now}}
        )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Empresa no encontrada")
    
    return {"success": True, "message": "Empresa eliminada"}

@hubspot_router.post("/companies/bulk-update-industry")
async def bulk_update_company_industry(
    updates: List[dict],
    current_user: dict = Depends(get_current_user)
):
    """Bulk update company industries in unified_companies"""
    import re
    updated = 0
    now = datetime.now(timezone.utc).isoformat()
    
    for update in updates:
        company_name = update.get("name")
        industry = update.get("industry")
        if company_name and industry:
            # Try unified_companies first
            result = await db.unified_companies.update_one(
                {"name": {"$regex": f"^{re.escape(company_name)}$", "$options": "i"}, "is_merged": {"$ne": True}},
                {"$set": {"industry": industry, "updated_at": now}}
            )
            if result.matched_count > 0:
                updated += 1
            else:
                # Fallback to companies
                result = await db.companies.update_one(
                    {"name": company_name},
                    {"$set": {"industry": industry, "updated_at": now}}
                )
                if result.matched_count > 0:
                    updated += 1
    
    return {"success": True, "updated": updated}


# ============ INDUSTRIES/SECTORS ROUTES (LOCAL DATABASE) ============

@hubspot_router.get("/industries")
async def get_industries_mapping(current_user: dict = Depends(get_current_user)):
    """Get industries from unified_companies database with their mappings"""
    
    # Get all unique industries from unified_companies
    company_industries = await db.unified_companies.distinct("industry", {"is_merged": {"$ne": True}})
    company_industries = [i for i in company_industries if i]
    
    # Get cached mappings
    cached = await db.industry_mappings.find({}, {"_id": 0}).to_list(200)
    cached_map = {c.get("hubspot_value"): c for c in cached}
    
    result = []
    
    # Process each industry from companies
    for industry in company_industries:
        if industry in cached_map:
            item = cached_map[industry]
        else:
            # Create new mapping
            item = {
                "id": str(uuid.uuid4()),
                "hubspot_value": industry,
                "hubspot_label": industry,
                "custom_name": None,
                "buyer_persona_industry": None,
                "is_active": False
            }
            await db.industry_mappings.update_one(
                {"hubspot_value": industry},
                {"$set": item},
                upsert=True
            )
        result.append(item)
    
    # Get company counts per industry
    industry_counts = {}
    pipeline = [
        {"$match": {"industry": {"$ne": None}, "is_active": True}},
        {"$group": {"_id": "$industry", "count": {"$sum": 1}}}
    ]
    async for doc in db.companies.aggregate(pipeline):
        industry_counts[doc["_id"]] = doc["count"]
    
    # Add counts to result
    for item in result:
        item["company_count"] = industry_counts.get(item["hubspot_value"], 0)
    
    # Sort by company count desc
    result.sort(key=lambda x: x.get("company_count", 0), reverse=True)
    
    return result

@hubspot_router.post("/industries/migrate-from-hubspot")
async def migrate_industries_from_hubspot(current_user: dict = Depends(get_current_user)):
    """One-time migration: Import industry options from HubSpot property definition"""
    headers = await get_hubspot_headers()
    imported = 0
    
    try:
        async with httpx.AsyncClient(timeout=30.0) as http_client:
            props_resp = await http_client.get(
                "https://api.hubapi.com/crm/v3/properties/companies/industry",
                headers=headers
            )
            if props_resp.status_code == 200:
                data = props_resp.json()
                for opt in data.get("options", []):
                    value = opt.get("value")
                    label = opt.get("label")
                    
                    existing = await db.industry_mappings.find_one({"hubspot_value": value})
                    
                    item = {
                        "id": existing.get("id") if existing else str(uuid.uuid4()),
                        "hubspot_value": value,
                        "hubspot_label": label,
                        "custom_name": existing.get("custom_name") if existing else None,
                        "buyer_persona_industry": existing.get("buyer_persona_industry") if existing else None,
                        "is_active": existing.get("is_active", False) if existing else False,
                        "migrated_at": datetime.now(timezone.utc).isoformat()
                    }
                    
                    await db.industry_mappings.update_one(
                        {"hubspot_value": value},
                        {"$set": item},
                        upsert=True
                    )
                    imported += 1
                
        return {"success": True, "message": f"Migradas {imported} industrias desde HubSpot", "imported": imported}
    except Exception as e:
        logger.error(f"Error migrating industries: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@hubspot_router.put("/industries/{industry_value}")
async def update_industry_mapping(
    industry_value: str,
    custom_name: str = None,
    buyer_persona_industry: str = None,
    is_active: bool = None,
    current_user: dict = Depends(get_current_user)
):
    """Update industry custom name, buyer persona mapping, or active status"""
    update_data = {"updated_at": datetime.now(timezone.utc).isoformat()}
    if custom_name is not None:
        update_data["custom_name"] = custom_name
    if buyer_persona_industry is not None:
        update_data["buyer_persona_industry"] = buyer_persona_industry
    if is_active is not None:
        update_data["is_active"] = is_active
    
    result = await db.industry_mappings.update_one(
        {"hubspot_value": industry_value},
        {"$set": update_data}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Industria no encontrada")
    
    return {"success": True, "message": "Industria actualizada"}

@hubspot_router.get("/sectors")
async def get_sectors(current_user: dict = Depends(get_current_user)):
    """Get all sectors with their active status from industry_mappings"""
    sectors = await db.industry_mappings.find({}, {"_id": 0}).to_list(500)
    
    # Get company counts from unified_companies
    industry_counts = {}
    pipeline = [
        {"$match": {"industry": {"$ne": None}, "is_merged": {"$ne": True}}},
        {"$group": {"_id": "$industry", "count": {"$sum": 1}}}
    ]
    async for doc in db.unified_companies.aggregate(pipeline):
        industry_counts[doc["_id"]] = doc["count"]
    
    for s in sectors:
        if "id" not in s:
            s["id"] = str(uuid.uuid4())
        s["company_count"] = industry_counts.get(s.get("hubspot_value"), 0)
    
    return sectors

@hubspot_router.get("/industries/{industry_value}/companies")
async def get_companies_by_industry_value(
    industry_value: str,
    current_user: dict = Depends(get_current_user)
):
    """Get companies filtered by industry value from unified_companies"""
    companies = await db.unified_companies.find(
        {"industry": industry_value, "is_merged": {"$ne": True}}, 
        {"_id": 0}
    ).to_list(500)
    
    # Add is_active for backward compatibility
    for c in companies:
        c["is_active"] = c.get("classification") == "outbound"
    
    return companies


# ============ TEMPLATES ROUTES ============

@templates_router.get("/", response_model=List[EmailTemplateResponse])
async def get_templates(current_user: dict = Depends(get_current_user)):
    templates = await db.email_templates.find({}, {"_id": 0}).sort("created_at", -1).to_list(100)
    return templates

@templates_router.post("/", response_model=EmailTemplateResponse)
async def create_template(template: EmailTemplateCreate, current_user: dict = Depends(get_current_user)):
    template_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc)
    
    template_doc = {
        "id": template_id,
        "name": template.name,
        "subject": template.subject,
        "body_html": template.body_html,
        "variables": template.variables,
        "created_at": now.isoformat(),
        "updated_at": now.isoformat()
    }
    
    await db.email_templates.insert_one(template_doc)
    return EmailTemplateResponse(
        id=template_id,
        name=template.name,
        subject=template.subject,
        body_html=template.body_html,
        variables=template.variables,
        created_at=now,
        updated_at=now
    )

@templates_router.get("/{template_id}", response_model=EmailTemplateResponse)
async def get_template(template_id: str, current_user: dict = Depends(get_current_user)):
    template = await db.email_templates.find_one({"id": template_id}, {"_id": 0})
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    return template

@templates_router.put("/{template_id}", response_model=EmailTemplateResponse)
async def update_template(template_id: str, template: EmailTemplateCreate, current_user: dict = Depends(get_current_user)):
    existing = await db.email_templates.find_one({"id": template_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Template not found")
    
    now = datetime.now(timezone.utc)
    update_doc = {
        "name": template.name,
        "subject": template.subject,
        "body_html": template.body_html,
        "variables": template.variables,
        "updated_at": now.isoformat()
    }
    
    await db.email_templates.update_one({"id": template_id}, {"$set": update_doc})
    updated = await db.email_templates.find_one({"id": template_id}, {"_id": 0})
    return updated

@templates_router.delete("/{template_id}")
async def delete_template(template_id: str, current_user: dict = Depends(get_current_user)):
    result = await db.email_templates.delete_one({"id": template_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Template not found")
    return {"message": "Template deleted"}

# ============ CAMPAIGNS ROUTES ============

@campaigns_router.get("/", response_model=List[CampaignResponse])
async def get_campaigns(current_user: dict = Depends(get_current_user)):
    campaigns = await db.campaigns.find({}, {"_id": 0}).sort("created_at", -1).to_list(100)
    return campaigns

@campaigns_router.post("/", response_model=CampaignResponse)
async def create_campaign(campaign: CampaignCreate, current_user: dict = Depends(get_current_user)):
    campaign_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc)
    
    campaign_doc = {
        "id": campaign_id,
        "name": campaign.name,
        "template_id": campaign.template_id,
        "event_ids": campaign.event_ids,
        "contact_ids": campaign.contact_ids,
        "status": "draft",
        "scheduled_at": campaign.scheduled_at.isoformat() if campaign.scheduled_at else None,
        "sent_at": None,
        "use_ai_generation": campaign.use_ai_generation,
        "total_recipients": len(campaign.contact_ids),
        "emails_sent": 0,
        "emails_opened": 0,
        "emails_clicked": 0,
        "created_at": now.isoformat()
    }
    
    await db.campaigns.insert_one(campaign_doc)
    return CampaignResponse(**{**campaign_doc, "created_at": now, "scheduled_at": campaign.scheduled_at, "sent_at": None})

@campaigns_router.get("/{campaign_id}", response_model=CampaignResponse)
async def get_campaign(campaign_id: str, current_user: dict = Depends(get_current_user)):
    campaign = await db.campaigns.find_one({"id": campaign_id}, {"_id": 0})
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
    return campaign

@campaigns_router.delete("/{campaign_id}")
async def delete_campaign(campaign_id: str, current_user: dict = Depends(get_current_user)):
    result = await db.campaigns.delete_one({"id": campaign_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Campaign not found")
    return {"message": "Campaign deleted"}

# ============ EMAIL PREVIEW ============

@preview_router.post("/", response_model=EmailPreviewResponse)
async def generate_email_preview(request: EmailPreviewRequest, current_user: dict = Depends(get_current_user)):
    """Generate a preview of the email for a specific contact"""
    
    # Get template
    template = await db.email_templates.find_one({"id": request.template_id}, {"_id": 0})
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    
    # Get contact
    contact = await db.hubspot_contacts.find_one({"id": request.contact_id}, {"_id": 0})
    if not contact:
        raise HTTPException(status_code=404, detail="Contact not found")
    
    # Get events
    events = await db.webinar_events.find({"id": {"$in": request.event_ids}}, {"_id": 0}).to_list(100)
    
    # Generate personalized email using AI
    email_content = await generate_ai_email(template, events, contact)
    
    contact_name = f"{contact.get('firstname', '')} {contact.get('lastname', '')}".strip() or "Sin nombre"
    
    return EmailPreviewResponse(
        contact_name=contact_name,
        contact_email=contact.get('email', ''),
        subject=email_content['subject'],
        body_html=email_content['body_html'],
        generated_at=datetime.now(timezone.utc)
    )

async def generate_ai_email(template: dict, events: list, contact: dict) -> dict:
    """Generate personalized email using Gemini AI"""
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage
        
        llm_key = os.environ.get("EMERGENT_LLM_KEY", "")
        if not llm_key:
            logger.warning("No EMERGENT_LLM_KEY found, using template as-is")
            return {"subject": template["subject"], "body_html": template["body_html"]}
        
        # Format events info
        events_info = ""
        for event in events:
            events_info += f"- **{event.get('name', 'Evento')}**\n"
            if event.get('date'):
                events_info += f"  Fecha: {event['date']}\n"
            if event.get('registration_link'):
                events_info += f"  Link de registro: {event['registration_link']}\n"
            events_info += "\n"
        
        contact_name = f"{contact.get('firstname', '')} {contact.get('lastname', '')}".strip() or "Estimado/a"
        contact_firstname = contact.get('firstname', '') or "Hola"
        contact_company = contact.get('company', '')
        contact_title = contact.get('jobtitle', '')
        
        system_message = """Eres un asistente que redacta correos de seguimiento para Leaderlix. Tu estilo es:

1. TONO CORDIAL Y PROFESIONAL - Como si escribieras a un conocido profesional, con confianza pero siempre respetuoso
2. SEGUIMIENTO AMABLE - Es para asegurarte de que la invitación haya llegado (NO asumas que ya la vieron)
3. SIN SIGNOS DE APERTURA - NUNCA uses "¡" ni "¿" al inicio de oraciones. Solo puedes usar "!" al final de despedidas
4. CORTO y NATURAL - Máximo 4-5 oraciones, que suene escrito por una persona real

REGLAS ESTRICTAS DE REDACCIÓN:
- NUNCA abras con signos: usa "Hola" NO "¡Hola", usa "todo bien" NO "¿todo bien?"
- NUNCA uses palabras demasiado coloquiales como: "un toque", "genial", "súper", "increíble"
- NUNCA uses "recuerda que..." porque no sabes si la persona ya vio la invitación
- Tutea al destinatario (usa "tú" no "usted")
- No uses emojis
- No uses frases corporativas ni de marketing

ESTRUCTURA DEL CORREO:
- Apertura: "Hola [Nombre], espero que estés bien." (sin signos de apertura)
- Cuerpo: "Te escribo para asegurarme de que te haya llegado la invitación al evento [nombre] que tenemos el [fecha]. Es un evento sin costo y solo por invitación."
- Call to action: SIEMPRE doble opción: registrarse en el link O responder con nombre, correo y teléfono de su equipo
- Despedida: Cordial como "Saludos!" o "Que tengas buen día!"

CADA CORREO DEBE SER ÚNICO - Varía las frases pero mantén el tono cordial y profesional."""

        # Generate a random seed to encourage variation
        variation_seed = uuid.uuid4().hex[:8]
        
        prompt = f"""Escribe un correo de seguimiento ÚNICO. Seed: {variation_seed}

DESTINATARIO:
- Nombre: {contact_firstname}
- Empresa: {contact_company}

EVENTO:
{events_info}

REGLAS CRÍTICAS:
- SIN signos de apertura (¡ ¿) - solo usa "!" en despedidas finales
- NO uses palabras muy coloquiales ("un toque", "genial", "súper")
- NO uses "recuerda" porque no sabes si ya vio la invitación
- El mensaje es para ASEGURARTE de que le llegó la invitación

ELEMENTOS:
1. Saludo cordial: "Hola [Nombre], espero que estés bien." o "Hola [Nombre], espero que todo vaya bien."
2. Propósito: asegurarte de que haya recibido la invitación al evento (sin asumir que ya la vio)
3. Datos del evento: nombre, fecha, que es sin costo y solo por invitación
4. Call to action doble: registrarse en el link O enviar datos de su equipo (nombre, correo, teléfono)
5. Despedida cordial: "Saludos!" o "Que tengas buen día!"

Responde SOLO en formato JSON:
{{"subject": "asunto corto y directo", "body_html": "contenido HTML breve"}}

HTML simple: párrafos (<p>) y link clickeable (<a href='...'>). Máximo 4-5 oraciones."""

        chat = LlmChat(
            api_key=llm_key,
            session_id=f"email-gen-{uuid.uuid4()}",
            system_message=system_message
        ).with_model("gemini", "gemini-2.0-flash")
        
        user_message = UserMessage(text=prompt)
        response = await chat.send_message(user_message)
        
        # Parse JSON response
        json_match = re.search(r'\{[\s\S]*\}', response)
        if json_match:
            email_data = json.loads(json_match.group())
            return email_data
        
        logger.warning("Could not parse AI response, using template")
        return {"subject": template["subject"], "body_html": template["body_html"]}
        
    except Exception as e:
        logger.error(f"AI email generation error: {e}")
        return {"subject": template["subject"], "body_html": template["body_html"]}

# ============ EMAIL SENDING (Preparation only - NOT actual sending) ============

@emails_router.post("/prepare")
async def prepare_campaign_emails(campaign_id: str, current_user: dict = Depends(get_current_user)):
    """Prepare campaign emails for review - does NOT send"""
    campaign = await db.campaigns.find_one({"id": campaign_id}, {"_id": 0})
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
    
    # Get template
    template = await db.email_templates.find_one({"id": campaign["template_id"]}, {"_id": 0})
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    
    # Get events
    events = await db.webinar_events.find({"id": {"$in": campaign["event_ids"]}}, {"_id": 0}).to_list(100)
    
    # Get contacts
    contacts = await db.hubspot_contacts.find({"id": {"$in": campaign["contact_ids"]}}, {"_id": 0}).to_list(1000)
    
    if not contacts:
        raise HTTPException(status_code=400, detail="No contacts to prepare emails for")
    
    prepared_emails = []
    
    for contact in contacts[:5]:  # Only prepare first 5 for preview
        email_content = await generate_ai_email(template, events, contact)
        
        prepared_emails.append({
            "contact_id": contact["id"],
            "contact_name": f"{contact.get('firstname', '')} {contact.get('lastname', '')}".strip(),
            "contact_email": contact.get("email"),
            "subject": email_content["subject"],
            "body_preview": email_content["body_html"][:500] + "..."
        })
    
    return {
        "message": f"Prepared preview for {len(prepared_emails)} contacts (total: {len(contacts)})",
        "total_contacts": len(contacts),
        "previews": prepared_emails
    }

# ============ TRACKING ROUTES ============

@tracking_router.get("/pixel/{email_id}.gif")
async def track_open(email_id: str, request: Request):
    """Track email open via 1x1 pixel"""
    try:
        # Log the open event
        await db.tracking_events.insert_one({
            "id": str(uuid.uuid4()),
            "email_id": email_id,
            "event_type": "open",
            "user_agent": request.headers.get("user-agent", ""),
            "ip_address": request.client.host if request.client else "",
            "timestamp": datetime.now(timezone.utc).isoformat()
        })
        
        # Update email log
        await db.email_logs.update_one(
            {"id": email_id, "opened_at": None},
            {"$set": {"opened_at": datetime.now(timezone.utc).isoformat()}}
        )
        
        # Update campaign stats
        email_log = await db.email_logs.find_one({"id": email_id}, {"_id": 0})
        if email_log:
            await db.campaigns.update_one(
                {"id": email_log["campaign_id"]},
                {"$inc": {"emails_opened": 1}}
            )
    except Exception as e:
        logger.error(f"Tracking error: {e}")
    
    return Response(content=TRACKING_PIXEL, media_type="image/gif", headers={"Cache-Control": "no-cache, no-store"})

@tracking_router.get("/click/{email_id}/{link_id}")
async def track_click(email_id: str, link_id: str, url: str, request: Request):
    """Track link click, move deal to 'Interés en Caso', and redirect"""
    try:
        decoded_url = base64.urlsafe_b64decode(url).decode()
        
        # Log click event
        await db.tracking_events.insert_one({
            "id": str(uuid.uuid4()),
            "email_id": email_id,
            "event_type": "click",
            "link_id": link_id,
            "clicked_url": decoded_url,
            "user_agent": request.headers.get("user-agent", ""),
            "ip_address": request.client.host if request.client else "",
            "timestamp": datetime.now(timezone.utc).isoformat()
        })
        
        # Update email log
        email_log = await db.email_logs.find_one({"id": email_id}, {"_id": 0})
        if email_log:
            await db.email_logs.update_one(
                {"id": email_id, "clicked_at": None},
                {"$set": {"clicked_at": datetime.now(timezone.utc).isoformat()}}
            )
            
            # Update campaign stats
            await db.campaigns.update_one(
                {"id": email_log["campaign_id"]},
                {"$inc": {"emails_clicked": 1}}
            )
            
            # Move deal from "DM Identificado" to "Interés en Caso"
            contact_id = email_log.get("contact_id")
            if contact_id:
                await move_deal_on_click(contact_id)
        
        return RedirectResponse(url=decoded_url)
    except Exception as e:
        logger.error(f"Click tracking error: {e}")
        raise HTTPException(status_code=400, detail="Invalid tracking URL")

async def move_deal_on_click(contact_id: str):
    """Move associated deal from 'DM Identificado' to 'Interés en Caso' when contact clicks"""
    headers = await get_hubspot_headers()
    
    try:
        async with httpx.AsyncClient(timeout=30.0) as http_client:
            # Get deals associated with contact
            assoc_url = f"https://api.hubapi.com/crm/v4/objects/contacts/{contact_id}/associations/deals"
            response = await http_client.get(assoc_url, headers=headers)
            
            if response.status_code != 200:
                logger.error(f"Could not get contact associations: {response.text}")
                return
            
            data = response.json()
            deal_ids = [r.get("toObjectId") for r in data.get("results", [])]
            
            for deal_id in deal_ids:
                # Get deal details
                deal_url = f"https://api.hubapi.com/crm/v3/objects/deals/{deal_id}?properties=dealname,pipeline,dealstage"
                deal_response = await http_client.get(deal_url, headers=headers)
                
                if deal_response.status_code != 200:
                    continue
                
                deal = deal_response.json()
                props = deal.get("properties", {})
                
                # Check if deal is in Pipeline Proyectos and Stage DM Identificado
                if props.get("pipeline") == PIPELINE_PROYECTOS_ID and props.get("dealstage") == STAGE_DM_IDENTIFICADO_ID:
                    # Move to Interés en Caso
                    update_url = f"https://api.hubapi.com/crm/v3/objects/deals/{deal_id}"
                    update_payload = {
                        "properties": {
                            "dealstage": STAGE_INTERES_CASO_ID
                        }
                    }
                    
                    update_response = await http_client.patch(update_url, headers=headers, json=update_payload)
                    
                    if update_response.status_code == 200:
                        logger.info(f"Moved deal {deal_id} from DM Identificado to Interés en Caso")
                        
                        # Log the movement
                        await db.deal_movements.insert_one({
                            "id": str(uuid.uuid4()),
                            "deal_id": deal_id,
                            "contact_id": contact_id,
                            "from_stage": STAGE_DM_IDENTIFICADO_ID,
                            "to_stage": STAGE_INTERES_CASO_ID,
                            "reason": "email_click",
                            "timestamp": datetime.now(timezone.utc).isoformat()
                        })
                    else:
                        logger.error(f"Failed to move deal {deal_id}: {update_response.text}")
                        
    except Exception as e:
        logger.error(f"Error moving deal: {e}")

# ============ SETTINGS ROUTES ============

@settings_router.get("/")
async def get_app_settings(current_user: dict = Depends(get_current_user)):
    settings = await get_settings()
    # Hide sensitive data
    if settings.get("hubspot_token"):
        settings["hubspot_token"] = "***" + settings["hubspot_token"][-4:]
    if settings.get("apify_token"):
        settings["apify_token"] = "***" + settings["apify_token"][-4:]
    if settings.get("google_credentials"):
        settings["google_credentials"] = {"configured": True}
    return settings

@settings_router.put("/")
async def update_app_settings(settings_update: SettingsUpdate, current_user: dict = Depends(get_current_user)):
    update_doc = {}
    
    if settings_update.hubspot_token:
        update_doc["hubspot_token"] = settings_update.hubspot_token
    if settings_update.hubspot_list_id:
        update_doc["hubspot_list_id"] = settings_update.hubspot_list_id
    if settings_update.sender_email:
        update_doc["sender_email"] = settings_update.sender_email
    if settings_update.google_credentials:
        update_doc["google_credentials"] = settings_update.google_credentials
    if settings_update.apify_token:
        update_doc["apify_token"] = settings_update.apify_token
        # Also update environment variable for immediate effect
        os.environ["APIFY_TOKEN"] = settings_update.apify_token
    
    if update_doc:
        update_doc["updated_at"] = datetime.now(timezone.utc).isoformat()
        await db.settings.update_one({}, {"$set": update_doc}, upsert=True)
    
    return {"message": "Settings updated"}

# ============ GMAIL OAUTH ROUTES ============

@gmail_router.get("/auth-url")
async def get_gmail_auth_url(request: Request, current_user: dict = Depends(get_current_user)):
    """Generate Google OAuth authorization URL"""
    
    # Get the base URL from the request to build redirect URI
    # Use the frontend URL for redirect
    frontend_url = os.environ.get('FRONTEND_URL', '')
    if not frontend_url:
        # Try to get from request headers
        origin = request.headers.get('origin', '')
        if origin:
            frontend_url = origin
        else:
            frontend_url = 'https://persona-assets.preview.emergentagent.com'
    
    redirect_uri = f"{frontend_url.rstrip('/')}/settings/gmail-callback"
    
    # Create OAuth flow
    client_config = {
        "web": {
            "client_id": GOOGLE_CLIENT_ID,
            "client_secret": GOOGLE_CLIENT_SECRET,
            "auth_uri": "https://accounts.google.com/o/oauth2/auth",
            "token_uri": "https://oauth2.googleapis.com/token",
            "redirect_uris": [redirect_uri]
        }
    }
    
    flow = Flow.from_client_config(
        client_config,
        scopes=GOOGLE_SCOPES,
        redirect_uri=redirect_uri
    )
    
    # Generate authorization URL
    # Note: Removed include_granted_scopes to avoid scope mismatch errors
    auth_url, state = flow.authorization_url(
        access_type='offline',
        prompt='consent'  # Force consent to get new refresh token with correct scopes
    )
    
    # Store state for verification
    await db.oauth_states.insert_one({
        "state": state,
        "user_id": current_user["id"],
        "redirect_uri": redirect_uri,
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    return {
        "auth_url": auth_url,
        "state": state,
        "redirect_uri": redirect_uri
    }

@gmail_router.post("/callback")
async def gmail_oauth_callback(
    code: str,
    state: str
):
    """Handle Google OAuth callback and store tokens"""
    
    # Verify state
    state_doc = await db.oauth_states.find_one({"state": state})
    if not state_doc:
        # Log for debugging
        logger.error(f"State not found: {state}")
        all_states = await db.oauth_states.find({}).to_list(10)
        logger.error(f"Available states: {[s.get('state', '')[:20] for s in all_states]}")
        raise HTTPException(status_code=400, detail="Invalid state parameter")
    
    # Check if this is a Calendar OAuth callback
    oauth_type = state_doc.get("oauth_type", "gmail")
    if oauth_type == "calendar":
        # Forward to calendar callback handler (don't delete state, calendar handler will)
        from routers.calendar import handle_calendar_oauth_callback
        return await handle_calendar_oauth_callback(code, state, state_doc)
    
    redirect_uri = state_doc.get("redirect_uri")
    user_id = state_doc.get("user_id")
    
    # Clean up state
    await db.oauth_states.delete_one({"state": state})
    
    # Create OAuth flow
    client_config = {
        "web": {
            "client_id": GOOGLE_CLIENT_ID,
            "client_secret": GOOGLE_CLIENT_SECRET,
            "auth_uri": "https://accounts.google.com/o/oauth2/auth",
            "token_uri": "https://oauth2.googleapis.com/token",
            "redirect_uris": [redirect_uri]
        }
    }
    
    flow = Flow.from_client_config(
        client_config,
        scopes=GOOGLE_SCOPES,
        redirect_uri=redirect_uri
    )
    
    try:
        # Exchange code for tokens using httpx for more control
        import httpx
        
        token_data = {
            "code": code,
            "client_id": GOOGLE_CLIENT_ID,
            "client_secret": GOOGLE_CLIENT_SECRET,
            "redirect_uri": redirect_uri,
            "grant_type": "authorization_code"
        }
        
        async with httpx.AsyncClient() as client:
            token_response = await client.post(
                "https://oauth2.googleapis.com/token",
                data=token_data
            )
            
            if token_response.status_code != 200:
                error_detail = token_response.json()
                logger.error(f"Token exchange failed: {error_detail}")
                raise HTTPException(
                    status_code=400, 
                    detail=f"Error al obtener token: {error_detail.get('error_description', error_detail.get('error', 'Unknown error'))}"
                )
            
            tokens = token_response.json()
        
        # Build credentials from tokens
        from google.oauth2.credentials import Credentials
        credentials = Credentials(
            token=tokens.get("access_token"),
            refresh_token=tokens.get("refresh_token"),
            token_uri="https://oauth2.googleapis.com/token",
            client_id=GOOGLE_CLIENT_ID,
            client_secret=GOOGLE_CLIENT_SECRET,
            scopes=tokens.get("scope", "").split()
        )
        
        # Build Gmail service to get email
        service = build('gmail', 'v1', credentials=credentials)
        profile = service.users().getProfile(userId='me').execute()
        email_address = profile.get('emailAddress', '')
        
        # Store credentials
        gmail_credentials = {
            "token": credentials.token,
            "refresh_token": credentials.refresh_token,
            "token_uri": credentials.token_uri,
            "client_id": credentials.client_id,
            "client_secret": credentials.client_secret,
            "scopes": list(credentials.scopes) if credentials.scopes else GOOGLE_SCOPES,
            "email": email_address,
            "connected_at": datetime.now(timezone.utc).isoformat()
        }
        
        await db.settings.update_one(
            {},
            {"$set": {
                "gmail_credentials": gmail_credentials,
                "sender_email": email_address,
                "gmail_connected": True,
                "updated_at": datetime.now(timezone.utc).isoformat()
            }},
            upsert=True
        )
        
        return {
            "success": True,
            "email": email_address,
            "message": f"Gmail conectado exitosamente. Los emails se enviarán desde {email_address}"
        }
        
    except Exception as e:
        logger.error(f"Gmail OAuth error: {e}")
        raise HTTPException(status_code=400, detail=f"Error al conectar Gmail: {str(e)}")

@gmail_router.get("/status")
async def get_gmail_status(current_user: dict = Depends(get_current_user)):
    """Check Gmail connection status"""
    settings = await get_settings()
    
    gmail_connected = settings.get("gmail_connected", False)
    gmail_credentials = settings.get("gmail_credentials", {})
    
    if gmail_connected and gmail_credentials:
        return {
            "connected": True,
            "email": gmail_credentials.get("email", ""),
            "connected_at": gmail_credentials.get("connected_at", "")
        }
    
    return {
        "connected": False,
        "email": None,
        "connected_at": None
    }

@gmail_router.post("/disconnect")
async def disconnect_gmail(current_user: dict = Depends(get_current_user)):
    """Disconnect Gmail account"""
    await db.settings.update_one(
        {},
        {"$unset": {"gmail_credentials": "", "gmail_connected": ""},
         "$set": {"updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    return {"success": True, "message": "Gmail desconectado"}

@gmail_router.post("/test-send")
async def test_send_email(
    to_email: str,
    current_user: dict = Depends(get_current_user)
):
    """Send a test email to verify Gmail connection"""
    settings = await get_settings()
    
    if not settings.get("gmail_connected"):
        raise HTTPException(status_code=400, detail="Gmail no está conectado")
    
    gmail_creds = settings.get("gmail_credentials", {})
    sender_name = settings.get("sender_name", "Leaderlix")
    sender_email = gmail_creds.get("email", "")
    
    try:
        # Create credentials object
        credentials = Credentials(
            token=gmail_creds.get("token"),
            refresh_token=gmail_creds.get("refresh_token"),
            token_uri=gmail_creds.get("token_uri"),
            client_id=gmail_creds.get("client_id"),
            client_secret=gmail_creds.get("client_secret"),
            scopes=gmail_creds.get("scopes")
        )
        
        # Build Gmail service
        service = build('gmail', 'v1', credentials=credentials)
        
        # Create test message with sender name
        message = MIMEMultipart('alternative')
        message['to'] = to_email
        message['from'] = f"{sender_name} <{sender_email}>"
        message['subject'] = "🧪 Test de Leaderlix Automation"
        
        html_content = """
        <html>
        <body style="font-family: Arial, sans-serif; padding: 20px;">
            <h2 style="color: #0F172A;">¡Conexión exitosa!</h2>
            <p>Este es un correo de prueba de <strong>Leaderlix Automation</strong>.</p>
            <p>Tu cuenta de Gmail está correctamente configurada para enviar correos.</p>
            <hr style="border: 1px solid #E2E8F0; margin: 20px 0;">
            <p style="color: #64748B; font-size: 12px;">
                Enviado desde: {sender}<br>
                Fecha: {date}
            </p>
        </body>
        </html>
        """.format(
            sender=f"{sender_name} <{sender_email}>",
            date=datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
        )
        
        message.attach(MIMEText(html_content, 'html'))
        
        # Encode message
        raw_message = base64.urlsafe_b64encode(message.as_bytes()).decode('utf-8')
        
        # Send email
        result = service.users().messages().send(
            userId='me',
            body={'raw': raw_message}
        ).execute()
        
        # Update credentials if refreshed
        if credentials.token != gmail_creds.get("token"):
            await db.settings.update_one(
                {},
                {"$set": {"gmail_credentials.token": credentials.token}}
            )
        
        return {
            "success": True,
            "message_id": result.get('id'),
            "message": f"Email de prueba enviado a {to_email}"
        }
        
    except Exception as e:
        logger.error(f"Error sending test email: {e}")
        raise HTTPException(status_code=500, detail=f"Error al enviar email: {str(e)}")

@settings_router.put("/sender-name")
async def update_sender_name(sender_name: str, current_user: dict = Depends(get_current_user)):
    """Update the sender name for emails"""
    await db.settings.update_one(
        {},
        {"$set": {"sender_name": sender_name, "updated_at": datetime.now(timezone.utc).isoformat()}},
        upsert=True
    )
    return {"success": True, "message": f"Nombre del remitente actualizado a: {sender_name}"}

# ============ DASHBOARD STATS ============

@dashboard_router.get("/stats")
async def get_dashboard_stats(current_user: dict = Depends(get_current_user)):
    """Get dashboard statistics"""
    total_contacts = await db.hubspot_contacts.count_documents({})
    total_events = await db.webinar_events.count_documents({})
    total_campaigns = await db.campaigns.count_documents({})
    total_templates = await db.email_templates.count_documents({})
    
    # Email stats
    total_emails_sent = await db.email_logs.count_documents({"status": "sent"})
    total_emails_opened = await db.email_logs.count_documents({"opened_at": {"$ne": None}})
    total_emails_clicked = await db.email_logs.count_documents({"clicked_at": {"$ne": None}})
    
    # Deal movements
    total_deal_movements = await db.deal_movements.count_documents({})
    
    # Recent campaigns
    recent_campaigns = await db.campaigns.find({}, {"_id": 0}).sort("created_at", -1).limit(5).to_list(5)
    
    # Calculate rates
    open_rate = (total_emails_opened / total_emails_sent * 100) if total_emails_sent > 0 else 0
    click_rate = (total_emails_clicked / total_emails_sent * 100) if total_emails_sent > 0 else 0
    
    return {
        "total_contacts": total_contacts,
        "total_events": total_events,
        "total_campaigns": total_campaigns,
        "total_templates": total_templates,
        "total_emails_sent": total_emails_sent,
        "total_emails_opened": total_emails_opened,
        "total_emails_clicked": total_emails_clicked,
        "total_deal_movements": total_deal_movements,
        "open_rate": round(open_rate, 1),
        "click_rate": round(click_rate, 1),
        "recent_campaigns": recent_campaigns
    }


# ============ ADMIN ENDPOINTS ============

@dashboard_router.get("/admin/system-info")
async def get_system_info(current_user: dict = Depends(get_current_user)):
    """Get system information for admin panel"""
    import os
    from pathlib import Path
    
    # Database collections info
    collections_info = []
    for col_name in await db.list_collection_names():
        count = await db[col_name].count_documents({})
        collections_info.append({
            "name": col_name,
            "documents": count
        })
    collections_info.sort(key=lambda x: x["documents"], reverse=True)
    
    # Backups info
    backup_dir = Path("/app/backend/backups")
    backups = []
    if backup_dir.exists():
        for backup in sorted(backup_dir.glob("backup_*"), reverse=True):
            info_file = backup / "backup_info.json"
            if info_file.exists():
                import json
                with open(info_file) as f:
                    info = json.load(f)
                    total_docs = sum(info["collections"].values())
                    backups.append({
                        "name": backup.name,
                        "timestamp": info["timestamp"],
                        "collections": len(info["collections"]),
                        "documents": total_docs
                    })
    
    # System modules
    modules = [
        {"name": "Prospección", "status": "pending", "features": ["Scrappers (Railway)", "Generador contenido RRSS"]},
        {"name": "Nurturing", "status": "active", "features": ["Contactos", "Empresas", "Buyer Personas", "Importador CSV", "Campañas Email"]},
        {"name": "Cierre", "status": "pending", "features": ["Cotizador", "Seguimiento WhatsApp", "Propuestas"]},
        {"name": "Delivery", "status": "pending", "features": ["LMS", "Seguimiento proyectos", "Certificados"]},
        {"name": "Recompra", "status": "pending", "features": ["Testimonios", "CRM Ex-clientes", "Embajadores"]}
    ]
    
    return {
        "database": {
            "type": "MongoDB Atlas",
            "name": "leaderlix",
            "collections": collections_info,
            "total_collections": len(collections_info),
            "total_documents": sum(c["documents"] for c in collections_info)
        },
        "backups": backups,
        "modules": modules,
        "integrations": [
            {"name": "HubSpot", "status": "active", "description": "Sincronización de contactos y empresas"},
            {"name": "Gemini AI", "status": "active", "description": "Clasificación y generación de contenido"},
            {"name": "Gmail API", "status": "configured", "description": "Envío de emails"},
            {"name": "MongoDB Atlas", "status": "active", "description": "Base de datos en la nube"}
        ]
    }


@dashboard_router.post("/admin/backup")
async def create_backup(current_user: dict = Depends(get_current_user)):
    """Create a manual backup"""
    import subprocess
    result = subprocess.run(
        ["python3", "/app/backend/scripts/backup.py"],
        capture_output=True,
        text=True,
        cwd="/app/backend"
    )
    
    if result.returncode == 0:
        return {"success": True, "message": "Backup creado exitosamente", "output": result.stdout}
    else:
        raise HTTPException(status_code=500, detail=f"Error creando backup: {result.stderr}")


@dashboard_router.get("/admin/backups")
async def list_backups(current_user: dict = Depends(get_current_user)):
    """List all available backups"""
    from pathlib import Path
    import json
    
    backup_dir = Path("/app/backend/backups")
    backups = []
    
    if backup_dir.exists():
        for backup in sorted(backup_dir.glob("backup_*"), reverse=True):
            info_file = backup / "backup_info.json"
            if info_file.exists():
                with open(info_file) as f:
                    info = json.load(f)
                    total_docs = sum(info["collections"].values())
                    backups.append({
                        "name": backup.name,
                        "timestamp": info["timestamp"],
                        "collections": len(info["collections"]),
                        "documents": total_docs,
                        "details": info["collections"]
                    })
    
    return {"backups": backups, "total": len(backups)}


@misc_router.get("/email-logs")
async def get_email_logs(current_user: dict = Depends(get_current_user), limit: int = 50, skip: int = 0):
    """Get email send history"""
    logs = await db.email_logs.find({}, {"_id": 0}).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    total = await db.email_logs.count_documents({})
    return {"logs": logs, "total": total}

@misc_router.get("/deal-movements")
async def get_deal_movements(current_user: dict = Depends(get_current_user), limit: int = 50):
    """Get deal movement history"""
    movements = await db.deal_movements.find({}, {"_id": 0}).sort("timestamp", -1).limit(limit).to_list(limit)
    return {"movements": movements, "total": len(movements)}

# ============ SCHEDULER INFO ============

# Allowed days: Monday (0) to Thursday (3)
ALLOWED_SEND_DAYS = [0, 1, 2, 3]  # Mon, Tue, Wed, Thu
# Time windows (in hours)
MORNING_WINDOW = (8, 11)   # 8:00 AM - 11:00 AM
AFTERNOON_WINDOW = (16, 18)  # 4:00 PM - 6:00 PM
# Mexico City timezone offset (UTC-6)
TIMEZONE_OFFSET = -6

def get_available_time_slots(num_contacts: int, start_date: datetime = None) -> List[datetime]:
    """
    Generate unique time slots for each contact within allowed windows.
    Each contact gets a different time slot to avoid sending at the same hour.
    """
    if start_date is None:
        start_date = datetime.now(timezone.utc)
    
    time_slots = []
    current_date = start_date
    
    # Calculate total available minutes per day
    # Morning: 8-11 = 3 hours = 180 minutes
    # Afternoon: 16-18 = 2 hours = 120 minutes
    # Total: 300 minutes per day
    
    # Generate all possible time slots (every 5 minutes for variety)
    slot_interval_minutes = 5
    morning_slots_per_day = (MORNING_WINDOW[1] - MORNING_WINDOW[0]) * 60 // slot_interval_minutes  # 36 slots
    afternoon_slots_per_day = (AFTERNOON_WINDOW[1] - AFTERNOON_WINDOW[0]) * 60 // slot_interval_minutes  # 24 slots
    total_slots_per_day = morning_slots_per_day + afternoon_slots_per_day  # 60 slots per day
    
    slots_generated = 0
    days_checked = 0
    max_days = 365  # Safety limit
    
    while slots_generated < num_contacts and days_checked < max_days:
        # Check if current day is allowed (Mon-Thu)
        if current_date.weekday() in ALLOWED_SEND_DAYS:
            # Generate morning slots
            for i in range(morning_slots_per_day):
                if slots_generated >= num_contacts:
                    break
                hour = MORNING_WINDOW[0] + (i * slot_interval_minutes) // 60
                minute = (i * slot_interval_minutes) % 60
                slot_time = current_date.replace(
                    hour=hour, 
                    minute=minute, 
                    second=0, 
                    microsecond=0
                )
                # Adjust for timezone
                slot_time = slot_time - timedelta(hours=TIMEZONE_OFFSET)
                time_slots.append(slot_time)
                slots_generated += 1
            
            # Generate afternoon slots
            for i in range(afternoon_slots_per_day):
                if slots_generated >= num_contacts:
                    break
                hour = AFTERNOON_WINDOW[0] + (i * slot_interval_minutes) // 60
                minute = (i * slot_interval_minutes) % 60
                slot_time = current_date.replace(
                    hour=hour, 
                    minute=minute, 
                    second=0, 
                    microsecond=0
                )
                # Adjust for timezone
                slot_time = slot_time - timedelta(hours=TIMEZONE_OFFSET)
                time_slots.append(slot_time)
                slots_generated += 1
        
        current_date += timedelta(days=1)
        days_checked += 1
    
    # Shuffle to distribute across different times
    import random
    random.shuffle(time_slots)
    
    return time_slots[:num_contacts]

def format_time_slot(dt: datetime) -> dict:
    """Format datetime to readable time slot info"""
    # Convert to Mexico City time for display
    local_dt = dt + timedelta(hours=TIMEZONE_OFFSET)
    
    day_names = {
        0: "Lunes",
        1: "Martes", 
        2: "Miércoles",
        3: "Jueves",
        4: "Viernes",
        5: "Sábado",
        6: "Domingo"
    }
    
    hour = local_dt.hour
    if 8 <= hour < 11:
        window = "Mañana (8-11 AM)"
    else:
        window = "Tarde (4-6 PM)"
    
    return {
        "datetime": dt,
        "day_name": day_names[local_dt.weekday()],
        "time_slot": window,
        "formatted_time": local_dt.strftime("%H:%M"),
        "formatted_date": local_dt.strftime("%d/%m/%Y")
    }

@misc_router.get("/scheduler/info")
async def get_scheduler_info(current_user: dict = Depends(get_current_user)):
    """Get scheduler configuration info"""
    return {
        "schedule": "Cada 10 días hábiles",
        "allowed_days": "Lunes a Jueves",
        "time_windows": [
            {"name": "Mañana", "start": "8:00 AM", "end": "11:00 AM"},
            {"name": "Tarde", "start": "4:00 PM", "end": "6:00 PM"}
        ],
        "unique_times": "Cada contacto recibe su email en horario diferente",
        "timezone": "Ciudad de México (UTC-6)",
        "next_run": calculate_next_business_day_run(),
        "status": "configured_pending_gmail"
    }

def calculate_next_business_day_run():
    """Calculate the next run date (10 business days from now, Mon-Thu only)"""
    today = datetime.now(timezone.utc).date()
    business_days = 0
    current_date = today
    
    while business_days < 10:
        current_date += timedelta(days=1)
        # Monday = 0, Thursday = 3 (only Mon-Thu count)
        if current_date.weekday() in ALLOWED_SEND_DAYS:
            business_days += 1
    
    return current_date.isoformat()

# ============ CAMPAIGN CONFIRMATION ============

@campaigns_router.post("/confirm", response_model=CampaignConfirmationResponse)
async def get_campaign_confirmation(request: CampaignConfirmationRequest, current_user: dict = Depends(get_current_user)):
    """Get campaign confirmation with scheduled times and previews before sending"""
    
    campaign = await db.campaigns.find_one({"id": request.campaign_id}, {"_id": 0})
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
    
    # Get template
    template = await db.email_templates.find_one({"id": campaign["template_id"]}, {"_id": 0})
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    
    # Get events
    events = await db.webinar_events.find({"id": {"$in": campaign["event_ids"]}}, {"_id": 0}).to_list(100)
    events_info = [{"id": e["id"], "name": e["name"], "date": e.get("date"), "registration_link": e.get("registration_link")} for e in events]
    
    # Get contacts
    contacts = await db.hubspot_contacts.find({"id": {"$in": campaign["contact_ids"]}}, {"_id": 0}).to_list(1000)
    
    if not contacts:
        raise HTTPException(status_code=400, detail="No contacts in this campaign")
    
    # Generate unique time slots for each contact
    time_slots = get_available_time_slots(len(contacts))
    
    scheduled_emails = []
    for i, contact in enumerate(contacts):
        slot_info = format_time_slot(time_slots[i])
        scheduled_emails.append(ScheduledEmail(
            contact_id=contact["id"],
            contact_name=f"{contact.get('firstname', '')} {contact.get('lastname', '')}".strip() or "Sin nombre",
            contact_email=contact.get("email"),
            scheduled_datetime=slot_info["datetime"],
            day_name=slot_info["day_name"],
            time_slot=f"{slot_info['day_name']} {slot_info['formatted_date']} a las {slot_info['formatted_time']} ({slot_info['time_slot']})"
        ))
    
    # Sort by scheduled time
    scheduled_emails.sort(key=lambda x: x.scheduled_datetime)
    
    # Generate previews for first 3 contacts
    email_previews = []
    for contact in contacts[:3]:
        try:
            email_content = await generate_ai_email(template, events, contact)
            contact_name = f"{contact.get('firstname', '')} {contact.get('lastname', '')}".strip() or "Sin nombre"
            email_previews.append({
                "contact_name": contact_name,
                "contact_email": contact.get("email"),
                "subject": email_content["subject"],
                "body_preview": email_content["body_html"][:500] + "..." if len(email_content["body_html"]) > 500 else email_content["body_html"]
            })
        except Exception as e:
            logger.error(f"Error generating preview for contact {contact['id']}: {e}")
    
    # Calculate date range
    first_send = scheduled_emails[0].scheduled_datetime if scheduled_emails else datetime.now(timezone.utc)
    last_send = scheduled_emails[-1].scheduled_datetime if scheduled_emails else datetime.now(timezone.utc)
    
    return CampaignConfirmationResponse(
        campaign_id=campaign["id"],
        campaign_name=campaign["name"],
        template_name=template["name"],
        events=events_info,
        total_contacts=len(contacts),
        scheduled_emails=scheduled_emails,
        first_send_date=format_time_slot(first_send)["formatted_date"],
        last_send_date=format_time_slot(last_send)["formatted_date"],
        email_previews=email_previews
    )

@campaigns_router.post("/approve/{campaign_id}")
async def approve_campaign_send(campaign_id: str, current_user: dict = Depends(get_current_user)):
    """Approve and schedule a campaign for sending"""
    
    campaign = await db.campaigns.find_one({"id": campaign_id}, {"_id": 0})
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
    
    if campaign["status"] != "draft":
        raise HTTPException(status_code=400, detail="Campaign already approved or sent")
    
    # Get contacts and generate schedule
    contacts = await db.hubspot_contacts.find({"id": {"$in": campaign["contact_ids"]}}, {"_id": 0}).to_list(1000)
    time_slots = get_available_time_slots(len(contacts))
    
    # Create scheduled send records
    scheduled_sends = []
    for i, contact in enumerate(contacts):
        slot_info = format_time_slot(time_slots[i])
        scheduled_sends.append({
            "id": str(uuid.uuid4()),
            "campaign_id": campaign_id,
            "contact_id": contact["id"],
            "contact_email": contact.get("email"),
            "scheduled_at": time_slots[i].isoformat(),
            "status": "scheduled",
            "created_at": datetime.now(timezone.utc).isoformat()
        })
    
    # Store scheduled sends
    if scheduled_sends:
        await db.scheduled_sends.insert_many(scheduled_sends)
    
    # Update campaign status
    await db.campaigns.update_one(
        {"id": campaign_id},
        {"$set": {
            "status": "approved",
            "approved_at": datetime.now(timezone.utc).isoformat(),
            "approved_by": current_user["id"]
        }}
    )
    
    return {
        "message": f"Campaña aprobada. {len(scheduled_sends)} emails programados.",
        "campaign_id": campaign_id,
        "total_scheduled": len(scheduled_sends),
        "first_send": scheduled_sends[0]["scheduled_at"] if scheduled_sends else None,
        "last_send": scheduled_sends[-1]["scheduled_at"] if scheduled_sends else None,
        "note": "Los emails se enviarán en los horarios programados (pendiente implementar envío Gmail)"
    }

@campaigns_router.get("/scheduled/{campaign_id}")
async def get_campaign_schedule(campaign_id: str, current_user: dict = Depends(get_current_user)):
    """Get the scheduled sends for a campaign"""
    
    scheduled = await db.scheduled_sends.find(
        {"campaign_id": campaign_id}, 
        {"_id": 0}
    ).sort("scheduled_at", 1).to_list(1000)
    
    return {
        "campaign_id": campaign_id,
        "total_scheduled": len(scheduled),
        "scheduled_sends": scheduled
    }

@campaigns_router.post("/force-send/{campaign_id}")
async def force_send_campaign(campaign_id: str, current_user: dict = Depends(get_current_user)):
    """Force immediate send of all campaign emails (for testing)"""
    
    campaign = await db.campaigns.find_one({"id": campaign_id}, {"_id": 0})
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
    
    # Get settings for Gmail
    settings = await get_settings()
    if not settings.get("gmail_connected"):
        raise HTTPException(status_code=400, detail="Gmail no está conectado. Ve a Configuración para conectarlo.")
    
    gmail_creds = settings.get("gmail_credentials", {})
    sender_name = settings.get("sender_name", "Leaderlix")
    sender_email = gmail_creds.get("email", "")
    
    # Get template and events
    template = await db.email_templates.find_one({"id": campaign["template_id"]}, {"_id": 0})
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    
    events = await db.webinar_events.find({"id": {"$in": campaign["event_ids"]}}, {"_id": 0}).to_list(100)
    
    # Get contacts
    contacts = await db.hubspot_contacts.find({"id": {"$in": campaign["contact_ids"]}}, {"_id": 0}).to_list(1000)
    
    if not contacts:
        raise HTTPException(status_code=400, detail="No hay contactos en esta campaña")
    
    # Create Gmail credentials
    credentials = Credentials(
        token=gmail_creds.get("token"),
        refresh_token=gmail_creds.get("refresh_token"),
        token_uri=gmail_creds.get("token_uri"),
        client_id=gmail_creds.get("client_id"),
        client_secret=gmail_creds.get("client_secret"),
        scopes=gmail_creds.get("scopes")
    )
    
    service = build('gmail', 'v1', credentials=credentials)
    
    # Base URL for tracking
    base_url = os.environ.get("BASE_URL", "https://persona-assets.preview.emergentagent.com")
    
    sent_count = 0
    errors = []
    
    for contact in contacts:
        try:
            # Generate personalized email with AI
            email_content = await generate_ai_email(template, events, contact)
            
            # Create email log first to get ID for tracking
            email_log_id = str(uuid.uuid4())
            
            # Replace links with tracking links
            html_body = email_content['body_html']
            
            # Find all href links and replace with tracking URLs
            import re
            def replace_link(match):
                original_url = match.group(1)
                # Skip if already a tracking link
                if '/api/tracking/' in original_url:
                    return match.group(0)
                # Encode the original URL
                encoded_url = base64.urlsafe_b64encode(original_url.encode()).decode()
                link_id = str(uuid.uuid4())[:8]
                tracking_url = f"{base_url}/api/tracking/click/{email_log_id}/{link_id}?url={encoded_url}"
                return f'href="{tracking_url}"'
            
            html_body_tracked = re.sub(r'href=["\']([^"\']+)["\']', replace_link, html_body)
            
            # Create email message
            message = MIMEMultipart('alternative')
            message['to'] = contact.get("email")
            message['from'] = f"{sender_name} <{sender_email}>"
            message['subject'] = email_content['subject']
            
            message.attach(MIMEText(html_body_tracked, 'html'))
            
            # Encode and send
            raw_message = base64.urlsafe_b64encode(message.as_bytes()).decode('utf-8')
            
            result = service.users().messages().send(
                userId='me',
                body={'raw': raw_message}
            ).execute()
            
            # Log the send
            await db.email_logs.insert_one({
                "id": email_log_id,
                "campaign_id": campaign_id,
                "contact_id": contact["id"],
                "contact_email": contact.get("email"),
                "subject": email_content['subject'],
                "status": "sent",
                "sent_at": datetime.now(timezone.utc).isoformat(),
                "gmail_message_id": result.get("id")
            })
            
            sent_count += 1
            logger.info(f"Sent email to {contact.get('email')}")
            
        except Exception as e:
            error_msg = f"{contact.get('email')}: {str(e)}"
            errors.append(error_msg)
            logger.error(f"Error sending to {contact.get('email')}: {e}")
    
    # Update campaign status
    await db.campaigns.update_one(
        {"id": campaign_id},
        {"$set": {
            "status": "sent",
            "sent_at": datetime.now(timezone.utc).isoformat(),
            "emails_sent": sent_count,
            "emails_failed": len(errors)
        }}
    )
    
    # Update credentials if refreshed
    if credentials.token != gmail_creds.get("token"):
        await db.settings.update_one(
            {},
            {"$set": {"gmail_credentials.token": credentials.token}}
        )
    
    return {
        "success": True,
        "message": f"Envío forzado completado",
        "sent": sent_count,
        "failed": len(errors),
        "errors": errors[:5] if errors else []  # Only return first 5 errors
    }

# ============ BUYER PERSONAS DATABASE ROUTES ============

@buyer_personas_router.get("/")
async def get_buyer_personas_db(current_user: dict = Depends(get_current_user)):
    """Get all buyer personas from database"""
    personas = await db.buyer_personas_db.find({}, {"_id": 0}).to_list(500)
    return personas

@buyer_personas_router.get("/default")
async def get_default_buyer_persona(current_user: dict = Depends(get_current_user)):
    """Get the default buyer persona (Mateo)"""
    # Get default from settings or use hardcoded "Mateo"
    settings = await db.settings.find_one({}, {"_id": 0, "default_buyer_persona": 1})
    default_code = settings.get("default_buyer_persona", "mateo") if settings else "mateo"
    
    persona = await db.buyer_personas_db.find_one(
        {"$or": [{"code": default_code}, {"name": {"$regex": f"^{default_code}$", "$options": "i"}}]},
        {"_id": 0}
    )
    return {"default_code": default_code, "persona": persona}

@buyer_personas_router.post("/set-default/{persona_code}")
async def set_default_buyer_persona(
    persona_code: str,
    current_user: dict = Depends(get_current_user)
):
    """Set the default buyer persona for contacts without one"""
    # Verify persona exists
    persona = await db.buyer_personas_db.find_one(
        {"$or": [{"code": persona_code}, {"name": {"$regex": f"^{persona_code}$", "$options": "i"}}]},
        {"_id": 0}
    )
    if not persona:
        raise HTTPException(status_code=404, detail=f"Buyer persona '{persona_code}' not found")
    
    # Save to settings
    await db.settings.update_one(
        {},
        {"$set": {"default_buyer_persona": persona_code}},
        upsert=True
    )
    
    return {"message": f"Default buyer persona set to '{persona_code}'", "persona": persona}

@buyer_personas_router.post("/backfill-default")
async def backfill_default_buyer_persona(current_user: dict = Depends(get_current_user)):
    """Assign default buyer persona (Mateo) to all contacts without one"""
    # Get default from settings or use hardcoded "Mateo"
    settings = await db.settings.find_one({}, {"_id": 0, "default_buyer_persona": 1})
    default_code = settings.get("default_buyer_persona", "mateo") if settings else "mateo"
    
    # Get persona details
    persona = await db.buyer_personas_db.find_one(
        {"$or": [{"code": default_code}, {"name": {"$regex": f"^{default_code}$", "$options": "i"}}]},
        {"_id": 0}
    )
    if not persona:
        raise HTTPException(status_code=404, detail=f"Default buyer persona '{default_code}' not found. Please create it first.")
    
    persona_name = persona.get("name", default_code)
    
    # Update contacts without buyer_persona
    contacts_result = await db.contacts.update_many(
        {"$or": [
            {"buyer_persona": {"$exists": False}},
            {"buyer_persona": None},
            {"buyer_persona": ""},
            {"buyer_persona": "sin_clasificar"},
            {"buyer_persona": "Unclassified"}
        ]},
        {"$set": {"buyer_persona": persona_name}}
    )
    
    # Update businesses without buyer_persona
    businesses_result = await db.businesses.update_many(
        {"$or": [
            {"buyer_persona": {"$exists": False}},
            {"buyer_persona": None},
            {"buyer_persona": ""},
            {"buyer_persona": "sin_clasificar"},
            {"buyer_persona": "Unclassified"}
        ]},
        {"$set": {"buyer_persona": persona_name}}
    )
    
    return {
        "message": f"Backfill completed with buyer persona '{persona_name}'",
        "contacts_updated": contacts_result.modified_count,
        "businesses_updated": businesses_result.modified_count
    }

# ============ ACTIVE SECTORS ROUTES ============
# NOTE: These routes MUST come before /{persona_id} to avoid path conflicts

# Define default active sectors (hardcoded list - ONLY these 10 sectors)
DEFAULT_ACTIVE_SECTOR_NAMES = [
    # Farma
    "Pharmaceuticals", "PHARMACEUTICALS", "Farma", "Farmacéutica",
    # Dispositivos médicos
    "Medical Devices", "MEDICAL_DEVICES", "Dispositivos médicos", "Medical Equipment",
    # Automotriz
    "Automotive", "AUTOMOTIVE", "Automotriz",
    # Retail
    "Retail", "RETAIL",
    # Metalmecánica
    "Mining & Metals", "MINING_METALS", "Metalmecánica", "Metals",
    # Tecnología
    "Information Technology and Services", "INFORMATION_TECHNOLOGY_AND_SERVICES", 
    "Computer Software", "COMPUTER_SOFTWARE", "Tecnología", "Technology",
    # Telecomunicaciones
    "Telecommunications", "TELECOMMUNICATIONS", "Telecomunicaciones",
    # Banca
    "Banking", "BANKING", "Banca", "Financial Services", "FINANCIAL_SERVICES",
    # Alimentos, lácteos y bebidas
    "Food & Beverages", "FOOD_BEVERAGES", "Food Production", "FOOD_PRODUCTION",
    "Dairy", "DAIRY", "Alimentos", "Bebidas", "Lácteos",
    # Consumo
    "Consumer Goods", "CONSUMER_GOODS", "Consumo", "Consumer Services", "CONSUMER_SERVICES"
]

@buyer_personas_router.get("/active-sectors")
async def get_active_sectors(current_user: dict = Depends(get_current_user)):
    """Get list of active sectors with their status"""
    # Get sectors from our database
    sectors = await db.active_sectors.find({}, {"_id": 0}).to_list(500)
    
    # If no sectors in DB, initialize from HubSpot industries
    if not sectors:
        # Get HubSpot industries
        hubspot_industries = await db.industry_mappings.find({}, {"_id": 0}).to_list(200)
        
        now = datetime.now(timezone.utc).isoformat()
        sectors = []
        
        for industry in hubspot_industries:
            # Check if this industry should be active by default
            hubspot_label = industry.get("hubspot_label", "")
            hubspot_value = industry.get("hubspot_value", "")
            custom_name = industry.get("custom_name", "")
            
            is_active = any(
                active_name.lower() in hubspot_label.lower() or 
                active_name.lower() in hubspot_value.lower() or
                (custom_name and active_name.lower() in custom_name.lower())
                for active_name in DEFAULT_ACTIVE_SECTOR_NAMES
            )
            
            sector = {
                "code": hubspot_value,
                "hubspot_value": hubspot_value,
                "name": custom_name or hubspot_label or hubspot_value,
                "hubspot_label": hubspot_label,
                "is_active": is_active,
                "company_count": industry.get("company_count", 0),
                "created_at": now
            }
            sectors.append(sector)
            
            # Save to DB
            await db.active_sectors.update_one(
                {"code": hubspot_value},
                {"$set": sector},
                upsert=True
            )
        
        logger.info(f"Initialized {len(sectors)} sectors from HubSpot industries")
    
    # Add company counts from local companies database
    for sector in sectors:
        count = await db.companies.count_documents({"industry": sector.get("code") or sector.get("hubspot_value"), "is_active": True})
        sector["company_count"] = count
    
    # Sort by is_active desc, then by company_count desc
    sectors.sort(key=lambda x: (-int(x.get("is_active", False)), -x.get("company_count", 0)))
    
    return sectors

@buyer_personas_router.put("/active-sectors/{sector_code:path}")
async def toggle_sector_active(
    sector_code: str,
    is_active: bool,
    current_user: dict = Depends(get_current_user)
):
    """Toggle sector active status"""
    result = await db.active_sectors.update_one(
        {"code": sector_code},
        {"$set": {"is_active": is_active, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    if result.matched_count == 0:
        # Try to create it from industry mappings
        industry = await db.industry_mappings.find_one({"hubspot_value": sector_code}, {"_id": 0})
        if industry:
            await db.active_sectors.insert_one({
                "code": sector_code,
                "hubspot_value": sector_code,
                "name": industry.get("custom_name") or industry.get("hubspot_label") or sector_code,
                "hubspot_label": industry.get("hubspot_label"),
                "is_active": is_active,
                "created_at": datetime.now(timezone.utc).isoformat()
            })
        else:
            raise HTTPException(status_code=404, detail="Sector no encontrado")
    
    return {"success": True, "message": f"Sector {'activado' if is_active else 'desactivado'}"}

@buyer_personas_router.post("/sync-sectors-from-hubspot")
async def sync_sectors_from_hubspot(current_user: dict = Depends(get_current_user)):
    """Sync active sectors from HubSpot industries"""
    # Clear existing sectors
    await db.active_sectors.delete_many({})
    
    # Get industries from HubSpot cache
    industries = await db.industry_mappings.find({}, {"_id": 0}).to_list(200)
    
    now = datetime.now(timezone.utc).isoformat()
    synced = 0
    active_count = 0
    
    for industry in industries:
        hubspot_label = industry.get("hubspot_label", "")
        hubspot_value = industry.get("hubspot_value", "")
        custom_name = industry.get("custom_name", "")
        
        # Check if should be active by default
        is_active = any(
            active_name.lower() in hubspot_label.lower() or 
            active_name.lower() in hubspot_value.lower() or
            (custom_name and active_name.lower() in custom_name.lower())
            for active_name in DEFAULT_ACTIVE_SECTOR_NAMES
        )
        
        # Count companies in this industry from local database
        company_count = await db.companies.count_documents({"industry": hubspot_value, "is_active": True})
        
        sector = {
            "code": hubspot_value,
            "hubspot_value": hubspot_value,
            "name": custom_name or hubspot_label or hubspot_value,
            "hubspot_label": hubspot_label,
            "is_active": is_active,
            "company_count": company_count,
            "created_at": now
        }
        
        await db.active_sectors.insert_one(sector)
        synced += 1
        if is_active:
            active_count += 1
    
    return {
        "success": True,
        "message": f"Sincronizados {synced} sectores ({active_count} activos)",
        "total": synced,
        "active": active_count
    }

@buyer_personas_router.post("/import-csv")
async def import_buyer_personas_csv(current_user: dict = Depends(get_current_user)):
    """Generate buyer personas matrix based on active sectors and functional areas.
    Renamed from import-csv but kept for backwards compatibility."""
    return await generate_buyer_personas_matrix(current_user)

@buyer_personas_router.post("/generate-matrix")
async def generate_buyer_personas_matrix(current_user: dict = Depends(get_current_user)):
    """Generate buyer personas matrix based on active sectors and functional areas"""
    
    # Get active sectors from database
    db_sectors = await db.active_sectors.find({"is_active": True}, {"_id": 0}).to_list(50)
    
    # If no active sectors in DB, use default list
    if not db_sectors:
        active_sectors = [
            {"code": "farma", "name": "Farmacéutica"},
            {"code": "dispositivos_medicos", "name": "Dispositivos Médicos"},
            {"code": "retail", "name": "Retail"},
            {"code": "banca", "name": "Banca"},
            {"code": "automotriz", "name": "Automotriz"},
            {"code": "metalmecanica", "name": "Metalmecánica"},
            {"code": "alimentos", "name": "Alimentos"},
            {"code": "tecnologia", "name": "Tecnología"},
            {"code": "telecomunicaciones", "name": "Telecomunicaciones"},
            {"code": "consumo", "name": "Consumo"}
        ]
    else:
        # Use sectors from database
        active_sectors = [
            {"code": s.get("code") or s.get("hubspot_value"), "name": s.get("name") or s.get("hubspot_label")}
            for s in db_sectors
        ]
    
    # Define functional areas with representative names (7 areas: 6 standard + eventos)
    # Each area has a base name that will be combined with sector
    functional_areas = [
        {
            "code": "marketing",
            "name": "Direcciones de Marketing",
            "persona_name": "Miguel",  # Marketing
            "descripcion": "Tomadores de decisión del área de marketing. Responsables de estrategia de marca, comunicación y campañas.",
            "keywords": "Marketing Director; Director de Marketing; Directora de Marketing; CMO; Chief Marketing Officer; Head of Marketing; VP Marketing; Brand Director; Marketing Lead; Marketing Manager"
        },
        {
            "code": "comercial",
            "name": "Direcciones Comerciales",
            "persona_name": "Carlos",  # Comercial
            "descripcion": "Tomadores de decisión del área comercial y ventas. Responsables de resultados de negocio y gestión de fuerza de ventas.",
            "keywords": "Commercial Director; Director Comercial; Directora Comercial; Sales Director; VP Sales; Head of Sales; Chief Commercial Officer; CCO; Business Development Director; Sales Manager"
        },
        {
            "code": "medica",
            "name": "Direcciones Médicas",
            "persona_name": "Diana",  # Médica
            "descripcion": "Tomadores de decisión del área médica o científica. Responsables de lineamientos médicos y relación con profesionales de salud.",
            "keywords": "Medical Director; Director Médico; Directora Médica; Medical Affairs Director; Head of Medical Affairs; Chief Medical Officer; Scientific Director; Medical Manager"
        },
        {
            "code": "rrhh",
            "name": "Direcciones de RRHH",
            "persona_name": "Mariana",  # RRHH
            "descripcion": "Tomadores de decisión de recursos humanos, talento o capacitación. Responsables de desarrollo de talento y formación.",
            "keywords": "HR Director; Director de Recursos Humanos; Directora de RRHH; CHRO; Chief Human Resources Officer; Head of HR; Training Director; L&D Director; Learning and Development; People Director; Head of People; Talent Director; HR Manager"
        },
        {
            "code": "compras",
            "name": "Direcciones de Compras",
            "persona_name": "Patricia",  # Compras
            "descripcion": "Tomadores de decisión del área de compras y adquisiciones. Responsables de sourcing y negociación con proveedores.",
            "keywords": "Procurement Director; Director de Compras; Directora de Compras; Purchasing Director; Chief Procurement Officer; CPO; Head of Procurement; Supply Chain Director; Sourcing Director; Compras; Purchasing Manager"
        },
        {
            "code": "eventos",
            "name": "Event & Meeting Planners",
            "persona_name": "Valentina",  # Eventos
            "descripcion": "Responsables de organización de eventos corporativos, conferencias, congresos y reuniones. Coordinan logística y proveedores de eventos.",
            "keywords": "Event Planner; Meeting Planner; Event Manager; Event Director; Event Coordinator; Coordinador de Eventos; Conference Manager; Congress Organizer; MICE; Corporate Events; Eventos Corporativos; Trade Show; Convenciones"
        },
        {
            "code": "otras",
            "name": "Otras Direcciones",
            "persona_name": "Roberto",  # Otras
            "descripcion": "Tomadores de decisión de otras áreas funcionales como operaciones, finanzas, TI, legal, etc.",
            "keywords": "Operations Director; Director de Operaciones; CFO; CIO; CTO; IT Director; Finance Director; Legal Director; COO; General Manager; Plant Director; Director de Planta; Operations Manager"
        }
    ]
    
    # Sector short names for persona naming
    sector_short_names = {
        "pharmaceuticals": "Farma",
        "medical_devices": "Dispositivos",
        "automotive": "Automotriz",
        "retail": "Retail",
        "mining_&_metals": "Metalmecánica",
        "information_technology_and_services": "Tech",
        "telecommunications": "Telecom",
        "banking": "Banca",
        "food_&_beverages": "Alimentos",
        "consumer_goods": "Consumo",
        "otros_sectores": "Otros"
    }
    
    # Clear existing buyer personas
    await db.buyer_personas_db.delete_many({})
    
    now = datetime.now(timezone.utc).isoformat()
    personas = []
    
    # Generate matrix: Area x Active Sector
    for sector in active_sectors:
        for area in functional_areas:
            sector_code = sector['code'].replace(" ", "_").lower() if sector['code'] else "unknown"
            sector_short = sector_short_names.get(sector_code, sector['name'][:10])
            persona_display_name = f"{area['persona_name']} {sector_short}"
            
            persona = {
                "id": str(uuid.uuid4()),
                "code": f"{area['code']}_{sector_code}",
                "name": f"{area['name']} - {sector['name']}",
                "display_name": persona_display_name,  # e.g., "Mariana Retail", "Miguel Farma"
                "persona_name": area['persona_name'],
                "sector": sector['name'],
                "sector_code": sector_code,
                "sector_short": sector_short,
                "area": area['name'],
                "area_code": area['code'],
                "is_active_sector": True,
                "descripcion": f"{area['descripcion']} Sector: {sector['name']}.",
                "keywords": area['keywords'],
                "created_at": now,
                "updated_at": now
            }
            personas.append(persona)
    
    # Add personas for non-active sectors (same 7 areas)
    for area in functional_areas:
        persona_display_name = f"{area['persona_name']} Otros"
        persona = {
            "id": str(uuid.uuid4()),
            "code": f"{area['code']}_otros_sectores",
            "name": f"{area['name']} - Otros Sectores",
            "display_name": persona_display_name,
            "persona_name": area['persona_name'],
            "sector": "Otros Sectores",
            "sector_code": "otros_sectores",
            "sector_short": "Otros",
            "area": area['name'],
            "area_code": area['code'],
            "is_active_sector": False,
            "descripcion": f"{area['descripcion']} Para sectores no clasificados como activos.",
            "keywords": area['keywords'],
            "created_at": now,
            "updated_at": now
        }
        personas.append(persona)
    
    # Add Ramona (Médicos Especialistas)
    ramona = {
        "id": str(uuid.uuid4()),
        "code": "ramona_medicos",
        "name": "Ramona - Médicos Especialistas",
        "display_name": "Ramona",
        "persona_name": "Ramona",
        "sector": "Salud (Externos)",
        "sector_code": "salud_externo",
        "sector_short": "Médicos",
        "area": "Médicos Especialistas",
        "area_code": "medicos_especialistas",
        "is_active_sector": False,
        "is_special": True,
        "descripcion": "Médico o médica especialista que NO trabaja como empleado corporativo. Influye en adopción o recomendación médica, pero no en decisiones de compra corporativa.",
        "keywords": "Médico; Médica; Physician; Doctor; Medical Doctor; MD; Especialista; Cardiólogo; Oncólogo; Neurólogo; Pediatra; Ginecólogo; Dermatólogo; Cirujano; Internista",
        "created_at": now,
        "updated_at": now
    }
    personas.append(ramona)
    
    # Add Mateo (Residual)
    mateo = {
        "id": str(uuid.uuid4()),
        "code": "mateo_residual",
        "name": "Mateo - Sin Clasificar",
        "display_name": "Mateo",
        "persona_name": "Mateo",
        "sector": "General",
        "sector_code": "general",
        "sector_short": "General",
        "area": "Sin Clasificar",
        "area_code": "residual",
        "is_active_sector": False,
        "is_special": True,
        "descripcion": "Buyer persona residual para contactos que no encajan en ninguna otra clasificación. Incluye consultores independientes, fundadores, asesores y perfiles mixtos.",
        "keywords": "Consultant; Founder; Owner; Advisor; Freelance; Independent; Asesor; Consultor; Emprendedor; CEO pequeña empresa; Entrepreneur; Socio; Partner",
        "created_at": now,
        "updated_at": now
    }
    personas.append(mateo)
    
    # Insert all personas
    if personas:
        await db.buyer_personas_db.insert_many(personas)
    
    logger.info(f"Generated {len(personas)} buyer personas from {len(active_sectors)} active sectors and {len(functional_areas)} functional areas")
    
    return {
        "success": True, 
        "message": f"Generados {len(personas)} buyer personas", 
        "count": len(personas),
        "active_sectors": len(active_sectors),
        "active_sector_names": [s["name"] for s in active_sectors],
        "functional_areas": len(functional_areas),
        "matrix_size": len(active_sectors) * len(functional_areas),
        "other_sectors_personas": len(functional_areas),
        "special_personas": 2  # Ramona + Mateo
    }


# ============ BUYER PERSONA REVIEW WITH AI ============

# Functional Areas with shared keywords (these apply across ALL sectors)
FUNCTIONAL_AREAS = {
    "marketing": {
        "name": "Direcciones de Marketing",
        "keywords": [
            "marketing", "brand", "marca", "comunicación", "publicidad", "advertising",
            "CMO", "chief marketing", "head of marketing", "VP marketing", "director de marketing",
            "directora de marketing", "marketing director", "marketing lead", "marketing manager",
            "growth", "digital marketing", "content", "social media", "branding"
        ]
    },
    "comercial": {
        "name": "Direcciones Comerciales",
        "keywords": [
            "comercial", "ventas", "sales", "business development", "desarrollo de negocio",
            "CCO", "chief commercial", "head of sales", "VP sales", "director comercial",
            "directora comercial", "sales director", "commercial director", "revenue",
            "account", "cliente", "customer success", "trade", "channel"
        ]
    },
    "medica": {
        "name": "Direcciones Médicas",
        "keywords": [
            "médico", "medico", "medical", "científico", "scientific", "clinical", "clínico",
            "CMO medical", "chief medical", "medical director", "director médico", "directora médica",
            "medical affairs", "medical advisor", "MSL", "medical science liaison",
            "regulatory", "pharmacovigilance", "farmacovigilancia"
        ]
    },
    "rrhh": {
        "name": "Direcciones de RRHH",
        "keywords": [
            "recursos humanos", "human resources", "HR", "RRHH", "talento", "talent",
            "people", "cultura", "culture", "capacitación", "training", "L&D",
            "learning", "development", "CHRO", "chief human", "head of HR", "head of people",
            "director de recursos humanos", "directora de RRHH", "HR director", "HR manager",
            "organizational development", "desarrollo organizacional", "employee experience"
        ]
    },
    "compras": {
        "name": "Direcciones de Compras",
        "keywords": [
            "compras", "procurement", "purchasing", "sourcing", "supply chain", "cadena de suministro",
            "CPO", "chief procurement", "head of procurement", "director de compras",
            "directora de compras", "procurement director", "purchasing manager",
            "vendor", "proveedor", "supplier", "abastecimiento", "logistics", "logística"
        ]
    },
    "eventos": {
        "name": "Event & Meeting Planners",
        "keywords": [
            "event", "events", "eventos", "meeting", "meetings", "planner", "planning",
            "event planner", "meeting planner", "event manager", "event director",
            "coordinator", "coordinador", "coordinadora", "conference", "conferencias",
            "congreso", "congress", "convenciones", "conventions", "trade show",
            "corporate events", "eventos corporativos", "incentive", "incentivos",
            "MICE", "hospitality", "venue", "logistics events"
        ]
    },
    "otras": {
        "name": "Otras Direcciones",
        "keywords": [
            "operaciones", "operations", "finanzas", "finance", "CFO", "CIO", "CTO",
            "IT", "tecnología", "technology", "legal", "jurídico", "COO", "general manager",
            "director general", "CEO", "plant director", "director de planta",
            "manufacturing", "producción", "quality", "calidad", "EHS", "seguridad"
        ]
    },
    "medicos_especialistas": {
        "name": "Médicos Especialistas (Ramona)",
        "keywords": [
            "médico", "médica", "physician", "doctor", "MD", "especialista",
            "cardiólogo", "oncólogo", "neurólogo", "pediatra", "ginecólogo",
            "dermatólogo", "cirujano", "internista", "endocrinólogo", "traumatólogo"
        ],
        "is_special": True,
        "exclude_corporate": True
    },
    "residual": {
        "name": "Sin Clasificar (Mateo)",
        "keywords": [
            "consultant", "founder", "owner", "advisor", "freelance", "independent",
            "asesor", "consultor", "emprendedor", "entrepreneur", "socio", "partner"
        ],
        "is_special": True,
        "is_fallback": True
    }
}

@buyer_personas_router.get("/functional-areas")
async def get_functional_areas(current_user: dict = Depends(get_current_user)):
    """Get functional areas with their shared keywords"""
    custom_areas = await db.functional_areas.find({}, {"_id": 0}).to_list(20)
    
    if custom_areas:
        return custom_areas
    
    result = []
    for code, data in FUNCTIONAL_AREAS.items():
        result.append({
            "code": code,
            "name": data["name"],
            "keywords": data["keywords"],
            "is_special": data.get("is_special", False),
            "is_fallback": data.get("is_fallback", False),
            "exclude_corporate": data.get("exclude_corporate", False)
        })
    return result

@buyer_personas_router.put("/functional-areas/{area_code}/keywords")
async def update_functional_area_keywords(
    area_code: str,
    keywords: List[str] = Body(...),
    current_user: dict = Depends(get_current_user)
):
    """Update keywords for a functional area (applies to ALL sectors)"""
    if area_code not in FUNCTIONAL_AREAS:
        raise HTTPException(status_code=404, detail="Área funcional no encontrada")
    
    now = datetime.now(timezone.utc).isoformat()
    
    area_data = {
        "code": area_code,
        "name": FUNCTIONAL_AREAS[area_code]["name"],
        "keywords": keywords,
        "is_special": FUNCTIONAL_AREAS[area_code].get("is_special", False),
        "updated_at": now
    }
    
    await db.functional_areas.update_one(
        {"code": area_code},
        {"$set": area_data},
        upsert=True
    )
    
    await db.buyer_personas_db.update_many(
        {"area_code": area_code},
        {"$set": {"keywords": "; ".join(keywords), "updated_at": now}}
    )
    
    return {"success": True, "message": f"Keywords actualizadas para {area_code}", "updated_personas": True}

def classify_contact_to_buyer_persona(jobtitle: str, company_industry: str, active_sectors: list) -> dict:
    """Classify a contact based on job title and company industry."""
    jobtitle_lower = (jobtitle or "").lower()
    industry_lower = (company_industry or "").lower()
    
    matched_area = None
    matched_area_code = None
    max_matches = 0
    
    for area_code, area_data in FUNCTIONAL_AREAS.items():
        if area_data.get("is_fallback"):
            continue
        
        matches = sum(1 for kw in area_data["keywords"] if kw.lower() in jobtitle_lower)
        
        if matches > max_matches:
            max_matches = matches
            matched_area = area_data["name"]
            matched_area_code = area_code
    
    if matched_area_code == "medicos_especialistas":
        corporate_indicators = ["director", "manager", "head", "chief", "vp", "lead", "gerente"]
        has_corporate_title = any(ind in jobtitle_lower for ind in corporate_indicators)
        if has_corporate_title:
            matched_area = "Direcciones Médicas"
            matched_area_code = "medica"
    
    if not matched_area:
        matched_area = "Sin Clasificar (Mateo)"
        matched_area_code = "residual"
        return {
            "area_code": matched_area_code,
            "area_name": matched_area,
            "sector_code": "general",
            "sector_name": "General",
            "buyer_persona_name": "Mateo - Sin Clasificar",
            "confidence": "low"
        }
    
    sector_code = "otros_sectores"
    sector_name = "Otros Sectores"
    
    active_sector_codes = [s.get("code", "").lower() for s in active_sectors]
    active_sector_map = {s.get("code", "").lower(): s.get("name", s.get("code", "")) for s in active_sectors}
    
    if industry_lower:
        if industry_lower in active_sector_codes:
            sector_code = industry_lower
            sector_name = active_sector_map.get(industry_lower, industry_lower)
        else:
            for code, name in active_sector_map.items():
                if code in industry_lower or industry_lower in code or \
                   (name and (name.lower() in industry_lower or industry_lower in name.lower())):
                    sector_code = code
                    sector_name = name
                    break
    
    if matched_area_code in ["medicos_especialistas", "residual"]:
        buyer_persona_name = matched_area
    else:
        buyer_persona_name = f"{matched_area} - {sector_name}"
    
    return {
        "area_code": matched_area_code,
        "area_name": matched_area,
        "sector_code": sector_code,
        "sector_name": sector_name,
        "buyer_persona_name": buyer_persona_name,
        "confidence": "high" if max_matches >= 2 else "medium" if max_matches >= 1 else "low"
    }

@buyer_personas_router.post("/classify-preview")
async def preview_contact_classification(
    contact_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Preview how a contact would be classified (without changing anything)"""
    contact = await db.hubspot_contacts.find_one({"id": contact_id}, {"_id": 0})
    if not contact:
        raise HTTPException(status_code=404, detail="Contacto no encontrado")
    
    jobtitle = contact.get("jobtitle", "") or ""
    company = contact.get("company", "") or ""
    
    company_industry = None
    if company:
        company_doc = await db.companies.find_one(
            {"name": {"$regex": f"^{re.escape(company)}$", "$options": "i"}, "is_active": True},
            {"_id": 0, "industry": 1}
        )
        if company_doc:
            company_industry = company_doc.get("industry")
    
    active_sectors = await db.active_sectors.find({"is_active": True}, {"_id": 0}).to_list(100)
    
    classification = classify_contact_to_buyer_persona(jobtitle, company_industry, active_sectors)
    
    matching_persona = await db.buyer_personas_db.find_one({
        "area_code": classification["area_code"],
        "sector_code": classification["sector_code"]
    }, {"_id": 0})
    
    return {
        "contact": {
            "id": contact_id,
            "name": f"{contact.get('firstname', '')} {contact.get('lastname', '')}".strip(),
            "jobtitle": jobtitle,
            "company": company,
            "current_buyer_persona": contact.get("buyer_persona")
        },
        "company_industry": company_industry,
        "classification": classification,
        "matching_persona_id": matching_persona.get("id") if matching_persona else None,
        "matching_persona_code": matching_persona.get("code") if matching_persona else None
    }

@buyer_personas_router.post("/review-contacts")
async def review_contacts_buyer_persona(
    request: ReviewContactsRequest,
    current_user: dict = Depends(get_current_user)
):
    """Review contacts and assign/update buyer persona based on job title + company industry"""
    
    active_sectors = await db.active_sectors.find({"is_active": True}, {"_id": 0}).to_list(100)
    if not active_sectors:
        raise HTTPException(status_code=400, detail="No hay sectores activos. Sincroniza primero desde HubSpot.")
    
    personas_db = await db.buyer_personas_db.find({}, {"_id": 0}).to_list(500)
    if not personas_db:
        raise HTTPException(status_code=400, detail="No hay buyer personas. Genera la matriz primero.")
    
    persona_lookup = {}
    for p in personas_db:
        key = (p.get("area_code", ""), p.get("sector_code", ""))
        persona_lookup[key] = p
    
    query = {}
    if request.contact_ids and len(request.contact_ids) > 0:
        query["id"] = {"$in": request.contact_ids}
    elif request.buyer_persona_filter:
        query["buyer_persona"] = request.buyer_persona_filter
    
    contacts = await db.hubspot_contacts.find(query, {"_id": 0}).to_list(2000)
    
    if not contacts:
        return {"success": True, "message": "No hay contactos para revisar", "reviewed": 0, "changed": 0}
    
    headers = await get_hubspot_headers()
    
    reviewed_count = 0
    changed_count = 0
    errors = []
    changes_detail = []
    
    for contact in contacts:
        contact_id = contact.get("id")
        current_persona = contact.get("buyer_persona")
        jobtitle = contact.get("jobtitle", "") or ""
        company = contact.get("company", "") or ""
        
        company_industry = None
        if company:
            company_doc = await db.companies.find_one(
                {"name": {"$regex": f"^{re.escape(company)}$", "$options": "i"}, "is_active": True},
                {"_id": 0, "industry": 1}
            )
            if company_doc:
                company_industry = company_doc.get("industry")
        
        classification = classify_contact_to_buyer_persona(jobtitle, company_industry, active_sectors)
        
        lookup_key = (classification["area_code"], classification["sector_code"])
        matching_persona = persona_lookup.get(lookup_key)
        
        if not matching_persona and classification["sector_code"] != "otros_sectores":
            lookup_key = (classification["area_code"], "otros_sectores")
            matching_persona = persona_lookup.get(lookup_key)
        
        reviewed_count += 1
        
        if matching_persona:
            new_persona_code = matching_persona.get("code")
            new_display_name = matching_persona.get("display_name", matching_persona.get("name"))
            
            # Update if code changed OR force_update is True
            if new_persona_code and (new_persona_code != current_persona or request.force_update):
                try:
                    await db.hubspot_contacts.update_one(
                        {"id": contact_id},
                        {"$set": {
                            "buyer_persona": new_persona_code,
                            "buyer_persona_name": matching_persona.get("name"),
                            "buyer_persona_display_name": new_display_name,
                            "classified_area": classification["area_name"],
                            "classified_sector": classification["sector_name"],
                            "classification_confidence": classification["confidence"]
                        }}
                    )
                    changed_count += 1
                    changes_detail.append({
                        "contact_id": contact_id,
                        "contact_name": f"{contact.get('firstname', '')} {contact.get('lastname', '')}".strip(),
                        "jobtitle": jobtitle,
                        "company": company,
                        "company_industry": company_industry,
                        "old_persona": current_persona,
                        "new_persona": new_persona_code,
                        "new_persona_name": matching_persona.get("name"),
                        "new_display_name": new_display_name,
                        "confidence": classification["confidence"]
                    })
                    logger.info(f"Updated contact {contact_id} from {current_persona} to {new_persona_code}")
                except Exception as e:
                    errors.append(f"{contact_id}: {str(e)}")
        else:
            errors.append(f"{contact_id}: No matching buyer persona for area={classification['area_code']}, sector={classification['sector_code']}")
    
    return {
        "success": True,
        "message": f"Revisión completada",
        "reviewed": reviewed_count,
        "changed": changed_count,
        "changes": changes_detail[:20] if changes_detail else [],
        "errors": errors[:10] if errors else []
    }

# Routes with dynamic path parameters MUST come after static routes
@buyer_personas_router.get("/{persona_id}")
async def get_buyer_persona_db(persona_id: str, current_user: dict = Depends(get_current_user)):
    """Get a single buyer persona by ID"""
    persona = await db.buyer_personas_db.find_one({"id": persona_id}, {"_id": 0})
    if not persona:
        raise HTTPException(status_code=404, detail="Buyer persona no encontrado")
    return persona

@buyer_personas_router.post("/create")
async def create_buyer_persona_db(persona: BuyerPersonaDB, current_user: dict = Depends(get_current_user)):
    """Create a new buyer persona"""
    persona_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    
    persona_doc = {
        "id": persona_id,
        "hs_id": persona.hs_id,
        "name": persona.name,
        "industria": persona.industria,
        "descripcion": persona.descripcion,
        "otros_titulos": persona.otros_titulos,
        "actividades": persona.actividades,
        "no_confundir_con": persona.no_confundir_con,
        "reporta_a": persona.reporta_a,
        "keywords_hubspot_cargo": persona.keywords_hubspot_cargo,
        "created_at": now,
        "updated_at": now
    }
    
    await db.buyer_personas_db.insert_one(persona_doc)
    return {"success": True, "id": persona_id, "message": "Buyer persona creado"}

@buyer_personas_router.put("/{persona_id}")
async def update_buyer_persona_db(persona_id: str, persona: BuyerPersonaDBUpdate, current_user: dict = Depends(get_current_user)):
    """Update a buyer persona"""
    existing = await db.buyer_personas_db.find_one({"id": persona_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Buyer persona no encontrado")
    
    update_data = {k: v for k, v in persona.model_dump().items() if v is not None}
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    await db.buyer_personas_db.update_one({"id": persona_id}, {"$set": update_data})
    
    updated = await db.buyer_personas_db.find_one({"id": persona_id}, {"_id": 0})
    return updated

@buyer_personas_router.delete("/{persona_id}")
async def delete_buyer_persona_db(persona_id: str, current_user: dict = Depends(get_current_user)):
    """Delete a buyer persona"""
    result = await db.buyer_personas_db.delete_one({"id": persona_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Buyer persona no encontrado")
    return {"success": True, "message": "Buyer persona eliminado"}


# ============ THEMATIC AXES ROUTES ============

@thematic_axes_router.get("/")
async def get_thematic_axes(current_user: dict = Depends(get_current_user)):
    """Get all thematic axes"""
    axes = await db.thematic_axes.find({}, {"_id": 0}).sort("order", 1).to_list(100)
    return axes

@thematic_axes_router.post("/")
async def create_thematic_axis(axis: ThematicAxisCreate, current_user: dict = Depends(get_current_user)):
    """Create a new thematic axis"""
    axis_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    
    # Get max order
    max_order = await db.thematic_axes.find_one(sort=[("order", -1)])
    new_order = (max_order.get("order", 0) + 1) if max_order else 1
    
    axis_doc = {
        "id": axis_id,
        "name": axis.name,
        "description": axis.description or "",
        "hero_title": axis.hero_title or "",
        "hero_subtitle": axis.hero_subtitle or "",
        "buyer_personas": axis.buyer_personas or [],
        "order": new_order,
        "created_at": now,
        "updated_at": now
    }
    
    await db.thematic_axes.insert_one(axis_doc)
    if "_id" in axis_doc:
        del axis_doc["_id"]
    return axis_doc

@thematic_axes_router.put("/{axis_id}")
async def update_thematic_axis(axis_id: str, axis: ThematicAxisUpdate, current_user: dict = Depends(get_current_user)):
    """Update a thematic axis"""
    update_data = {"updated_at": datetime.now(timezone.utc).isoformat()}
    if axis.name is not None:
        update_data["name"] = axis.name
    if axis.description is not None:
        update_data["description"] = axis.description
    if axis.hero_title is not None:
        update_data["hero_title"] = axis.hero_title
    if axis.hero_subtitle is not None:
        update_data["hero_subtitle"] = axis.hero_subtitle
    if axis.buyer_personas is not None:
        update_data["buyer_personas"] = axis.buyer_personas
    if axis.keywords is not None:
        update_data["keywords"] = axis.keywords
    if axis.color is not None:
        update_data["color"] = axis.color
    
    result = await db.thematic_axes.update_one(
        {"id": axis_id},
        {"$set": update_data}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Eje temático no encontrado")
    
    # Return updated axis
    updated = await db.thematic_axes.find_one({"id": axis_id}, {"_id": 0})
    return {"success": True, "axis": updated}

@thematic_axes_router.delete("/{axis_id}")
async def delete_thematic_axis(axis_id: str, current_user: dict = Depends(get_current_user)):
    """Delete a thematic axis"""
    result = await db.thematic_axes.delete_one({"id": axis_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Eje temático no encontrado")
    return {"success": True, "message": "Eje temático eliminado"}

@thematic_axes_router.post("/seed")
async def seed_thematic_axes(current_user: dict = Depends(get_current_user)):
    """Seed initial thematic axes with full properties"""
    initial_axes = [
        {
            "name": "Storytelling y Presentaciones de Impacto", 
            "description": "Técnicas para comunicar ideas de manera memorable y persuasiva",
            "hero_title": "Presenta tus Ideas",
            "hero_subtitle": "como un Rockstar",
            "buyer_personas": []
        },
        {
            "name": "Liderazgo y Equipos Autónomos", 
            "description": "Desarrollo de habilidades de liderazgo y gestión de equipos de alto rendimiento",
            "hero_title": "Lidera tu Equipo",
            "hero_subtitle": "al siguiente nivel",
            "buyer_personas": []
        },
        {
            "name": "Inteligencia Artificial", 
            "description": "Aplicaciones prácticas de IA en el entorno empresarial",
            "hero_title": "Domina la IA",
            "hero_subtitle": "en tu negocio",
            "buyer_personas": []
        },
        {
            "name": "Marca Personal", 
            "description": "Construcción y posicionamiento de marca personal profesional",
            "hero_title": "Construye tu Marca",
            "hero_subtitle": "Personal",
            "buyer_personas": []
        },
        {
            "name": "Ventas y Persuasión", 
            "description": "Estrategias de venta consultiva y técnicas de persuasión",
            "hero_title": "Vende con",
            "hero_subtitle": "Confianza",
            "buyer_personas": []
        }
    ]
    
    now = datetime.now(timezone.utc).isoformat()
    created = 0
    for i, axis in enumerate(initial_axes):
        existing = await db.thematic_axes.find_one({"name": axis["name"]})
        if not existing:
            await db.thematic_axes.insert_one({
                "id": str(uuid.uuid4()),
                "name": axis["name"],
                "description": axis["description"],
                "hero_title": axis.get("hero_title", axis["name"]),
                "hero_subtitle": axis.get("hero_subtitle", ""),
                "buyer_personas": axis.get("buyer_personas", []),
                "order": i + 1,
                "created_at": now,
                "updated_at": now
            })
            created += 1
        else:
            # Update existing with new fields if missing
            await db.thematic_axes.update_one(
                {"name": axis["name"]},
                {"$set": {
                    "hero_title": existing.get("hero_title") or axis.get("hero_title", axis["name"]),
                    "hero_subtitle": existing.get("hero_subtitle") or axis.get("hero_subtitle", ""),
                    "buyer_personas": existing.get("buyer_personas") or [],
                    "updated_at": now
                }}
            )
    
    return {"success": True, "created": created, "message": "Ejes temáticos iniciales creados/actualizados"}


# ============ AI EVENT TITLE GENERATION ============


@events_router.post("/generate-title")
async def generate_event_title(request: GenerateEventTitleRequest, current_user: dict = Depends(get_current_user)):
    """Generate an attractive event title using AI based on thematic axis and buyer persona"""
    # Get thematic axis
    axis = await db.thematic_axes.find_one({"id": request.thematic_axis_id}, {"_id": 0})
    if not axis:
        raise HTTPException(status_code=404, detail="Eje temático no encontrado")
    
    # Get buyer persona
    persona = await db.buyer_personas_db.find_one({"code": request.buyer_persona_code}, {"_id": 0})
    if not persona:
        raise HTTPException(status_code=404, detail="Buyer persona no encontrado")
    
    # Get display name
    display_name = persona.get("display_name") or persona.get("persona_name") or persona.get("name", "")
    area = persona.get("area", "")
    sector = persona.get("sector", "")
    
    # Generate title with AI using Emergent LLM
    try:
        if not EMERGENT_LLM_KEY:
            raise Exception("Emergent LLM key not configured")
            
        prompt = f"""Genera un título atractivo y profesional para un webinar corporativo.

TEMA DEL WEBINAR: {axis['name']}
DESCRIPCIÓN DEL TEMA: {axis.get('description', '')}

AUDIENCIA (BUYER PERSONA):
- Nombre representativo: {display_name}
- Área funcional: {area}
- Sector/Industria: {sector}

INSTRUCCIONES:
1. El título debe ser corto (máximo 10 palabras)
2. Debe ser atractivo y profesional
3. Debe conectar el tema con los intereses de la audiencia
4. NO uses comillas ni dos puntos al inicio
5. Usa verbos de acción cuando sea posible
6. El título debe ser en español

Responde SOLO con el título, sin explicaciones adicionales."""

        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=f"title-gen-{request.buyer_persona_code}",
            system_message="Eres un experto en marketing que crea títulos atractivos para webinars."
        )
        chat = chat.with_model("gemini/gemini-2.0-flash")
        
        response = await chat.send_message(prompt)
        generated_title = response.strip().strip('"').strip("'")
        
        return {
            "success": True,
            "title": generated_title,
            "thematic_axis": axis["name"],
            "buyer_persona": display_name
        }
    except Exception as e:
        logger.error(f"Error generating title: {e}")
        # Fallback title
        fallback_title = f"{axis['name']} para {area}"
        return {
            "success": True,
            "title": fallback_title,
            "thematic_axis": axis["name"],
            "buyer_persona": display_name,
            "fallback": True
        }




# ============ API TOKENS MANAGEMENT ============

@settings_router.get("/api-tokens")
async def get_api_tokens(current_user: dict = Depends(get_current_user)):
    """Get all API tokens (masked for security)"""
    tokens = await db.api_tokens.find({}, {"_id": 0}).to_list(50)
    
    # Mask token values for security
    for token in tokens:
        if token.get("value"):
            value = token["value"]
            token["masked_value"] = f"{value[:10]}...{value[-4:]}" if len(value) > 14 else "***"
    
    return tokens

@settings_router.post("/api-tokens")
async def create_api_token(
    name: str,
    service: str,
    value: str,
    description: str = "",
    current_user: dict = Depends(get_current_user)
):
    """Create or update an API token"""
    now = datetime.now(timezone.utc).isoformat()
    
    # Check if token with same name exists
    existing = await db.api_tokens.find_one({"name": name})
    
    if existing:
        # Update existing
        await db.api_tokens.update_one(
            {"name": name},
            {"$set": {
                "service": service,
                "value": value,
                "description": description,
                "updated_at": now,
                "updated_by": current_user.get("email")
            }}
        )
        return {"success": True, "message": f"Token '{name}' updated"}
    else:
        # Create new
        doc = {
            "id": str(uuid.uuid4()),
            "name": name,
            "service": service,
            "value": value,
            "description": description,
            "created_at": now,
            "created_by": current_user.get("email"),
            "updated_at": now
        }
        await db.api_tokens.insert_one(doc)
        return {"success": True, "message": f"Token '{name}' created", "id": doc["id"]}

@settings_router.delete("/api-tokens/{token_name}")
async def delete_api_token(token_name: str, current_user: dict = Depends(get_current_user)):
    """Delete an API token"""
    result = await db.api_tokens.delete_one({"name": token_name})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Token not found")
    return {"success": True, "message": f"Token '{token_name}' deleted"}

@settings_router.get("/api-tokens/{token_name}/value")
async def get_api_token_value(token_name: str, current_user: dict = Depends(get_current_user)):
    """Get the actual value of an API token (for internal use)"""
    token = await db.api_tokens.find_one({"name": token_name}, {"_id": 0, "value": 1})
    if not token:
        raise HTTPException(status_code=404, detail="Token not found")
    return {"value": token["value"]}


# ============ LINKEDIN SEARCH KEYWORDS (for Posts scraping) ============

@settings_router.get("/linkedin-keywords")
async def get_linkedin_keywords(current_user: dict = Depends(get_current_user)):
    """Get all LinkedIn search keywords for post scraping"""
    keywords = await db.linkedin_search_keywords.find({}, {"_id": 0}).to_list(200)
    return keywords

@settings_router.post("/linkedin-keywords")
async def create_linkedin_keyword(
    keyword: str,
    category: str = "general",
    description: str = "",
    current_user: dict = Depends(get_current_user)
):
    """Add a new LinkedIn search keyword"""
    existing = await db.linkedin_search_keywords.find_one({"keyword": keyword})
    if existing:
        raise HTTPException(status_code=400, detail="Keyword already exists")
    
    doc = {
        "id": str(uuid.uuid4()),
        "keyword": keyword,
        "category": category,
        "description": description,
        "active": True,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.linkedin_search_keywords.insert_one(doc)
    return {"success": True, "message": "Keyword added", "id": doc["id"]}


class BulkKeywordUpdate(BaseModel):
    keywords: List[str]
    active: bool


class BulkKeywordDelete(BaseModel):
    keywords: List[str]


# IMPORTANT: Bulk routes must be defined BEFORE {keyword_id} routes to avoid path conflicts
@settings_router.put("/linkedin-keywords/bulk")
async def bulk_update_keywords(data: BulkKeywordUpdate, current_user: dict = Depends(get_current_user)):
    """Bulk activate/deactivate keywords"""
    result = await db.linkedin_search_keywords.update_many(
        {"keyword": {"$in": data.keywords}},
        {"$set": {"active": data.active}}
    )
    return {"success": True, "modified_count": result.modified_count}


@settings_router.delete("/linkedin-keywords/bulk")
async def bulk_delete_keywords(data: BulkKeywordDelete, current_user: dict = Depends(get_current_user)):
    """Bulk delete keywords"""
    result = await db.linkedin_search_keywords.delete_many(
        {"keyword": {"$in": data.keywords}}
    )
    return {"success": True, "deleted_count": result.deleted_count}


@settings_router.put("/linkedin-keywords/{keyword_id}")
async def update_linkedin_keyword(
    keyword_id: str,
    keyword: str = None,
    category: str = None,
    description: str = None,
    active: bool = None,
    current_user: dict = Depends(get_current_user)
):
    """Update a LinkedIn search keyword"""
    update_data = {"updated_at": datetime.now(timezone.utc).isoformat()}
    if keyword is not None:
        update_data["keyword"] = keyword
    if category is not None:
        update_data["category"] = category
    if description is not None:
        update_data["description"] = description
    if active is not None:
        update_data["active"] = active
    
    result = await db.linkedin_search_keywords.update_one(
        {"id": keyword_id},
        {"$set": update_data}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Keyword not found")
    return {"success": True, "message": "Keyword updated"}

@settings_router.delete("/linkedin-keywords/{keyword_id}")
async def delete_linkedin_keyword(keyword_id: str, current_user: dict = Depends(get_current_user)):
    """Delete a LinkedIn search keyword"""
    result = await db.linkedin_search_keywords.delete_one({"id": keyword_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Keyword not found")
    return {"success": True, "message": "Keyword deleted"}


@settings_router.post("/linkedin-keywords/seed")
async def seed_linkedin_keywords(current_user: dict = Depends(get_current_user)):
    """Seed initial LinkedIn search keywords"""
    keywords = [
        # Events
        {"keyword": "Congreso médico", "category": "events"},
        {"keyword": "Kickoff", "category": "events"},
        {"keyword": "Townhall", "category": "events"},
        {"keyword": "cierro un capitulo", "category": "transitions"},
        {"keyword": "abro un capitulo", "category": "transitions"},
        {"keyword": "cierro una etapa", "category": "transitions"},
        {"keyword": "abro una etapa", "category": "transitions"},
        # Mexican Medical Councils
        {"keyword": "Consejo Mexicano de Angiología, Cirugía Vascular y Endovascular", "category": "medical_council"},
        {"keyword": "Consejo Mexicano de Cardiología", "category": "medical_council"},
        {"keyword": "Consejo Mexicano de Certificación en Infectología", "category": "medical_council"},
        {"keyword": "Consejo Mexicano de Certificación en Medicina Familiar", "category": "medical_council"},
        {"keyword": "Consejo Mexicano de Certificación en Pediatría", "category": "medical_council"},
        {"keyword": "Consejo Mexicano de Certificación en Radioterapia", "category": "medical_council"},
        {"keyword": "Consejo Mexicano de Cirugía General", "category": "medical_council"},
        {"keyword": "Consejo Mexicano de Cirugía Neurológica", "category": "medical_council"},
        {"keyword": "Consejo Mexicano de Cirugía Oral y Maxilofacial", "category": "medical_council"},
        {"keyword": "Consejo Mexicano de Cirugía Pediátrica", "category": "medical_council"},
        {"keyword": "Consejo Mexicano de Cirugía Plástica, Estética y Reconstructiva", "category": "medical_council"},
        {"keyword": "Consejo Mexicano de Comunicación, Audiología, Otoneurología y Foniatría", "category": "medical_council"},
        {"keyword": "Consejo Mexicano de Dermatología", "category": "medical_council"},
        {"keyword": "Consejo Mexicano de Endocrinología", "category": "medical_council"},
        {"keyword": "Consejo Mexicano de Especialistas en Coloproctología", "category": "medical_council"},
        {"keyword": "Consejo Mexicano de Gastroenterología", "category": "medical_council"},
        {"keyword": "Consejo Mexicano de Genética", "category": "medical_council"},
        {"keyword": "Consejo Mexicano de Geriatría", "category": "medical_council"},
        {"keyword": "Consejo Mexicano de Ginecología y Obstetricia", "category": "medical_council"},
        {"keyword": "Consejo Mexicano de Hematología", "category": "medical_council"},
        {"keyword": "Consejo Mexicano de Medicina Aeroespacial", "category": "medical_council"},
        {"keyword": "Consejo Mexicano de Medicina Crítica", "category": "medical_council"},
        {"keyword": "Consejo Mexicano de Medicina de Rehabilitación", "category": "medical_council"},
        {"keyword": "Consejo Mexicano de Medicina de Urgencias", "category": "medical_council"},
        {"keyword": "Consejo Mexicano de Medicina Interna", "category": "medical_council"},
        {"keyword": "Consejo Mexicano de Medicina Legal y Forense", "category": "medical_council"},
        {"keyword": "Consejo Mexicano de Medicina Nuclear e Imagen Molecular", "category": "medical_council"},
        {"keyword": "Consejo Mexicano de Médicos Anatomopatólogos", "category": "medical_council"},
        {"keyword": "Consejo Mexicano de Nefrología", "category": "medical_council"},
        {"keyword": "Consejo Mexicano de Neurofisiología Clínica", "category": "medical_council"},
        {"keyword": "Consejo Mexicano de Neurología", "category": "medical_council"},
        {"keyword": "Consejo Mexicano de Oftalmología", "category": "medical_council"},
        {"keyword": "Consejo Mexicano de Oncología", "category": "medical_council"},
        {"keyword": "Consejo Mexicano de Ortopedia y Traumatología", "category": "medical_council"},
        {"keyword": "Consejo Mexicano de Otorrinolaringología y Cirugía de Cabeza y Cuello", "category": "medical_council"},
        {"keyword": "Consejo Mexicano de Patología Clínica y Medicina de Laboratorio", "category": "medical_council"},
        {"keyword": "Consejo Mexicano de Psiquiatría", "category": "medical_council"},
        {"keyword": "Consejo Mexicano de Radiología e Imagen", "category": "medical_council"},
        {"keyword": "Consejo Mexicano de Reumatología", "category": "medical_council"},
        {"keyword": "Consejo Nacional de Certificación en Anestesiología, A. C.", "category": "medical_council"},
        {"keyword": "Consejo Nacional de Cirugía del Tórax", "category": "medical_council"},
        {"keyword": "Consejo Nacional de Inmunología Clínica y Alergia", "category": "medical_council"},
        {"keyword": "Consejo Nacional de Medicina del Deporte", "category": "medical_council"},
        {"keyword": "Consejo Nacional de Neumología", "category": "medical_council"},
        {"keyword": "Consejo Nacional de Salud Pública", "category": "medical_council"},
        {"keyword": "Consejo Nacional Mexicano de Medicina del Trabajo", "category": "medical_council"},
        {"keyword": "Consejo Nacional Mexicano de Urología, A.C", "category": "medical_council"},
    ]
    
    added = 0
    for kw in keywords:
        existing = await db.linkedin_search_keywords.find_one({"keyword": kw["keyword"]})
        if not existing:
            doc = {
                "id": str(uuid.uuid4()),
                "keyword": kw["keyword"],
                "category": kw["category"],
                "description": "",
                "active": True,
                "created_at": datetime.now(timezone.utc).isoformat()
            }
            await db.linkedin_search_keywords.insert_one(doc)
            added += 1
    
    return {"success": True, "added": added, "total": len(keywords)}
