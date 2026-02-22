"""
Development Kanban Router
Manages feature development tracking with stages:
- Por desarrollar (To Do)
- En desarrollo (In Progress)
- Por aprobar (Review)
- Aprobado (Done)
"""
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime, timezone
import uuid

from database import db
from routers.auth import get_current_user

router = APIRouter(prefix="/dev-kanban", tags=["dev-kanban"])


# ============ MODELS ============

class KanbanTaskCreate(BaseModel):
    title: str
    description: str
    category: str  # bug, feature, improvement, refactor
    module: Optional[str] = None  # e.g., "1.1.1", "2.2.6.1", "mensajes-hoy"
    priority: str = "medium"  # low, medium, high, critical
    details: Optional[str] = None  # Extra implementation details
    estimated_credits: Optional[str] = None  # AI credits estimate


class KanbanTaskUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    category: Optional[str] = None
    module: Optional[str] = None
    priority: Optional[str] = None
    stage: Optional[str] = None
    details: Optional[str] = None
    estimated_credits: Optional[str] = None


VALID_STAGES = ["por_desarrollar", "en_desarrollo", "por_aprobar", "aprobado"]
VALID_CATEGORIES = ["bug", "feature", "improvement", "refactor"]
VALID_PRIORITIES = ["low", "medium", "high", "critical"]


# ============ ENDPOINTS ============

# ============ AGENT ENDPOINTS (NO AUTH - FOR DEVELOPMENT) ============

@router.post("/agent/tasks")
async def agent_create_task(data: KanbanTaskCreate):
    """Create task without auth - for agent use only"""
    if data.category not in VALID_CATEGORIES:
        raise HTTPException(status_code=400, detail=f"Invalid category")
    if data.priority not in VALID_PRIORITIES:
        raise HTTPException(status_code=400, detail=f"Invalid priority")
    
    priority_order = {"critical": 0, "high": 1, "medium": 2, "low": 3}
    
    task = {
        "id": str(uuid.uuid4()),
        "title": data.title.strip(),
        "description": data.description.strip(),
        "category": data.category,
        "module": data.module,
        "priority": data.priority,
        "priority_order": priority_order.get(data.priority, 2),
        "stage": "por_desarrollar",
        "details": data.details,
        "estimated_credits": data.estimated_credits,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "created_by": "agent",
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "history": []
    }
    
    await db.dev_kanban_tasks.insert_one(task)
    return {"success": True, "task": {k: v for k, v in task.items() if k != "_id"}}


@router.get("/agent/tasks")
async def agent_get_tasks():
    """Get all tasks without auth - for agent use only"""
    tasks = await db.dev_kanban_tasks.find({}, {"_id": 0}).sort("priority_order", 1).to_list(500)
    return {"tasks": tasks, "total": len(tasks)}


@router.put("/agent/tasks/{task_id}/stage")
async def agent_update_stage(task_id: str, stage: str):
    """Update task stage without auth - for agent use only"""
    if stage not in VALID_STAGES:
        raise HTTPException(status_code=400, detail=f"Invalid stage")
    
    result = await db.dev_kanban_tasks.update_one(
        {"id": task_id},
        {"$set": {"stage": stage, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Task not found")
    
    return {"success": True}


@router.delete("/agent/tasks/{task_id}")
async def agent_delete_task(task_id: str):
    """Delete task without auth - for agent use only"""
    result = await db.dev_kanban_tasks.delete_one({"id": task_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Task not found")
    return {"success": True}



@router.get("/tasks")
async def list_kanban_tasks(
    stage: Optional[str] = None,
    category: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """List all kanban tasks, optionally filtered by stage or category"""
    query = {}
    if stage:
        query["stage"] = stage
    if category:
        query["category"] = category
    
    tasks = await db.dev_kanban_tasks.find(
        query,
        {"_id": 0}
    ).sort([("priority_order", 1), ("created_at", -1)]).to_list(500)
    
    # Group by stage for kanban view
    grouped = {
        "por_desarrollar": [],
        "en_desarrollo": [],
        "por_aprobar": [],
        "aprobado": []
    }
    
    for task in tasks:
        stage = task.get("stage", "por_desarrollar")
        if stage in grouped:
            grouped[stage].append(task)
    
    # Get counts
    counts = {
        "por_desarrollar": len(grouped["por_desarrollar"]),
        "en_desarrollo": len(grouped["en_desarrollo"]),
        "por_aprobar": len(grouped["por_aprobar"]),
        "aprobado": len(grouped["aprobado"]),
        "total": len(tasks)
    }
    
    return {
        "tasks": tasks,
        "grouped": grouped,
        "counts": counts
    }


@router.post("/tasks")
async def create_kanban_task(
    data: KanbanTaskCreate,
    current_user: dict = Depends(get_current_user)
):
    """Create a new kanban task"""
    # Validate category
    if data.category not in VALID_CATEGORIES:
        raise HTTPException(status_code=400, detail=f"Invalid category. Must be one of: {VALID_CATEGORIES}")
    
    # Validate priority
    if data.priority not in VALID_PRIORITIES:
        raise HTTPException(status_code=400, detail=f"Invalid priority. Must be one of: {VALID_PRIORITIES}")
    
    # Priority order for sorting
    priority_order = {"critical": 0, "high": 1, "medium": 2, "low": 3}
    
    task = {
        "id": str(uuid.uuid4()),
        "title": data.title.strip(),
        "description": data.description.strip(),
        "category": data.category,
        "module": data.module,
        "priority": data.priority,
        "priority_order": priority_order.get(data.priority, 2),
        "stage": "por_desarrollar",
        "details": data.details,
        "estimated_credits": data.estimated_credits,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "created_by": current_user["id"],
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "history": [{
            "action": "created",
            "stage": "por_desarrollar",
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "by": current_user["id"]
        }]
    }
    
    await db.dev_kanban_tasks.insert_one(task)
    
    return {
        "success": True,
        "task": {k: v for k, v in task.items() if k != "_id"}
    }


@router.put("/tasks/{task_id}")
async def update_kanban_task(
    task_id: str,
    data: KanbanTaskUpdate,
    current_user: dict = Depends(get_current_user)
):
    """Update a kanban task"""
    # Get existing task
    existing = await db.dev_kanban_tasks.find_one({"id": task_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Task not found")
    
    update_data = {}
    history_entry = None
    
    # Build update data
    if data.title is not None:
        update_data["title"] = data.title.strip()
    if data.description is not None:
        update_data["description"] = data.description.strip()
    if data.category is not None:
        if data.category not in VALID_CATEGORIES:
            raise HTTPException(status_code=400, detail=f"Invalid category")
        update_data["category"] = data.category
    if data.module is not None:
        update_data["module"] = data.module
    if data.priority is not None:
        if data.priority not in VALID_PRIORITIES:
            raise HTTPException(status_code=400, detail=f"Invalid priority")
        update_data["priority"] = data.priority
        priority_order = {"critical": 0, "high": 1, "medium": 2, "low": 3}
        update_data["priority_order"] = priority_order.get(data.priority, 2)
    if data.stage is not None:
        if data.stage not in VALID_STAGES:
            raise HTTPException(status_code=400, detail=f"Invalid stage")
        update_data["stage"] = data.stage
        history_entry = {
            "action": "stage_changed",
            "from_stage": existing.get("stage"),
            "to_stage": data.stage,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "by": current_user["id"]
        }
    if data.details is not None:
        update_data["details"] = data.details
    if data.estimated_credits is not None:
        update_data["estimated_credits"] = data.estimated_credits
    
    if not update_data:
        raise HTTPException(status_code=400, detail="No update data provided")
    
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    # Build update operation
    update_op = {"$set": update_data}
    if history_entry:
        update_op["$push"] = {"history": history_entry}
    
    await db.dev_kanban_tasks.update_one(
        {"id": task_id},
        update_op
    )
    
    return {"success": True, "updated": True}


@router.post("/tasks/{task_id}/move")
async def move_task_stage(
    task_id: str,
    new_stage: str,
    current_user: dict = Depends(get_current_user)
):
    """Move a task to a different stage"""
    if new_stage not in VALID_STAGES:
        raise HTTPException(status_code=400, detail=f"Invalid stage. Must be one of: {VALID_STAGES}")
    
    existing = await db.dev_kanban_tasks.find_one({"id": task_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Task not found")
    
    old_stage = existing.get("stage", "por_desarrollar")
    
    await db.dev_kanban_tasks.update_one(
        {"id": task_id},
        {
            "$set": {
                "stage": new_stage,
                "updated_at": datetime.now(timezone.utc).isoformat()
            },
            "$push": {
                "history": {
                    "action": "stage_changed",
                    "from_stage": old_stage,
                    "to_stage": new_stage,
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                    "by": current_user["id"]
                }
            }
        }
    )
    
    return {
        "success": True,
        "moved": True,
        "from_stage": old_stage,
        "to_stage": new_stage
    }


@router.delete("/tasks/{task_id}")
async def delete_kanban_task(
    task_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Delete a kanban task"""
    result = await db.dev_kanban_tasks.delete_one({"id": task_id})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Task not found")
    
    return {"success": True, "deleted": True}


@router.post("/bulk-create")
async def bulk_create_tasks(
    tasks: List[KanbanTaskCreate],
    current_user: dict = Depends(get_current_user)
):
    """Bulk create multiple kanban tasks"""
    priority_order = {"critical": 0, "high": 1, "medium": 2, "low": 3}
    now = datetime.now(timezone.utc).isoformat()
    
    task_docs = []
    for data in tasks:
        task = {
            "id": str(uuid.uuid4()),
            "title": data.title.strip(),
            "description": data.description.strip(),
            "category": data.category if data.category in VALID_CATEGORIES else "feature",
            "module": data.module,
            "priority": data.priority if data.priority in VALID_PRIORITIES else "medium",
            "priority_order": priority_order.get(data.priority, 2),
            "stage": "por_desarrollar",
            "details": data.details,
            "estimated_credits": data.estimated_credits,
            "created_at": now,
            "created_by": current_user["id"],
            "updated_at": now,
            "history": [{
                "action": "created",
                "stage": "por_desarrollar",
                "timestamp": now,
                "by": current_user["id"]
            }]
        }
        task_docs.append(task)
    
    if task_docs:
        await db.dev_kanban_tasks.insert_many(task_docs)
    
    return {
        "success": True,
        "created": len(task_docs)
    }


@router.get("/export")
async def export_kanban_for_fork(
    current_user: dict = Depends(get_current_user)
):
    """
    Export all kanban tasks in a format suitable for handoff summary.
    This ensures nothing is lost during forking.
    """
    tasks = await db.dev_kanban_tasks.find(
        {"stage": {"$ne": "aprobado"}},  # Exclude completed tasks
        {"_id": 0}
    ).sort([("priority_order", 1), ("created_at", -1)]).to_list(500)
    
    # Format for handoff
    export_text = "## Development Kanban Tasks\n\n"
    
    for stage_key, stage_name in [
        ("en_desarrollo", "🔴 En Desarrollo"),
        ("por_aprobar", "🟡 Por Aprobar"),
        ("por_desarrollar", "🟢 Por Desarrollar")
    ]:
        stage_tasks = [t for t in tasks if t.get("stage") == stage_key]
        if stage_tasks:
            export_text += f"### {stage_name}\n"
            for t in stage_tasks:
                priority_emoji = {"critical": "🔥", "high": "❗", "medium": "➖", "low": "⬇️"}.get(t.get("priority"), "➖")
                export_text += f"- {priority_emoji} **[{t.get('category', 'feature').upper()}]** {t.get('title')}\n"
                export_text += f"  - Module: {t.get('module', 'N/A')}\n"
                export_text += f"  - Description: {t.get('description', '')[:200]}\n"
                if t.get('details'):
                    export_text += f"  - Details: {t.get('details')[:300]}\n"
                export_text += "\n"
    
    return {
        "export_text": export_text,
        "tasks": tasks,
        "count": len(tasks)
    }
