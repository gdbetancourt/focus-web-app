"""
Script to deduplicate contacts for an event
"""
from pymongo import MongoClient

env_vars = {}
with open('/app/backend/.env') as f:
    for line in f:
        line = line.strip()
        if line and not line.startswith('#') and '=' in line:
            key, value = line.split('=', 1)
            env_vars[key] = value.strip('"').strip("'")

client = MongoClient(env_vars['MONGO_URL'])
db = client[env_vars['DB_NAME']]

event_id = '65f7218c-455f-4850-9adf-2e13f317592f'

# Get all contacts for this event
contacts = list(db.unified_contacts.find(
    {'webinar_history.event_id': event_id},
    {'_id': 1, 'id': 1, 'email': 1, 'hubspot_id': 1, 'webinar_history': 1}
))

print(f"Total contactos antes: {len(contacts)}")

# Group by email
email_contacts = {}
for c in contacts:
    email = c.get('email', '').lower() if isinstance(c.get('email'), str) else ''
    if email:
        if email not in email_contacts:
            email_contacts[email] = []
        email_contacts[email].append(c)

# Find and merge duplicates
deleted = 0
merged = 0

for email, dups in email_contacts.items():
    if len(dups) <= 1:
        continue
    
    # Sort: prefer one with hubspot_id, then by most webinar_history
    dups.sort(key=lambda x: (
        1 if x.get('hubspot_id') else 0,
        len(x.get('webinar_history', []))
    ), reverse=True)
    
    # Keep the first one (best), delete the rest
    keeper = dups[0]
    to_delete = dups[1:]
    
    # Merge webinar_history from deleted into keeper
    keeper_history = keeper.get('webinar_history', [])
    keeper_event_ids = {h.get('event_id') for h in keeper_history}
    
    new_entries = []
    for dup in to_delete:
        for h in dup.get('webinar_history', []):
            if h.get('event_id') not in keeper_event_ids:
                new_entries.append(h)
                keeper_event_ids.add(h.get('event_id'))
    
    # Update keeper with merged history if needed
    if new_entries:
        db.unified_contacts.update_one(
            {'_id': keeper['_id']},
            {'$push': {'webinar_history': {'$each': new_entries}}}
        )
        merged += 1
    
    # Delete duplicates
    for dup in to_delete:
        db.unified_contacts.delete_one({'_id': dup['_id']})
        deleted += 1

print(f'Duplicados eliminados: {deleted}')
print(f'Registros con historial fusionado: {merged}')

# Final count
final = db.unified_contacts.count_documents({'webinar_history.event_id': event_id})
print(f'Total contactos ahora: {final}')
