/**
 * @sentineltwin/studio — canonical confidence rendering (Trust Pass T1)
 *
 * Single source of truth for the *display* of confidence values. Replaces
 * three divergent band definitions that had drifted across the codebase:
 *   - `operational-evidence.ts:561-568` (High ≥ 0.9 / Medium ≥ 0.65 / Low)
 *   - `ImportReview.tsx:120-121`        (high ≥ 0.75 / medium ≥ 0.50 / low)
 *   - `MetricsTab.tsx` 5-level `ConfidenceBand` (verified/high/medium/low/none)
 *
 * The 2026-06-17 buyer-demo trust break (see `Docs/notes/sentineltwin_issue_review_2026-06-18.md:41-51`)
 * was caused by `ImportReview` rendering `100%` next to severe warnings. Per
 * `motto_v3 §0.2` ("Never use confident language to hide unknowns, skipped
 * checks, or unresolved edge cases") and §0.11 ("Do not let UI copy imply
 * guarantees the system cannot operationally or legally support"), this module
 * enforces two rules:
 *
 *   RULE 1 (warning gating): if there are unresolved warnings, the displayed
 *     confidence can NEVER read as "100%". It is capped below the High band's
 *     ceiling and tagged with the warning count, so the UI cannot lie about
 *     certainty the system does not have.
 *
 *   RULE 2 (source decomposition): every confidence value carries a `source`
 *     string (e.g. "N detector candidates, M unresolved warnings") so the
 *     number is never a bare scalar. The buyer must be able to see what the
 *     number is made of.
 *
 * This module is pure and testable. UI components consume `renderConfidence`
 * to get a `{ label, pct, tone, source }` shape they can render in any idiom.
 *
 * See `Docs/review/UI_REVIEW_2026-06-19.md` Trust Pass T1.
 */

export type ConfidenceBand = "high" | "medium" | "low";

export interface ConfidenceInput {
  /** Raw confidence in 0..1. Clamped to [0, 1] defensively. */
  confidence: number;
  /**
   * Unresolved warnings about the underlying data (detector warnings,
   * validation warnings, manual-review flags, etc.). When > 0, RULE 1 applies
   * and the rendered percentage is capped below 100 with the warning count
   * surfaced in `source`.
   */
  unresolvedWarningCount: number;
  /**
   * Optional human-readable decomposition of the confidence value — the more
   * specific, the better. e.g. "12 detector candidates, 3 unresolved warnings"
   * or "user-entered dimensions, 0 warnings". When omitted, the source is
   * synthesized from `unresolvedWarningCount`.
   */
  sourceDetail?: string;
  /**
   * Detector candidate count (or analogous sample size). When provided and
   * small, the band is downgraded — a 0.95 confidence from 2 candidates is not
   * the same signal as 0.95 from 50 candidates. Defaults to a value that
   * disables this check.
   */
  detectorCandidateCount?: number;
}

export interface RenderedConfidence {
  /** The band the *displayed* percentage falls into (post-gating). */
  band: ConfidenceBand;
  /** The percentage to render, post-gating. Never 100 when warnings exist. */
  pct: number;
  /** Stable tone key for styling (matches the existing badge palette). */
  tone: "emerald" | "amber" | "rose";
  /** Human-readable source decomposition. Never empty. */
  source: string;
  /** True when the displayed value was gated down from the raw confidence. */
  gated: boolean;
}

const HIGH_THRESHOLD = 0.85;
const MEDIUM_THRESHOLD = 0.6;
const WARNINGS_GATE_CEILING_PCT = 92; // never show ≥ 93% when warnings exist
const MIN_CANDIDATES_FOR_HIGH = 5;

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function bandForPct(pct: number): ConfidenceBand {
  if (pct >= HIGH_THRESHOLD * 100) return "high";
  if (pct >= MEDIUM_THRESHOLD * 100) return "medium";
  return "low";
}

function toneForBand(band: ConfidenceBand): RenderedConfidence["tone"] {
  return band === "high" ? "emerald" : band === "medium" ? "amber" : "rose";
}

/**
 * Render a confidence value under the T1 rules. Pure — deterministic over
 * `input`. Components should call this and render `pct` + `source` together;
 * never render `pct` alone.
 *
 * @example
 *   const c = renderConfidence({ confidence: 0.99, unresolvedWarningCount: 3,
 *                                detectorCandidateCount: 12 });
 *   // → { band: "medium", pct: 92, tone: "amber",
 *   //     source: "12 detector candidates · 3 unresolved warnings", gated: true }
 */
export function renderConfidence(input: ConfidenceInput): RenderedConfidence {
  const raw = clamp(input.confidence, 0, 1);
  const rawPct = Math.round(raw * 100);
  const warnings = Math.max(0, Math.floor(input.unresolvedWarningCount));
  const candidates = input.detectorCandidateCount ?? Number.MAX_SAFE_INTEGER;

  // RULE 1 — warning gating. Two effects:
  //   (a) The displayed percentage can never read as 100% (or within the High
  //       band's upper range) when warnings exist. Cap below the High ceiling.
  //   (b) The displayed band can never be "high" — warnings are an explicit
  //       statement that the system does not have high confidence. So warnings
  //       force the band to medium-or-lower regardless of candidate count.
  const gatedByWarnings = warnings > 0;
  // Small-sample gating — even with no warnings, a "high" band from very few
  // candidates is downgraded to medium (a 0.99 from 2 candidates is fragile).
  const gatedBySample = candidates < MIN_CANDIDATES_FOR_HIGH && rawPct >= HIGH_THRESHOLD * 100;
  const ceiling = gatedByWarnings ? WARNINGS_GATE_CEILING_PCT : 100;
  let pct = Math.min(rawPct, ceiling);

  // Source decomposition. Prefer caller-supplied detail; otherwise synthesize.
  const source = input.sourceDetail?.trim()
    ?? (warnings > 0
      ? `${candidates === Number.MAX_SAFE_INTEGER ? "" : `${candidates} detector candidates · `}${warnings} unresolved warning${warnings === 1 ? "" : "s"}`
      : `${candidates === Number.MAX_SAFE_INTEGER ? "computed" : `${candidates} detector candidates`}, no warnings`);

  // Band derivation — three rules, applied in order:
  //   1. Warnings force medium-or-lower (the system explicitly lacks high
  //      confidence when it has unresolved warnings).
  //   2. Otherwise small-sample gating downgrades high → medium.
  //   3. Otherwise the band follows the (possibly warning-capped) percentage.
  let band: ConfidenceBand;
  if (gatedByWarnings) {
    band = pct >= MEDIUM_THRESHOLD * 100 ? "medium" : "low";
  } else if (gatedBySample && rawPct >= HIGH_THRESHOLD * 100) {
    band = "medium";
  } else {
    band = bandForPct(pct);
  }

  // Re-clamp pct to the band ceiling so the number and band always agree:
  // never show "92% High" or "84% Medium" or "59% Low".
  if (band === "high") pct = Math.min(pct, 100);
  if (band === "medium") pct = Math.min(pct, Math.round(HIGH_THRESHOLD * 100) - 1);
  if (band === "low") pct = Math.min(pct, Math.round(MEDIUM_THRESHOLD * 100) - 1);

  return {
    band,
    pct,
    tone: toneForBand(band),
    source,
    gated: gatedByWarnings || gatedBySample,
  };
}

/**
 * The band labels for direct display. Replaces the local band maps in
 * `ImportReview.tsx`, `SiteDraftReview.tsx`, and the 5-level map in
 * `MetricsTab.tsx` (the `verified` tier is folded into `high` for display
 * purposes — callers that need to distinguish "verified" can use the
 * simulation package's `ConfidenceBand` type directly).
 */
export const CONFIDENCE_BAND_LABEL: Record<ConfidenceBand, string> = {
  high: "High",
  medium: "Medium",
  low: "Low",
};

/**
 * Tailwind class fragments per tone — kept here so every confidence surface
 * uses the same palette. Consumers compose these into their badge markup.
 */
export const CONFIDENCE_TONE_CLASSES: Record<RenderedConfidence["tone"], { text: string; border: string; bg: string }> = {
  emerald: { text: "text-emerald-200", border: "border-emerald-500/30", bg: "bg-emerald-500/12" },
  amber:   { text: "text-amber-100",   border: "border-amber-500/30",   bg: "bg-amber-500/12" },
  rose:    { text: "text-rose-200",    border: "border-rose-500/30",    bg: "bg-rose-500/12" },
};
