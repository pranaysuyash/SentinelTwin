import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const pathReplayPath = "./src/components/view/PathReplayView.tsx";

describe("PathReplayView", () => {
  test("follows the shared replay-follow state when enabled", () => {
    const source = readFileSync(pathReplayPath, "utf8");

    expect(source).toContain('const followActor = useStudioStore((s) => s.pathReplay.followActor);');
    expect(source).toContain('const setPathReplayPlaying = useStudioStore((s) => s.setPathReplayPlaying);');
    expect(source).toContain('const setPathReplayProgress = useStudioStore((s) => s.setPathReplayProgress);');
    expect(source).toContain('const setPathReplaySpeed = useStudioStore((s) => s.setPathReplaySpeed);');
    expect(source).toContain("const controlsRef = useRef<{ target: THREE.Vector3; update?: () => void } | null>(null);");
    expect(source).toContain("controlsRef.current.target.set(actorPosition[0], 0.6, actorPosition[1]);");
    expect(source).toContain("setPathReplayProgress(totalDuration > 0 ? Math.min(nextTime / totalDuration, 1) : 0);");
    expect(source).toContain("setPathReplayPlaying(false);");
    expect(source).toContain("setPathReplaySpeed(nextSpeed);");
    expect(source).toContain("CoverageTileFloor");
    expect(source).toContain("ReplayCameraCones");
    expect(source).toContain("Collision guard");
    expect(source).toContain("Collision corrected");
    expect(source).toContain("Current state");
  });
});
