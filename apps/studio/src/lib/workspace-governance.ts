export type WorkspaceRole =
  | "operator"
  | "reviewer"
  | "auditor"
  | "installer"
  | "insurer"
  | "privacy_reviewer"
  | "admin";

export type WorkspaceApprovalMode = "open" | "review_required";

export type WorkspaceSceneStatus =
  | "draft"
  | "review_requested"
  | "approved"
  | "rejected"
  | "published"
  | "recovered";

export const WORKSPACE_ROLES: WorkspaceRole[] = [
  "operator",
  "reviewer",
  "auditor",
  "installer",
  "insurer",
  "privacy_reviewer",
  "admin",
];

export type WorkspaceGovernanceState = {
  activeRole: WorkspaceRole;
  approvalMode: WorkspaceApprovalMode;
  sceneStatus: WorkspaceSceneStatus;
  requestedAt: number | null;
  requestedBy: WorkspaceRole | null;
  reviewedAt: number | null;
  reviewedBy: WorkspaceRole | null;
  publishedAt: number | null;
  publishedBy: WorkspaceRole | null;
  reviewNotes: string[];
};

export type WorkspaceGovernanceAction =
  | "request_review"
  | "approve"
  | "reject"
  | "publish"
  | "recover"
  | "edit";

export type WorkspaceGovernanceSummary = {
  roleLabel: string;
  approvalModeLabel: string;
  sceneStatusLabel: string;
  canPublish: boolean;
  needsApproval: boolean;
  reviewAgeLabel: string | null;
  reviewerLabel: string | null;
};

function capitalizeLabel(value: string) {
  return value
    .replace(/_/g, " ")
    .split(" ")
    .map((part) => part.slice(0, 1).toUpperCase() + part.slice(1))
    .join(" ");
}

export function createDefaultWorkspaceGovernance(): WorkspaceGovernanceState {
  return {
    activeRole: "operator",
    approvalMode: "review_required",
    sceneStatus: "draft",
    requestedAt: null,
    requestedBy: null,
    reviewedAt: null,
    reviewedBy: null,
    publishedAt: null,
    publishedBy: null,
    reviewNotes: [],
  };
}

export function normalizeWorkspaceRole(value: unknown): WorkspaceRole {
  return WORKSPACE_ROLES.includes(value as WorkspaceRole) ? (value as WorkspaceRole) : "operator";
}

export function normalizeWorkspaceApprovalMode(value: unknown): WorkspaceApprovalMode {
  return value === "open" ? "open" : "review_required";
}

export function normalizeWorkspaceSceneStatus(value: unknown): WorkspaceSceneStatus {
  return value === "review_requested"
    || value === "approved"
    || value === "rejected"
    || value === "published"
    || value === "recovered"
    ? value
    : "draft";
}

export function normalizeWorkspaceGovernance(raw: unknown): WorkspaceGovernanceState {
  if (!raw || typeof raw !== "object") return createDefaultWorkspaceGovernance();
  const candidate = raw as Partial<WorkspaceGovernanceState>;
  return {
    activeRole: normalizeWorkspaceRole(candidate.activeRole),
    approvalMode: normalizeWorkspaceApprovalMode(candidate.approvalMode),
    sceneStatus: normalizeWorkspaceSceneStatus(candidate.sceneStatus),
    requestedAt: typeof candidate.requestedAt === "number" ? candidate.requestedAt : null,
    requestedBy: candidate.requestedBy ? normalizeWorkspaceRole(candidate.requestedBy) : null,
    reviewedAt: typeof candidate.reviewedAt === "number" ? candidate.reviewedAt : null,
    reviewedBy: candidate.reviewedBy ? normalizeWorkspaceRole(candidate.reviewedBy) : null,
    publishedAt: typeof candidate.publishedAt === "number" ? candidate.publishedAt : null,
    publishedBy: candidate.publishedBy ? normalizeWorkspaceRole(candidate.publishedBy) : null,
    reviewNotes: Array.isArray(candidate.reviewNotes)
      ? [...new Set(candidate.reviewNotes.map((note) => String(note).trim()).filter(Boolean))].slice(0, 12)
      : [],
  };
}

export function canApproveWorkspaceScene(role: WorkspaceRole) {
  return role === "reviewer" || role === "admin";
}

export function resolveApprovalRoute(governance: WorkspaceGovernanceState, scene: any): WorkspaceRole[] {
  const requiredRoles: WorkspaceRole[] = [];
  
  if (governance.approvalMode === "open") return ["operator", "reviewer", "admin"];
  
  // ABAC logic: check scene attributes
  let needsAdmin = false;
  let needsPrivacyReview = false;
  
  if (scene) {
    if (scene.criticalZones && scene.criticalZones.length > 0) {
      // Any critical zone requires at least a reviewer, but if they are high/critical priority, maybe admin
      const hasCriticalPriority = scene.criticalZones.some((z: any) => z.priority === "critical" || z.priority === "high");
      if (hasCriticalPriority) needsAdmin = true;
    }
    if (scene.privacyZones && scene.privacyZones.length > 0) {
      needsPrivacyReview = true;
    }
  }

  if (needsAdmin) requiredRoles.push("admin");
  else requiredRoles.push("reviewer", "admin");

  if (needsPrivacyReview) requiredRoles.push("privacy_reviewer");

  return requiredRoles;
}

export function canPublishWorkspaceScene(governance: WorkspaceGovernanceState, scene?: any) {
  if (governance.approvalMode === "open") return true;
  if (governance.sceneStatus === "approved") return true;
  
  const allowedRoles = resolveApprovalRoute(governance, scene);
  return allowedRoles.includes(governance.activeRole);
}

export function isPublishReviewRequired(governance: WorkspaceGovernanceState, scene?: any) {
  return governance.approvalMode === "review_required" && governance.sceneStatus !== "approved";
}

export function summarizeWorkspaceGovernance(governance: WorkspaceGovernanceState, scene?: any): WorkspaceGovernanceSummary {
  const reviewAgeLabel = governance.requestedAt
    ? `${Math.max(0, Math.round((Date.now() - governance.requestedAt) / 60000))} min ago`
    : null;

  return {
    roleLabel: capitalizeLabel(governance.activeRole),
    approvalModeLabel: governance.approvalMode === "open" ? "Open publish" : "Review required",
    sceneStatusLabel: capitalizeLabel(governance.sceneStatus),
    canPublish: canPublishWorkspaceScene(governance, scene),
    needsApproval: isPublishReviewRequired(governance, scene),
    reviewAgeLabel,
    reviewerLabel: governance.reviewedBy ? capitalizeLabel(governance.reviewedBy) : governance.requestedBy ? capitalizeLabel(governance.requestedBy) : null,
  };
}

