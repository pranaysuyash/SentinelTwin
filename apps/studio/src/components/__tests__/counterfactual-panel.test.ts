import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const counterfactualPanelPath = join(import.meta.dir, "../..", "components/bottom-panel/CounterfactualPanel.tsx");

describe("CounterfactualPanel", () => {
  test("supports batch comparison and adversarial delta display", () => {
    const source = readFileSync(counterfactualPanelPath, "utf8");

    expect(source).toContain("Batch Compare");
    expect(source).toContain("Card View");
    expect(source).toContain("Route exposure");
    expect(source).toContain("Adversarial");
    expect(source).toContain("showBatchCompare");
  });
});
