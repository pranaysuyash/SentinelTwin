import { describe, it, expect } from "vitest";
import { generateAndRankCounterfactuals } from "../counterfactual-engine";
import { createBlankSecurityScene } from "@/lib/scene-skeleton";
import { simulateStudioLite } from "@sentineltwin/simulation";
import { createCameraNode, createObstructionNode, createCriticalZoneNode } from "@/lib/node-factory";

describe("Counterfactual Engine", () => {
  it("should generate and rank plans requiring simulation", () => {
    const scene = createBlankSecurityScene();

    // Camera at south wall center, looking north into the room
    const cam = createCameraNode([4, 2.5, 0], { yawDeg: 180, pitchDeg: -15, fovHorizontalDeg: 90 });
    scene.cameras.push(cam);

    // Obstruction centered in front of the camera, covering the back half.
    // Moving it 3m to the right (+3 in X) clears the line of sight to the
    // critical zone behind it.
    const obs = createObstructionNode([4, 0, 3], "partition", {
      dimensions: [4, 2.8, 0.2],
      movableByAI: true,
      visionTransmission: 0,
    });
    scene.obstructions.push(obs);

    // Critical zone behind the obstruction — initially blocked, improves with move
    const zone = createCriticalZoneNode([[3, 5.5], [5, 5.5], [5, 7], [3, 7]]);
    scene.criticalZones.push(zone);

    const baselineResult = simulateStudioLite(scene);

    const plans = generateAndRankCounterfactuals(scene, baselineResult, {
      maxBudget: 1000,
      noNewWiring: false,
      privacyPreserving: true,
    });

    expect(plans.length).toBeGreaterThan(0);

    const firstPlan = plans[0];
    expect(firstPlan.simulationResult).toBeDefined();
    expect(firstPlan.simulatedCoveragePct).toBeDefined();

    const hasMoveAction = plans.some(p => p.actions.some(a => a.type === "move_object"));
    const hasRotateAction = plans.some(p => p.actions.some(a => a.type === "rotate_camera"));

    expect(hasMoveAction).toBe(true);
    expect(hasRotateAction).toBe(true);
  });
});
