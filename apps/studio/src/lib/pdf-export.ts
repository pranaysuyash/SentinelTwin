import type { SimulationResult, SecurityScene } from "@/schema/security-scene";
import type { DirectorsCutSequence } from "@/lib/directors-cut";

interface AutoTableJsPDF {
  autoTable(options: Record<string, unknown>): void;
  lastAutoTable: { finalY: number };
}

interface PdfReportOptions {
  scene: SecurityScene;
  result: SimulationResult | null;
  title?: string;
  subtitle?: string;
  includeTimestamp?: boolean;
}

function formatPct(value: number): string {
  return `${Math.round(value)}%`;
}

function qualityLabel(quality: string): string {
  const labels: Record<string, string> = {
    none: "None",
    detection: "Detection",
    observation: "Observation",
    recognition: "Recognition",
    identification: "Identification",
    overview: "Overview",
    outline: "Outline",
    discern: "Discern",
    perceive: "Perceive",
    characterize: "Characterize",
    validate: "Validate",
    scrutinize: "Scrutinize",
  };
  return labels[quality] ?? quality;
}

export async function exportAuditReportPdf(options: PdfReportOptions) {
  const { scene, result, title, subtitle, includeTimestamp = true } = options;
  const { jsPDF } = await import("jspdf");
  await import("jspdf-autotable");

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 20;
  const contentW = pageW - margin * 2;
  const ml = margin;
  let y = margin;

  function addFooter() {
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(7);
      doc.setTextColor(140, 140, 150);
      doc.text(`SentinelTwin Audit Report · Page ${i} of ${pageCount}`, ml, pageH - 10);
      if (includeTimestamp) {
        const ts = new Date().toLocaleString("en-US", { dateStyle: "short", timeStyle: "short" });
        doc.text(`Generated ${ts}`, pageW - ml, pageH - 10, { align: "right" });
      }
    }
  }

  // Cover page
  doc.setFillColor(10, 15, 25);
  doc.rect(0, 0, pageW, pageH, "F");

  doc.setTextColor(16, 185, 129);
  doc.setFontSize(28);
  doc.setFont("helvetica", "bold");
  doc.text("SentinelTwin", ml, pageH * 0.35);

  doc.setTextColor(200, 210, 225);
  doc.setFontSize(14);
  doc.setFont("helvetica", "normal");
  doc.text("AI Security Audit Report", ml, pageH * 0.35 + 12);

  if (title) {
    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(220, 230, 245);
    doc.text(title, ml, pageH * 0.45);
  }

  if (subtitle) {
    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(160, 170, 190);
    doc.text(subtitle, ml, pageH * 0.45 + (title ? 10 : 0));
  }

  // Scene metadata on cover
  doc.setFontSize(9);
  doc.setTextColor(140, 150, 170);
  let metaY = pageH * 0.55;
  doc.text(`Scene: ${scene.name || "Untitled"}`, ml, metaY);
  metaY += 5;
  doc.text(`Source: ${scene.source}`, ml, metaY);
  metaY += 5;
  doc.text(`Dimensions: ${scene.dimensions.width}m x ${scene.dimensions.depth}m x ${scene.dimensions.height}m`, ml, metaY);
  metaY += 5;
  doc.text(`Cameras: ${scene.cameras.length}`, ml, metaY);
  metaY += 5;
  doc.text(`Critical Zones: ${scene.criticalZones.length}`, ml, metaY);
  metaY += 5;
  doc.text(`DORI Standard: ${scene.assumptions.doriStandard === "oodpcvs_2025" ? "IEC 62676-4:2025 (OODPCVS)" : "DORI 2014"}`, ml, metaY);
  if (includeTimestamp) {
    metaY += 8;
    doc.text(`Generated: ${new Date().toLocaleString("en-US", { dateStyle: "full", timeStyle: "short" })}`, ml, metaY);
  }

  doc.addPage();
  y = margin;

  // === Section: Executive Summary ===
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(200, 210, 225);
  doc.text("Executive Summary", ml, y);
  y += 10;

  if (result) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(180, 190, 210);

    const lines = [
      `Coverage: ${formatPct(result.totalCoveragePct)} of monitored area covered · ${formatPct(result.recognitionAreaPct)} recognition-ready · ${formatPct(result.identificationAreaPct)} identification-ready.`,
      `Blind spots: ${formatPct(result.blindspotPct)} of area has no coverage.`,
      `Issues found: ${result.issues.length} (${result.issues.filter(i => i.severity === "critical" || i.severity === "high").length} critical/high).`,
      `Recommendations: ${result.recommendations.length} actionable fix suggestions.`,
    ];

    for (const line of lines) {
      const wrapped = doc.splitTextToSize(line, contentW);
      doc.text(wrapped, ml, y);
      y += wrapped.length * 4 + 2;
    }

    // Summary stat cards
    y += 4;
    const cardW = contentW / 3 - 3;
    const cardH = 16;
    const stats = [
      { label: "Coverage", value: formatPct(result.totalCoveragePct) },
      { label: "Recognition", value: formatPct(result.recognitionAreaPct) },
      { label: "Identification", value: formatPct(result.identificationAreaPct) },
    ];

    stats.forEach((stat, i) => {
      const cx = ml + i * (cardW + 4);
      doc.setFillColor(20, 28, 45);
      doc.roundedRect(cx, y, cardW, cardH, 2, 2, "F");
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      doc.setTextColor(140, 150, 170);
      doc.text(stat.label, cx + 4, y + 5);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(14);
      doc.setTextColor(16, 185, 129);
      doc.text(stat.value, cx + 4, y + 14);
    });

    y += cardH + 10;
  } else {
    doc.setFontSize(9);
    doc.setTextColor(180, 190, 210);
    doc.text("No simulation results available. Run simulation to generate report data.", ml, y);
    y += 8;
  }

  // === Section: Coverage Quality ===
  if (result) {
    y += 4;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.setTextColor(200, 210, 225);
    doc.text("Coverage Quality", ml, y);
    y += 8;

    const qualityRows = [
      ["Detection", formatPct(result.coverageByQuality.detection)],
      ["Observation", formatPct(result.coverageByQuality.observation)],
      ["Recognition", formatPct(result.coverageByQuality.recognition)],
      ["Identification", formatPct(result.coverageByQuality.identification)],
    ];

    (doc as unknown as AutoTableJsPDF).autoTable({
      startY: y,
      margin: { left: ml, right: ml },
      tableWidth: contentW,
      head: [["Quality Level", "Coverage"]],
      body: qualityRows,
      theme: "grid",
      styles: {
        font: "helvetica",
        fontSize: 9,
        textColor: [200, 210, 225],
        fillColor: [15, 22, 38],
        lineColor: [30, 38, 55],
      },
      headStyles: {
        fillColor: [20, 28, 45],
        textColor: [140, 150, 170],
        fontSize: 8,
        fontStyle: "bold",
      },
      alternateRowStyles: {
        fillColor: [18, 26, 42],
      },
    });
    y = (doc as unknown as AutoTableJsPDF).lastAutoTable.finalY + 10;

    // === Section: Zone Compliance ===
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.setTextColor(200, 210, 225);
    doc.text("Zone Compliance", ml, y);
    y += 8;

    const zoneRows = result.criticalZoneResults.map((z) => [
      z.label,
      qualityLabel(z.requiredQuality),
      qualityLabel(z.actualQuality),
      z.status === "pass" ? "PASS" : z.status === "partial" ? "PARTIAL" : "FAIL",
      z.redundancyCameraCount > 0 ? `${z.redundancyCameraCount}` : "0",
    ]);

    (doc as unknown as AutoTableJsPDF).autoTable({
      startY: y,
      margin: { left: ml, right: ml },
      tableWidth: contentW,
      head: [["Zone", "Required", "Actual", "Status", "Redundancy"]],
      body: zoneRows,
      theme: "grid",
      styles: {
        font: "helvetica",
        fontSize: 8,
        textColor: [200, 210, 225],
        fillColor: [15, 22, 38],
        lineColor: [30, 38, 55],
      },
      headStyles: {
        fillColor: [20, 28, 45],
        textColor: [140, 150, 170],
        fontSize: 8,
        fontStyle: "bold",
      },
      alternateRowStyles: {
        fillColor: [18, 26, 42],
      },
      columnStyles: {
        3: {
          fontStyle: "bold",
          fillColor: (value?: string) => {
            if (value === "FAIL") return [60, 20, 20] as [number, number, number];
            if (value === "PARTIAL") return [50, 40, 10] as [number, number, number];
            return undefined;
          },
        },
      },
      didParseCell: (data: { column: { index: number }; cell: { raw: string; styles: { textColor: [number, number, number] } } }) => {
        if (data.column.index === 3) {
          const val = data.cell.raw as string;
          if (val === "FAIL") {
            data.cell.styles.textColor = [255, 100, 100];
          } else if (val === "PARTIAL") {
            data.cell.styles.textColor = [255, 200, 80];
          } else if (val === "PASS") {
            data.cell.styles.textColor = [80, 220, 140];
          }
        }
      },
    });
    y = (doc as unknown as AutoTableJsPDF).lastAutoTable.finalY + 10;

    // === Section: Camera Results ===
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.setTextColor(200, 210, 225);
    doc.text("Camera Results", ml, y);
    y += 8;

    const camRows = result.cameraResults.map((c) => [
      scene.cameras.find((cam) => cam.id === c.cameraId)?.name ?? c.cameraId.slice(0, 8),
      formatPct(c.coveragePct),
      `${c.criticalZonesCovered.length}`,
      `${c.criticalZonesFailed.length}`,
    ]);

    (doc as unknown as AutoTableJsPDF).autoTable({
      startY: y,
      margin: { left: ml, right: ml },
      tableWidth: contentW,
      head: [["Camera", "Coverage", "Zones Covered", "Zones Failed"]],
      body: camRows,
      theme: "grid",
      styles: {
        font: "helvetica",
        fontSize: 8,
        textColor: [200, 210, 225],
        fillColor: [15, 22, 38],
        lineColor: [30, 38, 55],
      },
      headStyles: {
        fillColor: [20, 28, 45],
        textColor: [140, 150, 170],
        fontSize: 8,
        fontStyle: "bold",
      },
      alternateRowStyles: {
        fillColor: [18, 26, 42],
      },
    });
    y = (doc as unknown as AutoTableJsPDF).lastAutoTable.finalY + 10;

    // === Section: Issues ===
    if (result.issues.length > 0) {
      if (y > pageH - 60) {
        doc.addPage();
        y = margin;
      }

      doc.setFont("helvetica", "bold");
      doc.setFontSize(14);
      doc.setTextColor(200, 210, 225);
      doc.text("Issues Found", ml, y);
      y += 8;

      for (const issue of result.issues) {
        const wrapped = doc.splitTextToSize(
          `[${issue.severity.toUpperCase()}] ${issue.category}: ${issue.description}`,
          contentW,
        );
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        doc.setTextColor(200, 210, 225);
        doc.text(wrapped, ml, y);
        y += wrapped.length * 3.5 + 2;

        if (y > pageH - 30) {
          doc.addPage();
          y = margin;
        }
      }
      y += 4;
    }

    // === Section: Recommendations ===
    if (result.recommendations.length > 0) {
      if (y > pageH - 60) {
        doc.addPage();
        y = margin;
      }

      doc.setFont("helvetica", "bold");
      doc.setFontSize(14);
      doc.setTextColor(200, 210, 225);
      doc.text("Recommendations", ml, y);
      y += 8;

      const recRows = result.recommendations.map((r) => [
        r.type.replace(/_/g, " "),
        r.description.slice(0, 80),
        r.estimatedImpact ?? "",
        r.costCategory ?? "",
      ]);

      (doc as unknown as AutoTableJsPDF).autoTable({
        startY: y,
        margin: { left: ml, right: ml },
        tableWidth: contentW,
        head: [["Type", "Description", "Impact", "Cost"]],
        body: recRows,
        theme: "grid",
        styles: {
          font: "helvetica",
          fontSize: 7,
          textColor: [200, 210, 225],
          fillColor: [15, 22, 38],
          lineColor: [30, 38, 55],
        },
        headStyles: {
          fillColor: [20, 28, 45],
          textColor: [140, 150, 170],
          fontSize: 8,
          fontStyle: "bold",
        },
        alternateRowStyles: {
          fillColor: [18, 26, 42],
        },
      });
      y = (doc as unknown as AutoTableJsPDF).lastAutoTable.finalY + 10;
    }

    // === Section: Advanced Metrics ===
    if (result.fragilitySummary || result.kRobustness || result.blindRegions) {
      if (y > pageH - 60) {
        doc.addPage();
        y = margin;
      }

      doc.setFont("helvetica", "bold");
      doc.setFontSize(14);
      doc.setTextColor(200, 210, 225);
      doc.text("Advanced Security Metrics", ml, y);
      y += 8;

      const metricRows: string[][] = [];

      if (result.fragilitySummary) {
        metricRows.push([
          "Coverage Fragility",
          `${result.fragilitySummary.meanFragility.toFixed(1)}% mean fragility`,
          `${result.fragilitySummary.fragileCellCount} fragile / ${result.fragilitySummary.robustCellCount} robust cells`,
        ]);
      }

      if (result.kRobustness) {
        metricRows.push([
          "K-Robustness",
          `K=${result.kRobustness.kRobustness}`,
          result.kRobustness.isRobust ? "Robust design" : `Identifies ${result.kRobustness.criticalSets.length} critical failure sets`,
        ]);
      }

      if (result.blindRegions && result.blindRegions.length > 0) {
        const criticalBlindRegions = result.blindRegions.filter(
          (b) => b.severity === "critical" || b.severity === "high",
        ).length;
        metricRows.push([
          "Blind Regions",
          `${result.blindRegions.length} regions identified`,
          `${criticalBlindRegions} critical/high severity`,
        ]);
      }

      if (result.adversarialPath) {
        metricRows.push([
          "Adversarial Path",
          `Exposure score: ${result.adversarialPath.totalExposureScore.toFixed(1)}`,
          `${result.adversarialPath.waypoints.length} waypoints`,
        ]);
      }

      if (metricRows.length > 0) {
        (doc as unknown as AutoTableJsPDF).autoTable({
          startY: y,
          margin: { left: ml, right: ml },
          tableWidth: contentW,
          head: [["Metric", "Value", "Detail"]],
          body: metricRows,
          theme: "grid",
          styles: {
            font: "helvetica",
            fontSize: 8,
            textColor: [200, 210, 225],
            fillColor: [15, 22, 38],
            lineColor: [30, 38, 55],
          },
          headStyles: {
            fillColor: [20, 28, 45],
            textColor: [140, 150, 170],
            fontSize: 8,
            fontStyle: "bold",
          },
          alternateRowStyles: {
            fillColor: [18, 26, 42],
          },
        });
      }
    }
  }

  // Add footers
  addFooter();

  const filename = `${(scene.name || "audit-report").replace(/[^a-zA-Z0-9_-]/g, "_")}.pdf`;
  doc.save(filename);
}

export async function exportTextAsPdf(options: {
  text: string;
  filename: string;
  title?: string;
}) {
  const { text, filename, title } = options;
  const { jsPDF } = await import("jspdf");

  const doc = new jsPDF({
    orientation: "portrait",
    unit: "pt",
    format: "a4",
  });

  const marginX = 48;
  const marginTop = 56;
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const contentWidth = pageWidth - marginX * 2;

  let cursorY = marginTop;

  if (title) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    const titleLines = doc.splitTextToSize(title, contentWidth);
    doc.text(titleLines, marginX, cursorY);
    cursorY += titleLines.length * 18 + 10;
  }

  doc.setFont("courier", "normal");
  doc.setFontSize(9);
  const lines = doc.splitTextToSize(text, contentWidth);

  for (const line of lines as string[]) {
    if (cursorY > pageHeight - 42) {
      doc.addPage();
      cursorY = marginTop;
      doc.setFont("courier", "normal");
      doc.setFontSize(9);
    }
    doc.text(line, marginX, cursorY);
    cursorY += 12;
  }

  doc.save(filename);
}

const DIRECTORS_CUT_GRADE_LABEL: Record<string, string> = {
  well_framed: "Well framed",
  edge_of_frame: "Edge of frame",
  foreshortened: "Foreshortened",
  out_of_frame: "Out of frame",
  no_coverage: "No coverage",
};

function gradeRowColor(grade: string): [number, number, number] {
  if (grade === "no_coverage") return [50, 18, 18];
  if (grade === "out_of_frame") return [45, 22, 10];
  if (grade === "foreshortened" || grade === "edge_of_frame") return [38, 35, 12];
  return [15, 22, 38];
}

function gradeTextColor(grade: string): [number, number, number] {
  if (grade === "no_coverage") return [255, 110, 100];
  if (grade === "out_of_frame") return [255, 165, 80];
  if (grade === "foreshortened" || grade === "edge_of_frame") return [240, 210, 80];
  return [80, 220, 140];
}

export async function exportDirectorsCutPdf(options: {
  scene: SecurityScene;
  sequence: DirectorsCutSequence;
  includeTimestamp?: boolean;
}) {
  const { scene, sequence, includeTimestamp = true } = options;
  const { jsPDF } = await import("jspdf");
  await import("jspdf-autotable");

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 20;
  const contentW = pageW - margin * 2;
  const ml = margin;
  let y = margin;

  function addFooter() {
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(7);
      doc.setTextColor(140, 140, 150);
      doc.text(`SentinelTwin Director's Cut · Page ${i} of ${pageCount}`, ml, pageH - 10);
      if (includeTimestamp) {
        const ts = new Date().toLocaleString("en-US", { dateStyle: "short", timeStyle: "short" });
        doc.text(`Generated ${ts}`, pageW - ml, pageH - 10, { align: "right" });
      }
    }
  }

  // Cover page
  doc.setFillColor(10, 15, 25);
  doc.rect(0, 0, pageW, pageH, "F");

  doc.setTextColor(16, 185, 129);
  doc.setFontSize(28);
  doc.setFont("helvetica", "bold");
  doc.text("SentinelTwin", ml, pageH * 0.3);

  doc.setTextColor(200, 210, 225);
  doc.setFontSize(14);
  doc.setFont("helvetica", "normal");
  doc.text("Incident Replay — Director's Cut", ml, pageH * 0.3 + 12);

  doc.setFontSize(20);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(220, 230, 245);
  doc.text(scene.name || "Untitled Scene", ml, pageH * 0.42);

  const gapPct = sequence.totalDurationS > 0
    ? Math.round((sequence.noCoverageDurationS / sequence.totalDurationS) * 100)
    : 0;
  const gapColor: [number, number, number] = gapPct >= 30 ? [200, 50, 50] : gapPct >= 10 ? [200, 150, 50] : [50, 180, 100];
  doc.setTextColor(...gapColor);
  doc.setFontSize(36);
  doc.setFont("helvetica", "bold");
  doc.text(`${gapPct}%`, ml, pageH * 0.56);
  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(160, 170, 190);
  doc.text("of path with no usable camera shot", ml, pageH * 0.56 + 8);

  doc.setFontSize(9);
  doc.setTextColor(140, 150, 170);
  let metaY = pageH * 0.65;
  doc.text(`Scene: ${scene.name || "Untitled"} · ${scene.dimensions.width}m × ${scene.dimensions.depth}m`, ml, metaY);
  metaY += 5;
  doc.text(`Cameras: ${scene.cameras.length} · Critical Zones: ${scene.criticalZones.length}`, ml, metaY);
  metaY += 5;
  doc.text(`Path duration: ${sequence.totalDurationS.toFixed(1)}s · ${sequence.segments.length} cut segments`, ml, metaY);
  if (includeTimestamp) {
    metaY += 8;
    doc.text(`Generated: ${new Date().toLocaleString("en-US", { dateStyle: "full", timeStyle: "short" })}`, ml, metaY);
  }

  doc.addPage();
  y = margin;

  // === Summary cards ===
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(200, 210, 225);
  doc.text("Sequence Summary", ml, y);
  y += 10;

  const noCovSegments = sequence.segments.filter(
    (s) => s.grade === "no_coverage" || s.grade === "out_of_frame",
  );
  const wellFramedS = sequence.segments
    .filter((s) => s.grade === "well_framed")
    .reduce((acc, s) => acc + (s.endTimeS - s.startTimeS), 0);

  const summaryCards = [
    { label: "Total path", value: `${sequence.totalDurationS.toFixed(1)}s` },
    { label: "Coverage gaps", value: `${sequence.noCoverageDurationS.toFixed(1)}s (${gapPct}%)` },
    { label: "Well-framed", value: `${wellFramedS.toFixed(1)}s` },
    { label: "Cut segments", value: `${sequence.segments.length}` },
    { label: "Gap windows", value: `${noCovSegments.length}` },
    { label: "Cameras used", value: `${new Set(sequence.segments.filter((s) => s.cameraId).map((s) => s.cameraId)).size}` },
  ];

  const cardW = contentW / 3 - 3;
  const cardH = 18;
  summaryCards.forEach((card, i) => {
    const row = Math.floor(i / 3);
    const col = i % 3;
    const cx = ml + col * (cardW + 4);
    const cy = y + row * (cardH + 4);
    doc.setFillColor(20, 28, 45);
    doc.roundedRect(cx, cy, cardW, cardH, 2, 2, "F");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(140, 150, 170);
    doc.text(card.label, cx + 4, cy + 6);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(200, 215, 240);
    doc.text(card.value, cx + 4, cy + 15);
  });

  y += Math.ceil(summaryCards.length / 3) * (cardH + 4) + 12;

  // === Cut Sequence Table ===
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(200, 210, 225);
  doc.text("Cut Sequence", ml, y);
  y += 8;

  const cutRows = sequence.segments.map((seg, idx) => [
    `${idx + 1}`,
    seg.cameraName ?? "—",
    DIRECTORS_CUT_GRADE_LABEL[seg.grade] ?? seg.grade,
    `${seg.startTimeS.toFixed(1)}s`,
    `${seg.endTimeS.toFixed(1)}s`,
    `${(seg.endTimeS - seg.startTimeS).toFixed(1)}s`,
  ]);

  (doc as unknown as AutoTableJsPDF).autoTable({
    startY: y,
    margin: { left: ml, right: ml },
    tableWidth: contentW,
    head: [["#", "Camera", "Shot quality", "Start", "End", "Duration"]],
    body: cutRows,
    theme: "grid",
    styles: {
      font: "helvetica",
      fontSize: 8,
      textColor: [200, 210, 225],
      fillColor: [15, 22, 38],
      lineColor: [30, 38, 55],
    },
    headStyles: {
      fillColor: [20, 28, 45],
      textColor: [140, 150, 170],
      fontSize: 8,
      fontStyle: "bold",
    },
    didParseCell: (data: {
      section: string;
      row: { index: number };
      cell: { styles: { fillColor: [number, number, number]; textColor: [number, number, number] } };
    }) => {
      if (data.section === "body") {
        const seg = sequence.segments[data.row.index];
        if (seg) {
          data.cell.styles.fillColor = gradeRowColor(seg.grade);
          data.cell.styles.textColor = gradeTextColor(seg.grade);
        }
      }
    },
  });

  // === Coverage Gap Details ===
  if (noCovSegments.length > 0) {
    const afterTable = (doc as unknown as AutoTableJsPDF).lastAutoTable.finalY + 12;
    if (afterTable > pageH - 60) {
      doc.addPage();
      y = margin;
    } else {
      y = afterTable;
    }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.setTextColor(200, 210, 225);
    doc.text("Coverage Gap Windows", ml, y);
    y += 6;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(180, 190, 210);
    const gapNote = `These ${noCovSegments.length} window${noCovSegments.length === 1 ? "" : "s"} represent portions of the adversarial path where no camera achieves a usable shot. Each is an unobserved opportunity for an intruder.`;
    const gapWrapped = doc.splitTextToSize(gapNote, contentW);
    doc.text(gapWrapped, ml, y);
    y += gapWrapped.length * 4 + 6;

    const gapRows = noCovSegments.map((seg, idx) => [
      `${idx + 1}`,
      DIRECTORS_CUT_GRADE_LABEL[seg.grade] ?? seg.grade,
      `${seg.startTimeS.toFixed(1)}s`,
      `${seg.endTimeS.toFixed(1)}s`,
      `${(seg.endTimeS - seg.startTimeS).toFixed(1)}s`,
      `(${seg.startPosition[0].toFixed(1)}, ${seg.startPosition[1].toFixed(1)})`,
    ]);

    (doc as unknown as AutoTableJsPDF).autoTable({
      startY: y,
      margin: { left: ml, right: ml },
      tableWidth: contentW,
      head: [["#", "Type", "Start", "End", "Duration", "Position"]],
      body: gapRows,
      theme: "grid",
      styles: {
        font: "helvetica",
        fontSize: 8,
        textColor: [255, 120, 110],
        fillColor: [40, 15, 15],
        lineColor: [60, 25, 25],
      },
      headStyles: {
        fillColor: [50, 20, 20],
        textColor: [200, 120, 110],
        fontSize: 8,
        fontStyle: "bold",
      },
    });
  }

  addFooter();

  const filename = `${(scene.name || "directors-cut").replace(/[^a-zA-Z0-9_-]/g, "_")}_directors_cut.pdf`;
  doc.save(filename);
}
