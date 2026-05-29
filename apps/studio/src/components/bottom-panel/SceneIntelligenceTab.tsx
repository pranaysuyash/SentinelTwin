"use client";

import { useEffect, useMemo, useState } from "react";

import { Badge } from "@/components/shared/Badge";
import { cn } from "@/lib/cn";
import {
  assessOperationalEvidenceMergeReadiness,
  confidenceLabel,
  compareOperationalEvidenceBranches,
  filterOperationalEvidenceEvents,
  getOperationalEvidenceCheckpoints,
  reconstructSceneFromEvidence,
  summarizeOperationalEvidenceBranchHeads,
  summarizeOperationalEvidenceLifecycle,
  summarizeSceneEvidence,
  traceOperationalEvidenceLineage,
  type OperationalEvidenceLifecycleStage,
} from "@/lib/operational-evidence";
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

function formatLedgerTime(timestamp: number) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "UTC",
  }).format(new Date(timestamp));
}

export function SceneIntelligenceTab() {
  const scene = useStudioStore((s) => s.scene);
  const graph = useStudioStore((s) => s.sceneIntelligenceGraph);
  const simulationResult = useStudioStore((s) => s.simulationResult);
  const operationalEvidenceEvents = useStudioStore((s) => s.operationalEvidenceEvents);
  const sensorEvents = useStudioStore((s) => s.sensorEvents.filter((event) => event.sceneId === s.scene.id));
  const cameraMetadataEvents = useStudioStore((s) => s.cameraMetadataEvents.filter((event) => event.sceneId === s.scene.id));
  const cameraLiveConnectionEvents = useStudioStore((s) => s.cameraLiveConnectionEvents.filter((event) => event.sceneId === s.scene.id));
  const restoreSceneFromEvidence = useStudioStore((s) => s.restoreSceneFromEvidence);
  const publishCurrentScene = useStudioStore((s) => s.publishCurrentScene);
  const provenanceNotes = useMemo(
    () => (scene.changeLog ?? []).filter((entry) => entry.startsWith("Provenance:") || entry.startsWith("Provenance confidence:")),
    [scene.changeLog],
  );

  const [selectedNodeId, setSelectedNodeId] = useState(graph.rootId);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [selectedEvidenceEventId, setSelectedEvidenceEventId] = useState<string | null>(null);
  const [comparisonLeftEventId, setComparisonLeftEventId] = useState<string | null>(null);
  const [comparisonRightEventId, setComparisonRightEventId] = useState<string | null>(null);
  const [evidenceQuery, setEvidenceQuery] = useState("");
  const [evidenceStageFilter, setEvidenceStageFilter] = useState<OperationalEvidenceLifecycleStage | "all">("all");
  const [evidenceBranchFilter, setEvidenceBranchFilter] = useState<string | "all">("all");

  const nodeById = useMemo(() => new Map(graph.nodes.map((node) => [node.id, node] as const)), [graph.nodes]);
  const edgeById = useMemo(() => new Map(graph.edges.map((edge) => [edge.id, edge] as const)), [graph.edges]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const nodeParam = params.get("provenanceNode");
    const edgeParam = params.get("provenanceEdge");
    if (nodeParam && nodeById.has(nodeParam)) {
      setSelectedNodeId(nodeParam);
    }
    if (edgeParam && edgeById.has(edgeParam)) {
      setSelectedEdgeId(edgeParam);
    }
  }, [edgeById, nodeById]);

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

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    params.set("provenanceNode", selectedNodeId);
    if (selectedEdgeId) {
      params.set("provenanceEdge", selectedEdgeId);
    } else {
      params.delete("provenanceEdge");
    }

    const nextUrl = `${window.location.pathname}?${params.toString()}${window.location.hash}`;
    window.history.replaceState(null, "", nextUrl);
  }, [selectedEdgeId, selectedNodeId]);

  const selectedNode = nodeById.get(selectedNodeId) ?? nodeById.get(graph.rootId) ?? graph.nodes[0] ?? null;
  const selectedEdge = selectedEdgeId ? edgeById.get(selectedEdgeId) ?? null : null;

  const sourceRows = useMemo(
    () => Object.entries(graph.summary.sourceCounts).sort((a, b) => b[1] - a[1]),
    [graph.summary.sourceCounts],
  );
  const recentSnapshots = useMemo(() => [...scene.snapshots].slice(-5).reverse(), [scene.snapshots]);
  const recentChangeEntries = useMemo(() => [...scene.changeLog].slice(-8).reverse(), [scene.changeLog]);
  const filteredOperationalEvidenceEvents = useMemo(
    () => filterOperationalEvidenceEvents(operationalEvidenceEvents, evidenceQuery, {
      lifecycleStage: evidenceStageFilter,
      branchLabel: evidenceBranchFilter,
    }),
    [evidenceBranchFilter, evidenceQuery, evidenceStageFilter, operationalEvidenceEvents],
  );
  const recentEvidenceEvents = useMemo(
    () => [...filteredOperationalEvidenceEvents].slice(-6).reverse(),
    [filteredOperationalEvidenceEvents],
  );
  const recentSensorEvents = useMemo(
    () => [...sensorEvents].slice(-5).reverse(),
    [sensorEvents],
  );
  const recentCameraMetadataEvents = useMemo(
    () => [...cameraMetadataEvents].slice(-5).reverse(),
    [cameraMetadataEvents],
  );
  const recentCameraLiveConnectionEvents = useMemo(
    () => [...cameraLiveConnectionEvents].slice(-5).reverse(),
    [cameraLiveConnectionEvents],
  );
  const sensorEventCounts = useMemo(() => sensorEvents.reduce<Record<"triggered" | "heartbeat" | "faulted" | "restored", number>>((acc, event) => {
    acc[event.kind] += 1;
    return acc;
  }, {
    triggered: 0,
    heartbeat: 0,
    faulted: 0,
    restored: 0,
  }), [sensorEvents]);
  const cameraMetadataCounts = useMemo(() => cameraMetadataEvents.reduce<Record<"external" | "paste", number>>((acc, event) => {
    acc[event.ingestMode] += 1;
    return acc;
  }, {
    external: 0,
    paste: 0,
  }), [cameraMetadataEvents]);
  const cameraLiveConnectionCounts = useMemo(() => cameraLiveConnectionEvents.reduce<Record<"external" | "manual", number>>((acc, event) => {
    acc[event.ingestMode] += 1;
    return acc;
  }, {
    external: 0,
    manual: 0,
  }), [cameraLiveConnectionEvents]);
  const checkpointEvents = useMemo(
    () => getOperationalEvidenceCheckpoints(filteredOperationalEvidenceEvents).slice(-4).reverse(),
    [filteredOperationalEvidenceEvents],
  );
  const evidenceKindCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const event of filteredOperationalEvidenceEvents) {
      counts.set(event.kind, (counts.get(event.kind) ?? 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [filteredOperationalEvidenceEvents]);
  const evidenceLifecycleSummary = useMemo(
    () => summarizeOperationalEvidenceLifecycle(operationalEvidenceEvents),
    [operationalEvidenceEvents],
  );
  const evidenceBranchHeads = useMemo(
    () => summarizeOperationalEvidenceBranchHeads(filteredOperationalEvidenceEvents),
    [filteredOperationalEvidenceEvents],
  );
  const selectedEvidenceEvent = useMemo(
    () => filteredOperationalEvidenceEvents.find((event) => event.id === selectedEvidenceEventId) ?? filteredOperationalEvidenceEvents.at(-1) ?? null,
    [filteredOperationalEvidenceEvents, selectedEvidenceEventId],
  );
  const selectedEvidenceLineage = useMemo(
    () => (selectedEvidenceEvent ? traceOperationalEvidenceLineage(filteredOperationalEvidenceEvents, selectedEvidenceEvent.id) : []),
    [filteredOperationalEvidenceEvents, selectedEvidenceEvent],
  );
  const selectedEvidenceReconstruction = useMemo(
    () => (selectedEvidenceEvent ? reconstructSceneFromEvidence(filteredOperationalEvidenceEvents, selectedEvidenceEvent.id) : null),
    [filteredOperationalEvidenceEvents, selectedEvidenceEvent],
  );
  const evidenceTimeline = useMemo(
    () => [...filteredOperationalEvidenceEvents].sort((a, b) => a.timestamp - b.timestamp),
    [filteredOperationalEvidenceEvents],
  );
  const selectedTimelineIndex = useMemo(() => {
    if (!selectedEvidenceEvent || evidenceTimeline.length === 0) return -1;
    return evidenceTimeline.findIndex((event) => event.id === selectedEvidenceEvent.id);
  }, [evidenceTimeline, selectedEvidenceEvent]);
  const selectedTimelineProgress = selectedTimelineIndex >= 0 && evidenceTimeline.length > 1
    ? selectedTimelineIndex / (evidenceTimeline.length - 1)
    : 0;
  const selectedEvidenceReconstructionSummary = useMemo(
    () => (selectedEvidenceReconstruction ? summarizeSceneEvidence(selectedEvidenceReconstruction) : null),
    [selectedEvidenceReconstruction],
  );
  const selectedEvidenceReconstructionCounts = useMemo(
    () => (selectedEvidenceReconstruction
      ? [
          { label: "Cameras", current: scene.cameras.length, value: selectedEvidenceReconstruction.cameras.length },
          { label: "Lights", current: scene.securityLights.length, value: selectedEvidenceReconstruction.securityLights.length },
          { label: "Obstructions", current: scene.obstructions.length, value: selectedEvidenceReconstruction.obstructions.length },
          { label: "Zones", current: scene.criticalZones.length + scene.privacyZones.length, value: selectedEvidenceReconstruction.criticalZones.length + selectedEvidenceReconstruction.privacyZones.length },
          { label: "Paths", current: scene.paths.length, value: selectedEvidenceReconstruction.paths.length },
          { label: "Sensors", current: scene.sensors.length, value: selectedEvidenceReconstruction.sensors.length },
          { label: "Snapshots", current: scene.snapshots.length, value: selectedEvidenceReconstruction.snapshots.length },
        ]
      : []),
    [scene, selectedEvidenceReconstruction],
  );
  const branchComparison = useMemo(
    () => {
      if (!comparisonLeftEventId || !comparisonRightEventId) return null;
      return compareOperationalEvidenceBranches(filteredOperationalEvidenceEvents, comparisonLeftEventId, comparisonRightEventId);
    },
    [comparisonLeftEventId, comparisonRightEventId, filteredOperationalEvidenceEvents],
  );
  const mergeReadiness = useMemo(
    () => assessOperationalEvidenceMergeReadiness(branchComparison),
    [branchComparison],
  );
  const lifecycleStageOrder: Array<OperationalEvidenceLifecycleStage> = ["draft", "review", "published", "recovered", "imported", "scanned", "simulated", "manual"];

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

  const handleRestoreCheckpoint = (eventId: string, targetBranch: "draft" | "recovered" | "published") => {
    restoreSceneFromEvidence(eventId, targetBranch);
  };

  const handleTimelineScrub = (index: number) => {
    const event = evidenceTimeline[index];
    if (!event) return;
    setSelectedEvidenceEventId(event.id);
  };

  const copyDeepLink = async () => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    params.set("provenanceNode", selectedNodeId);
    if (selectedEdgeId) {
      params.set("provenanceEdge", selectedEdgeId);
    } else {
      params.delete("provenanceEdge");
    }
    const deepLink = `${window.location.origin}${window.location.pathname}?${params.toString()}${window.location.hash}`;
    await navigator.clipboard.writeText(deepLink);
  };

  const showBranchHead = (stage: OperationalEvidenceLifecycleStage, branchLabel: string | undefined, eventId: string) => {
    setEvidenceStageFilter(stage);
    setEvidenceBranchFilter(branchLabel ?? "all");
    setSelectedEvidenceEventId(eventId);
  };

  const labelComparisonButton = (side: "left" | "right", eventId: string) => {
    if (side === "left") {
      setComparisonLeftEventId(eventId);
    } else {
      setComparisonRightEventId(eventId);
    }
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

        <div className="mt-2 rounded-lg border border-[#1c2130] bg-[#0f1320] px-3 py-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="text-[9px] font-semibold uppercase tracking-[0.14em] text-[#5f6a82]">Temporal replay</div>
              <div className="mt-1 text-[11px] text-[#aeb8cd]">Scrub the operational evidence trail and preview the scene at any reconstructable checkpoint.</div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={selectedEvidenceEvent ? "blue" : "gray"}>
                {selectedEvidenceEvent ? `${Math.max(selectedTimelineIndex, 0) + 1}/${Math.max(evidenceTimeline.length, 1)}` : "No checkpoint selected"}
              </Badge>
              <Badge variant="gray">{evidenceTimeline.length} timeline events</Badge>
            </div>
          </div>

          <div className="mt-3 rounded-md border border-[#1e2130] bg-[#0b0f17] px-3 py-2">
            <div className="flex items-center justify-between gap-2">
              <div className="text-[9px] font-semibold uppercase tracking-[0.14em] text-[#5f6a82]">Checkpoint scrubber</div>
              <div className="text-[9px] text-[#74809a]">
                {selectedEvidenceEvent ? formatLedgerTime(selectedEvidenceEvent.timestamp) : "No checkpoint"}
              </div>
            </div>
            <input
              type="range"
              min={0}
              max={Math.max(evidenceTimeline.length - 1, 0)}
              step={1}
              value={Math.max(selectedTimelineIndex, 0)}
              onChange={(event) => handleTimelineScrub(Number(event.target.value))}
              disabled={evidenceTimeline.length === 0}
              className="mt-2 w-full accent-sky-400 disabled:cursor-not-allowed disabled:opacity-40"
            />
            <div className="mt-2 flex flex-wrap items-center gap-2 text-[9px] text-[#74809a]">
              <span>Start</span>
              <div className="h-1 flex-1 rounded-full bg-[#1e2130]">
                <div className="h-1 rounded-full bg-sky-400" style={{ width: `${selectedTimelineProgress * 100}%` }} />
              </div>
              <span>Latest</span>
            </div>
          </div>

          {selectedEvidenceEvent ? (
            <div className="mt-3 grid gap-2 xl:grid-cols-[1.15fr_0.85fr]">
              <div className="rounded-md border border-[#1e2130] bg-[#0b0f17] px-3 py-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-[11px] font-semibold text-[#edf2fb]">{selectedEvidenceEvent.title}</div>
                  <Badge variant="gray">{formatLedgerTime(selectedEvidenceEvent.timestamp)}</Badge>
                </div>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  <Badge variant="blue">{selectedEvidenceEvent.kind.replace(/_/g, " ")}</Badge>
                  <Badge variant="gray">{selectedEvidenceEvent.actor}</Badge>
                  <Badge variant="gray">{confidenceLabel(selectedEvidenceEvent.confidence)}</Badge>
                  {selectedEvidenceEvent.branchLabel ? <Badge variant="gray">{selectedEvidenceEvent.branchLabel}</Badge> : null}
                  {selectedEvidenceEvent.affectedNodeIds.length > 0 ? <Badge variant="gray">{selectedEvidenceEvent.affectedNodeIds.length} nodes</Badge> : null}
                </div>
                <div className="mt-2 text-[10px] text-[#74809a]">{selectedEvidenceEvent.details}</div>
                <div className="mt-2 grid gap-2 md:grid-cols-3">
                  {[
                    { label: "Before", value: selectedEvidenceEvent.beforeSummary ?? "—" },
                    { label: "After", value: selectedEvidenceEvent.afterSummary ?? selectedEvidenceEvent.details },
                    { label: "Branch", value: selectedEvidenceEvent.branchLabel ?? selectedEvidenceEvent.lifecycleStage ?? "manual" },
                  ].map((item) => (
                    <div key={item.label} className="rounded-md border border-[#1e2130] bg-[#0f1320] px-3 py-2">
                      <div className="text-[8px] font-semibold uppercase tracking-[0.16em] text-[#5f6a82]">{item.label}</div>
                      <div className="mt-1 text-[10px] leading-relaxed text-[#cfd7e7]">{item.value}</div>
                    </div>
                  ))}
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => handleRestoreCheckpoint(selectedEvidenceEvent.id, "draft")}
                    className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[10px] font-medium text-white hover:bg-white/[0.08]"
                  >
                    Restore as draft
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRestoreCheckpoint(selectedEvidenceEvent.id, "recovered")}
                    className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[10px] font-medium text-white hover:bg-white/[0.08]"
                  >
                    Restore as recovered
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRestoreCheckpoint(selectedEvidenceEvent.id, "published")}
                    className="rounded-full border border-emerald-400/20 bg-emerald-500/10 px-3 py-1.5 text-[10px] font-medium text-emerald-100 hover:bg-emerald-500/15"
                  >
                    Restore as published
                  </button>
                </div>
              </div>

              <div className="rounded-md border border-[#1e2130] bg-[#0b0f17] px-3 py-2">
                <div className="text-[9px] font-semibold uppercase tracking-[0.14em] text-[#5f6a82]">Point-in-time reconstruction</div>
                <div className="mt-1 text-[10px] text-[#74809a]">Compare the reconstructed scene against the current working scene without mutating the current state.</div>
                {selectedEvidenceReconstruction ? (
                  <>
                    <div className="mt-2 text-[11px] font-semibold text-[#edf2fb]">{selectedEvidenceReconstructionSummary?.label ?? "Reconstructed scene"}</div>
                    <div className="mt-1 text-[10px] text-[#74809a]">{selectedEvidenceReconstructionSummary?.detail ?? "A reconstructed scene snapshot is available for this checkpoint."}</div>
                    <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                      {selectedEvidenceReconstructionCounts.map((item) => (
                        <div key={item.label} className="rounded-md border border-[#1e2130] bg-[#0f1320] px-3 py-2">
                          <div className="text-[8px] font-semibold uppercase tracking-[0.16em] text-[#5f6a82]">{item.label}</div>
                          <div className="mt-1 text-[14px] font-semibold text-[#edf2fb]">{item.current} → {item.value}</div>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <div className="mt-3 rounded-md border border-dashed border-[#243048] bg-[#0b0f17] px-3 py-3 text-[10px] text-[#74809a]">
                    This checkpoint does not reconstruct a complete scene snapshot yet.
                  </div>
                )}
              </div>
            </div>
          ) : null}
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
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={copyDeepLink}
                      className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[11px] font-medium hover:bg-white/[0.08]"
                    >
                      Copy deep link
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedEdgeId(null);
                        setSelectedNodeId(graph.rootId);
                      }}
                      className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[11px] font-medium hover:bg-white/[0.08]"
                    >
                      Reset trace
                    </button>
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
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => publishCurrentScene()}
                  className="rounded-full border border-emerald-400/20 bg-emerald-500/10 px-3 py-1.5 text-[11px] font-medium text-emerald-100 hover:bg-emerald-500/15"
                >
                  Publish current scene
                </button>
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

        <div className="mt-2 rounded-lg border border-[#1c2130] bg-[#0f1320] px-3 py-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="text-[9px] font-semibold uppercase tracking-[0.14em] text-[#5f6a82]">Evidence ledger</div>
              <div className="mt-1 text-[11px] text-[#aeb8cd]">Recent snapshots, scene change-log entries, and operational memory events show how the twin evolved over time.</div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="gray">{recentSnapshots.length + recentChangeEntries.length + recentEvidenceEvents.length} visible entries</Badge>
              <Badge variant="blue">Append-only journal</Badge>
            </div>
          </div>

          <div className="mt-3 rounded-md border border-[#1e2130] bg-[#0b0f17] px-3 py-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="text-[9px] font-semibold uppercase tracking-[0.14em] text-[#5f6a82]">Sensor live evidence</div>
                <div className="mt-1 text-[10px] text-[#74809a]">Sensor triggers, heartbeats, faults, and restores are recorded alongside scene provenance.</div>
              </div>
              <Badge variant={sensorEvents.length > 0 ? "blue" : "gray"}>{sensorEvents.length} events</Badge>
            </div>
            <div className="mt-2 grid gap-2 md:grid-cols-4">
              <Badge variant="gray">Trigger {sensorEventCounts.triggered}</Badge>
              <Badge variant="gray">Heartbeat {sensorEventCounts.heartbeat}</Badge>
              <Badge variant="gray">Fault {sensorEventCounts.faulted}</Badge>
              <Badge variant="gray">Restore {sensorEventCounts.restored}</Badge>
            </div>
            <div className="mt-3 space-y-1.5">
              {recentSensorEvents.length > 0 ? (
                recentSensorEvents.map((event) => (
                  <div key={event.id} className="rounded-md border border-[#1e2130] bg-[#0f1320] px-3 py-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="text-[11px] font-semibold text-[#edf2ff]">{event.sensorLabel}</div>
                      <Badge variant={event.kind === "faulted" ? "red" : event.kind === "restored" ? "green" : event.kind === "triggered" ? "blue" : "gray"}>{event.kind}</Badge>
                    </div>
                    <div className="mt-1 text-[9px] text-[#74809a]">
                      {event.details} {event.nearestCameraName ? `Nearest camera: ${event.nearestCameraName}.` : "No nearby camera recorded."}
                    </div>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      <Badge variant="gray">{new Date(event.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</Badge>
                      <Badge variant="gray">{event.resultingState ?? "—"}</Badge>
                      <Badge variant="gray">{event.nearestDistanceM == null ? "—" : `${event.nearestDistanceM.toFixed(1)}m`}</Badge>
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-md border border-dashed border-[#243048] bg-[#0b0f17] px-3 py-3 text-[10px] text-[#74809a]">
                  No sensor evidence yet. Use the Sensors panel or paste live metadata to create the first event.
                </div>
              )}
            </div>
          </div>

          <div className="mt-3 rounded-md border border-[#1e2130] bg-[#0b0f17] px-3 py-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="text-[9px] font-semibold uppercase tracking-[0.14em] text-[#5f6a82]">Camera metadata evidence</div>
                <div className="mt-1 text-[10px] text-[#74809a]">Camera metadata ingest events keep the live-camera health state visible in the same evidence trail.</div>
              </div>
              <Badge variant={cameraMetadataEvents.length > 0 ? "green" : "gray"}>{cameraMetadataEvents.length} events</Badge>
            </div>
            <div className="mt-2 grid gap-2 md:grid-cols-2">
              <Badge variant="gray">Paste {cameraMetadataCounts.paste}</Badge>
              <Badge variant="gray">External {cameraMetadataCounts.external}</Badge>
            </div>
            <div className="mt-3 space-y-1.5">
              {recentCameraMetadataEvents.length > 0 ? (
                recentCameraMetadataEvents.map((event) => (
                  <div key={event.id} className="rounded-md border border-[#1e2130] bg-[#0f1320] px-3 py-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="text-[11px] font-semibold text-[#edf2ff]">{event.cameraName}</div>
                      <Badge variant={event.ingestMode === "external" ? "green" : "blue"}>{event.ingestMode}</Badge>
                    </div>
                    <div className="mt-1 text-[9px] text-[#74809a]">
                      {event.summary}
                    </div>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      <Badge variant="gray">{event.status ?? "—"}</Badge>
                      <Badge variant="gray">{event.clarity ?? "—"}</Badge>
                      <Badge variant="gray">{event.nightMode ?? "—"}</Badge>
                      <Badge variant="gray">{event.feedMode ?? "—"}</Badge>
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-md border border-dashed border-[#243048] bg-[#0b0f17] px-3 py-3 text-[10px] text-[#74809a]">
                  No camera metadata evidence yet. Use the camera inspector to archive metadata and surface it here.
                </div>
              )}
            </div>
          </div>

          <div className="mt-3 rounded-md border border-[#1e2130] bg-[#0b0f17] px-3 py-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="text-[9px] font-semibold uppercase tracking-[0.14em] text-[#5f6a82]">Live camera binding evidence</div>
                <div className="mt-1 text-[10px] text-[#74809a]">Live feed bindings, relay URLs, and disconnects are written into the same evidence trail as the camera metadata events.</div>
              </div>
              <Badge variant={cameraLiveConnectionEvents.length > 0 ? "blue" : "gray"}>{cameraLiveConnectionEvents.length} events</Badge>
            </div>
            <div className="mt-2 grid gap-2 md:grid-cols-2">
              <Badge variant="gray">External {cameraLiveConnectionCounts.external}</Badge>
              <Badge variant="gray">Manual {cameraLiveConnectionCounts.manual}</Badge>
            </div>
            <div className="mt-3 space-y-1.5">
              {recentCameraLiveConnectionEvents.length > 0 ? (
                recentCameraLiveConnectionEvents.map((event) => (
                  <div key={event.id} className="rounded-md border border-[#1e2130] bg-[#0f1320] px-3 py-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="text-[11px] font-semibold text-[#edf2ff]">{event.cameraName}</div>
                      <Badge variant={event.liveConnectionStatus === "connected" ? "green" : event.liveConnectionStatus === "connecting" ? "blue" : event.liveConnectionStatus === "error" ? "red" : "gray"}>
                        {event.liveConnectionStatus ?? "disconnected"}
                      </Badge>
                    </div>
                    <div className="mt-1 text-[9px] text-[#74809a]">
                      {event.summary}
                    </div>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      <Badge variant="gray">{event.liveConnectionMode ?? "—"}</Badge>
                      <Badge variant="gray">{event.liveFeedLabel ?? event.liveFeedUrl ?? "—"}</Badge>
                      <Badge variant="gray">{new Date(event.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</Badge>
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-md border border-dashed border-[#243048] bg-[#0b0f17] px-3 py-3 text-[10px] text-[#74809a]">
                  No live camera binding evidence yet. Use the camera inspector to bind a live feed and surface it here.
                </div>
              )}
            </div>
          </div>

          <div className="mt-3 rounded-md border border-[#1e2130] bg-[#0b0f17] px-3 py-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="text-[9px] font-semibold uppercase tracking-[0.14em] text-[#5f6a82]">Search evidence</div>
                <div className="mt-1 text-[10px] text-[#74809a]">Filter the ledger by event type, scene name, node id, or note text.</div>
              </div>
              <Badge variant={evidenceQuery.trim() ? "blue" : "gray"}>
                {evidenceQuery.trim() ? `${filteredOperationalEvidenceEvents.length} matches` : `${operationalEvidenceEvents.length} total`}
              </Badge>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <input
                type="search"
                value={evidenceQuery}
                onChange={(event) => setEvidenceQuery(event.target.value)}
                placeholder="Search evidence, checkpoints, or notes"
                className="min-w-0 flex-1 rounded-md border border-[#1e2130] bg-[#0f1320] px-3 py-2 text-[11px] text-[#edf2ff] outline-none placeholder:text-[#74809a] focus:border-sky-400/40"
              />
                    <button
                      type="button"
                      onClick={() => {
                        setEvidenceQuery("");
                        setEvidenceStageFilter("all");
                        setEvidenceBranchFilter("all");
                        setSelectedEvidenceEventId(null);
                      }}
                      className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-2 text-[11px] font-medium hover:bg-white/[0.08]"
                    >
                      Clear filters
              </button>
            </div>
            <div className="mt-3 grid gap-2 md:grid-cols-2">
              <div className="rounded-md border border-[#1e2130] bg-[#0f1320] px-3 py-2">
                <div className="text-[9px] font-semibold uppercase tracking-[0.14em] text-[#5f6a82]">Lifecycle stage</div>
                <div className="mt-2 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setEvidenceStageFilter("all")}
                    className={[
                      "rounded-full border px-2.5 py-1 text-[10px] font-medium",
                      evidenceStageFilter === "all"
                        ? "border-sky-400/40 bg-sky-500/15 text-sky-100"
                        : "border-white/10 bg-white/[0.03] text-[#9bb0cf] hover:bg-white/[0.06]",
                    ].join(" ")}
                  >
                    All stages
                  </button>
                  {lifecycleStageOrder.map((stage) => {
                    const count = evidenceLifecycleSummary.counts[stage];
                    return (
                      <button
                        key={stage}
                        type="button"
                        onClick={() => setEvidenceStageFilter(stage)}
                        className={[
                          "rounded-full border px-2.5 py-1 text-[10px] font-medium capitalize",
                          evidenceStageFilter === stage
                            ? "border-emerald-400/40 bg-emerald-500/15 text-emerald-100"
                            : "border-white/10 bg-white/[0.03] text-[#9bb0cf] hover:bg-white/[0.06]",
                        ].join(" ")}
                      >
                        {stage} · {count}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="rounded-md border border-[#1e2130] bg-[#0f1320] px-3 py-2">
                <div className="text-[9px] font-semibold uppercase tracking-[0.14em] text-[#5f6a82]">Branch filter</div>
                <div className="mt-2 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setEvidenceBranchFilter("all")}
                    className={[
                      "rounded-full border px-2.5 py-1 text-[10px] font-medium",
                      evidenceBranchFilter === "all"
                        ? "border-sky-400/40 bg-sky-500/15 text-sky-100"
                        : "border-white/10 bg-white/[0.03] text-[#9bb0cf] hover:bg-white/[0.06]",
                    ].join(" ")}
                  >
                    All branches
                  </button>
                  {evidenceLifecycleSummary.branchCounts.length > 0 ? (
                    evidenceLifecycleSummary.branchCounts.map(([branch, count]) => (
                      <button
                        key={branch}
                        type="button"
                        onClick={() => setEvidenceBranchFilter(branch)}
                        className={[
                          "rounded-full border px-2.5 py-1 text-[10px] font-medium capitalize",
                          evidenceBranchFilter === branch
                            ? "border-amber-400/40 bg-amber-500/15 text-amber-100"
                            : "border-white/10 bg-white/[0.03] text-[#9bb0cf] hover:bg-white/[0.06]",
                        ].join(" ")}
                      >
                        {branch} · {count}
                      </button>
                    ))
                  ) : (
                    <div className="text-[10px] text-[#74809a]">No branch metadata yet.</div>
                  )}
                </div>
                </div>
              </div>
            </div>

            <div className="mt-3 rounded-md border border-[#1e2130] bg-[#0f1320] px-3 py-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="text-[9px] font-semibold uppercase tracking-[0.14em] text-[#5f6a82]">Branch heads</div>
                  <div className="mt-1 text-[10px] text-[#74809a]">Latest visible checkpoint for each lifecycle branch.</div>
                </div>
                <Badge variant="gray">{filteredOperationalEvidenceEvents.length} filtered events</Badge>
              </div>
              <div className="mt-2 grid gap-2 md:grid-cols-2 xl:grid-cols-4">
                {evidenceBranchHeads.map(({ stage, event }) => (
                  <div key={stage} className="rounded-md border border-[#1e2130] bg-[#0b0f17] px-3 py-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-[8px] font-semibold uppercase tracking-[0.16em] text-[#5f6a82]">{stage}</div>
                      <Badge variant={event ? "blue" : "gray"}>{event ? "head" : "empty"}</Badge>
                    </div>
                    <div className="mt-1 text-[11px] font-semibold text-[#edf2ff]">{event?.title ?? "No event yet"}</div>
                    <div className="mt-1 text-[9px] text-[#74809a]">{event ? event.branchLabel ?? stage : "No branch metadata visible for this stage."}</div>
                    {event ? (
                      <button
                        type="button"
                        onClick={() => showBranchHead(stage, event.branchLabel, event.id)}
                        className="mt-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[10px] font-medium text-white hover:bg-white/[0.08]"
                      >
                        Preview lineage
                      </button>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-3 rounded-md border border-[#1e2130] bg-[#0b0f17] px-3 py-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="text-[9px] font-semibold uppercase tracking-[0.14em] text-[#5f6a82]">Branch lineage</div>
                  <div className="mt-1 text-[10px] text-[#74809a]">Trace a selected branch head back through its parent checkpoints.</div>
                </div>
                <Badge variant={selectedEvidenceLineage.length > 0 ? "blue" : "gray"}>
                  {selectedEvidenceLineage.length > 0 ? `${selectedEvidenceLineage.length} steps` : "No lineage selected"}
                </Badge>
              </div>
              <div className="mt-2">
                {selectedEvidenceEvent ? (
                  <div className="rounded-md border border-[#1e2130] bg-[#0f1320] px-3 py-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="text-[11px] font-semibold text-[#edf2ff]">{selectedEvidenceEvent.title}</div>
                      <Badge variant="gray">{formatLedgerTime(selectedEvidenceEvent.timestamp)}</Badge>
                    </div>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      <Badge variant="blue">{selectedEvidenceEvent.lifecycleStage ?? "manual"}</Badge>
                      {selectedEvidenceEvent.branchLabel ? <Badge variant="gray">{selectedEvidenceEvent.branchLabel}</Badge> : null}
                      {selectedEvidenceEvent.affectedNodeIds.length > 0 ? <Badge variant="gray">{selectedEvidenceEvent.affectedNodeIds.length} nodes</Badge> : null}
                      {selectedEvidenceEvent.sceneSnapshot ? <Badge variant="green">Snapshot available</Badge> : <Badge variant="gray">No snapshot</Badge>}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => labelComparisonButton("left", selectedEvidenceEvent.id)}
                        className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[10px] font-medium text-white hover:bg-white/[0.08]"
                      >
                        Set as left branch
                      </button>
                      <button
                        type="button"
                        onClick={() => labelComparisonButton("right", selectedEvidenceEvent.id)}
                        className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[10px] font-medium text-white hover:bg-white/[0.08]"
                      >
                        Set as right branch
                      </button>
                    </div>
                    <div className="mt-2 space-y-1.5">
                      {selectedEvidenceLineage.length > 0 ? (
                        selectedEvidenceLineage.map((step) => (
                          <div key={step.event.id} className="rounded-md border border-[#1e2130] bg-[#0b0f17] px-3 py-2">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#74809a]">
                                Step {step.depth + 1}
                              </div>
                              <Badge variant={step.event.sceneSnapshot ? "green" : "gray"}>
                                {step.event.sceneSnapshot ? "point-in-time" : "derived"}
                              </Badge>
                            </div>
                            <div className="mt-1 text-[11px] font-semibold text-[#edf2ff]">{step.event.title}</div>
                            <div className="mt-1 flex flex-wrap gap-1.5">
                              <Badge variant="gray">{step.event.kind.replace(/_/g, " ")}</Badge>
                              <Badge variant="gray">{step.event.branchLabel ?? step.event.lifecycleStage ?? "manual"}</Badge>
                              {step.event.affectedNodeIds.length > 0 ? <Badge variant="gray">{step.event.affectedNodeIds.length} nodes</Badge> : null}
                            </div>
                            <div className="mt-1 text-[9px] text-[#8aa1c4]">{step.event.beforeSummary ? `Before: ${step.event.beforeSummary}` : "No before summary available."}</div>
                            <div className="mt-0.5 text-[9px] text-[#8aa1c4]">{step.event.afterSummary ? `After: ${step.event.afterSummary}` : step.event.details}</div>
                          </div>
                        ))
                      ) : (
                        <div className="rounded-md border border-dashed border-[#243048] bg-[#0b0f17] px-3 py-3 text-[10px] text-[#74809a]">
                          Select a branch head to preview its parent chain and point-in-time reconstruction.
                        </div>
                      )}
                    </div>
                    {selectedEvidenceReconstruction ? (
                      <div className="mt-3 rounded-md border border-[#1e2130] bg-[#0b0f17] px-3 py-2">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <div className="text-[9px] font-semibold uppercase tracking-[0.14em] text-[#5f6a82]">Point-in-time reconstruction</div>
                            <div className="mt-1 text-[10px] text-[#74809a]">Reconstruct the scene state at this checkpoint without committing it yet.</div>
                          </div>
                          <Badge variant="green">Preview only</Badge>
                        </div>
                        <div className="mt-2 text-[11px] font-semibold text-[#edf2ff]">{selectedEvidenceReconstructionSummary?.label ?? "Reconstructed scene"}</div>
                        <div className="mt-1 text-[10px] text-[#74809a]">{selectedEvidenceReconstructionSummary?.detail ?? "A reconstructed scene snapshot is available for this event."}</div>
                        <div className="mt-2 grid gap-2 sm:grid-cols-3 xl:grid-cols-4">
                          {selectedEvidenceReconstructionCounts.map((item) => (
                            <div key={item.label} className="rounded-md border border-[#1e2130] bg-[#0f1320] px-3 py-2">
                              <div className="text-[8px] font-semibold uppercase tracking-[0.16em] text-[#5f6a82]">{item.label}</div>
                              <div className="mt-1 text-[14px] font-semibold text-[#edf2ff]">{item.current} → {item.value}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <div className="rounded-md border border-dashed border-[#243048] bg-[#0b0f17] px-3 py-3 text-[10px] text-[#74809a]">
                    No branch lineage selected.
                  </div>
                )}
              </div>
            </div>

            <div className="mt-3 rounded-md border border-[#1e2130] bg-[#0b0f17] px-3 py-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="text-[9px] font-semibold uppercase tracking-[0.14em] text-[#5f6a82]">Branch comparison</div>
                  <div className="mt-1 text-[10px] text-[#74809a]">Compare two branch heads to preview their common ancestor and divergence before any merge or publish action.</div>
                </div>
                <Badge variant={branchComparison ? "blue" : "gray"}>
                  {branchComparison ? "Comparison ready" : "Select two branch heads"}
                </Badge>
              </div>
            {branchComparison ? (
                <div className="mt-2 grid gap-2 xl:grid-cols-3">
                  <div className="rounded-md border border-[#1e2130] bg-[#0f1320] px-3 py-2">
                    <div className="text-[9px] font-semibold uppercase tracking-[0.14em] text-[#5f6a82]">Left branch</div>
                    <div className="mt-1 text-[11px] font-semibold text-[#edf2ff]">{branchComparison.left.event.title}</div>
                    <div className="mt-1 text-[10px] text-[#74809a]">{branchComparison.leftSceneSummary?.detail ?? "No scene summary available."}</div>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <Badge variant="gray">{branchComparison.left.event.branchLabel ?? branchComparison.left.event.lifecycleStage ?? "manual"}</Badge>
                      {branchComparison.left.event.sceneSnapshot ? <Badge variant="green">Snapshot</Badge> : <Badge variant="gray">Derived</Badge>}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => restoreSceneFromEvidence(branchComparison.left.event.id, "draft")}
                        className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[10px] font-medium text-white hover:bg-white/[0.08]"
                      >
                        Restore left as draft
                      </button>
                      <button
                        type="button"
                        onClick={() => restoreSceneFromEvidence(branchComparison.left.event.id, "recovered")}
                        className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[10px] font-medium text-white hover:bg-white/[0.08]"
                      >
                        Restore left as recovered
                      </button>
                      <button
                        type="button"
                        onClick={() => restoreSceneFromEvidence(branchComparison.left.event.id, "published")}
                        className="rounded-full border border-emerald-400/20 bg-emerald-500/10 px-3 py-1.5 text-[10px] font-medium text-emerald-100 hover:bg-emerald-500/15"
                      >
                        Restore left as published
                      </button>
                    </div>
                  </div>
                  <div className="rounded-md border border-[#1e2130] bg-[#0f1320] px-3 py-2">
                    <div className="text-[9px] font-semibold uppercase tracking-[0.14em] text-[#5f6a82]">Common ancestor</div>
                    <div className="mt-1 text-[11px] font-semibold text-[#edf2ff]">{branchComparison.commonAncestor?.event.title ?? "No shared ancestor"}</div>
                    <div className="mt-1 text-[10px] text-[#74809a]">{branchComparison.ancestorSummary?.detail ?? "The branches diverged before a reconstructable checkpoint."}</div>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {branchComparison.commonAncestor ? <Badge variant="blue">Lineage depth {branchComparison.commonAncestor.depth + 1}</Badge> : <Badge variant="gray">No common head</Badge>}
                      {branchComparison.ancestorScene ? <Badge variant="green">Point-in-time scene</Badge> : <Badge variant="gray">No ancestor snapshot</Badge>}
                    </div>
                  </div>
                  <div className="rounded-md border border-[#1e2130] bg-[#0f1320] px-3 py-2">
                    <div className="text-[9px] font-semibold uppercase tracking-[0.14em] text-[#5f6a82]">Right branch</div>
                    <div className="mt-1 text-[11px] font-semibold text-[#edf2ff]">{branchComparison.right.event.title}</div>
                    <div className="mt-1 text-[10px] text-[#74809a]">{branchComparison.rightSceneSummary?.detail ?? "No scene summary available."}</div>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <Badge variant="gray">{branchComparison.right.event.branchLabel ?? branchComparison.right.event.lifecycleStage ?? "manual"}</Badge>
                      {branchComparison.right.event.sceneSnapshot ? <Badge variant="green">Snapshot</Badge> : <Badge variant="gray">Derived</Badge>}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => restoreSceneFromEvidence(branchComparison.right.event.id, "draft")}
                        className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[10px] font-medium text-white hover:bg-white/[0.08]"
                      >
                        Restore right as draft
                      </button>
                      <button
                        type="button"
                        onClick={() => restoreSceneFromEvidence(branchComparison.right.event.id, "recovered")}
                        className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[10px] font-medium text-white hover:bg-white/[0.08]"
                      >
                        Restore right as recovered
                      </button>
                      <button
                        type="button"
                        onClick={() => restoreSceneFromEvidence(branchComparison.right.event.id, "published")}
                        className="rounded-full border border-emerald-400/20 bg-emerald-500/10 px-3 py-1.5 text-[10px] font-medium text-emerald-100 hover:bg-emerald-500/15"
                      >
                        Restore right as published
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="mt-2 rounded-md border border-dashed border-[#243048] bg-[#0b0f17] px-3 py-3 text-[10px] text-[#74809a]">
                  Use <span className="font-medium text-[#c9d5e9]">Set as left branch</span> and <span className="font-medium text-[#c9d5e9]">Set as right branch</span> on two lineage checkpoints to preview divergence.
                </div>
              )}
              {mergeReadiness ? (
                <div className="mt-2 rounded-md border border-[#1e2130] bg-[#0f1320] px-3 py-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <div className="text-[9px] font-semibold uppercase tracking-[0.14em] text-[#5f6a82]">Merge readiness</div>
                      <div className="mt-1 text-[10px] text-[#74809a]">A branch-policy preview for the selected heads before any future merge semantics land.</div>
                    </div>
                    <Badge variant={mergeReadiness.status === "diverged" ? "amber" : mergeReadiness.status === "unrelated" ? "gray" : "green"}>
                      {mergeReadiness.status.replace(/_/g, " ")}
                    </Badge>
                  </div>
                  <div className="mt-2 text-[11px] text-[#e5ecfb]">{mergeReadiness.recommendation}</div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {mergeReadiness.leftDistance != null ? <Badge variant="gray">Left distance {mergeReadiness.leftDistance}</Badge> : null}
                    {mergeReadiness.rightDistance != null ? <Badge variant="gray">Right distance {mergeReadiness.rightDistance}</Badge> : null}
                    {mergeReadiness.commonAncestor ? <Badge variant="blue">Ancestor {mergeReadiness.commonAncestor.event.title}</Badge> : <Badge variant="gray">No common ancestor</Badge>}
                  </div>
                </div>
              ) : null}
              {branchComparison ? (
                <div className="mt-2 grid gap-2 md:grid-cols-3 xl:grid-cols-6">
                  {[
                    { label: "Cameras", value: branchComparison.delta.cameras },
                    { label: "Lights", value: branchComparison.delta.lights },
                    { label: "Obstructions", value: branchComparison.delta.obstructions },
                    { label: "Zones", value: branchComparison.delta.zones },
                    { label: "Paths", value: branchComparison.delta.paths },
                    { label: "Sensors", value: branchComparison.delta.sensors },
                  ].map((item) => (
                    <div key={item.label} className="rounded-md border border-[#1e2130] bg-[#0b0f17] px-3 py-2">
                      <div className="text-[8px] font-semibold uppercase tracking-[0.16em] text-[#5f6a82]">{item.label}</div>
                      <div className="mt-1 text-[14px] font-semibold text-[#edf2ff]">{item.value >= 0 ? `+${item.value}` : item.value}</div>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>

          <div className="mt-3 rounded-md border border-[#1e2130] bg-[#0b0f17] px-3 py-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="text-[9px] font-semibold uppercase tracking-[0.14em] text-[#5f6a82]">Event kinds</div>
                <div className="mt-1 text-[10px] text-[#74809a]">Event types currently visible after search and ledger filters.</div>
              </div>
              <Badge variant="blue">{filteredOperationalEvidenceEvents.length} visible events</Badge>
            </div>
            <div className="mt-3 grid gap-2 md:grid-cols-3 xl:grid-cols-7">
              {(Object.entries(evidenceLifecycleSummary.counts) as Array<[keyof typeof evidenceLifecycleSummary.counts, number]>).map(([stage, count]) => (
                <div key={stage} className="rounded-md border border-[#1e2130] bg-[#0f1320] px-3 py-2">
                  <div className="text-[8px] font-semibold uppercase tracking-[0.16em] text-[#5f6a82]">{stage}</div>
                  <div className="mt-1 text-[14px] font-semibold text-[#edf2ff]">{count}</div>
                </div>
              ))}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {evidenceKindCounts.length > 0 ? (
                evidenceKindCounts.map(([kind, count]) => (
                  <Badge key={kind} variant="gray">
                    {kind.replace(/_/g, " ")} · {count}
                  </Badge>
                ))
              ) : (
                <div className="text-[10px] text-[#74809a]">No event kinds yet.</div>
              )}
            </div>
          </div>

          <div className="mt-3 grid gap-2 xl:grid-cols-4">
            <div className="rounded-md border border-[#1e2130] bg-[#0b0f17] px-3 py-2">
              <div className="text-[9px] font-semibold uppercase tracking-[0.14em] text-[#5f6a82]">Operational memory</div>
              <div className="mt-2 space-y-2">
                {recentEvidenceEvents.length > 0 ? (
                  recentEvidenceEvents.map((event) => (
                    <div key={event.id} className="rounded-md border border-[#1e2130] bg-[#0f1320] px-3 py-2">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="text-[11px] font-semibold text-[#edf2ff]">{event.title}</div>
                        <Badge variant="gray">{formatLedgerTime(event.timestamp)}</Badge>
                      </div>
                      <div className="mt-1 flex flex-wrap gap-1.5">
                        <Badge variant="blue">{event.kind.replace(/_/g, " ")}</Badge>
                        <Badge variant="gray">{event.actor}</Badge>
                        <Badge variant="gray">{confidenceLabel(event.confidence)}</Badge>
                        {event.affectedNodeIds.length > 0 ? <Badge variant="gray">{event.affectedNodeIds.length} nodes</Badge> : null}
                        {event.branchLabel ? <Badge variant="gray">{event.branchLabel}</Badge> : null}
                      </div>
                      <div className="mt-1 text-[10px] text-[#74809a]">{event.details}</div>
                      {event.beforeSummary ? (
                        <div className="mt-1 text-[9px] text-[#8aa1c4]">
                          <span className="font-medium text-[#c9d5e9]">Before:</span> {event.beforeSummary}
                        </div>
                      ) : null}
                      {event.afterSummary ? (
                        <div className="mt-0.5 text-[9px] text-[#8aa1c4]">
                          <span className="font-medium text-[#c9d5e9]">After:</span> {event.afterSummary}
                        </div>
                      ) : null}
                      <div className="mt-2 flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => setSelectedEvidenceEventId(event.id)}
                          className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[10px] font-medium text-white hover:bg-white/[0.08]"
                        >
                          Preview lineage
                        </button>
                        {event.sceneSnapshot ? (
                          <>
                            <button
                              type="button"
                              onClick={() => handleRestoreCheckpoint(event.id, "draft")}
                              className="rounded-full border border-emerald-400/20 bg-emerald-500/10 px-3 py-1.5 text-[10px] font-medium text-emerald-100 hover:bg-emerald-500/15"
                            >
                              Restore as draft
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRestoreCheckpoint(event.id, "recovered")}
                              className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[10px] font-medium text-white hover:bg-white/[0.08]"
                            >
                              Restore as recovered
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRestoreCheckpoint(event.id, "published")}
                              className="rounded-full border border-sky-400/20 bg-sky-500/10 px-3 py-1.5 text-[10px] font-medium text-sky-100 hover:bg-sky-500/15"
                            >
                              Restore as published
                            </button>
                          </>
                        ) : null}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="rounded-md border border-dashed border-[#243048] bg-[#0b0f17] px-3 py-3 text-[10px] text-[#74809a]">
                    {evidenceQuery.trim() ? "No matching operational evidence." : "No operational evidence yet."}
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-md border border-[#1e2130] bg-[#0b0f17] px-3 py-2">
              <div className="text-[9px] font-semibold uppercase tracking-[0.14em] text-[#5f6a82]">Point-in-time checkpoints</div>
              <div className="mt-2 space-y-2">
                {checkpointEvents.length > 0 ? (
                  checkpointEvents.map((event) => (
                    <div key={event.id} className="rounded-md border border-[#1e2130] bg-[#0f1320] px-3 py-2">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="text-[11px] font-semibold text-[#edf2ff]">{event.title}</div>
                        <Badge variant="gray">{formatLedgerTime(event.timestamp)}</Badge>
                      </div>
                      <div className="mt-1 flex flex-wrap gap-1.5">
                        <Badge variant="blue">checkpoint</Badge>
                        <Badge variant="gray">{confidenceLabel(event.confidence)}</Badge>
                        {event.affectedNodeIds.length > 0 ? <Badge variant="gray">{event.affectedNodeIds.length} nodes</Badge> : null}
                        {event.branchLabel ? <Badge variant="gray">{event.branchLabel}</Badge> : null}
                      </div>
                      {event.beforeSummary ? (
                        <div className="mt-1 text-[9px] text-[#8aa1c4]">
                          <span className="font-medium text-[#c9d5e9]">Before:</span> {event.beforeSummary}
                        </div>
                      ) : null}
                      <div className="mt-0.5 text-[10px] text-[#74809a]">{event.afterSummary ?? event.details}</div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => handleRestoreCheckpoint(event.id, "recovered")}
                          className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[11px] font-medium hover:bg-white/[0.08]"
                        >
                          Restore checkpoint
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRestoreCheckpoint(event.id, "draft")}
                          className="rounded-full border border-emerald-400/20 bg-emerald-500/10 px-3 py-1.5 text-[11px] font-medium text-emerald-100 hover:bg-emerald-500/15"
                        >
                          Restore as draft
                        </button>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="rounded-md border border-dashed border-[#243048] bg-[#0b0f17] px-3 py-3 text-[10px] text-[#74809a]">
                    {evidenceQuery.trim() ? "No reconstructable checkpoints match your search." : "No reconstructable checkpoints yet."}
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-md border border-[#1e2130] bg-[#0b0f17] px-3 py-2">
              <div className="text-[9px] font-semibold uppercase tracking-[0.14em] text-[#5f6a82]">Recent snapshots</div>
              <div className="mt-2 space-y-2">
                {recentSnapshots.length > 0 ? (
                  recentSnapshots.map((snapshot) => {
                    const coverage = snapshot.simulation?.totalCoveragePct;
                    const issues = snapshot.simulation?.issues.length;
                    return (
                      <div key={snapshot.id} className="rounded-md border border-[#1e2130] bg-[#0f1320] px-3 py-2">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="text-[11px] font-semibold text-[#edf2ff]">{snapshot.label}</div>
                          <Badge variant="gray">{formatLedgerTime(snapshot.createdAt)}</Badge>
                        </div>
                    <div className="mt-1 text-[10px] text-[#74809a]">
                      {coverage != null ? `${coverage.toFixed(1)}% coverage` : "Coverage pending"} · {issues != null ? `${issues} issues` : "No simulation"}
                    </div>
                    <div className="mt-1 text-[9px] text-[#8aa1c4]">
                      {snapshot.notes ?? "Saved scene evidence snapshot."}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => setSelectedEvidenceEventId(snapshot.id)}
                        className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[10px] font-medium text-white hover:bg-white/[0.08]"
                      >
                        Preview lineage
                      </button>
                    </div>
                  </div>
                );
              })
                ) : (
                  <div className="rounded-md border border-dashed border-[#243048] bg-[#0b0f17] px-3 py-3 text-[10px] text-[#74809a]">
                    No snapshots saved yet.
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-md border border-[#1e2130] bg-[#0b0f17] px-3 py-2">
              <div className="text-[9px] font-semibold uppercase tracking-[0.14em] text-[#5f6a82]">Change log</div>
              <div className="mt-2 space-y-2">
                {recentChangeEntries.length > 0 ? (
                  recentChangeEntries.map((entry, index) => (
                    <div key={`${entry}-${index}`} className="rounded-md border border-[#1e2130] bg-[#0f1320] px-3 py-2">
                      <div className="text-[10px] text-[#dbe2f0]">{entry}</div>
                    </div>
                  ))
                ) : (
                  <div className="rounded-md border border-dashed border-[#243048] bg-[#0b0f17] px-3 py-3 text-[10px] text-[#74809a]">
                    No change log entries yet.
                  </div>
                )}
              </div>
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
