import { z } from "zod";

export const WorkspaceRoleSchema = z.enum(["owner", "admin", "editor", "viewer", "auditor"]);
export type WorkspaceRole = z.infer<typeof WorkspaceRoleSchema>;

export const ApprovalStatusSchema = z.enum(["pending", "approved", "rejected", "superseded"]);
export type ApprovalStatus = z.infer<typeof ApprovalStatusSchema>;

export const ApprovalTransitionSchema = z.object({
  id: z.string().min(1),
  workspaceId: z.string().min(1),
  requestedBy: z.string().min(1),
  requestedAt: z.number().int().nonnegative(),
  description: z.string().min(1),
  sceneSnapshotId: z.string().min(1).nullable(),
  requiredApprovers: z.array(z.string().min(1)).default([]),
  approvals: z.array(z.object({
    userId: z.string().min(1),
    status: ApprovalStatusSchema,
    comment: z.string().nullable(),
    decidedAt: z.number().int().nonnegative().nullable(),
  })).default([]),
  status: ApprovalStatusSchema,
  resolvedAt: z.number().int().nonnegative().nullable(),
  appliedAt: z.number().int().nonnegative().nullable(),
});
export type ApprovalTransition = z.infer<typeof ApprovalTransitionSchema>;

export const WorkspaceMemberSchema = z.object({
  userId: z.string().min(1),
  email: z.string().email(),
  displayName: z.string().min(1),
  role: WorkspaceRoleSchema,
  invitedAt: z.number().int().nonnegative(),
  joinedAt: z.number().int().nonnegative().nullable(),
  lastActiveAt: z.number().int().nonnegative().nullable(),
});
export type WorkspaceMember = z.infer<typeof WorkspaceMemberSchema>;

export const WorkspacePolicySchema = z.object({
  requireApprovalForPublish: z.boolean().default(false),
  requireApprovalForEdit: z.boolean().default(false),
  minApproversForPublish: z.number().int().nonnegative().default(1),
  allowedRolesForPublish: z.array(WorkspaceRoleSchema).default(["owner", "admin"]),
  allowedRolesForDelete: z.array(WorkspaceRoleSchema).default(["owner"]),
  allowedRolesForInvite: z.array(WorkspaceRoleSchema).default(["owner", "admin"]),
  auditLogRetentionDays: z.number().int().nonnegative().default(90),
});
export type WorkspacePolicy = z.infer<typeof WorkspacePolicySchema>;

export const WorkspaceBackendContractSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().default(""),
  ownerId: z.string().min(1),
  members: z.array(WorkspaceMemberSchema).default([]),
  policy: WorkspacePolicySchema.default({
    requireApprovalForPublish: false,
    requireApprovalForEdit: false,
    minApproversForPublish: 1,
    allowedRolesForPublish: ["owner", "admin"],
    allowedRolesForDelete: ["owner"],
    allowedRolesForInvite: ["owner", "admin"],
    auditLogRetentionDays: 90,
  }),
  pendingTransitions: z.array(ApprovalTransitionSchema).default([]),
  createdAt: z.number().int().nonnegative(),
  updatedAt: z.number().int().nonnegative(),
});
export type WorkspaceBackendContract = z.infer<typeof WorkspaceBackendContractSchema>;

export const OrgAccountSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  plan: z.enum(["free", "pro", "enterprise"]).default("free"),
  maxWorkspaces: z.number().int().nonnegative().default(3),
  maxMembersPerWorkspace: z.number().int().nonnegative().default(5),
  features: z.array(z.string()).default([]),
  createdAt: z.number().int().nonnegative(),
});
export type OrgAccount = z.infer<typeof OrgAccountSchema>;

export function createWorkspaceBackendContract(
  id: string,
  name: string,
  ownerId: string,
  ownerEmail: string,
  ownerDisplayName: string,
): WorkspaceBackendContract {
  const now = Date.now();
  return {
    id,
    name,
    description: "",
    ownerId,
    members: [{
      userId: ownerId,
      email: ownerEmail,
      displayName: ownerDisplayName,
      role: "owner",
      invitedAt: now,
      joinedAt: now,
      lastActiveAt: now,
    }],
    policy: {
      requireApprovalForPublish: false,
      requireApprovalForEdit: false,
      minApproversForPublish: 1,
      allowedRolesForPublish: ["owner", "admin"],
      allowedRolesForDelete: ["owner"],
      allowedRolesForInvite: ["owner", "admin"],
      auditLogRetentionDays: 90,
    },
    pendingTransitions: [],
    createdAt: now,
    updatedAt: now,
  };
}

export function createApprovalTransition(
  workspaceId: string,
  requestedBy: string,
  description: string,
  sceneSnapshotId: string | null = null,
): ApprovalTransition {
  return {
    id: `approval_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    workspaceId,
    requestedBy,
    requestedAt: Date.now(),
    description,
    sceneSnapshotId,
    requiredApprovers: [],
    approvals: [],
    status: "pending",
    resolvedAt: null,
    appliedAt: null,
  };
}

export function canUserPublish(member: WorkspaceMember | null, policy: WorkspacePolicy): boolean {
  if (!member) return false;
  return policy.allowedRolesForPublish.includes(member.role);
}

export function canUserInvite(member: WorkspaceMember | null, policy: WorkspacePolicy): boolean {
  if (!member) return false;
  return policy.allowedRolesForInvite.includes(member.role);
}

export function canUserDelete(member: WorkspaceMember | null, policy: WorkspacePolicy): boolean {
  if (!member) return false;
  return policy.allowedRolesForDelete.includes(member.role);
}

export function getEffectiveRole(member: WorkspaceMember | null): WorkspaceRole {
  return member?.role ?? "viewer";
}
