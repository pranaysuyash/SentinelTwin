import type { CriticalZoneNode, DoriQuality } from "../schema/security-scene.js";

export type TargetType = CriticalZoneNode["targetType"];
type RequiredZoneQuality = Exclude<DoriQuality, "none">;

export const TARGET_QUALITY_REQUIREMENTS: Record<TargetType, {
  defaultRequiredQuality: RequiredZoneQuality;
  rationale: string;
  ppmThreshold: "high" | "medium" | "low";
}> = {
  person_detection: {
    defaultRequiredQuality: "detection",
    rationale: "Person presence is sufficient; identification not required for general monitoring",
    ppmThreshold: "low",
  },
  face_recognition: {
    defaultRequiredQuality: "recognition",
    rationale: "Face recognition requires enough detail to match known individuals",
    ppmThreshold: "high",
  },
  face_identification: {
    defaultRequiredQuality: "identification",
    rationale: "Face identification requires the highest detail for unknown subject identification",
    ppmThreshold: "high",
  },
  vehicle_detection: {
    defaultRequiredQuality: "detection",
    rationale: "Vehicle presence detection needs only coarse visual confirmation",
    ppmThreshold: "low",
  },
  license_plate: {
    defaultRequiredQuality: "identification",
    rationale: "License plate reading requires the highest resolution for OCR accuracy",
    ppmThreshold: "high",
  },
  package_detection: {
    defaultRequiredQuality: "detection",
    rationale: "Package presence requires only shape/motion confirmation",
    ppmThreshold: "low",
  },
  cash_counter_activity: {
    defaultRequiredQuality: "recognition",
    rationale: "Cash counter monitoring needs enough detail to recognize actions and individuals",
    ppmThreshold: "medium",
  },
  door_entry_exit: {
    defaultRequiredQuality: "observation",
    rationale: "Entry/exit monitoring needs to track movement direction and count",
    ppmThreshold: "low",
  },
  perimeter_breach: {
    defaultRequiredQuality: "detection",
    rationale: "Perimeter breach detection requires early warning, not identification",
    ppmThreshold: "low",
  },
};

export function getDefaultQualityForTarget(targetType: TargetType): RequiredZoneQuality {
  return TARGET_QUALITY_REQUIREMENTS[targetType]?.defaultRequiredQuality ?? "detection";
}

export function getTargetRequirementInfo(targetType: TargetType) {
  return TARGET_QUALITY_REQUIREMENTS[targetType] ?? {
    defaultRequiredQuality: "detection" as RequiredZoneQuality,
    rationale: "Unknown target type; defaulting to detection",
    ppmThreshold: "low" as const,
  };
}
