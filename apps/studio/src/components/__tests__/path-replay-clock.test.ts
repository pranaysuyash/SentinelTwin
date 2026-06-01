import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const pathReplayClockPath = join(import.meta.dir, "../layout/PathReplayClock.tsx");

describe("PathReplayClock", () => {
  test("uses shared clamp + duration helpers", () => {
    const source = readFileSync(pathReplayClockPath, "utf8");

    expect(source).toContain('import { clampPathDuration, getPathReplayDurationS } from "@/components/view/camera-view-utils";');
    expect(source).toContain("clampPathDuration(getPathReplayDurationS(activePath))");
    expect(source).toContain("const totalDurationS = useMemo(() => clampPathDuration(getPathReplayDurationS(activePath)), [activePath]);");
  });
});
