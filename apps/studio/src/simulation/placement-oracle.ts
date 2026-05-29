import * as THREE from "three";

import type {
  CameraNode,
  CoverageCellResult,
  CriticalZoneNode,
  DoriQuality,
  SecurityScene,
  ZoneResult,
} from "@/schema/security-scene";
import { createCoverageEvaluator } from "@/simulation/coverage";
import { polygonCenter } from "@/simulation/geometry";
import { qualityToScore } from "@/simulation/dori";

export type PlacementMountType = "wall" | "ceiling";

export interface PlacementOracleCandidate {
  position: [number, number, number];
  mountType: PlacementMountType;
  yawDeg: number;
  pitchDeg: number;
  templateCameraId: string | null;
  estimatedCoverageDeltaPct: number;
  estimatedRecognitionDeltaPct: number;
  estimatedIdentificationDeltaPct: number;
  estimatedCriticalZoneGain: number;
  improvedCriticalZones: string[];
  privacyZoneHits: string[];
  score: number;
}

export interface PlacementOracleResult {
  sampleCount: number;
  templateCameraId: string | null;
  candidateCount: number;
  bestCandidate: PlacementOracleCandidate | null;
  candidates: PlacementOracleCandidate[];
}

type SampleTarget = {
  point: [number, number];
  heightM: number;
  label: string;
  kind: "critical" | "fragile" | "blind" | "privacy";
  weight: number;
  baselineQuality: DoriQuality;
};

const PRIORITY_WEIGHT: Record<CriticalZoneNode["priority"], number> = {
  low: 1,
  medium: 2,
  high: 3,
  critical: 4,
};

function getTemplateCamera(scene: SecurityScene) {
  const activeCameras = scene.cameras.filter((camera) => camera.status === "on");
  const camera = [...activeCameras].sort((a, b) => {
    const resDelta = b.resolutionMP - a.resolutionMP;
    if (resDelta !== 0) return resDelta;
    const rangeDelta = b.rangeM - a.rangeM;
    if (rangeDelta !== 0) return rangeDelta;
    return a.id.localeCompare(b.id);
  })[0];

  if (camera) {
    return camera;
  }

  return {
    id: "cam_oracle_template",
    nodeType: "camera" as const,
    name: "Oracle Template Camera",
    position: [scene.dimensions.width / 2, scene.dimensions.height - 0.25, scene.dimensions.depth / 2] as [number, number, number],
    yawDeg: 180,
    pitchDeg: -25,
    rollDeg: 0,
    mountType: "wall" as const,
    mountHeightM: 2.5,
    fovHorizontalDeg: 90,
    fovVerticalDeg: 60,
    rangeM: Math.max(scene.dimensions.width, scene.dimensions.depth),
    resolutionMP: 4,
    resolutionWidth: 1920,
    resolutionHeight: 1080,
    lensType: "fixed" as const,
    focalLengthMm: 2.8,
    status: "on" as const,
    nightMode: "none" as const,
    irRangeM: 0,
    thermalCapable: false,
    ptz: false,
    clarity: "excellent" as const,
    source: "demo" as const,
    tags: [],
  };
}

function getAimPoint(scene: SecurityScene): [number, number, number] {
  if (scene.criticalZones.length === 0) {
    return [scene.dimensions.width / 2, Math.max(scene.assumptions.personHeightM, 1.2), scene.dimensions.depth / 2];
  }

  const weighted = scene.criticalZones.reduce(
    (acc, zone) => {
      const [x, z] = polygonCenter(zone.polygon);
      const weight = PRIORITY_WEIGHT[zone.priority];
      return {
        x: acc.x + x * weight,
        z: acc.z + z * weight,
        w: acc.w + weight,
      };
    },
    { x: 0, z: 0, w: 0 },
  );

  return [
    weighted.x / Math.max(weighted.w, 1),
    Math.max(scene.assumptions.personHeightM, 1.2),
    weighted.z / Math.max(weighted.w, 1),
  ];
}

function toYawPitch(origin: [number, number, number], target: [number, number, number]) {
  const direction = new THREE.Vector3(target[0] - origin[0], target[1] - origin[1], target[2] - origin[2]).normalize();
  const yaw = THREE.MathUtils.radToDeg(Math.atan2(direction.x, -direction.z));
  const pitch = THREE.MathUtils.radToDeg(Math.atan2(direction.y, Math.hypot(direction.x, direction.z)));
  return { yawDeg: yaw, pitchDeg: pitch };
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function axisPositions(length: number, margin: number, step: number) {
  const values: number[] = [];
  const start = margin;
  const end = Math.max(start, length - margin);
  for (let value = start; value <= end + 0.001; value += step) {
    values.push(Number(value.toFixed(2)));
  }
  if (values.length === 0) {
    values.push(Number((length / 2).toFixed(2)));
  }
  const center = Number((length / 2).toFixed(2));
  if (!values.includes(center)) {
    values.push(center);
  }
  return Array.from(new Set(values)).sort((a, b) => a - b);
}

function buildMountCandidates(scene: SecurityScene): Array<{ position: [number, number, number]; mountType: PlacementMountType }> {
  const width = scene.dimensions.width;
  const depth = scene.dimensions.depth;
  const margin = clamp(Math.min(width, depth) * 0.08, 0.35, 0.9);
  const wallHeight = clamp(scene.assumptions.wallHeightM - 0.25, 1.9, scene.dimensions.height - 0.25);
  const ceilingHeight = scene.dimensions.height - 0.18;
  const wallStep = clamp(Math.min(width, depth) / 4, 1.0, 1.75);
  const ceilingStep = clamp(Math.min(width, depth) / 3, 1.25, 2.25);

  const candidates: Array<{ position: [number, number, number]; mountType: PlacementMountType }> = [];

  for (const x of axisPositions(width, margin, wallStep)) {
    candidates.push({ position: [x, wallHeight, margin], mountType: "wall" });
    candidates.push({ position: [x, wallHeight, Math.max(0.1, depth - margin)], mountType: "wall" });
  }

  for (const z of axisPositions(depth, margin, wallStep)) {
    candidates.push({ position: [margin, wallHeight, z], mountType: "wall" });
    candidates.push({ position: [Math.max(0.1, width - margin), wallHeight, z], mountType: "wall" });
  }

  const ceilingX = axisPositions(width, margin, ceilingStep);
  const ceilingZ = axisPositions(depth, margin, ceilingStep);
  for (const x of ceilingX) {
    for (const z of ceilingZ) {
      candidates.push({ position: [x, ceilingHeight, z], mountType: "ceiling" });
    }
  }

  return candidates;
}

function getQualitySampleTargets(
  scene: SecurityScene,
  baselineCells: CoverageCellResult[],
  baselineZones: ZoneResult[],
): SampleTarget[] {
  const targets: SampleTarget[] = [];
  const baselineByCell = new Map(
    baselineCells.map((cell) => [`${cell.x.toFixed(2)}:${cell.z.toFixed(2)}`, cell]),
  );
  const criticalCentres = scene.criticalZones.map((zone) => {
    const [x, z] = polygonCenter(zone.polygon);
    const centreCell = baselineCells.reduce((best, cell) => {
      const bestDistance = best ? Math.hypot(best.x - x, best.z - z) : Number.POSITIVE_INFINITY;
      const candidateDistance = Math.hypot(cell.x - x, cell.z - z);
      return candidateDistance < bestDistance ? cell : best;
    }, undefined as CoverageCellResult | undefined);

    return {
      point: [x, z] as [number, number],
      heightM: Math.max(0.75, Math.min(scene.dimensions.height - 0.25, zone.heightM * 0.75)),
      label: zone.label,
      kind: "critical" as const,
      weight: PRIORITY_WEIGHT[zone.priority] * 6,
      baselineQuality:
        baselineZones.find((entry) => entry.label === zone.label)?.actualQuality
        ?? centreCell?.quality
        ?? zone.requiredQuality,
    };
  });

  targets.push(...criticalCentres);

  const fragileCells = [...baselineCells]
    .filter((cell) => cell.coverageIncluded && cell.quality !== "none")
    .sort((a, b) => {
      const fragilityDelta = (b.fragility ?? 0) - (a.fragility ?? 0);
      if (Math.abs(fragilityDelta) > 1e-6) return fragilityDelta;
      return qualityToScore(a.quality) - qualityToScore(b.quality);
    })
    .slice(0, 12);

  for (const cell of fragileCells) {
    const distanceToCritical = scene.criticalZones.length === 0
      ? 0
      : Math.min(
        ...scene.criticalZones.map((zone) => {
          const [cx, cz] = polygonCenter(zone.polygon);
          return Math.hypot(cell.x - cx, cell.z - cz);
        }),
      );

    targets.push({
      point: [cell.x, cell.z],
      heightM: scene.assumptions.personHeightM,
      label: `Fragile cell ${cell.x.toFixed(1)}, ${cell.z.toFixed(1)}`,
      kind: "fragile",
      weight: 1 + (cell.fragility ?? 0) * 3 + (distanceToCritical <= 1.5 ? 1.5 : 0),
      baselineQuality: cell.quality,
    });
  }

  const blindCells = baselineCells
    .filter((cell) => cell.coverageIncluded && cell.quality === "none")
    .slice(0, 10);

  for (const cell of blindCells) {
    targets.push({
      point: [cell.x, cell.z],
      heightM: scene.assumptions.personHeightM,
      label: `Blind cell ${cell.x.toFixed(1)}, ${cell.z.toFixed(1)}`,
      kind: "blind",
      weight: 1.8,
      baselineQuality: "none",
    });
  }

  for (const zone of scene.privacyZones) {
    const [x, z] = polygonCenter(zone.polygon);
    const cell = baselineByCell.get(`${x.toFixed(2)}:${z.toFixed(2)}`);
    targets.push({
      point: [x, z],
      heightM: scene.assumptions.personHeightM,
      label: zone.label,
      kind: "privacy",
      weight: -4,
      baselineQuality: cell?.quality ?? "none",
    });
  }

  return targets;
}

function evaluateCandidate(
  scene: SecurityScene,
  candidate: PlacementOracleCandidate,
  targetSamples: SampleTarget[],
) {
  const evaluator = createCoverageEvaluator(scene);
  const cameraTemplate = getTemplateCamera(scene);
  const camera = {
    ...cameraTemplate,
    id: `${cameraTemplate.id}_oracle`,
    name: `${cameraTemplate.name} Oracle`,
    position: candidate.position,
    mountType: candidate.mountType,
    yawDeg: candidate.yawDeg,
    pitchDeg: candidate.pitchDeg,
    source: "manual" as const,
  };

  const privacyHits = new Set<string>();
  const improvedCriticalZones = new Set<string>();
  let weightedScore = 0;
  let coverageImprovedWeight = 0;
  let recognitionImprovedWeight = 0;
  let identificationImprovedWeight = 0;
  let criticalGain = 0;
  let totalWeight = 0;

  for (const sample of targetSamples) {
    const candidateEval = evaluator.evaluatePoint(camera as CameraNode, sample.point, sample.heightM);
    const baseScore = qualityToScore(sample.baselineQuality);
    const nextScore = qualityToScore(candidateEval.quality);
    const delta = nextScore - baseScore;
    const weight = Math.max(0.1, Math.abs(sample.weight));
    totalWeight += weight;

    if (sample.kind === "privacy" && candidateEval.visible && candidateEval.quality !== "none") {
      privacyHits.add(sample.label);
    }

    if (sample.kind === "critical" && delta > 0) {
      improvedCriticalZones.add(sample.label);
      criticalGain += delta * weight;
    }

    weightedScore += delta * weight * (sample.kind === "critical" ? 2.4 : sample.kind === "fragile" ? 1.4 : 1);

    if (delta > 0) {
      coverageImprovedWeight += weight;
    }

    if (nextScore >= qualityToScore("recognition")) {
      recognitionImprovedWeight += weight;
    }
    if (nextScore >= qualityToScore("identification")) {
      identificationImprovedWeight += weight;
    }
  }

  const privacyPenalty = privacyHits.size * 4;
  const totalSignal = weightedScore - privacyPenalty;

  return {
    ...candidate,
    estimatedCoverageDeltaPct: Number(((coverageImprovedWeight / Math.max(totalWeight, 1)) * 100).toFixed(1)),
    estimatedRecognitionDeltaPct: Number(((recognitionImprovedWeight / Math.max(totalWeight, 1)) * 100).toFixed(1)),
    estimatedIdentificationDeltaPct: Number(((identificationImprovedWeight / Math.max(totalWeight, 1)) * 100).toFixed(1)),
    estimatedCriticalZoneGain: Number(criticalGain.toFixed(2)),
    improvedCriticalZones: Array.from(improvedCriticalZones),
    privacyZoneHits: Array.from(privacyHits),
    score: Number(totalSignal.toFixed(2)),
  } satisfies PlacementOracleCandidate;
}

export function computePlacementOracle(
  scene: SecurityScene,
  baselineCoverageCells: CoverageCellResult[],
  baselineZones: ZoneResult[],
): PlacementOracleResult {
  const templateCamera = getTemplateCamera(scene);
  const sampleTargets = getQualitySampleTargets(scene, baselineCoverageCells, baselineZones);
  const aimPoint = getAimPoint(scene);

  const candidates = buildMountCandidates(scene).map((candidate) => {
    const { yawDeg, pitchDeg } = toYawPitch(candidate.position, aimPoint);
    return evaluateCandidate(scene, {
      position: candidate.position,
      mountType: candidate.mountType,
      yawDeg,
      pitchDeg,
      templateCameraId: templateCamera?.id ?? null,
      estimatedCoverageDeltaPct: 0,
      estimatedRecognitionDeltaPct: 0,
      estimatedIdentificationDeltaPct: 0,
      estimatedCriticalZoneGain: 0,
      improvedCriticalZones: [],
      privacyZoneHits: [],
      score: 0,
    }, sampleTargets);
  });

  candidates.sort((a, b) => b.score - a.score);
  const topCandidates = candidates.slice(0, 5);

  return {
    sampleCount: sampleTargets.length,
    templateCameraId: templateCamera?.id ?? null,
    candidateCount: candidates.length,
    bestCandidate: topCandidates[0] ?? null,
    candidates: topCandidates,
  };
}
