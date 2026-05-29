import type { SecurityScene, SimulationResult } from "@/schema/security-scene";

import { getSceneSourceMeta } from "@/lib/scene-source";
import type { OperationalEvidenceEvent } from "@/lib/operational-evidence";

export type SceneIntelligenceNodeKind = "scene" | "source" | "entity" | "assumption" | "simulation" | "snapshot";
export type SceneIntelligenceEdgeKind = "contains" | "originates_from" | "assesses" | "covers" | "validated_by";

export type SceneIntelligenceNode = {
  id: string;
  kind: SceneIntelligenceNodeKind;
  label: string;
  subtitle?: string;
  source?: string;
  count?: number;
  historyCount?: number;
  latestEvidenceKind?: string;
  latestEvidenceAt?: number;
  latestEvidenceSummary?: string;
};

export type SceneIntelligenceEdge = {
  id: string;
  from: string;
  to: string;
  kind: SceneIntelligenceEdgeKind;
  label?: string;
  status?: "pass" | "partial" | "fail";
};

export type SceneIntelligenceGraphSummary = {
  nodeCount: number;
  edgeCount: number;
  entityCount: number;
  sourceCount: number;
  sourceCounts: Record<string, number>;
  cameraCount: number;
  zoneCount: number;
  coverageLinkCount: number;
  failedZoneCount: number;
  revisionDepth: number;
  snapshotCount: number;
  sceneSourceLabel: string;
};

export type SceneIntelligenceGraph = {
  rootId: string;
  nodes: SceneIntelligenceNode[];
  edges: SceneIntelligenceEdge[];
  summary: SceneIntelligenceGraphSummary;
  updatedAt: number;
};

export type SceneIntelligenceGraphOptions = {
  simulationResult?: SimulationResult | null;
  revisionDepth?: number;
  snapshotCount?: number;
  operationalEvidenceEvents?: OperationalEvidenceEvent[];
};

const ENTITY_COLLECTIONS = [
  { key: "walls", kind: "wall", labelKey: "label" },
  { key: "doors", kind: "door", labelKey: "label" },
  { key: "windows", kind: "window", labelKey: "label" },
  { key: "cameras", kind: "camera", labelKey: "name" },
  { key: "securityLights", kind: "security_light", labelKey: "name" },
  { key: "obstructions", kind: "obstruction", labelKey: "label" },
  { key: "criticalZones", kind: "critical_zone", labelKey: "label" },
  { key: "privacyZones", kind: "privacy_zone", labelKey: "label" },
  { key: "entryPoints", kind: "entry_point", labelKey: "label" },
  { key: "paths", kind: "path", labelKey: "label" },
] as const;

function normalizeSceneSource(source: SecurityScene["source"]) {
  const meta = getSceneSourceMeta(source);
  return { key: source, label: meta.label };
}

function normalizeEntitySource(source: string | undefined) {
  switch (source) {
    case "ai":
      return { key: "ai", label: "AI" };
    case "scan":
      return { key: "scan", label: "Scan" };
    case "import":
      return { key: "import", label: "Import" };
    case "preset":
      return { key: "preset", label: "Preset" };
    case "demo":
      return { key: "demo", label: "Demo" };
    case "manual":
    default:
      return { key: "manual", label: "Manual" };
  }
}

function getLabel(node: { label?: unknown; name?: unknown }, fallback: string) {
  const label = node.label ?? node.name;
  return typeof label === "string" && label.trim().length > 0 ? label : fallback;
}

export function buildSceneIntelligenceGraph(
  scene: SecurityScene,
  options: SceneIntelligenceGraphOptions = {},
): SceneIntelligenceGraph {
  const now = Date.now();
  const rootId = `scene:${scene.id}`;
  const orderedEvidenceEvents = [...(options.operationalEvidenceEvents?.filter((event) => event.sceneId === scene.id) ?? [])]
    .sort((left, right) => left.timestamp - right.timestamp || left.id.localeCompare(right.id));
  const nodeHistoryById = new Map<string, {
    count: number;
    latestEvent: OperationalEvidenceEvent | null;
  }>();
  for (const event of orderedEvidenceEvents) {
    if (event.affectedNodeIds.length === 0) continue;
    for (const nodeId of event.affectedNodeIds) {
      const existing = nodeHistoryById.get(nodeId) ?? { count: 0, latestEvent: null };
      existing.count += 1;
      if (!existing.latestEvent || event.timestamp >= existing.latestEvent.timestamp) {
        existing.latestEvent = event;
      }
      nodeHistoryById.set(nodeId, existing);
    }
  }
  const nodes: SceneIntelligenceNode[] = [
    {
      id: rootId,
      kind: "scene",
      label: scene.name || "Untitled Scene",
      subtitle: `${scene.dimensions.width}m × ${scene.dimensions.depth}m × ${scene.dimensions.height}m`,
      source: normalizeSceneSource(scene.source).key,
      historyCount: orderedEvidenceEvents.length,
      latestEvidenceKind: orderedEvidenceEvents.at(-1)?.kind,
      latestEvidenceAt: orderedEvidenceEvents.at(-1)?.timestamp,
      latestEvidenceSummary: orderedEvidenceEvents.at(-1)?.afterSummary ?? orderedEvidenceEvents.at(-1)?.details,
    },
  ];
  const edges: SceneIntelligenceEdge[] = [];
  const sourceCounts: Record<string, number> = {};
  const sourceNodeByKey = new Map<string, SceneIntelligenceNode>();

  const addSourceNode = (sourceKey: string, label: string, count: number) => {
    const nodeId = `source:${sourceKey}`;
    const existing = sourceNodeByKey.get(sourceKey);
    if (existing) {
      existing.label = label;
      existing.subtitle = `${count} object${count === 1 ? "" : "s"}`;
      existing.source = sourceKey;
      existing.count = count;
      return;
    }

    const node = {
      id: nodeId,
      kind: "source" as const,
      label,
      subtitle: `${count} object${count === 1 ? "" : "s"}`,
      source: sourceKey,
      count,
    };
    sourceNodeByKey.set(sourceKey, node);
    nodes.push(node);
  };

  const addEdge = (from: string, to: string, kind: SceneIntelligenceEdgeKind, label?: string, status?: "pass" | "partial" | "fail") => {
    edges.push({
      id: `${kind}:${from}:${to}`,
      from,
      to,
      kind,
      label,
      status,
    });
  };

  const rootSource = normalizeSceneSource(scene.source);
  sourceCounts[rootSource.key] = (sourceCounts[rootSource.key] ?? 0) + 1;
  addSourceNode(rootSource.key, rootSource.label, sourceCounts[rootSource.key]);
  addEdge(rootId, `source:${rootSource.key}`, "originates_from", rootSource.label);
  addEdge(`source:${rootSource.key}`, rootId, "validated_by", "scene origin");

  for (const entry of ENTITY_COLLECTIONS) {
    const collection = scene[entry.key];
    for (const item of collection) {
      const source = normalizeEntitySource((item as { source?: string }).source);
      sourceCounts[source.key] = (sourceCounts[source.key] ?? 0) + 1;
      addSourceNode(source.key, source.label, sourceCounts[source.key]);

      const nodeId = `${entry.kind}:${item.id}`;
      const nodeHistory = nodeHistoryById.get(item.id) ?? null;
      nodes.push({
        id: nodeId,
        kind: "entity",
        label: getLabel(item as { label?: unknown; name?: unknown }, item.id),
        subtitle: entry.kind.replace(/_/g, " "),
        source: source.key,
        historyCount: nodeHistory?.count,
        latestEvidenceKind: nodeHistory?.latestEvent?.kind,
        latestEvidenceAt: nodeHistory?.latestEvent?.timestamp,
        latestEvidenceSummary: nodeHistory?.latestEvent?.afterSummary ?? nodeHistory?.latestEvent?.details,
      });

      addEdge(rootId, nodeId, "contains", entry.kind);
      addEdge(`source:${source.key}`, nodeId, "originates_from", source.label);
    }
  }

  const assumptionSummary = [
    `Coverage ${scene.assumptions.doriStandard === "oodpcvs_2025" ? "OODPCVS 2025" : "DORI 2014"}`,
    `Time ${scene.assumptions.timeOfDay}`,
    `Interior ${scene.assumptions.interiorLightLevel}`,
  ].join(" · ");

  nodes.push({
    id: `assumptions:${scene.id}`,
    kind: "assumption",
    label: "Assumptions",
    subtitle: assumptionSummary,
  });
  addEdge(rootId, `assumptions:${scene.id}`, "validated_by", "operating assumptions");

  if (options.snapshotCount && options.snapshotCount > 0) {
    nodes.push({
      id: `snapshots:${scene.id}`,
      kind: "snapshot",
      label: "Snapshots",
      subtitle: `${options.snapshotCount} saved`,
      count: options.snapshotCount,
    });
    addEdge(rootId, `snapshots:${scene.id}`, "validated_by", "before/after evidence");
  }

  let coverageLinkCount = 0;
  let failedZoneCount = 0;

  if (options.simulationResult) {
    const simulationNodeId = `simulation:${scene.id}`;
    const sim = options.simulationResult;
    nodes.push({
      id: simulationNodeId,
      kind: "simulation",
      label: "Simulation",
      subtitle: `${sim.totalCoveragePct.toFixed(1)}% coverage`,
      source: "simulation",
    });
    addEdge(rootId, simulationNodeId, "validated_by", "simulation result");

    const cameraIds = new Set(scene.cameras.map((camera) => camera.id));
    for (const zoneResult of sim.criticalZoneResults) {
      const zoneNodeId = `critical_zone:${zoneResult.zoneId}`;
      const zoneNodeExists = nodes.some((node) => node.id === zoneNodeId);
      if (!zoneNodeExists) continue;

      for (const cameraId of zoneResult.coveringCameras) {
        if (!cameraIds.has(cameraId)) continue;
        addEdge(
          `camera:${cameraId}`,
          zoneNodeId,
          "covers",
          zoneResult.status === "pass"
            ? "validated coverage"
            : zoneResult.status === "partial"
              ? "partial coverage"
              : "failed coverage",
          zoneResult.status,
        );
        coverageLinkCount += 1;
      }

      if (zoneResult.status !== "pass") {
        failedZoneCount += 1;
        addEdge(zoneNodeId, simulationNodeId, "assesses", zoneResult.status);
      }
    }

    for (const cameraResult of sim.cameraResults) {
      const cameraNodeId = `camera:${cameraResult.cameraId}`;
      if (!scene.cameras.some((camera) => camera.id === cameraResult.cameraId)) continue;
      addEdge(simulationNodeId, cameraNodeId, "assesses", `${cameraResult.coveragePct.toFixed(1)}% coverage`);
    }
  }

  const entityCount = nodes.filter((node) => node.kind === "entity").length;
  const sourceCount = nodes.filter((node) => node.kind === "source").length;
  const cameraCount = scene.cameras.length;
  const zoneCount = scene.criticalZones.length;

  return {
    rootId,
    nodes,
    edges,
    summary: {
      nodeCount: nodes.length,
      edgeCount: edges.length,
      entityCount,
      sourceCount,
      sourceCounts,
      cameraCount,
      zoneCount,
      coverageLinkCount,
      failedZoneCount,
      revisionDepth: options.revisionDepth ?? 0,
      snapshotCount: options.snapshotCount ?? scene.snapshots.length,
      sceneSourceLabel: rootSource.label,
    },
    updatedAt: now,
  };
}
