"""
Foundations Router - Manage Levels, Thematic Axes, and Competencies
This is the core taxonomy for the Focus Content System.

Structure:
- Levels: 1-4 (progression levels for content)
- ThematicAxis: Main content categories (e.g., "HOW", "WHAT", "WHY")
- Competencies: Skills/topics within each ThematicAxis
"""
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timezone
import uuid

from database import db
from routers.auth import get_current_user

router = APIRouter(prefix="/foundations", tags=["foundations"])


# ============ MODELS ============

class LevelCreate(BaseModel):
    number: int  # 1-4
    name: str
    description: Optional[str] = None
    color: Optional[str] = "#3b82f6"


class LevelUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    color: Optional[str] = None


class ThematicAxisCreate(BaseModel):
    name: str  # e.g., "HOW", "WHAT", "WHY"
    slug: Optional[str] = None
    description: Optional[str] = None
    color: Optional[str] = "#8b5cf6"
    order: Optional[int] = 0


class ThematicAxisUpdate(BaseModel):
    name: Optional[str] = None
    slug: Optional[str] = None
    description: Optional[str] = None
    color: Optional[str] = None
    order: Optional[int] = None


class CompetencyCreate(BaseModel):
    name: str
    thematic_axis_id: str  # Reference to ThematicAxis
    description: Optional[str] = None
    color: Optional[str] = "#06b6d4"
    order: Optional[int] = 0


class CompetencyUpdate(BaseModel):
    name: Optional[str] = None
    thematic_axis_id: Optional[str] = None
    description: Optional[str] = None
    color: Optional[str] = None
    order: Optional[int] = None


# ============ LEVELS ENDPOINTS ============

@router.get("/levels")
async def list_levels(current_user: dict = Depends(get_current_user)):
    """List all levels (1-4)"""
    levels = await db.levels.find({}, {"_id": 0}).sort("number", 1).to_list(10)
    
    # If no levels exist, create defaults
    if not levels:
        default_levels = [
            {"number": 1, "name": "Fundamentals", "description": "Basic concepts and introduction", "color": "#22c55e"},
            {"number": 2, "name": "Intermediate", "description": "Building on basics with more depth", "color": "#3b82f6"},
            {"number": 3, "name": "Advanced", "description": "Complex topics and applications", "color": "#8b5cf6"},
            {"number": 4, "name": "Expert", "description": "Mastery and specialized knowledge", "color": "#f59e0b"},
        ]
        for level in default_levels:
            level["id"] = str(uuid.uuid4())
            level["created_at"] = datetime.now(timezone.utc).isoformat()
            await db.levels.insert_one(level)
        
        levels = await db.levels.find({}, {"_id": 0}).sort("number", 1).to_list(10)
    
    return {
        "success": True,
        "levels": levels,
        "total": len(levels)
    }


@router.post("/levels")
async def create_level(
    data: LevelCreate,
    current_user: dict = Depends(get_current_user)
):
    """Create a new level"""
    if data.number < 1 or data.number > 4:
        raise HTTPException(status_code=400, detail="Level number must be between 1 and 4")
    
    # Check if level number already exists
    existing = await db.levels.find_one({"number": data.number})
    if existing:
        raise HTTPException(status_code=400, detail=f"Level {data.number} already exists")
    
    level = {
        "id": str(uuid.uuid4()),
        "number": data.number,
        "name": data.name.strip(),
        "description": data.description,
        "color": data.color,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "created_by": current_user.get("email")
    }
    
    await db.levels.insert_one(level)
    
    return {
        "success": True,
        "level": {k: v for k, v in level.items() if k != "_id"}
    }


@router.put("/levels/{level_id}")
async def update_level(
    level_id: str,
    data: LevelUpdate,
    current_user: dict = Depends(get_current_user)
):
    """Update a level"""
    update_data = {}
    
    if data.name is not None:
        update_data["name"] = data.name.strip()
    if data.description is not None:
        update_data["description"] = data.description
    if data.color is not None:
        update_data["color"] = data.color
    
    if not update_data:
        raise HTTPException(status_code=400, detail="No data to update")
    
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    result = await db.levels.update_one(
        {"id": level_id},
        {"$set": update_data}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Level not found")
    
    return {"success": True}


# ============ THEMATIC AXES ENDPOINTS ============

@router.get("/thematic-axes")
async def list_thematic_axes(current_user: dict = Depends(get_current_user)):
    """List all thematic axes"""
    axes = await db.thematic_axes.find({}, {"_id": 0}).sort("order", 1).to_list(50)
    return {
        "success": True,
        "thematic_axes": axes,
        "total": len(axes)
    }


@router.get("/thematic-axes/{axis_id}")
async def get_thematic_axis(
    axis_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get a single thematic axis with its competencies"""
    axis = await db.thematic_axes.find_one({"id": axis_id}, {"_id": 0})
    if not axis:
        raise HTTPException(status_code=404, detail="Thematic axis not found")
    
    # Get competencies for this axis
    competencies = await db.competencies.find(
        {"thematic_axis_id": axis_id},
        {"_id": 0}
    ).sort("order", 1).to_list(100)
    
    axis["competencies"] = competencies
    
    return {
        "success": True,
        "thematic_axis": axis
    }


@router.post("/thematic-axes")
async def create_thematic_axis(
    data: ThematicAxisCreate,
    current_user: dict = Depends(get_current_user)
):
    """Create a new thematic axis"""
    slug = data.slug or data.name.lower().replace(" ", "-")
    
    # Check for duplicate slug
    existing = await db.thematic_axes.find_one({"slug": slug})
    if existing:
        raise HTTPException(status_code=400, detail=f"Thematic axis with slug '{slug}' already exists")
    
    axis = {
        "id": str(uuid.uuid4()),
        "name": data.name.strip(),
        "slug": slug,
        "description": data.description,
        "color": data.color,
        "order": data.order,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "created_by": current_user.get("email")
    }
    
    await db.thematic_axes.insert_one(axis)
    
    return {
        "success": True,
        "thematic_axis": {k: v for k, v in axis.items() if k != "_id"}
    }


@router.put("/thematic-axes/{axis_id}")
async def update_thematic_axis(
    axis_id: str,
    data: ThematicAxisUpdate,
    current_user: dict = Depends(get_current_user)
):
    """Update a thematic axis"""
    update_data = {}
    
    if data.name is not None:
        update_data["name"] = data.name.strip()
    if data.slug is not None:
        update_data["slug"] = data.slug
    if data.description is not None:
        update_data["description"] = data.description
    if data.color is not None:
        update_data["color"] = data.color
    if data.order is not None:
        update_data["order"] = data.order
    
    if not update_data:
        raise HTTPException(status_code=400, detail="No data to update")
    
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    result = await db.thematic_axes.update_one(
        {"id": axis_id},
        {"$set": update_data}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Thematic axis not found")
    
    return {"success": True}


@router.delete("/thematic-axes/{axis_id}")
async def delete_thematic_axis(
    axis_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Delete a thematic axis (and optionally its competencies)"""
    # Check if axis has competencies
    competency_count = await db.competencies.count_documents({"thematic_axis_id": axis_id})
    if competency_count > 0:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot delete axis with {competency_count} competencies. Delete competencies first."
        )
    
    result = await db.thematic_axes.delete_one({"id": axis_id})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Thematic axis not found")
    
    return {"success": True}


# ============ COMPETENCIES ENDPOINTS ============

@router.get("/competencies")
async def list_competencies(
    thematic_axis_id: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """List all competencies, optionally filtered by thematic axis"""
    query = {}
    if thematic_axis_id:
        query["thematic_axis_id"] = thematic_axis_id
    
    competencies = await db.competencies.find(query, {"_id": 0}).sort("order", 1).to_list(200)
    
    # Enrich with thematic axis info
    axis_ids = list(set(c.get("thematic_axis_id") for c in competencies if c.get("thematic_axis_id")))
    axes = await db.thematic_axes.find({"id": {"$in": axis_ids}}, {"_id": 0}).to_list(50)
    axis_map = {a["id"]: a for a in axes}
    
    for comp in competencies:
        axis_id = comp.get("thematic_axis_id")
        if axis_id and axis_id in axis_map:
            comp["thematic_axis"] = axis_map[axis_id]
    
    return {
        "success": True,
        "competencies": competencies,
        "total": len(competencies)
    }


@router.post("/competencies")
async def create_competency(
    data: CompetencyCreate,
    current_user: dict = Depends(get_current_user)
):
    """Create a new competency"""
    # Verify thematic axis exists
    axis = await db.thematic_axes.find_one({"id": data.thematic_axis_id})
    if not axis:
        raise HTTPException(status_code=404, detail="Thematic axis not found")
    
    competency = {
        "id": str(uuid.uuid4()),
        "name": data.name.strip(),
        "thematic_axis_id": data.thematic_axis_id,
        "description": data.description,
        "color": data.color,
        "order": data.order,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "created_by": current_user.get("email")
    }
    
    await db.competencies.insert_one(competency)
    
    return {
        "success": True,
        "competency": {k: v for k, v in competency.items() if k != "_id"}
    }


@router.put("/competencies/{competency_id}")
async def update_competency(
    competency_id: str,
    data: CompetencyUpdate,
    current_user: dict = Depends(get_current_user)
):
    """Update a competency"""
    update_data = {}
    
    if data.name is not None:
        update_data["name"] = data.name.strip()
    if data.thematic_axis_id is not None:
        # Verify new axis exists
        axis = await db.thematic_axes.find_one({"id": data.thematic_axis_id})
        if not axis:
            raise HTTPException(status_code=404, detail="Thematic axis not found")
        update_data["thematic_axis_id"] = data.thematic_axis_id
    if data.description is not None:
        update_data["description"] = data.description
    if data.color is not None:
        update_data["color"] = data.color
    if data.order is not None:
        update_data["order"] = data.order
    
    if not update_data:
        raise HTTPException(status_code=400, detail="No data to update")
    
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    result = await db.competencies.update_one(
        {"id": competency_id},
        {"$set": update_data}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Competency not found")
    
    return {"success": True}


@router.delete("/competencies/{competency_id}")
async def delete_competency(
    competency_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Delete a competency"""
    # Check if competency has content items
    content_count = await db.content_items.count_documents({"competency_id": competency_id})
    if content_count > 0:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot delete competency with {content_count} content items. Delete content first."
        )
    
    result = await db.competencies.delete_one({"id": competency_id})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Competency not found")
    
    return {"success": True}


# ============ CONTENT MATRIX ENDPOINT ============

@router.get("/content-matrix")
async def get_content_matrix(current_user: dict = Depends(get_current_user)):
    """
    Get the full content matrix structure:
    - All thematic axes with their competencies
    - All levels
    - Content item counts per cell (competency x level)
    """
    # Get all thematic axes
    axes = await db.thematic_axes.find({}, {"_id": 0}).sort("order", 1).to_list(50)
    
    # Get all competencies
    competencies = await db.competencies.find({}, {"_id": 0}).sort("order", 1).to_list(200)
    
    # Get all levels
    levels = await db.levels.find({}, {"_id": 0}).sort("number", 1).to_list(10)
    
    # If no levels, create defaults
    if not levels:
        await list_levels(current_user)  # This creates defaults
        levels = await db.levels.find({}, {"_id": 0}).sort("number", 1).to_list(10)
    
    # Get content item counts by competency and level
    pipeline = [
        {
            "$group": {
                "_id": {
                    "competency_id": "$competency_id",
                    "level": "$level"
                },
                "count": {"$sum": 1}
            }
        }
    ]
    content_counts = await db.content_items.aggregate(pipeline).to_list(1000)
    
    # Build count map
    count_map = {}
    for item in content_counts:
        key = f"{item['_id']['competency_id']}_{item['_id']['level']}"
        count_map[key] = item["count"]
    
    # Organize competencies by axis
    axis_competencies = {}
    for comp in competencies:
        axis_id = comp.get("thematic_axis_id")
        if axis_id not in axis_competencies:
            axis_competencies[axis_id] = []
        
        # Add content counts for each level
        comp["level_counts"] = {}
        for level in levels:
            key = f"{comp['id']}_{level['number']}"
            comp["level_counts"][level["number"]] = count_map.get(key, 0)
        
        axis_competencies[axis_id].append(comp)
    
    # Build final structure
    for axis in axes:
        axis["competencies"] = axis_competencies.get(axis["id"], [])
        
        # Calculate total content for axis
        axis["total_content"] = sum(
            sum(c.get("level_counts", {}).values())
            for c in axis["competencies"]
        )
    
    return {
        "success": True,
        "thematic_axes": axes,
        "levels": levels,
        "total_axes": len(axes),
        "total_competencies": len(competencies),
        "total_content_items": sum(c["count"] for c in content_counts) if content_counts else 0
    }


# ============ LEGACY COMPETENCIAS (backward compatibility) ============

@router.get("/competencias")
async def list_competencias(current_user: dict = Depends(get_current_user)):
    """List all competencias (legacy endpoint)"""
    competencias = await db.competencias.find({}, {"_id": 0}).sort("name", 1).to_list(100)
    return {
        "success": True,
        "competencias": competencias,
        "total": len(competencias)
    }
