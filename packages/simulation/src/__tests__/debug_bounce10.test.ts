import { describe, expect, test } from "bun:test";
import { computeCoverageCells } from "@sentineltwin/simulation";
import { buildCoverageGrid } from "@sentineltwin/core";
import { createTestCamera, createTestScene, findCellNear } from "./helpers";

test("debug - is cell walkable?", () => {
  const width = 8, depth = 6;
  const scene = createTestScene({
    width, depth,
    walls: [
      { id: "wall_left", nodeType: "wall", label: "Left", start: [0, 0], end: [0, depth], heightM: 3, thicknessM: 0.2, material: "solid", visionTransmission: 0, source: "manual", reviewStatus: "unreviewed", sourceTrace: "", geometryValidity: "valid" },
      { id: "wall_right", nodeType: "wall", label: "Right", start: [width, 0], end: [width, depth], heightM: 3, thicknessM: 0.2, material: "solid", visionTransmission: 0, source: "manual", reviewStatus: "unreviewed", sourceTrace: "", geometryValidity: "valid" },
      { id: "wall_top", nodeType: "wall", label: "Top", start: [0, 0], end: [width, 0], heightM: 3, thicknessM: 0.2, material: "solid", visionTransmission: 0, source: "manual", reviewStatus: "unreviewed", sourceTrace: "", geometryValidity: "valid" },
      { id: "wall_bottom", nodeType: "wall", label: "Bottom", start: [0, depth], end: [width, depth], heightM: 3, thicknessM: 0.2, material: "solid", visionTransmission: 0, source: "manual", reviewStatus: "unreviewed", sourceTrace: "", geometryValidity: "valid" },
    ],
    cameras: [
      createTestCamera({
        id: "cam_bounce",
        position: [1.5, 2.5, 1],
        yawDeg: 90,
        pitchDeg: -25,
        mountType: "wall",
        rangeM: 12,
      }),
    ],
    windows: [{
      id: "window_reflective", nodeType: "window" as const,
      label: "Reflective Glass",
      position: [4, 1.5, 3],
      dimensions: [1, 3, 0.05],
      state: "reflective" as const,
      visionTransmission: 0.25,
      source: "manual", reviewStatus: "unreviewed",
      sourceTrace: "", geometryValidity: "valid",
    }],
  });

  // Check grid
  const { cells } = buildCoverageGrid(scene, 4);
  console.log("Total grid cells:", cells.length);
  const targetCell = cells.find(c => Math.abs(c.x - 5.5) < 0.01 && Math.abs(c.z - 3) < 0.01);
  if (targetCell) {
    console.log("Target cell found: x=" + targetCell.x + " z=" + targetCell.z + " walkable=" + targetCell.walkable + " coverageIncluded=" + targetCell.coverageIncluded);
  } else {
    console.log("Target cell NOT FOUND in grid");
    // Find nearest
    const near = cells.map(c => ({ cell: c, d: Math.hypot(c.x - 5.5, c.z - 3) })).sort((a, b) => a.d - b.d).slice(0, 5);
    for (const n of near) {
      console.log(`  Near: (${n.cell.x}, ${n.cell.z}) d=${n.d.toFixed(3)} walkable=${n.cell.walkable}`);
    }
  }

  // Now run coverage
  const covCells = computeCoverageCells(scene, 4);
  const targetCov = findCellNear(covCells, 5.5, 3);
  console.log("Coverage cell at (5.5, 3): quality=" + targetCov.quality);
  console.log("  cameraEvaluations keys:", Object.keys(targetCov.cameraEvaluations));
  const ce = targetCov.cameraEvaluations?.cam_bounce;
  if (ce) {
    console.log("  reasonCodes:", ce.reasonCodes);
  }
});
