import { NextResponse } from 'next/server';
import { db } from '@/db';
import { activities, campaigns, swimlanes, Activity, Campaign, Swimlane } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { logger } from '@/lib/logger';
function isUuid(s: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
}

function num(v: string | number | null | undefined): number {
  if (v == null) return 0;
  const n = typeof v === 'string' ? parseFloat(v) : v;
  return isNaN(n) ? 0 : n;
}

function safeDiv(a: number, b: number): number {
  return b === 0 ? 0 : a / b;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const calendarId = searchParams.get('calendarId');
    const periodStart = searchParams.get('periodStart');
    const periodEnd = searchParams.get('periodEnd');

    if (!calendarId || !isUuid(calendarId)) {
      return NextResponse.json({ error: 'Valid calendarId required' }, { status: 400 });
    }

    let activityRows: Activity[] = await db
      .select()
      .from(activities)
      .where(eq(activities.calendarId, calendarId));

    if (periodStart && periodEnd) {
      activityRows = activityRows.filter(
        (a) => a.endDate >= periodStart && a.startDate <= periodEnd,
      );
    }

    const campaignRows: Campaign[] = await db
      .select()
      .from(campaigns)
      .where(eq(campaigns.calendarId, calendarId));

    const swimlaneRows: Swimlane[] = await db
      .select()
      .from(swimlanes)
      .where(eq(swimlanes.calendarId, calendarId));

    // Overall summary
    const totalBudget =
      campaignRows.reduce((s: number, c) => s + num(c.budget), 0) +
      swimlaneRows.reduce((s: number, sw) => s + num(sw.budget), 0);
    const totalPlanned = activityRows.reduce((s: number, a) => s + num(a.cost), 0);
    const totalActual = activityRows.reduce((s: number, a) => s + num(a.actualCost), 0);
    const totalPipeline = activityRows.reduce((s: number, a) => s + num(a.pipelineGenerated), 0);

    // By swimlane
    const bySwimlane = swimlaneRows.map((sw) => {
      const acts = activityRows.filter((a) => a.swimlaneId === sw.id);
      const planned = acts.reduce((s: number, a) => s + num(a.cost), 0);
      const actual = acts.reduce((s: number, a) => s + num(a.actualCost), 0);
      const pipeline = acts.reduce((s: number, a) => s + num(a.pipelineGenerated), 0);
      const saos = acts.reduce((s: number, a) => s + num(a.actualSaos), 0);
      const budget = num(sw.budget);
      return {
        name: sw.name,
        budget,
        planned,
        actual,
        variance: budget - actual,
        utilization: safeDiv(actual, budget),
        pipeline,
        saos,
        roi: safeDiv(pipeline, actual),
        activityCount: acts.length,
      };
    }).sort((a, b) => b.actual - a.actual);

    // By campaign
    const byCampaign = campaignRows.map((c) => {
      const acts = activityRows.filter((a) => a.campaignId === c.id);
      const planned = acts.reduce((s: number, a) => s + num(a.cost), 0);
      const actual = acts.reduce((s: number, a) => s + num(a.actualCost), 0);
      const pipeline = acts.reduce((s: number, a) => s + num(a.pipelineGenerated), 0);
      const saos = acts.reduce((s: number, a) => s + num(a.actualSaos), 0);
      const budget = num(c.budget);
      return {
        name: c.name,
        budget,
        planned,
        actual,
        variance: budget - actual,
        utilization: safeDiv(actual, budget),
        pipeline,
        saos,
        roi: safeDiv(pipeline, actual),
        activityCount: acts.length,
      };
    }).sort((a, b) => b.actual - a.actual);

    // By region
    const regionMap: Record<string, { spend: number; pipeline: number; saos: number; count: number }> = {
      US: { spend: 0, pipeline: 0, saos: 0, count: 0 },
      EMEA: { spend: 0, pipeline: 0, saos: 0, count: 0 },
      ROW: { spend: 0, pipeline: 0, saos: 0, count: 0 },
    };
    for (const a of activityRows) {
      const region = a.region ?? 'US';
      if (!regionMap[region]) regionMap[region] = { spend: 0, pipeline: 0, saos: 0, count: 0 };
      regionMap[region].spend += num(a.actualCost);
      regionMap[region].pipeline += num(a.pipelineGenerated);
      regionMap[region].saos += num(a.actualSaos);
      regionMap[region].count++;
    }
    const byRegion = Object.entries(regionMap).map(([region, data]) => ({
      region,
      ...data,
      roi: safeDiv(data.pipeline, data.spend),
    }));

    // Over-budget alerts
    const overBudget = [
      ...byCampaign
        .filter((c) => c.budget > 0 && c.actual > c.budget)
        .map((c) => ({
          name: c.name,
          type: 'Campaign' as const,
          budget: c.budget,
          actual: c.actual,
          overrun: safeDiv(c.actual - c.budget, c.budget),
        })),
      ...bySwimlane
        .filter((s) => s.budget > 0 && s.actual > s.budget)
        .map((s) => ({
          name: s.name,
          type: 'Swimlane' as const,
          budget: s.budget,
          actual: s.actual,
          overrun: safeDiv(s.actual - s.budget, s.budget),
        })),
    ].sort((a, b) => b.overrun - a.overrun);

    // Under-budget opportunities
    const underBudget = [
      ...byCampaign
        .filter((c) => c.budget > 0 && c.actual < c.budget * 0.7)
        .map((c) => ({
          name: c.name,
          type: 'Campaign' as const,
          budget: c.budget,
          actual: c.actual,
          remaining: c.budget - c.actual,
          utilization: c.utilization,
        })),
      ...bySwimlane
        .filter((s) => s.budget > 0 && s.actual < s.budget * 0.7)
        .map((s) => ({
          name: s.name,
          type: 'Swimlane' as const,
          budget: s.budget,
          actual: s.actual,
          remaining: s.budget - s.actual,
          utilization: s.utilization,
        })),
    ].sort((a, b) => b.remaining - a.remaining);

    return NextResponse.json({
      summary: {
        totalBudget,
        totalPlanned,
        totalActual,
        totalPipeline,
        remaining: totalBudget - totalActual,
        utilization: safeDiv(totalActual, totalBudget),
        overallRoi: safeDiv(totalPipeline, totalActual),
      },
      bySwimlane,
      byCampaign,
      byRegion,
      overBudget,
      underBudget,
    });
  } catch (error) {
    logger.error('Error fetching budget review data', error);
    return NextResponse.json({ error: 'Failed to fetch budget review data' }, { status: 500 });
  }
}
