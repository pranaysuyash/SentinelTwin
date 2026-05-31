import { describe, expect, test } from "bun:test";
import { createCoverageEvaluator, computeCoverageCells } from "@sentineltwin/simulation";
import { createTestCamera, createTestScene, findCellNear } from "./helpers";

test("debug reflective bounce", () => {
  const scene = createTestScene({
    width: 8,
    depth: 8,
    cameras: [
      createTestCamera({
        id: "cam_test",
        position: [4, 2.5, 1],
        yawDeg: 180,
        pitchDeg: -25,
        fovHorizontalDeg: 70,
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
      position: [4, 1.2, 3],
      dimensions: [2.5, 1.8, 0.1],
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
  console.log("DIRECT: visible:", direct.visible, "quality:", direct.quality, "blockedBy:", direct.blockedBy, "reasonCodes:", JSON.stringify(direct.reasonCodes));

  const cells = computeCoverageCells(scene, 4);
  const target = findCellNear(cells, 4.125, 6.875);

  console.log("CELL quality:", target.quality, "coveringCameras:", target.coveringCameras);
  const ce = target.cameraEvaluations?.cam_test;
  if (ce) {
    console.log("CELL eval visible:", ce.visible, "quality:", ce.quality, "inFov:", ce.inFov, "reasonCodes:", JSON.stringify(ce.reasonCodes));
  } else {
    console.log("CELL no cam_test eval");
  }
});
