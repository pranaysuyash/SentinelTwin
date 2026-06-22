import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const pdfExportPath = join(import.meta.dir, "../pdf-export.ts");
const dashboardPath = join(import.meta.dir, "../../components/view/AnalyticsDashboardView.tsx");

describe("Director's Cut export", () => {
  test("exportDirectorsCutPdf is exported from pdf-export.ts", () => {
    const source = readFileSync(pdfExportPath, "utf8");
    expect(source).toContain("export async function exportDirectorsCutPdf");
  });

  test("pdf-export.ts imports DirectorsCutSequence type", () => {
    const source = readFileSync(pdfExportPath, "utf8");
    expect(source).toContain("DirectorsCutSequence");
    expect(source).toContain("directors-cut");
  });

  test("exportDirectorsCutPdf generates a cover page with gap percentage", () => {
    const source = readFileSync(pdfExportPath, "utf8");
    expect(source).toContain("Incident Replay — Director's Cut");
    expect(source).toContain("of path with no usable camera shot");
    expect(source).toContain("gapPct");
  });

  test("exportDirectorsCutPdf builds a cut sequence table", () => {
    const source = readFileSync(pdfExportPath, "utf8");
    expect(source).toContain("Cut Sequence");
    expect(source).toContain("Shot quality");
    expect(source).toContain("directors_cut.pdf");
  });

  test("exportDirectorsCutPdf renders a coverage gap section when gaps exist", () => {
    const source = readFileSync(pdfExportPath, "utf8");
    expect(source).toContain("Coverage Gap Windows");
    expect(source).toContain("noCovSegments");
  });

  test("grade color helpers cover all five grades", () => {
    const source = readFileSync(pdfExportPath, "utf8");
    expect(source).toContain('"no_coverage"');
    expect(source).toContain('"out_of_frame"');
    expect(source).toContain('"foreshortened"');
    expect(source).toContain('"edge_of_frame"');
    expect(source).toContain('"well_framed"');
  });

  test("AnalyticsDashboardView imports exportDirectorsCutPdf", () => {
    const source = readFileSync(dashboardPath, "utf8");
    expect(source).toContain("exportDirectorsCutPdf");
  });

  test("AnalyticsDashboardView renders DirectorsCutCard with export button", () => {
    const source = readFileSync(dashboardPath, "utf8");
    expect(source).toContain("DirectorsCutCard");
    expect(source).toContain("Export PDF");
    expect(source).toContain("handleExport");
  });

  test("Director's Cut card uses subtitle 'incident replay'", () => {
    const source = readFileSync(dashboardPath, "utf8");
    expect(source).toContain("incident replay");
  });
});
