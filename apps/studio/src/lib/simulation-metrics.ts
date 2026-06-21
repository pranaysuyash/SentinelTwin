/**
 * @sentineltwin/studio — shared simulation metrics + delta helpers
 *
 * Extracted from `components/view/CompareView.tsx` (Loop Pass L1) so the
 * ambient edit-delta surface, the Issues tab, and any future metric consumer
 * share one reduction of `SimulationResult` → flat metrics. Per `motto_v3 §11`
 * ("Avoid duplicate or parallel implementations where a single source of truth
 * should exist") — `computeMetrics` was previously local to CompareView and
 * its delta math was duplicated 3-4 times within that file. CompareView now
 * imports from here.
 *
 * Used by:
 *   - Loop Pass L1: ambient edit-delta chips after every simulation recompute
 *     (the "feel alive" requirement of the product thesis).
 *   - CompareView: before/after comparison cards.
 *   - IssuesTab / MetricsTab: any metric-rendering surface that needs the same
 *     reduction.
 */

import { qualityToScore } from "@sentineltwin/core";
import type { SimulationResult } from "@/schema/security-scene";
import { clampPathDuration } from "@/components/view/camera-view-utils";

/**
 * Coverage-cell shape — indexed out of `SimulationResult` to match
 * CompareView's `CoverageCell` alias (the type is not exported from the
 * schema package directly).
 */
export type CoverageCell = SimulationResult["coverageCells"][number];

/**
 * Flat metric shape produced by reducing a `SimulationResult` + its coverage
 * cells. Carries the headline numbers the UI shows deltas for (Coverage /
 * Recognition / Blindspot / Critical Zones / Path Visibility).
 */
export type Metrics = {
  covered: number;
  recognition: number;
  blindspot: number;
  cameras: number;
  critZonePct: number;
  critZoneTotal: number;
  visiblePathPct: number;
  lostPathPct: number;
};

/**
 * Reduce a `SimulationResult` + its coverage cells to the flat `Metrics`
 * shape. Returns `null` when there's no signal (no sim and no cells) so
 * callers can render an empty state rather than zeroes-that-look-like-data.
 *
 * Pure over its inputs — safe to memoize on `(sim, cells)` identity.
 */
export function computeMetrics(sim: SimulationResult | undefined | null, cells: CoverageCell[]): Metrics | null {
  if (!sim && cells.length === 0) return null;

  const covered = cells.length > 0 ? (cells.filter((c) => c.quality !== "none").length / cells.length) * 100 : 0;
  const recognition = cells.length > 0
    ? (cells.filter((c) => qualityToScore(c.quality) >= qualityToScore("recognition")).length / cells.length) * 100
    : 0;
  const blindspot = sim?.blindspotPct ?? (cells.length > 0 ? 100 - covered : 0);
  const cameras = sim?.cameraResults.length ?? 0;
  const critZonePass = sim ? sim.criticalZoneResults.filter((z) => z.status === "pass").length : 0;
  const critZoneTotal = sim?.criticalZoneResults.length ?? 0;
  const critZonePct = critZoneTotal > 0 ? (critZonePass / critZoneTotal) * 100 : 0;
  const visiblePathPct = sim
    ? (sim.pathResults.reduce((acc, path) => {
      const safeDurationS = clampPathDuration(path.totalDurationS);
      return acc + (safeDurationS > 0 ? (path.visibleDurationS / safeDurationS) * 100 : 0);
    }, 0) / Math.max(sim.pathResults.length, 1))
    : 0;
  const lostPathPct = sim
    ? (sim.pathResults.reduce((acc, path) => {
      const safeDurationS = clampPathDuration(path.totalDurationS);
      return acc + (safeDurationS > 0 ? (path.lostDurationS / safeDurationS) * 100 : 0);
    }, 0) / Math.max(sim.pathResults.length, 1))
    : 0;
  return { covered, recognition, blindspot, cameras, critZonePct, critZoneTotal, visiblePathPct, lostPathPct };
}

/**
 * The subset of `Metrics` keys that have a meaningful delta for the ambient
 * edit-delta strip and CompareView's cards. `cameras` (a count, not a
 * percentage) and `critZoneTotal` (a denominator) don't carry a tone-able
 * delta, so they're excluded.
 */
export type DeltaMetricKey = "covered" | "recognition" | "blindspot" | "critZonePct" | "visiblePathPct" | "lostPathPct";

/**
 * Per-metric delta between two `Metrics` snapshots. `null` when either side is
 * missing (no comparable baseline). Positive = improvement for
 * covered/recognition/critZonePct/visiblePathPct; positive = regression for
 * blindspot/lostPathPct — the caller decides the tone.
 */
export function computeMetricDeltas(a: Metrics | null, b: Metrics | null): Record<DeltaMetricKey, number> | null {
  if (!a || !b) {
    return null;
  }
  return {
    covered: b.covered - a.covered,
    recognition: b.recognition - a.recognition,
    blindspot: b.blindspot - a.blindspot,
    critZonePct: b.critZonePct - a.critZonePct,
    visiblePathPct: b.visiblePathPct - a.visiblePathPct,
    lostPathPct: b.lostPathPct - a.lostPathPct,
  };
}

export type MetricDeltas = NonNullable<ReturnType<typeof computeMetricDeltas>>;

/** Format a percentage with no decimals, "--" for missing. */
export function formatPct(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "--";
  return `${Math.round(value)}%`;
}

/** Format a signed delta as `+X.X%` / `-X.X%` (Loop Pass L1 chip styling). */
export function formatDelta(value: number): string {
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(1)}%`;
}

/**
 * Configuration for each headline-metric chip — label, which direction is
 * "good" (improvement tone), and accent color. Shared between the ambient
 * edit-delta strip and CompareView so the two surfaces stay visually
 * consistent. Per `motto_v3 §11`: one source of truth for the chip set.
 */
export interface MetricChipConfig {
  key: "covered" | "recognition" | "blindspot" | "critZonePct" | "visiblePathPct";
  label: string;
  /** When true, a positive delta is good (emerald). When false, positive is bad (rose). */
  positiveIsGood: boolean;
  accent: string;
}

export const HEADLINE_METRIC_CHIPS: MetricChipConfig[] = [
  { key: "covered",       label: "Coverage",      positiveIsGood: true,  accent: "#9ae6b4" },
  { key: "recognition",   label: "Recognition",   positiveIsGood: true,  accent: "#93c5fd" },
  { key: "blindspot",     label: "Blind spot",    positiveIsGood: false, accent: "#fca5a5" },
  { key: "critZonePct",   label: "Critical zones",positiveIsGood: true,  accent: "#fdba74" },
  { key: "visiblePathPct",label: "Path visibility",positiveIsGood: true, accent: "#c4b5fd" },
];
