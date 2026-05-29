import type { SecurityScene, SimulationResult } from "@/schema/security-scene";
import { getSceneSourceMeta } from "@/lib/scene-source";

export type OperationalEvidenceActor = "system" | "user" | "ai";

export type OperationalEvidenceLifecycleStage =
  | "draft"
  | "review"
  | "published"
  | "recovered"
  | "imported"
  | "scanned"
  | "simulated"
  | "manual";

export type OperationalEvidenceEventKind =
  | "scene_initialized"
  | "scene_imported"
  | "scene_created"
  | "scene_updated"
  | "scene_reverted"
  | "draft_proposed"
  | "scene_review_requested"
  | "scene_review_approved"
  | "scene_review_rejected"
  | "scene_comment_added"
  | "governance_role_changed"
  | "governance_policy_changed"
  | "workspace_member_selected"
  | "workspace_access_policy_changed"
  | "workspace_membership_synced"
  | "workspace_approval_routed"
  | "workspace_identity_conflict_resolved"
  | "scan_session_started"
  | "scan_session_compiled"
  | "node_added"
  | "node_updated"
  | "node_removed"
  | "sensor_added"
  | "sensor_updated"
  | "sensor_removed"
  | "sensor_triggered"
  | "sensor_heartbeat"
  | "sensor_faulted"
  | "sensor_restored"
  | "camera_metadata_updated"
  | "camera_live_connection_updated"
  | "snapshot_saved"
  | "scene_published"
  | "simulation_completed"
  | "counterfactual_completed"
  | "draft_applied"
  | "scene_merged"
  | "scan_compiled";

export type OperationalEvidenceEvent = {
  id: string;
  kind: OperationalEvidenceEventKind;
  title: string;
  details: string;
  actor: OperationalEvidenceActor;
  source: SecurityScene["source"] | "system";
  sceneId: string;
  sceneName: string;
  timestamp: number;
  revisionDepth: number;
  affectedNodeIds: string[];
  confidence: number;
  branchId?: string;
  branchLabel?: string;
  lifecycleStage?: OperationalEvidenceLifecycleStage;
  parentEventId?: string;
  published?: boolean;
  beforeSummary?: string;
  afterSummary?: string;
  previousSceneSnapshot?: SecurityScene;
  sceneSnapshot?: SecurityScene;
  simulation?: {
    totalCoveragePct: number;
    issueCount: number;
    failedZoneCount: number;
    deltaCoveragePct?: number | null;
  };
  notes?: string[];
};

export type OperationalEvidenceEventInput = Omit<OperationalEvidenceEvent, "id" | "timestamp"> & {
  timestamp?: number;
};

export type SceneEvidenceSummary = {
  label: string;
  detail: string;
};

export type OperationalEvidenceLifecycleSummary = {
  counts: Record<OperationalEvidenceLifecycleStage, number>;
  branchCounts: Array<[string, number]>;
};

export type OperationalEvidenceBranchHead = {
  stage: OperationalEvidenceLifecycleStage;
  event: OperationalEvidenceEvent | null;
};

export type OperationalEvidenceLineageStep = {
  event: OperationalEvidenceEvent;
  depth: number;
};

export type OperationalEvidenceBranchComparison = {
  left: OperationalEvidenceLineageStep;
  right: OperationalEvidenceLineageStep;
  commonAncestor: OperationalEvidenceLineageStep | null;
  leftScene: SecurityScene | null;
  rightScene: SecurityScene | null;
  ancestorScene: SecurityScene | null;
  delta: {
    cameras: number;
    lights: number;
    obstructions: number;
    zones: number;
    paths: number;
    sensors: number;
    snapshots: number;
  };
  leftSceneSummary: SceneEvidenceSummary | null;
  rightSceneSummary: SceneEvidenceSummary | null;
  ancestorSummary: SceneEvidenceSummary | null;
};

export type OperationalEvidenceMergeReadiness = {
  status: "same" | "fast_forward_left" | "fast_forward_right" | "diverged" | "unrelated";
  recommendation: string;
  commonAncestor: OperationalEvidenceLineageStep | null;
  leftDistance: number | null;
  rightDistance: number | null;
};

export type OperationalEvidenceMergeConflict = {
  collection: string;
  nodeId: string;
  reason: string;
};

export type OperationalGovernanceTrailSummary = {
  totalEvents: number;
  requestCount: number;
  approvalCount: number;
  rejectionCount: number;
  annotationCount: number;
  roleChangeCount: number;
  policyChangeCount: number;
  routeCount: number;
  conflictResolutionCount: number;
  latestEvent: OperationalEvidenceEvent | null;
  recentEvents: OperationalEvidenceEvent[];
};

const GOVERNANCE_TRAIL_KINDS: OperationalEvidenceEventKind[] = [
  "scene_review_requested",
  "scene_review_approved",
  "scene_review_rejected",
  "scene_comment_added",
  "governance_role_changed",
  "governance_policy_changed",
  "workspace_member_selected",
  "workspace_access_policy_changed",
  "workspace_membership_synced",
  "workspace_approval_routed",
  "workspace_identity_conflict_resolved",
  "scene_published",
  "scene_reverted",
];

export type OperationalEvidenceSceneMergeResult = {
  mergedScene: SecurityScene;
  conflicts: OperationalEvidenceMergeConflict[];
  mergedCollections: Array<{ collection: string; added: number; updated: number; removed: number }>;
};

export type OperationalEvidenceEventFilters = {
  lifecycleStage?: OperationalEvidenceLifecycleStage | "all";
  branchLabel?: string | "all" | null;
};

export function summarizeSceneEvidence(scene: SecurityScene): SceneEvidenceSummary {
  const sourceMeta = getSceneSourceMeta(scene.source);
  const parts = [
    `${scene.cameras.length} cameras`,
    `${scene.obstructions.length} obstructions`,
    `${scene.criticalZones.length} critical zones`,
    `${scene.snapshots?.length ?? 0} snapshots`,
  ];

  return {
    label: sourceMeta.label,
    detail: `${scene.name || "Untitled Scene"} · ${parts.join(" · ")}`,
  };
}

export function summarizeSimulationEvidence(simulationResult: SimulationResult | null | undefined) {
  if (!simulationResult) return null;
  const failedZoneCount = simulationResult.criticalZoneResults.filter((zone) => zone.status !== "pass").length;
  return {
    totalCoveragePct: simulationResult.totalCoveragePct,
    issueCount: simulationResult.issues.length,
    failedZoneCount,
  };
}

export function buildOperationalEvidenceEvent(input: OperationalEvidenceEventInput): OperationalEvidenceEvent {
  const timestamp = input.timestamp ?? Date.now();
  const title = input.title.trim() || kindToTitle(input.kind);
  const details = input.details.trim() || title;
  const lifecycleStage = input.lifecycleStage ?? deriveOperationalEvidenceLifecycleStage(input.kind, input.source);
  const branchId = input.branchId ?? `${input.sceneId}:${lifecycleStage}`;
  const branchLabel = input.branchLabel ?? lifecycleStage.replace(/_/g, " ");
  return {
    ...input,
    branchId,
    branchLabel,
    lifecycleStage,
    id: `${input.kind}:${input.sceneId}:${timestamp.toString(36)}:${Math.random().toString(36).slice(2, 8)}`,
    title,
    details,
    timestamp,
  };
}

export function kindToTitle(kind: OperationalEvidenceEventKind) {
  switch (kind) {
    case "scene_initialized":
      return "Scene initialized";
    case "scene_imported":
      return "Scene imported";
    case "scene_created":
      return "Scene created";
    case "scene_updated":
      return "Scene updated";
    case "scene_reverted":
      return "Scene reverted";
    case "draft_proposed":
      return "Draft proposed";
    case "scene_review_requested":
      return "Review requested";
    case "scene_review_approved":
      return "Review approved";
    case "scene_review_rejected":
      return "Review rejected";
    case "scene_comment_added":
      return "Review note added";
    case "governance_role_changed":
      return "Workspace role changed";
    case "governance_policy_changed":
      return "Workspace policy changed";
    case "workspace_member_selected":
      return "Workspace member selected";
    case "workspace_access_policy_changed":
      return "Workspace access policy changed";
    case "workspace_membership_synced":
      return "Workspace membership synced";
    case "workspace_approval_routed":
      return "Workspace approval route resolved";
    case "workspace_identity_conflict_resolved":
      return "Workspace identity conflict resolved";
    case "scan_session_started":
      return "Scan session started";
    case "scan_session_compiled":
      return "Scan session compiled";
    case "node_added":
      return "Node added";
    case "node_updated":
      return "Node updated";
    case "node_removed":
      return "Node removed";
    case "sensor_added":
      return "Sensor added";
    case "sensor_updated":
      return "Sensor updated";
    case "sensor_removed":
      return "Sensor removed";
    case "sensor_triggered":
      return "Sensor triggered";
    case "sensor_heartbeat":
      return "Sensor heartbeat";
    case "sensor_faulted":
      return "Sensor faulted";
    case "sensor_restored":
      return "Sensor restored";
    case "camera_metadata_updated":
      return "Camera metadata updated";
    case "camera_live_connection_updated":
      return "Camera live connection updated";
    case "snapshot_saved":
      return "Snapshot saved";
    case "scene_published":
      return "Scene published";
    case "simulation_completed":
      return "Simulation completed";
    case "counterfactual_completed":
      return "Counterfactual completed";
    case "draft_applied":
      return "Draft applied";
    case "scene_merged":
      return "Scene merged";
    case "scan_compiled":
      return "Scan compiled";
    default:
      return kind;
  }
}

export function confidenceLabel(confidence: number) {
  if (confidence >= 0.9) return "High";
  if (confidence >= 0.65) return "Medium";
  return "Low";
}

export function deriveOperationalEvidenceLifecycleStage(
  kind: OperationalEvidenceEventKind,
  source: OperationalEvidenceEvent["source"],
): OperationalEvidenceLifecycleStage {
  switch (kind) {
    case "draft_applied":
      return "draft";
    case "scene_review_requested":
    case "scene_review_approved":
    case "scene_review_rejected":
    case "scene_comment_added":
    case "governance_role_changed":
    case "governance_policy_changed":
    case "workspace_member_selected":
    case "workspace_access_policy_changed":
    case "workspace_membership_synced":
    case "workspace_approval_routed":
    case "workspace_identity_conflict_resolved":
      return "review";
    case "scene_imported":
      return "imported";
    case "scan_compiled":
      return "scanned";
    case "scene_reverted":
      return "recovered";
    case "scene_merged":
      return "review";
    case "snapshot_saved":
      return "published";
    case "simulation_completed":
    case "counterfactual_completed":
    case "sensor_triggered":
    case "sensor_heartbeat":
    case "sensor_faulted":
    case "sensor_restored":
    case "camera_metadata_updated":
      return "simulated";
    case "scene_created":
      return source === "manual" ? "draft" : "published";
    case "scene_initialized":
    case "scene_updated":
    case "node_added":
    case "node_updated":
    case "node_removed":
    default:
      return "manual";
  }
}

export function summarizeOperationalEvidenceLifecycle(events: OperationalEvidenceEvent[]): OperationalEvidenceLifecycleSummary {
  const counts: Record<OperationalEvidenceLifecycleStage, number> = {
    draft: 0,
    review: 0,
    published: 0,
    recovered: 0,
    imported: 0,
    scanned: 0,
    simulated: 0,
    manual: 0,
  };

  const branchCounts = new Map<string, number>();
  for (const event of events) {
    const stage = event.lifecycleStage ?? deriveOperationalEvidenceLifecycleStage(event.kind, event.source);
    counts[stage] += 1;
    const branchKey = event.branchLabel ?? stage;
    branchCounts.set(branchKey, (branchCounts.get(branchKey) ?? 0) + 1);
  }

  return {
    counts,
    branchCounts: [...branchCounts.entries()].sort((a, b) => b[1] - a[1]),
  };
}

export function summarizeOperationalEvidenceBranchHeads(events: OperationalEvidenceEvent[]): OperationalEvidenceBranchHead[] {
  const latestByStage = new Map<OperationalEvidenceLifecycleStage, OperationalEvidenceEvent>();
  for (const event of events) {
    const stage = event.lifecycleStage ?? deriveOperationalEvidenceLifecycleStage(event.kind, event.source);
    const existing = latestByStage.get(stage);
    if (!existing || event.timestamp >= existing.timestamp) {
      latestByStage.set(stage, event);
    }
  }

  const stageOrder: OperationalEvidenceLifecycleStage[] = ["draft", "review", "published", "recovered", "imported", "scanned", "simulated", "manual"];
  return stageOrder.map((stage) => ({
    stage,
    event: latestByStage.get(stage) ?? null,
  }));
}

export function summarizeOperationalGovernanceTrail(
  events: OperationalEvidenceEvent[],
  sceneId: string,
): OperationalGovernanceTrailSummary {
  const trail = events
    .filter((event) => event.sceneId === sceneId && GOVERNANCE_TRAIL_KINDS.includes(event.kind))
    .sort((left, right) => right.timestamp - left.timestamp);

  return {
    totalEvents: trail.length,
    requestCount: trail.filter((event) => event.kind === "scene_review_requested").length,
    approvalCount: trail.filter((event) => event.kind === "scene_review_approved").length,
    rejectionCount: trail.filter((event) => event.kind === "scene_review_rejected").length,
    annotationCount: trail.filter((event) => event.kind === "scene_comment_added").length,
    roleChangeCount: trail.filter((event) => event.kind === "governance_role_changed" || event.kind === "workspace_member_selected" || event.kind === "workspace_membership_synced").length,
    policyChangeCount: trail.filter((event) => event.kind === "governance_policy_changed" || event.kind === "workspace_access_policy_changed").length,
    routeCount: trail.filter((event) => event.kind === "workspace_approval_routed").length,
    conflictResolutionCount: trail.filter((event) => event.kind === "workspace_identity_conflict_resolved").length,
    latestEvent: trail[0] ?? null,
    recentEvents: trail.slice(0, 5),
  };
}

export function findLatestOperationalEvidenceEventForScene(
  events: OperationalEvidenceEvent[],
  sceneId: string,
  lifecycleStage?: OperationalEvidenceLifecycleStage,
) {
  const filtered = events.filter((event) => {
    if (event.sceneId !== sceneId) return false;
    const stage = event.lifecycleStage ?? deriveOperationalEvidenceLifecycleStage(event.kind, event.source);
    return lifecycleStage ? stage === lifecycleStage : true;
  });
  return filtered.at(-1) ?? null;
}

export function traceOperationalEvidenceLineage(
  events: OperationalEvidenceEvent[],
  eventId: string,
): OperationalEvidenceLineageStep[] {
  const eventById = new Map(events.map((event) => [event.id, event] as const));
  const lineage: OperationalEvidenceEvent[] = [];
  const visited = new Set<string>();
  let current: OperationalEvidenceEvent | undefined = eventById.get(eventId);

  while (current && !visited.has(current.id)) {
    lineage.push(current);
    visited.add(current.id);
    current = current.parentEventId ? eventById.get(current.parentEventId) : undefined;
  }

  return lineage.reverse().map((event, index) => ({
    event,
    depth: index,
  }));
}

function compareNodeCollections<T extends { id: string }>(left: T[], right: T[]) {
  const leftById = new Map(left.map((item) => [item.id, item] as const));
  const rightById = new Map(right.map((item) => [item.id, item] as const));
  const changed: string[] = [];
  const added: string[] = [];
  const removed: string[] = [];

  for (const [id, node] of rightById.entries()) {
    const prev = leftById.get(id);
    if (!prev) {
      added.push(id);
      continue;
    }
    if (JSON.stringify(prev) !== JSON.stringify(node)) {
      changed.push(id);
    }
  }

  for (const id of leftById.keys()) {
    if (!rightById.has(id)) {
      removed.push(id);
    }
  }

  return {
    before: left.length,
    after: right.length,
    delta: right.length - left.length,
    added,
    removed,
    changed,
  };
}

export function compareOperationalEvidenceBranches(
  events: OperationalEvidenceEvent[],
  leftEventId: string,
  rightEventId: string,
): OperationalEvidenceBranchComparison | null {
  if (leftEventId === rightEventId) return null;
  const leftLineage = traceOperationalEvidenceLineage(events, leftEventId);
  const rightLineage = traceOperationalEvidenceLineage(events, rightEventId);
  const left = leftLineage.at(-1) ?? null;
  const right = rightLineage.at(-1) ?? null;
  if (!left || !right) return null;

  const rightIds = new Set(rightLineage.map((step) => step.event.id));
  const commonAncestor = [...leftLineage].reverse().find((step) => rightIds.has(step.event.id)) ?? null;
  const leftScene = reconstructSceneFromEvidence(events, left.event.id);
  const rightScene = reconstructSceneFromEvidence(events, right.event.id);
  const ancestorScene = commonAncestor ? reconstructSceneFromEvidence(events, commonAncestor.event.id) : null;

  const leftSceneSummary = leftScene ? summarizeSceneEvidence(leftScene) : null;
  const rightSceneSummary = rightScene ? summarizeSceneEvidence(rightScene) : null;
  const ancestorSummary = ancestorScene ? summarizeSceneEvidence(ancestorScene) : null;

  const cameraDiff = compareNodeCollections(leftScene?.cameras ?? [], rightScene?.cameras ?? []);
  const lightDiff = compareNodeCollections(leftScene?.securityLights ?? [], rightScene?.securityLights ?? []);
  const obstructionDiff = compareNodeCollections(leftScene?.obstructions ?? [], rightScene?.obstructions ?? []);
  const zoneDiff = compareNodeCollections(
    [...(leftScene?.criticalZones ?? []), ...(leftScene?.privacyZones ?? [])],
    [...(rightScene?.criticalZones ?? []), ...(rightScene?.privacyZones ?? [])],
  );
  const pathDiff = compareNodeCollections(leftScene?.paths ?? [], rightScene?.paths ?? []);
  const sensorDiff = compareNodeCollections(leftScene?.sensors ?? [], rightScene?.sensors ?? []);

  return {
    left,
    right,
    commonAncestor,
    leftScene,
    rightScene,
    ancestorScene,
    delta: {
      cameras: cameraDiff.delta,
      lights: lightDiff.delta,
      obstructions: obstructionDiff.delta,
      zones: zoneDiff.delta,
      paths: pathDiff.delta,
      sensors: sensorDiff.delta,
      snapshots: (rightScene?.snapshots?.length ?? 0) - (leftScene?.snapshots?.length ?? 0),
    },
    leftSceneSummary,
    rightSceneSummary,
    ancestorSummary,
  };
}

export function assessOperationalEvidenceMergeReadiness(
  comparison: OperationalEvidenceBranchComparison | null,
): OperationalEvidenceMergeReadiness | null {
  if (!comparison) return null;
  if (comparison.left.event.id === comparison.right.event.id) {
    return {
      status: "same",
      recommendation: "Both selections point at the same branch head.",
      commonAncestor: comparison.commonAncestor,
      leftDistance: 0,
      rightDistance: 0,
    };
  }

  const commonAncestor = comparison.commonAncestor;
  if (!commonAncestor) {
    return {
      status: "unrelated",
      recommendation: "These branches do not share a reconstructable ancestor and should stay separate.",
      commonAncestor: null,
      leftDistance: null,
      rightDistance: null,
    };
  }

  const leftDistance = comparison.left.depth - commonAncestor.depth;
  const rightDistance = comparison.right.depth - commonAncestor.depth;
  if (leftDistance === 0 && rightDistance > 0) {
    return {
      status: "fast_forward_left",
      recommendation: "Left branch is the ancestor side; the right branch can fast-forward onto it.",
      commonAncestor,
      leftDistance,
      rightDistance,
    };
  }

  if (rightDistance === 0 && leftDistance > 0) {
    return {
      status: "fast_forward_right",
      recommendation: "Right branch is the ancestor side; the left branch can fast-forward onto it.",
      commonAncestor,
      leftDistance,
      rightDistance,
    };
  }

  return {
    status: "diverged",
    recommendation: "The branches diverged after their shared ancestor and would need a real merge policy.",
    commonAncestor,
    leftDistance,
    rightDistance,
  };
}

function compareValues(left: unknown, right: unknown) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function mergeSceneCollection<T extends { id: string }>(
  collectionName: string,
  ancestor: T[],
  left: T[],
  right: T[],
): { items: T[]; conflicts: OperationalEvidenceMergeConflict[]; added: number; updated: number; removed: number } {
  const ancestorById = new Map(ancestor.map((item) => [item.id, item] as const));
  const leftById = new Map(left.map((item) => [item.id, item] as const));
  const rightById = new Map(right.map((item) => [item.id, item] as const));
  const merged: T[] = [];
  const conflicts: OperationalEvidenceMergeConflict[] = [];
  let added = 0;
  let updated = 0;
  let removed = 0;

  const ids = new Set<string>([...ancestorById.keys(), ...leftById.keys(), ...rightById.keys()]);
  for (const id of ids) {
    const ancestorItem = ancestorById.get(id);
    const leftItem = leftById.get(id);
    const rightItem = rightById.get(id);

    if (!ancestorItem) {
      if (leftItem && rightItem && !compareValues(leftItem, rightItem)) {
        conflicts.push({
          collection: collectionName,
          nodeId: id,
          reason: "Both branches added the same node id with different content.",
        });
        continue;
      }
      if (leftItem) {
        merged.push(structuredClone(leftItem));
        added += 1;
        continue;
      }
      if (rightItem) {
        merged.push(structuredClone(rightItem));
        added += 1;
        continue;
      }
      continue;
    }

    const leftExists = Boolean(leftItem);
    const rightExists = Boolean(rightItem);
    const leftMatchesAncestor = leftExists ? compareValues(leftItem, ancestorItem) : false;
    const rightMatchesAncestor = rightExists ? compareValues(rightItem, ancestorItem) : false;

    if (!leftExists && !rightExists) {
      removed += 1;
      continue;
    }

    if (leftItem && rightItem) {
      if (compareValues(leftItem, rightItem)) {
        merged.push(structuredClone(leftItem));
        if (!leftMatchesAncestor) {
          updated += 1;
        }
        continue;
      }

      if (leftMatchesAncestor && !rightMatchesAncestor) {
        merged.push(structuredClone(rightItem));
        updated += 1;
        continue;
      }

      if (!leftMatchesAncestor && rightMatchesAncestor) {
        merged.push(structuredClone(leftItem));
        updated += 1;
        continue;
      }

      conflicts.push({
        collection: collectionName,
        nodeId: id,
        reason: "Both branches changed the same node differently.",
      });
      continue;
    }

    if (leftItem && !rightItem) {
      if (!leftMatchesAncestor) {
        conflicts.push({
          collection: collectionName,
          nodeId: id,
          reason: "Left branch modified a node that the right branch removed.",
        });
        continue;
      }

      removed += 1;
      continue;
    }

    if (!leftItem && rightItem) {
      if (!rightMatchesAncestor) {
        conflicts.push({
          collection: collectionName,
          nodeId: id,
          reason: "Right branch modified a node that the left branch removed.",
        });
        continue;
      }

      removed += 1;
    }
  }

  return { items: merged, conflicts, added, updated, removed };
}

function mergeSceneScalar<T>(
  field: string,
  ancestorValue: T,
  leftValue: T,
  rightValue: T,
  conflicts: OperationalEvidenceMergeConflict[],
) {
  if (compareValues(leftValue, rightValue)) {
    return structuredClone(leftValue) as T;
  }
  if (compareValues(leftValue, ancestorValue)) {
    return structuredClone(rightValue) as T;
  }
  if (compareValues(rightValue, ancestorValue)) {
    return structuredClone(leftValue) as T;
  }
  conflicts.push({
    collection: "scene",
    nodeId: field,
    reason: `Both branches changed ${field} differently.`,
  });
  return structuredClone(leftValue) as T;
}

function mergeSceneStringArray(
  ancestorValue: string[],
  leftValue: string[],
  rightValue: string[],
): string[] {
  if (compareValues(leftValue, rightValue)) {
    return structuredClone(leftValue);
  }
  if (compareValues(leftValue, ancestorValue)) {
    return structuredClone(rightValue);
  }
  if (compareValues(rightValue, ancestorValue)) {
    return structuredClone(leftValue);
  }
  return [...new Set([...(ancestorValue ?? []), ...leftValue, ...rightValue])];
}

export function mergeOperationalEvidenceBranchScenes(
  comparison: OperationalEvidenceBranchComparison | null,
): OperationalEvidenceSceneMergeResult | null {
  if (!comparison || !comparison.commonAncestor || !comparison.leftScene || !comparison.rightScene) {
    return null;
  }

  const ancestor = comparison.ancestorScene;
  const baseScene = structuredClone(comparison.leftScene);
  const conflicts: OperationalEvidenceMergeConflict[] = [];
  const mergedCollections: OperationalEvidenceSceneMergeResult["mergedCollections"] = [];

  if (!ancestor) {
    return null;
  }

  const topLevelFields = [
    "name",
    "units",
    "dimensions",
    "assumptions",
    "source",
    "version",
    "timeSchedule",
    "scenarios",
  ] as const;
  for (const field of topLevelFields) {
    const ancestorValue = (ancestor as Record<string, unknown>)[field];
    const leftValue = (comparison.leftScene as Record<string, unknown>)[field];
    const rightValue = (comparison.rightScene as Record<string, unknown>)[field];

    if (field === "scenarios") {
      (baseScene as Record<string, unknown>)[field] = mergeSceneStringArray(
        (ancestorValue ?? []) as string[],
        (leftValue ?? []) as string[],
        (rightValue ?? []) as string[],
      );
      continue;
    }

    (baseScene as Record<string, unknown>)[field] = mergeSceneScalar(
      field,
      ancestorValue,
      leftValue,
      rightValue,
      conflicts,
    );
  }

  const collections: Array<keyof SecurityScene> = [
    "walls",
    "doors",
    "windows",
    "cameras",
    "securityLights",
    "obstructions",
    "criticalZones",
    "privacyZones",
    "sensors",
    "entryPoints",
    "paths",
    "snapshots",
  ];

  for (const collection of collections) {
    const mergeResult = mergeSceneCollection(
      collection,
      ancestor[collection] as unknown as Array<{ id: string }>,
      comparison.leftScene[collection] as unknown as Array<{ id: string }>,
      comparison.rightScene[collection] as unknown as Array<{ id: string }>,
    );
    (baseScene as Record<string, unknown>)[collection] = mergeResult.items;
    conflicts.push(...mergeResult.conflicts);
    mergedCollections.push({
      collection,
      added: mergeResult.added,
      updated: mergeResult.updated,
      removed: mergeResult.removed,
    });
  }

  baseScene.changeLog = mergeSceneStringArray(
    comparison.ancestorScene?.changeLog ?? [],
    comparison.leftScene.changeLog ?? [],
    comparison.rightScene.changeLog ?? [],
  );
  delete baseScene.simulation;
  delete baseScene.temporalProfile;
  baseScene.updatedAt = Date.now();

  return {
    mergedScene: baseScene,
    conflicts,
    mergedCollections,
  };
}

export function normalizeOperationalEvidenceEvents(raw: unknown): OperationalEvidenceEvent[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const candidate = item as Partial<OperationalEvidenceEvent>;
    if (
      typeof candidate.id !== "string"
      || typeof candidate.kind !== "string"
      || typeof candidate.title !== "string"
      || typeof candidate.details !== "string"
      || typeof candidate.actor !== "string"
      || typeof candidate.source !== "string"
      || typeof candidate.sceneId !== "string"
      || typeof candidate.sceneName !== "string"
      || typeof candidate.timestamp !== "number"
      || typeof candidate.revisionDepth !== "number"
      || !Array.isArray(candidate.affectedNodeIds)
      || typeof candidate.confidence !== "number"
    ) {
      return [];
    }

    const kind = candidate.kind as OperationalEvidenceEventKind;
    const actor = candidate.actor as OperationalEvidenceActor;
    return [{
      id: candidate.id,
      kind,
      title: candidate.title,
      details: candidate.details,
      actor,
      source: candidate.source as OperationalEvidenceEvent["source"],
      sceneId: candidate.sceneId,
      sceneName: candidate.sceneName,
      timestamp: candidate.timestamp,
      revisionDepth: candidate.revisionDepth,
      affectedNodeIds: candidate.affectedNodeIds.filter((id): id is string => typeof id === "string"),
      confidence: candidate.confidence,
      branchId: typeof candidate.branchId === "string" ? candidate.branchId : undefined,
      branchLabel: typeof candidate.branchLabel === "string" ? candidate.branchLabel : undefined,
      lifecycleStage: typeof candidate.lifecycleStage === "string" ? (candidate.lifecycleStage as OperationalEvidenceLifecycleStage) : undefined,
      parentEventId: typeof candidate.parentEventId === "string" ? candidate.parentEventId : undefined,
      published: typeof candidate.published === "boolean" ? candidate.published : undefined,
      beforeSummary: typeof candidate.beforeSummary === "string" ? candidate.beforeSummary : undefined,
      afterSummary: typeof candidate.afterSummary === "string" ? candidate.afterSummary : undefined,
      previousSceneSnapshot: candidate.previousSceneSnapshot && typeof candidate.previousSceneSnapshot === "object"
        ? structuredClone(candidate.previousSceneSnapshot as SecurityScene)
        : undefined,
      sceneSnapshot: candidate.sceneSnapshot && typeof candidate.sceneSnapshot === "object"
        ? structuredClone(candidate.sceneSnapshot as SecurityScene)
        : undefined,
      simulation: candidate.simulation && typeof candidate.simulation === "object"
        ? {
            totalCoveragePct: typeof candidate.simulation.totalCoveragePct === "number" ? candidate.simulation.totalCoveragePct : 0,
            issueCount: typeof candidate.simulation.issueCount === "number" ? candidate.simulation.issueCount : 0,
            failedZoneCount: typeof candidate.simulation.failedZoneCount === "number" ? candidate.simulation.failedZoneCount : 0,
            deltaCoveragePct: typeof candidate.simulation.deltaCoveragePct === "number" ? candidate.simulation.deltaCoveragePct : null,
          }
        : undefined,
      notes: Array.isArray(candidate.notes) ? candidate.notes.filter((note): note is string => typeof note === "string") : undefined,
    }];
  });
}

export function getOperationalEvidenceCheckpoints(events: OperationalEvidenceEvent[]) {
  return events.filter((event) => Boolean(event.previousSceneSnapshot || event.sceneSnapshot));
}

export function matchesOperationalEvidenceEvent(
  event: OperationalEvidenceEvent,
  query: string,
  filters?: OperationalEvidenceEventFilters,
) {
  const trimmed = query.trim().toLowerCase();
  const lifecycleStage = filters?.lifecycleStage ?? "all";
  const branchLabel = filters?.branchLabel ?? "all";
  const eventLifecycleStage = event.lifecycleStage ?? deriveOperationalEvidenceLifecycleStage(event.kind, event.source);
  const eventBranchLabel = event.branchLabel ?? eventLifecycleStage;
  if (lifecycleStage !== "all" && eventLifecycleStage !== lifecycleStage) return false;
  if (branchLabel !== "all" && branchLabel !== null && eventBranchLabel !== branchLabel) return false;
  if (!trimmed) return true;

  const haystacks = [
    event.id,
    event.kind,
    event.title,
    event.details,
    event.actor,
    event.sceneId,
    event.sceneName,
    event.source,
    event.beforeSummary,
    event.afterSummary,
    event.notes?.join(" "),
    event.affectedNodeIds.join(" "),
  ];

  return haystacks.some((value) => value?.toLowerCase().includes(trimmed));
}

export function filterOperationalEvidenceEvents(
  events: OperationalEvidenceEvent[],
  query: string,
  filters?: OperationalEvidenceEventFilters,
) {
  return events.filter((event) => matchesOperationalEvidenceEvent(event, query, filters));
}

export function reconstructSceneFromEvidence(
  events: OperationalEvidenceEvent[],
  eventId?: string,
): SecurityScene | null {
  if (events.length === 0) return null;
  const targetIndex = eventId ? events.findIndex((event) => event.id === eventId) : events.length - 1;
  if (targetIndex < 0) return null;

  for (let index = targetIndex; index >= 0; index -= 1) {
    const event = events[index];
    if (event?.sceneSnapshot) {
      return structuredClone(event.sceneSnapshot);
    }
  }

  return null;
}
