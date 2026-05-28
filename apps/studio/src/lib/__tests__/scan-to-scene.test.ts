import { describe, expect, test } from "bun:test";

import {
  compileScanSessionToScene,
  createScanCandidate,
  createScanSession,
} from "@/lib/scan-to-scene";
import { safeParseSecurityScene } from "@/schema/security-scene";

describe("scan-to-scene", () => {
  test("creates valid scene from door + camera + obstruction + counter markers", () => {
    const session = createScanSession("Manual Assisted Scan", 12, 9, 3.2);
    session.imageDataUrl = "data:image/svg+xml;base64,PHN2Zy8+";
    session.imageName = "site.svg";
    session.candidates = [
      { ...createScanCandidate("camera", [0.18, 0.2], 0), label: "Entrance Camera", confidence: 0.84 },
      { ...createScanCandidate("counter", [0.58, 0.62], 1), label: "Cash Counter", confidence: 0.91 },
      { ...createScanCandidate("door", [0.5, 0.05], 2), label: "Front Door", confidence: 0.79 },
      { ...createScanCandidate("critical_zone", [0.61, 0.66], 3), label: "Counter Zone", confidence: 0.76 },
    ];

    const { scene, provenance } = compileScanSessionToScene(session);
    expect(scene.source).toBe("scan");
    expect(scene.walls).toHaveLength(4);
    expect(scene.cameras).toHaveLength(1);
    expect(scene.obstructions).toHaveLength(1);
    expect(scene.doors).toHaveLength(1);
    expect(scene.entryPoints.length).toBeGreaterThan(0);
    expect(scene.criticalZones).toHaveLength(1);
    expect(scene.cameras[0]?.source).toBe("scan");
    expect(provenance.source).toBe("scan");
    expect(provenance.acceptedCandidates).toBe(4);
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
});
