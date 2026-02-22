"""
Content AI Service - Generate thumbnails and descriptions using Gemini
Uses Nanobanana for image generation and Gemini for text generation
"""
import os
import base64
import logging
import uuid
from datetime import datetime, timezone
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)

# Initialize Emergent integrations
try:
    from emergentintegrations.llm.chat import LlmChat, UserMessage, ImageContent
    EMERGENT_AVAILABLE = True
except ImportError:
    EMERGENT_AVAILABLE = False
    logger.warning("emergentintegrations not available")


async def generate_youtube_thumbnail(
    title: str,
    description: str = "",
    style: str = "professional"
) -> dict:
    """
    Generate a YouTube thumbnail using Gemini Nano Banana.
    
    Args:
        title: Content/video title
        description: Optional description for context
        style: Style preference (professional, creative, bold, minimal)
    
    Returns:
        dict with success status, image_base64, and mime_type
    """
    if not EMERGENT_AVAILABLE:
        return {"success": False, "error": "Emergent integrations not available"}
    
    api_key = os.getenv("EMERGENT_LLM_KEY")
    if not api_key:
        return {"success": False, "error": "EMERGENT_LLM_KEY not configured"}
    
    # Create style-specific prompts
    style_prompts = {
        "professional": "professional, clean, corporate style with subtle gradients",
        "creative": "creative, artistic, vibrant colors with dynamic composition",
        "bold": "bold typography, high contrast, eye-catching with striking colors",
        "minimal": "minimalist, elegant, simple with lots of white space"
    }
    
    style_desc = style_prompts.get(style, style_prompts["professional"])
    
    # Build the prompt for thumbnail generation
    prompt = f"""Create a YouTube video thumbnail image with the following specifications:
    
Title: "{title}"
Style: {style_desc}

Requirements:
- Aspect ratio: 16:9 (YouTube thumbnail standard)
- Include visual elements that represent the topic
- Make it eye-catching and professional
- Use colors that stand out
- Do NOT include any text in the image - just visual elements
- The design should be suitable for a business/educational YouTube channel
- Focus on creating an engaging visual that would make viewers want to click

Additional context from description: {description[:200] if description else 'Business/educational content'}
"""
    
    try:
        session_id = f"thumbnail-{uuid.uuid4()}"
        chat = LlmChat(
            api_key=api_key,
            session_id=session_id,
            system_message="You are an expert graphic designer specializing in YouTube thumbnails"
        )
        chat.with_model("gemini", "gemini-3-pro-image-preview").with_params(modalities=["image", "text"])
        
        msg = UserMessage(text=prompt)
        
        text_response, images = await chat.send_message_multimodal_response(msg)
        
        if images and len(images) > 0:
            image_data = images[0]
            logger.info(f"Thumbnail generated successfully, mime_type: {image_data.get('mime_type')}")
            
            return {
                "success": True,
                "image_base64": image_data.get("data"),
                "mime_type": image_data.get("mime_type", "image/png"),
                "text_response": text_response
            }
        else:
            return {
                "success": False,
                "error": "No image generated",
                "text_response": text_response
            }
            
    except Exception as e:
        logger.error(f"Error generating thumbnail: {e}")
        return {
            "success": False,
            "error": str(e)
        }


async def generate_youtube_description(
    title: str,
    dictation_text: str = "",
    competency: str = "",
    thematic_axis: str = "",
    language: str = "es"
) -> dict:
    """
    Generate a YouTube video description using Gemini.
    
    Args:
        title: Video title
        dictation_text: Raw dictation/content text
        competency: Associated competency name
        thematic_axis: Associated thematic axis name
        language: Output language (es=Spanish, en=English)
    
    Returns:
        dict with success status and generated description
    """
    if not EMERGENT_AVAILABLE:
        return {"success": False, "error": "Emergent integrations not available"}
    
    api_key = os.getenv("EMERGENT_LLM_KEY")
    if not api_key:
        return {"success": False, "error": "EMERGENT_LLM_KEY not configured"}
    
    lang_instructions = {
        "es": "Escribe la descripción en español de España/Latinoamérica profesional.",
        "en": "Write the description in professional English."
    }
    
    prompt = f"""Generate a compelling YouTube video description based on the following information:

Video Title: "{title}"

Content/Script Summary:
{dictation_text[:2000] if dictation_text else "No script provided"}

Topic Area: {thematic_axis if thematic_axis else "Business/Leadership"}
Specific Skill: {competency if competency else "Professional Development"}

{lang_instructions.get(language, lang_instructions["es"])}

Requirements:
1. Start with a hook that captures attention (2-3 sentences)
2. Summarize the key takeaways (3-5 bullet points)
3. Include a call-to-action to subscribe
4. Add relevant hashtags at the end (5-7 hashtags)
5. Keep total length between 500-1000 characters
6. Make it SEO-friendly with natural keyword placement

Format the output as:
[HOOK]
...

[KEY TAKEAWAYS]
• ...
• ...

[CTA]
...

[HASHTAGS]
#... #... #...
"""
    
    try:
        session_id = f"description-{uuid.uuid4()}"
        chat = LlmChat(
            api_key=api_key,
            session_id=session_id,
            system_message="You are an expert YouTube content strategist and copywriter"
        )
        chat.with_model("gemini", "gemini-2.0-flash")
        
        msg = UserMessage(text=prompt)
        
        response = await chat.send_message(msg)
        
        if response:
            logger.info(f"Description generated successfully, length: {len(response)}")
            return {
                "success": True,
                "description": response,
                "language": language
            }
        else:
            return {
                "success": False,
                "error": "Empty response from Gemini"
            }
            
    except Exception as e:
        logger.error(f"Error generating description: {e}")
        return {
            "success": False,
            "error": str(e)
        }


async def generate_blog_post(
    title: str,
    dictation_text: str,
    language: str = "es",
    word_count: int = 800
) -> dict:
    """
    Generate a blog post from dictation text using Gemini.
    
    Args:
        title: Post title
        dictation_text: Raw dictation/content text
        language: Output language (es/en)
        word_count: Target word count
    
    Returns:
        dict with success status, blog_html, and blog_markdown
    """
    if not EMERGENT_AVAILABLE:
        return {"success": False, "error": "Emergent integrations not available"}
    
    api_key = os.getenv("EMERGENT_LLM_KEY")
    if not api_key:
        return {"success": False, "error": "EMERGENT_LLM_KEY not configured"}
    
    lang_instructions = {
        "es": "Escribe el artículo en español profesional.",
        "en": "Write the article in professional English."
    }
    
    prompt = f"""Transform the following dictation into a well-structured blog post:

Original Title: "{title}"

Raw Dictation:
{dictation_text[:4000]}

{lang_instructions.get(language, lang_instructions["es"])}

Requirements:
1. Start with a translated/adapted title for the article (put it as the first H1 header)
2. Create a compelling introduction
3. Organize content into clear sections with H2 headers
4. Include practical examples or tips
5. Add a conclusion with key takeaways
6. Target approximately {word_count} words
7. Use a professional but approachable tone
8. Format in Markdown

IMPORTANT: The first line MUST be the title as an H1 header (# Title Here) in {language.upper()}.

Output the blog post in Markdown format.
"""
    
    try:
        session_id = f"blog-{uuid.uuid4()}"
        chat = LlmChat(
            api_key=api_key,
            session_id=session_id,
            system_message="You are an expert content writer and editor"
        )
        chat.with_model("gemini", "gemini-2.0-flash")
        
        msg = UserMessage(text=prompt)
        
        response = await chat.send_message(msg)
        
        if response:
            logger.info(f"Blog post generated successfully, length: {len(response)}")
            return {
                "success": True,
                "blog_markdown": response,
                "language": language
            }
        else:
            return {
                "success": False,
                "error": "Empty response from Gemini"
            }
            
    except Exception as e:
        logger.error(f"Error generating blog post: {e}")
        return {
            "success": False,
            "error": str(e)
        }
