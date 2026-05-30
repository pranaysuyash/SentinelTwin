import type { DoriQuality, SecurityScene } from "@sentineltwin/core";
import { createCoverageEvaluator, getIdentificationAreaPct, getRecognitionAreaPct } from "./coverage.js";
import { qualityToScore, scoreToQuality } from "@sentineltwin/core";
import { pointInPolygon } from "@sentineltwin/core";

export interface CoveragePostureVariation {
  baseline: {
    recognitionAreaPct: number;
    identificationAreaPct: number;
  };
  byEntrance: EntrancePostureScore[];
  worstCase: {
    entranceLabel: string;
    recognitionAreaPct: number;
    identificationAreaPct: number;
  };
}

export interface EntrancePostureScore {
  entranceLabel: string;
  recognitionAreaPct: number;
  identificationAreaPct: number;
}

export function computeCoveragePostureVariation(
  scene: SecurityScene,
  evaluator?: ReturnType<typeof createCoverageEvaluator>,
): CoveragePostureVariation | null {
  const coverageEvaluator = evaluator ?? createCoverageEvaluator(scene);
  const coverageThresholds = { doriStandard: scene.assumptions.doriStandard };

  const baselineCells = coverageEvaluator.computeCoverageCells(4);
  const baselineRecognition = getRecognitionAreaPct(baselineCells, coverageThresholds, true);
  const baselineIdentification = getIdentificationAreaPct(baselineCells, coverageThresholds, true);

  if (scene.entryPoints.length === 0) {
    return {
      baseline: {
        recognitionAreaPct: baselineRecognition,
        identificationAreaPct: baselineIdentification,
      },
      byEntrance: [],
      worstCase: {
        entranceLabel: "default",
        recognitionAreaPct: baselineRecognition,
        identificationAreaPct: baselineIdentification,
      },
    };
  }

  const byEntrance: EntrancePostureScore[] = [];

  // For each entry point, evaluate coverage quality from a detection start zone
  for (const entry of scene.entryPoints) {
    // Build a small entry zone polygon around the entry point
    const entryRadius = 1.5;
    const entryPolygon: [number, number][] = [
      [entry.position[0] - entryRadius, entry.position[1] - entryRadius],
      [entry.position[0] + entryRadius, entry.position[1] - entryRadius],
      [entry.position[0] + entryRadius, entry.position[1] + entryRadius],
      [entry.position[0] - entryRadius, entry.position[1] + entryRadius],
    ];

    const entryCells = baselineCells.filter((cell) =>
      pointInPolygon([cell.x, cell.z], entryPolygon),
    );

    const enterRecognized = entryCells.filter(
      (cell) => qualityToScore(cell.quality) >= 5,
    ).length;
    const enterIdentified = entryCells.filter(
      (cell) => qualityToScore(cell.quality) >= 6,
    ).length;

    byEntrance.push({
      entranceLabel: entry.label ?? `entry_${entry.position[0].toFixed(1)}_${entry.position[1].toFixed(1)}`,
      recognitionAreaPct: entryCells.length > 0 ? (enterRecognized / entryCells.length) * 100 : 0,
      identificationAreaPct: entryCells.length > 0 ? (enterIdentified / entryCells.length) * 100 : 0,
    });
  }

  byEntrance.sort((a, b) => a.recognitionAreaPct - b.recognitionAreaPct);

  return {
    baseline: {
      recognitionAreaPct: baselineRecognition,
      identificationAreaPct: baselineIdentification,
    },
    byEntrance,
    worstCase: byEntrance[0] ?? {
      entranceLabel: "default",
      recognitionAreaPct: baselineRecognition,
      identificationAreaPct: baselineIdentification,
    },
  };
}
