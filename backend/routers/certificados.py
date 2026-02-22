"""
Certificados Router - Certificate generation for Leaderlix programs
"""
from fastapi import APIRouter, HTTPException, Depends, Response
from pydantic import BaseModel, EmailStr
from typing import List, Optional
from datetime import datetime, timezone
import uuid
from io import BytesIO

from database import db
from routers.auth import get_current_user

router = APIRouter(prefix="/certificados", tags=["certificados"])


# ============ MODELS ============

class CertificateRequest(BaseModel):
    email: EmailStr
    program_id: str
    level: str  # commitment, mastery, performance, results
    hours: int


class CertificateResponse(BaseModel):
    id: str
    certificate_number: str
    contact_name: str
    contact_email: str
    program_name: str
    level: str
    hours: int
    issue_date: str
    status: str


# ============ PROGRAMS CATALOG ============

PROGRAMS = [
    {"id": "escucha_activa", "name": "Escucha Activa y Manejo de Objeciones al Teléfono"},
    {"id": "datastory", "name": "Datastory: Cómo Usar Gráficos, Datos y Texto Efectivamente"},
    {"id": "arquetipos", "name": "Arquetipos Discursivos"},
    {"id": "entrevistas", "name": "Cómo dar Entrevistas Persuasivas para crear Cambios de Paradigma usando Medios de Comunicación"},
    {"id": "storyleading", "name": "Storyleading: Liderando Equipos con el Poder de las Historias"},
    {"id": "presentaciones_medicas", "name": "Presentaciones Médicas Asombrosas"},
    {"id": "elevator_pitch_medico", "name": "El Elevator Pitch Médico"},
    {"id": "storyselling", "name": "Storyselling: Presenta con Impacto para Más y Mejores Clientes"},
    {"id": "cultura_acuerdo", "name": "Cultura del Acuerdo"},
    {"id": "toma_decisiones", "name": "Toma de Decisiones en Organizaciones Descentralizadas"},
    {"id": "rockstars_ciencia", "name": "Rockstars de la Ciencia: Haciendo más Honda mi Huella en la Especialidad"},
    {"id": "lo_hago_contigo", "name": "Lo Hago Contigo - Coaching Ejecutivo"},
    {"id": "yo_te_enseno", "name": "Yo Te Enseño - Mentoring"},
    {"id": "masterclass", "name": "Masterclass In Company"},
]

LEVELS = [
    {"id": "commitment", "name": "Commitment", "description": "Nivel inicial de compromiso"},
    {"id": "mastery", "name": "Mastery", "description": "Dominio de habilidades"},
    {"id": "performance", "name": "Performance", "description": "Alto rendimiento"},
    {"id": "results", "name": "Results", "description": "Resultados demostrados"},
]


# ============ ENDPOINTS ============

@router.get("/catalog/programs")
async def get_programs_catalog():
    """Get available programs for certificates"""
    return {"programs": PROGRAMS}


@router.get("/catalog/levels")
async def get_levels_catalog():
    """Get available certificate levels"""
    return {"levels": LEVELS}


@router.get("/contacts-stage-4")
async def get_contacts_stage_4(current_user: dict = Depends(get_current_user)):
    """Get all contacts in Stage 4 (ready for certification)"""
    contacts = await db.unified_contacts.find(
        {"stage": 4},
        {"_id": 0, "id": 1, "name": 1, "email": 1, "company": 1, "job_title": 1}
    ).sort("name", 1).to_list(500)
    
    # Format for frontend dropdown
    formatted = []
    for c in contacts:
        name_parts = (c.get("name") or "").split(" ", 1)
        formatted.append({
            "id": c.get("id"),
            "firstname": name_parts[0] if name_parts else "",
            "lastname": name_parts[1] if len(name_parts) > 1 else "",
            "name": c.get("name", ""),
            "email": c.get("email", ""),
            "company": c.get("company", ""),
            "jobtitle": c.get("job_title", "")
        })
    
    return {"contacts": formatted, "count": len(formatted)}


@router.get("/search-contact")
async def search_contact_by_email(email: str):
    """Search for a contact by email in unified contacts"""
    # Query unified_contacts (primary source)
    contact = await db.unified_contacts.find_one(
        {"email": {"$regex": f"^{email}$", "$options": "i"}},
        {"_id": 0, "id": 1, "name": 1, "first_name": 1, "last_name": 1, "email": 1, "company": 1, "job_title": 1}
    )
    
    if contact:
        # Build consistent response format
        firstname = contact.get("first_name") or ""
        lastname = contact.get("last_name") or ""
        if not firstname and not lastname and contact.get("name"):
            name_parts = contact["name"].split(" ", 1)
            firstname = name_parts[0] if name_parts else ""
            lastname = name_parts[1] if len(name_parts) > 1 else ""
        
        return {
            "found": True,
            "contact": {
                "id": contact.get("id"),
                "firstname": firstname,
                "lastname": lastname,
                "email": contact.get("email"),
                "company": contact.get("company"),
                "jobtitle": contact.get("job_title")
            }
        }
    
    raise HTTPException(status_code=404, detail="Contacto no encontrado en la base de datos")


@router.post("/generate", response_model=CertificateResponse)
async def generate_certificate(
    data: CertificateRequest,
    current_user: dict = Depends(get_current_user)
):
    """Generate a new certificate"""
    
    # Validate program
    program = next((p for p in PROGRAMS if p["id"] == data.program_id), None)
    if not program:
        raise HTTPException(status_code=400, detail="Programa inválido")
    
    # Validate level
    level_obj = next((lv for lv in LEVELS if lv["id"] == data.level), None)
    if not level_obj:
        raise HTTPException(status_code=400, detail="Nivel inválido")
    
    # Search contact in unified_contacts (primary source)
    contact = await db.unified_contacts.find_one(
        {"email": {"$regex": f"^{data.email}$", "$options": "i"}},
        {"_id": 0, "id": 1, "name": 1, "first_name": 1, "last_name": 1, "email": 1, "company": 1}
    )
    
    contact_name = None
    contact_id = None
    company = ""
    
    if contact:
        # Build name from available fields
        firstname = contact.get("first_name") or ""
        lastname = contact.get("last_name") or ""
        if firstname or lastname:
            contact_name = f"{firstname} {lastname}".strip()
        else:
            contact_name = contact.get("name", "")
        contact_id = contact.get("id")
        company = contact.get("company", "")
    
    if not contact_name:
        raise HTTPException(status_code=404, detail="Contacto no encontrado")
    
    if not contact_name:
        contact_name = data.email.split("@")[0].title()
    
    # Generate certificate number
    count = await db.certificates.count_documents({})
    certificate_number = f"CERT-{datetime.now().year}-{str(count + 1).zfill(5)}"
    
    now = datetime.now(timezone.utc)
    
    cert_doc = {
        "id": str(uuid.uuid4()),
        "certificate_number": certificate_number,
        "contact_id": contact_id,
        "contact_name": contact_name,
        "contact_email": data.email,
        "company": company,
        "program_id": data.program_id,
        "program_name": program["name"],
        "level": data.level,
        "level_name": level_obj["name"],
        "hours": data.hours,
        "issue_date": now.strftime("%Y-%m-%d"),
        "status": "issued",
        "created_by": current_user.get("email"),
        "created_at": now.isoformat(),
    }
    
    await db.certificates.insert_one(cert_doc)
    
    return CertificateResponse(
        id=cert_doc["id"],
        certificate_number=certificate_number,
        contact_name=contact_name,
        contact_email=data.email,
        program_name=program["name"],
        level=level_obj["name"],
        hours=data.hours,
        issue_date=cert_doc["issue_date"],
        status="issued"
    )


@router.get("/list")
async def list_certificates(
    limit: int = 50,
    current_user: dict = Depends(get_current_user)
):
    """List all generated certificates"""
    certs = await db.certificates.find(
        {},
        {"_id": 0}
    ).sort("created_at", -1).limit(limit).to_list(limit)
    
    return {"certificates": certs, "total": len(certs)}


@router.get("/{certificate_id}")
async def get_certificate(
    certificate_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get a specific certificate"""
    cert = await db.certificates.find_one({"id": certificate_id}, {"_id": 0})
    if not cert:
        raise HTTPException(status_code=404, detail="Certificado no encontrado")
    return cert


@router.get("/{certificate_id}/pdf")
async def generate_certificate_pdf(
    certificate_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Generate PDF for a certificate"""
    cert = await db.certificates.find_one({"id": certificate_id}, {"_id": 0})
    if not cert:
        raise HTTPException(status_code=404, detail="Certificado no encontrado")
    
    # Generate PDF using reportlab
    from reportlab.lib import colors
    from reportlab.lib.pagesizes import landscape, letter
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib.units import inch
    from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, Image
    from reportlab.lib.enums import TA_CENTER
    from reportlab.pdfgen import canvas
    from reportlab.pdfbase import pdfmetrics
    from reportlab.pdfbase.ttfonts import TTFont
    
    buffer = BytesIO()
    
    # Use landscape letter size for certificate
    page_width, page_height = landscape(letter)
    
    # Create canvas directly for more control
    c = canvas.Canvas(buffer, pagesize=landscape(letter))
    
    # Colors
    dark_blue = colors.HexColor("#1e3a5f")
    gold = colors.HexColor("#c9a227")
    
    # Background gradient effect (simple rectangle)
    c.setFillColor(colors.white)
    c.rect(0, 0, page_width, page_height, fill=1)
    
    # Border
    c.setStrokeColor(gold)
    c.setLineWidth(3)
    c.rect(30, 30, page_width - 60, page_height - 60, stroke=1, fill=0)
    
    # Inner border
    c.setStrokeColor(dark_blue)
    c.setLineWidth(1)
    c.rect(45, 45, page_width - 90, page_height - 90, stroke=1, fill=0)
    
    # Header - LEADERLIX
    c.setFillColor(dark_blue)
    c.setFont("Helvetica-Bold", 28)
    c.drawCentredString(page_width / 2, page_height - 100, "LEADERLIX")
    
    # Subtitle
    c.setFont("Helvetica", 12)
    c.setFillColor(colors.gray)
    c.drawCentredString(page_width / 2, page_height - 120, "Presenta tus Ideas como un Rockstar")
    
    # Certificate title
    c.setFillColor(gold)
    c.setFont("Helvetica-Bold", 36)
    c.drawCentredString(page_width / 2, page_height - 180, "CERTIFICADO")
    
    # Level badge
    c.setFillColor(dark_blue)
    c.setFont("Helvetica-Bold", 16)
    c.drawCentredString(page_width / 2, page_height - 210, f"Nivel: {cert.get('level_name', cert.get('level', ''))}")
    
    # "Se otorga a"
    c.setFillColor(colors.gray)
    c.setFont("Helvetica", 14)
    c.drawCentredString(page_width / 2, page_height - 260, "Se otorga a")
    
    # Participant name
    c.setFillColor(dark_blue)
    c.setFont("Helvetica-Bold", 32)
    c.drawCentredString(page_width / 2, page_height - 300, cert.get("contact_name", ""))
    
    # Line under name
    c.setStrokeColor(gold)
    c.setLineWidth(2)
    name_width = c.stringWidth(cert.get("contact_name", ""), "Helvetica-Bold", 32)
    c.line(page_width/2 - name_width/2 - 20, page_height - 310, 
           page_width/2 + name_width/2 + 20, page_height - 310)
    
    # "Por completar exitosamente"
    c.setFillColor(colors.gray)
    c.setFont("Helvetica", 12)
    c.drawCentredString(page_width / 2, page_height - 340, "Por completar exitosamente el programa")
    
    # Program name
    c.setFillColor(dark_blue)
    c.setFont("Helvetica-Bold", 18)
    
    # Handle long program names
    program_name = cert.get("program_name", "")
    if len(program_name) > 50:
        # Split into two lines
        words = program_name.split()
        mid = len(words) // 2
        line1 = " ".join(words[:mid])
        line2 = " ".join(words[mid:])
        c.drawCentredString(page_width / 2, page_height - 375, line1)
        c.drawCentredString(page_width / 2, page_height - 395, line2)
        hours_y = page_height - 430
    else:
        c.drawCentredString(page_width / 2, page_height - 380, program_name)
        hours_y = page_height - 415
    
    # Hours
    c.setFillColor(colors.gray)
    c.setFont("Helvetica", 12)
    c.drawCentredString(page_width / 2, hours_y, f"Duración: {cert.get('hours', 0)} horas")
    
    # Date and certificate number
    c.setFont("Helvetica", 10)
    c.drawCentredString(page_width / 2, 100, f"Fecha de emisión: {cert.get('issue_date', '')}")
    c.drawCentredString(page_width / 2, 85, f"Número de certificado: {cert.get('certificate_number', '')}")
    
    # Signature line
    c.setStrokeColor(dark_blue)
    c.setLineWidth(1)
    c.line(page_width/2 - 100, 140, page_width/2 + 100, 140)
    c.setFont("Helvetica", 10)
    c.setFillColor(colors.gray)
    c.drawCentredString(page_width / 2, 125, "Perla Esmeralda Muñoz")
    c.drawCentredString(page_width / 2, 110, "Directora General - Leaderlix")
    
    c.save()
    
    pdf_bytes = buffer.getvalue()
    buffer.close()
    
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f"attachment; filename=Certificado_{cert.get('certificate_number', 'CERT')}.pdf"
        }
    )


@router.delete("/{certificate_id}")
async def delete_certificate(
    certificate_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Delete a certificate"""
    result = await db.certificates.delete_one({"id": certificate_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Certificado no encontrado")
    return {"success": True, "message": "Certificado eliminado"}


@router.post("/{certificate_id}/send-email")
async def send_certificate_email(
    certificate_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Send certificate PDF via email using Amazon SES"""
    from services.email_service import email_service
    
    # Get certificate
    cert = await db.certificates.find_one({"id": certificate_id}, {"_id": 0})
    if not cert:
        raise HTTPException(status_code=404, detail="Certificado no encontrado")
    
    # Generate PDF bytes
    pdf_response = await generate_certificate_pdf(certificate_id, current_user)
    pdf_bytes = pdf_response.body
    
    # Send email with PDF attachment
    result = await email_service.send_certificate_email(
        recipient_email=cert.get("contact_email"),
        recipient_name=cert.get("contact_name"),
        certificate_number=cert.get("certificate_number"),
        program_name=cert.get("program_name"),
        level=cert.get("level_name", cert.get("level")),
        pdf_content=pdf_bytes
    )
    
    if result.get("success"):
        # Update certificate status
        await db.certificates.update_one(
            {"id": certificate_id},
            {"$set": {"email_sent": True, "email_sent_at": datetime.now(timezone.utc).isoformat()}}
        )
        return {"success": True, "message": f"Certificado enviado a {cert.get('contact_email')}"}
    else:
        raise HTTPException(status_code=500, detail=f"Error enviando email: {result.get('error')}")
