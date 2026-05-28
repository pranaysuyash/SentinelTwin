import type { CoverageCellResult, DoriQuality } from "@/schema/security-scene";
import { QUALITY_ORDER, qualityToScore } from "@/simulation/dori";

export type CoverageEntropySummary = {
  cellCount: number;
  entropyBits: number;
  normalizedEntropy: number;
  dominantQuality: DoriQuality;
  dominantQualityCount: number;
  dominantQualityShare: number;
  qualityCounts: Record<DoriQuality, number>;
};

function initializeCounts() {
  return Object.fromEntries(QUALITY_ORDER.map((quality) => [quality, 0])) as Record<DoriQuality, number>;
}

export function computeCoverageEntropy(
  cells: Pick<CoverageCellResult, "quality">[],
): CoverageEntropySummary | null {
  if (cells.length === 0) return null;

  const qualityCounts = initializeCounts();
  for (const cell of cells) {
    qualityCounts[cell.quality] = (qualityCounts[cell.quality] ?? 0) + 1;
  }

  const total = cells.length;
  const observed = QUALITY_ORDER.filter((quality) => qualityCounts[quality] > 0);
  if (observed.length === 0) return null;

  let entropyBits = 0;
  for (const quality of observed) {
    const count = qualityCounts[quality];
    const probability = count / total;
    entropyBits -= probability * Math.log2(probability);
  }

  const maxEntropyBits = observed.length > 1 ? Math.log2(observed.length) : 0;
  let dominantQuality = observed[0] ?? "none";
  let dominantQualityCount = qualityCounts[dominantQuality] ?? 0;

  for (const quality of observed) {
    const count = qualityCounts[quality];
    if (
      count > dominantQualityCount ||
      (count === dominantQualityCount && qualityToScore(quality) > qualityToScore(dominantQuality))
    ) {
      dominantQuality = quality;
      dominantQualityCount = count;
    }
  }

  return {
    cellCount: total,
    entropyBits: Number(entropyBits.toFixed(2)),
    normalizedEntropy: Number((maxEntropyBits > 0 ? entropyBits / maxEntropyBits : 0).toFixed(2)),
    dominantQuality,
    dominantQualityCount,
    dominantQualityShare: Number(((dominantQualityCount / total) * 100).toFixed(1)),
    qualityCounts,
  };
}
