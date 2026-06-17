import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

const helpersPath = resolve(fileURLToPath(new URL(".", import.meta.url)), "../selector-helpers.ts");
const studioStorePath = resolve(fileURLToPath(new URL(".", import.meta.url)), "../studio-store.ts");

describe("Zustand selector memoization (I11)", () => {
  test("selector-helpers re-exports useShallow with a documented contract", () => {
    const source = readFileSync(helpersPath, "utf8");
    expect(source).toContain("export { useShallow }");
    expect(source).toContain("useShallow");
  });

  test("useShallow contract says single-field selectors do NOT need it", () => {
    const source = readFileSync(helpersPath, "utf8");
    // The doc must explicitly state that single-field selectors are
    // already memoized by Zustand's default Object.is comparison.
    expect(source).toMatch(/Single-field selectors don't need this/);
  });

  test("useShallow contract says it prevents re-renders on unrelated store changes", () => {
    const source = readFileSync(helpersPath, "utf8");
    expect(source).toContain("re-renders only when the selected fields change");
  });

  test("studio-store does not import useShallow directly (helper file is the path)", () => {
    // Defensive: components that want shallow comparison should go
    // through the helper so the contract is documented in one place.
    const source = readFileSync(studioStorePath, "utf8");
    expect(source).not.toMatch(/import.*useShallow/);
  });
});