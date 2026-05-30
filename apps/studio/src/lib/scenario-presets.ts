import type { CameraNode, SecurityLightNode } from "@/schema/security-scene";

export type CameraStatusOverride = Partial<Pick<CameraNode, "status" | "nightMode">>;
export type LightStatusOverride = Partial<Pick<SecurityLightNode, "status">>;

export type ScenarioPreset = {
  id: string;
  label: string;
  description: string;
  timeOfDay: "day" | "night" | "dusk" | "dawn";
  cameraOverrides: Record<string, CameraStatusOverride>;
  lightOverrides: Record<string, LightStatusOverride>;
  environmentRisks: {
    backlight: boolean;
    glare: boolean;
    overexposed: boolean;
  };
};

export const SCENARIO_PRESETS: ScenarioPreset[] = [
  {
    id: "day_entry",
    label: "Daytime Entry",
    description: "Normal daytime operation, all systems nominal",
    timeOfDay: "day",
    cameraOverrides: {},
    lightOverrides: {},
    environmentRisks: { backlight: false, glare: false, overexposed: false },
  },
  {
    id: "night_entry",
    label: "Night Entry",
    description: "Night conditions with IR and security lighting",
    timeOfDay: "night",
    cameraOverrides: {},
    lightOverrides: {},
    environmentRisks: { backlight: false, glare: true, overexposed: false },
  },
  {
    id: "camera_failure",
    label: "Camera Offline",
    description: "Primary camera fails — check redundancy coverage",
    timeOfDay: "day",
    cameraOverrides: {
      cam_1: { status: "off" },
    },
    lightOverrides: {},
    environmentRisks: { backlight: false, glare: false, overexposed: false },
  },
  {
    id: "light_failure",
    label: "Light Failure",
    description: "Security light out — night coverage degradation",
    timeOfDay: "night",
    cameraOverrides: {},
    lightOverrides: {
      light_1: { status: "off" },
    },
    environmentRisks: { backlight: false, glare: false, overexposed: false },
  },
  {
    id: "door_open",
    label: "Door Left Open",
    description: "Entry door left open — path visibility changes",
    timeOfDay: "day",
    cameraOverrides: {},
    lightOverrides: {},
    environmentRisks: { backlight: true, glare: false, overexposed: true },
  },
  {
    id: "obstruction_added",
    label: "New Obstruction",
    description: "Temporary obstruction placed — coverage impact test",
    timeOfDay: "day",
    cameraOverrides: {},
    lightOverrides: {},
    environmentRisks: { backlight: false, glare: false, overexposed: false },
  },
];

export function getScenarioPreset(id: string): ScenarioPreset | undefined {
  return SCENARIO_PRESETS.find((p) => p.id === id);
}

export function applyScenarioPreset(
  scene: { cameras: CameraNode[]; securityLights: SecurityLightNode[] },
  preset: ScenarioPreset,
): {
  cameraOverrides: Array<{ cameraId: string; status: CameraNode["status"]; nightMode?: CameraNode["nightMode"] }>;
  lightOverrides: Array<{ lightId: string; status: SecurityLightNode["status"] }>;
} {
  const cameraOverrides = scene.cameras
    .filter((cam) => preset.cameraOverrides[cam.id])
    .map((cam) => {
      const override = preset.cameraOverrides[cam.id]!;
      return { cameraId: cam.id, status: override.status ?? cam.status, nightMode: override.nightMode };
    });

  const lightOverrides = scene.securityLights
    .filter((light) => preset.lightOverrides[light.id])
    .map((light) => {
      const override = preset.lightOverrides[light.id]!;
      return { lightId: light.id, status: override.status ?? light.status };
    });

  return { cameraOverrides, lightOverrides };
}
