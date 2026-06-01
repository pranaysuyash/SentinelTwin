import { describe, expect, test } from "bun:test";

import {
  compileScanSessionToScene,
  assessScanDraftReadiness,
  type ScanCompilationWarning,
  summarizeScanProvenance,
  createScanCandidate,
  createScanSession,
} from "@/lib/scan-to-scene";
import { safeParseSecurityScene } from "@/schema/security-scene";

describe("scan-to-scene", () => {
  test("creates valid scene from door + camera + obstruction + counter + light markers", () => {
    const session = createScanSession("Manual Assisted Scan", 12, 9, 3.2);
    session.imageDataUrl = "data:image/svg+xml;base64,PHN2Zy8+";
    session.imageName = "site.svg";
    session.candidates = [
      { ...createScanCandidate("camera", [0.18, 0.2], 0), label: "Entrance Camera", confidence: 0.84 },
      { ...createScanCandidate("counter", [0.58, 0.62], 1), label: "Cash Counter", confidence: 0.91 },
      { ...createScanCandidate("door", [0.5, 0.05], 2), label: "Front Door", confidence: 0.79 },
      { ...createScanCandidate("critical_zone", [0.61, 0.66], 3), label: "Counter Zone", confidence: 0.76 },
      { ...createScanCandidate("light", [0.74, 0.18], 4), label: "Ceiling Light", confidence: 0.88 },
    ];

    const { scene, provenance } = compileScanSessionToScene(session);
    expect(scene.source).toBe("scan");
    expect(scene.walls).toHaveLength(4);
    expect(scene.cameras).toHaveLength(1);
    expect(scene.securityLights).toHaveLength(1);
    expect(scene.obstructions).toHaveLength(1);
    expect(scene.doors).toHaveLength(1);
    expect(scene.entryPoints.length).toBeGreaterThan(0);
    expect(scene.criticalZones).toHaveLength(1);
    expect(scene.cameras[0]?.source).toBe("scan");
    expect(scene.cameras[0]?.mountType).toBe("wall");
    expect(scene.cameras[0]?.yawDeg).toBeGreaterThan(45);
    expect(scene.cameras[0]?.yawDeg).toBeLessThan(75);
    expect(scene.securityLights[0]?.glareRisk).toBe("low");
    expect(provenance.source).toBe("scan");
    expect(provenance.acceptedCandidates).toBe(5);
    expect(safeParseSecurityScene(scene).success).toBe(true);
  });

  test("maps a camera candidate to a scan camera node", () => {
    const session = createScanSession("Camera Only", 10, 8, 3);
    session.imageDataUrl = "data:image/png;base64,AA==";
    session.imageName = "camera.png";
    session.candidates = [
      createScanCandidate("camera", [0.2, 0.2], 0),
    ];

    const { scene } = compileScanSessionToScene(session);

    expect(scene.cameras).toHaveLength(1);
    expect(scene.cameras[0]?.source).toBe("scan");
    expect(scene.cameras[0]?.nodeType).toBe("camera");
  });

  test("maps counter and door candidates to obstruction and entry nodes", () => {
    const session = createScanSession("Counter + Door", 12, 9, 3.2);
    session.imageDataUrl = "data:image/png;base64,AA==";
    session.imageName = "counter-door.png";
    const counterZone = createScanCandidate("critical_zone", [0.61, 0.66], 2);
    counterZone.label = "Cash Counter Zone";
    session.candidates = [
      createScanCandidate("counter", [0.58, 0.62], 0),
      createScanCandidate("door", [0.5, 0.05], 1),
      counterZone,
    ];

    const { scene } = compileScanSessionToScene(session);

    expect(scene.obstructions).toHaveLength(1);
    expect(scene.obstructions[0]?.obstructionType).toBe("counter");
    expect(scene.criticalZones).toHaveLength(1);
    expect(scene.criticalZones[0]?.targetType).toBe("cash_counter_activity");
    expect(scene.doors).toHaveLength(1);
    expect(scene.entryPoints).toHaveLength(1);
    expect(scene.entryPoints[0]?.label).toContain("Entry");
  });

  test("prefers explicit entry markers over door-derived fallback entries", () => {
    const session = createScanSession("Explicit Entry", 12, 9, 3.2);
    session.imageDataUrl = "data:image/png;base64,AA==";
    session.imageName = "explicit-entry.png";
    const explicitEntry = createScanCandidate("entry_point", [0.5, 0.05], 1);
    explicitEntry.label = "Main Entry";
    session.candidates = [
      createScanCandidate("door", [0.5, 0.05], 0),
      explicitEntry,
      createScanCandidate("camera", [0.2, 0.2], 2),
      createScanCandidate("critical_zone", [0.7, 0.7], 3),
    ];

    const { scene, warnings } = compileScanSessionToScene(session);

    expect(scene.doors).toHaveLength(1);
    expect(scene.entryPoints).toHaveLength(1);
    expect(scene.entryPoints[0]?.label).toBe("Main Entry");
    expect(warnings.some((warning) => warning.code === "NO_ENTRY")).toBe(false);
  });

  test("creates fallback rectangular room when no wall markers exist", () => {
    const session = createScanSession("No Walls", 8, 6, 3);
    session.imageDataUrl = "data:image/png;base64,AA==";
    session.imageName = "nowalls.png";
    session.candidates = [
      createScanCandidate("camera", [0.2, 0.2], 0),
      createScanCandidate("critical_zone", [0.6, 0.6], 1),
    ];
    const { scene } = compileScanSessionToScene(session);
    expect(scene.walls).toHaveLength(4);
    expect(scene.dimensions).toEqual({ width: 8, depth: 6, height: 3 });
  });

  test("creates path from explicit path points", () => {
    const session = createScanSession("Path Markers", 10, 8, 3);
    session.imageDataUrl = "data:image/png;base64,AA==";
    session.imageName = "path.png";
    session.candidates = [
      createScanCandidate("door", [0.5, 0.05], 0),
      createScanCandidate("camera", [0.1, 0.2], 1),
      createScanCandidate("critical_zone", [0.7, 0.7], 2),
      createScanCandidate("path_point", [0.5, 0.08], 3),
      createScanCandidate("path_point", [0.62, 0.32], 4),
      createScanCandidate("path_point", [0.7, 0.66], 5),
    ];
    const { scene, warnings } = compileScanSessionToScene(session);
    expect(scene.paths).toHaveLength(1);
    expect(scene.paths[0]?.points.length).toBeGreaterThanOrEqual(2);
    expect(warnings.some((warning) => warning.code === "NO_PATH")).toBe(false);
  });

  test("auto-creates entry-to-zone path when requested", () => {
    const session = createScanSession("Auto Path", 10, 8, 3);
    session.imageDataUrl = "data:image/png;base64,AA==";
    session.imageName = "autopath.png";
    session.candidates = [
      createScanCandidate("door", [0.5, 0.05], 0),
      createScanCandidate("camera", [0.2, 0.2], 1),
      createScanCandidate("critical_zone", [0.7, 0.7], 2),
    ];
    expect(compileScanSessionToScene(session).scene.paths).toHaveLength(0);
    expect(compileScanSessionToScene(session, { autoCreateEntryToZonePath: true }).scene.paths).toHaveLength(1);
  });

  test("emits warnings for missing camera and critical zone", () => {
    const session = createScanSession("Warning Case", 10, 8, 3);
    session.imageDataUrl = "data:image/png;base64,AA==";
    session.imageName = "warnings.png";
    session.candidates = [createScanCandidate("door", [0.5, 0.05], 0)];

    const { warnings } = compileScanSessionToScene(session);
    expect(warnings.some((warning) => warning.code === "NO_CAMERA")).toBe(true);
    expect(warnings.some((warning) => warning.code === "NO_CRITICAL_ZONE")).toBe(true);
  });

  test("warns when no wall markers are present and falls back to the room shell", () => {
    const session = createScanSession("Fallback Walls", 11, 7, 3);
    session.imageDataUrl = "data:image/png;base64,AA==";
    session.imageName = "fallback.png";
    session.candidates = [
      createScanCandidate("camera", [0.2, 0.2], 0),
      createScanCandidate("critical_zone", [0.7, 0.7], 1),
    ];

    const { scene, warnings } = compileScanSessionToScene(session);
    expect(scene.walls).toHaveLength(4);
    expect(warnings.some((warning) => warning.code === "NO_WALL")).toBe(true);
  });

  test("persists permanent operational mode and default assumptions in compiled scan scene", () => {
    const session = createScanSession("Mode Assumption", 10, 8, 3);
    session.imageDataUrl = "data:image/png;base64,AA==";
    session.imageName = "mode-default.png";
    session.candidates = [
      { ...createScanCandidate("camera", [0.2, 0.2], 0), confidence: 0.9 },
      { ...createScanCandidate("critical_zone", [0.7, 0.7], 1), confidence: 0.9 },
      { ...createScanCandidate("door", [0.5, 0.05], 2), confidence: 0.9 },
      { ...createScanCandidate("obstruction", [0.6, 0.6], 3), confidence: 0.9 },
      { ...createScanCandidate("wall", [0.2, 0.5], 4), confidence: 0.9 },
    ];

    const { scene } = compileScanSessionToScene(session);
    expect(scene.assumptions.operationalMode).toBe("permanent");
    expect(scene.changeLog.some((note) => note.includes("Operational mode: permanent."))).toBe(true);
  });

  test("raises temporary perimeter warning when temporary event mode has no perimeter or entry-control markers", () => {
    const session = createScanSession("Temporary Perimeter", 10, 8, 3);
    session.imageDataUrl = "data:image/png;base64,AA==";
    session.imageName = "temporary-event.png";
    session.operationalMode = "temporary_event";
    session.operationalContext = {
      isEmergencyWindow: true,
      requiresTemporaryPerimeterLockdown: true,
      notes: "VIP sweep. Close side door after entry team arrives.",
    };
    session.candidates = [
      { ...createScanCandidate("camera", [0.2, 0.2], 0), confidence: 0.9 },
      { ...createScanCandidate("critical_zone", [0.7, 0.7], 1), confidence: 0.9 },
    ];

    const { scene, warnings } = compileScanSessionToScene(session);
    expect(scene.assumptions.operationalContext).toMatchObject({
      isEmergencyWindow: true,
      requiresTemporaryPerimeterLockdown: true,
      notes: "VIP sweep. Close side door after entry team arrives.",
    });
    expect(warnings.some((warning) => warning.code === "TEMPORARY_PERIMETER")).toBe(true);
    expect(warnings.find((warning) => warning.code === "TEMPORARY_PERIMETER")?.severity).toBe("warning");
    expect(warnings.some((warning) => warning.code === "SCENARIO_ESCALATION_REQUIRED")).toBe(true);
    expect(warnings.find((warning) => warning.code === "SCENARIO_ESCALATION_REQUIRED")?.severity).toBe("warning");
    expect(warnings.find((warning) => warning.code === "SCENARIO_ESCALATION_REQUIRED")?.suggestedAction).toContain("evidence");
  });

  test("keeps scenario escalation advisory when temporary event has normal context and explicit boundary markers", () => {
    const session = createScanSession("Temporary Controlled", 10, 8, 3);
    session.imageDataUrl = "data:image/png;base64,AA==";
    session.imageName = "temporary-controlled.png";
    session.operationalMode = "temporary_event";
    session.candidates = [
      { ...createScanCandidate("camera", [0.2, 0.2], 0), confidence: 0.9 },
      { ...createScanCandidate("critical_zone", [0.7, 0.7], 1), confidence: 0.9 },
      { ...createScanCandidate("door", [0.5, 0.05], 2), confidence: 0.9 },
    ];

    const { warnings, readiness } = compileScanSessionToScene(session);
    expect(warnings.some((warning) => warning.code === "TEMPORARY_PERIMETER")).toBe(false);
    expect(warnings.some((warning) => warning.code === "SCENARIO_ESCALATION_REQUIRED")).toBe(false);
    expect(readiness.canRecommend).toBe(false);
    expect(readiness.level).toBe("review-required");
  });

  test("uses dimension hints for obstruction candidates", () => {
    const session = createScanSession("Dim Hints", 10, 8, 3);
    session.imageDataUrl = "data:image/png;base64,AA==";
    session.imageName = "dimhints.png";
    session.candidates = [
      { ...createScanCandidate("obstruction", [0.5, 0.5], 0), widthHintM: 2.5, depthHintM: 0.9, heightHintM: 1.8 },
      { ...createScanCandidate("camera", [0.2, 0.2], 1) },
      { ...createScanCandidate("critical_zone", [0.7, 0.7], 2) },
    ];

    const { scene } = compileScanSessionToScene(session);
    expect(scene.obstructions).toHaveLength(1);
    expect(scene.obstructions[0]?.dimensions).toEqual([2.5, 1.8, 0.9]);
  });

  test("uses dimension hints for critical zone candidates", () => {
    const session = createScanSession("Zone Dims", 10, 8, 3);
    session.imageDataUrl = "data:image/png;base64,AA==";
    session.imageName = "zonedims.png";
    session.candidates = [
      { ...createScanCandidate("critical_zone", [0.5, 0.5], 0), widthHintM: 3.0, depthHintM: 2.0 },
      { ...createScanCandidate("camera", [0.2, 0.2], 1) },
    ];

    const { scene } = compileScanSessionToScene(session);
    expect(scene.criticalZones).toHaveLength(1);
    const zone = scene.criticalZones[0]!;
    const polygonWidth = Math.abs(zone.polygon[1]![0] - zone.polygon[0]![0]);
    const polygonDepth = Math.abs(zone.polygon[2]![1] - zone.polygon[0]![1]);
    expect(polygonWidth).toBeCloseTo(3.0, 1);
    expect(polygonDepth).toBeCloseTo(2.0, 1);
  });

  test("defaults obstruction dimensions when hints are not provided", () => {
    const session = createScanSession("Default Dims", 10, 8, 3);
    session.imageDataUrl = "data:image/png;base64,AA==";
    session.imageName = "defaultdims.png";
    session.candidates = [
      createScanCandidate("obstruction", [0.5, 0.5], 0),
      createScanCandidate("camera", [0.2, 0.2], 1),
      createScanCandidate("critical_zone", [0.7, 0.7], 2),
    ];

    const { scene } = compileScanSessionToScene(session);
    expect(scene.obstructions).toHaveLength(1);
    expect(scene.obstructions[0]?.dimensions).toEqual([1.2, 1.2, 0.7]);
  });

  test("classifies a complete high-confidence scan draft as deploy-ready", () => {
    const session = createScanSession("Deploy-ready Scan", 12, 9, 3.2);
    session.imageDataUrl = "data:image/png;base64,AA==";
    session.imageName = "deploy-ready.png";
    session.candidates = [
      { ...createScanCandidate("camera", [0.2, 0.2], 0), confidence: 0.93 },
      { ...createScanCandidate("critical_zone", [0.7, 0.7], 1), confidence: 0.91 },
      { ...createScanCandidate("door", [0.5, 0.05], 2), confidence: 0.92 },
      { ...createScanCandidate("obstruction", [0.5, 0.5], 3), confidence: 0.9 },
      { ...createScanCandidate("wall", [0.02, 0.5], 4), confidence: 0.95 },
      { ...createScanCandidate("path_point", [0.4, 0.2], 5), confidence: 0.94 },
      { ...createScanCandidate("path_point", [0.8, 0.7], 6), confidence: 0.95 },
    ];

    const { readiness } = compileScanSessionToScene(session);
    expect(readiness.level).toBe("deploy-ready");
    expect(readiness.canRecommend).toBe(true);
    expect(readiness.canSimulate).toBe(true);
    expect(readiness.blockingWarnings).toHaveLength(0);
  });

  test("keeps review-required when recommendations are available but medium confidence or advisory warnings exist", () => {
    const session = createScanSession("Review Scan", 12, 9, 3.2);
    session.imageDataUrl = "data:image/png;base64,AA==";
    session.imageName = "review.png";
    session.candidates = [
      { ...createScanCandidate("camera", [0.2, 0.2], 0), confidence: 0.68 },
      { ...createScanCandidate("critical_zone", [0.7, 0.7], 1), confidence: 0.66 },
      { ...createScanCandidate("counter", [0.55, 0.6], 2), confidence: 0.67 },
      { ...createScanCandidate("door", [0.5, 0.05], 3), confidence: 0.65 },
    ];

    const { readiness, provenance } = compileScanSessionToScene(session);
    expect(readiness.level).toBe("review-required");
    expect(readiness.canRecommend).toBe(false);
    expect(provenance.confidenceLevel).toBe("medium");
    expect(readiness.advisoryWarnings.length).toBeGreaterThan(0);
  });

  test("requires insufficient when key scan evidence is missing", () => {
    const session = createScanSession("Insufficient Scan", 10, 8, 3);
    session.imageDataUrl = "data:image/png;base64,AA==";
    session.imageName = "insufficient.png";
    session.candidates = [
      { ...createScanCandidate("door", [0.5, 0.05], 0), confidence: 0.91 },
      { ...createScanCandidate("critical_zone", [0.7, 0.7], 1), confidence: 0.91 },
    ];

    const { readiness } = compileScanSessionToScene(session);
    expect(readiness.level).toBe("insufficient");
    expect(readiness.canRecommend).toBe(false);
    expect(readiness.blockingWarnings.some((warning) => warning.code === "NO_CAMERA")).toBe(true);
  });

  test("allows direct readiness assessment from session + warnings", () => {
    const session = createScanSession("Explicit Readiness", 10, 8, 3);
    session.imageDataUrl = "data:image/png;base64,AA==";
    session.imageName = "manual.png";
    session.candidates = [
      { ...createScanCandidate("camera", [0.2, 0.2], 0), confidence: 0.9 },
      { ...createScanCandidate("critical_zone", [0.7, 0.7], 1), confidence: 0.9 },
      { ...createScanCandidate("obstruction", [0.5, 0.5], 2), confidence: 0.9 },
    ];
    const warnings: Array<ScanCompilationWarning> = [
      { code: "NO_WALL", message: "No wall markers accepted; using the room dimensions to build a rectangular shell.", severity: "info" },
    ];

    const explicit = assessScanDraftReadiness(session, warnings, { allowDeployOnWarning: true });
    expect(explicit.level).toBe("deploy-ready");
    expect(explicit.canRecommend).toBe(true);
    const summary = summarizeScanProvenance(session);
    expect(summary.totalCandidates).toBe(3);
  });
});
