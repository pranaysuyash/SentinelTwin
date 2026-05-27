import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const timelineTabPath = "/Users/pranay/Projects/SentinelTwin/apps/studio/src/components/bottom-panel/TimelineTab.tsx";

describe("TimelineTab", () => {
  test("wires Follow to the shared replay-follow state", () => {
    const source = readFileSync(timelineTabPath, "utf8");

    expect(source).toContain('const pathReplayFollowActor = useStudioStore((s) => s.pathReplay.followActor);');
    expect(source).toContain('const setPathReplayFollowActor = useStudioStore((s) => s.setPathReplayFollowActor);');
    expect(source).toContain('onClick={() => setPathReplayFollowActor(!pathReplayFollowActor)}');
    expect(source).toContain("Follow");
  });
});
