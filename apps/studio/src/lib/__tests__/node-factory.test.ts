import { describe, expect, test } from "bun:test";

import { createSensorNode } from "@/lib/node-factory";
import { safeParseSecurityScene } from "@/schema/security-scene";
import { createBlankSecurityScene } from "@/lib/scene-skeleton";

describe("node factory", () => {
  test("creates a schema-valid sensor node", () => {
    const sensor = createSensorNode([2.5, 2.4, 4.2], "door_contact");
    const scene = createBlankSecurityScene();

    scene.sensors.push(sensor);

    const parsed = safeParseSecurityScene(scene);
    expect(parsed.success).toBe(true);
    expect(sensor.id.startsWith("sensor_")).toBe(true);
    expect(sensor.nodeType).toBe("sensor");
    expect(sensor.sensorType).toBe("door_contact");
    expect(sensor.coverageMode).toBe("detection");
    expect(sensor.state).toBe("active");
  });
});
