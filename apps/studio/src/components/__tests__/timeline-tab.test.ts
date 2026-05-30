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
  });

  test("surfaces the full quality ladder in the quality view", () => {
    const source = readFileSync(timelineTabPath, "utf8");

    expect(source).toContain("Quality Ladder");
    expect(source).toContain("IEC 62676-4:2025 OODPCVS");
    expect(source).toContain("QUALITY_ORDER.map");
  });
});
