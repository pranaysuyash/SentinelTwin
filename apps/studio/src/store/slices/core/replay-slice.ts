import type { StateCreator } from "zustand";

// ─── Types ────────────────────────────────────────────────────────────────────

export type PathReplayState = {
  playing: boolean;
  progress: number;
  speed: number;
  followActor: boolean;
};

export type ReplaySlice = {
  pathReplay: PathReplayState;

  setPathReplayPlaying: (playing: boolean) => void;
  setPathReplayProgress: (progress: number) => void;
  setPathReplaySpeed: (speed: number) => void;
  setPathReplayFollowActor: (followActor: boolean) => void;
};

// ─── Replay slice creator ─────────────────────────────────────────────────────

export const createReplaySlice = (set: any, get: any): ReplaySlice => ({
  pathReplay: { playing: false, progress: 0, speed: 1, followActor: true },

  setPathReplayPlaying: (playing) => set((s: any) =>
    s.pathReplay.playing === playing ? s : { pathReplay: { ...s.pathReplay, playing } },
  ),

  setPathReplayProgress: (progress) => set((s: any) => {
    const nextProgress = Math.max(0, Math.min(1, progress));
    return Math.abs(s.pathReplay.progress - nextProgress) < 0.0005
      ? s
      : { pathReplay: { ...s.pathReplay, progress: nextProgress } };
  }),

  setPathReplaySpeed: (speed) => set((s: any) =>
    s.pathReplay.speed === speed ? s : { pathReplay: { ...s.pathReplay, speed } },
  ),

  setPathReplayFollowActor: (followActor) => set((s: any) =>
    s.pathReplay.followActor === followActor ? s : { pathReplay: { ...s.pathReplay, followActor } },
  ),
});
