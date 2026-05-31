import { describe, expect, test } from "bun:test";

import {
  createCameraNode,
  createCriticalZoneNode,
  createEntryPointNode,
  createObstructionNode,
  createSecurityLightNode,
  createWallNode,
  createScenarioPathNode,
  resetNodeCounters,
} from "@sentineltwin/core";

describe("node factory id prefixes", () => {
  test("generated ids keep canonical prefixes", () => {
    resetNodeCounters();

    expect(createCameraNode([1, 2, 3]).id.startsWith("cam_")).toBe(true);
    expect(createSecurityLightNode([1, 2, 3]).id.startsWith("light_")).toBe(true);
    expect(createWallNode([0, 0], [1, 0]).id.startsWith("wall_")).toBe(true);
    expect(createObstructionNode([1, 0, 1], "shelf").id.startsWith("obs_")).toBe(true);
    expect(createCriticalZoneNode([[0, 0], [1, 0], [1, 1], [0, 1]]).id.startsWith("zone_")).toBe(true);
    expect(createEntryPointNode([0.5, 0.5]).id.startsWith("entry_")).toBe(true);
    expect(createScenarioPathNode([{ position: [0, 0] }, { position: [1, 1] }]).id.startsWith("path_")).toBe(true);
  });
});
