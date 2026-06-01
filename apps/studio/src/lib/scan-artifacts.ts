export type ScanCandidateKind =
  | "wall"
  | "door"
  | "window"
  | "camera"
  | "light"
  | "cupboard"
  | "counter"
  | "shelf"
  | "obstruction"
  | "pillar"
  | "entry_point"
  | "critical_zone"
  | "path_point";

export type ScanCandidateStatus = "pending" | "accepted" | "edited" | "rejected";

export type ScanCandidate = {
  id: string;
  kind: ScanCandidateKind;
  label: string;
  imagePoint: [number, number];
  boundingBox?: [number, number, number, number];
  maskArtifactId?: string;
  confidence: number;
  manual: boolean;
  status: ScanCandidateStatus;
  sourceArtifactIds: string[];
  note?: string;
  estimatedPosition?: [number, number, number];
  estimatedDimensions?: [number, number, number];
  widthHintM?: number;
  depthHintM?: number;
  heightHintM?: number;
  source: "manual" | "model_detection" | "segmentation" | "structural_extraction";
  warnings: ScanCandidateWarning[];
};

export type ScanCandidateWarningCode =
  | "LOW_CONFIDENCE"
  | "DIMENSIONS_ESTIMATED"
  | "POSITION_ESTIMATED"
  | "NO_MASK"
  | "NO_DEPTH_REFERENCE"
  | "FAR_FROM_CAMERA"
  | "NOT_ALIGNED_TO_WALL"
  | "SINGLE_PHOTO_ONLY"
  | "DEPTH_OUTLIER";

export type ScanCandidateWarning = {
  code: ScanCandidateWarningCode;
  message: string;
  severity: "info" | "warning" | "blocking";
};

export type ScanArtifactKind =
  | "photo"
  | "video_frame"
  | "depth_map"
  | "mask"
  | "point_cloud"
  | "camera_pose";

export type ScanArtifact = {
  id: string;
  kind: ScanArtifactKind;
  sourceFileName?: string;
  dataUrl?: string;
  widthPx?: number;
  heightPx?: number;
  capturedAt?: number;
  captureStep?: string;
  linkedCandidateIds: string[];
  confidence?: number;
  metadata?: Record<string, unknown>;
};

export type PhotoArtifact = ScanArtifact & {
  kind: "photo";
  exif?: {
    focalLengthMm?: number;
    aperture?: number;
    iso?: number;
    make?: string;
    model?: string;
    orientation?: number;
  };
  role?: "front_wall" | "right_wall" | "left_wall" | "rear_wall" | "overview" | "detail" | "critical_zone" | "camera_closeup";
};

export type DepthMapArtifact = ScanArtifact & {
  kind: "depth_map";
  depthMinM: number;
  depthMaxM: number;
  modelId?: string;
};

export type MaskArtifact = ScanArtifact & {
  kind: "mask";
  modelId?: string;
  classLabel?: string;
  classConfidence?: number;
};

export type ScanCaptureStepKind =
  | "overview"
  | "front_wall"
  | "right_wall"
  | "left_wall"
  | "rear_wall"
  | "critical_zones"
  | "existing_cameras"
  | "obstructions"
  | "entry_points"
  | "ceiling"
  | "known_measurement"
  | "dimensions"
  | "complete";

export type ScanCaptureStep = {
  kind: ScanCaptureStepKind;
  label: string;
  instruction: string;
  required: boolean;
  completed: boolean;
  artifactId?: string;
};

export type KnownMeasurement = {
  label: string;
  valueM: number;
  source: "user" | "estimated" | "model";
};

export type ScanWarningCode =
  | "NO_CAMERAS"
  | "NO_CRITICAL_ZONES"
  | "NO_ENTRY_POINTS"
  | "NO_OBSTRUCTIONS"
  | "NO_WALLS"
  | "NO_PATHS"
  | "SCENE_VALIDATION_FAILED"
  | "LOW_OVERALL_CONFIDENCE"
  | "DIMENSIONS_UNANCHORED"
  | "SINGLE_PHOTO_ONLY"
  | "TEMPORARY_PERIMETER"
  | "SCENARIO_ESCALATION_REQUIRED"
  | "NO_DEPTH_DATA"
  | "MULTIPLE_CAMERAS_UNVERIFIED"
  | "UNEVEN_COVERAGE";

export type ScanWarning = {
  code: ScanWarningCode;
  message: string;
  severity: "info" | "warning" | "blocking";
  suggestedAction?: string;
};

export type CaptureMode = "manual_assisted" | "guided_capture" | "ai_assisted";
export type ScanOperationalMode = "permanent" | "temporary_event";

export type ScanOperationalContext = {
  isEmergencyWindow?: boolean;
  requiresTemporaryPerimeterLockdown?: boolean;
  notes?: string;
};

export type ScanCaptureSession = {
  id: string;
  sceneName: string;
  captureMode: CaptureMode;
  operationalMode: ScanOperationalMode;
  operationalContext?: ScanOperationalContext;
  captureSteps: ScanCaptureStep[];
  roomDimensions?: {
    widthM?: number;
    depthM?: number;
    heightM?: number;
  };
  knownMeasurements: KnownMeasurement[];
  photos: PhotoArtifact[];
  artifacts: ScanArtifact[];
  candidates: ScanCandidate[];
  warnings: ScanWarning[];
  createdAt: number;
  updatedAt: number;
  overallConfidence?: number;
};

export type ReconstructionResult = {
  session: ScanCaptureSession;
  draftCandidates: ScanCandidate[];
  warnings: ScanWarning[];
  confidence: number;
};

export type ReconstructionState =
  | "pending"
  | "capturing"
  | "processing"
  | "review_required"
  | "ready_for_compile"
  | "compiled"
  | "failed";

export const SCAN_CAPTURE_STEPS: ScanCaptureStep[] = [
  { kind: "overview", label: "Room Overview", instruction: "Capture the full room from the entrance to establish spatial context.", required: true, completed: false },
  { kind: "front_wall", label: "Front Wall", instruction: "Stand near the entrance and capture the front wall straight on.", required: true, completed: false },
  { kind: "right_wall", label: "Right Wall", instruction: "Rotate right and capture the side wall.", required: true, completed: false },
  { kind: "left_wall", label: "Left Wall", instruction: "Rotate left and capture the opposite side wall.", required: true, completed: false },
  { kind: "rear_wall", label: "Rear Wall", instruction: "Move to the far end and capture the rear wall facing the entrance.", required: true, completed: false },
  { kind: "critical_zones", label: "Critical Zones", instruction: "Capture close-ups of high-value areas: cash counter, server rack, secure storage.", required: true, completed: false },
  { kind: "existing_cameras", label: "Existing Cameras", instruction: "Capture existing cameras up close for mount and model identification.", required: false, completed: false },
  { kind: "obstructions", label: "Major Obstructions", instruction: "Capture large shelving, pillars, partitions, or display units from multiple angles.", required: false, completed: false },
  { kind: "entry_points", label: "Entry Points", instruction: "Capture all doors, gates, and access points.", required: true, completed: false },
  { kind: "ceiling", label: "Ceiling", instruction: "Capture the ceiling layout for light fixture and ceiling-mount camera placement.", required: false, completed: false },
  { kind: "known_measurement", label: "Reference Measurement", instruction: "Measure a known reference (door width, counter height, floor tile) and enter it below.", required: true, completed: false },
  { kind: "dimensions", label: "Room Dimensions", instruction: "Enter approximate room dimensions or mark them on the floor plan.", required: true, completed: false },
  { kind: "complete", label: "Review & Compile", instruction: "Review all captures, mark candidates, and compile into the site draft.", required: true, completed: false },
];

export const DEFAULT_KNOWN_MEASUREMENTS: KnownMeasurement[] = [
  { label: "Standard door width", valueM: 0.9, source: "estimated" },
  { label: "Standard counter height", valueM: 1.1, source: "estimated" },
];

function makeId(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

export function createScanCaptureSession(
  sceneName: string,
  captureMode: CaptureMode = "guided_capture",
  operationalMode: ScanOperationalMode = "permanent",
): ScanCaptureSession {
  const now = Date.now();
  return {
    id: makeId("cap"),
    sceneName: sceneName.trim() || "Site Capture",
    captureMode,
    operationalMode,
    captureSteps: SCAN_CAPTURE_STEPS.map((step) => ({ ...step })),
    knownMeasurements: [...DEFAULT_KNOWN_MEASUREMENTS],
    photos: [],
    artifacts: [],
    candidates: [],
    warnings: [],
    createdAt: now,
    updatedAt: now,
  };
}

export function createPhotoArtifact(
  dataUrl: string,
  fileName: string,
  widthPx: number,
  heightPx: number,
  role?: PhotoArtifact["role"],
): PhotoArtifact {
  return {
    id: makeId("photo"),
    kind: "photo",
    sourceFileName: fileName,
    dataUrl,
    widthPx,
    heightPx,
    capturedAt: Date.now(),
    linkedCandidateIds: [],
    role,
  };
}

export function createScanCandidateFromArtifact(
  kind: ScanCandidateKind,
  imagePoint: [number, number],
  sourceArtifactId: string,
  confidence: number,
  source: ScanCandidate["source"] = "model_detection",
): ScanCandidate {
  const labels: Record<ScanCandidateKind, string> = {
    wall: "Wall",
    door: "Door",
    window: "Window",
    camera: "Camera",
    light: "Light",
    cupboard: "Cupboard",
    counter: "Cash Counter",
    shelf: "Shelf",
    obstruction: "Obstruction",
    pillar: "Pillar",
    entry_point: "Entry Point",
    critical_zone: "Critical Zone",
    path_point: "Path Point",
  };

  return {
    id: makeId("candidate"),
    kind,
    label: labels[kind],
    imagePoint,
    confidence,
    manual: false,
    status: "pending",
    sourceArtifactIds: [sourceArtifactId],
    source,
    warnings: [],
  };
}

export function updateScanCaptureSession(
  session: ScanCaptureSession,
  patch: Partial<ScanCaptureSession>,
): ScanCaptureSession {
  return {
    ...session,
    ...patch,
    updatedAt: Date.now(),
  };
}

export function addPhotoToSession(
  session: ScanCaptureSession,
  photo: PhotoArtifact,
): ScanCaptureSession {
  return updateScanCaptureSession(session, {
    photos: [...session.photos, photo],
    artifacts: [...session.artifacts, photo],
  });
}

export function addCandidateToSession(
  session: ScanCaptureSession,
  candidate: ScanCandidate,
): ScanCaptureSession {
  return updateScanCaptureSession(session, {
    candidates: [...session.candidates, candidate],
  });
}

export function updateCandidateInSession(
  session: ScanCaptureSession,
  candidateId: string,
  patch: Partial<ScanCandidate>,
): ScanCaptureSession {
  return updateScanCaptureSession(session, {
    candidates: session.candidates.map((c) =>
      c.id === candidateId ? { ...c, ...patch } : c,
    ),
  });
}

export function removeCandidateFromSession(
  session: ScanCaptureSession,
  candidateId: string,
): ScanCaptureSession {
  return updateScanCaptureSession(session, {
    candidates: session.candidates.filter((c) => c.id !== candidateId),
  });
}

export function markCaptureStepCompleted(
  session: ScanCaptureSession,
  stepKind: ScanCaptureStepKind,
  artifactId?: string,
): ScanCaptureSession {
  return updateScanCaptureSession(session, {
    captureSteps: session.captureSteps.map((step) =>
      step.kind === stepKind ? { ...step, completed: true, artifactId } : step,
    ),
  });
}

export function addWarning(
  session: ScanCaptureSession,
  warning: ScanWarning,
): ScanCaptureSession {
  const exists = session.warnings.some((w) => w.code === warning.code);
  if (exists) return session;
  return updateScanCaptureSession(session, {
    warnings: [...session.warnings, warning],
  });
}

export function addCandidateWarning(
  candidate: ScanCandidate,
  warning: ScanCandidateWarning,
): ScanCandidate {
  const exists = candidate.warnings.some((w) => w.code === warning.code);
  if (exists) return candidate;
  return { ...candidate, warnings: [...candidate.warnings, warning] };
}

export function linkArtifactToCandidate(
  session: ScanCaptureSession,
  artifactId: string,
  candidateId: string,
): ScanCaptureSession {
  return updateScanCaptureSession(session, {
    artifacts: session.artifacts.map((a) =>
      a.id === artifactId
        ? { ...a, linkedCandidateIds: Array.from(new Set([...a.linkedCandidateIds, candidateId])) }
        : a,
    ),
    candidates: session.candidates.map((c) =>
      c.id === candidateId
        ? { ...c, sourceArtifactIds: Array.from(new Set([...c.sourceArtifactIds, artifactId])) }
        : c,
    ),
  });
}

export function sessionCompletionRatio(session: ScanCaptureSession): number {
  const required = session.captureSteps.filter((step) => step.required);
  if (required.length === 0) return 1;
  return required.filter((step) => step.completed).length / required.length;
}

export function captureModeLabel(mode: CaptureMode): string {
  switch (mode) {
    case "manual_assisted": return "Manual-Assisted";
    case "guided_capture": return "Guided Capture";
    case "ai_assisted": return "AI-Assisted";
  }
}

export function operationalModeLabel(mode: ScanOperationalMode): string {
  switch (mode) {
    case "permanent": return "Permanent";
    case "temporary_event": return "Temporary Event";
  }
}

export function captureModeDescription(mode: CaptureMode): string {
  switch (mode) {
    case "manual_assisted":
      return "User uploads photos and places markers manually. No automatic extraction.";
    case "guided_capture":
      return "Structured capture sequence with step-by-step guidance. AI candidates optional.";
    case "ai_assisted":
      return "AI suggests candidates from photos. User reviews and accepts/rejects before compile.";
  }
}
