"use client";

import { useState } from "react";
import { JOB_CATALOG, getJobById } from "@sentineltwin/core";
import { useStudioStore } from "@/store/studio-store";

/**
 * Compact lens switcher for the TopBar. Switching mid-session is always
 * explicit (invariant 2) and does not fork data. Source becomes
 * `explicit_switch` for observability.
 *
 * See Docs/architecture/11_JOB_LENS_ROUTER.md and D-331.
 */
export function JobLensSwitcher() {
  const activeJobId = useStudioStore((s) => s.activeJobId);
  const switchJob = useStudioStore((s) => s.switchJob);
  const [open, setOpen] = useState(false);
  const active = getJobById(activeJobId);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 rounded-lg border border-white/10 px-2.5 py-1.5 text-xs text-[color:var(--text-muted)] hover:text-white"
        aria-haspopup="menu"
        aria-expanded={open}
        title="Switch job lens"
      >
        <span className="h-1.5 w-1.5 rounded-full" style={{ background: "var(--accent)" }} />
        {active?.label ?? "Lens"}
      </button>

      {open && (
        <>
          {/* click-away overlay */}
          <button
            type="button"
            aria-label="Close lens menu"
            className="fixed inset-0 z-40 cursor-default"
            onClick={() => setOpen(false)}
          />
          <div
            role="menu"
            className="absolute right-0 z-50 mt-1 w-56 rounded-lg border border-white/10 p-1 shadow-xl"
            style={{ background: "var(--bg-elevated, var(--bg))" }}
          >
            {JOB_CATALOG.map((job) => (
              <button
                key={job.id}
                type="button"
                role="menuitemradio"
                aria-checked={job.id === activeJobId}
                onClick={() => {
                  switchJob(job.id);
                  setOpen(false);
                }}
                className="flex w-full flex-col items-start rounded-md px-2.5 py-2 text-left hover:bg-white/5"
              >
                <span className="text-xs font-medium text-[color:var(--text)]">{job.label}</span>
                <span className="text-[11px] text-[color:var(--text-muted)]">{job.blurb}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
