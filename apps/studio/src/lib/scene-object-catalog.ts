import { OBSTRUCTION_PRESETS, CUSTOM_OBSTRUCTION_PRESET_ID } from "@/lib/obstruction-presets";

export type SceneObjectLayerId = "structural" | "security_fixture" | "fit_out";

export type SceneObjectLayer = {
  id: SceneObjectLayerId;
  label: string;
  description: string;
  addPath: string;
  marketplaceRole: string;
  liveExamples: string[];
  futureExamples?: string[];
};

export const SCENE_OBJECT_LAYERS: SceneObjectLayer[] = [
  {
    id: "structural",
    label: "Structural primitives",
    description: "Walls, doors, and windows define the editable shell. They are geometry first, not marketplace-first.",
    addPath: "Wall tool / Door-Window tool",
    marketplaceRole: "Core structure",
    liveExamples: ["Walls", "Doors", "Windows"],
    futureExamples: ["Roller shutters", "Double doors", "Glass storefronts"],
  },
  {
    id: "security_fixture",
    label: "Security fixtures",
    description: "Cameras, lights, and sensors are the current operational objects the simulator already understands.",
    addPath: "Camera tool / Light tool / Sensor tool",
    marketplaceRole: "Configured hardware",
    liveExamples: ["Cameras", "Security lights", "Sensors"],
    futureExamples: ["Bundled CCTV kits", "Night-vision bundles", "Access-control packs"],
  },
  {
    id: "fit_out",
    label: "Fit-out objects",
    description: "These are the strongest marketplace candidates because they are measurable, customizable, and occlude the scene.",
    addPath: "Obstruction tool",
    marketplaceRole: "Marketplace-ready",
    liveExamples: OBSTRUCTION_PRESETS.filter((preset) => preset.id !== CUSTOM_OBSTRUCTION_PRESET_ID).map((preset) => preset.label),
    futureExamples: ["Wardrobes", "Desks", "Cabinets", "Sofas", "Window blinds"],
  },
];

export function getSceneObjectLayerCounts() {
  return {
    structural: SCENE_OBJECT_LAYERS.find((layer) => layer.id === "structural")?.liveExamples.length ?? 0,
    securityFixture: SCENE_OBJECT_LAYERS.find((layer) => layer.id === "security_fixture")?.liveExamples.length ?? 0,
    fitOut: SCENE_OBJECT_LAYERS.find((layer) => layer.id === "fit_out")?.liveExamples.length ?? 0,
  };
}

