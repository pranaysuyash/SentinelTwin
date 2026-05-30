import type { CameraNode, DoriQuality, SecurityScene } from "@sentineltwin/core";
import { simulateStudioLite } from "./simulate-studio.js";

export interface CoverageUncertaintySummary {
  cameraCount: number;
  resolvedCameraCount: number;
  uncertaintyScore: number;
  cameraUncertainties: CameraUncertainty[];
  totalCoverageRange: { low: number; high: number };
  identificationRange: { low: number; high: number };
}

export interface CameraUncertainty {
  cameraId: string;
  cameraName: string;
  isResolved: boolean;
  uncertaintyScore: number;
}

export function computeCoverageUncertainty(scene: SecurityScene): CoverageUncertaintySummary | null {
  const unresolved = scene.cameras.filter(
    (camera) => camera.status !== "on" && camera.status !== "off",
  );
  const totalCameras = scene.cameras.length;

  if (unresolved.length === 0 || totalCameras === 0) {
    return null;
  }

  const cameraUncertainties: CameraUncertainty[] = scene.cameras.map((camera) => {
    const isResolved = camera.status === "on" || camera.status === "off";
    return {
      cameraId: camera.id,
      cameraName: camera.name,
      isResolved,
      uncertaintyScore: isResolved ? 0 : camera.status === "planned" ? 0.4 : 0.7,
    };
  });

  // Compute high estimate: all unresolved as "on"
  const highScene = structuredClone(scene);
  for (const camera of highScene.cameras) {
    if (camera.status !== "on") camera.status = "on";
  }
  const highResult = simulateStudioLite(highScene);

  // Compute low estimate: all unresolved as "off"
  const lowScene = structuredClone(scene);
  for (const camera of lowScene.cameras) {
    if (camera.status !== "off") camera.status = "off";
  }
  const lowResult = simulateStudioLite(lowScene);

  const uncertaintyScore = Number(
    (unresolved.length / totalCameras).toFixed(3),
  );

  return {
    cameraCount: totalCameras,
    resolvedCameraCount: totalCameras - unresolved.length,
    uncertaintyScore,
    cameraUncertainties,
    totalCoverageRange: {
      low: lowResult.totalCoveragePct,
      high: highResult.totalCoveragePct,
    },
    identificationRange: {
      low: lowResult.coverageByQuality.identification,
      high: highResult.coverageByQuality.identification,
    },
  };
}
