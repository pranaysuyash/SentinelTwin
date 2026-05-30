import { WorkspaceGovernanceState } from "./workspace-governance";
import { SceneRecord, Workspace, AuditLog, UserRole } from "@sentineltwin/core";

export function mapLocalGovernanceToSceneRecord(
  governance: WorkspaceGovernanceState,
  existingRecord?: SceneRecord
): Partial<SceneRecord> {
  const statusMapping: Record<string, SceneRecord["status"]> = {
    draft: "draft",
    review_requested: "review_requested",
    approved: "approved",
    rejected: "rejected",
    published: "published",
    recovered: "draft",
  };

  return {
    status: statusMapping[governance.sceneStatus] || "draft",
    publishedAt: governance.publishedAt,
    updatedAt: Date.now(),
  };
}

export function generateAuditLogForGovernanceTransition(
  workspaceId: string,
  actorId: string,
  targetSceneId: string,
  oldState: WorkspaceGovernanceState,
  newState: WorkspaceGovernanceState
): AuditLog | null {
  if (oldState.sceneStatus === newState.sceneStatus) return null;

  const actionMap: Record<string, string> = {
    "review_requested": "REQUEST_REVIEW",
    "approved": "APPROVE_SCENE",
    "rejected": "REJECT_SCENE",
    "published": "PUBLISH_SCENE",
    "draft": "REVERT_TO_DRAFT",
    "recovered": "RECOVER_SCENE",
  };

  return {
    id: crypto.randomUUID(),
    workspaceId,
    actorId,
    action: actionMap[newState.sceneStatus] || "UNKNOWN_TRANSITION",
    targetType: "scene",
    targetId: targetSceneId,
    details: `Scene transitioned from ${oldState.sceneStatus} to ${newState.sceneStatus} by ${newState.activeRole}`,
    metadata: { reviewNotes: newState.reviewNotes },
    timestamp: Date.now(),
  };
}

export function mapBackendRolesToLocalRole(role: UserRole): string {
  return role;
}
