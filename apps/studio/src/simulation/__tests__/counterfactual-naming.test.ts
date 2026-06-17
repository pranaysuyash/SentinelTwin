import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

const runnerPath = resolve(fileURLToPath(new URL(".", import.meta.url)), "../counterfactual-runner.ts");
const simulationSlicePath = resolve(fileURLToPath(new URL(".", import.meta.url)), "../../store/slices/core/simulation-slice.ts");

describe("counterfactual naming (I12)", () => {
  test("studio-side counterfactual file is named counterfactual-runner (not -engine)", () => {
    // Per first principles, the studio-side file is a *runner* that
    // coordinates the simulation engine and the agent proposer. The
    // previous name `counterfactual-engine` collided with
    // @sentineltwin/simulation as the canonical engine.
    expect(runnerPath).toMatch(/counterfactual-runner\.ts$/);
  });

  test("counterfactual-runner file documents the three-surface split", () => {
    const source = readFileSync(runnerPath, "utf8");
    expect(source).toContain("three counterfactual surfaces");
    expect(source).toContain("counterfactual-search");
    expect(source).toContain("counterfactual-agent");
    expect(source).toContain("counterfactual-runner");
  });

  test("simulation-slice imports the runner under its new name", () => {
    const source = readFileSync(simulationSlicePath, "utf8");
    expect(source).toMatch(/from\s+"@\/simulation\/counterfactual-runner"/);
    // The old import path must be gone.
    expect(source).not.toMatch(/from\s+"@\/simulation\/counterfactual-engine"/);
  });

  test("no studio code references counterfactual-engine anymore", () => {
    const source = readFileSync(simulationSlicePath, "utf8");
    expect(source).not.toContain("counterfactual-engine");
  });
});