import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const inspectorPath = "/Users/pranay/Projects/SentinelTwin/apps/studio/src/components/inspector/InspectorPanel.tsx";
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
    expect(panelSource).toContain("Aim at Zone");
    expect(panelSource).toContain("Duplicate");
  });

  test("wires the inspector view tab to the camera feed canvas", () => {
    const source = readFileSync(inspectorPath, "utf8");

    expect(source).toContain("CameraFeedCanvas");
    expect(source).toContain("<CameraFeedCanvas cameraId={camera.id} />");
  });

  test("includes failure simulation controls in the camera failures tab", () => {
    const source = readFileSync(inspectorPath, "utf8");

    expect(source).toContain('{ id: "failures", label: "Failures" }');
    expect(source).toContain("Simulate Failure");
    expect(source).toContain("Camera Offline");
    expect(source).toContain("Dirty / Blocked Lens");
    expect(source).toContain("Night Vision Disabled");
    expect(source).toContain("Failure active — re-run simulation to see impact");
    expect(source).toContain("Run simulation to populate failure impact analysis for this camera.");
  });

  test("uses a full-width dock shell so the right panel can expand with context", () => {
    const source = readFileSync(inspectorPath, "utf8");

    expect(source).toContain("flex h-full min-w-0 flex-1 flex-col overflow-hidden border-l border-[#1e2130] bg-[#0d1017]");
  });
});
