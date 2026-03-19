import { NextResponse } from 'next/server';
import { db } from '@/db';
import { campaignReportData, activities, campaigns, swimlanes, CampaignReportData, Activity, Campaign, Swimlane } from '@/db/schema';
import { eq, and, gte, lte } from 'drizzle-orm';
import { logger } from '@/lib/logger';
function isUuid(s: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
}

function safeDiv(a: number, b: number): number {
  return b === 0 ? 0 : a / b;
}

function num(v: string | number | null | undefined): number {
  if (v == null) return 0;
  const n = typeof v === 'string' ? parseFloat(v) : v;
  return isNaN(n) ? 0 : n;
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

    // Fetch report data
    let reportRows: CampaignReportData[] = await db
      .select()
      .from(campaignReportData)
      .where(eq(campaignReportData.calendarId, calendarId));

    // Filter by date range if provided
    if (periodStart && periodEnd) {
      reportRows = reportRows.filter(
        (r) => r.periodEnd >= periodStart && r.periodStart <= periodEnd,
      );
    }

    // Fetch activities
    let activityRows: Activity[] = await db
      .select()
      .from(activities)
      .where(eq(activities.calendarId, calendarId));

    if (periodStart && periodEnd) {
      activityRows = activityRows.filter(
        (a) => a.endDate >= periodStart && a.startDate <= periodEnd,
      );
    }

    // Fetch campaigns and swimlanes
    const campaignRows: Campaign[] = await db
      .select()
      .from(campaigns)
      .where(eq(campaigns.calendarId, calendarId));

    const swimlaneRows: Swimlane[] = await db
      .select()
      .from(swimlanes)
      .where(eq(swimlanes.calendarId, calendarId));

    // Aggregate activity metrics
    const totalSpend = activityRows.reduce((s, a) => s + num(a.actualCost), 0);
    const totalPlanned = activityRows.reduce((s, a) => s + num(a.cost), 0);
    const totalSaos = activityRows.reduce((s, a) => s + num(a.actualSaos), 0);
    const totalExpectedSaos = activityRows.reduce((s, a) => s + num(a.expectedSaos), 0);
    const totalPipeline = activityRows.reduce((s, a) => s + num(a.pipelineGenerated), 0);
    const totalRevenue = activityRows.reduce((s, a) => s + num(a.revenueGenerated), 0);
    const totalBudget = campaignRows.reduce((s, c) => s + num(c.budget), 0);

    // Group report data by source
    const bySource: Record<string, Array<{ label: string; category: string; metrics: Record<string, number> }>> = {};
    for (const row of reportRows) {
      const src = row.source;
      if (!bySource[src]) bySource[src] = [];
      bySource[src].push({ label: row.label, category: row.category, metrics: row.metrics as Record<string, number> });
    }

    // Full funnel aggregation from report data
    const sumMetric = (source: string, key: string) =>
      (bySource[source] || []).reduce((s, r) => s + (r.metrics[key] ?? 0), 0);

    const funnel = {
      impressions: sumMetric('marketo_theme', 'impressions') + sumMetric('linkedin_ads', 'impressions'),
      clicks: sumMetric('marketo_theme', 'clicks') + sumMetric('linkedin_ads', 'clicks'),
      mqls: sumMetric('marketo_theme', 'mqls') + sumMetric('marketo_channel', 'mqls') +
            sumMetric('linkedin_ads', 'mqls') + sumMetric('hero_asset', 'mqls'),
      saos: totalSaos || (sumMetric('marketo_theme', 'saos') + sumMetric('linkedin_ads', 'saos') +
            sumMetric('hero_asset', 'saos') + sumMetric('outreach_sequence', 'saos')),
      pipeline: totalPipeline || sumMetric('hero_asset', 'pipeline') + sumMetric('marketo_theme', 'pipeline'),
      revenue: totalRevenue,
    };

    // Channel comparison
    const channels = [
      {
        name: 'Marketo',
        spend: sumMetric('marketo_theme', 'spend') + sumMetric('marketo_channel', 'spend'),
        saos: sumMetric('marketo_theme', 'saos') + sumMetric('marketo_channel', 'saos'),
        pipeline: sumMetric('marketo_theme', 'pipeline'),
        mqls: sumMetric('marketo_theme', 'mqls') + sumMetric('marketo_channel', 'mqls'),
      },
      {
        name: 'LinkedIn Ads',
        spend: sumMetric('linkedin_ads', 'spend'),
        saos: sumMetric('linkedin_ads', 'saos'),
        pipeline: sumMetric('linkedin_ads', 'leads') * 500, // estimate
        mqls: sumMetric('linkedin_ads', 'mqls'),
      },
      {
        name: 'Outreach',
        spend: sumMetric('outreach_sequence', 'spend'),
        saos: sumMetric('outreach_sequence', 'saos'),
        pipeline: sumMetric('outreach_sequence', 'meetings') * 2000, // estimate
        mqls: 0,
      },
      {
        name: 'Events (SFDC)',
        spend: sumMetric('sfdc_event_leads', 'spend'),
        saos: sumMetric('sfdc_event_leads', 'saos'),
        pipeline: sumMetric('sfdc_event_leads', 'opportunities') * 5000, // estimate
        mqls: sumMetric('sfdc_event_leads', 'mqls'),
      },
    ].map((ch) => ({
      ...ch,
      costPerSao: safeDiv(ch.spend, ch.saos),
      roi: safeDiv(ch.pipeline, ch.spend),
    }));

    // Campaign-level aggregates
    const campaignPerformance = campaignRows.map((c) => {
      const campActivities = activityRows.filter((a) => a.campaignId === c.id);
      const spend = campActivities.reduce((s, a) => s + num(a.actualCost), 0);
      const pipeline = campActivities.reduce((s, a) => s + num(a.pipelineGenerated), 0);
      const revenue = campActivities.reduce((s, a) => s + num(a.revenueGenerated), 0);
      const saos = campActivities.reduce((s, a) => s + num(a.actualSaos), 0);
      return {
        name: c.name,
        budget: num(c.budget),
        spend,
        pipeline,
        revenue,
        saos,
        roi: safeDiv(pipeline, spend),
        costPerSao: safeDiv(spend, saos),
      };
    }).sort((a, b) => b.pipeline - a.pipeline);

    // ICP penetration
    const icpRows = bySource['icp_penetration'] || [];
    const icpSummary = icpRows.filter((r) => r.category === 'summary');
    const icp = {
      targetAccounts: icpSummary.reduce((s, r) => s + (r.metrics.targetAccounts ?? 0), 0),
      engagedAccounts: icpSummary.reduce((s, r) => s + (r.metrics.engagedAccounts ?? 0), 0),
      accountsWithMqls: icpSummary.reduce((s, r) => s + (r.metrics.accountsWithMqls ?? 0), 0),
      accountsWithSaos: icpSummary.reduce((s, r) => s + (r.metrics.accountsWithSaos ?? 0), 0),
      pipeline: icpSummary.reduce((s, r) => s + (r.metrics.pipeline ?? 0), 0),
    };

    // Per-source detail tables
    const sourceDetails: Record<string, Array<{ label: string; metrics: Record<string, number> }>> = {};
    for (const [source, rows] of Object.entries(bySource)) {
      // Aggregate by label
      const labelMap = new Map<string, Record<string, number>>();
      for (const row of rows) {
        const existing = labelMap.get(row.label) ?? {};
        for (const [k, v] of Object.entries(row.metrics)) {
          existing[k] = (existing[k] ?? 0) + v;
        }
        labelMap.set(row.label, existing);
      }
      sourceDetails[source] = [...labelMap.entries()].map(([label, metrics]) => ({ label, metrics }));
    }

    return NextResponse.json({
      summary: {
        totalBudget,
        totalSpend,
        totalPlanned,
        totalSaos,
        totalExpectedSaos,
        totalPipeline,
        totalRevenue,
        overallRoi: safeDiv(totalPipeline, totalSpend),
        activeCampaigns: campaignRows.length,
        activeActivities: activityRows.length,
      },
      funnel,
      channels,
      campaignPerformance,
      icp,
      sourceDetails,
    });
  } catch (error) {
    logger.error('Error fetching campaign performance data', error);
    return NextResponse.json({ error: 'Failed to fetch report data' }, { status: 500 });
  }
}
