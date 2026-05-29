import { describe, expect, test } from "bun:test";

import { createBlankSecurityScene } from "@/lib/scene-skeleton";
import { parseSensorLiveFeed, summarizeSensorLiveFeed } from "@/lib/sensor-live-ingest";
import { createSensorNode } from "@/lib/node-factory";

describe("sensor live ingest", () => {
  test("parses JSON arrays into scene-matched sensor events", () => {
    const scene = createBlankSecurityScene();
    scene.name = "Ingest Scene";
    const sensor = createSensorNode([1, 1.2, 1], "motion");
    scene.sensors = [sensor];

    const parsed = parseSensorLiveFeed(JSON.stringify([
      { sensorId: sensor.id, kind: "triggered", details: "Motion detected" },
      { sensorLabel: sensor.label, kind: "heartbeat" },
    ]), scene.sensors);

    expect(parsed.errors).toHaveLength(0);
    expect(parsed.events).toHaveLength(2);
    expect(parsed.events[0]?.sensorId).toBe(sensor.id);
    expect(parsed.events[0]?.kind).toBe("triggered");
    expect(parsed.events[1]?.kind).toBe("heartbeat");
    expect(parsed.sourceCount).toBe(2);
  });

  test("accepts newline-delimited JSON and skips unmatched records", () => {
    const scene = createBlankSecurityScene();
    scene.name = "Ingest Scene";
    const sensor = createSensorNode([1, 1.2, 1], "motion");
    scene.sensors = [sensor];

    const parsed = parseSensorLiveFeed([
      JSON.stringify({ sensorLabel: "Unknown", kind: "faulted" }),
      JSON.stringify({ sensorLabel: sensor.label, kind: "restored", resultingState: "active" }),
    ].join("\n"), scene.sensors);

    expect(parsed.events).toHaveLength(1);
    expect(parsed.events[0]?.sensorId).toBe(sensor.id);
    expect(parsed.events[0]?.resultingState).toBe("active");
    expect(parsed.errors.length).toBeGreaterThan(0);
  });

  test("summarizes parsed sensor metadata with scene context", async () => {
    const scene = createBlankSecurityScene();
    scene.name = "Ingest Scene";
    const sensor = createSensorNode([1, 1.2, 1], "motion");
    scene.sensors = [sensor];

    const summary = await summarizeSensorLiveFeed({
      source: "debug-panel",
      sceneId: scene.id,
      sceneName: scene.name,
      submittedAt: 1710000002000,
      ingestMode: "paste",
      raw: JSON.stringify([{ sensorId: sensor.id, kind: "heartbeat" }]),
      sensors: scene.sensors,
    });

    expect(summary.ok).toBe(true);
    expect(summary.source).toBe("debug-panel");
    expect(summary.sceneId).toBe(scene.id);
    expect(summary.summary).toContain("Imported 1 sensor event");
    expect(summary.receivedAt).toBe("2024-03-09T16:00:02.000Z");
  });

  test("summarizes external feed metadata fetched from a live URL", async () => {
    const scene = createBlankSecurityScene();
    scene.name = "External Feed Scene";
    const sensor = createSensorNode([1, 1.2, 1], "motion");
    scene.sensors = [sensor];

    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async () => new Response(JSON.stringify([
      { sensorId: sensor.id, kind: "triggered", details: "Remote motion detected" },
    ]), {
      status: 200,
      headers: { "content-type": "application/json" },
    })) as typeof fetch;

    try {
      const summary = await summarizeSensorLiveFeed({
        source: "sensors-tab",
        sceneId: scene.id,
        sceneName: scene.name,
        submittedAt: 1710000003000,
        ingestMode: "external",
        feedUrl: "https://example.com/live-sensor-feed",
        feedLabel: "ONVIF relay",
        raw: "",
        sensors: scene.sensors,
      });

      expect(summary.ok).toBe(true);
      expect(summary.ingestMode).toBe("external");
      expect(summary.feedUrl).toBe("https://example.com/live-sensor-feed");
      expect(summary.summary).toContain("via ONVIF relay");
      expect(summary.events).toHaveLength(1);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
