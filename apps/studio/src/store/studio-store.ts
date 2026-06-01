import { create } from "zustand";

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

export type StudioStoreState =
  & SceneSlice
  & SimulationSlice
  & LayoutSlice
  & SnapshotSlice
  & ReplaySlice
  & ComparisonSlice
  & WorkflowSlice
  & GovernanceSlice
  & TelemetrySlice;

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
}));
