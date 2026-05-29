import type { SecurityScene } from "@/schema/security-scene";
import type { StudioStoreState } from "@/store/studio-store";
import { buildSecurityOutcomeModel } from "./security-outcome-model";

export function selectActivePath(scene: SecurityScene, activePathId: string | null) {
  if (scene.paths.length === 0) return null;
  return scene.paths.find((path) => path.id === activePathId) ?? null;
}

export function selectSecurityOutcomeFromStore(state: Pick<StudioStoreState, "scene" | "simulationResult" | "activePathId">) {
  const activePath = selectActivePath(state.scene, state.activePathId);
  return buildSecurityOutcomeModel(state.scene, state.simulationResult, activePath);
}
