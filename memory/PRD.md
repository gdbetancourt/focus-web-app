# Leaderlix Focus - Product Requirements Document

## Project Overview
CRM application for Leaderlix with focus on case management, contact management, and delivery tracking.

## Core Architecture
- **Frontend**: React + Shadcn UI
- **Backend**: FastAPI + Motor (async MongoDB)
- **Database**: MongoDB Atlas

## Current Status (Feb 20, 2025)

### ✅ PERSONA CLASSIFIER V3 - TODAS LAS FASES COMPLETADAS (Feb 20, 2025)

#### Arquitectura Centralizada del Clasificador de Buyer Persona

**Problema Resuelto**: 12+ implementaciones duplicadas del clasificador dispersas en el código.

**Solución Completa**: 
- Fase 1: Servicio centralizado único
- Fase 2: Worker de reclasificación en background
- Fase 3: UI completa en Assets
- Fase 4: Métricas preagregadas

**Componentes Implementados**:

1. **Servicio Centralizado** (Fase 1)
   - `classify_job_title()` - Clasificación completa con detalles
   - `classify_job_title_simple()` - Retorna solo buyer_persona_id
   - `normalize_job_title()` - Normalización consistente
   - Cache en memoria con invalidación automática

2. **Worker de Reclasificación** (Fase 2)
   - Procesamiento en batches de 500
   - `bulk_write` para performance
   - Heartbeat y recuperación de huérfanos
   - Tipos: all, by_keyword, by_persona, affected
   - Dry-run para preview

3. **API Endpoints** (Fase 2)
   - Router `/api/persona-classifier/`
   - Endpoints de clasificación, reclasificación, estadísticas
   - Gestión de jobs con progreso observable

4. **UI en Assets** (Fase 3)
   - Ruta: `/focus/assets/persona-classifier`
   - 4 tabs: Keywords, Diagnóstico, Reclasificar, Estadísticas
   - Vista de árbol: Buyer Persona → Keywords con inline edit
   - Panel de diagnóstico con clasificación en tiempo real
   - Panel de reclasificación con progreso y dry-run
   - Dashboard de estadísticas

5. **Métricas Preagregadas** (Fase 4)
   - Worker cada 6 horas
   - Colección `persona_classifier_metrics`
   - Cálculo de: distribución por persona, coverage, top keywords, unused keywords
   - Trends comparativos con período anterior
   - Retención de 90 días de histórico
   - UI integrada en panel de Estadísticas

6. **Protección de Override**
   - `buyer_persona_locked` - Previene reclasificación
   - `buyer_persona_assigned_manually` - Marca clasificación manual

**Nuevos Archivos Frontend**:
- `/frontend/src/pages/PersonaClassifierPage.jsx`
- `/frontend/src/components/focus/assets/PersonaClassifierAssetPage.jsx`

**Nuevos Archivos Backend**:
- `/backend/services/persona_classifier_service.py`
- `/backend/services/persona_reclassification_worker.py`
- `/backend/services/persona_classifier_metrics.py`
- `/backend/routers/persona_classifier.py`
- `/backend/tests/test_persona_classifier_service.py`
- `/backend/tests/test_persona_reclassification_worker.py`
- `/backend/tests/test_persona_classifier_metrics.py`
- `/backend/docs/PERSONA_CLASSIFIER_V3.md`

**APScheduler Jobs**:
- `persona_reclassification_worker` - cada 30 segundos
- `persona_classifier_metrics_worker` - cada 6 horas

**Tests**: 38/38 pasando

---

### ✅ IMPORT NEW CONNECTIONS V2.1 COMPLETE (Feb 20, 2025)

#### V2.1 Mandatory Changes - Architectural Improvements

**Changes Implemented**:

1. **Company Linking (Bulk-Safe)**
   - `resolve_companies_bulk()` function uses single `$in` query + bulk upsert
   - New contacts get: `company` (name), `company_id` (UUID), `companies[]` array with `is_primary=True`
   - Existing contacts: new companies added as secondary (`is_primary=False`) without replacing primary

2. **Conflict Retention (TTL Index)**
   - 90-day TTL index on `linkedin_import_conflicts.created_at`
   - Automatic cleanup of old conflict data by MongoDB
   - `created_at` field added as `datetime` type for TTL to work

3. **Retry with Exponential Backoff**
   - 1st retry: 60 seconds (1 minute)
   - 2nd retry: 300 seconds (5 minutes)  
   - 3rd attempt: final (job marked as failed)
   - Worker respects `retry_after` field before picking up pending_retry jobs

4. **Connected On Date Parser (NEW)**
   - Robust `parse_linkedin_date()` function
   - Supports ES/EN months: `ene, feb, mar...` / `jan, feb, mar...` (case-insensitive)
   - Supports separators: space, `-`, `/`, `.`
   - Validates invalid dates (32 feb, 31 abr, feb 29 non-leap)
   - Output: ISO format `YYYY-MM-DD`
   - Field: `first_connected_on_linkedin` in unified_contacts
   - Invalid dates don't break import, counted in `connected_on_parse_failed`

**Files Modified**:
- `/app/backend/linkedin_import_worker.py` - Core V2.1 logic + date parser
- `/app/backend/scheduler_worker.py` - Added `ensure_indexes()` call

**New Tests**:
- `/app/backend/tests/test_linkedin_import_v21.py` - 8 tests (5 V2.1 + 3 date parsing)
- `/app/backend/tests/test_linkedin_date_parser.py` - 54 unit tests for date parser

**Testing**: 100% pass rate
- 54/54 date parser unit tests
- 8/8 V2.1 integration tests
- 15/15 V2 regression tests

---

### ✅ IMPORT NEW CONNECTIONS V2 COMPLETE (Feb 20, 2025)

#### LinkedIn Connections Import - Robust Architecture

**Implemented Features**:

1. **MongoDB-based Job Queue (APScheduler)**
   - Persistent job storage in `linkedin_import_jobs` collection
   - Worker polls every 10 seconds via APScheduler
   - Replaced non-robust FastAPI BackgroundTasks

2. **Streaming File Processing**
   - Reads CSV row-by-row (not loading entire file in memory)
   - Batch processing of 500 rows at a time
   - Suitable for 10,000+ row files

3. **Bulk Database Operations**
   - MongoDB `bulk_write` with `UpdateOne` operations
   - `upsert=True` for atomic contact creation
   - Benchmark: ~10,000 rows in ~2 minutes

4. **Profile Locking**
   - `linkedin_import_locks` collection prevents concurrent imports per profile
   - Lock auto-expires after 5 minutes (orphan timeout)

5. **Orphan Job Recovery**
   - Heartbeat mechanism (`heartbeat_at` field)
   - Jobs stuck in "processing" for >5 minutes are recovered
   - Automatic retry up to 3 attempts

6. **Conflict Detection**
   - Detects when email matches contact X but LinkedIn URL matches contact Y
   - Logs conflicts to `linkedin_import_conflicts` collection
   - Downloadable conflict CSV

7. **Buyer Persona Classification**
   - All new contacts classified based on `job_title`
   - Uses `job_keywords` and `buyer_persona_priorities` collections

**Database Collections**:
- `linkedin_import_jobs` - Job state and progress
- `linkedin_import_conflicts` - Logged conflicts (90-day TTL)
- `linkedin_import_locks` - Profile locks
- `linkedin_import_tasks` - Weekly task tracking per profile
- `linkedin_import_mappings` - Saved column mappings per profile

**API Endpoints**:
- `POST /api/linkedin-import/upload` - Upload CSV file
- `POST /api/linkedin-import/start/{job_id}` - Queue job for processing
- `GET /api/linkedin-import/progress/{job_id}` - Get job progress
- `GET /api/linkedin-import/jobs` - List import jobs
- `POST /api/linkedin-import/cancel/{job_id}` - Cancel running job
- `GET /api/linkedin-import/{job_id}/conflicts` - Get conflicts
- `GET /api/linkedin-import/{job_id}/conflicts/download` - Download conflicts CSV

**Testing**: 100% pass rate (15/15 tests)
- Test file: `/app/backend/tests/test_linkedin_import_v2_worker.py`

---

### ✅ QUALIFY NEW CONTACTS LOGIC UPDATE COMPLETE (Feb 20, 2025)

#### New Filtering and Semaphore Logic for Outbound Contacts

**Changes Implemented**:

1. **Updated Filtering Logic** (`prospection.py`)
   - Contacts to qualify must meet ALL criteria:
     - Stage 1 or 2
     - `qualification_status` = "pending" or field doesn't exist
     - AND at least one of:
       - Contact has `classification: "outbound"`
       - Contact is associated with a company with `classification: "outbound"`

2. **New Semaphore Logic** (`focus.py`)
   - 🟢 **GREEN**: Zero contacts pending qualification
   - 🟡 **YELLOW**: At least one qualified this week, but still have pending
   - 🔴 **RED**: No contacts qualified this week AND there are pending contacts
   - **Removed**: Fixed weekly goal of 250 contacts

3. **Frontend Updates** (`ToQualifyTabContent.jsx`)
   - Removed fixed "250" weekly goal display
   - Now shows: qualified count this week + pending count
   - Progress bar reflects percentage towards zero pending

**Files Modified**:
- `/app/backend/routers/focus.py` - `calculate_qualify_contacts_status()` function
- `/app/backend/routers/prospection.py` - `/to-qualify/next` and `/to-qualify/stats` endpoints
- `/app/frontend/src/components/todays-focus/ToQualifyTabContent.jsx` - UI updates

**Testing**: 100% pass rate (11/11 tests)
- Test report: `/app/test_reports/iteration_82.json`
- **Bug fix**: Corregido filtro MongoDB que usaba `$or` duplicado (sobrescribía outbound filter)
- Current status: YELLOW (1 qualified this week, **5,495** pending outbound contacts)

---

### ✅ LOGIN PERFORMANCE BUG FIX COMPLETE (Feb 20, 2025)

#### Critical Performance Issue Resolved

**Problem**: Login was unusably slow (30+ seconds or timing out) because the `find_similar_names` function was called synchronously during login via `/api/focus/traffic-light-status` endpoint. This function scans ~23,000 companies with fuzzy matching on every call.

**Solution Implemented**:
1. Created new **pre-computed cache system** (`merge_candidates_cache.py`)
2. Cache stores domain duplicates and similar name candidates in `merge_candidates_cache` collection
3. Modified `calculate_merge_companies_status()` in `focus.py` to read from cache instead of live calculation
4. Modified merge-candidate endpoints in `companies.py` to use cache

**New Files Created**:
- `/app/backend/services/merge_candidates_cache.py` - Cache management service

**New API Endpoints**:
- `POST /api/companies/merge-candidates/refresh-cache` - Refresh cache (background job)
- `GET /api/companies/merge-candidates/cache-status` - Check cache status
- `GET /api/companies/merge-candidates/domain-duplicates` - Get domain duplicates from cache

**Performance Improvement**:
- **Before**: 30+ seconds or timeout
- **After**: ~1.8 seconds average
- **Improvement**: 94%+ faster

**Testing**:
- 100% test pass rate (7/7 tests)
- Test report: `/app/test_reports/iteration_78.json`

**Cache Management**:
- Cache refreshes automatically daily at 3 AM UTC via scheduler job
- Manual refresh available via `POST /api/companies/merge-candidates/refresh-cache`
- Initial cache populated with 1000 similar name groups

---

### ✅ INFOTAB REFACTOR COMPLETE (Feb 20, 2025)

#### ContactSheet.jsx Component Extraction

**Objective**: Extract the large "Info" tab (~600 lines) from ContactSheet.jsx for maintainability.

**Changes**:
- **ContactSheet.jsx**: 2213 → 1685 lines (-528 lines, -24%)
- **New InfoTab.jsx**: 719 lines in `/app/frontend/src/components/contact-sheet/InfoTab.jsx`

**Component Props** (46 props passed):
- Form data: `formData`, `setFormData`
- Emails: `emails`, `emailDuplicates`, `addEmail`, `updateEmail`, `removeEmail`, `setPrimaryEmail`
- Phones: `phones`, `phoneDuplicates`, `addPhone`, `updatePhone`, `updatePhoneCountry`, `removePhone`, `setPrimaryPhone`
- Companies: `contactCompanies`, `activeCompanyIndex`, `companySearchInput`, `companySearchResults`, `loadingCompanies`, etc.
- Roles: `ROLE_OPTIONS`, `toggleRole`, `caseRoles`, `toggleCaseRole`, `saveCaseRoles`

**Testing**: 100% backend (5/5), 90% frontend (9/10 - 1 false negative)
- Test report: `/app/test_reports/iteration_79.json`

### ✅ RELATIONSHIPS TAB EXTRACTION (Feb 20, 2025)

**New Component**: `/app/frontend/src/components/contact-sheet/RelationshipsTab.jsx`
- 185 lines extracted from ContactSheet.jsx
- Handles contact relationship management (reports_to, manages, works_with)

**ContactSheet.jsx Final Status**:
- Original: 2213 lines
- After all extractions: **1623 lines** (-590 lines, -27% reduction)

**Extracted Tab Components Summary**:
| Component | Lines | Purpose |
|-----------|-------|---------|
| InfoTab.jsx | 719 | Contact info editing form |
| CasesTab.jsx | 460 | Case/deal management |
| CoursesTab.jsx | 350 | LMS course assignments |
| RelationshipsTab.jsx | 185 | Contact relationships |
| TasksTab.jsx | 147 | Task management |
| WebinarsTab.jsx | 107 | Webinar registrations |

---

### ✅ AUTOMATIC CACHE REFRESH SCHEDULER (Feb 20, 2025)

**New Scheduler Job**: `refresh_merge_candidates_cache_job`
- Runs daily at 3 AM UTC
- Pre-computes duplicate domains and similar names
- Ensures semaphore status is always accurate without expensive real-time calculations

**Files Modified**:
- `/app/backend/scheduler_worker.py` - Added new cron job

---

### ✅ INDUSTRY MERGE FUNCTIONALITY COMPLETE (Feb 20, 2025)

#### Multi-Select Industry Merge in Companies Page

1. **Merge Mode Toggle**
   - "Fusionar Industrias" button visible at top-right of Companies page
   - Clicking enters "merge mode" with visible toolbar showing selection count
   - Cancel button exits mode and clears all selections

2. **Industry Selection**
   - Checkboxes appear next to each industry in merge mode
   - **Block restriction**: Can only select industries from same block (Outbound OR Inbound)
   - First selected industry auto-set as "Destino" (target)
   - Can change target by clicking "Hacer destino" on another selected industry

3. **Merge Confirmation Modal**
   - Shows target industry (green, marked as "Destino")
   - Shows industries to be merged (red, will be deleted)
   - Shows preview of affected companies count
   - "Confirmar Fusión" button executes merge

4. **Backend Integration**
   - Uses existing `POST /api/industries-v2/merge` endpoint
   - Companies in merged industries are reassigned to target
   - Merged industries marked with `is_merged: true` (soft delete)
   - Audit log created for each merge operation

5. **Files Modified**
   - `frontend/src/pages/Companies.jsx` - Full merge UI implementation

6. **Testing**
   - 100% backend test pass rate (7 passed, 3 skipped due to data)
   - 100% frontend feature verification
   - Test report: `/app/test_reports/iteration_77.json`

---

### ✅ INDUSTRIES CONSOLIDATION COMPLETE (Feb 20, 2025)

#### Industry Management Integrated into Companies Page

1. **Tab Structure Updated**
   - Removed standalone "Industries" tab from `/focus/assets/companies`
   - Now only 3 tabs: Outbound, All Companies, Auto-Merge
   - Industries functionality consolidated into collapsible panel in "All Companies"

2. **New UI Components Added**
   - Collapsible "Catálogo de Industrias" panel in `Companies.jsx`
   - Full CRUD: Create, Edit, Delete industry
   - Merge industries functionality
   - Classification toggle (Inbound/Outbound) per industry

3. **Files Modified**
   - `frontend/src/pages/foundations/CompaniesPage.jsx` - Removed Industries tab
   - `frontend/src/pages/Companies.jsx` - Added industry catalog panel
   - `frontend/src/components/Layout.jsx` - Removed Industries menu item

4. **Backend Unchanged**
   - All existing `/api/industries-v2/*` endpoints still functional
   - All existing `/api/industries/*` endpoints still functional

---

### ✅ P1 TASKS COMPLETE (Feb 20, 2025)

#### Company Search Implemented
- New "Buscar Empresas" search section in `/focus/assets/companies`
- Searches by name, domain, and aliases
- Debounced search (300ms) with 2+ character minimum
- Results show: Company name, aliases, domain, industry, classification (Inbound/Outbound)
- Edit buttons available for each result

#### Outbound Views Verified
- **Outbound tab**: Shows all companies with `classification: 'outbound'` (48+ companies)
- **Max LinkedIn Conexions page**: Shows active companies for prospection (80+ outbound companies)
- Both use `unified_companies` collection as canonical source

#### Data Transition Complete
- **Contacts.jsx**: Now uses `getUnifiedContacts()` instead of `getHubSpotContacts()`
- **Campaigns.jsx**: Now uses `getUnifiedContacts()` instead of `getHubSpotContacts()`
- **`/hubspot/sectors` endpoint**: Updated to count companies from `unified_companies`
- **All data reads from unified collections**: `unified_contacts` and `unified_companies`

#### Deprecation Complete
- **Endpoints marked deprecated**: 
  - `GET /api/hubspot/contacts` (use `/api/contacts`)
  - `POST /api/hubspot/sync` (no longer needed)
  - `GET /api/hubspot/companies` (use `/api/unified-companies`)
  - `POST /api/hubspot/companies/migrate-from-hubspot` (migration complete)
- **Deprecation warnings**: Added logger.warning() to all deprecated endpoints
- **Documentation**: Created `/app/memory/DEPRECATED_COLLECTIONS.md` with archival plan
- **Backward compatibility**: All deprecated endpoints still function

#### Frontend Cleanup Complete
- **Removed from `api.js`**: `getHubSpotContacts()` and `syncHubSpotContacts()` 
- **Updated `Events.jsx`**: Now uses `/api/contacts` instead of `/api/hubspot/contacts`
- **Updated `Companies.jsx`**: `handleSync()` no longer calls HubSpot sync endpoint
- **Zero HubSpot sync dependencies**: Frontend no longer depends on HubSpot API for data

---

### ✅ HUBSPOT DATA SYNCHRONIZATION COMPLETE (Feb 19, 2025)

#### Importación Masiva Completada

1. **CONTACTOS: 100% IMPORTADOS**
   - Total en MongoDB: 103,251 contactos
   - Con hubspot_contact_id: 100,055
   - Contactos HubSpot con email válido: 36,792 (todos importados)
   - Contactos HubSpot sin email: 89,386 (no importables)
   - Clasificaciones preservadas: 962 contactos

2. **DEALS/CASES: 96.3% IMPORTADOS**
   - Total en MongoDB: 47,456 cases
   - Con hubspot_deal_id: 47,453
   - Total en HubSpot: 49,275
   - Diferencia (~1,800) por duplicados de nombre

3. **Scripts de Importación Creados**
   - `/app/backend/scripts/hubspot_import_batch.py` - Importación idempotente de contactos
   - `/app/backend/scripts/hubspot_deals_import.py` - Importación idempotente de deals
   - Uso: `cd /app/backend && export $(cat .env | xargs) && python3 scripts/hubspot_import_batch.py`

4. **Sistema de Sync Admin Verificado**
   - `/app/backend/routers/admin_sync.py` - Sistema de preview, run, rollback
   - Bug de snapshots corregido
   - Rollback funcional para contactos y cases

### ✅ EMPRESAS CONSOLIDATION COMPLETE (Feb 19, 2025)

#### Migración de Empresas a unified_companies
1. **21,970 empresas consolidadas** en `unified_companies`
   - 291 empresas outbound
   - 21,679 empresas inbound
   - Migradas desde: active_companies, hubspot_companies, contacts (materializadas)

2. **UI Actualizada**
   - `/pages/Companies.jsx` ahora usa `/unified-companies/*` endpoints
   - Botón "Create Company" agregado
   - Stats muestran total/outbound/inbound correctamente

3. **Nuevos Endpoints Agregados**
   - `GET /unified-companies/stats/summary` - Total, outbound, inbound counts
   - `GET /unified-companies/stats/industries` - Industries con counts
   - `GET /unified-companies/by-industry/{industry}` - Empresas por industria
   - `POST /unified-companies/{id}/aliases` - Agregar alias
   - `DELETE /unified-companies/{id}/aliases/{alias}` - Eliminar alias
   - `POST /unified-companies/{id}/industries` - Agregar industria secundaria
   - `DELETE /unified-companies/{id}/industries/{industry}` - Eliminar industria secundaria

4. **Fixes Aplicados**
   - `/prospection/active-companies` ahora filtra por `classification=outbound`
   - Classification badge agregado en ContactSheet
   - CompanyEditorDialog usa endpoints de unified_companies
   - "Company not found" errors resueltos

### ✅ INBOUND/OUTBOUND REDESIGN COMPLETE

#### Critical Changes Made This Session

1. **REMOVED Automatic Stage 4 → Outbound Classification**
   - `contacts.py` L944-959: Automation removed
   - `cases.py` L893-934: Automation removed
   - `prospection.py` L2001-2017: New companies default to INBOUND
   - Classification is now ONLY via: manual edit OR industry inheritance

2. **Verified Propagation Logic**
   - Industry → Company: Working (audit logged)
   - Company → Contact: Working (audit logged)
   - Multi-company contact rule: Working (only inbound if ALL companies inbound)

3. **Fallbacks Documented**
   - See `/app/memory/FALLBACK_DEPENDENCIES.md` for full list
   - All new creates/edits go to `unified_companies`
   - Fallbacks remain for backward compatibility (P2 removal)

### Functional Tests Passed (21/21)

| Test | Description | Status |
|------|-------------|--------|
| 1-3 | Auth + Data verification | ✅ |
| 4-7 | Company → Contact propagation | ✅ |
| 8-11 | Industry → Company propagation | ✅ |
| 12-17 | Multi-company contact logic | ✅ |
| 18-20 | Industry merge | ✅ |
| 21 | Stage 4 automation removed | ✅ |

### Data Model

**`unified_companies`** (Canonical Source)
```json
{
  "id": "uuid",
  "name": "string",
  "normalized_name": "string",
  "classification": "inbound|outbound",
  "industry": "string",
  "industry_id": "uuid",
  "aliases": ["string"],
  "is_merged": false,
  "outbound_since": "datetime (only if outbound)",
  "outbound_source": "manual|industry_inheritance"
}
```

**Classification Rules**
1. Default: `inbound`
2. Change to `outbound`: Manual only OR industry propagation
3. Change to `inbound`: Manual only (no auto-reversion)
4. Contact classification: Outbound if ANY company is outbound

### API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/unified-companies` | GET | List all companies |
| `/api/unified-companies/{id}` | PATCH | Update company |
| `/api/unified-companies/{id}/classification` | PATCH | Update classification |
| `/api/unified-companies/{id}/propagation-preview` | GET | Preview affected contacts |
| `/api/unified-companies/{id}/propagate-classification` | POST | Execute propagation |
| `/api/unified-companies/{id}/activities` | GET | Get audit trail |
| `/api/industries-v2` | GET | List industries |
| `/api/industries-v2/{id}/classification` | PATCH | Update classification |
| `/api/industries-v2/{id}/propagate-classification` | POST | Propagate to companies |
| `/api/industries-v2/merge` | POST | Merge industries |

### Remaining Backlog

#### P0 (Critical - RESOLVED)
- [x] **Google OAuth 403 Error** - User confirmed it's now working (Feb 20)

#### P1 (Completed)
- [x] Extraer InfoTab (~600 líneas) from ContactSheet.jsx - DONE (Feb 20)
- [x] Implement periodic cache refresh for merge candidates - DONE (Feb 20)

#### P2 (COMPLETED - Legacy Data Archival)
- [x] Created documentation: `/app/memory/DEPRECATED_COLLECTIONS.md`
- [x] **FULLY MIGRATED ALL MAIN ROUTERS** to use unified collections
- [x] `companies.py` - 44 references removed
- [x] `cases.py`, `delivery.py`, `events_v2.py` - Company lookups migrated
- [x] `cotizador.py`, `time_tracker.py` - Contact lookups migrated
- [x] `prospection.py` - Active companies migrated
- [x] `industries.py`, `industries_v2.py` - Classification updates migrated
- [x] `todays_focus.py` - Company lookups migrated
- [x] `public_website.py` - Client logos migrated
- [x] `certificados.py`, `admin_sync.py` - Contact lookups migrated

**Remaining (intentionally not migrated)**:
- `scrappers.py` (16 refs) - Uses dedicated scraping collections for LinkedIn/Apollo
- `legacy.py` - Contains deprecated endpoints (monitoring for removal)

**Status**: 0 legacy references in main routers and services (excluding scrappers and legacy)

**Verification**: 100% tests passed (20/20 backend, frontend complete)
- Test report: `/app/test_reports/iteration_81.json`
- All 17 traffic light sections working
- Company endpoints verified
- Cache system verified

#### P2 (Future)
- [ ] Remove deprecated endpoints from `legacy.py` (after monitoring period)
- [ ] Continue ContactSheet.jsx refactor (extract other tabs if needed)

### Latest Feature Implementation (Feb 20, 2025)
**Companies Page Restructuring - COMPLETE**
- [x] Eliminado tab "Outbound" - Solo "All Companies" y "Auto-Merge"
- [x] Lista agrupada por industrias con bloques Outbound/Inbound
- [x] Ordenamiento por número de empresas (descendente)
- [x] Paginación de 5 empresas por industria
- [x] Buscador filtra por nombre, dominio, alias
- [x] Edición de industria desde header del acordeón

### ContactSheet Refactoring Progress
- [x] CoursesTab.jsx - Extracted & Integrated (~280 lines)
- [x] CasesTab.jsx - Extracted & Integrated (~340 lines)
- [x] WebinarsTab.jsx - Extracted & Integrated (~100 lines)
- [x] TasksTab.jsx - Extracted & Integrated (~130 lines)
- [x] **ContactSheet.jsx reducido de 2891 → 2213 líneas (-678, -23%)**
- [ ] InfoTab.jsx - Largest tab (~600 lines) - Most complex

### Files Modified This Session

**Backend**
- `routers/contacts.py` - Removed Stage 4 automation
- `routers/cases.py` - Removed Stage 4 automation  
- `routers/prospection.py` - New companies default inbound
- `scripts/generate_seed_data.py` - Test data generator

**Documentation**
- `memory/PRD.md` - This file
- `memory/FALLBACK_DEPENDENCIES.md` - Transition tracking

### Third-Party Integrations
- Google OAuth2 (Emergent Auth) - Working
- MongoDB Atlas, HubSpot, Cloudflare Turnstile, Google Calendar/Drive

### Test Credentials
- Session auth via cookie `session_token`
- Test user: `admin@leaderlix.com` (created via seed script)
