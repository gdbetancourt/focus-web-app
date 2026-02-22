"""
Merge Candidates Cache Service

This service pre-computes and caches merge candidates (duplicates by domain and similar names)
to avoid expensive real-time calculations during login and page loads.

The cache is stored in the `merge_candidates_cache` collection and should be refreshed
periodically via a background job or manual trigger.
"""
import logging
from datetime import datetime, timezone
from typing import Dict, List, Optional
from collections import defaultdict

logger = logging.getLogger(__name__)


async def refresh_merge_candidates_cache(db) -> Dict:
    """
    Refresh the merge candidates cache by computing duplicates and similar names.
    This is an expensive operation that should run in the background.
    
    Returns summary of cached candidates.
    """
    from services.company_auto_merge import find_duplicate_domains, find_similar_names, FUZZY_AVAILABLE
    
    now = datetime.now(timezone.utc)
    logger.info("Starting merge candidates cache refresh...")
    
    try:
        # 1. Find domain duplicates
        logger.info("Finding domain duplicates...")
        domain_duplicates = await find_duplicate_domains(db, limit=1000)
        domain_count = len(domain_duplicates)
        logger.info(f"Found {domain_count} domain duplicate groups")
        
        # 2. Find similar names (only if fuzzy matching is available)
        similar_names_groups = []
        names_count = 0
        if FUZZY_AVAILABLE:
            logger.info("Finding similar name candidates...")
            similar_names_groups = await find_similar_names(db, limit=1000, min_similarity=85)
            names_count = len(similar_names_groups)
            logger.info(f"Found {names_count} similar name groups")
        else:
            logger.warning("Fuzzy matching not available, skipping similar names")
        
        # 3. Transform domain duplicates to cacheable format
        domain_candidates = []
        for domain, companies in domain_duplicates.items():
            if len(companies) < 2:
                continue
            
            # Sort by completeness
            sorted_companies = sorted(
                companies,
                key=lambda c: (
                    1 if c.get('hs_object_id') or (c.get('hubspot_id') and not str(c.get('hubspot_id', '')).startswith('auto_')) else 0,
                    len(c.get('domains', [])),
                    1 if c.get('name') else 0
                ),
                reverse=True
            )
            
            primary = sorted_companies[0]
            secondaries = sorted_companies[1:]
            
            domain_candidates.append({
                "type": "domain",
                "key": domain,
                "domain": domain,
                "company_count": len(companies),
                "primary": {
                    "id": primary.get('_company_id'),
                    "name": primary.get('name'),
                    "domain": primary.get('domain'),
                    "domains": primary.get('domains', [])
                },
                "secondaries": [
                    {
                        "id": s.get('_company_id'),
                        "name": s.get('name'),
                        "domain": s.get('domain')
                    }
                    for s in secondaries
                ]
            })
        
        # 4. Transform similar names to cacheable format
        name_candidates = []
        for group in similar_names_groups:
            companies = group.get('companies', [])
            if len(companies) < 2:
                continue
            
            sorted_companies = sorted(
                companies,
                key=lambda c: (
                    1 if c.get('hubspot_id') and not str(c.get('hubspot_id', '')).startswith('auto_') else 0,
                    len(c.get('domains', []))
                ),
                reverse=True
            )
            
            primary = sorted_companies[0]
            secondaries = sorted_companies[1:]
            
            name_candidates.append({
                "type": "similar_name",
                "key": group.get('normalized_name'),
                "normalized_name": group.get('normalized_name'),
                "match_type": group.get('match_type'),
                "similarity_score": group.get('similarity_score', 100),
                "similar_names": group.get('similar_names', []),
                "company_count": len(companies),
                "primary": {
                    "id": primary.get('_company_id') or primary.get('id') or primary.get('hubspot_id'),
                    "name": primary.get('name'),
                    "domain": primary.get('domain'),
                    "domains": primary.get('domains', [])
                },
                "secondaries": [
                    {
                        "id": s.get('_company_id') or s.get('id') or s.get('hubspot_id'),
                        "name": s.get('name'),
                        "domain": s.get('domain'),
                        "score": group.get('similarity_score', 100)
                    }
                    for s in secondaries
                ]
            })
        
        # 5. Store in cache collection (replace all)
        cache_doc = {
            "last_updated": now.isoformat(),
            "domain_candidates": domain_candidates,
            "domain_count": len(domain_candidates),
            "name_candidates": name_candidates,
            "name_count": len(name_candidates),
            "total_count": len(domain_candidates) + len(name_candidates),
            "fuzzy_available": FUZZY_AVAILABLE
        }
        
        # Use upsert to replace the single cache document
        await db.merge_candidates_cache.update_one(
            {"_type": "main_cache"},
            {"$set": {**cache_doc, "_type": "main_cache"}},
            upsert=True
        )
        
        logger.info(f"Cache refresh complete: {len(domain_candidates)} domain groups, {len(name_candidates)} name groups")
        
        return {
            "success": True,
            "domain_groups": len(domain_candidates),
            "name_groups": len(name_candidates),
            "total": len(domain_candidates) + len(name_candidates),
            "last_updated": now.isoformat()
        }
        
    except Exception as e:
        logger.error(f"Error refreshing merge candidates cache: {e}")
        return {
            "success": False,
            "error": str(e)
        }


async def get_cached_candidates(db) -> Optional[Dict]:
    """
    Get cached merge candidates. Returns None if cache is empty or stale.
    """
    cache = await db.merge_candidates_cache.find_one(
        {"_type": "main_cache"},
        {"_id": 0}
    )
    return cache


async def get_cached_domain_candidates(db, limit: int = 100) -> List[Dict]:
    """
    Get cached domain duplicate candidates.
    """
    cache = await get_cached_candidates(db)
    if not cache:
        return []
    
    return cache.get("domain_candidates", [])[:limit]


async def get_cached_name_candidates(db, limit: int = 100) -> List[Dict]:
    """
    Get cached similar name candidates.
    """
    cache = await get_cached_candidates(db)
    if not cache:
        return []
    
    return cache.get("name_candidates", [])[:limit]


async def get_cached_counts(db) -> Dict:
    """
    Get counts from cache for quick semaphore calculation.
    Returns {"domain_count": int, "name_count": int, "total_count": int, "last_updated": str}
    """
    cache = await db.merge_candidates_cache.find_one(
        {"_type": "main_cache"},
        {"_id": 0, "domain_count": 1, "name_count": 1, "total_count": 1, "last_updated": 1}
    )
    
    if not cache:
        return {
            "domain_count": 0,
            "name_count": 0,
            "total_count": 0,
            "last_updated": None,
            "cache_exists": False
        }
    
    return {
        "domain_count": cache.get("domain_count", 0),
        "name_count": cache.get("name_count", 0),
        "total_count": cache.get("total_count", 0),
        "last_updated": cache.get("last_updated"),
        "cache_exists": True
    }


async def invalidate_cache(db):
    """
    Mark cache as stale (but don't delete it).
    Useful when companies are merged and cache needs refresh.
    """
    now = datetime.now(timezone.utc)
    await db.merge_candidates_cache.update_one(
        {"_type": "main_cache"},
        {"$set": {"invalidated_at": now.isoformat(), "is_stale": True}}
    )


async def remove_from_cache(db, candidate_type: str, key: str):
    """
    Remove a specific candidate from cache after merge/dismiss.
    This avoids showing already-processed candidates until next full refresh.
    
    Args:
        candidate_type: "domain" or "similar_name"
        key: The domain or normalized_name to remove
    """
    if candidate_type == "domain":
        await db.merge_candidates_cache.update_one(
            {"_type": "main_cache"},
            {
                "$pull": {"domain_candidates": {"domain": key}},
                "$inc": {"domain_count": -1, "total_count": -1}
            }
        )
    elif candidate_type == "similar_name":
        await db.merge_candidates_cache.update_one(
            {"_type": "main_cache"},
            {
                "$pull": {"name_candidates": {"normalized_name": key}},
                "$inc": {"name_count": -1, "total_count": -1}
            }
        )
