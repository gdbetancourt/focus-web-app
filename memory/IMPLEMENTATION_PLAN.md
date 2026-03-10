# 📋 PLAN DE IMPLEMENTACIÓN - Optimizado por Créditos

**Fecha:** 30 de Enero 2026
**Total tareas pendientes:** 20

---

## 🔴 FASE 1: Arreglos de Funcionalidad Existente (2-4 créditos)
> **Objetivo:** Corregir bugs y mejorar código existente sin crear nuevos módulos

| ID | Tarea | Tipo | Créditos Est. |
|----|-------|------|---------------|
| dfa936ae | Mensajes Hoy Email: Revisar reglas | Bug fix | 0.5 |
| 4d8aa0e0 | Mensajes Hoy LinkedIn: Arreglar lógica | Bug fix | 0.5 |
| 46b075cf | LMS: Quitar campo formato | UI edit | 0.3 |
| d654e61c | Newsletters: Solo enviados/programados | Filter fix | 0.3 |
| 538a837d | 1.2 Ocultar de navegación | UI edit | 0.2 |
| 3b5f7086 | 2.2.1 Quitar etiqueta Soon | UI edit | 0.1 |

**Subtotal:** 1.9 - 3 créditos
**Contexto necesario:** `MensajesHoy.jsx`, `Layout.jsx`, `LMSPage.jsx`

---

## 🟠 FASE 2: Reorganización de Módulos (2-3 créditos)
> **Objetivo:** Mover y consolidar módulos sin crear nueva funcionalidad

| ID | Tarea | Tipo | Créditos Est. |
|----|-------|------|---------------|
| 92fcce5a | Quiz: Mover a Ejes Temáticos | Move + reroute | 1 |
| 75f32859 | 2.2.6.2 Mover a 2.2.6.1 | Merge components | 0.5 |
| bf40a986 | 2.2.8 Relacionar a Eugenio no Jerónimo | Copy/adapt | 1 |

**Subtotal:** 2.5 créditos
**Contexto necesario:** `QuizPage.jsx`, `ContentPipeline.jsx`, `MediaRelations.jsx`

---

## 🟡 FASE 3: Mejoras de UI Existente (2-4 créditos)
> **Objetivo:** Mejorar páginas públicas existentes

| ID | Tarea | Tipo | Créditos Est. |
|----|-------|------|---------------|
| f90e9d93 | Testimonios públicos: Versión navegable | UI enhance | 1 |
| 7416ed6c | Eventos: Rediseñar página pública | UI enhance | 1.5 |
| 9490c3fd | Selector idioma en todas las páginas | Global component | 1 |
| 3ea8cc1e | Contactos: Mostrar cursos relacionados | UI + query | 0.5 |

**Subtotal:** 4 créditos
**Contexto necesario:** `MuroTestimonios.jsx`, `EventsPage.jsx`, `PublicLayout.jsx`

---

## 🟢 FASE 4: Features Nuevos Críticos (4-6 créditos)
> **Objetivo:** Implementar funcionalidad nueva de alta prioridad

| ID | Tarea | Tipo | Créditos Est. |
|----|-------|------|---------------|
| a5a5da1e | 2.2.6.1 Contenido: Proceso completo | Feature complete | 2 |
| 61333088 | Ejes Temáticos: ES/EN | Feature new | 1.5 |
| c0995390 | 2.2.1 Blog público: Desarrollar página | Page new | 1.5 |

**Subtotal:** 5 créditos
**Contexto necesario:** `ContentPipeline.jsx`, `content_flow.py`, `foundations.py`

---

## 🔵 FASE 5: Debugging & Investigación (3-5 créditos)
> **Objetivo:** Resolver problemas que requieren investigación

| ID | Tarea | Tipo | Créditos Est. |
|----|-------|------|---------------|
| 25d0d699 | 3.1 Venue Finder: No funciona | Debug + fix | 1.5 |
| f833e7ab | 1.1.2 Cola búsquedas: No agrega automático | Debug + fix | 1.5 |
| 76a23625 | 2.2.4.1 Eliminar, crear Analytics general | Replace module | 2 |

**Subtotal:** 5 créditos
**Contexto necesario:** `VenueFinder.jsx`, `SmallBusinessFinder.jsx`, analytics routers

---

## 🟣 PRIORIDAD FASE 2: Unificación del Modelo de Industrias
> **Objetivo:** Migrar todo el sistema al modelo unificado `industries[]` (array) como fuente de verdad
> **Contexto:** La feature de acordeones por industria en Invitaciones a Eventos ya usa `industries[]` como fuente de verdad (con fallback a `industry_code`/`industry`). El resto del sistema aún usa los campos legacy.

| Prioridad | Tarea | Detalle |
|-----------|-------|---------|
| Alta | Migrar Companies.jsx al modelo `industries[]` | Actualmente agrupa por `industry_code`. Cambiar a `industries[]` |
| Alta | Migrar prospection router al modelo `industries[]` | Filtros y queries usan `industry_code` como campo principal |
| Alta | Migrar industries router propagación | `PUT /industries/{id}` propaga vía `industry_code`. Agregar propagación vía `industries[]` array con `$in` |
| Media | Migrar SmallBusinessFinder y VenueFinder | Si usan `industry_code` para filtrar, migrar a `industries[]` |
| Baja | Deprecar campos `industry` e `industry_code` | Solo después de que TODO el sistema use `industries[]`. Los campos siguen existiendo para backward compatibility hasta completar migración |

**IMPORTANTE:**
- NO eliminar `industry` ni `industry_code` — siguen existiendo para backward compatibility
- La migración de Companies.jsx, prospection, etc. es un proyecto aparte
- El campo `industries[]` ya existe en el modelo de datos y soporta múltiples industrias

---

## ⚪ FASE 6: Features Avanzados - Backlog (Alto costo)
> **Objetivo:** Features que requieren integraciones externas

| ID | Tarea | Tipo | Créditos Est. |
|----|-------|------|---------------|
| 10993cd8 | Video Processing: API real | Integration | 3-5 |

**Subtotal:** 3-5 créditos
**Requiere:** API externa de video processing

---

## 📊 RESUMEN

| Fase | Créditos Est. | Archivos Principales |
|------|---------------|---------------------|
| 1. Bug Fixes | 1.9 - 3 | MensajesHoy, Layout, LMS |
| 2. Reorganización | 2.5 | Quiz, ContentPipeline, Media |
| 3. UI Mejoras | 4 | Testimonios, Events, Public |
| 4. Features Críticos | 5 | Content, Foundations, Blog |
| 5. Debug | 5 | Venue, SmallBusiness, Analytics |
| 6. Avanzados | 3-5 | Video (API externa) |

**TOTAL ESTIMADO:** 21-25 créditos

---

## 🎯 RECOMENDACIÓN DE EJECUCIÓN

1. **Batch 1 (Fases 1+2):** Bug fixes + reorganización juntos aprovechan el contexto de navegación y componentes
2. **Batch 2 (Fase 3):** UI mejoras de páginas públicas en una sesión
3. **Batch 3 (Fase 4):** Features nuevos que comparten backend de contenidos
4. **Batch 4 (Fase 5):** Debugging - cada uno puede requerir investigación independiente
5. **Batch 5 (Fase 6):** Solo si hay presupuesto y API disponible

---

## ✅ COMPLETADO ESTA SESIÓN

- Login Flow arreglado (11+ veces reportado)
- Newsletter teléfono obligatorio
- Testimonios filtros sin duplicados
- Countdown reset semanal (lunes)
- LMS selector de estudiantes
- Content AI bilingüe (ES/EN)
- Convenios optimizado (60x más rápido)
- Módulos eliminados (2.1.2, 2.2.2, 2.2.9)
- Google Maps contacts eliminados
