"use client";

import { useMemo } from "react";
import { cn } from "@/lib/cn";
import { getDemoWorkspaceDetail, getDemoWorkspaceTitle } from "@/lib/workspace-catalog";
import { ScenePreview } from "@/components/launcher/ScenePreview";
import type { SavedProjectRecord } from "@/store/studio-store";
import type { SecurityScene, SimulationResult } from "@/schema/security-scene";

function coverageTone(pct: number) {
  if (pct >= 80) return "text-emerald-300";
  if (pct >= 60) return "text-amber-300";
  return "text-red-300";
}

const SOURCE_LABELS: Record<string, string> = {
  demo: "Reference Demo",
  user: "My Sites",
  remote: "Remote Connect",
  imported: "Imported",
  scanned: "Scanned Site",
};

type ProjectSourceFilter = "All" | SecurityScene["source"];

export type WorkspaceLibraryPanelProps = {
  scene: SecurityScene;
  result: SimulationResult | null;
  hydrated: boolean;
  activePathId: string | null;
  savedScenes: SecurityScene[];
  savedProjects: SavedProjectRecord[];
  visibleProjects?: SavedProjectRecord[];
  activeSource?: ProjectSourceFilter;
  onOpenStudio?: () => void;
  onOpenCoverageWorkspace?: () => void;
  onOpenReport?: () => void;
  onOpenScene?: (scene: SecurityScene) => void;
  onOpenDemoScene?: () => void;
  onCreateScene?: () => void;
  onImportFloorPlan?: () => void;
  onImportScene?: () => void;
  onScanSite?: () => void;
  onGuidedScanAssistant?: () => void;
  onAiDraft?: () => void;
  onUpdateProjectMetadata?: (sceneId: string, patch: Partial<Pick<SavedProjectRecord, "folder" | "tags" | "pinned" | "workspaceOrganization" | "workspaceOwner" | "workspaceVisibility" | "lastOpenedAt">>) => void;
  onDuplicateProject?: (sceneId: string) => void;
  onRenameProject?: (sceneId: string, nextName: string) => void;
  onSelectProject?: (id: string | null) => void;
};

export function WorkspaceLibraryPanel({
  scene,
  result,
  hydrated,
  activePathId,
  savedScenes,
  savedProjects,
  visibleProjects,
  activeSource = "All",
  onOpenStudio,
  onOpenCoverageWorkspace,
  onOpenReport,
  onOpenScene,
  onOpenDemoScene,
  onCreateScene,
  onImportFloorPlan,
  onImportScene,
  onScanSite,
  onGuidedScanAssistant,
  onAiDraft,
  onDuplicateProject,
  onRenameProject,
  onUpdateProjectMetadata,
}: WorkspaceLibraryPanelProps) {
  const projectRecords = (visibleProjects ?? savedProjects).slice(0, 8);
  const projects = projectRecords.length > 0
    ? projectRecords.map((entry) => entry.scene)
    : activeSource === "All"
      ? savedScenes.slice(0, 8)
      : [];
  const libraryTitle = activeSource === "demo" ? "Demo Site Twins" : "Project Site Twins";
  const libraryDescription = activeSource === "demo"
    ? "Reference scenarios used to guide real site design and to compare coverage thresholds and camera placements."
    : "Resume a project, compare saved site twins, or start a new intake path from the dashboard.";

  const openScene = (target: SecurityScene) => {
    onOpenScene?.(target);
    onOpenStudio?.();
  };

  return (
    <section className="mt-4 rounded-[24px] border border-[color:var(--st-border)] bg-[color:var(--st-panel)] p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="text-[11px] uppercase tracking-[0.2em] text-[color:var(--st-muted)]">{libraryTitle}</div>
          <div className="mt-1 text-xs text-[color:var(--st-muted)]">
            {libraryDescription}
          </div>
        </div>
        <div className="flex flex-wrap gap-2 text-[10px]">
          <button type="button" onClick={onCreateScene} className="rounded-full border border-sky-400/30 bg-sky-500/10 px-2.5 py-1 text-sky-100">Create Site Twin</button>
          <button type="button" onClick={onImportScene} className="rounded-full border border-white/15 bg-white/[0.03] px-2.5 py-1 text-white/90">Import Site Twin Data</button>
          <button type="button" onClick={onImportFloorPlan} className="rounded-full border border-white/15 bg-white/[0.03] px-2.5 py-1 text-white/90">Floor Plan</button>
          <button type="button" onClick={onScanSite} className="rounded-full border border-white/15 bg-white/[0.03] px-2.5 py-1 text-white/90">Scan Site</button>
          <button type="button" onClick={onGuidedScanAssistant} className="rounded-full border border-white/15 bg-white/[0.03] px-2.5 py-1 text-white/90">Guided Scan</button>
          <button type="button" onClick={onAiDraft} className="rounded-full border border-white/15 bg-white/[0.03] px-2.5 py-1 text-white/90">Layout Draft</button>
          <button type="button" onClick={onOpenCoverageWorkspace} className="rounded-full border border-emerald-400/25 bg-emerald-500/10 px-2.5 py-1 text-emerald-100">Open Coverage</button>
          <button type="button" onClick={onOpenReport} className="rounded-full border border-amber-400/25 bg-amber-500/10 px-2.5 py-1 text-amber-100">Open Report</button>
          <button type="button" onClick={onOpenDemoScene} className="rounded-full border border-violet-400/25 bg-violet-500/10 px-2.5 py-1 text-violet-100">Load Demo</button>
        </div>
      </div>

      <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-4">
        {projects.length > 0 ? (
          projects.map((projectScene, index) => {
            const coveragePct = projectScene.simulation?.totalCoveragePct ?? null;
            const issueCount = projectScene.simulation?.issues.length ?? 0;
            const displayTitle = getDemoWorkspaceTitle(projectScene, index);
            const displayDetail = getDemoWorkspaceDetail(
              projectScene,
              `${projectScene.cameras.length} cameras · ${projectScene.criticalZones.length} zones`,
              index,
            );
            return (
              <div key={projectScene.id} className="rounded-[16px] border border-[color:var(--st-border)] bg-white/[0.02] p-2">
                <button type="button" onClick={() => openScene(projectScene)} className="w-full text-left">
                  <div className="relative h-24 overflow-hidden rounded-lg border border-white/10 UI_SURFACES.bgDeep">
                    <ScenePreview
                      scene={projectScene}
                      result={projectScene.simulation ?? (projectScene.id === scene.id ? result : null)}
                      activePathId={projectScene.id === scene.id ? activePathId : null}
                      compact
                      showLabels={false}
                      hydrated={hydrated}
                    />
                    <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#050914] to-transparent px-2 py-1.5">
                      <div className="text-[9px] font-semibold uppercase tracking-[0.16em] text-sky-100">
                        {projectScene.source === "demo" ? "Reference Demo" : SOURCE_LABELS[projectScene.source]}
                      </div>
                    </div>
                  </div>
                  <div className="mt-2 flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate text-[12px] font-semibold text-white">{displayTitle}</div>
                      <div className="mt-0.5 line-clamp-2 text-[10px] leading-4 text-[color:var(--st-muted)]">{displayDetail}</div>
                    </div>
                    <span className={cn(
                      "flex-none rounded-md border px-1.5 py-0.5 text-[10px] font-bold",
                      coveragePct == null ? "border-slate-400/20 bg-slate-500/10 text-slate-200" : coverageTone(coveragePct),
                    )}>
                      {coveragePct != null ? `${Math.round(coveragePct)}%` : "Run"}
                    </span>
                  </div>
                  <div className="mt-2 grid grid-cols-3 gap-1 text-[9px] text-[color:var(--st-muted)]">
                    <span className="rounded border border-white/10 bg-white/[0.03] px-1.5 py-1">{projectScene.cameras.length} cams</span>
                    <span className="rounded border border-white/10 bg-white/[0.03] px-1.5 py-1">{projectScene.criticalZones.length} zones</span>
                    <span className="rounded border border-white/10 bg-white/[0.03] px-1.5 py-1">{issueCount} issues</span>
                  </div>
                </button>
                <div className="mt-2 flex flex-wrap gap-1 text-[9px]">
                  <button type="button" onClick={() => openScene(projectScene)} className="rounded border border-emerald-400/25 bg-emerald-500/10 px-1.5 py-0.5 text-emerald-100">Open Studio</button>
                  <button type="button" onClick={() => onRenameProject?.(projectScene.id, `${projectScene.name} Copy`)} className="rounded border border-white/15 px-1.5 py-0.5 text-white/80">Duplicate</button>
                  <button type="button" onClick={() => onDuplicateProject?.(projectScene.id)} className="rounded border border-white/15 px-1.5 py-0.5 text-white/80">Quick Rename</button>
                </div>
              </div>
            );
          })
        ) : (
          <div className="col-span-full rounded-[16px] border border-dashed border-[color:var(--st-border)] bg-white/[0.02] px-3 py-4 text-xs text-[color:var(--st-muted)]">
            No projects yet. Use Create Site Twin, Scan, Import, or Layout Draft to get started.
          </div>
        )}
      </div>
    </section>
  );
}