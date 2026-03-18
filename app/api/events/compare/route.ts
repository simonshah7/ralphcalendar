import { NextResponse } from 'next/server';
import { db, activities, campaigns, swimlanes } from '@/db';
import { eq, type InferSelectModel } from 'drizzle-orm';
import { formatCurrency } from '@/lib/utils';

type Activity = InferSelectModel<typeof activities>;

function parseNum(val: string | number | null | undefined): number {
  if (val == null) return 0;
  const n = typeof val === 'string' ? parseFloat(val) : val;
  return isNaN(n) ? 0 : n;
}

function pctChange(prev: number, curr: number): number | null {
  if (prev === 0 && curr === 0) return 0;
  if (prev === 0) return null; // new this year
  return ((curr - prev) / prev) * 100;
}

/**
 * Normalize an activity title for fuzzy matching across years.
 * Strips year patterns (4-digit numbers), common suffixes, and lowercases.
 */
function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/\b(20\d{2}|'\d{2})\b/g, '') // strip year references
    .replace(/\b(fy\d{2,4})\b/gi, '')     // strip fiscal year refs
    .replace(/\b(h[12]|q[1-4])\b/gi, '')  // strip H1/H2/Q1-Q4
    .replace(/[^a-z0-9\s]/g, '')           // strip special chars
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Simple similarity score between two normalized strings.
 * Returns 0-1 where 1 is exact match.
 */
function similarity(a: string, b: string): number {
  if (a === b) return 1;
  if (!a || !b) return 0;

  const wordsA = new Set(a.split(' '));
  const wordsB = new Set(b.split(' '));
  const intersection = new Set([...wordsA].filter(w => wordsB.has(w)));
  const union = new Set([...wordsA, ...wordsB]);

  return union.size > 0 ? intersection.size / union.size : 0;
}

export interface EventComparison {
  title: string;
  normalizedKey: string;
  priorYear: {
    year: number;
    activityId: string | null;
    title: string | null;
    startDate: string | null;
    endDate: string | null;
    cost: number;
    actualCost: number;
    expectedSaos: number;
    actualSaos: number;
    pipelineGenerated: number;
    revenueGenerated: number;
    roi: number;
    costPerSao: number;
    campaign: string | null;
    swimlane: string | null;
    region: string | null;
  } | null;
  currentYear: {
    year: number;
    activityId: string | null;
    title: string | null;
    startDate: string | null;
    endDate: string | null;
    cost: number;
    actualCost: number;
    expectedSaos: number;
    actualSaos: number;
    pipelineGenerated: number;
    revenueGenerated: number;
    roi: number;
    costPerSao: number;
    campaign: string | null;
    swimlane: string | null;
    region: string | null;
  } | null;
  changes: {
    costChange: number | null;
    costChangePct: number | null;
    actualCostChange: number | null;
    actualCostChangePct: number | null;
    saosChange: number;
    saosChangePct: number | null;
    pipelineChange: number;
    pipelineChangePct: number | null;
    roiChange: number;
    costPerSaoChange: number | null;
  };
  recommendation: 'invest' | 'maintain' | 'reduce' | 'cut' | 'new' | 'retired';
}

export interface ComparisonSummary {
  priorYear: number;
  currentYear: number;
  totalEvents: number;
  matchedEvents: number;
  newEvents: number;
  retiredEvents: number;
  totalPriorCost: number;
  totalCurrentCost: number;
  totalCostChange: number;
  totalCostChangePct: number | null;
  totalPriorSaos: number;
  totalCurrentSaos: number;
  totalPriorPipeline: number;
  totalCurrentPipeline: number;
  avgPriorRoi: number;
  avgCurrentRoi: number;
  comparisons: EventComparison[];
}

function buildActivityStats(
  activity: Activity,
  year: number,
  campaignMap: Map<string, string>,
  swimlaneMap: Map<string, string>,
) {
  const cost = parseNum(activity.cost);
  const actualCost = parseNum(activity.actualCost);
  const expectedSaos = parseNum(activity.expectedSaos);
  const actualSaos = parseNum(activity.actualSaos);
  const pipeline = parseNum(activity.pipelineGenerated);
  const revenue = parseNum(activity.revenueGenerated);
  const spend = actualCost > 0 ? actualCost : cost;
  const roi = spend > 0 ? pipeline / spend : 0;
  const costPerSao = actualSaos > 0 ? spend / actualSaos : 0;

  return {
    year,
    activityId: activity.id,
    title: activity.title,
    startDate: activity.startDate,
    endDate: activity.endDate,
    cost,
    actualCost,
    expectedSaos,
    actualSaos,
    pipelineGenerated: pipeline,
    revenueGenerated: revenue,
    roi,
    costPerSao,
    campaign: activity.campaignId ? campaignMap.get(activity.campaignId) ?? null : null,
    swimlane: activity.swimlaneId ? swimlaneMap.get(activity.swimlaneId) ?? null : null,
    region: activity.region,
  };
}

function deriveRecommendation(comp: EventComparison): EventComparison['recommendation'] {
  if (!comp.priorYear) return 'new';
  if (!comp.currentYear) return 'retired';

  const priorRoi = comp.priorYear.roi;
  const priorSaos = comp.priorYear.actualSaos;
  const pipeline = comp.priorYear.pipelineGenerated;

  // Strong performer: high ROI and good SAO generation
  if (priorRoi >= 3 && priorSaos > 0) return 'invest';
  // Moderate performer
  if (priorRoi >= 1 && priorSaos > 0) return 'maintain';
  // Low ROI but some pipeline
  if (pipeline > 0) return 'reduce';
  // No returns
  return 'cut';
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const calendarId = searchParams.get('calendarId');
    const priorYearParam = searchParams.get('priorYear');
    const currentYearParam = searchParams.get('currentYear');

    if (!calendarId) {
      return NextResponse.json({ error: 'calendarId is required' }, { status: 400 });
    }

    const currentDate = new Date();
    const currentYear = currentYearParam ? parseInt(currentYearParam) : currentDate.getFullYear();
    const priorYear = priorYearParam ? parseInt(priorYearParam) : currentYear - 1;

    // Fetch all activities for this calendar
    const allActivities: Activity[] = await db
      .select()
      .from(activities)
      .where(eq(activities.calendarId, calendarId));

    // Fetch campaigns and swimlanes for name lookups
    const allCampaigns = await db.select().from(campaigns).where(eq(campaigns.calendarId, calendarId));
    const allSwimlanes = await db.select().from(swimlanes).where(eq(swimlanes.calendarId, calendarId));

    const campaignMap = new Map<string, string>(allCampaigns.map((c: { id: string; name: string }) => [c.id, c.name]));
    const swimlaneMap = new Map<string, string>(allSwimlanes.map((s: { id: string; name: string }) => [s.id, s.name]));

    // Split activities by year based on startDate
    const priorActivities = allActivities.filter(a => {
      const year = new Date(a.startDate).getFullYear();
      return year === priorYear;
    });

    const currentActivities = allActivities.filter(a => {
      const year = new Date(a.startDate).getFullYear();
      return year === currentYear;
    });

    // Build normalized title maps for matching
    const priorMap = new Map<string, Activity>();
    for (const a of priorActivities) {
      const key = normalizeTitle(a.title);
      if (key) priorMap.set(key, a);
    }

    const currentMap = new Map<string, Activity>();
    for (const a of currentActivities) {
      const key = normalizeTitle(a.title);
      if (key) currentMap.set(key, a);
    }

    // Match activities: exact normalized match first, then fuzzy
    const matched = new Set<string>();
    const matchedCurrent = new Set<string>();
    const comparisons: EventComparison[] = [];

    // Pass 1: Exact normalized title matches
    for (const [key, priorActivity] of priorMap) {
      if (currentMap.has(key)) {
        const currentActivity = currentMap.get(key)!;
        const prior = buildActivityStats(priorActivity, priorYear, campaignMap, swimlaneMap);
        const current = buildActivityStats(currentActivity, currentYear, campaignMap, swimlaneMap);
        const priorSpend = prior.actualCost > 0 ? prior.actualCost : prior.cost;
        const currentSpend = current.actualCost > 0 ? current.actualCost : current.cost;

        const comp: EventComparison = {
          title: currentActivity.title,
          normalizedKey: key,
          priorYear: prior,
          currentYear: current,
          changes: {
            costChange: current.cost - prior.cost,
            costChangePct: pctChange(prior.cost, current.cost),
            actualCostChange: current.actualCost - prior.actualCost,
            actualCostChangePct: pctChange(prior.actualCost, current.actualCost),
            saosChange: current.actualSaos - prior.actualSaos,
            saosChangePct: pctChange(prior.actualSaos, current.actualSaos),
            pipelineChange: current.pipelineGenerated - prior.pipelineGenerated,
            pipelineChangePct: pctChange(prior.pipelineGenerated, current.pipelineGenerated),
            roiChange: current.roi - prior.roi,
            costPerSaoChange: pctChange(prior.costPerSao, current.costPerSao),
          },
          recommendation: 'maintain',
        };
        comp.recommendation = deriveRecommendation(comp);
        comparisons.push(comp);
        matched.add(key);
        matchedCurrent.add(key);
      }
    }

    // Pass 2: Fuzzy matching for unmatched
    const unmatchedPrior = [...priorMap.entries()].filter(([k]) => !matched.has(k));
    const unmatchedCurrent = [...currentMap.entries()].filter(([k]) => !matchedCurrent.has(k));

    for (const [priorKey, priorActivity] of unmatchedPrior) {
      let bestMatch: { key: string; activity: Activity; score: number } | null = null;

      for (const [currentKey, currentActivity] of unmatchedCurrent) {
        if (matchedCurrent.has(currentKey)) continue;
        const score = similarity(priorKey, currentKey);
        if (score >= 0.6 && (!bestMatch || score > bestMatch.score)) {
          bestMatch = { key: currentKey, activity: currentActivity, score };
        }
      }

      if (bestMatch) {
        const prior = buildActivityStats(priorActivity, priorYear, campaignMap, swimlaneMap);
        const current = buildActivityStats(bestMatch.activity, currentYear, campaignMap, swimlaneMap);

        const comp: EventComparison = {
          title: `${bestMatch.activity.title}`,
          normalizedKey: priorKey,
          priorYear: prior,
          currentYear: current,
          changes: {
            costChange: current.cost - prior.cost,
            costChangePct: pctChange(prior.cost, current.cost),
            actualCostChange: current.actualCost - prior.actualCost,
            actualCostChangePct: pctChange(prior.actualCost, current.actualCost),
            saosChange: current.actualSaos - prior.actualSaos,
            saosChangePct: pctChange(prior.actualSaos, current.actualSaos),
            pipelineChange: current.pipelineGenerated - prior.pipelineGenerated,
            pipelineChangePct: pctChange(prior.pipelineGenerated, current.pipelineGenerated),
            roiChange: current.roi - prior.roi,
            costPerSaoChange: pctChange(prior.costPerSao, current.costPerSao),
          },
          recommendation: 'maintain',
        };
        comp.recommendation = deriveRecommendation(comp);
        comparisons.push(comp);
        matched.add(priorKey);
        matchedCurrent.add(bestMatch.key);
      }
    }

    // Pass 3: Unmatched prior-year events (retired)
    for (const [key, priorActivity] of priorMap) {
      if (matched.has(key)) continue;
      const prior = buildActivityStats(priorActivity, priorYear, campaignMap, swimlaneMap);
      comparisons.push({
        title: priorActivity.title,
        normalizedKey: key,
        priorYear: prior,
        currentYear: null,
        changes: {
          costChange: null,
          costChangePct: null,
          actualCostChange: null,
          actualCostChangePct: null,
          saosChange: 0,
          saosChangePct: null,
          pipelineChange: 0,
          pipelineChangePct: null,
          roiChange: 0,
          costPerSaoChange: null,
        },
        recommendation: 'retired',
      });
    }

    // Pass 4: Unmatched current-year events (new)
    for (const [key, currentActivity] of currentMap) {
      if (matchedCurrent.has(key)) continue;
      const current = buildActivityStats(currentActivity, currentYear, campaignMap, swimlaneMap);
      comparisons.push({
        title: currentActivity.title,
        normalizedKey: key,
        priorYear: null,
        currentYear: current,
        changes: {
          costChange: null,
          costChangePct: null,
          actualCostChange: null,
          actualCostChangePct: null,
          saosChange: 0,
          saosChangePct: null,
          pipelineChange: 0,
          pipelineChangePct: null,
          roiChange: 0,
          costPerSaoChange: null,
        },
        recommendation: 'new',
      });
    }

    // Sort: matched first (by prior pipeline desc), then new, then retired
    comparisons.sort((a, b) => {
      const order = { invest: 0, maintain: 1, reduce: 2, new: 3, cut: 4, retired: 5 };
      if (order[a.recommendation] !== order[b.recommendation]) {
        return order[a.recommendation] - order[b.recommendation];
      }
      const aPipeline = a.priorYear?.pipelineGenerated ?? a.currentYear?.pipelineGenerated ?? 0;
      const bPipeline = b.priorYear?.pipelineGenerated ?? b.currentYear?.pipelineGenerated ?? 0;
      return bPipeline - aPipeline;
    });

    // Build summary
    const totalPriorCost = priorActivities.reduce((s, a) => s + Math.max(parseNum(a.actualCost), parseNum(a.cost)), 0);
    const totalCurrentCost = currentActivities.reduce((s, a) => s + Math.max(parseNum(a.actualCost), parseNum(a.cost)), 0);
    const totalPriorSaos = priorActivities.reduce((s, a) => s + parseNum(a.actualSaos), 0);
    const totalCurrentSaos = currentActivities.reduce((s, a) => s + parseNum(a.actualSaos), 0);
    const totalPriorPipeline = priorActivities.reduce((s, a) => s + parseNum(a.pipelineGenerated), 0);
    const totalCurrentPipeline = currentActivities.reduce((s, a) => s + parseNum(a.pipelineGenerated), 0);

    const matchedCount = comparisons.filter(c => c.priorYear && c.currentYear).length;

    const summary: ComparisonSummary = {
      priorYear,
      currentYear,
      totalEvents: comparisons.length,
      matchedEvents: matchedCount,
      newEvents: comparisons.filter(c => c.recommendation === 'new').length,
      retiredEvents: comparisons.filter(c => c.recommendation === 'retired').length,
      totalPriorCost,
      totalCurrentCost,
      totalCostChange: totalCurrentCost - totalPriorCost,
      totalCostChangePct: pctChange(totalPriorCost, totalCurrentCost),
      totalPriorSaos,
      totalCurrentSaos,
      totalPriorPipeline,
      totalCurrentPipeline,
      avgPriorRoi: totalPriorCost > 0 ? totalPriorPipeline / totalPriorCost : 0,
      avgCurrentRoi: totalCurrentCost > 0 ? totalCurrentPipeline / totalCurrentCost : 0,
      comparisons,
    };

    return NextResponse.json(summary);
  } catch (error) {
    console.error('Error in event comparison:', error);
    return NextResponse.json({ error: 'Failed to compare events' }, { status: 500 });
  }
}
