import { describe, expect, test } from "bun:test";

import {
  JEWELRY_STORE_SITE_TWIN_FILENAME,
  LEGACY_JEWELRY_STORE_UPLOAD_FILENAME,
  SAMPLE_SECURITY_SCENE_IMPORT_FILENAME,
  legacyRootJewelryStoreUploadPath,
  publicJewelryStoreSiteTwinPath,
  readSampleJson,
  readSampleText,
  sampleSecuritySceneImportPath,
} from "@/fixtures/sample-scene-files";
import { parseImportSceneDraft } from "@/lib/import-scene-draft";
import { createSiteIntakeSession } from "@/lib/site-compiler";
import { approveSiteTwinDraft } from "@/lib/site-draft-approval";
import { safeParseSecurityScene } from "@/schema/security-scene";

describe("sample Site Twin upload", () => {
  test("validates and passes through the JSON draft approval gate", () => {
    const payload = readSampleJson(sampleSecuritySceneImportPath);
    const importDraft = parseImportSceneDraft(payload);
    expect(importDraft.success).toBe(true);
    if (!importDraft.success) return;

    const parsed = safeParseSecurityScene(importDraft.scene);

    expect(parsed.success).toBe(true);
    if (!parsed.success) return;

    const session = createSiteIntakeSession(parsed.data, importDraft.source, [
      SAMPLE_SECURITY_SCENE_IMPORT_FILENAME,
    ]);

    expect(session.draft?.source).toBe("json");
    expect(session.stage).toBe("review");
    expect(session.draft?.entityCounts.cameras).toBe(1);
    expect(session.draft?.entityCounts.criticalZones).toBe(1);
    expect(session.draft?.entityCounts.entryPoints).toBe(1);

    const approval = approveSiteTwinDraft(session.draft!);
    expect(approval.success).toBe(true);
    if (!approval.success) return;
    expect(approval.baselineReady).toBe(true);
    expect(approval.scene.source).toBe("import");
  });

  test("keeps the richer jewelry-store upload sample valid", () => {
    const payload = readSampleJson(publicJewelryStoreSiteTwinPath);
    const parsed = safeParseSecurityScene(payload);

    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data.name).toContain("Jewelry Store");
    expect(parsed.data.cameras.length).toBeGreaterThanOrEqual(3);
    expect(parsed.data.criticalZones.length).toBeGreaterThanOrEqual(2);
  });

  test("keeps the restored public jewelry-store sample mirrored to the legacy upload file", () => {
    expect(readSampleText(publicJewelryStoreSiteTwinPath)).toBe(
      readSampleText(legacyRootJewelryStoreUploadPath),
    );
    expect(JEWELRY_STORE_SITE_TWIN_FILENAME).toBe("jewelry-store-site-twin.json");
    expect(LEGACY_JEWELRY_STORE_UPLOAD_FILENAME).toBe("sentineltwin_upload_test_jewelry_store.json");
  });
});
