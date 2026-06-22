import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const sensorsTabPath = join(import.meta.dir, "../..", "components/bottom-panel/SensorsTab.tsx");

describe("SensorsTab", () => {
  test("surfaces sensor inventory and placement controls", () => {
    const source = readFileSync(sensorsTabPath, "utf8");

    expect(source).toContain("Sensor Fusion Entry Point");
    expect(source).toContain("Sensor Inventory");
    expect(source).toContain("Live Signals");
    expect(source).toContain("Live Event Feed");
    expect(source).toContain("Live Metadata Intake");
    expect(source).toContain('setActiveTool("sensor")');
    expect(source).toContain("Trigger");
    expect(source).toContain("Heartbeat");
    expect(source).toContain("Mark Faulted");
    expect(source).toContain("Restore");
    expect(source).toContain("Import Metadata Feed");
    expect(source).toContain("Nearest Cam");
    expect(source).toContain("Live evidence is now logged into the canonical operational trail.");
    expect(source).toContain("setSensorPlacementType");
    expect(source).toContain("sensorPlacementType");
  });
});
