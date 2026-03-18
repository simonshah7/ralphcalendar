'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { formatCurrency } from '@/lib/utils';
import type { CampaignReportData } from '@/db/schema';

// ─── AI Insight type ────────────────────────────────────
interface AIInsight {
  type: 'learning' | 'improvement' | 'suggestion' | 'warning' | 'success';
  title: string;
  description: string;
  source: string;
  metric: string;
  priority: 'high' | 'medium' | 'low';
}

const INSIGHT_CONFIG: Record<string, { icon: string; color: string; bg: string; label: string }> = {
  learning: { icon: '💡', color: '#3B53FF', bg: 'rgba(59,83,255,0.1)', label: 'Learning' },
  improvement: { icon: '📈', color: '#7A00C1', bg: 'rgba(122,0,193,0.1)', label: 'Improvement' },
  suggestion: { icon: '✨', color: '#006170', bg: 'rgba(0,97,112,0.1)', label: 'Suggestion' },
  warning: { icon: '⚠️', color: '#FFA943', bg: 'rgba(255,169,67,0.1)', label: 'Warning' },
  success: { icon: '✅', color: '#34E5E2', bg: 'rgba(52,229,226,0.1)', label: 'Success' },
};

interface CampaignReportingDashboardProps {
  calendarId: string;
}

type ReportTab =
  | 'themes'
  | 'channels'
  | 'hero-assets'
  | 'linkedin'
  | 'icp'
  | 'outreach'
  | 'event-leads';

function num(v: number | undefined | null): number {
  return v ?? 0;
}

function fmtCompact(value: number): string {
  if (Math.abs(value) >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (Math.abs(value) >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return value.toFixed(0);
}

function pct(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function pctRaw(value: number): string {
  return `${value.toFixed(1)}%`;
}

// ─── Mini bar for tables (animated) ──────────────────────
function MiniBar({ value, max, color }: { value: number; max: number; color: string }) {
  const w = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  return (
    <div className="h-2 bg-muted rounded-full overflow-hidden w-20 inline-block ml-2 align-middle">
      <motion.div
        className="h-full rounded-full"
        style={{ backgroundColor: color }}
        initial={{ width: 0 }}
        animate={{ width: `${w}%` }}
        transition={{ duration: 0.6, ease: 'easeOut', delay: 0.1 }}
      />
    </div>
  );
}

// ─── Funnel visualization (animated) ─────────────────────
function FunnelChart({ stages, color }: { stages: { label: string; value: number }[]; color: string }) {
  const maxVal = Math.max(...stages.map((s) => s.value), 1);
  return (
    <div className="space-y-2">
      {stages.map((stage, i) => {
        const w = Math.max((stage.value / maxVal) * 100, 8);
        const opacity = 1 - i * 0.12;
        return (
          <motion.div
            key={stage.label}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.08, duration: 0.3 }}
            className="flex items-center gap-3"
          >
            <span className="text-xs text-muted-foreground w-28 text-right truncate">{stage.label}</span>
            <div className="flex-1 relative">
              <motion.div
                className="h-7 rounded-md flex items-center px-2"
                initial={{ width: '8%' }}
                animate={{ width: `${w}%` }}
                transition={{ delay: 0.2 + i * 0.08, duration: 0.6, ease: 'easeOut' }}
                style={{ backgroundColor: color, opacity }}
              >
                <span className="text-xs font-semibold text-white">{fmtCompact(stage.value)}</span>
              </motion.div>
            </div>
            {i > 0 && (
              <span className="text-[10px] text-muted-foreground w-14 text-right">
                {stages[i - 1].value > 0
                  ? pctRaw((stage.value / stages[i - 1].value) * 100)
                  : '—'}
              </span>
            )}
          </motion.div>
        );
      })}
    </div>
  );
}

// ─── Sparkline (animated SVG) ────────────────────────────
function Sparkline({ data, color, height = 24 }: { data: number[]; color: string; height?: number }) {
  if (data.length < 2) return null;
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = max - min || 1;
  const w = 80;
  const points = data
    .map((v, i) => `${(i / (data.length - 1)) * w},${height - ((v - min) / range) * (height - 4) - 2}`)
    .join(' ');
  // Area fill path
  const areaPoints = `0,${height} ${points} ${w},${height}`;
  return (
    <svg width={w} height={height} className="inline-block align-middle overflow-visible">
      <defs>
        <linearGradient id={`spark-${color.replace('#','')}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.2" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <motion.polygon
        points={areaPoints}
        fill={`url(#spark-${color.replace('#','')})`}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3, duration: 0.5 }}
      />
      <motion.polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={{ pathLength: 0, opacity: 0 }}
        animate={{ pathLength: 1, opacity: 1 }}
        transition={{ duration: 0.8, ease: 'easeOut', delay: 0.2 }}
      />
      {/* End dot */}
      <motion.circle
        cx={(data.length - 1) / (data.length - 1) * w}
        cy={height - ((data[data.length - 1] - min) / range) * (height - 4) - 2}
        r="2"
        fill={color}
        initial={{ opacity: 0, scale: 0 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 1, duration: 0.3 }}
      />
    </svg>
  );
}

// ─── Section card wrapper (animated) ─────────────────────
function Card({ title, children, className = '' }: { title?: string; children: React.ReactNode; className?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={`bg-card border border-card-border rounded-lg p-4 ${className}`}
    >
      {title && <h3 className="text-sm font-semibold text-foreground mb-3">{title}</h3>}
      {children}
    </motion.div>
  );
}

// ─── KPI Stat (animated) ────────────────────────────────
function Stat({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3 }}
      className="text-center"
    >
      <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1">{label}</div>
      <div className="text-xl font-bold" style={color ? { color } : undefined}>
        {value}
      </div>
      {sub && <div className="text-[10px] text-muted-foreground mt-0.5">{sub}</div>}
    </motion.div>
  );
}

// ─── Horizontal stacked bar (animated) ──────────────────
function StackedBar({ segments }: { segments: { label: string; value: number; color: string }[] }) {
  const total = segments.reduce((s, seg) => s + seg.value, 0);
  if (total === 0) return <div className="h-6 bg-muted rounded-md" />;
  return (
    <div className="space-y-1">
      <div className="h-6 rounded-md overflow-hidden flex bg-muted">
        {segments.map((seg, i) =>
          seg.value > 0 ? (
            <motion.div
              key={seg.label}
              className="h-full"
              initial={{ width: 0 }}
              animate={{ width: `${(seg.value / total) * 100}%` }}
              transition={{ duration: 0.6, ease: 'easeOut', delay: 0.1 + i * 0.08 }}
              style={{ backgroundColor: seg.color }}
              title={`${seg.label}: ${fmtCompact(seg.value)}`}
            />
          ) : null,
        )}
      </div>
      <div className="flex flex-wrap gap-3 text-[10px] text-muted-foreground">
        {segments.map((seg) => (
          <span key={seg.label} className="flex items-center gap-1">
            <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ backgroundColor: seg.color }} />
            {seg.label} ({pctRaw((seg.value / total) * 100)})
          </span>
        ))}
      </div>
    </div>
  );
}

// ─── Progress Ring (SVG circle) ─────────────────────────
function ProgressRing({ value, max, size = 64, strokeWidth = 5, color }: { value: number; max: number; size?: number; strokeWidth?: number; color: string }) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const pctValue = max > 0 ? Math.min(value / max, 1) : 0;
  const offset = circumference * (1 - pctValue);
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="currentColor" strokeWidth={strokeWidth} className="text-muted/30" />
        <motion.circle
          cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={color} strokeWidth={strokeWidth}
          strokeLinecap="round" strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1, ease: 'easeOut', delay: 0.3 }}
        />
      </svg>
      <span className="absolute text-xs font-bold" style={{ color }}>{pctRaw(pctValue * 100)}</span>
    </div>
  );
}

// ─── Radar Chart (SVG) ──────────────────────────────────
function RadarChart({ dimensions, color, size = 200 }: { dimensions: { label: string; value: number; max: number }[]; color: string; size?: number }) {
  const n = dimensions.length;
  if (n < 3) return null;
  const cx = size / 2;
  const cy = size / 2;
  const r = size * 0.38;

  const angleStep = (2 * Math.PI) / n;
  const gridLevels = [0.25, 0.5, 0.75, 1];

  const getPoint = (i: number, scale: number) => ({
    x: cx + r * scale * Math.sin(i * angleStep),
    y: cy - r * scale * Math.cos(i * angleStep),
  });

  const dataPoints = dimensions.map((d, i) => {
    const normalized = d.max > 0 ? Math.min(d.value / d.max, 1) : 0;
    return getPoint(i, normalized);
  });

  const dataPath = dataPoints.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ') + ' Z';

  return (
    <svg width={size} height={size} className="mx-auto">
      {/* Grid */}
      {gridLevels.map((level) => (
        <polygon
          key={level}
          points={Array.from({ length: n }, (_, i) => { const p = getPoint(i, level); return `${p.x},${p.y}`; }).join(' ')}
          fill="none" stroke="currentColor" strokeWidth="0.5" className="text-card-border"
        />
      ))}
      {/* Axes */}
      {Array.from({ length: n }, (_, i) => {
        const p = getPoint(i, 1);
        return <line key={i} x1={cx} y1={cy} x2={p.x} y2={p.y} stroke="currentColor" strokeWidth="0.5" className="text-card-border" />;
      })}
      {/* Data polygon */}
      <motion.path
        d={dataPath} fill={color} fillOpacity={0.15} stroke={color} strokeWidth="2"
        initial={{ opacity: 0, scale: 0.5 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.8, ease: 'easeOut', delay: 0.2 }}
        style={{ transformOrigin: `${cx}px ${cy}px` }}
      />
      {/* Data points */}
      {dataPoints.map((p, i) => (
        <motion.circle
          key={i} cx={p.x} cy={p.y} r={3} fill={color}
          initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          transition={{ delay: 0.5 + i * 0.1 }}
        />
      ))}
      {/* Labels */}
      {dimensions.map((d, i) => {
        const labelP = getPoint(i, 1.18);
        return (
          <text key={i} x={labelP.x} y={labelP.y} textAnchor="middle" dominantBaseline="middle"
            className="fill-muted-foreground text-[9px]"
          >
            {d.label}
          </text>
        );
      })}
    </svg>
  );
}

// ─── Campaign Health Gauge ──────────────────────────────
function HealthGauge({ score, size = 120 }: { score: number; size?: number }) {
  const clampedScore = Math.max(0, Math.min(100, score));
  const r = size * 0.4;
  const cx = size / 2;
  const cy = size * 0.55;
  const startAngle = Math.PI;
  const sweepAngle = Math.PI;
  const arcLength = sweepAngle * r;

  const x1 = cx + r * Math.cos(startAngle);
  const y1 = cy + r * Math.sin(startAngle);
  const x2 = cx + r * Math.cos(0);
  const y2 = cy + r * Math.sin(0);

  const color = clampedScore >= 75 ? '#34E5E2' : clampedScore >= 50 ? '#FFA943' : '#FF715A';

  return (
    <div className="relative inline-flex flex-col items-center">
      <svg width={size} height={size * 0.65}>
        <path d={`M ${x1} ${y1} A ${r} ${r} 0 0 1 ${x2} ${y2}`} fill="none" stroke="currentColor" strokeWidth="8" className="text-muted/30" strokeLinecap="round" />
        <motion.path
          d={`M ${x1} ${y1} A ${r} ${r} 0 0 1 ${x2} ${y2}`}
          fill="none" stroke={color} strokeWidth="8" strokeLinecap="round"
          strokeDasharray={arcLength}
          initial={{ strokeDashoffset: arcLength }}
          animate={{ strokeDashoffset: arcLength * (1 - clampedScore / 100) }}
          transition={{ duration: 1.2, ease: 'easeOut', delay: 0.3 }}
        />
      </svg>
      <div className="absolute bottom-0 text-center">
        <div className="text-2xl font-bold" style={{ color }}>{Math.round(clampedScore)}</div>
        <div className="text-[9px] text-muted-foreground uppercase tracking-wider">Health Score</div>
      </div>
    </div>
  );
}

// ─── AI Insights Panel ──────────────────────────────────
function AIInsightsPanel({ calendarId }: { calendarId: string }) {
  const [insights, setInsights] = useState<AIInsight[]>([]);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(true);
  const [filterType, setFilterType] = useState<string | null>(null);

  const fetchInsights = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/ai/campaign-insights?calendarId=${calendarId}`);
      if (res.ok) setInsights(await res.json());
    } catch (e) {
      console.error('Failed to fetch AI insights:', e);
    }
    setLoading(false);
  }, [calendarId]);

  useEffect(() => { fetchInsights(); }, [fetchInsights]);

  const filteredInsights = filterType ? insights.filter((i) => i.type === filterType) : insights;

  const typeCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const i of insights) counts[i.type] = (counts[i.type] || 0) + 1;
    return counts;
  }, [insights]);

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="bg-card border border-card-border rounded-lg overflow-hidden"
    >
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/30 transition-colors"
      >
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-md bg-gradient-to-br from-purple-500/20 to-blue-500/20 flex items-center justify-center">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" className="text-purple-400">
              <path d="M8 1l2 4.5L15 6l-3.5 3.5L12.5 15 8 12.5 3.5 15l1-5.5L1 6l5-0.5L8 1z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
            </svg>
          </div>
          <span className="text-sm font-semibold text-foreground">AI Insights & Recommendations</span>
          {insights.length > 0 && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-accent-purple/15 text-accent-purple font-medium">
              {insights.length}
            </span>
          )}
        </div>
        <motion.svg
          width="16" height="16" viewBox="0 0 16 16" fill="none"
          animate={{ rotate: expanded ? 180 : 0 }}
          transition={{ duration: 0.2 }}
          className="text-muted-foreground"
        >
          <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </motion.svg>
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 space-y-3">
              {/* Type filter chips */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <button
                  onClick={() => setFilterType(null)}
                  className={`px-2 py-1 text-[10px] rounded-md font-medium transition-colors ${
                    !filterType ? 'bg-accent-purple text-white' : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                  }`}
                >
                  All ({insights.length})
                </button>
                {Object.entries(INSIGHT_CONFIG).map(([type, cfg]) => (
                  typeCounts[type] ? (
                    <button
                      key={type}
                      onClick={() => setFilterType(filterType === type ? null : type)}
                      className={`px-2 py-1 text-[10px] rounded-md font-medium transition-colors flex items-center gap-1 ${
                        filterType === type ? 'text-white' : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                      }`}
                      style={filterType === type ? { backgroundColor: cfg.color } : undefined}
                    >
                      <span>{cfg.icon}</span> {cfg.label} ({typeCounts[type]})
                    </button>
                  ) : null
                ))}
              </div>

              {loading && (
                <div className="flex items-center gap-2 py-4 justify-center text-xs text-muted-foreground">
                  <div className="w-4 h-4 border-2 border-accent-purple/30 border-t-accent-purple rounded-full animate-spin" />
                  Analyzing campaign data...
                </div>
              )}

              {!loading && filteredInsights.length === 0 && (
                <div className="text-center py-4 text-xs text-muted-foreground">
                  No insights available for this filter.
                </div>
              )}

              {/* Insight cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 max-h-[400px] overflow-y-auto pr-1">
                {filteredInsights.map((insight, i) => {
                  const cfg = INSIGHT_CONFIG[insight.type] || INSIGHT_CONFIG.learning;
                  return (
                    <motion.div
                      key={`${insight.type}-${i}`}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.04, duration: 0.25 }}
                      className="rounded-lg border border-card-border p-3 space-y-1.5"
                      style={{ borderLeftWidth: 3, borderLeftColor: cfg.color }}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm">{cfg.icon}</span>
                          <span className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: cfg.color }}>
                            {cfg.label}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${
                            insight.priority === 'high' ? 'bg-red-500/15 text-red-400' :
                            insight.priority === 'medium' ? 'bg-amber-500/15 text-amber-400' :
                            'bg-green-500/15 text-green-400'
                          }`}>
                            {insight.priority}
                          </span>
                        </div>
                      </div>
                      <div className="text-xs font-semibold text-foreground">{insight.title}</div>
                      <div className="text-[11px] text-muted-foreground leading-relaxed">{insight.description}</div>
                      <div className="flex items-center justify-between pt-1">
                        <span className="text-[9px] text-muted-foreground/60 uppercase tracking-wide">
                          {insight.source.replace(/_/g, ' ')}
                        </span>
                        {insight.metric && (
                          <span className="text-[10px] font-bold" style={{ color: cfg.color }}>
                            {insight.metric}
                          </span>
                        )}
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ─── Colors ──────────────────────────────────────────────
const THEME_COLORS = ['#7A00C1', '#3B53FF', '#006170', '#FF715A', '#FFA943'];
const CHANNEL_COLORS = ['#006170', '#3B53FF', '#7A00C1', '#FF715A'];
const ASSET_COLORS = ['#3B53FF', '#FF715A', '#FFA943', '#006170'];

// ─── Main Component ─────────────────────────────────────
export function CampaignReportingDashboard({ calendarId }: CampaignReportingDashboardProps) {
  const [tab, setTab] = useState<ReportTab>('themes');
  const [data, setData] = useState<CampaignReportData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const res = await fetch(`/api/campaign-reports?calendarId=${calendarId}`);
        if (res.ok) {
          setData(await res.json());
        }
      } catch (e) {
        console.error('Failed to load report data:', e);
      }
      setLoading(false);
    }
    load();
  }, [calendarId]);

  // Group by source
  const bySource = useMemo(() => {
    const map: Record<string, CampaignReportData[]> = {};
    for (const row of data) {
      (map[row.source] ??= []).push(row);
    }
    return map;
  }, [data]);

  const tabs: { key: ReportTab; label: string }[] = [
    { key: 'themes', label: 'Theme Performance' },
    { key: 'channels', label: 'Channel Performance' },
    { key: 'hero-assets', label: 'Hero Assets' },
    { key: 'linkedin', label: 'LinkedIn & Ads' },
    { key: 'icp', label: 'ICP Penetration' },
    { key: 'outreach', label: 'Outreach' },
    { key: 'event-leads', label: 'Event Leads' },
  ];

  // ── Campaign health score ──────────────────────────────
  const healthScore = useMemo(() => {
    if (data.length === 0) return 0;
    let score = 50; // baseline

    // Theme performance contribution
    const themes = bySource['marketo_theme'] || [];
    const totalSaos = themes.reduce((s, r) => s + num((r.metrics as Record<string, number>).saos), 0);
    if (totalSaos > 50) score += 10;
    else if (totalSaos > 20) score += 5;

    // Channel engagement
    const channels = bySource['marketo_channel'] || [];
    const totalEngagements = channels.reduce((s, r) => s + num((r.metrics as Record<string, number>).engagements), 0);
    const totalViews = channels.reduce((s, r) => s + num((r.metrics as Record<string, number>).views), 0);
    const engRate = totalViews > 0 ? totalEngagements / totalViews : 0;
    if (engRate > 0.05) score += 10;
    else if (engRate > 0.02) score += 5;

    // ICP penetration
    const icp = bySource['icp_penetration'] || [];
    const summary = icp.find((r) => r.category === 'summary');
    if (summary) {
      const sm = summary.metrics as Record<string, number>;
      const penetration = num(sm.targetAccounts) > 0 ? num(sm.engaged) / num(sm.targetAccounts) : 0;
      if (penetration > 0.4) score += 10;
      else if (penetration > 0.2) score += 5;
    }

    // Outreach reply rate
    const outreach = bySource['outreach_sequence'] || [];
    const totalSent = outreach.reduce((s, r) => s + num((r.metrics as Record<string, number>).sent), 0);
    const totalReplied = outreach.reduce((s, r) => s + num((r.metrics as Record<string, number>).replied), 0);
    const replyRate = totalSent > 0 ? totalReplied / totalSent : 0;
    if (replyRate > 0.05) score += 10;
    else if (replyRate > 0.02) score += 5;

    // Event conversion
    const events = bySource['sfdc_event_leads'] || [];
    const totalRegistered = events.reduce((s, r) => s + num((r.metrics as Record<string, number>).registered), 0);
    const totalClosedWon = events.reduce((s, r) => s + num((r.metrics as Record<string, number>).closedWon), 0);
    if (totalRegistered > 0 && totalClosedWon / totalRegistered > 0.02) score += 10;
    else if (totalRegistered > 0 && totalClosedWon > 0) score += 5;

    return Math.min(100, score);
  }, [data, bySource]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground text-sm">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex flex-col items-center gap-3"
        >
          <div className="relative w-10 h-10">
            <div className="absolute inset-0 rounded-full border-2 border-card-border" />
            <div className="absolute inset-0 rounded-full border-2 border-accent-purple border-t-transparent animate-spin" />
          </div>
          <span>Loading campaign reports...</span>
        </motion.div>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center py-12 text-muted-foreground text-sm"
      >
        No campaign reporting data available. Seed data to populate reports.
      </motion.div>
    );
  }

  return (
    <div className="space-y-4">
      {/* AI Insights Panel */}
      <AIInsightsPanel calendarId={calendarId} />

      {/* Health Score + Overview Row */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
        className="grid grid-cols-1 lg:grid-cols-4 gap-4"
      >
        <Card className="flex flex-col items-center justify-center py-2">
          <HealthGauge score={healthScore} />
        </Card>
        <Card className="lg:col-span-3">
          <div className="text-xs text-muted-foreground mb-2 uppercase tracking-wide font-medium">Cross-Channel Overview</div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="text-center">
              <div className="text-lg font-bold text-foreground">{fmtCompact((bySource['marketo_theme'] || []).reduce((s, r) => s + num((r.metrics as Record<string, number>).saos), 0))}</div>
              <div className="text-[10px] text-muted-foreground">Theme SAOs</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-bold text-foreground">{fmtCompact((bySource['marketo_channel'] || []).reduce((s, r) => s + num((r.metrics as Record<string, number>).mqls), 0))}</div>
              <div className="text-[10px] text-muted-foreground">Channel MQLs</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-bold text-foreground">{fmtCompact((bySource['linkedin_ads'] || []).reduce((s, r) => s + num((r.metrics as Record<string, number>).leads), 0))}</div>
              <div className="text-[10px] text-muted-foreground">LinkedIn Leads</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-bold text-foreground">{formatCurrency((bySource['sfdc_event_leads'] || []).reduce((s, r) => s + num((r.metrics as Record<string, number>).revenue), 0))}</div>
              <div className="text-[10px] text-muted-foreground">Event Revenue</div>
            </div>
          </div>
        </Card>
      </motion.div>

      {/* Sub-tab bar */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.2 }}
        className="flex items-center gap-1 overflow-x-auto pb-1"
      >
        {tabs.map((t, i) => (
          <motion.button
            key={t.key}
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 + i * 0.03 }}
            onClick={() => setTab(t.key)}
            className={`px-3 py-1.5 text-xs font-medium rounded-md whitespace-nowrap transition-colors ${
              tab === t.key
                ? 'bg-accent-purple text-white shadow-sm shadow-accent-purple/20'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
            }`}
          >
            {t.label}
          </motion.button>
        ))}
      </motion.div>

      {/* Tab content with transitions */}
      <AnimatePresence mode="wait">
        <motion.div
          key={tab}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.25 }}
        >
          {tab === 'themes' && <ThemePerformance rows={bySource['marketo_theme'] || []} />}
          {tab === 'channels' && <ChannelPerformance rows={bySource['marketo_channel'] || []} />}
          {tab === 'hero-assets' && <HeroAssets rows={bySource['hero_asset'] || []} />}
          {tab === 'linkedin' && <LinkedInAds rows={bySource['linkedin_ads'] || []} />}
          {tab === 'icp' && <ICPPenetration rows={bySource['icp_penetration'] || []} />}
          {tab === 'outreach' && <OutreachSequences rows={bySource['outreach_sequence'] || []} />}
          {tab === 'event-leads' && <EventLeadProgress rows={bySource['sfdc_event_leads'] || []} />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

// ─── Theme Performance Tab ──────────────────────────────
function ThemePerformance({ rows }: { rows: CampaignReportData[] }) {
  const themes = useMemo(() => {
    return rows.map((r, i) => ({
      name: r.label,
      color: THEME_COLORS[i % THEME_COLORS.length],
      m: r.metrics as Record<string, number>,
    }));
  }, [rows]);

  const totals = useMemo(() => {
    const t = { impressions: 0, clicks: 0, mqls: 0, saos: 0, pipeline: 0, spend: 0 };
    for (const th of themes) {
      t.impressions += num(th.m.impressions);
      t.clicks += num(th.m.clicks);
      t.mqls += num(th.m.mqls);
      t.saos += num(th.m.saos);
      t.pipeline += num(th.m.pipeline);
      t.spend += num(th.m.spend);
    }
    return t;
  }, [themes]);

  const maxSaos = Math.max(...themes.map((t) => num(t.m.saos)), 1);
  const maxPipeline = Math.max(...themes.map((t) => num(t.m.pipeline)), 1);

  return (
    <div className="space-y-4">
      {/* KPI row */}
      <Card>
        <div className="grid grid-cols-3 md:grid-cols-6 gap-4">
          <Stat label="Total Impressions" value={fmtCompact(totals.impressions)} />
          <Stat label="Total Clicks" value={fmtCompact(totals.clicks)} sub={`CTR: ${pctRaw(totals.impressions > 0 ? (totals.clicks / totals.impressions) * 100 : 0)}`} />
          <Stat label="MQLs" value={fmtCompact(totals.mqls)} color="#3B53FF" />
          <Stat label="SAOs" value={fmtCompact(totals.saos)} color="#006170" />
          <Stat label="Pipeline" value={formatCurrency(totals.pipeline)} color="#7A00C1" />
          <Stat label="Cost per SAO" value={totals.saos > 0 ? formatCurrency(totals.spend / totals.saos) : '—'} />
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* SAOs by theme bar chart */}
        <Card title="SAOs by Theme">
          <div className="space-y-3">
            {themes.map((th) => (
              <div key={th.name} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-foreground font-medium truncate max-w-[240px]">{th.name}</span>
                  <span className="text-muted-foreground">{num(th.m.saos)} SAOs</span>
                </div>
                <div className="h-4 bg-muted rounded overflow-hidden">
                  <div
                    className="h-full rounded"
                    style={{ width: `${(num(th.m.saos) / maxSaos) * 100}%`, backgroundColor: th.color }}
                  />
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Pipeline by theme */}
        <Card title="Pipeline by Theme">
          <div className="space-y-3">
            {themes.map((th) => (
              <div key={th.name} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-foreground font-medium truncate max-w-[240px]">{th.name}</span>
                  <span className="text-muted-foreground">{formatCurrency(num(th.m.pipeline))}</span>
                </div>
                <div className="h-4 bg-muted rounded overflow-hidden">
                  <div
                    className="h-full rounded"
                    style={{ width: `${(num(th.m.pipeline) / maxPipeline) * 100}%`, backgroundColor: th.color }}
                  />
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Full theme table */}
      <Card title="Theme Breakdown">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground uppercase">Theme</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground uppercase">Impressions</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground uppercase">Clicks</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground uppercase">CTR</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground uppercase">MQLs</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground uppercase">SAOs</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground uppercase">Pipeline</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground uppercase">Cost/SAO</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-card-border">
              {themes.map((th, i) => {
                const ctr = num(th.m.impressions) > 0 ? (num(th.m.clicks) / num(th.m.impressions)) * 100 : 0;
                const costPerSao = num(th.m.saos) > 0 ? num(th.m.spend) / num(th.m.saos) : 0;
                return (
                  <tr key={th.name} className={`hover:bg-muted/30 ${i % 2 === 1 ? 'bg-muted/15' : ''}`}>
                    <td className="px-3 py-2 text-foreground font-medium">
                      <span className="inline-block w-2.5 h-2.5 rounded-full mr-2" style={{ backgroundColor: th.color }} />
                      {th.name}
                    </td>
                    <td className="px-3 py-2 text-right text-muted-foreground tabular-nums">{fmtCompact(num(th.m.impressions))}</td>
                    <td className="px-3 py-2 text-right text-muted-foreground tabular-nums">{fmtCompact(num(th.m.clicks))}</td>
                    <td className="px-3 py-2 text-right text-muted-foreground tabular-nums">{pctRaw(ctr)}</td>
                    <td className="px-3 py-2 text-right text-muted-foreground tabular-nums">{num(th.m.mqls)}</td>
                    <td className="px-3 py-2 text-right font-medium text-foreground tabular-nums">{num(th.m.saos)}</td>
                    <td className="px-3 py-2 text-right text-muted-foreground tabular-nums">{formatCurrency(num(th.m.pipeline))}</td>
                    <td className="px-3 py-2 text-right text-muted-foreground tabular-nums">{costPerSao > 0 ? formatCurrency(costPerSao) : '—'}</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="bg-muted/50 font-semibold">
              <tr>
                <td className="px-3 py-2 text-foreground">Total</td>
                <td className="px-3 py-2 text-right tabular-nums">{fmtCompact(totals.impressions)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{fmtCompact(totals.clicks)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{pctRaw(totals.impressions > 0 ? (totals.clicks / totals.impressions) * 100 : 0)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{totals.mqls}</td>
                <td className="px-3 py-2 text-right tabular-nums">{totals.saos}</td>
                <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(totals.pipeline)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{totals.saos > 0 ? formatCurrency(totals.spend / totals.saos) : '—'}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </Card>

      {/* Radar + Funnel side-by-side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card title="Theme Performance Radar">
          <RadarChart
            dimensions={themes.map((th) => [
              { label: 'Impressions', value: num(th.m.impressions), max: Math.max(...themes.map((t) => num(t.m.impressions)), 1) },
              { label: 'Clicks', value: num(th.m.clicks), max: Math.max(...themes.map((t) => num(t.m.clicks)), 1) },
              { label: 'MQLs', value: num(th.m.mqls), max: Math.max(...themes.map((t) => num(t.m.mqls)), 1) },
              { label: 'SAOs', value: num(th.m.saos), max: Math.max(...themes.map((t) => num(t.m.saos)), 1) },
              { label: 'Pipeline', value: num(th.m.pipeline), max: Math.max(...themes.map((t) => num(t.m.pipeline)), 1) },
            ]).sort((a, b) => b.reduce((s, d) => s + d.value / d.max, 0) - a.reduce((s, d) => s + d.value / d.max, 0))[0] || []}
            color="#7A00C1"
            size={220}
          />
          <div className="text-center text-[10px] text-muted-foreground mt-1">
            Showing top performing theme dimensions
          </div>
        </Card>

        <Card title="Conversion Rates">
          <div className="flex items-center justify-around py-4">
            <div className="flex flex-col items-center gap-1">
              <ProgressRing value={totals.clicks} max={totals.impressions} color="#7A00C1" />
              <span className="text-[10px] text-muted-foreground mt-1">CTR</span>
            </div>
            <div className="flex flex-col items-center gap-1">
              <ProgressRing value={totals.mqls} max={totals.clicks} color="#3B53FF" />
              <span className="text-[10px] text-muted-foreground mt-1">Click-to-MQL</span>
            </div>
            <div className="flex flex-col items-center gap-1">
              <ProgressRing value={totals.saos} max={totals.mqls} color="#006170" />
              <span className="text-[10px] text-muted-foreground mt-1">MQL-to-SAO</span>
            </div>
          </div>
        </Card>
      </div>

      {/* Conversion funnel */}
      <Card title="Theme Conversion Funnel (All Themes)">
        <FunnelChart
          stages={[
            { label: 'Impressions', value: totals.impressions },
            { label: 'Clicks', value: totals.clicks },
            { label: 'MQLs', value: totals.mqls },
            { label: 'SAOs', value: totals.saos },
          ]}
          color="#7A00C1"
        />
      </Card>
    </div>
  );
}

// ─── Channel Performance Tab ────────────────────────────
function ChannelPerformance({ rows }: { rows: CampaignReportData[] }) {
  const channels = useMemo(() => {
    return rows.map((r, i) => ({
      name: r.label,
      color: CHANNEL_COLORS[i % CHANNEL_COLORS.length],
      m: r.metrics as Record<string, number>,
    }));
  }, [rows]);

  const totals = useMemo(() => {
    const t = { published: 0, views: 0, engagements: 0, mqls: 0, saos: 0, spend: 0 };
    for (const ch of channels) {
      t.published += num(ch.m.published);
      t.views += num(ch.m.views);
      t.engagements += num(ch.m.engagements);
      t.mqls += num(ch.m.mqls);
      t.saos += num(ch.m.saos);
      t.spend += num(ch.m.spend);
    }
    return t;
  }, [channels]);

  const maxViews = Math.max(...channels.map((c) => num(c.m.views)), 1);

  return (
    <div className="space-y-4">
      <Card>
        <div className="grid grid-cols-3 md:grid-cols-6 gap-4">
          <Stat label="Assets Published" value={fmtCompact(totals.published)} />
          <Stat label="Total Views/Opens" value={fmtCompact(totals.views)} />
          <Stat label="Engagements" value={fmtCompact(totals.engagements)} sub={`Eng. rate: ${pctRaw(totals.views > 0 ? (totals.engagements / totals.views) * 100 : 0)}`} />
          <Stat label="MQLs Generated" value={fmtCompact(totals.mqls)} color="#3B53FF" />
          <Stat label="SAOs" value={fmtCompact(totals.saos)} color="#006170" />
          <Stat label="Cost per MQL" value={totals.mqls > 0 ? formatCurrency(totals.spend / totals.mqls) : '—'} />
        </div>
      </Card>

      {/* Mix distribution */}
      <Card title="Channel Mix (by MQLs)">
        <StackedBar
          segments={channels.map((ch) => ({
            label: ch.name,
            value: num(ch.m.mqls),
            color: ch.color,
          }))}
        />
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card title="Views by Channel">
          <div className="space-y-3">
            {channels.map((ch) => (
              <div key={ch.name} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-foreground font-medium">{ch.name}</span>
                  <span className="text-muted-foreground">{fmtCompact(num(ch.m.views))} views</span>
                </div>
                <div className="h-4 bg-muted rounded overflow-hidden">
                  <div className="h-full rounded" style={{ width: `${(num(ch.m.views) / maxViews) * 100}%`, backgroundColor: ch.color }} />
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card title="Engagement Rate by Channel">
          <div className="space-y-4">
            {channels.map((ch) => {
              const engRate = num(ch.m.views) > 0 ? (num(ch.m.engagements) / num(ch.m.views)) * 100 : 0;
              return (
                <div key={ch.name} className="flex items-center gap-3">
                  <span className="inline-block w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: ch.color }} />
                  <span className="text-xs text-foreground font-medium w-28">{ch.name}</span>
                  <div className="flex-1 h-4 bg-muted rounded overflow-hidden">
                    <div className="h-full rounded" style={{ width: `${Math.min(engRate, 100)}%`, backgroundColor: ch.color }} />
                  </div>
                  <span className="text-xs text-muted-foreground w-12 text-right">{pctRaw(engRate)}</span>
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      {/* Detail table */}
      <Card title="Channel Breakdown">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground uppercase">Channel</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground uppercase">Published</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground uppercase">Views/Opens</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground uppercase">Eng. Rate</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground uppercase">MQLs</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground uppercase">SAOs</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground uppercase">Cost/MQL</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground uppercase">Trend</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-card-border">
              {channels.map((ch, i) => {
                const engRate = num(ch.m.views) > 0 ? (num(ch.m.engagements) / num(ch.m.views)) * 100 : 0;
                const costPerMql = num(ch.m.mqls) > 0 ? num(ch.m.spend) / num(ch.m.mqls) : 0;
                const trend = ch.m.trend_data ? JSON.parse(String(ch.m.trend_data)) : [num(ch.m.mqls) * 0.6, num(ch.m.mqls) * 0.75, num(ch.m.mqls) * 0.85, num(ch.m.mqls)];
                return (
                  <tr key={ch.name} className={`hover:bg-muted/30 ${i % 2 === 1 ? 'bg-muted/15' : ''}`}>
                    <td className="px-3 py-2 text-foreground font-medium">
                      <span className="inline-block w-2.5 h-2.5 rounded-full mr-2" style={{ backgroundColor: ch.color }} />
                      {ch.name}
                    </td>
                    <td className="px-3 py-2 text-right text-muted-foreground tabular-nums">{num(ch.m.published)}</td>
                    <td className="px-3 py-2 text-right text-muted-foreground tabular-nums">{fmtCompact(num(ch.m.views))}</td>
                    <td className="px-3 py-2 text-right text-muted-foreground tabular-nums">{pctRaw(engRate)}</td>
                    <td className="px-3 py-2 text-right font-medium text-foreground tabular-nums">{num(ch.m.mqls)}</td>
                    <td className="px-3 py-2 text-right text-foreground tabular-nums">{num(ch.m.saos)}</td>
                    <td className="px-3 py-2 text-right text-muted-foreground tabular-nums">{costPerMql > 0 ? formatCurrency(costPerMql) : '—'}</td>
                    <td className="px-3 py-2 text-right">
                      <Sparkline data={trend as number[]} color={ch.color} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

// ─── Hero Assets Tab ────────────────────────────────────
function HeroAssets({ rows }: { rows: CampaignReportData[] }) {
  const assets = useMemo(() => {
    return rows.map((r, i) => ({
      name: r.label,
      category: r.category,
      color: ASSET_COLORS[i % ASSET_COLORS.length],
      m: r.metrics as Record<string, number>,
    }));
  }, [rows]);

  return (
    <div className="space-y-4">
      {/* Summary KPIs */}
      <Card>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Stat label="Total Downloads" value={fmtCompact(assets.reduce((s, a) => s + num(a.m.downloads), 0))} />
          <Stat label="Completions" value={fmtCompact(assets.reduce((s, a) => s + num(a.m.completions), 0))} />
          <Stat label="MQLs Influenced" value={fmtCompact(assets.reduce((s, a) => s + num(a.m.mqls), 0))} color="#3B53FF" />
          <Stat label="SAOs Influenced" value={fmtCompact(assets.reduce((s, a) => s + num(a.m.saos), 0))} color="#006170" />
          <Stat label="Pipeline Influenced" value={formatCurrency(assets.reduce((s, a) => s + num(a.m.pipeline), 0))} color="#7A00C1" />
        </div>
      </Card>

      {/* Per-asset funnels */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {assets.map((asset) => (
          <Card key={asset.name} title={asset.name}>
            <div className="text-[10px] text-muted-foreground mb-3 uppercase tracking-wide">{asset.category}</div>
            <FunnelChart
              stages={[
                { label: 'Page Views', value: num(asset.m.pageViews) },
                { label: 'Downloads/Starts', value: num(asset.m.downloads) },
                { label: 'Completions', value: num(asset.m.completions) },
                { label: 'MQLs', value: num(asset.m.mqls) },
                { label: 'SAOs', value: num(asset.m.saos) },
              ]}
              color={asset.color}
            />
            <div className="mt-3 pt-3 border-t border-card-border flex justify-between text-xs text-muted-foreground">
              <span>Pipeline: <strong className="text-foreground">{formatCurrency(num(asset.m.pipeline))}</strong></span>
              <span>Conversion: <strong className="text-foreground">{num(asset.m.pageViews) > 0 ? pctRaw((num(asset.m.saos) / num(asset.m.pageViews)) * 100) : '—'}</strong></span>
            </div>
          </Card>
        ))}
      </div>

      {/* Comparison table */}
      <Card title="Asset Comparison">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground uppercase">Asset</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground uppercase">Type</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground uppercase">Page Views</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground uppercase">Downloads</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground uppercase">Completions</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground uppercase">MQLs</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground uppercase">SAOs</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground uppercase">Pipeline</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-card-border">
              {assets.map((asset, i) => (
                <tr key={asset.name} className={`hover:bg-muted/30 ${i % 2 === 1 ? 'bg-muted/15' : ''}`}>
                  <td className="px-3 py-2 text-foreground font-medium">
                    <span className="inline-block w-2.5 h-2.5 rounded-full mr-2" style={{ backgroundColor: asset.color }} />
                    {asset.name}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground text-xs">{asset.category}</td>
                  <td className="px-3 py-2 text-right text-muted-foreground tabular-nums">{fmtCompact(num(asset.m.pageViews))}</td>
                  <td className="px-3 py-2 text-right text-muted-foreground tabular-nums">{fmtCompact(num(asset.m.downloads))}</td>
                  <td className="px-3 py-2 text-right text-muted-foreground tabular-nums">{fmtCompact(num(asset.m.completions))}</td>
                  <td className="px-3 py-2 text-right font-medium text-foreground tabular-nums">{num(asset.m.mqls)}</td>
                  <td className="px-3 py-2 text-right font-medium text-foreground tabular-nums">{num(asset.m.saos)}</td>
                  <td className="px-3 py-2 text-right text-muted-foreground tabular-nums">{formatCurrency(num(asset.m.pipeline))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

// ─── LinkedIn & Ads Tab ─────────────────────────────────
function LinkedInAds({ rows }: { rows: CampaignReportData[] }) {
  const campaigns = useMemo(() => {
    return rows.map((r, i) => ({
      name: r.label,
      color: THEME_COLORS[i % THEME_COLORS.length],
      m: r.metrics as Record<string, number>,
    }));
  }, [rows]);

  const totals = useMemo(() => {
    const t = { impressions: 0, clicks: 0, spend: 0, leads: 0, mqls: 0, saos: 0 };
    for (const c of campaigns) {
      t.impressions += num(c.m.impressions);
      t.clicks += num(c.m.clicks);
      t.spend += num(c.m.spend);
      t.leads += num(c.m.leads);
      t.mqls += num(c.m.mqls);
      t.saos += num(c.m.saos);
    }
    return t;
  }, [campaigns]);

  const maxSpend = Math.max(...campaigns.map((c) => num(c.m.spend)), 1);
  const maxLeads = Math.max(...campaigns.map((c) => num(c.m.leads)), 1);

  return (
    <div className="space-y-4">
      <Card>
        <div className="grid grid-cols-3 md:grid-cols-6 gap-4">
          <Stat label="Impressions" value={fmtCompact(totals.impressions)} />
          <Stat label="Clicks" value={fmtCompact(totals.clicks)} sub={`CTR: ${pctRaw(totals.impressions > 0 ? (totals.clicks / totals.impressions) * 100 : 0)}`} />
          <Stat label="Total Spend" value={formatCurrency(totals.spend)} />
          <Stat label="Leads" value={fmtCompact(totals.leads)} color="#3B53FF" />
          <Stat label="CPL" value={totals.leads > 0 ? formatCurrency(totals.spend / totals.leads) : '—'} />
          <Stat label="SAOs" value={fmtCompact(totals.saos)} color="#006170" />
        </div>
      </Card>

      {/* Spend vs Leads scatter-ish */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card title="Spend by Campaign">
          <div className="space-y-3">
            {campaigns.map((c) => (
              <div key={c.name} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-foreground font-medium truncate max-w-[200px]">{c.name}</span>
                  <span className="text-muted-foreground">{formatCurrency(num(c.m.spend))}</span>
                </div>
                <div className="h-4 bg-muted rounded overflow-hidden">
                  <div className="h-full rounded" style={{ width: `${(num(c.m.spend) / maxSpend) * 100}%`, backgroundColor: c.color }} />
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card title="Leads by Campaign">
          <div className="space-y-3">
            {campaigns.map((c) => (
              <div key={c.name} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-foreground font-medium truncate max-w-[200px]">{c.name}</span>
                  <span className="text-muted-foreground">{num(c.m.leads)} leads</span>
                </div>
                <div className="h-4 bg-muted rounded overflow-hidden">
                  <div className="h-full rounded" style={{ width: `${(num(c.m.leads) / maxLeads) * 100}%`, backgroundColor: c.color }} />
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Campaign table */}
      <Card title="LinkedIn Campaign Breakdown">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground uppercase">Campaign</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground uppercase">Impressions</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground uppercase">Clicks</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground uppercase">CTR</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground uppercase">Spend</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground uppercase">Leads</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground uppercase">CPL</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground uppercase">MQLs</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground uppercase">SAOs</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-card-border">
              {campaigns.map((c, i) => {
                const ctr = num(c.m.impressions) > 0 ? (num(c.m.clicks) / num(c.m.impressions)) * 100 : 0;
                const cpl = num(c.m.leads) > 0 ? num(c.m.spend) / num(c.m.leads) : 0;
                return (
                  <tr key={c.name} className={`hover:bg-muted/30 ${i % 2 === 1 ? 'bg-muted/15' : ''}`}>
                    <td className="px-3 py-2 text-foreground font-medium">
                      <span className="inline-block w-2.5 h-2.5 rounded-full mr-2" style={{ backgroundColor: c.color }} />
                      {c.name}
                    </td>
                    <td className="px-3 py-2 text-right text-muted-foreground tabular-nums">{fmtCompact(num(c.m.impressions))}</td>
                    <td className="px-3 py-2 text-right text-muted-foreground tabular-nums">{fmtCompact(num(c.m.clicks))}</td>
                    <td className="px-3 py-2 text-right text-muted-foreground tabular-nums">{pctRaw(ctr)}</td>
                    <td className="px-3 py-2 text-right text-muted-foreground tabular-nums">{formatCurrency(num(c.m.spend))}</td>
                    <td className="px-3 py-2 text-right font-medium text-foreground tabular-nums">{num(c.m.leads)}</td>
                    <td className="px-3 py-2 text-right text-muted-foreground tabular-nums">{cpl > 0 ? formatCurrency(cpl) : '—'}</td>
                    <td className="px-3 py-2 text-right text-foreground tabular-nums">{num(c.m.mqls)}</td>
                    <td className="px-3 py-2 text-right text-foreground tabular-nums">{num(c.m.saos)}</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="bg-muted/50 font-semibold">
              <tr>
                <td className="px-3 py-2 text-foreground">Total</td>
                <td className="px-3 py-2 text-right tabular-nums">{fmtCompact(totals.impressions)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{fmtCompact(totals.clicks)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{pctRaw(totals.impressions > 0 ? (totals.clicks / totals.impressions) * 100 : 0)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(totals.spend)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{totals.leads}</td>
                <td className="px-3 py-2 text-right tabular-nums">{totals.leads > 0 ? formatCurrency(totals.spend / totals.leads) : '—'}</td>
                <td className="px-3 py-2 text-right tabular-nums">{totals.mqls}</td>
                <td className="px-3 py-2 text-right tabular-nums">{totals.saos}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </Card>
    </div>
  );
}

// ─── ICP Penetration Tab ────────────────────────────────
function ICPPenetration({ rows }: { rows: CampaignReportData[] }) {
  // Expect one summary row + individual account rows
  const summary = rows.find((r) => r.category === 'summary');
  const accounts = rows.filter((r) => r.category === 'account');

  const sm = summary?.metrics as Record<string, number> || {};

  return (
    <div className="space-y-4">
      <Card>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Stat label="Target Accounts" value={fmtCompact(num(sm.targetAccounts))} />
          <Stat label="Accounts Engaged" value={fmtCompact(num(sm.engaged))} sub={`${pctRaw(num(sm.targetAccounts) > 0 ? (num(sm.engaged) / num(sm.targetAccounts)) * 100 : 0)} penetration`} color="#3B53FF" />
          <Stat label="Accounts w/ MQLs" value={fmtCompact(num(sm.withMqls))} color="#7A00C1" />
          <Stat label="Accounts w/ SAOs" value={fmtCompact(num(sm.withSaos))} color="#006170" />
          <Stat label="Total Pipeline" value={formatCurrency(num(sm.totalPipeline))} color="#FF715A" />
        </div>
      </Card>

      {/* Penetration rings + funnel */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card title="Penetration Rates" className="flex flex-col items-center justify-center">
          <div className="flex items-center justify-around w-full py-2">
            <div className="flex flex-col items-center gap-1">
              <ProgressRing value={num(sm.engaged)} max={num(sm.targetAccounts)} color="#3B53FF" size={72} />
              <span className="text-[10px] text-muted-foreground">Engagement</span>
            </div>
            <div className="flex flex-col items-center gap-1">
              <ProgressRing value={num(sm.withSaos)} max={num(sm.engaged)} color="#006170" size={72} />
              <span className="text-[10px] text-muted-foreground">SAO Rate</span>
            </div>
          </div>
        </Card>

        <Card title="Account Penetration Funnel" className="lg:col-span-2">
          <FunnelChart
            stages={[
              { label: 'Target Accounts', value: num(sm.targetAccounts) },
              { label: 'Engaged', value: num(sm.engaged) },
              { label: 'With MQLs', value: num(sm.withMqls) },
              { label: 'With SAOs', value: num(sm.withSaos) },
              { label: 'Opportunity', value: num(sm.withOpportunity) },
            ]}
            color="#3B53FF"
          />
        </Card>
      </div>

      {/* Top engaged accounts */}
      {accounts.length > 0 && (
        <Card title="Top Engaged Accounts">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground uppercase">Account</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground uppercase">Industry</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground uppercase">Touches</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground uppercase">MQLs</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground uppercase">SAOs</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground uppercase">Pipeline</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground uppercase">Stage</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-card-border">
                {accounts.map((acct, i) => {
                  const am = acct.metrics as Record<string, number | string>;
                  return (
                    <tr key={acct.id} className={`hover:bg-muted/30 ${i % 2 === 1 ? 'bg-muted/15' : ''}`}>
                      <td className="px-3 py-2 text-foreground font-medium">{acct.label}</td>
                      <td className="px-3 py-2 text-muted-foreground text-xs">{String(am.industry || '—')}</td>
                      <td className="px-3 py-2 text-right text-muted-foreground tabular-nums">{num(am.touches as number)}</td>
                      <td className="px-3 py-2 text-right text-foreground tabular-nums">{num(am.mqls as number)}</td>
                      <td className="px-3 py-2 text-right text-foreground tabular-nums">{num(am.saos as number)}</td>
                      <td className="px-3 py-2 text-right text-muted-foreground tabular-nums">{formatCurrency(num(am.pipeline as number))}</td>
                      <td className="px-3 py-2">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                          am.stage === 'Opportunity' ? 'bg-green-500/15 text-green-500' :
                          am.stage === 'SAO' ? 'bg-blue-500/15 text-blue-500' :
                          am.stage === 'MQL' ? 'bg-purple-500/15 text-purple-500' :
                          'bg-muted text-muted-foreground'
                        }`}>
                          {String(am.stage || 'Engaged')}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}

// ─── Outreach Sequences Tab ─────────────────────────────
function OutreachSequences({ rows }: { rows: CampaignReportData[] }) {
  const sequences = useMemo(() => {
    return rows.map((r, i) => ({
      name: r.label,
      color: THEME_COLORS[i % THEME_COLORS.length],
      m: r.metrics as Record<string, number>,
    }));
  }, [rows]);

  const totals = useMemo(() => {
    const t = { sent: 0, opened: 0, replied: 0, meetings: 0, saos: 0 };
    for (const s of sequences) {
      t.sent += num(s.m.sent);
      t.opened += num(s.m.opened);
      t.replied += num(s.m.replied);
      t.meetings += num(s.m.meetings);
      t.saos += num(s.m.saos);
    }
    return t;
  }, [sequences]);

  return (
    <div className="space-y-4">
      <Card>
        <div className="grid grid-cols-3 md:grid-cols-5 gap-4">
          <Stat label="Emails Sent" value={fmtCompact(totals.sent)} />
          <Stat label="Open Rate" value={pctRaw(totals.sent > 0 ? (totals.opened / totals.sent) * 100 : 0)} />
          <Stat label="Reply Rate" value={pctRaw(totals.sent > 0 ? (totals.replied / totals.sent) * 100 : 0)} color="#3B53FF" />
          <Stat label="Meetings Booked" value={fmtCompact(totals.meetings)} color="#006170" />
          <Stat label="SAOs Generated" value={fmtCompact(totals.saos)} color="#7A00C1" />
        </div>
      </Card>

      {/* Conversion Rings + Outreach funnel */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card title="Key Conversion Rates" className="flex flex-col items-center justify-center">
          <div className="flex items-center justify-around w-full py-2">
            <div className="flex flex-col items-center gap-1">
              <ProgressRing value={totals.opened} max={totals.sent} color="#006170" />
              <span className="text-[10px] text-muted-foreground">Open Rate</span>
            </div>
            <div className="flex flex-col items-center gap-1">
              <ProgressRing value={totals.replied} max={totals.sent} color="#3B53FF" />
              <span className="text-[10px] text-muted-foreground">Reply Rate</span>
            </div>
            <div className="flex flex-col items-center gap-1">
              <ProgressRing value={totals.meetings} max={totals.replied} color="#7A00C1" />
              <span className="text-[10px] text-muted-foreground">Meeting Rate</span>
            </div>
          </div>
        </Card>

        <Card title="Outreach Conversion Funnel" className="lg:col-span-2">
          <FunnelChart
            stages={[
              { label: 'Emails Sent', value: totals.sent },
              { label: 'Opened', value: totals.opened },
              { label: 'Replied', value: totals.replied },
              { label: 'Meetings', value: totals.meetings },
              { label: 'SAOs', value: totals.saos },
            ]}
            color="#006170"
          />
        </Card>
      </div>

      {/* Sequence comparison table */}
      <Card title="Sequence Performance">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground uppercase">Sequence</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground uppercase">Sent</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground uppercase">Opened</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground uppercase">Open Rate</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground uppercase">Replied</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground uppercase">Reply Rate</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground uppercase">Meetings</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground uppercase">SAOs</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-card-border">
              {sequences.map((seq, i) => {
                const openRate = num(seq.m.sent) > 0 ? (num(seq.m.opened) / num(seq.m.sent)) * 100 : 0;
                const replyRate = num(seq.m.sent) > 0 ? (num(seq.m.replied) / num(seq.m.sent)) * 100 : 0;
                return (
                  <tr key={seq.name} className={`hover:bg-muted/30 ${i % 2 === 1 ? 'bg-muted/15' : ''}`}>
                    <td className="px-3 py-2 text-foreground font-medium">
                      <span className="inline-block w-2.5 h-2.5 rounded-full mr-2" style={{ backgroundColor: seq.color }} />
                      {seq.name}
                    </td>
                    <td className="px-3 py-2 text-right text-muted-foreground tabular-nums">{fmtCompact(num(seq.m.sent))}</td>
                    <td className="px-3 py-2 text-right text-muted-foreground tabular-nums">{fmtCompact(num(seq.m.opened))}</td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      <span className={openRate >= 30 ? 'text-green-500' : openRate >= 20 ? 'text-foreground' : 'text-red-500'}>{pctRaw(openRate)}</span>
                    </td>
                    <td className="px-3 py-2 text-right text-muted-foreground tabular-nums">{fmtCompact(num(seq.m.replied))}</td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      <span className={replyRate >= 5 ? 'text-green-500' : replyRate >= 2 ? 'text-foreground' : 'text-red-500'}>{pctRaw(replyRate)}</span>
                    </td>
                    <td className="px-3 py-2 text-right font-medium text-foreground tabular-nums">{num(seq.m.meetings)}</td>
                    <td className="px-3 py-2 text-right font-medium text-foreground tabular-nums">{num(seq.m.saos)}</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="bg-muted/50 font-semibold">
              <tr>
                <td className="px-3 py-2 text-foreground">Total</td>
                <td className="px-3 py-2 text-right tabular-nums">{fmtCompact(totals.sent)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{fmtCompact(totals.opened)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{pctRaw(totals.sent > 0 ? (totals.opened / totals.sent) * 100 : 0)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{fmtCompact(totals.replied)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{pctRaw(totals.sent > 0 ? (totals.replied / totals.sent) * 100 : 0)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{totals.meetings}</td>
                <td className="px-3 py-2 text-right tabular-nums">{totals.saos}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </Card>
    </div>
  );
}

// ─── Event Lead Progress Tab (SFDC) ─────────────────────
function EventLeadProgress({ rows }: { rows: CampaignReportData[] }) {
  const events = useMemo(() => {
    return rows.map((r, i) => ({
      name: r.label,
      color: THEME_COLORS[i % THEME_COLORS.length],
      m: r.metrics as Record<string, number>,
    }));
  }, [rows]);

  const totals = useMemo(() => {
    const t = { registered: 0, attended: 0, mql: 0, sao: 0, opportunity: 0, closedWon: 0, revenue: 0 };
    for (const e of events) {
      t.registered += num(e.m.registered);
      t.attended += num(e.m.attended);
      t.mql += num(e.m.mql);
      t.sao += num(e.m.sao);
      t.opportunity += num(e.m.opportunity);
      t.closedWon += num(e.m.closedWon);
      t.revenue += num(e.m.revenue);
    }
    return t;
  }, [events]);

  return (
    <div className="space-y-4">
      <Card>
        <div className="grid grid-cols-3 md:grid-cols-7 gap-3">
          <Stat label="Registered" value={fmtCompact(totals.registered)} />
          <Stat label="Attended" value={fmtCompact(totals.attended)} sub={pctRaw(totals.registered > 0 ? (totals.attended / totals.registered) * 100 : 0)} />
          <Stat label="MQL" value={fmtCompact(totals.mql)} color="#3B53FF" />
          <Stat label="SAO" value={fmtCompact(totals.sao)} color="#006170" />
          <Stat label="Opportunity" value={fmtCompact(totals.opportunity)} color="#7A00C1" />
          <Stat label="Closed Won" value={fmtCompact(totals.closedWon)} color="#FF715A" />
          <Stat label="Revenue" value={formatCurrency(totals.revenue)} color="#FFA943" />
        </div>
      </Card>

      {/* Conversion rings + Lead progression waterfall */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card title="Event Conversion Rates" className="flex flex-col items-center justify-center">
          <div className="grid grid-cols-2 gap-4 py-2">
            <div className="flex flex-col items-center gap-1">
              <ProgressRing value={totals.attended} max={totals.registered} color="#FF715A" size={60} strokeWidth={4} />
              <span className="text-[10px] text-muted-foreground">Attendance</span>
            </div>
            <div className="flex flex-col items-center gap-1">
              <ProgressRing value={totals.mql} max={totals.attended} color="#3B53FF" size={60} strokeWidth={4} />
              <span className="text-[10px] text-muted-foreground">MQL Rate</span>
            </div>
            <div className="flex flex-col items-center gap-1">
              <ProgressRing value={totals.sao} max={totals.mql} color="#006170" size={60} strokeWidth={4} />
              <span className="text-[10px] text-muted-foreground">SAO Rate</span>
            </div>
            <div className="flex flex-col items-center gap-1">
              <ProgressRing value={totals.closedWon} max={totals.opportunity} color="#FFA943" size={60} strokeWidth={4} />
              <span className="text-[10px] text-muted-foreground">Win Rate</span>
            </div>
          </div>
        </Card>

        <Card title="Lead Progression Waterfall" className="lg:col-span-2">
          <FunnelChart
            stages={[
              { label: 'Registered', value: totals.registered },
              { label: 'Attended', value: totals.attended },
              { label: 'MQL', value: totals.mql },
              { label: 'SAO', value: totals.sao },
              { label: 'Opportunity', value: totals.opportunity },
              { label: 'Closed Won', value: totals.closedWon },
            ]}
            color="#FF715A"
          />
        </Card>
      </div>

      {/* Event comparison table */}
      <Card title="Event-by-Event Lead Progress">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground uppercase">Event</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground uppercase">Registered</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground uppercase">Attended</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground uppercase">Att. Rate</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground uppercase">MQL</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground uppercase">SAO</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground uppercase">Opp</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground uppercase">Won</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground uppercase">Revenue</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-card-border">
              {events.map((ev, i) => {
                const attRate = num(ev.m.registered) > 0 ? (num(ev.m.attended) / num(ev.m.registered)) * 100 : 0;
                return (
                  <tr key={ev.name} className={`hover:bg-muted/30 ${i % 2 === 1 ? 'bg-muted/15' : ''}`}>
                    <td className="px-3 py-2 text-foreground font-medium">
                      <span className="inline-block w-2.5 h-2.5 rounded-full mr-2" style={{ backgroundColor: ev.color }} />
                      {ev.name}
                    </td>
                    <td className="px-3 py-2 text-right text-muted-foreground tabular-nums">{num(ev.m.registered)}</td>
                    <td className="px-3 py-2 text-right text-muted-foreground tabular-nums">{num(ev.m.attended)}</td>
                    <td className="px-3 py-2 text-right text-muted-foreground tabular-nums">{pctRaw(attRate)}</td>
                    <td className="px-3 py-2 text-right text-foreground tabular-nums">{num(ev.m.mql)}</td>
                    <td className="px-3 py-2 text-right text-foreground tabular-nums">{num(ev.m.sao)}</td>
                    <td className="px-3 py-2 text-right text-foreground tabular-nums">{num(ev.m.opportunity)}</td>
                    <td className="px-3 py-2 text-right font-medium text-foreground tabular-nums">{num(ev.m.closedWon)}</td>
                    <td className="px-3 py-2 text-right text-muted-foreground tabular-nums">{formatCurrency(num(ev.m.revenue))}</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="bg-muted/50 font-semibold">
              <tr>
                <td className="px-3 py-2 text-foreground">Total</td>
                <td className="px-3 py-2 text-right tabular-nums">{totals.registered}</td>
                <td className="px-3 py-2 text-right tabular-nums">{totals.attended}</td>
                <td className="px-3 py-2 text-right tabular-nums">{pctRaw(totals.registered > 0 ? (totals.attended / totals.registered) * 100 : 0)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{totals.mql}</td>
                <td className="px-3 py-2 text-right tabular-nums">{totals.sao}</td>
                <td className="px-3 py-2 text-right tabular-nums">{totals.opportunity}</td>
                <td className="px-3 py-2 text-right tabular-nums">{totals.closedWon}</td>
                <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(totals.revenue)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </Card>
    </div>
  );
}
