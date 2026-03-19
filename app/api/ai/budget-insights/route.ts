import { NextResponse } from 'next/server';
import { db, activities, campaigns, swimlanes } from '@/db';
import { eq, InferSelectModel } from 'drizzle-orm';
import { formatCurrency } from '@/lib/utils';
import { logger } from '@/lib/logger';

type Activity = InferSelectModel<typeof activities>;
type Campaign = InferSelectModel<typeof campaigns>;
type Swimlane = InferSelectModel<typeof swimlanes>;

interface Insight {
  type: 'warning' | 'opportunity' | 'success';
  title: string;
  description: string;
  metric?: string;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const calendarId = searchParams.get('calendarId');

    if (!calendarId) {
      return NextResponse.json({ error: 'calendarId is required' }, { status: 400 });
    }

    const allActivities: Activity[] = await db.select().from(activities).where(eq(activities.calendarId, calendarId));
    const allCampaigns: Campaign[] = await db.select().from(campaigns).where(eq(campaigns.calendarId, calendarId));
    const allSwimlanes: Swimlane[] = await db.select().from(swimlanes).where(eq(swimlanes.calendarId, calendarId));

    const insights: Insight[] = [];
    const now = new Date();

    // --- Campaign budget analysis ---
    for (const campaign of allCampaigns) {
      const campaignActivities = allActivities.filter((a) => a.campaignId === campaign.id);
      const totalActualCost = campaignActivities.reduce((sum, a) => sum + parseFloat(a.actualCost ?? '0'), 0);
      const totalPlannedCost = campaignActivities.reduce((sum, a) => sum + parseFloat(a.cost ?? '0'), 0);
      const budget = parseFloat(campaign.budget ?? '0');

      // Over budget
      if (budget > 0 && totalActualCost > budget) {
        const overBy = totalActualCost - budget;
        insights.push({
          type: 'warning',
          title: `"${campaign.name}" is over budget`,
          description: `Actual spend of ${formatCurrency(totalActualCost)} exceeds the ${formatCurrency(budget)} budget by ${formatCurrency(overBy)}.`,
          metric: `${Math.round((totalActualCost / budget) * 100)}% of budget used`,
        });
      }

      // Significantly under budget
      if (budget > 0 && totalActualCost < budget * 0.5) {
        const pastActivities = campaignActivities.filter((a) => new Date(a.endDate) < now);
        if (pastActivities.length > 0 && pastActivities.length >= campaignActivities.length * 0.5) {
          insights.push({
            type: 'opportunity',
            title: `"${campaign.name}" is significantly under budget`,
            description: `Only ${formatCurrency(totalActualCost)} of ${formatCurrency(budget)} spent (${Math.round((totalActualCost / budget) * 100)}%) with ${pastActivities.length} of ${campaignActivities.length} activities completed. Consider reallocating unused funds.`,
            metric: `${formatCurrency(budget - totalActualCost)} remaining`,
          });
        }
      }

      // High-ROI campaign
      if (totalActualCost > 0) {
        const totalPipeline = campaignActivities.reduce((sum, a) => sum + parseFloat(a.pipelineGenerated ?? '0'), 0);
        const roi = totalPipeline / totalActualCost;
        if (roi > 3) {
          insights.push({
            type: 'success',
            title: `"${campaign.name}" has excellent ROI`,
            description: `Generated ${formatCurrency(totalPipeline)} in pipeline from ${formatCurrency(totalActualCost)} spend, a ${roi.toFixed(1)}x return.`,
            metric: `${roi.toFixed(1)}x ROI`,
          });
        }
      }
    }

    // --- High-ROI individual activities ---
    for (const activity of allActivities) {
      const cost = parseFloat(activity.actualCost ?? '0');
      const pipeline = parseFloat(activity.pipelineGenerated ?? '0');
      if (cost > 0 && pipeline / cost > 3) {
        insights.push({
          type: 'success',
          title: `"${activity.title}" is a top performer`,
          description: `This activity generated ${formatCurrency(pipeline)} in pipeline from ${formatCurrency(cost)} spend.`,
          metric: `${(pipeline / cost).toFixed(1)}x ROI`,
        });
      }
    }

    // --- Activities with no metrics filled in ---
    const pastNoMetrics = allActivities.filter((a) => {
      const isPast = new Date(a.endDate) < now;
      const noSaos = parseFloat(a.actualSaos ?? '0') === 0;
      const noPipeline = parseFloat(a.pipelineGenerated ?? '0') === 0;
      return isPast && noSaos && noPipeline;
    });
    if (pastNoMetrics.length > 0) {
      insights.push({
        type: 'warning',
        title: `${pastNoMetrics.length} completed activit${pastNoMetrics.length === 1 ? 'y has' : 'ies have'} no metrics`,
        description: `The following activities are past their end date but have no SAOs or pipeline recorded: ${pastNoMetrics.slice(0, 5).map((a) => `"${a.title}"`).join(', ')}${pastNoMetrics.length > 5 ? ` and ${pastNoMetrics.length - 5} more` : ''}.`,
        metric: `${pastNoMetrics.length} activit${pastNoMetrics.length === 1 ? 'y' : 'ies'}`,
      });
    }

    // --- Region imbalance ---
    const regionSpend: Record<string, number> = {};
    let totalSpend = 0;
    for (const a of allActivities) {
      const cost = parseFloat(a.actualCost ?? '0');
      const region = a.region ?? 'US';
      regionSpend[region] = (regionSpend[region] ?? 0) + cost;
      totalSpend += cost;
    }
    if (totalSpend > 0) {
      for (const [region, spend] of Object.entries(regionSpend)) {
        const pct = spend / totalSpend;
        if (pct > 0.6) {
          insights.push({
            type: 'warning',
            title: `Regional spend imbalance: ${region}`,
            description: `${Math.round(pct * 100)}% of total spend (${formatCurrency(spend)}) is concentrated in ${region}. Consider diversifying across regions for broader reach.`,
            metric: `${Math.round(pct * 100)}% in ${region}`,
          });
        }
      }
    }

    // --- Status bottleneck ---
    const consideringCount = allActivities.filter((a) => a.status === 'Considering').length;
    if (allActivities.length > 0 && consideringCount / allActivities.length > 0.5 && consideringCount >= 3) {
      insights.push({
        type: 'warning',
        title: 'Too many activities stuck in "Considering"',
        description: `${consideringCount} of ${allActivities.length} activities (${Math.round((consideringCount / allActivities.length) * 100)}%) are still in "Considering" status. Review and advance or remove stalled activities.`,
        metric: `${consideringCount} activities`,
      });
    }

    // --- Swimlane budget efficiency ---
    const swimlaneMap = new Map(allSwimlanes.map((s) => [s.id, s]));
    const swimlaneMetrics: Record<string, { name: string; spend: number; pipeline: number }> = {};

    for (const a of allActivities) {
      const sw = swimlaneMap.get(a.swimlaneId);
      if (!sw) continue;
      if (!swimlaneMetrics[a.swimlaneId]) {
        swimlaneMetrics[a.swimlaneId] = { name: sw.name, spend: 0, pipeline: 0 };
      }
      swimlaneMetrics[a.swimlaneId].spend += parseFloat(a.actualCost ?? '0');
      swimlaneMetrics[a.swimlaneId].pipeline += parseFloat(a.pipelineGenerated ?? '0');
    }

    const swEntries = Object.values(swimlaneMetrics).filter((s) => s.spend > 0);
    if (swEntries.length >= 2) {
      const sorted = swEntries.sort((a, b) => (b.pipeline / b.spend) - (a.pipeline / a.spend));
      const best = sorted[0];
      const worst = sorted[sorted.length - 1];
      const bestRoi = best.pipeline / best.spend;
      const worstRoi = worst.pipeline / worst.spend;

      if (bestRoi > worstRoi * 2 && bestRoi > 1) {
        insights.push({
          type: 'opportunity',
          title: `"${best.name}" outperforms "${worst.name}" in efficiency`,
          description: `"${best.name}" returns ${bestRoi.toFixed(1)}x on spend vs ${worstRoi.toFixed(1)}x for "${worst.name}". Consider shifting budget toward higher-performing channels.`,
          metric: `${bestRoi.toFixed(1)}x vs ${worstRoi.toFixed(1)}x`,
        });
      }
    }

    return NextResponse.json(insights);
  } catch (error) {
    logger.error('Error generating budget insights', error);
    return NextResponse.json({ error: 'Failed to generate budget insights' }, { status: 500 });
  }
}
