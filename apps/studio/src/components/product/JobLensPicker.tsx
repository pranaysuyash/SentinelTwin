"use client";

import { JOB_CATALOG, type JobId } from "@sentineltwin/core";
import { useStudioStore } from "@/store/studio-store";
import { useProductViewStore } from "@/store/product-view-store";

/**
 * First-run lens selection surface. Shown when lensConfirmed === false.
 * The visitor picks a job-to-be-done; we persist it and route to product_home
 * with that lens applied. Anonymous-trial friendly: no login required.
 *
 * See Docs/architecture/11_JOB_LENS_ROUTER.md and D-331.
 */
export function JobLensPicker() {
  const confirmLens = useStudioStore((s) => s.confirmLens);
  const navigate = useProductViewStore((s) => s.navigate);

  const handlePick = (jobId: JobId) => {
    confirmLens(jobId);
    navigate("product_home");
  };

  return (
    <div
      className="flex h-full w-full flex-col items-center justify-center overflow-y-auto"
      style={{ background: "var(--bg)" }}
    >
      <div className="mx-auto w-full max-w-4xl px-6 py-10">
        <h1 className="text-center text-2xl font-semibold text-[color:var(--text)]">
          What are you here to do?
        </h1>
        <p className="mt-2 text-center text-sm text-[color:var(--text-muted)]">
          Pick the job that fits. You can switch any time from the top bar — the simulation stays the
          same, we just surface what matters for your job.
        </p>

        <div className="mt-8 grid gap-3 sm:grid-cols-2">
          {JOB_CATALOG.map((job) => (
            <button
              key={job.id}
              type="button"
              onClick={() => handlePick(job.id)}
              className="group rounded-xl border border-white/10 p-5 text-left transition hover:border-white/30 hover:bg-white/5"
            >
              <div className="flex items-baseline justify-between">
                <span className="text-base font-medium text-[color:var(--text)]">{job.label}</span>
                <span className="text-xs uppercase tracking-wide text-[color:var(--text-muted)]">
                  {job.lens.primaryVerb}
                </span>
              </div>
              <p className="mt-2 text-sm text-[color:var(--text-muted)]">{job.blurb}</p>
              <p className="mt-3 text-xs text-[color:var(--text-muted)] opacity-70 group-hover:opacity-100">
                Starts in {job.lens.defaultWorkspacePreset} ·{" "}
                {job.lens.defaultReadPosture === "read_only" ? "read-only" : "read & write"}
              </p>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
