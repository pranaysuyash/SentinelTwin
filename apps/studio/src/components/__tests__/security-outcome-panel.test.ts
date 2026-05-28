import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const panelPath = "/Users/pranay/Projects/SentinelTwin/apps/studio/src/components/security-outcome/SecurityOutcomePanel.tsx";

describe("SecurityOutcomePanel", () => {
  test("keeps the assumption disclosure visible in the compact security rail", () => {
    const source = readFileSync(panelPath, "utf8");

    expect(source).toContain("OutcomeSummaryCard");
    expect(source).toContain("IssueStack");
    expect(source).toContain("AssumptionDisclosure assumptions={scene.assumptions}");
    expect(source).toContain("PrivacyReview result={result} privacyZonesCount={scene.privacyZones.length}");
    expect(source).toContain("RedundancyMatrixPanel");
    expect(source).toContain("{!compact ? (");
    expect(source).toContain("PathOutcomeReview");
    expect(source).toContain("NightReadinessReview");
  });
});
