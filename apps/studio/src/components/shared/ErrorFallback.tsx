"use client";

import { AlertTriangle } from "lucide-react";

interface ErrorFallbackProps {
  error?: Error;
  label?: string;
  onRetry?: () => void;
  onResetSafeState?: () => void;
}

export function ErrorFallback({ error, label = "Something went wrong", onRetry, onResetSafeState }: ErrorFallbackProps) {
  return (
    <div className="flex h-full min-h-[80px] flex-col items-center justify-center gap-2.5 rounded-lg border border-red-500/15 bg-red-500/6 px-4 py-5">
      <AlertTriangle className="h-5 w-5 text-red-400/60" />
      <div className="text-center">
        <p className="text-[10px] font-medium text-red-300">{label}</p>
        {error ? (
          <p className="mt-0.5 max-w-[280px] text-[9px] text-red-400/70">
            {error.message || "Unknown error"}
          </p>
        ) : null}
      </div>
      <div className="flex flex-wrap items-center justify-center gap-2">
        {onRetry ? (
          <button
            type="button"
            onClick={onRetry}
            className="rounded-md border border-red-500/20 px-2.5 py-1 text-[9px] font-medium text-red-200 transition-colors hover:bg-red-500/10"
          >
            Retry
          </button>
        ) : null}
        {onResetSafeState ? (
          <button
            type="button"
            onClick={onResetSafeState}
            className="rounded-md border border-red-400/25 bg-red-500/10 px-2.5 py-1 text-[9px] font-medium text-red-100 transition-colors hover:bg-red-500/15"
          >
            Reset to safe state
          </button>
        ) : null}
      </div>
    </div>
  );
}
