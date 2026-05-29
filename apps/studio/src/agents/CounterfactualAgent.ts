import { z } from "zod";

import { PROMPT_REGISTRY } from "@/agents/prompt-registry";
import type { ModelProvider } from "./providers/ModelProvider";

/**
 * Counterfactual candidate proposed by the AI.
 * verifiedDelta is set AFTER the simulation tests it.
 */
export interface CounterfactualCandidate {
  id: string;
  description: string;
  operations: Record<string, unknown>[];
  costCategory: "free" | "low" | "medium" | "high";
  estimatedImpact: string;
  verifiedDelta?: {
    totalCoveragePctDelta: number;
    blindspotPctDelta: number;
    criticalZoneStatusChanges: string[];
    worstIssueResolved: boolean;
    adversarialPathExposureDelta?: number;
  };
  rank?: number;
}

const counterfactualResponseSchema = z.object({
  candidates: z.array(
    z.object({
      description: z.string(),
      operations: z.array(z.record(z.string(), z.unknown())),
      costCategory: z.enum(["free", "low", "medium", "high"]),
    }),
  ),
});

const SYSTEM_PROMPT = PROMPT_REGISTRY.find((entry) => entry.id === "counterfactual_candidates")?.systemPrompt ?? "";

/**
 * Propose counterfactual candidates based on current simulation results and constraints.
 */
export async function proposeCounterfactuals(
  issuesSummary: string,
  sceneSummary: string,
  constraints: string[],
  provider: ModelProvider,
): Promise<CounterfactualCandidate[]> {
  const constraintsText = constraints.length > 0
    ? `Constraints: ${constraints.join(", ")}`
    : "No constraints.";

  const prompt = {
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user" as const,
        content: [
          `Current problems: ${issuesSummary}`,
          `Scene context: ${sceneSummary}`,
          constraintsText,
          "\nReturn: { candidates: [{ description, operations, costCategory }] }",
        ].join("\n"),
      },
    ],
  };

  const result = await provider.completeStructured(prompt, counterfactualResponseSchema);

  return result.candidates.map((c, i) => ({
    id: `cf_${Date.now().toString(36)}_${i}`,
    description: c.description,
    operations: c.operations,
    costCategory: c.costCategory,
    estimatedImpact: c.description,
  }));
}
