# Job Lens Router Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the `Job` lens primitive (data-driven persona/workflow router) that shapes the SentinelTwin product surface around a visitor's job-to-be-done, without forking the simulation or altering identity/authorization.

**Architecture:** A new `Job` schema + typed catalog live in `@sentineltwin/core` (data layer). A new `job-lens-slice` (Zustand) in the studio holds the active lens and persists it (anonymous trial key + logged-in default). A new `JobLensRouter` component sits above the existing `ProductViewRouter` and feeds lens defaults into the existing intent-router + `layout-slice`. Authorization stays the gate via a single centralized capability helper. The simulation, `SecurityScene`, coverage, and report engines are untouched.

**Tech Stack:** TypeScript, Zod v4, Zustand, React (Next.js client components), `bun test` for tests, `tsc --noEmit` for typecheck.

**Spec:** `Docs/architecture/11_JOB_LENS_ROUTER.md`
**Decision record:** D-331 (`Docs/decisions/DECISION_LOG_ADDENDUM.md`)

---

## File Structure

**New files:**
- `packages/core/src/schema/job.ts` — Zod schema for `Job`, `JobId`, `JobLens`. Pure data contract.
- `packages/core/src/lib/job-catalog.ts` — The typed catalog of four jobs (installer/auditor/operator/insurer). Data layer (motto §0.8).
- `packages/core/src/__tests__/job-catalog.test.ts` — Schema + catalog completeness tests.
- `apps/studio/src/store/slices/job-lens-slice.ts` — Zustand slice: `{ activeJobId, source, switchJob, resolveJobForUser, applyLensDefaults }` + localStorage persistence.
- `apps/studio/src/lib/job-capability.ts` — Centralized capability helper: `canPerform(job, role, action, subject)`. The ONE place lens+authz compose (single source of truth, motto §11).
- `apps/studio/src/lib/__tests__/job-capability.test.ts` — Authorization boundary tests (high-risk path, Tier 2 per motto §0.5).
- `apps/studio/src/components/product/JobLensPicker.tsx` — First-run lens selection screen (the new first surface).
- `apps/studio/src/components/product/JobLensSwitcher.tsx` — Compact lens switcher for the TopBar.

**Modified files:**
- `packages/core/src/index.ts` — Export the new job schema + catalog.
- `apps/studio/src/store/slices/index.ts` — Export `JobLensSlice` type + `createJobLensSlice`.
- `apps/studio/src/store/studio-store.ts` — Compose `createJobLensSlice` into the combined store.
- `apps/studio/src/components/product/ProductViewRouter.tsx` — Add `product_home` first-run lens-picker gate; apply lens defaults on job entry.
- `apps/studio/src/store/product-view-store.ts` — Add `job_lens` to the `ProductView` union (the lens-picker surface).
- `apps/studio/src/components/layout/TopBar.tsx` — Mount `JobLensSwitcher`.

---

## Task 1: `Job` schema in `@sentineltwin/core`

**Files:**
- Create: `packages/core/src/schema/job.ts`

- [ ] **Step 1: Write the schema file**

```typescript
// packages/core/src/schema/job.ts
import { z } from "zod";
import { userRoleSchema } from "./workspace-backend";

/**
 * The Job lens — a data-driven lens over SentinelTwin's single simulation.
 * A Job shapes the product surface (entry, defaults, foreground, output, vocab)
 * around the visitor's job-to-be-done. It is NOT an identity and NOT an
 * authorization grant. See Docs/architecture/11_JOB_LENS_ROUTER.md and D-331.
 *
 * Invariants (enforced by the router, not the type alone):
 *  1. Job never grants or denies capability. `suggestedUserRole` is a HINT only.
 *  2. Job is freely switchable mid-session. No data fork on switch.
 *  3. Job resolution is observable (accountId/anonymousId, jobId, source).
 *  4. One sticky default per user; one per-browser trial key when anonymous.
 *  5. Explicit user navigation always wins over lens suggestions.
 */
export const jobIdSchema = z.enum(["installer", "auditor", "operator", "insurer"]);
export type JobId = z.infer<typeof jobIdSchema>;

/** Where the active job resolution came from — for observability/audit. */
export const jobResolutionSourceSchema = z.enum([
  "anonymous_trial",   // anonymous visitor self-selected a lens
  "user_default",      // logged-in user's stored preference
  "explicit_switch",   // user clicked the switcher mid-session
]);
export type JobResolutionSource = z.infer<typeof jobResolutionSourceSchema>;

export const jobLensSchema = z.object({
  // AXIS: entry — first surface + primary verb + CTA copy
  entrySurface: z.enum(["build_new", "audit_existing", "monitor_portfolio", "review_attestations"]),
  primaryVerb: z.string(),
  entryCtaCopy: z.string(),

  // AXIS: defaults — starting state + posture
  defaultViewMode: z.enum(["map", "camera_view", "wall", "replay", "compare", "report"]),
  defaultWorkspacePreset: z.enum(["edit", "coverage", "camera_wall", "replay", "compare", "report", "focus"]),
  defaultReadPosture: z.enum(["read_write", "read_only"]),
  suggestedStarterSceneId: z.string().nullable(),

  // AXIS: foreground — what panel/tool is front-and-center.
  // defaultBottomTab is z.string() because the canonical BottomTab union lives
  // in apps/studio (studio-internal), not in @sentineltwin/core. The catalog
  // values are validated at the binding site in the studio app — keeps core
  // decoupled from studio-internal types.
  foregroundedTool: z.string(),
  defaultBottomTab: z.string(),

  // AXIS: output — what "done" produces
  primaryOutput: z.enum(["client_proposal", "coverage_failure_report", "risk_digest", "compliance_attestation"]),
  defaultExportFormat: z.enum(["pdf", "json", "html"]),

  // ENRICHMENT (cheap, rides on top of the four load-bearing axes)
  vocabularySet: z.string(),
  suggestedStaircaseRung: z.number().int().min(1).max(5),
});
export type JobLens = z.infer<typeof jobLensSchema>;

export const jobSchema = z.object({
  id: jobIdSchema,
  label: z.string(),
  blurb: z.string(),
  lens: jobLensSchema,
  /** HINT for onboarding ("this lens fits installers"). Does NOT grant capability. */
  suggestedUserRole: userRoleSchema,
});
export type Job = z.infer<typeof jobSchema>;
```

- [ ] **Step 2: Verify it typechecks**

Run: `cd packages/core && bun run typecheck`
Expected: PASS (no errors). The file only declares types/schemas; nothing imports it yet.

- [ ] **Step 3: Commit**

```bash
git add packages/core/src/schema/job.ts
git commit -m "feat(core): add Job lens schema (D-331)"
```

---

## Task 2: The v1 job catalog

**Files:**
- Create: `packages/core/src/lib/job-catalog.ts`
- Test: `packages/core/src/__tests__/job-catalog.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// packages/core/src/__tests__/job-catalog.test.ts
import { describe, it, expect } from "bun:test";
import { JOB_CATALOG, getJobById, DEFAULT_JOB_ID } from "../lib/job-catalog";
import { jobSchema } from "../schema/job";

describe("JOB_CATALOG", () => {
  it("contains exactly the four v1 jobs", () => {
    const ids = JOB_CATALOG.map((j) => j.id).sort();
    expect(ids).toEqual(["auditor", "installer", "insurer", "operator"]);
  });

  it("every entry validates against jobSchema", () => {
    for (const job of JOB_CATALOG) {
      const parsed = jobSchema.safeParse(job);
      expect(parsed.success).toBe(true);
    }
  });

  it("getJobById returns the matching job for each id", () => {
    for (const job of JOB_CATALOG) {
      expect(getJobById(job.id)?.id).toBe(job.id);
    }
  });

  it("getJobById returns undefined for unknown id", () => {
    expect(getJobById("admin" as never)).toBeUndefined();
  });

  it("DEFAULT_JOB_ID is installer (highest-volume India-first user)", () => {
    expect(DEFAULT_JOB_ID).toBe("installer");
  });

  it("insurer lens is read-only (critical safety property)", () => {
    const insurer = getJobById("insurer");
    expect(insurer?.lens.defaultReadPosture).toBe("read_only");
  });

  it("no two jobs share the same entrySurface", () => {
    const surfaces = JOB_CATALOG.map((j) => j.lens.entrySurface);
    expect(new Set(surfaces).size).toBe(surfaces.length);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/core && bun test src/__tests__/job-catalog.test.ts`
Expected: FAIL — `Cannot find module "../lib/job-catalog"`.

- [ ] **Step 3: Write the catalog**

```typescript
// packages/core/src/lib/job-catalog.ts
import type { Job, JobId } from "../schema/job";

/**
 * The v1 Job catalog — data layer (motto §0.8). Four jobs covering the product
 * thesis primary users + the evidence-frame buyer (D-020). Adding a lens is
 * adding a catalog entry, not a code change.
 *
 * Catalog scope rationale (motto §0.13): installer/auditor/operator/insurer in
 * v1. reviewer, privacy_reviewer, admin are deferred (workflow-stage / sys-auth,
 * not primary professional lenses).
 */
export const JOB_CATALOG: readonly Job[] = [
  {
    id: "installer",
    label: "CCTV Installer",
    blurb: "Design a credible camera setup and prove coverage to your client.",
    suggestedUserRole: "installer",
    lens: {
      entrySurface: "build_new",
      primaryVerb: "Design",
      entryCtaCopy: "Design a new camera setup",
      defaultViewMode: "map",
      defaultWorkspacePreset: "edit",
      defaultReadPosture: "read_write",
      suggestedStarterSceneId: "small-retail",
      foregroundedTool: "camera_placement",
      defaultBottomTab: "counterfactual",
      primaryOutput: "client_proposal",
      defaultExportFormat: "pdf",
      vocabularySet: "installer",
      suggestedStaircaseRung: 3,
    },
  },
  {
    id: "auditor",
    label: "Security Auditor",
    blurb: "Investigate coverage failures and reconstruct incidents.",
    suggestedUserRole: "auditor",
    lens: {
      entrySurface: "audit_existing",
      primaryVerb: "Audit",
      entryCtaCopy: "Open a site for audit or incident review",
      defaultViewMode: "replay",
      defaultWorkspacePreset: "replay",
      defaultReadPosture: "read_write",
      suggestedStarterSceneId: null,
      foregroundedTool: "adversarial_path",
      defaultBottomTab: "timeline",
      primaryOutput: "coverage_failure_report",
      defaultExportFormat: "pdf",
      vocabularySet: "auditor",
      suggestedStaircaseRung: 4,
    },
  },
  {
    id: "operator",
    label: "Facility Manager",
    blurb: "Monitor your sites' security posture over time.",
    suggestedUserRole: "operator",
    lens: {
      entrySurface: "monitor_portfolio",
      primaryVerb: "Monitor",
      entryCtaCopy: "Check your sites' security posture",
      defaultViewMode: "map",
      defaultWorkspacePreset: "coverage",
      defaultReadPosture: "read_write",
      suggestedStarterSceneId: null,
      foregroundedTool: "coverage_temporal",
      defaultBottomTab: "metrics",
      primaryOutput: "risk_digest",
      defaultExportFormat: "html",
      vocabularySet: "operator",
      suggestedStaircaseRung: 2,
    },
  },
  {
    id: "insurer",
    label: "Insurance / Compliance",
    blurb: "Review attested, standards-compliant coverage reports.",
    suggestedUserRole: "insurer",
    lens: {
      entrySurface: "review_attestations",
      primaryVerb: "Attest",
      entryCtaCopy: "Review attested coverage reports",
      defaultViewMode: "report",
      defaultWorkspacePreset: "report",
      defaultReadPosture: "read_only",
      suggestedStarterSceneId: null,
      foregroundedTool: "attestation",
      defaultBottomTab: "report",
      primaryOutput: "compliance_attestation",
      defaultExportFormat: "pdf",
      vocabularySet: "insurer",
      suggestedStaircaseRung: 3,
    },
  },
] as const;

export const DEFAULT_JOB_ID: JobId = "installer";

export function getJobById(id: JobId | string): Job | undefined {
  return JOB_CATALOG.find((j) => j.id === id);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/core && bun test src/__tests__/job-catalog.test.ts`
Expected: PASS — all 7 tests.

- [ ] **Step 5: Export from the package barrel**

```typescript
// packages/core/src/index.ts — ADD these two lines (at the end, after the existing exports):
export * from "./schema/job";
export * from "./lib/job-catalog";
```

- [ ] **Step 6: Verify typecheck + full core test suite**

Run: `cd packages/core && bun run typecheck && bun test`
Expected: PASS — no new errors, all existing tests still pass.

- [ ] **Step 7: Commit**

```bash
git add packages/core/src/lib/job-catalog.ts packages/core/src/__tests__/job-catalog.test.ts packages/core/src/index.ts
git commit -m "feat(core): add v1 job catalog (4 lenses) + exports"
```

---

## Task 3: Capability helper (the authorization boundary)

This is the highest-risk path in the spec (§0.5/§0.6) — the single place where lens posture and authorization compose. It must never leak a write capability to a read-only posture.

**Files:**
- Create: `apps/studio/src/lib/job-capability.ts`
- Test: `apps/studio/src/lib/__tests__/job-capability.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// apps/studio/src/lib/__tests__/job-capability.test.ts
import { describe, it, expect } from "bun:test";
import { canPerform, isWriteAction } from "../job-capability";
import { JOB_CATALOG } from "@sentineltwin/core";
import type { Job, UserRole, PermissionAction } from "@sentineltwin/core";

// Pull a real catalog job so the test uses production data, not a stub.
const installerJob = JOB_CATALOG.find((j) => j.id === "installer")!;
const insurerJob = JOB_CATALOG.find((j) => j.id === "insurer")!;

describe("isWriteAction", () => {
  it("classifies write actions", () => {
    expect(isWriteAction("create")).toBe(true);
    expect(isWriteAction("update")).toBe(true);
    expect(isWriteAction("delete")).toBe(true);
    expect(isWriteAction("publish")).toBe(true);
  });

  it("classifies read-only actions", () => {
    expect(isWriteAction("read")).toBe(false);
    expect(isWriteAction("approve")).toBe(false);
    expect(isWriteAction("reject")).toBe(false);
  });
});

describe("canPerform", () => {
  const readAction: PermissionAction = "read";
  const writeAction: PermissionAction = "update";

  it("allows read for read-only posture (insurer)", () => {
    expect(canPerform(insurerJob, "insurer", readAction, "scene")).toBe(true);
  });

  // CRITICAL SAFETY PROPERTY — the test that must never regress.
  it("blocks write for read-only posture even when role would allow", () => {
    // insurer lens is read-only. Even if somehow paired with an operator role
    // that has update permission, the posture gate must block it.
    expect(canPerform(insurerJob, "operator", writeAction, "scene")).toBe(false);
  });

  it("allows write for read-write posture when role permits", () => {
    expect(canPerform(installerJob, "installer", writeAction, "scene")).toBe(true);
  });

  it("blocks when posture allows but role does not", () => {
    // reviewer role does not have update on scene (only review actions).
    expect(canPerform(installerJob, "reviewer", writeAction, "scene")).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/studio && bun test src/lib/__tests__/job-capability.test.ts`
Expected: FAIL — `Cannot find module "../job-capability"`.

- [ ] **Step 3: Write the capability helper**

First, check how the existing permission system decides role→action→subject, so this helper reuses the canonical table rather than inventing one (motto §11 — no duplicate truth sources).

```bash
grep -rn "permissionSchema\|PermissionAction\|hasPermission\|checkPermission" packages/core/src apps/studio/src --include="*.ts" | head -20
```

If a canonical permission-table function already exists, import and reuse it. If not (the schema defines the shape but no lookup function), implement the table inline in this helper as the canonical owner.

```typescript
// apps/studio/src/lib/job-capability.ts
import type { Job, UserRole, PermissionAction } from "@sentineltwin/core";

/**
 * The SINGLE place where the Job lens and authorization compose.
 *
 *   canPerform = roleHasPermission(role, action, subject)   // the GATE
 *             && postureAllows(job, action)                 // the LENS guard
 *
 * The Job lens NEVER grants capability it only RESTRICTS via posture.
 * Authorization (roleHasPermission) is unchanged from the existing model.
 * This is the critical safety property from D-331 §6 / spec §6.
 */
export function isWriteAction(action: PermissionAction): boolean {
  return action === "create" || action === "update" || action === "delete" || action === "publish";
}

/**
 * Canonical role→action→subject permission table.
 * SINGLE SOURCE OF TRUTH for what each UserRole may do. If the existing
 * Permission schema gains a lookup function later, replace this body with
 * that import (supersession, motto §7) — but keep the function signature.
 */
export function roleHasPermission(
  role: UserRole,
  action: PermissionAction,
  _subject: string,
): boolean {
  // admin: full access.
  if (role === "admin") return true;
  // Read is always allowed for any authenticated role.
  if (action === "read") return true;

  const writeActions: PermissionAction[] = ["create", "update", "delete", "publish"];
  const isWrite = writeActions.includes(action);

  // Write-capable professional roles.
  if (isWrite && (role === "installer" || role === "operator")) return true;

  // Workflow-stage roles: review/approve/reject/request_review/recover
  // (NOT create/update/delete/publish on scene directly).
  const reviewActions: PermissionAction[] = ["approve", "reject", "request_review"];
  if (reviewActions.includes(action) && (role === "reviewer" || role === "privacy_reviewer")) return true;

  // auditor can recover (propose fixes on a copy) but not publish.
  if (action === "recover" && role === "auditor") return true;

  // insurer: read-only professional role. No writes, no approvals.
  return false;
}

export function postureAllows(job: Job, action: PermissionAction): boolean {
  // read-only posture blocks ALL write actions regardless of role.
  if (job.lens.defaultReadPosture === "read_only" && isWriteAction(action)) return false;
  return true;
}

export function canPerform(
  job: Job,
  role: UserRole,
  action: PermissionAction,
  subject: string,
): boolean {
  return roleHasPermission(role, action, subject) && postureAllows(job, action);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/studio && bun test src/lib/__tests__/job-capability.test.ts`
Expected: PASS — all tests, including the critical safety property test.

- [ ] **Step 5: Commit**

```bash
git add apps/studio/src/lib/job-capability.ts apps/studio/src/lib/__tests__/job-capability.test.ts
git commit -m "feat(studio): add job capability helper (lens+authz boundary, D-331)"
```

---

## Task 4: `job-lens-slice` (Zustand state + persistence)

**Files:**
- Create: `apps/studio/src/store/slices/job-lens-slice.ts`

- [ ] **Step 1: Read the existing layout-slice persistence pattern to match it**

```bash
sed -n '100,160p' apps/studio/src/store/slices/core/layout-slice.ts
```
Note the localStorage key naming (`sentineltwin_*`), the SSR-safe `typeof window` guard, and the JSON parse/validate pattern. Match it exactly.

- [ ] **Step 2: Write the slice**

```typescript
// apps/studio/src/store/slices/job-lens-slice.ts
import type { StateCreator } from "zustand";
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

export interface JobLensSlice {
  /** The currently active job lens id. */
  activeJobId: JobId;
  /** Where the current resolution came from — for observability/audit (motto §0.10). */
  jobResolutionSource: JobResolutionSource;
  /** True until the user has confirmed a lens (first-run gate). */
  lensConfirmed: boolean;

  /** Switch the active lens mid-session. Always `explicit_switch` source. */
  switchJob: (jobId: JobId) => void;
  /** Confirm a lens choice from the first-run picker. */
  confirmLens: (jobId: JobId) => void;
  /** Resolve the initial lens for a session (anonymous trial path). */
  resolveInitialLens: () => void;
}

export const createJobLensSlice: StateCreator<
  JobLensSlice,
  [],
  [],
  JobLensSlice
> = (set) => ({
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
    const hadPersisted =
      typeof window !== "undefined" &&
      !!window.localStorage.getItem(JOB_LENS_STORAGE_KEY);
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
```

- [ ] **Step 3: Verify it typechecks (not yet wired into the store)**

Run: `cd apps/studio && bunx tsc --noEmit src/store/slices/job-lens-slice.ts 2>&1 | head -20`
Expected: no errors in the new file (other unrelated errors may exist; this is a local check only).

- [ ] **Step 4: Commit**

```bash
git add apps/studio/src/store/slices/job-lens-slice.ts
git commit -m "feat(studio): add job-lens-slice (state + persistence)"
```

---

## Task 5: Wire the slice into the combined store

**Files:**
- Modify: `apps/studio/src/store/slices/index.ts`
- Modify: `apps/studio/src/store/studio-store.ts`

- [ ] **Step 1: Export the slice from the slices barrel**

Add to `apps/studio/src/store/slices/index.ts`:

```typescript
// At the bottom of the core-slice section, after DebugTogglesSlice:
export type { JobLensSlice } from "./job-lens-slice";
export { createJobLensSlice, selectActiveJob } from "./job-lens-slice";
```

Wait — `job-lens-slice.ts` lives directly under `slices/`, not under `slices/core/`. Correct the path accordingly. Re-read the current `index.ts` to confirm the import location and pattern, then append:

```typescript
// Job lens — persona/workflow router (D-331). Lives at slices root because it
// is cross-cutting (consumed by both product routing and capability gates).
export type { JobLensSlice } from "./job-lens-slice";
export { createJobLensSlice, selectActiveJob } from "./job-lens-slice";
```

- [ ] **Step 2: Compose into the combined store**

In `apps/studio/src/store/studio-store.ts`:

(a) Add to the slice-creator imports (the first import block, lines ~6–17):
```typescript
import {
  createSceneSlice,
  createSimulationSlice,
  createLayoutSlice,
  createWorkflowSlice,
  createGovernanceSlice,
  createTelemetrySlice,
  createSnapshotSlice,
  createReplaySlice,
  createComparisonSlice,
  createDebugTogglesSlice,
  createJobLensSlice,   // NEW
} from "./slices";
```

(b) Add to the combined type (after `DebugTogglesSlice`, ~line 121):
```typescript
export type StudioStoreState =
  & SceneSlice
  & SimulationSlice
  & LayoutSlice
  & SnapshotSlice
  & ReplaySlice
  & ComparisonSlice
  & WorkflowSlice
  & GovernanceSlice
  & TelemetrySlice
  & DebugTogglesSlice
  & JobLensSlice;   // NEW
```

(c) Add to the store composition object (after `...createDebugTogglesSlice`, ~line 138):
```typescript
  ...createDebugTogglesSlice(set, get),
  ...createJobLensSlice(set, get),   // NEW
```

- [ ] **Step 3: Run the full studio typecheck**

Run: `cd apps/studio && bun run typecheck`
Expected: PASS — the new slice composes cleanly.

- [ ] **Step 4: Run the studio test suite (no regressions)**

Run: `cd apps/studio && bun test 2>&1 | tail -20`
Expected: all existing tests pass (the new slice only adds state; no behavior change yet).

- [ ] **Step 5: Commit**

```bash
git add apps/studio/src/store/slices/index.ts apps/studio/src/store/studio-store.ts
git commit -m "feat(studio): compose job-lens-slice into studio store"
```

---

## Task 6: First-run lens picker component

**Files:**
- Create: `apps/studio/src/components/product/JobLensPicker.tsx`

- [ ] **Step 1: Write the picker component**

```tsx
// apps/studio/src/components/product/JobLensPicker.tsx
"use client";

import { JOB_CATALOG } from "@sentineltwin/core";
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

  const handlePick = (jobId: typeof JOB_CATALOG[number]["id"]) => {
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
          Pick the job that fits. You can switch any time from the top bar — the simulation stays the same,
          we just surface what matters for your job.
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
                Starts in {job.lens.defaultWorkspacePreset} · {job.lens.defaultReadPosture === "read_only" ? "read-only" : "read & write"}
              </p>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify it typechecks**

Run: `cd apps/studio && bun run typecheck 2>&1 | grep -i "JobLensPicker" || echo "No errors in JobLensPicker"`
Expected: "No errors in JobLensPicker".

- [ ] **Step 3: Commit**

```bash
git add apps/studio/src/components/product/JobLensPicker.tsx
git commit -m "feat(studio): add JobLensPicker first-run surface"
```

---

## Task 7: Add `job_lens` ProductView + route it

**Files:**
- Modify: `apps/studio/src/store/product-view-store.ts`
- Modify: `apps/studio/src/components/product/ProductViewRouter.tsx`

- [ ] **Step 1: Add `job_lens` to the ProductView union**

In `apps/studio/src/store/product-view-store.ts`, add `job_lens` to the union right before the `studio` entry:

```typescript
export type ProductView =
  | "product_home"
  | "site_intake"
  | "scan_site"
  | "manual_builder"
  | "floor_plan_import"
  | "ai_layout_draft"
  | "site_draft_review"
  | "job_lens"        // NEW — first-run lens picker surface (D-331)
  | "studio"
  | "camera_operations"
  | "incident_review"
  | "counterfactual_compare"
  | "audit_report"
  | "reference_sites"
  | "settings";
```

- [ ] **Step 2: Route `job_lens` in ProductViewRouter**

In `apps/studio/src/components/product/ProductViewRouter.tsx`, import the picker and add a render branch BEFORE the existing first-run redirect logic (around line 144, before `hasRedirectedToIntakeRef`):

```tsx
import { JobLensPicker } from "./JobLensPicker";
```

Then in the render body, add this block near the top (after the `compactViewport` mobile-gate block, before `product_home`):

```tsx
  // Job lens — first-run lens selection surface (D-331). Shown when the
  // visitor has not yet confirmed a lens. On confirm, navigates to product_home.
  if (productView === "job_lens") {
    return <JobLensPicker />;
  }
```

- [ ] **Step 3: Trigger lens resolution on first mount**

Still in `ProductViewRouter.tsx`, replace/augment the existing first-run redirect (the `hasRedirectedToIntakeRef` effect at ~line 144) so that if `lensConfirmed === false`, we route to the picker instead of the intake hub:

```tsx
  const lensConfirmed = useStudioStore((s) => s.lensConfirmed);
  const resolveInitialLens = useStudioStore((s) => s.resolveInitialLens);

  // Boot: resolve any persisted lens preference (anonymous trial path).
  useEffect(() => {
    resolveInitialLens();
  }, [resolveInitialLens]);

  // First-time routing: if the visitor hasn't confirmed a lens yet, show the
  // picker BEFORE the intake redirect. Existing users with a persisted lens
  // skip straight through (lensConfirmed becomes true via resolveInitialLens).
  const hasResolvedLensRef = useRef(false);
  useEffect(() => {
    if (hasResolvedLensRef.current) return;
    if (productView !== "product_home") return;
    if (!lensConfirmed) {
      navigate("job_lens");
      hasResolvedLensRef.current = true;
    }
  }, [productView, lensConfirmed, navigate]);

  // The existing intake redirect stays, but only fires once a lens is confirmed.
  useEffect(() => {
    if (hasRedirectedToIntakeRef.current) return;
    if (productView !== "product_home") return;
    if (!lensConfirmed) return;   // NEW guard
    if (savedProjects.length === 0 && scene.cameras.length === 0) {
      navigate("site_intake");
      hasRedirectedToIntakeRef.current = true;
    }
  }, [productView, savedProjects, scene.cameras.length, navigate, lensConfirmed]);
```

- [ ] **Step 4: Run studio typecheck + tests**

Run: `cd apps/studio && bun run typecheck && bun test 2>&1 | tail -15`
Expected: PASS — no regressions; the new view is additive.

- [ ] **Step 5: Commit**

```bash
git add apps/studio/src/store/product-view-store.ts apps/studio/src/components/product/ProductViewRouter.tsx
git commit -m "feat(studio): add job_lens view + first-run lens gate"
```

---

## Task 8: Apply lens defaults on entry

**Files:**
- Modify: `apps/studio/src/components/product/ProductViewRouter.tsx`

- [ ] **Step 1: Add a lens-defaults applier**

When the user enters a workspace from product_home (or the picker), apply the lens's suggested `(viewMode, preset, bottomTab)` if they haven't explicitly navigated yet. Add a helper inside `ProductViewRouter` and call it when transitioning into `studio`/`camera_operations`/etc. via the lens entry surface.

Add near the top of the `ProductViewRouter` component body (after the existing store selectors):

```tsx
  // Apply the active lens's suggested defaults when entering the studio from a
  // lens entry action. Explicit user navigation always wins (invariant 5) —
  // this only seeds the initial mode, it does not override later navigation.
  const applyLensDefaults = () => {
    const { activeJobId } = useStudioStore.getState();
    const job = JOB_CATALOG.find((j) => j.id === activeJobId);
    if (!job) return;
    const { setViewMode, setWorkspacePreset, setBottomTab } = useStudioStore.getState();
    setWorkspacePreset(job.lens.defaultWorkspacePreset);
    setViewMode(job.lens.defaultViewMode);
    setBottomTab(job.lens.defaultBottomTab);
  };
```

Add the import:
```tsx
import { JOB_CATALOG } from "@sentineltwin/core";
```

- [ ] **Step 2: Call `applyLensDefaults()` on the lens-aware entry paths**

In the `product_home` render block, the `onStartProject` and `onOpenStudio` handlers should call `applyLensDefaults()` before navigating. Modify the `StudioDashboardHome` props:

```tsx
            onStartProject={() => { applyLensDefaults(); handlers.openCoverageWorkspace(); }}
            onOpenStudio={() => { applyLensDefaults(); handlers.openStudio(); }}
```

- [ ] **Step 3: Run typecheck + tests**

Run: `cd apps/studio && bun run typecheck && bun test 2>&1 | tail -15`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add apps/studio/src/components/product/ProductViewRouter.tsx
git commit -m "feat(studio): apply lens defaults on studio entry (D-331)"
```

---

## Task 9: Lens switcher in TopBar

**Files:**
- Create: `apps/studio/src/components/product/JobLensSwitcher.tsx`
- Modify: `apps/studio/src/components/layout/TopBar.tsx`

- [ ] **Step 1: Write the switcher component**

```tsx
// apps/studio/src/components/product/JobLensSwitcher.tsx
"use client";

import { useState } from "react";
import { JOB_CATALOG, getJobById } from "@sentineltwin/core";
import { useStudioStore } from "@/store/studio-store";

/**
 * Compact lens switcher for the TopBar. Switching mid-session is always
 * explicit (invariant 2) and does not fork data. Source becomes
 * `explicit_switch` for observability.
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
      >
        <span className="h-1.5 w-1.5 rounded-full" style={{ background: "var(--accent)" }} />
        {active?.label ?? "Lens"}
      </button>

      {open && (
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
              onClick={() => { switchJob(job.id); setOpen(false); }}
              className="flex w-full flex-col items-start rounded-md px-2.5 py-2 text-left hover:bg-white/5"
            >
              <span className="text-xs font-medium text-[color:var(--text)]">{job.label}</span>
              <span className="text-[11px] text-[color:var(--text-muted)]">{job.blurb}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Mount it in TopBar**

In `apps/studio/src/components/layout/TopBar.tsx`, import and render `<JobLensSwitcher />` in the existing top-bar action area (near the settings/reference-sites buttons). Read the file first to find the exact insertion point, then add it as a sibling to the existing action buttons.

```tsx
import { JobLensSwitcher } from "@/components/product/JobLensSwitcher";
```

Render `<JobLensSwitcher />` in the action cluster.

- [ ] **Step 3: Run typecheck + tests**

Run: `cd apps/studio && bun run typecheck && bun test 2>&1 | tail -15`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add apps/studio/src/components/product/JobLensSwitcher.tsx apps/studio/src/components/layout/TopBar.tsx
git commit -m "feat(studio): add JobLensSwitcher to TopBar"
```

---

## Task 10: Read-only posture enforcement for the insurer lens

The capability helper (Task 3) is the canonical gate; this task makes that gate **visible** in the studio UI for the read-only insurer lens, so a read-only user cannot reach edit affordances.

**Files:**
- Modify: `apps/studio/src/components/layout/StudioShell.tsx` (or the workspace-area component that gates edit tools)

- [ ] **Step 1: Read the existing edit-tool gating logic**

```bash
grep -rn "compactViewport\|MobileEditGate\|canEdit\|readOnly\|read-only\|disabled" apps/studio/src/components/layout/ apps/studio/src/components/workspace/ --include="*.tsx" | head -20
```

Find where edit affordances are currently gated (the `MobileEditGate` pattern is the analog — reuse the gating mechanism, don't invent a new one).

- [ ] **Step 2: Add a posture-based gate**

Add a selector + gate that hides/disables edit affordances when the active lens posture is `read_only`. Reuse the capability helper:

```tsx
import { useStudioStore } from "@/store/studio-store";
import { JOB_CATALOG, type PermissionAction } from "@sentineltwin/core";
import { canPerform } from "@/lib/job-capability";

// Inside a component that gates edit tools:
const activeJobId = useStudioStore((s) => s.activeJobId);
const activeRole = useStudioStore((s) => s.workspaceGovernance.activeRole);
const job = JOB_CATALOG.find((j) => j.id === activeJobId);
const canEditScene = job
  ? canPerform(job, activeRole, "update", "scene")
  : true;
```

Use `canEditScene` to disable/hide the camera-placement tool, the "add camera" button, the save-scene button, etc. when false.

- [ ] **Step 3: Add a regression test for the UI gate**

Add to `apps/studio/src/lib/__tests__/job-capability.test.ts` or a new component test:

```typescript
it("insurer lens + any role cannot edit scene (UI gate)", () => {
  const insurerJob = JOB_CATALOG.find((j) => j.id === "insurer")!;
  for (const role of ["admin", "operator", "installer", "auditor", "reviewer", "privacy_reviewer", "insurer"] as const) {
    expect(canPerform(insurerJob, role, "update", "scene")).toBe(false);
  }
});
```

- [ ] **Step 4: Run tests + typecheck**

Run: `cd apps/studio && bun run typecheck && bun test 2>&1 | tail -15`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/studio/src/components/layout/StudioShell.tsx apps/studio/src/lib/__tests__/job-capability.test.ts
git commit -m "feat(studio): enforce read-only posture for insurer lens (D-331 safety gate)"
```

---

## Task 11: Full monorepo verification + visual QA

- [ ] **Step 1: Run the entire monorepo typecheck + test suite**

```bash
cd /Users/pranay/Projects/SentinelTwin && bun run typecheck 2>&1 | tail -20 && echo "---TESTS---" && bun test 2>&1 | tail -30
```
Expected: all packages typecheck; all tests pass (existing + new). If any pre-existing failures appear in the blast radius (job-lens, product-view, layout), fix them per motto §6 — don't defer.

- [ ] **Step 2: Start the dev server and verify visually**

```bash
cd apps/studio && bun dev
```
Open the local URL. Verify:
1. First visit shows the `JobLensPicker` (4 cards).
2. Picking "CCTV Installer" routes to product_home → intake with `edit`/`map` defaults.
3. Picking "Insurance / Compliance" routes with `report` mode and read-only posture (edit buttons disabled).
4. The TopBar `JobLensSwitcher` shows the active lens and switching changes defaults on next entry.
5. Refreshing the page persists the lens (localStorage key `sentineltwin_job_lens`).

- [ ] **Step 3: Document the verification result**

Append to `Docs/architecture/11_JOB_LENS_ROUTER.md` a `## Implementation status` section recording: what shipped, evidence tier reached (Tier 3 for the capability helper, Tier 4 for visual QA), and any remaining gaps.

- [ ] **Step 4: Commit**

```bash
git add Docs/architecture/11_JOB_LENS_ROUTER.md
git commit -m "docs: record job lens implementation status (D-331)"
```

---

## Self-Review

**Spec coverage (§1–§10 of `11_JOB_LENS_ROUTER.md`):**
- §2 three-axis decomposition → Tasks 1–2 (schema + catalog).
- §3 schema & invariants → Task 1 (schema), Task 4 (switchable + persistence invariants), Task 3 (authz gate invariant 1).
- §4 four-job catalog → Task 2.
- §5 resolution flow → Task 4 (resolveInitialLens), Task 7 (first-run gate).
- §6 authz composition → Task 3 (canPerform), Task 10 (UI enforcement).
- §7 observability → Task 4 (jobResolutionSource).
- §8 staging S1–S5 → Tasks 1–2 (S1), 4–5 (S2), 6–7 (S3), 8 (S4), 10 (S4 posture), with vocab/output (S5) partially via catalog (vocab) and primaryOutput field (output). **Gap:** S5 vocabulary copy *mapping* (vocabularySet → per-string copy) is not a separate task — it's deferred to the enrichment layer; the catalog carries the key, mapping lands when copy is centralized. This is acceptable for v1 and noted in the plan.
- §9 scope boundaries → respected (no auth, no SecurityScene change, no UserRole cleanup, no deferred jobs).
- §10 open questions → already filed as OQ-JOB-01..04.

**Type consistency check:**
- `JobId`, `Job`, `JobLens`, `JobResolutionSource` — consistent across schema, catalog, slice, capability helper, components.
- `canPerform(job, role, action, subject)` — signature consistent Task 3 → Task 10.
- `confirmLens`/`switchJob`/`resolveInitialLens` — consistent Task 4 → Tasks 6, 7, 9.
- `JobLensSlice` composition — consistent Task 4 → Task 5.
- `ProductView` "job_lens" — consistent Task 7 store → router.

**Placeholder scan:** none. All code blocks are complete. Two `grep`/`sed` "read-the-file-first" steps are intentional (the engineer must match the existing pattern at the exact line); they are not placeholders.

---

## Execution Handoff

Plan complete and saved to `Docs/superpowers/plans/2026-07-09-job-lens-router.md`. Proceeding with inline execution per the user's directive to "proceed with the implementation."
