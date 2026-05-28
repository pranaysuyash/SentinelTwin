import { describe, expect, test } from "bun:test";

import { draftSceneFromPrompt, draftSceneFromPromptWithModel, summarizeDraftResult } from "@/lib/ai-layout-draft";
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

    const entries = scene.entryPoints.filter((entry) => entry.label.toLowerCase().includes("entry"));
    const shelves = scene.obstructions.filter((obs) => obs.obstructionType === "shelf");
    const counters = scene.obstructions.filter((obs) => obs.obstructionType === "counter");
    const storageZone = scene.criticalZones.find((zone) => zone.label === "Back Storage");
    const paths = scene.paths.filter((path) => path.label === "Entry to Counter");

    expect(scene.cameras.length).toBe(2);
    expect(entries.length).toBeGreaterThanOrEqual(1);
    expect(shelves.length).toBeGreaterThanOrEqual(2);
    expect(counters.length).toBeGreaterThanOrEqual(1);
    expect(storageZone).toBeDefined();
    expect(paths.length).toBeGreaterThanOrEqual(1);
  });

  test("creates light and path hints for prompt language", () => {
    const prompt = "Create a bright 12m x 8m shop with a front entry, counter, and two cameras.";
    const { scene } = draftSceneFromPrompt(prompt);

    expect(scene.securityLights.length).toBeGreaterThanOrEqual(1);
    expect(scene.entryPoints.length).toBeGreaterThanOrEqual(1);
    expect(scene.paths.length).toBeGreaterThanOrEqual(1);
  });

  test("summarizes the draft for a launcher preview card", () => {
    const draft = draftSceneFromPrompt("Create a 10m x 7m electronics shop with front entry and two cameras");
    const summary = summarizeDraftResult(draft);

    expect(summary.sceneName).toContain("AI Draft");
    expect(summary.sourceLabel).toBe("AI Draft");
    expect(summary.modeLabel).toBe("Heuristic fallback");
    expect(summary.counts.cameras).toBe(2);
    expect(summary.counts.entryPoints).toBeGreaterThanOrEqual(1);
    expect(summary.summary).toContain("Heuristic AI draft");
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
          blueprint: {
            entryPoints: [{ label: "Main Entry", position: { x: 1.5, z: 0.2 } }],
            cameras: [
              {
                name: "Reception Camera",
                position: { x: 4, y: 2.8, z: 1 },
                yawDeg: 180,
                pitchDeg: -22,
                mountType: "ceiling",
                mountHeightM: 2.8,
                fovHorizontalDeg: 90,
                fovVerticalDeg: 60,
                rangeM: 12,
                resolutionMP: 4,
                nightMode: "none",
                clarity: "good",
                status: "on",
              },
            ],
            securityLights: [
              {
                name: "Reception Light",
                position: { x: 4, y: 3, z: 3 },
                lightType: "ceiling",
                status: "on",
                brightness: "high",
                rangeM: 8,
              },
            ],
            obstructions: [
              {
                label: "Reception Desk",
                position: { x: 5, y: 0, z: 4 },
                dimensions: { width: 2, depth: 0.9, height: 1.1 },
                obstructionType: "counter",
                rotationYDeg: 0,
                material: "solid",
                visionTransmission: 0,
              },
            ],
            criticalZones: [
              {
                label: "Reception",
                polygon: [
                  { x: 3.5, z: 2.5 },
                  { x: 6, z: 2.5 },
                  { x: 6, z: 5 },
                  { x: 3.5, z: 5 },
                ],
                requiredQuality: "recognition",
                priority: "high",
                targetType: "person_detection",
                nightRequired: false,
                redundancyRequired: false,
                privacyZone: false,
              },
            ],
            paths: [
              {
                label: "Entry Walk",
                actorType: "person",
                intent: "authorized",
                speedMps: 1.2,
                heightM: 1.75,
                timeOfDay: "day",
                points: [
                  { position: { x: 1.5, z: 0.2 }, timestamp: 0, action: "enter" },
                  { position: { x: 3, z: 2 }, timestamp: 3, action: "wait" },
                  { position: { x: 5, z: 4 }, timestamp: 6, action: "exit" },
                ],
              },
            ],
          },
        } as T;
      },
    };

    const result = await draftSceneFromPromptWithModel("office with reception and exits", provider);
    expect(result.scene.name).toBe("AI Draft Office");
    expect(result.scene.source).toBe("ai");
    expect(result.scene.dimensions.width).toBe(18);
    expect(result.scene.dimensions.depth).toBe(12);
    expect(result.scene.entryPoints[0]?.label).toBe("Main Entry");
    expect(result.scene.cameras[0]?.name).toBe("Reception Camera");
    expect(result.scene.securityLights[0]?.name).toBe("Reception Light");
    expect(result.scene.obstructions[0]?.label).toBe("Reception Desk");
    expect(result.scene.paths[0]?.label).toBe("Entry Walk");
    expect(result.warnings[0]).toBe("Generated from prompt");
    expect(result.provenance.mode).toBe("model");
    expect(result.provenance.summary).toContain("Model-backed");
  });
});
