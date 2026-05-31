import { describe, expect, test } from "bun:test";
import { createCoverageEvaluator, computeCoverageCells } from "@sentineltwin/simulation";
import { createTestCamera, createTestScene } from "./helpers";
import type { CellComputation } from "@sentineltwin/simulation";

test("debug bounce - find cells near target", () => {
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
  
  // Find nearest cells to (4.125, 6.875)
  const near = cells
    .map(c => ({ cell: c, dist: Math.hypot(c.x - 4.125, c.z - 6.875) }))
    .sort((a, b) => a.dist - b.dist)
    .slice(0, 10);
  
  console.log("Nearest cells to (4.125, 6.875):");
  for (const n of near) {
    const ce = n.cell.cameraEvaluations?.cam_test;
    const hasBounce = ce?.reasonCodes?.includes("REFLECTIVE_BOUNCE");
    console.log(`  (${n.cell.x.toFixed(3)}, ${n.cell.z.toFixed(3)}) dist=${n.dist.toFixed(3)} q=${n.cell.quality} ppm=${n.cell.ppm.toFixed(1)} bounce=${hasBounce} blockedBy=${ce?.blockedBy ?? "-"} rc=${JSON.stringify(ce?.reasonCodes ?? [])}`);
  }

  // Check a cell that definitely has bounce
  const bounceCells = cells.filter(c => c.cameraEvaluations?.cam_test?.reasonCodes?.includes("REFLECTIVE_BOUNCE"));
  console.log(`\nTotal bounce cells: ${bounceCells.length}`);
  if (bounceCells.length > 0) {
    const bc = bounceCells[0];
    const ce = bc.cameraEvaluations?.cam_test;
    console.log(`First bounce cell: (${bc.x}, ${bc.z}) q=${bc.quality} ppm=${bc.ppm}`);
    console.log(`  visible=${ce?.visible} inFov=${ce?.inFov} blockedBy=${ce?.blockedBy} rc=${JSON.stringify(ce?.reasonCodes)}`);
  }
});
