# Leaderlix - Lista Completa de Funcionalidades

## Resumen Ejecutivo
Leaderlix es una plataforma integral CRM + LMS diseñada para empresas de consultoría y formación. Combina gestión de contactos, automatización de marketing, eventos, educación online y herramientas de productividad.

---

## 1. AUTENTICACIÓN Y SEGURIDAD

### 1.1 Sistema de Autenticación
- **Google OAuth 2.0**: Login con cuenta de Google
- **Email/Password**: Registro y login tradicional para usuarios externos
- **Sesiones con Cookies HttpOnly**: Seguridad en autenticación
- **Expiración de sesiones**: 7 días
- **Rate Limiting**: Protección contra ataques de fuerza bruta
- **Cloudflare Turnstile CAPTCHA**: Protección en formularios de registro

### 1.2 Control de Acceso
- **Usuarios @leaderlix.com**: Acceso completo al sistema Focus (staff)
- **Usuarios externos**: Acceso limitado al LMS
- **Rutas protegidas**: Verificación de autenticación en todas las rutas internas

---

## 2. SISTEMA FOCUS (Panel de Control Principal)

### 2.1 Secciones de Trabajo Diario (16 secciones con semáforos)

#### 2.1.1 Max LinkedIn Conexions
- Gestión de prospectos vía LinkedIn
- Checkboxes por perfil de LinkedIn (GB, MG)
- Cola de búsquedas para prospectar
- Semáforo semanal de progreso

#### 2.1.2 Import New Conexions
- Drag & Drop para archivos CSV
- Detección automática de columnas
- Mapeo manual de campos
- Vista previa antes de importar
- Política de duplicados configurable
- Integración con exportaciones de LinkedIn
- Soporte para campo País

#### 2.1.3 Marketing Event Planning
- 4 placeholders de eventos por categoría:
  - Industria Dominante
  - Liderazgo
  - Ventas
  - Thought Leadership
- Calendario de eventos
- Cronograma automático de tareas
- Landing pages automáticas

#### 2.1.4 Bulk Event Invitations
- Invitaciones masivas a eventos de LinkedIn
- Invitaciones por empresa
- Tracking de invitaciones enviadas

#### 2.1.5 Import Registrants
- Importar registrados de eventos
- Clasificación automática a Stage 2
- Integración con plataformas de webinars

#### 2.1.6 Qualify New Contacts
- Revisión manual de contactos
- Asignación de Buyer Persona
- Descarte de contactos no relevantes
- Meta semanal: 250 contactos

#### 2.1.7 Personal Invitations
- Mensajes personalizados de Ice Breaker
- Por búsquedas realizadas hace 2 semanas
- Por contactos individuales

#### 2.1.8 Assign DM (Deal Maker)
- Asignación de Deal Makers a casos
- Para Stages 3 y 4
- Seguimiento de responsables

#### 2.1.9 Role Assignment
- Asignación de roles a contactos
- Tipos: Deal Maker, Influencer, Student, Advisor
- Para Stages 3, 4 y 5

#### 2.1.10 WhatsApp Follow Up
- Lista de mensajes a enviar hoy
- URLs para WhatsApp Web
- Seguimiento de mensajes enviados
- Reglas automáticas de seguimiento

#### 2.1.11 Email Follow Up
- Lista de emails a enviar hoy
- Integración con Gmail
- Seguimiento de emails enviados
- Reglas automáticas de seguimiento

#### 2.1.12 Pre-projects (Cotizaciones)
- Lista de contactos que solicitan cotización
- Flujo de cotización
- Programación de reuniones

#### 2.1.13 YouTube Ideas
- Planificación de contenido
- Ideas para videos
- Estado: En construcción

#### 2.1.14 Current Cases
- Proyectos activos de clientes
- Seguimiento de entregas
- Estado: En construcción

#### 2.1.15 Merge Duplicates
- Identificación de contactos duplicados
- Herramienta de fusión
- Estado: En construcción

#### 2.1.16 Tasks Outside System
- Tareas manuales no automatizadas
- Asignación de fechas
- Seguimiento diario

---

## 3. ASSETS (Activos del Sistema)

### 3.1 Contacts
- **28,000+ contactos** unificados
- Búsqueda avanzada por nombre, email, empresa, cargo
- Filtros por Stage (1-5), Buyer Persona, Tags
- Edición completa de contactos
- Historial de eventos
- Múltiples emails y teléfonos por contacto
- Vista de mapa organizacional

### 3.2 Companies
- Gestión de empresas
- Asociación múltiple de contactos a empresas
- Información de industria y tamaño

### 3.3 Pharma Pipelines
- Pipeline farmacéutico
- Información de medicamentos en desarrollo

### 3.4 Testimonials
- Gestión de testimonios de clientes
- Página pública de testimonios (/muro)
- Multimedia (videos, imágenes)

### 3.5 SEO / Blog
- Editor de artículos de blog
- SEO metadata
- Publicación programada
- Páginas públicas (/blog)

### 3.6 Autoassessments (Quizzes)
- Creador de cuestionarios
- Tipos: Calificación de leads, Autoevaluación, Feedback
- Páginas públicas (/quiz/:slug)
- Resultados y análisis

### 3.7 Programs (LMS Admin)
- Gestión de cursos
- Lecciones (video, texto, PDF, quiz)
- Objetivos de aprendizaje
- Syllabus
- FAQs
- Inscripción de estudiantes
- Páginas públicas (/programa/:slug)

### 3.8 Pricing (Cotizador)
- Configuración de precios
- Generador de cotizaciones
- Plantillas de propuestas

### 3.9 Formatos
- Tipos de formatos de servicios
- Configuración de ofertas

### 3.10 Time Tracker
- Registro de tiempo
- Por proyecto/cliente
- Estado: En construcción

### 3.11 Certificates
- Generador de certificados
- Plantillas personalizables
- Códigos QR de verificación

---

## 4. SISTEMA LMS (Learning Management System)

### 4.1 Administración de Cursos
- Crear/Editar/Eliminar cursos
- Campos: Título, Descripción, Objetivos, Syllabus, FAQs
- Gestión de lecciones
- Tipos de contenido: Video, Texto, PDF, Quiz
- Thumbnails y materiales

### 4.2 Inscripción de Estudiantes
- Búsqueda de contactos para inscribir
- Email de bienvenida opcional
- Desinscripción con confirmación
- Progreso de lecciones (% completado)

### 4.3 Páginas Públicas de Cursos
- URL: /programa/:slug
- Layout con navegación lateral
- Header/Footer consistente
- Información del curso
- Botón de inscripción

### 4.4 LMS Externo (Para estudiantes)
- Ruta: /nurture/lms
- Vista de cursos asignados
- Progreso de lecciones
- Reproductor de videos
- Sala de webinar en vivo

---

## 5. SISTEMA DE EVENTOS

### 5.1 Eventos V2 (Sistema Principal)
- Creación de eventos con cronograma automático
- Landing pages automáticas (/evento/:slug)
- Registro de participantes
- Confirmación por WhatsApp
- Email de confirmación automático
- Emails de recordatorio
- Categorías de eventos
- Show-up tracking

### 5.2 Webinars
- Sala de reproducción en vivo (/nurture/lms/webinar/:eventId)
- Integración con plataformas de streaming
- Chat en vivo (opcional)

### 5.3 Patrocinios
- Página de patrocinios (/evento/:eventId/sponsors)
- Niveles de patrocinio
- Información de beneficios

---

## 6. IMPORTADORES DE CONTACTOS

### 6.1 Importador de LinkedIn Mejorado (#4) ✅
- **Ruta**: /nurture/import-linkedin
- Drag & Drop de archivos CSV
- Auto-detección de columnas
- Mapeo manual de 8 campos:
  - Email (requerido)
  - Nombre
  - Apellido
  - Empresa
  - Cargo
  - País
  - Teléfono
  - URL LinkedIn
- Vista previa antes de importar
- 3 políticas de duplicados:
  - Actualizar existentes
  - Solo crear nuevos
  - Crear siempre
- Barra de progreso
- Integración con sistema de importación batch

### 6.2 Importador CSV de Eventos (#2)
- Importación de registrados de eventos
- Perfiles múltiples (GB, MG)
- Flujo guiado
- Estado: Pendiente mejoras de background processing

### 6.3 Otros Importadores
- Quick Capture (/capture) - Captura rápida pública
- Import Wizard (Foundations) - Wizard completo de importación

---

## 7. COMUNICACIONES

### 7.1 Email
- Integración con Gmail
- Templates de email
- Campañas masivas
- Métricas de email (opens, clicks)
- Email individual desde contacto
- Reglas de seguimiento automático

### 7.2 WhatsApp
- URLs para WhatsApp Web
- Seguimiento de mensajes
- Confirmaciones de eventos
- Reglas de seguimiento automático

### 7.3 Newsletters
- Editor de newsletters
- Queue de envío
- Programación
- Métricas

---

## 8. ANALYTICS Y REPORTES

### 8.1 Dashboard de Analytics
- Métricas de contactos
- Métricas de eventos
- Métricas de email
- Métricas de contenido

### 8.2 Email Metrics
- Tasa de apertura
- Tasa de clicks
- Bounces
- Unsubscribes

### 8.3 Event Stats
- Show-up rate
- Registrados vs Asistentes
- Fuentes de registro

---

## 9. WEBSITE PÚBLICO

### 9.1 Página Principal (/)
- Landing page de Leaderlix
- Modal de login/registro
- Información de servicios
- Próximos webinars
- Testimonios destacados

### 9.2 Centro de Aprendizaje (/learn)
- Catálogo de cursos públicos
- Detalle de curso
- Inscripción

### 9.3 Blog (/blog)
- Lista de artículos
- Detalle de artículo
- Categorías y tags

### 9.4 Páginas de Eventos (/evento/:slug)
- Landing page de evento
- Formulario de registro
- Countdown

### 9.5 Otras Páginas Públicas
- /muro - Muro de testimonios
- /quiz/:slug - Cuestionarios públicos
- /legal - Información legal
- /capture - Captura rápida

---

## 10. CONFIGURACIÓN Y ADMINISTRACIÓN

### 10.1 Settings
- Configuración de perfil
- Integración con Gmail
- Integración con Google Calendar
- Buyer Personas
- Keywords de clasificación
- Ejes temáticos
- Fuentes de datos

### 10.2 Admin Tools
- Merge Duplicates
- Scraping Automation
- Dev Kanban (desarrollo interno)

---

## 11. INTEGRACIONES DE TERCEROS

### 11.1 Activas
- **MongoDB Atlas**: Base de datos principal
- **Google OAuth 2.0**: Autenticación
- **Gmail API**: Envío de emails
- **Google Calendar API**: Calendario
- **Cloudflare Turnstile**: CAPTCHA
- **Apify**: Web scraping
- **HubSpot**: Sincronización de contactos (opcional)

### 11.2 Pendientes
- **AWS SES**: Email masivo (pendiente aprobación)

---

## 12. SCRAPING Y AUTOMATIZACIÓN

### 12.1 Scraping Automation
- Configuración de scrapers
- LinkedIn profiles
- Google Maps
- Business Search

### 12.2 Social Followers
- Seguimiento de seguidores en redes
- Importación de followers

---

## 13. CONTENIDO Y MULTIMEDIA

### 13.1 Content Matrix
- Planificación de contenido
- Calendario editorial
- Estados de producción

### 13.2 Content Flow
- Pipeline de contenido
- Flujo de aprobación

### 13.3 Video Processing
- Procesamiento de videos
- Clips para redes sociales
- Transcripciones

### 13.4 Long Form Videos
- Videos largos
- Búsqueda de contenido

---

## 14. PROSPECIÓN Y VENTAS

### 14.1 Buyer Personas
- 5 personas definidas:
  - Ricardo (CEO/Director)
  - Ramona (Médico especialista)
  - Roberto (RH)
  - Rodrigo (Ventas)
  - Mateo (Usuario final - catchall)

### 14.2 Stages de Contacto
1. **Prospect**: Contactos nuevos sin calificar
2. **Nurture**: Contactos calificados en nurturing
3. **Close**: En proceso de cierre
4. **Deliver**: Proyectos activos
5. **Repurchase**: Clientes para recompra

### 14.3 Cases / Pre-proyectos
- Pipeline de ventas
- Cotizaciones
- Seguimiento de oportunidades

---

## 15. HERRAMIENTAS DE PRODUCTIVIDAD

### 15.1 Mensajes de Hoy
- Consolidación de tareas diarias
- WhatsApp + Email en una vista
- Semáforo de completado

### 15.2 Tasks Outside System
- Tareas manuales
- Asignación y seguimiento

### 15.3 Countdown
- Páginas de cuenta regresiva
- Para lanzamientos o eventos

---

## 16. DOCUMENTOS Y ARCHIVOS

### 16.1 Documents
- Gestión de documentos
- Subida de archivos
- Organización por contacto/proyecto

### 16.2 Booklets / Cases
- Casos de estudio
- Materiales de marketing

---

## 17. API ENDPOINTS (Backend)

### 17.1 Autenticación (/api/auth)
- POST /register - Registro
- POST /login - Login
- GET /google/init - Inicio OAuth
- GET /google/callback - Callback OAuth
- POST /set-session - Establecer sesión
- GET /check - Verificar sesión

### 17.2 Contactos (/api/contacts)
- GET / - Listar contactos
- POST / - Crear contacto
- GET /:id - Obtener contacto
- PUT /:id - Actualizar contacto
- DELETE /:id - Eliminar contacto
- GET /search - Búsqueda avanzada

### 17.3 Importación (/api/contacts/imports)
- POST /upload - Subir CSV
- POST /:batch_id/map - Guardar mapeo
- POST /:batch_id/validate - Validar
- POST /:batch_id/run - Ejecutar importación
- GET /:batch_id/status - Estado

### 17.4 LMS (/api/lms)
- GET /courses - Listar cursos
- POST /courses - Crear curso
- PUT /courses/:id - Actualizar curso
- DELETE /courses/:id - Eliminar curso
- POST /enroll - Inscribir estudiante
- POST /unenroll - Desinscribir
- GET /contact/:id/enrollments - Inscripciones

### 17.5 Eventos (/api/events-v2)
- GET / - Listar eventos
- POST / - Crear evento
- PUT /:id - Actualizar evento
- GET /:id/registrants - Registrados
- POST /:id/register - Registrar participante

### 17.6 Quiz (/api/quiz)
- GET /quizzes - Listar quizzes
- POST /quizzes - Crear quiz
- POST /respond - Enviar respuestas
- GET /responses/:quiz_id - Ver respuestas

### 17.7 Blog (/api/blog)
- GET /posts - Listar posts
- POST /posts - Crear post
- PUT /posts/:id - Actualizar post

### 17.8 Otros Endpoints
- /api/companies - Empresas
- /api/testimonials - Testimonios
- /api/certificates - Certificados
- /api/cotizador - Cotizaciones
- /api/calendar - Calendario
- /api/settings - Configuración
- /api/analytics - Métricas
- Y 40+ routers más...

---

## 18. COLECCIONES DE BASE DE DATOS

- **unified_contacts**: Todos los contactos (28,000+)
- **user_sessions**: Sesiones activas
- **courses**: Cursos del LMS
- **lessons**: Lecciones de cursos
- **lms_enrollments**: Inscripciones
- **lms_progress**: Progreso de estudiantes
- **events_v2**: Eventos
- **event_registrations**: Registros de eventos
- **quizzes**: Cuestionarios
- **quiz_responses**: Respuestas
- **blog_posts**: Artículos
- **companies**: Empresas
- **testimonials**: Testimonios
- **certificates**: Certificados
- **contact_import_batches**: Batches de importación
- **email_queue**: Cola de emails
- **tasks**: Tareas
- Y muchas más...

---

## 19. CARACTERÍSTICAS TÉCNICAS

### 19.1 Frontend
- **React 18+** con hooks
- **Material UI (MUI)** para componentes
- **Shadcn/UI** para componentes personalizados
- **React Router v6** para navegación
- **Axios** para peticiones HTTP
- **Sonner** para notificaciones toast
- **Lucide React** para iconos
- **Hot reload** habilitado

### 19.2 Backend
- **FastAPI** (Python 3.10+)
- **Motor** (async MongoDB driver)
- **Pydantic** para validación
- **SlowAPI** para rate limiting
- **JWT** para tokens
- **BCrypt** para passwords
- **Supervisor** para procesos

### 19.3 Base de Datos
- **MongoDB Atlas** (cloud)
- Índices optimizados
- Aggregation pipelines

---

## 20. RESUMEN DE ESTADÍSTICAS

| Categoría | Cantidad |
|-----------|----------|
| Contactos | 28,000+ |
| Routers Backend | 50+ |
| Páginas Frontend | 60+ |
| Componentes | 100+ |
| Endpoints API | 200+ |
| Colecciones MongoDB | 30+ |
| Integraciones | 8 activas |
| Secciones Focus | 16 |
| Assets | 11 |

---

*Documento generado el: 12 de Febrero, 2026*
*Versión: 2.1.0*
