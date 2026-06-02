"use client";

import { HideSectionButton } from "@/components/launcher/HideSectionButton";
import { ProjectMetadataEditor } from "@/components/launcher/ProjectMetadataEditor";
import type { OrganizationList } from "@/schema/organization";
import type { SavedProjectRecord } from "@/store/studio-store";

export type ProjectSettingsPanelProps = {
  workspaceCatalog: {
    scopeLabel: string;
    workspaceCount: number;
    pinnedCount: number;
    primaryOrganization: string;
    primaryOwner: string;
  };
  workspaceAccountSummary: {
    accountName: string;
    planLabel: string;
    softQuotaLabel: string;
    scopeDetail: string;
  };
  organizations: OrganizationList;
  activeOrganizationId: string | null;
  onChangeOrganization: (id: string | null) => void;
  selectedProjectRecord: SavedProjectRecord | null;
  onSetShowOrgManager: () => void;
  onHide: () => void;
  onUpdateProjectMetadata: (sceneId: string, patch: Partial<Pick<SavedProjectRecord, "folder" | "tags" | "pinned" | "workspaceOrganization" | "workspaceOwner" | "workspaceVisibility" | "lastOpenedAt">>) => void;
  onDuplicateProject: (sceneId: string) => SavedProjectRecord | null;
  onRenameProject: (sceneId: string, nextName: string) => SavedProjectRecord | null;
  onSelectProject: (id: string | null) => void;
};

export function ProjectSettingsPanel({
  workspaceCatalog,
  workspaceAccountSummary,
  organizations,
  activeOrganizationId,
  onChangeOrganization,
  selectedProjectRecord,
  onSetShowOrgManager,
  onHide,
  onUpdateProjectMetadata,
  onDuplicateProject,
  onRenameProject,
  onSelectProject,
}: ProjectSettingsPanelProps) {
  return (
    <section className="rounded-[16px] border border-[color:var(--st-border)] bg-[color:var(--st-panel)] p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-sky-200">Project Settings</div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onSetShowOrgManager}
            className="rounded-lg border border-sky-400/25 bg-sky-500/10 px-2.5 py-1 text-[10px] font-medium text-sky-100 transition-colors hover:bg-sky-500/16"
          >
            Open workspace admin
          </button>
          <HideSectionButton
            label="project settings"
            onClick={onHide}
          />
        </div>
      </div>

      <div className="mt-3 rounded-[16px] border border-[color:var(--st-border)] bg-white/[0.02] p-3">
        <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[color:var(--st-muted)]">Workspace + account context</div>
        <div className="mt-2 space-y-2 text-[10px] text-[color:var(--st-muted)]">
          <div className="flex flex-wrap gap-1">
            <span className="rounded-full border border-white/10 bg-white/[0.05] px-2 py-1">Catalog: {workspaceCatalog.scopeLabel}</span>
            <span className="rounded-full border border-white/10 bg-white/[0.05] px-2 py-1">Workspace count: {workspaceCatalog.workspaceCount}</span>
            <span className="rounded-full border border-white/10 bg-white/[0.05] px-2 py-1">Pinned: {workspaceCatalog.pinnedCount}</span>
          </div>
          <div className="flex flex-wrap gap-1">
            <span className="rounded-full border border-white/10 bg-white/[0.05] px-2 py-1">Primary org: {workspaceCatalog.primaryOrganization}</span>
            <span className="rounded-full border border-white/10 bg-white/[0.05] px-2 py-1">Primary owner: {workspaceCatalog.primaryOwner}</span>
          </div>
          <div className="flex flex-wrap gap-1">
            <span className="rounded-full border border-white/10 bg-white/[0.05] px-2 py-1">Account: {workspaceAccountSummary.accountName}</span>
            <span className="rounded-full border border-white/10 bg-white/[0.05] px-2 py-1">Plan: {workspaceAccountSummary.planLabel}</span>
            <span className="rounded-full border border-white/10 bg-white/[0.05] px-2 py-1">Quota: {workspaceAccountSummary.softQuotaLabel}</span>
          </div>
          <div className="rounded-[12px] border border-white/10 bg-white/[0.03] px-2 py-1">
            <div className="text-[9px] uppercase tracking-[0.16em] text-[color:var(--st-muted)]">Policy scope</div>
            <div>{workspaceAccountSummary.scopeDetail}</div>
          </div>
        </div>
      </div>

      {organizations.length > 0 ? (
        <label className="mt-3 block">
          <span className="text-[10px] uppercase tracking-[0.2em] text-[color:var(--st-muted)]">Active organization</span>
          <select
            value={activeOrganizationId ?? ""}
            onChange={(event) => onChangeOrganization(event.target.value || null)}
            className="mt-1 w-full rounded-lg border border-[color:var(--st-border)] bg-white/[0.04] px-3 py-2 text-[11px] text-white outline-none transition-colors focus:border-sky-400/35"
          >
            <option value="" className="bg-[#0b0f17] text-white">Use workspace primary</option>
            {organizations.map((organization) => (
              <option key={organization.id} value={organization.id} className="bg-[#0b0f17] text-white">
                {organization.name}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      {selectedProjectRecord ? (
        <ProjectMetadataEditor
          project={selectedProjectRecord}
          onUpdateProjectMetadata={onUpdateProjectMetadata}
          onDuplicateProject={onDuplicateProject}
          onRenameProject={onRenameProject}
          onSelectProject={onSelectProject}
          organizations={organizations}
        />
      ) : (
        <div className="mt-3 rounded-[12px] border border-dashed border-[color:var(--st-border)] bg-white/[0.02] px-3 py-2 text-[10px] text-[color:var(--st-muted)]">
          No workspace selected. Open a Workspace from the library to edit project metadata.
        </div>
      )}
    </section>
  );
}
