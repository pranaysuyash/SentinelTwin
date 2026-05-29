import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

const launcherPath = resolve(fileURLToPath(new URL(".", import.meta.url)), "../launcher/ProjectStartLauncher.tsx");

describe("ProjectStartLauncher", () => {
  test("surfaces a job-first launcher with honest preview/planned labels", () => {
    const source = readFileSync(launcherPath, "utf8");

    expect(source).toContain("What are you trying to do?");
    expect(source).toContain("Audit existing CCTV setup");
    expect(source).toContain("Design a new camera layout");
    expect(source).toContain("Import a floor plan");
    expect(source).toContain("Scan site with phone photos");
    expect(source).toContain("Preview / Manual-assisted");
    expect(source).toContain("Draft from text prompt");
    expect(source).toContain("Verify real footage");
    expect(source).toContain("Generate client report");
    expect(source).toContain("Manual-assisted scan and floor-plan import are available now.");
    expect(source).toContain("Guided scan reconstruction is planned, not implemented yet.");
    expect(source).toContain("Start Blank Scene");
    expect(source).toContain("Import JSON");
  });
});
