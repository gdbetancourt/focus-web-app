"""
Persona Classifier Service - Centralized buyer persona classification

This is the SINGLE SOURCE OF TRUTH for all buyer persona classification logic.
All components (Import CSV, Import LinkedIn, Qualify, Reclassification) MUST use this service.

Features:
- Unified classification function
- Job title normalization
- In-memory cache with automatic invalidation
- Override protection (buyer_persona_locked)
- Audit trail support
"""

import re
import unicodedata
import logging
from typing import Optional, List, Dict, Any, Tuple
from datetime import datetime, timezone
from functools import lru_cache

logger = logging.getLogger("persona_classifier")

# =============================================================================
# CACHE MANAGEMENT
# =============================================================================

class ClassifierCache:
    """
    In-memory cache for keywords and priorities.
    Invalidated automatically when keywords are modified.
    """
    
    def __init__(self):
        self._keywords: List[Dict] = []
        self._priorities: Dict[str, int] = {}  # buyer_persona_id -> priority
        self._priority_names: Dict[str, str] = {}  # buyer_persona_id -> name
        self._last_loaded: Optional[datetime] = None
        self._is_valid: bool = False
    
    def invalidate(self):
        """Mark cache as invalid. Next classify call will reload."""
        self._is_valid = False
        logger.info("Classifier cache invalidated")
    
    async def ensure_loaded(self, db) -> None:
        """Load keywords and priorities if cache is invalid."""
        if self._is_valid:
            return
        
        try:
            # Load all keywords
            self._keywords = await db.job_keywords.find(
                {}, {"_id": 0}
            ).to_list(None)
            
            # Load priorities
            priorities_list = await db.buyer_persona_priorities.find(
                {}, {"_id": 0}
            ).sort("priority", 1).to_list(None)
            
            self._priorities = {}
            self._priority_names = {}
            for p in priorities_list:
                bp_id = p.get("buyer_persona_id", "")
                self._priorities[bp_id] = p.get("priority", 999)
                self._priority_names[bp_id] = p.get("buyer_persona_name", "")
            
            self._last_loaded = datetime.now(timezone.utc)
            self._is_valid = True
            
            logger.info(f"Classifier cache loaded: {len(self._keywords)} keywords, {len(self._priorities)} priorities")
            
        except Exception as e:
            logger.error(f"Error loading classifier cache: {e}")
            self._is_valid = False
            raise
    
    @property
    def keywords(self) -> List[Dict]:
        return self._keywords
    
    @property
    def priorities(self) -> Dict[str, int]:
        return self._priorities
    
    @property
    def priority_names(self) -> Dict[str, str]:
        return self._priority_names
    
    def get_priority(self, buyer_persona_id: str) -> int:
        """Get priority for a buyer persona (lower = higher priority)."""
        return self._priorities.get(buyer_persona_id, 999)
    
    def get_name(self, buyer_persona_id: str) -> str:
        """Get display name for a buyer persona."""
        return self._priority_names.get(buyer_persona_id, buyer_persona_id)


# Global cache instance
_classifier_cache = ClassifierCache()


def invalidate_classifier_cache():
    """
    Call this function whenever keywords or priorities are modified.
    This ensures the next classification uses fresh data.
    """
    _classifier_cache.invalidate()


# =============================================================================
# NORMALIZATION
# =============================================================================

def normalize_job_title(job_title: Optional[str]) -> str:
    """
    Normalize job title for consistent matching.
    
    Transformations:
    - Lowercase
    - Remove accents (á → a, ñ → n, etc.)
    - Trim whitespace
    - Collapse multiple spaces
    - Remove special characters (except alphanumeric and spaces)
    
    Args:
        job_title: Raw job title string
        
    Returns:
        Normalized string, empty string if input is None/empty
    """
    if not job_title:
        return ""
    
    # Lowercase
    normalized = job_title.lower()
    
    # Remove accents using Unicode normalization
    # NFD decomposes characters, then we remove combining marks
    normalized = unicodedata.normalize('NFD', normalized)
    normalized = ''.join(
        char for char in normalized 
        if unicodedata.category(char) != 'Mn'  # Mn = Mark, Nonspacing
    )
    
    # Remove special characters (keep alphanumeric and spaces)
    normalized = re.sub(r'[^a-z0-9\s]', ' ', normalized)
    
    # Collapse multiple spaces and trim
    normalized = re.sub(r'\s+', ' ', normalized).strip()
    
    return normalized


# =============================================================================
# CORE CLASSIFICATION
# =============================================================================

# Default buyer persona when no keywords match
DEFAULT_BUYER_PERSONA_ID = "mateo"
DEFAULT_BUYER_PERSONA_NAME = "Mateo"


class ClassificationResult:
    """
    Result of a classification operation.
    Contains all information needed for auditing and display.
    """
    
    def __init__(
        self,
        buyer_persona_id: str,
        buyer_persona_name: str,
        matched_keywords: List[str],
        priority_used: int,
        normalized_job_title: str,
        original_job_title: str,
        all_matches: Optional[List[Dict]] = None
    ):
        self.buyer_persona_id = buyer_persona_id
        self.buyer_persona_name = buyer_persona_name
        self.matched_keywords = matched_keywords
        self.priority_used = priority_used
        self.normalized_job_title = normalized_job_title
        self.original_job_title = original_job_title
        self.all_matches = all_matches or []
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for API responses."""
        return {
            "buyer_persona_id": self.buyer_persona_id,
            "buyer_persona_name": self.buyer_persona_name,
            "matched_keywords": self.matched_keywords,
            "priority_used": self.priority_used,
            "normalized_job_title": self.normalized_job_title,
            "original_job_title": self.original_job_title,
            "all_matches": self.all_matches
        }
    
    @property
    def is_default(self) -> bool:
        """Returns True if this is the default (Mateo) classification."""
        return self.buyer_persona_id == DEFAULT_BUYER_PERSONA_ID


async def classify_job_title(
    db,
    job_title: str,
    use_cache: bool = True
) -> ClassificationResult:
    """
    Classify a job title to determine buyer persona.
    
    This is the SINGLE OFFICIAL classification function.
    All classification operations MUST use this function.
    
    Algorithm:
    1. Normalize job title
    2. Find all keywords that EXACTLY match the normalized job title
    3. For each match, get the buyer persona's priority
    4. Return the match with highest priority (lowest number)
    5. If no matches, return default (Mateo)
    
    IMPORTANT: Uses EXACT MATCH only. The keyword must be exactly
    equal to the normalized job title to match.
    
    Args:
        db: Database connection
        job_title: Raw job title to classify
        use_cache: Whether to use cached keywords (default True)
                  Set to False for testing or when freshness is critical
    
    Returns:
        ClassificationResult with all match information
    """
    original = job_title or ""
    normalized = normalize_job_title(job_title)
    
    # Handle empty job title
    if not normalized:
        return ClassificationResult(
            buyer_persona_id=DEFAULT_BUYER_PERSONA_ID,
            buyer_persona_name=DEFAULT_BUYER_PERSONA_NAME,
            matched_keywords=[],
            priority_used=999,
            normalized_job_title="",
            original_job_title=original
        )
    
    # Load cache if needed
    if use_cache:
        await _classifier_cache.ensure_loaded(db)
        keywords = _classifier_cache.keywords
        get_priority = _classifier_cache.get_priority
        get_name = _classifier_cache.get_name
    else:
        # Direct DB load (bypass cache)
        keywords = await db.job_keywords.find({}, {"_id": 0}).to_list(None)
        priorities_list = await db.buyer_persona_priorities.find(
            {}, {"_id": 0}
        ).sort("priority", 1).to_list(None)
        
        priority_map = {p["buyer_persona_id"]: p["priority"] for p in priorities_list}
        name_map = {p["buyer_persona_id"]: p["buyer_persona_name"] for p in priorities_list}
        
        def get_priority(bp_id): return priority_map.get(bp_id, 999)
        def get_name(bp_id): return name_map.get(bp_id, bp_id)
    
    # Find all matching keywords
    matches = []
    matched_keywords_set = set()
    
    for kw in keywords:
        keyword = kw.get("keyword", "").lower()
        if not keyword:
            continue
        
        # Normalize keyword for comparison
        keyword_normalized = normalize_job_title(keyword)
        
        # EXACT MATCH: keyword must be exactly equal to normalized job title
        if keyword_normalized and keyword_normalized == normalized:
            bp_id = kw.get("buyer_persona_id", "")
            bp_name = kw.get("buyer_persona_name", "") or get_name(bp_id)
            priority = get_priority(bp_id)
            
            matches.append({
                "keyword": keyword,
                "buyer_persona_id": bp_id,
                "buyer_persona_name": bp_name,
                "priority": priority
            })
            matched_keywords_set.add(keyword)
    
    # No matches - return default
    if not matches:
        return ClassificationResult(
            buyer_persona_id=DEFAULT_BUYER_PERSONA_ID,
            buyer_persona_name=DEFAULT_BUYER_PERSONA_NAME,
            matched_keywords=[],
            priority_used=999,
            normalized_job_title=normalized,
            original_job_title=original
        )
    
    # Sort by priority (lowest = highest priority)
    matches.sort(key=lambda x: x["priority"])
    best_match = matches[0]
    
    # Collect all keywords that matched for the winning persona
    winning_keywords = [
        m["keyword"] for m in matches 
        if m["buyer_persona_id"] == best_match["buyer_persona_id"]
    ]
    
    return ClassificationResult(
        buyer_persona_id=best_match["buyer_persona_id"],
        buyer_persona_name=best_match["buyer_persona_name"],
        matched_keywords=winning_keywords,
        priority_used=best_match["priority"],
        normalized_job_title=normalized,
        original_job_title=original,
        all_matches=matches
    )


async def classify_job_title_simple(
    db,
    job_title: str,
    use_cache: bool = True
) -> str:
    """
    Simplified classification that returns just the buyer_persona_id.
    
    Use this for bulk operations where you only need the ID.
    For detailed results, use classify_job_title().
    
    Args:
        db: Database connection
        job_title: Raw job title to classify
        use_cache: Whether to use cached keywords
    
    Returns:
        buyer_persona_id string
    """
    result = await classify_job_title(db, job_title, use_cache)
    return result.buyer_persona_id


async def classify_job_title_with_name(
    db,
    job_title: str,
    use_cache: bool = True
) -> Tuple[str, str]:
    """
    Classification that returns (buyer_persona_id, buyer_persona_name).
    
    Convenience function for components that need both.
    
    Args:
        db: Database connection
        job_title: Raw job title to classify
        use_cache: Whether to use cached keywords
    
    Returns:
        Tuple of (buyer_persona_id, buyer_persona_name)
    """
    result = await classify_job_title(db, job_title, use_cache)
    return result.buyer_persona_id, result.buyer_persona_name


# =============================================================================
# BATCH CLASSIFICATION (for imports)
# =============================================================================

async def classify_job_titles_batch(
    db,
    job_titles: List[str]
) -> Dict[str, ClassificationResult]:
    """
    Classify multiple job titles efficiently.
    
    Uses cache and processes all titles against loaded keywords.
    Returns a dictionary mapping original job_title -> ClassificationResult.
    
    Args:
        db: Database connection
        job_titles: List of job titles to classify
    
    Returns:
        Dict mapping job_title -> ClassificationResult
    """
    # Ensure cache is loaded
    await _classifier_cache.ensure_loaded(db)
    
    results = {}
    
    for job_title in job_titles:
        if job_title in results:
            continue  # Skip duplicates
        
        result = await classify_job_title(db, job_title, use_cache=True)
        results[job_title] = result
    
    return results


async def pre_classify_for_import(
    db,
    job_titles: set
) -> Dict[str, str]:
    """
    Pre-classify job titles for import operations.
    
    Returns a simple mapping of job_title -> buyer_persona_id.
    Optimized for bulk imports where you need to classify thousands of titles.
    
    Args:
        db: Database connection
        job_titles: Set of unique job titles
    
    Returns:
        Dict mapping job_title -> buyer_persona_id
    """
    # Ensure cache is loaded once
    await _classifier_cache.ensure_loaded(db)
    
    results = {}
    
    for job_title in job_titles:
        result = await classify_job_title(db, job_title, use_cache=True)
        results[job_title] = result.buyer_persona_id
    
    return results


# =============================================================================
# OVERRIDE PROTECTION
# =============================================================================

async def should_reclassify_contact(
    db,
    contact: Dict,
    respect_lock: bool = True
) -> Tuple[bool, str]:
    """
    Determine if a contact should be reclassified.
    
    Checks:
    - buyer_persona_locked flag
    - buyer_persona_assigned_manually flag (if respect_lock)
    
    Args:
        db: Database connection
        contact: Contact document
        respect_lock: Whether to respect manual override flags
    
    Returns:
        Tuple of (should_reclassify: bool, reason: str)
    """
    if not respect_lock:
        return True, "lock_ignored"
    
    if contact.get("buyer_persona_locked"):
        return False, "locked"
    
    if contact.get("buyer_persona_assigned_manually"):
        return False, "manually_assigned"
    
    return True, "eligible"


async def lock_buyer_persona(
    db,
    contact_id: str,
    locked: bool = True,
    manual: bool = True
) -> bool:
    """
    Lock or unlock a contact's buyer persona.
    
    When locked, the contact will be excluded from bulk reclassification.
    
    Args:
        db: Database connection
        contact_id: Contact ID to update
        locked: Whether to lock (True) or unlock (False)
        manual: Whether to mark as manually assigned
    
    Returns:
        True if update succeeded
    """
    try:
        result = await db.unified_contacts.update_one(
            {"id": contact_id},
            {"$set": {
                "buyer_persona_locked": locked,
                "buyer_persona_assigned_manually": manual,
                "updated_at": datetime.now(timezone.utc).isoformat()
            }}
        )
        return result.modified_count > 0
    except Exception as e:
        logger.error(f"Error locking buyer persona for {contact_id}: {e}")
        return False


# =============================================================================
# INDEX MANAGEMENT
# =============================================================================

async def ensure_classifier_indexes(db) -> Dict[str, Any]:
    """
    Ensure all required indexes exist for efficient classification.
    
    Creates indexes on:
    - job_keywords.keyword
    - job_keywords.buyer_persona_id
    - unified_contacts.job_title_normalized
    - unified_contacts.buyer_persona
    - unified_contacts.buyer_persona_locked
    
    Args:
        db: Database connection
    
    Returns:
        Dict with index creation results
    """
    results = {}
    
    try:
        # Job keywords indexes
        await db.job_keywords.create_index("keyword")
        results["job_keywords.keyword"] = "created"
        
        await db.job_keywords.create_index("buyer_persona_id")
        results["job_keywords.buyer_persona_id"] = "created"
        
        await db.job_keywords.create_index(
            [("keyword", 1), ("buyer_persona_id", 1)]
        )
        results["job_keywords.keyword_persona_compound"] = "created"
        
        # Unified contacts indexes
        await db.unified_contacts.create_index("job_title_normalized")
        results["unified_contacts.job_title_normalized"] = "created"
        
        await db.unified_contacts.create_index("buyer_persona")
        results["unified_contacts.buyer_persona"] = "created"
        
        await db.unified_contacts.create_index("buyer_persona_locked")
        results["unified_contacts.buyer_persona_locked"] = "created"
        
        logger.info(f"Classifier indexes ensured: {results}")
        
    except Exception as e:
        logger.error(f"Error creating classifier indexes: {e}")
        results["error"] = str(e)
    
    return results


# =============================================================================
# NORMALIZATION MIGRATION
# =============================================================================

async def normalize_contacts_job_titles(
    db,
    batch_size: int = 1000,
    limit: Optional[int] = None
) -> Dict[str, Any]:
    """
    Migrate existing contacts to add job_title_normalized field.
    
    This should be run once to backfill existing data.
    
    Args:
        db: Database connection
        batch_size: Number of contacts to process per batch
        limit: Maximum number of contacts to process (None = all)
    
    Returns:
        Dict with migration statistics
    """
    from pymongo import UpdateOne
    
    stats = {
        "total_processed": 0,
        "updated": 0,
        "already_normalized": 0,
        "no_job_title": 0,
        "errors": 0
    }
    
    try:
        # Find contacts without job_title_normalized
        query = {
            "$or": [
                {"job_title_normalized": {"$exists": False}},
                {"job_title_normalized": None}
            ],
            "job_title": {"$exists": True, "$nin": [None, ""]}
        }
        
        cursor = db.unified_contacts.find(
            query,
            {"_id": 0, "id": 1, "job_title": 1}
        )
        
        if limit:
            cursor = cursor.limit(limit)
        
        batch = []
        
        async for contact in cursor:
            job_title = contact.get("job_title", "")
            normalized = normalize_job_title(job_title)
            
            if normalized:
                batch.append(UpdateOne(
                    {"id": contact["id"]},
                    {"$set": {"job_title_normalized": normalized}}
                ))
                stats["total_processed"] += 1
            else:
                stats["no_job_title"] += 1
            
            if len(batch) >= batch_size:
                result = await db.unified_contacts.bulk_write(batch, ordered=False)
                stats["updated"] += result.modified_count
                batch = []
        
        # Process remaining batch
        if batch:
            result = await db.unified_contacts.bulk_write(batch, ordered=False)
            stats["updated"] += result.modified_count
        
        logger.info(f"Normalization migration complete: {stats}")
        
    except Exception as e:
        logger.error(f"Error in normalization migration: {e}")
        stats["errors"] += 1
        stats["error_message"] = str(e)
    
    return stats


# =============================================================================
# DIAGNOSTICS
# =============================================================================

async def diagnose_classification(
    db,
    job_title: str
) -> Dict[str, Any]:
    """
    Diagnose classification for a job title.
    
    Returns detailed information about how classification was determined,
    useful for debugging and the diagnostic UI.
    
    Args:
        db: Database connection
        job_title: Job title to diagnose
    
    Returns:
        Dict with full diagnostic information
    """
    result = await classify_job_title(db, job_title, use_cache=False)
    
    return {
        "input": {
            "original": job_title,
            "normalized": result.normalized_job_title
        },
        "result": {
            "buyer_persona_id": result.buyer_persona_id,
            "buyer_persona_name": result.buyer_persona_name,
            "is_default": result.is_default
        },
        "matching": {
            "keywords_matched": result.matched_keywords,
            "priority_used": result.priority_used,
            "total_matches": len(result.all_matches),
            "all_matches": result.all_matches
        },
        "cache_status": {
            "is_valid": _classifier_cache._is_valid,
            "keywords_count": len(_classifier_cache.keywords) if _classifier_cache._is_valid else 0,
            "last_loaded": _classifier_cache._last_loaded.isoformat() if _classifier_cache._last_loaded else None
        }
    }
