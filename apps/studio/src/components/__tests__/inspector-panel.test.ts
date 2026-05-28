import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const inspectorPath = "/Users/pranay/Projects/SentinelTwin/apps/studio/src/components/inspector/InspectorPanel.tsx";
const cameraInspectorPath = "/Users/pranay/Projects/SentinelTwin/apps/studio/src/components/inspector/CameraInspector.tsx";
const controlsPath = "/Users/pranay/Projects/SentinelTwin/apps/studio/src/components/inspector/inspector-controls.tsx";

describe("InspectorPanel", () => {
  test("defines an obstruction inspector and obstruction selection branch", () => {
    const source = readFileSync(inspectorPath, "utf8");

    expect(source).toContain("function ObstructionInspector()");
    expect(source).toContain('const obs = scene.obstructions.find((entry) => entry.id === selectedId);');
    expect(source).toContain("Test Without This Obstruction");
    expect(source).toMatch(/camera\s*\?\s*<CameraInspector \/>/);
    expect(source).toMatch(/zone\s*\?\s*<CriticalZoneInspector \/>/);
    expect(source).toMatch(/obstruction\s*\?\s*<ObstructionInspector \/>/);
    expect(source).toMatch(/light\s*\?\s*<LightInspector \/>/);
    expect(source).toMatch(/:\s*<NoSelection \/>/);
  });

  test("renders editable camera placement and optics controls", () => {
    const panelSource = readFileSync(inspectorPath, "utf8");
    const controlsSource = readFileSync(controlsPath, "utf8");

    // Controls are now extracted to inspector-controls.tsx; InspectorPanel imports them
    expect(panelSource).toContain("inspector-controls");
    expect(controlsSource).toContain("export function NumberInput(");
    expect(controlsSource).toContain("export function SliderInput(");
    expect(panelSource).toContain('label="X"');
    expect(panelSource).toContain('label="Y"');
    expect(panelSource).toContain('label="Z"');
    expect(panelSource).toContain('label="Yaw"');
    expect(panelSource).toContain('label="Pitch"');
    expect(panelSource).toContain("FOV (Horizontal)");
    expect(panelSource).toContain("const updateHeight = (nextHeight: number) => {");
    expect(panelSource).toContain("Snap to Nearest Wall");
    expect(panelSource).toContain("nearestPointOnWall");
    expect(panelSource).toContain("Aim at Zone");
    expect(panelSource).toContain("Duplicate");
    expect(panelSource).toContain("Privacy Impact");
    expect(panelSource).toContain("This camera does not currently trigger privacy-specific issues");
  });

  test("wires the inspector view tab to the camera feed canvas", () => {
    const source = readFileSync(cameraInspectorPath, "utf8");

    expect(source).toContain("CameraFeedCanvas");
    expect(source).toContain('SectionCard title="View Mode"');
    expect(source).toContain('SectionCard title="Target Info"');
    expect(source).toContain("DORI Overlay (At Target)");
    expect(source).toContain("View Options");
    expect(source).toContain("Show DORI Labels");
    expect(source).toContain("Show Path Actor");
    expect(source).toContain("Show Bounding Box");
    expect(source).toContain("PPM est.");
    expect(source).toContain("Angle from center");
    expect(source).toContain("<CameraFeedCanvas cameraId={camera.id} overlayOptions={feedOverlayOptions} />");
  });

  test("includes failure simulation controls in the camera failures tab", () => {
    const source = readFileSync(cameraInspectorPath, "utf8");

    expect(source).toContain('{ id: "failures", label: "Failures" }');
    expect(source).toContain("Simulate Failure");
    expect(source).toContain("Camera Offline");
    expect(source).toContain("Dirty / Blocked Lens");
    expect(source).toContain("Night Vision Disabled");
    expect(source).toContain("Failure active — re-run simulation to see impact");
    expect(source).toContain("Run the shared simulation to populate failure impact analysis for this camera.");
    expect(source).toContain("runSimulation");
  });

  test("uses a full-width dock shell so the right panel can expand with context", () => {
    const source = readFileSync(inspectorPath, "utf8");

    expect(source).toContain("flex h-full min-w-0 flex-1 flex-col overflow-hidden border-l border-[#1e2130] bg-[#0d1017]");
  });
});
