import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

const launcherPath = resolve(fileURLToPath(new URL(".", import.meta.url)), "../launcher/ProjectStartLauncher.tsx");

describe("ProjectStartLauncher", () => {
  test("surfaces a job-first launcher with honest preview labels", () => {
    const source = readFileSync(launcherPath, "utf8");

    expect(source).toContain("Job-first starting path");
    expect(source).toContain("Audit existing camera coverage");
    expect(source).toContain("Design a new site layout");
    expect(source).toContain("Import a floor plan");
    expect(source).toContain("Scan site with phone photos");
    expect(source).toContain("Guided Marking");
    expect(source).toContain("Draft from site description");
    expect(source).toContain("Verify real footage");
    expect(source).toContain("Generate client report");
    expect(source).toContain("Open seeded retail baseline");
    expect(source).toContain("The seeded baseline remains available as a reference.");
    expect(source).toContain("Import JSON");
  });
});
