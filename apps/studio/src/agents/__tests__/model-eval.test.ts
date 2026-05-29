import { describe, expect, test } from "bun:test";

import { compareModelEvalRuns, runModelEvalSuite, summarizeModelEvalRun } from "@/agents/model-eval";
import type { ModelPrompt, ModelProvider, ModelResponse } from "@/agents/providers/ModelProvider";
import { normalizeAiProviderSelection } from "@/agents/provider-selection";

function buildMockProvider(): ModelProvider {
  return {
    name: "mock-provider",
    async complete(_prompt: ModelPrompt): Promise<ModelResponse> {
      return { content: "", finishReason: "stop" };
    },
    async *completeStreaming(_prompt: ModelPrompt): AsyncIterable<string> {
      yield "";
    },
    async completeStructured<T>(prompt: ModelPrompt): Promise<T> {
      const system = prompt.system.toLowerCase();
      if (system.includes("command interpreter")) {
        return {
          operations: [
            { type: "toggle_camera", cameraId: "Camera 1", status: "off" },
            { type: "set_time_of_day", timeOfDay: "night" },
          ],
        } as T;
      }
      if (system.includes("security camera optimization expert")) {
        return {
          candidates: [
            {
              description: "Re-aim Camera 1 toward the front aisle.",
              operations: [{ type: "rotate_camera", cameraId: "Camera 1", yawDeg: 12 }],
              costCategory: "low",
            },
            {
              description: "Add a second camera above the checkout.",
              operations: [{ type: "move_camera", cameraId: "Camera 2", newPosition: [5, 2.8, 3] }],
              costCategory: "medium",
            },
            {
              description: "Increase lighting over the counter.",
              operations: [{ type: "toggle_light", lightId: "Light 1", status: "on" }],
              costCategory: "free",
            },
          ],
        } as T;
      }
      if (system.includes("professional security audit report writer")) {
        return {
          title: "Retail Pilot Site Coverage Audit",
          siteName: "Retail Pilot Site",
          generatedAt: Date.now(),
          executiveSummary: "Coverage is strong with one remaining checkout risk.",
          sections: [
            { title: "Summary", content: "A concise audit summary.", type: "text" },
            { title: "Metrics", content: "A compact metrics table.", type: "table" },
            { title: "Actions", content: "A recommended action list.", type: "list" },
          ],
          recommendations: [
            "Re-aim Camera 1 toward the front aisle.",
            "Add a camera at the checkout line.",
          ],
          assumptions: ["Retail pilot assumptions supplied."],
          limitations: ["No live metadata available."],
        } as T;
      }
      if (system.includes("security planning scene drafts")) {
        return {
          templateId: "retail-shop",
          widthM: 10,
          depthM: 7,
          heightM: 3,
          sceneName: "Mock Draft Shop",
          assumptions: ["Structured output provided by test double."],
          blueprint: {
            entryPoints: [{ label: "Front Entry", position: { x: 5, z: 0.2 } }],
            cameras: [
              {
                name: "Camera 1",
                position: { x: 2, y: 2.8, z: 1 },
                yawDeg: 180,
                pitchDeg: -20,
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
              {
                name: "Camera 2",
                position: { x: 8, y: 2.8, z: 1 },
                yawDeg: 180,
                pitchDeg: -20,
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
            securityLights: [],
            obstructions: [],
            criticalZones: [],
            paths: [],
          },
        } as T;
      }
      throw new Error(`Unexpected prompt: ${prompt.system}`);
    },
  };
}

describe("model eval suite", () => {
  test("runs the canonical fixture suite against the active provider", async () => {
    const originalOpenAiKey = process.env.OPENAI_API_KEY;
    process.env.OPENAI_API_KEY = "test-key";

    try {
      const report = await runModelEvalSuite(
        buildMockProvider(),
        normalizeAiProviderSelection({ providerId: "openai", model: "gpt-4o" }),
        false,
      );

      expect(report.summary.total).toBe(5);
      expect(report.summary.failed).toBe(0);
      expect(report.summary.skipped).toBe(0);
      expect(report.summary.passed).toBe(5);
      expect(report.provider.providerLabel).toContain("OpenAI");
      expect(report.governance.activeProviderId).toBe("openai");
      expect(report.fixtures.some((fixture) => fixture.id === "model_layout_draft" && fixture.status === "pass")).toBe(true);
    } finally {
      if (originalOpenAiKey === undefined) {
        delete process.env.OPENAI_API_KEY;
      } else {
        process.env.OPENAI_API_KEY = originalOpenAiKey;
      }
    }
  });

  test("skips cloud fixtures when local-only policy is active", async () => {
    const originalOpenAiKey = process.env.OPENAI_API_KEY;
    process.env.OPENAI_API_KEY = "test-key";

    try {
      const report = await runModelEvalSuite(
        buildMockProvider(),
        normalizeAiProviderSelection({ providerId: "openai", model: "gpt-4o" }),
        true,
      );

      expect(report.summary.total).toBe(5);
      expect(report.summary.passed).toBe(1);
      expect(report.summary.skipped).toBe(4);
      expect(report.fixtures[0]?.status).toBe("pass");
      expect(report.fixtures.some((fixture) => fixture.status === "skip")).toBe(true);
      expect(report.fixtures.filter((fixture) => fixture.status === "skip").every((fixture) => fixture.skippedReason)).toBe(true);
    } finally {
      if (originalOpenAiKey === undefined) {
        delete process.env.OPENAI_API_KEY;
      } else {
        process.env.OPENAI_API_KEY = originalOpenAiKey;
      }
    }
  });

  test("summarizes runs with a visible stage budget and comparison deltas", async () => {
    const originalOpenAiKey = process.env.OPENAI_API_KEY;
    process.env.OPENAI_API_KEY = "test-key";

    try {
      const report = await runModelEvalSuite(
        buildMockProvider(),
        normalizeAiProviderSelection({ providerId: "openai", model: "gpt-4o" }),
        false,
      );

      const summary = summarizeModelEvalRun(report);
      const comparison = compareModelEvalRuns(
        { ...summary, summary: { ...summary.summary, failed: 1, passed: 4 }, fixtureSummaries: summary.fixtureSummaries.map((fixture) => ({ ...fixture, durationMs: fixture.durationMs + 25 })) },
        summary,
      );

      expect(summary.stageBudget.modeLabel).toBe("Cloud-backed budget");
      expect(summary.stageBudget.met).toBe(true);
      expect(summary.fixtureSummaries).toHaveLength(5);
      expect(comparison.deltaFailed).toBe(-1);
      expect(comparison.deltaPassed).toBe(1);
      expect(comparison.deltaTotalDurationMs).toBeLessThan(0);
      expect(comparison.trendLabel).toBe("Improved");
    } finally {
      if (originalOpenAiKey === undefined) {
        delete process.env.OPENAI_API_KEY;
      } else {
        process.env.OPENAI_API_KEY = originalOpenAiKey;
      }
    }
  });
});
