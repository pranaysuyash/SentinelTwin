import {
  type AnyEditableNode,
  type CameraNode,
  type CommentNode,
  type SecurityScene,
  type SimulationResult,
  type SceneSnapshot,
  type SensorNode,
  cloneSecurityScene,
  parseSecurityScene,
  safeParseSecurityScene,
} from "@/schema/security-scene";
import type { AnyNode } from "@sentineltwin/core";
import type { CoverageCellResult, DoriQuality } from "@/schema/security-scene";
import {
  validateSceneGeometry,
} from "@/lib/scene-validation";
import {
  buildSceneIntelligenceGraph,
  type SceneIntelligenceGraph,
} from "@/lib/scene-intelligence-graph";
import {
  buildOperationalEvidenceEvent,
  summarizeSceneEvidence,
  summarizeSimulationEvidence,
  confidenceLabel,
  kindToTitle,
  type OperationalEvidenceEvent,
} from "@/lib/operational-evidence";
import {
  type WorkspaceGovernanceState,
  type WorkspaceSceneStatus,
} from "@/lib/workspace-governance";
import type { CameraPresetId } from "@/components/workspace/camera-preset-utils";

function resetWorkspaceGovernanceForDraft(governance: WorkspaceGovernanceState): WorkspaceGovernanceState {
  return {
    ...governance,
    sceneStatus: "draft" as WorkspaceSceneStatus,
    requestedAt: null,
    requestedBy: null,
    reviewedAt: null,
    reviewedBy: null,
    publishedAt: null,
    publishedBy: null,
  };
}
import { createBlankSecurityScene } from "@/lib/scene-skeleton";
import {
  getPresetLayoutSnapshot,
  type WorkspaceLayoutSnapshot,
} from "@/lib/workspace-layouts";
import {
  serializeOperationalEvidenceJournal,
} from "@/lib/operational-evidence-journal";
function persistFixSandboxState(active: boolean, baseline: any, draft: any) {
  try {
    if (!active || !baseline || !draft) {
      localStorage.removeItem("sentineltwin_fix_sandbox_v1");
      return;
    }
    localStorage.setItem("sentineltwin_fix_sandbox_v1", JSON.stringify({
      fixSandboxActive: true,
      fixSandboxBaselineScene: baseline,
      fixSandboxDraftScene: draft,
    }));
  } catch {}
}
import type { BottomTab, RightPanelMode, ViewMode, WorkspacePreset, LayerId } from "./layout-slice";

// ---------------------------------------------------------------------------
// Types lifted from the main store (cannot import directly from studio-store.ts)
// ---------------------------------------------------------------------------
export type ActiveTool = "select" | "camera" | "obstruction" | "light" | "sensor" | "path" | "zone" | "door_window" | "wall" | "measure" | "comment";
export type EditorMode = "idle" | "placing" | "drawing_wall" | "drawing_polygon" | "drawing_path" | "transforming";
export type EditorDraft = {
  editorMode: EditorMode;
  draftWallStart?: [number, number];
  draftPolygonPoints: [number, number][];
  draftPathPoints: [number, number][];
  hoverPoint?: [number, number];
  /** Drag-to-aim state while placing a camera: anchor is the click point, yawDeg follows the cursor. */
  placementAim?: { anchor: [number, number]; yawDeg: number };
  feedbackMessage: string | null;
  snapEnabled: boolean;
  snapDistanceM: number;
  gridSnapM: number;
  selectedHandle?: string;
};
export type InspectorTab = "properties" | "view" | "status" | "analytics" | "failures" | "history";
export type HeatmapMode = "quality" | "lighting" | "fragility" | "overlap" | "contribution" | "blindspots";
export type HeatmapHoverState = { cell: CoverageCellResult; screenX: number; screenY: number };
export type CommentToolState = { active: boolean; position: [number, number, number] | null; attachedToNodeId: string | null; draftText: string };
export type MeasurementToolState = {
  active: boolean;
  sourceCameraId: string | null;
  targetPoint: [number, number, number] | null;
  result: { distanceM: number; angleDeg: number; ppm: number; quality: DoriQuality } | null;
};
export type FocusScenePointRequest = { point: [number, number]; source: "minimap" | "pathMap" };
export type MapViewportState = { zoom: number; pan: [number, number] };
export type MapState = { minimap: MapViewportState; pathMap: MapViewportState };
type MapViewportTarget = "minimap" | "pathMap";

// ---------------------------------------------------------------------------
// Local helper types (used in scene-replacement patches)
// ---------------------------------------------------------------------------
type LocalLayerVisibility = Record<LayerId, boolean>;
type DockSnapshot = WorkspaceLayoutSnapshot;

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const DEFAULT_LAYERS: LocalLayerVisibility = {
  cameras: true, camera_cones: true, obstructions: true, lights: true,
  critical_zones: true, privacy_zones: true, paths: true, heatmap: true,
  grid: true, walls_floors: true, labels: true,
};

const DEFAULT_MAP_STATE: MapState = {
  minimap: { zoom: 1, pan: [0, 0] },
  pathMap: { zoom: 1, pan: [0, 0] },
};

const OPERATIONAL_EVIDENCE_STORAGE_KEY = "sentineltwin_operational_evidence_v1";
const WORKSPACE_GOVERNANCE_STORAGE_KEY = "sentineltwin_workspace_governance_v1";

const ANALYSIS_TAB_ORDER: BottomTab[] = [
  "metrics",
  "issues",
  "sensors",
  "timeline",
  "temporal",
  "beforeafter",
  "assumptions",
  "governance",
  "provenance",
  "redundancy",
  "counterfactual",
  "threat",
  "report",
  "debug",
  "novel",
];

// ---------------------------------------------------------------------------
// Collection key sets
// ---------------------------------------------------------------------------
const collectionKeys = [
  "walls", "doors", "windows", "cameras", "securityLights",
  "sensors", "obstructions", "criticalZones", "privacyZones", "entryPoints", "paths",
  "fenceSegments", "gateNodes", "bollardLines",
] as const;

const sceneNodeCollectionKeys: Array<keyof SecurityScene> = [
  "walls", "doors", "windows", "cameras", "securityLights",
  "obstructions", "criticalZones", "privacyZones", "entryPoints",
  "paths", "sensors", "comments",
  "fenceSegments", "gateNodes", "bollardLines",
];

// ---------------------------------------------------------------------------
// Persistence wrappers (localStorage)
// ---------------------------------------------------------------------------
function persistOperationalEvidenceEvents(events: OperationalEvidenceEvent[]) {
  try {
    if (typeof window === "undefined") return;
    const raw = localStorage.getItem(OPERATIONAL_EVIDENCE_STORAGE_KEY);
    localStorage.setItem(OPERATIONAL_EVIDENCE_STORAGE_KEY, serializeOperationalEvidenceJournal(raw, events));
  } catch {}
}

function persistWorkspaceGovernanceLocal(governance: WorkspaceGovernanceState) {
  try {
    if (typeof window === "undefined") return;
    localStorage.setItem(WORKSPACE_GOVERNANCE_STORAGE_KEY, JSON.stringify(governance));
  } catch {}
}

// ---------------------------------------------------------------------------
// Pure helper functions
// ---------------------------------------------------------------------------
function patchNodeInScene(scene: SecurityScene, id: string, patch: Partial<AnyEditableNode>): SecurityScene {
  const next = cloneSecurityScene(scene);
  for (const key of collectionKeys) {
    const idx = next[key].findIndex((n) => n.id === id);
    if (idx !== -1) {
      (next as unknown as Record<string, AnyEditableNode[]>)[key][idx] = { ...(next[key][idx] as AnyEditableNode), ...patch } as unknown as AnyEditableNode;
      next.updatedAt = Date.now();
      return next;
    }
  }
  return next;
}

function removeNodeFromScene(scene: SecurityScene, id: string): SecurityScene {
  const next = cloneSecurityScene(scene);
  for (const key of collectionKeys) {
    const before = next[key].length;
    (next[key] as AnyEditableNode[]) = next[key].filter((n) => n.id !== id) as typeof next[typeof key];
    if (next[key].length !== before) { next.updatedAt = Date.now(); return next; }
  }
  return next;
}

function insertNodeInScene(scene: SecurityScene, node: AnyEditableNode): SecurityScene {
  const next = cloneSecurityScene(scene);
  switch (node.nodeType) {
    case "wall":           next.walls.push(node);           break;
    case "door":           next.doors.push(node);           break;
    case "window":         next.windows.push(node);         break;
    case "camera":         next.cameras.push(node);         break;
    case "security_light": next.securityLights.push(node);  break;
    case "sensor":         next.sensors.push(node);         break;
    case "obstruction":    next.obstructions.push(node);    break;
    case "critical_zone":  next.criticalZones.push(node);   break;
    case "privacy_zone":   next.privacyZones.push(node);    break;
    case "entry_point":    next.entryPoints.push(node);     break;
    case "path":           next.paths.push(node);           break;
    case "comment":        next.comments.push(node);        break;
  }
  next.updatedAt = Date.now();
  return next;
}

function duplicateNodeInScene(scene: SecurityScene, id: string): { scene: SecurityScene; duplicatedId: string | null } {
  const next = cloneSecurityScene(scene);
  const duplicateOffset = [0.4, 0.4] as const;
  const prefixMap: Record<AnyEditableNode["nodeType"], string> = {
    camera: "cam",
    obstruction: "obs",
    security_light: "light",
    sensor: "sensor",
    wall: "wall",
    door: "door",
    window: "window",
    critical_zone: "zone",
    privacy_zone: "privacy",
    entry_point: "entry",
    path: "path",
    comment: "comment",
    fence_segment: "fence",
    gate_node: "gate",
    bollard_line: "bollard",
  };
  const makeDuplicateId = (prefix: string) => `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
  const duplicateScenePoint = (point: [number, number]) => [point[0] + duplicateOffset[0], point[1] + duplicateOffset[1]] as [number, number];
  const duplicateScenePoint3 = (point: [number, number, number]) => [point[0] + duplicateOffset[0], point[1], point[2] + duplicateOffset[1]] as [number, number, number];

  for (const key of collectionKeys) {
    const index = next[key].findIndex((entry) => entry.id === id);
    if (index === -1) continue;

    const original = structuredClone(next[key][index] as AnyEditableNode);
    const duplicatedId = makeDuplicateId(prefixMap[original.nodeType]);
    const duplicate = original as AnyEditableNode;

    if ("label" in duplicate && typeof duplicate.label === "string") {
      duplicate.label = duplicate.label.endsWith(" Copy") ? duplicate.label : `${duplicate.label} Copy`;
    }
    if ("name" in duplicate && typeof duplicate.name === "string") {
      duplicate.name = duplicate.name.endsWith(" Copy") ? duplicate.name : `${duplicate.name} Copy`;
    }

    switch (duplicate.nodeType) {
      case "camera":
      case "security_light":
      case "sensor":
      case "obstruction":
      case "door":
      case "window":
      case "entry_point":
        duplicate.position = duplicateScenePoint3((duplicate as { position: [number, number, number] }).position);
        break;
      case "wall":
      case "fence_segment":
      case "bollard_line":
        duplicate.start = duplicateScenePoint((duplicate as { start: [number, number] }).start);
        duplicate.end = duplicateScenePoint((duplicate as { end: [number, number] }).end);
        break;
      case "gate_node":
        duplicate.position = duplicateScenePoint((duplicate as { position: [number, number] }).position);
        break;
      case "critical_zone":
      case "privacy_zone":
        duplicate.polygon = (duplicate as { polygon: [number, number][] }).polygon.map(duplicateScenePoint);
        break;
      case "path":
        duplicate.points = (duplicate as { points: { position: [number, number] }[] }).points.map((point) => ({
          ...point,
          position: duplicateScenePoint(point.position),
        }));
        break;
    }

    if ("source" in duplicate) {
      duplicate.source = "manual";
    }
    duplicate.id = duplicatedId;
    (next[key] as unknown as AnyEditableNode[]).push(duplicate as AnyEditableNode);
    next.updatedAt = Date.now();
    return { scene: next, duplicatedId };
  }

  return { scene: next, duplicatedId: null };
}

function duplicateNodesInScene(scene: SecurityScene, ids: string[]): { scene: SecurityScene; duplicatedIds: string[] } {
  let next = cloneSecurityScene(scene);
  const duplicatedIds: string[] = [];

  ids.forEach((id) => {
    const result = duplicateNodeInScene(next, id);
    next = result.scene;
    if (result.duplicatedId) {
      duplicatedIds.push(result.duplicatedId);
    }
  });

  return { scene: next, duplicatedIds };
}

function compareSceneCollections<T extends { id: string }>(before: T[], after: T[]) {
  const beforeById = new Map(before.map((item) => [item.id, item] as const));
  const afterById = new Map(after.map((item) => [item.id, item] as const));
  const added: string[] = [];
  const updated: string[] = [];
  const removed: string[] = [];

  for (const [id, node] of afterById.entries()) {
    const prev = beforeById.get(id);
    if (!prev) {
      added.push(id);
      continue;
    }
    if (JSON.stringify(prev) !== JSON.stringify(node)) {
      updated.push(id);
    }
  }

  for (const id of beforeById.keys()) {
    if (!afterById.has(id)) {
      removed.push(id);
    }
  }

  return { added, updated, removed };
}

function detectSensorMutation(before: SecurityScene, after: SecurityScene) {
  const sensorDiff = compareSceneCollections(before.sensors, after.sensors);
  const otherCollectionsChanged = [
    before.walls,
    before.doors,
    before.windows,
    before.cameras,
    before.securityLights,
    before.obstructions,
    before.criticalZones,
    before.privacyZones,
    before.entryPoints,
    before.paths,
  ].some((collection, index) => {
    const counterpart = [
      after.walls,
      after.doors,
      after.windows,
      after.cameras,
      after.securityLights,
      after.obstructions,
      after.criticalZones,
      after.privacyZones,
      after.entryPoints,
      after.paths,
    ][index];
    return JSON.stringify(collection) !== JSON.stringify(counterpart);
  });

  if (otherCollectionsChanged) return null;
  if (sensorDiff.added.length > 0 && sensorDiff.updated.length === 0 && sensorDiff.removed.length === 0) {
    return { kind: "sensor_added" as const, affectedNodeIds: sensorDiff.added };
  }
  if (sensorDiff.removed.length > 0 && sensorDiff.added.length === 0 && sensorDiff.updated.length === 0) {
    return { kind: "sensor_removed" as const, affectedNodeIds: sensorDiff.removed };
  }
  if (sensorDiff.updated.length > 0 && sensorDiff.added.length === 0 && sensorDiff.removed.length === 0) {
    return { kind: "sensor_updated" as const, affectedNodeIds: sensorDiff.updated };
  }
  return null;
}

function sceneNodeIds(scene: SecurityScene) {
  return [
    ...scene.walls,
    ...scene.doors,
    ...scene.windows,
    ...scene.cameras,
    ...scene.securityLights,
    ...scene.sensors,
    ...scene.obstructions,
    ...scene.criticalZones,
    ...scene.privacyZones,
    ...scene.entryPoints,
    ...scene.paths,
  ].map((entry) => entry.id);
}

function purgeInvalidSelection(scene: SecurityScene, selectedNodeIds: string[]) {
  const ids = new Set(sceneNodeIds(scene));
  return selectedNodeIds.filter((id) => ids.has(id));
}

function primarySelection(selectedNodeIds: string[]) {
  return selectedNodeIds[0] ?? null;
}

function setSelectionState(scene: SecurityScene, selectedNodeIds: string[]) {
  const next = purgeInvalidSelection(scene, selectedNodeIds);
  return {
    selectedNodeIds: next,
    selectedNodeId: primarySelection(next),
  };
}

function translateNode(node: AnyEditableNode, delta: [number, number]): AnyEditableNode {
  const [dx, dz] = delta;
  const next = structuredClone(node) as AnyEditableNode;

  if (next.nodeType === "camera" || next.nodeType === "security_light" || next.nodeType === "obstruction" || next.nodeType === "door" || next.nodeType === "window") {
    next.position = [next.position[0] + dx, next.position[1], next.position[2] + dz] as typeof next.position;
    return next;
  }

  if (next.nodeType === "sensor") {
    next.position = [next.position[0] + dx, next.position[1], next.position[2] + dz] as typeof next.position;
    return next;
  }

  if (next.nodeType === "entry_point") {
    next.position = [next.position[0] + dx, next.position[1] + dz];
    return next;
  }

  if (next.nodeType === "wall") {
    next.start = [next.start[0] + dx, next.start[1] + dz];
    next.end = [next.end[0] + dx, next.end[1] + dz];
    return next;
  }

  if (next.nodeType === "critical_zone" || next.nodeType === "privacy_zone") {
    next.polygon = next.polygon.map(([x, z]) => [x + dx, z + dz]);
    return next;
  }

  if (next.nodeType === "path") {
    next.points = next.points.map((point) => ({
      ...point,
      position: [point.position[0] + dx, point.position[1] + dz] as [number, number],
    }));
    return next;
  }

  return next;
}

function translateNodesInScene(scene: SecurityScene, ids: string[], delta: [number, number]): SecurityScene {
  const next = cloneSecurityScene(scene);
  const idSet = new Set(ids);
  const collections: Array<keyof Pick<SecurityScene, "walls" | "doors" | "windows" | "cameras" | "securityLights" | "obstructions" | "criticalZones" | "privacyZones" | "entryPoints" | "paths">> = [
    "walls",
    "doors",
    "windows",
    "cameras",
    "securityLights",
    "obstructions",
    "criticalZones",
    "privacyZones",
    "entryPoints",
    "paths",
  ];

  collections.forEach((key) => {
    next[key] = next[key].map((node) => (idSet.has(node.id) ? translateNode(node as AnyEditableNode, delta) : node)) as never;
  });

  next.updatedAt = Date.now();
  return next;
}

function cloneAndSetActivePath(scene: SecurityScene, activePathId: string | null): string | null {
  if (!activePathId) return null;
  return scene.paths.some((path) => path.id === activePathId) ? activePathId : null;
}

export function buildGraphState(
  scene: SecurityScene,
  simulationResult: SimulationResult | null,
  revisionDepth = 0,
  snapshotCount = scene.snapshots.length,
  operationalEvidenceEvents: OperationalEvidenceEvent[] = [],
): SceneIntelligenceGraph {
  return buildSceneIntelligenceGraph(scene, {
    simulationResult,
    revisionDepth,
    snapshotCount,
    operationalEvidenceEvents,
  });
}

function evidenceLogLine(event: OperationalEvidenceEvent) {
  const time = new Date(event.timestamp).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
  const confidence = confidenceLabel(event.confidence);
  return `Evidence: ${time} | ${event.title} | ${event.details} | ${confidence}`;
}

function cloneSceneWithChangeLog(scene: SecurityScene, changeLog: string[]) {
  const next = cloneSecurityScene(scene);
  next.changeLog = changeLog;
  return next;
}

function cloneSceneWithAppendedChangeLog(scene: SecurityScene, entry: string) {
  return cloneSceneWithChangeLog(scene, [...scene.changeLog, entry]);
}

function cloneDefaultMapState(): MapState {
  return {
    minimap: { zoom: DEFAULT_MAP_STATE.minimap.zoom, pan: [...DEFAULT_MAP_STATE.minimap.pan] as [number, number] },
    pathMap: { zoom: DEFAULT_MAP_STATE.pathMap.zoom, pan: [...DEFAULT_MAP_STATE.pathMap.pan] as [number, number] },
  };
}

function buildPresetDockLayout(preset: WorkspacePreset): DockSnapshot {
  const layout = getPresetLayoutSnapshot(preset, DEFAULT_LAYERS);
  return { ...layout };
}

function buildLayoutStatePatch(layout: DockSnapshot): Record<string, unknown> {
  return {
    viewMode: layout.viewMode,
    workspacePreset: layout.workspacePreset,
    canvasMode: layout.canvasMode,
    leftDockCollapsed: layout.leftDockCollapsed,
    rightDockCollapsed: layout.rightDockCollapsed,
    bottomDockCollapsed: layout.bottomDockCollapsed,
    leftDockSizePx: layout.leftDockSizePx,
    rightDockSizePx: layout.rightDockSizePx,
    bottomDockSizePx: layout.bottomDockSizePx,
    visibleComponents: { ...layout.visibleComponents },
    enabledAnalysisModules: { ...layout.enabledAnalysisModules },
    rightPanelMode: layout.rightPanelMode,
    bottomDrawerMode: layout.bottomDrawerMode,
    pinnedAnalysisModule: layout.pinnedAnalysisModule,
    overlayDensity: layout.overlayDensity,
    showDebugOverlays: layout.showDebugOverlays,
    clientDemoOptions: { ...layout.clientDemoOptions },
    layerVisibility: { ...layout.layerVisibility },
  };
}

function buildSceneReplacementPatch(
  nextScene: SecurityScene,
  layout: DockSnapshot,
  nextEvents: OperationalEvidenceEvent[],
  nextGovernance: WorkspaceGovernanceState,
  nextCameraId: string | null,
  snapshotCount: number,
  defaultToolOverrides?: { bottomTab?: BottomTab; inspectorTab?: InspectorTab; activeTool?: ActiveTool },
): Record<string, unknown> {
  return {
    scene: cloneSceneWithAppendedChangeLog(nextScene, evidenceLogLine(nextEvents[0]!)),
    snapshots: [],
    simulationResult: null,
    simulationDirty: true,
    selectedNodeId: null,
    selectedNodeIds: [],
    selectedCameraId: nextCameraId,
    activePathId: null,
    focusScenePointRequest: null,
    focusScenePointHighlight: null,
    mapState: cloneDefaultMapState(),
    focusMode: false,
    previousLayout: null,
    ...buildLayoutStatePatch(layout),
    bottomTab: defaultToolOverrides?.bottomTab ?? "metrics",
    inspectorTab: defaultToolOverrides?.inspectorTab ?? "properties",
    activeTool: defaultToolOverrides?.activeTool ?? "select",
    editor: {
      editorMode: "idle",
      draftWallStart: undefined,
      draftPolygonPoints: [],
      draftPathPoints: [],
      hoverPoint: undefined,
      feedbackMessage: null,
      snapEnabled: true,
      snapDistanceM: 0.25,
      gridSnapM: 0.5,
      selectedHandle: undefined,
    },
    historyPast: [],
    historyFuture: [],
    sceneIntelligenceGraph: buildGraphState(nextScene, null, 0, snapshotCount, nextEvents),
    operationalEvidenceEvents: nextEvents,
    workspaceGovernance: nextGovernance,
  };
}

function contextualRightPanelModeForNode(scene: SecurityScene, id: string | null): RightPanelMode {
  const nodeType = resolveSelectedNodeType(scene, id);
  if (!nodeType) return "inspector";
  if (nodeType === "camera") return "camera_controls";
  if (nodeType === "sensor") return "security_status";
  if (nodeType === "path") return "issues";
  if (nodeType === "critical_zone" || nodeType === "privacy_zone") return "issues";
  if (nodeType === "entry_point" || nodeType === "door" || nodeType === "window") return "security_status";
  return "inspector";
}

function contextualBottomTabForNode(scene: SecurityScene, id: string | null): BottomTab | null {
  const nodeType = resolveSelectedNodeType(scene, id);
  if (nodeType === "camera") return "metrics";
  if (nodeType === "path") return "timeline";
  if (nodeType === "sensor") return "sensors";
  if (nodeType === "security_light") return "metrics";
  if (nodeType === "obstruction") return "issues";
  if (nodeType === "critical_zone" || nodeType === "privacy_zone") return "issues";
  if (nodeType === "door" || nodeType === "window" || nodeType === "entry_point") return "threat";
  if (nodeType === "wall") return "assumptions";
  return null;
}

function contextualToolForNode(scene: SecurityScene, id: string | null): ActiveTool | null {
  const nodeType = resolveSelectedNodeType(scene, id);
  if (nodeType === "camera") return "camera";
  if (nodeType === "obstruction") return "obstruction";
  if (nodeType === "security_light") return "light";
  if (nodeType === "sensor") return "sensor";
  if (nodeType === "path") return "path";
  if (nodeType === "critical_zone" || nodeType === "privacy_zone") return "zone";
  if (nodeType === "door" || nodeType === "window") return "door_window";
  if (nodeType === "wall") return "wall";
  if (nodeType === "comment") return "comment";
  return null;
}

function contextualInspectorTabForNode(scene: SecurityScene, id: string | null): InspectorTab | null {
  const nodeType = resolveSelectedNodeType(scene, id);
  if (!nodeType) return null;
  if (nodeType === "camera") return "view";
  if (nodeType === "path") return "analytics";
  if (nodeType === "sensor") return "status";
  if (nodeType === "critical_zone" || nodeType === "privacy_zone") return "failures";
  if (nodeType === "door" || nodeType === "window" || nodeType === "entry_point") return "status";
  if (nodeType === "obstruction" || nodeType === "security_light" || nodeType === "wall") return "properties";
  if (nodeType === "comment") return "history";
  return "properties";
}

function resolveSelectedNodeType(scene: SecurityScene, id: string | null) {
  if (!id) return null;
  if (scene.cameras.some((entry) => entry.id === id)) return "camera";
  if (scene.paths.some((entry) => entry.id === id)) return "path";
  if (scene.sensors.some((entry) => entry.id === id)) return "sensor";
  if (scene.obstructions.some((entry) => entry.id === id)) return "obstruction";
  if (scene.securityLights.some((entry) => entry.id === id)) return "security_light";
  if (scene.walls.some((entry) => entry.id === id)) return "wall";
  if (scene.doors.some((entry) => entry.id === id)) return "door";
  if (scene.windows.some((entry) => entry.id === id)) return "window";
  if (scene.criticalZones.some((entry) => entry.id === id)) return "critical_zone";
  if (scene.privacyZones.some((entry) => entry.id === id)) return "privacy_zone";
  if (scene.entryPoints.some((entry) => entry.id === id)) return "entry_point";
  if (scene.comments.some((entry) => entry.id === id)) return "comment";
  return null;
}

function getFirstEnabledAnalysisTab(enabledAnalysisModules: Record<BottomTab, boolean>, preferred?: BottomTab | null): BottomTab {
  if (preferred && enabledAnalysisModules[preferred]) return preferred;
  return ANALYSIS_TAB_ORDER.find((tab) => enabledAnalysisModules[tab]) ?? "metrics";
}

function buildContextualSelectionPatch(
  state: Record<string, unknown>,
  selectedIds: string[],
): Record<string, unknown> {
  const scene = state.scene as SecurityScene;
  const nextPrimary = primarySelection(selectedIds);
  const contextualTool = contextualToolForNode(scene, nextPrimary);
  const contextualInspectorTab = contextualInspectorTabForNode(scene, nextPrimary);
  const contextualBottomTab = contextualBottomTabForNode(scene, nextPrimary);
  const contextualRightPanelMode = contextualRightPanelModeForNode(scene, nextPrimary);
  const hasSelection = Boolean(nextPrimary);
  const isCameraSelection = hasSelection && scene.cameras.some((camera) => camera.id === nextPrimary);
  const stateSelectedCameraId = state.selectedCameraId as string | null;
  const stateDockAttention = state.dockAttention as Record<string, boolean>;
  const stateRightDockCollapsed = state.rightDockCollapsed as boolean;
  const stateBottomDockCollapsed = state.bottomDockCollapsed as boolean;
  const stateRightPanelMode = state.rightPanelMode as RightPanelMode;
  const stateInspectorTab = state.inspectorTab as InspectorTab;
  const stateBottomTab = state.bottomTab as BottomTab;
  const stateActiveTool = state.activeTool as string;
  const enabledAnalysisModules = state.enabledAnalysisModules as Record<BottomTab, boolean>;

  return {
    selectedNodeIds: selectedIds,
    selectedNodeId: nextPrimary,
    selectedCameraId: isCameraSelection ? nextPrimary : stateSelectedCameraId,
    rightDockCollapsed: hasSelection ? false : stateRightDockCollapsed,
    bottomDockCollapsed: hasSelection ? false : stateBottomDockCollapsed,
    rightPanelMode: hasSelection ? contextualRightPanelMode : stateRightPanelMode,
    inspectorTab: contextualInspectorTab ?? stateInspectorTab,
    bottomTab: hasSelection
      ? getFirstEnabledAnalysisTab(enabledAnalysisModules, contextualBottomTab ?? stateBottomTab)
      : stateBottomTab,
    activeTool: contextualTool ?? (stateActiveTool as ActiveTool),
    dockAttention: hasSelection
      ? {
          ...stateDockAttention,
          right: false,
          bottom: false,
        }
      : stateDockAttention,
  };
}

function findNodeInScene(scene: SecurityScene, id: string): AnyNode | null {
  for (const key of sceneNodeCollectionKeys) {
    const arr = scene[key] as unknown as AnyNode[];
    if (Array.isArray(arr)) {
      const found = arr.find((n: AnyNode) => n.id === id);
      if (found) return found;
    }
  }
  return null;
}

function viewModeToBottomTab(mode: ViewMode): BottomTab {
  switch (mode) {
    case "map":
      return "metrics";
    case "replay":
    case "camera_view":
      return "timeline";
    case "compare":
      return "beforeafter";
    case "report":
      return "report";
    case "wall":
    default:
      return "metrics";
  }
}

function viewModeToPreset(mode: ViewMode): WorkspacePreset {
  const presets: Record<string, WorkspacePreset> = {
    map: "edit",
    wall: "edit",
    replay: "replay",
    camera_view: "edit",
    compare: "compare",
    report: "report",
  };
  return presets[mode] ?? "edit";
}

// ---------------------------------------------------------------------------
// SceneSlice interface
// ---------------------------------------------------------------------------
export interface SceneSlice {
  scene: SecurityScene;
  selectedNodeId: string | null;
  selectedNodeIds: string[];
  selectedCameraId: string | null;
  activeTool: ActiveTool;
  sensorPlacementType: SensorNode["sensorType"];
  editor: EditorDraft;
  cameraPresetId: CameraPresetId | null;
  obstructionPresetId: string;
  customObstructionDimensions: [number, number, number];
  heatmapHover: HeatmapHoverState | null;
  heatmapMode: HeatmapMode;
  environmentMode: "day" | "night" | "dusk";
  criticalZoneTargetType: import("@/schema/security-scene").CriticalZoneNode["targetType"];
  measurementTool: MeasurementToolState;
  commentTool: CommentToolState;
  sceneIntelligenceGraph: SceneIntelligenceGraph;
  historyPast: SecurityScene[];
  historyFuture: SecurityScene[];
  lastRunMs: number | null;
  sceneModified?: boolean;
  savedSceneName?: string | null;
  activePathId: string | null;
  mapState: MapState;
  hoveredMapNodeId: string | null;
  focusScenePointRequest: FocusScenePointRequest | null;
  focusScenePointHighlight: FocusScenePointRequest | null;
  inspectorTab: InspectorTab;

  selectNode: (id: string | null) => void;
  setSelectedNodes: (ids: string[]) => void;
  addSelectedNode: (id: string) => void;
  toggleSelectedNode: (id: string) => void;
  setSelectedCameraId: (id: string | null) => void;
  clearSelection: () => void;
  translateSelectedNodes: (delta: [number, number]) => void;
  removeSelectedNodes: (ids?: string[]) => void;

  addNode: (node: AnyEditableNode) => void;
  updateNode: (id: string, patch: Partial<AnyEditableNode>) => void;
  duplicateNode: (id: string) => void;
  removeNode: (id: string) => void;
  updateAssumptions: (patch: Partial<import("@/schema/security-scene").SimulationAssumptions>) => void;
  updateTimeSchedule: (patch: Partial<import("@/schema/security-scene").TimeSchedule>) => void;
  updateCrowdProfiles: (profiles: import("@/schema/security-scene").CrowdProfile[]) => void;
  addFenceSegment: (fence: import("@/schema/security-scene").FenceSegment) => void;
  updateFenceSegment: (id: string, patch: Partial<import("@/schema/security-scene").FenceSegment>) => void;
  addGateNode: (gate: import("@/schema/security-scene").GateNode) => void;
  updateGateNode: (id: string, patch: Partial<import("@/schema/security-scene").GateNode>) => void;
  addBollardLine: (bollard: import("@/schema/security-scene").BollardLine) => void;
  updateBollardLine: (id: string, patch: Partial<import("@/schema/security-scene").BollardLine>) => void;

  commitSceneChange: (updater: (scene: SecurityScene) => SecurityScene, label?: string) => void;
  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;

  logChange: (entry: string) => void;
  clearChangeLog: () => void;
  importScene: (json: unknown) => { success: boolean; error?: string };
  exportScene: () => SecurityScene;

  setInspectorTab: (tab: InspectorTab) => void;

  setEditorMode: (mode: EditorMode) => void;
  setDraftWallStart: (start?: [number, number]) => void;
  setDraftPolygonPoints: (points: [number, number][]) => void;
  setDraftPathPoints: (points: [number, number][]) => void;
  setEditorHoverPoint: (point?: [number, number]) => void;
  setPlacementAim: (aim?: { anchor: [number, number]; yawDeg: number }) => void;
  setEditorFeedbackMessage: (message: string | null) => void;
  setSnapEnabled: (enabled: boolean) => void;
  setSnapDistanceM: (value: number) => void;
  setGridSnapM: (value: number) => void;
  setSelectedHandle: (handle?: string) => void;

  setActiveTool: (tool: ActiveTool) => void;
  setSensorPlacementType: (sensorType: SensorNode["sensorType"]) => void;
  setCameraPresetId: (presetId: CameraPresetId | null) => void;
  setObstructionPresetId: (presetId: string) => void;
  setCustomObstructionDimensions: (dimensions: [number, number, number]) => void;
  setHeatmapMode: (mode: HeatmapMode) => void;
  setHeatmapHover: (hover: HeatmapHoverState | null) => void;
  setEnvironmentMode: (mode: "day" | "night" | "dusk") => void;
  setCriticalZoneTargetType: (targetType: import("@/schema/security-scene").CriticalZoneNode["targetType"]) => void;
  setAllZoneTargetTypes: (targetType: import("@/schema/security-scene").CriticalZoneNode["targetType"]) => void;
  setMeasurementTool: (tool: Partial<MeasurementToolState>) => void;
  setCommentTool: (tool: Partial<CommentToolState>) => void;
  addComment: (position: [number, number, number], text: string, author?: string, attachedToNodeId?: string | null) => void;
  updateComment: (id: string, patch: Partial<CommentNode>) => void;
  removeComment: (id: string) => void;
  resolveComment: (id: string) => void;

  setMapZoom: (target: "minimap" | "pathMap", zoom: number) => void;
  setMapPan: (target: "minimap" | "pathMap", pan: [number, number]) => void;
  fitMap: (target: "minimap" | "pathMap") => void;
  setHoveredMapNodeId: (id: string | null) => void;
  setFocusScenePointRequest: (request: FocusScenePointRequest | null) => void;
  setFocusScenePointHighlight: (request: FocusScenePointRequest | null) => void;
  setActivePathId: (id: string | null) => void;

  getSelectedCamera: () => CameraNode | null;
  getNodeById: (id: string) => AnyNode | null;
}

// ---------------------------------------------------------------------------
// Slice creator
// ---------------------------------------------------------------------------
export const createSceneSlice = (set: any, get: any): SceneSlice => {
  const scene = createBlankSecurityScene();
  const isBr = typeof window !== "undefined";
  const snapshots: SceneSnapshot[] = [];

  const loadedEvents = (() => {
    try {
      if (typeof window === "undefined") return [] as OperationalEvidenceEvent[];
      const raw = window.localStorage.getItem(OPERATIONAL_EVIDENCE_STORAGE_KEY);
      if (!raw) return [] as OperationalEvidenceEvent[];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed as OperationalEvidenceEvent[] : [];
    } catch { return []; }
  })();

  const seededEvents = (() => {
    if (loadedEvents.length > 0) return loadedEvents;
    const summary = summarizeSceneEvidence(scene);
    const event = buildOperationalEvidenceEvent({
      kind: "scene_initialized",
      title: "Workspace initialized",
      details: `${summary.detail}.`,
      actor: "system",
      source: scene.source,
      sceneId: scene.id,
      sceneName: scene.name,
      revisionDepth: 0,
      affectedNodeIds: [],
      confidence: 0.98,
      afterSummary: summary.detail,
      notes: ["Blank workspace created on first load."],
    });
    if (isBr) persistOperationalEvidenceEvents([event]);
    return [event];
  })();

  const initialGraph = buildGraphState(scene, null, 0, 0, seededEvents);

  return {
  scene,
  selectedNodeId: null,
  selectedNodeIds: [],
  selectedCameraId: null,
  activeTool: "select",
  sensorPlacementType: "motion",
  editor: {
    editorMode: "idle",
    draftWallStart: undefined,
    draftPolygonPoints: [],
    draftPathPoints: [],
    hoverPoint: undefined,
    feedbackMessage: null,
    snapEnabled: true,
    snapDistanceM: 0.25,
    gridSnapM: 0.5,
    selectedHandle: undefined,
  },
  cameraPresetId: null,
  obstructionPresetId: "shelf",
  customObstructionDimensions: [1, 0.5, 1.8],
  heatmapHover: null,
  heatmapMode: "quality",
  environmentMode: "day",
  criticalZoneTargetType: "person_detection",
  measurementTool: { active: false, sourceCameraId: null, targetPoint: null, result: null },
  commentTool: { active: false, position: null, attachedToNodeId: null, draftText: "" },
  sceneIntelligenceGraph: initialGraph,
  historyPast: [],
  historyFuture: [],
  lastRunMs: 0,
  activePathId: null,
  mapState: cloneDefaultMapState(),
  hoveredMapNodeId: null,
  focusScenePointRequest: null,
  focusScenePointHighlight: null,
  inspectorTab: "properties",

  // ===== Selection actions =====

  selectNode: (id) => set((state: Record<string, unknown>) => {
    return buildContextualSelectionPatch(state, id ? [id] : []);
  }),

  setSelectedNodes: (ids) => set((state: Record<string, unknown>) => {
    const scene = state.scene as SecurityScene;
    const next = purgeInvalidSelection(scene, ids);
    return buildContextualSelectionPatch(state, next);
  }),

  addSelectedNode: (id) => set((state: Record<string, unknown>) => {
    const selectedNodeIds = state.selectedNodeIds as string[];
    if (selectedNodeIds.includes(id)) return state;
    const scene = state.scene as SecurityScene;
    const next = purgeInvalidSelection(scene, [...selectedNodeIds, id]);
    return buildContextualSelectionPatch(state, next);
  }),

  toggleSelectedNode: (id) => set((state: Record<string, unknown>) => {
    const selectedNodeIds = state.selectedNodeIds as string[];
    const next = selectedNodeIds.includes(id)
      ? selectedNodeIds.filter((entry) => entry !== id)
      : [...selectedNodeIds, id];
    const scene = state.scene as SecurityScene;
    const filtered = purgeInvalidSelection(scene, next);
    return buildContextualSelectionPatch(state, filtered);
  }),

  setSelectedCameraId: (id) => {
    set((state: Record<string, unknown>) => {
      const scene = state.scene as SecurityScene;
      const isValid = !!id && scene.cameras.some((camera) => camera.id === id);
      if (!isValid || !id) {
        return {
          selectedCameraId: null,
          selectedNodeId: null,
          selectedNodeIds: [],
        };
      }
      const patch = buildContextualSelectionPatch(state, [id]);
      return {
        ...patch,
        selectedCameraId: id,
        inspectorTab: "view",
      };
    });
  },

  clearSelection: () => set({ selectedNodeId: null, selectedNodeIds: [] }),

  translateSelectedNodes: (delta) => {
    const { fixSandboxActive, fixSandboxDraftScene, fixSandboxBaselineScene } = get();
    if (fixSandboxActive && fixSandboxDraftScene) {
      const selectedNodeIds = get().selectedNodeIds as string[];
      if (selectedNodeIds.length === 0) return;
      const patchedDraft = translateNodesInScene(fixSandboxDraftScene, selectedNodeIds, delta);
      let camerasChanged = 0;
      let zonesAffected = 0;
      if (fixSandboxBaselineScene) {
        const baselineCameras = fixSandboxBaselineScene.cameras;
        const draftCameras = patchedDraft.cameras;
        camerasChanged = baselineCameras.filter((c: any, i: number) => {
          const draft = draftCameras[i];
          return draft && JSON.stringify(c) !== JSON.stringify(draft);
        }).length;
        const baselineZones = fixSandboxBaselineScene.criticalZones;
        const draftZones = patchedDraft.criticalZones;
        zonesAffected = baselineZones.filter((z: any, i: number) => {
          const draft = draftZones[i];
          return draft && JSON.stringify(z) !== JSON.stringify(draft);
        }).length;
      }
      set({
        fixSandboxDraftScene: patchedDraft,
        fixSandboxDiff: { camerasChanged, zonesAffected, needsRecompute: true },
        simulationDirty: true,
      });
      persistFixSandboxState(true, fixSandboxBaselineScene!, patchedDraft);
      return;
    }
    const selectedNodeIds = get().selectedNodeIds as string[];
    if (selectedNodeIds.length === 0) return;
    get().commitSceneChange((scene: SecurityScene) => translateNodesInScene(scene, selectedNodeIds, delta));
  },

  removeSelectedNodes: (ids) => {
    const { fixSandboxActive, fixSandboxDraftScene, fixSandboxBaselineScene } = get();
    if (fixSandboxActive && fixSandboxDraftScene) {
      const selectedNodeIds = get().selectedNodeIds as string[];
      const idsToRemove = ids && ids.length > 0 ? ids : selectedNodeIds;
      if (idsToRemove.length === 0) return;
      let patchedDraft = cloneSecurityScene(fixSandboxDraftScene);
      idsToRemove.forEach((removeId) => {
        patchedDraft = removeNodeFromScene(patchedDraft, removeId);
      });
      let camerasChanged = 0;
      let zonesAffected = 0;
      if (fixSandboxBaselineScene) {
        camerasChanged = Math.abs(fixSandboxBaselineScene.cameras.length - patchedDraft.cameras.length);
        zonesAffected = Math.abs(fixSandboxBaselineScene.criticalZones.length - patchedDraft.criticalZones.length);
      }
      set({
        fixSandboxDraftScene: patchedDraft,
        fixSandboxDiff: { camerasChanged, zonesAffected, needsRecompute: true },
        simulationDirty: true,
      });
      persistFixSandboxState(true, fixSandboxBaselineScene!, patchedDraft);
      return;
    }
    const selectedNodeIds = get().selectedNodeIds as string[];
    const idsToRemove = ids && ids.length > 0 ? ids : selectedNodeIds;
    if (idsToRemove.length === 0) return;
    get().commitSceneChange((scene: SecurityScene) => {
      let next = cloneSecurityScene(scene);
      idsToRemove.forEach((id) => {
        next = removeNodeFromScene(next, id);
      });
      return next;
    });
  },

  // ===== Node CRUD =====

  addNode: (node) => {
    const { fixSandboxActive, fixSandboxDraftScene } = get();
    if (fixSandboxActive && fixSandboxDraftScene) {
      const patchedDraft = insertNodeInScene(fixSandboxDraftScene, node);
      const camerasChanged = compareSceneCollections(fixSandboxDraftScene.cameras, patchedDraft.cameras).added.length +
        compareSceneCollections(fixSandboxDraftScene.cameras, patchedDraft.cameras).updated.length;
      const zonesAffected = compareSceneCollections(fixSandboxDraftScene.criticalZones, patchedDraft.criticalZones).added.length +
        compareSceneCollections(fixSandboxDraftScene.criticalZones, patchedDraft.criticalZones).updated.length;
      set({
        fixSandboxDraftScene: patchedDraft,
        fixSandboxDiff: { camerasChanged, zonesAffected, needsRecompute: true },
        simulationDirty: true,
      });
      persistFixSandboxState(true, get().fixSandboxBaselineScene!, patchedDraft);
      return;
    }
    get().commitSceneChange((scene: SecurityScene) => insertNodeInScene(scene, node));
  },

  updateNode: (id, patch) => {
    const { fixSandboxActive, fixSandboxDraftScene, fixSandboxBaselineScene } = get();
    if (fixSandboxActive && fixSandboxDraftScene) {
      const patchedDraft = patchNodeInScene(fixSandboxDraftScene, id, patch);
      let camerasChanged = 0;
      let zonesAffected = 0;
      if (fixSandboxBaselineScene) {
        const baselineCameras = fixSandboxBaselineScene.cameras;
        const draftCameras = patchedDraft.cameras;
        camerasChanged = baselineCameras.filter((c: any, i: number) => {
          const draft = draftCameras[i];
          return draft && JSON.stringify(c) !== JSON.stringify(draft);
        }).length;
        const baselineZones = fixSandboxBaselineScene.criticalZones;
        const draftZones = patchedDraft.criticalZones;
        zonesAffected = baselineZones.filter((z: any, i: number) => {
          const draft = draftZones[i];
          return draft && JSON.stringify(z) !== JSON.stringify(draft);
        }).length;
      }
      set({
        fixSandboxDraftScene: patchedDraft,
        fixSandboxDiff: { camerasChanged, zonesAffected, needsRecompute: true },
        simulationDirty: true,
      });
      persistFixSandboxState(true, fixSandboxBaselineScene!, patchedDraft);
      return;
    }
    get().commitSceneChange((scene: SecurityScene) => patchNodeInScene(scene, id, patch));
  },

  duplicateNode: (id) => {
    const { fixSandboxActive, fixSandboxDraftScene } = get();
    if (fixSandboxActive && fixSandboxDraftScene) {
      const { scene: nextDraft, duplicatedId } = duplicateNodeInScene(fixSandboxDraftScene, id);
      if (!duplicatedId) return;
      const camerasChanged = compareSceneCollections(fixSandboxDraftScene.cameras, nextDraft.cameras).added.length;
      const zonesAffected = compareSceneCollections(fixSandboxDraftScene.criticalZones, nextDraft.criticalZones).added.length;
      set({
        fixSandboxDraftScene: nextDraft,
        fixSandboxDiff: { camerasChanged, zonesAffected, needsRecompute: true },
        simulationDirty: true,
      });
      persistFixSandboxState(true, get().fixSandboxBaselineScene!, nextDraft);
      return;
    }
    const currentScene = get().scene as SecurityScene;
    const selectedNodeIds = get().selectedNodeIds as string[];
    const idsToDuplicate = selectedNodeIds.length > 1 && selectedNodeIds.includes(id)
      ? selectedNodeIds
      : [id];
    const { scene: next, duplicatedIds } = duplicateNodesInScene(currentScene, idsToDuplicate);
    if (duplicatedIds.length === 0) return;
    const evidenceEvent = buildOperationalEvidenceEvent({
      kind: "node_added",
      title: "Node duplicated",
      details: `${duplicatedIds.length} duplicate${duplicatedIds.length === 1 ? "" : "s"} created from the active selection.`,
      actor: "user",
      source: next.source,
      sceneId: next.id,
      sceneName: next.name,
      revisionDepth: (get().historyPast as SecurityScene[]).length + 1,
      affectedNodeIds: duplicatedIds,
      confidence: 0.92,
      beforeSummary: summarizeSceneEvidence(currentScene).detail,
      afterSummary: summarizeSceneEvidence(next).detail,
      sceneSnapshot: cloneSecurityScene(next),
    });
    const nextEvents = [...(get().operationalEvidenceEvents as OperationalEvidenceEvent[]), evidenceEvent];
    persistOperationalEvidenceEvents(nextEvents);
    set((state: Record<string, unknown>) => ({
      simulationDirty: true,
      sceneIntelligenceGraph: buildGraphState(next, state.simulationResult as SimulationResult | null, (state.historyPast as SecurityScene[]).length + 1, (state.snapshots as SceneSnapshot[]).length, state.operationalEvidenceEvents as OperationalEvidenceEvent[]),
      selectedNodeId: duplicatedIds[0] ?? null,
      selectedNodeIds: duplicatedIds,
      activePathId: cloneAndSetActivePath(next, state.activePathId as string | null),
      historyPast: [...(state.historyPast as SecurityScene[]), cloneSecurityScene(state.scene as SecurityScene)],
      historyFuture: [],
      operationalEvidenceEvents: nextEvents,
      scene: {
        ...next,
        changeLog: [...next.changeLog, evidenceLogLine(evidenceEvent)],
      },
    }));
  },

  removeNode: (id) => {
    const { fixSandboxActive, fixSandboxDraftScene, fixSandboxBaselineScene } = get();
    if (fixSandboxActive && fixSandboxDraftScene) {
      const patchedDraft = removeNodeFromScene(fixSandboxDraftScene, id);
      let camerasChanged = 0;
      let zonesAffected = 0;
      if (fixSandboxBaselineScene) {
        const baselineCameras = fixSandboxBaselineScene.cameras;
        const draftCameras = patchedDraft.cameras;
        camerasChanged = Math.abs(baselineCameras.length - draftCameras.length);
        const baselineZones = fixSandboxBaselineScene.criticalZones;
        const draftZones = patchedDraft.criticalZones;
        zonesAffected = Math.abs(baselineZones.length - draftZones.length);
      }
      set({
        fixSandboxDraftScene: patchedDraft,
        fixSandboxDiff: { camerasChanged, zonesAffected, needsRecompute: true },
        simulationDirty: true,
      });
      persistFixSandboxState(true, fixSandboxBaselineScene!, patchedDraft);
      return;
    }
    get().commitSceneChange((scene: SecurityScene) => removeNodeFromScene(scene, id));
  },

  updateAssumptions: (patch) => {
    const { fixSandboxActive, fixSandboxDraftScene, fixSandboxBaselineScene } = get();
    if (fixSandboxActive && fixSandboxDraftScene) {
      const patchedDraft = cloneSecurityScene(fixSandboxDraftScene);
      patchedDraft.assumptions = { ...patchedDraft.assumptions, ...patch };
      set({
        fixSandboxDraftScene: patchedDraft,
        fixSandboxDiff: { ...get().fixSandboxDiff, needsRecompute: true },
        simulationDirty: true,
      });
      persistFixSandboxState(true, fixSandboxBaselineScene!, patchedDraft);
      return;
    }
    get().commitSceneChange((scene: SecurityScene) => ({
      ...scene,
      assumptions: {
        ...scene.assumptions,
        ...patch,
      },
    }));
  },

  updateTimeSchedule: (patch) => {
    get().commitSceneChange((scene: SecurityScene) => ({
      ...scene,
      timeSchedule: {
        interiorLightSchedule: [],
        exteriorLightSchedule: [],
        doorLockSchedule: [],
        occupancySchedule: [],
        guardPatrolSchedule: [],
        ...scene.timeSchedule,
        ...patch,
      },
    }));
  },

  updateCrowdProfiles: (profiles) => {
    get().commitSceneChange((scene: SecurityScene) => ({
      ...scene,
      crowdProfiles: profiles,
    }));
  },

  addFenceSegment: (fence) => {
    get().commitSceneChange((scene: SecurityScene) => ({
      ...scene,
      fenceSegments: [...(scene.fenceSegments ?? []), fence],
    }));
  },
  updateFenceSegment: (id, patch) => {
    get().commitSceneChange((scene: SecurityScene) => ({
      ...scene,
      fenceSegments: (scene.fenceSegments ?? []).map((f) => f.id === id ? { ...f, ...patch } : f),
    }));
  },
  addGateNode: (gate) => {
    get().commitSceneChange((scene: SecurityScene) => ({
      ...scene,
      gateNodes: [...(scene.gateNodes ?? []), gate],
    }));
  },
  updateGateNode: (id, patch) => {
    get().commitSceneChange((scene: SecurityScene) => ({
      ...scene,
      gateNodes: (scene.gateNodes ?? []).map((g) => g.id === id ? { ...g, ...patch } : g),
    }));
  },
  addBollardLine: (bollard) => {
    get().commitSceneChange((scene: SecurityScene) => ({
      ...scene,
      bollardLines: [...(scene.bollardLines ?? []), bollard],
    }));
  },
  updateBollardLine: (id, patch) => {
    get().commitSceneChange((scene: SecurityScene) => ({
      ...scene,
      bollardLines: (scene.bollardLines ?? []).map((b) => b.id === id ? { ...b, ...patch } : b),
    }));
  },

  // ===== History / Undo / Redo =====

  commitSceneChange: (updater, label) =>
    set((s: Record<string, unknown>) => {
      void label;
      const scene = s.scene as SecurityScene;
      const before = cloneSecurityScene(scene);
      const nextRaw = updater(cloneSecurityScene(scene));
      const next = validateSceneGeometry(nextRaw);
      const sensorMutation = detectSensorMutation(before, next);
      const operationalEvidenceEvents = s.operationalEvidenceEvents as OperationalEvidenceEvent[];
      const historyPast = s.historyPast as SecurityScene[];
      const snapshots = s.snapshots as SceneSnapshot[];
      const simulationResult = s.simulationResult as SimulationResult | null;
      const workspaceGovernance = s.workspaceGovernance as WorkspaceGovernanceState;
      const evidenceEvent = buildOperationalEvidenceEvent({
        kind: sensorMutation?.kind ?? "scene_updated",
        title: label ?? (sensorMutation ? kindToTitle(sensorMutation.kind) : "Scene updated"),
        details: label ?? (sensorMutation ? "Sensor inventory changed" : "Scene structure changed"),
        actor: "user",
        source: next.source,
        sceneId: next.id,
        sceneName: next.name,
        revisionDepth: historyPast.length + 1,
        affectedNodeIds: sensorMutation?.affectedNodeIds ?? [],
        confidence: sensorMutation ? 0.94 : 0.95,
        beforeSummary: summarizeSceneEvidence(before).detail,
        afterSummary: summarizeSceneEvidence(next).detail,
        previousSceneSnapshot: cloneSecurityScene(before),
        sceneSnapshot: cloneSecurityScene(next),
        notes: label ? [label] : sensorMutation ? ["Sensor-only scene change captured as a dedicated evidence event."] : undefined,
      });
      const nextEvents = [...operationalEvidenceEvents, evidenceEvent];
      persistOperationalEvidenceEvents(nextEvents);
      const nextGovernance = resetWorkspaceGovernanceForDraft(workspaceGovernance);
      persistWorkspaceGovernanceLocal(nextGovernance);
      return {
        simulationDirty: true,
        sceneIntelligenceGraph: buildGraphState(next, simulationResult, historyPast.length + 1, snapshots.length, operationalEvidenceEvents),
        ...setSelectionState(next, s.selectedNodeIds as string[]),
        activePathId: cloneAndSetActivePath(next, s.activePathId as string | null),
        historyPast: [...historyPast, cloneSecurityScene(scene)],
        historyFuture: [],
        operationalEvidenceEvents: nextEvents,
        workspaceGovernance: nextGovernance,
        scene: {
          ...next,
          changeLog: [...next.changeLog, evidenceLogLine(evidenceEvent)],
        },
      };
    }),

  undo: () => set((s: Record<string, unknown>) => {
    const historyPast = s.historyPast as SecurityScene[];
    if (historyPast.length === 0) return s;
    const previous = historyPast[historyPast.length - 1];
    if (!previous) return s;
    const scene = s.scene as SecurityScene;
    const operationalEvidenceEvents = s.operationalEvidenceEvents as OperationalEvidenceEvent[];
    const simulationResult = s.simulationResult as SimulationResult | null;
    const snapshots = s.snapshots as SceneSnapshot[];
    const workspaceGovernance = s.workspaceGovernance as WorkspaceGovernanceState;
    const evidenceEvent = buildOperationalEvidenceEvent({
      kind: "scene_reverted",
      title: "Undo scene change",
      details: "Returned to the previous scene state.",
      actor: "user",
      source: previous.source,
      sceneId: previous.id,
      sceneName: previous.name,
      revisionDepth: Math.max(historyPast.length - 1, 0),
      affectedNodeIds: [],
      confidence: 0.9,
      beforeSummary: summarizeSceneEvidence(scene).detail,
      afterSummary: summarizeSceneEvidence(previous).detail,
      previousSceneSnapshot: cloneSecurityScene(scene),
      sceneSnapshot: cloneSecurityScene(previous),
      notes: ["Undo surfaced as an evidence event so the site history remains legible."],
    });
    const nextEvents = [...operationalEvidenceEvents, evidenceEvent];
    persistOperationalEvidenceEvents(nextEvents);
    const nextGovernance = resetWorkspaceGovernanceForDraft(workspaceGovernance);
    persistWorkspaceGovernanceLocal(nextGovernance);
    return {
      activePathId: cloneAndSetActivePath(previous, s.activePathId as string | null),
      ...setSelectionState(previous, s.selectedNodeIds as string[]),
      simulationDirty: true,
      sceneIntelligenceGraph: buildGraphState(previous, simulationResult, historyPast.length - 1, snapshots.length, operationalEvidenceEvents),
      historyPast: historyPast.slice(0, -1),
      historyFuture: [cloneSecurityScene(scene), ...(s.historyFuture as SecurityScene[])],
      operationalEvidenceEvents: nextEvents,
      workspaceGovernance: nextGovernance,
      scene: {
        ...cloneSecurityScene(previous),
        changeLog: [...previous.changeLog, evidenceLogLine(evidenceEvent)],
      },
    };
  }),

  redo: () => set((s: Record<string, unknown>) => {
    const historyFuture = s.historyFuture as SecurityScene[];
    if (historyFuture.length === 0) return s;
    const nextScene = historyFuture[0];
    if (!nextScene) return s;
    const scene = s.scene as SecurityScene;
    const historyPast = s.historyPast as SecurityScene[];
    const operationalEvidenceEvents = s.operationalEvidenceEvents as OperationalEvidenceEvent[];
    const simulationResult = s.simulationResult as SimulationResult | null;
    const snapshots = s.snapshots as SceneSnapshot[];
    const workspaceGovernance = s.workspaceGovernance as WorkspaceGovernanceState;
    const evidenceEvent = buildOperationalEvidenceEvent({
      kind: "scene_reverted",
      title: "Redo scene change",
      details: "Restored the next scene state from history.",
      actor: "user",
      source: nextScene.source,
      sceneId: nextScene.id,
      sceneName: nextScene.name,
      revisionDepth: historyPast.length + 1,
      affectedNodeIds: [],
      confidence: 0.9,
      beforeSummary: summarizeSceneEvidence(scene).detail,
      afterSummary: summarizeSceneEvidence(nextScene).detail,
      previousSceneSnapshot: cloneSecurityScene(scene),
      sceneSnapshot: cloneSecurityScene(nextScene),
      notes: ["Redo surfaced as an evidence event so the site history remains legible."],
    });
    const nextEvents = [...operationalEvidenceEvents, evidenceEvent];
    persistOperationalEvidenceEvents(nextEvents);
    const nextGovernance = resetWorkspaceGovernanceForDraft(workspaceGovernance);
    persistWorkspaceGovernanceLocal(nextGovernance);
    return {
      activePathId: cloneAndSetActivePath(nextScene, s.activePathId as string | null),
      ...setSelectionState(nextScene, s.selectedNodeIds as string[]),
      simulationDirty: true,
      sceneIntelligenceGraph: buildGraphState(nextScene, simulationResult, historyPast.length + 1, snapshots.length, operationalEvidenceEvents),
      historyPast: [...historyPast, cloneSecurityScene(scene)],
      historyFuture: historyFuture.slice(1),
      operationalEvidenceEvents: nextEvents,
      workspaceGovernance: nextGovernance,
      scene: {
        ...cloneSecurityScene(nextScene),
        changeLog: [...nextScene.changeLog, evidenceLogLine(evidenceEvent)],
      },
    };
  }),

  canUndo: () => {
    return (get().historyPast as SecurityScene[]).length > 0;
  },

  canRedo: () => {
    return (get().historyFuture as SecurityScene[]).length > 0;
  },

  logChange: (entry) =>
    set((state: Record<string, unknown>) => ({
      scene: cloneSceneWithAppendedChangeLog(state.scene as SecurityScene, entry),
    })),

  clearChangeLog: () =>
    set((state: Record<string, unknown>) => ({
      scene: cloneSceneWithChangeLog(state.scene as SecurityScene, []),
    })),

  importScene: (json) => {
    const startedAt = performance.now();
    const result = safeParseSecurityScene(json);
    if (!result.success) {
      const runtimeIncidents = get().runtimeIncidents;
      if (Array.isArray(runtimeIncidents)) {
        // silently handle - can't call recordRuntimeIncident without full access
      }
      return { success: false, error: result.error.issues.map((i: any) => i.message).join(", ") };
    }
    const scene = cloneSecurityScene(result.data);
    const layout = buildPresetDockLayout("edit");
    const evidenceEvent = buildOperationalEvidenceEvent({
      kind: scene.source === "scan" ? "scan_compiled" : "scene_imported",
      title: scene.source === "scan" ? "Scan compiled into scene" : "Scene imported",
      details: `Loaded ${scene.name || "Untitled Scene"} from ${scene.source}.`,
      actor: "system",
      source: scene.source,
      sceneId: scene.id,
      sceneName: scene.name,
      revisionDepth: 0,
      affectedNodeIds: [],
      confidence: 0.98,
      afterSummary: summarizeSceneEvidence(scene).detail,
      sceneSnapshot: cloneSecurityScene(scene),
    });
    const nextEvents = [evidenceEvent];
    persistOperationalEvidenceEvents(nextEvents);
    const durationMs = Math.round(performance.now() - startedAt);
    const nextGovernance = resetWorkspaceGovernanceForDraft(get().workspaceGovernance as WorkspaceGovernanceState);
    persistWorkspaceGovernanceLocal(nextGovernance);
    const nextCameraId = scene.cameras[0]?.id ?? null;
    set(() => ({
      snapshots: scene.snapshots,
      historyPast: [],
      historyFuture: [],
      selectedNodeId: null,
      selectedNodeIds: [],
      selectedCameraId: nextCameraId,
      editor: {
        editorMode: "idle" as EditorMode,
        draftWallStart: undefined,
        draftPolygonPoints: [],
        draftPathPoints: [],
        hoverPoint: undefined,
        feedbackMessage: null,
        snapEnabled: true,
        snapDistanceM: 0.25,
        gridSnapM: 0.5,
        selectedHandle: undefined,
      },
      simulationDirty: true,
      simulationResult: null,
      activePathId: null,
      focusScenePointRequest: null,
      focusScenePointHighlight: null,
      mapState: cloneDefaultMapState(),
      focusMode: false,
      previousLayout: null,
      ...buildSceneReplacementPatch(scene, layout, nextEvents, nextGovernance, nextCameraId, scene.snapshots.length),
      scene: cloneSceneWithAppendedChangeLog(scene, evidenceLogLine(evidenceEvent)),
    }));
    return { success: true };
  },

  exportScene: () => cloneSecurityScene(get().scene as SecurityScene),

  // ===== Inspector =====

  setInspectorTab: (tab) => set({ inspectorTab: tab }),

  // ===== Editor draft =====

  setEditorMode: (mode) => set((s: Record<string, unknown>) => ({
    editor: {
      ...(s.editor as EditorDraft),
      editorMode: mode,
    },
  })),

  setDraftWallStart: (start) => set((s: Record<string, unknown>) => ({
    editor: { ...(s.editor as EditorDraft), editorMode: start ? "drawing_wall" : (s.editor as EditorDraft).editorMode, draftWallStart: start },
  })),

  setDraftPolygonPoints: (points) => set((s: Record<string, unknown>) => ({
    editor: { ...(s.editor as EditorDraft), editorMode: points.length ? "drawing_polygon" : (s.editor as EditorDraft).editorMode, draftPolygonPoints: points },
  })),

  setDraftPathPoints: (points) => set((s: Record<string, unknown>) => ({
    editor: { ...(s.editor as EditorDraft), editorMode: points.length ? "drawing_path" : (s.editor as EditorDraft).editorMode, draftPathPoints: points },
  })),

  setEditorHoverPoint: (point) => set((s: Record<string, unknown>) => ({ editor: { ...(s.editor as EditorDraft), hoverPoint: point } })),

  setPlacementAim: (aim) => set((s: Record<string, unknown>) => ({ editor: { ...(s.editor as EditorDraft), placementAim: aim } })),

  setEditorFeedbackMessage: (message) => set((s: Record<string, unknown>) => ({ editor: { ...(s.editor as EditorDraft), feedbackMessage: message } })),

  setSnapEnabled: (enabled) => set((s: Record<string, unknown>) => ({ editor: { ...(s.editor as EditorDraft), snapEnabled: enabled } })),

  setSnapDistanceM: (value) => set((s: Record<string, unknown>) => ({ editor: { ...(s.editor as EditorDraft), snapDistanceM: value } })),

  setGridSnapM: (value) => set((s: Record<string, unknown>) => ({ editor: { ...(s.editor as EditorDraft), gridSnapM: value } })),

  setSelectedHandle: (handle) => set((s: Record<string, unknown>) => ({ editor: { ...(s.editor as EditorDraft), selectedHandle: handle } })),

  // ===== Tools =====

  setActiveTool: (tool) => set((s: Record<string, unknown>) => ({
    activeTool: tool,
    dockAttention: (s.leftDockCollapsed as boolean) ? { ...(s.dockAttention as Record<string, boolean>), left: true } : s.dockAttention,
    editor: {
      ...(s.editor as EditorDraft),
      editorMode: "idle" as EditorMode,
      draftWallStart: undefined,
      draftPolygonPoints: [],
      draftPathPoints: [],
      hoverPoint: undefined,
      placementAim: undefined,
      feedbackMessage: null,
      selectedHandle: undefined,
    },
  })),

  setSensorPlacementType: (sensorPlacementType) => set({ sensorPlacementType }),

  setCameraPresetId: (presetId) => set({ cameraPresetId: presetId }),

  setObstructionPresetId: (presetId) => set({ obstructionPresetId: presetId }),

  setCustomObstructionDimensions: (dimensions) => set({ customObstructionDimensions: dimensions }),

  setHeatmapMode: (mode) => set({ heatmapMode: mode }),

  setHeatmapHover: (hover) => set({ heatmapHover: hover }),

  setEnvironmentMode: (mode) => set({ environmentMode: mode }),
  setCriticalZoneTargetType: (targetType) => set({ criticalZoneTargetType: targetType }),
  setAllZoneTargetTypes: (targetType) => set({ criticalZoneTargetType: targetType }),

  setMeasurementTool: (patch) =>
    set((s: Record<string, unknown>) => ({ measurementTool: { ...(s.measurementTool as MeasurementToolState), ...patch } })),

  setCommentTool: (patch) =>
    set((s: Record<string, unknown>) => ({ commentTool: { ...(s.commentTool as CommentToolState), ...patch } })),

  addComment: (position, text, author = "Operator", attachedToNodeId = null) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    get().commitSceneChange((scene: SecurityScene) => {
      const next = cloneSecurityScene(scene);
      next.comments.push({
        id: `comment_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
        nodeType: "comment",
        label: "Comment",
        position,
        text: trimmed,
        author,
        createdAt: Date.now(),
        resolved: false,
        attachedToNodeId,
        source: "manual",
        reviewStatus: "unreviewed",
        sourceTrace: "",
        geometryValidity: "valid",
      });
      next.updatedAt = Date.now();
      return next;
    });
  },

  updateComment: (id, patch) => {
    get().commitSceneChange((scene: SecurityScene) => {
      const next = cloneSecurityScene(scene);
      const index = next.comments.findIndex((comment) => comment.id === id);
      if (index === -1) return next;
      next.comments[index] = { ...next.comments[index], ...patch };
      next.updatedAt = Date.now();
      return next;
    });
  },

  removeComment: (id) => {
    get().commitSceneChange((scene: SecurityScene) => {
      const next = cloneSecurityScene(scene);
      const countBefore = next.comments.length;
      next.comments = next.comments.filter((comment) => comment.id !== id);
      if (next.comments.length !== countBefore) next.updatedAt = Date.now();
      return next;
    });
  },

  resolveComment: (id) => {
    get().commitSceneChange((scene: SecurityScene) => {
      const next = cloneSecurityScene(scene);
      const index = next.comments.findIndex((comment) => comment.id === id);
      if (index === -1) return next;
      next.comments[index] = { ...next.comments[index], resolved: true };
      next.updatedAt = Date.now();
      return next;
    });
  },

  // ===== Map =====

  setMapZoom: (target, zoom) => {
    const nextZoom = Math.max(0.05, Math.min(6, zoom));
    if (target === "minimap") {
      set((state: Record<string, unknown>) => ({ mapState: { ...(state.mapState as MapState), minimap: { ...(state.mapState as MapState).minimap, zoom: nextZoom } } }));
      return;
    }
    set((state: Record<string, unknown>) => ({ mapState: { ...(state.mapState as MapState), pathMap: { ...(state.mapState as MapState).pathMap, zoom: nextZoom } } }));
  },

  setMapPan: (target, pan) => {
    const nextPan = [pan[0], pan[1]] as [number, number];
    if (target === "minimap") {
      set((state: Record<string, unknown>) => ({ mapState: { ...(state.mapState as MapState), minimap: { ...(state.mapState as MapState).minimap, pan: nextPan } } }));
      return;
    }
    set((state: Record<string, unknown>) => ({ mapState: { ...(state.mapState as MapState), pathMap: { ...(state.mapState as MapState).pathMap, pan: nextPan } } }));
  },

  fitMap: (target) => {
    if (target === "minimap") {
      set((state: Record<string, unknown>) => ({ mapState: { ...(state.mapState as MapState), minimap: { zoom: 1, pan: [0, 0] } } }));
      return;
    }
    set((state: Record<string, unknown>) => ({ mapState: { ...(state.mapState as MapState), pathMap: { zoom: 1, pan: [0, 0] } } }));
  },

  setHoveredMapNodeId: (id) => set({ hoveredMapNodeId: id }),

  setFocusScenePointRequest: (request) => set({ focusScenePointRequest: request }),

  setFocusScenePointHighlight: (request) => set({ focusScenePointHighlight: request }),

  setActivePathId: (id) => set({ activePathId: id }),

  // ===== Helpers =====

  getSelectedCamera: () => {
    const state = get();
    const scene = state.scene as SecurityScene;
    const selectedNodeId = state.selectedNodeId as string | null;
    const selectedCameraId = state.selectedCameraId as string | null;
    if (selectedNodeId) {
      const selectedNodeCamera = scene.cameras.find((c) => c.id === selectedNodeId);
      if (selectedNodeCamera) return selectedNodeCamera;
    }
    if (selectedCameraId) {
      const selectedById = scene.cameras.find((c) => c.id === selectedCameraId);
      if (selectedById) return selectedById;
    }
    return scene.cameras[0] ?? null;
  },

  getNodeById: (id) => {
    const scene = get().scene as SecurityScene;
    return findNodeInScene(scene, id);
  },
};
};
