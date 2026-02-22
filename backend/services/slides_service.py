"""
Google Slides Generation Service
Creates presentation slides from ContentItem text using AI structuring and Google Slides API
"""
import os
import uuid
import logging
from typing import List, Dict, Optional
from datetime import datetime, timezone

from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build

logger = logging.getLogger(__name__)

# Initialize Emergent integrations for AI
try:
    from emergentintegrations.llm.chat import LlmChat, UserMessage
    EMERGENT_AVAILABLE = True
except ImportError:
    EMERGENT_AVAILABLE = False
    logger.warning("emergentintegrations not available for slides")


async def structure_content_for_slides(
    title: str,
    content_text: str,
    competency: str = "",
    thematic_axis: str = ""
) -> Dict:
    """
    Use AI to structure content text into slide format.
    Returns structured data with slides, each having title, bullets, and image suggestions.
    """
    if not EMERGENT_AVAILABLE:
        return {"success": False, "error": "Emergent integrations not available"}
    
    api_key = os.getenv("EMERGENT_LLM_KEY")
    if not api_key:
        return {"success": False, "error": "EMERGENT_LLM_KEY not configured"}
    
    prompt = f"""Analiza el siguiente contenido y estructúralo en diapositivas de presentación.

TÍTULO: {title}
TEMA: {thematic_axis if thematic_axis else "Desarrollo profesional"}
COMPETENCIA: {competency if competency else "Habilidades de liderazgo"}

CONTENIDO:
{content_text[:4000]}

Genera una estructura de presentación con 6-10 diapositivas. Para cada diapositiva incluye:
1. Un título claro y conciso
2. 2-4 puntos clave (bullets) - frases cortas y fáciles de leer
3. Una sugerencia de imagen que apoye el contenido (descripción breve)

Responde SOLO en formato JSON válido con esta estructura exacta:
{{
  "slides": [
    {{
      "title": "Título de la diapositiva",
      "bullets": ["Punto 1", "Punto 2", "Punto 3"],
      "image_suggestion": "Descripción de imagen sugerida"
    }}
  ]
}}

IMPORTANTE:
- La primera diapositiva debe ser la portada con el título principal
- La última diapositiva debe ser un cierre/resumen o call-to-action
- Mantén los bullets cortos (máximo 10 palabras cada uno)
- Las diapositivas deben ser fáciles de leer y seguir
"""
    
    try:
        session_id = f"slides-structure-{uuid.uuid4()}"
        chat = LlmChat(
            api_key=api_key,
            session_id=session_id,
            system_message="Eres un experto en diseño de presentaciones. Crea estructuras claras y profesionales."
        )
        chat.with_model("gemini", "gemini-2.0-flash")
        
        msg = UserMessage(text=prompt)
        response = await chat.send_message(msg)
        
        # Parse JSON response
        import json
        # Clean response - remove markdown code blocks if present
        clean_response = response.strip()
        if clean_response.startswith("```json"):
            clean_response = clean_response[7:]
        if clean_response.startswith("```"):
            clean_response = clean_response[3:]
        if clean_response.endswith("```"):
            clean_response = clean_response[:-3]
        
        slides_data = json.loads(clean_response.strip())
        
        logger.info(f"Structured content into {len(slides_data.get('slides', []))} slides")
        return {
            "success": True,
            "slides": slides_data.get("slides", [])
        }
        
    except Exception as e:
        logger.error(f"Error structuring content for slides: {e}")
        return {
            "success": False,
            "error": str(e)
        }


async def generate_slide_image(image_description: str, slide_title: str) -> Optional[str]:
    """
    Generate a supporting image for a slide using Gemini Nano Banana.
    Returns base64 encoded image data or None if generation fails.
    """
    if not EMERGENT_AVAILABLE:
        return None
    
    api_key = os.getenv("EMERGENT_LLM_KEY")
    if not api_key:
        return None
    
    prompt = f"""Create a visually striking, modern illustration for a presentation slide about: "{slide_title}"

Context: {image_description}

Style requirements:
- Modern, bold graphic design style
- Dark background (near black) with vibrant accent colors
- Abstract or conceptual representation - NOT literal
- Use geometric shapes, gradients, light effects
- Colors: use purples, teals, oranges, pinks on dark background
- NO text, NO words, NO letters in the image
- Professional business presentation aesthetic
- Clean composition with visual impact
- Aspect ratio: landscape 16:9
"""
    
    try:
        session_id = f"slide-image-{uuid.uuid4()}"
        chat = LlmChat(
            api_key=api_key,
            session_id=session_id,
            system_message="You are an expert graphic designer creating bold, modern presentation visuals."
        )
        chat.with_model("gemini", "gemini-3-pro-image-preview").with_params(modalities=["image", "text"])
        
        msg = UserMessage(text=prompt)
        text_response, images = await chat.send_message_multimodal_response(msg)
        
        if images and len(images) > 0:
            logger.info(f"Generated image for slide: {slide_title[:30]}...")
            return images[0].get("data")
        return None
        
    except Exception as e:
        logger.error(f"Error generating slide image: {e}")
        return None


async def upload_image_to_drive(credentials_dict: dict, image_base64: str, filename: str) -> Optional[str]:
    """
    Upload a base64 image to Google Drive and return a public URL.
    """
    from config import GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET
    import base64
    import io
    
    try:
        credentials = Credentials(
            token=credentials_dict.get("token"),
            refresh_token=credentials_dict.get("refresh_token"),
            token_uri=credentials_dict.get("token_uri", "https://oauth2.googleapis.com/token"),
            client_id=credentials_dict.get("client_id", GOOGLE_CLIENT_ID),
            client_secret=credentials_dict.get("client_secret", GOOGLE_CLIENT_SECRET),
        )
        
        drive_service = build('drive', 'v3', credentials=credentials, cache_discovery=False)
        
        # Decode base64 image
        image_data = base64.b64decode(image_base64)
        
        # Create file metadata
        file_metadata = {
            'name': filename,
            'mimeType': 'image/png'
        }
        
        # Upload file
        from googleapiclient.http import MediaIoBaseUpload
        media = MediaIoBaseUpload(io.BytesIO(image_data), mimetype='image/png')
        
        file = drive_service.files().create(
            body=file_metadata,
            media_body=media,
            fields='id,webContentLink'
        ).execute()
        
        file_id = file.get('id')
        
        # Make file publicly accessible
        drive_service.permissions().create(
            fileId=file_id,
            body={'type': 'anyone', 'role': 'reader'}
        ).execute()
        
        # Get direct download link
        file = drive_service.files().get(fileId=file_id, fields='webContentLink').execute()
        web_link = file.get('webContentLink', '')
        
        # Convert to direct image URL - use lh3.googleusercontent.com for better CORS support
        if web_link:
            # This format works better in browsers without CORS issues
            image_url = f"https://lh3.googleusercontent.com/d/{file_id}"
            logger.info(f"Uploaded image to Drive: {image_url}")
            return image_url
        
        return None
        
    except Exception as e:
        logger.error(f"Error uploading image to Drive: {e}")
        return None


async def create_google_slides_with_images(
    credentials_dict: dict,
    title: str,
    slides_data: List[Dict]
) -> Dict:
    """
    Create a Google Slides presentation with AI-generated images for each slide.
    """
    from config import GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET
    
    try:
        credentials = Credentials(
            token=credentials_dict.get("token"),
            refresh_token=credentials_dict.get("refresh_token"),
            token_uri=credentials_dict.get("token_uri", "https://oauth2.googleapis.com/token"),
            client_id=credentials_dict.get("client_id", GOOGLE_CLIENT_ID),
            client_secret=credentials_dict.get("client_secret", GOOGLE_CLIENT_SECRET),
        )
        
        slides_service = build('slides', 'v1', credentials=credentials, cache_discovery=False)
        
        # Create presentation
        presentation = slides_service.presentations().create(
            body={'title': title}
        ).execute()
        
        presentation_id = presentation['presentationId']
        logger.info(f"Created presentation: {presentation_id}")
        
        default_slide_id = presentation['slides'][0]['objectId']
        
        # Design colors
        COLORS = {
            'bg_dark': {'red': 0.06, 'green': 0.06, 'blue': 0.08},
            'white': {'red': 1.0, 'green': 1.0, 'blue': 1.0},
            'gray': {'red': 0.85, 'green': 0.85, 'blue': 0.88},
            'accent': {'red': 0.4, 'green': 0.4, 'blue': 1.0},
        }
        
        ACCENT_COLORS = [
            {'red': 0.4, 'green': 0.4, 'blue': 1.0},      # Purple
            {'red': 0.49, 'green': 0.83, 'blue': 0.76},   # Teal
            {'red': 1.0, 'green': 0.58, 'blue': 0.33},    # Orange
            {'red': 0.96, 'green': 0.43, 'blue': 0.61},   # Pink
        ]
        
        requests = []
        requests.append({'deleteObject': {'objectId': default_slide_id}})
        
        total_slides = len(slides_data)
        image_urls = []
        
        # COST OPTIMIZATION: Only generate images for key slides
        # - Slide 0: Title/cover (always has image)
        # - Slide 1: First content slide (has image)
        # - Middle slide: One image for visual variety
        # - Last slide: Closing/CTA (has image)
        # Other slides: Text-only with styled backgrounds
        
        middle_idx = total_slides // 2
        slides_with_images = {0, 1, middle_idx, total_slides - 1}
        # Remove duplicates if total_slides is small
        slides_with_images = sorted(set(slides_with_images))
        
        images_to_generate = len([i for i in slides_with_images if i < total_slides])
        logger.info(f"Generating {images_to_generate} images for {total_slides} slides (cost optimization enabled)")
        
        for idx, slide in enumerate(slides_data):
            slide_title = slide.get('title', f'Slide {idx + 1}')
            image_suggestion = slide.get('image_suggestion', slide_title)
            
            # Only generate images for key slides
            if idx in slides_with_images:
                logger.info(f"Generating image for slide {idx + 1} (key slide)...")
                image_base64 = await generate_slide_image(image_suggestion, slide_title)
                
                if image_base64:
                    filename = f"slide_{idx}_{uuid.uuid4().hex[:6]}.png"
                    image_url = await upload_image_to_drive(credentials_dict, image_base64, filename)
                    image_urls.append(image_url)
                else:
                    image_urls.append(None)
            else:
                # Text-only slide - no image generation
                image_urls.append(None)
                logger.info(f"Slide {idx + 1}: text-only (saving costs)")
            
            logger.info(f"Processed slide {idx + 1}/{total_slides}")
        
        # Create slides with images
        for idx, slide in enumerate(slides_data):
            slide_id = f"slide_{idx}_{uuid.uuid4().hex[:8]}"
            title_id = f"title_{idx}_{uuid.uuid4().hex[:8]}"
            body_id = f"body_{idx}_{uuid.uuid4().hex[:8]}"
            image_id = f"image_{idx}_{uuid.uuid4().hex[:8]}"
            overlay_id = f"overlay_{idx}_{uuid.uuid4().hex[:8]}"
            
            accent_color = ACCENT_COLORS[idx % len(ACCENT_COLORS)]
            is_title_slide = idx == 0
            is_closing = idx == total_slides - 1
            has_image = image_urls[idx] is not None
            
            # Create blank slide
            requests.append({
                'createSlide': {
                    'objectId': slide_id,
                    'insertionIndex': idx,
                    'slideLayoutReference': {'predefinedLayout': 'BLANK'}
                }
            })
            
            # Set dark background
            requests.append({
                'updatePageProperties': {
                    'objectId': slide_id,
                    'pageProperties': {
                        'pageBackgroundFill': {
                            'solidFill': {'color': {'rgbColor': COLORS['bg_dark']}}
                        }
                    },
                    'fields': 'pageBackgroundFill'
                }
            })
            
            title_text = slide.get('title', f'Slide {idx + 1}')
            bullets = slide.get('bullets', [])
            
            # Add image if available
            if has_image:
                # Full slide image with slight transparency effect via overlay
                requests.append({
                    'createImage': {
                        'objectId': image_id,
                        'url': image_urls[idx],
                        'elementProperties': {
                            'pageObjectId': slide_id,
                            'size': {
                                'width': {'magnitude': 720, 'unit': 'PT'},
                                'height': {'magnitude': 405, 'unit': 'PT'}
                            },
                            'transform': {
                                'scaleX': 1,
                                'scaleY': 1,
                                'translateX': 0,
                                'translateY': 0,
                                'unit': 'PT'
                            }
                        }
                    }
                })
                
                # Semi-transparent overlay for text readability
                requests.append({
                    'createShape': {
                        'objectId': overlay_id,
                        'shapeType': 'RECTANGLE',
                        'elementProperties': {
                            'pageObjectId': slide_id,
                            'size': {
                                'width': {'magnitude': 720, 'unit': 'PT'},
                                'height': {'magnitude': 405, 'unit': 'PT'}
                            },
                            'transform': {
                                'scaleX': 1,
                                'scaleY': 1,
                                'translateX': 0,
                                'translateY': 0,
                                'unit': 'PT'
                            }
                        }
                    }
                })
                requests.append({
                    'updateShapeProperties': {
                        'objectId': overlay_id,
                        'shapeProperties': {
                            'shapeBackgroundFill': {
                                'solidFill': {
                                    'color': {'rgbColor': {'red': 0, 'green': 0, 'blue': 0}},
                                    'alpha': 0.55
                                }
                            },
                            'outline': {'propertyState': 'NOT_RENDERED'}
                        },
                        'fields': 'shapeBackgroundFill,outline'
                    }
                })
            else:
                # TEXT-ONLY SLIDE: Add decorative accent shapes for visual interest
                # Large accent shape on the right side
                deco_id = f"deco_{idx}_{uuid.uuid4().hex[:8]}"
                deco_style = idx % 3  # Vary the decoration style
                
                if deco_style == 0:
                    # Vertical stripe on the right
                    requests.append({
                        'createShape': {
                            'objectId': deco_id,
                            'shapeType': 'RECTANGLE',
                            'elementProperties': {
                                'pageObjectId': slide_id,
                                'size': {
                                    'width': {'magnitude': 120, 'unit': 'PT'},
                                    'height': {'magnitude': 405, 'unit': 'PT'}
                                },
                                'transform': {
                                    'scaleX': 1,
                                    'scaleY': 1,
                                    'translateX': 600,
                                    'translateY': 0,
                                    'unit': 'PT'
                                }
                            }
                        }
                    })
                elif deco_style == 1:
                    # Large circle on the right
                    requests.append({
                        'createShape': {
                            'objectId': deco_id,
                            'shapeType': 'ELLIPSE',
                            'elementProperties': {
                                'pageObjectId': slide_id,
                                'size': {
                                    'width': {'magnitude': 300, 'unit': 'PT'},
                                    'height': {'magnitude': 300, 'unit': 'PT'}
                                },
                                'transform': {
                                    'scaleX': 1,
                                    'scaleY': 1,
                                    'translateX': 480,
                                    'translateY': 60,
                                    'unit': 'PT'
                                }
                            }
                        }
                    })
                else:
                    # Diagonal accent bar
                    requests.append({
                        'createShape': {
                            'objectId': deco_id,
                            'shapeType': 'PARALLELOGRAM',
                            'elementProperties': {
                                'pageObjectId': slide_id,
                                'size': {
                                    'width': {'magnitude': 250, 'unit': 'PT'},
                                    'height': {'magnitude': 405, 'unit': 'PT'}
                                },
                                'transform': {
                                    'scaleX': 1,
                                    'scaleY': 1,
                                    'translateX': 500,
                                    'translateY': 0,
                                    'unit': 'PT'
                                }
                            }
                        }
                    })
                
                # Apply accent color with transparency
                requests.append({
                    'updateShapeProperties': {
                        'objectId': deco_id,
                        'shapeProperties': {
                            'shapeBackgroundFill': {
                                'solidFill': {
                                    'color': {'rgbColor': accent_color},
                                    'alpha': 0.25
                                }
                            },
                            'outline': {'propertyState': 'NOT_RENDERED'}
                        },
                        'fields': 'shapeBackgroundFill,outline'
                    }
                })
            
            # Title positioning based on slide type
            if is_title_slide:
                title_y, title_size = 140, 42
            elif is_closing:
                title_y, title_size = 160, 38
            else:
                title_y, title_size = 30, 28
            
            # Add accent line
            accent_id = f"accent_{idx}_{uuid.uuid4().hex[:8]}"
            requests.append({
                'createShape': {
                    'objectId': accent_id,
                    'shapeType': 'RECTANGLE',
                    'elementProperties': {
                        'pageObjectId': slide_id,
                        'size': {
                            'width': {'magnitude': 80 if not is_title_slide else 150, 'unit': 'PT'},
                            'height': {'magnitude': 4, 'unit': 'PT'}
                        },
                        'transform': {
                            'scaleX': 1,
                            'scaleY': 1,
                            'translateX': 40 if not is_title_slide else 285,
                            'translateY': title_y + title_size + 10,
                            'unit': 'PT'
                        }
                    }
                }
            })
            requests.append({
                'updateShapeProperties': {
                    'objectId': accent_id,
                    'shapeProperties': {
                        'shapeBackgroundFill': {'solidFill': {'color': {'rgbColor': accent_color}}},
                        'outline': {'propertyState': 'NOT_RENDERED'}
                    },
                    'fields': 'shapeBackgroundFill,outline'
                }
            })
            
            # Title text
            requests.append({
                'createShape': {
                    'objectId': title_id,
                    'shapeType': 'TEXT_BOX',
                    'elementProperties': {
                        'pageObjectId': slide_id,
                        'size': {
                            'width': {'magnitude': 640, 'unit': 'PT'},
                            'height': {'magnitude': title_size + 20, 'unit': 'PT'}
                        },
                        'transform': {
                            'scaleX': 1,
                            'scaleY': 1,
                            'translateX': 40,
                            'translateY': title_y,
                            'unit': 'PT'
                        }
                    }
                }
            })
            requests.append({'insertText': {'objectId': title_id, 'text': title_text}})
            requests.append({
                'updateTextStyle': {
                    'objectId': title_id,
                    'style': {
                        'foregroundColor': {'opaqueColor': {'rgbColor': COLORS['white']}},
                        'fontSize': {'magnitude': title_size, 'unit': 'PT'},
                        'bold': True,
                        'fontFamily': 'Montserrat'
                    },
                    'textRange': {'type': 'ALL'},
                    'fields': 'foregroundColor,fontSize,bold,fontFamily'
                }
            })
            
            if is_title_slide or is_closing:
                requests.append({
                    'updateParagraphStyle': {
                        'objectId': title_id,
                        'style': {'alignment': 'CENTER'},
                        'textRange': {'type': 'ALL'},
                        'fields': 'alignment'
                    }
                })
            
            # Bullets
            if bullets and not is_title_slide:
                bullet_text = '\n'.join(f'→  {b}' for b in bullets)
                requests.append({
                    'createShape': {
                        'objectId': body_id,
                        'shapeType': 'TEXT_BOX',
                        'elementProperties': {
                            'pageObjectId': slide_id,
                            'size': {
                                'width': {'magnitude': 400, 'unit': 'PT'},
                                'height': {'magnitude': 280, 'unit': 'PT'}
                            },
                            'transform': {
                                'scaleX': 1,
                                'scaleY': 1,
                                'translateX': 40,
                                'translateY': title_y + title_size + 35,
                                'unit': 'PT'
                            }
                        }
                    }
                })
                requests.append({'insertText': {'objectId': body_id, 'text': bullet_text}})
                requests.append({
                    'updateTextStyle': {
                        'objectId': body_id,
                        'style': {
                            'foregroundColor': {'opaqueColor': {'rgbColor': COLORS['gray']}},
                            'fontSize': {'magnitude': 16, 'unit': 'PT'},
                            'fontFamily': 'Open Sans'
                        },
                        'textRange': {'type': 'ALL'},
                        'fields': 'foregroundColor,fontSize,fontFamily'
                    }
                })
        
        # Execute batch update
        if requests:
            slides_service.presentations().batchUpdate(
                presentationId=presentation_id,
                body={'requests': requests}
            ).execute()
        
        # Share the presentation publicly (anyone with link can view)
        try:
            drive_service = build('drive', 'v3', credentials=credentials, cache_discovery=False)
            drive_service.permissions().create(
                fileId=presentation_id,
                body={'type': 'anyone', 'role': 'reader'}
            ).execute()
            logger.info(f"Presentation shared publicly: {presentation_id}")
        except Exception as share_error:
            logger.warning(f"Could not share presentation publicly: {share_error}")
        
        presentation_url = f"https://docs.google.com/presentation/d/{presentation_id}/edit"
        logger.info(f"Slides with images created: {presentation_url}")
        
        return {
            "success": True,
            "presentation_id": presentation_id,
            "url": presentation_url,
            "slides_count": len(slides_data),
            "images_generated": sum(1 for url in image_urls if url),
            "image_urls": [url for url in image_urls if url]  # Return the image URLs
        }
        
    except Exception as e:
        error_str = str(e)
        logger.error(f"Error creating slides with images: {error_str}")
        
        if "SCOPE_INSUFFICIENT" in error_str:
            return {
                "success": False,
                "error": "ACCESS_TOKEN_SCOPE_INSUFFICIENT: Reconecta Google en Settings"
            }
        
        return {"success": False, "error": error_str}


def create_google_slides_presentation(
    credentials_dict: dict,
    title: str,
    slides_data: List[Dict]
) -> Dict:
    """
    Create a Google Slides presentation with the structured content.
    
    Args:
        credentials_dict: Google OAuth credentials
        title: Presentation title
        slides_data: List of slide dictionaries with title, bullets, image_suggestion
    
    Returns:
        Dict with presentation_id, url, and status
    """
    from config import GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET
    
    try:
        credentials = Credentials(
            token=credentials_dict.get("token"),
            refresh_token=credentials_dict.get("refresh_token"),
            token_uri=credentials_dict.get("token_uri", "https://oauth2.googleapis.com/token"),
            client_id=credentials_dict.get("client_id", GOOGLE_CLIENT_ID),
            client_secret=credentials_dict.get("client_secret", GOOGLE_CLIENT_SECRET),
        )
        
        # Build Slides service
        slides_service = build('slides', 'v1', credentials=credentials, cache_discovery=False)
        
        # Create presentation
        presentation = slides_service.presentations().create(
            body={'title': title}
        ).execute()
        
        presentation_id = presentation['presentationId']
        logger.info(f"Created presentation: {presentation_id}")
        
        # Get the default slide ID to delete it later
        default_slide_id = presentation['slides'][0]['objectId']
        
        # Design constants - Professional dark theme with variations
        COLORS = {
            'bg_dark': {'red': 0.067, 'green': 0.067, 'blue': 0.078},      # #111114
            'bg_medium': {'red': 0.098, 'green': 0.098, 'blue': 0.118},    # #191920
            'bg_accent': {'red': 0.388, 'green': 0.400, 'blue': 1.0},      # #6366FF purple
            'accent_teal': {'red': 0.490, 'green': 0.831, 'blue': 0.761},  # #7DD4C2
            'accent_orange': {'red': 1.0, 'green': 0.584, 'blue': 0.329},  # #FF9554
            'accent_pink': {'red': 0.957, 'green': 0.427, 'blue': 0.612},  # #F46D9C
            'white': {'red': 1.0, 'green': 1.0, 'blue': 1.0},
            'gray_light': {'red': 0.878, 'green': 0.878, 'blue': 0.898},   # #E0E0E5
            'gray_medium': {'red': 0.6, 'green': 0.6, 'blue': 0.65},
        }
        
        # Layout types for variety
        LAYOUTS = ['title', 'left_accent', 'right_accent', 'top_bar', 'bottom_accent', 'quote', 'closing']
        ACCENT_COLORS = ['bg_accent', 'accent_teal', 'accent_orange', 'accent_pink']
        
        total_slides = len(slides_data)
        
        # Build batch requests for all slides
        requests = []
        
        # Delete the default blank slide
        requests.append({
            'deleteObject': {
                'objectId': default_slide_id
            }
        })
        
        # Create slides with varied layouts
        for idx, slide in enumerate(slides_data):
            slide_id = f"slide_{idx}_{uuid.uuid4().hex[:8]}"
            title_id = f"title_{idx}_{uuid.uuid4().hex[:8]}"
            body_id = f"body_{idx}_{uuid.uuid4().hex[:8]}"
            accent_id = f"accent_{idx}_{uuid.uuid4().hex[:8]}"
            shape_id = f"shape_{idx}_{uuid.uuid4().hex[:8]}"
            
            # Determine layout type
            if idx == 0:
                layout_type = 'title'
            elif idx == total_slides - 1:
                layout_type = 'closing'
            elif idx % 5 == 2:
                layout_type = 'quote'
            elif idx % 3 == 0:
                layout_type = 'left_accent'
            elif idx % 3 == 1:
                layout_type = 'right_accent'
            else:
                layout_type = 'top_bar'
            
            # Cycle through accent colors
            accent_color_key = ACCENT_COLORS[idx % len(ACCENT_COLORS)]
            accent_color = COLORS[accent_color_key]
            
            # Background color - alternate slightly
            bg_color = COLORS['bg_dark'] if idx % 2 == 0 else COLORS['bg_medium']
            
            # Create blank slide
            requests.append({
                'createSlide': {
                    'objectId': slide_id,
                    'insertionIndex': idx,
                    'slideLayoutReference': {'predefinedLayout': 'BLANK'}
                }
            })
            
            # Set background
            requests.append({
                'updatePageProperties': {
                    'objectId': slide_id,
                    'pageProperties': {
                        'pageBackgroundFill': {
                            'solidFill': {'color': {'rgbColor': bg_color}}
                        }
                    },
                    'fields': 'pageBackgroundFill'
                }
            })
            
            title_text = slide.get('title', f'Slide {idx + 1}')
            bullets = slide.get('bullets', [])
            
            # ===== LAYOUT: TITLE SLIDE =====
            if layout_type == 'title':
                # Large accent bar at top
                requests.append({
                    'createShape': {
                        'objectId': accent_id,
                        'shapeType': 'RECTANGLE',
                        'elementProperties': {
                            'pageObjectId': slide_id,
                            'size': {'width': {'magnitude': 720, 'unit': 'PT'}, 'height': {'magnitude': 15, 'unit': 'PT'}},
                            'transform': {'scaleX': 1, 'scaleY': 1, 'translateX': 0, 'translateY': 0, 'unit': 'PT'}
                        }
                    }
                })
                requests.append({
                    'updateShapeProperties': {
                        'objectId': accent_id,
                        'shapeProperties': {
                            'shapeBackgroundFill': {'solidFill': {'color': {'rgbColor': accent_color}}},
                            'outline': {'propertyState': 'NOT_RENDERED'}
                        },
                        'fields': 'shapeBackgroundFill,outline'
                    }
                })
                # Centered title
                requests.append({
                    'createShape': {
                        'objectId': title_id,
                        'shapeType': 'TEXT_BOX',
                        'elementProperties': {
                            'pageObjectId': slide_id,
                            'size': {'width': {'magnitude': 660, 'unit': 'PT'}, 'height': {'magnitude': 150, 'unit': 'PT'}},
                            'transform': {'scaleX': 1, 'scaleY': 1, 'translateX': 30, 'translateY': 150, 'unit': 'PT'}
                        }
                    }
                })
                requests.append({'insertText': {'objectId': title_id, 'text': title_text}})
                requests.append({
                    'updateTextStyle': {
                        'objectId': title_id,
                        'style': {
                            'foregroundColor': {'opaqueColor': {'rgbColor': COLORS['white']}},
                            'fontSize': {'magnitude': 44, 'unit': 'PT'},
                            'bold': True,
                            'fontFamily': 'Montserrat'
                        },
                        'textRange': {'type': 'ALL'},
                        'fields': 'foregroundColor,fontSize,bold,fontFamily'
                    }
                })
                requests.append({
                    'updateParagraphStyle': {
                        'objectId': title_id,
                        'style': {'alignment': 'CENTER'},
                        'textRange': {'type': 'ALL'},
                        'fields': 'alignment'
                    }
                })
                # Subtitle/bullets centered below
                if bullets:
                    requests.append({
                        'createShape': {
                            'objectId': body_id,
                            'shapeType': 'TEXT_BOX',
                            'elementProperties': {
                                'pageObjectId': slide_id,
                                'size': {'width': {'magnitude': 600, 'unit': 'PT'}, 'height': {'magnitude': 100, 'unit': 'PT'}},
                                'transform': {'scaleX': 1, 'scaleY': 1, 'translateX': 60, 'translateY': 320, 'unit': 'PT'}
                            }
                        }
                    })
                    requests.append({'insertText': {'objectId': body_id, 'text': ' | '.join(bullets[:3])}})
                    requests.append({
                        'updateTextStyle': {
                            'objectId': body_id,
                            'style': {
                                'foregroundColor': {'opaqueColor': {'rgbColor': COLORS['gray_medium']}},
                                'fontSize': {'magnitude': 16, 'unit': 'PT'},
                                'fontFamily': 'Open Sans'
                            },
                            'textRange': {'type': 'ALL'},
                            'fields': 'foregroundColor,fontSize,fontFamily'
                        }
                    })
                    requests.append({
                        'updateParagraphStyle': {
                            'objectId': body_id,
                            'style': {'alignment': 'CENTER'},
                            'textRange': {'type': 'ALL'},
                            'fields': 'alignment'
                        }
                    })
            
            # ===== LAYOUT: LEFT ACCENT =====
            elif layout_type == 'left_accent':
                # Vertical accent bar on left
                requests.append({
                    'createShape': {
                        'objectId': accent_id,
                        'shapeType': 'RECTANGLE',
                        'elementProperties': {
                            'pageObjectId': slide_id,
                            'size': {'width': {'magnitude': 8, 'unit': 'PT'}, 'height': {'magnitude': 405, 'unit': 'PT'}},
                            'transform': {'scaleX': 1, 'scaleY': 1, 'translateX': 30, 'translateY': 0, 'unit': 'PT'}
                        }
                    }
                })
                requests.append({
                    'updateShapeProperties': {
                        'objectId': accent_id,
                        'shapeProperties': {
                            'shapeBackgroundFill': {'solidFill': {'color': {'rgbColor': accent_color}}},
                            'outline': {'propertyState': 'NOT_RENDERED'}
                        },
                        'fields': 'shapeBackgroundFill,outline'
                    }
                })
                # Title
                requests.append({
                    'createShape': {
                        'objectId': title_id,
                        'shapeType': 'TEXT_BOX',
                        'elementProperties': {
                            'pageObjectId': slide_id,
                            'size': {'width': {'magnitude': 620, 'unit': 'PT'}, 'height': {'magnitude': 60, 'unit': 'PT'}},
                            'transform': {'scaleX': 1, 'scaleY': 1, 'translateX': 55, 'translateY': 40, 'unit': 'PT'}
                        }
                    }
                })
                requests.append({'insertText': {'objectId': title_id, 'text': title_text}})
                requests.append({
                    'updateTextStyle': {
                        'objectId': title_id,
                        'style': {
                            'foregroundColor': {'opaqueColor': {'rgbColor': COLORS['white']}},
                            'fontSize': {'magnitude': 32, 'unit': 'PT'},
                            'bold': True,
                            'fontFamily': 'Montserrat'
                        },
                        'textRange': {'type': 'ALL'},
                        'fields': 'foregroundColor,fontSize,bold,fontFamily'
                    }
                })
                # Bullets
                if bullets:
                    bullet_text = '\n\n'.join(f'●  {b}' for b in bullets)
                    requests.append({
                        'createShape': {
                            'objectId': body_id,
                            'shapeType': 'TEXT_BOX',
                            'elementProperties': {
                                'pageObjectId': slide_id,
                                'size': {'width': {'magnitude': 620, 'unit': 'PT'}, 'height': {'magnitude': 280, 'unit': 'PT'}},
                                'transform': {'scaleX': 1, 'scaleY': 1, 'translateX': 55, 'translateY': 115, 'unit': 'PT'}
                            }
                        }
                    })
                    requests.append({'insertText': {'objectId': body_id, 'text': bullet_text}})
                    requests.append({
                        'updateTextStyle': {
                            'objectId': body_id,
                            'style': {
                                'foregroundColor': {'opaqueColor': {'rgbColor': COLORS['gray_light']}},
                                'fontSize': {'magnitude': 18, 'unit': 'PT'},
                                'fontFamily': 'Open Sans'
                            },
                            'textRange': {'type': 'ALL'},
                            'fields': 'foregroundColor,fontSize,fontFamily'
                        }
                    })
            
            # ===== LAYOUT: RIGHT ACCENT =====
            elif layout_type == 'right_accent':
                # Accent bar on right
                requests.append({
                    'createShape': {
                        'objectId': accent_id,
                        'shapeType': 'RECTANGLE',
                        'elementProperties': {
                            'pageObjectId': slide_id,
                            'size': {'width': {'magnitude': 8, 'unit': 'PT'}, 'height': {'magnitude': 405, 'unit': 'PT'}},
                            'transform': {'scaleX': 1, 'scaleY': 1, 'translateX': 682, 'translateY': 0, 'unit': 'PT'}
                        }
                    }
                })
                requests.append({
                    'updateShapeProperties': {
                        'objectId': accent_id,
                        'shapeProperties': {
                            'shapeBackgroundFill': {'solidFill': {'color': {'rgbColor': accent_color}}},
                            'outline': {'propertyState': 'NOT_RENDERED'}
                        },
                        'fields': 'shapeBackgroundFill,outline'
                    }
                })
                # Title
                requests.append({
                    'createShape': {
                        'objectId': title_id,
                        'shapeType': 'TEXT_BOX',
                        'elementProperties': {
                            'pageObjectId': slide_id,
                            'size': {'width': {'magnitude': 620, 'unit': 'PT'}, 'height': {'magnitude': 60, 'unit': 'PT'}},
                            'transform': {'scaleX': 1, 'scaleY': 1, 'translateX': 40, 'translateY': 40, 'unit': 'PT'}
                        }
                    }
                })
                requests.append({'insertText': {'objectId': title_id, 'text': title_text}})
                requests.append({
                    'updateTextStyle': {
                        'objectId': title_id,
                        'style': {
                            'foregroundColor': {'opaqueColor': {'rgbColor': COLORS['white']}},
                            'fontSize': {'magnitude': 32, 'unit': 'PT'},
                            'bold': True,
                            'fontFamily': 'Montserrat'
                        },
                        'textRange': {'type': 'ALL'},
                        'fields': 'foregroundColor,fontSize,bold,fontFamily'
                    }
                })
                # Bullets with arrow style
                if bullets:
                    bullet_text = '\n\n'.join(f'→  {b}' for b in bullets)
                    requests.append({
                        'createShape': {
                            'objectId': body_id,
                            'shapeType': 'TEXT_BOX',
                            'elementProperties': {
                                'pageObjectId': slide_id,
                                'size': {'width': {'magnitude': 620, 'unit': 'PT'}, 'height': {'magnitude': 280, 'unit': 'PT'}},
                                'transform': {'scaleX': 1, 'scaleY': 1, 'translateX': 40, 'translateY': 115, 'unit': 'PT'}
                            }
                        }
                    })
                    requests.append({'insertText': {'objectId': body_id, 'text': bullet_text}})
                    requests.append({
                        'updateTextStyle': {
                            'objectId': body_id,
                            'style': {
                                'foregroundColor': {'opaqueColor': {'rgbColor': COLORS['gray_light']}},
                                'fontSize': {'magnitude': 18, 'unit': 'PT'},
                                'fontFamily': 'Open Sans'
                            },
                            'textRange': {'type': 'ALL'},
                            'fields': 'foregroundColor,fontSize,fontFamily'
                        }
                    })
            
            # ===== LAYOUT: TOP BAR =====
            elif layout_type == 'top_bar':
                # Thin accent bar at top
                requests.append({
                    'createShape': {
                        'objectId': accent_id,
                        'shapeType': 'RECTANGLE',
                        'elementProperties': {
                            'pageObjectId': slide_id,
                            'size': {'width': {'magnitude': 720, 'unit': 'PT'}, 'height': {'magnitude': 6, 'unit': 'PT'}},
                            'transform': {'scaleX': 1, 'scaleY': 1, 'translateX': 0, 'translateY': 0, 'unit': 'PT'}
                        }
                    }
                })
                requests.append({
                    'updateShapeProperties': {
                        'objectId': accent_id,
                        'shapeProperties': {
                            'shapeBackgroundFill': {'solidFill': {'color': {'rgbColor': accent_color}}},
                            'outline': {'propertyState': 'NOT_RENDERED'}
                        },
                        'fields': 'shapeBackgroundFill,outline'
                    }
                })
                # Small number indicator
                requests.append({
                    'createShape': {
                        'objectId': shape_id,
                        'shapeType': 'TEXT_BOX',
                        'elementProperties': {
                            'pageObjectId': slide_id,
                            'size': {'width': {'magnitude': 50, 'unit': 'PT'}, 'height': {'magnitude': 40, 'unit': 'PT'}},
                            'transform': {'scaleX': 1, 'scaleY': 1, 'translateX': 650, 'translateY': 15, 'unit': 'PT'}
                        }
                    }
                })
                requests.append({'insertText': {'objectId': shape_id, 'text': f'{idx:02d}'}})
                requests.append({
                    'updateTextStyle': {
                        'objectId': shape_id,
                        'style': {
                            'foregroundColor': {'opaqueColor': {'rgbColor': accent_color}},
                            'fontSize': {'magnitude': 14, 'unit': 'PT'},
                            'bold': True,
                            'fontFamily': 'Roboto Mono'
                        },
                        'textRange': {'type': 'ALL'},
                        'fields': 'foregroundColor,fontSize,bold,fontFamily'
                    }
                })
                # Title
                requests.append({
                    'createShape': {
                        'objectId': title_id,
                        'shapeType': 'TEXT_BOX',
                        'elementProperties': {
                            'pageObjectId': slide_id,
                            'size': {'width': {'magnitude': 600, 'unit': 'PT'}, 'height': {'magnitude': 60, 'unit': 'PT'}},
                            'transform': {'scaleX': 1, 'scaleY': 1, 'translateX': 40, 'translateY': 35, 'unit': 'PT'}
                        }
                    }
                })
                requests.append({'insertText': {'objectId': title_id, 'text': title_text}})
                requests.append({
                    'updateTextStyle': {
                        'objectId': title_id,
                        'style': {
                            'foregroundColor': {'opaqueColor': {'rgbColor': COLORS['white']}},
                            'fontSize': {'magnitude': 28, 'unit': 'PT'},
                            'bold': True,
                            'fontFamily': 'Montserrat'
                        },
                        'textRange': {'type': 'ALL'},
                        'fields': 'foregroundColor,fontSize,bold,fontFamily'
                    }
                })
                # Bullets
                if bullets:
                    bullet_text = '\n\n'.join(f'▸  {b}' for b in bullets)
                    requests.append({
                        'createShape': {
                            'objectId': body_id,
                            'shapeType': 'TEXT_BOX',
                            'elementProperties': {
                                'pageObjectId': slide_id,
                                'size': {'width': {'magnitude': 640, 'unit': 'PT'}, 'height': {'magnitude': 290, 'unit': 'PT'}},
                                'transform': {'scaleX': 1, 'scaleY': 1, 'translateX': 40, 'translateY': 105, 'unit': 'PT'}
                            }
                        }
                    })
                    requests.append({'insertText': {'objectId': body_id, 'text': bullet_text}})
                    requests.append({
                        'updateTextStyle': {
                            'objectId': body_id,
                            'style': {
                                'foregroundColor': {'opaqueColor': {'rgbColor': COLORS['gray_light']}},
                                'fontSize': {'magnitude': 18, 'unit': 'PT'},
                                'fontFamily': 'Open Sans'
                            },
                            'textRange': {'type': 'ALL'},
                            'fields': 'foregroundColor,fontSize,fontFamily'
                        }
                    })
            
            # ===== LAYOUT: QUOTE (highlight slide) =====
            elif layout_type == 'quote':
                # Full accent background
                requests.append({
                    'updatePageProperties': {
                        'objectId': slide_id,
                        'pageProperties': {
                            'pageBackgroundFill': {
                                'solidFill': {'color': {'rgbColor': accent_color}}
                            }
                        },
                        'fields': 'pageBackgroundFill'
                    }
                })
                # Large quote text
                quote_text = bullets[0] if bullets else title_text
                requests.append({
                    'createShape': {
                        'objectId': title_id,
                        'shapeType': 'TEXT_BOX',
                        'elementProperties': {
                            'pageObjectId': slide_id,
                            'size': {'width': {'magnitude': 600, 'unit': 'PT'}, 'height': {'magnitude': 300, 'unit': 'PT'}},
                            'transform': {'scaleX': 1, 'scaleY': 1, 'translateX': 60, 'translateY': 100, 'unit': 'PT'}
                        }
                    }
                })
                requests.append({'insertText': {'objectId': title_id, 'text': f'"{quote_text}"'}})
                requests.append({
                    'updateTextStyle': {
                        'objectId': title_id,
                        'style': {
                            'foregroundColor': {'opaqueColor': {'rgbColor': COLORS['white']}},
                            'fontSize': {'magnitude': 32, 'unit': 'PT'},
                            'italic': True,
                            'fontFamily': 'Playfair Display'
                        },
                        'textRange': {'type': 'ALL'},
                        'fields': 'foregroundColor,fontSize,italic,fontFamily'
                    }
                })
                requests.append({
                    'updateParagraphStyle': {
                        'objectId': title_id,
                        'style': {'alignment': 'CENTER'},
                        'textRange': {'type': 'ALL'},
                        'fields': 'alignment'
                    }
                })
            
            # ===== LAYOUT: CLOSING =====
            elif layout_type == 'closing':
                # Bottom accent bar
                requests.append({
                    'createShape': {
                        'objectId': accent_id,
                        'shapeType': 'RECTANGLE',
                        'elementProperties': {
                            'pageObjectId': slide_id,
                            'size': {'width': {'magnitude': 720, 'unit': 'PT'}, 'height': {'magnitude': 12, 'unit': 'PT'}},
                            'transform': {'scaleX': 1, 'scaleY': 1, 'translateX': 0, 'translateY': 393, 'unit': 'PT'}
                        }
                    }
                })
                requests.append({
                    'updateShapeProperties': {
                        'objectId': accent_id,
                        'shapeProperties': {
                            'shapeBackgroundFill': {'solidFill': {'color': {'rgbColor': COLORS['accent_teal']}}},
                            'outline': {'propertyState': 'NOT_RENDERED'}
                        },
                        'fields': 'shapeBackgroundFill,outline'
                    }
                })
                # Centered closing title
                requests.append({
                    'createShape': {
                        'objectId': title_id,
                        'shapeType': 'TEXT_BOX',
                        'elementProperties': {
                            'pageObjectId': slide_id,
                            'size': {'width': {'magnitude': 640, 'unit': 'PT'}, 'height': {'magnitude': 100, 'unit': 'PT'}},
                            'transform': {'scaleX': 1, 'scaleY': 1, 'translateX': 40, 'translateY': 120, 'unit': 'PT'}
                        }
                    }
                })
                requests.append({'insertText': {'objectId': title_id, 'text': title_text}})
                requests.append({
                    'updateTextStyle': {
                        'objectId': title_id,
                        'style': {
                            'foregroundColor': {'opaqueColor': {'rgbColor': COLORS['white']}},
                            'fontSize': {'magnitude': 36, 'unit': 'PT'},
                            'bold': True,
                            'fontFamily': 'Montserrat'
                        },
                        'textRange': {'type': 'ALL'},
                        'fields': 'foregroundColor,fontSize,bold,fontFamily'
                    }
                })
                requests.append({
                    'updateParagraphStyle': {
                        'objectId': title_id,
                        'style': {'alignment': 'CENTER'},
                        'textRange': {'type': 'ALL'},
                        'fields': 'alignment'
                    }
                })
                # Summary bullets
                if bullets:
                    bullet_text = '  •  '.join(bullets[:4])
                    requests.append({
                        'createShape': {
                            'objectId': body_id,
                            'shapeType': 'TEXT_BOX',
                            'elementProperties': {
                                'pageObjectId': slide_id,
                                'size': {'width': {'magnitude': 640, 'unit': 'PT'}, 'height': {'magnitude': 100, 'unit': 'PT'}},
                                'transform': {'scaleX': 1, 'scaleY': 1, 'translateX': 40, 'translateY': 240, 'unit': 'PT'}
                            }
                        }
                    })
                    requests.append({'insertText': {'objectId': body_id, 'text': bullet_text}})
                    requests.append({
                        'updateTextStyle': {
                            'objectId': body_id,
                            'style': {
                                'foregroundColor': {'opaqueColor': {'rgbColor': COLORS['gray_medium']}},
                                'fontSize': {'magnitude': 14, 'unit': 'PT'},
                                'fontFamily': 'Open Sans'
                            },
                            'textRange': {'type': 'ALL'},
                            'fields': 'foregroundColor,fontSize,fontFamily'
                        }
                    })
                    requests.append({
                        'updateParagraphStyle': {
                            'objectId': body_id,
                            'style': {'alignment': 'CENTER'},
                            'textRange': {'type': 'ALL'},
                            'fields': 'alignment'
                        }
                    })
        
        # Execute batch update
        if requests:
            slides_service.presentations().batchUpdate(
                presentationId=presentation_id,
                body={'requests': requests}
            ).execute()
        
        presentation_url = f"https://docs.google.com/presentation/d/{presentation_id}/edit"
        
        logger.info(f"Slides created successfully: {presentation_url}")
        
        return {
            "success": True,
            "presentation_id": presentation_id,
            "url": presentation_url,
            "slides_count": len(slides_data)
        }
        
    except Exception as e:
        error_str = str(e)
        logger.error(f"Error creating Google Slides: {error_str}")
        
        # Check for scope insufficient error
        if "SCOPE_INSUFFICIENT" in error_str or "insufficient" in error_str.lower():
            return {
                "success": False,
                "error": "ACCESS_TOKEN_SCOPE_INSUFFICIENT: Reconecta Google en Settings para habilitar permisos de Slides"
            }
        
        return {
            "success": False,
            "error": error_str
        }


async def generate_slides_from_content(
    credentials_dict: dict,
    title: str,
    content_text: str,
    competency: str = "",
    thematic_axis: str = "",
    slide_count: int = 8
) -> Dict:
    """
    Complete flow: Structure content with AI and create Google Slides presentation.
    
    Args:
        credentials_dict: Google OAuth credentials
        title: Content/presentation title
        content_text: The dictation text to convert to slides
        competency: Associated competency name
        thematic_axis: Associated thematic axis name
        slide_count: Number of slides to generate (4-10)
    
    Returns:
        Dict with presentation URL and status
    """
    # Step 1: Structure content with AI
    structure_result = await structure_content_for_slides(
        title=title,
        content_text=content_text,
        competency=competency,
        thematic_axis=thematic_axis
    )
    
    if not structure_result.get("success"):
        return structure_result
    
    slides_data = structure_result.get("slides", [])
    
    if not slides_data:
        return {
            "success": False,
            "error": "No slides generated from content"
        }
    
    # Limit to requested slide count
    slides_data = slides_data[:slide_count]
    
    # Step 2: Create Google Slides presentation WITH AI-generated images
    result = await create_google_slides_with_images(
        credentials_dict=credentials_dict,
        title=title,
        slides_data=slides_data
    )
    
    if result.get("success"):
        result["slides_structure"] = slides_data
    
    return result
