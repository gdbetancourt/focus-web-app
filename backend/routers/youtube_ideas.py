"""
YouTube Ideas Router — Kanban pipeline + calendar for YouTube video production.
Stores video metadata and files in PostgreSQL.
"""
import uuid
import io
import logging
from datetime import datetime, date
from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Query
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from routers.auth import get_current_user
from services.pg_pool import get_pg_pool

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/youtube-ideas", tags=["youtube-ideas"])

# ── Stage Definitions ─────────────────────────────────────────────────────

STAGES = [
    "programado",
    "referencias",
    "reporte",
    "metodos",
    "guion",
    "grabado",
    "publicado",
]

STAGE_REQUIREMENTS = {
    "referencias": ["notebook_lm_link"],
    "reporte": ["report_file_id"],
    "metodos": ["methods_file_id"],
    "guion": ["script_file_id"],
    "grabado": [],
    "publicado": ["youtube_url"],
}

ACCEPTED_FILE_EXTENSIONS = {".txt", ".md", ".csv", ".json", ".pdf"}

# ── Pydantic Models ───────────────────────────────────────────────────────

class VideoCreate(BaseModel):
    title: str
    video_format: str  # "short" | "long"
    target_publish_date: str  # ISO date YYYY-MM-DD
    description: Optional[str] = ""
    tags: Optional[List[str]] = []
    notes: Optional[str] = ""


class VideoUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    video_format: Optional[str] = None
    target_publish_date: Optional[str] = None
    notebook_lm_link: Optional[str] = None
    youtube_url: Optional[str] = None
    tags: Optional[List[str]] = None
    notes: Optional[str] = None


class VideoMove(BaseModel):
    new_stage: str


# ── DDL ───────────────────────────────────────────────────────────────────

_tables_created = False

async def _ensure_tables(pool):
    global _tables_created
    if _tables_created:
        return
    async with pool.acquire() as conn:
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS youtube_videos (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                title TEXT NOT NULL,
                description TEXT DEFAULT '',
                video_format TEXT NOT NULL CHECK (video_format IN ('short', 'long')),
                target_publish_date DATE NOT NULL,
                status TEXT NOT NULL DEFAULT 'programado',
                notebook_lm_link TEXT,
                report_file_id UUID,
                methods_file_id UUID,
                script_file_id UUID,
                youtube_url TEXT,
                tags TEXT[] DEFAULT '{}',
                notes TEXT DEFAULT '',
                created_by TEXT,
                created_at TIMESTAMPTZ DEFAULT NOW(),
                updated_at TIMESTAMPTZ DEFAULT NOW()
            );
        """)
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS youtube_video_files (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                video_id UUID NOT NULL REFERENCES youtube_videos(id) ON DELETE CASCADE,
                stage TEXT NOT NULL,
                filename TEXT NOT NULL,
                original_filename TEXT NOT NULL,
                mime_type TEXT NOT NULL,
                file_size INTEGER NOT NULL,
                file_data BYTEA NOT NULL,
                text_content TEXT,
                uploaded_by TEXT,
                created_at TIMESTAMPTZ DEFAULT NOW()
            );
        """)
    _tables_created = True


# ── Text extraction ───────────────────────────────────────────────────────

def _extract_text(file_bytes: bytes, filename: str) -> str:
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    if ext in ("txt", "md", "csv", "json"):
        for enc in ("utf-8", "latin-1"):
            try:
                return file_bytes.decode(enc)
            except UnicodeDecodeError:
                continue
        return ""
    if ext == "pdf":
        try:
            from pypdf import PdfReader
            reader = PdfReader(io.BytesIO(file_bytes))
            return "\n".join(page.extract_text() or "" for page in reader.pages)
        except Exception as e:
            logger.warning(f"PDF text extraction failed: {e}")
            return ""
    return ""


# ── Endpoints ─────────────────────────────────────────────────────────────

@router.get("/videos")
async def list_videos(
    status: Optional[str] = None,
    month: Optional[str] = None,
    current_user: dict = Depends(get_current_user),
):
    """List videos. Optional filters: status (stage key), month (YYYY-MM for calendar)."""
    pool = get_pg_pool()
    await _ensure_tables(pool)

    conditions = []
    params = []
    idx = 1

    if status:
        conditions.append(f"status = ${idx}")
        params.append(status)
        idx += 1

    if month:
        try:
            year, mon = month.split("-")
            conditions.append(f"EXTRACT(YEAR FROM target_publish_date) = ${idx}")
            params.append(int(year))
            idx += 1
            conditions.append(f"EXTRACT(MONTH FROM target_publish_date) = ${idx}")
            params.append(int(mon))
            idx += 1
        except ValueError:
            pass

    where = f"WHERE {' AND '.join(conditions)}" if conditions else ""
    query = f"""
        SELECT id, title, description, video_format, target_publish_date, status,
               notebook_lm_link, report_file_id, methods_file_id, script_file_id,
               youtube_url, tags, notes, created_by, created_at, updated_at
        FROM youtube_videos {where}
        ORDER BY target_publish_date ASC, created_at ASC
    """
    async with pool.acquire() as conn:
        rows = await conn.fetch(query, *params)

    return [
        {
            "id": str(r["id"]),
            "title": r["title"],
            "description": r["description"] or "",
            "video_format": r["video_format"],
            "target_publish_date": r["target_publish_date"].isoformat() if r["target_publish_date"] else None,
            "status": r["status"],
            "notebook_lm_link": r["notebook_lm_link"] or "",
            "report_file_id": str(r["report_file_id"]) if r["report_file_id"] else None,
            "methods_file_id": str(r["methods_file_id"]) if r["methods_file_id"] else None,
            "script_file_id": str(r["script_file_id"]) if r["script_file_id"] else None,
            "youtube_url": r["youtube_url"] or "",
            "tags": list(r["tags"]) if r["tags"] else [],
            "notes": r["notes"] or "",
            "created_by": r["created_by"],
            "created_at": r["created_at"].isoformat() if r["created_at"] else None,
            "updated_at": r["updated_at"].isoformat() if r["updated_at"] else None,
        }
        for r in rows
    ]


@router.get("/pipeline")
async def pipeline_summary(current_user: dict = Depends(get_current_user)):
    """Count videos per stage for Kanban headers."""
    pool = get_pg_pool()
    await _ensure_tables(pool)
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            "SELECT status, COUNT(*) as cnt FROM youtube_videos GROUP BY status"
        )
    counts = {s: 0 for s in STAGES}
    for r in rows:
        if r["status"] in counts:
            counts[r["status"]] = r["cnt"]
    return counts


@router.post("/videos")
async def create_video(
    data: VideoCreate,
    current_user: dict = Depends(get_current_user),
):
    """Create a new video in 'programado' stage."""
    pool = get_pg_pool()
    await _ensure_tables(pool)

    if data.video_format not in ("short", "long"):
        raise HTTPException(400, "video_format must be 'short' or 'long'")

    try:
        date.fromisoformat(data.target_publish_date)
    except ValueError:
        raise HTTPException(400, "target_publish_date must be YYYY-MM-DD")

    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            """
            INSERT INTO youtube_videos (title, description, video_format, target_publish_date, tags, notes, created_by)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING id, created_at
            """,
            data.title,
            data.description or "",
            data.video_format,
            date.fromisoformat(data.target_publish_date),
            data.tags or [],
            data.notes or "",
            current_user.get("email", ""),
        )
    return {"id": str(row["id"]), "created_at": row["created_at"].isoformat()}


@router.put("/videos/{video_id}")
async def update_video(
    video_id: str,
    data: VideoUpdate,
    current_user: dict = Depends(get_current_user),
):
    """Update video metadata fields."""
    pool = get_pg_pool()
    await _ensure_tables(pool)
    vid = uuid.UUID(video_id)

    sets = []
    params = []
    idx = 1

    for field in ("title", "description", "video_format", "notebook_lm_link", "youtube_url", "notes"):
        val = getattr(data, field, None)
        if val is not None:
            sets.append(f"{field} = ${idx}")
            params.append(val)
            idx += 1

    if data.target_publish_date is not None:
        sets.append(f"target_publish_date = ${idx}")
        params.append(date.fromisoformat(data.target_publish_date))
        idx += 1

    if data.tags is not None:
        sets.append(f"tags = ${idx}")
        params.append(data.tags)
        idx += 1

    if not sets:
        raise HTTPException(400, "No fields to update")

    sets.append(f"updated_at = ${idx}")
    params.append(datetime.utcnow())
    idx += 1

    params.append(vid)
    query = f"UPDATE youtube_videos SET {', '.join(sets)} WHERE id = ${idx} RETURNING id"

    async with pool.acquire() as conn:
        row = await conn.fetchrow(query, *params)
    if not row:
        raise HTTPException(404, "Video not found")
    return {"ok": True}


@router.post("/videos/{video_id}/move")
async def move_video(
    video_id: str,
    body: VideoMove,
    current_user: dict = Depends(get_current_user),
):
    """Move video to a new stage with validation."""
    pool = get_pg_pool()
    await _ensure_tables(pool)
    vid = uuid.UUID(video_id)

    if body.new_stage not in STAGES:
        raise HTTPException(400, f"Invalid stage: {body.new_stage}")

    async with pool.acquire() as conn:
        row = await conn.fetchrow("SELECT * FROM youtube_videos WHERE id = $1", vid)
    if not row:
        raise HTTPException(404, "Video not found")

    # Check requirements for the target stage
    reqs = STAGE_REQUIREMENTS.get(body.new_stage, [])
    missing = [r for r in reqs if not row.get(r)]
    if missing:
        field_labels = {
            "notebook_lm_link": "Link de NotebookLM",
            "report_file_id": "Archivo de reporte de patrones",
            "methods_file_id": "Archivo de métodos aplicados",
            "script_file_id": "Archivo de guión",
            "youtube_url": "Link de YouTube",
        }
        missing_labels = [field_labels.get(m, m) for m in missing]
        raise HTTPException(400, f"Faltan campos requeridos: {', '.join(missing_labels)}")

    async with pool.acquire() as conn:
        await conn.execute(
            "UPDATE youtube_videos SET status = $1, updated_at = $2 WHERE id = $3",
            body.new_stage, datetime.utcnow(), vid,
        )
    return {"ok": True, "new_stage": body.new_stage}


@router.delete("/videos/{video_id}")
async def delete_video(
    video_id: str,
    current_user: dict = Depends(get_current_user),
):
    """Delete a video and its associated files."""
    pool = get_pg_pool()
    vid = uuid.UUID(video_id)
    async with pool.acquire() as conn:
        result = await conn.execute("DELETE FROM youtube_videos WHERE id = $1", vid)
    if result == "DELETE 0":
        raise HTTPException(404, "Video not found")
    return {"ok": True}


# ── File Upload / Download ────────────────────────────────────────────────

@router.post("/videos/{video_id}/upload-file")
async def upload_file(
    video_id: str,
    stage: str = Query(..., description="Stage: reporte, metodos, or guion"),
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user),
):
    """Upload a text file for stages 3/4/5. Stores in PG with extracted text."""
    if stage not in ("reporte", "metodos", "guion"):
        raise HTTPException(400, "stage must be 'reporte', 'metodos', or 'guion'")

    ext = ("." + file.filename.rsplit(".", 1)[-1].lower()) if "." in file.filename else ""
    if ext not in ACCEPTED_FILE_EXTENSIONS:
        raise HTTPException(400, f"Formato no soportado. Usa: {', '.join(ACCEPTED_FILE_EXTENSIONS)}")

    pool = get_pg_pool()
    await _ensure_tables(pool)
    vid = uuid.UUID(video_id)

    file_bytes = await file.read()
    text_content = _extract_text(file_bytes, file.filename)

    # Map stage to video column
    col_map = {
        "reporte": "report_file_id",
        "metodos": "methods_file_id",
        "guion": "script_file_id",
    }
    file_col = col_map[stage]

    async with pool.acquire() as conn:
        # Check video exists
        video = await conn.fetchrow("SELECT id FROM youtube_videos WHERE id = $1", vid)
        if not video:
            raise HTTPException(404, "Video not found")

        # Delete previous file for this stage if exists
        await conn.execute(
            "DELETE FROM youtube_video_files WHERE video_id = $1 AND stage = $2",
            vid, stage,
        )

        # Insert new file
        file_row = await conn.fetchrow(
            """
            INSERT INTO youtube_video_files (video_id, stage, filename, original_filename, mime_type, file_size, file_data, text_content, uploaded_by)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            RETURNING id
            """,
            vid, stage, file.filename, file.filename,
            file.content_type or "application/octet-stream",
            len(file_bytes), file_bytes, text_content,
            current_user.get("email", ""),
        )

        # Update video reference
        await conn.execute(
            f"UPDATE youtube_videos SET {file_col} = $1, updated_at = $2 WHERE id = $3",
            file_row["id"], datetime.utcnow(), vid,
        )

    return {
        "file_id": str(file_row["id"]),
        "filename": file.filename,
        "text_extracted": bool(text_content),
    }


@router.get("/files/{file_id}/download")
async def download_file(
    file_id: str,
    current_user: dict = Depends(get_current_user),
):
    """Download an uploaded file."""
    pool = get_pg_pool()
    fid = uuid.UUID(file_id)
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            "SELECT original_filename, mime_type, file_data FROM youtube_video_files WHERE id = $1",
            fid,
        )
    if not row:
        raise HTTPException(404, "File not found")

    return StreamingResponse(
        io.BytesIO(row["file_data"]),
        media_type=row["mime_type"],
        headers={"Content-Disposition": f'attachment; filename="{row["original_filename"]}"'},
    )
