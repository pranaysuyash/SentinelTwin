import * as THREE from "three";
import type {
  CameraNode,
  DoriQuality,
  PlacementRecommendation,
  SecurityScene,
  ZoneResult,
} from "@sentineltwin/core";
import { createCoverageEvaluator } from "./coverage.js";
import { polygonCenter } from "@sentineltwin/core";
import { qualityToScore } from "@sentineltwin/core";

type CandidatePosition = {
  position: [number, number, number];
  yawDeg: number;
  pitchDeg: number;
};

function generateCandidates(
  scene: SecurityScene,
  failingZone: SecurityScene["criticalZones"][number],
): CandidatePosition[] {
  const candidates: CandidatePosition[] = [];
  const [zx, zz] = polygonCenter(failingZone.polygon);

  for (let angle = 0; angle < 360; angle += 30) {
    const rad = (angle * Math.PI) / 180;
    const distance = Math.min(scene.dimensions.width, scene.dimensions.depth) * 0.35;
    const cx = zx + Math.sin(rad) * distance;
    const cz = zz + Math.cos(rad) * distance;

    const clampedX = Math.max(1, Math.min(scene.dimensions.width - 1, cx));
    const clampedZ = Math.max(1, Math.min(scene.dimensions.depth - 1, cz));

    const dx = zx - clampedX;
    const dz = zz - clampedZ;
    const yawDeg = (Math.atan2(dx, dz) * 180) / Math.PI;

    candidates.push({
      position: [clampedX, 3.0, clampedZ],
      yawDeg: Math.round(yawDeg),
      pitchDeg: -30,
    });
  }

  return candidates;
}

function evaluateCandidate(
  scene: SecurityScene,
  candidate: CandidatePosition,
  zoneId: string,
): {
  quality: DoriQuality;
  coverageDelta: number;
  coveringCameraCount: number;
} {
  const clone = structuredClone(scene);
  const newCamera: CameraNode = {
    id: `oracle_candidate_${Date.now()}`,
    name: "Oracle Candidate",
    type: "fixed_dome",
    status: "on",
    position: candidate.position,
    yawDeg: candidate.yawDeg,
    pitchDeg: candidate.pitchDeg,
    fovDeg: 90,
    focalLengthMm: 4,
    sensorType: "1/2.8",
    irCapable: false,
    resolutionMp: 8,
  };
  clone.cameras.push(newCamera);
  const evaluator = createCoverageEvaluator(clone);
  const cells = evaluator.computeCoverageCells(4);
  const zone = clone.criticalZones.find((z) => z.id === zoneId);
  if (!zone) return { quality: "none", coverageDelta: 0, coveringCameraCount: 0 };

  const zoneCells = cells.filter((cell) => {
    const poly = zone.polygon;
    let inside = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const xi = poly[i][0], zi = poly[i][1];
      const xj = poly[j][0], zj = poly[j][1];
      if ((zi > cell.z) !== (zj > cell.z) && cell.x < ((xj - xi) * (cell.z - zi)) / (zj - zi) + xi) {
        inside = !inside;
      }
    }
    return inside;
  });

  let bestQuality: DoriQuality = "none";
  for (const zc of zoneCells) {
    const cellQuality = zc.cameraEvaluations?.[newCamera.id]?.quality ?? zc.quality;
    if (qualityToScore(cellQuality as DoriQuality) > qualityToScore(bestQuality)) {
      bestQuality = cellQuality as DoriQuality;
    }
  }

  const baselineEval = createCoverageEvaluator(scene);
  const baselineCells = baselineEval.computeCoverageCells(4);
  const baselineCovered = baselineCells.filter((c) => c.quality !== "none").length;
  const candidateCovered = cells.filter((c) => c.quality !== "none").length;
  const baselineTotal = baselineCells.length || 1;
  const candidateTotal = cells.length || 1;
  const coverageDelta =
    (candidateCovered / candidateTotal - baselineCovered / baselineTotal) * 100;

  const coveringCameraCount = zoneCells.filter(
    (zc) => (zc.cameraEvaluations?.[newCamera.id]?.quality ?? zc.quality) !== "none",
  ).length;

  return {
    quality: bestQuality,
    coverageDelta: Number(coverageDelta.toFixed(1)),
    coveringCameraCount,
  };
}

export function computePlacementOracle(
  scene: SecurityScene,
  coverageCells: {
    x: number;
    z: number;
    quality: string;
    coveringCameras: string[];
  }[],
  zoneResults: ZoneResult[],
): PlacementRecommendation[] {
  const recommendations: PlacementRecommendation[] = [];

  for (const zone of scene.criticalZones) {
    const zoneResult = zoneResults.find((zr) => zr.zoneId === zone.id);
    if (!zoneResult || zoneResult.status === "pass") continue;

    const candidates = generateCandidates(scene, zone);
    const evaluations = candidates.map((candidate) => ({
      candidate,
      result: evaluateCandidate(scene, candidate, zone.id),
    }));

    evaluations.sort(
      (a, b) => qualityToScore(b.result.quality) - qualityToScore(a.result.quality),
    );

    const best = evaluations[0];
    if (!best || best.result.quality === "none") continue;

    recommendations.push({
      zoneId: zone.id,
      zoneLabel: zone.label,
      suggestedPosition: best.candidate.position,
      suggestedYawDeg: best.candidate.yawDeg,
      suggestedPitchDeg: best.candidate.pitchDeg,
      expectedQuality: best.result.quality,
      coveringCameraCount: best.result.coveringCameraCount,
      coverageDelta: best.result.coverageDelta,
    });
  }

  return recommendations;
}
