import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

const firstRunGuidePath = resolve(fileURLToPath(new URL(".", import.meta.url)), "../FirstRunGuide.tsx");
const helpTabPath = resolve(fileURLToPath(new URL(".", import.meta.url)), "../../bottom-panel/HelpTab.tsx");

describe("first-run guide (I6)", () => {
  test("FirstRunGuide persists dismissal to localStorage", () => {
    const source = readFileSync(firstRunGuidePath, "utf8");
    expect(source).toContain("localStorage");
    expect(source).toContain("markFirstRunGuideDismissed");
  });

  test("FirstRunGuide exposes a reset function for re-showing the guide later", () => {
    const source = readFileSync(firstRunGuidePath, "utf8");
    expect(source).toContain("export function resetFirstRunGuideDismissal");
    expect(source).toMatch(/localStorage\.removeItem/);
  });

  test("FirstRunGuide reads the dismissal flag via a public helper", () => {
    const source = readFileSync(firstRunGuidePath, "utf8");
    expect(source).toContain("export function hasDismissedFirstRunGuide");
  });

  test("FirstRunGuide version key supports re-show on flow changes", () => {
    const source = readFileSync(firstRunGuidePath, "utf8");
    // The key must include a version suffix so a material flow change
    // can re-trigger the guide for users who've already dismissed it.
    expect(source).toMatch(/FIRST_RUN_DISMISSED_KEY\s*=\s*"[^"]*:v\d+/);
  });

  test("Help tab offers a 'Show First-Run Guide Again' button", () => {
    const source = readFileSync(helpTabPath, "utf8");
    expect(source).toContain("Show First-Run Guide Again");
    expect(source).toContain("help-show-first-run-guide");
    expect(source).toContain("resetFirstRunGuideDismissal");
  });

  test("Help tab button calls resetFirstRunGuideDismissal so the next session re-shows it", () => {
    const source = readFileSync(helpTabPath, "utf8");
    // Click handler must reset the dismissal flag — that's the contract:
    // clicking the button makes the guide reappear on next mount.
    expect(source).toContain("setShowFirstRunGuide(true)");
    expect(source).toMatch(/resetFirstRunGuideDismissal\(\)/);
  });
});