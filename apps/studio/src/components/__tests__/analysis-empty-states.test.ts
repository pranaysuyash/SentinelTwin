import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const files = [
  "./src/components/bottom-panel/MetricsTab.tsx",
  "./src/components/bottom-panel/IssuesTab.tsx",
  "./src/components/bottom-panel/RedundancyTab.tsx",
  "./src/components/bottom-panel/NovelAlgorithmsTab.tsx",
  "./src/components/bottom-panel/CameraStatusSummaryPanel.tsx",
  "./src/components/security-outcome/OutcomeEmptyState.tsx",
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
