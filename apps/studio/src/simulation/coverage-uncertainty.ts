import type { CameraNode, DoriQuality, SecurityScene } from "@/schema/security-scene";
import { simulateStudioLite } from "@/simulation/simulate-studio";

export type CoverageUncertaintyZoneRate = {
  zoneId: string;
  label: string;
  passRate: number;
};

export type CoverageUncertaintySummary = {
  sampleCount: number;
  positionSigmaM: number;
  yawSigmaDeg: number;
  pitchSigmaDeg: number;
  rangeSigmaPct: number;
  fovSigmaDeg: number;
  meanCoveragePct: number;
  p5CoveragePct: number;
  p95CoveragePct: number;
  meanRecognitionAreaPct: number;
  meanIdentificationAreaPct: number;
  worstZoneLabel: string | null;
  worstZonePassRate: number | null;
  zonePassRates: CoverageUncertaintyZoneRate[];
};

type CoverageUncertaintyOptions = {
  sampleCount?: number;
  positionSigmaM?: number;
  yawSigmaDeg?: number;
  pitchSigmaDeg?: number;
  rangeSigmaPct?: number;
  fovSigmaDeg?: number;
  seed?: number;
};

type SampleStats = {
  coveragePct: number;
  recognitionAreaPct: number;
  identificationAreaPct: number;
  zonePassCount: Map<string, { label: string; passes: number }>;
};

const DEFAULT_OPTIONS: Required<Omit<CoverageUncertaintyOptions, "seed">> = {
  sampleCount: 16,
  positionSigmaM: 0.06,
  yawSigmaDeg: 4,
  pitchSigmaDeg: 2,
  rangeSigmaPct: 0.05,
  fovSigmaDeg: 2,
};

function hashString(input: string) {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function mulberry32(seed: number) {
  return function next() {
    let t = seed += 0x6d2b79f5;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function gaussian(next: () => number) {
  const u = Math.max(next(), Number.EPSILON);
  const v = Math.max(next(), Number.EPSILON);
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

function percentile(values: number[], pct: number) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.round((sorted.length - 1) * pct)));
  return sorted[index] ?? 0;
}

function perturbCamera(camera: CameraNode, next: () => number, options: Required<Omit<CoverageUncertaintyOptions, "seed">>) {
  const perturbed = structuredClone(camera);
  const posX = gaussian(next) * options.positionSigmaM;
  const posZ = gaussian(next) * options.positionSigmaM;
  const posY = gaussian(next) * (options.positionSigmaM / 2);

  perturbed.position = [
    perturbed.position[0] + posX,
    Math.max(0.1, perturbed.position[1] + posY),
    perturbed.position[2] + posZ,
  ];
  perturbed.yawDeg += gaussian(next) * options.yawSigmaDeg;
  perturbed.pitchDeg += gaussian(next) * options.pitchSigmaDeg;
  perturbed.rangeM = Math.max(0.5, perturbed.rangeM * (1 + gaussian(next) * options.rangeSigmaPct));
  perturbed.fovHorizontalDeg = Math.max(10, perturbed.fovHorizontalDeg + gaussian(next) * options.fovSigmaDeg);
  perturbed.fovVerticalDeg = Math.max(10, perturbed.fovVerticalDeg + gaussian(next) * (options.fovSigmaDeg * 0.75));

  if (perturbed.resolutionWidth && perturbed.resolutionHeight) {
    const widthFactor = 1 + gaussian(next) * (options.rangeSigmaPct / 2);
    const heightFactor = 1 + gaussian(next) * (options.rangeSigmaPct / 2);
    perturbed.resolutionWidth = Math.max(320, Math.round(perturbed.resolutionWidth * widthFactor));
    perturbed.resolutionHeight = Math.max(240, Math.round(perturbed.resolutionHeight * heightFactor));
  }

  if (perturbed.resolutionMP) {
    perturbed.resolutionMP = Math.max(0.3, perturbed.resolutionMP * (1 + gaussian(next) * (options.rangeSigmaPct / 2)));
  }

  return perturbed;
}

function sampleScene(scene: SecurityScene, next: () => number, options: Required<Omit<CoverageUncertaintyOptions, "seed">>) {
  const perturbed = structuredClone(scene);
  perturbed.cameras = perturbed.cameras.map((camera) => perturbCamera(camera, next, options));
  return perturbed;
}

export function computeCoverageUncertainty(
  scene: SecurityScene,
  options?: CoverageUncertaintyOptions,
): CoverageUncertaintySummary | null {
  const merged = { ...DEFAULT_OPTIONS, ...options };
  if (scene.cameras.length === 0) return null;
  if (scene.criticalZones.length === 0) return null;

  const baseSeed = options?.seed ?? hashString(`${scene.id}:${scene.name}:${scene.dimensions.width}x${scene.dimensions.depth}`);
  const next = mulberry32(baseSeed);
  const coverageSamples: number[] = [];
  const recognitionSamples: number[] = [];
  const identificationSamples: number[] = [];
  const zonePassCount = new Map<string, { label: string; passes: number }>();

  for (const zone of scene.criticalZones) {
    zonePassCount.set(zone.id, { label: zone.label, passes: 0 });
  }

  for (let index = 0; index < merged.sampleCount; index += 1) {
    const perturbed = sampleScene(scene, next, merged);
    const result = simulateStudioLite(perturbed);
    coverageSamples.push(result.totalCoveragePct);
    recognitionSamples.push(result.recognitionAreaPct);
    identificationSamples.push(result.identificationAreaPct);

    for (const zone of result.criticalZoneResults) {
      const entry = zonePassCount.get(zone.zoneId);
      if (entry && zone.status === "pass") {
        entry.passes += 1;
      }
    }
  }

  const zonePassRates = Array.from(zonePassCount.entries())
    .map(([zoneId, entry]) => ({
      zoneId,
      label: entry.label,
      passRate: Number((entry.passes / merged.sampleCount).toFixed(2)),
    }))
    .sort((a, b) => a.passRate - b.passRate);

  const worstZone = zonePassRates[0] ?? null;

  return {
    sampleCount: merged.sampleCount,
    positionSigmaM: merged.positionSigmaM,
    yawSigmaDeg: merged.yawSigmaDeg,
    pitchSigmaDeg: merged.pitchSigmaDeg,
    rangeSigmaPct: merged.rangeSigmaPct,
    fovSigmaDeg: merged.fovSigmaDeg,
    meanCoveragePct: Number((coverageSamples.reduce((sum, value) => sum + value, 0) / coverageSamples.length).toFixed(1)),
    p5CoveragePct: Number(percentile(coverageSamples, 0.05).toFixed(1)),
    p95CoveragePct: Number(percentile(coverageSamples, 0.95).toFixed(1)),
    meanRecognitionAreaPct: Number((recognitionSamples.reduce((sum, value) => sum + value, 0) / recognitionSamples.length).toFixed(1)),
    meanIdentificationAreaPct: Number((identificationSamples.reduce((sum, value) => sum + value, 0) / identificationSamples.length).toFixed(1)),
    worstZoneLabel: worstZone?.label ?? null,
    worstZonePassRate: worstZone ? worstZone.passRate : null,
    zonePassRates,
  };
}
