# FOCUS1 — Versión Titanio (v1.0.0)

> Codename: **Titanio** — Base sólida, primer estado estable en producción con auto-deploy configurado.

---

## Índice

1. [Descripción del Sistema](#1-descripción-del-sistema)
2. [Arquitectura](#2-arquitectura)
3. [Infraestructura y Deployment](#3-infraestructura-y-deployment)
4. [Módulos Implementados](#4-módulos-implementados)
5. [Base de Datos](#5-base-de-datos)
6. [APIs Principales](#6-apis-principales)
7. [Sistema de Semáforos (Traffic Light)](#7-sistema-de-semáforos-traffic-light)
8. [Integraciones Externas](#8-integraciones-externas)
9. [Fixes Incluidos en Titanio](#9-fixes-incluidos-en-titanio)
10. [Estado al Momento del Tag](#10-estado-al-momento-del-tag)
11. [Variables de Entorno](#11-variables-de-entorno)
12. [Repos Relacionados](#12-repos-relacionados)
13. [Versionado](#13-versionado)

---

## 1. Descripción del Sistema

**FOCUS1** es un CRM operativo propietario de Leaderlix diseñado para gestionar el ciclo comercial completo:

```
PROSPECT → NURTURE → CLOSE → DELIVER → REPURCHASE
```

No es un CRM genérico. Está construido alrededor de un sistema de **semáforos de productividad** que indica en tiempo real si cada etapa del proceso comercial se está ejecutando correctamente esa semana.

**Usuarios objetivo:** equipo interno de Leaderlix (GB, MG y colaboradores).
**Autenticación:** Google OAuth restringido a cuentas `@leaderlix.com`.

---

## 2. Arquitectura

```
frontend/          React 18 + Shadcn UI + Tailwind CSS
backend/           FastAPI + Motor (async MongoDB)
                   APScheduler para jobs en background
database           MongoDB Atlas (colección: leaderlix)
```

### Stack técnico

| Capa | Tecnología |
|------|-----------|
| Frontend | React 18, Radix UI, Shadcn/UI, Tailwind CSS, CRACO |
| Backend | FastAPI, Motor (async), APScheduler, Pydantic |
| Base de datos | MongoDB Atlas |
| Auth | Google OAuth2 (restringido a @leaderlix.com) |
| Package manager | Yarn 1.22 (frontend), pip (backend) |
| Node | v22 |
| Python | 3.13 |

---

## 3. Infraestructura y Deployment

### Railway — Proyecto: `patient-spontaneity`

| Servicio | Descripción | Repo conectado | Root dir |
|---------|-------------|----------------|----------|
| `FOCUS1-Frontend` | React SPA | `gdbetancourt/focus-web-app` | `frontend/` |
| `FOCUS1-Antigravity` | FastAPI Backend | `gdbetancourt/FOCUS1-Antigravity` | `backend/` |

### URLs de producción

- **Frontend:** https://focus1-frontend-production.up.railway.app
- **Backend:** https://focus1-antigravity-production.up.railway.app
- **API base:** `https://focus1-antigravity-production.up.railway.app/api/`

### Build config (railway.toml)

```toml
[build]
buildCommand = "cd frontend && yarn install && yarn build"

[deploy]
startCommand = "npx serve -s frontend/build -l ${PORT:-3000}"
```

El servicio frontend tiene `rootDirectory: frontend` configurado en Railway, con `yarn install && yarn build` como build command y `npx serve -s build -l $PORT` como start command.

### Auto-deploy

- Cualquier push a la rama `main` de `gdbetancourt/focus-web-app` dispara redeploy del frontend automáticamente.
- El backend (`FOCUS1-Antigravity`) tiene su propio repo y su propio trigger en `main`.

### Deployments estables (Titanio)

| Servicio | Deploy ID | Status |
|---------|-----------|--------|
| Frontend | `d6b3ae9d` | SUCCESS |
| Backend | `7dc8ffcf` | SUCCESS |

---

## 4. Módulos Implementados

### 4.1 PROSPECT

#### Find (1.1)
- **1.1.1 Via LinkedIn** — Búsqueda de contactos por moléculas, posts y posición. Scrapers con Apify.
  - By Molecules (1.1.1.1)
  - By Post (1.1.1.2)
  - By Position (1.1.1.3)
- **1.1.2 Via Google Maps** — Coming Soon

#### Attract (1.2)
- Viral Videos, Long Form Video, GEO, SEO — Coming Soon (⚫ GRAY)

#### Connect (1.3)
- **1.3.1 Deal Makers** — Checkbox semanal por buyer persona (10 perfiles)
- **1.3.2 Max LinkedIn Invitations** — Gestión de invitaciones masivas por perfil (GB, MG)
  - Grupos colapsables por perfil
  - Contador ready/total por grupo
  - Ice-breaker personalizado
- **1.3.3 Small Business WhatsApp** — Checkbox o 0 pendientes
- **1.3.4 Social Media Followers** — Coming Soon

### 4.2 NURTURE

#### Individual (2.1)
- **2.1.1 Import LinkedIn Connections** — Importación de CSV de LinkedIn
  - APScheduler-based job queue
  - Streaming processing (archivos de 10k+ filas)
  - MongoDB bulk_write (batch de 500)
  - Profile locking (previene importaciones concurrentes)
  - Detección de conflictos email/LinkedIn
  - Buyer Persona auto-clasificación al importar
  - V2.1: Company linking bulk-safe, TTL 90 días, retry con backoff, date parser ES/EN
- **2.1.2 Booklets & Cases** — Coming Soon
- **2.1.3 Nurture Deal Makers** — Stage 2 nurture ratio

#### Bulk (2.2)
- **2.2.2 Campaigns** — Gestión de campañas activas
- **2.2.3 Testimonials** — Goal: ≥5 testimonios
- **2.2.6 Blog** — Posts publicados + Content AI (Gemini 2.0 Flash)
- **2.2.7 Media Relations** — Eventos con tareas vencidas
- **2.2.8 Editorial Relations** — Eventos editoriales
- **2.2.10 Own Events** — Gestión de eventos propios
- **2.2.11 Medical Society Events** — Eventos de sociedades médicas
- Newsletters, LMS, Long Form Videos — Coming Soon

### 4.3 CLOSE
- **3.1 Venue Finder** — Directorio de venues para eventos
- **3.2 Quote Deal Makers** — Cotizaciones recientes
- **3.3 Close Deal Makers** — Contactos en negociación

### 4.4 DELIVER
- **4.0 WhatsApp Confirmations** — Google Calendar integrado
- **4.1 Deliver Deal Makers** — Contactos en entrega
- **4.2 Coach Students** — Time entries semanales
- **4.3 Certificate Students** — Certificados pendientes vs emitidos

### 4.5 ASSETS (Transversal)

- **Companies** — Gestión de empresas (unified_companies)
  - Lista agrupada por industrias (Outbound / Inbound)
  - Catálogo de Industrias integrado con CRUD + merge
  - Auto-Merge de duplicados por dominio/nombre similar
  - Buscador por nombre, dominio, alias
- **Contacts** — 103,251 contactos unificados (unified_contacts)
- **Buyer Personas DB** — Configuración de buyer personas y keywords
- **Persona Classifier V3**
  - Servicio centralizado de clasificación por job_title
  - Worker de reclasificación en background (batch 500, bulk_write)
  - Métricas preagregadas cada 6 horas
  - UI: Keywords, Diagnóstico, Reclasificar, Estadísticas
- **Pre-Projects** — Proyectos en preparación
- **Current Cases** — Casos activos / deals
- **Qualify New Contacts** — Calificación de contactos outbound pendientes (~5,495 pendientes)
- **Merge Companies** — Fusión de empresas duplicadas
- **Merge Duplicates** — Fusión de contactos duplicados

---

## 5. Base de Datos

### MongoDB Atlas — Database: `leaderlix`

#### Colecciones principales

| Colección | Descripción |
|-----------|-------------|
| `unified_contacts` | 103,251 contactos (fuente canónica) |
| `unified_companies` | 21,970 empresas (291 outbound, 21,679 inbound) |
| `linkedin_import_jobs` | Jobs de importación LinkedIn |
| `linkedin_import_conflicts` | Conflictos de importación (TTL 90 días) |
| `linkedin_import_locks` | Locks por perfil |
| `buyer_personas` | Definición de buyer personas |
| `job_keywords` | Keywords por buyer persona para clasificación |
| `buyer_persona_priorities` | Prioridades de clasificación |
| `persona_classifier_metrics` | Métricas preagregadas (retención 90 días) |
| `merge_candidates_cache` | Cache de duplicados (refresh diario 3 AM UTC) |
| `weekly_tasks` | Checkboxes semanales de semáforos |
| `campaigns` | Campañas de email/marketing |
| `events` | Eventos de marketing |
| `testimonials` | Testimonios |
| `blog_posts` | Posts de blog |
| `venues` | Venues para eventos |
| `quotes` | Cotizaciones |
| `time_entries` | Entradas de tiempo |
| `certificates` | Certificados estudiantiles |

#### Reglas de clasificación (Inbound/Outbound)

1. Default: `inbound`
2. Cambio a `outbound`: solo manual O por herencia de industria
3. Cambio a `inbound`: solo manual (sin auto-reversión)
4. Regla de contacto: outbound si AL MENOS UNA empresa es outbound

---

## 6. APIs Principales

Base URL: `https://focus1-antigravity-production.up.railway.app/api`

### Autenticación
Todas las rutas requieren cookie `session_token` (Google OAuth).

### Endpoints clave

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/` | Health check — `{"message": "Leaderlix Automation API", "version": "2.1.0"}` |
| GET | `/focus/traffic-light-status` | Semáforos de todas las secciones Focus |
| GET | `/scheduler/traffic-light` | Semáforos de todas las secciones (formato detallado) |
| GET | `/unified-companies` | Lista empresas |
| PATCH | `/unified-companies/{id}` | Editar empresa |
| PATCH | `/unified-companies/{id}/classification` | Cambiar clasificación |
| POST | `/unified-companies/{id}/propagate-classification` | Propagar a contactos |
| GET | `/industries-v2` | Industrias paginadas (params: limit, skip) |
| POST | `/industries-v2/merge` | Fusionar industrias |
| GET | `/contacts` | Lista contactos |
| POST | `/linkedin-import/upload` | Subir CSV LinkedIn |
| GET | `/linkedin-import/progress/{job_id}` | Progreso de importación |
| GET | `/persona-classifier/stats` | Stats del clasificador |
| POST | `/persona-classifier/reclassify/all` | Reclasificar todos |
| GET | `/companies/merge-candidates/cache-status` | Estado cache de duplicados |
| POST | `/companies/merge-candidates/refresh-cache` | Refrescar cache |

---

## 7. Sistema de Semáforos (Traffic Light)

El sistema central de productividad. Cada sección del menú tiene un semáforo que indica el estado semanal.

### Colores

| Color | Significado |
|-------|-------------|
| 🟢 VERDE | Meta cumplida, tareas completadas |
| 🟡 AMARILLO | Requiere atención, parcialmente completado |
| 🔴 ROJO | Crítico, vencido, sin actividad |
| ⚫ GRIS | No implementado (Coming Soon) |

### Lógica de propagación (padre ← hijos)

- GRIS si TODOS los hijos son GRIS
- ROJO si CUALQUIER hijo es ROJO
- AMARILLO si CUALQUIER hijo es AMARILLO (y ninguno rojo)
- VERDE solo si TODOS los hijos son VERDE

### Código fuente

- Backend: `backend/routers/scheduler.py` (líneas 507-850+)
- Frontend config: `frontend/src/components/Layout.jsx`
- Focus sections: `frontend/src/components/focus/focusSections.js`

---

## 8. Integraciones Externas

| Servicio | Propósito | Estado |
|---------|-----------|--------|
| MongoDB Atlas | Base de datos principal | ✅ Activo |
| Google OAuth2 | Autenticación (@leaderlix.com) | ✅ Activo |
| Google Calendar | WhatsApp Confirmations | ✅ Activo |
| Google Drive | Almacenamiento de archivos | ✅ Activo |
| Amazon SES | Emails / newsletters / certificados | ⚠️ Sandbox (200/día) |
| Apify | Scraping de LinkedIn / Apollo | ✅ Activo |
| HubSpot | Sync de CRM (legacy, migrado) | ⚠️ Endpoints deprecated |
| Cloudflare Turnstile | Anti-bot en formularios públicos | ✅ Activo |
| Google Analytics | Tracking sitio web (G-222876294) | ✅ Activo |

---

## 9. Fixes Incluidos en Titanio

### Commits desde el origen hasta v1.0.0

| Commit | Descripción |
|--------|-------------|
| `82ce198` | fix(invitations): canonical outbound by company_id, elimina colisiones por nombre |
| `44fde86` | fix(deploy): vendor emergent shim y elimina dependencia pypi rota |
| `8c0be94` | fix(backend): restaura router de scrappers y elimina apify token hardcodeado |
| `df6eae2` | fix(company-editor): selector de industrias usa /industries-v2 + Radix UI Select |
| `bacd0f6` | fix(frontend-deploy): railway.toml para build detection estable en Railway |

### Fix principal: Industries selector (df6eae2)

**Problema:** `CompanyEditorDialog.jsx` cargaba industrias con `value: i.code || i.id`, pero las empresas almacenan industrias como nombres (strings). El filtro `!industries.includes(ind.value)` nunca hacía match → mostraba "No hay más industrias disponibles" siempre.

**Solución:**
- Endpoint cambiado de `/industries/` a `/industries-v2` con paginación (batch 500)
- `value` cambiado a `i.name.trim()` para ser canónico
- `<select>` HTML reemplazado por Radix UI `<Select>` (consistente con el resto del sistema)
- Fallback al endpoint legacy si `/industries-v2` falla

---

## 10. Estado al Momento del Tag

### Semáforos verificados

| Sección | Estado |
|---------|--------|
| Marketing Event Planning | 🟢 VERDE |
| Pre-Projects | 🟢 VERDE |
| Current Cases | 🟢 VERDE |
| By Molecules (1.1.1.1) | 🟢 235 contactos esta semana |
| By Post (1.1.1.2) | 🟢 473 contactos esta semana |
| By Position (1.1.1.3) | 🔴 0 contactos |
| Import LinkedIn (2.1.1) | 🟢 |
| Campaigns (2.2.2) | 🟢 |

### Datos en BD

- **Contactos:** 103,251 en `unified_contacts`
- **Empresas:** 21,970 en `unified_companies` (291 outbound)
- **Industrias:** Catálogo completo en `industries` (v1) e `industries_v2`
- **Qualify pendientes:** ~5,495 contactos outbound pendientes de calificación

### Endpoints verificados (devuelven 401 = ruta existe, auth requerida)

- `GET /events-v2/` ✅
- `GET /events-v2/traffic-light` ✅
- `GET /buyer-personas-db/` ✅
- `GET /industries/` ✅
- `POST /bulk-event-invitations/mark-invited` ✅
- `GET /focus/traffic-light-status` ✅

---

## 11. Variables de Entorno

Todas en el `.env` del backend (Railway → Variables):

| Variable | Propósito |
|----------|-----------|
| `MONGO_URL` | MongoDB Atlas connection string |
| `DB_NAME` | Nombre de la BD (leaderlix) |
| `SECRET_KEY` | JWT signing key |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret |
| `AWS_ACCESS_KEY_ID` | Amazon SES |
| `AWS_SECRET_ACCESS_KEY` | Amazon SES |
| `AWS_REGION` | AWS region (us-east-2) |
| `SENDER_EMAIL` | Correo SES verificado (contact@leaderlix.com) |
| `HUBSPOT_TOKEN` | HubSpot CRM token |
| `APIFY_TOKEN` | Apify scraping API |
| `EMERGENT_LLM_KEY` | Gemini/GPT via Emergent AI |

---

## 12. Repos Relacionados

| Repo | Propósito |
|------|-----------|
| `gdbetancourt/focus-web-app` | **Repo principal** — Frontend + config Railway |
| `gdbetancourt/FOCUS1-Antigravity` | Backend FastAPI (repo separado, deploy independiente) |
| `gdbetancourt/FOCUS1-Backup-Despues-de-Reestructura` | Snapshot completo del workspace del agente anterior (incluye memoria, reportes, scripts) — solo referencia |

---

## 13. Versionado

### Convención de nombres: Elementos

| Tag | Codename | Estado |
|-----|----------|--------|
| `v1.0.0` | **Titanio** | ✅ Producción |
| `v1.1.0` | **Cobalto** | En desarrollo (`develop` branch) |
| `v1.2.0` | **Neón** | Planeado |
| `v2.0.0` | **Argón** | Planeado (cambio mayor) |

### Flujo de trabajo

```bash
# Iniciar nuevo feature
git checkout -b feature/nombre-del-cambio

# Trabajar y subir
git push origin feature/nombre-del-cambio

# Cuando está listo → merge a main → auto-deploy Railway
git checkout main
git merge feature/nombre-del-cambio
git push origin main

# Tagear nueva versión
git tag v1.1.0 -m "v1.1.0 - Cobalto - [descripción]"
git push origin v1.1.0
```

### Rollback a Titanio

```bash
git checkout v1.0.0
# o para redeploy en Railway:
# Railway Dashboard → Deployments → d6b3ae9d → Redeploy
```

---

*Documento generado: 2026-02-24 | Versión: Titanio (v1.0.0)*
