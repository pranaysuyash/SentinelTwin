import { describe, expect, test } from "bun:test";

import { parseSecurityScene } from "@/schema/security-scene";
import {
  computeTemporalProfile,
  computeTimeSliceStateForHour,
} from "@/simulation/temporal";
import {
  createTestCamera,
  createTestLight,
  createTestScene,
} from "@/simulation/__tests__/helpers";
import type { SecurityScene } from "@/schema/security-scene";

function createTemporalTestScene(): SecurityScene {
  const scene = createTestScene({
    cameras: [
      createTestCamera({ id: "cam_1", nightMode: "ir", irRangeM: 6 }),
      createTestCamera({ id: "cam_2", position: [8, 2.5, 4], nightMode: "none" }),
    ],
    securityLights: [
      createTestLight({ id: "light_1", illuminatesNightCoverage: true }),
    ],
    assumptions: { timeOfDay: "day" },
  });
  return scene;
}

describe("temporal simulation engine", () => {
  describe("computeTimeSliceStateForHour", () => {
    test("midnight is night state", () => {
      const state = computeTimeSliceStateForHour(0);
      expect(state.timeOfDay).toBe("night");
      expect(state.hour).toBe(0);
      expect(state.minute).toBe(0);
    });

    test("noon is day state", () => {
      const state = computeTimeSliceStateForHour(12);
      expect(state.timeOfDay).toBe("day");
    });

    test("hour 5 is night (before dawn)", () => {
      const state = computeTimeSliceStateForHour(5);
      expect(state.timeOfDay).toBe("night");
    });

    test("hour 6 is day (dawn)", () => {
      const state = computeTimeSliceStateForHour(6);
      expect(state.timeOfDay).toBe("day");
    });

    test("hour 18 is still day", () => {
      const state = computeTimeSliceStateForHour(18);
      expect(state.timeOfDay).toBe("day");
    });

    test("hour 19 is night (after sunset)", () => {
      const state = computeTimeSliceStateForHour(19);
      expect(state.timeOfDay).toBe("night");
    });

    test("hour 23 is night", () => {
      const state = computeTimeSliceStateForHour(23);
      expect(state.timeOfDay).toBe("night");
    });

    test("interior lights on during business hours (6-18)", () => {
      const state = computeTimeSliceStateForHour(10);
      expect(state.interiorLightsOn).toBe(true);
    });

    test("interior lights off after hours (18-22)", () => {
      const state = computeTimeSliceStateForHour(20);
      expect(state.interiorLightsOn).toBe(false);
    });

    test("interior lights on during cleaning (22-24)", () => {
      const state = computeTimeSliceStateForHour(23);
      expect(state.interiorLightsOn).toBe(true);
    });

    test("exterior lights off during daylight (6-19)", () => {
      const state = computeTimeSliceStateForHour(12);
      expect(state.exteriorLightsOn).toBe(false);
    });

    test("exterior lights on at night (19-2)", () => {
      const state = computeTimeSliceStateForHour(21);
      expect(state.exteriorLightsOn).toBe(true);
    });

    test("exterior lights off during timer cutout (2-5)", () => {
      const state = computeTimeSliceStateForHour(3);
      expect(state.exteriorLightsOn).toBe(false);
    });

    test("exterior lights on during pre-dawn (5-6)", () => {
      const state = computeTimeSliceStateForHour(5, 30);
      expect(state.exteriorLightsOn).toBe(true);
    });

    test("0:00-2:00 exterior lights on (regression for operator precedence bug)", () => {
      const state0 = computeTimeSliceStateForHour(0);
      const state1 = computeTimeSliceStateForHour(1);
      expect(state0.exteriorLightsOn).toBe(true);
      expect(state1.exteriorLightsOn).toBe(true);
    });

    test("occupancy is empty before 7", () => {
      const state = computeTimeSliceStateForHour(3);
      expect(state.occupancy).toBe("empty");
    });

    test("occupancy is high during peak (10-15)", () => {
      const state = computeTimeSliceStateForHour(12);
      expect(state.occupancy).toBe("high");
    });

    test("supports minute resolution", () => {
      const state = computeTimeSliceStateForHour(9, 30);
      expect(state.hour).toBe(9);
      expect(state.minute).toBe(30);
    });
  });

  describe("computeTemporalProfile", () => {
    test("returns valid profile structure", () => {
      const scene = createTemporalTestScene();
      const profile = computeTemporalProfile(scene);

      expect(profile.hoursAnalyzed).toBe(24);
      expect(profile.resolutionMinutes).toBe(15);
      expect(profile.hourlySnapshots.length).toBeGreaterThan(0);
      expect(profile.computedAt).toBeGreaterThan(0);
    });

    test("produces ~96 snapshots covering 24h at 15-min resolution", () => {
      const scene = createTemporalTestScene();
      const profile = computeTemporalProfile(scene);

      expect(profile.hourlySnapshots.length).toBeGreaterThanOrEqual(96);
      expect(profile.hourlySnapshots.length).toBeLessThanOrEqual(97);
    });

    test("snapshots are sorted by time", () => {
      const scene = createTemporalTestScene();
      const profile = computeTemporalProfile(scene);

      for (let i = 1; i < profile.hourlySnapshots.length; i++) {
        const prev = profile.hourlySnapshots[i - 1];
        const curr = profile.hourlySnapshots[i];
        if (prev.hour === curr.hour) {
          expect(curr.minute).toBeGreaterThan(prev.minute);
        } else {
          expect(curr.hour).toBeGreaterThan(prev.hour);
        }
      }
    });

    test("each snapshot has required fields", () => {
      const scene = createTemporalTestScene();
      const profile = computeTemporalProfile(scene);
      const snap = profile.hourlySnapshots[0];

      expect(typeof snap.hour).toBe("number");
      expect(typeof snap.minute).toBe("number");
      expect(typeof snap.overallCoveragePct).toBe("number");
      expect(typeof snap.criticalZonePassCount).toBe("number");
      expect(typeof snap.criticalZoneTotalCount).toBe("number");
      expect(typeof snap.activeCameraCount).toBe("number");
      expect(typeof snap.activeLightCount).toBe("number");
      expect(typeof snap.adversarialPathExposureScore).toBe("number");
      expect(Array.isArray(snap.issues)).toBe(true);
      expect(typeof snap.stateLabel).toBe("string");
    });

    test("coverage values are within valid range", () => {
      const scene = createTemporalTestScene();
      const profile = computeTemporalProfile(scene);

      for (const snap of profile.hourlySnapshots) {
        expect(snap.overallCoveragePct).toBeGreaterThanOrEqual(0);
        expect(snap.overallCoveragePct).toBeLessThanOrEqual(100);
      }
    });

    test("night snapshots have lower or equal coverage than day snapshots", () => {
      const scene = createTemporalTestScene();
      const profile = computeTemporalProfile(scene);

      const daySnaps = profile.hourlySnapshots.filter(
        (s) => s.hour >= 6 && s.hour < 19,
      );
      const nightSnaps = profile.hourlySnapshots.filter(
        (s) => s.hour < 6 || s.hour >= 19,
      );

      if (daySnaps.length > 0 && nightSnaps.length > 0) {
        const avgDay =
          daySnaps.reduce((sum, s) => sum + s.overallCoveragePct, 0) /
          daySnaps.length;
        const avgNight =
          nightSnaps.reduce((sum, s) => sum + s.overallCoveragePct, 0) /
          nightSnaps.length;
        expect(avgDay).toBeGreaterThanOrEqual(avgNight - 0.01);
      }
    });

    test("vulnerability windows have valid structure", () => {
      const scene = createTemporalTestScene();
      const profile = computeTemporalProfile(scene);

      for (const win of profile.peakVulnerabilityWindows) {
        expect(typeof win.startHour).toBe("number");
        expect(typeof win.startMinute).toBe("number");
        expect(typeof win.endHour).toBe("number");
        expect(typeof win.endMinute).toBe("number");
        expect(["high", "medium", "low"]).toContain(win.severity);
        expect(Array.isArray(win.reasons)).toBe(true);
        expect(Array.isArray(win.criticalZonesFailing)).toBe(true);
        expect(typeof win.adversarialRouteAvailable).toBe("boolean");
      }
    });

    test("safest periods have valid structure", () => {
      const scene = createTemporalTestScene();
      const profile = computeTemporalProfile(scene);

      for (const period of profile.safestPeriods) {
        expect(typeof period.startHour).toBe("number");
        expect(typeof period.endHour).toBe("number");
        expect(period.startHour).toBeLessThan(period.endHour);
      }
    });

    test("criticalZoneCoverageByHour maps zone labels to arrays", () => {
      const scene = createTemporalTestScene();
      const profile = computeTemporalProfile(scene);

      for (const [_zoneLabel, coverageArray] of Object.entries(
        profile.criticalZoneCoverageByHour,
      )) {
        expect(Array.isArray(coverageArray)).toBe(true);
        expect(coverageArray.length).toBe(profile.hourlySnapshots.length);
        for (const pct of coverageArray) {
          expect(pct).toBeGreaterThanOrEqual(0);
          expect(pct).toBeLessThanOrEqual(100);
        }
      }
    });

    test("active camera count reflects scene cameras", () => {
      const scene = createTemporalTestScene();
      const profile = computeTemporalProfile(scene);
      const expectedCameraCount = scene.cameras.length;

      for (const snap of profile.hourlySnapshots) {
        expect(snap.activeCameraCount).toBe(expectedCameraCount);
      }
    });

    test("exterior light timer cutout (2:00-5:00) shows fewer active lights at night", () => {
      const scene = createTemporalTestScene();
      const profile = computeTemporalProfile(scene);

      const deepNightSnap = profile.hourlySnapshots.find(
        (s) => s.hour === 3 && s.minute === 0,
      );
      const earlyNightSnap = profile.hourlySnapshots.find(
        (s) => s.hour === 21 && s.minute === 0,
      );

      if (deepNightSnap && earlyNightSnap) {
        expect(deepNightSnap.activeLightCount).toBeLessThanOrEqual(
          earlyNightSnap.activeLightCount,
        );
      }
    });
  });
});
