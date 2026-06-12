import type { SecurityScene, SimulationResult, TemporalSecurityProfile } from "@/schema/security-scene";
import { simulateStudioAsync } from "@sentineltwin/simulation";

import {
  computeTemporalProfileForResult,
  type SimulationRunPayload,
  type SimulationRunResponse,
} from "@/lib/simulation-run-core";

/**
 * Canonical simulation execution path for the studio app.
 *
 * Prefers a dedicated Web Worker so the deterministic engine (raycasting +
 * BVH + temporal profile) never blocks the main thread. Falls back to the
 * cooperative-yield main-thread path when workers are unavailable (SSR,
 * tests, or a worker bootstrap failure) so behavior stays deterministic
 * everywhere.
 *
 * All store entry points should run simulations through this module instead
 * of calling the engine directly — one execution pipeline, no parallel paths.
 */

export type SimulationExecutionPath = "worker" | "main_thread";

export interface SimulationRunOutput {
  result: SimulationResult;
  temporalProfile: TemporalSecurityProfile | null;
  executionPath: SimulationExecutionPath;
}

export interface SimulationRunOptions {
  /** Compute the 24h temporal profile in the same run (default true). */
  includeTemporalProfile?: boolean;
}

interface PendingRequest {
  resolve: (response: SimulationRunOutput) => void;
  reject: (error: Error) => void;
  includeTemporalProfile: boolean;
}

let worker: Worker | null = null;
let workerUnavailable = false;
let nextRequestId = 1;
const pendingRequests = new Map<number, PendingRequest>();

function failAllPending(reason: string) {
  for (const [, pending] of pendingRequests) {
    pending.reject(new Error(reason));
  }
  pendingRequests.clear();
}

function teardownWorker(reason: string) {
  workerUnavailable = true;
  if (worker) {
    worker.terminate();
    worker = null;
  }
  failAllPending(reason);
}

function getWorker(): Worker | null {
  if (workerUnavailable) return null;
  if (typeof window === "undefined" || typeof Worker === "undefined") return null;
  if (worker) return worker;

  try {
    worker = new Worker(new URL("../workers/simulation.worker.ts", import.meta.url), { type: "module" });
  } catch {
    workerUnavailable = true;
    return null;
  }

  worker.onmessage = (event: MessageEvent<SimulationRunResponse>) => {
    const response = event.data;
    const pending = pendingRequests.get(response.id);
    if (!pending) return;
    pendingRequests.delete(response.id);
    if (response.ok) {
      pending.resolve({
        result: response.result,
        temporalProfile: response.temporalProfile,
        executionPath: "worker",
      });
    } else {
      pending.reject(new Error(response.error));
    }
  };

  worker.onerror = () => {
    // A worker-level error (bootstrap/bundling) means the worker path is not
    // trustworthy in this environment; fall back permanently for the session.
    teardownWorker("Simulation worker failed; falling back to main thread.");
  };

  return worker;
}

function runInWorker(scene: SecurityScene, includeTemporalProfile: boolean): Promise<SimulationRunOutput> | null {
  const activeWorker = getWorker();
  if (!activeWorker) return null;

  const id = nextRequestId++;
  const payload: SimulationRunPayload = { id, scene, includeTemporalProfile };

  return new Promise<SimulationRunOutput>((resolve, reject) => {
    pendingRequests.set(id, { resolve, reject, includeTemporalProfile });
    try {
      activeWorker.postMessage(payload);
    } catch (error) {
      pendingRequests.delete(id);
      reject(error instanceof Error ? error : new Error("Failed to post scene to simulation worker."));
    }
  });
}

async function runOnMainThread(
  scene: SecurityScene,
  includeTemporalProfile: boolean,
): Promise<SimulationRunOutput> {
  const result = await simulateStudioAsync(scene, { yieldEvery: 50 });
  const temporalProfile = includeTemporalProfile ? computeTemporalProfileForResult(scene, result) : null;
  return { result, temporalProfile, executionPath: "main_thread" };
}

/** Run the deterministic studio simulation, preferring the Web Worker path. */
export async function runStudioSimulation(
  scene: SecurityScene,
  options: SimulationRunOptions = {},
): Promise<SimulationRunOutput> {
  const includeTemporalProfile = options.includeTemporalProfile ?? true;

  const workerRun = runInWorker(scene, includeTemporalProfile);
  if (workerRun) {
    try {
      return await workerRun;
    } catch (error) {
      console.warn("[simulation] worker run failed, retrying on main thread:", error);
    }
  }

  return runOnMainThread(scene, includeTemporalProfile);
}

/** Test-only hook: reset module state so worker availability is re-evaluated. */
export function __resetSimulationRunnerForTests() {
  teardownWorker("Simulation runner reset.");
  workerUnavailable = false;
  nextRequestId = 1;
}
