import { describe, expect, test } from "bun:test";

import type { CriticalZoneNode } from "@sentineltwin/core";
import { createTestScene } from "./helpers";
import {
  explainAdversarialTargetSelection,
  selectAdversarialTargetZone,
  selectCounterCriticalZone,
  selectHighestPriorityCriticalZone,
} from "@sentineltwin/simulation";

function makeZone(overrides: Partial<CriticalZoneNode>): CriticalZoneNode {
  return {
    id: overrides.id ?? "zone_default",
    nodeType: "critical_zone",
    label: overrides.label ?? "Zone",
    polygon: overrides.polygon ?? [[0, 0], [1, 0], [1, 1], [0, 1]],
    heightM: overrides.heightM ?? 2,
    priority: overrides.priority ?? "medium",
    requiredQuality: overrides.requiredQuality ?? "recognition",
    targetType: overrides.targetType ?? "person_detection",
    nightRequired: overrides.nightRequired ?? false,
    redundancyRequired: overrides.redundancyRequired ?? false,
    privacyZone: overrides.privacyZone ?? false,
    source: "manual",
    reviewStatus: "unreviewed",
    sourceTrace: "",
    geometryValidity: "valid",
    ...overrides,
  };
}

function makeSceneWithZones(criticalZones: CriticalZoneNode[]) {
  const scene = createTestScene();
  scene.criticalZones = criticalZones;
  return scene;
}

describe("critical zone selector", () => {
  test("selects required-quality first when policy is requiredQuality-first", () => {
    const scene = makeSceneWithZones([
      makeZone({ id: "zone_low", label: "A", requiredQuality: "outline", priority: "critical" }),
      makeZone({ id: "zone_high", label: "B", requiredQuality: "identification", priority: "low" }),
      makeZone({ id: "zone_mid", label: "C", requiredQuality: "recognition", priority: "high" }),
    ]);

    const selected = selectHighestPriorityCriticalZone(scene, { policy: "requiredQuality-first" });

    expect(selected?.id).toBe("zone_high");
  });

  test("selects priority first when policy is priority-first", () => {
    const scene = makeSceneWithZones([
      makeZone({ id: "zone_a", label: "PriorityA", requiredQuality: "outline", priority: "low" }),
      makeZone({ id: "zone_b", label: "PriorityB", requiredQuality: "scrutinize", priority: "critical" }),
      makeZone({ id: "zone_c", label: "PriorityC", requiredQuality: "recognition", priority: "high" }),
    ]);

    const selected = selectHighestPriorityCriticalZone(scene, { policy: "priority-first" });

    expect(selected?.id).toBe("zone_b");
  });

  test("selectCounterCriticalZone prefers explicit targetType signals before labels", () => {
    const scene = makeSceneWithZones([
      makeZone({ id: "zone_1", label: "North Wall", requiredQuality: "identification", targetType: "person_detection" }),
      makeZone({ id: "zone_2", label: "Counter", requiredQuality: "recognition", targetType: "cash_counter_activity" }),
      makeZone({ id: "zone_3", label: "Cash Desk", requiredQuality: "scrutinize", targetType: "vehicle_detection" }),
    ]);

    const selected = selectCounterCriticalZone(scene, { policy: "requiredQuality-first" });

    expect(selected?.id).toBe("zone_2");
  });

  test("selectCounterCriticalZone falls back when no counter intent exists", () => {
    const scene = makeSceneWithZones([
      makeZone({ id: "zone_a", label: "A", requiredQuality: "detection", priority: "low" }),
      makeZone({ id: "zone_b", label: "B", requiredQuality: "scrutinize", priority: "critical" }),
    ]);

    const selected = selectCounterCriticalZone(scene, { policy: "counter-first" });

    expect(selected?.id).toBe("zone_b");
  });

  test("provides explanation for no candidates", () => {
    const scene = makeSceneWithZones([]);
    const decision = explainAdversarialTargetSelection(scene, { policy: "counter-first" });

    expect(decision.zoneId).toBeNull();
    expect(decision.fallbackApplied).toBe("no-candidates");
    expect(decision.candidateCount).toBe(0);
  });

  test("keeps counter-first behavior in adversarial selector with fallback rationale", () => {
    const scene = makeSceneWithZones([
      makeZone({ id: "zone_match", label: "checkout queue", requiredQuality: "detection", targetType: "person_detection" }),
      makeZone({ id: "zone_best", label: "Vault", requiredQuality: "identification", targetType: "vehicle_detection" }),
    ]);

    const selected = selectAdversarialTargetZone(scene, { policy: "counter-first" });
    const decision = explainAdversarialTargetSelection(scene, { policy: "counter-first" });

    expect(selected?.id).toBe("zone_match");
    expect(decision.selectedAsCounter).toBe(true);
    expect(decision.fallbackApplied).toBe("none");
  });
});
