import { describe, expect, test } from "bun:test";
import * as THREE from "three";
import type { CameraNode, SecurityScene } from "@sentineltwin/core";
import { getYawPitchDirection, normalizeAngle } from "@sentineltwin/core";
import { createCoverageEvaluator, computeCoverageCells } from "@sentineltwin/simulation";
import { createTestCamera, createTestScene, findCellNear } from "./helpers";

test("debug bounce - trace all cells in z range", () => {
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

  const cells = computeCoverageCells(scene, 4);
  
  // Look at all cells at x≈4.125
  const colCells = cells.filter(c => Math.abs(c.x - 4.125) < 0.01);
  console.log(`Cells at x=4.125: ${colCells.length}`);
  
  // Check a few different z values
  for (const cell of colCells.sort((a, b) => a.z - b.z)) {
    const ce = cell.cameraEvaluations?.cam_test;
    const hasBounce = ce?.reasonCodes?.includes("REFLECTIVE_BOUNCE");
    
    if (cell.z >= 3 && cell.z <= 7) {
      console.log(`  z=${cell.z.toFixed(3)} q=${cell.quality} ppm=${cell.ppm.toFixed(1)} bounce=${hasBounce} blockedBy=${ce?.blockedBy ?? "-"} mt=${ce?.materialTransmission?.toFixed(2)} gp=${ce?.glarePenalty?.toFixed(2)} rc=${JSON.stringify(ce?.reasonCodes ?? [])}`);
    }
  }
});
