import { describe, it, expect } from "vitest";
import { generateAndRankCounterfactuals } from "../counterfactual-engine";
import { createBlankSecurityScene } from "@/lib/scene-skeleton";
import { simulateStudioLite } from "../simulate-studio";
import { createCameraNode, createObstructionNode } from "@/lib/node-factory";

describe("Counterfactual Engine", () => {
  it("should generate and rank plans requiring simulation", () => {
    const scene = createBlankSecurityScene();
    const obs = createObstructionNode([5, 0, 5], "shelf");
    obs.movableByAI = true;
    scene.obstructions.push(obs);

    const cam = createCameraNode([0, 2.5, 0], 45);
    scene.cameras.push(cam);

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
