# Architecture 11: Job Lens — Persona/Workflow Router

**Status:** Design spec — 2026-07-09
**Origin:** End-user workflow platform directive (app shipped live at `https://sentinel-twin-studio.vercel.app`); make the surface shape itself around the visitor's job-to-be-done without forking the simulation.
**Decision record:** D-331 (`Docs/decisions/DECISION_LOG_ADDENDUM.md`)
**Exploration:** Thread 155 (`Docs/exploration/EXPLORATION_MAP.md`)
**motto_v3 alignment:** §0 (bold long-term), §0.8 (data layer is product), §0.13 (scope control), §11 (no premature abstraction / canonical ownership), §12 (reduce cognitive load, single source of truth), §21 (decision-driven refactor).

---

## 1. Problem

The app is live but **single-funnel**: every visitor gets the same entry, default scene, foregrounded tool, and output shape — regardless of who they are or what job they came to do. The product thesis names distinct users (CCTV installers, security agencies, facility managers, insurers, compliance officers) with different value staircases and different primary deliverables. The objective is to make the surface **shape itself around the job-to-be-done**, without forking the simulation or creating parallel truth sources.

---

## 2. First-Principles Decomposition — Three Orthogonal Axes

SentinelTwin is **one simulation with one loop** (`edit scene → recompute coverage → show impact → explain → recommend`). What differs between users is not *identity* — it is *which facet of the same simulation they are working on right now*.

Decompose into three orthogonal axes, each with exactly one owner:

| Axis | Owner (existing where noted) | Question it answers | Concept |
|---|---|---|---|
| **Identity** | `Account` / `User` / `Organization` (exists in `@sentineltwin/core`) | Who are you? | account + org membership |
| **Authorization** | `UserRole` / `Permission` / entitlements (exists) | What are you allowed to do? | gates capability within a workspace |
| **Lens** | **NEW: `Job`** (data-driven config) | What job are you doing right now? | shapes entry / default scene / foregrounded tool / primary output / vocabulary |

A `Job` is a **data-driven lens configuration** (motto §0.8 — data layer is product), NOT an identity or authorization layer. It owns foregrounding only. Authorization remains the gate. Identity remains singular.

### Why `Job`-as-lens over alternatives (full rejection rationale in D-331)

- **Over "Persona = identity layer":** avoids duplicating the "who am I" question and creating a second identity concept alongside `Account`/`User` (premature abstraction, §11).
- **Over "Persona = derived from `UserRole`":** avoids conflating job-identity with workspace-authorization (an installer operating as reviewer in a workspace would get a confusing experience).
- **Over "Persona = unanchored preset":** a first-class `Job` with composition semantics is more correct and more observable than a free-floating UI preference.

### Existing `UserRole` is a mixed-grain enum (flagged, not silently fixed)

The existing `UserRole` = `admin | operator | reviewer | installer | auditor | privacy_reviewer | insurer` conflates three axes:
- **System-administration authority:** `admin`
- **Professional identity:** `installer`, `auditor`, `insurer`
- **Workflow-stage responsibility:** `reviewer`, `privacy_reviewer`
- (`operator` is vague — could be either professional identity or workflow-stage.)

Per motto §21, this is *evidence of an earlier decision, not a boundary*. Cleaning up the grain (e.g. splitting into `SystemRole` / `Profession` / `WorkflowStage`) is a **flagged, staged follow-up (OQ-JOB-04)**, not silently bundled into this spec. The `Job` lens is designed to compose with the current `UserRole` today and with a cleaned-up model later.

---

## 3. The `Job` Primitive — Schema & Invariants

Lives in `@sentineltwin/core` (the package that already owns org/account/permission schema).

```typescript
// packages/core/src/schema/job.ts (NEW)
// Imports: z from "zod"; UserRole from "./workspace-backend" (sibling schema).

export const jobIdSchema = z.enum(["installer", "auditor", "operator", "insurer"]);
export type JobId = z.infer<typeof jobIdSchema>;

export const jobLensSchema = z.object({
  // AXIS: entry — first surface + primary verb + CTA copy
  entrySurface: z.enum(["build_new", "audit_existing", "monitor_portfolio", "review_attestations"]),
  primaryVerb: z.string(),                    // "Design" | "Audit" | "Monitor" | "Attest"
  entryCtaCopy: z.string(),                   // job-specific CTA

  // AXIS: defaults — starting state + posture
  defaultViewMode: z.enum(["map", "camera_view", "wall", "replay", "compare", "report"]),
  defaultWorkspacePreset: z.enum(["edit", "coverage", "camera_wall", "replay", "compare", "report", "focus"]),
  defaultReadPosture: z.enum(["read_write", "read_only"]),
  suggestedStarterSceneId: z.string().nullable(),           // template id; null = open existing/fresh

  // AXIS: foreground — what panel/tool is front-and-center
  foregroundedTool: z.string(),               // "camera_placement" | "adversarial_path" | "coverage_temporal" | "attestation"
  // defaultBottomTab is typed z.string() here because the canonical BottomTab union
  // lives in apps/studio/src/store/slices/core/layout-slice.ts (a studio-internal type,
  // not a @sentineltwin/core type). The catalog values are validated at the binding
  // site in the studio app, not in the core schema — keeps core decoupled from studio.
  defaultBottomTab: z.string(),

  // AXIS: output — what "done" produces
  primaryOutput: z.enum(["client_proposal", "coverage_failure_report", "risk_digest", "compliance_attestation"]),
  defaultExportFormat: z.enum(["pdf", "json", "html"]),

  // ENRICHMENT (cheap, ride on top of the four load-bearing axes)
  vocabularySet: z.string(),                  // catalog key → mapped copy
  suggestedStaircaseRung: z.number().int().min(1).max(5),
});

export const jobSchema = z.object({
  id: jobIdSchema,
  label: z.string(),                          // "CCTV Installer"
  blurb: z.string(),                          // one-line value pitch
  lens: jobLensSchema,
  // suggestedUserRole is a HINT for onboarding only. It does NOT grant capability.
  // Authorization is always checked separately via Permission/entitlements.
  suggestedUserRole: UserRole,
});
export type Job = z.infer<typeof jobSchema>;
```

### Invariants (enforced by the router, not the type alone)

1. **Job never grants or denies capability.** `suggestedUserRole` is a *hint* for onboarding ("this lens fits installers"). Authorization is always checked separately via the existing `Permission`/entitlement system. An insurer can adopt the installer lens but still cannot write without the entitlement.
2. **Job is switchable mid-session, freely.** No data fork on switch — same `SecurityScene`, different foregrounded facet. This is the core of "one simulation, your lens."
3. **Job resolution is deterministic and observable.** The router logs `(accountId | anonymousId, jobId, source)` where `source ∈ {anonymous_trial, user_default, explicit_switch}`. Audit-traceable (motto §0.10).
4. **One sticky default per user (when logged in), one per-browser trial key (when anonymous).** Persisted in the existing localStorage layer alongside the other studio prefs — no new storage backend in v1.
5. **Job does not own viewMode/preset exclusively.** It *suggests* defaults; explicit user navigation always wins (an installer who clicked "Camera Wall" stays in wall mode — the Job does not fight them).

### Code anchors

- **New:** `packages/core/src/schema/job.ts`, `packages/core/src/lib/job-catalog.ts` (typed catalog).
- **New:** `apps/studio/src/store/slices/job-lens-slice.ts` (Zustand slice holding `{ activeJobId, source, switchJob, resolveJobForUser }`).
- **New:** `apps/studio/src/components/product/JobLensRouter.tsx` (sits above `ProductViewRouter`, resolves lens → feeds defaults).
- **Reads existing:** `product-view-store.ts`, `layout-slice.ts` (ViewMode/WorkspacePreset/BottomTab), `studio-store.ts` (`activeRole` for authz gate).
- **No changes to:** `SecurityScene`, simulation engine, coverage engine, report engine.

---

## 4. The v1 Job Catalog

Derived from the product thesis primary users + India-first GTM + D-020 evidence frame. Four jobs, each a concrete configuration of the schema. Ships as a typed catalog first; graduates to DB-stored when multi-tenant persistence lands.

### Job 1 — `installer` *(CCTV Installer)*

| Lens field | Value |
|---|---|
| entrySurface | `build_new` |
| primaryVerb | "Design" |
| entryCtaCopy | "Design a new camera setup" |
| defaultViewMode | `map` |
| defaultWorkspacePreset | `edit` |
| defaultReadPosture | `read_write` |
| suggestedStarterSceneId | small-retail template |
| foregroundedTool | `camera_placement` + counterfactual tools |
| defaultBottomTab | `counterfactual` |
| primaryOutput | `client_proposal` (verified before/after + placement rationale) |
| defaultExportFormat | `pdf` |
| vocabularySet | installer — "propose camera → verify coverage → prove to client" |
| suggestedStaircaseRung | 2-3 (understanding + audit) |
| suggestedUserRole | `installer` |

**Why:** Highest-volume, highest-ROI India-first user. Time = revenue. Job-to-be-done: *design a credible setup and prove it to the client.* The before/after is their sales primitive.

### Job 2 — `auditor` *(Security Agency / Incident Investigator)*

| Lens field | Value |
|---|---|
| entrySurface | `audit_existing` |
| primaryVerb | "Audit" |
| entryCtaCopy | "Open a site for audit / incident review" |
| defaultViewMode | `replay` |
| defaultWorkspacePreset | `replay` |
| defaultReadPosture | `read_write` (proposes fixes via counterfactuals, on a copy/draft) |
| suggestedStarterSceneId | null (must open existing) |
| foregroundedTool | `adversarial_path` + coverage-failure analysis |
| defaultBottomTab | `timeline` |
| primaryOutput | `coverage_failure_report` (incident reconstruction + failure attribution) |
| defaultExportFormat | `pdf` |
| vocabularySet | auditor — "authorized incident replay → coverage failure analysis → hardening recommendations" |
| suggestedStaircaseRung | 4 (adversarial) |
| suggestedUserRole | `auditor` |

**Why:** Agencies investigating incidents are the strongest evidence-frame story (D-020). Job: *understand why the footage was useless and what would've prevented it.* Adversarial path + failure attribution front-and-center. Defensive framing mandatory (AGENTS.md canonical rules).

### Job 3 — `operator` *(Facility Manager / Site Owner)*

| Lens field | Value |
|---|---|
| entrySurface | `monitor_portfolio` |
| primaryVerb | "Monitor" |
| entryCtaCopy | "Check your sites' security posture" |
| defaultViewMode | `map` |
| defaultWorkspacePreset | `coverage` |
| defaultReadPosture | `read_write` |
| suggestedStarterSceneId | most-recently-touched site |
| foregroundedTool | `coverage_temporal` (live coverage + 24h temporal profile) |
| defaultBottomTab | `metrics` |
| primaryOutput | `risk_digest` (periodic risk status + peak-vulnerability window) |
| defaultExportFormat | `html` |
| vocabularySet | operator — "risk posture → peak vulnerability → recommended actions" |
| suggestedStaircaseRung | 1-3 (verification → understanding → audit) |
| suggestedUserRole | `operator` |

**Why:** Facility managers want *continuous risk awareness, not one-shot audits*. Entry is portfolio-level; output is a recurring digest. Temporal profile is their killer feature (thesis: *"peak-vulnerability timeline"*).

### Job 4 — `insurer` *(Insurance Risk Auditor / Compliance Officer)*

| Lens field | Value |
|---|---|
| entrySurface | `review_attestations` |
| primaryVerb | "Attest" |
| entryCtaCopy | "Review attested coverage reports" |
| defaultViewMode | `report` |
| defaultWorkspacePreset | `report` |
| defaultReadPosture | `read_only` |
| suggestedStarterSceneId | null (must open a published/attested snapshot) |
| foregroundedTool | `attestation` (standards-compliant report viewer) |
| defaultBottomTab | `report` |
| primaryOutput | `compliance_attestation` (IEC 62676-4:2025 / DORI, timestamped, methodology statement) |
| defaultExportFormat | `pdf` |
| vocabularySet | insurer — "attested coverage → standards compliance → evidence package" |
| suggestedStaircaseRung | 3 (audit & compliance) |
| suggestedUserRole | `insurer` |

**Why:** The evidence-frame buyer (D-020, Thread 24). *Mandatory purchase driver*, not discretionary. Job: *verify a client's coverage meets the required standard.* Read-only posture is critical — they consume evidence, they don't edit scenes. Leans on the report layer's day-one attestation design.

### Catalog scope rationale (motto §0.13)

- **In v1:** installer, auditor, operator, insurer. Four lenses cover the thesis primary users + the evidence-frame buyer.
- **Deferred to v2+:** `reviewer` (workflow-stage; comes when review-loop UX is real), `privacy_reviewer` (comes with GDPR/privacy-zone maturity), `admin` (sys-auth, not a professional lens — handled via existing admin entitlements).
- **Extensibility:** catalog is data; adding a lens is adding a catalog entry, not a code change.

---

## 5. Resolution Flow (how a visitor lands on a job)

> Detailed in §6–7 of this doc. Summary: anonymous trial self-selects a lens → persisted to browser trial key; logged-in user resolves default job from `Account` preference → persisted to user. Lens feeds defaults into the existing `ProductViewRouter` + `layout-slice`; explicit navigation always wins over lens suggestions.

---

## 6. Authorization composition (the critical safety property)

Job and authorization compose through a single check at capability boundaries:

```
canPerform(action, subject) =
  Permission.check(userRole, action, subject)   // existing — the GATE
  && (job.lens.defaultReadPosture === "read_write" OR action is read-only)
```

- An insurer (read-only posture) adopting the installer lens cannot write, because the posture check fails write actions even though the installer lens suggests `read_write`.
- The check is centralized in one capability helper (single source of truth, §11) and reused at every capability boundary (placement, edit scene, publish, export).
- No per-Job permission table. Authorization shape is unchanged.

---

## 7. Observability (motto §0.10)

Every job resolution and switch emits a structured event:
`{ actorId, jobId, source, previousJobId?, timestamp }` — recorded in the existing `AuditLog` (for logged-in users) or an in-memory session trail (for anonymous trial). This makes lens adoption measurable: which jobs are tried, switched away from, settled on.

---

## 8. Staging (motto §0.13 — comprehensive thinking, controlled execution)

| Stage | Scope | Deliverable |
|---|---|---|
| **S1 — Schema + catalog (data layer)** | `job.ts` schema, `job-catalog.ts` with 4 entries, Zod tests, export from `@sentineltwin/core` | Typed, tested data layer; zero UI impact |
| **S2 — Lens slice + resolution** | `job-lens-slice.ts`, localStorage persistence (trial + default), job-resolution helpers | State layer ready; no surface change yet |
| **S3 — Router + entry surface** | `JobLensRouter.tsx` above `ProductViewRouter`, lens-aware first-run, lens switcher in TopBar | First visible behavior change: user picks a lens, surface responds |
| **S4 — Defaults application** | Wire lens defaults into `layout-slice`/`studio-store` on job entry; authz posture gate | Lens actually shapes defaults; read-only posture enforced |
| **S5 — Vocabulary + output shaping** | Vocabulary copy maps per job; primary-output deliverable surfaced per lens | Full lens experience; v1 complete |

S1–S2 are pure additions with no behavior change. S3 is the first user-visible change. Each stage is independently shippable and verifiable.

---

## 9. What this spec does NOT do (scope boundaries)

- Does not add real authentication. Anonymous trial + logged-in-user resolution both work against the existing local persistence layer. Real auth is a separate subsystem (identity & accounts) tracked elsewhere.
- Does not change `SecurityScene`, simulation, coverage, or report engines.
- Does not clean up the `UserRole` mixed-grain enum (OQ-JOB-04, staged follow-up).
- Does not build the deferred jobs (reviewer, privacy_reviewer, admin).
- Does not introduce a new storage backend.

---

## 10. Open questions

See `Docs/decisions/OPEN_QUESTIONS_ADDENDUM.md`: OQ-JOB-01 through OQ-JOB-04.

---

## 11. Decision trace

- D-020 (Evidence Twin framing) — insurer/compliance lens leans on evidence as deliverable.
- D-330 (Compliance reporting suite) — insurer lens `compliance_attestation` output consumes this.
- Product thesis "Target Users" + value staircase — defines the v1 catalog.
- Thread 155 (Exploration map) — full research trace for this spec.
