"use client";

import { useCallback, useMemo, useState } from "react";
import {
  Building2,
  Check,
  ChevronDown,
  CirclePlus,
  Globe,
  Pencil,
  Plus,
  ShieldCheck,
  Trash2,
  Users,
  X,
} from "lucide-react";

import { useStudioStore } from "@/store/studio-store";
import { getOrganizationManager } from "@/lib/organization-store";
import { planTierLabels, planTierDescriptions, formatOrganizationQuotaSummary, formatOrganizationEntitlementSummary } from "@/schema/organization";
import type { Organization, OrganizationList, OrganizationMember } from "@/schema/organization";
import { UI_SURFACES } from "@/lib/studio-surface-tokens";

interface OrganizationManagerPanelProps {
  open: boolean;
  onClose: () => void;
}

export function OrganizationManagerPanel({ open, onClose }: OrganizationManagerPanelProps) {
  const refreshOrganizations = useStudioStore((s) => s.refreshOrganizations);

  const [orgs, setOrgs] = useState<OrganizationList>(() => getOrganizationManager().getOrganizations());
  const [activeOrgId, setActiveOrgId] = useState<string | null>(() => getOrganizationManager().getActiveOrganizationId());
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createName, setCreateName] = useState("");
  const [createPlan, setCreatePlan] = useState<Organization["plan"]>("free");
  const [editingOrgId, setEditingOrgId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editPlan, setEditPlan] = useState<Organization["plan"]>("free");
  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null);

  const refresh = useCallback(() => {
    setOrgs(getOrganizationManager().getOrganizations());
    setActiveOrgId(getOrganizationManager().getActiveOrganizationId());
    refreshOrganizations();
  }, [refreshOrganizations]);

  const handleCreate = useCallback(() => {
    const name = createName.trim();
    if (!name) return;
    getOrganizationManager().addOrganization(name, "local-user", createPlan);
    setCreateName("");
    setCreatePlan("free");
    setShowCreateForm(false);
    refresh();
  }, [createName, createPlan, refresh]);

  const handleEdit = useCallback(() => {
    if (!editingOrgId) return;
    getOrganizationManager().updateOrganization(editingOrgId, {
      name: editName.trim() || undefined,
      plan: editPlan,
    });
    setEditingOrgId(null);
    refresh();
  }, [editingOrgId, editName, editPlan, refresh]);

  const handleRemove = useCallback((id: string) => {
    getOrganizationManager().removeOrganization(id);
    setConfirmRemoveId(null);
    refresh();
  }, [refresh]);

  const handleSetActive = useCallback((id: string) => {
    getOrganizationManager().setActiveOrganization(id);
    refresh();
  }, [refresh]);

  const activeOrg = useMemo(() => orgs.find((o) => o.id === activeOrgId) ?? null, [orgs, activeOrgId]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4">
      <div className={`flex max-h-[90vh] w-full max-w-2xl flex-col rounded-2xl border ${UI_SURFACES.borderSubtle} ${UI_SURFACES.panel} shadow-2xl`}>
        <div className={`flex items-center justify-between border-b ${UI_SURFACES.borderSubtle} px-5 py-4`}>
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-emerald-400/25 bg-emerald-500/12 text-emerald-200">
              <Building2 className="h-5 w-5" />
            </div>
            <div>
              <div className="text-sm font-semibold text-white">Organization Manager</div>
              <div className={`text-[11px] ${UI_SURFACES.textSoftMuted}`}>Manage organizations, plans, and membership</div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className={`rounded-lg border ${UI_SURFACES.borderDark} p-1.5 ${UI_SURFACES.textSoftMuted} hover:border-red-400/30 hover:bg-red-500/10 hover:text-red-200`}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {activeOrg ? (
            <div className="mb-4 rounded-xl border border-sky-400/20 bg-sky-500/10 p-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-sky-300" />
                  <span className="text-sm font-semibold text-white">{activeOrg.name}</span>
                  <span className="rounded-full border border-sky-400/20 bg-sky-500/10 px-2 py-0.5 text-[9px] uppercase tracking-[0.14em] text-sky-200">
                    Active
                  </span>
                </div>
                <span className="rounded-full border border-emerald-400/20 bg-emerald-500/10 px-2 py-0.5 text-[10px] text-emerald-200">
                  {planTierLabels[activeOrg.plan]}
                </span>
              </div>
              <div className={`mt-2 text-[10px] leading-relaxed ${UI_SURFACES.textSoftMuted}`}>
                {planTierDescriptions[activeOrg.plan]}
              </div>
              <div className={`mt-2 text-[10px] leading-relaxed ${UI_SURFACES.textSoftMuted}`}>
                {formatOrganizationQuotaSummary(activeOrg)}
              </div>
              <div className={`mt-1 text-[10px] leading-relaxed ${UI_SURFACES.textSoftMuted}`}>
                {formatOrganizationEntitlementSummary(activeOrg)}
              </div>
            </div>
          ) : (
            <div className="mb-4 rounded-xl border border-dashed border-amber-400/20 bg-amber-500/10 p-3 text-[10px] text-amber-200">
              No organization selected. Create or select an organization to manage workspace access and entitlements.
            </div>
          )}

          <div className="mb-3 flex items-center justify-between">
            <div className={`text-[11px] uppercase tracking-[0.22em] ${UI_SURFACES.textSoftBright}`}>
              Organizations ({orgs.length})
            </div>
            <button
              type="button"
              onClick={() => { setShowCreateForm(true); setConfirmRemoveId(null); }}
              disabled={showCreateForm}
              className="flex items-center gap-1.5 rounded-lg border border-emerald-400/25 bg-emerald-500/10 px-2.5 py-1.5 text-[10px] font-semibold text-emerald-200 hover:bg-emerald-500/18 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Plus className="h-3.5 w-3.5" />
              New Organization
            </button>
          </div>

          {showCreateForm ? (
            <div className={`mb-3 rounded-xl border ${UI_SURFACES.borderSubtle} ${UI_SURFACES.hoverBgDark} p-3`}>
              <div className={`text-[10px] font-semibold uppercase tracking-[0.18em] ${UI_SURFACES.textSoftBright}`}>Create Organization</div>
              <input
                value={createName}
                onChange={(e) => setCreateName(e.target.value)}
                placeholder="Organization name"
                aria-label="Organization name"
                className={`mt-2 w-full rounded-lg border ${UI_SURFACES.borderDark} ${UI_SURFACES.card} px-3 py-2 text-xs text-white outline-none focus:border-blue-500/50`}
              />
              <div className="mt-2 flex items-center gap-2">
                <span className={`text-[10px] ${UI_SURFACES.textSoftBright}`}>Plan:</span>
                {(["free", "pro", "enterprise"] as const).map((plan) => (
                  <button
                    key={plan}
                    type="button"
                    onClick={() => setCreatePlan(plan)}
                    className={`rounded-lg border px-2.5 py-1 text-[10px] font-semibold ${
                      createPlan === plan
                        ? "border-sky-400/30 bg-sky-500/12 text-sky-100"
                        : "${UI_SURFACES.borderDark} ${UI_SURFACES.textSoftMuted} hover:border-sky-400/20"
                    }`}
                  >
                    {planTierLabels[plan]}
                  </button>
                ))}
              </div>
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={handleCreate}
                  disabled={!createName.trim()}
                  className="rounded-lg bg-emerald-500/20 px-3 py-1.5 text-[10px] font-semibold text-emerald-100 hover:bg-emerald-500/30 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Create
                </button>
                <button
                  type="button"
                  onClick={() => { setShowCreateForm(false); setCreateName(""); }}
                  className={`rounded-lg border ${UI_SURFACES.borderDark} px-3 py-1.5 text-[10px] ${UI_SURFACES.textSoftMuted}`}
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : null}

          <div className="space-y-2">
            {orgs.map((org) => {
              const isEditing = editingOrgId === org.id;
              const isConfirming = confirmRemoveId === org.id;
              const isActive = org.id === activeOrgId;

              return (
                <div
                  key={org.id}
                  className={`rounded-xl border p-3 ${
                    isActive
                      ? "border-sky-400/25 bg-sky-500/8"
                      : "${UI_SURFACES.borderSubtle} ${UI_SURFACES.hoverBgDark}/80"
                  }`}
                >
                  {isEditing ? (
                    <div>
                      <input
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        placeholder="Organization name"
                        aria-label="Edit organization name"
                        className={`w-full rounded-lg border ${UI_SURFACES.borderDark} ${UI_SURFACES.card} px-3 py-2 text-xs text-white outline-none focus:border-blue-500/50`}
                      />
                      <div className="mt-2 flex items-center gap-2">
                        <span className={`text-[10px] ${UI_SURFACES.textSoftBright}`}>Plan:</span>
                        {(["free", "pro", "enterprise"] as const).map((plan) => (
                          <button
                            key={plan}
                            type="button"
                            onClick={() => setEditPlan(plan)}
                            className={`rounded-lg border px-2.5 py-1 text-[10px] font-semibold ${
                              editPlan === plan
                                ? "border-sky-400/30 bg-sky-500/12 text-sky-100"
                                : "${UI_SURFACES.borderDark} ${UI_SURFACES.textSoftMuted} hover:border-sky-400/20"
                            }`}
                          >
                            {planTierLabels[plan]}
                          </button>
                        ))}
                      </div>
                      <div className="mt-2 flex gap-2">
                        <button
                          type="button"
                          onClick={handleEdit}
                          className="rounded-lg bg-emerald-500/20 px-3 py-1.5 text-[10px] font-semibold text-emerald-100"
                        >
                          <Check className="mr-1 inline h-3 w-3" />
                          Save
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingOrgId(null)}
                          className={`rounded-lg border ${UI_SURFACES.borderDark} px-3 py-1.5 text-[10px] ${UI_SURFACES.textSoftMuted}`}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : isConfirming ? (
                    <div>
                      <div className="text-xs text-amber-200">
                        Remove <strong>{org.name}</strong>? This action cannot be undone. Workspaces assigned to this organization will revert to unassigned.
                      </div>
                      <div className="mt-2 flex gap-2">
                        <button
                          type="button"
                          onClick={() => handleRemove(org.id)}
                          className="rounded-lg bg-red-500/20 px-3 py-1.5 text-[10px] font-semibold text-red-100 hover:bg-red-500/30"
                        >
                          Remove
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmRemoveId(null)}
                          className={`rounded-lg border ${UI_SURFACES.borderDark} px-3 py-1.5 text-[10px] ${UI_SURFACES.textSoftMuted}`}
                        >
                          Keep
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Building2 className={`h-4 w-4 ${UI_SURFACES.textSoftMuted}`} />
                          <span className="text-sm font-semibold text-white">{org.name}</span>
                          <span className={`rounded-full border ${UI_SURFACES.borderDark} bg-white/[0.04] px-2 py-0.5 text-[9px] uppercase tracking-[0.12em] ${UI_SURFACES.textSoftMuted}`}>
                            {planTierLabels[org.plan]}
                          </span>
                          {isActive ? (
                            <span className="rounded-full border border-sky-400/20 bg-sky-500/10 px-2 py-0.5 text-[9px] text-sky-200">
                              Active
                            </span>
                          ) : null}
                        </div>
                        <div className="flex items-center gap-1">
                          {!isActive ? (
                            <button
                              type="button"
                              onClick={() => handleSetActive(org.id)}
                              className="rounded-lg border border-sky-400/20 bg-sky-500/10 p-1.5 text-[10px] text-sky-200 hover:bg-sky-500/20"
                              title="Set as active organization"
                            >
                              <Check className="h-3.5 w-3.5" />
                            </button>
                          ) : null}
                          <button
                            type="button"
                            onClick={() => {
                              setEditingOrgId(org.id);
                              setEditName(org.name);
                              setEditPlan(org.plan);
                              setConfirmRemoveId(null);
                            }}
                            className={`rounded-lg border ${UI_SURFACES.borderDark} p-1.5 ${UI_SURFACES.textSoftMuted} hover:border-sky-400/20 hover:bg-sky-500/10 hover:text-sky-200`}
                            title="Edit organization"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmRemoveId(org.id)}
                            className={`rounded-lg border ${UI_SURFACES.borderDark} p-1.5 ${UI_SURFACES.textSoftMuted} hover:border-red-400/20 hover:bg-red-500/10 hover:text-red-200`}
                            title="Remove organization"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                      <div className={`mt-1.5 flex items-center gap-3 text-[10px] ${UI_SURFACES.textSoftBright}`}>
                        <span className="flex items-center gap-1">
                          <Users className="h-3 w-3" />
                          {org.members.length} member{org.members.length !== 1 ? "s" : ""}
                        </span>
                        <span>{org.members.find((m) => m.role === "owner")?.name ?? "You"}</span>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className={`border-t ${UI_SURFACES.borderSubtle} px-5 py-3 text-[10px] ${UI_SURFACES.textSoftBright}`}>
          Organizations are stored locally. Billing, remote invites, and ownership transfer require a backend identity service.
        </div>
      </div>
    </div>
  );
}
