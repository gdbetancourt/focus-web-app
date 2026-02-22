"""
Quiz System Router - Lead Qualification & Self-Assessment
No AI required - Pure logic-based scoring
"""

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from datetime import datetime, timezone
import uuid

from database import db
from routers.auth import get_current_user

router = APIRouter(prefix="/quiz", tags=["quiz"])


# ============ Models ============

class QuizQuestion(BaseModel):
    id: Optional[str] = None
    text: str
    type: str = "single"  # single, multiple, scale, text
    options: List[Dict[str, Any]] = []  # {value, label, score}
    required: bool = True
    order: int = 0

class QuizCreate(BaseModel):
    title: str
    description: Optional[str] = ""
    type: str = "lead_qualification"  # lead_qualification, self_assessment, feedback
    questions: List[QuizQuestion] = []
    settings: Dict[str, Any] = {}
    is_public: bool = False
    slug: Optional[str] = None

class QuizUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    questions: Optional[List[QuizQuestion]] = None
    settings: Optional[Dict[str, Any]] = None
    is_public: Optional[bool] = None
    is_active: Optional[bool] = None

class QuizResponse(BaseModel):
    quiz_id: str
    answers: Dict[str, Any]  # question_id: answer
    respondent: Optional[Dict[str, str]] = None  # name, email, company

class ScoreRange(BaseModel):
    min_score: int
    max_score: int
    label: str
    description: str
    recommendation: Optional[str] = None


# ============ Quiz CRUD ============

@router.get("/quizzes")
async def list_quizzes(
    type: Optional[str] = None,
    is_active: Optional[bool] = True,
    current_user: dict = Depends(get_current_user)
):
    """List all quizzes"""
    query = {}
    if type:
        query["type"] = type
    if is_active is not None:
        query["is_active"] = is_active
    
    quizzes = await db.quizzes.find(query, {"_id": 0}).sort("created_at", -1).to_list(100)
    
    # Get response counts
    for quiz in quizzes:
        quiz["response_count"] = await db.quiz_responses.count_documents({"quiz_id": quiz["id"]})
    
    return {"success": True, "quizzes": quizzes}


@router.post("/quizzes")
async def create_quiz(
    quiz: QuizCreate,
    current_user: dict = Depends(get_current_user)
):
    """Create a new quiz"""
    quiz_dict = quiz.dict()
    quiz_dict["id"] = str(uuid.uuid4())
    quiz_dict["slug"] = quiz.slug or quiz_dict["id"][:8]
    quiz_dict["is_active"] = True
    quiz_dict["created_at"] = datetime.now(timezone.utc).isoformat()
    quiz_dict["created_by"] = current_user.get("email", "")
    
    # Generate IDs for questions
    for i, q in enumerate(quiz_dict["questions"]):
        if not q.get("id"):
            q["id"] = str(uuid.uuid4())[:8]
        q["order"] = i
    
    await db.quizzes.insert_one(quiz_dict)
    
    return {"success": True, "quiz": {k: v for k, v in quiz_dict.items() if k != "_id"}}


@router.get("/quizzes/{quiz_id}")
async def get_quiz(
    quiz_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get quiz by ID"""
    quiz = await db.quizzes.find_one(
        {"$or": [{"id": quiz_id}, {"slug": quiz_id}]},
        {"_id": 0}
    )
    
    if not quiz:
        raise HTTPException(status_code=404, detail="Quiz not found")
    
    return {"success": True, "quiz": quiz}


@router.put("/quizzes/{quiz_id}")
async def update_quiz(
    quiz_id: str,
    updates: QuizUpdate,
    current_user: dict = Depends(get_current_user)
):
    """Update a quiz"""
    update_dict = {k: v for k, v in updates.dict().items() if v is not None}
    update_dict["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    # Generate IDs for new questions
    if "questions" in update_dict:
        for i, q in enumerate(update_dict["questions"]):
            if not q.get("id"):
                q["id"] = str(uuid.uuid4())[:8]
            q["order"] = i
    
    result = await db.quizzes.update_one(
        {"id": quiz_id},
        {"$set": update_dict}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Quiz not found")
    
    updated = await db.quizzes.find_one({"id": quiz_id}, {"_id": 0})
    return {"success": True, "quiz": updated}


@router.delete("/quizzes/{quiz_id}")
async def delete_quiz(
    quiz_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Delete a quiz"""
    result = await db.quizzes.delete_one({"id": quiz_id})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Quiz not found")
    
    # Also delete responses
    await db.quiz_responses.delete_many({"quiz_id": quiz_id})
    
    return {"success": True, "message": "Quiz deleted"}


# ============ Public Quiz Access ============

@router.get("/public/{slug}")
async def get_public_quiz(slug: str):
    """Get a public quiz (no auth required)"""
    quiz = await db.quizzes.find_one(
        {"slug": slug, "is_public": True, "is_active": True},
        {"_id": 0, "created_by": 0}
    )
    
    if not quiz:
        raise HTTPException(status_code=404, detail="Quiz not found")
    
    # Remove scores from options for public view
    for q in quiz.get("questions", []):
        for opt in q.get("options", []):
            opt.pop("score", None)
    
    return {"success": True, "quiz": quiz}


# ============ Quiz Responses ============

@router.post("/respond")
async def submit_quiz_response(response: QuizResponse):
    """Submit a quiz response (public endpoint)"""
    # Get quiz
    quiz = await db.quizzes.find_one({"id": response.quiz_id}, {"_id": 0})
    
    if not quiz:
        raise HTTPException(status_code=404, detail="Quiz not found")
    
    if not quiz.get("is_active"):
        raise HTTPException(status_code=400, detail="Quiz is not active")
    
    # Calculate score
    total_score = 0
    max_score = 0
    question_scores = {}
    
    for question in quiz.get("questions", []):
        q_id = question["id"]
        answer = response.answers.get(q_id)
        
        if question["type"] == "single":
            # Find selected option and its score
            for opt in question.get("options", []):
                score = opt.get("score", 0)
                max_score += max(o.get("score", 0) for o in question.get("options", []))
                if opt["value"] == answer:
                    total_score += score
                    question_scores[q_id] = score
                    break
        
        elif question["type"] == "multiple":
            # Sum scores of selected options
            q_max = sum(o.get("score", 0) for o in question.get("options", []) if o.get("score", 0) > 0)
            max_score += q_max
            q_score = 0
            if isinstance(answer, list):
                for opt in question.get("options", []):
                    if opt["value"] in answer:
                        q_score += opt.get("score", 0)
            total_score += q_score
            question_scores[q_id] = q_score
        
        elif question["type"] == "scale":
            # Scale value is the score
            max_score += question.get("max_scale", 10)
            if answer is not None:
                total_score += int(answer)
                question_scores[q_id] = int(answer)
    
    # Calculate percentage
    percentage = round((total_score / max_score * 100), 1) if max_score > 0 else 0
    
    # Determine result category
    score_ranges = quiz.get("settings", {}).get("score_ranges", [])
    result_category = None
    
    for range_item in score_ranges:
        if range_item["min_score"] <= percentage <= range_item["max_score"]:
            result_category = {
                "label": range_item["label"],
                "description": range_item["description"],
                "recommendation": range_item.get("recommendation")
            }
            break
    
    # Save response
    response_dict = {
        "id": str(uuid.uuid4()),
        "quiz_id": response.quiz_id,
        "answers": response.answers,
        "respondent": response.respondent,
        "score": {
            "total": total_score,
            "max": max_score,
            "percentage": percentage,
            "by_question": question_scores
        },
        "result_category": result_category,
        "submitted_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.quiz_responses.insert_one(response_dict)
    
    # If respondent has email, create/update contact
    if response.respondent and response.respondent.get("email"):
        await db.unified_contacts.update_one(
            {"email": response.respondent["email"]},
            {
                "$set": {
                    "name": response.respondent.get("name", ""),
                    "company": response.respondent.get("company", ""),
                    "source": "quiz",
                    "quiz_score": percentage,
                    "quiz_category": result_category.get("label") if result_category else None,
                    "updated_at": datetime.now(timezone.utc).isoformat()
                },
                "$setOnInsert": {
                    "stage": 1,
                    "created_at": datetime.now(timezone.utc).isoformat()
                }
            },
            upsert=True
        )
    
    return {
        "success": True,
        "response_id": response_dict["id"],
        "score": response_dict["score"],
        "result": result_category
    }


@router.get("/quizzes/{quiz_id}/responses")
async def get_quiz_responses(
    quiz_id: str,
    limit: int = 50,
    current_user: dict = Depends(get_current_user)
):
    """Get responses for a quiz"""
    responses = await db.quiz_responses.find(
        {"quiz_id": quiz_id},
        {"_id": 0}
    ).sort("submitted_at", -1).to_list(limit)
    
    # Calculate stats
    total = len(responses)
    if total > 0:
        avg_score = sum(r.get("score", {}).get("percentage", 0) for r in responses) / total
        categories = {}
        for r in responses:
            cat = r.get("result_category", {}).get("label", "Unknown")
            categories[cat] = categories.get(cat, 0) + 1
    else:
        avg_score = 0
        categories = {}
    
    return {
        "success": True,
        "responses": responses,
        "stats": {
            "total": total,
            "average_score": round(avg_score, 1),
            "by_category": categories
        }
    }


@router.get("/responses/{response_id}")
async def get_response(
    response_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get a specific response"""
    response = await db.quiz_responses.find_one({"id": response_id}, {"_id": 0})
    
    if not response:
        raise HTTPException(status_code=404, detail="Response not found")
    
    return {"success": True, "response": response}


# ============ Quiz Templates ============

@router.get("/templates")
async def get_quiz_templates(current_user: dict = Depends(get_current_user)):
    """Get predefined quiz templates"""
    templates = [
        {
            "id": "lead_qualification",
            "title": "Calificación de Lead",
            "description": "Evalúa el potencial de un prospecto",
            "type": "lead_qualification",
            "questions": [
                {
                    "id": "budget",
                    "text": "¿Cuál es tu presupuesto aproximado para este tipo de solución?",
                    "type": "single",
                    "options": [
                        {"value": "under_5k", "label": "Menos de $5,000", "score": 1},
                        {"value": "5k_15k", "label": "$5,000 - $15,000", "score": 2},
                        {"value": "15k_50k", "label": "$15,000 - $50,000", "score": 3},
                        {"value": "over_50k", "label": "Más de $50,000", "score": 4}
                    ]
                },
                {
                    "id": "timeline",
                    "text": "¿En qué plazo necesitas implementar una solución?",
                    "type": "single",
                    "options": [
                        {"value": "immediate", "label": "Inmediatamente", "score": 4},
                        {"value": "1_3_months", "label": "1-3 meses", "score": 3},
                        {"value": "3_6_months", "label": "3-6 meses", "score": 2},
                        {"value": "exploring", "label": "Solo explorando", "score": 1}
                    ]
                },
                {
                    "id": "decision_maker",
                    "text": "¿Eres el tomador de decisión para este tipo de inversión?",
                    "type": "single",
                    "options": [
                        {"value": "yes", "label": "Sí, tengo autoridad completa", "score": 4},
                        {"value": "partial", "label": "Parcialmente, necesito aprobación", "score": 2},
                        {"value": "no", "label": "No, solo estoy investigando", "score": 1}
                    ]
                },
                {
                    "id": "pain_level",
                    "text": "¿Qué tan urgente es resolver tu problema actual?",
                    "type": "scale",
                    "options": [],
                    "max_scale": 10
                }
            ],
            "settings": {
                "score_ranges": [
                    {"min_score": 0, "max_score": 40, "label": "Frío", "description": "Lead en etapa temprana", "recommendation": "Nutrir con contenido educativo"},
                    {"min_score": 41, "max_score": 70, "label": "Tibio", "description": "Lead con potencial", "recommendation": "Programar llamada de descubrimiento"},
                    {"min_score": 71, "max_score": 100, "label": "Caliente", "description": "Lead listo para comprar", "recommendation": "Contactar inmediatamente para cerrar"}
                ]
            }
        },
        {
            "id": "self_assessment",
            "title": "Autoevaluación de Liderazgo",
            "description": "Evalúa tus habilidades de comunicación y liderazgo",
            "type": "self_assessment",
            "questions": [
                {
                    "id": "public_speaking",
                    "text": "¿Cómo te sientes al hablar en público?",
                    "type": "single",
                    "options": [
                        {"value": "terrified", "label": "Me aterroriza", "score": 1},
                        {"value": "nervous", "label": "Me pone nervioso", "score": 2},
                        {"value": "comfortable", "label": "Me siento cómodo", "score": 3},
                        {"value": "love_it", "label": "Lo disfruto mucho", "score": 4}
                    ]
                },
                {
                    "id": "storytelling",
                    "text": "¿Qué tan efectivo eres contando historias para persuadir?",
                    "type": "scale",
                    "options": [],
                    "max_scale": 10
                },
                {
                    "id": "executive_presence",
                    "text": "¿Cómo describirías tu presencia ejecutiva?",
                    "type": "single",
                    "options": [
                        {"value": "developing", "label": "En desarrollo", "score": 1},
                        {"value": "emerging", "label": "Emergente", "score": 2},
                        {"value": "established", "label": "Establecida", "score": 3},
                        {"value": "exceptional", "label": "Excepcional", "score": 4}
                    ]
                }
            ],
            "settings": {
                "score_ranges": [
                    {"min_score": 0, "max_score": 40, "label": "Principiante", "description": "Oportunidad de crecimiento significativo", "recommendation": "Programa básico de comunicación"},
                    {"min_score": 41, "max_score": 70, "label": "Intermedio", "description": "Buenos fundamentos, listo para avanzar", "recommendation": "Programa avanzado de liderazgo"},
                    {"min_score": 71, "max_score": 100, "label": "Avanzado", "description": "Excelentes habilidades de liderazgo", "recommendation": "Coaching ejecutivo personalizado"}
                ]
            }
        }
    ]
    
    return {"success": True, "templates": templates}


@router.post("/templates/{template_id}/create")
async def create_from_template(
    template_id: str,
    title: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Create a quiz from a template"""
    templates_response = await get_quiz_templates(current_user)
    templates = templates_response["templates"]
    
    template = next((t for t in templates if t["id"] == template_id), None)
    
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    
    quiz_data = QuizCreate(
        title=title or template["title"],
        description=template["description"],
        type=template["type"],
        questions=[QuizQuestion(**q) for q in template["questions"]],
        settings=template["settings"],
        is_public=False
    )
    
    return await create_quiz(quiz_data, current_user)
