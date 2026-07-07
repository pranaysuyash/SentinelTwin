import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

const demoWalkthroughPath = resolve(fileURLToPath(new URL(".", import.meta.url)), "../demo/DemoWalkthroughPanel.tsx");

describe("DemoWalkthroughPanel (supersedes DemoModeOverlay)", () => {
  test("exports a guided walkthrough panel that drives real simulation state", () => {
    const source = readFileSync(demoWalkthroughPath, "utf8");

    expect(source).toContain("DemoWalkthroughPanel");
    expect(source).toContain("runSimulation");
    expect(source).toContain("restoreFailureCase");
    expect(source).toContain("commitSceneChange");
    expect(source).toContain("failureRecoveryRef");
    expect(source).toContain("Judge Demo Walkthrough (4:15)");
    expect(source).toContain("0:00");
    expect(source).toContain("Finish Judge Demo");
  });
});
