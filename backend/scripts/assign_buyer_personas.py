"""
Script to automatically assign buyer personas to existing contacts
based on their job title/headline matching buyer persona keywords.

Simplified buyer personas (transversal by position):
- jorge: Direcciones Comerciales
- carolina: Direcciones de Compras  
- martha: Direcciones de Marketing
- ricardo: Direcciones de RRHH
- manuel: Direcciones Médicas
- sandra: Event & Meeting Planners
- raquel: Otras Direcciones
- ramona: Médico Externo
- mateo: Usuario Final (catch-all)
"""
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os

MONGO_URL = os.environ.get('MONGO_URL', 'mongodb+srv://leaderlix_admin:Leaderlix2025Atlas@cluster0.epfhsrk.mongodb.net/?retryWrites=true&w=majority')
DB_NAME = os.environ.get('DB_NAME', 'leaderlix')


async def assign_personas():
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
    
    # Get all buyer personas with their keywords
    personas = await db.buyer_personas_db.find({}, {"_id": 0}).to_list(100)
    print(f"Found {len(personas)} buyer personas")
    
    # Build keyword lookup (excluding mateo which is catch-all)
    persona_keywords = {}
    for p in personas:
        code = p.get("code", "")
        if code and code != "mateo":  # Mateo is catch-all
            keywords = [k.lower().strip() for k in p.get("keywords", []) if k]
            if keywords:
                persona_keywords[code] = {
                    "keywords": keywords,
                    "display_name": p.get("display_name", code)
                }
    
    print(f"Loaded {len(persona_keywords)} personas with keywords")
    
    # Get all contacts
    contacts = await db.unified_contacts.find(
        {},
        {"_id": 0, "id": 1, "name": 1, "job_title": 1, "headline": 1}
    ).to_list(10000)
    
    print(f"\nProcessing {len(contacts)} contacts...")
    
    # Match contacts to personas
    matched = {code: 0 for code in persona_keywords.keys()}
    matched["mateo"] = 0
    
    for contact in contacts:
        job_title = (contact.get("job_title") or contact.get("headline") or "").lower()
        
        # Try to match against all personas
        best_match = None
        for code, data in persona_keywords.items():
            for keyword in data["keywords"]:
                if keyword in job_title:
                    best_match = code
                    break
            if best_match:
                break
        
        # If no match, assign to mateo (catch-all)
        if not best_match:
            best_match = "mateo"
        
        # Update contact
        await db.unified_contacts.update_one(
            {"id": contact["id"]},
            {"$set": {"buyer_persona": best_match}}
        )
        matched[best_match] += 1
    
    print("\n=== Assignment Results ===")
    for code, count in sorted(matched.items(), key=lambda x: -x[1]):
        display = persona_keywords.get(code, {}).get("display_name", "Mateo - Usuario Final")
        print(f"  {display}: {count} contacts")
    
    print(f"\nTotal: {sum(matched.values())} contacts assigned")
    client.close()


if __name__ == "__main__":
    asyncio.run(assign_personas())
