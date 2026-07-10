"use client";

/**
 * Ambient edit-delta strip (Loop Pass L1).
 *
 * Renders a row of small delta chips ("Coverage +4.2%") on the headline metrics
 * whenever a simulation recompute produces a measurable change vs the previous
 * result. The chips fade out after a few seconds so they announce the change
 * without becoming permanent clutter. This is the product-thesis move — "every
 * edit updates the risk map; the simulation must feel alive" — made visible in
 * the bottom-panel header so it reads regardless of which analysis tab is open.
 *
 * Design notes:
 *   - Source of truth for the before/after pair is `scene.previousSimulation`
 *     (preserved for one cycle by `simulation-slice`) and `simulationResult`.
 *     This mirrors how CompareView computes its before/after — same canonical
 *     reduction via `computeMetrics` (`@/lib/simulation-metrics`).
 *   - The chip row re-keyes on `simulationResult.computedAt` so the fade
 *     animation restarts on each recompute. A `setTimeout` clears the visible
 *     state after `DISPLAY_MS`.
 *   - Only non-zero deltas render. Zero-delta metrics are omitted rather than
 *     shown as "+0.0%" — a chip that says nothing is noise (per `motto_v3 §0.2`,
 *     don't emit signals that carry no information).
 *   - Hidden entirely (returns null) when there's no previous result, no
 *     current result, no deltas, or all deltas are zero.
 *
 * See `Docs/review/UI_REVIEW_2026-06-19.md` Loop Pass L1.
 */

import { useEffect, useMemo, useState } from "react";

import { useStudioStore } from "@/store/studio-store";
import {
  computeMetricDeltas,
  computeMetrics,
  formatDelta,
  HEADLINE_METRIC_CHIPS,
} from "@/lib/simulation-metrics";
// Visual Pass V1 — canonical semantic tones (no raw Tailwind color utilities).
import { toneForDelta, UI_TONES } from "@/lib/design-tokens";
import { UI_SURFACES } from "@/lib/studio-surface-tokens";


const DISPLAY_MS = 6000;

export function AmbientEditDelta() {
  const simulationResult = useStudioStore((s) => s.simulationResult);
  const previousSimulation = useStudioStore((s) => s.scene.previousSimulation);
  const [visible, setVisible] = useState(false);

  const computedAt = simulationResult?.computedAt ?? null;

  // Recompute deltas whenever the simulation result changes. Keyed on
  // `computedAt` (the simulation's monotonic timestamp) rather than object
  // identity so a no-op re-render doesn't retrigger the fade.
  const deltas = useMemo(() => {
    if (!simulationResult || !previousSimulation) return null;
    const a = computeMetrics(previousSimulation, previousSimulation.coverageCells ?? []);
    const b = computeMetrics(simulationResult, simulationResult.coverageCells ?? []);
    return computeMetricDeltas(a, b);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [computedAt, previousSimulation, simulationResult]);

  // Show on each new computedAt; auto-hide after DISPLAY_MS. Re-running on
  // `computedAt` is the whole point — a new sim result = a fresh announcement.
  useEffect(() => {
    if (!deltas) {
      setVisible(false);
      return;
    }
    const hasAnyNonZero = HEADLINE_METRIC_CHIPS.some((chip) => {
      const v = deltas[chip.key];
      return Math.abs(v) > 0.05;
    });
    if (!hasAnyNonZero) {
      setVisible(false);
      return;
    }
    setVisible(true);
    const timer = setTimeout(() => setVisible(false), DISPLAY_MS);
    return () => clearTimeout(timer);
  }, [deltas, computedAt]);

  if (!visible || !deltas) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="flex items-center gap-1 transition-opacity duration-500"
      data-testid="ambient-edit-delta"
    >
      {HEADLINE_METRIC_CHIPS.map((chip) => {
        const value = deltas[chip.key];
        // Skip ~zero deltas — a chip that says "+0.0%" is noise.
        if (Math.abs(value) <= 0.05) return null;
        const tone = toneForDelta(value, chip.positiveIsGood);
        const cls = UI_TONES[tone];
        return (
          <span
            key={chip.key}
            title={`${chip.label}: ${formatDelta(value)} vs previous run`}
            className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[9px] font-semibold tracking-[0.04em] ${cls.border} ${cls.bg} ${cls.text}`}
            style={{ borderColor: chip.accent + "55" }}
          >
            <span className="text-[7px] uppercase tracking-[0.1em] opacity-70">{chip.label}</span>
            <span>{formatDelta(value)}</span>
          </span>
        );
      })}
    </div>
  );
}
