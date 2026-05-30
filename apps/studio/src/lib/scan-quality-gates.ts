import type { ScanCaptureSession, ScanCandidate } from "@/lib/scan-artifacts";

export type QualityGate =
  | "CAMERAS_REQUIRED"
  | "CRITICAL_ZONES_REQUIRED"
  | "MULTI_PHOTO_REQUIRED"
  | "SCALE_ANCHOR_REQUIRED"
  | "DEPTH_DATA_REQUIRED"
  | "MIN_CANDIDATE_CONFIDENCE";

export type QualityGateResult = {
  gate: QualityGate;
  label: string;
  passed: boolean;
  required: boolean;
  message: string;
  value?: number | string;
  threshold?: number | string;
};

export type QualityGateReport = {
  overall: "pass" | "pass_with_warnings" | "blocked";
  gates: QualityGateResult[];
  summary: string;
};

export const QUALITY_GATE_DEFINITIONS: Array<{
  gate: QualityGate;
  label: string;
  required: boolean;
  defaultThreshold?: number;
  description: string;
}> = [
  {
    gate: "CAMERAS_REQUIRED",
    label: "Cameras Required",
    required: true,
    description: "At least one camera marker must be accepted for coverage simulation.",
  },
  {
    gate: "CRITICAL_ZONES_REQUIRED",
    label: "Critical Zones Required",
    required: true,
    description: "At least one critical zone marker must be accepted for coverage evaluation.",
  },
  {
    gate: "SCALE_ANCHOR_REQUIRED",
    label: "Scale Anchor",
    required: false,
    description: "A user-provided or estimated scale measurement improves spatial accuracy.",
  },
  {
    gate: "MULTI_PHOTO_REQUIRED",
    label: "Multi-Photo Coverage",
    required: false,
    description: "Multiple photos from different angles improve reconstruction quality.",
  },
  {
    gate: "DEPTH_DATA_REQUIRED",
    label: "Depth Data",
    required: false,
    description: "Depth maps or estimation improve position and dimension accuracy.",
  },
  {
    gate: "MIN_CANDIDATE_CONFIDENCE",
    label: "Minimum Candidate Confidence",
    required: false,
    defaultThreshold: 0.4,
    description: "Candidates below the confidence threshold are flagged.",
  },
];

export function evaluateQualityGates(
  session: ScanCaptureSession,
  overrides?: Partial<Record<QualityGate, { required?: boolean; threshold?: number }>>,
): QualityGateReport {
  const gates: QualityGateResult[] = [];

  const hasCamera = session.candidates.some(
    (c) => c.kind === "camera" && (c.status === "accepted" || c.status === "edited"),
  );
  gates.push({
    gate: "CAMERAS_REQUIRED",
    label: "Cameras Required",
    passed: hasCamera,
    required: overrides?.CAMERAS_REQUIRED?.required ?? true,
    message: hasCamera
      ? "At least one camera marker accepted."
      : "No camera markers accepted. Baseline simulation requires at least one camera.",
    value: session.candidates.filter((c) => c.kind === "camera").length,
    threshold: 1,
  });

  const hasCriticalZone = session.candidates.some(
    (c) => c.kind === "critical_zone" && (c.status === "accepted" || c.status === "edited"),
  );
  gates.push({
    gate: "CRITICAL_ZONES_REQUIRED",
    label: "Critical Zones Required",
    passed: hasCriticalZone,
    required: overrides?.CRITICAL_ZONES_REQUIRED?.required ?? true,
    message: hasCriticalZone
      ? "At least one critical zone marker accepted."
      : "No critical zone markers accepted. Coverage evaluation requires at least one zone.",
    value: session.candidates.filter((c) => c.kind === "critical_zone").length,
    threshold: 1,
  });

  const hasUserAnchor = session.knownMeasurements.some((m) => m.source === "user");
  const hasEstimatedAnchor = session.knownMeasurements.length > 0;
  gates.push({
    gate: "SCALE_ANCHOR_REQUIRED",
    label: "Scale Anchor",
    passed: hasUserAnchor || hasEstimatedAnchor,
    required: overrides?.SCALE_ANCHOR_REQUIRED?.required ?? false,
    message: hasUserAnchor
      ? "User-provided scale anchor present."
      : hasEstimatedAnchor
        ? "Estimated scale anchors available (user input recommended)."
        : "No scale anchors. Dimensions will be unanchored estimates.",
    value: hasUserAnchor ? "user" : hasEstimatedAnchor ? "estimated" : "none",
    threshold: "user",
  });

  const hasMultiPhoto = session.photos.length >= 2;
  gates.push({
    gate: "MULTI_PHOTO_REQUIRED",
    label: "Multi-Photo Coverage",
    passed: hasMultiPhoto,
    required: overrides?.MULTI_PHOTO_REQUIRED?.required ?? false,
    message: hasMultiPhoto
      ? `${session.photos.length} photos captured from multiple perspectives.`
      : "Only one photo. Multi-photo correspondence unavailable.",
    value: session.photos.length,
    threshold: 2,
  });

  const hasDepthData = session.artifacts.some((a) => a.kind === "depth_map");
  gates.push({
    gate: "DEPTH_DATA_REQUIRED",
    label: "Depth Data",
    passed: hasDepthData,
    required: overrides?.DEPTH_DATA_REQUIRED?.required ?? false,
    message: hasDepthData
      ? "Depth maps available for position estimation."
      : "No depth data. Positions estimated from 2D image coordinates.",
    value: session.artifacts.filter((a) => a.kind === "depth_map").length,
    threshold: 1,
  });

  const minConfidence = overrides?.MIN_CANDIDATE_CONFIDENCE?.threshold ?? 0.4;
  const lowConfCandidates = session.candidates.filter(
    (c) => c.confidence < minConfidence && c.status !== "rejected",
  );
  gates.push({
    gate: "MIN_CANDIDATE_CONFIDENCE",
    label: "Minimum Candidate Confidence",
    passed: lowConfCandidates.length === 0,
    required: overrides?.MIN_CANDIDATE_CONFIDENCE?.required ?? false,
    message: lowConfCandidates.length === 0
      ? `All candidates meet minimum confidence threshold (${minConfidence}).`
      : `${lowConfCandidates.length} candidate(s) below confidence threshold ${minConfidence}.`,
    value: lowConfCandidates.length,
    threshold: minConfidence,
  });

  const requiredFailed = gates.filter((g) => g.required && !g.passed);
  const optionalFailed = gates.filter((g) => !g.required && !g.passed);

  let overall: QualityGateReport["overall"];
  let summary: string;

  if (requiredFailed.length > 0) {
    overall = "blocked";
    summary = `Blocked: ${requiredFailed.length} required gate(s) not passed (${requiredFailed.map((g) => g.label).join(", ")}).`;
  } else if (optionalFailed.length > 0) {
    overall = "pass_with_warnings";
    summary = `Passed with warnings: ${optionalFailed.length} optional gate(s) not passed (${optionalFailed.map((g) => g.label).join(", ")}).`;
  } else {
    overall = "pass";
    summary = "All quality gates passed.";
  }

  return { overall, gates, summary };
}

export function qualityGateToWarning(
  report: QualityGateReport,
): Array<{ code: string; message: string; severity: "info" | "warning" | "blocking" }> {
  return report.gates
    .filter((g) => !g.passed)
    .map((g) => ({
      code: `GATE_${g.gate}`,
      message: g.message,
      severity: g.required ? "blocking" as const : "warning" as const,
    }));
}
