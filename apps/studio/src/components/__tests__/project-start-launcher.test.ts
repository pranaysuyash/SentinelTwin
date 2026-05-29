import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

const launcherPath = resolve(fileURLToPath(new URL(".", import.meta.url)), "../launcher/ProjectStartLauncher.tsx");

describe("ProjectStartLauncher", () => {
  test("surfaces a job-first launcher with honest preview labels", () => {
    const source = readFileSync(launcherPath, "utf8");

    expect(source).toContain("V0.1 Reference-Baseline Launcher");
    expect(source).toContain("Audit existing CCTV setup");
    expect(source).toContain("Design a new camera layout");
    expect(source).toContain("Import a floor plan");
    expect(source).toContain("Scan site with phone photos");
    expect(source).toContain("Preview / Manual-assisted");
    expect(source).toContain("Draft from text prompt");
    expect(source).toContain("Verify real footage");
    expect(source).toContain("Generate client report");
    expect(source).toContain("The seeded baseline is the primary product surface.");
    expect(source).toContain("Import JSON");
  });
});
