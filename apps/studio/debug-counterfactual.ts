import { createBlankSecurityScene } from "./src/lib/scene-skeleton";
import { simulateStudioLite } from "@sentineltwin/simulation";
import { createCameraNode, createObstructionNode, createCriticalZoneNode } from "./src/lib/node-factory";
import { generateAndRankCounterfactuals } from "./src/simulation/counterfactual-engine";

const scene = createBlankSecurityScene();

const cam = createCameraNode([1.5, 2.5, 0], { yawDeg: 180, pitchDeg: -15, fovHorizontalDeg: 90 });
scene.cameras.push(cam);

const obs = createObstructionNode([3, 0, 2.5], "pillar", { dimensions: [0.5, 2.8, 0.5], movableByAI: true, visionTransmission: 0 });
scene.obstructions.push(obs);

const zone = createCriticalZoneNode([[3.5, 5], [6.5, 5], [6.5, 7.5], [3.5, 7.5]]);
scene.criticalZones.push(zone);

const baselineResult = simulateStudioLite(scene);
console.log("Baseline coverage:", baselineResult.totalCoveragePct);
console.log("Zone results:", baselineResult.criticalZoneResults.map(z => `${z.label}: ${z.status} (${z.coveragePct}%)`).join(", "));

const plans = generateAndRankCounterfactuals(scene, baselineResult, { maxBudget: 1000, noNewWiring: false, privacyPreserving: true });
console.log(`\n${plans.length} plans returned`);
for (const plan of plans) {
  console.log(`  ${plan.planId}: ${plan.label} — improve=${plan.simulatedImprovementPct}% coverage=${plan.simulatedCoveragePct}% actions=${plan.actions.map(a => a.type).join(",")}`);
}
