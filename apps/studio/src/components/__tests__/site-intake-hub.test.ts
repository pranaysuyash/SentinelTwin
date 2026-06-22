import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

const siteIntakeHubPath = resolve(fileURLToPath(new URL(".", import.meta.url)), "../site-intake/SiteIntakeHub.tsx");

describe("SiteIntakeHub", () => {
  test("uses guided-plus-review intake language and schema-aligned output binding", () => {
    const source = readFileSync(siteIntakeHubPath, "utf8");

    expect(source).toContain("Guided capture + manual review");
    expect(source).toContain("Choose how you want to start.");
    expect(source).toContain("Output");
    expect(source).toContain('Output:');
    expect(source).toContain('{card.output}');
  });

  test("uses truthful maturity language for all sources", () => {
    const source = readFileSync(siteIntakeHubPath, "utf8");

    expect(source).toContain("Automatic segmentation/depth reconstruction is still rolling out; candidate confirmation is required.");
    expect(source).toContain("Review required before use.");
    expect(source).toContain("Best-effort wall/opening extraction");
    expect(source).toContain("Manual correction may be needed.");
    expect(source).toContain("No product-grade video/stream verification yet");
    expect(source).toContain("Local-only mode is available");
    expect(source).not.toContain("Your data is secure and never shared");
  });

  test("scan card does not claim automatic reconstruction", () => {
    const source = readFileSync(siteIntakeHubPath, "utf8");

    expect(source).not.toContain("automatic reconstruction");
    expect(source).not.toContain("automatic depth estimation");
    expect(source).not.toContain("3D model");
  });

  test("recent-site and quick-import controls are wired to real actions", () => {
    const source = readFileSync(siteIntakeHubPath, "utf8");

    expect(source).toContain("onClick={props.onEnterStudio}");
    expect(source).toContain("props.onOpenRecentSite");
    expect(source).toContain("props.onOpenRecentSite(site.id)");
    expect(source).toContain("props.onEnterStudio()");
    expect(source).toContain("onClick={props.onImportJson}");
    expect(source).toContain("SAMPLE_SECURITY_SCENE_IMPORT_URL");
    expect(source).toContain("JEWELRY_STORE_SITE_TWIN_IMPORT_URL");
    expect(source).toContain("download=\"sample-security-scene-import.json\"");
    expect(source).toContain("download=\"jewelry-store-site-twin.json\"");
    expect(source).not.toContain(">How it works<");
  });

  test("selected source details are source-specific instead of scan-only copy", () => {
    const source = readFileSync(siteIntakeHubPath, "utf8");

    expect(source).toContain("{selected.detail.headline}");
    expect(source).toContain("{selected.detail.cta}");
    expect(source).not.toContain("from reviewed photo markers.</div>");
  });

  test("import affordances match the JSON-only import handler", () => {
    const source = readFileSync(siteIntakeHubPath, "utf8");

    expect(source).toContain("Import Site Twin");
    expect(source).toContain("Draft-gated");
    expect(source).toContain("What you");
    expect(source).not.toContain("Import JSON or floor plan");
    expect(source).not.toContain("Manual-assisted · {selected.status}");
  });
});
