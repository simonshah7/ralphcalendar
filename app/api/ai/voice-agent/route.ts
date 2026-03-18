import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { VOICE_AGENT_TOOLS } from '@/lib/voice-agent-tools';
import { db, activities, campaigns, swimlanes } from '@/db';
import { eq, InferSelectModel } from 'drizzle-orm';
import { formatCurrency } from '@/lib/utils';

type Activity = InferSelectModel<typeof activities>;
type Campaign = InferSelectModel<typeof campaigns>;
type Swimlane = InferSelectModel<typeof swimlanes>;

interface VoiceAgentAction {
  tool: string;
  params: Record<string, unknown>;
  result?: unknown;
}

interface VoiceAgentResponse {
  speech: string;
  actions: VoiceAgentAction[];
}

function parseNum(val: string | null | undefined): number {
  return parseFloat(val ?? '0') || 0;
}

async function handleAnalyticsQuery(calendarId: string, question: string): Promise<string> {
  const allActivities: Activity[] = await db.select().from(activities).where(eq(activities.calendarId, calendarId));
  const allCampaigns: Campaign[] = await db.select().from(campaigns).where(eq(campaigns.calendarId, calendarId));

  const q = question.toLowerCase().trim();

  if (/how much.*(spent|spend|cost)/.test(q)) {
    const regionMatch = q.match(/\b(us|emea|row)\b/i);
    if (regionMatch) {
      const region = regionMatch[1].toUpperCase();
      const regionActivities = allActivities.filter((a: Activity) => (a.region ?? '').toUpperCase() === region);
      const totalSpend = regionActivities.reduce((s: number, a: Activity) => s + parseNum(a.actualCost), 0);
      return `Total spend in ${region}: ${formatCurrency(totalSpend)} across ${regionActivities.length} activities.`;
    }
    const matchedCampaign = allCampaigns.find((c: Campaign) => q.includes(c.name.toLowerCase()));
    if (matchedCampaign) {
      const campActivities = allActivities.filter((a: Activity) => a.campaignId === matchedCampaign.id);
      const totalSpend = campActivities.reduce((s: number, a: Activity) => s + parseNum(a.actualCost), 0);
      return `Total spend on "${matchedCampaign.name}": ${formatCurrency(totalSpend)} across ${campActivities.length} activities. Budget: ${formatCurrency(parseNum(matchedCampaign.budget))}.`;
    }
    const totalSpend = allActivities.reduce((s: number, a: Activity) => s + parseNum(a.actualCost), 0);
    return `Total spend across all activities: ${formatCurrency(totalSpend)}.`;
  }

  if (/over\s*budget/.test(q)) {
    const overBudget: string[] = [];
    for (const campaign of allCampaigns) {
      const budget = parseNum(campaign.budget);
      if (budget <= 0) continue;
      const campActivities = allActivities.filter((a: Activity) => a.campaignId === campaign.id);
      const totalSpend = campActivities.reduce((s: number, a: Activity) => s + parseNum(a.actualCost), 0);
      if (totalSpend > budget) {
        overBudget.push(`${campaign.name}: spent ${formatCurrency(totalSpend)} of ${formatCurrency(budget)} budget`);
      }
    }
    return overBudget.length === 0
      ? 'No campaigns are currently over budget.'
      : `${overBudget.length} campaign${overBudget.length === 1 ? ' is' : 's are'} over budget: ${overBudget.join('; ')}.`;
  }

  if (/total budget/.test(q)) {
    const totalBudget = allCampaigns.reduce((s: number, c: Campaign) => s + parseNum(c.budget), 0);
    const totalSpend = allActivities.reduce((s: number, a: Activity) => s + parseNum(a.actualCost), 0);
    return `Total budget: ${formatCurrency(totalBudget)}. Spent: ${formatCurrency(totalSpend)} (${totalBudget > 0 ? Math.round((totalSpend / totalBudget) * 100) : 0}% utilized).`;
  }

  if (/\broi\b/.test(q)) {
    const totalSpend = allActivities.reduce((s: number, a: Activity) => s + parseNum(a.actualCost), 0);
    const totalPipeline = allActivities.reduce((s: number, a: Activity) => s + parseNum(a.pipelineGenerated), 0);
    const roi = totalSpend > 0 ? (totalPipeline / totalSpend).toFixed(1) : 'N/A';
    return `Overall ROI: ${roi}x (${formatCurrency(totalPipeline)} pipeline from ${formatCurrency(totalSpend)} spend).`;
  }

  if (/upcoming|next|soon/.test(q)) {
    const now = new Date();
    const thirtyDays = new Date(now);
    thirtyDays.setDate(thirtyDays.getDate() + 30);
    const upcoming = allActivities
      .filter((a: Activity) => new Date(a.startDate) >= now && new Date(a.startDate) <= thirtyDays)
      .sort((a: Activity, b: Activity) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());
    if (upcoming.length === 0) return 'No activities starting in the next 30 days.';
    const top = upcoming.slice(0, 5).map((a: Activity) => `${a.title} (${a.startDate})`).join(', ');
    return `${upcoming.length} upcoming activities. Next ones: ${top}.`;
  }

  if (/top.*(perform|campaign|roi)/.test(q)) {
    const campaignStats = allCampaigns.map((c: Campaign) => {
      const campActivities = allActivities.filter((a: Activity) => a.campaignId === c.id);
      const spend = campActivities.reduce((s: number, a: Activity) => s + parseNum(a.actualCost), 0);
      const pipeline = campActivities.reduce((s: number, a: Activity) => s + parseNum(a.pipelineGenerated), 0);
      return { name: c.name, roi: spend > 0 ? pipeline / spend : 0 };
    }).filter((c: { name: string; roi: number }) => c.roi > 0).sort((a: { roi: number }, b: { roi: number }) => b.roi - a.roi);

    if (campaignStats.length === 0) return 'No campaigns have recorded spend yet.';
    const top = campaignStats.slice(0, 3).map((c: { name: string; roi: number }) => `${c.name} (${c.roi.toFixed(1)}x)`).join(', ');
    return `Top performing campaigns by ROI: ${top}.`;
  }

  return `You have ${allActivities.length} activities across ${allCampaigns.length} campaigns. Try asking about spending, budget, ROI, or upcoming activities.`;
}

async function handleListActivities(
  calendarId: string,
  swimlaneName?: string,
  campaignName?: string
): Promise<string> {
  const allActivities: Activity[] = await db.select().from(activities).where(eq(activities.calendarId, calendarId));
  const allSwimlanes: Swimlane[] = await db.select().from(swimlanes).where(eq(swimlanes.calendarId, calendarId));
  const allCampaigns: Campaign[] = await db.select().from(campaigns).where(eq(campaigns.calendarId, calendarId));

  let filtered = allActivities;

  if (swimlaneName) {
    const sw = allSwimlanes.find((s: Swimlane) => s.name.toLowerCase() === swimlaneName.toLowerCase());
    if (sw) filtered = filtered.filter((a: Activity) => a.swimlaneId === sw.id);
  }

  if (campaignName) {
    const camp = allCampaigns.find((c: Campaign) => c.name.toLowerCase() === campaignName.toLowerCase());
    if (camp) filtered = filtered.filter((a: Activity) => a.campaignId === camp.id);
  }

  if (filtered.length === 0) return 'No activities found matching those criteria.';

  const sorted = filtered.sort((a: Activity, b: Activity) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());
  const top = sorted.slice(0, 8).map((a: Activity) => `${a.title} (${a.startDate} to ${a.endDate})`).join('; ');
  const suffix = filtered.length > 8 ? ` and ${filtered.length - 8} more` : '';
  return `Found ${filtered.length} activities: ${top}${suffix}.`;
}

export async function POST(request: Request) {
  try {
    const { transcript, calendarId, context } = await request.json();

    if (!transcript || !calendarId) {
      return NextResponse.json({ error: 'transcript and calendarId are required' }, { status: 400 });
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'ANTHROPIC_API_KEY is not configured' }, { status: 500 });
    }

    const client = new Anthropic({ apiKey });

    const swimlaneNames = (context?.swimlanes || []).map((s: { name: string }) => s.name).join(', ');
    const statusNames = (context?.statuses || []).map((s: { name: string }) => s.name).join(', ');
    const campaignNames = (context?.campaigns || []).map((c: { name: string }) => c.name).join(', ');
    const activityCount = context?.activityCount || 0;

    const systemPrompt = `You are a voice assistant for LaunchGrid, a marketing campaign planning application. The user speaks commands and you respond concisely (1-2 sentences max) since your response will be spoken aloud.

Today's date is ${new Date().toISOString().split('T')[0]}.

Current calendar context:
- Channels (swimlanes): ${swimlaneNames || 'none yet'}
- Statuses: ${statusNames || 'none yet'}
- Campaigns: ${campaignNames || 'none yet'}
- Total activities: ${activityCount}

When the user asks to create an activity without specifying a channel, use the first available channel.
When dates are relative (e.g. "next Monday"), calculate the actual date from today.
For status, default to "Considering" if not specified.
Be helpful, concise, and action-oriented. Always use tools when the user wants to perform an action.
If the user asks something conversational, just respond naturally without tools.`;

    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system: systemPrompt,
      tools: VOICE_AGENT_TOOLS,
      messages: [{ role: 'user', content: transcript }],
    });

    const actions: VoiceAgentAction[] = [];
    let speechParts: string[] = [];

    // Process tool use blocks
    for (const block of response.content) {
      if (block.type === 'text') {
        speechParts.push(block.text);
      } else if (block.type === 'tool_use') {
        const toolName = block.name;
        const toolInput = block.input as Record<string, unknown>;

        // Handle server-side tools
        if (toolName === 'query_analytics') {
          const result = await handleAnalyticsQuery(calendarId, toolInput.question as string);
          speechParts.push(result);
        } else if (toolName === 'list_activities') {
          const result = await handleListActivities(
            calendarId,
            toolInput.swimlaneName as string | undefined,
            toolInput.campaignName as string | undefined
          );
          speechParts.push(result);
        } else {
          // Client-side actions
          actions.push({ tool: toolName, params: toolInput });
        }
      }
    }

    // If Claude only returned tool_use blocks with no text, generate appropriate speech
    if (speechParts.length === 0 && actions.length > 0) {
      const actionDescriptions = actions.map((a) => {
        switch (a.tool) {
          case 'create_activity':
            return `Created activity "${a.params.title}" from ${a.params.startDate} to ${a.params.endDate}.`;
          case 'update_activity':
            return `Updated activity "${a.params.activityTitle}".`;
          case 'delete_activity':
            return `Deleted activity "${a.params.activityTitle}".`;
          case 'switch_view':
            return `Switched to ${a.params.view} view.`;
          case 'set_filter':
            return `Applied filters.`;
          case 'clear_filters':
            return `Cleared all filters.`;
          case 'open_copilot':
            return `Opened the AI Copilot.`;
          case 'open_brief_generator':
            return `Opened the Brief Generator.`;
          case 'send_slack_message':
            return `Sent Slack message to #${a.params.channel}.`;
          case 'search_email':
            return `Searching email for "${a.params.query}".`;
          case 'create_calendar_event':
            return `Created calendar event "${a.params.title}".`;
          default:
            return `Done.`;
        }
      });
      speechParts = actionDescriptions;
    }

    const result: VoiceAgentResponse = {
      speech: speechParts.join(' '),
      actions,
    };

    return NextResponse.json(result);
  } catch (error) {
    console.error('Voice agent error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: `Voice agent failed: ${message}` }, { status: 500 });
  }
}
