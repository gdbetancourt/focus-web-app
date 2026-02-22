"""
Email Rules Router - Configuration and management of email rules (E1-E10)
Allows editing rules, prompts, cadences, and viewing statistics
"""
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from datetime import datetime, timezone, timedelta
import uuid

from database import db
from routers.auth import get_current_user

router = APIRouter(prefix="/email-rules", tags=["email-rules"])


# ============ SCHEMAS ============

class EmailRuleUpdate(BaseModel):
    enabled: Optional[bool] = None
    cadence_days: Optional[int] = None
    target_stages: Optional[List[int]] = None
    target_roles: Optional[List[str]] = None
    exclude_roles: Optional[List[str]] = None
    prompt_subject: Optional[str] = None
    prompt_body: Optional[str] = None
    description: Optional[str] = None
    additional_conditions: Optional[Dict[str, Any]] = None


# ============ AUTO-SEND SETTINGS ============

@router.get("/settings/auto-send")
async def get_auto_send_status(current_user: dict = Depends(get_current_user)):
    """Get current auto-send status"""
    settings = await db.email_settings.find_one({"id": "global"}, {"_id": 0})
    return {
        "auto_send_enabled": settings.get("auto_send_enabled", False) if settings else False
    }


@router.post("/settings/auto-send/toggle")
async def toggle_auto_send(current_user: dict = Depends(get_current_user)):
    """Toggle auto-send on/off"""
    settings = await db.email_settings.find_one({"id": "global"})
    current_state = settings.get("auto_send_enabled", False) if settings else False
    new_state = not current_state
    
    await db.email_settings.update_one(
        {"id": "global"},
        {
            "$set": {
                "auto_send_enabled": new_state,
                "updated_at": datetime.now(timezone.utc).isoformat(),
                "updated_by": current_user.get("email")
            }
        },
        upsert=True
    )
    
    return {
        "auto_send_enabled": new_state,
        "message": f"Envío automático {'activado' if new_state else 'desactivado'}"
    }


# ============ DEFAULT RULES ============

DEFAULT_RULES = [
    {
        "id": "E01",
        "name": "Invitación a Webinar",
        "description": "Invitar contactos Stage 1-2 sin registro a webinar futuro",
        "enabled": True,
        "cadence_days": 7,
        "target_stages": [1, 2],
        "target_roles": [],
        "exclude_roles": [],
        "trigger_type": "cadence",
        "template_subject": "¡{contact_name}, te invitamos a nuestro webinar!",
        "template_body": """<p>¡Hola {contact_name}!</p>

<p>Te invitamos a nuestro próximo webinar: <strong>{webinar_name}</strong></p>

<p>📅 Fecha: {webinar_date}<br/>
🕐 Hora: {webinar_time}</p>

<p>En este webinar aprenderás técnicas prácticas para comunicarte con mayor impacto y presencia.</p>

<p>¡No te lo pierdas!</p>""",
        "template_variables": ["contact_name", "company", "webinar_name", "webinar_date", "webinar_time"],
        "additional_conditions": {
            "exclude_registered_to_future_webinar": True
        }
    },
    {
        "id": "E02",
        "name": "Seguimiento de Cotización",
        "description": "Seguimiento a contactos Stage 3 con cotización enviada y evento pasado",
        "enabled": True,
        "cadence_days": 7,
        "target_stages": [3],
        "target_roles": [],
        "exclude_roles": [],
        "trigger_type": "cadence",
        "template_subject": "{contact_name}, ¿recibiste nuestra propuesta?",
        "template_body": """<p>¡Hola {contact_name}!</p>

<p>Espero que estés muy bien. Te escribo para dar seguimiento a la cotización que te enviamos.</p>

<p>¿Tuviste oportunidad de revisarla? Me encantaría saber si tienes alguna duda o si hay algo que podamos ajustar para que se adapte mejor a tus necesidades.</p>

<p>Quedo atento a tus comentarios.</p>""",
        "template_variables": ["contact_name", "company"],
        "additional_conditions": {
            "require_quote": True,
            "require_past_calendar_event_after_quote": True
        }
    },
    {
        "id": "E03",
        "name": "Recordatorio de Coaching",
        "description": "Recordar a coachees Stage 4 sin evento en 60 días",
        "enabled": True,
        "cadence_days": 7,
        "target_stages": [4],
        "target_roles": ["coachee"],
        "exclude_roles": [],
        "trigger_type": "cadence",
        "template_subject": "{contact_name}, ¿agendamos tu próxima sesión?",
        "template_body": """<p>¡Hola {contact_name}!</p>

<p>Noté que no tienes ninguna sesión de coaching programada. ¿Qué te parece si agendamos una pronto?</p>

<p>Recuerda que la práctica constante es clave para seguir desarrollando tus habilidades de comunicación.</p>

<p>¡Estoy aquí para apoyarte!</p>""",
        "template_variables": ["contact_name", "company"],
        "additional_conditions": {
            "no_calendar_event_in_days": 60
        }
    },
    {
        "id": "E04",
        "name": "Recompra - Deal Makers",
        "description": "Contactar Deal Makers Stage 5 cada 90 días",
        "enabled": True,
        "cadence_days": 90,
        "target_stages": [5],
        "target_roles": ["deal_maker", "Deal Maker", "dealmaker"],
        "exclude_roles": [],
        "trigger_type": "cadence",
        "template_subject": "{contact_name}, tenemos nuevos entrenamientos",
        "template_body": """<p>¡Hola {contact_name}!</p>

<p>Espero que todo vaya muy bien en {company}. Te escribo porque tenemos nuevos programas de entrenamiento que podrían interesarte.</p>

<p>También, si conoces a alguien que podría beneficiarse de nuestros programas de comunicación, me encantaría que me lo presentaras.</p>

<p>¿Te gustaría agendar una llamada para ponernos al día?</p>""",
        "template_variables": ["contact_name", "company"],
        "additional_conditions": {}
    },
    {
        "id": "E05",
        "name": "Check-in Alumni (Coachees)",
        "description": "Check-in con coachees Stage 5 cada 90 días",
        "enabled": True,
        "cadence_days": 90,
        "target_stages": [5],
        "target_roles": ["coachee"],
        "exclude_roles": [],
        "trigger_type": "cadence",
        "template_subject": "{contact_name}, ¿cómo te ha ido?",
        "template_body": """<p>¡Hola {contact_name}!</p>

<p>Ha pasado un tiempo desde que terminaste tu programa de coaching y quería saber cómo te ha ido aplicando lo que aprendiste.</p>

<p>¿Has tenido oportunidad de poner en práctica las técnicas? Me encantaría escuchar tus experiencias.</p>

<p>Si necesitas algún recurso adicional o tienes preguntas, aquí estoy para apoyarte.</p>""",
        "template_variables": ["contact_name", "company"],
        "additional_conditions": {}
    },
    {
        "id": "E06",
        "name": "Confirmación Pre-registro",
        "description": "Confirmar pre-registro y pedir datos de participantes (importados última semana)",
        "enabled": True,
        "cadence_days": 0,
        "target_stages": [],
        "target_roles": [],
        "exclude_roles": [],
        "trigger_type": "event_based",
        "template_subject": "{contact_name}, tu pre-registro a {webinar_name} está confirmado",
        "template_body": """<p>¡Hola {contact_name}!</p>

<p>Tu pre-registro al webinar <strong>{webinar_name}</strong> está confirmado.</p>

<p>📅 Fecha: {webinar_date}<br/>
🕐 Hora: {webinar_time}</p>

<p>Si deseas registrar a más participantes de tu equipo (máximo 10), por favor responde este correo con sus datos:</p>
<ul>
<li>Nombre completo</li>
<li>Email</li>
<li>Teléfono</li>
</ul>

<p>¡Te esperamos!</p>""",
        "template_variables": ["contact_name", "webinar_name", "webinar_date", "webinar_time"],
        "additional_conditions": {
            "imported_in_last_week": True,
            "one_per_webinar": True
        }
    },
    {
        "id": "E07",
        "name": "Recordatorio: Hora Exacta",
        "description": "Recordatorio al momento exacto del webinar con link",
        "enabled": True,
        "cadence_days": 0,
        "target_stages": [],
        "target_roles": [],
        "exclude_roles": [],
        "trigger_type": "time_based",
        "template_subject": "🔴 {contact_name}, ¡el webinar comienza AHORA!",
        "template_body": """<p>¡Hola {contact_name}!</p>

<p>El webinar <strong>{webinar_name}</strong> está comenzando en este momento.</p>

<p>👉 <a href="{webinar_link}">ENTRAR AL WEBINAR</a></p>

<p>¡Te esperamos!</p>""",
        "template_variables": ["contact_name", "webinar_name", "webinar_link"],
        "additional_conditions": {
            "time_offset_hours": 0,
            "webinar_registered": True
        }
    },
    {
        "id": "E08",
        "name": "Recordatorio: 1 Hora Antes",
        "description": "Recordatorio 1 hora antes del webinar",
        "enabled": True,
        "cadence_days": 0,
        "target_stages": [],
        "target_roles": [],
        "exclude_roles": [],
        "trigger_type": "time_based",
        "template_subject": "⏰ {contact_name}, el webinar comienza en 1 hora",
        "template_body": """<p>¡Hola {contact_name}!</p>

<p>Te recordamos que el webinar <strong>{webinar_name}</strong> comienza en <strong>1 hora</strong>.</p>

<p>📅 Fecha: {webinar_date}<br/>
🕐 Hora: {webinar_time}</p>

<p>Prepárate y asegúrate de tener una buena conexión a internet.</p>

<p>👉 <a href="{webinar_link}">ENTRAR AL WEBINAR</a></p>""",
        "template_variables": ["contact_name", "webinar_name", "webinar_date", "webinar_time", "webinar_link"],
        "additional_conditions": {
            "time_offset_hours": -1,
            "webinar_registered": True
        }
    },
    {
        "id": "E09",
        "name": "Recordatorio: 24 Horas Hábiles",
        "description": "Recordatorio 24 horas hábiles antes (excluye fines de semana)",
        "enabled": True,
        "cadence_days": 0,
        "target_stages": [],
        "target_roles": [],
        "exclude_roles": [],
        "trigger_type": "time_based",
        "template_subject": "📅 {contact_name}, mañana es el webinar",
        "template_body": """<p>¡Hola {contact_name}!</p>

<p>Te recordamos que <strong>mañana</strong> es el webinar <strong>{webinar_name}</strong>.</p>

<p>📅 Fecha: {webinar_date}<br/>
🕐 Hora: {webinar_time}</p>

<p>Marca tu calendario y prepárate para una sesión llena de aprendizajes prácticos.</p>

<p>👉 <a href="{webinar_link}">AGREGAR A MI CALENDARIO</a></p>""",
        "template_variables": ["contact_name", "webinar_name", "webinar_date", "webinar_time", "webinar_link"],
        "additional_conditions": {
            "business_hours_offset": -24,
            "webinar_registered": True
        }
    },
    {
        "id": "E10",
        "name": "Recordatorio: 7 Días Antes",
        "description": "Recordatorio 7 días naturales antes del webinar",
        "enabled": True,
        "cadence_days": 0,
        "target_stages": [],
        "target_roles": [],
        "exclude_roles": [],
        "trigger_type": "time_based",
        "template_subject": "🗓️ {contact_name}, tu webinar es en 7 días",
        "template_body": """<p>¡Hola {contact_name}!</p>

<p>Faltan <strong>7 días</strong> para el webinar <strong>{webinar_name}</strong>.</p>

<p>📅 Fecha: {webinar_date}<br/>
🕐 Hora: {webinar_time}</p>

<p>Reserva este tiempo en tu agenda. Será una sesión que no querrás perderte.</p>

<p>¡Nos vemos pronto!</p>""",
        "template_variables": ["contact_name", "webinar_name", "webinar_date", "webinar_time"],
        "additional_conditions": {
            "natural_days_offset": -7,
            "webinar_registered": True
        }
    }
]


# ============ ENDPOINTS ============

# IMPORTANT: Put static paths BEFORE dynamic paths like /{rule_id}

# ============ TRAFFIC LIGHT STATUS ENDPOINT ============

@router.get("/traffic-light-status")
async def get_traffic_light_status(
    current_user: dict = Depends(get_current_user)
):
    """
    Get traffic light status for email follow-up section.
    - Red: None of today's messages have been sent (pending > 0, sent_today = 0)
    - Yellow: Some messages sent but more pending (pending > 0, sent_today > 0)
    - Green: All today's messages have been sent (pending = 0)
    """
    now = datetime.now(timezone.utc)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0).isoformat()
    today_end = now.replace(hour=23, minute=59, second=59).isoformat()
    
    # Count pending emails for today or earlier
    pending_count = await db.email_queue.count_documents({
        "status": "pending",
        "$or": [
            {"scheduled_at": {"$lte": today_end}},
            {"scheduled_at": {"$exists": False}},
            {"scheduled_at": None}
        ]
    })
    
    # Count emails sent today
    sent_today = await db.email_logs.count_documents({
        "status": "sent",
        "sent_at": {"$gte": today_start, "$lte": today_end}
    })
    
    # Determine traffic light status
    if pending_count == 0:
        status = "green"
    elif sent_today == 0:
        status = "red"
    else:
        status = "yellow"
    
    return {
        "status": status,
        "pending": pending_count,
        "sent_today": sent_today,
        "message": {
            "red": "Ningún mensaje de hoy ha sido enviado",
            "yellow": f"Se han enviado {sent_today} mensajes, faltan {pending_count}",
            "green": "Todos los mensajes de hoy han sido enviados"
        }.get(status, "")
    }


# ============ SEARCH AND DIAGNOSTIC ENDPOINTS ============

@router.get("/search-contacts")
async def search_contacts_for_diagnosis(
    q: str,
    limit: int = 10,
    current_user: dict = Depends(get_current_user)
):
    """
    Search contacts by name, email, or phone for diagnosis.
    Returns basic contact info for selection.
    """
    if not q or len(q) < 2:
        return {"contacts": []}
    
    # Build search query
    search_regex = {"$regex": q, "$options": "i"}
    
    contacts = await db.unified_contacts.find(
        {
            "$or": [
                {"name": search_regex},
                {"email": search_regex},
                {"phone": search_regex},
                {"first_name": search_regex},
                {"last_name": search_regex}
            ]
        },
        {"_id": 0, "id": 1, "name": 1, "first_name": 1, "last_name": 1, 
         "email": 1, "phone": 1, "stage": 1, "company": 1, "roles": 1}
    ).limit(limit).to_list(limit)
    
    # Format results
    results = []
    for c in contacts:
        name = c.get("name") or f"{c.get('first_name', '')} {c.get('last_name', '')}".strip() or "Sin nombre"
        results.append({
            "id": c.get("id"),
            "name": name,
            "email": c.get("email", ""),
            "phone": c.get("phone", ""),
            "stage": c.get("stage"),
            "company": c.get("company", ""),
            "roles": c.get("roles", [])
        })
    
    return {"contacts": results}


@router.get("/diagnose/{contact_id}")
async def diagnose_contact_email_rules(
    contact_id: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Diagnose which email rules apply to a specific contact.
    Returns detailed information about eligibility for each rule E1-E10.
    """
    from utils.contact_helpers import build_cadence_query, CADENCE_PERIODS
    
    # Get contact
    contact = await db.unified_contacts.find_one({"id": contact_id}, {"_id": 0})
    if not contact:
        raise HTTPException(status_code=404, detail="Contacto no encontrado")
    
    now = datetime.now(timezone.utc)
    email = contact.get("email") or ""
    stage = contact.get("stage")
    roles = [r.lower() for r in contact.get("roles", []) if r]
    
    diagnosis = []
    
    # E1: Stage 1-2, not registered to future webinar
    e1_eligible = False
    e1_reasons = []
    if stage in [1, 2]:
        e1_reasons.append("✅ Stage 1-2")
        # Check if registered to future webinar
        future_events = await db.webinar_events_v2.find(
            {"webinar_date": {"$gte": now.strftime("%Y-%m-%d")}},
            {"_id": 0, "registrants.email": 1}
        ).to_list(100)
        
        registered_emails = set()
        for event in future_events:
            for reg in event.get("registrants", []):
                reg_email = reg.get("email", "").lower()
                if reg_email:
                    registered_emails.add(reg_email)
        
        if email.lower() not in registered_emails:
            e1_reasons.append("✅ No registrado a webinar futuro")
            # Check cadence
            last_sent = contact.get("last_email_e1_sent")
            cadence_days = CADENCE_PERIODS.get("email_e1", 7)
            if last_sent:
                try:
                    last_date = datetime.fromisoformat(last_sent.replace('Z', '+00:00'))
                    days_since = (now - last_date).days
                    if days_since >= cadence_days:
                        e1_reasons.append(f"✅ Cadencia cumplida ({days_since} días desde último envío)")
                        e1_eligible = True
                    else:
                        e1_reasons.append(f"❌ Cadencia no cumplida ({days_since}/{cadence_days} días)")
                except (ValueError, TypeError):
                    e1_reasons.append("✅ Sin email E1 previo")
                    e1_eligible = True
            else:
                e1_reasons.append("✅ Sin email E1 previo")
                e1_eligible = True
        else:
            e1_reasons.append("❌ Ya registrado a webinar futuro")
    else:
        e1_reasons.append(f"❌ Stage {stage} (requiere 1-2)")
    
    diagnosis.append({
        "rule_id": "E01",
        "rule_name": "Invitación a Webinar",
        "eligible": e1_eligible,
        "reasons": e1_reasons
    })
    
    # E2: Stage 3, with quote and past calendar event
    e2_eligible = False
    e2_reasons = []
    if stage == 3:
        e2_reasons.append("✅ Stage 3")
        # Check for quote
        quote = await db.quotes.find_one({"client_email": {"$regex": f"^{email}$", "$options": "i"}})
        if quote:
            e2_reasons.append("✅ Tiene cotización")
            # Check cadence
            last_sent = contact.get("last_email_e2_sent")
            cadence_days = CADENCE_PERIODS.get("email_e2", 7)
            if last_sent:
                try:
                    last_date = datetime.fromisoformat(last_sent.replace('Z', '+00:00'))
                    days_since = (now - last_date).days
                    if days_since >= cadence_days:
                        e2_reasons.append(f"✅ Cadencia cumplida ({days_since} días)")
                        e2_eligible = True
                    else:
                        e2_reasons.append(f"❌ Cadencia no cumplida ({days_since}/{cadence_days} días)")
                except (ValueError, TypeError):
                    e2_reasons.append("✅ Sin email E2 previo")
                    e2_eligible = True
            else:
                e2_reasons.append("✅ Sin email E2 previo")
                e2_eligible = True
        else:
            e2_reasons.append("❌ No tiene cotización")
    else:
        e2_reasons.append(f"❌ Stage {stage} (requiere 3)")
    
    diagnosis.append({
        "rule_id": "E02",
        "rule_name": "Seguimiento de Cotización",
        "eligible": e2_eligible,
        "reasons": e2_reasons
    })
    
    # E3: Stage 4, coachee role
    e3_eligible = False
    e3_reasons = []
    if stage == 4:
        e3_reasons.append("✅ Stage 4")
        if "coachee" in roles:
            e3_reasons.append("✅ Es coachee")
            last_sent = contact.get("last_email_e3_sent")
            cadence_days = CADENCE_PERIODS.get("email_e3", 7)
            if last_sent:
                try:
                    last_date = datetime.fromisoformat(last_sent.replace('Z', '+00:00'))
                    days_since = (now - last_date).days
                    if days_since >= cadence_days:
                        e3_reasons.append(f"✅ Cadencia cumplida ({days_since} días)")
                        e3_eligible = True
                    else:
                        e3_reasons.append(f"❌ Cadencia no cumplida ({days_since}/{cadence_days} días)")
                except (ValueError, TypeError):
                    e3_reasons.append("✅ Sin email E3 previo")
                    e3_eligible = True
            else:
                e3_reasons.append("✅ Sin email E3 previo")
                e3_eligible = True
        else:
            e3_reasons.append(f"❌ No es coachee (roles: {', '.join(roles) or 'ninguno'})")
    else:
        e3_reasons.append(f"❌ Stage {stage} (requiere 4)")
    
    diagnosis.append({
        "rule_id": "E03",
        "rule_name": "Recordatorio de Coaching",
        "eligible": e3_eligible,
        "reasons": e3_reasons
    })
    
    # E4: Stage 5, deal_maker role
    e4_eligible = False
    e4_reasons = []
    if stage == 5:
        e4_reasons.append("✅ Stage 5")
        if any(r in roles for r in ["deal_maker", "dealmaker"]):
            e4_reasons.append("✅ Es deal maker")
            last_sent = contact.get("last_email_e4_sent")
            cadence_days = CADENCE_PERIODS.get("email_e4", 90)
            if last_sent:
                try:
                    last_date = datetime.fromisoformat(last_sent.replace('Z', '+00:00'))
                    days_since = (now - last_date).days
                    if days_since >= cadence_days:
                        e4_reasons.append(f"✅ Cadencia cumplida ({days_since} días)")
                        e4_eligible = True
                    else:
                        e4_reasons.append(f"❌ Cadencia no cumplida ({days_since}/{cadence_days} días)")
                except (ValueError, TypeError):
                    e4_reasons.append("✅ Sin email E4 previo")
                    e4_eligible = True
            else:
                e4_reasons.append("✅ Sin email E4 previo")
                e4_eligible = True
        else:
            e4_reasons.append(f"❌ No es deal maker (roles: {', '.join(roles) or 'ninguno'})")
    else:
        e4_reasons.append(f"❌ Stage {stage} (requiere 5)")
    
    diagnosis.append({
        "rule_id": "E04",
        "rule_name": "Recompra - Deal Makers",
        "eligible": e4_eligible,
        "reasons": e4_reasons
    })
    
    # E5: Stage 5, coachee role
    e5_eligible = False
    e5_reasons = []
    if stage == 5:
        e5_reasons.append("✅ Stage 5")
        if "coachee" in roles:
            e5_reasons.append("✅ Es coachee")
            last_sent = contact.get("last_email_e5_sent")
            cadence_days = CADENCE_PERIODS.get("email_e5", 90)
            if last_sent:
                try:
                    last_date = datetime.fromisoformat(last_sent.replace('Z', '+00:00'))
                    days_since = (now - last_date).days
                    if days_since >= cadence_days:
                        e5_reasons.append(f"✅ Cadencia cumplida ({days_since} días)")
                        e5_eligible = True
                    else:
                        e5_reasons.append(f"❌ Cadencia no cumplida ({days_since}/{cadence_days} días)")
                except (ValueError, TypeError):
                    e5_reasons.append("✅ Sin email E5 previo")
                    e5_eligible = True
            else:
                e5_reasons.append("✅ Sin email E5 previo")
                e5_eligible = True
        else:
            e5_reasons.append(f"❌ No es coachee (roles: {', '.join(roles) or 'ninguno'})")
    else:
        e5_reasons.append(f"❌ Stage {stage} (requiere 5)")
    
    diagnosis.append({
        "rule_id": "E05",
        "rule_name": "Check-in Alumni",
        "eligible": e5_eligible,
        "reasons": e5_reasons
    })
    
    # E6-E10: Check webinar registrations
    webinar_history = contact.get("webinar_history", [])
    future_registrations = []
    
    for reg in webinar_history:
        event_id = reg.get("event_id")
        if not event_id:
            continue
        # Get event details
        event = await db.webinar_events_v2.find_one({"id": event_id}, {"_id": 0, "name": 1, "webinar_date": 1, "webinar_time": 1})
        if event:
            event_date_str = event.get("webinar_date", "")
            if event_date_str >= now.strftime("%Y-%m-%d"):
                future_registrations.append({
                    "event_id": event_id,
                    "event_name": event.get("name", "Webinar"),
                    "event_date": event_date_str,
                    "event_time": event.get("webinar_time", "")
                })
    
    # E6: Pre-registration confirmation
    e6_reasons = []
    if future_registrations:
        e6_reasons.append(f"✅ Registrado a {len(future_registrations)} webinar(s) futuro(s)")
    else:
        e6_reasons.append("❌ No registrado a webinars futuros")
    
    diagnosis.append({
        "rule_id": "E06",
        "rule_name": "Confirmación Pre-registro",
        "eligible": len(future_registrations) > 0,
        "reasons": e6_reasons,
        "webinars": future_registrations
    })
    
    # E7-E10: Time-based webinar reminders
    for rule_id, rule_name, offset_desc in [
        ("E07", "Recordatorio: Hora Exacta", "al momento del webinar"),
        ("E08", "Recordatorio: 1 Hora Antes", "1 hora antes"),
        ("E09", "Recordatorio: 24h Hábiles Antes", "24 horas hábiles antes"),
        ("E10", "Recordatorio: 7 Días Antes", "7 días antes")
    ]:
        reasons = []
        if future_registrations:
            reasons.append(f"✅ Se enviará {offset_desc}")
            for reg in future_registrations:
                reasons.append(f"  → {reg['event_name']} ({reg['event_date']})")
        else:
            reasons.append("❌ No registrado a webinars futuros")
        
        diagnosis.append({
            "rule_id": rule_id,
            "rule_name": rule_name,
            "eligible": len(future_registrations) > 0,
            "reasons": reasons
        })
    
    return {
        "contact": {
            "id": contact_id,
            "name": contact.get("name") or f"{contact.get('first_name', '')} {contact.get('last_name', '')}".strip(),
            "email": email,
            "phone": contact.get("phone", ""),
            "stage": stage,
            "company": contact.get("company", ""),
            "roles": contact.get("roles", [])
        },
        "diagnosis": diagnosis,
        "summary": {
            "eligible_count": sum(1 for d in diagnosis if d["eligible"]),
            "total_rules": len(diagnosis)
        }
    }


@router.get("/rule/{rule_id}/stats")
async def get_rule_stats(
    rule_id: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Get statistics for a specific email rule.
    Currently only returns sent count (tracking not configured).
    """
    rule_id = rule_id.upper()
    
    # Count sent emails for this rule
    sent_total = await db.email_queue.count_documents({
        "rule": rule_id,
        "status": "sent"
    })
    
    return {
        "rule_id": rule_id,
        "sent_total": sent_total
    }


@router.get("/rule/{rule_id}/pending")
async def get_rule_pending_emails(
    rule_id: str,
    page: int = 1,
    page_size: int = 20,
    current_user: dict = Depends(get_current_user)
):
    """
    Get pending emails for a specific rule with pagination.
    Returns emails scheduled to be sent.
    """
    rule_id = rule_id.upper()
    skip = (page - 1) * page_size
    
    # Get pending emails for this rule
    pending_emails = await db.email_queue.find(
        {"rule": rule_id, "status": "pending"},
        {"_id": 0}
    ).sort("scheduled_at", 1).skip(skip).limit(page_size).to_list(page_size)
    
    # Get total count
    total_count = await db.email_queue.count_documents({
        "rule": rule_id,
        "status": "pending"
    })
    
    return {
        "rule_id": rule_id,
        "pending_emails": pending_emails,
        "total_count": total_count,
        "page": page,
        "page_size": page_size,
        "total_pages": (total_count + page_size - 1) // page_size
    }


@router.get("/rule/{rule_id}/pending-grouped")
async def get_rule_pending_emails_grouped(
    rule_id: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Get pending emails for a rule grouped by webinar (E1,E6-E10) or buyer_persona (E2-E5).
    For webinar rules, also sub-groups by buyer_persona within each webinar.
    Only returns emails scheduled for today or earlier (overdue).
    """
    rule_id = rule_id.upper()
    now = datetime.now(timezone.utc)
    today_str = now.strftime("%Y-%m-%d")
    today_end = now.replace(hour=23, minute=59, second=59).isoformat()
    
    # Get pending emails for this rule that are scheduled for today or earlier
    pending_emails = await db.email_queue.find(
        {
            "rule": rule_id, 
            "status": "pending",
            "$or": [
                {"scheduled_at": {"$lte": today_end}},
                {"scheduled_at": {"$exists": False}},
                {"scheduled_at": None}
            ]
        },
        {"_id": 0}
    ).sort("scheduled_at", 1).to_list(5000)
    
    total_count = len(pending_emails)
    
    # Get buyer persona display names
    buyer_personas_db = {}
    bps = await db.buyer_personas_db.find({}, {"_id": 0, "code": 1, "name": 1}).to_list(20)
    for bp in bps:
        buyer_personas_db[bp.get("code", "").lower()] = bp.get("name", bp.get("code", ""))
    
    # Rules that group by webinar
    webinar_rules = ["E01", "E06", "E07", "E08", "E09", "E10"]
    # Rules that group by buyer_persona
    persona_rules = ["E02", "E04", "E05"]
    # Rules that group by case/project (like W12)
    case_rules = ["E03"]
    
    groups = []
    
    if rule_id in webinar_rules:
        # Pre-load webinar data to get dates
        webinar_data_cache = {}
        webinars = await db.webinar_events_v2.find(
            {},
            {"_id": 0, "id": 1, "name": 1, "webinar_date": 1, "webinar_time": 1, "landing_page_url": 1}
        ).to_list(500)
        for w in webinars:
            webinar_data_cache[w["id"]] = w
        
        # Group by webinar, then by buyer_persona
        webinar_groups = {}
        no_webinar_emails = []
        
        for email in pending_emails:
            metadata = email.get("metadata", {})
            webinar_id = metadata.get("webinar_id")
            webinar_name = metadata.get("webinar_name", "Sin webinar")
            webinar_date = metadata.get("webinar_date", "")
            webinar_time = metadata.get("webinar_time", "")
            webinar_link = ""
            
            # Get webinar data from cache if not in metadata
            if webinar_id:
                cached = webinar_data_cache.get(webinar_id, {})
                if not webinar_date:
                    webinar_date = cached.get("webinar_date", "")
                if not webinar_name or webinar_name == "Sin webinar":
                    webinar_name = cached.get("name", webinar_name)
                if not webinar_time:
                    webinar_time = cached.get("webinar_time", "")
                if not webinar_link:
                    webinar_link = cached.get("landing_page_url", "")
            
            bp = metadata.get("buyer_persona", "")
            bp_lower = (bp or "").lower().strip()
            bp_display = buyer_personas_db.get(bp_lower, bp or "Sin clasificar")
            
            # For E06, skip past webinars
            if rule_id == "E06" and webinar_date and webinar_date < today_str:
                continue
            
            if webinar_id:
                if webinar_id not in webinar_groups:
                    webinar_groups[webinar_id] = {
                        "group_id": webinar_id,
                        "group_type": "webinar",
                        "group_name": webinar_name,
                        "group_date": webinar_date,
                        "group_time": webinar_time,
                        "group_link": webinar_link,
                        "subgroups": {},
                        "count": 0
                    }
                
                # Add to buyer_persona subgroup
                if bp_lower not in webinar_groups[webinar_id]["subgroups"]:
                    webinar_groups[webinar_id]["subgroups"][bp_lower] = {
                        "subgroup_id": bp_lower or "no_persona",
                        "subgroup_name": bp_display,
                        "emails": [],
                        "count": 0,
                        "has_error": not bp_lower
                    }
                
                webinar_groups[webinar_id]["subgroups"][bp_lower]["emails"].append(email)
                webinar_groups[webinar_id]["subgroups"][bp_lower]["count"] += 1
                webinar_groups[webinar_id]["count"] += 1
            else:
                no_webinar_emails.append(email)
        
        # Convert subgroups dict to sorted list
        for webinar_id, webinar_data in webinar_groups.items():
            sorted_subgroups = sorted(
                webinar_data["subgroups"].values(), 
                key=lambda x: (x.get("has_error", False), x["subgroup_name"])
            )
            webinar_data["subgroups"] = sorted_subgroups
        
        # Sort webinar groups by date
        sorted_groups = sorted(webinar_groups.values(), key=lambda x: x["group_date"] or "9999")
        groups.extend(sorted_groups)
        
        # Add "no webinar" group if there are any
        if no_webinar_emails:
            # Group by buyer_persona within no_webinar
            no_webinar_subgroups = {}
            for email in no_webinar_emails:
                metadata = email.get("metadata", {})
                bp = metadata.get("buyer_persona", "")
                bp_lower = (bp or "").lower().strip()
                bp_display = buyer_personas_db.get(bp_lower, bp or "Sin clasificar")
                
                if bp_lower not in no_webinar_subgroups:
                    no_webinar_subgroups[bp_lower] = {
                        "subgroup_id": bp_lower or "no_persona",
                        "subgroup_name": bp_display,
                        "emails": [],
                        "count": 0,
                        "has_error": not bp_lower
                    }
                no_webinar_subgroups[bp_lower]["emails"].append(email)
                no_webinar_subgroups[bp_lower]["count"] += 1
            
            groups.append({
                "group_id": "no_webinar",
                "group_type": "webinar",
                "group_name": "Sin webinar asignado",
                "group_date": None,
                "subgroups": sorted(no_webinar_subgroups.values(), key=lambda x: x["subgroup_name"]),
                "count": len(no_webinar_emails),
                "has_error": True
            })
    
    elif rule_id in case_rules:
        # ============ E03: COACHEE - Group by Case Stage, then by Case (like W12) ============
        # Define the two main groups
        casos_en_curso_stages = ["ganados"]
        casos_cerrados_stages = ["concluidos", "contenidos_transcritos", "reporte_presentado", "caso_publicado"]
        
        # Structure: { "en_curso": { case_id: {...} }, "cerrados": { case_id: {...} } }
        main_groups = {
            "en_curso": {},
            "cerrados": {}
        }
        
        for email in pending_emails:
            contact_id = email.get("contact_id")
            metadata = email.get("metadata", {})
            
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
            
            # Add to appropriate group
            if case_id not in main_groups[main_group_key]:
                main_groups[main_group_key][case_id] = {
                    "subgroup_id": case_id,
                    "subgroup_name": display_name,
                    "case_stage": case_stage,
                    "emails": [],
                    "count": 0
                }
            
            main_groups[main_group_key][case_id]["emails"].append(email)
            main_groups[main_group_key][case_id]["count"] += 1
        
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
    
    elif rule_id in persona_rules:
        # Group by buyer_persona only (no subgroups)
        persona_groups = {}
        no_persona_emails = []
        
        for email in pending_emails:
            metadata = email.get("metadata", {})
            bp = metadata.get("buyer_persona", "")
            bp_lower = (bp or "").lower().strip()
            bp_display = buyer_personas_db.get(bp_lower, bp or "Sin clasificar")
            
            if bp_lower:
                if bp_lower not in persona_groups:
                    persona_groups[bp_lower] = {
                        "group_id": bp_lower,
                        "group_type": "buyer_persona",
                        "group_name": bp_display,
                        "group_date": None,
                        "emails": [],
                        "count": 0
                    }
                persona_groups[bp_lower]["emails"].append(email)
                persona_groups[bp_lower]["count"] += 1
            else:
                no_persona_emails.append(email)
        
        # Sort persona groups alphabetically
        sorted_groups = sorted(persona_groups.values(), key=lambda x: x["group_name"])
        groups.extend(sorted_groups)
        
        # Add "no persona" group if there are any - this is an error
        if no_persona_emails:
            error_contacts = []
            for email in no_persona_emails:
                error_contacts.append({
                    "contact_id": email.get("contact_id"),
                    "contact_name": email.get("contact_name"),
                    "contact_email": email.get("contact_email")
                })
            
            groups.append({
                "group_id": "no_persona",
                "group_type": "buyer_persona",
                "group_name": "Sin buyer persona (Error)",
                "group_date": None,
                "emails": no_persona_emails,
                "count": len(no_persona_emails),
                "has_error": True,
                "error_contacts": error_contacts
            })
    
    # Recalculate total count after filtering (for E6)
    if rule_id == "E06":
        total_count = sum(g.get("count", 0) for g in groups)
    
    # Determine group_type and has_subgroups
    if rule_id in webinar_rules:
        group_type = "webinar"
        has_subgroups = True
    elif rule_id in case_rules:
        group_type = "case"
        has_subgroups = True
    else:
        group_type = "buyer_persona"
        has_subgroups = False
    
    return {
        "rule_id": rule_id,
        "group_type": group_type,
        "has_subgroups": has_subgroups,
        "groups": groups,
        "total_count": total_count
    }


@router.post("/rule/{rule_id}/generate")
async def generate_emails_for_single_rule(
    rule_id: str,
    max_contacts: int = 0,
    current_user: dict = Depends(get_current_user)
):
    """
    Generate and queue emails for a single rule.
    This does NOT send emails - only adds them to the queue.
    
    Args:
        rule_id: The rule to generate (E1-E10)
        max_contacts: Maximum contacts to process (0 = no limit)
    """
    rule_id = rule_id.upper()
    
    valid_rules = ["E01", "E02", "E03", "E04", "E05", "E06", "E07", "E08", "E09", "E10"]
    if rule_id not in valid_rules:
        raise HTTPException(status_code=400, detail=f"Regla inválida: {rule_id}")
    
    # Check if rule is enabled
    rule_config = await db.email_rules.find_one({"id": rule_id}, {"_id": 0})
    if rule_config and not rule_config.get("enabled", True):
        raise HTTPException(status_code=400, detail=f"La regla {rule_id} está deshabilitada")
    
    # Get eligible contacts
    limit = max_contacts if max_contacts > 0 else 50000
    contacts = await get_eligible_contacts_for_rule(rule_id, limit)
    
    if not contacts:
        return {
            "success": True,
            "rule_id": rule_id,
            "message": "No hay contactos elegibles para esta regla",
            "queued": 0,
            "skipped": 0,
            "errors": 0
        }
    
    # Pre-load existing emails in queue
    existing_in_queue = set()
    existing_cursor = db.email_queue.find(
        {"rule": rule_id, "status": "pending"},
        {"_id": 0, "contact_id": 1, "metadata.webinar_id": 1}
    )
    async for doc in existing_cursor:
        key = doc.get("contact_id", "")
        if rule_id in ["E06", "E07", "E08", "E09", "E10"]:
            webinar_id = doc.get("metadata", {}).get("webinar_id", "")
            key = f"{key}_{webinar_id}"
        existing_in_queue.add(key)
    
    queued = 0
    skipped = 0
    errors = 0
    
    for contact in contacts:
        try:
            contact_id = contact["contact_id"]
            
            # Check if already in queue
            if rule_id in ["E06", "E07", "E08", "E09", "E10"]:
                lookup_key = f"{contact_id}_{contact.get('webinar_id', '')}"
            else:
                lookup_key = contact_id
            
            if lookup_key in existing_in_queue:
                skipped += 1
                continue
            
            # Generate email content
            email_content = await generate_email_for_contact(rule_id, contact, rule_config)
            
            if not email_content:
                errors += 1
                continue
            
            # Add to queue
            now_iso = datetime.now(timezone.utc).isoformat()
            email_doc = {
                "id": str(uuid.uuid4()),
                "rule": rule_id,
                "contact_id": contact_id,
                "contact_email": contact["email"],
                "contact_name": contact.get("name", ""),
                "subject": email_content["subject"],
                "body_html": email_content["body"],
                "body_text": "",
                "scheduled_at": now_iso,
                "status": "pending",
                "attempts": 0,
                "sent_at": None,
                "error": None,
                "message_id": None,
                "metadata": {
                    "company": contact.get("company"),
                    "buyer_persona": contact.get("buyer_persona"),
                    "webinar_name": contact.get("webinar_name"),
                    "webinar_date": contact.get("webinar_date"),
                    "webinar_id": contact.get("webinar_id")
                },
                "created_at": now_iso,
                "updated_at": now_iso
            }
            
            await db.email_queue.insert_one(email_doc)
            queued += 1
            
        except Exception:
            errors += 1
            continue
    
    return {
        "success": True,
        "rule_id": rule_id,
        "message": f"Generados {queued} emails para {rule_id}",
        "eligible": len(contacts),
        "queued": queued,
        "skipped": skipped,
        "errors": errors
    }


# ============ BACKGROUND JOB STATUS ENDPOINTS ============
# These must come BEFORE /{rule_id} to avoid route conflicts

@router.get("/generation-status")
async def get_generation_status(current_user: dict = Depends(get_current_user)):
    """
    Get the status of the current or most recent email generation job.
    Used for polling progress from the frontend.
    """
    # Get the most recent job
    job = await db.email_generation_jobs.find_one(
        {},
        {"_id": 0},
        sort=[("started_at", -1)]
    )
    
    if not job:
        return {
            "has_job": False,
            "status": "no_jobs",
            "message": "No hay trabajos de generación recientes"
        }
    
    # Calculate progress percentage
    progress_percent = 0
    if job.get("status") == "completed":
        progress_percent = 100
    elif job.get("status") == "running":
        total_rules = job.get("total_rules", 1)
        current_rule_index = job.get("current_rule_index", 0)
        contacts_in_rule = job.get("contacts_found_current_rule", 0)
        contacts_processed = job.get("contacts_processed_current_rule", 0)
        
        # Calculate: (completed rules + partial current rule) / total rules
        rule_progress = current_rule_index - 1 if current_rule_index > 0 else 0
        if contacts_in_rule > 0:
            rule_progress += contacts_processed / contacts_in_rule
        
        progress_percent = min(99, int((rule_progress / total_rules) * 100))
    
    return {
        "has_job": True,
        "job_id": job.get("id"),
        "status": job.get("status"),
        "status_message": job.get("status_message"),
        "progress_percent": progress_percent,
        "current_rule": job.get("current_rule"),
        "current_rule_index": job.get("current_rule_index"),
        "total_rules": job.get("total_rules"),
        "contacts_found_current_rule": job.get("contacts_found_current_rule"),
        "contacts_processed_current_rule": job.get("contacts_processed_current_rule"),
        "total_queued": job.get("total_queued"),
        "total_processed": job.get("total_processed"),
        "results": job.get("results"),
        "started_at": job.get("started_at"),
        "completed_at": job.get("completed_at"),
        "error": job.get("error")
    }


@router.get("/")
async def get_all_rules(current_user: dict = Depends(get_current_user)):
    """Get all email rules with current configuration"""
    
    # Get rules from DB or use defaults
    db_rules = await db.email_rules.find({}, {"_id": 0}).to_list(20)
    
    # If no rules in DB, initialize with defaults
    if not db_rules:
        now = datetime.now(timezone.utc).isoformat()
        for rule in DEFAULT_RULES:
            rule_copy = rule.copy()
            rule_copy["created_at"] = now
            rule_copy["updated_at"] = now
            await db.email_rules.insert_one(rule_copy)
        # Reload from DB to get clean documents without _id issues
        db_rules = await db.email_rules.find({}, {"_id": 0}).to_list(20)
    
    # Ensure all default rules exist
    existing_ids = {r["id"] for r in db_rules}
    for default_rule in DEFAULT_RULES:
        if default_rule["id"] not in existing_ids:
            rule_copy = default_rule.copy()
            rule_copy["created_at"] = datetime.now(timezone.utc).isoformat()
            rule_copy["updated_at"] = datetime.now(timezone.utc).isoformat()
            await db.email_rules.insert_one(rule_copy)
    
    # Reload to ensure clean data
    if len(existing_ids) < len(DEFAULT_RULES):
        db_rules = await db.email_rules.find({}, {"_id": 0}).to_list(20)
    
    # Sort by rule ID
    db_rules.sort(key=lambda x: x["id"])
    
    return {
        "rules": db_rules,
        "total": len(db_rules)
    }


@router.get("/{rule_id}")
async def get_rule(rule_id: str, current_user: dict = Depends(get_current_user)):
    """Get a specific email rule"""
    
    rule = await db.email_rules.find_one({"id": rule_id.upper()}, {"_id": 0})
    
    if not rule:
        # Try to find in defaults
        for default_rule in DEFAULT_RULES:
            if default_rule["id"] == rule_id.upper():
                return default_rule
        raise HTTPException(status_code=404, detail="Rule not found")
    
    return rule


@router.put("/{rule_id}")
async def update_rule(
    rule_id: str,
    updates: EmailRuleUpdate,
    current_user: dict = Depends(get_current_user)
):
    """Update an email rule configuration"""
    
    rule_id = rule_id.upper()
    
    # Check if rule exists
    existing = await db.email_rules.find_one({"id": rule_id})
    if not existing:
        # Initialize from defaults if not in DB
        default_rule = None
        for dr in DEFAULT_RULES:
            if dr["id"] == rule_id:
                default_rule = dr.copy()
                break
        
        if not default_rule:
            raise HTTPException(status_code=404, detail="Rule not found")
        
        default_rule["created_at"] = datetime.now(timezone.utc).isoformat()
        default_rule["updated_at"] = datetime.now(timezone.utc).isoformat()
        await db.email_rules.insert_one(default_rule)
        existing = default_rule
    
    # Build update dict
    update_data = {"updated_at": datetime.now(timezone.utc).isoformat()}
    
    for field, value in updates.dict(exclude_none=True).items():
        update_data[field] = value
    
    await db.email_rules.update_one(
        {"id": rule_id},
        {"$set": update_data}
    )
    
    # Return updated rule
    updated = await db.email_rules.find_one({"id": rule_id}, {"_id": 0})
    return updated


@router.post("/{rule_id}/toggle")
async def toggle_rule(
    rule_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Toggle a rule on/off"""
    
    rule_id = rule_id.upper()
    
    rule = await db.email_rules.find_one({"id": rule_id})
    
    # If rule doesn't exist in DB, initialize from defaults
    if not rule:
        default_rule = None
        for dr in DEFAULT_RULES:
            if dr["id"] == rule_id:
                default_rule = dr.copy()
                break
        
        if not default_rule:
            raise HTTPException(status_code=404, detail="Rule not found")
        
        default_rule["created_at"] = datetime.now(timezone.utc).isoformat()
        default_rule["updated_at"] = datetime.now(timezone.utc).isoformat()
        await db.email_rules.insert_one(default_rule)
        rule = default_rule
    
    new_state = not rule.get("enabled", True)
    
    await db.email_rules.update_one(
        {"id": rule_id},
        {"$set": {
            "enabled": new_state,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    return {"rule_id": rule_id, "enabled": new_state}


@router.post("/{rule_id}/test")
async def test_rule(
    rule_id: str,
    request_body: dict,
    current_user: dict = Depends(get_current_user)
):
    """Send a test email for a rule"""
    from services.email_queue import email_queue
    
    test_email = request_body.get("email")
    if not test_email:
        raise HTTPException(status_code=400, detail="Email es requerido")
    
    rule_id_upper = rule_id.upper()
    rule = await db.email_rules.find_one({"id": rule_id_upper}, {"_id": 0})
    
    if not rule:
        raise HTTPException(status_code=404, detail="Rule not found")
    
    # Generate test content
    subject = f"[TEST] {rule.get('name', rule_id_upper)}"
    body = f"""
    <p>Este es un email de prueba para la regla <strong>{rule_id_upper}: {rule.get('name')}</strong></p>
    <p><strong>Descripción:</strong> {rule.get('description', 'N/A')}</p>
    <p><strong>Cadencia:</strong> Cada {rule.get('cadence_days', 0)} días</p>
    <p><strong>Stages objetivo:</strong> {rule.get('target_stages', [])}</p>
    <p><strong>Roles objetivo:</strong> {rule.get('target_roles', [])}</p>
    <hr>
    <p><em>Este email fue enviado como prueba desde el panel de configuración.</em></p>
    """
    
    # Queue the test email
    email_id = await email_queue.add_to_queue(
        rule=f"{rule_id_upper}_TEST",
        contact_id="test",
        contact_email=test_email,
        contact_name="Test User",
        subject=subject,
        body_html=body,
        metadata={"is_test": True}
    )
    
    # Process immediately
    await email_queue.process_queue(max_emails=1)
    
    return {
        "success": True,
        "message": f"Test email queued and sent to {test_email}",
        "email_id": email_id
    }


# ============ QUEUE MANAGEMENT ENDPOINTS ============

@router.get("/queue/status")
async def get_queue_status(current_user: dict = Depends(get_current_user)):
    """Get current email queue status"""
    from services.email_queue import email_queue
    
    stats = await email_queue.get_queue_stats()
    
    # Get recent queue items
    recent_pending = await db.email_queue.find(
        {"status": "pending"},
        {"_id": 0, "id": 1, "rule": 1, "contact_email": 1, "scheduled_at": 1}
    ).sort("scheduled_at", 1).to_list(10)
    
    recent_sent = await db.email_queue.find(
        {"status": "sent"},
        {"_id": 0, "id": 1, "rule": 1, "contact_email": 1, "sent_at": 1}
    ).sort("sent_at", -1).to_list(10)
    
    return {
        "stats": stats,
        "next_pending": recent_pending,
        "recently_sent": recent_sent
    }


@router.post("/queue/process")
async def process_queue_manually(
    max_emails: int = 50,
    current_user: dict = Depends(get_current_user)
):
    """Manually trigger queue processing"""
    from services.email_queue import email_queue
    
    results = await email_queue.process_queue(max_emails=max_emails)
    
    return {
        "success": True,
        "processed": results
    }


@router.post("/queue/schedule-webinar/{event_id}")
async def schedule_webinar_emails(
    event_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Manually schedule E6-E10 emails for a webinar event"""
    from services.email_scheduler import email_scheduler
    
    # Verify event exists
    event = await db.webinar_events_v2.find_one({"id": event_id}, {"_id": 0, "name": 1})
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    
    # Schedule E6
    from routers.contact_imports import schedule_e6_for_batch
    e6_count = await schedule_e6_for_batch(event_id, 999)  # 999 = process all recent
    
    # Schedule E7-E10
    reminder_counts = await email_scheduler.schedule_webinar_reminders(event_id)
    
    return {
        "success": True,
        "event_id": event_id,
        "event_name": event.get("name"),
        "scheduled": {
            "E06": e6_count,
            **reminder_counts
        }
    }


@router.delete("/queue/{email_id}")
async def cancel_queued_email(
    email_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Cancel a pending email in the queue"""
    from services.email_queue import email_queue
    
    success = await email_queue.cancel_email(email_id)
    
    if not success:
        raise HTTPException(status_code=404, detail="Email not found or already sent")
    
    return {"success": True, "cancelled": email_id}


# ============ SEND TO SUBGROUP ENDPOINT ============

class SendToSubgroupRequest(BaseModel):
    rule_id: str
    group_key: str
    subgroup_key: Optional[str] = None
    contact_ids: List[str]
    subject: str
    body_html: str
    sender_name: str = "María Gargari"


@router.post("/send-to-subgroup")
async def send_to_subgroup(
    request: SendToSubgroupRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Send emails to all contacts in a subgroup immediately.
    This replaces the previous generate -> queue -> process flow.
    """
    from services.email_service import email_service
    import os
    
    rule_id = request.rule_id.upper()
    
    # Get rule info
    rule = await db.email_rules.find_one({"id": rule_id}, {"_id": 0})
    if not rule:
        raise HTTPException(status_code=404, detail=f"Regla {rule_id} no encontrada")
    
    # Get contacts
    contact_ids = request.contact_ids
    if not contact_ids:
        raise HTTPException(status_code=400, detail="No hay contactos para enviar")
    
    # Fetch contact details from database
    contacts = await db.unified_contacts.find(
        {"id": {"$in": contact_ids}},
        {"_id": 0, "id": 1, "name": 1, "email": 1, "company": 1}
    ).to_list(None)
    
    if not contacts:
        raise HTTPException(status_code=400, detail="No se encontraron contactos válidos")
    
    # Prepare sender
    sender_email = os.environ.get("SENDER_EMAIL", "contact@leaderlix.com")
    sender = f"{request.sender_name} <{sender_email}>"
    
    sent_count = 0
    failed_count = 0
    errors = []
    
    # Get webinar info if applicable (for variable substitution)
    webinar_info = {}
    if request.group_key and WEBINAR_RULES.count(rule_id) > 0:
        # Try to get webinar info from group_key (webinar_id)
        webinar = await db.webinar_events_v2.find_one(
            {"id": request.group_key},
            {"_id": 0, "name": 1, "date": 1, "time": 1, "link": 1}
        )
        if webinar:
            webinar_info = {
                "webinar_name": webinar.get("name", ""),
                "webinar_date": webinar.get("date", ""),
                "webinar_time": webinar.get("time", ""),
                "webinar_link": webinar.get("link", "")
            }
    
    # Send emails one by one
    for contact in contacts:
        contact_email = contact.get("email")
        if not contact_email:
            failed_count += 1
            errors.append(f"Contact {contact.get('id')} has no email")
            continue
        
        # Normalize email
        if isinstance(contact_email, list):
            contact_email = contact_email[0] if contact_email else None
        if not contact_email:
            failed_count += 1
            continue
        
        # Prepare variables for substitution
        # Extract first name only from full name
        full_name = contact.get("name", "")
        first_name = full_name.split(" ")[0] if full_name else ""
        
        variables = {
            "contact_name": first_name,
            "company": contact.get("company", ""),
            **webinar_info
        }
        
        # Replace variables in subject and body
        subject = request.subject
        body = request.body_html
        
        for key, value in variables.items():
            subject = subject.replace(f"{{{key}}}", str(value) if value else "")
            body = body.replace(f"{{{key}}}", str(value) if value else "")
        
        try:
            # Send email using email service
            result = await email_service.send_email(
                to_email=contact_email,
                subject=subject,
                html_content=body,
                sender=sender
            )
            
            if result.get("success"):
                sent_count += 1
                
                # Log the sent email
                await db.email_logs.insert_one({
                    "id": str(uuid.uuid4()),
                    "contact_id": contact.get("id"),
                    "contact_email": contact_email,
                    "rule": rule_id,
                    "subject": subject,
                    "status": "sent",
                    "sent_at": datetime.now(timezone.utc).isoformat(),
                    "sent_by": current_user.get("email"),
                    "group_key": request.group_key,
                    "subgroup_key": request.subgroup_key,
                    "message_id": result.get("message_id")
                })
                
                # Update contact's last email sent for this rule
                await db.unified_contacts.update_one(
                    {"id": contact.get("id")},
                    {"$set": {f"last_email_{rule_id.lower()}_sent": datetime.now(timezone.utc).isoformat()}}
                )
                
                # Remove from email queue (mark as sent or delete)
                await db.email_queue.update_many(
                    {
                        "contact_id": contact.get("id"),
                        "rule": rule_id,
                        "status": "pending"
                    },
                    {"$set": {"status": "sent", "sent_at": datetime.now(timezone.utc).isoformat()}}
                )
            else:
                failed_count += 1
                errors.append(f"{contact_email}: {result.get('error', 'Unknown error')}")
                
        except Exception as e:
            failed_count += 1
            errors.append(f"{contact_email}: {str(e)}")
    
    return {
        "success": True,
        "sent_count": sent_count,
        "failed_count": failed_count,
        "total": len(contacts),
        "errors": errors[:5] if errors else []  # Return first 5 errors
    }


# Check if rule is webinar-related
WEBINAR_RULES = ["E01", "E06", "E07", "E08", "E09", "E10"]


# ============ BACKGROUND JOB SYSTEM ============

import asyncio
from typing import Optional as Opt

# Global variable to track if a job is running in this process
_generation_task: Opt[asyncio.Task] = None


async def _run_email_generation_job(job_id: str, rules_to_process: list, max_per_rule: int):
    """
    Background job that generates emails for all eligible contacts.
    Updates progress in MongoDB so frontend can poll for status.
    """
    from services.email_queue import email_queue
    import logging
    logger = logging.getLogger(__name__)
    
    valid_rules = ["E01", "E02", "E03", "E04", "E05", "E06", "E07", "E08", "E09", "E10"]
    results = {}
    total_queued = 0
    total_processed = 0
    total_rules = len([r for r in rules_to_process if r in valid_rules])
    
    try:
        # First, cleanup contacts that no longer meet criteria
        await db.email_generation_jobs.update_one(
            {"id": job_id},
            {"$set": {
                "status_message": "Limpiando contactos obsoletos...",
                "updated_at": datetime.now(timezone.utc).isoformat()
            }}
        )
        cleanup_count = await cleanup_email_queue()
        logger.info(f"Email queue cleanup removed {cleanup_count} obsolete items")
        
        for rule_index, rule_id in enumerate(rules_to_process):
            if rule_id not in valid_rules:
                results[rule_id] = {"error": "Invalid rule"}
                continue
            
            # Update status: starting rule
            await db.email_generation_jobs.update_one(
                {"id": job_id},
                {"$set": {
                    "current_rule": rule_id,
                    "current_rule_index": rule_index + 1,
                    "total_rules": total_rules,
                    "status_message": f"Procesando regla {rule_id}...",
                    "updated_at": datetime.now(timezone.utc).isoformat()
                }}
            )
            
            # Check if rule is enabled
            rule_config = await db.email_rules.find_one({"id": rule_id}, {"_id": 0})
            if rule_config and not rule_config.get("enabled", True):
                results[rule_id] = {"skipped": "Rule is disabled"}
                continue
            
            try:
                # Update status: finding contacts
                await db.email_generation_jobs.update_one(
                    {"id": job_id},
                    {"$set": {
                        "status_message": f"Buscando contactos para {rule_id}...",
                        "updated_at": datetime.now(timezone.utc).isoformat()
                    }}
                )
                
                # Get eligible contacts for this rule
                contacts = await get_eligible_contacts_for_rule(rule_id, max_per_rule)
                
                # Update status: found contacts
                await db.email_generation_jobs.update_one(
                    {"id": job_id},
                    {"$set": {
                        "status_message": f"{rule_id}: Encontrados {len(contacts)} contactos, generando emails...",
                        "contacts_found_current_rule": len(contacts),
                        "updated_at": datetime.now(timezone.utc).isoformat()
                    }}
                )
                
                queued = 0
                skipped = 0
                errors = 0
                
                # OPTIMIZATION: Pre-load existing emails in queue to avoid individual queries
                existing_in_queue = set()
                existing_cursor = db.email_queue.find(
                    {"rule": rule_id, "status": "pending"},
                    {"_id": 0, "contact_id": 1, "metadata.webinar_id": 1}
                )
                async for doc in existing_cursor:
                    key = doc.get("contact_id", "")
                    if rule_id in ["E06", "E07", "E08", "E09", "E10"]:
                        webinar_id = doc.get("metadata", {}).get("webinar_id", "")
                        key = f"{key}_{webinar_id}"
                    existing_in_queue.add(key)
                
                # OPTIMIZATION: Batch insert emails
                batch_size = 500
                emails_to_insert = []
                
                for contact_index, contact in enumerate(contacts):
                    try:
                        # Update progress every 100 contacts (less frequent)
                        if contact_index % 100 == 0:
                            await db.email_generation_jobs.update_one(
                                {"id": job_id},
                                {"$set": {
                                    "status_message": f"{rule_id}: Procesando {contact_index + 1}/{len(contacts)} contactos...",
                                    "contacts_processed_current_rule": contact_index + 1,
                                    "total_queued": total_queued + queued,
                                    "updated_at": datetime.now(timezone.utc).isoformat()
                                }}
                            )
                        
                        # Check if already in queue (using pre-loaded set - O(1) lookup)
                        contact_id = contact["contact_id"]
                        if rule_id in ["E06", "E07", "E08", "E09", "E10"]:
                            lookup_key = f"{contact_id}_{contact.get('webinar_id', '')}"
                        else:
                            lookup_key = contact_id
                        
                        if lookup_key in existing_in_queue:
                            skipped += 1
                            continue
                        
                        # Generate email content (template - instant)
                        email_content = await generate_email_for_contact(rule_id, contact, rule_config)
                        
                        if not email_content:
                            errors += 1
                            continue
                        
                        # Prepare email document for batch insert
                        email_id = str(uuid.uuid4())
                        now_iso = datetime.now(timezone.utc).isoformat()
                        emails_to_insert.append({
                            "id": email_id,
                            "rule": rule_id,
                            "contact_id": contact_id,
                            "contact_email": contact["email"],
                            "contact_name": contact.get("name", ""),
                            "subject": email_content["subject"],
                            "body_html": email_content["body"],
                            "body_text": "",
                            "scheduled_at": now_iso,
                            "status": "pending",
                            "attempts": 0,
                            "sent_at": None,
                            "error": None,
                            "message_id": None,
                            "metadata": {
                                "company": contact.get("company"),
                                "buyer_persona": contact.get("buyer_persona"),
                                "webinar_name": contact.get("webinar_name"),
                                "webinar_date": contact.get("webinar_date"),
                                "webinar_id": contact.get("webinar_id")
                            },
                            "created_at": now_iso,
                            "updated_at": now_iso
                        })
                        queued += 1
                        
                        # Batch insert when we have enough
                        if len(emails_to_insert) >= batch_size:
                            await db.email_queue.insert_many(emails_to_insert)
                            logger.info(f"Batch inserted {len(emails_to_insert)} emails for {rule_id}")
                            emails_to_insert = []
                        
                    except Exception as e:
                        errors += 1
                        logger.error(f"Error processing contact {contact.get('contact_id')}: {e}")
                        continue
                
                # Insert remaining emails
                if emails_to_insert:
                    await db.email_queue.insert_many(emails_to_insert)
                    logger.info(f"Final batch inserted {len(emails_to_insert)} emails for {rule_id}")
                
                results[rule_id] = {
                    "eligible": len(contacts),
                    "queued": queued,
                    "skipped": skipped,
                    "errors": errors
                }
                total_queued += queued
                total_processed += len(contacts)
                
            except Exception as e:
                results[rule_id] = {"error": str(e)}
                logger.error(f"Error processing rule {rule_id}: {e}")
        
        # Job completed successfully
        await db.email_generation_jobs.update_one(
            {"id": job_id},
            {"$set": {
                "status": "completed",
                "status_message": f"Completado: {total_queued} emails generados",
                "total_queued": total_queued,
                "total_processed": total_processed,
                "results": results,
                "completed_at": datetime.now(timezone.utc).isoformat(),
                "updated_at": datetime.now(timezone.utc).isoformat()
            }}
        )
        logger.info(f"Email generation job {job_id} completed: {total_queued} emails queued")
        
    except Exception as e:
        # Job failed
        logger.error(f"Email generation job {job_id} failed: {e}")
        await db.email_generation_jobs.update_one(
            {"id": job_id},
            {"$set": {
                "status": "failed",
                "status_message": f"Error: {str(e)}",
                "error": str(e),
                "results": results,
                "completed_at": datetime.now(timezone.utc).isoformat(),
                "updated_at": datetime.now(timezone.utc).isoformat()
            }}
        )


@router.post("/generate-all")
async def generate_all_emails(
    rules: str = "E1,E2,E3,E4,E5,E6,E7,E8,E9,E10",
    max_per_rule: int = 0,
    current_user: dict = Depends(get_current_user)
):
    """
    Start a background job to generate and queue emails for all eligible contacts.
    Returns immediately with a job_id that can be polled for progress.
    
    Args:
        rules: Comma-separated list of rules to process (default: all E1-E10)
        max_per_rule: Maximum emails to generate per rule (0 = no limit)
    """
    global _generation_task
    
    # Check if there's already a job running
    existing_job = await db.email_generation_jobs.find_one(
        {"status": "running"},
        {"_id": 0}
    )
    
    if existing_job:
        return {
            "success": False,
            "error": "Ya hay una generación en progreso",
            "job_id": existing_job.get("id"),
            "status": "already_running"
        }
    
    # Create new job
    job_id = str(uuid.uuid4())
    rules_to_process = [r.strip().upper() for r in rules.split(",")]
    
    job_doc = {
        "id": job_id,
        "status": "running",
        "status_message": "Iniciando generación de emails...",
        "rules_to_process": rules_to_process,
        "max_per_rule": max_per_rule,
        "current_rule": None,
        "current_rule_index": 0,
        "total_rules": len(rules_to_process),
        "contacts_found_current_rule": 0,
        "contacts_processed_current_rule": 0,
        "total_queued": 0,
        "total_processed": 0,
        "results": {},
        "started_by": current_user.get("email"),
        "started_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "completed_at": None,
        "error": None
    }
    
    await db.email_generation_jobs.insert_one(job_doc)
    
    # Start background task
    _generation_task = asyncio.create_task(
        _run_email_generation_job(job_id, rules_to_process, max_per_rule)
    )
    
    return {
        "success": True,
        "job_id": job_id,
        "status": "started",
        "message": "Generación iniciada en segundo plano. Consulta el progreso con GET /generation-status"
    }


@router.post("/generation-cancel")
async def cancel_generation(current_user: dict = Depends(get_current_user)):
    """Cancel the current running generation job"""
    global _generation_task
    
    # Find running job
    job = await db.email_generation_jobs.find_one({"status": "running"})
    
    if not job:
        return {"success": False, "message": "No hay trabajo en ejecución"}
    
    # Cancel the task if it exists
    if _generation_task and not _generation_task.done():
        _generation_task.cancel()
    
    # Update job status
    await db.email_generation_jobs.update_one(
        {"id": job.get("id")},
        {"$set": {
            "status": "cancelled",
            "status_message": "Cancelado por el usuario",
            "completed_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    return {
        "success": True,
        "message": "Generación cancelada",
        "total_queued_before_cancel": job.get("total_queued", 0)
    }


def _normalize_email(email_value) -> str:
    """Normalize email field that could be string or list to lowercase string"""
    if email_value is None:
        return ""
    if isinstance(email_value, list):
        # If it's a list, take the first valid email
        for e in email_value:
            if isinstance(e, str) and "@" in e:
                return e.lower().strip()
        return ""
    if isinstance(email_value, str):
        return email_value.lower().strip() if "@" in email_value else ""
    return ""


async def cleanup_email_queue():
    """
    Clean up email queue items for contacts that no longer meet criteria.
    - E03: Removes contacts no longer in Stage 4 or without coachee role
    - E05: Removes contacts no longer in Stage 5 or without coachee role
    """
    cleanup_count = 0
    
    # E03 cleanup: contacts must be Stage 4 + coachee
    e03_items = await db.email_queue.find(
        {"rule": "E03", "status": "pending"},
        {"_id": 0, "contact_id": 1}
    ).to_list(5000)
    
    if e03_items:
        e03_to_remove = []
        for item in e03_items:
            contact_id = item.get("contact_id")
            contact = await db.unified_contacts.find_one(
                {"id": contact_id},
                {"_id": 0, "stage": 1, "roles": 1}
            )
            
            if not contact:
                e03_to_remove.append(contact_id)
                continue
            
            is_stage_4 = contact.get("stage") == 4
            has_coachee = any(r.lower() == "coachee" for r in (contact.get("roles") or []))
            
            if not is_stage_4 or not has_coachee:
                e03_to_remove.append(contact_id)
        
        if e03_to_remove:
            result = await db.email_queue.delete_many({
                "rule": "E03",
                "status": "pending",
                "contact_id": {"$in": e03_to_remove}
            })
            cleanup_count += result.deleted_count
    
    # E05 cleanup: contacts must be Stage 5 + coachee
    e05_items = await db.email_queue.find(
        {"rule": "E05", "status": "pending"},
        {"_id": 0, "contact_id": 1}
    ).to_list(5000)
    
    if e05_items:
        e05_to_remove = []
        for item in e05_items:
            contact_id = item.get("contact_id")
            contact = await db.unified_contacts.find_one(
                {"id": contact_id},
                {"_id": 0, "stage": 1, "roles": 1}
            )
            
            if not contact:
                e05_to_remove.append(contact_id)
                continue
            
            is_stage_5 = contact.get("stage") == 5
            has_coachee = any(r.lower() == "coachee" for r in (contact.get("roles") or []))
            
            if not is_stage_5 or not has_coachee:
                e05_to_remove.append(contact_id)
        
        if e05_to_remove:
            result = await db.email_queue.delete_many({
                "rule": "E05",
                "status": "pending",
                "contact_id": {"$in": e05_to_remove}
            })
            cleanup_count += result.deleted_count
    
    return cleanup_count


async def get_eligible_contacts_for_rule(rule_id: str, limit: int = 0) -> list:
    """Get contacts eligible for a specific email rule. limit=0 means no limit."""
    from utils.contact_helpers import build_cadence_query, CADENCE_PERIODS
    
    now = datetime.now(timezone.utc)
    contacts = []
    max_contacts = limit if limit > 0 else 50000  # Use high number if no limit
    
    if rule_id == "E01":
        # E1: Stage 1-2, not registered to future webinar, matched by buyer_persona
        cadence_query = build_cadence_query("last_email_e1_sent", CADENCE_PERIODS.get("email_e1", 7))
        
        # Get future webinars with their buyer_personas
        future_webinars = await db.webinar_events_v2.find(
            {"webinar_date": {"$gte": now.strftime("%Y-%m-%d")}},
            {"_id": 0, "id": 1, "name": 1, "webinar_date": 1, "webinar_time": 1, 
             "buyer_personas": 1, "registrants": 1, "watching_room_url": 1}
        ).sort("webinar_date", 1).to_list(100)
        
        if not future_webinars:
            return []
        
        # Build set of registered emails per webinar
        webinar_registered = {}
        for webinar in future_webinars:
            registered_emails = set()
            for reg in webinar.get("registrants", []):
                email = _normalize_email(reg.get("email"))
                if email:
                    registered_emails.add(email)
            webinar_registered[webinar["id"]] = registered_emails
        
        # Get all registered emails across all webinars
        all_registered = set()
        for emails in webinar_registered.values():
            all_registered.update(emails)
        
        # Get eligible contacts (Stage 1-2, valid email, cadence OK)
        query = {
            "stage": {"$in": [1, 2]},
            "email": {"$type": "string", "$regex": "@"},
            "buyer_persona": {"$exists": True, "$nin": [None, ""]},
            **cadence_query
        }
        
        raw_contacts = await db.unified_contacts.find(
            query,
            {"_id": 0, "id": 1, "name": 1, "email": 1, "company": 1, "buyer_persona": 1}
        ).limit(max_contacts).to_list(max_contacts)
        
        # Match contacts to webinars by buyer_persona
        for c in raw_contacts:
            email = _normalize_email(c.get("email"))
            if not email:
                continue
            
            # Skip if already registered to any future webinar
            if email in all_registered:
                continue
            
            contact_bp = (c.get("buyer_persona") or "").lower().strip()
            if not contact_bp:
                continue
            
            # Find matching webinar for this contact's buyer_persona
            for webinar in future_webinars:
                webinar_bps = [bp.lower().strip() for bp in webinar.get("buyer_personas", [])]
                
                if contact_bp in webinar_bps:
                    contacts.append({
                        "contact_id": c["id"],
                        "name": c.get("name", ""),
                        "email": email,
                        "company": c.get("company"),
                        "buyer_persona": c.get("buyer_persona"),
                        "webinar_id": webinar["id"],
                        "webinar_name": webinar.get("name"),
                        "webinar_date": webinar.get("webinar_date"),
                        "webinar_time": webinar.get("webinar_time"),
                        "watching_room_url": webinar.get("watching_room_url"),
                        "rule_type": "E01"
                    })
                    break  # Only match to first (closest) webinar
            
            if len(contacts) >= max_contacts:
                break
    
    elif rule_id == "E02":
        # E2: Stage 3 with quote + past calendar event after quote
        cadence_query = build_cadence_query("last_email_e2_sent", CADENCE_PERIODS.get("email_e2", 7))
        
        # Get emails with quotes
        quotes = await db.quotes.find(
            {"status": {"$ne": "cancelled"}},
            {"_id": 0, "client_email": 1, "created_at": 1}
        ).to_list(1000)
        
        quote_data = {}
        for q in quotes:
            email = _normalize_email(q.get("client_email"))
            if email:
                created = q.get("created_at", "")
                if email not in quote_data or created > quote_data[email]:
                    quote_data[email] = created
        
        raw_contacts = await db.unified_contacts.find(
            {
                "stage": 3,
                "email": {"$type": "string", "$regex": "@"},  # Valid email only
                **cadence_query
            },
            {"_id": 0, "id": 1, "name": 1, "email": 1, "company": 1, "buyer_persona": 1}
        ).to_list(max_contacts)
        
        for c in raw_contacts:
            email = _normalize_email(c.get("email"))
            if email and email in quote_data:
                contacts.append({
                    "contact_id": c["id"],
                    "name": c.get("name", ""),
                    "email": email,
                    "company": c.get("company"),
                    "buyer_persona": c.get("buyer_persona"),
                    "rule_type": "E02"
                })
                if len(contacts) >= max_contacts:
                    break
    
    elif rule_id == "E03":
        # E3: Stage 4 coachees without calendar event in 60 days
        cadence_query = build_cadence_query("last_email_e3_sent", CADENCE_PERIODS.get("email_e3", 7))
        
        raw_contacts = await db.unified_contacts.find(
            {
                "stage": 4,
                "roles": {"$in": ["coachee", "Coachee", "COACHEE"]},
                "email": {"$type": "string", "$regex": "@"},  # Valid email only
                **cadence_query
            },
            {"_id": 0, "id": 1, "name": 1, "email": 1, "company": 1, "buyer_persona": 1}
        ).to_list(max_contacts)
        
        for c in raw_contacts:
            email = _normalize_email(c.get("email"))
            if email:
                contacts.append({
                    "contact_id": c["id"],
                    "name": c.get("name", ""),
                    "email": email,
                    "company": c.get("company"),
                    "buyer_persona": c.get("buyer_persona"),
                    "rule_type": "E03"
                })
    
    elif rule_id == "E04":
        # E4: Stage 5 Deal Makers
        cadence_query = build_cadence_query("last_email_e4_sent", CADENCE_PERIODS.get("email_e4", 90))
        
        raw_contacts = await db.unified_contacts.find(
            {
                "stage": 5,
                "roles": {"$in": ["deal_maker", "Deal Maker", "dealmaker", "DealMaker"]},
                "email": {"$type": "string", "$regex": "@"},  # Valid email only
                **cadence_query
            },
            {"_id": 0, "id": 1, "name": 1, "email": 1, "company": 1, "buyer_persona": 1}
        ).to_list(max_contacts)
        
        for c in raw_contacts:
            email = _normalize_email(c.get("email"))
            if email:
                contacts.append({
                    "contact_id": c["id"],
                    "name": c.get("name", ""),
                    "email": email,
                    "company": c.get("company"),
                    "buyer_persona": c.get("buyer_persona"),
                    "rule_type": "E04"
                })
    
    elif rule_id == "E05":
        # E5: Stage 5 Coachees (alumni)
        cadence_query = build_cadence_query("last_email_e5_sent", CADENCE_PERIODS.get("email_e5", 90))
        
        raw_contacts = await db.unified_contacts.find(
            {
                "stage": 5,
                "roles": {"$in": ["coachee", "Coachee", "COACHEE"]},
                "email": {"$type": "string", "$regex": "@"},  # Valid email only
                **cadence_query
            },
            {"_id": 0, "id": 1, "name": 1, "email": 1, "company": 1, "buyer_persona": 1}
        ).to_list(max_contacts)
        
        for c in raw_contacts:
            email = _normalize_email(c.get("email"))
            if email:
                contacts.append({
                    "contact_id": c["id"],
                    "name": c.get("name", ""),
                    "email": email,
                    "company": c.get("company"),
                    "buyer_persona": c.get("buyer_persona"),
                    "rule_type": "E05"
                })
    
    elif rule_id == "E06":
        # E6: Contacts imported to webinar in last week, never sent E6 for that webinar
        # ONLY for future webinars
        one_week_ago = (now - timedelta(days=7)).isoformat()
        today_str = now.strftime("%Y-%m-%d")
        
        # Get future webinars to filter
        future_webinars = await db.webinar_events_v2.find(
            {"webinar_date": {"$gte": today_str}},
            {"_id": 0, "id": 1, "name": 1, "webinar_date": 1, "webinar_time": 1, "buyer_personas": 1}
        ).to_list(100)
        future_webinar_ids = {w["id"] for w in future_webinars}
        future_webinar_data = {w["id"]: w for w in future_webinars}
        
        # Get contacts with webinar registrations in last week
        raw_contacts = await db.unified_contacts.find({
            "webinar_history": {
                "$elemMatch": {
                    "registered_at": {"$gte": one_week_ago},
                    "source": {"$in": ["csv_import", "manual"]}
                }
            },
            "email": {"$type": "string", "$regex": "@"}  # Valid email only
        }, {"_id": 0}).to_list(max_contacts)
        
        for c in raw_contacts:
            email = _normalize_email(c.get("email"))
            if not email:
                continue
            
            e6_sent = c.get("last_email_e6_sent", {})
            
            for reg in c.get("webinar_history", []):
                webinar_id = reg.get("event_id")
                reg_date = reg.get("registered_at", "")
                
                if not webinar_id or reg_date < one_week_ago:
                    continue
                
                # Skip if webinar is in the past
                if webinar_id not in future_webinar_ids:
                    continue
                
                # Skip if E6 already sent for this webinar
                if webinar_id in e6_sent:
                    continue
                
                webinar_info = future_webinar_data.get(webinar_id, {})
                
                contacts.append({
                    "contact_id": c["id"],
                    "name": c.get("name", ""),
                    "email": email,
                    "company": c.get("company"),
                    "buyer_persona": c.get("buyer_persona"),
                    "webinar_id": webinar_id,
                    "webinar_name": webinar_info.get("name") or reg.get("event_name", "Webinar"),
                    "webinar_date": webinar_info.get("webinar_date"),
                    "webinar_time": webinar_info.get("webinar_time"),
                    "rule_type": "E06"
                })
                
                if len(contacts) >= max_contacts:
                    break
            
            if len(contacts) >= max_contacts:
                break
    
    elif rule_id in ["E07", "E08", "E09", "E10"]:
        # E7-E10: Webinar reminders based on time
        # Get future webinars
        future_events = await db.webinar_events_v2.find(
            {"webinar_date": {"$gte": now.strftime("%Y-%m-%d")}},
            {"_id": 0, "id": 1, "name": 1, "webinar_date": 1, "webinar_time": 1, "watching_room_url": 1}
        ).to_list(50)
        
        for event in future_events:
            event_id = event.get("id")
            event_name = event.get("name", "Webinar")
            event_date = event.get("webinar_date")
            event_time = event.get("webinar_time", "10:00")
            watching_room_url = event.get("watching_room_url", f"https://leaderlix.com/nurture/lms/webinar/{event_id}")
            
            try:
                event_datetime = datetime.fromisoformat(f"{event_date}T{event_time}:00")
                if event_datetime.tzinfo is None:
                    event_datetime = event_datetime.replace(tzinfo=timezone.utc)
            except (ValueError, TypeError):
                continue
            
            # Get registered contacts for this event
            registered = await db.unified_contacts.find({
                "webinar_history": {"$elemMatch": {"event_id": event_id, "status": "registered"}},
                "email": {"$type": "string", "$regex": "@"}  # Valid email only
            }, {"_id": 0, "id": 1, "name": 1, "email": 1, "last_email_e7_sent": 1, 
                "last_email_e8_sent": 1, "last_email_e9_sent": 1, "last_email_e10_sent": 1}).to_list(500)
            
            for c in registered:
                email = _normalize_email(c.get("email"))
                if not email:
                    continue
                
                # Check if already sent for this webinar
                sent_field = f"last_email_{rule_id.lower()}_sent"
                sent_map = c.get(sent_field, {})
                if event_id in sent_map:
                    continue
                
                contacts.append({
                    "contact_id": c["id"],
                    "name": c.get("name", ""),
                    "email": email,
                    "webinar_id": event_id,
                    "webinar_name": event_name,
                    "webinar_date": event_date,
                    "webinar_time": event_time,
                    "watching_room_url": watching_room_url,
                    "event_datetime": event_datetime.isoformat(),
                    "rule_type": rule_id
                })
                
                if len(contacts) >= max_contacts:
                    break
            
            if len(contacts) >= max_contacts:
                break
    
    return contacts


async def generate_email_for_contact(rule_id: str, contact: dict, rule_config: dict = None) -> dict:
    """Generate email subject and body for a contact based on rule template"""
    
    # Prepare variables for template substitution
    contact_name = contact.get("name", "").split()[0] if contact.get("name") else "Hola"
    company = contact.get("company", "tu empresa")
    webinar_name = contact.get("webinar_name", "nuestro próximo webinar")
    webinar_date = contact.get("webinar_date", "próximamente")
    webinar_time = contact.get("webinar_time", "")
    webinar_link = contact.get("watching_room_url", "https://leaderlix.com")
    
    # Template variables map
    variables = {
        "contact_name": contact_name,
        "company": company,
        "webinar_name": webinar_name,
        "webinar_date": webinar_date,
        "webinar_time": webinar_time,
        "webinar_link": webinar_link,
    }
    
    # Get templates from rule_config (from DB) or fallback to DEFAULT_RULES
    template_subject = None
    template_body = None
    
    if rule_config:
        template_subject = rule_config.get("template_subject")
        template_body = rule_config.get("template_body")
    
    # Fallback to DEFAULT_RULES if not in rule_config
    if not template_subject or not template_body:
        for default_rule in DEFAULT_RULES:
            if default_rule["id"] == rule_id:
                template_subject = template_subject or default_rule.get("template_subject", "Mensaje de Leaderlix")
                template_body = template_body or default_rule.get("template_body", "<p>Hola {contact_name}!</p>")
                break
    
    # Final fallback
    if not template_subject:
        template_subject = "Mensaje de Leaderlix"
    if not template_body:
        template_body = "<p>Hola {contact_name}!</p>"
    
    # Substitute variables in templates
    try:
        subject = template_subject.format(**variables)
    except KeyError:
        # If a variable is missing, use safe substitution
        subject = template_subject
        for key, value in variables.items():
            subject = subject.replace("{" + key + "}", str(value))
    
    try:
        body = template_body.format(**variables)
    except KeyError:
        # If a variable is missing, use safe substitution
        body = template_body
        for key, value in variables.items():
            body = body.replace("{" + key + "}", str(value))
    
    return {
        "subject": subject,
        "body": body
    }


@router.get("/stats/summary")
async def get_rules_stats(current_user: dict = Depends(get_current_user)):
    """Get statistics for all email rules"""
    from services.email_queue import email_queue
    
    queue_stats = await email_queue.get_queue_stats()
    
    # Get sent emails by rule in last 7 days
    seven_days_ago = (datetime.now(timezone.utc) - timedelta(days=7)).isoformat()
    
    pipeline = [
        {"$match": {"sent_at": {"$gte": seven_days_ago}}},
        {"$group": {
            "_id": "$rule",
            "sent": {"$sum": 1},
            "opened": {"$sum": {"$cond": ["$opened", 1, 0]}},
            "clicked": {"$sum": {"$cond": ["$clicked", 1, 0]}},
            "replied": {"$sum": {"$cond": ["$replied", 1, 0]}}
        }}
    ]
    
    stats_by_rule = await db.email_logs.aggregate(pipeline).to_list(20)
    
    return {
        "queue": queue_stats,
        "last_7_days": {
            item["_id"]: {
                "sent": item["sent"],
                "opened": item["opened"],
                "open_rate": round(item["opened"] / item["sent"] * 100, 1) if item["sent"] > 0 else 0,
                "clicked": item["clicked"],
                "replied": item["replied"]
            }
            for item in stats_by_rule
        }
    }


@router.post("/reset-defaults")
async def reset_to_defaults(current_user: dict = Depends(get_current_user)):
    """Reset all rules to default configuration"""
    
    now = datetime.now(timezone.utc).isoformat()
    
    for rule in DEFAULT_RULES:
        rule_copy = rule.copy()
        rule_copy["created_at"] = now
        rule_copy["updated_at"] = now
        await db.email_rules.update_one(
            {"id": rule_copy["id"]},
            {"$set": rule_copy},
            upsert=True
        )
    
    return {
        "success": True,
        "message": "All rules reset to defaults",
        "rules_count": len(DEFAULT_RULES)
    }
