import type { SecurityScene } from "@/schema/security-scene";
import {
  assessOperationalEvidenceMergeReadiness,
  mergeOperationalEvidenceBranchScenes,
  type OperationalEvidenceSceneMergeResult,
  type OperationalEvidenceMergeConflict,
  type OperationalEvidenceBranchComparison,
} from "@/lib/operational-evidence";

export type WorkspaceSyncConflictStatus = "same" | "fast_forward_local" | "fast_forward_remote" | "diverged" | "unrelated";

export interface WorkspaceSyncConflict {
  status: WorkspaceSyncConflictStatus;
  recommendation: string;
  conflicts: OperationalEvidenceMergeConflict[];
  mergedScene: SecurityScene | null;
  mergedCollections: OperationalEvidenceSceneMergeResult["mergedCollections"] | null;
}

export function resolveSyncConflict(
  comparison: OperationalEvidenceBranchComparison | null
): WorkspaceSyncConflict {
  if (!comparison) {
    return {
      status: "unrelated",
      recommendation: "Missing comparison data to resolve sync conflict.",
      conflicts: [],
      mergedScene: null,
      mergedCollections: null,
    };
  }

  const readiness = assessOperationalEvidenceMergeReadiness(comparison);
  if (!readiness) {
    return {
      status: "unrelated",
      recommendation: "Cannot determine merge readiness.",
      conflicts: [],
      mergedScene: null,
      mergedCollections: null,
    };
  }

  // Map to local terminology
  let syncStatus: WorkspaceSyncConflictStatus = "diverged";
  if (readiness.status === "same") syncStatus = "same";
  if (readiness.status === "fast_forward_left") syncStatus = "fast_forward_remote";
  if (readiness.status === "fast_forward_right") syncStatus = "fast_forward_local";
  if (readiness.status === "unrelated") syncStatus = "unrelated";

  if (syncStatus === "same" || syncStatus === "unrelated") {
    return {
      status: syncStatus,
      recommendation: readiness.recommendation,
      conflicts: [],
      mergedScene: null,
      mergedCollections: null,
    };
  }

  if (syncStatus === "fast_forward_local") {
    return {
      status: syncStatus,
      recommendation: "Local branch is ahead. Push changes to remote.",
      conflicts: [],
      mergedScene: comparison.leftScene,
      mergedCollections: null,
    };
  }

  if (syncStatus === "fast_forward_remote") {
    return {
      status: syncStatus,
      recommendation: "Remote branch is ahead. Pull changes from remote.",
      conflicts: [],
      mergedScene: comparison.rightScene,
      mergedCollections: null,
    };
  }

  // Diverged: attempt merge
  const mergeResult = mergeOperationalEvidenceBranchScenes(comparison);
  
  if (!mergeResult) {
    return {
      status: "diverged",
      recommendation: "Failed to automatically merge diverged branches.",
      conflicts: [],
      mergedScene: null,
      mergedCollections: null,
    };
  }

  return {
    status: "diverged",
    recommendation: mergeResult.conflicts.length === 0 
      ? "Auto-merged diverged branches successfully." 
      : "Manual conflict resolution required for some elements.",
    conflicts: mergeResult.conflicts,
    mergedScene: mergeResult.mergedScene,
    mergedCollections: mergeResult.mergedCollections,
  };
}
