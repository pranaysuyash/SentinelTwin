import type { DoriQuality } from "@/schema/security-scene";

export function formatOutcomeStatusLabel(status: "not_run" | "pass" | "needs_attention" | "high_risk" | "incomplete") {
  if (status === "not_run") return "Simulation Not Run";
  if (status === "pass") return "Pass";
  if (status === "needs_attention") return "Needs Attention";
  if (status === "high_risk") return "High Risk";
  return "Incomplete";
}

export function qualityLabel(quality: DoriQuality) {
  return quality.replace(/_/g, " ").replace(/\b\w/g, (m) => m.toUpperCase());
}

