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
  "anonymous_trial", // anonymous visitor self-selected a lens
  "user_default", // logged-in user's stored preference
  "explicit_switch", // user clicked the switcher mid-session
]);
export type JobResolutionSource = z.infer<typeof jobResolutionSourceSchema>;

export const jobLensSchema = z.object({
  // AXIS: entry — first surface + primary verb + CTA copy
  entrySurface: z.enum(["build_new", "audit_existing", "monitor_portfolio", "review_attestations"]),
  primaryVerb: z.string(),
  entryCtaCopy: z.string(),

  // AXIS: defaults — starting state + posture
  defaultViewMode: z.enum(["map", "camera_view", "wall", "replay", "compare", "report"]),
  defaultWorkspacePreset: z.enum([
    "edit",
    "coverage",
    "camera_wall",
    "replay",
    "compare",
    "report",
    "focus",
  ]),
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
  primaryOutput: z.enum([
    "client_proposal",
    "coverage_failure_report",
    "risk_digest",
    "compliance_attestation",
  ]),
  defaultExportFormat: z.enum(["pdf", "json", "html"]),

  // ENRICHMENT (cheap, ride on top of the four load-bearing axes)
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
