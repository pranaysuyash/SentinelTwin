import { describe, expect, test } from "bun:test";

import {
  createCameraNode,
  createObstructionNode,
  createPathNode,
  createSecurityLightNode,
} from "@/lib/node-factory";
import { createBlankSecurityScene } from "@/lib/scene-skeleton";
import type { OperationalEvidenceEvent } from "@/lib/operational-evidence";
import {
  assessOperationalEvidenceMergeReadiness,
  compareOperationalEvidenceBranches,
  findLatestOperationalEvidenceEventForScene,
  filterOperationalEvidenceEvents,
  mergeOperationalEvidenceBranchScenes,
  matchesOperationalEvidenceEvent,
  summarizeOperationalEvidenceBranchHeads,
  summarizeOperationalGovernanceTrail,
  summarizeOperationalEvidenceLifecycle,
  traceOperationalEvidenceLineage,
} from "@/lib/operational-evidence";

describe("operational evidence helpers", () => {
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
