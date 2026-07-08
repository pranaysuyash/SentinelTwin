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

export function createProOrganization(ownerId: string, name: string): Organization {
  return {
    id: crypto.randomUUID(),
    name,
    createdAt: Date.now(),
    plan: "pro",
    ownerId,
    quotas: {
      maxWorkspaces: 12,
      maxMembers: 5,
      maxStorageBytes: 1024 * 1024 * 1024,
    },
    entitlements: {
      sharedWorkspaces: true,
      publishedWorkspaces: false,
      archiveRecovery: true,
      reportExports: true,
      scanIntake: true,
      liveEvidence: true,
      ownershipTransfer: true,
      invites: true,
    },
  };
}

export function createEnterpriseOrganization(ownerId: string, name: string): Organization {
  return {
    id: crypto.randomUUID(),
    name,
    createdAt: Date.now(),
    plan: "enterprise",
    ownerId,
    quotas: {
      maxWorkspaces: 50,
      maxMembers: 50,
      maxStorageBytes: 1024 * 1024 * 1024 * 10,
    },
    entitlements: {
      sharedWorkspaces: true,
      publishedWorkspaces: true,
      archiveRecovery: true,
      reportExports: true,
      scanIntake: true,
      liveEvidence: true,
      ownershipTransfer: true,
      invites: true,
    },
  };
}

export const organizationMemberSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  role: organizationRoleSchema,
  email: z.string().email().optional(),
  joinedAt: z.number(),
});
export type OrganizationMember = z.infer<typeof organizationMemberSchema>;

export const organizationWithMembersSchema = organizationSchema.extend({
  members: z.array(organizationMemberSchema).default([]),
});
export type OrganizationWithMembers = z.infer<typeof organizationWithMembersSchema>;

export const organizationListSchema = z.array(organizationWithMembersSchema);
export type OrganizationList = z.infer<typeof organizationListSchema>;

export const planTierLabels: Record<PlanTier, string> = {
  free: "Free",
  pro: "Pro",
  enterprise: "Enterprise",
};

export const planTierDescriptions: Record<PlanTier, string> = {
  free: "Local-only personal workspace",
  pro: "Collaborative workspace with shared access and evidence",
  enterprise: "Full enterprise security intelligence platform with compliance and governance",
};

export function checkOrganizationEntitlement(org: Organization, entitlement: keyof OrganizationEntitlements): boolean {
  return org.entitlements[entitlement] === true;
}

export function checkOrganizationQuota(org: Organization, resource: keyof OrganizationQuotas, currentUsage: number): boolean {
  return currentUsage < org.quotas[resource];
}

export function upgradeOrganizationPlan(org: Organization, targetPlan: PlanTier): Organization {
  const upgrades: Record<PlanTier, Organization | null> = {
    free: createDefaultOrganization(org.ownerId, org.name),
    pro: createProOrganization(org.ownerId, org.name),
    enterprise: createEnterpriseOrganization(org.ownerId, org.name),
  };
  const upgraded = upgrades[targetPlan];
  if (!upgraded) return org;
  return {
    ...upgraded,
    id: org.id,
    createdAt: org.createdAt,
  };
}

export function formatOrganizationQuotaSummary(org: Organization): string {
  return `Workspaces: ${org.quotas.maxWorkspaces} max · Members: ${org.quotas.maxMembers} max · Storage: ${formatStorageBytes(org.quotas.maxStorageBytes)}`;
}

export function formatOrganizationEntitlementSummary(org: Organization): string {
  const enabled: string[] = [];
  const disabled: string[] = [];
  for (const [key, value] of Object.entries(org.entitlements)) {
    const label = key.replace(/([A-Z])/g, " $1").replace(/^./, (s) => s.toUpperCase());
    if (value) enabled.push(label);
    else disabled.push(label);
  }
  const parts: string[] = [];
  if (enabled.length > 0) parts.push(`Enabled: ${enabled.join(", ")}`);
  if (disabled.length > 0) parts.push(`Not available: ${disabled.join(", ")}`);
  return parts.join(" · ");
}

function formatStorageBytes(bytes: number): string {
  if (bytes >= 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(0)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${bytes} B`;
}
