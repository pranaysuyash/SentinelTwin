import { describe, expect, test } from "bun:test";

import {
  compileScanSessionToScene,
  createScanCandidate,
  createScanSession,
} from "@/lib/scan-to-scene";
import { safeParseSecurityScene } from "@/schema/security-scene";

describe("scan-to-scene", () => {
  test("creates valid scene from door + camera + obstruction + counter + light markers", () => {
    const session = createScanSession("Manual Assisted Scan", 12, 9, 3.2);
    session.imageDataUrl = "data:image/svg+xml;base64,PHN2Zy8+";
    session.imageName = "site.svg";
    session.candidates = [
      { ...createScanCandidate("camera", [0.18, 0.2], 0), label: "Entrance Camera", confidence: 0.84 },
      { ...createScanCandidate("counter", [0.58, 0.62], 1), label: "Cash Counter", confidence: 0.91 },
      { ...createScanCandidate("door", [0.5, 0.05], 2), label: "Front Door", confidence: 0.79 },
      { ...createScanCandidate("critical_zone", [0.61, 0.66], 3), label: "Counter Zone", confidence: 0.76 },
      { ...createScanCandidate("light", [0.74, 0.18], 4), label: "Ceiling Light", confidence: 0.88 },
    ];

    const { scene, provenance } = compileScanSessionToScene(session);
    expect(scene.source).toBe("scan");
    expect(scene.walls).toHaveLength(4);
    expect(scene.cameras).toHaveLength(1);
    expect(scene.securityLights).toHaveLength(1);
    expect(scene.obstructions).toHaveLength(1);
    expect(scene.doors).toHaveLength(1);
    expect(scene.entryPoints.length).toBeGreaterThan(0);
    expect(scene.criticalZones).toHaveLength(1);
    expect(scene.cameras[0]?.source).toBe("scan");
    expect(scene.cameras[0]?.mountType).toBe("wall");
    expect(scene.cameras[0]?.yawDeg).toBeGreaterThan(45);
    expect(scene.cameras[0]?.yawDeg).toBeLessThan(75);
    expect(scene.securityLights[0]?.glareRisk).toBe("low");
    expect(provenance.source).toBe("scan");
    expect(provenance.acceptedCandidates).toBe(5);
    expect(safeParseSecurityScene(scene).success).toBe(true);
  });

  test("creates fallback rectangular room when no wall markers exist", () => {
    const session = createScanSession("No Walls", 8, 6, 3);
    session.imageDataUrl = "data:image/png;base64,AA==";
    session.imageName = "nowalls.png";
    session.candidates = [
      createScanCandidate("camera", [0.2, 0.2], 0),
      createScanCandidate("critical_zone", [0.6, 0.6], 1),
    ];
    const { scene } = compileScanSessionToScene(session);
    expect(scene.walls).toHaveLength(4);
    expect(scene.dimensions).toEqual({ width: 8, depth: 6, height: 3 });
  });

  test("creates path from explicit path points", () => {
    const session = createScanSession("Path Markers", 10, 8, 3);
    session.imageDataUrl = "data:image/png;base64,AA==";
    session.imageName = "path.png";
    session.candidates = [
      createScanCandidate("door", [0.5, 0.05], 0),
      createScanCandidate("camera", [0.1, 0.2], 1),
      createScanCandidate("critical_zone", [0.7, 0.7], 2),
      createScanCandidate("path_point", [0.5, 0.08], 3),
      createScanCandidate("path_point", [0.62, 0.32], 4),
      createScanCandidate("path_point", [0.7, 0.66], 5),
    ];
    const { scene, warnings } = compileScanSessionToScene(session);
    expect(scene.paths).toHaveLength(1);
    expect(scene.paths[0]?.points.length).toBeGreaterThanOrEqual(2);
    expect(warnings.some((warning) => warning.code === "NO_PATH")).toBe(false);
  });

  test("auto-creates entry-to-zone path when requested", () => {
    const session = createScanSession("Auto Path", 10, 8, 3);
    session.imageDataUrl = "data:image/png;base64,AA==";
    session.imageName = "autopath.png";
    session.candidates = [
      createScanCandidate("door", [0.5, 0.05], 0),
      createScanCandidate("camera", [0.2, 0.2], 1),
      createScanCandidate("critical_zone", [0.7, 0.7], 2),
    ];
    expect(compileScanSessionToScene(session).scene.paths).toHaveLength(0);
    expect(compileScanSessionToScene(session, { autoCreateEntryToZonePath: true }).scene.paths).toHaveLength(1);
  });

  test("emits warnings for missing camera and critical zone", () => {
    const session = createScanSession("Warning Case", 10, 8, 3);
    session.imageDataUrl = "data:image/png;base64,AA==";
    session.imageName = "warnings.png";
    session.candidates = [createScanCandidate("door", [0.5, 0.05], 0)];

    const { warnings } = compileScanSessionToScene(session);
    expect(warnings.some((warning) => warning.code === "NO_CAMERA")).toBe(true);
    expect(warnings.some((warning) => warning.code === "NO_CRITICAL_ZONE")).toBe(true);
  });

  test("warns when no wall markers are present and falls back to the room shell", () => {
    const session = createScanSession("Fallback Walls", 11, 7, 3);
    session.imageDataUrl = "data:image/png;base64,AA==";
    session.imageName = "fallback.png";
    session.candidates = [
      createScanCandidate("camera", [0.2, 0.2], 0),
      createScanCandidate("critical_zone", [0.7, 0.7], 1),
    ];

    const { scene, warnings } = compileScanSessionToScene(session);
    expect(scene.walls).toHaveLength(4);
    expect(warnings.some((warning) => warning.code === "NO_WALL")).toBe(true);
  });

  test("uses dimension hints for obstruction candidates", () => {
    const session = createScanSession("Dim Hints", 10, 8, 3);
    session.imageDataUrl = "data:image/png;base64,AA==";
    session.imageName = "dimhints.png";
    session.candidates = [
      { ...createScanCandidate("obstruction", [0.5, 0.5], 0), widthHintM: 2.5, depthHintM: 0.9, heightHintM: 1.8 },
      { ...createScanCandidate("camera", [0.2, 0.2], 1) },
      { ...createScanCandidate("critical_zone", [0.7, 0.7], 2) },
    ];

    const { scene } = compileScanSessionToScene(session);
    expect(scene.obstructions).toHaveLength(1);
    expect(scene.obstructions[0]?.dimensions).toEqual([2.5, 1.8, 0.9]);
  });

  test("uses dimension hints for critical zone candidates", () => {
    const session = createScanSession("Zone Dims", 10, 8, 3);
    session.imageDataUrl = "data:image/png;base64,AA==";
    session.imageName = "zonedims.png";
    session.candidates = [
      { ...createScanCandidate("critical_zone", [0.5, 0.5], 0), widthHintM: 3.0, depthHintM: 2.0 },
      { ...createScanCandidate("camera", [0.2, 0.2], 1) },
    ];

    const { scene } = compileScanSessionToScene(session);
    expect(scene.criticalZones).toHaveLength(1);
    const zone = scene.criticalZones[0]!;
    const polygonWidth = Math.abs(zone.polygon[1]![0] - zone.polygon[0]![0]);
    const polygonDepth = Math.abs(zone.polygon[2]![1] - zone.polygon[0]![1]);
    expect(polygonWidth).toBeCloseTo(3.0, 1);
    expect(polygonDepth).toBeCloseTo(2.0, 1);
  });

  test("defaults obstruction dimensions when hints are not provided", () => {
    const session = createScanSession("Default Dims", 10, 8, 3);
    session.imageDataUrl = "data:image/png;base64,AA==";
    session.imageName = "defaultdims.png";
    session.candidates = [
      createScanCandidate("obstruction", [0.5, 0.5], 0),
      createScanCandidate("camera", [0.2, 0.2], 1),
      createScanCandidate("critical_zone", [0.7, 0.7], 2),
    ];

    const { scene } = compileScanSessionToScene(session);
    expect(scene.obstructions).toHaveLength(1);
    expect(scene.obstructions[0]?.dimensions).toEqual([1.2, 1.2, 0.7]);
  });
});
