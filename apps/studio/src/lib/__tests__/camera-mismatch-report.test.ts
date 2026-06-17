import { describe, expect, it } from "vitest";

import { buildCameraEvidenceBinding, computeLandmarkAlignmentConfidence } from "@/lib/camera-landmark-matching";
import { generateMismatchReport } from "@/lib/camera-mismatch-report";
import type { CameraEvidenceArtifact, CameraNode } from "@/schema/security-scene";

const camera: CameraNode = {
  id: "cam_1",
  nodeType: "camera",
  name: "Front Camera",
  position: [0, 3, 0],
  yawDeg: 180,
  pitchDeg: -20,
  rollDeg: 0,
  mountType: "wall",
  mountHeightM: 3,
  fovHorizontalDeg: 90,
  fovVerticalDeg: 60,
  rangeM: 12,
  resolutionMP: 8,
  lensType: "fixed",
  status: "on",
  nightMode: "none",
  irRangeM: 0,
  thermalCapable: false,
  ptz: false,
  clarity: "good",
  ndaaCompliant: true,
  privacyMaskingEnabled: false,
  source: "manual",
  tags: [],
  lprCapable: false,
  reviewStatus: "unreviewed",
  sourceTrace: "",
  geometryValidity: "valid",
  viewMotion: { movementMode: "fixed", dwellSeconds: 0, waypoints: [] },
};

const evidence: CameraEvidenceArtifact = {
  id: "evidence_1",
  type: "still_image",
  timestamp: 1_700_000_000,
  source: "manual",
  cameraId: camera.id,
};

describe("camera mismatch reporting", () => {
  it("builds evidence bindings with transform confidence from landmark geometry", () => {
    const binding = buildCameraEvidenceBinding(camera, [
      { scenePosition: [-1.2, 1.8, 7.8], evidencePosition2D: [110, 82] },
      { scenePosition: [1.3, 1.7, 8.4], evidencePosition2D: [230, 104] },
      { scenePosition: [-0.8, 2.0, 9.2], evidencePosition2D: [160, 192] },
      { scenePosition: [0.9, 1.5, 7.9], evidencePosition2D: [260, 154] },
      { scenePosition: [0.4, 1.6, 8.8], evidencePosition2D: [180, 132] },
      { scenePosition: [-1.0, 1.9, 7.4], evidencePosition2D: [140, 170] },
    ], 1_700_000_123);

    expect(binding.isBound).toBe(true);
    expect(binding.verifiedAt).toBe(1_700_000_123);
    expect(binding.transformConfidence).toBeCloseTo(computeLandmarkAlignmentConfidence(camera, binding.landmarkMatches), 6);
  });

  it("prefers evidence binding confidence when generating mismatch reports", () => {
    const report = generateMismatchReport(
      camera,
      {
        ...evidence,
        binding: {
          isBound: true,
          landmarkMatches: [],
          transformConfidence: 0.94,
          verifiedAt: 1_700_000_321,
        },
      },
      22,
    );

    expect(report).toBeNull();
  });
});
