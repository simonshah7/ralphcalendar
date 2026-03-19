# Production Readiness Audit Report

**Date:** 2026-03-19
**Codebase:** RalphCalendar (LaunchGrid)
**Framework:** Next.js 16.1.4, React 19, TypeScript 5.9, Drizzle ORM, Tailwind CSS 4

---

## Overall Health Scores

| Category | Score | Summary |
|---|---|---|
| Code Quality | 6/10 | Duplication, console.logs in prod, magic numbers |
| Bugs & Correctness | 5/10 | Race conditions, missing null checks, N+1 queries |
| Accessibility (a11y) | 4/10 | Missing ARIA labels, non-semantic HTML, broken keyboard nav |
| Visual Contrast & Theming | 4/10 | Dark mode contrast failures, hardcoded colors bypass theming |
| Performance | 5/10 | N+1 queries, missing memoization, no pagination |
| Security | 5/10 | Missing input validation, error info leakage, no CSRF, upload issues |
| Error Handling | 4/10 | Swallowed errors, console.log-only logging, no timeouts, generic messages |
| TypeScript / Type Safety | 6/10 | `any` casts, missing return types, unvalidated API responses |
| Testability & Maintainability | 4/10 | No drag tests, no voice tests, flaky waits, hardcoded browser path |

**Overall: 4.8 / 10** — Significant work needed before production deployment.

---

## Critical Issues

### C1. N+1 Query in Events Endpoint
- **File:** `app/api/events/route.ts:30-65`
- **Problem:** For each event, 4 separate queries run for attendees, checklist items, sub-events, and campaign events.
- **Impact:** O(4N+1) database queries. With 50 events = 201 queries per page load.
- **Fix:** Use batch queries with `inArray()` to fetch all related data in 2-3 queries total.

### C2. N+1 Query in Event Detail Endpoint
- **File:** `app/api/events/[id]/route.ts:71-97`
- **Problem:** Prior event comparison fetches 4 nested queries for each comparison.
- **Impact:** Performance degrades linearly with comparisons.
- **Fix:** Batch-fetch all prior event data.

### C3. Race Condition in AI Brief Generator
- **File:** `components/AIBriefGenerator.tsx:113-117`
- **Problem:** No request cancellation. Rapid clicks create multiple simultaneous API requests.
- **Impact:** Duplicate requests, inconsistent UI state, wasted API credits.
- **Fix:** Use `AbortController` to cancel previous requests before starting new ones.

### C4. Math.max() on Empty Array
- **File:** `components/CalendarView.tsx:174`
- **Problem:** `bars.map(b => b.row)` passed to `Math.max()` — empty array returns `-Infinity`.
- **Impact:** Layout breaks when a week has no activities spanning multiple days.
- **Fix:** Guard: `if (bars.length === 0) return 0;`

### C5. Dark Mode Contrast Fails WCAG AA
- **File:** `app/globals.css:53`
- **Problem:** `--muted-foreground: #a1a1b5` on `--background: #050505` = ~3.8:1 contrast ratio.
- **Impact:** WCAG AA requires 4.5:1 for normal text. Secondary text is illegible for visually impaired users.
- **Fix:** Change to `#c0c0d9` or brighter (target 5.5:1+).

### C6. Dark Mode Status Color Invisible
- **File:** `lib/utils.ts:77-81`
- **Problem:** DEFAULT_STATUSES hardcode `#006170` (Committed) — nearly invisible on dark card backgrounds (`#0d0b14`).
- **Impact:** Status badges unreadable in dark mode.
- **Fix:** Use theme-aware color definitions or lighter variants for dark mode.

### C7. Zero Test Coverage for Drag Operations
- **File:** `e2e/` directory (missing)
- **Problem:** `useTimelineDrag.ts` handles drag-to-create, move, resize with rollback logic — all untested.
- **Impact:** Core feature with no regression protection. Rollback logic (lines 197-219) especially risky.
- **Fix:** Create `e2e/drag-operations.spec.ts` covering create, move, resize, and failure rollback.

---

## High Issues

### H1. Missing Input Validation Across API Routes
- **Files:** `app/api/activities/route.ts:28`, `app/api/swimlanes/route.ts:8`, `app/api/campaigns/route.ts:8`, `app/api/statuses/route.ts:8`, `app/api/events/route.ts:18`
- **Problem:** `calendarId` from query params used directly without UUID validation.
- **Impact:** Invalid IDs reach database; potential for unexpected behavior.
- **Fix:** Create shared UUID validation helper; validate all route parameters.

### H2. Error Messages Leak Internal Details
- **File:** `app/api/activities/route.ts:149`
- **Problem:** `Failed to create activity: ${errorMessage}` exposes database error details to clients.
- **Impact:** Information disclosure — attackers learn DB schema and constraints.
- **Fix:** Return generic message to client; log detailed error server-side only.

### H3. Race Condition in Seed Endpoint
- **File:** `app/api/seed/route.ts:56-74`
- **Problem:** `getOrCreateDefaultUser()` has SELECT-then-INSERT without transaction isolation.
- **Impact:** Concurrent seed requests cause unique constraint violations.
- **Fix:** Use `INSERT ... ON CONFLICT DO NOTHING` or wrap in serializable transaction.

### H4. Missing ARIA Labels on Interactive Elements
- **File:** `components/Toast.tsx:91`
- **Problem:** Close button has no `aria-label`.
- **Impact:** Screen reader users cannot understand button purpose.
- **Fix:** Add `aria-label="Close notification"`.

### H5. Non-Semantic HTML for Clickable Elements
- **File:** `components/CampaignDropdown.tsx:173-223`
- **Problem:** `<div onClick>` used for campaign items instead of `<button>`.
- **Impact:** Keyboard navigation broken; screen readers don't announce as interactive.
- **Fix:** Replace `<div>` with `<button>` or `<li>` with `role="option"`.

### H6. CalendarView Popover Missing Dialog Role
- **File:** `components/CalendarView.tsx:404`
- **Problem:** Interactive popover div has no `role="dialog"`.
- **Impact:** Screen readers don't recognize popup as a dialog.
- **Fix:** Add `role="dialog" aria-label="Activities for [date]"`.

### H7. Unhandled Promises in AICopilot
- **File:** `components/AICopilot.tsx:45-56`
- **Problem:** `defaultCallbacks` async functions lack `.catch()` handlers.
- **Impact:** Unhandled promise rejections in production.
- **Fix:** Add `.catch()` or proper error boundary.

### H8. Array Index as React Key
- **File:** `components/AIBriefGenerator.tsx:320-423`
- **Problem:** Using `key={index}` in mapped list.
- **Impact:** Reordering/filtering corrupts form state due to incorrect reconciliation.
- **Fix:** Use `activity.id` or other unique identifier.

### H9. Dark Mode Action Buttons Invisible
- **File:** `components/timeline/ActivityBar.tsx:56-57, 62, 71`
- **Problem:** `bg-black/20`, `bg-black/30` overlays on dark backgrounds are invisible.
- **Impact:** Resize handles and action buttons unreachable in dark mode.
- **Fix:** Use theme-aware CSS variables: `bg-muted-foreground/20` or conditional dark mode classes.

### H10. Contrast Threshold Too Low
- **File:** `lib/utils.ts:74`
- **Problem:** `luminance > 0.179` threshold causes black text on medium-brightness backgrounds.
- **Impact:** Activity badges with colors like purple (`#c084fc`) have poor text contrast.
- **Fix:** Raise threshold to `0.4` or implement WCAG contrast ratio calculation.

### H11. Enum Values Not Validated
- **File:** `app/api/feedback/route.ts:19, 22`
- **Problem:** Type casts to `'bug' | 'suggestion'` without validating input matches enum.
- **Impact:** Invalid enum values stored in database.
- **Fix:** Validate against allowed values or use Zod schema.

### H12. File Upload Missing Type Restrictions
- **File:** `app/api/upload/route.ts:6-30`
- **Problem:** No MIME type whitelist. Extension extracted from filename without validation.
- **Impact:** Arbitrary file uploads (executables, scripts) possible.
- **Fix:** Add MIME type whitelist; validate extension matches MIME type.

### H13. Hardcoded Playwright Browser Path
- **File:** `playwright.config.ts:15`
- **Problem:** `/root/.cache/ms-playwright/chromium-1194/chrome-linux/chrome` hardcoded.
- **Impact:** Tests fail on any environment with different user, OS, or Playwright version.
- **Fix:** Remove hardcoded path; use `process.env.BROWSER_PATH` or let Playwright auto-detect.

### H14. No Test Coverage for Voice Agent
- **File:** `hooks/useVoiceAgent.ts` (405 lines)
- **Problem:** Complex hook with speech recognition, API calls, error handling — zero tests.
- **Impact:** Voice features completely unverified; regressions undetectable.
- **Fix:** Create unit tests with mocked browser Speech APIs.

### H15. Export Tests Don't Verify Output
- **File:** `e2e/data-export.spec.ts:23-28`
- **Problem:** Tests verify modal UI opens but never check that exports produce valid files.
- **Impact:** Export could be completely broken without tests catching it.
- **Fix:** Use Playwright's download handling to verify file content and format.

### H16. Swallowed Errors with Console-Only Logging
- **Files:** `components/CampaignDropdown.tsx:68-70, 89-91, 107-109`
- **Problem:** Errors caught and only `console.error()`'d; user gets generic "Failed to..." message.
- **Impact:** No error tracking; debugging requires reproducing the issue.
- **Fix:** Integrate error tracking (Sentry); show actionable messages to users.

### H17. Missing CSRF Protection
- **File:** `components/CampaignDropdown.tsx:57-66, 81-95, 103-112`
- **Problem:** POST/PUT/DELETE requests lack CSRF token validation.
- **Impact:** Cross-site request forgery attacks possible.
- **Fix:** Implement SameSite cookies and CSRF token validation on server.

---

## Medium Issues

### M1. Duplicated Validation Logic
- **Files:** `app/api/activities/route.ts:11-17`, `app/api/activities/batch/route.ts:6-12`
- **Problem:** `isValidCurrency()` and `isValidRegion()` duplicated.
- **Fix:** Extract to `lib/validation.ts`.

### M2. Missing Focus Management in Modals
- **File:** `components/CreateCalendarModal.tsx:37-40`
- **Problem:** Modal closes without returning focus to trigger element.
- **Fix:** Store ref to trigger; `.focus()` on close.

### M3. Color-Only Indicators
- **File:** `components/Toast.tsx:92`
- **Problem:** Left border color is sole indicator of toast type.
- **Fix:** Add text prefix ("Success:", "Error:") or icon with alt text.

### M4. Missing useMemo/useCallback in CalendarView
- **File:** `components/CalendarView.tsx:59-64, 86-160`
- **Problem:** `getActivitiesForDay` and `getSpanningBarsForWeek` recreated every render.
- **Fix:** Wrap in `useCallback`/`useMemo`.

### M5. No Pagination on List Endpoints
- **File:** `app/api/activities/route.ts:34`
- **Problem:** Returns all activities without limit/offset.
- **Fix:** Add cursor or offset pagination.

### M6. JSONB Columns Without Schema Validation
- **File:** `db/schema.ts:162-163, 332`
- **Problem:** `dependencies` and `attachments` JSONB fields accept any shape.
- **Fix:** Validate with Zod schema before insert/update.

### M7. Global CSS Transitions Interfere with Drag
- **File:** `app/globals.css:148-152`
- **Problem:** `*, *::before, *::after` transition rules affect all elements including drag targets.
- **Fix:** Scope transitions to specific elements (buttons, links, cards).

### M8. Flaky Tests with Hardcoded Waits
- **Files:** All e2e tests (`waitForTimeout(1000)`, `waitForTimeout(1500)`)
- **Fix:** Replace with `waitForSelector` or `expect(...).toBeVisible()`.

### M9. Drizzle Config Non-Null Assertion
- **File:** `drizzle.config.ts:8`
- **Problem:** `process.env.DATABASE_URL!` — no runtime check.
- **Fix:** Validate and throw descriptive error if missing.

### M10. Resize Handle Magic Number
- **File:** `components/timeline/useTimelineDrag.ts:107-119`
- **Problem:** `10px` resize threshold hardcoded; too large for small cards, unreachable on narrow activities.
- **Fix:** Use proportional threshold: `Math.max(8, width * 0.1)`.

### M11. Missing Null Check in Voice Agent
- **File:** `hooks/useVoiceAgent.ts:150-155`
- **Problem:** `ctx?.swimlanes[0]` could be undefined; cast to `string` proceeds anyway.
- **Fix:** Throw descriptive error if no swimlanes available.

### M12. Console.error in Production API Routes
- **Files:** `app/api/activities/route.ts:41,147`, `app/api/calendars/[id]/route.ts:58,88,108`, `app/api/events/route.ts:69`, and many others
- **Fix:** Replace with structured logging (Pino, Winston).

### M13. Nullable Foreign Keys Where Business Logic Requires Values
- **File:** `db/schema.ts:138-146`
- **Problem:** `statusId`, `campaignId` nullable but always expected.
- **Fix:** Add `notNull()` or document why nullable.

### M14. API Responses Not Validated Client-Side
- **File:** `components/AIBriefGenerator.tsx:108`
- **Problem:** `const result: GeneratedPlan = await response.json()` trusts server blindly.
- **Fix:** Validate with Zod or similar runtime schema validator.

### M15. Missing Filter Combination Tests
- **File:** `e2e/filtering-and-search.spec.ts:97-112`
- **Fix:** Add 3-way filter tests, filter persistence across views, special character search.

---

## Low Issues

### L1. Unused `Campaign` Import
- **File:** `components/timeline/ActivityBar.tsx:2`

### L2. Magic Numbers Without Constants
- **File:** `components/CalendarView.tsx:212, 275`

### L3. Missing Return Type Annotations
- **Files:** All API route handlers, `components/CalendarView.tsx:78-80`

### L4. No Audit Trail Written
- **File:** `db/schema.ts` — `activityHistory` table exists but is never populated.

### L5. Inconsistent Null Handling
- **File:** `app/api/activities/route.ts:117-120` — mix of falsy checks and explicit null checks.

### L6. Missing Database Indexes
- **File:** `db/schema.ts` — no indexes on `calendarId`, `swimlaneId`, `eventId`.

### L7. Scrollbar Styling Missing Firefox Support
- **File:** `app/globals.css:118-134`

### L8. Hardcoded Default User Email
- **File:** `app/api/calendars/route.ts:18` — `'default@campaignos.local'`.

### L9. Missing Sorting on Statuses Endpoint
- **File:** `app/api/statuses/route.ts:14` — no `orderBy` clause.

### L10. Seed Function Too Large
- **File:** `app/api/seed/route.ts:72-876` — 800+ line function.

### L11. No Request Timeout Configuration
- **Files:** All API routes and client-side fetch calls.

---

## Recommended Action Plan

### Phase 1: Critical Fixes (Week 1)
1. Fix N+1 queries in events endpoints (C1, C2)
2. Add `AbortController` to AI generators (C3)
3. Fix `Math.max()` empty array crash (C4)
4. Fix dark mode contrast values (C5, C6)
5. Add drag operation e2e tests (C7)

### Phase 2: High Priority (Week 2-3)
1. Add input validation across all API routes (H1, H11)
2. Sanitize error responses (H2)
3. Fix ARIA and semantic HTML issues (H4, H5, H6)
4. Fix dark mode button visibility (H9, H10)
5. Add file upload restrictions (H12)
6. Fix Playwright config (H13)
7. Implement proper error tracking (H16)

### Phase 3: Medium Priority (Week 4-5)
1. Extract shared validation utilities (M1)
2. Add pagination to list endpoints (M5)
3. Replace hardcoded waits in tests (M8)
4. Add structured logging (M12)
5. Validate JSONB schemas (M6)
6. Fix CSS transition scope (M7)

### Phase 4: Polish (Ongoing)
1. Remove unused imports and dead code (L1, L4)
2. Add database indexes (L6)
3. Standardize return types and null handling (L3, L5)
4. Add JSDoc to public APIs (L10)
