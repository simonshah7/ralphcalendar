'use client';

import { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { CampaignReportingDashboard } from './CampaignReportingDashboard';
import { EventComparisonView } from './EventComparisonView';
import { generateCampaignPerformanceDeck } from '@/lib/pptx/campaignDeck';
import { generateBudgetReviewDeck } from '@/lib/pptx/budgetDeck';
import type { InsightItem } from '@/lib/pptx/shared';
import {
  SolarGraphUpLinear,
  SolarDollarCircle,
  SolarUsersGroupRounded,
  SolarDownloadLinear,
  SolarChartLinear,
  SolarAltArrowDown,
} from './SolarIcons';

interface ReportsViewProps {
  calendarId?: string;
}

type ReportSection = 'hub' | 'campaign-performance' | 'budget-review' | 'event-roi';

export function ReportsView({ calendarId }: ReportsViewProps) {
  const [section, setSection] = useState<ReportSection>('hub');
  const [exportingCampaign, setExportingCampaign] = useState(false);
  const [exportingBudget, setExportingBudget] = useState(false);

  // Quick-export period (defaults to current quarter)
  const now = new Date();
  const qStart = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
  const qEnd = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3 + 3, 0);
  const defaultPeriodStart = qStart.toISOString().split('T')[0];
  const defaultPeriodEnd = qEnd.toISOString().split('T')[0];

  const handleExportCampaignDeck = useCallback(async () => {
    if (!calendarId) return;
    setExportingCampaign(true);
    try {
      const res = await fetch(`/api/reports/campaign-performance?calendarId=${calendarId}&periodStart=${defaultPeriodStart}&periodEnd=${defaultPeriodEnd}`);
      if (!res.ok) throw new Error('Failed to fetch report data');
      const data = await res.json();

      let insights: InsightItem[] = [];
      try {
        const insightRes = await fetch(`/api/ai/campaign-insights?calendarId=${calendarId}`);
        if (insightRes.ok) {
          const insightData = await insightRes.json();
          insights = insightData.insights || [];
        }
      } catch { /* continue */ }

      await generateCampaignPerformanceDeck(data, insights, `${defaultPeriodStart} to ${defaultPeriodEnd}`);
    } catch (error) {
      console.error('Error generating campaign deck:', error);
      alert('Failed to generate campaign performance deck');
    }
    setExportingCampaign(false);
  }, [calendarId, defaultPeriodStart, defaultPeriodEnd]);

  const handleExportBudgetDeck = useCallback(async () => {
    if (!calendarId) return;
    setExportingBudget(true);
    try {
      const res = await fetch(`/api/reports/budget-review?calendarId=${calendarId}&periodStart=${defaultPeriodStart}&periodEnd=${defaultPeriodEnd}`);
      if (!res.ok) throw new Error('Failed to fetch budget data');
      const data = await res.json();

      let insights: InsightItem[] = [];
      try {
        const insightRes = await fetch(`/api/ai/budget-insights?calendarId=${calendarId}`);
        if (insightRes.ok) {
          const insightData = await insightRes.json();
          insights = (insightData.insights || []).map((i: { type: string; title: string; description: string }) => ({
            type: i.type,
            title: i.title,
            description: i.description,
            priority: 'medium',
          }));
        }
      } catch { /* continue */ }

      await generateBudgetReviewDeck(data, insights, `${defaultPeriodStart} to ${defaultPeriodEnd}`);
    } catch (error) {
      console.error('Error generating budget deck:', error);
      alert('Failed to generate budget review deck');
    }
    setExportingBudget(false);
  }, [calendarId, defaultPeriodStart, defaultPeriodEnd]);

  if (!calendarId) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground text-sm">
        Select a workspace to view reports.
      </div>
    );
  }

  // Sub-views
  if (section === 'campaign-performance') {
    return (
      <div className="p-3 sm:p-4 max-w-[1400px] mx-auto overflow-y-auto space-y-4">
        <button
          onClick={() => setSection('hub')}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          <SolarAltArrowDown className="w-3 h-3 rotate-90" />
          Back to Reports
        </button>
        <CampaignReportingDashboard calendarId={calendarId} />
      </div>
    );
  }

  if (section === 'event-roi') {
    return (
      <div className="p-3 sm:p-4 max-w-[1400px] mx-auto overflow-y-auto space-y-4">
        <button
          onClick={() => setSection('hub')}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          <SolarAltArrowDown className="w-3 h-3 rotate-90" />
          Back to Reports
        </button>
        <EventComparisonView calendarId={calendarId} />
      </div>
    );
  }

  // Hub view
  const reports = [
    {
      key: 'campaign-performance' as ReportSection,
      title: 'Campaign Performance',
      description: 'Full-funnel metrics, channel comparison, top campaigns by pipeline & ROI, ICP penetration, and source-level detail across Marketo, LinkedIn, Hero Assets, Outreach, and SFDC events.',
      icon: <SolarGraphUpLinear className="w-6 h-6" />,
      color: '#7A00C1',
      onExport: handleExportCampaignDeck,
      exporting: exportingCampaign,
    },
    {
      key: 'budget-review' as ReportSection,
      title: 'Budget & Spend Review',
      description: 'Overall budget summary, spend by channel and campaign, regional breakdown, over-budget alerts, under-budget opportunities, and AI-driven budget recommendations.',
      icon: <SolarDollarCircle className="w-6 h-6" />,
      color: '#006170',
      onExport: handleExportBudgetDeck,
      exporting: exportingBudget,
    },
    {
      key: 'event-roi' as ReportSection,
      title: 'Event ROI & YoY Comparison',
      description: 'Event-level financial summary, attendee breakdown, sub-event agenda, year-over-year comparison with prior events, and health-score-based recommendations.',
      icon: <SolarUsersGroupRounded className="w-6 h-6" />,
      color: '#3B53FF',
      onExport: null,
      exporting: false,
    },
  ];

  return (
    <div className="p-3 sm:p-6 max-w-[1400px] mx-auto overflow-y-auto">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2.5 mb-1">
          <SolarChartLinear className="w-5 h-5 text-accent-purple" />
          <h1 className="text-lg font-semibold text-foreground">Reports</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          Access all reporting decks from one place. Open a report for interactive exploration, or export directly as a PPTX presentation.
        </p>
      </div>

      {/* Report Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {reports.map((report, i) => (
          <motion.div
            key={report.key}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.08, duration: 0.35, ease: 'easeOut' }}
            className="bg-card border border-card-border rounded-xl p-5 flex flex-col gap-4 hover:shadow-lg transition-shadow group"
          >
            <div className="flex items-start gap-3">
              <div
                className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ backgroundColor: `${report.color}15`, color: report.color }}
              >
                {report.icon}
              </div>
              <div className="min-w-0">
                <h3 className="text-sm font-semibold text-foreground">{report.title}</h3>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{report.description}</p>
              </div>
            </div>

            <div className="mt-auto flex items-center gap-2 pt-2 border-t border-card-border">
              <button
                onClick={() => setSection(report.key)}
                className="flex-1 px-3 py-2 text-xs font-medium text-foreground bg-muted rounded-lg hover:bg-card-hover transition-colors text-center"
              >
                Open Report
              </button>
              {report.onExport && (
                <button
                  onClick={report.onExport}
                  disabled={report.exporting}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-white bg-accent-purple-btn rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                  <SolarDownloadLinear className="w-3.5 h-3.5" />
                  {report.exporting ? 'Generating...' : 'PPTX'}
                </button>
              )}
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
