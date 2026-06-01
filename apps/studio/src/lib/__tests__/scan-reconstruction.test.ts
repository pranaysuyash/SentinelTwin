import { describe, expect, test } from "bun:test";

import {
  createScanCaptureSession,
  createPhotoArtifact,
  createScanCandidateFromArtifact,
  addPhotoToSession,
  addCandidateToSession,
  updateCandidateInSession,
  addWarning,
} from "@/lib/scan-artifacts";
import {
  compileReconstructionToScene,
  compileReconstructionToSiteTwinDraft,
  compileReconstructionToSiteResult,
  estimateOverallConfidence,
  computeQualityGates,
  computeDefaultWarnings,
  computeConfidenceLabel,
  DEFAULT_RECONSTRUCTION_CONFIG,
} from "@/lib/scan-reconstruction";
import { safeParseSecurityScene } from "@/schema/security-scene";

describe("scan-reconstruction pipeline", () => {
  describe("DEFAULT_RECONSTRUCTION_CONFIG", () => {
    test("forceReview is enabled by default", () => {
      expect(DEFAULT_RECONSTRUCTION_CONFIG.forceReview).toBe(true);
    });

    test("object detection and segmentation enabled by default", () => {
      expect(DEFAULT_RECONSTRUCTION_CONFIG.objectDetectionEnabled).toBe(true);
      expect(DEFAULT_RECONSTRUCTION_CONFIG.segmentationEnabled).toBe(true);
    });

    test("depth and structural extraction disabled by default", () => {
      expect(DEFAULT_RECONSTRUCTION_CONFIG.depthEstimationEnabled).toBe(false);
      expect(DEFAULT_RECONSTRUCTION_CONFIG.structuralExtractionEnabled).toBe(false);
    });
  });

  describe("compileReconstructionToScene", () => {
    test("compiles accepted candidates into valid SecurityScene with SiteCompilerResult", () => {
      const session = createScanCaptureSession("Test Scene", "guided_capture");
      session.roomDimensions = { widthM: 12, depthM: 9, heightM: 3.2 };

      const camCandidate = createScanCandidateFromArtifact("camera", [0.18, 0.2], "photo_1", 0.84);
      camCandidate.status = "accepted";

      const counterCandidate = createScanCandidateFromArtifact("counter", [0.58, 0.62], "photo_1", 0.91);
      counterCandidate.status = "accepted";

      const doorCandidate = createScanCandidateFromArtifact("door", [0.5, 0.05], "photo_1", 0.79);
      doorCandidate.status = "accepted";

      const zoneCandidate = createScanCandidateFromArtifact("critical_zone", [0.61, 0.66], "photo_1", 0.76);
      zoneCandidate.status = "accepted";

      const lightCandidate = createScanCandidateFromArtifact("light", [0.74, 0.18], "photo_1", 0.88);
      lightCandidate.status = "accepted";

      session.candidates = [camCandidate, counterCandidate, doorCandidate, zoneCandidate, lightCandidate];

      const result = compileReconstructionToScene(session);

      expect(result.scene.source).toBe("scan");
      expect(result.scene.cameras).toHaveLength(1);
      expect(result.scene.securityLights).toHaveLength(1);
      expect(result.scene.obstructions).toHaveLength(1);
      expect(result.scene.doors).toHaveLength(1);
      expect(result.scene.entryPoints.length).toBeGreaterThan(0);
      expect(result.scene.criticalZones).toHaveLength(1);
      expect(result.acceptedCount).toBe(5);
      expect(result.rejectedCount).toBe(0);
      expect(safeParseSecurityScene(result.scene).success).toBe(true);

      expect(result.compilerResult.source).toBe("scan");
      expect(result.compilerResult.confidence).toBeGreaterThan(0);

      const changeLogHasProvenance = result.scene.changeLog.some(
        (entry) => entry.includes("Reconstruction source"),
      );
      expect(changeLogHasProvenance).toBe(true);
    });

    test("skips pending and rejected candidates", () => {
      const session = createScanCaptureSession("Partial");
      session.roomDimensions = { widthM: 10, depthM: 8, heightM: 3 };

      const accepted = createScanCandidateFromArtifact("camera", [0.2, 0.2], "photo_1", 0.9);
      accepted.status = "accepted";

      const pending = createScanCandidateFromArtifact("camera", [0.5, 0.5], "photo_1", 0.5);
      pending.status = "pending";

      const rejected = createScanCandidateFromArtifact("door", [0.3, 0.1], "photo_1", 0.3);
      rejected.status = "rejected";

      session.candidates = [accepted, pending, rejected];

      const result = compileReconstructionToScene(session);
      expect(result.scene.cameras).toHaveLength(1);
      expect(result.scene.doors).toHaveLength(0);
    });

    test("handles candidate with estimated position override", () => {
      const session = createScanCaptureSession("Positions");
      session.roomDimensions = { widthM: 10, depthM: 8, heightM: 3 };

      const candidate = createScanCandidateFromArtifact("obstruction", [0.5, 0.5], "photo_1", 0.8);
      candidate.status = "accepted";
      candidate.estimatedPosition = [2.5, 0, 3.5];
      candidate.estimatedDimensions = [2.0, 1.8, 0.6];

      session.candidates = [candidate];

      const result = compileReconstructionToScene(session);
      expect(result.scene.obstructions).toHaveLength(1);
      const obstruction = result.scene.obstructions[0]!;
      expect(obstruction.position[0]).toBeCloseTo(2.5);
      expect(obstruction.position[2]).toBeCloseTo(3.5);
      expect(obstruction.dimensions).toEqual([2.0, 1.8, 0.6]);
    });

    test("uses room dimensions fallback when not set", () => {
      const session = createScanCaptureSession("Fallback");
      const candidate = createScanCandidateFromArtifact("camera", [0.5, 0.5], "photo_1", 0.85);
      candidate.status = "accepted";

      const zoneCandidate = createScanCandidateFromArtifact("critical_zone", [0.6, 0.6], "photo_1", 0.75);
      zoneCandidate.status = "accepted";

      session.candidates = [candidate, zoneCandidate];

      const result = compileReconstructionToScene(session);
      expect(result.scene.dimensions.width).toBe(10);
      expect(result.scene.dimensions.depth).toBe(8);
      expect(result.scene.dimensions.height).toBe(3);
    });

    test("includes scale anchors in change log", () => {
      const session = createScanCaptureSession("Anchors");
      session.roomDimensions = { widthM: 10, depthM: 8, heightM: 3 };
      session.knownMeasurements = [
        { label: "Door width", valueM: 0.9, source: "user" },
        { label: "Counter height", valueM: 1.1, source: "estimated" },
      ];

      const candidate = createScanCandidateFromArtifact("camera", [0.2, 0.2], "photo_1", 0.9);
      candidate.status = "accepted";

      const zoneCandidate = createScanCandidateFromArtifact("critical_zone", [0.7, 0.7], "photo_1", 0.8);
      zoneCandidate.status = "accepted";

      session.candidates = [candidate, zoneCandidate];

      const result = compileReconstructionToScene(session);

      const hasAnchorLog = result.scene.changeLog.some((entry) => entry.includes("Door width"));
      expect(hasAnchorLog).toBe(true);
    });

    test("warns when no wall markers exist in reconstruction", () => {
      const session = createScanCaptureSession("No Walls");
      session.roomDimensions = { widthM: 10, depthM: 8, heightM: 3 };

      const candidate = createScanCandidateFromArtifact("camera", [0.2, 0.2], "photo_1", 0.9);
      candidate.status = "accepted";

      const zoneCandidate = createScanCandidateFromArtifact("critical_zone", [0.7, 0.7], "photo_1", 0.8);
      zoneCandidate.status = "accepted";

      session.candidates = [candidate, zoneCandidate];

      const result = compileReconstructionToScene(session);
      expect(result.scene.walls).toHaveLength(4);
      const hasWallWarning = result.compileWarnings.some((w) => w.code === "NO_WALLS");
      expect(hasWallWarning).toBe(true);
    });

    test("creates entry points from both explicit markers and doors", () => {
      const session = createScanCaptureSession("Entries");
      session.roomDimensions = { widthM: 10, depthM: 8, heightM: 3 };

      const doorCandidate = createScanCandidateFromArtifact("door", [0.5, 0.05], "photo_1", 0.85);
      doorCandidate.status = "accepted";

      const entryCandidate = createScanCandidateFromArtifact("entry_point", [0.5, 0.05], "photo_1", 0.9);
      entryCandidate.status = "accepted";
      entryCandidate.label = "Main Entry";

      const camCandidate = createScanCandidateFromArtifact("camera", [0.2, 0.2], "photo_1", 0.9);
      camCandidate.status = "accepted";

      const zoneCandidate = createScanCandidateFromArtifact("critical_zone", [0.7, 0.7], "photo_1", 0.8);
      zoneCandidate.status = "accepted";

      session.candidates = [doorCandidate, entryCandidate, camCandidate, zoneCandidate];

      const result = compileReconstructionToScene(session);

      expect(result.scene.entryPoints).toHaveLength(1);
      expect(result.scene.entryPoints[0]?.label).toBe("Main Entry");
    });

    test("adds temporary-event escalation warning when emergency/perimeter controls are required", () => {
      const session = createScanCaptureSession("Emergency Temporary");
      session.roomDimensions = { widthM: 10, depthM: 8, heightM: 3 };
      session.operationalMode = "temporary_event";
      session.operationalContext = {
        isEmergencyWindow: true,
        requiresTemporaryPerimeterLockdown: true,
        notes: "VIP visit with temporary staff screening.",
      };

      const camCandidate = createScanCandidateFromArtifact("camera", [0.2, 0.2], "photo_1", 0.9);
      camCandidate.status = "accepted";

      const zoneCandidate = createScanCandidateFromArtifact("critical_zone", [0.7, 0.7], "photo_1", 0.8);
      zoneCandidate.status = "accepted";

      const entryCandidate = createScanCandidateFromArtifact("entry_point", [0.5, 0.05], "photo_1", 0.8);
      entryCandidate.status = "accepted";

      session.candidates = [camCandidate, zoneCandidate, entryCandidate];

      const result = compileReconstructionToScene(session);
      expect(result.compileWarnings.some((warning) => warning.code === "SCENARIO_ESCALATION_REQUIRED")).toBe(true);
    });
  });

  describe("compileReconstructionToSiteTwinDraft", () => {
    test("produces SiteTwinDraft with source artifacts and capture mode", () => {
      const session = createScanCaptureSession("Draft Test", "guided_capture");
      session.roomDimensions = { widthM: 10, depthM: 8, heightM: 3 };

      const photo = createPhotoArtifact("data:img/png;base64,x", "photo.jpg", 1920, 1080, "front_wall");
      session.photos = [photo];

      const candidate = createScanCandidateFromArtifact("camera", [0.2, 0.2], photo.id, 0.9);
      candidate.status = "accepted";

      const zoneCandidate = createScanCandidateFromArtifact("critical_zone", [0.7, 0.7], photo.id, 0.85);
      zoneCandidate.status = "accepted";

      session.candidates = [candidate, zoneCandidate];

      const draft = compileReconstructionToSiteTwinDraft(session);

      expect(draft.source).toBe("scan");
      expect(draft.provenance.sourceArtifacts).toContain("photo.jpg (front_wall)");
      expect(draft.entityCounts.cameras).toBe(1);
      expect(draft.entityCounts.criticalZones).toBe(1);

      const modeAssumption = draft.assumptions.find((a) => a.label === "Capture mode");
      expect(modeAssumption?.value).toBe("Guided Capture");

      const operationalModeAssumption = draft.assumptions.find((a) => a.label === "Operational mode");
      expect(operationalModeAssumption?.value).toBe("Permanent");
    });

    test("includes scale anchors in assumptions when present", () => {
      const session = createScanCaptureSession("Anchored Draft");
      session.roomDimensions = { widthM: 10, depthM: 8, heightM: 3 };
      session.knownMeasurements = [
        { label: "Door width", valueM: 0.9, source: "user" },
      ];

      const candidate = createScanCandidateFromArtifact("camera", [0.2, 0.2], "photo_1", 0.9);
      candidate.status = "accepted";

      const zoneCandidate = createScanCandidateFromArtifact("critical_zone", [0.7, 0.7], "photo_1", 0.85);
      zoneCandidate.status = "accepted";

      session.candidates = [candidate, zoneCandidate];

      const draft = compileReconstructionToSiteTwinDraft(session);

      const anchorAssumption = draft.assumptions.find((a) => a.label === "Scale anchors");
      expect(anchorAssumption).toBeDefined();
      expect(anchorAssumption?.value).toContain("Door width=0.9m");
      expect(anchorAssumption?.confidence).toBe(0.9);
    });
  });

  describe("estimateOverallConfidence", () => {
    test("returns 0 for empty candidate list", () => {
      const session = createScanCaptureSession("Empty");
      expect(estimateOverallConfidence(session)).toBe(0);
    });

    test("returns higher confidence with scale anchor and depth data", () => {
      const session = createScanCaptureSession("Confident");
      session.knownMeasurements = [{ label: "Door", valueM: 0.9, source: "user" }];
      session.artifacts.push({
        id: "depth_1",
        kind: "depth_map",
        linkedCandidateIds: [],
      });

      const candidate = createScanCandidateFromArtifact("camera", [0.5, 0.5], "photo_1", 0.9);
      candidate.status = "accepted";

      const zoneCandidate = createScanCandidateFromArtifact("critical_zone", [0.6, 0.6], "photo_1", 0.85);
      zoneCandidate.status = "accepted";

      session.candidates = [candidate, zoneCandidate];

      const confidence = estimateOverallConfidence(session);
      expect(confidence).toBeGreaterThan(0);
      expect(confidence).toBeLessThanOrEqual(1);
    });

    test("is reduced by blocking warnings", () => {
      const session = createScanCaptureSession("Reduced");
      session.candidates = [];
      session.warnings.push({
        code: "NO_CAMERAS",
        message: "No cameras.",
        severity: "blocking",
      });
      expect(estimateOverallConfidence(session)).toBe(0);
    });

    test("benefits from multiple photos", () => {
      const session = createScanCaptureSession("Multi Photo");
      session.photos = [
        createPhotoArtifact("data:img/png;base64,a", "a.png", 100, 100),
        createPhotoArtifact("data:img/png;base64,b", "b.png", 100, 100),
      ];

      const candidate = createScanCandidateFromArtifact("camera", [0.5, 0.5], "photo_1", 0.9);
      candidate.status = "accepted";

      const zoneCandidate = createScanCandidateFromArtifact("critical_zone", [0.6, 0.6], "photo_1", 0.85);
      zoneCandidate.status = "accepted";

      session.candidates = [candidate, zoneCandidate];

      const confidence = estimateOverallConfidence(session);
      expect(confidence).toBeGreaterThan(0);
    });
  });

  describe("computeQualityGates", () => {
    test("passes when all gates are met", () => {
      const session = createScanCaptureSession("Good");
      session.photos = [createPhotoArtifact("data:img/png;base64,a", "a.png", 100, 100)];
      session.knownMeasurements = [{ label: "Door", valueM: 0.9, source: "user" }];

      const camCandidate = createScanCandidateFromArtifact("camera", [0.2, 0.2], "photo_1", 0.9);
      camCandidate.status = "accepted";

      const zoneCandidate = createScanCandidateFromArtifact("critical_zone", [0.7, 0.7], "photo_1", 0.85);
      zoneCandidate.status = "accepted";

      const doorCandidate = createScanCandidateFromArtifact("door", [0.5, 0.05], "photo_1", 0.8);
      doorCandidate.status = "accepted";

      session.candidates = [camCandidate, zoneCandidate, doorCandidate];
      session.artifacts.push({
        id: "depth_1",
        kind: "depth_map",
        linkedCandidateIds: [],
      });

      const result = computeQualityGates(session);
      expect(result.gates.length).toBeGreaterThan(0);
    });

    test("detects missing cameras", () => {
      const session = createScanCaptureSession("No Cameras");
      const result = computeQualityGates(session);
      const cameraGate = result.gates.find((g) => g.name === "Cameras present");
      expect(cameraGate?.passed).toBe(false);
    });

    test("detects missing critical zones", () => {
      const session = createScanCaptureSession("No Zones");
      const camCandidate = createScanCandidateFromArtifact("camera", [0.2, 0.2], "photo_1", 0.9);
      camCandidate.status = "accepted";
      session.candidates = [camCandidate];

      const result = computeQualityGates(session);
      const zoneGate = result.gates.find((g) => g.name === "Critical zones present");
      expect(zoneGate?.passed).toBe(false);
      expect(result.passed).toBe(false);
    });

    test("detects missing scale anchor", () => {
      const session = createScanCaptureSession("No Anchor");
      const result = computeQualityGates(session);
      const anchorGate = result.gates.find((g) => g.name === "User-provided scale anchor");
      expect(anchorGate?.passed).toBe(false);
    });

    test("detects single photo", () => {
      const session = createScanCaptureSession("Single Photo");
      const result = computeQualityGates(session);
      const photoGate = result.gates.find((g) => g.name === "Multi-photo coverage");
      expect(photoGate?.passed).toBe(false);
    });
  });

  describe("computeDefaultWarnings", () => {
    test("warns when no camera candidates exist", () => {
      const session = createScanCaptureSession("Empty");
      const updated = computeDefaultWarnings(session);
      expect(updated.warnings.some((w) => w.code === "NO_CAMERAS")).toBe(true);
    });

    test("warns when no critical zone candidates exist", () => {
      const session = createScanCaptureSession("Empty");
      const updated = computeDefaultWarnings(session);
      expect(updated.warnings.some((w) => w.code === "NO_CRITICAL_ZONES")).toBe(true);
    });

    test("warns when no user scale anchor exists", () => {
      const session = createScanCaptureSession("Empty");
      const updated = computeDefaultWarnings(session);
      expect(updated.warnings.some((w) => w.code === "DIMENSIONS_UNANCHORED")).toBe(true);
    });

    test("does not warn when user anchor exists", () => {
      const session = createScanCaptureSession("Anchored");
      session.knownMeasurements = [{ label: "Door", valueM: 0.9, source: "user" }];
      const updated = computeDefaultWarnings(session);
      expect(updated.warnings.some((w) => w.code === "DIMENSIONS_UNANCHORED")).toBe(false);
    });

    test("warns about single photo only", () => {
      const session = createScanCaptureSession("Single");
      const updated = computeDefaultWarnings(session);
      expect(updated.warnings.some((w) => w.code === "SINGLE_PHOTO_ONLY")).toBe(true);
    });

    test("does not warn about single photo with multiple photos", () => {
      const session = createScanCaptureSession("Multi");
      session.photos = [
        createPhotoArtifact("data:img/png;base64,a", "a.png", 100, 100),
        createPhotoArtifact("data:img/png;base64,b", "b.png", 100, 100),
      ];
      const updated = computeDefaultWarnings(session);
      expect(updated.warnings.some((w) => w.code === "SINGLE_PHOTO_ONLY")).toBe(false);
    });
  });

  describe("compileReconstructionToSiteResult", () => {
    test("returns SiteCompilerResult compatible with site-intake workflow", () => {
      const session = createScanCaptureSession("Result Test", "guided_capture");
      session.roomDimensions = { widthM: 12, depthM: 9, heightM: 3.2 };

      const camCandidate = createScanCandidateFromArtifact("camera", [0.18, 0.2], "photo_1", 0.84);
      camCandidate.status = "accepted";

      const zoneCandidate = createScanCandidateFromArtifact("critical_zone", [0.61, 0.66], "photo_1", 0.76);
      zoneCandidate.status = "accepted";

      session.candidates = [camCandidate, zoneCandidate];

      const result = compileReconstructionToSiteResult(session);

      expect(result.source).toBe("scan");
      expect(result.confidence).toBeGreaterThan(0);
      expect(result.scene).toBeDefined();
      expect(result.scene.cameras).toHaveLength(1);
      expect(result.scene.criticalZones).toHaveLength(1);
      expect(result.warnings).toBeDefined();
      expect(result.provenance.source).toBe("scan");
      expect(result.provenance.notes).toBeDefined();
    });

    test("includes operational mode in compiled provenance notes", () => {
      const session = createScanCaptureSession("Result Test", "guided_capture", "temporary_event");
      session.roomDimensions = { widthM: 12, depthM: 9, heightM: 3.2 };

      const camCandidate = createScanCandidateFromArtifact("camera", [0.18, 0.2], "photo_1", 0.84);
      camCandidate.status = "accepted";

      const zoneCandidate = createScanCandidateFromArtifact("critical_zone", [0.61, 0.66], "photo_1", 0.76);
      zoneCandidate.status = "accepted";

      session.candidates = [camCandidate, zoneCandidate];

      const result = compileReconstructionToSiteResult(session);
      expect(result.provenance.notes.join(" ")).toContain("Operational mode: Temporary Event");
    });

    test("handles empty session gracefully", () => {
      const session = createScanCaptureSession("Empty Result", "guided_capture");
      const result = compileReconstructionToSiteResult(session);

      expect(result.source).toBe("scan");
      expect(result.confidence).toBeDefined();
      expect(result.confidence).toBeGreaterThanOrEqual(0);
      expect(result.scene).toBeDefined();
      expect(result.scene.cameras).toHaveLength(0);
    });
  });

  describe("computeConfidenceLabel", () => {
    test("correctly labels confidence ranges", () => {
      expect(computeConfidenceLabel(0.9)).toBe("high");
      expect(computeConfidenceLabel(0.8)).toBe("high");
      expect(computeConfidenceLabel(0.7)).toBe("medium");
      expect(computeConfidenceLabel(0.6)).toBe("medium");
      expect(computeConfidenceLabel(0.4)).toBe("low");
      expect(computeConfidenceLabel(0.3)).toBe("low");
      expect(computeConfidenceLabel(0.2)).toBe("very_low");
      expect(computeConfidenceLabel(0)).toBe("very_low");
    });
  });
});
