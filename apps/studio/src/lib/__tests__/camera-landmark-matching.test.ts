import { describe, expect, it } from "vitest";

import { getYawPitchDirection } from "@sentineltwin/core";
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
  lprCapable: false,
  reviewStatus: "unreviewed",
  sourceTrace: "",
  geometryValidity: "valid",
  viewMotion: { movementMode: "fixed", dwellSeconds: 0, waypoints: [] },
};

function buildMatch(
  scenePosition: LandmarkMatch["scenePosition"],
  evidencePosition2D: LandmarkMatch["evidencePosition2D"],
): LandmarkMatch {
  return { scenePosition, evidencePosition2D };
}

function dot3(a: [number, number, number], b: [number, number, number]) {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

function cross3(a: [number, number, number], b: [number, number, number]) {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ] as [number, number, number];
}

function normalize3(value: [number, number, number]) {
  const magnitude = Math.hypot(value[0], value[1], value[2]);
  return magnitude <= 1e-9 ? ([0, 0, 0] as [number, number, number]) : ([value[0] / magnitude, value[1] / magnitude, value[2] / magnitude] as [number, number, number]);
}

function projectToEvidence(scenePosition: LandmarkMatch["scenePosition"]) {
  const forward = getYawPitchDirection(camera.yawDeg, camera.pitchDeg).toArray() as [number, number, number];
  let right = normalize3(cross3(forward, [0, 1, 0]));
  if (Math.hypot(right[0], right[1], right[2]) <= 1e-9) {
    right = [1, 0, 0];
  }
  const up = normalize3(cross3(right, forward));
  const delta: [number, number, number] = [
    scenePosition[0] - camera.position[0],
    scenePosition[1] - camera.position[1],
    scenePosition[2] - camera.position[2],
  ];
  const x = dot3(delta, right);
  const y = dot3(delta, up);
  const z = dot3(delta, forward);
  const depth = Math.max(Math.abs(z), 0.25);
  return [160 + (x / depth) * 220, 120 - (y / depth) * 220] as [number, number];
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
      buildMatch([-1.2, 1.8, 7.8], projectToEvidence([-1.2, 1.8, 7.8])),
      buildMatch([1.3, 1.7, 8.4], projectToEvidence([1.3, 1.7, 8.4])),
      buildMatch([-0.8, 2.0, 9.2], projectToEvidence([-0.8, 2.0, 9.2])),
      buildMatch([0.9, 1.5, 7.9], projectToEvidence([0.9, 1.5, 7.9])),
      buildMatch([0.4, 1.6, 8.8], projectToEvidence([0.4, 1.6, 8.8])),
      buildMatch([-1.0, 1.9, 7.4], projectToEvidence([-1.0, 1.9, 7.4])),
    ]);

    const collinear = computeLandmarkAlignmentConfidence(camera, [
      buildMatch([-0.5, 1.9, 8], projectToEvidence([-0.5, 1.9, 8])),
      buildMatch([-0.25, 1.85, 8.5], projectToEvidence([-0.25, 1.85, 8.5])),
      buildMatch([0, 1.8, 9], projectToEvidence([0, 1.8, 9])),
      buildMatch([0.25, 1.75, 9.5], projectToEvidence([0.25, 1.75, 9.5])),
      buildMatch([0.5, 1.7, 10], projectToEvidence([0.5, 1.7, 10])),
      buildMatch([0.75, 1.65, 10.5], projectToEvidence([0.75, 1.65, 10.5])),
    ]);

    expect(wellSpread).toBeGreaterThan(collinear);
    expect(wellSpread).toBeGreaterThan(0.3);
    expect(collinear).toBeLessThan(0.2);
  });

  it("penalizes matches that land behind the camera", () => {
    const inFront = computeLandmarkAlignmentConfidence(camera, [
      buildMatch([-1.2, 1.8, 7.8], projectToEvidence([-1.2, 1.8, 7.8])),
      buildMatch([1.3, 1.7, 8.4], projectToEvidence([1.3, 1.7, 8.4])),
      buildMatch([-0.8, 2.0, 9.2], projectToEvidence([-0.8, 2.0, 9.2])),
      buildMatch([0.9, 1.5, 7.9], projectToEvidence([0.9, 1.5, 7.9])),
      buildMatch([0.4, 1.6, 8.8], projectToEvidence([0.4, 1.6, 8.8])),
      buildMatch([-1.0, 1.9, 7.4], projectToEvidence([-1.0, 1.9, 7.4])),
    ]);

    const behind = computeLandmarkAlignmentConfidence(camera, [
      buildMatch([-1.2, 1.8, -7.8], projectToEvidence([-1.2, 1.8, -7.8])),
      buildMatch([1.3, 1.7, -8.4], projectToEvidence([1.3, 1.7, -8.4])),
      buildMatch([-0.8, 2.0, -9.2], projectToEvidence([-0.8, 2.0, -9.2])),
      buildMatch([0.9, 1.5, -7.9], projectToEvidence([0.9, 1.5, -7.9])),
      buildMatch([0.4, 1.6, -8.8], projectToEvidence([0.4, 1.6, -8.8])),
      buildMatch([-1.0, 1.9, -7.4], projectToEvidence([-1.0, 1.9, -7.4])),
    ]);

    expect(inFront).toBeGreaterThan(behind);
    expect(inFront).toBeGreaterThan(0.35);
    expect(behind).toBeLessThan(0.1);
  });
});
