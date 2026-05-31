import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

const componentRoot = resolve(fileURLToPath(new URL(".", import.meta.url)), "..");
const dashboardHomePath = resolve(componentRoot, "launcher/StudioDashboardHome.tsx");
const referenceSitesPath = resolve(componentRoot, "product/ReferenceSitesView.tsx");
const settingsPath = resolve(componentRoot, "product/SettingsView.tsx");

describe("product home affordance contract", () => {
  test("keeps home status chips non-clickable when they do not open a menu", () => {
    const source = readFileSync(dashboardHomePath, "utf8");

    expect(source).toContain('title="Current active Site Twin"');
    expect(source).toContain('title="Current environment profile"');
    expect(source).not.toContain('aria-label="Open scene selector"');
    expect(source).not.toContain('aria-label="Open environment mode menu"');
    expect(source).not.toContain('<svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">');
  });

  test("wires footer feedback and help controls to lightweight panels", () => {
    const source = readFileSync(dashboardHomePath, "utf8");

    expect(source).toContain('const [footerPanel, setFooterPanel]');
    expect(source).toContain('onClick={() => setFooterPanel("feedback")}');
    expect(source).toContain('onClick={() => setFooterPanel("help")}');
    expect(source).toContain('aria-label="Open command center help"');
    expect(source).toContain("Feedback Handoff");
    expect(source).toContain("Command Center Help");
  });

  test("keeps Reference Sites and Settings as intentional product views", () => {
    const referenceSource = readFileSync(referenceSitesPath, "utf8");
    const settingsSource = readFileSync(settingsPath, "utf8");

    expect(referenceSource).toContain("function siteCategory");
    expect(referenceSource).toContain("filteredReferenceProjects");
    expect(referenceSource).toContain("categoryCounts");
    expect(referenceSource).toContain("Show All References");

    expect(settingsSource).toContain("Product preferences");
    expect(settingsSource).toContain("toggleViewSettingsOpen");
    expect(settingsSource).toContain('navigate("studio")');
    expect(settingsSource).toContain("Open View Settings");
  });
});
