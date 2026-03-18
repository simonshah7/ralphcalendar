'use client';

import { useMemo, useState } from 'react';
import { Activity, Campaign, Swimlane, Status } from '@/db/schema';
import { formatCurrency } from '@/lib/utils';

interface DashboardViewProps {
  activities: Activity[];
  campaigns: Campaign[];
  swimlanes: Swimlane[];
  statuses: Status[];
}

type SortField =
  | 'name'
  | 'budget'
  | 'planned'
  | 'actual'
  | 'variance'
  | 'expectedSaos'
  | 'actualSaos'
  | 'pipeline'
  | 'roi';

type SortDir = 'asc' | 'desc';

function num(value: string | number | null | undefined): number {
  if (value == null) return 0;
  const n = typeof value === 'string' ? parseFloat(value) : value;
  return isNaN(n) ? 0 : n;
}

function fmtCompact(value: number): string {
  if (Math.abs(value) >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (Math.abs(value) >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return value.toFixed(0);
}

function pct(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

// ─── KPI Card ───────────────────────────────────────────

function KpiCard({
  icon,
  label,
  value,
  sub,
  trend,
}: {
  icon: string;
  label: string;
  value: string;
  sub?: string;
  trend?: { label: string; positive: boolean } | null;
}) {
  return (
    <div className="bg-card border border-card-border rounded-lg p-4 flex flex-col gap-1 min-w-0">
      <div className="flex items-center gap-2 text-muted-foreground text-xs font-medium uppercase tracking-wide">
        <span className="text-sm">{icon}</span>
        <span className="truncate">{label}</span>
      </div>
      <div className="text-2xl font-bold text-foreground truncate">{value}</div>
      {sub && <div className="text-xs text-muted-foreground truncate">{sub}</div>}
      {trend && (
        <div
          className={`text-xs font-medium ${trend.positive ? 'text-green-500' : 'text-red-500'}`}
        >
          {trend.positive ? '\u25B2' : '\u25BC'} {trend.label}
        </div>
      )}
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────

export function DashboardView({ activities, campaigns, swimlanes, statuses }: DashboardViewProps) {
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  // ── Aggregate metrics ───────────────────────────────

  const metrics = useMemo(() => {
    const totalBudget = campaigns.reduce((s, c) => s + num(c.budget), 0);
    const totalPlanned = activities.reduce((s, a) => s + num(a.cost), 0);
    const totalActual = activities.reduce((s, a) => s + num(a.actualCost), 0);
    const budgetUtil = totalBudget > 0 ? totalActual / totalBudget : 0;
    const totalExpectedSaos = activities.reduce((s, a) => s + num(a.expectedSaos), 0);
    const totalActualSaos = activities.reduce((s, a) => s + num(a.actualSaos), 0);
    const totalPipeline = activities.reduce((s, a) => s + num(a.pipelineGenerated), 0);
    const pipelineRoi = totalActual > 0 ? totalPipeline / totalActual : 0;

    return {
      totalBudget,
      totalPlanned,
      totalActual,
      budgetUtil,
      totalExpectedSaos,
      totalActualSaos,
      totalPipeline,
      pipelineRoi,
    };
  }, [activities, campaigns]);

  // ── Campaign-level data ─────────────────────────────

  const campaignRows = useMemo(() => {
    const map = new Map<
      string | null,
      {
        name: string;
        budget: number;
        planned: number;
        actual: number;
        expectedSaos: number;
        actualSaos: number;
        pipeline: number;
      }
    >();

    for (const c of campaigns) {
      map.set(c.id, {
        name: c.name,
        budget: num(c.budget),
        planned: 0,
        actual: 0,
        expectedSaos: 0,
        actualSaos: 0,
        pipeline: 0,
      });
    }

    // Ensure "no campaign" bucket
    map.set(null, {
      name: 'Unassigned',
      budget: 0,
      planned: 0,
      actual: 0,
      expectedSaos: 0,
      actualSaos: 0,
      pipeline: 0,
    });

    for (const a of activities) {
      const key = a.campaignId ?? null;
      let row = map.get(key);
      if (!row) {
        row = map.get(null)!;
      }
      row.planned += num(a.cost);
      row.actual += num(a.actualCost);
      row.expectedSaos += num(a.expectedSaos);
      row.actualSaos += num(a.actualSaos);
      row.pipeline += num(a.pipelineGenerated);
    }

    // Remove unassigned row if empty
    const unassigned = map.get(null)!;
    if (unassigned.planned === 0 && unassigned.actual === 0) {
      map.delete(null);
    }

    return Array.from(map.values()).map((r) => ({
      ...r,
      variance: r.budget - r.actual,
      roi: r.actual > 0 ? r.pipeline / r.actual : 0,
    }));
  }, [activities, campaigns]);

  // ── Sorted campaign rows for table ──────────────────

  const sortedRows = useMemo(() => {
    const rows = [...campaignRows];
    rows.sort((a, b) => {
      let va: number | string;
      let vb: number | string;
      switch (sortField) {
        case 'name':
          va = a.name.toLowerCase();
          vb = b.name.toLowerCase();
          break;
        case 'budget':
          va = a.budget;
          vb = b.budget;
          break;
        case 'planned':
          va = a.planned;
          vb = b.planned;
          break;
        case 'actual':
          va = a.actual;
          vb = b.actual;
          break;
        case 'variance':
          va = a.variance;
          vb = b.variance;
          break;
        case 'expectedSaos':
          va = a.expectedSaos;
          vb = b.expectedSaos;
          break;
        case 'actualSaos':
          va = a.actualSaos;
          vb = b.actualSaos;
          break;
        case 'pipeline':
          va = a.pipeline;
          vb = b.pipeline;
          break;
        case 'roi':
          va = a.roi;
          vb = b.roi;
          break;
        default:
          va = 0;
          vb = 0;
      }
      if (va < vb) return sortDir === 'asc' ? -1 : 1;
      if (va > vb) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
    return rows;
  }, [campaignRows, sortField, sortDir]);

  // ── Region breakdown ────────────────────────────────

  const regionData = useMemo(() => {
    const map: Record<string, number> = { US: 0, EMEA: 0, ROW: 0 };
    for (const a of activities) {
      const region = a.region ?? 'US';
      map[region] = (map[region] || 0) + num(a.actualCost);
    }
    const total = Object.values(map).reduce((s, v) => s + v, 0);
    const colors: Record<string, string> = {
      US: '#8B5CF6',
      EMEA: '#3B82F6',
      ROW: '#10B981',
    };
    let cumulative = 0;
    const segments = Object.entries(map).map(([region, amount]) => {
      const start = total > 0 ? cumulative / total : 0;
      cumulative += amount;
      const end = total > 0 ? cumulative / total : 0;
      return { region, amount, pct: total > 0 ? amount / total : 0, start, end, color: colors[region] || '#6B7280' };
    });
    return { segments, total };
  }, [activities]);

  // ── Status pipeline ─────────────────────────────────

  const statusPipeline = useMemo(() => {
    const statusNames: Array<'Considering' | 'Negotiating' | 'Committed'> = [
      'Considering',
      'Negotiating',
      'Committed',
    ];
    const defaultColors: Record<string, string> = {
      Considering: '#3B82F6',
      Negotiating: '#F59E0B',
      Committed: '#10B981',
    };

    return statusNames.map((name) => {
      const matching = activities.filter((a) => a.status === name);
      const matchedStatus = statuses.find((s) => s.name === name);
      return {
        name,
        count: matching.length,
        cost: matching.reduce((s, a) => s + num(a.actualCost), 0),
        color: matchedStatus?.color ?? defaultColors[name] ?? '#6B7280',
      };
    });
  }, [activities, statuses]);

  const statusTotal = statusPipeline.reduce((s, p) => s + p.cost, 0);

  // ── Alerts ──────────────────────────────────────────

  const alerts = useMemo(() => {
    const items: Array<{ type: 'warning' | 'error'; message: string }> = [];
    const today = new Date().toISOString().split('T')[0];

    for (const a of activities) {
      const planned = num(a.cost);
      const actual = num(a.actualCost);
      if (planned > 0 && actual > planned * 1.1) {
        items.push({
          type: 'error',
          message: `"${a.title}" is over budget: ${formatCurrency(actual)} actual vs ${formatCurrency(planned)} planned`,
        });
      }
      if (a.endDate < today && num(a.actualSaos) === 0) {
        items.push({
          type: 'warning',
          message: `"${a.title}" is past end date (${a.endDate}) with 0 actual SAOs`,
        });
      }
    }

    for (const row of campaignRows) {
      if (row.budget > 0 && row.actual > row.budget) {
        items.push({
          type: 'error',
          message: `Campaign "${row.name}" is over budget: ${formatCurrency(row.actual)} spent of ${formatCurrency(row.budget)}`,
        });
      }
    }

    return items;
  }, [activities, campaignRows]);

  // ── Bar chart scale ─────────────────────────────────

  const barMax = useMemo(() => {
    let max = 0;
    for (const r of campaignRows) {
      max = Math.max(max, r.budget, r.planned, r.actual);
    }
    return max || 1;
  }, [campaignRows]);

  // ── Sort handler ────────────────────────────────────

  function handleSort(field: SortField) {
    if (sortField === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  }

  function SortHeader({ field, children }: { field: SortField; children: React.ReactNode }) {
    const active = sortField === field;
    return (
      <th
        className="px-3 py-2 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide cursor-pointer hover:text-foreground select-none"
        onClick={() => handleSort(field)}
      >
        <span className="inline-flex items-center gap-1">
          {children}
          {active && <span>{sortDir === 'asc' ? '\u25B2' : '\u25BC'}</span>}
        </span>
      </th>
    );
  }

  // ── Donut gradient ──────────────────────────────────

  const donutGradient = useMemo(() => {
    if (regionData.total === 0) return 'conic-gradient(#374151 0deg 360deg)';
    const stops = regionData.segments
      .map((s) => `${s.color} ${(s.start * 360).toFixed(1)}deg ${(s.end * 360).toFixed(1)}deg`)
      .join(', ');
    return `conic-gradient(${stops})`;
  }, [regionData]);

  // ── Render ──────────────────────────────────────────

  return (
    <div className="p-4 space-y-6 max-w-[1400px] mx-auto">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <KpiCard
          icon={'\uD83D\uDCB0'}
          label="Total Budget"
          value={formatCurrency(metrics.totalBudget)}
          trend={null}
        />
        <KpiCard
          icon={'\uD83D\uDCCB'}
          label="Planned Cost"
          value={formatCurrency(metrics.totalPlanned)}
          sub={`${pct(metrics.totalBudget > 0 ? metrics.totalPlanned / metrics.totalBudget : 0)} of budget`}
        />
        <KpiCard
          icon={'\uD83D\uDCB3'}
          label="Actual Cost"
          value={formatCurrency(metrics.totalActual)}
          trend={
            metrics.totalPlanned > 0
              ? {
                  label: `${pct(metrics.totalActual / metrics.totalPlanned)} of planned`,
                  positive: metrics.totalActual <= metrics.totalPlanned,
                }
              : null
          }
        />
        <KpiCard
          icon={'\uD83D\uDCC8'}
          label="Budget Utilization"
          value={pct(metrics.budgetUtil)}
          trend={{
            label: metrics.budgetUtil > 1 ? 'Over budget' : 'Within budget',
            positive: metrics.budgetUtil <= 1,
          }}
        />
        <KpiCard
          icon={'\uD83C\uDFAF'}
          label="SAOs"
          value={fmtCompact(metrics.totalActualSaos)}
          sub={`${fmtCompact(metrics.totalExpectedSaos)} expected`}
          trend={
            metrics.totalExpectedSaos > 0
              ? {
                  label: pct(metrics.totalActualSaos / metrics.totalExpectedSaos),
                  positive: metrics.totalActualSaos >= metrics.totalExpectedSaos,
                }
              : null
          }
        />
        <KpiCard
          icon={'\uD83D\uDE80'}
          label="Pipeline ROI"
          value={`${metrics.pipelineRoi.toFixed(1)}x`}
          sub={`${formatCurrency(metrics.totalPipeline)} pipeline`}
          trend={{
            label: metrics.pipelineRoi >= 3 ? 'Strong' : metrics.pipelineRoi >= 1 ? 'Moderate' : 'Low',
            positive: metrics.pipelineRoi >= 1,
          }}
        />
      </div>

      {/* Middle row: Budget by Campaign + Region Donut + Status Pipeline */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Budget by Campaign */}
        <div className="lg:col-span-2 bg-card border border-card-border rounded-lg p-4">
          <h3 className="text-sm font-semibold text-foreground mb-3">Budget by Campaign</h3>
          <div className="space-y-3">
            {campaignRows.map((row) => (
              <div key={row.name} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-foreground font-medium truncate max-w-[200px]">
                    {row.name}
                  </span>
                  <span className="text-muted-foreground">
                    {formatCurrency(row.actual)} / {formatCurrency(row.budget || row.planned)}
                    {row.budget > 0 && (
                      <span
                        className={`ml-2 ${row.variance >= 0 ? 'text-green-500' : 'text-red-500'}`}
                      >
                        {row.variance >= 0 ? '+' : ''}
                        {formatCurrency(row.variance)} remaining
                      </span>
                    )}
                  </span>
                </div>
                <div className="relative h-5 bg-muted rounded overflow-hidden">
                  {row.budget > 0 && (
                    <div
                      className="absolute inset-y-0 left-0 bg-purple-500/20 rounded"
                      style={{ width: `${Math.min((row.budget / barMax) * 100, 100)}%` }}
                    />
                  )}
                  <div
                    className="absolute inset-y-0 left-0 bg-blue-500/50 rounded"
                    style={{ width: `${Math.min((row.planned / barMax) * 100, 100)}%` }}
                  />
                  <div
                    className="absolute inset-y-0 left-0 bg-accent-purple rounded"
                    style={{ width: `${Math.min((row.actual / barMax) * 100, 100)}%`, maxWidth: '100%' }}
                  />
                </div>
              </div>
            ))}
            <div className="flex items-center gap-4 text-[10px] text-muted-foreground mt-2">
              <span className="flex items-center gap-1">
                <span className="inline-block w-3 h-2 rounded bg-purple-500/20" /> Budget
              </span>
              <span className="flex items-center gap-1">
                <span className="inline-block w-3 h-2 rounded bg-blue-500/50" /> Planned
              </span>
              <span className="flex items-center gap-1">
                <span className="inline-block w-3 h-2 rounded bg-accent-purple" /> Actual
              </span>
            </div>
          </div>
        </div>

        {/* Region Donut + Status Pipeline stacked */}
        <div className="space-y-4">
          {/* Spend by Region */}
          <div className="bg-card border border-card-border rounded-lg p-4">
            <h3 className="text-sm font-semibold text-foreground mb-3">Spend by Region</h3>
            <div className="flex items-center gap-4">
              <div
                className="w-24 h-24 rounded-full flex-shrink-0"
                style={{
                  background: donutGradient,
                  mask: 'radial-gradient(circle at center, transparent 40%, black 41%)',
                  WebkitMask: 'radial-gradient(circle at center, transparent 40%, black 41%)',
                }}
              />
              <div className="space-y-2 text-xs min-w-0">
                {regionData.segments.map((s) => (
                  <div key={s.region} className="flex items-center gap-2">
                    <span
                      className="inline-block w-2.5 h-2.5 rounded-full flex-shrink-0"
                      style={{ backgroundColor: s.color }}
                    />
                    <span className="text-foreground font-medium">{s.region}</span>
                    <span className="text-muted-foreground">
                      {formatCurrency(s.amount)} ({pct(s.pct)})
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Status Pipeline */}
          <div className="bg-card border border-card-border rounded-lg p-4">
            <h3 className="text-sm font-semibold text-foreground mb-3">Status Pipeline</h3>
            {/* Stacked bar */}
            <div className="h-6 rounded overflow-hidden flex bg-muted mb-3">
              {statusPipeline.map((sp) =>
                sp.cost > 0 ? (
                  <div
                    key={sp.name}
                    className="h-full transition-all"
                    style={{
                      width: `${(sp.cost / (statusTotal || 1)) * 100}%`,
                      backgroundColor: sp.color,
                    }}
                    title={`${sp.name}: ${formatCurrency(sp.cost)}`}
                  />
                ) : null,
              )}
            </div>
            <div className="space-y-1.5">
              {statusPipeline.map((sp) => (
                <div key={sp.name} className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-2">
                    <span
                      className="inline-block w-2.5 h-2.5 rounded-full"
                      style={{ backgroundColor: sp.color }}
                    />
                    <span className="text-foreground">{sp.name}</span>
                  </span>
                  <span className="text-muted-foreground">
                    {sp.count} activities &middot; {formatCurrency(sp.cost)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Campaign Performance Table */}
      <div className="bg-card border border-card-border rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-card-border">
          <h3 className="text-sm font-semibold text-foreground">Campaign Performance</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <SortHeader field="name">Campaign</SortHeader>
                <SortHeader field="budget">Budget</SortHeader>
                <SortHeader field="planned">Planned</SortHeader>
                <SortHeader field="actual">Actual</SortHeader>
                <SortHeader field="variance">Variance</SortHeader>
                <SortHeader field="expectedSaos">Exp. SAOs</SortHeader>
                <SortHeader field="actualSaos">Act. SAOs</SortHeader>
                <SortHeader field="pipeline">Pipeline</SortHeader>
                <SortHeader field="roi">ROI</SortHeader>
              </tr>
            </thead>
            <tbody className="divide-y divide-card-border">
              {sortedRows.map((row) => (
                <tr key={row.name} className="hover:bg-muted/30 transition-colors">
                  <td className="px-3 py-2 text-foreground font-medium truncate max-w-[180px]">
                    {row.name}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground tabular-nums">
                    {formatCurrency(row.budget)}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground tabular-nums">
                    {formatCurrency(row.planned)}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground tabular-nums">
                    {formatCurrency(row.actual)}
                  </td>
                  <td
                    className={`px-3 py-2 tabular-nums font-medium ${row.variance >= 0 ? 'text-green-500' : 'text-red-500'}`}
                  >
                    {row.variance >= 0 ? '+' : ''}
                    {formatCurrency(row.variance)}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground tabular-nums">
                    {row.expectedSaos}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground tabular-nums">
                    {row.actualSaos}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground tabular-nums">
                    {formatCurrency(row.pipeline)}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground tabular-nums">
                    {row.roi.toFixed(1)}x
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-muted/50 font-semibold">
              <tr>
                <td className="px-3 py-2 text-foreground">Total</td>
                <td className="px-3 py-2 text-foreground tabular-nums">
                  {formatCurrency(metrics.totalBudget)}
                </td>
                <td className="px-3 py-2 text-foreground tabular-nums">
                  {formatCurrency(metrics.totalPlanned)}
                </td>
                <td className="px-3 py-2 text-foreground tabular-nums">
                  {formatCurrency(metrics.totalActual)}
                </td>
                <td
                  className={`px-3 py-2 tabular-nums ${metrics.totalBudget - metrics.totalActual >= 0 ? 'text-green-500' : 'text-red-500'}`}
                >
                  {metrics.totalBudget - metrics.totalActual >= 0 ? '+' : ''}
                  {formatCurrency(metrics.totalBudget - metrics.totalActual)}
                </td>
                <td className="px-3 py-2 text-foreground tabular-nums">
                  {metrics.totalExpectedSaos}
                </td>
                <td className="px-3 py-2 text-foreground tabular-nums">
                  {metrics.totalActualSaos}
                </td>
                <td className="px-3 py-2 text-foreground tabular-nums">
                  {formatCurrency(metrics.totalPipeline)}
                </td>
                <td className="px-3 py-2 text-foreground tabular-nums">
                  {metrics.pipelineRoi.toFixed(1)}x
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Activities Needing Attention */}
      {alerts.length > 0 && (
        <div className="bg-card border border-card-border rounded-lg p-4">
          <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
            <span className="text-amber-500">{'\u26A0'}</span>
            Activities Needing Attention
            <span className="text-xs font-normal text-muted-foreground">({alerts.length})</span>
          </h3>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {alerts.map((alert, i) => (
              <div
                key={i}
                className={`flex items-start gap-2 text-xs p-2 rounded ${
                  alert.type === 'error'
                    ? 'bg-red-500/10 text-red-400'
                    : 'bg-amber-500/10 text-amber-400'
                }`}
              >
                <span className="flex-shrink-0 mt-0.5">
                  {alert.type === 'error' ? '\u2716' : '\u25CF'}
                </span>
                <span>{alert.message}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
