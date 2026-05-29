import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const topBarPath = "./src/components/layout/TopBar.tsx";
const workspaceCanvasPath = "./src/components/workspace/WorkspaceCanvas.tsx";

describe("view settings entrypoints", () => {
  test("wires the top bar and canvas chrome to the view settings modal", () => {
    const topBarSource = readFileSync(topBarPath, "utf8");
    const canvasSource = readFileSync(workspaceCanvasPath, "utf8");

    expect(topBarSource).toContain("View Settings");
    expect(topBarSource).toContain("toggleViewSettingsOpen");
    expect(topBarSource).toContain("setAllZoneTargetTypes");
    expect(canvasSource).toContain('setCanvasMode("orbit_3d")');
    expect(canvasSource).toContain('setCanvasMode("topdown_2d")');
    expect(canvasSource).toContain("resetCanvasView");
    expect(canvasSource).toContain("toggleViewSettingsOpen");
    expect(canvasSource).toContain("visibleComponents.coverage_legend");
    expect(canvasSource).toContain('aria-label="Open View Settings"');
    expect(canvasSource).toContain('aria-label="Reset canvas view"');
    expect(canvasSource).toContain('aria-label="Switch to 3D orbit"');
    expect(canvasSource).toContain('aria-label="Switch to 2D top-down"');
    expect(topBarSource).toContain('data-testid="topbar-view-settings"');
    expect(topBarSource).toContain('data-testid="more-view-settings"');
    expect(readFileSync("./src/components/layout/ViewSettingsModal.tsx", "utf8")).toContain('data-testid="view-settings-modal"');
  });
});
