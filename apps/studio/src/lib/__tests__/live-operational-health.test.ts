import { describe, expect, it } from "bun:test";

import { createSmallRetailShopScene } from "@/demo-scenes/small-retail-shop";
import { buildOperationalEvidenceEvent, type OperationalEvidenceEvent } from "@/lib/operational-evidence";
import { buildLiveOperationalHealth } from "@/lib/security-analytics";

function evidenceEvent(overrides: Partial<Parameters<typeof buildOperationalEvidenceEvent>[0]> & { timestamp: number }): OperationalEvidenceEvent {
  return buildOperationalEvidenceEvent({
    kind: "sensor_heartbeat",
    title: "Sensor heartbeat received",
    details: "details",
    actor: "system",
    source: "system",
    sceneId: "scene_1",
    sceneName: "Scene",
    revisionDepth: 0,
    affectedNodeIds: [],
    confidence: 0.9,
    ...overrides,
  });
}

describe("buildLiveOperationalHealth", () => {
  it("returns an empty-but-honest summary when no live events exist", () => {
    const scene = createSmallRetailShopScene();
    const summary = buildLiveOperationalHealth(scene, []);

    expect(summary.trackedSensors).toBe(0);
    expect(summary.trackedCameras).toBe(0);
    expect(summary.alerts).toEqual([]);
  });

  it("tracks the most recent sensor event and flags a fault", () => {
    const scene = createSmallRetailShopScene();
    const events = [
      evidenceEvent({
        kind: "sensor_heartbeat",
        title: "Sensor heartbeat received",
        affectedNodeIds: ["sensor_1"],
        timestamp: 1000,
      }),
      evidenceEvent({
        kind: "sensor_faulted",
        title: "Sensor fault reported",
        affectedNodeIds: ["sensor_1"],
        timestamp: 2000,
      }),
    ];

    const summary = buildLiveOperationalHealth(scene, events);

    expect(summary.trackedSensors).toBe(1);
    expect(summary.faultedSensors).toBe(1);
    expect(summary.alerts).toHaveLength(1);
    expect(summary.alerts[0]?.status).toBe("fault");
    expect(summary.alerts[0]?.lastEventTitle).toBe("Sensor fault reported");
  });

  it("resolves a sensor restoration to healthy and clears the alert", () => {
    const scene = createSmallRetailShopScene();
    const events = [
      evidenceEvent({
        kind: "sensor_faulted",
        title: "Sensor fault reported",
        affectedNodeIds: ["sensor_1"],
        timestamp: 1000,
      }),
      evidenceEvent({
        kind: "sensor_restored",
        title: "Sensor restored",
        affectedNodeIds: ["sensor_1"],
        timestamp: 2000,
      }),
    ];

    const summary = buildLiveOperationalHealth(scene, events);

    expect(summary.trackedSensors).toBe(1);
    expect(summary.faultedSensors).toBe(0);
    expect(summary.alerts).toEqual([]);
  });

  it("classifies camera live connection updates by status keyword", () => {
    const scene = createSmallRetailShopScene();
    const cameraId = scene.cameras[0]!.id;
    const events = [
      evidenceEvent({
        kind: "camera_live_connection_updated",
        title: "Camera Live Connection: error",
        affectedNodeIds: [cameraId],
        timestamp: 1000,
      }),
    ];

    const summary = buildLiveOperationalHealth(scene, events);

    expect(summary.trackedCameras).toBe(1);
    expect(summary.degradedCameras).toBe(1);
    expect(summary.alerts[0]?.status).toBe("fault");
    expect(summary.alerts[0]?.label).toBe(scene.cameras[0]!.name);
  });
});
