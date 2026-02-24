"""
Today's Focus Router - Dashboard for daily actions
Includes: Assign Deal Makers, WhatsApp, LinkedIn, Email, Quotes
"""
import os
import logging
from datetime import datetime, timezone
from typing import Optional, List
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from dotenv import load_dotenv

load_dotenv()

from database import db
from routers.auth import get_current_user

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/todays-focus", tags=["todays-focus"])


class AssignDealMakerRequest(BaseModel):
    """Request to assign a contact as Deal Maker for a case"""
    case_id: str
    contact_id: str


class MarkDMCompleteRequest(BaseModel):
    """Request to mark a case as having all Deal Makers assigned"""
    case_id: str


class AssignRolesRequest(BaseModel):
    """Request to assign roles to a contact"""
    contact_id: str
    roles: List[str]
    case_roles: Optional[List[dict]] = None  # [{case_id, role}]


class SetCaseRolesRequest(BaseModel):
    """Request to set case-level roles for a contact (replaces all roles for that case)"""
    contact_id: str
    case_id: str
    roles: List[str]  # Can be empty to clear all roles


class CreateContactForCaseRequest(BaseModel):
    """Request to create a new contact and add to a case"""
    case_id: str
    name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    job_title: Optional[str] = None
    company: Optional[str] = None


# Available roles for assignment
# Must match frontend/src/utils/roleMapping.js CANONICAL_ROLES
AVAILABLE_ROLES = [
    "deal_maker",
    "influencer",
    "champion",
    "sponsor",
    "asistente_deal_maker",
    "procurement",
    "staff",
    "coachee",
    "student",
    "alumno",  # Legacy alias for student
    "advisor",
    "speaker",
    "evaluador_360",
    # Additional legacy roles
    "rh",
    "director_general",
    "gerente",
    "coordinador"
]


@router.get("/contacts-without-roles")
async def get_contacts_without_roles(
    current_user: dict = Depends(get_current_user)
):
    """Get all contacts in Stage 3 or 4 that don't have any role assigned"""
    
    # Find contacts without roles (empty array, null, or doesn't exist)
    contacts = await db.unified_contacts.find(
        {
            "stage": {"$in": [3, 4]},
            "$or": [
                {"roles": {"$exists": False}},
                {"roles": None},
                {"roles": []},
                {"roles": {"$size": 0}}
            ]
        },
        {"_id": 0}
    ).sort("name", 1).to_list(500)
    
    # Enrich with case information
    enriched_contacts = []
    for contact in contacts:
        contact_id = contact.get("id")
        
        # Get associated cases
        associated_cases = await db.cases.find(
            {"contact_ids": contact_id},
            {"_id": 0, "id": 1, "name": 1, "stage": 1, "delivery_stage": 1, "company_names": 1, "hubspot_deal_id": 1}
        ).to_list(50)
        
        contact["associated_cases"] = associated_cases
        contact["case_names"] = [c.get("name", "") for c in associated_cases]
        contact["company_names_from_cases"] = []
        for c in associated_cases:
            contact["company_names_from_cases"].extend(c.get("company_names", []) or [])
        contact["company_names_from_cases"] = list(set([n for n in contact["company_names_from_cases"] if n]))
        
        enriched_contacts.append(contact)
    
    return {
        "contacts": enriched_contacts,
        "total": len(enriched_contacts),
        "available_roles": AVAILABLE_ROLES
    }


@router.post("/assign-roles")
async def assign_roles(
    data: AssignRolesRequest,
    current_user: dict = Depends(get_current_user)
):
    """Assign roles to a contact, optionally associating them with specific cases"""
    now = datetime.now(timezone.utc).isoformat()
    
    # Verify contact exists
    contact = await db.unified_contacts.find_one({"id": data.contact_id})
    if not contact:
        raise HTTPException(status_code=404, detail="Contacto no encontrado")
    
    # Validate roles
    invalid_roles = [r for r in data.roles if r not in AVAILABLE_ROLES]
    if invalid_roles:
        raise HTTPException(status_code=400, detail=f"Roles inválidos: {invalid_roles}")
    
    # Update contact with new roles (global roles)
    update_data = {
        "roles": data.roles,
        "contact_types": data.roles,
        "updated_at": now,
        "roles_assigned_at": now
    }
    
    await db.unified_contacts.update_one(
        {"id": data.contact_id},
        {"$set": update_data}
    )
    
    # CRITICAL: Save case-level roles to case_contact_roles collection
    # This is what Current Cases grouping uses for classification
    if data.case_roles:
        for case_role in data.case_roles:
            case_id = case_role.get("case_id")
            role = case_role.get("role")
            
            if not case_id or not role:
                continue
            
            # Check if role already exists for this contact+case+role
            existing = await db.case_contact_roles.find_one({
                "contact_id": data.contact_id,
                "case_id": case_id,
                "role": role
            })
            
            if not existing:
                # Insert new case-level role
                await db.case_contact_roles.insert_one({
                    "contact_id": data.contact_id,
                    "case_id": case_id,
                    "role": role,
                    "added_at": now,
                    "added_by": current_user.get("email", "unknown")
                })
                logger.info(f"Added case-level role: contact={data.contact_id}, case={case_id}, role={role}")
        
        # Also update case_history for backward compatibility
        case_history = contact.get("case_history") or []
        
        for case_role in data.case_roles:
            case_id = case_role.get("case_id")
            role = case_role.get("role")
            
            if not case_id or not role:
                continue
            
            # Get case info
            case_info = await db.cases.find_one({"id": case_id}, {"_id": 0, "name": 1, "hubspot_deal_id": 1})
            if not case_info:
                continue
            
            # Check if case already in history
            found = False
            for ch in case_history:
                if ch.get("case_id") == case_id or ch.get("hubspot_deal_id") == case_info.get("hubspot_deal_id"):
                    # Add label if not present
                    labels = ch.get("labels") or []
                    role_label = role.replace("_", " ").title()
                    if role_label not in labels:
                        labels.append(role_label)
                        ch["labels"] = labels
                    found = True
                    break
            
            # If case not in history, add it
            if not found:
                role_label = role.replace("_", " ").title()
                case_history.append({
                    "case_id": case_id,
                    "hubspot_deal_id": case_info.get("hubspot_deal_id"),
                    "name": case_info.get("name", ""),
                    "labels": [role_label]
                })
        
        # Update case_history
        await db.unified_contacts.update_one(
            {"id": data.contact_id},
            {"$set": {"case_history": case_history, "updated_at": now}}
        )
    
    return {
        "success": True,
        "message": f"Roles asignados: {', '.join(data.roles)}",
        "contact_id": data.contact_id,
        "roles": data.roles,
        "case_roles": data.case_roles
    }


@router.put("/case-roles")
async def set_case_roles(
    data: SetCaseRolesRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Set case-level roles for a contact (replaces all existing roles for that case).
    
    This is the authoritative endpoint for case-level role assignment.
    - Sending roles: ["deal_maker", "sponsor"] will set exactly those roles
    - Sending roles: [] will DELETE all roles for this contact+case
    
    Returns the updated case_roles array.
    """
    now = datetime.now(timezone.utc).isoformat()
    
    # Verify contact exists
    contact = await db.unified_contacts.find_one({"id": data.contact_id})
    if not contact:
        raise HTTPException(status_code=404, detail="Contacto no encontrado")
    
    # Verify case exists
    case = await db.cases.find_one({"id": data.case_id})
    if not case:
        raise HTTPException(status_code=404, detail="Caso no encontrado")
    
    # Validate roles (if any provided)
    if data.roles:
        invalid_roles = [r for r in data.roles if r not in AVAILABLE_ROLES]
        if invalid_roles:
            raise HTTPException(status_code=400, detail=f"Roles inválidos: {invalid_roles}")
    
    # DELETE all existing roles for this contact+case
    delete_result = await db.case_contact_roles.delete_many({
        "contact_id": data.contact_id,
        "case_id": data.case_id
    })
    logger.info(f"Deleted {delete_result.deleted_count} existing roles for contact={data.contact_id}, case={data.case_id}")
    
    # INSERT new roles (if any)
    inserted_roles = []
    for role in data.roles:
        await db.case_contact_roles.insert_one({
            "contact_id": data.contact_id,
            "case_id": data.case_id,
            "role": role,
            "added_at": now,
            "added_by": current_user.get("email", "unknown")
        })
        inserted_roles.append(role)
        logger.info(f"Added case-level role: contact={data.contact_id}, case={data.case_id}, role={role}")
    
    # Update case_history for backward compatibility
    case_history = contact.get("case_history") or []
    case_info = {"name": case.get("name", ""), "hubspot_deal_id": case.get("hubspot_deal_id")}
    
    # Find or create case history entry
    found = False
    for ch in case_history:
        if ch.get("case_id") == data.case_id or ch.get("hubspot_deal_id") == case_info.get("hubspot_deal_id"):
            # Update labels to match new roles
            ch["labels"] = [r.replace("_", " ").title() for r in data.roles]
            ch["case_id"] = data.case_id
            found = True
            break
    
    if not found and data.roles:
        case_history.append({
            "case_id": data.case_id,
            "hubspot_deal_id": case_info.get("hubspot_deal_id"),
            "name": case_info.get("name", ""),
            "labels": [r.replace("_", " ").title() for r in data.roles]
        })
    
    # Update case_history in contact
    await db.unified_contacts.update_one(
        {"id": data.contact_id},
        {"$set": {"case_history": case_history, "updated_at": now}}
    )
    
    return {
        "success": True,
        "message": f"Roles actualizados: {', '.join(data.roles) if data.roles else 'sin roles'}",
        "contact_id": data.contact_id,
        "case_id": data.case_id,
        "case_roles": inserted_roles,
        "deleted_count": delete_result.deleted_count
    }


@router.get("/available-roles")
async def get_available_roles(
    current_user: dict = Depends(get_current_user)
):
    """Get list of available roles for assignment"""
    role_labels = {
        "deal_maker": "Deal Maker",
        "sponsor": "Patrocinador Ejecutivo",
        "coachee": "Coachee (Lo Hago Contigo)",
        "alumno": "Alumno",
        "staff": "Staff",
        "speaker": "Speaker",
        "advisor": "Consejero",
        "procurement": "Compras",
        "champion": "Recomendado",
        "asistente_deal_maker": "Asistente Deal Maker",
        "evaluador_360": "Evaluador 360",
        "rh": "Recursos Humanos",
        "director_general": "Director General",
        "gerente": "Gerente",
        "coordinador": "Coordinador"
    }
    
    return {
        "roles": [{"value": r, "label": role_labels.get(r, r)} for r in AVAILABLE_ROLES]
    }


@router.get("/cases-without-dealmaker")
async def get_cases_without_dealmaker(
    current_user: dict = Depends(get_current_user)
):
    """Get all cases in Stage 3 or 4 that need Deal Maker assignment (not marked as dm_complete)"""
    
    # Get all cases that are not marked as dm_complete
    all_cases = await db.cases.find(
        {
            "status": {"$ne": "descartado"},
            "dm_complete": {"$ne": True}
        },
        {"_id": 0, "id": 1, "name": 1, "stage": 1, "delivery_stage": 1, 
         "contact_ids": 1, "company_names": 1, "amount": 1, "hubspot_deal_id": 1}
    ).to_list(None)
    
    cases_for_dm = []
    
    for case in all_cases:
        contact_ids = case.get("contact_ids", [])
        
        # Get contacts for this case
        contacts = []
        deal_makers = []
        if contact_ids:
            contacts = await db.unified_contacts.find(
                {"id": {"$in": contact_ids}},
                {"_id": 0, "id": 1, "name": 1, "email": 1, "phone": 1, "roles": 1, "job_title": 1}
            ).to_list(None)
            
            # Identify which contacts are already deal makers
            deal_makers = [c for c in contacts if "deal_maker" in (c.get("roles") or [])]
        
        case["current_stage"] = "Stage 4" if case.get("delivery_stage") else "Stage 3"
        case["stage_detail"] = case.get("delivery_stage") or case.get("stage", "")
        case["contacts"] = contacts
        case["deal_makers"] = deal_makers  # List of already assigned deal makers
        cases_for_dm.append(case)
    
    return {
        "cases": cases_for_dm,
        "total": len(cases_for_dm)
    }


@router.post("/assign-dealmaker")
async def assign_dealmaker(
    data: AssignDealMakerRequest,
    current_user: dict = Depends(get_current_user)
):
    """Assign a contact as Deal Maker for a specific case (can assign multiple)"""
    now = datetime.now(timezone.utc).isoformat()
    
    # Verify case exists
    case = await db.cases.find_one({"id": data.case_id})
    if not case:
        raise HTTPException(status_code=404, detail="Caso no encontrado")
    
    # Verify contact exists and is associated with the case
    contact = await db.unified_contacts.find_one({"id": data.contact_id})
    if not contact:
        raise HTTPException(status_code=404, detail="Contacto no encontrado")
    
    if data.contact_id not in (case.get("contact_ids") or []):
        raise HTTPException(status_code=400, detail="El contacto no está asociado a este caso")
    
    # Check if already a deal maker
    current_roles = contact.get("roles") or []
    already_dm = "deal_maker" in current_roles
    
    # Add deal_maker role to contact if not already present
    if not already_dm:
        current_roles.append("deal_maker")
        await db.unified_contacts.update_one(
            {"id": data.contact_id},
            {
                "$set": {
                    "roles": current_roles,
                    "contact_types": current_roles,
                    "updated_at": now
                }
            }
        )
    
    # Update case_history for this contact with the deal_maker label
    case_history = contact.get("case_history") or []
    updated = False
    for ch in case_history:
        if ch.get("case_id") == data.case_id or ch.get("hubspot_deal_id") == case.get("hubspot_deal_id"):
            if "Deal Maker" not in (ch.get("labels") or []):
                ch["labels"] = (ch.get("labels") or []) + ["Deal Maker"]
                updated = True
            break
    
    if updated:
        await db.unified_contacts.update_one(
            {"id": data.contact_id},
            {"$set": {"case_history": case_history, "updated_at": now}}
        )
    
    # Get updated list of deal makers for this case
    contact_ids = case.get("contact_ids", [])
    deal_makers = await db.unified_contacts.find(
        {"id": {"$in": contact_ids}, "roles": "deal_maker"},
        {"_id": 0, "id": 1, "name": 1, "email": 1, "phone": 1, "roles": 1, "job_title": 1}
    ).to_list(None)
    
    return {
        "success": True,
        "message": f"{contact.get('name')} asignado como Deal Maker",
        "contact_id": data.contact_id,
        "case_id": data.case_id,
        "deal_makers": deal_makers,  # Return updated list
        "already_dm": already_dm
    }


@router.post("/mark-dm-complete")
async def mark_dm_complete(
    data: MarkDMCompleteRequest,
    current_user: dict = Depends(get_current_user)
):
    """Mark a case as having all Deal Makers assigned"""
    now = datetime.now(timezone.utc).isoformat()
    
    # Verify case exists
    case = await db.cases.find_one({"id": data.case_id})
    if not case:
        raise HTTPException(status_code=404, detail="Caso no encontrado")
    
    # Mark as dm_complete
    await db.cases.update_one(
        {"id": data.case_id},
        {"$set": {"dm_complete": True, "dm_completed_at": now}}
    )
    
    return {
        "success": True,
        "message": "Asignación de Deal Makers completada",
        "case_id": data.case_id
    }


class SearchContactsRequest(BaseModel):
    """Request to search contacts"""
    query: str
    exclude_ids: Optional[List[str]] = None  # IDs to exclude from results


class AddContactToCaseRequest(BaseModel):
    """Request to add a contact to a case"""
    case_id: str
    contact_id: str


@router.get("/search-contacts")
async def search_contacts_for_case(
    q: str,
    case_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Search contacts in the database to add to a case. Excludes contacts already in the case."""
    
    if not q or len(q) < 2:
        return {"contacts": []}
    
    # Get case to find already associated contacts
    case = await db.cases.find_one({"id": case_id})
    if not case:
        raise HTTPException(status_code=404, detail="Caso no encontrado")
    
    existing_contact_ids = case.get("contact_ids", []) or []
    
    # Search contacts by name, email, phone, job_title
    search_query = {
        "$or": [
            {"name": {"$regex": q, "$options": "i"}},
            {"email": {"$regex": q, "$options": "i"}},
            {"phone": {"$regex": q, "$options": "i"}},
            {"job_title": {"$regex": q, "$options": "i"}},
            {"company": {"$regex": q, "$options": "i"}}
        ]
    }
    
    # Exclude contacts already in the case
    if existing_contact_ids:
        search_query["id"] = {"$nin": existing_contact_ids}
    
    contacts = await db.unified_contacts.find(
        search_query,
        {"_id": 0, "id": 1, "name": 1, "email": 1, "phone": 1, "job_title": 1, 
         "company": 1, "stage": 1, "roles": 1}
    ).sort("name", 1).limit(15).to_list(15)
    
    return {"contacts": contacts}


@router.post("/add-contact-to-case")
async def add_contact_to_case(
    data: AddContactToCaseRequest,
    current_user: dict = Depends(get_current_user)
):
    """Add an existing contact to a case and assign as Deal Maker"""
    now = datetime.now(timezone.utc).isoformat()
    
    # Verify case exists
    case = await db.cases.find_one({"id": data.case_id})
    if not case:
        raise HTTPException(status_code=404, detail="Caso no encontrado")
    
    # Verify contact exists
    contact = await db.unified_contacts.find_one({"id": data.contact_id})
    if not contact:
        raise HTTPException(status_code=404, detail="Contacto no encontrado")
    
    # Check if contact is already in the case
    existing_contact_ids = case.get("contact_ids", []) or []
    if data.contact_id in existing_contact_ids:
        return {
            "success": False,
            "message": "El contacto ya está asociado a este caso",
            "already_associated": True
        }
    
    # Add contact to case
    existing_contact_ids.append(data.contact_id)
    await db.cases.update_one(
        {"id": data.case_id},
        {"$set": {"contact_ids": existing_contact_ids, "updated_at": now}}
    )
    
    # Add deal_maker role to contact
    current_roles = contact.get("roles") or []
    if "deal_maker" not in current_roles:
        current_roles.append("deal_maker")
    
    # Update contact's case_history
    case_history = contact.get("case_history") or []
    case_history.append({
        "case_id": data.case_id,
        "hubspot_deal_id": case.get("hubspot_deal_id"),
        "name": case.get("name", ""),
        "labels": ["Deal Maker"]
    })
    
    # Update contact stage to 3 if lower
    new_stage = contact.get("stage", 1)
    if new_stage < 3:
        new_stage = 3
    
    await db.unified_contacts.update_one(
        {"id": data.contact_id},
        {
            "$set": {
                "roles": current_roles,
                "contact_types": current_roles,
                "case_history": case_history,
                "stage": new_stage,
                "updated_at": now
            }
        }
    )
    
    # Get updated list of contacts and deal makers for this case
    all_contacts = await db.unified_contacts.find(
        {"id": {"$in": existing_contact_ids}},
        {"_id": 0, "id": 1, "name": 1, "email": 1, "phone": 1, "roles": 1, "job_title": 1}
    ).to_list(None)
    
    deal_makers = [c for c in all_contacts if "deal_maker" in (c.get("roles") or [])]
    
    return {
        "success": True,
        "message": f"{contact.get('name')} agregado al caso y asignado como Deal Maker",
        "contact_id": data.contact_id,
        "case_id": data.case_id,
        "contacts": all_contacts,
        "deal_makers": deal_makers
    }


@router.post("/create-contact-for-case")
async def create_contact_for_case(
    data: CreateContactForCaseRequest,
    current_user: dict = Depends(get_current_user)
):
    """Create a new contact and add it to a case as Deal Maker"""
    import uuid
    now = datetime.now(timezone.utc).isoformat()
    
    # Verify case exists
    case = await db.cases.find_one({"id": data.case_id})
    if not case:
        raise HTTPException(status_code=404, detail="Caso no encontrado")
    
    # Check if contact with same email already exists
    if data.email:
        existing = await db.unified_contacts.find_one({"email": data.email})
        if existing:
            raise HTTPException(
                status_code=400, 
                detail=f"Ya existe un contacto con este email: {existing.get('name')}"
            )
    
    # Create new contact
    contact_id = str(uuid.uuid4())
    new_contact = {
        "id": contact_id,
        "name": data.name,
        "email": data.email,
        "phone": data.phone,
        "job_title": data.job_title,
        "company": data.company,
        "stage": 3,  # Stage 3 since associated with a case
        "roles": ["deal_maker"],
        "contact_types": ["deal_maker"],
        "source": "manual",
        "status": "active",
        "case_history": [{
            "case_id": data.case_id,
            "hubspot_deal_id": case.get("hubspot_deal_id"),
            "name": case.get("name", ""),
            "labels": ["Deal Maker"]
        }],
        "created_at": now,
        "updated_at": now
    }
    
    await db.unified_contacts.insert_one(new_contact)
    
    # Add contact to case
    existing_contact_ids = case.get("contact_ids", []) or []
    existing_contact_ids.append(contact_id)
    await db.cases.update_one(
        {"id": data.case_id},
        {"$set": {"contact_ids": existing_contact_ids, "updated_at": now}}
    )
    
    # Get updated list of contacts and deal makers for this case
    all_contacts = await db.unified_contacts.find(
        {"id": {"$in": existing_contact_ids}},
        {"_id": 0, "id": 1, "name": 1, "email": 1, "phone": 1, "roles": 1, "job_title": 1}
    ).to_list(None)
    
    deal_makers = [c for c in all_contacts if "deal_maker" in (c.get("roles") or [])]
    
    # Remove _id from new_contact for response
    new_contact.pop("_id", None)
    
    return {
        "success": True,
        "message": f"{data.name} creado y asignado como Deal Maker",
        "contact_id": contact_id,
        "case_id": data.case_id,
        "contact": new_contact,
        "contacts": all_contacts,
        "deal_makers": deal_makers
    }


@router.post("/unmark-dm-complete")
async def unmark_dm_complete(
    data: MarkDMCompleteRequest,
    current_user: dict = Depends(get_current_user)
):
    """Unmark a case, returning it to the assignment queue"""
    now = datetime.now(timezone.utc).isoformat()
    
    # Verify case exists
    case = await db.cases.find_one({"id": data.case_id})
    if not case:
        raise HTTPException(status_code=404, detail="Caso no encontrado")
    
    # Remove dm_complete flag
    await db.cases.update_one(
        {"id": data.case_id},
        {"$set": {"dm_complete": False, "updated_at": now}}
    )
    
    return {
        "success": True,
        "message": "Caso devuelto a la cola de asignación",
        "case_id": data.case_id
    }


@router.get("/cases-solicited")
async def get_cases_solicited(
    current_user: dict = Depends(get_current_user)
):
    """Get all cases in 'Caso Solicitado' stage for Quotes tab"""
    
    cases = await db.cases.find(
        {
            "stage": "caso_solicitado",
            "status": "active",
            "delivery_stage": {"$exists": False}
        },
        {"_id": 0}
    ).sort("created_at", -1).to_list(None)
    
    # Enrich with contact info
    for case in cases:
        contact_ids = case.get("contact_ids", [])
        if contact_ids:
            contacts = await db.unified_contacts.find(
                {"id": {"$in": contact_ids}},
                {"_id": 0, "id": 1, "name": 1, "email": 1, "phone": 1, "roles": 1}
            ).to_list(None)
            case["contacts"] = contacts
            
            # Find deal maker if exists
            deal_makers = [c for c in contacts if "deal_maker" in (c.get("roles") or [])]
            case["deal_maker"] = deal_makers[0] if deal_makers else None
        else:
            case["contacts"] = []
            case["deal_maker"] = None
    
    return {
        "cases": cases,
        "total": len(cases)
    }


@router.get("/dealmaker-followup")
async def get_dealmaker_followup(
    current_user: dict = Depends(get_current_user)
):
    """
    Get deal makers for WhatsApp follow-up messages:
    - Stage 3, Presentados or Con Interés: "propuesta" message
    - Stage 3, Cierre Administrativo: "proyecto en puerta" message
    """
    
    # Get Stage 3 active cases in relevant stages
    relevant_stages = ["caso_presentado", "interes_en_caso", "cierre_administrativo"]
    
    cases = await db.cases.find(
        {
            "stage": {"$in": relevant_stages},
            "status": "active",
            "delivery_stage": {"$exists": False}
        },
        {"_id": 0, "id": 1, "name": 1, "stage": 1, "contact_ids": 1, "company_names": 1}
    ).to_list(None)
    
    # Collect unique deal makers with their case info
    deal_makers_propuesta = []  # caso_presentado, interes_en_caso
    deal_makers_proyecto = []   # cierre_administrativo
    
    seen_contacts_propuesta = set()
    seen_contacts_proyecto = set()
    
    for case in cases:
        contact_ids = case.get("contact_ids", [])
        if not contact_ids:
            continue
        
        # Find deal makers for this case
        deal_makers = await db.unified_contacts.find(
            {
                "id": {"$in": contact_ids},
                "roles": "deal_maker"
            },
            {"_id": 0, "id": 1, "name": 1, "email": 1, "phone": 1, "company": 1}
        ).to_list(None)
        
        for dm in deal_makers:
            dm_data = {
                **dm,
                "case_id": case["id"],
                "case_name": case.get("name", ""),
                "company_names": case.get("company_names", []),
                "stage": case.get("stage", "")
            }
            
            if case.get("stage") in ["caso_presentado", "interes_en_caso"]:
                if dm["id"] not in seen_contacts_propuesta:
                    seen_contacts_propuesta.add(dm["id"])
                    deal_makers_propuesta.append(dm_data)
            elif case.get("stage") == "cierre_administrativo":
                if dm["id"] not in seen_contacts_proyecto:
                    seen_contacts_proyecto.add(dm["id"])
                    deal_makers_proyecto.append(dm_data)
    
    return {
        "propuesta": {
            "contacts": deal_makers_propuesta,
            "total": len(deal_makers_propuesta),
            "message_template": "¡Hola {name}! 👋 Solo te mando este mensajito de recordatorio de que cualquier cosa sobre la propuesta que les hicimos, estoy a tus órdenes. ¡Saludos! - Perla"
        },
        "proyecto": {
            "contacts": deal_makers_proyecto,
            "total": len(deal_makers_proyecto),
            "message_template": "¡Hola {name}! 👋 Solo te mando este mensajito de recordatorio de que cualquier cosa sobre el proyecto que tenemos en puerta, estoy a tus órdenes. ¡Saludos! - Perla"
        }
    }


@router.get("/batting-stats")
async def get_batting_stats(
    current_user: dict = Depends(get_current_user)
):
    """
    Get batting percentage stats:
    - All time: contacts that moved to Stage 4 / total contacts in cases
    - By year: breakdown of conversions per year
    """
    from collections import defaultdict
    
    # Get all Stage 4 projects with their close dates
    stage4_projects = await db.cases.find(
        {"delivery_stage": {"$exists": True}},
        {"_id": 0, "hubspot_close_date": 1, "contact_ids": 1}
    ).to_list(None)
    
    # Get all Stage 3 cases (active + descartado, but not in Stage 4)
    stage3_cases = await db.cases.find(
        {"delivery_stage": {"$exists": False}},
        {"_id": 0, "hubspot_close_date": 1, "contact_ids": 1, "status": 1, "created_at": 1}
    ).to_list(None)
    
    # Calculate total unique contacts
    all_contacts_stage3 = set()
    for case in stage3_cases:
        for cid in case.get("contact_ids", []):

            all_contacts_stage3.add(cid)
    
    all_contacts_stage4 = set()
    for project in stage4_projects:
        for cid in project.get("contact_ids", []):
            all_contacts_stage4.add(cid)
    
    total_contacts = len(all_contacts_stage3 | all_contacts_stage4)
    converted_contacts = len(all_contacts_stage4)
    
    # All time batting percentage
    all_time_batting = (converted_contacts / total_contacts * 100) if total_contacts > 0 else 0
    
    # Breakdown by year (using hubspot_close_date for Stage 4)
    yearly_stats = defaultdict(lambda: {"won": 0, "total": 0})
    current_year = datetime.now().year
    
    # Count Stage 4 wins by year
    for project in stage4_projects:
        close_date = project.get("hubspot_close_date")
        if close_date:
            try:
                if isinstance(close_date, str):
                    year = int(close_date[:4])
                else:
                    year = close_date.year
                yearly_stats[year]["won"] += len(project.get("contact_ids", []))
            except (ValueError, AttributeError, TypeError):
                yearly_stats[current_year]["won"] += len(project.get("contact_ids", []))
    
    # Count all cases created by year (for total)
    for case in stage3_cases + stage4_projects:
        created_at = case.get("hubspot_close_date") or case.get("created_at")
        if created_at:
            try:
                if isinstance(created_at, str):
                    year = int(created_at[:4])
                else:
                    year = created_at.year
                yearly_stats[year]["total"] += len(case.get("contact_ids", []))
            except (ValueError, AttributeError, TypeError):
                pass
    
    # Calculate yearly batting percentages
    yearly_breakdown = []
    for year in sorted(yearly_stats.keys(), reverse=True):
        stats = yearly_stats[year]
        batting = (stats["won"] / stats["total"] * 100) if stats["total"] > 0 else 0
        yearly_breakdown.append({
            "year": year,
            "won": stats["won"],
            "total": stats["total"],
            "batting_percentage": round(batting, 1)
        })
    
    # Current year batting
    current_year_stats = yearly_stats.get(current_year, {"won": 0, "total": 0})
    current_year_batting = (current_year_stats["won"] / current_year_stats["total"] * 100) if current_year_stats["total"] > 0 else 0
    
    return {
        "all_time": {
            "batting_percentage": round(all_time_batting, 1),
            "converted": converted_contacts,
            "total": total_contacts
        },
        "current_year": {
            "year": current_year,
            "batting_percentage": round(current_year_batting, 1),
            "won": current_year_stats["won"],
            "total": current_year_stats["total"]
        },
        "yearly_breakdown": yearly_breakdown
    }



# ============ EVENT REGISTRANT IMPORT TRACKING ============

# ============ ICE BREAKER - 2 WEEK OLD SEARCHES ============

@router.get("/ice-breaker")
async def get_ice_breaker_searches(
    current_user: dict = Depends(get_current_user)
):
    """
    Get ALL LinkedIn searches that have been prospected, showing which ones are ready for ice breaker.
    Searches are ready 14 days after prospecting. Shows future ones in the queue too.
    """
    from datetime import timedelta
    
    now = datetime.now(timezone.utc)
    
    # Find ALL searches that have been prospected (have last_prospected_at)
    searches = await db.linkedin_searches.find(
        {"last_prospected_at": {"$exists": True, "$ne": None}},
        {"_id": 0}
    ).sort("last_prospected_at", 1).to_list(500)
    
    # Enrich with company names and calculate ready dates
    enriched_searches = []
    for search in searches:
        # Get company from unified_companies (single source)
        company = await db.unified_companies.find_one(
            {"$or": [{"id": search.get("company_id")}, {"hubspot_id": search.get("company_id")}]},
            {"_id": 0, "name": 1}
        )
        
        prospected_at_str = search.get("last_prospected_at")
        if not prospected_at_str:
            continue
            
        # Parse the prospected date
        try:
            if prospected_at_str.endswith('Z'):
                prospected_at = datetime.fromisoformat(prospected_at_str.replace('Z', '+00:00'))
            elif '+' in prospected_at_str or prospected_at_str.endswith('+00:00'):
                prospected_at = datetime.fromisoformat(prospected_at_str)
            else:
                prospected_at = datetime.fromisoformat(prospected_at_str).replace(tzinfo=timezone.utc)
        except Exception:
            continue
        
        # Calculate ready date (14 days after prospecting)
        ready_date = prospected_at + timedelta(days=14)
        is_ready = now >= ready_date
        days_until_ready = (ready_date - now).days if not is_ready else 0
        days_since_prospected = (now - prospected_at).days
        
        # Check if already marked as done for THIS cycle
        # (ice_breaker_done_at must be AFTER last_prospected_at to count as done)
        ice_breaker_done_at = search.get("ice_breaker_done_at")
        is_done_this_cycle = False
        if ice_breaker_done_at:
            try:
                if ice_breaker_done_at.endswith('Z'):
                    done_at = datetime.fromisoformat(ice_breaker_done_at.replace('Z', '+00:00'))
                elif '+' in ice_breaker_done_at:
                    done_at = datetime.fromisoformat(ice_breaker_done_at)
                else:
                    done_at = datetime.fromisoformat(ice_breaker_done_at).replace(tzinfo=timezone.utc)
                # Done if ice_breaker_done_at is after prospected_at
                is_done_this_cycle = done_at > prospected_at
            except Exception:
                pass
        
        enriched_searches.append({
            "id": search.get("id"),
            "keyword": search.get("keyword"),
            "url": search.get("url"),
            "company_id": search.get("company_id"),
            "company_name": company.get("name") if company else "Desconocida",
            "prospected_at": prospected_at_str,
            "prospected_by": search.get("last_prospected_by"),
            "prospected_by_name": {
                "GB": "Gerardo Betancourt",
                "MG": "María del Mar Gargari"
            }.get(search.get("last_prospected_by"), search.get("last_prospected_by")),
            "ready_date": ready_date.strftime("%Y-%m-%d"),
            "is_ready": is_ready,
            "is_done_this_cycle": is_done_this_cycle,
            "days_until_ready": days_until_ready,
            "days_since_prospected": days_since_prospected
        })
    
    # Sort: ready and not done first, then by ready_date
    enriched_searches.sort(key=lambda x: (
        x["is_done_this_cycle"],  # Done ones last
        not x["is_ready"],  # Ready ones first
        x["ready_date"]  # Then by date
    ))
    
    ready_count = len([s for s in enriched_searches if s["is_ready"] and not s["is_done_this_cycle"]])
    pending_count = len([s for s in enriched_searches if not s["is_ready"]])
    done_count = len([s for s in enriched_searches if s["is_done_this_cycle"]])
    
    return {
        "searches": enriched_searches,
        "total": len(enriched_searches),
        "ready_count": ready_count,
        "pending_count": pending_count,
        "done_count": done_count
    }


@router.post("/ice-breaker/{search_id}/mark-done")
async def mark_ice_breaker_done(
    search_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Mark an ice breaker search as completed for this cycle"""
    now = datetime.now(timezone.utc).isoformat()
    
    result = await db.linkedin_searches.update_one(
        {"id": search_id},
        {"$set": {
            "ice_breaker_done_at": now,
            "ice_breaker_done_by": current_user.get("email")
        }}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Search not found")
    
    return {"success": True, "search_id": search_id}


def get_current_iso_week():
    """Get current ISO week in format YYYY-Www (e.g., 2025-W06)"""
    now = datetime.now(timezone.utc)
    return now.strftime("%G-W%V")


@router.get("/events-pending-import")
async def get_events_pending_import(
    current_user: dict = Depends(get_current_user)
):
    """
    Get future events that need registrant imports.
    Shows events with webinar_date >= today.
    Tracks weekly import status via last_import_week field.
    """
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    current_week = get_current_iso_week()
    
    # Get future events
    events = await db.webinar_events_v2.find(
        {
            "webinar_date": {"$gte": today},
            "status": {"$ne": "cancelled"}
        },
        {"_id": 0}
    ).sort("webinar_date", 1).to_list(100)
    
    # Add import status for each event
    for event in events:
        last_import = event.get("last_import_week")
        event["imported_this_week"] = (last_import == current_week)
        event["last_import_week"] = last_import
    
    return {
        "events": events,
        "current_week": current_week,
        "total": len(events)
    }


@router.patch("/events/{event_id}/mark-imported")
async def mark_event_imported(
    event_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Mark an event as having had registrants imported this week"""
    event = await db.webinar_events_v2.find_one({"id": event_id})
    if not event:
        raise HTTPException(status_code=404, detail="Evento no encontrado")
    
    current_week = get_current_iso_week()
    now = datetime.now(timezone.utc).isoformat()
    
    await db.webinar_events_v2.update_one(
        {"id": event_id},
        {"$set": {
            "last_import_week": current_week,
            "last_import_at": now,
            "updated_at": now
        }}
    )
    
    return {
        "success": True,
        "event_id": event_id,
        "import_week": current_week
    }



# ============ INVITE TO EVENTS - WEEKLY COMPANY INVITATIONS ============

class MarkCompanyInvitedRequest(BaseModel):
    """Mark companies as invited to an event this week"""
    company_ids: List[str]

def _is_valid_company_name(name) -> bool:
    """Reject empty and numeric-only company names."""
    if not name:
        return False
    return not str(name).strip().isdigit()


async def _get_outbound_company_names() -> List[str]:
    """
    Canonical outbound company source for invitation flows.
    Uses unified_companies with is_merged != True and no hardcoded cap.
    """
    company_names = set()
    cursor = db.unified_companies.find(
        {"classification": "outbound", "is_merged": {"$ne": True}},
        {"_id": 0, "name": 1}
    )
    async for company in cursor:
        name = company.get("name")
        if _is_valid_company_name(name):
            company_names.add(str(name).strip())
    return sorted(company_names)


async def _get_outbound_company_records() -> List[dict]:
    """
    Canonical outbound companies for invitation workflows.
    Uses stable identity (company id), not name-based deduplication.
    """
    companies: List[dict] = []
    cursor = db.unified_companies.find(
        {"classification": "outbound", "is_merged": {"$ne": True}},
        {"_id": 0, "id": 1, "name": 1, "hubspot_id": 1}
    )
    async for company in cursor:
        cid = company.get("id")
        name = company.get("name")
        if not cid:
            continue
        if not _is_valid_company_name(name):
            continue
        companies.append({
            "id": str(cid),
            "name": str(name).strip(),
            "hubspot_id": company.get("hubspot_id")
        })
    companies.sort(key=lambda c: (c["name"].lower(), c["id"]))
    return companies


@router.get("/events-for-invitations")
async def get_events_for_invitations(
    current_user: dict = Depends(get_current_user)
):
    """
    Get future events available for sending company invitations.
    Returns events and OUTBOUND companies only with invitation tracking.
    """
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    current_week = get_current_iso_week()
    
    # Get future events
    events = await db.webinar_events_v2.find(
        {
            "webinar_date": {"$gte": today},
            "status": {"$ne": "cancelled"}
        },
        {"_id": 0}
    ).sort("webinar_date", 1).to_list(100)
    
    outbound_companies = await _get_outbound_company_records()

    return {
        "events": events,
        "active_companies": [c["name"] for c in outbound_companies],
        "current_week": current_week,
        "total_events": len(events),
        "total_companies": len(outbound_companies)
    }


@router.get("/events/{event_id}/company-invitations")
async def get_event_company_invitations(
    event_id: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Get invitation status for all OUTBOUND companies for a specific event.
    
    Only shows companies with classification="outbound" in unified_companies.
    
    Sorting rules:
    1. Companies NOT invited this week come first
    2. Within each group, sort by number of non-discarded cases (descending)
    3. Companies invited this week go to the back of the queue
    """
    event = await db.webinar_events_v2.find_one({"id": event_id}, {"_id": 0})
    if not event:
        raise HTTPException(status_code=404, detail="Evento no encontrado")
    
    current_week = get_current_iso_week()
    
    outbound_companies = await _get_outbound_company_records()
    outbound_id_to_name = {c["id"]: c["name"] for c in outbound_companies}
    
    # Get case counts per company (non-discarded cases only)
    # Cases use company_names array, so we need to unwind first
    case_count_pipeline = [
        {"$match": {"status": {"$ne": "descartado"}}},
        {"$unwind": {"path": "$company_names", "preserveNullAndEmptyArrays": False}},
        {"$group": {"_id": "$company_names", "count": {"$sum": 1}}}
    ]
    case_counts = await db.cases.aggregate(case_count_pipeline).to_list(500)
    case_count_map = {doc["_id"]: doc["count"] for doc in case_counts if doc["_id"]}
    
    # Get invitation records for THIS EVENT (to show checkmark)
    event_invitations = []
    async for inv in db.event_company_invitations.find({"event_id": event_id}, {"_id": 0}):
        event_invitations.append(inv)
    event_invitation_by_id = {}
    event_invitation_by_name = {}
    for inv in event_invitations:
        if inv.get("company_id"):
            event_invitation_by_id[str(inv["company_id"])] = inv
        if inv.get("company_name"):
            event_invitation_by_name[str(inv["company_name"]).strip()] = inv
    
    # Get ALL invitations this week (ANY event) - for queue ordering
    all_invitations_this_week = []
    async for inv in db.event_company_invitations.find(
        {"last_invited_week": current_week},
        {"_id": 0, "company_id": 1, "company_name": 1, "last_invited_at": 1}
    ):
        all_invitations_this_week.append(inv)
    
    # Build map of companies invited to ANY event this week
    invited_any_event_this_week_by_id = {}
    invited_any_event_this_week_by_name = {}
    for inv in all_invitations_this_week:
        company_id = inv.get("company_id")
        company_name = inv.get("company_name")
        if company_id:
            sid = str(company_id)
            if sid not in invited_any_event_this_week_by_id:
                invited_any_event_this_week_by_id[sid] = inv.get("last_invited_at")
        if company_name:
            sname = str(company_name).strip()
            if sname not in invited_any_event_this_week_by_name:
                invited_any_event_this_week_by_name[sname] = inv.get("last_invited_at")
    
    # Build company list with invitation status and case count
    invited_this_week = []
    not_invited_this_week = []
    
    for company in outbound_companies:
        company_id = company["id"]
        company_name = company["name"]
        # Check if invited to THIS specific event
        event_inv = event_invitation_by_id.get(company_id) or event_invitation_by_name.get(company_name)
        invited_to_this_event = event_inv.get("last_invited_week") == current_week if event_inv else False
        
        # Check if invited to ANY event this week (for queue ordering)
        invited_to_any_event = (
            company_id in invited_any_event_this_week_by_id
            or company_name in invited_any_event_this_week_by_name
        )
        
        case_count = case_count_map.get(company_name, 0)
        
        company_data = {
            "id": company_id,
            "name": company_name,
            "invited_this_week": invited_to_this_event,  # Checkmark for THIS event
            "invited_to_any_event": invited_to_any_event,  # For queue ordering
            "last_invited_week": event_inv.get("last_invited_week") if event_inv else None,
            "last_invited_at": invited_any_event_this_week_by_id.get(company_id)
                or invited_any_event_this_week_by_name.get(company_name),
            "case_count": case_count
        }
        
        # Queue ordering: companies invited to ANY event this week go to the back
        if invited_to_any_event:
            invited_this_week.append(company_data)
        else:
            not_invited_this_week.append(company_data)
    
    # Sort: by case count descending within each group
    not_invited_this_week.sort(key=lambda x: (-x["case_count"], x["name"].lower()))
    invited_this_week.sort(key=lambda x: (-x["case_count"], x["name"].lower()))
    
    # Not invited first, then invited (invited go to back of queue)
    companies_with_status = not_invited_this_week + invited_this_week
    
    return {
        "event": event,
        "companies": companies_with_status,
        "current_week": current_week,
        "invited_count": len(invited_this_week),
        "pending_count": len(not_invited_this_week),
        "total": len(companies_with_status)
    }


@router.post("/events/{event_id}/mark-companies-invited")
async def mark_companies_invited(
    event_id: str,
    request: MarkCompanyInvitedRequest,
    current_user: dict = Depends(get_current_user)
):
    """Mark companies as invited to an event this week"""
    event = await db.webinar_events_v2.find_one({"id": event_id})
    if not event:
        raise HTTPException(status_code=404, detail="Evento no encontrado")
    
    current_week = get_current_iso_week()
    now = datetime.now(timezone.utc).isoformat()
    
    outbound_companies = await _get_outbound_company_records()
    outbound_id_to_name = {c["id"]: c["name"] for c in outbound_companies}
    outbound_name_to_id = {c["name"]: c["id"] for c in outbound_companies}

    companies_marked = 0
    # Update or create invitation records (canonical key: company_id)
    for company_ref in request.company_ids:
        company_id = None
        company_name = None

        if company_ref in outbound_id_to_name:
            company_id = company_ref
            company_name = outbound_id_to_name[company_ref]
        elif company_ref in outbound_name_to_id:
            # Backward compatibility with old frontend payloads by name
            company_id = outbound_name_to_id[company_ref]
            company_name = company_ref
        else:
            # Ignore non-outbound / unknown references
            continue

        await db.event_company_invitations.update_one(
            {"event_id": event_id, "company_id": company_id},
            {"$set": {
                "event_id": event_id,
                "event_name": event.get("name"),
                "company_id": company_id,
                "company_name": company_name,
                "last_invited_week": current_week,
                "last_invited_at": now,
                "updated_at": now
            }},
            upsert=True
        )
        companies_marked += 1

        # Cleanup legacy record keyed only by company_name
        await db.event_company_invitations.delete_many({
            "event_id": event_id,
            "company_name": company_name,
            "company_id": {"$exists": False}
        })
    
    return {
        "success": True,
        "event_id": event_id,
        "companies_marked": companies_marked,
        "week": current_week
    }


@router.post("/events/{event_id}/unmark-company-invited")
async def unmark_company_invited(
    event_id: str,
    company_name: Optional[str] = None,
    company_id: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Unmark a company as invited (remove from invited list this week)"""
    if not company_id and not company_name:
        raise HTTPException(status_code=400, detail="company_id or company_name is required")

    query = {"event_id": event_id}
    if company_id and company_name:
        query["$or"] = [{"company_id": company_id}, {"company_name": company_name}]
    elif company_id:
        query["company_id"] = company_id
    else:
        query["company_name"] = company_name

    result = await db.event_company_invitations.delete_many(query)
    
    return {
        "success": True,
        "deleted": result.deleted_count > 0
    }



# ============ QUOTES / PRE-PROJECTS ============

@router.get("/quotes-cases")
async def get_quotes_cases(
    current_user: dict = Depends(get_current_user)
):
    """
    Get cases in stage 'caso_solicitado' - pending quote generation.
    These are pre-projects that need quotes to be created.
    """
    # Find cases in "caso_solicitado" stage (Stage 3 equivalent)
    # This stage means quote has been requested but not yet generated
    cases = await db.cases.find(
        {
            "stage": "caso_solicitado",
            "status": {"$ne": "descartado"},
            "delivery_stage": {"$exists": False}
        },
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    
    enriched_cases = []
    for case in cases:
        case_id = case.get("id")
        
        # Get deal maker info
        deal_maker = None
        deal_maker_id = case.get("deal_maker_id")
        if deal_maker_id:
            dm_contact = await db.unified_contacts.find_one(
                {"id": deal_maker_id},
                {"_id": 0, "id": 1, "name": 1, "email": 1, "phone": 1, "company": 1}
            )
            if dm_contact:
                deal_maker = dm_contact
        
        # Get quotes for this case
        quotes = await db.quotes.find(
            {"case_id": case_id},
            {"_id": 0, "id": 1, "quote_number": 1, "total": 1, "currency": 1, "created_at": 1, "pdf_url": 1}
        ).sort("created_at", -1).to_list(10)
        
        # Also check case-level quotes array
        case_quotes = case.get("quotes", [])
        
        enriched_cases.append({
            "id": case_id,
            "name": case.get("name"),
            "company_name": case.get("company_name"),
            "company_names": case.get("company_names", []),
            "amount": case.get("amount"),
            "services": case.get("services", []),
            "deal_maker": deal_maker,
            "quotes": quotes if quotes else case_quotes,
            "hubspot_deal_id": case.get("hubspot_deal_id"),
            "created_at": case.get("created_at"),
            "contact_ids": case.get("contact_ids", [])
        })
    
    return {
        "cases": enriched_cases,
        "total": len(enriched_cases)
    }
