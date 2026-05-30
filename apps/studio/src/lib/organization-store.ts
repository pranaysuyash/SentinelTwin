import type {
  Organization,
  OrganizationEntitlements,
  OrganizationList,
  OrganizationMember,
  OrganizationQuotas,
  OrganizationRole,
  PlanTier,
} from "@/schema/organization";
import {
  createDefaultOrganization,
  createProOrganization,
  createEnterpriseOrganization,
  checkOrganizationEntitlement,
  checkOrganizationQuota,
  upgradeOrganizationPlan,
} from "@/schema/organization";

const ORGANIZATIONS_STORAGE_KEY = "sentineltwin_organizations_v1";
const ACTIVE_ORGANIZATION_ID_KEY = "sentineltwin_active_organization_id_v1";

export type OrganizationOperationResult = {
  success: boolean;
  error?: string;
};

export type EntitlementCheck = {
  allowed: boolean;
  reason: string;
};

function generateId(): string {
  return crypto.randomUUID();
}

function loadOrganizationsFromStorage(): OrganizationList {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(ORGANIZATIONS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map(normalizeOrganizationRecord).filter((o): o is OrganizationList[number] => o !== null);
  } catch {
    return [];
  }
}

function persistOrganizations(orgs: OrganizationList): void {
  try {
    window.localStorage.setItem(ORGANIZATIONS_STORAGE_KEY, JSON.stringify(orgs));
  } catch {
    // Storage full or unavailable
  }
}

function loadActiveOrganizationId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(ACTIVE_ORGANIZATION_ID_KEY);
    return raw || null;
  } catch {
    return null;
  }
}

function persistActiveOrganizationId(id: string | null): void {
  try {
    if (id) {
      window.localStorage.setItem(ACTIVE_ORGANIZATION_ID_KEY, id);
    } else {
      window.localStorage.removeItem(ACTIVE_ORGANIZATION_ID_KEY);
    }
  } catch {
    // Storage full or unavailable
  }
}

function normalizeOrganizationRecord(raw: unknown): OrganizationList[number] | null {
  if (!raw || typeof raw !== "object") return null;
  const candidate = raw as Record<string, unknown>;
  if (typeof candidate.id !== "string" || typeof candidate.name !== "string") return null;

  const members: OrganizationMember[] = [];
  if (Array.isArray(candidate.members)) {
    for (const m of candidate.members) {
      if (m && typeof m === "object" && typeof (m as Record<string, unknown>).id === "string" && typeof (m as Record<string, unknown>).name === "string") {
        const member = m as Record<string, unknown>;
        const role = typeof member.role === "string" && ["owner", "admin", "member", "guest"].includes(member.role)
          ? (member.role as OrganizationRole)
          : "member";
        members.push({
          id: member.id as string,
          name: member.name as string,
          role,
          email: typeof member.email === "string" ? member.email : undefined,
          joinedAt: typeof member.joinedAt === "number" ? member.joinedAt : Date.now(),
        });
      }
    }
  }

  const plan = typeof candidate.plan === "string" && ["free", "pro", "enterprise"].includes(candidate.plan)
    ? (candidate.plan as PlanTier)
    : "free";

  return {
    id: candidate.id as string,
    name: String(candidate.name).trim() || "Unnamed Organization",
    createdAt: typeof candidate.createdAt === "number" ? candidate.createdAt : Date.now(),
    plan,
    ownerId: typeof candidate.ownerId === "string" ? candidate.ownerId : "local-user",
    quotas: normalizeQuotas(candidate.quotas, plan),
    entitlements: normalizeEntitlements(candidate.entitlements, plan),
    members,
  };
}

function normalizeQuotas(raw: unknown, plan: PlanTier): OrganizationQuotas {
  const defaults: Record<PlanTier, OrganizationQuotas> = {
    free: { maxWorkspaces: 3, maxMembers: 1, maxStorageBytes: 100 * 1024 * 1024 },
    pro: { maxWorkspaces: 10, maxMembers: 5, maxStorageBytes: 1024 * 1024 * 1024 },
    enterprise: { maxWorkspaces: 100, maxMembers: 50, maxStorageBytes: 10 * 1024 * 1024 * 1024 }
  };
  const base = defaults[plan] ?? defaults.free;
  if (!raw || typeof raw !== "object") return base;
  const q = raw as Partial<OrganizationQuotas>;
  return {
    maxWorkspaces: typeof q.maxWorkspaces === "number" ? q.maxWorkspaces : base.maxWorkspaces,
    maxMembers: typeof q.maxMembers === "number" ? q.maxMembers : base.maxMembers,
    maxStorageBytes: typeof q.maxStorageBytes === "number" ? q.maxStorageBytes : base.maxStorageBytes,
  };
}

function normalizeEntitlements(raw: unknown, plan: PlanTier): OrganizationEntitlements {
  const defaults: Record<PlanTier, OrganizationEntitlements> = {
    free: { sharedWorkspaces: false, publishedWorkspaces: false, archiveRecovery: true, reportExports: true, scanIntake: false, liveEvidence: false, ownershipTransfer: false, invites: false },
    pro: { sharedWorkspaces: true, publishedWorkspaces: false, archiveRecovery: true, reportExports: true, scanIntake: true, liveEvidence: true, ownershipTransfer: true, invites: true },
    enterprise: { sharedWorkspaces: true, publishedWorkspaces: true, archiveRecovery: true, reportExports: true, scanIntake: true, liveEvidence: true, ownershipTransfer: true, invites: true },
  };
  const base = defaults[plan] ?? defaults.free;
  if (!raw || typeof raw !== "object") return base;
  const e = raw as Partial<OrganizationEntitlements>;
  return {
    sharedWorkspaces: typeof e.sharedWorkspaces === "boolean" ? e.sharedWorkspaces : base.sharedWorkspaces,
    publishedWorkspaces: typeof e.publishedWorkspaces === "boolean" ? e.publishedWorkspaces : base.publishedWorkspaces,
    archiveRecovery: typeof e.archiveRecovery === "boolean" ? e.archiveRecovery : base.archiveRecovery,
    reportExports: typeof e.reportExports === "boolean" ? e.reportExports : base.reportExports,
    scanIntake: typeof e.scanIntake === "boolean" ? e.scanIntake : base.scanIntake,
    liveEvidence: typeof e.liveEvidence === "boolean" ? e.liveEvidence : base.liveEvidence,
    ownershipTransfer: typeof e.ownershipTransfer === "boolean" ? e.ownershipTransfer : base.ownershipTransfer,
    invites: typeof e.invites === "boolean" ? e.invites : base.invites,
  };
}

export class OrganizationManager {
  private organizations: OrganizationList;
  private activeOrganizationId: string | null;

  constructor() {
    this.organizations = loadOrganizationsFromStorage();
    this.activeOrganizationId = this.resolveActiveOrganization();
  }

  private resolveActiveOrganization(): string | null {
    const stored = loadActiveOrganizationId();
    if (stored && this.organizations.some((o) => o.id === stored)) return stored;
    if (this.organizations.length > 0) return this.organizations[0].id;
    return null;
  }

  getOrganizations(): OrganizationList {
    return [...this.organizations];
  }

  getOrganization(id: string): OrganizationList[number] | null {
    return this.organizations.find((o) => o.id === id) ?? null;
  }

  getActiveOrganization(): OrganizationList[number] | null {
    if (!this.activeOrganizationId) return null;
    return this.getOrganization(this.activeOrganizationId);
  }

  getActiveOrganizationId(): string | null {
    return this.activeOrganizationId;
  }

  setActiveOrganization(id: string | null): OrganizationOperationResult {
    if (id !== null && !this.organizations.some((o) => o.id === id)) {
      return { success: false, error: `Organization ${id} not found.` };
    }
    this.activeOrganizationId = id;
    persistActiveOrganizationId(id);
    return { success: true };
  }

  addOrganization(name: string, ownerId: string = "local-user", plan: PlanTier = "free"): OrganizationList[number] {
    const factory = plan === "enterprise" ? createEnterpriseOrganization : plan === "pro" ? createProOrganization : createDefaultOrganization;
    const org = factory(ownerId, name.trim());
    const orgWithMember: OrganizationList[number] = {
      ...org,
      members: [
        {
          id: ownerId,
          name: "You",
          role: "owner",
          joinedAt: org.createdAt,
        },
      ],
    };
    this.organizations = [...this.organizations, orgWithMember];
    persistOrganizations(this.organizations);
    if (!this.activeOrganizationId) {
      this.activeOrganizationId = orgWithMember.id;
      persistActiveOrganizationId(orgWithMember.id);
    }
    return orgWithMember;
  }

  updateOrganization(id: string, patch: Partial<Pick<OrganizationList[number], "name" | "plan">>): OrganizationOperationResult {
    const index = this.organizations.findIndex((o) => o.id === id);
    if (index === -1) return { success: false, error: `Organization ${id} not found.` };

    const current = this.organizations[index];
    let nextOrg = { ...current };

    if (patch.name !== undefined) {
      nextOrg.name = patch.name.trim() || current.name;
    }

    if (patch.plan !== undefined && patch.plan !== current.plan) {
      const upgraded = upgradeOrganizationPlan(nextOrg, patch.plan);
      nextOrg = { ...nextOrg, ...upgraded, members: current.members, id: current.id, createdAt: current.createdAt };
    }

    this.organizations = [
      ...this.organizations.slice(0, index),
      nextOrg,
      ...this.organizations.slice(index + 1),
    ];
    persistOrganizations(this.organizations);
    return { success: true };
  }

  removeOrganization(id: string): OrganizationOperationResult {
    const index = this.organizations.findIndex((o) => o.id === id);
    if (index === -1) return { success: false, error: `Organization ${id} not found.` };
    this.organizations = [...this.organizations.slice(0, index), ...this.organizations.slice(index + 1)];
    persistOrganizations(this.organizations);
    if (this.activeOrganizationId === id) {
      this.activeOrganizationId = this.organizations.length > 0 ? this.organizations[0].id : null;
      persistActiveOrganizationId(this.activeOrganizationId);
    }
    return { success: true };
  }

  addMember(orgId: string, member: Omit<OrganizationMember, "joinedAt">): OrganizationOperationResult {
    const index = this.organizations.findIndex((o) => o.id === orgId);
    if (index === -1) return { success: false, error: `Organization ${orgId} not found.` };
    const org = this.organizations[index];
    if (org.members.length >= org.quotas.maxMembers) {
      return { success: false, error: `Member limit (${org.quotas.maxMembers}) reached for ${org.name}.` };
    }
    const newMember: OrganizationMember = { ...member, joinedAt: Date.now() };
    this.organizations = [
      ...this.organizations.slice(0, index),
      { ...org, members: [...org.members, newMember] },
      ...this.organizations.slice(index + 1),
    ];
    persistOrganizations(this.organizations);
    return { success: true };
  }

  removeMember(orgId: string, memberId: string): OrganizationOperationResult {
    const index = this.organizations.findIndex((o) => o.id === orgId);
    if (index === -1) return { success: false, error: `Organization ${orgId} not found.` };
    const org = this.organizations[index];
    const memberIndex = org.members.findIndex((m) => m.id === memberId);
    if (memberIndex === -1) return { success: false, error: `Member ${memberId} not found in ${org.name}.` };
    if (org.members[memberIndex].role === "owner") {
      return { success: false, error: `Cannot remove the owner of ${org.name}. Transfer ownership first.` };
    }
    this.organizations = [
      ...this.organizations.slice(0, index),
      { ...org, members: org.members.filter((m) => m.id !== memberId) },
      ...this.organizations.slice(index + 1),
    ];
    persistOrganizations(this.organizations);
    return { success: true };
  }

  checkEntitlement(entitlement: keyof OrganizationEntitlements, orgId?: string): EntitlementCheck {
    const org = orgId ? this.getOrganization(orgId) : this.getActiveOrganization();
    if (!org) {
      return { allowed: false, reason: "No organization selected." };
    }
    const allowed = checkOrganizationEntitlement(org, entitlement);
    return {
      allowed,
      reason: allowed
        ? `${org.name} has ${entitlement.replace(/([A-Z])/g, " $1").toLowerCase()} entitlement.`
        : `${org.name} plan (${org.plan}) does not include ${entitlement.replace(/([A-Z])/g, " $1").toLowerCase()}. Upgrade to enable.`,
    };
  }

  checkQuota(resource: keyof OrganizationQuotas, currentUsage: number, orgId?: string): EntitlementCheck {
    const org = orgId ? this.getOrganization(orgId) : this.getActiveOrganization();
    if (!org) {
      return { allowed: false, reason: "No organization selected." };
    }
    const allowed = checkOrganizationQuota(org, resource, currentUsage);
    return {
      allowed,
      reason: allowed
        ? `${org.name} has capacity for more ${resource.replace(/([A-Z])/g, " $1").toLowerCase()}.`
        : `${org.name} has reached its ${resource.replace(/([A-Z])/g, " $1").toLowerCase()} limit (${org.quotas[resource]}).`,
    };
  }

  seedLocalOrgsIfEmpty(ownerId: string = "local-user"): void {
    if (this.organizations.length > 0) return;
    const personal = createDefaultOrganization(ownerId, "Personal Workspace");
    this.organizations = [{
      ...personal,
      members: [{ id: ownerId, name: "You", role: "owner", joinedAt: personal.createdAt }],
    }];
    this.activeOrganizationId = personal.id;
    persistOrganizations(this.organizations);
    persistActiveOrganizationId(personal.id);
  }

  getDefaultOrganizationName(): string {
    const active = this.getActiveOrganization();
    return active?.name ?? "Personal Workspace";
  }
}

const ORG_MANAGER_KEY = Symbol("org-manager");
let globalOrgManager: OrganizationManager | null = null;

export function getOrganizationManager(): OrganizationManager {
  if (!globalOrgManager) {
    globalOrgManager = new OrganizationManager();
    globalOrgManager.seedLocalOrgsIfEmpty();
  }
  return globalOrgManager;
}

export function resetOrganizationManagerForTesting(): void {
  globalOrgManager = null;
}
