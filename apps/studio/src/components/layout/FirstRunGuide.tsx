"use client";

import { useEffect, useState } from "react";

const FIRST_RUN_DISMISSED_KEY = "sentineltwin:first-run-dismissed:v1";

/**
 * Has the current operator already dismissed the first-run guide?
 * Persisted to localStorage so the guide stops appearing for users
 * who've completed the onboarding. The version suffix lets us
 * re-show the guide when the flow itself changes materially.
 */
export function hasDismissedFirstRunGuide(): boolean {
  if (typeof window === "undefined") return true;
  try {
    return window.localStorage.getItem(FIRST_RUN_DISMISSED_KEY) === "true";
  } catch {
    return true;
  }
}

/**
 * Mark the first-run guide as dismissed. Idempotent. Failures
 * (quota, privacy mode) are silent — the next launch will simply
 * show the guide again, which is the conservative default.
 */
export function markFirstRunGuideDismissed(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(FIRST_RUN_DISMISSED_KEY, "true");
  } catch {
    // localStorage may be unavailable in private mode or
    // when quota is exhausted. The guide will reappear on next
    // launch, which is the safe default.
  }
}

/**
 * Clear the dismissal flag so the next session shows the guide
 * again. Exposed for the Help tab's "Show first-run guide" option.
 */
export function resetFirstRunGuideDismissal(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(FIRST_RUN_DISMISSED_KEY);
  } catch {
    // Same conservative failure mode as markFirstRunGuideDismissed.
  }
}

export default function FirstRunGuide({ onClose, onOpenHelp }: { onClose: () => void; onOpenHelp: () => void }) {
  const [dontShowAgain, setDontShowAgain] = useState(true);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (dontShowAgain) markFirstRunGuideDismissed();
        else resetFirstRunGuideDismissal();
        onClose();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose, dontShowAgain]);

  const handleStart = () => {
    if (dontShowAgain) markFirstRunGuideDismissed();
    else resetFirstRunGuideDismissal();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/55 backdrop-blur-sm" onClick={handleStart}>
      <div className="w-[560px] max-w-[92vw] rounded-xl border border-[#26304a] bg-[#0d111a] p-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="text-[13px] font-semibold text-white">Welcome to SentinelTwin Studio</div>
        <div className="mt-2 text-[12px] text-[#9fb0ce]">First run flow:</div>
        <ol className="mt-2 space-y-1 text-[12px] text-[#c6d3eb]">
          <li>1. Place/select cameras and assumptions.</li>
          <li>2. Run simulation with <kbd className="rounded border border-[#2a3248] bg-[#11182a] px-1">Ctrl/Cmd + Enter</kbd>.</li>
          <li>3. Open Security Outcome to review failures and causes.</li>
          <li>4. Preview Fix, compare before/after, then apply.</li>
        </ol>
        <div className="mt-4 flex items-center justify-between border-t border-[#1e2538] pt-3">
          <label className="flex cursor-pointer items-center gap-2 text-[11px] text-[#9fb0ce] select-none">
            <input
              type="checkbox"
              checked={dontShowAgain}
              onChange={(e) => setDontShowAgain(e.target.checked)}
              className="h-3.5 w-3.5 rounded border-[#2d3750] bg-[#11182a] text-emerald-500 focus:ring-0 focus:ring-offset-0"
            />
            Don&apos;t show this guide again on startup
          </label>
          <div className="flex items-center gap-2">
            <button type="button" onClick={onOpenHelp} className="rounded border border-[#2d3750] px-3 py-1.5 text-[11px] text-[#cfe0ff] hover:bg-[#161f31]">Open Help</button>
            <button
              type="button"
              onClick={handleStart}
              data-testid="first-run-guide-start"
              className="rounded border border-emerald-500/35 px-3 py-1.5 text-[11px] text-emerald-300 hover:bg-emerald-500/10"
            >
              Start
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
