import type {
  CameraResult,
  DoriQuality,
  Recommendation,
  SecurityIssue,
  SecurityScene,
  SimulationResult,
  ZoneResult,
} from "@/schema/security-scene";
import { computeAdversarialPath } from "@/simulation/adversarial-path";
import {
  createCoverageEvaluator,
  getIdentificationAreaPct,
  getQualityShare,
  getRecognitionAreaPct,
} from "@/simulation/coverage";
import { maxQuality, qualityToScore, scoreToQuality } from "@/simulation/dori";
import { computePathResults } from "@/simulation/path-analysis";
import { pointInPolygon, polygonCenter } from "@/simulation/geometry";

type EvaluatedZone = ZoneResult & {
  blockingLabels: string[];
  cameraQualityById: Record<string, DoriQuality>;
};

function getZoneQuality(zoneCells: { quality: DoriQuality }[]) {
  if (zoneCells.length === 0) return "none" as DoriQuality;

  const scores = zoneCells
    .map((cell) => qualityToScore(cell.quality))
    .sort((a, b) => a - b);
  const percentileIndex = Math.max(0, Math.floor(scores.length * 0.25) - 1);
  return scoreToQuality(scores[percentileIndex] ?? 0);
}

function coverageStatus(actual: DoriQuality, required: DoriQuality) {
  return qualityToScore(actual) >= qualityToScore(required) ? ("pass" as const) : ("fail" as const);
}

function getZoneSampleHeight(zone: SecurityScene["criticalZones"][number], scene: SecurityScene) {
  const basePerson = scene.assumptions.personHeightM;
  const baseVehicle = scene.assumptions.vehicleHeightM;

  switch (zone.targetType) {
    case "vehicle_detection":
      return Math.min(zone.heightM, baseVehicle);
    case "license_plate":
      return Math.min(zone.heightM, 0.55);
    case "face_recognition":
    case "face_identification":
      return Math.min(zone.heightM, Math.max(1.45, basePerson - 0.2));
    case "cash_counter_activity":
      return Math.min(zone.heightM, Math.max(1.05, basePerson - 0.45));
    case "door_entry_exit":
      return Math.min(zone.heightM, Math.max(1.45, basePerson - 0.1));
    case "perimeter_breach":
    case "package_detection":
    case "person_detection":
    default:
      return Math.min(zone.heightM, basePerson);
  }
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function evaluateZone(
  scene: SecurityScene,
  evaluator: ReturnType<typeof createCoverageEvaluator>,
  coverageCells: { x: number; z: number; quality: DoriQuality; blockedBy: string[]; coveringCameras: string[] }[],
  zone: SecurityScene["criticalZones"][number],
  excludedCameraId?: string,
): EvaluatedZone {
  const zoneCells = coverageCells.filter((cell) => pointInPolygon([cell.x, cell.z], zone.polygon));
  const sampleHeightM = getZoneSampleHeight(zone, scene);

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

      const evaluation = evaluator.evaluatePoint(camera, [cell.x, cell.z], sampleHeightM);
      cameraQualityById[camera.id] = maxQuality(cameraQualityById[camera.id], evaluation.quality);
      cellBest = maxQuality(cellBest, evaluation.quality);

      if (evaluation.blockedBy) {
        cellBlocking.add(evaluation.blockedBy);
      }
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
      `${zone.label} is below ${zone.requiredQuality} at approximately ${sampleHeightM.toFixed(2)}m.`,
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

function simulateStudioInternal(scene: SecurityScene, includeRecommendations: boolean): SimulationResult {
  const evaluator = createCoverageEvaluator(scene);
  const coverageCells = evaluator.computeCoverageCells(4);
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
      : (coverageCells.filter((cell) => cell.quality !== "none").length / walkableCellCount) * 100;
  const blindspotPct = 100 - totalCoveragePct;
  const averageWalkableQuality =
    walkableCellCount === 0
      ? 0
      : coverageCells.reduce((sum, cell) => sum + qualityToScore(cell.quality), 0) / walkableCellCount;

  const zoneEvaluations = scene.criticalZones.map((zone) =>
    evaluateZone(scene, evaluator, coverageCells, zone),
  );

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
    const coveredCells = coverageCells.filter((cell) => cell.coveringCameras.includes(camera.id));
    const qualityByZone = Object.fromEntries(
      zoneEvaluations.map((zone) => [zone.label, zone.cameraQualityById[camera.id] ?? "none"]),
    ) as Record<string, DoriQuality>;

    return {
      cameraId: camera.id,
      coveragePct: walkableCellCount === 0 ? 0 : (coveredCells.length / walkableCellCount) * 100,
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
      offlineImpact: zoneEvaluations
        .map((zone) => {
          const withoutCamera = evaluateZone(scene, evaluator, coverageCells, scene.criticalZones.find((candidate) => candidate.id === zone.zoneId)!, camera.id);
          if (qualityToScore(withoutCamera.actualQuality) < qualityToScore(zone.actualQuality)) {
            return `${zone.label} drops from ${zone.actualQuality} to ${withoutCamera.actualQuality} if ${camera.name} is offline.`;
          }
          if (withoutCamera.redundancyCameraCount < zone.redundancyCameraCount && zone.redundancyCameraCount > 1) {
            return `${zone.label} loses redundancy if ${camera.name} is offline.`;
          }
          return null;
        })
        .filter((message): message is string => Boolean(message)),
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

  const pathResults = computePathResults(scene, coverageCells);
  const adversarialPath = computeAdversarialPath(scene, coverageCells);

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
          const patchedResult = simulateStudioInternal(patchedScene, false);
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
          const patchedResult = simulateStudioInternal(patchedScene, false);
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
    recognitionAreaPct: Number(getRecognitionAreaPct(coverageCells, scene.assumptions.pixelsPerMeter).toFixed(1)),
    identificationAreaPct: Number(getIdentificationAreaPct(coverageCells, scene.assumptions.pixelsPerMeter).toFixed(1)),
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

export function simulateStudio(scene: SecurityScene): SimulationResult {
  return simulateStudioInternal(scene, true);
}
