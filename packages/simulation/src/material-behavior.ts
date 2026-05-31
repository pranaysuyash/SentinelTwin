/**
 * Material Behavior Registry — formalizes material property lookup.
 *
 * Previously, material behavior was scattered across the codebase:
 * - coverage.ts had hardcoded occlusion logic
 * - vision-collider-mesh.ts had ad-hoc transmission overrides for window states
 * - ObstructionNode.material had 7 values but only visionTransmission was used
 *
 * This module centralizes all material behavior into one source of truth.
 * Every material type has explicit:
 * - default vision transmission (when node doesn't specify)
 * - whether it blocks movement
 * - glare risk
 * - night IR reflectivity
 * - partial occlusion classification
 */

import type { ObstructionNode, WallNode, WindowNode } from "@sentineltwin/core";

/**
 * Canonical material property record.
 */
export type MaterialProperties = {
  /** Default vision transmission when not explicitly set */
  defaultVisionTransmission: number;
  /** Whether this material blocks actor movement entirely */
  blocksMovement: boolean;
  /** Whether this material creates glare risk for cameras */
  glareRisk: boolean;
  /** Whether this material reflects IR (affects night vision) */
  irReflective: boolean;
  /** CSS-class-like label for UI styling */
  behaviorClass: "solid" | "transparent" | "partial" | "reflective" | "mesh" | "curtain";
};

const MATERIAL_BEHAVIOR: Record<string, MaterialProperties> = {
  solid: {
    defaultVisionTransmission: 0,
    blocksMovement: true,
    glareRisk: false,
    irReflective: false,
    behaviorClass: "solid",
  },
  glass: {
    defaultVisionTransmission: 0.85,
    blocksMovement: false,
    glareRisk: true,
    irReflective: false,
    behaviorClass: "transparent",
  },
  grill: {
    defaultVisionTransmission: 0.50,
    blocksMovement: true,
    glareRisk: false,
    irReflective: false,
    behaviorClass: "mesh",
  },
  mesh: {
    defaultVisionTransmission: 0.60,
    blocksMovement: false,
    glareRisk: false,
    irReflective: false,
    behaviorClass: "mesh",
  },
  curtain: {
    defaultVisionTransmission: 0.15,
    blocksMovement: false,
    glareRisk: false,
    irReflective: false,
    behaviorClass: "curtain",
  },
  reflective: {
    defaultVisionTransmission: 0.25,
    blocksMovement: false,
    glareRisk: true,
    irReflective: true,
    behaviorClass: "reflective",
  },
  partial: {
    defaultVisionTransmission: 0.40,
    blocksMovement: true,
    glareRisk: false,
    irReflective: false,
    behaviorClass: "partial",
  },
};

/** Obstruction and wall material values */
export type SolidMaterial = "solid";
export type GlassMaterial = "glass";
export type GrillMaterial = "grill";
export type MeshMaterial = "mesh";
export type CurtainMaterial = "curtain";
export type ReflectiveMaterial = "reflective";
export type PartialMaterial = "partial";

/** All obstruction materials (7 values) */
export type ObstructionMaterial = ObstructionNode["material"];

/** All wall materials (4 values) */
export type WallMaterial = WallNode["material"];

/**
 * Get the canonical behavior for an obstruction material.
 * Falls back to "solid" for unknown materials.
 */
export function getObstructionMaterialBehavior(material: ObstructionMaterial): MaterialProperties {
  return MATERIAL_BEHAVIOR[material] ?? MATERIAL_BEHAVIOR.solid;
}

/**
 * Get the canonical behavior for a wall material.
 * Falls back to "solid" for unknown materials.
 */
export function getWallMaterialBehavior(material: WallMaterial): MaterialProperties {
  return MATERIAL_BEHAVIOR[material] ?? MATERIAL_BEHAVIOR.solid;
}

/**
 * Get effective vision transmission for an obstruction.
 *
 * If the node has an explicit visionTransmission > 0, that value is used.
 * Otherwise, the material's default vision transmission is used.
 */
export function getObstructionEffectiveTransmission(obstruction: {
  material: ObstructionMaterial;
  visionTransmission: number;
}): number {
  if (obstruction.visionTransmission > 0) return obstruction.visionTransmission;
  return getObstructionMaterialBehavior(obstruction.material).defaultVisionTransmission;
}

/**
 * Get effective vision transmission for a wall.
 */
export function getWallEffectiveTransmission(wall: {
  material: WallMaterial;
  visionTransmission: number;
}): number {
  if (wall.visionTransmission > 0) return wall.visionTransmission;
  return getWallMaterialBehavior(wall.material).defaultVisionTransmission;
}

/**
 * Get effective vision transmission for a window based on its state.
 *
 * Mirrors the logic in vision-collider-mesh.ts but uses the registry
 * for material defaults instead of hardcoded values.
 */
export function getWindowEffectiveTransmission(window: {
  state: WindowNode["state"];
  visionTransmission: number;
}): number {
  switch (window.state) {
    case "closed_glass":
      return window.visionTransmission > 0
        ? window.visionTransmission
        : MATERIAL_BEHAVIOR.glass.defaultVisionTransmission;
    case "grill":
      return MATERIAL_BEHAVIOR.grill.defaultVisionTransmission;
    case "curtain":
      return MATERIAL_BEHAVIOR.curtain.defaultVisionTransmission;
    case "reflective":
      return Math.min(0.4, Math.max(0.12, window.visionTransmission > 0
        ? window.visionTransmission
        : MATERIAL_BEHAVIOR.reflective.defaultVisionTransmission));
    case "open":
      return 0;
    default:
      return 0;
  }
}

/**
 * Get effective glare penalty for a scene element based on its material or state.
 */
export function getElementGlareRisk(element: {
  material?: ObstructionMaterial;
  state?: WindowNode["state"];
}): boolean {
  if (element.state === "reflective") return true;
  if (element.material) {
    return getObstructionMaterialBehavior(element.material).glareRisk;
  }
  return false;
}

/**
 * Check whether a material blocks movement (for physics/pathfinding).
 */
export function materialBlocksMovement(material: string): boolean {
  return MATERIAL_BEHAVIOR[material]?.blocksMovement ?? true;
}
