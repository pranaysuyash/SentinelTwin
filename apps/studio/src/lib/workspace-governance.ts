export type WorkspaceRole =
  | "operator"
  | "reviewer"
  | "auditor"
  | "installer"
  | "insurer"
  | "privacy_reviewer"
  | "operations_manager"
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
  "operations_manager",
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

type GovernanceSceneZone = {
  priority?: string | null;
};

type GovernanceSceneContext = {
  criticalZones?: GovernanceSceneZone[] | null;
  privacyZones?: unknown[] | null;
  assumptions?: {
    operationalMode?: "permanent" | "temporary_event";
    operationalContext?: {
      isEmergencyWindow?: boolean;
      requiresTemporaryPerimeterLockdown?: boolean;
    };
    operationalScenarioEnvelope?: {
      active?: boolean;
      requiresTemporaryPerimeterLockdown?: boolean;
      requiresStaffingLockdown?: boolean;
      scope?: "temporary_event" | "temporary_perimeter" | "vip_visit" | "maintenance" | "incident_response" | "other";
    };
  } | null;
};

export function capitalizeLabel(value: string) {
  return value
    .replace(/_/g, " ")
    .split(" ")
    .map((part) => part.slice(0, 1).toUpperCase() + part.slice(1))
    .join(" ");
}

export function formatRoleLabel(role: string): string {
  return role.replace(/_/g, " ");
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

function hasHighPriorityCriticalZone(scene?: GovernanceSceneContext | null) {
  return Boolean(scene?.criticalZones?.some((zone) => zone?.priority === "critical" || zone?.priority === "high"));
}

function hasPrivacyExposure(scene?: GovernanceSceneContext | null) {
  return Boolean(scene?.privacyZones && scene.privacyZones.length > 0);
}

function requiresScenarioEscalation(scene?: GovernanceSceneContext | null) {
  if (scene?.assumptions?.operationalMode !== "temporary_event") return false;
  const context = scene.assumptions?.operationalContext;
  const envelope = scene.assumptions?.operationalScenarioEnvelope;
  return Boolean(
    context?.isEmergencyWindow ||
      context?.requiresTemporaryPerimeterLockdown ||
      envelope?.requiresTemporaryPerimeterLockdown ||
      envelope?.requiresStaffingLockdown ||
      envelope?.scope === "vip_visit" ||
      envelope?.scope === "incident_response",
  );
}

export function resolveApprovalRoute(governance: WorkspaceGovernanceState, scene?: GovernanceSceneContext | null): WorkspaceRole[] {
  if (governance.approvalMode === "open") return ["operator", "reviewer", "admin"];

  const requiresAdmin = hasHighPriorityCriticalZone(scene) || requiresScenarioEscalation(scene);
  const requiresPrivacyReview = hasPrivacyExposure(scene);

  if (requiresAdmin) {
    return requiresPrivacyReview ? ["admin", "privacy_reviewer"] : ["admin"];
  }

  return requiresPrivacyReview ? ["privacy_reviewer", "reviewer", "admin"] : ["reviewer", "admin"];
}

export function canPublishWorkspaceScene(governance: WorkspaceGovernanceState, scene?: GovernanceSceneContext | null) {
  if (governance.approvalMode === "open") return true;
  if (governance.sceneStatus === "approved") return true;

  const allowedRoles = resolveApprovalRoute(governance, scene);
  return allowedRoles.includes(governance.activeRole);
}

export function isPublishReviewRequired(governance: WorkspaceGovernanceState, scene?: GovernanceSceneContext | null) {
  return governance.approvalMode === "review_required" && governance.sceneStatus !== "approved";
}

export function summarizeWorkspaceGovernance(governance: WorkspaceGovernanceState, scene?: GovernanceSceneContext | null): WorkspaceGovernanceSummary {
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
