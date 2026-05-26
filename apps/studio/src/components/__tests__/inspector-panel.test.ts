import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const inspectorPath = "/Users/pranay/Projects/SentinelTwin/apps/studio/src/components/inspector/InspectorPanel.tsx";

describe("InspectorPanel", () => {
  test("defines an obstruction inspector and obstruction selection branch", () => {
    const source = readFileSync(inspectorPath, "utf8");

    expect(source).toContain("function ObstructionInspector()");
    expect(source).toContain('const obs = scene.obstructions.find((entry) => entry.id === selectedId);');
    expect(source).toContain("Test Without This Obstruction");
    expect(source).toContain("obstruction ? <ObstructionInspector /> : light ? <LightInspector /> : <NoSelection />");
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
});
