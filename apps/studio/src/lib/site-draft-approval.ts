import { safeParseSecurityScene } from "@/schema/security-scene";
import { deriveSiteTwinDraftReadiness, type ActionableWarning, type SiteIntakeSession, type SiteTwinDraft } from "@/lib/site-compiler";
import { makeSiteCompilerWarnings } from "@/lib/site-compiler";

export type SiteDraftApprovalResult =
  | {
      success: true;
      scene: import("@/schema/security-scene").SecurityScene;
      baselineReady: boolean;
      canRecommend: boolean;
      readinessLevel: SiteTwinDraft["readiness"]["level"];
      readinessSummary: string;
      warnings: ActionableWarning[];
      provenanceLog: string[];
    }
  | {
      success: false;
      error: string;
    };

export function approveSiteTwinDraft(draft: SiteTwinDraft): SiteDraftApprovalResult {
  const parsed = safeParseSecurityScene(draft.scene);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "scene validation failed",
    };
  }

  const approvedScene = parsed.data;
  const warnings = makeSiteCompilerWarnings(approvedScene);
  const readiness = draft.readiness ?? deriveSiteTwinDraftReadiness(approvedScene, warnings, {
    source: draft.source,
    confidence: draft.confidence,
  });
  const baselineReady = readiness.canSimulate;
  const canRecommend = readiness.canRecommend;
  const provenanceLog = [
    `Site intake approval: source=${draft.source} draft=${draft.id} confidence=${Math.round(draft.confidence * 100)}%`,
    `Site intake entities: walls=${draft.entityCounts.walls} cameras=${draft.entityCounts.cameras} zones=${draft.entityCounts.criticalZones} paths=${draft.entityCounts.paths}`,
    ...(draft.provenance.sourceArtifacts.length > 0
      ? [`Site intake artifacts: ${draft.provenance.sourceArtifacts.join(", ")}`]
      : []),
    ...draft.provenance.notes.map((note) => `Site intake note: ${note}`),
    ...draft.assumptions.map((assumption) => `Site intake assumption: ${assumption.label}=${assumption.value} [${assumption.source}]`),
    ...draft.warnings.map((warning) => `Site intake warning: ${warning.code} (${warning.severity}) ${warning.message}`),
  ];

  return {
    success: true,
      scene: approvedScene,
      baselineReady,
      canRecommend,
      readinessLevel: readiness.level,
      readinessSummary: readiness.summary,
      warnings,
      provenanceLog,
    };
}

export type PromoteToActiveSceneResult = {
  result: SiteDraftApprovalResult;
  updatedSession: SiteIntakeSession;
};

/**
 * Promote a SiteIntakeSession's draft to an active scene.
 *
 * Runs the full approval gate (schema validation + warning check) and,
 * on success, sets the session stage to "activated".
 * Returns both the approval result and the updated session so callers
 * can persist the stage change (e.g. via store) before dismissing the session.
 *
 * Only sessions at "review" or "handoff" stage can be promoted.
 */
export function promoteToActiveScene(
  session: SiteIntakeSession,
): PromoteToActiveSceneResult {
  if (!session.draft) {
    return {
      result: { success: false, error: "Cannot promote: session has no compiled draft." },
      updatedSession: session,
    };
  }
  if (session.stage !== "handoff" && session.stage !== "review") {
    return {
      result: { success: false, error: `Cannot promote from stage "${session.stage}". Must be at "review" or "handoff" to approve a draft.` },
      updatedSession: session,
    };
  }
  const result = approveSiteTwinDraft(session.draft);
  const updatedSession = result.success
    ? { ...session, stage: "activated" as const, provenanceNotes: [...session.provenanceNotes, "Activated: draft promoted to active scene."] }
    : session;
  return { result, updatedSession };
}
