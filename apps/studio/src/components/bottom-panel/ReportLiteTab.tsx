"use client";

import { Copy } from "lucide-react";
import { useStudioStore } from "@/store/studio-store";

export function ReportLiteTab() {
  const result = useStudioStore((s) => s.simulationResult);
  const scene  = useStudioStore((s) => s.scene);

  if (!result) {
    return (
      <div className="flex items-center justify-center h-full text-[#3a4158] text-[11px]">
        Run simulation to generate report
      </div>
    );
  }

  const lines = [
    "# SentinelTwin Coverage Report",
    "## Scene: " + scene.name,
    "Generated: " + new Date().toLocaleString(),
    "",
    "### Summary",
    "- Total Coverage: " + result.totalCoveragePct.toFixed(1) + "%",
    "- Recognition Area: " + result.recognitionAreaPct.toFixed(1) + "%",
    "- Identification Area: " + result.identificationAreaPct.toFixed(1) + "%",
    "- Critical Zones: " + result.criticalZoneResults.filter((z) => z.status === "pass").length + "/" + result.criticalZoneResults.length + " passing",
    "- Issues Found: " + result.issues.length,
    "",
    "### Issues",
    ...result.issues.map((i) => "- [" + i.severity + "] " + i.description),
    "",
    "### Recommendations",
    ...result.recommendations.map((r) => "- " + r.description),
  ];

  const markdown = lines.join("\n");
  const copy = () => navigator.clipboard.writeText(markdown);

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-[#1e2130]">
        <span className="text-[10px] text-[#68738a]">Markdown Report</span>
        <div className="flex gap-2">
          <button onClick={copy}
            className="flex items-center gap-1 text-[9px] text-[#8090a8] hover:text-white transition-colors px-2 py-1 border border-[#1e2130] rounded hover:border-[#2a3045]">
            <Copy className="w-3 h-3" /> Copy
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-3">
        <pre className="text-[9px] font-mono text-[#8090a8] whitespace-pre-wrap leading-relaxed">{markdown}</pre>
      </div>
    </div>
  );
}
