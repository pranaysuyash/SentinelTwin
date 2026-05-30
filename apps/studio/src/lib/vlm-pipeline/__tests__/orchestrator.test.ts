import { describe, expect, test } from "bun:test";
import { runVlmPipeline } from "@/lib/vlm-pipeline/orchestrator";
import { StubTier1Provider } from "@/lib/vlm-pipeline/tier1-local-gate";
import { StubTier2Provider } from "@/lib/vlm-pipeline/tier2-cloud-pass";

const MINIMAL_PNG =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

describe("runVlmPipeline", () => {
  test("completes full pipeline with stub providers", async () => {
    const result = await runVlmPipeline(MINIMAL_PNG, "test.png");
    expect(result.passed).toBe(true);
    expect(result.semanticContext.tier1).toBeDefined();
    expect(result.semanticContext.gateDecision).toBeDefined();
    expect(result.semanticContext.tier2).toBeDefined();
    expect(result.semanticContext.postProcessing).toBeDefined();
    expect(result.semanticContext.pipelineMetadata.tier1CompletedAt).toBeDefined();
    expect(result.semanticContext.pipelineMetadata.tier2CompletedAt).toBeDefined();
    expect(result.semanticContext.pipelineMetadata.completedAt).toBeDefined();
  });

  test("fails gate when blurry image is detected", async () => {
    const blurryProvider = new StubTier1Provider();
    const originalAssess = blurryProvider.assessImageQuality.bind(blurryProvider);
    blurryProvider.assessImageQuality = async () => ({
      isBlurry: true,
      blurScore: 0.05,
      lowLight: false,
      overexposed: false,
      resolutionSufficient: true,
      qualityScore: 0.1,
    });

    const result = await runVlmPipeline(MINIMAL_PNG, "blurry.png", {
      tier1Provider: blurryProvider,
      tier2Provider: new StubTier2Provider(),
    });
    expect(result.passed).toBe(false);
    expect(result.error).toContain("Gate blocked");
    expect(result.semanticContext.gateDecision.action).toBe("reject_blurry");

    blurryProvider.assessImageQuality = originalAssess;
  });

  test("bypasses Tier 2 when disabled in config", async () => {
    const result = await runVlmPipeline(MINIMAL_PNG, "test.png", {
      config: { tier2Enabled: false },
    });
    expect(result.passed).toBe(true);
    expect(result.semanticContext.tier2).toBeUndefined();
  });

  test("populates pipeline metadata", async () => {
    const result = await runVlmPipeline(MINIMAL_PNG, "test.png");
    expect(result.semanticContext.pipelineMetadata.modelIds).toContain("stub-tier1");
    expect(result.semanticContext.pipelineMetadata.modelIds).toContain("gpt-4o");
    expect(result.semanticContext.sourceImageInfo.fileName).toBe("test.png");
  });

  test("forceTier2 bypasses gate even with bad quality", async () => {
    const result = await runVlmPipeline(MINIMAL_PNG, "test.png", {
      config: { forceTier2: true },
    });
    expect(result.passed).toBe(true);
    expect(result.semanticContext.tier2).toBeDefined();
  });
});
