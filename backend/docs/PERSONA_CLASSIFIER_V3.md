# Persona Classifier V3 - Arquitectura Centralizada

## Resumen

Se ha implementado la **Fase 1 y Fase 2** de la arquitectura V3 del clasificador de buyer persona.

**Problema resuelto**: Múltiples implementaciones duplicadas del clasificador, sin normalización consistente, sin protección de overrides manuales, sin reclasificación segura en background.

**Solución**: 
- Fase 1: Servicio centralizado único que todas las partes del sistema usan
- Fase 2: Worker de reclasificación en background con jobs persistentes

---

## Componentes Implementados

### 1. Servicio Centralizado (Fase 1)

**Archivo**: `/backend/services/persona_classifier_service.py`

#### Funciones Principales:

| Función | Descripción | Uso |
|---------|-------------|-----|
| `classify_job_title(db, job_title, use_cache)` | Clasificación completa con todos los detalles | Diagnóstico, UI |
| `classify_job_title_simple(db, job_title, use_cache)` | Retorna solo `buyer_persona_id` | Operaciones bulk |
| `normalize_job_title(job_title)` | Normaliza job title | En todos los puntos de entrada |
| `invalidate_classifier_cache()` | Invalida cache | Después de modificar keywords |

### 2. Worker de Reclasificación (Fase 2)

**Archivo**: `/backend/services/persona_reclassification_worker.py`

#### Características:

- **Tipos de reclasificación**:
  - `all`: Todos los contactos
  - `by_keyword`: Contactos que matchean una keyword específica
  - `by_persona`: Contactos de un buyer persona específico
  - `affected`: Contactos afectados por keywords modificadas

- **Procesamiento robusto**:
  - Batches de 500 contactos
  - `bulk_write` para performance
  - Heartbeat cada 30 segundos
  - Recuperación de jobs huérfanos
  - Máximo 3 intentos

- **Dry-run**: Previsualiza cambios sin aplicarlos

- **Progreso observable**: Porcentaje, contactos procesados, actualizados, errores

- **Respeta locks**: Contactos con `buyer_persona_locked=true` son excluidos

### 3. API Endpoints (Fase 2)

**Router**: `/backend/routers/persona_classifier.py`
**Prefijo**: `/api/persona-classifier`

#### Clasificación:
| Endpoint | Método | Descripción |
|----------|--------|-------------|
| `/classify` | POST | Clasificar un job_title |
| `/diagnose` | POST | Diagnóstico completo |
| `/normalize` | POST | Solo normalización |

#### Reclasificación:
| Endpoint | Método | Descripción |
|----------|--------|-------------|
| `/reclassify/all` | POST | Reclasificar todos |
| `/reclassify/by-keyword` | POST | Por keyword |
| `/reclassify/by-persona` | POST | Por buyer persona |
| `/reclassify/affected` | POST | Por keywords afectadas |
| `/reclassify/estimate` | POST | Estimar impacto |
| `/jobs` | GET | Listar jobs |
| `/jobs/{id}` | GET | Estado de un job |
| `/jobs/{id}/cancel` | POST | Cancelar job |

#### Contactos:
| Endpoint | Método | Descripción |
|----------|--------|-------------|
| `/contacts/{id}/lock` | POST | Bloquear/desbloquear |
| `/contacts/{id}/classification` | GET | Ver clasificación actual |

#### Mantenimiento:
| Endpoint | Método | Descripción |
|----------|--------|-------------|
| `/stats` | GET | Estadísticas completas |
| `/maintenance/normalize-job-titles` | POST | Backfill normalización |
| `/maintenance/ensure-indexes` | POST | Crear índices |
| `/maintenance/invalidate-cache` | POST | Invalidar cache |

---

## Base de Datos

### Nueva Colección: `persona_reclassification_jobs`

```json
{
  "job_id": "uuid",
  "job_type": "all|by_keyword|by_persona|affected",
  "params": {},
  "dry_run": true|false,
  "status": "pending|processing|completed|failed|cancelled",
  "created_by": "user@email.com",
  "created_at": "ISO date",
  "started_at": "ISO date",
  "completed_at": "ISO date",
  "progress": {
    "total_contacts": 1000,
    "processed": 500,
    "updated": 300,
    "skipped_locked": 50,
    "skipped_same": 150,
    "errors": 0,
    "percent": 50.0
  },
  "result": {
    "message": "...",
    "total_changes": 300,
    "sample_changes": [...],
    "persona_breakdown": {"dc_marketing": 100, ...}
  },
  "error": null,
  "attempt": 1,
  "worker_id": "worker_123",
  "heartbeat_at": "ISO date"
}
```

### Nuevos Campos en `unified_contacts`

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `buyer_persona_locked` | bool | Previene reclasificación |
| `buyer_persona_assigned_manually` | bool | Marca clasificación manual |
| `job_title_normalized` | string | Job title normalizado |
| `reclassified_at` | string | Fecha de última reclasificación |
| `reclassified_by_job` | string | Job ID que reclasificó |

---

## APScheduler Jobs

| Job ID | Intervalo | Descripción |
|--------|-----------|-------------|
| `linkedin_import_worker` | 10 segundos | Procesa imports LinkedIn |
| `persona_reclassification_worker` | 30 segundos | Procesa reclasificaciones |

---

## Flujo de Reclasificación

```
┌─────────────────────────────────────────────────────────────────┐
│                    UI: Assets > Persona Classifier              │
│                                                                  │
│  [Estimar Impacto] → [Crear Job (dry_run=true)] → [Ver Preview] │
│                                ↓                                 │
│                    [Crear Job (dry_run=false)]                   │
└─────────────────────────────────┬───────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────┐
│              persona_reclassification_jobs (MongoDB)             │
│                    status: "pending"                             │
└─────────────────────────────────┬───────────────────────────────┘
                                  │
                                  ▼ (cada 30 segundos)
┌─────────────────────────────────────────────────────────────────┐
│         persona_reclassification_worker (APScheduler)            │
│                                                                  │
│  1. find_next_job() - atomic lock                               │
│  2. build_contact_query() - según job_type                      │
│  3. Process in batches of 500                                   │
│     - classify_job_title_simple() para cada contacto            │
│     - bulk_write() para actualizar                              │
│  4. update_progress() con heartbeat                             │
│  5. complete_job() o fail_job()                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Tests

| Suite | Tests | Estado |
|-------|-------|--------|
| TestPersonaClassifierService | 19 | ✅ Pass |
| TestPersonaReclassificationWorker | 11 | ✅ Pass |

**Total**: 30 tests pasando

---

## Uso Recomendado

### 1. Antes de modificar keywords en masa:

```bash
# 1. Estimar impacto
POST /api/persona-classifier/reclassify/estimate?job_type=all

# 2. Dry run
POST /api/persona-classifier/reclassify/all
{
  "dry_run": true
}

# 3. Ver resultado
GET /api/persona-classifier/jobs/{job_id}

# 4. Si todo ok, ejecutar real
POST /api/persona-classifier/reclassify/all
{
  "dry_run": false
}
```

### 2. Después de modificar una keyword:

```bash
POST /api/persona-classifier/reclassify/affected
{
  "keywords": ["marketing", "digital"],
  "dry_run": false
}
```

---

## Próximos Pasos (Fase 3 y 4)

### Fase 3: UI Persona Classifier
- Vista de árbol: Buyer Persona → Keywords
- Panel de diagnóstico por contacto
- Panel de reclasificación con progreso en tiempo real

### Fase 4: Métricas Preagregadas
- Colección `persona_classifier_metrics`
- Worker cada 6 horas
- Dashboard con tendencias
