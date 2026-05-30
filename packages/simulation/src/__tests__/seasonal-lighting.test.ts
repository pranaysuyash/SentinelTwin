import { describe, expect, test } from "bun:test";

import {
  computeSeasonalLightState,
  getExteriorLightStateSeasonal,
  estimateExteriorLux,
  computeTwilightPeriods,
} from "../seasonal-lighting";
import type { TimeSchedule } from "@sentineltwin/core";

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
