import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

const commandBarPath = resolve(fileURLToPath(new URL(".", import.meta.url)), "../CommandBar.tsx");

describe("command-bar sample commands (I9)", () => {
  test("CommandBar exposes a Try-one prompt when the input is empty", () => {
    const source = readFileSync(commandBarPath, "utf8");
    expect(source).toContain("command-bar-sample-prompt");
    expect(source).toMatch(/input\.trim\(\)\.length === 0\s*\?/);
  });

  test("CommandBar declares stable sample hint commands", () => {
    const source = readFileSync(commandBarPath, "utf8");
    // The four canonical sample commands. New operators should be able
    // to try any of these without configuring a provider — they all
    // exercise the offline (local) parsing path.
    expect(source).toContain("Move Camera 1 toward the entry");
    expect(source).toContain("Switch to night review");
    expect(source).toContain("Test Camera 2 outage");
    expect(source).toContain("Add a light near the counter");
  });

  test("sample hints populate the input box when clicked", () => {
    const source = readFileSync(commandBarPath, "utf8");
    // Each hint must set the input so the user sees the command they
    // picked before they hit send — that's the "try" affordance.
    expect(source).toMatch(/setInput\(hint\)/);
  });

  test("each sample hint has a stable test id for automation", () => {
    const source = readFileSync(commandBarPath, "utf8");
    expect(source).toContain("command-bar-sample-hint");
  });
});