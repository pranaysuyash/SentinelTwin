import { z } from "zod";

import { PROMPT_REGISTRY } from "@/agents/prompt-registry";
import { sceneOperationSchema, type SceneOperation } from "@/schema/SceneOperation";
import type { ModelProvider } from "./providers/ModelProvider";

/**
 * Counterfactual candidate proposed by the AI.
 * verifiedDelta is set AFTER the simulation tests it.
 */
export interface CounterfactualCandidate {
  id: string;
  description: string;
  operations: SceneOperation[];
  costCategory: "free" | "low" | "medium" | "high";
  estimatedImpact: string;
  rationale?: string;
  risks?: string[];
  assumptions?: string[];
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
      description: z.string().min(8),
      rationale: z.string().min(8).optional(),
      operations: z.array(sceneOperationSchema).min(1),
      costCategory: z.enum(["free", "low", "medium", "high"]),
      risks: z.array(z.string()).optional(),
      assumptions: z.array(z.string()).optional(),
    }),
  ),
});

const counterfactualPromptEntry = PROMPT_REGISTRY.find((entry) => entry.id === "counterfactual_candidates");
if (!counterfactualPromptEntry) {
  throw new Error("Missing counterfactual_candidates prompt registry entry.");
}
const SYSTEM_PROMPT = counterfactualPromptEntry.systemPrompt;

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
          "\nReturn: { candidates: [{ description, rationale, operations, costCategory, risks, assumptions }] }",
        ].join("\n"),
      },
    ],
  };

  const result = await provider.completeStructured(prompt, counterfactualResponseSchema);

  return result.candidates.map((c, i) => ({
    id: `cf_${crypto.randomUUID()}`,
    description: c.description,
    operations: c.operations,
    costCategory: c.costCategory,
    estimatedImpact: c.rationale ?? c.description,
    rationale: c.rationale,
    risks: c.risks ?? [],
    assumptions: c.assumptions ?? [],
  }));
}
