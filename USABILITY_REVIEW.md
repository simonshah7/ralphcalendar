# LaunchGrid Usability Review

**Date:** 2026-03-18
**Scope:** Full application review — all 27 components, 15+ API routes, database schema, hooks, utilities, and documentation

---

## 1. Navigation & Information Architecture

### Single-page overload (`app/page.tsx` — 720 lines)
The entire app lives in one page with ~20 `useState` hooks managing calendars, activities, events, modals, filters, and AI tools. There's no URL routing — users can't bookmark or share a specific view, event, or filtered state. Hitting browser back doesn't return to the previous view; it leaves the app entirely.

### Five views, unclear mental model
Timeline, Calendar, Table, Events, and Dashboard are all top-level tabs, but "Events" is a fundamentally different entity from "Activities." Activities live in swimlanes; Events have sub-events, attendees, and checklists. The relationship between these two systems isn't surfaced anywhere in the UI. A user creating an "activity" vs an "event" has no guidance on when to use which.

### No breadcrumbs in Event Detail
`EventDetailView.tsx` (1,313 lines) is a deep, tabbed view with 6 sub-tabs (Overview, Sub-Events, Attendees, Checklist, Comparison, Actions). When a user clicks into an event, there's only a "Back" button. No breadcrumb trail showing Events > [Event Name] > [Tab]. Users lose spatial context.

---

## 2. Data Entry & Forms

### Activity Modal is overwhelming
`ActivityModal.tsx` (821 lines) presents 16+ fields in a single scrollable form. There's no progressive disclosure — a user creating a quick placeholder activity sees the same form as someone entering full budget/SAO metrics. Cost, actualCost, expectedSaos, targetSaos, actualSaos, pipelineGenerated, revenueGenerated are all visible upfront.

### No autosave or draft state
If a user accidentally closes the Activity Modal or Event Detail tabs mid-edit, all unsaved work is lost. There's no confirmation dialog on close-with-unsaved-changes, no localStorage draft persistence.

### Date inputs are raw text
Dates use standard `<input type="date">` which varies wildly across browsers and provides no visual date range context. No date range picker component — start and end dates are separate fields with no visual connection.

### Single-select filters only
`FilterBar.tsx` supports only one campaign filter and one status filter at a time. Users managing 15–50 events across multiple campaigns can't filter by "Campaign A OR Campaign B." This is a significant workflow bottleneck for the target user (Marketing Manager reviewing cross-campaign timelines).

---

## 3. Timeline View (Primary View)

### No undo for drag operations
`useTimelineDrag.ts` handles create/move/resize via drag, but there's no undo. If a user accidentally drags an activity to the wrong date or swimlane, they must manually drag it back or open the edit modal.

### No visual feedback for drag targets
When dragging an activity between swimlanes, there's no highlight on the target swimlane row. Users can't see where the drop will land until they release.

### Zoom levels are coarse
Only 3 zoom levels: Year (4px/day — nearly unreadable), Quarter (24px/day), Month (30px/day). A large jump between Year and Quarter. A "Half-year" or custom range would help users managing 1–3 month event lifecycles.

### No "scroll to today" on timeline
The timeline starts at the first of the current month, but there's no persistent "Today" indicator line or quick "Jump to Today" button as you scroll horizontally.

### No virtual scrolling
The timeline renders all DOM elements at once. `useActivityLayout.ts` computes overlap stacking for every activity. Performance will degrade as data grows.

---

## 4. Calendar View (Minimal Implementation)

### Only month view
`CalendarView.tsx` (184 lines) is the thinnest view. No week view. No day view. No drag-to-create (unlike Timeline).

### Max 2 activities visible per day
Activities are capped at 2 per day cell with a "+N more" link. But clicking "+N more" opens the third activity's edit modal — it doesn't show a list/popover of all activities for that day. This is a broken interaction pattern.

### No multi-day activity spanning
Multi-day activities appear as separate colored bars on each day rather than spanning across cells. A 5-day activity shows 5 separate truncated labels.

---

## 5. Table View

### No bulk operations
`TableView.tsx` supports inline editing for individual cells but has no checkbox selection for bulk operations (bulk status change, bulk delete, bulk campaign assignment). Critical for the "Campaign Coordinator" persona.

### Column state is fragile
Column visibility and order are persisted to localStorage, but there's no "Reset to defaults" option.

---

## 6. Dashboard

### No interactivity on charts
`DashboardView.tsx` (1,000 lines) renders KPI cards and budget breakdowns, but charts are display-only. Users can't click a budget segment to drill into the activities behind it.

### Static date context
Dashboard metrics don't clearly state the date range they cover. No easy way to scope to a specific quarter.

---

## 7. Error Handling & Feedback

### Silent failures on API errors
Many handlers use `console.error` without user-visible feedback. For example, `handleCreateSwimlane` (page.tsx:138): if the API fails, nothing happens.

### No toast/notification system
No toast or notification component anywhere in the codebase. Successful saves, failed operations, and background completions all happen silently.

### No loading states on individual operations
When an activity is being saved, there's no loading indicator on the specific activity bar. The entire calendar data is re-fetched after every mutation (`fetchCalendarData`), causing a full re-render rather than optimistic local updates.

---

## 8. Accessibility

### No keyboard navigation for timeline
The Timeline view is entirely mouse-driven. Activity bars have no `tabIndex`, no `role` attributes, no `aria-label`. Drag operations only work with mouse events.

### Missing ARIA labels on icon-only buttons
Header view switcher buttons, Theme Toggle, Export button, and filter dropdowns rely on visual icons without screen reader context.

### Color-only status differentiation
Statuses are distinguished only by color. No icons, patterns, or text labels on timeline bars to distinguish statuses for color-blind users. WCAG 2.1 AA is claimed but not met.

---

## 9. AI Features Discoverability

### Three separate AI entry points, unclear purpose
AI Copilot, AI Brief Generator, and Voice Agent are accessible from different places. Their distinct purposes aren't explained anywhere.

### Voice Agent blocks text input while listening
In `VoiceAgent.tsx:264`, the text input is `disabled` when `isListening`. If a user starts the mic accidentally, they can't type until they stop listening.

### AI Copilot is regex-based, not actually AI
Despite the name, `app/api/ai/copilot/route.ts` uses regex pattern matching (not any AI model). Users will expect natural language understanding but get brittle keyword matching.

---

## 10. Data Model & Workflow Gaps

### No undo/redo anywhere
Confirmed in SPEC_CERTIFICATION.md as a "known gap." Critical for a planning tool.

### No confirmation on cascading destructive actions
Swimlane delete cascades and deletes all contained activities. Users may not understand the blast radius.

### No saved filter presets
Users must manually set filters each session.

### No user identity
No auth means no audit trail attribution.

---

## Top 5 Most Impactful Improvements

| Priority | Issue | Impact |
|----------|-------|--------|
| **1** | Add toast notifications and visible error handling | Users currently operate blind — they can't tell if saves succeeded or failed |
| **2** | Add URL routing (Next.js App Router) for views, events, and filters | Users can't bookmark, share, or use browser back/forward — breaks fundamental web UX |
| **3** | Add undo/redo for drag operations and edits | Planning tools require low-risk experimentation; users fear making changes they can't reverse |
| **4** | Fix Calendar View "+N more" to show a day popover, add multi-day spanning | The second most-used view has broken click behavior and unreadable multi-day activities |
| **5** | Progressive disclosure in Activity Modal (basic tab vs. advanced metrics) | Reduces cognitive load for 80% of activity creation while keeping power features accessible |
