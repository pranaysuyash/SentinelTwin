"use client";

import type { SavedProjectRecord } from "@/store/studio-store";
import type { SecurityScene, SecurityIssue, SimulationResult } from "@/schema/security-scene";
import { Camera, FileUp, LayoutDashboard, MapIcon, Play, Plus, ScanSearch, Sparkles } from "lucide-react";
import { ScenePreview } from "@/components/launcher/ScenePreview";
import { HideSectionButton } from "@/components/launcher/HideSectionButton";

function formatTime(ts: number | null | undefined) {
  if (!ts) return "Never";
  return new Intl.DateTimeFormat("en-US", {
    hour12: true,
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(ts));
}

export interface QuickStartSectionProps {
  /** Whether the "workspaces" section is visible. */
  showWorkspaces: boolean;
  /** Whether the "recent" section is visible. */
  showRecent: boolean;
  /** Whether the "create" section is visible. */
  showCreate: boolean;
  /** Callbacks to hide sections. */
  onHideWorkspaces: () => void;
  onHideRecent: () => void;
  onHideCreate: () => void;

  onOpenCoverageWorkspace: () => void;
  onOpenCameraWall: () => void;
  onOpenPathReplay: () => void;
  onOpenCompareFixes: () => void;

  compactRecentProjects: SavedProjectRecord[];
  hydrated: boolean;
  scene: SecurityScene;
  coverage: number | null;
  result: SimulationResult | null;
  outcomeActivePathId: string | null;
  issues: SecurityIssue[];
  onOpenScene?: (scene: SecurityScene) => void;

  onCreateScene: () => void;
  onImportScene: () => void;
  onScanSite: () => void;
  onAiDraft: () => void;

  /** Render the SiteTwinSearchBar in the library slot. */
  showWorkspaceLibrary: boolean;
  librarySlot: React.ReactNode;
}

export function QuickStartSection({
  showWorkspaces,
  showRecent,
  showCreate,
  onHideWorkspaces,
  onHideRecent,
  onHideCreate,
  onOpenCoverageWorkspace,
  onOpenCameraWall,
  onOpenPathReplay,
  onOpenCompareFixes,
  compactRecentProjects,
  hydrated,
  scene,
  coverage,
  result,
  outcomeActivePathId,
  issues,
  onOpenScene,
  onCreateScene,
  onImportScene,
  onScanSite,
  onAiDraft,
  showWorkspaceLibrary,
  librarySlot,
}: QuickStartSectionProps) {
  return (
    <>
      {showWorkspaces ? (
        <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <div className="col-span-2 flex items-center justify-between lg:col-span-5">
            <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[color:var(--st-muted)]">Workspace shortcuts</div>
            <HideSectionButton label="workspace shortcuts" onClick={onHideWorkspaces} />
          </div>
          <button
            type="button"
            onClick={onOpenCoverageWorkspace}
            className="group flex items-center gap-3 rounded-[18px] border border-[color:var(--st-border)] bg-white/[0.03] px-4 py-3.5 text-left transition-[transform,border-color,background-color] hover:border-emerald-400/30 hover:bg-emerald-500/5"
          >
            <div className="flex h-9 w-9 flex-none items-center justify-center rounded-xl border border-emerald-400/25 bg-emerald-500/10">
              <MapIcon className="h-[18px] w-[18px] text-emerald-300" />
            </div>
            <div className="min-w-0">
              <div className="text-[13px] font-semibold text-white">Open Coverage Workspace</div>
              <div className="mt-0.5 text-[11px] text-[color:var(--st-muted)]">Map & full analysis</div>
            </div>
          </button>
          <button
            type="button"
            onClick={onOpenCameraWall}
            className="group flex items-center gap-3 rounded-[18px] border border-[color:var(--st-border)] bg-white/[0.03] px-4 py-3.5 text-left transition-[transform,border-color,background-color] hover:border-sky-400/30 hover:bg-sky-500/5"
          >
            <div className="flex h-9 w-9 flex-none items-center justify-center rounded-xl border border-sky-400/25 bg-sky-500/10">
              <Camera className="h-[18px] w-[18px] text-sky-300" />
            </div>
            <div className="min-w-0">
              <div className="text-[13px] font-semibold text-white">Open Camera Wall</div>
              <div className="mt-0.5 text-[11px] text-[color:var(--st-muted)]">Multi-camera view</div>
            </div>
          </button>
          <button
            type="button"
            onClick={onOpenPathReplay}
            className="group flex items-center gap-3 rounded-[18px] border border-[color:var(--st-border)] bg-white/[0.03] px-4 py-3.5 text-left transition-[transform,border-color,background-color] hover:border-violet-400/30 hover:bg-violet-500/5"
          >
            <div className="flex h-9 w-9 flex-none items-center justify-center rounded-xl border border-violet-400/25 bg-violet-500/10">
              <Play className="h-[18px] w-[18px] text-violet-300" />
            </div>
            <div className="min-w-0">
              <div className="text-[13px] font-semibold text-white">Open Path Replay</div>
              <div className="mt-0.5 text-[11px] text-[color:var(--st-muted)]">Route visibility over time</div>
            </div>
          </button>
          <button
            type="button"
            onClick={onOpenCompareFixes}
            className="group flex items-center gap-3 rounded-[18px] border border-[color:var(--st-border)] bg-white/[0.03] px-4 py-3.5 text-left transition-[transform,border-color,background-color] hover:border-amber-400/30 hover:bg-amber-500/5"
          >
            <div className="flex h-9 w-9 flex-none items-center justify-center rounded-xl border border-amber-400/25 bg-amber-500/10">
              <LayoutDashboard className="h-[18px] w-[18px] text-amber-300" />
            </div>
            <div className="min-w-0">
              <div className="text-[13px] font-semibold text-white">Compare Fixes</div>
              <div className="mt-0.5 text-[11px] text-[color:var(--st-muted)]">Before / after analysis</div>
            </div>
          </button>
        </div>
      ) : null}

      {showWorkspaceLibrary ? librarySlot : null}

      {(showRecent || showCreate) ? (
        <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]">
          {showRecent ? (
            <div className="rounded-[16px] border border-[color:var(--st-border)] bg-[color:var(--st-panel-2)] p-3">
              <div className="flex items-center justify-between gap-2">
                <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[color:var(--st-muted)]">RECENT WORKSPACES</div>
                <HideSectionButton label="recent site twins" onClick={onHideRecent} />
              </div>
              <div className="mt-2 grid grid-cols-4 gap-2">
                {compactRecentProjects.map((project) => {
                  const recentScene = project.scene;
                  const recentCoverage = hydrated
                    ? recentScene.simulation?.totalCoveragePct ?? (recentScene.id === scene.id ? coverage : null)
                    : null;
                  const recentIssues = hydrated
                    ? recentScene.simulation?.issues.length ?? (recentScene.id === scene.id ? issues.length : 0)
                    : 0;
                  return (
                    <button
                      key={recentScene.id}
                      type="button"
                      onClick={() => onOpenScene?.(recentScene)}
                      className="group rounded-[12px] border border-[color:var(--st-border)] bg-white/[0.02] p-2 text-left transition-colors hover:border-sky-400/25 hover:bg-white/[0.04]"
                    >
                      <div className="h-[72px] overflow-hidden rounded-lg border border-white/8 bg-[#08111d]">
                        <ScenePreview
                          scene={recentScene}
                          result={recentScene.simulation ?? (recentScene.id === scene.id ? result : null)}
                          activePathId={recentScene.id === scene.id ? outcomeActivePathId : null}
                          compact
                          showLabels={false}
                          hydrated={hydrated}
                        />
                      </div>
                      <div className="mt-1.5 truncate text-[11px] font-semibold text-white">{recentScene.name}</div>
                      <div className="mt-0.5 text-[10px] text-[color:var(--st-muted)]">
                        {recentCoverage != null ? `${Math.round(recentCoverage)}% coverage` : "Pending"}
                      </div>
                      <div className="text-[10px] text-[color:var(--st-muted)]">
                        {recentIssues} issues
                      </div>
                      <div suppressHydrationWarning className="mt-0.5 text-[9px] text-[color:var(--st-muted)]/70">
                        {formatTime(project.updatedAt)}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}

          {showCreate ? (
            <div className="rounded-[16px] border border-[color:var(--st-border)] bg-[color:var(--st-panel-2)] p-3">
              <div className="flex items-center justify-between gap-2">
                <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[color:var(--st-muted)]">QUICK START</div>
                <HideSectionButton label="create and import" onClick={onHideCreate} />
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2 lg:grid-cols-4">
                <button
                  type="button"
                  onClick={onCreateScene}
                  className="flex flex-col items-center gap-2 rounded-[12px] border border-[color:var(--st-border)] bg-white/[0.025] px-3 py-3 text-center transition-colors hover:border-sky-400/30 hover:bg-white/[0.04]"
                >
                  <Plus className="h-5 w-5 text-sky-300" />
                  <div>
                    <div className="text-[12px] font-semibold text-white">New Blank Scene</div>
                    <div className="mt-0.5 text-[10px] text-[color:var(--st-muted)]">Start from scratch</div>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={onImportScene}
                  className="flex flex-col items-center gap-2 rounded-[12px] border border-[color:var(--st-border)] bg-white/[0.025] px-3 py-3 text-center transition-colors hover:border-sky-400/30 hover:bg-white/[0.04]"
                >
                  <FileUp className="h-5 w-5 text-cyan-300" />
                  <div>
                    <div className="text-[12px] font-semibold text-white">Import Scene JSON</div>
                    <div className="mt-0.5 text-[10px] text-[color:var(--st-muted)]">From file</div>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={onScanSite}
                  className="flex flex-col items-center gap-2 rounded-[12px] border border-[color:var(--st-border)] bg-white/[0.025] px-3 py-3 text-center transition-colors hover:border-sky-400/30 hover:bg-white/[0.04]"
                >
                  <ScanSearch className="h-5 w-5 text-emerald-300" />
                  <div>
                    <div className="text-[12px] font-semibold text-white">Scan a Site</div>
                    <div className="mt-0.5 text-[10px] text-[color:var(--st-muted)]">Upload site photos</div>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={onAiDraft}
                  className="flex flex-col items-center gap-2 rounded-[12px] border border-[color:var(--st-border)] bg-white/[0.025] px-3 py-3 text-center transition-colors hover:border-violet-400/30 hover:bg-white/[0.04]"
                >
                  <Sparkles className="h-5 w-5 text-violet-300" />
                  <div>
                    <div className="text-[12px] font-semibold text-white">AI Layout Draft</div>
                    <div className="mt-0.5 text-[10px] text-[color:var(--st-muted)]">Generate layout</div>
                  </div>
                </button>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </>
  );
}
