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
    expect(source).toContain("Studio dashboard");
    expect(source).toContain("Run Simulation");
    expect(source).toContain("Coverage");
    expect(source).toContain("SITE TWIN SEARCH");
    expect(source).toContain("Open Report");
    expect(source).toContain("setTimelineFocusRequest");
    expect(source).toContain("branch:");
    expect(source).toContain("after:");
    expect(source).toContain("All systems operational");
    expect(source).toContain("OrganizationManagerPanel");
  });
});
