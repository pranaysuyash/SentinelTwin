import { describe, expect, test } from "bun:test";

import {
  evaluateQualityGates,
  qualityGateToWarning,
  QUALITY_GATE_DEFINITIONS,
} from "@/lib/scan-quality-gates";
import {
  createScanCaptureSession,
  createPhotoArtifact,
  createScanCandidateFromArtifact,
  addCandidateToSession,
} from "@/lib/scan-artifacts";

describe("scan-quality-gates", () => {
  describe("QUALITY_GATE_DEFINITIONS", () => {
    test("has defined gates", () => {
      expect(QUALITY_GATE_DEFINITIONS.length).toBeGreaterThan(0);

      const gateCodes = QUALITY_GATE_DEFINITIONS.map((g) => g.gate);
      expect(gateCodes).toContain("CAMERAS_REQUIRED");
      expect(gateCodes).toContain("CRITICAL_ZONES_REQUIRED");
      expect(gateCodes).toContain("SCALE_ANCHOR_REQUIRED");
      expect(gateCodes).toContain("MULTI_PHOTO_REQUIRED");
      expect(gateCodes).toContain("DEPTH_DATA_REQUIRED");
      expect(gateCodes).toContain("MIN_CANDIDATE_CONFIDENCE");
    });

    test("CAMERAS_REQUIRED and CRITICAL_ZONES_REQUIRED are required", () => {
      const camerasDef = QUALITY_GATE_DEFINITIONS.find((g) => g.gate === "CAMERAS_REQUIRED");
      const zonesDef = QUALITY_GATE_DEFINITIONS.find((g) => g.gate === "CRITICAL_ZONES_REQUIRED");
      expect(camerasDef?.required).toBe(true);
      expect(zonesDef?.required).toBe(true);
    });

    test("MIN_CANDIDATE_CONFIDENCE has default threshold", () => {
      const def = QUALITY_GATE_DEFINITIONS.find((g) => g.gate === "MIN_CANDIDATE_CONFIDENCE");
      expect(def?.defaultThreshold).toBe(0.4);
    });
  });

  describe("evaluateQualityGates", () => {
    test("reports blocked when required cameras are missing", () => {
      const session = createScanCaptureSession("Test");
      const report = evaluateQualityGates(session);
      expect(report.overall).toBe("blocked");

      const cameraGate = report.gates.find((g) => g.gate === "CAMERAS_REQUIRED");
      expect(cameraGate?.passed).toBe(false);
      expect(cameraGate?.required).toBe(true);
    });

    test("reports pass with warnings when only optional gates fail", () => {
      const session = createScanCaptureSession("Test");
      const camCandidate = createScanCandidateFromArtifact("camera", [0.2, 0.2], "photo_1", 0.9);
      camCandidate.status = "accepted";
      const zoneCandidate = createScanCandidateFromArtifact("critical_zone", [0.7, 0.7], "photo_1", 0.85);
      zoneCandidate.status = "accepted";
      session.candidates = [camCandidate, zoneCandidate];

      const report = evaluateQualityGates(session);

      expect(report.overall).toBe("pass_with_warnings");
      expect(report.gates.some((g) => g.gate === "CAMERAS_REQUIRED" && g.passed)).toBe(true);
      expect(report.gates.some((g) => g.gate === "CRITICAL_ZONES_REQUIRED" && g.passed)).toBe(true);
    });

    test("reports pass when all gates pass", () => {
      const session = createScanCaptureSession("All Pass");
      session.photos = [
        createPhotoArtifact("data:img/png;base64,a", "a.png", 100, 100),
        createPhotoArtifact("data:img/png;base64,b", "b.png", 100, 100),
      ];
      session.knownMeasurements = [{ label: "Door", valueM: 0.9, source: "user" }];
      session.artifacts.push({
        id: "depth_1",
        kind: "depth_map",
        linkedCandidateIds: [],
      });

      const camCandidate = createScanCandidateFromArtifact("camera", [0.2, 0.2], "photo_1", 0.9);
      camCandidate.status = "accepted";

      const zoneCandidate = createScanCandidateFromArtifact("critical_zone", [0.7, 0.7], "photo_1", 0.85);
      zoneCandidate.status = "accepted";

      session.candidates = [camCandidate, zoneCandidate];

      const report = evaluateQualityGates(session);
      expect(report.gates.every((g) => g.passed)).toBe(true);
    });

    test("candidate confidence gate flags low confidence", () => {
      const session = createScanCaptureSession("Low Conf");
      const camCandidate = createScanCandidateFromArtifact("camera", [0.2, 0.2], "photo_1", 0.9);
      camCandidate.status = "accepted";
      const lowConfCandidate = createScanCandidateFromArtifact("camera", [0.7, 0.7], "photo_1", 0.15);
      lowConfCandidate.status = "accepted";
      const zoneCandidate = createScanCandidateFromArtifact("critical_zone", [0.5, 0.5], "photo_1", 0.85);
      zoneCandidate.status = "accepted";

      session.candidates = [camCandidate, lowConfCandidate, zoneCandidate];

      const report = evaluateQualityGates(session);
      const confGate = report.gates.find((g) => g.gate === "MIN_CANDIDATE_CONFIDENCE");
      expect(confGate?.passed).toBe(false);
      expect(confGate?.value).toBe(1);
      expect(confGate?.threshold).toBe(0.4);
    });

    test("respects overrides for required gates", () => {
      const session = createScanCaptureSession("Overrides");
      const report = evaluateQualityGates(session, {
        CAMERAS_REQUIRED: { required: false },
        CRITICAL_ZONES_REQUIRED: { required: false },
      });

      expect(report.overall).toBe("pass_with_warnings");
    });

    test("respects threshold overrides for confidence", () => {
      const session = createScanCaptureSession("Threshold Override");
      const lowConfCandidate = createScanCandidateFromArtifact("camera", [0.5, 0.5], "photo_1", 0.35);
      lowConfCandidate.status = "accepted";
      const zoneCandidate = createScanCandidateFromArtifact("critical_zone", [0.7, 0.7], "photo_1", 0.85);
      zoneCandidate.status = "accepted";

      session.candidates = [lowConfCandidate, zoneCandidate];

      const reportDefault = evaluateQualityGates(session);
      const defaultConfGate = reportDefault.gates.find((g) => g.gate === "MIN_CANDIDATE_CONFIDENCE");
      expect(defaultConfGate?.passed).toBe(false);

      const reportRelaxed = evaluateQualityGates(session, {
        MIN_CANDIDATE_CONFIDENCE: { threshold: 0.3 },
      });
      const relaxedConfGate = reportRelaxed.gates.find((g) => g.gate === "MIN_CANDIDATE_CONFIDENCE");
      expect(relaxedConfGate?.passed).toBe(true);
    });
  });

  describe("qualityGateToWarning", () => {
    test("converts failed gates to warnings", () => {
      const session = createScanCaptureSession("Test");
      const report = evaluateQualityGates(session);
      const warnings = qualityGateToWarning(report);

      expect(warnings.length).toBeGreaterThan(0);
      expect(warnings.some((w) => w.code === "GATE_CAMERAS_REQUIRED")).toBe(true);
      expect(warnings.some((w) => w.code === "GATE_CRITICAL_ZONES_REQUIRED")).toBe(true);
    });

    test("required gates become blocking severity", () => {
      const session = createScanCaptureSession("Test");
      const report = evaluateQualityGates(session);
      const warnings = qualityGateToWarning(report);

      const cameraWarning = warnings.find((w) => w.code === "GATE_CAMERAS_REQUIRED");
      expect(cameraWarning?.severity).toBe("blocking");
    });

    test("optional gates become warning severity", () => {
      const session = createScanCaptureSession("Test");
      const camCandidate = createScanCandidateFromArtifact("camera", [0.2, 0.2], "photo_1", 0.9);
      camCandidate.status = "accepted";
      const zoneCandidate = createScanCandidateFromArtifact("critical_zone", [0.7, 0.7], "photo_1", 0.85);
      zoneCandidate.status = "accepted";
      session.candidates = [camCandidate, zoneCandidate];

      const report = evaluateQualityGates(session);
      const warnings = qualityGateToWarning(report);

      const nonBlocking = warnings.filter((w) => w.severity !== "blocking");
      expect(nonBlocking.length).toBeGreaterThan(0);
    });
  });
});
