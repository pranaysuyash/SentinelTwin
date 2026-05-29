import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const panelPath = "./src/components/bottom-panel/ScenarioPathPanel.tsx";

describe("ScenarioPathPanel", () => {
  test("wires Play Path to replay mode and timeline", () => {
    const source = readFileSync(panelPath, "utf8");

    expect(source).toContain("function ScenarioPathPanel()");
    expect(source).toContain("const startReplay = () => {");
    expect(source).toContain('setWorkspacePreset("replay")');
    expect(source).toContain('setViewMode("replay")');
    expect(source).toContain('setBottomTab("timeline")');
    expect(source).toContain('setPathReplayPlaying(true)');
  });

  test("wires Edit Path to path tool in map mode", () => {
    const source = readFileSync(panelPath, "utf8");

    expect(source).toContain("const startPathEditing = () => {");
    expect(source).toContain('setWorkspacePreset("edit")');
    expect(source).toContain('setViewMode("map")');
    expect(source).toContain('setActiveTool("path")');
    expect(source).toContain("Edit Path");
    expect(source).toContain("Play Path");
  });

  test("exposes the active scenario label and visibility timeline link", () => {
    const source = readFileSync(panelPath, "utf8");

    expect(source).toContain("Active Path");
    expect(source).toContain("Route analysis surface");
    expect(source).toContain("Active Path");
    expect(source).toContain("Actor");
    expect(source).toContain("Path Length");
    expect(source).toContain("Est. Time");
    expect(source).toContain("Route Summary");
    expect(source).toContain("Path Visibility Timeline");
    expect(source).toContain("Edit Path");
    expect(source).toContain("Play Path");
    expect(source).toContain("replaceAll(\"_\", \" \")");
    expect(source).toContain('setBottomTab("timeline")');
    expect(source).toContain("No path selected");
    expect(source).toContain("No simulation yet");
    expect(source).toContain("Run Simulation");
  });
});
