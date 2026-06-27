import { describe, expect, test } from "bun:test";
import * as THREE from "three";

import {
  applyR3FCanvasPreset,
  defaultShadowCaster,
  environmentIntensityFor,
  presetKey,
  R3F_PRESETS,
  r3fCanvasPropsForTier,
  shadowMapSizeFor,
} from "../r3f-rendering";

describe("r3f-rendering presets", () => {
  test("every tier has the same tone mapping and color space", () => {
    const tone = R3F_PRESETS.high.toneMapping;
    const space = R3F_PRESETS.high.outputColorSpace;
    for (const tier of ["low", "medium", "high"] as const) {
      expect(R3F_PRESETS[tier].toneMapping).toBe(tone);
      expect(R3F_PRESETS[tier].outputColorSpace).toBe(space);
    }
    expect(tone).toBe(THREE.ACESFilmicToneMapping);
    expect(space).toBe(THREE.SRGBColorSpace);
  });

  test("low tier disables shadows and antialias; high tier enables both", () => {
    expect(R3F_PRESETS.low.shadowMapEnabled).toBe(false);
    expect(R3F_PRESETS.low.antialias).toBe(false);
    expect(R3F_PRESETS.high.shadowMapEnabled).toBe(true);
    expect(R3F_PRESETS.high.antialias).toBe(true);
  });

  test("shadow map size scales with tier", () => {
    expect(shadowMapSizeFor("low")).toEqual([512, 512]);
    expect(shadowMapSizeFor("medium")).toEqual([1024, 1024]);
    expect(shadowMapSizeFor("high")).toEqual([2048, 2048]);
  });

  test("environment intensity stays in [0, 1] for every tier", () => {
    for (const tier of ["low", "medium", "high"] as const) {
      const v = environmentIntensityFor(tier);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    }
  });

  test("r3fCanvasPropsForTier returns a sensible DPR range per tier", () => {
    const low = r3fCanvasPropsForTier("low");
    const high = r3fCanvasPropsForTier("high");
    expect(low.dpr[0]).toBeLessThan(high.dpr[0]);
    expect(low.dpr[1]).toBeLessThan(high.dpr[1]);
    expect(low.gl.powerPreference).toBe("low-power");
    expect(high.gl.powerPreference).toBe("high-performance");
  });

  test("applyR3FCanvasPreset mutates the renderer in place", () => {
    // Build a renderer-like object that records assignments. We use a
    // minimal stub so we don't need a real WebGL context for the unit
    // test; the function under test only writes to gl.toneMapping,
    // toneMappingExposure, outputColorSpace, and shadowMap.
    const calls: string[] = [];
    const gl = {
      toneMapping: 0,
      toneMappingExposure: 0,
      outputColorSpace: 0,
      shadowMap: { enabled: false, type: 0 },
    };
    const fakeRenderer = new Proxy(gl, {
      set(target, key, value) {
        calls.push(String(key));
        (target as unknown as Record<string | symbol, unknown>)[key] = value;
        return true;
      },
    });
    applyR3FCanvasPreset(fakeRenderer as unknown as THREE.WebGLRenderer, "high");
    expect(calls).toContain("toneMapping");
    expect(calls).toContain("toneMappingExposure");
    expect(calls).toContain("outputColorSpace");
    expect(gl.shadowMap.enabled).toBe(true);
    expect(gl.shadowMap.type).toBe(THREE.PCFSoftShadowMap);
  });

  test("defaultShadowCaster scales frustum to scene size", () => {
    const low = defaultShadowCaster(4, "low");
    const large = defaultShadowCaster(40, "high");
    expect(large.shadowCamera.right - large.shadowCamera.left).toBeGreaterThan(
      low.shadowCamera.right - low.shadowCamera.left,
    );
  });

  test("presetKey is stable and unique per tier", () => {
    expect(presetKey("low")).not.toBe(presetKey("high"));
    expect(presetKey("medium")).not.toBe(presetKey("high"));
    expect(presetKey("low")).toBe(presetKey("low"));
  });
});
