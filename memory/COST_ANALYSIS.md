# Focus - Análisis de Costos y Plan Optimizado

## Resumen Ejecutivo

| Métrica | Valor |
|---------|-------|
| **Código Total** | 61,102 líneas |
| **Features Completadas** | 35+ |
| **Features Pendientes (Coming Soon)** | 17 |
| **Créditos Gastados (est.)** | ~35,000 |
| **Créditos Pendientes (sin optimizar)** | ~12,000-17,000 |
| **Créditos Pendientes (OPTIMIZADO)** | ~6,000-8,000 |

---

## Inventario Completo de Features

### ✅ COMPLETADAS Y FUNCIONALES (35 features)

| # | Feature | Ubicación |
|---|---------|-----------|
| 1 | Login/Auth | `/login` |
| 2 | Dashboard | `/dashboard` |
| 3 | Find by Molecules | `1.1.1.1` |
| 4 | Find by Posts | `1.1.1.2` |
| 5 | Find by Position | `1.1.1.3` |
| 6 | Small Business Finder | `1.1.2` |
| 7 | Deal Makers Connect | `1.3.1` |
| 8 | LinkedIn Invitations | `1.3.2` |
| 9 | WhatsApp Cold Messenger | `1.3.3` |
| 10 | Import LinkedIn Contacts | `2.1.1` |
| 11 | Nurture Contacts Stage | `2.1.3` |
| 12 | Email Campaigns | `2.2.2` |
| 13 | Testimonials | `2.2.3` |
| 14 | Long Form Videos (YouTube) | `2.2.6` |
| 15 | Own Events (Webinars) | `2.2.7` |
| 16 | Medical Society Events | `2.2.8` |
| 17 | AI Landing Pages | Public `/evento/{slug}` |
| 18 | Venue Finder | `3.1` |
| 19 | Quote Deal Makers | `3.2` |
| 20 | Close Contacts Stage | `3.3` |
| 21 | WhatsApp Confirmations | `4.0` |
| 22 | Deliver Contacts Stage | `4.1` |
| 23 | Time Tracker | `4.2` |
| 24 | Certificates | `4.3` |
| 25 | Repurchase Contacts | `5.1` |
| 26 | Buyer Personas + Cargos | `Foundations > Who` |
| 27 | Companies + Org Chart | `Foundations > Companies` |
| 28 | All Contacts + CSV Import | `Foundations > All Contacts` |
| 29 | Success Cases (What) | `Foundations > What` |
| 30 | Services (How) | `Foundations > How` |
| 31 | Sponsorship Pricing (How Much) | `Foundations > How Much` |
| 32 | Pharma Pipelines | `Infostructure` |
| 33 | Medical Societies + Scraping | `Infostructure` |
| 34 | Medical Specialties | `Infostructure` |
| 35 | Traffic Light System | Navigation global |

### ⚪ PLACEHOLDERS "COMING SOON" (17 features)

| # | Feature | Ubicación | Complejidad | Valor de Negocio |
|---|---------|-----------|-------------|------------------|
| 1 | Viral Videos (TikTok) | `1.2.1` | ALTA | BAJO |
| 2 | Long Form Video Search | `1.2.2` | MEDIA | BAJO |
| 3 | GEO | `1.2.3` | ALTA | MEDIO |
| 4 | SEO | `1.2.4` | ALTA | MEDIO |
| 5 | Social Media Followers | `1.3.4` | MEDIA | BAJO |
| 6 | Booklets & Cases | `2.1.2` | MEDIA | MEDIO |
| 7 | Website Builder | `2.2.1` | MUY ALTA | BAJO |
| 8 | Media Relations | `2.2.4` | MEDIA | BAJO |
| 9 | Editorial Relations | `2.2.5` | MEDIA | BAJO |
| 10 | Write Books | `2.2.9` | ALTA | BAJO |
| 11 | Students Recommendations | `5.2` | BAJA | BAJO |
| 12 | Documents Library | `4.4` | MEDIA | MEDIO |
| 13 | Google Maps Integration | `1.1.2` | MEDIA | MEDIO |
| 14 | PDF Export Quotes | `3.2` | BAJA | ALTO |
| 15 | Merge Duplicates | Admin | MEDIA | ALTO |
| 16 | Scheduled Scraping Jobs | Backend | MEDIA | MEDIO |
| 17 | Pharma Scraper Reliability | Backend | MEDIA | MEDIO |

---

## Análisis de Valor vs Costo

### 🔴 ELIMINAR - No implementar (Ahorro: ~5,000 créditos)

| Feature | Razón para eliminar | Créditos ahorrados |
|---------|---------------------|-------------------|
| **TikTok Viral Videos** | Requiere suscripción Apify pagada (~$50/mes). ROI bajo. | 1,000 |
| **Website Builder** | Complejidad altísima (CMS completo). Usa WordPress/Webflow. | 2,500 |
| **Write Books** | Feature de nicho. Usa Google Docs/Notion. | 1,200 |
| **GEO** | Sin definición clara. Posponer indefinidamente. | 800 |
| **SEO** | Sin definición clara. Usa herramientas externas (Ahrefs). | 800 |
| **Editorial Relations** | Duplica Media Relations. Fusionar o eliminar. | 600 |
| **Long Form Video Search** | Sin caso de uso claro definido. | 500 |

### 🟡 SIMPLIFICAR - Implementar versión mínima (Ahorro: ~2,000 créditos)

| Feature | Simplificación | Créditos (original → optimizado) |
|---------|----------------|----------------------------------|
| **Media Relations** | Solo lista de contactos de prensa, sin scraping | 800 → 300 |
| **Booklets & Cases** | Solo upload de PDFs, sin editor | 600 → 200 |
| **Social Followers** | Solo campo numérico manual, sin integración API | 500 → 100 |
| **Students Recommendations** | Clonar lógica de 5.1, cambiar label | 400 → 100 |
| **Documents Library** | Carpetas fijas, upload simple, sin búsqueda | 800 → 400 |

### 🟢 IMPLEMENTAR COMPLETO - Alto valor de negocio

| Feature | Por qué es importante | Créditos est. |
|---------|----------------------|---------------|
| **PDF Export Quotes** | Cierra ventas más rápido | 400 |
| **Merge Duplicates** | Limpieza de datos crítica | 800 |
| **Scheduled Scraping** | Automatización real del sistema | 600 |
| **Google Maps (1.1.2)** | Ya tiene UI, solo conectar API | 500 |

---

## Plan Optimizado por Sesiones

### SESIÓN 1: Cierre de Ventas (est. 1,200 créditos)
**Objetivo:** Completar el flujo de cierre de ventas

1. **PDF Export para Quotes** (400 cr)
   - Generar PDF de cotización con html2pdf.js
   - Logo, datos del cliente, tabla de servicios, total
   
2. **Merge Duplicates Wizard** (800 cr)
   - Detectar duplicados por nombre similar + empresa
   - UI para seleccionar cuál mantener
   - Fusionar datos (emails, phones, notas)

### SESIÓN 2: Automatización (est. 1,000 créditos)
**Objetivo:** Que el sistema trabaje solo

1. **Scheduled Scraping Jobs** (600 cr)
   - APScheduler para Medical Societies (semanal)
   - APScheduler para Pharma Pipelines (mensual)
   
2. **Google Maps Integration** (400 cr)
   - Conectar Places API a Small Business Finder
   - Ya tiene UI, solo backend

### SESIÓN 3: Limpieza y Estabilidad (est. 800 créditos)
**Objetivo:** Sistema más robusto

1. **Simplificar 5 placeholders** (500 cr)
   - Students Recommendations (clonar 5.1)
   - Social Followers (campo manual)
   - Media Relations (lista simple)
   - Booklets & Cases (upload PDFs)
   - Documents Library (básico)
   
2. **Bug fixes acumulados** (300 cr)

### SESIÓN 4: Opcional - Solo si hay presupuesto (est. 1,500 créditos)

1. **Pharma Scraper con Playwright** (800 cr)
2. **Mejoras de UX acumuladas** (700 cr)

---

## Resumen de Ahorro

| Concepto | Sin optimizar | Optimizado | Ahorro |
|----------|---------------|------------|--------|
| Features eliminadas | 7,400 cr | 0 cr | 7,400 cr |
| Features simplificadas | 3,100 cr | 1,100 cr | 2,000 cr |
| Features completas | 2,300 cr | 2,300 cr | 0 cr |
| Buffer bugs | 2,000 cr | 1,000 cr | 1,000 cr |
| **TOTAL** | **14,800 cr** | **4,400 cr** | **10,400 cr (70%)** |

---

## Recomendaciones Adicionales

### Para reducir costos en cada sesión:

1. **Dame requerimientos completos de una vez**
   - Campos exactos que necesitas
   - Flujo de usuario paso a paso
   - Mockups si los tienes

2. **Agrupa cambios de UI**
   - Colores, textos, espaciados: todo en una sola sesión
   - No pidas ajustes cosméticos por separado

3. **Verifica tus datos antes de reportar bugs**
   - El problema de teléfonos de hoy costó ~500 créditos en investigación
   - Era un problema del CSV, no del sistema

4. **Usa el sistema antes de pedir cambios**
   - Muchas veces los cambios solicitados ya existen
   - O el flujo actual es suficiente

### Features que recomiendo NO hacer nunca:

- **Website Builder** - Usa WordPress, Webflow, o Framer
- **Write Books** - Usa Google Docs o Notion
- **TikTok Trends** - Costo mensual de Apify + mantenimiento

---

## Próximos Pasos Inmediatos

1. **Revisar este documento** y confirmar qué features eliminar
2. **Priorizar** entre Sesión 1, 2 y 3
3. **Cuando estés lista**, dame el go para la primera sesión

¿Preguntas?
