import { describe, expect, test } from "bun:test";

import { summarizeCameraMetadataLiveFeed } from "@/lib/camera-metadata-live-ingest";

describe("camera metadata live ingest", () => {
  test("parses XML metadata feeds into scene-matched camera records", async () => {
    const cameras = [
      { id: "cam-1", name: "North Gate", status: "on" as const, clarity: "good" as const, nightMode: "none" as const },
      { id: "cam-2", name: "South Gate", status: "on" as const, clarity: "good" as const, nightMode: "none" as const },
    ];

    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async () => new Response(
      [
        "<MetadataStream>",
        '  <CameraMetadata cameraId="cam-1" timestamp="1710000004000">',
        "    <CameraName>North Gate</CameraName>",
        "    <Status>online</Status>",
        "    <Clarity>excellent</Clarity>",
        "    <NightMode>infrared</NightMode>",
        "    <FeedMode>ir</FeedMode>",
        "    <Description>Ingress healthy</Description>",
        "  </CameraMetadata>",
        "  <Record>",
        "    <CameraName>South Gate</CameraName>",
        "    <Status>fault</Status>",
        "    <Clarity>poor</Clarity>",
        "    <NightVision>low-light</NightVision>",
        "    <FeedMode>thermal</FeedMode>",
        "    <Message>Obscured by glare</Message>",
        "    <ObservedAt>2024-03-09T16:00:05.000Z</ObservedAt>",
        "  </Record>",
        "</MetadataStream>",
      ].join("\n"),
      {
        status: 200,
        headers: { "content-type": "application/xml" },
      },
    )) as unknown as typeof fetch;

    try {
      const summary = await summarizeCameraMetadataLiveFeed({
        source: "camera-view",
        ingestMode: "external",
        feedUrl: "https://example.com/camera-metadata",
        feedLabel: "ONVIF metadata",
        sceneId: "scene-1",
        sceneName: "Metadata Scene",
        submittedAt: 1710000005000,
        raw: "",
        cameras,
      });

      expect(summary.ok).toBe(true);
      expect(summary.ingestMode).toBe("external");
      expect(summary.feedUrl).toBe("https://example.com/camera-metadata");
      expect(summary.summary).toContain("Imported 2 camera metadata records");
      expect(summary.records).toHaveLength(2);
      expect(summary.sourceCount).toBe(2);
      expect(summary.errors).toHaveLength(0);

      expect(summary.records[0]?.cameraId).toBe("cam-1");
      expect(summary.records[0]?.cameraName).toBe("North Gate");
      expect(summary.records[0]?.status).toBe("on");
      expect(summary.records[0]?.clarity).toBe("excellent");
      expect(summary.records[0]?.nightMode).toBe("ir");
      expect(summary.records[0]?.feedMode).toBe("ir");
      expect(summary.records[0]?.notes).toBe("Ingress healthy");
      expect(summary.records[0]?.timestamp).toBe(1710000004000);

      expect(summary.records[1]?.cameraId).toBe("cam-2");
      expect(summary.records[1]?.cameraName).toBe("South Gate");
      expect(summary.records[1]?.status).toBe("malfunctioning");
      expect(summary.records[1]?.clarity).toBe("poor");
      expect(summary.records[1]?.nightMode).toBe("low_light");
      expect(summary.records[1]?.feedMode).toBe("thermal");
      expect(summary.records[1]?.notes).toBe("Obscured by glare");
      expect(summary.records[1]?.timestamp).toBe(Date.parse("2024-03-09T16:00:05.000Z"));
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test("maps ONVIF notification envelopes into canonical evidence events", async () => {
    const cameras = [
      { id: "cam-1", name: "North Gate", status: "on" as const, clarity: "good" as const, nightMode: "none" as const },
    ];

    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async () => new Response([
      "<Envelope>",
      "  <NotificationMessage>",
      "    <Topic>tns1:VideoSource/MotionAlarm</Topic>",
      "    <Message PropertyOperation=\"Changed\">",
      "      <Source>",
      "        <SimpleItem Name=\"VideoSourceConfigurationToken\" Value=\"cam-1\" />",
      "      </Source>",
      "      <Data>",
      "        <SimpleItem Name=\"IsMotion\" Value=\"true\" />",
      "      </Data>",
      "      <UtcTime>2024-03-09T16:00:05.000Z</UtcTime>",
      "    </Message>",
      "  </NotificationMessage>",
      "</Envelope>",
    ].join("\n"), {
      status: 200,
      headers: { "content-type": "application/xml" },
    })) as unknown as typeof fetch;

    try {
      const summary = await summarizeCameraMetadataLiveFeed({
        source: "camera-view",
        ingestMode: "external",
        feedUrl: "https://example.com/onvif-events",
        feedLabel: "ONVIF metadata",
        sceneId: "scene-onvif",
        sceneName: "ONVIF Scene",
        submittedAt: 1710000009000,
        raw: "",
        cameras,
      });

      expect(summary.ok).toBe(true);
      expect(summary.records).toHaveLength(0);
      expect(summary.evidenceEvents).toHaveLength(1);
      expect(summary.evidenceEvents[0]?.kind).toBe("camera_live_connection_updated");
      expect(summary.evidenceEvents[0]?.title).toBe("Motion Alarm");
      expect(summary.evidenceEvents[0]?.details).toContain("Motion Alarm from camera \"North Gate\"");
      expect(summary.evidenceEvents[0]?.notes).toContain("ONVIF topic: tns1:VideoSource/MotionAlarm");
      expect(summary.summary).toContain("Imported 1 ONVIF notification event");
      expect(summary.sourceCount).toBe(2);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
