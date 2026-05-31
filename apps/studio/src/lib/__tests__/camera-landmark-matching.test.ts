import { describe, expect, it } from "vitest";

import { computeLandmarkAlignmentConfidence, type LandmarkMatch } from "../camera-landmark-matching";
import type { CameraNode } from "@/schema/security-scene";

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
  reviewStatus: "unreviewed",
  sourceTrace: "",
  geometryValidity: "valid",
};

function buildMatch(
  scenePosition: LandmarkMatch["scenePosition"],
  evidencePosition2D: LandmarkMatch["evidencePosition2D"],
): LandmarkMatch {
  return { scenePosition, evidencePosition2D };
}

describe("computeLandmarkAlignmentConfidence", () => {
  it("returns 0 when there are fewer than four matches", () => {
    expect(
      computeLandmarkAlignmentConfidence(camera, [
        buildMatch([0, 1.8, 8], [120, 80]),
        buildMatch([1, 1.7, 8.5], [220, 100]),
      ]),
    ).toBe(0);
  });

  it("scores a well-spread, in-frustum landmark set higher than a collinear one", () => {
    const wellSpread = computeLandmarkAlignmentConfidence(camera, [
      buildMatch([-1.2, 1.8, 7.8], [110, 82]),
      buildMatch([1.3, 1.7, 8.4], [230, 104]),
      buildMatch([-0.8, 2.0, 9.2], [160, 192]),
      buildMatch([0.9, 1.5, 7.9], [260, 154]),
    ]);

    const collinear = computeLandmarkAlignmentConfidence(camera, [
      buildMatch([-0.5, 1.9, 8], [100, 100]),
      buildMatch([-0.25, 1.85, 8.5], [130, 128]),
      buildMatch([0, 1.8, 9], [160, 156]),
      buildMatch([0.25, 1.75, 9.5], [190, 184]),
    ]);

    expect(wellSpread).toBeGreaterThan(collinear);
    expect(wellSpread).toBeGreaterThan(0.25);
    expect(collinear).toBeLessThan(0.2);
  });

  it("penalizes matches that land behind the camera", () => {
    const inFront = computeLandmarkAlignmentConfidence(camera, [
      buildMatch([-1.2, 1.8, 7.8], [110, 82]),
      buildMatch([1.3, 1.7, 8.4], [230, 104]),
      buildMatch([-0.8, 2.0, 9.2], [160, 192]),
      buildMatch([0.9, 1.5, 7.9], [260, 154]),
      buildMatch([0.4, 1.6, 8.8], [180, 132]),
      buildMatch([-1.0, 1.9, 7.4], [140, 170]),
    ]);

    const behind = computeLandmarkAlignmentConfidence(camera, [
      buildMatch([-1.2, 1.8, -7.8], [110, 82]),
      buildMatch([1.3, 1.7, -8.4], [230, 104]),
      buildMatch([-0.8, 2.0, -9.2], [160, 192]),
      buildMatch([0.9, 1.5, -7.9], [260, 154]),
      buildMatch([0.4, 1.6, -8.8], [180, 132]),
      buildMatch([-1.0, 1.9, -7.4], [140, 170]),
    ]);

    expect(inFront).toBeGreaterThan(behind);
    expect(behind).toBeLessThan(0.1);
  });
});
