import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

const dashboardHomePath = resolve(fileURLToPath(new URL(".", import.meta.url)), "../launcher/StudioDashboardHome.tsx");

describe("Studio dashboard launcher surface", () => {
  test("surfaces the product-home and workspace dashboard surface", () => {
    const source = readFileSync(dashboardHomePath, "utf8");

    expect(source).toContain("StudioDashboardHome");
    expect(source).toContain("SentinelTwin");
    expect(source).toContain("Home");
    expect(source).toContain("Security Simulation Studio");
    expect(source).toContain("Run Simulation");
    expect(source).toContain("Coverage");
    expect(source).toContain("SITE TWIN MEMORY SEARCH");
    expect(source).toContain("Open Report");
    expect(source).toContain("setTimelineFocusRequest");
    expect(source).toContain("branch:");
    expect(source).toContain("after:");
    expect(source).toContain("All systems operational");
    expect(source).toContain("OrganizationManagerPanel");
  });

  test("gates simulation-derived metric values until client hydration", () => {
    const source = readFileSync(dashboardHomePath, "utf8");

    expect(source).toContain("const displayPassCount = hydrated ? passCount : 0;");
    expect(source).toContain("const displayIssues = hydrated ? issues : [];");
    expect(source).toContain("const displayRedundancyFailCount = hydrated ? redundancyFailCount : 0;");
    expect(source).toContain("displayPassCount}/{displayTotalZones");
    expect(source).toContain("displayIssues.length");
  });
});
