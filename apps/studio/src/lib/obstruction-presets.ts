import type { ObstructionNode } from "@/schema/security-scene";

/**
 * Obstruction object library — the canonical catalog behind the scene
 * creator's object picker. Each preset maps to the existing
 * `ObstructionNode` contract (no parallel object model): real-world default
 * dimensions, occlusion material, and vision transmission used by the
 * deterministic coverage engine.
 *
 * Pure data + lookups so it stays testable headlessly and reusable by the
 * placement tool, ghost preview, and inspector.
 */

export interface ObstructionPreset {
  id: string;
  label: string;
  description: string;
  obstructionType: ObstructionNode["obstructionType"];
  /** [width, depth, height] in meters — canonical ObstructionNode dimensions order. */
  dimensions: [number, number, number];
  material: ObstructionNode["material"];
  /** 0 = fully blocks vision, 1 = fully transparent. */
  visionTransmission: number;
  glareRisk: boolean;
  nightIRReflective: boolean;
  movable: boolean;
}

export const CUSTOM_OBSTRUCTION_PRESET_ID = "custom";

export const OBSTRUCTION_PRESETS: ObstructionPreset[] = [
  {
    id: "shelf",
    label: "Shelf Unit",
    description: "Retail/storage shelving — full visual block at eye level.",
    obstructionType: "shelf",
    dimensions: [1.2, 0.45, 1.8],
    material: "solid",
    visionTransmission: 0,
    glareRisk: false,
    nightIRReflective: false,
    movable: true,
  },
  {
    id: "counter",
    label: "Counter",
    description: "Service counter — waist height, cameras see over it.",
    obstructionType: "counter",
    dimensions: [1.8, 0.6, 1.1],
    material: "solid",
    visionTransmission: 0,
    glareRisk: false,
    nightIRReflective: false,
    movable: false,
  },
  {
    id: "cupboard",
    label: "Cupboard",
    description: "Tall storage cupboard — common hidden-corner creator.",
    obstructionType: "cupboard",
    dimensions: [1.0, 0.6, 2.0],
    material: "solid",
    visionTransmission: 0,
    glareRisk: false,
    nightIRReflective: false,
    movable: true,
  },
  {
    id: "pillar",
    label: "Pillar",
    description: "Structural column — narrow but full-height occluder.",
    obstructionType: "pillar",
    dimensions: [0.5, 0.5, 3.0],
    material: "solid",
    visionTransmission: 0,
    glareRisk: false,
    nightIRReflective: false,
    movable: false,
  },
  {
    id: "glass_display",
    label: "Glass Display Case",
    description: "Partially see-through; adds glare and IR reflection risk.",
    obstructionType: "glass_display",
    dimensions: [1.5, 0.6, 1.2],
    material: "glass",
    visionTransmission: 0.7,
    glareRisk: true,
    nightIRReflective: true,
    movable: true,
  },
  {
    id: "partition",
    label: "Partition",
    description: "Half-height divider — blocks seated/crouched visibility.",
    obstructionType: "partition",
    dimensions: [1.6, 0.1, 1.5],
    material: "solid",
    visionTransmission: 0,
    glareRisk: false,
    nightIRReflective: false,
    movable: true,
  },
  {
    id: "vehicle",
    label: "Vehicle",
    description: "Parked car/van — large outdoor occluder with IR-reflective body.",
    obstructionType: "vehicle",
    dimensions: [1.9, 4.6, 1.6],
    material: "solid",
    visionTransmission: 0,
    glareRisk: true,
    nightIRReflective: true,
    movable: true,
  },
  {
    id: "tree",
    label: "Tree / Planter",
    description: "Foliage — partial seasonal occlusion, soft visual block.",
    obstructionType: "tree",
    dimensions: [1.2, 1.2, 2.6],
    material: "partial",
    visionTransmission: 0.3,
    glareRisk: false,
    nightIRReflective: false,
    movable: false,
  },
  {
    id: CUSTOM_OBSTRUCTION_PRESET_ID,
    label: "Custom Object",
    description: "Any box-shaped object with your own dimensions.",
    obstructionType: "other",
    dimensions: [1, 1, 1],
    material: "solid",
    visionTransmission: 0,
    glareRisk: false,
    nightIRReflective: false,
    movable: true,
  },
];

export function getObstructionPreset(presetId: string | null | undefined): ObstructionPreset {
  return OBSTRUCTION_PRESETS.find((preset) => preset.id === presetId) ?? OBSTRUCTION_PRESETS[0];
}

/**
 * Resolves the dimensions to place for a preset, honoring user-entered
 * custom dimensions for the custom preset.
 */
export function resolvePresetDimensions(
  preset: ObstructionPreset,
  customDimensions: [number, number, number],
): [number, number, number] {
  const dims = preset.id === CUSTOM_OBSTRUCTION_PRESET_ID ? customDimensions : preset.dimensions;
  return [
    Math.max(0.05, dims[0]),
    Math.max(0.05, dims[1]),
    Math.max(0.05, dims[2]),
  ];
}
