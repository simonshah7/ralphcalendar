import { NextResponse } from 'next/server';
import { db } from '@/db';
import { campaignReportData } from '@/db/schema';
import { eq } from 'drizzle-orm';

type ReportSource =
  | 'marketo_theme'
  | 'marketo_channel'
  | 'hero_asset'
  | 'linkedin_ads'
  | 'icp_penetration'
  | 'outreach_sequence'
  | 'sfdc_event_leads';

interface Insight {
  type: 'learning' | 'improvement' | 'suggestion' | 'warning' | 'success';
  title: string;
  description: string;
  source: ReportSource | 'cross_channel';
  metric: string;
  priority: 'high' | 'medium' | 'low';
}

interface ReportRow {
  source: ReportSource;
  category: string;
  label: string;
  metrics: Record<string, number>;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function safeDiv(a: number, b: number): number {
  return b === 0 ? 0 : a / b;
}

function pct(a: number, b: number): string {
  return `${(safeDiv(a, b) * 100).toFixed(1)}%`;
}

function fmt(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString('en-US', { maximumFractionDigits: 1 });
}

function fmtCurrency(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toFixed(0)}`;
}

function sumMetric(rows: ReportRow[], key: string): number {
  return rows.reduce((s, r) => s + (r.metrics[key] ?? 0), 0);
}

// Aggregate per-label totals for a given metric set
function labelAggregates(rows: ReportRow[], metricKeys: string[]): Map<string, Record<string, number>> {
  const map = new Map<string, Record<string, number>>();
  for (const row of rows) {
    const agg = map.get(row.label) ?? Object.fromEntries(metricKeys.map((k) => [k, 0]));
    for (const k of metricKeys) {
      agg[k] = (agg[k] ?? 0) + (row.metrics[k] ?? 0);
    }
    map.set(row.label, agg);
  }
  return map;
}

// ---------------------------------------------------------------------------
// Insight generators
// ---------------------------------------------------------------------------

function analyzeMarketoThemes(rows: ReportRow[], insights: Insight[]) {
  if (rows.length === 0) return;

  const keys = ['impressions', 'clicks', 'mqls', 'saos', 'pipeline', 'spend'];
  const byLabel = labelAggregates(rows, keys);
  if (byLabel.size === 0) return;

  // 1 - Best ROI theme
  const withSpend = [...byLabel.entries()].filter(([, m]) => m.spend > 0);
  if (withSpend.length > 0) {
    const sorted = withSpend.sort((a, b) => safeDiv(b[1].pipeline, b[1].spend) - safeDiv(a[1].pipeline, a[1].spend));
    const [bestLabel, bestM] = sorted[0];
    const roi = safeDiv(bestM.pipeline, bestM.spend);
    if (roi > 0) {
      insights.push({
        type: 'success',
        title: `Theme "${bestLabel}" delivers the best pipeline ROI`,
        description: `"${bestLabel}" generated ${fmtCurrency(bestM.pipeline)} in pipeline from ${fmtCurrency(bestM.spend)} spend, a ${roi.toFixed(1)}x return. Consider increasing investment here.`,
        source: 'marketo_theme',
        metric: `${roi.toFixed(1)}x ROI`,
        priority: 'high',
      });
    }

    // 2 - Worst ROI theme
    if (sorted.length >= 2) {
      const [worstLabel, worstM] = sorted[sorted.length - 1];
      const worstRoi = safeDiv(worstM.pipeline, worstM.spend);
      if (roi > worstRoi * 2) {
        insights.push({
          type: 'warning',
          title: `Theme "${worstLabel}" has the lowest pipeline ROI`,
          description: `"${worstLabel}" returned only ${worstRoi.toFixed(1)}x on ${fmtCurrency(worstM.spend)} spend compared to the best theme at ${roi.toFixed(1)}x. Review content strategy or reallocate budget.`,
          source: 'marketo_theme',
          metric: `${worstRoi.toFixed(1)}x ROI`,
          priority: 'high',
        });
      }
    }
  }

  // 3 - Click-to-MQL funnel bottleneck
  const totalClicks = sumMetric(rows, 'clicks');
  const totalMqls = sumMetric(rows, 'mqls');
  const clickToMql = safeDiv(totalMqls, totalClicks);
  if (totalClicks > 0 && clickToMql < 0.02) {
    insights.push({
      type: 'improvement',
      title: 'Low click-to-MQL conversion across themes',
      description: `Only ${pct(totalMqls, totalClicks)} of clicks convert to MQLs across all themes. Review landing page experiences and lead scoring criteria.`,
      source: 'marketo_theme',
      metric: pct(totalMqls, totalClicks),
      priority: 'high',
    });
  }
}

function analyzeMarketoChannels(rows: ReportRow[], insights: Insight[]) {
  if (rows.length === 0) return;

  const keys = ['published', 'views', 'engagements', 'mqls', 'saos', 'spend'];
  const byLabel = labelAggregates(rows, keys);

  // 4 - Highest engagement-to-MQL channel
  const withEngagement = [...byLabel.entries()].filter(([, m]) => m.engagements > 0);
  if (withEngagement.length > 0) {
    const sorted = withEngagement.sort(
      (a, b) => safeDiv(b[1].mqls, b[1].engagements) - safeDiv(a[1].mqls, a[1].engagements)
    );
    const [bestLabel, bestM] = sorted[0];
    const rate = safeDiv(bestM.mqls, bestM.engagements);
    if (rate > 0) {
      insights.push({
        type: 'learning',
        title: `"${bestLabel}" converts engagements to MQLs most efficiently`,
        description: `${pct(bestM.mqls, bestM.engagements)} of engagements from "${bestLabel}" convert to MQLs (${fmt(bestM.mqls)} MQLs from ${fmt(bestM.engagements)} engagements). This channel deserves more content investment.`,
        source: 'marketo_channel',
        metric: pct(bestM.mqls, bestM.engagements),
        priority: 'medium',
      });
    }
  }

  // 5 - Low-engagement channel warning
  const withViews = [...byLabel.entries()].filter(([, m]) => m.views > 100);
  for (const [label, m] of withViews) {
    const engRate = safeDiv(m.engagements, m.views);
    if (engRate < 0.01) {
      insights.push({
        type: 'warning',
        title: `"${label}" has very low engagement rate`,
        description: `Only ${pct(m.engagements, m.views)} of views in "${label}" result in engagements (${fmt(m.engagements)} engagements from ${fmt(m.views)} views). Consider refreshing content or adjusting targeting.`,
        source: 'marketo_channel',
        metric: pct(m.engagements, m.views),
        priority: 'medium',
      });
    }
  }

  // 6 - Cost per SAO comparison
  const withSaos = [...byLabel.entries()].filter(([, m]) => m.saos > 0 && m.spend > 0);
  if (withSaos.length >= 2) {
    const sorted = withSaos.sort((a, b) => safeDiv(a[1].spend, a[1].saos) - safeDiv(b[1].spend, b[1].saos));
    const [cheapLabel, cheapM] = sorted[0];
    const [expLabel, expM] = sorted[sorted.length - 1];
    const cheapCps = safeDiv(cheapM.spend, cheapM.saos);
    const expCps = safeDiv(expM.spend, expM.saos);
    if (expCps > cheapCps * 2) {
      insights.push({
        type: 'suggestion',
        title: `Shift budget from "${expLabel}" to "${cheapLabel}" for SAO efficiency`,
        description: `"${cheapLabel}" costs ${fmtCurrency(cheapCps)}/SAO vs ${fmtCurrency(expCps)}/SAO for "${expLabel}" — a ${(expCps / cheapCps).toFixed(1)}x difference. Reallocating could significantly improve cost efficiency.`,
        source: 'marketo_channel',
        metric: `${fmtCurrency(cheapCps)} vs ${fmtCurrency(expCps)} per SAO`,
        priority: 'high',
      });
    }
  }
}

function analyzeHeroAssets(rows: ReportRow[], insights: Insight[]) {
  if (rows.length === 0) return;

  const keys = ['pageViews', 'downloads', 'completions', 'mqls', 'saos', 'pipeline'];
  const byLabel = labelAggregates(rows, keys);

  // 7 - Best performing asset by pipeline
  const withPipeline = [...byLabel.entries()].filter(([, m]) => m.pipeline > 0);
  if (withPipeline.length > 0) {
    const sorted = withPipeline.sort((a, b) => b[1].pipeline - a[1].pipeline);
    const [bestLabel, bestM] = sorted[0];
    insights.push({
      type: 'success',
      title: `"${bestLabel}" is the top pipeline-generating asset`,
      description: `This asset generated ${fmtCurrency(bestM.pipeline)} in pipeline with ${fmt(bestM.mqls)} MQLs and ${fmt(bestM.saos)} SAOs from ${fmt(bestM.pageViews)} page views.`,
      source: 'hero_asset',
      metric: fmtCurrency(bestM.pipeline),
      priority: 'high',
    });
  }

  // 8 - Download-to-completion dropoff
  for (const [label, m] of byLabel.entries()) {
    if (m.downloads > 10) {
      const completionRate = safeDiv(m.completions, m.downloads);
      if (completionRate < 0.3) {
        insights.push({
          type: 'improvement',
          title: `"${label}" has high download-to-completion dropoff`,
          description: `Only ${pct(m.completions, m.downloads)} of downloads complete for "${label}" (${fmt(m.completions)} of ${fmt(m.downloads)}). The content may be too long, difficult, or misaligned with expectations.`,
          source: 'hero_asset',
          metric: pct(m.completions, m.downloads),
          priority: 'medium',
        });
      }
    }
  }

  // 9 - View-to-download conversion
  const totalViews = sumMetric(rows, 'pageViews');
  const totalDownloads = sumMetric(rows, 'downloads');
  if (totalViews > 0 && safeDiv(totalDownloads, totalViews) < 0.05) {
    insights.push({
      type: 'improvement',
      title: 'Low overall view-to-download rate on hero assets',
      description: `Only ${pct(totalDownloads, totalViews)} of page views convert to downloads. Improve CTAs, gating strategy, or page layout to increase download rates.`,
      source: 'hero_asset',
      metric: pct(totalDownloads, totalViews),
      priority: 'medium',
    });
  }
}

function analyzeLinkedInAds(rows: ReportRow[], insights: Insight[]) {
  if (rows.length === 0) return;

  const keys = ['impressions', 'clicks', 'spend', 'leads', 'mqls', 'saos'];
  const byLabel = labelAggregates(rows, keys);

  // 10 - Best CTR campaign
  const withImpressions = [...byLabel.entries()].filter(([, m]) => m.impressions > 100);
  if (withImpressions.length > 0) {
    const sorted = withImpressions.sort(
      (a, b) => safeDiv(b[1].clicks, b[1].impressions) - safeDiv(a[1].clicks, a[1].impressions)
    );
    const [bestLabel, bestM] = sorted[0];
    const ctr = safeDiv(bestM.clicks, bestM.impressions);
    if (ctr > 0.005) {
      insights.push({
        type: 'learning',
        title: `LinkedIn ad "${bestLabel}" has the highest CTR`,
        description: `"${bestLabel}" achieves a ${pct(bestM.clicks, bestM.impressions)} CTR (${fmt(bestM.clicks)} clicks from ${fmt(bestM.impressions)} impressions). Study its creative and messaging for replication.`,
        source: 'linkedin_ads',
        metric: pct(bestM.clicks, bestM.impressions),
        priority: 'medium',
      });
    }
  }

  // 11 - Cost per lead comparison
  const withLeads = [...byLabel.entries()].filter(([, m]) => m.leads > 0 && m.spend > 0);
  if (withLeads.length >= 2) {
    const sorted = withLeads.sort((a, b) => safeDiv(a[1].spend, a[1].leads) - safeDiv(b[1].spend, b[1].leads));
    const [cheapLabel, cheapM] = sorted[0];
    const [expLabel, expM] = sorted[sorted.length - 1];
    const cheapCpl = safeDiv(cheapM.spend, cheapM.leads);
    const expCpl = safeDiv(expM.spend, expM.leads);
    if (expCpl > cheapCpl * 1.5) {
      insights.push({
        type: 'suggestion',
        title: `Optimize LinkedIn spend — "${cheapLabel}" is the most cost-efficient`,
        description: `"${cheapLabel}" costs ${fmtCurrency(cheapCpl)}/lead while "${expLabel}" costs ${fmtCurrency(expCpl)}/lead. Shifting budget could reduce overall CPL.`,
        source: 'linkedin_ads',
        metric: `${fmtCurrency(cheapCpl)} vs ${fmtCurrency(expCpl)} CPL`,
        priority: 'high',
      });
    }
  }

  // 12 - Lead-to-MQL quality
  const totalLeads = sumMetric(rows, 'leads');
  const totalMqls = sumMetric(rows, 'mqls');
  if (totalLeads > 0) {
    const convRate = safeDiv(totalMqls, totalLeads);
    if (convRate < 0.1) {
      insights.push({
        type: 'warning',
        title: 'Low LinkedIn lead-to-MQL conversion',
        description: `Only ${pct(totalMqls, totalLeads)} of LinkedIn leads convert to MQLs. Review audience targeting and lead quality criteria.`,
        source: 'linkedin_ads',
        metric: pct(totalMqls, totalLeads),
        priority: 'high',
      });
    } else if (convRate > 0.3) {
      insights.push({
        type: 'success',
        title: 'Strong LinkedIn lead-to-MQL conversion',
        description: `${pct(totalMqls, totalLeads)} of LinkedIn leads convert to MQLs, indicating strong audience targeting and content relevance.`,
        source: 'linkedin_ads',
        metric: pct(totalMqls, totalLeads),
        priority: 'low',
      });
    }
  }
}

function analyzeIcpPenetration(rows: ReportRow[], insights: Insight[]) {
  if (rows.length === 0) return;

  // Summary rows have category 'summary'
  const summaryRows = rows.filter((r) => r.category === 'summary');
  const accountRows = rows.filter((r) => r.category !== 'summary');

  // 13 - Overall ICP penetration rate
  for (const row of summaryRows) {
    const { targetAccounts = 0, engaged = 0, withMqls = 0, withSaos = 0, totalPipeline = 0 } = row.metrics;
    if (targetAccounts > 0) {
      const engRate = safeDiv(engaged, targetAccounts);
      insights.push({
        type: engRate > 0.3 ? 'success' : engRate > 0.15 ? 'learning' : 'warning',
        title: `ICP penetration rate: ${pct(engaged, targetAccounts)}`,
        description: `${fmt(engaged)} of ${fmt(targetAccounts)} target accounts are engaged. ${fmt(withMqls)} have MQLs, ${fmt(withSaos)} have SAOs, generating ${fmtCurrency(totalPipeline)} total pipeline.`,
        source: 'icp_penetration',
        metric: pct(engaged, targetAccounts),
        priority: engRate < 0.15 ? 'high' : 'medium',
      });

      // 14 - MQL-to-SAO conversion at account level
      if (withMqls > 0) {
        const mqlToSao = safeDiv(withSaos, withMqls);
        if (mqlToSao < 0.15) {
          insights.push({
            type: 'improvement',
            title: 'Low MQL-to-SAO conversion among target accounts',
            description: `Only ${pct(withSaos, withMqls)} of target accounts with MQLs convert to SAOs. Align sales follow-up and scoring models to improve progression.`,
            source: 'icp_penetration',
            metric: pct(withSaos, withMqls),
            priority: 'high',
          });
        }
      }
    }
  }

  // 15 - Top engaged accounts
  if (accountRows.length > 0) {
    const sorted = accountRows
      .filter((r) => (r.metrics.pipeline ?? 0) > 0)
      .sort((a, b) => (b.metrics.pipeline ?? 0) - (a.metrics.pipeline ?? 0));
    if (sorted.length > 0) {
      const top = sorted[0];
      insights.push({
        type: 'success',
        title: `Top ICP account: "${top.label}"`,
        description: `"${top.label}" leads with ${fmtCurrency(top.metrics.pipeline ?? 0)} pipeline, ${fmt(top.metrics.touches ?? 0)} touches, and ${fmt(top.metrics.saos ?? 0)} SAOs. Use this account as a model for ABM playbooks.`,
        source: 'icp_penetration',
        metric: fmtCurrency(top.metrics.pipeline ?? 0),
        priority: 'medium',
      });
    }
  }
}

function analyzeOutreachSequences(rows: ReportRow[], insights: Insight[]) {
  if (rows.length === 0) return;

  const keys = ['sent', 'opened', 'replied', 'meetings', 'saos'];
  const byLabel = labelAggregates(rows, keys);

  // 16 - Best reply rate sequence
  const withSent = [...byLabel.entries()].filter(([, m]) => m.sent > 10);
  if (withSent.length > 0) {
    const sorted = withSent.sort(
      (a, b) => safeDiv(b[1].replied, b[1].sent) - safeDiv(a[1].replied, a[1].sent)
    );
    const [bestLabel, bestM] = sorted[0];
    const replyRate = safeDiv(bestM.replied, bestM.sent);
    insights.push({
      type: 'learning',
      title: `Outreach sequence "${bestLabel}" has the best reply rate`,
      description: `${pct(bestM.replied, bestM.sent)} reply rate (${fmt(bestM.replied)} replies from ${fmt(bestM.sent)} sent). Analyze subject lines and messaging for broader adoption.`,
      source: 'outreach_sequence',
      metric: pct(bestM.replied, bestM.sent),
      priority: 'medium',
    });

    // Worst performing sequence
    if (sorted.length >= 2) {
      const [worstLabel, worstM] = sorted[sorted.length - 1];
      const worstRate = safeDiv(worstM.replied, worstM.sent);
      if (replyRate > worstRate * 2) {
        insights.push({
          type: 'warning',
          title: `Outreach sequence "${worstLabel}" underperforms significantly`,
          description: `"${worstLabel}" achieves only ${pct(worstM.replied, worstM.sent)} reply rate vs ${pct(bestM.replied, bestM.sent)} for the best sequence. Revisit messaging, timing, or audience selection.`,
          source: 'outreach_sequence',
          metric: pct(worstM.replied, worstM.sent),
          priority: 'high',
        });
      }
    }
  }

  // 17 - Meeting-to-SAO conversion
  const totalMeetings = sumMetric(rows, 'meetings');
  const totalSaos = sumMetric(rows, 'saos');
  if (totalMeetings > 0) {
    const convRate = safeDiv(totalSaos, totalMeetings);
    if (convRate < 0.2) {
      insights.push({
        type: 'improvement',
        title: 'Low meeting-to-SAO conversion from outreach',
        description: `Only ${pct(totalSaos, totalMeetings)} of outreach meetings convert to SAOs. Improve meeting qualification criteria or post-meeting follow-up processes.`,
        source: 'outreach_sequence',
        metric: pct(totalSaos, totalMeetings),
        priority: 'high',
      });
    }
  }

  // 18 - Open-to-reply dropoff
  const totalOpened = sumMetric(rows, 'opened');
  const totalReplied = sumMetric(rows, 'replied');
  if (totalOpened > 0 && safeDiv(totalReplied, totalOpened) < 0.05) {
    insights.push({
      type: 'improvement',
      title: 'High open-to-reply dropoff in outreach sequences',
      description: `Emails are getting opened (${fmt(totalOpened)} opens) but only ${pct(totalReplied, totalOpened)} result in replies. Improve email body copy, CTAs, and personalization.`,
      source: 'outreach_sequence',
      metric: pct(totalReplied, totalOpened),
      priority: 'medium',
    });
  }
}

function analyzeSfdcEventLeads(rows: ReportRow[], insights: Insight[]) {
  if (rows.length === 0) return;

  const keys = ['registered', 'attended', 'mql', 'sao', 'opportunity', 'closedWon', 'revenue'];
  const byLabel = labelAggregates(rows, keys);

  // 19 - Best event by revenue
  const withRevenue = [...byLabel.entries()].filter(([, m]) => m.revenue > 0);
  if (withRevenue.length > 0) {
    const sorted = withRevenue.sort((a, b) => b[1].revenue - a[1].revenue);
    const [bestLabel, bestM] = sorted[0];
    insights.push({
      type: 'success',
      title: `"${bestLabel}" is the top revenue-generating event`,
      description: `"${bestLabel}" generated ${fmtCurrency(bestM.revenue)} in closed-won revenue with ${fmt(bestM.closedWon)} deals from ${fmt(bestM.attended)} attendees.`,
      source: 'sfdc_event_leads',
      metric: fmtCurrency(bestM.revenue),
      priority: 'high',
    });
  }

  // 20 - Attendance dropoff
  for (const [label, m] of byLabel.entries()) {
    if (m.registered > 10) {
      const attendRate = safeDiv(m.attended, m.registered);
      if (attendRate < 0.4) {
        insights.push({
          type: 'warning',
          title: `"${label}" has low attendance rate`,
          description: `Only ${pct(m.attended, m.registered)} of registrants attended "${label}" (${fmt(m.attended)} of ${fmt(m.registered)}). Improve pre-event communications, reminders, and incentives.`,
          source: 'sfdc_event_leads',
          metric: pct(m.attended, m.registered),
          priority: 'medium',
        });
      }
    }
  }

  // 21 - Attendee-to-opportunity conversion
  const totalAttended = sumMetric(rows, 'attended');
  const totalOpp = sumMetric(rows, 'opportunity');
  if (totalAttended > 0) {
    const convRate = safeDiv(totalOpp, totalAttended);
    if (convRate > 0.15) {
      insights.push({
        type: 'success',
        title: 'Strong event attendee-to-opportunity conversion',
        description: `${pct(totalOpp, totalAttended)} of event attendees progress to opportunities. Events are proving to be a strong pipeline driver.`,
        source: 'sfdc_event_leads',
        metric: pct(totalOpp, totalAttended),
        priority: 'medium',
      });
    } else if (convRate < 0.05) {
      insights.push({
        type: 'improvement',
        title: 'Low event attendee-to-opportunity conversion',
        description: `Only ${pct(totalOpp, totalAttended)} of event attendees become opportunities. Review post-event follow-up cadence and sales handoff process.`,
        source: 'sfdc_event_leads',
        metric: pct(totalOpp, totalAttended),
        priority: 'high',
      });
    }
  }

  // 22 - Event win rate
  const totalSao = sumMetric(rows, 'sao');
  const totalClosedWon = sumMetric(rows, 'closedWon');
  if (totalSao > 0) {
    const winRate = safeDiv(totalClosedWon, totalSao);
    insights.push({
      type: winRate > 0.25 ? 'success' : 'learning',
      title: `Event lead win rate: ${pct(totalClosedWon, totalSao)}`,
      description: `${fmt(totalClosedWon)} of ${fmt(totalSao)} SAOs from events closed won. ${winRate > 0.25 ? 'Events generate high-quality pipeline.' : 'Consider improving event targeting to attract higher-intent prospects.'}`,
      source: 'sfdc_event_leads',
      metric: pct(totalClosedWon, totalSao),
      priority: winRate < 0.15 ? 'high' : 'medium',
    });
  }
}

function analyzeCrossChannel(bySource: Map<ReportSource, ReportRow[]>, insights: Insight[]) {
  // 23 - Compare SAO efficiency across channels
  const channelSaoEfficiency: { source: ReportSource; costPerSao: number; saos: number; spend: number }[] = [];

  const sourceSpendMetric: Partial<Record<ReportSource, { spendKey: string; saoKey: string }>> = {
    marketo_theme: { spendKey: 'spend', saoKey: 'saos' },
    marketo_channel: { spendKey: 'spend', saoKey: 'saos' },
    linkedin_ads: { spendKey: 'spend', saoKey: 'saos' },
  };

  for (const [source, config] of Object.entries(sourceSpendMetric) as [ReportSource, { spendKey: string; saoKey: string }][]) {
    const rows = bySource.get(source) ?? [];
    const totalSpend = sumMetric(rows, config.spendKey);
    const totalSaos = sumMetric(rows, config.saoKey);
    if (totalSpend > 0 && totalSaos > 0) {
      channelSaoEfficiency.push({
        source,
        costPerSao: safeDiv(totalSpend, totalSaos),
        saos: totalSaos,
        spend: totalSpend,
      });
    }
  }

  if (channelSaoEfficiency.length >= 2) {
    const sorted = channelSaoEfficiency.sort((a, b) => a.costPerSao - b.costPerSao);
    const best = sorted[0];
    const worst = sorted[sorted.length - 1];
    const sourceNames: Record<string, string> = {
      marketo_theme: 'Marketo Themes',
      marketo_channel: 'Marketo Channels',
      linkedin_ads: 'LinkedIn Ads',
    };
    insights.push({
      type: 'learning',
      title: `${sourceNames[best.source]} delivers the most cost-efficient SAOs`,
      description: `${sourceNames[best.source]} costs ${fmtCurrency(best.costPerSao)}/SAO vs ${fmtCurrency(worst.costPerSao)}/SAO for ${sourceNames[worst.source]}. Consider this when planning channel mix and budget allocation.`,
      source: 'cross_channel',
      metric: `${fmtCurrency(best.costPerSao)} vs ${fmtCurrency(worst.costPerSao)} per SAO`,
      priority: 'high',
    });
  }

  // 24 - Total SAO contribution by source
  const saoBySource: { source: ReportSource; saos: number; label: string }[] = [];
  const saoKeys: Partial<Record<ReportSource, string>> = {
    marketo_theme: 'saos',
    marketo_channel: 'saos',
    linkedin_ads: 'saos',
    outreach_sequence: 'saos',
    sfdc_event_leads: 'sao',
  };
  const sourceLabels: Partial<Record<ReportSource, string>> = {
    marketo_theme: 'Marketo Themes',
    marketo_channel: 'Marketo Channels',
    linkedin_ads: 'LinkedIn Ads',
    outreach_sequence: 'Outreach Sequences',
    sfdc_event_leads: 'SFDC Events',
  };

  for (const [source, key] of Object.entries(saoKeys) as [ReportSource, string][]) {
    const rows = bySource.get(source) ?? [];
    const total = sumMetric(rows, key);
    if (total > 0) {
      saoBySource.push({ source, saos: total, label: sourceLabels[source] ?? source });
    }
  }

  if (saoBySource.length >= 2) {
    const totalSaos = saoBySource.reduce((s, x) => s + x.saos, 0);
    const sorted = saoBySource.sort((a, b) => b.saos - a.saos);
    const top = sorted[0];
    const topPct = safeDiv(top.saos, totalSaos);
    if (topPct > 0.5) {
      insights.push({
        type: 'warning',
        title: `SAO generation is concentrated in ${top.label}`,
        description: `${top.label} contributes ${pct(top.saos, totalSaos)} of all SAOs (${fmt(top.saos)} of ${fmt(totalSaos)}). Diversify pipeline sources to reduce dependency on a single channel.`,
        source: 'cross_channel',
        metric: pct(top.saos, totalSaos),
        priority: 'medium',
      });
    }

    // Suggestion for underweight channel
    const bottom = sorted[sorted.length - 1];
    if (bottom.saos > 0 && safeDiv(bottom.saos, totalSaos) < 0.1) {
      insights.push({
        type: 'suggestion',
        title: `Increase investment in ${bottom.label}`,
        description: `${bottom.label} contributes only ${pct(bottom.saos, totalSaos)} of total SAOs. If cost efficiency is favorable, scaling this channel could diversify pipeline generation.`,
        source: 'cross_channel',
        metric: `${fmt(bottom.saos)} SAOs (${pct(bottom.saos, totalSaos)})`,
        priority: 'low',
      });
    }
  }

  // 25 - Overall funnel health across marketo themes
  const themeRows = bySource.get('marketo_theme') ?? [];
  if (themeRows.length > 0) {
    const impressions = sumMetric(themeRows, 'impressions');
    const clicks = sumMetric(themeRows, 'clicks');
    const mqls = sumMetric(themeRows, 'mqls');
    const saos = sumMetric(themeRows, 'saos');
    const pipeline = sumMetric(themeRows, 'pipeline');

    if (impressions > 0 && pipeline > 0) {
      insights.push({
        type: 'learning',
        title: 'Overall marketing funnel summary',
        description: `Full funnel: ${fmt(impressions)} impressions -> ${fmt(clicks)} clicks (${pct(clicks, impressions)}) -> ${fmt(mqls)} MQLs (${pct(mqls, clicks)}) -> ${fmt(saos)} SAOs (${pct(saos, mqls)}) -> ${fmtCurrency(pipeline)} pipeline. Focus on the stage with the steepest dropoff to unlock the most growth.`,
        source: 'cross_channel',
        metric: fmtCurrency(pipeline),
        priority: 'high',
      });
    }
  }
}

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const calendarId = searchParams.get('calendarId');

    if (!calendarId) {
      return NextResponse.json({ error: 'calendarId is required' }, { status: 400 });
    }

    const rows = await db
      .select()
      .from(campaignReportData)
      .where(eq(campaignReportData.calendarId, calendarId));

    if (rows.length === 0) {
      return NextResponse.json([]);
    }

    // Group rows by source
    const bySource = new Map<ReportSource, ReportRow[]>();
    for (const row of rows) {
      const source = row.source as ReportSource;
      const existing = bySource.get(source) ?? [];
      existing.push({
        source,
        category: row.category,
        label: row.label,
        metrics: (row.metrics ?? {}) as Record<string, number>,
      });
      bySource.set(source, existing);
    }

    const insights: Insight[] = [];

    // Run all analyzers
    analyzeMarketoThemes(bySource.get('marketo_theme') ?? [], insights);
    analyzeMarketoChannels(bySource.get('marketo_channel') ?? [], insights);
    analyzeHeroAssets(bySource.get('hero_asset') ?? [], insights);
    analyzeLinkedInAds(bySource.get('linkedin_ads') ?? [], insights);
    analyzeIcpPenetration(bySource.get('icp_penetration') ?? [], insights);
    analyzeOutreachSequences(bySource.get('outreach_sequence') ?? [], insights);
    analyzeSfdcEventLeads(bySource.get('sfdc_event_leads') ?? [], insights);
    analyzeCrossChannel(bySource, insights);

    // Sort by priority: high -> medium -> low
    const priorityOrder: Record<string, number> = { high: 0, medium: 1, low: 2 };
    insights.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

    return NextResponse.json(insights);
  } catch (error) {
    console.error('Error generating campaign insights:', error);
    return NextResponse.json({ error: 'Failed to generate campaign insights' }, { status: 500 });
  }
}
