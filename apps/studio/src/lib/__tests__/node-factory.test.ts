import { describe, expect, test } from "bun:test";

import {
  createCameraNode,
  createCriticalZoneNode,
  createDoorNode,
  createEntryPointNode,
  createObstructionNode,
  createPrivacyZoneNode,
  createScenarioPathNode,
  createSecurityLightNode,
  createSensorNode,
  createWallNode,
  createWindowNode,
} from "@/lib/node-factory";
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

  test("creates schema-valid scene editor nodes", () => {
    const scene = createBlankSecurityScene();

    const camera = createCameraNode([2.5, 2.4, 4.2]);
    const obstruction = createObstructionNode([3.2, 1, 4.8], "shelf");
    const light = createSecurityLightNode([1.5, 2.8, 2.5]);
    const wall = createWallNode([1, 1], [5, 1]);
    const door = createDoorNode([2, 0, 1], wall.id);
    const windowNode = createWindowNode([4, 1.4, 1], wall.id);
    const zone = createCriticalZoneNode([
      [2, 2],
      [5, 2],
      [5, 4],
    ]);
    const privacyZone = createPrivacyZoneNode([
      [6, 2],
      [7, 2],
      [7, 3],
    ]);
    const entryPoint = createEntryPointNode([1.2, 2.4]);
    const path = createScenarioPathNode([
      { position: [1.2, 2.4] },
      { position: [3.2, 3.2] },
    ]);

    scene.cameras.push(camera);
    scene.obstructions.push(obstruction);
    scene.securityLights.push(light);
    scene.walls.push(wall);
    scene.doors.push(door);
    scene.windows.push(windowNode);
    scene.criticalZones.push(zone);
    scene.privacyZones.push(privacyZone);
    scene.entryPoints.push(entryPoint);
    scene.paths.push(path);

    const parsed = safeParseSecurityScene(scene);
    expect(parsed.success).toBe(true);
    expect(camera.id.startsWith("cam_")).toBe(true);
    expect(obstruction.id.startsWith("obs_")).toBe(true);
    expect(light.id.startsWith("light_")).toBe(true);
    expect(wall.id.startsWith("wall_")).toBe(true);
    expect(door.id.startsWith("door_")).toBe(true);
    expect(windowNode.id.startsWith("window_")).toBe(true);
    expect(zone.id.startsWith("zone_")).toBe(true);
    expect(privacyZone.id.startsWith("privacy_")).toBe(true);
    expect(entryPoint.id.startsWith("entry_")).toBe(true);
    expect(path.id.startsWith("path_")).toBe(true);
  });

  test("rejects invalid zone and path geometry", () => {
    expect(() => createCriticalZoneNode([[1, 1], [2, 2]])).toThrow();
    expect(() => createPrivacyZoneNode([[1, 1], [2, 2]])).toThrow();
    expect(() => createScenarioPathNode([{ position: [1, 1] }])).toThrow();
  });
});
