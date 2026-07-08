import { create } from "zustand";
import { useMemo } from "react";
import type { SecurityScene } from "@/schema/security-scene";

// ─── Slice creators ───────────────────────────────────────────────────────────
import {
  createSceneSlice,
  createSimulationSlice,
  createLayoutSlice,
  createWorkflowSlice,
  createGovernanceSlice,
  createTelemetrySlice,
  createSnapshotSlice,
  createReplaySlice,
  createComparisonSlice,
  createDebugTogglesSlice,
} from "./slices";

// ─── Shared types ─────────────────────────────────────────────────────────────
export type {
  SavedProjectRecord,
  ProjectMetadata,
  TimelineFocusRequest,
  ArchiveHandoffState,
  ArchiveRestoreContext,
  ArchiveHandoffRequest,
} from "./studio-types";
export { OPERATIONAL_EVIDENCE_STORAGE_KEY } from "./studio-types";

// ─── Re-export all slice types (preserve external API surface) ────────────────
// Core layout types
export type {
  ViewMode,
  CanvasMode,
  DockSide,
  RightPanelMode,
  BottomDrawerMode,
  WorkspacePreset,
  WorkspaceComponentId,
  BottomTab,
  OverlayDensity,
  UiDensity,
  UiTheme,
  OverlayFilterId,
  OverlayFilters,
  LayerId,
  LayerVisibility,
} from "./slices/core/layout-slice";

// Core scene types
export type {
  ActiveTool,
  EditorMode,
  EditorDraft,
  InspectorTab,
  HeatmapMode,
  HeatmapHoverState,
  CommentToolState,
  MeasurementToolState,
  FocusScenePointRequest,
  MapViewportState,
  MapState,
} from "./slices/core/scene-slice";

// Enterprise workflow types
export type {
  ActiveWorkflowId,
  ProductArea,
} from "./slices/enterprise/workflow-slice";
export { formatProductArea, WORKFLOW_STEPS } from "./slices/enterprise/workflow-slice";

// Enterprise telemetry types
export type {
  AiActionTelemetryStage,
  RuntimeIncidentCategory,
  RuntimeIncidentSeverity,
  RuntimeIncident,
  RuntimeIncidentInput,
  SensorLiveEventKind,
  SensorLiveEventRecord,
  SensorLiveEventInput,
  CameraMetadataEventRecord,
  CameraMetadataEventInput,
  CameraLiveConnectionEventRecord,
  CameraLiveConnectionEventInput,
  ExternalLogEntrySource,
  ExternalLogEntrySeverity,
  ExternalLogEntry,
  ExternalLogEntryInput,
  PromptRegistryHistorySource,
  PromptRegistryHistoryRecord,
  AiProviderGovernanceHistorySource,
  AiProviderGovernanceHistoryRecord,
  AiActionTelemetryRecord,
} from "./slices/enterprise/telemetry-slice";
export { createRuntimeIncident } from "./slices/enterprise/telemetry-slice";

// ─── Combined store type ──────────────────────────────────────────────────────

import type { SceneSlice } from "./slices/core/scene-slice";
import type { SimulationSlice } from "./slices/core/simulation-slice";
import type { LayoutSlice } from "./slices/core/layout-slice";
import type { SnapshotSlice } from "./slices/core/snapshot-slice";
import type { ReplaySlice } from "./slices/core/replay-slice";
import type { ComparisonSlice } from "./slices/core/comparison-slice";
import type { WorkflowSlice } from "./slices/enterprise/workflow-slice";
import type { GovernanceSlice } from "./slices/enterprise/governance-slice";
import type { TelemetrySlice } from "./slices/enterprise/telemetry-slice";
import type { DebugTogglesSlice } from "./slices/core/debug-toggles-slice";

export type StudioStoreState =
  & SceneSlice
  & SimulationSlice
  & LayoutSlice
  & SnapshotSlice
  & ReplaySlice
  & ComparisonSlice
  & WorkflowSlice
  & GovernanceSlice
  & TelemetrySlice
  & DebugTogglesSlice;

// ─── Store composition ────────────────────────────────────────────────────────
// Spread order: general defaults first, specific overrides later.
// New slices define default initializers; scene-slice overrides snapshots with
// demo data via spread ordering.

export const useStudioStore = create<StudioStoreState>()((set, get, store) => ({
  ...createSnapshotSlice(set, get),
  ...createReplaySlice(set, get),
  ...createComparisonSlice(set, get),
  ...createSceneSlice(set, get),
  ...createSimulationSlice(set, get),
  ...createLayoutSlice(set, get, store),
  ...createWorkflowSlice(set, get),
  ...createGovernanceSlice(set, get),
  ...createTelemetrySlice(set, get),
  ...createDebugTogglesSlice(set, get),
}));

/**
 * Returns the canonical SecurityScene filtered according to the current multi-floor
 * level display mode (Stacked vs Solo) and activeLevelId.
 * When in "solo" mode with an activeLevelId selected, nodes not belonging to that level
 * (or without a levelId assigned) are filtered out.
 */
export function useFilteredScene(): SecurityScene {
  const scene = useStudioStore((s) => s.scene);
  const activeLevelId = useStudioStore((s) => s.activeLevelId);
  const levelDisplayMode = useStudioStore((s) => s.levelDisplayMode);

  return useMemo(() => {
    if (levelDisplayMode !== "solo" || activeLevelId === null) return scene;
    const filterFn = <T extends { levelId?: string }>(items: T[]) =>
      items.filter((item) => !item.levelId || item.levelId === activeLevelId);
    return {
      ...scene,
      walls: filterFn(scene.walls),
      doors: filterFn(scene.doors),
      windows: filterFn(scene.windows),
      cameras: filterFn(scene.cameras),
      securityLights: filterFn(scene.securityLights),
      sensors: filterFn(scene.sensors),
      obstructions: filterFn(scene.obstructions),
      criticalZones: filterFn(scene.criticalZones),
      privacyZones: filterFn(scene.privacyZones),
      paths: filterFn(scene.paths),
      comments: filterFn(scene.comments),
    };
  }, [scene, activeLevelId, levelDisplayMode]);
}

// Dev-only debugging handle: lets DevTools / automated QA read and drive the
// canonical store without going through the UI. Stripped from production.
if (typeof window !== "undefined" && process.env.NODE_ENV !== "production") {
  (window as unknown as Record<string, unknown>).__SENTINEL_STUDIO_STORE__ = useStudioStore;
}
