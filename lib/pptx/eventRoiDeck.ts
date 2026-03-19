import {
  createPptx,
  addTitleSlide,
  addKpiSlide,
  addTableSlide,
  addTwoColumnKpiSlide,
  addSectionSlide,
  fmtCurrency,
  fmtCompact,
  fmtPct,
  safeDiv,
  downloadPptx,
  BRAND,
  FONTS,
} from './shared';
import type { KpiItem } from './shared';

interface EventRoiData {
  event: {
    title: string;
    startDate: string;
    endDate: string;
    location: string | null;
    venue: string | null;
    statusName: string | null;
    seriesName: string | null;
  };
  financial: {
    cost: number;
    actualCost: number;
    variance: number;
    pipeline: number;
    revenue: number;
    roi: number;
    costPerSao: number;
  };
  saos: {
    expected: number;
    actual: number;
  };
  attendees: {
    total: number;
    internal: number;
    customers: number;
    withPass: number;
    totalPasses: number | null;
    passUtilization: number;
    companies: string[];
  };
  subEvents: Array<{
    title: string;
    type: string | null;
    startDatetime: string;
    endDatetime: string;
    location: string | null;
  }>;
  checklist: {
    total: number;
    done: number;
    readinessPct: number;
  };
  priorEvent: {
    title: string;
    dates: string;
    cost: number;
    actualCost: number;
    expectedSaos: number;
    actualSaos: number;
    pipeline: number;
    revenue: number;
    totalPasses: number | null;
    attendees: number;
    roi: number;
    costPerSao: number;
  } | null;
  recommendation: string;
}

const RECOMMENDATION_LABELS: Record<string, string> = {
  invest: 'INVEST — Increase budget and scale',
  maintain: 'MAINTAIN — Continue at current level',
  reduce: 'REDUCE — Lower investment, optimize ROI',
  cut: 'CUT — Discontinue or radically restructure',
  new: 'NEW — First event, establish baseline',
};

export async function generateEventRoiDeck(data: EventRoiData): Promise<void> {
  const pptx = createPptx();
  const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

  // Slide 1: Title
  addTitleSlide(
    pptx,
    data.event.title,
    `${data.event.startDate} — ${data.event.endDate}${data.event.location ? ` | ${data.event.location}` : ''}`,
    today,
  );

  // Slide 2: Event Overview
  addKpiSlide(pptx, 'Event Overview', [
    { label: 'Status', value: data.event.statusName || 'N/A' },
    { label: 'Venue', value: data.event.venue || data.event.location || 'TBD' },
    { label: 'Total Passes', value: String(data.attendees.totalPasses || 0), sub: `${data.attendees.withPass} allocated` },
    { label: 'Sub-Events', value: String(data.subEvents.length) },
    { label: 'Readiness', value: fmtPct(data.checklist.readinessPct), sub: `${data.checklist.done}/${data.checklist.total} items` },
  ]);

  // Slide 3: Financial Summary
  addKpiSlide(pptx, 'Financial Summary', [
    { label: 'Planned Cost', value: fmtCurrency(data.financial.cost) },
    { label: 'Actual Cost', value: fmtCurrency(data.financial.actualCost), sub: data.financial.variance >= 0 ? `${fmtCurrency(data.financial.variance)} under` : `${fmtCurrency(Math.abs(data.financial.variance))} over` },
    { label: 'Pipeline', value: fmtCurrency(data.financial.pipeline) },
    { label: 'Revenue', value: fmtCurrency(data.financial.revenue) },
    { label: 'ROI', value: `${data.financial.roi.toFixed(1)}x` },
    { label: 'Cost/SAO', value: data.saos.actual > 0 ? fmtCurrency(data.financial.costPerSao) : 'N/A' },
  ]);

  // Slide 4: Attendee Breakdown
  addTableSlide(
    pptx,
    'Attendee Breakdown',
    ['Metric', 'Value'],
    [
      ['Total Attendees', String(data.attendees.total)],
      ['Internal', String(data.attendees.internal)],
      ['Customers', String(data.attendees.customers)],
      ['Companies Represented', String(data.attendees.companies.length)],
      ['Pass Utilization', fmtPct(data.attendees.passUtilization)],
      ['SAOs (Expected)', fmtCompact(data.saos.expected)],
      ['SAOs (Actual)', fmtCompact(data.saos.actual)],
    ],
  );

  // Slide 5: Sub-Events Summary
  if (data.subEvents.length > 0) {
    addTableSlide(
      pptx,
      'Sub-Events / Agenda',
      ['Title', 'Type', 'Start', 'End', 'Location'],
      data.subEvents.map((se) => [
        se.title,
        se.type || '-',
        se.startDatetime,
        se.endDatetime,
        se.location || '-',
      ]),
    );
  }

  // Slide 6: YoY Comparison
  if (data.priorEvent) {
    const p = data.priorEvent;
    addTwoColumnKpiSlide(
      pptx,
      `Year-over-Year: ${data.event.title}`,
      `Prior (${p.title})`,
      [
        { label: 'Cost', value: fmtCurrency(p.actualCost) },
        { label: 'SAOs', value: fmtCompact(p.actualSaos) },
        { label: 'Pipeline', value: fmtCurrency(p.pipeline) },
        { label: 'Revenue', value: fmtCurrency(p.revenue) },
        { label: 'ROI', value: `${p.roi.toFixed(1)}x` },
      ],
      `Current (${data.event.title})`,
      [
        { label: 'Cost', value: fmtCurrency(data.financial.actualCost), sub: costDelta(data.financial.actualCost, p.actualCost) },
        { label: 'SAOs', value: fmtCompact(data.saos.actual), sub: changePct(data.saos.actual, p.actualSaos) },
        { label: 'Pipeline', value: fmtCurrency(data.financial.pipeline), sub: changePct(data.financial.pipeline, p.pipeline) },
        { label: 'Revenue', value: fmtCurrency(data.financial.revenue), sub: changePct(data.financial.revenue, p.revenue) },
        { label: 'ROI', value: `${data.financial.roi.toFixed(1)}x`, sub: changePct(data.financial.roi, p.roi) },
      ],
    );
  }

  // Slide 7: Key Takeaways & Recommendation
  const slide = pptx.addSlide();
  slide.background = { color: BRAND.white };
  slide.addText('Key takeaways &\nrecommendation', {
    x: 0.5,
    y: 0.5,
    w: '90%',
    fontSize: 36,
    bold: true,
    color: BRAND.forestBlack,
    fontFace: FONTS.heading,
    charSpacing: -1,
    shadow: { type: 'none' } as any,
  });

  // Recommendation badge
  const recColor = {
    invest: BRAND.green,
    maintain: BRAND.blue,
    reduce: BRAND.orange,
    cut: BRAND.crimson,
    new: BRAND.teal,
  }[data.recommendation] || BRAND.textMuted;

  slide.addShape('rect' as any, {
    x: 0.5,
    y: 1.8,
    w: 11.5,
    h: 1.0,
    fill: { color: recColor },
    rectRadius: 0.08,
  });

  slide.addText(RECOMMENDATION_LABELS[data.recommendation] || data.recommendation, {
    x: 0.8,
    y: 1.8,
    w: 11,
    h: 1.0,
    fontSize: 22,
    bold: true,
    color: BRAND.white,
    fontFace: FONTS.heading,
    valign: 'middle',
    shadow: { type: 'none' } as any,
  });

  // Supporting data points — use small Teal rect shapes instead of bullet Unicode
  const points: string[] = [];
  if (data.financial.roi > 0) points.push(`ROI: ${data.financial.roi.toFixed(1)}x`);
  if (data.saos.actual > 0) points.push(`${fmtCompact(data.saos.actual)} SAOs generated`);
  if (data.financial.pipeline > 0) points.push(`${fmtCurrency(data.financial.pipeline)} pipeline created`);
  if (data.priorEvent) {
    const roiChange = safeDiv(data.financial.roi - data.priorEvent.roi, data.priorEvent.roi);
    points.push(`ROI ${roiChange >= 0 ? 'improved' : 'declined'} ${fmtPct(Math.abs(roiChange))} YoY`);
  }

  points.forEach((point, i) => {
    const y = 3.2 + i * 0.45;
    // Small Teal rectangle as bullet indicator (no Unicode)
    slide.addShape('rect' as any, {
      x: 0.8,
      y: y + 0.07,
      w: 0.12,
      h: 0.12,
      fill: { color: BRAND.teal },
    });
    slide.addText(point, {
      x: 1.1,
      y,
      w: 10.5,
      fontSize: 14,
      color: BRAND.forestBlack,
      fontFace: FONTS.body,
      shadow: { type: 'none' } as any,
    });
  });

  await downloadPptx(pptx, `Event_ROI_${data.event.title.replace(/[^a-zA-Z0-9]/g, '_')}`);
}

function changePct(current: number, prior: number): string {
  if (prior === 0) return current > 0 ? 'New' : '-';
  const change = safeDiv(current - prior, prior);
  const sign = change >= 0 ? '+' : '';
  return `${sign}${fmtPct(change)} YoY`;
}

function costDelta(current: number, prior: number): string {
  const diff = current - prior;
  if (diff === 0) return 'No change';
  return `${diff > 0 ? '+' : ''}${fmtCurrency(diff)} vs prior`;
}
