"use client";

import { useCallback, useEffect, useRef } from "react";

import { simulateStudio } from "@/simulation/simulate-studio";
import { useStudioStore } from "@/store/studio-store";

/**
 * Runs the simulation engine and stores the result.
 * Returns a `runSimulation` callback for manual triggering.
 */
export function useSimulation() {
  const scene             = useStudioStore((s) => s.scene);
  const simulationDirty   = useStudioStore((s) => s.simulationDirty);
  const simulationRunning = useStudioStore((s) => s.simulationRunning);
  const autoRecompute     = useStudioStore((s) => s.autoRecompute);
  const setRunning        = useStudioStore((s) => s.setSimulationRunning);
  const setResult         = useStudioStore((s) => s.setSimulationResult);

  const runSimulation = useCallback(() => {
    if (simulationRunning) return;
    setRunning(true);

    // Defer to let React paint the loading state before the heavy sync work.
    setTimeout(() => {
      try {
        const start = performance.now();
        const result = simulateStudio(scene);
        const durationMs = Math.round(performance.now() - start);
        setResult(result, durationMs);
      } catch (err) {
        console.error("[simulation] failed:", err);
        setRunning(false);
      }
    }, 30);
  }, [scene, simulationRunning, setRunning, setResult]);

  // Run on first mount.
  const didMount = useRef(false);
  useEffect(() => {
    if (!didMount.current) {
      didMount.current = true;
      runSimulation();
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-recompute when scene changes and flag is enabled.
  const prevDirtyRef = useRef(false);
  useEffect(() => {
    if (!didMount.current) return;
    if (autoRecompute && simulationDirty && !prevDirtyRef.current) {
      const timer = setTimeout(runSimulation, 400);
      return () => clearTimeout(timer);
    }
    prevDirtyRef.current = simulationDirty;
  }, [simulationDirty, autoRecompute, runSimulation]);

  return { runSimulation };
}
