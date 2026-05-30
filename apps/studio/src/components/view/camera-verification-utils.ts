export type VerificationViewMode = "overlay" | "split";
export type VerificationSourceType = "image" | "video";
export type VerificationAlignmentMethod = "manual" | "auto";

export type CameraVerificationSnapshot = {
  id: string;
  fileName: string;
  imageUrl: string;
  mode: VerificationViewMode;
  sourceType?: VerificationSourceType;
  sampleTimeS?: number | null;
  videoDurationS?: number | null;
  candidateCount?: number;
  bestCandidateId?: string | null;
  bestCandidateScore?: number | null;
  selectedCandidateId?: string | null;
  alignmentMethod?: VerificationAlignmentMethod | null;
  autoAlignDelta?: number | null;
  opacity: number;
  split: number;
  offsetX: number;
  offsetY: number;
  scale?: number;
  alignmentScore: number | null;
  createdAt: number;
};

export type VideoFrameCandidate = {
  id: string;
  timeS: number;
  dataUrl: string;
  qualityScore: number;
};

export function formatSecondsShort(seconds: number) {
  const clamped = Math.max(0, Math.floor(seconds));
  const mins = Math.floor(clamped / 60);
  const secs = clamped % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

export function alignmentQualityLabel(score: number) {
  if (score >= 85) return "Excellent";
  if (score >= 70) return "Good";
  if (score >= 50) return "Fair";
  return "Poor";
}

export function formatSnapshotEvidenceSummary(snapshot: CameraVerificationSnapshot) {
  const alignTag = snapshot.alignmentMethod === "auto"
    ? `auto align${typeof snapshot.autoAlignDelta === "number" ? ` (${snapshot.autoAlignDelta >= 0 ? "+" : ""}${snapshot.autoAlignDelta.toFixed(1)})` : ""}`
    : snapshot.alignmentMethod === "manual"
      ? "manual align"
      : null;
  const scaleTag = typeof snapshot.scale === "number" && Math.abs(snapshot.scale - 1) > 0.01
    ? `scale ${Math.round(snapshot.scale * 100)}%`
    : null;

  if (snapshot.sourceType !== "video") {
    return `Image upload${alignTag ? ` · ${alignTag}` : ""}${scaleTag ? ` · ${scaleTag}` : ""}`;
  }

  const sampled = snapshot.sampleTimeS !== null && snapshot.sampleTimeS !== undefined
    ? formatSecondsShort(snapshot.sampleTimeS)
    : "0:00";
  const duration = snapshot.videoDurationS !== null && snapshot.videoDurationS !== undefined
    ? formatSecondsShort(snapshot.videoDurationS)
    : "--:--";
  const frames = typeof snapshot.candidateCount === "number" && snapshot.candidateCount > 0
    ? `${snapshot.candidateCount} frame${snapshot.candidateCount === 1 ? "" : "s"}`
    : "frame set unavailable";
  const picked = snapshot.selectedCandidateId
    ? snapshot.selectedCandidateId === snapshot.bestCandidateId
      ? "best frame selected"
      : "manual frame selected"
    : "no frame selected";
  const bestScore = typeof snapshot.bestCandidateScore === "number"
    ? `best score ${snapshot.bestCandidateScore.toFixed(1)}`
    : null;

  return `Video ${sampled}/${duration} · ${frames}${bestScore ? ` · ${bestScore}` : ""} · ${picked}${alignTag ? ` · ${alignTag}` : ""}${scaleTag ? ` · ${scaleTag}` : ""}`;
}
