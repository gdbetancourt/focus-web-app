"""
Script para asociar contactos con empresas basándose en el dominio del email.
"""
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os
from datetime import datetime, timezone

async def associate_contacts_to_companies():
    client = AsyncIOMotorClient(os.environ.get('MONGO_URL'))
    db = client[os.environ.get('DB_NAME', 'leaderlix')]
    
    print(f"[{datetime.now()}] Iniciando asociación de contactos con empresas...")
    
    # Step 1: Build a domain -> company mapping
    print("[1/3] Construyendo mapa de dominios -> empresas...")
    domain_to_company = {}
    
    companies_cursor = db.unified_companies.find(
        {'domains': {'$exists': True, '$ne': [], '$ne': None}},
        {'_id': 1, 'id': 1, 'name': 1, 'domains': 1, 'classification': 1}
    )
    
    async for company in companies_cursor:
        # Use 'id' field (hubspot/actual ID), not MongoDB '_id'
        company_id = company.get('id') or str(company['_id'])
        company_name = company.get('name', '')
        classification = company.get('classification', 'inbound')
        
        for domain in company.get('domains', []):
            if domain:
                domain_lower = domain.lower().strip()
                if domain_lower not in domain_to_company:
                    domain_to_company[domain_lower] = {
                        'company_id': company_id,
                        'company_name': company_name,
                        'classification': classification
                    }
    
    print(f"   Mapa construido con {len(domain_to_company)} dominios únicos")
    
    # Step 2: Find all contacts with email and update them
    print("[2/3] Procesando contactos...")
    
    total_contacts = await db.unified_contacts.count_documents({'email': {'$exists': True, '$ne': None, '$ne': ''}})
    print(f"   Total contactos con email: {total_contacts:,}")
    
    updated_count = 0
    not_matched_count = 0
    batch_size = 1000
    processed = 0
    
    # Process in batches for efficiency
    contacts_cursor = db.unified_contacts.find(
        {'email': {'$exists': True, '$ne': None, '$ne': ''}},
        {'_id': 1, 'email': 1}
    ).batch_size(batch_size)
    
    bulk_operations = []
    
    async for contact in contacts_cursor:
        processed += 1
        email = contact.get('email', '')
        
        if '@' in email:
            domain = email.split('@')[1].lower().strip()
            
            if domain in domain_to_company:
                company_info = domain_to_company[domain]
                bulk_operations.append({
                    'filter': {'_id': contact['_id']},
                    'update': {
                        '$set': {
                            'company_id': company_info['company_id'],
                            'companies': [{
                                'company_id': company_info['company_id'],
                                'company_name': company_info['company_name']
                            }],
                            'classification': company_info['classification'],
                            'updated_at': datetime.now(timezone.utc)
                        }
                    }
                })
                updated_count += 1
            else:
                not_matched_count += 1
        
        # Execute bulk update every batch_size operations
        if len(bulk_operations) >= batch_size:
            if bulk_operations:
                from pymongo import UpdateOne
                ops = [UpdateOne(op['filter'], op['update']) for op in bulk_operations]
                await db.unified_contacts.bulk_write(ops, ordered=False)
            bulk_operations = []
            print(f"   Procesados: {processed:,} | Actualizados: {updated_count:,} | Sin match: {not_matched_count:,}")
    
    # Execute remaining operations
    if bulk_operations:
        from pymongo import UpdateOne
        ops = [UpdateOne(op['filter'], op['update']) for op in bulk_operations]
        await db.unified_contacts.bulk_write(ops, ordered=False)
    
    print(f"\n[3/3] Completado!")
    print(f"   Total procesados: {processed:,}")
    print(f"   Contactos actualizados: {updated_count:,}")
    print(f"   Contactos sin match de dominio: {not_matched_count:,}")
    
    # Verify with Bayer example
    print("\n--- Verificación con @bayer.com ---")
    bayer_contacts = await db.unified_contacts.find(
        {'email': {'$regex': '@bayer\\.com$', '$options': 'i'}}
    ).limit(3).to_list(3)
    
    for c in bayer_contacts:
        print(f"   Email: {c.get('email')}")
        print(f"   company_id: {c.get('company_id')}")
        print(f"   companies: {c.get('companies')}")
        print(f"   classification: {c.get('classification')}")
        print()
    
    client.close()
    print(f"[{datetime.now()}] Script finalizado.")

if __name__ == "__main__":
    asyncio.run(associate_contacts_to_companies())
