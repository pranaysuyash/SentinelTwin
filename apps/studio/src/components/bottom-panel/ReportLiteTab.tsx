"use client";

import { Copy, Globe, Loader2, Printer, Sparkles } from "lucide-react";
import { useCallback, useState } from "react";

import type { SecurityReport } from "@/agents/ReportAgent";
import { useAiCommand } from "@/hooks/use-ai-command";
import { useStudioStore } from "@/store/studio-store";

export function ReportLiteTab() {
  const result = useStudioStore((s) => s.simulationResult);
  const scene = useStudioStore((s) => s.scene);
  const { status, runReportGeneration } = useAiCommand();
  const [aiReport, setAiReport] = useState<SecurityReport | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  const handleGenerateAI = useCallback(async () => {
    setIsGenerating(true);
    const report = await runReportGeneration();
    if (report) setAiReport(report);
    setIsGenerating(false);
  }, [runReportGeneration]);

  if (!result) {
    return (
      <div className="flex h-full items-center justify-center text-[11px] text-[#3a4158]">
        Run simulation to generate report
      </div>
    );
  }

  // Build markdown from either AI report or simulation data
  const markdown = aiReport
    ? buildAiReportMarkdown(aiReport)
    : defaultMarkdown(result, scene);

  const copy = () => navigator.clipboard.writeText(markdown);

  const handleExportHtml = useCallback(() => {
    const html = buildHtmlReport(scene, result, aiReport);
    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `sentineltwin-report-${scene.name.replace(/[^a-zA-Z0-9_-]/g, "_")}.html`;
    a.click();
    URL.revokeObjectURL(url);
  }, [result, scene, aiReport]);

  const handlePrint = useCallback(() => {
    const html = buildHtmlReport(scene, result, aiReport);
    const win = window.open("", "_blank");
    if (win) {
      win.document.write(html);
      win.document.close();
      win.focus();
      setTimeout(() => win.print(), 300);
    }
  }, [result, scene, aiReport]);

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center justify-between border-b border-[#1e2130] px-3 py-1.5">
        <span className="text-[10px] text-[#68738a]">
          {aiReport ? "AI Report" : "Markdown Report"}
        </span>
        <div className="flex items-center gap-1.5">
          <button
            onClick={handleGenerateAI}
            disabled={isGenerating}
            className="inline-flex items-center gap-1 rounded border border-[#1e2130] px-2 py-1 text-[9px] text-emerald-300 transition-colors hover:border-emerald-500/30 hover:bg-emerald-500/10 disabled:opacity-40"
          >
            {isGenerating ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Sparkles className="h-3 w-3" />
            )}
            {isGenerating ? "Generating..." : aiReport ? "Regenerate" : "Generate AI"}
          </button>
          <div className="flex gap-1.5">
            <button
              onClick={() => { setAiReport(null); }}
              className="rounded border border-[#1e2130] px-2 py-1 text-[9px] text-[#68738a] transition-colors hover:text-white"
            >
              Default
            </button>
            <button
              onClick={handleExportHtml}
              className="flex items-center gap-1 rounded border border-[#1e2130] px-2 py-1 text-[9px] text-[#8090a8] transition-colors hover:border-[#2a3045] hover:text-white"
            >
              <Globe className="h-3 w-3" /> Export HTML
            </button>
            <button
              onClick={handlePrint}
              className="flex items-center gap-1 rounded border border-[#1e2130] px-2 py-1 text-[9px] text-[#8090a8] transition-colors hover:border-[#2a3045] hover:text-white"
            >
              <Printer className="h-3 w-3" /> Print
            </button>
            <button
              onClick={copy}
              className="flex items-center gap-1 rounded border border-[#1e2130] px-2 py-1 text-[9px] text-[#8090a8] transition-colors hover:border-[#2a3045] hover:text-white"
            >
              <Copy className="h-3 w-3" /> Copy
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-3">
        {isGenerating ? (
          <div className="flex items-center justify-center gap-2 py-12 text-[11px] text-amber-300">
            <Loader2 className="h-4 w-4 animate-spin" />
            Generating AI report...
          </div>
        ) : (
          <pre className="whitespace-pre-wrap font-mono text-[9px] leading-relaxed text-[#8090a8]">
            {markdown}
          </pre>
        )}
      </div>
    </div>
  );
}

function buildAiReportMarkdown(report: SecurityReport): string {
  const lines = [
    `# ${report.title}`,
    `**Site:** ${report.siteName}`,
    `**Generated:** ${new Date(report.generatedAt).toLocaleString()}`,
    "",
    "## Executive Summary",
    report.executiveSummary,
    "",
    ...report.sections.flatMap((section) => {
      const sectionLines = [`## ${section.title}`];
      if (section.type === "list") {
        sectionLines.push(...section.content.split("\n").map((l) => `- ${l}`));
      } else {
        sectionLines.push(section.content);
      }
      sectionLines.push("");
      return sectionLines;
    }),
    "## Recommendations",
    ...report.recommendations.map((r) => `- ${r}`),
    "",
    "## Assumptions",
    ...report.assumptions.map((a) => `- ${a}`),
    "",
    "## Limitations",
    ...report.limitations.map((l) => `- ${l}`),
  ];
  return lines.join("\n");
}

function defaultMarkdown(
  result: NonNullable<ReturnType<typeof useStudioStore.getState>["simulationResult"]>,
  scene: ReturnType<typeof useStudioStore.getState>["scene"],
): string {
  const lines = [
    "# SentinelTwin Coverage Report",
    "## Scene: " + scene.name,
    "Generated: " + new Date().toLocaleString(),
    "",
    "### Assumptions",
    "- DORI Model: " + scene.assumptions.doriStandard,
    "- Person Height: " + scene.assumptions.personHeightM + "m",
    "- Vehicle Height: " + scene.assumptions.vehicleHeightM + "m",
    "- PPM Thresholds: " + [
      scene.assumptions.pixelsPerMeter.detection,
      scene.assumptions.pixelsPerMeter.observation,
      scene.assumptions.pixelsPerMeter.recognition,
      scene.assumptions.pixelsPerMeter.identification,
    ].join(" / "),
    "",
    "### Summary",
    "- Total Coverage: " + result.totalCoveragePct.toFixed(1) + "%",
    "- Recognition Area: " + result.recognitionAreaPct.toFixed(1) + "%",
    "- Identification Area: " + result.identificationAreaPct.toFixed(1) + "%",
    "- Critical Zones: " + result.criticalZoneResults.filter((z) => z.status === "pass").length + "/" + result.criticalZoneResults.length + " passing",
    "- Issues Found: " + result.issues.length,
    "- Verified Recommendations: " + result.recommendations.filter((r) => r.verified).length + "/" + result.recommendations.length,
    "",
    "### Issues",
    ...result.issues.map((i) => "- [" + i.severity + "] " + i.description),
    "",
    "### Recommendations",
    ...result.recommendations.map((r) => "- [" + (r.verified ? "verified" : "unverified") + "] " + r.description + " :: " + r.estimatedImpact),
  ];
  return lines.join("\n");
}

function buildHtmlReport(
  scene: ReturnType<typeof useStudioStore.getState>["scene"],
  result: NonNullable<ReturnType<typeof useStudioStore.getState>["simulationResult"]>,
  aiReport: SecurityReport | null,
): string {
  const isAi = aiReport != null;
  const title = isAi ? aiReport!.title : "SentinelTwin Coverage Report";
  const passing = result.criticalZoneResults.filter((z) => z.status === "pass").length;
  const totalZones = result.criticalZoneResults.length;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)} — ${escapeHtml(scene.name)}</title>
  <style>
    @page { margin: 20mm 15mm; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      font-size: 11pt;
      line-height: 1.6;
      color: #1a1a2e;
      padding: 40px;
      max-width: 900px;
      margin: 0 auto;
    }
    h1 { font-size: 20pt; margin-bottom: 4px; color: #0f172a; }
    h2 { font-size: 14pt; margin-top: 24px; margin-bottom: 8px; border-bottom: 2px solid #e2e8f0; padding-bottom: 4px; color: #1e293b; }
    h3 { font-size: 11pt; margin-top: 16px; margin-bottom: 6px; color: #334155; }
    .meta { color: #64748b; font-size: 10pt; margin-bottom: 16px; }
    .summary-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 8px; margin: 12px 0; }
    .summary-card { border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px; text-align: center; }
    .summary-card .value { font-size: 16pt; font-weight: 700; }
    .summary-card .label { font-size: 8pt; text-transform: uppercase; letter-spacing: 0.1em; color: #64748b; margin-top: 2px; }
    .issue { padding: 8px 10px; margin: 4px 0; border-radius: 6px; font-size: 10pt; }
    .issue.critical { background: #fef2f2; border-left: 3px solid #ef4444; }
    .issue.high { background: #fff7ed; border-left: 3px solid #f97316; }
    .issue.medium { background: #eff6ff; border-left: 3px solid #3b82f6; }
    .issue.low { background: #f8fafc; border-left: 3px solid #94a3b8; }
    table { width: 100%; border-collapse: collapse; margin: 12px 0; font-size: 10pt; }
    th, td { border: 1px solid #e2e8f0; padding: 6px 10px; text-align: left; }
    th { background: #f1f5f9; font-weight: 600; }
    .pass { color: #16a34a; font-weight: 600; }
    .fail { color: #dc2626; font-weight: 600; }
    .rec { padding: 6px 8px; margin: 4px 0; background: #f0fdf4; border-left: 3px solid #22c55e; font-size: 10pt; }
    footer { margin-top: 32px; padding-top: 16px; border-top: 1px solid #e2e8f0; font-size: 8pt; color: #94a3b8; text-align: center; }
    @media print { body { padding: 0; } }
  </style>
</head>
<body>
  <h1>${escapeHtml(title)}</h1>
  <div class="meta">Scene: ${escapeHtml(scene.name)} &middot; ${new Date().toLocaleDateString()} &middot; DORI: ${scene.assumptions.doriStandard.toUpperCase()}</div>

  <h2>Summary</h2>
  <div class="summary-grid">
    <div class="summary-card"><div class="value" style="color:#16a34a">${result.totalCoveragePct.toFixed(1)}%</div><div class="label">Total Coverage</div></div>
    <div class="summary-card"><div class="value" style="color:#2563eb">${result.recognitionAreaPct.toFixed(1)}%</div><div class="label">Recognition Area</div></div>
    <div class="summary-card"><div class="value" style="color:#7c3aed">${result.identificationAreaPct.toFixed(1)}%</div><div class="label">Identification Area</div></div>
    <div class="summary-card"><div class="value" style="color:${passing === totalZones ? "#16a34a" : "#dc2626"}">${passing}/${totalZones}</div><div class="label">Zones Passing</div></div>
  </div>

  ${isAi ? buildAiReportHtml(aiReport!) : buildDefaultHtml(result)}
  
  <footer>Generated by SentinelTwin Studio &middot; ${new Date().toISOString()} &middot; Standards: IEC 62676-4:2025 (OODPCVS)</footer>
</body>
</html>`;
}

function buildAiReportHtml(report: SecurityReport): string {
  return `
  <h2>Executive Summary</h2>
  <p>${escapeHtml(report.executiveSummary)}</p>
  
  ${report.sections.map((s) => `
    <h2>${escapeHtml(s.title)}</h2>
    <p>${escapeHtml(s.content)}</p>
  `).join("")}
  
  <h2>Recommendations</h2>
  ${report.recommendations.map((r) => `<div class="rec">${escapeHtml(r)}</div>`).join("")}
  
  <h2>Assumptions</h2>
  <ul>${report.assumptions.map((a) => `<li>${escapeHtml(a)}</li>`).join("")}</ul>
  
  <h2>Limitations</h2>
  <ul>${report.limitations.map((l) => `<li>${escapeHtml(l)}</li>`).join("")}</ul>`;
}

function buildDefaultHtml(result: NonNullable<ReturnType<typeof useStudioStore.getState>["simulationResult"]>): string {
  return `
  <h2>Issues (${result.issues.length})</h2>
  ${result.issues.map((i) => `<div class="issue ${i.severity}"><strong>${i.severity.toUpperCase()}</strong>: ${escapeHtml(i.description)}</div>`).join("")}
  ${result.issues.length === 0 ? "<p>No issues found.</p>" : ""}
  
  <h2>Critical Zones</h2>
  <table>
    <thead><tr><th>Zone</th><th>Required</th><th>Actual</th><th>Status</th><th>Covering Cameras</th></tr></thead>
    <tbody>
      ${result.criticalZoneResults.map((z) => `
        <tr>
          <td>${escapeHtml(z.label)}</td>
          <td>${z.requiredQuality}</td>
          <td>${z.actualQuality}</td>
          <td class="${z.status === "pass" ? "pass" : "fail"}">${z.status.toUpperCase()}</td>
          <td>${z.coveringCameras.join(", ")}</td>
        </tr>
      `).join("")}
    </tbody>
  </table>
  
  <h2>Cameras</h2>
  <table>
    <thead><tr><th>Camera</th><th>Coverage</th><th>Zones Covered</th></tr></thead>
    <tbody>
      ${result.cameraResults.map((c) => `
        <tr>
          <td>${escapeHtml(c.cameraId)}</td>
          <td>${c.coveragePct.toFixed(1)}%</td>
          <td>${c.criticalZonesCovered.join(", ")}</td>
        </tr>
      `).join("")}
    </tbody>
  </table>
  
  <h2>Recommendations</h2>
  ${result.recommendations.map((r) => `<div class="rec"><strong>${r.verified ? "✓ Verified" : "○ Unverified"}</strong>: ${escapeHtml(r.description)}<br><small>${escapeHtml(r.estimatedImpact)}</small></div>`).join("")}
  ${result.recommendations.length === 0 ? "<p>No recommendations.</p>" : ""}`;
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
