import PptxGenJS from 'pptxgenjs';

// ─── Brand Constants (Redwood) ──────────────────────────────────────
// See SLIDE_REPORT_GUIDELINES.md for full specification.

export const BRAND = {
  red:          'E24650',   // Logo mark, page number badge, photo borders. SPARINGLY.
  teal:         '006170',   // Primary brand. Section dividers, labels, CTA.
  turquoise:    '34E5E2',   // Accents on DARK backgrounds ONLY.
  forestBlack:  '082029',   // Title text on white, dark slide backgrounds.
  navyMid:      '0E2E38',   // Card backgrounds on dark slides.
  lightTeal:    'EBF5F3',   // Appendix / closing divider backgrounds, card fills.
  lightGrey:    'F2F2F2',   // Card backgrounds, subtle fills.
  white:        'FFFFFF',   // Default slide background, text on dark.
  textMuted:    '7C9AA3',   // Captions, footnotes, muted labels on white slides.
  textDim:      '8FB3BB',   // Dim text on dark slides.
  crimson:      'FF715A',   // Warning / problem state / negative data.
  orange:       'FFA943',   // Caution / secondary warning.
  blue:         '3B53FF',   // Supporting / informational.
  green:        '22C55E',   // Success indicators.
};

export const FONTS = {
  heading: 'Archivo',
  headingFallback: 'Arial Black',
  body: 'Roboto',
  bodyFallback: 'Calibri',
};

// ─── Shared Helpers ───────────────────────────────────────

export function fmtCurrency(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toFixed(0)}`;
}

export function fmtCompact(n: number): string {
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toFixed(0);
}

export function fmtPct(n: number): string {
  return `${(n * 100).toFixed(1)}%`;
}

export function safeDiv(a: number, b: number): number {
  return b === 0 ? 0 : a / b;
}

// ─── Slide Builders ───────────────────────────────────────

let slideNumber = 0;

export function createPptx(): PptxGenJS {
  const pptx = new PptxGenJS();
  pptx.layout = 'LAYOUT_WIDE';
  pptx.author = 'LaunchGrid';
  pptx.company = 'LaunchGrid';
  slideNumber = 0;
  return pptx;
}

/**
 * Adds the "Redwood" wordmark to the bottom-left of a slide.
 */
function addWordmark(slide: PptxGenJS.Slide, color: string): void {
  slide.addText('Redwood', {
    x: 0.5,
    y: 6.85,
    w: 1.5,
    h: 0.3,
    fontSize: 11,
    fontFace: FONTS.heading,
    bold: true,
    color,
    shadow: { type: 'none' } as any,
  });
}

/**
 * Adds the red page-number badge to the bottom-right.
 */
function addPageBadge(slide: PptxGenJS.Slide, num: number): void {
  slide.addShape('rect' as PptxGenJS.ShapeType, {
    x: 12.2,
    y: 6.85,
    w: 0.55,
    h: 0.3,
    fill: { color: BRAND.red },
    rectRadius: 0.04,
  });
  slide.addText(String(num), {
    x: 12.2,
    y: 6.85,
    w: 0.55,
    h: 0.3,
    fontSize: 10,
    fontFace: FONTS.body,
    bold: true,
    color: BRAND.white,
    align: 'center',
    valign: 'middle',
    shadow: { type: 'none' } as any,
  });
}

/**
 * Pattern A — Title slide (Forest Black bg)
 */
export function addTitleSlide(
  pptx: PptxGenJS,
  title: string,
  subtitle: string,
  date: string,
): void {
  slideNumber++;
  const slide = pptx.addSlide();
  slide.background = { color: BRAND.forestBlack };

  // Thin Turquoise accent bar at top, full width
  slide.addShape('rect' as PptxGenJS.ShapeType, {
    x: 0,
    y: 0,
    w: '100%',
    h: 0.04,
    fill: { color: BRAND.turquoise },
  });

  // Title: White, Extra-Bold, 42pt, left-aligned, stacked
  slide.addText(title, {
    x: 0.8,
    y: 1.5,
    w: '80%',
    fontSize: 42,
    bold: true,
    color: BRAND.white,
    fontFace: FONTS.heading,
    charSpacing: -1,
    shadow: { type: 'none' } as any,
  });

  // Subtitle: Turquoise, Light weight, 18pt
  slide.addText(subtitle, {
    x: 0.8,
    y: 3.2,
    w: '80%',
    fontSize: 18,
    color: BRAND.turquoise,
    fontFace: FONTS.heading,
    shadow: { type: 'none' } as any,
  });

  // Generated date: dim text
  slide.addText(`Generated ${date}`, {
    x: 0.8,
    y: 4.0,
    w: '80%',
    fontSize: 12,
    color: BRAND.textDim,
    fontFace: FONTS.body,
    shadow: { type: 'none' } as any,
  });

  // Footer strip: Navy Mid background
  slide.addShape('rect' as PptxGenJS.ShapeType, {
    x: 0,
    y: 6.6,
    w: '100%',
    h: 0.65,
    fill: { color: BRAND.navyMid },
  });

  // Wordmark in footer
  addWordmark(slide, BRAND.white);
}

/**
 * Pattern B — Section divider (Teal bg, NOT Forest Black)
 */
export function addSectionSlide(pptx: PptxGenJS, title: string): void {
  slideNumber++;
  const slide = pptx.addSlide();
  slide.background = { color: BRAND.teal };

  // Title: White, Light (not bold), 36pt, centered
  slide.addText(title, {
    x: 0.5,
    y: 2.8,
    w: '92%',
    fontSize: 36,
    bold: false,
    color: BRAND.white,
    fontFace: FONTS.heading,
    align: 'center',
    shadow: { type: 'none' } as any,
  });

  addWordmark(slide, BRAND.white);
}

export interface KpiItem {
  label: string;
  value: string;
  sub?: string;
}

/**
 * Pattern C-derived — KPI slide (White bg, content slide)
 */
export function addKpiSlide(
  pptx: PptxGenJS,
  title: string,
  kpis: KpiItem[],
): void {
  slideNumber++;
  const slide = pptx.addSlide();
  slide.background = { color: BRAND.white };

  // Title: Forest Black, Archivo Extra-Bold, 36pt
  slide.addText(title, {
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

  const cols = Math.min(kpis.length, 6);
  const boxW = 11.5 / cols;
  const startX = 0.5;

  kpis.forEach((kpi, i) => {
    const x = startX + i * boxW;
    // Box background — Light Grey
    slide.addShape('rect' as PptxGenJS.ShapeType, {
      x,
      y: 1.6,
      w: boxW - 0.15,
      h: 1.8,
      fill: { color: BRAND.lightGrey },
      rectRadius: 0.08,
    });
    // Label — muted
    slide.addText(kpi.label, {
      x,
      y: 1.7,
      w: boxW - 0.15,
      h: 0.35,
      fontSize: 11,
      color: BRAND.textMuted,
      fontFace: FONTS.body,
      align: 'center',
      valign: 'middle',
      shadow: { type: 'none' } as any,
    });
    // Stat value — large callout
    slide.addText(kpi.value, {
      x,
      y: 2.1,
      w: boxW - 0.15,
      h: 0.6,
      fontSize: 28,
      bold: true,
      color: BRAND.forestBlack,
      fontFace: FONTS.heading,
      align: 'center',
      valign: 'middle',
      charSpacing: -1,
      shadow: { type: 'none' } as any,
    });
    // Sub text
    if (kpi.sub) {
      slide.addText(kpi.sub, {
        x,
        y: 2.75,
        w: boxW - 0.15,
        h: 0.35,
        fontSize: 10,
        color: BRAND.textMuted,
        fontFace: FONTS.body,
        align: 'center',
        valign: 'middle',
        shadow: { type: 'none' } as any,
      });
    }
  });

  addWordmark(slide, BRAND.forestBlack);
  addPageBadge(slide, slideNumber);
}

type TableRow = Array<{ text: string; options?: PptxGenJS.TextPropsOptions }>;

/**
 * Pattern C-derived — Table slide (White bg)
 */
export function addTableSlide(
  pptx: PptxGenJS,
  title: string,
  headers: string[],
  rows: string[][],
  options?: { subtitle?: string },
): void {
  slideNumber++;
  const slide = pptx.addSlide();
  slide.background = { color: BRAND.white };

  // Title: Forest Black, Archivo Extra-Bold
  slide.addText(title, {
    x: 0.5,
    y: 0.5,
    w: '90%',
    fontSize: 32,
    bold: true,
    color: BRAND.forestBlack,
    fontFace: FONTS.heading,
    charSpacing: -1,
    shadow: { type: 'none' } as any,
  });

  if (options?.subtitle) {
    slide.addText(options.subtitle, {
      x: 0.5,
      y: 1.0,
      w: '90%',
      fontSize: 12,
      color: BRAND.textMuted,
      fontFace: FONTS.body,
      shadow: { type: 'none' } as any,
    });
  }

  // Header row: Teal bg, White text, Archivo Semi-Bold
  const headerRow: TableRow = headers.map((h) => ({
    text: h,
    options: {
      bold: true,
      color: BRAND.white,
      fill: { color: BRAND.teal },
      fontSize: 10,
      fontFace: FONTS.heading,
      align: 'left' as const,
      valign: 'middle' as const,
      shadow: { type: 'none' } as any,
    },
  }));

  // Data rows: alternate White / Light Grey
  const dataRows: TableRow[] = rows.map((row, rowIdx) =>
    row.map((cell) => ({
      text: cell,
      options: {
        fontSize: 10,
        color: BRAND.forestBlack,
        fontFace: FONTS.body,
        fill: { color: rowIdx % 2 === 0 ? BRAND.white : BRAND.lightGrey },
        valign: 'middle' as const,
        shadow: { type: 'none' } as any,
      },
    })),
  );

  const yStart = options?.subtitle ? 1.3 : 1.2;
  const tableW = Math.min(12, headers.length * (12 / Math.max(headers.length, 4)));

  slide.addTable([headerRow, ...dataRows], {
    x: 0.5,
    y: yStart,
    w: tableW,
    fontSize: 10,
    border: { type: 'solid', pt: 0.5, color: BRAND.lightTeal },
    rowH: 0.35,
    autoPage: true,
    autoPageRepeatHeader: true,
  });

  addWordmark(slide, BRAND.forestBlack);
  addPageBadge(slide, slideNumber);
}

export interface InsightItem {
  type: string;
  title: string;
  description: string;
  priority: string;
  metric?: string;
}

/**
 * Insights slide (White bg) — color-coded indicator bars (no Unicode symbols)
 */
export function addInsightsSlide(
  pptx: PptxGenJS,
  title: string,
  insights: InsightItem[],
): void {
  slideNumber++;
  const slide = pptx.addSlide();
  slide.background = { color: BRAND.white };

  slide.addText(title, {
    x: 0.5,
    y: 0.5,
    w: '90%',
    fontSize: 32,
    bold: true,
    color: BRAND.forestBlack,
    fontFace: FONTS.heading,
    charSpacing: -1,
    shadow: { type: 'none' } as any,
  });

  const typeColors: Record<string, string> = {
    warning: BRAND.orange,
    success: BRAND.green,
    improvement: BRAND.teal,
    suggestion: BRAND.teal,
    learning: BRAND.blue,
    opportunity: BRAND.blue,
  };

  const priorityLabels: Record<string, string> = {
    high: 'High',
    medium: 'Med',
    low: 'Low',
  };

  const maxInsights = Math.min(insights.length, 6);
  const itemH = 0.85;

  for (let i = 0; i < maxInsights; i++) {
    const insight = insights[i];
    const y = 1.3 + i * itemH;
    const color = typeColors[insight.type] || BRAND.textMuted;

    // Color indicator bar (shape, not Unicode)
    slide.addShape('rect' as PptxGenJS.ShapeType, {
      x: 0.5,
      y,
      w: 0.08,
      h: itemH - 0.1,
      fill: { color },
    });

    // Priority label — sentence case
    const priorityText = priorityLabels[insight.priority] || insight.priority;
    slide.addText(priorityText, {
      x: 0.7,
      y,
      w: 0.5,
      h: 0.25,
      fontSize: 8,
      bold: true,
      color,
      fontFace: FONTS.heading,
      align: 'left',
      valign: 'middle',
      shadow: { type: 'none' } as any,
    });

    // Insight title
    slide.addText(insight.title, {
      x: 0.7,
      y: y + 0.2,
      w: 11.5,
      h: 0.25,
      fontSize: 12,
      bold: true,
      color: BRAND.forestBlack,
      fontFace: FONTS.body,
      shadow: { type: 'none' } as any,
    });

    // Description
    slide.addText(insight.description, {
      x: 0.7,
      y: y + 0.42,
      w: 11.5,
      h: 0.3,
      fontSize: 10,
      color: BRAND.textMuted,
      fontFace: FONTS.body,
      shadow: { type: 'none' } as any,
    });
  }

  if (insights.length > maxInsights) {
    slide.addText(`+ ${insights.length - maxInsights} more insights`, {
      x: 0.5,
      y: 1.3 + maxInsights * itemH,
      w: '90%',
      fontSize: 10,
      italic: true,
      color: BRAND.textMuted,
      fontFace: FONTS.body,
      shadow: { type: 'none' } as any,
    });
  }

  addWordmark(slide, BRAND.forestBlack);
  addPageBadge(slide, slideNumber);
}

/**
 * Two-column KPI slide (White bg) with Teal left label and Teal right label
 */
export function addTwoColumnKpiSlide(
  pptx: PptxGenJS,
  title: string,
  leftLabel: string,
  leftKpis: KpiItem[],
  rightLabel: string,
  rightKpis: KpiItem[],
): void {
  slideNumber++;
  const slide = pptx.addSlide();
  slide.background = { color: BRAND.white };

  slide.addText(title, {
    x: 0.5,
    y: 0.5,
    w: '90%',
    fontSize: 32,
    bold: true,
    color: BRAND.forestBlack,
    fontFace: FONTS.heading,
    charSpacing: -1,
    shadow: { type: 'none' } as any,
  });

  // Left column header — Teal
  slide.addText(leftLabel, {
    x: 0.5,
    y: 1.3,
    w: 5.5,
    fontSize: 14,
    bold: true,
    color: BRAND.teal,
    fontFace: FONTS.heading,
    shadow: { type: 'none' } as any,
  });

  // Right column header — Teal
  slide.addText(rightLabel, {
    x: 6.5,
    y: 1.3,
    w: 5.5,
    fontSize: 14,
    bold: true,
    color: BRAND.teal,
    fontFace: FONTS.heading,
    shadow: { type: 'none' } as any,
  });

  const renderKpiColumn = (kpis: KpiItem[], startX: number) => {
    kpis.forEach((kpi, i) => {
      const y = 1.8 + i * 0.8;
      slide.addText(kpi.label, {
        x: startX,
        y,
        w: 5,
        fontSize: 11,
        color: BRAND.textMuted,
        fontFace: FONTS.body,
        shadow: { type: 'none' } as any,
      });
      slide.addText(kpi.value, {
        x: startX,
        y: y + 0.22,
        w: 5,
        fontSize: 20,
        bold: true,
        color: BRAND.forestBlack,
        fontFace: FONTS.heading,
        charSpacing: -1,
        shadow: { type: 'none' } as any,
      });
      if (kpi.sub) {
        slide.addText(kpi.sub, {
          x: startX,
          y: y + 0.5,
          w: 5,
          fontSize: 9,
          color: BRAND.textMuted,
          fontFace: FONTS.body,
          shadow: { type: 'none' } as any,
        });
      }
    });
  };

  renderKpiColumn(leftKpis, 0.5);
  renderKpiColumn(rightKpis, 6.5);

  // Divider line
  slide.addShape('line' as PptxGenJS.ShapeType, {
    x: 6.2,
    y: 1.3,
    w: 0,
    h: 4.5,
    line: { color: BRAND.lightTeal, width: 1 },
  });

  addWordmark(slide, BRAND.forestBlack);
  addPageBadge(slide, slideNumber);
}

export async function downloadPptx(pptx: PptxGenJS, fileName: string): Promise<void> {
  await pptx.writeFile({ fileName: `${fileName.replace(/[^a-zA-Z0-9_-]/g, '_')}.pptx` });
}
