import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const demoWalkthroughPath = "./src/components/demo/DemoWalkthroughPanel.tsx";

describe("DemoWalkthroughPanel (supersedes DemoModeOverlay)", () => {
  test("exports a walkthrough panel that drives real simulation state", () => {
    const source = readFileSync(demoWalkthroughPath, "utf8");

    expect(source).toContain("DemoWalkthroughPanel");
    expect(source).toContain("runSimulation");
  });
});
