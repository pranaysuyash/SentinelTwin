import { describe, expect, test } from "bun:test";

import {
  buildVisionColliderMesh,
  disposeVisionColliderMesh,
  type VisionColliderMesh,
} from "../vision-collider-mesh";
import {
  BvhJsVisionBridge,
  WasmVisionBridge,
  createBridgeForScene,
  type RayBatchHit,
  type RayBatchRay,
  type VisionBridge,
} from "../wasm-vision-bridge";

/**
 * Build a tiny scene: a single 4 m × 0.2 m × 3 m wall at world position
 * (5, 1, 0). The wall's geometry is a Box centered on the position,
 * matching how `vision-collider-mesh` constructs wall colliders. We
 * pin the wall size and position so the parity test is independent of
 * the existing `WallNode` defaults.
 */
function buildSingleWallScene() {
  const wall = {
    id: "wall-1",
    start: [3, 0] as [number, number],
    end: [7, 0] as [number, number],
    heightM: 2,
    thicknessM: 0.2,
    material: "drywall" as const,
    visionTransmission: 0,
    label: "test wall",
    collisionLayer: { visionCollider: true, physicsCollider: true },
  };
  return { walls: [wall], obstructions: [], doors: [], windows: [], fenceSegments: [] };
}

function disposeBridgeAndCollider(
  collider: VisionColliderMesh,
  bridge: VisionBridge,
) {
  bridge.dispose();
  disposeVisionColliderMesh(collider);
}

function closeHits(hits: Array<RayBatchHit | null>): Array<{
  hasHit: boolean;
  t: number;
  sourceId: string;
} | null> {
  return hits.map((h) =>
    h
      ? {
          hasHit: true,
          t: Math.round(h.t * 1000) / 1000,
          sourceId: h.sourceId,
        }
      : null,
  );
}

describe("WASM vision bridge parity (BvhJsVisionBridge vs WasmVisionBridge)", () => {
  test("single wall: identical hits within ε for every ray", () => {
    const scene = buildSingleWallScene();
    const collider = buildVisionColliderMesh(scene);
    const js = new BvhJsVisionBridge(collider);
    const wasm = new WasmVisionBridge(collider);

    // Rays from positions inside the room looking +Z (toward the wall).
    const rays: RayBatchRay[] = [
      { originX: 5, originY: 1, originZ: -2, dirX: 0, dirY: 0, dirZ: 1, maxDistance: 20 },
      { originX: 4.5, originY: 0.5, originZ: -3, dirX: 0, dirY: 0, dirZ: 1, maxDistance: 20 },
      { originX: 5.5, originY: 1.5, originZ: -1, dirX: 0, dirY: 0, dirZ: 1, maxDistance: 20 },
      // A ray aimed above the wall (miss)
      { originX: 5, originY: 5, originZ: -2, dirX: 0, dirY: 0, dirZ: 1, maxDistance: 20 },
      // A ray aimed to the side (miss)
      { originX: 0, originY: 1, originZ: 0, dirX: 0, dirY: 0, dirZ: 1, maxDistance: 20 },
    ];

    const jsHits = closeHits(js.castRays(rays));
    const wasmHits = closeHits(wasm.castRays(rays));

    // JS and WASM must agree on every ray.
    expect(wasmHits).toEqual(jsHits);

    // Sanity: the three +Z rays hit the wall with the same sourceId.
    expect(jsHits[0]?.hasHit).toBe(true);
    expect(jsHits[1]?.hasHit).toBe(true);
    expect(jsHits[2]?.hasHit).toBe(true);
    expect(jsHits[0]?.sourceId).toBe("wall-1");
    expect(jsHits[3]).toBeNull();
    expect(jsHits[4]).toBeNull();

    disposeBridgeAndCollider(collider, js);
    disposeBridgeAndCollider(collider, wasm);
  });

  test("deterministic: same input → same output across calls", () => {
    const scene = buildSingleWallScene();
    const collider = buildVisionColliderMesh(scene);
    const bridge = new BvhJsVisionBridge(collider);
    const ray: RayBatchRay = {
      originX: 5, originY: 1, originZ: -2, dirX: 0, dirY: 0, dirZ: 1, maxDistance: 20,
    };
    const a = closeHits(bridge.castRays([ray]));
    const b = closeHits(bridge.castRays([ray]));
    expect(a).toEqual(b);
    disposeBridgeAndCollider(collider, bridge);
  });

  test("maxDistance cutoff is honored by both backends", () => {
    const scene = buildSingleWallScene();
    const collider = buildVisionColliderMesh(scene);
    const js = new BvhJsVisionBridge(collider);
    const wasm = new WasmVisionBridge(collider);
    const ray: RayBatchRay = {
      originX: 5, originY: 1, originZ: -2, dirX: 0, dirY: 0, dirZ: 1, maxDistance: 1.0,
    };
    // Wall is ~2m away; maxDistance 1.0 should miss.
    expect(js.castRays([ray])[0]).toBeNull();
    expect(wasm.castRays([ray])[0]).toBeNull();
    disposeBridgeAndCollider(collider, js);
    disposeBridgeAndCollider(collider, wasm);
  });

  test("createBridgeForScene wires collider + bridge together", () => {
    const { collider, bridge } = createBridgeForScene(buildSingleWallScene(), "wasm-spike");
    expect(bridge.backend).toBe("wasm-spike");
    const ray: RayBatchRay = {
      originX: 5, originY: 1, originZ: -2, dirX: 0, dirY: 0, dirZ: 1, maxDistance: 20,
    };
    const hit = bridge.castRays([ray])[0];
    expect(hit).not.toBeNull();
    expect(hit?.sourceId).toBe("wall-1");
    disposeBridgeAndCollider(collider, bridge);
  });
});
