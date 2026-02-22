"""
Complete HubSpot import for Storytelling en Pharma event
"""
import asyncio
import httpx
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime, timezone
import uuid

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


async def main():
    print("Importando contactos faltantes para Storytelling en Pharma...")
    
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
    
    event_id = 'a7890c88-26c7-4ad4-82a2-15ed4c2d31ba'
    event = await db.webinar_events_v2.find_one({'id': event_id})
    event_name = event.get('name', 'Event')
    
    # Get HubSpot list
    all_ids = []
    async with httpx.AsyncClient() as http:
        after = None
        while True:
            url = f'https://api.hubapi.com/crm/v3/lists/158/memberships?limit=500'
            if after:
                url += f'&after={after}'
            response = await http.get(url, headers={'Authorization': f'Bearer {HUBSPOT_TOKEN}'}, timeout=30)
            if response.status_code != 200:
                break
            data = response.json()
            all_ids.extend([r['recordId'] for r in data.get('results', [])])
            paging = data.get('paging', {})
            if 'next' in paging:
                after = paging['next'].get('after')
            else:
                break
    
    print(f'Lista HubSpot: {len(all_ids)} contactos')
    
    # Get existing
    existing = await db.unified_contacts.find({'webinar_history.event_id': event_id}, {'hubspot_id': 1, 'email': 1, '_id': 0}).to_list(None)
    existing_hs_ids = {c.get('hubspot_id') for c in existing if c.get('hubspot_id')}
    existing_emails = set()
    for c in existing:
        if isinstance(c.get('email'), str) and c.get('email'):
            existing_emails.add(c['email'].lower())
    
    missing_ids = [cid for cid in all_ids if cid not in existing_hs_ids]
    print(f'Faltantes: {len(missing_ids)}')
    
    if not missing_ids:
        print('Completo!')
        return
    
    created = 0
    updated = 0
    errors = 0
    now = datetime.now(timezone.utc).isoformat()
    webinar_entry = {'event_id': event_id, 'event_name': event_name, 'status': 'registered', 'registered_at': now, 'source': 'hubspot_import'}
    
    batch_size = 100
    async with httpx.AsyncClient() as http:
        for i in range(0, len(missing_ids), batch_size):
            batch = missing_ids[i:i+batch_size]
            response = await http.post('https://api.hubapi.com/crm/v3/objects/contacts/batch/read', headers={'Authorization': f'Bearer {HUBSPOT_TOKEN}', 'Content-Type': 'application/json'}, json={'properties': ['firstname', 'lastname', 'email', 'phone', 'company', 'jobtitle'], 'inputs': [{'id': str(cid)} for cid in batch]}, timeout=60)
            
            if response.status_code != 200:
                continue
            
            for c in response.json().get('results', []):
                props = c.get('properties', {})
                email = (props.get('email') or '').strip().lower()
                if not email:
                    continue
                
                # Check if exists by email
                if email in existing_emails:
                    existing_contact = await db.unified_contacts.find_one({'email': email})
                    if existing_contact:
                        history = existing_contact.get('webinar_history', [])
                        if not any(w.get('event_id') == event_id for w in history):
                            await db.unified_contacts.update_one({'email': email}, {'$set': {'webinar_history': history + [webinar_entry], 'hubspot_id': c.get('id')}})
                            updated += 1
                else:
                    # Create new - handle duplicate key
                    try:
                        firstname = (props.get('firstname') or '').strip()
                        lastname = (props.get('lastname') or '').strip()
                        
                        await db.unified_contacts.insert_one({
                            'id': str(uuid.uuid4()),
                            'hubspot_id': c.get('id'),
                            'name': f'{firstname} {lastname}'.strip() or 'Sin nombre',
                            'first_name': firstname,
                            'last_name': lastname,
                            'email': email,
                            'phone': (props.get('phone') or '').strip(),
                            'company': (props.get('company') or '').strip(),
                            'job_title': (props.get('jobtitle') or '').strip(),
                            'buyer_persona': 'mateo',
                            'stage': 2,
                            'status': 'active',
                            'source': 'hubspot',
                            'webinar_history': [webinar_entry],
                            'created_at': now,
                            'updated_at': now
                        })
                        created += 1
                        existing_emails.add(email)
                    except Exception as e:
                        if 'duplicate key' in str(e).lower():
                            # Contact exists, update instead
                            existing_contact = await db.unified_contacts.find_one({'email': email})
                            if existing_contact:
                                history = existing_contact.get('webinar_history', [])
                                if not any(w.get('event_id') == event_id for w in history):
                                    await db.unified_contacts.update_one({'email': email}, {'$set': {'webinar_history': history + [webinar_entry], 'hubspot_id': c.get('id')}})
                                    updated += 1
                        else:
                            errors += 1
            
            print(f'Batch {i//batch_size + 1}: {created} creados, {updated} actualizados, {errors} errores')
    
    final = await db.unified_contacts.count_documents({'webinar_history.event_id': event_id})
    
    # Update event
    await db.webinar_events_v2.update_one(
        {'id': event_id},
        {'$set': {
            'last_hubspot_import': {
                'list_id': '158',
                'result': {'created': created, 'updated': updated, 'total': final, 'errors': errors},
                'imported_at': now
            }
        }}
    )
    
    print(f'COMPLETO: {final} contactos')

asyncio.run(main())
