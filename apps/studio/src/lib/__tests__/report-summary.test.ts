import { describe, expect, test } from "bun:test";

import { buildReportSummaryLines } from "@/lib/report-summary";
import type { SecurityOutcomeModel } from "@/lib/security-outcome/security-outcome-model";

describe("buildReportSummaryLines", () => {
  test("derives a four-part executive summary from outcome data", () => {
    const outcome = {
      summary: {
        status: "needs_attention",
        headline: "Headline",
        coveragePct: 71.4,
        blindspotPct: 12.3,
        criticalZonesPassing: 1,
        criticalZonesTotal: 2,
        worstIssue: {
          id: "issue_0",
          severity: "high",
          category: "quality_fail",
          description: "Cash counter has a blind spot.",
          affectedZones: ["Cash Counter"],
          affectedCameras: ["Camera 1"],
        },
        issueCount: 3,
        nightReadiness: "weak",
        redundancyStatus: "single_point_failure",
      },
      topIssues: [],
      allIssues: [],
      recommendations: [],
      pathOutcome: null,
    } as SecurityOutcomeModel;

    const result = {
      issues: [
        { category: "blindspot", description: "Main entry is not fully covered." },
      ],
      recommendations: [
        { description: "Add a camera.", verified: true },
      ],
      criticalZoneResults: [],
    } as never;
    const scene = {
      changeLog: [
        "Scene created",
        "Evidence: May 29, 10:00 AM | Sensor Triggered | Front door contact triggered near Camera 1 | high",
      ],
    };

    const lines = buildReportSummaryLines(outcome, result, scene);
    expect(lines).toEqual([
      { label: "Critical Issue", text: "Cash counter has a blind spot." },
      { label: "Primary Cause", text: "Main entry is not fully covered." },
      { label: "Impact", text: "Current simulated coverage is 71% with 1/2 critical zones passing." },
      { label: "Recommendation", text: "Add a camera. (verified)" },
      { label: "Evidence Trail", text: "2 change-log entries, 1 evidence entries, 1 sensor-related evidence" },
    ]);
  });
});
