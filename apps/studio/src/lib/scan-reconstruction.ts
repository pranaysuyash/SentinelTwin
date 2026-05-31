import type {
  ScanCaptureSession,
  ScanCandidate,
  ScanWarning,
  ScanCandidateWarning,
  ScanCandidateKind,
} from "@/lib/scan-artifacts";
import { addWarning, addCandidateWarning, captureModeLabel } from "@/lib/scan-artifacts";
import type { SiteTwinDraft, SiteCompilerResult } from "@/lib/site-compiler";
import { compileScanToSiteResult, compileToSiteTwinDraft } from "@/lib/site-compiler";
import { createBlankSecurityScene } from "@/lib/scene-skeleton";
import type { SecurityScene, CameraNode, ObstructionNode, DoorNode, WindowNode, SecurityLightNode, EntryPointNode, CriticalZoneNode, WallNode } from "@/schema/security-scene";
import { safeParseSecurityScene } from "@/schema/security-scene";
import { createCameraNode, createCriticalZoneNode, createDoorNode, createEntryPointNode, createObstructionNode, createSecurityLightNode, createWallNode, createWindowNode } from "@/lib/node-factory";
import { selectHighestPriorityCriticalZone } from "@/lib/critical-zone-selection";

export type ReconstructionStage =
  | "pending"
  | "artifact_collection"
  | "candidate_extraction"
  | "depth_estimation"
  | "scale_anchoring"
  | "structural_extraction"
  | "multi_photo_linking"
  | "review"
  | "compile";

export type ReconstructionJob = {
  id: string;
  sessionId: string;
  stages: ReconstructionStage[];
  completedStages: ReconstructionStage[];
  failedStages: ReconstructionStage[];
  startedAt: number;
  updatedAt: number;
  status: "idle" | "running" | "paused" | "completed" | "failed";
};

export type ReconstructionConfig = {
  objectDetectionEnabled: boolean;
  segmentationEnabled: boolean;
  depthEstimationEnabled: boolean;
  scaleAnchoringEnabled: boolean;
  structuralExtractionEnabled: boolean;
  multiPhotoLinkingEnabled: boolean;
  minDetectionConfidence: number;
  minSegmentationConfidence: number;
  requireDepthData: boolean;
  forceReview: boolean;
};

export const DEFAULT_RECONSTRUCTION_CONFIG: ReconstructionConfig = {
  objectDetectionEnabled: true,
  segmentationEnabled: true,
  depthEstimationEnabled: false,
  scaleAnchoringEnabled: true,
  structuralExtractionEnabled: false,
  multiPhotoLinkingEnabled: false,
  minDetectionConfidence: 0.4,
  minSegmentationConfidence: 0.5,
  requireDepthData: false,
  forceReview: true,
};

export type CandidateCompileResult = {
  candidate: ScanCandidate;
  node:
    | CameraNode
    | DoorNode
    | WindowNode
    | SecurityLightNode
    | ObstructionNode
    | EntryPointNode
    | CriticalZoneNode
    | WallNode
    | null;
  warning?: string;
};

const RECONSTRUCTION_SOURCE_LABEL = "AI-assisted reconstruction";

function worldPositionFromCandidate(
  candidate: ScanCandidate,
  roomWidthM: number,
  roomDepthM: number,
  roomHeightM: number,
): [number, number, number] {
  if (candidate.estimatedPosition) {
    return candidate.estimatedPosition;
  }
  const px = Math.max(0.35, Math.min(roomWidthM - 0.35, candidate.imagePoint[0] * roomWidthM));
  const pz = Math.max(0.35, Math.min(roomDepthM - 0.35, candidate.imagePoint[1] * roomDepthM));
  return [px, 0, pz];
}

function dimensionsFromCandidate(candidate: ScanCandidate): [number, number, number] | null {
  if (candidate.estimatedDimensions) {
    return candidate.estimatedDimensions;
  }
  if (candidate.widthHintM && candidate.heightHintM && candidate.depthHintM) {
    return [candidate.widthHintM, candidate.heightHintM, candidate.depthHintM];
  }
  return null;
}

function compileCandidate(
  candidate: ScanCandidate,
  roomWidthM: number,
  roomDepthM: number,
  roomHeightM: number,
): CandidateCompileResult {
  if (candidate.status === "rejected" || candidate.status === "pending") {
    return { candidate, node: null };
  }

  const worldPos = worldPositionFromCandidate(candidate, roomWidthM, roomDepthM, roomHeightM);
  const dims = dimensionsFromCandidate(candidate);

  switch (candidate.kind) {
    case "camera": {
      const camera = createCameraNode(worldPos);
      camera.name = candidate.label;
      camera.mountType = "ceiling";
      camera.mountHeightM = Math.max(2.4, roomHeightM - 0.2);
      camera.pitchDeg = -18;
      camera.yawDeg = 180;
      camera.source = "scan";
      camera.sourceTrace = `Reconstruction: ${RECONSTRUCTION_SOURCE_LABEL}, candidate=${candidate.id}, confidence=${candidate.confidence}`;
      camera.reviewStatus = candidate.confidence >= 0.8 ? "unreviewed" : "unreviewed";
      if (candidate.warnings.some((w) => w.severity === "warning")) {
        camera.geometryValidity = "suspect";
      }
      return { candidate, node: camera };
    }
    case "light": {
      const light = createSecurityLightNode(worldPos);
      light.name = candidate.label;
      light.lightType = "ceiling";
      light.source = "scan";
      light.sourceTrace = `Reconstruction: ${RECONSTRUCTION_SOURCE_LABEL}, candidate=${candidate.id}, confidence=${candidate.confidence}`;
      return { candidate, node: light };
    }
    case "door": {
      const door = createDoorNode(worldPos);
      door.label = candidate.label;
      door.source = "scan";
      door.sourceTrace = `Reconstruction: ${RECONSTRUCTION_SOURCE_LABEL}, candidate=${candidate.id}, confidence=${candidate.confidence}`;
      if (dims) door.dimensions = dims;
      return { candidate, node: door };
    }
    case "window": {
      const windowNode = createWindowNode(worldPos);
      windowNode.label = candidate.label;
      windowNode.source = "scan";
      windowNode.sourceTrace = `Reconstruction: ${RECONSTRUCTION_SOURCE_LABEL}, candidate=${candidate.id}, confidence=${candidate.confidence}`;
      if (dims) windowNode.dimensions = dims;
      return { candidate, node: windowNode };
    }
    case "counter":
    case "cupboard":
    case "shelf":
    case "obstruction":
    case "pillar": {
      const obstructionType = candidate.kind === "pillar" ? "pillar" as const
        : candidate.kind === "counter" ? "counter" as const
        : candidate.kind === "cupboard" ? "cupboard" as const
        : candidate.kind === "shelf" ? "shelf" as const
        : "other" as const;
      const obstruction = createObstructionNode(worldPos, obstructionType);
      obstruction.label = candidate.label;
      obstruction.source = "scan";
      obstruction.sourceTrace = `Reconstruction: ${RECONSTRUCTION_SOURCE_LABEL}, candidate=${candidate.id}, confidence=${candidate.confidence}`;
      if (dims) obstruction.dimensions = dims;
      if (candidate.warnings.some((w) => w.severity === "warning")) {
        obstruction.geometryValidity = "suspect";
      }
      return { candidate, node: obstruction };
    }
    case "entry_point": {
      const entry = createEntryPointNode([worldPos[0], worldPos[2]]);
      entry.label = candidate.label;
      entry.source = "scan";
      entry.sourceTrace = `Reconstruction: ${RECONSTRUCTION_SOURCE_LABEL}, candidate=${candidate.id}, confidence=${candidate.confidence}`;
      return { candidate, node: entry };
    }
    case "critical_zone": {
      const halfW = (dims ? dims[0] : 1.6) / 2;
      const halfD = (dims ? dims[2] : 1.2) / 2;
      const x = worldPos[0];
      const z = worldPos[2];
      try {
        const zone = createCriticalZoneNode([
          [Math.max(0.15, x - halfW), Math.max(0.15, z - halfD)],
          [Math.min(roomWidthM - 0.15, x + halfW), Math.max(0.15, z - halfD)],
          [Math.min(roomWidthM - 0.15, x + halfW), Math.min(roomDepthM - 0.15, z + halfD)],
          [Math.max(0.15, x - halfW), Math.min(roomDepthM - 0.15, z + halfD)],
        ]);
        zone.label = candidate.label;
        zone.source = "scan";
        zone.sourceTrace = `Reconstruction: ${RECONSTRUCTION_SOURCE_LABEL}, candidate=${candidate.id}, confidence=${candidate.confidence}`;
        return { candidate, node: zone };
      } catch {
        return { candidate, node: null, warning: "Failed to create critical zone from candidate" };
      }
    }
    case "wall": {
      return { candidate, node: null };
    }
    case "path_point": {
      return { candidate, node: null };
    }
  }
}

function entryPointDistance(a: EntryPointNode, b: EntryPointNode): number {
  return Math.hypot(a.position[0] - b.position[0], a.position[1] - b.position[1]);
}

function mergeEntryPoints(
  explicitEntries: EntryPointNode[],
  doorDerivedEntries: EntryPointNode[],
): EntryPointNode[] {
  const duplicateThresholdM = 0.5;
  const retainedDoorEntries = explicitEntries.length > 0
    ? doorDerivedEntries.filter((doorEntry) =>
        !explicitEntries.some((explicitEntry) =>
          entryPointDistance(explicitEntry, doorEntry) <= duplicateThresholdM,
        ),
      )
    : doorDerivedEntries;

  const merged: EntryPointNode[] = [];
  for (const entry of [...explicitEntries, ...retainedDoorEntries]) {
    if (merged.some((existing) => entryPointDistance(existing, entry) <= 0.05)) continue;
    merged.push(entry);
  }
  return merged;
}

export function compileReconstructionToScene(
  session: ScanCaptureSession,
): {
  scene: SecurityScene;
  compilerResult: SiteCompilerResult;
  compileWarnings: ScanWarning[];
  acceptedCount: number;
  rejectedCount: number;
} {
  const compileWarnings: ScanWarning[] = [];
  const accepted = session.candidates.filter(
    (c) => c.status === "accepted" || c.status === "edited",
  );
  const rejected = session.candidates.filter((c) => c.status === "rejected");

  const roomWidthM = session.roomDimensions?.widthM ?? 10;
  const roomDepthM = session.roomDimensions?.depthM ?? 8;
  const roomHeightM = session.roomDimensions?.heightM ?? 3;

  const scene = createBlankSecurityScene();
  scene.name = session.sceneName;
  scene.dimensions = { width: roomWidthM, depth: roomDepthM, height: roomHeightM };
  scene.source = "scan";

  const explicitEntryPoints: EntryPointNode[] = [];
  const doorEntryPoints: EntryPointNode[] = [];
  const hasStructure = accepted.some((c) => c.kind === "wall");

  for (const candidate of accepted) {
    const result = compileCandidate(candidate, roomWidthM, roomDepthM, roomHeightM);
    if (!result.node) continue;

    switch (result.node.nodeType) {
      case "door":
        scene.doors.push(result.node);
        doorEntryPoints.push(
          createEntryPointNode([result.node.position[0], result.node.position[2]]),
        );
        break;
      case "window":
        scene.windows.push(result.node);
        break;
      case "camera":
        scene.cameras.push(result.node);
        break;
      case "security_light":
        scene.securityLights.push(result.node);
        break;
      case "obstruction":
        scene.obstructions.push(result.node);
        break;
      case "critical_zone":
        scene.criticalZones.push(result.node);
        break;
      case "entry_point":
        explicitEntryPoints.push(result.node);
        break;
    }
  }

  if (!hasStructure) {
    compileWarnings.push({
      code: "NO_WALLS",
      message: "No wall markers or structural extraction; using room dimensions for rectangular shell.",
      severity: "warning",
      suggestedAction: "Review the draft scene and adjust wall positions.",
    });
  }

  scene.entryPoints = mergeEntryPoints(explicitEntryPoints, doorEntryPoints);

  const confidenceValues = accepted.map((c) => c.confidence);
  const avgConfidence =
    confidenceValues.length > 0
      ? confidenceValues.reduce((sum, v) => sum + v, 0) / confidenceValues.length
      : 0;

  const candidateSummary = accepted
    .map((c) => `${c.kind}=${Math.round(c.confidence * 100)}%`)
    .join(", ");

  scene.changeLog = [
    ...scene.changeLog,
    `Reconstruction source: ${RECONSTRUCTION_SOURCE_LABEL}`,
    `Reconstruction mode: ${session.captureMode}`,
    `Reconstruction accepted: ${accepted.length}/${session.candidates.length} candidates`,
    `Reconstruction avg confidence: ${Math.round(avgConfidence * 100)}%`,
    `Reconstruction candidates: ${candidateSummary}`,
    ...(session.photos.length > 0
      ? [`Source photos: ${session.photos.length} captured`]
      : []),
    ...(session.knownMeasurements.length > 0
      ? session.knownMeasurements.map(
          (m) => `Scale anchor: ${m.label}=${m.valueM}m [${m.source}]`,
        )
      : []),
    ...session.warnings.map((w) => `Reconstruction warning: ${w.code} ${w.message}`),
  ];

  const parsed = safeParseSecurityScene(scene);
  if (!parsed.success) {
    compileWarnings.push({
      code: "SCENE_VALIDATION_FAILED",
      message: `Compiled scene failed schema validation: ${parsed.error.issues[0]?.message ?? "unknown"}`,
      severity: "blocking",
    });
    return {
      scene,
      compilerResult: {
        source: "scan",
        scene,
        warnings: [{ code: "VALIDATION_FAILED", message: "Schema validation failed", severity: "blocking" }],
        confidence: 0,
        provenance: { source: "scan", label: RECONSTRUCTION_SOURCE_LABEL, notes: ["Schema validation failed"], confidence: 0 },
      },
      compileWarnings,
      acceptedCount: accepted.length,
      rejectedCount: rejected.length,
    };
  }

  const validated = parsed.data;

  const result = compileScanToSiteResult(validated, [
    `Reconstruction pipeline: ${accepted.length} accepted, ${rejected.length} rejected, ${session.photos.length} photos.`,
    `Capture mode: ${session.captureMode}.`,
    ...(session.knownMeasurements.length > 0
      ? [`Scale anchors: ${session.knownMeasurements.map((m) => `${m.label}=${m.valueM}m`).join(", ")}`]
      : []),
  ]);

  return {
    scene: validated,
    compilerResult: result,
    compileWarnings,
    acceptedCount: accepted.length,
    rejectedCount: rejected.length,
  };
}

export function compileReconstructionToSiteTwinDraft(
  session: ScanCaptureSession,
): SiteTwinDraft {
  const { compilerResult, compileWarnings } = compileReconstructionToScene(session);
  const sourceArtifacts = session.photos.map(
    (p) => `${p.sourceFileName ?? "unnamed"} (${p.role ?? "unassigned"})`,
  );
  const draft = compileToSiteTwinDraft(compilerResult, sourceArtifacts);
  draft.provenance.notes.push(
    ...compileWarnings.map((w) => `Compile warning: ${w.code} ${w.message}`),
  );
  if (session.knownMeasurements.length > 0) {
    draft.assumptions.push({
      label: "Scale anchors",
      value: session.knownMeasurements.map((m) => `${m.label}=${m.valueM}m`).join(", "),
      source: session.knownMeasurements.every((m) => m.source === "user") ? "user" : "estimated",
      confidence: session.knownMeasurements.every((m) => m.source === "user") ? 0.9 : 0.6,
    });
  }
  draft.assumptions.push({
    label: "Capture mode",
    value: captureModeLabel(session.captureMode),
    source: "user",
  });
  return draft;
}

export function estimateOverallConfidence(session: ScanCaptureSession): number {
  const accepted = session.candidates.filter(
    (c) => c.status === "accepted" || c.status === "edited",
  );
  if (accepted.length === 0) return 0;

  const avgCandidateConfidence =
    accepted.reduce((sum, c) => sum + c.confidence, 0) / accepted.length;

  const hasDepthData = session.artifacts.some((a) => a.kind === "depth_map");
  const hasScaleAnchor = session.knownMeasurements.some((m) => m.source === "user");
  const hasMultiplePhotos = session.photos.length >= 2;
  const hasCorrespondence = accepted.some(
    (c) => c.sourceArtifactIds.length >= 2,
  );

  let multiplier = 1.0;
  if (hasDepthData) multiplier += 0.1;
  if (hasScaleAnchor) multiplier += 0.15;
  if (hasMultiplePhotos) multiplier += 0.05;
  if (hasCorrespondence) multiplier += 0.05;

  const blockingWarnings = session.warnings.filter((w) => w.severity === "blocking").length;
  if (blockingWarnings > 0) multiplier *= 0.5;

  return Math.min(1, avgCandidateConfidence * multiplier);
}

export function computeQualityGates(session: ScanCaptureSession): {
  passed: boolean;
  gates: Array<{ name: string; passed: boolean; message: string }>;
} {
  const gates: Array<{ name: string; passed: boolean; message: string }> = [];

  const hasCameras = session.candidates.some(
    (c) => c.kind === "camera" && (c.status === "accepted" || c.status === "edited"),
  );
  gates.push({
    name: "Cameras present",
    passed: hasCameras,
    message: hasCameras ? "Camera markers found." : "No camera markers accepted; baseline simulation requires at least one camera.",
  });

  const hasCriticalZones = session.candidates.some(
    (c) => c.kind === "critical_zone" && (c.status === "accepted" || c.status === "edited"),
  );
  gates.push({
    name: "Critical zones present",
    passed: hasCriticalZones,
    message: hasCriticalZones ? "Critical zone markers found." : "No critical zone markers accepted; coverage evaluation requires at least one zone.",
  });

  const hasDepthRef = session.artifacts.some((a) => a.kind === "depth_map");
  gates.push({
    name: "Depth reference",
    passed: hasDepthRef,
    message: hasDepthRef ? "Depth data available for position estimation." : "No depth data; positions will be estimated from image coordinates only.",
  });

  const hasUserAnchor = session.knownMeasurements.some((m) => m.source === "user");
  gates.push({
    name: "User-provided scale anchor",
    passed: hasUserAnchor,
    message: hasUserAnchor ? "User-provided scale anchor present." : "No user-provided scale anchor; dimensions and positions will use estimated values.",
  });

  const hasEntryPoints = session.candidates.some(
    (c) => c.kind === "entry_point" && (c.status === "accepted" || c.status === "edited"),
  );
  const hasDoors = session.candidates.some(
    (c) => c.kind === "door" && (c.status === "accepted" || c.status === "edited"),
  );
  gates.push({
    name: "Entry points defined",
    passed: hasEntryPoints || hasDoors,
    message: hasEntryPoints || hasDoors ? "Entry points or doors found." : "No entry points or doors marked; route analysis will be limited.",
  });

  const hasMultiplePhotos = session.photos.length >= 2;
  gates.push({
    name: "Multi-photo coverage",
    passed: hasMultiplePhotos,
    message: hasMultiplePhotos ? `${session.photos.length} photos captured.` : "Only one photo; multi-photo correspondence and depth fusion unavailable.",
  });

  const candidateBlockingWarnings = session.candidates.some((c) =>
    c.warnings.some((w) => w.severity === "blocking"),
  );
  gates.push({
    name: "No blocking candidate warnings",
    passed: !candidateBlockingWarnings,
    message: candidateBlockingWarnings ? "Some candidates have blocking warnings." : "No blocking warnings on candidates.",
  });

  const blocked = session.warnings.some((w) => w.severity === "blocking");
  gates.push({
    name: "No blocking session warnings",
    passed: !blocked,
    message: blocked ? "Session has blocking warnings that must be resolved." : "No blocking session warnings.",
  });

  return {
    passed: gates.every((g) => g.passed),
    gates,
  };
}

export function computeDefaultWarnings(session: ScanCaptureSession): ScanCaptureSession {
  let updated = { ...session };

  const hasCameraCandidate = session.candidates.some(
    (c) => c.kind === "camera",
  );
  if (!hasCameraCandidate) {
    updated = addWarning(updated, {
      code: "NO_CAMERAS",
      message: "No camera markers found. Add camera markers for coverage simulation.",
      severity: "warning",
      suggestedAction: "Mark cameras in the captured photos, or skip camera detection if reviewing only.",
    });
  }

  const hasCriticalZone = session.candidates.some(
    (c) => c.kind === "critical_zone",
  );
  if (!hasCriticalZone) {
    updated = addWarning(updated, {
      code: "NO_CRITICAL_ZONES",
      message: "No critical zone markers found. Coverage evaluation requires at least one zone.",
      severity: "warning",
      suggestedAction: "Mark cash counters, entry gates, or other high-value areas as critical zones.",
    });
  }

  const hasMeasurement = session.knownMeasurements.some(
    (m) => m.source === "user",
  );
  if (!hasMeasurement) {
    updated = addWarning(updated, {
      code: "DIMENSIONS_UNANCHORED",
      message: "No user-provided scale anchor. Dimensions and positions are estimated.",
      severity: "info",
      suggestedAction: "Enter a known measurement (e.g., door width = 0.9m) to anchor scale.",
    });
  }

  if (session.photos.length < 2) {
    updated = addWarning(updated, {
      code: "SINGLE_PHOTO_ONLY",
      message: "Only one photo captured. Multi-photo correspondence and depth fusion unavailable.",
      severity: "info",
      suggestedAction: "Capture photos from multiple angles for better spatial reconstruction.",
    });
  }

  return updated;
}

export function computeConfidenceLabel(confidence: number): "very_low" | "low" | "medium" | "high" {
  if (confidence >= 0.8) return "high";
  if (confidence >= 0.6) return "medium";
  if (confidence >= 0.3) return "low";
  return "very_low";
}

/**
 * Compile a ScanCaptureSession directly to a SiteCompilerResult.
 *
 * This is the dedicated reconstruction pipeline entry point that returns
 * a SiteCompilerResult compatible with the site-intake workflow. Callers
 * that need the full scene + warnings tuple can use compileReconstructionToScene
 * directly instead.
 */
export function compileReconstructionToSiteResult(
  session: ScanCaptureSession,
): SiteCompilerResult {
  const { compilerResult } = compileReconstructionToScene(session);
  return compilerResult;
}
