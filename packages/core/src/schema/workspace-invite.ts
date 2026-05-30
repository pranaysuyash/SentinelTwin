import { z } from "zod";
import { organizationRoleSchema } from "./organization.js";

export const workspaceInviteStatusSchema = z.enum(["pending", "accepted", "declined", "revoked", "expired"]);
export type WorkspaceInviteStatus = z.infer<typeof workspaceInviteStatusSchema>;

export const workspaceInviteSchema = z.object({
  id: z.string().uuid(),
  workspaceId: z.string().uuid(),
  organizationId: z.string().uuid(),
  inviterId: z.string().min(1),
  inviteeEmail: z.string().email(),
  role: organizationRoleSchema,
  status: workspaceInviteStatusSchema,
  createdAt: z.number(),
  expiresAt: z.number(),
});
export type WorkspaceInvite = z.infer<typeof workspaceInviteSchema>;

export const ownershipTransferEventSchema = z.object({
  id: z.string().uuid(),
  workspaceId: z.string().uuid(),
  fromOwnerId: z.string().min(1),
  toOwnerId: z.string().min(1),
  status: z.enum(["requested", "completed", "cancelled"]),
  createdAt: z.number(),
  completedAt: z.number().nullable(),
});
export type OwnershipTransferEvent = z.infer<typeof ownershipTransferEventSchema>;

export function createWorkspaceInvite(
  workspaceId: string,
  organizationId: string,
  inviterId: string,
  inviteeEmail: string,
  role: z.infer<typeof organizationRoleSchema> = "member",
): WorkspaceInvite {
  return {
    id: crypto.randomUUID(),
    workspaceId,
    organizationId,
    inviterId,
    inviteeEmail,
    role,
    status: "pending",
    createdAt: Date.now(),
    expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 days
  };
}
