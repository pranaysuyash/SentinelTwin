"use client";

/**
 * ScanProgressSidebar — right-rail session/progress panel (Intake Pass I2).
 *
 * Extracted per design-pack prescription (`:1273`). Implements the design-pack
 * "Right progress panel" spec verbatim (`:1127-1178`):
 *   - "Your progress" bar driven by actual session state (not hardcoded).
 *   - "Steps overview" list with the current step highlighted.
 *   - "Session info" block (session ID, created, photos uploaded, est. time).
 *   - "Limitation card" — the honest-maturity disclosure ("Manual-assisted
 *     scan (V1). You confirm all elements. AI segmentation & depth coming
 *     later."). This is also a truth-audit-adjacent surface — don't strip it.
 *
 * Design-pack gating rule (`:1409`): "Step status must be derived from actual
 * scan session state, not hardcoded UI." The prior inlined sidebar hardcoded
 * "1 of 10 steps completed" — this component takes `completed`/`photosUploaded`
 * as props so the count is always honest.
 */

import { SCAN_GUIDED_STEPS, type ScanGuidedStepIndex } from "./ScanProgressStepper";
import { UI_TONES } from "@/lib/design-tokens";

export interface ScanProgressSidebarProps {
  current: ScanGuidedStepIndex;
  completed: ScanGuidedStepIndex[];
  sessionId: string;
  createdAtLabel: string;
  photosUploaded: number;
  estimatedTimeRemainingLabel: string;
}

export function ScanProgressSidebar({
  current,
  completed,
  sessionId,
  createdAtLabel,
  photosUploaded,
  estimatedTimeRemainingLabel,
}: ScanProgressSidebarProps) {
  const completedSet = new Set(completed);
  const completedCount = completedSet.size;
  const totalCount = SCAN_GUIDED_STEPS.length;
  const progressPct = Math.round((completedCount / totalCount) * 100);
  const progressTone = progressPct === 100 ? UI_TONES.success : UI_TONES.info;

  return (
    <aside className="flex w-[340px] max-w-[34vw] flex-none flex-col gap-5 rounded-[22px] border border-white/8 bg-white/[0.015] p-5">
      {/* Progress */}
      <div>
        <div className="text-[13px] font-medium uppercase tracking-[0.12em] text-slate-400">Your progress</div>
        <div className="mt-1 text-[15px] text-white">
          {completedCount} of {totalCount} steps completed
        </div>
        <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-white/8">
          <div
            className={`h-full rounded-full ${progressTone.bg} ${progressTone.border} transition-all duration-300`}
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

      {/* Steps overview */}
      <div>
        <div className="text-[13px] font-medium uppercase tracking-[0.12em] text-slate-400">Steps overview</div>
        <ol className="mt-2 space-y-1">
          {SCAN_GUIDED_STEPS.map((label, index) => {
            const isCurrent = index === current;
            const isComplete = completedSet.has(index);
            return (
              <li
                key={label}
                className={[
                  "flex items-center gap-2 rounded px-2 py-1 text-[13px]",
                  isCurrent ? "bg-white/5 text-white" : "text-slate-300",
                ].join(" ")}
                aria-current={isCurrent ? "step" : undefined}
              >
                <span className={[
                  "flex h-5 w-5 flex-none items-center justify-center rounded-full border text-[11px]",
                  isComplete ? `${UI_TONES.success.border} ${UI_TONES.success.bg} ${UI_TONES.success.text}` : "border-white/15 text-slate-400",
                ].join(" ")}>
                  {index + 1}
                </span>
                <span className="truncate">{label}</span>
              </li>
            );
          })}
        </ol>
      </div>

      {/* Session info */}
      <div>
        <div className="text-[13px] font-medium uppercase tracking-[0.12em] text-slate-400">Session info</div>
        <dl className="mt-2 space-y-1 text-[12px] text-slate-300">
          <div className="flex justify-between gap-2">
            <dt className="text-slate-500">Session ID</dt>
            <dd className="font-mono text-slate-300">{sessionId}</dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-slate-500">Created</dt>
            <dd className="text-slate-300">{createdAtLabel}</dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-slate-500">Photos uploaded</dt>
            <dd className="text-slate-300">{photosUploaded}</dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-slate-500">Est. time remaining</dt>
            <dd className="text-slate-300">{estimatedTimeRemainingLabel}</dd>
          </div>
        </dl>
      </div>

      {/* Limitation card — honest-maturity disclosure (truth-audit adjacent). */}
      <div className={`rounded-lg border ${UI_TONES.warning.border} ${UI_TONES.warning.bg} p-3`}>
        <div className={`text-[12px] font-semibold ${UI_TONES.warning.text}`}>Manual-assisted scan (V1)</div>
        <p className="mt-1 text-[12px] leading-5 text-slate-300">
          You confirm all elements. AI segmentation &amp; depth coming later.
        </p>
      </div>
    </aside>
  );
}
