// ─── Slice type re-exports ───────────────────────────────────────────────────
// This is the canonical import surface for all slice types.
// The barrel (studio-store.ts) re-exports from here so 116+ importing
// components never need to know about slice file locations.
//
// Core slices — simulation-hot-path state and actions
export type { SceneSlice } from "./core/scene-slice";
export type { SimulationSlice } from "./core/simulation-slice";
export type { LayoutSlice } from "./core/layout-slice";
export type { SnapshotSlice } from "./core/snapshot-slice";
export type { ReplaySlice } from "./core/replay-slice";
export type { ComparisonSlice } from "./core/comparison-slice";
export type { DebugTogglesSlice } from "./core/debug-toggles-slice";

export { createSceneSlice } from "./core/scene-slice";
export { createSimulationSlice } from "./core/simulation-slice";
export { createLayoutSlice } from "./core/layout-slice";
export { createSnapshotSlice } from "./core/snapshot-slice";
export { createReplaySlice } from "./core/replay-slice";
export { createComparisonSlice } from "./core/comparison-slice";
export { createDebugTogglesSlice, DEBUG_TOGGLE_KEYS, DEBUG_TOGGLE_LABELS } from "./core/debug-toggles-slice";

// Enterprise slices — governance, compliance, telemetry
export type { WorkflowSlice } from "./enterprise/workflow-slice";
export type { GovernanceSlice } from "./enterprise/governance-slice";
export type { TelemetrySlice } from "./enterprise/telemetry-slice";

export { createWorkflowSlice } from "./enterprise/workflow-slice";
export { createGovernanceSlice } from "./enterprise/governance-slice";
export { createTelemetrySlice } from "./enterprise/telemetry-slice";

// Job lens — persona/workflow router (D-331). Lives at slices root because it
// is cross-cutting (consumed by both product routing and capability gates).
export type { JobLensSlice } from "./job-lens-slice";
export { createJobLensSlice, selectActiveJob } from "./job-lens-slice";
