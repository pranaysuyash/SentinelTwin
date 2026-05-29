import { afterEach, describe, expect, test } from "bun:test";

import { describeAiProviderGovernance, normalizeAiProviderSelection } from "@/agents/provider-selection";
import type { ModelEvalSuiteResult } from "@/agents/model-eval";
import { createBlankSecurityScene } from "@/lib/scene-skeleton";
import { createSmallRetailShopScene } from "@/demo-scenes/small-retail-shop";
import { useStudioStore } from "@/store/studio-store";

type StorageShape = {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
  clear: () => void;
};

const originalWindow = globalThis.window;
const originalLocalStorage = globalThis.localStorage;

function makeStorage(): StorageShape {
  const store = new Map<string, string>();
  return {
    getItem: (key) => store.get(key) ?? null,
    setItem: (key, value) => {
      store.set(key, value);
    },
    removeItem: (key) => {
      store.delete(key);
    },
    clear: () => {
      store.clear();
    },
  };
}

function installStorage() {
  const storage = makeStorage();
  Object.defineProperty(globalThis, "window", { value: {}, configurable: true });
  Object.defineProperty(globalThis, "localStorage", { value: storage, configurable: true });
  return storage;
}

afterEach(() => {
  Object.defineProperty(globalThis, "window", { value: originalWindow, configurable: true });
  Object.defineProperty(globalThis, "localStorage", { value: originalLocalStorage, configurable: true });
  useStudioStore.getState().setScene(createSmallRetailShopScene());
  useStudioStore.setState({ savedProjects: [], savedScenes: [], modelEvalHistory: [], supportIngestHistory: [] });
});

describe("studio store project metadata", () => {
  test("persists folder, tag, and pin metadata for saved workspaces", () => {
    const storage = installStorage();
    const scene = createSmallRetailShopScene();
    const { setScene, saveSceneToStorage, updateSavedSceneMetadata, refreshSavedScenesList, getSceneStorageKey } = useStudioStore.getState();

    setScene(scene);
    saveSceneToStorage();
    updateSavedSceneMetadata(scene.id, {
      folder: "Retail",
      tags: ["client-alpha", "retail", "retail"],
      pinned: true,
      lastOpenedAt: 1234567890,
    });
    refreshSavedScenesList();

    const state = useStudioStore.getState();
    const saved = state.savedProjects.find((record) => record.scene.id === scene.id);

    expect(getSceneStorageKey()).toBe("sentineltwin_saved_projects_v2");
    expect(saved).toBeTruthy();
    expect(saved?.folder).toBe("Retail");
    expect(saved?.tags).toEqual(["client-alpha", "retail"]);
    expect(saved?.pinned).toBe(true);
    expect(saved?.lastOpenedAt).toBe(1234567890);
    expect(storage.getItem("sentineltwin_saved_projects_v2")).toContain("\"folder\":\"Retail\"");
  });

  test("duplicates and renames saved workspaces as separate storage records", () => {
    installStorage();
    const scene = createBlankSecurityScene();
    scene.name = "Operations Draft";
    const { setScene, saveSceneToStorage, duplicateSavedScene, renameSavedScene, refreshSavedScenesList } = useStudioStore.getState();

    setScene(scene);
    saveSceneToStorage();

    const duplicate = duplicateSavedScene(scene.id);
    expect(duplicate).toBeTruthy();
    expect(duplicate?.scene.id).not.toBe(scene.id);
    expect(duplicate?.scene.name).toContain("Copy");
    expect(duplicate?.scene.source).toBe("manual");

    refreshSavedScenesList();
    let state = useStudioStore.getState();
    expect(state.savedProjects).toHaveLength(2);

    const renamed = renameSavedScene(scene.id, "Renamed Operations Draft");
    expect(renamed).toBeTruthy();
    expect(renamed?.scene.name).toBe("Renamed Operations Draft");

    refreshSavedScenesList();
    state = useStudioStore.getState();
    expect(state.savedProjects.find((record) => record.scene.id === scene.id)?.scene.name).toBe("Renamed Operations Draft");
    expect(state.savedProjects.find((record) => record.scene.id === duplicate?.scene.id)?.scene.name).toContain("Copy");
  });

  test("persists operational evidence as an append-only journal", () => {
    const storage = installStorage();
    useStudioStore.setState({
      scene: createBlankSecurityScene(),
      operationalEvidenceEvents: [],
      historyPast: [],
      historyFuture: [],
    });

    useStudioStore.getState().recordOperationalEvidenceEvent({
      kind: "scene_created",
      title: "Draft scene created",
      details: "Recorded the first operational evidence entry.",
      actor: "user",
      source: "manual",
      sceneId: "scene_journal",
      sceneName: "Journal Draft",
      revisionDepth: 1,
      affectedNodeIds: [],
      confidence: 0.95,
    });

    let raw = storage.getItem("sentineltwin_operational_evidence_v1");
    expect(raw).toBeTruthy();
    let journal = JSON.parse(raw ?? "{}") as { version: number; entries: Array<{ kind: string; events: unknown[] }> };
    expect(journal.version).toBe(1);
    expect(journal.entries).toHaveLength(1);
    expect(journal.entries[0]?.kind).toBe("append");

    useStudioStore.getState().recordOperationalEvidenceEvent({
      kind: "scene_updated",
      title: "Draft scene updated",
      details: "Recorded a second operational evidence entry.",
      actor: "user",
      source: "manual",
      sceneId: "scene_journal",
      sceneName: "Journal Draft",
      revisionDepth: 2,
      affectedNodeIds: [],
      confidence: 0.95,
    });

    raw = storage.getItem("sentineltwin_operational_evidence_v1");
    journal = JSON.parse(raw ?? "{}") as { version: number; entries: Array<{ kind: string; events: unknown[] }> };
    expect(journal.entries).toHaveLength(2);
    expect(journal.entries.at(-1)?.kind).toBe("append");

    useStudioStore.getState().clearOperationalEvidence();

    raw = storage.getItem("sentineltwin_operational_evidence_v1");
    journal = JSON.parse(raw ?? "{}") as { version: number; entries: Array<{ kind: string; events: unknown[] }> };
    expect(journal.entries).toHaveLength(3);
    expect(journal.entries.at(-1)?.kind).toBe("replace");
    expect(journal.entries.at(-1)?.events).toEqual([]);
    expect(useStudioStore.getState().operationalEvidenceEvents).toHaveLength(0);
  });

  test("persists model eval history for cross-run comparison", () => {
    const storage = installStorage();
    useStudioStore.setState({ modelEvalHistory: [] });

    const selection = normalizeAiProviderSelection({ providerId: "openai", model: "gpt-4o" });
    const governance = describeAiProviderGovernance(selection, false);
    const report: ModelEvalSuiteResult = {
      generatedAt: 111,
      provider: {
        providerId: selection.providerId,
        providerName: governance.activeProviderName,
        providerLabel: governance.activeProviderLabel,
        model: selection.model,
        localOnlyMode: false,
        cloudAvailable: true,
      },
      governance,
      summary: {
        total: 5,
        passed: 4,
        failed: 1,
        skipped: 0,
      },
      fixtures: [
        {
          id: "heuristic_layout_baseline",
          label: "Heuristic Layout Baseline",
          kind: "baseline",
          status: "pass",
          summary: "Heuristic fallback",
          prompt: "Create a retail scene.",
          durationMs: 10,
          checks: [],
          outputPreview: "ok",
        },
      ] as ModelEvalSuiteResult["fixtures"],
    };

    useStudioStore.getState().recordModelEvalRun(report);

    let history = useStudioStore.getState().modelEvalHistory;
    expect(history).toHaveLength(1);
    expect(history[0]?.providerLabel).toBe(governance.activeProviderLabel);
    expect(history[0]?.stageBudget.modeLabel).toBe("Cloud-backed budget");

    let raw = storage.getItem("sentineltwin_model_eval_history_v1");
    expect(raw).toContain("Heuristic Layout Baseline");

    useStudioStore.getState().recordModelEvalRun({
      ...report,
      generatedAt: 222,
      summary: { ...report.summary, passed: 5, failed: 0 },
    });

    history = useStudioStore.getState().modelEvalHistory;
    expect(history).toHaveLength(2);
    expect(history[0]?.generatedAt).toBe(222);
    expect(history[1]?.generatedAt).toBe(111);

    raw = storage.getItem("sentineltwin_model_eval_history_v1");
    expect(JSON.parse(raw ?? "[]")).toHaveLength(2);
  });

  test("persists support ingest history for routed support handoffs", () => {
    const storage = installStorage();
    useStudioStore.setState({ supportIngestHistory: [] });

    useStudioStore.getState().recordSupportIngestResponse({
      ok: true,
      source: "debug-panel",
      receivedAt: "2024-03-09T16:00:00.000Z",
      sceneId: "scene-1",
      sceneName: "Shop Floor",
      summary: "2 alert candidates routed from 1 runtime incident and 1 external log capture.",
      routing: {
        title: "Automated alerting",
        summary: "2 alert candidates · 2 high priority · 0 warnings.",
        alertCount: 2,
        highPriorityCount: 2,
        latestAlert: {
          id: "external:external-1",
          timestamp: 1710000000500,
          source: "external_log",
          severity: "error",
          title: "Console error",
          details: "TypeError: boom",
          category: "external_log",
          path: null,
          stack: null,
        },
        recentAlerts: [],
        recommendation: "Review the latest high-priority alert, attach external logs, and export the support bundle before escalation.",
        statusLabel: "attention",
      },
      counts: {
        runtimeIncidents: 1,
        externalLogs: 1,
        telemetryEvents: 0,
      },
      submittedAt: 1710000000000,
    });

    const history = useStudioStore.getState().supportIngestHistory;
    expect(history).toHaveLength(1);
    expect(history[0]?.sceneName).toBe("Shop Floor");
    expect(history[0]?.routing.alertCount).toBe(2);
    expect(storage.getItem("sentineltwin_support_ingest_history_v1")).toContain("Shop Floor");

    useStudioStore.getState().clearSupportIngestHistory();
    expect(useStudioStore.getState().supportIngestHistory).toHaveLength(0);
  });
});
