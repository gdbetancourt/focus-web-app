"""
Script to assign unique fictional names to buyer personas
"""
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os

MONGO_URL = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
DB_NAME = os.environ.get('DB_NAME', 'focus_db')

# Unique fictional names - one per persona area (7 areas + 2 special)
AREA_NAMES = {
    "Direcciones de Marketing": {
        "name": "Sofía",
        "color": "#FF6B6B",  # Coral red
        "description": "Directora de Marketing estratégico"
    },
    "Direcciones Comerciales": {
        "name": "Alejandro", 
        "color": "#4ECDC4",  # Teal
        "description": "Director Comercial y Ventas"
    },
    "Direcciones Médicas": {
        "name": "Valentina",
        "color": "#9B59B6",  # Purple
        "description": "Directora Médica Científica"
    },
    "Direcciones de RRHH": {
        "name": "Fernando",
        "color": "#3498DB",  # Blue
        "description": "Director de Recursos Humanos"
    },
    "Direcciones de Compras": {
        "name": "Gabriela",
        "color": "#F39C12",  # Orange
        "description": "Directora de Compras y Procurement"
    },
    "Event & Meeting Planners": {
        "name": "Ricardo",
        "color": "#1ABC9C",  # Turquoise
        "description": "Coordinador de Eventos Corporativos"
    },
    "Otras Direcciones": {
        "name": "Daniela",
        "color": "#95A5A6",  # Gray
        "description": "Otras áreas de dirección"
    },
    "Médicos Especialistas": {
        "name": "Dr. Ramón",
        "color": "#E74C3C",  # Red
        "description": "Médico especialista líder de opinión"
    },
    "Sin Clasificar": {
        "name": "Nuevo Contacto",
        "color": "#BDC3C7",  # Light gray
        "description": "Contacto pendiente de clasificar"
    }
}

# LinkedIn keywords by area
AREA_KEYWORDS = {
    "Direcciones de Marketing": [
        "Marketing Director", "Director de Marketing", "CMO", 
        "Chief Marketing Officer", "Head of Marketing", "VP Marketing",
        "Brand Director", "Marketing Lead", "Marketing Manager"
    ],
    "Direcciones Comerciales": [
        "Commercial Director", "Director Comercial", "Sales Director",
        "Director de Ventas", "VP Sales", "Chief Revenue Officer",
        "Head of Sales", "Business Development Director"
    ],
    "Direcciones Médicas": [
        "Medical Director", "Director Médico", "Chief Medical Officer",
        "Medical Affairs Director", "Head of Medical Affairs",
        "Clinical Director", "Medical Science Liaison Manager"
    ],
    "Direcciones de RRHH": [
        "HR Director", "Director de RRHH", "Chief People Officer",
        "Head of Human Resources", "VP Human Resources",
        "Talent Director", "People & Culture Director"
    ],
    "Direcciones de Compras": [
        "Procurement Director", "Director de Compras", "Chief Procurement Officer",
        "Head of Procurement", "Supply Chain Director",
        "Strategic Sourcing Director", "Purchasing Director"
    ],
    "Event & Meeting Planners": [
        "Event Manager", "Meeting Planner", "Event Director",
        "Conference Manager", "Corporate Events Manager",
        "Congress Manager", "Event Coordinator"
    ],
    "Otras Direcciones": [
        "Director General", "CEO", "Managing Director",
        "Country Manager", "General Manager", "COO"
    ],
    "Médicos Especialistas": [
        "Médico especialista", "Especialista médico", "KOL médico",
        "Líder de opinión", "Investigador clínico"
    ],
    "Sin Clasificar": []
}


async def update_personas():
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
    
    personas = await db.buyer_personas_db.find({}).to_list(100)
    print(f"Found {len(personas)} buyer personas")
    
    updated = 0
    for persona in personas:
        area = persona.get("area", "Sin Clasificar")
        sector = persona.get("sector", "")
        
        config = AREA_NAMES.get(area, AREA_NAMES["Sin Clasificar"])
        keywords = AREA_KEYWORDS.get(area, [])
        
        # Create unique display name with sector
        sector_short = sector.replace("Information Technology and Services", "TI").replace("Food & Beverages", "F&B").replace("Mining & Metals", "Minería").replace("Consumer Goods", "Consumo").replace("Medical Devices", "Dispositivos Médicos")
        display_name = f"{config['name']} - {sector_short}" if sector_short else config['name']
        
        # Update persona
        result = await db.buyer_personas_db.update_one(
            {"id": persona["id"]},
            {"$set": {
                "persona_name": config["name"],
                "display_name": display_name,
                "color": config["color"],
                "persona_description": config["description"],
                "linkedin_keywords": keywords,
                "updated_at": "2026-01-25T22:00:00+00:00"
            }}
        )
        
        if result.modified_count > 0:
            updated += 1
            print(f"  Updated: {persona.get('name')} -> {display_name}")
    
    print(f"\nTotal updated: {updated}")
    
    # Verify
    print("\nVerification - unique persona names:")
    distinct_names = await db.buyer_personas_db.distinct("persona_name")
    for name in sorted(distinct_names):
        count = await db.buyer_personas_db.count_documents({"persona_name": name})
        sample = await db.buyer_personas_db.find_one({"persona_name": name}, {"_id": 0, "display_name": 1, "linkedin_keywords": 1})
        kw_count = len(sample.get("linkedin_keywords", []))
        print(f"  {name}: {count}x (keywords: {kw_count})")
    
    client.close()


if __name__ == "__main__":
    asyncio.run(update_personas())
