import React from "react";
import { useStudioStore } from "@/store/studio-store";
import { GitPullRequest, GitMerge, XCircle, CheckCircle2 } from "lucide-react";
import { SurfaceButton } from "@/components/shared/SurfaceButton";
import { UI_SURFACES } from "@/lib/studio-surface-tokens";
import type { SecurityScene } from "@/schema/security-scene";

type SceneCollectionKey =
  | "cameras"
  | "securityLights"
  | "obstructions"
  | "criticalZones"
  | "privacyZones"
  | "paths"
  | "sensors"
  | "entryPoints"
  | "doors"
  | "windows"
  | "walls";

type SceneCollectionDiff = {
  key: SceneCollectionKey;
  label: string;
  beforeCount: number;
  afterCount: number;
  added: string[];
  removed: string[];
  changed: string[];
};

function displayName(node: { id: string; name?: string; label?: string }) {
  return node.name ?? node.label ?? node.id;
}

function compareCollections<T extends { id: string; name?: string; label?: string }>(
  key: SceneCollectionKey,
  label: string,
  before: T[] | undefined,
  after: T[] | undefined,
): SceneCollectionDiff {
  const beforeItems = before ?? [];
  const afterItems = after ?? [];
  const beforeById = new Map(beforeItems.map((item) => [item.id, item] as const));
  const afterById = new Map(afterItems.map((item) => [item.id, item] as const));
  const added: string[] = [];
  const removed: string[] = [];
  const changed: string[] = [];

  for (const [id, item] of afterById.entries()) {
    const prev = beforeById.get(id);
    if (!prev) {
      added.push(displayName(item));
      continue;
    }
    if (JSON.stringify(prev) !== JSON.stringify(item)) {
      changed.push(displayName(item));
    }
  }

  for (const [id, item] of beforeById.entries()) {
    if (!afterById.has(id)) {
      removed.push(displayName(item));
    }
  }

  return {
    key,
    label,
    beforeCount: beforeItems.length,
    afterCount: afterItems.length,
    added: added.slice(0, 4),
    removed: removed.slice(0, 4),
    changed: changed.slice(0, 4),
  };
}

function summarizeSceneDiff(beforeScene: SecurityScene | null, afterScene: SecurityScene) {
  if (!beforeScene) {
    return {
      totalBefore: 0,
      totalAfter: afterScene.cameras.length + afterScene.securityLights.length + afterScene.obstructions.length + afterScene.criticalZones.length + afterScene.privacyZones.length + afterScene.paths.length + afterScene.sensors.length + afterScene.entryPoints.length + afterScene.doors.length + afterScene.windows.length + afterScene.walls.length,
      collections: [] as SceneCollectionDiff[],
      note: "Main branch scene is unavailable, so only the active branch snapshot can be summarized.",
    };
  }

  const collections = [
    compareCollections("cameras", "Cameras", beforeScene.cameras, afterScene.cameras),
    compareCollections("securityLights", "Lights", beforeScene.securityLights, afterScene.securityLights),
    compareCollections("obstructions", "Obstructions", beforeScene.obstructions, afterScene.obstructions),
    compareCollections("criticalZones", "Critical zones", beforeScene.criticalZones, afterScene.criticalZones),
    compareCollections("privacyZones", "Privacy zones", beforeScene.privacyZones, afterScene.privacyZones),
    compareCollections("paths", "Paths", beforeScene.paths, afterScene.paths),
    compareCollections("sensors", "Sensors", beforeScene.sensors, afterScene.sensors),
    compareCollections("entryPoints", "Entry points", beforeScene.entryPoints, afterScene.entryPoints),
    compareCollections("doors", "Doors", beforeScene.doors, afterScene.doors),
    compareCollections("windows", "Windows", beforeScene.windows, afterScene.windows),
    compareCollections("walls", "Walls", beforeScene.walls, afterScene.walls),
  ];

  return {
    totalBefore:
      beforeScene.cameras.length +
      beforeScene.securityLights.length +
      beforeScene.obstructions.length +
      beforeScene.criticalZones.length +
      beforeScene.privacyZones.length +
      beforeScene.paths.length +
      beforeScene.sensors.length +
      beforeScene.entryPoints.length +
      beforeScene.doors.length +
      beforeScene.windows.length +
      beforeScene.walls.length,
    totalAfter:
      afterScene.cameras.length +
      afterScene.securityLights.length +
      afterScene.obstructions.length +
      afterScene.criticalZones.length +
      afterScene.privacyZones.length +
      afterScene.paths.length +
      afterScene.sensors.length +
      afterScene.entryPoints.length +
      afterScene.doors.length +
      afterScene.windows.length +
      afterScene.walls.length,
    collections,
    note: null as string | null,
  };
}

export function GovernanceReviewPanel() {
  const { activeBranch, branchScenes, approveBranch, rejectBranch } = useStudioStore();

  const isMain = activeBranch === "main";
  const branchScene = branchScenes[activeBranch];
  const mainScene = branchScenes.main ?? null;
  const branchDiff = branchScene ? summarizeSceneDiff(mainScene, branchScene) : null;
  
  if (isMain) {
    return (
      <div className={`flex flex-col h-full UI_SURFACES.panel UI_SURFACES.textBody p-4 text-sm`}>
        <div className="flex flex-col items-center justify-center h-full opacity-60">
          <GitMerge className={`w-12 h-12 mb-4 UI_SURFACES.textMuted7`} />
          <p className="text-center">You are currently on the published <span className="font-mono text-white">main</span> branch.</p>
          <p className="text-center mt-2 text-xs">Switch to a draft branch to review changes.</p>
        </div>
      </div>
    );
  }

  if (!branchScene) {
    return (
      <div className="p-4 text-sm text-red-400">
        Branch scene not found.
      </div>
    );
  }

  return (
    <div className={`flex flex-col h-full UI_SURFACES.panel UI_SURFACES.textBody`}>
      <div className={`p-4 border-b UI_SURFACES.borderPanel`}>
        <h2 className="text-sm font-semibold text-white flex items-center gap-2">
          <GitPullRequest className="w-4 h-4 text-emerald-400" />
          Review Draft: {activeBranch}
        </h2>
        <p className={`text-xs UI_SURFACES.textMuted mt-1`}>
          Review the proposed changes in this branch before approving them to merge into the published main scene.
        </p>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <div className={`UI_SURFACES.card border UI_SURFACES.borderThin rounded-lg p-3`}>
          <h3 className={`text-xs font-semibold uppercase tracking-wider UI_SURFACES.textMuted mb-2`}>Branch Details</h3>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <span className={UI_SURFACES.textMuted}>Cameras:</span>
            <span className="text-white">{branchScene.cameras.length}</span>
            <span className={UI_SURFACES.textMuted}>Critical Zones:</span>
            <span className="text-white">{branchScene.criticalZones.length}</span>
            <span className={UI_SURFACES.textMuted}>Total Nodes:</span>
            <span className="text-white">
              {branchScene.cameras.length + branchScene.criticalZones.length + branchScene.walls.length + branchScene.securityLights.length + branchScene.obstructions.length}
            </span>
            <span className={UI_SURFACES.textMuted}>Source:</span>
            <span className="text-white">{branchScene.source}</span>
          </div>
        </div>

        <div className={`UI_SURFACES.card border UI_SURFACES.borderThin rounded-lg p-3`}>
          <div className="flex items-center justify-between gap-2">
            <h3 className={`text-xs font-semibold uppercase tracking-wider UI_SURFACES.textMuted`}>Change Summary</h3>
            <span className={`rounded border UI_SURFACES.borderPanel UI_SURFACES.panel px-2 py-0.5 text-[9px] uppercase tracking-[0.14em] UI_SURFACES.textMuted3`}>
              Compared with main
            </span>
          </div>
          {branchDiff ? (
            <div className="mt-3 space-y-3">
              <div className="grid grid-cols-3 gap-2 text-xs">
                <div className={`rounded-lg border UI_SURFACES.borderPanel UI_SURFACES.panel p-2`}>
                  <div className={`text-[9px] uppercase tracking-[0.12em] UI_SURFACES.textMuted`}>Before</div>
                  <div className="mt-1 text-white">{branchDiff.totalBefore} nodes</div>
                </div>
                <div className={`rounded-lg border UI_SURFACES.borderPanel UI_SURFACES.panel p-2`}>
                  <div className={`text-[9px] uppercase tracking-[0.12em] UI_SURFACES.textMuted`}>After</div>
                  <div className="mt-1 text-white">{branchDiff.totalAfter} nodes</div>
                </div>
                <div className={`rounded-lg border UI_SURFACES.borderPanel UI_SURFACES.panel p-2`}>
                  <div className={`text-[9px] uppercase tracking-[0.12em] UI_SURFACES.textMuted`}>Delta</div>
                  <div className="mt-1 text-white">{branchDiff.totalAfter - branchDiff.totalBefore >= 0 ? "+" : ""}{branchDiff.totalAfter - branchDiff.totalBefore} nodes</div>
                </div>
              </div>

              {branchDiff.note ? (
                <p className={`text-[10px] UI_SURFACES.textMuted3`}>{branchDiff.note}</p>
              ) : null}

              <div className="space-y-2">
                {branchDiff.collections.some((item) => item.beforeCount !== item.afterCount || item.added.length > 0 || item.removed.length > 0 || item.changed.length > 0) ? (
                  branchDiff.collections
                    .filter((item) => item.beforeCount !== item.afterCount || item.added.length > 0 || item.removed.length > 0 || item.changed.length > 0)
                    .map((item) => (
                      <div key={item.key} className={`rounded-lg border UI_SURFACES.borderPanel UI_SURFACES.panel p-2`}>
                        <div className="flex items-center justify-between gap-2">
                          <div className={`text-[10px] font-semibold uppercase tracking-wider UI_SURFACES.textMuted3`}>{item.label}</div>
                          <div className={`text-[9px] UI_SURFACES.textMuted`}>
                            {item.beforeCount} → {item.afterCount}
                          </div>
                        </div>
                        <div className="mt-2 grid gap-2 md:grid-cols-3">
                          <div>
                            <div className={`text-[9px] uppercase tracking-[0.12em] UI_SURFACES.textMuted`}>Added</div>
                            <div className={`mt-1 text-[10px] UI_SURFACES.textBody`}>
                              {item.added.length > 0 ? item.added.join(", ") : "None"}
                            </div>
                          </div>
                          <div>
                            <div className={`text-[9px] uppercase tracking-[0.12em] UI_SURFACES.textMuted`}>Changed</div>
                            <div className={`mt-1 text-[10px] UI_SURFACES.textBody`}>
                              {item.changed.length > 0 ? item.changed.join(", ") : "None"}
                            </div>
                          </div>
                          <div>
                            <div className={`text-[9px] uppercase tracking-[0.12em] UI_SURFACES.textMuted`}>Removed</div>
                            <div className={`mt-1 text-[10px] UI_SURFACES.textBody`}>
                              {item.removed.length > 0 ? item.removed.join(", ") : "None"}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))
                ) : (
                  <div className={`rounded-lg border border-dashed UI_SURFACES.borderPanel UI_SURFACES.panel px-3 py-3 text-[10px] UI_SURFACES.textMuted3`}>
                    No structural differences detected against main.
                  </div>
                )}
              </div>
            </div>
          ) : (
            <p className={`text-xs italic UI_SURFACES.textMuted`}>No branch snapshot is available to compare against main.</p>
          )}
        </div>
      </div>

      <div className={`p-4 border-t UI_SURFACES.borderPanel flex flex-col gap-2`}>
        <SurfaceButton 
          onClick={() => {
            const confirmed = window.confirm(`Approve and merge '${activeBranch}' into main?`);
            if (confirmed) approveBranch(activeBranch);
          }}
          className="w-full justify-center bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600/30 border-emerald-500/30"
        >
          <CheckCircle2 className="w-4 h-4" />
          Approve & Merge
        </SurfaceButton>
        
        <SurfaceButton 
          onClick={() => {
            const confirmed = window.confirm(`Reject and delete '${activeBranch}'? This cannot be undone.`);
            if (confirmed) rejectBranch(activeBranch);
          }}
          className="w-full justify-center text-red-400 hover:bg-red-900/20 hover:text-red-300"
        >
          <XCircle className="w-4 h-4" />
          Reject Draft
        </SurfaceButton>
      </div>
    </div>
  );
}
