# LaunchGrid — SaaS Viability Assessment

**Date:** 2026-03-19
**Assessment:** Not commercially viable as-is

## Summary

LaunchGrid is a well-built internal marketing campaign planning tool. However, launching it as a subscription micro-SaaS is not recommended due to extreme market saturation, lack of defensible differentiation, and the significant additional investment required for commercialization.

## Market Reality

### Direct Competitors (Established, Funded)
- **CoSchedule** — Marketing calendar ($29-$99/mo, established brand)
- **Monday.com / Asana / Wrike** — Marketing-specific templates with Gantt views
- **Notion / Airtable** — Flexible enough for teams to replicate this
- **Allocadia / Uptempo** — Enterprise marketing performance management
- **Miro / TeamGantt** — Visual planning tools

### Why Entry Is Difficult
1. No moat — AI features are thin LLM wrappers any competitor can replicate
2. No distribution advantage or brand recognition
3. Target users (mid-size marketing teams) already have entrenched tooling
4. Timeline visualization is table stakes in project management

## What Does Have Value

### Event Marketing Operations (Strongest Differentiator)
- Sub-event management, attendee tracking, travel/pass allocation
- Logistics deck generation (PPTX)
- Year-over-year event comparison and ROI
- Slack notifications for event status
- This workflow is underserved by generic PM and event execution tools

### Auto-Generated Reports
- PowerPoint budget review decks from live data
- Campaign performance reports
- Saves marketers hours of manual deck building

### Marketing-Specific Data Model
- SAOs, pipeline generation, regional/currency tracking
- Campaign-level budget variance analysis
- Speaks the language of B2B marketing ops

## Commercialization Gap

To go from internal tool to production SaaS:
- [ ] Real authentication (OAuth, SSO, JWT)
- [ ] Multi-tenant isolation and team management
- [ ] Billing integration (Stripe subscriptions)
- [ ] Onboarding flows and documentation
- [ ] Security audit and SOC 2 compliance
- [ ] Customer support infrastructure
- [ ] Marketing site, content, and acquisition strategy

**Estimated effort:** 5-10x current engineering investment

## Recommendation

**Keep as internal tool.** If commercial interest is compelling, the only viable angle is niching into **B2B event marketing operations** (not generic campaign planning). Validate with a landing page + $500 LinkedIn ad spend targeting Field Marketing Managers before investing further development.
