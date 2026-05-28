import { describe, expect, test } from "bun:test";

import { draftSceneFromPrompt, draftSceneFromPromptWithModel } from "@/lib/ai-layout-draft";
import type { ModelProvider, ModelPrompt, ModelResponse } from "@/agents/providers/ModelProvider";

describe("draftSceneFromPrompt", () => {
  test("parses dimensions and returns an AI scene", () => {
    const prompt = "Create a 10m x 7m electronics shop with entry and two cameras";
    const { scene, warnings, provenance } = draftSceneFromPrompt(prompt);

    expect(scene.source).toBe("ai");
    expect(scene.dimensions.width).toBe(10);
    expect(scene.dimensions.depth).toBe(7);
    expect(scene.name).toContain("AI Draft");
    expect(scene.cameras.length).toBe(2);
    expect(warnings.length).toBe(0);
    expect(provenance.mode).toBe("heuristic");
    expect(scene.changeLog.some((entry) => entry.startsWith("Provenance:"))).toBe(true);
  });

  test("falls back to template defaults when dimensions missing", () => {
    const { scene, warnings } = draftSceneFromPrompt("Draft a warehouse layout with loading area");
    expect(scene.source).toBe("ai");
    expect(scene.cameras.length).toBeGreaterThan(0);
    expect(warnings.length).toBeGreaterThan(0);
    expect(scene.changeLog.some((entry) => entry.includes("Provenance confidence"))).toBe(true);
  });

  test("applies semantic prompt hints for shelves, counter, and back storage", () => {
    const prompt =
      "Create a 10m x 7m electronics shop with front entry, two shelves, right-side cash counter, back storage, and two cameras.";
    const { scene } = draftSceneFromPrompt(prompt);

    const shelves = scene.obstructions.filter((obs) => obs.obstructionType === "shelf");
    const counters = scene.obstructions.filter((obs) => obs.obstructionType === "counter");
    const storageZone = scene.criticalZones.find((zone) => zone.label === "Back Storage");

    expect(scene.cameras.length).toBe(2);
    expect(shelves.length).toBeGreaterThanOrEqual(2);
    expect(counters.length).toBeGreaterThanOrEqual(1);
    expect(storageZone).toBeDefined();
  });
});

describe("draftSceneFromPromptWithModel", () => {
  test("builds scene from structured model output", async () => {
    const provider: ModelProvider = {
      name: "mock",
      async complete(_prompt: ModelPrompt): Promise<ModelResponse> {
        return { content: "", finishReason: "stop" };
      },
      async *completeStreaming(_prompt: ModelPrompt): AsyncIterable<string> {
        yield "";
      },
      async completeStructured<T>(): Promise<T> {
        return {
          templateId: "open-office",
          widthM: 18,
          depthM: 12,
          heightM: 3.2,
          sceneName: "AI Draft Office",
          assumptions: ["Generated from prompt"],
        } as T;
      },
    };

    const result = await draftSceneFromPromptWithModel("office with reception and exits", provider);
    expect(result.scene.name).toBe("AI Draft Office");
    expect(result.scene.source).toBe("ai");
    expect(result.scene.dimensions.width).toBe(18);
    expect(result.scene.dimensions.depth).toBe(12);
    expect(result.warnings[0]).toBe("Generated from prompt");
    expect(result.provenance.mode).toBe("model");
    expect(result.provenance.summary).toContain("Model-backed");
  });
});
