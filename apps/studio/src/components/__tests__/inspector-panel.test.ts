import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const inspectorPath = "/Users/pranay/Projects/SentinelTwin/apps/studio/src/components/inspector/InspectorPanel.tsx";

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
    const source = readFileSync(inspectorPath, "utf8");

    expect(source).toContain("function NumberInput(");
    expect(source).toContain("function SliderInput(");
    expect(source).toContain('label="X"');
    expect(source).toContain('label="Y"');
    expect(source).toContain('label="Z"');
    expect(source).toContain('label="Yaw"');
    expect(source).toContain('label="Pitch"');
    expect(source).toContain("FOV (Horizontal)");
    expect(source).toContain("const updateHeight = (nextHeight: number) => {");
    expect(source).toContain("Aim at Zone");
    expect(source).toContain("Duplicate");
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
