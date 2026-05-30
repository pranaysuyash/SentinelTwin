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

  test("adds a temporal twin summary when checkpoint evidence is available", () => {
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
      issues: [],
      recommendations: [],
      criticalZoneResults: [],
    } as never;
    const scene = {
      changeLog: ["Scene created"],
    };

    const lines = buildReportSummaryLines(outcome, result, scene, {
      totalEvents: 4,
      checkpointCount: 2,
      publishedCheckpointCount: 1,
      latestCheckpointProvenance: {
        sourceEventId: "event_latest",
        sourceEventTitle: "Initial checkpoint",
        sourceEventTimestamp: 1000,
        isExactSnapshot: false,
        derivedFromEarlierSnapshot: true,
        sourceSnapshotDistance: 2,
        sourceSnapshotAgeMs: 120000,
      },
      latestPublishedCheckpointProvenance: {
        sourceEventId: "event_published",
        sourceEventTitle: "Published checkpoint",
        sourceEventTimestamp: 3000,
        isExactSnapshot: true,
        derivedFromEarlierSnapshot: false,
        sourceSnapshotDistance: 0,
        sourceSnapshotAgeMs: 60000,
      },
      latestCheckpointAgeMs: 120000,
      latestPublishedCheckpointAgeMs: 60000,
      currentVsLatestCheckpointDelta: { cameras: 1, lights: 0, obstructions: 0, zones: 0, paths: 0, sensors: 1, snapshots: 0 },
      currentVsLatestPublishedCheckpointDelta: { cameras: 2, lights: 0, obstructions: 0, zones: 0, paths: 0, sensors: 1, snapshots: 0 },
    });

    expect(lines).toEqual([
      { label: "Critical Issue", text: "Cash counter has a blind spot." },
      { label: "Primary Cause", text: "Coverage requires a scene or camera adjustment." },
      { label: "Impact", text: "Current simulated coverage is 71% with 1/2 critical zones passing." },
      { label: "Recommendation", text: "No verified recommendation is available yet." },
      { label: "Evidence Trail", text: "1 change-log entries, 0 evidence entries, 0 sensor-related evidence" },
      { label: "Temporal Twin", text: "4 scene events, 2 reconstructable checkpoints, 1 published checkpoint, latest checkpoint 2m old, latest checkpoint derived from \"Initial checkpoint\", latest published 1m old, latest published exact snapshot from \"Published checkpoint\", checkpoint delta cams +1, published delta cams +2" },
    ]);
  });
});
