import { NextResponse } from 'next/server';
import { db, swimlanes } from '@/db';
import { eq, InferSelectModel } from 'drizzle-orm';

type Swimlane = InferSelectModel<typeof swimlanes>;
import { formatCurrency } from '@/lib/utils';
import { logger } from '@/lib/logger';

interface PlannedActivity {
  title: string;
  startDate: string;
  endDate: string;
  estimatedCost: string;
  swimlaneSuggestion: string;
  description: string;
}

// Campaign phases from the playbook (p.3):
// 1. Messaging & Research (pre-kickoff)
// 2. Content & Design (post-kickoff)
// 3. Sales Enablement
// 4. Promotional & Reporting Setup
type CampaignPhase = 'messaging' | 'content' | 'enablement' | 'promotion';

interface Deliverable {
  title: string;
  description: string;
  /** Turnaround time in business days (from playbook pp.32-33) */
  durationDays: number;
  phase: CampaignPhase;
  /** Keywords for swimlane matching */
  swimlaneHints: string[];
}

// Playbook-aligned campaign types with real deliverables and turnaround times
const CAMPAIGN_TYPES: Record<string, { deliverables: Deliverable[] }> = {
  'product launch': {
    deliverables: [
      { title: 'Messaging & Positioning', description: 'Finalize messaging document with UVP, personas, competitive positioning and proof points', durationDays: 10, phase: 'messaging', swimlaneHints: ['content', 'strategy'] },
      { title: 'Keyword Research', description: 'SEO/GEO keyword analysis and recommendations for solution pages, blogs and articles', durationDays: 5, phase: 'messaging', swimlaneHints: ['seo', 'content'] },
      { title: 'New Solution Page', description: 'Net-new product or solution page with SEO recommendations implemented', durationDays: 20, phase: 'content', swimlaneHints: ['web', 'content'] },
      { title: 'Press Release', description: 'Press release drafted, reviewed and distributed to major industry outlets', durationDays: 15, phase: 'content', swimlaneHints: ['pr', 'comms', 'content'] },
      { title: 'Thought Leadership Blog Post', description: 'Thought leadership blog post aligned to campaign messaging', durationDays: 15, phase: 'content', swimlaneHints: ['content', 'blog'] },
      { title: 'Demo Video', description: 'Storylane or product demo video showcasing key features', durationDays: 5, phase: 'content', swimlaneHints: ['content', 'video', 'creative'] },
      { title: 'Sales Enablement Deck', description: 'Sales enablement deck with positioning, talk track and competitive handling', durationDays: 10, phase: 'enablement', swimlaneHints: ['sales', 'enablement'] },
      { title: 'Sales Sheet', description: 'One-page sales sheet with key messaging and proof points', durationDays: 10, phase: 'enablement', swimlaneHints: ['sales', 'content'] },
      { title: 'Email Campaign', description: 'Email nurture campaign with sequence plan and copy', durationDays: 15, phase: 'promotion', swimlaneHints: ['email', 'digital'] },
      { title: 'Ad Campaign', description: 'Paid media campaign across search and social channels', durationDays: 15, phase: 'promotion', swimlaneHints: ['paid', 'digital', 'ads'] },
      { title: 'Social Media Campaign', description: 'Organic social campaign to amplify launch assets', durationDays: 10, phase: 'promotion', swimlaneHints: ['social', 'digital'] },
    ],
  },
  'use case': {
    deliverables: [
      { title: 'Messaging & Positioning', description: 'Use case messaging with personas, pain points, differentiators and proof points', durationDays: 10, phase: 'messaging', swimlaneHints: ['content', 'strategy'] },
      { title: 'Keyword Research', description: 'SEO/GEO keyword analysis for use case solution pages and content', durationDays: 5, phase: 'messaging', swimlaneHints: ['seo', 'content'] },
      { title: 'New Solution Page', description: 'Use case solution page with SEO-optimized layout, headers and keywords', durationDays: 20, phase: 'content', swimlaneHints: ['web', 'content'] },
      { title: 'SEO Blog Post', description: 'SEO-driven blog post targeting key use case topics', durationDays: 10, phase: 'content', swimlaneHints: ['content', 'blog', 'seo'] },
      { title: 'SEO Article', description: 'Informative industry article on use case themes', durationDays: 10, phase: 'content', swimlaneHints: ['content', 'blog', 'seo'] },
      { title: 'Sales Sheet', description: 'One-page sales sheet with use case messaging and proof points', durationDays: 10, phase: 'enablement', swimlaneHints: ['sales', 'content'] },
      { title: 'Ad Campaign', description: 'Paid media campaign targeting use case audience segments', durationDays: 15, phase: 'promotion', swimlaneHints: ['paid', 'digital', 'ads'] },
      { title: 'Email Campaign', description: 'Email nurture sequence for use case prospects', durationDays: 15, phase: 'promotion', swimlaneHints: ['email', 'digital'] },
    ],
  },
  theme: {
    deliverables: [
      { title: 'Messaging & Positioning', description: 'Theme-level messaging with market trends, competitive analysis and core pillars', durationDays: 10, phase: 'messaging', swimlaneHints: ['content', 'strategy'] },
      { title: 'Keyword Research', description: 'Keyword analysis aligned to theme messaging', durationDays: 5, phase: 'messaging', swimlaneHints: ['seo', 'content'] },
      { title: 'Thought Leadership Blog Post', description: 'Thought leadership blog post on campaign theme', durationDays: 15, phase: 'content', swimlaneHints: ['content', 'blog'] },
      { title: 'Research & Insights Report', description: 'In-depth research report with original data and analysis', durationDays: 40, phase: 'content', swimlaneHints: ['content', 'creative'] },
      { title: 'Solution Page Refresh', description: 'Refresh existing solution page with updated theme messaging', durationDays: 10, phase: 'content', swimlaneHints: ['web', 'content'] },
      { title: 'BDR Sequence', description: 'Outbound BDR email and call sequence aligned to theme', durationDays: 20, phase: 'enablement', swimlaneHints: ['sales', 'enablement'] },
      { title: 'Social Media Campaign', description: 'Organic social campaign aligned to theme assets', durationDays: 10, phase: 'promotion', swimlaneHints: ['social', 'digital'] },
      { title: 'Ad Campaign', description: 'Paid media campaign supporting theme awareness', durationDays: 15, phase: 'promotion', swimlaneHints: ['paid', 'digital', 'ads'] },
    ],
  },
  expansion: {
    deliverables: [
      { title: 'Messaging & Positioning', description: 'Expansion messaging targeting existing customers for upsell and cross-sell', durationDays: 10, phase: 'messaging', swimlaneHints: ['content', 'strategy'] },
      { title: 'Case Study', description: 'Customer case study demonstrating expansion value', durationDays: 10, phase: 'content', swimlaneHints: ['content', 'customer'] },
      { title: 'Sales Sheet', description: 'Expansion-focused sales sheet with proof points', durationDays: 10, phase: 'content', swimlaneHints: ['sales', 'content'] },
      { title: 'Landing Page', description: 'Campaign landing page for expansion offer', durationDays: 10, phase: 'content', swimlaneHints: ['web', 'content'] },
      { title: 'Customer Email Campaign', description: 'Email campaign targeting existing customers for expansion', durationDays: 15, phase: 'promotion', swimlaneHints: ['email', 'digital', 'customer'] },
      { title: 'Newsletter Inclusion', description: 'Customer newsletter featuring expansion messaging', durationDays: 5, phase: 'promotion', swimlaneHints: ['email', 'customer'] },
    ],
  },
  event: {
    deliverables: [
      { title: 'Messaging & Positioning', description: 'Event messaging with audience targeting and key talking points', durationDays: 10, phase: 'messaging', swimlaneHints: ['content', 'strategy'] },
      { title: 'Landing Page', description: 'Event registration landing page', durationDays: 10, phase: 'content', swimlaneHints: ['web', 'content'] },
      { title: 'Press Release', description: 'Event press release for media outreach', durationDays: 15, phase: 'content', swimlaneHints: ['pr', 'comms', 'content'] },
      { title: 'Email Campaign', description: 'Event promotion and registration email sequence', durationDays: 15, phase: 'promotion', swimlaneHints: ['email', 'digital'] },
      { title: 'Ad Campaign', description: 'Paid media to drive event registrations', durationDays: 15, phase: 'promotion', swimlaneHints: ['paid', 'digital', 'ads'] },
      { title: 'Social Media Campaign', description: 'Social promotion for event awareness and registration', durationDays: 10, phase: 'promotion', swimlaneHints: ['social', 'digital'] },
    ],
  },
  'analyst recognition': {
    deliverables: [
      { title: 'Messaging & Positioning', description: 'Analyst recognition messaging with competitive differentiators', durationDays: 10, phase: 'messaging', swimlaneHints: ['content', 'strategy'] },
      { title: 'Press Release', description: 'Press release announcing analyst recognition or award', durationDays: 15, phase: 'content', swimlaneHints: ['pr', 'comms', 'content'] },
      { title: 'Bylined Article', description: 'Thought leadership bylined article leveraging recognition', durationDays: 15, phase: 'content', swimlaneHints: ['content', 'pr'] },
      { title: 'Sales Sheet', description: 'Sales sheet highlighting analyst validation and proof points', durationDays: 10, phase: 'enablement', swimlaneHints: ['sales', 'content'] },
      { title: 'Social Media Campaign', description: 'Social campaign amplifying analyst recognition', durationDays: 10, phase: 'promotion', swimlaneHints: ['social', 'digital'] },
      { title: 'Email Campaign', description: 'Email outreach leveraging analyst recognition', durationDays: 15, phase: 'promotion', swimlaneHints: ['email', 'digital'] },
    ],
  },
  brand: {
    deliverables: [
      { title: 'Messaging & Positioning', description: 'Brand messaging with UVP, core pillars and audience-specific language', durationDays: 10, phase: 'messaging', swimlaneHints: ['content', 'strategy'] },
      { title: 'Long-Form Content', description: 'Long-form educational content (eBook, playbook or whitepaper)', durationDays: 25, phase: 'content', swimlaneHints: ['content', 'creative'] },
      { title: 'Non-Demo Video', description: 'Brand or thought leadership video', durationDays: 15, phase: 'content', swimlaneHints: ['content', 'video', 'creative'] },
      { title: 'Thought Leadership Blog Post', description: 'Thought leadership blog post reinforcing brand narrative', durationDays: 15, phase: 'content', swimlaneHints: ['content', 'blog'] },
      { title: 'Ad Campaign', description: 'Display and social advertising for brand awareness', durationDays: 15, phase: 'promotion', swimlaneHints: ['paid', 'digital', 'ads'] },
      { title: 'Social Media Campaign', description: 'Organic social campaign for brand visibility', durationDays: 10, phase: 'promotion', swimlaneHints: ['social', 'digital'] },
    ],
  },
};

const DEFAULT_DELIVERABLES: Deliverable[] = [
  { title: 'Messaging & Positioning', description: 'Campaign messaging with personas, differentiators and proof points', durationDays: 10, phase: 'messaging', swimlaneHints: ['content', 'strategy'] },
  { title: 'Keyword Research', description: 'SEO/GEO keyword analysis and content recommendations', durationDays: 5, phase: 'messaging', swimlaneHints: ['seo', 'content'] },
  { title: 'Solution Page', description: 'Campaign solution or landing page', durationDays: 20, phase: 'content', swimlaneHints: ['web', 'content'] },
  { title: 'Blog Post', description: 'SEO-optimized blog post aligned to campaign messaging', durationDays: 10, phase: 'content', swimlaneHints: ['content', 'blog'] },
  { title: 'Sales Sheet', description: 'One-page sales sheet with key messaging', durationDays: 10, phase: 'enablement', swimlaneHints: ['sales', 'content'] },
  { title: 'Email Campaign', description: 'Email nurture sequence for campaign audience', durationDays: 15, phase: 'promotion', swimlaneHints: ['email', 'digital'] },
  { title: 'Ad Campaign', description: 'Paid media campaign across targeted channels', durationDays: 15, phase: 'promotion', swimlaneHints: ['paid', 'digital', 'ads'] },
];

function detectCampaignType(goal: string): Deliverable[] {
  const lower = goal.toLowerCase();

  // Direct matches
  if (lower.includes('product launch') || lower.includes('product release')) return CAMPAIGN_TYPES['product launch'].deliverables;
  if (lower.includes('use case') || lower.includes('sub-use case')) return CAMPAIGN_TYPES['use case'].deliverables;
  if (lower.includes('theme') || lower.includes('campaign theme')) return CAMPAIGN_TYPES.theme.deliverables;
  if (lower.includes('expansion') || lower.includes('upsell') || lower.includes('cross-sell')) return CAMPAIGN_TYPES.expansion.deliverables;
  if (lower.includes('event') || lower.includes('conference') || lower.includes('summit') || lower.includes('sponsorship') || lower.includes('webinar')) return CAMPAIGN_TYPES.event.deliverables;
  if (lower.includes('analyst') || lower.includes('gartner') || lower.includes('award') || lower.includes('recognition') || lower.includes('magic quadrant')) return CAMPAIGN_TYPES['analyst recognition'].deliverables;
  if (lower.includes('brand')) return CAMPAIGN_TYPES.brand.deliverables;

  // Secondary keyword matches
  if (lower.includes('launch') || lower.includes('release') || lower.includes('new product')) return CAMPAIGN_TYPES['product launch'].deliverables;
  if (lower.includes('pipeline') || lower.includes('lead gen') || lower.includes('demand')) return CAMPAIGN_TYPES['use case'].deliverables;
  if (lower.includes('awareness') || lower.includes('visibility')) return CAMPAIGN_TYPES.brand.deliverables;
  if (lower.includes('retention') || lower.includes('renewal') || lower.includes('customer')) return CAMPAIGN_TYPES.expansion.deliverables;

  return DEFAULT_DELIVERABLES;
}

// Phase allocation as percentage of total campaign duration (from playbook p.3):
// Messaging & positioning: ~20%, Content & design: ~50%, Sales enablement: ~15%, Promo setup: ~15%
const PHASE_ALLOCATION: Record<CampaignPhase, { start: number; end: number }> = {
  messaging:   { start: 0.00, end: 0.20 },
  content:     { start: 0.20, end: 0.70 },
  enablement:  { start: 0.70, end: 0.85 },
  promotion:   { start: 0.85, end: 1.00 },
};

function scheduleDeliverables(
  deliverables: Deliverable[],
  campaignStart: Date,
  campaignEnd: Date,
): { deliverable: Deliverable; startDate: Date; endDate: Date }[] {
  const totalDays = Math.max(1, Math.ceil((campaignEnd.getTime() - campaignStart.getTime()) / (1000 * 60 * 60 * 24)));

  // Group deliverables by phase
  const byPhase: Record<CampaignPhase, Deliverable[]> = {
    messaging: [],
    content: [],
    enablement: [],
    promotion: [],
  };
  for (const d of deliverables) {
    byPhase[d.phase].push(d);
  }

  const scheduled: { deliverable: Deliverable; startDate: Date; endDate: Date }[] = [];

  for (const phase of ['messaging', 'content', 'enablement', 'promotion'] as CampaignPhase[]) {
    const items = byPhase[phase];
    if (items.length === 0) continue;

    const alloc = PHASE_ALLOCATION[phase];
    const phaseStartDay = Math.round(totalDays * alloc.start);
    const phaseEndDay = Math.round(totalDays * alloc.end);
    const phaseDays = Math.max(1, phaseEndDay - phaseStartDay);

    // Stagger items within the phase
    const staggerGap = Math.max(1, Math.floor(phaseDays / items.length));

    items.forEach((deliverable, i) => {
      const offsetDays = phaseStartDay + staggerGap * i;
      const actStart = new Date(campaignStart);
      actStart.setDate(actStart.getDate() + offsetDays);

      // Duration is the deliverable's turnaround time, capped to not exceed phase end
      const maxDuration = Math.max(1, phaseEndDay - offsetDays);
      const duration = Math.min(deliverable.durationDays, maxDuration);

      const actEnd = new Date(actStart);
      actEnd.setDate(actEnd.getDate() + duration);
      if (actEnd > campaignEnd) actEnd.setTime(campaignEnd.getTime());

      scheduled.push({ deliverable, startDate: actStart, endDate: actEnd });
    });
  }

  return scheduled;
}

function distributeBudget(totalBudget: number, count: number): number[] {
  // 60% main events (first 1-2), 25% supporting (middle), 15% digital (last)
  const costs: number[] = [];
  const mainCount = Math.min(2, Math.ceil(count * 0.3));
  const supportCount = Math.min(2, Math.ceil(count * 0.4));
  const digitalCount = count - mainCount - supportCount;

  const mainBudget = totalBudget * 0.6;
  const supportBudget = totalBudget * 0.25;
  const digitalBudget = totalBudget * 0.15;

  for (let i = 0; i < mainCount; i++) costs.push(Math.round(mainBudget / mainCount));
  for (let i = 0; i < supportCount; i++) costs.push(Math.round(supportBudget / supportCount));
  for (let i = 0; i < Math.max(1, digitalCount); i++) costs.push(Math.round(digitalBudget / Math.max(1, digitalCount)));

  return costs.slice(0, count);
}

function generateName(goal: string, region: string): string {
  const lower = goal.toLowerCase();
  const quarter = `Q${Math.ceil((new Date().getMonth() + 1) / 3)}`;
  const year = new Date().getFullYear();
  if (lower.includes('launch') || lower.includes('release')) return `Product Launch - ${region} ${quarter} ${year}`;
  if (lower.includes('use case')) return `Use Case Campaign - ${region} ${quarter} ${year}`;
  if (lower.includes('theme')) return `Campaign Theme - ${region} ${quarter} ${year}`;
  if (lower.includes('expansion') || lower.includes('upsell')) return `Expansion Campaign - ${region} ${quarter} ${year}`;
  if (lower.includes('event') || lower.includes('conference') || lower.includes('summit')) return `Event Campaign - ${region} ${quarter} ${year}`;
  if (lower.includes('analyst') || lower.includes('gartner') || lower.includes('award')) return `Analyst Recognition - ${region} ${quarter} ${year}`;
  if (lower.includes('brand') || lower.includes('awareness')) return `Brand Campaign - ${region} ${quarter} ${year}`;
  return `Marketing Campaign - ${region} ${quarter} ${year}`;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { calendarId, goal, budget, region, startDate, endDate, audience, objective } = body;

    if (!calendarId || !goal || !budget || !startDate || !endDate) {
      return NextResponse.json(
        { error: 'calendarId, goal, budget, startDate, and endDate are required' },
        { status: 400 }
      );
    }

    const totalBudget = parseFloat(budget);
    if (isNaN(totalBudget) || totalBudget <= 0) {
      return NextResponse.json({ error: 'Budget must be a positive number' }, { status: 400 });
    }

    // Fetch existing swimlanes for context
    const existingSwimlanes: Swimlane[] = await db.select().from(swimlanes).where(eq(swimlanes.calendarId, calendarId));
    const swimlaneNames = existingSwimlanes.map((s) => s.name);

    // Detect campaign type and get deliverables
    const deliverables = detectCampaignType(goal);
    const costs = distributeBudget(totalBudget, deliverables.length);

    // Schedule deliverables across phases
    const start = new Date(startDate);
    const end = new Date(endDate);
    const scheduledItems = scheduleDeliverables(deliverables, start, end);

    // Map activity types to swimlane suggestions
    const suggestSwimlane = (hints: string[]): string => {
      for (const hint of hints) {
        for (const name of swimlaneNames) {
          if (name.toLowerCase().includes(hint)) return name;
        }
      }
      if (swimlaneNames.length > 0) {
        return swimlaneNames[0];
      }
      return 'General Marketing';
    };

    // Build audience context for descriptions
    const audienceContext = audience ? ` targeting ${audience}` : '';
    const objectiveContext = objective ? ` to ${objective}` : '';

    const plannedActivities: PlannedActivity[] = scheduledItems.map((item, i) => {
      const desc = item.deliverable.description + audienceContext + objectiveContext;
      return {
        title: item.deliverable.title,
        startDate: item.startDate.toISOString().split('T')[0],
        endDate: item.endDate.toISOString().split('T')[0],
        estimatedCost: formatCurrency(costs[i] ?? 0),
        swimlaneSuggestion: suggestSwimlane(item.deliverable.swimlaneHints),
        description: desc,
      };
    });

    const suggestedName = generateName(goal, region || 'US');

    return NextResponse.json({
      suggestedName,
      activities: plannedActivities,
    });
  } catch (error) {
    logger.error('Error generating campaign brief', error);
    return NextResponse.json({ error: 'Failed to generate campaign brief' }, { status: 500 });
  }
}
