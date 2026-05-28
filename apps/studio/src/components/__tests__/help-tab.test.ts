import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

const helpTabPath = resolve(fileURLToPath(new URL(".", import.meta.url)), "../bottom-panel/HelpTab.tsx");

describe("Help tab", () => {
  test("surfaces workflow guidance and a real shortcut map", () => {
    const source = readFileSync(helpTabPath, "utf8");

    expect(source).toContain("Workflow Map");
    expect(source).toContain("Keyboard Shortcuts");
    expect(source).toContain("Mode Map");
    expect(source).toContain("Scene Actions");
    expect(source).toContain("Placement Tools");
    expect(source).toContain("Workspace Shortcuts");
    expect(source).toContain("New Scene");
    expect(source).toContain("Run Simulation");
    expect(source).toContain("Open / Import Scene");
    expect(source).toContain("Map / Coverage");
    expect(source).toContain("Camera View");
    expect(source).toContain("Camera Wall");
    expect(source).toContain("Path Replay");
    expect(source).toContain("Compare");
    expect(source).toContain("Report Lite");
    expect(source).toContain("Preview Fix");
    expect(source).toContain("Test Fix");
    expect(source).toContain("Apply Fix");
    expect(source).toContain("TOOL_SHORTCUTS");
    expect(source).toContain("VIEW_MODE_KEYS");
  });
});
