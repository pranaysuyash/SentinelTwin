import { beforeEach, describe, expect, test } from "bun:test";

import { useStudioStore } from "@/store/studio-store";
import { smallRetailShopScene } from "@/demo-scenes/small-retail-shop";
import { buildSceneIntelligenceGraph } from "@/lib/scene-intelligence-graph";
import { buildOperationalEvidenceArchive } from "@/lib/operational-evidence-archive";
import { createDefaultWorkspaceAccessState } from "@/lib/workspace-access";
import { createDefaultWorkspaceGovernance } from "@/lib/workspace-governance";
import { createBlankSecurityScene } from "@/lib/scene-skeleton";
import { createCameraNode, createSecurityLightNode, createSensorNode } from "@/lib/node-factory";
import type { OperationalEvidenceEvent } from "@/lib/operational-evidence";

describe("studio store", () => {
  beforeEach(() => {
    useStudioStore.setState(useStudioStore.getInitialState(), true);
  });

  test("boots the demo scene with a seeded simulation result on first load", () => {
    const state = useStudioStore.getState();

    expect(state.scene.source).toBe("demo");
    expect(state.simulationDirty).toBe(false);
    expect(state.simulationResult).toBeDefined();
    const seededSimulation = state.scene.simulation;
    const seededResult = state.simulationResult;
    if (!seededSimulation) {
      throw new Error("Expected the demo scene to start with a seeded simulation result");
    }
    if (!seededResult) {
      throw new Error("Expected the demo store to start with a seeded simulation result");
    }
    expect(seededSimulation).toBe(seededResult);
    expect(state.lastRunMs).not.toBeNull();
  });

  test("seeds at least one real draft workspace alongside the demo baseline", () => {
    const state = useStudioStore.getState();
    const manualWorkspace = state.savedProjects.find((record) => record.scene.source !== "demo");

    expect(manualWorkspace).toBeDefined();
    expect(manualWorkspace?.scene.source).toBe("manual");
    expect(manualWorkspace?.scene.name).toContain("Shop Layout Draft");
    expect(manualWorkspace?.scene.cameras.length).toBeGreaterThan(0);
    expect(manualWorkspace?.scene.criticalZones.length).toBeGreaterThan(0);
    expect(manualWorkspace?.scene.simulation).toBeDefined();
    expect(state.savedProjects.length).toBeGreaterThan(1);
  });

  test("seeds unique saved project scene ids on first load", () => {
    const state = useStudioStore.getState();
    const ids = state.savedProjects.map((record) => record.scene.id);

    expect(new Set(ids).size).toBe(ids.length);
  });

  test("runs the shared simulation action and stores a fresh result", async () => {
    useStudioStore.setState({
      scene: smallRetailShopScene,
      simulationResult: null,
      simulationDirty: true,
      simulationRunning: false,
      lastRunMs: null,
    });

    useStudioStore.getState().runSimulation();

    await new Promise((resolve) => setTimeout(resolve, 80));

    const state = useStudioStore.getState();

    expect(state.simulationRunning).toBe(false);
    expect(state.simulationDirty).toBe(false);
    expect(state.simulationResult).toBeDefined();
    expect(state.scene.simulation).toBeDefined();
    expect(state.lastRunMs).not.toBeNull();
  });

  test("clears activePathId when the active path is removed", () => {
    const activePathId = smallRetailShopScene.paths[0]?.id;

    expect(activePathId).toBeTruthy();

    useStudioStore.setState({
      scene: smallRetailShopScene,
      simulationResult: null,
      simulationDirty: false,
      activePathId,
    });

    useStudioStore.getState().commitSceneChange((draft) => ({
      ...draft,
      paths: draft.paths.filter((path) => path.id !== activePathId),
    }));

    expect(useStudioStore.getState().activePathId).toBeNull();
  });

  test("stores and clears map focus requests for the 3D workspace", () => {
    useStudioStore.getState().setFocusScenePointRequest({ point: [4.5, 2.25], source: "minimap" });

    expect(useStudioStore.getState().focusScenePointRequest).toEqual({
      point: [4.5, 2.25],
      source: "minimap",
    });

    useStudioStore.getState().setFocusScenePointRequest(null);

    expect(useStudioStore.getState().focusScenePointRequest).toBeNull();
  });

  test("stores the active camera placement preset in shared editor state", () => {
    useStudioStore.getState().setCameraPresetId("bullet_outdoor");

    expect(useStudioStore.getState().cameraPresetId).toBe("bullet_outdoor");

    useStudioStore.getState().setCameraPresetId(null);

    expect(useStudioStore.getState().cameraPresetId).toBeNull();
  });

  test("stores the global critical-zone target default for new zones", () => {
    useStudioStore.getState().setCriticalZoneTargetType("license_plate");

    expect(useStudioStore.getState().criticalZoneTargetType).toBe("license_plate");
  });

  test("stores the local-only AI policy mode in shared editor state", () => {
    useStudioStore.getState().setLocalOnlyMode(true);

    expect(useStudioStore.getState().localOnlyMode).toBe(true);

    useStudioStore.getState().setLocalOnlyMode(false);

    expect(useStudioStore.getState().localOnlyMode).toBe(false);
  });

  test("records and clears runtime incidents in the shared debug ledger", () => {
    useStudioStore.getState().recordRuntimeIncident({
      category: "runtime_failure",
      severity: "error",
      title: "Unhandled rejection",
      details: "Promise rejected during scene setup.",
      stack: "Error: boom",
      path: "/studio",
    });

    expect(useStudioStore.getState().runtimeIncidents).toHaveLength(1);
    expect(useStudioStore.getState().runtimeIncidents[0]?.category).toBe("runtime_failure");

    useStudioStore.getState().clearRuntimeIncidents();

    expect(useStudioStore.getState().runtimeIncidents).toHaveLength(0);
  });

  test("records and clears external logs in the shared debug ledger", () => {
    useStudioStore.getState().recordExternalLogEntry({
      source: "paste",
      title: "Console error",
      details: "TypeError: boom",
      raw: "TypeError: boom",
      lineCount: 1,
      severity: "error",
    });

    expect(useStudioStore.getState().externalLogEntries).toHaveLength(1);
    expect(useStudioStore.getState().externalLogEntries[0]?.title).toBe("Console error");

    useStudioStore.getState().clearExternalLogEntries();

    expect(useStudioStore.getState().externalLogEntries).toHaveLength(0);
  });

  test("resets shared map viewport state when a new scene is loaded", () => {
    useStudioStore.setState({
      mapState: {
        minimap: { zoom: 2.4, pan: [32, -18] },
        pathMap: { zoom: 1.7, pan: [-12, 6] },
      },
    });

    useStudioStore.getState().setScene(smallRetailShopScene);

    expect(useStudioStore.getState().mapState).toEqual({
      minimap: { zoom: 1, pan: [0, 0] },
      pathMap: { zoom: 1, pan: [0, 0] },
    });
  });

  test("records operational evidence events for scene edits", () => {
    useStudioStore.setState({
      scene: smallRetailShopScene,
      simulationResult: null,
      simulationDirty: false,
      operationalEvidenceEvents: [],
      historyPast: [],
      historyFuture: [],
    });

    useStudioStore.getState().commitSceneChange((scene) => ({
      ...scene,
      name: "Edited Retail Scene",
    }), "Rename scene");

    const state = useStudioStore.getState();

    expect(state.operationalEvidenceEvents).toHaveLength(1);
    expect(state.operationalEvidenceEvents[0]?.kind).toBe("scene_updated");
    expect(state.scene.changeLog.at(-1)).toContain("Evidence:");
  });

  test("records sensor-specific evidence events for sensor edits", () => {
    const baseScene = createBlankSecurityScene();
    useStudioStore.setState({
      scene: baseScene,
      simulationResult: null,
      simulationDirty: false,
      operationalEvidenceEvents: [],
      historyPast: [],
      historyFuture: [],
    });

    useStudioStore.getState().addNode(createSensorNode([1.2, 1.2, 2.4], "motion"));

    const addedEvent = useStudioStore.getState().operationalEvidenceEvents.at(-1);
    expect(addedEvent?.kind).toBe("sensor_added");
    expect(addedEvent?.title).toBe("Sensor added");
    expect(addedEvent?.affectedNodeIds.length).toBe(1);

    const sensorId = useStudioStore.getState().scene.sensors[0]?.id;
    if (!sensorId) {
      throw new Error("Expected a sensor node to exist after insertion");
    }

    useStudioStore.getState().updateNode(sensorId, { state: "faulted" });

    const updatedEvent = useStudioStore.getState().operationalEvidenceEvents.at(-1);
    expect(updatedEvent?.kind).toBe("sensor_updated");
    expect(updatedEvent?.title).toBe("Sensor updated");
    expect(updatedEvent?.affectedNodeIds).toContain(sensorId);
  });

  test("restores a previous scene checkpoint from operational evidence", () => {
    useStudioStore.setState({
      scene: smallRetailShopScene,
      simulationResult: null,
      simulationDirty: false,
      historyPast: [],
      historyFuture: [],
    });

    useStudioStore.getState().commitSceneChange((scene) => ({
      ...scene,
      name: "Checkpoint Branch",
    }), "Rename scene");

    const checkpointEvent = useStudioStore.getState().operationalEvidenceEvents.find((event) => Boolean(event.sceneSnapshot));
    if (!checkpointEvent) {
      throw new Error("Expected a checkpoint event to exist before restore");
    }

    const restored = useStudioStore.getState().restoreSceneFromEvidence(checkpointEvent.id);

    expect(restored).toBe(true);
    expect(useStudioStore.getState().scene.name).toBe(smallRetailShopScene.name);
    expect(useStudioStore.getState().operationalEvidenceEvents.at(-1)?.kind).toBe("scene_reverted");
  });


  test("exports and restores an operational evidence archive", () => {
    useStudioStore.setState({
      scene: smallRetailShopScene,
      simulationResult: null,
      simulationDirty: false,
      operationalEvidenceEvents: [],
      historyPast: [],
      historyFuture: [],
      workspaceGovernance: { ...createDefaultWorkspaceGovernance(), sceneStatus: "published" },
    });

    const archive = useStudioStore.getState().exportOperationalEvidenceArchive();
    useStudioStore.setState(useStudioStore.getInitialState(), true);

    const restored = useStudioStore.getState().importOperationalEvidenceArchive(archive);

    expect(restored.success).toBe(true);
    expect(useStudioStore.getState().scene.id).toBe(smallRetailShopScene.id);
    expect(useStudioStore.getState().workspaceGovernance.sceneStatus).toBe("published");
    expect(useStudioStore.getState().operationalEvidenceEvents.at(-1)?.title).toContain("Operational archive restored");
  });

  test("merges a diverged archive branch into the current workspace", () => {
    const baseScene = createBlankSecurityScene();
    const currentScene = {
      ...baseScene,
      id: "scene_merged",
      name: "Merged Draft",
      cameras: [createCameraNode([1, 2, 3])],
      snapshots: [],
    };
    const archiveScene = {
      ...baseScene,
      id: "scene_merged",
      name: "Merged Draft",
      securityLights: [createSecurityLightNode([4, 2.5, 2])],
      snapshots: [],
    };
    const currentEvents: OperationalEvidenceEvent[] = [
      {
        id: "scene_created:scene_merged:abc123",
        kind: "scene_created",
        title: "Scene created",
        details: "Draft scene created",
        actor: "user",
        source: "manual",
        sceneId: "scene_merged",
        sceneName: "Merged Draft",
        timestamp: 123,
        revisionDepth: 1,
        affectedNodeIds: [],
        confidence: 0.9,
        lifecycleStage: "draft" as const,
        branchLabel: "draft",
        sceneSnapshot: baseScene,
      },
      {
        id: "snapshot_saved:scene_merged:left",
        kind: "snapshot_saved",
        title: "Snapshot saved",
        details: "Current branch checkpoint",
        actor: "system",
        source: "manual",
        sceneId: "scene_merged",
        sceneName: "Merged Draft",
        timestamp: 456,
        revisionDepth: 2,
        affectedNodeIds: ["cam_1"],
        confidence: 0.95,
        lifecycleStage: "published" as const,
        branchLabel: "published",
        parentEventId: "scene_created:scene_merged:abc123",
        sceneSnapshot: currentScene,
      },
    ];
    const archiveEvents: OperationalEvidenceEvent[] = [
      {
        id: "scene_created:scene_merged:abc123",
        kind: "scene_created",
        title: "Scene created",
        details: "Draft scene created",
        actor: "user",
        source: "manual",
        sceneId: "scene_merged",
        sceneName: "Merged Draft",
        timestamp: 123,
        revisionDepth: 1,
        affectedNodeIds: [],
        confidence: 0.9,
        lifecycleStage: "draft" as const,
        branchLabel: "draft",
        sceneSnapshot: baseScene,
      },
      {
        id: "snapshot_saved:scene_merged:right",
        kind: "snapshot_saved",
        title: "Snapshot saved",
        details: "Archive branch checkpoint",
        actor: "system",
        source: "manual",
        sceneId: "scene_merged",
        sceneName: "Merged Draft",
        timestamp: 789,
        revisionDepth: 2,
        affectedNodeIds: ["light_1"],
        confidence: 0.95,
        lifecycleStage: "published" as const,
        branchLabel: "published",
        parentEventId: "scene_created:scene_merged:abc123",
        sceneSnapshot: archiveScene,
      },
    ];
    const archive = buildOperationalEvidenceArchive({
      scene: archiveScene,
      simulationResult: null,
      sceneIntelligenceGraph: buildSceneIntelligenceGraph(archiveScene, {
        simulationResult: null,
        revisionDepth: 2,
        snapshotCount: 0,
      }),
      operationalEvidenceEvents: archiveEvents,
      workspaceAccess: createDefaultWorkspaceAccessState(),
      workspaceGovernance: createDefaultWorkspaceGovernance(),
    });

    useStudioStore.setState({
      scene: currentScene,
      simulationResult: null,
      simulationDirty: true,
      snapshots: [],
      historyPast: [],
      historyFuture: [],
      operationalEvidenceEvents: currentEvents,
      workspaceAccess: createDefaultWorkspaceAccessState(),
      workspaceGovernance: createDefaultWorkspaceGovernance(),
    });

    const restored = useStudioStore.getState().importOperationalEvidenceArchive(archive);

    expect(restored.success).toBe(true);
    expect(useStudioStore.getState().scene.cameras).toHaveLength(1);
    expect(useStudioStore.getState().scene.securityLights).toHaveLength(1);
    expect(useStudioStore.getState().simulationResult).toBeNull();
    expect(useStudioStore.getState().simulationDirty).toBe(true);
    expect(useStudioStore.getState().operationalEvidenceEvents.at(-1)?.kind).toBe("scene_merged");
    expect(useStudioStore.getState().workspaceGovernance.sceneStatus).toBe("draft");
  });

  test("restores a checkpoint into a named branch target", () => {
    useStudioStore.setState({
      scene: smallRetailShopScene,
      simulationResult: null,
      simulationDirty: false,
      historyPast: [],
      historyFuture: [],
    });

    useStudioStore.getState().commitSceneChange((scene) => ({
      ...scene,
      name: "Draft Branch",
    }), "Rename scene");

    const checkpointEvent = useStudioStore.getState().operationalEvidenceEvents.find((event) => Boolean(event.sceneSnapshot));
    if (!checkpointEvent) {
      throw new Error("Expected a checkpoint event to exist before restore");
    }

    const restored = useStudioStore.getState().restoreSceneFromEvidence(checkpointEvent.id, "draft");

    expect(restored).toBe(true);
    expect(useStudioStore.getState().workspaceGovernance.sceneStatus).toBe("draft");
    expect(useStudioStore.getState().operationalEvidenceEvents.at(-1)?.branchLabel).toBe("draft");
    expect(useStudioStore.getState().operationalEvidenceEvents.at(-1)?.lifecycleStage).toBe("draft");
  });

  test("publishes the current scene as a branch-backed published state", () => {
    useStudioStore.setState({
      scene: smallRetailShopScene,
      simulationResult: null,
      simulationDirty: true,
      historyPast: [],
      historyFuture: [],
      operationalEvidenceEvents: [],
      workspaceGovernance: { ...createDefaultWorkspaceGovernance(), approvalMode: "open" },
    });

    useStudioStore.getState().recordOperationalEvidenceEvent({
      kind: "scene_updated",
      title: "Local edit",
      details: "Edited the active scene before publishing.",
      actor: "user",
      source: smallRetailShopScene.source,
      sceneId: smallRetailShopScene.id,
      sceneName: smallRetailShopScene.name,
      revisionDepth: 1,
      affectedNodeIds: [],
      confidence: 0.88,
      beforeSummary: "Before publish",
      afterSummary: "Ready to publish",
    });
    useStudioStore.getState().recordOperationalEvidenceEvent({
      kind: "scene_updated",
      title: "Other scene edit",
      details: "Unrelated event for a different scene.",
      actor: "user",
      source: "manual",
      sceneId: "scene_other",
      sceneName: "Other Scene",
      revisionDepth: 1,
      affectedNodeIds: [],
      confidence: 0.5,
      beforeSummary: "Other scene before",
      afterSummary: "Other scene after",
    });

    const published = useStudioStore.getState().publishCurrentScene();

    expect(published).toBe(true);
    expect(useStudioStore.getState().operationalEvidenceEvents.at(-1)?.kind).toBe("scene_published");
    expect(useStudioStore.getState().operationalEvidenceEvents.at(-1)?.branchLabel).toBe("published");
    expect(useStudioStore.getState().operationalEvidenceEvents.at(-1)?.parentEventId).toBe(useStudioStore.getState().operationalEvidenceEvents.find((event) => event.sceneId === smallRetailShopScene.id && event.kind === "scene_updated")?.id);
    expect(useStudioStore.getState().sceneModified).toBe(false);
    expect(useStudioStore.getState().savedSceneName).toBe(smallRetailShopScene.name);
    expect(useStudioStore.getState().savedProjects.some((record) => record.scene.id === smallRetailShopScene.id && record.tags.includes("published"))).toBe(true);
    expect(useStudioStore.getState().workspaceGovernance.sceneStatus).toBe("published");
  });

  test("requests review instead of publishing when approval is required", () => {
    useStudioStore.setState({
      scene: smallRetailShopScene,
      simulationResult: null,
      simulationDirty: true,
      historyPast: [],
      historyFuture: [],
      operationalEvidenceEvents: [],
      workspaceGovernance: createDefaultWorkspaceGovernance(),
    });

    const published = useStudioStore.getState().publishCurrentScene();

    expect(published).toBe(false);
    expect(useStudioStore.getState().operationalEvidenceEvents.at(-1)?.kind).toBe("scene_review_requested");
    expect(useStudioStore.getState().workspaceGovernance.sceneStatus).toBe("review_requested");
    expect(useStudioStore.getState().scene.changeLog.at(-1)).toContain("Publish review requested");
  });

  test("approves and publishes through the governance control plane", () => {
    useStudioStore.setState({
      scene: smallRetailShopScene,
      simulationResult: null,
      simulationDirty: true,
      historyPast: [],
      historyFuture: [],
      operationalEvidenceEvents: [],
      workspaceAccess: {
        ...createDefaultWorkspaceAccessState(),
        activeMemberId: "member_reviewer",
      },
      workspaceGovernance: { ...createDefaultWorkspaceGovernance(), approvalMode: "review_required", activeRole: "reviewer" },
    });

    expect(useStudioStore.getState().requestSceneReview("Needs a reviewer sign-off.")).toBe(true);
    expect(useStudioStore.getState().approveSceneReview("Looks good to publish.")).toBe(true);
    expect(useStudioStore.getState().publishCurrentScene()).toBe(true);
    expect(useStudioStore.getState().workspaceGovernance.sceneStatus).toBe("published");
    expect(useStudioStore.getState().operationalEvidenceEvents.some((event) => event.kind === "scene_review_approved")).toBe(true);
  });

  test("switches the active workspace member and records the access route", () => {
    useStudioStore.setState({
      scene: smallRetailShopScene,
      operationalEvidenceEvents: [],
      workspaceAccess: createDefaultWorkspaceAccessState(),
      workspaceGovernance: createDefaultWorkspaceGovernance(),
    });

    const switched = useStudioStore.getState().setWorkspaceActiveMember("member_reviewer");

    expect(switched).toBe(true);
    expect(useStudioStore.getState().workspaceAccess.activeMemberId).toBe("member_reviewer");
    expect(useStudioStore.getState().workspaceGovernance.activeRole).toBe("reviewer");
    expect(useStudioStore.getState().operationalEvidenceEvents.at(-1)?.kind).toBe("workspace_member_selected");
  });

  test("syncs the workspace membership snapshot and records reconciliation drift", () => {
    useStudioStore.setState({
      scene: smallRetailShopScene,
      operationalEvidenceEvents: [],
      workspaceAccess: createDefaultWorkspaceAccessState(),
      workspaceGovernance: createDefaultWorkspaceGovernance(),
    });

    const synced = useStudioStore.getState().syncWorkspaceMembershipSnapshot({
      workspaceAccessState: {
        activeMemberId: "member_admin",
        members: [
          {
            id: "member_admin",
            displayName: "Admin",
            role: "admin",
            clearance: "restricted",
            tags: ["owner"],
            canPublish: true,
            canReview: true,
            canRestore: true,
          },
          {
            id: "member_reviewer",
            displayName: "Reviewer",
            role: "reviewer",
            clearance: "restricted",
            tags: ["review"],
            canPublish: true,
            canReview: true,
            canRestore: true,
          },
        ],
        policy: {
          mode: "shared",
          publishRequiresApproval: true,
          privacySensitiveRequiresReviewer: true,
          requiredReviewerRoles: ["reviewer", "admin"],
        },
      },
      workspaceGovernanceState: {
        ...createDefaultWorkspaceGovernance(),
        activeRole: "admin",
        approvalMode: "review_required",
        sceneStatus: "draft",
        requestedAt: null,
        requestedBy: null,
        reviewedAt: null,
        reviewedBy: null,
        publishedAt: null,
        publishedBy: null,
        reviewNotes: [],
      },
    });

    expect(synced).toBe(true);
    expect(useStudioStore.getState().workspaceAccess.activeMemberId).toBe("member_admin");
    expect(useStudioStore.getState().workspaceAccess.policy.mode).toBe("shared");
    expect(useStudioStore.getState().workspaceGovernance.activeRole).toBe("admin");
    expect(useStudioStore.getState().operationalEvidenceEvents.at(-1)?.kind).toBe("workspace_membership_synced");
  });


  test("rebuilds the scene intelligence graph when snapshots are saved", () => {
    useStudioStore.getState().setScene(smallRetailShopScene);

    const before = useStudioStore.getState().sceneIntelligenceGraph.summary.snapshotCount;
    useStudioStore.getState().saveSnapshot("Graph Snapshot");

    const state = useStudioStore.getState();

    expect(state.sceneIntelligenceGraph.summary.sceneSourceLabel).toBe("Demo Scene");
    expect(state.sceneIntelligenceGraph.summary.snapshotCount).toBe(before + 1);
    expect(state.scene.snapshots).toHaveLength(before + 1);
  });

  test("clears operational evidence without disturbing the current scene", () => {
    useStudioStore.setState({
      scene: smallRetailShopScene,
      operationalEvidenceEvents: [{ id: "evidence_1" } as never],
    });

    useStudioStore.getState().clearOperationalEvidence();

    const state = useStudioStore.getState();
    expect(state.operationalEvidenceEvents).toHaveLength(0);
    expect(state.scene.changeLog).toHaveLength(0);
    expect(state.scene.name).toBe(smallRetailShopScene.name);
  });

  test("records ad hoc operational evidence events without mutating the scene", () => {
    useStudioStore.setState({
      scene: smallRetailShopScene,
      operationalEvidenceEvents: [],
    });

    useStudioStore.getState().recordOperationalEvidenceEvent({
      kind: "draft_proposed",
      title: "Draft preview generated",
      details: "Preview generated for the current workspace.",
      actor: "ai",
      source: smallRetailShopScene.source,
      sceneId: smallRetailShopScene.id,
      sceneName: smallRetailShopScene.name,
      revisionDepth: 1,
      affectedNodeIds: [],
      confidence: 0.72,
      beforeSummary: "Current workspace",
      afterSummary: "Draft workspace preview",
    });

    const state = useStudioStore.getState();

    expect(state.operationalEvidenceEvents).toHaveLength(1);
    expect(state.operationalEvidenceEvents[0]?.kind).toBe("draft_proposed");
    expect(state.scene.name).toBe(smallRetailShopScene.name);
  });

  test("duplicates the selected node and selects the duplicate", () => {
    const originalCamera = smallRetailShopScene.cameras[0];
    expect(originalCamera).toBeTruthy();

    useStudioStore.setState({
      scene: smallRetailShopScene,
      simulationResult: null,
      simulationDirty: false,
      selectedNodeId: originalCamera!.id,
    });

    useStudioStore.getState().duplicateNode(originalCamera!.id);

    const state = useStudioStore.getState();
    const duplicated = state.scene.cameras.find((camera) => camera.id !== originalCamera!.id && camera.name.startsWith(originalCamera!.name));

    expect(state.scene.cameras).toHaveLength(smallRetailShopScene.cameras.length + 1);
    expect(state.selectedNodeId).toBe(duplicated?.id ?? null);
    expect(duplicated?.name).toContain("Copy");
    expect(duplicated?.position[0]).toBeCloseTo(originalCamera!.position[0] + 0.4, 6);
    expect(duplicated?.position[2]).toBeCloseTo(originalCamera!.position[2] + 0.4, 6);
    expect(state.selectedNodeIds).toEqual([duplicated?.id ?? ""]);
  });

  test("supports grouped selection actions in shared editor state", () => {
    const [first, second] = smallRetailShopScene.cameras;
    expect(first).toBeTruthy();
    expect(second).toBeTruthy();

    useStudioStore.getState().setScene(smallRetailShopScene);
    useStudioStore.getState().setSelectedNodes([first!.id, second!.id]);

    expect(useStudioStore.getState().selectedNodeIds).toEqual([first!.id, second!.id]);
    expect(useStudioStore.getState().selectedNodeId).toBe(first!.id);

    useStudioStore.getState().toggleSelectedNode(first!.id);

    expect(useStudioStore.getState().selectedNodeIds).toEqual([second!.id]);
    expect(useStudioStore.getState().selectedNodeId).toBe(second!.id);
  });

  test("duplicates grouped selections when multiple nodes are selected", () => {
    const [first, second] = smallRetailShopScene.cameras;
    expect(first).toBeTruthy();
    expect(second).toBeTruthy();

    useStudioStore.setState({
      scene: smallRetailShopScene,
      simulationResult: null,
      simulationDirty: false,
      selectedNodeId: first!.id,
      selectedNodeIds: [first!.id, second!.id],
    });

    useStudioStore.getState().duplicateNode(first!.id);

    const state = useStudioStore.getState();

    expect(state.scene.cameras).toHaveLength(smallRetailShopScene.cameras.length + 2);
    expect(state.selectedNodeIds).toHaveLength(2);
    expect(state.selectedNodeIds[0]).not.toBe(first!.id);
    expect(state.selectedNodeIds[1]).not.toBe(second!.id);
  });

  test("translates the current grouped selection as one scene edit", () => {
    const [first, second] = smallRetailShopScene.cameras;
    expect(first).toBeTruthy();
    expect(second).toBeTruthy();

    useStudioStore.setState({
      scene: smallRetailShopScene,
      simulationResult: null,
      simulationDirty: false,
      selectedNodeId: first!.id,
      selectedNodeIds: [first!.id, second!.id],
    });

    useStudioStore.getState().translateSelectedNodes([0.5, -0.25]);

    const state = useStudioStore.getState();
    const movedFirst = state.scene.cameras.find((camera) => camera.id === first!.id);
    const movedSecond = state.scene.cameras.find((camera) => camera.id === second!.id);

    expect(movedFirst?.position[0]).toBeCloseTo(first!.position[0] + 0.5, 6);
    expect(movedFirst?.position[2]).toBeCloseTo(first!.position[2] - 0.25, 6);
    expect(movedSecond?.position[0]).toBeCloseTo(second!.position[0] + 0.5, 6);
    expect(movedSecond?.position[2]).toBeCloseTo(second!.position[2] - 0.25, 6);
  });

  test("removes the whole grouped selection when deleting multiple nodes", () => {
    const [first, second] = smallRetailShopScene.cameras;
    expect(first).toBeTruthy();
    expect(second).toBeTruthy();

    useStudioStore.setState({
      scene: smallRetailShopScene,
      simulationResult: null,
      simulationDirty: false,
      selectedNodeId: first!.id,
      selectedNodeIds: [first!.id, second!.id],
    });

    useStudioStore.getState().removeSelectedNodes();

    const state = useStudioStore.getState();
    expect(state.scene.cameras.find((camera) => camera.id === first!.id)).toBeUndefined();
    expect(state.scene.cameras.find((camera) => camera.id === second!.id)).toBeUndefined();
    expect(state.selectedNodeIds).toEqual([]);
    expect(state.selectedNodeId).toBeNull();
  });
});
