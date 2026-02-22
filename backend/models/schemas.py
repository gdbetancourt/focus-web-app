"""
Pydantic models for Leaderlix Backend
All request/response schemas are defined here
"""
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone


# ============ AUTH MODELS ============

class UserCreate(BaseModel):
    email: EmailStr
    password: str
    name: str

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserResponse(BaseModel):
    id: str
    email: str
    name: str
    created_at: datetime

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse


# ============ EVENT MODELS ============

class WebinarEvent(BaseModel):
    id: str
    name: str
    description: Optional[str] = None
    date: Optional[str] = None
    time: Optional[str] = None
    url_website: Optional[str] = None
    url_linkedin: Optional[str] = None
    buyer_personas: List[str] = []
    cover_image: Optional[str] = None
    status: str = "draft"
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class CreateEventRequest(BaseModel):
    name: str
    description: Optional[str] = None
    date: Optional[str] = None
    time: Optional[str] = None
    url_website: Optional[str] = None
    url_linkedin: Optional[str] = None
    buyer_personas: List[str] = []
    cover_image: Optional[str] = None

class UpdateEventRequest(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    date: Optional[str] = None
    time: Optional[str] = None
    url_website: Optional[str] = None
    url_linkedin: Optional[str] = None
    buyer_personas: Optional[List[str]] = None
    cover_image: Optional[str] = None
    status: Optional[str] = None


# ============ HUBSPOT MODELS ============

class HubSpotContact(BaseModel):
    id: str
    email: Optional[str] = None
    firstname: Optional[str] = None
    lastname: Optional[str] = None
    company: Optional[str] = None
    phone: Optional[str] = None
    jobtitle: Optional[str] = None
    buyer_persona: Optional[str] = None
    buyer_persona_name: Optional[str] = None
    buyer_persona_display_name: Optional[str] = None
    classified_area: Optional[str] = None
    classified_sector: Optional[str] = None
    classification_confidence: Optional[str] = None
    company_industry: Optional[str] = None
    properties: Dict[str, Any] = {}

class HubSpotCompany(BaseModel):
    id: str
    name: Optional[str] = None
    domain: Optional[str] = None
    industry: Optional[str] = None
    city: Optional[str] = None
    country: Optional[str] = None
    properties: Dict[str, Any] = {}

class CSVContact(BaseModel):
    email: str
    firstname: Optional[str] = ""
    lastname: Optional[str] = ""
    company: Optional[str] = ""
    jobtitle: Optional[str] = ""
    phone: Optional[str] = ""

class CSVImportRequest(BaseModel):
    contacts: List[CSVContact]
    classify: bool = True
    event_id: Optional[str] = None
    event_name: Optional[str] = None

class IndustryMapping(BaseModel):
    hubspot_value: str
    display_name: str
    sector_short: str
    is_active: bool = False


# ============ EMAIL/CAMPAIGN MODELS ============

class EmailTemplateCreate(BaseModel):
    name: str
    subject: str
    body_html: str
    variables: List[str] = []

class EmailTemplateResponse(BaseModel):
    id: str
    name: str
    subject: str
    body_html: str
    variables: List[str]
    created_at: datetime
    updated_at: datetime

class CampaignCreate(BaseModel):
    name: str
    template_id: str
    event_ids: List[str] = []
    contact_ids: List[str] = []
    scheduled_at: Optional[datetime] = None
    use_ai_generation: bool = True

class CampaignResponse(BaseModel):
    id: str
    name: str
    template_id: str
    event_ids: List[str]
    contact_ids: List[str]
    status: str
    scheduled_at: Optional[datetime]
    sent_at: Optional[datetime]
    total_recipients: int
    emails_sent: int
    emails_opened: int
    emails_clicked: int
    created_at: datetime

class ScheduledEmail(BaseModel):
    contact_id: str
    contact_name: str
    contact_email: Optional[str]
    scheduled_datetime: datetime
    day_name: str
    time_slot: str

class CampaignConfirmationRequest(BaseModel):
    campaign_id: str

class CampaignConfirmationResponse(BaseModel):
    campaign_id: str
    campaign_name: str
    template_name: str
    events: List[dict]
    total_contacts: int
    scheduled_emails: List[ScheduledEmail]
    first_send_date: str
    last_send_date: str
    email_previews: List[dict]


# ============ SETTINGS MODELS ============

class SettingsUpdate(BaseModel):
    hubspot_token: Optional[str] = None
    hubspot_list_id: Optional[str] = None
    sender_email: Optional[str] = None
    google_credentials: Optional[Dict[str, Any]] = None
    apify_token: Optional[str] = None


# ============ PREVIEW MODELS ============

class EmailPreviewRequest(BaseModel):
    template_id: str
    contact_id: str
    event_ids: List[str] = []

class EmailPreviewResponse(BaseModel):
    contact_name: str
    contact_email: Optional[str] = None
    subject: str
    body_html: str
    generated_at: datetime


# ============ THEMATIC AXES MODELS ============

class ThematicAxisCreate(BaseModel):
    name: str
    name_en: Optional[str] = None  # English name
    description: Optional[str] = None
    description_en: Optional[str] = None  # English description
    keywords: List[str] = []
    color: Optional[str] = None
    hero_title: Optional[str] = None
    hero_title_en: Optional[str] = None  # English hero title
    hero_subtitle: Optional[str] = None
    hero_subtitle_en: Optional[str] = None  # English hero subtitle
    buyer_personas: List[str] = []  # List of buyer persona IDs
    pdf_url: Optional[str] = None  # PDF document URL
    pdf_url_en: Optional[str] = None  # English PDF document URL

class ThematicAxisUpdate(BaseModel):
    name: Optional[str] = None
    name_en: Optional[str] = None
    description: Optional[str] = None
    description_en: Optional[str] = None
    keywords: Optional[List[str]] = None
    color: Optional[str] = None
    hero_title: Optional[str] = None
    hero_title_en: Optional[str] = None
    hero_subtitle: Optional[str] = None
    hero_subtitle_en: Optional[str] = None
    buyer_personas: Optional[List[str]] = None  # List of buyer persona IDs
    pdf_url: Optional[str] = None
    pdf_url_en: Optional[str] = None


# ============ BUYER PERSONA MODELS ============

class BuyerPersonaCreate(BaseModel):
    code: str
    name: str
    area: str
    sector: str
    display_name: Optional[str] = None
    description: Optional[str] = None

class BuyerPersonaUpdate(BaseModel):
    name: Optional[str] = None
    display_name: Optional[str] = None
    description: Optional[str] = None


# ============ ADDITIONAL MODELS ============

class BuyerPersonaDB(BaseModel):
    id: Optional[str] = None
    hs_id: Optional[str] = None
    name: str
    industria: Optional[str] = None
    descripcion: Optional[str] = None
    otros_titulos: Optional[str] = None
    actividades: Optional[str] = None
    no_confundir_con: Optional[str] = None
    reporta_a: Optional[str] = None
    keywords_hubspot_cargo: Optional[str] = None
    created_at: Optional[str] = None
    updated_at: Optional[str] = None

class BuyerPersonaDBUpdate(BaseModel):
    name: Optional[str] = None
    industria: Optional[str] = None
    descripcion: Optional[str] = None
    otros_titulos: Optional[str] = None
    actividades: Optional[str] = None
    no_confundir_con: Optional[str] = None
    reporta_a: Optional[str] = None
    keywords_hubspot_cargo: Optional[str] = None
    keywords: Optional[str] = None
    sector: Optional[str] = None
    area: Optional[str] = None

class ReviewContactsRequest(BaseModel):
    contact_ids: List[str] = []
    buyer_persona_filter: Optional[str] = None
    force_update: bool = False

class GenerateEventTitleRequest(BaseModel):
    thematic_axis_id: str
    buyer_persona_code: str
