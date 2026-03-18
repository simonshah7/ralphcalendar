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
} from '@/db/schema';
import { eq } from 'drizzle-orm';

// Helper to generate a date string offset from today
function dateOffset(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

async function clearAllData() {
  // Delete in order respecting foreign keys
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
  const existingUsers = await db.select().from(users);
  if (existingUsers.length > 0) return existingUsers[0];

  const [user] = await db
    .insert(users)
    .values({
      email: 'default@campaignos.local',
      name: 'Default User',
      passwordHash: 'no-auth',
      role: 'Admin',
    })
    .returning();
  return user;
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
    .values({ calendarId: calendar.id, name: 'Considering', color: '#2563EB', sortOrder: 0 })
    .returning();
  const [statusNegotiating] = await db
    .insert(statuses)
    .values({ calendarId: calendar.id, name: 'Negotiating', color: '#D97706', sortOrder: 1 })
    .returning();
  const [statusCommitted] = await db
    .insert(statuses)
    .values({ calendarId: calendar.id, name: 'Committed', color: '#047857', sortOrder: 2 })
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
      cost: '25000', actualCost: '22500', currency: 'US$' as const, region: 'US' as const,
      expectedSaos: '150', targetSaos: '200', actualSaos: '135',
      pipelineGenerated: '450000', revenueGenerated: '125000',
      description: 'Branded and non-branded search campaigns targeting product launch keywords.',
      tags: 'search,google,paid', color: '#EF4444',
      vendorId: createdVendors['Google Ads'], typeId: createdTypes['Ad Campaign'],
    },
    {
      title: 'LinkedIn Sponsored Content - Enterprise',
      swimlane: 'Paid Advertising', campaign: 'Enterprise ABM Program', status: statusCommitted.id,
      startDate: dateOffset(-5), endDate: dateOffset(25),
      cost: '18000', actualCost: '16200', currency: 'US$' as const, region: 'US' as const,
      expectedSaos: '45', targetSaos: '60', actualSaos: '38',
      pipelineGenerated: '320000', revenueGenerated: '85000',
      description: 'Targeted ABM campaigns reaching decision-makers at enterprise accounts.',
      tags: 'linkedin,abm,enterprise', color: '#3B82F6',
      vendorId: createdVendors['LinkedIn Marketing'], typeId: createdTypes['Ad Campaign'],
    },
    {
      title: 'Meta Retargeting Campaigns',
      swimlane: 'Paid Advertising', campaign: 'Brand Awareness Q2', status: statusNegotiating.id,
      startDate: dateOffset(5), endDate: dateOffset(35),
      cost: '12000', actualCost: '0', currency: 'US$' as const, region: 'EMEA' as const,
      expectedSaos: '80', targetSaos: '100', actualSaos: '0',
      pipelineGenerated: '0', revenueGenerated: '0',
      description: 'Retargeting website visitors and lookalike audiences across Facebook and Instagram.',
      tags: 'meta,retargeting,awareness', color: '#8B5CF6',
      vendorId: createdVendors['Meta Business'], typeId: createdTypes['Ad Campaign'],
    },
    {
      title: 'Display Ads - Summer Campaign',
      swimlane: 'Paid Advertising', campaign: 'Summer Promo Series', status: statusConsidering.id,
      startDate: dateOffset(30), endDate: dateOffset(60),
      cost: '15000', actualCost: '0', currency: 'US$' as const, region: 'US' as const,
      expectedSaos: '90', targetSaos: '120', actualSaos: '0',
      pipelineGenerated: '0', revenueGenerated: '0',
      description: 'Programmatic display ads across premium publisher network for summer promotion.',
      tags: 'display,programmatic,summer', color: '#F59E0B',
      vendorId: createdVendors['Google Ads'], typeId: createdTypes['Ad Campaign'],
    },

    // ── Social Media ──
    {
      title: 'Product Launch Social Blitz',
      swimlane: 'Social Media', campaign: 'Spring Product Launch', status: statusCommitted.id,
      startDate: dateOffset(-7), endDate: dateOffset(7),
      cost: '8000', actualCost: '7500', currency: 'US$' as const, region: 'US' as const,
      expectedSaos: '30', targetSaos: '40', actualSaos: '28',
      pipelineGenerated: '95000', revenueGenerated: '22000',
      description: 'Multi-platform social media campaign across LinkedIn, Twitter/X, and Instagram for product launch.',
      tags: 'social,launch,multi-platform', color: '#06B6D4',
      typeId: createdTypes['Social Post'],
    },
    {
      title: 'Thought Leadership Series',
      swimlane: 'Social Media', campaign: 'Brand Awareness Q2', status: statusCommitted.id,
      startDate: dateOffset(-14), endDate: dateOffset(45),
      cost: '5000', actualCost: '3200', currency: 'US$' as const, region: 'US' as const,
      expectedSaos: '15', targetSaos: '20', actualSaos: '12',
      pipelineGenerated: '55000', revenueGenerated: '0',
      description: 'Weekly thought leadership posts from exec team on LinkedIn with engagement strategy.',
      tags: 'linkedin,thought-leadership,organic', color: '#10B981',
      typeId: createdTypes['Social Post'],
    },
    {
      title: 'Customer Spotlight Videos',
      swimlane: 'Social Media', campaign: 'Customer Retention Drive', status: statusNegotiating.id,
      startDate: dateOffset(10), endDate: dateOffset(40),
      cost: '12000', actualCost: '0', currency: 'US$' as const, region: 'US' as const,
      expectedSaos: '10', targetSaos: '15', actualSaos: '0',
      pipelineGenerated: '0', revenueGenerated: '0',
      description: 'Short-form video testimonials from top customers for social distribution.',
      tags: 'video,testimonial,social', color: '#EC4899',
      typeId: createdTypes['Video'],
    },

    // ── Email Marketing ──
    {
      title: 'Product Launch Nurture Sequence',
      swimlane: 'Email Marketing', campaign: 'Spring Product Launch', status: statusCommitted.id,
      startDate: dateOffset(-3), endDate: dateOffset(14),
      cost: '3500', actualCost: '3500', currency: 'US$' as const, region: 'US' as const,
      expectedSaos: '60', targetSaos: '75', actualSaos: '52',
      pipelineGenerated: '180000', revenueGenerated: '45000',
      description: '5-part email nurture sequence for launch leads with progressive profiling.',
      tags: 'email,nurture,launch', color: '#F97316',
      vendorId: createdVendors['HubSpot'], typeId: createdTypes['Email Blast'],
    },
    {
      title: 'Monthly Newsletter - Q2',
      swimlane: 'Email Marketing', campaign: 'Brand Awareness Q2', status: statusCommitted.id,
      startDate: dateOffset(0), endDate: dateOffset(90),
      cost: '6000', actualCost: '2000', currency: 'US$' as const, region: 'US' as const,
      expectedSaos: '25', targetSaos: '30', actualSaos: '8',
      pipelineGenerated: '42000', revenueGenerated: '12000',
      description: 'Monthly newsletter featuring product updates, case studies, and industry insights.',
      tags: 'newsletter,monthly,awareness', color: '#6366F1',
      vendorId: createdVendors['HubSpot'], typeId: createdTypes['Email Blast'],
      recurrenceFrequency: 'monthly',
    },
    {
      title: 'Win-Back Email Campaign',
      swimlane: 'Email Marketing', campaign: 'Customer Retention Drive', status: statusConsidering.id,
      startDate: dateOffset(20), endDate: dateOffset(35),
      cost: '4000', actualCost: '0', currency: 'US$' as const, region: 'EMEA' as const,
      expectedSaos: '20', targetSaos: '30', actualSaos: '0',
      pipelineGenerated: '0', revenueGenerated: '0',
      description: 'Targeted re-engagement campaign for churned customers with personalized offers.',
      tags: 'email,retention,winback', color: '#14B8A6',
      vendorId: createdVendors['HubSpot'], typeId: createdTypes['Email Blast'],
    },

    // ── Events & Webinars ──
    {
      title: 'Product Launch Webinar',
      swimlane: 'Events & Webinars', campaign: 'Spring Product Launch', status: statusCommitted.id,
      startDate: dateOffset(3), endDate: dateOffset(3),
      cost: '8000', actualCost: '7800', currency: 'US$' as const, region: 'US' as const,
      expectedSaos: '75', targetSaos: '100', actualSaos: '68',
      pipelineGenerated: '280000', revenueGenerated: '72000',
      description: 'Live product demo webinar with Q&A. Target 500+ registrations.',
      tags: 'webinar,launch,live-demo', color: '#8B5CF6',
      typeId: createdTypes['Webinar'],
    },
    {
      title: 'SaaS Connect Conference',
      swimlane: 'Events & Webinars', campaign: 'Brand Awareness Q2', status: statusCommitted.id,
      startDate: dateOffset(15), endDate: dateOffset(17),
      cost: '35000', actualCost: '32000', currency: 'US$' as const, region: 'US' as const,
      expectedSaos: '120', targetSaos: '150', actualSaos: '95',
      pipelineGenerated: '520000', revenueGenerated: '0',
      description: 'Booth + speaking slot at SaaS Connect. Premier sponsor package.',
      tags: 'conference,speaking,booth', color: '#DC2626',
      vendorId: createdVendors['Eventbrite'], typeId: createdTypes['Conference'],
    },
    {
      title: 'Enterprise Roundtable - London',
      swimlane: 'Events & Webinars', campaign: 'Enterprise ABM Program', status: statusNegotiating.id,
      startDate: dateOffset(25), endDate: dateOffset(25),
      cost: '15000', actualCost: '0', currency: 'UK£' as const, region: 'EMEA' as const,
      expectedSaos: '25', targetSaos: '30', actualSaos: '0',
      pipelineGenerated: '0', revenueGenerated: '0',
      description: 'Exclusive dinner event for 30 enterprise prospects in London financial district.',
      tags: 'event,abm,london,dinner', color: '#7C3AED',
      typeId: createdTypes['Conference'],
    },
    {
      title: 'Summer Webinar Series',
      swimlane: 'Events & Webinars', campaign: 'Summer Promo Series', status: statusConsidering.id,
      startDate: dateOffset(40), endDate: dateOffset(70),
      cost: '12000', actualCost: '0', currency: 'US$' as const, region: 'US' as const,
      expectedSaos: '60', targetSaos: '80', actualSaos: '0',
      pipelineGenerated: '0', revenueGenerated: '0',
      description: '4-part webinar series covering use cases and best practices.',
      tags: 'webinar,series,summer', color: '#F59E0B',
      typeId: createdTypes['Webinar'],
    },

    // ── Content & SEO ──
    {
      title: 'Product Launch Blog Series',
      swimlane: 'Content & SEO', campaign: 'Spring Product Launch', status: statusCommitted.id,
      startDate: dateOffset(-14), endDate: dateOffset(7),
      cost: '4500', actualCost: '4500', currency: 'US$' as const, region: 'US' as const,
      expectedSaos: '20', targetSaos: '25', actualSaos: '18',
      pipelineGenerated: '65000', revenueGenerated: '15000',
      description: '6-part blog series building up to and following the product launch.',
      tags: 'blog,content,seo,launch', color: '#10B981',
      typeId: createdTypes['Blog Post'],
    },
    {
      title: 'Enterprise Case Studies',
      swimlane: 'Content & SEO', campaign: 'Enterprise ABM Program', status: statusCommitted.id,
      startDate: dateOffset(-20), endDate: dateOffset(10),
      cost: '8000', actualCost: '6000', currency: 'US$' as const, region: 'US' as const,
      expectedSaos: '15', targetSaos: '20', actualSaos: '10',
      pipelineGenerated: '120000', revenueGenerated: '35000',
      description: '3 in-depth enterprise case studies with video components.',
      tags: 'case-study,enterprise,content', color: '#0EA5E9',
      typeId: createdTypes['Case Study'],
    },
    {
      title: 'SEO Content Refresh',
      swimlane: 'Content & SEO', campaign: 'Brand Awareness Q2', status: statusNegotiating.id,
      startDate: dateOffset(5), endDate: dateOffset(50),
      cost: '7000', actualCost: '0', currency: 'US$' as const, region: 'US' as const,
      expectedSaos: '30', targetSaos: '45', actualSaos: '0',
      pipelineGenerated: '0', revenueGenerated: '0',
      description: 'Refresh and optimize top 20 landing pages and blog posts for SEO performance.',
      tags: 'seo,optimization,content', color: '#84CC16',
      typeId: createdTypes['Blog Post'],
    },
    {
      title: 'ROI Calculator Tool',
      swimlane: 'Content & SEO', campaign: 'Summer Promo Series', status: statusConsidering.id,
      startDate: dateOffset(35), endDate: dateOffset(55),
      cost: '10000', actualCost: '0', currency: 'US$' as const, region: 'US' as const,
      expectedSaos: '40', targetSaos: '50', actualSaos: '0',
      pipelineGenerated: '0', revenueGenerated: '0',
      description: 'Interactive ROI calculator for website to capture and qualify leads.',
      tags: 'tool,interactive,lead-gen', color: '#F43F5E',
    },

    // ── Partner Marketing ──
    {
      title: 'Co-Marketing with Salesforce',
      swimlane: 'Partner Marketing', campaign: 'Enterprise ABM Program', status: statusCommitted.id,
      startDate: dateOffset(0), endDate: dateOffset(30),
      cost: '20000', actualCost: '18000', currency: 'US$' as const, region: 'US' as const,
      expectedSaos: '50', targetSaos: '65', actualSaos: '42',
      pipelineGenerated: '350000', revenueGenerated: '95000',
      description: 'Joint webinar + co-branded whitepaper with Salesforce integration team.',
      tags: 'partner,salesforce,co-marketing', color: '#0284C7',
      vendorId: createdVendors['Salesforce'], typeId: createdTypes['Webinar'],
    },
    {
      title: 'Partner Referral Program Launch',
      swimlane: 'Partner Marketing', campaign: 'Summer Promo Series', status: statusNegotiating.id,
      startDate: dateOffset(15), endDate: dateOffset(45),
      cost: '8000', actualCost: '0', currency: 'US$' as const, region: 'ROW' as const,
      expectedSaos: '35', targetSaos: '50', actualSaos: '0',
      pipelineGenerated: '0', revenueGenerated: '0',
      description: 'Launch structured referral program with partner enablement materials.',
      tags: 'partner,referral,program', color: '#A855F7',
    },
    {
      title: 'APAC Channel Partner Event',
      swimlane: 'Partner Marketing', campaign: 'Brand Awareness Q2', status: statusConsidering.id,
      startDate: dateOffset(50), endDate: dateOffset(52),
      cost: '18000', actualCost: '0', currency: 'US$' as const, region: 'ROW' as const,
      expectedSaos: '40', targetSaos: '55', actualSaos: '0',
      pipelineGenerated: '0', revenueGenerated: '0',
      description: 'In-person partner summit in Singapore for APAC channel partners.',
      tags: 'partner,event,apac', color: '#E11D48',
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

  return calendar.id;
}

// POST /api/seed - Seed fresh data
export async function POST() {
  try {
    await clearAllData();
    const calendarId = await seedData();
    return NextResponse.json({ success: true, action: 'seed', calendarId });
  } catch (error) {
    console.error('Seed failed:', error);
    return NextResponse.json(
      { error: 'Failed to seed data', details: String(error) },
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
    console.error('Clear failed:', error);
    return NextResponse.json(
      { error: 'Failed to clear data', details: String(error) },
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
    console.error('Reset failed:', error);
    return NextResponse.json(
      { error: 'Failed to reset data', details: String(error) },
      { status: 500 }
    );
  }
}
