# CampaignOS — Application Overview

## What It Is

CampaignOS is a marketing campaign planning and timeline visualization tool. It replaces spreadsheet-based campaign planning with an interactive, timeline-first interface where marketing teams can plan, organize, and track campaigns across channels, regions, and time periods.

**Target users:** Marketing Managers, Campaign Coordinators, Marketing Directors, Agency Partners.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router) + React 19 |
| Language | TypeScript (strict mode) |
| Styling | Tailwind CSS 4 |
| Animation | Framer Motion 12 |
| Database | PostgreSQL via Neon Serverless |
| ORM | Drizzle ORM 0.45 |
| Export | html-to-image, html2canvas, pptxgenjs (PNG/CSV/PPTX) |
| E2E Tests | Playwright 1.52 |
| Deployment | Vercel |

---

## Project Structure

```
/app
  /api
    /calendars/         # Calendar CRUD (workspace containers)
    /statuses/          # Status label management per calendar
    /swimlanes/         # Swimlane (channel) CRUD
    /campaigns/         # Campaign grouping CRUD
    /activities/        # Activity (task) CRUD
    /ai/
      /copilot/         # Natural language analytics queries
      /campaign-brief/  # AI brief → activities generation
      /budget-insights/ # Budget analysis
    /upload/            # File/attachment uploads
  page.tsx              # Main entry point — global state, data fetching, view switching
  layout.tsx            # Root layout
  globals.css           # Global styles

/components
  Header.tsx            # Top nav: workspace switcher, view tabs, actions
  FilterBar.tsx         # Search, campaign filter, status filter
  TimelineView.tsx      # Primary Gantt-like timeline (drag-and-drop)
  CalendarView.tsx      # Month grid view
  TableView.tsx         # Spreadsheet view with inline editing
  DashboardView.tsx     # Analytics/metrics dashboard
  ActivityModal.tsx     # Create/edit activity form
  CreateCalendarModal.tsx
  ExportModal.tsx       # PNG/CSV/PPTX export
  WorkspaceSwitcher.tsx # Calendar switcher dropdown
  SwimlaneSidebar.tsx   # Left sidebar for swimlane management
  AICopilot.tsx         # AI Q&A interface
  AIBriefGenerator.tsx  # AI brief → activities
  StatusDropdown.tsx, CampaignDropdown.tsx, SwimlaneDropdown.tsx
  ThemeToggle.tsx       # Light/dark mode
  ConfirmDialog.tsx

/db
  schema.ts             # All table definitions, enums, types (Drizzle)
  index.ts              # Database client factory

/lib
  utils.ts              # Helpers: date math, formatting, color contrast

/drizzle                # SQL migrations

/e2e                    # Playwright E2E tests + helpers
```

---

## Database Schema

**11 tables** in PostgreSQL:

| Table | Purpose |
|-------|---------|
| `users` | User accounts (email, name, passwordHash, role, avatarUrl) |
| `calendars` | Workspace containers (name, ownerId, isTemplate) |
| `calendar_permissions` | Per-calendar access control (userId, calendarId, accessType) |
| `statuses` | Activity status labels per calendar (name, color, sortOrder) |
| `swimlanes` | Organizational lanes/channels per calendar (name, budget, sortOrder) |
| `campaigns` | Campaign groupings per calendar (name, budget) |
| `activities` | Core entity — individual tasks/items (see fields below) |
| `activity_comments` | Discussion threads on activities |
| `activity_history` | Audit trail (fieldName, oldValue, newValue) |
| `activityTypes` | Category definitions (e.g., Event, Webinar) |
| `vendors` | Third-party service providers |

**Activity fields (rich tracking):**
- Identity: `id`, `calendarId`, `swimlaneId`, `statusId`, `campaignId`, `typeId`, `vendorId`
- Core: `title`, `startDate`, `endDate`, `description`, `tags`, `color`
- Financial: `cost`, `actualCost`, `currency` (US$/UK£/EUR), `region` (US/EMEA/ROW)
- Performance: `expectedSaos`, `targetSaos`, `actualSaos`, `pipelineGenerated`, `revenueGenerated`
- Recurrence: `recurrenceFrequency`, `recurrenceEndDate`, `recurrenceCount`, `parentActivityId`, `isRecurrenceParent`
- Metadata: `dependencies` (JSONB), `attachments` (JSONB), `slackChannel`, `outline`, `inlineComments`

**Enums:**
- `campaignStatus`: Considering, Negotiating, Committed
- `currency`: US$, UK£, EUR
- `region`: US, EMEA, ROW
- `userRole`: User, Manager, Admin
- `accessType`: view, edit, copy
- `recurrenceFrequency`: none, daily, weekly, biweekly, monthly, quarterly

---

## API Endpoints (REST, JSON)

| Resource | Methods | Notes |
|----------|---------|-------|
| `/api/calendars` | GET, POST | List all / create (auto-creates 3 default statuses) |
| `/api/calendars/[id]` | GET, PUT, DELETE | Full calendar data fetch (includes statuses, swimlanes, campaigns, activities) |
| `/api/statuses` | GET, POST | `?calendarId=X` |
| `/api/statuses/[id]` | PUT, DELETE | |
| `/api/swimlanes` | GET, POST | `?calendarId=X` |
| `/api/swimlanes/[id]` | PUT, DELETE | Delete cascades activities |
| `/api/campaigns` | GET, POST | `?calendarId=X` |
| `/api/campaigns/[id]` | PUT, DELETE | |
| `/api/activities` | GET, POST | `?calendarId=X`, validates dates/required fields |
| `/api/activities/[id]` | PUT, DELETE | Supports partial updates |
| `/api/ai/copilot` | POST | Natural language analytics (spend, ROI, budget) |
| `/api/ai/campaign-brief` | POST | Generate activities from brief text |
| `/api/ai/budget-insights` | POST | Budget analysis |
| `/api/upload` | POST | File/attachment uploads |

---

## UI Views

### 1. Timeline View (Primary)
- Gantt-like horizontal timeline with swimlane rows
- Activities rendered as colored bars spanning date ranges
- **Zoom levels:** Year (4px/day), Quarter (24px/day), Month (30px/day)
- **Interactions:** Drag to create, drag to move, drag edges to resize, drag vertically to change swimlane
- Today-line indicator, configurable card styling

### 2. Calendar View
- Traditional month grid (7-column)
- Activities shown as colored blocks spanning days
- Click empty day to create, click activity to edit

### 3. Table View
- Spreadsheet layout with sortable columns
- Inline editing support
- Columns: Title, Status, Start/End Date, Swimlane, Campaign, Cost, Currency, Region

### 4. Dashboard View
- Analytics and metrics
- Budget tracking by swimlane/campaign
- Performance indicators (SAOs, pipeline, revenue)

---

## Key Features

- **Multi-calendar workspaces** — Switch between independent calendars
- **Drag-and-drop** — Create, move, resize activities; reorder swimlanes
- **Filtering** — By search text, campaign, status
- **Export** — PNG (image), CSV (spreadsheet), PPTX (PowerPoint)
- **AI Copilot** — Natural language queries for analytics (spend, ROI, budget status)
- **AI Brief Generator** — Convert marketing brief text into structured activities
- **Budget tracking** — At swimlane and campaign level with actual vs. planned
- **Recurrence** — Daily, weekly, bi-weekly, monthly, quarterly recurring activities
- **Activity history** — Full audit trail of field changes
- **Comments** — Discussion threads on activities
- **Slack integration** — Activities can reference Slack channels
- **Attachments** — File upload and storage on activities
- **Dependencies** — Track activity dependencies (JSONB)
- **Light/dark theme** — Persisted to localStorage
- **Responsive** — Mobile, tablet, desktop

---

## Authentication Status

**Currently: No authentication (MVP).** A hardcoded default user (`default@campaignos.local`) is auto-created. The database schema fully supports users, roles (User/Manager/Admin), and per-calendar permissions (view/edit/copy), but auth is not yet implemented in the UI/API layer.

---

## Environment & Scripts

```bash
# Required env var
DATABASE_URL=postgresql://user:password@host.neon.tech/dbname?sslmode=require

# Key commands
npm run dev          # Start dev server
npm run build        # Build (runs drizzle-kit push first)
npm start            # Start production server
npm run db:push      # Sync database schema
npm run db:migrate   # Run migrations
npm run lint         # ESLint
```

---

## Architecture Notes

- **State management:** All in `app/page.tsx` via React useState — no external state library. The main page fetches all data on mount and passes it down as props.
- **Data fetching:** Client-side fetch calls to `/api/*` routes. No server components for data — everything is client-rendered.
- **Database access:** Drizzle ORM with a factory pattern in `db/index.ts` that selects Neon serverless or node-postgres based on environment.
- **No external auth provider** yet — schema is ready for it.
- **Migrations:** Managed by drizzle-kit with SQL files in `/drizzle`.
