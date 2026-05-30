import type { SecurityOutcomeStatus } from "./security-outcome-model";
import type { DoriQuality } from "@/schema/security-scene";
import { qualityToScore } from "@sentineltwin/core";

export function formatOutcomeStatusLabel(status: SecurityOutcomeStatus) {
  if (status === "not_run") return "Simulation Not Run";
  if (status === "pass") return "Pass";
  if (status === "needs_attention") return "Needs Attention";
  if (status === "high_risk") return "High Risk";
  return "Incomplete";
}

export function formatVerificationLabel(label: string): string {
  if (label === "verified_by_simulation") return "Verified by simulation";
  if (label === "not_yet_tested") return "Not yet tested";
  if (label === "requires_user_input") return "Requires user input";
  if (label === "assumption_based") return "Assumption-based";
  return label;
}

export function formatVerificationTone(label: string): string {
  if (label === "verified_by_simulation") return "text-emerald-300";
  if (label === "not_yet_tested") return "text-amber-300";
  if (label === "requires_user_input") return "text-blue-300";
  return "text-slate-400";
}

export function explainFailureReason(technicalReason: string): string {
  const lower = technicalReason.toLowerCase();

  if (lower.includes("blocked by")) {
    const match = technicalReason.match(/blocked by[:\s]+(.+)/i);
    const blocker = match ? match[1].trim() : "an obstruction";
    return `${blocker} blocks the camera's line of sight.`;
  }
  if (lower.includes("night")) return "Night conditions reduce useful detail in this zone.";
  if (lower.includes("out of range") || lower.includes("range")) return "The camera is too far from this zone to provide useful quality.";
  if (lower.includes("fov") || lower.includes("field of view")) return "The area falls outside the camera's field of view.";
  if (lower.includes("no redundancy") || lower.includes("single")) return "No backup camera covers this zone at the required quality.";
  if (lower.includes("backlight")) return "Strong backlighting reduces subject contrast and detail.";
  if (lower.includes("glare")) return "Glare or reflections from surfaces reduce effective camera quality.";
  if (lower.includes("glass") || lower.includes("semi-transparent")) return "semi-transparent material between camera and zone reduces effective quality.";
  if (lower.includes("no coverage") || lower.includes("no camera")) return "No camera covers this zone.";

  return technicalReason;
}

export function explainQualityGap(required: DoriQuality, actual: DoriQuality): string {
  const reqScore = qualityToScore(required);
  const actScore = qualityToScore(actual);

  if (actScore >= reqScore) return `Meets the required quality (${required.replace(/_/g, " ")}).`;
  if (actScore === 0) return `The area is not visible at all. Required: ${required.replace(/_/g, " ")}.`;
  if (actScore <= 1) return `Only presence is detectable, but the area is not clear enough for ${required.replace(/_/g, " ")}.`;
  return `The area is visible, but not clear enough for ${required.replace(/_/g, " ")}. Current quality: ${actual.replace(/_/g, " ")}.`;
}

export function explainCameraOfflineImpact(cameraName: string, zoneLabel: string, afterQuality: DoriQuality): string {
  if (afterQuality === "none") {
    return `If ${cameraName} goes offline, ${zoneLabel} loses all coverage.`;
  }
  const qualityName = afterQuality.charAt(0).toUpperCase() + afterQuality.slice(1).replace(/_/g, " ");
  return `If ${cameraName} goes offline, ${zoneLabel} drops to ${qualityName} quality.`;
}

export function explainPrivacyIssue(cameras: string[], zoneLabel: string): string {
  const cameraList = cameras.length > 1 ? `${cameras.slice(0, -1).join(", ")} and ${cameras[cameras.length - 1]}` : cameras[0] ?? "Camera";
  const verb = cameras.length > 1 ? "see" : "sees";
  return `${cameraList} ${verb} into a privacy-marked area ("${zoneLabel}").`;
}

export function explainPathLoss(pathLabel: string, visiblePct: number): string {
  if (visiblePct === 0) return `${pathLabel} is not visible to any camera along the route.`;
  if (visiblePct < 50) return `${pathLabel} is only ${visiblePct}% visible. Large portions of the route have no camera coverage.`;
  return `${pathLabel} is ${visiblePct}% visible, but has gaps where the subject drops below required quality.`;
}

export function explainPathEmpty(): string {
  return "No incident path defined yet. Add a route from entry to critical zone to test whether the subject remains visible.";
}

export function explainNoZones(): string {
  return "No critical zones defined. Add zones with quality requirements to measure pass/fail.";
}

export function explainNoCameras(): string {
  return "No cameras placed. Add cameras to compute coverage.";
}

export function qualityIsBelow(actual: DoriQuality, required: DoriQuality): boolean {
  return qualityToScore(actual) < qualityToScore(required);
}

export function verificationLabel(verified: boolean): { label: string; tone: string } {
  if (verified) return { label: "Verified by simulation", tone: "emerald" };
  return { label: "Not yet tested", tone: "amber" };
}

export function costLabel(category: string): string {
  if (category === "free") return "Free";
  if (category === "low") return "Low cost";
  if (category === "medium") return "Medium cost";
  if (category === "high") return "High cost";
  return category;
}

export function qualityLabel(quality: DoriQuality): string {
  return quality.replace(/_/g, " ").replace(/\b\w/g, (m) => m.toUpperCase());
}
