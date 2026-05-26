"use client";

import { Copy, FileText, Loader2, Sparkles } from "lucide-react";
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
