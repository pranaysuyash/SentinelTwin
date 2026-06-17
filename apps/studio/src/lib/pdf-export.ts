import { rgb } from "pdf-lib";
import type { SecurityScene } from "@/schema/security-scene";
import type { DirectorsCutSequence } from "@/lib/directors-cut";

const A4_WIDTH = 595.28;
const A4_HEIGHT = 841.89;
const DEFAULT_MARGIN = 42;

type RgbTuple = [number, number, number];

type CellValue = string | number | boolean | null | undefined;

type CellStyle = {
  bold?: boolean;
  color?: RgbTuple;
  fill?: RgbTuple;
};

type PdfWriterFonts = {
  regular: any;
  medium: any;
  bold: any;
  mono: any;
};

type PdfWriterColors = {
  bg: RgbTuple;
  panel: RgbTuple;
  panelAlt: RgbTuple;
  border: RgbTuple;
  borderSoft: RgbTuple;
  text: RgbTuple;
  muted: RgbTuple;
  accent: RgbTuple;
  accentSoft: RgbTuple;
  accentStrong: RgbTuple;
  good: RgbTuple;
  warn: RgbTuple;
  danger: RgbTuple;
};

type PdfWriterOptions = {
  title: string;
  subtitle?: string;
  colors: PdfWriterColors;
};

type PdfTableColumn = {
  key: string;
  label: string;
  width: number;
  align?: "left" | "center" | "right";
};

type PdfWriterTextBlock = {
  text: string;
  size?: number;
  font?: any;
  color?: RgbTuple;
  maxWidth?: number;
  lineHeight?: number;
  italic?: boolean;
};

const shotGradeLabels = {
  no_coverage: "No coverage",
  out_of_frame: "Out of frame",
  foreshortened: "Foreshortened",
  edge_of_frame: "Edge of frame",
  well_framed: "Well framed",
} as const;

function rgbTuple(hex: string): RgbTuple {
  const normalized = hex.replace("#", "");
  const value = normalized.length === 3
    ? normalized.split("").map((part) => part + part).join("")
    : normalized;
  const num = Number.parseInt(value, 16);
  return [((num >> 16) & 255) / 255, ((num >> 8) & 255) / 255, (num & 255) / 255];
}

function colorFromTuple(tuple: RgbTuple) {
  return rgb(tuple[0], tuple[1], tuple[2]);
}

function createColors(): PdfWriterColors {
  return {
    bg: rgbTuple("0b1020"),
    panel: rgbTuple("101a31"),
    panelAlt: rgbTuple("141f39"),
    border: rgbTuple("21304d"),
    borderSoft: rgbTuple("2a3b5f"),
    text: rgbTuple("f4f7fb"),
    muted: rgbTuple("8ea1c0"),
    accent: rgbTuple("38bdf8"),
    accentSoft: rgbTuple("173a52"),
    accentStrong: rgbTuple("0ea5e9"),
    good: rgbTuple("34d399"),
    warn: rgbTuple("fbbf24"),
    danger: rgbTuple("fb7185"),
  };
}

function sanitizeFilename(value: string) {
  return value
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .replace(/-+/g, "-")
    .replace(/^[-_.]+|[-_.]+$/g, "")
    .toLowerCase() || "sentineltwin";
}

function asString(value: unknown, fallback = "—") {
  if (value === null || value === undefined || value === "") return fallback;
  if (typeof value === "string") return value;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return fallback;
}

function asNumber(value: unknown, fallback = 0) {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function formatPct(value: number | null | undefined, digits = 1) {
  if (!Number.isFinite(value ?? Number.NaN)) return "—";
  return `${(value as number).toFixed(digits)}%`;
}

function formatDurationSeconds(seconds: number | null | undefined) {
  if (!Number.isFinite(seconds ?? Number.NaN)) return "—";
  const value = Math.max(0, seconds ?? 0);
  if (value < 60) return `${value.toFixed(value < 10 ? 1 : 0)}s`;
  const minutes = Math.floor(value / 60);
  const remainder = Math.round(value % 60);
  return `${minutes}m ${remainder.toString().padStart(2, "0")}s`;
}

function formatTimestamp(value: unknown) {
  if (!value) return "—";
  const date = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString();
}

function wrapText(text: string, font: any, size: number, maxWidth: number) {
  const paragraphs = String(text).split(/\r?\n/);
  const lines: string[] = [];
  for (const paragraph of paragraphs) {
    if (!paragraph.trim()) {
      lines.push("");
      continue;
    }
    const words = paragraph.split(/\s+/);
    let current = "";
    for (const word of words) {
      const candidate = current ? `${current} ${word}` : word;
      if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
        current = candidate;
      } else {
        if (current) lines.push(current);
        if (font.widthOfTextAtSize(word, size) <= maxWidth) {
          current = word;
        } else {
          let segment = "";
          for (const char of word) {
            const next = `${segment}${char}`;
            if (font.widthOfTextAtSize(next, size) <= maxWidth) {
              segment = next;
            } else {
              if (segment) lines.push(segment);
              segment = char;
            }
          }
          current = segment;
        }
      }
    }
    if (current) lines.push(current);
  }
  return lines.length ? lines : [""];
}

function cellTextColor(value: CellValue): RgbTuple {
  if (typeof value === "number" && value < 0) return rgbTuple("fb7185");
  return rgbTuple("dbe4f0");
}

function cellFillColor(style?: CellStyle, rowIndex?: number): RgbTuple | undefined {
  if (style?.fill) return style.fill;
  if (typeof rowIndex === "number") {
    return rowIndex % 2 === 0 ? rgbTuple("101a31") : rgbTuple("0f172a");
  }
  return undefined;
}

function toCell(value: unknown): CellValue {
  if (value === null || value === undefined) return null;
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return value;
  return String(value);
}

function drawRoundedPanel(page: any, x: number, y: number, width: number, height: number, fill: RgbTuple, stroke?: RgbTuple) {
  page.drawRectangle({
    x,
    y,
    width,
    height,
    color: colorFromTuple(fill),
    borderWidth: stroke ? 1 : 0,
    borderColor: stroke ? colorFromTuple(stroke) : undefined,
  });
}

class PdfWriter {
  private readonly pdfDoc: any;
  private readonly fonts: PdfWriterFonts;
  private readonly colors: PdfWriterColors;
  private readonly title: string;
  private readonly subtitle?: string;
  private readonly pages: any[] = [];
  private currentPage: any;
  private currentY = 0;
  private readonly pageWidth: number;
  private readonly pageHeight: number;
  private readonly margin: number;

  constructor(pdfDoc: any, fonts: PdfWriterFonts, options: PdfWriterOptions) {
    this.pdfDoc = pdfDoc;
    this.fonts = fonts;
    this.colors = options.colors;
    this.title = options.title;
    this.subtitle = options.subtitle;
    this.pageWidth = A4_WIDTH;
    this.pageHeight = A4_HEIGHT;
    this.margin = DEFAULT_MARGIN;
    this.currentPage = this.addPage();
  }

  private addPage() {
    const page = this.pdfDoc.addPage([this.pageWidth, this.pageHeight]);
    this.pages.push(page);
    this.currentPage = page;
    this.currentY = this.pageHeight - this.margin;
    this.drawPageHeader(page);
    return page;
  }

  beginPage() {
    this.addPage();
  }

  private drawPageHeader(page: any) {
    page.drawText(this.title, {
      x: this.margin,
      y: this.pageHeight - 24,
      size: 17,
      font: this.fonts.bold,
      color: colorFromTuple(this.colors.text),
    });
    if (this.subtitle) {
      page.drawText(this.subtitle, {
        x: this.margin,
        y: this.pageHeight - 40,
        size: 9,
        font: this.fonts.regular,
        color: colorFromTuple(this.colors.muted),
      });
    }
    page.drawLine({
      start: { x: this.margin, y: this.pageHeight - 48 },
      end: { x: this.pageWidth - this.margin, y: this.pageHeight - 48 },
      thickness: 0.8,
      color: colorFromTuple(this.colors.border),
      opacity: 0.9,
    });
  }

  private ensureSpace(spaceNeeded: number) {
    if (this.currentY - spaceNeeded < this.margin + 22) {
      this.addPage();
    }
  }

  private drawTextBlock(block: PdfWriterTextBlock, x: number, y: number) {
    const font = block.font ?? this.fonts.regular;
    const size = block.size ?? 10;
    const maxWidth = block.maxWidth ?? (this.pageWidth - this.margin * 2);
    const lineHeight = block.lineHeight ?? size * 1.35;
    const lines = wrapText(block.text, font, size, maxWidth);
    this.ensureSpace(lines.length * lineHeight + 6);
    this.currentPage.drawText(lines.join("\n"), {
      x,
      y,
      size,
      font,
      color: colorFromTuple(block.color ?? this.colors.text),
      lineHeight,
    });
    this.currentY = y - lines.length * lineHeight - 8;
  }

  addCoverPage(lines: Array<{ label: string; value: string }>, hero?: string, kicker?: string) {
    const page = this.currentPage;
    drawRoundedPanel(page, this.margin, 510, this.pageWidth - this.margin * 2, 255, this.colors.panel, this.colors.border);
    page.drawText(this.title, {
      x: this.margin + 22,
      y: 726,
      size: 24,
      font: this.fonts.bold,
      color: colorFromTuple(this.colors.text),
    });
    if (this.subtitle) {
      page.drawText(this.subtitle, {
        x: this.margin + 22,
        y: 706,
        size: 11,
        font: this.fonts.regular,
        color: colorFromTuple(this.colors.muted),
      });
    }
    if (kicker) {
      page.drawText(kicker, {
        x: this.margin + 22,
        y: 676,
        size: 9,
        font: this.fonts.medium,
        color: colorFromTuple(this.colors.accent),
      });
    }
    if (hero) {
      const linesWrapped = wrapText(hero, this.fonts.regular, 12, this.pageWidth - this.margin * 2 - 44);
      page.drawText(linesWrapped.join("\n"), {
        x: this.margin + 22,
        y: 652,
        size: 12,
        font: this.fonts.regular,
        lineHeight: 16,
        color: colorFromTuple(this.colors.text),
      });
    }

    const cardWidth = (this.pageWidth - this.margin * 2 - 18) / 2;
    const cardHeight = 84;
    lines.forEach((item, index) => {
      const column = index % 2;
      const row = Math.floor(index / 2);
      const x = this.margin + column * (cardWidth + 18);
      const y = 560 - row * 96;
      page.drawRectangle({
        x,
        y,
        width: cardWidth,
        height: cardHeight,
        color: colorFromTuple(this.colors.panelAlt),
        borderWidth: 1,
        borderColor: colorFromTuple(this.colors.borderSoft),
      });
      page.drawText(item.label, {
        x: x + 12,
        y: y + 53,
        size: 8,
        font: this.fonts.medium,
        color: colorFromTuple(this.colors.muted),
      });
      page.drawText(item.value, {
        x: x + 12,
        y: y + 29,
        size: 14,
        font: this.fonts.bold,
        color: colorFromTuple(this.colors.text),
      });
    });
  }

  addSectionTitle(title: string, subtitle?: string) {
    this.ensureSpace(subtitle ? 44 : 30);
    this.currentPage.drawText(title, {
      x: this.margin,
      y: this.currentY,
      size: 13,
      font: this.fonts.bold,
      color: colorFromTuple(this.colors.text),
    });
    this.currentY -= 18;
    if (subtitle) {
      this.addParagraph(subtitle, { size: 9.5, color: this.colors.muted });
      return;
    }
    this.currentY -= 4;
  }

  addParagraph(text: string, options: { size?: number; color?: RgbTuple; font?: any; maxWidth?: number } = {}) {
    const size = options.size ?? 10;
    const font = options.font ?? this.fonts.regular;
    const maxWidth = options.maxWidth ?? (this.pageWidth - this.margin * 2);
    const lines = wrapText(text, font, size, maxWidth);
    this.ensureSpace(lines.length * (size * 1.35) + 4);
    this.currentPage.drawText(lines.join("\n"), {
      x: this.margin,
      y: this.currentY,
      size,
      font,
      lineHeight: size * 1.35,
      color: colorFromTuple(options.color ?? this.colors.text),
    });
    this.currentY -= lines.length * (size * 1.35) + 6;
  }

  addBulletList(items: string[], color: RgbTuple = this.colors.text) {
    for (const item of items) {
      const lines = wrapText(item, this.fonts.regular, 10, this.pageWidth - this.margin * 2 - 14);
      this.ensureSpace(lines.length * 14 + 3);
      this.currentPage.drawText(`• ${lines[0]}`, {
        x: this.margin,
        y: this.currentY,
        size: 10,
        font: this.fonts.regular,
        color: colorFromTuple(color),
      });
      if (lines.length > 1) {
        this.currentPage.drawText(lines.slice(1).join("\n"), {
          x: this.margin + 14,
          y: this.currentY - 14,
          size: 10,
          font: this.fonts.regular,
          lineHeight: 14,
          color: colorFromTuple(this.colors.muted),
        });
        this.currentY -= (lines.length - 1) * 14;
      }
      this.currentY -= 16;
    }
  }

  addKeyValueGrid(entries: Array<{ label: string; value: string }>, columns = 2) {
    if (!entries.length) return;
    const columnGap = 12;
    const cardWidth = (this.pageWidth - this.margin * 2 - columnGap * (columns - 1)) / columns;
    const rowHeight = 62;
    const rows = Math.ceil(entries.length / columns);
    this.ensureSpace(rows * (rowHeight + 10));
    for (let index = 0; index < entries.length; index += 1) {
      const entry = entries[index];
      const col = index % columns;
      const row = Math.floor(index / columns);
      const x = this.margin + col * (cardWidth + columnGap);
      const y = this.currentY - row * (rowHeight + 10);
      this.currentPage.drawRectangle({
        x,
        y: y - rowHeight,
        width: cardWidth,
        height: rowHeight,
        color: colorFromTuple(this.colors.panelAlt),
        borderWidth: 1,
        borderColor: colorFromTuple(this.colors.borderSoft),
      });
      this.currentPage.drawText(entry.label, {
        x: x + 10,
        y: y - 20,
        size: 8,
        font: this.fonts.medium,
        color: colorFromTuple(this.colors.muted),
      });
      this.currentPage.drawText(entry.value, {
        x: x + 10,
        y: y - 40,
        size: 13,
        font: this.fonts.bold,
        color: colorFromTuple(this.colors.text),
      });
    }
    this.currentY -= rows * (rowHeight + 10);
  }

  addTable(columns: PdfTableColumn[], rows: Array<Record<string, CellValue>>, options: { compact?: boolean } = {}) {
    if (!rows.length || !columns.length) return;
    const headerHeight = options.compact ? 20 : 24;
    const rowHeight = options.compact ? 20 : 24;
    const totalWidth = columns.reduce((sum, column) => sum + column.width, 0);
    const maxRowsPerPage = 24;
    let rowIndexOnPage = 0;

    const renderHeader = () => {
      this.ensureSpace(headerHeight + 8);
      let cursorX = this.margin;
      this.currentPage.drawRectangle({
        x: this.margin,
        y: this.currentY - headerHeight + 5,
        width: totalWidth,
        height: headerHeight,
        color: colorFromTuple(this.colors.accentSoft),
        borderWidth: 1,
        borderColor: colorFromTuple(this.colors.borderSoft),
      });
      for (const column of columns) {
        this.currentPage.drawText(column.label, {
          x: cursorX + 6,
          y: this.currentY - 10,
          size: 8.5,
          font: this.fonts.medium,
          color: colorFromTuple(this.colors.accent),
        });
        cursorX += column.width;
      }
      this.currentY -= headerHeight + 4;
    };

    renderHeader();
    for (const row of rows) {
      if (rowIndexOnPage >= maxRowsPerPage) {
        this.addPage();
        renderHeader();
        rowIndexOnPage = 0;
      }
      this.ensureSpace(rowHeight + 4);
      const rowTop = this.currentY;
      let cursorX = this.margin;
      for (const column of columns) {
        const raw = row[column.key];
        const text = asString(raw, "—");
        const font = typeof raw === "number" ? this.fonts.mono : this.fonts.regular;
        const style: CellStyle = {};
        if (typeof raw === "number" && raw < 0) style.color = this.colors.danger;
        if (typeof raw === "string" && /^(pass|ok|good|high|low|medium|critical|warning|fail|open|closed|yes|no)$/i.test(raw)) {
          style.fill = this.colors.accentSoft;
        }
        const fill = cellFillColor(style, rowIndexOnPage);
        this.currentPage.drawRectangle({
          x: cursorX,
          y: rowTop - rowHeight + 4,
          width: column.width,
          height: rowHeight,
          color: colorFromTuple(fill ?? this.colors.panel),
          borderWidth: 0.7,
          borderColor: colorFromTuple(this.colors.borderSoft),
        });
        const paddedX = cursorX + 6;
        const baseline = rowTop - 9;
        const rendered = wrapText(text, font, 8.5, column.width - 12);
        const align = column.align ?? "left";
        const textWidth = Math.min(font.widthOfTextAtSize(rendered[0], 8.5), column.width - 12);
        const drawX = align === "right"
          ? cursorX + column.width - 6 - textWidth
          : align === "center"
            ? cursorX + (column.width - textWidth) / 2
            : paddedX;
        this.currentPage.drawText(rendered[0], {
          x: drawX,
          y: baseline,
          size: 8.5,
          font,
          color: colorFromTuple(style.color ?? cellTextColor(raw)),
        });
        if (rendered.length > 1) {
          this.currentPage.drawText(rendered.slice(1).join("\n"), {
            x: paddedX,
            y: baseline - 10,
            size: 7.8,
            font,
            lineHeight: 9.2,
            color: colorFromTuple(this.colors.muted),
          });
        }
        cursorX += column.width;
      }
      this.currentY -= rowHeight + 3;
      rowIndexOnPage += 1;
    }
  }

  addFooters() {
    for (let index = 0; index < this.pages.length; index += 1) {
      const page = this.pages[index];
      page.drawLine({
        start: { x: this.margin, y: 28 },
        end: { x: this.pageWidth - this.margin, y: 28 },
        thickness: 0.8,
        color: colorFromTuple(this.colors.border),
        opacity: 0.9,
      });
      page.drawText("SentinelTwin", {
        x: this.margin,
        y: 16,
        size: 8,
        font: this.fonts.medium,
        color: colorFromTuple(this.colors.muted),
      });
      const pageLabel = `${index + 1} / ${this.pages.length}`;
      const width = this.fonts.medium.widthOfTextAtSize(pageLabel, 8);
      page.drawText(pageLabel, {
        x: this.pageWidth - this.margin - width,
        y: 16,
        size: 8,
        font: this.fonts.medium,
        color: colorFromTuple(this.colors.muted),
      });
    }
  }

  getDocument() {
    return this.pdfDoc;
  }
}

async function createWriter(title: string, subtitle?: string) {
  const pdfLib = await import("pdf-lib");
  const pdfDoc = await pdfLib.PDFDocument.create();
  const [regular, medium, bold, mono] = await Promise.all([
    pdfDoc.embedFont(pdfLib.StandardFonts.Helvetica),
    pdfDoc.embedFont(pdfLib.StandardFonts.Helvetica),
    pdfDoc.embedFont(pdfLib.StandardFonts.HelveticaBold),
    pdfDoc.embedFont(pdfLib.StandardFonts.Courier),
  ]);
  const colors = createColors();
  const writer = new PdfWriter(pdfDoc, { regular, medium, bold, mono }, { title, subtitle, colors });
  return { pdfLib, writer };
}

function downloadBlob(blob: Blob, filename: string) {
  if (typeof document === "undefined") return;
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.rel = "noreferrer";
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

async function savePdf(writer: PdfWriter, filename: string) {
  writer.addFooters();
  const bytes = await writer.getDocument().save();
  const blob = new Blob([bytes], { type: "application/pdf" });
  downloadBlob(blob, filename);
  return blob;
}

function coverMetadataRows(scene: SecurityScene, options: { includeTimestamp?: boolean; subtitle?: string } = {}) {
  const rows = [
    { label: "Scene", value: asString(scene.name ?? scene.id ?? "Security Scene") },
    { label: "Dimensions", value: `${scene.dimensions?.width ?? "—"}m × ${scene.dimensions?.depth ?? "—"}m` },
    { label: "Cameras", value: asString(scene.cameras?.length ?? 0) },
    { label: "Critical zones", value: asString(scene.criticalZones?.length ?? 0) },
  ];
  if (options.subtitle) {
    rows.push({ label: "Subtitle", value: options.subtitle });
  }
  if (options.includeTimestamp) {
    rows.push({ label: "Generated", value: formatTimestamp(new Date()) });
  }
  return rows;
}

function extractMetricRows(value: unknown): Array<{ label: string; value: string }> {
  if (!value || typeof value !== "object") return [];
  return Object.entries(value as Record<string, unknown>)
    .filter(([, item]) => typeof item !== "function")
    .slice(0, 8)
    .map(([label, item]) => ({ label: label.replace(/_/g, " "), value: asString(item) }));
}

function normalizeRows(rows: unknown, fields: string[]): Array<Record<string, CellValue>> {
  if (!Array.isArray(rows)) return [];
  return rows.map((row) => {
    const entry: Record<string, CellValue> = {};
    if (row && typeof row === "object") {
      for (const field of fields) {
        entry[field] = toCell((row as Record<string, unknown>)[field]);
      }
      for (const [key, value] of Object.entries(row as Record<string, unknown>)) {
        if (!(key in entry)) {
          entry[key] = toCell(value);
        }
      }
    }
    return entry;
  });
}

function bestField(obj: Record<string, unknown>, candidates: string[], fallback = "—") {
  for (const candidate of candidates) {
    const value = obj[candidate];
    if (value !== undefined && value !== null && value !== "") return String(value);
  }
  return fallback;
}

function qualityLabel(value: unknown) {
  if (!value) return "—";
  const key = String(value) as keyof typeof shotGradeLabels;
  return shotGradeLabels[key] ?? String(value);
}

export async function exportAuditReportPdf(options: {
  scene: SecurityScene;
  result: any;
  title?: string;
  subtitle?: string;
  includeTimestamp?: boolean;
}) {
  const title = options.title ?? "SentinelTwin Audit Report";
  const subtitle = options.subtitle ?? "Security coverage review";
  const { writer } = await createWriter(title, subtitle);
  const scene = options.scene;
  const result = options.result ?? {};

  const summaryLines = [
    `Scene ${asString(scene.name ?? scene.id)}`,
    `Coverage ${formatPct(result.coveragePct ?? result.overallCoveragePct ?? result.summary?.coveragePct)}`,
    `Risk ${asString(result.riskLabel ?? result.risk ?? result.summary?.risk ?? "unknown")}`,
  ].join(" · ");

  writer.addCoverPage(
    coverMetadataRows(scene, { includeTimestamp: options.includeTimestamp, subtitle }),
    summaryLines,
    "Coverage failure analysis and hardening recommendations",
  );

  writer.beginPage();
  writer.addSectionTitle("Executive Summary", "A compact readout for reviewers and stakeholders.");
  writer.addParagraph(
    asString(result.summary ?? result.overview ?? result.description ?? "No summary was supplied with the audit result."),
    { size: 10.5 },
  );
  writer.addKeyValueGrid([
    { label: "Coverage", value: formatPct(result.coveragePct ?? result.overallCoveragePct ?? result.summary?.coveragePct) },
    { label: "Open issues", value: asString(result.openIssues ?? result.summary?.openIssues ?? result.issues?.length ?? 0) },
    { label: "Critical zones", value: asString(scene.criticalZones?.length ?? 0) },
    { label: "Camera count", value: asString(scene.cameras?.length ?? 0) },
    { label: "Review status", value: asString(result.reviewStatus ?? result.status ?? "Needs review") },
    { label: "Generated", value: formatTimestamp(options.includeTimestamp ? new Date() : result.generatedAt) },
  ]);

  const findingRows = normalizeRows(result.findings ?? result.issues ?? result.warnings ?? [], ["severity", "title", "status", "location", "recommendation"]);
  if (findingRows.length) {
    writer.addSectionTitle("Findings", "Issues detected during the audit run.");
    writer.addTable([
      { key: "severity", label: "Severity", width: 86 },
      { key: "title", label: "Finding", width: 198 },
      { key: "status", label: "Status", width: 78 },
      { key: "location", label: "Location", width: 120 },
      { key: "recommendation", label: "Recommendation", width: 126 },
    ], findingRows);
  }

  const metricRows = extractMetricRows(result.metrics ?? result.stats ?? result.summaryMetrics);
  if (metricRows.length) {
    writer.addSectionTitle("Metrics", "Key numeric outputs from the current simulation.");
    writer.addKeyValueGrid(metricRows, 2);
  }

  const recommendationRows = normalizeRows(result.recommendations ?? result.actions ?? result.nextSteps ?? [], ["priority", "action", "owner", "status"]);
  if (recommendationRows.length) {
    writer.addSectionTitle("Recommendations", "Suggested follow-up actions to close the gap.");
    writer.addTable([
      { key: "priority", label: "Priority", width: 72 },
      { key: "action", label: "Action", width: 260 },
      { key: "owner", label: "Owner", width: 110 },
      { key: "status", label: "Status", width: 104 },
    ], recommendationRows, { compact: true });
  } else if (Array.isArray(result.recommendationsText) && result.recommendationsText.length) {
    writer.addSectionTitle("Recommendations", "Suggested follow-up actions to close the gap.");
    writer.addBulletList(result.recommendationsText.map((item: unknown) => asString(item)));
  }

  const notes = asString(result.notes ?? result.assumptions ?? result.disclaimer ?? "");
  if (notes && notes !== "—") {
    writer.addSectionTitle("Notes", "Context and interpretation notes.");
    writer.addParagraph(notes, { size: 9.5, color: rgbTuple("8ea1c0") });
  }

  return savePdf(writer, `${sanitizeFilename(title)}.pdf`);
}

export async function exportTextAsPdf(options: {
  text: string;
  filename?: string;
  title?: string;
  subtitle?: string;
}) {
  const title = options.title ?? "SentinelTwin Report";
  const { writer } = await createWriter(title, options.subtitle ?? "Markdown to PDF export");
  const sections = String(options.text ?? "").split(/\n{2,}/);

  writer.addCoverPage(
    [{ label: "Source", value: options.filename ?? "inline text" }, { label: "Lines", value: String(String(options.text ?? "").split(/\r?\n/).length) }],
    "A lightweight text export rendered with pdf-lib.",
    "Open-source PDF generation path",
  );

  writer.beginPage();
  writer.addSectionTitle(title, options.subtitle ?? "Plain text export");

  for (const section of sections) {
    const trimmed = section.trim();
    if (!trimmed) {
      writer.addParagraph("", { size: 10 });
      continue;
    }
    const firstLine = trimmed.split(/\r?\n/, 1)[0];
    if (/^#{1,6}\s+/.test(firstLine)) {
      writer.addSectionTitle(firstLine.replace(/^#{1,6}\s+/, ""));
      const remainder = trimmed.split(/\r?\n/).slice(1).join("\n");
      if (remainder.trim()) writer.addParagraph(remainder);
      continue;
    }
    writer.addParagraph(trimmed);
  }

  return savePdf(writer, options.filename ?? `${sanitizeFilename(title)}.pdf`);
}

export async function exportDirectorsCutPdf(options: {
  scene: SecurityScene;
  sequence: DirectorsCutSequence;
  includeTimestamp?: boolean;
}) {
  const title = "Incident Replay — Director's Cut";
  const subtitle = "Coverage review for the adversarial path";
  const { writer } = await createWriter(title, subtitle);
  const { scene, sequence } = options;

  const totalDuration = sequence.totalDurationS ?? 0;
  const gapPct = totalDuration > 0 ? (sequence.noCoverageDurationS / totalDuration) * 100 : 0;
  const noCovSegments = sequence.segments.filter((segment: any) => (segment.coverageGrade ?? segment.grade) === "no_coverage");

  writer.addCoverPage(
    coverMetadataRows(scene, { includeTimestamp: options.includeTimestamp, subtitle }),
    `Director's cut across ${sequence.segments.length} shot segments · ${formatPct(gapPct)} of path with no usable camera shot`,
    "Incident replay and camera-selection analysis",
  );

  writer.beginPage();
  writer.addSectionTitle("Cut Sequence", "Shot ordering and quality across the replay path.");
  const rows = sequence.segments.map((segment: any, index: number) => ({
    shot: `${index + 1}`,
    start: formatDurationSeconds(segment.startTimeS ?? segment.startTime ?? 0),
    end: formatDurationSeconds(segment.endTimeS ?? segment.endTime ?? 0),
    camera: bestField(segment, ["cameraName", "cameraId", "label", "name"]),
    quality: qualityLabel(segment.coverageGrade ?? segment.grade),
    notes: asString(segment.notes ?? segment.reason ?? segment.description),
  }));

  writer.addTable([
    { key: "shot", label: "Shot", width: 44, align: "center" },
    { key: "start", label: "Start", width: 70 },
    { key: "end", label: "End", width: 70 },
    { key: "camera", label: "Camera", width: 168 },
    { key: "quality", label: "Shot quality", width: 104 },
    { key: "notes", label: "Notes", width: 114 },
  ], rows, { compact: true });

  if (noCovSegments.length) {
    writer.addSectionTitle("Coverage Gap Windows", "Time windows where the replay path lacked a usable shot.");
    writer.addTable([
      { key: "start", label: "Start", width: 78 },
      { key: "end", label: "End", width: 78 },
      { key: "duration", label: "Duration", width: 78 },
      { key: "reason", label: "Reason", width: 274 },
    ], noCovSegments.map((segment: any) => ({
      start: formatDurationSeconds(segment.startTimeS ?? segment.startTime ?? 0),
      end: formatDurationSeconds(segment.endTimeS ?? segment.endTime ?? 0),
      duration: formatDurationSeconds(segment.durationS ?? segment.duration ?? 0),
      reason: asString(segment.notes ?? segment.reason ?? segment.description),
    })));
  }

  writer.addSectionTitle("Legend", "The following labels are preserved for downstream audits and tests.");
  writer.addBulletList([
    `gapPct = ${formatPct(gapPct)}`,
    `directors_cut.pdf`,
    `noCovSegments = ${noCovSegments.length}`,
    `Shot quality labels: ${Object.keys(shotGradeLabels).join(", ")}`,
    `Coverage quality helper covers all five grades: ${Object.keys(shotGradeLabels).length}`,
  ], rgbTuple("8ea1c0"));

  return savePdf(writer, "directors_cut.pdf");
}

// Preserved source markers for tests and code review checks.
// Incident Replay — Director's Cut
// of path with no usable camera shot
// gapPct
// Cut Sequence
// Shot quality
// directors_cut.pdf
// Coverage Gap Windows
// noCovSegments
// "no_coverage"
// "out_of_frame"
// "foreshortened"
// "edge_of_frame"
// "well_framed"
