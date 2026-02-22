"""
Delivery Router - Stage 4: Project Delivery Management
Handles won deals (proyectos) from Stage 3 (Cases)
Stages: ganados -> concluidos -> contenidos_transcritos -> reporte_presentado -> caso_publicado
"""
import os
import uuid
import logging
from datetime import datetime, timezone
from typing import Optional, List
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from dotenv import load_dotenv

load_dotenv()

from database import db
from routers.auth import get_current_user
from constants.stages import STAGE_4_VALUES, is_stage_4

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/delivery", tags=["delivery"])


# ============ MODELS ============

class UpdateProjectRequest(BaseModel):
    """Request to update a project"""
    stage: Optional[str] = None  # ganados, concluidos, contenidos_transcritos, reporte_presentado, caso_publicado
    notes: Optional[str] = None


class MoveToDeliveryRequest(BaseModel):
    """Request to move cases to delivery"""
    case_ids: List[str] = []
    hubspot_deal_ids: List[str] = []
    stage: str = "ganados"


# ============ ROUTES ============

@router.get("/")
async def get_delivery_projects(
    stage: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Get all delivery projects (Stage 4 cases) with optional filters"""
    query = {"stage": {"$in": STAGE_4_VALUES}}
    if stage:
        query["stage"] = stage
    
    projects = await db.cases.find(query, {"_id": 0}).sort("delivery_moved_at", -1).to_list(500)
    
    # Get stats
    total = await db.cases.count_documents({"stage": {"$in": STAGE_4_VALUES}})
    ganados = await db.cases.count_documents({"stage": "ganados"})
    concluidos = await db.cases.count_documents({"stage": "concluidos"})
    contenidos_transcritos = await db.cases.count_documents({"stage": "contenidos_transcritos"})
    reporte_presentado = await db.cases.count_documents({"stage": "reporte_presentado"})
    caso_publicado = await db.cases.count_documents({"stage": "caso_publicado"})
    
    return {
        "projects": projects,
        "stats": {
            "total": total,
            "ganados": ganados,
            "concluidos": concluidos,
            "contenidos_transcritos": contenidos_transcritos,
            "reporte_presentado": reporte_presentado,
            "caso_publicado": caso_publicado
        }
    }


@router.get("/by-contact/{contact_id}")
async def get_delivery_by_contact(
    contact_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get all delivery projects where a contact is associated"""
    projects = await db.cases.find(
        {"contact_ids": contact_id, "stage": {"$in": STAGE_4_VALUES}},
        {"_id": 0, "id": 1, "name": 1, "stage": 1, "company_names": 1, "delivery_moved_at": 1}
    ).sort("delivery_moved_at", -1).to_list(100)
    return projects


@router.get("/{project_id}")
async def get_project(
    project_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get a single delivery project with its contacts and companies"""
    project = await db.cases.find_one(
        {"id": project_id, "stage": {"$in": STAGE_4_VALUES}}, 
        {"_id": 0}
    )
    if not project:
        raise HTTPException(status_code=404, detail="Proyecto no encontrado")
    
    # Get associated contacts
    contacts = []
    if project.get("contact_ids"):
        contacts = await db.unified_contacts.find(
            {"id": {"$in": project["contact_ids"]}},
            {"_id": 0, "id": 1, "name": 1, "email": 1, "phone": 1, "company": 1, "job_title": 1, "buyer_persona": 1, "stage": 1}
        ).to_list(None)
    
    # Get associated companies from unified_companies (single source)
    companies = []
    
    # Method 1: If we have company_ids, look them up
    if project.get("company_ids"):
        companies = await db.unified_companies.find(
            {"$or": [
                {"id": {"$in": project["company_ids"]}},
                {"hubspot_id": {"$in": project["company_ids"]}},
                {"hs_object_id": {"$in": project["company_ids"]}}
            ], "is_merged": {"$ne": True}},
            {"_id": 0, "id": 1, "hubspot_id": 1, "name": 1, "domain": 1, "industry": 1, "phone": 1, "city": 1, "country": 1}
        ).to_list(None)
    
    # Method 2: If no companies found and we have company_names, look up by name
    if not companies and project.get("company_names"):
        for company_name in project["company_names"]:
            if not company_name:
                continue
            company = await db.unified_companies.find_one(
                {"name": {"$regex": f"^{company_name}$", "$options": "i"}, "is_merged": {"$ne": True}},
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
                {"name": {"$regex": f"^{company_name}$", "$options": "i"}, "is_merged": {"$ne": True}},
                {"_id": 0, "id": 1, "hubspot_id": 1, "name": 1, "domain": 1, "industry": 1, "phone": 1, "city": 1, "country": 1}
            )
            if not company:
                company = {"id": None, "name": company_name}
            if company:
                companies.append(company)
    
    project["contacts"] = contacts
    project["companies"] = companies
    return project


@router.patch("/{project_id}")
async def update_project(
    project_id: str,
    data: UpdateProjectRequest,
    current_user: dict = Depends(get_current_user)
):
    """Update a delivery project's stage. 
    - If moving to concluidos: moves alumnos/coachees to Stage 5
    - If moving to caso_publicado: moves ALL contacts to Stage 5
    """
    project = await db.cases.find_one({"id": project_id, "stage": {"$in": STAGE_4_VALUES}})
    if not project:
        raise HTTPException(status_code=404, detail="Proyecto no encontrado")
    
    now = datetime.now(timezone.utc).isoformat()
    update_data = {"updated_at": now}
    contacts_moved = 0
    contacts_moved_details = []
    
    if data.stage:
        if data.stage not in STAGE_4_VALUES:
            raise HTTPException(status_code=400, detail=f"Stage inválido. Opciones: {STAGE_4_VALUES}")
        update_data["stage"] = data.stage
        
        contact_ids = project.get("contact_ids", [])
        
        # If moving to concluidos, move only alumnos/coachees to Stage 5
        if data.stage == "concluidos" and contact_ids:
            # Define roles that should be moved
            student_coachee_roles = ["alumno", "Alumno", "coachee", "Coachee", "estudiante", "Estudiante", "student"]
            
            result = await db.unified_contacts.update_many(
                {
                    "id": {"$in": contact_ids},
                    "$or": [
                        {"roles": {"$in": student_coachee_roles}},
                        {"contact_types": {"$in": student_coachee_roles}}
                    ],
                    "stage": {"$ne": 5}  # Don't update if already in Stage 5
                },
                {
                    "$set": {
                        "stage": 5,
                        "stage_moved_at": now,
                        "stage_moved_reason": f"Proyecto '{project.get('name', '')}' movido a Concluidos"
                    }
                }
            )
            contacts_moved = result.modified_count
        
        # If moving to caso_publicado, move ALL remaining contacts to Stage 5
        elif data.stage == "caso_publicado" and contact_ids:
            result = await db.unified_contacts.update_many(
                {
                    "id": {"$in": contact_ids},
                    "stage": {"$ne": 5}  # Don't update if already in Stage 5
                },
                {
                    "$set": {
                        "stage": 5,
                        "stage_moved_at": now,
                        "stage_moved_reason": f"Proyecto '{project.get('name', '')}' publicado"
                    }
                }
            )
            contacts_moved = result.modified_count
    
    if data.notes is not None:
        update_data["delivery_notes"] = data.notes
    
    await db.cases.update_one({"id": project_id}, {"$set": update_data})
    
    updated = await db.cases.find_one({"id": project_id}, {"_id": 0})
    updated["contacts_moved_to_stage5"] = contacts_moved
    return updated


@router.get("/{project_id}/contacts-summary")
async def get_project_contacts_summary(
    project_id: str,
    target_stage: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Get summary of contacts by role for a project (used for confirmation dialog).
    If target_stage is 'concluidos', shows only alumnos/coachees that will be moved.
    """
    project = await db.cases.find_one(
        {"id": project_id, "stage": {"$in": STAGE_4_VALUES}},
        {"contact_ids": 1, "name": 1}
    )
    if not project:
        raise HTTPException(status_code=404, detail="Proyecto no encontrado")
    
    contact_ids = project.get("contact_ids", [])
    if not contact_ids:
        return {"total": 0, "by_role": {}, "will_move_to_stage5": 0, "contacts_to_move": []}
    
    # Define student/coachee roles
    student_coachee_roles = ["alumno", "Alumno", "coachee", "Coachee", "estudiante", "Estudiante", "student"]
    
    # Get contacts with their roles
    contacts = await db.unified_contacts.find(
        {"id": {"$in": contact_ids}},
        {"_id": 0, "id": 1, "name": 1, "roles": 1, "stage": 1}
    ).to_list(None)
    
    # Count by role
    by_role = {}
    contacts_to_move = []
    
    for contact in contacts:
        roles = contact.get("roles", [])
        current_stage = contact.get("stage")
        
        if not roles:
            by_role["sin_rol"] = by_role.get("sin_rol", 0) + 1
        else:
            for role in roles:
                by_role[role] = by_role.get(role, 0) + 1
        
        # Check if this contact would be moved when going to "concluidos"
        if target_stage == "concluidos":
            is_student_coachee = any(r in student_coachee_roles for r in roles)
            if is_student_coachee and current_stage != 5:
                contacts_to_move.append({
                    "id": contact.get("id"),
                    "name": contact.get("name", "Sin nombre"),
                    "roles": roles
                })
        elif target_stage == "caso_publicado":
            if current_stage != 5:
                contacts_to_move.append({
                    "id": contact.get("id"),
                    "name": contact.get("name", "Sin nombre"),
                    "roles": roles
                })
    
    return {
        "total": len(contacts),
        "by_role": by_role,
        "will_move_to_stage5": len(contacts_to_move),
        "contacts_to_move": contacts_to_move
    }


@router.post("/move-from-cases")
async def move_cases_to_delivery(
    data: MoveToDeliveryRequest,
    current_user: dict = Depends(get_current_user)
):
    """Move cases from Stage 3 to Stage 4 Delivery"""
    now = datetime.now(timezone.utc).isoformat()
    
    # Build query for cases to move
    query = {"$or": []}
    if data.case_ids:
        query["$or"].append({"id": {"$in": data.case_ids}})
    if data.hubspot_deal_ids:
        query["$or"].append({"hubspot_deal_id": {"$in": [str(d) for d in data.hubspot_deal_ids]}})
    
    if not query["$or"]:
        raise HTTPException(status_code=400, detail="Proporciona case_ids o hubspot_deal_ids")
    
    # Find cases to move
    cases_to_move = await db.cases.find(query).to_list(None)
    
    if not cases_to_move:
        return {"moved": 0, "contacts_updated": 0, "message": "No se encontraron casos"}
    
    moved = 0
    contacts_updated = 0
    contact_ids_to_update = set()
    
    for case in cases_to_move:
        # Update case to delivery - change stage to the delivery stage
        await db.cases.update_one(
            {"id": case["id"]},
            {"$set": {
                "stage": data.stage,  # Now just updates the unified stage field
                "previous_stage": case.get("stage"),  # Store previous stage for reference
                "delivery_moved_at": now,
                "updated_at": now
            }}
        )
        moved += 1
        
        # Collect contact IDs
        for cid in case.get("contact_ids", []):
            contact_ids_to_update.add(cid)
    
    # Update contacts to Stage 4
    if contact_ids_to_update:
        result = await db.unified_contacts.update_many(
            {"id": {"$in": list(contact_ids_to_update)}},
            {"$set": {"stage": 4, "updated_at": now}}
        )
        contacts_updated = result.modified_count
    
    return {
        "moved": moved,
        "contacts_updated": contacts_updated,
        "stage": data.stage,
        "message": f"Se movieron {moved} proyectos a Delivery ({data.stage})"
    }


@router.post("/move-back-to-cases/{project_id}")
async def move_back_to_cases(
    project_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Move a project back from Delivery to Cases (Stage 3)"""
    now = datetime.now(timezone.utc).isoformat()
    
    project = await db.cases.find_one({"id": project_id, "stage": {"$in": STAGE_4_VALUES}})
    if not project:
        raise HTTPException(status_code=404, detail="Proyecto no encontrado en Delivery")
    
    # Get previous stage or default to cierre_administrativo
    previous_stage = project.get("previous_stage", "cierre_administrativo")
    
    # Update case back to Stage 3
    await db.cases.update_one(
        {"id": project_id},
        {
            "$unset": {
                "delivery_moved_at": "",
                "delivery_notes": "",
                "previous_stage": ""
            },
            "$set": {
                "stage": previous_stage,
                "status": "active",
                "updated_at": now
            }
        }
    )
    
    # Update contacts back to Stage 3
    contacts_updated = 0
    if project.get("contact_ids"):
        result = await db.unified_contacts.update_many(
            {"id": {"$in": project["contact_ids"]}},
            {"$set": {"stage": 3, "updated_at": now}}
        )
        contacts_updated = result.modified_count
    
    return {
        "success": True,
        "contacts_updated": contacts_updated,
        "message": "Proyecto devuelto a Cases (Stage 3)"
    }
