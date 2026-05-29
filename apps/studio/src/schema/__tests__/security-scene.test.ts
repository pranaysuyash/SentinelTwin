import { describe, expect, test } from "bun:test";

import { parseSecurityScene } from "@/schema/security-scene";
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
