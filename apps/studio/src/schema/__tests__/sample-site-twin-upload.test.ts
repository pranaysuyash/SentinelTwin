import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { parseImportSceneDraft } from "@/lib/import-scene-draft";
import { createSiteIntakeSession } from "@/lib/site-compiler";
import { approveSiteTwinDraft } from "@/lib/site-draft-approval";
import { safeParseSecurityScene } from "@/schema/security-scene";

const quickImportSamplePath = resolve(
  import.meta.dir,
  "../../../public/sample-security-scene-import.json",
);
const jewelryStoreSamplePath = resolve(
  import.meta.dir,
  "../../../public/sample-site-twins/jewelry-store-site-twin.json",
);

describe("sample Site Twin upload", () => {
  test("validates and passes through the JSON draft approval gate", () => {
    const payload = JSON.parse(readFileSync(quickImportSamplePath, "utf8"));
    const importDraft = parseImportSceneDraft(payload);
    expect(importDraft.success).toBe(true);
    if (!importDraft.success) return;

    const parsed = safeParseSecurityScene(importDraft.scene);

    expect(parsed.success).toBe(true);
    if (!parsed.success) return;

    const session = createSiteIntakeSession(parsed.data, importDraft.source, [
      "sample-security-scene-import.json",
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
    const payload = JSON.parse(readFileSync(jewelryStoreSamplePath, "utf8"));
    const parsed = safeParseSecurityScene(payload);

    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data.name).toContain("Jewelry Store");
    expect(parsed.data.cameras.length).toBeGreaterThanOrEqual(3);
    expect(parsed.data.criticalZones.length).toBeGreaterThanOrEqual(2);
  });
});
