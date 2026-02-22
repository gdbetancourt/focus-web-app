"""
Persona Classifier Metrics Worker - Precomputes classification statistics

This worker calculates and stores metrics every 6 hours:
- Contact distribution by buyer persona
- Keyword usage statistics
- Classification coverage
- Trends over time

The precomputed metrics allow fast dashboard loading without
running expensive aggregations on each request.
"""

import asyncio
import logging
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, List, Optional

from database import db

# Configure logging
logger = logging.getLogger('persona_classifier_metrics')

# Configuration
METRICS_INTERVAL_HOURS = 6
METRICS_RETENTION_DAYS = 90  # Keep 90 days of historical metrics


async def compute_classifier_metrics() -> Dict[str, Any]:
    """
    Compute all classifier metrics.
    
    Returns a dictionary with:
    - contacts: distribution by persona, locked count, etc.
    - keywords: count by persona, top keywords, unused keywords
    - coverage: normalization coverage, classification rate
    - trends: comparison with previous period
    """
    logger.info("Computing classifier metrics...")
    
    now = datetime.now(timezone.utc)
    metrics = {
        "computed_at": now.isoformat(),
        "type": "global",
        "contacts": {},
        "keywords": {},
        "coverage": {},
        "top_keywords": [],
        "unused_keywords": [],
        "trends": {}
    }
    
    try:
        # =================================================================
        # CONTACTS METRICS
        # =================================================================
        
        # Total contacts
        total_contacts = await db.unified_contacts.count_documents({})
        metrics["contacts"]["total"] = total_contacts
        
        # Contacts by buyer persona
        persona_pipeline = [
            {"$group": {"_id": "$buyer_persona", "count": {"$sum": 1}}}
        ]
        persona_counts = await db.unified_contacts.aggregate(persona_pipeline).to_list(None)
        metrics["contacts"]["by_persona"] = {
            pc["_id"]: pc["count"] 
            for pc in persona_counts 
            if pc["_id"] and pc["_id"] not in ["null", "undefined", None]
        }
        
        # Locked contacts
        locked_count = await db.unified_contacts.count_documents({"buyer_persona_locked": True})
        metrics["contacts"]["locked"] = locked_count
        
        # Manually assigned contacts
        manual_count = await db.unified_contacts.count_documents({"buyer_persona_assigned_manually": True})
        metrics["contacts"]["manually_assigned"] = manual_count
        
        # Contacts with job_title
        with_job_title = await db.unified_contacts.count_documents({
            "job_title": {"$exists": True, "$nin": [None, ""]}
        })
        metrics["contacts"]["with_job_title"] = with_job_title
        
        # Contacts with normalized job title
        with_normalized = await db.unified_contacts.count_documents({
            "job_title_normalized": {"$exists": True, "$nin": [None, ""]}
        })
        metrics["contacts"]["with_normalized_job_title"] = with_normalized
        
        # Contacts with default persona (Mateo)
        default_persona_count = await db.unified_contacts.count_documents({
            "$or": [
                {"buyer_persona": "mateo"},
                {"buyer_persona": "Mateo"},
                {"buyer_persona": None},
                {"buyer_persona": {"$exists": False}}
            ]
        })
        metrics["contacts"]["default_persona"] = default_persona_count
        
        # =================================================================
        # KEYWORDS METRICS
        # =================================================================
        
        # Total keywords
        total_keywords = await db.job_keywords.count_documents({})
        metrics["keywords"]["total"] = total_keywords
        
        # Keywords by buyer persona
        keyword_pipeline = [
            {"$group": {"_id": "$buyer_persona_id", "count": {"$sum": 1}}}
        ]
        keyword_counts = await db.job_keywords.aggregate(keyword_pipeline).to_list(None)
        metrics["keywords"]["by_persona"] = {
            kc["_id"]: kc["count"] 
            for kc in keyword_counts 
            if kc["_id"] and kc["_id"] not in ["null", "undefined", None]
        }
        
        # Top keywords by matches (approximate using job_title_normalized search)
        all_keywords = await db.job_keywords.find({}, {"_id": 0, "keyword": 1, "buyer_persona_id": 1}).to_list(None)
        
        keyword_match_counts = []
        for kw in all_keywords[:50]:  # Limit to first 50 to avoid long computation
            keyword_text = kw.get("keyword", "").lower()
            if keyword_text:
                # Count contacts with this keyword in normalized job title
                match_count = await db.unified_contacts.count_documents({
                    "job_title_normalized": {"$regex": keyword_text, "$options": "i"}
                })
                keyword_match_counts.append({
                    "keyword": keyword_text,
                    "buyer_persona_id": kw.get("buyer_persona_id"),
                    "matches": match_count
                })
        
        # Sort by matches descending
        keyword_match_counts.sort(key=lambda x: x["matches"], reverse=True)
        metrics["top_keywords"] = keyword_match_counts[:20]  # Top 20
        
        # Unused keywords (0 matches)
        metrics["unused_keywords"] = [
            kw for kw in keyword_match_counts 
            if kw["matches"] == 0
        ][:20]  # First 20 unused
        
        # =================================================================
        # COVERAGE METRICS
        # =================================================================
        
        # Normalization coverage
        if total_contacts > 0:
            metrics["coverage"]["normalization_percent"] = round(
                (with_normalized / total_contacts) * 100, 2
            )
        else:
            metrics["coverage"]["normalization_percent"] = 0
        
        # Classification coverage (contacts not with default persona)
        if total_contacts > 0:
            classified = total_contacts - default_persona_count
            metrics["coverage"]["classification_percent"] = round(
                (classified / total_contacts) * 100, 2
            )
        else:
            metrics["coverage"]["classification_percent"] = 0
        
        # Job title coverage
        if total_contacts > 0:
            metrics["coverage"]["job_title_percent"] = round(
                (with_job_title / total_contacts) * 100, 2
            )
        else:
            metrics["coverage"]["job_title_percent"] = 0
        
        # =================================================================
        # TRENDS (compare with previous metrics)
        # =================================================================
        
        # Get previous metrics
        previous_metrics = await db.persona_classifier_metrics.find_one(
            {"type": "global"},
            sort=[("computed_at", -1)]
        )
        
        if previous_metrics:
            prev_total = previous_metrics.get("contacts", {}).get("total", 0)
            prev_classified = prev_total - previous_metrics.get("contacts", {}).get("default_persona", 0)
            
            # Contact growth
            if prev_total > 0:
                metrics["trends"]["contact_growth"] = total_contacts - prev_total
                metrics["trends"]["contact_growth_percent"] = round(
                    ((total_contacts - prev_total) / prev_total) * 100, 2
                )
            
            # Classification improvement
            current_classified = total_contacts - default_persona_count
            if prev_classified > 0:
                metrics["trends"]["classification_improvement"] = current_classified - prev_classified
            
            # Keyword growth
            prev_keywords = previous_metrics.get("keywords", {}).get("total", 0)
            metrics["trends"]["keyword_growth"] = total_keywords - prev_keywords
            
            # Time since last update
            prev_time = previous_metrics.get("computed_at")
            if prev_time:
                try:
                    if isinstance(prev_time, str):
                        prev_dt = datetime.fromisoformat(prev_time.replace('Z', '+00:00'))
                    else:
                        prev_dt = prev_time
                    metrics["trends"]["hours_since_last"] = round(
                        (now - prev_dt).total_seconds() / 3600, 1
                    )
                except Exception:
                    pass
        
        logger.info(f"Metrics computed: {total_contacts} contacts, {total_keywords} keywords")
        
    except Exception as e:
        logger.error(f"Error computing metrics: {e}")
        metrics["error"] = str(e)
    
    return metrics


async def store_metrics(metrics: Dict[str, Any]) -> str:
    """
    Store computed metrics in the database.
    
    Returns the inserted document ID.
    """
    # Add metadata
    metrics["_stored_at"] = datetime.now(timezone.utc)
    
    # Insert new metrics
    result = await db.persona_classifier_metrics.insert_one(metrics)
    
    logger.info(f"Metrics stored with ID: {result.inserted_id}")
    
    return str(result.inserted_id)


async def cleanup_old_metrics():
    """
    Remove metrics older than METRICS_RETENTION_DAYS.
    """
    cutoff = datetime.now(timezone.utc) - timedelta(days=METRICS_RETENTION_DAYS)
    
    result = await db.persona_classifier_metrics.delete_many({
        "computed_at": {"$lt": cutoff.isoformat()}
    })
    
    if result.deleted_count > 0:
        logger.info(f"Cleaned up {result.deleted_count} old metrics records")


async def process_metrics_job():
    """
    Main job function - called by APScheduler.
    
    Computes metrics, stores them, and cleans up old records.
    """
    try:
        logger.info("Starting metrics computation job...")
        
        # Compute metrics
        metrics = await compute_classifier_metrics()
        
        # Store metrics
        await store_metrics(metrics)
        
        # Cleanup old metrics
        await cleanup_old_metrics()
        
        logger.info("Metrics job completed successfully")
        
    except Exception as e:
        logger.error(f"Metrics job failed: {e}")


async def get_latest_metrics() -> Optional[Dict[str, Any]]:
    """
    Get the most recent metrics document.
    """
    metrics = await db.persona_classifier_metrics.find_one(
        {"type": "global"},
        {"_id": 0},
        sort=[("computed_at", -1)]
    )
    return metrics


async def get_metrics_history(days: int = 30) -> List[Dict[str, Any]]:
    """
    Get metrics history for the specified number of days.
    
    Returns one record per day (latest for each day).
    """
    cutoff = datetime.now(timezone.utc) - timedelta(days=days)
    
    # Get all metrics since cutoff
    metrics = await db.persona_classifier_metrics.find(
        {
            "type": "global",
            "computed_at": {"$gte": cutoff.isoformat()}
        },
        {"_id": 0}
    ).sort("computed_at", -1).to_list(None)
    
    return metrics


async def ensure_metrics_indexes():
    """
    Create indexes for the metrics collection.
    """
    await db.persona_classifier_metrics.create_index("computed_at")
    await db.persona_classifier_metrics.create_index("type")
    await db.persona_classifier_metrics.create_index(
        [("type", 1), ("computed_at", -1)]
    )
    
    logger.info("Metrics indexes created")
