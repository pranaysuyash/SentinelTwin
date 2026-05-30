import type {
  SemanticContext,
  VlmPipelineConfig,
  VlmPipelineResult,
} from "./types";
import { DEFAULT_VLM_PIPELINE_CONFIG } from "./types";
import type { Tier1Provider } from "./tier1-local-gate";
import { runTier1Heuristic, StubTier1Provider } from "./tier1-local-gate";
import { evaluateGateDecision } from "./gate-decision";
import type { Tier2Provider } from "./tier2-cloud-pass";
import { StubTier2Provider } from "./tier2-cloud-pass";
import type { PostProcessor } from "./post-processing";
import { DefaultPostProcessor } from "./post-processing";

export type VlmPipelineOptions = {
  config?: Partial<VlmPipelineConfig>;
  tier1Provider?: Tier1Provider;
  tier2Provider?: Tier2Provider;
  postProcessor?: PostProcessor;
};

export async function runVlmPipeline(
  dataUrl: string,
  fileName: string,
  options: VlmPipelineOptions = {},
): Promise<VlmPipelineResult> {
  const cfg: VlmPipelineConfig = {
    ...DEFAULT_VLM_PIPELINE_CONFIG,
    ...options.config,
  };

  const tier1Provider = options.tier1Provider ?? new StubTier1Provider();
  const tier2Provider = options.tier2Provider ?? new StubTier2Provider();
  const postProcessor = options.postProcessor ?? new DefaultPostProcessor();

  const pipelineMetadata = {
    startedAt: Date.now(),
    modelIds: [cfg.tier1ModelId],
    totalCost: 0,
  };

  const ctx: SemanticContext = {
    sourceImageInfo: {
      widthPx: 0,
      heightPx: 0,
      fileName,
    },
    tier1: null as unknown as SemanticContext["tier1"],
    gateDecision: null as unknown as SemanticContext["gateDecision"],
    pipelineMetadata,
  };

  // ── Phase 1: Tier 1 (Local Gating) ──

  try {
    let tier1Output;
    if (cfg.tier1Enabled) {
      tier1Output = await tier1Provider.assessImageQuality(dataUrl).then(async (quality) => {
        const scene = await tier1Provider.classifyScene(dataUrl);
        const ocr = await tier1Provider.extractOcr(dataUrl);
        const rooms = await tier1Provider.detectRooms(dataUrl);
        const ambiguityFlags: string[] = [];
        if (quality.isBlurry) ambiguityFlags.push("blurry");
        if (quality.lowLight) ambiguityFlags.push("low_light");
        if (quality.overexposed) ambiguityFlags.push("overexposed");
        if (!quality.resolutionSufficient) ambiguityFlags.push("low_resolution");
        if (scene.sceneType === "unknown") ambiguityFlags.push("unknown_scene_type");

        const overallConfidence =
          quality.qualityScore * 0.35 +
          scene.confidence * 0.3 +
          Math.min(1, rooms.roomCount / 5) * 0.2 +
          (ocr.length > 0 ? 0.15 : 0);

        return {
          imageQuality: quality,
          sceneType: scene.sceneType,
          sceneTypeConfidence: scene.confidence,
          roomCount: rooms.roomCount,
          rooms: rooms.rooms,
          ocrTexts: ocr,
          overallConfidence: Math.round(overallConfidence * 100) / 100,
          ambiguityFlags,
        };
      });
    } else {
      tier1Output = await runTier1Heuristic(dataUrl, fileName);
    }
    ctx.tier1 = tier1Output;
    ctx.pipelineMetadata.tier1CompletedAt = Date.now();
  } catch (err) {
    return {
      semanticContext: {
        ...ctx,
        tier1: null as unknown as SemanticContext["tier1"],
        gateDecision: {
          action: "human_review",
          reason: `Tier 1 processing failed: ${err}`,
          qualityThreshold: cfg.qualityThreshold,
        },
      },
      passed: false,
      error: `Tier 1 failed: ${err}`,
    };
  }

  // ── Phase 2: Gate Decision ──

  const gateDecision = evaluateGateDecision(ctx.tier1, {
    qualityThreshold: cfg.qualityThreshold,
    forceTier2: cfg.forceTier2,
  });
  ctx.gateDecision = gateDecision;

  if (gateDecision.action !== "proceed_to_tier2") {
    return {
      semanticContext: ctx,
      passed: false,
      error: `Gate blocked: ${gateDecision.reason}`,
    };
  }

  // ── Phase 3: Tier 2 (Cloud Pass) ──

  if (!cfg.tier2Enabled) {
    ctx.pipelineMetadata.completedAt = Date.now();
    return {
      semanticContext: ctx,
      passed: true,
    };
  }

  try {
    ctx.pipelineMetadata.modelIds.push(cfg.tier2ModelId);
    const tier2Output = await tier2Provider.extractScene(ctx.tier1, dataUrl);
    ctx.tier2 = tier2Output;
    ctx.pipelineMetadata.tier2CompletedAt = Date.now();
  } catch (err) {
    return {
      semanticContext: ctx,
      passed: false,
      error: `Tier 2 failed: ${err}`,
    };
  }

  // ── Phase 4: Post-Processing ──

  try {
    const postProc = await postProcessor.validate(ctx.tier1, ctx.tier2);
    ctx.postProcessing = postProc;
    ctx.pipelineMetadata.completedAt = Date.now();

    return {
      semanticContext: ctx,
      passed: postProc.overallPass,
      error: postProc.overallPass
        ? undefined
        : `Post-processing validation failed: ${postProc.validationIssues.filter((i) => i.severity === "blocking").map((i) => i.message).join("; ")}`,
    };
  } catch (err) {
    return {
      semanticContext: ctx,
      passed: false,
      error: `Post-processing failed: ${err}`,
    };
  }
}
