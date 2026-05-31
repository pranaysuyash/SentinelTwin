import type {
  CameraNode,
  CounterfactualResult,
  CounterfactualSearchResult,
  DoriQuality,
  ObstructionNode,
  SecurityScene,
  SimulationResult,
} from "@sentineltwin/core";
import { cloneSecuritySceneSimulation, qualityToScore } from "@sentineltwin/core";
import { simulateStudio } from "./simulate-studio";
import { polygonCenter } from "@sentineltwin/core";

/**
 * Search constraints — limits on what counterfactual candidates to consider.
 */
export type CounterfactualConstraints = {
  /** Camera IDs that cannot be moved/re-aimed */
  cameraCannotMoveIds?: string[];
  /** No new cameras can be added */
  noNewCamera?: boolean;
  /** Maximum cost category allowed */
  maxCostCategory?: "free" | "low" | "medium" | "high";
  /** No privacy zone violations allowed */
  noPrivacyViolation?: boolean;
  /** Maximum number of changes per candidate */
  maxChanges?: number;
  /** Specific zones to focus on (empty = all failing zones) */
  targetZoneIds?: string[];
};

const DEFAULT_CONSTRAINTS: Required<CounterfactualConstraints> = {
  cameraCannotMoveIds: [],
  noNewCamera: false,
  maxCostCategory: "high",
  noPrivacyViolation: false,
  maxChanges: 3,
  targetZoneIds: [],
};

const COST_RANK: Record<string, number> = { free: 0, low: 1, medium: 2, high: 3 };

/**
 * Generate and rank counterfactual candidates — each is a simulated fix
 * that gets evaluated, scored, and ranked by improvement.
 *
 * Core rule: AI proposes. Simulation verifies.
 * Every candidate's improvement is verified by running the full simulation.
 */
export function computeCounterfactualSearch(
  scene: SecurityScene,
  baseline: SimulationResult,
  constraints?: CounterfactualConstraints,
): CounterfactualSearchResult {
  const opts = { ...DEFAULT_CONSTRAINTS, ...constraints };
  const failingZones = baseline.criticalZoneResults
    .filter(z => z.status !== "pass")
    .filter(z => opts.targetZoneIds.length === 0 || opts.targetZoneIds.includes(z.zoneId));

  const candidates: CounterfactualResult[] = [];
  let candidateId = 0;

  const basePassCount = baseline.criticalZoneResults.filter(z => z.status === "pass").length;
  const baseTotalCount = baseline.criticalZoneResults.length;

  // ── Candidate type 1: Move obstruction away from failing zone ──
  for (const zone of failingZones) {
    const zoneDef = scene.criticalZones.find(z => z.id === zone.zoneId);
    if (!zoneDef) continue;

    for (const cameraId of zone.coveringCameras) {
      if (opts.cameraCannotMoveIds.includes(cameraId)) continue;

      const camera = scene.cameras.find(c => c.id === cameraId);
      if (!camera) continue;

      const patchedScene = cloneSecuritySceneSimulation(scene);
      const patchedCamera = patchedScene.cameras.find(c => c.id === cameraId);
      if (!patchedCamera) continue;

      const [zoneX, zoneZ] = polygonCenter(zoneDef.polygon);
      const dx = zoneX - patchedCamera.position[0];
      const dz = zoneZ - patchedCamera.position[2];
      patchedCamera.yawDeg = Math.round(Math.atan2(dx, dz) * (180 / Math.PI));
      patchedCamera.pitchDeg = -28;

      const result = simulateStudio(patchedScene);
      const zoneResult = result.criticalZoneResults.find(z => z.zoneId === zone.zoneId);
      const improved = zoneResult && qualityToScore(zoneResult.actualQuality) > qualityToScore(zone.actualQuality);

      const passAfter = result.criticalZoneResults.filter(z => z.status === "pass").length;
      const cost = assessCost("rotate_camera", camera.mountType);

      if (COST_RANK[cost] <= COST_RANK[opts.maxCostCategory]) {
        candidateId++;
        candidates.push({
          candidateId: `cf_${candidateId}`,
          description: `Re-aim "${camera.name}" toward "${zoneDef.label}"`,
          fixType: "rotate_camera",
          costCategory: cost,
          installDifficulty: "easy",
          constraintsOk: !opts.cameraCannotMoveIds.includes(cameraId),
          violatedConstraints: opts.cameraCannotMoveIds.includes(cameraId) ? ["cameraCannotMove"] : [],
          simulatedTotalCoveragePct: result.totalCoveragePct,
          simulatedWorstQuality: result.worstAreaQuality,
          simulatedZonePassCount: passAfter,
          simulatedZoneTotalCount: baseTotalCount,
          coverageDeltaPct: Number((result.totalCoveragePct - baseline.totalCoveragePct).toFixed(1)),
          qualityDeltaScore: result.averageWalkableQuality - baseline.averageWalkableQuality,
          zoneDelta: passAfter - basePassCount,
          adversarialExposureDelta: result.adversarialPath && baseline.adversarialPath
            ? result.adversarialPath.totalExposureScore - baseline.adversarialPath.totalExposureScore
            : undefined,
          score: computeCandidateScore(improved, zoneResult?.actualQuality, cost, passAfter - basePassCount),
          rank: 0,
          affectedNodeId: cameraId,
          suggestedYawDeg: patchedCamera.yawDeg,
          suggestedPitchDeg: patchedCamera.pitchDeg,
        });
      }
    }

    // Move obstruction — find movable obstructions near the zone
    const [zoneCx, zoneCz] = polygonCenter(zoneDef.polygon);
    const blockingObs = scene.obstructions.filter(o => {
      if (!o.movable) return false;
      const dist = Math.hypot(o.position[0] - zoneCx, o.position[2] - zoneCz);
      return dist < 3;
    });
    for (const obs of blockingObs) {
      if (!obs.movable) continue;

      const patchedScene = cloneSecuritySceneSimulation(scene);
      const patchedObs = patchedScene.obstructions.find(o => o.id === obs.id);
      if (!patchedObs) continue;

      const [zoneX, zoneZ] = polygonCenter(zoneDef.polygon);
      const ox = patchedObs.position[0];
      const oz = patchedObs.position[2];
      const vx = ox - zoneX;
      const vz = oz - zoneZ;
      const len = Math.hypot(vx, vz) || 1;
      const pushDist = Math.max(patchedObs.dimensions[0], patchedObs.dimensions[1]) + 1.2;
      patchedObs.position[0] = clamp(ox + (vx / len) * pushDist, 0.4, patchedScene.dimensions.width - 0.4);
      patchedObs.position[2] = clamp(oz + (vz / len) * pushDist, 0.4, patchedScene.dimensions.depth - 0.4);

      const result = simulateStudio(patchedScene);
      const zoneResult = result.criticalZoneResults.find(z => z.zoneId === zone.zoneId);
      const improved = zoneResult && qualityToScore(zoneResult.actualQuality) > qualityToScore(zone.actualQuality);

      const passAfter = result.criticalZoneResults.filter(z => z.status === "pass").length;
      const cost: "free" | "low" = obs.movableByAI ? "free" : "low";

      if (COST_RANK[cost] <= COST_RANK[opts.maxCostCategory]) {
        candidateId++;
        candidates.push({
          candidateId: `cf_${candidateId}`,
          description: `Move "${obs.label}" away from "${zoneDef.label}"`,
          fixType: "move_object",
          costCategory: cost,
          installDifficulty: "trivial",
          constraintsOk: true,
          violatedConstraints: [],
          simulatedTotalCoveragePct: result.totalCoveragePct,
          simulatedWorstQuality: result.worstAreaQuality,
          simulatedZonePassCount: passAfter,
          simulatedZoneTotalCount: baseTotalCount,
          coverageDeltaPct: Number((result.totalCoveragePct - baseline.totalCoveragePct).toFixed(1)),
          qualityDeltaScore: result.averageWalkableQuality - baseline.averageWalkableQuality,
          zoneDelta: passAfter - basePassCount,
          adversarialExposureDelta: result.adversarialPath && baseline.adversarialPath
            ? result.adversarialPath.totalExposureScore - baseline.adversarialPath.totalExposureScore
            : undefined,
          score: computeCandidateScore(improved, zoneResult?.actualQuality, cost, passAfter - basePassCount),
          rank: 0,
          affectedNodeId: obs.id,
          suggestedPosition: patchedObs.position,
        });
      }
    }
  }

  // ── Candidate type 2: Add camera (if noNewCamera is false) ──
  if (!opts.noNewCamera && opts.maxChanges >= 1) {
    const addCameraCandidates = generateAddCameraCandidates(scene, baseline, opts);
    for (const cand of addCameraCandidates) {
      if (candidates.length >= 20) break;
      candidates.push(cand);
    }
  }

  // ── Candidate type 3: Add light ──
  if (scene.assumptions.timeOfDay !== "day" && opts.maxChanges >= 1) {
    const addLightCandidates = generateAddLightCandidates(scene, baseline, opts);
    for (const cand of addLightCandidates) {
      if (candidates.length >= 20) break;
      candidates.push(cand);
    }
  }

  // Sort by score descending, assign rank
  candidates.sort((a, b) => b.score - a.score);
  for (let i = 0; i < candidates.length; i++) {
    candidates[i].rank = i + 1;
  }

  return {
    baselineLabel: "current",
    candidates,
    candidateCount: candidates.length,
    topRecommendationId: candidates.length > 0 ? candidates[0].candidateId : undefined,
    constraints: {
      cameraCannotMoveIds: opts.cameraCannotMoveIds,
      noNewCamera: opts.noNewCamera,
      maxCostCategory: opts.maxCostCategory,
      noPrivacyViolation: opts.noPrivacyViolation,
      maxChanges: opts.maxChanges,
    },
    computedAt: Date.now(),
  };
}

function generateAddCameraCandidates(
  scene: SecurityScene,
  baseline: SimulationResult,
  opts: Required<CounterfactualConstraints>,
): CounterfactualResult[] {
  const results: CounterfactualResult[] = [];
  const basePassCount = baseline.criticalZoneResults.filter(z => z.status === "pass").length;
  const baseTotalCount = baseline.criticalZoneResults.length;

  const addPositions: Array<{ x: number; z: number; label: string; mount: "wall" | "ceiling" }> = [];

  // Suggest positions near each failing zone center
  const failingZoneDefs = scene.criticalZones.filter(z =>
    baseline.criticalZoneResults.some(r => r.zoneId === z.id && r.status !== "pass"),
  );
  for (const zdef of failingZoneDefs) {
    const [cx, cz] = polygonCenter(zdef.polygon);
    addPositions.push({
      x: clamp(cx + 2, 0.4, scene.dimensions.width - 0.4),
      z: clamp(cz + 2, 0.4, scene.dimensions.depth - 0.4),
      label: `near_${zdef.label}`,
      mount: "ceiling",
    });
    addPositions.push({
      x: clamp(cx - 2, 0.4, scene.dimensions.width - 0.4),
      z: clamp(cz - 2, 0.4, scene.dimensions.depth - 0.4),
      label: `near_${zdef.label}_alt`,
      mount: "wall",
    });
  }

  let seen = new Set<string>();
  for (const pos of addPositions) {
    const key = `${pos.x.toFixed(1)},${pos.z.toFixed(1)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    if (results.length >= 5) break;

    const patchedScene = cloneSecuritySceneSimulation(scene);
    const template = scene.cameras[0];
    if (!template) continue;

    const newCam: CameraNode = {
      ...template,
      id: `cam_suggested_${results.length}`,
      name: `Suggested Camera ${results.length + 1}`,
      position: [pos.x, 3.0, pos.z],
      yawDeg: 0,
      pitchDeg: -30,
      mountType: pos.mount,
      status: "on",
      source: "manual",
      reviewStatus: "unreviewed",
      sourceTrace: "counterfactual-search",
      geometryValidity: "valid",
      tags: ["suggested"],
    };
    patchedScene.cameras.push(newCam);

    const result = simulateStudio(patchedScene);
    const passAfter = result.criticalZoneResults.filter(z => z.status === "pass").length;

    results.push({
      candidateId: `cf_addcam_${results.length + 1}`,
      description: `Add camera at ${pos.label} (${pos.x.toFixed(1)}, ${pos.z.toFixed(1)})`,
      fixType: "add_camera",
      costCategory: "medium",
      installDifficulty: "moderate",
      estimatedCost: "$200–$800",
      constraintsOk: !opts.noNewCamera,
      violatedConstraints: opts.noNewCamera ? ["noNewCamera"] : [],
      simulatedTotalCoveragePct: result.totalCoveragePct,
      simulatedWorstQuality: result.worstAreaQuality,
      simulatedZonePassCount: passAfter,
      simulatedZoneTotalCount: baseTotalCount,
      coverageDeltaPct: Number((result.totalCoveragePct - baseline.totalCoveragePct).toFixed(1)),
      qualityDeltaScore: result.averageWalkableQuality - baseline.averageWalkableQuality,
      zoneDelta: passAfter - basePassCount,
      score: passAfter > basePassCount ? 5 + (passAfter - basePassCount) * 2 : 1,
      rank: 0,
      suggestedPosition: [pos.x, 3.0, pos.z],
    });
  }

  return results;
}

function generateAddLightCandidates(
  scene: SecurityScene,
  baseline: SimulationResult,
  opts: Required<CounterfactualConstraints>,
): CounterfactualResult[] {
  const results: CounterfactualResult[] = [];
  const basePassCount = baseline.criticalZoneResults.filter(z => z.status === "pass").length;
  const baseTotalCount = baseline.criticalZoneResults.length;

  // Suggest adding a light at the center of each failing zone
  const failingZoneDefs = scene.criticalZones.filter(z =>
    baseline.criticalZoneResults.some(r => r.zoneId === z.id && r.status !== "pass"),
  );

  for (const zdef of failingZoneDefs.slice(0, 3)) {
    const [cx, cz] = polygonCenter(zdef.polygon);
    const patchedScene = cloneSecuritySceneSimulation(scene);

    patchedScene.securityLights.push({
      id: `light_suggested_${results.length}`,
      nodeType: "security_light",
      name: `Suggested Light near ${zdef.label}`,
      lightType: "flood",
      position: [cx, 3.5, cz],
      yawDeg: 0,
      pitchDeg: -45,
      status: "on",
      brightness: "high",
      rangeM: 8,
      coneDeg: 90,
      emergencyPower: false,
      illuminatesNightCoverage: true,
      glareRisk: "low",
      source: "manual",
      reviewStatus: "unreviewed",
      sourceTrace: "counterfactual-search",
      geometryValidity: "valid",
    });

    const result = simulateStudio(patchedScene);
    const passAfter = result.criticalZoneResults.filter(z => z.status === "pass").length;

    results.push({
      candidateId: `cf_addlight_${results.length + 1}`,
      description: `Add flood light near "${zdef.label}"`,
      fixType: "add_light",
      costCategory: "low",
      installDifficulty: "easy",
      estimatedCost: "$50–$200",
      constraintsOk: true,
      violatedConstraints: [],
      simulatedTotalCoveragePct: result.totalCoveragePct,
      simulatedWorstQuality: result.worstAreaQuality,
      simulatedZonePassCount: passAfter,
      simulatedZoneTotalCount: baseTotalCount,
      coverageDeltaPct: Number((result.totalCoveragePct - baseline.totalCoveragePct).toFixed(1)),
      qualityDeltaScore: result.averageWalkableQuality - baseline.averageWalkableQuality,
      zoneDelta: passAfter - basePassCount,
      score: passAfter > basePassCount ? 4 + (passAfter - basePassCount) * 1.5 : 0.5,
      rank: 0,
    });
  }

  return results;
}

function assessCost(type: string, mountType?: string): "free" | "low" | "medium" | "high" {
  switch (type) {
    case "move_object":
      return "free";
    case "rotate_camera":
      return mountType === "pole" ? "medium" : "low";
    case "add_light":
      return "low";
    case "add_camera":
      return "medium";
    case "change_fov":
      return "free";
    default:
      return "high";
  }
}

function computeCandidateScore(
  improved: boolean | undefined,
  quality: DoriQuality | undefined,
  cost: string,
  zoneDelta: number,
): number {
  let score = 0;

  if (improved) score += 10;
  if (quality) score += qualityToScore(quality);

  const costPenalty: Record<string, number> = { free: 0, low: 2, medium: 5, high: 10 };
  score -= costPenalty[cost] ?? 5;

  score += zoneDelta * 3;

  return Math.max(0, score);
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}
