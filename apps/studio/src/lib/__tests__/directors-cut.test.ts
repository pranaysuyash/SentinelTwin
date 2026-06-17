import { describe, expect, it } from "bun:test";

import { createSmallRetailShopScene } from "@/demo-scenes/small-retail-shop";
import { simulateStudio } from "@sentineltwin/simulation";
import { buildDirectorsCutSequence } from "@/lib/directors-cut";

describe("buildDirectorsCutSequence", () => {
  it("returns null when the adversarial path has no waypoints", () => {
    const scene = createSmallRetailShopScene();
    const sequence = buildDirectorsCutSequence(scene, {
      waypoints: [],
      totalExposureScore: 0,
      totalDurationS: 0,
      detectionQualityExposure: {},
      maxDetectionProbability: 0,
      coverageGapsUsed: [],
      camerasWithoutCoverageOnRoute: [],
      criticalZonesReachableAlongRoute: [],
      criticalZoneReachable: false,
    });

    expect(sequence).toBeNull();
  });

  it("produces one shot per waypoint and collapses adjacent same-camera waypoints into segments", () => {
    const scene = createSmallRetailShopScene();
    const result = simulateStudio(scene);

    const sequence = buildDirectorsCutSequence(scene, result.adversarialPath!);

    expect(sequence).not.toBeNull();
    expect(sequence!.shots.length).toBe(result.adversarialPath!.waypoints.length);
    expect(sequence!.segments.length).toBeGreaterThan(0);
    expect(sequence!.segments.length).toBeLessThanOrEqual(sequence!.shots.length);

    for (const shot of sequence!.shots) {
      expect(["well_framed", "edge_of_frame", "foreshortened", "out_of_frame", "no_coverage"]).toContain(shot.grade);
      if (shot.grade === "no_coverage") {
        expect(shot.cameraId).toBeNull();
      } else {
        expect(shot.cameraId).not.toBeNull();
      }
    }
  });

  it("segments cover the full path duration contiguously", () => {
    const scene = createSmallRetailShopScene();
    const result = simulateStudio(scene);

    const sequence = buildDirectorsCutSequence(scene, result.adversarialPath!);
    expect(sequence).not.toBeNull();

    for (let i = 1; i < sequence!.segments.length; i++) {
      expect(sequence!.segments[i]!.startTimeS).toBe(sequence!.segments[i - 1]!.endTimeS);
    }
    if (sequence!.segments.length > 0) {
      expect(sequence!.segments[0]!.startTimeS).toBe(result.adversarialPath!.waypoints[0]!.timeS);
      expect(sequence!.segments[sequence!.segments.length - 1]!.endTimeS).toBe(sequence!.totalDurationS);
    }
  });

  it("reports no_coverage when no camera is on", () => {
    const scene = createSmallRetailShopScene();
    const offScene = { ...scene, cameras: scene.cameras.map((c) => ({ ...c, status: "off" as const })) };
    const result = simulateStudio(offScene);

    const sequence = buildDirectorsCutSequence(offScene, result.adversarialPath!);
    expect(sequence).not.toBeNull();
    for (const shot of sequence!.shots) {
      expect(shot.grade).toBe("no_coverage");
      expect(shot.cameraId).toBeNull();
    }
    expect(sequence!.noCoverageDurationS).toBe(sequence!.totalDurationS);
  });
});
