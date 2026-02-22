from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime, timezone
from bson import ObjectId
import uuid
import os
import base64
import logging
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/lms", tags=["LMS"])

# Use shared async database from database.py
from database import db

# ============ MODELS ============

class LessonCreate(BaseModel):
    title: str
    description: Optional[str] = ""
    content_type: str = "video"  # video, text, quiz, pdf
    content_url: Optional[str] = ""  # Vimeo, YouTube, PDF URL
    content_text: Optional[str] = ""  # For text lessons
    duration_minutes: Optional[int] = 0
    order: int = 0
    is_free: bool = False

class LessonUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    content_type: Optional[str] = None
    content_url: Optional[str] = None
    content_text: Optional[str] = None
    duration_minutes: Optional[int] = None
    order: Optional[int] = None
    is_free: Optional[bool] = None

class CourseCreate(BaseModel):
    title: str
    description: Optional[str] = ""
    thumbnail_url: Optional[str] = ""
    formato_id: Optional[str] = ""
    formato_name: Optional[str] = ""
    enfoque_id: Optional[str] = ""
    enfoque_name: Optional[str] = ""
    nivel_id: Optional[str] = ""
    nivel_name: Optional[str] = ""
    instructor_name: Optional[str] = ""
    is_published: bool = False
    # New fields for public page
    slug: Optional[str] = ""  # URL-friendly identifier
    objectives: Optional[List[str]] = []  # Learning objectives
    syllabus: Optional[List[dict]] = []  # [{title, description}]
    faqs: Optional[List[dict]] = []  # [{question, answer}]
    duration_text: Optional[str] = ""  # e.g., "8 semanas"
    price: Optional[float] = None
    price_text: Optional[str] = ""  # e.g., "Gratis", "$1,500 MXN"

class CourseUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    thumbnail_url: Optional[str] = None
    formato_id: Optional[str] = None
    formato_name: Optional[str] = None
    enfoque_id: Optional[str] = None
    enfoque_name: Optional[str] = None
    nivel_id: Optional[str] = None
    nivel_name: Optional[str] = None
    instructor_name: Optional[str] = None
    is_published: Optional[bool] = None
    # New fields for public page
    slug: Optional[str] = None
    objectives: Optional[List[str]] = None
    syllabus: Optional[List[dict]] = None
    faqs: Optional[List[dict]] = None
    duration_text: Optional[str] = None
    price: Optional[float] = None
    price_text: Optional[str] = None

# ============ HELPER FUNCTIONS ============

def serialize_doc(doc):
    """Convert MongoDB document to JSON serializable dict"""
    if doc is None:
        return None
    doc["id"] = str(doc.pop("_id", ""))
    return doc

# ============ COURSE ENDPOINTS ============

@router.get("/courses")
async def get_courses(
    formato_id: Optional[str] = None,
    enfoque_id: Optional[str] = None,
    nivel_id: Optional[str] = None,
    is_published: Optional[bool] = None
):
    """Get all courses with optional filters"""
    query = {}
    if formato_id:
        query["formato_id"] = formato_id
    if enfoque_id:
        query["enfoque_id"] = enfoque_id
    if nivel_id:
        query["nivel_id"] = nivel_id
    if is_published is not None:
        query["is_published"] = is_published
    
    courses = await db.courses.find(query).sort("created_at", -1).to_list(100)
    
    # Add lesson count and total duration for each course
    for course in courses:
        course_id = str(course["_id"])
        lessons = await db.lessons.find({"course_id": course_id}).to_list(100)
        course["lesson_count"] = len(lessons)
        course["total_duration"] = sum(l.get("duration_minutes", 0) for l in lessons)
    
    return {
        "success": True,
        "courses": [serialize_doc(c) for c in courses],
        "total": len(courses)
    }

@router.get("/courses/{course_id}")
async def get_course(course_id: str):
    """Get single course with its lessons"""
    course = None
    if ObjectId.is_valid(course_id):
        course = await db.courses.find_one({"_id": ObjectId(course_id)})
    if not course:
        course = await db.courses.find_one({"id": course_id})
    
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    
    # Get lessons for this course
    lessons = await db.lessons.find({"course_id": str(course["_id"])}).sort("order", 1).to_list(100)
    
    course_data = serialize_doc(course)
    course_data["lessons"] = [serialize_doc(l) for l in lessons]
    course_data["lesson_count"] = len(lessons)
    course_data["total_duration"] = sum(l.get("duration_minutes", 0) for l in lessons)
    
    return {"success": True, "course": course_data}

@router.post("/courses")
async def create_course(data: CourseCreate):
    """Create a new course"""
    # Generate slug from title if not provided
    slug = data.slug or data.title.lower().replace(" ", "-").replace("á", "a").replace("é", "e").replace("í", "i").replace("ó", "o").replace("ú", "u")
    slug = ''.join(c for c in slug if c.isalnum() or c == '-')
    
    course_doc = {
        "id": str(uuid.uuid4()),
        "title": data.title,
        "description": data.description,
        "thumbnail_url": data.thumbnail_url,
        "formato_id": data.formato_id,
        "formato_name": data.formato_name,
        "enfoque_id": data.enfoque_id,
        "enfoque_name": data.enfoque_name,
        "nivel_id": data.nivel_id,
        "nivel_name": data.nivel_name,
        "instructor_name": data.instructor_name,
        "is_published": data.is_published,
        "slug": slug,
        "objectives": data.objectives or [],
        "syllabus": data.syllabus or [],
        "faqs": data.faqs or [],
        "duration_text": data.duration_text or "",
        "price": data.price,
        "price_text": data.price_text or "",
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc)
    }
    
    result = await db.courses.insert_one(course_doc)
    course_doc["id"] = str(result.inserted_id)
    del course_doc["_id"]
    
    return {"success": True, "course": course_doc}

@router.put("/courses/{course_id}")
async def update_course(course_id: str, data: CourseUpdate):
    """Update a course"""
    update_data = {k: v for k, v in data.dict().items() if v is not None}
    update_data["updated_at"] = datetime.now(timezone.utc)
    
    query = {"_id": ObjectId(course_id)} if ObjectId.is_valid(course_id) else {"id": course_id}
    result = await db.courses.find_one_and_update(
        query,
        {"$set": update_data},
        return_document=True
    )
    
    if not result:
        raise HTTPException(status_code=404, detail="Course not found")
    
    return {"success": True, "course": serialize_doc(result)}

@router.delete("/courses/{course_id}")
async def delete_course(course_id: str):
    """Delete a course and its lessons"""
    query = {"_id": ObjectId(course_id)} if ObjectId.is_valid(course_id) else {"id": course_id}
    course = await db.courses.find_one(query)
    
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    
    # Delete all lessons for this course
    await db.lessons.delete_many({"course_id": str(course["_id"])})
    
    # Delete the course
    await db.courses.delete_one(query)
    
    return {"success": True, "message": "Course and lessons deleted"}

# ============ LESSON ENDPOINTS ============

@router.get("/courses/{course_id}/lessons")
async def get_lessons(course_id: str):
    """Get all lessons for a course"""
    lessons = await db.lessons.find({"course_id": course_id}).sort("order", 1).to_list(100)
    return {
        "success": True,
        "lessons": [serialize_doc(l) for l in lessons]
    }

@router.post("/courses/{course_id}/lessons")
async def create_lesson(course_id: str, data: LessonCreate):
    """Create a new lesson for a course"""
    # Verify course exists
    course = None
    if ObjectId.is_valid(course_id):
        course = await db.courses.find_one({"_id": ObjectId(course_id)})
    if not course:
        course = await db.courses.find_one({"id": course_id})
    
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    
    actual_course_id = str(course["_id"])
    
    # Auto-assign order if not provided
    order = data.order
    if order == 0:
        max_lesson = await db.lessons.find_one(
            {"course_id": actual_course_id},
            sort=[("order", -1)]
        )
        order = (max_lesson.get("order", 0) + 1) if max_lesson else 1
    
    lesson_doc = {
        "id": str(uuid.uuid4()),
        "course_id": actual_course_id,
        "title": data.title,
        "description": data.description,
        "content_type": data.content_type,
        "content_url": data.content_url,
        "content_text": data.content_text,
        "duration_minutes": data.duration_minutes,
        "order": order,
        "is_free": data.is_free,
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc)
    }
    
    result = await db.lessons.insert_one(lesson_doc)
    lesson_doc["id"] = str(result.inserted_id)
    del lesson_doc["_id"]
    
    return {"success": True, "lesson": lesson_doc}

@router.put("/lessons/{lesson_id}")
async def update_lesson(lesson_id: str, data: LessonUpdate):
    """Update a lesson"""
    update_data = {k: v for k, v in data.dict().items() if v is not None}
    update_data["updated_at"] = datetime.now(timezone.utc)
    
    query = {"_id": ObjectId(lesson_id)} if ObjectId.is_valid(lesson_id) else {"id": lesson_id}
    result = await db.lessons.find_one_and_update(
        query,
        {"$set": update_data},
        return_document=True
    )
    
    if not result:
        raise HTTPException(status_code=404, detail="Lesson not found")
    
    return {"success": True, "lesson": serialize_doc(result)}

@router.delete("/lessons/{lesson_id}")
async def delete_lesson(lesson_id: str):
    """Delete a lesson"""
    query = {"_id": ObjectId(lesson_id)} if ObjectId.is_valid(lesson_id) else {"id": lesson_id}
    result = await db.lessons.delete_one(query)
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Lesson not found")
    
    return {"success": True, "message": "Lesson deleted"}

@router.put("/lessons/{lesson_id}/reorder")
async def reorder_lesson(lesson_id: str, new_order: int):
    """Change lesson order"""
    query = {"_id": ObjectId(lesson_id)} if ObjectId.is_valid(lesson_id) else {"id": lesson_id}
    lesson = await db.lessons.find_one(query)
    
    if not lesson:
        raise HTTPException(status_code=404, detail="Lesson not found")
    
    old_order = lesson.get("order", 0)
    course_id = lesson.get("course_id")
    
    # Shift other lessons
    if new_order > old_order:
        await db.lessons.update_many(
            {"course_id": course_id, "order": {"$gt": old_order, "$lte": new_order}},
            {"$inc": {"order": -1}}
        )
    else:
        await db.lessons.update_many(
            {"course_id": course_id, "order": {"$gte": new_order, "$lt": old_order}},
            {"$inc": {"order": 1}}
        )
    
    # Update the lesson's order
    await db.lessons.update_one(
        {"_id": lesson["_id"]},
        {"$set": {"order": new_order, "updated_at": datetime.now(timezone.utc)}}
    )
    
    return {"success": True, "message": "Lesson reordered"}

# ============ OPTIONS ENDPOINT ============

@router.get("/options")
async def get_lms_options():
    """Get dropdown options for course creation"""
    # Get formatos
    formatos = await db.formatos.find({}, {"_id": 0, "id": 1, "name": 1}).to_list(100)
    
    # Get enfoques (thematic axes)
    enfoques = await db.thematic_axes.find({}, {"_id": 0, "id": 1, "name": 1}).to_list(100)
    
    # Get niveles (certification levels) from Foundations
    niveles_raw = await db.niveles_certificacion.find({}, {"_id": 0}).sort("order", 1).to_list(100)
    niveles = [
        {
            "id": n.get("id"),
            "name": n.get("advancement_es") or n.get("name"),  # Use advancement_es as display name
            "certification_name": n.get("certification_name"),
            "advancement_es": n.get("advancement_es"),
            "advancement_en": n.get("advancement_en"),
            "order": n.get("order")
        }
        for n in niveles_raw
    ]
    
    # Get blog posts for "blog" content type
    blog_posts = await db.blog_posts.find(
        {"is_published": True}, 
        {"_id": 0, "id": 1, "title": 1, "slug": 1, "reading_time_minutes": 1}
    ).to_list(100)
    
    return {
        "formatos": formatos,
        "enfoques": enfoques,
        "niveles": niveles,
        "blog_posts": blog_posts,
        "content_types": [
            {"value": "video", "label": "Video"},
            {"value": "text", "label": "Text/Article"},
            {"value": "blog", "label": "Blog Post"},
            {"value": "pdf", "label": "PDF Document"},
            {"value": "quiz", "label": "Quiz"}
        ]
    }

# ============ PUBLIC ENDPOINTS ============

@router.get("/public/courses")
async def get_public_courses(
    formato_id: Optional[str] = None,
    enfoque_id: Optional[str] = None,
    nivel_id: Optional[str] = None
):
    """Get published courses for public viewing"""
    query = {"is_published": True}
    if formato_id:
        query["formato_id"] = formato_id
    if enfoque_id:
        query["enfoque_id"] = enfoque_id
    if nivel_id:
        query["nivel_id"] = nivel_id
    
    courses = await db.courses.find(query).sort("created_at", -1).to_list(100)
    
    for course in courses:
        course_id = str(course["_id"])
        lessons = await db.lessons.find({"course_id": course_id}).to_list(100)
        course["lesson_count"] = len(lessons)
        course["total_duration"] = sum(l.get("duration_minutes", 0) for l in lessons)
        # Count free lessons
        course["free_lessons"] = len([l for l in lessons if l.get("is_free")])
    
    return {
        "success": True,
        "courses": [serialize_doc(c) for c in courses]
    }

@router.get("/public/courses/{course_id}")
async def get_public_course(course_id: str):
    """Get published course with lesson list (content hidden unless free)"""
    query = {"is_published": True}
    if ObjectId.is_valid(course_id):
        query["_id"] = ObjectId(course_id)
    else:
        query["id"] = course_id
    
    course = await db.courses.find_one(query)
    
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    
    lessons = await db.lessons.find({"course_id": str(course["_id"])}).sort("order", 1).to_list(100)
    
    # Hide content for non-free lessons
    public_lessons = []
    for l in lessons:
        lesson_data = serialize_doc(l)
        if not l.get("is_free"):
            lesson_data["content_url"] = None
            lesson_data["content_text"] = None
        public_lessons.append(lesson_data)
    
    course_data = serialize_doc(course)
    course_data["lessons"] = public_lessons
    course_data["lesson_count"] = len(lessons)
    course_data["total_duration"] = sum(l.get("duration_minutes", 0) for l in lessons)
    
    return {"success": True, "course": course_data}


@router.get("/public/course-by-slug/{slug}")
async def get_public_course_by_slug(slug: str):
    """Get published course by URL slug or ID for public page"""
    # Try to find by slug first, then by ID
    course = await db.courses.find_one({"slug": slug, "is_published": True})
    
    if not course:
        # Try by ID
        if ObjectId.is_valid(slug):
            course = await db.courses.find_one({"_id": ObjectId(slug), "is_published": True})
        if not course:
            course = await db.courses.find_one({"id": slug, "is_published": True})
    
    if not course:
        raise HTTPException(status_code=404, detail="Programa no encontrado")
    
    lessons = await db.lessons.find({"course_id": str(course["_id"])}).sort("order", 1).to_list(100)
    
    # Public lessons list with limited info
    public_lessons = []
    for l in lessons:
        lesson_data = {
            "id": str(l["_id"]),
            "title": l.get("title", ""),
            "description": l.get("description", ""),
            "content_type": l.get("content_type", "video"),
            "duration_minutes": l.get("duration_minutes", 0),
            "is_free": l.get("is_free", False),
            "order": l.get("order", 0)
        }
        # Include content only for free lessons
        if l.get("is_free"):
            lesson_data["content_url"] = l.get("content_url")
        public_lessons.append(lesson_data)
    
    # Count enrolled students
    enrolled_count = await db.lms_enrollments.count_documents({"course_id": str(course["_id"])})
    
    course_data = {
        "id": str(course["_id"]),
        "title": course.get("title", ""),
        "slug": course.get("slug", ""),
        "description": course.get("description", ""),
        "thumbnail_url": course.get("thumbnail_url", ""),
        "instructor_name": course.get("instructor_name", ""),
        "objectives": course.get("objectives", []),
        "syllabus": course.get("syllabus", []),
        "faqs": course.get("faqs", []),
        "duration_text": course.get("duration_text", ""),
        "price": course.get("price"),
        "price_text": course.get("price_text", ""),
        "formato_name": course.get("formato_name", ""),
        "nivel_name": course.get("nivel_name", ""),
        "lessons": public_lessons,
        "lesson_count": len(lessons),
        "total_duration": sum(l.get("duration_minutes", 0) for l in lessons),
        "enrolled_count": enrolled_count
    }
    
    return {"success": True, "course": course_data}


# ============ AI THUMBNAIL GENERATION ============

class ThumbnailRequest(BaseModel):
    course_id: str
    custom_prompt: Optional[str] = None


@router.post("/courses/{course_id}/generate-thumbnail")
async def generate_course_thumbnail(course_id: str, custom_prompt: Optional[str] = None):
    """Generate AI thumbnail for a course using Gemini Nano Banana"""
    from emergentintegrations.llm.chat import LlmChat, UserMessage
    
    # Get course details
    course = None
    if ObjectId.is_valid(course_id):
        course = await db.courses.find_one({"_id": ObjectId(course_id)})
    if not course:
        course = await db.courses.find_one({"id": course_id})
    
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    
    # Build prompt from course info
    title = course.get("title", "Online Course")
    description = course.get("description", "")
    formato = course.get("formato_name", "")
    enfoque = course.get("enfoque_name", "")
    
    if custom_prompt:
        prompt = custom_prompt
    else:
        prompt = f"""Create a professional, modern course thumbnail image for an educational course.
Course title: {title}
Description: {description[:200] if description else "Professional development course"}
Format: {formato if formato else "Online course"}
Focus area: {enfoque if enfoque else "Business skills"}

Style requirements:
- Clean, professional design
- Modern gradient background (blue to purple or similar)
- Abstract geometric shapes or subtle patterns
- No text in the image
- High contrast, vibrant colors
- Suitable for an LMS/educational platform
- 16:9 aspect ratio composition"""
    
    try:
        api_key = os.environ.get("EMERGENT_LLM_KEY")
        if not api_key:
            raise HTTPException(status_code=500, detail="Image generation API key not configured")
        
        # Use Gemini Nano Banana for image generation
        import uuid
        chat = LlmChat(
            api_key=api_key,
            session_id=f"thumbnail-{uuid.uuid4()}",
            system_message="You are an expert graphic designer creating educational course thumbnails."
        )
        chat.with_model("gemini", "gemini-3-pro-image-preview").with_params(modalities=["image", "text"])
        
        msg = UserMessage(text=prompt)
        text_response, images = await chat.send_message_multimodal_response(msg)
        
        if not images or len(images) == 0:
            raise HTTPException(status_code=500, detail="No image was generated")
        
        # Get base64 data from response
        image_data = images[0].get('data', '')
        mime_type = images[0].get('mime_type', 'image/png')
        
        # Create data URL
        data_url = f"data:{mime_type};base64,{image_data}"
        
        # Update course with the thumbnail
        update_query = {"_id": ObjectId(course_id)} if ObjectId.is_valid(course_id) else {"id": course_id}
        await db.courses.update_one(
            update_query,
            {"$set": {"thumbnail_url": data_url, "updated_at": datetime.now(timezone.utc).isoformat()}}
        )
        
        return {
            "success": True,
            "thumbnail_url": data_url,
            "message": "Thumbnail generated with Nano Banana and saved to course"
        }
        
    except Exception as e:
        logger.error(f"Error generating thumbnail: {e}")
        raise HTTPException(status_code=500, detail=f"Error generating thumbnail: {str(e)}")


# ============ CONTACT ENROLLMENT ENDPOINTS ============

@router.get("/contact/{contact_id}/courses")
async def get_contact_courses(contact_id: str):
    """Get all courses a contact is enrolled in"""
    # Find courses where this contact is in enrolled_student_ids
    courses = await db.courses.find({
        "enrolled_student_ids": contact_id
    }).to_list(100)
    
    # Get basic course info
    enrolled_courses = []
    for course in courses:
        enrolled_courses.append({
            "id": str(course.get("_id", course.get("id"))),
            "title": course.get("title"),
            "thumbnail_url": course.get("thumbnail_url"),
            "enfoque_name": course.get("enfoque_name"),
            "nivel_name": course.get("nivel_name"),
            "lesson_count": await db.lessons.count_documents({"course_id": str(course["_id"])}),
        })
    
    return {
        "success": True,
        "courses": enrolled_courses,
        "total": len(enrolled_courses)
    }


@router.post("/courses/{course_id}/enroll/{contact_id}")
async def enroll_contact(course_id: str, contact_id: str):
    """Enroll a contact in a course"""
    # Find the course
    course = None
    if ObjectId.is_valid(course_id):
        course = await db.courses.find_one({"_id": ObjectId(course_id)})
    if not course:
        course = await db.courses.find_one({"id": course_id})
    
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    
    # Add contact to enrolled students
    update_query = {"_id": course["_id"]}
    await db.courses.update_one(
        update_query,
        {"$addToSet": {"enrolled_student_ids": contact_id}}
    )
    
    return {"success": True, "message": "Contact enrolled in course"}


@router.delete("/courses/{course_id}/enroll/{contact_id}")
async def unenroll_contact(course_id: str, contact_id: str):
    """Remove a contact from a course"""
    course = None
    if ObjectId.is_valid(course_id):
        course = await db.courses.find_one({"_id": ObjectId(course_id)})
    if not course:
        course = await db.courses.find_one({"id": course_id})
    
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    
    # Remove contact from enrolled students
    update_query = {"_id": course["_id"]}
    await db.courses.update_one(
        update_query,
        {"$pull": {"enrolled_student_ids": contact_id}}
    )
    
    return {"success": True, "message": "Contact removed from course"}



# ============ EXTERNAL USER ENDPOINTS ============

from routers.auth import get_current_user_optional

@router.get("/external/my-courses")
async def get_external_user_courses(current_user: dict = Depends(get_current_user_optional)):
    """Get courses for the currently authenticated external user"""
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    user_id = current_user.get("id") or current_user.get("contact_id")
    
    if not user_id:
        raise HTTPException(status_code=400, detail="User ID not found")
    
    # Find courses where this user is enrolled
    courses = await db.courses.find({
        "$or": [
            {"enrolled_student_ids": user_id},
            {"enrolled_student_ids": str(user_id)}
        ],
        "is_published": True
    }).to_list(100)
    
    # Enrich with lesson info
    for course in courses:
        course_id = str(course["_id"])
        lessons = await db.lessons.find({"course_id": course_id}).to_list(100)
        course["lesson_count"] = len(lessons)
        course["total_duration"] = sum(l.get("duration_minutes", 0) for l in lessons)
    
    return {
        "success": True,
        "courses": [serialize_doc(c) for c in courses],
        "total": len(courses)
    }


@router.get("/external/courses/{course_id}")
async def get_external_course_detail(course_id: str, current_user: dict = Depends(get_current_user_optional)):
    """Get course details for an enrolled external user"""
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    user_id = current_user.get("id") or current_user.get("contact_id")
    
    # Find the course and verify enrollment
    query = {"is_published": True}
    if ObjectId.is_valid(course_id):
        query["_id"] = ObjectId(course_id)
    else:
        query["id"] = course_id
    
    course = await db.courses.find_one(query)
    
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    
    # Check if user is enrolled
    enrolled_ids = course.get("enrolled_student_ids", [])
    if user_id not in enrolled_ids and str(user_id) not in enrolled_ids:
        raise HTTPException(status_code=403, detail="Not enrolled in this course")
    
    # Get lessons - full access for enrolled users
    lessons = await db.lessons.find({"course_id": str(course["_id"])}).sort("order", 1).to_list(100)
    
    course_data = serialize_doc(course)
    course_data["lessons"] = [serialize_doc(l) for l in lessons]
    course_data["lesson_count"] = len(lessons)
    course_data["total_duration"] = sum(l.get("duration_minutes", 0) for l in lessons)
    
    return {"success": True, "course": course_data}


@router.get("/external/progress/{course_id}")
async def get_external_user_progress(course_id: str, current_user: dict = Depends(get_current_user_optional)):
    """Get user's progress in a course"""
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    user_id = current_user.get("id") or current_user.get("contact_id")
    
    # Get or create progress record
    progress = await db.lms_progress.find_one({
        "user_id": user_id,
        "course_id": course_id
    })
    
    if not progress:
        # Calculate total lessons for percentage
        course_query = {"_id": ObjectId(course_id)} if ObjectId.is_valid(course_id) else {"id": course_id}
        course = await db.courses.find_one(course_query)
        course_id_str = str(course["_id"]) if course else course_id
        total_lessons = await db.lessons.count_documents({"course_id": course_id_str})
        
        return {
            "user_id": user_id,
            "course_id": course_id,
            "completed_lessons": [],
            "progress_percent": 0,
            "total_lessons": total_lessons
        }
    
    return {
        "user_id": progress.get("user_id"),
        "course_id": progress.get("course_id"),
        "completed_lessons": progress.get("completed_lessons", []),
        "progress_percent": progress.get("progress_percent", 0),
        "last_lesson_id": progress.get("last_lesson_id"),
        "updated_at": progress.get("updated_at")
    }


@router.post("/external/progress/{course_id}/complete/{lesson_id}")
async def mark_lesson_complete(course_id: str, lesson_id: str, current_user: dict = Depends(get_current_user_optional)):
    """Mark a lesson as complete for the current user"""
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    user_id = current_user.get("id") or current_user.get("contact_id")
    
    # Get course for lesson count
    course_query = {"_id": ObjectId(course_id)} if ObjectId.is_valid(course_id) else {"id": course_id}
    course = await db.courses.find_one(course_query)
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    
    course_id_str = str(course["_id"])
    total_lessons = await db.lessons.count_documents({"course_id": course_id_str})
    
    # Update or create progress
    existing = await db.lms_progress.find_one({
        "user_id": user_id,
        "course_id": course_id
    })
    
    if existing:
        completed = existing.get("completed_lessons", [])
        if lesson_id not in completed:
            completed.append(lesson_id)
        
        progress_percent = int((len(completed) / total_lessons) * 100) if total_lessons > 0 else 0
        
        await db.lms_progress.update_one(
            {"_id": existing["_id"]},
            {"$set": {
                "completed_lessons": completed,
                "progress_percent": progress_percent,
                "last_lesson_id": lesson_id,
                "updated_at": datetime.now(timezone.utc)
            }}
        )
    else:
        progress_percent = int((1 / total_lessons) * 100) if total_lessons > 0 else 0
        await db.lms_progress.insert_one({
            "user_id": user_id,
            "course_id": course_id,
            "completed_lessons": [lesson_id],
            "progress_percent": progress_percent,
            "last_lesson_id": lesson_id,
            "created_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc)
        })
    
    return {"success": True, "message": "Lesson marked as complete"}



# ============ ENROLLMENT ENDPOINTS ============

class EnrollContactRequest(BaseModel):
    contact_id: str
    course_id: str
    send_welcome_email: bool = False
    welcome_email_subject: Optional[str] = "¡Bienvenido a tu nuevo curso!"
    welcome_email_message: Optional[str] = None

class UnenrollContactRequest(BaseModel):
    contact_id: str
    course_id: str

class QuickCourseCreate(BaseModel):
    title: str


@router.post("/courses/quick-create")
async def quick_create_course(data: QuickCourseCreate):
    """
    Quickly create a new course with just a title.
    Used when enrolling a contact in a course that doesn't exist yet.
    """
    course_id = f"course_{uuid.uuid4().hex[:12]}"
    
    course_doc = {
        "id": course_id,
        "title": data.title,
        "description": "",
        "thumbnail_url": "",
        "is_published": False,
        "enrolled_count": 0,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.courses.insert_one(course_doc)
    
    return {
        "success": True,
        "course": {
            "id": course_id,
            "title": data.title,
            "is_published": False
        }
    }


@router.post("/enroll")
async def enroll_contact_in_course(data: EnrollContactRequest):
    """
    Enroll a contact in a course.
    - Updates contact's assigned_courses array
    - Creates enrollment record
    - Optionally sends welcome email
    """
    # Verify contact exists
    contact = await db.unified_contacts.find_one({"id": data.contact_id}, {"_id": 0})
    if not contact:
        raise HTTPException(status_code=404, detail="Contacto no encontrado")
    
    # Verify course exists
    course = None
    if ObjectId.is_valid(data.course_id):
        course = await db.courses.find_one({"_id": ObjectId(data.course_id)})
    if not course:
        course = await db.courses.find_one({"id": data.course_id})
    
    if not course:
        raise HTTPException(status_code=404, detail="Curso no encontrado")
    
    course_id_str = course.get("id") or str(course.get("_id"))
    
    # Check if already enrolled
    assigned_courses = contact.get("assigned_courses", [])
    if course_id_str in assigned_courses:
        return {
            "success": False,
            "message": "El contacto ya está enrolado en este curso"
        }
    
    # Add course to contact's assigned_courses
    assigned_courses.append(course_id_str)
    await db.unified_contacts.update_one(
        {"id": data.contact_id},
        {"$set": {
            "assigned_courses": assigned_courses,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    # Create enrollment record
    enrollment_doc = {
        "id": f"enroll_{uuid.uuid4().hex[:12]}",
        "contact_id": data.contact_id,
        "course_id": course_id_str,
        "enrolled_at": datetime.now(timezone.utc).isoformat(),
        "enrolled_by": "admin",  # TODO: get from current user
        "progress_percent": 0,
        "status": "active"
    }
    await db.lms_enrollments.insert_one(enrollment_doc)
    
    # Update course enrolled_count
    await db.courses.update_one(
        {"id": course_id_str} if course.get("id") else {"_id": course.get("_id")},
        {"$inc": {"enrolled_count": 1}}
    )
    
    # Send welcome email if requested
    email_sent = False
    if data.send_welcome_email and contact.get("email"):
        try:
            from services.email_service import email_service
            if email_service.is_configured():
                # Build welcome message
                default_message = f"""
¡Hola {contact.get('name', contact.get('email', '').split('@')[0])}!

Te damos la bienvenida al curso: {course.get('title')}

Ya puedes acceder a tu curso ingresando a nuestra plataforma.

¡Éxito en tu aprendizaje!
"""
                message = data.welcome_email_message or default_message
                
                result = await email_service.send_email(
                    to_email=contact.get("email"),
                    subject=data.welcome_email_subject,
                    text_body=message
                )
                email_sent = result.get("success", False)
        except Exception as e:
            logger.error(f"Error sending welcome email: {e}")
    
    return {
        "success": True,
        "message": "Contacto enrolado exitosamente",
        "email_sent": email_sent,
        "enrollment": {
            "contact_id": data.contact_id,
            "course_id": course_id_str,
            "course_title": course.get("title"),
            "enrolled_at": enrollment_doc["enrolled_at"]
        }
    }


@router.post("/unenroll")
async def unenroll_contact_from_course(data: UnenrollContactRequest):
    """
    Remove a contact from a course.
    - Removes course from contact's assigned_courses array
    - Updates enrollment record status
    """
    # Verify contact exists
    contact = await db.unified_contacts.find_one({"id": data.contact_id}, {"_id": 0})
    if not contact:
        raise HTTPException(status_code=404, detail="Contacto no encontrado")
    
    course_id_str = data.course_id
    
    # Remove course from contact's assigned_courses
    assigned_courses = contact.get("assigned_courses", [])
    if course_id_str in assigned_courses:
        assigned_courses.remove(course_id_str)
        await db.unified_contacts.update_one(
            {"id": data.contact_id},
            {"$set": {
                "assigned_courses": assigned_courses,
                "updated_at": datetime.now(timezone.utc).isoformat()
            }}
        )
    
    # Update enrollment record
    await db.lms_enrollments.update_one(
        {"contact_id": data.contact_id, "course_id": course_id_str},
        {"$set": {
            "status": "unenrolled",
            "unenrolled_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    # Update course enrolled_count
    course = None
    if ObjectId.is_valid(course_id_str):
        course = await db.courses.find_one({"_id": ObjectId(course_id_str)})
    if not course:
        course = await db.courses.find_one({"id": course_id_str})
    
    if course:
        await db.courses.update_one(
            {"id": course_id_str} if course.get("id") else {"_id": course.get("_id")},
            {"$inc": {"enrolled_count": -1}}
        )
    
    return {
        "success": True,
        "message": "Contacto desenrolado exitosamente"
    }


@router.get("/contact/{contact_id}/enrollments")
async def get_contact_enrollments(contact_id: str):
    """
    Get all course enrollments for a specific contact.
    Returns course details with progress info.
    """
    # Verify contact exists
    contact = await db.unified_contacts.find_one({"id": contact_id}, {"_id": 0})
    if not contact:
        raise HTTPException(status_code=404, detail="Contacto no encontrado")
    
    assigned_courses = contact.get("assigned_courses", [])
    
    enrollments = []
    for course_id in assigned_courses:
        # Get course details
        course = None
        if ObjectId.is_valid(course_id):
            course = await db.courses.find_one({"_id": ObjectId(course_id)})
        if not course:
            course = await db.courses.find_one({"id": course_id})
        
        if not course:
            continue
        
        # Get enrollment record
        enrollment = await db.lms_enrollments.find_one(
            {"contact_id": contact_id, "course_id": course_id},
            {"_id": 0}
        )
        
        # Get progress
        progress = await db.lms_progress.find_one(
            {"user_id": contact_id, "course_id": course_id},
            {"_id": 0}
        )
        
        # Get lesson count
        course_id_str = str(course["_id"])
        lesson_count = await db.lessons.count_documents({"course_id": course_id_str})
        
        enrollments.append({
            "course_id": course.get("id") or str(course.get("_id")),
            "course_title": course.get("title"),
            "course_thumbnail": course.get("thumbnail_url"),
            "is_published": course.get("is_published", False),
            "enrolled_at": enrollment.get("enrolled_at") if enrollment else None,
            "progress_percent": progress.get("progress_percent", 0) if progress else 0,
            "completed_lessons": len(progress.get("completed_lessons", [])) if progress else 0,
            "total_lessons": lesson_count
        })
    
    return {
        "success": True,
        "contact_id": contact_id,
        "enrollments": enrollments,
        "total": len(enrollments)
    }

