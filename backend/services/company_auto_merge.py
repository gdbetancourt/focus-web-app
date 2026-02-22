"""
Company Auto-Merge Service - Background task to automatically merge companies with duplicate domains

This service:
1. Finds companies that share the same normalized domain
2. Finds companies with similar names (fuzzy matching)
3. Groups them together
4. Automatically merges duplicates (keeping the oldest/most complete as primary)
5. Logs all operations for audit
"""
import re
import uuid
import logging
import asyncio
from datetime import datetime, timezone
from typing import List, Dict, Optional, Tuple
from collections import defaultdict

try:
    from rapidfuzz import fuzz, process
    FUZZY_AVAILABLE = True
except ImportError:
    FUZZY_AVAILABLE = False
    logger = logging.getLogger(__name__)
    logger.warning("rapidfuzz not installed, fuzzy matching disabled")

logger = logging.getLogger(__name__)


# Common suffixes to remove for name normalization
COMPANY_SUFFIXES = [
    # Country/Region
    'méxico', 'mexico', 'mx', 'latam', 'latinoamérica', 'latinoamerica',
    'spain', 'españa', 'hispania', 'usa', 'us', 'uk', 'global', 'international',
    'worldwide', 'americas', 'europe', 'asia',
    # Legal forms
    's.a.', 'sa', 's.a. de c.v.', 'sa de cv', 's de rl', 's. de r.l.',
    'sapi', 'sapi de cv', 's.a.p.i.', 's.a.b.', 'sab', 'sab de cv',
    'inc', 'inc.', 'incorporated', 'corp', 'corp.', 'corporation',
    'ltd', 'ltd.', 'limited', 'llc', 'l.l.c.', 'plc', 'gmbh', 'ag', 'nv', 'bv',
    'co', 'co.', 'company', 'cia', 'cia.', 'compañía',
    # Industry
    'pharmaceuticals', 'pharmaceutical', 'pharma', 'laboratories', 'laboratorios',
    'labs', 'healthcare', 'health', 'medical', 'medica', 'biotech', 'biotechnology',
    'sciences', 'science', 'therapeutics', 'oncology', 'diagnostics',
    # Generic
    'group', 'grupo', 'holding', 'holdings', 'division', 'solutions', 'services',
    'products', 'productos', 'industria', 'industries', 'comercial', 'commercial',
]

def normalize_company_name(name: str) -> str:
    """
    Normalize a company name for comparison:
    - Lowercase
    - Remove common suffixes (México, S.A., Inc, etc.)
    - Remove extra spaces and punctuation
    - Remove accents
    """
    if not name:
        return ""
    
    # Lowercase
    normalized = name.lower().strip()
    
    # Remove accents
    accent_map = {
        'á': 'a', 'é': 'e', 'í': 'i', 'ó': 'o', 'ú': 'u',
        'ä': 'a', 'ë': 'e', 'ï': 'i', 'ö': 'o', 'ü': 'u',
        'ñ': 'n', 'ç': 'c'
    }
    for accented, plain in accent_map.items():
        normalized = normalized.replace(accented, plain)
    
    # Remove punctuation except spaces
    normalized = re.sub(r'[^\w\s]', ' ', normalized)
    
    # Remove common suffixes (iterate multiple times to catch nested suffixes)
    for _ in range(3):
        for suffix in COMPANY_SUFFIXES:
            # Match suffix at end or followed by space
            pattern = r'\b' + re.escape(suffix) + r'\b'
            normalized = re.sub(pattern, '', normalized)
    
    # Normalize whitespace
    normalized = ' '.join(normalized.split())
    
    return normalized.strip()


async def find_similar_names(db, limit: int = 100, min_similarity: int = 80) -> List[Dict]:
    """
    Find companies with similar names that might be duplicates.
    Uses fuzzy matching to identify potential matches.
    
    Returns list of groups: [{
        "normalized_name": str,
        "companies": [company_docs],
        "similarity_score": int
    }]
    """
    if not FUZZY_AVAILABLE:
        return []
    
    # Get all active companies
    companies = await db.unified_companies.find(
        {"is_merged": {"$ne": True}, "name": {"$exists": True, "$ne": ""}},
        {"_id": 0, "id": 1, "hubspot_id": 1, "name": 1, "domain": 1, "domains": 1, "industry_code": 1}
    ).to_list(50000)
    
    # Build normalized name index
    name_to_companies = defaultdict(list)
    for c in companies:
        normalized = normalize_company_name(c.get('name', ''))
        if normalized and len(normalized) >= 3:
            c['_normalized_name'] = normalized
            c['_company_id'] = c.get('id') or c.get('hubspot_id')
            name_to_companies[normalized].append(c)
    
    # Find exact matches on normalized names first
    similar_groups = []
    processed_names = set()
    
    # First pass: exact normalized name matches
    for normalized_name, group_companies in name_to_companies.items():
        if len(group_companies) >= 2:
            similar_groups.append({
                "normalized_name": normalized_name,
                "match_type": "exact_normalized",
                "companies": group_companies,
                "similarity_score": 100
            })
            processed_names.add(normalized_name)
    
    # Second pass: fuzzy matching between different normalized names
    unique_names = [n for n in name_to_companies.keys() if n not in processed_names]
    
    # Group similar names using fuzzy matching
    fuzzy_groups = []
    used_names = set()
    
    for name in unique_names:
        if name in used_names:
            continue
        
        # Find similar names
        matches = process.extract(
            name, 
            [n for n in unique_names if n != name and n not in used_names],
            scorer=fuzz.ratio,
            limit=10
        )
        
        similar_names = [name]
        for match_name, score, _ in matches:
            if score >= min_similarity:
                similar_names.append(match_name)
                used_names.add(match_name)
        
        if len(similar_names) > 1:
            # Combine all companies from similar names
            group_companies = []
            for n in similar_names:
                group_companies.extend(name_to_companies[n])
            
            avg_score = sum(m[1] for m in matches[:len(similar_names)-1]) // max(len(similar_names)-1, 1)
            
            fuzzy_groups.append({
                "normalized_name": name,
                "match_type": "fuzzy",
                "similar_names": similar_names,
                "companies": group_companies,
                "similarity_score": avg_score
            })
        
        used_names.add(name)
    
    # Combine and sort by group size
    all_groups = similar_groups + fuzzy_groups
    all_groups.sort(key=lambda x: len(x['companies']), reverse=True)
    
    return all_groups[:limit]


def normalize_domain(domain: str) -> Optional[str]:
    """
    Normalize a domain for comparison:
    - Remove www. prefix
    - Convert to lowercase
    - Remove trailing slashes
    - Handle edge cases
    """
    if not domain:
        return None
    
    domain = domain.strip().lower()
    
    # Remove protocol if present
    domain = re.sub(r'^https?://', '', domain)
    
    # Remove www. prefix
    if domain.startswith('www.'):
        domain = domain[4:]
    
    # Remove trailing slash and path
    domain = domain.split('/')[0]
    
    # Remove port if present
    domain = domain.split(':')[0]
    
    # Skip if it looks like an email
    if '@' in domain:
        return None
    
    # Skip common email providers (not company domains)
    common_providers = {
        'gmail.com', 'hotmail.com', 'outlook.com', 'yahoo.com', 'live.com',
        'icloud.com', 'me.com', 'protonmail.com', 'mail.com', 'aol.com',
        'gmx.com', 'zoho.com', 'yandex.com', 'inbox.com', 'fastmail.com'
    }
    
    if domain in common_providers:
        return None
    
    return domain if domain else None


def score_company_completeness(company: dict) -> int:
    """
    Score a company based on data completeness.
    Higher score = more complete/better candidate for primary.
    """
    score = 0
    
    # Basic fields
    if company.get('name'):
        score += 10
    if company.get('domain'):
        score += 5
    if company.get('industry'):
        score += 5
    
    # Multiple values
    domains = company.get('domains') or []
    score += min(len(domains), 5) * 2  # Up to 10 points for domains
    
    industries = company.get('industries') or []
    score += min(len(industries), 3) * 3  # Up to 9 points for industries
    
    aliases = company.get('aliases') or []
    score += min(len(aliases), 5)  # Up to 5 points for aliases
    
    # Prefer HubSpot companies (they have real IDs)
    if company.get('hs_object_id') or (company.get('hubspot_id') and not str(company.get('hubspot_id', '')).startswith('auto_')):
        score += 20
    
    # Prefer active companies
    if company.get('is_active', True):
        score += 10
    
    # Prefer older companies (established)
    if company.get('created_at'):
        score += 5
    
    return score


def select_primary_company(companies: List[dict]) -> Tuple[dict, List[dict]]:
    """
    Select the best company to be the primary (merge target).
    Returns (primary_company, secondary_companies)
    """
    if not companies:
        return None, []
    
    if len(companies) == 1:
        return companies[0], []
    
    # Score each company
    scored = [(score_company_completeness(c), c) for c in companies]
    scored.sort(key=lambda x: x[0], reverse=True)
    
    primary = scored[0][1]
    secondaries = [c for _, c in scored[1:]]
    
    return primary, secondaries


async def find_duplicate_domains(db, limit: int = 100) -> Dict[str, List[dict]]:
    """
    Find companies that share the same normalized domain.
    Returns a dict of {normalized_domain: [companies]}
    """
    domain_groups = defaultdict(list)
    
    # Get all companies with domains from unified_companies (primary source)
    unified_companies = await db.unified_companies.find(
        {
            "is_merged": {"$ne": True},
            "$or": [
                {"domain": {"$exists": True, "$nin": ["", None]}},
                {"domains": {"$exists": True, "$ne": []}}
            ]
        },
        {"_id": 0}
    ).to_list(50000)
    
    # Mark source collection
    for c in unified_companies:
        c['_source_collection'] = 'unified_companies'
        c['_company_id'] = c.get('id') or c.get('hubspot_id') or str(c.get('hs_object_id', ''))
    
    all_companies = unified_companies
    
    # Group by normalized domain
    for company in all_companies:
        domains_to_check = []
        
        if company.get('domain'):
            domains_to_check.append(company['domain'])
        
        if company.get('domains'):
            domains_to_check.extend(company['domains'])
        
        for domain in domains_to_check:
            normalized = normalize_domain(domain)
            if normalized:
                domain_groups[normalized].append(company)
    
    # Filter to only groups with duplicates (2+ companies) and deduplicate by company ID
    duplicates = {}
    for domain, domain_companies in domain_groups.items():
        # Deduplicate companies by _company_id
        seen_ids = set()
        unique_companies = []
        for c in domain_companies:
            cid = c.get('_company_id')
            if cid and cid not in seen_ids:
                seen_ids.add(cid)
                unique_companies.append(c)
        
        if len(unique_companies) >= 2:
            duplicates[domain] = unique_companies
    
    # Sort by group size (larger groups first) and limit
    sorted_duplicates = dict(
        sorted(duplicates.items(), key=lambda x: len(x[1]), reverse=True)[:limit]
    )
    
    return sorted_duplicates


async def merge_company_into_primary(
    db,
    primary: dict,
    secondary: dict,
    dry_run: bool = False
) -> dict:
    """
    Merge a secondary company into the primary company.
    Returns merge result with statistics.
    """
    now = datetime.now(timezone.utc).isoformat()
    
    primary_id = primary['_company_id']
    secondary_id = secondary['_company_id']
    primary_name = primary.get('name', '')
    secondary_name = secondary.get('name', '')
    primary_collection = primary['_source_collection']
    secondary_collection = secondary['_source_collection']
    
    result = {
        'primary_id': primary_id,
        'primary_name': primary_name,
        'secondary_id': secondary_id,
        'secondary_name': secondary_name,
        'contacts_updated': 0,
        'cases_updated': 0,
        'dry_run': dry_run
    }
    
    if dry_run:
        return result
    
    # Prepare update for primary company
    update_data = {'updated_at': now}
    
    # 1. Add secondary name as alias
    current_aliases = list(primary.get('aliases') or [])
    if secondary_name and secondary_name.lower() not in [a.lower() for a in current_aliases]:
        current_aliases.append(secondary_name)
    # Also add secondary's aliases
    for alias in (secondary.get('aliases') or []):
        if alias and alias.lower() not in [a.lower() for a in current_aliases]:
            current_aliases.append(alias)
    update_data['aliases'] = current_aliases
    
    # 2. Merge domains
    primary_domains = set(primary.get('domains') or [])
    if primary.get('domain'):
        norm_domain = normalize_domain(primary['domain'])
        if norm_domain:
            primary_domains.add(norm_domain)
    
    secondary_domains = set(secondary.get('domains') or [])
    if secondary.get('domain'):
        norm_domain = normalize_domain(secondary['domain'])
        if norm_domain:
            secondary_domains.add(norm_domain)
    
    merged_domains = list(primary_domains | secondary_domains)
    if merged_domains:
        update_data['domains'] = merged_domains
    
    # 3. Merge industries
    primary_industries = set(primary.get('industries') or [])
    if primary.get('industry'):
        primary_industries.add(primary['industry'])
    
    secondary_industries = set(secondary.get('industries') or [])
    if secondary.get('industry'):
        secondary_industries.add(secondary['industry'])
    
    merged_industries = list(primary_industries | secondary_industries)
    if merged_industries:
        update_data['industries'] = merged_industries
    
    # 4. Update primary company in unified_companies (single source)
    await db.unified_companies.update_one(
        {"$or": [
            {"id": primary_id}, 
            {"hs_object_id": primary_id},
            {"hubspot_id": primary_id}
        ]},
        {"$set": update_data}
    )
    
    # 5. Update contacts
    if secondary_name:
        contacts_result = await db.unified_contacts.update_many(
            {"company": {"$regex": f"^{re.escape(secondary_name)}$", "$options": "i"}},
            {"$set": {"company": primary_name, "company_id": primary_id, "updated_at": now}}
        )
        result['contacts_updated'] = contacts_result.modified_count
    
    # 6. Update cases
    if secondary_name:
        cases_result = await db.cases.update_many(
            {"company_name": {"$regex": f"^{re.escape(secondary_name)}$", "$options": "i"}},
            {"$set": {"company_name": primary_name, "updated_at": now}}
        )
        result['cases_updated'] = cases_result.modified_count
    
    # 7. Mark secondary as merged in unified_companies
    merge_marker = {
        "is_merged": True,
        "merged_into_company_id": primary_id,
        "merged_into_company_name": primary_name,
        "merged_at": now,
        "merged_by": "auto_domain_merge",
        "is_active": False
    }
    
    await db.unified_companies.update_one(
        {"$or": [
            {"id": secondary_id}, 
            {"hs_object_id": secondary_id},
            {"hubspot_id": secondary_id}
        ]},
        {"$set": merge_marker}
    )
    
    return result


async def run_auto_merge(
    db,
    max_merges: int = 50,
    dry_run: bool = False,
    initiated_by: str = "system"
) -> dict:
    """
    Main function to run automatic domain-based company merging.
    
    Args:
        db: Database connection
        max_merges: Maximum number of merge operations to perform
        dry_run: If True, only report what would be merged without making changes
        initiated_by: User ID or 'system' for automated runs
    
    Returns:
        Summary of merge operations
    """
    now = datetime.now(timezone.utc).isoformat()
    operation_id = str(uuid.uuid4())
    
    logger.info(f"Starting auto-merge operation {operation_id} (dry_run={dry_run}, max={max_merges})")
    
    # Find duplicate domains
    duplicates = await find_duplicate_domains(db, limit=max_merges * 2)
    
    total_groups = len(duplicates)
    total_companies = sum(len(companies) for companies in duplicates.values())
    
    logger.info(f"Found {total_groups} domain groups with {total_companies} companies")
    
    merge_results = []
    merge_count = 0
    total_contacts_updated = 0
    total_cases_updated = 0
    
    for domain, companies in duplicates.items():
        if merge_count >= max_merges:
            break
        
        # Select primary and secondaries
        primary, secondaries = select_primary_company(companies)
        
        if not primary or not secondaries:
            continue
        
        # Merge each secondary into primary
        for secondary in secondaries:
            if merge_count >= max_merges:
                break
            
            try:
                result = await merge_company_into_primary(db, primary, secondary, dry_run)
                merge_results.append({
                    'domain': domain,
                    **result
                })
                merge_count += 1
                total_contacts_updated += result['contacts_updated']
                total_cases_updated += result['cases_updated']
                
                logger.info(
                    f"{'[DRY-RUN] Would merge' if dry_run else 'Merged'} "
                    f"'{secondary.get('name')}' into '{primary.get('name')}' (domain: {domain})"
                )
            except Exception as e:
                logger.error(f"Error merging {secondary.get('name')} into {primary.get('name')}: {e}")
                merge_results.append({
                    'domain': domain,
                    'primary_name': primary.get('name'),
                    'secondary_name': secondary.get('name'),
                    'error': str(e)
                })
    
    # Create audit log
    summary = {
        'operation_id': operation_id,
        'operation_type': 'auto_domain_merge',
        'run_at': now,
        'dry_run': dry_run,
        'initiated_by': initiated_by,
        'duplicate_domain_groups_found': total_groups,
        'total_companies_with_duplicates': total_companies,
        'merges_performed': merge_count,
        'total_contacts_updated': total_contacts_updated,
        'total_cases_updated': total_cases_updated,
        'merge_details': merge_results,
        'status': 'completed'
    }
    
    # Save audit log (unless dry run)
    if not dry_run:
        await db.admin_operations.insert_one(summary)
    
    logger.info(
        f"Auto-merge {'preview' if dry_run else 'completed'}: "
        f"{merge_count} merges, {total_contacts_updated} contacts, {total_cases_updated} cases"
    )
    
    return summary


async def get_duplicate_domains_preview(db, limit: int = 20) -> List[dict]:
    """
    Get a preview of companies with duplicate domains for UI display.
    """
    duplicates = await find_duplicate_domains(db, limit=limit)
    
    preview = []
    for domain, companies in duplicates.items():
        primary, secondaries = select_primary_company(companies)
        
        preview.append({
            'domain': domain,
            'company_count': len(companies),
            'primary': {
                'id': primary['_company_id'],
                'name': primary.get('name'),
                'score': score_company_completeness(primary)
            } if primary else None,
            'secondaries': [
                {
                    'id': s['_company_id'],
                    'name': s.get('name'),
                    'score': score_company_completeness(s)
                }
                for s in secondaries
            ]
        })
    
    return preview
