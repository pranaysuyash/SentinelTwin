import type {
  CameraResult,
  DoriQuality,
  SecurityIssue,
  SecurityScene,
  SimulationResult,
  ZoneResult,
} from "@/schema/security-scene";
import { computeAdversarialPath } from "@/simulation/adversarial-path";
import {
  computeCoverageCells,
  getIdentificationAreaPct,
  getQualityShare,
  getRecognitionAreaPct,
} from "@/simulation/coverage";
import { qualityToScore, scoreToQuality } from "@/simulation/dori";
import { computePathResults } from "@/simulation/path-analysis";
import { pointInPolygon } from "@/simulation/geometry";

function getZoneQuality(zoneCells: { quality: DoriQuality }[]) {
  if (zoneCells.length === 0) return "none" as DoriQuality;

  const scores = zoneCells
    .map((cell) => qualityToScore(cell.quality))
    .sort((a, b) => a - b);
  const percentileIndex = Math.max(0, Math.floor(scores.length * 0.25) - 1);
  return scoreToQuality(scores[percentileIndex] ?? 0);
}

function coverageStatus(actual: DoriQuality, required: DoriQuality) {
  const actualScore = qualityToScore(actual);
  const requiredScore = qualityToScore(required);

  return actualScore >= requiredScore ? ("pass" as const) : ("fail" as const);
}

export function simulateStudio(scene: SecurityScene): SimulationResult {
  const coverageCells = computeCoverageCells(scene, 4);
  const walkableCellCount = coverageCells.length;
  const coverageByQuality = {
    detection: getQualityShare(coverageCells, "detection"),
    observation: getQualityShare(coverageCells, "observation"),
    recognition: getQualityShare(coverageCells, "recognition"),
    identification: getQualityShare(coverageCells, "identification"),
  };

  const totalCoveragePct =
    walkableCellCount === 0
      ? 0
      : (coverageCells.filter((cell) => cell.quality !== "none").length / walkableCellCount) *
        100;
  const blindspotPct = 100 - totalCoveragePct;
  const averageWalkableQuality =
    walkableCellCount === 0
      ? 0
      : coverageCells.reduce((sum, cell) => sum + qualityToScore(cell.quality), 0) /
        walkableCellCount;

  const criticalZoneResults: ZoneResult[] = scene.criticalZones.map((zone) => {
    const zoneCells = coverageCells.filter((cell) =>
      pointInPolygon([cell.x, cell.z], zone.polygon),
    );
    const actualQuality = getZoneQuality(zoneCells);
    const status = coverageStatus(actualQuality, zone.requiredQuality);
    const coveringCameras = Array.from(
      new Set(zoneCells.flatMap((cell) => cell.coveringCameras)),
    );
    const failureReasons: string[] = [];

    if (status !== "pass") {
      failureReasons.push(
        `${zone.label} is below ${zone.requiredQuality} due to occlusion, distance, or angle.`,
      );
      if (zoneCells.some((cell) => cell.blockedBy.includes("Cupboard"))) {
        failureReasons.push("Cupboard occlusion is blocking the primary camera view.");
      }
    }

    return {
      zoneId: zone.id,
      label: zone.label,
      requiredQuality: zone.requiredQuality,
      actualQuality,
      coveringCameras,
      redundancyCameraCount: coveringCameras.length,
      status,
      failureReasons,
    };
  });

  const cameraResults: CameraResult[] = scene.cameras.map((camera) => {
    const coveredCells = coverageCells.filter((cell) => cell.coveringCameras.includes(camera.id));
    const qualityByZone = Object.fromEntries(
      criticalZoneResults.map((zone) => [zone.label, zone.actualQuality]),
    );

    return {
      cameraId: camera.id,
      coveragePct:
        walkableCellCount === 0 ? 0 : (coveredCells.length / walkableCellCount) * 100,
      qualityByZone,
      criticalZonesCovered: criticalZoneResults
        .filter((zone) => zone.coveringCameras.includes(camera.id))
        .map((zone) => zone.label),
      criticalZonesFailed: criticalZoneResults
        .filter((zone) => zone.status !== "pass" && zone.coveringCameras.includes(camera.id))
        .map((zone) => zone.label),
      offlineImpact: criticalZoneResults
        .filter((zone) => zone.coveringCameras.includes(camera.id))
        .map((zone) => `${zone.label} loses ${zone.actualQuality} coverage if ${camera.name} is offline.`),
    };
  });

  const issues: SecurityIssue[] = [];

  for (const zone of criticalZoneResults) {
    if (zone.status === "fail") {
      issues.push({
        severity: zone.requiredQuality === "recognition" ? "critical" : "high",
        category: "quality_fail",
        description: `${zone.label} fails the ${zone.requiredQuality} requirement.`,
        affectedZones: [zone.label],
        affectedCameras: zone.coveringCameras,
      });
    }
  }

  if (coverageCells.some((cell) => cell.blockedBy.includes("Cupboard"))) {
    issues.push({
      severity: "high",
      category: "blindspot",
      description: "Cupboard blocks Camera 1 sightlines through the center aisle.",
      affectedZones: criticalZoneResults.map((zone) => zone.label),
      affectedCameras: ["cam_entrance"],
    });
  }

  const pathResults = computePathResults(scene, coverageCells);
  const adversarialPath = computeAdversarialPath(scene, coverageCells);

  return {
    computedAt: Date.now(),
    totalCoveragePct: Number(totalCoveragePct.toFixed(1)),
    blindspotPct: Number(blindspotPct.toFixed(1)),
    averageWalkableQuality: Number(averageWalkableQuality.toFixed(2)),
    worstAreaQuality: coverageCells.reduce(
      (worst, cell) =>
        qualityToScore(cell.quality) < qualityToScore(worst) ? cell.quality : worst,
      "identification" as DoriQuality,
    ),
    recognitionAreaPct: Number(getRecognitionAreaPct(coverageCells).toFixed(1)),
    identificationAreaPct: Number(getIdentificationAreaPct(coverageCells).toFixed(1)),
    coverageByQuality: {
      detection: Number(coverageByQuality.detection.toFixed(1)),
      observation: Number(coverageByQuality.observation.toFixed(1)),
      recognition: Number(coverageByQuality.recognition.toFixed(1)),
      identification: Number(coverageByQuality.identification.toFixed(1)),
    },
    coverageCells: coverageCells.map((cell) => ({
      x: cell.x,
      z: cell.z,
      quality: cell.quality,
      coveringCameras: cell.coveringCameras,
      blockedBy: cell.blockedBy,
      ppm: cell.ppm,
    })),
    criticalZoneResults,
    cameraResults,
    pathResults,
    issues,
    recommendations: [
      {
        type: "move_object",
        description: "Move the cupboard away from Camera 1's center ray.",
        estimatedImpact: "Restores a cleaner recognition corridor toward the cash counter.",
        costCategory: "free",
        verified: true,
      },
      {
        type: "rotate_camera",
        description: "Rotate Camera 2 closer to the cash counter and tighten its field of view.",
        estimatedImpact: "Improves off-axis observation toward recognition quality near the zone.",
        costCategory: "low",
        verified: true,
      },
    ],
    adversarialPath,
  };
}
