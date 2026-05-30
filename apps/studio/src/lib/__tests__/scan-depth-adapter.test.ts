import { describe, expect, test } from "bun:test";
import { StubDepthEstimationAdapter } from "@/lib/scan-adapters/adapters/stub-depth-adapter";
import { createPhotoArtifact, createScanCaptureSession } from "@/lib/scan-artifacts";

describe("StubDepthEstimationAdapter", () => {
  const adapter = new StubDepthEstimationAdapter();

  test("returns depth estimate for photo artifact", async () => {
    const photo = createPhotoArtifact("data:img/png;base64,x", "test.jpg", 1920, 1080);
    const result = await adapter.estimateDepth(photo);
    expect(result.depthMinM).toBeGreaterThan(0);
    expect(result.depthMaxM).toBeGreaterThan(result.depthMinM);
    expect(result.modelUsed).toBe("stub-depth-estimation");
    expect(result.depthArtifact.kind).toBe("depth_map");
  });

  test("uses role-specific depth profiles", async () => {
    const overviewPhoto = createPhotoArtifact("data:img/png;base64,x", "overview.jpg", 1920, 1080, "overview");
    const closeupPhoto = createPhotoArtifact("data:img/png;base64,x", "cam.jpg", 640, 480, "existing_cameras");

    const overview = await adapter.estimateDepth(overviewPhoto);
    const closeup = await adapter.estimateDepth(closeupPhoto);

    expect(overview.depthMaxM).toBeGreaterThan(closeup.depthMaxM);
  });

  test("returns depth for non-photo artifacts with defaults", async () => {
    const depthArtifact = {
      id: "existing_depth",
      kind: "depth_map" as const,
      linkedCandidateIds: [],
      depthMinM: 0.5,
      depthMaxM: 10,
      modelId: "external",
    };
    const result = await adapter.estimateDepth(depthArtifact);
    expect(result.depthMinM).toBe(0.5);
    expect(result.depthMaxM).toBe(10);
  });

  test("critical zone close-up produces tighter depth range", async () => {
    const photo = createPhotoArtifact("data:img/png;base64,x", "counter.jpg", 1920, 1080, "critical_zones");
    const result = await adapter.estimateDepth(photo);
    const range = result.depthMaxM - result.depthMinM;
    expect(range).toBeLessThan(6);
  });
});
