import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

const dir = resolve(fileURLToPath(new URL(".", import.meta.url)), "../inspector");
const inspectorPath = resolve(dir, "InspectorPanel.tsx");
const cameraInspectorPath = resolve(dir, "CameraInspector.tsx");
const obstructionInspectorPath = resolve(dir, "ObstructionInspector.tsx");
const lightInspectorPath = resolve(dir, "LightInspector.tsx");
const sensorInspectorPath = resolve(dir, "SensorInspector.tsx");
const controlsPath = resolve(dir, "inspector-controls.tsx");

describe("InspectorPanel", () => {
  test("defines an obstruction inspector and obstruction selection branch", () => {
    const panelSource = readFileSync(inspectorPath, "utf8");
    const obsSource = readFileSync(obstructionInspectorPath, "utf8");

    // Obstruction logic is now in its own file
    expect(obsSource).toContain("function ObstructionInspector()");
    expect(obsSource).toContain("const obs = scene.obstructions.find((entry) => entry.id === selectedId);");
    expect(obsSource).toContain("Test Without This Obstruction");

    // Router still has the selection branches
    expect(panelSource).toMatch(/camera\s*\?\s*\(\s*<CameraInspector \/>/);
    expect(panelSource).toMatch(/zone\s*\?\s*\(\s*<CriticalZoneInspector \/>/);
    expect(panelSource).toMatch(/obstruction\s*\?\s*\(\s*<ObstructionInspector \/>/);
    expect(panelSource).toMatch(/light\s*\?\s*\(\s*<LightInspector \/>/);
    expect(panelSource).toMatch(/sensor\s*\?\s*\(\s*<SensorInspector \/>/);
    // No-selection state now hosts the scene-level appearance editor.
    expect(panelSource).toMatch(/<SceneAppearancePanel \/>/);
  });

  test("renders editable camera placement and optics controls", () => {
    const panelSource = readFileSync(inspectorPath, "utf8");
    const cameraSource = readFileSync(cameraInspectorPath, "utf8");
    const controlsSource = readFileSync(controlsPath, "utf8");
    const lightSource = readFileSync(lightInspectorPath, "utf8");
    const sensorSource = readFileSync(sensorInspectorPath, "utf8");

    // Controls module still exports these
    expect(controlsSource).toContain("export function NumberInput(");
    expect(controlsSource).toContain("export function SliderInput(");

    // Camera controls are in CameraInspector
    expect(cameraSource).toContain('label="X"');
    expect(cameraSource).toContain('label="Y"');
    expect(cameraSource).toContain('label="Z"');
    expect(cameraSource).toContain('label="Yaw"');
    expect(cameraSource).toContain('label="Pitch"');
    expect(cameraSource).toContain("FOV (Horizontal)");
    expect(cameraSource).toContain("const updateHeight = (nextHeight: number) => {");
    expect(cameraSource).toContain("Mount Snap");
    expect(cameraSource).toContain("Ceiling");
    expect(cameraSource).toContain("Pole");
    expect(cameraSource).toContain("snapCameraToMount");
    expect(cameraSource).toContain("Aim at Zone");
    expect(cameraSource).toContain("Operational Fusion");
    expect(cameraSource).toContain("Sensor Fusion");

    // Duplicate button is in the router (multi-select banner)
    expect(panelSource).toContain("Duplicate");

    // Light inspector is in its own file
    expect(lightSource).toContain('SectionCard title="Night Impact"');
    expect(lightSource).toContain('label="Illuminates Night Coverage"');
    expect(lightSource).toContain("This light reduces night-mode penalty in the simulation");

    // Sensor inspector is in its own file
    expect(sensorSource).toContain("function SensorInspector()");
    expect(sensorSource).toContain("Sensor Type");
    expect(sensorSource).toContain("Coverage Mode");
    expect(sensorSource).toContain("Nearest Camera");
    expect(sensorSource).toContain("Delete Sensor");
  });

  test("wires the inspector view tab to the camera feed canvas", () => {
    const source = readFileSync(cameraInspectorPath, "utf8");

    expect(source).toContain("CameraFeedCanvas");
    expect(source).toContain('SectionCard title="View Mode"');
    expect(source).toContain('SectionCard title="Target Info"');
    expect(source).toContain('SectionCard title="Mount Snap"');
    expect(source).toContain("DORI Overlay (At Target)");
    expect(source).toContain("View Options");
    expect(source).toContain("Show DORI Labels");
    expect(source).toContain("Show Path Actor");
    expect(source).toContain("Show Bounding Box");
    expect(source).toContain('SectionCard title="Operational Fusion"');
    expect(source).toContain('SectionCard title="Sensor Fusion"');
    expect(source).toContain("Nearest sensor");
    expect(source).toContain("Health detail");
    expect(source).toContain("PPM est.");
    expect(source).toContain("Angle from center");
    expect(source).toContain("Placement Presets");
    expect(source).toContain("Camera Metadata Bridge");
    expect(source).toContain("Live Camera Binding");
    expect(source).toContain("Current session lease");
    expect(source).toContain("auth profile");
    expect(source).toContain("Transport ");
    expect(source).toContain("Auth ");
    expect(source).toContain("Challenge");
    expect(source).toContain("Apply Pasted Metadata");
    expect(source).toContain("Pull External Feed");
    expect(source).toContain("Ingest archive");
    expect(source).toContain("Connection archive");
    expect(source).toContain("Backend archive records for live camera probe, refresh, heartbeat, and disconnect actions.");
    expect(source).toContain("Bind Live Camera");
    expect(source).toContain("Refresh Session");
    expect(source).toContain("Heartbeat Session");
    expect(source).toContain("Clear Binding");
    expect(source).toContain("Best fit");
    expect(source).toContain("Pick a placement preset for the next camera");
    expect(source).toContain("snapCameraToMount");
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
    expect(source).toContain('setBottomTab("redundancy")');
    expect(source).toContain("updateCameraFailure");
  });

  test("uses a full-width dock shell so the right panel can expand with context", () => {
    const source = readFileSync(inspectorPath, "utf8");

    expect(source).toContain("flex h-full min-w-0 flex-1 flex-col overflow-hidden border-l ${UI_SURFACES.borderPanel} bg-[#0d1017]");
  });
});
