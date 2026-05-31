import { describe, expect, test } from "bun:test";
import { createCoverageEvaluator, computeCoverageCells } from "@sentineltwin/simulation";
import { createTestCamera, createTestScene } from "./helpers";

test("debug bounce - compare columns", () => {
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
  
  // Column at x=4.125 (center - behind window center)
  const colCenter = cells.filter(c => Math.abs(c.x - 4.125) < 0.01).sort((a, b) => a.z - b.z);
  // Column at x=0.125 (far left - where bounce works)
  const colLeft = cells.filter(c => Math.abs(c.x - 0.125) < 0.01).sort((a, b) => a.z - b.z);
  
  console.log("=== Column x=4.125 (center, behind window) ===");
  for (const cell of colCenter) {
    const ce = cell.cameraEvaluations?.cam_test;
    const hasBounce = ce?.reasonCodes?.includes("REFLECTIVE_BOUNCE");
    if (Math.abs(cell.z - 6.875) < 0.3 || hasBounce) {
      console.log(`  z=${cell.z.toFixed(3)} q=${cell.quality} ppm=${cell.ppm.toFixed(1)} bounce=${hasBounce}`);
    }
  }

  console.log("=== Column x=0.125 (far left, bounce works) ===");
  for (const cell of colLeft) {
    const ce = cell.cameraEvaluations?.cam_test;
    const hasBounce = ce?.reasonCodes?.includes("REFLECTIVE_BOUNCE");
    if (hasBounce || Math.abs(cell.z - 6.875) < 0.3) {
      console.log(`  z=${cell.z.toFixed(3)} q=${cell.quality} ppm=${cell.ppm.toFixed(1)} bounce=${hasBounce}`);
    }
  }

  // Now manually check: what happens for cell (0.125, 6.875)?
  const cellBounce = cells.find(c => Math.abs(c.x - 0.125) < 0.01 && Math.abs(c.z - 6.875) < 0.01);
  if (cellBounce) {
    const ce = cellBounce.cameraEvaluations?.cam_test;
    console.log(`\nCell (0.125, 6.875): q=${cellBounce.quality} bounce=${ce?.reasonCodes?.includes("REFLECTIVE_BOUNCE")} rc=${JSON.stringify(ce?.reasonCodes)}`);
  }

  // Check: what about x=4.125, what z values start failing?
  console.log("\n=== Column x=4.125 - all z values ===");
  for (const cell of colCenter) {
    const ce = cell.cameraEvaluations?.cam_test;
    const hasBounce = ce?.reasonCodes?.includes("REFLECTIVE_BOUNCE");
    console.log(`  z=${cell.z.toFixed(3)} q=${cell.quality} ppm=${cell.ppm.toFixed(1)} bounce=${hasBounce}`);
  }
});
