from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime, timezone
from bson import ObjectId
import uuid

router = APIRouter(prefix="/blog", tags=["Blog"])

from database import db

# ============ MODELS ============

class PostCreate(BaseModel):
    title: str
    slug: Optional[str] = ""
    excerpt: Optional[str] = ""
    content: str
    featured_image: Optional[str] = ""
    category_id: Optional[str] = ""
    category_name: Optional[str] = ""
    tags: List[str] = []
    author_name: Optional[str] = ""
    is_published: bool = False
    publish_date: Optional[str] = None  # ISO date string
    reading_time_minutes: Optional[int] = 0

class PostUpdate(BaseModel):
    title: Optional[str] = None
    slug: Optional[str] = None
    excerpt: Optional[str] = None
    content: Optional[str] = None
    featured_image: Optional[str] = None
    category_id: Optional[str] = None
    category_name: Optional[str] = None
    tags: Optional[List[str]] = None
    author_name: Optional[str] = None
    is_published: Optional[bool] = None
    publish_date: Optional[str] = None
    reading_time_minutes: Optional[int] = None

class CategoryCreate(BaseModel):
    name: str
    slug: Optional[str] = ""
    description: Optional[str] = ""

# ============ HELPERS ============

def serialize_doc(doc):
    if doc is None:
        return None
    doc["id"] = str(doc.pop("_id", ""))
    return doc

def generate_slug(title: str) -> str:
    """Generate URL-friendly slug from title"""
    import re
    slug = title.lower()
    slug = re.sub(r'[^a-z0-9\s-]', '', slug)
    slug = re.sub(r'[\s_]+', '-', slug)
    slug = re.sub(r'-+', '-', slug)
    return slug.strip('-')

def estimate_reading_time(content: str) -> int:
    """Estimate reading time in minutes (200 words/min)"""
    words = len(content.split())
    return max(1, round(words / 200))

# ============ CATEGORY ENDPOINTS ============

@router.get("/categories")
async def get_categories():
    """Get all blog categories"""
    categories = await db.blog_categories.find().sort("name", 1).to_list(100)
    return {"categories": [serialize_doc(c) for c in categories]}

@router.post("/categories")
async def create_category(data: CategoryCreate):
    """Create a new category"""
    slug = data.slug or generate_slug(data.name)
    
    # Check if slug exists
    existing = await db.blog_categories.find_one({"slug": slug})
    if existing:
        raise HTTPException(status_code=400, detail="Category slug already exists")
    
    cat_doc = {
        "id": str(uuid.uuid4()),
        "name": data.name,
        "slug": slug,
        "description": data.description,
        "created_at": datetime.now(timezone.utc)
    }
    
    await db.blog_categories.insert_one(cat_doc)
    del cat_doc["_id"]
    return {"success": True, "category": cat_doc}

@router.delete("/categories/{category_id}")
async def delete_category(category_id: str):
    """Delete a category"""
    query = {"_id": ObjectId(category_id)} if ObjectId.is_valid(category_id) else {"id": category_id}
    result = await db.blog_categories.delete_one(query)
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Category not found")
    return {"success": True}

# ============ POST ENDPOINTS ============

@router.get("/posts")
async def get_posts(
    category_id: Optional[str] = None,
    tag: Optional[str] = None,
    is_published: Optional[bool] = None,
    search: Optional[str] = None
):
    """Get all blog posts with filters"""
    query = {}
    
    if category_id:
        query["category_id"] = category_id
    if tag:
        query["tags"] = tag
    if is_published is not None:
        query["is_published"] = is_published
    
    posts = await db.blog_posts.find(query).sort("created_at", -1).to_list(100)
    
    # Client-side search
    if search:
        search_lower = search.lower()
        posts = [p for p in posts if 
                 search_lower in p.get("title", "").lower() or
                 search_lower in p.get("excerpt", "").lower()]
    
    # Stats
    all_posts = await db.blog_posts.find().to_list(500)
    stats = {
        "total": len(all_posts),
        "published": len([p for p in all_posts if p.get("is_published")]),
        "drafts": len([p for p in all_posts if not p.get("is_published")])
    }
    
    return {
        "success": True,
        "posts": [serialize_doc(p) for p in posts],
        "stats": stats
    }

@router.get("/posts/{post_id}")
async def get_post(post_id: str):
    """Get single post by ID or slug"""
    post = None
    if ObjectId.is_valid(post_id):
        post = await db.blog_posts.find_one({"_id": ObjectId(post_id)})
    if not post:
        post = await db.blog_posts.find_one({"id": post_id})
    if not post:
        post = await db.blog_posts.find_one({"slug": post_id})
    
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    
    return {"success": True, "post": serialize_doc(post)}

@router.post("/posts")
async def create_post(data: PostCreate):
    """Create a new blog post"""
    slug = data.slug or generate_slug(data.title)
    
    # Ensure unique slug
    existing = await db.blog_posts.find_one({"slug": slug})
    if existing:
        slug = f"{slug}-{str(uuid.uuid4())[:8]}"
    
    # Auto-calculate reading time if not provided
    reading_time = data.reading_time_minutes or estimate_reading_time(data.content)
    
    post_doc = {
        "id": str(uuid.uuid4()),
        "title": data.title,
        "slug": slug,
        "excerpt": data.excerpt or data.content[:200] + "..." if len(data.content) > 200 else data.content,
        "content": data.content,
        "featured_image": data.featured_image,
        "category_id": data.category_id,
        "category_name": data.category_name,
        "tags": data.tags,
        "author_name": data.author_name,
        "is_published": data.is_published,
        "publish_date": data.publish_date,
        "reading_time_minutes": reading_time,
        "views": 0,
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc)
    }
    
    result = await db.blog_posts.insert_one(post_doc)
    post_doc["id"] = str(result.inserted_id)
    del post_doc["_id"]
    
    return {"success": True, "post": post_doc}

@router.put("/posts/{post_id}")
async def update_post(post_id: str, data: PostUpdate):
    """Update a blog post"""
    update_data = {k: v for k, v in data.dict().items() if v is not None}
    update_data["updated_at"] = datetime.now(timezone.utc)
    
    # Recalculate reading time if content changed
    if "content" in update_data:
        update_data["reading_time_minutes"] = estimate_reading_time(update_data["content"])
    
    query = {"_id": ObjectId(post_id)} if ObjectId.is_valid(post_id) else {"id": post_id}
    result = await db.blog_posts.find_one_and_update(
        query,
        {"$set": update_data},
        return_document=True
    )
    
    if not result:
        raise HTTPException(status_code=404, detail="Post not found")
    
    return {"success": True, "post": serialize_doc(result)}

@router.delete("/posts/{post_id}")
async def delete_post(post_id: str):
    """Delete a blog post"""
    query = {"_id": ObjectId(post_id)} if ObjectId.is_valid(post_id) else {"id": post_id}
    result = await db.blog_posts.delete_one(query)
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Post not found")
    
    return {"success": True}

# ============ PUBLIC ENDPOINTS ============

@router.get("/public/posts")
async def get_public_posts(
    category: Optional[str] = None,
    tag: Optional[str] = None,
    program: Optional[str] = None,
    competency: Optional[str] = None,
    level: Optional[str] = None,
    lang: Optional[str] = "es",  # Language filter: es or en
    limit: int = 12
):
    """Get published posts for public blog, filtered by language and classification"""
    now = datetime.now(timezone.utc)
    
    query = {"is_published": True}
    
    # Filter by language - show only posts matching selected language
    if lang:
        query["language"] = lang
    
    if category:
        query["$or"] = [{"category_id": category}, {"category_name": category}]
    if tag:
        query["tags"] = tag
    
    posts = await db.blog_posts.find(query).sort("created_at", -1).to_list(limit * 3)  # Get more to filter
    
    # Filter by publish date
    filtered_posts = []
    for p in posts:
        publish_date = p.get("publish_date")
        if publish_date:
            try:
                pd = datetime.fromisoformat(publish_date.replace('Z', '+00:00'))
                if pd <= now:
                    filtered_posts.append(p)
            except:
                filtered_posts.append(p)
        else:
            filtered_posts.append(p)
    
    # If filtering by program, competency, or level, we need to check content_items
    if program or competency or level:
        final_posts = []
        for p in filtered_posts:
            content_item_id = p.get("content_item_id")
            if not content_item_id:
                continue
            
            content_item = await db.content_items.find_one(
                {"id": content_item_id},
                {"_id": 0, "course_id": 1, "competency_id": 1, "level": 1}
            )
            if not content_item:
                continue
            
            matches = True
            
            # Check program filter
            if program and matches:
                if content_item.get("course_id"):
                    course = await db.courses.find_one({"id": content_item.get("course_id")}, {"_id": 0, "name": 1, "title": 1})
                    course_name = course.get("name") or course.get("title") if course else None
                    if course_name != program:
                        matches = False
                else:
                    matches = False
            
            # Check competency filter
            if competency and matches:
                if content_item.get("competency_id"):
                    comp = await db.competencies.find_one({"id": content_item.get("competency_id")}, {"_id": 0, "name": 1})
                    comp_name = comp.get("name") if comp else None
                    if comp_name != competency:
                        matches = False
                else:
                    matches = False
            
            # Check level filter
            if level and matches:
                level_num = content_item.get("level")
                if level_num:
                    nivel = await db.niveles_certificacion.find_one({"order": level_num}, {"_id": 0, "advancement_es": 1})
                    level_name = nivel.get("advancement_es") if nivel else None
                    if level_name != level:
                        matches = False
                else:
                    matches = False
            
            if matches:
                final_posts.append(p)
        
        filtered_posts = final_posts[:limit]
    else:
        filtered_posts = filtered_posts[:limit]
    
    # Clean markdown wrapper from content
    for p in filtered_posts:
        content = p.get("content", "")
        if content.startswith("```markdown"):
            content = content[11:]  # Remove ```markdown
        if content.endswith("```"):
            content = content[:-3]  # Remove trailing ```
        p["content"] = content.strip()
        
        excerpt = p.get("excerpt", "")
        if excerpt.startswith("```markdown"):
            excerpt = excerpt[11:]
        if excerpt.endswith("```"):
            excerpt = excerpt[:-3]
        p["excerpt"] = excerpt.strip()
    
    # Get all tags for sidebar (from current language only)
    all_posts = await db.blog_posts.find({"is_published": True, "language": lang}).to_list(500)
    all_tags = set()
    for p in all_posts:
        all_tags.update(p.get("tags", []))
    
    # Get categories
    categories = await db.blog_categories.find().to_list(50)
    
    # Get unique programs, competencies, and levels for filters
    programs = set()
    competencies_set = set()
    levels_set = set()
    
    for p in all_posts:
        if p.get("content_item_id"):
            ci = await db.content_items.find_one({"id": p.get("content_item_id")}, {"_id": 0, "course_id": 1, "competency_id": 1, "level": 1})
            if ci:
                if ci.get("course_id"):
                    course = await db.courses.find_one({"id": ci.get("course_id")}, {"_id": 0, "name": 1, "title": 1})
                    if course:
                        programs.add(course.get("name") or course.get("title"))
                if ci.get("competency_id"):
                    comp = await db.competencies.find_one({"id": ci.get("competency_id")}, {"_id": 0, "name": 1})
                    if comp:
                        competencies_set.add(comp.get("name"))
                if ci.get("level"):
                    nivel = await db.niveles_certificacion.find_one({"order": ci.get("level")}, {"_id": 0, "advancement_es": 1})
                    if nivel:
                        levels_set.add(nivel.get("advancement_es"))
    
    return {
        "posts": [serialize_doc(p) for p in filtered_posts],
        "tags": sorted(list(all_tags)),
        "categories": [serialize_doc(c) for c in categories],
        "filters": {
            "programs": sorted(list(programs)),
            "competencies": sorted(list(competencies_set)),
            "levels": sorted(list(levels_set))
        }
    }

@router.get("/public/posts/{slug}")
async def get_public_post(slug: str):
    """Get single published post by slug"""
    post = await db.blog_posts.find_one({"slug": slug, "is_published": True})
    
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    
    # Clean markdown wrapper from content
    content = post.get("content", "")
    if content.startswith("```markdown"):
        content = content[11:]
    if content.endswith("```"):
        content = content[:-3]
    post["content"] = content.strip()
    
    excerpt = post.get("excerpt", "")
    if excerpt.startswith("```markdown"):
        excerpt = excerpt[11:]
    if excerpt.endswith("```"):
        excerpt = excerpt[:-3]
    post["excerpt"] = excerpt.strip()
    
    # Increment view count
    await db.blog_posts.update_one(
        {"_id": post["_id"]},
        {"$inc": {"views": 1}}
    )
    post["views"] = post.get("views", 0) + 1
    
    # Get program, competency and level tags from content_item
    program_tag = None
    competency_tag = None
    level_tag = None
    
    content_item_id = post.get("content_item_id")
    if content_item_id:
        content_item = await db.content_items.find_one(
            {"id": content_item_id},
            {"_id": 0, "course_id": 1, "competency_id": 1, "level": 1}
        )
        if content_item:
            # Get program name
            if content_item.get("course_id"):
                course = await db.courses.find_one({"id": content_item.get("course_id")}, {"_id": 0, "name": 1, "title": 1})
                if course:
                    program_tag = course.get("name") or course.get("title")
            
            # Get competency name
            if content_item.get("competency_id"):
                competency = await db.competencies.find_one({"id": content_item.get("competency_id")}, {"_id": 0, "name": 1})
                if competency:
                    competency_tag = competency.get("name")
            
            # Get level name from niveles_certificacion
            level_num = content_item.get("level")
            if level_num:
                nivel = await db.niveles_certificacion.find_one({"order": level_num}, {"_id": 0, "advancement_es": 1, "advancement_en": 1})
                if nivel:
                    # Use language from post to decide which level name to return
                    post_lang = post.get("language", "es")
                    level_tag = nivel.get(f"advancement_{post_lang}") or nivel.get("advancement_es")
    
    # Add classification tags to post
    post["program_tag"] = program_tag
    post["competency_tag"] = competency_tag
    post["level_tag"] = level_tag
    
    # Get related posts (same category and language, exclude current)
    related = []
    post_lang = post.get("language", "es")
    if post.get("category_id"):
        related_posts = await db.blog_posts.find({
            "category_id": post["category_id"],
            "language": post_lang,
            "is_published": True,
            "_id": {"$ne": post["_id"]}
        }).limit(3).to_list(3)
        related = [serialize_doc(r) for r in related_posts]
    
    return {
        "post": serialize_doc(post),
        "related": related
    }

# ============ LMS INTEGRATION ============

def fix_drive_url(url):
    """Convert Google Drive URL to lh3.googleusercontent.com format for CORS support"""
    if not url:
        return url
    # Extract file ID from various Google Drive URL formats
    if "drive.google.com/uc?export=view&id=" in url:
        file_id = url.split("id=")[-1]
        return f"https://lh3.googleusercontent.com/d/{file_id}"
    elif "drive.google.com/file/d/" in url:
        file_id = url.split("/d/")[1].split("/")[0]
        return f"https://lh3.googleusercontent.com/d/{file_id}"
    elif "lh3.googleusercontent.com" in url:
        return url  # Already correct format
    return url

@router.post("/sync-slide-images")
async def sync_slide_images_to_blogs():
    """Sync slide images from content items to their associated blog posts and fix URLs"""
    updated_count = 0
    
    # Get all blog posts that have a content_item_id
    blogs = await db.blog_posts.find({"content_item_id": {"$exists": True, "$ne": None}}).to_list(500)
    
    for blog in blogs:
        content_item_id = blog.get("content_item_id")
        if not content_item_id:
            continue
            
        # Get the content item to find slide images
        content_item = await db.content_items.find_one({"id": content_item_id})
        if not content_item:
            continue
            
        slide_images = content_item.get("slides", {}).get("image_urls", [])
        
        # Fix URLs to use lh3.googleusercontent.com format
        fixed_images = [fix_drive_url(url) for url in slide_images]
        
        # Update blog with slide images (always update to fix URLs)
        if fixed_images:
            await db.blog_posts.update_one(
                {"_id": blog["_id"]},
                {"$set": {"slide_images": fixed_images}}
            )
            updated_count += 1
    
    return {
        "success": True,
        "blogs_updated": updated_count,
        "message": f"Synchronized and fixed slide images for {updated_count} blog posts"
    }

@router.post("/fix-image-urls")
async def fix_all_image_urls():
    """Fix all existing Google Drive image URLs to lh3.googleusercontent.com format"""
    fixed_blogs = 0
    fixed_items = 0
    
    # Fix blog posts
    blogs = await db.blog_posts.find({"slide_images": {"$exists": True}}).to_list(500)
    for blog in blogs:
        images = blog.get("slide_images", [])
        fixed_images = [fix_drive_url(url) for url in images]
        if fixed_images != images:
            await db.blog_posts.update_one(
                {"_id": blog["_id"]},
                {"$set": {"slide_images": fixed_images}}
            )
            fixed_blogs += 1
    
    # Fix content items
    items = await db.content_items.find({"slides.image_urls": {"$exists": True}}).to_list(500)
    for item in items:
        images = item.get("slides", {}).get("image_urls", [])
        fixed_images = [fix_drive_url(url) for url in images]
        if fixed_images != images:
            await db.content_items.update_one(
                {"_id": item["_id"]},
                {"$set": {"slides.image_urls": fixed_images}}
            )
            fixed_items += 1
    
    return {
        "success": True,
        "blogs_fixed": fixed_blogs,
        "items_fixed": fixed_items
    }

@router.post("/sync-slugs-to-items")
async def sync_slugs_to_content_items():
    """Sync blog slugs back to content items for direct linking"""
    updated_count = 0
    
    # Get all blog posts with content_item_id
    blogs = await db.blog_posts.find({"content_item_id": {"$exists": True, "$ne": None}}).to_list(500)
    
    for blog in blogs:
        content_item_id = blog.get("content_item_id")
        slug = blog.get("slug")
        language = blog.get("language", "es")
        
        if not content_item_id or not slug:
            continue
        
        # Update the content item with the appropriate slug field
        field_name = f"blog_{language}_slug"
        await db.content_items.update_one(
            {"id": content_item_id},
            {"$set": {field_name: slug}}
        )
        updated_count += 1
    
    return {
        "success": True,
        "updated": updated_count
    }

@router.get("/posts-for-lms")
async def get_posts_for_lms():
    """Get published posts formatted for LMS lesson dropdown"""
    posts = await db.blog_posts.find({"is_published": True}).sort("title", 1).to_list(100)
    
    return {
        "posts": [
            {
                "id": str(p["_id"]),
                "title": p.get("title"),
                "slug": p.get("slug"),
                "excerpt": p.get("excerpt", "")[:100],
                "reading_time_minutes": p.get("reading_time_minutes", 5)
            }
            for p in posts
        ]
    }
