import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const files = [
  "/Users/pranay/Projects/SentinelTwin/apps/studio/src/components/bottom-panel/MetricsTab.tsx",
  "/Users/pranay/Projects/SentinelTwin/apps/studio/src/components/bottom-panel/IssuesTab.tsx",
  "/Users/pranay/Projects/SentinelTwin/apps/studio/src/components/bottom-panel/RedundancyTab.tsx",
  "/Users/pranay/Projects/SentinelTwin/apps/studio/src/components/bottom-panel/NovelAlgorithmsTab.tsx",
  "/Users/pranay/Projects/SentinelTwin/apps/studio/src/components/bottom-panel/CameraStatusSummaryPanel.tsx",
  "/Users/pranay/Projects/SentinelTwin/apps/studio/src/components/security-outcome/OutcomeEmptyState.tsx",
];

describe("analysis empty states", () => {
  test("expose the shared simulation prompt instead of passive guidance", () => {
    const sources = files.map((file) => readFileSync(file, "utf8"));

    for (const source of sources) {
      expect(source).toContain("RunSimulationPrompt");
      expect(source).toContain("Run the shared simulation");
    }
  });
});
