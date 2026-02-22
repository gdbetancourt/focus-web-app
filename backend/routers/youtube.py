"""
Router for Long-form Videos (YouTube) section
Kanban board for video production planning + YouTube API Integration
"""
from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, Form, BackgroundTasks
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timezone
import uuid
import os
import tempfile
import logging
from .auth import get_current_user
from database import db

# YouTube API imports
try:
    from googleapiclient.discovery import build
    from googleapiclient.http import MediaFileUpload
    from googleapiclient.errors import HttpError
    from google.oauth2.credentials import Credentials
    from google_auth_oauthlib.flow import Flow
    YOUTUBE_API_AVAILABLE = True
except ImportError:
    YOUTUBE_API_AVAILABLE = False

logger = logging.getLogger(__name__)

# YouTube API configuration
YOUTUBE_API_SERVICE_NAME = "youtube"
YOUTUBE_API_VERSION = "v3"
YOUTUBE_SCOPES = [
    "https://www.googleapis.com/auth/youtube.upload",
    "https://www.googleapis.com/auth/youtube.readonly",
    "https://www.googleapis.com/auth/youtube.force-ssl"
]

router = APIRouter(prefix="/youtube", tags=["youtube"])


class YouTubeVideo(BaseModel):
    title: str
    description: Optional[str] = ""
    status: str = "idea"  # idea, scripting, filming, editing, review, published
    script: Optional[str] = ""
    thumbnail_notes: Optional[str] = ""
    target_duration: Optional[str] = ""  # e.g., "10-15 min"
    target_publish_date: Optional[str] = ""
    youtube_url: Optional[str] = ""
    tags: List[str] = []
    notes: Optional[str] = ""


class YouTubeVideoUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None
    script: Optional[str] = None
    thumbnail_notes: Optional[str] = None
    target_duration: Optional[str] = None
    target_publish_date: Optional[str] = None
    youtube_url: Optional[str] = None
    tags: Optional[List[str]] = None
    notes: Optional[str] = None


@router.get("/videos")
async def get_youtube_videos(
    status: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Get all YouTube video projects, optionally filtered by status"""
    query = {}
    if status:
        query["status"] = status
    
    videos = await db.youtube_videos.find(query, {"_id": 0}).sort("created_at", -1).to_list(100)
    
    # Count by status
    status_counts = {}
    all_videos = await db.youtube_videos.find({}, {"status": 1}).to_list(1000)
    for video in all_videos:
        s = video.get("status", "idea")
        status_counts[s] = status_counts.get(s, 0) + 1
    
    return {
        "success": True,
        "videos": videos,
        "counts": status_counts
    }


@router.post("/videos")
async def create_youtube_video(
    video: YouTubeVideo,
    current_user: dict = Depends(get_current_user)
):
    """Create a new YouTube video project"""
    video_dict = video.dict()
    video_dict["id"] = str(uuid.uuid4())
    video_dict["created_at"] = datetime.now(timezone.utc).isoformat()
    video_dict["updated_at"] = video_dict["created_at"]
    video_dict["created_by"] = current_user.get("email", "")
    
    await db.youtube_videos.insert_one(video_dict)
    
    return {"success": True, "video": {k: v for k, v in video_dict.items() if k != "_id"}}


@router.post("/videos/from-content/{content_id}")
async def create_video_from_content(
    content_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Create a YouTube video project from Content Flow item"""
    # Find the content item
    content = await db.content_flow.find_one({"id": content_id})
    if not content:
        raise HTTPException(status_code=404, detail="Content not found")
    
    # Create video from content
    video_dict = {
        "id": str(uuid.uuid4()),
        "title": content.get("name", "Untitled Video"),
        "description": content.get("description", ""),
        "status": "idea",
        "script": content.get("article_text", "") or content.get("description", ""),
        "thumbnail_notes": "",
        "target_duration": "",
        "target_publish_date": "",
        "youtube_url": "",
        "tags": [],
        "notes": f"Created from content: {content.get('name', '')}",
        "source_content_id": content_id,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "created_by": current_user.get("email", "")
    }
    
    await db.youtube_videos.insert_one(video_dict)
    
    return {
        "success": True, 
        "video": {k: v for k, v in video_dict.items() if k != "_id"},
        "message": f"Video created from '{content.get('name', 'content')}'"
    }


@router.put("/videos/{video_id}")
async def update_youtube_video(
    video_id: str,
    updates: YouTubeVideoUpdate,
    current_user: dict = Depends(get_current_user)
):
    """Update a YouTube video project"""
    update_dict = {k: v for k, v in updates.dict().items() if v is not None}
    update_dict["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    result = await db.youtube_videos.update_one(
        {"id": video_id},
        {"$set": update_dict}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Video not found")
    
    updated = await db.youtube_videos.find_one({"id": video_id}, {"_id": 0})
    return {"success": True, "video": updated}


@router.delete("/videos/{video_id}")
async def delete_youtube_video(
    video_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Delete a YouTube video project"""
    result = await db.youtube_videos.delete_one({"id": video_id})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Video not found")
    
    return {"success": True, "message": "Video deleted"}


# ============ YouTube API Integration ============

async def get_youtube_service_with_oauth(user_id: str):
    """Get YouTube service using OAuth credentials"""
    if not YOUTUBE_API_AVAILABLE:
        raise HTTPException(status_code=500, detail="YouTube API libraries not installed")
    
    creds_doc = await db.youtube_credentials.find_one({"user_id": user_id})
    
    if not creds_doc:
        raise HTTPException(
            status_code=401, 
            detail="YouTube not connected. Please connect your YouTube account first."
        )
    
    credentials = Credentials(
        token=creds_doc.get("access_token"),
        refresh_token=creds_doc.get("refresh_token"),
        token_uri="https://oauth2.googleapis.com/token",
        client_id=os.environ.get("YOUTUBE_CLIENT_ID") or os.environ.get("GOOGLE_CLIENT_ID"),
        client_secret=os.environ.get("YOUTUBE_CLIENT_SECRET") or os.environ.get("GOOGLE_CLIENT_SECRET")
    )
    
    return build(
        YOUTUBE_API_SERVICE_NAME,
        YOUTUBE_API_VERSION,
        credentials=credentials,
        cache_discovery=False
    )


@router.get("/api/auth/url")
async def get_youtube_auth_url(current_user: dict = Depends(get_current_user)):
    """Generate OAuth URL for YouTube authorization"""
    if not YOUTUBE_API_AVAILABLE:
        raise HTTPException(status_code=500, detail="YouTube API libraries not installed")
    
    client_id = os.environ.get("YOUTUBE_CLIENT_ID") or os.environ.get("GOOGLE_CLIENT_ID")
    client_secret = os.environ.get("YOUTUBE_CLIENT_SECRET") or os.environ.get("GOOGLE_CLIENT_SECRET")
    
    if not client_id or not client_secret:
        raise HTTPException(status_code=500, detail="YouTube OAuth not configured. Please add YOUTUBE_CLIENT_ID and YOUTUBE_CLIENT_SECRET to .env")
    
    frontend_url = os.environ.get("REACT_APP_BACKEND_URL", "http://localhost:3000").replace("/api", "")
    redirect_uri = f"{frontend_url}/youtube/callback"
    
    flow = Flow.from_client_config(
        {
            "web": {
                "client_id": client_id,
                "client_secret": client_secret,
                "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                "token_uri": "https://oauth2.googleapis.com/token",
                "redirect_uris": [redirect_uri]
            }
        },
        scopes=YOUTUBE_SCOPES,
        redirect_uri=redirect_uri
    )
    
    auth_url, state = flow.authorization_url(
        access_type="offline",
        include_granted_scopes="true",
        prompt="consent"
    )
    
    await db.youtube_oauth_states.insert_one({
        "user_id": str(current_user.get("_id") or current_user.get("id", "")),
        "state": state,
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    return {"auth_url": auth_url, "state": state}


@router.post("/api/auth/callback")
async def youtube_auth_callback(
    code: str,
    state: str,
    current_user: dict = Depends(get_current_user)
):
    """Handle OAuth callback and store credentials"""
    if not YOUTUBE_API_AVAILABLE:
        raise HTTPException(status_code=500, detail="YouTube API libraries not installed")
    
    state_doc = await db.youtube_oauth_states.find_one({
        "user_id": str(current_user.get("_id") or current_user.get("id", "")),
        "state": state
    })
    
    if not state_doc:
        raise HTTPException(status_code=400, detail="Invalid state parameter")
    
    await db.youtube_oauth_states.delete_one({"_id": state_doc["_id"]})
    
    client_id = os.environ.get("YOUTUBE_CLIENT_ID") or os.environ.get("GOOGLE_CLIENT_ID")
    client_secret = os.environ.get("YOUTUBE_CLIENT_SECRET") or os.environ.get("GOOGLE_CLIENT_SECRET")
    frontend_url = os.environ.get("REACT_APP_BACKEND_URL", "http://localhost:3000").replace("/api", "")
    redirect_uri = f"{frontend_url}/youtube/callback"
    
    flow = Flow.from_client_config(
        {
            "web": {
                "client_id": client_id,
                "client_secret": client_secret,
                "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                "token_uri": "https://oauth2.googleapis.com/token",
                "redirect_uris": [redirect_uri]
            }
        },
        scopes=YOUTUBE_SCOPES,
        redirect_uri=redirect_uri
    )
    
    try:
        flow.fetch_token(code=code)
        credentials = flow.credentials
        
        await db.youtube_credentials.update_one(
            {"user_id": str(current_user.get("_id") or current_user.get("id", ""))},
            {
                "$set": {
                    "access_token": credentials.token,
                    "refresh_token": credentials.refresh_token,
                    "token_uri": credentials.token_uri,
                    "client_id": credentials.client_id,
                    "client_secret": credentials.client_secret,
                    "scopes": list(credentials.scopes) if credentials.scopes else YOUTUBE_SCOPES,
                    "updated_at": datetime.now(timezone.utc).isoformat()
                }
            },
            upsert=True
        )
        
        return {"success": True, "message": "YouTube account connected successfully"}
        
    except Exception as e:
        logger.error(f"YouTube OAuth error: {e}")
        raise HTTPException(status_code=400, detail=f"OAuth error: {str(e)}")


@router.get("/api/auth/status")
async def get_youtube_connection_status(current_user: dict = Depends(get_current_user)):
    """Check if YouTube is connected and get channel info"""
    creds_doc = await db.youtube_credentials.find_one({"user_id": str(current_user.get("_id") or current_user.get("id", ""))})
    
    if not creds_doc:
        return {"connected": False, "channel": None}
    
    try:
        youtube = await get_youtube_service_with_oauth(str(current_user.get("_id") or current_user.get("id", "")))
        response = youtube.channels().list(
            part="snippet,statistics",
            mine=True
        ).execute()
        
        if response.get("items"):
            channel = response["items"][0]
            return {
                "connected": True,
                "channel": {
                    "id": channel["id"],
                    "title": channel["snippet"]["title"],
                    "thumbnail": channel["snippet"]["thumbnails"]["default"]["url"],
                    "subscribers": channel["statistics"].get("subscriberCount", "0"),
                    "videos": channel["statistics"].get("videoCount", "0")
                }
            }
    except Exception as e:
        logger.error(f"Error checking YouTube status: {e}")
    
    return {"connected": True, "channel": None}


@router.get("/api/channel/videos")
async def list_channel_videos(
    max_results: int = 20,
    page_token: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """List videos from the connected YouTube channel"""
    try:
        youtube = await get_youtube_service_with_oauth(str(current_user.get("_id") or current_user.get("id", "")))
        
        channels_response = youtube.channels().list(
            part="contentDetails",
            mine=True
        ).execute()
        
        if not channels_response.get("items"):
            return {"videos": [], "nextPageToken": None}
        
        uploads_playlist_id = channels_response["items"][0]["contentDetails"]["relatedPlaylists"]["uploads"]
        
        playlist_response = youtube.playlistItems().list(
            part="snippet,contentDetails",
            playlistId=uploads_playlist_id,
            maxResults=max_results,
            pageToken=page_token
        ).execute()
        
        video_ids = [item["contentDetails"]["videoId"] for item in playlist_response.get("items", [])]
        
        if not video_ids:
            return {"videos": [], "nextPageToken": None}
        
        videos_response = youtube.videos().list(
            part="snippet,statistics,status",
            id=",".join(video_ids)
        ).execute()
        
        videos = []
        for video in videos_response.get("items", []):
            videos.append({
                "id": video["id"],
                "title": video["snippet"]["title"],
                "description": video["snippet"]["description"][:200] + "..." if len(video["snippet"].get("description", "")) > 200 else video["snippet"].get("description", ""),
                "thumbnail": video["snippet"]["thumbnails"]["medium"]["url"],
                "publishedAt": video["snippet"]["publishedAt"],
                "privacyStatus": video["status"]["privacyStatus"],
                "views": video["statistics"].get("viewCount", "0"),
                "likes": video["statistics"].get("likeCount", "0"),
                "comments": video["statistics"].get("commentCount", "0")
            })
        
        return {"videos": videos, "nextPageToken": playlist_response.get("nextPageToken")}
        
    except HTTPException:
        raise
    except HttpError as e:
        logger.error(f"YouTube API error: {e}")
        raise HTTPException(status_code=400, detail=f"YouTube API error: {str(e)}")
    except Exception as e:
        logger.error(f"Error listing videos: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/api/upload")
async def upload_video_to_youtube(
    video: UploadFile = File(...),
    title: str = Form(...),
    description: str = Form(""),
    tags: str = Form(""),
    privacy_status: str = Form("private"),
    current_user: dict = Depends(get_current_user)
):
    """Upload a video to YouTube"""
    try:
        youtube = await get_youtube_service_with_oauth(str(current_user.get("_id") or current_user.get("id", "")))
        
        with tempfile.NamedTemporaryFile(delete=False, suffix=".mp4") as tmp:
            content = await video.read()
            tmp.write(content)
            tmp_path = tmp.name
        
        tag_list = [t.strip() for t in tags.split(",") if t.strip()] if tags else []
        
        body = {
            "snippet": {
                "title": title,
                "description": description,
                "tags": tag_list,
                "categoryId": "22"
            },
            "status": {
                "privacyStatus": privacy_status,
                "selfDeclaredMadeForKids": False
            }
        }
        
        media = MediaFileUpload(tmp_path, chunksize=-1, resumable=True)
        
        request = youtube.videos().insert(
            part="snippet,status",
            body=body,
            media_body=media
        )
        
        response = request.execute()
        
        os.unlink(tmp_path)
        
        await db.youtube_uploads.insert_one({
            "user_id": str(current_user.get("_id") or current_user.get("id", "")),
            "video_id": response["id"],
            "title": title,
            "privacy_status": privacy_status,
            "uploaded_at": datetime.now(timezone.utc).isoformat()
        })
        
        return {
            "success": True,
            "video_id": response["id"],
            "video_url": f"https://youtube.com/watch?v={response['id']}",
            "message": "Video uploaded successfully"
        }
        
    except HTTPException:
        raise
    except HttpError as e:
        logger.error(f"YouTube upload error: {e}")
        raise HTTPException(status_code=400, detail=f"Upload failed: {str(e)}")
    except Exception as e:
        logger.error(f"Upload error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/api/channel/analytics")
async def get_channel_analytics(current_user: dict = Depends(get_current_user)):
    """Get channel-level analytics"""
    try:
        youtube = await get_youtube_service_with_oauth(str(current_user.get("_id") or current_user.get("id", "")))
        
        response = youtube.channels().list(
            part="snippet,statistics,brandingSettings",
            mine=True
        ).execute()
        
        if not response.get("items"):
            return {"channel": None}
        
        channel = response["items"][0]
        stats = channel["statistics"]
        
        return {
            "channel": {
                "id": channel["id"],
                "title": channel["snippet"]["title"],
                "description": channel["snippet"].get("description", ""),
                "customUrl": channel["snippet"].get("customUrl", ""),
                "thumbnail": channel["snippet"]["thumbnails"]["high"]["url"],
                "country": channel["snippet"].get("country", ""),
                "publishedAt": channel["snippet"]["publishedAt"]
            },
            "statistics": {
                "subscribers": int(stats.get("subscriberCount", 0)),
                "views": int(stats.get("viewCount", 0)),
                "videos": int(stats.get("videoCount", 0)),
                "hiddenSubscriberCount": stats.get("hiddenSubscriberCount", False)
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Channel analytics error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
