import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const redundancyPanelPath = "/Users/pranay/Projects/SentinelTwin/apps/studio/src/components/bottom-panel/RedundancyMatrixPanel.tsx";

describe("RedundancyMatrixPanel", () => {
  test("offers the shared simulation action when redundancy data is missing", () => {
    const source = readFileSync(redundancyPanelPath, "utf8");

    expect(source).toContain("Run the shared simulation to compute redundancy analysis from the current scene.");
    expect(source).toContain("Run Simulation");
    expect(source).toContain("runSimulation");
  });
});
