import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

const routerPath = resolve(fileURLToPath(new URL(".", import.meta.url)), "../product/ProductViewRouter.tsx");
const pagePath = resolve(fileURLToPath(new URL(".", import.meta.url)), "../../app/page.tsx");

describe("Site Draft activation gate contract", () => {
  test("site intake launchers do not force-navigate scan/import builders outside handler guards", () => {
    const source = readFileSync(routerPath, "utf8");
    expect(source).toContain("onStartScan={() => {");
    expect(source).toContain("handlers.openScanWizard();");
    expect(source).not.toContain("handlers.openScanWizard();\n            navigate(\"scan_site\");");
    expect(source).toContain("onImportFloorPlan={() => {");
    expect(source).toContain("handlers.openFloorPlanFlow();");
    expect(source).toContain("onBuildManually={() => {");
    expect(source).toContain("handlers.startDesignFlow();");
  });

  test("compile/build success routes to site_draft_review while close/cancel routes back to site_intake", () => {
    const source = readFileSync(routerPath, "utf8");
    expect(source).toContain("handlers.createDraftFromScene(scene, \"scan\");");
    expect(source).toContain("navigate(\"site_draft_review\");");
    expect(source).toContain("onClose={() => {\n            navigate(\"site_intake\");");
    expect(source).toContain("handlers.createDraftFromScene(scene, \"manual\");");
    expect(source).toContain("handlers.createDraftFromScene(scene, \"floor_plan\");");
  });

  test("guided scan mode is preserved via product-view subContext", () => {
    const source = readFileSync(routerPath, "utf8");
    expect(source).toContain("mode={subContext === \"guided\" ? \"guided\" : \"manual\"}");
  });

  test("confirmation happens before workflow mutation in scan launch handlers", () => {
    const source = readFileSync(pagePath, "utf8");
    const scanConfirm = source.indexOf("if (!confirmWorkspaceReplacement(\"start scan intake\")) return;");
    const scanWorkflow = source.indexOf("setActiveWorkflow(\"scan\");");
    expect(scanConfirm).toBeGreaterThan(-1);
    expect(scanWorkflow).toBeGreaterThan(scanConfirm);

    const guidedConfirm = source.indexOf("if (!confirmWorkspaceReplacement(\"start guided scan intake\")) return;");
    const guidedWorkflow = source.indexOf("setActiveWorkflow(\"scan\");", scanWorkflow + 1);
    expect(guidedConfirm).toBeGreaterThan(-1);
    expect(guidedWorkflow).toBeGreaterThan(guidedConfirm);
  });

  test("draft creation path does not directly activate scene before approval", () => {
    const source = readFileSync(pagePath, "utf8");
    const createDraftStart = source.indexOf("const createDraftFromScene =");
    const createDraftEnd = source.indexOf("const approveIntakeSession =", createDraftStart);
    const createDraftBody = source.slice(createDraftStart, createDraftEnd);
    expect(createDraftBody).toContain("createSiteIntakeSession");
    expect(createDraftBody).toContain("setSiteIntakeSession(session);");
    expect(createDraftBody).not.toContain("setScene(");
  });
});
