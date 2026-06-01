import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const visibilityTimelinePath = "/Users/pranay/Projects/SentinelTwin/apps/studio/src/components/view/VisibilityTimeline.tsx";

describe("VisibilityTimeline", () => {
  test("uses shared replay utilities and avoids local timeline duplication", () => {
    const source = readFileSync(visibilityTimelinePath, "utf8");

    expect(source).toContain("clampPathDuration");
    expect(source).toContain("orderCamerasForReplayPlayback");
    expect(source).toContain("sortTimelineEvents");
    expect(source).toContain("const timelineEvents = useMemo(() => {");
    expect(source).toContain("return sortTimelineEvents(pathResult.timeline);");
    expect(source).toContain("const totalDuration = useMemo(() => {");
    expect(source).toContain("const safeCurrentTime = useMemo(");
    expect(source).toContain("clampPathDuration(currentTime)");
    expect(source).toContain("const cameraRows = useMemo((): TimelineRow[] => {");
    expect(source).toContain("const safePct = Math.min(Math.max(pct, 0), 1)");
    expect(source).toContain("Math.max(0, Math.min(100, (row.camData.visibleS / totalDuration) * 100))");
    expect(source).toContain("const timelineEvents = useMemo(() => {");
    expect(source).not.toContain("function sortTimelineEvents");
    expect(source).not.toContain("function safeCurrentTime");
  });

  test("guards empty paths and no-data rendering contract", () => {
    const source = readFileSync(visibilityTimelinePath, "utf8");

    expect(source).toContain("const hasNoTimeline = !pathResult || totalDuration <= 0 || timelineEvents.length === 0 || cameraRows.length === 0;");
    expect(source).toContain("No visibility data available. Run simulation with a defined path.");
  });
});
