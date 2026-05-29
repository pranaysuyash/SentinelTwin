import { describe, expect, test } from "bun:test";

import type { CoverageCellLike } from "@/components/map/map-geometry";
import { obstacleRectPoints, polygonToSvgPoints } from "@/components/map/map-geometry";
import {
  groupPathQualitySamples,
  samplePathQuality,
} from "@/components/map/path-quality";
import type { ScenarioPath } from "@/schema/security-scene";

describe("map utility geometry and sampling", () => {
  test("polygonToSvgPoints maps polygon points through projector", () => {
    const polygon: Array<[number, number]> = [
      [0, 0],
      [2, 0],
      [2, 1],
      [0, 1],
    ];

    const project = ([x, y]: [number, number]) => ({ x: x * 10 + 1, y: y * 10 + 1 });

    expect(polygonToSvgPoints(polygon, project)).toBe("1,1 21,1 21,11 1,11");
  });

  test("obstacleRectPoints applies rotation around center", () => {
    const rect = obstacleRectPoints([10, 4], 4, 2, 90);

    expect(rect).toHaveLength(4);
    expect(rect[0]).toEqual([11, 2]);
    expect(rect[1]).toEqual([11, 6]);
    expect(rect[2]).toEqual([9, 6]);
    expect(rect[3]).toEqual([9, 2]);
  });

  test("samplePathQuality interpolates long segments between authored points", () => {
    const path: ScenarioPath = {
      id: "path_t1",
      nodeType: "path",
      label: "Long segment path",
      actorType: "person",
      points: [
        { position: [0, 0] },
        { position: [10, 0] },
      ],
      speedMps: 2,
      heightM: 1.75,
      timeOfDay: "day",
      intent: "incident_replay",
      source: "manual",
      reviewStatus: "unreviewed",
      sourceTrace: "",
      geometryValidity: "valid",
    };

    const coverageCells: CoverageCellLike[] = [
      { x: 0, z: 0, quality: "none", coveringCameras: [] },
      { x: 2, z: 0, quality: "recognition", coveringCameras: [] },
      { x: 4, z: 0, quality: "detection", coveringCameras: [] },
      { x: 6, z: 0, quality: "identification", coveringCameras: [] },
      { x: 10, z: 0, quality: "none", coveringCameras: [] },
    ];

    const samples = samplePathQuality(path, coverageCells, 1);

    expect(samples).toHaveLength(11);
    expect(samples[0]).toMatchObject({
      distanceM: 0,
      timeS: 0,
      quality: "none",
      nearestCellId: "0.00:0.00",
    });
    expect(samples[2]).toMatchObject({ distanceM: 2, quality: "recognition" });
    expect(samples[4]).toMatchObject({ distanceM: 4, quality: "detection" });
    expect(samples[6]).toMatchObject({ distanceM: 6, quality: "identification" });
    expect(samples[10]).toMatchObject({ distanceM: 10, timeS: 5, quality: "none" });

    const bands = groupPathQualitySamples(samples);
    expect(bands.map((band) => band.quality)).toEqual([
      "none",
      "recognition",
      "detection",
      "identification",
      "none",
    ]);
    expect(bands[0]?.startDistanceM).toBe(0);
    expect(bands[bands.length - 1]?.endDistanceM).toBe(10);
  });
});
