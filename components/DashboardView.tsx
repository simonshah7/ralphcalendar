'use client';

import { useMemo, useState, useRef, useEffect } from 'react';
import { Activity, Campaign, Swimlane, Status } from '@/db/schema';
import { formatCurrency } from '@/lib/utils';
import { EventComparisonView } from './EventComparisonView';

interface DashboardViewProps {
  activities: Activity[];
  campaigns: Campaign[];
  swimlanes: Swimlane[];
  statuses: Status[];
  calendarId?: string;
}

type DashboardTab = 'overview' | 'yoy-comparison';

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

// ─── SVG Icons (clean, flat style) ──────────────────────

function IconDollar({ className }: { className?: string }) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M8 1v14M11 4.5C11 3.12 9.66 2 8 2S5 3.12 5 4.5 6.34 7 8 7s3 1.12 3 2.5S9.66 12 8 12s-3-1.12-3-2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function IconClipboard({ className }: { className?: string }) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="3" y="2" width="10" height="12" rx="1.5" stroke="currentColor" strokeWidth="1.5"/>
      <path d="M6 2V1.5A.5.5 0 016.5 1h3a.5.5 0 01.5.5V2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      <path d="M5.5 6h5M5.5 8.5h5M5.5 11h3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  );
}

function IconReceipt({ className }: { className?: string }) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M3 2.5A.5.5 0 013.5 2h9a.5.5 0 01.5.5V14l-2-1.5L9 14l-2-1.5L5 14l-2-1.5V2.5z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
      <path d="M5.5 5.5h5M5.5 8h3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  );
}

function IconGauge({ className }: { className?: string }) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M8 14A6 6 0 118 2a6 6 0 010 12z" stroke="currentColor" strokeWidth="1.5"/>
      <path d="M8 5v3l2 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function IconTarget({ className }: { className?: string }) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.5"/>
      <circle cx="8" cy="8" r="3" stroke="currentColor" strokeWidth="1.5"/>
      <circle cx="8" cy="8" r="0.75" fill="currentColor"/>
    </svg>
  );
}

function IconTrendUp({ className }: { className?: string }) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M2 12l4-4 2.5 2.5L14 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M10 4h4v4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function IconChevronUp({ className }: { className?: string }) {
  return (
    <svg className={className} width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M3 7.5l3-3 3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function IconChevronDown({ className }: { className?: string }) {
  return (
    <svg className={className} width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M3 4.5l3 3 3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function IconColumns({ className }: { className?: string }) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="2" y="2" width="4" height="12" rx="1" stroke="currentColor" strokeWidth="1.5"/>
      <rect x="10" y="2" width="4" height="12" rx="1" stroke="currentColor" strokeWidth="1.5"/>
    </svg>
  );
}

function IconAlertTriangle({ className }: { className?: string }) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M7.134 2.5a1 1 0 011.732 0l5.196 9A1 1 0 0113.196 13H2.804a1 1 0 01-.866-1.5l5.196-9z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
      <path d="M8 6v3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      <circle cx="8" cy="11" r="0.5" fill="currentColor"/>
    </svg>
  );
}

function IconAlertCircle({ className }: { className?: string }) {
  return (
    <svg className={className} width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.5"/>
      <path d="M7 4.5v3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      <circle cx="7" cy="9.5" r="0.5" fill="currentColor"/>
    </svg>
  );
}

function IconX({ className }: { className?: string }) {
  return (
    <svg className={className} width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.5"/>
      <path d="M5 5l4 4M9 5l-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  );
}

function IconCheck({ className }: { className?: string }) {
  return (
    <svg className={className} width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M2.5 6l2.5 2.5 4.5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

// ─── KPI Card ───────────────────────────────────────────

const kpiColors: Record<string, { bg: string; text: string; bgColor: string; textColor: string }> = {
  'Total Budget': { bg: '', text: '', bgColor: 'rgba(0,97,112,0.1)', textColor: '#006170' },
  'Planned Cost': { bg: '', text: '', bgColor: 'rgba(59,83,255,0.1)', textColor: '#3B53FF' },
  'Actual Cost': { bg: '', text: '', bgColor: 'rgba(122,0,193,0.1)', textColor: '#7A00C1' },
  'Budget Utilization': { bg: '', text: '', bgColor: 'rgba(255,169,67,0.1)', textColor: '#FFA943' },
  'SAOs': { bg: '', text: '', bgColor: 'rgba(255,113,90,0.1)', textColor: '#FF715A' },
  'Pipeline ROI': { bg: '', text: '', bgColor: 'rgba(52,229,226,0.1)', textColor: '#34E5E2' },
};

function KpiCard({
  icon,
  label,
  value,
  sub,
  trend,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  trend?: { label: string; positive: boolean } | null;
}) {
  const colors = kpiColors[label] || { bg: 'bg-muted', text: 'text-muted-foreground', bgColor: '', textColor: '' };
  return (
    <div className="bg-card border border-card-border rounded-lg p-3 sm:p-4 flex flex-col gap-1 sm:gap-1.5 min-w-0">
      <div className="flex items-center gap-2.5 text-muted-foreground text-xs font-medium uppercase tracking-wide">
        <span
          className="inline-flex items-center justify-center w-7 h-7 rounded-md"
          style={colors.bgColor ? { backgroundColor: colors.bgColor, color: colors.textColor } : undefined}
        >
          {icon}
        </span>
        <span className="truncate">{label}</span>
      </div>
      <div className="text-lg sm:text-2xl font-bold text-foreground truncate">{value}</div>
      {sub && <div className="text-xs text-muted-foreground truncate">{sub}</div>}
      {trend && (
        <div
          className={`text-xs font-medium flex items-center gap-1 ${trend.positive ? 'text-green-500' : 'text-red-500'}`}
        >
          {trend.positive ? <IconChevronUp className="w-3 h-3" /> : <IconChevronDown className="w-3 h-3" />}
          {trend.label}
        </div>
      )}
    </div>
  );
}

// ─── Column Visibility Dropdown ─────────────────────────

const ALL_COLUMNS: { field: SortField; label: string }[] = [
  { field: 'name', label: 'Campaign' },
  { field: 'budget', label: 'Budget' },
  { field: 'planned', label: 'Planned' },
  { field: 'actual', label: 'Actual' },
  { field: 'variance', label: 'Variance' },
  { field: 'expectedSaos', label: 'Exp. SAOs' },
  { field: 'actualSaos', label: 'Act. SAOs' },
  { field: 'pipeline', label: 'Pipeline' },
  { field: 'roi', label: 'ROI' },
];

function ColumnToggle({
  visibleColumns,
  onToggle,
}: {
  visibleColumns: Set<SortField>;
  onToggle: (field: SortField) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground border border-card-border rounded-md hover:bg-muted/50 transition-colors"
      >
        <IconColumns className="w-3.5 h-3.5" />
        Columns
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 w-44 bg-card border border-card-border rounded-lg shadow-lg z-20 py-1">
          {ALL_COLUMNS.map((col) => {
            const visible = visibleColumns.has(col.field);
            const isName = col.field === 'name';
            return (
              <button
                key={col.field}
                onClick={() => { if (!isName) onToggle(col.field); }}
                disabled={isName}
                className={`w-full flex items-center gap-2 px-3 py-1.5 text-xs text-left transition-colors ${
                  isName
                    ? 'text-muted-foreground/50 cursor-default'
                    : 'text-foreground hover:bg-muted/50 cursor-pointer'
                }`}
              >
                <span className={`inline-flex items-center justify-center w-4 h-4 rounded border ${
                  visible
                    ? 'bg-accent-purple border-accent-purple text-white'
                    : 'border-card-border'
                }`}>
                  {visible && <IconCheck className="w-3 h-3" />}
                </span>
                {col.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────

export function DashboardView({ activities, campaigns, swimlanes, statuses, calendarId }: DashboardViewProps) {
  const [dashboardTab, setDashboardTab] = useState<DashboardTab>('overview');
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [visibleColumns, setVisibleColumns] = useState<Set<SortField>>(
    () => new Set(ALL_COLUMNS.map((c) => c.field)),
  );

  function toggleColumn(field: SortField) {
    setVisibleColumns((prev) => {
      const next = new Set(prev);
      if (next.has(field)) {
        next.delete(field);
        if (sortField === field) {
          setSortField('name');
          setSortDir('asc');
        }
      } else {
        next.add(field);
      }
      return next;
    });
  }

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
      US: '#7A00C1',
      EMEA: '#3B53FF',
      ROW: '#006170',
    };
    let cumulative = 0;
    const segments = Object.entries(map).map(([region, amount]) => {
      const start = total > 0 ? cumulative / total : 0;
      cumulative += amount;
      const end = total > 0 ? cumulative / total : 0;
      return { region, amount, pct: total > 0 ? amount / total : 0, start, end, color: colors[region] || '#D6E4EA' };
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
      Considering: '#3B53FF',
      Negotiating: '#FFA943',
      Committed: '#006170',
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

  function SortHeader({ field, children, align }: { field: SortField; children: React.ReactNode; align?: 'left' | 'right' }) {
    if (!visibleColumns.has(field)) return null;
    const active = sortField === field;
    const textAlign = align === 'right' ? 'text-right' : 'text-left';
    return (
      <th
        className={`px-3 py-2.5 ${textAlign} text-xs font-medium text-muted-foreground uppercase tracking-wide cursor-pointer hover:text-foreground select-none whitespace-nowrap`}
        onClick={() => handleSort(field)}
      >
        <span className={`inline-flex items-center gap-1 ${align === 'right' ? 'justify-end' : ''}`}>
          {children}
          <span className={`inline-flex flex-col -space-y-1 ${active ? '' : 'opacity-0 group-hover:opacity-30'}`}>
            {active ? (
              sortDir === 'asc' ? <IconChevronUp className="w-3 h-3" /> : <IconChevronDown className="w-3 h-3" />
            ) : null}
          </span>
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

  // helper to check column visibility for table cells
  const col = (field: SortField) => visibleColumns.has(field);

  // ── Render ──────────────────────────────────────────

  return (
    <div className="p-3 sm:p-4 space-y-4 sm:space-y-6 max-w-[1400px] mx-auto overflow-y-auto">
      {/* Tab Switcher */}
      <div className="flex items-center gap-1 border-b border-card-border pb-0">
        <button
          onClick={() => setDashboardTab('overview')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-[1px] ${
            dashboardTab === 'overview'
              ? 'border-accent text-foreground'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          Overview
        </button>
        <button
          onClick={() => setDashboardTab('yoy-comparison')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-[1px] ${
            dashboardTab === 'yoy-comparison'
              ? 'border-accent text-foreground'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          YoY Event Comparison
        </button>
      </div>

      {/* YoY Comparison Tab */}
      {dashboardTab === 'yoy-comparison' && calendarId && (
        <EventComparisonView calendarId={calendarId} />
      )}
      {dashboardTab === 'yoy-comparison' && !calendarId && (
        <div className="text-center py-12 text-muted-foreground text-sm">
          Calendar context required for event comparison.
        </div>
      )}

      {/* Overview Tab */}
      {dashboardTab === 'overview' && <>
      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <KpiCard
          icon={<IconDollar />}
          label="Total Budget"
          value={formatCurrency(metrics.totalBudget)}
          trend={null}
        />
        <KpiCard
          icon={<IconClipboard />}
          label="Planned Cost"
          value={formatCurrency(metrics.totalPlanned)}
          sub={`${pct(metrics.totalBudget > 0 ? metrics.totalPlanned / metrics.totalBudget : 0)} of budget`}
        />
        <KpiCard
          icon={<IconReceipt />}
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
          icon={<IconGauge />}
          label="Budget Utilization"
          value={pct(metrics.budgetUtil)}
          trend={{
            label: metrics.budgetUtil > 1 ? 'Over budget' : 'Within budget',
            positive: metrics.budgetUtil <= 1,
          }}
        />
        <KpiCard
          icon={<IconTarget />}
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
          icon={<IconTrendUp />}
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
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 sm:gap-4">
        {/* Budget by Campaign */}
        <div className="lg:col-span-2 bg-card border border-card-border rounded-lg p-3 sm:p-4">
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
            <div className="h-6 rounded-md overflow-hidden flex bg-muted mb-3">
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
        <div className="px-3 sm:px-4 py-3 border-b border-card-border flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground">Campaign Performance</h3>
          <ColumnToggle visibleColumns={visibleColumns} onToggle={toggleColumn} />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <SortHeader field="name">Campaign</SortHeader>
                <SortHeader field="budget" align="right">Budget</SortHeader>
                <SortHeader field="planned" align="right">Planned</SortHeader>
                <SortHeader field="actual" align="right">Actual</SortHeader>
                <SortHeader field="variance" align="right">Variance</SortHeader>
                <SortHeader field="expectedSaos" align="right">Exp. SAOs</SortHeader>
                <SortHeader field="actualSaos" align="right">Act. SAOs</SortHeader>
                <SortHeader field="pipeline" align="right">Pipeline</SortHeader>
                <SortHeader field="roi" align="right">ROI</SortHeader>
              </tr>
            </thead>
            <tbody className="divide-y divide-card-border">
              {sortedRows.map((row, idx) => (
                <tr key={row.name} className={`hover:bg-muted/30 transition-colors ${idx % 2 === 1 ? 'bg-muted/15' : ''}`}>
                  {col('name') && (
                    <td className="px-3 py-2.5 text-foreground font-medium truncate max-w-[180px]">
                      {row.name}
                    </td>
                  )}
                  {col('budget') && (
                    <td className="px-3 py-2.5 text-right text-muted-foreground tabular-nums">
                      {formatCurrency(row.budget)}
                    </td>
                  )}
                  {col('planned') && (
                    <td className="px-3 py-2.5 text-right text-muted-foreground tabular-nums">
                      {formatCurrency(row.planned)}
                    </td>
                  )}
                  {col('actual') && (
                    <td className="px-3 py-2.5 text-right text-muted-foreground tabular-nums">
                      {formatCurrency(row.actual)}
                    </td>
                  )}
                  {col('variance') && (
                    <td
                      className={`px-3 py-2.5 text-right tabular-nums font-medium ${row.variance >= 0 ? 'text-green-500' : 'text-red-500'}`}
                    >
                      {row.variance >= 0 ? '+' : ''}
                      {formatCurrency(row.variance)}
                    </td>
                  )}
                  {col('expectedSaos') && (
                    <td className="px-3 py-2.5 text-right text-muted-foreground tabular-nums">
                      {row.expectedSaos}
                    </td>
                  )}
                  {col('actualSaos') && (
                    <td className="px-3 py-2.5 text-right text-muted-foreground tabular-nums">
                      {row.actualSaos}
                    </td>
                  )}
                  {col('pipeline') && (
                    <td className="px-3 py-2.5 text-right text-muted-foreground tabular-nums">
                      {formatCurrency(row.pipeline)}
                    </td>
                  )}
                  {col('roi') && (
                    <td className="px-3 py-2.5 text-right text-muted-foreground tabular-nums">
                      {row.roi.toFixed(1)}x
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-muted/50 font-semibold">
              <tr>
                {col('name') && <td className="px-3 py-2.5 text-foreground">Total</td>}
                {col('budget') && (
                  <td className="px-3 py-2.5 text-right text-foreground tabular-nums">
                    {formatCurrency(metrics.totalBudget)}
                  </td>
                )}
                {col('planned') && (
                  <td className="px-3 py-2.5 text-right text-foreground tabular-nums">
                    {formatCurrency(metrics.totalPlanned)}
                  </td>
                )}
                {col('actual') && (
                  <td className="px-3 py-2.5 text-right text-foreground tabular-nums">
                    {formatCurrency(metrics.totalActual)}
                  </td>
                )}
                {col('variance') && (
                  <td
                    className={`px-3 py-2.5 text-right tabular-nums ${metrics.totalBudget - metrics.totalActual >= 0 ? 'text-green-500' : 'text-red-500'}`}
                  >
                    {metrics.totalBudget - metrics.totalActual >= 0 ? '+' : ''}
                    {formatCurrency(metrics.totalBudget - metrics.totalActual)}
                  </td>
                )}
                {col('expectedSaos') && (
                  <td className="px-3 py-2.5 text-right text-foreground tabular-nums">
                    {metrics.totalExpectedSaos}
                  </td>
                )}
                {col('actualSaos') && (
                  <td className="px-3 py-2.5 text-right text-foreground tabular-nums">
                    {metrics.totalActualSaos}
                  </td>
                )}
                {col('pipeline') && (
                  <td className="px-3 py-2.5 text-right text-foreground tabular-nums">
                    {formatCurrency(metrics.totalPipeline)}
                  </td>
                )}
                {col('roi') && (
                  <td className="px-3 py-2.5 text-right text-foreground tabular-nums">
                    {metrics.pipelineRoi.toFixed(1)}x
                  </td>
                )}
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Activities Needing Attention */}
      {alerts.length > 0 && (
        <div className="bg-card border border-card-border rounded-lg p-4">
          <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
            <IconAlertTriangle className="w-4 h-4 text-amber-500" />
            Activities Needing Attention
            <span className="text-xs font-normal text-muted-foreground">({alerts.length})</span>
          </h3>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {alerts.map((alert, i) => (
              <div
                key={i}
                className={`flex items-start gap-2 text-xs p-2.5 rounded-md ${
                  alert.type === 'error'
                    ? 'bg-red-500/10 text-red-400'
                    : 'bg-amber-500/10 text-amber-400'
                }`}
              >
                <span className="flex-shrink-0 mt-0.5">
                  {alert.type === 'error' ? <IconX className="w-3.5 h-3.5" /> : <IconAlertCircle className="w-3.5 h-3.5" />}
                </span>
                <span>{alert.message}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      </>}
    </div>
  );
}
