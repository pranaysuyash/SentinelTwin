import type { DoriQuality, SecurityScene } from "@sentineltwin/core";
import { createCoverageEvaluator, getIdentificationAreaPct, getRecognitionAreaPct } from "./coverage";
import { qualityToScore, scoreToQuality } from "@sentineltwin/core";
import { pointInPolygon } from "@sentineltwin/core";

export type CoveragePostureProfileSpec = {
  id: string;
  label: string;
  targetHeightM: number;
  description: string;
};

export type CoveragePostureZoneSummary = {
  zoneId: string;
  label: string;
  requiredQuality: DoriQuality;
  actualQuality: DoriQuality;
  status: "pass" | "fail";
  coveragePct: number;
  coveringCameras: string[];
};

export type CoveragePostureProfileSummary = {
  profileId: string;
  label: string;
  targetHeightM: number;
  description: string;
  totalCoveragePct: number;
  blindspotPct: number;
  recognitionAreaPct: number;
  identificationAreaPct: number;
  averageWalkableQuality: number;
  zonesPassing: number;
  zonesTotal: number;
  worstZoneLabel: string | null;
  worstZoneStatus: "pass" | "fail" | null;
  worstZoneActualQuality: DoriQuality | null;
  worstZoneRequiredQuality: DoriQuality | null;
  zoneSummaries: CoveragePostureZoneSummary[];
};

export type CoveragePostureVariationSummary = {
  baselineProfileLabel: string;
  profiles: CoveragePostureProfileSummary[];
  worstProfileLabel: string | null;
  worstProfileCoveragePct: number | null;
  largestDropProfileLabel: string | null;
  largestDropDeltaPct: number | null;
  worstZoneLabel: string | null;
  worstZoneProfileLabel: string | null;
};

type CoveragePostureOptions = {
  profiles?: CoveragePostureProfileSpec[];
};

const DEFAULT_PROFILES: CoveragePostureProfileSpec[] = [
  { id: "crouching", label: "Crouching", targetHeightM: 0.7, description: "low-profile movement" },
  { id: "seated", label: "Seated", targetHeightM: 1.0, description: "counter-height activity" },
  { id: "child", label: "Child", targetHeightM: 1.25, description: "short standing target" },
  { id: "standing", label: "Standing", targetHeightM: 1.7, description: "standard adult target" },
];

function getZoneQuality(zoneCells: { quality: DoriQuality }[]) {
  if (zoneCells.length === 0) return "none" as DoriQuality;

  const scores = zoneCells
    .map((cell) => qualityToScore(cell.quality))
    .sort((a, b) => a - b);
  const percentileIndex = Math.max(0, Math.floor(scores.length * 0.25) - 1);
  return scoreToQuality(scores[percentileIndex] ?? 0);
}

function summarizeProfile(
  scene: SecurityScene,
  evaluator: ReturnType<typeof createCoverageEvaluator>,
  spec: CoveragePostureProfileSpec,
) {
  const coverageCells = evaluator.computeCoverageCells(4, spec.targetHeightM);
  const includedCoverageCells = coverageCells.filter((cell) => cell.coverageIncluded);
  const includedCoverageCellCount = includedCoverageCells.length;

  const totalCoveragePct =
    includedCoverageCellCount === 0
      ? 0
      : (includedCoverageCells.filter((cell) => cell.quality !== "none").length / includedCoverageCellCount) * 100;
  const blindspotPct = 100 - totalCoveragePct;
  const averageWalkableQuality =
    includedCoverageCellCount === 0
      ? 0
      : includedCoverageCells.reduce((sum, cell) => sum + qualityToScore(cell.quality), 0) / includedCoverageCellCount;
  const recognitionAreaPct = getRecognitionAreaPct(coverageCells, scene.assumptions.pixelsPerMeter, true);
  const identificationAreaPct = getIdentificationAreaPct(coverageCells, scene.assumptions.pixelsPerMeter, true);

  const zoneSummaries: CoveragePostureZoneSummary[] = scene.criticalZones.map((zone) => {
    const zoneCells = coverageCells.filter((cell) => pointInPolygon([cell.x, cell.z], zone.polygon));
    const actualQuality = getZoneQuality(zoneCells.map((cell) => ({ quality: cell.quality })));
    const status: "pass" | "fail" = actualQuality !== "none" && qualityToScore(actualQuality) >= qualityToScore(zone.requiredQuality) ? "pass" : "fail";
    const coveragePct =
      zoneCells.length === 0
        ? 0
        : (zoneCells.filter((cell) => cell.quality !== "none").length / zoneCells.length) * 100;
    const coveringCameras = Array.from(new Set(zoneCells.flatMap((cell) => cell.coveringCameras)));

    return {
      zoneId: zone.id,
      label: zone.label,
      requiredQuality: zone.requiredQuality,
      actualQuality,
      status,
      coveragePct: Number(coveragePct.toFixed(1)),
      coveringCameras,
    };
  });

  const worstZone = zoneSummaries.reduce<CoveragePostureZoneSummary | null>((worst, zone) => {
    if (!worst) return zone;

    const worstMargin =
      qualityToScore(worst.actualQuality) - qualityToScore(worst.requiredQuality);
    const zoneMargin =
      qualityToScore(zone.actualQuality) - qualityToScore(zone.requiredQuality);

    if (zoneMargin < worstMargin) return zone;
    if (zoneMargin === worstMargin && qualityToScore(zone.actualQuality) < qualityToScore(worst.actualQuality)) {
      return zone;
    }
    return worst;
  }, null);

  return {
    profileId: spec.id,
    label: spec.label,
    targetHeightM: spec.targetHeightM,
    description: spec.description,
    totalCoveragePct: Number(totalCoveragePct.toFixed(1)),
    blindspotPct: Number(blindspotPct.toFixed(1)),
    recognitionAreaPct: Number(recognitionAreaPct.toFixed(1)),
    identificationAreaPct: Number(identificationAreaPct.toFixed(1)),
    averageWalkableQuality: Number(averageWalkableQuality.toFixed(2)),
    zonesPassing: zoneSummaries.filter((zone) => zone.status === "pass").length,
    zonesTotal: zoneSummaries.length,
    worstZoneLabel: worstZone?.label ?? null,
    worstZoneStatus: worstZone?.status ?? null,
    worstZoneActualQuality: worstZone?.actualQuality ?? null,
    worstZoneRequiredQuality: worstZone?.requiredQuality ?? null,
    zoneSummaries,
  };
}

export function computeCoveragePostureVariation(
  scene: SecurityScene,
  options?: CoveragePostureOptions,
): CoveragePostureVariationSummary | null {
  if (scene.cameras.length === 0 || scene.criticalZones.length === 0) {
    return null;
  }

  const evaluator = createCoverageEvaluator(scene);
  const profiles = (options?.profiles ?? DEFAULT_PROFILES).map((profile) => summarizeProfile(scene, evaluator, profile));
  const standingProfile = profiles.find((profile) => profile.profileId === "standing") ?? profiles[0] ?? null;

  const worstProfile = profiles.reduce<CoveragePostureProfileSummary | null>((worst, profile) => {
    if (!worst) return profile;
    return profile.totalCoveragePct < worst.totalCoveragePct ? profile : worst;
  }, null);

  let largestDropProfileLabel: string | null = null;
  let largestDropDeltaPct: number | null = null;
  if (standingProfile) {
    for (const profile of profiles) {
      if (profile.profileId === standingProfile.profileId) continue;
      const delta = Number((profile.totalCoveragePct - standingProfile.totalCoveragePct).toFixed(1));
      if (largestDropDeltaPct == null || delta < largestDropDeltaPct) {
        largestDropDeltaPct = delta;
        largestDropProfileLabel = profile.label;
      }
    }
  }

  const worstZoneAcrossProfiles = profiles
    .flatMap((profile) => profile.zoneSummaries.map((zone) => ({ profileLabel: profile.label, zone })))
    .reduce<{ profileLabel: string; zone: CoveragePostureZoneSummary } | null>((worst, entry) => {
      if (!worst) return entry;

      const worstMargin =
        qualityToScore(worst.zone.actualQuality) - qualityToScore(worst.zone.requiredQuality);
      const entryMargin =
        qualityToScore(entry.zone.actualQuality) - qualityToScore(entry.zone.requiredQuality);

      if (entryMargin < worstMargin) return entry;
      if (entryMargin === worstMargin && qualityToScore(entry.zone.actualQuality) < qualityToScore(worst.zone.actualQuality)) {
        return entry;
      }
      return worst;
    }, null);

  return {
    baselineProfileLabel: standingProfile?.label ?? profiles[0]?.label ?? "Standing",
    profiles,
    worstProfileLabel: worstProfile?.label ?? null,
    worstProfileCoveragePct: worstProfile?.totalCoveragePct ?? null,
    largestDropProfileLabel,
    largestDropDeltaPct,
    worstZoneLabel: worstZoneAcrossProfiles?.zone.label ?? null,
    worstZoneProfileLabel: worstZoneAcrossProfiles?.profileLabel ?? null,
  };
}
