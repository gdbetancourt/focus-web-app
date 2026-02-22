"""
Cotizador Router v2 - Quote generation for Leaderlix coaching programs
Updated with new business logic
"""
from fastapi import APIRouter, HTTPException, Depends, Response
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone
import uuid
import httpx
import os

from database import db
from routers.auth import get_current_user

router = APIRouter(prefix="/cotizador", tags=["cotizador"])


# ============ MODELS ============

class GroupComposition(BaseModel):
    direccion: int = 0      # Directivos
    management: int = 0     # Gerentes
    operacion: int = 0      # Operativos

class ProjectObjectives(BaseModel):
    resultado_objetivo: str = ""           # Este programa tiene el objetivo de...
    resultado_descripcion: str = ""        # Describe el objetivo específico (Resultados)
    comportamiento_objetivo: str = ""      # Para acercarnos a este objetivo procuraremos...
    comportamiento_descripcion: str = ""   # Describe (Cambio de comportamiento)
    aprendizaje_objetivo: str = ""         # Lo haremos...
    aprendizaje_descripcion: str = ""      # Describe (Aprendizaje)
    experiencia_objetivo: str = ""         # Para hacerlo...
    experiencia_descripcion: str = ""      # Describe (Experiencia)

class QuoteCreate(BaseModel):
    # Contact selection (from Cierre)
    contact_id: Optional[str] = None
    
    # Or manual entry
    client_name: str = ""
    client_email: str = ""
    client_phone: str = ""
    company: str = ""
    
    # Group composition
    group: GroupComposition
    
    # Thematic axis for Masterclass/Course (if applicable)
    thematic_axis_id: Optional[str] = None
    
    # Project objectives
    objectives: ProjectObjectives
    
    # Leaderlix responsible
    leaderlix_responsible: str = ""
    valid_until: str = ""
    
    # Currency and discount
    currency: str = "USD"  # USD or MXN
    discount_percent: float = 0
    
    # Additional benefits (optional extras)
    additional_benefits: List[str] = []
    
    # PDF blocks to include (default includes all marked as default=True)
    pdf_blocks: Optional[List[str]] = None

class QuoteResponse(BaseModel):
    id: str
    quote_number: str
    client_name: str
    company: str
    total_participants: int
    total_before_discount: float
    discount_amount: float
    subtotal: float
    iva: float
    total: float
    currency: str
    status: str
    created_at: str


# ============ PRICING CONSTANTS ============

# Price per person for "Lo Hago Contigo" coaching
PRICE_PER_PERSON_USD = {
    "direccion": 3500,    # Directivos
    "management": 3000,   # Management  
    "operacion": 2500     # Operación
}

# Single person special price
SINGLE_PERSON_PRICE_USD = 3000

# Thresholds for included benefits
MASTERCLASS_THRESHOLD = 4  # 4+ personas incluye Masterclass
COURSE_THRESHOLD = 8       # 8+ personas incluye Curso Titular

# Additional benefits catalog (extras)
ADDITIONAL_BENEFITS = [
    {"id": "advisory_board", "name": "Advisory Board", "price_usd": 1000},
    {"id": "slideset_design", "name": "Slideset Design", "price_usd": 800},
    {"id": "mistery_listening", "name": "Mistery Listening", "price_usd": 600},
    {"id": "boletin_prensa", "name": "Boletín de prensa", "price_usd": 400},
    {"id": "materiales_impresos", "name": "Materiales impresos", "price_usd": 300},
    {"id": "materiales_vr", "name": "Materiales para realidad virtual", "price_usd": 1500},
    {"id": "materiales_video", "name": "Materiales para análisis en video", "price_usd": 700},
    {"id": "fotografia_evento", "name": "Fotografía del evento", "price_usd": 500},
    {"id": "story_brand_book", "name": "Story Brand Book", "price_usd": 2000},
    {"id": "integracion_lms_scorm", "name": "Integración LMS vía SCORM", "price_usd": 1200},
]

# PDF Modular Blocks - Sections that can be included/excluded from the quote PDF
PDF_BLOCKS = [
    {"id": "header", "name": "Encabezado con logo", "description": "Logo de Leaderlix y título de la cotización", "default": True, "order": 1},
    {"id": "quote_info", "name": "Información de cotización", "description": "Número, fecha, validez y responsable", "default": True, "order": 2},
    {"id": "client_info", "name": "Datos del cliente", "description": "Empresa, contacto y email", "default": True, "order": 3},
    {"id": "project_rationale", "name": "Racional del proyecto", "description": "Objetivos y justificación del programa", "default": True, "order": 4},
    {"id": "group_composition", "name": "Composición del grupo", "description": "Desglose de participantes por nivel", "default": True, "order": 5},
    {"id": "included_benefits", "name": "Beneficios incluidos", "description": "Lo que incluye el programa base", "default": True, "order": 6},
    {"id": "additional_benefits", "name": "Beneficios adicionales", "description": "Extras contratados", "default": True, "order": 7},
    {"id": "investment_summary", "name": "Resumen de inversión", "description": "Totales, descuentos e IVA", "default": True, "order": 8},
    {"id": "methodology", "name": "Metodología", "description": "Descripción del proceso de coaching", "default": False, "order": 9},
    {"id": "timeline", "name": "Cronograma sugerido", "description": "Calendario de sesiones propuesto", "default": False, "order": 10},
    {"id": "terms", "name": "Términos y condiciones", "description": "Políticas de pago y cancelación", "default": False, "order": 11},
    {"id": "footer", "name": "Pie de página", "description": "Información de contacto de Leaderlix", "default": True, "order": 12},
]


# ============ HELPER FUNCTIONS ============

async def get_exchange_rate() -> float:
    """Get current USD to MXN exchange rate from external API"""
    try:
        async with httpx.AsyncClient() as client:
            # Using exchangerate-api free tier
            response = await client.get(
                "https://api.exchangerate-api.com/v4/latest/USD",
                timeout=5.0
            )
            if response.status_code == 200:
                data = response.json()
                return data.get("rates", {}).get("MXN", 17.5)
    except Exception as e:
        print(f"Error fetching exchange rate: {e}")
    
    # Fallback rate
    return 17.5


def calculate_coaching_price(group: GroupComposition) -> dict:
    """Calculate coaching price based on group composition"""
    total_people = group.direccion + group.management + group.operacion
    
    if total_people == 0:
        return {"subtotal": 0, "breakdown": [], "total_people": 0}
    
    # Single person special pricing
    if total_people == 1:
        level = "direccion" if group.direccion else ("management" if group.management else "operacion")
        return {
            "subtotal": SINGLE_PERSON_PRICE_USD,
            "breakdown": [{"level": level, "quantity": 1, "unit_price": SINGLE_PERSON_PRICE_USD, "total": SINGLE_PERSON_PRICE_USD}],
            "total_people": 1
        }
    
    # Group pricing
    breakdown = []
    subtotal = 0
    
    if group.direccion > 0:
        price = PRICE_PER_PERSON_USD["direccion"]
        total = price * group.direccion
        breakdown.append({"level": "Dirección", "quantity": group.direccion, "unit_price": price, "total": total})
        subtotal += total
    
    if group.management > 0:
        price = PRICE_PER_PERSON_USD["management"]
        total = price * group.management
        breakdown.append({"level": "Management", "quantity": group.management, "unit_price": price, "total": total})
        subtotal += total
    
    if group.operacion > 0:
        price = PRICE_PER_PERSON_USD["operacion"]
        total = price * group.operacion
        breakdown.append({"level": "Operación", "quantity": group.operacion, "unit_price": price, "total": total})
        subtotal += total
    
    return {
        "subtotal": subtotal,
        "breakdown": breakdown,
        "total_people": total_people
    }


# ============ ENDPOINTS ============

@router.get("/exchange-rate")
async def get_current_exchange_rate():
    """Get current USD to MXN exchange rate"""
    rate = await get_exchange_rate()
    return {"usd_to_mxn": rate, "timestamp": datetime.now(timezone.utc).isoformat()}


@router.get("/catalog/benefits")
async def get_benefits_catalog():
    """Get available additional benefits"""
    return {"additional_benefits": ADDITIONAL_BENEFITS}


@router.get("/catalog/pdf-blocks")
async def get_pdf_blocks_catalog():
    """Get available PDF modular blocks"""
    return {"pdf_blocks": PDF_BLOCKS}


@router.get("/catalog/thematic-axes")
async def get_thematic_axes():
    """Get thematic axes for Masterclass/Course selection"""
    axes = await db.thematic_axes.find({}, {"_id": 0}).to_list(100)
    return {"thematic_axes": axes}


@router.get("/contacts/cierre")
async def get_cierre_contacts():
    """Get contacts in Cierre stage for quote selection"""
    # Query unified_contacts for stage 3 (Cierre)
    contacts = await db.unified_contacts.find(
        {"stage": 3},
        {"_id": 0, "id": 1, "first_name": 1, "last_name": 1, "name": 1, "email": 1, "company": 1, "job_title": 1, "phone": 1}
    ).sort("stage_changed_at", -1).to_list(500)
    
    # Transform to expected format
    for c in contacts:
        c["firstname"] = c.get("first_name", "")
        c["lastname"] = c.get("last_name", "")
        c["jobtitle"] = c.get("job_title", "")
        if not c.get("firstname") and not c.get("lastname") and c.get("name"):
            parts = c["name"].split(" ", 1)
            c["firstname"] = parts[0] if parts else ""
            c["lastname"] = parts[1] if len(parts) > 1 else ""
    
    return {"contacts": contacts}


@router.post("/calculate")
async def calculate_quote(data: QuoteCreate):
    """Calculate quote totals without saving"""
    
    # Get exchange rate
    exchange_rate = await get_exchange_rate()
    
    # Calculate coaching costs
    coaching = calculate_coaching_price(data.group)
    total_people = coaching["total_people"]
    
    # Determine included benefits
    includes_masterclass = total_people >= MASTERCLASS_THRESHOLD
    includes_course = total_people >= COURSE_THRESHOLD
    
    # Get thematic axis info if selected
    thematic_axis = None
    if data.thematic_axis_id:
        thematic_axis = await db.thematic_axes.find_one({"id": data.thematic_axis_id}, {"_id": 0})
    
    # Calculate additional benefits
    benefits_total_usd = 0
    selected_benefits = []
    for benefit_id in data.additional_benefits:
        benefit = next((b for b in ADDITIONAL_BENEFITS if b["id"] == benefit_id), None)
        if benefit:
            benefits_total_usd += benefit["price_usd"]
            selected_benefits.append(benefit)
    
    # Total in USD
    subtotal_usd = coaching["subtotal"] + benefits_total_usd
    
    # Apply discount
    discount_amount_usd = subtotal_usd * (data.discount_percent / 100) if data.discount_percent > 0 else 0
    after_discount_usd = subtotal_usd - discount_amount_usd
    
    # Calculate IVA (16%)
    iva_usd = after_discount_usd * 0.16
    total_usd = after_discount_usd + iva_usd
    
    # Convert to MXN if needed
    if data.currency == "MXN":
        multiplier = exchange_rate
        return {
            "coaching_subtotal": round(coaching["subtotal"] * multiplier, 2),
            "coaching_breakdown": [
                {**item, "unit_price": round(item["unit_price"] * multiplier, 2), "total": round(item["total"] * multiplier, 2)}
                for item in coaching["breakdown"]
            ],
            "benefits_total": round(benefits_total_usd * multiplier, 2),
            "selected_benefits": selected_benefits,
            "subtotal_before_discount": round(subtotal_usd * multiplier, 2),
            "discount_percent": data.discount_percent,
            "discount_amount": round(discount_amount_usd * multiplier, 2),
            "subtotal": round(after_discount_usd * multiplier, 2),
            "iva": round(iva_usd * multiplier, 2),
            "total": round(total_usd * multiplier, 2),
            "currency": "MXN",
            "exchange_rate": exchange_rate,
            "total_participants": total_people,
            "includes_masterclass": includes_masterclass,
            "includes_course": includes_course,
            "thematic_axis": thematic_axis
        }
    else:
        return {
            "coaching_subtotal": round(coaching["subtotal"], 2),
            "coaching_breakdown": coaching["breakdown"],
            "benefits_total": round(benefits_total_usd, 2),
            "selected_benefits": selected_benefits,
            "subtotal_before_discount": round(subtotal_usd, 2),
            "discount_percent": data.discount_percent,
            "discount_amount": round(discount_amount_usd, 2),
            "subtotal": round(after_discount_usd, 2),
            "iva": round(iva_usd, 2),
            "total": round(total_usd, 2),
            "currency": "USD",
            "exchange_rate": exchange_rate,
            "total_participants": total_people,
            "includes_masterclass": includes_masterclass,
            "includes_course": includes_course,
            "thematic_axis": thematic_axis
        }


@router.post("/quotes", response_model=QuoteResponse)
async def create_quote(data: QuoteCreate, current_user: dict = Depends(get_current_user)):
    """Create and save a new quote"""
    
    # If contact_id provided, get contact info from unified_contacts
    if data.contact_id:
        contact = await db.unified_contacts.find_one({"id": data.contact_id}, {"_id": 0})
        if contact:
            firstname = contact.get('first_name', '') or ''
            lastname = contact.get('last_name', '') or ''
            if not firstname and not lastname and contact.get('name'):
                parts = contact['name'].split(' ', 1)
                firstname = parts[0] if parts else ''
                lastname = parts[1] if len(parts) > 1 else ''
            data.client_name = f"{firstname} {lastname}".strip()
            data.client_email = contact.get("email", "")
            data.client_phone = contact.get("phone", "")
            data.company = contact.get("company", "")
    
    # Calculate totals
    calc = await calculate_quote(data)
    
    # Generate quote number
    count = await db.quotes.count_documents({})
    quote_number = f"LDX-{datetime.now().year}-{str(count + 1).zfill(4)}"
    
    now = datetime.now(timezone.utc).isoformat()
    
    # Get default PDF blocks if none specified
    selected_pdf_blocks = data.pdf_blocks
    if selected_pdf_blocks is None:
        selected_pdf_blocks = [b["id"] for b in PDF_BLOCKS if b.get("default", False)]
    
    quote_doc = {
        "id": str(uuid.uuid4()),
        "quote_number": quote_number,
        
        # Client info
        "contact_id": data.contact_id,
        "client_name": data.client_name,
        "client_email": data.client_email,
        "client_phone": data.client_phone,
        "company": data.company,
        
        # Group composition
        "group_direccion": data.group.direccion,
        "group_management": data.group.management,
        "group_operacion": data.group.operacion,
        "total_participants": calc["total_participants"],
        
        # Included benefits based on group size
        "includes_masterclass": calc["includes_masterclass"],
        "includes_course": calc["includes_course"],
        "thematic_axis_id": data.thematic_axis_id,
        "thematic_axis": calc.get("thematic_axis"),
        
        # Project objectives
        "objectives": data.objectives.dict(),
        
        # Additional info
        "leaderlix_responsible": data.leaderlix_responsible,
        "valid_until": data.valid_until or (datetime.now(timezone.utc).replace(day=1, month=datetime.now().month + 1 if datetime.now().month < 12 else 1)).strftime("%Y-%m-%d"),
        
        # Pricing
        "currency": data.currency,
        "exchange_rate": calc["exchange_rate"],
        "discount_percent": data.discount_percent,
        "additional_benefits": data.additional_benefits,
        
        # PDF blocks to include
        "pdf_blocks": selected_pdf_blocks,
        
        # Calculated totals
        "coaching_subtotal": calc["coaching_subtotal"],
        "coaching_breakdown": calc["coaching_breakdown"],
        "benefits_total": calc["benefits_total"],
        "subtotal_before_discount": calc["subtotal_before_discount"],
        "discount_amount": calc["discount_amount"],
        "subtotal": calc["subtotal"],
        "iva": calc["iva"],
        "total": calc["total"],
        
        # Metadata
        "status": "draft",
        "created_by": current_user.get("email"),
        "created_at": now,
        "updated_at": now
    }
    
    await db.quotes.insert_one(quote_doc)
    
    return QuoteResponse(
        id=quote_doc["id"],
        quote_number=quote_number,
        client_name=data.client_name,
        company=data.company,
        total_participants=calc["total_participants"],
        total_before_discount=calc["subtotal_before_discount"],
        discount_amount=calc["discount_amount"],
        subtotal=calc["subtotal"],
        iva=calc["iva"],
        total=calc["total"],
        currency=data.currency,
        status="draft",
        created_at=now
    )


@router.get("/quotes")
async def list_quotes(
    status: Optional[str] = None,
    limit: int = 50,
    current_user: dict = Depends(get_current_user)
):
    """List all quotes"""
    query = {}
    if status:
        query["status"] = status
    
    quotes = await db.quotes.find(query, {"_id": 0}).sort("created_at", -1).limit(limit).to_list(limit)
    
    return {"quotes": quotes, "total": len(quotes)}


@router.get("/quotes/{quote_id}")
async def get_quote(quote_id: str, current_user: dict = Depends(get_current_user)):
    """Get a specific quote"""
    quote = await db.quotes.find_one({"id": quote_id}, {"_id": 0})
    if not quote:
        raise HTTPException(status_code=404, detail="Cotización no encontrada")
    return quote


@router.put("/quotes/{quote_id}/status")
async def update_quote_status(
    quote_id: str,
    status: str,
    current_user: dict = Depends(get_current_user)
):
    """Update quote status"""
    valid_statuses = ["draft", "sent", "accepted", "rejected", "expired"]
    if status not in valid_statuses:
        raise HTTPException(status_code=400, detail=f"Status inválido. Opciones: {valid_statuses}")
    
    result = await db.quotes.update_one(
        {"id": quote_id},
        {"$set": {"status": status, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Cotización no encontrada")
    
    return {"success": True, "status": status}


@router.get("/quotes/{quote_id}/pdf")
async def generate_quote_pdf(quote_id: str, current_user: dict = Depends(get_current_user)):
    """Generate professional PDF for a quote with modular blocks"""
    quote = await db.quotes.find_one({"id": quote_id}, {"_id": 0})
    if not quote:
        raise HTTPException(status_code=404, detail="Cotización no encontrada")
    
    # Get selected blocks (use defaults if not specified)
    selected_blocks = quote.get("pdf_blocks", [b["id"] for b in PDF_BLOCKS if b.get("default", False)])
    
    # Generate PDF using reportlab
    from io import BytesIO
    from reportlab.lib import colors
    from reportlab.lib.pagesizes import letter
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib.units import inch
    from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, Image, HRFlowable
    from reportlab.lib.enums import TA_CENTER, TA_RIGHT, TA_LEFT, TA_JUSTIFY
    from reportlab.graphics.shapes import Drawing, Rect, Line
    from reportlab.graphics import renderPDF
    
    buffer = BytesIO()
    
    # Custom page template with header/footer
    def add_page_elements(canvas, doc):
        canvas.saveState()
        # Header line
        canvas.setStrokeColor(colors.HexColor("#ff3300"))
        canvas.setLineWidth(3)
        canvas.line(0.5*inch, 10.5*inch, 8*inch, 10.5*inch)
        
        # Footer
        canvas.setFont('Helvetica', 8)
        canvas.setFillColor(colors.HexColor("#666666"))
        canvas.drawString(0.75*inch, 0.4*inch, f"Cotización {quote.get('quote_number', '')} | Leaderlix")
        canvas.drawRightString(7.75*inch, 0.4*inch, f"Página {doc.page}")
        canvas.restoreState()
    
    doc = SimpleDocTemplate(
        buffer, 
        pagesize=letter, 
        topMargin=1*inch, 
        bottomMargin=0.8*inch, 
        leftMargin=0.75*inch, 
        rightMargin=0.75*inch
    )
    
    # Color scheme
    PRIMARY = colors.HexColor("#ff3300")  # Leaderlix orange
    SECONDARY = colors.HexColor("#1a1a1a")  # Dark
    ACCENT = colors.HexColor("#333333")
    LIGHT_BG = colors.HexColor("#f8f8f8")
    
    styles = getSampleStyleSheet()
    styles.add(ParagraphStyle(
        name='BrandTitle', 
        fontSize=28, 
        spaceAfter=5, 
        spaceBefore=0,
        alignment=TA_LEFT, 
        textColor=PRIMARY,
        fontName='Helvetica-Bold',
        leading=32
    ))
    styles.add(ParagraphStyle(
        name='DocTitle', 
        fontSize=12, 
        spaceAfter=15, 
        alignment=TA_LEFT, 
        textColor=ACCENT,
        fontName='Helvetica',
        leading=16
    ))
    styles.add(ParagraphStyle(
        name='QuoteSectionTitle', 
        fontSize=11, 
        spaceBefore=15, 
        spaceAfter=8, 
        textColor=PRIMARY, 
        fontName='Helvetica-Bold',
        borderPadding=(0, 0, 5, 0),
        leading=14
    ))
    styles.add(ParagraphStyle(
        name='SubSection', 
        fontSize=10, 
        spaceBefore=8, 
        spaceAfter=5, 
        textColor=SECONDARY, 
        fontName='Helvetica-Bold',
        leading=13
    ))
    styles.add(ParagraphStyle(
        name='QuoteBody', 
        fontSize=9, 
        alignment=TA_JUSTIFY, 
        leading=13,
        textColor=ACCENT,
        wordWrap='CJK'
    ))
    styles.add(ParagraphStyle(
        name='SmallGray', 
        fontSize=8, 
        textColor=colors.HexColor("#888888"),
        leading=11
    ))
    styles.add(ParagraphStyle(
        name='TotalText', 
        fontSize=13, 
        textColor=PRIMARY, 
        fontName='Helvetica-Bold',
        alignment=TA_RIGHT,
        leading=16
    ))
    styles.add(ParagraphStyle(
        name='CenterSmall', 
        fontSize=8, 
        textColor=colors.HexColor("#666666"),
        alignment=TA_CENTER,
        leading=11
    ))
    
    story = []
    currency_symbol = "$"
    currency_label = quote.get("currency", "USD")
    
    # ==================== HEADER BLOCK ====================
    if "header" in selected_blocks:
        # Brand name
        story.append(Paragraph("LEADERLIX", styles['BrandTitle']))
        story.append(Paragraph("Propuesta de Programa de Coaching Ejecutivo", styles['DocTitle']))
        
        # Quote metadata in a styled box - total width = 7 inches (page width - margins)
        meta_data = [
            [
                Paragraph(f"<b>No. Cotización</b><br/>{quote.get('quote_number', '')}", styles['SmallGray']),
                Paragraph(f"<b>Fecha</b><br/>{quote.get('created_at', '')[:10]}", styles['SmallGray']),
                Paragraph(f"<b>Válida hasta</b><br/>{quote.get('valid_until', '')}", styles['SmallGray']),
                Paragraph(f"<b>Responsable</b><br/>{quote.get('leaderlix_responsible', '') or 'Equipo Leaderlix'}", styles['SmallGray']),
            ]
        ]
        meta_table = Table(meta_data, colWidths=[1.75*inch, 1.5*inch, 1.5*inch, 2.25*inch])
        meta_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, -1), LIGHT_BG),
            ('VALIGN', (0, 0), (-1, -1), 'TOP'),
            ('LEFTPADDING', (0, 0), (-1, -1), 8),
            ('RIGHTPADDING', (0, 0), (-1, -1), 8),
            ('TOPPADDING', (0, 0), (-1, -1), 6),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
        ]))
        story.append(meta_table)
        story.append(Spacer(1, 15))
    
    # ==================== CLIENT INFO BLOCK ====================
    if "client_info" in selected_blocks:
        story.append(Paragraph("PREPARADO PARA", styles['QuoteSectionTitle']))
        
        client_table_data = [
            [Paragraph(f"<b>{quote.get('company', 'Cliente')}</b>", ParagraphStyle('ClientName', fontSize=13, textColor=SECONDARY, fontName='Helvetica-Bold', leading=16))],
            [Paragraph(f"{quote.get('client_name', '')}", styles['QuoteBody'])],
            [Paragraph(f"{quote.get('client_email', '')}", styles['SmallGray'])],
        ]
        client_table = Table(client_table_data, colWidths=[7*inch])
        client_table.setStyle(TableStyle([
            ('LEFTPADDING', (0, 0), (-1, -1), 0),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 2),
        ]))
        story.append(client_table)
        story.append(Spacer(1, 10))
    
    # ==================== PROJECT RATIONALE BLOCK ====================
    if "project_rationale" in selected_blocks:
        objectives = quote.get("objectives", {})
        if any([objectives.get("resultado_objetivo"), objectives.get("comportamiento_objetivo"), 
                objectives.get("aprendizaje_objetivo"), objectives.get("experiencia_objetivo")]):
            
            story.append(Paragraph("OBJETIVOS DEL PROGRAMA", styles['QuoteSectionTitle']))
            
            obj_items = []
            if objectives.get("resultado_objetivo"):
                obj_items.append(["🎯", f"<b>Resultado esperado:</b> {objectives.get('resultado_objetivo')}"])
            if objectives.get("comportamiento_objetivo"):
                obj_items.append(["📈", f"<b>Cambio de comportamiento:</b> {objectives.get('comportamiento_objetivo')}"])
            if objectives.get("aprendizaje_objetivo"):
                obj_items.append(["📚", f"<b>Aprendizaje:</b> {objectives.get('aprendizaje_objetivo')}"])
            if objectives.get("experiencia_objetivo"):
                obj_items.append(["💡", f"<b>Experiencia:</b> {objectives.get('experiencia_objetivo')}"])
            
            for icon, text in obj_items:
                obj_row = Table([[icon, Paragraph(text, styles['QuoteBody'])]], colWidths=[0.4*inch, 6.1*inch])
                obj_row.setStyle(TableStyle([
                    ('VALIGN', (0, 0), (-1, -1), 'TOP'),
                    ('LEFTPADDING', (0, 0), (0, 0), 0),
                    ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
                ]))
                story.append(obj_row)
            
            story.append(Spacer(1, 10))
    
    # ==================== GROUP COMPOSITION & PRICING ====================
    if "group_composition" in selected_blocks:
        story.append(Paragraph("INVERSIÓN POR PARTICIPANTE", styles['QuoteSectionTitle']))
        
        # Table header
        group_data = [[
            Paragraph("<b>Nivel</b>", ParagraphStyle('TableHeader', fontSize=9, textColor=colors.white, fontName='Helvetica-Bold')),
            Paragraph("<b>Participantes</b>", ParagraphStyle('TableHeader', fontSize=9, textColor=colors.white, fontName='Helvetica-Bold', alignment=TA_CENTER)),
            Paragraph("<b>Precio Unitario</b>", ParagraphStyle('TableHeader', fontSize=9, textColor=colors.white, fontName='Helvetica-Bold', alignment=TA_RIGHT)),
            Paragraph("<b>Subtotal</b>", ParagraphStyle('TableHeader', fontSize=9, textColor=colors.white, fontName='Helvetica-Bold', alignment=TA_RIGHT)),
        ]]
        
        # Data rows
        for item in quote.get("coaching_breakdown", []):
            group_data.append([
                Paragraph(item.get("level", ""), styles['QuoteBody']),
                Paragraph(str(item.get("quantity", 0)), ParagraphStyle('CenterText', fontSize=10, alignment=TA_CENTER)),
                Paragraph(f"{currency_symbol}{item.get('unit_price', 0):,.2f}", ParagraphStyle('RightText', fontSize=10, alignment=TA_RIGHT)),
                Paragraph(f"{currency_symbol}{item.get('total', 0):,.2f}", ParagraphStyle('RightText', fontSize=10, alignment=TA_RIGHT, fontName='Helvetica-Bold')),
            ])
        
        group_table = Table(group_data, colWidths=[2.2*inch, 1.3*inch, 1.5*inch, 1.5*inch])
        group_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), PRIMARY),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
            ('ALIGN', (1, 1), (1, -1), 'CENTER'),
            ('ALIGN', (2, 1), (-1, -1), 'RIGHT'),
            ('FONTSIZE', (0, 0), (-1, -1), 10),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 10),
            ('TOPPADDING', (0, 0), (-1, -1), 10),
            ('LEFTPADDING', (0, 0), (-1, -1), 12),
            ('RIGHTPADDING', (0, 0), (-1, -1), 12),
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, LIGHT_BG]),
            ('LINEBELOW', (0, 0), (-1, -2), 0.5, colors.HexColor("#dddddd")),
        ]))
        story.append(group_table)
        story.append(Spacer(1, 5))
        
        # Summary line
        summary_text = f"<b>{quote.get('total_participants', 0)} participantes</b> | Subtotal Coaching: <b>{currency_symbol}{quote.get('coaching_subtotal', 0):,.2f} {currency_label}</b>"
        story.append(Paragraph(summary_text, ParagraphStyle('SummaryLine', fontSize=10, alignment=TA_RIGHT, textColor=ACCENT)))
        story.append(Spacer(1, 15))
    
    # ==================== INCLUDED BENEFITS ====================
    if "included_benefits" in selected_blocks:
        story.append(Paragraph("LO QUE INCLUYE EL PROGRAMA", styles['QuoteSectionTitle']))
        
        benefits_list = [
            ("✓", "Autoevaluación 360° de competencias"),
            ("✓", "Llamada de Arranque con Coach certificado"),
            ("✓", "Sesiones de Coaching 1:1 personalizadas"),
            ("✓", "Certificado de dominio al completar"),
        ]
        
        if quote.get("includes_masterclass"):
            thematic = quote.get("thematic_axis", {})
            axis_name = thematic.get("name", "tema seleccionado") if thematic else "tema seleccionado"
            benefits_list.append(("⭐", f"<b>Masterclass in Company</b> sobre {axis_name}"))
        
        if quote.get("includes_course"):
            thematic = quote.get("thematic_axis", {})
            axis_name = thematic.get("name", "tema seleccionado") if thematic else "tema seleccionado"
            benefits_list.append(("⭐", f"<b>Curso Titular Completo</b> sobre {axis_name}"))
        
        for icon, text in benefits_list:
            benefit_row = Table([
                [Paragraph(icon, ParagraphStyle('CheckIcon', fontSize=11, textColor=PRIMARY if icon == "⭐" else colors.HexColor("#22c55e"))),
                 Paragraph(text, styles['QuoteBody'])]
            ], colWidths=[0.35*inch, 6.15*inch])
            benefit_row.setStyle(TableStyle([
                ('VALIGN', (0, 0), (-1, -1), 'TOP'),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
            ]))
            story.append(benefit_row)
        
        story.append(Spacer(1, 15))
    
    # ==================== INVESTMENT SUMMARY ====================
    if "investment_summary" in selected_blocks:
        story.append(Paragraph("RESUMEN DE INVERSIÓN", styles['QuoteSectionTitle']))
        
        # Build totals table
        totals_rows = []
        
        totals_rows.append([
            Paragraph("Subtotal Coaching", styles['QuoteBody']),
            Paragraph(f"{currency_symbol}{quote.get('coaching_subtotal', 0):,.2f}", ParagraphStyle('RightText', fontSize=10, alignment=TA_RIGHT))
        ])
        
        if quote.get("benefits_total", 0) > 0:
            totals_rows.append([
                Paragraph("Beneficios Adicionales", styles['QuoteBody']),
                Paragraph(f"{currency_symbol}{quote.get('benefits_total', 0):,.2f}", ParagraphStyle('RightText', fontSize=10, alignment=TA_RIGHT))
            ])
        
        if quote.get("discount_amount", 0) > 0:
            totals_rows.append([
                Paragraph(f"Descuento ({quote.get('discount_percent', 0)}%)", ParagraphStyle('DiscountText', fontSize=10, textColor=colors.HexColor("#22c55e"))),
                Paragraph(f"-{currency_symbol}{quote.get('discount_amount', 0):,.2f}", ParagraphStyle('RightGreen', fontSize=10, alignment=TA_RIGHT, textColor=colors.HexColor("#22c55e")))
            ])
        
        totals_rows.append([
            Paragraph("Subtotal", styles['QuoteBody']),
            Paragraph(f"{currency_symbol}{quote.get('subtotal', 0):,.2f}", ParagraphStyle('RightText', fontSize=10, alignment=TA_RIGHT))
        ])
        
        totals_rows.append([
            Paragraph("IVA (16%)", styles['SmallGray']),
            Paragraph(f"{currency_symbol}{quote.get('iva', 0):,.2f}", ParagraphStyle('RightSmall', fontSize=9, alignment=TA_RIGHT, textColor=colors.HexColor("#888888")))
        ])
        
        totals_table = Table(totals_rows, colWidths=[4.5*inch, 2*inch])
        totals_table.setStyle(TableStyle([
            ('ALIGN', (1, 0), (1, -1), 'RIGHT'),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
            ('LINEBELOW', (0, -1), (-1, -1), 0.5, colors.HexColor("#dddddd")),
        ]))
        story.append(totals_table)
        
        # Grand Total - Highlighted
        total_box = Table([[
            Paragraph("TOTAL", ParagraphStyle('TotalLabel', fontSize=12, fontName='Helvetica-Bold', textColor=colors.white)),
            Paragraph(f"{currency_symbol}{quote.get('total', 0):,.2f} {currency_label}", ParagraphStyle('TotalValue', fontSize=16, fontName='Helvetica-Bold', textColor=colors.white, alignment=TA_RIGHT))
        ]], colWidths=[4.5*inch, 2*inch])
        total_box.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, -1), PRIMARY),
            ('TOPPADDING', (0, 0), (-1, -1), 12),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 12),
            ('LEFTPADDING', (0, 0), (-1, -1), 15),
            ('RIGHTPADDING', (0, 0), (-1, -1), 15),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ]))
        story.append(total_box)
        
        if quote.get("currency") == "MXN":
            story.append(Spacer(1, 5))
            story.append(Paragraph(f"Tipo de cambio: 1 USD = {quote.get('exchange_rate', 17.5)} MXN", styles['SmallGray']))
        
        story.append(Spacer(1, 20))
    
    # ==================== METHODOLOGY ====================
    if "methodology" in selected_blocks:
        story.append(Paragraph("NUESTRA METODOLOGÍA", styles['QuoteSectionTitle']))
        
        method_steps = [
            ("1", "Diagnóstico Inicial", "Evaluación 360° y definición de objetivos personalizados"),
            ("2", "Sesiones de Coaching", "Encuentros 1:1 con coach certificado ICF"),
            ("3", "Aplicación Práctica", "Ejercicios y tareas entre sesiones"),
            ("4", "Seguimiento", "Medición continua del progreso"),
            ("5", "Certificación", "Certificado de dominio al completar"),
        ]
        
        for num, title, desc in method_steps:
            step_row = Table([[
                Paragraph(num, ParagraphStyle('StepNum', fontSize=12, fontName='Helvetica-Bold', textColor=PRIMARY, alignment=TA_CENTER)),
                Paragraph(f"<b>{title}</b><br/><font size=9 color='#666666'>{desc}</font>", styles['QuoteBody'])
            ]], colWidths=[0.5*inch, 6*inch])
            step_row.setStyle(TableStyle([
                ('VALIGN', (0, 0), (-1, -1), 'TOP'),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
                ('BACKGROUND', (0, 0), (0, 0), LIGHT_BG),
                ('TOPPADDING', (0, 0), (0, 0), 5),
            ]))
            story.append(step_row)
        
        story.append(Spacer(1, 15))
    
    # ==================== TERMS ====================
    if "terms" in selected_blocks:
        story.append(Paragraph("TÉRMINOS Y CONDICIONES", styles['QuoteSectionTitle']))
        
        terms = [
            ("Pago", "50% al confirmar, 50% al iniciar"),
            ("Métodos", "Transferencia bancaria o tarjeta"),
            ("Cancelación", "Cargo del 25% con menos de 15 días"),
            ("Vigencia", "30 días desde la emisión"),
        ]
        
        terms_data = [[
            Paragraph(f"<b>{t[0]}:</b> {t[1]}", ParagraphStyle('TermText', fontSize=9, textColor=ACCENT))
        ] for t in terms]
        
        terms_table = Table(terms_data, colWidths=[6.5*inch])
        terms_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, -1), LIGHT_BG),
            ('LEFTPADDING', (0, 0), (-1, -1), 12),
            ('RIGHTPADDING', (0, 0), (-1, -1), 12),
            ('TOPPADDING', (0, 0), (-1, -1), 6),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
        ]))
        story.append(terms_table)
        story.append(Spacer(1, 15))
    
    # ==================== FOOTER ====================
    if "footer" in selected_blocks:
        story.append(Spacer(1, 20))
        
        # Signature line
        sig_table = Table([
            [Paragraph("_" * 40, styles['CenterSmall']), Paragraph("_" * 40, styles['CenterSmall'])],
            [Paragraph("Firma del Cliente", styles['CenterSmall']), Paragraph("Fecha de Aceptación", styles['CenterSmall'])]
        ], colWidths=[3.25*inch, 3.25*inch])
        sig_table.setStyle(TableStyle([
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('TOPPADDING', (0, 1), (-1, 1), 5),
        ]))
        story.append(sig_table)
        
        story.append(Spacer(1, 25))
        story.append(Paragraph("Leaderlix — Presenta tus Ideas como un Rockstar!", ParagraphStyle('Tagline', fontSize=11, textColor=PRIMARY, alignment=TA_CENTER, fontName='Helvetica-Bold')))
        story.append(Paragraph("www.leaderlix.com | contacto@leaderlix.com | +52 33 1234 5678", styles['CenterSmall']))
    
    doc.build(story, onFirstPage=add_page_elements, onLaterPages=add_page_elements)
    
    pdf_bytes = buffer.getvalue()
    buffer.close()
    
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f"attachment; filename=Cotizacion_{quote.get('quote_number', 'LDX')}.pdf"
        }
    )


@router.delete("/quotes/{quote_id}")
async def delete_quote(quote_id: str, current_user: dict = Depends(get_current_user)):
    """Delete a quote"""
    result = await db.quotes.delete_one({"id": quote_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Cotización no encontrada")
    return {"success": True, "message": "Cotización eliminada"}


# ============ GOOGLE DOCS GENERATION ============

from googleapiclient.discovery import build
from google.oauth2.credentials import Credentials
from google.auth.transport.requests import Request as GoogleRequest
from config import GOOGLE_DOCS_COTIZACION_TEMPLATE_ID

async def get_google_credentials(user_id: str):
    """Get Google credentials for a user with auto-refresh"""
    # Get from google_tokens collection with service "drive"
    token_doc = await db.google_tokens.find_one({"user_id": user_id, "service": "drive"})
    
    if not token_doc:
        raise HTTPException(
            status_code=400,
            detail="Google Drive no está conectado. Ve a Configuración → Integraciones → Conectar Google Drive"
        )
    
    creds = Credentials(
        token=token_doc.get("access_token"),
        refresh_token=token_doc.get("refresh_token"),
        token_uri="https://oauth2.googleapis.com/token",
        client_id=token_doc.get("client_id") or os.environ.get("GOOGLE_CLIENT_ID"),
        client_secret=token_doc.get("client_secret") or os.environ.get("GOOGLE_CLIENT_SECRET"),
        scopes=token_doc.get("scopes", [])
    )
    
    # Auto-refresh if expired
    if creds.expired and creds.refresh_token:
        try:
            creds.refresh(GoogleRequest())
            # Update in database
            await db.google_tokens.update_one(
                {"user_id": user_id, "service": "drive"},
                {"$set": {
                    "access_token": creds.token,
                    "updated_at": datetime.now(timezone.utc).isoformat()
                }}
            )
        except Exception as e:
            raise HTTPException(
                status_code=401,
                detail=f"Error al refrescar credenciales de Google: {str(e)}"
            )
    
    return creds


def format_currency_text(value: float, currency: str = "USD") -> str:
    """Format currency for display in document"""
    if currency == "MXN":
        return f"${value:,.2f} MXN"
    return f"${value:,.2f} USD"


def generate_desglose_table(quote: dict) -> str:
    """Generate the breakdown table as formatted text for Google Docs"""
    lines = []
    currency = quote.get("currency", "USD")
    
    # Header
    lines.append("Concepto\t\tCantidad\tPrecio Unit.\tSubtotal")
    lines.append("-" * 60)
    
    # Coaching breakdown
    for item in quote.get("coaching_breakdown", []):
        level = item.get("level", "")
        qty = item.get("quantity", 0)
        unit_price = format_currency_text(item.get("unit_price", 0), currency)
        total = format_currency_text(item.get("total", 0), currency)
        lines.append(f"Coaching {level}\t\t{qty}\t\t{unit_price}\t{total}")
    
    # Additional benefits
    if quote.get("benefits_total", 0) > 0:
        lines.append(f"Beneficios Adicionales\t\t1\t\t-\t\t{format_currency_text(quote.get('benefits_total', 0), currency)}")
    
    lines.append("-" * 60)
    
    # Subtotal
    lines.append(f"Subtotal\t\t\t\t\t\t\t{format_currency_text(quote.get('subtotal_before_discount', 0), currency)}")
    
    # Discount
    if quote.get("discount_amount", 0) > 0:
        lines.append(f"Descuento ({quote.get('discount_percent', 0)}%)\t\t\t\t\t-{format_currency_text(quote.get('discount_amount', 0), currency)}")
    
    # IVA
    lines.append(f"IVA (16%)\t\t\t\t\t\t\t{format_currency_text(quote.get('iva', 0), currency)}")
    
    lines.append("=" * 60)
    lines.append(f"TOTAL\t\t\t\t\t\t\t\t{format_currency_text(quote.get('total', 0), currency)}")
    
    return "\n".join(lines)


def generate_beneficios_list(quote: dict) -> str:
    """Generate benefits list for the document"""
    benefits = []
    
    # Base benefits
    benefits.append("• Autoevaluación 360° de competencias")
    benefits.append("• Llamada de Arranque con Coach certificado")
    benefits.append("• Sesiones de Coaching 1:1 personalizadas")
    benefits.append("• Certificado de dominio al completar")
    
    if quote.get("includes_masterclass"):
        thematic = quote.get("thematic_axis", {})
        axis_name = thematic.get("name", "tema seleccionado") if thematic else "tema seleccionado"
        benefits.append(f"• Masterclass in Company sobre {axis_name}")
    
    if quote.get("includes_course"):
        thematic = quote.get("thematic_axis", {})
        axis_name = thematic.get("name", "tema seleccionado") if thematic else "tema seleccionado"
        benefits.append(f"• Curso Titular Completo sobre {axis_name}")
    
    return "\n".join(benefits)


def build_placeholder_replacements(quote: dict) -> list:
    """Build the list of placeholder replacements for Google Docs"""
    objectives = quote.get("objectives", {})
    now = datetime.now(timezone.utc)
    
    # Get month name in Spanish
    months_es = ["enero", "febrero", "marzo", "abril", "mayo", "junio", 
                 "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"]
    
    replacements = {
        # Header info
        "{{titulo}}": quote.get("quote_number", ""),
        "{{titulo_subrayado}}": "Propuesta de Coaching Ejecutivo",
        "{{subtitulo}}": f"Programa para {quote.get('company', 'Cliente')}",
        
        # Date
        "{{dia}}": str(now.day),
        "{{mes}}": months_es[now.month - 1],
        "{{año}}": str(now.year),
        
        # Client info
        "{{cliente}}": quote.get("client_name", ""),
        "{{programa}}": "Rockstars del Storytelling",
        "{{participantes}}": str(quote.get("total_participants", 0)),
        "{{te_enseño}}": "0",  # Removed this modality
        "{{lo_hago_contigo}}": str(quote.get("total_participants", 0)),
        
        # Objectives
        "{{objetivo_en_resultados}}": objectives.get("resultado_objetivo", "mejorar las habilidades de comunicación del equipo"),
        "{{objetivo_en_cambio_de_comportamiento}}": objectives.get("comportamiento_objetivo", "desarrollar presentaciones más impactantes"),
        "{{objetivo_en_aprendizaje}}": objectives.get("aprendizaje_objetivo", "mediante un programa de coaching personalizado"),
        "{{objetivo_en_experiencia}}": objectives.get("experiencia_objetivo", "con sesiones prácticas y feedback continuo"),
        
        # Dates
        "{{confirmacion}}": quote.get("valid_until", "Por definir"),
        "{{alineacion_final}}": "Por definir",
        "{{acceso_final}}": "Por definir",
        "{{certificados_final}}": "Por definir",
        "{{resultados}}": "Por definir",
        
        # Benefits and validity
        "{{beneficios}}": generate_beneficios_list(quote),
        "{{vigencia}}": quote.get("valid_until", "30 días"),
        
        # Responsible
        "{{responsable}}": quote.get("leaderlix_responsible", "Equipo Leaderlix"),
        "{{telefono}}": "+52 33 1234 5678",
        "{{correo}}": "contacto@leaderlix.com",
        
        # Desglose (pricing breakdown)
        "{{desglose}}": generate_desglose_table(quote),
        
        # KPIs
        "{{kpi_experiencia}}": "eNPS > 70",
        "{{kpi_aprendizaje}}": "APR > 85%",
        "{{kpi_comportamiento}}": "CSMI > 80%",
        "{{kpi_resultados}}": "ROI Positivo",
        
        # Cronograma placeholder
        "{{cronograma}}": "Por definir según fechas acordadas",
        
        # Requisitos
        "{{requisitos_de_contratacion}}": "• Prueba de video y audio 24h antes\n• Técnico presente durante el evento\n• Proyector y micrófono inalámbrico\n• Conexión a internet de alta velocidad",
        
        # Viáticos
        "{{viaticos_fuera_de_cdmx}}": "• Vuelos redondos desde CDMX\n• Habitación en hotel (mínimo 1 noche)\n• Transporte terrestre",
        
        # Garantías
        "{{garantias}}": "• Garantía de Nivelación\n• Garantía de Excelencia\n• Garantía de Personalización\n• Garantía de Resultados",
    }
    
    # Build requests for Google Docs API
    requests = []
    for placeholder, value in replacements.items():
        if value:  # Only replace if we have a value
            requests.append({
                "replaceAllText": {
                    "containsText": {
                        "text": placeholder,
                        "matchCase": True
                    },
                    "replaceText": str(value)
                }
            })
    
    return requests


@router.post("/quotes/{quote_id}/generate-doc")
async def generate_google_doc(quote_id: str, current_user: dict = Depends(get_current_user)):
    """Generate a Google Doc from the quote using the template"""
    import os
    
    # Get the quote
    quote = await db.quotes.find_one({"id": quote_id}, {"_id": 0})
    if not quote:
        raise HTTPException(status_code=404, detail="Cotización no encontrada")
    
    # Check if doc already exists
    if quote.get("google_doc_url"):
        return {
            "success": True,
            "message": "Documento ya generado",
            "google_doc_url": quote.get("google_doc_url"),
            "google_doc_id": quote.get("google_doc_id")
        }
    
    try:
        # Get Google credentials
        user_id = current_user.get("id")
        creds = await get_google_credentials(user_id)
        
        # Build services
        drive_service = build('drive', 'v3', credentials=creds)
        docs_service = build('docs', 'v1', credentials=creds)
        
        # 1. Copy the template
        template_id = GOOGLE_DOCS_COTIZACION_TEMPLATE_ID
        copy_title = f"Cotización {quote.get('quote_number', '')} - {quote.get('company', 'Cliente')}"
        
        copied_file = drive_service.files().copy(
            fileId=template_id,
            body={"name": copy_title}
        ).execute()
        
        new_doc_id = copied_file.get("id")
        
        # 2. Replace placeholders
        replacement_requests = build_placeholder_replacements(quote)
        
        if replacement_requests:
            docs_service.documents().batchUpdate(
                documentId=new_doc_id,
                body={"requests": replacement_requests}
            ).execute()
        
        # 3. Get shareable link
        # Make it viewable by anyone with the link
        drive_service.permissions().create(
            fileId=new_doc_id,
            body={
                "type": "anyone",
                "role": "reader"
            }
        ).execute()
        
        # Get the web view link
        file_info = drive_service.files().get(
            fileId=new_doc_id,
            fields="webViewLink"
        ).execute()
        
        google_doc_url = file_info.get("webViewLink")
        
        # 4. Save the link to the quote
        await db.quotes.update_one(
            {"id": quote_id},
            {"$set": {
                "google_doc_id": new_doc_id,
                "google_doc_url": google_doc_url,
                "google_doc_generated_at": datetime.now(timezone.utc).isoformat(),
                "updated_at": datetime.now(timezone.utc).isoformat()
            }}
        )
        
        return {
            "success": True,
            "message": "Documento generado exitosamente",
            "google_doc_id": new_doc_id,
            "google_doc_url": google_doc_url
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error al generar documento: {str(e)}"
        )


@router.get("/quotes/{quote_id}/doc-status")
async def get_doc_status(quote_id: str, current_user: dict = Depends(get_current_user)):
    """Get the Google Doc status for a quote"""
    quote = await db.quotes.find_one(
        {"id": quote_id}, 
        {"_id": 0, "google_doc_id": 1, "google_doc_url": 1, "google_doc_generated_at": 1}
    )
    
    if not quote:
        raise HTTPException(status_code=404, detail="Cotización no encontrada")
    
    return {
        "has_doc": bool(quote.get("google_doc_url")),
        "google_doc_id": quote.get("google_doc_id"),
        "google_doc_url": quote.get("google_doc_url"),
        "generated_at": quote.get("google_doc_generated_at")
    }

