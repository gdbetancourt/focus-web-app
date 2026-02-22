"""
HubSpot Sync Admin Router
Provides preview, execution, and rollback for HubSpot → MongoDB synchronization
Preserves all local edits using namespacing strategy
"""
import asyncio
import uuid
import logging
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel

from database import db
from routers.auth import get_current_user
from utils.hubspot_helpers import get_hubspot_token, get_hubspot_headers

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/admin/hubspot-sync", tags=["admin-sync"])

# ============ MODELS ============

class SyncPreviewResult(BaseModel):
    total_in_hubspot: int
    would_insert: int
    would_update_snapshot_only: int
    would_update_base_fields: int
    conflicts: int
    samples: Dict[str, List[dict]]

class SyncExecutionResult(BaseModel):
    operation_id: str
    started_at: str
    completed_at: str
    inserted: int
    updated_snapshot: int
    updated_base: int
    conflicts_skipped: int
    errors: List[str]

# ============ CONSTANTS ============

# Fields that are UI-managed and should NEVER be overwritten by sync
UI_MANAGED_FIELDS = {
    'id',  # Internal UUID
    'classification',  # Inbound/Outbound
    'stage',  # Pipeline stage
    'tags',  # User tags
    'notes',  # User notes
    'companies',  # Company associations (array)
    'webinar_history',  # Event participation
    'buyer_persona_name',  # Internal classification
    'buyer_persona_display_name',
    'classified_area',
    'classified_sector',
    'classification_confidence',
    'company_industry',
    'source',  # Original source
    'source_details',
    'created_at',
    'updated_at',
    'qualification_status',
    '_overrides',  # Any manual overrides
}

# Fields that come from HubSpot and go into hubspot_snapshot
HUBSPOT_SNAPSHOT_FIELDS = [
    'firstname', 'lastname', 'email', 'phone', 'company', 
    'jobtitle', 'hs_persona', 'hs_object_id', 'createdate', 
    'lastmodifieddate', 'mobilephone', 'city', 'country'
]

# ============ HELPER FUNCTIONS ============

def normalize_email(email: str) -> Optional[str]:
    """Normalize email for matching"""
    if not email:
        return None
    return email.lower().strip()

def create_hubspot_snapshot(hs_contact: dict) -> dict:
    """Extract HubSpot fields into snapshot"""
    props = hs_contact.get('properties', {})
    snapshot = {
        'hubspot_id': hs_contact.get('id'),
        'synced_at': datetime.now(timezone.utc).isoformat()
    }
    for field in HUBSPOT_SNAPSHOT_FIELDS:
        if props.get(field):
            snapshot[field] = props[field]
    return snapshot

def contact_was_edited(local_contact: dict) -> bool:
    """Check if contact has local edits that should be preserved"""
    # Check for classification fields
    if local_contact.get('buyer_persona_name'):
        return True
    if local_contact.get('classified_area'):
        return True
    if local_contact.get('tags') and len(local_contact['tags']) > 0:
        return True
    if local_contact.get('notes'):
        return True
    if local_contact.get('webinar_history') and len(local_contact['webinar_history']) > 0:
        return True
    # Check if updated_at is significantly different from created_at
    created = local_contact.get('created_at', '')
    updated = local_contact.get('updated_at', '')
    if created and updated and created != updated:
        return True
    return False

# ============ CONTACTS SYNC ============

@router.get("/contacts/preview", response_model=SyncPreviewResult)
async def preview_contacts_sync(
    limit: int = Query(default=1000, description="Max contacts to fetch from HubSpot"),
    current_user: dict = Depends(get_current_user)
):
    """
    Preview what would happen if we sync contacts from HubSpot.
    Does NOT modify any data.
    """
    import httpx
    
    headers = await get_hubspot_headers()
    
    # Fetch contacts from HubSpot
    hs_contacts = []
    after = None
    
    async with httpx.AsyncClient(timeout=60.0) as client:
        while len(hs_contacts) < limit:
            url = "https://api.hubapi.com/crm/v3/objects/contacts?limit=100"
            url += "&properties=firstname,lastname,email,phone,company,jobtitle,hs_persona"
            if after:
                url += f"&after={after}"
            
            resp = await client.get(url, headers=headers)
            if resp.status_code != 200:
                raise HTTPException(status_code=500, detail=f"HubSpot API error: {resp.status_code}")
            
            data = resp.json()
            hs_contacts.extend(data.get('results', []))
            
            paging = data.get('paging', {})
            if 'next' in paging:
                after = paging['next'].get('after')
            else:
                break
    
    # Analyze what would happen
    would_insert = []
    would_update_snapshot = []
    would_update_base = []
    conflicts = []
    
    # Build email index of local contacts
    local_by_email = {}
    local_by_hubspot_id = {}
    
    async for contact in db.unified_contacts.find({}, {'_id': 0}):
        email = normalize_email(contact.get('email'))
        if email:
            local_by_email[email] = contact
        hs_id = contact.get('hubspot_contact_id')
        if hs_id:
            local_by_hubspot_id[str(hs_id)] = contact
    
    # Note: hubspot_contacts cache is deprecated - all edits are now in unified_contacts
    # This sync is primarily for reference/audit purposes
    hubspot_cache_edits = {}
    
    for hs in hs_contacts:
        hs_id = str(hs.get('id', ''))
        hs_email = normalize_email(hs.get('properties', {}).get('email'))
        
        # Try to find local match
        local = None
        match_type = None
        
        # Priority 1: Match by hubspot_contact_id
        if hs_id in local_by_hubspot_id:
            local = local_by_hubspot_id[hs_id]
            match_type = 'hubspot_id'
        # Priority 2: Match by email
        elif hs_email and hs_email in local_by_email:
            local = local_by_email[hs_email]
            match_type = 'email'
        
        # Check for edits in hubspot_contacts cache
        cache_edits = hubspot_cache_edits.get(hs_id, {})
        
        if not local:
            # New contact - would insert
            would_insert.append({
                'hubspot_id': hs_id,
                'email': hs_email,
                'name': f"{hs.get('properties', {}).get('firstname', '')} {hs.get('properties', {}).get('lastname', '')}".strip(),
                'has_cache_edits': bool(cache_edits)
            })
        else:
            # Existing contact - check what would update
            has_local_edits = contact_was_edited(local)
            
            if has_local_edits or cache_edits:
                # Only update hubspot_snapshot, preserve all local data
                would_update_snapshot.append({
                    'local_id': local.get('id'),
                    'hubspot_id': hs_id,
                    'email': hs_email,
                    'match_type': match_type,
                    'local_edits_preserved': list(UI_MANAGED_FIELDS & set(local.keys()))
                })
            else:
                # Can update base fields too (no local edits)
                would_update_base.append({
                    'local_id': local.get('id'),
                    'hubspot_id': hs_id,
                    'email': hs_email,
                    'match_type': match_type
                })
        
        # Check for conflicts
        if hs_email and hs_email in local_by_email:
            local_hs_id = local_by_email[hs_email].get('hubspot_contact_id')
            if local_hs_id and str(local_hs_id) != hs_id:
                conflicts.append({
                    'type': 'hubspot_id_mismatch',
                    'email': hs_email,
                    'local_hubspot_id': local_hs_id,
                    'incoming_hubspot_id': hs_id
                })
    
    return SyncPreviewResult(
        total_in_hubspot=len(hs_contacts),
        would_insert=len(would_insert),
        would_update_snapshot_only=len(would_update_snapshot),
        would_update_base_fields=len(would_update_base),
        conflicts=len(conflicts),
        samples={
            'would_insert': would_insert[:20],
            'would_update_snapshot': would_update_snapshot[:20],
            'would_update_base': would_update_base[:20],
            'conflicts': conflicts[:20]
        }
    )


@router.post("/contacts/run")
async def run_contacts_sync(
    dry_run: bool = Query(default=True, description="If true, only simulate"),
    batch_size: int = Query(default=100, description="Batch size for processing"),
    limit: int = Query(default=10000, description="Max contacts to sync"),
    current_user: dict = Depends(get_current_user)
):
    """
    Execute contacts sync from HubSpot to MongoDB.
    Creates audit trail and preserves all local edits.
    """
    import httpx
    
    operation_id = str(uuid.uuid4())
    started_at = datetime.now(timezone.utc).isoformat()
    
    # Create audit record
    audit_record = {
        'operation_id': operation_id,
        'type': 'hubspot_contacts_sync',
        'started_at': started_at,
        'started_by': current_user.get('email'),
        'dry_run': dry_run,
        'status': 'running',
        'stats': {
            'inserted': 0,
            'updated_snapshot': 0,
            'updated_base': 0,
            'conflicts_skipped': 0,
            'errors': []
        },
        'snapshots': []  # For rollback
    }
    
    if not dry_run:
        await db.migration_audit.insert_one(audit_record)
    
    headers = await get_hubspot_headers()
    
    # Build local indexes
    local_by_email = {}
    local_by_hubspot_id = {}
    
    async for contact in db.unified_contacts.find({}, {'_id': 0}):
        email = normalize_email(contact.get('email'))
        if email:
            local_by_email[email] = contact
        hs_id = contact.get('hubspot_contact_id')
        if hs_id:
            local_by_hubspot_id[str(hs_id)] = contact
    
    # Note: hubspot_contacts cache is deprecated - all edits are now in unified_contacts
    # This sync is primarily for reference/audit purposes
    hubspot_cache_edits = {}
    
    # Fetch and process HubSpot contacts
    processed = 0
    after = None
    stats = audit_record['stats']
    
    async with httpx.AsyncClient(timeout=60.0) as client:
        while processed < limit:
            url = f"https://api.hubapi.com/crm/v3/objects/contacts?limit={batch_size}"
            url += "&properties=firstname,lastname,email,phone,company,jobtitle,hs_persona,mobilephone,city,country"
            if after:
                url += f"&after={after}"
            
            resp = await client.get(url, headers=headers)
            if resp.status_code != 200:
                stats['errors'].append(f"HubSpot API error at offset {processed}: {resp.status_code}")
                break
            
            data = resp.json()
            hs_contacts = data.get('results', [])
            
            for hs in hs_contacts:
                hs_id = str(hs.get('id', ''))
                props = hs.get('properties', {})
                hs_email = normalize_email(props.get('email'))
                
                # Skip contacts without valid email (avoids duplicate key errors)
                if not hs_email:
                    stats['errors'].append(f"Skipped hubspot_id {hs_id}: no email")
                    continue
                
                # Find local match
                local = None
                if hs_id in local_by_hubspot_id:
                    local = local_by_hubspot_id[hs_id]
                elif hs_email and hs_email in local_by_email:
                    local = local_by_email[hs_email]
                
                # Get cache edits
                cache_edits = hubspot_cache_edits.get(hs_id, {})
                
                if not local:
                    # INSERT new contact
                    new_contact = {
                        'id': str(uuid.uuid4()),
                        'hubspot_contact_id': hs_id,
                        'hubspot_snapshot': create_hubspot_snapshot(hs),
                        'name': f"{props.get('firstname', '')} {props.get('lastname', '')}".strip(),
                        'first_name': props.get('firstname'),
                        'last_name': props.get('lastname'),
                        'email': props.get('email'),
                        'phone': props.get('phone') or props.get('mobilephone'),
                        'company': props.get('company'),
                        'job_title': props.get('jobtitle'),
                        'classification': 'inbound',
                        'stage': 1,
                        'companies': [{'company_name': props.get('company')}] if props.get('company') else [],
                        'source': 'hubspot',
                        'created_at': datetime.now(timezone.utc).isoformat(),
                        'updated_at': datetime.now(timezone.utc).isoformat()
                    }
                    
                    # Apply cached edits if any
                    for field in ['buyer_persona_name', 'buyer_persona_display_name', 'classified_area', 
                                  'classified_sector', 'classification_confidence', 'company_industry']:
                        if cache_edits.get(field):
                            new_contact[field] = cache_edits[field]
                    
                    if not dry_run:
                        try:
                            await db.unified_contacts.insert_one(new_contact)
                            # Save snapshot for rollback
                            audit_record['snapshots'].append({
                                'action': 'insert',
                                'contact_id': new_contact['id'],
                                'hubspot_id': hs_id
                            })
                            stats['inserted'] += 1
                            local_by_email[hs_email] = new_contact  # Update index
                        except Exception as e:
                            stats['errors'].append(f"Insert error for {hs_id}: {str(e)[:100]}")
                    else:
                        stats['inserted'] += 1
                    
                else:
                    # UPDATE existing contact
                    has_local_edits = contact_was_edited(local) or bool(cache_edits)
                    
                    # Always update hubspot_snapshot
                    update_doc = {
                        'hubspot_contact_id': hs_id,
                        'hubspot_snapshot': create_hubspot_snapshot(hs),
                        'updated_at': datetime.now(timezone.utc).isoformat()
                    }
                    
                    if not has_local_edits:
                        # Can update base fields too
                        if not local.get('name') or local.get('source') == 'hubspot':
                            update_doc['name'] = f"{props.get('firstname', '')} {props.get('lastname', '')}".strip()
                            update_doc['first_name'] = props.get('firstname')
                            update_doc['last_name'] = props.get('lastname')
                        if not local.get('email'):
                            update_doc['email'] = props.get('email')
                        if not local.get('phone'):
                            update_doc['phone'] = props.get('phone') or props.get('mobilephone')
                        if not local.get('company'):
                            update_doc['company'] = props.get('company')
                        if not local.get('job_title'):
                            update_doc['job_title'] = props.get('jobtitle')
                        
                        stats['updated_base'] += 1
                    else:
                        stats['updated_snapshot'] += 1
                    
                    if not dry_run:
                        # Save pre-update snapshot for rollback
                        audit_record['snapshots'].append({
                            'action': 'update',
                            'contact_id': local.get('id'),
                            'hubspot_id': hs_id,
                            'before': {k: local.get(k) for k in update_doc.keys() if k in local}
                        })
                        
                        await db.unified_contacts.update_one(
                            {'id': local.get('id')},
                            {'$set': update_doc}
                        )
                
                processed += 1
            
            paging = data.get('paging', {})
            if 'next' in paging:
                after = paging['next'].get('after')
            else:
                break
    
    completed_at = datetime.now(timezone.utc).isoformat()
    
    # Update audit record with snapshots for rollback capability
    if not dry_run:
        await db.migration_audit.update_one(
            {'operation_id': operation_id},
            {'$set': {
                'completed_at': completed_at,
                'status': 'completed',
                'stats': stats,
                'snapshots': audit_record['snapshots']  # Critical: save snapshots for rollback
            }}
        )
    
    return {
        'operation_id': operation_id,
        'dry_run': dry_run,
        'started_at': started_at,
        'completed_at': completed_at,
        'stats': stats
    }


@router.post("/contacts/rollback/{operation_id}")
async def rollback_contacts_sync(
    operation_id: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Rollback a previous sync operation using saved snapshots.
    """
    # Find audit record
    audit = await db.migration_audit.find_one({'operation_id': operation_id})
    if not audit:
        raise HTTPException(status_code=404, detail="Operation not found")
    
    if audit.get('status') == 'rolled_back':
        raise HTTPException(status_code=400, detail="Operation already rolled back")
    
    snapshots = audit.get('snapshots', [])
    rolled_back = 0
    errors = []
    
    for snap in reversed(snapshots):  # Process in reverse order
        try:
            if snap['action'] == 'insert':
                # Delete inserted contact
                await db.unified_contacts.delete_one({'id': snap['contact_id']})
                rolled_back += 1
            elif snap['action'] == 'update':
                # Restore previous values
                if snap.get('before'):
                    await db.unified_contacts.update_one(
                        {'id': snap['contact_id']},
                        {'$set': snap['before']}
                    )
                    rolled_back += 1
        except Exception as e:
            errors.append(f"Error rolling back {snap['contact_id']}: {str(e)}")
    
    # Mark as rolled back
    await db.migration_audit.update_one(
        {'operation_id': operation_id},
        {'$set': {
            'status': 'rolled_back',
            'rolled_back_at': datetime.now(timezone.utc).isoformat(),
            'rolled_back_by': current_user.get('email'),
            'rollback_stats': {
                'rolled_back': rolled_back,
                'errors': errors
            }
        }}
    )
    
    return {
        'operation_id': operation_id,
        'rolled_back': rolled_back,
        'errors': errors
    }


# ============ CASES (DEALS) SYNC ============

@router.get("/cases/preview")
async def preview_cases_sync(
    limit: int = Query(default=500, description="Max deals to fetch"),
    current_user: dict = Depends(get_current_user)
):
    """
    Preview what would happen if we sync deals from HubSpot.
    """
    import httpx
    
    headers = await get_hubspot_headers()
    
    # Fetch deals from HubSpot
    hs_deals = []
    after = None
    
    async with httpx.AsyncClient(timeout=60.0) as client:
        while len(hs_deals) < limit:
            url = "https://api.hubapi.com/crm/v3/objects/deals?limit=100"
            url += "&properties=dealname,amount,closedate,dealstage,pipeline,hs_object_id"
            if after:
                url += f"&after={after}"
            
            resp = await client.get(url, headers=headers)
            if resp.status_code != 200:
                raise HTTPException(status_code=500, detail=f"HubSpot API error: {resp.status_code}")
            
            data = resp.json()
            hs_deals.extend(data.get('results', []))
            
            paging = data.get('paging', {})
            if 'next' in paging:
                after = paging['next'].get('after')
            else:
                break
    
    # Build local index
    local_by_hubspot_id = {}
    local_by_name = {}
    
    async for case in db.cases.find({}, {'_id': 0}):
        hs_id = case.get('hubspot_deal_id')
        if hs_id:
            local_by_hubspot_id[str(hs_id)] = case
        name = case.get('name', '').lower().strip()
        if name:
            local_by_name[name] = case
    
    # Analyze
    would_insert = []
    would_update = []
    conflicts = []
    
    for deal in hs_deals:
        deal_id = str(deal.get('id', ''))
        props = deal.get('properties', {})
        dealname = props.get('dealname', '')
        
        # Find local match
        local = local_by_hubspot_id.get(deal_id)
        if not local and dealname:
            local = local_by_name.get(dealname.lower().strip())
        
        if not local:
            would_insert.append({
                'hubspot_deal_id': deal_id,
                'dealname': dealname,
                'amount': props.get('amount'),
                'closedate': props.get('closedate'),
                'dealstage': props.get('dealstage')
            })
        else:
            would_update.append({
                'local_id': local.get('id'),
                'hubspot_deal_id': deal_id,
                'dealname': dealname,
                'local_has_contacts': bool(local.get('contact_ids')),
                'local_has_checklists': await db.case_checklists.count_documents({'case_id': local.get('id')}) > 0
            })
    
    return {
        'total_in_hubspot': len(hs_deals),
        'would_insert': len(would_insert),
        'would_update': len(would_update),
        'conflicts': len(conflicts),
        'samples': {
            'would_insert': would_insert[:20],
            'would_update': would_update[:20],
            'conflicts': conflicts[:20]
        }
    }


@router.post("/cases/run")
async def run_cases_sync(
    dry_run: bool = Query(default=True),
    limit: int = Query(default=500),
    current_user: dict = Depends(get_current_user)
):
    """
    Execute deals sync from HubSpot to cases collection.
    Preserves all local data (contacts, checklists, notes).
    """
    import httpx
    
    operation_id = str(uuid.uuid4())
    started_at = datetime.now(timezone.utc).isoformat()
    
    audit_record = {
        'operation_id': operation_id,
        'type': 'hubspot_cases_sync',
        'started_at': started_at,
        'started_by': current_user.get('email'),
        'dry_run': dry_run,
        'status': 'running',
        'stats': {'inserted': 0, 'updated': 0, 'errors': []},
        'snapshots': []
    }
    
    if not dry_run:
        await db.migration_audit.insert_one(audit_record)
    
    headers = await get_hubspot_headers()
    
    # Build local indexes
    local_by_hubspot_id = {}
    local_by_name = {}
    
    async for case in db.cases.find({}, {'_id': 0}):
        hs_id = case.get('hubspot_deal_id')
        if hs_id:
            local_by_hubspot_id[str(hs_id)] = case
        name = case.get('name', '').lower().strip()
        if name:
            local_by_name[name] = case
    
    processed = 0
    after = None
    stats = audit_record['stats']
    
    async with httpx.AsyncClient(timeout=60.0) as client:
        while processed < limit:
            url = "https://api.hubapi.com/crm/v3/objects/deals?limit=100"
            url += "&properties=dealname,amount,closedate,dealstage,pipeline,hs_object_id,hubspot_owner_id"
            if after:
                url += f"&after={after}"
            
            resp = await client.get(url, headers=headers)
            if resp.status_code != 200:
                stats['errors'].append(f"HubSpot API error: {resp.status_code}")
                break
            
            data = resp.json()
            deals = data.get('results', [])
            
            for deal in deals:
                deal_id = str(deal.get('id', ''))
                props = deal.get('properties', {})
                dealname = props.get('dealname', '')
                
                # Find local match
                local = local_by_hubspot_id.get(deal_id)
                if not local and dealname:
                    local = local_by_name.get(dealname.lower().strip())
                
                if not local:
                    # INSERT new case
                    new_case = {
                        'id': str(uuid.uuid4()),
                        'hubspot_deal_id': deal_id,
                        'hubspot_snapshot': {
                            'dealname': dealname,
                            'amount': props.get('amount'),
                            'closedate': props.get('closedate'),
                            'dealstage': props.get('dealstage'),
                            'pipeline': props.get('pipeline'),
                            'synced_at': datetime.now(timezone.utc).isoformat()
                        },
                        'name': dealname,
                        'company_name': '',  # Will need association lookup
                        'company_names': [],
                        'stage': 3,  # Default to Stage 3
                        'status': 'active',
                        'contact_ids': [],
                        'created_at': datetime.now(timezone.utc).isoformat(),
                        'updated_at': datetime.now(timezone.utc).isoformat()
                    }
                    
                    if not dry_run:
                        await db.cases.insert_one(new_case)
                        audit_record['snapshots'].append({
                            'action': 'insert',
                            'case_id': new_case['id'],
                            'hubspot_deal_id': deal_id
                        })
                    
                    stats['inserted'] += 1
                    
                else:
                    # UPDATE - only hubspot_snapshot, preserve local data
                    update_doc = {
                        'hubspot_deal_id': deal_id,
                        'hubspot_snapshot': {
                            'dealname': dealname,
                            'amount': props.get('amount'),
                            'closedate': props.get('closedate'),
                            'dealstage': props.get('dealstage'),
                            'pipeline': props.get('pipeline'),
                            'synced_at': datetime.now(timezone.utc).isoformat()
                        },
                        'updated_at': datetime.now(timezone.utc).isoformat()
                    }
                    
                    if not dry_run:
                        audit_record['snapshots'].append({
                            'action': 'update',
                            'case_id': local.get('id'),
                            'hubspot_deal_id': deal_id,
                            'before': {
                                'hubspot_snapshot': local.get('hubspot_snapshot')
                            }
                        })
                        
                        await db.cases.update_one(
                            {'id': local.get('id')},
                            {'$set': update_doc}
                        )
                    
                    stats['updated'] += 1
                
                processed += 1
            
            paging = data.get('paging', {})
            if 'next' in paging:
                after = paging['next'].get('after')
            else:
                break
    
    completed_at = datetime.now(timezone.utc).isoformat()
    
    if not dry_run:
        await db.migration_audit.update_one(
            {'operation_id': operation_id},
            {'$set': {
                'completed_at': completed_at,
                'status': 'completed',
                'stats': stats,
                'snapshots': audit_record['snapshots']  # Critical: save snapshots for rollback
            }}
        )
    
    return {
        'operation_id': operation_id,
        'dry_run': dry_run,
        'started_at': started_at,
        'completed_at': completed_at,
        'stats': stats
    }


@router.post("/cases/rollback/{operation_id}")
async def rollback_cases_sync(
    operation_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Rollback a cases sync operation"""
    audit = await db.migration_audit.find_one({'operation_id': operation_id})
    if not audit:
        raise HTTPException(status_code=404, detail="Operation not found")
    
    if audit.get('status') == 'rolled_back':
        raise HTTPException(status_code=400, detail="Already rolled back")
    
    snapshots = audit.get('snapshots', [])
    rolled_back = 0
    errors = []
    
    for snap in reversed(snapshots):
        try:
            if snap['action'] == 'insert':
                await db.cases.delete_one({'id': snap['case_id']})
                rolled_back += 1
            elif snap['action'] == 'update' and snap.get('before'):
                await db.cases.update_one(
                    {'id': snap['case_id']},
                    {'$set': snap['before']}
                )
                rolled_back += 1
        except Exception as e:
            errors.append(str(e))
    
    await db.migration_audit.update_one(
        {'operation_id': operation_id},
        {'$set': {
            'status': 'rolled_back',
            'rolled_back_at': datetime.now(timezone.utc).isoformat(),
            'rolled_back_by': current_user.get('email')
        }}
    )
    
    return {'operation_id': operation_id, 'rolled_back': rolled_back, 'errors': errors}


# ============ VERIFICATION ============

@router.get("/verify/{operation_id}")
async def verify_sync_operation(
    operation_id: str,
    sample_size: int = Query(default=20),
    current_user: dict = Depends(get_current_user)
):
    """
    Verify a sync operation by checking that local edits were preserved.
    """
    audit = await db.migration_audit.find_one({'operation_id': operation_id})
    if not audit:
        raise HTTPException(status_code=404, detail="Operation not found")
    
    # Get current counts
    contacts_total = await db.unified_contacts.count_documents({})
    contacts_with_hs_id = await db.unified_contacts.count_documents({'hubspot_contact_id': {'$exists': True}})
    contacts_with_snapshot = await db.unified_contacts.count_documents({'hubspot_snapshot': {'$exists': True}})
    
    cases_total = await db.cases.count_documents({})
    cases_with_hs_id = await db.cases.count_documents({'hubspot_deal_id': {'$exists': True}})
    
    # Sample preserved edits
    preserved_samples = []
    async for contact in db.unified_contacts.find({
        'hubspot_contact_id': {'$exists': True},
        '$or': [
            {'buyer_persona_name': {'$exists': True, '$ne': None}},
            {'classified_area': {'$exists': True, '$ne': None}},
            {'tags': {'$exists': True, '$ne': []}}
        ]
    }, {'_id': 0}).limit(sample_size):
        preserved_samples.append({
            'id': contact.get('id'),
            'hubspot_id': contact.get('hubspot_contact_id'),
            'preserved_fields': {
                'buyer_persona_name': contact.get('buyer_persona_name'),
                'classified_area': contact.get('classified_area'),
                'tags': contact.get('tags'),
                'notes': bool(contact.get('notes'))
            }
        })
    
    return {
        'operation_id': operation_id,
        'operation_stats': audit.get('stats'),
        'current_counts': {
            'contacts_total': contacts_total,
            'contacts_with_hubspot_id': contacts_with_hs_id,
            'contacts_with_snapshot': contacts_with_snapshot,
            'contacts_hubspot_coverage': f"{(contacts_with_hs_id/contacts_total*100):.1f}%" if contacts_total else "0%",
            'cases_total': cases_total,
            'cases_with_hubspot_id': cases_with_hs_id
        },
        'preserved_edits_sample': preserved_samples
    }
