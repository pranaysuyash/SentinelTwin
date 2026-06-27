import { describe, expect, test } from "bun:test";

import { cloneSecuritySceneSimulation, parseSecurityScene } from "@/schema/security-scene";
import { smallRetailShopScene } from "@/demo-scenes/small-retail-shop";

describe("SecurityScene schema", () => {
  test("accepts the canonical small retail shop demo scene", () => {
    const parsed = parseSecurityScene(smallRetailShopScene);

    expect(parsed.name).toBe("Small Retail Shop Demo");
    expect(parsed.source).toBe("demo");
    expect(parsed.cameras).toHaveLength(smallRetailShopScene.cameras.length);
    expect(parsed.securityLights).toHaveLength(1);
    expect(parsed.sensors).toHaveLength(0);
    expect(parsed.criticalZones[0]?.requiredQuality).toBe("recognition");
    expect(parsed.paths[0]?.intent).toBe("authorized");
  });

  test("rejects legacy scene source aliases", () => {
    expect(() =>
      parseSecurityScene({
        ...smallRetailShopScene,
        source: "scan_import",
      }),
    ).toThrow(/source/i);
  });

  test("rejects a camera without required operational fields", () => {
    const invalidScene = {
      ...smallRetailShopScene,
      cameras: [
        {
          ...smallRetailShopScene.cameras[0],
          status: undefined,
        },
      ],
    };

    expect(() => parseSecurityScene(invalidScene)).toThrow(/status/i);
  });
});

describe("scene appearance layer (rendering-only)", () => {
  test("accepts a scene with sceneAppearance and node appearance overrides", () => {
    const parsed = parseSecurityScene({
      ...smallRetailShopScene,
      sceneAppearance: {
        lighting: { night: { ambient: 1.2, background: "#101018", practicalLights: false } },
        fog: { enabled: false },
        environment: { iblIntensityScale: 0.8, toneMappingExposure: 1.1, shadows: true },
        surfaces: {
          floor: { preset: "wood", textureScale: 2 },
          wall: { preset: "brick", color: "#9c5a44" },
        },
      },
      walls: [
        { ...smallRetailShopScene.walls[0], appearance: { preset: "concrete", roughness: 0.6 } },
        ...smallRetailShopScene.walls.slice(1),
      ],
      obstructions: [
        { ...smallRetailShopScene.obstructions[0], appearance: { preset: "metal", color: "#aeb4bc" } },
        ...smallRetailShopScene.obstructions.slice(1),
      ],
    });
    expect(parsed.sceneAppearance?.surfaces?.floor?.preset).toBe("wood");
    expect(parsed.sceneAppearance?.lighting?.night?.ambient).toBe(1.2);
    expect(parsed.walls[0]?.appearance?.preset).toBe("concrete");
    expect(parsed.obstructions[0]?.appearance?.color).toBe("#aeb4bc");
  });

  test("rejects an unknown appearance preset", () => {
    expect(() =>
      parseSecurityScene({
        ...smallRetailShopScene,
        sceneAppearance: { surfaces: { floor: { preset: "chrome_hologram" } } },
      }),
    ).toThrow(/preset/i);
  });

  test("scenes without appearance stay valid (backward compatible)", () => {
    const parsed = parseSecurityScene(smallRetailShopScene);
    expect(parsed.sceneAppearance).toBeUndefined();
  });

  test("cloneSecuritySceneSimulation strips sceneAppearance so the engine cannot see it", () => {
    const parsed = parseSecurityScene({
      ...smallRetailShopScene,
      sceneAppearance: { surfaces: { wall: { preset: "brick" } } },
    });
    const simClone = cloneSecuritySceneSimulation(parsed);
    expect(simClone.sceneAppearance).toBeUndefined();
    // Geometry-relevant fields survive untouched.
    expect(simClone.walls).toHaveLength(parsed.walls.length);
    expect(simClone.assumptions).toEqual(parsed.assumptions);
  });
});
