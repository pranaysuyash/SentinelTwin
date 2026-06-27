"use client";

/**
 * ScanProgressStepper — horizontal 10-step progress indicator (Intake Pass I2).
 *
 * Extracted from the inlined stepper in `ScanSiteWizard.tsx` guided branch
 * (per design-pack prescription at `sentineltwin_ui_design_pack/...md:1271`).
 * The prior inlined version rendered correctly but was coupled to the wizard
 * internals; this extraction lets the stepper be reused and tested in
 * isolation, and makes the step list a typed constant rather than a local
 * array rebuilt on every render.
 *
 * Design-pack contract (`:1014-1027`): 10 numbered circles with connector
 * lines, completed = emerald check, active = blue ring, pending = muted.
 *
 * Visual Pass V1: tone classes come from `UI_TONES` (no raw Tailwind color
 * utilities). Step labels use the design-pack copy verbatim.
 */

import { Check } from "lucide-react";

import { UI_TONES } from "@/lib/design-tokens";

/** The canonical 10 guided-scan steps (design-pack §23, verbatim copy). */
export const SCAN_GUIDED_STEPS = [
  "Set room dimensions",
  "Upload overview photos",
  "Mark front wall / room shell",
  "Mark entry point",
  "Mark critical zone",
  "Mark existing cameras",
  "Mark obstructions",
  "Mark lights & windows",
  "Mark path",
  "Review & compile",
] as const;

export type ScanGuidedStepIndex = number; // 0..9

export interface ScanProgressStepperProps {
  /** Currently-active step index (0..9). */
  current: ScanGuidedStepIndex;
  /** Steps the operator has completed (rendered with the check). */
  completed: ScanGuidedStepIndex[];
  /** Optional click-to-jump handler; when omitted, circles are non-interactive. */
  onJump?: (index: ScanGuidedStepIndex) => void;
}

export function ScanProgressStepper({ current, completed, onJump }: ScanProgressStepperProps) {
  const completedSet = new Set(completed);
  return (
    <div className="grid grid-cols-10 gap-0 rounded-[18px] border border-white/8 bg-white/[0.015] px-4 py-5">
      {SCAN_GUIDED_STEPS.map((label, index) => {
        const active = index === current;
        const complete = completedSet.has(index);
        const tone = complete ? UI_TONES.success : active ? UI_TONES.info : UI_TONES.neutral;
        const interactive = Boolean(onJump);
        return (
          <div key={label} className="flex min-w-0 flex-col items-center">
            <div className="flex w-full items-center">
              {index > 0 ? <div className="h-px flex-1 bg-white/10" /> : null}
              <button
                type="button"
                disabled={!interactive}
                onClick={() => onJump?.(index)}
                className={[
                  "flex h-9 w-9 flex-none items-center justify-center rounded-full border text-[15px] font-medium transition-colors",
                  tone.border,
                  complete ? `${tone.bg} text-white` : active ? `${tone.bg} ${tone.text}` : "bg-transparent text-slate-400",
                  interactive ? "cursor-pointer hover:opacity-80" : "cursor-default",
                ].join(" ")}
                aria-label={`Step ${index + 1}: ${label}${active ? " (current)" : complete ? " (completed)" : ""}`}
                aria-current={active ? "step" : undefined}
              >
                {complete ? <Check className="h-4 w-4" /> : index + 1}
              </button>
              {index < SCAN_GUIDED_STEPS.length - 1 ? <div className="h-px flex-1 bg-white/10" /> : null}
            </div>
            <div className={[
              "mt-3 px-1 text-center text-[15px] leading-[1.15]",
              active ? "text-white" : "text-slate-300",
            ].join(" ")}>
              {label}
            </div>
          </div>
        );
      })}
    </div>
  );
}
