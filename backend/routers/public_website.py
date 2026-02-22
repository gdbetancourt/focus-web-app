"""
Public Website API - Endpoints for the public-facing website
"""
from fastapi import APIRouter, Depends
from typing import Optional
from database import db

router = APIRouter(prefix="/public", tags=["Public Website"])


@router.get("/client-logos")
async def get_client_logos():
    """
    Get logos from active companies using Clearbit Logo API.
    Falls back to UI Avatars if no domain available.
    """
    # Get outbound companies from unified_companies (single source)
    active_companies = await db.unified_companies.find(
        {"classification": "outbound", "is_merged": {"$ne": True}},
        {"_id": 0, "id": 1, "name": 1, "domain": 1, "domains": 1, "logo_url": 1}
    ).to_list(100)
    
    logos = []
    for company in active_companies:
        name = company.get("name", "")
        if not name:
            continue
            
        # Try to get domain from domains array or domain field
        domain = company.get("domain", "")
        domains = company.get("domains", [])
        
        if not domain and domains:
            domain = domains[0] if domains else ""
        
        # Determine logo URL
        if company.get("logo_url"):
            logo_url = company.get("logo_url")
        elif domain:
            # Use Clearbit Logo API
            logo_url = f"https://logo.clearbit.com/{domain}"
        else:
            # Fallback to UI Avatars
            logo_url = f"https://ui-avatars.com/api/?name={name.replace(' ', '+')}&background=random&size=200"
        
        logos.append({
            "name": name,
            "logo": logo_url,
            "website": website,
            "domain": domain
        })
    
    return {
        "success": True,
        "logos": logos[:30],  # Limit to 30 logos
        "total": len(logos)
    }


@router.get("/case-studies")
async def get_case_studies():
    """
    Get case studies for the public website.
    TODO: Replace with real data from database when available.
    """
    # Dummy data for now
    case_studies = [
        {
            "id": "1",
            "title": "Transforming Sales Presentations at Pfizer",
            "company": "Pfizer",
            "industry": "Pharmaceutical",
            "summary": "How we helped Pfizer's sales team increase engagement by 40% through storytelling techniques.",
            "image": "https://images.unsplash.com/photo-1576091160550-2173dba999ef?w=600",
            "results": ["40% increase in engagement", "25% higher conversion", "90% team satisfaction"]
        },
        {
            "id": "2", 
            "title": "Executive Communication at Bayer",
            "company": "Bayer",
            "industry": "Pharmaceutical",
            "summary": "Training C-level executives to deliver impactful presentations at global conferences.",
            "image": "https://images.unsplash.com/photo-1552664730-d307ca884978?w=600",
            "results": ["50+ executives trained", "3 TEDx speakers", "Award-winning presentations"]
        },
        {
            "id": "3",
            "title": "Storytelling Workshop for Google",
            "company": "Google",
            "industry": "Technology",
            "summary": "Empowering Google's leadership team to communicate complex ideas with clarity and impact.",
            "image": "https://images.unsplash.com/photo-1559136555-9303baea8ebd?w=600",
            "results": ["100+ participants", "95% satisfaction rate", "Implemented globally"]
        },
        {
            "id": "4",
            "title": "TED-Style Training at Novartis",
            "company": "Novartis",
            "industry": "Pharmaceutical",
            "summary": "Preparing medical experts to present research findings in engaging, memorable ways.",
            "image": "https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?w=600",
            "results": ["20 internal speakers", "5 external conferences", "2 published talks"]
        }
    ]
    
    return {
        "success": True,
        "case_studies": case_studies,
        "total": len(case_studies)
    }


@router.get("/testimonials")
async def get_testimonials():
    """
    Get testimonials for the public website.
    TODO: Replace with real data from database when available.
    """
    # Dummy data based on real testimonials from Leaderlix
    testimonials = [
        {
            "id": "1",
            "name": "Ayin Alvarado, PhD",
            "role": "Medical Manager",
            "company": "Bayer",
            "image": "https://randomuser.me/api/portraits/women/1.jpg",
            "quote": "The difference is abysmal. The team that took this course stands out from the rest because we've learned to capture and engage our audience's attention. It has brutally made a difference.",
            "rating": 5
        },
        {
            "id": "2",
            "name": "Jeanette J. Salvatierra",
            "role": "Life Coach",
            "company": "",
            "image": "https://randomuser.me/api/portraits/women/2.jpg",
            "quote": "I've participated in many public speaking courses and this approach is the clearest and most effective, especially nowadays when capturing audience attention is so challenging.",
            "rating": 5
        },
        {
            "id": "3",
            "name": "Daniela González Herrera",
            "role": "Scientific Medical Liaison",
            "company": "Novo Nordisk",
            "image": "https://randomuser.me/api/portraits/women/3.jpg",
            "quote": "They exceeded my expectations. It's practical, applicable, and interesting. I couldn't stop paying attention. It's an excellent course to learn storytelling and make any presentation engaging.",
            "rating": 5
        },
        {
            "id": "4",
            "name": "Martin Mariscal Lauhsen",
            "role": "Compliance Head",
            "company": "Volkswagen",
            "image": "https://randomuser.me/api/portraits/men/4.jpg",
            "quote": "This is a completely disruptive method. It helped me open my mind, explore new alternatives, and communicate more efficiently, inspiringly, and motivatingly. It works extremely well!",
            "rating": 5
        },
        {
            "id": "5",
            "name": "Ricardo Zamora",
            "role": "Communications Leader",
            "company": "Google",
            "image": "https://randomuser.me/api/portraits/men/5.jpg",
            "quote": "It helped me understand the attention triggers and the steps to tell a story that changes people's mindset. The methodology definitely helped me present better.",
            "rating": 5
        },
        {
            "id": "6",
            "name": "Pablo Lomelí",
            "role": "Memory Athlete",
            "company": "",
            "image": "https://randomuser.me/api/portraits/men/6.jpg",
            "quote": "I presented my core idea at a TEDx event and was selected as a speaker, mainly thanks to the clarity of my new paradigm proposal that I built here.",
            "rating": 5
        }
    ]
    
    return {
        "success": True,
        "testimonials": testimonials,
        "total": len(testimonials)
    }
