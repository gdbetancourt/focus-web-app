"""
Convenios Router - Manage company agreements with Ricardo buyer persona contacts
"""
from fastapi import APIRouter, HTTPException, Depends, UploadFile, File
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timezone
import uuid
import os

from database import db
from routers.auth import get_current_user

router = APIRouter(prefix="/convenios", tags=["convenios"])


class ConvenioUpdate(BaseModel):
    interes_convenio: Optional[bool] = None
    fecha_cierre: Optional[str] = None
    notas: Optional[str] = None


@router.get("/companies")
async def get_companies_with_ricardo(current_user: dict = Depends(get_current_user)):
    """
    Get all companies that have contacts with buyer persona 'Ricardo',
    ordered by count of Ricardo contacts (descending)
    """
    # Aggregate contacts by company, filtering for Ricardo buyer persona
    pipeline = [
        # Match contacts with Ricardo buyer persona
        {"$match": {"buyer_persona": {"$regex": "ricardo", "$options": "i"}}},
        # Group by company
        {"$group": {
            "_id": "$company",
            "ricardo_count": {"$sum": 1},
            "contacts": {"$push": {"name": "$name", "email": "$email", "id": "$id"}}
        }},
        # Sort by count descending
        {"$sort": {"ricardo_count": -1}},
        # Filter out empty company names
        {"$match": {"_id": {"$ne": None, "$ne": ""}}},
        # Limit contacts per company
        {"$project": {
            "_id": 1,
            "ricardo_count": 1,
            "contacts": {"$slice": ["$contacts", 10]}
        }}
    ]
    
    company_contacts = await db.unified_contacts.aggregate(pipeline).to_list(500)
    
    # Get all company names
    company_names = [item["_id"] for item in company_contacts]
    
    # Batch fetch all existing convenios
    existing_convenios = {}
    convenios_cursor = db.convenios.find({"company_name": {"$in": company_names}})
    async for conv in convenios_cursor:
        existing_convenios[conv["company_name"]] = conv
    
    # Build response and create missing convenio records in batch
    companies = []
    new_convenios = []
    
    for item in company_contacts:
        company_name = item["_id"]
        convenio = existing_convenios.get(company_name)
        
        if not convenio:
            convenio = {
                "id": str(uuid.uuid4()),
                "company_name": company_name,
                "interes_convenio": False,
                "fecha_cierre": None,
                "fecha_renovacion": None,
                "acuerdo_url": None,
                "acuerdo_filename": None,
                "notas": None,
                "created_at": datetime.now(timezone.utc).isoformat()
            }
            new_convenios.append(convenio)
        
        companies.append({
            "id": convenio.get("id", str(uuid.uuid4())),
            "name": company_name,
            "ricardo_count": item["ricardo_count"],
            "contacts": item["contacts"],
            "interes_convenio": convenio.get("interes_convenio", False),
            "fecha_cierre": convenio.get("fecha_cierre"),
            "acuerdo_url": convenio.get("acuerdo_url"),
            "acuerdo_filename": convenio.get("acuerdo_filename"),
            "notas": convenio.get("notas")
        })
    
    # Insert all new convenios in one batch
    if new_convenios:
        await db.convenios.insert_many(new_convenios)
    
    return {
        "companies": companies,
        "total": len(companies)
    }


@router.put("/companies/{company_id}")
async def update_convenio(
    company_id: str,
    data: ConvenioUpdate,
    current_user: dict = Depends(get_current_user)
):
    """Update convenio data for a company"""
    update_data = {}
    
    if data.interes_convenio is not None:
        update_data["interes_convenio"] = data.interes_convenio
    
    if data.fecha_cierre is not None:
        update_data["fecha_cierre"] = data.fecha_cierre
        # Auto-calculate renewal date (+1 year)
        if data.fecha_cierre:
            try:
                cierre_date = datetime.fromisoformat(data.fecha_cierre.replace('Z', '+00:00'))
                renovacion_date = cierre_date.replace(year=cierre_date.year + 1)
                update_data["fecha_renovacion"] = renovacion_date.isoformat()
            except:
                pass
    
    if data.notas is not None:
        update_data["notas"] = data.notas
    
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    result = await db.convenios.update_one(
        {"id": company_id},
        {"$set": update_data}
    )
    
    if result.modified_count == 0:
        # Try to update by company_name as fallback
        result = await db.convenios.update_one(
            {"company_name": company_id},
            {"$set": update_data}
        )
    
    return {"success": True, "updated": update_data}


@router.post("/companies/{company_id}/acuerdo")
async def upload_acuerdo(
    company_id: str,
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user)
):
    """Upload agreement document for a company"""
    # Validate file type
    allowed_extensions = ['.pdf', '.doc', '.docx']
    file_ext = os.path.splitext(file.filename)[1].lower()
    
    if file_ext not in allowed_extensions:
        raise HTTPException(status_code=400, detail="Only PDF and Word documents are allowed")
    
    # Save file
    upload_dir = "/app/uploads/convenios"
    os.makedirs(upload_dir, exist_ok=True)
    
    file_id = str(uuid.uuid4())
    filename = f"{file_id}{file_ext}"
    filepath = os.path.join(upload_dir, filename)
    
    with open(filepath, "wb") as f:
        content = await file.read()
        f.write(content)
    
    # Generate URL (assuming static file serving)
    file_url = f"/uploads/convenios/{filename}"
    
    # Update convenio record
    await db.convenios.update_one(
        {"id": company_id},
        {"$set": {
            "acuerdo_url": file_url,
            "acuerdo_filename": file.filename,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    return {
        "success": True,
        "url": file_url,
        "filename": file.filename
    }


@router.get("/stats")
async def get_convenios_stats(current_user: dict = Depends(get_current_user)):
    """Get convenios statistics"""
    total = await db.convenios.count_documents({})
    con_interes = await db.convenios.count_documents({"interes_convenio": True})
    activos = await db.convenios.count_documents({"fecha_cierre": {"$ne": None}})
    
    return {
        "total": total,
        "con_interes": con_interes,
        "activos": activos
    }
