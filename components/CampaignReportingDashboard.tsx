'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { formatCurrency } from '@/lib/utils';
import type { CampaignReportData } from '@/db/schema';
import dynamic from 'next/dynamic';
import { SolarAltArrowDown, SolarDownloadLinear } from './SolarIcons';
import { generateCampaignPerformanceDeck } from '@/lib/pptx/campaignDeck';
import type { InsightItem } from '@/lib/pptx/shared';

const WorldMapChart = dynamic(() => import('./WorldMapChart'), { ssr: false });

// ─── AI Insight type ────────────────────────────────────
interface AIInsight {
  type: 'learning' | 'improvement' | 'suggestion' | 'warning' | 'success';
  title: string;
  description: string;
  source: string;
  metric: string;
  priority: 'high' | 'medium' | 'low';
}

const INSIGHT_CONFIG: Record<string, { color: string; label: string }> = {
  learning: { color: '#3B53FF', label: 'Learning' },
  improvement: { color: '#7A00C1', label: 'Improvement' },
  suggestion: { color: '#006170', label: 'Suggestion' },
  warning: { color: '#FFA943', label: 'Warning' },
  success: { color: '#34E5E2', label: 'Success' },
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

// ─── Performance Notes Panel ─────────────────────────────
function AIInsightsPanel({ calendarId }: { calendarId: string }) {
  const [insights, setInsights] = useState<AIInsight[]>([]);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(true);
  const [filterType, setFilterType] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [expandedNote, setExpandedNote] = useState<number | null>(null);

  const fetchInsights = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/ai/campaign-insights?calendarId=${calendarId}`);
      if (res.ok) setInsights(await res.json());
    } catch (e) {
      console.error('Failed to fetch insights:', e);
    }
    setLoading(false);
  }, [calendarId]);

  useEffect(() => { fetchInsights(); }, [fetchInsights]);

  const filteredInsights = filterType ? insights.filter((i) => i.type === filterType) : insights;
  const visibleInsights = showAll ? filteredInsights : filteredInsights.slice(0, 3);
  const hasMore = filteredInsights.length > 3;

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
          <span className="text-sm font-semibold text-foreground">Performance Notes</span>
          {insights.length > 0 && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground font-medium">
              {insights.length}
            </span>
          )}
        </div>
        <motion.div
          animate={{ rotate: expanded ? 180 : 0 }}
          transition={{ duration: 0.2 }}
        >
          <SolarAltArrowDown className="w-4 h-4 text-muted-foreground" />
        </motion.div>
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
                  onClick={() => { setFilterType(null); setShowAll(false); setExpandedNote(null); }}
                  className={`px-2.5 py-1 text-[11px] rounded-md font-medium transition-colors ${
                    !filterType ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  All
                </button>
                {Object.entries(INSIGHT_CONFIG).map(([type, cfg]) => (
                  typeCounts[type] ? (
                    <button
                      key={type}
                      onClick={() => { setFilterType(filterType === type ? null : type); setShowAll(false); setExpandedNote(null); }}
                      className={`px-2.5 py-1 text-[11px] rounded-md font-medium transition-colors flex items-center gap-1.5 ${
                        filterType === type ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: cfg.color }} />
                      {cfg.label}
                    </button>
                  ) : null
                ))}
              </div>

              {loading && (
                <div className="flex items-center gap-2 py-4 justify-center text-xs text-muted-foreground">
                  <div className="w-4 h-4 border-2 border-muted-foreground/30 border-t-muted-foreground rounded-full animate-spin" />
                  Loading...
                </div>
              )}

              {!loading && filteredInsights.length === 0 && (
                <div className="text-center py-4 text-xs text-muted-foreground">
                  No observations for this filter.
                </div>
              )}

              {/* Insight rows */}
              <div className="divide-y divide-card-border">
                {visibleInsights.map((insight, i) => {
                  const cfg = INSIGHT_CONFIG[insight.type] || INSIGHT_CONFIG.learning;
                  const isNoteExpanded = expandedNote === i;
                  return (
                    <motion.div
                      key={`${insight.type}-${i}`}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.03, duration: 0.2 }}
                      className="px-3 py-2.5 cursor-pointer hover:bg-muted/30 transition-colors"
                      onClick={() => setExpandedNote(isNoteExpanded ? null : i)}
                    >
                      <div className="flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: cfg.color }} />
                        <span className="text-xs font-medium text-foreground flex-1 truncate">{insight.title}</span>
                        {insight.metric && (
                          <span className="text-xs font-semibold text-foreground tabular-nums flex-shrink-0">{insight.metric}</span>
                        )}
                      </div>
                      <AnimatePresence>
                        {isNoteExpanded && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.2, ease: 'easeInOut' }}
                            className="overflow-hidden"
                          >
                            <div className="text-[11px] text-muted-foreground pl-3.5 pt-1.5 leading-relaxed">{insight.description}</div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.div>
                  );
                })}
              </div>

              {/* Show all / Show less toggle */}
              {hasMore && (
                <button
                  onClick={() => setShowAll(!showAll)}
                  className="text-[11px] text-muted-foreground hover:text-foreground transition-colors pl-3"
                >
                  {showAll ? 'Show less' : `Show all ${filteredInsights.length} observations`}
                </button>
              )}
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

  // Reporting period state
  const now = new Date();
  const qStart = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
  const qEnd = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3 + 3, 0);
  const [periodStart, setPeriodStart] = useState(qStart.toISOString().split('T')[0]);
  const [periodEnd, setPeriodEnd] = useState(qEnd.toISOString().split('T')[0]);

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

  // ── Anomaly detection across all tabs ─────────────────
  const anomalies = useMemo(() => {
    const items: Array<{ type: 'warning' | 'opportunity' | 'info'; message: string; tab: ReportTab }> = [];

    // Theme anomalies
    const themes = (bySource['marketo_theme'] || []).map((r) => ({ name: r.label, m: r.metrics as Record<string, number> }));
    if (themes.length >= 2) {
      const themeRois = themes.filter((t) => num(t.m.spend) > 0).map((t) => ({ name: t.name, roi: num(t.m.pipeline) / num(t.m.spend) }));
      if (themeRois.length >= 2) {
        const sorted = [...themeRois].sort((a, b) => a.roi - b.roi);
        const worst = sorted[0];
        const best = sorted[sorted.length - 1];
        if (best.roi > worst.roi * 2 && worst.roi < 1) {
          items.push({ type: 'warning', message: `"${worst.name}" theme has ${worst.roi.toFixed(1)}x ROI vs ${best.roi.toFixed(1)}x for "${best.name}" — consider reallocating budget`, tab: 'themes' });
        }
      }
      // Theme with spend but no SAOs
      for (const t of themes) {
        if (num(t.m.spend) > 5000 && num(t.m.saos) === 0) {
          items.push({ type: 'warning', message: `"${t.name}" theme has ${formatCurrency(num(t.m.spend))} spend but zero SAOs`, tab: 'themes' });
        }
      }
    }

    // Channel anomalies
    const channels = (bySource['marketo_channel'] || []).map((r) => ({ name: r.label, m: r.metrics as Record<string, number> }));
    if (channels.length >= 2) {
      // Highest cost-per-MQL
      const costPerMqls = channels.filter((c) => num(c.m.mqls) > 0 && num(c.m.spend) > 0).map((c) => ({ name: c.name, cpm: num(c.m.spend) / num(c.m.mqls) }));
      if (costPerMqls.length >= 2) {
        const sorted = [...costPerMqls].sort((a, b) => b.cpm - a.cpm);
        const avg = costPerMqls.reduce((s, c) => s + c.cpm, 0) / costPerMqls.length;
        if (sorted[0].cpm > avg * 1.5) {
          items.push({ type: 'warning', message: `"${sorted[0].name}" cost/MQL (${formatCurrency(sorted[0].cpm)}) is ${Math.round((sorted[0].cpm / avg - 1) * 100)}% above average`, tab: 'channels' });
        }
      }
      // Lowest engagement rate
      const engRates = channels.filter((c) => num(c.m.views) > 100).map((c) => ({ name: c.name, rate: num(c.m.engagements) / num(c.m.views) }));
      if (engRates.length >= 2) {
        const sorted = [...engRates].sort((a, b) => a.rate - b.rate);
        const avg = engRates.reduce((s, c) => s + c.rate, 0) / engRates.length;
        if (sorted[0].rate < avg * 0.5) {
          items.push({ type: 'info', message: `"${sorted[0].name}" engagement rate (${pctRaw(sorted[0].rate * 100)}) is well below average (${pctRaw(avg * 100)})`, tab: 'channels' });
        }
      }
    }

    // LinkedIn anomalies
    const linkedin = (bySource['linkedin_ads'] || []).map((r) => ({ name: r.label, m: r.metrics as Record<string, number> }));
    for (const ad of linkedin) {
      const ctr = num(ad.m.impressions) > 0 ? num(ad.m.clicks) / num(ad.m.impressions) : 0;
      if (ctr < 0.003 && num(ad.m.impressions) > 1000) {
        items.push({ type: 'warning', message: `LinkedIn "${ad.name}" CTR is ${pctRaw(ctr * 100)} — below 0.3% benchmark`, tab: 'linkedin' });
      }
      if (num(ad.m.spend) > 5000 && num(ad.m.conversions) === 0) {
        items.push({ type: 'warning', message: `LinkedIn "${ad.name}" has ${formatCurrency(num(ad.m.spend))} spend with zero conversions`, tab: 'linkedin' });
      }
    }

    // Hero asset anomalies
    const assets = (bySource['hero_asset'] || []).map((r) => ({ name: r.label, m: r.metrics as Record<string, number> }));
    for (const a of assets) {
      const completionRate = num(a.m.downloads) > 0 ? num(a.m.completions) / num(a.m.downloads) : 0;
      if (completionRate < 0.3 && num(a.m.downloads) > 50) {
        items.push({ type: 'info', message: `"${a.name}" has ${pctRaw(completionRate * 100)} completion rate — content may need optimization`, tab: 'hero-assets' });
      }
    }

    // Success highlights
    if (themes.length > 0) {
      const bestTheme = themes.filter((t) => num(t.m.spend) > 0).sort((a, b) => (num(b.m.pipeline) / num(b.m.spend)) - (num(a.m.pipeline) / num(a.m.spend)))[0];
      if (bestTheme && num(bestTheme.m.pipeline) / num(bestTheme.m.spend) > 3) {
        items.push({ type: 'opportunity', message: `"${bestTheme.name}" theme is generating ${(num(bestTheme.m.pipeline) / num(bestTheme.m.spend)).toFixed(1)}x ROI — consider increasing investment`, tab: 'themes' });
      }
    }

    return items;
  }, [bySource]);

  const tabs: { key: ReportTab; label: string; anomalyCount: number }[] = [
    { key: 'themes', label: 'Theme Performance', anomalyCount: anomalies.filter((a) => a.tab === 'themes').length },
    { key: 'channels', label: 'Channel Performance', anomalyCount: anomalies.filter((a) => a.tab === 'channels').length },
    { key: 'hero-assets', label: 'Hero Assets', anomalyCount: anomalies.filter((a) => a.tab === 'hero-assets').length },
    { key: 'linkedin', label: 'LinkedIn & Ads', anomalyCount: anomalies.filter((a) => a.tab === 'linkedin').length },
    { key: 'icp', label: 'ICP Penetration', anomalyCount: 0 },
    { key: 'outreach', label: 'Outreach', anomalyCount: 0 },
    { key: 'event-leads', label: 'Event Leads', anomalyCount: 0 },
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

  const [exporting, setExporting] = useState(false);

  const handleExportDeck = useCallback(async () => {
    setExporting(true);
    try {
      const res = await fetch(`/api/reports/campaign-performance?calendarId=${calendarId}&periodStart=${periodStart}&periodEnd=${periodEnd}`);
      if (!res.ok) throw new Error('Failed to fetch report data');
      const reportData = await res.json();

      // Fetch AI insights
      let insights: InsightItem[] = [];
      try {
        const insightRes = await fetch(`/api/ai/campaign-insights?calendarId=${calendarId}`);
        if (insightRes.ok) {
          const insightData = await insightRes.json();
          insights = insightData.insights || [];
        }
      } catch {
        // Continue without insights
      }

      const periodLabel = `${periodStart} to ${periodEnd}`;
      await generateCampaignPerformanceDeck(reportData, insights, periodLabel);
    } catch (error) {
      console.error('Error generating campaign deck:', error);
      alert('Failed to generate campaign performance deck');
    }
    setExporting(false);
  }, [calendarId, periodStart, periodEnd]);

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
      {/* Header with Reporting Period + Export */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-card border border-card-border rounded-lg p-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Reporting Period</span>
          <input
            type="date"
            value={periodStart}
            onChange={(e) => setPeriodStart(e.target.value)}
            className="px-2 py-1 text-xs border border-card-border rounded-md bg-background text-foreground"
          />
          <span className="text-xs text-muted-foreground">to</span>
          <input
            type="date"
            value={periodEnd}
            onChange={(e) => setPeriodEnd(e.target.value)}
            className="px-2 py-1 text-xs border border-card-border rounded-md bg-background text-foreground"
          />
          <div className="flex gap-1 ml-1">
            {([
              ['This Month', () => { const n = new Date(); setPeriodStart(new Date(n.getFullYear(), n.getMonth(), 1).toISOString().split('T')[0]); setPeriodEnd(new Date(n.getFullYear(), n.getMonth() + 1, 0).toISOString().split('T')[0]); }],
              ['This Quarter', () => { const n = new Date(); const q = Math.floor(n.getMonth() / 3); setPeriodStart(new Date(n.getFullYear(), q * 3, 1).toISOString().split('T')[0]); setPeriodEnd(new Date(n.getFullYear(), q * 3 + 3, 0).toISOString().split('T')[0]); }],
              ['YTD', () => { const n = new Date(); setPeriodStart(new Date(n.getFullYear(), 0, 1).toISOString().split('T')[0]); setPeriodEnd(n.toISOString().split('T')[0]); }],
            ] as [string, () => void][]).map(([label, fn]) => (
              <button key={label} onClick={fn} className="px-2 py-1 text-[10px] font-medium text-muted-foreground bg-muted rounded hover:text-foreground transition-colors">
                {label}
              </button>
            ))}
          </div>
        </div>
        <button
          onClick={handleExportDeck}
          disabled={exporting}
          className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium text-white bg-accent-purple-btn rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 flex-shrink-0"
        >
          <SolarDownloadLinear className="w-4 h-4" />
          {exporting ? 'Generating...' : 'Export Performance Deck'}
        </button>
      </div>

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
            className={`px-3 py-1.5 text-xs font-medium rounded-md whitespace-nowrap transition-colors flex items-center gap-1.5 ${
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

// ─── ICP Sub-tab type ────────────────────────────────────
type ICPSubTab = 'overview' | 'stages' | 'scores' | 'sources' | 'geo' | 'untouched';

// ─── Stage colors ────────────────────────────────────────
const STAGE_COLORS: Record<string, string> = {
  'Untouched': '#94a3b8',
  'Identify': '#a78bfa',
  'Discovery': '#7A00C1',
  'Solution Overview': '#3B53FF',
  'Eval Planning': '#006170',
  'Structured Eval': '#0891b2',
  'Offer': '#FFA943',
  'Negotiation': '#FF715A',
  'Closed Won': '#22c55e',
  'Closed Lost': '#ef4444',
};

const FA_SCORE_COLORS: Record<string, string> = {
  'FA-A': '#22c55e',
  'FA-B': '#FFA943',
  'FA-C': '#ef4444',
  'Unknown': '#94a3b8',
};

const REGION_COLORS: Record<string, string> = {
  'Americas': '#3B53FF',
  'EMEA': '#7A00C1',
  'APAC': '#006170',
  'Other': '#94a3b8',
};

const STAGE_ORDER = ['Untouched', 'Identify', 'Discovery', 'Solution Overview', 'Eval Planning', 'Structured Eval', 'Offer', 'Negotiation', 'Closed Won', 'Closed Lost'];

interface ICPSummaryData {
  totalAccounts: number;
  totalOpportunities: number;
  untouchedAccounts: number;
  stageDistribution: Record<string, number>;
  oppTypeDistribution: Record<string, number>;
  leadSourceDistribution: Record<string, number>;
  faScoreDistribution: Record<string, number>;
  countryDistribution: Record<string, number>;
  regionDistribution: Record<string, number>;
  ownerDistribution: Record<string, number>;
  untouchedAccountTypeDistribution: Record<string, number>;
  activePipelineCount: number;
  closedWonCount: number;
  closedLostCount: number;
  targetAccounts: number;
  engaged: number;
  withMqls: number;
  withSaos: number;
  withOpportunity: number;
}

interface ICPAccountData {
  accountName: string;
  accountId: string;
  totalOpps: number;
  activeOpps: number;
  closedWon: number;
  closedLost: number;
  faScore: string;
  topStage: string;
  leadSources: string[];
  country: string;
  owners: string[];
  oppTypes: string[];
}

// ─── ICP Penetration Tab ────────────────────────────────
function ICPPenetration({ rows: _rows }: { rows: CampaignReportData[] }) {
  const [icpData, setIcpData] = useState<{ summary: ICPSummaryData; topAccounts: ICPAccountData[] } | null>(null);
  const [icpLoading, setIcpLoading] = useState(true);
  const [subTab, setSubTab] = useState<ICPSubTab>('overview');

  useEffect(() => {
    async function loadICP() {
      setIcpLoading(true);
      try {
        const res = await fetch('/api/icp-data');
        if (res.ok) {
          setIcpData(await res.json());
        }
      } catch (e) {
        console.error('Failed to load ICP data:', e);
      }
      setIcpLoading(false);
    }
    loadICP();
  }, []);

  if (icpLoading) {
    return <div className="flex items-center justify-center py-12 text-muted-foreground text-sm">Loading ICP data from spreadsheet...</div>;
  }

  if (!icpData) {
    return <div className="text-center py-12 text-muted-foreground text-sm">Failed to load ICP data. Ensure FA ICP Opps.xlsx is in the public folder.</div>;
  }

  const { summary: sm, topAccounts } = icpData;
  const totalTarget = sm.totalAccounts + sm.untouchedAccounts;
  const penetrationRate = totalTarget > 0 ? (sm.totalAccounts / totalTarget) * 100 : 0;
  const winRate = (sm.closedWonCount + sm.closedLostCount) > 0
    ? (sm.closedWonCount / (sm.closedWonCount + sm.closedLostCount)) * 100
    : 0;

  const icpSubTabs: { key: ICPSubTab; label: string }[] = [
    { key: 'overview', label: 'Overview' },
    { key: 'stages', label: 'Opportunity Stages' },
    { key: 'scores', label: 'CAPdB Scores' },
    { key: 'sources', label: 'Lead Sources' },
    { key: 'geo', label: 'Geography' },
    { key: 'untouched', label: 'Untouched Accounts' },
  ];

  return (
    <div className="space-y-4">
      {/* Sub-navigation */}
      <div className="flex items-center gap-1 overflow-x-auto">
        {icpSubTabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setSubTab(t.key)}
            className={`px-2.5 py-1 text-[11px] font-medium rounded transition-colors ${
              subTab === t.key
                ? 'bg-foreground/10 text-foreground'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

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

      {subTab === 'overview' && (
        <>
          {/* Stage Funnel using real stages */}
          <Card title="Opportunity Stage Funnel">
            <FunnelChart
              stages={STAGE_ORDER.filter((s) => num(sm.stageDistribution[s]) > 0).map((s) => ({
                label: s,
                value: num(sm.stageDistribution[s]),
              }))}
              color="#3B53FF"
            />
          </Card>

          {/* Opp Type & FA Score side by side */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card title="Opportunity Type Breakdown">
              <StackedBar
                segments={Object.entries(sm.oppTypeDistribution)
                  .sort(([, a], [, b]) => b - a)
                  .map(([label, value], i) => ({
                    label,
                    value,
                    color: THEME_COLORS[i % THEME_COLORS.length],
                  }))}
              />
            </Card>
            <Card title="FA Score Distribution">
              <StackedBar
                segments={['FA-A', 'FA-B', 'FA-C', 'Unknown']
                  .filter((s) => num(sm.faScoreDistribution[s]) > 0)
                  .map((label) => ({
                    label,
                    value: num(sm.faScoreDistribution[label]),
                    color: FA_SCORE_COLORS[label],
                  }))}
              />
            </Card>
          </div>

          {/* Top Accounts Table */}
          <Card title="Top Accounts by Active Opportunities">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground uppercase">Account</th>
                    <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground uppercase">Total Opps</th>
                    <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground uppercase">Active</th>
                    <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground uppercase">Won</th>
                    <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground uppercase">Lost</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground uppercase">FA Score</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground uppercase">Best Stage</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground uppercase">Country</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-card-border">
                  {topAccounts.map((acct, i) => (
                    <tr key={acct.accountId} className={`hover:bg-muted/30 ${i % 2 === 1 ? 'bg-muted/15' : ''}`}>
                      <td className="px-3 py-2 text-foreground font-medium">{acct.accountName}</td>
                      <td className="px-3 py-2 text-right text-muted-foreground tabular-nums">{acct.totalOpps}</td>
                      <td className="px-3 py-2 text-right text-foreground tabular-nums font-medium">{acct.activeOpps}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-green-500">{acct.closedWon}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-red-400">{acct.closedLost}</td>
                      <td className="px-3 py-2">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                          acct.faScore === 'FA-A' ? 'bg-green-500/15 text-green-500' :
                          acct.faScore === 'FA-B' ? 'bg-yellow-500/15 text-yellow-500' :
                          acct.faScore === 'FA-C' ? 'bg-red-500/15 text-red-400' :
                          'bg-muted text-muted-foreground'
                        }`}>{acct.faScore}</span>
                      </td>
                      <td className="px-3 py-2">
                        <span className="text-xs px-2 py-0.5 rounded-full" style={{
                          backgroundColor: `${STAGE_COLORS[acct.topStage] || '#94a3b8'}20`,
                          color: STAGE_COLORS[acct.topStage] || '#94a3b8',
                        }}>{acct.topStage}</span>
                      </td>
                      <td className="px-3 py-2 text-muted-foreground text-xs">{acct.country}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}

      {subTab === 'stages' && (
        <>
          <Card title="Opportunity Stage Distribution">
            <div className="space-y-3">
              {STAGE_ORDER.filter((s) => num(sm.stageDistribution[s]) > 0).map((stage) => {
                const count = num(sm.stageDistribution[stage]);
                const pctVal = sm.totalOpportunities > 0 ? (count / sm.totalOpportunities) * 100 : 0;
                return (
                  <div key={stage} className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground w-32 text-right">{stage}</span>
                    <div className="flex-1 h-6 bg-muted rounded-md overflow-hidden">
                      <div
                        className="h-full rounded-md flex items-center px-2"
                        style={{ width: `${pctVal}%`, backgroundColor: STAGE_COLORS[stage] || '#94a3b8', minWidth: count > 0 ? '2rem' : 0 }}
                      >
                        <span className="text-[10px] font-semibold text-white">{count}</span>
                      </div>
                    </div>
                    <span className="text-[10px] text-muted-foreground w-12 text-right">{pctRaw(pctVal)}</span>
                  </div>
                );
              })}
            </div>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <Stat label="Active Pipeline" value={String(sm.activePipelineCount)} sub="In-progress opps" color="#3B53FF" />
            </Card>
            <Card>
              <Stat label="Closed Won" value={String(sm.closedWonCount)} sub={pctRaw(winRate) + ' win rate'} color="#22c55e" />
            </Card>
            <Card>
              <Stat label="Closed Lost" value={String(sm.closedLostCount)} color="#ef4444" />
            </Card>
          </div>
        </>
      )}

      {subTab === 'scores' && (
        <>
          <Card title="CAPdB FA Score Distribution">
            <div className="space-y-3">
              {['FA-A', 'FA-B', 'FA-C', 'Unknown'].filter((s) => num(sm.faScoreDistribution[s]) > 0).map((score) => {
                const count = num(sm.faScoreDistribution[score]);
                const pctVal = sm.totalOpportunities > 0 ? (count / sm.totalOpportunities) * 100 : 0;
                return (
                  <div key={score} className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground w-20 text-right font-medium">{score}</span>
                    <div className="flex-1 h-7 bg-muted rounded-md overflow-hidden">
                      <div
                        className="h-full rounded-md flex items-center px-2"
                        style={{ width: `${pctVal}%`, backgroundColor: FA_SCORE_COLORS[score], minWidth: '2rem' }}
                      >
                        <span className="text-xs font-semibold text-white">{count} opps</span>
                      </div>
                    </div>
                    <span className="text-xs text-muted-foreground w-12 text-right">{pctRaw(pctVal)}</span>
                  </div>
                );
              })}
            </div>
          </Card>

          <Card title="Score Interpretation">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20">
                <div className="font-medium text-green-500 mb-1">FA-A (Best Fit)</div>
                <div className="text-xs text-muted-foreground">{fmtCompact(num(sm.faScoreDistribution['FA-A']))} opportunities from highest-scoring ICP accounts</div>
              </div>
              <div className="p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
                <div className="font-medium text-yellow-500 mb-1">FA-B (Good Fit)</div>
                <div className="text-xs text-muted-foreground">{fmtCompact(num(sm.faScoreDistribution['FA-B']))} opportunities from mid-tier ICP accounts</div>
              </div>
              <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                <div className="font-medium text-red-400 mb-1">FA-C (Lower Fit)</div>
                <div className="text-xs text-muted-foreground">{fmtCompact(num(sm.faScoreDistribution['FA-C']))} opportunities from lower-scoring accounts</div>
              </div>
            </div>
          </Card>
        </>
      )}

      {subTab === 'sources' && (
        <>
          <Card title="Lead Source Attribution">
            <div className="space-y-2">
              {Object.entries(sm.leadSourceDistribution)
                .sort(([, a], [, b]) => b - a)
                .map(([source, count], i) => {
                  const pctVal = sm.totalOpportunities > 0 ? (count / sm.totalOpportunities) * 100 : 0;
                  return (
                    <div key={source} className="flex items-center gap-3">
                      <span className="text-xs text-muted-foreground w-36 text-right truncate" title={source}>{source}</span>
                      <div className="flex-1 h-5 bg-muted rounded-md overflow-hidden">
                        <div
                          className="h-full rounded-md"
                          style={{ width: `${pctVal}%`, backgroundColor: THEME_COLORS[i % THEME_COLORS.length], minWidth: count > 0 ? '0.5rem' : 0 }}
                        />
                      </div>
                      <span className="text-xs text-foreground tabular-nums w-10 text-right">{count}</span>
                      <span className="text-[10px] text-muted-foreground w-12 text-right">{pctRaw(pctVal)}</span>
                    </div>
                  );
                })}
            </div>
          </Card>

          <Card title="Top 10 Opportunity Owners">
            <div className="space-y-2">
              {Object.entries(sm.ownerDistribution)
                .sort(([, a], [, b]) => b - a)
                .slice(0, 10)
                .map(([owner, count], i) => {
                  const pctVal = sm.totalOpportunities > 0 ? (count / sm.totalOpportunities) * 100 : 0;
                  return (
                    <div key={owner} className="flex items-center gap-3">
                      <span className="text-xs text-muted-foreground w-36 text-right truncate" title={owner}>{owner}</span>
                      <div className="flex-1 h-5 bg-muted rounded-md overflow-hidden">
                        <div
                          className="h-full rounded-md"
                          style={{ width: `${pctVal}%`, backgroundColor: CHANNEL_COLORS[i % CHANNEL_COLORS.length], minWidth: '0.5rem' }}
                        />
                      </div>
                      <span className="text-xs text-foreground tabular-nums w-10 text-right">{count}</span>
                    </div>
                  );
                })}
            </div>
          </Card>
        </>
      )}

      {subTab === 'geo' && (
        <>
          <Card title="Global Account Distribution">
            <WorldMapChart
              countryDistribution={sm.countryDistribution}
              totalOpportunities={sm.totalOpportunities}
            />
          </Card>

          <Card title="Regional Distribution">
            <StackedBar
              segments={Object.entries(sm.regionDistribution)
                .sort(([, a], [, b]) => b - a)
                .map(([label, value]) => ({
                  label,
                  value,
                  color: REGION_COLORS[label] || '#94a3b8',
                }))}
            />
          </Card>

          <Card title="Country Breakdown">
            <div className="space-y-2">
              {Object.entries(sm.countryDistribution)
                .sort(([, a], [, b]) => b - a)
                .map(([country, count], i) => {
                  const pctVal = sm.totalOpportunities > 0 ? (count / sm.totalOpportunities) * 100 : 0;
                  return (
                    <div key={country} className="flex items-center gap-3">
                      <span className="text-xs text-muted-foreground w-40 text-right truncate">{country}</span>
                      <div className="flex-1 h-5 bg-muted rounded-md overflow-hidden">
                        <div
                          className="h-full rounded-md"
                          style={{ width: `${pctVal}%`, backgroundColor: THEME_COLORS[i % THEME_COLORS.length], minWidth: count > 0 ? '0.5rem' : 0 }}
                        />
                      </div>
                      <span className="text-xs text-foreground tabular-nums w-10 text-right">{count}</span>
                      <span className="text-[10px] text-muted-foreground w-12 text-right">{pctRaw(pctVal)}</span>
                    </div>
                  );
                })}
            </div>
          </Card>
        </>
      )}

      {subTab === 'untouched' && (
        <>
          <Card>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <Stat label="Untouched ICP Accounts" value={fmtCompact(sm.untouchedAccounts)} color="#ef4444" />
              <Stat label="Engaged ICP Accounts" value={fmtCompact(sm.totalAccounts)} color="#22c55e" />
              <Stat label="Penetration Rate" value={pctRaw(penetrationRate)} sub="Engaged / Total ICP" color="#3B53FF" />
            </div>
          </Card>

          <Card title="Untouched Accounts by Type">
            <StackedBar
              segments={Object.entries(sm.untouchedAccountTypeDistribution)
                .sort(([, a], [, b]) => b - a)
                .map(([label, value], i) => ({
                  label,
                  value,
                  color: THEME_COLORS[i % THEME_COLORS.length],
                }))}
            />
          </Card>

          <Card title="Untouched vs Engaged Breakdown">
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <span className="text-xs text-muted-foreground w-24 text-right">Engaged</span>
                <div className="flex-1 h-7 bg-muted rounded-md overflow-hidden">
                  <div className="h-full rounded-md flex items-center px-2" style={{ width: `${penetrationRate}%`, backgroundColor: '#22c55e' }}>
                    <span className="text-xs font-semibold text-white">{sm.totalAccounts} accounts</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-muted-foreground w-24 text-right">Untouched</span>
                <div className="flex-1 h-7 bg-muted rounded-md overflow-hidden">
                  <div className="h-full rounded-md flex items-center px-2" style={{ width: `${100 - penetrationRate}%`, backgroundColor: '#ef4444' }}>
                    <span className="text-xs font-semibold text-white">{sm.untouchedAccounts} accounts</span>
                  </div>
                </div>
              </div>
            </div>
          </Card>
        </>
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
