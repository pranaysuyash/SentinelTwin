import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const sensorsTabPath = "./src/components/bottom-panel/SensorsTab.tsx";

describe("SensorsTab", () => {
  test("surfaces sensor inventory and placement controls", () => {
    const source = readFileSync(sensorsTabPath, "utf8");

    expect(source).toContain("Sensor Fusion Entry Point");
    expect(source).toContain("Sensor Inventory");
    expect(source).toContain('setActiveTool("sensor")');
    expect(source).toContain("Nearest Cam");
    expect(source).toContain("Sensors are included in the canonical report summary today");
    expect(source).toContain("setSensorPlacementType");
    expect(source).toContain("sensorPlacementType");
  });
});
