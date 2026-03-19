import { NextResponse } from 'next/server';
import { db, activities, campaigns, swimlanes } from '@/db';
import { eq, InferSelectModel } from 'drizzle-orm';

type Activity = InferSelectModel<typeof activities>;
type Campaign = InferSelectModel<typeof campaigns>;
type Swimlane = InferSelectModel<typeof swimlanes>;
import { formatCurrency } from '@/lib/utils';
import { logger } from '@/lib/logger';

interface CopilotResponse {
  answer: string;
  data?: Record<string, unknown>[];
}

function parseNum(val: string | null | undefined): number {
  return parseFloat(val ?? '0') || 0;
}

const HELP_TEXT = `I can answer questions about your marketing calendar, including:
- "How much have we spent on [campaign or region]?"
- "Which campaigns are over budget?"
- "What is the ROI for [campaign]?"
- "Show activities without metrics"
- "What is our total budget?"
- "Compare [region] vs [region]" (e.g., US vs EMEA)
- "Compare events [year] vs [year]" (e.g., compare events 2024 vs 2025)
- "Top performing campaigns"
- "Upcoming activities"

Try asking one of these!`;

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { calendarId, question } = body;

    if (!calendarId || !question) {
      return NextResponse.json({ error: 'calendarId and question are required' }, { status: 400 });
    }

    const q = question.toLowerCase().trim();

    const allActivities: Activity[] = await db.select().from(activities).where(eq(activities.calendarId, calendarId));
    const allCampaigns: Campaign[] = await db.select().from(campaigns).where(eq(campaigns.calendarId, calendarId));
    const allSwimlanes: Swimlane[] = await db.select().from(swimlanes).where(eq(swimlanes.calendarId, calendarId));

    const campaignMap = new Map(allCampaigns.map((c) => [c.id, c]));

    // --- "how much have we spent" queries ---
    if (/how much.*(spent|spend|cost)/.test(q)) {
      // Check for region
      const regionMatch = q.match(/\b(us|emea|row)\b/i);
      if (regionMatch) {
        const region = regionMatch[1].toUpperCase();
        const regionActivities = allActivities.filter((a) => (a.region ?? '').toUpperCase() === region);
        const totalSpend = regionActivities.reduce((s, a) => s + parseNum(a.actualCost), 0);
        return NextResponse.json({
          answer: `Total spend in ${region}: ${formatCurrency(totalSpend)}. This covers ${regionActivities.length} activit${regionActivities.length === 1 ? 'y' : 'ies'}.`,
          data: regionActivities.map((a) => ({ title: a.title, actualCost: a.actualCost, region: a.region })),
        } satisfies CopilotResponse);
      }

      // Check for campaign name
      const matchedCampaign = allCampaigns.find((c) => q.includes(c.name.toLowerCase()));
      if (matchedCampaign) {
        const campActivities = allActivities.filter((a) => a.campaignId === matchedCampaign.id);
        const totalSpend = campActivities.reduce((s, a) => s + parseNum(a.actualCost), 0);
        return NextResponse.json({
          answer: `Total spend on "${matchedCampaign.name}": ${formatCurrency(totalSpend)} across ${campActivities.length} activit${campActivities.length === 1 ? 'y' : 'ies'}. Budget is ${formatCurrency(parseNum(matchedCampaign.budget))}.`,
          data: campActivities.map((a) => ({ title: a.title, actualCost: a.actualCost })),
        } satisfies CopilotResponse);
      }

      // Total spend
      const totalSpend = allActivities.reduce((s, a) => s + parseNum(a.actualCost), 0);
      return NextResponse.json({
        answer: `Total spend across all activities: ${formatCurrency(totalSpend)}.`,
      } satisfies CopilotResponse);
    }

    // --- "over budget" queries ---
    if (/over\s*budget/.test(q)) {
      const overBudget: { name: string; budget: string; actualSpend: string; overBy: string }[] = [];
      for (const campaign of allCampaigns) {
        const budget = parseNum(campaign.budget);
        if (budget <= 0) continue;
        const campActivities = allActivities.filter((a) => a.campaignId === campaign.id);
        const totalSpend = campActivities.reduce((s, a) => s + parseNum(a.actualCost), 0);
        if (totalSpend > budget) {
          overBudget.push({
            name: campaign.name,
            budget: formatCurrency(budget),
            actualSpend: formatCurrency(totalSpend),
            overBy: formatCurrency(totalSpend - budget),
          });
        }
      }
      if (overBudget.length === 0) {
        return NextResponse.json({ answer: 'No campaigns are currently over budget.' } satisfies CopilotResponse);
      }
      const lines = overBudget.map((c) => `- "${c.name}": spent ${c.actualSpend} of ${c.budget} budget (over by ${c.overBy})`);
      return NextResponse.json({
        answer: `${overBudget.length} campaign${overBudget.length === 1 ? ' is' : 's are'} over budget:\n${lines.join('\n')}`,
        data: overBudget,
      } satisfies CopilotResponse);
    }

    // --- "ROI" queries ---
    if (/\broi\b/.test(q)) {
      const matchedCampaign = allCampaigns.find((c) => q.includes(c.name.toLowerCase()));
      if (matchedCampaign) {
        const campActivities = allActivities.filter((a) => a.campaignId === matchedCampaign.id);
        const totalSpend = campActivities.reduce((s, a) => s + parseNum(a.actualCost), 0);
        const totalPipeline = campActivities.reduce((s, a) => s + parseNum(a.pipelineGenerated), 0);
        const roi = totalSpend > 0 ? (totalPipeline / totalSpend).toFixed(1) : 'N/A';
        return NextResponse.json({
          answer: `ROI for "${matchedCampaign.name}": ${roi}x (${formatCurrency(totalPipeline)} pipeline from ${formatCurrency(totalSpend)} spend).`,
        } satisfies CopilotResponse);
      }
      // Overall ROI
      const totalSpend = allActivities.reduce((s, a) => s + parseNum(a.actualCost), 0);
      const totalPipeline = allActivities.reduce((s, a) => s + parseNum(a.pipelineGenerated), 0);
      const roi = totalSpend > 0 ? (totalPipeline / totalSpend).toFixed(1) : 'N/A';
      return NextResponse.json({
        answer: `Overall ROI: ${roi}x (${formatCurrency(totalPipeline)} pipeline from ${formatCurrency(totalSpend)} total spend).`,
      } satisfies CopilotResponse);
    }

    // --- "without metrics" / "no metrics" / "missing metrics" ---
    if (/without metrics|no metrics|missing metrics/.test(q)) {
      const now = new Date();
      const noMetrics = allActivities.filter((a) => {
        const isPast = new Date(a.endDate) < now;
        return isPast && parseNum(a.actualSaos) === 0 && parseNum(a.pipelineGenerated) === 0;
      });
      if (noMetrics.length === 0) {
        return NextResponse.json({ answer: 'All completed activities have metrics filled in.' } satisfies CopilotResponse);
      }
      return NextResponse.json({
        answer: `${noMetrics.length} completed activit${noMetrics.length === 1 ? 'y is' : 'ies are'} missing metrics (SAOs and pipeline):\n${noMetrics.slice(0, 10).map((a) => `- "${a.title}" (ended ${a.endDate})`).join('\n')}${noMetrics.length > 10 ? `\n...and ${noMetrics.length - 10} more` : ''}`,
        data: noMetrics.map((a) => ({ title: a.title, endDate: a.endDate, actualSaos: a.actualSaos, pipelineGenerated: a.pipelineGenerated })),
      } satisfies CopilotResponse);
    }

    // --- "total budget" ---
    if (/total budget/.test(q)) {
      const totalBudget = allCampaigns.reduce((s, c) => s + parseNum(c.budget), 0);
      const totalSpend = allActivities.reduce((s, a) => s + parseNum(a.actualCost), 0);
      return NextResponse.json({
        answer: `Total budget across ${allCampaigns.length} campaign${allCampaigns.length === 1 ? '' : 's'}: ${formatCurrency(totalBudget)}. Total spend so far: ${formatCurrency(totalSpend)} (${totalBudget > 0 ? Math.round((totalSpend / totalBudget) * 100) : 0}% utilized).`,
        data: allCampaigns.map((c) => ({ name: c.name, budget: c.budget })),
      } satisfies CopilotResponse);
    }

    // --- "compare events [year] vs [year]" ---
    const eventCompareMatch = q.match(/compare\s+events?\s+(\d{4})\s+(?:vs\.?|versus|and|to|with)\s+(\d{4})/i)
      || q.match(/(\d{4})\s+(?:vs\.?|versus|and|to)\s+(\d{4})\s+(?:events?|comparison)/i)
      || q.match(/year.over.year|yoy|year\s+on\s+year/i);
    if (eventCompareMatch) {
      let priorYear: number;
      let currentYear: number;
      if (eventCompareMatch[1] && eventCompareMatch[2]) {
        priorYear = parseInt(eventCompareMatch[1]);
        currentYear = parseInt(eventCompareMatch[2]);
      } else {
        currentYear = new Date().getFullYear();
        priorYear = currentYear - 1;
      }

      function normalizeTitle(title: string): string {
        return title
          .toLowerCase()
          .replace(/\b(20\d{2}|'\d{2})\b/g, '')
          .replace(/\b(fy\d{2,4})\b/gi, '')
          .replace(/\b(h[12]|q[1-4])\b/gi, '')
          .replace(/[^a-z0-9\s]/g, '')
          .replace(/\s+/g, ' ')
          .trim();
      }

      const priorActivities = allActivities.filter(a => new Date(a.startDate).getFullYear() === priorYear);
      const currentActivities = allActivities.filter(a => new Date(a.startDate).getFullYear() === currentYear);

      const priorTotalCost = priorActivities.reduce((s, a) => s + Math.max(parseNum(a.actualCost), parseNum(a.cost)), 0);
      const currentTotalCost = currentActivities.reduce((s, a) => s + Math.max(parseNum(a.actualCost), parseNum(a.cost)), 0);
      const priorSaos = priorActivities.reduce((s, a) => s + parseNum(a.actualSaos), 0);
      const currentSaos = currentActivities.reduce((s, a) => s + parseNum(a.actualSaos), 0);
      const priorPipeline = priorActivities.reduce((s, a) => s + parseNum(a.pipelineGenerated), 0);
      const currentPipeline = currentActivities.reduce((s, a) => s + parseNum(a.pipelineGenerated), 0);
      const priorRoi = priorTotalCost > 0 ? priorPipeline / priorTotalCost : 0;
      const currentRoi = currentTotalCost > 0 ? currentPipeline / currentTotalCost : 0;

      const costChangePct = priorTotalCost > 0 ? ((currentTotalCost - priorTotalCost) / priorTotalCost * 100).toFixed(1) : 'N/A';

      // Match events by normalized title
      const priorMap = new Map(priorActivities.map(a => [normalizeTitle(a.title), a]));
      const matchedCount = currentActivities.filter(a => priorMap.has(normalizeTitle(a.title))).length;
      const newCount = currentActivities.length - matchedCount;
      const retiredCount = priorActivities.filter(a => {
        const key = normalizeTitle(a.title);
        return !currentActivities.some(ca => normalizeTitle(ca.title) === key);
      }).length;

      return NextResponse.json({
        answer: `Event Comparison: ${priorYear} vs ${currentYear}\n\n` +
          `Events: ${priorActivities.length} (${priorYear}) vs ${currentActivities.length} (${currentYear}) \u2014 ${matchedCount} matched, ${newCount} new, ${retiredCount} retired\n` +
          `Total Cost: ${formatCurrency(priorTotalCost)} \u2192 ${formatCurrency(currentTotalCost)} (${costChangePct}% change)\n` +
          `SAOs: ${priorSaos} \u2192 ${currentSaos}\n` +
          `Pipeline: ${formatCurrency(priorPipeline)} \u2192 ${formatCurrency(currentPipeline)}\n` +
          `ROI: ${priorRoi.toFixed(1)}x \u2192 ${currentRoi.toFixed(1)}x\n\n` +
          `For detailed event-by-event comparison, go to Dashboard \u2192 YoY Event Comparison tab.`,
        data: [{
          priorYear, currentYear,
          priorEvents: priorActivities.length, currentEvents: currentActivities.length,
          matched: matchedCount, new: newCount, retired: retiredCount,
          priorCost: priorTotalCost, currentCost: currentTotalCost,
          priorSaos, currentSaos, priorPipeline, currentPipeline,
          priorRoi: parseFloat(priorRoi.toFixed(2)), currentRoi: parseFloat(currentRoi.toFixed(2)),
        }],
      } satisfies CopilotResponse);
    }

    // --- "compare [region] vs [region]" ---
    const compareMatch = q.match(/compare\s+(us|emea|row)\s+(?:vs\.?|versus|and|to)\s+(us|emea|row)/i);
    if (compareMatch) {
      const r1 = compareMatch[1].toUpperCase();
      const r2 = compareMatch[2].toUpperCase();

      const buildRegionStats = (region: string) => {
        const regionActs = allActivities.filter((a) => (a.region ?? '').toUpperCase() === region);
        const spend = regionActs.reduce((s, a) => s + parseNum(a.actualCost), 0);
        const pipeline = regionActs.reduce((s, a) => s + parseNum(a.pipelineGenerated), 0);
        const saos = regionActs.reduce((s, a) => s + parseNum(a.actualSaos), 0);
        return { region, count: regionActs.length, spend, pipeline, saos, roi: spend > 0 ? pipeline / spend : 0 };
      };

      const s1 = buildRegionStats(r1);
      const s2 = buildRegionStats(r2);

      return NextResponse.json({
        answer: `${r1} vs ${r2}:\n\n${r1}: ${s1.count} activities, ${formatCurrency(s1.spend)} spend, ${formatCurrency(s1.pipeline)} pipeline, ${s1.saos} SAOs, ${s1.roi.toFixed(1)}x ROI\n${r2}: ${s2.count} activities, ${formatCurrency(s2.spend)} spend, ${formatCurrency(s2.pipeline)} pipeline, ${s2.saos} SAOs, ${s2.roi.toFixed(1)}x ROI`,
        data: [s1, s2],
      } satisfies CopilotResponse);
    }

    // --- "top performing" ---
    if (/top.*(perform|campaign|roi)/.test(q)) {
      const campaignStats = allCampaigns.map((c) => {
        const campActivities = allActivities.filter((a) => a.campaignId === c.id);
        const spend = campActivities.reduce((s, a) => s + parseNum(a.actualCost), 0);
        const pipeline = campActivities.reduce((s, a) => s + parseNum(a.pipelineGenerated), 0);
        return { name: c.name, spend, pipeline, roi: spend > 0 ? pipeline / spend : 0, activityCount: campActivities.length };
      }).filter((c) => c.spend > 0).sort((a, b) => b.roi - a.roi);

      if (campaignStats.length === 0) {
        return NextResponse.json({ answer: 'No campaigns have recorded spend yet to calculate performance.' } satisfies CopilotResponse);
      }

      const top = campaignStats.slice(0, 5);
      const lines = top.map((c, i) => `${i + 1}. "${c.name}" - ${c.roi.toFixed(1)}x ROI (${formatCurrency(c.pipeline)} pipeline from ${formatCurrency(c.spend)} spend)`);
      return NextResponse.json({
        answer: `Top performing campaigns by ROI:\n${lines.join('\n')}`,
        data: top,
      } satisfies CopilotResponse);
    }

    // --- "upcoming activities" ---
    if (/upcoming|next|soon|coming up/.test(q)) {
      const now = new Date();
      const thirtyDays = new Date(now);
      thirtyDays.setDate(thirtyDays.getDate() + 30);

      const upcoming = allActivities
        .filter((a) => {
          const start = new Date(a.startDate);
          return start >= now && start <= thirtyDays;
        })
        .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());

      if (upcoming.length === 0) {
        return NextResponse.json({ answer: 'No activities starting in the next 30 days.' } satisfies CopilotResponse);
      }

      const lines = upcoming.slice(0, 10).map((a) => {
        const campaign = a.campaignId ? campaignMap.get(a.campaignId) : null;
        return `- "${a.title}" starts ${a.startDate}${campaign ? ` (${campaign.name})` : ''} - ${formatCurrency(parseNum(a.cost))}`;
      });

      return NextResponse.json({
        answer: `${upcoming.length} activit${upcoming.length === 1 ? 'y' : 'ies'} starting in the next 30 days:\n${lines.join('\n')}${upcoming.length > 10 ? `\n...and ${upcoming.length - 10} more` : ''}`,
        data: upcoming.map((a) => ({ title: a.title, startDate: a.startDate, endDate: a.endDate, cost: a.cost, status: a.status })),
      } satisfies CopilotResponse);
    }

    // --- Unrecognized question ---
    return NextResponse.json({ answer: HELP_TEXT } satisfies CopilotResponse);
  } catch (error) {
    logger.error('Error in copilot', error);
    return NextResponse.json({ error: 'Failed to process question' }, { status: 500 });
  }
}
