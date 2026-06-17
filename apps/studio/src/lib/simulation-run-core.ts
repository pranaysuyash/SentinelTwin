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
  /**
   * Optional caller-supplied current time for the coverage evaluator.
   * Forwarded to the simulation engine so the same scene at different hours
   * yields different coverage when `scene.timeSchedule.location` is set.
   * Defaults to `{ hour: 12, minute: 0 }` (noon) at the engine when omitted.
   */
  currentTime?: { hour: number; minute: number };
}

export type SimulationRunResponse =
  | { id: number; ok: true; result: SimulationResult; temporalProfile: TemporalSecurityProfile | null }
  | { id: number; ok: false; error: string }
  | { id: number; type: "progress"; fraction: number };

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
