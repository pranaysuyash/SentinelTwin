import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const reportViewPath = new URL("../view/ReportView.tsx", import.meta.url);

describe("ReportView", () => {
  test("renders the report workspace with outcome and report-lite panels", () => {
    const source = readFileSync(reportViewPath, "utf8");

    expect(source).toContain("Report Workspace");
    expect(source).toContain("Verified Outcome");
    expect(source).toContain("Report Lite");
    expect(source).toContain("Simulation verified");
    expect(source).toContain("SecurityOutcomePanel compact={false}");
    expect(source).toContain("ReportLiteTab");
    expect(source).toContain("Coverage Entropy");
    expect(source).toContain("Fragility");
    expect(source).toContain("K-Robustness");
    expect(source).toContain("K-Robustness Critical Sets");
    expect(source).toContain("Blind Regions");
    expect(source).toContain("Uncertainty");
    expect(source).toContain("Posture");
    expect(source).toContain("Temporal Anomalies");
    expect(source).toContain("Worst Drop");
    expect(source).toContain("Privacy Zones");
    expect(source).toContain("Restricted Cells");
    expect(source).toContain("Privacy Issues");
    expect(source).toContain("Sensors");
    expect(source).toContain("Redundant Zones");
    expect(source).toContain("SPOF Zones");
    expect(source).toContain("Uncovered Zones");
  });
});
