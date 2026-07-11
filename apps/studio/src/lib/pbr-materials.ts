/**
 * PBR Material Library — SentinelTwin Studio
 *
 * Canonical physically-based material parameters for every scene primitive
 * (walls, floors, doors, windows, obstructions, camera housings, hardware
 * fixtures). Agents must consume these helpers rather than inventing
 * inline roughness / metalness / opacity / clearcoat values, so the app
 * reads as a single coherent product instead of piecemeal.
 *
 * Design rules (see Docs/exploration/3D_REALISTIC_RENDERING_ROADMAP_2026-07-04.md):
 *  - Materials are PBR (`MeshStandardMaterial` / `MeshPhysicalMaterial`).
 *  - Roughness bands: 0.04–0.12 polished, 0.3–0.55 metals / glass, 0.6–0.8
 *    painted drywall, 0.85+ wood / fabric.
 *  - Glass is `MeshPhysicalMaterial` with `transmission` to look like glass
 *    under IBL. A non-IBL fallback uses opacity + low metalness.
 *  - Selected nodes always switch to a single canonical selection color
 *    (`SELECTED_COLOR`) and add a small emissive bump.
 *  - Values are pure data so they can be unit-tested without Three.js
 *    (`@sentineltwin/simulation` is zero-React; this file is too, although
 *    the helpers are only useful inside R3F).
 */

import type { ColorRepresentation } from "three";
import { UI_SURFACES_RAW } from "@/lib/studio-surface-tokens";

export type SurfaceKind =
  | "floor"
  | "wall"
  | "wall_glass"
  | "door_panel"
  | "door_frame"
  | "door_handle"
  | "window_frame"
  | "window_glass"
  | "window_sill"
  | "ceiling"
  | "ceiling_fixture"
  | "countertop"
  | "cabinet_body"
  | "cabinet_handle"
  | "shelf_panel"
  | "shelf_board"
  | "pillar_concrete"
  | "display_glass"
  | "partition_panel"
  | "vehicle_body"
  | "vehicle_cabin"
  | "vehicle_windshield"
  | "vehicle_tire"
  | "tree_trunk"
  | "tree_canopy"
  | "actor_body"
  | "actor_head"
  | "actor_limb"
  | "actor_limb_dark"
  | "camera_housing"
  | "camera_lens"
  | "camera_mount"
  | "spotlight_housing"
  | "selected";

export interface PbrMaterialSpec {
  readonly color: string;
  readonly roughness: number;
  readonly metalness: number;
  readonly opacity?: number;
  readonly transparent?: boolean;
  readonly emissive?: string;
  readonly emissiveIntensity?: number;
  /** Optional physical-material features. */
  readonly transmission?: number;
  readonly ior?: number;
  readonly clearcoat?: number;
  readonly clearcoatRoughness?: number;
  readonly reflectivity?: number;
  /** Disable PBR shadows on tiny or pure-overlay surfaces. */
  readonly castShadow?: boolean;
  readonly receiveShadow?: boolean;
}

/**
 * Canonical selection color. Single source of truth so every selection
 * ring / edge highlight reads consistently across all surfaces.
 */
export const SELECTED_COLOR = "#60a5fa";
export const SELECTED_EMISSIVE = "#1e3a5f";
export const SELECTED_EMISSIVE_INTENSITY = 0.45;
export const SELECTED_OPACITY_BOOST = 0.12;

/**
 * Single source of truth for surface material parameters. Anything in
 * `SharedScene.tsx`, the camera housings, and the actor should resolve
 * its parameters through `surfaceMaterial()`.
 */
export const PBR_MATERIALS: Readonly<Record<SurfaceKind, PbrMaterialSpec>> = Object.freeze(
  {
    floor: {
      color: "#e2dbd0",
      roughness: 0.82,
      metalness: 0.02,
      receiveShadow: true,
    },
    wall: {
      color: UI_SURFACES_RAW.textBright,
      roughness: 0.78,
      metalness: 0.0,
      receiveShadow: true,
    },
    wall_glass: {
      color: UI_SURFACES_RAW.textBody4,
      roughness: 0.05,
      metalness: 0.12,
      opacity: 0.22,
      transparent: true,
      transmission: 0.0, // fallback path; with IBL this jumps to 0.7
      ior: 1.45,
      receiveShadow: true,
    },
    door_panel: {
      color: "#8b5e34",
      roughness: 0.65,
      metalness: 0.06,
      castShadow: true,
      receiveShadow: true,
    },
    door_frame: {
      color: "#5c4a3a",
      roughness: 0.62,
      metalness: 0.05,
      castShadow: true,
      receiveShadow: true,
    },
    door_handle: {
      color: UI_SURFACES_RAW.textSoftBright,
      roughness: 0.28,
      metalness: 0.78,
      castShadow: true,
    },
    window_frame: {
      color: UI_SURFACES_RAW.textSoftBright,
      roughness: 0.4,
      metalness: 0.4,
      castShadow: true,
      receiveShadow: true,
    },
    window_glass: {
      color: "#cfe5ff",
      roughness: 0.08,
      metalness: 0.18,
      opacity: 0.24,
      transparent: true,
      ior: 1.5,
      receiveShadow: true,
    },
    window_sill: {
      color: UI_SURFACES_RAW.textNearAlt,
      roughness: 0.5,
      metalness: 0.15,
      castShadow: true,
      receiveShadow: true,
    },
    ceiling: {
      color: UI_SURFACES_RAW.textBright,
      roughness: 0.85,
      metalness: 0.0,
      receiveShadow: true,
    },
    ceiling_fixture: {
      color: "#fff4d0",
      roughness: 0.3,
      metalness: 0.1,
      emissive: "#fff4d0",
      emissiveIntensity: 0.15,
    },
    countertop: {
      color: "#a09080",
      roughness: 0.42,
      metalness: 0.1,
      castShadow: true,
      receiveShadow: true,
    },
    cabinet_body: {
      color: "#624633",
      roughness: 0.78,
      metalness: 0.05,
      castShadow: true,
      receiveShadow: true,
    },
    cabinet_handle: {
      color: UI_SURFACES_RAW.textSoftBright,
      roughness: 0.3,
      metalness: 0.7,
      castShadow: true,
    },
    shelf_panel: {
      color: "#5c4324",
      roughness: 0.82,
      metalness: 0.05,
      castShadow: true,
      receiveShadow: true,
    },
    shelf_board: {
      color: "#6d522f",
      roughness: 0.82,
      metalness: 0.05,
      castShadow: true,
    },
    pillar_concrete: {
      color: UI_SURFACES_RAW.textSoftMuted,
      roughness: 0.6,
      metalness: 0.1,
      castShadow: true,
      receiveShadow: true,
    },
    display_glass: {
      color: UI_SURFACES_RAW.textBody4,
      roughness: 0.04,
      metalness: 0.32,
      opacity: 0.2,
      transparent: true,
      ior: 1.5,
      receiveShadow: true,
    },
    partition_panel: {
      color: "#6b7280",
      roughness: 0.7,
      metalness: 0.05,
      castShadow: true,
      receiveShadow: true,
    },
    vehicle_body: {
      color: UI_SURFACES_RAW.textDim,
      roughness: 0.5,
      metalness: 0.4,
      castShadow: true,
      receiveShadow: true,
    },
    vehicle_cabin: {
      color: UI_SURFACES_RAW.textMuted,
      roughness: 0.4,
      metalness: 0.3,
      castShadow: true,
      receiveShadow: true,
    },
    vehicle_windshield: {
      color: UI_SURFACES_RAW.textBody,
      roughness: 0.04,
      metalness: 0.2,
      opacity: 0.4,
      transparent: true,
      ior: 1.5,
    },
    vehicle_tire: {
      color: UI_SURFACES_RAW.card,
      roughness: 0.9,
      metalness: 0.0,
    },
    tree_trunk: {
      color: "#5a3a1a",
      roughness: 0.9,
      metalness: 0.0,
      castShadow: true,
    },
    tree_canopy: {
      color: "#2d6b2d",
      roughness: 0.85,
      metalness: 0.0,
      castShadow: true,
    },
    actor_body: {
      color: UI_SURFACES_RAW.bgPanel,
      roughness: 0.6,
      metalness: 0.1,
      castShadow: true,
    },
    actor_head: {
      color: UI_SURFACES_RAW.textMuted,
      roughness: 0.5,
      metalness: 0.0,
      castShadow: true,
    },
    actor_limb: {
      color: UI_SURFACES_RAW.textDim,
      roughness: 0.6,
      metalness: 0.0,
      castShadow: true,
    },
    actor_limb_dark: {
      color: UI_SURFACES_RAW.card,
      roughness: 0.6,
      metalness: 0.0,
      castShadow: true,
    },
    camera_housing: {
      color: UI_SURFACES_RAW.textBody2,
      roughness: 0.32,
      metalness: 0.55,
      clearcoat: 0.35,
      clearcoatRoughness: 0.25,
      castShadow: true,
      receiveShadow: true,
    },
    camera_lens: {
      color: UI_SURFACES_RAW.page,
      roughness: 0.05,
      metalness: 0.9,
      reflectivity: 0.7,
      castShadow: true,
    },
    camera_mount: {
      color: UI_SURFACES_RAW.textDimMid,
      roughness: 0.55,
      metalness: 0.55,
      castShadow: true,
      receiveShadow: true,
    },
    spotlight_housing: {
      color: UI_SURFACES_RAW.textDim,
      roughness: 0.5,
      metalness: 0.45,
      castShadow: true,
      receiveShadow: true,
    },
    selected: {
      color: SELECTED_COLOR,
      roughness: 0.5,
      metalness: 0.1,
      emissive: SELECTED_EMISSIVE,
      emissiveIntensity: SELECTED_EMISSIVE_INTENSITY,
    },
  },
);

/**
 * Resolve a surface's PBR parameters, optionally overlaid with the
 * canonical selection treatment. Returned shape is a fresh shallow copy
 * so callers can mutate without polluting the library.
 */
export function surfaceMaterial(
  kind: SurfaceKind,
  overrides?: Partial<PbrMaterialSpec>,
): PbrMaterialSpec {
  const base = PBR_MATERIALS[kind];
  return { ...base, ...(overrides ?? {}) };
}

/**
 * Selection overlay. When `selected` is true, replaces the base color
 * with the selection color and applies a small emissive bump so the
 * operator can pick out the object under any lighting condition.
 */
export function surfaceMaterialWithSelection(
  kind: SurfaceKind,
  selected: boolean,
  overrides?: Partial<PbrMaterialSpec>,
): PbrMaterialSpec {
  const base = surfaceMaterial(kind, overrides);
  if (!selected) return base;
  const overlay: PbrMaterialSpec = {
    color: SELECTED_COLOR,
    roughness: 0.5,
    metalness: 0.1,
    emissive: SELECTED_EMISSIVE,
    emissiveIntensity: SELECTED_EMISSIVE_INTENSITY,
  };
  // Preserve the base opacity / transmission so glass still reads as glass.
  return {
    ...overlay,
    ...base,
    color: SELECTED_COLOR,
    emissive: overlay.emissive,
    emissiveIntensity: overlay.emissiveIntensity,
    opacity:
      typeof base.opacity === "number"
        ? Math.min(1, base.opacity + SELECTED_OPACITY_BOOST)
        : base.opacity,
  };
}

/**
 * Convenience: convert a `PbrMaterialSpec` into props suitable for
 * spreading onto a `<meshStandardMaterial>` JSX element. Avoids forcing
 * callers to memorize the property mapping.
 */
export function pbrToStandardMaterialProps(spec: PbrMaterialSpec): {
  color: ColorRepresentation;
  roughness: number;
  metalness: number;
  opacity: number | undefined;
  transparent: boolean | undefined;
  emissive: ColorRepresentation;
  emissiveIntensity: number;
} {
  return {
    color: spec.color,
    roughness: spec.roughness,
    metalness: spec.metalness,
    opacity: spec.opacity,
    transparent: spec.transparent,
    emissive: spec.emissive ?? "#000000",
    emissiveIntensity: spec.emissiveIntensity ?? 0,
  };
}

/**
 * Convenience: convert a `PbrMaterialSpec` into props for a
 * `<meshPhysicalMaterial>` element. Falls back to standard material
 * props when the spec has no physical features. Used for glass and
 * camera housings where `transmission` and `clearcoat` matter.
 */
export function pbrToPhysicalMaterialProps(spec: PbrMaterialSpec): {
  color: ColorRepresentation;
  roughness: number;
  metalness: number;
  opacity: number | undefined;
  transparent: boolean | undefined;
  emissive: ColorRepresentation;
  emissiveIntensity: number;
  transmission: number | undefined;
  ior: number | undefined;
  clearcoat: number | undefined;
  clearcoatRoughness: number | undefined;
  reflectivity: number | undefined;
} {
  return {
    color: spec.color,
    roughness: spec.roughness,
    metalness: spec.metalness,
    opacity: spec.opacity,
    transparent: spec.transparent,
    emissive: spec.emissive ?? "#000000",
    emissiveIntensity: spec.emissiveIntensity ?? 0,
    transmission: spec.transmission,
    ior: spec.ior,
    clearcoat: spec.clearcoat,
    clearcoatRoughness: spec.clearcoatRoughness,
    reflectivity: spec.reflectivity,
  };
}

/**
 * True when the spec should use `MeshPhysicalMaterial` rather than
 * `MeshStandardMaterial`. Single boolean keeps the call sites readable.
 */
export function needsPhysicalMaterial(spec: PbrMaterialSpec): boolean {
  return (
    typeof spec.transmission === "number" ||
    typeof spec.clearcoat === "number" ||
    typeof spec.reflectivity === "number"
  );
}

/**
 * Map an obstruction type (the discriminator string used in the scene
 * schema) to the closest PBR surface kind. Returns `null` when no good
 * mapping exists. Centralized here so future obstruction material work
 * has a single source of truth and the obstruction preset library and
 * the rendering layer stay aligned.
 */
export function obstructionSurfaceKind(
  obstructionType: string,
): SurfaceKind | null {
  switch (obstructionType) {
    case "shelf":
      return "shelf_panel";
    case "cupboard":
      return "cabinet_body";
    case "counter":
      return "countertop";
    case "storage_boxes":
      return "shelf_panel";
    case "pillar":
      return "pillar_concrete";
    case "glass_display":
      return "display_glass";
    case "partition":
      return "partition_panel";
    case "vehicle":
      return "vehicle_body";
    case "tree":
      return "tree_canopy";
    default:
      return null;
  }
}
