import { describe, expect, test } from "bun:test";
import * as THREE from "three";
import type { CameraNode } from "@sentineltwin/core";
import { createCoverageEvaluator, computeCoverageCells } from "@sentineltwin/simulation";
import { createTestCamera, createTestScene } from "./helpers";
import { buildVisionColliderMesh, getVisionColliderSource } from "../vision-collider-mesh";
import type { GridCell } from "@sentineltwin/core";

// Import the internal function
import { evaluateCameraAgainstCell as importedEval } from "../coverage";

test("debug bounce - use actual evaluateCameraAgainstCell", () => {
  const scene = createTestScene({
    width: 8, depth: 8,
    cameras: [
      createTestCamera({
        id: "cam_test", position: [4, 2.5, 1],
        yawDeg: 180, pitchDeg: -25, fovHorizontalDeg: 80,
        rangeM: 12, clarity: "excellent",
      }),
    ],
  });

  scene.windows = [{
    id: "window_reflective", nodeType: "window" as const,
    label: "Reflective Window", position: [4, 1.5, 3],
    dimensions: [2.5, 3, 0.1], state: "reflective" as const,
    visionTransmission: 0.4,
    source: "manual", reviewStatus: "unreviewed",
    sourceTrace: "", geometryValidity: "valid",
  }];

  // Direct evaluation of target cell
  const evaluator = createCoverageEvaluator(scene);
  const direct = evaluator.evaluatePoint(scene.cameras[0], [4.125, 6.875]);
  console.log("DIRECT:", JSON.stringify({ quality: direct.quality, ppm: direct.ppm.toFixed(1), mt: direct.materialTransmission, gp: direct.glarePenalty, reasonCodes: direct.reasonCodes }));

  // Create virtual camera at mirror position
  const virtualCamera = structuredClone(scene.cameras[0]) as CameraNode;
  virtualCamera.position = [4, 2.5, 5]; // mirrored
  const target = new THREE.Vector3(4.125, 1.7, 6.875);
  const dir = target.clone().sub(new THREE.Vector3(4, 2.5, 5)).normalize();
  virtualCamera.yawDeg = THREE.MathUtils.radToDeg(Math.atan2(dir.x, -dir.z));
  virtualCamera.pitchDeg = THREE.MathUtils.radToDeg(Math.atan2(dir.y, Math.hypot(dir.x, dir.z)));

  // Check camera stats
  console.log("Virtual camera:", JSON.stringify({
    pos: virtualCamera.position, yaw: virtualCamera.yawDeg.toFixed(1), pitch: virtualCamera.pitchDeg.toFixed(1),
    mountType: virtualCamera.mountType, clarity: virtualCamera.clarity,
  }));

  // Manual evaluate
  const visionMesh = buildVisionColliderMesh(scene);
  const raycaster = new THREE.Raycaster();
  const cell: GridCell = { id: "cell", x: 4.125, z: 6.875, walkable: true, coverageIncluded: true, privacyRestricted: false };
  
  // Try with and without ignored source
  const bouncedWithIgnore = (() => {
    const origin = new THREE.Vector3(...virtualCamera.position);
    const targ = new THREE.Vector3(cell.x, 1.7, cell.z);
    const dist = origin.distanceTo(targ);
    const dirVec = targ.clone().sub(origin).normalize();
    const targetYaw = THREE.MathUtils.radToDeg(Math.atan2(dirVec.x, -dirVec.z));
    const targetPitch = THREE.MathUtils.radToDeg(Math.atan2(dirVec.y, Math.hypot(dirVec.x, dirVec.z)));
    const hAngle = targetYaw - virtualCamera.yawDeg;
    const vAngle = targetPitch - virtualCamera.pitchDeg;
    console.log("Bounce angles - targetYaw:" + targetYaw.toFixed(1) + " targetPitch:" + targetPitch.toFixed(1) + " hAngle:" + hAngle.toFixed(1) + " vAngle:" + vAngle.toFixed(1));

    raycaster.firstHitOnly = false;
    raycaster.set(origin, dirVec);
    const hits = raycaster.intersectObject(visionMesh.mesh, false);
    console.log("Bounce hits:", hits.length);
    for (const hit of hits) {
      const src = getVisionColliderSource(visionMesh.mesh, hit.faceIndex ?? undefined);
      console.log("  hit dist=" + hit.distance.toFixed(3) + " targetDist=" + dist.toFixed(3) + " src=" + src?.label + " id=" + src?.id + " ignored=" + (src?.id === "window_reflective"));
      if (hit.distance >= dist - 0.05) {
        console.log("  -> beyond target, stopping");
        break;
      }
      if (!src) { console.log("  -> no source, continuing"); continue; }
      if (src.id === "window_reflective") { console.log("  -> ignored (window), continuing"); continue; }
      console.log("  -> NOT IGNORED, would block! transmission=" + src.visionTransmission);
    }

    return dist;
  })();
  console.log("Bounce distance:", bouncedWithIgnore.toFixed(3));
});
