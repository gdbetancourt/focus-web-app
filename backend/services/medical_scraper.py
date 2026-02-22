"""
Medical Scraping Service using Gemini
Extracts events from medical society websites and PDFs/images
"""
import os
import json
import re
import httpx
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any
from dotenv import load_dotenv

load_dotenv()

# Try to import emergent integrations
try:
    from emergentintegrations.llm.chat import LlmChat, UserMessage
    GEMINI_AVAILABLE = True
except ImportError:
    GEMINI_AVAILABLE = False
    print("Warning: emergentintegrations not available")

EMERGENT_LLM_KEY = os.environ.get("EMERGENT_LLM_KEY")

# System prompts for different tasks
EVENT_EXTRACTION_PROMPT = """You are an expert at extracting event information from medical society websites.
Analyze the provided content and extract ALL events you can find.

For each event, extract:
- name: Event name/title
- date_start: Start date (ISO format YYYY-MM-DD if possible)
- date_end: End date if available (ISO format YYYY-MM-DD)
- location: Venue/city/country
- description: Brief description
- url: Registration or info URL if available
- type: congress, webinar, workshop, conference, symposium, etc.

Also identify any medical specialties mentioned.

Return JSON in this format:
{
  "events": [
    {
      "name": "...",
      "date_start": "...",
      "date_end": "...",
      "location": "...",
      "description": "...",
      "url": "...",
      "type": "..."
    }
  ],
  "specialties_detected": ["Cardiology", "Oncology", ...],
  "scrape_notes": "Any notes about the extraction"
}

If no events found, return {"events": [], "specialties_detected": [], "scrape_notes": "reason"}
"""

PDF_EXTRACTION_PROMPT = """You are an expert at extracting structured information from medical documents.
Analyze the provided PDF/image content and extract ALL events, medications, pipelines or relevant medical information.

For events, extract: name, dates, location, description, type
For medications/pipelines, extract: name, phase, indication, company

Return JSON in this format:
{
  "events": [...],
  "medications": [...],
  "specialties_detected": [...],
  "key_information": "summary of key findings"
}
"""


async def fetch_website_content(url: str) -> Optional[str]:
    """Fetch website content for analysis"""
    try:
        async with httpx.AsyncClient(timeout=30.0, follow_redirects=True) as client:
            headers = {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
            }
            response = await client.get(url, headers=headers)
            response.raise_for_status()
            
            # Get text content, limit size
            content = response.text[:50000]  # Limit to ~50KB
            
            # Clean HTML - remove scripts, styles, etc.
            content = re.sub(r'<script[^>]*>.*?</script>', '', content, flags=re.DOTALL | re.IGNORECASE)
            content = re.sub(r'<style[^>]*>.*?</style>', '', content, flags=re.DOTALL | re.IGNORECASE)
            content = re.sub(r'<[^>]+>', ' ', content)  # Remove HTML tags
            content = re.sub(r'\s+', ' ', content)  # Normalize whitespace
            
            return content.strip()
    except Exception as e:
        print(f"Error fetching {url}: {e}")
        return None


async def extract_events_from_website(url: str, society_name: str) -> Dict[str, Any]:
    """Use Gemini to extract events from a website"""
    if not GEMINI_AVAILABLE or not EMERGENT_LLM_KEY:
        return {
            "success": False,
            "error": "Gemini integration not available",
            "events": [],
            "specialties_detected": []
        }
    
    # Fetch website content
    content = await fetch_website_content(url)
    if not content:
        return {
            "success": False,
            "error": "Could not fetch website content",
            "events": [],
            "specialties_detected": []
        }
    
    try:
        # Initialize Gemini chat
        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=f"scrape-{society_name}-{datetime.now().strftime('%Y%m%d%H%M%S')}",
            system_message=EVENT_EXTRACTION_PROMPT
        ).with_model("gemini", "gemini-3-flash-preview")
        
        # Send content for analysis
        user_message = UserMessage(
            text=f"Extract events from this medical society website ({society_name}):\n\n{content[:30000]}"
        )
        
        response = await chat.send_message(user_message)
        
        # Parse JSON response
        try:
            # Try to extract JSON from response
            json_match = re.search(r'\{[\s\S]*\}', response)
            if json_match:
                result = json.loads(json_match.group())
                return {
                    "success": True,
                    "events": result.get("events", []),
                    "specialties_detected": result.get("specialties_detected", []),
                    "scrape_notes": result.get("scrape_notes", "")
                }
        except json.JSONDecodeError:
            pass
        
        return {
            "success": True,
            "events": [],
            "specialties_detected": [],
            "scrape_notes": "Could not parse structured response",
            "raw_response": response[:1000]
        }
        
    except Exception as e:
        return {
            "success": False,
            "error": str(e),
            "events": [],
            "specialties_detected": []
        }


async def extract_info_from_file(file_path: str, file_type: str) -> Dict[str, Any]:
    """Use Gemini to extract information from PDF or image"""
    if not GEMINI_AVAILABLE or not EMERGENT_LLM_KEY:
        return {
            "success": False,
            "error": "Gemini integration not available"
        }
    
    try:
        # Read file content
        if file_type == "pdf":
            # For PDF, we'd need a PDF parser - for now, return placeholder
            # In production, use PyPDF2 or similar
            return {
                "success": False,
                "error": "PDF parsing requires additional libraries",
                "suggestion": "Upload as text or image instead"
            }
        
        # For images, we could use Gemini's vision capabilities
        # For now, return placeholder
        return {
            "success": False,
            "error": "Image analysis requires vision model",
            "suggestion": "Paste text content directly"
        }
        
    except Exception as e:
        return {
            "success": False,
            "error": str(e)
        }


async def extract_info_from_text(text_content: str, context: str = "medical society") -> Dict[str, Any]:
    """Use Gemini to extract structured info from raw text"""
    if not GEMINI_AVAILABLE or not EMERGENT_LLM_KEY:
        return {
            "success": False,
            "error": "Gemini integration not available"
        }
    
    try:
        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=f"text-extract-{datetime.now().strftime('%Y%m%d%H%M%S')}",
            system_message=PDF_EXTRACTION_PROMPT
        ).with_model("gemini", "gemini-3-flash-preview")
        
        user_message = UserMessage(
            text=f"Extract events and medical information from this {context} content:\n\n{text_content[:20000]}"
        )
        
        response = await chat.send_message(user_message)
        
        # Parse JSON response
        try:
            json_match = re.search(r'\{[\s\S]*\}', response)
            if json_match:
                result = json.loads(json_match.group())
                return {
                    "success": True,
                    "events": result.get("events", []),
                    "medications": result.get("medications", []),
                    "specialties_detected": result.get("specialties_detected", []),
                    "key_information": result.get("key_information", "")
                }
        except json.JSONDecodeError:
            pass
        
        return {
            "success": True,
            "events": [],
            "raw_response": response[:1000]
        }
        
    except Exception as e:
        return {
            "success": False,
            "error": str(e)
        }
