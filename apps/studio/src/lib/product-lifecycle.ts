/**
 * Product Lifecycle State — tracks where the current scene is in the
 * canonical lifecycle: intake → draft → approved → simulated → reported.
 *
 * This is a derived state computed from the scene, simulation result,
 * and governance status. It is the single source of truth for lifecycle
 * ordering across ProductViewRouter and other product surfaces.
 *
 * @see Docs/review/PRODUCT_REVIEW_2026-07-10.md §2
 * @see motto_v3 §0.11 (no stronger guarantees than the system can support)
 */

import type { SecurityScene, SimulationResult } from "@/schema/security-scene";
import type { WorkspaceGovernanceState } from "@/lib/workspace-governance";

// ── Types ──────────────────────────────────────────────────────────────────

/**
 * Canonical lifecycle stages. Each stage is strictly ordered —
 * the scene cannot jump ahead without passing through earlier stages.
 *
 * The ordering is: intake < draft < approved < simulated < reported.
 */
export type ProductLifecycleStage =
  | "intake"
  | "draft"
  | "approved"
  | "simulated"
  | "reported";

/**
 * Lifecycle stage ordering — index position equals priority.
 * Lower index = earlier stage.
 */
const STAGE_ORDER: ProductLifecycleStage[] = [
  "intake",
  "draft",
  "approved",
  "simulated",
  "reported",
];

/**
 * Full lifecycle state for the current scene. Includes the computed stage,
 * the rationale for why the stage was chosen, and which stages are reachable
 * from the current position.
 */
export interface ProductLifecycleState {
  /** Current lifecycle stage. */
  stage: ProductLifecycleStage;
  /** Human-readable label for the current stage. */
  label: string;
  /** Human-readable description of why the scene is at this stage. */
  reason: string;
  /** All stages that are reachable from the current stage (including current). */
  reachableStages: ProductLifecycleStage[];
  /** Whether a simulation has been run at least once. */
  hasSimulation: boolean;
  /** Whether the scene has been through governance review. */
  hasGovernanceReview: boolean;
  /** Whether the scene has a report generated. */
  hasReport: boolean;
  /** Timestamp of the most recent lifecycle-relevant event, if any. */
  lastTransitionAt: number | null;
}

// ── Derivation ─────────────────────────────────────────────────────────────

/**
 * Derive the product lifecycle state from the current scene, simulation,
 * and governance state. This is a pure function — no side effects.
 */
export function deriveProductLifecycleState(params: {
  scene: SecurityScene;
  simulationResult: SimulationResult | null;
  governance: WorkspaceGovernanceState;
  hasReport?: boolean;
  lastReportAt?: number | null;
}): ProductLifecycleState {
  const { scene, simulationResult, governance, hasReport = false, lastReportAt = null } = params;

  // Determine the stage based on the combination of governance + simulation + report.
  let stage: ProductLifecycleStage;
  let reason: string;

  const hasSimulation = simulationResult != null;
  const hasGovernanceReview =
    governance.sceneStatus === "approved" ||
    governance.sceneStatus === "published" ||
    governance.sceneStatus === "review_requested";

  if (hasReport && hasSimulation) {
    stage = "reported";
    reason = "Scene has been simulated and a report has been generated.";
  } else if (hasSimulation) {
    stage = "simulated";
    reason = "Scene has been simulated. Ready for reporting or further edits.";
  } else if (governance.sceneStatus === "approved" || governance.sceneStatus === "published") {
    stage = "approved";
    reason = "Scene has been approved. Ready to run simulation.";
  } else if (
    governance.sceneStatus === "review_requested" ||
    governance.sceneStatus === "rejected"
  ) {
    // Scene is in review but not yet approved — still at draft stage
    // with a governance flag.
    stage = "draft";
    reason =
      governance.sceneStatus === "rejected"
        ? "Scene review was rejected. Returned for revision."
        : "Scene is under review. Awaiting approval.";
  } else {
    // governance.sceneStatus === "draft" or "recovered"
    // Check if the scene has any meaningful content (cameras, zones).
    const hasContent = scene.cameras.length > 0 || scene.criticalZones.length > 0;
    if (hasContent) {
      stage = "draft";
      reason = "Scene has content but has not been submitted for review.";
    } else {
      stage = "intake";
      reason = "No scene content yet. Start by creating or importing a site twin.";
    }
  }

  // Compute reachable stages — all stages from current onward.
  const currentIndex = STAGE_ORDER.indexOf(stage);
  const reachableStages = STAGE_ORDER.slice(currentIndex);

  // Determine the last transition timestamp.
  let lastTransitionAt: number | null = null;
  if (hasReport && lastReportAt) {
    lastTransitionAt = lastReportAt;
  } else if (simulationResult?.computedAt) {
    lastTransitionAt = simulationResult.computedAt;
  } else if (governance.publishedAt) {
    lastTransitionAt = governance.publishedAt;
  } else if (governance.reviewedAt) {
    lastTransitionAt = governance.reviewedAt;
  } else if (governance.requestedAt) {
    lastTransitionAt = governance.requestedAt;
  } else if (scene.updatedAt) {
    lastTransitionAt = scene.updatedAt;
  }

  return {
    stage,
    label: stageLabel(stage),
    reason,
    reachableStages,
    hasSimulation,
    hasGovernanceReview,
    hasReport,
    lastTransitionAt,
  };
}

// ── Helpers ────────────────────────────────────────────────────────────────

/**
 * Human-readable label for a lifecycle stage.
 */
export function stageLabel(stage: ProductLifecycleStage): string {
  const labels: Record<ProductLifecycleStage, string> = {
    intake: "Intake",
    draft: "Draft",
    approved: "Approved",
    simulated: "Simulated",
    reported: "Reported",
  };
  return labels[stage];
}

/**
 * Check whether `target` is reachable from `current` in the lifecycle.
 * A stage is reachable if it is at or after the current stage.
 */
export function isStageReachable(
  current: ProductLifecycleStage,
  target: ProductLifecycleStage,
): boolean {
  return STAGE_ORDER.indexOf(target) >= STAGE_ORDER.indexOf(current);
}

/**
 * Check whether advancing from `current` to `target` is a forward transition
 * (i.e., skipping no stages).
 */
export function isForwardTransition(
  current: ProductLifecycleStage,
  target: ProductLifecycleStage,
): boolean {
  const ci = STAGE_ORDER.indexOf(current);
  const ti = STAGE_ORDER.indexOf(target);
  return ti === ci + 1;
}

/**
 * Get the list of lifecycle stages as an ordered array.
 */
export function getLifecycleStages(): readonly ProductLifecycleStage[] {
  return STAGE_ORDER;
}

/**
 * Get the previous stage in the lifecycle, or null if at intake.
 */
export function getPreviousStage(
  stage: ProductLifecycleStage,
): ProductLifecycleStage | null {
  const idx = STAGE_ORDER.indexOf(stage);
  return idx > 0 ? STAGE_ORDER[idx - 1] : null;
}

/**
 * Get the next stage in the lifecycle, or null if at reported.
 */
export function getNextStage(
  stage: ProductLifecycleStage,
): ProductLifecycleStage | null {
  const idx = STAGE_ORDER.indexOf(stage);
  return idx < STAGE_ORDER.length - 1 ? STAGE_ORDER[idx + 1] : null;
}
