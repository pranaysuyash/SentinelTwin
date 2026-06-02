"use client";

import type { SavedProjectRecord } from "@/store/studio-store";
import type { SecurityScene } from "@/schema/security-scene";
import type { WorkspaceSearchHit } from "@/lib/workspace-search";
import type { BottomTab, TimelineFocusRequest, ViewMode, WorkspacePreset } from "@/store/studio-store";
import { Radar } from "lucide-react";
import { useState } from "react";

export interface SiteTwinSearchBarProps {
  workspaceMemoryQuery: string;
  setWorkspaceMemoryQuery: (value: string) => void;
  workspaceMemoryResults: WorkspaceSearchHit[];
  isArchiveLoading: boolean;
  hasArchiveLoadFailures: boolean;
  archiveLoadFailureCount: number;
  archiveLoadFailureSources: string[];
  archiveLoadLoadingSources: string[];
  setTimelineFocusRequest: (request: TimelineFocusRequest | null) => void;
  onOpenReport: () => void;
  onOpenMode: (viewMode: ViewMode, preset: WorkspacePreset, bottomTab?: BottomTab) => void;
  savedProjects: SavedProjectRecord[];
  onOpenScene?: (scene: SecurityScene) => void;
  onOpenStudio: () => void;
  scene: SecurityScene;
}

export function SiteTwinSearchBar({
  workspaceMemoryQuery,
  setWorkspaceMemoryQuery,
  workspaceMemoryResults,
  isArchiveLoading,
  hasArchiveLoadFailures,
  archiveLoadFailureCount,
  archiveLoadFailureSources,
  archiveLoadLoadingSources,
  setTimelineFocusRequest,
  onOpenReport,
  onOpenMode,
  savedProjects,
  onOpenScene,
  onOpenStudio,
  scene,
}: SiteTwinSearchBarProps) {
  const [expanded, setExpanded] = useState(false);
  const hasQuery = workspaceMemoryQuery.trim().length > 0;

  const openHit = (hit: WorkspaceSearchHit) => {
    if (hit.kind === "report") {
      onOpenReport();
      return;
    }

    if (hit.kind === "evidence" || hit.kind === "archive") {
      if (hit.routeTab) {
        onOpenMode("map", "coverage", hit.routeTab);
      } else {
        onOpenMode("map", "coverage", "timeline");
      }
      setTimelineFocusRequest({
        timestamp: hit.timestamp,
        query: workspaceMemoryQuery.trim() || hit.title,
        branchLabel: hit.branchLabel ?? null,
        eventId: hit.timelineEventId ?? null,
        source: "launcher",
      });
      return;
    }

    if (hit.kind === "workspace") {
      const target = savedProjects.find((project) => project.scene.id === hit.sceneId)?.scene
        ?? (hit.sceneId === scene.id ? scene : null);
      if (target) {
        onOpenScene?.(target);
      }
      onOpenStudio();
    }
  };

  return (
    <section className="mt-4 rounded-[16px] border border-[color:var(--st-border)] bg-[color:var(--st-panel-2)] p-2.5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] text-[color:var(--st-muted)]">
          <Radar className="h-3.5 w-3.5 text-sky-300" />
          SITE TWIN MEMORY SEARCH
        </div>
        <div className="flex flex-wrap items-center gap-1 text-[9px] text-[color:var(--st-muted)]">
          {isArchiveLoading ? (
            <span className="rounded-full border border-sky-400/25 bg-sky-500/10 px-2 py-0.5">
              Loading archive sources ({archiveLoadLoadingSources.join(", ")})
            </span>
          ) : null}
          {hasArchiveLoadFailures ? (
            <span className="rounded-full border border-amber-400/30 bg-amber-500/10 px-2 py-0.5 text-amber-100">
              {archiveLoadFailureCount} archive source(s) failed ({archiveLoadFailureSources.join(", ")})
            </span>
          ) : null}
        </div>
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          className="rounded-md border border-[color:var(--st-border)] bg-white/[0.03] px-2 py-1 text-[10px] text-[#c9d5eb] hover:border-sky-400/35 hover:text-white"
        >
          {expanded || hasQuery ? "Hide" : "Search"}
        </button>
      </div>
      {expanded || hasQuery ? (
        <div className="mt-2 space-y-1.5">
          <div className="rounded-lg border border-[color:var(--st-border)] bg-white/[0.03] px-2.5 py-2">
            <input
              value={workspaceMemoryQuery}
              onChange={(event) => setWorkspaceMemoryQuery(event.target.value)}
              placeholder="Search Site Twin history, evidence, archives, and reports..."
              className="w-full bg-transparent text-xs text-white placeholder:text-[color:var(--st-muted)] focus:outline-none"
            />
          </div>
          {workspaceMemoryResults.length > 0 ? workspaceMemoryResults.map((hit) => (
            <button
              key={hit.id}
              type="button"
              onClick={() => openHit(hit)}
              className="w-full rounded-xl border border-[color:var(--st-border)] bg-white/[0.02] px-3 py-2 text-left transition-colors hover:border-sky-400/30 hover:bg-white/[0.05]"
            >
              <div className="flex items-center gap-2">
                <span className="rounded-full border border-sky-400/30 bg-sky-500/10 px-2 py-0.5 text-[9px] uppercase tracking-[0.16em] text-sky-200">
                  {hit.kind}
                </span>
                <span className="truncate text-xs font-semibold text-white">{hit.title}</span>
              </div>
              <div className="mt-1 text-[10px] text-[color:var(--st-muted)]">{hit.summary}</div>
              <div className="mt-1 text-[10px] text-[#9db0cf]">{hit.targetSummary}</div>
            </button>
          )) : hasQuery ? (
            <div className="rounded-xl border border-dashed border-[color:var(--st-border)] px-3 py-2 text-[10px] text-[color:var(--st-muted)] space-y-1">
              No matching Site Twin memory found for this query.
              {isArchiveLoading ? (
                <div className="text-sky-100/85">
                  Archive sources are still loading. More matches may appear as each source resolves.
                </div>
              ) : null}
              {hasArchiveLoadFailures ? (
                <div className="text-amber-100/90">
                  Archive source errors are listed above. You can retry after checking workspace health.
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
