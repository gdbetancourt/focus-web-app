"""
Migration Script: Unify Companies into Single Canonical Entity

This script consolidates active_companies, hubspot_companies, and companies
into a single unified_companies collection.

IMPORTANT: Run this script only once. It creates the unified collection
and preserves all data including searches, aliases, merges, etc.
"""
import asyncio
import os
import uuid
import json
import re
from datetime import datetime, timezone
from typing import Dict, List, Optional, Tuple
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
from pathlib import Path

load_dotenv(Path("/app/backend/.env"))

MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
client = AsyncIOMotorClient(MONGO_URL)
db = client["leaderlix"]


def normalize_domain(domain: str) -> Optional[str]:
    """Normalize domain for comparison"""
    if not domain:
        return None
    domain = domain.strip().lower()
    domain = re.sub(r'^https?://', '', domain)
    if domain.startswith('www.'):
        domain = domain[4:]
    domain = domain.split('/')[0]
    domain = domain.split(':')[0]
    if '@' in domain:
        return None
    return domain if domain else None


def normalize_name(name: str) -> str:
    """Normalize company name for comparison"""
    if not name:
        return ""
    return name.strip().lower()


async def create_unified_collection():
    """Create unified_companies collection with indexes"""
    
    # Check if already exists
    collections = await db.list_collection_names()
    if "unified_companies" in collections:
        count = await db.unified_companies.count_documents({})
        if count > 0:
            print(f"WARNING: unified_companies already exists with {count} documents")
            return False
    
    # Create indexes
    await db.unified_companies.create_index("id", unique=True)
    await db.unified_companies.create_index("name")
    await db.unified_companies.create_index("normalized_name")
    await db.unified_companies.create_index("domain")
    await db.unified_companies.create_index("hubspot_id", sparse=True)
    await db.unified_companies.create_index("hs_object_id", sparse=True)
    await db.unified_companies.create_index("classification")
    await db.unified_companies.create_index("aliases")
    await db.unified_companies.create_index("is_merged")
    await db.unified_companies.create_index("industry_id", sparse=True)
    await db.unified_companies.create_index("_legacy_ids.active_companies", sparse=True)
    await db.unified_companies.create_index("_legacy_ids.hubspot_companies", sparse=True)
    await db.unified_companies.create_index("_legacy_ids.companies", sparse=True)
    
    print("Created unified_companies collection with indexes")
    return True


async def build_domain_index() -> Dict[str, List[dict]]:
    """Build index of all companies by normalized domain"""
    domain_index = {}
    
    # Index active_companies
    async for doc in db.active_companies.find({}):
        domain = normalize_domain(doc.get("domain") or "")
        if domain:
            if domain not in domain_index:
                domain_index[domain] = []
            domain_index[domain].append({"source": "active_companies", "doc": doc})
        
        # Also index multiple domains
        for d in (doc.get("domains") or []):
            nd = normalize_domain(d)
            if nd and nd != domain:
                if nd not in domain_index:
                    domain_index[nd] = []
                domain_index[nd].append({"source": "active_companies", "doc": doc})
    
    # Index hubspot_companies
    async for doc in db.hubspot_companies.find({}):
        domain = normalize_domain(doc.get("domain") or "")
        if domain:
            if domain not in domain_index:
                domain_index[domain] = []
            domain_index[domain].append({"source": "hubspot_companies", "doc": doc})
    
    # Index companies
    async for doc in db.companies.find({}):
        domain = normalize_domain(doc.get("domain") or "")
        if domain:
            if domain not in domain_index:
                domain_index[domain] = []
            domain_index[domain].append({"source": "companies", "doc": doc})
    
    return domain_index


async def build_name_index() -> Dict[str, List[dict]]:
    """Build index of all companies by normalized name"""
    name_index = {}
    
    async for doc in db.active_companies.find({}):
        name = normalize_name(doc.get("name") or "")
        if name:
            if name not in name_index:
                name_index[name] = []
            name_index[name].append({"source": "active_companies", "doc": doc})
    
    async for doc in db.hubspot_companies.find({}):
        name = normalize_name(doc.get("name") or "")
        if name:
            if name not in name_index:
                name_index[name] = []
            name_index[name].append({"source": "hubspot_companies", "doc": doc})
    
    async for doc in db.companies.find({}):
        name = normalize_name(doc.get("name") or "")
        if name:
            if name not in name_index:
                name_index[name] = []
            name_index[name].append({"source": "companies", "doc": doc})
    
    return name_index


def merge_company_data(docs: List[dict]) -> dict:
    """Merge multiple company documents into one unified document"""
    
    # Start with empty unified document
    unified = {
        "id": str(uuid.uuid4()),
        "classification": "inbound",  # Reset to inbound
        "searches": [],
        "aliases": [],
        "domains": [],
        "is_merged": False,
        "merged_into_company_id": None,
        "_legacy_ids": {},
        "_legacy_sources": [],
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    
    # Track which sources contributed
    sources = set()
    all_names = set()
    all_domains = set()
    all_aliases = set()
    all_searches = []
    
    # Priority: active_companies > hubspot_companies > companies
    priority_order = ["active_companies", "hubspot_companies", "companies"]
    sorted_docs = sorted(docs, key=lambda x: priority_order.index(x["source"]) if x["source"] in priority_order else 99)
    
    for item in sorted_docs:
        source = item["source"]
        doc = item["doc"]
        sources.add(source)
        
        # Store legacy ID
        doc_id = doc.get("id") or doc.get("hubspot_id") or str(doc.get("hs_object_id", ""))
        if doc_id:
            unified["_legacy_ids"][source] = doc_id
        
        # Name - take first non-empty
        if not unified.get("name") and doc.get("name"):
            unified["name"] = doc["name"]
        if doc.get("name"):
            all_names.add(doc["name"])
        
        # Domain - take first non-empty
        if not unified.get("domain") and doc.get("domain"):
            unified["domain"] = doc["domain"]
        if doc.get("domain"):
            all_domains.add(normalize_domain(doc["domain"]) or "")
        
        # Domains array
        for d in (doc.get("domains") or []):
            if d:
                all_domains.add(normalize_domain(d) or "")
        
        # Aliases
        for a in (doc.get("aliases") or []):
            if a:
                all_aliases.add(a)
        
        # Searches (only from active_companies)
        if source == "active_companies":
            all_searches.extend(doc.get("searches") or [])
        
        # HubSpot IDs
        if doc.get("hubspot_id"):
            unified["hubspot_id"] = doc["hubspot_id"]
        if doc.get("hs_object_id"):
            unified["hs_object_id"] = str(doc["hs_object_id"])
        
        # Merge status
        if doc.get("is_merged"):
            unified["is_merged"] = True
        if doc.get("merged_into_company_id"):
            unified["_legacy_merged_into"] = doc["merged_into_company_id"]
        
        # Historical metadata (rename for outbound semantic)
        if doc.get("active_since"):
            unified["outbound_since"] = doc["active_since"]
        if doc.get("activated_by"):
            unified["outbound_source"] = doc["activated_by"]
        if doc.get("activated_case_id"):
            unified["outbound_case_id"] = doc["activated_case_id"]
        
        # Industry
        if not unified.get("industry") and doc.get("industry"):
            unified["industry"] = doc["industry"]
        if not unified.get("industries") and doc.get("industries"):
            unified["industries"] = doc["industries"]
        
        # Other fields - take first non-empty
        for field in ["description", "website", "phone", "address", "city", "country", 
                      "employee_count", "annual_revenue", "linkedin_url", "facebook_url",
                      "twitter_url", "logo_url"]:
            if not unified.get(field) and doc.get(field):
                unified[field] = doc[field]
        
        # Timestamps - take oldest created_at
        if doc.get("created_at"):
            if not unified.get("original_created_at") or doc["created_at"] < unified.get("original_created_at"):
                unified["original_created_at"] = doc["created_at"]
    
    # Add alternative names as aliases
    for name in all_names:
        if name and name != unified.get("name"):
            all_aliases.add(name)
    
    # Finalize
    unified["aliases"] = list(all_aliases)
    unified["domains"] = [d for d in all_domains if d]
    unified["searches"] = all_searches
    unified["_legacy_sources"] = list(sources)
    unified["normalized_name"] = normalize_name(unified.get("name") or "")
    
    return unified


async def migrate_companies():
    """Main migration function"""
    
    print("\n" + "=" * 60)
    print("FASE 1.2-1.3: MIGRACIÓN DE EMPRESAS")
    print("=" * 60)
    
    # Step 1: Create collection
    print("\nStep 1: Creating unified_companies collection...")
    created = await create_unified_collection()
    if not created:
        print("Skipping migration - collection already has data")
        return
    
    # Step 2: Build indexes for deduplication
    print("\nStep 2: Building domain and name indexes...")
    domain_index = await build_domain_index()
    name_index = await build_name_index()
    print(f"   Unique domains: {len(domain_index)}")
    print(f"   Unique names: {len(name_index)}")
    
    # Step 3: Process all companies
    print("\nStep 3: Processing and merging companies...")
    
    processed_ids = {
        "active_companies": set(),
        "hubspot_companies": set(),
        "companies": set()
    }
    
    id_mapping = {}  # old_id -> new_id
    unified_docs = []
    merge_candidates = []
    
    # First pass: Process by domain (strongest match)
    for domain, docs in domain_index.items():
        if len(docs) == 1:
            # Single company with this domain
            unified = merge_company_data(docs)
            unified_docs.append(unified)
            for item in docs:
                source = item["source"]
                doc_id = item["doc"].get("id") or item["doc"].get("hubspot_id") or str(item["doc"].get("hs_object_id", ""))
                if doc_id:
                    processed_ids[source].add(doc_id)
                    id_mapping[f"{source}:{doc_id}"] = unified["id"]
        else:
            # Multiple companies with same domain - merge
            unified = merge_company_data(docs)
            unified_docs.append(unified)
            merge_candidates.append({
                "domain": domain,
                "sources": [f"{d['source']}:{d['doc'].get('name')}" for d in docs],
                "unified_id": unified["id"]
            })
            for item in docs:
                source = item["source"]
                doc_id = item["doc"].get("id") or item["doc"].get("hubspot_id") or str(item["doc"].get("hs_object_id", ""))
                if doc_id:
                    processed_ids[source].add(doc_id)
                    id_mapping[f"{source}:{doc_id}"] = unified["id"]
    
    # Second pass: Process remaining by name
    for name, docs in name_index.items():
        # Filter out already processed
        remaining = []
        for item in docs:
            doc_id = item["doc"].get("id") or item["doc"].get("hubspot_id") or str(item["doc"].get("hs_object_id", ""))
            if doc_id and doc_id not in processed_ids[item["source"]]:
                remaining.append(item)
        
        if not remaining:
            continue
        
        if len(remaining) == 1:
            unified = merge_company_data(remaining)
            unified_docs.append(unified)
            for item in remaining:
                source = item["source"]
                doc_id = item["doc"].get("id") or item["doc"].get("hubspot_id") or str(item["doc"].get("hs_object_id", ""))
                if doc_id:
                    processed_ids[source].add(doc_id)
                    id_mapping[f"{source}:{doc_id}"] = unified["id"]
        else:
            # Same name, different domains - merge
            unified = merge_company_data(remaining)
            unified_docs.append(unified)
            for item in remaining:
                source = item["source"]
                doc_id = item["doc"].get("id") or item["doc"].get("hubspot_id") or str(item["doc"].get("hs_object_id", ""))
                if doc_id:
                    processed_ids[source].add(doc_id)
                    id_mapping[f"{source}:{doc_id}"] = unified["id"]
    
    # Third pass: Process any remaining (no domain, unique name)
    async for doc in db.active_companies.find({}):
        doc_id = doc.get("id")
        if doc_id and doc_id not in processed_ids["active_companies"]:
            unified = merge_company_data([{"source": "active_companies", "doc": doc}])
            unified_docs.append(unified)
            processed_ids["active_companies"].add(doc_id)
            id_mapping[f"active_companies:{doc_id}"] = unified["id"]
    
    async for doc in db.hubspot_companies.find({}):
        doc_id = doc.get("id") or doc.get("hubspot_id") or str(doc.get("hs_object_id", ""))
        if doc_id and doc_id not in processed_ids["hubspot_companies"]:
            unified = merge_company_data([{"source": "hubspot_companies", "doc": doc}])
            unified_docs.append(unified)
            processed_ids["hubspot_companies"].add(doc_id)
            id_mapping[f"hubspot_companies:{doc_id}"] = unified["id"]
    
    async for doc in db.companies.find({}):
        doc_id = doc.get("id")
        if doc_id and doc_id not in processed_ids["companies"]:
            unified = merge_company_data([{"source": "companies", "doc": doc}])
            unified_docs.append(unified)
            processed_ids["companies"].add(doc_id)
            id_mapping[f"companies:{doc_id}"] = unified["id"]
    
    # Step 4: Insert all unified documents
    print(f"\nStep 4: Inserting {len(unified_docs)} unified companies...")
    
    if unified_docs:
        # Insert in batches
        batch_size = 500
        for i in range(0, len(unified_docs), batch_size):
            batch = unified_docs[i:i+batch_size]
            await db.unified_companies.insert_many(batch)
            print(f"   Inserted batch {i//batch_size + 1}: {len(batch)} documents")
    
    # Step 5: Save ID mapping
    print("\nStep 5: Saving ID mapping...")
    mapping_doc = {
        "id": "company_id_mapping",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "mapping": id_mapping
    }
    await db.migration_mappings.replace_one(
        {"id": "company_id_mapping"},
        mapping_doc,
        upsert=True
    )
    
    # Step 6: Update merged_into references
    print("\nStep 6: Updating merged_into references...")
    updated_refs = 0
    async for doc in db.unified_companies.find({"_legacy_merged_into": {"$exists": True}}):
        legacy_ref = doc["_legacy_merged_into"]
        # Try to find new ID
        new_ref = None
        for source in ["hubspot_companies", "active_companies", "companies"]:
            key = f"{source}:{legacy_ref}"
            if key in id_mapping:
                new_ref = id_mapping[key]
                break
        
        if new_ref:
            await db.unified_companies.update_one(
                {"id": doc["id"]},
                {"$set": {"merged_into_company_id": new_ref}, "$unset": {"_legacy_merged_into": ""}}
            )
            updated_refs += 1
    
    print(f"   Updated {updated_refs} merged_into references")
    
    # Step 7: Create audit log
    print("\nStep 7: Creating audit log...")
    await db.audit_logs.insert_one({
        "id": str(uuid.uuid4()),
        "type": "migration",
        "action": "unify_companies",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "performed_by": "system",
        "details": {
            "unified_count": len(unified_docs),
            "source_counts": {
                "active_companies": len(processed_ids["active_companies"]),
                "hubspot_companies": len(processed_ids["hubspot_companies"]),
                "companies": len(processed_ids["companies"])
            },
            "merges_by_domain": len([m for m in merge_candidates if m]),
        }
    })
    
    # Summary
    print("\n" + "=" * 60)
    print("RESUMEN DE MIGRACIÓN")
    print("=" * 60)
    print(f"Empresas unificadas creadas: {len(unified_docs)}")
    print(f"Procesadas de active_companies: {len(processed_ids['active_companies'])}")
    print(f"Procesadas de hubspot_companies: {len(processed_ids['hubspot_companies'])}")
    print(f"Procesadas de companies: {len(processed_ids['companies'])}")
    print(f"Merges por dominio/nombre: {len(merge_candidates)}")
    print(f"Referencias merged_into actualizadas: {updated_refs}")
    
    return {
        "unified_count": len(unified_docs),
        "processed": processed_ids,
        "mapping_count": len(id_mapping)
    }


async def verify_migration():
    """Verify migration integrity"""
    
    print("\n" + "=" * 60)
    print("FASE 1.4: VERIFICACIÓN DE INTEGRIDAD")
    print("=" * 60)
    
    # Check counts
    unified_count = await db.unified_companies.count_documents({})
    print(f"\n1. Unified companies: {unified_count}")
    
    # Check all have required fields
    missing_classification = await db.unified_companies.count_documents({"classification": {"$exists": False}})
    missing_id = await db.unified_companies.count_documents({"id": {"$exists": False}})
    missing_name = await db.unified_companies.count_documents({"name": {"$exists": False}})
    
    print(f"2. Missing classification: {missing_classification}")
    print(f"3. Missing id: {missing_id}")
    print(f"4. Missing name: {missing_name}")
    
    # Check searches preserved
    pipeline = [{"$project": {"search_count": {"$size": {"$ifNull": ["$searches", []]}}}}]
    total_searches = sum([doc["search_count"] async for doc in db.unified_companies.aggregate(pipeline)])
    print(f"5. Total searches preserved: {total_searches}")
    
    # Check aliases
    pipeline = [{"$project": {"alias_count": {"$size": {"$ifNull": ["$aliases", []]}}}}]
    total_aliases = sum([doc["alias_count"] async for doc in db.unified_companies.aggregate(pipeline)])
    print(f"6. Total aliases: {total_aliases}")
    
    # Check merged status preserved
    merged_count = await db.unified_companies.count_documents({"is_merged": True})
    print(f"7. Merged companies: {merged_count}")
    
    # Check legacy sources
    from_active = await db.unified_companies.count_documents({"_legacy_sources": "active_companies"})
    from_hubspot = await db.unified_companies.count_documents({"_legacy_sources": "hubspot_companies"})
    from_companies = await db.unified_companies.count_documents({"_legacy_sources": "companies"})
    
    print(f"8. From active_companies: {from_active}")
    print(f"9. From hubspot_companies: {from_hubspot}")
    print(f"10. From companies: {from_companies}")
    
    # Check classification (all should be inbound after reset)
    inbound_count = await db.unified_companies.count_documents({"classification": "inbound"})
    outbound_count = await db.unified_companies.count_documents({"classification": "outbound"})
    
    print(f"11. Classification inbound: {inbound_count}")
    print(f"12. Classification outbound: {outbound_count}")
    
    # Validation result
    all_ok = (
        missing_classification == 0 and
        missing_id == 0 and
        missing_name == 0 and
        inbound_count == unified_count
    )
    
    print("\n" + "=" * 60)
    if all_ok:
        print("✅ MIGRACIÓN VERIFICADA EXITOSAMENTE")
    else:
        print("❌ HAY PROBLEMAS EN LA MIGRACIÓN")
    print("=" * 60)
    
    return all_ok


if __name__ == "__main__":
    async def main():
        await migrate_companies()
        await verify_migration()
    
    asyncio.run(main())
