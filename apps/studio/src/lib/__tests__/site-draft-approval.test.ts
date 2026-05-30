import { describe, expect, test } from "bun:test";
import { createBlankSecurityScene } from "@/lib/scene-skeleton";
import { compileScanToSiteResult, compileToSiteTwinDraft } from "@/lib/site-compiler";
import { approveSiteTwinDraft } from "@/lib/site-draft-approval";

function createDraft() {
  const scene = createBlankSecurityScene();
  scene.cameras.push({
    id: "cam_1",
    nodeType: "camera",
    name: "Camera 1",
    position: [5, 3, 2],
    yawDeg: 0,
    pitchDeg: 0,
    rollDeg: 0,
    mountHeightM: 3,
    mountType: "wall",
    fovHorizontalDeg: 90,
    fovVerticalDeg: 60,
    rangeM: 30,
    resolutionMP: 8,
    resolutionWidth: 3840,
    resolutionHeight: 2160,
    lensType: "fixed",
    focalLengthMm: 4,
    status: "on",
    nightMode: "ir",
    irRangeM: 30,
    thermalCapable: false,
    ptz: false,
    clarity: "good",
    source: "manual",
    reviewStatus: "unreviewed",
    sourceTrace: "",
    geometryValidity: "valid",
    ndaaCompliant: true,
    privacyMaskingEnabled: false,
    tags: [],
  });
  scene.criticalZones.push({
    id: "zone_1",
    nodeType: "critical_zone",
    label: "Entry",
    targetType: "person_detection",
    priority: "high",
    requiredQuality: "recognition",
    polygon: [[1, 1], [2, 1], [2, 2], [1, 2]],
    heightM: 2.5,
    source: "manual",
    reviewStatus: "unreviewed",
    sourceTrace: "",
    geometryValidity: "valid",
    nightRequired: false,
    redundancyRequired: false,
    privacyZone: false,
  });
  return compileToSiteTwinDraft(compileScanToSiteResult(scene), ["scan-1.jpg"]);
}

describe("approveSiteTwinDraft", () => {
  test("approves a valid draft and returns baseline readiness", () => {
    const draft = createDraft();
    const result = approveSiteTwinDraft(draft);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.scene.id).toBe(draft.scene.id);
    expect(result.baselineReady).toBe(true);
    expect(result.provenanceLog.some((line) => line.includes(`draft=${draft.id}`))).toBe(true);
  });

  test("rejects an invalid draft scene", () => {
    const draft = createDraft();
    const invalid = { ...draft, scene: { invalid: true } as never };
    const result = approveSiteTwinDraft(invalid);
    expect(result.success).toBe(false);
  });

  test("does not mark baseline ready when prerequisites are missing", () => {
    const draft = createDraft();
    draft.scene.cameras = [];
    const result = approveSiteTwinDraft(draft);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.baselineReady).toBe(false);
  });
});
