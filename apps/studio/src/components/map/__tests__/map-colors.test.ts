import { describe, expect, test } from "bun:test";

import { MAP_COLORS, doorColor, lightStatusColor, priorityStrokeColor, qualityColor, wallStrokeColor, windowStrokeColor } from "@/components/map/map-colors";
import { QUALITY_COLOR } from "@/lib/quality-display";

describe("map colors", () => {
  test("shares the canonical quality palette with the global quality display tokens", () => {
    expect(MAP_COLORS.quality).toEqual(QUALITY_COLOR);
    expect(qualityColor("recognition")).toBe(QUALITY_COLOR.recognition);
    expect(qualityColor("none")).toBe(QUALITY_COLOR.none);
  });

  test("derives map-specific token helpers from the shared palette", () => {
    expect(doorColor("open")).toBe(MAP_COLORS.doorOpen);
    expect(doorColor("restricted")).toBe(MAP_COLORS.doorRestricted);
    expect(lightStatusColor("failed")).toBe(MAP_COLORS.lightFailed);
    expect(lightStatusColor("off")).toBe(MAP_COLORS.lightOff);
    expect(priorityStrokeColor("critical")).toBe(MAP_COLORS.priority.critical);
    expect(priorityStrokeColor("unknown")).toBe(MAP_COLORS.priority.default);
    expect(wallStrokeColor("glass")).toBe(MAP_COLORS.wallGlass);
    expect(windowStrokeColor("reflective")).toBe(MAP_COLORS.windowReflective);
    expect(windowStrokeColor("curtain")).toBe(MAP_COLORS.windowCurtain);
    expect(windowStrokeColor("grill")).toBe(MAP_COLORS.windowGrill);
  });
});

