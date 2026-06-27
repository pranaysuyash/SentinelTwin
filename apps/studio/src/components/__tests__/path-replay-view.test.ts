import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const pathReplayPath = join(import.meta.dir, "../view/PathReplayView.tsx");

describe("PathReplayView", () => {
  test("follows the shared replay-follow state when enabled", () => {
    const source = readFileSync(pathReplayPath, "utf8");

    expect(source).toContain('const followActor = useStudioStore((s) => s.pathReplay.followActor);');
    expect(source).toContain('const setPathReplayPlaying = useStudioStore((s) => s.setPathReplayPlaying);');
    expect(source).toContain('const setPathReplayProgress = useStudioStore((s) => s.setPathReplayProgress);');
    expect(source).toContain('const setPathReplaySpeed = useStudioStore((s) => s.setPathReplaySpeed);');
    expect(source).toContain("const controlsRef = useRef<{ target: THREE.Vector3; update?: () => void } | null>(null);");
    expect(source).toContain("controlsRef.current.target.set(actorPosition[0], 0.6, actorPosition[1]);");
    expect(source).toContain("setPathReplayProgress(clampReplayProgress");
    expect(source).toContain("getPathReplayDurationS");
    expect(source).toContain("const estimatedTimeS = useMemo(() => clampPathDuration(activePath ? getPathReplayDurationS(activePath) : 0)");
    expect(source).toContain("const replayDurationS = clampPathDuration(replaySamples[replaySamples.length - 1]?.timeS ?? 0)");
    expect(source).toContain("setPathReplayPlaying(false);");
    expect(source).toContain("setPathReplaySpeed(nextSpeed);");
    expect(source).toContain("CoverageTileFloor");
    expect(source).toContain("ReplayCameraCones");
    expect(source).toContain("Collision guard");
    expect(source).toContain("Collision corrected");
    expect(source).toContain("Current state");
    expect(source).toContain("Current Visibility");
    expect(source).toContain("Visible now");
    expect(source).toContain("Lost now");
    expect(source).toContain("const replayCameraStateSummary = useMemo(() =>");
    expect(source).toContain("visibleNow: ReplayCameraStateSummary[]");
    expect(source).toContain("lostNow: ReplayCameraStateSummary[]");
    expect(source).toContain("Visible Now");
    expect(source).toContain("Incident Review");
    expect(source).toContain("Replay Focus Mode");
    expect(source).toContain("Press F to exit focus");
    expect(source).toContain("toggleActiveSurfaceFocus");
    expect(source).toContain("const toggleImmersiveMode = useCallback(() => {");
    expect(source).toContain("window.addEventListener(STUDIO_SHORTCUT_EVENTS.toggleActiveSurfaceFocus, toggleImmersiveMode);");
    expect(source).toContain("Focus");
    expect(source).toContain("--st-full-canvas-safe-top");
  });
});
