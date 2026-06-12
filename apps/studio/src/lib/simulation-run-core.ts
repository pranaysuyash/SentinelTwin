import type { SecurityScene, SimulationResult, TemporalSecurityProfile } from "@/schema/security-scene";
import { cloneSecurityScene } from "@/schema/security-scene";
import { computeTemporalProfile } from "@sentineltwin/simulation";

/**
 * Shared pure helpers for simulation execution. This module is imported by both
 * the Web Worker harness and the main-thread fallback, so it must stay free of
 * React, DOM, store, and Worker references.
 */

export interface SimulationRunPayload {
  id: number;
  scene: SecurityScene;
  includeTemporalProfile: boolean;
}

export type SimulationRunResponse =
  | { id: number; ok: true; result: SimulationResult; temporalProfile: TemporalSecurityProfile | null }
  | { id: number; ok: false; error: string };

/**
 * Computes the 24h temporal profile for a scene using a fresh simulation
 * result, mirroring how the store stamps the result onto the scene before
 * deriving the profile.
 */
export function computeTemporalProfileForResult(
  scene: SecurityScene,
  result: SimulationResult,
): TemporalSecurityProfile {
  const patched = cloneSecurityScene(scene);
  patched.previousSimulation = scene.simulation;
  patched.simulation = result;
  return computeTemporalProfile(patched as never) as TemporalSecurityProfile;
}
