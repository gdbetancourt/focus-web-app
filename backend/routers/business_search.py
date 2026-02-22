"""
Business Search Configuration Router
Manages business types, cities, and the search queue for Google Maps prospecting (1.1.2)
"""
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime, timezone
import uuid

from database import db
from routers.auth import get_current_user

router = APIRouter(prefix="/business-search", tags=["business-search"])


# ============ MODELS ============

class BusinessTypeCreate(BaseModel):
    category_name: str  # Display name for messages, e.g., "farmacia"
    search_keyword: str  # Google Maps search term, e.g., "farmacias"


class BusinessTypeUpdate(BaseModel):
    category_name: Optional[str] = None
    search_keyword: Optional[str] = None


class CityCreate(BaseModel):
    name: str  # City name, e.g., "Ciudad de México"
    state: Optional[str] = None  # State/Province


class CityUpdate(BaseModel):
    name: Optional[str] = None
    state: Optional[str] = None


class SearchQueueItem(BaseModel):
    business_type_id: str
    business_type_name: str
    city_id: str
    city_name: str
    search_query: str  # Combined: "{keyword} en {city}"
    status: str  # pending, completed, failed
    created_at: str
    executed_at: Optional[str] = None
    results_count: Optional[int] = None


# ============ BUSINESS TYPES ENDPOINTS ============

@router.get("/business-types")
async def list_business_types(current_user: dict = Depends(get_current_user)):
    """List all business types"""
    business_types = await db.business_types.find(
        {},
        {"_id": 0}
    ).sort("category_name", 1).to_list(500)
    
    return {
        "business_types": business_types,
        "count": len(business_types)
    }


@router.post("/business-types")
async def create_business_type(
    data: BusinessTypeCreate,
    current_user: dict = Depends(get_current_user)
):
    """Create a new business type and generate search queue combinations"""
    # Check for duplicate
    existing = await db.business_types.find_one({
        "$or": [
            {"category_name": {"$regex": f"^{data.category_name}$", "$options": "i"}},
            {"search_keyword": {"$regex": f"^{data.search_keyword}$", "$options": "i"}}
        ]
    })
    if existing:
        raise HTTPException(status_code=400, detail="Business type already exists")
    
    business_type = {
        "id": str(uuid.uuid4()),
        "category_name": data.category_name.strip(),
        "search_keyword": data.search_keyword.strip(),
        "created_at": datetime.now(timezone.utc).isoformat(),
        "created_by": current_user["id"]
    }
    
    await db.business_types.insert_one(business_type)
    
    # Generate search queue combinations with all existing cities
    cities = await db.search_cities.find({}, {"_id": 0}).to_list(1000)
    queue_items = []
    
    for city in cities:
        queue_item = {
            "id": str(uuid.uuid4()),
            "business_type_id": business_type["id"],
            "business_type_name": business_type["category_name"],
            "city_id": city["id"],
            "city_name": city["name"],
            "search_query": f"{business_type['search_keyword']} en {city['name']}",
            "status": "pending",
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        queue_items.append(queue_item)
    
    if queue_items:
        await db.business_search_queue.insert_many(queue_items)
    
    return {
        "success": True,
        "business_type": {k: v for k, v in business_type.items() if k != "_id"},
        "queue_items_created": len(queue_items)
    }


@router.put("/business-types/{business_type_id}")
async def update_business_type(
    business_type_id: str,
    data: BusinessTypeUpdate,
    current_user: dict = Depends(get_current_user)
):
    """Update a business type"""
    update_data = {k: v for k, v in data.model_dump().items() if v is not None}
    if not update_data:
        raise HTTPException(status_code=400, detail="No update data provided")
    
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    result = await db.business_types.update_one(
        {"id": business_type_id},
        {"$set": update_data}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Business type not found")
    
    # Update related queue items if category_name changed
    if "category_name" in update_data:
        await db.business_search_queue.update_many(
            {"business_type_id": business_type_id},
            {"$set": {"business_type_name": update_data["category_name"]}}
        )
    
    return {"success": True, "updated": True}


@router.delete("/business-types/{business_type_id}")
async def delete_business_type(
    business_type_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Delete a business type and its pending queue items"""
    result = await db.business_types.delete_one({"id": business_type_id})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Business type not found")
    
    # Remove pending queue items for this business type
    queue_result = await db.business_search_queue.delete_many({
        "business_type_id": business_type_id,
        "status": "pending"
    })
    
    return {
        "success": True,
        "deleted": True,
        "queue_items_removed": queue_result.deleted_count
    }


# ============ CITIES ENDPOINTS ============

@router.get("/cities")
async def list_cities(current_user: dict = Depends(get_current_user)):
    """List all cities for search"""
    cities = await db.search_cities.find(
        {},
        {"_id": 0}
    ).sort("name", 1).to_list(500)
    
    return {
        "cities": cities,
        "count": len(cities)
    }


@router.post("/cities")
async def create_city(
    data: CityCreate,
    current_user: dict = Depends(get_current_user)
):
    """Create a new city and generate search queue combinations"""
    # Check for duplicate
    existing = await db.search_cities.find_one({
        "name": {"$regex": f"^{data.name}$", "$options": "i"}
    })
    if existing:
        raise HTTPException(status_code=400, detail="City already exists")
    
    city = {
        "id": str(uuid.uuid4()),
        "name": data.name.strip(),
        "state": data.state.strip() if data.state else None,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "created_by": current_user["id"]
    }
    
    await db.search_cities.insert_one(city)
    
    # Generate search queue combinations with all existing business types
    business_types = await db.business_types.find({}, {"_id": 0}).to_list(500)
    queue_items = []
    
    for bt in business_types:
        queue_item = {
            "id": str(uuid.uuid4()),
            "business_type_id": bt["id"],
            "business_type_name": bt["category_name"],
            "city_id": city["id"],
            "city_name": city["name"],
            "search_query": f"{bt['search_keyword']} en {city['name']}",
            "status": "pending",
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        queue_items.append(queue_item)
    
    if queue_items:
        await db.business_search_queue.insert_many(queue_items)
    
    return {
        "success": True,
        "city": {k: v for k, v in city.items() if k != "_id"},
        "queue_items_created": len(queue_items)
    }


@router.put("/cities/{city_id}")
async def update_city(
    city_id: str,
    data: CityUpdate,
    current_user: dict = Depends(get_current_user)
):
    """Update a city"""
    update_data = {k: v for k, v in data.model_dump().items() if v is not None}
    if not update_data:
        raise HTTPException(status_code=400, detail="No update data provided")
    
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    result = await db.search_cities.update_one(
        {"id": city_id},
        {"$set": update_data}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="City not found")
    
    # Update related queue items if name changed
    if "name" in update_data:
        await db.business_search_queue.update_many(
            {"city_id": city_id},
            {"$set": {"city_name": update_data["name"]}}
        )
    
    return {"success": True, "updated": True}


@router.delete("/cities/{city_id}")
async def delete_city(
    city_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Delete a city and its pending queue items"""
    result = await db.search_cities.delete_one({"id": city_id})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="City not found")
    
    # Remove pending queue items for this city
    queue_result = await db.business_search_queue.delete_many({
        "city_id": city_id,
        "status": "pending"
    })
    
    return {
        "success": True,
        "deleted": True,
        "queue_items_removed": queue_result.deleted_count
    }


# ============ SEARCH QUEUE ENDPOINTS ============

@router.get("/queue")
async def list_search_queue(
    status: Optional[str] = None,
    limit: int = 100,
    current_user: dict = Depends(get_current_user)
):
    """List search queue items"""
    query = {}
    if status:
        query["status"] = status
    
    queue_items = await db.business_search_queue.find(
        query,
        {"_id": 0}
    ).sort("created_at", -1).to_list(limit)
    
    # Get counts by status
    pending_count = await db.business_search_queue.count_documents({"status": "pending"})
    completed_count = await db.business_search_queue.count_documents({"status": "completed"})
    failed_count = await db.business_search_queue.count_documents({"status": "failed"})
    
    return {
        "queue_items": queue_items,
        "counts": {
            "pending": pending_count,
            "completed": completed_count,
            "failed": failed_count,
            "total": pending_count + completed_count + failed_count
        }
    }


@router.post("/queue/{queue_id}/execute")
async def mark_queue_item_executed(
    queue_id: str,
    results_count: int = 0,
    current_user: dict = Depends(get_current_user)
):
    """Mark a queue item as executed (called by the scraper)"""
    result = await db.business_search_queue.update_one(
        {"id": queue_id},
        {
            "$set": {
                "status": "completed",
                "executed_at": datetime.now(timezone.utc).isoformat(),
                "results_count": results_count
            }
        }
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Queue item not found")
    
    return {"success": True, "marked_completed": True}


@router.post("/queue/{queue_id}/fail")
async def mark_queue_item_failed(
    queue_id: str,
    error_message: str = "",
    current_user: dict = Depends(get_current_user)
):
    """Mark a queue item as failed"""
    result = await db.business_search_queue.update_one(
        {"id": queue_id},
        {
            "$set": {
                "status": "failed",
                "executed_at": datetime.now(timezone.utc).isoformat(),
                "error_message": error_message
            }
        }
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Queue item not found")
    
    return {"success": True, "marked_failed": True}


@router.post("/queue/{queue_id}/retry")
async def retry_queue_item(
    queue_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Reset a failed queue item to pending for retry"""
    result = await db.business_search_queue.update_one(
        {"id": queue_id, "status": {"$in": ["failed", "completed"]}},
        {
            "$set": {"status": "pending"},
            "$unset": {"executed_at": "", "results_count": "", "error_message": ""}
        }
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Queue item not found or already pending")
    
    return {"success": True, "reset_to_pending": True}


@router.delete("/queue/{queue_id}")
async def delete_queue_item(
    queue_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Delete a queue item"""
    result = await db.business_search_queue.delete_one({"id": queue_id})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Queue item not found")
    
    return {"success": True, "deleted": True}


@router.post("/queue/regenerate")
async def regenerate_search_queue(
    clear_existing: bool = False,
    current_user: dict = Depends(get_current_user)
):
    """
    Regenerate the search queue with all business type + city combinations.
    Use clear_existing=true to remove all pending items first.
    """
    # Optionally clear existing pending items
    deleted_count = 0
    if clear_existing:
        result = await db.business_search_queue.delete_many({"status": "pending"})
        deleted_count = result.deleted_count
    
    # Get all business types and cities
    business_types = await db.business_types.find({}, {"_id": 0}).to_list(500)
    cities = await db.search_cities.find({}, {"_id": 0}).to_list(500)
    
    if not business_types or not cities:
        return {
            "success": False,
            "message": "No business types or cities configured",
            "business_types_count": len(business_types),
            "cities_count": len(cities)
        }
    
    # Get existing combinations to avoid duplicates
    existing = await db.business_search_queue.find(
        {"status": {"$ne": "completed"}},
        {"business_type_id": 1, "city_id": 1}
    ).to_list(10000)
    existing_combos = {(e.get("business_type_id"), e.get("city_id")) for e in existing}
    
    # Generate new queue items for missing combinations
    queue_items = []
    for bt in business_types:
        for city in cities:
            combo = (bt["id"], city["id"])
            if combo not in existing_combos:
                queue_item = {
                    "id": str(uuid.uuid4()),
                    "business_type_id": bt["id"],
                    "business_type_name": bt["category_name"],
                    "city_id": city["id"],
                    "city_name": city["name"],
                    "search_query": f"{bt['search_keyword']} en {city['name']}",
                    "status": "pending",
                    "created_at": datetime.now(timezone.utc).isoformat()
                }
                queue_items.append(queue_item)
    
    # Insert new items
    if queue_items:
        await db.business_search_queue.insert_many(queue_items)
    
    return {
        "success": True,
        "cleared_existing": deleted_count if clear_existing else 0,
        "new_items_created": len(queue_items),
        "business_types": len(business_types),
        "cities": len(cities),
        "total_combinations": len(business_types) * len(cities)
    }



@router.get("/stats")
async def get_search_stats(current_user: dict = Depends(get_current_user)):
    """Get overall statistics for business search configuration"""
    business_types_count = await db.business_types.count_documents({})
    cities_count = await db.search_cities.count_documents({})
    
    pending_count = await db.business_search_queue.count_documents({"status": "pending"})
    completed_count = await db.business_search_queue.count_documents({"status": "completed"})
    failed_count = await db.business_search_queue.count_documents({"status": "failed"})
    
    # Total possible combinations
    total_combinations = business_types_count * cities_count
    
    return {
        "business_types": business_types_count,
        "cities": cities_count,
        "total_combinations": total_combinations,
        "queue": {
            "pending": pending_count,
            "completed": completed_count,
            "failed": failed_count
        }
    }
