'use client';

import { useState, useEffect, useMemo } from 'react';
import { formatCurrency } from '@/lib/utils';
import type { CampaignReportData } from '@/db/schema';

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

// ─── Mini bar for tables ──────────────────────────────────
function MiniBar({ value, max, color }: { value: number; max: number; color: string }) {
  const w = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  return (
    <div className="h-2 bg-muted rounded-full overflow-hidden w-20 inline-block ml-2 align-middle">
      <div className="h-full rounded-full" style={{ width: `${w}%`, backgroundColor: color }} />
    </div>
  );
}

// ─── Funnel visualization ─────────────────────────────────
function FunnelChart({ stages, color }: { stages: { label: string; value: number }[]; color: string }) {
  const maxVal = Math.max(...stages.map((s) => s.value), 1);
  return (
    <div className="space-y-2">
      {stages.map((stage, i) => {
        const w = Math.max((stage.value / maxVal) * 100, 8);
        const opacity = 1 - i * 0.12;
        return (
          <div key={stage.label} className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground w-28 text-right truncate">{stage.label}</span>
            <div className="flex-1 relative">
              <div
                className="h-7 rounded-md flex items-center px-2 transition-all"
                style={{
                  width: `${w}%`,
                  backgroundColor: color,
                  opacity,
                }}
              >
                <span className="text-xs font-semibold text-white">{fmtCompact(stage.value)}</span>
              </div>
            </div>
            {i > 0 && (
              <span className="text-[10px] text-muted-foreground w-14 text-right">
                {stages[i - 1].value > 0
                  ? pctRaw((stage.value / stages[i - 1].value) * 100)
                  : '—'}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Sparkline (simple SVG) ───────────────────────────────
function Sparkline({ data, color, height = 24 }: { data: number[]; color: string; height?: number }) {
  if (data.length < 2) return null;
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = max - min || 1;
  const w = 80;
  const points = data
    .map((v, i) => `${(i / (data.length - 1)) * w},${height - ((v - min) / range) * (height - 4) - 2}`)
    .join(' ');
  return (
    <svg width={w} height={height} className="inline-block align-middle">
      <polyline points={points} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ─── Section card wrapper ─────────────────────────────────
function Card({ title, children, className = '' }: { title?: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-card border border-card-border rounded-lg p-4 ${className}`}>
      {title && <h3 className="text-sm font-semibold text-foreground mb-3">{title}</h3>}
      {children}
    </div>
  );
}

// ─── KPI Stat ────────────────────────────────────────────
function Stat({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div className="text-center">
      <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1">{label}</div>
      <div className="text-xl font-bold" style={color ? { color } : undefined}>
        {value}
      </div>
      {sub && <div className="text-[10px] text-muted-foreground mt-0.5">{sub}</div>}
    </div>
  );
}

// ─── Horizontal stacked bar ──────────────────────────────
function StackedBar({ segments }: { segments: { label: string; value: number; color: string }[] }) {
  const total = segments.reduce((s, seg) => s + seg.value, 0);
  if (total === 0) return <div className="h-6 bg-muted rounded-md" />;
  return (
    <div className="space-y-1">
      <div className="h-6 rounded-md overflow-hidden flex bg-muted">
        {segments.map((seg) =>
          seg.value > 0 ? (
            <div
              key={seg.label}
              className="h-full transition-all"
              style={{ width: `${(seg.value / total) * 100}%`, backgroundColor: seg.color }}
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

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground text-sm">
        Loading campaign reports...
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground text-sm">
        No campaign reporting data available. Seed data to populate reports.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* ── Cross-tab Anomaly Highlights ──────────────────── */}
      {anomalies.length > 0 && (
        <div className="bg-card border border-card-border rounded-lg p-3">
          <div className="flex items-center gap-2 mb-2">
            <svg className="w-3.5 h-3.5 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 16 16">
              <path d="M8 2l1.5 3.5L13 7l-3.5 1.5L8 12l-1.5-3.5L3 7l3.5-1.5L8 2z" strokeWidth="1.5" strokeLinejoin="round"/>
            </svg>
            <h3 className="text-xs font-semibold text-foreground">Key Highlights Across All Tabs</h3>
            <span className="text-[10px] text-muted-foreground">({anomalies.length} items)</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5">
            {anomalies.map((anomaly, i) => (
              <button
                key={i}
                onClick={() => setTab(anomaly.tab)}
                className={`flex items-start gap-2 text-[11px] p-2 rounded-md text-left transition-colors hover:ring-1 hover:ring-accent/30 ${
                  anomaly.type === 'warning'
                    ? 'bg-amber-500/10 text-amber-400'
                    : anomaly.type === 'opportunity'
                    ? 'bg-green-500/10 text-green-400'
                    : 'bg-blue-500/10 text-blue-400'
                }`}
              >
                <span className="flex-shrink-0 mt-0.5">
                  {anomaly.type === 'warning' ? (
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 14 14"><path d="M7 1.5l5.5 10H1.5L7 1.5z" strokeWidth="1.5" strokeLinejoin="round"/><path d="M7 6v2" strokeWidth="1.5" strokeLinecap="round"/><circle cx="7" cy="10" r="0.5" fill="currentColor"/></svg>
                  ) : anomaly.type === 'opportunity' ? (
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 14 14"><path d="M2 10l3-3 2 2L12 4" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/><path d="M9 4h3v3" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  ) : (
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 14 14"><circle cx="7" cy="7" r="5" strokeWidth="1.5"/><path d="M7 5v2.5" strokeWidth="1.5" strokeLinecap="round"/><circle cx="7" cy="9.5" r="0.5" fill="currentColor"/></svg>
                  )}
                </span>
                <span className="flex-1">{anomaly.message}</span>
                <span className="flex-shrink-0 text-[9px] text-muted-foreground/60 uppercase">{tabs.find((t) => t.key === anomaly.tab)?.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Sub-tab bar */}
      <div className="flex items-center gap-1 overflow-x-auto pb-1">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-3 py-1.5 text-xs font-medium rounded-md whitespace-nowrap transition-colors flex items-center gap-1.5 ${
              tab === t.key
                ? 'bg-accent-purple text-white'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
            }`}
          >
            {t.label}
            {t.anomalyCount > 0 && (
              <span className={`inline-flex items-center justify-center w-4 h-4 rounded-full text-[9px] font-bold ${
                tab === t.key ? 'bg-white/20 text-white' : 'bg-amber-500/20 text-amber-500'
              }`}>{t.anomalyCount}</span>
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === 'themes' && <ThemePerformance rows={bySource['marketo_theme'] || []} />}
      {tab === 'channels' && <ChannelPerformance rows={bySource['marketo_channel'] || []} />}
      {tab === 'hero-assets' && <HeroAssets rows={bySource['hero_asset'] || []} />}
      {tab === 'linkedin' && <LinkedInAds rows={bySource['linkedin_ads'] || []} />}
      {tab === 'icp' && <ICPPenetration rows={bySource['icp_penetration'] || []} />}
      {tab === 'outreach' && <OutreachSequences rows={bySource['outreach_sequence'] || []} />}
      {tab === 'event-leads' && <EventLeadProgress rows={bySource['sfdc_event_leads'] || []} />}
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

      {/* Penetration funnel */}
      <Card title="Account Penetration Funnel">
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

      {/* Outreach funnel */}
      <Card title="Outreach Conversion Funnel">
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

      {/* Lead progression waterfall */}
      <Card title="Lead Progression Waterfall">
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
