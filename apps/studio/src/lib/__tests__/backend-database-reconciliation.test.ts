import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { BackendDatabase } from "@/lib/backend-database";
import type { SceneRecord } from "@sentineltwin/core";

function createMockSceneRecord(id: string, version: number, updatedAt = Date.now()): SceneRecord {
  return {
    id,
    siteId: "site_1",
    name: `Scene ${id} v${version}`,
    version,
    status: "published",
    createdAt: updatedAt - 10_000,
    updatedAt,
    publishedAt: updatedAt,
    publishedBy: null,
    sceneDataId: "data_1",
  };
}

describe("backend-database reconciliation & directory sync", () => {
  let tempDir: string;
  let testDb: BackendDatabase;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "sentineltwin-test-db-"));
    testDb = new BackendDatabase(tempDir);
  });

  afterEach(() => {
    try {
      rmSync(tempDir, { recursive: true, force: true });
    } catch {}
  });

  test("reconcileSceneRecord saves new record when none exists", () => {
    const scene = createMockSceneRecord("scene_new_1", 1);
    const result = testDb.reconcileSceneRecord(scene, "user_1", "ws_1");

    expect(result.status).toBe("applied");
    expect(result.result.version).toBe(1);
    expect(testDb.getSceneRecord("scene_new_1")?.name).toBe("Scene scene_new_1 v1");
  });

  test("reconcileSceneRecord applies newer version cleanly (forward progression)", () => {
    const v1 = createMockSceneRecord("scene_prog_1", 1);
    testDb.reconcileSceneRecord(v1);

    const v2 = createMockSceneRecord("scene_prog_1", 2, Date.now() + 1000);
    const result = testDb.reconcileSceneRecord(v2);

    expect(result.status).toBe("applied");
    expect(testDb.getSceneRecord("scene_prog_1")?.version).toBe(2);
  });

  test("reconcileSceneRecord registers conflict when stale/concurrent version submitted", () => {
    const v5 = createMockSceneRecord("scene_conf_1", 5, Date.now() + 5000);
    testDb.reconcileSceneRecord(v5);

    // Incoming client submits v3 after server already advanced to v5
    const staleV3 = createMockSceneRecord("scene_conf_1", 3, Date.now() + 6000);
    const result = testDb.reconcileSceneRecord(staleV3, "user_2", "ws_1");

    expect(result.status).toBe("conflict_pending");
    expect(result.conflict).toBeDefined();
    expect(result.conflict?.serverVersion).toBe(5);
    expect(result.conflict?.clientVersion).toBe(3);
    expect(result.conflict?.resolutionStatus).toBe("pending");

    const pending = testDb.getPendingConflicts("scene_conf_1");
    expect(pending.length).toBe(1);
  });

  test("resolveConflict resolves pending conflict and promotes client record when client_wins", () => {
    const v5 = createMockSceneRecord("scene_res_1", 5, Date.now() + 5000);
    testDb.reconcileSceneRecord(v5);

    const clientV3 = createMockSceneRecord("scene_res_1", 3, Date.now() + 6000);
    testDb.reconcileSceneRecord(clientV3);

    const resolution = testDb.resolveConflict("scene_res_1", "client_wins", clientV3);
    expect(resolution?.resolutionStatus).toBe("resolved");

    const promoted = testDb.getSceneRecord("scene_res_1");
    expect(promoted?.version).toBe(6); // Promoted to serverVersion + 1
  });

  test("syncRemoteDirectory processes batch of remote scenes accurately", () => {
    const sceneA = createMockSceneRecord("remote_a", 1);
    const sceneB = createMockSceneRecord("remote_b", 2);
    testDb.reconcileSceneRecord(createMockSceneRecord("remote_b", 5)); // Server has v5 for remote_b

    const summary = testDb.syncRemoteDirectory("ws_1", [sceneA, sceneB]);
    expect(summary.synchedCount).toBe(1); // remote_a applied
    expect(summary.conflictCount).toBe(1); // remote_b conflicted against v5
  });
});
