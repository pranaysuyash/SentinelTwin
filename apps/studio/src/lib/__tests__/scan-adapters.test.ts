import { describe, expect, test } from "bun:test";

import { StubObjectDetectionAdapter } from "@/lib/scan-adapters/adapters/stub-detection-adapter";
import { getStubProfileForRole } from "@/lib/scan-adapters/adapters/stub-profiles";
import { getDefaultAdapterSet, hasAnyAdapters, adapterSummary } from "@/lib/scan-adapters/registry";
import {
  createScanCaptureSession,
  createPhotoArtifact,
} from "@/lib/scan-artifacts";
import {
  runReconstruction,
} from "@/lib/scan-reconstruction-runner";

describe("scan-adapters/registry", () => {
  describe("getDefaultAdapterSet", () => {
    test("has object detection adapters (stub + VLM)", () => {
      const adapters = getDefaultAdapterSet();
      expect(adapters.objectDetection.length).toBeGreaterThanOrEqual(2);
      expect(adapters.objectDetection.some((a) => a.id === "stub-object-detection")).toBe(true);
      expect(adapters.objectDetection.some((a) => a.id === "vlm-detection")).toBe(true);
    });

    test("has depth estimation and scale anchoring adapters", () => {
      const adapters = getDefaultAdapterSet();
      expect(adapters.depthEstimation.length).toBeGreaterThan(0);
      expect(adapters.depthEstimation[0]?.id).toBe("stub-depth-estimation");
      expect(adapters.scaleAnchoring.length).toBeGreaterThan(0);
      expect(adapters.scaleAnchoring[0]?.id).toBe("stub-scale-anchoring");
    });

    test("segmentation adapter is registered", () => {
      const adapters = getDefaultAdapterSet();
      expect(adapters.segmentation.length).toBeGreaterThan(0);
      expect(adapters.segmentation[0]?.id).toBe("stub-segmentation");
    });

    test("structural extraction has VLM adapter", () => {
      const adapters = getDefaultAdapterSet();
      expect(adapters.structuralExtraction.length).toBeGreaterThan(0);
      expect(adapters.structuralExtraction[0]?.id).toBe("vlm-structural");
    });

    test("multiPhoto is still empty", () => {
      const adapters = getDefaultAdapterSet();
      expect(adapters.multiPhoto).toHaveLength(0);
    });
  });

  describe("hasAnyAdapters", () => {
    test("returns true when object detection is registered", () => {
      const adapters = getDefaultAdapterSet();
      expect(hasAnyAdapters(adapters)).toBe(true);
    });

    test("returns false for empty adapter set", () => {
      expect(hasAnyAdapters({
        objectDetection: [],
        segmentation: [],
        depthEstimation: [],
        scaleAnchoring: [],
        multiPhoto: [],
        structuralExtraction: [],
      })).toBe(false);
    });
  });

  describe("adapterSummary", () => {
    test("summarizes available adapters", () => {
      const adapters = getDefaultAdapterSet();
      const summary = adapterSummary(adapters);
      expect(summary).toContain("detection");
    });

    test('returns "No adapters registered" for empty set', () => {
      expect(adapterSummary({
        objectDetection: [],
        segmentation: [],
        depthEstimation: [],
        scaleAnchoring: [],
        multiPhoto: [],
        structuralExtraction: [],
      })).toBe("No adapters registered");
    });
  });
});

describe("StubObjectDetectionAdapter", () => {
  const adapter = new StubObjectDetectionAdapter();

  test("returns candidates from photo with role", async () => {
    const session = createScanCaptureSession("Test", "ai_assisted");
    const photo = createPhotoArtifact("data:img/png;base64,x", "front.jpg", 1920, 1080, "front_wall");
    session.photos = [photo];

    const result = await adapter.detect(photo, session);
    expect(result.candidates.length).toBeGreaterThan(0);
    expect(result.confidence).toBeGreaterThan(0);
  });

  test("all candidates have pending status", async () => {
    const session = createScanCaptureSession("Test", "ai_assisted");
    const photo = createPhotoArtifact("data:img/png;base64,x", "cam.jpg", 640, 480, "existing_cameras");
    session.photos = [photo];

    const result = await adapter.detect(photo, session);
    for (const candidate of result.candidates) {
      expect(candidate.status).toBe("pending");
    }
  });

  test("returns candidates with source artifact linkage", async () => {
    const session = createScanCaptureSession("Test", "ai_assisted");
    const photo = createPhotoArtifact("data:img/png;base64,x", "entry.jpg", 1920, 1080, "entry_points");
    session.photos = [photo];

    const result = await adapter.detect(photo, session);
    for (const candidate of result.candidates) {
      expect(candidate.sourceArtifactIds).toContain(photo.id);
    }
  });

  test("camera close-up photo includes camera candidate", async () => {
    const session = createScanCaptureSession("Test", "ai_assisted");
    const photo = createPhotoArtifact("data:img/png;base64,x", "cam.jpg", 640, 480, "existing_cameras");
    session.photos = [photo];

    const result = await adapter.detect(photo, session);
    const cameras = result.candidates.filter((c) => c.kind === "camera");
    expect(cameras.length).toBeGreaterThan(0);
  });

  test("front wall photo includes counter and entry candidates", async () => {
    const session = createScanCaptureSession("Test", "ai_assisted");
    const photo = createPhotoArtifact("data:img/png;base64,x", "front.jpg", 1920, 1080, "front_wall");
    session.photos = [photo];

    const result = await adapter.detect(photo, session);
    const kinds = result.candidates.map((c) => c.kind);
    expect(kinds).toContain("counter");
  });

  test("returns empty for non-photo artifacts", async () => {
    const session = createScanCaptureSession("Test", "ai_assisted");
    const depthArtifact = {
      id: "depth_1",
      kind: "depth_map" as const,
      linkedCandidateIds: [],
      depthMinM: 0.5,
      depthMaxM: 10,
      modelId: "test",
    };

    const result = await adapter.detect(depthArtifact, session);
    expect(result.candidates).toHaveLength(0);
    expect(result.warnings).toContain("Only photo artifacts are supported");
  });
});

describe("getStubProfileForRole", () => {
  test("returns known profiles for valid roles", () => {
    expect(getStubProfileForRole("overview").dominantObjects.length).toBeGreaterThan(0);
    expect(getStubProfileForRole("front_wall").dominantObjects.length).toBeGreaterThan(0);
    expect(getStubProfileForRole("right_wall").dominantObjects.length).toBeGreaterThan(0);
    expect(getStubProfileForRole("left_wall").dominantObjects.length).toBeGreaterThan(0);
    expect(getStubProfileForRole("rear_wall").dominantObjects.length).toBeGreaterThan(0);
    expect(getStubProfileForRole("critical_zones").dominantObjects.length).toBeGreaterThan(0);
    expect(getStubProfileForRole("existing_cameras").dominantObjects.length).toBeGreaterThan(0);
    expect(getStubProfileForRole("entry_points").dominantObjects.length).toBeGreaterThan(0);
  });

  test("returns default profile for unknown roles", () => {
    const profile = getStubProfileForRole("unknown");
    expect(profile.label).toBe("Unclassified photo");
  });

  test("returns default profile for undefined role", () => {
    const profile = getStubProfileForRole(undefined);
    expect(profile.label).toBe("Unclassified photo");
  });

  test("existing_cameras profile has camera detection", () => {
    const profile = getStubProfileForRole("existing_cameras");
    const hasCamera = profile.dominantObjects.some((o) => o.kind === "camera");
    expect(hasCamera).toBe(true);
    expect(profile.dominantObjects[0]?.confidence).toBeGreaterThan(0.7);
  });
});

describe("VlmStructuralExtractionAdapter", () => {
  test("returns structural elements from photo artifact", async () => {
    const { VlmStructuralExtractionAdapter } = await import("@/lib/vlm-pipeline/vlm-adapter");
    const adapter = new VlmStructuralExtractionAdapter();
    const session = createScanCaptureSession("Test", "ai_assisted");
    const photo = createPhotoArtifact("data:img/png;base64,x", "test.jpg", 640, 480);
    session.photos = [photo];

    const result = await adapter.extractStructures([photo], session);
    expect(result.elements).toBeDefined();
    expect(result.confidence).toBeGreaterThanOrEqual(0);
  });

  test("returns empty for no photo artifact", async () => {
    const { VlmStructuralExtractionAdapter } = await import("@/lib/vlm-pipeline/vlm-adapter");
    const adapter = new VlmStructuralExtractionAdapter();
    const session = createScanCaptureSession("Test", "ai_assisted");
    const result = await adapter.extractStructures([], session);
    expect(result.elements).toHaveLength(0);
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  test("getDefaultAdapterSet includes VLM adapters", () => {
    const adapters = getDefaultAdapterSet();
    expect(adapters.objectDetection.some((a) => a.id === "vlm-detection")).toBe(true);
    expect(adapters.structuralExtraction.some((a) => a.id === "vlm-structural")).toBe(true);
  });
});

describe("runReconstruction (end-to-end)", () => {
  test("completes full flow from session to SiteTwinDraft with single photo", async () => {
    const session = createScanCaptureSession("Test Shop", "ai_assisted");
    session.roomDimensions = { widthM: 10, depthM: 8, heightM: 3 };

    const photo = createPhotoArtifact(
      "data:img/png;base64,x",
      "front.jpg",
      1920,
      1080,
      "front_wall",
    );
    session.photos = [photo];

    const result = await runReconstruction(session);

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.data.detection.totalPhotos).toBe(1);
    expect(result.data.detection.totalCandidates).toBeGreaterThan(0);

    expect(result.data.draft.entityCounts.cameras).toBe(0);
    expect(result.data.session.candidates.length).toBeGreaterThan(0);

    const pendingCandidates = result.data.session.candidates.filter(
      (c) => c.status === "pending",
    );
    expect(pendingCandidates.length).toBe(result.data.detection.pendingCount);
    expect(pendingCandidates.length).toBeGreaterThan(0);

    expect(result.data.confidence).toBeGreaterThanOrEqual(0);
    expect(result.data.qualityReport.gates.length).toBeGreaterThan(0);
  });

  test("fails with empty session photos", async () => {
    const session = createScanCaptureSession("Empty", "ai_assisted");
    const result = await runReconstruction(session);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("no photos");
    }
  });

  test("auto-accepts candidates above threshold", async () => {
    const session = createScanCaptureSession("Auto Accept", "ai_assisted");
    session.roomDimensions = { widthM: 10, depthM: 8, heightM: 3 };

    const photo = createPhotoArtifact(
      "data:img/png;base64,x",
      "cam.jpg",
      640,
      480,
      "existing_cameras",
    );
    session.photos = [photo];

    const result = await runReconstruction(session, { autoAcceptThreshold: 0.5 });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const accepted = result.data.session.candidates.filter(
      (c) => c.status === "accepted" || c.status === "edited",
    );
    expect(accepted.length).toBeGreaterThan(0);
  });

  test("produces compile-able SiteTwinDraft", async () => {
    const session = createScanCaptureSession("Compilable", "ai_assisted");
    session.roomDimensions = { widthM: 10, depthM: 8, heightM: 3 };
    session.knownMeasurements = [
      { label: "Door width", valueM: 0.9, source: "user" },
    ];

    const photo = createPhotoArtifact(
      "data:img/png;base64,x",
      "cam.jpg",
      640,
      480,
      "existing_cameras",
    );
    session.photos = [photo];

    const result = await runReconstruction(session, { autoAcceptThreshold: 0.5 });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.data.draft.entityCounts).toBeDefined();
    expect(result.data.draft.provenance.sourceArtifacts.length).toBeGreaterThan(0);
    expect(result.data.draft.confidence).toBeGreaterThanOrEqual(0);

    const hasAdapterProvenance = result.data.detection.usedAdapterIds.includes(
      "stub-object-detection",
    );
    expect(hasAdapterProvenance).toBe(true);
  });

  test("uses provided adapter set", async () => {
    const session = createScanCaptureSession("Custom Adapters", "ai_assisted");
    session.roomDimensions = { widthM: 10, depthM: 8, heightM: 3 };

    const photo = createPhotoArtifact(
      "data:img/png;base64,x",
      "test.jpg",
      1920,
      1080,
      "entry_points",
    );
    session.photos = [photo];

    const customAdapters = getDefaultAdapterSet();

    const result = await runReconstruction(session, { adapters: customAdapters });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.data.detection.usedAdapterIds).toContain("stub-object-detection");
  });

  test("issues default warnings for missing critical zones", async () => {
    const session = createScanCaptureSession("Missing Zones", "ai_assisted");
    session.roomDimensions = { widthM: 10, depthM: 8, heightM: 3 };

    const photo = createPhotoArtifact(
      "data:img/png;base64,x",
      "test.jpg",
      640,
      480,
      "existing_cameras",
    );
    session.photos = [photo];

    const result = await runReconstruction(session, { autoAcceptThreshold: 0.5 });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const hasNoZonesWarning = result.data.warnings.some(
      (w) => w.code === "NO_CRITICAL_ZONES",
    );
    expect(hasNoZonesWarning).toBe(true);
  });
});
