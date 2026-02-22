"""
Sponsorship Router - Event sponsorship microsites, calculator, and quotes
"""
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from datetime import datetime, timezone
import uuid
import math

from database import db
from routers.auth import get_current_user

router = APIRouter(prefix="/sponsorship", tags=["sponsorship"])


# ============ MODELS ============

class SponsorshipLevel(BaseModel):
    """Sponsorship level configuration"""
    code: str  # atlas, patrimonial, vanguard
    name: str
    fee_percent: float  # e.g., 0.35 for 35%
    min_investment: float  # Minimum investment in MXN
    benefits: List[str]  # List of benefit codes that apply


class PricingConfig(BaseModel):
    """Pricing configuration for an event"""
    coaching_price: float = 19800  # MXN without tax


class DiscountTier(BaseModel):
    """Discount tier for volume pricing"""
    quantity: int
    discount: float  # e.g., 0.10 for 10%


class SponsorshipConfig(BaseModel):
    """Full sponsorship configuration for an event"""
    levels: List[SponsorshipLevel]
    pricing: PricingConfig
    coaching_discounts: List[DiscountTier]
    implementation_discounts: List[DiscountTier]
    benefits_list: List[Dict[str, Any]]  # All available benefits with descriptions


class QuoteRequest(BaseModel):
    """Request to calculate/save a sponsorship quote"""
    event_id: str
    level: str  # atlas, patrimonial, vanguard
    coaching_qty: int
    specialties: List[str] = []
    contact_name: Optional[str] = None
    contact_email: Optional[str] = None
    contact_company: Optional[str] = None
    include_tax: bool = False


class EventSponsorshipUpdate(BaseModel):
    """Update sponsorship settings for an event"""
    industry_id: Optional[str] = None
    sponsorship_enabled: Optional[bool] = None
    pricing: Optional[PricingConfig] = None
    content: Optional[Dict[str, str]] = None  # Editable content blocks


# ============ DEFAULT CONFIGURATION ============

DEFAULT_LEVELS = [
    {
        "code": "atlas",
        "name": "Atlas",
        "fee_percent": 0.35,
        "min_investment": 1000000,  # 1 million MXN
        "benefits": ["brand_global", "category_block", "scholarships", "brand_association"]
    },
    {
        "code": "patrimonial",
        "name": "Patrimonial",
        "fee_percent": 0.22,
        "min_investment": 350000,  # 350k MXN
        "benefits": ["brand_segmented", "category_block", "scholarships", "brand_association"]
    },
    {
        "code": "vanguard",
        "name": "Vanguard",
        "fee_percent": 0.12,
        "min_investment": 300000,  # 300k MXN
        "benefits": ["brand_segmented", "scholarships", "brand_association"]
    }
]

DEFAULT_BENEFITS = [
    {"code": "brand_global", "name": "Brand presence in all communications", "atlas": True, "patrimonial": False, "vanguard": False},
    {"code": "brand_segmented", "name": "Brand presence segmented by specialty", "atlas": False, "patrimonial": True, "vanguard": True},
    {"code": "category_block", "name": "Category exclusivity (no competitors)", "atlas": True, "patrimonial": True, "vanguard": False},
    {"code": "scholarships", "name": "Scholarship sponsorship (coaching)", "atlas": True, "patrimonial": True, "vanguard": True},
    {"code": "brand_association", "name": "Brand association with scholarship recipients", "atlas": True, "patrimonial": True, "vanguard": True},
]

DEFAULT_COACHING_DISCOUNTS = [
    {"quantity": 4, "discount": 0.00},
    {"quantity": 6, "discount": 0.05},
    {"quantity": 8, "discount": 0.08},
    {"quantity": 10, "discount": 0.10},
    {"quantity": 12, "discount": 0.12},
    {"quantity": 15, "discount": 0.15},
    {"quantity": 20, "discount": 0.18},
    {"quantity": 30, "discount": 0.22},
    {"quantity": 40, "discount": 0.25},
    {"quantity": 60, "discount": 0.28},
]

DEFAULT_IMPL_DISCOUNTS = [
    {"quantity": 1, "discount": 0.00},
    {"quantity": 2, "discount": 0.05},
    {"quantity": 3, "discount": 0.08},
    {"quantity": 4, "discount": 0.10},
    {"quantity": 5, "discount": 0.12},
]

DEFAULT_CONTENT = {
    "hero_title": "Become a Sponsor",
    "hero_subtitle": "Support healthcare professionals in their AI journey",
    "program_description": """
Our program consists of three phases designed to help physicians integrate AI into their private practice:

**Phase 1: Open Webinar (Free, 1 hour)**
- AI fundamentals from a business perspective
- Communication strategies with AI
- Responsible and secure use of medical information

**Phase 2: Coaching Program (Paid)**
- Cohort-based program for practical implementation
- Hands-on guidance for your practice
""",
    "why_sponsor": """
**Why Partner With Us?**

- Direct access to engaged healthcare professionals
- Brand association with innovation and education
- Measurable impact through scholarship recipients
- Category exclusivity options available
""",
    "faq": """
**Frequently Asked Questions**

**Q: How are scholarship recipients selected?**
A: Recipients are selected based on their engagement, specialty relevance, and commitment to implementing learnings.

**Q: What reporting will I receive?**
A: Sponsors receive detailed reports including recipient demographics, engagement metrics, and program outcomes.

**Q: Can I specify which specialties receive my scholarships?**
A: Patrimonial and Vanguard levels allow you to specify up to 2 medical specialties.
""",
    "contact_info": "Contact us at sponsors@leaderlix.com",
    "terms": "All prices shown are in MXN and do not include tax (IVA 16%) unless specified."
}


# ============ HELPER FUNCTIONS ============

def get_discount_for_quantity(discounts: List[Dict], quantity: int) -> float:
    """Get the applicable discount for a given quantity"""
    applicable_discount = 0.0
    for tier in sorted(discounts, key=lambda x: x["quantity"]):
        if quantity >= tier["quantity"]:
            applicable_discount = tier["discount"]
    return applicable_discount


def calculate_min_coaching_for_investment(
    target_investment: float,
    fee_percent: float,
    coaching_price: float,
    discounts: List[Dict]
) -> int:
    """
    Calculate minimum coaching scholarships needed to reach target investment.
    Uses iterative approach to account for volume discounts.
    """
    # Start with estimate without discounts
    # total = coaching_subtotal * (1 + fee_percent)
    # coaching_subtotal = qty * price * (1 - discount)
    
    for qty in range(1, 200):
        discount = get_discount_for_quantity(discounts, qty)
        unit_net = coaching_price * (1 - discount)
        subtotal = qty * unit_net
        total = subtotal * (1 + fee_percent)
        
        if total >= target_investment:
            return qty
    
    return 200  # Max fallback


def calculate_quote(
    level: str,
    coaching_qty: int,
    pricing: Dict,
    coaching_discounts: List[Dict],
    levels: List[Dict],
    include_tax: bool = False
) -> Dict:
    """Calculate a sponsorship quote"""
    # Get level config
    level_config = next((lvl for lvl in levels if lvl["code"] == level), None)
    if not level_config:
        raise ValueError(f"Invalid level: {level}")
    
    fee_percent = level_config["fee_percent"]
    min_investment = level_config.get("min_investment", 0)
    
    # Get discount
    coaching_discount = get_discount_for_quantity(coaching_discounts, coaching_qty)
    
    # Calculate
    coaching_price = pricing.get("coaching_price", 19800)
    coaching_unit_net = coaching_price * (1 - coaching_discount)
    coaching_subtotal = coaching_qty * coaching_unit_net
    
    scholarship_total = coaching_subtotal
    sponsor_fee = scholarship_total * fee_percent
    grand_total = scholarship_total + sponsor_fee
    
    # Calculate minimum coaching needed for this level
    min_coaching = calculate_min_coaching_for_investment(
        min_investment, fee_percent, coaching_price, coaching_discounts
    )
    
    # Apply tax if requested
    tax_rate = 0.16 if include_tax else 0
    tax_amount = grand_total * tax_rate
    grand_total_with_tax = grand_total + tax_amount
    
    return {
        "level": level,
        "level_name": level_config["name"],
        "fee_percent": fee_percent,
        "min_investment": min_investment,
        "min_coaching": min_coaching,
        "coaching": {
            "quantity": coaching_qty,
            "unit_price": coaching_price,
            "discount_percent": coaching_discount,
            "unit_net": coaching_unit_net,
            "subtotal": coaching_subtotal
        },
        "scholarship_total": scholarship_total,
        "sponsor_fee": sponsor_fee,
        "subtotal": grand_total,
        "include_tax": include_tax,
        "tax_rate": tax_rate,
        "tax_amount": tax_amount if include_tax else 0,
        "grand_total": grand_total_with_tax if include_tax else grand_total,
        "meets_minimum": grand_total >= min_investment
    }


# ============ ENDPOINTS ============

@router.get("/config")
async def get_default_config(
    current_user: dict = Depends(get_current_user)
):
    """Get default sponsorship configuration"""
    return {
        "success": True,
        "levels": DEFAULT_LEVELS,
        "benefits": DEFAULT_BENEFITS,
        "coaching_discounts": DEFAULT_COACHING_DISCOUNTS,
        "default_pricing": {
            "coaching_price": 19800
        },
        "default_content": DEFAULT_CONTENT
    }


@router.get("/event/{event_id}")
async def get_event_sponsorship(
    event_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get sponsorship configuration for an event"""
    event = await db.webinar_events_v2.find_one({"id": event_id}, {"_id": 0})
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    
    # Return event with sponsorship config (use defaults if not set)
    sponsorship = event.get("sponsorship", {})
    
    return {
        "success": True,
        "event_id": event_id,
        "event_name": event.get("name", ""),
        "sponsorship_enabled": sponsorship.get("enabled", False),
        "industry_id": sponsorship.get("industry_id"),
        "levels": sponsorship.get("levels", DEFAULT_LEVELS),
        "benefits": sponsorship.get("benefits", DEFAULT_BENEFITS),
        "pricing": sponsorship.get("pricing", {"coaching_price": 19800}),
        "coaching_discounts": sponsorship.get("coaching_discounts", DEFAULT_COACHING_DISCOUNTS),
        "content": sponsorship.get("content", DEFAULT_CONTENT)
    }


@router.get("/event/{event_id}/public")
async def get_event_sponsorship_public(event_id: str):
    """Get public sponsorship page data for an event (no auth required)"""
    event = await db.webinar_events_v2.find_one({"id": event_id}, {"_id": 0})
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    
    sponsorship = event.get("sponsorship", {})
    if not sponsorship.get("enabled", False):
        raise HTTPException(status_code=404, detail="Sponsorship page not available for this event")
    
    # Get industry info if set
    industry = None
    if sponsorship.get("industry_id"):
        industry = await db.industries.find_one(
            {"id": sponsorship["industry_id"]},
            {"_id": 0}
        )
    
    return {
        "success": True,
        "event": {
            "id": event_id,
            "name": event.get("name", ""),
            "slug": event.get("slug", event_id),
            "description": event.get("description", ""),
            "webinar_date": event.get("webinar_date", ""),
            "buyer_personas": event.get("buyer_personas", [])
        },
        "industry": industry,
        "levels": sponsorship.get("levels", DEFAULT_LEVELS),
        "benefits": sponsorship.get("benefits", DEFAULT_BENEFITS),
        "pricing": sponsorship.get("pricing", {"coaching_price": 19800}),
        "coaching_discounts": sponsorship.get("coaching_discounts", DEFAULT_COACHING_DISCOUNTS),
        "content": sponsorship.get("content", DEFAULT_CONTENT)
    }


@router.put("/event/{event_id}")
async def update_event_sponsorship(
    event_id: str,
    data: EventSponsorshipUpdate,
    current_user: dict = Depends(get_current_user)
):
    """Update sponsorship settings for an event"""
    event = await db.webinar_events_v2.find_one({"id": event_id})
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    
    update_data = {}
    
    if data.industry_id is not None:
        update_data["sponsorship.industry_id"] = data.industry_id
    
    if data.sponsorship_enabled is not None:
        update_data["sponsorship.enabled"] = data.sponsorship_enabled
    
    if data.pricing is not None:
        update_data["sponsorship.pricing"] = data.pricing.dict()
    
    if data.content is not None:
        update_data["sponsorship.content"] = data.content
    
    if update_data:
        update_data["sponsorship.updated_at"] = datetime.now(timezone.utc).isoformat()
        await db.webinar_events_v2.update_one(
            {"id": event_id},
            {"$set": update_data}
        )
    
    return {"success": True, "message": "Sponsorship settings updated"}


@router.post("/event/{event_id}/enable")
async def enable_sponsorship(
    event_id: str,
    industry_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Enable sponsorship page for an event with initial configuration"""
    event = await db.webinar_events_v2.find_one({"id": event_id})
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    
    # Verify industry exists
    industry = await db.industries.find_one({"id": industry_id})
    if not industry:
        raise HTTPException(status_code=404, detail="Industry not found")
    
    # Initialize sponsorship config with defaults
    sponsorship_config = {
        "enabled": True,
        "industry_id": industry_id,
        "levels": DEFAULT_LEVELS,
        "benefits": DEFAULT_BENEFITS,
        "pricing": {"coaching_price": 19800},
        "coaching_discounts": DEFAULT_COACHING_DISCOUNTS,
        "content": DEFAULT_CONTENT,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.webinar_events_v2.update_one(
        {"id": event_id},
        {"$set": {"sponsorship": sponsorship_config}}
    )
    
    return {"success": True, "message": "Sponsorship enabled for event"}


# ============ CALCULATOR ============

@router.post("/calculate")
async def calculate_sponsorship(
    data: QuoteRequest,
    current_user: dict = Depends(get_current_user)
):
    """Calculate sponsorship quote (authenticated)"""
    event = await db.webinar_events_v2.find_one({"id": data.event_id}, {"_id": 0})
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    
    sponsorship = event.get("sponsorship", {})
    pricing = sponsorship.get("pricing", {"coaching_price": 19800})
    coaching_discounts = sponsorship.get("coaching_discounts", DEFAULT_COACHING_DISCOUNTS)
    levels = sponsorship.get("levels", DEFAULT_LEVELS)
    
    quote = calculate_quote(
        level=data.level,
        coaching_qty=data.coaching_qty,
        pricing=pricing,
        coaching_discounts=coaching_discounts,
        levels=levels,
        include_tax=data.include_tax
    )
    
    return {"success": True, "quote": quote}


@router.post("/calculate/public")
async def calculate_sponsorship_public(data: QuoteRequest):
    """Calculate sponsorship quote (public endpoint)"""
    event = await db.webinar_events_v2.find_one({"id": data.event_id}, {"_id": 0})
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    
    sponsorship = event.get("sponsorship", {})
    if not sponsorship.get("enabled", False):
        raise HTTPException(status_code=404, detail="Sponsorship not available")
    
    pricing = sponsorship.get("pricing", {"coaching_price": 19800})
    coaching_discounts = sponsorship.get("coaching_discounts", DEFAULT_COACHING_DISCOUNTS)
    levels = sponsorship.get("levels", DEFAULT_LEVELS)
    
    quote = calculate_quote(
        level=data.level,
        coaching_qty=data.coaching_qty,
        pricing=pricing,
        coaching_discounts=coaching_discounts,
        levels=levels,
        include_tax=data.include_tax
    )
    
    return {"success": True, "quote": quote}


# ============ QUOTES (SAVE/RETRIEVE) ============

@router.post("/quote")
async def save_quote(data: QuoteRequest):
    """Save a sponsorship quote and return quote ID"""
    event = await db.webinar_events_v2.find_one({"id": data.event_id}, {"_id": 0})
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    
    sponsorship = event.get("sponsorship", {})
    pricing = sponsorship.get("pricing", {"coaching_price": 19800})
    coaching_discounts = sponsorship.get("coaching_discounts", DEFAULT_COACHING_DISCOUNTS)
    levels = sponsorship.get("levels", DEFAULT_LEVELS)
    
    # Calculate quote
    quote_calc = calculate_quote(
        level=data.level,
        coaching_qty=data.coaching_qty,
        pricing=pricing,
        coaching_discounts=coaching_discounts,
        levels=levels,
        include_tax=data.include_tax
    )
    
    # Create quote record
    quote_id = str(uuid.uuid4())[:8].upper()  # Short ID for PDF
    quote_doc = {
        "id": quote_id,
        "event_id": data.event_id,
        "event_name": event.get("name", ""),
        "level": data.level,
        "specialties": data.specialties,
        "coaching_qty": data.coaching_qty,
        "include_tax": data.include_tax,
        "calculation": quote_calc,
        "contact": {
            "name": data.contact_name,
            "email": data.contact_email,
            "company": data.contact_company
        },
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.sponsorship_quotes.insert_one(quote_doc)
    quote_doc.pop("_id", None)
    
    return {"success": True, "quote_id": quote_id, "quote": quote_doc}


@router.get("/quote/{quote_id}")
async def get_quote(quote_id: str):
    """Retrieve a saved quote by ID"""
    quote = await db.sponsorship_quotes.find_one({"id": quote_id}, {"_id": 0})
    if not quote:
        raise HTTPException(status_code=404, detail="Quote not found")
    
    return {"success": True, "quote": quote}


@router.get("/quotes/event/{event_id}")
async def get_event_quotes(
    event_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get all quotes for an event"""
    quotes = await db.sponsorship_quotes.find(
        {"event_id": event_id},
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    
    return {"success": True, "quotes": quotes, "total": len(quotes)}
