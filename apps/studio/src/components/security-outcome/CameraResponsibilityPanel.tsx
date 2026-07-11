"use client";

import type { CameraFinding } from "@/lib/security-outcome/security-outcome-model";
import { useStudioStore } from "@/store/studio-store";
import { ExplainBadge } from "@/components/shared/ExplainBadge";
import { UI_SURFACES } from "@/lib/studio-surface-tokens";

export function CameraResponsibilityPanel({ cameraFindings }: { cameraFindings: CameraFinding[] }) {
  const selectNode = useStudioStore((s) => s.selectNode);
  const setViewMode = useStudioStore((s) => s.setViewMode);
  const setWorkspacePreset = useStudioStore((s) => s.setWorkspacePreset);

  return (
    <section className={`rounded-xl border UI_SURFACES.borderSubtle UI_SURFACES.panel p-3`}>
      <div className="flex items-center gap-2">
        <h3 className={`text-[10px] font-semibold uppercase tracking-[0.16em] UI_SURFACES.textMuted3`}>Camera Responsibility</h3>
        <ExplainBadge text="Per-camera coverage role, critical zone responsibility, and offline failure impact." />
      </div>
      <div className="mt-2 space-y-2">
        {cameraFindings.map((camera) => (
          <div key={camera.cameraId} className={`rounded-lg border UI_SURFACES.borderThin UI_SURFACES.bgDeep p-2`}>
            <div className="flex items-center justify-between gap-2">
              <div className={`text-[11px] font-medium UI_SURFACES.textBright`}>{camera.cameraName}</div>
              <button type="button"
                onClick={() => { selectNode(camera.cameraId); setViewMode("camera_view"); setWorkspacePreset("coverage"); }}
                className={`rounded border UI_SURFACES.borderElevated px-2 py-1 text-[10px] UI_SURFACES.textBlueMuted UI_SURFACES.hoverBg`}
              >View Camera</button>
            </div>
            <div className={`mt-1 text-[10px] UI_SURFACES.textNear italic`}>{camera.roleSummary}</div>
            <div className={`mt-1 text-[10px] UI_SURFACES.textMuted3`}>
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
