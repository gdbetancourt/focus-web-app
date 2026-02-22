"""
Router for Attract section - Viral Video Trends
Uses Apify TikTok Trending Videos Scraper
"""
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timezone
import httpx
import os
from .auth import get_current_user
from database import db

router = APIRouter(prefix="/attract", tags=["attract"])

# Apify configuration
TIKTOK_TRENDING_ACTOR = "lexis-solutions/tiktok-trending-videos-scraper"


async def get_apify_token():
    """Get Apify token from env or database settings"""
    token = os.environ.get("APIFY_TOKEN", "")
    if token:
        return token
    # Try to get from database
    settings = await db.settings.find_one({})
    if settings:
        return settings.get("apify_token", "")
    return ""


@router.get("/apify/status")
async def get_apify_status(
    current_user: dict = Depends(get_current_user)
):
    """
    Get Apify account status including available credits.
    Used to display alerts in 1.1.1.x modules.
    """
    token = await get_apify_token()
    
    if not token:
        return {
            "connected": False,
            "error": "No Apify token configured",
            "credits_usd": 0,
            "credits_available": False
        }
    
    try:
        async with httpx.AsyncClient() as client:
            # Get user info which includes subscription info
            response = await client.get(
                "https://api.apify.com/v2/users/me",
                headers={"Authorization": f"Bearer {token}"}
            )
            
            if response.status_code == 401:
                return {
                    "connected": False,
                    "error": "Invalid Apify token",
                    "credits_usd": 0,
                    "credits_available": False
                }
            
            if response.status_code != 200:
                return {
                    "connected": False,
                    "error": f"Apify API error: {response.status_code}",
                    "credits_usd": 0,
                    "credits_available": False
                }
            
            data = response.json().get("data", {})
            
            # Extract plan info
            plan = data.get("plan", {})
            usage_monthly_usd = plan.get("usageMonthlyUsd", 0)
            monthly_usage_credits_usd_limit = plan.get("monthlyUsageCreditsUsdLimit", 0)
            
            # Calculate remaining credits
            remaining_usd = monthly_usage_credits_usd_limit - usage_monthly_usd if monthly_usage_credits_usd_limit > 0 else 0
            
            # Check proxy info for extra credits
            proxy = data.get("proxy", {})
            proxy_groups = proxy.get("groups", [])
            
            return {
                "connected": True,
                "username": data.get("username", ""),
                "email": data.get("profile", {}).get("email", ""),
                "plan_name": plan.get("name", "Free"),
                "usage_monthly_usd": round(usage_monthly_usd, 2),
                "monthly_limit_usd": monthly_usage_credits_usd_limit,
                "remaining_usd": round(remaining_usd, 2),
                "credits_available": remaining_usd > 0.5,  # Consider available if more than $0.50
                "proxy_groups": len(proxy_groups),
                "error": None
            }
    
    except Exception as e:
        return {
            "connected": False,
            "error": str(e),
            "credits_usd": 0,
            "credits_available": False
        }


class TrendingVideoRequest(BaseModel):
    country: str = "MX"  # Default to Mexico
    max_videos: int = 20


class VideoIdea(BaseModel):
    title: str
    description: Optional[str] = ""
    inspiration_url: Optional[str] = ""
    status: str = "idea"  # idea, scripting, filming, editing, published
    tags: List[str] = []
    notes: Optional[str] = ""


@router.get("/trending")
async def get_trending_videos(
    country: str = "MX",
    limit: int = 20,
    current_user: dict = Depends(get_current_user)
):
    """
    Get trending TikTok videos for a specific country.
    Uses cached data if available (refreshed every 6 hours).
    """
    # Check cache first
    cache_key = f"trending_{country}"
    cached = await db.attract_cache.find_one({"key": cache_key})
    
    if cached:
        cache_time = datetime.fromisoformat(cached.get("updated_at", "2000-01-01"))
        now = datetime.now(timezone.utc)
        hours_old = (now - cache_time.replace(tzinfo=timezone.utc)).total_seconds() / 3600
        
        if hours_old < 6:
            return {
                "success": True,
                "videos": cached.get("videos", [])[:limit],
                "cached": True,
                "cache_age_hours": round(hours_old, 1),
                "country": country
            }
    
    # Fetch fresh data from Apify
    apify_token = await get_apify_token()
    if not apify_token:
        # Return mock data if no token
        return {
            "success": True,
            "videos": get_mock_trending_videos(country, limit),
            "cached": False,
            "mock": True,
            "message": "Configure APIFY_TOKEN in Settings to enable real trends"
        }
    
    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            # Use the tilde format for actor name
            actor_name = "lexis-solutions~tiktok-trending-videos-scraper"
            
            # Start the Apify actor
            response = await client.post(
                f"https://api.apify.com/v2/acts/{actor_name}/runs",
                headers={"Authorization": f"Bearer {apify_token}"},
                json={
                    "country": country,
                    "maxVideos": limit,
                    "shouldDownloadCovers": False
                }
            )
            
            if response.status_code == 403:
                # Actor requires payment/rental
                return {
                    "success": True,
                    "videos": get_mock_trending_videos(country, limit),
                    "cached": False,
                    "mock": True,
                    "message": "TikTok actor requires Apify subscription. Using sample data."
                }
            
            if response.status_code != 201:
                raise HTTPException(status_code=500, detail=f"Failed to start Apify actor: {response.status_code}")
            
            run_data = response.json()
            run_id = run_data.get("data", {}).get("id")
            
            # Wait for completion (with timeout)
            import asyncio
            for _ in range(30):  # Max 30 seconds
                await asyncio.sleep(1)
                status_response = await client.get(
                    f"https://api.apify.com/v2/actor-runs/{run_id}",
                    headers={"Authorization": f"Bearer {apify_token}"}
                )
                status = status_response.json().get("data", {}).get("status")
                if status == "SUCCEEDED":
                    break
                elif status in ["FAILED", "ABORTED"]:
                    raise HTTPException(status_code=500, detail="Apify actor failed")
            
            # Get results
            results_response = await client.get(
                f"https://api.apify.com/v2/actor-runs/{run_id}/dataset/items",
                headers={"Authorization": f"Bearer {apify_token}"}
            )
            
            videos = results_response.json()
            
            # Transform and cache
            transformed = transform_tiktok_videos(videos[:limit])
            
            await db.attract_cache.update_one(
                {"key": cache_key},
                {
                    "$set": {
                        "videos": transformed,
                        "updated_at": datetime.now(timezone.utc).isoformat()
                    }
                },
                upsert=True
            )
            
            return {
                "success": True,
                "videos": transformed,
                "cached": False,
                "country": country
            }
            
    except Exception as e:
        # Return mock data on error
        return {
            "success": True,
            "videos": get_mock_trending_videos(country, limit),
            "cached": False,
            "mock": True,
            "error": str(e)
        }


def transform_tiktok_videos(videos: List[dict]) -> List[dict]:
    """Transform Apify TikTok data to our format"""
    transformed = []
    for v in videos:
        transformed.append({
            "id": v.get("id", ""),
            "title": v.get("text", v.get("desc", ""))[:100],
            "description": v.get("text", v.get("desc", "")),
            "author": v.get("authorMeta", {}).get("name", v.get("author", "")),
            "author_followers": v.get("authorMeta", {}).get("fans", 0),
            "views": v.get("playCount", v.get("stats", {}).get("playCount", 0)),
            "likes": v.get("diggCount", v.get("stats", {}).get("diggCount", 0)),
            "comments": v.get("commentCount", v.get("stats", {}).get("commentCount", 0)),
            "shares": v.get("shareCount", v.get("stats", {}).get("shareCount", 0)),
            "hashtags": [h.get("name", h) if isinstance(h, dict) else h for h in v.get("hashtags", [])],
            "music": v.get("musicMeta", {}).get("musicName", ""),
            "cover_url": v.get("covers", {}).get("default", v.get("cover", "")),
            "video_url": v.get("videoUrl", v.get("webVideoUrl", "")),
            "created_at": v.get("createTime", "")
        })
    return transformed


def get_mock_trending_videos(country: str, limit: int) -> List[dict]:
    """Return mock trending videos for demo purposes"""
    mock_videos = [
        {
            "id": "mock_1",
            "title": "Cómo aumentar tu productividad en 5 minutos",
            "description": "Tips de productividad que cambiarán tu vida #productividad #tips #viral",
            "author": "productivityguru",
            "author_followers": 150000,
            "views": 2500000,
            "likes": 180000,
            "comments": 5200,
            "shares": 12000,
            "hashtags": ["productividad", "tips", "viral", "trabajo"],
            "music": "Original Sound - ProductivityGuru",
            "cover_url": "",
            "video_url": "https://tiktok.com/@productivityguru/video/mock_1"
        },
        {
            "id": "mock_2",
            "title": "El secreto de las empresas exitosas",
            "description": "Lo que nadie te cuenta sobre el éxito empresarial #negocios #emprendimiento",
            "author": "businesscoach",
            "author_followers": 320000,
            "views": 1800000,
            "likes": 95000,
            "comments": 3100,
            "shares": 8500,
            "hashtags": ["negocios", "emprendimiento", "exito", "coaching"],
            "music": "Inspiring Corporate - MusicLib",
            "cover_url": "",
            "video_url": "https://tiktok.com/@businesscoach/video/mock_2"
        },
        {
            "id": "mock_3",
            "title": "3 tendencias de marketing que debes conocer",
            "description": "Las tendencias que dominarán el 2025 #marketing #tendencias #digital",
            "author": "marketingpro",
            "author_followers": 89000,
            "views": 950000,
            "likes": 62000,
            "comments": 1800,
            "shares": 4200,
            "hashtags": ["marketing", "tendencias", "digital", "2025"],
            "music": "Upbeat Corporate - TrendMusic",
            "cover_url": "",
            "video_url": "https://tiktok.com/@marketingpro/video/mock_3"
        },
        {
            "id": "mock_4",
            "title": "Por qué tu empresa necesita IA ahora",
            "description": "La inteligencia artificial está transformando los negocios #ia #tecnologia",
            "author": "techinnovator",
            "author_followers": 210000,
            "views": 3200000,
            "likes": 245000,
            "comments": 8900,
            "shares": 18000,
            "hashtags": ["ia", "tecnologia", "innovacion", "futuro"],
            "music": "Tech Future - SoundWave",
            "cover_url": "",
            "video_url": "https://tiktok.com/@techinnovator/video/mock_4"
        },
        {
            "id": "mock_5",
            "title": "Liderazgo: lo que los libros no te enseñan",
            "description": "Lecciones de liderazgo aprendidas en la práctica #liderazgo #management",
            "author": "leadershipcoach",
            "author_followers": 175000,
            "views": 1200000,
            "likes": 78000,
            "comments": 2400,
            "shares": 6100,
            "hashtags": ["liderazgo", "management", "equipos", "coaching"],
            "music": "Motivational Speech - InspireSound",
            "cover_url": "",
            "video_url": "https://tiktok.com/@leadershipcoach/video/mock_5"
        }
    ]
    return mock_videos[:limit]


# Video Ideas CRUD
@router.get("/ideas")
async def get_video_ideas(
    status: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Get all video ideas, optionally filtered by status"""
    query = {}
    if status:
        query["status"] = status
    
    ideas = await db.video_ideas.find(query, {"_id": 0}).sort("created_at", -1).to_list(100)
    
    # Count by status
    status_counts = {}
    all_ideas = await db.video_ideas.find({}, {"status": 1}).to_list(1000)
    for idea in all_ideas:
        s = idea.get("status", "idea")
        status_counts[s] = status_counts.get(s, 0) + 1
    
    return {
        "success": True,
        "ideas": ideas,
        "counts": status_counts
    }


@router.post("/ideas")
async def create_video_idea(
    idea: VideoIdea,
    current_user: dict = Depends(get_current_user)
):
    """Create a new video idea"""
    import uuid
    
    idea_dict = idea.dict()
    idea_dict["id"] = str(uuid.uuid4())
    idea_dict["created_at"] = datetime.now(timezone.utc).isoformat()
    idea_dict["updated_at"] = idea_dict["created_at"]
    idea_dict["created_by"] = current_user.get("email", "")
    
    await db.video_ideas.insert_one(idea_dict)
    
    return {"success": True, "idea": {k: v for k, v in idea_dict.items() if k != "_id"}}


@router.put("/ideas/{idea_id}")
async def update_video_idea(
    idea_id: str,
    updates: dict,
    current_user: dict = Depends(get_current_user)
):
    """Update a video idea"""
    updates["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    result = await db.video_ideas.update_one(
        {"id": idea_id},
        {"$set": updates}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Idea not found")
    
    updated = await db.video_ideas.find_one({"id": idea_id}, {"_id": 0})
    return {"success": True, "idea": updated}


@router.delete("/ideas/{idea_id}")
async def delete_video_idea(
    idea_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Delete a video idea"""
    result = await db.video_ideas.delete_one({"id": idea_id})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Idea not found")
    
    return {"success": True, "message": "Idea deleted"}
