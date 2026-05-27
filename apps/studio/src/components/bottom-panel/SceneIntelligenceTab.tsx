"use client";

import { useMemo } from "react";

import { Badge } from "@/components/shared/Badge";
import { cn } from "@/lib/cn";
import { useStudioStore } from "@/store/studio-store";

const SOURCE_STYLES: Record<string, { label: string; className: string; variant: "green" | "blue" | "amber" | "gray" }> = {
  manual: { label: "Manual", className: "border-l-[#22c55e]", variant: "green" },
  scan: { label: "Scan", className: "border-l-[#f59e0b]", variant: "amber" },
  ai: { label: "AI", className: "border-l-[#60a5fa]", variant: "blue" },
  import: { label: "Import", className: "border-l-[#94a3b8]", variant: "gray" },
  preset: { label: "Preset", className: "border-l-[#a78bfa]", variant: "gray" },
  demo: { label: "Demo", className: "border-l-[#64748b]", variant: "gray" },
  simulation: { label: "Simulation", className: "border-l-[#22c55e]", variant: "green" },
};

function StatCard({ label, value, detail }: { label: string; value: string | number; detail?: string }) {
  return (
    <div className="rounded-lg border border-[#1c2130] bg-[#0f1320] px-3 py-2 shadow-[0_0_0_1px_rgba(0,0,0,0.2)]">
      <div className="text-[9px] font-semibold uppercase tracking-[0.14em] text-[#5f6a82]">{label}</div>
      <div className="mt-1 text-[18px] font-semibold leading-none text-[#e5ecfb]">{value}</div>
      {detail ? <div className="mt-1 text-[9px] text-[#74809a]">{detail}</div> : null}
    </div>
  );
}

export function SceneIntelligenceTab() {
  const scene = useStudioStore((s) => s.scene);
  const graph = useStudioStore((s) => s.sceneIntelligenceGraph);
  const simulationResult = useStudioStore((s) => s.simulationResult);

  const sourceRows = useMemo(
    () =>
      Object.entries(graph.summary.sourceCounts).sort((a, b) => b[1] - a[1]),
    [graph.summary.sourceCounts],
  );

  const entityRows = useMemo(
    () => [
      { label: "Walls", value: scene.walls.length },
      { label: "Doors", value: scene.doors.length },
      { label: "Windows", value: scene.windows.length },
      { label: "Cameras", value: scene.cameras.length },
      { label: "Lights", value: scene.securityLights.length },
      { label: "Obstructions", value: scene.obstructions.length },
      { label: "Zones", value: scene.criticalZones.length + scene.privacyZones.length },
      { label: "Paths", value: scene.paths.length },
      { label: "Entry points", value: scene.entryPoints.length },
    ],
    [scene],
  );

  const sceneSubtitle = `${scene.dimensions.width}m × ${scene.dimensions.depth}m × ${scene.dimensions.height}m`;
  const updatedLabel = new Date(graph.updatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <div className="border-b border-[#1e2130] px-3 py-2">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="blue" dot>
            Provenance spine
          </Badge>
          <Badge variant="gray">{graph.summary.sceneSourceLabel}</Badge>
          <span className="text-[10px] text-[#68738a]">
            Updated {updatedLabel}
          </span>
        </div>
        <div className="mt-2 flex flex-wrap items-baseline gap-2">
          <div className="text-[15px] font-semibold text-[#edf2ff]">{scene.name}</div>
          <div className="text-[10px] text-[#73809b]">{sceneSubtitle}</div>
        </div>
      </div>

      <div className="grid flex-1 min-h-0 gap-2 overflow-y-auto px-3 py-2" style={{ gridTemplateColumns: "repeat(4, minmax(0, 1fr))" }}>
        <StatCard label="Nodes" value={graph.summary.nodeCount} detail={`${graph.summary.entityCount} entities / ${graph.summary.sourceCount} sources`} />
        <StatCard label="Edges" value={graph.summary.edgeCount} detail={`${graph.summary.coverageLinkCount} coverage links`} />
        <StatCard label="Revisions" value={graph.summary.revisionDepth} detail={`${graph.summary.snapshotCount} snapshots tracked`} />
        <StatCard label="Failures" value={graph.summary.failedZoneCount} detail={simulationResult ? "zones below target" : "awaiting simulation"} />

        <div className="col-span-4 rounded-lg border border-[#1c2130] bg-[#0f1320] px-3 py-2">
          <div className="flex items-center justify-between gap-2">
            <div>
              <div className="text-[9px] font-semibold uppercase tracking-[0.14em] text-[#5f6a82]">Scene spine</div>
              <div className="mt-1 text-[11px] text-[#aeb8cd]">Scene, assumptions, snapshots, and simulation stay tied to one canonical graph.</div>
            </div>
            <Badge variant={simulationResult ? "green" : "gray"} dot>
              {simulationResult ? "Simulation linked" : "No simulation yet"}
            </Badge>
          </div>
          <div className="mt-3 grid gap-2 md:grid-cols-4">
            {[
              { title: "Scene", body: graph.summary.sceneSourceLabel, hint: scene.name },
              { title: "Assumptions", body: scene.assumptions.doriStandard.toUpperCase(), hint: `${scene.assumptions.timeOfDay} / ${scene.assumptions.interiorLightLevel}` },
              { title: "Snapshots", body: String(graph.summary.snapshotCount), hint: "Saved scene evidence" },
              { title: "Simulation", body: simulationResult ? `${simulationResult.totalCoveragePct.toFixed(1)}%` : "Pending", hint: simulationResult ? "Latest coverage result" : "Run to populate links" },
            ].map((item) => (
              <div key={item.title} className="rounded-md border border-[#1e2130] bg-[#0b0f17] px-3 py-2">
                <div className="text-[8px] font-semibold uppercase tracking-[0.16em] text-[#5f6a82]">{item.title}</div>
                <div className="mt-1 text-[13px] font-semibold text-[#e5ecfb]">{item.body}</div>
                <div className="mt-1 text-[9px] text-[#74809a]">{item.hint}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="col-span-4 rounded-lg border border-[#1c2130] bg-[#0f1320] px-3 py-2">
          <div className="text-[9px] font-semibold uppercase tracking-[0.14em] text-[#5f6a82]">Source lineage</div>
          <div className="mt-2 grid gap-2 md:grid-cols-3 xl:grid-cols-6">
            {sourceRows.length > 0 ? sourceRows.map(([source, count]) => {
              const style = SOURCE_STYLES[source] ?? SOURCE_STYLES.manual;
              return (
                <div key={source} className={cn("rounded-md border border-[#1e2130] border-l-4 bg-[#0b0f17] px-3 py-2", style.className)}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#dbe2f0]">{style.label}</span>
                    <Badge variant={style.variant}>{count}</Badge>
                  </div>
                  <div className="mt-1 text-[9px] text-[#74809a]">Objects attributed to this source</div>
                </div>
              );
            }) : (
              <div className="col-span-full rounded-md border border-dashed border-[#243048] bg-[#0b0f17] px-3 py-3 text-[10px] text-[#74809a]">
                No source lineage yet.
              </div>
            )}
          </div>
        </div>

        <div className="col-span-4 rounded-lg border border-[#1c2130] bg-[#0f1320] px-3 py-2">
          <div className="text-[9px] font-semibold uppercase tracking-[0.14em] text-[#5f6a82]">Scene entities</div>
          <div className="mt-2 grid gap-2 sm:grid-cols-3 xl:grid-cols-5">
            {entityRows.map((item) => (
              <div key={item.label} className="rounded-md border border-[#1e2130] bg-[#0b0f17] px-3 py-2">
                <div className="text-[10px] uppercase tracking-[0.12em] text-[#74809a]">{item.label}</div>
                <div className="mt-1 text-[18px] font-semibold text-[#edf2ff]">{item.value}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
