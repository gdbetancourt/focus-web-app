"""
Authentication router and utilities for Leaderlix Backend
Supports Google OAuth (direct) and Email/Password registration
- @leaderlix.com users → Focus (full access)
- External users → LMS only (courses assigned to them)
"""
from fastapi import APIRouter, HTTPException, Depends, Request, Response
from fastapi.responses import JSONResponse, RedirectResponse
from datetime import datetime, timezone, timedelta
import jwt
import bcrypt
import uuid
import httpx
import os
import secrets
import logging

from database import db
from config import SECRET_KEY, ALGORITHM, ACCESS_TOKEN_EXPIRE_HOURS, IS_PRODUCTION, FRONTEND_URL

from models.schemas import UserCreate, UserLogin, UserResponse, TokenResponse

# Rate limiting - shared instance
from rate_limiter import limiter, AUTH_RATE_LIMIT

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/auth", tags=["auth"])

# Configuration
ALLOWED_DOMAIN = "leaderlix.com"  # Domain for full Focus access
SESSION_EXPIRY_HOURS = 8  # Session expires after 8 hours
SESSION_EXPIRY_SECONDS = SESSION_EXPIRY_HOURS * 60 * 60  # 28800 seconds

# Google OAuth Configuration
GOOGLE_CLIENT_ID = os.environ.get("GOOGLE_CLIENT_ID", "")
GOOGLE_CLIENT_SECRET = os.environ.get("GOOGLE_CLIENT_SECRET", "")
GOOGLE_REDIRECT_URI = os.environ.get("GOOGLE_REDIRECT_URI", "")

# Emergent Auth (legacy, keeping for backwards compatibility)
EMERGENT_AUTH_URL = "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data"


# ============ HELPER FUNCTIONS ============

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()

def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode(), hashed.encode())


def get_user_permissions(user_type: str, role: str = None) -> dict:
    """
    Get permissions based on user type and optional role.
    
    Permission levels:
    - staff: Full access to all features
    - external: Limited access (view only, no edit/delete)
    
    Roles (for staff):
    - admin: All permissions
    - manager: Most permissions except system settings
    - viewer: Read-only access
    """
    # Base permissions for external users (read-only)
    external_permissions = {
        "companies": {
            "view": True,
            "create": False,
            "edit": False,
            "delete": False,
            "merge": False,
            "change_classification": False,
            "propagate": False
        },
        "industries": {
            "view": True,
            "create": False,
            "edit": False,
            "delete": False,
            "merge": False,
            "change_classification": False
        },
        "contacts": {
            "view": True,
            "create": False,
            "edit": False,
            "delete": False
        },
        "cases": {
            "view": True,
            "create": False,
            "edit": False,
            "delete": False,
            "change_stage": False
        },
        "searches": {
            "view": True,
            "create": False,
            "edit": False,
            "delete": False
        }
    }
    
    # Full permissions for staff
    staff_permissions = {
        "companies": {
            "view": True,
            "create": True,
            "edit": True,
            "delete": True,
            "merge": True,
            "change_classification": True,
            "propagate": True
        },
        "industries": {
            "view": True,
            "create": True,
            "edit": True,
            "delete": True,
            "merge": True,
            "change_classification": True
        },
        "contacts": {
            "view": True,
            "create": True,
            "edit": True,
            "delete": True
        },
        "cases": {
            "view": True,
            "create": True,
            "edit": True,
            "delete": True,
            "change_stage": True
        },
        "searches": {
            "view": True,
            "create": True,
            "edit": True,
            "delete": True
        }
    }
    
    # Viewer role (read-only staff)
    viewer_permissions = {
        "companies": {
            "view": True,
            "create": False,
            "edit": False,
            "delete": False,
            "merge": False,
            "change_classification": False,
            "propagate": False
        },
        "industries": {
            "view": True,
            "create": False,
            "edit": False,
            "delete": False,
            "merge": False,
            "change_classification": False
        },
        "contacts": {
            "view": True,
            "create": False,
            "edit": False,
            "delete": False
        },
        "cases": {
            "view": True,
            "create": False,
            "edit": False,
            "delete": False,
            "change_stage": False
        },
        "searches": {
            "view": True,
            "create": False,
            "edit": False,
            "delete": False
        }
    }
    
    if user_type == "external":
        return external_permissions
    
    # Staff with specific role
    if role == "viewer":
        return viewer_permissions
    
    # Default staff (admin/manager) gets full permissions
    return staff_permissions

def create_access_token(data: dict) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(hours=ACCESS_TOKEN_EXPIRE_HOURS)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

def generate_verification_token() -> str:
    """Generate a secure token for email verification"""
    return secrets.token_urlsafe(32)

async def verify_turnstile_token(token: str) -> bool:
    """Verify Cloudflare Turnstile CAPTCHA token"""
    secret_key = os.environ.get("TURNSTILE_SECRET_KEY", "")
    
    if not secret_key or secret_key.startswith("1x0000"):
        # Test key, always valid
        return True
    
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                "https://challenges.cloudflare.com/turnstile/v0/siteverify",
                data={
                    "secret": secret_key,
                    "response": token
                }
            )
            result = response.json()
            return result.get("success", False)
    except Exception:
        return False

async def create_or_update_contact_for_user(email: str, name: str, phone: str = None, source: str = "registration"):
    """Create or update a contact in unified_contacts for a new user"""
    existing = await db.unified_contacts.find_one({"email": email.lower()})
    
    if existing:
        # Update existing contact
        await db.unified_contacts.update_one(
            {"email": email.lower()},
            {"$set": {
                "name": name,
                "phone": phone,
                "updated_at": datetime.now(timezone.utc).isoformat()
            }}
        )
        return existing.get("id")
    else:
        # Create new contact in Stage 1
        contact_id = str(uuid.uuid4())
        name_parts = name.split(" ", 1)
        first_name = name_parts[0]
        last_name = name_parts[1] if len(name_parts) > 1 else ""
        
        contact_doc = {
            "id": contact_id,
            "name": name,
            "first_name": first_name,
            "last_name": last_name,
            "email": email.lower(),
            "phone": phone,
            "stage": 1,
            "classification": "inbound",  # Default classification
            "source": source,
            "buyer_persona": "mateo",  # Default
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat()
        }
        await db.unified_contacts.insert_one(contact_doc)
        return contact_id


async def get_current_user(request: Request) -> dict:
    """
    Dependency to get current authenticated user from unified_contacts.
    Supports session token from cookie.
    """
    session_token = request.cookies.get("session_token")
    logger.info(f"[GET_CURRENT_USER] session_token present: {bool(session_token)}, value: {session_token[:50] if session_token else 'N/A'}...")
    
    if session_token:
        # Check user_sessions (unified session storage)
        session = await db.user_sessions.find_one(
            {"session_token": session_token},
            {"_id": 0}
        )
        logger.info(f"[GET_CURRENT_USER] session found: {bool(session)}, user_id: {session.get('user_id') if session else 'N/A'}, query: {session_token}")
        
        if session:
            expires_at = session.get("expires_at")
            if isinstance(expires_at, str):
                expires_at = datetime.fromisoformat(expires_at)
            if expires_at.tzinfo is None:
                expires_at = expires_at.replace(tzinfo=timezone.utc)
            
            is_expired = expires_at <= datetime.now(timezone.utc)
            logger.info(f"[GET_CURRENT_USER] session expired: {is_expired}")
            
            if not is_expired:
                user_id = session.get("user_id")
                
                # Try to find user in unified_contacts by ID
                user = await db.unified_contacts.find_one(
                    {"id": user_id},
                    {"_id": 0, "password_hash": 0, "verification_token": 0}
                )
                logger.info(f"[GET_CURRENT_USER] user in unified_contacts: {bool(user)}")
                
                # Fallback: check old 'users' collection and find by email
                if not user:
                    old_user = await db.users.find_one({"id": user_id}, {"_id": 0})
                    logger.info(f"[GET_CURRENT_USER] fallback - old_user found: {bool(old_user)}, email: {old_user.get('email') if old_user else 'N/A'}")
                    if old_user and old_user.get("email"):
                        user = await db.unified_contacts.find_one(
                            {"email": old_user["email"]},
                            {"_id": 0, "password_hash": 0, "verification_token": 0}
                        )
                        logger.info(f"[GET_CURRENT_USER] fallback - user by email: {bool(user)}")
                        # Update session with correct user_id for future requests
                        if user:
                            await db.user_sessions.update_one(
                                {"session_token": session_token},
                                {"$set": {"user_id": user["id"]}}
                            )
                
                if user:
                    # Add user_type based on email domain
                    email = user.get("email", "")
                    user["user_type"] = "staff" if email.endswith(f"@{ALLOWED_DOMAIN}") else "external"
                    # Add permissions based on user_type
                    user["permissions"] = get_user_permissions(user["user_type"], user.get("role"))
                    logger.info(f"[GET_CURRENT_USER] SUCCESS - user: {email}, type: {user['user_type']}")
                    return user
    
    # Fallback to JWT token from Authorization header (legacy)
    auth_header = request.headers.get("Authorization")
    logger.info(f"[GET_CURRENT_USER] No valid session, checking JWT. Auth header present: {bool(auth_header)}")
    
    if not auth_header or not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    token = auth_header.split(" ")[1]
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid token")
        
        user = await db.unified_contacts.find_one(
            {"id": user_id}, 
            {"_id": 0, "password_hash": 0, "verification_token": 0}
        )
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        email = user.get("email", "")
        user["user_type"] = "staff" if email.endswith(f"@{ALLOWED_DOMAIN}") else "external"
        # Add permissions based on user_type
        user["permissions"] = get_user_permissions(user["user_type"], user.get("role"))
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")


async def get_current_user_optional(request: Request) -> dict:
    """
    Optional dependency to get current authenticated user from unified_contacts.
    Returns None if not authenticated instead of raising HTTPException.
    """
    session_token = request.cookies.get("session_token")
    if session_token:
        # Check user_sessions (unified session storage)
        session = await db.user_sessions.find_one(
            {"session_token": session_token},
            {"_id": 0}
        )
        if session:
            expires_at = session.get("expires_at")
            if isinstance(expires_at, str):
                expires_at = datetime.fromisoformat(expires_at)
            if expires_at.tzinfo is None:
                expires_at = expires_at.replace(tzinfo=timezone.utc)
            
            if expires_at > datetime.now(timezone.utc):
                user_id = session.get("user_id")
                
                # Try to find user in unified_contacts by ID
                user = await db.unified_contacts.find_one(
                    {"id": user_id},
                    {"_id": 0, "password_hash": 0, "verification_token": 0}
                )
                
                # Fallback: check old 'users' collection and find by email
                if not user:
                    old_user = await db.users.find_one({"id": user_id}, {"_id": 0})
                    if old_user and old_user.get("email"):
                        user = await db.unified_contacts.find_one(
                            {"email": old_user["email"]},
                            {"_id": 0, "password_hash": 0, "verification_token": 0}
                        )
                        # Update session with correct user_id
                        if user:
                            await db.user_sessions.update_one(
                                {"session_token": session_token},
                                {"$set": {"user_id": user["id"]}}
                            )
                
                if user:
                    email = user.get("email", "")
                    user["user_type"] = "staff" if email.endswith(f"@{ALLOWED_DOMAIN}") else "external"
                    return user
    
    # Fallback to JWT token from Authorization header
    auth_header = request.headers.get("Authorization")
    if auth_header and auth_header.startswith("Bearer "):
        token = auth_header.split(" ")[1]
        try:
            payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
            user_id = payload.get("sub")
            if user_id:
                user = await db.unified_contacts.find_one(
                    {"id": user_id}, 
                    {"_id": 0, "password_hash": 0, "verification_token": 0}
                )
                if user:
                    email = user.get("email", "")
                    user["user_type"] = "staff" if email.endswith(f"@{ALLOWED_DOMAIN}") else "external"
                    return user
        except:
            pass
    
    return None


# ============ AUTH ROUTES ============

@router.get("/me", response_model=UserResponse)
async def get_me(current_user: dict = Depends(get_current_user)):
    return UserResponse(
        id=current_user["id"],
        email=current_user["email"],
        name=current_user["name"],
        created_at=datetime.fromisoformat(current_user["created_at"]) if isinstance(current_user["created_at"], str) else current_user["created_at"]
    )


# ============ GOOGLE OAUTH ROUTES (Emergent Auth) ============

@router.post("/google/session")
async def process_google_session(request: Request, response: Response):
    """
    Process session_id from Emergent Auth and create user session.
    Restricts login to @leaderlix.com domain only.
    """
    data = await request.json()
    session_id = data.get("session_id")
    
    if not session_id:
        raise HTTPException(status_code=400, detail="session_id is required")
    
    # Exchange session_id for user data from Emergent Auth
    async with httpx.AsyncClient() as client:
        try:
            auth_response = await client.get(
                EMERGENT_AUTH_URL,
                headers={"X-Session-ID": session_id},
                timeout=10.0
            )
            
            if auth_response.status_code != 200:
                raise HTTPException(status_code=401, detail="Invalid session_id")
            
            user_data = auth_response.json()
        except httpx.RequestError as e:
            raise HTTPException(status_code=500, detail=f"Auth service error: {str(e)}")
    
    email = user_data.get("email", "")
    name = user_data.get("name", "")
    picture = user_data.get("picture", "")
    session_token = user_data.get("session_token", "")
    
    # CRITICAL: Check domain restriction
    if not email.endswith(f"@{ALLOWED_DOMAIN}"):
        raise HTTPException(
            status_code=403, 
            detail=f"Solo usuarios con correo @{ALLOWED_DOMAIN} pueden acceder"
        )
    
    # Find or create user
    existing_user = await db.users.find_one({"email": email}, {"_id": 0})
    
    if existing_user:
        user_id = existing_user["id"]
        # Update user info if changed
        await db.users.update_one(
            {"email": email},
            {"$set": {
                "name": name,
                "picture": picture,
                "updated_at": datetime.now(timezone.utc).isoformat(),
                "auth_provider": "google"
            }}
        )
    else:
        # Create new user
        user_id = f"user_{uuid.uuid4().hex[:12]}"
        user_doc = {
            "id": user_id,
            "email": email,
            "name": name,
            "picture": picture,
            "auth_provider": "google",
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat()
        }
        await db.users.insert_one(user_doc)
    
    # Create session
    expires_at = datetime.now(timezone.utc) + timedelta(hours=SESSION_EXPIRY_HOURS)
    
    # Delete any existing sessions for this user
    await db.user_sessions.delete_many({"user_id": user_id})
    
    session_doc = {
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "session_token": session_token,
        "expires_at": expires_at.isoformat(),
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.user_sessions.insert_one(session_doc)
    
    # Set httpOnly cookie
    json_response = JSONResponse(content={
        "success": True,
        "user": {
            "id": user_id,
            "email": email,
            "name": name,
            "picture": picture
        }
    })
    
    json_response.set_cookie(
        key="session_token",
        value=session_token,
        httponly=True,
        secure=True,
        samesite="none",
        path="/",
        max_age=SESSION_EXPIRY_SECONDS
    )
    
    return json_response


@router.post("/google/logout")
async def google_logout(request: Request, response: Response):
    """Logout user by clearing session and cookie"""
    session_token = request.cookies.get("session_token")
    
    if session_token:
        await db.user_sessions.delete_many({"session_token": session_token})
    
    json_response = JSONResponse(content={"success": True, "message": "Logged out"})
    json_response.delete_cookie(
        key="session_token",
        path="/",
        secure=True,
        samesite="none"
    )
    
    return json_response


@router.get("/google/check")
async def check_google_session(request: Request, token: str = None):
    """Check if user has valid Google session (staff or external)"""
    # Try to get token from query param first (for testing), then from cookie
    session_token = token or request.cookies.get("session_token")
    
    if not session_token:
        return {"authenticated": False, "reason": "no_token"}
    
    # First try staff sessions
    session = await db.user_sessions.find_one(
        {"session_token": session_token},
        {"_id": 0}
    )
    
    user_type = "staff"
    redirect_url = "/focus"
    
    # If not found in staff sessions, try external user sessions
    if not session:
        session = await db.external_user_sessions.find_one(
            {"session_token": session_token},
            {"_id": 0}
        )
        user_type = "external"
        redirect_url = "/nurture/lms"
    
    if not session:
        return {"authenticated": False, "reason": "session_not_found", "token_received": session_token[:20] + "..."}
    
    expires_at = session.get("expires_at")
    if isinstance(expires_at, str):
        expires_at = datetime.fromisoformat(expires_at)
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    
    if expires_at < datetime.now(timezone.utc):
        return {"authenticated": False, "reason": "expired"}
    
    # Get user from appropriate collection based on user type
    if user_type == "staff":
        user = await db.users.find_one(
            {"id": session.get("user_id")},
            {"_id": 0}
        )
    else:
        user = await db.external_users.find_one(
            {"id": session.get("user_id")},
            {"_id": 0, "password_hash": 0}
        )
    
    if not user:
        return {"authenticated": False, "reason": "user_not_found"}
    
    return {
        "authenticated": True,
        "user_type": user_type,
        "redirect_url": redirect_url,
        "user": {
            "id": user.get("id"),
            "email": user.get("email"),
            "name": user.get("name"),
            "picture": user.get("picture")
        }
    }


# ============ UNIFIED AUTH SYSTEM (Google OAuth + Email/Password) ============

from pydantic import BaseModel, EmailStr

class UserRegisterRequest(BaseModel):
    email: EmailStr
    password: str
    name: str
    phone: str = None
    turnstile_token: str

class UserLoginRequest(BaseModel):
    email: EmailStr
    password: str
    turnstile_token: str


# ============ GOOGLE OAUTH DIRECT ============

@router.get("/google/init")
async def google_oauth_init(request: Request):
    """
    Initialize Google OAuth flow.
    Redirects user to Google's consent screen.
    """
    if not GOOGLE_CLIENT_ID:
        raise HTTPException(status_code=500, detail="Google OAuth not configured")
    
    # Get redirect URI from environment or construct from request
    redirect_uri = GOOGLE_REDIRECT_URI
    if not redirect_uri:
        # Construct from request host
        host = request.headers.get("x-forwarded-host") or request.headers.get("host")
        scheme = request.headers.get("x-forwarded-proto") or "https"
        redirect_uri = f"{scheme}://{host}/auth/google/callback"
    
    # Build Google OAuth URL with hd parameter to suggest corporate domain
    google_auth_url = (
        "https://accounts.google.com/o/oauth2/v2/auth?"
        f"client_id={GOOGLE_CLIENT_ID}&"
        f"redirect_uri={redirect_uri}&"
        "response_type=code&"
        "scope=openid%20email%20profile&"
        "access_type=offline&"
        "prompt=select_account&"
        f"hd={ALLOWED_DOMAIN}"
    )
    
    return {"auth_url": google_auth_url, "redirect_uri": redirect_uri}


@router.get("/google/callback")
async def google_oauth_callback(request: Request, code: str = None, error: str = None):
    """
    Handle Google OAuth callback.
    Exchange code for tokens and create/update user.
    """
    # Debug logging
    host = request.headers.get("x-forwarded-host") or request.headers.get("host") or ""
    logger.info(f"[OAUTH CALLBACK] Host: {host}, Code present: {bool(code)}, Error: {error}")
    
    if error:
        # Redirect to frontend with error
        return RedirectResponse(url=f"/?auth_error={error}")
    
    if not code:
        return RedirectResponse(url="/?auth_error=no_code")
    
    # Get redirect URI
    redirect_uri = GOOGLE_REDIRECT_URI
    if not redirect_uri:
        host = request.headers.get("x-forwarded-host") or request.headers.get("host")
        scheme = request.headers.get("x-forwarded-proto") or "https"
        redirect_uri = f"{scheme}://{host}/auth/google/callback"
    
    try:
        async with httpx.AsyncClient() as client:
            # Exchange code for tokens
            token_response = await client.post(
                "https://oauth2.googleapis.com/token",
                data={
                    "code": code,
                    "client_id": GOOGLE_CLIENT_ID,
                    "client_secret": GOOGLE_CLIENT_SECRET,
                    "redirect_uri": redirect_uri,
                    "grant_type": "authorization_code"
                }
            )
            
            if token_response.status_code != 200:
                return RedirectResponse(url="/?auth_error=token_exchange_failed")
            
            tokens = token_response.json()
            id_token = tokens.get("id_token")
            
            # ============ SECURITY: Validate ID Token ============
            # Call Google's tokeninfo endpoint to validate the id_token
            if not id_token:
                logger.warning("[OAUTH CALLBACK] No id_token received")
                raise HTTPException(status_code=403, detail="Authentication failed")
            
            tokeninfo_response = await client.get(
                f"https://oauth2.googleapis.com/tokeninfo?id_token={id_token}"
            )
            
            if tokeninfo_response.status_code != 200:
                logger.warning(f"[OAUTH CALLBACK] tokeninfo validation failed: {tokeninfo_response.status_code}")
                raise HTTPException(status_code=403, detail="Authentication failed")
            
            tokeninfo = tokeninfo_response.json()
            
            # Validate 'aud' (audience) matches our client ID
            token_aud = tokeninfo.get("aud", "")
            if token_aud != GOOGLE_CLIENT_ID:
                logger.warning(f"[OAUTH CALLBACK] Invalid aud: {token_aud}")
                raise HTTPException(status_code=403, detail="Authentication failed")
            
            # Validate 'iss' (issuer) is Google
            token_iss = tokeninfo.get("iss", "")
            if token_iss not in ["https://accounts.google.com", "accounts.google.com"]:
                logger.warning(f"[OAUTH CALLBACK] Invalid iss: {token_iss}")
                raise HTTPException(status_code=403, detail="Authentication failed")
            
            # Validate 'email_verified' is true
            email_verified = tokeninfo.get("email_verified", "")
            if str(email_verified).lower() != "true":
                logger.warning(f"[OAUTH CALLBACK] Email not verified: {email_verified}")
                raise HTTPException(status_code=403, detail="Authentication failed")
            
            # Validate email domain is @leaderlix.com
            token_email = tokeninfo.get("email", "").lower()
            if not token_email.endswith(f"@{ALLOWED_DOMAIN}"):
                logger.warning(f"[OAUTH CALLBACK] Invalid domain for: {token_email}")
                raise HTTPException(status_code=403, detail="Authentication failed")
            
            logger.info(f"[OAUTH CALLBACK] ID token validated for: {token_email}")
            # ============ END SECURITY VALIDATION ============
            
            # Get user info from Google
            userinfo_response = await client.get(
                "https://www.googleapis.com/oauth2/v3/userinfo",
                headers={"Authorization": f"Bearer {tokens.get('access_token')}"}
            )
            
            if userinfo_response.status_code != 200:
                raise HTTPException(status_code=403, detail="Authentication failed")
            
            userinfo = userinfo_response.json()
            
    except HTTPException:
        # Re-raise HTTPExceptions (our security blocks)
        raise
    except Exception as e:
        logger.error(f"[OAUTH CALLBACK] Unexpected error: {e}")
        raise HTTPException(status_code=403, detail="Authentication failed")
    
    email = userinfo.get("email", "").lower()
    name = userinfo.get("name", "")
    picture = userinfo.get("picture", "")
    
    if not email:
        raise HTTPException(status_code=403, detail="Authentication failed")
    
    # Double-check domain (defense in depth - already validated in tokeninfo)
    if not email.endswith(f"@{ALLOWED_DOMAIN}"):
        raise HTTPException(status_code=403, detail="Authentication failed")
    
    # Only @leaderlix.com users allowed - always staff
    user_type = "staff"
    
    # Create session token
    session_token = str(uuid.uuid4())
    
    # ALL users go to unified_contacts
    existing_contact = await db.unified_contacts.find_one({"email": email}, {"_id": 0})
    
    if existing_contact:
        user_id = existing_contact["id"]
        # Update contact with auth info
        await db.unified_contacts.update_one(
            {"email": email},
            {"$set": {
                "name": name or existing_contact.get("name"),
                "picture": picture,
                "auth_provider": "google",
                "email_verified": True,
                "can_login": True,
                "is_staff": True,
                "last_login": datetime.now(timezone.utc).isoformat(),
                "updated_at": datetime.now(timezone.utc).isoformat()
            }}
        )
    else:
        # Create new contact
        user_id = f"contact_{uuid.uuid4().hex[:12]}"
        name_parts = name.split(" ", 1) if name else ["", ""]
        
        contact_doc = {
            "id": user_id,
            "email": email,
            "name": name,
            "first_name": name_parts[0],
            "last_name": name_parts[1] if len(name_parts) > 1 else "",
            "picture": picture,
            "auth_provider": "google",
            "email_verified": True,
            "can_login": True,
            "is_staff": True,
            "stage": 4,  # Staff in Deliver
            "source": "google_oauth",
            "buyer_persona": "staff",
            "assigned_courses": [],
            "last_login": datetime.now(timezone.utc).isoformat(),
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat()
        }
        await db.unified_contacts.insert_one(contact_doc)
    
    # Create session in user_sessions (unified session storage)
    await db.user_sessions.delete_many({"user_id": user_id})
    session_doc = {
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "session_token": session_token,
        "user_type": user_type,
        "expires_at": (datetime.now(timezone.utc) + timedelta(hours=SESSION_EXPIRY_HOURS)).isoformat(),
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.user_sessions.insert_one(session_doc)
    
    # Staff always goes to Focus
    redirect_url = "/focus"
    
    # Redirect to processing page with token in URL
    process_url = f"/auth/process?token={session_token}&redirect={redirect_url}&user_type={user_type}"
    
    logger.info(f"[OAUTH CALLBACK] User {email} logged in, type: {user_type}, redirect: {redirect_url}")
    
    return RedirectResponse(url=process_url, status_code=302)



@router.post("/set-session")
async def set_session_cookie(request: Request):
    """
    Set session cookie from token.
    Called by frontend after OAuth redirect to properly set the cookie.
    """
    data = await request.json()
    token = data.get("token")
    
    if not token:
        raise HTTPException(status_code=400, detail="Token is required")
    
    # Verify the token exists in user_sessions (unified session storage)
    session = await db.user_sessions.find_one({"session_token": token}, {"_id": 0})
    
    if not session:
        raise HTTPException(status_code=401, detail="Invalid token")
    
    # Check expiration
    expires_at = session.get("expires_at")
    if isinstance(expires_at, str):
        expires_at = datetime.fromisoformat(expires_at)
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    
    if expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=401, detail="Token expired")
    
    # Get user from unified_contacts
    user = await db.unified_contacts.find_one(
        {"id": session.get("user_id")}, 
        {"_id": 0, "password_hash": 0, "verification_token": 0}
    )
    
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    
    # Determine user type from email
    email = user.get("email", "")
    user_type = "staff" if email.endswith(f"@{ALLOWED_DOMAIN}") else "external"
    
    # Create response with cookie
    response = JSONResponse(content={
        "success": True,
        "user_type": user_type,
        "user": {
            "id": user.get("id"),
            "email": user.get("email"),
            "name": user.get("name"),
            "picture": user.get("picture")
        }
    })
    
    # Use SameSite=None for cross-origin requests with credentials
    response.set_cookie(
        key="session_token",
        value=token,
        httponly=True,
        secure=True,
        samesite="none",
        path="/",
        max_age=SESSION_EXPIRY_SECONDS
    )
    
    logger.info(f"[SET SESSION] Cookie set for user {user.get('email')}, type: {user_type}")
    
    return response



# ============ EMAIL/PASSWORD REGISTRATION ============

@router.post("/register")
@limiter.limit(AUTH_RATE_LIMIT)
async def register_with_email(request: Request, data: UserRegisterRequest):
    """
    Register new user with email/password.
    - @leaderlix.com emails are NOT allowed (must use Google)
    - Creates/updates contact in unified_contacts with auth fields
    - Sends verification email
    - Rate limited: 5 requests per minute
    
    DISABLED: Email/password registration is disabled for production.
    """
    # SECURITY: Endpoint disabled - only Google SSO allowed
    raise HTTPException(status_code=404, detail="Not found")
    
    email = data.email.lower()
    
    # Block @leaderlix.com from registering via email
    if email.endswith(f"@{ALLOWED_DOMAIN}"):
        raise HTTPException(
            status_code=400, 
            detail=f"Los usuarios @{ALLOWED_DOMAIN} deben iniciar sesión con Google"
        )
    
    # Verify CAPTCHA
    if not await verify_turnstile_token(data.turnstile_token):
        raise HTTPException(status_code=400, detail="Verificación CAPTCHA fallida")
    
    # Check if contact already exists with can_login=True (already registered)
    existing = await db.unified_contacts.find_one({"email": email})
    if existing and existing.get("can_login") and existing.get("password_hash"):
        raise HTTPException(status_code=400, detail="Este email ya está registrado. Por favor inicia sesión.")
    
    # Create verification token
    verification_token = generate_verification_token()
    name_parts = data.name.split(" ", 1) if data.name else ["", ""]
    
    auth_fields = {
        "password_hash": hash_password(data.password),
        "auth_provider": "email",
        "email_verified": False,
        "verification_token": verification_token,
        "verification_token_expires": (datetime.now(timezone.utc) + timedelta(hours=24)).isoformat(),
        "can_login": True,
        "is_staff": False,
        "assigned_courses": existing.get("assigned_courses", []) if existing else [],
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    if existing:
        # Update existing contact with auth fields
        user_id = existing["id"]
        await db.unified_contacts.update_one(
            {"email": email},
            {"$set": {
                "name": data.name or existing.get("name"),
                "first_name": name_parts[0] or existing.get("first_name"),
                "last_name": name_parts[1] if len(name_parts) > 1 else existing.get("last_name", ""),
                "phone": data.phone or existing.get("phone"),
                **auth_fields
            }}
        )
    else:
        # Create new contact
        user_id = f"contact_{uuid.uuid4().hex[:12]}"
        contact_doc = {
            "id": user_id,
            "email": email,
            "name": data.name,
            "first_name": name_parts[0],
            "last_name": name_parts[1] if len(name_parts) > 1 else "",
            "phone": data.phone,
            "stage": 1,  # New contacts start in Prospect
            "source": "email_registration",
            "buyer_persona": "mateo",
            **auth_fields,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.unified_contacts.insert_one(contact_doc)
    
    # Send verification email
    email_sent = False
    try:
        from services.email_service import email_service
        if email_service.is_configured():
            verification_url = f"{FRONTEND_URL}/api/auth/verify-email/{verification_token}"
            result = await email_service.send_verification_email(
                to_email=email,
                user_name=data.name or email.split("@")[0],
                verification_url=verification_url
            )
            email_sent = result.get("success", False)
            if not email_sent:
                logger.warning(f"Failed to send verification email: {result.get('error')}")
    except Exception as e:
        logger.error(f"Error sending verification email: {e}")
    
    response_data = {
        "success": True,
        "message": "Cuenta creada. Por favor verifica tu email para activar tu cuenta.",
        "user_id": user_id,
        "email_sent": email_sent
    }
    
    # Include token ONLY in development mode when email not sent
    if not email_sent and not IS_PRODUCTION:
        response_data["verification_token"] = verification_token
        response_data["message"] = "Cuenta creada. Email de verificación no enviado (modo desarrollo)."
    elif not email_sent:
        response_data["message"] = "Cuenta creada. Hubo un problema enviando el email de verificación. Contacta soporte."
    
    return response_data


@router.get("/verify-email/{token}")
async def verify_email(token: str):
    """Verify email with token"""
    user = await db.unified_contacts.find_one(
        {"verification_token": token},
        {"_id": 0}
    )
    
    if not user:
        raise HTTPException(status_code=400, detail="Token inválido o expirado")
    
    # Check if token expired
    expires = user.get("verification_token_expires")
    if expires:
        if isinstance(expires, str):
            expires = datetime.fromisoformat(expires)
        if expires.tzinfo is None:
            expires = expires.replace(tzinfo=timezone.utc)
        if expires < datetime.now(timezone.utc):
            raise HTTPException(status_code=400, detail="Token expirado. Por favor regístrate de nuevo.")
    
    # Mark email as verified
    await db.unified_contacts.update_one(
        {"id": user["id"]},
        {"$set": {
            "email_verified": True,
            "verification_token": None,
            "verification_token_expires": None,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    # Redirect to login with success message
    return RedirectResponse(url="/?email_verified=true")


@router.post("/login")
@limiter.limit(AUTH_RATE_LIMIT)
async def login_with_email(request: Request, data: UserLoginRequest, response: Response):
    """
    Login with email/password for external users.
    Rate limited: 5 requests per minute
    
    DISABLED: Email/password login is disabled for production.
    """
    # SECURITY: Endpoint disabled - only Google SSO allowed
    raise HTTPException(status_code=404, detail="Not found")
    
    email = data.email.lower()
    
    # Verify CAPTCHA
    if not await verify_turnstile_token(data.turnstile_token):
        raise HTTPException(status_code=400, detail="Verificación CAPTCHA fallida")
    
    # Check if trying to login as @leaderlix.com
    if email.endswith(f"@{ALLOWED_DOMAIN}"):
        raise HTTPException(
            status_code=400, 
            detail=f"Los usuarios @{ALLOWED_DOMAIN} deben iniciar sesión con Google"
        )
    
    # Find user in unified_contacts
    user = await db.unified_contacts.find_one({"email": email}, {"_id": 0})
    
    if not user:
        raise HTTPException(status_code=401, detail="Credenciales inválidas")
    
    # Check if user can login (has registered or was invited)
    if not user.get("can_login"):
        raise HTTPException(
            status_code=400, 
            detail="Esta cuenta no está habilitada para iniciar sesión. Contacta al administrador."
        )
    
    # Check if user was created via Google (no password)
    if not user.get("password_hash"):
        raise HTTPException(
            status_code=400, 
            detail="Esta cuenta fue creada con Google. Por favor inicia sesión con Google."
        )
    
    # Verify password
    if not verify_password(data.password, user.get("password_hash", "")):
        raise HTTPException(status_code=401, detail="Credenciales inválidas")
    
    # Check if email is verified
    if not user.get("email_verified", False):
        raise HTTPException(
            status_code=403, 
            detail="Por favor verifica tu email antes de iniciar sesión"
        )
    
    # Create session in user_sessions (unified)
    session_token = str(uuid.uuid4())
    
    await db.user_sessions.delete_many({"user_id": user["id"]})
    session_doc = {
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "session_token": session_token,
        "user_type": "external",
        "expires_at": (datetime.now(timezone.utc) + timedelta(hours=SESSION_EXPIRY_HOURS)).isoformat(),
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.user_sessions.insert_one(session_doc)
    
    # Update last login
    await db.unified_contacts.update_one(
        {"id": user["id"]},
        {"$set": {"last_login": datetime.now(timezone.utc).isoformat()}}
    )
    
    json_response = JSONResponse(content={
        "success": True,
        "user_type": "external",
        "redirect_url": "/nurture/lms",
        "user": {
            "id": user["id"],
            "email": user["email"],
            "name": user.get("name", ""),
            "assigned_courses": user.get("assigned_courses", [])
        }
    })
    
    json_response.set_cookie(
        key="session_token",
        value=session_token,
        httponly=True,
        secure=True,
        samesite="none",
        path="/",
        max_age=SESSION_EXPIRY_SECONDS
    )
    
    return json_response


@router.post("/logout")
async def logout(request: Request):
    """Logout user"""
    session_token = request.cookies.get("session_token")
    
    if session_token:
        # Delete from unified sessions
        await db.user_sessions.delete_many({"session_token": session_token})
    
    json_response = JSONResponse(content={"success": True, "message": "Logged out"})
    json_response.delete_cookie(
        key="session_token",
        path="/",
        secure=True,
        samesite="none"
    )
    
    return json_response


@router.get("/check")
async def check_session(request: Request):
    """Check if user has valid session"""
    session_token = request.cookies.get("session_token")
    
    # Debug logging
    all_cookies = request.cookies
    logger.info(f"[AUTH CHECK] Cookies received: {list(all_cookies.keys())}, session_token present: {bool(session_token)}")
    
    if not session_token:
        return {"authenticated": False, "reason": "no_token"}
    
    # Check unified session storage
    session = await db.user_sessions.find_one(
        {"session_token": session_token},
        {"_id": 0}
    )
    
    if not session:
        return {"authenticated": False, "reason": "session_not_found"}
    
    # Check expiration
    expires_at = session.get("expires_at")
    if isinstance(expires_at, str):
        expires_at = datetime.fromisoformat(expires_at)
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    
    if expires_at < datetime.now(timezone.utc):
        return {"authenticated": False, "reason": "expired"}
    
    user_id = session.get("user_id")
    
    # Get user from unified_contacts
    user = await db.unified_contacts.find_one(
        {"id": user_id},
        {"_id": 0, "password_hash": 0, "verification_token": 0}
    )
    
    # Fallback: check old 'users' collection and find by email
    if not user:
        old_user = await db.users.find_one({"id": user_id}, {"_id": 0})
        if old_user and old_user.get("email"):
            user = await db.unified_contacts.find_one(
                {"email": old_user["email"]},
                {"_id": 0, "password_hash": 0, "verification_token": 0}
            )
            # Update session with correct user_id
            if user:
                await db.user_sessions.update_one(
                    {"session_token": session_token},
                    {"$set": {"user_id": user["id"]}}
                )
    
    if not user:
        return {"authenticated": False, "reason": "user_not_found"}
    
    # Determine user type from email
    email = user.get("email", "")
    is_staff = email.endswith(f"@{ALLOWED_DOMAIN}")
    user_type = "staff" if is_staff else "external"
    redirect_url = "/focus" if is_staff else "/nurture/lms"
    
    # Get permissions based on user type and role
    permissions = get_user_permissions(user_type, user.get("role"))
    
    return {
        "authenticated": True,
        "user_type": user_type,
        "redirect_url": redirect_url,
        "permissions": permissions,
        "user": {
            "id": user.get("id"),
            "email": user.get("email"),
            "name": user.get("name"),
            "picture": user.get("picture"),
            "role": user.get("role"),
            "assigned_courses": user.get("assigned_courses", [])
        }
    }



@router.get("/debug-cookies")
async def debug_cookies(request: Request):
    """
    Temporary diagnostic endpoint to debug cookie issues.
    Returns info about received cookies and headers.
    """
    cookies = dict(request.cookies)
    # Mask cookie values for security
    masked_cookies = {k: f"{v[:10]}..." if len(v) > 10 else v for k, v in cookies.items()}
    
    headers_info = {
        "host": request.headers.get("host"),
        "x-forwarded-host": request.headers.get("x-forwarded-host"),
        "x-forwarded-proto": request.headers.get("x-forwarded-proto"),
        "origin": request.headers.get("origin"),
        "referer": request.headers.get("referer"),
    }
    
    return {
        "cookies_received": masked_cookies,
        "cookie_names": list(cookies.keys()),
        "session_token_present": "session_token" in cookies,
        "headers": headers_info
    }

