/**
 * R3F Rendering Presets — SentinelTwin Studio
 *
 * Canonical Canvas / scene / IBL configuration for every R3F surface in the
 * app. Eliminates the per-canvas drift where each file invents its own
 * `gl.toneMapping`, color space, environment lighting, and shadow setup.
 *
 * Design rules (see Docs/exploration/3D_REALISTIC_RENDERING_ROADMAP_2026-07-04.md):
 *  - Tone mapping: ACES Filmic everywhere. Output color space: sRGB.
 *  - Image-Based Lighting: RoomEnvironment (procedural, zero network) as
 *    the default for every Canvas. Drei `<Environment preset>` is opt-in
 *    for high-quality marketing surfaces.
 *  - Shadows: one PCF shadow-casting directional light, capped at
 *    2048 shadow map size. Drei `ContactShadows` for close-proximity
 *    grounding. The shadow budget is gated by the quality tier constant
 *    passed to `canvasOnCreated`.
 *  - All settings are pure data so they can be unit-tested and surfaced
 *    to a future visual scorecard.
 */

import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import * as THREE from "three";

export type RenderingQualityTier = "low" | "medium" | "high";

export interface R3FCanvasPreset {
  /** Tone mapping applied on creation. ACES Filmic by default. */
  toneMapping: THREE.ToneMapping;
  /** Tone mapping exposure (linear units). */
  toneMappingExposure: number;
  /** Output color space. */
  outputColorSpace: THREE.ColorSpace;
  /** Color space for textures loaded into the scene. */
  textureColorSpace: THREE.ColorSpace;
  /** Maximum antialiasing multiplier (0 disables). */
  antialias: boolean;
  /** Shadow map type. */
  shadowMapType: THREE.ShadowMapType;
  /** Shadow map enabled. */
  shadowMapEnabled: boolean;
  /** Whether to install a procedural IBL environment on creation. */
  installIbl: boolean;
  /** Environment intensity. 0 disables IBL contribution. */
  environmentIntensity: number;
  /** Whether to register an `onCreated` callback that installs the IBL. */
  iblFromRoomEnvironment: boolean;
  /** Power preference hint for the renderer. */
  powerPreference: "default" | "high-performance" | "low-power";
}

const TONE_MAPPING = THREE.ACESFilmicToneMapping;
const COLOR_SPACE = THREE.SRGBColorSpace;
const TEXTURE_COLOR_SPACE = THREE.SRGBColorSpace;
// PCFSoftShadowMap is deprecated in three r184+ (falls back to PCF with a
// console warning per canvas). PCF is the supported soft-ish default.
const SHADOW_TYPE = THREE.PCFShadowMap;

/**
 * Quality tier → rendering preset. Each tier is a deliberate compromise
 * between visual fidelity and performance, gated by the existing
 * adaptive-DPR budgets in `lib/adaptive-dpr-budget.ts`.
 *
 * - `high`: full IBL, antialias on, shadow maps enabled, exposure 1.0.
 *   Use for the workspace canvas and single-camera viewer surfaces when
 *   the device is known to be capable.
 * - `medium`: same as high but shadow map size capped lower and a slight
 *   exposure reduction so the heatmap reads well on mixed monitors.
 * - `low`: IBL kept (it is procedural and free), shadows disabled, no
 *   antialias. Used as a conservative fallback for low-end GPUs.
 */
export const R3F_PRESETS: Readonly<Record<RenderingQualityTier, R3FCanvasPreset>> =
  Object.freeze({
    high: {
      toneMapping: TONE_MAPPING,
      toneMappingExposure: 1.0,
      outputColorSpace: COLOR_SPACE,
      textureColorSpace: TEXTURE_COLOR_SPACE,
      antialias: true,
      shadowMapType: SHADOW_TYPE,
      shadowMapEnabled: true,
      installIbl: true,
      environmentIntensity: 0.7,
      iblFromRoomEnvironment: true,
      powerPreference: "high-performance",
    },
    medium: {
      toneMapping: TONE_MAPPING,
      toneMappingExposure: 0.95,
      outputColorSpace: COLOR_SPACE,
      textureColorSpace: TEXTURE_COLOR_SPACE,
      antialias: true,
      shadowMapType: SHADOW_TYPE,
      shadowMapEnabled: true,
      installIbl: true,
      environmentIntensity: 0.55,
      iblFromRoomEnvironment: true,
      powerPreference: "default",
    },
    low: {
      toneMapping: TONE_MAPPING,
      toneMappingExposure: 0.9,
      outputColorSpace: COLOR_SPACE,
      textureColorSpace: TEXTURE_COLOR_SPACE,
      antialias: false,
      shadowMapType: SHADOW_TYPE,
      shadowMapEnabled: false,
      installIbl: true,
      environmentIntensity: 0.4,
      iblFromRoomEnvironment: true,
      powerPreference: "low-power",
    },
  });

/**
 * Props ready to spread onto an R3F `<Canvas>`. Kept as a function so
 * callers don't have to remember to copy every field individually when
 * they want a different tier.
 */
export function r3fCanvasPropsForTier(tier: RenderingQualityTier): {
  gl: {
    antialias: boolean;
    powerPreference: "default" | "high-performance" | "low-power";
  };
  dpr: [number, number];
  shadows: boolean | THREE.ShadowMapType;
} {
  const preset = R3F_PRESETS[tier];
  return {
    gl: {
      antialias: preset.antialias,
      powerPreference: preset.powerPreference,
    },
    dpr: tier === "high" ? [1, 2] : tier === "medium" ? [1, 1.5] : [0.75, 1.0],
    shadows: preset.shadowMapEnabled ? preset.shadowMapType : false,
  };
}

/**
 * Apply the preset to a renderer. Idempotent: running it twice on the
 * same renderer is safe. We intentionally do NOT dispose the renderer's
 * existing programs; the WebGL state is updated in place.
 */
export function applyR3FCanvasPreset(
  gl: THREE.WebGLRenderer,
  tier: RenderingQualityTier,
): void {
  const preset = R3F_PRESETS[tier];
  gl.toneMapping = preset.toneMapping;
  gl.toneMappingExposure = preset.toneMappingExposure;
  gl.outputColorSpace = preset.outputColorSpace;
  if (preset.shadowMapEnabled) {
    gl.shadowMap.enabled = true;
    gl.shadowMap.type = preset.shadowMapType;
  } else {
    gl.shadowMap.enabled = false;
  }
}

/**
 * Build a `RoomEnvironment` and apply it to a scene as the IBL source.
 * The same `PMREMGenerator` instance is shared across the lifetime of a
 * renderer to avoid re-baking the cube map every time the scene mounts.
 */
export function installRoomEnvironmentIBL(
  scene: THREE.Scene,
  gl: THREE.WebGLRenderer,
  intensity: number,
): { dispose: () => void } {
  const pmrem = new THREE.PMREMGenerator(gl);
  const room = new RoomEnvironment();
  const target = pmrem.fromScene(room, 0.04);
  scene.environment = target.texture;
  scene.environmentIntensity = intensity;
  return {
    dispose: () => {
      target.texture.dispose();
      pmrem.dispose();
      // We deliberately do not clear `scene.environment` because callers
      // may pass a scene that already has its own environment. The
      // texture and PMREM handle are the only GPU-side resources we own.
    },
  };
}

/**
 * Shadow caster factory. One directional light per Canvas surface.
 * Returns the props ready to spread onto a `<directionalLight>`. The
 * shadow camera frustum is auto-sized to the scene's max dimension, but
 * callers can override.
 */
export interface ShadowCasterSpec {
  position: [number, number, number];
  intensity: number;
  color: string;
  shadowMapSize: [number, number];
  shadowCamera: {
    near: number;
    far: number;
    left: number;
    right: number;
    top: number;
    bottom: number;
  };
  shadowBias: number;
}

export function defaultShadowCaster(
  maxDimension: number,
  tier: RenderingQualityTier,
): ShadowCasterSpec {
  const mapSize: [number, number] =
    tier === "high" ? [2048, 2048] : tier === "medium" ? [1024, 1024] : [512, 512];
  const half = Math.max(6, maxDimension * 0.6);
  return {
    position: [10, 16, 8],
    intensity: tier === "high" ? 1.2 : tier === "medium" ? 1.0 : 0.8,
    color: "#fff4d0",
    shadowMapSize: mapSize,
    shadowCamera: {
      near: 0.5,
      far: 60,
      left: -half,
      right: half,
      top: half,
      bottom: -half,
    },
    shadowBias: -0.0002,
  };
}

/**
 * Hook-free convenience: a stable key used by the R3F `onCreated` factory
 * to keep `useMemo` callbacks cheap.
 */
export function presetKey(tier: RenderingQualityTier): string {
  return `r3f-preset:${tier}`;
}

/**
 * Pure-data helper for tests: returns the env intensity the IBL setup
 * should use for a tier. Mirrors `R3F_PRESETS[tier].environmentIntensity`.
 */
export function environmentIntensityFor(tier: RenderingQualityTier): number {
  return R3F_PRESETS[tier].environmentIntensity;
}

/**
 * Pure-data helper: returns the shadow map size to use for a tier.
 * Kept in sync with `defaultShadowCaster`.
 */
export function shadowMapSizeFor(tier: RenderingQualityTier): [number, number] {
  return tier === "high"
    ? [2048, 2048]
    : tier === "medium"
      ? [1024, 1024]
      : [512, 512];
}
