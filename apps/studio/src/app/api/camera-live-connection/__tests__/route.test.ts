import { afterAll, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { once } from "node:events";
import http from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { GET, POST } from "../route";

const originalStoreDir = process.env.SENTINELTWIN_CAMERA_LIVE_CONNECTION_STORE_DIR;
const testStoreDir = mkdtempSync(join(tmpdir(), "sentineltwin-camera-live-connection-"));

process.env.SENTINELTWIN_CAMERA_LIVE_CONNECTION_STORE_DIR = testStoreDir;

afterAll(() => {
  rmSync(testStoreDir, { recursive: true, force: true });
  if (typeof originalStoreDir === "undefined") {
    delete process.env.SENTINELTWIN_CAMERA_LIVE_CONNECTION_STORE_DIR;
  } else {
    process.env.SENTINELTWIN_CAMERA_LIVE_CONNECTION_STORE_DIR = originalStoreDir;
  }
});

describe("camera-live-connection route", () => {
  test("archives a live connection probe and persists history", async () => {
    const response = await POST(new Request("http://localhost/api/camera-live-connection", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        source: "camera-inspector",
        action: "bind",
        protocol: "onvif",
        cameraId: "cam_front",
        cameraName: "Front Entrance",
        sceneId: "scene-camera",
        sceneName: "Camera Scene",
        submittedAt: 1_725_000_008_000,
        raw: JSON.stringify({
          cameraId: "cam_front",
          cameraName: "Front Entrance",
          liveFeedUrl: "rtsp://camera.example.com/live",
          liveFeedLabel: "Front entrance live feed",
          liveConnectionMode: "onvif",
          liveConnectionStatus: "connected",
          notes: "ONVIF relay reachable",
        }),
      }),
    }));

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.ok).toBe(true);
    expect(body.historyCount).toBe(1);
    expect(body.summary).toContain("archived the live connection");
    expect(body.record.liveConnectionStatus).toBe("connected");

    const history = await GET();
    const payload = await history.json();
    expect(payload.historyCount).toBe(1);
    expect(payload.latestSubmission.record.liveFeedUrl).toBe("rtsp://camera.example.com/live");
  });

  test("probes an external live connection endpoint through the canonical route", async () => {
    const externalConnectionServer = http.createServer((request, response) => {
      request.resume();
      request.on("end", () => {
        response.writeHead(200, { "content-type": "application/json" });
        response.end(JSON.stringify({
          cameraId: "cam_front",
          cameraName: "Front Entrance",
          liveFeedUrl: "rtsp://camera.example.com/live",
          liveFeedLabel: "Front entrance live feed",
          liveConnectionMode: "onvif",
          liveConnectionStatus: "connected",
          notes: "Connection healthy",
        }));
      });
    });

    try {
      externalConnectionServer.listen(0, "127.0.0.1");
      await once(externalConnectionServer, "listening");
      const address = externalConnectionServer.address();
      if (!address || typeof address === "string") {
        throw new Error("External live connection test server did not expose a numeric port.");
      }

      const response = await POST(new Request("http://localhost/api/camera-live-connection", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          source: "camera-inspector",
          action: "bind",
          protocol: "onvif",
          endpointUrl: `http://127.0.0.1:${address.port}/probe`,
          liveFeedUrl: `http://127.0.0.1:${address.port}/probe`,
          feedLabel: "ONVIF relay",
          cameraId: "cam_front",
          cameraName: "Front Entrance",
          sceneId: "scene-camera-external",
          sceneName: "External Camera Scene",
          submittedAt: 1_725_000_009_000,
          raw: "",
        }),
      }));

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.ok).toBe(true);
      expect(body.protocol).toBe("onvif");
      expect(body.record.liveConnectionStatus).toBe("connected");
      expect(body.summary).toContain("ONVIF");
    } finally {
      externalConnectionServer.close();
    }
  });

  test("parses an ONVIF-style XML live connection endpoint through the canonical route", async () => {
    const xmlConnectionServer = http.createServer((request, response) => {
      request.resume();
      request.on("end", () => {
        response.writeHead(200, { "content-type": "application/xml" });
        response.end(`<?xml version="1.0" encoding="UTF-8"?>
          <Envelope>
            <Body>
              <ProbeResponse>
                <DeviceName>Front Entrance</DeviceName>
                <CameraId>cam_front</CameraId>
                <Uri>rtsp://camera.example.com/live</Uri>
                <Label>Front entrance live feed</Label>
                <Mode>onvif</Mode>
                <Status>connected</Status>
                <Notes>ONVIF relay reachable</Notes>
              </ProbeResponse>
            </Body>
          </Envelope>`);
      });
    });

    try {
      xmlConnectionServer.listen(0, "127.0.0.1");
      await once(xmlConnectionServer, "listening");
      const address = xmlConnectionServer.address();
      if (!address || typeof address === "string") {
        throw new Error("XML connection test server did not expose a numeric port.");
      }

      const response = await POST(new Request("http://localhost/api/camera-live-connection", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          source: "camera-inspector",
          action: "bind",
          protocol: "onvif",
          endpointUrl: `http://127.0.0.1:${address.port}/probe`,
          liveFeedUrl: `http://127.0.0.1:${address.port}/probe`,
          feedLabel: "ONVIF relay",
          cameraId: "cam_front",
          cameraName: "Front Entrance",
          sceneId: "scene-camera-xml",
          sceneName: "XML Camera Scene",
          submittedAt: 1_725_000_009_500,
          raw: "",
        }),
      }));

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.ok).toBe(true);
      expect(body.protocol).toBe("onvif");
      expect(body.record.liveConnectionStatus).toBe("connected");
      expect(body.record.liveFeedUrl).toBe("rtsp://camera.example.com/live");
    } finally {
      xmlConnectionServer.close();
    }
  });

  test("archives a disconnect action through the canonical route", async () => {
    const response = await POST(new Request("http://localhost/api/camera-live-connection", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        source: "camera-inspector",
        action: "disconnect",
        protocol: "onvif",
        cameraId: "cam_front",
        cameraName: "Front Entrance",
        sceneId: "scene-camera",
        sceneName: "Camera Scene",
        submittedAt: 1_725_000_010_000,
        raw: "",
      }),
    }));

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.ok).toBe(true);
    expect(body.record.liveConnectionStatus).toBe("disconnected");
    expect(body.summary).toContain("Disconnected Front Entrance");
  });
});
