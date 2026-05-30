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
});
