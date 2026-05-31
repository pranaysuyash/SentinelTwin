"use client";

import type { CameraFinding } from "@/lib/security-outcome/security-outcome-model";
import { useStudioStore } from "@/store/studio-store";
import { ExplainBadge } from "@/components/shared/ExplainBadge";

export function CameraResponsibilityPanel({ cameraFindings }: { cameraFindings: CameraFinding[] }) {
  const selectNode = useStudioStore((s) => s.selectNode);
  const setViewMode = useStudioStore((s) => s.setViewMode);
  const setWorkspacePreset = useStudioStore((s) => s.setWorkspacePreset);

  return (
    <section className="rounded-xl border border-[#1f2536] bg-[#0b0f17] p-3">
      <div className="flex items-center gap-2">
        <h3 className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#8ea0bf]">Camera Responsibility</h3>
        <ExplainBadge text="Per-camera coverage role, critical zone responsibility, and offline failure impact." />
      </div>
      <div className="mt-2 space-y-2">
        {cameraFindings.map((camera) => (
          <div key={camera.cameraId} className="rounded-lg border border-[#232a3d] bg-[#0f1420] p-2">
            <div className="flex items-center justify-between gap-2">
              <div className="text-[11px] font-medium text-[#deebff]">{camera.cameraName}</div>
              <button type="button"
                onClick={() => { selectNode(camera.cameraId); setViewMode("camera_view"); setWorkspacePreset("coverage"); }}
                className="rounded border border-[#2d3750] px-2 py-1 text-[10px] text-[#bcd3ff] hover:bg-[#1a2233]"
              >View Camera</button>
            </div>
            <div className="mt-1 text-[10px] text-[#d7deed] italic">{camera.roleSummary}</div>
            <div className="mt-1 text-[10px] text-[#8ea0bf]">
              Coverage: {camera.coveragePct.toFixed(1)}% · Critical passed: {camera.zonesPassed.length} · Fails: {camera.zonesFailed.length}
            </div>
            {camera.offlineImpactSummary ? (
              <div className="mt-1 text-[10px] text-amber-300">{camera.offlineImpactSummary}</div>
            ) : null}
          </div>
        ))}
      </div>
    </section>
  );
}
