import type { SecurityScene, SimulationResult } from "@sentineltwin/core";

export type RedundancyMatrixZoneRow = {
  zoneId: string;
  label: string;
  coverageCount: number;
  coveringCameras: string[];
  coveringCameraNames: string[];
  soleCameraName: string | null;
  status: "uncovered" | "single_point_failure" | "redundant";
};

export type RedundancyMatrixCameraZone = {
  zoneId: string;
  label: string;
  isSole: boolean;
};

export type RedundancyMatrixCameraRow = {
  cameraId: string;
  cameraName: string;
  status: string;
  coveragePct: number;
  criticalityScore: number;
  criticalityLabel: "Critical" | "Important" | "Redundant";
  soleCoverageZones: RedundancyMatrixCameraZone[];
  coveredZones: RedundancyMatrixCameraZone[];
};

export type RedundancyMatrixReport = {
  cameraCount: number;
  zoneCount: number;
  redundantZoneCount: number;
  spofZoneCount: number;
  uncoveredZoneCount: number;
  cameraRows: RedundancyMatrixCameraRow[];
  vulnerableZones: RedundancyMatrixZoneRow[];
};

export function buildRedundancyMatrixReport(
  scene: SecurityScene,
  result: SimulationResult,
): RedundancyMatrixReport | null {
  if (scene.cameras.length === 0 || scene.criticalZones.length === 0) return null;

  const cameraMap = new Map(scene.cameras.map((camera) => [camera.id, camera]));
  const cameraResultsById = new Map(result.cameraResults.map((entry) => [entry.cameraId, entry]));
  const zoneResultsById = new Map(result.criticalZoneResults.map((entry) => [entry.zoneId, entry]));

  const vulnerableZones = scene.criticalZones
    .map((zone) => {
      const zoneResult = zoneResultsById.get(zone.id);
      const coveringCameras = zoneResult?.coveringCameras ?? [];
      const coveringCameraNames = coveringCameras.map((cameraId) => cameraMap.get(cameraId)?.name ?? cameraId);
      const coverageCount = zoneResult?.redundancyCameraCount ?? 0;
      const status = coverageCount === 0
        ? "uncovered"
        : coverageCount === 1
          ? "single_point_failure"
          : "redundant";
      const soleCameraName = coverageCount === 1
        ? cameraMap.get(coveringCameras[0] ?? "")?.name ?? coveringCameras[0] ?? null
        : null;
      return {
        zoneId: zone.id,
        label: zone.label,
        coverageCount,
        coveringCameras,
        coveringCameraNames,
        soleCameraName,
        status,
      } satisfies RedundancyMatrixZoneRow;
    })
    .sort((a, b) => {
      const rank = (status: RedundancyMatrixZoneRow["status"]) => {
        if (status === "uncovered") return 0;
        if (status === "single_point_failure") return 1;
        return 2;
      };
      return rank(a.status) - rank(b.status) || a.label.localeCompare(b.label);
    });

  const cameraRows = scene.cameras
    .map((camera) => {
      const cameraResult = cameraResultsById.get(camera.id);
      const coveredZones = scene.criticalZones
        .filter((zone) => cameraResult?.criticalZonesCovered.includes(zone.id))
        .map((zone) => {
          const zoneResult = zoneResultsById.get(zone.id);
          const isSole = (zoneResult?.coveringCameras.length ?? 0) === 1 && zoneResult?.coveringCameras[0] === camera.id;
          return {
            zoneId: zone.id,
            label: zone.label,
            isSole,
          } satisfies RedundancyMatrixCameraZone;
        });
      const soleCoverageZones = coveredZones.filter((zone) => zone.isSole);
      const criticalityScore = Math.min(10, Math.round(soleCoverageZones.length * 3 + (cameraResult?.coveragePct ?? 0) / 15));
      const criticalityLabel: RedundancyMatrixCameraRow["criticalityLabel"] =
        criticalityScore >= 7 ? "Critical" : criticalityScore >= 4 ? "Important" : "Redundant";
      return {
        cameraId: camera.id,
        cameraName: camera.name,
        status: camera.status,
        coveragePct: cameraResult?.coveragePct ?? 0,
        criticalityScore,
        criticalityLabel,
        soleCoverageZones,
        coveredZones,
      } satisfies RedundancyMatrixCameraRow;
    })
    .sort((a, b) => {
      const scoreDelta = b.criticalityScore - a.criticalityScore;
      if (scoreDelta !== 0) return scoreDelta;
      const coverageDelta = b.coveragePct - a.coveragePct;
      if (coverageDelta !== 0) return coverageDelta;
      return a.cameraName.localeCompare(b.cameraName);
    });

  return {
    cameraCount: scene.cameras.length,
    zoneCount: scene.criticalZones.length,
    redundantZoneCount: vulnerableZones.filter((zone) => zone.status === "redundant").length,
    spofZoneCount: vulnerableZones.filter((zone) => zone.status === "single_point_failure").length,
    uncoveredZoneCount: vulnerableZones.filter((zone) => zone.status === "uncovered").length,
    cameraRows,
    vulnerableZones,
  };
}
