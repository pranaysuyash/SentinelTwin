import {
  JOB_CATALOG,
  DEFAULT_JOB_ID,
  getJobById,
  type JobId,
  type JobResolutionSource,
} from "@sentineltwin/core";

const JOB_LENS_STORAGE_KEY = "sentineltwin_job_lens";

/** SSR-safe localStorage read for the persisted lens choice. */
function readPersistedJobId(): JobId {
  if (typeof window === "undefined") return DEFAULT_JOB_ID;
  try {
    const raw = window.localStorage.getItem(JOB_LENS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as { jobId?: string };
      if (parsed.jobId && getJobById(parsed.jobId)) {
        return parsed.jobId as JobId;
      }
    }
  } catch {
    // ignore malformed storage; fall through to default.
  }
  return DEFAULT_JOB_ID;
}

function writePersistedJobId(jobId: JobId): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(JOB_LENS_STORAGE_KEY, JSON.stringify({ jobId }));
  } catch {
    // storage may be full or blocked; non-fatal — lens stays in-memory.
  }
}

function hasPersistedJobId(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return !!window.localStorage.getItem(JOB_LENS_STORAGE_KEY);
  } catch {
    return false;
  }
}

export interface JobLensSlice {
  /** The currently active job lens id. */
  activeJobId: JobId;
  /** Where the current resolution came from — for observability/audit (motto §0.10). */
  jobResolutionSource: JobResolutionSource;
  /** True once the user has confirmed a lens (first-run gate). */
  lensConfirmed: boolean;

  /** Switch the active lens mid-session. Always `explicit_switch` source. */
  switchJob: (jobId: JobId) => void;
  /** Confirm a lens choice from the first-run picker. */
  confirmLens: (jobId: JobId) => void;
  /** Resolve the initial lens for a session (anonymous trial path). */
  resolveInitialLens: () => void;
}

// Plain function signature (set, get) matches the other studio slices
// (debug-toggles-slice, etc.). The store calls every creator with
// (set, get, store); we ignore the third arg.
export const createJobLensSlice = (
  set: (partial: Partial<JobLensSlice>) => void,
  _get: () => JobLensSlice,
): JobLensSlice => ({
  activeJobId: DEFAULT_JOB_ID,
  jobResolutionSource: "anonymous_trial",
  lensConfirmed: false,

  switchJob: (jobId) => {
    writePersistedJobId(jobId);
    set({ activeJobId: jobId, jobResolutionSource: "explicit_switch" });
  },

  confirmLens: (jobId) => {
    writePersistedJobId(jobId);
    set({ activeJobId: jobId, jobResolutionSource: "anonymous_trial", lensConfirmed: true });
  },

  resolveInitialLens: () => {
    // On session boot, read any persisted preference. If none, stay default
    // (installer) with lensConfirmed=false so the picker shows.
    const persisted = readPersistedJobId();
    const hadPersisted = hasPersistedJobId();
    set({
      activeJobId: persisted,
      lensConfirmed: hadPersisted,
      jobResolutionSource: hadPersisted ? "user_default" : "anonymous_trial",
    });
  },
});

/** Convenience selector used by JobLensRouter and the capability helper. */
export function selectActiveJob(jobLensSlice: Pick<JobLensSlice, "activeJobId">) {
  return getJobById(jobLensSlice.activeJobId) ?? JOB_CATALOG[0];
}
