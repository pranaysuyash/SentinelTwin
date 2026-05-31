import { describe, expect, test } from "bun:test";
import * as THREE from "three";
import { createCoverageEvaluator, computeCoverageCells } from "@sentineltwin/simulation";
import { createTestCamera, createTestScene } from "./helpers";

test("debug bounce - manual trace", () => {
  const scene = createTestScene({
    width: 8,
    depth: 8,
    cameras: [
      createTestCamera({
        id: "cam_test",
        position: [4, 2.5, 1],
        yawDeg: 180,
        pitchDeg: -25,
        fovHorizontalDeg: 80,
        rangeM: 12,
        clarity: "excellent",
      }),
    ],
  });

  scene.windows = [
    {
      id: "window_reflective",
      nodeType: "window" as const,
      label: "Reflective Window",
      position: [4, 1.5, 3],
      dimensions: [2.5, 3, 0.1],
      state: "reflective" as const,
      visionTransmission: 0.4,
      source: "manual",
      reviewStatus: "unreviewed",
      sourceTrace: "",
      geometryValidity: "valid",
    },
  ];

  const evaluator = createCoverageEvaluator(scene);
  const cellPoint: [number, number] = [4.125, 6.875];
  const direct = evaluator.evaluatePoint(scene.cameras[0], cellPoint);

  // Manual mirror
  const mirrorZ = 2 * 3 - 1; // 2 * window.position[2] - camera.position[2]
  console.log("Mirrored Z:", mirrorZ);
  
  // Virtual camera at mirrored position, same yaw/pitch
  const mirroredCam = structuredClone(scene.cameras[0]);
  mirroredCam.position[2] = mirrorZ;
  
  // Calculate direction to target
  const origin = new THREE.Vector3(...mirroredCam.position);
  const target = new THREE.Vector3(4.125, 1.7, 6.875);
  const direction = target.clone().sub(origin).normalize();
  const targetYaw = THREE.MathUtils.radToDeg(Math.atan2(direction.x, -direction.z));
  const targetPitch = THREE.MathUtils.radToDeg(
    Math.atan2(direction.y, Math.hypot(direction.x, direction.z))
  );
  mirroredCam.yawDeg = targetYaw;
  mirroredCam.pitchDeg = targetPitch;

  console.log("Mirrored camera pos:", mirroredCam.position);
  console.log("Mirrored camera yaw:", targetYaw, "pitch:", targetPitch);

  const bounced = evaluator.evaluatePoint(mirroredCam, cellPoint);
  console.log("BOUNCED: visible:", bounced.visible, "quality:", bounced.quality,
    "ppm:", bounced.ppm, "blockedBy:", bounced.blockedBy,
    "inFov:", bounced.inFov, "withinRange:", bounced.withinRange,
    "mt:", bounced.materialTransmission, "gp:", bounced.glarePenalty,
    "distanceM:", bounced.distanceM,
    "reasonCodes:", JSON.stringify(bounced.reasonCodes));
  
  // Compute bounce quality with the multiplier formulas from evaluateReflectiveBounce
  const bouncedPpm = bounced.ppm * Math.max(0.7, Math.min(0.95, 0.75 + 0.4 * 0.15));
  console.log("Adjusted bounced PPM:", bouncedPpm);
});
