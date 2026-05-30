import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

const redundancyPanelPath = resolve(fileURLToPath(new URL(".", import.meta.url)), "../bottom-panel/RedundancyMatrixPanel.tsx");

describe("RedundancyMatrixPanel", () => {
  test("offers the shared simulation action when redundancy data is missing", () => {
    const source = readFileSync(redundancyPanelPath, "utf8");

    expect(source).toContain("Run the shared simulation to compute redundancy analysis from the current scene.");
    expect(source).toContain("Run Simulation");
    expect(source).toContain("runSimulation");
    expect(source).toContain("Selected Camera Impact");
    expect(source).toContain("If this camera fails, these zones lose their only backup.");
    expect(source).toContain("No zones would be lost by this camera alone");
  });
});
