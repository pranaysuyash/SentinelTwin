import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

import { formatTargetTypeLabel } from "@/components/view/CameraViewMode";

const cameraViewModePath = "./src/components/view/CameraViewMode.tsx";

describe("CameraViewMode", () => {
  test("exposes the live overlay strip and replay presets", () => {
    const source = readFileSync(cameraViewModePath, "utf8");

    expect(source).toContain("LIVE MODE (SIMULATED)");
    expect(source).toContain("DORI RANGES AT TARGET");
    expect(source).toContain("DORI OVERLAY");
    expect(source).toContain("REQUIRED ·");
    expect(source).toContain("PASSES");
    expect(source).toContain("FAILS");
    expect(source).toContain("Actor:");
    expect(source).toContain("Back to Map View");
    expect(source).toContain("Show replay essentials");
    expect(source).toContain("Minimal camera feed");
    expect(source).toContain("Inspection preset");
    expect(source).toContain("MORE");
    expect(source).toContain("Why this quality:");
    expect(source).toContain("Quality:");
    expect(source).toContain("Segment:");
    expect(source).toContain("Complete:");
    expect(source).toContain("Best Camera");
    expect(source).toContain("Footage Verification");
    expect(source).toContain("Planning aid only.");
    expect(source).toContain("Auto align");
    expect(source).toContain("autoAlignVerification");
    expect(source).toContain("evaluateAlignmentSample");
    expect(source).toContain("Reset align");
    expect(source).toContain("Overlay");
    expect(source).toContain("Split");
    expect(source).toContain("Alignment Quality");
    expect(source).toContain("Difference heat overlay");
    expect(source).toContain("non-forensic");
    expect(source).toContain("accept=\"image/*,video/*\"");
    expect(source).toContain("Extracting video frame…");
    expect(source).toContain("Video frame sampled at");
    expect(source).toContain("extractVideoFrameDataUrl");
    expect(source).toContain("Extract frame at selected time");
    expect(source).toContain("Sample time");
    expect(source).toContain("verificationVideoFile");
    expect(source).toContain("extractFromCurrentVideo");
    expect(source).toContain("extractVideoFrameCandidates");
    expect(source).toContain("estimateFrameQuality");
    expect(source).toContain("Auto-pick best extracted frame");
    expect(source).toContain("Extracted frames");
    expect(source).toContain("verificationVideoCandidates");
    expect(source).toContain("verificationBestCandidateId");
    expect(source).toContain("sourceType: verificationSourceType");
    expect(source).toContain("sampleTimeS: verificationSampleTimeS");
    expect(source).toContain("videoDurationS: verificationVideoDurationS");
    expect(source).toContain("bestCandidateId: verificationBestCandidateId");
    expect(source).toContain("selectedCandidateId: verificationSelectedCandidateId");
    expect(source).toContain("alignmentMethod: verificationAlignmentMethod");
    expect(source).toContain("autoAlignDelta: verificationAutoAlignDelta");
    expect(source).toContain("setVerificationAlignmentMethod(snapshot.alignmentMethod ?? null)");
    expect(source).toContain("setVerificationAutoAlignDelta(snapshot.autoAlignDelta ?? null)");
    expect(source).toContain("formatSnapshotEvidenceSummary");
    expect(source).toContain("Image upload");
    expect(source).toContain("manual align");
    expect(source).toContain("auto align");
    expect(source).toContain("frame set unavailable");
    expect(source).toContain("best frame selected");
    expect(source).toContain("manual frame selected");
    expect(source).toContain("no frame selected");
    expect(source).toContain("title={formatSnapshotEvidenceSummary(snapshot)}");
    expect(source).toContain("Excellent");
    expect(source).toContain("Good");
    expect(source).toContain("Fair");
    expect(source).toContain("Poor");
  });

  test("derives target labels from the zone target type", () => {
    expect(formatTargetTypeLabel("face_recognition")).toBe("Face");
    expect(formatTargetTypeLabel("cash_counter_activity")).toBe("Cash Counter");
    expect(formatTargetTypeLabel("door_entry_exit")).toBe("Entry / Exit");
  });
});
