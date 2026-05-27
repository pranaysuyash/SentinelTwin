import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const launcherPath = "/Users/pranay/Projects/SentinelTwin/apps/studio/src/app/page.tsx";

describe("Studio launcher workflow", () => {
  test("surfaces the explicit 5-step guided workflow from goal2", () => {
    const source = readFileSync(launcherPath, "utf8");

    expect(source).toContain("Guided Security Workflow (Goal2)");
    expect(source).toContain("1. What are you trying to protect?");
    expect(source).toContain("2. Choose input: template, floor plan, or scan.");
    expect(source).toContain("3. Build scene: walls, openings, cameras, obstructions, zones.");
    expect(source).toContain("4. Run baseline simulation + inspect pass/fail and blind spots.");
    expect(source).toContain("5. Next action: replay route, test night/failure, generate report.");
    expect(source).toContain("Run Baseline");
  });
});
