# Changelog

## [2025-02-20] Persona Classifier V3 - Fase 4

### Added
- Worker de métricas preagregadas `/backend/services/persona_classifier_metrics.py`
- Cálculo cada 6 horas de: distribución por persona, coverage, top keywords, unused keywords, trends
- Colección `persona_classifier_metrics` con retención de 90 días
- Endpoints: `/api/persona-classifier/metrics/latest`, `/metrics/history`, `/metrics/compute`
- Tests `/backend/tests/test_persona_classifier_metrics.py` (8 tests)
- UI de métricas preagregadas integrada en panel de Estadísticas

### Changed
- Actualizado `PersonaClassifierPage.jsx` con panel de métricas preagregadas
- Scheduler actualizado con job `persona_classifier_metrics_worker`

---

## [2025-02-20] Persona Classifier V3 - Fase 3

### Added
- Nueva página `/frontend/src/pages/PersonaClassifierPage.jsx` con:
  - Vista de árbol de Buyer Personas → Keywords
  - Panel de diagnóstico para probar clasificación
  - Panel de reclasificación con progreso en tiempo real
  - Dashboard de estadísticas
- Asset wrapper `/frontend/src/components/focus/assets/PersonaClassifierAssetPage.jsx`
- Ruta `/focus/assets/persona-classifier` agregada a App.js
- Sección "Persona Classifier" agregada a Assets Navigation

### Changed
- Actualizado `assetsSections.js` con nueva sección
- Actualizado index.js de focus y assets

---

## [2025-02-20] Persona Classifier V3 - Fase 2

### Added
- Worker de reclasificación `/backend/services/persona_reclassification_worker.py`
- Router Persona Classifier `/backend/routers/persona_classifier.py`
- Colección `persona_reclassification_jobs` para jobs persistentes
- Endpoints: `/api/persona-classifier/reclassify/{all,by-keyword,by-persona,affected}`
- Endpoints: `/api/persona-classifier/jobs`, `/api/persona-classifier/stats`
- Endpoint: `/api/persona-classifier/contacts/{id}/lock` para gestión de locks
- Endpoint: `/api/persona-classifier/contacts/{id}/classification` para ver clasificación
- Job en APScheduler `persona_reclassification_worker` (cada 30 segundos)
- Dry-run capability para preview de cambios
- Progreso observable en tiempo real
- Tests `/backend/tests/test_persona_reclassification_worker.py` (11 tests)

### Changed
- Documentación actualizada `/backend/docs/PERSONA_CLASSIFIER_V3.md`

---

## [2025-02-20] Persona Classifier V3 - Fase 1

### Added
- Servicio centralizado de clasificación `/backend/services/persona_classifier_service.py`
- Función `classify_job_title()` con cache y normalización
- Función `normalize_job_title()` para normalización consistente
- Cache en memoria con invalidación automática `invalidate_classifier_cache()`
- Campos de protección `buyer_persona_locked` y `buyer_persona_assigned_manually`
- Campo `job_title_normalized` en unified_contacts
- Índices para `job_keywords` y `unified_contacts`
- Endpoint `/api/job-keywords/diagnose` para diagnóstico
- Endpoint `/api/job-keywords/migrate/normalize-job-titles` para backfill
- Endpoint `/api/job-keywords/classifier/stats` para estadísticas
- Tests unitarios en `/backend/tests/test_persona_classifier_service.py` (19 tests)
- Documentación técnica en `/backend/docs/PERSONA_CLASSIFIER_V3.md`

### Changed
- `contacts.py` - Migrado a usar servicio centralizado
- `linkedin_import_worker.py` - Migrado a usar servicio centralizado
- `contact_imports.py` - Migrado a usar servicio centralizado
- `events_v2.py` - Migrado a usar servicio centralizado
- `job_keywords.py` - Migrado todos los endpoints de clasificación y reclasificación
- `prospection.py` - Migrado qualify_contact a usar servicio centralizado
- `database.py` - Agregados índices para Persona Classifier V3

### Removed
- Código duplicado de clasificación en 9 archivos diferentes
- Fallback hardcodeado en contacts.py

---

## [2025-02-20] Import New Connections V2.1

### Added
- Robust date parser para campo "Connected On" (español/inglés)
- TTL index de 90 días para conflicts
- Exponential backoff para retries
- Colecciones de audit: `linkedin_import_invalid_rows`, `linkedin_import_parse_failures`

---

## [2025-02-20] Import New Connections V2

### Added
- Sistema completo de importación LinkedIn basado en APScheduler
- Streaming file processing para archivos grandes
- Bulk database operations con MongoDB bulk_write
- Profile locking para prevenir importaciones concurrentes
- Detección de conflictos email/LinkedIn
- Sistema de reportes integrado con gráficos
