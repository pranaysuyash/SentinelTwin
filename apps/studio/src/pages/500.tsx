import Link from "next/link";

export default function Error500() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[color:var(--st-bg,#080b11)] px-6 text-[color:var(--st-text,#e6edf7)]">
      <div className="max-w-lg rounded-[28px] border border-[color:var(--st-border,#22314b)] bg-[color:var(--st-panel,rgba(11,16,26,0.94))] p-8 shadow-[0_24px_70px_rgba(0,0,0,0.34)]">
        <div className="text-[11px] uppercase tracking-[0.24em] text-[color:var(--st-muted,#8a96ab)]">SentinelTwin Studio</div>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">Server error</h1>
        <p className="mt-3 text-sm leading-6 text-[color:var(--st-muted,#8a96ab)]">
          The studio hit a server-side build or runtime problem. Return to the dashboard and try again.
        </p>
        <div className="mt-6 flex items-center gap-3">
          <Link
            href="/"
            className="inline-flex items-center justify-center rounded-xl border border-emerald-400/25 bg-emerald-500 px-4 py-2 text-sm font-semibold text-[#04150d] transition-colors hover:bg-emerald-400"
          >
            Back to dashboard
          </Link>
          <Link
            href="/studio"
            className="inline-flex items-center justify-center rounded-xl border border-[color:var(--st-border,#22314b)] bg-white/[0.03] px-4 py-2 text-sm font-medium text-white transition-colors hover:border-sky-400/30 hover:bg-white/[0.05]"
          >
            Open studio
          </Link>
        </div>
      </div>
    </main>
  );
}
