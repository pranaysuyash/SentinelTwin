import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const studioShellPath = "./src/components/layout/StudioShell.tsx";

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

    expect(source).toContain('if (!selectedNodeId && rightPanelMode === "inspector")');
    expect(source).toContain('setRightPanelMode("security_status")');
    expect(source).toContain('if (selectedNodeId && rightPanelMode === "security_status")');
    expect(source).toContain('setRightPanelMode("inspector")');
  });
});
