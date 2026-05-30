"use client";

import { HorizontalDivider } from "@/components/shared/HorizontalDivider";
import { ErrorFallback } from "@/components/shared/ErrorFallback";

export default function StudioError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[color:var(--st-bg,#080b11)] px-6 text-[color:var(--st-text,#e6edf7)]">
      <div className="w-full max-w-xl rounded-[28px] border border-[color:var(--st-border,#22314b)] bg-[color:var(--st-panel,rgba(11,16,26,0.94))] p-6 shadow-[0_24px_70px_rgba(0,0,0,0.34)]">
        <div className="text-[11px] uppercase tracking-[0.24em] text-[color:var(--st-muted,#8a96ab)]">SentinelTwin Studio</div>
        <div className="mt-3">
          <ErrorFallback error={error} label="The studio hit a runtime error" onRetry={reset} />
        </div>
        <div className="mt-5">
          <HorizontalDivider />
        </div>
        <p className="mt-4 text-sm leading-6 text-[color:var(--st-muted,#8a96ab)]">
          Retry will re-enter the canonical shell. If the error repeats, the issue is likely in the current route or data snapshot rather than the app boundary itself.
        </p>
      </div>
    </main>
  );
}
