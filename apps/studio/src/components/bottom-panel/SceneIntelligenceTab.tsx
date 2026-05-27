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

type GraphPoint = { x: number; y: number };

function kindTone(kind: string) {
  switch (kind) {
    case "scene":
      return { fill: "#2563eb", stroke: "#60a5fa", label: "Scene" };
    case "source":
      return { fill: "#0f766e", stroke: "#2dd4bf", label: "Source" };
    case "entity":
      return { fill: "#1f2937", stroke: "#94a3b8", label: "Entity" };
    case "assumption":
      return { fill: "#7c3aed", stroke: "#c4b5fd", label: "Assumption" };
    case "simulation":
      return { fill: "#166534", stroke: "#86efac", label: "Simulation" };
    case "snapshot":
      return { fill: "#9a3412", stroke: "#fdba74", label: "Snapshot" };
    default:
      return { fill: "#334155", stroke: "#94a3b8", label: kind };
  }
}

function columnForKind(kind: string) {
  switch (kind) {
    case "scene":
      return 0;
    case "source":
      return 1;
    case "entity":
      return 2;
    default:
      return 3;
  }
}

export function SceneIntelligenceTab() {
  const scene = useStudioStore((s) => s.scene);
  const graph = useStudioStore((s) => s.sceneIntelligenceGraph);
  const simulationResult = useStudioStore((s) => s.simulationResult);
  const provenanceNotes = useMemo(
    () => (scene.changeLog ?? []).filter((entry) => entry.startsWith("Provenance:") || entry.startsWith("Provenance confidence:")),
    [scene.changeLog],
  );

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
  const graphLayout = useMemo(() => {
    const width = 960;
    const height = 300;
    const columns = new Map<number, string[]>();
    for (const node of graph.nodes) {
      const column = columnForKind(node.kind);
      const list = columns.get(column) ?? [];
      list.push(node.id);
      columns.set(column, list);
    }

    const positions = new Map<string, GraphPoint>();
    const columnX = [70, 300, 560, 830];
    for (const [columnIndex, nodeIds] of columns.entries()) {
      const spacing = height / Math.max(1, nodeIds.length + 1);
      nodeIds
        .map((id) => graph.nodes.find((node) => node.id === id)!)
        .sort((a, b) => a.label.localeCompare(b.label))
        .forEach((node, index) => {
          positions.set(node.id, {
            x: columnX[columnIndex] ?? columnX[columnX.length - 1]!,
            y: spacing * (index + 1),
          });
        });
    }

    const edges = graph.edges
      .map((edge) => ({
        edge,
        from: positions.get(edge.from),
        to: positions.get(edge.to),
      }))
      .filter((item) => item.from && item.to);

    return { width, height, positions, edges };
  }, [graph.edges, graph.nodes]);

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

      <div className="flex-1 min-h-0 overflow-y-auto px-3 py-2">
        <div className="rounded-lg border border-[#1c2130] bg-[#0f1320] px-3 py-2">
          <div className="flex items-center justify-between gap-2">
            <div>
              <div className="text-[9px] font-semibold uppercase tracking-[0.14em] text-[#5f6a82]">Graph map</div>
              <div className="mt-1 text-[11px] text-[#aeb8cd]">Root scene, source lineage, entities, and validation nodes wired into one derived view.</div>
            </div>
            <div className="flex flex-wrap items-center gap-1">
              {["scene", "source", "entity", "assumption", "simulation", "snapshot"].map((kind) => {
                const tone = kindTone(kind);
                return (
                  <Badge key={kind} variant="gray" className="bg-[#0b0f17] text-[#dbe2f0]">
                    <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: tone.stroke }} />
                    {tone.label}
                  </Badge>
                );
              })}
            </div>
          </div>

          <div className="mt-3 overflow-hidden rounded-xl border border-[#1e2130] bg-[#09111b]">
            <svg viewBox={`0 0 ${graphLayout.width} ${graphLayout.height}`} className="block h-[320px] w-full">
              <defs>
                <linearGradient id="graph-edge" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#34507a" stopOpacity="0.35" />
                  <stop offset="100%" stopColor="#6ee7f9" stopOpacity="0.6" />
                </linearGradient>
              </defs>
              {graphLayout.edges.map(({ edge, from, to }) => (
                <line
                  key={edge.id}
                  x1={from!.x}
                  y1={from!.y}
                  x2={to!.x}
                  y2={to!.y}
                  stroke={edge.kind === "covers" ? "#22c55e" : edge.kind === "assesses" ? "#f59e0b" : "url(#graph-edge)"}
                  strokeOpacity={0.6}
                  strokeWidth={edge.kind === "covers" ? 2.4 : 1.6}
                />
              ))}
              {graph.nodes.map((node) => {
                const point = graphLayout.positions.get(node.id);
                if (!point) return null;
                const tone = kindTone(node.kind);
                return (
                  <g key={node.id} transform={`translate(${point.x}, ${point.y})`}>
                    <circle r={node.kind === "scene" ? 28 : node.kind === "simulation" ? 22 : 18} fill={tone.fill} stroke={tone.stroke} strokeWidth="2" />
                    <text x="0" y="4" textAnchor="middle" className="fill-white text-[10px] font-semibold">
                      {node.kind === "scene" ? "SC" : node.kind === "source" ? "SO" : node.kind === "entity" ? "EN" : node.kind === "simulation" ? "SIM" : node.kind === "snapshot" ? "SN" : "AS"}
                    </text>
                    <text x={node.kind === "scene" ? -38 : -58} y={node.kind === "scene" ? 44 : 34} className="fill-[#dbe2f0] text-[9px] font-medium">
                      {node.label}
                    </text>
                    {node.subtitle ? (
                      <text x={node.kind === "scene" ? -38 : -58} y={node.kind === "scene" ? 56 : 46} className="fill-[#74809a] text-[8px]">
                        {node.subtitle}
                      </text>
                    ) : null}
                  </g>
                );
              })}
            </svg>
          </div>
        </div>

        <div className="mt-2 grid gap-2" style={{ gridTemplateColumns: "repeat(4, minmax(0, 1fr))" }}>
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
        {provenanceNotes.length > 0 ? (
          <div className="col-span-4 rounded-lg border border-[#1c2130] bg-[#0f1320] px-3 py-2">
            <div className="text-[9px] font-semibold uppercase tracking-[0.14em] text-[#5f6a82]">Provenance notes</div>
            <ul className="mt-2 space-y-1 text-[10px] text-[#8aa1c4]">
              {provenanceNotes.map((note) => (
                <li key={note}>• {note}</li>
              ))}
            </ul>
          </div>
        ) : null}
        </div>
      </div>
    </div>
  );
}
