# FOCUS - Documento Exhaustivo de Funcionalidades
## Versión: Enero 2025

---

# ÍNDICE
1. [Arquitectura General](#arquitectura-general)
2. [Sistema de Autenticación](#sistema-de-autenticación)
3. [Sistema Unificado de Contactos](#sistema-unificado-de-contactos)
4. [PASO 1: PROSPECT](#paso-1-prospect)
5. [PASO 2: NURTURE](#paso-2-nurture)
6. [PASO 3: CLOSE](#paso-3-close)
7. [PASO 4: DELIVER](#paso-4-deliver)
8. [PASO 5: REPURCHASE](#paso-5-repurchase)
9. [FOUNDATIONS](#foundations)
10. [INFOSTRUCTURE](#infostructure)
11. [SETTINGS](#settings)
12. [Integraciones Externas](#integraciones-externas)
13. [Base de Datos](#base-de-datos)

---

# ARQUITECTURA GENERAL

## Stack Tecnológico
- **Frontend:** React 18 + Tailwind CSS + Shadcn/UI
- **Backend:** FastAPI (Python)
- **Base de Datos:** MongoDB Atlas
- **Integraciones:** Apify, HubSpot (legacy), Gmail OAuth, GPT-4o-mini

## Estructura de Navegación
```
1. Prospect (Prospección)
2. Nurture (Nutrición)
3. Close (Cierre)
4. Deliver (Entrega)
5. Repurchase (Recompra)
6. Foundations (Fundamentos)
7. Infostructure (Infraestructura de información)
8. Settings (Configuración)
```

---

# SISTEMA DE AUTENTICACIÓN

## Funcionalidades Implementadas
- ✅ Login con email/contraseña
- ✅ JWT tokens para sesiones
- ✅ Rutas protegidas
- ✅ Logout

## Endpoints
- `POST /api/auth/login` - Autenticación
- `POST /api/auth/register` - Registro
- `GET /api/auth/me` - Usuario actual

## Credenciales de Prueba
- Email: `perla@leaderlix.com`
- Password: `Leaderlix2025`

---

# SISTEMA UNIFICADO DE CONTACTOS

## Descripción
Base de datos única para todos los contactos de la empresa, sin duplicados, con sistema de etapas (stages).

## Colección: `unified_contacts`

### Esquema Completo
```javascript
{
  "id": "uuid",
  "name": "string",           // Nombre completo
  "email": "string",          // Email de contacto
  "phone": "string",          // Teléfono
  "linkedin_url": "string",   // URL de LinkedIn
  
  "stage": 1-5,               // Etapa actual (solo UNA)
  // 1 = Prospect
  // 2 = Nurture
  // 3 = Close
  // 4 = Deliver
  // 5 = Repurchase
  
  "company": "string",        // Empresa donde trabaja
  "job_title": "string",      // Cargo/Puesto
  "buyer_persona": "string",  // Código de buyer persona
  "status": "string",         // new, contacted, qualified, etc.
  "location": "string",       // Ubicación geográfica
  
  "tags": [                   // Etiquetas de oportunidades de negocio
    {
      "id": "uuid",
      "name": "string",       // Ej: "Pfizer oncology director Mexico"
      "type": "string",       // search, opportunity, manual
      "created_at": "datetime",
      "details": {}
    }
  ],
  
  "source": "string",         // Origen del contacto
  "source_details": {},       // Detalles adicionales del origen
  "created_at": "datetime",
  "updated_at": "datetime",
  "notes": "string"
}
```

## Endpoints de Contactos
| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/api/contacts` | Listar contactos con filtros |
| GET | `/api/contacts/by-stage/{stage}` | Contactos por etapa |
| GET | `/api/contacts/stats` | Estadísticas por etapa |
| GET | `/api/contacts/{id}` | Obtener un contacto |
| POST | `/api/contacts` | Crear contacto |
| PUT | `/api/contacts/{id}` | Actualizar contacto |
| PUT | `/api/contacts/{id}/stage` | Mover a otra etapa |
| POST | `/api/contacts/{id}/tags` | Agregar tag/oportunidad |
| DELETE | `/api/contacts/{id}/tags/{tag_id}` | Eliminar tag |
| DELETE | `/api/contacts/{id}` | Eliminar contacto |
| POST | `/api/contacts/migrate` | Migrar deal_makers existentes |

## Verificación de Duplicados
- Por `linkedin_url`
- Por `email`
- Si existe, solo se agrega nuevo tag

---

# PASO 1: PROSPECT

## Propósito
Generación de leads y prospección de nuevos contactos a través de múltiples fuentes.

## Subrutas

### 1.1 Add New Deal Makers (`/prospect/1-1-deal-makers`)
**Archivo:** `DealMakers.jsx`

**Funcionalidades:**
- ✅ Dashboard central de todos los contactos de LinkedIn descubiertos
- ✅ Agrupación por Buyer Persona
- ✅ Filtros por status (New, Contacted, Qualified)
- ✅ Vista agrupada / lista / URLs
- ✅ Copiar URLs de LinkedIn para importación masiva
- ✅ Asignar Buyer Persona a contactos
- ✅ Cambiar status de contactos

**Endpoints usados:**
- `GET /api/scrappers/deal-makers`
- `PUT /api/scrappers/deal-makers/{id}/status`
- `PUT /api/scrappers/deal-makers/{id}/persona`
- `GET /api/buyer-personas-db/`

---

### 1.2 Find by Molecules (`/prospect/1-2-molecules-deal-makers`)
**Archivo:** `MoleculesDealMakers.jsx`

**Propósito:** Buscar decision makers de LinkedIn basándose en moléculas/medicamentos farmacéuticos.

**Funcionalidades:**
- ✅ Lista de 200 moléculas de la base de datos
- ✅ Filtro por Área Terapéutica
- ✅ Filtro por Compañía
- ✅ Botón "Find DMs" para iniciar búsqueda por molécula
- ✅ Historial de búsquedas recientes
- ✅ Integración con Apify LinkedIn

**Endpoints usados:**
- `GET /api/scrappers/pharma/medications`
- `GET /api/scrappers/pharma/therapeutic-areas`
- `POST /api/scrappers/search/molecules-deal-makers`
- `GET /api/scrappers/logs/runs`

**Filtro de México:**
- La búsqueda incluye "Mexico" en el query
- Post-procesamiento filtra solo perfiles con ubicación en México

---

### 1.3 Find by Post (`/prospect/1-3-posts-deal-makers`)
**Archivo:** `PostsDealMakers.jsx`

**Propósito:** Buscar autores de posts de LinkedIn por palabras clave.

**Funcionalidades:**
- ✅ Gestión de palabras clave de búsqueda
- ✅ Búsqueda de posts de LinkedIn
- ✅ Extracción de autores como deal makers
- ✅ Filtro a México

**Endpoints usados:**
- `POST /api/scrappers/search/deal-makers-by-post`
- `GET /api/scrappers/linkedin-post-keywords`
- `POST /api/scrappers/linkedin-post-keywords`

---

### 1.4 Find by Position (`/prospect/1-4-position-deal-makers`)
**Archivo:** `PositionDealMakers.jsx`

**Propósito:** Buscar perfiles de LinkedIn por cargo/título de trabajo.

**Funcionalidades:**
- ✅ Búsqueda por cargo (CMO, VP BD, Director of Licensing, etc.)
- ✅ Palabras clave rápidas desde Buyer Personas
- ✅ Búsqueda masiva de todos los job_titles de Buyer Personas
- ✅ Historial de búsquedas
- ✅ Lista de Buyer Personas con sus job_titles

**Endpoints usados:**
- `POST /api/scrappers/search/deal-makers-by-position`
- `GET /api/buyer-personas-db/`
- `GET /api/scrappers/logs/runs`

---

### 1.5 Find Small Business (`/prospect/1-5-small-business`)
**Archivo:** `SmallBusinessFinder.jsx`

**Propósito:** Buscar negocios locales usando Google Maps.

**Funcionalidades:**
- ✅ Búsqueda por tipo de negocio + ciudad
- ✅ Categorías preconfiguradas (Pharma, Medical Devices, Healthcare, etc.)
- ✅ Ciudades mexicanas preconfiguradas
- ✅ Quick searches combinando tipo + ciudad
- ✅ Historial de búsquedas
- ✅ Exportar resultados a CSV
- ✅ Filtro por ciudad en resultados
- ✅ Cards con nombre, rating, dirección, teléfono, website

**Endpoints usados:**
- `POST /api/scrappers/search/small-business`
- `GET /api/scrappers/small-business`
- `GET /api/scrappers/logs/runs`

---

### 1.6 Contacts Stage 1 (`/prospect/contacts`)
**Archivo:** `ProspectContacts.jsx`

**Propósito:** Ver todos los contactos unificados en etapa de Prospección.

**Funcionalidades:**
- ✅ Lista de contactos con búsqueda
- ✅ Vista expandible con detalles
- ✅ Tags de oportunidades visibles
- ✅ Mover contacto a otra etapa
- ✅ Agregar nuevo contacto
- ✅ Editar/Eliminar contacto
- ✅ Link a LinkedIn
- ✅ Conteo de contactos

---

# PASO 2: NURTURE

## Propósito
Nutrición de leads a través de contenido, eventos y campañas.

## Subrutas

### 2.1 Contacts Stage 2 (`/nurture/contacts`)
**Archivo:** `NurtureContacts.jsx`

**Funcionalidades:** (mismas que Stage 1)
- ✅ Lista de contactos en etapa de nurturing
- ✅ Mover entre etapas
- ✅ Tags de oportunidades

---

### 2.2 Content Flow (`/nurture/content-flow`)
**Archivo:** `ContentFlow.jsx`

**Propósito:** Gestión de contenido en formato Kanban.

**Funcionalidades:**
- ✅ Vista Kanban por etapas de contenido
- ✅ Crear nuevo contenido
- ✅ Editar contenido
- ✅ Mover contenido entre columnas (drag & drop)
- ✅ Filtro por competencia
- ✅ Filtro por nivel
- ✅ Importar desde ClickUp
- ✅ Estadísticas de contenido

**Etapas del Kanban:**
1. Ideas
2. Research
3. Writing
4. Design
5. Review
6. Published

**Esquema de Contenido:**
```javascript
{
  "title": "string",
  "description": "string",
  "stage": "string",
  "competence": "string",
  "level": "string",
  "format": "string",     // blog, video, webinar, etc.
  "author": "string",
  "due_date": "datetime",
  "tags": []
}
```

**Endpoints:**
- `GET /api/content/contents`
- `GET /api/content/contents/kanban`
- `POST /api/content/contents`
- `PUT /api/content/contents/{id}`
- `PUT /api/content/contents/{id}/move`
- `DELETE /api/content/contents/{id}`
- `GET /api/content/stats`
- `POST /api/content/import-from-clickup`

---

### 2.3 Webinars/Events (`/nurture/events`)
**Archivo:** `Events.jsx`

**Propósito:** Gestión de webinars y eventos.

**Funcionalidades:**
- ✅ Listar eventos próximos y pasados
- ✅ Crear nuevo evento
- ✅ Editar evento
- ✅ Eliminar evento
- ✅ Ver asistentes por evento
- ✅ Generar contenido con IA
- ✅ Mover contacto a Cierre desde evento
- ✅ Checklist de tareas por evento

**Esquema de Evento:**
```javascript
{
  "name": "string",
  "date": "datetime",
  "type": "string",        // webinar, workshop, conference
  "description": "string",
  "speaker": "string",
  "location": "string",
  "status": "string",      // draft, published, completed
  "attendees": [],
  "generated_content": {}
}
```

**Generación de Contenido con IA:**
- Título del evento
- Descripción
- Posts para LinkedIn
- Emails de invitación
- Resumen post-evento

**Endpoints:**
- `GET /api/events`
- `GET /api/events/{id}`
- `POST /api/events`
- `PUT /api/events/{id}`
- `DELETE /api/events/{id}`
- `POST /api/events/{id}/generate-content`
- `GET /api/events/{id}/contacts`
- `GET /api/events/checklist`
- `GET /api/events/public` (ruta pública)

---

### 2.4 Campaigns (`/nurture/campaigns`)
**Archivo:** `Campaigns.jsx`

**Propósito:** Gestión y envío de campañas de email.

**Funcionalidades:**
- ✅ Crear campaña de email
- ✅ Seleccionar template
- ✅ Seleccionar eventos relacionados
- ✅ Seleccionar contactos destinatarios
- ✅ Preview de email generado con IA
- ✅ Programar envío (horarios de negocio)
- ✅ Ver estadísticas de envío
- ✅ Tracking de aperturas y clics

**Sistema de Scheduling:**
- Envíos escalonados (15 segundos entre emails)
- Horarios de negocio (9:00 - 18:00, L-V)
- Máximo 30 emails por sesión

**Esquema de Campaña:**
```javascript
{
  "name": "string",
  "template_id": "string",
  "event_ids": [],
  "contact_ids": [],
  "status": "string",    // draft, scheduled, sending, completed
  "scheduled_at": "datetime",
  "emails_sent": 0,
  "emails_opened": 0,
  "emails_clicked": 0
}
```

**Endpoints:**
- `GET /api/campaigns`
- `GET /api/campaigns/{id}`
- `POST /api/campaigns`
- `DELETE /api/campaigns/{id}`
- `POST /api/campaigns/{id}/prepare-emails`
- `POST /api/campaigns/{id}/approve`
- `POST /api/campaigns/{id}/force-send`
- `GET /api/campaigns/{id}/schedule`
- `POST /api/email-preview`

---

### 2.5 Venue Finder (`/nurture/venue-finder`)
**Archivo:** `VenueFinder.jsx`

**Propósito:** Aplicación embebida para buscar venues.

**Funcionalidades:**
- ✅ iFrame embebido de la aplicación de venue finder externa

---

### 2.6 Import CSV (`/nurture/import`)
**Archivo:** `CSVImporter.jsx`

**Propósito:** Importar contactos desde archivos CSV.

**Funcionalidades:**
- ✅ Subir archivo CSV
- ✅ Mapeo de columnas
- ✅ Preview de datos
- ✅ Importación a la base de datos
- ✅ Historial de importaciones

**Endpoints:**
- `POST /api/import/csv`
- `GET /api/import/history`

---

### 2.7 Event Stats (`/nurture/stats`)
**Archivo:** `EventStats.jsx`

**Propósito:** Estadísticas de eventos.

**Funcionalidades:**
- ✅ Eventos por mes
- ✅ Asistentes totales
- ✅ Tasa de conversión
- ✅ Gráficos de tendencias

**Endpoints:**
- `GET /api/event-stats`

---

### 2.8 History (`/nurture/history`)
**Archivo:** `History.jsx`

**Propósito:** Historial de actividades.

**Funcionalidades:**
- ✅ Logs de emails enviados
- ✅ Movimientos de deals
- ✅ Filtros por fecha

**Endpoints:**
- `GET /api/email-logs`
- `GET /api/deal-movements`

---

### 2.9 Templates (`/nurture/templates`)
**Archivo:** `Templates.jsx`

**Propósito:** Gestión de templates de email.

**Funcionalidades:**
- ✅ Crear template
- ✅ Editar template
- ✅ Eliminar template
- ✅ Preview de template
- ✅ Variables dinámicas (nombre, empresa, evento, etc.)

**Esquema de Template:**
```javascript
{
  "name": "string",
  "subject": "string",
  "body": "string",       // HTML con variables
  "category": "string"
}
```

**Endpoints:**
- `GET /api/templates`
- `GET /api/templates/{id}`
- `POST /api/templates`
- `PUT /api/templates/{id}`
- `DELETE /api/templates/{id}`

---

# PASO 3: CLOSE

## Propósito
Cierre de ventas y cotizaciones.

## Subrutas

### 3.1 Contacts Stage 3 (`/close/contacts`)
**Archivo:** `CloseContacts.jsx`

**Funcionalidades:** (mismas que otras etapas)
- ✅ Contactos en etapa de cierre

---

### 3.2 Prospects/Cierre (`/close/prospects`)
**Archivo:** `Cierre.jsx`

**Propósito:** Pipeline de cierre de ventas.

**Funcionalidades:**
- ✅ Listar prospectos en etapa de cierre
- ✅ Vista de pipeline (movidos desde eventos)
- ✅ Cambiar status del prospecto
- ✅ Ver historial de movimientos
- ✅ Link a cotizador

**Status de Cierre:**
- Interesado
- En negociación
- Propuesta enviada
- Ganado
- Perdido

**Endpoints:**
- `GET /api/cierre/contacts`
- `PUT /api/cierre/{id}/status`
- `GET /api/cierre/movements`
- `POST /api/contacts/{id}/move-to-cierre`

---

### 3.3 Quoter/Cotizador (`/close/quoter`)
**Archivo:** `Cotizador.jsx`

**Propósito:** Generación de cotizaciones.

**Funcionalidades:**
- ✅ Calcular precio de coaching individual
- ✅ Calcular precio de coaching grupal
- ✅ Composición del grupo (ejecutivos, directores, etc.)
- ✅ Selección de beneficios adicionales
- ✅ Selección de ejes temáticos
- ✅ Tipo de cambio USD/MXN actualizado
- ✅ Precios en MXN y USD
- ✅ Generar PDF de cotización
- ✅ Guardar cotización
- ✅ Historial de cotizaciones

**Composición del Grupo:**
```javascript
{
  "executives": 0,        // $5,000 USD
  "directors": 0,         // $2,500 USD
  "managers": 0,          // $2,000 USD
  "coordinators": 0,      // $1,500 USD
  "analysts": 0           // $1,250 USD
}
```

**Esquema de Cotización:**
```javascript
{
  "client_name": "string",
  "company": "string",
  "type": "string",            // individual, group
  "group_composition": {},
  "benefits": [],
  "thematic_axes": [],
  "total_mxn": 0,
  "total_usd": 0,
  "exchange_rate": 0,
  "status": "string",          // draft, sent, accepted, rejected
  "pdf_url": "string"
}
```

**Endpoints:**
- `GET /api/cotizador/exchange-rate`
- `GET /api/cotizador/catalog/benefits`
- `GET /api/cotizador/catalog/thematic-axes`
- `GET /api/cotizador/contacts/cierre`
- `POST /api/cotizador/calculate`
- `POST /api/cotizador/quotes`
- `GET /api/cotizador/quotes`
- `GET /api/cotizador/quotes/{id}`
- `PUT /api/cotizador/quotes/{id}/status`
- `GET /api/cotizador/quotes/{id}/pdf`
- `DELETE /api/cotizador/quotes/{id}`

---

# PASO 4: DELIVER

## Propósito
Entrega de servicios a clientes actuales.

## Subrutas

### 4.1 Contacts Stage 4 (`/deliver/contacts`)
**Archivo:** `DeliverContacts.jsx`

**Funcionalidades:**
- ✅ Clientes actuales activos

---

### 4.2 Certificates (`/deliver/certificates`)
**Archivo:** `Certificados.jsx`

**Propósito:** Generación de certificados de finalización.

**Funcionalidades:**
- ✅ Buscar contacto por email
- ✅ Seleccionar programa completado
- ✅ Seleccionar nivel alcanzado
- ✅ Generar certificado
- ✅ Descargar PDF de certificado
- ✅ Historial de certificados emitidos

**Programas disponibles:**
- Coaching Ejecutivo
- Liderazgo Transformacional
- Comunicación Efectiva
- etc.

**Niveles:**
- Básico
- Intermedio
- Avanzado
- Expert

**Endpoints:**
- `GET /api/certificados/catalog/programs`
- `GET /api/certificados/catalog/levels`
- `GET /api/certificados/search-contact`
- `POST /api/certificados/generate`
- `GET /api/certificados/list`
- `GET /api/certificados/{id}`
- `GET /api/certificados/{id}/pdf`
- `DELETE /api/certificados/{id}`

---

### 4.3 Time Tracker (`/deliver/time-tracker`)
**Archivo:** `TimeTracker.jsx`

**Propósito:** Aplicación embebida de tracking de tiempo.

**Funcionalidades:**
- ✅ iFrame embebido de la aplicación de time tracker externa

---

# PASO 5: REPURCHASE

## Propósito
Retención y recompra de clientes anteriores.

## Subrutas

### 5.1 Contacts Stage 5 (`/repurchase/contacts`)
**Archivo:** `RepurchaseContacts.jsx`

**Funcionalidades:**
- ✅ Ex-clientes para oportunidades de recompra

---

# FOUNDATIONS

## Propósito
Fundamentos del negocio: Quién, Qué, Cómo, Cuánto.

## Subrutas

### 6.1 Who (`/foundations/who`)
**Archivo:** `Who.jsx`

**Propósito:** Definición de audiencias objetivo.

**Funcionalidades:**

#### Pestaña: Buyer Personas
- ✅ Lista de buyer personas
- ✅ Crear buyer persona
- ✅ Editar buyer persona
- ✅ Eliminar buyer persona
- ✅ Asignar job_titles para búsquedas
- ✅ Asignar keywords
- ✅ Matriz de buyer personas

**Esquema Buyer Persona:**
```javascript
{
  "code": "string",           // marketing_pharma
  "name": "string",           // Marketing Pharma
  "functional_area": "string",// Marketing
  "sector": "string",         // Pharmaceuticals
  "description": "string",
  "keywords": [],
  "job_titles": [],           // Para búsquedas de LinkedIn
  "active": true
}
```

#### Pestaña: Companies
- ✅ Lista de 16,000+ empresas (migradas de HubSpot)
- ✅ Agrupación por industria (acordeón colapsable)
- ✅ Estadísticas: total, con website, con email
- ✅ Filtro por industria
- ✅ Búsqueda por nombre
- ✅ Editar empresa
- ✅ Crear empresa

**Esquema Company:**
```javascript
{
  "hubspot_id": "string",
  "name": "string",
  "domain": "string",
  "industry": "string",
  "city": "string",
  "country": "string",
  "website": "string",
  "phone": "string",
  "description": "string",
  "pharma_pipeline_url": "string",
  "has_research": boolean,
  "last_pipeline_scrape_utc": "datetime",
  "last_pipeline_scrape_status": "string"
}
```

#### Pestaña: Sectors
- ✅ Lista de sectores activos/inactivos
- ✅ Activar/Desactivar sector
- ✅ Sincronizar desde HubSpot

**Endpoints:**
- `GET /api/buyer-personas-db/`
- `POST /api/buyer-personas-db/`
- `PUT /api/buyer-personas-db/{id}`
- `DELETE /api/buyer-personas-db/{id}`
- `GET /api/companies`
- `GET /api/companies/industries`
- `GET /api/companies/stats`
- `POST /api/companies`
- `PUT /api/companies/{id}`
- `GET /api/sectors/active`
- `PUT /api/sectors/{id}/toggle`

---

### 6.2 What (`/foundations/what`)
**Archivo:** `Dashboard.jsx`

**Propósito:** Dashboard general (placeholder).

---

### 6.3 How (`/foundations/how`)
**Archivo:** `ThematicAxes.jsx`

**Propósito:** Gestión de ejes temáticos para contenido y coaching.

**Funcionalidades:**
- ✅ Lista de ejes temáticos
- ✅ Crear eje temático
- ✅ Editar eje temático
- ✅ Eliminar eje temático
- ✅ Seed de ejes predefinidos

**Ejes Temáticos predefinidos:**
- Liderazgo
- Comunicación
- Negociación
- Gestión del cambio
- Coaching
- etc.

**Endpoints:**
- `GET /api/thematic-axes`
- `POST /api/thematic-axes`
- `PUT /api/thematic-axes/{id}`
- `DELETE /api/thematic-axes/{id}`
- `POST /api/thematic-axes/seed`

---

### 6.4 How Much (`/foundations/how-much`)
Redirige a `/close/quoter` (Cotizador)

---

# INFOSTRUCTURE

## Propósito
Infraestructura de información y fuentes de datos.

## Subrutas

### 7.1 Pharma Pipelines (`/infostructure/pharma-pipelines`)
**Archivo:** `PharmaPipelines.jsx`

**Propósito:** Scraping de pipelines de desarrollo farmacéutico.

**Funcionalidades:**

#### Pestaña: Companies
- ✅ 437 empresas farmacéuticas
- ✅ 90 listas para scrape
- ✅ Scrape manual por empresa
- ✅ Scrape automático masivo
- ✅ Estado de último scrape
- ✅ URL del pipeline
- ✅ Toggle "Has Research"
- ✅ Agregar Big Pharma
- ✅ Sincronizar con base de empresas

#### Pestaña: Medications
- ✅ 689 moléculas en base de datos
- ✅ Filtro por fase de desarrollo
- ✅ Filtro por área terapéutica
- ✅ Filtro por compañía
- ✅ Estado de búsqueda de decision makers
- ✅ Botón "Find DMs" por molécula

**Fases de Desarrollo:**
- Preclinical
- Phase 1
- Phase 2
- Phase 3
- Approved
- Marketing

#### Pestaña: Therapeutic Areas
- ✅ Lista de áreas terapéuticas
- ✅ Keywords de LinkedIn por área
- ✅ Agregar/editar keywords
- ✅ Seed de keywords predefinidos

**Áreas Terapéuticas:**
- Oncology
- Immunology
- Neurology
- Cardiology
- Infectious Disease
- etc.

#### Pestaña: Logs
- ✅ Historial de scrapes
- ✅ Status (success, failed, running)
- ✅ Errores detallados

**Proceso de Scraping:**
1. Buscar URL de pipeline si no existe
2. Hacer scrape del HTML
3. Extraer medicamentos con GPT-4o-mini
4. Guardar en base de datos
5. Detectar cambios de fase

**Endpoints:**
- `GET /api/scrappers/pharma/companies`
- `POST /api/scrappers/pharma/scrape-company/{id}`
- `POST /api/scrappers/run/pharma_pipelines`
- `GET /api/scrappers/pharma/medications`
- `GET /api/scrappers/pharma/medications/stats`
- `GET /api/scrappers/pharma/therapeutic-areas`
- `POST /api/scrappers/pharma/therapeutic-areas`
- `PUT /api/scrappers/pharma/therapeutic-areas/{id}`
- `POST /api/scrappers/pharma/therapeutic-areas/seed-keywords`
- `GET /api/scrappers/logs`

---

### 7.2 Keywords (`/infostructure/keywords`)
**Propósito:** Gestión de palabras clave para scrapers.

**Funcionalidades:**
- ✅ Lista de keywords por scrapper
- ✅ Crear keyword
- ✅ Editar keyword
- ✅ Eliminar keyword
- ✅ Keywords para posts de LinkedIn
- ✅ Keywords para perfiles de LinkedIn

**Endpoints:**
- `GET /api/scrappers/keywords`
- `POST /api/scrappers/keywords`
- `PUT /api/scrappers/keywords/{id}`
- `DELETE /api/scrappers/keywords/{id}`

---

### 7.3 Data Sources (`/infostructure/sources`)
**Archivo:** `AdminPanel.jsx`

**Propósito:** Panel de administración de fuentes de datos.

**Funcionalidades:**
- ✅ Información del sistema
- ✅ Estadísticas de base de datos
- ✅ Crear backup
- ✅ Listar backups
- ✅ Configuraciones del sistema

**Endpoints:**
- `GET /api/system-info`
- `GET /api/dashboard-stats`
- `POST /api/backup`
- `GET /api/backups`

---

# SETTINGS

## Ruta: `/settings`
**Archivo:** `Settings.jsx`

**Propósito:** Configuración de la aplicación.

**Funcionalidades:**

### Conexión Gmail
- ✅ OAuth con Gmail
- ✅ Estado de conexión
- ✅ Desconectar cuenta
- ✅ Enviar email de prueba
- ✅ Configurar nombre del remitente

### API Tokens
- ✅ Almacenar API keys de terceros
- ✅ Token de Apify
- ✅ Otros tokens

### Configuración General
- ✅ Nombre del remitente de emails
- ✅ Otras configuraciones

**Endpoints:**
- `GET /api/settings/`
- `PUT /api/settings/`
- `GET /api/gmail/auth-url`
- `GET /api/gmail/callback`
- `GET /api/gmail/status`
- `DELETE /api/gmail/disconnect`
- `POST /api/gmail/test-send`
- `PUT /api/gmail/sender-name`
- `GET /api/settings/api-tokens`
- `POST /api/settings/api-tokens`

---

# INTEGRACIONES EXTERNAS

## 1. Apify (LinkedIn & Google Maps Scraping)

**Actor IDs:**
```python
APIFY_ACTORS = {
    "linkedin_posts_keywords": "buIWk2uOUzTmcLsuB",
    "linkedin_posts_profile": "A3cAPGpwBEG8RJwse",
    "linkedin_profile": "2SyF0bVxmgGr8IVCZ",
    "linkedin_profile_search": "harvestapi/linkedin-profile-search",
    "google_maps": "compass/crawler-google-places",
}
```

**Funcionalidades:**
- ✅ Búsqueda de perfiles de LinkedIn por keywords
- ✅ Búsqueda de posts de LinkedIn
- ✅ Scraping de perfiles individuales
- ✅ Scraping de Google Maps

**Filtro de México:**
- "Mexico" agregado al search query
- Post-procesamiento filtra solo ubicaciones mexicanas
- Excluye "New Mexico" (USA)

**API Token:** Almacenado en `api_tokens` collection

---

## 2. Gmail OAuth

**Funcionalidades:**
- ✅ Autenticación OAuth 2.0
- ✅ Envío de emails desde la cuenta del usuario
- ✅ Tracking de aperturas (pixel)
- ✅ Tracking de clics (links)

---

## 3. HubSpot (Legacy)

**Funcionalidades migradas:**
- ✅ Empresas migradas a MongoDB local
- ✅ Contactos sincronizados a MongoDB

**Endpoints legacy:**
- `GET /api/hubspot/contacts`
- `POST /api/hubspot/sync`

---

## 4. OpenAI GPT-4o-mini (vía Emergent LLM Key)

**Usos:**
- ✅ Extracción de medicamentos de páginas web
- ✅ Generación de contenido para eventos
- ✅ Generación de emails personalizados
- ✅ Generación de títulos de eventos

---

## 5. Tipo de Cambio (Exchange Rate)

**Fuente:** API externa para USD/MXN
**Uso:** Cotizador

---

# BASE DE DATOS

## Colecciones MongoDB

### Contactos y CRM
| Colección | Descripción | Registros |
|-----------|-------------|-----------|
| `unified_contacts` | Contactos unificados con stages | 107 |
| `deal_makers` | Backup de contactos de LinkedIn | 107 |
| `hubspot_contacts` | Contactos legacy de HubSpot | - |
| `cierre_contacts` | Contactos en etapa de cierre | - |

### Empresas
| Colección | Descripción | Registros |
|-----------|-------------|-----------|
| `companies` | Empresas (migradas de HubSpot) | 16,000+ |
| `pharma_companies` | Empresas farmacéuticas | 437 |

### Pharma
| Colección | Descripción | Registros |
|-----------|-------------|-----------|
| `pharma_medications` | Moléculas/medicamentos | 689 |
| `therapeutic_areas` | Áreas terapéuticas | ~20 |
| `decision_makers` | Decision makers pharma | - |

### Configuración
| Colección | Descripción |
|-----------|-------------|
| `buyer_personas_db` | Buyer personas |
| `sectors` | Sectores de industria |
| `functional_areas` | Áreas funcionales |
| `thematic_axes` | Ejes temáticos |
| `industry_mapping` | Mapeo de industrias |

### Contenido y Comunicación
| Colección | Descripción |
|-----------|-------------|
| `events` | Eventos/Webinars |
| `campaigns` | Campañas de email |
| `email_templates` | Templates de email |
| `email_logs` | Logs de emails enviados |
| `contents` | Contenido (Kanban) |

### Ventas
| Colección | Descripción |
|-----------|-------------|
| `quotes` | Cotizaciones |
| `certificates` | Certificados emitidos |
| `deal_movements` | Movimientos de deals |

### Sistema
| Colección | Descripción |
|-----------|-------------|
| `app_settings` | Configuración de la app |
| `api_tokens` | Tokens de APIs externas |
| `scraper_runs` | Historial de scrapers |
| `scraper_logs` | Logs de scrapers |
| `scraper_keywords` | Keywords para scrapers |
| `import_history` | Historial de importaciones |
| `backups` | Información de backups |

---

# FUNCIONALIDADES FALTANTES / POR DESARROLLAR

## Alta Prioridad
- [ ] Formulario completo de edición de contactos
- [ ] Exportar contactos a CSV
- [ ] Importar contactos desde CSV a unified_contacts
- [ ] Dashboard de métricas por etapa
- [ ] Notificaciones de cambios de fase (pharma)

## Media Prioridad
- [ ] Automatización de scrapers (cron jobs)
- [ ] Alertas de nuevos deal makers
- [ ] Integración con CRM externo
- [ ] Reportes de conversión por etapa
- [ ] Bulk actions en contactos

## Baja Prioridad
- [ ] Step 0: Pantalla de bloqueo por inactividad
- [ ] Multi-idioma (actualmente todo en inglés)
- [ ] Tema claro/oscuro
- [ ] Mobile responsive mejorado
- [ ] Auditoría de cambios

---

# NOTAS TÉCNICAS

## URLs y Puertos
- Frontend: Puerto 3000
- Backend: Puerto 8001
- Todas las rutas API prefijadas con `/api`
- REACT_APP_BACKEND_URL para llamadas del frontend

## Filtro de México
Todas las búsquedas de LinkedIn filtran a México:
- "Mexico" en el search query
- Post-procesamiento verifica ubicación
- Ciudades válidas: Mexico City, CDMX, Guadalajara, Monterrey, etc.
- Excluye: "New Mexico" (USA)

## Duplicados
Los contactos no se duplican:
- Verificación por `linkedin_url`
- Verificación por `email`
- Si existe, solo se agrega nuevo tag de oportunidad

---

*Documento generado: Enero 2025*
*Total de endpoints: ~150*
*Total de páginas frontend: ~40*
*Total de colecciones MongoDB: ~25*
