import type { CoverageCellResult, DoriQuality } from "@sentineltwin/core";
import { QUALITY_ORDER, OODPCVS_THRESHOLDS, DORI_THRESHOLDS } from "@sentineltwin/core";

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

const FRAGILE_THRESHOLD = 0.2;

function findDoriThreshold(quality: DoriQuality, direction: "down" | "up"): number | undefined {
  const idx = QUALITY_ORDER.indexOf(quality);
  if (direction === "down") {
    const direct = (DORI_THRESHOLDS as Record<string, number | undefined>)[quality];
    if (direct != null) return direct;
    for (let i = idx - 1; i >= 0; i--) {
      const t = (DORI_THRESHOLDS as Record<string, number | undefined>)[QUALITY_ORDER[i]];
      if (t != null) return t;
    }
  } else {
    for (let i = idx + 1; i < QUALITY_ORDER.length; i++) {
      const t = (DORI_THRESHOLDS as Record<string, number | undefined>)[QUALITY_ORDER[i]];
      if (t != null) return t;
    }
  }
  return undefined;
}

function ppmThresholdForQuality(quality: DoriQuality, isOodpcvs: boolean): number | undefined {
  if (isOodpcvs) {
    return OODPCVS_THRESHOLDS[quality];
  }
  return findDoriThreshold(quality, "down");
}

function computeFragilityWithOrder(
  ppm: number,
  quality: DoriQuality,
  isOodpcvs: boolean,
): { fragility: number; ppmMargin: number } {
  const lower = ppmThresholdForQuality(quality, isOodpcvs);
  if (lower == null) return { fragility: 0, ppmMargin: 0 };

  let upper: number | undefined;
  if (isOodpcvs) {
    const qOrder = QUALITY_ORDER;
    const idx = qOrder.indexOf(quality);
    if (idx <= 0 || idx >= qOrder.length - 1) return { fragility: 0, ppmMargin: 0 };
    const nextQuality = qOrder[idx + 1];
    upper = OODPCVS_THRESHOLDS[nextQuality];
  } else {
    upper = findDoriThreshold(quality, "up");
  }

  if (upper == null || !Number.isFinite(upper) || upper <= lower) {
    return { fragility: 0, ppmMargin: 0 };
  }

  const range = upper - lower;
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
