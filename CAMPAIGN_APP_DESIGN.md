# CampaignOS — Event & Campaign Management Design

## Design Context

This document captures the design decisions for extending CampaignOS from a timeline-based marketing calendar into a full event and campaign management platform. It is informed by discovery conversations with the campaign management team.

---

## Core Concepts

### Campaign ↔ Event Relationship: Peers

Campaigns and events are **independent, peer-level entities** that can be linked but don't have a strict parent-child hierarchy. A campaign might span multiple events, an event might participate in multiple campaigns, or either can exist independently.

**Examples:**
- A "Q3 Pipeline Push" campaign links to Re:Invent, Gartner Summit, and 3 hosted dinners
- A sponsored booth at KubeCon might not belong to any campaign yet
- A campaign could be purely digital with no events at all

**Implication:** The data model needs a many-to-many relationship between campaigns and events, not a simple foreign key.

### Events Have Flexible Sub-Events

Each event can have a **variable set of sub-events** — there is no fixed template. One event might have a workshop + dinners + 1:1s; another might have an executive briefing + hospitality suite + demo stations.

**Sub-event types seen in the wild:**
- Workshops / breakout sessions
- 1:1 customer meetings
- Hosted dinners / receptions
- Booth / demo stations
- Executive briefings
- Hospitality suites
- Speaking sessions
- After-parties / social events
- Travel days

**Implication:** Sub-events should be freeform, not constrained to a fixed enum. Allow user-defined types with optional templates.

---

## Attendee Management

### Two Groups: Internal Team + Customers

| Group | What We Track |
|-------|---------------|
| **Internal (Redwood staff)** | Who's attending, their role (presenting, staffing booth, supporting), travel status, which sub-events they're part of |
| **Customers** | Who's been invited, confirmation status, which sub-events (especially 1:1s and dinners), account/company affiliation |

**Not in scope (for now):** Prospect/target account tracking. The focus is on confirmed attendees, not pipeline-driven outreach lists.

### Pass Allocation: Fixed Pool

The event organizer provides a fixed number of passes. The campaign manager allocates them based on criteria (seniority, customer-facing role, etc.). No request/approval workflow needed — the campaign manager decides directly.

**Data needs:**
- `total_passes` on the event
- `allocated_passes` count (derived from attendee records)
- Each internal attendee marked as "has pass" or "needs pass"

---

## Readiness Checklist

### Campaign Manager Owns Everything

A single campaign manager is responsible for tracking all readiness items. No need for distributed task assignment or delegation workflows.

**Checklist items are event-level**, with a standard set that the campaign manager checks off:

| Category | Example Items |
|----------|---------------|
| **Content** | Slides/deck ready, demo prepared, talk track finalized |
| **Logistics** | Flights booked, hotels booked, ground transport arranged |
| **Materials** | Swag ordered, booth materials shipped, signage confirmed |
| **Registrations** | Passes allocated, attendees registered, badge info submitted |
| **Comms** | Slack channel created, logistics deck sent, pre-event brief done |

**Implication:** Simple checkbox list per event. Items are freeform text + done/not-done status. No assignee field needed. Campaign manager can add/remove items.

---

## Integrations

### Slack: Push Notifications

The app should **send structured updates to Slack channels** — not just store a link.

**Notification triggers:**
- Readiness item status changes (e.g., "Slides marked as ready for Re:Invent 2026")
- New attendee confirmed
- Milestone approaching (e.g., "3 days until Re:Invent — 2 checklist items still open")
- Event status changes (e.g., moved from Negotiating → Committed)

**Not in scope:** Auto-creating Slack channels, pulling conversation context back, or full bidirectional sync.

**Implementation approach:**
- Slack Incoming Webhook per event (configured by campaign manager)
- App fires webhook on relevant state changes
- Simple, formatted message blocks (not interactive Slack apps)

### Google Calendar: Sub-Event Invites

Individual calendar entries for each sub-event, not just the top-level event.

**What gets calendar entries:**
- Each workshop session (with location, agenda link)
- Each dinner/reception (with venue, dress code)
- Each 1:1 meeting (with customer name, meeting context)
- Travel days (departure/return)

**Who gets invited:**
- Internal attendees assigned to that sub-event
- Customer attendees (for relevant sub-events like 1:1s and dinners)

**Implementation approach:**
- Google Calendar API integration
- Campaign manager triggers "send invites" per sub-event
- Calendar events include: title, time, location, description with links back to CampaignOS

### Google Sites: Event Listing Portal

A lightweight internal portal showing upcoming events so other teams (sales, SEs) can see what's happening.

**Published info:**
- Event name, dates, location
- Status (Considering / Negotiating / Committed)
- Campaign manager contact
- Link to Slack channel

**Not in scope:** Detailed logistics, post-event reporting, or self-service pass requests on the portal.

**Implementation approach:**
- Auto-generate a simple HTML/JSON feed that Google Sites can embed via iframe or Apps Script
- Or: expose a read-only `/api/portal/events` endpoint that a Google Sites page consumes

---

## Prior Year Comparison

### Same Event, Year over Year

The primary comparison is the same named event across years: "Re:Invent 2026 vs Re:Invent 2025."

**Key metrics to compare:**
- Total cost (planned vs actual)
- Number of attendees (internal + customer)
- Number of 1:1 meetings held
- Number of sub-events
- Readiness timeline (were we more prepared this year?)
- Pass utilization (allocated vs total)

**Data model implication:**
- Events need a `series_name` or tag that links them across years (e.g., "Re:Invent")
- Or: explicit "prior_event_id" foreign key linking this year's event to last year's
- Dashboard view showing side-by-side metrics

---

## Logistics Deck

### One-Time Artifact

The logistics deck is created once, a few weeks before the event, and shared out. It does not evolve.

**Contents typically include:**
- Event overview (what, when, where)
- Who's going and their roles
- Agenda / schedule of sub-events
- Travel & hotel details
- Key contacts

**Implementation approach:**
- "Generate Logistics Deck" button on the event detail page
- Pulls current event data and renders a PPTX (using existing `pptxgenjs` dependency)
- One-click download, no ongoing sync needed

---

## Scale & Portfolio Management

### 15–50 Active Events

At any given time, the team manages 15–50 events across all campaign managers. This means:

- **Dashboard is critical** — need at-a-glance view of all events, their status, and upcoming deadlines
- **Filtering & search** — by status, campaign manager, date range, campaign association
- **Timeline view** — the existing Gantt view works well for seeing events across time
- **No heavy automation needed** — the volume is manageable with good tooling, not requiring workflow automation

### Event Lifecycle: 1–3 Months

Typical timeline from contract/decision to event completion:

```
Week 1-2:   Event approved, status = Considering/Negotiating
Week 3-4:   Committed, Slack channel created, passes allocated
Week 5-8:   Sub-events planned, attendees confirmed, content prep begins
Week 9-10:  Logistics finalized, deck generated & shared
Week 11-12: Event week — execution
Week 12+:   Post-event — actuals recorded, YoY data captured
```

---

## Proposed Data Model Extensions

Building on the existing schema, the following new tables/fields are needed:

### New Tables

```
events
  id              UUID PRIMARY KEY
  calendar_id     UUID → calendars
  title           TEXT NOT NULL
  series_name     TEXT                -- for YoY linking (e.g., "Re:Invent")
  start_date      DATE NOT NULL
  end_date        DATE NOT NULL
  location        TEXT
  venue           TEXT
  status_id       UUID → statuses
  total_passes    INTEGER DEFAULT 0
  slack_webhook   TEXT                -- Slack incoming webhook URL
  description     TEXT
  prior_event_id  UUID → events       -- explicit YoY link
  created_at      TIMESTAMP

sub_events
  id              UUID PRIMARY KEY
  event_id        UUID → events
  title           TEXT NOT NULL
  type            TEXT                -- freeform: "workshop", "dinner", "1:1", etc.
  start_datetime  TIMESTAMP NOT NULL
  end_datetime    TIMESTAMP NOT NULL
  location        TEXT
  description     TEXT
  calendar_event_id TEXT              -- Google Calendar event ID (after sync)
  sort_order      INTEGER DEFAULT 0

event_attendees
  id              UUID PRIMARY KEY
  event_id        UUID → events
  name            TEXT NOT NULL
  email           TEXT
  company         TEXT                -- for customers
  attendee_type   TEXT NOT NULL       -- "internal" | "customer"
  role            TEXT                -- "presenting", "staffing", "attending", etc.
  has_pass        BOOLEAN DEFAULT false
  travel_status   TEXT                -- "not_booked", "booked", "confirmed"
  notes           TEXT

sub_event_attendees
  id              UUID PRIMARY KEY
  sub_event_id    UUID → sub_events
  attendee_id     UUID → event_attendees

checklist_items
  id              UUID PRIMARY KEY
  event_id        UUID → events
  title           TEXT NOT NULL
  is_done         BOOLEAN DEFAULT false
  category        TEXT                -- "content", "logistics", "materials", "registrations", "comms"
  due_date        DATE
  sort_order      INTEGER DEFAULT 0

campaign_events                       -- many-to-many junction
  campaign_id     UUID → campaigns
  event_id        UUID → events
  PRIMARY KEY (campaign_id, event_id)
```

### Modified Tables

```
campaigns (existing, add fields)
  + description   TEXT
  + owner_name    TEXT                -- campaign manager name
  + owner_email   TEXT
```

---

## UI Additions

### Event Detail Page (`/events/[id]`)

A dedicated page for managing a single event, with tabs or sections:

| Section | Content |
|---------|---------|
| **Overview** | Title, dates, location, status, campaign links, pass count |
| **Sub-Events** | List of sub-events with add/edit/delete, "send calendar invites" button |
| **Attendees** | Table of internal + customer attendees, pass allocation, travel status |
| **Checklist** | Grouped checklist with checkboxes, add/remove items |
| **Prior Year** | Side-by-side metrics if a prior event is linked |
| **Actions** | Generate logistics deck, send Slack update |

### Events List / Dashboard

- Card or table view of all events
- Filterable by status, date range, campaign
- Shows: title, dates, status, checklist completion %, attendee count, pass utilization
- Quick-access to event detail page

### Timeline Integration

Events appear on the existing timeline view as bars (like activities do today). Sub-events can optionally appear as nested items within the event's row.

---

## What's NOT In This Design

Intentionally excluded based on discovery:

- **Prospect/target account tracking** — focus is on confirmed attendees only
- **Distributed task ownership** — campaign manager owns everything
- **Auto-generated Slack channels** — just push notifications via webhook
- **Living logistics deck** — one-time generation is sufficient
- **Request-based pass allocation** — campaign manager decides directly
- **Full scheduling/availability** — sub-event times are set manually, no conflict detection
- **Post-event portal content** — portal is listing-only, no lifecycle hub
- **Portfolio trend analysis** — YoY is same-event only, not cross-portfolio

---

## Resolved Decisions

1. **Event vs Activity: Coexist.** Events are a new entity alongside activities. Activities remain for non-event marketing work (content calendar, campaigns without events). No overlap — they serve different purposes.

2. **Campaign manager identity: Phase 2.** Defer auth and user identity to Phase 2. For now, campaign manager is not explicitly tracked in the system.

3. **Slack webhook storage: Admin settings area.** Slack webhook URLs are configured in a dedicated admin/settings section of the app, not per-event in the DB and not via environment variables.

4. **Google Calendar integration: Phase 2.** Build the sub-event data model and scheduling UI in Phase 1, but defer Google Calendar OAuth and invite syncing to Phase 2. Users create calendar invites manually for now.

5. **Migration path: None needed.** Activities and events are independent entities. No conversion or migration of existing activities. Users create events fresh going forward.

---

## Build Phases

### Phase 1 (Core Event Management)
- Events entity (CRUD, detail page, list/dashboard)
- Sub-events with flexible types
- Attendee management (internal + customer)
- Pass allocation (fixed pool)
- Readiness checklist
- Logistics deck generation (PPTX)
- YoY comparison (same event)
- Slack push notifications via webhook (configured in admin settings)
- Event listing feed for Google Sites portal
- Timeline integration (events as bars alongside activities)

### Phase 2 (Integrations & Identity)
- Google Calendar OAuth + sub-event invite syncing
- Campaign manager identity / auth
- Any additional Slack capabilities beyond webhooks
