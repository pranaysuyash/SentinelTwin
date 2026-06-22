import type { FloorPlanSourceProfile } from "@/lib/floor-plan-import";
export type { FloorPlanSourceProfile };

export const FLOOR_PLAN_SOURCE_PROFILES: readonly FloorPlanSourceProfile[] = [
  "architectural",
  "hand_drawn",
  "low_res_scan",
] as const;

export interface FloorPlanSourceProfilePreset {
  profile: FloorPlanSourceProfile;
  label: string;
  hint: string;
  edgeThreshold: number;
  minWallLengthPx: number;
}

export function getFloorPlanSourceProfileHint(profile: FloorPlanSourceProfile): string {
  const entry = getFloorPlanSourceProfileDetails(profile);
  return entry.hint;
}

export function getFloorPlanSourceProfileLabel(profile: FloorPlanSourceProfile): string {
  const entry = getFloorPlanSourceProfileDetails(profile);
  return entry.label;
}

export function listFloorPlanSourceProfiles(): readonly FloorPlanSourceProfilePreset[] {
  return FLOOR_PLAN_SOURCE_PRESETS;
}

const FLOOR_PLAN_SOURCE_PRESETS: readonly FloorPlanSourceProfilePreset[] = [
  {
    profile: "architectural",
    label: "Architectural CAD / clean print",
    hint: "Best for precise linework and labels: use higher edge threshold and stronger noise suppression so annotations are less likely to become walls.",
    edgeThreshold: 46,
    minWallLengthPx: 28,
  },
  {
    profile: "hand_drawn",
    label: "Hand-drawn / sketch",
    hint: "Looser detection with lower edge threshold. Good for pencil, marker, and uneven strokes, but expect more false positives in legends and room notes.",
    edgeThreshold: 26,
    minWallLengthPx: 12,
  },
  {
    profile: "low_res_scan",
    label: "Low-res / phone snapshot",
    hint: "Moderate sensitivity for noisy scans. Use with a manual calibration pass; expect medium correction effort.",
    edgeThreshold: 34,
    minWallLengthPx: 18,
  },
];

function getFloorPlanSourceProfileDetails(profile: FloorPlanSourceProfile): FloorPlanSourceProfilePreset {
  const normalizedProfile = FLOOR_PLAN_SOURCE_PRESETS.find((entry) => entry.profile === profile);
  if (normalizedProfile) {
    return normalizedProfile;
  }
  return FLOOR_PLAN_SOURCE_PRESETS[0];
}

export function getFloorPlanExtractionConfig(state: {
  heightM: number;
  floorPlanScalePixelsPerMeter: number;
  sourceProfile?: FloorPlanSourceProfile;
}) {
  const sourceProfile = (state as { sourceProfile?: FloorPlanSourceProfile }).sourceProfile ?? "architectural";
  const preset = getFloorPlanSourceProfileDetails(sourceProfile);

  return {
    roomHeightM: state.heightM,
    scalePixelsPerMeter: state.floorPlanScalePixelsPerMeter,
    edgeThreshold: preset.edgeThreshold,
    minWallLengthPx: preset.minWallLengthPx,
  };
}
