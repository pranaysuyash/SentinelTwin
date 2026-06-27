"use client";

import { useMemo } from "react";
import { useStudioStore } from "@/store/studio-store";
import { clampPathDuration, clampReplayProgress, getPathReplayDurationS } from "@/components/view/camera-view-utils";
import type { SimulationResult, ScenarioPath } from "@/schema/security-scene";

export interface ReplayClock {
  /** 0-1 progress along the active path. */
  progress: number;
  /** Total duration of the active path in seconds. */
  durationS: number;
  /** Current time in seconds along the path. */
  timeS: number;
  /** Whether the replay is currently playing. */
  playing: boolean;
  /** Whether the replay has any content to show. */
  hasContent: boolean;
  /** The active path node, or null. */
  activePath: ScenarioPath | null;
  /** The active path result, or null. */
  activePathResult: SimulationResult["pathResults"][number] | null;
}

/**
 * Shared replay clock hook. Reads the Zustand store and returns a stable
 * object with all the derived replay state a view component needs.
 * Eliminates the duplicated `clampReplayProgress` / `clampPathDuration`
 * calls across CameraViewMode, CameraWallView, and PathReplayView.
 */
export function useReplayClock(): ReplayClock {
  const pathReplay = useStudioStore((s) => s.pathReplay);
  const activePathId = useStudioStore((s) => s.activePathId);
  const scene = useStudioStore((s) => s.scene);
  const result = useStudioStore((s) => s.simulationResult);

  return useMemo(() => {
    const progress = clampReplayProgress(pathReplay.progress);
    const activePath = scene.paths.find((p) => p.id === activePathId) ?? null;
    const activePathResult = result?.pathResults.find((entry) => entry.pathId === activePathId) ?? null;
    const durationS = clampPathDuration(
      activePathResult?.totalDurationS ?? (activePath ? getPathReplayDurationS(activePath) : 0),
    );
    const timeS = durationS * progress;
    const hasContent = activePath !== null && durationS > 0 && (pathReplay.playing || progress > 0);

    return {
      progress,
      durationS,
      timeS,
      playing: pathReplay.playing,
      hasContent,
      activePath,
      activePathResult,
    };
  }, [
    pathReplay.progress,
    pathReplay.playing,
    activePathId,
    scene.paths,
    result?.pathResults,
  ]);
}
