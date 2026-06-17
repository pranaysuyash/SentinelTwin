import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

const debugTabPath = resolve(
  fileURLToPath(new URL(".", import.meta.url)),
  "../DebugTab.tsx",
);

const debugTogglesSlicePath = resolve(
  fileURLToPath(new URL(".", import.meta.url)),
  "../../../store/slices/core/debug-toggles-slice.ts",
);

describe("Debug Toggles UI surface (I20 — spec §11.6)", () => {
  test("DebugTab references the spec §11.6 section heading", () => {
    const source = readFileSync(debugTabPath, "utf8");
    expect(source).toContain("Debug Toggles (spec §11.6)");
  });

  test("DebugTab imports the labelled toggle list", () => {
    const source = readFileSync(debugTabPath, "utf8");
    expect(source).toMatch(/DEBUG_TOGGLE_LABELS/);
  });

  test("DebugTab reads per-toggle state from the studio store", () => {
    const source = readFileSync(debugTabPath, "utf8");
    // The 10 toggle names should appear in the multi-selector
    // that reads the debugToggles state.
    const expected = [
      "showCoverageGrid",
      "showRaycasts",
      "showOcclusionHits",
      "showFrustumBounds",
      "showPathSamplePoints",
      "showRecomputeTime",
      "showVisionColliders",
      "showPhysicsColliders",
      "showRawPpmValues",
      "showBvhRebuildTime",
    ];
    for (const key of expected) {
      expect(source, `DebugTab must reference ${key}`).toContain(key);
    }
  });

  test("DebugTab exposes a reset action", () => {
    const source = readFileSync(debugTabPath, "utf8");
    expect(source).toContain("resetDebugToggles");
    expect(source).toContain("Reset Toggles");
  });

  test("DebugToggles slice file is well-formed (no accidental StateCreator strict typing)", () => {
    // The slice uses a plain function (set, get) so it composes
    // cleanly with the existing studio-store wiring. StateCreator
    // with three generic slots is incompatible with the existing
    // create<>Slice pattern in this codebase.
    const source = readFileSync(debugTogglesSlicePath, "utf8");
    expect(source).toContain("createDebugTogglesSlice = (_set: any, _get: any)");
    expect(source).not.toMatch(/StateCreator<DebugTogglesSlice,\s*\[\],/);
  });
});