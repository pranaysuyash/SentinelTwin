import { afterAll, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { once } from "node:events";
import http from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { NextRequest } from "next/server";

import { createBlankSecurityScene } from "@/lib/scene-skeleton";
import { createSensorNode } from "@/lib/node-factory";

import { GET, POST } from "../route";

const createNextRequest = (url: string, init?: RequestInit): NextRequest => (
  new Request(url, init) as unknown as NextRequest
);

const originalStoreDir = process.env.SENTINELTWIN_SENSOR_INGEST_STORE_DIR;
const testStoreDir = mkdtempSync(join(tmpdir(), "sentineltwin-sensor-ingest-"));

process.env.SENTINELTWIN_SENSOR_INGEST_STORE_DIR = testStoreDir;

afterAll(() => {
  rmSync(testStoreDir, { recursive: true, force: true });
  if (typeof originalStoreDir === "undefined") {
    delete process.env.SENTINELTWIN_SENSOR_INGEST_STORE_DIR;
  } else {
    process.env.SENTINELTWIN_SENSOR_INGEST_STORE_DIR = originalStoreDir;
  }
});

describe("sensor-ingest route", () => {
  test("queues a sensor ingest and persists history", async () => {
    const scene = createBlankSecurityScene();
    scene.name = "Ingest Scene";
    const sensor = createSensorNode([1, 1.2, 1], "motion");
    scene.sensors = [sensor];

    const response = await POST(
      createNextRequest("http://localhost/api/sensor-ingest", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          source: "debug-panel",
          sceneId: "scene-1",
          sceneName: "Ingest Scene",
          submittedAt: 1710000001000,
          raw: JSON.stringify([{ sensorId: sensor.id, kind: "triggered", details: "Motion detected" }]),
          sensors: scene.sensors,
        }),
      }),
    );

    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.ok).toBe(true);
    expect(payload.source).toBe("debug-panel");
    expect(payload.historyCount).toBe(1);
    expect(payload.summary).toContain("Imported 1 sensor event");
    expect(payload.sceneId).toBe("scene-1");

    const historyResponse = await GET(createNextRequest("http://localhost/api/sensor-ingest"));
    expect(historyResponse.status).toBe(200);
    const historyPayload = await historyResponse.json();
    expect(historyPayload.ok).toBe(true);
    expect(historyPayload.historyCount).toBe(1);
    expect(historyPayload.latestSubmission?.sceneName).toBe("Ingest Scene");
  });

  test("rejects invalid payloads", async () => {
    const response = await POST(
      createNextRequest("http://localhost/api/sensor-ingest", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ raw: "" }),
      }),
    );

    expect(response.status).toBe(400);
    const payload = await response.json();
    expect(payload.ok).toBe(false);
    expect(payload.error).toContain("Invalid sensor ingest payload");
  });

  test("pulls an external feed URL through the canonical ingest route", async () => {
    const receivedRequests: string[] = [];
    const sensorServer = http.createServer((request, response) => {
      request.resume();
      request.on("end", () => {
        receivedRequests.push(`${request.method ?? "GET"} ${request.url ?? "/"}`);
        response.writeHead(200, { "content-type": "application/json" });
        response.end(JSON.stringify([
          { sensorLabel: "Front Door", kind: "heartbeat", details: "Remote heartbeat received" },
        ]));
      });
    });

    try {
      sensorServer.listen(0, "127.0.0.1");
      await once(sensorServer, "listening");
      const address = sensorServer.address();
      if (!address || typeof address === "string") {
        throw new Error("External feed test server did not expose a numeric port.");
      }

      const response = await POST(createNextRequest("http://localhost/api/sensor-ingest", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          source: "sensors-tab",
          ingestMode: "external",
          feedUrl: `http://127.0.0.1:${address.port}/feed`,
          feedLabel: "External relay",
          sceneId: "scene-sensor-external",
          sceneName: "External Sensor Scene",
          submittedAt: 1_725_000_001_000,
          raw: "",
          sensors: [
            (() => {
              const sensor = createSensorNode([1, 1.2, 1], "motion");
              sensor.label = "Front Door";
              return sensor;
            })(),
          ],
        }),
      }));

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.ok).toBe(true);
      expect(body.ingestMode).toBe("external");
      expect(body.feedUrl).toBe(`http://127.0.0.1:${address.port}/feed`);
      expect(body.events).toHaveLength(1);
      expect(body.summary).toContain("via External relay");
      expect(receivedRequests).toHaveLength(1);
      const history = await GET(createNextRequest("http://localhost/api/sensor-ingest"));
      const payload = await history.json();
      expect(payload.historyCount).toBeGreaterThan(0);
      expect(payload.latestSubmission.feedUrl).toBe(`http://127.0.0.1:${address.port}/feed`);
    } finally {
      sensorServer.close();
    }
  });
});
