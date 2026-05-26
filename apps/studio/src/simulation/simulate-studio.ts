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

    // Data-driven failure reason: derive from actual blocked-by labels in the zone cells
    const failureReasons: string[] = [];
    if (status !== "pass") {
      failureReasons.push(
        `${zone.label} is below ${zone.requiredQuality} due to occlusion, distance, or angle.`,
      );
      const blockingObstructions = Array.from(
        new Set(zoneCells.flatMap((cell) => cell.blockedBy)),
      );
      if (blockingObstructions.length > 0) {
        failureReasons.push(
          `Blocked by: ${blockingObstructions.join(", ")}.`,
        );
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

  // Quality-fail issues: one per failing critical zone
  for (const zone of criticalZoneResults) {
    if (zone.status === "fail") {
      issues.push({
        severity: zone.requiredQuality === "recognition" || zone.requiredQuality === "identification"
          ? "critical"
          : "high",
        category: "quality_fail",
        description: `${zone.label} fails the ${zone.requiredQuality} requirement.`,
        affectedZones: [zone.label],
        affectedCameras: zone.coveringCameras,
      });
    }
  }

  // Data-driven blindspot issues: one per obstruction that is blocking cells in critical zones.
  // We never hardcode obstruction labels — we derive them from the simulation output.
  {
    // Build: obstruction label → set of zone labels it is blocking
    const obstructionToZones = new Map<string, Set<string>>();
    for (const zone of scene.criticalZones) {
      const zoneCells = coverageCells.filter((cell) =>
        pointInPolygon([cell.x, cell.z], zone.polygon),
      );
      for (const cell of zoneCells) {
        for (const obsLabel of cell.blockedBy) {
          if (!obstructionToZones.has(obsLabel)) {
            obstructionToZones.set(obsLabel, new Set());
          }
          obstructionToZones.get(obsLabel)!.add(zone.label);
        }
      }
    }

    for (const [obsLabel, affectedZoneSet] of obstructionToZones) {
      const affectedZoneList = Array.from(affectedZoneSet);
      // Cameras that fail zones this obstruction blocks
      const affectedCameraIds = cameraResults
        .filter((cr) =>
          cr.criticalZonesFailed.some((z) => affectedZoneSet.has(z)),
        )
        .map((cr) => cr.cameraId);

      issues.push({
        severity: "high",
        category: "blindspot",
        description: `${obsLabel} is obstructing coverage in: ${affectedZoneList.join(", ")}.`,
        affectedZones: affectedZoneList,
        affectedCameras: affectedCameraIds,
      });
    }
  }

  const pathResults = computePathResults(scene, coverageCells);
  const adversarialPath = computeAdversarialPath(scene, coverageCells);

  // worstAreaQuality: lowest quality among critical zone results.
  // Using zone results (not raw cell minimums) gives the most actionable answer:
  // "the worst-covered zone that actually matters" rather than "the darkest corner of the room."
  // Falls back to worst covered walkable cell quality when no zones are defined.
  const worstAreaQuality: DoriQuality =
    criticalZoneResults.length > 0
      ? criticalZoneResults.reduce(
          (worst, zone) =>
            qualityToScore(zone.actualQuality) < qualityToScore(worst)
              ? zone.actualQuality
              : worst,
          "identification" as DoriQuality,
        )
      : coverageCells
          .filter((cell) => cell.quality !== "none")
          .reduce(
            (worst, cell) =>
              qualityToScore(cell.quality) < qualityToScore(worst) ? cell.quality : worst,
            "identification" as DoriQuality,
          );

  // Data-driven recommendations: one per blocking obstruction + one for failing zone cameras
  const obstructionRecos: typeof criticalZoneResults extends ZoneResult[] ? never : never = undefined as never;
  void obstructionRecos;
  const blockingObstructions = Array.from(
    new Set(
      criticalZoneResults
        .flatMap((zone) =>
          coverageCells
            .filter((cell) => pointInPolygon([cell.x, cell.z], zone.polygon))
            .flatMap((cell) => cell.blockedBy),
        ),
    ),
  );

  const recommendations = [
    ...blockingObstructions.map((obsLabel) => ({
      type: "move_object" as const,
      description: `Move or reposition "${obsLabel}" to restore camera sightlines.`,
      estimatedImpact: `Removing this obstruction may restore camera coverage where it is currently blocked.`,
      costCategory: "free" as const,
      verified: false,
    })),
    ...criticalZoneResults
      .filter((zone) => zone.status === "fail" && zone.coveringCameras.length > 0)
      .slice(0, 1)
      .map((zone) => ({
        type: "rotate_camera" as const,
        description: `Adjust cameras covering "${zone.label}" to improve coverage toward ${zone.requiredQuality} quality.`,
        estimatedImpact: `Reducing camera-to-zone distance or angle may bring ${zone.label} above the ${zone.requiredQuality} threshold.`,
        costCategory: "low" as const,
        verified: false,
      })),
  ];

  return {
    computedAt: Date.now(),
    totalCoveragePct: Number(totalCoveragePct.toFixed(1)),
    blindspotPct: Number(blindspotPct.toFixed(1)),
    averageWalkableQuality: Number(averageWalkableQuality.toFixed(2)),
    worstAreaQuality,
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
    recommendations,
    adversarialPath,
  };
}
