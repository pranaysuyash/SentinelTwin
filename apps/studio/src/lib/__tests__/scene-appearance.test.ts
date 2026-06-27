import { describe, expect, test } from "bun:test";

import {
  APPEARANCE_PRESETS,
  ENVIRONMENT_THEMES,
  FLOOR_PRESET_CHOICES,
  WALL_PRESET_CHOICES,
  applyNodeAppearance,
  hasAppearanceOverride,
  resolveAppearanceTextureScale,
  resolveAppearanceTextureStyle,
  resolveSceneLighting,
} from "@/lib/scene-appearance";
import { surfaceMaterial } from "@/lib/pbr-materials";
import type { NodeAppearance, SceneAppearance } from "@/schema/security-scene";

describe("appearance material resolution", () => {
  test("no layers returns the base spec unchanged", () => {
    const base = surfaceMaterial("wall");
    expect(applyNodeAppearance(base)).toEqual(base);
    expect(applyNodeAppearance(base, undefined, undefined)).toEqual(base);
  });

  test("preset overlays base values", () => {
    const base = surfaceMaterial("wall");
    const result = applyNodeAppearance(base, { preset: "brick" });
    expect(result.color).toBe(APPEARANCE_PRESETS.brick.spec.color!);
    expect(result.roughness).toBe(APPEARANCE_PRESETS.brick.spec.roughness!);
  });

  test("explicit fields beat the preset", () => {
    const base = surfaceMaterial("wall");
    const result = applyNodeAppearance(base, {
      preset: "brick",
      color: "#123456",
      roughness: 0.33,
    });
    expect(result.color).toBe("#123456");
    expect(result.roughness).toBe(0.33);
    expect(result.metalness).toBe(APPEARANCE_PRESETS.brick.spec.metalness!);
  });

  test("node layer wins over scene surface default", () => {
    const base = surfaceMaterial("wall");
    const sceneDefault: NodeAppearance = { preset: "concrete" };
    const nodeOverride: NodeAppearance = { preset: "wood", color: "#aa8855" };
    const result = applyNodeAppearance(base, sceneDefault, nodeOverride);
    expect(result.color).toBe("#aa8855");
    expect(result.roughness).toBe(APPEARANCE_PRESETS.wood.spec.roughness!);
  });

  test("opacity below 1 forces transparency", () => {
    const base = surfaceMaterial("wall");
    const result = applyNodeAppearance(base, { preset: "custom", opacity: 0.5 });
    expect(result.opacity).toBe(0.5);
    expect(result.transparent).toBe(true);
  });

  test("hasAppearanceOverride detects meaningful layers only", () => {
    expect(hasAppearanceOverride(undefined)).toBe(false);
    expect(hasAppearanceOverride({ preset: "default" })).toBe(false);
    expect(hasAppearanceOverride({ preset: "brick" })).toBe(true);
    expect(hasAppearanceOverride({ preset: "default", color: "#fff" })).toBe(true);
    expect(hasAppearanceOverride({ preset: "default" }, { preset: "wood" })).toBe(true);
  });
});

describe("appearance texture resolution", () => {
  test("default preset keeps the built-in texture (null)", () => {
    expect(resolveAppearanceTextureStyle({ preset: "default" })).toBeNull();
    expect(resolveAppearanceTextureStyle(undefined)).toBeNull();
  });

  test("highest-precedence non-default preset decides the style", () => {
    expect(resolveAppearanceTextureStyle({ preset: "concrete" }, { preset: "wood" })).toBe("wood");
    expect(resolveAppearanceTextureStyle({ preset: "concrete" }, undefined)).toBe("concrete");
    // A node explicitly set to default falls back to the scene default preset.
    expect(resolveAppearanceTextureStyle({ preset: "brick" }, { preset: "default" })).toBe("brick");
  });

  test("presets without procedural texture return null style", () => {
    expect(resolveAppearanceTextureStyle({ preset: "metal" })).toBeNull();
    expect(resolveAppearanceTextureStyle({ preset: "paint" })).toBeNull();
  });

  test("texture scale defaults to 1 and last defined wins", () => {
    expect(resolveAppearanceTextureScale(undefined)).toBe(1);
    expect(resolveAppearanceTextureScale({ preset: "tile", textureScale: 2 })).toBe(2);
    expect(
      resolveAppearanceTextureScale({ preset: "tile", textureScale: 2 }, { preset: "wood", textureScale: 0.5 }),
    ).toBe(0.5);
    expect(resolveAppearanceTextureScale({ preset: "tile", textureScale: -3 })).toBe(1);
  });
});

describe("scene lighting resolution", () => {
  test("no appearance returns the built-in theme values with defaults", () => {
    for (const mode of ["day", "dusk", "night"] as const) {
      const resolved = resolveSceneLighting(mode);
      expect(resolved.background).toBe(ENVIRONMENT_THEMES[mode].background);
      expect(resolved.ambient).toBe(ENVIRONMENT_THEMES[mode].ambient);
      expect(resolved.directional).toBe(ENVIRONMENT_THEMES[mode].directional);
      expect(resolved.practicalLights).toBe(true);
      expect(resolved.fogEnabled).toBe(true);
      expect(resolved.fogColor).toBe(ENVIRONMENT_THEMES[mode].background);
      expect(resolved.shadows).toBe(true);
      expect(resolved.iblIntensityScale).toBe(1);
    }
  });

  test("mode overrides merge over the theme and other modes stay untouched", () => {
    const appearance: SceneAppearance = {
      lighting: { night: { ambient: 1.5, background: "#111111", practicalLights: false } },
    };
    const night = resolveSceneLighting("night", appearance);
    expect(night.ambient).toBe(1.5);
    expect(night.background).toBe("#111111");
    expect(night.practicalLights).toBe(false);
    const day = resolveSceneLighting("day", appearance);
    expect(day.ambient).toBe(ENVIRONMENT_THEMES.day.ambient);
    expect(day.background).toBe(ENVIRONMENT_THEMES.day.background);
  });

  test("fog and environment blocks resolve with sane defaults", () => {
    const appearance: SceneAppearance = {
      fog: { enabled: false },
      environment: { iblIntensityScale: 0.5, toneMappingExposure: 1.2, shadows: false },
    };
    const resolved = resolveSceneLighting("day", appearance);
    expect(resolved.fogEnabled).toBe(false);
    expect(resolved.iblIntensityScale).toBe(0.5);
    expect(resolved.toneMappingExposure).toBe(1.2);
    expect(resolved.shadows).toBe(false);
  });

  test("negative or non-finite intensities fall back to the theme", () => {
    const appearance: SceneAppearance = {
      lighting: { day: { ambient: -2, directional: Number.NaN } },
    };
    const resolved = resolveSceneLighting("day", appearance);
    expect(resolved.ambient).toBe(ENVIRONMENT_THEMES.day.ambient);
    expect(resolved.directional).toBe(ENVIRONMENT_THEMES.day.directional);
  });
});

describe("preset catalog invariants", () => {
  test("every picker choice exists in the preset catalog", () => {
    for (const id of [...WALL_PRESET_CHOICES, ...FLOOR_PRESET_CHOICES]) {
      expect(APPEARANCE_PRESETS[id], id).toBeDefined();
    }
  });

  test("preset PBR bands stay physically plausible", () => {
    for (const [id, preset] of Object.entries(APPEARANCE_PRESETS)) {
      if (preset.spec.roughness !== undefined) {
        expect(preset.spec.roughness, id).toBeGreaterThanOrEqual(0);
        expect(preset.spec.roughness, id).toBeLessThanOrEqual(1);
      }
      if (preset.spec.metalness !== undefined) {
        expect(preset.spec.metalness, id).toBeGreaterThanOrEqual(0);
        expect(preset.spec.metalness, id).toBeLessThanOrEqual(1);
      }
    }
  });
});
