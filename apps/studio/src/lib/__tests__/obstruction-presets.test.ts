import { describe, expect, it } from "bun:test";

import {
  CUSTOM_OBSTRUCTION_PRESET_ID,
  OBSTRUCTION_PRESETS,
  getObstructionPreset,
  resolvePresetDimensions,
} from "@/lib/obstruction-presets";
import { createObstructionNode } from "@/lib/node-factory";
import { obstructionNodeSchema } from "@/schema/security-scene";

describe("obstruction preset catalog", () => {
  it("every preset compiles into a schema-valid ObstructionNode", () => {
    for (const preset of OBSTRUCTION_PRESETS) {
      const dimensions = resolvePresetDimensions(preset, [1, 1, 1]);
      const node = createObstructionNode([2, dimensions[2] / 2, 2], preset.obstructionType, {
        dimensions,
        material: preset.material,
        visionTransmission: preset.visionTransmission,
        glareRisk: preset.glareRisk,
        nightIRReflective: preset.nightIRReflective,
        movable: preset.movable,
      });
      const parsed = obstructionNodeSchema.safeParse(node);
      expect(parsed.success, `preset ${preset.id} produced an invalid node: ${JSON.stringify(parsed.success ? null : parsed.error.issues)}`).toBe(true);
    }
  });

  it("preset dimensions are positive and use [width, depth, height] with sane heights", () => {
    for (const preset of OBSTRUCTION_PRESETS) {
      expect(preset.dimensions.every((dim) => dim > 0)).toBe(true);
      // Height (index 2) should be realistic for indoor/outdoor objects.
      expect(preset.dimensions[2]).toBeGreaterThanOrEqual(0.5);
      expect(preset.dimensions[2]).toBeLessThanOrEqual(3.5);
    }
  });

  it("glass display transmits vision partially; solid objects block fully", () => {
    const glass = getObstructionPreset("glass_display");
    expect(glass.visionTransmission).toBeGreaterThan(0);
    const shelf = getObstructionPreset("shelf");
    expect(shelf.visionTransmission).toBe(0);
  });

  it("custom preset honors user dimensions with a minimum floor", () => {
    const custom = getObstructionPreset(CUSTOM_OBSTRUCTION_PRESET_ID);
    expect(resolvePresetDimensions(custom, [2.5, 0.8, 1.4])).toEqual([2.5, 0.8, 1.4]);
    expect(resolvePresetDimensions(custom, [0, -1, 0.01])).toEqual([0.05, 0.05, 0.05]);
  });

  it("falls back to the first preset for unknown ids", () => {
    expect(getObstructionPreset("does_not_exist").id).toBe(OBSTRUCTION_PRESETS[0].id);
  });
});
