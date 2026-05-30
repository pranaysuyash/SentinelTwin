import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const governanceReviewPanelPath = join(import.meta.dir, "../panels/GovernanceReviewPanel.tsx");

describe("GovernanceReviewPanel", () => {
  test("renders an actual branch diff summary instead of placeholder copy", () => {
    const source = readFileSync(governanceReviewPanelPath, "utf8");

    expect(source).toContain("Compared with main");
    expect(source).toContain("Change Summary");
    expect(source).toContain("Branch Details");
    expect(source).toContain("No branch snapshot is available to compare against main.");
    expect(source).toContain("Added");
    expect(source).toContain("Changed");
    expect(source).toContain("Removed");
  });
});
