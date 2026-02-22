"""
Contact helper utilities for consistent role, status, and cadence checking.
"""
from typing import List, Dict, Any, Optional, Tuple
from datetime import datetime, timezone, timedelta


# Valid student role variations (students who only attend classes, no coaching)
STUDENT_ROLES = {"student", "estudiante"}

# Valid coachee role variations (students who receive coaching sessions)
COACHEE_ROLES = {"coachee"}

# MongoDB query for student roles (case-insensitive variations)
STUDENT_ROLES_QUERY = {"$in": ["estudiante", "student", "Estudiante", "Student"]}

# MongoDB query for coachee roles (case-insensitive variations)
COACHEE_ROLES_QUERY = {"$in": ["coachee", "Coachee"]}

# Standard cadence periods (in days)
CADENCE_PERIODS = {
    "whatsapp_student": 8,      # WhatsApp to students: every 8 days
    "whatsapp_quote": 9,        # WhatsApp for quote follow-up: every 9 days
    "whatsapp_new_business": 10, # WhatsApp for new business: every 10 days
    "whatsapp_alumni": 90,      # WhatsApp alumni check-in: every 3 months
    "linkedin": 8,              # LinkedIn outreach: every 8 days
    "email_e1": 7,              # E1 webinar invitation: weekly
    "email_e2": 7,              # E2 quote follow-up: weekly
    "email_e3": 7,              # E3 coaching reminder: weekly
    "email_e4": 90,             # E4 repurchase: every 3 months (non-students)
    "email_e5": 90,             # E5 alumni check-in: every 3 months (students)
}


def check_contact_cadence(
    contact: Dict[str, Any], 
    field: str, 
    days: int
) -> Tuple[bool, Optional[int]]:
    """
    Check if enough time has passed since last contact.
    
    Args:
        contact: Contact document from MongoDB
        field: Field name storing last contact timestamp (e.g., 'last_contacted_whatsapp')
        days: Minimum days that should pass between contacts
        
    Returns:
        Tuple of (can_contact: bool, days_since_last: Optional[int])
        - can_contact: True if contact can be messaged (enough time passed or never contacted)
        - days_since_last: Number of days since last contact, or None if never contacted
    """
    last_contacted = contact.get(field)
    
    if not last_contacted:
        return True, None
    
    try:
        # Handle both ISO format strings and datetime objects
        if isinstance(last_contacted, str):
            last_contact_date = datetime.fromisoformat(last_contacted.replace("Z", "+00:00"))
        else:
            last_contact_date = last_contacted
        
        now = datetime.now(timezone.utc)
        days_since = (now - last_contact_date).days
        
        threshold_date = (now - timedelta(days=days)).isoformat()
        can_contact = last_contacted < threshold_date if isinstance(last_contacted, str) else last_contact_date < (now - timedelta(days=days))
        
        return can_contact, days_since
        
    except (ValueError, TypeError) as e:
        # If parsing fails, assume we can contact
        return True, None


def build_cadence_query(field: str, days: int) -> Dict:
    """
    Build a MongoDB query for cadence checking.
    
    Args:
        field: Field name storing last contact timestamp
        days: Minimum days that should pass
        
    Returns:
        MongoDB query dict for $or condition
    """
    threshold = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()
    
    return {
        "$or": [
            {field: {"$exists": False}},
            {field: None},
            {field: {"$lt": threshold}}
        ]
    }


def get_cadence_status(
    contact: Dict[str, Any], 
    field: str, 
    days: int
) -> Dict[str, Any]:
    """
    Get detailed cadence status for a contact.
    
    Args:
        contact: Contact document from MongoDB
        field: Field name storing last contact timestamp
        days: Minimum days required between contacts
        
    Returns:
        Dict with cadence information
    """
    can_contact, days_since = check_contact_cadence(contact, field, days)
    
    return {
        "can_contact": can_contact,
        "days_since_last": days_since,
        "required_days": days,
        "last_contact_date": contact.get(field),
        "days_remaining": max(0, days - (days_since or 0)) if days_since is not None else 0
    }


def is_student(contact: Dict[str, Any]) -> bool:
    """
    Check if a contact has a student role (NOT coachee).
    Students only attend classes, they don't receive coaching.
    Handles both 'roles' and 'contact_types' fields.
    Case-insensitive matching.
    
    Args:
        contact: Contact document from MongoDB
        
    Returns:
        True if contact has student role, False otherwise
    """
    roles = contact.get("roles") or contact.get("contact_types") or []
    
    if isinstance(roles, str):
        roles = [roles]
    
    return any(
        r.lower() in STUDENT_ROLES 
        for r in roles 
        if r and isinstance(r, str)
    )


def is_coachee(contact: Dict[str, Any]) -> bool:
    """
    Check if a contact has a coachee role.
    Coachees are students who also receive coaching sessions.
    Handles both 'roles' and 'contact_types' fields.
    Case-insensitive matching.
    
    Args:
        contact: Contact document from MongoDB
        
    Returns:
        True if contact has coachee role, False otherwise
    """
    roles = contact.get("roles") or contact.get("contact_types") or []
    
    if isinstance(roles, str):
        roles = [roles]
    
    return any(
        r.lower() in COACHEE_ROLES 
        for r in roles 
        if r and isinstance(r, str)
    )


def get_contact_roles(contact: Dict[str, Any]) -> List[str]:
    """
    Get normalized list of roles from a contact.
    
    Args:
        contact: Contact document from MongoDB
        
    Returns:
        List of role strings (lowercase)
    """
    roles = contact.get("roles") or contact.get("contact_types") or []
    
    if isinstance(roles, str):
        roles = [roles]
    
    return [r.lower() for r in roles if r and isinstance(r, str)]


def has_role(contact: Dict[str, Any], role: str) -> bool:
    """
    Check if a contact has a specific role (case-insensitive).
    
    Args:
        contact: Contact document from MongoDB
        role: Role to check for
        
    Returns:
        True if contact has the role, False otherwise
    """
    return role.lower() in get_contact_roles(contact)


def get_primary_email(contact: Dict[str, Any]) -> Optional[str]:
    """
    Get the primary email from a contact.
    Handles both legacy 'email' field and new 'emails' array.
    
    Args:
        contact: Contact document from MongoDB
        
    Returns:
        Primary email string or None
    """
    # Try legacy field first
    if contact.get("email"):
        return contact["email"].lower()
    
    # Try emails array
    emails = contact.get("emails", [])
    if emails:
        # Find primary
        for e in emails:
            if e.get("is_primary"):
                return e.get("email", "").lower()
        # Fallback to first
        if emails[0].get("email"):
            return emails[0]["email"].lower()
    
    return None


def get_primary_phone(contact: Dict[str, Any]) -> Optional[str]:
    """
    Get the primary phone from a contact.
    Handles both legacy 'phone' field and new 'phones' array.
    
    Args:
        contact: Contact document from MongoDB
        
    Returns:
        Primary phone string or None
    """
    # Try legacy field first
    if contact.get("phone"):
        return contact["phone"]
    
    # Try phones array
    phones = contact.get("phones", [])
    if phones:
        # Find primary
        for p in phones:
            if p.get("is_primary"):
                return p.get("e164") or p.get("raw_input", "")
        # Fallback to first
        if phones[0]:
            return phones[0].get("e164") or phones[0].get("raw_input", "")
    
    return None
