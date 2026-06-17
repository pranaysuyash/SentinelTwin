import { describe, expect, test } from "bun:test";

import {
  DEBUG_TOGGLE_KEYS,
  DEBUG_TOGGLE_LABELS,
  createDebugTogglesSlice,
  type DebugTogglesSlice,
} from "@/store/slices/core/debug-toggles-slice";

function makeSlice() {
  let state: DebugTogglesSlice = createDebugTogglesSlice(
    (patch: Partial<DebugTogglesSlice>) => {
      state = { ...state, ...patch };
    },
    () => state,
  );
  return {
    get: () => state,
    set: (patch: Partial<DebugTogglesSlice>) => {
      state = { ...state, ...patch };
    },
  };
}

describe("Debug Toggles slice (I20 — spec §11.6)", () => {
  test("exports the 10 spec'd toggle keys", () => {
    expect(DEBUG_TOGGLE_KEYS).toHaveLength(10);
    expect(DEBUG_TOGGLE_KEYS).toContain("showCoverageGrid");
    expect(DEBUG_TOGGLE_KEYS).toContain("showRaycasts");
    expect(DEBUG_TOGGLE_KEYS).toContain("showOcclusionHits");
    expect(DEBUG_TOGGLE_KEYS).toContain("showFrustumBounds");
    expect(DEBUG_TOGGLE_KEYS).toContain("showPathSamplePoints");
    expect(DEBUG_TOGGLE_KEYS).toContain("showRecomputeTime");
    expect(DEBUG_TOGGLE_KEYS).toContain("showVisionColliders");
    expect(DEBUG_TOGGLE_KEYS).toContain("showPhysicsColliders");
    expect(DEBUG_TOGGLE_KEYS).toContain("showRawPpmValues");
    expect(DEBUG_TOGGLE_KEYS).toContain("showBvhRebuildTime");
  });

  test("exports labelled entries for every toggle key", () => {
    expect(DEBUG_TOGGLE_LABELS).toHaveLength(DEBUG_TOGGLE_KEYS.length);
    for (const key of DEBUG_TOGGLE_KEYS) {
      const entry = DEBUG_TOGGLE_LABELS.find((e) => e.key === key);
      expect(entry, `Missing label for ${key}`).toBeDefined();
      expect(entry?.label.length ?? 0).toBeGreaterThan(0);
      expect(entry?.description.length ?? 0).toBeGreaterThan(0);
    }
  });

  test("default state has every toggle off", () => {
    const slice = makeSlice();
    for (const key of DEBUG_TOGGLE_KEYS) {
      expect(slice.get()[key], `${key} should default to false`).toBe(false);
    }
  });

  test("setDebugToggle flips a single flag", () => {
    const slice = makeSlice();
    slice.get().setDebugToggle("showRaycasts", true);
    expect(slice.get().showRaycasts).toBe(true);
    expect(slice.get().showCoverageGrid).toBe(false);
    // Other toggles are untouched.
  });

  test("resetDebugToggles returns the slice to defaults", () => {
    const slice = makeSlice();
    slice.get().setDebugToggle("showRaycasts", true);
    slice.get().setDebugToggle("showFrustumBounds", true);
    expect(slice.get().showRaycasts).toBe(true);
    expect(slice.get().showFrustumBounds).toBe(true);
    slice.get().resetDebugToggles();
    for (const key of DEBUG_TOGGLE_KEYS) {
      expect(slice.get()[key], `${key} should reset to false`).toBe(false);
    }
  });
});