import { afterAll, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { once } from "node:events";
import http from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { NextRequest } from "next/server";

import { GET, POST } from "../route";

const createNextRequest = (url: string, init?: RequestInit): NextRequest => (
  new Request(url, init) as any as unknown as any
);

const originalStoreDir = process.env.SENTINELTWIN_CAMERA_METADATA_STORE_DIR;
const testStoreDir = mkdtempSync(join(tmpdir(), "sentineltwin-camera-metadata-"));

process.env.SENTINELTWIN_CAMERA_METADATA_STORE_DIR = testStoreDir;

afterAll(() => {
  rmSync(testStoreDir, { recursive: true, force: true });
  if (typeof originalStoreDir === "undefined") {
    delete process.env.SENTINELTWIN_CAMERA_METADATA_STORE_DIR;
  } else {
    process.env.SENTINELTWIN_CAMERA_METADATA_STORE_DIR = originalStoreDir;
  }
});

describe("camera-metadata-ingest route", () => {
  test("archives a live camera metadata feed and persists history", async () => {
    const response = await POST(createNextRequest("http://localhost/api/camera-metadata-ingest", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        source: "camera-inspector",
        ingestMode: "paste",
        sceneId: "scene-camera",
        sceneName: "Camera Scene",
        submittedAt: 1_725_000_006_000,
        raw: JSON.stringify([
          { cameraId: "cam_front", status: "dirty", clarity: "poor", notes: "Lens blur reported" },
        ]),
        cameras: [
          {
            id: "cam_front",
            name: "Front Entrance",
            status: "on",
            clarity: "good",
            nightMode: "none",
          },
        ],
      }),
    }));

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.ok).toBe(true);
    expect(body.historyCount).toBe(1);
    expect(body.summary).toContain("Imported 1 camera metadata record");
    expect(body.records).toHaveLength(1);

    const history = await GET(createNextRequest("http://localhost/api/camera-metadata-ingest"));
    const payload = await history.json();
    expect(payload.historyCount).toBe(1);
    expect(payload.latestSubmission.records[0].status).toBe("dirty");
  });

  test("pulls an external camera metadata feed URL through the canonical ingest route", async () => {
    const externalFeedServer = http.createServer((request, response) => {
      request.resume();
      request.on("end", () => {
        response.writeHead(200, { "content-type": "application/json" });
        response.end(JSON.stringify([
          { cameraName: "Front Entrance", status: "malfunctioning", clarity: "poor", feedMode: "thermal", notes: "Thermal anomaly detected" },
        ]));
      });
    });

    try {
      externalFeedServer.listen(0, "127.0.0.1");
      await once(externalFeedServer, "listening");
      const address = externalFeedServer.address();
      if (!address || typeof address === "string") {
        throw new Error("External camera feed test server did not expose a numeric port.");
      }

      const response = await POST(createNextRequest("http://localhost/api/camera-metadata-ingest", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          source: "camera-inspector",
          ingestMode: "external",
          feedUrl: `http://127.0.0.1:${address.port}/feed`,
          feedLabel: "ONVIF relay",
          sceneId: "scene-camera-external",
          sceneName: "External Camera Scene",
          submittedAt: 1_725_000_007_000,
          raw: "",
          cameras: [
            {
              id: "cam_front",
              name: "Front Entrance",
              status: "on",
              clarity: "good",
              nightMode: "none",
            },
          ],
        }),
      }));

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.ok).toBe(true);
      expect(body.ingestMode).toBe("external");
      expect(body.feedUrl).toBe(`http://127.0.0.1:${address.port}/feed`);
      expect(body.records).toHaveLength(1);
      expect(body.summary).toContain("via ONVIF relay");
    } finally {
      externalFeedServer.close();
    }
  });
});
