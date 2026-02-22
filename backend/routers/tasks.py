"""
Tasks Router - Task management with Gmail starred emails integration
"""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime, timezone
from bson import ObjectId
import uuid
import re

from database import db
from routers.auth import get_current_user
from routers.calendar import get_settings, refresh_credentials_if_needed, CALENDAR_SCOPES

# Gmail service helper - kept for Gmail read functionality (starred emails sync)
async def get_gmail_service_for_read():
    """Get authenticated Gmail service for reading emails"""
    from google.oauth2.credentials import Credentials
    from googleapiclient.discovery import build
    from config import GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET
    
    settings = await get_settings()
    gmail_connected = settings.get("gmail_connected") or settings.get("calendar_connected")
    if not gmail_connected:
        raise HTTPException(status_code=400, detail="Gmail not connected")
    
    credentials_data = settings.get("gmail_credentials") or settings.get("calendar_credentials", {})
    if not credentials_data:
        raise HTTPException(status_code=400, detail="Google credentials not found")
    
    credentials_data = refresh_credentials_if_needed(credentials_data)
    
    credentials = Credentials(
        token=credentials_data.get("token"),
        refresh_token=credentials_data.get("refresh_token"),
        token_uri=credentials_data.get("token_uri", "https://oauth2.googleapis.com/token"),
        client_id=credentials_data.get("client_id", GOOGLE_CLIENT_ID),
        client_secret=credentials_data.get("client_secret", GOOGLE_CLIENT_SECRET),
        scopes=credentials_data.get("scopes", CALENDAR_SCOPES)
    )
    
    return build('gmail', 'v1', credentials=credentials)

router = APIRouter(prefix="/tasks", tags=["tasks"])


# ============ MODELS ============

class TaskCreate(BaseModel):
    title: str
    description: Optional[str] = None
    contact_id: Optional[str] = None
    due_date: Optional[str] = None
    priority: str = "medium"  # low, medium, high
    source: str = "manual"  # manual, gmail_starred
    gmail_message_id: Optional[str] = None
    gmail_thread_id: Optional[str] = None
    gmail_link: Optional[str] = None


class TaskUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    contact_id: Optional[str] = None
    due_date: Optional[str] = None
    priority: Optional[str] = None
    is_completed: Optional[bool] = None
    notes: Optional[str] = None


# ============ HELPER FUNCTIONS ============

def serialize_task(task: dict) -> dict:
    """Convert MongoDB task document to JSON-safe dict"""
    if not task:
        return None
    task["_id"] = str(task["_id"]) if "_id" in task else None
    return task


async def get_contact_by_email(email: str) -> Optional[dict]:
    """Find a contact by email address"""
    if not email:
        return None
    
    # Search in email field
    contact = await db.unified_contacts.find_one(
        {"email": {"$regex": f"^{email}$", "$options": "i"}},
        {"_id": 0}
    )
    if contact:
        return contact
    
    # Search in emails array
    contact = await db.unified_contacts.find_one(
        {"emails.email": {"$regex": f"^{email}$", "$options": "i"}},
        {"_id": 0}
    )
    return contact


async def create_contact_from_email(email: str, name: str = None) -> dict:
    """Create a new contact from email address"""
    contact_id = str(uuid.uuid4())
    
    # Try to parse name from email if not provided
    if not name:
        name_part = email.split("@")[0]
        # Convert "john.doe" or "john_doe" to "John Doe"
        name = " ".join(word.capitalize() for word in name_part.replace(".", " ").replace("_", " ").split())
    
    contact = {
        "id": contact_id,
        "email": email,
        "emails": [{"email": email, "is_primary": True}],
        "name": name,
        "first_name": name.split()[0] if name else "",
        "last_name": " ".join(name.split()[1:]) if name and len(name.split()) > 1 else "",
        "stage": 1,
        "qualification_status": "pending",
        "source": "gmail_task",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.unified_contacts.insert_one(contact)
    return contact


# ============ CRUD ENDPOINTS ============

@router.get("/")
async def get_tasks(
    status: Optional[str] = None,  # all, pending, completed
    contact_id: Optional[str] = None,
    priority: Optional[str] = None,
    limit: int = 100,
    current_user: dict = Depends(get_current_user)
):
    """Get all tasks with optional filters"""
    query = {}
    
    if status == "pending":
        query["is_completed"] = False
    elif status == "completed":
        query["is_completed"] = True
    
    if contact_id:
        query["contact_id"] = contact_id
    
    if priority:
        query["priority"] = priority
    
    tasks_cursor = db.tasks.find(query).sort([
        ("is_completed", 1),  # Pending first
        ("due_date", 1),  # Earliest due date first
        ("priority_order", -1),  # High priority first
        ("created_at", -1)  # Newest first
    ]).limit(limit)
    
    tasks = await tasks_cursor.to_list(limit)
    
    # Enrich with contact info
    result = []
    for task in tasks:
        task_data = serialize_task(task)
        
        # Get contact info if associated
        if task.get("contact_id"):
            contact = await db.unified_contacts.find_one(
                {"id": task["contact_id"]},
                {"_id": 0, "id": 1, "name": 1, "email": 1, "company": 1}
            )
            task_data["contact"] = contact
        
        result.append(task_data)
    
    # Get counts
    total = await db.tasks.count_documents({})
    pending = await db.tasks.count_documents({"is_completed": False})
    completed = await db.tasks.count_documents({"is_completed": True})
    overdue = await db.tasks.count_documents({
        "is_completed": False,
        "due_date": {"$lt": datetime.now(timezone.utc).isoformat()}
    })
    
    return {
        "tasks": result,
        "stats": {
            "total": total,
            "pending": pending,
            "completed": completed,
            "overdue": overdue
        }
    }


@router.get("/by-contact/{contact_id}")
async def get_tasks_by_contact(
    contact_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get all tasks for a specific contact"""
    tasks_cursor = db.tasks.find({"contact_id": contact_id}).sort([
        ("is_completed", 1),
        ("due_date", 1),
        ("created_at", -1)
    ])
    
    tasks = await tasks_cursor.to_list(100)
    
    pending = [serialize_task(t) for t in tasks if not t.get("is_completed")]
    completed = [serialize_task(t) for t in tasks if t.get("is_completed")]
    
    return {
        "pending": pending,
        "completed": completed,
        "total": len(tasks)
    }


@router.post("/")
async def create_task(
    task: TaskCreate,
    current_user: dict = Depends(get_current_user)
):
    """Create a new task"""
    task_id = str(uuid.uuid4())
    
    # Calculate priority order for sorting
    priority_map = {"high": 3, "medium": 2, "low": 1}
    
    task_doc = {
        "id": task_id,
        "title": task.title,
        "description": task.description,
        "contact_id": task.contact_id,
        "due_date": task.due_date,
        "priority": task.priority,
        "priority_order": priority_map.get(task.priority, 2),
        "source": task.source,
        "gmail_message_id": task.gmail_message_id,
        "gmail_thread_id": task.gmail_thread_id,
        "gmail_link": task.gmail_link,
        "is_completed": False,
        "completed_at": None,
        "notes": None,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "created_by": current_user.get("email")
    }
    
    await db.tasks.insert_one(task_doc)
    
    return {
        "success": True,
        "task": serialize_task(task_doc)
    }


@router.put("/{task_id}")
async def update_task(
    task_id: str,
    update: TaskUpdate,
    current_user: dict = Depends(get_current_user)
):
    """Update a task"""
    update_data = {k: v for k, v in update.dict().items() if v is not None}
    
    if not update_data:
        raise HTTPException(status_code=400, detail="No data to update")
    
    # Update priority order if priority changed
    if "priority" in update_data:
        priority_map = {"high": 3, "medium": 2, "low": 1}
        update_data["priority_order"] = priority_map.get(update_data["priority"], 2)
    
    # Set completed_at if completing
    if update_data.get("is_completed") is True:
        update_data["completed_at"] = datetime.now(timezone.utc).isoformat()
    elif update_data.get("is_completed") is False:
        update_data["completed_at"] = None
    
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    result = await db.tasks.update_one(
        {"id": task_id},
        {"$set": update_data}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Task not found")
    
    # Get updated task
    task = await db.tasks.find_one({"id": task_id})
    
    return {
        "success": True,
        "task": serialize_task(task)
    }


@router.delete("/{task_id}")
async def delete_task(
    task_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Delete a task"""
    result = await db.tasks.delete_one({"id": task_id})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Task not found")
    
    return {"success": True}


@router.post("/{task_id}/toggle-complete")
async def toggle_task_complete(
    task_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Toggle task completion status"""
    task = await db.tasks.find_one({"id": task_id})
    
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    new_status = not task.get("is_completed", False)
    
    update_data = {
        "is_completed": new_status,
        "completed_at": datetime.now(timezone.utc).isoformat() if new_status else None,
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.tasks.update_one({"id": task_id}, {"$set": update_data})
    
    return {
        "success": True,
        "is_completed": new_status
    }


# ============ GMAIL INTEGRATION ============

@router.post("/sync-starred-emails")
async def sync_starred_emails(
    current_user: dict = Depends(get_current_user)
):
    """
    Sync starred emails from Gmail and create tasks.
    Only processes emails from the last 7 days.
    """
    try:
        service = await get_gmail_service_for_read()
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error connecting to Gmail: {str(e)}")
    
    # Search for starred emails from last 7 days
    query = "is:starred newer_than:7d"
    
    try:
        results = service.users().messages().list(
            userId="me",
            q=query,
            maxResults=50
        ).execute()
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error fetching emails: {str(e)}")
    
    messages = results.get("messages", [])
    
    created_tasks = []
    skipped_existing = 0
    
    for msg_ref in messages:
        message_id = msg_ref["id"]
        
        # Check if task already exists for this email
        existing = await db.tasks.find_one({"gmail_message_id": message_id})
        if existing:
            skipped_existing += 1
            continue
        
        # Get full message details
        try:
            message = service.users().messages().get(
                userId="me",
                id=message_id,
                format="metadata",
                metadataHeaders=["From", "To", "Subject", "Date"]
            ).execute()
        except Exception as e:
            print(f"Error fetching message {message_id}: {e}")
            continue
        
        # Parse headers
        headers = {h["name"]: h["value"] for h in message.get("payload", {}).get("headers", [])}
        
        subject = headers.get("Subject", "Sin asunto")
        from_header = headers.get("From", "")
        to_header = headers.get("To", "")
        thread_id = message.get("threadId", "")
        
        # Parse email addresses
        def extract_email(header):
            match = re.search(r'[\w\.-]+@[\w\.-]+', header)
            return match.group(0).lower() if match else None
        
        def extract_name(header):
            # Try to get name before <email>
            match = re.match(r'^([^<]+)<', header)
            if match:
                return match.group(1).strip().strip('"')
            return None
        
        from_email = extract_email(from_header)
        from_name = extract_name(from_header)
        to_email = extract_email(to_header)
        to_name = extract_name(to_header)
        
        # Determine which email to associate with contact
        # If I sent the email, associate with recipient
        # If I received the email, associate with sender
        user_email = current_user.get("email", "").lower()
        
        if from_email and from_email.lower() == user_email:
            # I sent this email - associate with recipient
            target_email = to_email
            target_name = to_name
        else:
            # I received this email - associate with sender
            target_email = from_email
            target_name = from_name
        
        # Find or create contact
        contact = None
        contact_id = None
        
        if target_email:
            contact = await get_contact_by_email(target_email)
            
            if not contact:
                # Create new contact
                contact = await create_contact_from_email(target_email, target_name)
            
            contact_id = contact.get("id")
        
        # Parse date for due_date (when email was starred - approximated by email date)
        due_date = datetime.now(timezone.utc).isoformat()
        
        # Create Gmail link
        gmail_link = f"https://mail.google.com/mail/u/0/#inbox/{message_id}"
        
        # Create task
        task_id = str(uuid.uuid4())
        task_doc = {
            "id": task_id,
            "title": f"📧 {subject}",
            "description": f"Email de/para: {from_header}",
            "contact_id": contact_id,
            "due_date": due_date,
            "priority": "medium",
            "priority_order": 2,
            "source": "gmail_starred",
            "gmail_message_id": message_id,
            "gmail_thread_id": thread_id,
            "gmail_link": gmail_link,
            "is_completed": False,
            "completed_at": None,
            "notes": None,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat(),
            "created_by": user_email
        }
        
        await db.tasks.insert_one(task_doc)
        created_tasks.append({
            "id": task_id,
            "title": task_doc["title"],
            "contact_name": contact.get("name") if contact else None
        })
    
    return {
        "success": True,
        "created": len(created_tasks),
        "skipped_existing": skipped_existing,
        "total_starred": len(messages),
        "tasks": created_tasks
    }
