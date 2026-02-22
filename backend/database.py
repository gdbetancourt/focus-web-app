"""
Database module for Leaderlix Backend
Provides MongoDB connection and database instance

IMPORTANT: This module connects to the 'leaderlix' database which contains
all production data including ~28,000 contacts. DO NOT change DB_NAME
without explicit user approval.
"""
from motor.motor_asyncio import AsyncIOMotorClient
from config import MONGO_URL, DB_NAME
import logging

logger = logging.getLogger(__name__)

# SAFETY CHECK: Verify we're connecting to the correct database
EXPECTED_DB_NAME = "leaderlix"
if DB_NAME != EXPECTED_DB_NAME:
    logger.warning(
        f"⚠️ DATABASE WARNING: Connecting to '{DB_NAME}' instead of '{EXPECTED_DB_NAME}'. "
        f"The production database is '{EXPECTED_DB_NAME}' with ~28,000 contacts."
    )

client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]

logger.info(f"✅ Connected to database: {DB_NAME}")

async def close_db():
    """Close database connection"""
    client.close()


async def ensure_indexes():
    """Create indexes for frequently queried fields to optimize performance"""
    try:
        # Contacts indexes
        await db.unified_contacts.create_index("email")
        await db.unified_contacts.create_index("stage")
        await db.unified_contacts.create_index("id")
        await db.unified_contacts.create_index([("created_at", -1)])
        
        # Persona Classifier indexes (V3 Architecture)
        await db.unified_contacts.create_index("job_title_normalized")
        await db.unified_contacts.create_index("buyer_persona")
        await db.unified_contacts.create_index("buyer_persona_locked")
        
        # Job Keywords indexes (V3 Architecture)
        await db.job_keywords.create_index("keyword")
        await db.job_keywords.create_index("buyer_persona_id")
        await db.job_keywords.create_index([("keyword", 1), ("buyer_persona_id", 1)])
        
        # Users indexes
        await db.users.create_index("id", unique=True)
        await db.users.create_index("email", unique=True)
        
        # External users indexes
        await db.external_users.create_index("id", unique=True)
        await db.external_users.create_index("email", unique=True)
        await db.external_users.create_index("verification_token")
        
        # Sessions indexes
        await db.user_sessions.create_index("session_token")
        await db.user_sessions.create_index("user_id")
        await db.user_sessions.create_index("expires_at")
        
        await db.external_user_sessions.create_index("session_token")
        await db.external_user_sessions.create_index("user_id")
        
        # LMS indexes
        await db.courses.create_index("id")
        await db.courses.create_index("is_published")
        await db.lessons.create_index("course_id")
        await db.lms_progress.create_index([("user_id", 1), ("course_id", 1)])
        
        # Companies indexes
        await db.companies.create_index("name")
        await db.companies.create_index("status")
        
        # Events indexes
        await db.events.create_index("date")
        await db.events.create_index("event_type")
        
        logger.info("✅ Database indexes created successfully (including Persona Classifier V3)")
    except Exception as e:
        logger.warning(f"⚠️ Error creating indexes (may already exist): {e}")
