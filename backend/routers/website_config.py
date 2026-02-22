"""
Website Configuration Router - Formatos, Programas, Niveles, and updated Thematic Axes
"""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timezone
from database import db
from routers.auth import get_current_user
import uuid

router = APIRouter(prefix="/website-config", tags=["Website Configuration"])


# ============ PYDANTIC MODELS ============

class FormatoCreate(BaseModel):
    name: str
    description: Optional[str] = None
    duration_range: Optional[str] = None  # e.g., "2-4 hours", "1 day", "3 months"


class FormatoUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    duration_range: Optional[str] = None


class ProgramaCreate(BaseModel):
    name: str
    description: Optional[str] = None
    objetivo_resultados: Optional[str] = None
    objetivo_comportamiento: Optional[str] = None
    objetivo_aprendizaje: Optional[str] = None
    objetivo_experiencia: Optional[str] = None


class ProgramaUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    objetivo_resultados: Optional[str] = None
    objetivo_comportamiento: Optional[str] = None
    objetivo_aprendizaje: Optional[str] = None
    objetivo_experiencia: Optional[str] = None


class NivelCreate(BaseModel):
    certification_name: str
    advancement_es: str
    advancement_en: str
    order: Optional[int] = None


class NivelUpdate(BaseModel):
    certification_name: Optional[str] = None
    advancement_es: Optional[str] = None
    advancement_en: Optional[str] = None
    order: Optional[int] = None


class ThematicAxisUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    headline: Optional[str] = None
    subheadline: Optional[str] = None
    key_ideas: Optional[List[str]] = None  # Array of 3 key ideas


# ============ FORMATOS (What section) ============

@router.get("/formatos")
async def get_formatos(current_user: dict = Depends(get_current_user)):
    """Get all formatos"""
    formatos = await db.formatos.find({}, {"_id": 0}).sort("name", 1).to_list(100)
    return {"success": True, "formatos": formatos, "total": len(formatos)}


@router.get("/formatos/public")
async def get_formatos_public():
    """Get all formatos (public endpoint for dropdowns)"""
    formatos = await db.formatos.find({}, {"_id": 0, "id": 1, "name": 1}).sort("name", 1).to_list(100)
    return {"success": True, "formatos": formatos}


@router.post("/formatos")
async def create_formato(data: FormatoCreate, current_user: dict = Depends(get_current_user)):
    """Create a new formato"""
    now = datetime.now(timezone.utc).isoformat()
    
    formato = {
        "id": str(uuid.uuid4()),
        "name": data.name,
        "description": data.description or "",
        "duration_range": data.duration_range or "",
        "created_at": now,
        "updated_at": now
    }
    
    await db.formatos.insert_one(formato)
    return {"success": True, "formato": {k: v for k, v in formato.items() if k != "_id"}}


@router.put("/formatos/{formato_id}")
async def update_formato(formato_id: str, data: FormatoUpdate, current_user: dict = Depends(get_current_user)):
    """Update a formato"""
    update_data = {"updated_at": datetime.now(timezone.utc).isoformat()}
    
    if data.name is not None:
        update_data["name"] = data.name
    if data.description is not None:
        update_data["description"] = data.description
    if data.duration_range is not None:
        update_data["duration_range"] = data.duration_range
    
    result = await db.formatos.update_one({"id": formato_id}, {"$set": update_data})
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Formato not found")
    
    return {"success": True, "message": "Formato updated"}


@router.delete("/formatos/{formato_id}")
async def delete_formato(formato_id: str, current_user: dict = Depends(get_current_user)):
    """Delete a formato"""
    result = await db.formatos.delete_one({"id": formato_id})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Formato not found")
    
    return {"success": True, "message": "Formato deleted"}


@router.post("/formatos/seed")
async def seed_formatos(current_user: dict = Depends(get_current_user)):
    """Seed initial formatos"""
    initial = [
        {"name": "Masterclass", "description": "Sesión intensiva de aprendizaje", "duration_range": "2-4 horas"},
        {"name": "Bootcamp", "description": "Programa intensivo de inmersión", "duration_range": "1-3 días"},
        {"name": "Curso Titular", "description": "Programa completo de formación", "duration_range": "4-12 semanas"},
        {"name": "Curso Complementario", "description": "Módulo adicional de especialización", "duration_range": "2-4 semanas"},
        {"name": "Coaching 1 a 1", "description": "Sesiones personalizadas de coaching", "duration_range": "1-2 horas por sesión"},
        {"name": "Patrocinio", "description": "Programa de patrocinio corporativo", "duration_range": "Variable"}
    ]
    
    now = datetime.now(timezone.utc).isoformat()
    created = 0
    
    for item in initial:
        existing = await db.formatos.find_one({"name": item["name"]})
        if not existing:
            await db.formatos.insert_one({
                "id": str(uuid.uuid4()),
                **item,
                "created_at": now,
                "updated_at": now
            })
            created += 1
    
    return {"success": True, "message": f"Created {created} formatos"}


# ============ PROGRAMAS (How section) ============

@router.get("/programas")
async def get_programas(current_user: dict = Depends(get_current_user)):
    """Get all programas"""
    programas = await db.programas.find({}, {"_id": 0}).sort("name", 1).to_list(100)
    return {"success": True, "programas": programas, "total": len(programas)}


@router.get("/programas/public")
async def get_programas_public():
    """Get all programas (public endpoint for dropdowns)"""
    programas = await db.programas.find({}, {"_id": 0, "id": 1, "name": 1}).sort("name", 1).to_list(100)
    return {"success": True, "programas": programas}


@router.post("/programas")
async def create_programa(data: ProgramaCreate, current_user: dict = Depends(get_current_user)):
    """Create a new programa"""
    now = datetime.now(timezone.utc).isoformat()
    
    programa = {
        "id": str(uuid.uuid4()),
        "name": data.name,
        "description": data.description or "",
        "objetivo_resultados": data.objetivo_resultados or "",
        "objetivo_comportamiento": data.objetivo_comportamiento or "",
        "objetivo_aprendizaje": data.objetivo_aprendizaje or "",
        "objetivo_experiencia": data.objetivo_experiencia or "",
        "created_at": now,
        "updated_at": now
    }
    
    await db.programas.insert_one(programa)
    return {"success": True, "programa": {k: v for k, v in programa.items() if k != "_id"}}


@router.put("/programas/{programa_id}")
async def update_programa(programa_id: str, data: ProgramaUpdate, current_user: dict = Depends(get_current_user)):
    """Update a programa"""
    update_data = {"updated_at": datetime.now(timezone.utc).isoformat()}
    
    for field in ["name", "description", "objetivo_resultados", "objetivo_comportamiento", "objetivo_aprendizaje", "objetivo_experiencia"]:
        value = getattr(data, field, None)
        if value is not None:
            update_data[field] = value
    
    result = await db.programas.update_one({"id": programa_id}, {"$set": update_data})
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Programa not found")
    
    return {"success": True, "message": "Programa updated"}


@router.delete("/programas/{programa_id}")
async def delete_programa(programa_id: str, current_user: dict = Depends(get_current_user)):
    """Delete a programa"""
    result = await db.programas.delete_one({"id": programa_id})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Programa not found")
    
    return {"success": True, "message": "Programa deleted"}


# ============ NIVELES DE CERTIFICACIÓN (Foundations section) ============

@router.get("/niveles")
async def get_niveles(current_user: dict = Depends(get_current_user)):
    """Get all certification levels"""
    niveles = await db.niveles_certificacion.find({}, {"_id": 0}).sort("order", 1).to_list(100)
    return {"success": True, "niveles": niveles, "total": len(niveles)}


@router.get("/niveles/public")
async def get_niveles_public():
    """Get all niveles (public endpoint for dropdowns)"""
    niveles = await db.niveles_certificacion.find({}, {"_id": 0, "id": 1, "name": 1}).sort("order", 1).to_list(100)
    return {"success": True, "niveles": niveles}


@router.post("/niveles")
async def create_nivel(data: NivelCreate, current_user: dict = Depends(get_current_user)):
    """Create a new certification level"""
    now = datetime.now(timezone.utc).isoformat()
    
    # Get max order if not provided
    if data.order is None:
        max_order = await db.niveles_certificacion.find_one(sort=[("order", -1)])
        order = (max_order.get("order", 0) + 1) if max_order else 1
    else:
        order = data.order
    
    nivel = {
        "id": str(uuid.uuid4()),
        "certification_name": data.certification_name,
        "advancement_es": data.advancement_es,
        "advancement_en": data.advancement_en,
        "name": data.certification_name,  # Mantener por compatibilidad
        "order": order,
        "created_at": now,
        "updated_at": now
    }
    
    await db.niveles_certificacion.insert_one(nivel)
    return {"success": True, "nivel": {k: v for k, v in nivel.items() if k != "_id"}}


@router.put("/niveles/{nivel_id}")
async def update_nivel(nivel_id: str, data: NivelUpdate, current_user: dict = Depends(get_current_user)):
    """Update a certification level"""
    update_data = {"updated_at": datetime.now(timezone.utc).isoformat()}
    
    if data.certification_name is not None:
        update_data["certification_name"] = data.certification_name
        update_data["name"] = data.certification_name  # Mantener sincronizado
    if data.advancement_es is not None:
        update_data["advancement_es"] = data.advancement_es
    if data.advancement_en is not None:
        update_data["advancement_en"] = data.advancement_en
    if data.order is not None:
        update_data["order"] = data.order
    
    result = await db.niveles_certificacion.update_one({"id": nivel_id}, {"$set": update_data})
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Nivel not found")
    
    return {"success": True, "message": "Nivel updated"}


@router.delete("/niveles/{nivel_id}")
async def delete_nivel(nivel_id: str, current_user: dict = Depends(get_current_user)):
    """Delete a certification level"""
    result = await db.niveles_certificacion.delete_one({"id": nivel_id})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Nivel not found")
    
    return {"success": True, "message": "Nivel deleted"}


@router.post("/niveles/seed")
async def seed_niveles(current_user: dict = Depends(get_current_user)):
    """Seed initial certification levels"""
    initial = [
        {"name": "Commitment", "description": "Nivel inicial de compromiso", "order": 1},
        {"name": "Master", "description": "Nivel de dominio", "order": 2},
        {"name": "Performance", "description": "Nivel de alto rendimiento", "order": 3},
        {"name": "Results", "description": "Nivel de resultados comprobados", "order": 4}
    ]
    
    now = datetime.now(timezone.utc).isoformat()
    created = 0
    
    for item in initial:
        existing = await db.niveles_certificacion.find_one({"name": item["name"]})
        if not existing:
            await db.niveles_certificacion.insert_one({
                "id": str(uuid.uuid4()),
                **item,
                "created_at": now,
                "updated_at": now
            })
            created += 1
    
    return {"success": True, "message": f"Created {created} niveles"}


# ============ THEMATIC AXES EXTENDED (for Hero slider) ============

@router.put("/thematic-axes/{axis_id}/hero")
async def update_thematic_axis_hero(axis_id: str, data: ThematicAxisUpdate, current_user: dict = Depends(get_current_user)):
    """Update thematic axis with hero slider fields"""
    update_data = {"updated_at": datetime.now(timezone.utc).isoformat()}
    
    if data.name is not None:
        update_data["name"] = data.name
    if data.description is not None:
        update_data["description"] = data.description
    if data.headline is not None:
        update_data["headline"] = data.headline
    if data.subheadline is not None:
        update_data["subheadline"] = data.subheadline
    if data.key_ideas is not None:
        update_data["key_ideas"] = data.key_ideas[:3]  # Limit to 3
    
    result = await db.thematic_axes.update_one({"id": axis_id}, {"$set": update_data})
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Thematic axis not found")
    
    return {"success": True, "message": "Thematic axis updated"}


@router.get("/thematic-axes/hero")
async def get_thematic_axes_for_hero():
    """Get thematic axes with hero fields for public website"""
    axes = await db.thematic_axes.find(
        {"headline": {"$exists": True, "$ne": ""}},
        {"_id": 0}
    ).sort("order", 1).to_list(20)
    
    return {"success": True, "axes": axes, "total": len(axes)}


@router.post("/thematic-axes/seed-hero")
async def seed_thematic_axes_hero(current_user: dict = Depends(get_current_user)):
    """Seed thematic axes with hero data (Science, Profit, Teams)"""
    initial = [
        {
            "name": "Science",
            "description": "Comunicación científica y técnica",
            "headline": "Communicate Science with Impact",
            "subheadline": "Transform complex data into compelling stories that inspire action",
            "key_ideas": [
                "Evidence-based storytelling",
                "Data visualization mastery",
                "Scientific credibility"
            ]
        },
        {
            "name": "Profit",
            "description": "Presentaciones de negocios y ventas",
            "headline": "Present for Profit",
            "subheadline": "Master the art of persuasive presentations that close deals",
            "key_ideas": [
                "ROI-focused messaging",
                "Executive presence",
                "Negotiation through narrative"
            ]
        },
        {
            "name": "Teams",
            "description": "Liderazgo y comunicación de equipos",
            "headline": "Lead Teams Through Story",
            "subheadline": "Inspire and align your team with powerful communication",
            "key_ideas": [
                "Vision casting",
                "Change management",
                "Cultural transformation"
            ]
        }
    ]
    
    now = datetime.now(timezone.utc).isoformat()
    created = 0
    updated = 0
    
    for i, item in enumerate(initial):
        existing = await db.thematic_axes.find_one({"name": item["name"]})
        if existing:
            await db.thematic_axes.update_one(
                {"id": existing["id"]},
                {"$set": {
                    "headline": item["headline"],
                    "subheadline": item["subheadline"],
                    "key_ideas": item["key_ideas"],
                    "updated_at": now
                }}
            )
            updated += 1
        else:
            await db.thematic_axes.insert_one({
                "id": str(uuid.uuid4()),
                **item,
                "order": i + 1,
                "created_at": now,
                "updated_at": now
            })
            created += 1
    
    return {"success": True, "message": f"Created {created}, updated {updated} thematic axes"}
