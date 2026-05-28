"use client";

import type { OutcomeIssueCard } from "@/lib/security-outcome/security-outcome-model";

function severityTone(severity: OutcomeIssueCard["severity"]) {
  if (severity === "critical") return "border-red-500/30 bg-red-500/10 text-red-200";
  if (severity === "high") return "border-amber-500/30 bg-amber-500/10 text-amber-200";
  if (severity === "medium") return "border-blue-500/30 bg-blue-500/10 text-blue-200";
  return "border-slate-500/30 bg-slate-500/10 text-slate-200";
}

export function IssueCard({
  issue,
  onFocusZone,
  onViewCamera,
}: {
  issue: OutcomeIssueCard;
  onFocusZone?: (zoneId: string) => void;
  onViewCamera?: (cameraId: string) => void;
}) {
  return (
    <div className="rounded-lg border border-[#1f2536] bg-[#0d0f17] p-2.5">
      <div className="flex items-center gap-2">
        <span className={`rounded border px-1.5 py-0.5 text-[8px] font-semibold uppercase tracking-[0.12em] ${severityTone(issue.severity)}`}>
          {issue.severity}
        </span>
        <span className="text-[8px] uppercase tracking-[0.12em] text-[#6b7c95]">{issue.category.replace(/_/g, " ")}</span>
      </div>
      <div className="mt-1 text-[10px] text-[#d2d9e8]">{issue.description}</div>
      <div className="mt-2 flex flex-wrap gap-1">
        {onFocusZone
          ? issue.affectedZones.slice(0, 2).map((zoneId) => (
              <button
                key={zoneId}
                type="button"
                onClick={() => onFocusZone(zoneId)}
                className="rounded border border-[#2a3045] bg-[#111521] px-1.5 py-0.5 text-[8px] text-[#9db7e1] hover:text-white"
              >
                Focus {zoneId}
              </button>
            ))
          : null}
        {onViewCamera
          ? issue.affectedCameras.slice(0, 2).map((cameraId) => (
              <button
                key={cameraId}
                type="button"
                onClick={() => onViewCamera(cameraId)}
                className="rounded border border-[#2a3045] bg-[#111521] px-1.5 py-0.5 text-[8px] text-[#9dd6ff] hover:text-white"
              >
                View {cameraId}
              </button>
            ))
          : null}
      </div>
    </div>
  );
}
