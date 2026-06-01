import { describe, expect, test } from "bun:test";

import {
  createScanCaptureSession,
  createPhotoArtifact,
  createScanCandidateFromArtifact,
  addPhotoToSession,
  addCandidateToSession,
  updateCandidateInSession,
  removeCandidateFromSession,
  markCaptureStepCompleted,
  addWarning,
  addCandidateWarning,
  linkArtifactToCandidate,
  sessionCompletionRatio,
  captureModeLabel,
  captureModeDescription,
  SCAN_CAPTURE_STEPS,
  operationalModeLabel,
} from "@/lib/scan-artifacts";

describe("scan-artifacts - data model", () => {
  describe("createScanCaptureSession", () => {
    test("creates a session with default guided_capture mode", () => {
      const session = createScanCaptureSession("Test Shop");
      expect(session.sceneName).toBe("Test Shop");
      expect(session.captureMode).toBe("guided_capture");
      expect(session.operationalMode).toBe("permanent");
      expect(session.captureSteps).toHaveLength(SCAN_CAPTURE_STEPS.length);
      expect(session.knownMeasurements).toHaveLength(2);
      expect(session.photos).toHaveLength(0);
      expect(session.candidates).toHaveLength(0);
      expect(session.warnings).toHaveLength(0);
      expect(session.id).toContain("cap_");
    });

    test("creates a session with manual_assisted mode", () => {
      const session = createScanCaptureSession("Warehouse", "manual_assisted");
      expect(session.captureMode).toBe("manual_assisted");
    });

    test("creates a session with ai_assisted mode", () => {
      const session = createScanCaptureSession("Lobby", "ai_assisted");
      expect(session.captureMode).toBe("ai_assisted");
    });

    test("creates a session with temporary_event operational mode", () => {
      const session = createScanCaptureSession("Emergency Hall", "ai_assisted", "temporary_event");
      expect(session.operationalMode).toBe("temporary_event");
      expect(operationalModeLabel(session.operationalMode)).toBe("Temporary Event");
    });

    test("uses trimmed scene name", () => {
      const session = createScanCaptureSession("   Office   ");
      expect(session.sceneName).toBe("Office");
    });

    test("falls back to default name for empty string", () => {
      const session = createScanCaptureSession("");
      expect(session.sceneName).toBe("Site Capture");
    });
  });

  describe("SCAN_CAPTURE_STEPS", () => {
    test("has 13 capture steps", () => {
      expect(SCAN_CAPTURE_STEPS).toHaveLength(13);
    });

    test("each step has kind, label, instruction, required, completed", () => {
      for (const step of SCAN_CAPTURE_STEPS) {
        expect(step.kind).toBeDefined();
        expect(step.label).toBeDefined();
        expect(step.instruction).toBeDefined();
        expect(typeof step.required).toBe("boolean");
        expect(step.completed).toBe(false);
      }
    });

    test("overview, front_wall, right_wall, left_wall, rear_wall are required", () => {
      const required = SCAN_CAPTURE_STEPS.filter((s) => s.required);
      const requiredKinds = required.map((s) => s.kind);
      expect(requiredKinds).toContain("overview");
      expect(requiredKinds).toContain("front_wall");
      expect(requiredKinds).toContain("right_wall");
      expect(requiredKinds).toContain("left_wall");
      expect(requiredKinds).toContain("rear_wall");
      expect(requiredKinds).toContain("critical_zones");
      expect(requiredKinds).toContain("entry_points");
      expect(requiredKinds).toContain("known_measurement");
      expect(requiredKinds).toContain("dimensions");
      expect(requiredKinds).toContain("complete");
    });

    test("existing_cameras, obstructions, ceiling are optional", () => {
      const optional = SCAN_CAPTURE_STEPS.filter((s) => !s.required);
      const optionalKinds = optional.map((s) => s.kind);
      expect(optionalKinds).toContain("existing_cameras");
      expect(optionalKinds).toContain("obstructions");
      expect(optionalKinds).toContain("ceiling");
    });
  });

  describe("createPhotoArtifact", () => {
    test("creates a photo artifact with role", () => {
      const photo = createPhotoArtifact("data:image/png;base64,aa", "test.png", 1920, 1080, "front_wall");
      expect(photo.kind).toBe("photo");
      expect(photo.sourceFileName).toBe("test.png");
      expect(photo.widthPx).toBe(1920);
      expect(photo.heightPx).toBe(1080);
      expect(photo.role).toBe("front_wall");
      expect(photo.linkedCandidateIds).toHaveLength(0);
    });

    test("creates a photo artifact without role", () => {
      const photo = createPhotoArtifact("data:image/jpeg;base64,bb", "photo.jpg", 640, 480);
      expect(photo.role).toBeUndefined();
    });
  });

  describe("createScanCandidateFromArtifact", () => {
    test("creates a candidate from model detection", () => {
      const candidate = createScanCandidateFromArtifact(
        "camera",
        [0.5, 0.5],
        "photo_abc",
        0.85,
        "model_detection",
      );
      expect(candidate.kind).toBe("camera");
      expect(candidate.imagePoint).toEqual([0.5, 0.5]);
      expect(candidate.confidence).toBe(0.85);
      expect(candidate.source).toBe("model_detection");
      expect(candidate.sourceArtifactIds).toEqual(["photo_abc"]);
      expect(candidate.status).toBe("pending");
      expect(candidate.manual).toBe(false);
      expect(candidate.warnings).toHaveLength(0);
    });

    test("creates a segmentation candidate", () => {
      const candidate = createScanCandidateFromArtifact(
        "cupboard",
        [0.3, 0.7],
        "photo_def",
        0.67,
        "segmentation",
      );
      expect(candidate.source).toBe("segmentation");
      expect(candidate.label).toBe("Cupboard");
    });

    test("defaults to model_detection source", () => {
      const candidate = createScanCandidateFromArtifact("door", [0.1, 0.1], "photo_ghi", 0.9);
      expect(candidate.source).toBe("model_detection");
    });

    test("creates candidate with pending status", () => {
      const candidate = createScanCandidateFromArtifact("window", [0.4, 0.4], "photo_jkl", 0.55);
      expect(candidate.status).toBe("pending");
    });
  });

  describe("session mutations", () => {
    test("addPhotoToSession adds photo and artifact", () => {
      let session = createScanCaptureSession("Session");
      const photo = createPhotoArtifact("data:img/png;base64,x", "x.png", 100, 200);
      session = addPhotoToSession(session, photo);

      expect(session.photos).toHaveLength(1);
      expect(session.artifacts).toHaveLength(1);
      expect(session.photos[0]?.id).toBe(photo.id);
      expect(session.updatedAt).toBeGreaterThanOrEqual(session.createdAt);
    });

    test("addCandidateToSession adds candidate", () => {
      let session = createScanCaptureSession("Candidates");
      const candidate = createScanCandidateFromArtifact("camera", [0.5, 0.5], "photo_1", 0.9);
      session = addCandidateToSession(session, candidate);

      expect(session.candidates).toHaveLength(1);
      expect(session.candidates[0]?.id).toBe(candidate.id);
    });

    test("updateCandidateInSession patches a candidate", () => {
      let session = createScanCaptureSession("Update");
      const candidate = createScanCandidateFromArtifact("camera", [0.5, 0.5], "photo_1", 0.9);
      session = addCandidateToSession(session, candidate);

      session = updateCandidateInSession(session, candidate.id, {
        status: "accepted",
        confidence: 0.95,
        label: "Entrance Camera",
      });

      expect(session.candidates[0]?.status).toBe("accepted");
      expect(session.candidates[0]?.confidence).toBe(0.95);
      expect(session.candidates[0]?.label).toBe("Entrance Camera");
    });

    test("removeCandidateFromSession removes candidate", () => {
      let session = createScanCaptureSession("Remove");
      const candidate = createScanCandidateFromArtifact("door", [0.3, 0.1], "photo_1", 0.8);
      session = addCandidateToSession(session, candidate);

      expect(session.candidates).toHaveLength(1);
      session = removeCandidateFromSession(session, candidate.id);
      expect(session.candidates).toHaveLength(0);
    });

    test("removeCandidateFromSession does nothing for unknown id", () => {
      let session = createScanCaptureSession("Unknown");
      session = removeCandidateFromSession(session, "nonexistent");
      expect(session.candidates).toHaveLength(0);
    });
  });

  describe("markCaptureStepCompleted", () => {
    test("marks a step as completed with artifact id", () => {
      let session = createScanCaptureSession("Steps");
      session = markCaptureStepCompleted(session, "front_wall", "photo_123");

      const step = session.captureSteps.find((s) => s.kind === "front_wall");
      expect(step?.completed).toBe(true);
      expect(step?.artifactId).toBe("photo_123");
    });

    test("does not affect other steps", () => {
      let session = createScanCaptureSession("Other Steps");
      session = markCaptureStepCompleted(session, "overview");

      const overview = session.captureSteps.find((s) => s.kind === "overview");
      const frontWall = session.captureSteps.find((s) => s.kind === "front_wall");
      expect(overview?.completed).toBe(true);
      expect(frontWall?.completed).toBe(false);
    });
  });

  describe("addWarning", () => {
    test("adds a new warning", () => {
      let session = createScanCaptureSession("Warnings");
      session = addWarning(session, {
        code: "NO_CAMERAS",
        message: "No camera markers found.",
        severity: "warning",
      });

      expect(session.warnings).toHaveLength(1);
      expect(session.warnings[0]?.code).toBe("NO_CAMERAS");
    });

    test("does not add duplicate warnings", () => {
      let session = createScanCaptureSession("Dupes");
      session = addWarning(session, {
        code: "NO_CAMERAS",
        message: "No cameras.",
        severity: "warning",
      });
      session = addWarning(session, {
        code: "NO_CAMERAS",
        message: "Still no cameras.",
        severity: "warning",
      });

      expect(session.warnings).toHaveLength(1);
    });
  });

  describe("addCandidateWarning", () => {
    test("adds a warning to a candidate", () => {
      const candidate = createScanCandidateFromArtifact("camera", [0.5, 0.5], "photo_1", 0.3);
      const updated = addCandidateWarning(candidate, {
        code: "LOW_CONFIDENCE",
        message: "Confidence below threshold.",
        severity: "warning",
      });

      expect(updated.warnings).toHaveLength(1);
      expect(updated.warnings[0]?.code).toBe("LOW_CONFIDENCE");
    });

    test("does not add duplicate candidate warnings", () => {
      let candidate = createScanCandidateFromArtifact("camera", [0.5, 0.5], "photo_1", 0.3);
      candidate = addCandidateWarning(candidate, {
        code: "LOW_CONFIDENCE",
        message: "First.",
        severity: "warning",
      });
      candidate = addCandidateWarning(candidate, {
        code: "LOW_CONFIDENCE",
        message: "Second.",
        severity: "warning",
      });

      expect(candidate.warnings).toHaveLength(1);
    });
  });

  describe("linkArtifactToCandidate", () => {
    test("links artifact and candidate bidirectionally", () => {
      let session = createScanCaptureSession("Links");
      const photo = createPhotoArtifact("data:img/png;base64,l", "link.png", 100, 100);
      session = addPhotoToSession(session, photo);

      const candidate = createScanCandidateFromArtifact("camera", [0.5, 0.5], photo.id, 0.9);
      session = addCandidateToSession(session, candidate);

      session = linkArtifactToCandidate(session, photo.id, candidate.id);

      const linkedPhoto = session.artifacts.find((a) => a.id === photo.id);
      expect(linkedPhoto?.linkedCandidateIds).toContain(candidate.id);

      const linkedCandidate = session.candidates.find((c) => c.id === candidate.id);
      expect(linkedCandidate?.sourceArtifactIds).toContain(photo.id);
    });
  });

  describe("sessionCompletionRatio", () => {
    test("returns 0 for no completed steps", () => {
      const session = createScanCaptureSession("Empty");
      expect(sessionCompletionRatio(session)).toBe(0);
    });

    test("returns ratio of completed required steps", () => {
      let session = createScanCaptureSession("Partial");
      const requiredKinds = session.captureSteps
        .filter((s) => s.required)
        .map((s) => s.kind);

      session = markCaptureStepCompleted(session, requiredKinds[0]!);
      session = markCaptureStepCompleted(session, requiredKinds[1]!);

      const requiredCount = requiredKinds.length;
      const expected = 2 / requiredCount;
      expect(sessionCompletionRatio(session)).toBeCloseTo(expected, 5);
    });

    test("returns 1 when all required steps are complete", () => {
      let session = createScanCaptureSession("Full");
      for (const step of session.captureSteps.filter((s) => s.required)) {
        session = markCaptureStepCompleted(session, step.kind);
      }
      expect(sessionCompletionRatio(session)).toBe(1);
    });
  });

  describe("captureModeLabel", () => {
    test("returns correct labels", () => {
      expect(captureModeLabel("manual_assisted")).toBe("Manual-Assisted");
      expect(captureModeLabel("guided_capture")).toBe("Guided Capture");
      expect(captureModeLabel("ai_assisted")).toBe("AI-Assisted");
    });
  });

  describe("captureModeDescription", () => {
    test("returns non-empty descriptions", () => {
      expect(captureModeDescription("manual_assisted").length).toBeGreaterThan(0);
      expect(captureModeDescription("guided_capture").length).toBeGreaterThan(0);
      expect(captureModeDescription("ai_assisted").length).toBeGreaterThan(0);
    });

    test("ai_assisted mentions review requirement", () => {
      const desc = captureModeDescription("ai_assisted");
      expect(desc).toContain("review");
    });
  });
});
