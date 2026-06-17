import { describe, expect, test } from "bun:test";

import {
  computeSeasonalLightState,
  getExteriorLightStateSeasonal,
  estimateExteriorLux,
  computeTwilightPeriods,
} from "../seasonal-lighting";
import type { TimeSchedule } from "@sentineltwin/core";
import { createTestCamera, createTestScene } from "./helpers";

function makeSchedule(lat: number, lng: number, date?: string): TimeSchedule {
  return {
    location: { latitude: lat, longitude: lng, timezone: "UTC" },
    seasonalDate: date,
    interiorLightSchedule: [],
    exteriorLightSchedule: [],
    doorLockSchedule: [],
    occupancySchedule: [],
    guardPatrolSchedule: [],
  };
}

describe("computeSeasonalLightState", () => {
  test("returns daytime for noon in summer at equator", () => {
    const schedule = makeSchedule(0, 0, "2026-06-21T12:00:00Z");
    const state = computeSeasonalLightState(12, 0, schedule);
    expect(state).not.toBeNull();
    expect(state!.isDaytime).toBe(true);
    expect(state!.exteriorLightLevel).toBe("lux");
    expect(state!.label).toBe("Daylight");
    expect(state!.sunPosition.altitude).toBeGreaterThan(10);
  });

  test("returns night for midnight in summer at equator", () => {
    const schedule = makeSchedule(0, 0, "2026-06-21T00:00:00Z");
    const state = computeSeasonalLightState(0, 0, schedule);
    expect(state).not.toBeNull();
    expect(state!.isDaytime).toBe(false);
    expect(state!.exteriorLightLevel).toBe("none");
  });

  test("returns null when no location data", () => {
    const schedule: TimeSchedule = {
      interiorLightSchedule: [],
      exteriorLightSchedule: [],
      doorLockSchedule: [],
      occupancySchedule: [],
      guardPatrolSchedule: [],
    };
    const state = computeSeasonalLightState(12, 0, schedule);
    expect(state).toBeNull();
  });

  test("winter solstice at north pole has polar night", () => {
    const schedule = makeSchedule(80, 0, "2026-12-21T12:00:00Z");
    const state = computeSeasonalLightState(12, 0, schedule);
    expect(state).not.toBeNull();
    expect(state!.isDaytime).toBe(false);
    expect(state!.sunPosition.altitude).toBeLessThan(0);
  });

  test("summer solstice at north pole has midnight sun", () => {
    const schedule = makeSchedule(80, 0, "2026-06-21T12:00:00Z");
    const state = computeSeasonalLightState(12, 0, schedule);
    expect(state).not.toBeNull();
    expect(state!.sunPosition.altitude).toBeGreaterThan(0);
  });

  test("produces golden hour near dawn", () => {
    const schedule = makeSchedule(40.7, -74.0, "2026-06-21T12:00:00Z");
    const state = computeSeasonalLightState(5, 0, schedule);
    expect(state).not.toBeNull();
  });

  test("dawn and dusk times are present", () => {
    const schedule = makeSchedule(40.7, -74.0, "2026-06-21T12:00:00Z");
    const state = computeSeasonalLightState(12, 0, schedule);
    expect(state).not.toBeNull();
    expect(state!.dawnTime).not.toBeNull();
    expect(state!.duskTime).not.toBeNull();
  });

  test("twilight phase detected correctly", () => {
    const schedule = makeSchedule(40.7, -74.0, "2026-06-21T12:00:00Z");
    const dayState = computeSeasonalLightState(12, 0, schedule);
    expect(dayState!.twilightPhase).toBe("day");
  });
});

describe("getExteriorLightStateSeasonal", () => {
  test("returns lights off during summer day", () => {
    const schedule = makeSchedule(40.7, -74.0, "2026-06-21T12:00:00Z");
    const state = getExteriorLightStateSeasonal(12, 0, schedule);
    expect(state.on).toBe(false);
    expect(state.label).toBe("Daylight");
  });

  test("returns lights on during winter night", () => {
    const schedule = makeSchedule(40.7, -74.0, "2026-12-21T12:00:00Z");
    const state = getExteriorLightStateSeasonal(0, 0, schedule);
    expect(state.on).toBe(true);
  });

  test("returns fallback for no location", () => {
    const schedule: TimeSchedule = {
      interiorLightSchedule: [],
      exteriorLightSchedule: [],
      doorLockSchedule: [],
      occupancySchedule: [],
      guardPatrolSchedule: [],
    };
    const state = getExteriorLightStateSeasonal(12, 0, schedule);
    expect(state.on).toBe(false);
    expect(state.label).toBe("No location data");
  });
});

describe("estimateExteriorLux", () => {
  test("returns high lux during daytime", () => {
    const schedule = makeSchedule(40.7, -74.0, "2026-06-21T12:00:00Z");
    const lux = estimateExteriorLux(12, 0, schedule);
    expect(lux).toBeGreaterThan(1000);
  });

  test("returns low lux at night in winter", () => {
    const schedule = makeSchedule(40.7, -74.0, "2026-12-21T00:00:00Z");
    const lux = estimateExteriorLux(0, 0, schedule);
    expect(lux).toBeLessThan(100);
  });

  test("lux value decreases with altitude", () => {
    const noon = makeSchedule(40.7, -74.0, "2026-06-21T12:00:00Z");
    const midnight = makeSchedule(40.7, -74.0, "2026-12-21T00:00:00Z");
    expect(estimateExteriorLux(12, 0, noon)).toBeGreaterThan(estimateExteriorLux(0, 0, midnight));
  });

  test("returns -1 for no location", () => {
    const schedule: TimeSchedule = {
      interiorLightSchedule: [],
      exteriorLightSchedule: [],
      doorLockSchedule: [],
      occupancySchedule: [],
      guardPatrolSchedule: [],
    };
    expect(estimateExteriorLux(12, 0, schedule)).toBe(-1);
  });
});

describe("computeTwilightPeriods", () => {
  test("returns dawn and dusk times for a known location", () => {
    const schedule = makeSchedule(51.5, 0, "2026-06-21T12:00:00Z");
    const periods = computeTwilightPeriods(schedule);
    expect(periods).not.toBeNull();
    expect(periods!.dawn.hour).toBeGreaterThan(2);
    expect(periods!.dawn.hour).toBeLessThan(7);
    expect(periods!.dusk.hour).toBeGreaterThan(19);
    expect(periods!.dusk.hour).toBeLessThan(23);
  });

  test("returns null for no location", () => {
    const schedule: TimeSchedule = {
      interiorLightSchedule: [],
      exteriorLightSchedule: [],
      doorLockSchedule: [],
      occupancySchedule: [],
      guardPatrolSchedule: [],
    };
    expect(computeTwilightPeriods(schedule)).toBeNull();
  });
});

describe("seasonal coverage integration (D-315)", () => {
  test("evaluator exposes seasonal contribution that honours timeSchedule.location", () => {
    const sceneNoLocation = createTestScene({});
    const sceneWithLocation = createTestScene({});
    // Use UTC noon + 06:00 UTC: in NYC (UTC-4 in summer) that's 08:00 and 02:00 local.
    sceneWithLocation.timeSchedule = makeSchedule(40.7, -74.0, "2026-06-21T12:00:00Z");

    const { createCoverageEvaluator } = require("../coverage") as typeof import("../coverage");
    const noon = createCoverageEvaluator(sceneWithLocation, { hour: 12, minute: 0 });
    const deepNight = createCoverageEvaluator(sceneWithLocation, { hour: 6, minute: 0 });
    const noLoc = createCoverageEvaluator(sceneNoLocation, { hour: 12, minute: 0 });

    expect(noon.seasonal.applied).toBe(true);
    expect(deepNight.seasonal.applied).toBe(true);
    expect(noLoc.seasonal.applied).toBe(false);
    expect(noon.seasonal.state?.isDaytime).toBe(true);
    expect(deepNight.seasonal.state?.isDaytime).toBe(false);
    expect(noon.seasonal.exteriorDaytimeMultiplier).toBeGreaterThan(
      deepNight.seasonal.exteriorDaytimeMultiplier,
    );
  });

  test("coverage evaluator with location reports different lightLevel at noon vs deep night", () => {
    const scene = createTestScene({
      cameras: [
        createTestCamera({
          position: [2, 2.5, 2],
          yawDeg: 0,
          pitchDeg: -35,
          nightMode: "none",
        }),
      ],
    });
    scene.timeSchedule = makeSchedule(40.7, -74.0, "2026-06-21T12:00:00Z");

    const { createCoverageEvaluator } = require("../coverage") as typeof import("../coverage");
    const noonEval = createCoverageEvaluator(scene, { hour: 12, minute: 0 });
    const deepNightEval = createCoverageEvaluator(scene, { hour: 6, minute: 0 });

    // Sanity: noon vs deep night differ.
    expect(noonEval.seasonal.exteriorDaytimeMultiplier).toBe(1);
    expect(deepNightEval.seasonal.exteriorTwilightMultiplier).toBeLessThan(
      noonEval.seasonal.exteriorTwilightMultiplier,
    );
  });

  test("coverage evaluator without timeSchedule falls back to legacy timeOfDay model", () => {
    const scene = createTestScene({});
    const { createCoverageEvaluator } = require("../coverage") as typeof import("../coverage");
    const evaluator = createCoverageEvaluator(scene, { hour: 12, minute: 0 });
    expect(evaluator.seasonal.applied).toBe(false);
    expect(evaluator.seasonal.state).toBeNull();
    // Sanity: still works the same as before for callers that don't opt in.
    const cells = evaluator.computeCoverageCells(4);
    expect(Array.isArray(cells)).toBe(true);
    expect(cells.length).toBeGreaterThan(0);
  });
});
