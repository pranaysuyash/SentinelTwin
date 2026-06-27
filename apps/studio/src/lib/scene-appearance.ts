/**
 * Scene Appearance Resolution — SentinelTwin Studio
 *
 * Pure logic for the visual customization layer (`scene.sceneAppearance` and
 * per-node `appearance` overrides). Resolves the effective lighting theme,
 * material parameters, and procedural texture style for every surface by
 * merging, in order of increasing precedence:
 *
 *   built-in theme / PBR library  →  scene-level surface default  →  node override
 *
 * Pattern adopted from pascalorg/editor (MIT): preset id + explicit property
 * overrides resolved through a single merge function. See
 * Docs/decisions/DECISION_LOG_ADDENDUM.md for the adoption record.
 *
 * This module is pure data + functions (no React, no DOM, no three.js) so it
 * can be unit-tested directly and shared by every canvas surface. The
 * appearance layer is rendering-only: nothing here may feed the simulation
 * engine (D-003).
 */

import type {
  AppearancePresetId,
  EnvironmentLightingOverride,
  NodeAppearance,
  SceneAppearance,
} from "@sentineltwin/core";

import type { PbrMaterialSpec } from "@/lib/pbr-materials";

// ── Environment themes (canonical source; SharedScene re-exports) ──

export const ENVIRONMENT_THEMES = {
  day: {
    background: "#0d1420",   // slightly brighter dark blue (reference background)
    ambient: 2.2,            // bright enough to fully illuminate white walls
    hemisphere: 1.2,
    directional: 2.2,
    fill: 1.2,
  },
  dusk: {
    background: "#090b12",
    ambient: 0.7,
    hemisphere: 0.55,
    directional: 1.3,
    fill: 0.55,
  },
  night: {
    background: "#06080d",
    ambient: 0.4,
    hemisphere: 0.35,
    directional: 0.9,
    fill: 0.4,
  },
} as const;

export type EnvironmentTheme = (typeof ENVIRONMENT_THEMES)[keyof typeof ENVIRONMENT_THEMES];
export type EnvironmentModeKey = keyof typeof ENVIRONMENT_THEMES;

// ── Procedural texture styles ──

/** Styles the procedural texture factory can generate (see lib/procedural-textures.ts). */
export type ProceduralTextureStyle =
  | "tile"
  | "plaster"
  | "concrete"
  | "wood"
  | "carpet"
  | "marble"
  | "brick";

export interface AppearancePresetDefinition {
  readonly label: string;
  /** PBR parameter overlay applied over the surface's built-in spec. */
  readonly spec: Partial<PbrMaterialSpec>;
  /** Procedural texture style, or null to keep the surface's built-in texture. */
  readonly textureStyle: ProceduralTextureStyle | null;
}

/**
 * Cosmetic material presets. Roughness/metalness bands follow the existing
 * PBR library conventions (lib/pbr-materials.ts) and Pascal's material
 * library values (matte paint ~0.9, wood 0.45–0.85, stone/tile 0.35–0.5,
 * metal 0.26/0.82, glass handled by the simulation-semantic material field).
 */
export const APPEARANCE_PRESETS: Readonly<Record<AppearancePresetId, AppearancePresetDefinition>> =
  Object.freeze({
    default: { label: "Default", spec: {}, textureStyle: null },
    plaster: {
      label: "Plaster",
      spec: { color: "#eef0f4", roughness: 0.8, metalness: 0.0 },
      textureStyle: "plaster",
    },
    paint: {
      label: "Painted",
      spec: { color: "#e8eaef", roughness: 0.9, metalness: 0.0 },
      textureStyle: null,
    },
    brick: {
      label: "Brick",
      spec: { color: "#9c5a44", roughness: 0.88, metalness: 0.0 },
      textureStyle: "brick",
    },
    concrete: {
      label: "Concrete",
      spec: { color: "#9aa0a8", roughness: 0.72, metalness: 0.04 },
      textureStyle: "concrete",
    },
    wood: {
      label: "Wood",
      spec: { color: "#8a6a44", roughness: 0.68, metalness: 0.02 },
      textureStyle: "wood",
    },
    tile: {
      label: "Tile",
      spec: { color: "#e2dbd0", roughness: 0.45, metalness: 0.02 },
      textureStyle: "tile",
    },
    marble: {
      label: "Marble",
      spec: { color: "#e9e7e2", roughness: 0.22, metalness: 0.03 },
      textureStyle: "marble",
    },
    carpet: {
      label: "Carpet",
      spec: { color: "#5f6672", roughness: 0.95, metalness: 0.0 },
      textureStyle: "carpet",
    },
    metal: {
      label: "Metal",
      spec: { color: "#aeb4bc", roughness: 0.26, metalness: 0.82 },
      textureStyle: null,
    },
    fabric: {
      label: "Fabric",
      spec: { color: "#6b7280", roughness: 0.92, metalness: 0.0 },
      textureStyle: null,
    },
    custom: { label: "Custom", spec: {}, textureStyle: null },
  });

/** Surface-appropriate preset choices for the pickers. */
export const WALL_PRESET_CHOICES: readonly AppearancePresetId[] = [
  "default", "plaster", "paint", "brick", "concrete", "wood", "metal", "custom",
];
export const FLOOR_PRESET_CHOICES: readonly AppearancePresetId[] = [
  "default", "tile", "concrete", "wood", "carpet", "marble", "custom",
];
export const OBJECT_PRESET_CHOICES: readonly AppearancePresetId[] = [
  "default", "wood", "metal", "concrete", "fabric", "paint", "custom",
];

// ── Material resolution ──

/**
 * Merge one appearance layer over a PBR spec. Preset values apply first,
 * then explicit per-field overrides. An absent layer is a no-op.
 */
function applyOneAppearanceLayer(
  base: PbrMaterialSpec,
  layer: NodeAppearance | undefined,
): PbrMaterialSpec {
  if (!layer) return base;
  const preset = APPEARANCE_PRESETS[layer.preset ?? "default"] ?? APPEARANCE_PRESETS.default;
  const merged: PbrMaterialSpec = { ...base, ...preset.spec };
  return {
    ...merged,
    ...(layer.color !== undefined ? { color: layer.color } : {}),
    ...(layer.roughness !== undefined ? { roughness: layer.roughness } : {}),
    ...(layer.metalness !== undefined ? { metalness: layer.metalness } : {}),
    ...(layer.opacity !== undefined
      ? { opacity: layer.opacity, transparent: layer.opacity < 1 ? true : merged.transparent }
      : {}),
    ...(layer.emissiveColor !== undefined ? { emissive: layer.emissiveColor } : {}),
    ...(layer.emissiveIntensity !== undefined
      ? { emissiveIntensity: layer.emissiveIntensity }
      : {}),
  };
}

/**
 * Resolve the effective PBR spec for a surface: built-in spec, then the
 * scene-level surface default, then the node-level override. Later layers win.
 */
export function applyNodeAppearance(
  base: PbrMaterialSpec,
  ...layers: (NodeAppearance | undefined)[]
): PbrMaterialSpec {
  return layers.reduce<PbrMaterialSpec>(applyOneAppearanceLayer, base);
}

/** True when any layer changes the surface's built-in look. */
export function hasAppearanceOverride(
  ...layers: (NodeAppearance | undefined)[]
): boolean {
  return layers.some(
    (layer) =>
      layer !== undefined &&
      ((layer.preset ?? "default") !== "default" ||
        layer.color !== undefined ||
        layer.roughness !== undefined ||
        layer.metalness !== undefined ||
        layer.opacity !== undefined ||
        layer.emissiveColor !== undefined ||
        layer.emissiveIntensity !== undefined ||
        layer.textureScale !== undefined),
  );
}

/**
 * Resolve the procedural texture style for a surface. The highest-precedence
 * layer with a non-default preset decides; `null` keeps the built-in texture.
 */
export function resolveAppearanceTextureStyle(
  ...layers: (NodeAppearance | undefined)[]
): ProceduralTextureStyle | null {
  for (let i = layers.length - 1; i >= 0; i--) {
    const layer = layers[i];
    if (!layer) continue;
    const presetId = layer.preset ?? "default";
    if (presetId === "default") continue;
    return APPEARANCE_PRESETS[presetId]?.textureStyle ?? null;
  }
  return null;
}

/** Resolve the texture repeat multiplier (last defined wins, default 1). */
export function resolveAppearanceTextureScale(
  ...layers: (NodeAppearance | undefined)[]
): number {
  for (let i = layers.length - 1; i >= 0; i--) {
    const scale = layers[i]?.textureScale;
    if (scale !== undefined && Number.isFinite(scale) && scale > 0) return scale;
  }
  return 1;
}

// ── Lighting resolution ──

export interface ResolvedSceneLighting {
  background: string;
  ambient: number;
  hemisphere: number;
  directional: number;
  fill: number;
  keyLightColor: string;
  fillLightColor: string;
  practicalLights: boolean;
  practicalIntensity: number;
  fogEnabled: boolean;
  fogColor: string;
  /** Undefined = caller keeps its surface-specific default distances. */
  fogNear?: number;
  fogFar?: number;
  /** IBL intensity multiplier over the quality-tier preset. */
  iblIntensityScale: number;
  toneMappingExposure?: number;
  shadows: boolean;
}

const DEFAULT_KEY_LIGHT_COLOR = "#f5f8ff";
const DEFAULT_FILL_LIGHT_COLOR = "#c8d8ff";

function clampNonNegative(value: number | undefined, fallback: number): number {
  return value !== undefined && Number.isFinite(value) && value >= 0 ? value : fallback;
}

/**
 * Resolve the effective lighting for an environment mode by merging the
 * scene's appearance overrides over the built-in theme. Every canvas surface
 * (workspace, camera view, replay, compare) should light itself from this.
 */
export function resolveSceneLighting(
  mode: EnvironmentModeKey,
  appearance?: SceneAppearance | null,
): ResolvedSceneLighting {
  const theme = ENVIRONMENT_THEMES[mode] ?? ENVIRONMENT_THEMES.day;
  const override: EnvironmentLightingOverride | undefined = appearance?.lighting?.[mode];
  const fog = appearance?.fog;
  const environment = appearance?.environment;
  const background =
    typeof override?.background === "string" && override.background
      ? override.background
      : theme.background;
  return {
    background,
    ambient: clampNonNegative(override?.ambient, theme.ambient),
    hemisphere: clampNonNegative(override?.hemisphere, theme.hemisphere),
    directional: clampNonNegative(override?.directional, theme.directional),
    fill: clampNonNegative(override?.fill, theme.fill),
    keyLightColor: override?.keyLightColor ?? DEFAULT_KEY_LIGHT_COLOR,
    fillLightColor: override?.fillLightColor ?? DEFAULT_FILL_LIGHT_COLOR,
    practicalLights: override?.practicalLights ?? true,
    practicalIntensity: clampNonNegative(override?.practicalIntensity, 1),
    fogEnabled: fog?.enabled ?? true,
    fogColor: fog?.color ?? background,
    fogNear: fog?.near,
    fogFar: fog?.far,
    iblIntensityScale: clampNonNegative(environment?.iblIntensityScale, 1),
    toneMappingExposure: environment?.toneMappingExposure,
    shadows: environment?.shadows ?? true,
  };
}
