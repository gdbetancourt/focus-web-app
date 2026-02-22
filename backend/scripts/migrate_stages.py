"""
Migration Script: Unify delivery_stage into stage field

This script migrates cases that have delivery_stage (Stage 4) to use
the unified stage field instead.

Before: 
  - stage: "cierre_administrativo" (old Stage 3 value)
  - delivery_stage: "ganados" (Stage 4 value)

After:
  - stage: "ganados" (unified)
  - previous_stage: "cierre_administrativo" (for reference)
  - delivery_stage field removed
  
Run this script ONCE after deploying the code changes.
"""

import asyncio
import os
from datetime import datetime, timezone
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

load_dotenv()

MONGO_URL = os.environ.get('MONGO_URL')
DB_NAME = os.environ.get('DB_NAME', 'crm')

STAGE_4_VALUES = [
    "ganados",
    "concluidos",
    "contenidos_transcritos",
    "reporte_presentado",
    "caso_publicado"
]

async def migrate():
    print(f"Connecting to database: {DB_NAME}")
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
    
    # Find all cases with delivery_stage
    cases_with_delivery = await db.cases.find(
        {"delivery_stage": {"$exists": True, "$ne": ""}},
        {"_id": 0, "id": 1, "name": 1, "stage": 1, "delivery_stage": 1}
    ).to_list(None)
    
    print(f"\nFound {len(cases_with_delivery)} cases with delivery_stage to migrate")
    
    if not cases_with_delivery:
        print("No cases to migrate. Done!")
        return
    
    # Show preview
    print("\n=== PREVIEW (first 10) ===")
    for case in cases_with_delivery[:10]:
        print(f"  - {case.get('name', 'Sin nombre')}")
        print(f"    Current stage: {case.get('stage')}")
        print(f"    delivery_stage: {case.get('delivery_stage')}")
        print(f"    -> Will become stage: {case.get('delivery_stage')}")
        print()
    
    # Confirm
    confirm = input("\nProceed with migration? (yes/no): ")
    if confirm.lower() != 'yes':
        print("Migration cancelled.")
        return
    
    # Perform migration
    migrated = 0
    errors = 0
    now = datetime.now(timezone.utc).isoformat()
    
    for case in cases_with_delivery:
        case_id = case.get("id")
        delivery_stage = case.get("delivery_stage")
        current_stage = case.get("stage")
        
        if delivery_stage not in STAGE_4_VALUES:
            print(f"  WARNING: Unknown delivery_stage '{delivery_stage}' in case {case_id}")
            continue
        
        try:
            # Update: move delivery_stage to stage, save old stage as previous_stage
            result = await db.cases.update_one(
                {"id": case_id},
                {
                    "$set": {
                        "stage": delivery_stage,
                        "previous_stage": current_stage,
                        "migration_date": now,
                        "updated_at": now
                    },
                    "$unset": {
                        "delivery_stage": ""
                    }
                }
            )
            
            if result.modified_count > 0:
                migrated += 1
                print(f"  ✓ Migrated: {case.get('name', case_id)}")
            else:
                print(f"  ? No change: {case.get('name', case_id)}")
        except Exception as e:
            errors += 1
            print(f"  ✗ Error migrating {case_id}: {e}")
    
    print(f"\n=== MIGRATION COMPLETE ===")
    print(f"Migrated: {migrated}")
    print(f"Errors: {errors}")
    
    # Verify
    remaining = await db.cases.count_documents({"delivery_stage": {"$exists": True, "$ne": ""}})
    print(f"Cases still with delivery_stage: {remaining}")


if __name__ == "__main__":
    asyncio.run(migrate())
