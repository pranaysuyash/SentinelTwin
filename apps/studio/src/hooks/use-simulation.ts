"use client";

import { useEffect, useRef } from "react";

import { useStudioStore } from "@/store/studio-store";

/**
 * Runs the simulation engine and stores the result.
 * Returns a `runSimulation` callback for manual triggering.
 */
export function useSimulation() {
  const simulationDirty = useStudioStore((s) => s.simulationDirty);
  const autoRecompute = useStudioStore((s) => s.autoRecompute);
  const runSimulation = useStudioStore((s) => s.runSimulation);

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
