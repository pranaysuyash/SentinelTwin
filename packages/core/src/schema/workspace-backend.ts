import { z } from "zod";

export const userRoleSchema = z.enum(["admin", "operator", "reviewer", "installer", "auditor", "privacy_reviewer", "insurer"]);
export type UserRole = z.infer<typeof userRoleSchema>;

export const permissionActionSchema = z.enum(["create", "read", "update", "delete", "publish", "approve", "reject", "request_review", "recover"]);
export type PermissionAction = z.infer<typeof permissionActionSchema>;

export const permissionSchema = z.object({
  action: permissionActionSchema,
  subject: z.enum(["workspace", "site", "scene", "draft", "report", "audit_log"]),
});
export type Permission = z.infer<typeof permissionSchema>;

export const userSchema = z.object({
  id: z.string().uuid(),
  authId: z.string(),
  email: z.string().email(),
  displayName: z.string(),
  createdAt: z.number(),
  lastSeenAt: z.number().nullable(),
});
export type User = z.infer<typeof userSchema>;

export const workspaceMemberSchema = z.object({
  workspaceId: z.string().uuid(),
  userId: z.string().uuid(),
  role: userRoleSchema,
  joinedAt: z.number(),
});
export type WorkspaceMember = z.infer<typeof workspaceMemberSchema>;

export const workspaceSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().uuid(),
  name: z.string(),
  description: z.string().optional(),
  createdAt: z.number(),
  updatedAt: z.number(),
  approvalMode: z.enum(["open", "review_required"]).default("review_required"),
});
export type Workspace = z.infer<typeof workspaceSchema>;

export const siteSchema = z.object({
  id: z.string().uuid(),
  workspaceId: z.string().uuid(),
  name: z.string(),
  address: z.string().optional(),
  geolocation: z.object({ lat: z.number(), lng: z.number() }).optional(),
  createdAt: z.number(),
  updatedAt: z.number(),
});
export type Site = z.infer<typeof siteSchema>;

export const sceneRecordSchema = z.object({
  id: z.string().uuid(),
  siteId: z.string().uuid(),
  name: z.string(),
  version: z.number(),
  status: z.enum(["draft", "review_requested", "approved", "rejected", "published", "archived"]),
  createdAt: z.number(),
  updatedAt: z.number(),
  publishedAt: z.number().nullable(),
  publishedBy: z.string().uuid().nullable(),
  sceneDataId: z.string().uuid(),
});
export type SceneRecord = z.infer<typeof sceneRecordSchema>;

export const draftSchema = z.object({
  id: z.string().uuid(),
  sceneRecordId: z.string().uuid(),
  authorId: z.string().uuid(),
  name: z.string(),
  status: z.enum(["in_progress", "review_requested", "approved", "rejected", "merged", "discarded"]),
  createdAt: z.number(),
  updatedAt: z.number(),
  requestedAt: z.number().nullable(),
  reviewedAt: z.number().nullable(),
  reviewedBy: z.string().uuid().nullable(),
  reviewNotes: z.array(z.string()).default([]),
  sceneDataId: z.string().uuid(),
});
export type Draft = z.infer<typeof draftSchema>;

export const reportSchema = z.object({
  id: z.string().uuid(),
  sceneRecordId: z.string().uuid(),
  authorId: z.string().uuid(),
  title: z.string(),
  format: z.enum(["pdf", "json", "html"]),
  status: z.enum(["generating", "completed", "failed"]),
  storageUrl: z.string().url().nullable(),
  createdAt: z.number(),
  completedAt: z.number().nullable(),
});
export type Report = z.infer<typeof reportSchema>;

export const commentSchema = z.object({
  id: z.string().uuid(),
  targetType: z.enum(["scene", "draft", "report", "node"]),
  targetId: z.string().uuid(),
  authorId: z.string().uuid(),
  content: z.string(),
  resolved: z.boolean().default(false),
  createdAt: z.number(),
  updatedAt: z.number(),
});
export type Comment = z.infer<typeof commentSchema>;

export const auditLogSchema = z.object({
  id: z.string().uuid(),
  workspaceId: z.string().uuid(),
  actorId: z.string().uuid(),
  action: z.string(),
  targetType: z.string(),
  targetId: z.string(),
  details: z.string(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  timestamp: z.number(),
});
export type AuditLog = z.infer<typeof auditLogSchema>;

export const conflictResolutionStrategySchema = z.enum(["last_write_wins", "manual_merge", "reject_new"]);
export type ConflictResolutionStrategy = z.infer<typeof conflictResolutionStrategySchema>;

export const syncConflictStateSchema = z.object({
  entityType: z.string(),
  entityId: z.string(),
  serverVersion: z.number(),
  clientVersion: z.number(),
  conflictDetectedAt: z.number(),
  resolutionStatus: z.enum(["pending", "resolved", "ignored"]),
});
export type SyncConflictState = z.infer<typeof syncConflictStateSchema>;
