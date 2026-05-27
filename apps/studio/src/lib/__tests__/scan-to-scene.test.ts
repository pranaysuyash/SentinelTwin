import { describe, expect, test } from "bun:test";

import {
  compileScanSessionToScene,
  createScanCandidate,
  createScanSession,
} from "@/lib/scan-to-scene";

describe("scan-to-scene", () => {
  test("compiles scan candidates into a real scan_import SecurityScene", () => {
    const session = createScanSession("Manual Assisted Scan", 12, 9, 3.2);
    session.imageDataUrl = "data:image/svg+xml;base64,PHN2Zy8+";
    session.imageName = "site.svg";
    session.candidates = [
      {
        ...createScanCandidate("camera", [0.18, 0.2], 0),
        label: "Entrance Camera",
        confidence: 0.84,
      },
      {
        ...createScanCandidate("counter", [0.58, 0.62], 1),
        label: "Cash Counter",
        confidence: 0.91,
      },
      {
        ...createScanCandidate("door", [0.5, 0.05], 2),
        label: "Front Door",
        confidence: 0.79,
      },
      {
        ...createScanCandidate("critical_zone", [0.61, 0.66], 3),
        label: "Counter Zone",
        confidence: 0.76,
      },
    ];

    const scene = compileScanSessionToScene(session);

    expect(scene.source).toBe("scan_import");
    expect(scene.name).toBe("Manual Assisted Scan");
    expect(scene.dimensions).toEqual({ width: 12, depth: 9, height: 3.2 });
    expect(scene.walls).toHaveLength(4);
    expect(scene.cameras).toHaveLength(1);
    expect(scene.obstructions).toHaveLength(1);
    expect(scene.doors).toHaveLength(1);
    expect(scene.criticalZones).toHaveLength(1);
    expect(scene.cameras[0]?.source).toBe("scan");
    expect(scene.obstructions[0]?.source).toBe("scan");
    expect(scene.doors[0]?.source).toBe("scan");
  });
});
