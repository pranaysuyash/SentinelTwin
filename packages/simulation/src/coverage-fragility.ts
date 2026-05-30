import type { CoverageCellResult, DoriQuality } from "@sentineltwin/core";
import { DORI_THRESHOLDS, OODPCVS_THRESHOLDS } from "@sentineltwin/core";

export interface CellFragility {
  cellX: number;
  cellZ: number;
  currentQuality: DoriQuality;
  fragility: number;
  ppmMargin: number;
}

export interface FragilitySummary {
  cells: CellFragility[];
  meanFragility: number;
  fragileCellCount: number;
  robustCellCount: number;
  totalCells: number;
}

const FRAGILE_THRESHOLD = 0.3;

function ppmThresholdForQuality(quality: DoriQuality, isOodpcvs: boolean): number | undefined {
  if (isOodpcvs) {
    const t = OODPCVS_THRESHOLDS as Record<string, number | undefined>;
    return t[quality] ?? undefined;
  }
  const t = DORI_THRESHOLDS as Record<string, number | undefined>;
  return t[quality] ?? undefined;
}

const QUALITY_ORDER: DoriQuality[] = [
  "none", "detection", "overview", "outline", "observation",
  "discern", "perceive", "recognition", "characterize",
  "identification", "validate", "scrutinize",
];

function computeFragilityWithOrder(
  ppm: number,
  quality: DoriQuality,
  isOodpcvs: boolean,
): { fragility: number; ppmMargin: number } {
  const idx = QUALITY_ORDER.indexOf(quality);
  if (idx <= 0 || idx >= QUALITY_ORDER.length - 1) return { fragility: 0, ppmMargin: 0 };

  const lower = ppmThresholdForQuality(quality, isOodpcvs);
  const nextQuality = QUALITY_ORDER[idx + 1];
  const upper = ppmThresholdForQuality(nextQuality, isOodpcvs);

  if (lower == null || upper == null || !Number.isFinite(upper)) {
    return { fragility: 0, ppmMargin: 0 };
  }

  const range = upper - lower;
  if (range <= 0) return { fragility: 0, ppmMargin: 0 };

  const lowerDist = ppm - lower;
  const upperDist = upper - ppm;
  const minDist = Math.min(lowerDist, upperDist);

  return {
    fragility: Math.max(0, Math.min(1, 1 - minDist / range)),
    ppmMargin: Math.max(0, lowerDist),
  };
}

export function computeCoverageFragility(
  cells: CoverageCellResult[],
  doriStandard: "dori_2014" | "oodpcvs_2025" = "dori_2014",
): FragilitySummary {
  const isOodpcvs = doriStandard === "oodpcvs_2025";
  const fragilityCells: CellFragility[] = [];

  for (const cell of cells) {
    if (cell.ppm == null || cell.ppm <= 0 || cell.quality === "none") continue;

    const quality = cell.quality as DoriQuality;
    const { fragility, ppmMargin } = computeFragilityWithOrder(cell.ppm, quality, isOodpcvs);

    fragilityCells.push({ cellX: cell.x, cellZ: cell.z, currentQuality: quality, fragility, ppmMargin });
  }

  if (fragilityCells.length === 0) {
    return { cells: [], meanFragility: 0, fragileCellCount: 0, robustCellCount: 0, totalCells: 0 };
  }

  const total = fragilityCells.length;
  const sum = fragilityCells.reduce((s, c) => s + c.fragility, 0);
  const fragileCount = fragilityCells.filter((c) => c.fragility >= FRAGILE_THRESHOLD).length;

  return {
    cells: fragilityCells,
    meanFragility: sum / total,
    fragileCellCount: fragileCount,
    robustCellCount: total - fragileCount,
    totalCells: total,
  };
}
