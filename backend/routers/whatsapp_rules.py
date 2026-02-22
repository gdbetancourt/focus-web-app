"""
WhatsApp Rules Router - Template-based WhatsApp messaging system
Handles rules, templates, and message generation for WhatsApp follow-ups
"""
import os
import uuid
from pathlib import Path
from dotenv import load_dotenv

load_dotenv(Path(__file__).parent.parent / '.env')

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from datetime import datetime, timezone, timedelta
from database import db
from routers.auth import get_current_user
import pytz

router = APIRouter(prefix="/whatsapp-rules", tags=["WhatsApp Rules"])

# Mexico City timezone for all times
MEXICO_TZ = pytz.timezone('America/Mexico_City')

# ============ DEFAULT RULES ============

DEFAULT_WHATSAPP_RULES = [
    # ALL STAGES - Appointment reminders
    {
        "id": "W01",
        "name": "Cita Hoy",
        "description": "Recordatorio el mismo dia de la cita",
        "enabled": True,
        "stage": "all",
        "trigger_type": "meeting_today",
        "template_message": "Hola {contact_name}! Tu cita {meeting_title} es HOY {meeting_date} a las {meeting_time}. Link de acceso: {meeting_link} - Equipo Leaderlix",
        "template_variables": ["contact_name", "meeting_title", "meeting_date", "meeting_time", "meeting_link"],
    },
    {
        "id": "W02",
        "name": "Cita Manana",
        "description": "Recordatorio un dia antes de la cita",
        "enabled": True,
        "stage": "all",
        "trigger_type": "meeting_tomorrow",
        "template_message": "Hola {contact_name}! Te recordamos que tu cita {meeting_title} es MANANA {meeting_date} a las {meeting_time}. Link de acceso: {meeting_link} - Equipo Leaderlix",
        "template_variables": ["contact_name", "meeting_title", "meeting_date", "meeting_time", "meeting_link"],
    },
    {
        "id": "W03",
        "name": "Cita en 21 dias (primer contacto)",
        "description": "Primera confirmacion de cita futura - nunca contactado",
        "enabled": True,
        "stage": "all",
        "trigger_type": "meeting_21_days_new",
        "template_message": "Hola {contact_name}! Te escribo para confirmar tu cita {meeting_title} del {meeting_date} a las {meeting_time}. Todo bien para esa fecha y hora? - Equipo Leaderlix",
        "template_variables": ["contact_name", "meeting_title", "meeting_date", "meeting_time"],
    },
    {
        "id": "W04",
        "name": "Cita en 21 dias (seguimiento)",
        "description": "Seguimiento de cita futura - ya contactado antes",
        "enabled": True,
        "stage": "all",
        "trigger_type": "meeting_21_days_followup",
        "template_message": "Hola {contact_name}! Solo un recordatorio de tu cita {meeting_title} el {meeting_date} a las {meeting_time}. Te esperamos! - Equipo Leaderlix",
        "template_variables": ["contact_name", "meeting_title", "meeting_date", "meeting_time"],
    },
    # STAGE 1: PROSPECCION - New Business
    {
        "id": "W05",
        "name": "Nuevo negocio (primer contacto)",
        "description": "Primer mensaje a negocio nuevo",
        "enabled": True,
        "stage": 1,
        "trigger_type": "new_business_first",
        "template_message": "Hola, estoy escribiendo a {business_type}?",
        "template_variables": ["business_type"],
    },
    {
        "id": "W06",
        "name": "Nuevo negocio (segundo contacto)",
        "description": "Seguimiento a negocio contactado hace 10+ dias",
        "enabled": True,
        "stage": 1,
        "trigger_type": "new_business_followup",
        "template_message": "Hola que tal, me gustaria platicar sobre como podemos ayudarles. Tienes un momento?",
        "template_variables": [],
    },
    # STAGE 2: NURTURING - Webinar (W08-W09)
    {
        "id": "W08",
        "name": "Recordatorio Webinar 7 dias",
        "description": "Recordatorio 7 dias antes del webinar",
        "enabled": True,
        "stage": 2,
        "trigger_type": "webinar_7_days",
        "template_message": "Hola {contact_name}! Faltan 7 dias para el webinar {webinar_name} el {webinar_date} a las {webinar_time}. No te lo pierdas! - Equipo Leaderlix",
        "template_variables": ["contact_name", "webinar_name", "webinar_date", "webinar_time"],
    },
    {
        "id": "W09",
        "name": "Recordatorio Webinar 24h",
        "description": "Recordatorio 24 horas antes del webinar",
        "enabled": True,
        "stage": 2,
        "trigger_type": "webinar_24_hours",
        "template_message": "Hola {contact_name}! MANANA es el webinar {webinar_name} a las {webinar_time}. Link de acceso: {webinar_link} - Equipo Leaderlix",
        "template_variables": ["contact_name", "webinar_name", "webinar_time", "webinar_link"],
    },
    # STAGE 3: CLOSE - Deal Makers
    {
        "id": "W10",
        "name": "Deal Maker - Propuesta",
        "description": "Seguimiento a Deal Maker con propuesta",
        "enabled": True,
        "stage": 3,
        "trigger_type": "dealmaker_propuesta",
        "template_message": "Hola {contact_name}! Queria dar seguimiento a la propuesta que te enviamos. Tienes alguna duda o comentario? Estoy a tus ordenes. - Equipo Leaderlix",
        "template_variables": ["contact_name", "company"],
    },
    {
        "id": "W11",
        "name": "Deal Maker - Cierre Admin",
        "description": "Seguimiento administrativo de cierre",
        "enabled": True,
        "stage": 3,
        "trigger_type": "dealmaker_cierre",
        "template_message": "Hola {contact_name}! Te escribo para dar seguimiento al proceso de contratacion. Hay algo en lo que pueda apoyarte? - Equipo Leaderlix",
        "template_variables": ["contact_name", "company"],
    },
    # STAGE 4: DELIVERY - Coaching
    {
        "id": "W12",
        "name": "Coachee sin cita (8 dias)",
        "description": "Recordatorio a coachee en casos 'Ganados' sin cita programada",
        "enabled": True,
        "stage": 4,
        "trigger_type": "student_coaching",
        "template_message": "Hola {contact_name}! Ya agendaste tu proxima sesion de coaching? Estamos listos para continuar con tu desarrollo. - Equipo Leaderlix",
        "template_variables": ["contact_name"],
    },
    # STAGE 2: NURTURING - Post-webinar follow-up
    {
        "id": "W14",
        "name": "Nurturing post-webinar (sin caso activo)",
        "description": "Seguimiento a contactos que asistieron a webinar pero no tienen caso activo",
        "enabled": True,
        "stage": 2,
        "trigger_type": "nurturing_post_webinar",
        "template_message": "Cómo estás {contact_name}? te escribo porque necesito hacerte una consulta",
        "template_variables": ["contact_name"],
    },
    # STAGE 5: REPURCHASE - Alumni
    {
        "id": "W13",
        "name": "Alumni check-in (90 dias)",
        "description": "Check-in con alumni cada 90 dias",
        "enabled": True,
        "stage": 5,
        "trigger_type": "alumni_checkin",
        "template_message": "Hola {contact_name}! Te escribimos desde Leaderlix porque eres parte de nuestra comunidad. Como te ha ido aplicando lo aprendido? Nos encantaria saber de ti! - Equipo Leaderlix",
        "template_variables": ["contact_name"],
    },
]

# Stage configuration
WHATSAPP_STAGE_GROUPS = [
    {
        "stage": "all",
        "title": "All Stages",
        "description": "Confirmaciones y recordatorios de citas",
        "rules": ["W01", "W02", "W03", "W04"],
        "headerClass": "bg-gradient-to-r from-slate-500/10 to-transparent",
        "titleClass": "text-slate-400"
    },
    {
        "stage": 1,
        "title": "Stage 1 - Prospeccion",
        "description": "Nuevos negocios B2B",
        "rules": ["W05", "W06"],
        "headerClass": "bg-gradient-to-r from-cyan-500/10 to-transparent",
        "titleClass": "text-cyan-400"
    },
    {
        "stage": 2,
        "title": "Stage 2 - Nurturing",
        "description": "Webinars e invitaciones",
        "rules": ["W08", "W09", "W14"],
        "headerClass": "bg-gradient-to-r from-blue-500/10 to-transparent",
        "titleClass": "text-blue-400"
    },
    {
        "stage": 3,
        "title": "Stage 3 - Close",
        "description": "Deal Makers y cierres",
        "rules": ["W10", "W11"],
        "headerClass": "bg-gradient-to-r from-green-500/10 to-transparent",
        "titleClass": "text-green-400"
    },
    {
        "stage": 4,
        "title": "Stage 4 - Delivery",
        "description": "Coaching y entregas",
        "rules": ["W12"],
        "headerClass": "bg-gradient-to-r from-purple-500/10 to-transparent",
        "titleClass": "text-purple-400"
    },
    {
        "stage": 5,
        "title": "Stage 5 - Repurchase",
        "description": "Alumni y recompra",
        "rules": ["W13"],
        "headerClass": "bg-gradient-to-r from-yellow-500/10 to-transparent",
        "titleClass": "text-yellow-400"
    }
]


# ============ HELPER FUNCTIONS ============

def format_date_spanish(dt: datetime) -> str:
    """Format date as 'sabado 15 de febrero' in Spanish"""
    days = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo']
    months = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 
              'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
    
    day_name = days[dt.weekday()]
    month_name = months[dt.month - 1]
    return f"{day_name} {dt.day} de {month_name}"


def format_time_mexico(dt: datetime) -> str:
    """Format time as '10:00 AM (CDMX)' converted to Mexico City timezone"""
    # Convert to Mexico City timezone
    if dt.tzinfo is None:
        dt = pytz.utc.localize(dt)
    mexico_dt = dt.astimezone(MEXICO_TZ)
    
    hour = mexico_dt.hour
    minute = mexico_dt.minute
    am_pm = "AM" if hour < 12 else "PM"
    if hour > 12:
        hour -= 12
    elif hour == 0:
        hour = 12
    
    return f"{hour}:{minute:02d} {am_pm} (CDMX)"


def convert_to_mexico_tz(dt: datetime) -> datetime:
    """Convert any datetime to Mexico City timezone"""
    if dt.tzinfo is None:
        dt = pytz.utc.localize(dt)
    return dt.astimezone(MEXICO_TZ)


# ============ ENDPOINTS ============

@router.get("/")
async def get_whatsapp_rules(current_user: dict = Depends(get_current_user)):
    """Get all WhatsApp rules with their templates"""
    # Initialize rules if not exist
    existing = await db.whatsapp_rules.count_documents({})
    if existing == 0:
        await db.whatsapp_rules.insert_many(DEFAULT_WHATSAPP_RULES)
    
    rules = await db.whatsapp_rules.find({}, {"_id": 0}).to_list(100)
    
    return {
        "rules": rules,
        "stage_groups": WHATSAPP_STAGE_GROUPS
    }


@router.put("/{rule_id}")
async def update_whatsapp_rule(
    rule_id: str,
    update_data: dict,
    current_user: dict = Depends(get_current_user)
):
    """Update a WhatsApp rule template"""
    rule_id = rule_id.upper()
    
    # Only allow updating certain fields
    allowed_fields = ["template_message", "enabled", "name", "description"]
    update_dict = {k: v for k, v in update_data.items() if k in allowed_fields}
    
    if not update_dict:
        raise HTTPException(status_code=400, detail="No valid fields to update")
    
    update_dict["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    result = await db.whatsapp_rules.update_one(
        {"id": rule_id},
        {"$set": update_dict}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail=f"Rule {rule_id} not found")
    
    return {"success": True, "updated": rule_id}


@router.get("/rule/{rule_id}/pending-grouped")
async def get_whatsapp_pending_grouped(
    rule_id: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Get pending WhatsApp messages for a rule, grouped appropriately.
    - Meeting rules (W01-W04): grouped by date
    - New Business (W05-W06): grouped by business_type
    - Webinar rules (W08-W09): grouped by webinar, then buyer_persona
    - Other rules: grouped by buyer_persona
    """
    rule_id = rule_id.upper()
    now = datetime.now(timezone.utc)
    today = now.date()
    
    # Get rule info
    rule = await db.whatsapp_rules.find_one({"id": rule_id}, {"_id": 0})
    if not rule:
        raise HTTPException(status_code=404, detail=f"Rule {rule_id} not found")
    
    trigger_type = rule.get("trigger_type", "")
    groups = []
    has_subgroups = False
    
    # Get buyer personas for display names
    buyer_personas_list = await db.buyer_personas_db.find({}, {"_id": 0}).to_list(100)
    buyer_personas_db = {bp.get("id", "").lower(): bp.get("name", bp.get("id", "")) for bp in buyer_personas_list}
    
    # ============ MEETING RULES (W01-W04) ============
    if trigger_type in ["meeting_today", "meeting_tomorrow", "meeting_21_days_new", "meeting_21_days_followup"]:
        # Get from whatsapp_queue
        pending = await db.whatsapp_queue.find(
            {"rule": rule_id, "status": "pending"},
            {"_id": 0}
        ).to_list(5000)
        
        # Group by meeting date
        date_groups = {}
        for msg in pending:
            metadata = msg.get("metadata", {})
            meeting_date = metadata.get("meeting_date", "Sin fecha")
            
            if meeting_date not in date_groups:
                date_groups[meeting_date] = {
                    "group_id": meeting_date,
                    "group_type": "date",
                    "group_name": meeting_date,
                    "emails": [],
                    "count": 0,
                    "has_error": False
                }
            
            date_groups[meeting_date]["emails"].append({
                "id": msg.get("id"),
                "contact_id": msg.get("contact_id"),
                "contact_name": msg.get("contact_name", ""),
                "contact_phone": msg.get("contact_phone", ""),
                "metadata": metadata
            })
            date_groups[meeting_date]["count"] += 1
        
        groups = list(date_groups.values())
    
    # ============ NEW BUSINESS RULES (W05-W06) ============
    elif trigger_type in ["new_business_first", "new_business_followup"]:
        pending = await db.whatsapp_queue.find(
            {"rule": rule_id, "status": "pending"},
            {"_id": 0}
        ).to_list(5000)
        
        # Group by business_type
        type_groups = {}
        for msg in pending:
            metadata = msg.get("metadata", {})
            biz_type = metadata.get("business_type", "Otros")
            
            if biz_type not in type_groups:
                type_groups[biz_type] = {
                    "group_id": biz_type,
                    "group_type": "business_type",
                    "group_name": biz_type,
                    "emails": [],
                    "count": 0,
                    "has_error": False
                }
            
            type_groups[biz_type]["emails"].append({
                "id": msg.get("id"),
                "contact_id": msg.get("contact_id"),
                "contact_name": msg.get("contact_name", ""),
                "contact_phone": msg.get("contact_phone", ""),
                "metadata": metadata
            })
            type_groups[biz_type]["count"] += 1
        
        groups = list(type_groups.values())
    
    # ============ WEBINAR RULES (W08-W09) ============
    elif trigger_type in ["webinar_7_days", "webinar_24_hours"]:
        has_subgroups = True
        pending = await db.whatsapp_queue.find(
            {"rule": rule_id, "status": "pending"},
            {"_id": 0}
        ).to_list(5000)
        
        # Group by webinar, then by buyer_persona
        webinar_groups = {}
        for msg in pending:
            metadata = msg.get("metadata", {})
            webinar_id = metadata.get("webinar_id", "unknown")
            webinar_name = metadata.get("webinar_name", "Sin webinar")
            bp = metadata.get("buyer_persona", "Sin clasificar")
            bp_lower = bp.lower().strip() if bp else "sin clasificar"
            bp_display = buyer_personas_db.get(bp_lower, bp or "Sin clasificar")
            
            if webinar_id not in webinar_groups:
                webinar_groups[webinar_id] = {
                    "group_id": webinar_id,
                    "group_type": "webinar",
                    "group_name": webinar_name,
                    "group_date": metadata.get("webinar_date", ""),
                    "group_time": metadata.get("webinar_time", ""),
                    "group_link": metadata.get("webinar_link", ""),
                    "subgroups": {},
                    "count": 0,
                    "has_error": False
                }
            
            if bp_lower not in webinar_groups[webinar_id]["subgroups"]:
                webinar_groups[webinar_id]["subgroups"][bp_lower] = {
                    "subgroup_id": bp_lower,
                    "subgroup_name": bp_display,
                    "emails": [],
                    "count": 0,
                    "has_error": not bp or bp_lower == "sin clasificar"
                }
            
            webinar_groups[webinar_id]["subgroups"][bp_lower]["emails"].append({
                "id": msg.get("id"),
                "contact_id": msg.get("contact_id"),
                "contact_name": msg.get("contact_name", ""),
                "contact_phone": msg.get("contact_phone", ""),
                "metadata": metadata
            })
            webinar_groups[webinar_id]["subgroups"][bp_lower]["count"] += 1
            webinar_groups[webinar_id]["count"] += 1
        
        # Convert subgroups dict to list
        for webinar_id, webinar_data in webinar_groups.items():
            webinar_data["subgroups"] = list(webinar_data["subgroups"].values())
        
        groups = list(webinar_groups.values())
    
    # ============ W12: COACHEE - Group by Case Stage, then by Case ============
    elif trigger_type == "student_coaching":
        pending = await db.whatsapp_queue.find(
            {"rule": "W12", "status": "pending"},
            {"_id": 0}
        ).to_list(5000)
        
        # Define the two main groups
        # Group 1: Casos en curso (ganados)
        # Group 2: Casos cerrados con alumnos activos (concluidos, contenidos_transcritos, reporte_presentado, caso_publicado)
        
        casos_en_curso_stages = ["ganados"]
        casos_cerrados_stages = ["concluidos", "contenidos_transcritos", "reporte_presentado", "caso_publicado"]
        
        # Structure: { "en_curso": { case_id: {...} }, "cerrados": { case_id: {...} } }
        main_groups = {
            "en_curso": {},
            "cerrados": {}
        }
        
        for msg in pending:
            contact_id = msg.get("contact_id")
            metadata = msg.get("metadata", {})
            
            # Find the Stage 4 case where this contact is associated
            case = await db.cases.find_one({
                "status": "active",
                "stage": {"$in": casos_en_curso_stages + casos_cerrados_stages},
                "contact_ids": contact_id
            }, {"_id": 0, "id": 1, "name": 1, "company_names": 1, "stage": 1})
            
            if not case:
                continue  # Skip if no valid case found
            
            case_id = case.get("id")
            case_name = case.get("name", "Sin nombre")
            case_stage = case.get("stage", "")
            company = case.get("company_names", [""])[0] if case.get("company_names") else ""
            display_name = f"{case_name}" + (f" ({company})" if company else "")
            
            # Determine which main group
            if case_stage in casos_en_curso_stages:
                main_group_key = "en_curso"
            else:
                main_group_key = "cerrados"
            
            # Add to appropriate group (use subgroup_id/subgroup_name for frontend compatibility)
            if case_id not in main_groups[main_group_key]:
                main_groups[main_group_key][case_id] = {
                    "subgroup_id": case_id,
                    "subgroup_name": display_name,
                    "case_stage": case_stage,
                    "emails": [],
                    "count": 0
                }
            
            main_groups[main_group_key][case_id]["emails"].append({
                "id": msg.get("id"),
                "contact_id": contact_id,
                "contact_name": msg.get("contact_name", ""),
                "contact_phone": msg.get("contact_phone", ""),
                "metadata": metadata
            })
            main_groups[main_group_key][case_id]["count"] += 1
        
        # Build final groups structure with main groups containing subgroups
        groups = []
        
        # Group 1: Casos en curso
        en_curso_cases = list(main_groups["en_curso"].values())
        if en_curso_cases:
            groups.append({
                "group_id": "casos_en_curso",
                "group_type": "main_category",
                "group_name": "Casos en curso",
                "description": "Estado: Ganados",
                "subgroups": en_curso_cases,
                "count": sum(c["count"] for c in en_curso_cases),
                "has_error": False
            })
        
        # Group 2: Casos cerrados con alumnos activos
        cerrados_cases = list(main_groups["cerrados"].values())
        if cerrados_cases:
            groups.append({
                "group_id": "casos_cerrados",
                "group_type": "main_category", 
                "group_name": "Casos cerrados con alumnos activos",
                "description": "Estados: Concluidos, Transcritos, Reporte Presentado, Publicado",
                "subgroups": cerrados_cases,
                "count": sum(c["count"] for c in cerrados_cases),
                "has_error": False
            })
        
        has_subgroups = True  # W12 now has subgroups
    
    # ============ OTHER RULES (W10, W11, W13) ============
    else:
        pending = await db.whatsapp_queue.find(
            {"rule": rule_id, "status": "pending"},
            {"_id": 0}
        ).to_list(5000)
        
        # Group by buyer_persona
        bp_groups = {}
        for msg in pending:
            metadata = msg.get("metadata", {})
            bp = metadata.get("buyer_persona", "Sin clasificar")
            bp_lower = bp.lower().strip() if bp else "sin clasificar"
            bp_display = buyer_personas_db.get(bp_lower, bp or "Sin clasificar")
            
            if bp_lower not in bp_groups:
                bp_groups[bp_lower] = {
                    "group_id": bp_lower,
                    "group_type": "buyer_persona",
                    "group_name": bp_display,
                    "emails": [],
                    "count": 0,
                    "has_error": not bp or bp_lower == "sin clasificar"
                }
            
            bp_groups[bp_lower]["emails"].append({
                "id": msg.get("id"),
                "contact_id": msg.get("contact_id"),
                "contact_name": msg.get("contact_name", ""),
                "contact_phone": msg.get("contact_phone", ""),
                "metadata": metadata
            })
            bp_groups[bp_lower]["count"] += 1
        
        groups = list(bp_groups.values())
    
    return {
        "rule_id": rule_id,
        "groups": groups,
        "has_subgroups": has_subgroups,
        "total_count": sum(g["count"] for g in groups)
    }


class GenerateUrlsRequest(BaseModel):
    rule_id: str
    group_key: str
    subgroup_key: Optional[str] = None
    contact_ids: List[str]
    message: str


@router.post("/generate-urls")
async def generate_whatsapp_urls(
    request: GenerateUrlsRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Generate WhatsApp URLs for a subgroup and mark as sent.
    Returns list of wa.me URLs with personalized messages.
    """
    rule_id = request.rule_id.upper()
    
    # Get rule info
    rule = await db.whatsapp_rules.find_one({"id": rule_id}, {"_id": 0})
    if not rule:
        raise HTTPException(status_code=404, detail=f"Rule {rule_id} not found")
    
    # Get contacts from queue
    queue_items = await db.whatsapp_queue.find(
        {
            "rule": rule_id,
            "contact_id": {"$in": request.contact_ids},
            "status": "pending"
        },
        {"_id": 0}
    ).to_list(1000)
    
    urls = []
    sent_count = 0
    
    for item in queue_items:
        contact_id = item.get("contact_id")
        phone = item.get("contact_phone", "")
        metadata = item.get("metadata", {})
        
        if not phone:
            continue
        
        # Clean phone number
        phone_clean = ''.join(filter(str.isdigit, phone))
        if not phone_clean:
            continue
        
        # Get first name
        full_name = item.get("contact_name", "")
        first_name = full_name.split(" ")[0] if full_name else ""
        
        # Prepare variables for substitution
        # Ensure links have full domain
        webinar_link_raw = metadata.get("webinar_link", "")
        if webinar_link_raw and webinar_link_raw.startswith("/"):
            webinar_link = f"https://leaderlix.com{webinar_link_raw}"
        elif webinar_link_raw and not webinar_link_raw.startswith("http"):
            webinar_link = f"https://leaderlix.com/{webinar_link_raw}"
        else:
            webinar_link = webinar_link_raw or "[Sin link de acceso]"
        
        variables = {
            "contact_name": first_name,
            "company": metadata.get("company", ""),
            "business_type": metadata.get("business_type", ""),
            "meeting_title": metadata.get("meeting_title", ""),
            "meeting_date": metadata.get("meeting_date", ""),
            "meeting_time": metadata.get("meeting_time", ""),
            "meeting_link": metadata.get("meeting_link", "[Sin link de acceso]"),
            "webinar_name": metadata.get("webinar_name", ""),
            "webinar_date": metadata.get("webinar_date", ""),
            "webinar_time": metadata.get("webinar_time", ""),
            "webinar_link": webinar_link,
        }
        
        # Replace variables in message
        message = request.message
        for key, value in variables.items():
            message = message.replace(f"{{{key}}}", str(value) if value else "")
        
        # Generate WhatsApp URL
        import urllib.parse
        encoded_message = urllib.parse.quote(message)
        wa_url = f"https://wa.me/{phone_clean}?text={encoded_message}"
        
        urls.append({
            "contact_id": contact_id,
            "contact_name": full_name,
            "phone": phone,
            "url": wa_url,
            "message_preview": message[:100] + "..." if len(message) > 100 else message
        })
        
        # Mark as sent in queue
        await db.whatsapp_queue.update_one(
            {"id": item.get("id")},
            {"$set": {
                "status": "sent",
                "sent_at": datetime.now(timezone.utc).isoformat(),
                "sent_by": current_user.get("email")
            }}
        )
        
        # Log the sent message
        await db.whatsapp_logs.insert_one({
            "id": str(uuid.uuid4()),
            "contact_id": contact_id,
            "contact_phone": phone,
            "rule": rule_id,
            "message": message,
            "status": "sent",
            "sent_at": datetime.now(timezone.utc).isoformat(),
            "sent_by": current_user.get("email"),
            "group_key": request.group_key,
            "subgroup_key": request.subgroup_key
        })
        
        # Update contact's last whatsapp sent
        await db.unified_contacts.update_one(
            {"id": contact_id},
            {"$set": {
                "last_contacted_whatsapp": datetime.now(timezone.utc).isoformat(),
                f"last_whatsapp_{rule_id.lower()}_sent": datetime.now(timezone.utc).isoformat()
            }}
        )
        
        # For businesses, update small_businesses collection
        if metadata.get("contact_type") == "business":
            await db.small_businesses.update_one(
                {"id": contact_id},
                {"$set": {
                    "whatsapp_contacted": True,
                    "last_contacted_at": datetime.now(timezone.utc).isoformat(),
                    "contact_count": (item.get("contact_count", 0) or 0) + 1
                }}
            )
        
        sent_count += 1
    
    return {
        "success": True,
        "urls": urls,
        "sent_count": sent_count,
        "total": len(request.contact_ids)
    }


# ============ GEMINI MESSAGE VARIATION ============

async def generate_varied_message_gemini(
    template: str,
    variables: dict,
    rule_id: str
) -> str:
    """
    Generate a slightly varied version of the template message using Gemini.
    Keeps the same meaning and emotion but changes words/order to avoid spam detection.
    """
    import logging
    logger = logging.getLogger(__name__)
    
    api_key = os.environ.get("EMERGENT_LLM_KEY")
    if not api_key:
        # Fallback to original template
        message = template
        for key, value in variables.items():
            message = message.replace(f"{{{key}}}", str(value) if value else "")
        return message
    
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage
        
        # First, substitute variables in template to get the base message
        base_message = template
        for key, value in variables.items():
            base_message = base_message.replace(f"{{{key}}}", str(value) if value else "")
        
        prompt = f"""Reescribe este mensaje de WhatsApp manteniendo EXACTAMENTE el mismo significado, tono y emoción, pero cambiando ligeramente las palabras o el orden.

MENSAJE ORIGINAL:
{base_message}

REGLAS ESTRICTAS:
1. MANTENER el mismo significado y toda la información (nombres, fechas, links, etc.)
2. MANTENER el mismo tono (amable, profesional)
3. MANTENER la misma longitud aproximada
4. CAMBIAR algunas palabras por sinónimos o reorganizar frases
5. NO agregar ni quitar información
6. NO usar emojis
7. MANTENER la firma "- Equipo Leaderlix" o similar si existe
8. Responder ÚNICAMENTE con el mensaje reescrito, sin explicaciones

MENSAJE REESCRITO:"""

        chat = LlmChat(
            api_key=api_key,
            session_id=f"whatsapp-var-{uuid.uuid4()}",
            system_message="Eres un asistente que reescribe mensajes de WhatsApp manteniendo el mismo significado pero variando las palabras. Respondes SOLO con el mensaje reescrito, sin explicaciones."
        ).with_model("gemini", "gemini-2.5-flash")
        
        user_message = UserMessage(text=prompt)
        response = await chat.send_message(user_message)
        
        # Clean up response
        varied_message = response.strip()
        varied_message = varied_message.replace("**", "").replace("*", "")
        
        # Remove any meta-comments
        lines = varied_message.split('\n')
        cleaned_lines = [l for l in lines if not l.strip().startswith(('Nota:', 'NOTA:', 'Importante:', '(', 'Aquí', 'Este'))]
        varied_message = '\n'.join(cleaned_lines).strip()
        
        # If response seems wrong (too short or too long), use original
        if len(varied_message) < len(base_message) * 0.5 or len(varied_message) > len(base_message) * 2:
            return base_message
        
        return varied_message
        
    except Exception as e:
        logger.error(f"Error generating varied message with Gemini: {e}")
        # Fallback to original template
        message = template
        for key, value in variables.items():
            message = message.replace(f"{{{key}}}", str(value) if value else "")
        return message


class PreviewVariedMessagesRequest(BaseModel):
    template_message: str
    sample_contacts: List[dict]  # List of {contact_name, company, ...}
    num_previews: int = 3


@router.post("/preview-varied-messages")
async def preview_varied_messages(
    request: PreviewVariedMessagesRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Generate preview of varied messages without sending or marking as sent.
    Returns sample variations to show user how messages will look.
    """
    previews = []
    
    # Take up to num_previews contacts
    sample_contacts = request.sample_contacts[:request.num_previews]
    
    for contact in sample_contacts:
        # Build variables from contact data
        full_name = contact.get("contact_name", "")
        first_name = full_name.split(" ")[0] if full_name else ""
        
        variables = {
            "contact_name": first_name,
            "company": contact.get("company", ""),
            "business_type": contact.get("business_type", ""),
            "meeting_title": contact.get("meeting_title", ""),
            "meeting_date": contact.get("meeting_date", ""),
            "meeting_time": contact.get("meeting_time", ""),
            "meeting_link": contact.get("meeting_link", "[Sin link]"),
            "webinar_name": contact.get("webinar_name", ""),
            "webinar_date": contact.get("webinar_date", ""),
            "webinar_time": contact.get("webinar_time", ""),
            "webinar_link": contact.get("webinar_link", "[Sin link]"),
        }
        
        # Generate varied message
        varied_message = await generate_varied_message_gemini(
            request.template_message,
            variables,
            "PREVIEW"
        )
        
        # Also generate the original (non-varied) for comparison
        original_message = request.template_message
        for key, value in variables.items():
            original_message = original_message.replace(f"{{{key}}}", str(value) if value else "")
        
        previews.append({
            "contact_name": full_name,
            "original_message": original_message,
            "varied_message": varied_message
        })
    
    return {
        "success": True,
        "previews": previews,
        "note": "Cada mensaje será diferente cuando se generen las URLs finales"
    }


class GenerateVariedUrlsRequest(BaseModel):
    rule_id: str
    group_key: str
    subgroup_key: Optional[str] = None
    contact_ids: List[str]
    template_message: str


@router.post("/generate-varied-urls")
async def generate_varied_whatsapp_urls(
    request: GenerateVariedUrlsRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Generate WhatsApp URLs with AI-varied messages for each contact.
    Uses Gemini to slightly vary each message to avoid spam detection.
    Returns progress updates via the response.
    """
    import urllib.parse
    
    rule_id = request.rule_id.upper()
    
    # Get rule info
    rule = await db.whatsapp_rules.find_one({"id": rule_id}, {"_id": 0})
    if not rule:
        raise HTTPException(status_code=404, detail=f"Rule {rule_id} not found")
    
    # Get contacts from queue
    queue_items = await db.whatsapp_queue.find(
        {
            "rule": rule_id,
            "contact_id": {"$in": request.contact_ids},
            "status": "pending"
        },
        {"_id": 0}
    ).to_list(1000)
    
    urls = []
    sent_count = 0
    total = len(queue_items)
    
    for index, item in enumerate(queue_items):
        contact_id = item.get("contact_id")
        phone = item.get("contact_phone", "")
        metadata = item.get("metadata", {})
        
        if not phone:
            continue
        
        # Clean phone number
        phone_clean = ''.join(filter(str.isdigit, phone))
        if not phone_clean:
            continue
        
        # Get first name
        full_name = item.get("contact_name", "")
        first_name = full_name.split(" ")[0] if full_name else ""
        
        # Prepare variables for substitution
        webinar_link_raw = metadata.get("webinar_link", "")
        if webinar_link_raw and webinar_link_raw.startswith("/"):
            webinar_link = f"https://leaderlix.com{webinar_link_raw}"
        elif webinar_link_raw and not webinar_link_raw.startswith("http"):
            webinar_link = f"https://leaderlix.com/{webinar_link_raw}"
        else:
            webinar_link = webinar_link_raw or "[Sin link de acceso]"
        
        variables = {
            "contact_name": first_name,
            "company": metadata.get("company", ""),
            "business_type": metadata.get("business_type", ""),
            "meeting_title": metadata.get("meeting_title", ""),
            "meeting_date": metadata.get("meeting_date", ""),
            "meeting_time": metadata.get("meeting_time", ""),
            "meeting_link": metadata.get("meeting_link", "[Sin link de acceso]"),
            "webinar_name": metadata.get("webinar_name", ""),
            "webinar_date": metadata.get("webinar_date", ""),
            "webinar_time": metadata.get("webinar_time", ""),
            "webinar_link": webinar_link,
        }
        
        # Generate varied message with Gemini
        message = await generate_varied_message_gemini(
            request.template_message,
            variables,
            rule_id
        )
        
        # Generate WhatsApp URL
        encoded_message = urllib.parse.quote(message)
        wa_url = f"https://wa.me/{phone_clean}?text={encoded_message}"
        
        urls.append({
            "contact_id": contact_id,
            "contact_name": full_name,
            "phone": phone,
            "url": wa_url,
            "message_preview": message[:100] + "..." if len(message) > 100 else message,
            "progress": {
                "current": index + 1,
                "total": total
            }
        })
        
        # Mark as sent in queue
        await db.whatsapp_queue.update_one(
            {"id": item.get("id")},
            {"$set": {
                "status": "sent",
                "sent_at": datetime.now(timezone.utc).isoformat(),
                "sent_by": current_user.get("email"),
                "varied_message": True
            }}
        )
        
        # Log the sent message
        await db.whatsapp_logs.insert_one({
            "id": str(uuid.uuid4()),
            "contact_id": contact_id,
            "contact_phone": phone,
            "rule": rule_id,
            "message": message,
            "varied": True,
            "status": "sent",
            "sent_at": datetime.now(timezone.utc).isoformat(),
            "sent_by": current_user.get("email"),
            "group_key": request.group_key,
            "subgroup_key": request.subgroup_key
        })
        
        # Update contact's last whatsapp sent
        await db.unified_contacts.update_one(
            {"id": contact_id},
            {"$set": {
                "last_contacted_whatsapp": datetime.now(timezone.utc).isoformat(),
                f"last_whatsapp_{rule_id.lower()}_sent": datetime.now(timezone.utc).isoformat()
            }}
        )
        
        # For businesses, update small_businesses collection
        if metadata.get("contact_type") == "business":
            await db.small_businesses.update_one(
                {"id": contact_id},
                {"$set": {
                    "last_contacted_whatsapp": datetime.now(timezone.utc).isoformat()
                }}
            )
        
        sent_count += 1
    
    return {
        "success": True,
        "urls": urls,
        "sent_count": sent_count,
        "total": total,
        "varied": True
    }


# Snooze durations per rule (in days)
RULE_SNOOZE_DAYS = {
    "W01": 1,   # Cita hoy - snooze 1 día
    "W02": 1,   # Cita mañana - snooze 1 día
    "W03": 7,   # Cita próximos días (primer contacto) - snooze 7 días
    "W04": 7,   # Cita próximos días (followup) - snooze 7 días
    "W05": 7,   # New business first contact - snooze 7 días
    "W06": 7,   # New business followup - snooze 7 días
    "W08": 2,   # Webinar 3 días antes - snooze 2 días
    "W09": 1,   # Webinar 1 día antes - snooze 1 día
    "W10": 15,  # Deal Maker Propuesta - snooze 15 días
    "W11": 15,  # Deal Maker Cierre - snooze 15 días
    "W12": 8,   # Coachee sin cita - snooze 8 días
    "W13": 90,  # Alumni check-in - snooze 90 días
}


class SnoozeRequest(BaseModel):
    contact_id: str
    rule_id: str
    queue_item_id: Optional[str] = None


@router.post("/snooze")
async def snooze_contact(
    request: SnoozeRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Snooze a contact for a specific rule.
    Removes from queue and sets a "snoozed until" date based on rule duration.
    """
    rule_id = request.rule_id.upper()
    contact_id = request.contact_id
    
    snooze_days = RULE_SNOOZE_DAYS.get(rule_id, 7)  # Default 7 days
    now = datetime.now(timezone.utc)
    snooze_until = now + timedelta(days=snooze_days)
    
    # Remove from queue (if queue_item_id provided, use it; otherwise find by contact+rule)
    if request.queue_item_id:
        await db.whatsapp_queue.delete_one({"id": request.queue_item_id})
    else:
        await db.whatsapp_queue.delete_one({
            "contact_id": contact_id,
            "rule": rule_id,
            "status": "pending"
        })
    
    # Update contact with snooze timestamp for this rule
    snooze_field = f"whatsapp_snoozed_{rule_id.lower()}"
    await db.unified_contacts.update_one(
        {"id": contact_id},
        {"$set": {snooze_field: snooze_until.isoformat()}}
    )
    
    # Also log the snooze action
    await db.whatsapp_logs.insert_one({
        "id": str(uuid.uuid4()),
        "rule": rule_id,
        "contact_id": contact_id,
        "action": "snoozed",
        "snoozed_until": snooze_until.isoformat(),
        "snoozed_at": now.isoformat(),
        "snoozed_by": current_user.get("email", "unknown")
    })
    
    return {
        "success": True,
        "snoozed_until": snooze_until.isoformat(),
        "snooze_days": snooze_days,
        "message": f"Contacto postergado por {snooze_days} días"
    }


@router.get("/traffic-light-status")
async def get_whatsapp_traffic_light(current_user: dict = Depends(get_current_user)):
    """
    Get traffic light status for WhatsApp follow-up.
    - Red: No messages sent today (but there are pending)
    - Yellow: Some messages sent but more pending
    - Green: All today's messages have been sent
    """
    now = datetime.now(timezone.utc)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    today_end = now.replace(hour=23, minute=59, second=59)
    
    # Count pending messages
    pending_count = await db.whatsapp_queue.count_documents({
        "status": "pending"
    })
    
    # Count sent today
    sent_today = await db.whatsapp_logs.count_documents({
        "status": "sent",
        "sent_at": {"$gte": today_start.isoformat(), "$lte": today_end.isoformat()}
    })
    
    if pending_count == 0:
        status = "green"
    elif sent_today > 0:
        status = "yellow"
    else:
        status = "red"
    
    return {
        "status": status,
        "pending": pending_count,
        "sent_today": sent_today
    }


@router.get("/pending-counts")
async def get_all_pending_counts(current_user: dict = Depends(get_current_user)):
    """Get pending counts for all WhatsApp rules"""
    pipeline = [
        {"$match": {"status": "pending"}},
        {"$group": {"_id": "$rule", "count": {"$sum": 1}}}
    ]
    
    results = await db.whatsapp_queue.aggregate(pipeline).to_list(100)
    counts = {r["_id"]: r["count"] for r in results}
    
    return {"counts": counts}


@router.post("/generate-queue")
async def generate_whatsapp_queue(current_user: dict = Depends(get_current_user)):
    """
    Generate WhatsApp queue based on current contacts and rules.
    This populates the whatsapp_queue collection with pending messages.
    """
    now = datetime.now(timezone.utc)
    today = now.date()
    generated_count = 0
    
    # Get all enabled rules
    rules = await db.whatsapp_rules.find({"enabled": True}, {"_id": 0}).to_list(100)
    
    for rule in rules:
        rule_id = rule.get("id")
        trigger_type = rule.get("trigger_type")
        
        # ============ CLEANUP W12: Always run cleanup regardless of generation date ============
        if trigger_type == "student_coaching":
            stage_4_case_stages = ["ganados", "concluidos", "contenidos_transcritos", "reporte_presentado", "caso_publicado"]
            
            existing_w12_items = await db.whatsapp_queue.find(
                {"rule": "W12", "status": "pending"},
                {"_id": 0, "contact_id": 1}
            ).to_list(5000)
            
            if existing_w12_items:
                # Get all Stage 4 cases
                valid_cases = await db.cases.find({
                    "status": "active",
                    "stage": {"$in": stage_4_case_stages},
                    "contact_ids": {"$exists": True, "$ne": []}
                }, {"_id": 0, "contact_ids": 1}).to_list(1000)
                
                valid_contact_ids = set()
                for case in valid_cases:
                    for cid in case.get("contact_ids", []):
                        valid_contact_ids.add(cid)
                
                items_to_remove = []
                for item in existing_w12_items:
                    contact_id = item.get("contact_id")
                    
                    # Check if contact still meets criteria
                    if contact_id not in valid_contact_ids:
                        items_to_remove.append(contact_id)
                        continue
                    
                    # Check if contact still has role coachee and is in stage 4
                    contact = await db.unified_contacts.find_one(
                        {"id": contact_id},
                        {"_id": 0, "roles": 1, "stage": 1}
                    )
                    
                    if not contact:
                        items_to_remove.append(contact_id)
                        continue
                    
                    has_coachee = "coachee" in (contact.get("roles") or [])
                    is_stage_4 = contact.get("stage") == 4
                    
                    if not has_coachee or not is_stage_4:
                        items_to_remove.append(contact_id)
                
                # Remove invalid items
                if items_to_remove:
                    await db.whatsapp_queue.delete_many({
                        "rule": "W12",
                        "status": "pending",
                        "contact_id": {"$in": items_to_remove}
                    })
        
        # Skip generation if already generated today for this rule
        existing_today = await db.whatsapp_queue.count_documents({
            "rule": rule_id,
            "generated_date": today.isoformat()
        })
        
        if existing_today > 0:
            continue
        
        contacts_to_add = []
        
        # ============ GENERATE BASED ON TRIGGER TYPE ============
        
        if trigger_type == "alumni_checkin":
            # Stage 5: Alumni check-in every 90 days
            ninety_days_ago = (now - timedelta(days=90)).isoformat()
            contacts = await db.unified_contacts.find({
                "stage": 5,
                "email": {"$not": {"$regex": "@leaderlix\\.com$", "$options": "i"}},
                "$or": [
                    {"last_contacted_whatsapp": {"$lt": ninety_days_ago}},
                    {"last_contacted_whatsapp": {"$exists": False}},
                    {"last_contacted_whatsapp": None}
                ]
            }, {"_id": 0}).to_list(1000)
            
            for c in contacts:
                contacts_to_add.append({
                    "contact_id": c.get("id"),
                    "contact_name": c.get("name", ""),
                    "contact_phone": c.get("phone", ""),
                    "email": c.get("email", ""),
                    "metadata": {
                        "buyer_persona": c.get("buyer_persona", ""),
                        "company": c.get("company", "")
                    }
                })
        
        elif trigger_type == "student_coaching":
            # W12: Coachees in Stage 4 cases without contact in 8 days
            # Cleanup is done above, before the "existing_today" check
            eight_days_ago = (now - timedelta(days=8)).isoformat()
            
            stage_4_case_stages = ["ganados", "concluidos", "contenidos_transcritos", "reporte_presentado", "caso_publicado"]
            
            # Get all cases in Stage 4
            cases = await db.cases.find({
                "status": "active",
                "stage": {"$in": stage_4_case_stages},
                "contact_ids": {"$exists": True, "$ne": []}
            }, {"_id": 0, "contact_ids": 1, "name": 1, "company_names": 1, "stage": 1}).to_list(1000)
            
            # Collect contact IDs from these cases
            contact_ids_in_stage4 = set()
            case_info = {}
            for case in cases:
                for contact_id in case.get("contact_ids", []):
                    contact_ids_in_stage4.add(contact_id)
                    # Store case info (keep the one with earliest stage if multiple)
                    if contact_id not in case_info:
                        case_info[contact_id] = {
                            "case_name": case.get("name", ""),
                            "case_stage": case.get("stage", ""),
                            "company": case.get("company_names", [""])[0] if case.get("company_names") else ""
                        }
            
            if contact_ids_in_stage4:
                # Get contacts with role "coachee", stage 4 (exclude stage 5), not contacted in 8 days
                contacts = await db.unified_contacts.find({
                    "id": {"$in": list(contact_ids_in_stage4)},
                    "roles": "coachee",
                    "stage": 4,  # Only contact stage 4, exclude stage 5
                    "email": {"$not": {"$regex": "@leaderlix\\.com$", "$options": "i"}},
                    "$or": [
                        {"last_contacted_whatsapp": {"$lt": eight_days_ago}},
                        {"last_contacted_whatsapp": {"$exists": False}},
                        {"last_contacted_whatsapp": None}
                    ]
                }, {"_id": 0}).to_list(1000)
                
                for c in contacts:
                    contact_id = c.get("id")
                    info = case_info.get(contact_id, {})
                    contacts_to_add.append({
                        "contact_id": contact_id,
                        "contact_name": c.get("name", ""),
                        "contact_phone": c.get("phone", ""),
                        "email": c.get("email", ""),
                        "metadata": {
                            "buyer_persona": c.get("buyer_persona", ""),
                            "company": info.get("company", c.get("company", "")),
                            "case_name": info.get("case_name", ""),
                            "case_stage": info.get("case_stage", "")
                        }
                    })
        
        elif trigger_type == "dealmaker_propuesta":
            # W10: Contacts in cases with quotes, stage "caso_presentado" or "interes_en_caso"
            # Only contact every 15 days
            fifteen_days_ago = (now - timedelta(days=15)).isoformat()
            
            # Get active cases with quotes in the target stages
            cases = await db.cases.find({
                "status": "active",
                "stage": {"$in": ["caso_presentado", "interes_en_caso"]},
                "quotes": {"$exists": True, "$ne": []},
                "contact_ids": {"$exists": True, "$ne": []}
            }, {"_id": 0, "contact_ids": 1, "name": 1, "company_names": 1}).to_list(1000)
            
            # Collect all contact IDs from these cases
            contact_ids_with_quotes = set()
            case_info = {}  # Store case info for metadata
            for case in cases:
                for contact_id in case.get("contact_ids", []):
                    contact_ids_with_quotes.add(contact_id)
                    case_info[contact_id] = {
                        "case_name": case.get("name", ""),
                        "company": case.get("company_names", [""])[0] if case.get("company_names") else ""
                    }
            
            if contact_ids_with_quotes:
                # Get contacts that haven't been contacted in 15 days
                # Using the rule-specific field: last_whatsapp_w10_sent
                contacts = await db.unified_contacts.find({
                    "id": {"$in": list(contact_ids_with_quotes)},
                    "email": {"$not": {"$regex": "@leaderlix\\.com$", "$options": "i"}},
                    "$or": [
                        {"last_whatsapp_w10_sent": {"$lt": fifteen_days_ago}},
                        {"last_whatsapp_w10_sent": {"$exists": False}},
                        {"last_whatsapp_w10_sent": None}
                    ]
                }, {"_id": 0}).to_list(1000)
                
                for c in contacts:
                    contact_id = c.get("id")
                    info = case_info.get(contact_id, {})
                    contacts_to_add.append({
                        "contact_id": contact_id,
                        "contact_name": c.get("name", ""),
                        "contact_phone": c.get("phone", ""),
                        "email": c.get("email", ""),
                        "metadata": {
                            "buyer_persona": c.get("buyer_persona", ""),
                            "company": info.get("company", c.get("company", "")),
                            "case_name": info.get("case_name", "")
                        }
                    })
        
        elif trigger_type == "dealmaker_cierre":
            # W11: Contacts in cases with quotes, stage "cierre_administrativo"
            # Only contact every 15 days
            fifteen_days_ago = (now - timedelta(days=15)).isoformat()
            
            # Get active cases with quotes in cierre_administrativo stage
            cases = await db.cases.find({
                "status": "active",
                "stage": "cierre_administrativo",
                "quotes": {"$exists": True, "$ne": []},
                "contact_ids": {"$exists": True, "$ne": []}
            }, {"_id": 0, "contact_ids": 1, "name": 1, "company_names": 1}).to_list(1000)
            
            # Collect all contact IDs from these cases
            contact_ids_with_quotes = set()
            case_info = {}  # Store case info for metadata
            for case in cases:
                for contact_id in case.get("contact_ids", []):
                    contact_ids_with_quotes.add(contact_id)
                    case_info[contact_id] = {
                        "case_name": case.get("name", ""),
                        "company": case.get("company_names", [""])[0] if case.get("company_names") else ""
                    }
            
            if contact_ids_with_quotes:
                # Get contacts that haven't been contacted in 15 days
                # Using the rule-specific field: last_whatsapp_w11_sent
                contacts = await db.unified_contacts.find({
                    "id": {"$in": list(contact_ids_with_quotes)},
                    "email": {"$not": {"$regex": "@leaderlix\\.com$", "$options": "i"}},
                    "$or": [
                        {"last_whatsapp_w11_sent": {"$lt": fifteen_days_ago}},
                        {"last_whatsapp_w11_sent": {"$exists": False}},
                        {"last_whatsapp_w11_sent": None}
                    ]
                }, {"_id": 0}).to_list(1000)
                
                for c in contacts:
                    contact_id = c.get("id")
                    info = case_info.get(contact_id, {})
                    contacts_to_add.append({
                        "contact_id": contact_id,
                        "contact_name": c.get("name", ""),
                        "contact_phone": c.get("phone", ""),
                        "email": c.get("email", ""),
                        "metadata": {
                            "buyer_persona": c.get("buyer_persona", ""),
                            "company": info.get("company", c.get("company", "")),
                            "case_name": info.get("case_name", "")
                        }
                    })
        
        elif trigger_type == "nurturing_post_webinar":
            # W14: Stage 2 contacts with webinar history, webinar already passed,
            # not associated to active cases in stage 3 or 4, with phone
            # Recurrence: every 14 days
            fourteen_days_ago = (now - timedelta(days=14)).isoformat()
            today_str_date = today.strftime("%Y-%m-%d")
            
            # Stage 3 and 4 case stages (active cases to exclude)
            active_case_stages = [
                "caso_solicitado", "caso_presentado", "interes_en_caso", 
                "cierre_administrativo", "ganados"
            ]
            
            # Get all contact IDs that are in active cases (stage 3 or 4)
            active_cases = await db.cases.find({
                "status": "active",
                "stage": {"$in": active_case_stages},
                "contact_ids": {"$exists": True, "$ne": []}
            }, {"_id": 0, "contact_ids": 1}).to_list(10000)
            
            contacts_in_active_cases = set()
            for case in active_cases:
                for cid in case.get("contact_ids", []):
                    contacts_in_active_cases.add(cid)
            
            # Get webinars that have already passed
            past_webinars = await db.webinar_events_v2.find({
                "webinar_date": {"$lt": today_str_date}
            }, {"_id": 0, "id": 1, "name": 1, "webinar_date": 1}).to_list(1000)
            
            past_webinar_ids = {w["id"] for w in past_webinars}
            past_webinar_info = {w["id"]: {"name": w.get("name", ""), "date": w.get("webinar_date", "")} for w in past_webinars}
            
            # Get stage 2 contacts with phone and webinar_history
            contacts = await db.unified_contacts.find({
                "stage": 2,
                "phone": {"$exists": True, "$nin": [None, ""]},
                "webinar_history": {"$exists": True, "$nin": [[], None]},
                "email": {"$not": {"$regex": "@leaderlix\\.com$", "$options": "i"}},
                "$or": [
                    {"last_whatsapp_w14_sent": {"$lt": fourteen_days_ago}},
                    {"last_whatsapp_w14_sent": {"$exists": False}},
                    {"last_whatsapp_w14_sent": None}
                ]
            }, {"_id": 0}).to_list(5000)
            
            for c in contacts:
                contact_id = c.get("id")
                
                # Skip if contact is in an active case
                if contact_id in contacts_in_active_cases:
                    continue
                
                # Check if any webinar in their history has already passed
                webinar_history = c.get("webinar_history", [])
                has_past_webinar = False
                last_webinar_info = None
                
                for wh in webinar_history:
                    event_id = wh.get("event_id")
                    if event_id in past_webinar_ids:
                        has_past_webinar = True
                        last_webinar_info = past_webinar_info.get(event_id, {})
                        break
                
                if not has_past_webinar:
                    continue
                
                contacts_to_add.append({
                    "contact_id": contact_id,
                    "contact_name": c.get("name", ""),
                    "contact_phone": c.get("phone", ""),
                    "email": c.get("email", ""),
                    "metadata": {
                        "buyer_persona": c.get("buyer_persona", ""),
                        "company": c.get("company", ""),
                        "last_webinar": last_webinar_info.get("name", "") if last_webinar_info else "",
                        "last_webinar_date": last_webinar_info.get("date", "") if last_webinar_info else ""
                    }
                })
        
        elif trigger_type == "new_business_first":
            # New businesses never contacted
            businesses = await db.small_businesses.find({
                "contact_count": {"$in": [0, None]},
                "$or": [
                    {"whatsapp_contacted": {"$ne": True}},
                    {"whatsapp_contacted": {"$exists": False}}
                ]
            }, {"_id": 0}).to_list(500)
            
            for b in businesses:
                phone = b.get("phone") or b.get("formatted_phone_number")
                if phone:
                    contacts_to_add.append({
                        "contact_id": b.get("id"),
                        "contact_name": b.get("name", ""),
                        "contact_phone": phone,
                        "contact_type": "business",
                        "metadata": {
                            "business_type": b.get("business_type", "negocio"),
                            "city": b.get("city", "")
                        }
                    })
        
        elif trigger_type == "new_business_followup":
            # Businesses contacted once, 10+ days ago
            ten_days_ago = (now - timedelta(days=10)).isoformat()
            businesses = await db.small_businesses.find({
                "contact_count": 1,
                "last_contacted_at": {"$lt": ten_days_ago}
            }, {"_id": 0}).to_list(500)
            
            for b in businesses:
                phone = b.get("phone") or b.get("formatted_phone_number")
                if phone:
                    contacts_to_add.append({
                        "contact_id": b.get("id"),
                        "contact_name": b.get("name", ""),
                        "contact_phone": phone,
                        "contact_type": "business",
                        "metadata": {
                            "business_type": b.get("business_type", "negocio"),
                            "city": b.get("city", "")
                        }
                    })
        
        elif trigger_type == "nurturing_post_webinar":
            # W14: Stage 2 contacts with webinar history, webinar already passed,
            # not associated to active cases in stage 3 or 4, with phone
            # Recurrence: every 14 days
            fourteen_days_ago = (now - timedelta(days=14)).isoformat()
            today_str_date = today.strftime("%Y-%m-%d")
            
            # Stage 3 and 4 case stages (active cases to exclude)
            active_case_stages = [
                "caso_solicitado", "caso_presentado", "interes_en_caso", 
                "cierre_administrativo", "ganados"
            ]
            
            # Get all contact IDs that are in active cases (stage 3 or 4)
            active_cases = await db.cases.find({
                "status": "active",
                "stage": {"$in": active_case_stages},
                "contact_ids": {"$exists": True, "$ne": []}
            }, {"_id": 0, "contact_ids": 1}).to_list(10000)
            
            contacts_in_active_cases = set()
            for case in active_cases:
                for cid in case.get("contact_ids", []):
                    contacts_in_active_cases.add(cid)
            
            # Get webinars that have already passed
            past_webinars = await db.webinar_events_v2.find({
                "webinar_date": {"$lt": today_str_date}
            }, {"_id": 0, "id": 1, "name": 1, "webinar_date": 1}).to_list(1000)
            
            past_webinar_ids = {w["id"] for w in past_webinars}
            past_webinar_info = {w["id"]: {"name": w.get("name", ""), "date": w.get("webinar_date", "")} for w in past_webinars}
            
            # Get stage 2 contacts with phone and webinar_history
            contacts = await db.unified_contacts.find({
                "stage": 2,
                "phone": {"$exists": True, "$nin": [None, ""]},
                "webinar_history": {"$exists": True, "$nin": [[], None]},
                "email": {"$not": {"$regex": "@leaderlix\\.com$", "$options": "i"}},
                "$or": [
                    {"last_whatsapp_w14_sent": {"$lt": fourteen_days_ago}},
                    {"last_whatsapp_w14_sent": {"$exists": False}},
                    {"last_whatsapp_w14_sent": None}
                ]
            }, {"_id": 0}).to_list(5000)
            
            for c in contacts:
                contact_id = c.get("id")
                
                # Skip if contact is in an active case
                if contact_id in contacts_in_active_cases:
                    continue
                
                # Check if any webinar in their history has already passed
                webinar_history = c.get("webinar_history", [])
                has_past_webinar = False
                last_webinar_info = None
                
                for wh in webinar_history:
                    event_id = wh.get("event_id")
                    if event_id in past_webinar_ids:
                        has_past_webinar = True
                        last_webinar_info = past_webinar_info.get(event_id, {})
                        break
                
                if not has_past_webinar:
                    continue
                
                contacts_to_add.append({
                    "contact_id": contact_id,
                    "contact_name": c.get("name", ""),
                    "contact_phone": c.get("phone", ""),
                    "email": c.get("email", ""),
                    "metadata": {
                        "buyer_persona": c.get("buyer_persona", ""),
                        "company": c.get("company", ""),
                        "last_webinar": last_webinar_info.get("name", "") if last_webinar_info else "",
                        "last_webinar_date": last_webinar_info.get("date", "") if last_webinar_info else ""
                    }
                })
        
        # Add contacts to queue
        today_str = today.isoformat()
        for contact in contacts_to_add:
            # FILTER: Skip @leaderlix.com emails
            contact_email = contact.get("email") or ""
            contact_email = contact_email.lower() if contact_email else ""
            if contact_email.endswith('@leaderlix.com'):
                continue
            
            contact_id = contact["contact_id"]
            
            # Check if already in queue (pending)
            existing = await db.whatsapp_queue.find_one({
                "rule": rule_id,
                "contact_id": contact_id,
                "status": "pending"
            })
            
            if existing:
                continue
            
            # Check if already SENT today
            already_sent = await db.whatsapp_queue.find_one({
                "rule": rule_id,
                "contact_id": contact_id,
                "status": "sent",
                "generated_date": today_str
            })
            
            if already_sent:
                continue
            
            # Check snooze field
            snooze_field = f"whatsapp_snoozed_{rule_id.lower()}"
            contact_doc = await db.unified_contacts.find_one(
                {"id": contact_id},
                {"_id": 0, snooze_field: 1}
            )
            if contact_doc:
                snoozed_until = contact_doc.get(snooze_field)
                if snoozed_until:
                    try:
                        snooze_dt = datetime.fromisoformat(snoozed_until.replace('Z', '+00:00'))
                        if snooze_dt > now:
                            # Still snoozed, skip
                            continue
                    except:
                        pass
            
            # Add to queue
            await db.whatsapp_queue.insert_one({
                "id": str(uuid.uuid4()),
                "rule": rule_id,
                "contact_id": contact_id,
                "contact_name": contact["contact_name"],
                "contact_phone": contact["contact_phone"],
                "contact_type": contact.get("contact_type", "contact"),
                "status": "pending",
                "metadata": contact.get("metadata", {}),
                "generated_date": today_str,
                "created_at": now.isoformat()
            })
            generated_count += 1
    
    # Get cleanup stats for W12
    w12_pending = await db.whatsapp_queue.count_documents({"rule": "W12", "status": "pending"})
    
    return {
        "success": True,
        "generated_count": generated_count,
        "w12_pending": w12_pending,
        "message": f"Generados: {generated_count}, W12 pendientes: {w12_pending}"
    }


@router.post("/generate-calendar-queue")
async def generate_calendar_queue(current_user: dict = Depends(get_current_user)):
    """
    Generate WhatsApp queue for appointment reminders (W01-W04) based on Google Calendar events.
    - W01: Appointment today
    - W02: Appointment tomorrow
    - W03: Appointment in 21 days (never contacted)
    - W04: Appointment in 21 days (followup)
    """
    from google.oauth2.credentials import Credentials
    from googleapiclient.discovery import build
    import logging
    
    logger = logging.getLogger(__name__)
    
    # Get calendar credentials
    settings = await db.settings.find_one({}, {"_id": 0})
    if not settings or not settings.get("calendar_connected"):
        raise HTTPException(status_code=400, detail="Google Calendar no conectado")
    
    calendar_credentials = settings.get("calendar_credentials", {})
    if not calendar_credentials:
        raise HTTPException(status_code=400, detail="Credenciales de calendario no encontradas")
    
    try:
        # Build credentials
        credentials = Credentials(
            token=calendar_credentials.get("token"),
            refresh_token=calendar_credentials.get("refresh_token"),
            token_uri=calendar_credentials.get("token_uri", "https://oauth2.googleapis.com/token"),
            client_id=calendar_credentials.get("client_id"),
            client_secret=calendar_credentials.get("client_secret"),
        )
        
        # Build Calendar service
        service = build('calendar', 'v3', credentials=credentials)
        
        # Get events for next 21 days
        now = datetime.now(timezone.utc)
        today = now.date()
        time_min = now.isoformat()
        time_max = (now + timedelta(days=22)).isoformat()
        
        events_result = service.events().list(
            calendarId='primary',
            timeMin=time_min,
            timeMax=time_max,
            singleEvents=True,
            orderBy='startTime',
            showDeleted=False
        ).execute()
        
        events = events_result.get('items', [])
        generated_count = 0
        
        # Track contacts to avoid duplicates - keep only the closest event per contact
        # Structure: {contact_id: {"days_until": X, "event_data": {...}}}
        contact_closest_event = {}
        
        for event in events:
            if event.get('status') == 'cancelled':
                continue
            
            # Get event details
            event_id = event.get('id')
            summary = event.get('summary', 'Reunion')
            start = event.get('start', {})
            start_datetime_str = start.get('dateTime') or start.get('date')
            hangout_link = event.get('hangoutLink', '')
            
            if not start_datetime_str:
                continue
            
            # Check if I am the organizer of this event
            organizer = event.get('organizer', {})
            i_am_organizer = organizer.get('self', False)
            
            # Check my response status for this event
            # Include: accepted, needsAction, tentative, and events I organized
            # Exclude: declined
            attendees = event.get('attendees', [])
            my_response = None
            
            for att in attendees:
                if att.get('self'):
                    my_response = att.get('responseStatus', 'needsAction')
                    break
            
            # Skip events where I declined (regardless of organizer status)
            if my_response == 'declined':
                logger.info(f"Skipping event '{summary}' - user declined")
                continue
            
            # If I'm not the organizer and I haven't accepted/tentative, skip
            # (needsAction is OK - it means I haven't responded yet)
            if not i_am_organizer and my_response not in ['accepted', 'needsAction', 'tentative', None]:
                logger.info(f"Skipping event '{summary}' - response status: {my_response}")
                continue
            
            # Parse start datetime
            try:
                if 'T' in start_datetime_str:
                    # Has time component
                    event_dt = datetime.fromisoformat(start_datetime_str.replace('Z', '+00:00'))
                else:
                    # All day event
                    event_dt = datetime.strptime(start_datetime_str, '%Y-%m-%d').replace(tzinfo=timezone.utc)
            except Exception as e:
                logger.warning(f"Error parsing date {start_datetime_str}: {e}")
                continue
            
            # Convert to Mexico timezone
            mexico_dt = convert_to_mexico_tz(event_dt)
            event_date = mexico_dt.date()
            
            # Format date and time
            meeting_date = format_date_spanish(mexico_dt)
            meeting_time = format_time_mexico(event_dt)
            meeting_link = hangout_link if hangout_link else "[Sin link de acceso]"
            
            # Calculate days until event
            days_until = (event_date - today).days
            
            # Determine which rule applies based on days_until
            if days_until == 0:
                base_rule_id = "W01"  # Today
            elif days_until == 1:
                base_rule_id = "W02"  # Tomorrow
            elif days_until >= 2:
                # Future events - use W03/W04 for first contact/followup
                base_rule_id = "W03"  # Default to first contact, will adjust below
            else:
                continue  # Past event, skip
            
            # Process attendees
            attendees = event.get('attendees', [])
            for attendee in attendees:
                if attendee.get('self'):
                    continue  # Skip myself
                
                attendee_email = attendee.get('email', '').lower().strip()
                if not attendee_email:
                    continue
                
                # FILTER: Skip @leaderlix.com emails
                if attendee_email.endswith('@leaderlix.com'):
                    continue
                
                # Find contact in unified_contacts
                contact = await db.unified_contacts.find_one(
                    {"email": {"$regex": f"^{attendee_email}$", "$options": "i"}},
                    {"_id": 0, "id": 1, "name": 1, "phone": 1, "buyer_persona": 1, "last_contacted_whatsapp": 1}
                )
                
                if not contact or not contact.get("phone"):
                    continue
                
                contact_id = contact.get("id")
                
                # Determine rule based on days_until and contact history
                if days_until >= 2:
                    last_contacted = contact.get("last_contacted_whatsapp")
                    if last_contacted:
                        # Check if contacted within last 6 days - skip if too recent
                        try:
                            last_contacted_dt = datetime.fromisoformat(last_contacted.replace('Z', '+00:00'))
                            days_since_contact = (now - last_contacted_dt).days
                            if days_since_contact < 6:
                                # Skip - contacted too recently for W04 followup
                                continue
                        except:
                            pass
                        rule_id = "W04"
                    else:
                        rule_id = "W03"
                else:
                    rule_id = base_rule_id
                
                # DEDUP: Track only the closest event per contact
                # If this contact already has a closer event, skip
                if contact_id in contact_closest_event:
                    existing_days = contact_closest_event[contact_id]["days_until"]
                    if days_until >= existing_days:
                        # Current event is same day or later, skip
                        continue
                
                # This event is closer (or first for this contact) - store it
                contact_closest_event[contact_id] = {
                    "days_until": days_until,
                    "rule_id": rule_id,
                    "contact": contact,
                    "attendee": attendee,
                    "event_data": {
                        "event_id": event_id,
                        "meeting_title": summary,
                        "meeting_date": meeting_date,
                        "meeting_time": meeting_time,
                        "meeting_link": meeting_link,
                    }
                }
        
        # Now insert only the closest event per contact
        for contact_id, data in contact_closest_event.items():
            rule_id = data["rule_id"]
            contact = data["contact"]
            event_data = data["event_data"]
            
            # Check if already in queue for this contact (any calendar rule)
            existing = await db.whatsapp_queue.find_one({
                "contact_id": contact_id,
                "status": "pending",
                "rule": {"$in": ["W01", "W02", "W03", "W04"]}
            })
            
            if existing:
                # Update if this event is closer
                existing_days = existing.get("metadata", {}).get("days_until", 999)
                if data["days_until"] < existing_days:
                    # Remove existing and add new
                    await db.whatsapp_queue.delete_one({"id": existing.get("id")})
                else:
                    continue  # Existing is closer or same, keep it
            
            # Check if already SENT today for this contact (any calendar rule)
            today_str = today.isoformat()
            already_sent = await db.whatsapp_queue.find_one({
                "contact_id": contact_id,
                "status": "sent",
                "rule": {"$in": ["W01", "W02", "W03", "W04"]},
                "generated_date": today_str
            })
            
            if already_sent:
                # Already sent today, don't re-add
                continue
            
            # Also check snooze field
            snooze_field = f"whatsapp_snoozed_{rule_id.lower()}"
            contact_doc = await db.unified_contacts.find_one(
                {"id": contact_id},
                {"_id": 0, snooze_field: 1}
            )
            if contact_doc:
                snoozed_until = contact_doc.get(snooze_field)
                if snoozed_until:
                    try:
                        snooze_dt = datetime.fromisoformat(snoozed_until.replace('Z', '+00:00'))
                        if snooze_dt > now:
                            # Still snoozed, skip
                            continue
                    except:
                        pass
            
            # Add to queue
            await db.whatsapp_queue.insert_one({
                "id": str(uuid.uuid4()),
                "rule": rule_id,
                "contact_id": contact_id,
                "contact_name": contact.get("name", data["attendee"].get("displayName", "")),
                "contact_phone": contact.get("phone"),
                "contact_type": "contact",
                "status": "pending",
                "metadata": {
                    **event_data,
                    "buyer_persona": contact.get("buyer_persona", ""),
                    "days_until": data["days_until"]
                },
                "generated_date": today.isoformat(),
                "created_at": now.isoformat()
            })
            generated_count += 1
        
        # Get counts per rule
        pipeline = [
            {"$match": {"status": "pending", "rule": {"$in": ["W01", "W02", "W03", "W04"]}}},
            {"$group": {"_id": "$rule", "count": {"$sum": 1}}}
        ]
        results = await db.whatsapp_queue.aggregate(pipeline).to_list(10)
        counts = {r["_id"]: r["count"] for r in results}
        
        return {
            "success": True,
            "generated_count": generated_count,
            "events_processed": len(events),
            "counts_by_rule": counts
        }
        
    except Exception as e:
        logger.error(f"Error generating calendar queue: {e}")
        raise HTTPException(status_code=500, detail=f"Error: {str(e)}")


@router.post("/generate-webinar-queue")
async def generate_webinar_queue(current_user: dict = Depends(get_current_user)):
    """
    Generate WhatsApp queue for webinar reminders (W08-W09) based on webinar_events_v2.
    - W08: Webinar reminder 7 days
    - W09: Webinar reminder 24h
    """
    import logging
    logger = logging.getLogger(__name__)
    
    now = datetime.now(timezone.utc)
    today = now.date()
    generated_count = 0
    
    # Get future webinars
    webinars = await db.webinar_events_v2.find(
        {"webinar_date": {"$gte": today.isoformat()}},
        {"_id": 0}
    ).to_list(100)
    
    for webinar in webinars:
        webinar_id = webinar.get("id")
        webinar_name = webinar.get("name", "Webinar")
        webinar_date_str = webinar.get("webinar_date", "")
        webinar_time = webinar.get("webinar_time", "")
        raw_link = webinar.get("landing_page_url", "")
        
        # Ensure webinar link has full domain
        if raw_link and raw_link.startswith("/"):
            webinar_link = f"https://leaderlix.com{raw_link}"
        elif raw_link and not raw_link.startswith("http"):
            webinar_link = f"https://leaderlix.com/{raw_link}"
        elif raw_link:
            webinar_link = raw_link
        else:
            webinar_link = "[Sin link de acceso]"
        
        target_personas = webinar.get("buyer_personas", [])
        
        if not webinar_date_str:
            continue
        
        # Parse webinar date
        try:
            webinar_date = datetime.strptime(webinar_date_str, "%Y-%m-%d").date()
        except:
            continue
        
        days_until = (webinar_date - today).days
        
        # Format date in Spanish
        webinar_dt = datetime.combine(webinar_date, datetime.min.time())
        formatted_date = format_date_spanish(webinar_dt)
        
        # Determine which rule applies (W08 = 7 days, W09 = 24h)
        if days_until == 1:
            rule_id = "W09"  # 24h reminder
        elif days_until == 7:
            rule_id = "W08"  # 7 day reminder
        else:
            continue  # Skip other days (W07 removed)
        
        # Get eligible contacts (Stage 1-2, matching buyer persona)
        # Exclude @leaderlix.com emails
        contact_filter = {
            "stage": {"$in": [1, 2]},
            "email": {"$not": {"$regex": "@leaderlix\\.com$", "$options": "i"}}
        }
        
        # Filter by buyer persona if webinar targets specific ones
        if target_personas:
            contact_filter["buyer_persona"] = {"$in": [p.lower() for p in target_personas]}
        
        contacts = await db.unified_contacts.find(
            contact_filter,
            {"_id": 0, "id": 1, "name": 1, "phone": 1, "buyer_persona": 1, "email": 1}
        ).to_list(5000)
        
        for contact in contacts:
            if not contact.get("phone"):
                continue
            
            # Double-check email filter (in case regex didn't catch it)
            contact_email = contact.get("email", "").lower()
            if contact_email.endswith("@leaderlix.com"):
                continue
            
            contact_id = contact.get("id")
            
            # Check if already in queue for this webinar
            existing = await db.whatsapp_queue.find_one({
                "rule": rule_id,
                "contact_id": contact_id,
                "metadata.webinar_id": webinar_id,
                "status": "pending"
            })
            
            if existing:
                continue
            
            # Check if already SENT today for this webinar
            already_sent = await db.whatsapp_queue.find_one({
                "rule": rule_id,
                "contact_id": contact_id,
                "metadata.webinar_id": webinar_id,
                "status": "sent",
                "generated_date": today.isoformat()
            })
            
            if already_sent:
                continue
            
            # Check snooze field
            snooze_field = f"whatsapp_snoozed_{rule_id.lower()}"
            contact_doc = await db.unified_contacts.find_one(
                {"id": contact_id},
                {"_id": 0, snooze_field: 1}
            )
            if contact_doc:
                snoozed_until = contact_doc.get(snooze_field)
                if snoozed_until:
                    try:
                        snooze_dt = datetime.fromisoformat(snoozed_until.replace('Z', '+00:00'))
                        if snooze_dt > now:
                            continue
                    except:
                        pass
            
            # Add to queue
            await db.whatsapp_queue.insert_one({
                "id": str(uuid.uuid4()),
                "rule": rule_id,
                "contact_id": contact_id,
                "contact_name": contact.get("name", ""),
                "contact_phone": contact.get("phone"),
                "contact_type": "contact",
                "status": "pending",
                "metadata": {
                    "webinar_id": webinar_id,
                    "webinar_name": webinar_name,
                    "webinar_date": formatted_date,
                    "webinar_time": webinar_time,
                    "webinar_link": webinar_link,
                    "buyer_persona": contact.get("buyer_persona", ""),
                    "days_until": days_until
                },
                "generated_date": today.isoformat(),
                "created_at": now.isoformat()
            })
            generated_count += 1
    
    # Get counts per rule
    pipeline = [
        {"$match": {"status": "pending", "rule": {"$in": ["W08", "W09"]}}},
        {"$group": {"_id": "$rule", "count": {"$sum": 1}}}
    ]
    results = await db.whatsapp_queue.aggregate(pipeline).to_list(10)
    counts = {r["_id"]: r["count"] for r in results}
    
    return {
        "success": True,
        "generated_count": generated_count,
        "webinars_processed": len(webinars),
        "counts_by_rule": counts
    }
