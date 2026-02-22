"""
Write Books Router - Book writing module with Kanban chapters and distraction-free editor
"""
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime, timezone, timedelta
import uuid

from database import db
from routers.auth import get_current_user

router = APIRouter(prefix="/books", tags=["books"])


# ============ MODELS ============

class BookCreate(BaseModel):
    title: str
    subtitle: Optional[str] = None
    description: Optional[str] = None
    genre: Optional[str] = None
    target_word_count: int = 50000


class BookUpdate(BaseModel):
    title: Optional[str] = None
    subtitle: Optional[str] = None
    description: Optional[str] = None
    genre: Optional[str] = None
    target_word_count: Optional[int] = None
    status: Optional[str] = None


class ChapterCreate(BaseModel):
    book_id: Optional[str] = None  # Optional - taken from URL path
    title: str
    description: Optional[str] = None
    order: int = 0
    status: str = "outline"  # outline, draft, review, final


class ChapterUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    content: Optional[str] = None
    order: Optional[int] = None
    status: Optional[str] = None


class ChapterStatusUpdate(BaseModel):
    status: str


# ============ BOOKS CRUD ============

@router.get("/")
async def list_books(current_user: dict = Depends(get_current_user)):
    """List all books"""
    # Try with user id first, then email for backwards compatibility
    user_id = current_user["id"]
    user_email = current_user.get("email", "")
    
    books = await db.books.find(
        {"$or": [{"created_by": user_id}, {"created_by": user_email}]},
        {"_id": 0}
    ).sort("updated_at", -1).to_list(100)
    
    # Get chapter counts and word counts for each book
    for book in books:
        chapters = await db.book_chapters.find(
            {"book_id": book["id"]},
            {"status": 1, "word_count": 1}
        ).to_list(100)
        
        book["chapter_count"] = len(chapters)
        book["word_count"] = sum(c.get("word_count", 0) for c in chapters)
        book["chapters_by_status"] = {}
        for c in chapters:
            status = c.get("status", "outline")
            book["chapters_by_status"][status] = book["chapters_by_status"].get(status, 0) + 1
    
    return {"books": books}


@router.post("/")
async def create_book(
    data: BookCreate,
    current_user: dict = Depends(get_current_user)
):
    """Create a new book"""
    now = datetime.now(timezone.utc).isoformat()
    
    book = {
        "id": str(uuid.uuid4()),
        "title": data.title,
        "subtitle": data.subtitle,
        "description": data.description,
        "genre": data.genre,
        "target_word_count": data.target_word_count,
        "status": "in_progress",  # in_progress, completed, on_hold
        "created_at": now,
        "updated_at": now,
        "created_by": current_user["id"]
    }
    
    await db.books.insert_one(book)
    return {"success": True, "book": {k: v for k, v in book.items() if k != "_id"}}


@router.get("/{book_id}")
async def get_book(
    book_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get book details with chapters"""
    user_id = current_user["id"]
    user_email = current_user.get("email", "")
    
    book = await db.books.find_one(
        {"id": book_id, "$or": [{"created_by": user_id}, {"created_by": user_email}]},
        {"_id": 0}
    )
    if not book:
        raise HTTPException(status_code=404, detail="Book not found")
    
    chapters = await db.book_chapters.find(
        {"book_id": book_id},
        {"_id": 0}
    ).sort("order", 1).to_list(100)
    
    book["chapters"] = chapters
    book["word_count"] = sum(c.get("word_count", 0) for c in chapters)
    
    return book


@router.put("/{book_id}")
async def update_book(
    book_id: str,
    data: BookUpdate,
    current_user: dict = Depends(get_current_user)
):
    """Update book details"""
    update_data = {k: v for k, v in data.dict().items() if v is not None}
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    result = await db.books.update_one(
        {"id": book_id, "created_by": current_user.get("email")},
        {"$set": update_data}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Book not found")
    
    return {"success": True}


@router.delete("/{book_id}")
async def delete_book(
    book_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Delete a book and all its chapters"""
    result = await db.books.delete_one(
        {"id": book_id, "created_by": current_user.get("email")}
    )
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Book not found")
    
    # Delete all chapters
    await db.book_chapters.delete_many({"book_id": book_id})
    
    return {"success": True}


# ============ CHAPTERS CRUD ============

@router.get("/{book_id}/chapters")
async def list_chapters(
    book_id: str,
    current_user: dict = Depends(get_current_user)
):
    """List all chapters of a book"""
    chapters = await db.book_chapters.find(
        {"book_id": book_id},
        {"_id": 0}
    ).sort("order", 1).to_list(100)
    
    return {"chapters": chapters}


@router.post("/{book_id}/chapters")
async def create_chapter(
    book_id: str,
    data: ChapterCreate,
    current_user: dict = Depends(get_current_user)
):
    """Create a new chapter"""
    # Verify book exists - check by id and user id
    book = await db.books.find_one(
        {"id": book_id, "created_by": current_user["id"]}
    )
    if not book:
        # Also try with email for backwards compatibility
        book = await db.books.find_one(
            {"id": book_id, "created_by": current_user.get("email")}
        )
    if not book:
        raise HTTPException(status_code=404, detail="Book not found")
    
    now = datetime.now(timezone.utc).isoformat()
    
    # Get max order
    last_chapter = await db.book_chapters.find_one(
        {"book_id": book_id},
        sort=[("order", -1)]
    )
    next_order = (last_chapter.get("order", 0) + 1) if last_chapter else 1
    
    chapter = {
        "id": str(uuid.uuid4()),
        "book_id": book_id,
        "title": data.title,
        "description": data.description,
        "content": "",
        "order": data.order if data.order > 0 else next_order,
        "status": data.status,
        "word_count": 0,
        "created_at": now,
        "updated_at": now
    }
    
    await db.book_chapters.insert_one(chapter)
    
    # Update book timestamp
    await db.books.update_one(
        {"id": book_id},
        {"$set": {"updated_at": now}}
    )
    
    return {"success": True, "chapter": {k: v for k, v in chapter.items() if k != "_id"}}


@router.get("/chapters/{chapter_id}")
async def get_chapter(
    chapter_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get chapter details including content"""
    chapter = await db.book_chapters.find_one(
        {"id": chapter_id},
        {"_id": 0}
    )
    if not chapter:
        raise HTTPException(status_code=404, detail="Chapter not found")
    
    return chapter


@router.put("/chapters/{chapter_id}")
async def update_chapter(
    chapter_id: str,
    data: ChapterUpdate,
    current_user: dict = Depends(get_current_user)
):
    """Update chapter details"""
    now = datetime.now(timezone.utc).isoformat()
    
    update_data = {k: v for k, v in data.dict().items() if v is not None}
    update_data["updated_at"] = now
    
    # Calculate word count if content is updated
    if "content" in update_data:
        content = update_data["content"]
        update_data["word_count"] = len(content.split()) if content else 0
    
    result = await db.book_chapters.update_one(
        {"id": chapter_id},
        {"$set": update_data}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Chapter not found")
    
    # Get book_id and update book timestamp
    chapter = await db.book_chapters.find_one({"id": chapter_id})
    if chapter:
        await db.books.update_one(
            {"id": chapter["book_id"]},
            {"$set": {"updated_at": now}}
        )
    
    return {"success": True}


@router.put("/chapters/{chapter_id}/status")
async def update_chapter_status(
    chapter_id: str,
    data: ChapterStatusUpdate,
    current_user: dict = Depends(get_current_user)
):
    """Update chapter status (for Kanban drag-drop)"""
    now = datetime.now(timezone.utc).isoformat()
    
    result = await db.book_chapters.update_one(
        {"id": chapter_id},
        {"$set": {"status": data.status, "updated_at": now}}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Chapter not found")
    
    return {"success": True}


@router.delete("/chapters/{chapter_id}")
async def delete_chapter(
    chapter_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Delete a chapter"""
    chapter = await db.book_chapters.find_one({"id": chapter_id})
    if not chapter:
        raise HTTPException(status_code=404, detail="Chapter not found")
    
    await db.book_chapters.delete_one({"id": chapter_id})
    
    # Update book timestamp
    await db.books.update_one(
        {"id": chapter["book_id"]},
        {"$set": {"updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    return {"success": True}


# ============ WRITING STATS ============

@router.get("/stats/overview")
async def get_writing_stats(current_user: dict = Depends(get_current_user)):
    """Get overall writing statistics"""
    email = current_user.get("email")
    
    # Total books
    total_books = await db.books.count_documents({"created_by": email})
    
    # Books by status
    pipeline = [
        {"$match": {"created_by": email}},
        {"$group": {"_id": "$status", "count": {"$sum": 1}}}
    ]
    status_counts = await db.books.aggregate(pipeline).to_list(10)
    by_status = {s["_id"]: s["count"] for s in status_counts}
    
    # Total chapters and words
    books = await db.books.find({"created_by": email}, {"id": 1}).to_list(100)
    book_ids = [b["id"] for b in books]
    
    chapters = await db.book_chapters.find(
        {"book_id": {"$in": book_ids}},
        {"word_count": 1, "status": 1}
    ).to_list(1000)
    
    total_chapters = len(chapters)
    total_words = sum(c.get("word_count", 0) for c in chapters)
    
    chapters_by_status = {}
    for c in chapters:
        status = c.get("status", "outline")
        chapters_by_status[status] = chapters_by_status.get(status, 0) + 1
    
    return {
        "total_books": total_books,
        "books_by_status": by_status,
        "total_chapters": total_chapters,
        "chapters_by_status": chapters_by_status,
        "total_words": total_words
    }
