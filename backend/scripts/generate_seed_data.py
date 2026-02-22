"""
Seed Data Generator for Classification System Testing
Generates minimal dataset to validate:
- Company classification (inbound/outbound)
- Industry inheritance
- Propagation logic (industry→company, company→contact)
- Multi-relationship handling (1 contact with 2 companies, 1 company with 2 industries)
"""
import asyncio
import os
import sys
from datetime import datetime, timezone, timedelta
import uuid

# Add parent to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from motor.motor_asyncio import AsyncIOMotorClient

MONGO_URL = os.environ.get("MONGO_URL", "").strip('"')
DB_NAME = os.environ.get("DB_NAME", "leaderlix").strip('"')


async def generate_seed_data():
    """Generate seed data for testing classification system"""
    
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
    
    now = datetime.now(timezone.utc).isoformat()
    yesterday = (datetime.now(timezone.utc) - timedelta(days=1)).isoformat()
    
    print("=" * 60)
    print("GENERATING SEED DATA FOR CLASSIFICATION TESTING")
    print("=" * 60)
    
    # ========== INDUSTRIES (2) ==========
    industries = [
        {
            "id": str(uuid.uuid4()),
            "code": "pharma",
            "name": "Farmacéutica",
            "description": "Industria farmacéutica y healthcare",
            "color": "#22c55e",
            "classification": "outbound",  # This is OUTBOUND
            "is_merged": False,
            "created_at": yesterday,
            "updated_at": now
        },
        {
            "id": str(uuid.uuid4()),
            "code": "tech",
            "name": "Tecnología",
            "description": "Empresas de tecnología y software",
            "color": "#3b82f6",
            "classification": "inbound",  # This is INBOUND
            "is_merged": False,
            "created_at": yesterday,
            "updated_at": now
        }
    ]
    
    print(f"\n📦 Creating {len(industries)} industries...")
    await db.industries.delete_many({})  # Clear existing
    await db.industries.insert_many(industries)
    print(f"   ✓ Industria 1: {industries[0]['name']} (OUTBOUND)")
    print(f"   ✓ Industria 2: {industries[1]['name']} (INBOUND)")
    
    # ========== COMPANIES (5) ==========
    # Company 1-3: Single industry
    # Company 4: Has TWO industries (pharma + tech) - for multi-industry test
    # Company 5: No industry
    
    companies = [
        {
            "id": str(uuid.uuid4()),
            "name": "Laboratorios Alfa",
            "normalized_name": "laboratorios alfa",
            "classification": "outbound",
            "industry": "Farmacéutica",
            "industry_id": industries[0]["id"],
            "domain": "labalfa.com",
            "aliases": ["Alfa Labs", "Lab Alfa"],
            "searches": [],
            "is_merged": False,
            "_legacy_sources": ["seed"],
            "created_at": yesterday,
            "updated_at": now
        },
        {
            "id": str(uuid.uuid4()),
            "name": "Pharma Beta",
            "normalized_name": "pharma beta",
            "classification": "inbound",  # Even though industry is outbound - for testing
            "industry": "Farmacéutica",
            "industry_id": industries[0]["id"],
            "domain": "pharmabeta.mx",
            "aliases": [],
            "searches": [],
            "is_merged": False,
            "_legacy_sources": ["seed"],
            "created_at": yesterday,
            "updated_at": now
        },
        {
            "id": str(uuid.uuid4()),
            "name": "TechSoft Solutions",
            "normalized_name": "techsoft solutions",
            "classification": "inbound",
            "industry": "Tecnología",
            "industry_id": industries[1]["id"],
            "domain": "techsoft.io",
            "aliases": ["TechSoft", "TS Solutions"],
            "searches": [],
            "is_merged": False,
            "_legacy_sources": ["seed"],
            "created_at": yesterday,
            "updated_at": now
        },
        {
            "id": str(uuid.uuid4()),
            "name": "BioTech Innovación",  # MULTI-INDUSTRY: pharma + tech
            "normalized_name": "biotech innovación",
            "classification": "inbound",
            "industry": "Farmacéutica",  # Primary industry
            "industry_id": industries[0]["id"],
            "industries": ["Farmacéutica", "Tecnología"],  # Both industries
            "industry_ids": [industries[0]["id"], industries[1]["id"]],
            "domain": "biotechinnovacion.com",
            "aliases": ["BioTech", "BTI"],
            "searches": [],
            "is_merged": False,
            "_legacy_sources": ["seed"],
            "created_at": yesterday,
            "updated_at": now
        },
        {
            "id": str(uuid.uuid4()),
            "name": "Empresa Sin Industria",
            "normalized_name": "empresa sin industria",
            "classification": "inbound",
            "industry": None,
            "industry_id": None,
            "domain": "sinind.com",
            "aliases": [],
            "searches": [],
            "is_merged": False,
            "_legacy_sources": ["seed"],
            "created_at": yesterday,
            "updated_at": now
        }
    ]
    
    print(f"\n🏢 Creating {len(companies)} companies...")
    await db.unified_companies.delete_many({})  # Clear existing
    await db.unified_companies.insert_many(companies)
    for i, c in enumerate(companies):
        ind = c.get("industry") or "Sin industria"
        multi = " (MULTI-INDUSTRY)" if c.get("industries") else ""
        print(f"   ✓ Empresa {i+1}: {c['name']} [{c['classification'].upper()}] - {ind}{multi}")
    
    # ========== CONTACTS (10) ==========
    # Contact 1-7: Single company
    # Contact 8: TWO companies (for multi-company test)
    # Contact 9-10: No company
    
    contacts = [
        # Company 1 contacts (Laboratorios Alfa - outbound)
        {
            "id": str(uuid.uuid4()),
            "name": "Juan García",
            "first_name": "Juan",
            "last_name": "García",
            "email": "juan.garcia@labalfa.com",
            "company": "Laboratorios Alfa",
            "company_id": companies[0]["id"],
            "companies": [{"company_id": companies[0]["id"], "company_name": "Laboratorios Alfa"}],
            "classification": "outbound",
            "stage": 3,
            "created_at": yesterday,
            "updated_at": now
        },
        {
            "id": str(uuid.uuid4()),
            "name": "María López",
            "first_name": "María",
            "last_name": "López",
            "email": "maria.lopez@labalfa.com",
            "company": "Laboratorios Alfa",
            "company_id": companies[0]["id"],
            "companies": [{"company_id": companies[0]["id"], "company_name": "Laboratorios Alfa"}],
            "classification": "outbound",
            "stage": 4,
            "created_at": yesterday,
            "updated_at": now
        },
        # Company 2 contacts (Pharma Beta - inbound)
        {
            "id": str(uuid.uuid4()),
            "name": "Carlos Rodríguez",
            "first_name": "Carlos",
            "last_name": "Rodríguez",
            "email": "carlos@pharmabeta.mx",
            "company": "Pharma Beta",
            "company_id": companies[1]["id"],
            "companies": [{"company_id": companies[1]["id"], "company_name": "Pharma Beta"}],
            "classification": "inbound",
            "stage": 2,
            "created_at": yesterday,
            "updated_at": now
        },
        # Company 3 contacts (TechSoft - inbound)
        {
            "id": str(uuid.uuid4()),
            "name": "Ana Martínez",
            "first_name": "Ana",
            "last_name": "Martínez",
            "email": "ana@techsoft.io",
            "company": "TechSoft Solutions",
            "company_id": companies[2]["id"],
            "companies": [{"company_id": companies[2]["id"], "company_name": "TechSoft Solutions"}],
            "classification": "inbound",
            "stage": 1,
            "created_at": yesterday,
            "updated_at": now
        },
        {
            "id": str(uuid.uuid4()),
            "name": "Pedro Sánchez",
            "first_name": "Pedro",
            "last_name": "Sánchez",
            "email": "pedro@techsoft.io",
            "company": "TechSoft Solutions",
            "company_id": companies[2]["id"],
            "companies": [{"company_id": companies[2]["id"], "company_name": "TechSoft Solutions"}],
            "classification": "inbound",
            "stage": 2,
            "created_at": yesterday,
            "updated_at": now
        },
        # Company 4 contacts (BioTech - multi-industry)
        {
            "id": str(uuid.uuid4()),
            "name": "Laura Fernández",
            "first_name": "Laura",
            "last_name": "Fernández",
            "email": "laura@biotechinnovacion.com",
            "company": "BioTech Innovación",
            "company_id": companies[3]["id"],
            "companies": [{"company_id": companies[3]["id"], "company_name": "BioTech Innovación"}],
            "classification": "inbound",
            "stage": 3,
            "created_at": yesterday,
            "updated_at": now
        },
        # Company 5 contacts (Sin industria)
        {
            "id": str(uuid.uuid4()),
            "name": "Roberto Díaz",
            "first_name": "Roberto",
            "last_name": "Díaz",
            "email": "roberto@sinind.com",
            "company": "Empresa Sin Industria",
            "company_id": companies[4]["id"],
            "companies": [{"company_id": companies[4]["id"], "company_name": "Empresa Sin Industria"}],
            "classification": "inbound",
            "stage": 1,
            "created_at": yesterday,
            "updated_at": now
        },
        # MULTI-COMPANY CONTACT: Works at both Laboratorios Alfa AND TechSoft
        {
            "id": str(uuid.uuid4()),
            "name": "Diego Hernández",
            "first_name": "Diego",
            "last_name": "Hernández",
            "email": "diego@consultor.com",
            "company": "Laboratorios Alfa",  # Primary
            "company_id": companies[0]["id"],
            "companies": [
                {"company_id": companies[0]["id"], "company_name": "Laboratorios Alfa"},
                {"company_id": companies[2]["id"], "company_name": "TechSoft Solutions"}
            ],
            "classification": "outbound",  # Should be outbound because Alfa is outbound
            "stage": 3,
            "created_at": yesterday,
            "updated_at": now
        },
        # No company contacts
        {
            "id": str(uuid.uuid4()),
            "name": "Sofía Ramírez",
            "first_name": "Sofía",
            "last_name": "Ramírez",
            "email": "sofia.ramirez@gmail.com",
            "company": None,
            "company_id": None,
            "companies": [],
            "classification": "inbound",
            "stage": 1,
            "created_at": yesterday,
            "updated_at": now
        },
        {
            "id": str(uuid.uuid4()),
            "name": "Miguel Torres",
            "first_name": "Miguel",
            "last_name": "Torres",
            "email": "miguel.torres@outlook.com",
            "company": None,
            "company_id": None,
            "companies": [],
            "classification": "inbound",
            "stage": 1,
            "created_at": yesterday,
            "updated_at": now
        }
    ]
    
    print(f"\n👤 Creating {len(contacts)} contacts...")
    await db.unified_contacts.delete_many({})  # Clear existing
    await db.unified_contacts.insert_many(contacts)
    for i, c in enumerate(contacts):
        comp = c.get("company") or "Sin empresa"
        multi = " (MULTI-COMPANY)" if len(c.get("companies", [])) > 1 else ""
        print(f"   ✓ Contacto {i+1}: {c['name']} [{c['classification'].upper()}] @ {comp}{multi}")
    
    # ========== CASES (3) ==========
    cases = [
        {
            "id": str(uuid.uuid4()),
            "name": "[Laboratorios Alfa] Implementación CRM",
            "company_name": "Laboratorios Alfa",
            "company_names": ["Laboratorios Alfa"],
            "stage": 4,
            "delivery_stage": "in_progress",
            "status": "active",
            "created_at": yesterday,
            "updated_at": now
        },
        {
            "id": str(uuid.uuid4()),
            "name": "[Pharma Beta] Consultoría Digital",
            "company_name": "Pharma Beta",
            "company_names": ["Pharma Beta"],
            "stage": 3,
            "status": "active",
            "created_at": yesterday,
            "updated_at": now
        },
        {
            "id": str(uuid.uuid4()),
            "name": "[TechSoft] Desarrollo App",
            "company_name": "TechSoft Solutions",
            "company_names": ["TechSoft Solutions"],
            "stage": 2,
            "status": "active",
            "created_at": yesterday,
            "updated_at": now
        }
    ]
    
    print(f"\n📋 Creating {len(cases)} cases...")
    await db.cases.delete_many({})  # Clear existing
    await db.cases.insert_many(cases)
    for i, c in enumerate(cases):
        print(f"   ✓ Caso {i+1}: {c['name']} [Stage {c['stage']}]")
    
    # ========== CLEAR AUDIT LOGS ==========
    await db.audit_logs.delete_many({})
    print(f"\n🗑️  Cleared audit_logs collection")
    
    # ========== SUMMARY ==========
    print("\n" + "=" * 60)
    print("SEED DATA GENERATION COMPLETE")
    print("=" * 60)
    
    # Verify counts
    counts = {
        "industries": await db.industries.count_documents({}),
        "unified_companies": await db.unified_companies.count_documents({}),
        "unified_contacts": await db.unified_contacts.count_documents({}),
        "cases": await db.cases.count_documents({}),
        "audit_logs": await db.audit_logs.count_documents({})
    }
    
    print(f"\n📊 Final counts:")
    for collection, count in counts.items():
        print(f"   • {collection}: {count}")
    
    print(f"\n🧪 TEST SCENARIOS AVAILABLE:")
    print(f"   1. Industry → Company propagation: Change 'Farmacéutica' to inbound")
    print(f"      → Should update: Laboratorios Alfa, Pharma Beta, BioTech")
    print(f"   2. Company → Contact propagation: Change 'Pharma Beta' to outbound")
    print(f"      → Should update: Carlos Rodríguez (1 contact)")
    print(f"   3. Multi-company contact: Diego Hernández (Alfa + TechSoft)")
    print(f"      → If Alfa becomes inbound, Diego should stay outbound (TechSoft rule)")
    print(f"      → If TechSoft becomes outbound, Diego stays outbound")
    print(f"   4. Multi-industry company: BioTech (Pharma + Tech)")
    print(f"      → Test propagation when one industry changes")
    print(f"   5. Company merge: Test merging Pharma Beta into Laboratorios Alfa")
    
    client.close()
    return counts


if __name__ == "__main__":
    asyncio.run(generate_seed_data())
