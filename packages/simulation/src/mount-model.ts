import type { CameraNode } from "@sentineltwin/core";

export type MountType = CameraNode["mountType"];

export type MountModelConfig = {
  label: string;
  defaultHeightM: number;
  pitchRangeDeg: [min: number, max: number];
  yawRangeDeg: [min: number, max: number] | null;
  blindSpotRadiusM: number;
  tiltPenaltyFactor: number;
};

const MOUNT_MODELS: Record<MountType, MountModelConfig> = {
  wall: {
    label: "Wall Mount",
    defaultHeightM: 2.5,
    pitchRangeDeg: [-60, 30],
    yawRangeDeg: [-90, 90],
    blindSpotRadiusM: 0.8,
    tiltPenaltyFactor: 0.08,
  },
  ceiling: {
    label: "Ceiling Mount",
    defaultHeightM: 3.0,
    pitchRangeDeg: [-90, 0],
    yawRangeDeg: null,
    blindSpotRadiusM: 1.2,
    tiltPenaltyFactor: 0.05,
  },
  pole: {
    label: "Pole Mount",
    defaultHeightM: 3.5,
    pitchRangeDeg: [-55, 20],
    yawRangeDeg: null,
    blindSpotRadiusM: 1.5,
    tiltPenaltyFactor: 0.1,
  },
  corner: {
    label: "Corner Mount",
    defaultHeightM: 2.8,
    pitchRangeDeg: [-65, 25],
    yawRangeDeg: [-120, 120],
    blindSpotRadiusM: 1.0,
    tiltPenaltyFactor: 0.06,
  },
  desk: {
    label: "Desk Mount",
    defaultHeightM: 1.2,
    pitchRangeDeg: [-30, 45],
    yawRangeDeg: [-160, 160],
    blindSpotRadiusM: 0.3,
    tiltPenaltyFactor: 0.04,
  },
};

export function getMountModel(mountType: MountType): MountModelConfig {
  return MOUNT_MODELS[mountType];
}

export function getDefaultHeight(mountType: MountType): number {
  return MOUNT_MODELS[mountType].defaultHeightM;
}

export function computeMountTiltPenalty(
  camera: CameraNode,
): number {
  const model = MOUNT_MODELS[camera.mountType];
  const [pitchMin, pitchMax] = model.pitchRangeDeg;

  let excess = 0;
  if (camera.pitchDeg < pitchMin) {
    excess = pitchMin - camera.pitchDeg;
  } else if (camera.pitchDeg > pitchMax) {
    excess = camera.pitchDeg - pitchMax;
  }

  if (excess <= 0) return 0;
  return Math.min(1, excess * model.tiltPenaltyFactor);
}

export function isPitchWithinMountLimits(camera: CameraNode): boolean {
  const model = MOUNT_MODELS[camera.mountType];
  const [pitchMin, pitchMax] = model.pitchRangeDeg;
  return camera.pitchDeg >= pitchMin && camera.pitchDeg <= pitchMax;
}

export function isYawWithinMountLimits(camera: CameraNode, targetYawDeg: number): boolean {
  const model = MOUNT_MODELS[camera.mountType];
  if (model.yawRangeDeg === null) return true;
  const [yawMin, yawMax] = model.yawRangeDeg;
  return targetYawDeg >= yawMin && targetYawDeg <= yawMax;
}

export function computeBlindSpotPenalty(
  camera: CameraNode,
  targetDistanceM: number,
): number {
  const model = MOUNT_MODELS[camera.mountType];
  if (targetDistanceM > model.blindSpotRadiusM) return 0;
  const fraction = 1 - targetDistanceM / Math.max(model.blindSpotRadiusM, 0.01);
  return Math.min(1, fraction * 0.85);
}
