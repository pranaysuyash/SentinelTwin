"use client";

import { useEffect, useMemo, useRef } from "react";
import { useStudioStore } from "@/store/studio-store";

const PATH_REPLAY_PROGRESS_PUBLISH_INTERVAL_MS = 1000 / 24;

function getPathReplayDurationS(path: { points: Array<{ position: [number, number] }>; speedMps?: number }) {
  if (path.points.length < 2) return 0;
  let distanceM = 0;
  for (let index = 1; index < path.points.length; index += 1) {
    const [x0, z0] = path.points[index - 1]!.position;
    const [x1, z1] = path.points[index]!.position;
    distanceM += Math.hypot(x1 - x0, z1 - z0);
  }
  return distanceM / Math.max(path.speedMps ?? 1.2, 0.01);
}

export default function PathReplayClock() {
  const paths = useStudioStore((s) => s.scene.paths);
  const activePathId = useStudioStore((s) => s.activePathId);
  const viewMode = useStudioStore((s) => s.viewMode);
  const playing = useStudioStore((s) => s.pathReplay.playing);
  const progress = useStudioStore((s) => s.pathReplay.progress);
  const speed = useStudioStore((s) => s.pathReplay.speed);
  const setPathReplayPlaying = useStudioStore((s) => s.setPathReplayPlaying);
  const setPathReplayProgress = useStudioStore((s) => s.setPathReplayProgress);
  const progressRef = useRef(progress);
  const speedRef = useRef(speed);

  const activePath = useMemo(
    () => (activePathId ? paths.find((path) => path.id === activePathId) ?? null : null),
    [activePathId, paths],
  );
  const totalDurationS = useMemo(() => (activePath ? getPathReplayDurationS(activePath) : 0), [activePath]);

  useEffect(() => {
    progressRef.current = progress;
  }, [progress]);

  useEffect(() => {
    speedRef.current = speed;
  }, [speed]);

  useEffect(() => {
    if (viewMode === "replay" || !playing || totalDurationS <= 0) return;

    let rafId = 0;
    let previousFrameAt = performance.now();
    let lastPublishedAt = previousFrameAt;

    const tick = (now: number) => {
      const elapsedS = Math.max(0, (now - previousFrameAt) / 1000);
      previousFrameAt = now;

      const nextProgress = Math.min(1, progressRef.current + (elapsedS * speedRef.current) / totalDurationS);
      progressRef.current = nextProgress;

      if (nextProgress >= 1) {
        setPathReplayProgress(0);
        setPathReplayPlaying(false);
        return;
      }

      if (now - lastPublishedAt >= PATH_REPLAY_PROGRESS_PUBLISH_INTERVAL_MS) {
        lastPublishedAt = now;
        setPathReplayProgress(nextProgress);
      }

      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [playing, setPathReplayPlaying, setPathReplayProgress, totalDurationS, viewMode]);

  useEffect(() => {
    if (activePath) return;
    if (playing) setPathReplayPlaying(false);
    if (progress !== 0) setPathReplayProgress(0);
  }, [activePath, playing, progress, setPathReplayPlaying, setPathReplayProgress]);

  return null;
}
