import { NextResponse } from 'next/server';
import { db, activities, swimlanes } from '@/db';
import { eq } from 'drizzle-orm';
import { formatCurrency } from '@/lib/utils';

interface PlannedActivity {
  title: string;
  startDate: string;
  endDate: string;
  estimatedCost: string;
  swimlaneSuggestion: string;
  description: string;
}

const GOAL_KEYWORDS: Record<string, { types: string[]; descriptions: string[] }> = {
  launch: {
    types: ['Product Launch Event', 'Press Release', 'Launch Webinar', 'Social Media Blitz', 'Influencer Outreach'],
    descriptions: [
      'Flagship launch event to showcase the new product to key stakeholders',
      'Press release distribution to major industry outlets',
      'Live webinar demonstrating product features and use cases',
      'Coordinated social media campaign across all platforms',
      'Targeted outreach to industry influencers for product reviews',
    ],
  },
  awareness: {
    types: ['Content Series', 'Social Campaign', 'Blog Posts', 'Podcast Sponsorship', 'Display Advertising'],
    descriptions: [
      'Multi-part content series highlighting brand value propositions',
      'Paid and organic social media awareness campaign',
      'SEO-optimized blog content targeting key industry topics',
      'Sponsorship of relevant industry podcasts for brand exposure',
      'Programmatic display advertising across targeted networks',
    ],
  },
  'lead gen': {
    types: ['Webinar Series', 'Trade Show', 'Gated Content', 'Email Nurture Campaign', 'Paid Search'],
    descriptions: [
      'Educational webinar series to capture and qualify leads',
      'Trade show presence with booth and speaking opportunities',
      'High-value gated content (whitepaper/ebook) for lead capture',
      'Automated email nurture sequence for lead qualification',
      'Targeted paid search campaigns for high-intent keywords',
    ],
  },
  event: {
    types: ['Conference', 'Workshop', 'Networking Mixer', 'Virtual Summit', 'Roadshow'],
    descriptions: [
      'Full-day conference with keynotes and breakout sessions',
      'Hands-on workshop for customers and prospects',
      'Evening networking event for industry professionals',
      'Virtual summit with multiple tracks and speakers',
      'Multi-city roadshow to engage regional audiences',
    ],
  },
  retention: {
    types: ['Customer Appreciation Event', 'Loyalty Program Launch', 'Feedback Survey', 'Renewal Campaign', 'Community Building'],
    descriptions: [
      'Exclusive event for top customers to deepen relationships',
      'Launch of tiered loyalty program with rewards',
      'Comprehensive customer feedback and satisfaction survey',
      'Proactive renewal outreach with special incentives',
      'Online community platform launch for peer engagement',
    ],
  },
};

const DEFAULT_TYPES = {
  types: ['Kickoff Meeting', 'Content Development', 'Digital Campaign', 'Event', 'Wrap-up Report'],
  descriptions: [
    'Campaign kickoff meeting to align teams and set objectives',
    'Development of campaign creative assets and content',
    'Multi-channel digital marketing campaign execution',
    'Anchor event to drive engagement and lead capture',
    'Post-campaign analysis and performance report',
  ],
};

function detectGoalCategory(goal: string): { types: string[]; descriptions: string[] } {
  const lower = goal.toLowerCase();
  for (const [keyword, config] of Object.entries(GOAL_KEYWORDS)) {
    if (lower.includes(keyword)) {
      return config;
    }
  }
  // Check secondary keywords
  if (lower.includes('brand') || lower.includes('visibility')) return GOAL_KEYWORDS.awareness;
  if (lower.includes('leads') || lower.includes('pipeline') || lower.includes('demand')) return GOAL_KEYWORDS['lead gen'];
  if (lower.includes('product') || lower.includes('release')) return GOAL_KEYWORDS.launch;
  if (lower.includes('conference') || lower.includes('summit')) return GOAL_KEYWORDS.event;
  if (lower.includes('customer') || lower.includes('loyalty')) return GOAL_KEYWORDS.retention;
  return DEFAULT_TYPES;
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
  if (lower.includes('launch')) return `Product Launch Campaign - ${region} ${quarter} ${year}`;
  if (lower.includes('awareness')) return `Brand Awareness Initiative - ${region} ${quarter} ${year}`;
  if (lower.includes('lead')) return `Lead Generation Program - ${region} ${quarter} ${year}`;
  if (lower.includes('event')) return `Event Series - ${region} ${quarter} ${year}`;
  if (lower.includes('retention')) return `Customer Retention Drive - ${region} ${quarter} ${year}`;
  return `Marketing Campaign - ${region} ${quarter} ${year}`;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { calendarId, goal, budget, region, startDate, endDate } = body;

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

    // Fetch existing swimlanes and activities for context
    const existingSwimlanes = await db.select().from(swimlanes).where(eq(swimlanes.calendarId, calendarId));
    const existingActivities = await db.select().from(activities).where(eq(activities.calendarId, calendarId));

    // Build swimlane name list for suggestions
    const swimlaneNames = existingSwimlanes.map((s) => s.name);

    // Analyze existing activity patterns
    const existingTags = new Set<string>();
    for (const act of existingActivities) {
      if (act.tags) {
        act.tags.split(',').forEach((t) => existingTags.add(t.trim().toLowerCase()));
      }
    }

    // Generate plan based on goal
    const goalConfig = detectGoalCategory(goal);
    const activityCount = goalConfig.types.length;
    const costs = distributeBudget(totalBudget, activityCount);

    // Space activities across the date range
    const start = new Date(startDate);
    const end = new Date(endDate);
    const totalDays = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
    const gap = Math.max(1, Math.floor(totalDays / activityCount));

    // Map activity types to swimlane suggestions
    const suggestSwimlane = (activityTitle: string): string => {
      const lower = activityTitle.toLowerCase();
      // Try to match existing swimlane names
      for (const name of swimlaneNames) {
        const nameLower = name.toLowerCase();
        if (lower.includes('digital') && nameLower.includes('digital')) return name;
        if (lower.includes('event') && nameLower.includes('event')) return name;
        if (lower.includes('content') && nameLower.includes('content')) return name;
        if (lower.includes('social') && nameLower.includes('social')) return name;
        if (lower.includes('email') && nameLower.includes('email')) return name;
        if (lower.includes('webinar') && nameLower.includes('webinar')) return name;
      }
      // Fallback: suggest the first swimlane or a generic name
      if (swimlaneNames.length > 0) {
        const index = Math.floor(Math.random() * swimlaneNames.length);
        return swimlaneNames[index];
      }
      return 'General Marketing';
    };

    const plannedActivities: PlannedActivity[] = goalConfig.types.map((type, i) => {
      const actStart = new Date(start);
      actStart.setDate(actStart.getDate() + gap * i);
      const actEnd = new Date(actStart);
      actEnd.setDate(actEnd.getDate() + Math.min(gap - 1, 7)); // Activities last up to 7 days
      if (actEnd > end) actEnd.setTime(end.getTime());

      return {
        title: type,
        startDate: actStart.toISOString().split('T')[0],
        endDate: actEnd.toISOString().split('T')[0],
        estimatedCost: formatCurrency(costs[i] ?? 0),
        swimlaneSuggestion: suggestSwimlane(type),
        description: goalConfig.descriptions[i] ?? '',
      };
    });

    const suggestedName = generateName(goal, region || 'US');

    return NextResponse.json({
      suggestedName,
      activities: plannedActivities,
    });
  } catch (error) {
    console.error('Error generating campaign brief:', error);
    return NextResponse.json({ error: 'Failed to generate campaign brief' }, { status: 500 });
  }
}
