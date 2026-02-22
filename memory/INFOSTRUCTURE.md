# INFOSTRUCTURE - Technical Documentation

## Traffic Light Logic Summary

This document preserves the traffic light logic for all navigation sections.

**Last Updated:** January 29, 2026 (Session 14 - Exhaustive Review)

---

### API Endpoint

**URL:** `GET /api/scheduler/traffic-light`
**Response Format:**
```json
{
  "success": true,
  "timestamp": "2026-01-29T...",
  "week_key": "2026-W04",
  "status": {
    "1.1.1.1": {"status": "green", "contacts_this_week": 235, "goal": 50},
    ...
  }
}
```

---

### General Rules

**Color Meanings:**
- 🟢 **GREEN**: All goals met, tasks completed, on schedule
- 🟡 **YELLOW**: Requires attention, partially completed, moderately overdue
- 🔴 **RED**: Critical issues, severely overdue, errors detected
- ⚫ **GRAY**: Feature not implemented (Coming Soon)

**Propagation Logic:**
- Parent = GRAY if ALL children are GRAY
- Parent = RED if ANY child is RED
- Parent = YELLOW if ANY child is YELLOW (and none red)
- Parent = GREEN only if ALL children are GREEN

**Source Code:** `/app/backend/routers/scheduler.py` (lines 507-850+)
**Navigation Config:** `/app/frontend/src/components/Layout.jsx`

---

## 1. PROSPECT (Step 1)

### 1.1 Find

| Module | trafficId | Weekly Goal | Green | Yellow | Red |
|--------|-----------|-------------|-------|--------|-----|
| 1.1.1.1 By Molecules | `1.1.1.1` | 50 contacts | ≥50 | >0, <50 | 0 |
| 1.1.1.2 By Post | `1.1.1.2` | 50 contacts | ≥50 | >0, <50 | 0 |
| 1.1.1.3 By Position | `1.1.1.3` | 50 contacts | ≥50 | >0, <50 | 0 or rate limit |
| 1.1.1 Via LinkedIn | `1.1.1` | 150 contacts | Aggregate | Aggregate | Aggregate |
| 1.1.2 Via Google Maps | `1.1.2` | - | **GRAY** | - | - |

**Current Status (verified):**
- 1.1.1.1: 🟢 235 contacts this week
- 1.1.1.2: 🟢 473 contacts this week
- 1.1.1.3: 🔴 0 contacts (needs attention)

### 1.2 Attract (All Coming Soon)

| Module | trafficId | Status |
|--------|-----------|--------|
| 1.2.1 Viral Videos | `1.2.1` | ⚫ GRAY |
| 1.2.2 Long Form Video Search | `1.2.2` | ⚫ GRAY |
| 1.2.3 GEO | `1.2.3` | ⚫ GRAY |
| 1.2.4 SEO | `1.2.4` | ⚫ GRAY |

### 1.3 Connect

| Module | trafficId | Logic | Current |
|--------|-----------|-------|---------|
| 1.3.1 Deal Makers | `1.3.1` | Weekly checkbox per persona | 🟡 0/10 checked |
| 1.3.2 Max LinkedIn Invitations | `1.3.2` | GB + MG profiles checked | 🟢 Both checked |
| 1.3.3 Small Business WhatsApp | `1.3.3` | Checkbox OR 0 pending | 🟢 0 pending |
| 1.3.4 Social Media Followers | `1.3.4` | - | ⚫ GRAY |

---

## 2. NURTURE (Step 2)

### 2.1 Individual

| Module | trafficId | Logic | Current |
|--------|-----------|-------|---------|
| 2.1.1 Import LinkedIn | `2.1.1` | Days since last import (<7 green, 7-30 yellow, >30 red) | 🟢 |
| 2.1.2 Booklets & Cases | `2.1.2` | Coming Soon | ⚫ GRAY |
| 2.1.3 Nurture Deal Makers | `2.1.3` | Stage 2 nurture ratio | 🟢 |

### 2.2 Bulk

| Module | trafficId | Logic | Current |
|--------|-----------|-------|---------|
| 2.2.1 Website | `2.2.1` | Coming Soon | ⚫ GRAY |
| 2.2.2 Campaigns | `2.2.2` | Active campaigns >0 | 🟢 |
| 2.2.3 Testimonials | `2.2.3` | ≥5 green, 1-4 yellow, 0 red | 🟢 |
| 2.2.4 Newsletters | `2.2.4` | Coming Soon (Amazon SES pending) | ⚫ GRAY |
| 2.2.4.1 Email Metrics | `2.2.4.1` | Email events tracked | 🟡 0 events |
| 2.2.5 Learning (LMS) | `2.2.5` | Coming Soon | ⚫ GRAY |
| 2.2.6 Blog | `2.2.6` | Published posts >0 | 🟢 |
| 2.2.6.1 Content AI | `2.2.6.1` | AI history >0 | 🟢 4 generated |
| 2.2.7 Media Relations | `2.2.7` | Events with overdue tasks | 🔴 Overdue tasks |
| 2.2.8 Editorial Relations | `2.2.8` | Events count | 🟡 0 events |
| 2.2.9 Long Form Videos | `2.2.9` | Coming Soon | ⚫ GRAY |
| 2.2.10 Own Events | `2.2.10` | Own events count | 🔴 0 events |
| 2.2.11 Medical Society Events | `2.2.11` | Med society events | 🟢 8 events |
| 2.2.12 Write Books | `2.2.12` | Coming Soon | ⚫ GRAY |

---

## 3. CLOSE (Step 3)

| Module | trafficId | Logic | Current |
|--------|-----------|-------|---------|
| 3.1 Venue Finder | `3.1` | Venues >0 | 🟢 |
| 3.2 Quote Deal Makers | `3.2` | Recent quotes | 🟢 |
| 3.3 Close Deal Makers | `3.3` | Contacts negotiating | 🟢 1 contact |

---

## 4. DELIVER (Step 4)

| Module | trafficId | Logic | Current |
|--------|-----------|-------|---------|
| 4.0 WhatsApp Confirmations | `4.0` | Calendar connected + last execution | 🟢 |
| 4.1 Deliver Deal Makers | `4.1` | Contacts delivering | 🟡 0 contacts |
| 4.2 Coach Students | `4.2` | Time entries this week | 🟢 |
| 4.3 Certificate Students | `4.3` | Pending vs issued | 🟢 |

---

## 5. REPURCHASE (Step 5)

| Module | trafficId | Logic | Current |
|--------|-----------|-------|---------|
| 5.1 Deal Makers for Recommendations | `5.1` | Recommendations requested | - |
| 5.2 Students for Recommendations | `5.2` | Coming Soon | ⚫ GRAY |

---

## All Traffic Light IDs Implemented ✅

All navigation items now have corresponding logic in the `/api/scheduler/traffic-light` endpoint.

---

## API Keys & Credentials Location

All credentials are stored in `/app/backend/.env`:

| Key | Purpose |
|-----|---------|
| `MONGO_URL` | MongoDB connection string |
| `DB_NAME` | Database name (leaderlix) |
| `SECRET_KEY` | JWT signing key |
| `EMERGENT_LLM_KEY` | Emergent AI integration (Gemini, GPT) |
| `GOOGLE_CLIENT_ID` | Google OAuth client |
| `GOOGLE_CLIENT_SECRET` | Google OAuth secret |
| `AWS_ACCESS_KEY_ID` | Amazon SES credentials |
| `AWS_SECRET_ACCESS_KEY` | Amazon SES credentials |
| `AWS_REGION` | AWS region (us-east-2) |
| `SENDER_EMAIL` | SES verified sender (contact@leaderlix.com) |
| `HUBSPOT_TOKEN` | HubSpot CRM integration |
| `APIFY_TOKEN` | Apify scraping API |

---

## Third-Party Integrations

| Service | Purpose | Status |
|---------|---------|--------|
| Amazon SES | Email newsletters & certificates | ⚠️ Sandbox Mode (200/day limit) |
| Apify | Contact scraping | ✅ Active |
| HubSpot | CRM sync | ✅ Active |
| Google OAuth | Authentication (@leaderlix.com) | ✅ Active |
| Google Analytics | Website tracking (G-222876294) | ✅ Active |
| Emergent LLM | AI features (Gemini 2.0 Flash) | ✅ Active |

---

## Database Collections Reference

### Traffic Light Data Sources
| Collection | Used By |
|------------|---------|
| `unified_contacts` | 1.1.1.x, 2.1.3, 3.3, 4.1 |
| `weekly_tasks` | 1.3.1, 1.3.2, 1.3.3 |
| `whatsapp_messages` | 1.3.3 |
| `linkedin_imports` | 2.1.1 |
| `campaigns` | 2.2.2 |
| `testimonials` | 2.2.3 |
| `blog_posts` | 2.2.6 |
| `events` | 2.2.7 |
| `medical_society_events` | 2.2.8 |
| `venues` | 3.1 |
| `quotes` | 3.2 |
| `time_entries` | 4.2 |
| `certificates` | 4.3 |

---

*Last Updated: January 29, 2026 - Session 14*
