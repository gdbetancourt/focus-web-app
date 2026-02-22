"""
Migration script to unify all users into unified_contacts collection.
Migrates data from:
- users (staff @leaderlix.com)
- external_users (external users)
Into unified_contacts with auth fields.
"""
import asyncio
from datetime import datetime, timezone
from motor.motor_asyncio import AsyncIOMotorClient
import os
from dotenv import load_dotenv

load_dotenv()

MONGO_URL = os.environ.get("MONGO_URL")
DB_NAME = os.environ.get("DB_NAME", "leaderlix")


async def migrate():
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
    
    print("Starting migration to unified_contacts...")
    
    migrated_staff = 0
    migrated_external = 0
    updated_existing = 0
    
    # 1. Migrate staff users (from 'users' collection)
    print("\n--- Migrating staff users ---")
    async for user in db.users.find({}):
        email = user.get("email", "").lower()
        if not email:
            continue
            
        # Check if contact already exists
        existing = await db.unified_contacts.find_one({"email": email})
        
        auth_fields = {
            "auth_provider": user.get("auth_provider", "google"),
            "password_hash": user.get("password_hash"),
            "email_verified": True,  # Staff are verified
            "picture": user.get("picture"),
            "is_staff": True,
            "can_login": True,
            "last_login": user.get("updated_at"),
        }
        
        if existing:
            # Update existing contact with auth fields
            await db.unified_contacts.update_one(
                {"email": email},
                {"$set": {
                    **auth_fields,
                    "name": user.get("name") or existing.get("name"),
                    "updated_at": datetime.now(timezone.utc).isoformat()
                }}
            )
            updated_existing += 1
            print(f"  Updated existing contact: {email}")
        else:
            # Create new contact
            name = user.get("name", "")
            name_parts = name.split(" ", 1) if name else ["", ""]
            
            contact_doc = {
                "id": user.get("id") or f"contact_{email.replace('@', '_').replace('.', '_')}",
                "email": email,
                "name": name,
                "first_name": name_parts[0],
                "last_name": name_parts[1] if len(name_parts) > 1 else "",
                "stage": 4,  # Staff are in Deliver stage
                "source": "staff_migration",
                "buyer_persona": "staff",
                **auth_fields,
                "created_at": user.get("created_at", datetime.now(timezone.utc).isoformat()),
                "updated_at": datetime.now(timezone.utc).isoformat()
            }
            await db.unified_contacts.insert_one(contact_doc)
            migrated_staff += 1
            print(f"  Migrated staff: {email}")
    
    # 2. Migrate external users
    print("\n--- Migrating external users ---")
    async for user in db.external_users.find({}):
        email = user.get("email", "").lower()
        if not email:
            continue
            
        # Check if contact already exists
        existing = await db.unified_contacts.find_one({"email": email})
        
        auth_fields = {
            "auth_provider": user.get("auth_provider", "email"),
            "password_hash": user.get("password_hash"),
            "email_verified": user.get("email_verified", False),
            "verification_token": user.get("verification_token"),
            "verification_token_expires": user.get("verification_token_expires"),
            "picture": user.get("picture"),
            "is_staff": False,
            "can_login": True,
            "last_login": user.get("last_login"),
            "assigned_courses": user.get("assigned_courses", []),
        }
        
        if existing:
            # Update existing contact with auth fields
            await db.unified_contacts.update_one(
                {"email": email},
                {"$set": {
                    **auth_fields,
                    "name": user.get("name") or existing.get("name"),
                    "updated_at": datetime.now(timezone.utc).isoformat()
                }}
            )
            updated_existing += 1
            print(f"  Updated existing contact: {email}")
        else:
            # Create new contact
            name = user.get("name", "")
            name_parts = name.split(" ", 1) if name else ["", ""]
            
            contact_doc = {
                "id": user.get("id") or f"contact_{email.replace('@', '_').replace('.', '_')}",
                "email": email,
                "name": name,
                "first_name": name_parts[0],
                "last_name": name_parts[1] if len(name_parts) > 1 else "",
                "phone": user.get("phone"),
                "stage": 1,  # External users start in Prospect
                "source": "external_user_migration",
                "buyer_persona": "mateo",
                **auth_fields,
                "created_at": user.get("created_at", datetime.now(timezone.utc).isoformat()),
                "updated_at": datetime.now(timezone.utc).isoformat()
            }
            await db.unified_contacts.insert_one(contact_doc)
            migrated_external += 1
            print(f"  Migrated external user: {email}")
    
    # 3. Update user_sessions to use unified contact IDs
    print("\n--- Updating session references ---")
    # We'll keep the sessions as-is since they reference user IDs that now exist in unified_contacts
    
    print(f"\n=== Migration Complete ===")
    print(f"Staff migrated: {migrated_staff}")
    print(f"External users migrated: {migrated_external}")
    print(f"Existing contacts updated: {updated_existing}")
    
    client.close()


if __name__ == "__main__":
    asyncio.run(migrate())
