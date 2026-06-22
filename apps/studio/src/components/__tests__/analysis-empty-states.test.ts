import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const files = [
  join(import.meta.dir, "../..", "components/bottom-panel/MetricsTab.tsx"),
  join(import.meta.dir, "../..", "components/bottom-panel/IssuesTab.tsx"),
  join(import.meta.dir, "../..", "components/bottom-panel/RedundancyTab.tsx"),
  join(import.meta.dir, "../..", "components/bottom-panel/NovelAlgorithmsTab.tsx"),
  join(import.meta.dir, "../..", "components/bottom-panel/CameraStatusSummaryPanel.tsx"),
  join(import.meta.dir, "../..", "components/security-outcome/OutcomeEmptyState.tsx"),
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
