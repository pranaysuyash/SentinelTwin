import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { normalizeWorkspaceAccessState, type WorkspaceAccessState } from "@/lib/workspace-access";
import { normalizeWorkspaceGovernance, type WorkspaceGovernanceState } from "@/lib/workspace-governance";
import { normalizeWorkspaceAccountProfile, type WorkspaceAccountProfile } from "@/lib/workspace-catalog";

export type WorkspaceControlPlaneSnapshot = {
  id: string;
  sceneId: string;
  sceneName: string;
  source: string;
  capturedAt: number;
  access: WorkspaceAccessState;
  governance: WorkspaceGovernanceState;
  account: WorkspaceAccountProfile;
};

const CONTROL_PLANE_FILE = "workspace-control-plane-history.json";

function resolveRoot() {
  const overrideRoot = process.env.SENTINELTWIN_WORKSPACE_CONTROL_PLANE_STORE_DIR?.trim();
  if (overrideRoot) return overrideRoot;

  const cwd = process.cwd();
  if (existsSync(join(cwd, "src", "lib", "workspace-control-plane-history.ts"))) return cwd;

  const studioRoot = join(cwd, "apps", "studio");
  if (existsSync(join(studioRoot, "src", "lib", "workspace-control-plane-history.ts"))) return studioRoot;

  return cwd;
}

function resolveHistoryPath(rootDir = resolveRoot()) {
  return join(rootDir, ".workspace-control-plane", CONTROL_PLANE_FILE);
}

export function loadWorkspaceControlPlaneHistory(rootDir = resolveRoot()): WorkspaceControlPlaneSnapshot[] {
  try {
    const filePath = resolveHistoryPath(rootDir);
    if (!existsSync(filePath)) return [];
    const parsed = JSON.parse(readFileSync(filePath, "utf8"));
    if (!Array.isArray(parsed)) return [];

    return parsed.flatMap((item) => {
      if (!item || typeof item !== "object") return [];
      const candidate = item as Partial<WorkspaceControlPlaneSnapshot>;
      if (
        typeof candidate.id !== "string"
        || typeof candidate.sceneId !== "string"
        || typeof candidate.sceneName !== "string"
        || typeof candidate.source !== "string"
        || typeof candidate.capturedAt !== "number"
      ) {
        return [];
      }

      return [{
        id: candidate.id,
        sceneId: candidate.sceneId,
        sceneName: candidate.sceneName,
        source: candidate.source,
        capturedAt: candidate.capturedAt,
        access: normalizeWorkspaceAccessState(candidate.access),
        governance: normalizeWorkspaceGovernance(candidate.governance),
        account: normalizeWorkspaceAccountProfile(candidate.account),
      } satisfies WorkspaceControlPlaneSnapshot];
    }).sort((a, b) => b.capturedAt - a.capturedAt).slice(0, 40);
  } catch {
    return [];
  }
}

export function appendWorkspaceControlPlaneSnapshot(snapshot: WorkspaceControlPlaneSnapshot, rootDir = resolveRoot()) {
  const nextHistory = [snapshot, ...loadWorkspaceControlPlaneHistory(rootDir)].slice(0, 40);
  const filePath = resolveHistoryPath(rootDir);
  mkdirSync(join(rootDir, ".workspace-control-plane"), { recursive: true });
  writeFileSync(filePath, JSON.stringify(nextHistory, null, 2));
  return nextHistory;
}
