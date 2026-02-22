"""
Video Processing Router - Content Pipeline Phase 3
Handles video transcription with OpenAI Whisper and editing suggestions
Alternative to Descript for video processing workflow
"""

from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, Form
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timezone
import os
import tempfile
import uuid
import logging
import subprocess

from database import db
from routers.auth import get_current_user

# Whisper imports
from emergentintegrations.llm.openai import OpenAISpeechToText
from emergentintegrations.llm.chat import LlmChat
from dotenv import load_dotenv

load_dotenv()

router = APIRouter(prefix="/video-processing", tags=["video-processing"])
logger = logging.getLogger(__name__)

# Models
class TranscriptionResponse(BaseModel):
    id: str
    text: str
    segments: Optional[List[dict]] = None
    duration: Optional[float] = None
    language: Optional[str] = None


class EditingSuggestion(BaseModel):
    type: str  # cut, highlight, title_card, transition
    start_time: float
    end_time: float
    reason: str
    suggestion: str


class VideoAnalysis(BaseModel):
    transcription_id: str
    key_moments: List[dict]
    suggested_clips: List[dict]
    editing_suggestions: List[EditingSuggestion]
    content_summary: str


# Helper function to extract audio from video
def extract_audio_from_video(video_path: str, output_path: str) -> bool:
    """Extract audio from video file using ffmpeg"""
    try:
        cmd = [
            "ffmpeg", "-i", video_path,
            "-vn", "-acodec", "libmp3lame",
            "-ab", "192k", "-ar", "44100",
            "-y", output_path
        ]
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=300)
        return result.returncode == 0
    except Exception as e:
        logger.error(f"Audio extraction error: {e}")
        return False


@router.post("/transcribe")
async def transcribe_video(
    file: UploadFile = File(...),
    language: Optional[str] = Form("es"),  # Spanish by default
    include_timestamps: bool = Form(True),
    current_user: dict = Depends(get_current_user)
):
    """
    Transcribe uploaded video/audio file using OpenAI Whisper.
    Supports: mp3, mp4, mpeg, mpga, m4a, wav, webm (max 25MB)
    """
    # Validate file type
    allowed_extensions = ["mp3", "mp4", "mpeg", "mpga", "m4a", "wav", "webm", "mov"]
    file_ext = file.filename.split(".")[-1].lower() if file.filename else ""
    
    if file_ext not in allowed_extensions:
        raise HTTPException(
            status_code=400, 
            detail=f"Unsupported file format. Allowed: {', '.join(allowed_extensions)}"
        )
    
    # Check file size (25MB limit)
    content = await file.read()
    if len(content) > 25 * 1024 * 1024:
        raise HTTPException(
            status_code=400,
            detail="File too large. Maximum size is 25MB. Please split the file into smaller parts."
        )
    
    try:
        # Save to temp file
        with tempfile.NamedTemporaryFile(delete=False, suffix=f".{file_ext}") as tmp:
            tmp.write(content)
            tmp_path = tmp.name
        
        audio_path = tmp_path
        
        # If video, extract audio first
        if file_ext in ["mp4", "mov", "mpeg", "webm"]:
            audio_path = tmp_path.replace(f".{file_ext}", ".mp3")
            if not extract_audio_from_video(tmp_path, audio_path):
                # Try direct transcription if ffmpeg fails
                audio_path = tmp_path
        
        # Initialize Whisper
        api_key = os.environ.get("EMERGENT_LLM_KEY")
        if not api_key:
            raise HTTPException(status_code=500, detail="EMERGENT_LLM_KEY not configured")
        
        stt = OpenAISpeechToText(api_key=api_key)
        
        # Transcribe
        with open(audio_path, "rb") as audio_file:
            response_format = "verbose_json" if include_timestamps else "json"
            
            response = await stt.transcribe(
                file=audio_file,
                model="whisper-1",
                response_format=response_format,
                language=language,
                timestamp_granularities=["segment"] if include_timestamps else None
            )
        
        # Clean up temp files
        try:
            os.unlink(tmp_path)
            if audio_path != tmp_path:
                os.unlink(audio_path)
        except:
            pass
        
        # Prepare response
        transcription_id = str(uuid.uuid4())
        
        result = {
            "id": transcription_id,
            "text": response.text,
            "segments": None,
            "duration": None,
            "language": language
        }
        
        # Add segments if available
        if hasattr(response, "segments") and response.segments:
            result["segments"] = [
                {
                    "start": seg.start,
                    "end": seg.end,
                    "text": seg.text
                }
                for seg in response.segments
            ]
            # Calculate duration from last segment
            if result["segments"]:
                result["duration"] = result["segments"][-1]["end"]
        
        # Save to database
        await db.video_transcriptions.insert_one({
            "id": transcription_id,
            "user_id": str(current_user.get("_id") or current_user.get("id", "")),
            "filename": file.filename,
            "text": result["text"],
            "segments": result["segments"],
            "duration": result["duration"],
            "language": language,
            "created_at": datetime.now(timezone.utc).isoformat()
        })
        
        return {"success": True, "transcription": result}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Transcription error: {e}")
        raise HTTPException(status_code=500, detail=f"Transcription failed: {str(e)}")


@router.post("/analyze")
async def analyze_video_content(
    transcription_id: str = Form(...),
    generate_clips: bool = Form(True),
    current_user: dict = Depends(get_current_user)
):
    """
    Analyze transcribed video to suggest:
    - Key moments / highlights
    - Potential clips for social media
    - Editing suggestions (cuts, transitions)
    - Content summary
    """
    # Get transcription
    transcription = await db.video_transcriptions.find_one(
        {"id": transcription_id, "user_id": str(current_user.get("_id") or current_user.get("id", ""))}
    )
    
    if not transcription:
        raise HTTPException(status_code=404, detail="Transcription not found")
    
    try:
        api_key = os.environ.get("EMERGENT_LLM_KEY")
        if not api_key:
            raise HTTPException(status_code=500, detail="EMERGENT_LLM_KEY not configured")
        
        # Prepare prompt with transcription
        segments_text = ""
        if transcription.get("segments"):
            segments_text = "\n".join([
                f"[{seg['start']:.1f}s - {seg['end']:.1f}s] {seg['text']}"
                for seg in transcription["segments"]
            ])
        else:
            segments_text = transcription.get("text", "")
        
        prompt = f"""Analiza esta transcripción de video y proporciona:

1. **Resumen del contenido** (2-3 oraciones)

2. **Momentos clave** - Lista los 3-5 momentos más importantes con timestamps (si están disponibles)

3. **Clips sugeridos para redes sociales** - Identifica 2-3 segmentos que funcionarían bien como clips cortos (30-60 segundos) para LinkedIn, Instagram o TikTok

4. **Sugerencias de edición**:
   - Partes que podrían cortarse (muletillas, repeticiones, silencios largos)
   - Momentos que necesitan transiciones o efectos
   - Sugerencias para mejorar el ritmo del video

TRANSCRIPCIÓN:
{segments_text[:8000]}

Responde en formato JSON estructurado:
{{
    "summary": "...",
    "key_moments": [
        {{"time": "0:30", "description": "...", "importance": "high/medium"}}
    ],
    "suggested_clips": [
        {{"start": "1:00", "end": "1:45", "title": "...", "platform": "linkedin/instagram/tiktok", "hook": "..."}}
    ],
    "editing_suggestions": [
        {{"type": "cut/transition/highlight", "time": "2:30", "reason": "...", "suggestion": "..."}}
    ]
}}"""

        llm = LlmChat(api_key=api_key).with_model("gemini/gemini-2.0-flash")
        
        response = await llm.send_async(prompt)
        
        # Parse JSON from response
        import json
        import re
        
        # Extract JSON from response
        json_match = re.search(r'\{[\s\S]*\}', response)
        if json_match:
            analysis = json.loads(json_match.group())
        else:
            analysis = {
                "summary": response,
                "key_moments": [],
                "suggested_clips": [],
                "editing_suggestions": []
            }
        
        # Save analysis
        analysis_id = str(uuid.uuid4())
        await db.video_analyses.insert_one({
            "id": analysis_id,
            "transcription_id": transcription_id,
            "user_id": str(current_user.get("_id") or current_user.get("id", "")),
            "analysis": analysis,
            "created_at": datetime.now(timezone.utc).isoformat()
        })
        
        return {
            "success": True,
            "analysis_id": analysis_id,
            "analysis": analysis
        }
        
    except HTTPException:
        raise
    except json.JSONDecodeError as e:
        logger.error(f"JSON parse error: {e}")
        return {
            "success": True,
            "analysis_id": str(uuid.uuid4()),
            "analysis": {
                "summary": "Error parsing AI response. Raw response saved.",
                "key_moments": [],
                "suggested_clips": [],
                "editing_suggestions": [],
                "raw_response": response if 'response' in dir() else ""
            }
        }
    except Exception as e:
        logger.error(f"Analysis error: {e}")
        raise HTTPException(status_code=500, detail=f"Analysis failed: {str(e)}")


@router.get("/transcriptions")
async def list_transcriptions(
    limit: int = 20,
    current_user: dict = Depends(get_current_user)
):
    """List user's video transcriptions"""
    user_id = str(current_user.get("_id") or current_user.get("id", ""))
    
    transcriptions = await db.video_transcriptions.find(
        {"user_id": user_id},
        {"_id": 0, "text": 0, "segments": 0}  # Exclude large fields
    ).sort("created_at", -1).to_list(limit)
    
    return {"success": True, "transcriptions": transcriptions}


@router.get("/transcriptions/{transcription_id}")
async def get_transcription(
    transcription_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get a specific transcription with full details"""
    transcription = await db.video_transcriptions.find_one(
        {"id": transcription_id, "user_id": str(current_user.get("_id") or current_user.get("id", ""))},
        {"_id": 0}
    )
    
    if not transcription:
        raise HTTPException(status_code=404, detail="Transcription not found")
    
    # Also get any analysis if exists
    analysis = await db.video_analyses.find_one(
        {"transcription_id": transcription_id},
        {"_id": 0}
    )
    
    return {
        "success": True,
        "transcription": transcription,
        "analysis": analysis
    }


@router.post("/generate-script")
async def generate_script_from_transcription(
    transcription_id: str = Form(...),
    style: str = Form("professional"),  # professional, casual, educational
    target_duration: str = Form("same"),  # same, shorter, longer
    current_user: dict = Depends(get_current_user)
):
    """
    Generate a polished script from raw transcription.
    Useful for creating a clean version of a dictated video.
    """
    # Get transcription
    transcription = await db.video_transcriptions.find_one(
        {"id": transcription_id, "user_id": str(current_user.get("_id") or current_user.get("id", ""))}
    )
    
    if not transcription:
        raise HTTPException(status_code=404, detail="Transcription not found")
    
    try:
        api_key = os.environ.get("EMERGENT_LLM_KEY")
        if not api_key:
            raise HTTPException(status_code=500, detail="EMERGENT_LLM_KEY not configured")
        
        duration_instruction = ""
        if target_duration == "shorter":
            duration_instruction = "Condensa el contenido para que sea más breve y directo."
        elif target_duration == "longer":
            duration_instruction = "Expande el contenido con ejemplos y explicaciones adicionales."
        
        style_instruction = ""
        if style == "casual":
            style_instruction = "Usa un tono conversacional y cercano."
        elif style == "educational":
            style_instruction = "Usa un tono didáctico con estructura clara."
        else:
            style_instruction = "Usa un tono profesional y autorizado."
        
        prompt = f"""Transforma esta transcripción de video en un guión limpio y profesional.

INSTRUCCIONES:
- {style_instruction}
- {duration_instruction}
- Elimina muletillas, repeticiones y pausas
- Mejora la estructura y fluidez
- Mantén el mensaje y personalidad original
- Divide en secciones con marcadores de tiempo aproximados

TRANSCRIPCIÓN ORIGINAL:
{transcription.get('text', '')[:6000]}

Responde con el guión mejorado, estructurado en secciones."""

        llm = LlmChat(api_key=api_key).with_model("gemini/gemini-2.0-flash")
        
        script = await llm.send_async(prompt)
        
        # Save generated script
        script_id = str(uuid.uuid4())
        await db.generated_scripts.insert_one({
            "id": script_id,
            "transcription_id": transcription_id,
            "user_id": str(current_user.get("_id") or current_user.get("id", "")),
            "style": style,
            "target_duration": target_duration,
            "script": script,
            "created_at": datetime.now(timezone.utc).isoformat()
        })
        
        return {
            "success": True,
            "script_id": script_id,
            "script": script
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Script generation error: {e}")
        raise HTTPException(status_code=500, detail=f"Script generation failed: {str(e)}")


@router.delete("/transcriptions/{transcription_id}")
async def delete_transcription(
    transcription_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Delete a transcription and its analysis"""
    result = await db.video_transcriptions.delete_one(
        {"id": transcription_id, "user_id": str(current_user.get("_id") or current_user.get("id", ""))}
    )
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Transcription not found")
    
    # Also delete related analysis
    await db.video_analyses.delete_many({"transcription_id": transcription_id})
    await db.generated_scripts.delete_many({"transcription_id": transcription_id})
    
    return {"success": True, "message": "Transcription deleted"}



# ============ VIDEO EDITING ENDPOINTS ============

class ClipRequest(BaseModel):
    start_time: float  # in seconds
    end_time: float  # in seconds
    output_name: Optional[str] = None


class TrimRequest(BaseModel):
    start_time: float
    end_time: float


@router.post("/edit/extract-clip")
async def extract_video_clip(
    file: UploadFile = File(...),
    start_time: float = Form(...),
    end_time: float = Form(...),
    output_name: Optional[str] = Form(None),
    current_user: dict = Depends(get_current_user)
):
    """
    Extract a clip from a video file using FFmpeg.
    Returns the clip as a downloadable file.
    """
    if end_time <= start_time:
        raise HTTPException(status_code=400, detail="end_time must be greater than start_time")
    
    if (end_time - start_time) > 300:  # 5 minutes max
        raise HTTPException(status_code=400, detail="Clip duration cannot exceed 5 minutes")
    
    # Validate file type
    allowed_extensions = ["mp4", "mov", "mpeg", "webm", "avi"]
    file_ext = file.filename.split(".")[-1].lower() if file.filename else ""
    
    if file_ext not in allowed_extensions:
        raise HTTPException(
            status_code=400, 
            detail=f"Unsupported video format. Allowed: {', '.join(allowed_extensions)}"
        )
    
    try:
        # Save uploaded file
        content = await file.read()
        if len(content) > 500 * 1024 * 1024:  # 500MB limit
            raise HTTPException(status_code=400, detail="File too large. Maximum size is 500MB")
        
        with tempfile.NamedTemporaryFile(delete=False, suffix=f".{file_ext}") as tmp:
            tmp.write(content)
            input_path = tmp.name
        
        # Generate output path
        output_filename = output_name or f"clip_{start_time}_{end_time}"
        output_path = tempfile.NamedTemporaryFile(delete=False, suffix=".mp4").name
        
        # Extract clip using FFmpeg
        duration = end_time - start_time
        cmd = [
            "ffmpeg", "-y",
            "-ss", str(start_time),
            "-i", input_path,
            "-t", str(duration),
            "-c:v", "libx264",
            "-c:a", "aac",
            "-strict", "experimental",
            "-preset", "fast",
            output_path
        ]
        
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=300)
        
        # Clean up input file
        os.unlink(input_path)
        
        if result.returncode != 0:
            logger.error(f"FFmpeg error: {result.stderr}")
            raise HTTPException(status_code=500, detail="Video processing failed")
        
        # Read the output file
        with open(output_path, "rb") as f:
            clip_data = f.read()
        
        # Clean up output file
        os.unlink(output_path)
        
        # Save record
        clip_id = str(uuid.uuid4())
        await db.video_clips.insert_one({
            "id": clip_id,
            "user_id": str(current_user.get("_id") or current_user.get("id", "")),
            "original_filename": file.filename,
            "start_time": start_time,
            "end_time": end_time,
            "duration": duration,
            "created_at": datetime.now(timezone.utc).isoformat()
        })
        
        # Return as downloadable file
        from fastapi.responses import Response
        return Response(
            content=clip_data,
            media_type="video/mp4",
            headers={
                "Content-Disposition": f'attachment; filename="{output_filename}.mp4"'
            }
        )
        
    except HTTPException:
        raise
    except subprocess.TimeoutExpired:
        raise HTTPException(status_code=500, detail="Video processing timed out")
    except Exception as e:
        logger.error(f"Clip extraction error: {e}")
        raise HTTPException(status_code=500, detail=f"Clip extraction failed: {str(e)}")


@router.post("/edit/add-text-overlay")
async def add_text_overlay(
    file: UploadFile = File(...),
    text: str = Form(...),
    position: str = Form("bottom"),  # top, center, bottom
    font_size: int = Form(48),
    start_time: Optional[float] = Form(0),
    duration: Optional[float] = Form(None),  # None = entire video
    current_user: dict = Depends(get_current_user)
):
    """
    Add text overlay to video using FFmpeg.
    Great for adding titles, captions, or branding.
    """
    # Validate file type
    allowed_extensions = ["mp4", "mov", "webm"]
    file_ext = file.filename.split(".")[-1].lower() if file.filename else ""
    
    if file_ext not in allowed_extensions:
        raise HTTPException(status_code=400, detail=f"Unsupported format. Allowed: {', '.join(allowed_extensions)}")
    
    # Map position to FFmpeg drawtext coordinates
    position_map = {
        "top": "x=(w-text_w)/2:y=50",
        "center": "x=(w-text_w)/2:y=(h-text_h)/2",
        "bottom": "x=(w-text_w)/2:y=h-text_h-50"
    }
    
    pos_coords = position_map.get(position, position_map["bottom"])
    
    try:
        content = await file.read()
        if len(content) > 200 * 1024 * 1024:  # 200MB limit
            raise HTTPException(status_code=400, detail="File too large. Maximum size is 200MB")
        
        with tempfile.NamedTemporaryFile(delete=False, suffix=f".{file_ext}") as tmp:
            tmp.write(content)
            input_path = tmp.name
        
        output_path = tempfile.NamedTemporaryFile(delete=False, suffix=".mp4").name
        
        # Build filter string
        text_escaped = text.replace("'", "\\'").replace(":", "\\:")
        enable_filter = ""
        if duration:
            enable_filter = f":enable='between(t,{start_time},{start_time + duration})'"
        
        filter_str = f"drawtext=text='{text_escaped}':fontsize={font_size}:fontcolor=white:borderw=2:bordercolor=black:{pos_coords}{enable_filter}"
        
        cmd = [
            "ffmpeg", "-y",
            "-i", input_path,
            "-vf", filter_str,
            "-c:a", "copy",
            "-preset", "fast",
            output_path
        ]
        
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=300)
        
        os.unlink(input_path)
        
        if result.returncode != 0:
            logger.error(f"FFmpeg error: {result.stderr}")
            raise HTTPException(status_code=500, detail="Text overlay failed")
        
        with open(output_path, "rb") as f:
            video_data = f.read()
        
        os.unlink(output_path)
        
        from fastapi.responses import Response
        return Response(
            content=video_data,
            media_type="video/mp4",
            headers={
                "Content-Disposition": f'attachment; filename="video_with_text.mp4"'
            }
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Text overlay error: {e}")
        raise HTTPException(status_code=500, detail=f"Text overlay failed: {str(e)}")


@router.post("/edit/compress")
async def compress_video(
    file: UploadFile = File(...),
    quality: str = Form("medium"),  # low, medium, high
    target_size_mb: Optional[int] = Form(None),  # Optional target size
    current_user: dict = Depends(get_current_user)
):
    """
    Compress video to reduce file size.
    Useful for uploading to social media or email sharing.
    """
    # Quality presets (CRF values: lower = better quality, larger file)
    quality_presets = {
        "high": {"crf": 23, "preset": "slow"},
        "medium": {"crf": 28, "preset": "medium"},
        "low": {"crf": 35, "preset": "fast"}
    }
    
    preset = quality_presets.get(quality, quality_presets["medium"])
    
    allowed_extensions = ["mp4", "mov", "webm", "avi"]
    file_ext = file.filename.split(".")[-1].lower() if file.filename else ""
    
    if file_ext not in allowed_extensions:
        raise HTTPException(status_code=400, detail=f"Unsupported format. Allowed: {', '.join(allowed_extensions)}")
    
    try:
        content = await file.read()
        original_size = len(content)
        
        if original_size > 1024 * 1024 * 1024:  # 1GB limit
            raise HTTPException(status_code=400, detail="File too large. Maximum size is 1GB")
        
        with tempfile.NamedTemporaryFile(delete=False, suffix=f".{file_ext}") as tmp:
            tmp.write(content)
            input_path = tmp.name
        
        output_path = tempfile.NamedTemporaryFile(delete=False, suffix=".mp4").name
        
        cmd = [
            "ffmpeg", "-y",
            "-i", input_path,
            "-c:v", "libx264",
            "-crf", str(preset["crf"]),
            "-preset", preset["preset"],
            "-c:a", "aac",
            "-b:a", "128k",
            output_path
        ]
        
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=600)
        
        os.unlink(input_path)
        
        if result.returncode != 0:
            logger.error(f"FFmpeg error: {result.stderr}")
            raise HTTPException(status_code=500, detail="Compression failed")
        
        with open(output_path, "rb") as f:
            compressed_data = f.read()
        
        compressed_size = len(compressed_data)
        os.unlink(output_path)
        
        # Save record
        await db.video_compressions.insert_one({
            "id": str(uuid.uuid4()),
            "user_id": str(current_user.get("_id") or current_user.get("id", "")),
            "original_filename": file.filename,
            "original_size": original_size,
            "compressed_size": compressed_size,
            "compression_ratio": round(original_size / compressed_size, 2),
            "quality": quality,
            "created_at": datetime.now(timezone.utc).isoformat()
        })
        
        from fastapi.responses import Response
        return Response(
            content=compressed_data,
            media_type="video/mp4",
            headers={
                "Content-Disposition": f'attachment; filename="compressed_video.mp4"',
                "X-Original-Size": str(original_size),
                "X-Compressed-Size": str(compressed_size),
                "X-Compression-Ratio": str(round(original_size / compressed_size, 2))
            }
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Compression error: {e}")
        raise HTTPException(status_code=500, detail=f"Compression failed: {str(e)}")


@router.get("/edit/history")
async def get_editing_history(
    limit: int = 20,
    current_user: dict = Depends(get_current_user)
):
    """Get user's video editing history"""
    user_id = str(current_user.get("_id") or current_user.get("id", ""))
    
    clips = await db.video_clips.find(
        {"user_id": user_id},
        {"_id": 0}
    ).sort("created_at", -1).limit(limit).to_list(limit)
    
    compressions = await db.video_compressions.find(
        {"user_id": user_id},
        {"_id": 0}
    ).sort("created_at", -1).limit(limit).to_list(limit)
    
    return {
        "success": True,
        "clips": clips,
        "compressions": compressions
    }
