import { describe, expect, test } from "bun:test";

import { createSmallRetailShopScene } from "@/demo-scenes/small-retail-shop";
import { applyReportVisibility, buildReportData, exportAsHtml, exportAsMarkdown, exportAsText } from "@sentineltwin/report";
import { simulateStudio } from "@sentineltwin/simulation";

const testWithTimeout = test as unknown as (
  name: string,
  options: { timeout: number },
  fn: () => void,
) => void;

describe("report language guardrails", () => {
  testWithTimeout("keeps report exports framed as planning estimates rather than compliance rulings", { timeout: 10000 }, () => {
    const scene = createSmallRetailShopScene();
    scene.assumptions.doriStandard = "oodpcvs_2025";
    const result = simulateStudio(scene);
    const report = buildReportData(scene, result);

    const html = exportAsHtml(report);
    const markdown = exportAsMarkdown(report);
    const text = exportAsText(report);

    expect(html).toContain("IEC 62676-4:2025");
    expect(html).toContain("Meets modeled zone requirements");
    expect(markdown).toContain("IEC 62676-4:2025");
    expect(text).toContain("Modeled requirements");
  });

  test("includes audience-specific legal and commercial framing for consultant and facilities outputs", () => {
    const scene = createSmallRetailShopScene();
    const result = simulateStudio(scene);
    const consultantReport = buildReportData(scene, result, { audience: "consultant", visibility: "shared" });
    const facilitiesReport = buildReportData(scene, result, { audience: "facilities_director", visibility: "shared" });

    const consultantMarkdown = exportAsMarkdown(consultantReport);
    const facilitiesMarkdown = exportAsMarkdown(facilitiesReport);

    expect(consultantReport.commercialContext.distributionMessage).toContain("client-facing proposals");
    expect(consultantReport.commercialContext.legalBoundaryMessage).toContain("legal advice");
    expect(consultantMarkdown).toContain("Legal and Commercial Framing");
    expect(consultantMarkdown).toContain("Distribution Message");
    expect(facilitiesReport.commercialContext.distributionMessage).toContain("operations planning");
    expect(facilitiesMarkdown).toContain("Legal Boundary");
  });

  testWithTimeout("switches framing for shared vs private report visibility", { timeout: 10000 }, () => {
    const scene = createSmallRetailShopScene();
    const result = simulateStudio(scene);
    const operationsReport = buildReportData(scene, result, { audience: "operations_manager", visibility: "internal" });
    const sharedOperationsReport = applyReportVisibility(operationsReport, "shared");

    expect(sharedOperationsReport.commercialContext.distributionMessage).toContain("event planning");
    expect(sharedOperationsReport.commercialContext.internalMessage).toContain("Temporary-control packet");
  });
});
