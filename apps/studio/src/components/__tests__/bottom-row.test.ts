import { describe, expect, test } from "bun:test";

import {
  buildEnvironmentRows,
  summarizeDoorStates,
  summarizeWindowStates,
} from "@/components/bottom-row/bottom-row-utils";

describe("BottomRow helpers", () => {
  const scene = {
    assumptions: {
      wallHeightM: 3,
      personHeightM: 1.75,
      vehicleHeightM: 1.5,
      timeOfDay: "night",
      exteriorLightLux: undefined,
      interiorLightLevel: "dim",
      nightPenaltyMode: "detailed",
      doriStandard: "oodpcvs_2025",
      pixelsPerMeter: { detection: 25, observation: 62.5, recognition: 125, identification: 250 },
      showAssumptionsPanel: true,
    },
    windows: [
      { state: "closed_glass" },
      { state: "reflective" },
      { state: "open" },
    ],
    doors: [
      { state: "open" },
      { state: "locked" },
    ],
  } as unknown as Parameters<typeof summarizeWindowStates>[0];

  test("summarizes scene window and door states from live scene data", () => {
    expect(summarizeWindowStates(scene)).toBe("3 windows · 1 glass, 1 open, 1 reflective");
    expect(summarizeDoorStates(scene)).toBe("2 doors · 1 open, 1 locked");
  });

  test("builds environment rows from assumptions instead of static weather placeholders", () => {
    const rows = buildEnvironmentRows(scene, "night");
    expect(rows).toEqual([
      { label: "Mode", value: "Night" },
      { label: "Time of Day", value: "Night" },
      { label: "Interior Light", value: "Dim" },
      { label: "Night Penalty", value: "Detailed" },
      { label: "Exterior Lux", value: "Auto" },
      { label: "Windows", value: "3 windows · 1 glass, 1 open, 1 reflective" },
      { label: "Doors", value: "2 doors · 1 open, 1 locked" },
    ]);
  });
});
