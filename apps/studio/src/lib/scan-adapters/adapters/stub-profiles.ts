import type { ScanCaptureSession } from "@/lib/scan-artifacts";

export type StubImageProfile = {
  label: string;
  dominantObjects: Array<{
    kind: string;
    confidence: number;
    positionHint: [number, number];
    size: "small" | "medium" | "large";
  }>;
};

const ROLE_PROFILES: Record<string, StubImageProfile> = {
  overview: {
    label: "Room overview",
    dominantObjects: [
      { kind: "wall", confidence: 0.65, positionHint: [0.5, 0.5], size: "large" },
      { kind: "entry_point", confidence: 0.55, positionHint: [0.1, 0.5], size: "medium" },
    ],
  },
  front_wall: {
    label: "Front wall facing entrance",
    dominantObjects: [
      { kind: "wall", confidence: 0.7, positionHint: [0.5, 0.3], size: "large" },
      { kind: "counter", confidence: 0.6, positionHint: [0.5, 0.7], size: "medium" },
      { kind: "entry_point", confidence: 0.55, positionHint: [0.5, 0.1], size: "medium" },
    ],
  },
  right_wall: {
    label: "Right side wall",
    dominantObjects: [
      { kind: "wall", confidence: 0.65, positionHint: [0.3, 0.5], size: "large" },
      { kind: "shelf", confidence: 0.55, positionHint: [0.5, 0.6], size: "medium" },
    ],
  },
  left_wall: {
    label: "Left side wall",
    dominantObjects: [
      { kind: "wall", confidence: 0.65, positionHint: [0.7, 0.5], size: "large" },
      { kind: "shelf", confidence: 0.5, positionHint: [0.5, 0.5], size: "medium" },
    ],
  },
  rear_wall: {
    label: "Rear wall facing away from entrance",
    dominantObjects: [
      { kind: "wall", confidence: 0.65, positionHint: [0.5, 0.7], size: "large" },
      { kind: "cupboard", confidence: 0.55, positionHint: [0.5, 0.5], size: "medium" },
    ],
  },
  critical_zones: {
    label: "Critical zone close-up",
    dominantObjects: [
      { kind: "counter", confidence: 0.75, positionHint: [0.5, 0.5], size: "medium" },
      { kind: "critical_zone", confidence: 0.7, positionHint: [0.5, 0.5], size: "medium" },
    ],
  },
  existing_cameras: {
    label: "Existing camera close-up",
    dominantObjects: [
      { kind: "camera", confidence: 0.8, positionHint: [0.5, 0.4], size: "small" },
    ],
  },
  entry_points: {
    label: "Entry point",
    dominantObjects: [
      { kind: "door", confidence: 0.75, positionHint: [0.5, 0.3], size: "medium" },
      { kind: "entry_point", confidence: 0.7, positionHint: [0.5, 0.5], size: "medium" },
    ],
  },
};

const DEFAULT_PROFILE: StubImageProfile = {
  label: "Unclassified photo",
  dominantObjects: [
    { kind: "obstruction", confidence: 0.4, positionHint: [0.5, 0.5], size: "medium" },
  ],
};

export function getStubProfileForRole(role?: string): StubImageProfile {
  if (role && role in ROLE_PROFILES) {
    return ROLE_PROFILES[role];
  }
  return DEFAULT_PROFILE;
}

export function addJitter(value: number, amount: number = 0.05): number {
  return Math.max(0, Math.min(1, value + (Math.random() - 0.5) * amount));
}
