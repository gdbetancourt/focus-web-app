# Fallback Dependencies - Transition Plan

## Overview
This document tracks all remaining fallbacks to deprecated collections (`companies`, `active_companies`, `hubspot_companies`) during the transition to `unified_companies`.

**Goal**: Complete elimination of fallbacks in P2 phase.

---

## Current State (Post-Redesign)

### Primary Collection: `unified_companies`
All NEW creates/edits happen here. This is the canonical source.

### Deprecated Collections (Read-Only Fallback)
| Collection | Status | Usage |
|------------|--------|-------|
| `companies` | ⚠️ READ-ONLY FALLBACK | Legacy company lookups |
| `active_companies` | ⚠️ READ-ONLY FALLBACK | Prospection backward compat |
| `hubspot_companies` | ⚠️ READ-ONLY FALLBACK | HubSpot import data |

---

## Fallback Locations by File

### 1. `backend/routers/prospection.py`

| Line | Function | Fallback To | Reason |
|------|----------|-------------|--------|
| L1994-1999 | `get_active_companies()` | `active_companies` | Find existing company if not in unified |
| L2083-2085 | `add_search_to_company()` | `active_companies` | Find company for adding search |
| L2214 | `toggle_company_active()` | `active_companies` | Toggle status on legacy companies |
| L2276-2280 | `merge_companies()` | `active_companies` | Merge target lookup |

**Criteria for Removal**: 
- All companies migrated to `unified_companies`
- No orphaned searches referencing `active_companies` IDs

### 2. `backend/routers/companies.py`

| Line | Function | Fallback To | Reason |
|------|----------|-------------|--------|
| L62 | `search_companies()` | `hubspot_companies` | Aggregate pipeline search |
| L113-160 | `merge_companies()` | `hubspot_companies` | Merge functionality |
| L216-221 | `list_companies()` | `hubspot_companies`, `companies` | List all sources |
| L268-309 | `create_company()` | `hubspot_companies`, `companies` | Duplicate check |
| L335-414 | `global_company_search()` | `hubspot_companies`, `active_companies` | Cross-collection search |
| L506-516 | `resolve_company_name()` | `hubspot_companies`, `companies` | Name resolution |
| L651-670 | `get_company_details()` | `active_companies`, `hubspot_companies`, `companies` | Detail lookup |
| L775-776 | Company operations | `active_companies` | Various operations |

**Criteria for Removal**:
- Migration script run to copy all HubSpot data to `unified_companies`
- Verification that no UI depends on HubSpot-specific fields

### 3. `backend/routers/cases.py`

| Line | Function | Fallback To | Reason |
|------|----------|-------------|--------|
| L398 | `get_case()` | `hubspot_companies` | Company lookup for case display |
| L789-830 | `get_case_companies()` | `hubspot_companies` | Company association |

**Criteria for Removal**:
- All case-related companies exist in `unified_companies`
- Company association uses `company_id` field consistently

---

## Migration Checklist for P2

### Phase 1: Data Migration
- [ ] Run migration script to copy all `active_companies` → `unified_companies`
- [ ] Run migration script to copy all `hubspot_companies` → `unified_companies`
- [ ] Run migration script to copy all `companies` → `unified_companies`
- [ ] De-duplicate merged companies (by name/domain)
- [ ] Preserve all `searches` from `active_companies`

### Phase 2: Code Removal
- [ ] Remove fallbacks from `prospection.py`
- [ ] Remove fallbacks from `companies.py`
- [ ] Remove fallbacks from `cases.py`
- [ ] Remove old collection imports
- [ ] Update all tests

### Phase 3: Collection Cleanup
- [ ] Archive deprecated collections (rename with `_deprecated_` prefix)
- [ ] Monitor for 2 weeks
- [ ] Drop deprecated collections

---

## Ready for Removal Criteria

A fallback is **ready for removal** when:

1. ✅ All data from the deprecated collection exists in `unified_companies`
2. ✅ All references (IDs, names) have been updated
3. ✅ No active queries return results from deprecated collection only
4. ✅ Tests pass without fallback
5. ✅ Production monitoring shows zero fallback hits for 7 days

---

## Current Blockers

| Blocker | Collection | Resolution |
|---------|------------|------------|
| HubSpot import still writes to `hubspot_companies` | `hubspot_companies` | Update import script to write to `unified_companies` |
| LinkedIn searches reference `active_companies.id` | `active_companies` | Migrate `linkedin_searches.company_id` references |
| Case company resolution uses HubSpot IDs | `hubspot_companies` | Store `unified_companies.id` in cases |

---

## Last Updated
- Date: 2025-02-19
- Status: Transition Phase
- Next Review: After seed data testing
