import { describe, expect, test } from "bun:test";

import {
  createDefaultSceneBounds,
  createMapProjection,
  inferSceneBounds,
} from "@/components/map/MapProjection";

describe("MapProjection", () => {
  test("preserves aspect ratio and padding when fit to bounds", () => {
    const projection = createMapProjection({
      sceneBounds: createDefaultSceneBounds(20, 10),
      width: 200,
      height: 120,
      padding: 10,
      zoom: 1,
      pan: [0, 0],
    });

    expect(projection.bounds.width).toBeCloseTo(180);
    expect(projection.bounds.height).toBeCloseTo(90);
    expect(projection.bounds.width / projection.bounds.height).toBeCloseTo(2);

    expect(projection.sceneToSvg([0, 0])).toEqual({ x: 10, y: 15 });
    expect(projection.sceneToSvg([20, 10])).toEqual({ x: 190, y: 105 });
  });

  test("round-trips scene coordinates through svg coordinates", () => {
    const projection = createMapProjection({
      sceneBounds: inferSceneBounds(
        { width: 8, depth: 6 },
        [
          [-4, -3],
          [12, 5],
        ],
      ),
      width: 160,
      height: 120,
      padding: 12,
      zoom: 1.35,
      pan: [16, -7],
    });

    const scenePoint: [number, number] = [-2, -1];
    const svgPoint = projection.sceneToSvg(scenePoint);
    const back = projection.svgToScene(svgPoint);

    expect(back[0]).toBeCloseTo(scenePoint[0], 6);
    expect(back[1]).toBeCloseTo(scenePoint[1], 6);
  });

  test("supports zoom and pan without losing inverse mapping", () => {
    const projection = createMapProjection({
      sceneBounds: createDefaultSceneBounds(10, 10),
      width: 240,
      height: 180,
      padding: 8,
      zoom: 2.2,
      pan: [18, -7],
    });

    const scenePoint: [number, number] = [4.4, 6.1];
    const svgPoint = projection.sceneToSvg(scenePoint);
    const back = projection.svgToScene(svgPoint);

    expect(back[0]).toBeCloseTo(scenePoint[0], 6);
    expect(back[1]).toBeCloseTo(scenePoint[1], 6);
  });
});
