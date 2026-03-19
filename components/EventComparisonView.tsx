'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { formatCurrency } from '@/lib/utils';

interface YearStats {
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
}

interface EventComparison {
  title: string;
  normalizedKey: string;
  priorYear: YearStats | null;
  currentYear: YearStats | null;
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

interface ComparisonSummary {
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

interface EventComparisonViewProps {
  calendarId: string;
}

type SortField = 'title' | 'priorCost' | 'currentCost' | 'costChange' | 'priorSaos' | 'currentSaos' | 'priorPipeline' | 'currentPipeline' | 'priorRoi' | 'currentRoi' | 'recommendation';
type SortDir = 'asc' | 'desc';
type FilterType = 'all' | 'matched' | 'new' | 'retired' | 'invest' | 'cut';

function fmtCompact(value: number): string {
  if (Math.abs(value) >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (Math.abs(value) >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return value.toFixed(0);
}

function fmtPct(value: number | null): string {
  if (value === null) return 'N/A';
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(1)}%`;
}

function changeColor(value: number | null, invert = false): string {
  if (value === null) return 'text-muted-foreground';
  if (value === 0) return 'text-muted-foreground';
  const positive = invert ? value < 0 : value > 0;
  return positive ? 'text-green-500' : 'text-red-500';
}

const RECOMMENDATION_STYLES: Record<string, { label: string; bg: string; text: string }> = {
  invest: { label: 'Invest More', bg: 'bg-green-500/15', text: 'text-green-500' },
  maintain: { label: 'Maintain', bg: 'bg-blue-500/15', text: 'text-blue-500' },
  reduce: { label: 'Reduce', bg: 'bg-amber-500/15', text: 'text-amber-500' },
  cut: { label: 'Cut', bg: 'bg-red-500/15', text: 'text-red-500' },
  new: { label: 'New', bg: 'bg-purple-500/15', text: 'text-purple-500' },
  retired: { label: 'Retired', bg: 'bg-gray-500/15', text: 'text-gray-400' },
};

const RECOMMENDATION_TOOLTIPS: Record<string, string> = {
  invest: 'High ROI (>3x) with strong SAO generation — increase budget.',
  maintain: 'Steady performance — continue at current level.',
  reduce: 'Below-average returns — consider reducing spend.',
  cut: 'No measurable SAOs or pipeline — recommend discontinuing.',
  new: 'First year — no prior data to compare.',
  retired: 'Not repeated this year.',
};

const REC_BAR_COLORS: Record<string, string> = {
  invest: '#006170', maintain: '#3B53FF', reduce: '#FFA943',
  new: '#7A00C1', cut: '#FF715A', retired: '#D6E4EA',
};

export function EventComparisonView({ calendarId }: EventComparisonViewProps) {
  const [data, setData] = useState<ComparisonSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [priorYear, setPriorYear] = useState<number>(new Date().getFullYear() - 1);
  const [currentYear, setCurrentYear] = useState<number>(new Date().getFullYear());
  const [sortField, setSortField] = useState<SortField>('recommendation');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [filter, setFilter] = useState<FilterType>('all');
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [showPriorYear, setShowPriorYear] = useState(false);
  const [showKpis, setShowKpis] = useState(true);
  const [editingCost, setEditingCost] = useState<string | null>(null);
  const [editingCostValue, setEditingCostValue] = useState('');
  const costInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingCost && costInputRef.current) {
      costInputRef.current.focus();
      costInputRef.current.select();
    }
  }, [editingCost]);

  async function handleCostSave(activityId: string, newCost: string, normalizedKey: string) {
    const numVal = parseFloat(newCost);
    if (isNaN(numVal) || !activityId) { setEditingCost(null); return; }
    try {
      await fetch(`/api/events/${activityId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cost: String(numVal) }),
      });
      setData(prev => {
        if (!prev) return prev;
        const comparisons = prev.comparisons.map(c => {
          if (c.normalizedKey === normalizedKey && c.currentYear) {
            return { ...c, currentYear: { ...c.currentYear, cost: numVal } };
          }
          return c;
        });
        const totalCurrentCost = comparisons.reduce(
          (sum, c) => sum + (c.currentYear ? Math.max(c.currentYear.actualCost, c.currentYear.cost) : 0), 0
        );
        const totalCostChange = totalCurrentCost - prev.totalPriorCost;
        const totalCostChangePct = prev.totalPriorCost > 0 ? (totalCostChange / prev.totalPriorCost) * 100 : null;
        return { ...prev, comparisons, totalCurrentCost, totalCostChange, totalCostChangePct };
      });
    } catch { /* silently fail for now */ }
    setEditingCost(null);
  }

  function recToFilter(rec: string): FilterType {
    if (rec === 'invest') return 'invest';
    if (rec === 'cut' || rec === 'reduce') return 'cut';
    if (rec === 'new') return 'new';
    if (rec === 'retired') return 'retired';
    return 'matched';
  }

  useEffect(() => {
    if (!calendarId) return;
    setLoading(true);
    setError(null);
    fetch(`/api/events/compare?calendarId=${calendarId}&priorYear=${priorYear}&currentYear=${currentYear}`)
      .then(res => {
        if (!res.ok) throw new Error('Failed to load comparison data');
        return res.json();
      })
      .then(setData)
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, [calendarId, priorYear, currentYear]);

  const filteredComparisons = useMemo(() => {
    if (!data) return [];
    let items = data.comparisons;
    switch (filter) {
      case 'matched':
        items = items.filter(c => c.priorYear && c.currentYear);
        break;
      case 'new':
        items = items.filter(c => c.recommendation === 'new');
        break;
      case 'retired':
        items = items.filter(c => c.recommendation === 'retired');
        break;
      case 'invest':
        items = items.filter(c => c.recommendation === 'invest');
        break;
      case 'cut':
        items = items.filter(c => c.recommendation === 'cut' || c.recommendation === 'reduce');
        break;
    }
    return items;
  }, [data, filter]);

  const sortedComparisons = useMemo(() => {
    const items = [...filteredComparisons];
    items.sort((a, b) => {
      let va: number | string = 0;
      let vb: number | string = 0;
      switch (sortField) {
        case 'title':
          va = a.title.toLowerCase();
          vb = b.title.toLowerCase();
          break;
        case 'priorCost':
          va = a.priorYear?.actualCost || a.priorYear?.cost || 0;
          vb = b.priorYear?.actualCost || b.priorYear?.cost || 0;
          break;
        case 'currentCost':
          va = a.currentYear?.actualCost || a.currentYear?.cost || 0;
          vb = b.currentYear?.actualCost || b.currentYear?.cost || 0;
          break;
        case 'costChange':
          va = a.changes.costChangePct ?? -999;
          vb = b.changes.costChangePct ?? -999;
          break;
        case 'priorSaos':
          va = a.priorYear?.actualSaos || 0;
          vb = b.priorYear?.actualSaos || 0;
          break;
        case 'currentSaos':
          va = a.currentYear?.actualSaos || 0;
          vb = b.currentYear?.actualSaos || 0;
          break;
        case 'priorPipeline':
          va = a.priorYear?.pipelineGenerated || 0;
          vb = b.priorYear?.pipelineGenerated || 0;
          break;
        case 'currentPipeline':
          va = a.currentYear?.pipelineGenerated || 0;
          vb = b.currentYear?.pipelineGenerated || 0;
          break;
        case 'priorRoi':
          va = a.priorYear?.roi || 0;
          vb = b.priorYear?.roi || 0;
          break;
        case 'currentRoi':
          va = a.currentYear?.roi || 0;
          vb = b.currentYear?.roi || 0;
          break;
        case 'recommendation': {
          const order = { invest: 0, maintain: 1, reduce: 2, new: 3, cut: 4, retired: 5 };
          va = order[a.recommendation] ?? 99;
          vb = order[b.recommendation] ?? 99;
          break;
        }
      }
      if (va < vb) return sortDir === 'asc' ? -1 : 1;
      if (va > vb) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
    return items;
  }, [filteredComparisons, sortField, sortDir]);

  function handleSort(field: SortField) {
    if (sortField === field) {
      setSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  }

  function SortHeader({ field, children, className = '', align }: { field: SortField; children: React.ReactNode; className?: string; align?: 'left' | 'right' }) {
    const active = sortField === field;
    const textAlign = align === 'right' ? 'text-right' : 'text-left';
    return (
      <th
        className={`px-2 py-2 ${textAlign} text-[10px] font-medium text-muted-foreground uppercase tracking-wide cursor-pointer hover:text-foreground select-none whitespace-nowrap ${className}`}
        onClick={() => handleSort(field)}
      >
        <span className={`inline-flex items-center gap-0.5 ${align === 'right' ? 'justify-end' : ''}`}>
          {children}
          {active && <span className="text-[8px]">{sortDir === 'asc' ? '\u25B2' : '\u25BC'}</span>}
        </span>
      </th>
    );
  }

  // Year selector range
  const thisYear = new Date().getFullYear();
  const yearOptions = Array.from({ length: 6 }, (_, i) => thisYear - 5 + i);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="relative w-8 h-8 mx-auto mb-3">
            <div className="absolute inset-0 rounded-full border-2 border-card-border" />
            <div className="absolute inset-0 rounded-full border-2 border-accent border-t-transparent animate-spin" />
          </div>
          <p className="text-xs text-muted-foreground">Comparing events across years...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center text-red-400 text-sm">{error}</div>
      </div>
    );
  }

  if (!data) return null;

  const hasData = data.comparisons.length > 0;

  return (
    <div className="space-y-4">
      {/* Year Selector + Filter Bar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 text-sm">
          <label className="text-muted-foreground text-xs font-medium">Compare</label>
          <select
            value={priorYear}
            onChange={e => setPriorYear(Number(e.target.value))}
            className="px-2 py-1 text-xs bg-card border border-card-border rounded text-foreground"
          >
            {yearOptions.map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
          <span className="text-muted-foreground text-xs">vs</span>
          <select
            value={currentYear}
            onChange={e => setCurrentYear(Number(e.target.value))}
            className="px-2 py-1 text-xs bg-card border border-card-border rounded text-foreground"
          >
            {yearOptions.map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-1 ml-auto">
          {(['all', 'matched', 'invest', 'cut', 'new', 'retired'] as FilterType[]).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-2 py-1 text-[10px] font-medium rounded transition-colors ${
                filter === f
                  ? 'bg-accent text-white'
                  : 'bg-muted text-muted-foreground hover:text-foreground'
              }`}
            >
              {f === 'all' ? 'All' : f === 'matched' ? 'Matched' : f === 'invest' ? 'Invest' : f === 'cut' ? 'Cut/Reduce' : f === 'new' ? 'New' : 'Retired'}
              {data && (
                <span className="ml-1 opacity-70">
                  {f === 'all' ? data.comparisons.length
                    : f === 'matched' ? data.matchedEvents
                    : f === 'invest' ? data.comparisons.filter(c => c.recommendation === 'invest').length
                    : f === 'cut' ? data.comparisons.filter(c => c.recommendation === 'cut' || c.recommendation === 'reduce').length
                    : f === 'new' ? data.newEvents
                    : data.retiredEvents}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {!hasData ? (
        <div className="text-center py-12 text-muted-foreground text-sm">
          No events found for {priorYear} or {currentYear}. Add activities with dates in those years to see comparisons.
        </div>
      ) : (
        <>
          {/* Summary KPI Cards */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-foreground">Summary</span>
              <button
                onClick={() => setShowKpis(!showKpis)}
                className="text-[10px] text-muted-foreground hover:text-foreground transition-colors"
              >
                {showKpis ? 'Collapse' : 'Expand'}
              </button>
            </div>
            {showKpis ? (
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
                <div className="bg-card border border-card-border rounded-lg p-3">
                  <div className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">Total Cost YoY</div>
                  <div className="text-lg font-bold text-foreground">{fmtPct(data.totalCostChangePct)}</div>
                  <div className="text-[10px] text-muted-foreground">
                    {formatCurrency(data.totalPriorCost)} &rarr; {formatCurrency(data.totalCurrentCost)}
                  </div>
                </div>
                <div className="bg-card border border-card-border rounded-lg p-3">
                  <div className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">SAOs YoY</div>
                  <div className={`text-lg font-bold ${changeColor(data.totalCurrentSaos - data.totalPriorSaos)}`}>
                    {data.totalCurrentSaos - data.totalPriorSaos >= 0 ? '+' : ''}{data.totalCurrentSaos - data.totalPriorSaos}
                  </div>
                  <div className="text-[10px] text-muted-foreground">
                    {data.totalPriorSaos} &rarr; {data.totalCurrentSaos}
                  </div>
                </div>
                <div className="bg-card border border-card-border rounded-lg p-3">
                  <div className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">Pipeline YoY</div>
                  <div className={`text-lg font-bold ${changeColor(data.totalCurrentPipeline - data.totalPriorPipeline)}`}>
                    {formatCurrency(data.totalCurrentPipeline - data.totalPriorPipeline)}
                  </div>
                  <div className="text-[10px] text-muted-foreground">
                    {formatCurrency(data.totalPriorPipeline)} &rarr; {formatCurrency(data.totalCurrentPipeline)}
                  </div>
                </div>
                <div className="bg-card border border-card-border rounded-lg p-3">
                  <div className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">Avg ROI</div>
                  <div className={`text-lg font-bold ${changeColor(data.avgCurrentRoi - data.avgPriorRoi)}`}>
                    {data.avgCurrentRoi.toFixed(1)}x
                  </div>
                  <div className="text-[10px] text-muted-foreground">
                    was {data.avgPriorRoi.toFixed(1)}x in {data.priorYear}
                  </div>
                </div>
                <div className="bg-card border border-card-border rounded-lg p-3">
                  <div className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">Matched Events</div>
                  <div className="text-lg font-bold text-foreground">{data.matchedEvents}</div>
                  <div className="text-[10px] text-muted-foreground">
                    of {data.totalEvents} total
                  </div>
                </div>
                <div className="bg-card border border-card-border rounded-lg p-3">
                  <div className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">New / Retired</div>
                  <div className="text-lg font-bold text-foreground">
                    <span className="text-purple-500">{data.newEvents}</span>
                    {' / '}
                    <span className="text-gray-400">{data.retiredEvents}</span>
                  </div>
                  <div className="text-[10px] text-muted-foreground">
                    events changed
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-card border border-card-border rounded-lg px-3 py-2 text-xs text-muted-foreground flex flex-wrap gap-x-4 gap-y-1">
                <span>Cost: <span className="text-foreground font-medium">{formatCurrency(data.totalCurrentCost)}</span> <span className={changeColor(data.totalCostChangePct, true)}>({fmtPct(data.totalCostChangePct)})</span></span>
                <span>SAOs: <span className="text-foreground font-medium">{data.totalCurrentSaos}</span></span>
                <span>Pipeline: <span className="text-foreground font-medium">{formatCurrency(data.totalCurrentPipeline)}</span></span>
                <span>ROI: <span className="text-foreground font-medium">{data.avgCurrentRoi.toFixed(1)}x</span></span>
                <span>Events: <span className="text-foreground font-medium">{data.totalEvents}</span> (<span className="text-purple-500">{data.newEvents} new</span>, <span className="text-gray-400">{data.retiredEvents} retired</span>)</span>
              </div>
            )}
          </div>

          {/* Recommendation Breakdown Bar */}
          <div className="bg-card border border-card-border rounded-lg p-3">
            <div className="text-xs font-semibold text-foreground mb-2">Investment Recommendation Breakdown</div>
            <div className="h-5 rounded overflow-hidden flex bg-muted mb-2">
              {(['invest', 'maintain', 'reduce', 'new', 'cut', 'retired'] as const).map(rec => {
                const count = data.comparisons.filter(c => c.recommendation === rec).length;
                if (count === 0) return null;
                const pct = (count / data.comparisons.length) * 100;
                return (
                  <div
                    key={rec}
                    className="h-full transition-all cursor-pointer hover:opacity-80"
                    style={{ width: `${pct}%`, backgroundColor: REC_BAR_COLORS[rec] }}
                    title={`${RECOMMENDATION_STYLES[rec].label}: ${count}`}
                    onClick={() => { const f = recToFilter(rec); setFilter(prev => prev === f ? 'all' : f); }}
                  />
                );
              })}
            </div>
            <div className="flex flex-wrap gap-3 text-[10px]">
              {(['invest', 'maintain', 'reduce', 'new', 'cut', 'retired'] as const).map(rec => {
                const count = data.comparisons.filter(c => c.recommendation === rec).length;
                if (count === 0) return null;
                const style = RECOMMENDATION_STYLES[rec];
                return (
                  <span
                    key={rec}
                    className="flex items-center gap-1 cursor-pointer hover:opacity-80"
                    onClick={() => { const f = recToFilter(rec); setFilter(prev => prev === f ? 'all' : f); }}
                  >
                    <span className={`inline-block w-2 h-2 rounded-full`} style={{ backgroundColor: REC_BAR_COLORS[rec] }} />
                    <span className={style.text}>{style.label}</span>
                    <span className="text-muted-foreground">({count})</span>
                  </span>
                );
              })}
            </div>
          </div>

          {/* Comparison Table */}
          <div className="bg-card border border-card-border rounded-lg overflow-hidden">
            <div className="px-3 py-2 border-b border-card-border flex items-center justify-between gap-2">
              <h3 className="text-xs font-semibold text-foreground">
                Event-by-Event Comparison
              </h3>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowPriorYear(!showPriorYear)}
                  className={`px-2 py-1 text-[10px] font-medium rounded transition-colors ${
                    showPriorYear
                      ? 'bg-accent text-white'
                      : 'bg-muted text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {showPriorYear ? 'Hide' : 'Show'} {data.priorYear} data
                </button>
                <span className="text-[10px] text-muted-foreground">
                  {sortedComparisons.length} events
                </span>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-muted/50">
                  <tr>
                    <SortHeader field="title" className="min-w-[160px]">Event</SortHeader>
                    <SortHeader field="recommendation">Signal</SortHeader>
                    {showPriorYear && <SortHeader field="priorCost" align="right">{data.priorYear} Cost</SortHeader>}
                    <SortHeader field="currentCost" align="right">{data.currentYear} Cost</SortHeader>
                    <SortHeader field="costChange" align="right">Cost Chg</SortHeader>
                    {showPriorYear && <SortHeader field="priorSaos" align="right">{data.priorYear} SAOs</SortHeader>}
                    <SortHeader field="currentSaos" align="right">{data.currentYear} SAOs</SortHeader>
                    {showPriorYear && <SortHeader field="priorPipeline" align="right">{data.priorYear} Pipeline</SortHeader>}
                    <SortHeader field="currentPipeline" align="right">{data.currentYear} Pipeline</SortHeader>
                    {showPriorYear && <SortHeader field="priorRoi" align="right">{data.priorYear} ROI</SortHeader>}
                    <SortHeader field="currentRoi" align="right">{data.currentYear} ROI</SortHeader>
                  </tr>
                </thead>
                <tbody className="divide-y divide-card-border">
                  {sortedComparisons.map((comp) => {
                    const isExpanded = expandedRow === comp.normalizedKey;
                    const recStyle = RECOMMENDATION_STYLES[comp.recommendation];
                    const isEditingThis = editingCost === comp.normalizedKey;
                    const colCount = showPriorYear ? 11 : 7;
                    return (
                      <React.Fragment key={comp.normalizedKey}>
                        <tr
                          className="hover:bg-muted/30 transition-colors cursor-pointer"
                          onClick={() => setExpandedRow(isExpanded ? null : comp.normalizedKey)}
                        >
                          <td className="px-2 py-2 text-foreground font-medium">
                            <div className="flex items-center gap-1">
                              <span className={`text-[10px] text-muted-foreground transition-transform inline-block ${isExpanded ? 'rotate-90' : ''}`}>&#9654;</span>
                              <div className="truncate max-w-[200px]" title={comp.title}>
                                {comp.title}
                              </div>
                            </div>
                            {comp.priorYear?.title && comp.currentYear?.title && comp.priorYear.title !== comp.currentYear.title && (
                              <div className="text-[10px] text-muted-foreground truncate max-w-[200px] pl-4" title={comp.priorYear.title}>
                                was: {comp.priorYear.title}
                              </div>
                            )}
                          </td>
                          <td className="px-2 py-2">
                            <div className="relative group/tip inline-flex">
                              <span className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-medium ${recStyle.bg} ${recStyle.text}`}>
                                {recStyle.label}
                              </span>
                              <div className="absolute left-0 top-full mt-1 z-50 w-48 px-2 py-1.5 text-[10px] text-foreground bg-card border border-card-border rounded shadow-lg opacity-0 group-hover/tip:opacity-100 pointer-events-none transition-opacity whitespace-normal">
                                {RECOMMENDATION_TOOLTIPS[comp.recommendation]}
                              </div>
                            </div>
                          </td>
                          {showPriorYear && (
                            <td className="px-2 py-2 text-right text-muted-foreground tabular-nums">
                              {comp.priorYear ? formatCurrency(Math.max(comp.priorYear.actualCost, comp.priorYear.cost)) : '\u2014'}
                            </td>
                          )}
                          <td
                            className="px-2 py-2 text-right tabular-nums group/cost"
                            onClick={(e) => {
                              if (!comp.currentYear?.activityId) return;
                              e.stopPropagation();
                              setEditingCost(comp.normalizedKey);
                              setEditingCostValue(String(Math.max(comp.currentYear.actualCost, comp.currentYear.cost)));
                            }}
                          >
                            {isEditingThis ? (
                              <input
                                ref={costInputRef}
                                type="number"
                                value={editingCostValue}
                                onChange={(e) => setEditingCostValue(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') handleCostSave(comp.currentYear!.activityId!, editingCostValue, comp.normalizedKey);
                                  if (e.key === 'Escape') setEditingCost(null);
                                }}
                                onBlur={() => handleCostSave(comp.currentYear!.activityId!, editingCostValue, comp.normalizedKey)}
                                onClick={(e) => e.stopPropagation()}
                                className="w-24 px-1 py-0.5 text-right text-xs bg-muted border border-accent/40 rounded text-foreground outline-none"
                              />
                            ) : (
                              <span className={`${comp.currentYear?.activityId ? 'text-foreground border-b border-dashed border-transparent group-hover/cost:border-muted-foreground' : 'text-muted-foreground'}`}>
                                {comp.currentYear ? formatCurrency(Math.max(comp.currentYear.actualCost, comp.currentYear.cost)) : '\u2014'}
                              </span>
                            )}
                          </td>
                          <td className={`px-2 py-2 text-right tabular-nums font-medium ${changeColor(comp.changes.costChangePct, true)}`}>
                            {fmtPct(comp.changes.costChangePct)}
                          </td>
                          {showPriorYear && (
                            <td className="px-2 py-2 text-right text-muted-foreground tabular-nums">
                              {comp.priorYear?.actualSaos ?? '\u2014'}
                            </td>
                          )}
                          <td className="px-2 py-2 text-right text-muted-foreground tabular-nums">
                            {comp.currentYear?.actualSaos ?? '\u2014'}
                          </td>
                          {showPriorYear && (
                            <td className="px-2 py-2 text-right text-muted-foreground tabular-nums">
                              {comp.priorYear ? formatCurrency(comp.priorYear.pipelineGenerated) : '\u2014'}
                            </td>
                          )}
                          <td className="px-2 py-2 text-right text-muted-foreground tabular-nums">
                            {comp.currentYear ? formatCurrency(comp.currentYear.pipelineGenerated) : '\u2014'}
                          </td>
                          {showPriorYear && (
                            <td className="px-2 py-2 text-right text-muted-foreground tabular-nums">
                              {comp.priorYear ? `${comp.priorYear.roi.toFixed(1)}x` : '\u2014'}
                            </td>
                          )}
                          <td className="px-2 py-2 text-right text-muted-foreground tabular-nums">
                            {comp.currentYear ? `${comp.currentYear.roi.toFixed(1)}x` : '\u2014'}
                          </td>
                        </tr>
                        {/* Expanded Row Detail Panel */}
                        {isExpanded && (
                          <tr>
                            <td colSpan={colCount} className="px-4 py-3 bg-muted/20 border-b border-card-border">
                              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                {/* Prior Year Stats */}
                                <div className="bg-card border border-card-border rounded-lg p-3">
                                  <div className="text-[10px] text-muted-foreground uppercase tracking-wide mb-2 font-medium">{data.priorYear}</div>
                                  {comp.priorYear ? (
                                    <div className="space-y-1 text-xs">
                                      <div className="flex justify-between"><span className="text-muted-foreground">Cost</span><span className="text-foreground tabular-nums">{formatCurrency(Math.max(comp.priorYear.actualCost, comp.priorYear.cost))}</span></div>
                                      <div className="flex justify-between"><span className="text-muted-foreground">SAOs</span><span className="text-foreground tabular-nums">{comp.priorYear.actualSaos}</span></div>
                                      <div className="flex justify-between"><span className="text-muted-foreground">Pipeline</span><span className="text-foreground tabular-nums">{formatCurrency(comp.priorYear.pipelineGenerated)}</span></div>
                                      <div className="flex justify-between"><span className="text-muted-foreground">ROI</span><span className="text-foreground tabular-nums">{comp.priorYear.roi.toFixed(1)}x</span></div>
                                      <div className="flex justify-between"><span className="text-muted-foreground">Cost/SAO</span><span className="text-foreground tabular-nums">{comp.priorYear.costPerSao > 0 ? formatCurrency(comp.priorYear.costPerSao) : '\u2014'}</span></div>
                                      {comp.priorYear.startDate && <div className="flex justify-between"><span className="text-muted-foreground">Dates</span><span className="text-foreground text-[10px]">{comp.priorYear.startDate?.slice(0, 10)}</span></div>}
                                    </div>
                                  ) : (
                                    <div className="text-xs text-muted-foreground italic">No data for this year</div>
                                  )}
                                </div>
                                {/* Current Year Stats */}
                                <div className="bg-card border border-card-border rounded-lg p-3">
                                  <div className="text-[10px] text-muted-foreground uppercase tracking-wide mb-2 font-medium">{data.currentYear}</div>
                                  {comp.currentYear ? (
                                    <div className="space-y-1 text-xs">
                                      <div className="flex justify-between items-center">
                                        <span className="text-muted-foreground">Cost</span>
                                        {editingCost === comp.normalizedKey + '-detail' ? (
                                          <input
                                            type="number"
                                            autoFocus
                                            value={editingCostValue}
                                            onChange={(e) => setEditingCostValue(e.target.value)}
                                            onKeyDown={(e) => {
                                              if (e.key === 'Enter') { handleCostSave(comp.currentYear!.activityId!, editingCostValue, comp.normalizedKey); setEditingCost(null); }
                                              if (e.key === 'Escape') setEditingCost(null);
                                            }}
                                            onBlur={() => { handleCostSave(comp.currentYear!.activityId!, editingCostValue, comp.normalizedKey); setEditingCost(null); }}
                                            onClick={(e) => e.stopPropagation()}
                                            className="w-24 px-1 py-0.5 text-right text-xs bg-muted border border-accent/40 rounded text-foreground outline-none"
                                          />
                                        ) : (
                                          <span
                                            className={`tabular-nums ${comp.currentYear.activityId ? 'text-foreground cursor-pointer border-b border-dashed border-transparent hover:border-muted-foreground' : 'text-foreground'}`}
                                            onClick={(e) => {
                                              if (!comp.currentYear?.activityId) return;
                                              e.stopPropagation();
                                              setEditingCost(comp.normalizedKey + '-detail');
                                              setEditingCostValue(String(Math.max(comp.currentYear.actualCost, comp.currentYear.cost)));
                                            }}
                                          >
                                            {formatCurrency(Math.max(comp.currentYear.actualCost, comp.currentYear.cost))}
                                          </span>
                                        )}
                                      </div>
                                      <div className="flex justify-between"><span className="text-muted-foreground">SAOs</span><span className="text-foreground tabular-nums">{comp.currentYear.actualSaos}</span></div>
                                      <div className="flex justify-between"><span className="text-muted-foreground">Pipeline</span><span className="text-foreground tabular-nums">{formatCurrency(comp.currentYear.pipelineGenerated)}</span></div>
                                      <div className="flex justify-between"><span className="text-muted-foreground">ROI</span><span className="text-foreground tabular-nums">{comp.currentYear.roi.toFixed(1)}x</span></div>
                                      <div className="flex justify-between"><span className="text-muted-foreground">Cost/SAO</span><span className="text-foreground tabular-nums">{comp.currentYear.costPerSao > 0 ? formatCurrency(comp.currentYear.costPerSao) : '\u2014'}</span></div>
                                      {comp.currentYear.startDate && <div className="flex justify-between"><span className="text-muted-foreground">Dates</span><span className="text-foreground text-[10px]">{comp.currentYear.startDate?.slice(0, 10)}</span></div>}
                                    </div>
                                  ) : (
                                    <div className="text-xs text-muted-foreground italic">No data for this year</div>
                                  )}
                                </div>
                                {/* Recommendation Explanation */}
                                <div className="bg-card border border-card-border rounded-lg p-3">
                                  <div className="text-[10px] text-muted-foreground uppercase tracking-wide mb-2 font-medium">Recommendation</div>
                                  <div className="mb-2">
                                    <span className={`inline-flex px-2 py-1 rounded text-xs font-medium ${recStyle.bg} ${recStyle.text}`}>
                                      {recStyle.label}
                                    </span>
                                  </div>
                                  <p className="text-xs text-muted-foreground leading-relaxed">
                                    {RECOMMENDATION_TOOLTIPS[comp.recommendation]}
                                  </p>
                                  {comp.changes.costChangePct !== null && (
                                    <div className="mt-2 pt-2 border-t border-card-border space-y-1 text-[10px]">
                                      <div className="flex justify-between">
                                        <span className="text-muted-foreground">Cost change</span>
                                        <span className={changeColor(comp.changes.costChangePct, true)}>{fmtPct(comp.changes.costChangePct)}</span>
                                      </div>
                                      {comp.changes.saosChangePct !== null && (
                                        <div className="flex justify-between">
                                          <span className="text-muted-foreground">SAO change</span>
                                          <span className={changeColor(comp.changes.saosChangePct)}>{fmtPct(comp.changes.saosChangePct)}</span>
                                        </div>
                                      )}
                                      {comp.changes.pipelineChangePct !== null && (
                                        <div className="flex justify-between">
                                          <span className="text-muted-foreground">Pipeline change</span>
                                          <span className={changeColor(comp.changes.pipelineChangePct)}>{fmtPct(comp.changes.pipelineChangePct)}</span>
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
                {/* Totals Footer */}
                <tfoot className="bg-muted/50 font-semibold text-xs">
                  <tr>
                    <td className="px-2 py-2 text-foreground">Totals</td>
                    <td className="px-2 py-2" />
                    {showPriorYear && <td className="px-2 py-2 text-right text-foreground tabular-nums">{formatCurrency(data.totalPriorCost)}</td>}
                    <td className="px-2 py-2 text-right text-foreground tabular-nums">{formatCurrency(data.totalCurrentCost)}</td>
                    <td className={`px-2 py-2 text-right tabular-nums ${changeColor(data.totalCostChangePct, true)}`}>
                      {fmtPct(data.totalCostChangePct)}
                    </td>
                    {showPriorYear && <td className="px-2 py-2 text-right text-foreground tabular-nums">{data.totalPriorSaos}</td>}
                    <td className="px-2 py-2 text-right text-foreground tabular-nums">{data.totalCurrentSaos}</td>
                    {showPriorYear && <td className="px-2 py-2 text-right text-foreground tabular-nums">{formatCurrency(data.totalPriorPipeline)}</td>}
                    <td className="px-2 py-2 text-right text-foreground tabular-nums">{formatCurrency(data.totalCurrentPipeline)}</td>
                    {showPriorYear && <td className="px-2 py-2 text-right text-foreground tabular-nums">{data.avgPriorRoi.toFixed(1)}x</td>}
                    <td className="px-2 py-2 text-right text-foreground tabular-nums">{data.avgCurrentRoi.toFixed(1)}x</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Justification Summary */}
          <div className="bg-card border border-card-border rounded-lg p-4">
            <h3 className="text-xs font-semibold text-foreground mb-3">Investment Justification Summary</h3>
            <div className="space-y-2 text-xs">
              {data.totalCostChangePct !== null && (
                <p className="text-muted-foreground">
                  Total event spend is {data.totalCostChangePct > 0 ? 'up' : 'down'}{' '}
                  <span className={`font-medium ${changeColor(data.totalCostChangePct, true)}`}>
                    {fmtPct(data.totalCostChangePct)}
                  </span>{' '}
                  YoY ({formatCurrency(data.totalPriorCost)} &rarr; {formatCurrency(data.totalCurrentCost)}).
                </p>
              )}
              {data.totalPriorSaos > 0 && (
                <p className="text-muted-foreground">
                  SAO generation changed from <span className="font-medium text-foreground">{data.totalPriorSaos}</span> to{' '}
                  <span className="font-medium text-foreground">{data.totalCurrentSaos}</span>{' '}
                  ({fmtPct(((data.totalCurrentSaos - data.totalPriorSaos) / data.totalPriorSaos) * 100)} change).
                </p>
              )}
              {data.totalPriorPipeline > 0 && (
                <p className="text-muted-foreground">
                  Pipeline generated moved from <span className="font-medium text-foreground">{formatCurrency(data.totalPriorPipeline)}</span> to{' '}
                  <span className="font-medium text-foreground">{formatCurrency(data.totalCurrentPipeline)}</span>.
                  {data.avgCurrentRoi >= data.avgPriorRoi
                    ? ' ROI has improved, supporting continued investment.'
                    : ' ROI has declined \u2014 review underperforming events for optimization.'}
                </p>
              )}
              {data.comparisons.filter(c => c.recommendation === 'invest').length > 0 && (
                <p className="text-muted-foreground">
                  <span className="font-medium text-green-500">
                    {data.comparisons.filter(c => c.recommendation === 'invest').length} events
                  </span>{' '}
                  show strong ROI ({'>'} 3x) and SAO generation, warranting increased investment:{' '}
                  <span className="text-foreground">
                    {data.comparisons.filter(c => c.recommendation === 'invest').map(c => c.title).join(', ')}.
                  </span>
                </p>
              )}
              {data.comparisons.filter(c => c.recommendation === 'cut').length > 0 && (
                <p className="text-muted-foreground">
                  <span className="font-medium text-red-500">
                    {data.comparisons.filter(c => c.recommendation === 'cut').length} events
                  </span>{' '}
                  delivered no measurable SAOs or pipeline and should be reconsidered:{' '}
                  <span className="text-foreground">
                    {data.comparisons.filter(c => c.recommendation === 'cut').map(c => c.title).join(', ')}.
                  </span>
                </p>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
