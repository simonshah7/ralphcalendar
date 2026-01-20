# CampaignOS - Build Specification

## IMPORTANT: Read This First
This is an iterative build. On each run:
1. Check what already exists
2. Build the next logical piece
3. Test that it works
4. Commit with a descriptive message
5. If everything in this spec is complete and working, output: BUILD_COMPLETE

---

## Project Overview

**App Name:** CampaignOS
**Purpose:** Marketing campaign planning tool with timeline visualization
**Target:** Marketing teams managing campaigns across channels

---

## Tech Stack (DO NOT CHANGE)

- **Framework:** Next.js 14+ with App Router
- **Language:** TypeScript (strict mode)
- **Styling:** Tailwind CSS
- **Database:** PostgreSQL via Neon Serverless
- **ORM:** Drizzle ORM
- **Auth:** NONE for MVP (skip authentication entirely)

---

## Database Schema (Neon PostgreSQL)

### Table: calendars
```sql
id          UUID PRIMARY KEY DEFAULT gen_random_uuid()
name        TEXT NOT NULL
created_at  TIMESTAMP DEFAULT NOW()
```

### Table: statuses
```sql
id          UUID PRIMARY KEY DEFAULT gen_random_uuid()
calendar_id UUID NOT NULL REFERENCES calendars(id) ON DELETE CASCADE
name        TEXT NOT NULL
color       TEXT NOT NULL (hex color, e.g., '#3B82F6')
sort_order  INTEGER DEFAULT 0
```
**Default statuses per calendar:**
1. "Considering" - #3B82F6 (blue)
2. "Negotiating" - #F59E0B (amber)
3. "Committed" - #10B981 (green)

### Table: swimlanes
```sql
id          UUID PRIMARY KEY DEFAULT gen_random_uuid()
calendar_id UUID NOT NULL REFERENCES calendars(id) ON DELETE CASCADE
name        TEXT NOT NULL
sort_order  INTEGER DEFAULT 0
```

### Table: campaigns
```sql
id          UUID PRIMARY KEY DEFAULT gen_random_uuid()
calendar_id UUID NOT NULL REFERENCES calendars(id) ON DELETE CASCADE
name        TEXT NOT NULL
```

### Table: activities
```sql
id          UUID PRIMARY KEY DEFAULT gen_random_uuid()
calendar_id UUID NOT NULL REFERENCES calendars(id) ON DELETE CASCADE
swimlane_id UUID NOT NULL REFERENCES swimlanes(id) ON DELETE CASCADE
status_id   UUID NOT NULL REFERENCES statuses(id)
campaign_id UUID REFERENCES campaigns(id) ON DELETE SET NULL (optional)
title       TEXT NOT NULL
start_date  DATE NOT NULL
end_date    DATE NOT NULL
description TEXT
cost        DECIMAL(12,2) DEFAULT 0
currency    TEXT DEFAULT 'USD' (enum: USD, GBP, EUR)
region      TEXT DEFAULT 'US' (enum: US, EMEA, ROW)
tags        TEXT (comma-separated)
color       TEXT (optional hex color override)
created_at  TIMESTAMP DEFAULT NOW()
```

---

## API Routes

### Calendars
- `GET /api/calendars` - List all calendars
- `POST /api/calendars` - Create calendar (returns calendar with default 3 statuses)
- `GET /api/calendars/[id]` - Get calendar with all related data
- `PUT /api/calendars/[id]` - Update calendar name
- `DELETE /api/calendars/[id]` - Delete calendar (cascades)

### Statuses
- `GET /api/statuses?calendarId=` - List statuses for calendar
- `POST /api/statuses` - Create status
- `PUT /api/statuses/[id]` - Update status
- `DELETE /api/statuses/[id]` - Delete status

### Swimlanes
- `GET /api/swimlanes?calendarId=` - List swimlanes
- `POST /api/swimlanes` - Create swimlane
- `PUT /api/swimlanes/[id]` - Update swimlane
- `DELETE /api/swimlanes/[id]` - Delete swimlane (cascades activities)

### Campaigns
- `GET /api/campaigns?calendarId=` - List campaigns
- `POST /api/campaigns` - Create campaign
- `PUT /api/campaigns/[id]` - Update campaign
- `DELETE /api/campaigns/[id]` - Delete campaign

### Activities
- `GET /api/activities?calendarId=` - List activities (with optional filters)
- `POST /api/activities` - Create activity
- `PUT /api/activities/[id]` - Update activity
- `DELETE /api/activities/[id]` - Delete activity

---

## UI Layout

### Header (Always Visible)
```
[Logo: CampaignOS] [Timeline|Calendar|Table tabs] [Workspace Dropdown ▼] [Export btn] [+ New Activity btn]
```

### Below Header
```
[Search input] [Campaign filter ▼] [Status filter ▼] [Theme toggle 🌙/☀️]
```

### Main Content Area
- Shows currently selected view (Timeline, Calendar, or Table)
- Full height minus header

---

## Views

### 1. Timeline View (PRIMARY - Build First)

**Layout:**
- Left sidebar: List of swimlanes (sortable by drag)
- Main area: Horizontal timeline with activities as bars
- X-axis: Time (days/weeks/months)
- Y-axis: Swimlanes as rows

**Zoom Levels:**
- Year view: 12 months visible, ~4px per day
- Quarter view: 3 months visible, ~10px per day
- Month view: 1 month visible, ~30px per day
- User can zoom in/out with +/- buttons or scroll

**Interactions:**
- Click + drag on empty space → creates activity (opens modal with dates pre-filled)
- Click activity → opens edit modal
- Drag activity horizontally → changes dates
- Drag activity vertically → changes swimlane
- Drag activity edges → resize (changes start or end date)

**Activity Bar Display:**
- Background color: status color (or custom color if set)
- Text: Activity title (truncated if too long)
- On hover: Show tooltip with title, dates, status

**Today Line:**
- Vertical red line indicating current date

### 2. Calendar View

**Layout:**
- Standard month calendar grid (7 columns for days)
- Navigation: < Previous Month | Month Year | Next Month >

**Activity Display:**
- Multi-day activities show as horizontal bars spanning days
- Single-day activities show as small blocks on that day
- Color: status color (or custom override)
- Text: Activity title (truncated)

**Interactions:**
- Click activity → opens edit modal
- Click empty day → opens create modal with date pre-filled

### 3. Table View

**Layout:**
- Spreadsheet-style table with columns
- Sortable column headers (click to sort)

**Default Columns (user can show/hide via column picker):**
| Column | Type |
|--------|------|
| Title | Text (inline editable) |
| Status | Dropdown (inline editable) |
| Start Date | Date picker (inline editable) |
| End Date | Date picker (inline editable) |
| Swimlane | Dropdown (inline editable) |
| Campaign | Dropdown (inline editable) |
| Cost | Number (inline editable) |
| Currency | Dropdown (inline editable) |
| Region | Dropdown (inline editable) |

**Interactions:**
- Click cell → inline edit
- Click row → selects row (for future bulk actions)
- Column header → sort ascending/descending

---

## Modals

### Activity Create/Edit Modal

**Layout:** Simple scrollable form

**Fields (in order):**
1. Title* (text input) - REQUIRED
2. Start Date* (date picker) - REQUIRED
3. End Date* (date picker) - REQUIRED
4. Status* (dropdown of calendar's statuses) - REQUIRED
5. Swimlane* (dropdown) - REQUIRED
6. Campaign (dropdown, includes "None" option) - optional
7. Description (textarea)
8. Cost (number input)
9. Currency (dropdown: USD, GBP, EUR)
10. Region (dropdown: US, EMEA, ROW)
11. Tags (text input, comma-separated)
12. Color (color picker, optional override)

**Buttons:**
- [Cancel] [Save]
- If editing existing: [Delete] button (shows confirm dialog)

**Validation:**
- Title cannot be empty
- End date must be >= start date
- Show inline errors

### Delete Confirmation Dialog
```
Are you sure you want to delete "[item name]"?
This action cannot be undone.
[Cancel] [Delete]
```

### Export Modal

**Options:**
- Date range: From [date picker] To [date picker]
- Default: Current month
- Quick selects: This Month, This Quarter, This Year, All Time

**Button:** [Export as PNG]

**Behavior:** Captures timeline view as PNG image and downloads

### Create Calendar Modal
```
Calendar Name: [________________]
[Cancel] [Create]
```

---

## First-Time Experience

When app loads with no calendars:
1. Show empty state: "Welcome to CampaignOS"
2. Prominent button: [Create Your First Calendar]
3. On click → Create Calendar modal
4. After creation → User lands on empty Timeline view
5. Show helper text: "Click and drag on the timeline to create your first activity, or add swimlanes first"

---

## Status Management

**Access:** Right-click on any status badge/indicator → context menu

**Context Menu Options:**
- Edit Status → opens inline edit for name/color
- Delete Status → confirm dialog (only if no activities use it)
- Add New Status → adds new status row

**Also:** In a Settings/Manage area accessible from workspace dropdown:
- List all statuses with drag handles for reordering
- Edit name, color inline
- Delete button (disabled if status in use)
- [+ Add Status] button at bottom

---

## Workspace (Calendar) Switcher

**Location:** Header dropdown

**Display:**
```
[Current Calendar Name ▼]
```

**Dropdown Contents:**
- List of all calendars
- Divider
- [+ Create New Calendar]
- [Manage Calendars] → opens modal to rename/delete calendars

---

## Theme Support

**Toggle:** Sun/moon icon in filter bar

**Light Theme:**
- Background: White (#FFFFFF)
- Surface: Gray-50 (#F9FAFB)
- Text: Gray-900 (#111827)
- Borders: Gray-200 (#E5E7EB)

**Dark Theme:**
- Background: Gray-900 (#111827)
- Surface: Gray-800 (#1F2937)
- Text: Gray-100 (#F3F4F6)
- Borders: Gray-700 (#374151)

**Persist:** Save preference to localStorage

---

## Mobile Responsive Requirements

**Breakpoints:**
- Desktop: >= 1024px (full layout)
- Tablet: 768px - 1023px (collapsible sidebar)
- Mobile: < 768px (stacked layout, simplified timeline)

**Mobile Timeline:**
- Horizontal scroll for timeline
- Swimlanes stack vertically
- Tap to select, tap again to edit

**Mobile Table:**
- Horizontal scroll
- Simplified columns (Title, Status, Dates)

**Mobile Calendar:**
- Same as desktop, just smaller

---

## Data Validation Rules

### Activity
- title: Required, min 1 character
- start_date: Required, valid date
- end_date: Required, valid date, >= start_date
- swimlane_id: Required, must exist
- status_id: Required, must exist in calendar's statuses
- campaign_id: Optional, if provided must exist
- cost: Optional, must be >= 0
- currency: Must be one of: USD, GBP, EUR
- region: Must be one of: US, EMEA, ROW

### Calendar
- name: Required, min 1 character

### Swimlane
- name: Required, min 1 character

### Campaign
- name: Required, min 1 character

### Status
- name: Required, min 1 character
- color: Required, valid hex color

---

## Error Handling

**API Errors:**
- Return JSON: `{ error: "Human readable message" }`
- Status codes: 400 (validation), 404 (not found), 500 (server)

**UI Errors:**
- Show toast notification for transient errors
- Show inline errors for form validation
- Show error state for failed data loads with retry button

---

## File Structure

```
/app
  /api
    /calendars
      route.ts
      [id]/route.ts
    /statuses
      route.ts
      [id]/route.ts
    /swimlanes
      route.ts
      [id]/route.ts
    /campaigns
      route.ts
      [id]/route.ts
    /activities
      route.ts
      [id]/route.ts
  page.tsx (main app)
  layout.tsx
  globals.css

/components
  Header.tsx
  FilterBar.tsx
  TimelineView.tsx
  CalendarView.tsx
  TableView.tsx
  ActivityModal.tsx
  CreateCalendarModal.tsx
  ExportModal.tsx
  ConfirmDialog.tsx
  WorkspaceSwitcher.tsx
  ThemeToggle.tsx

/db
  index.ts (drizzle client)
  schema.ts (drizzle schema)

/lib
  utils.ts (helper functions)

/drizzle
  (migration files)

drizzle.config.ts
```

---

## Build Order (Follow This Sequence)

### Phase 1: Foundation
1. Set up Next.js project with TypeScript, Tailwind
2. Configure Drizzle ORM with Neon
3. Create database schema and run migrations
4. Build basic API routes (CRUD for all entities)

### Phase 2: Core UI
5. Build Header component with placeholder tabs
6. Build empty state / first-time experience
7. Build Create Calendar modal
8. Build Activity modal (create/edit form)

### Phase 3: Timeline View
9. Build Timeline view layout (swimlanes sidebar + timeline area)
10. Render activities as bars on timeline
11. Implement drag to create activity
12. Implement drag to move activity (change dates)
13. Implement drag to change swimlane
14. Implement resize to change duration
15. Add zoom controls
16. Add today line

### Phase 4: Other Views
17. Build Calendar view (month grid)
18. Build Table view with inline editing

### Phase 5: Polish
19. Add filters (search, campaign, status)
20. Add export functionality (PNG)
21. Add theme toggle (light/dark)
22. Add status management UI
23. Make responsive for mobile
24. Test all interactions

---

## Success Criteria

The build is complete when:
- [ ] Can create/switch calendars
- [ ] Can create/edit/delete swimlanes
- [ ] Can create/edit/delete campaigns
- [ ] Can create/edit/delete custom statuses per calendar
- [ ] Can create activities by clicking and dragging on timeline
- [ ] Can move activities by dragging (changes dates or swimlane)
- [ ] Can resize activities (changes duration)
- [ ] Can edit activities via modal
- [ ] Can delete activities with confirmation
- [ ] Timeline view works with zoom levels
- [ ] Calendar view shows activities as bars
- [ ] Table view allows inline editing
- [ ] Filters work (search, campaign, status)
- [ ] Export to PNG works
- [ ] Light/dark theme toggle works
- [ ] Mobile responsive

When ALL criteria are met, output: BUILD_COMPLETE

---

## Environment Variables Needed

```
DATABASE_URL=postgresql://...@neon.tech/...?sslmode=require
```

---

## DO NOT

- Do NOT add authentication (Phase 2)
- Do NOT add user management (Phase 2)
- Do NOT add sharing/permissions (Phase 2)
- Do NOT add comments/notifications (Phase 2)
- Do NOT add recurring activities (Phase 2)
- Do NOT add bulk operations (Phase 2)
- Do NOT over-engineer - keep it simple
- Do NOT use external state management (Redux, Zustand) - use React state
- Do NOT create separate apps - this is a single Next.js app
