"""
Medical Specialties and Medical Societies Router
Manages the list of medical specialties and medical societies with scraping capabilities
"""
from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, Form, BackgroundTasks
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime, timezone
import uuid
import os

from database import db
from routers.auth import get_current_user

router = APIRouter(prefix="/medical", tags=["medical"])

# ============ MODELS ============

class MedicalSpecialtyCreate(BaseModel):
    name: str
    description: Optional[str] = None

class MedicalSpecialtyUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None

class BulkSpecialtiesCreate(BaseModel):
    specialties: List[str]  # List of specialty names

class MergeSpecialtiesRequest(BaseModel):
    source_ids: List[str]  # IDs to merge from
    target_id: str  # ID to merge into

class MedicalSocietyCreate(BaseModel):
    name: str
    website: str
    specialties: List[str] = []  # List of specialty IDs or names
    scrape_frequency: str = "monthly"  # daily, weekly, monthly
    notes: Optional[str] = None

class MedicalSocietyUpdate(BaseModel):
    name: Optional[str] = None
    website: Optional[str] = None
    specialties: Optional[List[str]] = None
    scrape_frequency: Optional[str] = None
    notes: Optional[str] = None

# ============ MEDICAL SPECIALTIES ============

# Pre-populated list of common medical specialties
DEFAULT_SPECIALTIES = [
    "Allergy and Immunology",
    "Anesthesiology",
    "Cardiology",
    "Dermatology",
    "Emergency Medicine",
    "Endocrinology",
    "Family Medicine",
    "Gastroenterology",
    "General Surgery",
    "Geriatrics",
    "Hematology",
    "Infectious Disease",
    "Internal Medicine",
    "Nephrology",
    "Neurology",
    "Neurosurgery",
    "Obstetrics and Gynecology",
    "Oncology",
    "Ophthalmology",
    "Orthopedics",
    "Otolaryngology (ENT)",
    "Pathology",
    "Pediatrics",
    "Physical Medicine and Rehabilitation",
    "Plastic Surgery",
    "Psychiatry",
    "Pulmonology",
    "Radiology",
    "Rheumatology",
    "Thoracic Surgery",
    "Urology",
    "Vascular Surgery"
]


@router.get("/specialties")
async def get_specialties(current_user: dict = Depends(get_current_user)):
    """Get all medical specialties"""
    specialties = await db.medical_specialties.find(
        {}, {"_id": 0}
    ).sort("name", 1).to_list(1000)
    return {"specialties": specialties, "count": len(specialties)}


@router.get("/specialties/public")
async def get_specialties_public():
    """Get all medical specialties (public - no auth required)"""
    specialties = await db.medical_specialties.find(
        {}, {"_id": 0, "id": 1, "name": 1}
    ).sort("name", 1).to_list(1000)
    return {"specialties": specialties, "count": len(specialties)}


@router.post("/specialties")
async def create_specialty(
    specialty: MedicalSpecialtyCreate,
    current_user: dict = Depends(get_current_user)
):
    """Create a new medical specialty"""
    # Check if already exists
    existing = await db.medical_specialties.find_one(
        {"name": {"$regex": f"^{specialty.name}$", "$options": "i"}}
    )
    if existing:
        raise HTTPException(status_code=400, detail="Specialty already exists")
    
    new_specialty = {
        "id": str(uuid.uuid4()),
        "name": specialty.name,
        "description": specialty.description,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "source": "manual"
    }
    
    await db.medical_specialties.insert_one(new_specialty)
    return {"success": True, "specialty": {k: v for k, v in new_specialty.items() if k != "_id"}}


@router.post("/specialties/bulk")
async def create_specialties_bulk(
    data: BulkSpecialtiesCreate,
    current_user: dict = Depends(get_current_user)
):
    """Create multiple specialties at once (for copy-paste)"""
    created = []
    skipped = []
    
    for name in data.specialties:
        name = name.strip()
        if not name:
            continue
            
        # Check if exists
        existing = await db.medical_specialties.find_one(
            {"name": {"$regex": f"^{name}$", "$options": "i"}}
        )
        if existing:
            skipped.append(name)
            continue
        
        new_specialty = {
            "id": str(uuid.uuid4()),
            "name": name,
            "description": None,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "source": "bulk_import"
        }
        await db.medical_specialties.insert_one(new_specialty)
        created.append(name)
    
    return {
        "success": True,
        "created": created,
        "created_count": len(created),
        "skipped": skipped,
        "skipped_count": len(skipped)
    }


@router.post("/specialties/initialize")
async def initialize_default_specialties(
    current_user: dict = Depends(get_current_user)
):
    """Initialize the database with default specialties"""
    created = []
    skipped = []
    
    for name in DEFAULT_SPECIALTIES:
        existing = await db.medical_specialties.find_one(
            {"name": {"$regex": f"^{name}$", "$options": "i"}}
        )
        if existing:
            skipped.append(name)
            continue
        
        new_specialty = {
            "id": str(uuid.uuid4()),
            "name": name,
            "description": None,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "source": "default"
        }
        await db.medical_specialties.insert_one(new_specialty)
        created.append(name)
    
    return {
        "success": True,
        "message": f"Initialized {len(created)} specialties, {len(skipped)} already existed",
        "created": created,
        "skipped": skipped
    }


@router.put("/specialties/{specialty_id}")
async def update_specialty(
    specialty_id: str,
    update: MedicalSpecialtyUpdate,
    current_user: dict = Depends(get_current_user)
):
    """Update a medical specialty"""
    update_data = {k: v for k, v in update.dict().items() if v is not None}
    if not update_data:
        raise HTTPException(status_code=400, detail="No update data provided")
    
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    result = await db.medical_specialties.update_one(
        {"id": specialty_id},
        {"$set": update_data}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Specialty not found")
    
    return {"success": True}


@router.delete("/specialties/{specialty_id}")
async def delete_specialty(
    specialty_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Delete a medical specialty"""
    result = await db.medical_specialties.delete_one({"id": specialty_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Specialty not found")
    
    return {"success": True}


@router.post("/specialties/merge")
async def merge_specialties(
    merge_request: MergeSpecialtiesRequest,
    current_user: dict = Depends(get_current_user)
):
    """Merge multiple specialties into one"""
    # Get target specialty
    target = await db.medical_specialties.find_one({"id": merge_request.target_id})
    if not target:
        raise HTTPException(status_code=404, detail="Target specialty not found")
    
    # Get source specialties
    sources = await db.medical_specialties.find(
        {"id": {"$in": merge_request.source_ids}}
    ).to_list(100)
    
    source_names = [s["name"] for s in sources]
    
    # Update all contacts, societies, etc. that reference the source specialties
    # Update contacts
    for source in sources:
        await db.unified_contacts.update_many(
            {"specialty": source["name"]},
            {"$set": {"specialty": target["name"]}}
        )
        # Update medical societies
        await db.medical_societies.update_many(
            {"specialties": source["id"]},
            {"$set": {"specialties.$": merge_request.target_id}}
        )
    
    # Delete source specialties
    await db.medical_specialties.delete_many(
        {"id": {"$in": merge_request.source_ids}}
    )
    
    return {
        "success": True,
        "merged_into": target["name"],
        "merged_from": source_names,
        "count": len(sources)
    }


# ============ MEDICAL SOCIETIES ============

@router.get("/societies")
async def get_societies(current_user: dict = Depends(get_current_user)):
    """Get all medical societies with scraping status"""
    societies = await db.medical_societies.find(
        {}, {"_id": 0}
    ).sort("name", 1).to_list(1000)
    
    # Calculate traffic light status
    total = len(societies)
    scraped = sum(1 for s in societies if s.get("last_scrape_status") == "success")
    failed = sum(1 for s in societies if s.get("last_scrape_status") == "failed")
    pending = total - scraped - failed
    
    traffic_light = "green" if failed == 0 and pending == 0 and total > 0 else "red"
    
    return {
        "societies": societies,
        "count": total,
        "traffic_light": traffic_light,
        "stats": {
            "scraped": scraped,
            "failed": failed,
            "pending": pending
        }
    }


@router.post("/societies")
async def create_society(
    society: MedicalSocietyCreate,
    current_user: dict = Depends(get_current_user)
):
    """Create a new medical society"""
    new_society = {
        "id": str(uuid.uuid4()),
        "name": society.name,
        "website": society.website,
        "specialties": society.specialties,
        "scrape_frequency": society.scrape_frequency,
        "notes": society.notes,
        "last_scrape_date": None,
        "last_scrape_status": "pending",  # pending, success, failed
        "last_scrape_error": None,
        "events_found": 0,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.medical_societies.insert_one(new_society)
    return {"success": True, "society": {k: v for k, v in new_society.items() if k != "_id"}}


@router.put("/societies/{society_id}")
async def update_society(
    society_id: str,
    update: MedicalSocietyUpdate,
    current_user: dict = Depends(get_current_user)
):
    """Update a medical society"""
    update_data = {k: v for k, v in update.dict().items() if v is not None}
    if not update_data:
        raise HTTPException(status_code=400, detail="No update data provided")
    
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    result = await db.medical_societies.update_one(
        {"id": society_id},
        {"$set": update_data}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Society not found")
    
    return {"success": True}


@router.delete("/societies/{society_id}")
async def delete_society(
    society_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Delete a medical society"""
    result = await db.medical_societies.delete_one({"id": society_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Society not found")
    
    return {"success": True}


@router.post("/societies/{society_id}/upload-manual")
async def upload_manual_info(
    society_id: str,
    background_tasks: BackgroundTasks,
    file: UploadFile = File(None),
    text_content: str = Form(None),
    current_user: dict = Depends(get_current_user)
):
    """Upload manual info when scraping fails (PDF, image, or text)"""
    from services.medical_scraper import extract_info_from_text
    
    society = await db.medical_societies.find_one({"id": society_id})
    if not society:
        raise HTTPException(status_code=404, detail="Society not found")
    
    # Store the manual upload info
    upload_info = {
        "uploaded_at": datetime.now(timezone.utc).isoformat(),
        "uploaded_by": current_user.get("email"),
        "type": None,
        "content": None,
        "file_path": None
    }
    
    extracted_content = None
    
    if text_content:
        upload_info["type"] = "text"
        upload_info["content"] = text_content
        extracted_content = text_content
    elif file:
        # Save file
        upload_dir = "/app/backend/static/society_uploads"
        os.makedirs(upload_dir, exist_ok=True)
        
        ext = file.filename.split(".")[-1].lower()
        file_path = f"{upload_dir}/{society_id}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.{ext}"
        
        with open(file_path, "wb") as f:
            content = await file.read()
            f.write(content)
        
        upload_info["type"] = "pdf" if ext == "pdf" else "image"
        upload_info["file_path"] = file_path
        upload_info["filename"] = file.filename
    
    # Update society with manual upload
    await db.medical_societies.update_one(
        {"id": society_id},
        {
            "$set": {
                "manual_upload": upload_info,
                "last_scrape_status": "processing",
                "updated_at": datetime.now(timezone.utc).isoformat()
            }
        }
    )
    
    # If text content, process with Gemini in background
    if extracted_content:
        background_tasks.add_task(
            process_manual_upload,
            society_id,
            society.get("name", "Unknown"),
            extracted_content
        )
    else:
        # For files, mark as manual (can't process without PDF parser)
        await db.medical_societies.update_one(
            {"id": society_id},
            {"$set": {"last_scrape_status": "manual"}}
        )
    
    return {"success": True, "upload_info": upload_info}


async def process_manual_upload(society_id: str, society_name: str, text_content: str):
    """Process manual text upload with Gemini"""
    from services.medical_scraper import extract_info_from_text
    
    try:
        result = await extract_info_from_text(text_content, f"medical society {society_name}")
        
        if not result.get("success"):
            await db.medical_societies.update_one(
                {"id": society_id},
                {"$set": {"last_scrape_status": "manual"}}
            )
            return
        
        events = result.get("events", [])
        specialties_detected = result.get("specialties_detected", [])
        
        # Create events
        events_created = 0
        for event_data in events:
            try:
                new_event = {
                    "id": str(uuid.uuid4()),
                    "name": event_data.get("name", "Unnamed Event"),
                    "society_id": society_id,
                    "society_name": society_name,
                    "date_start": event_data.get("date_start"),
                    "date_end": event_data.get("date_end"),
                    "location": event_data.get("location"),
                    "description": event_data.get("description"),
                    "url": event_data.get("url"),
                    "event_type": event_data.get("type", "conference"),
                    "source": "manual_upload",
                    "created_at": datetime.now(timezone.utc).isoformat()
                }
                await db.medical_society_events.insert_one(new_event)
                events_created += 1
            except Exception as e:
                print(f"Error creating event: {e}")
        
        # Auto-create specialties
        for specialty_name in specialties_detected:
            existing = await db.medical_specialties.find_one(
                {"name": {"$regex": f"^{specialty_name}$", "$options": "i"}}
            )
            if not existing:
                await db.medical_specialties.insert_one({
                    "id": str(uuid.uuid4()),
                    "name": specialty_name,
                    "description": f"Auto-detected from {society_name} manual upload",
                    "created_at": datetime.now(timezone.utc).isoformat(),
                    "source": "manual_upload"
                })
        
        await db.medical_societies.update_one(
            {"id": society_id},
            {
                "$set": {
                    "last_scrape_status": "manual",
                    "events_found": events_created,
                    "extraction_info": result.get("key_information", "")
                }
            }
        )
        
    except Exception as e:
        print(f"Error processing manual upload: {e}")
        await db.medical_societies.update_one(
            {"id": society_id},
            {"$set": {"last_scrape_status": "manual"}}
        )


@router.post("/societies/{society_id}/scrape")
async def trigger_society_scrape(
    society_id: str,
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(get_current_user)
):
    """Manually trigger a scrape for a society"""
    society = await db.medical_societies.find_one({"id": society_id})
    if not society:
        raise HTTPException(status_code=404, detail="Society not found")
    
    # Mark as scraping
    await db.medical_societies.update_one(
        {"id": society_id},
        {"$set": {"last_scrape_status": "scraping"}}
    )
    
    # Add to background tasks
    background_tasks.add_task(
        scrape_society_website, 
        society_id, 
        society["website"],
        society.get("name", "Unknown")
    )
    
    return {"success": True, "message": "Scrape started in background"}


async def scrape_society_website(society_id: str, website: str, society_name: str):
    """Background task to scrape a medical society website for events using Gemini"""
    from services.medical_scraper import extract_events_from_website
    
    try:
        # Use Gemini to extract events
        result = await extract_events_from_website(website, society_name)
        
        if not result.get("success"):
            await db.medical_societies.update_one(
                {"id": society_id},
                {
                    "$set": {
                        "last_scrape_date": datetime.now(timezone.utc).isoformat(),
                        "last_scrape_status": "failed",
                        "last_scrape_error": result.get("error", "Unknown error")
                    }
                }
            )
            return
        
        events = result.get("events", [])
        specialties_detected = result.get("specialties_detected", [])
        
        # Create events in 2.2.8 Medical Society Events
        events_created = 0
        for event_data in events:
            try:
                new_event = {
                    "id": str(uuid.uuid4()),
                    "name": event_data.get("name", "Unnamed Event"),
                    "society_id": society_id,
                    "society_name": society_name,
                    "date_start": event_data.get("date_start"),
                    "date_end": event_data.get("date_end"),
                    "location": event_data.get("location"),
                    "description": event_data.get("description"),
                    "url": event_data.get("url"),
                    "event_type": event_data.get("type", "conference"),
                    "source": "scrape",
                    "created_at": datetime.now(timezone.utc).isoformat()
                }
                await db.medical_society_events.insert_one(new_event)
                events_created += 1
            except Exception as e:
                print(f"Error creating event: {e}")
        
        # Auto-create new specialties if detected
        for specialty_name in specialties_detected:
            existing = await db.medical_specialties.find_one(
                {"name": {"$regex": f"^{specialty_name}$", "$options": "i"}}
            )
            if not existing:
                new_specialty = {
                    "id": str(uuid.uuid4()),
                    "name": specialty_name,
                    "description": f"Auto-detected from {society_name}",
                    "created_at": datetime.now(timezone.utc).isoformat(),
                    "source": "scraping"
                }
                await db.medical_specialties.insert_one(new_specialty)
        
        # Update society status
        await db.medical_societies.update_one(
            {"id": society_id},
            {
                "$set": {
                    "last_scrape_date": datetime.now(timezone.utc).isoformat(),
                    "last_scrape_status": "success",
                    "last_scrape_error": None,
                    "events_found": events_created,
                    "scrape_notes": result.get("scrape_notes", "")
                }
            }
        )
        
    except Exception as e:
        await db.medical_societies.update_one(
            {"id": society_id},
            {
                "$set": {
                    "last_scrape_date": datetime.now(timezone.utc).isoformat(),
                    "last_scrape_status": "failed",
                    "last_scrape_error": str(e)
                }
            }
        )


# ============ TRAFFIC LIGHT STATUS ============

@router.get("/traffic-light")
async def get_medical_traffic_light(current_user: dict = Depends(get_current_user)):
    """Get traffic light status for both pharma and medical societies"""
    # Medical societies
    societies = await db.medical_societies.find({}, {"last_scrape_status": 1}).to_list(1000)
    societies_total = len(societies)
    societies_ok = sum(1 for s in societies if s.get("last_scrape_status") in ["success", "manual"])
    
    # Pharma pipelines (assuming similar structure)
    pharma = await db.pharma_pipelines.find({}, {"last_scrape_status": 1}).to_list(1000)
    pharma_total = len(pharma)
    pharma_ok = sum(1 for p in pharma if p.get("last_scrape_status") in ["success", "manual"])
    
    return {
        "medical_societies": {
            "status": "green" if societies_ok == societies_total and societies_total > 0 else "red",
            "total": societies_total,
            "ok": societies_ok
        },
        "pharma_pipelines": {
            "status": "green" if pharma_ok == pharma_total and pharma_total > 0 else "red",
            "total": pharma_total,
            "ok": pharma_ok
        }
    }



# ============ MEDICAL SOCIETY EVENTS (2.2.8) ============

@router.get("/society-events")
async def get_society_events(
    society_id: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Get all events from medical societies"""
    query = {}
    if society_id:
        query["society_id"] = society_id
    
    events = await db.medical_society_events.find(
        query, {"_id": 0}
    ).sort("date_start", -1).to_list(500)
    
    return {"events": events, "count": len(events)}


@router.delete("/society-events/{event_id}")
async def delete_society_event(
    event_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Delete a medical society event"""
    result = await db.medical_society_events.delete_one({"id": event_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Event not found")
    return {"success": True}
