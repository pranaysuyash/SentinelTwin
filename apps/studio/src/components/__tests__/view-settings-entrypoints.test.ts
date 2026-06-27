import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

const workspaceCanvasPath = resolve(fileURLToPath(new URL(".", import.meta.url)), "../", "workspace/WorkspaceCanvas.tsx");
const topBarPath = resolve(fileURLToPath(new URL(".", import.meta.url)), "../", "layout/TopBar.tsx");
const viewSettingsModalPath = resolve(fileURLToPath(new URL(".", import.meta.url)), "../", "layout/ViewSettingsModal.tsx");
const viewControlsPath = resolve(fileURLToPath(new URL(".", import.meta.url)), "../", "workspace/overlays/ViewControls.tsx");

describe("view settings entrypoints", () => {
  test("wires the top bar and canvas chrome to the view settings modal", () => {
    const topBarSource = readFileSync(topBarPath, "utf8");
    const canvasSource = readFileSync(workspaceCanvasPath, "utf8");
    const viewControlsSource = readFileSync(viewControlsPath, "utf8");

    expect(topBarSource).toContain("View Settings");
    expect(topBarSource).toContain("toggleViewSettingsOpen");
    expect(topBarSource).toContain("setAllZoneTargetTypes");
    // ViewControls is extracted to its own overlay file
    expect(viewControlsSource).toContain('setCanvasMode("orbit_3d")');
    expect(viewControlsSource).toContain('setCanvasMode("topdown_2d")');
    expect(viewControlsSource).toContain("resetCanvasView");
    expect(viewControlsSource).toContain("toggleViewSettingsOpen");
    expect(viewControlsSource).toContain('aria-label="Open View Settings"');
    expect(viewControlsSource).toContain('aria-label="Reset canvas view"');
    expect(viewControlsSource).toContain('aria-label="Switch to 3D orbit"');
    expect(viewControlsSource).toContain('aria-label="Switch to 2.5D top-down"');
    expect(viewControlsSource).toContain('aria-label="Switch to 2D plan"');
    // WorkspaceCanvas mounts ViewControls and the coverage legend
    expect(canvasSource).toContain("ViewControls");
    expect(canvasSource).toContain("visibleComponents.coverage_legend");
    expect(topBarSource).toContain('data-testid="topbar-view-settings"');
    expect(topBarSource).toContain('data-testid="more-view-settings"');
    expect(readFileSync(viewSettingsModalPath, "utf8")).toContain('data-testid="view-settings-modal"');
  });
});
