"""
Import HubSpot contacts to FOCUS unified_contacts database
With deduplication by email and LinkedIn URL
"""
import asyncio
import json
import uuid
from datetime import datetime, timezone
from motor.motor_asyncio import AsyncIOMotorClient
import os

MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "focus_db")

async def import_contacts():
    # Connect to MongoDB
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
    
    # Load contacts from JSON
    with open("/tmp/hubspot_contacts.json", "r") as f:
        contacts = json.load(f)
    
    print(f"Loaded {len(contacts)} contacts from JSON")
    
    imported = 0
    skipped_email = 0
    skipped_linkedin = 0
    skipped_hubspot = 0
    
    for contact in contacts:
        # Check for duplicate by HubSpot ID
        hubspot_id = contact.get("hubspot_id")
        if hubspot_id:
            existing = await db.unified_contacts.find_one({"hubspot_id": hubspot_id})
            if existing:
                skipped_hubspot += 1
                continue
        
        # Check for duplicate by email
        emails = contact.get("email", [])
        if emails:
            for email in emails:
                if email:
                    existing = await db.unified_contacts.find_one({
                        "email": {"$elemMatch": {"$eq": email}}
                    })
                    if existing:
                        skipped_email += 1
                        break
            else:
                pass  # No duplicate found by email
            if existing:
                continue
        
        # Check for duplicate by LinkedIn URL
        linkedin_url = contact.get("linkedin_url")
        if linkedin_url:
            existing = await db.unified_contacts.find_one({"linkedin_url": linkedin_url})
            if existing:
                skipped_linkedin += 1
                continue
        
        # No duplicate found, insert contact
        now = datetime.now(timezone.utc).isoformat()
        contact["id"] = str(uuid.uuid4())
        contact["created_at"] = now
        contact["updated_at"] = now
        
        await db.unified_contacts.insert_one(contact)
        imported += 1
    
    print(f"\n=== Import Complete ===")
    print(f"Imported: {imported}")
    print(f"Skipped (duplicate HubSpot ID): {skipped_hubspot}")
    print(f"Skipped (duplicate email): {skipped_email}")
    print(f"Skipped (duplicate LinkedIn): {skipped_linkedin}")
    print(f"Total processed: {len(contacts)}")
    
    # Get total count
    total = await db.unified_contacts.count_documents({})
    print(f"\nTotal contacts in database: {total}")
    
    client.close()


if __name__ == "__main__":
    asyncio.run(import_contacts())
