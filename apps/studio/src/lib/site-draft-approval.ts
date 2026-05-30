import { safeParseSecurityScene } from "@/schema/security-scene";
import type { ActionableWarning, SiteTwinDraft } from "@/lib/site-compiler";
import { makeSiteCompilerWarnings } from "@/lib/site-compiler";

export type SiteDraftApprovalResult =
  | {
      success: true;
      scene: import("@/schema/security-scene").SecurityScene;
      baselineReady: boolean;
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
  const baselineReady = approvedScene.cameras.length > 0
    && approvedScene.criticalZones.length > 0
    && !warnings.some((warning) => warning.severity === "blocking");
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
    warnings,
    provenanceLog,
  };
}
