import { describe, expect, test } from "bun:test";

import {
  createCameraNode,
  createObstructionNode,
  createPathNode,
  createSecurityLightNode,
  createSensorNode,
} from "@/lib/node-factory";
import { createBlankSecurityScene } from "@/lib/scene-skeleton";
import type { OperationalEvidenceEvent } from "@/lib/operational-evidence";
import {
  buildOperationalEvidenceEvent,
  buildOperationalEvidenceTimeline,
  assessOperationalEvidenceMergeReadiness,
  compareOperationalEvidenceBranches,
  findOperationalEvidenceEventsForNode,
  findLatestOperationalEvidenceEventForScene,
  filterOperationalEvidenceEvents,
  mergeOperationalEvidenceBranchScenes,
  matchesOperationalEvidenceEvent,
  summarizeOperationalEvidenceBranchHeads,
  summarizeOperationalGovernanceTrail,
  summarizeOperationalEvidenceLifecycle,
  summarizeOperationalEvidenceTemporalTwin,
  normalizeOperationalEvidenceEvents,
  safeParseOperationalEvidenceEvent,
  resolveOperationalEvidencePublicationCheckpoint,
  resolveOperationalEvidenceRestoreScene,
  resolveOperationalEvidenceSceneAtTime,
  resolveOperationalEvidenceSceneAtTimeWithContext,
  traceOperationalEvidenceLineage,
} from "@/lib/operational-evidence";

describe("operational evidence helpers", () => {
  test("normalizes event schemas and preserves validated scene snapshots", () => {
    const scene = createBlankSecurityScene();
    scene.name = "Evidence Scene";
    const event = buildOperationalEvidenceEvent({
      kind: "snapshot_saved",
      title: "Snapshot saved",
      details: "Captured a point-in-time checkpoint.",
      actor: "system",
      source: "manual",
      sceneId: scene.id,
      sceneName: scene.name,
      revisionDepth: 2,
      affectedNodeIds: [scene.cameras[0]?.id ?? "camera_1"],
      confidence: 0.99,
      previousSceneSnapshot: structuredClone(scene),
      sceneSnapshot: structuredClone(scene),
      simulation: {
        totalCoveragePct: 82.5,
        issueCount: 1,
        failedZoneCount: 1,
        deltaCoveragePct: -3.1,
      },
      notes: ["Recovered from branch head."],
    });

    const normalized = safeParseOperationalEvidenceEvent(event);

    expect(normalized?.sceneSnapshot?.id).toBe(scene.id);
    expect(normalized?.previousSceneSnapshot?.id).toBe(scene.id);
    expect(normalized?.simulation?.issueCount).toBe(1);
    expect(normalized?.notes).toContain("Recovered from branch head.");
  });

  test("buildOperationalEvidenceEvent canonicalizes blank input through the schema", () => {
    const scene = createBlankSecurityScene();
    const event = buildOperationalEvidenceEvent({
      kind: "scene_updated",
      title: "   ",
      details: "",
      actor: "user",
      source: scene.source,
      sceneId: scene.id,
      sceneName: scene.name,
      revisionDepth: 2,
      affectedNodeIds: [],
      confidence: 0.93,
    });

    expect(event.title).toBe("Scene updated");
    expect(event.details).toBe("Scene updated");
    expect(safeParseOperationalEvidenceEvent(event)).not.toBeNull();
  });

  test("drops malformed operational evidence records", () => {
    const malformed = normalizeOperationalEvidenceEvents([
      {
        id: "broken-event",
        kind: "scene_updated",
        title: "Broken event",
        actor: "user",
        source: "manual",
        sceneId: "scene_1",
        sceneName: "Broken",
        timestamp: 123,
        revisionDepth: 1,
        affectedNodeIds: ["camera_1"],
        confidence: 0.9,
        sceneSnapshot: { not: "a security scene" },
      },
    ]);

    expect(malformed).toHaveLength(0);
  });

  test("matches events by title, notes, scene name, and node ids", () => {
    const event: OperationalEvidenceEvent = {
      id: "scene_updated:scene_1:abc123",
      kind: "scene_updated",
      title: "Rename scene",
      details: "Updated the retail layout",
      actor: "user",
      source: "manual",
      sceneId: "scene_1",
      sceneName: "Retail Draft",
      timestamp: 123,
      revisionDepth: 2,
      affectedNodeIds: ["camera_1", "zone_2"],
      confidence: 0.9,
      notes: ["Restored from checkpoint scene_0."],
    };

    expect(matchesOperationalEvidenceEvent(event, "rename")).toBe(true);
    expect(matchesOperationalEvidenceEvent(event, "retail")).toBe(true);
    expect(matchesOperationalEvidenceEvent(event, "camera_1")).toBe(true);
    expect(matchesOperationalEvidenceEvent(event, "checkpoint")).toBe(true);
    expect(matchesOperationalEvidenceEvent(event, "missing")).toBe(false);
  });

  test("filters a ledger down to matching evidence entries", () => {
    const events: OperationalEvidenceEvent[] = [
      {
        id: "scene_updated:scene_1:abc123",
        kind: "scene_updated",
        title: "Rename scene",
        details: "Updated the retail layout",
        actor: "user",
        source: "manual",
        sceneId: "scene_1",
        sceneName: "Retail Draft",
        timestamp: 123,
        revisionDepth: 2,
        affectedNodeIds: ["camera_1"],
        confidence: 0.9,
      },
      {
        id: "snapshot_saved:scene_1:def456",
        kind: "snapshot_saved",
        title: "Snapshot saved",
        details: "Saved a checkpoint",
        actor: "system",
        source: "manual",
        sceneId: "scene_1",
        sceneName: "Retail Draft",
        timestamp: 456,
        revisionDepth: 3,
        affectedNodeIds: [],
        confidence: 0.95,
      },
    ];

    expect(filterOperationalEvidenceEvents(events, "snapshot")).toHaveLength(1);
    expect(filterOperationalEvidenceEvents(events, "camera_1")).toHaveLength(1);
    expect(filterOperationalEvidenceEvents(events, "retail")).toHaveLength(2);
    expect(filterOperationalEvidenceEvents(events, "", { lifecycleStage: "manual" })).toHaveLength(1);
    expect(filterOperationalEvidenceEvents(events, "", { branchLabel: "manual" })).toHaveLength(1);
    expect(filterOperationalEvidenceEvents(events, "", { lifecycleStage: "published" })).toHaveLength(1);

    expect(findLatestOperationalEvidenceEventForScene(events, "scene_1")?.kind).toBe("snapshot_saved");
    expect(findLatestOperationalEvidenceEventForScene(events, "scene_1", "draft")).toBeNull();
  });

  test("supports branch and time query tokens in evidence search", () => {
    const events: OperationalEvidenceEvent[] = [
      {
        id: "scene_created:scene_1:abc123",
        kind: "scene_created",
        title: "Scene created",
        details: "Draft scene created",
        actor: "user",
        source: "manual",
        sceneId: "scene_1",
        sceneName: "Retail Draft",
        timestamp: Date.parse("2026-05-28T08:00:00.000Z"),
        revisionDepth: 1,
        affectedNodeIds: [],
        confidence: 0.9,
        lifecycleStage: "draft",
        branchLabel: "draft",
      },
      {
        id: "scene_published:scene_1:def456",
        kind: "scene_published",
        title: "Scene published",
        details: "Published checkpoint",
        actor: "user",
        source: "manual",
        sceneId: "scene_1",
        sceneName: "Retail Draft",
        timestamp: Date.parse("2026-05-29T08:00:00.000Z"),
        revisionDepth: 2,
        affectedNodeIds: [],
        confidence: 0.95,
        lifecycleStage: "published",
        branchLabel: "published",
      },
    ];

    expect(filterOperationalEvidenceEvents(events, "branch:published")).toHaveLength(1);
    expect(filterOperationalEvidenceEvents(events, "time:2026-05-29")).toHaveLength(1);
    expect(filterOperationalEvidenceEvents(events, "after:2026-05-29T00:00:00.000Z before:2026-05-29T23:59:59.999Z branch:published")).toHaveLength(1);
    expect(matchesOperationalEvidenceEvent(events[0]!, "branch:published")).toBe(false);
  });

  test("summarizes lifecycle branches for draft, review, recovered, and published states", () => {
    const events: OperationalEvidenceEvent[] = [
      {
        id: "scene_created:scene_1:abc123",
        kind: "scene_created",
        title: "Scene created",
        details: "Draft scene created",
        actor: "user",
        source: "manual",
        sceneId: "scene_1",
        sceneName: "Retail Draft",
        timestamp: 123,
        revisionDepth: 1,
        affectedNodeIds: [],
        confidence: 0.9,
        lifecycleStage: "draft",
        branchLabel: "draft",
      },
      {
        id: "scene_review_requested:scene_1:abc234",
        kind: "scene_review_requested",
        title: "Review requested",
        details: "Requested approval before publish",
        actor: "user",
        source: "manual",
        sceneId: "scene_1",
        sceneName: "Retail Draft",
        timestamp: 234,
        revisionDepth: 1,
        affectedNodeIds: [],
        confidence: 0.9,
        lifecycleStage: "review",
        branchLabel: "review",
      },
      {
        id: "scene_reverted:scene_1:def456",
        kind: "scene_reverted",
        title: "Scene reverted",
        details: "Recovered checkpoint",
        actor: "user",
        source: "manual",
        sceneId: "scene_1",
        sceneName: "Retail Draft",
        timestamp: 456,
        revisionDepth: 2,
        affectedNodeIds: [],
        confidence: 0.95,
        lifecycleStage: "recovered",
        branchLabel: "recovered",
      },
      {
        id: "snapshot_saved:scene_1:ghi789",
        kind: "snapshot_saved",
        title: "Snapshot saved",
        details: "Published checkpoint",
        actor: "system",
        source: "manual",
        sceneId: "scene_1",
        sceneName: "Retail Draft",
        timestamp: 789,
        revisionDepth: 3,
        affectedNodeIds: [],
        confidence: 0.95,
        lifecycleStage: "published",
        branchLabel: "published",
      },
    ];

    const summary = summarizeOperationalEvidenceLifecycle(events);

    expect(summary.counts.draft).toBe(1);
    expect(summary.counts.review).toBe(1);
    expect(summary.counts.recovered).toBe(1);
    expect(summary.counts.published).toBe(1);
    expect(summary.branchCounts.some(([branch]) => branch === "draft")).toBe(true);
    expect(summary.branchCounts.some(([branch]) => branch === "review")).toBe(true);
    expect(summary.branchCounts.some(([branch]) => branch === "recovered")).toBe(true);
    expect(summary.branchCounts.some(([branch]) => branch === "published")).toBe(true);
  });

  test("summarizes the latest visible head for each lifecycle branch", () => {
    const events: OperationalEvidenceEvent[] = [
      {
        id: "scene_created:scene_1:abc123",
        kind: "scene_created",
        title: "Scene created",
        details: "Draft scene created",
        actor: "user",
        source: "manual",
        sceneId: "scene_1",
        sceneName: "Retail Draft",
        timestamp: 123,
        revisionDepth: 1,
        affectedNodeIds: [],
        confidence: 0.9,
        lifecycleStage: "draft",
        branchLabel: "draft",
      },
      {
        id: "scene_published:scene_1:def456",
        kind: "scene_published",
        title: "Scene published",
        details: "Published checkpoint",
        actor: "user",
        source: "manual",
        sceneId: "scene_1",
        sceneName: "Retail Draft",
        timestamp: 456,
        revisionDepth: 2,
        affectedNodeIds: [],
        confidence: 0.95,
        lifecycleStage: "published",
        branchLabel: "published",
      },
    ];

    const heads = summarizeOperationalEvidenceBranchHeads(events);

    expect(heads.find((entry) => entry.stage === "draft")?.event?.id).toBe("scene_created:scene_1:abc123");
    expect(heads.find((entry) => entry.stage === "published")?.event?.id).toBe("scene_published:scene_1:def456");
    expect(heads.find((entry) => entry.stage === "recovered")?.event).toBeNull();
  });

  test("summarizes the temporal operational twin and current-vs-checkpoint delta", () => {
    const checkpointScene = createBlankSecurityScene();
    checkpointScene.name = "Temporal Draft";
    checkpointScene.cameras.push(createCameraNode([2, 2, 2]));

    const currentScene = createBlankSecurityScene();
    currentScene.name = "Temporal Draft";
    currentScene.cameras.push(createCameraNode([2, 2, 2]));
    currentScene.cameras.push(createCameraNode([4, 2, 2]));
    currentScene.sensors.push(createSensorNode([3, 0, 3]));

    const first = buildOperationalEvidenceEvent({
      kind: "scene_created",
      title: "Scene created",
      details: "Created the temporal baseline checkpoint.",
      actor: "user",
      source: "manual",
      sceneId: currentScene.id,
      sceneName: currentScene.name,
      revisionDepth: 1,
      affectedNodeIds: [],
      confidence: 0.95,
      sceneSnapshot: structuredClone(checkpointScene),
      branchLabel: "draft",
      lifecycleStage: "draft",
    });
    const second = buildOperationalEvidenceEvent({
      kind: "snapshot_saved",
      title: "Snapshot saved",
      details: "Captured a reconstructable checkpoint.",
      actor: "system",
      source: "manual",
      sceneId: currentScene.id,
      sceneName: currentScene.name,
      revisionDepth: 2,
      affectedNodeIds: [],
      confidence: 0.95,
      sceneSnapshot: structuredClone(checkpointScene),
      branchLabel: "published",
      lifecycleStage: "published",
      timestamp: first.timestamp + 1,
    });

    const summary = summarizeOperationalEvidenceTemporalTwin([first, second], currentScene);

    expect(summary.totalEvents).toBe(2);
    expect(summary.checkpointCount).toBe(2);
    expect(summary.branchHeadCount).toBeGreaterThan(0);
    expect(summary.latestCheckpoint?.title).toBe("Snapshot saved");
    expect(summary.latestCheckpoint?.summary.detail).toContain("cameras");
    expect(summary.currentSceneSummary?.detail).toContain("cameras");
    expect(summary.currentVsLatestCheckpointDelta?.cameras).toBe(1);
    expect(summary.currentVsLatestCheckpointDelta?.sensors).toBe(1);
  });

  test("builds an event-centered timeline and resolves state at time T", () => {
    const initialScene = createBlankSecurityScene();
    initialScene.name = "Temporal Draft";
    initialScene.cameras.push(createCameraNode([2, 2, 2]));

    const midScene = createBlankSecurityScene();
    midScene.name = "Temporal Draft";
    midScene.id = initialScene.id;
    midScene.cameras.push(createCameraNode([2, 2, 2]));
    midScene.cameras.push(createCameraNode([4, 2, 2]));

    const first = buildOperationalEvidenceEvent({
      kind: "scene_created",
      title: "Scene created",
      details: "Created the temporal baseline checkpoint.",
      actor: "user",
      source: "manual",
      sceneId: initialScene.id,
      sceneName: initialScene.name,
      revisionDepth: 1,
      affectedNodeIds: [],
      confidence: 0.95,
      sceneSnapshot: structuredClone(initialScene),
      branchLabel: "draft",
      lifecycleStage: "draft",
    });
    const second = buildOperationalEvidenceEvent({
      kind: "snapshot_saved",
      title: "Snapshot saved",
      details: "Captured the mid-point checkpoint.",
      actor: "system",
      source: "manual",
      sceneId: initialScene.id,
      sceneName: initialScene.name,
      revisionDepth: 2,
      affectedNodeIds: [],
      confidence: 0.95,
      sceneSnapshot: structuredClone(midScene),
      branchLabel: "published",
      lifecycleStage: "published",
      timestamp: first.timestamp + 1000,
    });
    const third = buildOperationalEvidenceEvent({
      kind: "scene_updated",
      title: "Scene updated",
      details: "Continued after the checkpoint.",
      actor: "user",
      source: "manual",
      sceneId: initialScene.id,
      sceneName: initialScene.name,
      revisionDepth: 3,
      affectedNodeIds: [],
      confidence: 0.9,
      branchLabel: "manual",
      lifecycleStage: "manual",
      timestamp: second.timestamp + 1000,
    });

    const timeline = buildOperationalEvidenceTimeline([third, first, second], midScene);

    expect(timeline.totalEvents).toBe(3);
    expect(timeline.checkpoints).toHaveLength(2);
    expect(timeline.entries[0]?.event.id).toBe(first.id);
    expect(timeline.entries[1]?.isCheckpoint).toBe(true);
    expect(timeline.latestCheckpoint?.event.id).toBe(second.id);
    expect(timeline.latestCheckpoint?.reconstructedSceneSummary?.detail).toContain("cameras");
    expect(timeline.currentSceneSummary?.detail).toContain("cameras");

    const stateAtT = resolveOperationalEvidenceSceneAtTime([third, first, second], third.timestamp, midScene);
    expect(stateAtT?.cameras.length).toBe(2);
    expect(resolveOperationalEvidenceSceneAtTime([third, first, second], first.timestamp - 1, midScene)).toBeNull();
  });

  test("resolves exact and derived point-in-time snapshots with source provenance", () => {
    const scene = createBlankSecurityScene();
    scene.name = "Derived Timeline";
    const camera = createCameraNode([2, 2, 2]);
    scene.cameras.push(camera);

    const snapshotEvent = buildOperationalEvidenceEvent({
      kind: "snapshot_saved",
      title: "Initial checkpoint",
      details: "Captured a point-in-time checkpoint.",
      actor: "system",
      source: "manual",
      sceneId: scene.id,
      sceneName: scene.name,
      revisionDepth: 1,
      affectedNodeIds: [],
      confidence: 1,
      sceneSnapshot: structuredClone(scene),
      branchLabel: "draft",
      lifecycleStage: "draft",
      timestamp: 1000,
    });
    const derivedEvent = buildOperationalEvidenceEvent({
      kind: "scene_updated",
      title: "Scene updated",
      details: "Adjusted the scene without taking a new snapshot.",
      actor: "user",
      source: "manual",
      sceneId: scene.id,
      sceneName: scene.name,
      revisionDepth: 2,
      affectedNodeIds: [camera.id],
      confidence: 0.9,
      branchLabel: "draft",
      lifecycleStage: "draft",
      timestamp: 2000,
    });

    const resolution = resolveOperationalEvidenceSceneAtTimeWithContext([snapshotEvent, derivedEvent], derivedEvent.timestamp, scene);
    expect(resolution.scene?.cameras.length).toBe(1);
    expect(resolution.isExactSnapshot).toBe(false);
    expect(resolution.derivedFromEarlierSnapshot).toBe(true);
    expect(resolution.sourceEvent?.id).toBe(snapshotEvent.id);
    expect(resolution.sourceSnapshotDistance).toBe(1);
    expect(resolution.sourceSnapshotAgeMs).toBe(1000);
  });

  test("resolves the latest published checkpoint with canonical publication provenance", () => {
    const scene = createBlankSecurityScene();
    scene.name = "Published Timeline";
    const camera = createCameraNode([2, 2, 2]);
    scene.cameras.push(camera);

    const checkpointEvent = buildOperationalEvidenceEvent({
      kind: "snapshot_saved",
      title: "Checkpoint saved",
      details: "Captured a publishable checkpoint.",
      actor: "system",
      source: "manual",
      sceneId: scene.id,
      sceneName: scene.name,
      revisionDepth: 1,
      affectedNodeIds: [],
      confidence: 1,
      sceneSnapshot: structuredClone(scene),
      branchLabel: "draft",
      lifecycleStage: "draft",
      timestamp: 1000,
    });
    const publishedEvent = buildOperationalEvidenceEvent({
      kind: "scene_published",
      title: "Scene published",
      details: "Promoted the scene to the published branch.",
      actor: "user",
      source: "manual",
      sceneId: scene.id,
      sceneName: scene.name,
      revisionDepth: 2,
      affectedNodeIds: [],
      confidence: 0.96,
      published: true,
      branchLabel: "published",
      lifecycleStage: "published",
      timestamp: 2000,
    });

    const timeline = buildOperationalEvidenceTimeline([checkpointEvent, publishedEvent], scene);
    const publication = resolveOperationalEvidencePublicationCheckpoint(timeline);

    expect(publication?.entry.event.id).toBe(publishedEvent.id);
    expect(publication?.provenance?.sourceEventId).toBe(checkpointEvent.id);
    expect(publication?.provenance?.isExactSnapshot).toBe(false);
    expect(publication?.provenance?.derivedFromEarlierSnapshot).toBe(true);
    expect(publication?.provenance?.sourceSnapshotDistance).toBe(1);
    expect(publication?.provenance?.sourceSnapshotAgeMs).toBe(1000);

    const temporalTwin = summarizeOperationalEvidenceTemporalTwin([checkpointEvent, publishedEvent], scene);
    expect(temporalTwin.publishedCheckpointCount).toBe(1);
    expect(temporalTwin.latestPublishedCheckpoint?.eventId).toBe(publishedEvent.id);
    expect(temporalTwin.latestPublishedCheckpointProvenance?.sourceEventId).toBe(checkpointEvent.id);
  });

  test("restores the checkpoint snapshot rather than the pre-checkpoint snapshot", () => {
    const beforeScene = createBlankSecurityScene();
    beforeScene.name = "Restore Target";
    beforeScene.cameras.push(createCameraNode([1, 1, 2]));

    const afterScene = createBlankSecurityScene();
    afterScene.id = beforeScene.id;
    afterScene.name = beforeScene.name;
    afterScene.cameras.push(createCameraNode([1, 1, 2]));
    afterScene.cameras.push(createCameraNode([3, 1, 2]));

    const checkpointEvent = buildOperationalEvidenceEvent({
      kind: "scene_reverted",
      title: "Restored checkpoint",
      details: "Reopened the selected checkpoint.",
      actor: "user",
      source: "manual",
      sceneId: beforeScene.id,
      sceneName: beforeScene.name,
      revisionDepth: 2,
      affectedNodeIds: [],
      confidence: 0.9,
      previousSceneSnapshot: structuredClone(beforeScene),
      sceneSnapshot: structuredClone(afterScene),
      branchLabel: "recovered",
      lifecycleStage: "recovered",
      timestamp: 5000,
    });

    const restoredScene = resolveOperationalEvidenceRestoreScene(checkpointEvent);

    expect(restoredScene?.cameras).toHaveLength(2);
    expect(restoredScene?.cameras[1]?.id).toBe(afterScene.cameras[1]?.id);
  });

  test("finds node-specific evidence trails for entity and scene nodes", () => {
    const scene = createBlankSecurityScene();
    scene.name = "Node History";
    const camera = createCameraNode([2, 2, 2]);
    scene.cameras.push(camera);

    const sceneEvent = buildOperationalEvidenceEvent({
      kind: "scene_created",
      title: "Scene created",
      details: "Seeded the scene baseline.",
      actor: "user",
      source: "manual",
      sceneId: scene.id,
      sceneName: scene.name,
      revisionDepth: 1,
      affectedNodeIds: [],
      confidence: 0.95,
      sceneSnapshot: structuredClone(scene),
      branchLabel: "draft",
      lifecycleStage: "draft",
      timestamp: 1000,
    });
    const cameraEvent = buildOperationalEvidenceEvent({
      kind: "camera_metadata_updated",
      title: "Camera metadata updated",
      details: "Camera lens cleaned and recalibrated.",
      actor: "user",
      source: "manual",
      sceneId: scene.id,
      sceneName: scene.name,
      revisionDepth: 2,
      affectedNodeIds: [camera.id],
      confidence: 0.9,
      beforeSummary: "Before: status dirty.",
      afterSummary: "After: status on.",
      timestamp: 2000,
    });
    const unrelatedEvent = buildOperationalEvidenceEvent({
      kind: "sensor_added",
      title: "Sensor added",
      details: "Nearby sensor added.",
      actor: "user",
      source: "manual",
      sceneId: scene.id,
      sceneName: scene.name,
      revisionDepth: 3,
      affectedNodeIds: ["sensor_1"],
      confidence: 0.9,
      timestamp: 3000,
    });

    const sceneTrail = findOperationalEvidenceEventsForNode([unrelatedEvent, cameraEvent, sceneEvent], scene.id, `scene:${scene.id}`);
    const cameraTrail = findOperationalEvidenceEventsForNode([unrelatedEvent, cameraEvent, sceneEvent], scene.id, `camera:${camera.id}`);
    const sourceTrail = findOperationalEvidenceEventsForNode([unrelatedEvent, cameraEvent, sceneEvent], scene.id, "source:manual");

    expect(sceneTrail.map((event) => event.id)).toEqual([unrelatedEvent.id, cameraEvent.id, sceneEvent.id]);
    expect(cameraTrail).toHaveLength(1);
    expect(cameraTrail[0]?.id).toBe(cameraEvent.id);
    expect(sourceTrail).toHaveLength(0);
  });

  test("summarizes governance trail events for a scene", () => {
    const events: OperationalEvidenceEvent[] = [
      {
        id: "scene_review_requested:scene_1:abc123",
        kind: "scene_review_requested",
        title: "Review requested",
        details: "Requested approval before publish",
        actor: "user",
        source: "manual",
        sceneId: "scene_1",
        sceneName: "Retail Draft",
        timestamp: 123,
        revisionDepth: 1,
        affectedNodeIds: [],
        confidence: 0.9,
        lifecycleStage: "review",
        branchLabel: "review",
      },
      {
        id: "scene_comment_added:scene_1:def456",
        kind: "scene_comment_added",
        title: "Review note added",
        details: "Please move the camera",
        actor: "user",
        source: "manual",
        sceneId: "scene_1",
        sceneName: "Retail Draft",
        timestamp: 456,
        revisionDepth: 1,
        affectedNodeIds: [],
        confidence: 0.9,
        lifecycleStage: "review",
        branchLabel: "review",
      },
      {
        id: "scene_review_approved:scene_1:ghi789",
        kind: "scene_review_approved",
        title: "Review approved",
        details: "Approved for publish",
        actor: "user",
        source: "manual",
        sceneId: "scene_1",
        sceneName: "Retail Draft",
        timestamp: 789,
        revisionDepth: 1,
        affectedNodeIds: [],
        confidence: 0.95,
        lifecycleStage: "review",
        branchLabel: "review",
      },
      {
        id: "workspace_membership_synced:scene_1:jkl012",
        kind: "workspace_membership_synced",
        title: "Workspace membership synced",
        details: "Reconciled the workspace roster to the latest archived snapshot",
        actor: "user",
        source: "manual",
        sceneId: "scene_1",
        sceneName: "Retail Draft",
        timestamp: 1_012,
        revisionDepth: 1,
        affectedNodeIds: [],
        confidence: 0.95,
        lifecycleStage: "review",
        branchLabel: "review",
      },
      {
        id: "workspace_approval_routed:scene_1:mno345",
        kind: "workspace_approval_routed",
        title: "Workspace approval route resolved",
        details: "Approval routed to the reviewer after membership reconciliation",
        actor: "user",
        source: "manual",
        sceneId: "scene_1",
        sceneName: "Retail Draft",
        timestamp: 1_345,
        revisionDepth: 1,
        affectedNodeIds: [],
        confidence: 0.94,
        lifecycleStage: "review",
        branchLabel: "review",
      },
      {
        id: "workspace_identity_conflict_resolved:scene_1:pqr678",
        kind: "workspace_identity_conflict_resolved",
        title: "Workspace identity conflict resolved",
        details: "Resolved the shared identity archive against the live workspace",
        actor: "user",
        source: "manual",
        sceneId: "scene_1",
        sceneName: "Retail Draft",
        timestamp: 1_678,
        revisionDepth: 1,
        affectedNodeIds: [],
        confidence: 0.94,
        lifecycleStage: "review",
        branchLabel: "review",
      },
    ];

    const trail = summarizeOperationalGovernanceTrail(events, "scene_1");

    expect(trail.totalEvents).toBe(6);
    expect(trail.requestCount).toBe(1);
    expect(trail.approvalCount).toBe(1);
    expect(trail.annotationCount).toBe(1);
    expect(trail.roleChangeCount).toBe(1);
    expect(trail.routeCount).toBe(1);
    expect(trail.conflictResolutionCount).toBe(1);
    expect(trail.latestEvent?.kind).toBe("workspace_identity_conflict_resolved");
    expect(trail.recentEvents).toHaveLength(5);
  });

  test("traces parent lineage back to the root checkpoint", () => {
    const events: OperationalEvidenceEvent[] = [
      {
        id: "scene_created:scene_1:abc123",
        kind: "scene_created",
        title: "Scene created",
        details: "Draft scene created",
        actor: "user",
        source: "manual",
        sceneId: "scene_1",
        sceneName: "Retail Draft",
        timestamp: 123,
        revisionDepth: 1,
        affectedNodeIds: [],
        confidence: 0.9,
        lifecycleStage: "draft",
        branchLabel: "draft",
      },
      {
        id: "snapshot_saved:scene_1:def456",
        kind: "snapshot_saved",
        title: "Snapshot saved",
        details: "Saved a point-in-time checkpoint",
        actor: "system",
        source: "manual",
        sceneId: "scene_1",
        sceneName: "Retail Draft",
        timestamp: 456,
        revisionDepth: 2,
        affectedNodeIds: ["camera_1"],
        confidence: 0.95,
        lifecycleStage: "published",
        branchLabel: "published",
        parentEventId: "scene_created:scene_1:abc123",
        sceneSnapshot: createBlankSecurityScene(),
      },
    ];

    const lineage = traceOperationalEvidenceLineage(events, "snapshot_saved:scene_1:def456");

    expect(lineage).toHaveLength(2);
    expect(lineage[0]?.event.id).toBe("scene_created:scene_1:abc123");
    expect(lineage[1]?.event.id).toBe("snapshot_saved:scene_1:def456");
    expect(lineage[1]?.depth).toBe(1);
  });

  test("compares two evidence branches with a common ancestor and delta summary", () => {
    const baseScene = createBlankSecurityScene();
    const leftScene = {
      ...baseScene,
      id: "scene_1",
      name: "Retail Draft",
      cameras: [createCameraNode([1, 2, 3])],
      obstructions: [
        createObstructionNode([2, 0, 2], "shelf"),
      ],
      paths: [createPathNode([
        { position: [0.5, 0.5] },
        { position: [3, 1] },
      ])],
      snapshots: [],
    };
    const rightScene = {
      ...baseScene,
      id: "scene_1",
      name: "Retail Draft",
      cameras: [createCameraNode([1, 2, 3]), createCameraNode([7, 2, 3])],
      securityLights: [createSecurityLightNode([4, 2.5, 2])],
      obstructions: [],
      paths: [
        createPathNode([
          { position: [0.5, 0.5] },
          { position: [5.5, 1] },
          { position: [8, 3.5] },
        ]),
        createPathNode([
          { position: [1, 6] },
          { position: [4, 6.5] },
        ]),
      ],
      snapshots: [],
    };
    const events: OperationalEvidenceEvent[] = [
      {
        id: "scene_created:scene_1:abc123",
        kind: "scene_created",
        title: "Scene created",
        details: "Draft scene created",
        actor: "user",
        source: "manual",
        sceneId: "scene_1",
        sceneName: "Retail Draft",
        timestamp: 123,
        revisionDepth: 1,
        affectedNodeIds: [],
        confidence: 0.9,
        lifecycleStage: "draft",
        branchLabel: "draft",
        sceneSnapshot: baseScene,
      },
      {
        id: "snapshot_saved:scene_1:left",
        kind: "snapshot_saved",
        title: "Snapshot saved",
        details: "Left branch checkpoint",
        actor: "system",
        source: "manual",
        sceneId: "scene_1",
        sceneName: "Retail Draft",
        timestamp: 456,
        revisionDepth: 2,
        affectedNodeIds: ["obs_left"],
        confidence: 0.95,
        lifecycleStage: "published",
        branchLabel: "published",
        parentEventId: "scene_created:scene_1:abc123",
        sceneSnapshot: leftScene,
      },
      {
        id: "snapshot_saved:scene_1:right",
        kind: "snapshot_saved",
        title: "Snapshot saved",
        details: "Right branch checkpoint",
        actor: "system",
        source: "manual",
        sceneId: "scene_1",
        sceneName: "Retail Draft",
        timestamp: 789,
        revisionDepth: 2,
        affectedNodeIds: ["cam_right", "cam_right_2", "light_right", "path_right"],
        confidence: 0.95,
        lifecycleStage: "published",
        branchLabel: "published",
        parentEventId: "scene_created:scene_1:abc123",
        sceneSnapshot: rightScene,
      },
    ];

    const comparison = compareOperationalEvidenceBranches(events, "snapshot_saved:scene_1:left", "snapshot_saved:scene_1:right");

    expect(comparison).not.toBeNull();
    expect(comparison?.commonAncestor?.event.id).toBe("scene_created:scene_1:abc123");
    expect(comparison?.delta.cameras).toBe(1);
    expect(comparison?.delta.lights).toBe(1);
    expect(comparison?.delta.obstructions).toBe(-1);
    expect(comparison?.delta.paths).toBe(1);
    expect(comparison?.leftSceneSummary?.detail).toContain("Retail Draft");
    expect(comparison?.rightSceneSummary?.detail).toContain("Retail Draft");
  });

  test("assesses merge readiness for fast-forward and divergent branches", () => {
    const baseScene = createBlankSecurityScene();
    const childScene = {
      ...baseScene,
      id: "scene_1",
      name: "Retail Draft",
      cameras: [createCameraNode([1, 2, 3])],
      obstructions: [createObstructionNode([2, 0, 2], "shelf")],
      snapshots: [],
    };
    const descendantScene = {
      ...childScene,
      cameras: [...childScene.cameras, createCameraNode([7, 2, 3])],
      securityLights: [createSecurityLightNode([4, 2.5, 2])],
      paths: [
        createPathNode([
          { position: [0.5, 0.5] },
          { position: [5.5, 1] },
          { position: [8, 3.5] },
        ]),
      ],
      snapshots: [],
    };
    const events: OperationalEvidenceEvent[] = [
      {
        id: "scene_created:scene_1:abc123",
        kind: "scene_created",
        title: "Scene created",
        details: "Draft scene created",
        actor: "user",
        source: "manual",
        sceneId: "scene_1",
        sceneName: "Retail Draft",
        timestamp: 123,
        revisionDepth: 1,
        affectedNodeIds: [],
        confidence: 0.9,
        lifecycleStage: "draft",
        branchLabel: "draft",
        sceneSnapshot: baseScene,
      },
      {
        id: "snapshot_saved:scene_1:left",
        kind: "snapshot_saved",
        title: "Snapshot saved",
        details: "Left branch checkpoint",
        actor: "system",
        source: "manual",
        sceneId: "scene_1",
        sceneName: "Retail Draft",
        timestamp: 456,
        revisionDepth: 2,
        affectedNodeIds: ["obs_1"],
        confidence: 0.95,
        lifecycleStage: "published",
        branchLabel: "published",
        parentEventId: "scene_created:scene_1:abc123",
        sceneSnapshot: childScene,
      },
      {
        id: "snapshot_saved:scene_1:right",
        kind: "snapshot_saved",
        title: "Snapshot saved",
        details: "Right branch checkpoint",
        actor: "system",
        source: "manual",
        sceneId: "scene_1",
        sceneName: "Retail Draft",
        timestamp: 789,
        revisionDepth: 3,
        affectedNodeIds: ["cam_2", "light_1", "path_1"],
        confidence: 0.95,
        lifecycleStage: "published",
        branchLabel: "published",
        parentEventId: "snapshot_saved:scene_1:left",
        sceneSnapshot: descendantScene,
      },
    ];
    const comparison = compareOperationalEvidenceBranches(events, "snapshot_saved:scene_1:left", "snapshot_saved:scene_1:right");
    const readiness = assessOperationalEvidenceMergeReadiness(comparison);

    expect(readiness?.status).toBe("fast_forward_left");
    expect(readiness?.leftDistance).toBe(0);
    expect(readiness?.rightDistance).toBe(1);
    expect(readiness?.recommendation).toContain("fast-forward");
  });

  test("merges diverged branches when the edits do not conflict", () => {
    const baseScene = createBlankSecurityScene();
    const leftScene = {
      ...baseScene,
      id: "scene_1",
      name: "Retail Draft",
      cameras: [createCameraNode([1, 2, 3])],
      snapshots: [],
    };
    const rightScene = {
      ...baseScene,
      id: "scene_1",
      name: "Retail Draft",
      securityLights: [createSecurityLightNode([4, 2.5, 2])],
      snapshots: [],
    };
    const events: OperationalEvidenceEvent[] = [
      {
        id: "scene_created:scene_1:abc123",
        kind: "scene_created",
        title: "Scene created",
        details: "Draft scene created",
        actor: "user",
        source: "manual",
        sceneId: "scene_1",
        sceneName: "Retail Draft",
        timestamp: 123,
        revisionDepth: 1,
        affectedNodeIds: [],
        confidence: 0.9,
        lifecycleStage: "draft",
        branchLabel: "draft",
        sceneSnapshot: baseScene,
      },
      {
        id: "snapshot_saved:scene_1:left",
        kind: "snapshot_saved",
        title: "Snapshot saved",
        details: "Left branch checkpoint",
        actor: "system",
        source: "manual",
        sceneId: "scene_1",
        sceneName: "Retail Draft",
        timestamp: 456,
        revisionDepth: 2,
        affectedNodeIds: ["cam_1"],
        confidence: 0.95,
        lifecycleStage: "published",
        branchLabel: "published",
        parentEventId: "scene_created:scene_1:abc123",
        sceneSnapshot: leftScene,
      },
      {
        id: "snapshot_saved:scene_1:right",
        kind: "snapshot_saved",
        title: "Snapshot saved",
        details: "Right branch checkpoint",
        actor: "system",
        source: "manual",
        sceneId: "scene_1",
        sceneName: "Retail Draft",
        timestamp: 789,
        revisionDepth: 2,
        affectedNodeIds: ["light_1"],
        confidence: 0.95,
        lifecycleStage: "published",
        branchLabel: "published",
        parentEventId: "scene_created:scene_1:abc123",
        sceneSnapshot: rightScene,
      },
    ];

    const comparison = compareOperationalEvidenceBranches(events, "snapshot_saved:scene_1:left", "snapshot_saved:scene_1:right");
    const mergeResult = mergeOperationalEvidenceBranchScenes(comparison);

    expect(mergeResult).not.toBeNull();
    expect(mergeResult?.conflicts).toHaveLength(0);
    expect(mergeResult?.mergedScene.cameras).toHaveLength(1);
    expect(mergeResult?.mergedScene.securityLights).toHaveLength(1);
    expect(mergeResult?.mergedScene.simulation).toBeUndefined();
  });
});
