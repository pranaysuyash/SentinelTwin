"use client";

import { useEffect, useMemo, useState } from "react";

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

type GraphPoint = { x: number; y: number };

function StatCard({ label, value, detail }: { label: string; value: string | number; detail?: string }) {
  return (
    <div className="rounded-lg border border-[#1c2130] bg-[#0f1320] px-3 py-2 shadow-[0_0_0_1px_rgba(0,0,0,0.2)]">
      <div className="text-[9px] font-semibold uppercase tracking-[0.14em] text-[#5f6a82]">{label}</div>
      <div className="mt-1 text-[18px] font-semibold leading-none text-[#e5ecfb]">{value}</div>
      {detail ? <div className="mt-1 text-[9px] text-[#74809a]">{detail}</div> : null}
    </div>
  );
}

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

function edgeTone(kind: string, status?: "pass" | "partial" | "fail", selected = false) {
  if (selected) {
    return { stroke: "#f8fafc", opacity: 0.95, width: 3.2 };
  }

  if (kind === "covers") {
    return status === "pass"
      ? { stroke: "#22c55e", opacity: 0.75, width: 2.5 }
      : status === "partial"
        ? { stroke: "#f59e0b", opacity: 0.75, width: 2.5 }
        : { stroke: "#ef4444", opacity: 0.8, width: 2.7 };
  }

  if (kind === "assesses") {
    return { stroke: "#f59e0b", opacity: 0.7, width: 2 };
  }

  if (kind === "validated_by") {
    return { stroke: "#6ee7f9", opacity: 0.7, width: 1.8 };
  }

  return { stroke: "#34507a", opacity: 0.55, width: 1.6 };
}

function nodeInitials(kind: string) {
  switch (kind) {
    case "scene":
      return "SC";
    case "source":
      return "SO";
    case "entity":
      return "EN";
    case "simulation":
      return "SIM";
    case "snapshot":
      return "SN";
    case "assumption":
      return "AS";
    default:
      return kind.slice(0, 2).toUpperCase();
  }
}

function relationLabel(kind: string) {
  switch (kind) {
    case "contains":
      return "contains";
    case "originates_from":
      return "originates from";
    case "assesses":
      return "assesses";
    case "covers":
      return "covers";
    case "validated_by":
      return "validated by";
    default:
      return kind.replace(/_/g, " ");
  }
}

function sourceLabel(source?: string) {
  if (!source) return "Derived";
  return SOURCE_STYLES[source]?.label ?? source;
}

export function SceneIntelligenceTab() {
  const scene = useStudioStore((s) => s.scene);
  const graph = useStudioStore((s) => s.sceneIntelligenceGraph);
  const simulationResult = useStudioStore((s) => s.simulationResult);
  const provenanceNotes = useMemo(
    () => (scene.changeLog ?? []).filter((entry) => entry.startsWith("Provenance:") || entry.startsWith("Provenance confidence:")),
    [scene.changeLog],
  );

  const [selectedNodeId, setSelectedNodeId] = useState(graph.rootId);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);

  useEffect(() => {
    if (!graph.nodes.some((node) => node.id === selectedNodeId)) {
      setSelectedNodeId(graph.rootId);
    }
  }, [graph.nodes, graph.rootId, selectedNodeId]);

  useEffect(() => {
    if (selectedEdgeId && !graph.edges.some((edge) => edge.id === selectedEdgeId)) {
      setSelectedEdgeId(null);
    }
  }, [graph.edges, selectedEdgeId]);

  const nodeById = useMemo(() => new Map(graph.nodes.map((node) => [node.id, node] as const)), [graph.nodes]);
  const edgeById = useMemo(() => new Map(graph.edges.map((edge) => [edge.id, edge] as const)), [graph.edges]);

  const selectedNode = nodeById.get(selectedNodeId) ?? nodeById.get(graph.rootId) ?? graph.nodes[0] ?? null;
  const selectedEdge = selectedEdgeId ? edgeById.get(selectedEdgeId) ?? null : null;

  const sourceRows = useMemo(
    () => Object.entries(graph.summary.sourceCounts).sort((a, b) => b[1] - a[1]),
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
    const width = 980;
    const height = 360;
    const columns = new Map<number, typeof graph.nodes>();

    for (const node of graph.nodes) {
      const column = columnForKind(node.kind);
      const bucket = columns.get(column) ?? [];
      bucket.push(node);
      columns.set(column, bucket);
    }

    const positions = new Map<string, GraphPoint>();
    const columnX = [110, 345, 600, 855];

    for (const [columnIndex, bucket] of columns.entries()) {
      const sorted = [...bucket].sort((a, b) => a.label.localeCompare(b.label));
      const spacing = height / Math.max(1, sorted.length + 1);
      sorted.forEach((node, index) => {
        const x = columnX[columnIndex] ?? columnX[columnX.length - 1]!;
        const y = columnIndex === 0 ? height / 2 : spacing * (index + 1);
        positions.set(node.id, { x, y });
      });
    }

    const edges = graph.edges
      .map((edge) => {
        const from = positions.get(edge.from);
        const to = positions.get(edge.to);
        if (!from || !to) return null;
        return {
          edge,
          from,
          to,
          midpoint: {
            x: (from.x + to.x) / 2,
            y: (from.y + to.y) / 2,
          },
        };
      })
      .filter((item): item is { edge: typeof graph.edges[number]; from: GraphPoint; to: GraphPoint; midpoint: GraphPoint } => item != null);

    const nodes = graph.nodes.map((node) => ({
      node,
      point: positions.get(node.id),
      radius: node.kind === "scene" ? 32 : node.kind === "simulation" ? 22 : node.kind === "snapshot" ? 20 : 18,
    }));

    return { width, height, nodes, edges };
  }, [graph.edges, graph.nodes]);

  const connectedEdges = useMemo(() => {
    if (!selectedNode) return [];
    return graph.edges.filter((edge) => edge.from === selectedNode.id || edge.to === selectedNode.id);
  }, [graph.edges, selectedNode]);

  const incomingEdges = useMemo(() => {
    if (!selectedNode) return [];
    return connectedEdges.filter((edge) => edge.to === selectedNode.id);
  }, [connectedEdges, selectedNode]);

  const outgoingEdges = useMemo(() => {
    if (!selectedNode) return [];
    return connectedEdges.filter((edge) => edge.from === selectedNode.id);
  }, [connectedEdges, selectedNode]);

  const selectedNodeTone = selectedNode ? kindTone(selectedNode.kind) : null;
  const selectedEdgeSource = selectedEdge ? nodeById.get(selectedEdge.from) ?? null : null;
  const selectedEdgeTarget = selectedEdge ? nodeById.get(selectedEdge.to) ?? null : null;

  const handleNodeSelect = (nodeId: string) => {
    setSelectedNodeId(nodeId);
    setSelectedEdgeId(null);
  };

  const handleEdgeSelect = (edgeId: string) => {
    setSelectedEdgeId(edgeId);
  };

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <div className="border-b border-[#1e2130] px-3 py-2">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="blue" dot>
            Provenance spine
          </Badge>
          <Badge variant="gray">{graph.summary.sceneSourceLabel}</Badge>
          <span className="text-[10px] text-[#68738a]">Updated {updatedLabel}</span>
        </div>
        <div className="mt-2 flex flex-wrap items-baseline gap-2">
          <div className="text-[15px] font-semibold text-[#edf2ff]">{scene.name}</div>
          <div className="text-[10px] text-[#73809b]">{sceneSubtitle}</div>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-3 py-2">
        <div className="rounded-lg border border-[#1c2130] bg-[#0f1320] px-3 py-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="text-[9px] font-semibold uppercase tracking-[0.14em] text-[#5f6a82]">Graph map</div>
              <div className="mt-1 text-[11px] text-[#aeb8cd]">
                Click any node or relation to inspect where it came from and how the simulation verified it.
              </div>
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

          <div className="relative mt-3 overflow-hidden rounded-xl border border-[#1e2130] bg-[#09111b]">
            <svg viewBox={`0 0 ${graphLayout.width} ${graphLayout.height}`} className="block h-[360px] w-full">
              <defs>
                <linearGradient id="graph-edge" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#34507a" stopOpacity="0.35" />
                  <stop offset="100%" stopColor="#6ee7f9" stopOpacity="0.6" />
                </linearGradient>
              </defs>

              {graphLayout.edges.map(({ edge, from, to, midpoint }) => {
                const selected = edge.id === selectedEdgeId || (selectedNode ? edge.from === selectedNode.id || edge.to === selectedNode.id : false);
                const tone = edgeTone(edge.kind, edge.status, selected);
                const showLabel = selected || edge.kind !== "contains";
                return (
                  <g key={edge.id}>
                    <line
                      x1={from.x}
                      y1={from.y}
                      x2={to.x}
                      y2={to.y}
                      stroke="transparent"
                      strokeWidth={14}
                      className="cursor-pointer"
                      onClick={() => handleEdgeSelect(edge.id)}
                    />
                    <line
                      x1={from.x}
                      y1={from.y}
                      x2={to.x}
                      y2={to.y}
                      stroke={edge.kind === "covers" ? tone.stroke : edge.kind === "assesses" ? "#f59e0b" : edge.kind === "validated_by" ? "#6ee7f9" : "url(#graph-edge)"}
                      strokeOpacity={tone.opacity}
                      strokeWidth={tone.width}
                    />
                    {showLabel && edge.label ? (
                      <text x={midpoint.x} y={midpoint.y - 5} textAnchor="middle" className="fill-[#dbe2f0] text-[9px] font-medium">
                        {edge.label}
                      </text>
                    ) : null}
                  </g>
                );
              })}
            </svg>

            <div className="pointer-events-none absolute inset-0">
              {graphLayout.nodes.map(({ node, point, radius }) => {
                if (!point) return null;
                const tone = kindTone(node.kind);
                const selected = node.id === selectedNodeId;
                return (
                  <button
                    key={node.id}
                    type="button"
                    onClick={() => handleNodeSelect(node.id)}
                    title={`${node.label}${node.subtitle ? ` · ${node.subtitle}` : ""}`}
                    aria-label={`Inspect ${node.label}`}
                    className={cn(
                      "pointer-events-auto absolute -translate-x-1/2 -translate-y-1/2 rounded-full border-2 transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-sky-300/70",
                      selected ? "scale-110" : "hover:scale-105",
                    )}
                    style={{
                      left: point.x,
                      top: point.y,
                      width: radius * 2,
                      height: radius * 2,
                      background: tone.fill,
                      borderColor: tone.stroke,
                      boxShadow: selected ? "0 0 0 5px rgba(56,189,248,0.18)" : "0 8px 24px rgba(0,0,0,0.25)",
                    }}
                  >
                    <span className="sr-only">Inspect {node.label}</span>
                    <span className="flex h-full w-full items-center justify-center text-[9px] font-semibold text-white">{nodeInitials(node.kind)}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="mt-2 grid gap-2 md:grid-cols-4">
          <StatCard label="Nodes" value={graph.summary.nodeCount} detail={`${graph.summary.entityCount} entities / ${graph.summary.sourceCount} sources`} />
          <StatCard label="Edges" value={graph.summary.edgeCount} detail={`${graph.summary.coverageLinkCount} coverage links`} />
          <StatCard label="Revisions" value={graph.summary.revisionDepth} detail={`${graph.summary.snapshotCount} snapshots tracked`} />
          <StatCard label="Failures" value={graph.summary.failedZoneCount} detail={simulationResult ? "zones below target" : "awaiting simulation"} />
        </div>

        <div className="mt-2 grid gap-2 xl:grid-cols-2">
          <div className="rounded-lg border border-[#1c2130] bg-[#0f1320] px-3 py-2">
            <div className="flex items-center justify-between gap-2">
              <div>
                <div className="text-[9px] font-semibold uppercase tracking-[0.14em] text-[#5f6a82]">Selected node</div>
                <div className="mt-1 text-[11px] text-[#aeb8cd]">Trace the current node back to its source and forward into the simulation.</div>
              </div>
              {selectedNodeTone ? (
                <Badge variant="gray" className="bg-[#0b0f17] text-[#dbe2f0]">
                  {selectedNodeTone.label}
                </Badge>
              ) : null}
            </div>

            {selectedNode ? (
              <div className="mt-3 grid gap-3 md:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
                <div className="rounded-md border border-[#1e2130] bg-[#0b0f17] px-3 py-2">
                  <div className="text-sm font-semibold text-[#edf2ff]">{selectedNode.label}</div>
                  {selectedNode.subtitle ? <div className="mt-1 text-[10px] text-[#74809a]">{selectedNode.subtitle}</div> : null}
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <Badge variant="blue">{selectedNode.kind}</Badge>
                    <Badge variant={selectedNode.source ? SOURCE_STYLES[selectedNode.source]?.variant ?? "gray" : "gray"}>
                      {sourceLabel(selectedNode.source)}
                    </Badge>
                    {selectedNode.count != null ? <Badge variant="gray">{selectedNode.count} linked</Badge> : null}
                  </div>
                </div>

                <div className="rounded-md border border-[#1e2130] bg-[#0b0f17] px-3 py-2">
                  <div className="text-[9px] font-semibold uppercase tracking-[0.14em] text-[#5f6a82]">Trace</div>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <StatCard label="Incoming" value={incomingEdges.length} detail="Relations that point here" />
                    <StatCard label="Outgoing" value={outgoingEdges.length} detail="Relations this node creates" />
                  </div>
                </div>
              </div>
            ) : (
              <div className="mt-3 rounded-md border border-dashed border-[#243048] bg-[#0b0f17] px-3 py-4 text-[10px] text-[#74809a]">
                No node selected. Click the scene root or any entity to inspect its provenance.
              </div>
            )}

            {selectedNode ? (
              <div className="mt-3 grid gap-2">
                {[...incomingEdges, ...outgoingEdges].length > 0 ? (
                  [...incomingEdges, ...outgoingEdges]
                    .sort((a, b) => a.kind.localeCompare(b.kind) || a.id.localeCompare(b.id))
                    .map((edge) => {
                      const isSelected = edge.id === selectedEdgeId;
                      const fromNode = nodeById.get(edge.from);
                      const toNode = nodeById.get(edge.to);
                      return (
                        <button
                          key={edge.id}
                          type="button"
                          onClick={() => handleEdgeSelect(edge.id)}
                          className={cn(
                            "rounded-md border px-3 py-2 text-left transition-colors",
                            isSelected
                              ? "border-sky-400/30 bg-sky-500/10"
                              : "border-[#1e2130] bg-[#0b0f17] hover:border-[#2b3750] hover:bg-[#0e1420]",
                          )}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#aeb8cd]">
                              {relationLabel(edge.kind)}
                            </div>
                            {edge.status ? <Badge variant={edge.status === "pass" ? "green" : edge.status === "partial" ? "amber" : "gray"}>{edge.status}</Badge> : null}
                          </div>
                          <div className="mt-1 text-[11px] text-[#e5ecfb]">
                            {fromNode?.label ?? edge.from} → {toNode?.label ?? edge.to}
                          </div>
                          {edge.label ? <div className="mt-1 text-[10px] text-[#74809a]">{edge.label}</div> : null}
                        </button>
                      );
                    })
                ) : (
                  <div className="rounded-md border border-dashed border-[#243048] bg-[#0b0f17] px-3 py-3 text-[10px] text-[#74809a]">
                    This node currently has no explicit relationship edges.
                  </div>
                )}
              </div>
            ) : null}
          </div>

          <div className="rounded-lg border border-[#1c2130] bg-[#0f1320] px-3 py-2">
            <div className="flex items-center justify-between gap-2">
              <div>
                <div className="text-[9px] font-semibold uppercase tracking-[0.14em] text-[#5f6a82]">Selected relation</div>
                <div className="mt-1 text-[11px] text-[#aeb8cd]">Inspect the selected edge and jump to either side of the trace.</div>
              </div>
              <Badge variant={selectedEdge ? "blue" : "gray"} dot>
                {selectedEdge ? relationLabel(selectedEdge.kind) : "No relation selected"}
              </Badge>
            </div>

            {selectedEdge ? (
              <div className="mt-3 rounded-md border border-[#1e2130] bg-[#0b0f17] px-3 py-2">
                <div className="text-sm font-semibold text-[#edf2ff]">{selectedEdge.label ?? relationLabel(selectedEdge.kind)}</div>
                <div className="mt-1 text-[10px] text-[#74809a]">
                  {selectedEdgeSource?.label ?? selectedEdge.from} → {selectedEdgeTarget?.label ?? selectedEdge.to}
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <Badge variant="gray">{selectedEdge.kind}</Badge>
                  {selectedEdge.status ? <Badge variant={selectedEdge.status === "pass" ? "green" : selectedEdge.status === "partial" ? "amber" : "gray"}>{selectedEdge.status}</Badge> : null}
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => selectedEdgeSource && handleNodeSelect(selectedEdgeSource.id)}
                    className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[11px] font-medium hover:bg-white/[0.08]"
                  >
                    Focus source
                  </button>
                  <button
                    type="button"
                    onClick={() => selectedEdgeTarget && handleNodeSelect(selectedEdgeTarget.id)}
                    className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[11px] font-medium hover:bg-white/[0.08]"
                  >
                    Focus target
                  </button>
                </div>
              </div>
            ) : (
              <div className="mt-3 rounded-md border border-dashed border-[#243048] bg-[#0b0f17] px-3 py-4 text-[10px] text-[#74809a]">
                Click a line in the graph or a relation in the trace list to inspect the link.
              </div>
            )}

            <div className="mt-3 rounded-lg border border-[#1c2130] bg-[#0f1320] px-3 py-2">
              <div className="text-[9px] font-semibold uppercase tracking-[0.14em] text-[#5f6a82]">Scene spine</div>
              <div className="mt-1 text-[11px] text-[#aeb8cd]">Scene, assumptions, snapshots, and simulation stay tied to one canonical graph.</div>
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
          </div>
        </div>

        <div className="mt-2 grid gap-2 xl:grid-cols-2">
          <div className="rounded-lg border border-[#1c2130] bg-[#0f1320] px-3 py-2">
            <div className="text-[9px] font-semibold uppercase tracking-[0.14em] text-[#5f6a82]">Source lineage</div>
            <div className="mt-2 grid gap-2 md:grid-cols-3 xl:grid-cols-6">
              {sourceRows.length > 0 ? (
                sourceRows.map(([source, count]) => {
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
                })
              ) : (
                <div className="col-span-full rounded-md border border-dashed border-[#243048] bg-[#0b0f17] px-3 py-3 text-[10px] text-[#74809a]">
                  No source lineage yet.
                </div>
              )}
            </div>
          </div>

          <div className="rounded-lg border border-[#1c2130] bg-[#0f1320] px-3 py-2">
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

        {provenanceNotes.length > 0 ? (
          <div className="mt-2 rounded-lg border border-[#1c2130] bg-[#0f1320] px-3 py-2">
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
  );
}
