import { describe, expect, test } from "bun:test";

import { truthLabelDetail, truthLabelText } from "@/lib/truth-labels";

describe("truth labels", () => {
  test("provide canonical labels and details for visible claims", () => {
    expect(truthLabelText("computed")).toBe("Computed");
    expect(truthLabelText("simulated")).toBe("Simulated");
    expect(truthLabelText("placeholder")).toBe("Placeholder");
    expect(truthLabelDetail("imported")).toContain("Imported from scene data");
    expect(truthLabelDetail("live")).toContain("live runtime state");
  });
});
