"""
Canonical Role Mapping - Single Source of Truth

This module defines the canonical role format used across the entire application:
- case_contact_roles collection (storage)
- /api/cases/by-contact endpoint
- /api/cases/delivery/ganados endpoint
- ContactSheet modal
- Current Cases grouping

IMPORTANT: All roles must be stored and compared using the canonical (lowercase, underscore) format.
"""

# Canonical role values (lowercase with underscores)
CANONICAL_ROLES = [
    "deal_maker",
    "influencer", 
    "champion",
    "sponsor",
    "asistente_deal_maker",
    "procurement",
    "staff",
    "coachee",
    "student",
    "advisor",
    "speaker",
    "evaluador_360",
]

# UI Label -> Canonical value mapping
UI_TO_CANONICAL = {
    "Deal Maker": "deal_maker",
    "deal_maker": "deal_maker",
    "deal maker": "deal_maker",
    "Influencer": "influencer",
    "influencer": "influencer",
    "Champion": "champion",
    "champion": "champion",
    "Sponsor": "sponsor",
    "sponsor": "sponsor",
    "Asistente Deal Maker": "asistente_deal_maker",
    "asistente_deal_maker": "asistente_deal_maker",
    "asistente del deal maker": "asistente_deal_maker",
    "Procurement": "procurement",
    "procurement": "procurement",
    "Staff": "staff",
    "staff": "staff",
    "Coachee": "coachee",
    "coachee": "coachee",
    "Student": "student",
    "student": "student",
    "alumno": "student",
    "estudiante": "student",
    "Advisor": "advisor",
    "advisor": "advisor",
    "Speaker": "speaker",
    "speaker": "speaker",
    "speakers": "speaker",
    "Speakers": "speaker",
    "Evaluador 360": "evaluador_360",
    "evaluador_360": "evaluador_360",
    "evaluador 360": "evaluador_360",
}

# Canonical -> UI Label mapping (for display)
CANONICAL_TO_UI = {
    "deal_maker": "Deal Maker",
    "influencer": "Influencer",
    "champion": "Champion",
    "sponsor": "Sponsor",
    "asistente_deal_maker": "Asistente Deal Maker",
    "procurement": "Procurement",
    "staff": "Staff",
    "coachee": "Coachee",
    "student": "Student",
    "advisor": "Advisor",
    "speaker": "Speaker",
    "evaluador_360": "Evaluador 360",
}

# Role groups for Current Cases grouping
ROLE_GROUPS = {
    "deal_makers_team": {
        "title": "Deal Makers and Team",
        "roles": ["deal_maker", "influencer", "champion", "sponsor", "asistente_deal_maker", "procurement", "staff"]
    },
    "coachees": {
        "title": "Coachees",
        "roles": ["coachee"]
    },
    "students": {
        "title": "Students", 
        "roles": ["student"]
    },
    "advisors_speakers": {
        "title": "Advisors & Speakers",
        "roles": ["advisor", "speaker", "evaluador_360"]
    },
    "others": {
        "title": "All Others",
        "roles": []  # Catch-all
    }
}


def normalize_role(role: str) -> str:
    """
    Normalize a role to its canonical format.
    
    Args:
        role: Role string in any format (UI label, canonical, etc.)
        
    Returns:
        Canonical role string (lowercase with underscores)
    """
    if not role:
        return ""
    
    # First try direct lookup
    if role in UI_TO_CANONICAL:
        return UI_TO_CANONICAL[role]
    
    # Fallback: normalize manually
    normalized = role.lower().strip().replace(" ", "_").replace("-", "_")
    
    # Check if it's a known canonical role
    if normalized in CANONICAL_ROLES:
        return normalized
    
    # Return as-is (will be treated as unknown role -> "others" group)
    return normalized


def get_role_group(role: str) -> str:
    """
    Get the group ID for a given role.
    
    Args:
        role: Role string (will be normalized)
        
    Returns:
        Group ID (e.g., "deal_makers_team", "coachees", "others")
    """
    canonical = normalize_role(role)
    
    for group_id, group_data in ROLE_GROUPS.items():
        if canonical in group_data["roles"]:
            return group_id
    
    return "others"


def get_ui_label(role: str) -> str:
    """
    Get the UI display label for a role.
    
    Args:
        role: Role string (canonical or UI label)
        
    Returns:
        UI display label
    """
    canonical = normalize_role(role)
    return CANONICAL_TO_UI.get(canonical, role.replace("_", " ").title())
