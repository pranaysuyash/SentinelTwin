/**
 * Studio-side counterfactual runner.
 *
 * The codebase has three counterfactual surfaces that share a common
 * goal but live in different packages for different reasons:
 *
 * 1. `packages/simulation/src/counterfactual-search.ts` —
 *    `computeCounterfactualSearch` is the *algorithmic* baseline.
 *    It enumerates candidate action plans, runs the simulation
 *    engine against each, and ranks by coverage gain. Deterministic,
 *    no AI, runs in the Web Worker.
 *
 * 2. `packages/agents/src/counterfactual-agent.ts` —
 *    `proposeCounterfactuals` is the *AI* proposer. It takes the
 *    issue summary and scene summary, asks the configured model for
 *    natural-language candidate fixes, and returns them as
 *    structured SceneOperation arrays. Cloud-backed; can be disabled
 *    by local-only mode.
 *
 * 3. THIS FILE — `counterfactual-runner.ts` — is the *studio*
 *    wrapper. It coordinates the deterministic search, applies the
 *    studio's local constraint model, runs each plan through
 *    `simulateStudio` to measure impact, and surfaces the ranked
 *    plans for the CounterfactualPanel UI.
 *
 * The three surfaces don't compete; they cooperate. The runner
 * (this file) is the only one the studio store calls directly. The
 * agent proposer is reached from `/api/ai/counterfactuals`. The
 * algorithmic search is exported for use by both the runner and
 * any future AI-driven scorer.
 *
 * File naming: the previous name was `counterfactual-engine.ts`,
 * which collided with `@sentineltwin/simulation`'s role as the
 * canonical simulation engine. The rename to `counterfactual-runner`
 * makes it clear that this file *runs* counterfactuals in the
 * studio, it does not own the engine.
 */
import {
  type SecurityScene,
  type SimulationResult,
  type ZoneResult,
} from "@/schema/security-scene";
import { cloneSecurityScene } from "@/schema/security-scene";
import { simulateStudio } from "@sentineltwin/simulation";

export interface CounterfactualConstraint {
  noNewWiring?: boolean;
  maxBudget?: number;
  privacyPreserving?: boolean;
}

export interface CounterfactualAction {
  actionId: string;
  type: "move_object" | "rotate_camera" | "add_camera";
  description: string;
  affectedNodeId?: string;
  suggestedPosition?: [number, number, number];
  suggestedYawDeg?: number;
  suggestedPitchDeg?: number;
  estimatedCost: number;
}

export interface CounterfactualPlan {
  planId: string;
  label: string;
  actions: CounterfactualAction[];
  totalCost: number;
  confidenceScore: number;
  privacyScore: number;
  simulationResult?: SimulationResult;
  simulatedCoveragePct?: number;
  simulatedImprovementPct?: number;
  zoneResults?: ZoneResult[];
  zoneDeltas?: Array<{
    zoneId: string;
    baselineStatus: string;
    proposedStatus: string;
    coverageChangePct: number;
    improved: boolean;
  }>;
}

function generateCandidateActions(
  scene: SecurityScene,
  constraints: CounterfactualConstraint,
): CounterfactualAction[] {
  const actions: CounterfactualAction[] = [];

  for (const obs of scene.obstructions) {
    if (obs.movableByAI) {
      actions.push({
        actionId: `move_${obs.id}`,
        type: "move_object",
        description: `Move ${obs.label} to improve coverage`,
        affectedNodeId: obs.id,
        suggestedPosition: [obs.position[0] + 3, obs.position[1], obs.position[2]],
        estimatedCost: 0,
      });
    }
  }

  for (const cam of scene.cameras) {
    actions.push({
      actionId: `rotate_${cam.id}`,
      type: "rotate_camera",
      description: `Re-aim ${cam.name} for better coverage`,
      affectedNodeId: cam.id,
      suggestedYawDeg: cam.yawDeg + 15,
      suggestedPitchDeg: -30,
      estimatedCost: 50,
    });
  }

  if (!constraints.noNewWiring && (constraints.maxBudget === undefined || constraints.maxBudget >= 500)) {
    actions.push({
      actionId: `add_cam_1`,
      type: "add_camera",
      description: `Install new camera to cover blindspots`,
      suggestedPosition: [scene.dimensions.width / 2, 2.5, scene.dimensions.depth / 2],
      suggestedYawDeg: 45,
      suggestedPitchDeg: -30,
      estimatedCost: 500,
    });
  }

  return actions;
}

function applyAction(scene: SecurityScene, action: CounterfactualAction): SecurityScene {
  const next = cloneSecurityScene(scene);

  if (action.type === "move_object" && action.affectedNodeId && action.suggestedPosition) {
    const obs = next.obstructions.find((o) => o.id === action.affectedNodeId);
    if (obs) obs.position = action.suggestedPosition;
  } else if (action.type === "rotate_camera" && action.affectedNodeId) {
    const cam = next.cameras.find((c) => c.id === action.affectedNodeId);
    if (cam) {
      if (action.suggestedYawDeg !== undefined) cam.yawDeg = action.suggestedYawDeg;
      if (action.suggestedPitchDeg !== undefined) cam.pitchDeg = action.suggestedPitchDeg;
    }
  } else if (action.type === "add_camera" && action.suggestedPosition) {
    next.cameras.push({
      id: `cam_cf_${Date.now()}`,
      nodeType: "camera",
      name: "Suggested Camera",
      position: action.suggestedPosition,
      yawDeg: action.suggestedYawDeg ?? 0,
      pitchDeg: action.suggestedPitchDeg ?? -30,
      rollDeg: 0,
      mountType: "wall",
      mountHeightM: 2.5,
      fovHorizontalDeg: 90,
      fovVerticalDeg: 50,
      rangeM: 20,
      resolutionMP: 4,
      lensType: "fixed",
      status: "on",
      nightMode: "ir",
      irRangeM: 15,
      thermalCapable: false,
      ptz: false,
      clarity: "good",
      ndaaCompliant: true,
      privacyMaskingEnabled: false,
      source: "ai",
      tags: [],
      lprCapable: false,
      reviewStatus: "unreviewed",
      sourceTrace: "",
      geometryValidity: "valid",
      viewMotion: { movementMode: "fixed", dwellSeconds: 0, waypoints: [] },
    });
  }

  return next;
}

export function generateAndRankCounterfactuals(
  scene: SecurityScene,
  baselineResult: SimulationResult,
  constraints: CounterfactualConstraint,
): CounterfactualPlan[] {
  const candidateActions = generateCandidateActions(scene, constraints);

  const candidatePlans: CounterfactualPlan[] = candidateActions.map(action => ({
    planId: `plan_${action.actionId}`,
    label: action.description,
    actions: [action],
    totalCost: action.estimatedCost,
    confidenceScore: 0.8,
    privacyScore: constraints.privacyPreserving ? 1.0 : 0.5,
  }));

  if (candidateActions.length >= 2) {
    candidatePlans.push({
      planId: `plan_compound_1`,
      label: `Compound: ${candidateActions[0].description} + ${candidateActions[1].description}`,
      actions: [candidateActions[0], candidateActions[1]],
      totalCost: candidateActions[0].estimatedCost + candidateActions[1].estimatedCost,
      confidenceScore: 0.85,
      privacyScore: constraints.privacyPreserving ? 1.0 : 0.5,
    });
  }

  for (const plan of candidatePlans) {
    let patchedScene = scene;
    for (const action of plan.actions) {
      patchedScene = applyAction(patchedScene, action);
    }

    const result = simulateStudio(patchedScene);

    plan.simulationResult = result;
    plan.simulatedCoveragePct = result.totalCoveragePct;
    plan.simulatedImprovementPct = result.totalCoveragePct - baselineResult.totalCoveragePct;

    // Track zone-level deltas so downstream consumers can evaluate per-zone impact
    plan.zoneResults = result.criticalZoneResults;
    if (baselineResult.criticalZoneResults.length > 0) {
      plan.zoneDeltas = result.criticalZoneResults.map((zone, i) => {
        const prev = baselineResult.criticalZoneResults[i];
        return {
          zoneId: zone.label,
          baselineStatus: prev?.status ?? "unknown",
          proposedStatus: zone.status,
          coverageChangePct: (zone.coveragePct ?? 0) - (prev?.coveragePct ?? 0),
          improved: prev?.status === "fail" && zone.status === "pass",
        };
      });
    }
  }

  const validPlans = candidatePlans.filter(p => {
    // Budget gate only — all valid actions are worth showing even if they
    // don't improve total coverage. Sorting prioritizes positive deltas.
    if (constraints.maxBudget !== undefined && p.totalCost > constraints.maxBudget) return false;
    return true;
  });

  validPlans.sort((a, b) => {
    if (a.simulatedImprovementPct !== b.simulatedImprovementPct) {
      return (b.simulatedImprovementPct || 0) - (a.simulatedImprovementPct || 0);
    }
    return a.totalCost - b.totalCost;
  });

  return validPlans;
}
