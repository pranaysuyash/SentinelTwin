import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

const topBarPath = resolve(fileURLToPath(new URL(".", import.meta.url)), "../../layout/TopBar.tsx");
const settingsViewPath = resolve(fileURLToPath(new URL(".", import.meta.url)), "../SettingsView.tsx");

describe("consolidated settings surface (I7)", () => {
  test("TopBar exposes a Settings link to the consolidated preferences view", () => {
    const source = readFileSync(topBarPath, "utf8");
    expect(source).toContain("topbar-settings");
    expect(source).toMatch(/navigateProductView\("settings"\)/);
  });

  test("SettingsView links to the other settings surfaces", () => {
    const source = readFileSync(settingsViewPath, "utf8");
    // The deep-link section must point operators at the four major
    // settings surfaces that live outside this page.
    expect(source).toContain("Other Settings Surfaces");
    expect(source).toMatch(/settings-deeplink-\$\{entry\.id\}/);
    expect(source).toContain('id: "project-settings"');
    expect(source).toContain('id: "simulation-assumptions"');
    expect(source).toContain('id: "workspace-view"');
    expect(source).toContain('id: "first-run-guide"');
  });

  test("first-run-guide deeplink clears the dismissal flag from localStorage", () => {
    const source = readFileSync(settingsViewPath, "utf8");
    expect(source).toMatch(/localStorage\.removeItem\(\s*"sentineltwin_first_run_guide_seen_v1"/);
  });

  test("first-run-guide deeplink action is wrapped in a try/catch (localStorage may be unavailable)", () => {
    const source = readFileSync(settingsViewPath, "utf8");
    // Defensive try/catch — localStorage throws in private mode or
    // when quota is exhausted. The button must not crash the page.
    // The action arrow runs the body inside `try { ... } catch {}`.
    const removeIdx = source.indexOf("localStorage.removeItem");
    expect(removeIdx).toBeGreaterThan(0);
    const before = source.slice(Math.max(0, removeIdx - 60), removeIdx);
    expect(before).toMatch(/try\s*\{/);
    const after = source.slice(removeIdx, removeIdx + 200);
    expect(after).toMatch(/\}\s*catch\s*\{/);
  });
});