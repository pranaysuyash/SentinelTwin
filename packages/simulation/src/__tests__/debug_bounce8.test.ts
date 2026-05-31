import { describe, expect, test } from "bun:test";
import * as THREE from "three";
import type { CameraNode, SecurityScene } from "@sentineltwin/core";
import { DORI_THRESHOLDS, getDetectionProbability, getYawPitchDirection, maxQuality, normalizeAngle, qualityToScore, ppmToQuality } from "@sentineltwin/core";
import { getYawPitchTowardTarget as getYawPitch } from "@sentineltwin/core";
import { buildCoverageGrid, type GridCell } from "@sentineltwin/core";
import { computeBlindSpotPenalty, computeMountTiltPenalty } from "../mount-model";
import { buildVisionColliderMesh, getVisionColliderSource, type VisionColliderMesh } from "../vision-collider-mesh";
import { createTestCamera, createTestScene, findCellNear } from "./helpers";

// Copy of the exact makeEmptyEvaluation
function makeEmptyEvaluation(overrides: any) {
  return {
    quality: "none", ppm: 0, probability: 0, visible: false,
    blockedBy: undefined, inFov: false, withinRange: false,
    distanceM: Number.MAX_VALUE, hAngleDeg: 0, vAngleDeg: 0,
    edgePenaltyMultiplier: 0, clarityMultiplier: 1, materialTransmission: 1,
    glarePenalty: 0, lightingPenalty: 0, lightLevel: 0,
    illuminatedBy: [], shadowedBy: [], finalPpmMultiplier: 0,
    ...overrides,
  };
}

test("debug bounce - manual recreation with logging", () => {
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

  // Re-create what evaluateReflectiveBounce does step by step
  const visionMesh = buildVisionColliderMesh(scene);
  const raycaster = new THREE.Raycaster();
  const camera = scene.cameras[0];
  const cellX = 4.125, cellZ = 6.875;
  const targetHeightM = 1.7;
  const cameraPos: [number, number, number] = [camera.position[0], camera.position[1], camera.position[2]];
  
  function mirrorCameraAcrossWindow(cPos: [number, number, number], win: typeof scene.windows[0]): [number, number, number] {
    return [cPos[0], cPos[1], 2 * win.position[2] - cPos[2]];
  }

  for (const window of scene.windows) {
    if (window.state !== "reflective") continue;
    
    const cameraSide = cameraPos[2] - window.position[2];
    const targetSide = cellZ - window.position[2];
    console.log("cameraSide:", cameraSide, "targetSide:", targetSide, "signs differ:", Math.sign(cameraSide) !== Math.sign(targetSide));
    if (Math.abs(cameraSide) < 0.001 || Math.abs(targetSide) < 0.001 || Math.sign(cameraSide) === Math.sign(targetSide)) {
      console.log("  -> SKIPPED (same side or zero)");
      continue;
    }

    const mirroredPos = mirrorCameraAcrossWindow(cameraPos, window);
    console.log("mirroredPos:", mirroredPos);

    // Manual evaluatePoint for window visibility
    const windowCell: GridCell = { id: "pt", x: window.position[0], z: window.position[2], walkable: true, coverageIncluded: true, privacyRestricted: false };
    const origin = new THREE.Vector3(...camera.position);
    const target = new THREE.Vector3(window.position[0], window.position[1], window.position[2]);
    const direction = target.clone().sub(origin).normalize();
    const winDist = origin.distanceTo(target);
    const winYaw = THREE.MathUtils.radToDeg(Math.atan2(direction.x, -direction.z));
    const winPitch = THREE.MathUtils.radToDeg(Math.atan2(direction.y, Math.hypot(direction.x, direction.z)));
    const hAngle = normalizeAngle(winYaw - camera.yawDeg);
    const vAngle = winPitch - camera.pitchDeg;
    console.log("Window visibility: yaw=" + winYaw.toFixed(1) + " pitch=" + winPitch.toFixed(1) + " hAngle=" + hAngle.toFixed(1) + " vAngle=" + vAngle.toFixed(1));
    console.log("  FOV check: h=" + Math.abs(hAngle) + " <= " + (camera.fovHorizontalDeg/2) + "? " + (Math.abs(hAngle) <= camera.fovHorizontalDeg/2));
    // Actually just use evaluatePoint
    const windowVisibility = (() => {
      // Simple check: is window center visible?
      raycaster.set(origin, direction);
      const hits = raycaster.intersectObject(visionMesh.mesh, false);
      let blocked = false;
      for (const hit of hits) {
        if (hit.distance >= winDist - 0.05) break;
        const source = getVisionColliderSource(visionMesh.mesh, hit.faceIndex ?? undefined);
        if (source && source.id === window.id && source.visionTransmission > 0.05) {
          console.log("  Window hit: transmission=" + source.visionTransmission + " glare=" + source.glarePenalty);
          return { visible: true, ppm: 100 }; // simplified
        }
        if (source && source.visionTransmission <= 0.05) {
          blocked = true;
          break;
        }
      }
      return { visible: !blocked, ppm: 0 };
    })();
    console.log("Window visibility check:", JSON.stringify(windowVisibility));
    if (!windowVisibility.visible) { console.log("  -> SKIPPED (window not visible)"); continue; }

    // Now check bounced
    const virtualCamera = structuredClone(camera);
    virtualCamera.position = mirroredPos;
    const targVec = new THREE.Vector3(cellX, targetHeightM, cellZ);
    const dir = targVec.clone().sub(new THREE.Vector3(...mirroredPos)).normalize();
    virtualCamera.yawDeg = THREE.MathUtils.radToDeg(Math.atan2(dir.x, -dir.z));
    virtualCamera.pitchDeg = THREE.MathUtils.radToDeg(Math.atan2(dir.y, Math.hypot(dir.x, dir.z)));
    
    console.log("Virtual camera pos:", virtualCamera.position, "yaw:", virtualCamera.yawDeg.toFixed(1), "pitch:", virtualCamera.pitchDeg.toFixed(1));

    // Check bounced FOV
    const bounceDir = targVec.clone().sub(new THREE.Vector3(...mirroredPos)).normalize();
    const bYaw = THREE.MathUtils.radToDeg(Math.atan2(bounceDir.x, -bounceDir.z));
    const bPitch = THREE.MathUtils.radToDeg(Math.atan2(bounceDir.y, Math.hypot(bounceDir.x, bounceDir.z)));
    const bhAngle = normalizeAngle(bYaw - virtualCamera.yawDeg);
    const bvAngle = bPitch - virtualCamera.pitchDeg;
    console.log("Bounce: bYaw=" + bYaw.toFixed(1) + " bPitch=" + bPitch.toFixed(1) + " camYaw=" + virtualCamera.yawDeg.toFixed(1) + " camPitch=" + virtualCamera.pitchDeg.toFixed(1));
    console.log("Bounce hAngle=" + bhAngle.toFixed(2) + " vAngle=" + bvAngle.toFixed(2));
    console.log("Bounce FOV h:" + Math.abs(bhAngle) + " <= " + virtualCamera.fovHorizontalDeg/2 + "? " + (Math.abs(bhAngle) <= virtualCamera.fovHorizontalDeg/2));
    console.log("Bounce FOV v:" + Math.abs(bvAngle) + " <= " + virtualCamera.fovVerticalDeg/2 + "? " + (Math.abs(bvAngle) <= virtualCamera.fovVerticalDeg/2));

    // Check bounced occlusion
    const bOrigin = new THREE.Vector3(...mirroredPos);
    const bDist = bOrigin.distanceTo(targVec);
    const bDir = targVec.clone().sub(bOrigin).normalize();
    raycaster.firstHitOnly = false;
    raycaster.set(bOrigin, bDir);
    const bHits = raycaster.intersectObject(visionMesh.mesh, false);
    console.log("Bounce ray hits: " + bHits.length);
    for (const h of bHits) {
      const src = getVisionColliderSource(visionMesh.mesh, h.faceIndex ?? undefined);
      if (src) {
        console.log("  hit:", src.label, "dist:", h.distance.toFixed(3), "targetDist:", bDist.toFixed(3), "diff:", (h.distance - bDist).toFixed(3));
      }
    }
  }
});
