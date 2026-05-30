import * as THREE from "three";
import { describe, expect, test } from "bun:test";

import {
  buildVisionColliderMesh,
  getVisionColliderSource,
} from "@sentineltwin/simulation";
import {
  createTestCamera,
  createTestObstruction,
  createTestScene,
} from "./helpers";

describe("buildVisionColliderMesh", () => {
  test("builds a BVH-backed mesh for walls and obstructions", () => {
    const scene = createTestScene({
      width: 6,
      depth: 4,
      obstructions: [
        createTestObstruction({
          id: "obs_solid",
          label: "Solid Shelf",
          position: [3, 1, 2],
          dimensions: [0.8, 0.8, 2],
          material: "solid",
          visionTransmission: 0,
        }),
        createTestObstruction({
          id: "obs_glass",
          label: "Glass Panel",
          position: [4.2, 1, 2],
          dimensions: [0.8, 0.8, 2],
          material: "glass",
          visionTransmission: 0.9,
        }),
      ],
    });

    const collider = buildVisionColliderMesh(scene);

    expect(collider.sources).toHaveLength(6);
    expect(collider.faceSources.length).toBeGreaterThan(0);
    expect(collider.mesh.geometry.boundsTree).toBeDefined();

    const raycaster = new THREE.Raycaster();
    const origin = new THREE.Vector3(...scene.cameras[0]!.position);
    const target = new THREE.Vector3(3, 1.4, 2);
    raycaster.set(origin, target.clone().sub(origin).normalize());

    const hits = raycaster.intersectObject(collider.mesh, false);
    expect(hits.length).toBeGreaterThan(0);

    const source = getVisionColliderSource(collider.mesh, hits[0]?.faceIndex ?? undefined);
    expect(source?.id).toBe("obs_solid");
    expect(source?.visionTransmission).toBe(0);
  });

  test("skips open doors while keeping closed windows in the collider mesh", () => {
    const scene = createTestScene({
      width: 6,
      depth: 4,
    });

    scene.doors = [
      {
        id: "door_open",
        nodeType: "door",
        label: "Open Door",
        position: [2.5, 1, 2],
        dimensions: [0.9, 2, 0.12],
        state: "open",
        source: "manual",
        reviewStatus: "unreviewed",
        sourceTrace: "",
        geometryValidity: "valid",
      },
    ];

    scene.windows = [
      {
        id: "window_glass",
        nodeType: "window",
        label: "Closed Glass Window",
        position: [4, 1, 2],
        dimensions: [0.9, 2, 0.08],
        state: "closed_glass",
        visionTransmission: 0.85,
        source: "manual",
        reviewStatus: "unreviewed",
        sourceTrace: "",
        geometryValidity: "valid",
      },
    ];

    const collider = buildVisionColliderMesh(scene);
    const sourceIds = collider.sources.map((source) => source.id);

    expect(sourceIds).not.toContain("door_open");
    expect(sourceIds).toContain("window_glass");
    expect(collider.sources).toHaveLength(5);
  });
});
