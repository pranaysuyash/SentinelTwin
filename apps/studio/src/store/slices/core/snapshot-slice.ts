import type { StateCreator } from "zustand";
import type { SecurityScene, SceneSnapshot, SimulationResult } from "@/schema/security-scene";
import { cloneSecurityScene, parseSecurityScene } from "@/schema/security-scene";
import { simulateStudio } from "@sentineltwin/simulation";
import {
  buildOperationalEvidenceEvent,
  summarizeSceneEvidence,
  confidenceLabel,
  type OperationalEvidenceEvent,
} from "@/lib/operational-evidence";
import { buildSceneIntelligenceGraph, type SceneIntelligenceGraph } from "@/lib/scene-intelligence-graph";
import { buildGraphState } from "./scene-slice";
import { serializeOperationalEvidenceJournal } from "@/lib/operational-evidence-journal";

// ─── Constants ────────────────────────────────────────────────────────────────

const OPERATIONAL_EVIDENCE_STORAGE_KEY = "sentineltwin_operational_evidence_v1";

// ─── Persistence helpers ───────────────────────────────────────────────────────

function persistOperationalEvidenceEvents(events: OperationalEvidenceEvent[]) {
  try {
    if (typeof window === "undefined") return;
    const raw = localStorage.getItem(OPERATIONAL_EVIDENCE_STORAGE_KEY);
    localStorage.setItem(OPERATIONAL_EVIDENCE_STORAGE_KEY, serializeOperationalEvidenceJournal(raw, events));
  } catch {}
}

function cloneSceneWithAppendedChangeLog(scene: SecurityScene, entry: string) {
  const next = cloneSecurityScene(scene);
  next.changeLog = [...scene.changeLog, entry];
  return next;
}

function evidenceLogLine(event: OperationalEvidenceEvent) {
  const time = new Date(event.timestamp).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
  const label = confidenceLabel(event.confidence);
  return `Evidence: ${time} | ${event.title} | ${event.details} | ${label}`;
}

// ─── Snapshot slice type ──────────────────────────────────────────────────────

export type SnapshotSlice = {
  snapshots: SceneSnapshot[];

  addSnapshot: (label: string, result: SimulationResult) => void;
  saveSnapshot: (label: string) => void;
  simulateSnapshot: (snapshotId: string) => boolean;
};

// ─── Snapshot slice creator ────────────────────────────────────────────────────

export const createSnapshotSlice = (set: any, get: any): SnapshotSlice => ({
  snapshots: [],

  addSnapshot: (label, result) =>
    set((s: Record<string, unknown>) => {
      const parsed = parseSecurityScene(s.scene as SecurityScene);
      const nextScene = cloneSecurityScene(parsed);
      const snapshot: SceneSnapshot = {
        id: `snap_${Date.now().toString(36)}`,
        label,
        createdAt: Date.now(),
        scene: cloneSecurityScene(nextScene),
        simulation: result,
      };
      const snapshots = [...(s.snapshots as SceneSnapshot[]), snapshot];
      const operationalEvidenceEvents = s.operationalEvidenceEvents as OperationalEvidenceEvent[];
      const evidenceEvent = buildOperationalEvidenceEvent({
        kind: "snapshot_saved",
        title: "Snapshot captured",
        details: `Saved snapshot "${label}" for later comparison.`,
        actor: "user",
        source: parsed.source,
        sceneId: parsed.id,
        sceneName: parsed.name,
        revisionDepth: (s.historyPast as SecurityScene[]).length,
        affectedNodeIds: [],
        confidence: 0.9,
        beforeSummary: summarizeSceneEvidence(s.scene as SecurityScene).detail,
        afterSummary: summarizeSceneEvidence(nextScene).detail,
        sceneSnapshot: cloneSecurityScene(nextScene),
      });
      const nextEvents = [...operationalEvidenceEvents, evidenceEvent];
      persistOperationalEvidenceEvents(nextEvents);
      nextScene.snapshots = snapshots;
      return {
        snapshots,
        sceneIntelligenceGraph: buildGraphState(nextScene, s.simulationResult as SimulationResult | null, (s.historyPast as SecurityScene[]).length, snapshots.length, operationalEvidenceEvents),
        operationalEvidenceEvents: nextEvents,
        scene: cloneSceneWithAppendedChangeLog(nextScene, evidenceLogLine(evidenceEvent)),
      };
    }),

  saveSnapshot: (label) =>
    set((s: Record<string, unknown>) => {
      const startedAt = performance.now();
      const parsed = parseSecurityScene(s.scene as SecurityScene);
      const scene = cloneSecurityScene(parsed);
      const snapshot: SceneSnapshot = {
        id: `snap_${Date.now().toString(36)}`,
        label,
        createdAt: Date.now(),
        scene: cloneSecurityScene(scene),
        simulation: (s.simulationResult as SimulationResult | null) ?? undefined,
      };
      const snapshots = [...(s.snapshots as SceneSnapshot[]), snapshot];
      scene.snapshots = snapshots;
      const operationalEvidenceEvents = s.operationalEvidenceEvents as OperationalEvidenceEvent[];
      const evidenceEvent = buildOperationalEvidenceEvent({
        kind: "snapshot_saved",
        title: "Snapshot saved",
        details: `Saved snapshot "${label}" for comparison and report handoff.`,
        actor: "user",
        source: scene.source,
        sceneId: scene.id,
        sceneName: scene.name,
        revisionDepth: (s.historyPast as SecurityScene[]).length,
        affectedNodeIds: [],
        confidence: 0.9,
        beforeSummary: summarizeSceneEvidence(s.scene as SecurityScene).detail,
        afterSummary: summarizeSceneEvidence(scene).detail,
        sceneSnapshot: cloneSecurityScene(scene),
      });
      const nextEvents = [...operationalEvidenceEvents, evidenceEvent];
      persistOperationalEvidenceEvents(nextEvents);
      get().recordRuntimeIncident({
        category: "performance_trace",
        severity: "info",
        title: "Snapshot saved",
        details: `Saved snapshot "${label}" in ${Math.round(performance.now() - startedAt)} ms.`,
        durationMs: Math.round(performance.now() - startedAt),
        action: "save_snapshot",
        path: "/studio",
      });
      return {
        snapshots,
        sceneIntelligenceGraph: buildGraphState(parsed, s.simulationResult as SimulationResult | null, (s.historyPast as SecurityScene[]).length, snapshots.length, operationalEvidenceEvents),
        operationalEvidenceEvents: nextEvents,
        scene: {
          ...scene,
          changeLog: [...scene.changeLog, evidenceLogLine(evidenceEvent)],
        },
      };
    }),

  simulateSnapshot: (snapshotId) => {
    const current = get();
    const index = current.snapshots.findIndex((snapshot: SceneSnapshot) => snapshot.id === snapshotId);
    if (index === -1) return false;
    const startedAt = performance.now();
    const target = current.snapshots[index];
    const fullScene = cloneSecurityScene(target.scene as unknown as SecurityScene);
    const result = simulateStudio(fullScene);

    set((state: any) => {
      const nextSnapshots = state.snapshots.map((snapshot: SceneSnapshot, i: number) =>
        i === index
          ? {
              ...snapshot,
              simulation: result,
            }
          : snapshot);
      const nextScene = cloneSecurityScene(state.scene);
      nextScene.snapshots = structuredClone(nextSnapshots);
      const evidenceEvent = buildOperationalEvidenceEvent({
        kind: "snapshot_saved",
        title: "Snapshot replay simulated",
        details: `Snapshot ${target.label} recomputed against the current simulation rules.`,
        actor: "system",
        source: nextScene.source,
        sceneId: nextScene.id,
        sceneName: nextScene.name,
        revisionDepth: state.historyPast.length,
        affectedNodeIds: [],
        confidence: 0.9,
        beforeSummary: summarizeSceneEvidence(state.scene).detail,
        afterSummary: summarizeSceneEvidence(nextScene).detail,
        notes: [`Snapshot ${target.label} re-simulated.`],
      });
      const nextEvents = [...state.operationalEvidenceEvents, evidenceEvent];
      persistOperationalEvidenceEvents(nextEvents);
      const durationMs = Math.round(performance.now() - startedAt);
      get().recordRuntimeIncident({
        category: "performance_trace",
        severity: durationMs >= 500 ? "warning" : "info",
        title: "Snapshot replay simulated",
        details: `Snapshot "${target.label}" recomputed in ${durationMs} ms.`,
        durationMs,
        action: "simulate_snapshot",
        path: "/studio",
      });
      return {
        snapshots: nextSnapshots,
        operationalEvidenceEvents: nextEvents,
        scene: {
          ...nextScene,
          changeLog: [...nextScene.changeLog, evidenceLogLine(evidenceEvent)],
        },
      };
    });

    return true;
  },
});
