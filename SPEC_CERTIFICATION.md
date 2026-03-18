# LaunchGrid Spec Certification

> **Version:** 1.0
> **Date:** 2026-03-18
> **Application:** LaunchGrid — Marketing Campaign Planning & Timeline Visualization Tool
> **Status:** MVP Certification

---

## 1. Product Vision

LaunchGrid enables marketing teams to visually plan, organize, and track campaigns across channels, regions, and time periods — replacing spreadsheets with an interactive timeline-first tool that provides clarity at a glance.

---

## 2. User Personas

| Persona | Role | Primary Goal |
|---------|------|-------------|
| **Marketing Manager** | Plans campaigns across channels | Visualize the full marketing calendar and allocate budget across activities |
| **Campaign Coordinator** | Executes campaign logistics | Create and manage individual activities, track status progression |
| **Marketing Director** | Reviews and approves plans | Export and share campaign plans, get a high-level view across all swimlanes |
| **Agency Partner** | External collaborator | View shared calendar exports (PNG/CSV) to align on timelines |

---

## 3. User Journeys & Acceptance Criteria

### UJ-1: First-Time Setup

**As a** new user, **I want to** create my first calendar and organize it with swimlanes, **so that** I have a workspace ready for campaign planning.

| ID | Acceptance Criteria | Priority | Status |
|----|---------------------|----------|--------|
| UJ-1.1 | On first visit with no calendars, user sees welcome screen with "Create Your First Calendar" CTA | P0 | To verify |
| UJ-1.2 | User can create a calendar by entering a name and clicking Create | P0 | To verify |
| UJ-1.3 | Default statuses (Considering, Negotiating, Committed) are auto-created for new calendar | P0 | To verify |
| UJ-1.4 | After calendar creation, user sees prompt to add swimlanes | P0 | To verify |
| UJ-1.5 | User can add a swimlane by typing a name and pressing Enter or clicking Add | P0 | To verify |
| UJ-1.6 | After adding a swimlane, the timeline view renders with the swimlane row visible | P0 | To verify |

### UJ-2: Campaign Planning — Activity Lifecycle

**As a** marketing manager, **I want to** create, edit, and delete activities within my calendar, **so that** I can manage my full marketing plan.

| ID | Acceptance Criteria | Priority | Status |
|----|---------------------|----------|--------|
| UJ-2.1 | User can create an activity via the "New Activity" button in the header | P0 | To verify |
| UJ-2.2 | Activity modal requires title, start date, end date, status, and swimlane | P0 | To verify |
| UJ-2.3 | Activity modal supports optional fields: campaign, cost, currency, region, tags, description, color | P1 | To verify |
| UJ-2.4 | Created activity appears in the timeline view within the correct swimlane | P0 | To verify |
| UJ-2.5 | User can click an activity to open the edit modal with pre-filled data | P0 | To verify |
| UJ-2.6 | User can update activity fields and save changes | P0 | To verify |
| UJ-2.7 | User can delete an activity with a two-step confirmation (Delete → YES/NO) | P0 | To verify |
| UJ-2.8 | Activity form validates that end date >= start date | P1 | To verify |
| UJ-2.9 | Activity form shows inline validation errors for required fields | P1 | To verify |

### UJ-3: Multi-View Navigation

**As a** campaign coordinator, **I want to** view my activities in different formats, **so that** I can work in the view that best fits my current task.

| ID | Acceptance Criteria | Priority | Status |
|----|---------------------|----------|--------|
| UJ-3.1 | User can switch between Timeline, Calendar, and Table views via header tabs | P0 | To verify |
| UJ-3.2 | Timeline view displays activities as horizontal bars across time | P0 | To verify |
| UJ-3.3 | Calendar view displays a month grid with activities rendered as blocks | P0 | To verify |
| UJ-3.4 | Table view displays activities in a sortable spreadsheet format | P0 | To verify |
| UJ-3.5 | All three views show the same filtered set of activities | P0 | To verify |
| UJ-3.6 | Table view supports inline editing for status, dates, swimlane, campaign, cost, currency, and region | P1 | To verify |
| UJ-3.7 | Table view supports column sorting (asc/desc) on title, dates, status, swimlane, campaign, cost | P1 | To verify |

### UJ-4: Filtering & Search

**As a** marketing manager, **I want to** filter and search activities, **so that** I can focus on specific campaigns or statuses.

| ID | Acceptance Criteria | Priority | Status |
|----|---------------------|----------|--------|
| UJ-4.1 | User can search activities by title using the search input | P0 | To verify |
| UJ-4.2 | User can filter activities by campaign using the campaign dropdown | P0 | To verify |
| UJ-4.3 | User can filter activities by status using the status dropdown | P0 | To verify |
| UJ-4.4 | Filters can be combined (search + campaign + status) | P1 | To verify |
| UJ-4.5 | Clearing filters restores the full activity list | P0 | To verify |

### UJ-5: Workspace Management

**As a** marketing director, **I want to** manage multiple calendars and organize swimlanes, **so that** I can separate different planning contexts.

| ID | Acceptance Criteria | Priority | Status |
|----|---------------------|----------|--------|
| UJ-5.1 | User can create additional calendars via the workspace switcher | P0 | To verify |
| UJ-5.2 | User can switch between calendars and see each calendar's own activities | P0 | To verify |
| UJ-5.3 | User can add swimlanes from the timeline sidebar | P0 | To verify |
| UJ-5.4 | User can edit swimlane names (double-click or edit button) | P1 | To verify |
| UJ-5.5 | User can delete swimlanes with a confirmation dialog | P1 | To verify |

### UJ-6: Data Export

**As a** marketing director, **I want to** export my campaign plan, **so that** I can share it with stakeholders and agency partners.

| ID | Acceptance Criteria | Priority | Status |
|----|---------------------|----------|--------|
| UJ-6.1 | User can open the export modal via the Export button | P0 | To verify |
| UJ-6.2 | Export modal allows selecting view type (Timeline, Calendar, Table) | P1 | To verify |
| UJ-6.3 | Export modal allows selecting format (PNG or CSV) | P1 | To verify |
| UJ-6.4 | CSV export is only available when Table view is selected | P1 | To verify |
| UJ-6.5 | Export modal provides quick date range selectors (Month, Quarter, Year, All) | P2 | To verify |
| UJ-6.6 | Export modal allows custom date range via date pickers | P2 | To verify |

### UJ-7: Theme & Personalization

**As a** user, **I want to** switch between light and dark themes, **so that** I can work comfortably in my preferred visual mode.

| ID | Acceptance Criteria | Priority | Status |
|----|---------------------|----------|--------|
| UJ-7.1 | User can toggle between light and dark mode via the theme toggle | P1 | To verify |
| UJ-7.2 | Theme preference persists across page reloads (localStorage) | P2 | To verify |

---

## 4. Business Requirements

### BR-1: Time-to-Value

| ID | Requirement | Metric | Target |
|----|------------|--------|--------|
| BR-1.1 | A new user can go from first load to a planned campaign in under 5 minutes | Time to first activity created | < 5 min |
| BR-1.2 | Creating a calendar + swimlane + first activity takes fewer than 10 clicks | Click count | < 10 clicks |
| BR-1.3 | The welcome/empty state clearly guides users to their first action | User comprehension | No confusion on first visit |

### BR-2: Core Workflow Completeness

| ID | Requirement | Metric | Target |
|----|------------|--------|--------|
| BR-2.1 | Full CRUD lifecycle for activities is functional end-to-end | Feature completeness | 100% |
| BR-2.2 | Full CRUD lifecycle for swimlanes is functional end-to-end | Feature completeness | 100% |
| BR-2.3 | Full CRUD lifecycle for calendars is functional end-to-end | Feature completeness | 100% |
| BR-2.4 | Campaign association and filtering works end-to-end | Feature completeness | 100% |

### BR-3: Data Integrity

| ID | Requirement | Metric | Target |
|----|------------|--------|--------|
| BR-3.1 | Activities persist correctly across page reloads | Data durability | 100% |
| BR-3.2 | Deleting a swimlane cascades deletes to its activities | Referential integrity | Verified |
| BR-3.3 | Deleting a calendar cascades deletes to all child entities | Referential integrity | Verified |
| BR-3.4 | Activity dates remain consistent after creation and editing | Data accuracy | Verified |

### BR-4: Multi-View Consistency

| ID | Requirement | Metric | Target |
|----|------------|--------|--------|
| BR-4.1 | All three views (Timeline, Calendar, Table) show the same activity data | View parity | 100% |
| BR-4.2 | Filters apply consistently across all views | Filter parity | 100% |
| BR-4.3 | Changes made in one view are reflected in others upon switching | Data synchronization | Verified |

### BR-5: Export & Shareability

| ID | Requirement | Metric | Target |
|----|------------|--------|--------|
| BR-5.1 | PNG export produces a readable image of the selected view | Export quality | Verified |
| BR-5.2 | CSV export includes all activity fields in a standard format | Export completeness | All fields |
| BR-5.3 | Exported data matches the currently filtered/visible activities | Export accuracy | 100% |

### BR-6: Performance Baselines

| ID | Requirement | Metric | Target |
|----|------------|--------|--------|
| BR-6.1 | Initial page load completes within 3 seconds | Load time | < 3s |
| BR-6.2 | View switching is instantaneous (no perceptible lag) | Interaction latency | < 300ms |
| BR-6.3 | Activity CRUD operations complete within 1 second | API response time | < 1s |

---

## 5. Functional Requirements

### FR-1: Calendar Management

| ID | Requirement | Acceptance Criteria |
|----|------------|---------------------|
| FR-1.1 | Create calendar | POST /api/calendars with name creates calendar + default statuses |
| FR-1.2 | List calendars | GET /api/calendars returns all calendars |
| FR-1.3 | Get calendar details | GET /api/calendars/[id] returns calendar with statuses, swimlanes, campaigns, activities |
| FR-1.4 | Delete calendar | DELETE /api/calendars/[id] removes calendar and cascades to all child entities |

### FR-2: Swimlane Management

| ID | Requirement | Acceptance Criteria |
|----|------------|---------------------|
| FR-2.1 | Create swimlane | POST /api/swimlanes with name and calendarId |
| FR-2.2 | Edit swimlane | PUT /api/swimlanes/[id] updates name and/or sortOrder |
| FR-2.3 | Delete swimlane | DELETE /api/swimlanes/[id] removes swimlane and cascades to activities |
| FR-2.4 | Reorder swimlanes | Multiple PUT calls update sortOrder for all swimlanes |

### FR-3: Activity Management

| ID | Requirement | Acceptance Criteria |
|----|------------|---------------------|
| FR-3.1 | Create activity | POST /api/activities with required fields (calendarId, swimlaneId, statusId, title, dates) |
| FR-3.2 | Edit activity | PUT /api/activities/[id] updates any subset of fields |
| FR-3.3 | Delete activity | DELETE /api/activities/[id] removes activity |
| FR-3.4 | List activities | GET /api/activities?calendarId=X returns filtered activities |
| FR-3.5 | Validate dates | API rejects endDate < startDate |
| FR-3.6 | Validate required fields | API rejects missing title, dates, swimlaneId, statusId |
| FR-3.7 | Validate foreign keys | API verifies swimlane and status exist before creating |

### FR-4: Campaign Management

| ID | Requirement | Acceptance Criteria |
|----|------------|---------------------|
| FR-4.1 | Create campaign | POST /api/campaigns with name and calendarId |
| FR-4.2 | List campaigns | GET /api/campaigns?calendarId=X returns campaigns for calendar |
| FR-4.3 | Associate activity with campaign | Activity creation/edit accepts optional campaignId |
| FR-4.4 | Filter by campaign | Client-side filtering narrows visible activities to selected campaign |

### FR-5: Status Management

| ID | Requirement | Acceptance Criteria |
|----|------------|---------------------|
| FR-5.1 | Default statuses created | New calendar auto-creates Considering (blue), Negotiating (amber), Committed (green) |
| FR-5.2 | Statuses are calendar-scoped | Each calendar has its own set of statuses |
| FR-5.3 | Filter by status | Client-side filtering narrows visible activities to selected status |

---

## 6. Non-Functional Requirements

| ID | Category | Requirement | Target |
|----|----------|------------|--------|
| NFR-1 | Accessibility | All interactive elements are keyboard-navigable | WCAG 2.1 AA |
| NFR-2 | Responsiveness | Application is usable on desktop browsers (1280px+) | Supported |
| NFR-3 | Browser Support | Works in latest Chrome, Firefox, Safari, Edge | Verified |
| NFR-4 | Error Handling | API errors return descriptive JSON messages with appropriate HTTP codes | Verified |
| NFR-5 | Data Safety | Destructive actions (delete) require explicit confirmation | Verified |

---

## 7. Known Gaps & Future Scope (Out of MVP)

| Gap | Impact | Priority for V2 |
|-----|--------|-----------------|
| No authentication/authorization | Single user only; not suitable for teams | High |
| No real-time collaboration | Users cannot see others' changes live | Medium |
| No notifications/reminders | No alerts for upcoming activities or deadlines | Medium |
| No undo/redo | Destructive actions cannot be reversed easily | Medium |
| No drag-to-create in calendar view | Only timeline view supports drag creation | Low |
| No mobile-optimized layout | Desktop-first; mobile is functional but not ideal | Low |
| No recurring activity generation | Schema supports recurrence but UI does not | Low |

---

## 8. Certification Test Plan

The following Playwright E2E tests verify each user journey against the acceptance criteria above. All tests must pass for MVP certification.

| Test Suite | User Journey | Criteria Covered |
|------------|-------------|-----------------|
| `first-time-setup.spec.ts` | UJ-1: First-Time Setup | UJ-1.1 through UJ-1.6 |
| `activity-lifecycle.spec.ts` | UJ-2: Activity Lifecycle | UJ-2.1 through UJ-2.9 |
| `multi-view-navigation.spec.ts` | UJ-3: Multi-View Navigation | UJ-3.1 through UJ-3.7 |
| `filtering-and-search.spec.ts` | UJ-4: Filtering & Search | UJ-4.1 through UJ-4.5 |
| `workspace-management.spec.ts` | UJ-5: Workspace Management | UJ-5.1 through UJ-5.5 |
| `data-export.spec.ts` | UJ-6: Data Export | UJ-6.1 through UJ-6.6 |
| `theme-toggle.spec.ts` | UJ-7: Theme & Personalization | UJ-7.1 through UJ-7.2 |
| `api-validation.spec.ts` | FR-3, FR-5: API Validation | FR-3.5 through FR-3.7, FR-5.1 |
| `data-integrity.spec.ts` | BR-3: Data Integrity | BR-3.1 through BR-3.4 |

---

## 9. Sign-Off

| Role | Name | Date | Approved |
|------|------|------|----------|
| Product Owner | | | |
| Engineering Lead | | | |
| QA Lead | | | |

---

*This document serves as the formal specification certification for LaunchGrid MVP. All acceptance criteria must be verified via automated E2E tests before production release.*
