import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

const timelineTabPath = resolve(fileURLToPath(new URL(".", import.meta.url)), "../bottom-panel/TimelineTab.tsx");

describe("TimelineTab", () => {
  test("wires Follow to the shared replay-follow state", () => {
    const source = readFileSync(timelineTabPath, "utf8");

    expect(source).toContain('const pathReplayFollowActor = useStudioStore((s) => s.pathReplay.followActor);');
    expect(source).toContain('const setPathReplayFollowActor = useStudioStore((s) => s.setPathReplayFollowActor);');
    expect(source).toContain('onClick={() => setPathReplayFollowActor(!pathReplayFollowActor)}');
    expect(source).toContain("Follow Actor");
    expect(source).toContain("visibleCameraSummary");
    expect(source).toContain("No camera reach data available for this path.");
    expect(source).toContain("Replay Focus");
    expect(source).toContain("Lead Camera");
    expect(source).toContain("Coverage Reach");
    expect(source).toContain("Replay Status");
    expect(source).toContain("Current Event");
    expect(source).toContain("No timeline event has been recorded yet.");
    expect(source).toContain("highRiskEvents");
    expect(source).toContain("High-risk jumps");
    expect(source).toContain("No high-risk events detected for this path replay.");
  });

  test("surfaces the full quality ladder in the quality view", () => {
    const source = readFileSync(timelineTabPath, "utf8");

    expect(source).toContain("Quality Ladder");
    expect(source).toContain("IEC 62676-4:2025 OODPCVS");
    expect(source).toContain("QUALITY_ORDER.map");
  });

  test("does not run its own replay RAF clock", () => {
    const source = readFileSync(timelineTabPath, "utf8");

    expect(source).not.toContain("requestAnimationFrame(tick)");
    expect(source).not.toContain("playbackAnchorRef");
  });

  test("uses shared timeline duration and progress utilities", () => {
    const source = readFileSync(timelineTabPath, "utf8");

    expect(source).toContain("@/components/view/camera-view-utils");
    expect(source).toContain("clampPathDuration");
    expect(source).toContain("clampReplayProgress");
    expect(source).toContain("sortTimelineEvents");
    expect(source).toContain("findLatestTimelineEventAtOrBeforeTime");
    expect(source).toContain("safeReplayProgress");
    expect(source).toContain("totalDurationS");
    expect(source).toContain("const currentEvent = useMemo(() => {");
  });
});
