"""
Media Relations and Documents API endpoints
"""
from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, Form
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timezone
import uuid
import os
import base64

from .auth import get_current_user
from .legacy import db

router = APIRouter(prefix="/media-contacts", tags=["Media Relations"])

# ============ MEDIA CONTACTS ============

class MediaContactCreate(BaseModel):
    name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    media_outlet: str
    media_type: Optional[str] = "online"  # newspaper, magazine, tv, radio, online, podcast, influencer, other
    role: Optional[str] = None
    linkedin_url: Optional[str] = None
    website: Optional[str] = None
    notes: Optional[str] = None


class MediaContactUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    media_outlet: Optional[str] = None
    media_type: Optional[str] = None
    role: Optional[str] = None
    linkedin_url: Optional[str] = None
    website: Optional[str] = None
    notes: Optional[str] = None


@router.get("")
async def list_media_contacts(
    search: Optional[str] = None,
    media_type: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """List all media contacts with optional filtering"""
    query = {}
    
    if search:
        query["$or"] = [
            {"name": {"$regex": search, "$options": "i"}},
            {"media_outlet": {"$regex": search, "$options": "i"}},
            {"email": {"$regex": search, "$options": "i"}}
        ]
    
    if media_type:
        query["media_type"] = media_type
    
    contacts = await db.media_contacts.find(query, {"_id": 0}).sort("name", 1).to_list(1000)
    
    return {
        "contacts": contacts,
        "total": len(contacts)
    }


@router.post("")
async def create_media_contact(
    contact: MediaContactCreate,
    current_user: dict = Depends(get_current_user)
):
    """Create a new media contact"""
    now = datetime.now(timezone.utc).isoformat()
    
    doc = {
        "id": str(uuid.uuid4()),
        **contact.model_dump(),
        "created_at": now,
        "updated_at": now,
        "created_by": current_user.get("id")
    }
    
    await db.media_contacts.insert_one(doc)
    
    return {"id": doc["id"], "message": "Contact created"}


@router.put("/{contact_id}")
async def update_media_contact(
    contact_id: str,
    contact: MediaContactUpdate,
    current_user: dict = Depends(get_current_user)
):
    """Update a media contact"""
    update_data = {k: v for k, v in contact.model_dump().items() if v is not None}
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    result = await db.media_contacts.update_one(
        {"id": contact_id},
        {"$set": update_data}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Contact not found")
    
    return {"message": "Contact updated"}


@router.delete("/{contact_id}")
async def delete_media_contact(
    contact_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Delete a media contact"""
    result = await db.media_contacts.delete_one({"id": contact_id})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Contact not found")
    
    return {"message": "Contact deleted"}


# ============ DOCUMENTS ============

documents_router = APIRouter(prefix="/documents", tags=["Documents"])

DOCUMENT_CATEGORIES = ["contracts", "proposals", "invoices", "presentations", "reports", "other"]

class DocumentCreate(BaseModel):
    name: str
    category: str = "other"
    description: Optional[str] = None
    tags: Optional[List[str]] = []


@documents_router.get("")
async def list_documents(
    category: Optional[str] = None,
    search: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """List all documents with optional filtering"""
    query = {}
    
    if category and category != "_all":
        query["category"] = category
    
    if search:
        query["$or"] = [
            {"name": {"$regex": search, "$options": "i"}},
            {"description": {"$regex": search, "$options": "i"}}
        ]
    
    documents = await db.documents.find(query, {"_id": 0, "file_content": 0}).sort("created_at", -1).to_list(500)
    
    # Count by category
    all_docs = await db.documents.find({}, {"category": 1}).to_list(5000)
    category_counts = {}
    for doc in all_docs:
        cat = doc.get("category", "other")
        category_counts[cat] = category_counts.get(cat, 0) + 1
    
    return {
        "documents": documents,
        "total": len(documents),
        "category_counts": category_counts
    }


@documents_router.post("/upload")
async def upload_document(
    file: UploadFile = File(...),
    name: str = Form(...),
    category: str = Form("other"),
    description: str = Form(""),
    current_user: dict = Depends(get_current_user)
):
    """Upload a document file"""
    if not file.filename:
        raise HTTPException(status_code=400, detail="No file provided")
    
    # Validate file type
    allowed_extensions = ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.txt', '.csv', '.png', '.jpg', '.jpeg']
    file_ext = os.path.splitext(file.filename)[1].lower()
    if file_ext not in allowed_extensions:
        raise HTTPException(status_code=400, detail=f"File type {file_ext} not allowed")
    
    # Read file content
    content = await file.read()
    
    # Limit file size (10MB)
    if len(content) > 10 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File too large (max 10MB)")
    
    now = datetime.now(timezone.utc).isoformat()
    
    doc = {
        "id": str(uuid.uuid4()),
        "name": name,
        "original_filename": file.filename,
        "category": category if category in DOCUMENT_CATEGORIES else "other",
        "description": description,
        "file_content": base64.b64encode(content).decode('utf-8'),
        "file_size": len(content),
        "file_type": file.content_type,
        "file_extension": file_ext,
        "created_at": now,
        "updated_at": now,
        "created_by": current_user.get("id"),
        "created_by_email": current_user.get("email")
    }
    
    await db.documents.insert_one(doc)
    
    return {
        "id": doc["id"],
        "message": "Document uploaded successfully",
        "name": name,
        "size": len(content)
    }


@documents_router.get("/{document_id}")
async def get_document(
    document_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get document metadata (without file content)"""
    doc = await db.documents.find_one({"id": document_id}, {"_id": 0, "file_content": 0})
    
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    
    return doc


@documents_router.get("/{document_id}/download")
async def download_document(
    document_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Download a document file"""
    doc = await db.documents.find_one({"id": document_id})
    
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    
    # Return base64 content - frontend will decode and download
    return {
        "id": doc["id"],
        "name": doc.get("name"),
        "original_filename": doc.get("original_filename"),
        "file_content": doc.get("file_content"),
        "file_type": doc.get("file_type"),
        "file_extension": doc.get("file_extension")
    }


@documents_router.put("/{document_id}")
async def update_document(
    document_id: str,
    name: Optional[str] = None,
    category: Optional[str] = None,
    description: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Update document metadata"""
    update_data = {"updated_at": datetime.now(timezone.utc).isoformat()}
    
    if name:
        update_data["name"] = name
    if category and category in DOCUMENT_CATEGORIES:
        update_data["category"] = category
    if description is not None:
        update_data["description"] = description
    
    result = await db.documents.update_one(
        {"id": document_id},
        {"$set": update_data}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Document not found")
    
    return {"message": "Document updated"}


@documents_router.delete("/{document_id}")
async def delete_document(
    document_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Delete a document"""
    result = await db.documents.delete_one({"id": document_id})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Document not found")
    
    return {"message": "Document deleted"}


# ============ BOOKLETS & CASES ============

booklets_router = APIRouter(prefix="/booklets", tags=["Booklets & Cases"])

BOOKLET_TYPES = ["booklet", "case_study", "whitepaper", "brochure", "catalog", "other"]

@booklets_router.get("")
async def list_booklets(
    booklet_type: Optional[str] = None,
    search: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """List all booklets and case studies"""
    query = {}
    
    if booklet_type and booklet_type != "_all":
        query["booklet_type"] = booklet_type
    
    if search:
        query["$or"] = [
            {"name": {"$regex": search, "$options": "i"}},
            {"description": {"$regex": search, "$options": "i"}}
        ]
    
    booklets = await db.booklets.find(query, {"_id": 0, "file_content": 0}).sort("created_at", -1).to_list(500)
    
    return {
        "booklets": booklets,
        "total": len(booklets)
    }


@booklets_router.post("/upload")
async def upload_booklet(
    file: UploadFile = File(...),
    name: str = Form(...),
    booklet_type: str = Form("booklet"),
    description: str = Form(""),
    current_user: dict = Depends(get_current_user)
):
    """Upload a booklet or case study PDF"""
    if not file.filename:
        raise HTTPException(status_code=400, detail="No file provided")
    
    # Only allow PDF for booklets
    file_ext = os.path.splitext(file.filename)[1].lower()
    if file_ext != '.pdf':
        raise HTTPException(status_code=400, detail="Only PDF files are allowed for booklets")
    
    content = await file.read()
    
    if len(content) > 20 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File too large (max 20MB)")
    
    now = datetime.now(timezone.utc).isoformat()
    
    doc = {
        "id": str(uuid.uuid4()),
        "name": name,
        "original_filename": file.filename,
        "booklet_type": booklet_type if booklet_type in BOOKLET_TYPES else "other",
        "description": description,
        "file_content": base64.b64encode(content).decode('utf-8'),
        "file_size": len(content),
        "created_at": now,
        "updated_at": now,
        "created_by": current_user.get("id")
    }
    
    await db.booklets.insert_one(doc)
    
    return {
        "id": doc["id"],
        "message": "Booklet uploaded successfully"
    }


@booklets_router.get("/{booklet_id}/download")
async def download_booklet(
    booklet_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Download a booklet PDF"""
    doc = await db.booklets.find_one({"id": booklet_id})
    
    if not doc:
        raise HTTPException(status_code=404, detail="Booklet not found")
    
    return {
        "id": doc["id"],
        "name": doc.get("name"),
        "original_filename": doc.get("original_filename"),
        "file_content": doc.get("file_content")
    }


@booklets_router.delete("/{booklet_id}")
async def delete_booklet(
    booklet_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Delete a booklet"""
    result = await db.booklets.delete_one({"id": booklet_id})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Booklet not found")
    
    return {"message": "Booklet deleted"}
