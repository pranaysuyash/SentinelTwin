import { simulateStudio } from "@sentineltwin/simulation";

import {
  computeTemporalProfileForResult,
  type SimulationRunPayload,
  type SimulationRunResponse,
} from "@/lib/simulation-run-core";

/**
 * Simulation Web Worker.
 *
 * Runs the deterministic coverage engine (and optionally the 24h temporal
 * profile) off the main thread so heavy recomputes never block the R3F canvas
 * or editor interactions. The engine package is worker-safe by design
 * (non-negotiable rule 3: zero React/DOM imports in the simulation layer).
 */

self.onmessage = (event: MessageEvent<SimulationRunPayload>) => {
  const { id, scene, includeTemporalProfile } = event.data;
  try {
    const result = simulateStudio(scene);
    const temporalProfile = includeTemporalProfile ? computeTemporalProfileForResult(scene, result) : null;
    const response: SimulationRunResponse = { id, ok: true, result, temporalProfile };
    self.postMessage(response);
  } catch (error) {
    const response: SimulationRunResponse = {
      id,
      ok: false,
      error: error instanceof Error ? error.message : "Simulation worker threw an unknown error.",
    };
    self.postMessage(response);
  }
};
