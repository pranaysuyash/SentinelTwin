import type { SimulationResult, SecurityScene } from "@/schema/security-scene";

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

    (doc as any).autoTable({
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
    y = (doc as any).lastAutoTable.finalY + 10;

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

    (doc as any).autoTable({
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
            if (value === "FAIL") return [60, 20, 20] as any;
            if (value === "PARTIAL") return [50, 40, 10] as any;
            return undefined;
          },
        },
      },
      didParseCell: (data: any) => {
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
    y = (doc as any).lastAutoTable.finalY + 10;

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

    (doc as any).autoTable({
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
    y = (doc as any).lastAutoTable.finalY + 10;

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

      (doc as any).autoTable({
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
      y = (doc as any).lastAutoTable.finalY + 10;
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
        (doc as any).autoTable({
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
