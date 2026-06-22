import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const studioShellPath = join(import.meta.dir, "../..", "components/layout/StudioShell.tsx");

describe("Studio shell launcher handoff", () => {
  test("surfaces launcher results after AI draft entry", () => {
    const source = readFileSync(studioShellPath, "utf8");

    expect(source).toContain("Launcher result:");
    expect(source).toContain("setLaunchNotice(null)");
    expect(source).toContain("window.setTimeout(() => setLaunchNotice(null), 8000)");
    expect(source).toContain("Dismiss");
  });

  test("defaults the right rail to security status until an object is selected", () => {
    const source = readFileSync(studioShellPath, "utf8");

    expect(source).toContain('if (!selectedNodeId && rightPanelMode === "inspector") return "security_status"');
    expect(source).toContain('if (selectedNodeId && rightPanelMode === "security_status")');
    expect(source).toContain('return "inspector"');
    expect(source).toContain('setRightPanelMode(effectiveRightPanelMode)');
  });

  test("keeps report mode in dock layout while replay, camera, and wall stay full-canvas", () => {
    const source = readFileSync(studioShellPath, "utf8");

    expect(source).toContain('const fullCanvasMode = viewMode === "camera_view" || viewMode === "wall" || viewMode === "replay";');
    expect(source).toContain("FULL_CANVAS_SAFE_ZONE_STYLE");
    expect(source).toContain("--st-full-canvas-safe-top");
    expect(source).toContain("style={fullCanvasMode ? FULL_CANVAS_SAFE_ZONE_STYLE : undefined}");
  });
});
