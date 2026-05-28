import type { Recommendation, SecurityScene } from "@/schema/security-scene";
import type { StudioStoreState } from "@/store/studio-store";

type ActionStore = Pick<
  StudioStoreState,
  "selectNode" | "setViewMode" | "setWorkspacePreset" | "setBottomTab" | "scene" | "updateNode" | "saveSnapshot"
>;

export function focusIssueCamera(store: ActionStore, cameraId: string) {
  store.selectNode(cameraId);
  store.setWorkspacePreset("coverage");
  store.setViewMode("camera_view");
}

export function focusIssueZone(store: ActionStore, zoneId: string) {
  store.selectNode(zoneId);
  store.setWorkspacePreset("coverage");
  store.setViewMode("map");
}

export function patchFromRecommendation(rec: Recommendation): Record<string, unknown> | null {
  if (!rec.affectedNodeId) return null;
  if (rec.type === "rotate_camera") {
    const patch: Record<string, unknown> = {};
    if (rec.suggestedYawDeg != null) patch.yawDeg = rec.suggestedYawDeg;
    if (rec.suggestedPitchDeg != null) patch.pitchDeg = rec.suggestedPitchDeg;
    return Object.keys(patch).length > 0 ? patch : null;
  }
  if (rec.type === "move_object" && rec.suggestedPosition) return { position: rec.suggestedPosition };
  if (rec.type === "change_fov" && rec.suggestedPitchDeg != null) {
    return { fovHorizontalDeg: Math.max(15, Math.min(140, rec.suggestedPitchDeg)) };
  }
  return null;
}

export function findNodeById(scene: SecurityScene, nodeId: string) {
  const collections = [
    scene.cameras,
    scene.obstructions,
    scene.walls,
    scene.securityLights,
    scene.criticalZones,
    scene.paths,
    scene.doors,
    scene.windows,
    scene.privacyZones,
    scene.entryPoints,
  ];
  for (const list of collections) {
    const found = list.find((entry) => entry.id === nodeId);
    if (found) return found as Record<string, unknown>;
  }
  return null;
}

export function previewRecommendation(store: ActionStore, rec: Recommendation): Record<string, unknown> | null {
  if (!rec.affectedNodeId) return null;
  const patch = patchFromRecommendation(rec);
  if (!patch) return null;
  const target = findNodeById(store.scene, rec.affectedNodeId);
  if (!target) return null;
  const previous: Record<string, unknown> = {};
  for (const key of Object.keys(patch)) previous[key] = target[key];
  store.updateNode(rec.affectedNodeId, patch);
  store.selectNode(rec.affectedNodeId);
  return previous;
}

export function applyRecommendation(store: ActionStore, rec: Recommendation) {
  if (!rec.affectedNodeId) return;
  const patch = patchFromRecommendation(rec);
  if (!patch) return;
  store.updateNode(rec.affectedNodeId, patch);
  store.selectNode(rec.affectedNodeId);
}

