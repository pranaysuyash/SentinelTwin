"use client";

import { Clock, RotateCcw, X } from "lucide-react";
import { useAutosave } from "@/hooks/useAutosave";

function formatTimeAgo(timestamp: number): string {
  const diffMs = Date.now() - timestamp;
  const diffMin = Math.round(diffMs / 60_000);
  if (diffMin < 1) return "just now";
  if (diffMin === 1) return "1 minute ago";
  if (diffMin < 60) return `${diffMin} minutes ago`;
  const diffHours = Math.round(diffMin / 60);
  if (diffHours === 1) return "1 hour ago";
  return `${diffHours} hours ago`;
}

/**
 * Recovery banner rendered when `useAutosave` detects an unsaved autosave
 * in localStorage.  Stays out of the critical rendering path — only visible
 * when there is an actual recovery candidate.
 */
export function AutosaveRecoveryBanner() {
  const { pendingRecovery, applyRecovery, dismissRecovery } = useAutosave();

  if (!pendingRecovery) return null;

  return (
    <div
      role="alert"
      aria-live="polite"
      className="flex items-center justify-between gap-3 border-b border-amber-900/30 bg-amber-950/30 px-4 py-2 text-[11px] text-amber-300"
    >
      <div className="flex items-center gap-2">
        <Clock className="h-3.5 w-3.5 flex-shrink-0" />
        <span>
          Unsaved work found from{" "}
          <span className="font-semibold">{formatTimeAgo(pendingRecovery.timestamp)}</span>.
          Recover it?
        </span>
      </div>
      <div className="flex items-center gap-1.5">
        <button
          onClick={applyRecovery}
          className="flex items-center gap-1 rounded bg-amber-500/20 px-2 py-1 text-[10px] font-medium text-amber-300 transition-colors hover:bg-amber-500/30"
        >
          <RotateCcw className="h-3 w-3" />
          Recover
        </button>
        <button
          onClick={dismissRecovery}
          aria-label="Dismiss recovery prompt"
          className="rounded p-1 text-amber-500/50 transition-colors hover:text-amber-300"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
