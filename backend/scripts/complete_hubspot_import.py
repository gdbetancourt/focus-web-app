"""
Script to complete HubSpot import - optimized for large lists
Runs in background to avoid timeout
"""
import asyncio
import sys
import uuid
from datetime import datetime, timezone
sys.path.insert(0, '/app/backend')

from motor.motor_asyncio import AsyncIOMotorClient
import httpx
from pathlib import Path

# Load environment
env_vars = {}
with open('/app/backend/.env') as f:
    for line in f:
        line = line.strip()
        if line and not line.startswith('#') and '=' in line:
            key, value = line.split('=', 1)
            env_vars[key] = value.strip('"').strip("'")

MONGO_URL = env_vars['MONGO_URL']
DB_NAME = env_vars['DB_NAME']
HUBSPOT_TOKEN = env_vars.get('HUBSPOT_TOKEN', '')

# Cache for companies to avoid repeated lookups
company_cache = {}


async def get_or_create_company(db, company_id: str, company_name: str = None) -> str:
    """Get or create company - with caching"""
    if not company_id:
        return None
    
    # Check cache first
    if company_id in company_cache:
        return company_cache[company_id]
    
    # Check DB
    existing = await db.hubspot_companies.find_one(
        {"$or": [{"hs_object_id": company_id}, {"hs_object_id": str(company_id)}]},
        {"_id": 0, "id": 1}
    )
    
    if existing:
        company_cache[company_id] = existing.get("id")
        return existing.get("id")
    
    # Fetch from HubSpot
    async with httpx.AsyncClient() as client:
        try:
            response = await client.get(
                f"https://api.hubapi.com/crm/v3/objects/companies/{company_id}",
                headers={"Authorization": f"Bearer {HUBSPOT_TOKEN}"},
                params={"properties": "name,domain,industry"},
                timeout=10.0
            )
            
            if response.status_code == 200:
                props = response.json().get("properties", {})
                new_id = str(uuid.uuid4())
                await db.hubspot_companies.insert_one({
                    "id": new_id,
                    "hs_object_id": company_id,
                    "name": props.get("name", company_name or "Unknown"),
                    "domain": props.get("domain", ""),
                    "industry": props.get("industry", ""),
                    "source": "hubspot_import",
                    "created_at": datetime.now(timezone.utc).isoformat()
                })
                company_cache[company_id] = new_id
                return new_id
        except:
            pass
    
    return None


async def main():
    print("=" * 70)
    print("IMPORTACIÓN DE HUBSPOT - MODO BACKGROUND")
    print("=" * 70)
    
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
    
    event_id = "65f7218c-455f-4850-9adf-2e13f317592f"
    event = await db.webinar_events_v2.find_one({"id": event_id})
    event_name = event.get("name", "Event")
    
    print(f"\nEvento: {event_name}")
    
    # Get all contact IDs from HubSpot list 32
    print("\n1. Obteniendo lista de HubSpot...")
    all_contact_ids = []
    
    async with httpx.AsyncClient() as http_client:
        after = None
        while True:
            url = f"https://api.hubapi.com/crm/v3/lists/32/memberships?limit=500"
            if after:
                url += f"&after={after}"
            
            response = await http_client.get(
                url,
                headers={"Authorization": f"Bearer {HUBSPOT_TOKEN}"},
                timeout=30.0
            )
            
            if response.status_code != 200:
                break
            
            data = response.json()
            ids = [r["recordId"] for r in data.get("results", [])]
            all_contact_ids.extend(ids)
            
            paging = data.get("paging", {})
            if "next" in paging:
                after = paging["next"].get("after")
            else:
                break
    
    print(f"   Total en HubSpot: {len(all_contact_ids)}")
    
    # Get existing hubspot_ids
    print("\n2. Verificando existentes...")
    existing = await db.unified_contacts.find(
        {"webinar_history.event_id": event_id},
        {"_id": 0, "hubspot_id": 1}
    ).to_list(None)
    
    existing_ids = {c.get("hubspot_id") for c in existing if c.get("hubspot_id")}
    missing_ids = [cid for cid in all_contact_ids if cid not in existing_ids]
    
    print(f"   Ya importados: {len(existing_ids)}")
    print(f"   Faltantes: {len(missing_ids)}")
    
    if not missing_ids:
        print("\n✅ Importación completa!")
        return
    
    # Fetch and import in batches
    print("\n3. Importando contactos faltantes...")
    created = 0
    updated = 0
    skipped = 0
    now = datetime.now(timezone.utc).isoformat()
    
    webinar_entry = {
        "event_id": event_id,
        "event_name": event_name,
        "status": "registered",
        "registered_at": now,
        "source": "hubspot_import"
    }
    
    batch_size = 100
    async with httpx.AsyncClient() as http_client:
        for i in range(0, len(missing_ids), batch_size):
            batch = missing_ids[i:i + batch_size]
            
            # Fetch batch from HubSpot
            response = await http_client.post(
                "https://api.hubapi.com/crm/v3/objects/contacts/batch/read",
                headers={
                    "Authorization": f"Bearer {HUBSPOT_TOKEN}",
                    "Content-Type": "application/json"
                },
                json={
                    "properties": ["firstname", "lastname", "email", "phone", "company", "jobtitle", "associatedcompanyid"],
                    "inputs": [{"id": str(cid)} for cid in batch]
                },
                timeout=60.0
            )
            
            if response.status_code != 200:
                print(f"   Error en batch {i//batch_size + 1}")
                continue
            
            contacts = response.json().get("results", [])
            
            for contact in contacts:
                props = contact.get("properties", {})
                hubspot_id = contact.get("id")
                
                email = (props.get("email") or "").strip().lower()
                if not email:
                    skipped += 1
                    continue
                
                # Check if exists by email
                existing_contact = await db.unified_contacts.find_one({"email": email})
                
                if existing_contact:
                    # Add webinar to history if not present
                    history = existing_contact.get("webinar_history", [])
                    if not any(w.get("event_id") == event_id for w in history):
                        await db.unified_contacts.update_one(
                            {"email": email},
                            {
                                "$push": {"webinar_history": webinar_entry},
                                "$set": {"hubspot_id": hubspot_id}
                            }
                        )
                        updated += 1
                else:
                    # Create new contact
                    firstname = (props.get("firstname") or "").strip()
                    lastname = (props.get("lastname") or "").strip()
                    company_id = await get_or_create_company(db, props.get("associatedcompanyid"), props.get("company"))
                    
                    await db.unified_contacts.insert_one({
                        "id": str(uuid.uuid4()),
                        "hubspot_id": hubspot_id,
                        "name": f"{firstname} {lastname}".strip() or "Sin nombre",
                        "first_name": firstname,
                        "last_name": lastname,
                        "email": email,
                        "phone": (props.get("phone") or "").strip(),
                        "company": (props.get("company") or "").strip(),
                        "company_id": company_id,
                        "job_title": (props.get("jobtitle") or "").strip(),
                        "buyer_persona": "mateo",
                        "stage": 2,
                        "status": "active",
                        "source": "hubspot",
                        "webinar_history": [webinar_entry],
                        "created_at": now,
                        "updated_at": now
                    })
                    created += 1
            
            print(f"   Batch {i//batch_size + 1}/{(len(missing_ids)-1)//batch_size + 1}: +{created} creados, +{updated} actualizados")
    
    # Update event
    final_count = await db.unified_contacts.count_documents({"webinar_history.event_id": event_id})
    await db.webinar_events_v2.update_one(
        {"id": event_id},
        {"$set": {
            "last_hubspot_import": {
                "url": "list_32",
                "result": {"created": created, "updated": updated, "total": final_count},
                "imported_at": now
            }
        }}
    )
    
    print(f"\n" + "=" * 70)
    print(f"✅ IMPORTACIÓN COMPLETADA")
    print(f"   Creados: {created}")
    print(f"   Actualizados: {updated}")
    print(f"   Omitidos: {skipped}")
    print(f"   Total contactos: {final_count}")
    print("=" * 70)


if __name__ == "__main__":
    asyncio.run(main())
