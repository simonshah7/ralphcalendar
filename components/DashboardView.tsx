'use client';

import { useMemo, useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Activity, Campaign, Swimlane, Status } from '@/db/schema';
import { formatCurrency } from '@/lib/utils';
import { EventComparisonView } from './EventComparisonView';
import { CampaignReportingDashboard } from './CampaignReportingDashboard';
import {
  SolarDollarCircle,
  SolarClipboardLinear,
  SolarDocumentLinear,
  SolarClockCircle,
  SolarTargetLinear,
  SolarGraphUpLinear,
  SolarAltArrowUp,
  SolarAltArrowDown,
  SolarColumnsLinear,
  SolarDangerTriangle,
  SolarDangerCircle,
  SolarCloseCircle,
  SolarCheckLinear,
  SolarInfoCircle,
  SolarCloseLinear,
  SolarCheckCircle,
} from './SolarIcons';

interface DashboardViewProps {
  activities: Activity[];
  campaigns: Campaign[];
  swimlanes: Swimlane[];
  statuses: Status[];
  calendarId?: string;
}

type DashboardTab = 'overview' | 'campaign-reporting' | 'yoy-comparison';

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

// ── Generate mock mini-chart data based on a final value and a pattern ──

function generateTrendData(finalValue: number, pattern: 'rising' | 'fluctuating' | 'steady', points: number = 6): number[] {
  const data: number[] = [];
  const base = finalValue * 0.5;
  for (let i = 0; i < points; i++) {
    const t = i / (points - 1);
    switch (pattern) {
      case 'rising':
        data.push(base + (finalValue - base) * t + (Math.sin(i * 1.5) * finalValue * 0.05));
        break;
      case 'fluctuating':
        data.push(finalValue * (0.6 + 0.4 * Math.sin(i * 1.8 + 0.5) * (0.5 + 0.5 * t)));
        break;
      case 'steady':
        data.push(finalValue * (0.85 + 0.15 * Math.sin(i * 0.8)));
        break;
    }
  }
  return data;
}

// ── Mini Area Chart SVG ──

function MiniAreaChart({ data, color, width = 80, height = 28 }: { data: number[]; color: string; width?: number; height?: number }) {
  if (data.length < 2) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const padding = 2;
  const chartW = width - padding * 2;
  const chartH = height - padding * 2;

  const points = data.map((v, i) => ({
    x: padding + (i / (data.length - 1)) * chartW,
    y: padding + chartH - ((v - min) / range) * chartH,
  }));

  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');
  const areaPath = `${linePath} L${points[points.length - 1].x},${height} L${points[0].x},${height} Z`;

  const gradientId = `miniGrad-${color.replace('#', '')}`;

  return (
    <svg width={width} height={height} className="block">
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <motion.path
        d={areaPath}
        fill={`url(#${gradientId})`}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6 }}
      />
      <motion.path
        d={linePath}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.8, ease: 'easeOut' }}
      />
    </svg>
  );
}

// ── Mini Sparkline for table rows ──

function MiniSparkline({ data, color = '#7A00C1', width = 48, height = 16 }: { data: number[]; color?: string; width?: number; height?: number }) {
  if (data.length < 2) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;

  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - ((v - min) / range) * (height - 2) - 1;
    return `${x},${y}`;
  }).join(' ');

  return (
    <svg width={width} height={height} className="inline-block align-middle">
      <motion.polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={{ pathLength: 0, opacity: 0 }}
        animate={{ pathLength: 1, opacity: 1 }}
        transition={{ duration: 0.6 }}
      />
    </svg>
  );
}

// ── Animated Progress Bar ──

function AnimatedProgressBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pctValue = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  return (
    <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden mt-1">
      <motion.div
        className="h-full rounded-full"
        style={{ backgroundColor: color }}
        initial={{ width: 0 }}
        animate={{ width: `${pctValue}%` }}
        transition={{ duration: 0.8, ease: 'easeOut' }}
      />
    </div>
  );
}

// ── Heatmap Row ──

function ActivityHeatmap({ activities }: { activities: Activity[] }) {
  const monthCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    months.forEach(m => { counts[m] = 0; });
    for (const a of activities) {
      if (a.startDate) {
        const monthIdx = new Date(a.startDate).getMonth();
        if (monthIdx >= 0 && monthIdx < 12) {
          counts[months[monthIdx]]++;
        }
      }
    }
    return months.map(m => ({ month: m, count: counts[m] }));
  }, [activities]);

  const maxCount = Math.max(...monthCounts.map(m => m.count), 1);

  return (
    <div className="bg-card border border-card-border rounded-lg p-3 sm:p-4">
      <h3 className="text-sm font-semibold text-foreground mb-2">Activity Density by Month</h3>
      <div className="flex gap-1 items-end">
        {monthCounts.map((m, i) => {
          const intensity = m.count / maxCount;
          const bgOpacity = 0.1 + intensity * 0.8;
          return (
            <motion.div
              key={m.month}
              className="flex-1 flex flex-col items-center gap-1"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03, duration: 0.3 }}
            >
              <div
                className="w-full rounded-sm relative group"
                style={{
                  height: '24px',
                  backgroundColor: `rgba(122, 0, 193, ${bgOpacity})`,
                }}
                title={`${m.month}: ${m.count} activities`}
              >
                <span className="absolute inset-0 flex items-center justify-center text-[9px] font-medium text-white opacity-0 group-hover:opacity-100 transition-opacity">
                  {m.count}
                </span>
              </div>
              <span className="text-[9px] text-muted-foreground">{m.month}</span>
            </motion.div>
          );
        })}
      </div>
      <div className="flex items-center gap-2 mt-2 text-[9px] text-muted-foreground">
        <span>Less</span>
        <div className="flex gap-0.5">
          {[0.15, 0.35, 0.55, 0.75, 0.9].map((opacity, i) => (
            <div
              key={i}
              className="w-3 h-2 rounded-sm"
              style={{ backgroundColor: `rgba(122, 0, 193, ${opacity})` }}
            />
          ))}
        </div>
        <span>More</span>
      </div>
    </div>
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

// Trend data patterns per KPI label
const kpiTrendPatterns: Record<string, 'rising' | 'fluctuating' | 'steady'> = {
  'Total Budget': 'steady',
  'Planned Cost': 'rising',
  'Actual Cost': 'rising',
  'Budget Utilization': 'rising',
  'SAOs': 'fluctuating',
  'Pipeline ROI': 'fluctuating',
};

function KpiCard({
  icon,
  label,
  value,
  sub,
  trend,
  numericValue,
  progressMax,
  showProgress,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  trend?: { label: string; positive: boolean } | null;
  numericValue?: number;
  progressMax?: number;
  showProgress?: boolean;
}) {
  const colors = kpiColors[label] || { bg: 'bg-muted', text: 'text-muted-foreground', bgColor: '', textColor: '' };
  const pattern = kpiTrendPatterns[label] || 'steady';
  const trendData = useMemo(() => generateTrendData(numericValue || 1, pattern), [numericValue, pattern]);

  return (
    <motion.div
      className="bg-card border border-card-border rounded-lg p-3 sm:p-4 flex flex-col gap-1 sm:gap-1.5 min-w-0 cursor-default h-full"
      whileHover={{ scale: 1.03, boxShadow: '0 4px 20px rgba(0,0,0,0.08)' }}
      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
    >
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
      {showProgress && progressMax != null && numericValue != null && (
        <AnimatedProgressBar value={numericValue} max={progressMax} color={colors.textColor || '#7A00C1'} />
      )}
      {sub && <div className="text-xs text-muted-foreground truncate">{sub}</div>}
      {trend && (
        <div
          className={`text-xs font-medium flex items-center gap-1 ${trend.positive ? 'text-green-500' : 'text-red-500'}`}
        >
          {trend.positive ? <SolarAltArrowUp className="w-3 h-3" /> : <SolarAltArrowDown className="w-3 h-3" />}
          {trend.label}
        </div>
      )}
      <div className="mt-auto pt-1">
        <MiniAreaChart data={trendData} color={colors.textColor || '#6B7280'} />
      </div>
    </motion.div>
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
        <SolarColumnsLinear className="w-3.5 h-3.5" />
        Columns
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.95 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            className="absolute right-0 top-full mt-1 w-44 bg-card border border-card-border rounded-lg shadow-lg z-20 py-1"
          >
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
                    {visible && <SolarCheckLinear className="w-3 h-3" />}
                  </span>
                  {col.label}
                </button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────

// ─── AI Insight Card ────────────────────────────────────

interface Insight {
  type: 'warning' | 'opportunity' | 'success';
  title: string;
  description: string;
  metric?: string;
}

function InsightCard({ insight, onDismiss }: { insight: Insight; onDismiss: () => void }) {
  const styles = {
    warning: { bg: 'bg-amber-500/10', border: 'border-amber-500/30', icon: 'text-amber-500', badge: 'bg-amber-500/20 text-amber-400' },
    opportunity: { bg: 'bg-blue-500/10', border: 'border-blue-500/30', icon: 'text-blue-500', badge: 'bg-blue-500/20 text-blue-400' },
    success: { bg: 'bg-green-500/10', border: 'border-green-500/30', icon: 'text-green-500', badge: 'bg-green-500/20 text-green-400' },
  };
  const s = styles[insight.type];
  return (
    <div className={`${s.bg} border ${s.border} rounded-lg p-3 flex items-start gap-3 group`}>
      <span className={`flex-shrink-0 mt-0.5 ${s.icon}`}>
        {insight.type === 'warning' ? <SolarDangerTriangle className="w-4 h-4" /> : insight.type === 'success' ? (
          <SolarCheckCircle className="w-4 h-4" />
        ) : (
          <SolarClockCircle className="w-4 h-4" />
        )}
      </span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="text-xs font-semibold text-foreground">{insight.title}</span>
          {insight.metric && (
            <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${s.badge}`}>{insight.metric}</span>
          )}
        </div>
        <p className="text-[11px] text-muted-foreground leading-relaxed">{insight.description}</p>
      </div>
      <button onClick={onDismiss} className="flex-shrink-0 text-muted-foreground/50 hover:text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity">
        <SolarCloseLinear className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

// ─── Sparkline for KPI cards ────────────────────────────

function KpiSparkline({ data, color, height = 28 }: { data: number[]; color: string; height?: number }) {
  if (data.length < 2) return null;
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = max - min || 1;
  const w = 64;
  const points = data
    .map((v, i) => `${(i / (data.length - 1)) * w},${height - ((v - min) / range) * (height - 4) - 2}`)
    .join(' ');
  const lastY = height - ((data[data.length - 1] - min) / range) * (height - 4) - 2;
  return (
    <svg width={w} height={height} className="inline-block">
      <polyline points={points} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.6" />
      <circle cx={w} cy={lastY} r="2" fill={color} />
    </svg>
  );
}

export function DashboardView({ activities, campaigns, swimlanes, statuses, calendarId }: DashboardViewProps) {
  const [dashboardTab, setDashboardTab] = useState<DashboardTab>('overview');
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [visibleColumns, setVisibleColumns] = useState<Set<SortField>>(
    () => new Set(ALL_COLUMNS.map((c) => c.field)),
  );
  const [hoveredDonutSegment, setHoveredDonutSegment] = useState<string | null>(null);

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

  // ── Generate sparkline data per campaign row ──────────

  const campaignSparklines = useMemo(() => {
    const sparklines: Record<string, number[]> = {};
    for (const row of campaignRows) {
      const base = row.roi;
      sparklines[row.name] = generateTrendData(Math.max(base, 0.5), base > 2 ? 'rising' : 'fluctuating', 8);
    }
    return sparklines;
  }, [campaignRows]);

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
              sortDir === 'asc' ? <SolarAltArrowUp className="w-3 h-3" /> : <SolarAltArrowDown className="w-3 h-3" />
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

  // ── Tab content animation variants ─────────────────

  const tabContentVariants = {
    initial: { opacity: 0, y: 8 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -8 },
  };

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
          onClick={() => setDashboardTab('campaign-reporting')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-[1px] ${
            dashboardTab === 'campaign-reporting'
              ? 'border-accent text-foreground'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          Campaign Reporting
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

      <AnimatePresence mode="wait">
        {/* YoY Comparison Tab */}
        {dashboardTab === 'yoy-comparison' && (
          <motion.div
            key="yoy-comparison"
            variants={tabContentVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={{ duration: 0.25, ease: 'easeInOut' }}
          >
            {calendarId ? (
              <EventComparisonView calendarId={calendarId} />
            ) : (
              <div className="text-center py-12 text-muted-foreground text-sm">
                Calendar context required for event comparison.
              </div>
            )}
          </motion.div>
        )}

        {/* Campaign Reporting Tab */}
        {dashboardTab === 'campaign-reporting' && (
          <motion.div
            key="campaign-reporting"
            variants={tabContentVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={{ duration: 0.25, ease: 'easeInOut' }}
          >
            {calendarId ? (
              <CampaignReportingDashboard calendarId={calendarId} />
            ) : (
              <div className="text-center py-12 text-muted-foreground text-sm">
                Calendar context required for campaign reporting.
              </div>
            )}
          </motion.div>
        )}

        {/* Overview Tab */}
        {dashboardTab === 'overview' && (
          <motion.div
            key="overview"
            variants={tabContentVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={{ duration: 0.25, ease: 'easeInOut' }}
            className="space-y-4 sm:space-y-6"
          >
            {/* KPI summary explanation */}
            <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 px-3 py-2 rounded-lg">
              <SolarInfoCircle className="w-4 h-4 flex-shrink-0" />
              <span>
                <strong>Budget</strong> = sum of campaign budgets.{' '}
                <strong>Planned</strong> = total estimated costs across activities.{' '}
                <strong>Actual</strong> = what you&apos;ve actually spent.{' '}
                <strong>SAOs</strong> = Sales Accepted Opportunities.{' '}
                <strong>Pipeline ROI</strong> = pipeline value divided by actual spend.
              </span>
            </div>

            {/* KPI Cards with staggered entrance */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
              {[
                {
                  icon: <SolarDollarCircle />,
                  label: 'Total Budget',
                  value: formatCurrency(metrics.totalBudget),
                  trend: null,
                  numericValue: metrics.totalBudget,
                },
                {
                  icon: <SolarClipboardLinear />,
                  label: 'Planned Cost',
                  value: formatCurrency(metrics.totalPlanned),
                  sub: `${pct(metrics.totalBudget > 0 ? metrics.totalPlanned / metrics.totalBudget : 0)} of budget`,
                  numericValue: metrics.totalPlanned,
                },
                {
                  icon: <SolarDocumentLinear />,
                  label: 'Actual Cost',
                  value: formatCurrency(metrics.totalActual),
                  trend: metrics.totalPlanned > 0
                    ? {
                        label: `${pct(metrics.totalActual / metrics.totalPlanned)} of planned`,
                        positive: metrics.totalActual <= metrics.totalPlanned,
                      }
                    : null,
                  numericValue: metrics.totalActual,
                },
                {
                  icon: <SolarClockCircle />,
                  label: 'Budget Utilization',
                  value: pct(metrics.budgetUtil),
                  trend: {
                    label: metrics.budgetUtil > 1 ? 'Over budget' : 'Within budget',
                    positive: metrics.budgetUtil <= 1,
                  },
                  numericValue: metrics.budgetUtil,
                  progressMax: 1,
                  showProgress: true,
                },
                {
                  icon: <SolarTargetLinear />,
                  label: 'SAOs',
                  value: fmtCompact(metrics.totalActualSaos),
                  sub: `${fmtCompact(metrics.totalExpectedSaos)} expected`,
                  trend: metrics.totalExpectedSaos > 0
                    ? {
                        label: pct(metrics.totalActualSaos / metrics.totalExpectedSaos),
                        positive: metrics.totalActualSaos >= metrics.totalExpectedSaos,
                      }
                    : null,
                  numericValue: metrics.totalActualSaos,
                  progressMax: metrics.totalExpectedSaos || undefined,
                  showProgress: metrics.totalExpectedSaos > 0,
                },
                {
                  icon: <SolarGraphUpLinear />,
                  label: 'Pipeline ROI',
                  value: `${metrics.pipelineRoi.toFixed(1)}x`,
                  sub: `${formatCurrency(metrics.totalPipeline)} pipeline`,
                  trend: {
                    label: metrics.pipelineRoi >= 3 ? 'Strong' : metrics.pipelineRoi >= 1 ? 'Moderate' : 'Low',
                    positive: metrics.pipelineRoi >= 1,
                  },
                  numericValue: metrics.pipelineRoi,
                },
              ].map((kpi, i) => (
                <motion.div
                  key={kpi.label}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05, duration: 0.35, ease: 'easeOut' }}
                >
                  <KpiCard
                    icon={kpi.icon}
                    label={kpi.label}
                    value={kpi.value}
                    sub={kpi.sub}
                    trend={kpi.trend}
                    numericValue={kpi.numericValue}
                    progressMax={kpi.progressMax}
                    showProgress={kpi.showProgress}
                  />
                </motion.div>
              ))}
            </div>

            {/* Activity Heatmap */}
            <ActivityHeatmap activities={activities} />

            {/* Middle row: Budget by Campaign + Region Donut + Status Pipeline */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 sm:gap-4">
              {/* Budget by Campaign */}
              <div className="lg:col-span-2 bg-card border border-card-border rounded-lg p-3 sm:p-4">
                <h3 className="text-sm font-semibold text-foreground mb-3">Budget by Campaign</h3>
                <div className="space-y-3">
                  {campaignRows.map((row, i) => (
                    <motion.div
                      key={row.name}
                      className="space-y-1"
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.04, duration: 0.3 }}
                    >
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
                        {/* SVG gradient overlay for bar chart */}
                        <svg className="absolute inset-0 w-full h-full" preserveAspectRatio="none">
                          <defs>
                            <linearGradient id={`budgetGrad-${i}`} x1="0" y1="0" x2="1" y2="0">
                              <stop offset="0%" stopColor="#7A00C1" stopOpacity="0.6" />
                              <stop offset="100%" stopColor="#3B53FF" stopOpacity="0.9" />
                            </linearGradient>
                            <linearGradient id={`plannedGrad-${i}`} x1="0" y1="0" x2="1" y2="0">
                              <stop offset="0%" stopColor="#3B53FF" stopOpacity="0.3" />
                              <stop offset="100%" stopColor="#3B53FF" stopOpacity="0.6" />
                            </linearGradient>
                          </defs>
                        </svg>
                        {row.budget > 0 && (
                          <motion.div
                            className="absolute inset-y-0 left-0 rounded"
                            style={{ background: `linear-gradient(90deg, rgba(122,0,193,0.12), rgba(122,0,193,0.22))` }}
                            initial={{ width: 0 }}
                            animate={{ width: `${Math.min((row.budget / barMax) * 100, 100)}%` }}
                            transition={{ duration: 0.6, ease: 'easeOut', delay: i * 0.04 }}
                          />
                        )}
                        <motion.div
                          className="absolute inset-y-0 left-0 rounded"
                          style={{ background: `linear-gradient(90deg, rgba(59,83,255,0.3), rgba(59,83,255,0.55))` }}
                          initial={{ width: 0 }}
                          animate={{ width: `${Math.min((row.planned / barMax) * 100, 100)}%` }}
                          transition={{ duration: 0.6, ease: 'easeOut', delay: i * 0.04 + 0.1 }}
                        />
                        <motion.div
                          className="absolute inset-y-0 left-0 rounded"
                          style={{ background: `linear-gradient(90deg, #7A00C1, #5B21B6)`, maxWidth: '100%' }}
                          initial={{ width: 0 }}
                          animate={{ width: `${Math.min((row.actual / barMax) * 100, 100)}%` }}
                          transition={{ duration: 0.6, ease: 'easeOut', delay: i * 0.04 + 0.2 }}
                        />
                      </div>
                    </motion.div>
                  ))}
                  <div className="flex items-center gap-4 text-[10px] text-muted-foreground mt-2">
                    <span className="flex items-center gap-1">
                      <span className="inline-block w-3 h-2 rounded" style={{ background: 'linear-gradient(90deg, rgba(122,0,193,0.12), rgba(122,0,193,0.22))' }} /> Budget
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="inline-block w-3 h-2 rounded" style={{ background: 'linear-gradient(90deg, rgba(59,83,255,0.3), rgba(59,83,255,0.55))' }} /> Planned
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="inline-block w-3 h-2 rounded" style={{ background: 'linear-gradient(90deg, #7A00C1, #5B21B6)' }} /> Actual
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
                    <div className="relative w-24 h-24 flex-shrink-0">
                      <motion.div
                        className="w-24 h-24 rounded-full"
                        style={{
                          background: donutGradient,
                          mask: 'radial-gradient(circle at center, transparent 40%, black 41%)',
                          WebkitMask: 'radial-gradient(circle at center, transparent 40%, black 41%)',
                        }}
                        initial={{ rotate: -90, opacity: 0 }}
                        animate={{ rotate: 0, opacity: 1 }}
                        transition={{ duration: 0.7, ease: 'easeOut' }}
                      />
                      {/* Center total */}
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-[10px] font-bold text-foreground leading-tight text-center">
                          {fmtCompact(regionData.total)}
                        </span>
                      </div>
                      {/* Invisible hover segments for tooltips */}
                      {regionData.segments.map((s) => {
                        const midAngle = ((s.start + s.end) / 2) * 360 * (Math.PI / 180);
                        const tooltipX = 48 + Math.cos(midAngle - Math.PI / 2) * 30;
                        const tooltipY = 48 + Math.sin(midAngle - Math.PI / 2) * 30;
                        return (
                          <div
                            key={s.region}
                            className="absolute"
                            style={{ left: tooltipX - 12, top: tooltipY - 12, width: 24, height: 24 }}
                            onMouseEnter={() => setHoveredDonutSegment(s.region)}
                            onMouseLeave={() => setHoveredDonutSegment(null)}
                          >
                            {hoveredDonutSegment === s.region && (
                              <motion.div
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                className="absolute -top-8 left-1/2 -translate-x-1/2 bg-foreground text-background text-[9px] px-2 py-1 rounded shadow-lg whitespace-nowrap z-30 pointer-events-none"
                              >
                                {s.region}: {formatCurrency(s.amount)} ({pct(s.pct)})
                              </motion.div>
                            )}
                          </div>
                        );
                      })}
                    </div>
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
                    {statusPipeline.map((sp) => {
                      const widthPct = (sp.cost / (statusTotal || 1)) * 100;
                      return sp.cost > 0 ? (
                        <motion.div
                          key={sp.name}
                          className="h-full relative flex items-center justify-center overflow-hidden"
                          style={{ backgroundColor: sp.color }}
                          initial={{ width: 0 }}
                          animate={{ width: `${widthPct}%` }}
                          transition={{ duration: 0.6, ease: 'easeOut' }}
                          title={`${sp.name}: ${formatCurrency(sp.cost)}`}
                        >
                          {widthPct > 12 && (
                            <span className="text-[9px] font-bold text-white/90 truncate px-1">
                              {widthPct.toFixed(0)}%
                            </span>
                          )}
                        </motion.div>
                      ) : null;
                    })}
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
                      {col('roi') && (
                        <th className="px-3 py-2.5 text-center text-xs font-medium text-muted-foreground uppercase tracking-wide whitespace-nowrap">
                          Trend
                        </th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-card-border">
                    {sortedRows.map((row, idx) => (
                      <motion.tr
                        key={row.name}
                        className={`hover:bg-muted/30 transition-colors ${idx % 2 === 1 ? 'bg-muted/15' : ''}`}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: idx * 0.03, duration: 0.25 }}
                      >
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
                        {col('roi') && (
                          <td className="px-3 py-2.5 text-center">
                            <MiniSparkline
                              data={campaignSparklines[row.name] || []}
                              color={row.roi >= 2 ? '#22C55E' : row.roi >= 1 ? '#3B53FF' : '#EF4444'}
                            />
                          </td>
                        )}
                      </motion.tr>
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
                      {col('roi') && <td />}
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            {/* Activities Needing Attention */}
            {alerts.length > 0 && (
              <motion.div
                className="bg-card border border-card-border rounded-lg p-4"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.4, ease: 'easeOut' }}
              >
                <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                  <SolarDangerTriangle className="w-4 h-4 text-amber-500" />
                  Activities Needing Attention
                  <span className="text-xs font-normal text-muted-foreground">({alerts.length})</span>
                </h3>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {alerts.map((alert, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, x: -12 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.04, duration: 0.25 }}
                      className={`flex items-start gap-2 text-xs p-2.5 rounded-md border-l-[3px] ${
                        alert.type === 'error'
                          ? 'bg-red-500/10 text-red-400 border-l-red-500'
                          : 'bg-amber-500/10 text-amber-400 border-l-amber-500'
                      }`}
                    >
                      <span className="flex-shrink-0 mt-0.5">
                        {alert.type === 'error' ? <SolarCloseCircle className="w-3.5 h-3.5" /> : <SolarDangerCircle className="w-3.5 h-3.5" />}
                      </span>
                      <span>{alert.message}</span>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
