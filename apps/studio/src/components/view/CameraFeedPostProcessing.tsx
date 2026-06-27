"use client";

import { EffectComposer, Noise, Vignette } from "@react-three/postprocessing";
import { BlendFunction } from "postprocessing";

export type CameraFeedMode = "normal" | "ir_bw" | "low_light" | "thermal";

export interface CameraFeedPostProcessingProps {
  mode: CameraFeedMode;
  /** 0-1, how much to scale the effect intensity. Default 1. */
  intensityScale?: number;
}

const MODE_EFFECTS: Record<
  CameraFeedMode,
  { noiseOpacity: number; vignetteOffset: number; vignetteDarkness: number }
> = {
  normal: { noiseOpacity: 0.015, vignetteOffset: 0.15, vignetteDarkness: 0.6 },
  ir_bw: { noiseOpacity: 0.06, vignetteOffset: 0.2, vignetteDarkness: 0.8 },
  low_light: { noiseOpacity: 0.04, vignetteOffset: 0.18, vignetteDarkness: 0.7 },
  thermal: { noiseOpacity: 0.02, vignetteOffset: 0.12, vignetteDarkness: 0.5 },
};

export function CameraFeedPostProcessing({
  mode,
  intensityScale = 1,
}: CameraFeedPostProcessingProps) {
  const effects = MODE_EFFECTS[mode];
  const noiseOpacity = effects.noiseOpacity * intensityScale;
  const vignetteOffset = effects.vignetteOffset * intensityScale;
  const vignetteDarkness = effects.vignetteDarkness * intensityScale;

  return (
    <EffectComposer>
      <Noise
        opacity={noiseOpacity}
        blendFunction={BlendFunction.ADD}
        premultiply
      />
      <Vignette
        offset={vignetteOffset}
        darkness={vignetteDarkness}
        eskil={false}
        blendFunction={BlendFunction.NORMAL}
      />
    </EffectComposer>
  );
}
