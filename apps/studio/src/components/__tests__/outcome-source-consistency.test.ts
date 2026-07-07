import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

const outcomePanelPath = resolve(fileURLToPath(new URL(".", import.meta.url)), "../security-outcome/SecurityOutcomePanel.tsx");
const dashboardPath = resolve(fileURLToPath(new URL(".", import.meta.url)), "../launcher/StudioDashboardHome.tsx");
const reportViewPath = resolve(fileURLToPath(new URL(".", import.meta.url)), "../view/ReportView.tsx");
const issuesTabPath = resolve(fileURLToPath(new URL(".", import.meta.url)), "../bottom-panel/IssuesTab.tsx");
const compareViewPath = resolve(fileURLToPath(new URL(".", import.meta.url)), "../view/CompareView.tsx");

describe("Security outcome source consistency", () => {
  test("security outcome panel reads from canonical selector", () => {
    const source = readFileSync(outcomePanelPath, "utf8");
    expect(source).toContain("selectSecurityOutcomeFromStore");
    expect(source).toContain("<OutcomeSummaryCard summary={model.summary} />");
    expect(source).toContain("model.summary.primaryRisk");
  });

  test("dashboard, report, and issues surfaces consume canonical outcome status and primary risk", () => {
    const dashboardSource = readFileSync(dashboardPath, "utf8");
    expect(dashboardSource).toContain("selectSecurityOutcomeFromStore");
    expect(dashboardSource).toContain("canonicalOutcome.summary.criticalZonesPassing");
    expect(dashboardSource).toContain("canonicalOutcome.summary.primaryRisk");

    const reportSource = readFileSync(reportViewPath, "utf8");
    expect(reportSource).toContain("selectSecurityOutcomeFromStore");
    expect(reportSource).toContain("outcome.summary.status");
    expect(reportSource).toContain("outcome.summary.primaryRisk");

    const issuesSource = readFileSync(issuesTabPath, "utf8");
    expect(issuesSource).toContain("selectSecurityOutcomeFromStore");
    expect(issuesSource).toContain("outcome.summary.status");
    expect(issuesSource).toContain("outcome.summary.primaryRisk");
  });

  test("compare view derives baseline/proposed outcomes from canonical outcome model", () => {
    const source = readFileSync(compareViewPath, "utf8");
    expect(source).toContain("buildSecurityOutcomeModel");
    expect(source).toContain("Baseline outcome");
    expect(source).toContain("Proposed / Hardened outcome");
    expect(source).toContain("summary.status");
    expect(source).toContain("summary.primaryRisk");
  });
});
