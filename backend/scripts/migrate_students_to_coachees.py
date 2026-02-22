"""
Migration script: Convert existing Students to Coachees
Excludes contacts imported from Cases tool (source = hubspot_deal)
"""
import asyncio
from datetime import datetime, timezone
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
import os

load_dotenv()

MONGO_URL = os.environ.get("MONGO_URL")
DB_NAME = os.environ.get("DB_NAME")


async def migrate_students_to_coachees():
    """
    Convert all contacts with role 'student' to 'coachee'
    EXCEPT those imported from the Cases tool (source = 'hubspot_deal')
    """
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
    
    now = datetime.now(timezone.utc).isoformat()
    
    # Find all contacts with student role that were NOT imported from cases
    query = {
        "$or": [
            {"roles": {"$in": ["student", "Student", "estudiante", "Estudiante"]}},
            {"contact_types": {"$in": ["student", "Student", "estudiante", "Estudiante"]}}
        ],
        "source": {"$ne": "hubspot_deal"}
    }
    
    contacts_to_migrate = await db.unified_contacts.find(query).to_list(None)
    print(f"Found {len(contacts_to_migrate)} contacts to migrate from Student to Coachee")
    
    migrated = 0
    for contact in contacts_to_migrate:
        contact_id = contact.get("id")
        email = contact.get("email", "")
        
        # Get current roles
        roles = contact.get("roles") or contact.get("contact_types") or []
        
        # Replace student variants with coachee
        new_roles = []
        for role in roles:
            if role.lower() in ["student", "estudiante"]:
                if "coachee" not in new_roles:
                    new_roles.append("coachee")
            else:
                new_roles.append(role)
        
        # Update the contact
        result = await db.unified_contacts.update_one(
            {"id": contact_id},
            {"$set": {
                "roles": new_roles,
                "contact_types": new_roles,
                "updated_at": now,
                "migrated_from_student": True,
                "migration_date": now
            }}
        )
        
        if result.modified_count > 0:
            migrated += 1
            print(f"  Migrated: {email} | {roles} → {new_roles}")
    
    print(f"\n✅ Migration complete: {migrated} contacts converted from Student to Coachee")
    
    # Show contacts that were excluded (imported from cases)
    excluded = await db.unified_contacts.count_documents({
        "$or": [
            {"roles": {"$in": ["student", "Student", "estudiante", "Estudiante"]}},
            {"contact_types": {"$in": ["student", "Student", "estudiante", "Estudiante"]}}
        ],
        "source": "hubspot_deal"
    })
    print(f"⚠️  Excluded: {excluded} contacts (imported from Cases tool, kept as Student)")
    
    client.close()


if __name__ == "__main__":
    asyncio.run(migrate_students_to_coachees())
