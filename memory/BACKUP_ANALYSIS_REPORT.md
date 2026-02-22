# 📊 INFORME DE ANÁLISIS: FOCUS1-Backup-Antes-de-Reestructura

**Fecha:** 2026-02-19  
**Archivos analizados:** 5 archivos del backup (database.py, legacy.py, contacts.py, cases.py, contact_imports.py)

---

## 🔴 RESUMEN EJECUTIVO

### Respuesta a la pregunta clave:

| Pregunta | Respuesta | Evidencia |
|----------|-----------|-----------|
| **A) ¿Contactos/deals persistidos en Mongo?** | ✅ SÍ, parcialmente | Los contactos de HubSpot se cacheaban en `db.hubspot_contacts`. Los contactos manuales/importados iban a `db.unified_contacts`. |
| **B) ¿UI mostraba desde HubSpot sin persistencia?** | ⚠️ HÍBRIDO | La UI leía desde Mongo (`hubspot_contacts`), pero este era un CACHE de HubSpot, no la fuente primaria |
| **C) ¿Las ediciones se guardaban en Mongo?** | ✅ SÍ | Las clasificaciones (`buyer_persona`, `classified_area`, etc.) se guardaban en `db.hubspot_contacts` y se preservaban durante el sync |

---

## 1️⃣ CÓMO SE CONECTABAN LOS REGISTROS CON HUBSPOT

### Diagrama del Flujo de Datos (Backup)

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         HUBSPOT API                                      │
│  (Source of Truth para datos base de contactos)                         │
└─────────────────────┬───────────────────────────────────────────────────┘
                      │
                      │ GET /crm/v3/lists/{list_id}/memberships
                      │ POST /crm/v3/objects/contacts/batch/read
                      ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    BACKEND (legacy.py)                                   │
│                                                                          │
│  /hubspot/contacts    → Lee de db.hubspot_contacts (cache)              │
│  /hubspot/sync        → Fetch HubSpot → Preserva clasificaciones        │
│                        → Upsert en db.hubspot_contacts                  │
└─────────────────────┬───────────────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    MONGODB                                               │
│                                                                          │
│  ┌─────────────────────┐     ┌─────────────────────────────────┐        │
│  │  hubspot_contacts   │     │     unified_contacts            │        │
│  │  (CACHE de HubSpot) │     │  (Contactos manuales/imports)   │        │
│  │                     │     │                                  │        │
│  │  - id (HubSpot ID)  │     │  - id (UUID interno)            │        │
│  │  - email            │     │  - email                         │        │
│  │  - firstname        │     │  - first_name                    │        │
│  │  - buyer_persona ←──┼─────┼──→ buyer_persona                │        │
│  │  - classified_area  │     │  - tags                          │        │
│  │  - classified_sector│     │  - notes                         │        │
│  │  - company_industry │     │  - stage                         │        │
│  └─────────────────────┘     │  - companies[]                   │        │
│                              │  - roles[]                       │        │
│                              └─────────────────────────────────┘        │
│                                                                          │
│  ┌─────────────────────┐     ┌─────────────────────────────────┐        │
│  │  hubspot_companies  │     │         cases                   │        │
│  │  (CACHE de HubSpot) │     │  (Deals importados de HubSpot)  │        │
│  └─────────────────────┘     └─────────────────────────────────┘        │
└─────────────────────────────────────────────────────────────────────────┘
```

### Endpoints de HubSpot utilizados

| Endpoint | Método | Propósito | Archivo |
|----------|--------|-----------|---------|
| `/crm/v3/lists/{list_id}/memberships` | GET | Obtener IDs de contactos de una lista | legacy.py:442, 567 |
| `/crm/v3/objects/contacts/batch/read` | POST | Fetch batch de contactos con propiedades | legacy.py:488, 617 |
| `/crm/v3/objects/contacts/{id}` | PATCH | Actualizar `hs_persona` | legacy.py (implícito) |
| `/crm/v4/objects/deals/{id}/associations/contacts` | GET | Obtener contactos asociados a deal | cases.py:187 |
| `/crm/v4/objects/deals/{id}/associations/companies` | GET | Obtener empresas asociadas a deal | cases.py:229 |
| `/crm/v3/objects/deals/{id}` | GET | Obtener detalles de deal | cases.py |

### Mecanismo de Sincronización

**Archivo:** `legacy.py` líneas 545-677

```python
@hubspot_router.post("/sync")
async def sync_hubspot_contacts(current_user: dict = Depends(get_current_user)):
    """Force sync contacts from HubSpot list - preserves local classification"""
    
    # PASO 1: Guardar clasificaciones existentes ANTES del sync
    existing_classifications = {}
    existing_contacts = await db.hubspot_contacts.find({}, {"_id": 0}).to_list(2000)
    for contact in existing_contacts:
        if contact.get("id"):
            existing_classifications[contact["id"]] = {
                "buyer_persona": contact.get("buyer_persona"),
                "buyer_persona_name": contact.get("buyer_persona_name"),
                "buyer_persona_display_name": contact.get("buyer_persona_display_name"),
                "classified_area": contact.get("classified_area"),
                "classified_sector": contact.get("classified_sector"),
                "classification_confidence": contact.get("classification_confidence"),
                "company_industry": contact.get("company_industry")
            }
    
    # PASO 2: Fetch desde HubSpot
    # ... fetch contacts from HubSpot API ...
    
    # PASO 3: Restaurar clasificaciones durante upsert
    if contact_id in existing_classifications:
        saved = existing_classifications[contact_id]
        contact_dict["buyer_persona"] = saved.get("buyer_persona")
        contact_dict["classified_area"] = saved.get("classified_area")
        # ... etc ...
    
    await db.hubspot_contacts.update_one(
        {"id": contact_id},
        {"$set": contact_dict},
        upsert=True
    )
```

**⚠️ OBSERVACIÓN CRÍTICA:** El sync preservaba las clasificaciones **SOLO si ya existían en `hubspot_contacts`**. Si un contacto nunca fue sincronizado previamente, no había clasificaciones que preservar.

---

## 2️⃣ DÓNDE SE GUARDABAN LAS EDICIONES DE LA UI

### Colecciones y Campos

| Colección | Campos UI-managed | Código de persistencia |
|-----------|-------------------|------------------------|
| `hubspot_contacts` | `buyer_persona`, `buyer_persona_name`, `buyer_persona_display_name`, `classified_area`, `classified_sector`, `classification_confidence`, `company_industry` | legacy.py:664-668 |
| `unified_contacts` | `tags`, `notes`, `stage`, `classification`, `companies[]`, `roles[]`, `buyer_persona`, `specialty` | contacts.py:920-923 |
| `cases` | `stage`, `status`, `contact_ids[]`, `notes`, `discard_reason` | cases.py (update endpoints) |

### Código de Persistencia de Ediciones

**Para contactos HubSpot (`hubspot_contacts`):**
```python
# legacy.py línea 664
await db.hubspot_contacts.update_one(
    {"id": contact_id},
    {"$set": contact_dict},
    upsert=True
)
```

**Para contactos unificados (`unified_contacts`):**
```python
# contacts.py línea 920
await db.unified_contacts.update_one(
    {"id": contact_id},
    {"$set": update_data}
)
```

### Estructura del Documento en `hubspot_contacts`

```json
{
  "id": "185930870117",           // HubSpot Contact ID
  "email": "maite.tazon@takeda.com",
  "firstname": "Maite",
  "lastname": "Tazón Sierra",
  "company": "Takeda",
  "jobtitle": "Gerente Patient Advocacy",
  "phone": "+525554019653",
  
  // Campos UI-managed (ediciones locales)
  "buyer_persona": "Direcciones Médicas - Pharmaceuticals",
  "buyer_persona_name": "Direcciones Médicas - Pharmaceuticals",
  "buyer_persona_display_name": "Dir. Médicas (Pharma)",
  "classified_area": "Direcciones Médicas",
  "classified_sector": "Pharmaceuticals",
  "classification_confidence": 0.85,
  "company_industry": "Pharmaceuticals",
  
  // Campos de gestión interna
  "pipeline_stage": "en_proceso",
  "cierre_status": null,
  "properties": { /* raw HubSpot props */ }
}
```

### Estructura del Documento en `unified_contacts`

```json
{
  "id": "a2336b13-d233-4ace-8094-85acc0d9527d",  // UUID interno
  "name": "Omar Castillo Olascuaga",
  "first_name": "Omar",
  "last_name": "Castillo Olascuaga",
  "email": "omar.castillo@example.com",
  "phone": "+525512345678",
  
  // Campos UI-managed
  "stage": 2,
  "classification": "inbound",
  "buyer_persona": "mateo",
  "tags": [{"id": "...", "name": "Tag1", "type": "manual"}],
  "notes": "Nota del usuario...",
  "companies": [{"company_id": "...", "company_name": "Boehringer", "is_primary": true}],
  "roles": ["deal_maker", "student"],
  
  // Source tracking
  "source": "linkedin_connections_mg",
  "source_details": {"imported_by": "MG", ...},
  
  // Timestamps
  "created_at": "2026-02-07T02:43:36.349599+00:00",
  "updated_at": "2026-02-07T02:43:36.349599+00:00"
}
```

---

## 3️⃣ PUNTOS DE PERSISTENCIA IDENTIFICADOS

### Flujo de Escritura

```
UI Edición → POST/PUT API → MongoDB Collection → Persistido
```

| Acción | Endpoint | Colección | Campos |
|--------|----------|-----------|--------|
| Cambiar buyer_persona | PUT `/hubspot/contact/{id}/buyer-persona` | `hubspot_contacts` | `buyer_persona`, `buyer_persona_name`, etc. |
| Mover a cierre | POST `/hubspot/contact/{id}/move-to-cierre` | `hubspot_contacts` | `pipeline_stage`, `cierre_status` |
| Actualizar contacto | PUT `/contacts/{id}` | `unified_contacts` | `stage`, `tags`, `notes`, `companies`, etc. |
| Cambiar stage | PUT `/contacts/{id}/stage` | `unified_contacts` | `stage` |
| Crear contacto manual | POST `/contacts` | `unified_contacts` | Todo el documento |

---

## 4️⃣ DIAGRAMA LÓGICO DEL FLUJO ANTERIOR

```
┌──────────────┐                    ┌──────────────────┐
│  HUBSPOT     │───── Sync ────────▶│  hubspot_contacts│
│  (Cloud)     │◀──── hs_persona ───│  (Mongo cache)   │
└──────────────┘                    └────────┬─────────┘
                                             │
                                             │ UI Lee/Escribe
                                             ▼
                                    ┌──────────────────┐
                                    │  FRONTEND (UI)   │
                                    │                  │
                                    │ - Clasificación  │
                                    │ - Pipeline       │
                                    │ - Notas          │
                                    └────────┬─────────┘
                                             │
                                             │ Contactos Manuales/CSV
                                             ▼
┌──────────────┐                    ┌──────────────────┐
│  LinkedIn    │───── Import ──────▶│ unified_contacts │
│  CSV         │                    │  (Mongo)         │
└──────────────┘                    └──────────────────┘
```

---

## 5️⃣ CONCLUSIONES

### ¿Las ediciones podían sobrevivir a un reimport?

| Escenario | Resultado | Razón |
|-----------|-----------|-------|
| Re-sync de contactos HubSpot | ✅ SÍ | El sync preservaba clasificaciones existentes (legacy.py:551-562, 651-662) |
| Nuevo contacto desde HubSpot (primera vez) | ❌ NO | No había clasificaciones previas que preservar |
| Contactos en `unified_contacts` | ✅ SÍ | No se tocaban durante sync de HubSpot (colecciones separadas) |
| Import de deals/cases | ⚠️ PARCIAL | Creaba/actualizaba en `unified_contacts`, pero el mapeo dependía del email |

### Riesgos identificados en el backup

1. **Dos colecciones paralelas (`hubspot_contacts` vs `unified_contacts`)**: Los contactos podían existir en ambas sin sincronización entre ellas.

2. **El sync solo preservaba lo que ya estaba en Mongo**: Si un contacto nunca fue sincronizado, no había clasificaciones que preservar.

3. **Dependencia de `id` de HubSpot**: En `hubspot_contacts` el `id` era el HubSpot Contact ID. Si HubSpot cambiaba el ID (raro pero posible), se perdía el link.

4. **No había `hubspot_snapshot`**: Los datos de HubSpot se mezclaban directamente con los campos locales, sin namespace separado.

---

## 📁 ARCHIVOS DE REFERENCIA

| Archivo | Líneas clave | Funcionalidad |
|---------|--------------|---------------|
| `legacy.py` | 385-437 | GET /hubspot/contacts - Lee cache |
| `legacy.py` | 545-677 | POST /hubspot/sync - Sync con preservación |
| `legacy.py` | 664-668 | Upsert en hubspot_contacts |
| `contacts.py` | 818-850 | POST /contacts - Crear en unified_contacts |
| `contacts.py` | 852-926 | PUT /contacts/{id} - Actualizar |
| `cases.py` | 298-575 | Import de deals con asociaciones |
| `database.py` | completo | Conexión y colecciones |

---

## 🔴 IMPLICACIÓN PARA LA MIGRACIÓN ACTUAL

Dado que el backup muestra que:

1. **Las clasificaciones SÍ se guardaban** en `hubspot_contacts`
2. **Pero no todos los contactos de HubSpot tenían cache local**

La colección `hubspot_contacts` del backup contiene las clasificaciones que se deben preservar. Si esa colección aún existe en la base de datos de producción, se pueden recuperar las clasificaciones desde ahí.

**Verificación pendiente:** Confirmar si `hubspot_contacts` en producción contiene los 991 contactos con clasificaciones, y cruzarlos con los >20k contactos de HubSpot durante el sync.
