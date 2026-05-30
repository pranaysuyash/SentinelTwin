import { z } from "zod";

export const planTierSchema = z.enum(["free", "pro", "enterprise"]);
export type PlanTier = z.infer<typeof planTierSchema>;

export const organizationRoleSchema = z.enum(["owner", "admin", "member", "guest"]);
export type OrganizationRole = z.infer<typeof organizationRoleSchema>;

export const organizationQuotasSchema = z.object({
  maxWorkspaces: z.number().int().nonnegative(),
  maxMembers: z.number().int().nonnegative(),
  maxStorageBytes: z.number().int().nonnegative(),
});
export type OrganizationQuotas = z.infer<typeof organizationQuotasSchema>;

export const organizationEntitlementsSchema = z.object({
  sharedWorkspaces: z.boolean(),
  publishedWorkspaces: z.boolean(),
  archiveRecovery: z.boolean(),
  reportExports: z.boolean(),
  scanIntake: z.boolean(),
  liveEvidence: z.boolean(),
  ownershipTransfer: z.boolean(),
  invites: z.boolean(),
});
export type OrganizationEntitlements = z.infer<typeof organizationEntitlementsSchema>;

export const organizationSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  createdAt: z.number(),
  plan: planTierSchema,
  quotas: organizationQuotasSchema,
  entitlements: organizationEntitlementsSchema,
  ownerId: z.string().min(1), // User ID of the primary billing owner
});
export type Organization = z.infer<typeof organizationSchema>;

export const accountSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().min(1),
  primaryOrganizationId: z.string().uuid().nullable(),
  organizations: z.array(z.string().uuid()),
});
export type Account = z.infer<typeof accountSchema>;

export function createDefaultOrganization(ownerId: string, name: string): Organization {
  return {
    id: crypto.randomUUID(),
    name,
    createdAt: Date.now(),
    plan: "free",
    ownerId,
    quotas: {
      maxWorkspaces: 3,
      maxMembers: 1,
      maxStorageBytes: 1024 * 1024 * 100, // 100MB
    },
    entitlements: {
      sharedWorkspaces: false,
      publishedWorkspaces: false,
      archiveRecovery: true,
      reportExports: true,
      scanIntake: false,
      liveEvidence: false,
      ownershipTransfer: false,
      invites: false,
    },
  };
}
