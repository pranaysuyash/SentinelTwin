import { describe, expect, test } from "bun:test";

import { createSmallRetailShopScene } from "@/demo-scenes/small-retail-shop";
import { buildReportData, exportAsHtml, exportAsMarkdown, exportAsText } from "@sentineltwin/report";
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

    expect(html).toContain("This is a planning-oriented estimate and not a legal, forensic, or certified compliance ruling.");
    expect(markdown).toContain("This report is planning-grade and does not confer legal, forensic, or compliance certification.");
    expect(text).toContain("Planning estimate only; not a compliance certification.");
  });
});
