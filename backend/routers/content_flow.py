"""
Content Flow Router - Blog content creation workflow for Focus
Migrated from ClickUp to internal database
"""
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone
import uuid

from database import db
from routers.auth import get_current_user

router = APIRouter(prefix="/content-flow", tags=["content-flow"])


# ============ MODELS ============

class ContentCreate(BaseModel):
    name: str
    description: Optional[str] = None
    competence: Optional[str] = None
    level: Optional[str] = None
    source_url: Optional[str] = None

class ContentUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None
    competence: Optional[str] = None
    level: Optional[str] = None
    hypothesis: Optional[str] = None
    research_questions: Optional[str] = None
    bibliography: Optional[str] = None
    central_idea: Optional[str] = None
    article_text: Optional[str] = None
    cover_url: Optional[str] = None
    linkedin_post: Optional[str] = None
    substack_draft: Optional[str] = None
    cta_seasonal: Optional[str] = None
    assigned_to: Optional[str] = None


# ============ WORKFLOW STAGES ============

CONTENT_STAGES = [
    {"id": "new", "name": "New Content", "color": "#87909e", "order": 0},
    {"id": "prize_ok", "name": "Prize OK", "color": "#0f9d9f", "order": 1},
    {"id": "control_question", "name": "Control Question", "color": "#aa8d80", "order": 2},
    {"id": "obstacles", "name": "Obstacles", "color": "#b660e0", "order": 3},
    {"id": "hypothesis_ok", "name": "Hypothesis OK", "color": "#aa8d80", "order": 4},
    {"id": "research_questions_ok", "name": "Research Questions OK", "color": "#aa8d80", "order": 5},
    {"id": "waiting_papers", "name": "Waiting Papers", "color": "#3db88b", "order": 6},
    {"id": "bibliography_ok", "name": "Bibliography OK", "color": "#e16b16", "order": 7},
    {"id": "central_idea_ok", "name": "Central Idea OK", "color": "#0f9d9f", "order": 8},
    {"id": "rdl_ok", "name": "RDL OK", "color": "#87909e", "order": 9},
    {"id": "high_point_ok", "name": "High Point OK", "color": "#3db88b", "order": 10},
    {"id": "text_ok", "name": "Text OK", "color": "#1090e0", "order": 11},
    {"id": "cover_ok", "name": "Cover OK", "color": "#3db88b", "order": 12},
    {"id": "website_published", "name": "Website Published", "color": "#ee5e99", "order": 13},
    {"id": "linkedin_scheduled", "name": "LinkedIn Scheduled", "color": "#ee5e99", "order": 14},
    {"id": "cta_seasonal_ok", "name": "CTA Seasonal OK", "color": "#b660e0", "order": 15},
    {"id": "substack_scheduled", "name": "Substack Scheduled", "color": "#f8ae00", "order": 16},
    {"id": "openings_contacted", "name": "Openings Contacted", "color": "#656f7d", "order": 17},
    {"id": "completed", "name": "Completed", "color": "#008844", "order": 18},
]

COMPETENCES = [
    "Language & Articulation",
    "Storytelling",
    "Visual Communication",
    "Executive Presence",
    "Persuasion & Influence",
    "Public Speaking",
    "Data Storytelling",
    "Medical Communications",
]

LEVELS = [
    "Beginner to Competent",
    "Competent to Proficient",
    "Proficient to Expert",
    "Expert to Master",
]


# ============ ENDPOINTS ============

@router.get("/stages")
async def get_stages():
    """Get all workflow stages"""
    return {"stages": CONTENT_STAGES}


@router.get("/competences")
async def get_competences():
    """Get all competences"""
    return {"competences": COMPETENCES}


@router.get("/levels")
async def get_levels():
    """Get all levels"""
    return {"levels": LEVELS}


@router.get("/contents")
async def list_contents(
    status: Optional[str] = None,
    competence: Optional[str] = None,
    limit: int = 100,
    current_user: dict = Depends(get_current_user)
):
    """List all content items"""
    query = {}
    if status:
        query["status"] = status
    if competence:
        query["competence"] = competence
    
    contents = await db.content_flow.find(
        query, {"_id": 0}
    ).sort("created_at", -1).limit(limit).to_list(limit)
    
    # Get counts by status
    pipeline = [
        {"$group": {"_id": "$status", "count": {"$sum": 1}}}
    ]
    status_counts = await db.content_flow.aggregate(pipeline).to_list(100)
    counts_by_status = {s["_id"]: s["count"] for s in status_counts if s["_id"]}
    
    return {
        "contents": contents,
        "total": len(contents),
        "counts_by_status": counts_by_status
    }


@router.get("/contents/kanban")
async def get_kanban_view(current_user: dict = Depends(get_current_user)):
    """Get contents organized by stage for Kanban view"""
    contents = await db.content_flow.find({}, {"_id": 0}).to_list(1000)
    
    # Organize by status
    kanban = {}
    for stage in CONTENT_STAGES:
        kanban[stage["id"]] = {
            "stage": stage,
            "items": []
        }
    
    for content in contents:
        status = content.get("status", "new")
        if status in kanban:
            kanban[status]["items"].append(content)
    
    return {"kanban": kanban, "stages": CONTENT_STAGES}


@router.post("/contents")
async def create_content(
    data: ContentCreate,
    current_user: dict = Depends(get_current_user)
):
    """Create a new content item"""
    content_doc = {
        "id": str(uuid.uuid4()),
        "name": data.name,
        "description": data.description,
        "status": "new",
        "competence": data.competence,
        "level": data.level,
        "source_url": data.source_url,
        "hypothesis": None,
        "research_questions": None,
        "bibliography": None,
        "central_idea": None,
        "article_text": None,
        "cover_url": None,
        "linkedin_post": None,
        "substack_draft": None,
        "cta_seasonal": None,
        "assigned_to": None,
        "created_by": current_user.get("email"),
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    
    await db.content_flow.insert_one(content_doc)
    
    # Remove _id before returning
    content_doc.pop("_id", None)
    return content_doc


@router.get("/contents/{content_id}")
async def get_content(
    content_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get a specific content item"""
    content = await db.content_flow.find_one({"id": content_id}, {"_id": 0})
    if not content:
        raise HTTPException(status_code=404, detail="Content not found")
    return content


@router.put("/contents/{content_id}")
async def update_content(
    content_id: str,
    data: ContentUpdate,
    current_user: dict = Depends(get_current_user)
):
    """Update a content item"""
    update_data = {k: v for k, v in data.dict().items() if v is not None}
    if not update_data:
        raise HTTPException(status_code=400, detail="No data to update")
    
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    update_data["updated_by"] = current_user.get("email")
    
    result = await db.content_flow.update_one(
        {"id": content_id},
        {"$set": update_data}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Content not found")
    
    # Get updated content
    content = await db.content_flow.find_one({"id": content_id}, {"_id": 0})
    return content


@router.put("/contents/{content_id}/move")
async def move_content(
    content_id: str,
    new_status: str,
    current_user: dict = Depends(get_current_user)
):
    """Move content to a new stage"""
    # Validate status
    valid_statuses = [s["id"] for s in CONTENT_STAGES]
    if new_status not in valid_statuses:
        raise HTTPException(status_code=400, detail=f"Invalid status. Use: {valid_statuses}")
    
    result = await db.content_flow.update_one(
        {"id": content_id},
        {"$set": {
            "status": new_status,
            "updated_at": datetime.now(timezone.utc).isoformat(),
            "updated_by": current_user.get("email")
        }}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Content not found")
    
    return {"success": True, "new_status": new_status}


@router.delete("/contents/{content_id}")
async def delete_content(
    content_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Delete a content item"""
    result = await db.content_flow.delete_one({"id": content_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Content not found")
    return {"success": True}


@router.get("/stats")
async def get_stats(current_user: dict = Depends(get_current_user)):
    """Get content flow statistics including blogs, testimonials, events"""
    total = await db.content_flow.count_documents({})
    
    # By status
    pipeline = [
        {"$group": {"_id": "$status", "count": {"$sum": 1}}}
    ]
    by_status = await db.content_flow.aggregate(pipeline).to_list(100)
    
    # By competence
    pipeline_comp = [
        {"$group": {"_id": "$competence", "count": {"$sum": 1}}}
    ]
    by_competence = await db.content_flow.aggregate(pipeline_comp).to_list(100)
    
    # Recent activity
    recent = await db.content_flow.find(
        {}, {"_id": 0, "id": 1, "name": 1, "status": 1, "updated_at": 1}
    ).sort("updated_at", -1).limit(10).to_list(10)
    
    # Get content counts for dashboard
    total_blogs = await db.blog_posts.count_documents({})
    total_testimonials = await db.testimonials.count_documents({})
    total_events = await db.events.count_documents({})
    
    return {
        "total": total,
        "by_status": {s["_id"]: s["count"] for s in by_status if s["_id"]},
        "by_competence": {c["_id"]: c["count"] for c in by_competence if c["_id"]},
        "recent_activity": recent,
        "total_blogs": total_blogs,
        "total_testimonials": total_testimonials,
        "total_events": total_events
    }


@router.post("/import-from-clickup")
async def import_from_clickup(
    tasks: List[dict],
    current_user: dict = Depends(get_current_user)
):
    """Import tasks from ClickUp format"""
    imported = 0
    skipped = 0
    
    status_mapping = {
        "nuevo contenido": "new",
        "prize ok": "prize_ok",
        "control question": "control_question",
        "obstáculos": "obstacles",
        "hipótesis ok": "hypothesis_ok",
        "preguntas investigación ok": "research_questions_ok",
        "esperando papers": "waiting_papers",
        "bibliografía ok": "bibliography_ok",
        "idea central ok": "central_idea_ok",
        "rdl ok": "rdl_ok",
        "high point ok": "high_point_ok",
        "texto ok": "text_ok",
        "portada ok": "cover_ok",
        "leaderlix.com publicado": "website_published",
        "linkedin programado": "linkedin_scheduled",
        "cta estacional ok": "cta_seasonal_ok",
        "substack programado": "substack_scheduled",
        "aperturas contactadas": "openings_contacted",
        "aperturas": "completed",
    }
    
    for task in tasks:
        # Check if already imported
        existing = await db.content_flow.find_one({"clickup_id": task.get("id")})
        if existing:
            skipped += 1
            continue
        
        status = task.get("status", "nuevo contenido").lower()
        mapped_status = status_mapping.get(status, "new")
        
        content_doc = {
            "id": str(uuid.uuid4()),
            "clickup_id": task.get("id"),
            "name": task.get("name") or task.get("title", "Untitled"),
            "description": task.get("description"),
            "status": mapped_status,
            "competence": task.get("competence"),
            "level": task.get("level"),
            "hypothesis": task.get("hypothesis"),
            "research_questions": task.get("research_questions"),
            "bibliography": task.get("bibliography"),
            "article_text": task.get("article_text"),
            "source_url": None,
            "central_idea": None,
            "cover_url": None,
            "linkedin_post": None,
            "substack_draft": None,
            "cta_seasonal": None,
            "assigned_to": None,
            "created_by": current_user.get("email"),
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }
        
        await db.content_flow.insert_one(content_doc)
        imported += 1
    
    return {"success": True, "imported": imported, "skipped": skipped}


# ============ AI CONTENT TOOLS ============

@router.post("/ai/clean-dictation")
async def clean_dictation(
    text: str,
    style: str = "professional",
    language: str = "es",  # es or en
    current_user: dict = Depends(get_current_user)
):
    """
    Clean up dictated/transcribed text using AI.
    Removes filler words, fixes grammar, improves structure.
    
    Styles:
    - professional: Formal business writing
    - casual: Conversational tone
    - academic: Research/paper style
    - blog: Web-friendly format
    
    Languages:
    - es: Spanish
    - en: English
    """
    import os
    from emergentintegrations.llm.chat import LlmChat, UserMessage
    
    style_prompts = {
        "professional": "formal business writing suitable for reports and proposals",
        "casual": "conversational and friendly tone for social media",
        "academic": "academic writing style with proper citations format",
        "blog": "engaging blog post format with clear sections and hooks"
    }
    
    style_desc = style_prompts.get(style, style_prompts["professional"])
    
    lang_instruction = "Write the output in Spanish." if language == "es" else "Write the output in English."
    
    prompt = f"""You are an expert editor. Clean up the following dictated/transcribed text:

INSTRUCTIONS:
1. Remove filler words (um, uh, like, you know, basically, etc.)
2. Fix grammar and punctuation
3. Improve sentence structure for clarity
4. Maintain the original meaning and key points
5. Format as {style_desc}
6. If the text mentions specific data or numbers, preserve them exactly
7. Break into paragraphs for readability
8. Add appropriate headings if the content is long
9. {lang_instruction}

ORIGINAL TEXT:
{text}

Return ONLY the cleaned text, no explanations."""

    try:
        llm = LlmChat(
            api_key=os.environ.get("EMERGENT_LLM_KEY"),
            session_id=f"dictation-cleanup-{uuid.uuid4()}",
            system_message="You are an expert editor who cleans up dictated text."
        )
        llm.with_model("gemini", "gemini-2.0-flash")
        
        response = await llm.send_message(UserMessage(text=prompt))
        
        cleaned_text = response.content if hasattr(response, 'content') else str(response)
        
        # Save to history
        await db.ai_content_history.insert_one({
            "id": str(uuid.uuid4()),
            "type": "dictation_cleanup",
            "original_text": text[:500],  # Store first 500 chars
            "result_preview": cleaned_text[:500],
            "style": style,
            "created_by": current_user.get("email"),
            "created_at": datetime.now(timezone.utc).isoformat()
        })
        
        return {
            "success": True,
            "original_length": len(text),
            "cleaned_length": len(cleaned_text),
            "cleaned_text": cleaned_text,
            "style": style
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI processing error: {str(e)}")


@router.post("/ai/generate-slides")
async def generate_slides(
    content: str,
    num_slides: int = 5,
    style: str = "executive",
    include_speaker_notes: bool = True,
    language: str = "es",  # es or en
    current_user: dict = Depends(get_current_user)
):
    """
    Generate presentation slides from content.
    Returns structured slide data with titles, bullets, and speaker notes.
    
    Styles:
    - executive: Clean, data-focused for leadership
    - educational: Teaching-focused with examples
    - sales: Persuasive with benefits and CTAs
    - creative: Visual-first with minimal text
    
    Languages:
    - es: Spanish
    - en: English
    """
    import os
    from emergentintegrations.llm.chat import LlmChat, UserMessage
    
    style_guides = {
        "executive": "Focus on key metrics, decisions, and strategic insights. Use concise bullet points. Maximum 4 bullets per slide.",
        "educational": "Include examples and explanations. Build concepts progressively. Use questions to engage.",
        "sales": "Lead with benefits, include social proof points, end with clear call-to-action.",
        "creative": "Minimal text (max 3 bullets), focus on impactful statements, suggest visual elements."
    }
    
    style_guide = style_guides.get(style, style_guides["executive"])
    
    notes_instruction = """
For each slide, include speaker_notes with:
- Key talking points (2-3 sentences)
- Transition phrase to next slide
- Any data or examples to mention verbally""" if include_speaker_notes else ""
    
    lang_instruction = "Generate ALL content in Spanish." if language == "es" else "Generate ALL content in English."
    
    prompt = f"""Create a {num_slides}-slide presentation from the following content.

STYLE GUIDE: {style_guide}
LANGUAGE: {lang_instruction}
{notes_instruction}

Return a JSON array with this exact structure:
[
  {{
    "slide_number": 1,
    "title": "Slide Title",
    "subtitle": "Optional subtitle",
    "bullets": ["Point 1", "Point 2", "Point 3"],
    "speaker_notes": "Notes for presenter...",
    "visual_suggestion": "Suggestion for image or chart"
  }}
]

CONTENT TO TRANSFORM:
{content}

Return ONLY the JSON array, no other text."""

    try:
        llm = LlmChat(
            api_key=os.environ.get("EMERGENT_LLM_KEY"),
            session_id=f"dictation-cleanup-{uuid.uuid4()}",
            system_message="You are an expert editor who cleans up dictated text."
        )
        llm.with_model("gemini", "gemini-2.0-flash")
        
        response = await llm.send_message(UserMessage(text=prompt))
        
        response_text = response.content if hasattr(response, 'content') else str(response)
        
        # Parse JSON from response
        import json
        import re
        
        # Try to extract JSON array from response
        json_match = re.search(r'\[[\s\S]*\]', response_text)
        if json_match:
            slides = json.loads(json_match.group())
        else:
            raise ValueError("Could not parse slides from AI response")
        
        # Save to history
        await db.ai_content_history.insert_one({
            "id": str(uuid.uuid4()),
            "type": "slide_generation",
            "original_text": content[:500],
            "num_slides": len(slides),
            "style": style,
            "created_by": current_user.get("email"),
            "created_at": datetime.now(timezone.utc).isoformat()
        })
        
        return {
            "success": True,
            "num_slides": len(slides),
            "style": style,
            "slides": slides
        }
        
    except json.JSONDecodeError as e:
        raise HTTPException(status_code=500, detail=f"Failed to parse AI response: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI processing error: {str(e)}")


@router.post("/ai/generate-linkedin-post")
async def generate_linkedin_post(
    content: str,
    tone: str = "thought_leader",
    include_hashtags: bool = True,
    language: str = "es",  # es or en
    current_user: dict = Depends(get_current_user)
):
    """
    Generate a LinkedIn post from content.
    
    Tones:
    - thought_leader: Expert insights, industry trends
    - storytelling: Personal narrative, lessons learned
    - educational: Tips and how-to format
    - promotional: Product/service focused with CTA
    
    Languages:
    - es: Spanish
    - en: English
    """
    import os
    from emergentintegrations.llm.chat import LlmChat, UserMessage
    
    tone_guides = {
        "thought_leader": "Position as industry expert. Share unique insights. Ask provocative questions.",
        "storytelling": "Use first-person narrative. Include specific details. End with lesson/reflection.",
        "educational": "Start with a hook. Use numbered tips or steps. Make actionable.",
        "promotional": "Lead with problem/pain point. Present solution. Include clear CTA."
    }
    
    tone_guide = tone_guides.get(tone, tone_guides["thought_leader"])
    
    hashtag_instruction = "Include 3-5 relevant hashtags at the end." if include_hashtags else "Do not include hashtags."
    lang_instruction = "Write the ENTIRE post in Spanish." if language == "es" else "Write the ENTIRE post in English."
    
    prompt = f"""Create a LinkedIn post from the following content.

TONE: {tone_guide}
LANGUAGE: {lang_instruction}

LINKEDIN BEST PRACTICES:
- Hook in first line (will show in preview)
- Use line breaks for readability
- Keep under 1300 characters
- Use emojis sparingly (1-3 max)
- End with question or CTA to drive engagement
- {hashtag_instruction}

CONTENT:
{content}

Return ONLY the LinkedIn post text, ready to copy-paste."""

    try:
        llm = LlmChat(
            api_key=os.environ.get("EMERGENT_LLM_KEY"),
            session_id=f"dictation-cleanup-{uuid.uuid4()}",
            system_message="You are an expert editor who cleans up dictated text."
        )
        llm.with_model("gemini", "gemini-2.0-flash")
        
        response = await llm.send_message(UserMessage(text=prompt))
        
        post_text = response.content if hasattr(response, 'content') else str(response)
        
        return {
            "success": True,
            "character_count": len(post_text),
            "tone": tone,
            "post": post_text
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI processing error: {str(e)}")


@router.post("/ai/generate-blog-outline")
async def generate_blog_outline(
    topic: str,
    target_audience: str = "professionals",
    word_count_target: int = 1500,
    language: str = "es",  # es or en
    current_user: dict = Depends(get_current_user)
):
    """
    Generate a detailed blog post outline.
    
    Languages:
    - es: Spanish
    - en: English
    """
    import os
    from emergentintegrations.llm.chat import LlmChat, UserMessage
    
    lang_instruction = "Generate ALL content in Spanish." if language == "es" else "Generate ALL content in English."
    
    prompt = f"""Create a detailed blog post outline for the following:

TOPIC: {topic}
TARGET AUDIENCE: {target_audience}
TARGET WORD COUNT: {word_count_target} words
LANGUAGE: {lang_instruction}

Return a JSON object with this structure:
{{
  "title": "Compelling blog title",
  "meta_description": "SEO meta description (150-160 chars)",
  "target_keywords": ["keyword1", "keyword2", "keyword3"],
  "introduction": {{
    "hook": "Opening hook sentence",
    "context": "Brief context",
    "thesis": "Main argument/point"
  }},
  "sections": [
    {{
      "heading": "Section H2 heading",
      "subheadings": ["H3 subheading 1", "H3 subheading 2"],
      "key_points": ["Point 1", "Point 2"],
      "suggested_examples": "Example or case study to include"
    }}
  ],
  "conclusion": {{
    "summary": "Key takeaways",
    "cta": "Call to action"
  }},
  "estimated_sections_word_count": {{
    "intro": 150,
    "body": 1200,
    "conclusion": 150
  }}
}}

Return ONLY the JSON, no other text."""

    try:
        llm = LlmChat(
            api_key=os.environ.get("EMERGENT_LLM_KEY"),
            session_id=f"dictation-cleanup-{uuid.uuid4()}",
            system_message="You are an expert editor who cleans up dictated text."
        )
        llm.with_model("gemini", "gemini-2.0-flash")
        
        response = await llm.send_message(UserMessage(text=prompt))
        
        response_text = response.content if hasattr(response, 'content') else str(response)
        
        import json
        import re
        
        json_match = re.search(r'\{[\s\S]*\}', response_text)
        if json_match:
            outline = json.loads(json_match.group())
        else:
            raise ValueError("Could not parse outline from AI response")
        
        return {
            "success": True,
            "topic": topic,
            "outline": outline
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI processing error: {str(e)}")


# ============ iOS SHORTCUT WEBHOOK ============

class ShortcutCapture(BaseModel):
    """Model for iOS Shortcut content capture - saves to Content Matrix"""
    text: str  # Content or URL from shortcut
    title: Optional[str] = None
    competency_name: Optional[str] = None  # Competency name for matching
    competency_id: Optional[str] = None    # Direct competency ID if known
    level: Optional[int] = None            # 1-4
    source: Optional[str] = "ios_shortcut"

@router.post("/shortcut/capture", tags=["public"])
async def capture_from_shortcut(data: ShortcutCapture):
    """
    Public endpoint for iOS Shortcut content capture.
    Saves directly to content_items for Content Matrix integration.
    
    Usage in iOS Shortcut:
    POST to https://your-domain.com/api/content-flow/shortcut/capture
    Body: {
        "text": "content or URL",
        "title": "Title of content",
        "competency_name": "Comunicación Efectiva",  // OR competency_id
        "level": 2
    }
    """
    now = datetime.now(timezone.utc).isoformat()
    
    # Generate title from text if not provided
    title = data.title
    if not title:
        title = data.text[:50].strip()
        if len(data.text) > 50:
            title += "..."
    
    # Find competency and course
    course_id = None
    competency_id = data.competency_id
    
    if not competency_id and data.competency_name:
        # Match by name (case-insensitive)
        comp = await db.competencies.find_one({
            "name": {"$regex": f"^{data.competency_name}$", "$options": "i"}
        })
        if comp:
            competency_id = comp.get("id")
            course_id = comp.get("course_id")
    
    if competency_id and not course_id:
        # Get course_id from competency
        comp = await db.competencies.find_one({"id": competency_id})
        if comp:
            course_id = comp.get("course_id")
    
    # Determine if text is a URL
    is_url = data.text.startswith("http://") or data.text.startswith("https://")
    
    content_item = {
        "id": str(uuid.uuid4()),
        "title": title,
        "url": data.text if is_url else None,
        "dictation_draft_text": data.text if not is_url else f"Link: {data.text}",
        "course_id": course_id,
        "competency_id": competency_id,
        "level": data.level,
        "source": "ios_shortcut",
        "status": "draft",
        "tags": [],
        "notes": None,
        "created_at": now,
        "updated_at": now,
        "created_by": "ios_shortcut",
        "processing_state": {
            "cleaned": False,
            "blog_es_generated": False,
            "blog_en_generated": False,
            "slides_generated": False,
            "webinar_pending": False
        }
    }
    
    await db.content_items.insert_one(content_item)
    
    return {
        "success": True,
        "message": "Content saved to Content Matrix",
        "id": content_item["id"],
        "title": title,
        "course_id": course_id,
        "competency_id": competency_id,
        "level": data.level,
        "cell_assigned": bool(course_id and competency_id and data.level)
    }


@router.get("/shortcut/competencies", tags=["public"])
async def get_competencies_for_shortcut():
    """
    Get list of competencies for iOS Shortcut picker.
    Returns competency names grouped by course.
    """
    courses = await db.courses.find({}, {"_id": 0, "id": 1, "name": 1}).to_list(100)
    competencies = await db.competencies.find({}, {"_id": 0, "id": 1, "name": 1, "course_id": 1}).to_list(500)
    
    result = []
    for course in courses:
        course_comps = [c for c in competencies if c.get("course_id") == course.get("id")]
        result.append({
            "course": course.get("name"),
            "competencies": [{"id": c.get("id"), "name": c.get("name")} for c in course_comps]
        })
    
    return {"success": True, "data": result}


@router.get("/shortcut/competencies-flat", tags=["public"])
async def get_competencies_flat_for_shortcut():
    """
    Get flat list of competencies for iOS Shortcut picker.
    Format: "Course Name > Competency Name"
    """
    courses = await db.courses.find({}, {"_id": 0, "id": 1, "name": 1}).to_list(100)
    competencies = await db.competencies.find({}, {"_id": 0, "id": 1, "name": 1, "course_id": 1}).to_list(500)
    
    course_map = {c.get("id"): c.get("name") for c in courses}
    
    result = []
    for comp in competencies:
        course_name = course_map.get(comp.get("course_id"), "Sin curso")
        result.append({
            "display": f"{course_name} > {comp.get('name')}",
            "competency_name": comp.get("name"),
            "competency_id": comp.get("id"),
            "course_id": comp.get("course_id")
        })
    
    # Sort by display name
    result.sort(key=lambda x: x.get("display", ""))
    
    return {"success": True, "competencies": result}


@router.get("/shortcut/recent", tags=["public"])
async def get_recent_captures():
    """
    Get recent captures from iOS Shortcut (last 10).
    Public endpoint for verification in Shortcuts app.
    """
    captures = await db.content_flow.find(
        {"source": "ios_shortcut"},
        {"_id": 0, "id": 1, "name": 1, "capture_type": 1, "created_at": 1}
    ).sort("created_at", -1).limit(10).to_list(10)
    
    return {"success": True, "captures": captures}
