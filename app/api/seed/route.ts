import { NextResponse } from 'next/server';
import { db } from '@/db';
import {
  users,
  calendars,
  statuses,
  swimlanes,
  campaigns,
  activities,
  activityTypes,
  vendors,
  activityComments,
  activityHistory,
  calendarPermissions,
  events,
  subEvents,
  eventAttendees,
  subEventAttendees,
  checklistItems,
  campaignEvents,
  campaignReportData,
  adminSettings,
} from '@/db/schema';
import { eq } from 'drizzle-orm';
import { logger } from '@/lib/logger';

// Helper to generate a date string offset from today
function dateOffset(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

async function clearAllData() {
  // Delete in order respecting foreign keys
  await db.delete(campaignReportData);
  await db.delete(subEventAttendees);
  await db.delete(subEvents);
  await db.delete(eventAttendees);
  await db.delete(checklistItems);
  await db.delete(campaignEvents);
  await db.delete(events);
  await db.delete(adminSettings);
  await db.delete(activityHistory);
  await db.delete(activityComments);
  await db.delete(activities);
  await db.delete(campaigns);
  await db.delete(swimlanes);
  await db.delete(statuses);
  await db.delete(calendarPermissions);
  await db.delete(calendars);
  await db.delete(activityTypes);
  await db.delete(vendors);
  // Keep users table - just ensure default user exists
}

async function getOrCreateDefaultUser() {
  // Use upsert to avoid race conditions from concurrent requests
  const [user] = await db
    .insert(users)
    .values({
      email: 'default@campaignos.local',
      name: 'Default User',
      passwordHash: 'no-auth',
      role: 'Admin',
    })
    .onConflictDoNothing({ target: users.email })
    .returning();

  if (user) return user;

  // If onConflict fired, the row already exists — fetch it
  const [existing] = await db.select().from(users).where(eq(users.email, 'default@campaignos.local'));
  return existing;
}

async function seedData() {
  const user = await getOrCreateDefaultUser();

  // ─── Create Calendar ──────────────────────────────────────
  const [calendar] = await db
    .insert(calendars)
    .values({
      name: 'Q2 2026 Marketing Plan',
      ownerId: user.id,
    })
    .returning();

  // ─── Statuses ─────────────────────────────────────────────
  const [statusConsidering] = await db
    .insert(statuses)
    .values({ calendarId: calendar.id, name: 'Considering', color: '#3B53FF', sortOrder: 0 })
    .returning();
  const [statusNegotiating] = await db
    .insert(statuses)
    .values({ calendarId: calendar.id, name: 'Negotiating', color: '#FFA943', sortOrder: 1 })
    .returning();
  const [statusCommitted] = await db
    .insert(statuses)
    .values({ calendarId: calendar.id, name: 'Committed', color: '#006170', sortOrder: 2 })
    .returning();

  // ─── Swimlanes (Marketing Channels) ──────────────────────
  const swimlaneData = [
    { name: 'Paid Advertising', budget: '150000', sortOrder: '0' },
    { name: 'Social Media', budget: '80000', sortOrder: '1' },
    { name: 'Email Marketing', budget: '45000', sortOrder: '2' },
    { name: 'Events & Webinars', budget: '120000', sortOrder: '3' },
    { name: 'Content & SEO', budget: '60000', sortOrder: '4' },
    { name: 'Partner Marketing', budget: '50000', sortOrder: '5' },
  ];

  const createdSwimlanes: Record<string, string> = {};
  for (const sl of swimlaneData) {
    const [created] = await db
      .insert(swimlanes)
      .values({ calendarId: calendar.id, ...sl })
      .returning();
    createdSwimlanes[sl.name] = created.id;
  }

  // ─── Campaigns ────────────────────────────────────────────
  const campaignData = [
    { name: 'Spring Product Launch', budget: '180000' },
    { name: 'Brand Awareness Q2', budget: '95000' },
    { name: 'Summer Promo Series', budget: '120000' },
    { name: 'Enterprise ABM Program', budget: '75000' },
    { name: 'Customer Retention Drive', budget: '55000' },
  ];

  const createdCampaigns: Record<string, string> = {};
  for (const camp of campaignData) {
    const [created] = await db
      .insert(campaigns)
      .values({ calendarId: calendar.id, ...camp })
      .returning();
    createdCampaigns[camp.name] = created.id;
  }

  // ─── Activity Types ──────────────────────────────────────
  const typeNames = ['Webinar', 'Blog Post', 'Ad Campaign', 'Email Blast', 'Social Post', 'Conference', 'Case Study', 'Video'];
  const createdTypes: Record<string, string> = {};
  for (const name of typeNames) {
    const [created] = await db.insert(activityTypes).values({ name }).returning();
    createdTypes[name] = created.id;
  }

  // ─── Vendors ─────────────────────────────────────────────
  const vendorNames = ['Google Ads', 'Meta Business', 'LinkedIn Marketing', 'HubSpot', 'Salesforce', 'Eventbrite'];
  const createdVendors: Record<string, string> = {};
  for (const name of vendorNames) {
    const [created] = await db.insert(vendors).values({ name }).returning();
    createdVendors[name] = created.id;
  }

  // ─── Activities ──────────────────────────────────────────
  // A rich set of activities spanning different channels, campaigns, statuses, regions, and time periods
  const activitySeed = [
    // ── Paid Advertising ──
    {
      title: 'Google Search Ads - Product Launch',
      swimlane: 'Paid Advertising', campaign: 'Spring Product Launch', status: statusCommitted.id,
      startDate: dateOffset(-10), endDate: dateOffset(20),
      cost: '25000', actualCost: '22500', currency: 'USD' as const, region: 'US' as const,
      expectedSaos: '150', targetSaos: '200', actualSaos: '135',
      pipelineGenerated: '450000', revenueGenerated: '125000',
      description: 'Branded and non-branded search campaigns targeting product launch keywords.',
      tags: 'search,google,paid', color: '#FF715A',
      vendorId: createdVendors['Google Ads'], typeId: createdTypes['Ad Campaign'],
    },
    {
      title: 'LinkedIn Sponsored Content - Enterprise',
      swimlane: 'Paid Advertising', campaign: 'Enterprise ABM Program', status: statusCommitted.id,
      startDate: dateOffset(-5), endDate: dateOffset(25),
      cost: '18000', actualCost: '16200', currency: 'USD' as const, region: 'US' as const,
      expectedSaos: '45', targetSaos: '60', actualSaos: '38',
      pipelineGenerated: '320000', revenueGenerated: '85000',
      description: 'Targeted ABM campaigns reaching decision-makers at enterprise accounts.',
      tags: 'linkedin,abm,enterprise', color: '#3B53FF',
      vendorId: createdVendors['LinkedIn Marketing'], typeId: createdTypes['Ad Campaign'],
    },
    {
      title: 'Meta Retargeting Campaigns',
      swimlane: 'Paid Advertising', campaign: 'Brand Awareness Q2', status: statusNegotiating.id,
      startDate: dateOffset(5), endDate: dateOffset(35),
      cost: '12000', actualCost: '0', currency: 'USD' as const, region: 'EMEA' as const,
      expectedSaos: '80', targetSaos: '100', actualSaos: '0',
      pipelineGenerated: '0', revenueGenerated: '0',
      description: 'Retargeting website visitors and lookalike audiences across Facebook and Instagram.',
      tags: 'meta,retargeting,awareness', color: '#7A00C1',
      vendorId: createdVendors['Meta Business'], typeId: createdTypes['Ad Campaign'],
    },
    {
      title: 'Display Ads - Summer Campaign',
      swimlane: 'Paid Advertising', campaign: 'Summer Promo Series', status: statusConsidering.id,
      startDate: dateOffset(30), endDate: dateOffset(60),
      cost: '15000', actualCost: '0', currency: 'USD' as const, region: 'US' as const,
      expectedSaos: '90', targetSaos: '120', actualSaos: '0',
      pipelineGenerated: '0', revenueGenerated: '0',
      description: 'Programmatic display ads across premium publisher network for summer promotion.',
      tags: 'display,programmatic,summer', color: '#FFA943',
      vendorId: createdVendors['Google Ads'], typeId: createdTypes['Ad Campaign'],
    },

    // ── Social Media ──
    {
      title: 'Product Launch Social Blitz',
      swimlane: 'Social Media', campaign: 'Spring Product Launch', status: statusCommitted.id,
      startDate: dateOffset(-7), endDate: dateOffset(7),
      cost: '8000', actualCost: '7500', currency: 'USD' as const, region: 'US' as const,
      expectedSaos: '30', targetSaos: '40', actualSaos: '28',
      pipelineGenerated: '95000', revenueGenerated: '22000',
      description: 'Multi-platform social media campaign across LinkedIn, Twitter/X, and Instagram for product launch.',
      tags: 'social,launch,multi-platform', color: '#34E5E2',
      typeId: createdTypes['Social Post'],
    },
    {
      title: 'Thought Leadership Series',
      swimlane: 'Social Media', campaign: 'Brand Awareness Q2', status: statusCommitted.id,
      startDate: dateOffset(-14), endDate: dateOffset(45),
      cost: '5000', actualCost: '3200', currency: 'USD' as const, region: 'US' as const,
      expectedSaos: '15', targetSaos: '20', actualSaos: '12',
      pipelineGenerated: '55000', revenueGenerated: '0',
      description: 'Weekly thought leadership posts from exec team on LinkedIn with engagement strategy.',
      tags: 'linkedin,thought-leadership,organic', color: '#006170',
      typeId: createdTypes['Social Post'],
    },
    {
      title: 'Customer Spotlight Videos',
      swimlane: 'Social Media', campaign: 'Customer Retention Drive', status: statusNegotiating.id,
      startDate: dateOffset(10), endDate: dateOffset(40),
      cost: '12000', actualCost: '0', currency: 'USD' as const, region: 'US' as const,
      expectedSaos: '10', targetSaos: '15', actualSaos: '0',
      pipelineGenerated: '0', revenueGenerated: '0',
      description: 'Short-form video testimonials from top customers for social distribution.',
      tags: 'video,testimonial,social', color: '#50A0FF',
      typeId: createdTypes['Video'],
    },

    // ── Email Marketing ──
    {
      title: 'Product Launch Nurture Sequence',
      swimlane: 'Email Marketing', campaign: 'Spring Product Launch', status: statusCommitted.id,
      startDate: dateOffset(-3), endDate: dateOffset(14),
      cost: '3500', actualCost: '3500', currency: 'USD' as const, region: 'US' as const,
      expectedSaos: '60', targetSaos: '75', actualSaos: '52',
      pipelineGenerated: '180000', revenueGenerated: '45000',
      description: '5-part email nurture sequence for launch leads with progressive profiling.',
      tags: 'email,nurture,launch', color: '#FFA943',
      vendorId: createdVendors['HubSpot'], typeId: createdTypes['Email Blast'],
    },
    {
      title: 'Monthly Newsletter - Q2',
      swimlane: 'Email Marketing', campaign: 'Brand Awareness Q2', status: statusCommitted.id,
      startDate: dateOffset(0), endDate: dateOffset(90),
      cost: '6000', actualCost: '2000', currency: 'USD' as const, region: 'US' as const,
      expectedSaos: '25', targetSaos: '30', actualSaos: '8',
      pipelineGenerated: '42000', revenueGenerated: '12000',
      description: 'Monthly newsletter featuring product updates, case studies, and industry insights.',
      tags: 'newsletter,monthly,awareness', color: '#3B53FF',
      vendorId: createdVendors['HubSpot'], typeId: createdTypes['Email Blast'],
      recurrenceFrequency: 'monthly',
    },
    {
      title: 'Win-Back Email Campaign',
      swimlane: 'Email Marketing', campaign: 'Customer Retention Drive', status: statusConsidering.id,
      startDate: dateOffset(20), endDate: dateOffset(35),
      cost: '4000', actualCost: '0', currency: 'USD' as const, region: 'EMEA' as const,
      expectedSaos: '20', targetSaos: '30', actualSaos: '0',
      pipelineGenerated: '0', revenueGenerated: '0',
      description: 'Targeted re-engagement campaign for churned customers with personalized offers.',
      tags: 'email,retention,winback', color: '#006170',
      vendorId: createdVendors['HubSpot'], typeId: createdTypes['Email Blast'],
    },

    // ── Events & Webinars ──
    {
      title: 'Product Launch Webinar',
      swimlane: 'Events & Webinars', campaign: 'Spring Product Launch', status: statusCommitted.id,
      startDate: dateOffset(3), endDate: dateOffset(3),
      cost: '8000', actualCost: '7800', currency: 'USD' as const, region: 'US' as const,
      expectedSaos: '75', targetSaos: '100', actualSaos: '68',
      pipelineGenerated: '280000', revenueGenerated: '72000',
      description: 'Live product demo webinar with Q&A. Target 500+ registrations.',
      tags: 'webinar,launch,live-demo', color: '#7A00C1',
      typeId: createdTypes['Webinar'],
    },
    {
      title: 'SaaS Connect Conference',
      swimlane: 'Events & Webinars', campaign: 'Brand Awareness Q2', status: statusCommitted.id,
      startDate: dateOffset(15), endDate: dateOffset(17),
      cost: '35000', actualCost: '32000', currency: 'USD' as const, region: 'US' as const,
      expectedSaos: '120', targetSaos: '150', actualSaos: '95',
      pipelineGenerated: '520000', revenueGenerated: '0',
      description: 'Booth + speaking slot at SaaS Connect. Premier sponsor package.',
      tags: 'conference,speaking,booth', color: '#FF715A',
      vendorId: createdVendors['Eventbrite'], typeId: createdTypes['Conference'],
    },
    {
      title: 'Enterprise Roundtable - London',
      swimlane: 'Events & Webinars', campaign: 'Enterprise ABM Program', status: statusNegotiating.id,
      startDate: dateOffset(25), endDate: dateOffset(25),
      cost: '15000', actualCost: '0', currency: 'GBP' as const, region: 'EMEA' as const,
      expectedSaos: '25', targetSaos: '30', actualSaos: '0',
      pipelineGenerated: '0', revenueGenerated: '0',
      description: 'Exclusive dinner event for 30 enterprise prospects in London financial district.',
      tags: 'event,abm,london,dinner', color: '#7A00C1',
      typeId: createdTypes['Conference'],
    },
    {
      title: 'Summer Webinar Series',
      swimlane: 'Events & Webinars', campaign: 'Summer Promo Series', status: statusConsidering.id,
      startDate: dateOffset(40), endDate: dateOffset(70),
      cost: '12000', actualCost: '0', currency: 'USD' as const, region: 'US' as const,
      expectedSaos: '60', targetSaos: '80', actualSaos: '0',
      pipelineGenerated: '0', revenueGenerated: '0',
      description: '4-part webinar series covering use cases and best practices.',
      tags: 'webinar,series,summer', color: '#FFA943',
      typeId: createdTypes['Webinar'],
    },

    // ── Content & SEO ──
    {
      title: 'Product Launch Blog Series',
      swimlane: 'Content & SEO', campaign: 'Spring Product Launch', status: statusCommitted.id,
      startDate: dateOffset(-14), endDate: dateOffset(7),
      cost: '4500', actualCost: '4500', currency: 'USD' as const, region: 'US' as const,
      expectedSaos: '20', targetSaos: '25', actualSaos: '18',
      pipelineGenerated: '65000', revenueGenerated: '15000',
      description: '6-part blog series building up to and following the product launch.',
      tags: 'blog,content,seo,launch', color: '#006170',
      typeId: createdTypes['Blog Post'],
    },
    {
      title: 'Enterprise Case Studies',
      swimlane: 'Content & SEO', campaign: 'Enterprise ABM Program', status: statusCommitted.id,
      startDate: dateOffset(-20), endDate: dateOffset(10),
      cost: '8000', actualCost: '6000', currency: 'USD' as const, region: 'US' as const,
      expectedSaos: '15', targetSaos: '20', actualSaos: '10',
      pipelineGenerated: '120000', revenueGenerated: '35000',
      description: '3 in-depth enterprise case studies with video components.',
      tags: 'case-study,enterprise,content', color: '#50A0FF',
      typeId: createdTypes['Case Study'],
    },
    {
      title: 'SEO Content Refresh',
      swimlane: 'Content & SEO', campaign: 'Brand Awareness Q2', status: statusNegotiating.id,
      startDate: dateOffset(5), endDate: dateOffset(50),
      cost: '7000', actualCost: '0', currency: 'USD' as const, region: 'US' as const,
      expectedSaos: '30', targetSaos: '45', actualSaos: '0',
      pipelineGenerated: '0', revenueGenerated: '0',
      description: 'Refresh and optimize top 20 landing pages and blog posts for SEO performance.',
      tags: 'seo,optimization,content', color: '#34E5E2',
      typeId: createdTypes['Blog Post'],
    },
    {
      title: 'ROI Calculator Tool',
      swimlane: 'Content & SEO', campaign: 'Summer Promo Series', status: statusConsidering.id,
      startDate: dateOffset(35), endDate: dateOffset(55),
      cost: '10000', actualCost: '0', currency: 'USD' as const, region: 'US' as const,
      expectedSaos: '40', targetSaos: '50', actualSaos: '0',
      pipelineGenerated: '0', revenueGenerated: '0',
      description: 'Interactive ROI calculator for website to capture and qualify leads.',
      tags: 'tool,interactive,lead-gen', color: '#FF715A',
    },

    // ── Partner Marketing ──
    {
      title: 'Co-Marketing with Salesforce',
      swimlane: 'Partner Marketing', campaign: 'Enterprise ABM Program', status: statusCommitted.id,
      startDate: dateOffset(0), endDate: dateOffset(30),
      cost: '20000', actualCost: '18000', currency: 'USD' as const, region: 'US' as const,
      expectedSaos: '50', targetSaos: '65', actualSaos: '42',
      pipelineGenerated: '350000', revenueGenerated: '95000',
      description: 'Joint webinar + co-branded whitepaper with Salesforce integration team.',
      tags: 'partner,salesforce,co-marketing', color: '#50A0FF',
      vendorId: createdVendors['Salesforce'], typeId: createdTypes['Webinar'],
    },
    {
      title: 'Partner Referral Program Launch',
      swimlane: 'Partner Marketing', campaign: 'Summer Promo Series', status: statusNegotiating.id,
      startDate: dateOffset(15), endDate: dateOffset(45),
      cost: '8000', actualCost: '0', currency: 'USD' as const, region: 'ROW' as const,
      expectedSaos: '35', targetSaos: '50', actualSaos: '0',
      pipelineGenerated: '0', revenueGenerated: '0',
      description: 'Launch structured referral program with partner enablement materials.',
      tags: 'partner,referral,program', color: '#7A00C1',
    },
    {
      title: 'APAC Channel Partner Event',
      swimlane: 'Partner Marketing', campaign: 'Brand Awareness Q2', status: statusConsidering.id,
      startDate: dateOffset(50), endDate: dateOffset(52),
      cost: '18000', actualCost: '0', currency: 'USD' as const, region: 'ROW' as const,
      expectedSaos: '40', targetSaos: '55', actualSaos: '0',
      pipelineGenerated: '0', revenueGenerated: '0',
      description: 'In-person partner summit in Singapore for APAC channel partners.',
      tags: 'partner,event,apac', color: '#FF715A',
      typeId: createdTypes['Conference'],
    },
  ];

  for (const act of activitySeed) {
    await db.insert(activities).values({
      calendarId: calendar.id,
      swimlaneId: createdSwimlanes[act.swimlane],
      statusId: act.status,
      campaignId: createdCampaigns[act.campaign],
      title: act.title,
      startDate: act.startDate,
      endDate: act.endDate,
      cost: act.cost,
      actualCost: act.actualCost,
      currency: act.currency,
      region: act.region,
      expectedSaos: act.expectedSaos,
      targetSaos: act.targetSaos,
      actualSaos: act.actualSaos,
      pipelineGenerated: act.pipelineGenerated,
      revenueGenerated: act.revenueGenerated,
      description: act.description,
      tags: act.tags,
      color: act.color,
      vendorId: act.vendorId || null,
      typeId: act.typeId || null,
      recurrenceFrequency: act.recurrenceFrequency || 'none',
    });
  }

  // ─── Events ─────────────────────────────────────────────
  // Create realistic events with sub-events, attendees, and checklists

  const [eventReInvent] = await db.insert(events).values({
    calendarId: calendar.id,
    title: 'AWS Re:Invent 2026',
    seriesName: 'AWS Re:Invent',
    startDate: dateOffset(15),
    endDate: dateOffset(18),
    location: 'Las Vegas, NV',
    venue: 'The Venetian Expo',
    statusId: statusCommitted.id,
    totalPasses: 12,
    description: 'Annual AWS conference. Premier sponsor with booth, workshop, and executive dinner.',
    cost: '85000',
    actualCost: '72000',
    currency: 'USD',
    region: 'US',
    expectedSaos: '120',
    actualSaos: '95',
    pipelineGenerated: '520000',
    revenueGenerated: '0',
  }).returning();

  const [eventGartner] = await db.insert(events).values({
    calendarId: calendar.id,
    title: 'Gartner IT Symposium 2026',
    seriesName: 'Gartner IT Symposium',
    startDate: dateOffset(35),
    endDate: dateOffset(38),
    location: 'Orlando, FL',
    venue: 'Orange County Convention Center',
    statusId: statusNegotiating.id,
    totalPasses: 8,
    description: 'Analyst relations event. Speaking slot and executive roundtable.',
    cost: '55000',
    actualCost: '0',
    currency: 'USD',
    region: 'US',
    expectedSaos: '60',
    actualSaos: '0',
    pipelineGenerated: '0',
    revenueGenerated: '0',
  }).returning();

  const [eventLondonDinner] = await db.insert(events).values({
    calendarId: calendar.id,
    title: 'London Enterprise Dinner Q2',
    seriesName: 'Enterprise Dinner',
    startDate: dateOffset(25),
    endDate: dateOffset(25),
    location: 'London, UK',
    venue: 'The Savoy Hotel',
    statusId: statusCommitted.id,
    totalPasses: 0,
    description: 'Exclusive dinner for 25 enterprise prospects in financial services.',
    cost: '18000',
    actualCost: '16500',
    currency: 'GBP',
    region: 'EMEA',
    expectedSaos: '25',
    actualSaos: '18',
    pipelineGenerated: '320000',
    revenueGenerated: '85000',
  }).returning();

  const [eventKubeCon] = await db.insert(events).values({
    calendarId: calendar.id,
    title: 'KubeCon NA 2026',
    seriesName: 'KubeCon',
    startDate: dateOffset(50),
    endDate: dateOffset(53),
    location: 'Salt Lake City, UT',
    venue: 'Salt Palace Convention Center',
    statusId: statusConsidering.id,
    totalPasses: 6,
    description: 'Cloud native conference. Evaluating booth + demo station.',
    cost: '40000',
    actualCost: '0',
    currency: 'USD',
    region: 'US',
    expectedSaos: '45',
    actualSaos: '0',
    pipelineGenerated: '0',
    revenueGenerated: '0',
  }).returning();

  // Prior year event for YoY comparison
  const [priorReInvent] = await db.insert(events).values({
    calendarId: calendar.id,
    title: 'AWS Re:Invent 2025',
    seriesName: 'AWS Re:Invent',
    startDate: '2025-12-01',
    endDate: '2025-12-04',
    location: 'Las Vegas, NV',
    venue: 'The Venetian Expo',
    statusId: statusCommitted.id,
    totalPasses: 10,
    description: 'Prior year Re:Invent for comparison.',
    cost: '70000',
    actualCost: '68000',
    currency: 'USD',
    region: 'US',
    expectedSaos: '100',
    actualSaos: '88',
    pipelineGenerated: '420000',
    revenueGenerated: '110000',
  }).returning();

  // Link Re:Invent 2026 to its prior year
  await db.update(events).set({ priorEventId: priorReInvent.id }).where(eq(events.id, eventReInvent.id));

  // ─── Sub-Events ────────────────────────────────────────
  await db.insert(subEvents).values([
    { eventId: eventReInvent.id, title: 'Booth Setup & Demo Stations', type: 'booth', startDatetime: `${dateOffset(15)}T08:00`, endDatetime: `${dateOffset(18)}T18:00`, location: 'Expo Hall B, Booth #1247', sortOrder: 0 },
    { eventId: eventReInvent.id, title: 'Workshop: Cloud Migration Masterclass', type: 'workshop', startDatetime: `${dateOffset(16)}T10:00`, endDatetime: `${dateOffset(16)}T12:00`, location: 'Room 304A', description: '2-hour hands-on workshop. Target 60 attendees.', sortOrder: 1 },
    { eventId: eventReInvent.id, title: 'Executive Dinner', type: 'dinner', startDatetime: `${dateOffset(16)}T19:00`, endDatetime: `${dateOffset(16)}T22:00`, location: 'Tao Restaurant, The Venetian', description: 'Private dinner for 20 VIP prospects and key customers.', sortOrder: 2 },
    { eventId: eventReInvent.id, title: '1:1 Customer Meetings', type: '1:1', startDatetime: `${dateOffset(17)}T09:00`, endDatetime: `${dateOffset(17)}T17:00`, location: 'Meeting Suite 12', sortOrder: 3 },
    { eventId: eventReInvent.id, title: 'Team Debrief', type: 'meeting', startDatetime: `${dateOffset(18)}T16:00`, endDatetime: `${dateOffset(18)}T17:00`, location: 'Hotel Lobby Bar', sortOrder: 4 },
    { eventId: eventGartner.id, title: 'Speaking Session: Future of Data Analytics', type: 'speaking', startDatetime: `${dateOffset(36)}T14:00`, endDatetime: `${dateOffset(36)}T14:45`, location: 'Main Stage Hall C', sortOrder: 0 },
    { eventId: eventGartner.id, title: 'Executive Roundtable', type: 'roundtable', startDatetime: `${dateOffset(37)}T10:00`, endDatetime: `${dateOffset(37)}T12:00`, location: 'VIP Suite 4', description: 'Roundtable with 15 CIOs on data strategy.', sortOrder: 1 },
    { eventId: eventLondonDinner.id, title: 'Cocktail Reception', type: 'reception', startDatetime: `${dateOffset(25)}T18:30`, endDatetime: `${dateOffset(25)}T19:30`, location: 'The Savoy, Thames Foyer', sortOrder: 0 },
    { eventId: eventLondonDinner.id, title: 'Seated Dinner & Keynote', type: 'dinner', startDatetime: `${dateOffset(25)}T19:30`, endDatetime: `${dateOffset(25)}T22:00`, location: 'The Savoy, Lancaster Room', sortOrder: 1 },
  ]);

  // ─── Event Attendees ───────────────────────────────────
  await db.insert(eventAttendees).values([
    { eventId: eventReInvent.id, name: 'Sarah Chen', email: 'sarah.chen@redwood.io', attendeeType: 'internal' as const, role: 'presenting', hasPass: true, travelStatus: 'confirmed' },
    { eventId: eventReInvent.id, name: 'Mike Rodriguez', email: 'mike.r@redwood.io', attendeeType: 'internal' as const, role: 'staffing booth', hasPass: true, travelStatus: 'booked' },
    { eventId: eventReInvent.id, name: 'Emily Park', email: 'emily.p@redwood.io', attendeeType: 'internal' as const, role: 'presenting', hasPass: true, travelStatus: 'confirmed' },
    { eventId: eventReInvent.id, name: 'James Liu', email: 'james.l@redwood.io', attendeeType: 'internal' as const, role: 'staffing booth', hasPass: true, travelStatus: 'booked' },
    { eventId: eventReInvent.id, name: 'Rachel Green', email: 'rachel.g@redwood.io', attendeeType: 'internal' as const, role: 'attending', hasPass: true, travelStatus: 'not_booked' },
    { eventId: eventReInvent.id, name: 'David Kim', email: 'david.k@acmecorp.com', company: 'Acme Corp', attendeeType: 'customer' as const, role: '1:1 meeting', hasPass: false, travelStatus: 'confirmed' },
    { eventId: eventReInvent.id, name: 'Lisa Wang', email: 'lisa.w@globaltech.io', company: 'GlobalTech', attendeeType: 'customer' as const, role: 'dinner guest', hasPass: false, travelStatus: 'confirmed' },
    { eventId: eventReInvent.id, name: 'Tom Bradley', email: 'tom.b@finserv.com', company: 'FinServ Inc', attendeeType: 'customer' as const, role: '1:1 meeting', hasPass: false, travelStatus: 'booked' },
    { eventId: eventGartner.id, name: 'Sarah Chen', email: 'sarah.chen@redwood.io', attendeeType: 'internal' as const, role: 'presenting', hasPass: true, travelStatus: 'not_booked' },
    { eventId: eventGartner.id, name: 'Alex Thompson', email: 'alex.t@redwood.io', attendeeType: 'internal' as const, role: 'attending', hasPass: true, travelStatus: 'not_booked' },
    { eventId: eventLondonDinner.id, name: 'James Liu', email: 'james.l@redwood.io', attendeeType: 'internal' as const, role: 'hosting', hasPass: false, travelStatus: 'confirmed' },
    { eventId: eventLondonDinner.id, name: 'Nigel Thornton', email: 'n.thornton@barclays.co.uk', company: 'Barclays', attendeeType: 'customer' as const, role: 'guest', hasPass: false },
    { eventId: eventLondonDinner.id, name: 'Sophie Martin', email: 's.martin@hsbc.com', company: 'HSBC', attendeeType: 'customer' as const, role: 'guest', hasPass: false },
  ]);

  // ─── Checklist Items ───────────────────────────────────
  await db.insert(checklistItems).values([
    // Re:Invent
    { eventId: eventReInvent.id, title: 'Slides finalized for workshop', category: 'content', isDone: true, dueDate: dateOffset(5), sortOrder: 0 },
    { eventId: eventReInvent.id, title: 'Demo environment prepared', category: 'content', isDone: true, dueDate: dateOffset(8), sortOrder: 1 },
    { eventId: eventReInvent.id, title: 'Talk track document approved', category: 'content', isDone: false, dueDate: dateOffset(10), sortOrder: 2 },
    { eventId: eventReInvent.id, title: 'Flights booked for all attendees', category: 'logistics', isDone: true, dueDate: dateOffset(-5), sortOrder: 3 },
    { eventId: eventReInvent.id, title: 'Hotels confirmed', category: 'logistics', isDone: true, dueDate: dateOffset(-3), sortOrder: 4 },
    { eventId: eventReInvent.id, title: 'Ground transport arranged', category: 'logistics', isDone: false, dueDate: dateOffset(10), sortOrder: 5 },
    { eventId: eventReInvent.id, title: 'Booth materials shipped', category: 'materials', isDone: true, dueDate: dateOffset(3), sortOrder: 6 },
    { eventId: eventReInvent.id, title: 'Swag ordered (500 units)', category: 'materials', isDone: true, dueDate: dateOffset(-10), sortOrder: 7 },
    { eventId: eventReInvent.id, title: 'All passes allocated', category: 'registrations', isDone: false, dueDate: dateOffset(5), sortOrder: 8 },
    { eventId: eventReInvent.id, title: 'Badge info submitted', category: 'registrations', isDone: true, dueDate: dateOffset(-2), sortOrder: 9 },
    { eventId: eventReInvent.id, title: 'Slack channel created (#reinvent-2026)', category: 'comms', isDone: true, dueDate: dateOffset(-15), sortOrder: 10 },
    { eventId: eventReInvent.id, title: 'Logistics deck shared with team', category: 'comms', isDone: false, dueDate: dateOffset(12), sortOrder: 11 },
    // Gartner
    { eventId: eventGartner.id, title: 'Speaker bio submitted', category: 'content', isDone: true, sortOrder: 0 },
    { eventId: eventGartner.id, title: 'Presentation deck ready', category: 'content', isDone: false, dueDate: dateOffset(25), sortOrder: 1 },
    { eventId: eventGartner.id, title: 'Roundtable agenda finalized', category: 'content', isDone: false, dueDate: dateOffset(28), sortOrder: 2 },
    { eventId: eventGartner.id, title: 'Hotel booked', category: 'logistics', isDone: false, dueDate: dateOffset(20), sortOrder: 3 },
    // London Dinner
    { eventId: eventLondonDinner.id, title: 'Venue confirmed and deposit paid', category: 'logistics', isDone: true, sortOrder: 0 },
    { eventId: eventLondonDinner.id, title: 'Menu selected', category: 'logistics', isDone: true, sortOrder: 1 },
    { eventId: eventLondonDinner.id, title: 'Invitations sent', category: 'comms', isDone: true, sortOrder: 2 },
    { eventId: eventLondonDinner.id, title: 'Keynote speaker confirmed', category: 'content', isDone: true, sortOrder: 3 },
    { eventId: eventLondonDinner.id, title: 'Place cards and seating chart', category: 'materials', isDone: false, dueDate: dateOffset(20), sortOrder: 4 },
  ]);

  // ─── Campaign-Event Links ──────────────────────────────
  await db.insert(campaignEvents).values([
    { campaignId: createdCampaigns['Brand Awareness Q2'], eventId: eventReInvent.id },
    { campaignId: createdCampaigns['Enterprise ABM Program'], eventId: eventReInvent.id },
    { campaignId: createdCampaigns['Brand Awareness Q2'], eventId: eventGartner.id },
    { campaignId: createdCampaigns['Enterprise ABM Program'], eventId: eventLondonDinner.id },
    { campaignId: createdCampaigns['Spring Product Launch'], eventId: eventKubeCon.id },
  ]);

  // ─── Prior Year Attendees (for YoY comparison) ─────────
  await db.insert(eventAttendees).values([
    { eventId: priorReInvent.id, name: 'Sarah Chen', email: 'sarah.chen@redwood.io', attendeeType: 'internal' as const, role: 'presenting', hasPass: true, travelStatus: 'confirmed' },
    { eventId: priorReInvent.id, name: 'Mike Rodriguez', email: 'mike.r@redwood.io', attendeeType: 'internal' as const, role: 'staffing booth', hasPass: true, travelStatus: 'confirmed' },
    { eventId: priorReInvent.id, name: 'Emily Park', email: 'emily.p@redwood.io', attendeeType: 'internal' as const, role: 'presenting', hasPass: true, travelStatus: 'confirmed' },
    { eventId: priorReInvent.id, name: 'David Kim', email: 'david.k@acmecorp.com', company: 'Acme Corp', attendeeType: 'customer' as const, role: '1:1 meeting', hasPass: false, travelStatus: 'confirmed' },
  ]);

  // ─── Campaign Report Data (Multi-Source Reporting) ──────
  const periodStart = dateOffset(-90);
  const periodEnd = dateOffset(0);

  // ── Marketo Theme Performance ──
  const themeData = [
    {
      label: 'False Confidence in the Close',
      metrics: { impressions: 142000, clicks: 4260, mqls: 186, saos: 42, pipeline: 1680000, spend: 28500 },
    },
    {
      label: 'What Tools Won\'t Fix',
      metrics: { impressions: 118000, clicks: 3780, mqls: 152, saos: 35, pipeline: 1225000, spend: 22000 },
    },
    {
      label: 'Close on Command',
      metrics: { impressions: 165000, clicks: 5610, mqls: 218, saos: 51, pipeline: 2142000, spend: 34000 },
    },
    {
      label: 'Manual by Default',
      metrics: { impressions: 98000, clicks: 2940, mqls: 128, saos: 28, pipeline: 980000, spend: 18500 },
    },
    {
      label: 'If You Could Automate Anything',
      metrics: { impressions: 135000, clicks: 4725, mqls: 195, saos: 47, pipeline: 1880000, spend: 31000 },
    },
  ];

  for (const theme of themeData) {
    await db.insert(campaignReportData).values({
      calendarId: calendar.id,
      source: 'marketo_theme',
      category: 'theme',
      label: theme.label,
      periodStart,
      periodEnd,
      metrics: theme.metrics,
    });
  }

  // ── Marketo Channel Performance ──
  const channelData = [
    {
      label: 'Blogs',
      metrics: { published: 24, views: 48200, engagements: 6746, mqls: 142, saos: 32, spend: 14400 },
    },
    {
      label: 'Articles',
      metrics: { published: 12, views: 28500, engagements: 4560, mqls: 98, saos: 22, spend: 18000 },
    },
    {
      label: 'Downloadables',
      metrics: { published: 8, views: 15800, engagements: 5530, mqls: 210, saos: 48, spend: 24000 },
    },
    {
      label: 'Emails',
      metrics: { published: 36, views: 125000, engagements: 31250, mqls: 385, saos: 86, spend: 8500 },
    },
  ];

  for (const channel of channelData) {
    await db.insert(campaignReportData).values({
      calendarId: calendar.id,
      source: 'marketo_channel',
      category: 'channel',
      label: channel.label,
      periodStart,
      periodEnd,
      metrics: channel.metrics,
    });
  }

  // ── Hero Asset Performance ──
  const heroAssetData = [
    {
      label: 'SSON Research Report',
      category: 'research',
      metrics: { pageViews: 12400, downloads: 3100, completions: 2480, mqls: 186, saos: 42, pipeline: 1890000 },
    },
    {
      label: 'Financial Drag Analyzer',
      category: 'tool',
      metrics: { pageViews: 8600, downloads: 4300, completions: 3440, mqls: 245, saos: 58, pipeline: 2320000 },
    },
    {
      label: 'Journal Entry Index Tool',
      category: 'tool',
      metrics: { pageViews: 6200, downloads: 2790, completions: 2232, mqls: 156, saos: 36, pipeline: 1260000 },
    },
    {
      label: 'FA Maturity Assessment',
      category: 'assessment',
      metrics: { pageViews: 9800, downloads: 5880, completions: 4116, mqls: 312, saos: 72, pipeline: 3240000 },
    },
  ];

  for (const asset of heroAssetData) {
    await db.insert(campaignReportData).values({
      calendarId: calendar.id,
      source: 'hero_asset',
      category: asset.category,
      label: asset.label,
      periodStart,
      periodEnd,
      metrics: asset.metrics,
    });
  }

  // ── LinkedIn / Superads Campaign Performance ──
  const linkedInData = [
    {
      label: 'Close on Command - Decision Makers',
      metrics: { impressions: 285000, clicks: 5700, spend: 42500, leads: 342, mqls: 164, saos: 38 },
    },
    {
      label: 'FA Maturity Assessment - CFOs',
      metrics: { impressions: 198000, clicks: 4356, spend: 36200, leads: 261, mqls: 132, saos: 31 },
    },
    {
      label: 'SSON Research Promotion',
      metrics: { impressions: 156000, clicks: 3432, spend: 24800, leads: 205, mqls: 98, saos: 22 },
    },
    {
      label: 'Financial Drag Analyzer - Controllers',
      metrics: { impressions: 220000, clicks: 5060, spend: 38500, leads: 310, mqls: 148, saos: 35 },
    },
    {
      label: 'Brand Awareness - Accounting Leaders',
      metrics: { impressions: 425000, clicks: 6375, spend: 52000, leads: 382, mqls: 172, saos: 28 },
    },
  ];

  for (const li of linkedInData) {
    await db.insert(campaignReportData).values({
      calendarId: calendar.id,
      source: 'linkedin_ads',
      category: 'campaign',
      label: li.label,
      periodStart,
      periodEnd,
      metrics: li.metrics,
    });
  }

  // ── ICP Penetration (Andres' spreadsheet) ──
  // Summary row
  await db.insert(campaignReportData).values({
    calendarId: calendar.id,
    source: 'icp_penetration',
    category: 'summary',
    label: 'ICP Summary',
    periodStart,
    periodEnd,
    metrics: {
      targetAccounts: 850,
      engaged: 412,
      withMqls: 186,
      withSaos: 72,
      withOpportunity: 38,
      totalPipeline: 8420000,
    },
  });

  // Top accounts
  const icpAccounts = [
    { label: 'Deloitte', metrics: { industry: 'Professional Services', touches: 48, mqls: 8, saos: 3, pipeline: 420000, stage: 'Opportunity' } },
    { label: 'JPMorgan Chase', metrics: { industry: 'Financial Services', touches: 42, mqls: 6, saos: 2, pipeline: 380000, stage: 'SAO' } },
    { label: 'EY Global', metrics: { industry: 'Professional Services', touches: 38, mqls: 7, saos: 3, pipeline: 510000, stage: 'Opportunity' } },
    { label: 'KPMG', metrics: { industry: 'Professional Services', touches: 35, mqls: 5, saos: 2, pipeline: 290000, stage: 'SAO' } },
    { label: 'Bank of America', metrics: { industry: 'Financial Services', touches: 32, mqls: 4, saos: 1, pipeline: 185000, stage: 'MQL' } },
    { label: 'PwC', metrics: { industry: 'Professional Services', touches: 30, mqls: 6, saos: 2, pipeline: 340000, stage: 'Opportunity' } },
    { label: 'Goldman Sachs', metrics: { industry: 'Financial Services', touches: 28, mqls: 3, saos: 1, pipeline: 220000, stage: 'SAO' } },
    { label: 'BDO International', metrics: { industry: 'Professional Services', touches: 26, mqls: 4, saos: 2, pipeline: 260000, stage: 'SAO' } },
    { label: 'Grant Thornton', metrics: { industry: 'Professional Services', touches: 24, mqls: 3, saos: 1, pipeline: 175000, stage: 'MQL' } },
    { label: 'Wells Fargo', metrics: { industry: 'Financial Services', touches: 22, mqls: 3, saos: 1, pipeline: 195000, stage: 'MQL' } },
  ];

  for (const acct of icpAccounts) {
    await db.insert(campaignReportData).values({
      calendarId: calendar.id,
      source: 'icp_penetration',
      category: 'account',
      label: acct.label,
      periodStart,
      periodEnd,
      metrics: acct.metrics as any,
    });
  }

  // ── Outreach Sequence Performance ──
  const outreachData = [
    {
      label: 'Close on Command - Cold Outreach',
      metrics: { sent: 4200, opened: 1470, replied: 252, meetings: 84, saos: 28 },
    },
    {
      label: 'FA Maturity Assessment Follow-Up',
      metrics: { sent: 2800, opened: 1120, replied: 196, meetings: 68, saos: 22 },
    },
    {
      label: 'SSON Research Download Follow-Up',
      metrics: { sent: 3100, opened: 1178, replied: 217, meetings: 72, saos: 24 },
    },
    {
      label: 'Event Attendee Nurture',
      metrics: { sent: 1800, opened: 810, replied: 162, meetings: 58, saos: 19 },
    },
    {
      label: 'Financial Drag Analyzer Users',
      metrics: { sent: 2400, opened: 1008, replied: 192, meetings: 64, saos: 21 },
    },
    {
      label: 'Inbound MQL Speed-to-Lead',
      metrics: { sent: 5200, opened: 2340, replied: 416, meetings: 142, saos: 48 },
    },
  ];

  for (const seq of outreachData) {
    await db.insert(campaignReportData).values({
      calendarId: calendar.id,
      source: 'outreach_sequence',
      category: 'sequence',
      label: seq.label,
      periodStart,
      periodEnd,
      metrics: seq.metrics,
    });
  }

  // ── SFDC Event Lead Progress ──
  const sfdcEventData = [
    {
      label: 'AWS Re:Invent 2025',
      metrics: { registered: 520, attended: 385, mql: 142, sao: 48, opportunity: 22, closedWon: 8, revenue: 680000 },
    },
    {
      label: 'London Enterprise Dinner Q1',
      metrics: { registered: 28, attended: 25, mql: 18, sao: 12, opportunity: 7, closedWon: 3, revenue: 285000 },
    },
    {
      label: 'Product Launch Webinar',
      metrics: { registered: 680, attended: 412, mql: 198, sao: 68, opportunity: 28, closedWon: 10, revenue: 520000 },
    },
    {
      label: 'SaaS Connect Conference',
      metrics: { registered: 340, attended: 280, mql: 95, sao: 38, opportunity: 16, closedWon: 5, revenue: 380000 },
    },
    {
      label: 'Enterprise Roundtable Series',
      metrics: { registered: 45, attended: 42, mql: 32, sao: 18, opportunity: 10, closedWon: 4, revenue: 425000 },
    },
  ];

  for (const ev of sfdcEventData) {
    await db.insert(campaignReportData).values({
      calendarId: calendar.id,
      source: 'sfdc_event_leads',
      category: 'event',
      label: ev.label,
      periodStart,
      periodEnd,
      metrics: ev.metrics,
    });
  }

  return calendar.id;
}

// POST /api/seed - Seed fresh data
export async function POST() {
  try {
    await clearAllData();
    const calendarId = await seedData();
    return NextResponse.json({ success: true, action: 'seed', calendarId });
  } catch (error) {
    logger.error('Seed failed', error);
    return NextResponse.json(
      { error: 'Failed to seed data' },
      { status: 500 }
    );
  }
}

// DELETE /api/seed - Clear all data (except user)
export async function DELETE() {
  try {
    await clearAllData();
    return NextResponse.json({ success: true, action: 'clear' });
  } catch (error) {
    logger.error('Clear failed', error);
    return NextResponse.json(
      { error: 'Failed to clear data' },
      { status: 500 }
    );
  }
}

// PUT /api/seed - Reset (clear + re-seed)
export async function PUT() {
  try {
    await clearAllData();
    const calendarId = await seedData();
    return NextResponse.json({ success: true, action: 'reset', calendarId });
  } catch (error) {
    logger.error('Reset failed', error);
    return NextResponse.json(
      { error: 'Failed to reset data' },
      { status: 500 }
    );
  }
}
