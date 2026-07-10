"use client";

import { useState } from "react";

import { ChevronDown, Settings2 } from "lucide-react";

import { cn } from "@/lib/cn";
import { getSceneSourceMeta } from "@/lib/scene-source";
import type { SavedProjectRecord } from "@/store/studio-store";
import type { SecurityIssue } from "@/schema/security-scene";
import { useStudioStore } from "@/store/studio-store";
import type { OrganizationList } from "@/schema/organization";
import { UI_SURFACES } from "@/lib/studio-surface-tokens";

const SOURCE_LABELS: Record<string, string> = {
  manual: "Draft",
  ai: "Layout Draft",
  scan: "Scan",
  import: "Import",
  preset: "Preset",
  demo: "Reference",
};

const ISSUE_SEVERITY_ORDER: Record<SecurityIssue["severity"], number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

type WorkspaceVisibility = SavedProjectRecord["workspaceVisibility"];

function issueSeverityLabel(severity: SecurityIssue["severity"]) {
  switch (severity) {
    case "critical":
      return "Critical";
    case "high":
      return "High";
    case "medium":
      return "Medium";
    case "low":
    default:
      return "Low";
  }
}

function issueSeverityTone(severity: SecurityIssue["severity"]) {
  switch (severity) {
    case "critical":
      return "text-red-300";
    case "high":
      return "text-orange-300";
    case "medium":
      return "text-amber-300";
    default:
      return "text-sky-300";
  }
}

function sourceLabel(source: SavedProjectRecord["scene"]["source"]) {
  return SOURCE_LABELS[source] ?? getSceneSourceMeta(source).shortLabel;
}

function sourceBadgeTone(source: SavedProjectRecord["scene"]["source"]) {
  switch (source) {
    case "demo":
      return "border-emerald-400/20 bg-emerald-500/10 text-emerald-200";
    case "manual":
      return "border-amber-400/20 bg-amber-500/10 text-amber-100";
    case "scan":
      return "border-cyan-400/20 bg-cyan-500/10 text-cyan-200";
    case "import":
      return "border-sky-400/20 bg-sky-500/10 text-sky-200";
    case "ai":
      return "border-violet-400/20 bg-violet-500/10 text-violet-200";
    case "preset":
      return "border-indigo-400/20 bg-indigo-500/10 text-indigo-200";
    default:
      return "border-slate-400/20 bg-slate-500/10 text-slate-200";
  }
}

function issueSeveritySort(issues: SecurityIssue[]) {
  return [...issues].sort((a, b) => ISSUE_SEVERITY_ORDER[a.severity] - ISSUE_SEVERITY_ORDER[b.severity]);
}

function formatTime(ts: number | null | undefined) {
  if (!ts) return "Never";
  return new Intl.DateTimeFormat("en-US", {
    hour12: true,
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(ts));
}

function coverageTone(pct: number) {
  if (pct >= 80) return "text-emerald-300";
  if (pct >= 60) return "text-amber-300";
  return "text-red-300";
}

interface ProjectMetadataEditorProps {
  project: SavedProjectRecord;
  onUpdateProjectMetadata: (sceneId: string, patch: Partial<Pick<SavedProjectRecord, "folder" | "tags" | "pinned" | "workspaceOrganization" | "workspaceOwner" | "workspaceVisibility" | "lastOpenedAt">>) => void;
  onDuplicateProject: (sceneId: string) => SavedProjectRecord | null;
  onRenameProject: (sceneId: string, nextName: string) => SavedProjectRecord | null;
  onSelectProject: (sceneId: string) => void;
  organizations: OrganizationList;
}

export function ProjectMetadataEditor({
  project,
  onUpdateProjectMetadata,
  onDuplicateProject,
  onRenameProject,
  onSelectProject,
  organizations,
}: ProjectMetadataEditorProps) {
  const [folderDraft, setFolderDraft] = useState(project.folder);
  const [tagDraft, setTagDraft] = useState(project.tags.join(", "));
  const [organizationDraft, setOrganizationDraft] = useState(project.workspaceOrganization);
  const [ownerDraft, setOwnerDraft] = useState(project.workspaceOwner);
  const [visibilityDraft, setVisibilityDraft] = useState<WorkspaceVisibility>(project.workspaceVisibility);

  const applyFolderDraft = () => {
    onUpdateProjectMetadata(project.scene.id, { folder: folderDraft.trim() || "Unsorted" });
  };

  const applyTagDraft = () => {
    const tags = tagDraft
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean);
    onUpdateProjectMetadata(project.scene.id, { tags });
  };

  const togglePinned = () => {
    onUpdateProjectMetadata(project.scene.id, { pinned: !project.pinned });
  };

  const applyOrganizationDraft = (nextValue: string = organizationDraft) => {
    onUpdateProjectMetadata(project.scene.id, { workspaceOrganization: nextValue.trim() || "Personal Workspace" });
  };

  const applyOwnerDraft = () => {
    onUpdateProjectMetadata(project.scene.id, { workspaceOwner: ownerDraft.trim() || "You" });
  };

  const applyVisibilityDraft = (nextVisibility: WorkspaceVisibility) => {
    setVisibilityDraft(nextVisibility);
    onUpdateProjectMetadata(project.scene.id, { workspaceVisibility: nextVisibility });
  };

  const duplicateWorkspace = () => {
    const duplicate = onDuplicateProject(project.scene.id);
    if (duplicate) {
      onSelectProject(duplicate.scene.id);
    }
  };

  const renameWorkspace = () => {
    if (project.scene.source === "demo") return;
    const nextName = window.prompt("Rename workspace", project.scene.name);
    if (nextName == null) return;
    onRenameProject(project.scene.id, nextName);
  };

  const selectedProjectScene = project.scene;
  const selectedProjectCoverage = selectedProjectScene.simulation?.totalCoveragePct ?? null;
  const selectedProjectIssues = issueSeveritySort(selectedProjectScene.simulation?.issues ?? []);

  return (
    <div className="mt-4 rounded-[28px] border border-[color:var(--st-border)] bg-[color:var(--st-panel)] p-4">
      <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.22em] text-[color:var(--st-muted)]">
        <Settings2 className="h-3.5 w-3.5 text-sky-300" />
        Selected Workspace
      </div>
      <div className="mt-3 rounded-[22px] border border-[color:var(--st-border)] bg-white/[0.025] p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="truncate text-base font-semibold text-white">{selectedProjectScene.name}</div>
            <div className="mt-1 text-[11px] text-[color:var(--st-muted)]">
              {sourceLabel(selectedProjectScene.source)} · Last updated {formatTime(project.updatedAt)}
            </div>
            <div className="mt-2">
              <span
                className={cn(
                  "rounded-full border px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.18em]",
                  sourceBadgeTone(selectedProjectScene.source),
                )}
              >
                {selectedProjectScene.source === "demo"
                  ? "Reference baseline"
                  : selectedProjectScene.source === "manual"
                    ? "Draft Workspace"
                    : "Your Workspace"}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={togglePinned}
            className={cn(
              "rounded-full border px-3 py-1.5 text-[11px] font-medium transition-colors",
              project.pinned
                ? "border-amber-400/30 bg-amber-500/12 text-amber-100"
                : "border-[color:var(--st-border)] bg-white/[0.03] text-[color:var(--st-muted)] hover:bg-white/[0.05]",
            )}
          >
            {project.pinned ? "Unpin" : "Pin"}
          </button>
        </div>

        <div className="mt-3 flex flex-wrap gap-1.5">
          <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[10px] text-[color:var(--st-muted)]">Folder: {folderDraft}</span>
          <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[10px] text-[color:var(--st-muted)]">Org: {organizationDraft}</span>
          <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[10px] text-[color:var(--st-muted)]">Owner: {ownerDraft}</span>
          <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[10px] text-[color:var(--st-muted)]">{visibilityDraft}</span>
          {project.tags.length > 0 ? (
            project.tags.map((tag) => (
              <span key={tag} className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[10px] text-[color:var(--st-muted)]">#{tag}</span>
            ))
          ) : (
            <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[10px] text-[color:var(--st-muted)]">No tags</span>
          )}
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={duplicateWorkspace}
            className="rounded-full border border-[color:var(--st-border)] bg-white/[0.03] px-3 py-1.5 text-[11px] font-medium text-[color:var(--st-muted)] transition-colors hover:bg-white/[0.05] hover:text-white"
          >
            Duplicate Workspace
          </button>
          <button
            type="button"
            onClick={renameWorkspace}
            disabled={project.scene.source === "demo"}
            title={project.scene.source === "demo" ? "Duplicate the reference baseline first to rename it." : "Rename workspace"}
            className={cn(
              "rounded-full border px-3 py-1.5 text-[11px] font-medium transition-colors",
              project.scene.source === "demo"
                ? "border-[color:var(--st-border)] bg-white/[0.02] text-[color:var(--st-muted)] opacity-60"
                : "border-[color:var(--st-border)] bg-white/[0.03] text-[color:var(--st-muted)] hover:bg-white/[0.05] hover:text-white",
            )}
          >
            Rename Workspace
          </button>
        </div>
      </div>

      <div className="mt-4 rounded-[22px] border border-[color:var(--st-border)] bg-white/[0.025] p-4">
        <div className="text-[11px] uppercase tracking-[0.22em] text-[color:var(--st-muted)]">Project metadata</div>
        <div className="mt-3 space-y-3">
          <label className="block">
            <span className="text-[11px] text-[color:var(--st-muted)]">Folder</span>
            <input
              value={folderDraft}
              onChange={(event) => setFolderDraft(event.target.value)}
              onBlur={applyFolderDraft}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  applyFolderDraft();
                }
              }}
              className="mt-1 w-full rounded-2xl border border-[color:var(--st-border)] bg-white/[0.03] px-3 py-2 text-sm text-white outline-none transition-colors placeholder:text-[color:var(--st-muted)] focus:border-sky-400/35 focus:bg-white/[0.04]"
              placeholder="Unsorted"
            />
          </label>

          <label className="block">
            <span className="text-[11px] text-[color:var(--st-muted)]">Tags</span>
            <input
              value={tagDraft}
              onChange={(event) => setTagDraft(event.target.value)}
              onBlur={applyTagDraft}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  applyTagDraft();
                }
              }}
              className="mt-1 w-full rounded-2xl border border-[color:var(--st-border)] bg-white/[0.03] px-3 py-2 text-sm text-white outline-none transition-colors placeholder:text-[color:var(--st-muted)] focus:border-sky-400/35 focus:bg-white/[0.04]"
              placeholder="retail, client, north"
            />
          </label>

          <label className="block">
            <span className="text-[11px] text-[color:var(--st-muted)]">Organization</span>
            <div className="relative mt-1">
              <select
                value={organizationDraft}
                onChange={(event) => {
                  setOrganizationDraft(event.target.value);
                  applyOrganizationDraft(event.target.value);
                }}
                className="w-full appearance-none rounded-2xl border border-[color:var(--st-border)] bg-white/[0.03] px-3 py-2 pr-8 text-sm text-white outline-none transition-colors focus:border-sky-400/35 focus:bg-white/[0.04]"
              >
                {organizations?.length > 0 ? (
                  organizations.map((org) => (
                    <option key={org.id} value={org.name} className={`${UI_SURFACES.panel} text-white`}>
                      {org.name}
                    </option>
                  ))
                ) : (
                  <option value="Personal Workspace" className={`${UI_SURFACES.panel} text-white`}>Personal Workspace</option>
                )}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[color:var(--st-muted)]" />
            </div>
          </label>

          <label className="block">
            <span className="text-[11px] text-[color:var(--st-muted)]">Owner</span>
            <input
              value={ownerDraft}
              onChange={(event) => setOwnerDraft(event.target.value)}
              onBlur={applyOwnerDraft}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  applyOwnerDraft();
                }
              }}
              className="mt-1 w-full rounded-2xl border border-[color:var(--st-border)] bg-white/[0.03] px-3 py-2 text-sm text-white outline-none transition-colors placeholder:text-[color:var(--st-muted)] focus:border-sky-400/35 focus:bg-white/[0.04]"
              placeholder="You"
            />
          </label>

          <label className="block">
            <span className="text-[11px] text-[color:var(--st-muted)]">Visibility</span>
            <select
              value={visibilityDraft}
              onChange={(event) => applyVisibilityDraft(event.target.value as WorkspaceVisibility)}
              className="mt-1 w-full rounded-2xl border border-[color:var(--st-border)] bg-white/[0.03] px-3 py-2 text-sm text-white outline-none transition-colors focus:border-sky-400/35 focus:bg-white/[0.04]"
            >
              <option value="private">Private</option>
              <option value="shared">Shared</option>
              <option value="published">Published</option>
            </select>
          </label>
        </div>
      </div>
    </div>
  );
}
