import { create } from "zustand";

// ─── Slice creators ───────────────────────────────────────────────────────────
import { createSceneSlice } from "./slices/scene-slice";
import { createSimulationSlice } from "./slices/simulation-slice";
import { createLayoutSlice } from "./slices/layout-slice";
import { createWorkflowSlice } from "./slices/workflow-slice";
import { createGovernanceSlice } from "./slices/governance-slice";
import { createTelemetrySlice } from "./slices/telemetry-slice";

// ─── Re-export slice types (preserve external API surface) ────────────────────

// Layout types
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
} from "./slices/layout-slice";

// Scene types
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
} from "./slices/scene-slice";

// Workflow types
export type {
  ActiveWorkflowId,
  ProductArea,
} from "./slices/workflow-slice";
export { formatProductArea, WORKFLOW_STEPS } from "./slices/workflow-slice";

// Telemetry types
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
  AiActionTelemetryStage,
  PromptRegistryHistorySource,
  PromptRegistryHistoryRecord,
  AiProviderGovernanceHistorySource,
  AiProviderGovernanceHistoryRecord,
  AiActionTelemetryRecord,
} from "./slices/telemetry-slice";
export { createRuntimeIncident } from "./slices/telemetry-slice";

// ─── Types kept in studio-store (not owned by any slice) ──────────────────────

export type { ArchiveHandoffRequest } from "@/lib/archive-handoff-link";
export type ArchiveHandoffState = import("@/lib/archive-handoff-link").ArchiveHandoffRequest | null;
export type ArchiveRestoreContext = {
  archiveExportedAt?: string;
  archiveRestoreBranch?: "draft" | "recovered" | "published";
};

export type TimelineFocusRequest = {
  timestamp: number;
  query?: string | null;
  branchLabel?: string | null;
  eventId?: string | null;
  provenanceNodeId?: string | null;
  provenanceEdgeId?: string | null;
  source?: "launcher" | "scene" | "debug" | "report";
};

export type SavedProjectRecord = {
  scene: import("@/schema/security-scene").SecurityScene;
  folder: string;
  tags: string[];
  pinned: boolean;
  workspaceOrganization: string;
  workspaceOwner: string;
  workspaceVisibility: "private" | "shared" | "published";
  createdAt: number;
  updatedAt: number;
  lastOpenedAt: number | null;
};

export const OPERATIONAL_EVIDENCE_STORAGE_KEY = "sentineltwin_operational_evidence_v1";

// ─── Combined store type ──────────────────────────────────────────────────────

import type { SceneSlice } from "./slices/scene-slice";
import type { SimulationSlice } from "./slices/simulation-slice";
import type { LayoutSlice } from "./slices/layout-slice";
import type { WorkflowSlice } from "./slices/workflow-slice";
import type { GovernanceSlice } from "./slices/governance-slice";
import type { TelemetrySlice } from "./slices/telemetry-slice";

export type StudioStoreState = SceneSlice & SimulationSlice & LayoutSlice & WorkflowSlice & GovernanceSlice & TelemetrySlice;

// ─── Store composition ────────────────────────────────────────────────────────

export const useStudioStore = create<StudioStoreState>()((set, get, store) => ({
  ...createSceneSlice(set, get),
  ...createSimulationSlice(set, get),
  ...createLayoutSlice(set, get, store),
  ...createWorkflowSlice(set, get),
  ...createGovernanceSlice(set, get),
  ...createTelemetrySlice(set, get),
}));
