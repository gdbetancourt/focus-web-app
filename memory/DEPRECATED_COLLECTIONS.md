# Deprecated Collections and Endpoints

**Last Updated:** Feb 20, 2025

## Overview

As part of the data unification initiative, several MongoDB collections and API endpoints have been deprecated in favor of unified collections. This document tracks the deprecation status and provides guidance for the eventual removal.

---

## Deprecated Collections

### Collection Counts (Current)

| Collection | Documents | Status | Replacement |
|------------|-----------|--------|-------------|
| `hubspot_contacts` | ~991 | DEPRECATED | `unified_contacts` |
| `companies` | ~15,769 | DEPRECATED | `unified_companies` |
| `active_companies` | ~298 | DEPRECATED | `unified_companies` |
| `unified_contacts` | **~103,254** | **ACTIVE** | Primary contact storage |
| `unified_companies` | **~23,065** | **ACTIVE** | Primary company storage |

### 1. `hubspot_contacts`
**Status:** DEPRECATED  
**Replacement:** `unified_contacts`  
**Contains:** ~991 contacts from HubSpot list sync  
**Migration Status:** Data migrated to `unified_contacts`  

**Files Still Referencing This Collection:**
- `/app/backend/routers/admin_sync.py` - ✅ UPDATED (Feb 20) - removed dependency
- `/app/backend/routers/certificados.py` - ✅ UPDATED (Feb 20) - now uses unified_contacts
- `/app/backend/routers/legacy.py` (multiple endpoints) - still uses legacy collection

### 2. `companies`
**Status:** DEPRECATED  
**Replacement:** `unified_companies`  
**Contains:** ~15,769 companies imported from HubSpot  
**Migration Status:** ✅ COMPLETE - Data migrated to `unified_companies`  

**Files Still Referencing This Collection:**
- `/app/backend/routers/legacy.py` - HubSpot company endpoints (deprecated endpoints only)

**Migration Completed:**
- `/app/backend/routers/companies.py` - ✅ FULLY MIGRATED (Feb 20, 2025)
  - 44 legacy references removed
  - All endpoints now use `unified_companies`

### 3. `active_companies`
**Status:** DEPRECATED  
**Replacement:** `unified_companies` (with `classification: 'outbound'`)  
**Contains:** ~298 companies marked as active for prospection  
**Migration Status:** Data migrated to `unified_companies`  

---

## Deprecated API Endpoints (in legacy.py)

### Contact Endpoints
| Endpoint | Status | Replacement | Notes |
|----------|--------|-------------|-------|
| `GET /api/hubspot/contacts` | DEPRECATED | `GET /api/contacts` | Returns contacts from `hubspot_contacts` |
| `POST /api/hubspot/sync` | DEPRECATED | N/A | HubSpot sync no longer needed |

### Company Endpoints  
| Endpoint | Status | Replacement | Notes |
|----------|--------|-------------|-------|
| `GET /api/hubspot/companies` | DEPRECATED | `GET /api/unified-companies` | Now reads from `unified_companies` |
| `POST /api/hubspot/companies/migrate-from-hubspot` | DEPRECATED | N/A | Migration complete |
| `POST /api/hubspot/companies/sync` | DEPRECATED | N/A | No longer needed |

---

## Archival Plan

### Phase 1: Mark as Deprecated (COMPLETE)
- [x] Add `deprecated=True` to FastAPI endpoints
- [x] Add logger.warning() calls to track usage
- [x] Update documentation

### Phase 2: Monitor Usage
- [ ] Monitor logs for deprecated endpoint calls
- [ ] Identify any remaining frontend/backend consumers
- [ ] Update consumers to use new endpoints

### Phase 3: Archive Collections
```javascript
// MongoDB shell commands to archive collections
// Run these AFTER confirming no more usage

// Archive hubspot_contacts
db.hubspot_contacts.renameCollection("archive_hubspot_contacts_20250220")

// Archive companies  
db.companies.renameCollection("archive_companies_20250220")

// Archive active_companies
db.active_companies.renameCollection("archive_active_companies_20250220")

// Archive hubspot_companies
db.hubspot_companies.renameCollection("archive_hubspot_companies_20250220")
```

### Phase 4: Remove Code
- [ ] Remove deprecated endpoints from `legacy.py`
- [ ] Remove unused functions from `api.js`
- [ ] Clean up any remaining references

---

## Canonical Data Sources

### For Contacts
- **Collection:** `unified_contacts`
- **API Endpoint:** `GET /api/contacts`
- **Frontend Function:** `getUnifiedContacts()`

### For Companies
- **Collection:** `unified_companies`
- **API Endpoint:** `GET /api/unified-companies`
- **Filter for Outbound:** `classification: 'outbound'`
- **Filter for Active:** `is_merged: { $ne: true }`

### For Cases/Deals
- **Collection:** `cases`
- **API Endpoint:** `GET /api/cases`

---

## Notes

- The `unified_contacts` collection contains ~103,000 contacts (all imported from HubSpot)
- The `unified_companies` collection contains all company data with proper classification
- All new development should exclusively use the unified collections
- Legacy endpoints will continue to work but log deprecation warnings
