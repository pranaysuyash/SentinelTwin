"use client";

import { BadgeInfo, Layers3, RefreshCw, ShieldAlert, Sparkles, TimerReset, TriangleAlert, Waves } from "lucide-react";

import { RunSimulationPrompt } from "@/components/shared/RunSimulationPrompt";
import { useStudioStore } from "@/store/studio-store";

const OVERLAY_DENSITY_OPTIONS = [
  { value: "all", label: "All" },
  { value: "compact", label: "Compact" },
  { value: "minimal", label: "Minimal" },
] as const;

function Section({
  title,
  icon,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-[#1f2536] bg-[#0b0f17] p-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.02)]">
      <div className="mb-2 flex items-center gap-1.5 text-[9px] font-semibold uppercase tracking-[0.18em] text-[#556076]">
        {icon}
        {title}
      </div>
      {children}
    </div>
  );
}

function PillButton({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-md border px-2 py-1 text-[9px] transition-colors ${
        active
          ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
          : "border-[#1e2130] bg-[#0f141f] text-[#8090a8] hover:border-[#2a3245] hover:text-white"
      }`}
    >
      {children}
    </button>
  );
}

export function DebugTab() {
  const scene = useStudioStore((s) => s.scene);
  const result = useStudioStore((s) => s.simulationResult);
  const lastRunMs = useStudioStore((s) => s.lastRunMs);
  const showDebugOverlays = useStudioStore((s) => s.showDebugOverlays);
  const setShowDebugOverlays = useStudioStore((s) => s.setShowDebugOverlays);
  const overlayDensity = useStudioStore((s) => s.overlayDensity);
  const setOverlayDensity = useStudioStore((s) => s.setOverlayDensity);
  const autoRecompute = useStudioStore((s) => s.autoRecompute);
  const toggleAutoRecompute = useStudioStore((s) => s.toggleAutoRecompute);
  const cameraFailures = useStudioStore((s) => s.cameraFailures);
  const clearAllCameraFailures = useStudioStore((s) => s.clearAllCameraFailures);
  const sceneIntelligenceGraph = useStudioStore((s) => s.sceneIntelligenceGraph);
  const assumptions = useStudioStore((s) => s.scene.assumptions);
  const toggleLayer = useStudioStore((s) => s.toggleLayer);
  const layers = useStudioStore((s) => s.layerVisibility);

  if (!result) {
    return (
      <RunSimulationPrompt
        className="h-full px-4"
        message="Run the shared simulation to populate the debug overlays and graph stats."
      />
    );
  }

  const summary = sceneIntelligenceGraph.summary;
  const sourceEntries = Object.entries(summary.sourceCounts).filter(([, count]) => count > 0);

  return (
    <div className="flex h-full gap-4 overflow-y-auto px-3 py-2">
      <div className="min-w-[240px] space-y-2.5">
        <Section title="Debug Controls" icon={<Sparkles className="h-3 w-3 text-emerald-400" />}>
          <div className="flex flex-wrap gap-1.5">
            <PillButton active={showDebugOverlays} onClick={() => setShowDebugOverlays(!showDebugOverlays)}>
              Debug Overlays {showDebugOverlays ? "On" : "Off"}
            </PillButton>
            <PillButton active={autoRecompute} onClick={toggleAutoRecompute}>
              Auto Recompute {autoRecompute ? "On" : "Off"}
            </PillButton>
          </div>
          <div className="mt-2">
            <div className="mb-1 text-[8px] font-semibold uppercase tracking-[0.18em] text-[#556076]">Overlay Density</div>
            <div className="flex gap-1">
              {OVERLAY_DENSITY_OPTIONS.map((option) => (
                <PillButton
                  key={option.value}
                  active={overlayDensity === option.value}
                  onClick={() => setOverlayDensity(option.value)}
                >
                  {option.label}
                </PillButton>
              ))}
            </div>
          </div>
        </Section>

        <Section title="Live Stats" icon={<BadgeInfo className="h-3 w-3 text-sky-400" />}>
          <div className="space-y-1.5 text-[9px]">
            <div className="flex items-center justify-between rounded-md border border-[#1a2030] bg-[#0f141f] px-2 py-1">
              <span className="text-[#8b96ab]">Last run</span>
              <span className="font-mono text-[#d2d9e8]">{lastRunMs ? `${lastRunMs} ms` : "—"}</span>
            </div>
            <div className="flex items-center justify-between rounded-md border border-[#1a2030] bg-[#0f141f] px-2 py-1">
              <span className="text-[#8b96ab]">Scene nodes</span>
              <span className="font-mono text-[#d2d9e8]">{summary.nodeCount}</span>
            </div>
            <div className="flex items-center justify-between rounded-md border border-[#1a2030] bg-[#0f141f] px-2 py-1">
              <span className="text-[#8b96ab]">Edges</span>
              <span className="font-mono text-[#d2d9e8]">{summary.edgeCount}</span>
            </div>
            <div className="flex items-center justify-between rounded-md border border-[#1a2030] bg-[#0f141f] px-2 py-1">
              <span className="text-[#8b96ab]">Coverage links</span>
              <span className="font-mono text-[#d2d9e8]">{summary.coverageLinkCount}</span>
            </div>
            <div className="flex items-center justify-between rounded-md border border-[#1a2030] bg-[#0f141f] px-2 py-1">
              <span className="text-[#8b96ab]">Failed zones</span>
              <span className="font-mono text-[#d2d9e8]">{summary.failedZoneCount}</span>
            </div>
          </div>
        </Section>
      </div>

      <div className="min-w-0 flex-1 space-y-2.5">
        <Section title="Scene Graph" icon={<Layers3 className="h-3 w-3 text-cyan-400" />}>
          <div className="grid grid-cols-2 gap-1.5 md:grid-cols-3">
            <div className="rounded-md border border-[#1a2030] bg-[#0f141f] px-2 py-1.5">
              <div className="text-[8px] uppercase tracking-[0.18em] text-[#556076]">Scene source</div>
              <div className="mt-0.5 text-[9px] font-semibold text-[#d2d9e8]">{summary.sceneSourceLabel}</div>
            </div>
            <div className="rounded-md border border-[#1a2030] bg-[#0f141f] px-2 py-1.5">
              <div className="text-[8px] uppercase tracking-[0.18em] text-[#556076]">Cameras</div>
              <div className="mt-0.5 text-[9px] font-semibold text-[#d2d9e8]">{summary.cameraCount}</div>
            </div>
            <div className="rounded-md border border-[#1a2030] bg-[#0f141f] px-2 py-1.5">
              <div className="text-[8px] uppercase tracking-[0.18em] text-[#556076]">Zones</div>
              <div className="mt-0.5 text-[9px] font-semibold text-[#d2d9e8]">{summary.zoneCount}</div>
            </div>
            <div className="rounded-md border border-[#1a2030] bg-[#0f141f] px-2 py-1.5">
              <div className="text-[8px] uppercase tracking-[0.18em] text-[#556076]">Sources</div>
              <div className="mt-0.5 text-[9px] font-semibold text-[#d2d9e8]">{summary.sourceCount}</div>
            </div>
            <div className="rounded-md border border-[#1a2030] bg-[#0f141f] px-2 py-1.5">
              <div className="text-[8px] uppercase tracking-[0.18em] text-[#556076]">Revision depth</div>
              <div className="mt-0.5 text-[9px] font-semibold text-[#d2d9e8]">{summary.revisionDepth}</div>
            </div>
            <div className="rounded-md border border-[#1a2030] bg-[#0f141f] px-2 py-1.5">
              <div className="text-[8px] uppercase tracking-[0.18em] text-[#556076]">Snapshots</div>
              <div className="mt-0.5 text-[9px] font-semibold text-[#d2d9e8]">{summary.snapshotCount}</div>
            </div>
          </div>
          <div className="mt-2 space-y-1.5">
            <div className="text-[8px] font-semibold uppercase tracking-[0.18em] text-[#556076]">Source Breakdown</div>
            <div className="flex flex-wrap gap-1.5">
              {sourceEntries.length > 0 ? sourceEntries.map(([source, count]) => (
                <span key={source} className="rounded-md border border-[#1a2030] bg-[#0f141f] px-2 py-1 text-[9px] text-[#d2d9e8]">
                  {source}: <span className="font-mono text-[#8b96ab]">{count}</span>
                </span>
              )) : (
                <span className="text-[9px] text-[#59637a]">No source breakdown yet.</span>
              )}
            </div>
          </div>
        </Section>

        <div className="grid grid-cols-2 gap-2.5">
          <Section title="Camera Failures" icon={<ShieldAlert className="h-3 w-3 text-rose-400" />}>
            <div className="flex items-center justify-between gap-2">
              <div className="text-[9px] text-[#8b96ab]">
                {cameraFailures.length > 0 ? `${cameraFailures.length} simulated camera failures active` : "No simulated camera failures active"}
              </div>
              {cameraFailures.length > 0 ? (
                <button
                  type="button"
                  onClick={clearAllCameraFailures}
                  className="rounded-md border border-[#1e2538] bg-[#111521] px-2 py-1 text-[9px] text-[#c7d0e4] hover:border-[#2a3245] hover:text-white"
                >
                  Clear All
                </button>
              ) : null}
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {cameraFailures.length > 0 ? cameraFailures.slice(0, 5).map((cameraId) => (
                <span key={cameraId} className="rounded-md border border-[#1a2030] bg-[#0f141f] px-2 py-1 text-[9px] text-[#d2d9e8]">
                  {cameraId}
                </span>
              )) : (
                <span className="text-[9px] text-[#59637a]">Use the camera failure shortcut or toolbar action to stage failure analysis.</span>
              )}
            </div>
          </Section>

          <Section title="Simulation Notes" icon={<TimerReset className="h-3 w-3 text-amber-400" />}>
            <div className="space-y-1.5 text-[9px] text-[#8b96ab]">
              <div className="rounded-md border border-[#1a2030] bg-[#0f141f] px-2 py-1">
                Assumptions: {assumptions.doriStandard === "oodpcvs_2025" ? "OODPCVS 2025" : "DORI 2014"} · {assumptions.timeOfDay} · {assumptions.interiorLightLevel}
              </div>
              <div className="rounded-md border border-[#1a2030] bg-[#0f141f] px-2 py-1">
                Debug overlays show coverage, timing, and source-state context so you can understand why a scene changed after recompute.
              </div>
              <div className="rounded-md border border-[#1a2030] bg-[#0f141f] px-2 py-1">
                Toggle <span className="text-[#d2d9e8]">Debug Overlays</span> or lower <span className="text-[#d2d9e8]">Overlay Density</span> if the shell is too noisy for a live review.
              </div>
            </div>
          </Section>
        </div>

        <Section title="Layer Visibility" icon={<Waves className="h-3 w-3 text-sky-400" />}>
          <div className="grid grid-cols-2 gap-1.5 md:grid-cols-3 lg:grid-cols-4">
            {[
              ["cameras", "Cameras"],
              ["camera_cones", "Camera Cones"],
              ["obstructions", "Obstructions"],
              ["lights", "Lights"],
              ["critical_zones", "Critical Zones"],
              ["privacy_zones", "Privacy Zones"],
              ["paths", "Paths"],
              ["heatmap", "Heatmap"],
              ["grid", "Grid"],
              ["walls_floors", "Walls & Floors"],
              ["labels", "Labels"],
            ].map(([layerId, label]) => (
              <button
                key={layerId}
                type="button"
                onClick={() => toggleLayer(layerId as keyof typeof layers)}
                className={`rounded-md border px-2 py-1.5 text-left text-[9px] transition-colors ${
                  layers[layerId as keyof typeof layers]
                    ? "border-sky-400/20 bg-sky-500/10 text-sky-100"
                    : "border-[#1e2030] bg-[#0f141f] text-[#59637a] hover:border-[#2a3245] hover:text-white"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </Section>
      </div>
    </div>
  );
}
