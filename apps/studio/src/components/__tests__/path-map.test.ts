import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const pathMapPath = "/Users/pranay/Projects/SentinelTwin/apps/studio/src/components/map/PathMap.tsx";

describe("PathMap", () => {
  test("uses scenario/path naming and replay action copy", () => {
    const source = readFileSync(pathMapPath, "utf8");

    expect(source).toContain("Path Map - Scenario / Path");
    expect(source).toContain("Route Visibility");
    expect(source).toContain("Open Path Replay");
    expect(source).toContain("Visibility State");
    expect(source).toContain("Best Camera");
    expect(source).toContain("Actor Position");
    expect(source).toContain("Upcoming Lost / Zone Event");
  });

  test("uses shared replay timeline utilities and no local duplicates", () => {
    const source = readFileSync(pathMapPath, "utf8");

    expect(source).toContain("@/components/view/camera-view-utils");
    expect(source).toContain("clampPathDuration");
    expect(source).toContain("clampReplayProgress");
    expect(source).toContain("findLatestTimelineEventAtOrBeforeTime");
    expect(source).toContain("findNextTimelineEventAfterTime");
    expect(source).toContain("sortTimelineEvents");
    expect(source).toContain("safeDurationS = useMemo(() => clampPathDuration(pathResult?.totalDurationS)");
    expect(source).toContain("safeReplayProgress = clampReplayProgress(pathReplay.progress)");
    expect(source).toContain("const currentTime = safeCurrentTime");
    expect(source).toContain("findLatestTimelineEventAtOrBeforeTime(timelineEvents, safeCurrentTime)");
    expect(source).not.toContain("function findLastAtOrBefore");
    expect(source).not.toContain("function findNextAfter");
  });
});
