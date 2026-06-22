import type { SecurityScene, SimulationResult, TemporalSecurityProfile, CounterfactualPlan, CounterfactualConstraint, CameraNode, ObstructionNode } from "@/schema/security-scene";
import { cloneSecurityScene } from "@/schema/security-scene";
import type { ScenarioBatchResult, AssumptionSensitivity } from "@sentineltwin/core";
import { simulateStudio, computeTemporalProfile, runScenarioBatch, DEFAULT_SCENARIO_STATES, computeAssumptionSensitivity, computePostureScore } from "@sentineltwin/simulation";
import type { PostureScoreResult } from "@sentineltwin/simulation";
import { runStudioSimulation } from "@/lib/simulation-runner";
import {
  buildOperationalEvidenceEvent,
  confidenceLabel,
  summarizeSceneEvidence,
  summarizeSimulationEvidence,
  type OperationalEvidenceEvent,
} from "@/lib/operational-evidence";
import { serializeOperationalEvidenceJournal } from "@/lib/operational-evidence-journal";
import { buildSceneIntelligenceGraph, type SceneIntelligenceGraph } from "@/lib/scene-intelligence-graph";
import { generateAndRankCounterfactuals } from "@/simulation/counterfactual-runner";
// Loop Pass L2 producer — diff the issue set across a simulation recompute and
// flag the tabs whose findings changed. See `@/lib/contextual-tabs` and
// `Docs/review/UI_REVIEW_2026-06-19.md` Loop Pass L2.
import { diffIssuesForAttention } from "@/lib/contextual-tabs";
import type { BottomTab } from "./layout-slice";

const OPERATIONAL_EVIDENCE_STORAGE_KEY = "sentineltwin_operational_evidence_v1";

function persistOperationalEvidenceEvents(events: OperationalEvidenceEvent[]) {
  try {
    const raw = localStorage.getItem(OPERATIONAL_EVIDENCE_STORAGE_KEY);
    localStorage.setItem(OPERATIONAL_EVIDENCE_STORAGE_KEY, serializeOperationalEvidenceJournal(raw, events));
  } catch {
    // Storage full or unavailable — silently fail
  }
}

function cloneSceneWithChangeLog(scene: SecurityScene, changeLog: string[]) {
  const next = cloneSecurityScene(scene);
  next.changeLog = changeLog;
  return next;
}

function cloneSceneWithAppendedChangeLog(scene: SecurityScene, entry: string) {
  return cloneSceneWithChangeLog(scene, [...scene.changeLog, entry]);
}

function cloneAndSetActivePath(scene: SecurityScene, activePathId: string | null): string | null {
  if (!activePathId) return null;
  return scene.paths.some((path) => path.id === activePathId) ? activePathId : null;
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

function buildGraphState(
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

function buildSimulationState(
  scene: SecurityScene,
  result: SimulationResult,
  durationMs: number,
  revisionDepth: number,
  snapshotCount: number,
  operationalEvidenceEvents: OperationalEvidenceEvent[],
  precomputedTemporalProfile?: TemporalSecurityProfile | null,
  previousPostureScore?: number | null,
) {
  const nextScene = cloneSecurityScene(scene);
  nextScene.previousSimulation = scene.simulation;
  nextScene.simulation = result;
  nextScene.updatedAt = Date.now();
  const temporalProfile = precomputedTemporalProfile ?? computeTemporalProfile(nextScene as never);
  const postureScore = computePostureScore(result, temporalProfile, previousPostureScore);

  return {
    scene: nextScene,
    simulationResult: result,
    temporalProfile,
    postureScore,
    simulationDirty: false,
    simulationRunning: false,
    simulationProgress: null,
    lastRunMs: durationMs,
    sceneIntelligenceGraph: buildGraphState(nextScene, result, revisionDepth, snapshotCount, operationalEvidenceEvents),
  };
}

function buildSimulationEvidenceEvent(
  scene: SecurityScene,
  result: SimulationResult,
  durationMs: number,
  revisionDepth: number,
  previousResult?: SimulationResult | null,
) {
  const simulation = summarizeSimulationEvidence(result);
  const previousCoverage = previousResult?.totalCoveragePct ?? null;
  const deltaCoveragePct = previousCoverage === null ? null : Number((result.totalCoveragePct - previousCoverage).toFixed(2));

  return buildOperationalEvidenceEvent({
    kind: "simulation_completed",
    title: previousCoverage === null ? "Simulation completed" : "Simulation recomputed",
    details: `Coverage ${result.totalCoveragePct.toFixed(1)}% · ${result.issues.length} issue${result.issues.length === 1 ? "" : "s"} · ${durationMs} ms`,
    actor: "system",
    source: scene.source,
    sceneId: scene.id,
    sceneName: scene.name,
    revisionDepth,
    affectedNodeIds: scene.cameras.map((camera) => camera.id),
    confidence: 0.99,
    beforeSummary: previousResult
      ? `Previous coverage ${previousResult.totalCoveragePct.toFixed(1)}%`
      : undefined,
    afterSummary: `Coverage ${result.totalCoveragePct.toFixed(1)}%`,
    simulation: simulation
      ? {
          ...simulation,
          deltaCoveragePct,
        }
      : undefined,
    notes: [`Simulation duration ${durationMs} ms.`],
  });
}

export interface SimulationSlice {
  simulationResult: SimulationResult | null;
  simulationDirty: boolean;
  simulationRunning: boolean;
  /** 0..1 progress of the in-flight simulation run, or null when idle. */
  simulationProgress: number | null;
  simulationError?: string | null;
  autoRecompute: boolean;
  cameraFailures: string[];

  temporalProfile: TemporalSecurityProfile | null;
  temporalScrubHour: number;
  temporalScrubMinute: number;

  counterfactualResult: SimulationResult | null;
  counterfactualObsId: string | null;
  counterfactualPlans: CounterfactualPlan[];
  activeCounterfactualPlanId: string | null;

  scenarioBatchResults: ScenarioBatchResult[] | null;
  assumptionSensitivityResults: AssumptionSensitivity[] | null;

  postureScore: PostureScoreResult | null;

  setSimulationRunning: (running: boolean) => void;
  setSimulationResult: (result: SimulationResult, durationMs: number) => void;
  runSimulation: () => void;
  markDirty: () => void;
  toggleAutoRecompute: () => void;
  toggleCameraFailure: (cameraId: string) => void;
  clearAllCameraFailures: () => void;

  setTemporalProfile: (profile: TemporalSecurityProfile | null) => void;
  setTemporalScrub: (hour: number, minute: number) => void;
  computeTemporalProfile: () => void;

  runCounterfactual: (obstructionId: string) => void;
  clearCounterfactual: () => void;
  generateCounterfactuals: (constraints: CounterfactualConstraint) => void;
  previewCounterfactualPlan: (planId: string) => void;
  applyCounterfactualPlan: (planId: string) => void;
  revertCounterfactualPreview: () => void;

  runScenarioComparison: () => void;
  runAssumptionSensitivity: () => void;
}

export const createSimulationSlice = (set: any, get: any): SimulationSlice => ({
  simulationResult: null,
  simulationDirty: false,
  simulationRunning: false,
  simulationProgress: null,

  autoRecompute: true,
  cameraFailures: [],

  temporalProfile: null,
  temporalScrubHour: 10,
  temporalScrubMinute: 0,

  counterfactualResult: null,
  counterfactualObsId: null,
  counterfactualPlans: [],
  activeCounterfactualPlanId: null,

  scenarioBatchResults: null,
  assumptionSensitivityResults: null,

  postureScore: null,

  setSimulationRunning: (running) => set({ simulationRunning: running }),

  setSimulationResult: (result, durationMs) =>
    set((s: any) => {
      const evidenceEvent = buildSimulationEvidenceEvent(s.scene, result, durationMs, s.historyPast.length, s.simulationResult);
      const nextState = buildSimulationState(s.scene, result, durationMs, s.historyPast.length, s.snapshots.length, s.operationalEvidenceEvents, undefined, s.postureScore?.score);
      const nextSceneSnapshot = cloneSecurityScene(nextState.scene);
      const nextEvents = [...s.operationalEvidenceEvents, evidenceEvent];
      persistOperationalEvidenceEvents(nextEvents);
      return {
        ...nextState,
        operationalEvidenceEvents: nextEvents,
        scene: {
          ...nextSceneSnapshot,
          changeLog: [...nextState.scene.changeLog, evidenceLogLine(evidenceEvent)],
        },
      };
    }),

  runSimulation: () => {
    const state = get();
    if (state.simulationRunning) return;

    if (state.fixSandboxActive && state.fixSandboxDraftScene) {
      const draftSnapshot = cloneSecurityScene(state.fixSandboxDraftScene);
      set({ simulationRunning: true });
      setTimeout(async () => {
        try {
          const start = performance.now();
          const { result } = await runStudioSimulation(draftSnapshot, {
            includeTemporalProfile: false,
            currentTime: { hour: state.temporalScrubHour, minute: state.temporalScrubMinute },
          });
          const durationMs = Math.round(performance.now() - start);
          set({
            simulationResult: result,
            simulationDirty: false,
            simulationRunning: false,
            simulationProgress: null,
            lastRunMs: durationMs,
            fixSandboxDiff: { ...get().fixSandboxDiff, needsRecompute: false },
          });
          get().recordRuntimeIncident({
            category: "performance_trace",
            severity: durationMs >= 1000 ? "warning" : "info",
            title: "Fix sandbox simulation run",
            details: `Sandbox simulation completed in ${durationMs} ms with ${result.issues.length} issue${result.issues.length === 1 ? "" : "s"}.`,
            durationMs,
            action: "simulate_sandbox",
            path: "/studio",
          });
        } catch (err) {
          console.error("[simulation] sandbox failed:", err);
          get().recordRuntimeIncident({
            category: "runtime_failure",
            severity: "error",
            title: "Fix sandbox simulation failed",
            details: err instanceof Error ? err.message : "Simulation threw an unknown error.",
            stack: err instanceof Error ? err.stack : undefined,
            action: "simulate_sandbox",
            path: "/studio",
          });
          set({ simulationRunning: false, simulationProgress: null });
        }
      }, 30);
      return;
    }

    const sceneVersion = state.scene.updatedAt;
    const sceneSnapshot = cloneSecurityScene(state.scene);

    set({ simulationRunning: true, simulationProgress: 0 });

    setTimeout(async () => {
      try {
        const start = performance.now();
        const { result, temporalProfile, executionPath } = await runStudioSimulation(sceneSnapshot, {
          currentTime: { hour: state.temporalScrubHour, minute: state.temporalScrubMinute },
          onProgress: (fraction) => {
            if (get().scene.updatedAt !== sceneVersion) return;
            set({ simulationProgress: fraction });
          },
        });
        const durationMs = Math.round(performance.now() - start);

        if (get().scene.updatedAt !== sceneVersion) {
          console.warn("[simulation] discarded stale result because the scene changed mid-run");
          set({ simulationRunning: false, simulationProgress: null });
          return;
        }

        const current = get();
        const previousResult = current.simulationResult;
        const evidenceEvent = buildSimulationEvidenceEvent(current.scene, result, durationMs, current.historyPast.length, previousResult);
        const nextState = buildSimulationState(current.scene, result, durationMs, current.historyPast.length, current.snapshots.length, current.operationalEvidenceEvents, temporalProfile, current.postureScore?.score);
        const nextSceneSnapshot = cloneSecurityScene(nextState.scene);
        const nextEvents = [...current.operationalEvidenceEvents, evidenceEvent];
        persistOperationalEvidenceEvents(nextEvents);

        // Loop Pass L2 — causal issue threading. Diff the issue set across
        // this recompute and flag the tabs whose findings changed (appeared
        // OR disappeared) so the bottom-panel "More" button lights up. Skips
        // the operator's currently-active tab (already foregrounded), disabled
        // tabs, and tabs already flagged. Merges with any existing pending
        // attention so prior unresolved signals aren't clobbered. Also captures
        // the changed-issue fingerprints for IssuesTab's "changed by last edit"
        // float-to-top. See `Docs/review/UI_REVIEW_2026-06-19.md` Loop Pass L2
        // and `@/lib/contextual-tabs` `diffIssuesForAttention`.
        const issueDiff = diffIssuesForAttention({
          previousIssues: previousResult?.issues,
          currentIssues: result.issues,
          excludeTab: current.bottomTab,
          currentAttention: current.pendingTabAttention,
          enabledAnalysisModules: current.enabledAnalysisModules,
        });
        const mergedAttention: BottomTab[] = issueDiff.tabsToFlag.length > 0
          ? Array.from(new Set([...current.pendingTabAttention, ...issueDiff.tabsToFlag]))
          : current.pendingTabAttention;

        set({
          ...nextState,
          operationalEvidenceEvents: nextEvents,
          pendingTabAttention: mergedAttention,
          recentIssueChangeKeys: issueDiff.changedIssueKeys,
          scene: {
            ...nextSceneSnapshot,
            changeLog: [...nextState.scene.changeLog, evidenceLogLine(evidenceEvent)],
          },
        });
        get().recordRuntimeIncident({
          category: "performance_trace",
          severity: durationMs >= 1000 ? "warning" : "info",
          title: "Simulation run",
          details: `Simulation completed in ${durationMs} ms with ${result.issues.length} issue${result.issues.length === 1 ? "" : "s"} (${executionPath === "worker" ? "web worker" : "main thread"}).`,
          durationMs,
          action: "simulate",
          path: "/studio",
        });
      } catch (err) {
        console.error("[simulation] failed:", err);
        get().recordRuntimeIncident({
          category: "runtime_failure",
          severity: "error",
          title: "Simulation failed",
          details: err instanceof Error ? err.message : "Simulation threw an unknown error.",
          stack: err instanceof Error ? err.stack : undefined,
          action: "simulate",
          path: "/studio",
        });
        set({ simulationRunning: false, simulationProgress: null });
      }
    }, 30);
  },

  markDirty: () => set({ simulationDirty: true }),

  toggleAutoRecompute: () => set((s: any) => ({ autoRecompute: !s.autoRecompute })),

  toggleCameraFailure: (cameraId) =>
    set((s: any) => {
      const failures = s.cameraFailures.includes(cameraId)
        ? s.cameraFailures.filter((id: string) => id !== cameraId)
        : [...s.cameraFailures, cameraId];
      return { cameraFailures: failures, simulationDirty: true };
    }),

  clearAllCameraFailures: () => set({ cameraFailures: [], simulationDirty: true }),

  setTemporalProfile: (profile) => set({ temporalProfile: profile }),

  setTemporalScrub: (hour, minute) => {
    const envMode = (hour < 6 || hour >= 19) ? "night" : hour >= 17 ? "dusk" : "day";
    set({
      temporalScrubHour: hour,
      temporalScrubMinute: minute,
      environmentMode: envMode,
      simulationDirty: true,
    });
  },

  computeTemporalProfile: () => {
    const { scene } = get();
    const profile = computeTemporalProfile(scene as never);
    set({ temporalProfile: profile });
  },

  runCounterfactual: (obstructionId) => {
    const { scene } = get();
    const patched = cloneSecurityScene(scene);
    patched.obstructions = scene.obstructions.filter((o: ObstructionNode) => o.id !== obstructionId);
    const result = simulateStudio(patched);
    const evidenceEvent = buildOperationalEvidenceEvent({
      kind: "counterfactual_completed",
      title: "Counterfactual simulated",
      details: `Recomputed coverage without obstruction ${obstructionId}.`,
      actor: "system",
      source: scene.source,
      sceneId: scene.id,
      sceneName: scene.name,
      revisionDepth: get().historyPast.length,
      affectedNodeIds: [obstructionId],
      confidence: 0.9,
      beforeSummary: summarizeSceneEvidence(scene).detail,
      afterSummary: summarizeSceneEvidence(patched).detail,
      simulation: summarizeSimulationEvidence(result)
        ? {
            ...summarizeSimulationEvidence(result)!,
            deltaCoveragePct: null,
          }
        : undefined,
    });
    const nextEvents = [...get().operationalEvidenceEvents, evidenceEvent];
    persistOperationalEvidenceEvents(nextEvents);
    set({
      counterfactualResult: result,
      counterfactualObsId: obstructionId,
      operationalEvidenceEvents: nextEvents,
      scene: {
        ...cloneSecurityScene(scene),
        changeLog: [...scene.changeLog, evidenceLogLine(evidenceEvent)],
      },
    });
  },

  clearCounterfactual: () => set({ counterfactualResult: null, counterfactualObsId: null }),

  generateCounterfactuals: (constraints) => {
    const { scene } = get();
    if (!scene.simulation) return;
    const plans = generateAndRankCounterfactuals(scene, scene.simulation, constraints);
    set({ counterfactualPlans: plans, activeCounterfactualPlanId: null });
  },

  previewCounterfactualPlan: (planId) => {
    const state = get();
    const plan = state.counterfactualPlans.find((p: CounterfactualPlan) => p.planId === planId);
    if (!plan) return;

    const patched = cloneSecurityScene(state.scene);
    for (const action of plan.actions) {
      if (action.type === "move_object" && action.affectedNodeId && action.suggestedPosition) {
        const obs = patched.obstructions.find((o: ObstructionNode) => o.id === action.affectedNodeId);
        if (obs) obs.position = action.suggestedPosition;
      } else if (action.type === "rotate_camera" && action.affectedNodeId) {
        const cam = patched.cameras.find((c: CameraNode) => c.id === action.affectedNodeId);
        if (cam) {
          if (action.suggestedYawDeg !== undefined) cam.yawDeg = action.suggestedYawDeg;
          if (action.suggestedPitchDeg !== undefined) cam.pitchDeg = action.suggestedPitchDeg;
        }
      } else if (action.type === "add_camera" && action.suggestedPosition) {
        patched.cameras.push({
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
    }

    if (plan.simulationResult) {
      patched.simulation = plan.simulationResult;
    }

    set({ scene: patched, activeCounterfactualPlanId: planId });
  },

  applyCounterfactualPlan: (planId) => {
    const state = get();
    const plan = state.counterfactualPlans.find((p: CounterfactualPlan) => p.planId === planId);
    if (!plan) return;

    const evidenceEvent = buildOperationalEvidenceEvent({
      kind: "counterfactual_completed",
      title: `Applied Plan: ${plan.label}`,
      details: `Applied optimization plan ${planId}`,
      actor: "system",
      source: state.scene.source,
      sceneId: state.scene.id,
      sceneName: state.scene.name,
      revisionDepth: get().historyPast.length,
      affectedNodeIds: [],
      confidence: plan.confidenceScore,
      beforeSummary: "",
      afterSummary: summarizeSceneEvidence(state.scene).detail,
      simulation: state.scene.simulation ? (summarizeSimulationEvidence(state.scene.simulation) ?? undefined) : undefined,
    });
    const nextEvents = [...get().operationalEvidenceEvents, evidenceEvent];
    persistOperationalEvidenceEvents(nextEvents);

    set({
      activeCounterfactualPlanId: null,
      operationalEvidenceEvents: nextEvents,
      scene: {
        ...cloneSecurityScene(state.scene),
        changeLog: [...state.scene.changeLog, evidenceLogLine(evidenceEvent)],
      },
    });

    get().saveSnapshot(`Applied fix: ${plan.label}`);
  },

  revertCounterfactualPreview: () => {
    get().undo();
    set({ activeCounterfactualPlanId: null });
  },

  runScenarioComparison: () => {
    const { scene, simulationResult } = get();
    const baseline = simulationResult ?? scene.simulation;
    if (!baseline) return;
    const results = runScenarioBatch(scene, baseline, DEFAULT_SCENARIO_STATES);
    set({ scenarioBatchResults: results });
  },

  runAssumptionSensitivity: () => {
    const { scene, simulationResult } = get();
    const baseline = simulationResult ?? scene.simulation;
    if (!baseline) return;
    const results = computeAssumptionSensitivity(scene, baseline);
    set({ assumptionSensitivityResults: results });
  },
});
