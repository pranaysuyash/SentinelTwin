import { simulateStudioAsync } from "@sentineltwin/simulation";

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
 *
 * Uses the async/yielding engine entry point so large scenes report
 * incremental progress (`{ type: "progress", fraction }`) back to the main
 * thread instead of blocking until the final result.
 */

self.onmessage = async (event: MessageEvent<SimulationRunPayload>) => {
  const { id, scene, includeTemporalProfile, currentTime } = event.data;
  try {
    const result = await simulateStudioAsync(scene, {
      currentTime,
      onProgress: (fraction) => {
        const progress: SimulationRunResponse = { id, type: "progress", fraction };
        self.postMessage(progress);
      },
    });
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
