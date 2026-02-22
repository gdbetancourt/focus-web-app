"""
Testimonials Router - Complete testimonial management system
"""
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timezone
from database import db
from routers.auth import get_current_user
import uuid
import pandas as pd
import io

router = APIRouter(prefix="/testimonials", tags=["Testimonials"])

# Status options for company/person
STATUS_OPTIONS = [
    {"value": "empresa_alto_persona_alto", "label": "Empresa alto estatus, Persona alto estatus"},
    {"value": "empresa_alto_persona_medio", "label": "Empresa alto estatus, Persona estatus intermedio"},
    {"value": "empresa_alto_persona_bajo", "label": "Empresa alto estatus, Persona bajo estatus"},
    {"value": "empresa_bajo_persona_alto", "label": "Empresa bajo estatus, Persona alto estatus"},
    {"value": "empresa_bajo_persona_medio", "label": "Empresa bajo estatus, Persona medio estatus"},
    {"value": "empresa_bajo_persona_bajo", "label": "Empresa bajo estatus, Persona bajo estatus"}
]


class TestimonialCreate(BaseModel):
    testimonio: str
    nombre: str
    apellido: Optional[str] = None
    correo: Optional[str] = None
    formato_id: Optional[str] = None
    formato_name: Optional[str] = None
    enfoque_id: Optional[str] = None  # Linked to thematic axis
    enfoque_name: Optional[str] = None
    industria_id: Optional[str] = None
    industria_name: Optional[str] = None
    programa_id: Optional[str] = None
    programa_name: Optional[str] = None
    nivel_id: Optional[str] = None
    nivel_name: Optional[str] = None
    publicar_desde: Optional[str] = None  # ISO date string
    video_vimeo: Optional[str] = None
    video_descript: Optional[str] = None
    estatus: Optional[str] = None
    rating_presentacion: Optional[int] = None  # 1-5
    rating_articulacion: Optional[int] = None  # 1-5
    rating_calidad_video: Optional[int] = None  # 1-5
    rating_resultados: Optional[int] = None  # 1-5
    valor_agregado: bool = False
    display_pages: Optional[List[str]] = None  # Pages where this testimonial should appear: ["home", "lms", "blog", "events"]


class TestimonialUpdate(BaseModel):
    testimonio: Optional[str] = None
    nombre: Optional[str] = None
    apellido: Optional[str] = None
    correo: Optional[str] = None
    formato_id: Optional[str] = None
    formato_name: Optional[str] = None
    enfoque_id: Optional[str] = None
    enfoque_name: Optional[str] = None
    industria_id: Optional[str] = None
    industria_name: Optional[str] = None
    programa_id: Optional[str] = None
    programa_name: Optional[str] = None
    nivel_id: Optional[str] = None
    nivel_name: Optional[str] = None
    publicar_desde: Optional[str] = None
    video_vimeo: Optional[str] = None
    video_descript: Optional[str] = None
    estatus: Optional[str] = None
    rating_presentacion: Optional[int] = None
    rating_articulacion: Optional[int] = None
    rating_calidad_video: Optional[int] = None
    rating_resultados: Optional[int] = None
    valor_agregado: Optional[bool] = None
    display_pages: Optional[List[str]] = None


# Available pages for testimonial display
DISPLAY_PAGE_OPTIONS = [
    {"value": "home", "label": "Home (Página Principal)"},
    {"value": "lms", "label": "LMS (Cursos)"},
    {"value": "blog", "label": "Blog"},
    {"value": "events", "label": "Eventos"},
    {"value": "services", "label": "Servicios"},
    {"value": "about", "label": "Nosotros"},
]


@router.get("")
async def get_testimonials(
    formato_id: Optional[str] = None,
    enfoque_id: Optional[str] = None,
    industria_id: Optional[str] = None,
    programa_id: Optional[str] = None,
    nivel_id: Optional[str] = None,
    estatus: Optional[str] = None,
    valor_agregado: Optional[bool] = None,
    published_only: bool = False,
    limit: int = 100,
    current_user: dict = Depends(get_current_user)
):
    """Get all testimonials with optional filters"""
    query = {}
    
    if formato_id:
        query["formato_id"] = formato_id
    if enfoque_id:
        query["enfoque_id"] = enfoque_id
    if industria_id:
        query["industria_id"] = industria_id
    if programa_id:
        query["programa_id"] = programa_id
    if nivel_id:
        query["nivel_id"] = nivel_id
    if estatus:
        query["estatus"] = estatus
    if valor_agregado is not None:
        query["valor_agregado"] = valor_agregado
    
    if published_only:
        now = datetime.now(timezone.utc).isoformat()
        query["$or"] = [
            {"publicar_desde": {"$exists": False}},
            {"publicar_desde": None},
            {"publicar_desde": ""},
            {"publicar_desde": {"$lte": now}}
        ]
    
    testimonials = await db.testimonials.find(query, {"_id": 0}).sort("created_at", -1).to_list(limit)
    
    # Get stats
    total = await db.testimonials.count_documents({})
    published = await db.testimonials.count_documents({
        "$or": [
            {"publicar_desde": {"$exists": False}},
            {"publicar_desde": None},
            {"publicar_desde": ""},
            {"publicar_desde": {"$lte": datetime.now(timezone.utc).isoformat()}}
        ]
    })
    
    return {
        "success": True,
        "testimonials": testimonials,
        "total": len(testimonials),
        "stats": {
            "total": total,
            "published": published,
            "pending": total - published
        }
    }


@router.get("/public")
async def get_public_testimonials(
    formato_id: Optional[str] = None,
    enfoque_id: Optional[str] = None,
    industria_id: Optional[str] = None,
    programa_id: Optional[str] = None,
    nivel_id: Optional[str] = None,
    limit: int = 20
):
    """Get published testimonials for public website"""
    now = datetime.now(timezone.utc).isoformat()
    
    query = {
        "$or": [
            {"publicar_desde": {"$exists": False}},
            {"publicar_desde": None},
            {"publicar_desde": ""},
            {"publicar_desde": {"$lte": now}}
        ]
    }
    
    if formato_id:
        query["formato_id"] = formato_id
    if enfoque_id:
        query["enfoque_id"] = enfoque_id
    if industria_id:
        query["industria_id"] = industria_id
    if programa_id:
        query["programa_id"] = programa_id
    if nivel_id:
        query["nivel_id"] = nivel_id
    
    testimonials = await db.testimonials.find(
        query,
        {"_id": 0, "correo": 0}  # Exclude email for privacy
    ).sort("created_at", -1).to_list(limit)
    
    return {
        "success": True,
        "testimonials": testimonials,
        "total": len(testimonials)
    }


@router.get("/public/options")
async def get_public_filter_options():
    """Get filter options for public testimonials page (no auth required)"""
    # Get formatos
    formatos = await db.formatos.find({}, {"_id": 0, "id": 1, "name": 1}).sort("name", 1).to_list(100)
    
    # Get industries
    industries = await db.industries.find({}, {"_id": 0, "id": 1, "name": 1}).sort("name", 1).to_list(100)
    
    return {
        "success": True,
        "formatos": formatos,
        "industries": industries
    }

@router.get("/options")
async def get_testimonial_options(current_user: dict = Depends(get_current_user)):
    """Get all dropdown options for testimonial form"""
    # Get formatos
    formatos = await db.formatos.find({}, {"_id": 0, "id": 1, "name": 1}).sort("name", 1).to_list(100)
    
    # Get thematic axes (enfoques)
    enfoques = await db.thematic_axes.find({}, {"_id": 0, "id": 1, "name": 1}).sort("name", 1).to_list(100)
    
    # Get industries
    industries = await db.industries.find({}, {"_id": 0, "id": 1, "name": 1}).sort("name", 1).to_list(100)
    
    # Get programas
    programas = await db.programas.find({}, {"_id": 0, "id": 1, "name": 1}).sort("name", 1).to_list(100)
    
    # Get niveles
    niveles = await db.niveles_certificacion.find({}, {"_id": 0, "id": 1, "name": 1}).sort("order", 1).to_list(100)
    
    return {
        "success": True,
        "formatos": formatos,
        "enfoques": enfoques,
        "industries": industries,
        "programas": programas,
        "niveles": niveles,
        "status_options": STATUS_OPTIONS,
        "display_pages": DISPLAY_PAGE_OPTIONS,
        "ratings": [1, 2, 3, 4, 5]
    }


@router.get("/by-page/{page_id}")
async def get_testimonials_by_page(page_id: str, limit: int = 10):
    """Get published testimonials for a specific page (public endpoint)"""
    now = datetime.now(timezone.utc).isoformat()
    
    query = {
        "display_pages": page_id,
        "$or": [
            {"publicar_desde": {"$exists": False}},
            {"publicar_desde": None},
            {"publicar_desde": ""},
            {"publicar_desde": {"$lte": now}}
        ]
    }
    
    testimonials = await db.testimonials.find(
        query,
        {"_id": 0, "correo": 0}  # Exclude email for privacy
    ).sort("created_at", -1).to_list(limit)
    
    return {
        "success": True,
        "testimonials": testimonials,
        "page": page_id,
        "total": len(testimonials)
    }


@router.get("/{testimonial_id}")
async def get_testimonial(testimonial_id: str, current_user: dict = Depends(get_current_user)):
    """Get a single testimonial"""
    testimonial = await db.testimonials.find_one({"id": testimonial_id}, {"_id": 0})
    
    if not testimonial:
        raise HTTPException(status_code=404, detail="Testimonial not found")
    
    return {"success": True, "testimonial": testimonial}


@router.post("")
async def create_testimonial(data: TestimonialCreate, current_user: dict = Depends(get_current_user)):
    """Create a new testimonial"""
    now = datetime.now(timezone.utc).isoformat()
    
    # Try to link to existing contact
    contact_id = None
    if data.correo:
        contact = await db.contacts.find_one({"email": data.correo})
        if contact:
            contact_id = contact.get("id")
    
    testimonial = {
        "id": str(uuid.uuid4()),
        "testimonio": data.testimonio,
        "nombre": data.nombre,
        "apellido": data.apellido or "",
        "correo": data.correo or "",
        "contact_id": contact_id,
        "formato_id": data.formato_id,
        "formato_name": data.formato_name or "",
        "enfoque_id": data.enfoque_id,
        "enfoque_name": data.enfoque_name or "",
        "industria_id": data.industria_id,
        "industria_name": data.industria_name or "",
        "programa_id": data.programa_id,
        "programa_name": data.programa_name or "",
        "nivel_id": data.nivel_id,
        "nivel_name": data.nivel_name or "",
        "publicar_desde": data.publicar_desde,
        "video_vimeo": data.video_vimeo or "",
        "video_descript": data.video_descript or "",
        "estatus": data.estatus or "",
        "rating_presentacion": data.rating_presentacion,
        "rating_articulacion": data.rating_articulacion,
        "rating_calidad_video": data.rating_calidad_video,
        "rating_resultados": data.rating_resultados,
        "valor_agregado": data.valor_agregado,
        "display_pages": data.display_pages or [],
        "created_at": now,
        "updated_at": now
    }
    
    await db.testimonials.insert_one(testimonial)
    
    return {"success": True, "testimonial": {k: v for k, v in testimonial.items() if k != "_id"}}


@router.put("/{testimonial_id}")
async def update_testimonial(
    testimonial_id: str, 
    data: TestimonialUpdate, 
    current_user: dict = Depends(get_current_user)
):
    """Update a testimonial"""
    update_data = {"updated_at": datetime.now(timezone.utc).isoformat()}
    
    for field, value in data.dict(exclude_unset=True).items():
        if value is not None:
            update_data[field] = value
    
    # Re-link contact if email changed
    if data.correo:
        contact = await db.contacts.find_one({"email": data.correo})
        update_data["contact_id"] = contact.get("id") if contact else None
    
    result = await db.testimonials.update_one(
        {"id": testimonial_id},
        {"$set": update_data}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Testimonial not found")
    
    return {"success": True, "message": "Testimonial updated"}


@router.delete("/{testimonial_id}")
async def delete_testimonial(testimonial_id: str, current_user: dict = Depends(get_current_user)):
    """Delete a testimonial"""
    result = await db.testimonials.delete_one({"id": testimonial_id})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Testimonial not found")
    
    return {"success": True, "message": "Testimonial deleted"}


class BulkDeleteRequest(BaseModel):
    ids: List[str]

class BulkUpdateRequest(BaseModel):
    ids: List[str]
    update: dict

@router.post("/bulk-delete")
async def bulk_delete_testimonials(request: BulkDeleteRequest, current_user: dict = Depends(get_current_user)):
    """Delete multiple testimonials"""
    if not request.ids:
        raise HTTPException(status_code=400, detail="No IDs provided")
    
    result = await db.testimonials.delete_many({"id": {"$in": request.ids}})
    
    return {
        "success": True,
        "deleted_count": result.deleted_count,
        "message": f"{result.deleted_count} testimonios eliminados"
    }

@router.post("/bulk-update")
async def bulk_update_testimonials(request: BulkUpdateRequest, current_user: dict = Depends(get_current_user)):
    """Update multiple testimonials"""
    if not request.ids:
        raise HTTPException(status_code=400, detail="No IDs provided")
    
    if not request.update:
        raise HTTPException(status_code=400, detail="No update data provided")
    
    # Add updated_at timestamp
    update_data = {**request.update, "updated_at": datetime.now(timezone.utc).isoformat()}
    
    result = await db.testimonials.update_many(
        {"id": {"$in": request.ids}},
        {"$set": update_data}
    )
    
    return {
        "success": True,
        "modified_count": result.modified_count,
        "message": f"{result.modified_count} testimonios actualizados"
    }


@router.post("/import")
async def import_testimonials(
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user)
):
    """Import testimonials from Excel/CSV file"""
    if not file.filename.endswith(('.xlsx', '.xls', '.csv')):
        raise HTTPException(status_code=400, detail="File must be Excel (.xlsx, .xls) or CSV")
    
    try:
        contents = await file.read()
        
        if file.filename.endswith('.csv'):
            df = pd.read_csv(io.BytesIO(contents))
        else:
            df = pd.read_excel(io.BytesIO(contents))
        
        # Normalize column names (lowercase, remove spaces)
        df.columns = df.columns.str.lower().str.strip().str.replace(' ', '_')
        
        # Column mapping from user's Excel
        column_mapping = {
            'testimonioesp': 'testimonio',
            'nombre': 'nombre',
            'apellido': 'apellido',
            'correo': 'correo',
            'formato': 'formato_name',
            'enfoque': 'enfoque_name',
            'industria': 'industria_name',
            'programa': 'programa_name',
            'nivel': 'nivel_name',
            'publicar_a_partir_de': 'publicar_desde',
            'videotestimonio_en_vimeo': 'video_vimeo',
            'videotestimonio_en_descript': 'video_descript',
            'estatus': 'estatus',
            'presentación_(videotestimonio)': 'rating_presentacion',
            'articulación_(videotestimonio)': 'rating_articulacion',
            'calidad_de_video_(videotestimonio)': 'rating_calidad_video',
            'resultados_concretos_(videotestimonio)': 'rating_resultados',
            'valor_agregado': 'valor_agregado'
        }
        
        # Also try simpler column names
        simple_mapping = {
            'testimonio': 'testimonio',
            'presentacion': 'rating_presentacion',
            'articulacion': 'rating_articulacion',
            'calidad_video': 'rating_calidad_video',
            'calidad_de_video': 'rating_calidad_video',
            'resultados': 'rating_resultados',
            'resultados_concretos': 'rating_resultados',
            'vimeo': 'video_vimeo',
            'descript': 'video_descript',
            'publicar_desde': 'publicar_desde',
            'publicar': 'publicar_desde'
        }
        
        column_mapping.update(simple_mapping)
        
        # Rename columns
        df = df.rename(columns=column_mapping)
        
        now = datetime.now(timezone.utc).isoformat()
        created = 0
        errors = []
        
        # Load lookup data
        formatos = {f["name"].lower(): f["id"] for f in await db.formatos.find({}).to_list(100)}
        enfoques = {e["name"].lower(): e["id"] for e in await db.thematic_axes.find({}).to_list(100)}
        industries = {i["name"].lower(): i["id"] for i in await db.industries.find({}).to_list(100)}
        programas = {p["name"].lower(): p["id"] for p in await db.programas.find({}).to_list(100)}
        niveles = {n["name"].lower(): n["id"] for n in await db.niveles_certificacion.find({}).to_list(100)}
        
        for idx, row in df.iterrows():
            try:
                # Skip rows without testimonio
                testimonio = str(row.get('testimonio', '')).strip()
                if not testimonio or testimonio == 'nan':
                    continue
                
                nombre = str(row.get('nombre', '')).strip()
                if not nombre or nombre == 'nan':
                    nombre = "Anonymous"
                
                # Link to existing contact
                correo = str(row.get('correo', '')).strip()
                contact_id = None
                if correo and correo != 'nan':
                    contact = await db.contacts.find_one({"email": correo})
                    if contact:
                        contact_id = contact.get("id")
                else:
                    correo = ""
                
                # Resolve foreign keys
                formato_name = str(row.get('formato_name', '')).strip()
                formato_id = formatos.get(formato_name.lower()) if formato_name and formato_name != 'nan' else None
                
                enfoque_name = str(row.get('enfoque_name', '')).strip()
                enfoque_id = enfoques.get(enfoque_name.lower()) if enfoque_name and enfoque_name != 'nan' else None
                
                industria_name = str(row.get('industria_name', '')).strip()
                industria_id = industries.get(industria_name.lower()) if industria_name and industria_name != 'nan' else None
                
                programa_name = str(row.get('programa_name', '')).strip()
                programa_id = programas.get(programa_name.lower()) if programa_name and programa_name != 'nan' else None
                
                nivel_name = str(row.get('nivel_name', '')).strip()
                nivel_id = niveles.get(nivel_name.lower()) if nivel_name and nivel_name != 'nan' else None
                
                # Parse date
                publicar_desde = None
                if 'publicar_desde' in row and pd.notna(row.get('publicar_desde')):
                    try:
                        date_val = row.get('publicar_desde')
                        if isinstance(date_val, str):
                            publicar_desde = date_val
                        else:
                            publicar_desde = pd.to_datetime(date_val).isoformat()
                    except Exception:
                        pass
                
                # Parse ratings
                def safe_int(val, default=None):
                    try:
                        if pd.isna(val):
                            return default
                        return int(float(val))
                    except Exception:
                        return default
                
                # Parse valor_agregado
                valor_agregado = False
                va = row.get('valor_agregado')
                if va is not None and str(va).lower() in ['true', '1', 'yes', 'si', 'sí', 'x']:
                    valor_agregado = True
                
                testimonial = {
                    "id": str(uuid.uuid4()),
                    "testimonio": testimonio,
                    "nombre": nombre,
                    "apellido": str(row.get('apellido', '')).strip() if pd.notna(row.get('apellido')) else "",
                    "correo": correo,
                    "contact_id": contact_id,
                    "formato_id": formato_id,
                    "formato_name": formato_name if formato_name != 'nan' else "",
                    "enfoque_id": enfoque_id,
                    "enfoque_name": enfoque_name if enfoque_name != 'nan' else "",
                    "industria_id": industria_id,
                    "industria_name": industria_name if industria_name != 'nan' else "",
                    "programa_id": programa_id,
                    "programa_name": programa_name if programa_name != 'nan' else "",
                    "nivel_id": nivel_id,
                    "nivel_name": nivel_name if nivel_name != 'nan' else "",
                    "publicar_desde": publicar_desde,
                    "video_vimeo": str(row.get('video_vimeo', '')).strip() if pd.notna(row.get('video_vimeo')) else "",
                    "video_descript": str(row.get('video_descript', '')).strip() if pd.notna(row.get('video_descript')) else "",
                    "estatus": str(row.get('estatus', '')).strip() if pd.notna(row.get('estatus')) else "",
                    "rating_presentacion": safe_int(row.get('rating_presentacion')),
                    "rating_articulacion": safe_int(row.get('rating_articulacion')),
                    "rating_calidad_video": safe_int(row.get('rating_calidad_video')),
                    "rating_resultados": safe_int(row.get('rating_resultados')),
                    "valor_agregado": valor_agregado,
                    "created_at": now,
                    "updated_at": now
                }
                
                await db.testimonials.insert_one(testimonial)
                created += 1
                
            except Exception as e:
                errors.append(f"Row {idx + 2}: {str(e)}")
        
        return {
            "success": True,
            "message": f"Imported {created} testimonials",
            "created": created,
            "errors": errors[:10] if errors else []
        }
        
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error processing file: {str(e)}")
