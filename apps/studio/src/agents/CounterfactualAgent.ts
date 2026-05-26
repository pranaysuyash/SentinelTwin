import { z } from "zod";

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

const SYSTEM_PROMPT = `You are a security camera optimization expert. Given the current coverage analysis, propose 3–5 candidate fixes.

Consider only practical, low-cost changes unless the problem is severe. 
Each candidate must include:
- description: What to change and why
- operations: Array of scene operations (each operation matches the SceneOperation discriminated union)
- costCategory: free (software/configuration change), low (minor physical adjustment), medium (moves equipment), high (adds equipment)

Current problems will be provided as a list of issues from the simulation.
Output ONLY valid JSON matching the schema. Do not explain, do not add commentary.`;

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
