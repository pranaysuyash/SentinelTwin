"use client";

import { AlertCircle, AlertTriangle, Info, ShieldAlert, ChevronRight } from "lucide-react";
import { useStudioStore } from "@/store/studio-store";
import { Badge } from "@/components/shared/Badge";
import type { SecurityIssue } from "@/schema/security-scene";

function SeverityBadge({ severity }: { severity: SecurityIssue["severity"] }) {
  const map: Record<SecurityIssue["severity"], { variant: "red" | "amber" | "blue" | "gray"; label: string }> = {
    critical: { variant: "red",   label: "CRITICAL" },
    high:     { variant: "amber", label: "HIGH" },
    medium:   { variant: "blue",  label: "MEDIUM" },
    low:      { variant: "gray",  label: "LOW" },
  };
  const { variant, label } = map[severity];
  return <Badge variant={variant}>{label}</Badge>;
}

function SeverityIcon({ severity }: { severity: SecurityIssue["severity"] }) {
  const cls = "w-3.5 h-3.5 flex-shrink-0";
  if (severity === "critical") return <ShieldAlert className={`${cls} text-red-400`} />;
  if (severity === "high")     return <AlertTriangle className={`${cls} text-amber-400`} />;
  if (severity === "medium")   return <AlertCircle className={`${cls} text-blue-400`} />;
  return <Info className={`${cls} text-[#4a5568]`} />;
}

export function IssuesTab() {
  const result = useStudioStore((s) => s.simulationResult);

  if (!result) {
    return (
      <div className="flex items-center justify-center h-full text-[#3a4158] text-[11px]">
        Run simulation to see issues
      </div>
    );
  }

  if (result.issues.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-2">
        <div className="text-[11px] text-green-400 font-semibold">No issues found</div>
        <div className="text-[9px] text-[#4a5568]">All coverage requirements are met</div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="p-2 space-y-1.5">
        {result.issues.map((issue, i) => (
          <div key={i} className="flex gap-2.5 p-2.5 bg-[#0d0f17] border border-[#1e2130] rounded-lg hover:border-[#2a3045] transition-colors group">
            <SeverityIcon severity={issue.severity} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[11px] font-semibold text-[#c0c8da] leading-tight">{issue.description}</span>
                <SeverityBadge severity={issue.severity} />
              </div>
              <div className="text-[9px] text-[#68738a] capitalize">{issue.category.replace(/_/g, " ")}</div>
              {issue.affectedZones.length > 0 && (
                <div className="mt-1 flex flex-wrap gap-1">
                  <span className="text-[8px] text-[#4a5568]">Zones:</span>
                  {issue.affectedZones.map((z) => (
                    <span key={z} className="text-[8px] text-[#8090a8] bg-[#1a1d26] px-1 rounded">{z}</span>
                  ))}
                </div>
              )}
              {issue.affectedCameras.length > 0 && (
                <div className="mt-1 flex flex-wrap gap-1">
                  <span className="text-[8px] text-[#4a5568]">Cameras:</span>
                  {issue.affectedCameras.map((c) => (
                    <span key={c} className="text-[8px] text-[#8090a8] bg-[#1a1d26] px-1 rounded">{c}</span>
                  ))}
                </div>
              )}

            </div>
          </div>
        ))}

        {/* Recommendations */}
        {result.recommendations.length > 0 && (
          <div className="mt-3">
            <div className="text-[9px] font-semibold text-[#3a4158] uppercase tracking-widest mb-2">Recommendations</div>
            {result.recommendations.map((rec, i) => (
              <div key={i} className="flex items-start gap-2 py-1.5 border-b border-[#181b26]">
                <ChevronRight className="w-3 h-3 text-blue-400 mt-0.5 flex-shrink-0" />
                <span className="text-[10px] text-[#8090a8]">{rec.description}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
