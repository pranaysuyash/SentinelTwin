import type {
  CameraResult,
  CameraOfflineImpactEntry,
  DoriQuality,
  Recommendation,
  SecurityIssue,
  SecurityScene,
  SimulationResult,
  ZoneResult,
} from "@/schema/security-scene";
import { computeCoverageFailurePath } from "@/simulation/adversarial-path";
import { analyseBlindSpotTopology } from "@/simulation/blind-spot-topology";
import { computeCoverageFragility } from "@/simulation/coverage-fragility";
import { analyzeOcclusionBlame } from "@/simulation/occlusion-blame";
import {
  createCoverageEvaluator,
  type CellComputation,
  getIdentificationAreaPct,
  getRecognitionAreaPct,
  getQualityThresholds,
} from "@/simulation/coverage";
import { maxQuality, qualityToScore, scoreToQuality } from "@/simulation/dori";
import { computeKRobustness } from "@/simulation/k-robustness";
import { computePathResults } from "@/simulation/path-analysis";
import { pointInPolygon, polygonCenter } from "@/simulation/geometry";
import { computePlacementOracle } from "@/simulation/placement-oracle";

type EvaluatedZone = ZoneResult & {
  blockingLabels: string[];
  cameraQualityById: Record<string, DoriQuality>;
  redundancyRequired: boolean;
};

type TargetSamplingMode = "any" | "all";

type TargetProfile = {
  sampleHeightsM: number[];
  sampleMode: TargetSamplingMode;
  primaryHeightM: number;
  description: string;
};

const CRITICAL_ZONE_TARGET_PROFILES: Record<SecurityScene["criticalZones"][number]["targetType"], TargetProfile> = {
  person_detection: {
    sampleHeightsM: [0.9, 1.2, 1.6],
    sampleMode: "any",
    primaryHeightM: 1.2,
    description: "person-body profile",
  },
  face_recognition: {
    sampleHeightsM: [1.5, 1.65],
    sampleMode: "any",
    primaryHeightM: 1.6,
    description: "face-level profile",
  },
  face_identification: {
    sampleHeightsM: [1.5, 1.65],
    sampleMode: "any",
    primaryHeightM: 1.6,
    description: "face-identification profile",
  },
  vehicle_detection: {
    sampleHeightsM: [0.9, 1.25, 1.55],
    sampleMode: "any",
    primaryHeightM: 1.2,
    description: "vehicle-profile",
  },
  license_plate: {
    sampleHeightsM: [0.45, 0.6, 0.75],
    sampleMode: "any",
    primaryHeightM: 0.6,
    description: "license-plate profile",
  },
  package_detection: {
    sampleHeightsM: [0.2, 0.45, 0.8],
    sampleMode: "any",
    primaryHeightM: 0.45,
    description: "package profile",
  },
  cash_counter_activity: {
    sampleHeightsM: [0.9, 1.2, 1.5],
    sampleMode: "any",
    primaryHeightM: 1.0,
    description: "cash-counter profile",
  },
  door_entry_exit: {
    sampleHeightsM: [0.8, 1.3, 1.5],
    sampleMode: "any",
    primaryHeightM: 1.2,
    description: "door-entry profile",
  },
  perimeter_breach: {
    sampleHeightsM: [0.8, 1.2, 1.5],
    sampleMode: "all",
    primaryHeightM: 1.1,
    description: "perimeter breach profile",
  },
};

function getZoneQuality(zoneCells: { quality: DoriQuality }[]) {
  if (zoneCells.length === 0) return "none" as DoriQuality;

  const scores = zoneCells
    .map((cell) => qualityToScore(cell.quality))
    .sort((a, b) => a - b);
  const percentileIndex = Math.max(0, Math.floor(scores.length * 0.25) - 1);
  return scoreToQuality(scores[percentileIndex] ?? 0);
}

function aggregateQualitySamples(qualities: DoriQuality[], mode: TargetSamplingMode) {
  if (qualities.length === 0) return "none" as DoriQuality;

  if (mode === "all") {
    return qualities.reduce((acc, quality) => {
      return qualityToScore(quality) < qualityToScore(acc) ? quality : acc;
    }, "identification" as DoriQuality);
  }

  return qualities.reduce((acc, quality) =>
    qualityToScore(quality) > qualityToScore(acc) ? quality : acc,
  "none");
}

function getProfileForTargetType(targetType: SecurityScene["criticalZones"][number]["targetType"]) {
  return CRITICAL_ZONE_TARGET_PROFILES[targetType] ?? {
    sampleHeightsM: [1.2],
    sampleMode: "any" as TargetSamplingMode,
    primaryHeightM: 1.2,
    description: "fallback profile",
  };
}

function computeZoneEvaluations(
  scene: SecurityScene,
  evaluator?: ReturnType<typeof createCoverageEvaluator>,
) {
  const sceneEvaluator = evaluator ?? createCoverageEvaluator(scene);
  const coverageCells = sceneEvaluator.computeCoverageCells(4);
  const zoneEvaluations = scene.criticalZones.map((zone) =>
    evaluateZone(scene, sceneEvaluator, coverageCells, zone),
  );

  return { coverageCells, zoneEvaluations, evaluator: sceneEvaluator };
}

function createOfflineImpactForCamera(
  scene: SecurityScene,
  camera: SecurityScene["cameras"][number],
  baselineZoneEvaluations: Record<string, EvaluatedZone>,
  evaluator: ReturnType<typeof createCoverageEvaluator>,
  coverageCells: CellComputation[],
): CameraOfflineImpactEntry[] {
  if (!scene.cameras.some((candidate) => candidate.id === camera.id && candidate.status !== "off")) {
    return [];
  }

  return scene.criticalZones
    .map((zone) => evaluateZone(scene, evaluator, coverageCells, zone, camera.id))
    .map((zoneAfter) => {
      const zoneBefore = baselineZoneEvaluations[zoneAfter.zoneId];
      if (!zoneBefore) return null;

      const downgradedQuality =
        qualityToScore(zoneAfter.actualQuality) < qualityToScore(zoneBefore.actualQuality);
      const beforeRedundant = zoneBefore.redundancyRequired
        && zoneBefore.redundancyCameraCount >= 2;
      const afterRedundant = zoneAfter.redundancyRequired
        && zoneAfter.redundancyCameraCount >= 2;
      const losesRedundancy =
        zoneAfter.redundancyRequired && beforeRedundant && !afterRedundant;

      if (!downgradedQuality && !losesRedundancy) {
        return null;
      }

      const reason = downgradedQuality
        ? `${zoneAfter.label} drops from ${zoneBefore.actualQuality} to ${zoneAfter.actualQuality} if ${camera.name} is offline.`
        : `${zoneAfter.label} loses redundancy if ${camera.name} is offline.`;

      return {
        zoneId: zoneAfter.zoneId,
        label: zoneAfter.label,
        beforeQuality: zoneBefore.actualQuality,
        afterQuality: zoneAfter.actualQuality,
        beforeStatus: zoneBefore.status,
        afterStatus: zoneAfter.status,
        reason,
      } as CameraOfflineImpactEntry;
    })
    .filter((item): item is CameraOfflineImpactEntry => Boolean(item));
}

function coverageStatus(actual: DoriQuality, required: DoriQuality) {
  return qualityToScore(actual) >= qualityToScore(required) ? ("pass" as const) : ("fail" as const);
}

function getZoneSampleHeights(zone: SecurityScene["criticalZones"][number]) {
  const profile = getProfileForTargetType(zone.targetType);
  return profile.sampleHeightsM
    .map((height) => Math.min(Math.max(0.2, height), zone.heightM))
    .sort((a, b) => a - b);
}

function collectPrivacyCoverageIssues(
  scene: SecurityScene,
  coverageCells: CellComputation[],
): SecurityIssue[] {
  const byZoneId = new Map<string, { label: string; cameras: Set<string>; cells: number }>();

  for (const cell of coverageCells) {
    if (!cell.privacyRestricted || cell.quality === "none") {
      continue;
    }

    if (cell.coveringCameras.length === 0) {
      continue;
    }

    for (const zone of scene.privacyZones) {
      if (!pointInPolygon([cell.x, cell.z], zone.polygon)) {
        continue;
      }

      const entry = byZoneId.get(zone.id) ?? {
        label: zone.label,
        cameras: new Set<string>(),
        cells: 0,
      };

      for (const cameraId of cell.coveringCameras) {
        entry.cameras.add(cameraId);
      }

      entry.cells += 1;
      byZoneId.set(zone.id, entry);
    }
  }

  return Array.from(byZoneId.entries()).map(([zoneId, summary]) => ({
    severity: "medium",
    category: "privacy",
    description: `Privacy zone "${summary.label}" is visible in ${summary.cells} sampled cells.`,
    affectedZones: [zoneId],
    affectedCameras: Array.from(summary.cameras),
  }));
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function evaluateZone(
  scene: SecurityScene,
  evaluator: ReturnType<typeof createCoverageEvaluator>,
  coverageCells: CellComputation[],
  zone: SecurityScene["criticalZones"][number],
  excludedCameraId?: string,
): EvaluatedZone {
  const zoneCells = coverageCells.filter((cell) => pointInPolygon([cell.x, cell.z], zone.polygon));
  const profile = getProfileForTargetType(zone.targetType);
  const sampleHeightsM = getZoneSampleHeights(zone);

  const cellQualities: { quality: DoriQuality }[] = [];
  const cameraQualityById: Record<string, DoriQuality> = Object.fromEntries(
    scene.cameras.map((camera) => [camera.id, "none" as DoriQuality]),
  );
  const blockingLabels = new Set<string>();

  for (const cell of zoneCells) {
    let cellBest: DoriQuality = "none";
    const cellBlocking = new Set<string>();

    for (const camera of scene.cameras) {
      if (camera.id === excludedCameraId) continue;

      const sampleQualities = sampleHeightsM.map((height) => {
        const evaluation =
          cell.cameraEvaluations?.[camera.id]
            ?? evaluator.evaluatePoint(camera, [cell.x, cell.z], height);

        if (evaluation.blockedBy) {
          cellBlocking.add(evaluation.blockedBy);
        }

        return evaluation.quality;
      });

      const evaluationQuality = aggregateQualitySamples(sampleQualities, profile.sampleMode);
      cameraQualityById[camera.id] = maxQuality(cameraQualityById[camera.id], evaluationQuality);
      cellBest = maxQuality(cellBest, evaluationQuality);
    }

    cellQualities.push({ quality: cellBest });
    cellBlocking.forEach((label) => blockingLabels.add(label));
  }

  const actualQuality = getZoneQuality(cellQualities);
  const coveringCameras = Object.entries(cameraQualityById)
    .filter(([, quality]) => quality !== "none")
    .map(([cameraId]) => cameraId);
  const redundancyCameraCount = Object.values(cameraQualityById).filter(
    (quality) => qualityToScore(quality) >= qualityToScore(zone.requiredQuality),
  ).length;
  const status =
    actualQuality === "none"
      ? "fail"
      : coverageStatus(actualQuality, zone.requiredQuality);

  const failureReasons: string[] = [];
  if (status !== "pass") {
    failureReasons.push(
      `${zone.label} is below ${zone.requiredQuality} with ${profile.description} near ${zone.heightM.toFixed(2)}m.`,
    );
    if (blockingLabels.size > 0) {
      failureReasons.push(`Blocked by: ${Array.from(blockingLabels).join(", ")}.`);
    }
    if (coveringCameras.length === 0) {
      failureReasons.push("No camera can currently sample this zone.");
    }
  }

  return {
    zoneId: zone.id,
    label: zone.label,
    requiredQuality: zone.requiredQuality,
    actualQuality,
    coveringCameras,
    redundancyCameraCount,
    redundancyRequired: zone.redundancyRequired,
    status,
    failureReasons,
    blockingLabels: Array.from(blockingLabels),
    cameraQualityById,
  };
}

function getZoneByLabel(scene: SecurityScene, label: string) {
  return scene.criticalZones.find((zone) => zone.label === label);
}

function getObstructionByLabel(scene: SecurityScene, label: string) {
  return scene.obstructions.find((obstruction) => obstruction.label === label);
}

function moveObstructionAwayFromZone(
  scene: SecurityScene,
  zone: SecurityScene["criticalZones"][number],
  obstructionLabel: string,
) {
  const obstruction = getObstructionByLabel(scene, obstructionLabel);
  if (!obstruction) return null;

  const next = structuredClone(scene);
  const nextObstruction = next.obstructions.find((obs) => obs.id === obstruction.id);
  if (!nextObstruction) return null;

  const [zoneX, zoneZ] = polygonCenter(zone.polygon);
  const [ox, oy, oz] = nextObstruction.position;
  const vectorX = ox - zoneX;
  const vectorZ = oz - zoneZ;
  const vectorLength = Math.hypot(vectorX, vectorZ) || 1;
  const pushDistance = Math.max(nextObstruction.dimensions[0], nextObstruction.dimensions[1]) + 1.2;
  const targetX = clamp(
    ox + (vectorX / vectorLength) * pushDistance,
    0.4,
    next.dimensions.width - 0.4,
  );
  const targetZ = clamp(
    oz + (vectorZ / vectorLength) * pushDistance,
    0.4,
    next.dimensions.depth - 0.4,
  );

  nextObstruction.position = [targetX, oy, targetZ];
  return next;
}

function rotateCameraTowardZone(
  scene: SecurityScene,
  zone: SecurityScene["criticalZones"][number],
  cameraId: string,
) {
  const camera = scene.cameras.find((entry) => entry.id === cameraId);
  if (!camera) return null;

  const next = structuredClone(scene);
  const nextCamera = next.cameras.find((entry) => entry.id === cameraId);
  if (!nextCamera) return null;

  const [zoneX, zoneZ] = polygonCenter(zone.polygon);
  const dx = zoneX - nextCamera.position[0];
  const dz = zoneZ - nextCamera.position[2];
  const yaw = Math.atan2(dx, dz) * (180 / Math.PI);

  nextCamera.yawDeg = Math.round(yaw);
  nextCamera.pitchDeg = -28;
  return next;
}

function simulateStudioInternal(
  scene: SecurityScene,
  includeRecommendations: boolean,
  includeNovelAnalytics = true,
): SimulationResult {
  const evaluator = createCoverageEvaluator(scene);
  const coverageThresholds = getQualityThresholds(scene);
  const coverageCells = evaluator.computeCoverageCells(4);
  const fragility = computeCoverageFragility(
    coverageCells.map((c) => ({ ...c, ppm: c.ppm ?? 0, coverageIncluded: c.coverageIncluded, privacyRestricted: c.privacyRestricted ?? false, coveringCameras: c.coveringCameras, blockedBy: c.blockedBy ?? [] })),
    scene.assumptions.doriStandard,
  );
  const fragilityCellMap = new Map(fragility.cells.map((fc) => [`${fc.cellX}:${fc.cellZ}`, fc.fragility]));
  const includedCoverageCells = coverageCells.filter((cell) => cell.coverageIncluded);
  const includedCoverageCellCount = includedCoverageCells.length;
  // coverageByQuality uses score-based buckets so it works regardless of which quality names cells carry.
  const coverageByQuality = {
    detection: includedCoverageCellCount === 0
      ? 0
      : (includedCoverageCells.filter((c) => qualityToScore(c.quality) >= 1 && qualityToScore(c.quality) < 3).length / includedCoverageCellCount) * 100,
    observation: includedCoverageCellCount === 0
      ? 0
      : (includedCoverageCells.filter((c) => qualityToScore(c.quality) >= 3 && qualityToScore(c.quality) < 5).length / includedCoverageCellCount) * 100,
    recognition: includedCoverageCellCount === 0
      ? 0
      : (includedCoverageCells.filter((c) => qualityToScore(c.quality) >= 5 && qualityToScore(c.quality) < 6).length / includedCoverageCellCount) * 100,
    identification: includedCoverageCellCount === 0
      ? 0
      : (includedCoverageCells.filter((c) => qualityToScore(c.quality) >= 6).length / includedCoverageCellCount) * 100,
  };

  const totalCoveragePct =
    includedCoverageCellCount === 0
      ? 0
      : (includedCoverageCells.filter((cell) => cell.quality !== "none").length /
          includedCoverageCellCount) *
        100;
  const blindspotPct = 100 - totalCoveragePct;
  const averageWalkableQuality =
    includedCoverageCellCount === 0
      ? 0
      : includedCoverageCells.reduce((sum, cell) => sum + qualityToScore(cell.quality), 0) /
        includedCoverageCellCount;

  const zoneEvaluations = scene.criticalZones.map((zone) =>
    evaluateZone(scene, evaluator, coverageCells, zone),
  );

  const baselineZoneById = Object.fromEntries(
    zoneEvaluations.map((zone) => [zone.zoneId, zone]),
  ) as Record<string, EvaluatedZone>;

  const criticalZoneResults: ZoneResult[] = zoneEvaluations.map((zone) => ({
    zoneId: zone.zoneId,
    label: zone.label,
    requiredQuality: zone.requiredQuality,
    actualQuality: zone.actualQuality,
    coveringCameras: zone.coveringCameras,
    redundancyCameraCount: zone.redundancyCameraCount,
    status: zone.status,
    failureReasons: zone.failureReasons,
  }));

  const cameraResults: CameraResult[] = scene.cameras.map((camera) => {
    const coveredCells = includedCoverageCells.filter((cell) => cell.coveringCameras.includes(camera.id));
    const qualityByZone = Object.fromEntries(
      zoneEvaluations.map((zone) => [zone.label, zone.cameraQualityById[camera.id] ?? "none"]),
    ) as Record<string, DoriQuality>;
    const offlineImpactDetail = createOfflineImpactForCamera(scene, camera, baselineZoneById, evaluator, coverageCells);

    return {
      cameraId: camera.id,
      coveragePct:
        includedCoverageCellCount === 0 ? 0 : (coveredCells.length / includedCoverageCellCount) * 100,
      qualityByZone,
      criticalZonesCovered: zoneEvaluations
        .filter((zone) => qualityToScore(zone.cameraQualityById[camera.id] ?? "none") >= qualityToScore(zone.requiredQuality))
        .map((zone) => zone.label),
      criticalZonesFailed: zoneEvaluations
        .filter((zone) => {
          const own = zone.cameraQualityById[camera.id] ?? "none";
          return own !== "none" && qualityToScore(own) < qualityToScore(zone.requiredQuality);
        })
        .map((zone) => zone.label),
      offlineImpact: offlineImpactDetail.map((entry) => entry.reason),
      offlineImpactDetail,
    };
  });

  const issues: SecurityIssue[] = [];

  for (const zone of zoneEvaluations) {
    if (zone.status !== "pass") {
      issues.push({
        severity:
          zone.requiredQuality === "recognition" || zone.requiredQuality === "identification"
            ? "critical"
            : zone.status === "partial"
              ? "high"
              : "medium",
        category: "quality_fail",
        description: `${zone.label} fails the ${zone.requiredQuality} requirement.`,
        affectedZones: [zone.label],
        affectedCameras: zone.coveringCameras,
      });
    }
  }

  const obstructionToZones = new Map<string, Set<string>>();
  for (const zone of zoneEvaluations) {
    for (const obsLabel of zone.blockingLabels) {
      if (!obstructionToZones.has(obsLabel)) {
        obstructionToZones.set(obsLabel, new Set());
      }
      obstructionToZones.get(obsLabel)!.add(zone.label);
    }
  }

  for (const [obsLabel, affectedZoneSet] of obstructionToZones) {
    const affectedZoneList = Array.from(affectedZoneSet);
    const affectedCameraIds = cameraResults
      .filter((camera) =>
        camera.criticalZonesFailed.some((zoneLabel) => affectedZoneSet.has(zoneLabel)),
      )
      .map((camera) => camera.cameraId);

    issues.push({
      severity: "high",
      category: "blindspot",
      description: `${obsLabel} is obstructing coverage in: ${affectedZoneList.join(", ")}.`,
      affectedZones: affectedZoneList,
      affectedCameras: affectedCameraIds,
    });
  }

  issues.push(...collectPrivacyCoverageIssues(scene, coverageCells));

  const pathResults = computePathResults(scene, coverageCells);
  const adversarialPath = computeCoverageFailurePath(scene, coverageCells);
  const kRobustness = includeNovelAnalytics ? computeKRobustness(scene) : undefined;
  const placementOracle = includeNovelAnalytics ? computePlacementOracle(scene, coverageCells, criticalZoneResults) : undefined;
  const occlusionBlame = includeNovelAnalytics ? analyzeOcclusionBlame(scene) : undefined;

  const worstAreaQuality: DoriQuality =
    zoneEvaluations.length > 0
      ? zoneEvaluations.reduce(
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

  const recommendations: Recommendation[] = [];
  if (includeRecommendations) {
    const firstBlockingZone = zoneEvaluations.find((zone) => zone.blockingLabels.length > 0 && zone.status !== "pass");
    const firstCameraZone = zoneEvaluations.find(
      (zone) => zone.status !== "pass" && zone.coveringCameras.length > 0,
    );

    if (firstBlockingZone) {
      const obstructionLabel = firstBlockingZone.blockingLabels[0];
      const zone = getZoneByLabel(scene, firstBlockingZone.label);
      if (zone && obstructionLabel) {
        const patchedScene = moveObstructionAwayFromZone(scene, zone, obstructionLabel);
        if (patchedScene) {
          const patchedResult = simulateStudioInternal(patchedScene, false, false);
          const patchedZone = patchedResult.criticalZoneResults.find((entry) => entry.zoneId === zone.id);
          const improved =
            patchedZone &&
            qualityToScore(patchedZone.actualQuality) > qualityToScore(firstBlockingZone.actualQuality);

          const obsNode = getObstructionByLabel(patchedScene, obstructionLabel);
          const movedObs = patchedScene.obstructions.find((o) => o.label === obstructionLabel);

          recommendations.push({
            type: "move_object",
            description: `Move "${obstructionLabel}" away from "${firstBlockingZone.label}".`,
            estimatedImpact: patchedZone
              ? `Simulated zone quality changes from ${firstBlockingZone.actualQuality} to ${patchedZone.actualQuality}.`
              : `Simulated scene improves visibility around ${firstBlockingZone.label}.`,
            costCategory: "free",
            verified: Boolean(improved),
            affectedNodeId: obsNode?.id ?? movedObs?.id,
            suggestedPosition: movedObs?.position,
          });
        }
      }
    }

    if (firstCameraZone) {
      const cameraId = firstCameraZone.coveringCameras[0];
      const zone = getZoneByLabel(scene, firstCameraZone.label);
      if (zone && cameraId) {
        const patchedScene = rotateCameraTowardZone(scene, zone, cameraId);
        if (patchedScene) {
          const patchedResult = simulateStudioInternal(patchedScene, false, false);
          const patchedZone = patchedResult.criticalZoneResults.find((entry) => entry.zoneId === zone.id);
          const improved =
            patchedZone &&
            qualityToScore(patchedZone.actualQuality) > qualityToScore(firstCameraZone.actualQuality);

          const patchedCamera = patchedScene.cameras.find((c) => c.id === cameraId);

          recommendations.push({
            type: "rotate_camera",
            description: `Re-aim "${cameraId}" toward "${firstCameraZone.label}".`,
            estimatedImpact: patchedZone
              ? `Simulated zone quality changes from ${firstCameraZone.actualQuality} to ${patchedZone.actualQuality}.`
              : `Simulated scene improves visibility around ${firstCameraZone.label}.`,
            costCategory: "low",
            verified: Boolean(improved),
            affectedNodeId: cameraId,
            suggestedYawDeg: patchedCamera?.yawDeg,
            suggestedPitchDeg: patchedCamera?.pitchDeg,
          });
        }
      }
    }
  }

  return {
    computedAt: Date.now(),
    totalCoveragePct: Number(totalCoveragePct.toFixed(1)),
    blindspotPct: Number(blindspotPct.toFixed(1)),
    averageWalkableQuality: Number(averageWalkableQuality.toFixed(2)),
    worstAreaQuality,
    recognitionAreaPct: Number(
      getRecognitionAreaPct(coverageCells, coverageThresholds, true).toFixed(1),
    ),
    identificationAreaPct: Number(
      getIdentificationAreaPct(coverageCells, coverageThresholds, true).toFixed(1),
    ),
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
      coverageIncluded: cell.coverageIncluded,
      privacyRestricted: cell.privacyRestricted,
      cameraEvaluations: cell.cameraEvaluations,
      fragility: fragilityCellMap.get(`${cell.x}:${cell.z}`),
    })),
    criticalZoneResults,
    cameraResults,
    pathResults,
    issues,
    recommendations,
    coverageFailurePath: adversarialPath,
    adversarialPath,
    coverageThresholds,
    blindRegions: analyseBlindSpotTopology(scene, coverageCells.map((cell) => ({
      x: cell.x, z: cell.z, quality: cell.quality,
      coveringCameras: cell.coveringCameras, blockedBy: cell.blockedBy, ppm: cell.ppm,
      coverageIncluded: cell.coverageIncluded, privacyRestricted: cell.privacyRestricted,
    }))),
    occlusionBlame,
    fragilitySummary: fragility.totalCells > 0 ? {
      meanFragility: Number(fragility.meanFragility.toFixed(3)),
      fragileCellCount: fragility.fragileCellCount,
      robustCellCount: fragility.robustCellCount,
      totalCells: fragility.totalCells,
    } : undefined,
    kRobustness,
    placementOracle,
  };
}

export function simulateStudio(scene: SecurityScene): SimulationResult {
  return simulateStudioInternal(scene, true);
}
