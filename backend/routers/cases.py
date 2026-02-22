"""
Cases Router - Deal/Quote Management from HubSpot
Handles import of deals (casos) from HubSpot with contact association
Stages: 
  Stage 3 (Sales): caso_solicitado -> caso_presentado -> interes_en_caso -> cierre_administrativo
  Stage 4 (Delivery): ganados -> concluidos -> contenidos_transcritos -> reporte_presentado -> caso_publicado
Status: active, descartado
"""
import os
import re
import uuid
import logging
from datetime import datetime, timezone
from typing import Optional, List
from fastapi import APIRouter, HTTPException, Depends, BackgroundTasks, Query
from pydantic import BaseModel
from dotenv import load_dotenv

load_dotenv()

from database import db
from routers.auth import get_current_user
from routers.events_v2 import (
    parse_hubspot_list_url,
    get_hubspot_contacts_batch,
    ensure_company_exists,
    classify_buyer_persona_by_job_title
)
from utils.hubspot_helpers import get_hubspot_token, get_hubspot_headers
from constants.stages import (
    STAGE_3_VALUES, STAGE_4_VALUES, ALL_CASE_STAGES,
    is_stage_3, is_stage_4, get_stage_phase, validate_stage_transition
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/cases", tags=["cases"])


# ============ CONSTANTS ============

# All deal properties to fetch from HubSpot
HUBSPOT_DEAL_PROPERTIES = [
    "dealname", "amount", "dealstage", "pipeline",
    "closedate", "hs_lastmodifieddate", "createdate",
    "description", "notes_last_updated",
    # Custom properties
    "nombre_del_caso_de_este_proyecto",
    "nombre_anonimo_del_caso_de_este_proyecto_clonada",
    "archivo_en_drive_de_la_cotizacion",
    "slides",
    "archivo_de_reporte_de_este_proyecto_",
    "link_del_caso_en_google_drive",
    "transcripcion_de_todas_las_llamadas_de_alineacion",
    "todas_las_transcripciones_de_alumnos",
    "cual_es_el_objetivo_a_nivel__resultado_de_negocios__",
    "cual_es_el_objetivo_a_nivel__cambio_de_comportamiento__",
    "cual_es_el_objetivo_a_nivel__aprendizaje__",
    "cual_es_el_objetivo_a_nivel__experiencia__",
    "servicio_cotizado"
]

# HubSpot association labels → Internal roles mapping
HUBSPOT_LABEL_TO_ROLE = {
    "Recomendado": "champion",
    "Alumno Autodidacta": "student",
    "Deal Maker": "deal_maker",
    "Patrocinador Ejecutivo": "sponsor",
    "Administración": "asistente_deal_maker",
    "Alumno Yo te Enseño": "student",
    "Alumno Lo Hago Contigo": "coachee",
    "Compras": "procurement",
    "Consejero": "advisor",
    "Logística": "asistente_deal_maker",
    "Speaker (Testimonial)": "speaker",
    "Evaluador 360": "evaluador_360",
    "Alumno Masterclass sin Membresía": "student",
    "Speaker (Trusted Speaker, Facilitador)": "speaker",
    "Staff: Capitán": "staff",
    "Staff: Video para Feedback": "staff",
    "Staff: Playbooks y Materiales": "staff",
    "Staff: Montaje": "staff",
    "Staff: Micrófonos": "staff",
    "Staff: Computadora": "staff",
    "Staff: Time Keeping": "staff",
}


# ============ MODELS ============

class ImportCasesRequest(BaseModel):
    """Request to import deals from HubSpot"""
    hubspot_list_url: str
    case_stage: str = "caso_solicitado"  # caso_solicitado, caso_presentado, interes_en_caso, cierre_administrativo
    case_status: str = "active"  # active, descartado


class UpdateCaseRequest(BaseModel):
    """Request to update a case"""
    stage: Optional[str] = None  # caso_solicitado, caso_presentado, interes_en_caso, cierre_administrativo
    status: Optional[str] = None  # active, descartado
    discard_reason: Optional[str] = None
    notes: Optional[str] = None


class AddQuoteRequest(BaseModel):
    """Request to add a manual quote"""
    title: str
    url: str
    source: str = "google_drive"  # google_drive, other


class CreateCaseRequest(BaseModel):
    """Request to create a case manually"""
    name: str
    company_name: Optional[str] = None
    amount: Optional[float] = None
    currency: str = "MXN"
    stage: str = "caso_solicitado"
    status: str = "active"
    contact_ids: Optional[List[str]] = []
    notes: Optional[str] = None


# ============ HUBSPOT DEALS FUNCTIONS ============

async def get_hubspot_list_deals(list_id: str) -> List[str]:
    """Get all deal IDs from a HubSpot list (deals list)"""
    import httpx
    
    headers = await get_hubspot_headers()
    
    async with httpx.AsyncClient() as client:
        all_ids = []
        after = None
        
        while True:
            url = f"https://api.hubapi.com/crm/v3/lists/{list_id}/memberships?limit=500"
            if after:
                url += f"&after={after}"
            
            response = await client.get(
                url,
                headers=headers,
                timeout=30.0
            )
            
            if response.status_code != 200:
                logger.error(f"HubSpot list error: {response.status_code} - {response.text}")
                break
            
            data = response.json()
            ids = [r["recordId"] for r in data.get("results", [])]
            all_ids.extend(ids)
            
            paging = data.get("paging", {})
            if "next" in paging:
                after = paging["next"].get("after")
            else:
                break
        
        return all_ids


async def get_hubspot_deals_batch(deal_ids: List[str]) -> List[dict]:
    """Get full details for a batch of deals from HubSpot"""
    import httpx
    
    if not deal_ids:
        return []
    
    headers = await get_hubspot_headers()
    
    async with httpx.AsyncClient() as client:
        response = await client.post(
            "https://api.hubapi.com/crm/v3/objects/deals/batch/read",
            headers=headers,
            json={
                "properties": HUBSPOT_DEAL_PROPERTIES,
                "inputs": [{"id": str(did)} for did in deal_ids]
            },
            timeout=60.0
        )
        
        if response.status_code == 200:
            return response.json().get("results", [])
        else:
            logger.error(f"HubSpot deals batch error: {response.status_code} - {response.text}")
            return []


async def get_deal_associated_contacts(deal_id: str) -> List[dict]:
    """Get contact IDs and association labels from a deal"""
    import httpx
    
    headers = await get_hubspot_headers()
    
    async with httpx.AsyncClient() as client:
        response = await client.get(
            f"https://api.hubapi.com/crm/v4/objects/deals/{deal_id}/associations/contacts",
            headers=headers,
            timeout=30.0
        )
        
        if response.status_code == 200:
            results = response.json().get("results", [])
            contacts_with_labels = []
            for r in results:
                contact_id = r["toObjectId"]
                # Extract labels from associationTypes
                labels = []
                for assoc_type in r.get("associationTypes", []):
                    label = assoc_type.get("label")
                    if label:
                        labels.append(label)
                contacts_with_labels.append({
                    "hubspot_id": contact_id,
                    "labels": labels
                })
            return contacts_with_labels
        else:
            logger.warning(f"Could not get deal contact associations for {deal_id}: {response.status_code}")
            return []


async def get_deal_associated_companies(deal_id: str) -> List[str]:
    """Get ALL company IDs associated with a deal"""
    import httpx
    
    headers = await get_hubspot_headers()
    
    async with httpx.AsyncClient() as client:
        response = await client.get(
            f"https://api.hubapi.com/crm/v4/objects/deals/{deal_id}/associations/companies",
            headers=headers,
            timeout=30.0
        )
        
        if response.status_code == 200:
            results = response.json().get("results", [])
            return [r["toObjectId"] for r in results]
        else:
            logger.warning(f"Could not get deal company associations for {deal_id}: {response.status_code}")
            return []


async def get_deal_associated_quotes(deal_id: str) -> List[dict]:
    """Get ALL quotes associated with a deal from HubSpot"""
    import httpx
    
    headers = await get_hubspot_headers()
    
    async with httpx.AsyncClient() as client:
        # First get quote IDs
        response = await client.get(
            f"https://api.hubapi.com/crm/v4/objects/deals/{deal_id}/associations/quotes",
            headers=headers,
            timeout=30.0
        )
        
        if response.status_code != 200:
            logger.warning(f"Could not get deal quote associations for {deal_id}: {response.status_code}")
            return []
        
        results = response.json().get("results", [])
        quote_ids = [r["toObjectId"] for r in results]
        
        if not quote_ids:
            return []
        
        # Fetch quote details
        quotes = []
        for quote_id in quote_ids:
            quote_response = await client.get(
                f"https://api.hubapi.com/crm/v3/objects/quotes/{quote_id}",
                headers=headers,
                params={
                    "properties": "hs_title,hs_status,hs_quote_amount,hs_public_url_key,hs_pdf_download_link,hs_createdate"
                },
                timeout=30.0
            )
            
            if quote_response.status_code == 200:
                quote_data = quote_response.json()
                props = quote_data.get("properties", {})
                quotes.append({
                    "hubspot_quote_id": quote_id,
                    "title": props.get("hs_title", "Sin título"),
                    "amount": props.get("hs_quote_amount"),
                    "status": props.get("hs_status"),
                    "public_url": f"https://app.hubspot.com/quotes/{quote_id}" if props.get("hs_public_url_key") else None,
                    "pdf_url": props.get("hs_pdf_download_link"),
                    "created_at": props.get("hs_createdate"),
                    "source": "hubspot_native"
                })
        
        return quotes


# ============ IMPORT PROGRESS TRACKING ============

cases_import_progress = {}


async def import_hubspot_deals_with_progress(
    import_id: str,
    list_url: str,
    case_stage: str,
    case_status: str
):
    """
    Background task to import deals from HubSpot with progress tracking.
    Imports associated contacts, ALL companies, and ALL quotes.
    """
    now = datetime.now(timezone.utc).isoformat()
    
    try:
        # Initialize progress
        cases_import_progress[import_id] = {
            "status": "starting",
            "phase": "Obteniendo lista de HubSpot...",
            "percent": 0,
            "total": 0,
            "processed": 0,
            "created": 0,
            "updated": 0,
            "contacts_updated": 0,
            "companies_imported": 0,
            "quotes_imported": 0,
            "errors": 0
        }
        
        # Parse list URL
        list_id = parse_hubspot_list_url(list_url)
        if not list_id:
            cases_import_progress[import_id] = {
                "status": "error",
                "error": "URL de lista inválida",
                "phase": "Error"
            }
            return
        
        # Get deal IDs from list
        deal_ids = await get_hubspot_list_deals(list_id)
        if not deal_ids:
            cases_import_progress[import_id] = {
                "status": "complete",
                "phase": "Lista vacía",
                "percent": 100,
                "total": 0,
                "created": 0,
                "updated": 0
            }
            return
        
        total_deals = len(deal_ids)
        cases_import_progress[import_id].update({
            "status": "importing",
            "phase": f"Procesando {total_deals} negocios...",
            "total": total_deals,
            "percent": 5
        })
        
        # Fetch deals in batches
        all_deals = []
        batch_size = 100
        for i in range(0, len(deal_ids), batch_size):
            batch = deal_ids[i:i + batch_size]
            deals = await get_hubspot_deals_batch(batch)
            all_deals.extend(deals)
            
            cases_import_progress[import_id].update({
                "phase": f"Obteniendo datos: {len(all_deals)}/{total_deals}",
                "percent": int(5 + (len(all_deals) / total_deals * 15))
            })
        
        # Process each deal
        created = 0
        updated = 0
        contacts_updated = 0
        companies_imported = 0
        quotes_imported = 0
        errors = 0
        
        for idx, deal in enumerate(all_deals):
            try:
                props = deal.get("properties", {})
                hubspot_deal_id = deal.get("id")
                
                # Determine case name (priority: nombre_del_caso_de_este_proyecto > dealname)
                case_name = props.get("nombre_del_caso_de_este_proyecto") or props.get("dealname") or "Sin nombre"
                
                # Check if case already exists
                existing_case = await db.cases.find_one({"hubspot_deal_id": hubspot_deal_id})
                
                # Get ALL associated companies
                company_hs_ids = await get_deal_associated_companies(hubspot_deal_id)
                company_ids = []
                company_names = []
                
                for hs_company_id in company_hs_ids:
                    company_id = await ensure_company_exists(hs_company_id)
                    if company_id:
                        company_ids.append(company_id)
                        # Search in unified_companies (single source)
                        company_doc = await db.unified_companies.find_one({
                            "$or": [{"id": company_id}, {"hubspot_id": company_id}, {"hs_object_id": company_id}]
                        })
                        if company_doc:
                            company_names.append(company_doc.get("name", ""))
                        companies_imported += 1
                
                # Get ALL associated quotes from HubSpot
                hubspot_quotes = await get_deal_associated_quotes(hubspot_deal_id)
                quotes_imported += len(hubspot_quotes)
                
                # Add Google Drive quote if available
                drive_quote_url = props.get("archivo_en_drive_de_la_cotizacion")
                if drive_quote_url:
                    hubspot_quotes.append({
                        "title": "Cotización (Google Drive)",
                        "url": drive_quote_url,
                        "source": "google_drive"
                    })
                
                # Get associated contacts with labels
                contact_associations = await get_deal_associated_contacts(hubspot_deal_id)
                contact_internal_ids = []
                
                # Process each associated contact
                for contact_assoc in contact_associations:
                    contact_hs_id = contact_assoc["hubspot_id"]
                    contact_labels = contact_assoc["labels"]
                    
                    # Map HubSpot labels to internal roles
                    roles_from_labels = []
                    for label in contact_labels:
                        if label in HUBSPOT_LABEL_TO_ROLE:
                            role = HUBSPOT_LABEL_TO_ROLE[label]
                            if role not in roles_from_labels:
                                roles_from_labels.append(role)
                    
                    contacts = await get_hubspot_contacts_batch([contact_hs_id])
                    if not contacts:
                        continue
                    
                    contact = contacts[0]
                    c_props = contact.get("properties", {})
                    email = (c_props.get("email") or "").strip().lower()
                    
                    if not email:
                        continue
                    
                    existing_contact = await db.unified_contacts.find_one({"email": email})
                    
                    firstname = (c_props.get("firstname") or "").strip()
                    lastname = (c_props.get("lastname") or "").strip()
                    job_title = (c_props.get("jobtitle") or "").strip()
                    buyer_persona = await classify_buyer_persona_by_job_title(job_title)
                    
                    case_entry = {
                        "case_id": existing_case.get("id") if existing_case else str(uuid.uuid4()),
                        "case_name": case_name,
                        "hubspot_deal_id": hubspot_deal_id,
                        "stage": case_stage,
                        "labels": contact_labels,  # Store original HubSpot labels
                        "added_at": now
                    }
                    
                    if existing_contact:
                        current_stage = existing_contact.get("stage", 1)
                        new_stage = 3 if current_stage in [1, 2, 3] else current_stage
                        
                        case_history = existing_contact.get("case_history", [])
                        if not any(ch.get("hubspot_deal_id") == hubspot_deal_id for ch in case_history):
                            case_history.append(case_entry)
                        
                        # Merge roles: existing + new from labels (no duplicates)
                        existing_roles = existing_contact.get("roles") or existing_contact.get("contact_types") or []
                        merged_roles = list(existing_roles)
                        for role in roles_from_labels:
                            if role not in merged_roles:
                                merged_roles.append(role)
                        
                        # Use first company if contact doesn't have one
                        update_company_id = existing_contact.get("company_id") or (company_ids[0] if company_ids else None)
                        update_company_name = existing_contact.get("company") or (company_names[0] if company_names else None)
                        
                        await db.unified_contacts.update_one(
                            {"id": existing_contact["id"]},
                            {"$set": {
                                "stage": new_stage,
                                "case_history": case_history,
                                "roles": merged_roles,
                                "contact_types": merged_roles,
                                "company": update_company_name,
                                "company_id": update_company_id,
                                "updated_at": now
                            }}
                        )
                        contact_internal_ids.append(existing_contact["id"])
                        contacts_updated += 1
                    else:
                        phone = (c_props.get("phone") or c_props.get("mobilephone") or "").strip()
                        new_contact_id = str(uuid.uuid4())
                        
                        new_contact = {
                            "id": new_contact_id,
                            "hubspot_id": contact_hs_id,
                            "name": f"{firstname} {lastname}".strip() or "Sin nombre",
                            "first_name": firstname,
                            "last_name": lastname,
                            "email": email,
                            "phone": phone,
                            "company": company_names[0] if company_names else None,
                            "company_id": company_ids[0] if company_ids else None,
                            "job_title": job_title,
                            "buyer_persona": buyer_persona,
                            "roles": roles_from_labels,
                            "contact_types": roles_from_labels,
                            "stage": 3,
                            "status": "active",
                            "source": "hubspot_deal",
                            "case_history": [case_entry],
                            "created_at": now,
                            "updated_at": now
                        }
                        
                        try:
                            await db.unified_contacts.insert_one(new_contact)
                            contact_internal_ids.append(new_contact_id)
                            contacts_updated += 1
                        except Exception as e:
                            if "duplicate key" in str(e).lower():
                                existing = await db.unified_contacts.find_one({"email": email})
                                if existing:
                                    contact_internal_ids.append(existing["id"])
                            else:
                                logger.error(f"Error creating contact: {e}")
                
                # Parse amount
                amount = None
                if props.get("amount"):
                    try:
                        amount = float(props.get("amount"))
                    except (ValueError, TypeError):
                        pass
                
                # Parse services (dropdown multiple - semicolon separated)
                services = []
                if props.get("servicio_cotizado"):
                    services = [s.strip() for s in props.get("servicio_cotizado").split(";") if s.strip()]
                
                # Build case document with all properties
                case_data = {
                    "hubspot_deal_id": hubspot_deal_id,
                    "hubspot_deal_url": f"https://app.hubspot.com/contacts/deals/{hubspot_deal_id}",
                    "name": case_name,
                    "anonymous_name": props.get("nombre_anonimo_del_caso_de_este_proyecto_clonada"),
                    "amount": amount,
                    "currency": "MXN",
                    "stage": case_stage,
                    "status": case_status,
                    # Companies (all associated)
                    "company_ids": company_ids,
                    "company_names": company_names,
                    # Contacts
                    "contact_ids": contact_internal_ids,
                    # Quotes (HubSpot native + Google Drive)
                    "quotes": hubspot_quotes,
                    # Services
                    "services": services,
                    # Drive links
                    "slides_url": props.get("slides"),
                    "report_url": props.get("archivo_de_reporte_de_este_proyecto_"),
                    "case_drive_url": props.get("link_del_caso_en_google_drive"),
                    # Transcriptions
                    "alignment_calls_transcription": props.get("transcripcion_de_todas_las_llamadas_de_alineacion"),
                    "students_transcription": props.get("todas_las_transcripciones_de_alumnos"),
                    # Objectives
                    "objective_business_results": props.get("cual_es_el_objetivo_a_nivel__resultado_de_negocios__"),
                    "objective_behavior_change": props.get("cual_es_el_objetivo_a_nivel__cambio_de_comportamiento__"),
                    "objective_learning": props.get("cual_es_el_objetivo_a_nivel__aprendizaje__"),
                    "objective_experience": props.get("cual_es_el_objetivo_a_nivel__experiencia__"),
                    # Metadata
                    "notes": props.get("description", ""),
                    "hubspot_close_date": props.get("closedate"),
                    "hubspot_created_at": props.get("createdate"),
                    "updated_at": now
                }
                
                if existing_case:
                    await db.cases.update_one(
                        {"hubspot_deal_id": hubspot_deal_id},
                        {"$set": case_data}
                    )
                    updated += 1
                else:
                    case_data["id"] = str(uuid.uuid4())
                    case_data["imported_at"] = now
                    case_data["created_at"] = now
                    await db.cases.insert_one(case_data)
                    created += 1
                
            except Exception as e:
                logger.error(f"Error processing deal {hubspot_deal_id}: {e}")
                errors += 1
            
            # Update progress
            processed = idx + 1
            percent = int(20 + (processed / total_deals * 75))
            cases_import_progress[import_id].update({
                "phase": f"Procesando: {processed}/{total_deals}",
                "processed": processed,
                "percent": percent,
                "created": created,
                "updated": updated,
                "contacts_updated": contacts_updated,
                "companies_imported": companies_imported,
                "quotes_imported": quotes_imported,
                "errors": errors
            })
        
        # Complete
        cases_import_progress[import_id] = {
            "status": "complete",
            "phase": "¡Importación completada!",
            "percent": 100,
            "total": total_deals,
            "processed": total_deals,
            "created": created,
            "updated": updated,
            "contacts_updated": contacts_updated,
            "companies_imported": companies_imported,
            "quotes_imported": quotes_imported,
            "errors": errors
        }
        
        logger.info(f"Cases import complete: {created} created, {updated} updated, {contacts_updated} contacts, {companies_imported} companies, {quotes_imported} quotes")
        
    except Exception as e:
        logger.error(f"Error in cases import: {e}")
        cases_import_progress[import_id] = {
            "status": "error",
            "error": str(e),
            "phase": "Error en importación"
        }


# ============ ROUTES ============

@router.get("/search")
async def search_cases_simple(
    q: str = Query(..., min_length=2, description="Search query"),
    limit: int = Query(10, ge=1, le=50),
    current_user: dict = Depends(get_current_user)
):
    """
    Simple search endpoint for case autocomplete.
    Searches by name, company_names, stage.
    """
    import re
    safe_query = re.escape(q)
    
    cases = await db.cases.find(
        {"$or": [
            {"name": {"$regex": safe_query, "$options": "i"}},
            {"company_names": {"$regex": safe_query, "$options": "i"}},
        ]},
        {"_id": 0, "id": 1, "name": 1, "stage": 1, "status": 1, "company_names": 1, "amount": 1, "delivery_stage": 1}
    ).limit(limit).to_list(limit)
    
    return {"cases": cases, "total": len(cases)}


@router.get("/by-contact/{contact_id}")
async def get_cases_by_contact(
    contact_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get all cases where a contact is associated, including case-level roles"""
    cases = await db.cases.find(
        {"contact_ids": contact_id},
        {"_id": 0, "id": 1, "name": 1, "stage": 1, "status": 1, "company_names": 1, "created_at": 1, "hubspot_deal_id": 1, "delivery_stage": 1}
    ).sort("created_at", -1).to_list(100)
    
    if not cases:
        return cases
    
    # Get case IDs for batch query
    case_ids = [c["id"] for c in cases]
    
    # Query case_contact_roles for this contact across all their cases
    role_docs = await db.case_contact_roles.find(
        {"contact_id": contact_id, "case_id": {"$in": case_ids}},
        {"_id": 0, "case_id": 1, "role": 1}
    ).to_list(500)
    
    # Build a map of case_id -> [roles]
    roles_by_case = {}
    for doc in role_docs:
        case_id = doc.get("case_id")
        role = doc.get("role")
        if case_id and role:
            if case_id not in roles_by_case:
                roles_by_case[case_id] = []
            if role not in roles_by_case[case_id]:
                roles_by_case[case_id].append(role)
    
    # Attach case_roles to each case
    for case in cases:
        case["case_roles"] = roles_by_case.get(case["id"], [])
    
    return cases


@router.get("/")
async def get_cases(
    stage: Optional[str] = None,
    status: Optional[str] = None,
    search: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Get all cases with optional filters (excludes cases in Stage 4/Delivery)"""
    # Base query: only Stage 3 cases (exclude Stage 4/Delivery)
    query = {"stage": {"$in": STAGE_3_VALUES}}
    
    if stage:
        query["stage"] = stage
    if status:
        query["status"] = status
    
    # Search filter
    if search:
        search_regex = {"$regex": search, "$options": "i"}
        # Need to use $and to combine with base query
        query = {
            "$and": [
                {"stage": {"$in": STAGE_3_VALUES}},
                {"$or": [
                    {"name": search_regex},
                    {"company_names": search_regex},
                    {"hubspot_deal_id": search_regex}
                ]}
            ]
        }
        if stage:
            query["$and"].append({"stage": stage})
        if status:
            query["$and"].append({"status": status})
    
    cases = await db.cases.find(query, {"_id": 0}).sort("created_at", -1).to_list(500)
    
    # Get stats (only for Stage 3 cases)
    stage3_filter = {"stage": {"$in": STAGE_3_VALUES}}
    total = await db.cases.count_documents(stage3_filter)
    caso_solicitado = await db.cases.count_documents({**stage3_filter, "stage": "caso_solicitado", "status": "active"})
    caso_presentado = await db.cases.count_documents({**stage3_filter, "stage": "caso_presentado", "status": "active"})
    interes_en_caso = await db.cases.count_documents({**stage3_filter, "stage": "interes_en_caso", "status": "active"})
    cierre_administrativo = await db.cases.count_documents({**stage3_filter, "stage": "cierre_administrativo", "status": "active"})
    descartado = await db.cases.count_documents({**stage3_filter, "status": "descartado"})
    
    return {
        "cases": cases,
        "stats": {
            "total": total,
            "caso_solicitado": caso_solicitado,
            "caso_presentado": caso_presentado,
            "interes_en_caso": interes_en_caso,
            "cierre_administrativo": cierre_administrativo,
            "descartado": descartado
        }
    }


@router.get("/{case_id}")
async def get_case(
    case_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get a single case with its contacts and companies"""
    case = await db.cases.find_one({"id": case_id}, {"_id": 0})
    if not case:
        raise HTTPException(status_code=404, detail="Caso no encontrado")
    
    # Get associated contacts
    contacts = []
    if case.get("contact_ids"):
        contacts = await db.unified_contacts.find(
            {"id": {"$in": case["contact_ids"]}},
            {"_id": 0, "id": 1, "name": 1, "email": 1, "phone": 1, "company": 1, "job_title": 1, "buyer_persona": 1}
        ).to_list(None)
    
    # Get associated companies from unified_companies (single source)
    companies = []
    
    # Method 1: If we have company_ids, look them up
    if case.get("company_ids"):
        companies = await db.unified_companies.find(
            {"$or": [
                {"id": {"$in": case["company_ids"]}},
                {"hubspot_id": {"$in": case["company_ids"]}},
                {"hs_object_id": {"$in": case["company_ids"]}}
            ], "is_merged": {"$ne": True}},
            {"_id": 0, "id": 1, "hubspot_id": 1, "name": 1, "domain": 1, "industry": 1, "phone": 1, "city": 1, "country": 1}
        ).to_list(None)
    
    # Method 2: If no companies found and we have company_names, look up by name
    if not companies and case.get("company_names"):
        for company_name in case["company_names"]:
            if not company_name:
                continue
            company = await db.unified_companies.find_one(
                {"name": {"$regex": f"^{re.escape(company_name)}$", "$options": "i"}, "is_merged": {"$ne": True}},
                {"_id": 0, "id": 1, "hubspot_id": 1, "name": 1, "domain": 1, "industry": 1, "phone": 1, "city": 1, "country": 1}
            )
            if not company:
                # Create a minimal company record from the name
                company = {"id": None, "name": company_name}
            if company:
                companies.append(company)
    
    # Method 3: If still no companies, try to get from contacts
    if not companies and contacts:
        contact_companies = set()
        for contact in contacts:
            if contact.get("company"):
                contact_companies.add(contact["company"])
        for company_name in contact_companies:
            company = await db.unified_companies.find_one(
                {"name": {"$regex": f"^{re.escape(company_name)}$", "$options": "i"}, "is_merged": {"$ne": True}},
                {"_id": 0, "id": 1, "hubspot_id": 1, "name": 1, "domain": 1, "industry": 1, "phone": 1, "city": 1, "country": 1}
            )
            if not company:
                company = {"id": None, "name": company_name}
            if company:
                companies.append(company)
    
    case["contacts"] = contacts
    case["companies"] = companies
    return case


@router.post("/")
async def create_case(
    data: CreateCaseRequest,
    current_user: dict = Depends(get_current_user)
):
    """Create a case manually"""
    now = datetime.now(timezone.utc).isoformat()
    
    case = {
        "id": str(uuid.uuid4()),
        "name": data.name,
        "company_names": [data.company_name] if data.company_name else [],
        "company_ids": [],
        "amount": data.amount,
        "currency": data.currency,
        "stage": data.stage,
        "status": data.status,
        "quotes": [],
        "contact_ids": data.contact_ids or [],
        "notes": data.notes,
        "created_at": now,
        "updated_at": now
    }
    
    await db.cases.insert_one(case)
    case.pop("_id", None)
    
    return case


@router.patch("/{case_id}")
async def update_case(
    case_id: str,
    data: UpdateCaseRequest,
    current_user: dict = Depends(get_current_user)
):
    """Update a case"""
    case = await db.cases.find_one({"id": case_id})
    if not case:
        raise HTTPException(status_code=404, detail="Caso no encontrado")
    
    # Validate stage transition if stage is being changed
    if data.stage is not None and data.stage != case.get("stage"):
        current_stage = case.get("stage", "")
        is_valid, error_msg = validate_stage_transition(current_stage, data.stage)
        if not is_valid:
            raise HTTPException(status_code=400, detail=error_msg)
    
    update_data = {k: v for k, v in data.dict().items() if v is not None}
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    # If marking as descartado, record the timestamp
    if data.status == "descartado":
        update_data["discarded_at"] = datetime.now(timezone.utc).isoformat()
    
    await db.cases.update_one({"id": case_id}, {"$set": update_data})
    
    # NOTE: Automatic Stage 4 → Outbound classification was REMOVED per design decision.
    # Company classification is now ONLY set via:
    # 1. Manual edit in Company Editor
    # 2. Inheritance from Industry classification
    # 3. Propagation from Industry → Company
    
    updated = await db.cases.find_one({"id": case_id}, {"_id": 0})
    return updated


@router.post("/{case_id}/quotes")
async def add_quote_to_case(
    case_id: str,
    data: AddQuoteRequest,
    current_user: dict = Depends(get_current_user)
):
    """Add a manual quote to a case"""
    case = await db.cases.find_one({"id": case_id})
    if not case:
        raise HTTPException(status_code=404, detail="Caso no encontrado")
    
    new_quote = {
        "id": str(uuid.uuid4()),
        "title": data.title,
        "url": data.url,
        "source": data.source,
        "added_at": datetime.now(timezone.utc).isoformat()
    }
    
    quotes = case.get("quotes", [])
    quotes.append(new_quote)
    
    await db.cases.update_one(
        {"id": case_id},
        {"$set": {
            "quotes": quotes,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    return {"success": True, "quote": new_quote}


@router.delete("/{case_id}/quotes/{quote_id}")
async def remove_quote_from_case(
    case_id: str,
    quote_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Remove a quote from a case"""
    case = await db.cases.find_one({"id": case_id})
    if not case:
        raise HTTPException(status_code=404, detail="Caso no encontrado")
    
    quotes = case.get("quotes", [])
    quotes = [q for q in quotes if q.get("id") != quote_id and q.get("hubspot_quote_id") != quote_id]
    
    await db.cases.update_one(
        {"id": case_id},
        {"$set": {
            "quotes": quotes,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    return {"success": True, "message": "Cotización eliminada"}


@router.patch("/{case_id}/discard")
async def discard_case(
    case_id: str,
    discard_reason: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Mark a case as descartado"""
    case = await db.cases.find_one({"id": case_id})
    if not case:
        raise HTTPException(status_code=404, detail="Caso no encontrado")
    
    await db.cases.update_one(
        {"id": case_id},
        {"$set": {
            "status": "descartado",
            "discard_reason": discard_reason,
            "discarded_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    return {"success": True, "message": "Caso marcado como descartado"}


@router.patch("/{case_id}/reactivate")
async def reactivate_case(
    case_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Reactivate a discarded case"""
    case = await db.cases.find_one({"id": case_id})
    if not case:
        raise HTTPException(status_code=404, detail="Caso no encontrado")
    
    await db.cases.update_one(
        {"id": case_id},
        {"$set": {
            "status": "active",
            "updated_at": datetime.now(timezone.utc).isoformat()
        },
        "$unset": {
            "discard_reason": "",
            "discarded_at": ""
        }}
    )
    
    return {"success": True, "message": "Caso reactivado"}


@router.delete("/{case_id}")
async def delete_case(
    case_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Delete a case"""
    result = await db.cases.delete_one({"id": case_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Caso no encontrado")
    
    return {"success": True, "message": "Caso eliminado"}


class AddContactToCaseRequest(BaseModel):
    contact_id: str
    role: str = "Deal Maker"


@router.post("/{case_id}/add-contact")
async def add_contact_to_case(
    case_id: str,
    request: AddContactToCaseRequest,
    current_user: dict = Depends(get_current_user)
):
    """Add a contact to a case with a specific role"""
    # Find the case
    case = await db.cases.find_one({"id": case_id})
    if not case:
        raise HTTPException(status_code=404, detail="Caso no encontrado")
    
    # Check if contact exists
    contact = await db.unified_contacts.find_one({"id": request.contact_id})
    if not contact:
        raise HTTPException(status_code=404, detail="Contacto no encontrado")
    
    contact_ids = case.get("contact_ids", [])
    
    # Add contact to case if not already there
    if request.contact_id not in contact_ids:
        contact_ids.append(request.contact_id)
        await db.cases.update_one(
            {"id": case_id},
            {"$set": {
                "contact_ids": contact_ids,
                "updated_at": datetime.now(timezone.utc).isoformat()
            }}
        )
    
    # Update contact's roles to include the case role
    contact_roles = contact.get("roles", [])
    # Map common role names to internal format
    role_mapping = {
        "Deal Maker": "deal_maker",
        "Champion": "champion",
        "Alumno": "student",
        "Coachee": "coachee",
        "Alumni": "alumni"
    }
    internal_role = role_mapping.get(request.role, request.role.lower().replace(" ", "_"))
    
    if internal_role and internal_role not in contact_roles:
        contact_roles.append(internal_role)
        await db.unified_contacts.update_one(
            {"id": request.contact_id},
            {"$set": {
                "roles": contact_roles,
                "updated_at": datetime.now(timezone.utc).isoformat()
            }}
        )
    
    # Also track the case-contact association with role
    await db.case_contact_roles.update_one(
        {"case_id": case_id, "contact_id": request.contact_id},
        {"$set": {
            "case_id": case_id,
            "contact_id": request.contact_id,
            "role": internal_role,
            "added_by": current_user.get("email", "unknown"),
            "added_at": datetime.now(timezone.utc).isoformat()
        }},
        upsert=True
    )
    
    return {
        "success": True, 
        "message": f"Contacto agregado al caso con rol: {request.role}"
    }


@router.delete("/{case_id}/remove-contact/{contact_id}")
async def remove_contact_from_case(
    case_id: str,
    contact_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Remove a contact from a case"""
    # Find the case
    case = await db.cases.find_one({"id": case_id})
    if not case:
        raise HTTPException(status_code=404, detail="Caso no encontrado")
    
    contact_ids = case.get("contact_ids", [])
    
    # Remove contact from case if it's there
    if contact_id in contact_ids:
        contact_ids.remove(contact_id)
        await db.cases.update_one(
            {"id": case_id},
            {"$set": {
                "contact_ids": contact_ids,
                "updated_at": datetime.now(timezone.utc).isoformat()
            }}
        )
    
    # Remove the case-contact role association
    await db.case_contact_roles.delete_one({
        "case_id": case_id,
        "contact_id": contact_id
    })
    
    return {
        "success": True, 
        "message": "Contacto eliminado del caso"
    }


# ============ IMPORT ROUTES ============

@router.post("/import-hubspot")
async def import_cases_from_hubspot(
    data: ImportCasesRequest,
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(get_current_user)
):
    """Start importing deals from HubSpot list"""
    import_id = str(uuid.uuid4())
    
    # Start background task
    background_tasks.add_task(
        import_hubspot_deals_with_progress,
        import_id,
        data.hubspot_list_url,
        data.case_stage,
        data.case_status
    )
    
    return {
        "status": "started",
        "import_id": import_id,
        "message": "Importación iniciada"
    }


@router.get("/import-progress/{import_id}")
async def get_import_progress(
    import_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get progress of a HubSpot import"""
    progress = cases_import_progress.get(import_id)
    if not progress:
        return {
            "status": "not_found",
            "message": "Importación no encontrada"
        }
    
    return progress


# ============ DELIVERY / GANADOS CASES ============

@router.get("/delivery/ganados")
async def get_ganados_cases(
    current_user: dict = Depends(get_current_user)
):
    """
    Get all cases in stage 'ganados' with status 'active' for delivery follow-up.
    Includes contacts with their roles and checklist data.
    """
    from datetime import datetime, timezone, timedelta
    
    # Fetch cases
    cases_cursor = db.cases.find(
        {"stage": "ganados", "status": "active"},
        {"_id": 0}
    ).sort("name", 1)
    
    cases = await cases_cursor.to_list(500)
    
    # Get current ISO week for status calculation
    now = datetime.now(timezone.utc)
    iso_year, iso_week, _ = now.isocalendar()
    week_start = datetime.fromisocalendar(iso_year, iso_week, 1).replace(tzinfo=timezone.utc)
    week_end = week_start + timedelta(days=7)
    
    result_cases = []
    
    for case in cases:
        case_id = case.get("id")
        
        # Get contacts for this case
        contact_ids = case.get("contact_ids", [])
        contacts = []
        
        if contact_ids:
            contacts_cursor = db.unified_contacts.find(
                {"id": {"$in": contact_ids}},
                {"_id": 0, "id": 1, "name": 1, "first_name": 1, "last_name": 1, 
                 "email": 1, "phone": 1, "company": 1}
            )
            contacts = await contacts_cursor.to_list(500)
        
        # Get case-level roles for contacts (CRITICAL: Use case_contact_roles, not global roles)
        case_roles_cursor = db.case_contact_roles.find(
            {"case_id": case_id},
            {"_id": 0, "contact_id": 1, "role": 1}
        )
        case_roles_list = await case_roles_cursor.to_list(1000)
        
        # Build contact roles map at case level
        contact_case_roles = {}
        for cr in case_roles_list:
            cid = cr.get("contact_id")
            role = cr.get("role")
            if cid not in contact_case_roles:
                contact_case_roles[cid] = []
            if role and role not in contact_case_roles[cid]:
                contact_case_roles[cid].append(role)
        
        # Add case-level roles to contacts
        for contact in contacts:
            contact["case_roles"] = contact_case_roles.get(contact["id"], [])
        
        # Get checklist data (DO NOT auto-create)
        checklist_data = await db.case_checklists.find_one(
            {"case_id": case_id},
            {"_id": 0}
        )
        
        checklist = checklist_data.get("groups", {}) if checklist_data else {}
        
        # Calculate weekly status
        weekly_status = calculate_case_weekly_status(case_id, checklist, contacts, week_start, week_end)
        
        result_cases.append({
            **case,
            "contacts": contacts,
            "checklist": checklist,
            "weekly_status": weekly_status
        })
    
    return {"cases": result_cases}


def calculate_case_weekly_status(case_id: str, checklist: dict, contacts: list, week_start, week_end) -> str:
    """
    Calculate weekly indicator status for a case (project).
    
    CRITICAL: Gray is NOT allowed for the current week.
    
    Definition of "pending task": unchecked AND due_date <= today (date-only comparison)
    
    Rules:
    1. First determine if project has any PENDING tasks
    2. If NO pending tasks → GREEN (no work to do)
       - This includes: no tasks exist, all checked, or unchecked but due in future
    3. If pending tasks exist:
       - YELLOW if at least one checkbox was checked this ISO week
       - RED if no checkbox was checked this ISO week
    
    IMPORTANT: A task only exists if there's an active column. 
    We count tasks only for contacts that are in the case's contact list.
    """
    # Get today at start of day for due date comparison
    now = datetime.now(timezone.utc)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    
    # Get contact IDs for this case
    contact_ids_set = set(c.get("id") for c in contacts if c.get("id"))
    
    has_pending_tasks = False
    has_activity_this_week = False
    
    for group_id, group_data in checklist.items():
        columns = group_data.get("columns", [])
        cells = group_data.get("cells", {})
        
        # Filter out deleted columns - only active columns count
        active_columns = [col for col in columns if not col.get("deleted")]
        
        # No active columns = no tasks for this group
        if not active_columns:
            continue
        
        for col in active_columns:
            col_id = col.get("id")
            col_due_date = col.get("due_date")
            
            # Parse due date
            due_dt = None
            if col_due_date:
                try:
                    due_dt = datetime.fromisoformat(col_due_date.replace("Z", "+00:00"))
                except (ValueError, TypeError):
                    pass
            
            # Only check cells for contacts that are actually in this case
            for contact_id in contact_ids_set:
                contact_cells = cells.get(contact_id, {})
                cell = contact_cells.get(col_id)
                
                # If no cell exists for this contact+column, it means the task hasn't been interacted with
                # This counts as an unchecked task
                if cell is None:
                    # Check if this is a PENDING task (unchecked AND due today or earlier)
                    if due_dt and due_dt <= today_start:
                        has_pending_tasks = True
                elif cell.get("checked"):
                    # Check if checked this ISO week
                    checked_at = cell.get("checked_at")
                    if checked_at:
                        try:
                            checked_dt = datetime.fromisoformat(checked_at.replace("Z", "+00:00"))
                            if week_start <= checked_dt < week_end:
                                has_activity_this_week = True
                        except (ValueError, TypeError):
                            pass
                else:
                    # Cell exists but is unchecked
                    # Check if PENDING (due today or earlier)
                    if due_dt and due_dt <= today_start:
                        has_pending_tasks = True
    
    # Determine project status
    # Rule: If no pending tasks → GREEN (regardless of activity)
    if not has_pending_tasks:
        # No pending work → GREEN
        # This covers: no tasks, all checked, or unchecked but due in future
        return "green"
    
    # There are pending tasks - now check activity
    if has_activity_this_week:
        # Pending work exists and team started this week → YELLOW
        return "yellow"
    
    # Pending work exists and no activity this week → RED
    return "red"


class CreateColumnRequest(BaseModel):
    """Request to create a checklist column"""
    group_id: str
    title: str
    due_date: str


class UpdateCellRequest(BaseModel):
    """Request to update a checklist cell"""
    group_id: str
    contact_id: str
    column_id: str
    checked: bool
    custom_due_date: Optional[str] = None


@router.post("/{case_id}/checklist/columns")
async def create_checklist_column(
    case_id: str,
    request: CreateColumnRequest,
    current_user: dict = Depends(get_current_user)
):
    """Create a new checklist column (task) for a case/group"""
    from datetime import datetime, timezone
    
    now = datetime.now(timezone.utc).isoformat()
    column_id = str(uuid.uuid4())
    
    # Get or create checklist document (NO auto-initialization of columns)
    checklist = await db.case_checklists.find_one({"case_id": case_id})
    
    if not checklist:
        checklist = {
            "case_id": case_id,
            "groups": {},
            "created_at": now,
            "updated_at": now
        }
    
    # Initialize group if not exists
    if request.group_id not in checklist.get("groups", {}):
        checklist.setdefault("groups", {})[request.group_id] = {
            "columns": [],
            "cells": {},
            "templates": {}
        }
    
    # Add column
    new_column = {
        "id": column_id,
        "title": request.title,
        "due_date": request.due_date,
        "order": len(checklist["groups"][request.group_id].get("columns", [])),
        "created_at": now
    }
    
    checklist["groups"][request.group_id].setdefault("columns", []).append(new_column)
    checklist["updated_at"] = now
    
    # Get contacts that belong to this group (by case-level roles)
    case = await db.cases.find_one({"id": case_id}, {"_id": 0, "contact_ids": 1})
    contact_ids = case.get("contact_ids", []) if case else []
    
    # Get case-level roles
    case_roles_cursor = db.case_contact_roles.find(
        {"case_id": case_id, "contact_id": {"$in": contact_ids}},
        {"_id": 0, "contact_id": 1, "role": 1}
    )
    case_roles = await case_roles_cursor.to_list(1000)
    
    # Build map of contact -> roles
    contact_roles_map = {}
    for cr in case_roles:
        cid = cr.get("contact_id")
        role = cr.get("role", "").lower()
        if cid not in contact_roles_map:
            contact_roles_map[cid] = []
        contact_roles_map[cid].append(role)
    
    # Role group mappings (must match frontend)
    ROLE_GROUPS = {
        "deal_makers_team": ["deal_maker", "influencer", "champion", "sponsor", "asistente_deal_maker", "procurement", "staff"],
        "coachees": ["coachee"],
        "students": ["student"],
        "advisors_speakers": ["advisor", "speaker", "speakers", "evaluador_360"],
        "others": []  # Catch-all
    }
    
    # Determine which contacts belong to this group
    target_roles = ROLE_GROUPS.get(request.group_id, [])
    
    contacts_in_group = []
    for contact_id in contact_ids:
        contact_case_roles = contact_roles_map.get(contact_id, [])
        
        if request.group_id == "others":
            # "Others" = contacts with no role or role not in any group
            all_known_roles = set()
            for roles in ROLE_GROUPS.values():
                all_known_roles.update(roles)
            
            if not contact_case_roles or not any(r in all_known_roles for r in contact_case_roles):
                contacts_in_group.append(contact_id)
        else:
            # Check if contact has any of the target roles
            if any(r in target_roles for r in contact_case_roles):
                contacts_in_group.append(contact_id)
    
    # Initialize cells ONLY for contacts in the target group
    for contact_id in contacts_in_group:
        checklist["groups"][request.group_id].setdefault("cells", {}).setdefault(contact_id, {})[column_id] = {
            "checked": False,
            "due_date": request.due_date,
            "custom_due_date": None,
            "checked_at": None
        }
    
    # Save
    await db.case_checklists.update_one(
        {"case_id": case_id},
        {"$set": checklist},
        upsert=True
    )
    
    # Audit log
    await db.audit_logs.insert_one({
        "id": str(uuid.uuid4()),
        "action": "checklist_column_created",
        "case_id": case_id,
        "group_id": request.group_id,
        "column_id": column_id,
        "column_title": request.title,
        "due_date": request.due_date,
        "user_id": current_user.get("id"),
        "user_email": current_user.get("email"),
        "created_at": now
    })
    
    return {"success": True, "column_id": column_id}


@router.patch("/{case_id}/checklist/cell")
async def update_checklist_cell(
    case_id: str,
    request: UpdateCellRequest,
    current_user: dict = Depends(get_current_user)
):
    """Update a checklist cell (check/uncheck a task for a contact)"""
    from datetime import datetime, timezone
    
    now = datetime.now(timezone.utc).isoformat()
    
    # Get checklist
    checklist = await db.case_checklists.find_one({"case_id": case_id})
    
    if not checklist:
        raise HTTPException(status_code=404, detail="Checklist no encontrado")
    
    group = checklist.get("groups", {}).get(request.group_id)
    if not group:
        raise HTTPException(status_code=404, detail="Grupo no encontrado")
    
    # Get current cell state
    cells = group.setdefault("cells", {})
    contact_cells = cells.setdefault(request.contact_id, {})
    current_cell = contact_cells.get(request.column_id, {})
    was_checked = current_cell.get("checked", False)
    
    # Update cell
    new_cell = {
        **current_cell,
        "checked": request.checked,
        "checked_at": now if request.checked and not was_checked else current_cell.get("checked_at"),
        "updated_at": now
    }
    
    if request.custom_due_date:
        new_cell["custom_due_date"] = request.custom_due_date
    
    contact_cells[request.column_id] = new_cell
    checklist["updated_at"] = now
    
    # Save
    await db.case_checklists.update_one(
        {"case_id": case_id},
        {"$set": checklist}
    )
    
    # Audit log
    await db.audit_logs.insert_one({
        "id": str(uuid.uuid4()),
        "action": "checklist_cell_updated",
        "case_id": case_id,
        "group_id": request.group_id,
        "contact_id": request.contact_id,
        "column_id": request.column_id,
        "checked": request.checked,
        "was_checked": was_checked,
        "user_id": current_user.get("id"),
        "user_email": current_user.get("email"),
        "created_at": now
    })
    
    return {"success": True}


class UpdateColumnRequest(BaseModel):
    """Request to update a checklist column"""
    group_id: str
    column_id: str
    title: Optional[str] = None
    due_date: Optional[str] = None
    order: Optional[int] = None


@router.patch("/{case_id}/checklist/columns")
async def update_checklist_column(
    case_id: str,
    request: UpdateColumnRequest,
    current_user: dict = Depends(get_current_user)
):
    """Update a checklist column (title, due_date, order)"""
    from datetime import datetime, timezone
    
    now = datetime.now(timezone.utc).isoformat()
    
    checklist = await db.case_checklists.find_one({"case_id": case_id})
    if not checklist:
        raise HTTPException(status_code=404, detail="Checklist no encontrado")
    
    group = checklist.get("groups", {}).get(request.group_id)
    if not group:
        raise HTTPException(status_code=404, detail="Grupo no encontrado")
    
    columns = group.get("columns", [])
    column_idx = next((i for i, c in enumerate(columns) if c["id"] == request.column_id), None)
    
    if column_idx is None:
        raise HTTPException(status_code=404, detail="Columna no encontrada")
    
    old_column = columns[column_idx].copy()
    
    # Update column properties
    if request.title is not None:
        columns[column_idx]["title"] = request.title
    
    if request.due_date is not None:
        columns[column_idx]["due_date"] = request.due_date
        
        # Update cells that don't have custom due dates
        cells = group.get("cells", {})
        for contact_id, contact_cells in cells.items():
            cell = contact_cells.get(request.column_id)
            if cell and not cell.get("custom_due_date"):
                cell["due_date"] = request.due_date
    
    if request.order is not None and request.order != column_idx:
        # Reorder
        col = columns.pop(column_idx)
        columns.insert(request.order, col)
        # Update order values
        for i, c in enumerate(columns):
            c["order"] = i
    
    columns[column_idx if request.order is None else request.order]["updated_at"] = now
    checklist["updated_at"] = now
    
    await db.case_checklists.update_one(
        {"case_id": case_id},
        {"$set": checklist}
    )
    
    # Audit log
    await db.audit_logs.insert_one({
        "id": str(uuid.uuid4()),
        "action": "checklist_column_updated",
        "case_id": case_id,
        "group_id": request.group_id,
        "column_id": request.column_id,
        "changes": {
            "title": {"old": old_column.get("title"), "new": request.title} if request.title else None,
            "due_date": {"old": old_column.get("due_date"), "new": request.due_date} if request.due_date else None,
            "order": {"old": column_idx, "new": request.order} if request.order is not None else None
        },
        "user_id": current_user.get("id"),
        "user_email": current_user.get("email"),
        "created_at": now
    })
    
    return {"success": True}


class DeleteColumnRequest(BaseModel):
    """Request to delete a checklist column"""
    group_id: str
    column_id: str


@router.delete("/{case_id}/checklist/columns")
async def delete_checklist_column(
    case_id: str,
    request: DeleteColumnRequest,
    current_user: dict = Depends(get_current_user)
):
    """Soft delete a checklist column (marks as deleted, preserves history)"""
    from datetime import datetime, timezone
    
    now = datetime.now(timezone.utc).isoformat()
    
    checklist = await db.case_checklists.find_one({"case_id": case_id})
    if not checklist:
        raise HTTPException(status_code=404, detail="Checklist no encontrado")
    
    group = checklist.get("groups", {}).get(request.group_id)
    if not group:
        raise HTTPException(status_code=404, detail="Grupo no encontrado")
    
    columns = group.get("columns", [])
    column_idx = next((i for i, c in enumerate(columns) if c["id"] == request.column_id), None)
    
    if column_idx is None:
        raise HTTPException(status_code=404, detail="Columna no encontrada")
    
    # Soft delete - mark as deleted but preserve data
    deleted_column = columns[column_idx]
    deleted_column["deleted"] = True
    deleted_column["deleted_at"] = now
    deleted_column["deleted_by"] = current_user.get("email")
    
    checklist["updated_at"] = now
    
    await db.case_checklists.update_one(
        {"case_id": case_id},
        {"$set": checklist}
    )
    
    # Audit log
    await db.audit_logs.insert_one({
        "id": str(uuid.uuid4()),
        "action": "checklist_column_deleted",
        "case_id": case_id,
        "group_id": request.group_id,
        "column_id": request.column_id,
        "column_title": deleted_column.get("title"),
        "user_id": current_user.get("id"),
        "user_email": current_user.get("email"),
        "created_at": now
    })
    
    return {"success": True, "message": "Columna eliminada"}


class MoveColumnRequest(BaseModel):
    """Request to move a checklist column left or right"""
    group_id: str
    direction: str  # "left" or "right"


@router.patch("/{case_id}/checklist/columns/{column_id}/move")
async def move_checklist_column(
    case_id: str,
    column_id: str,
    request: MoveColumnRequest,
    current_user: dict = Depends(get_current_user)
):
    """Move a checklist column left or right (change order)"""
    from datetime import datetime, timezone
    
    if request.direction not in ["left", "right"]:
        raise HTTPException(status_code=400, detail="Dirección debe ser 'left' o 'right'")
    
    now = datetime.now(timezone.utc).isoformat()
    
    checklist = await db.case_checklists.find_one({"case_id": case_id})
    if not checklist:
        raise HTTPException(status_code=404, detail="Checklist no encontrado")
    
    group = checklist.get("groups", {}).get(request.group_id)
    if not group:
        raise HTTPException(status_code=404, detail="Grupo no encontrado")
    
    columns = group.get("columns", [])
    # Filter only active (non-deleted) columns for order calculation
    active_columns = [c for c in columns if not c.get("deleted")]
    
    column_idx = next((i for i, c in enumerate(active_columns) if c["id"] == column_id), None)
    
    if column_idx is None:
        raise HTTPException(status_code=404, detail="Columna no encontrada")
    
    # Calculate new index
    if request.direction == "left" and column_idx > 0:
        new_idx = column_idx - 1
    elif request.direction == "right" and column_idx < len(active_columns) - 1:
        new_idx = column_idx + 1
    else:
        # Can't move further
        return {"success": True, "message": "No se puede mover más"}
    
    # Swap columns in the active list
    active_columns[column_idx], active_columns[new_idx] = active_columns[new_idx], active_columns[column_idx]
    
    # Update order values
    for i, col in enumerate(active_columns):
        col["order"] = i
    
    # Rebuild full columns list (preserve deleted columns at end)
    deleted_columns = [c for c in columns if c.get("deleted")]
    group["columns"] = active_columns + deleted_columns
    
    checklist["updated_at"] = now
    
    await db.case_checklists.update_one(
        {"case_id": case_id},
        {"$set": checklist}
    )
    
    return {"success": True}


@router.patch("/{case_id}/status")
async def update_case_status_delivery(
    case_id: str,
    status_update: dict,
    current_user: dict = Depends(get_current_user)
):
    """Update case status (used for archiving to 'concluidos')"""
    from datetime import datetime, timezone
    
    now = datetime.now(timezone.utc).isoformat()
    new_status = status_update.get("status")
    
    if new_status not in ["active", "concluidos", "descartado"]:
        raise HTTPException(status_code=400, detail="Status inválido")
    
    # Get current case
    case = await db.cases.find_one({"id": case_id}, {"_id": 0})
    if not case:
        raise HTTPException(status_code=404, detail="Caso no encontrado")
    
    old_status = case.get("status")
    
    # Update
    await db.cases.update_one(
        {"id": case_id},
        {"$set": {
            "status": new_status,
            "updated_at": now,
            "status_changed_at": now
        }}
    )
    
    # Audit log
    await db.audit_logs.insert_one({
        "id": str(uuid.uuid4()),
        "action": "case_status_changed",
        "case_id": case_id,
        "old_status": old_status,
        "new_status": new_status,
        "user_id": current_user.get("id"),
        "user_email": current_user.get("email"),
        "created_at": now
    })
    
    return {"success": True, "message": f"Status cambiado a {new_status}"}
