import { describe, expect, test } from "bun:test";

import { computeSensorFusionSummary } from "@/lib/sensor-fusion";
import type { SensorNode } from "@/schema/security-scene";

describe("computeSensorFusionSummary", () => {
  test("returns the nearest sensor and counts active sensors", () => {
    const sensors: SensorNode[] = [
      {
        id: "sensor_1",
        nodeType: "sensor",
        label: "Front Entry Motion",
        position: [1, 1.2, 1],
        sensorType: "motion",
        state: "active",
        coverageMode: "detection",
        source: "manual",
      },
      {
        id: "sensor_2",
        nodeType: "sensor",
        label: "Counter Contact",
        position: [8, 1.2, 2],
        sensorType: "door_contact",
        state: "faulted",
        coverageMode: "audit",
        source: "manual",
      },
    ];

    const summary = computeSensorFusionSummary([1.5, 1.2, 1.2], sensors);

    expect(summary.totalCount).toBe(2);
    expect(summary.activeCount).toBe(1);
    expect(summary.nearestSensor?.label).toBe("Front Entry Motion");
    expect(summary.nearestDistanceM).toBeLessThan(1);
  });

  test("returns null nearest sensor when there are no sensors", () => {
    const summary = computeSensorFusionSummary([0, 0, 0], []);

    expect(summary.totalCount).toBe(0);
    expect(summary.activeCount).toBe(0);
    expect(summary.nearestSensor).toBeNull();
    expect(summary.nearestDistanceM).toBeNull();
  });
});
