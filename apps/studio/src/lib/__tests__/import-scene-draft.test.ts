import { describe, expect, test } from "vitest";

import { fixtureJewelryStoreUploadPath, readSampleJson } from "@/fixtures/sample-scene-files";
import { parseImportSceneDraft } from "@/lib/import-scene-draft";
import { safeParseSecurityScene } from "@/schema/security-scene";

describe("parseImportSceneDraft", () => {
  test("parses jewelry store fixture into a draft-ready SecurityScene", () => {
    const raw = readSampleJson(fixtureJewelryStoreUploadPath);

    const schemaCheck = safeParseSecurityScene(raw);
    expect(schemaCheck.success).toBe(true);

    const result = parseImportSceneDraft(raw);
    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.source).toBe("json");
    expect(result.scene.name).toBe("Jewelry Store Site Twin");
    expect(result.scene.source).toBe("import");
    expect(result.scene.cameras.length).toBeGreaterThanOrEqual(3);
    expect(result.scene.criticalZones.length).toBeGreaterThanOrEqual(2);
  });

  test("returns validation error for malformed payload", () => {
    const result = parseImportSceneDraft({ foo: "bar" });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.length).toBeGreaterThan(0);
  });
});
