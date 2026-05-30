import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

const siteIntakeHubPath = resolve(fileURLToPath(new URL(".", import.meta.url)), "../site-intake/SiteIntakeHub.tsx");

describe("SiteIntakeHub", () => {
  test("uses manual-assisted intake language and schema-aligned output binding", () => {
    const source = readFileSync(siteIntakeHubPath, "utf8");

    expect(source).toContain("Manual-assisted");
    expect(source).toContain("Output");
    expect(source).toContain("{selected.output}");
    expect(source).not.toContain("{selected.detail.output}");
  });

  test("uses truthful maturity language for all sources", () => {
    const source = readFileSync(siteIntakeHubPath, "utf8");

    expect(source).toContain("No automatic segmentation or depth");
    expect(source).toContain("Review required before trust");
    expect(source).toContain("Best-effort wall/opening extraction");
    expect(source).toContain("Manual correction required");
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
});
