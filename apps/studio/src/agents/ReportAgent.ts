import { z } from "zod";

import { PROMPT_REGISTRY } from "@/agents/prompt-registry";
import type { ModelProvider } from "./providers/ModelProvider";

export interface ReportSection {
  title: string;
  content: string;
  type: "text" | "table" | "list";
}

export interface SecurityReport {
  title: string;
  siteName: string;
  generatedAt: number;
  executiveSummary: string;
  sections: ReportSection[];
  recommendations: string[];
  assumptions: string[];
  limitations: string[];
}

const reportSchema = z.object({
  title: z.string(),
  siteName: z.string(),
  generatedAt: z.number(),
  executiveSummary: z.string(),
  sections: z.array(
    z.object({
      title: z.string(),
      content: z.string(),
      type: z.enum(["text", "table", "list"]),
    }),
  ),
  recommendations: z.array(z.string()),
  assumptions: z.array(z.string()),
  limitations: z.array(z.string()),
});

const SYSTEM_PROMPT = PROMPT_REGISTRY.find((entry) => entry.id === "report_generation")?.systemPrompt ?? "";

/**
 * Generate a professional security audit report from simulation results.
 */
export async function generateReport(
  simulationData: string,
  sceneSummary: string,
  provider: ModelProvider,
): Promise<SecurityReport> {
  const prompt = {
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user" as const,
        content: [
          `Write a professional security camera coverage audit report for a client.`,
          `Use the verified simulation data below.`,
          ``,
          `Simulation data: ${simulationData}`,
          `Scene: ${sceneSummary}`,
        ].join("\n"),
      },
    ],
  };

  return provider.completeStructured(prompt, reportSchema);
}

/**
 * Build a compact JSON-safe summary of simulation results for the report agent.
 */
export function buildSimulationSummary(result: {
  totalCoveragePct: number;
  blindspotPct: number;
  averageWalkableQuality: number;
  worstAreaQuality: string;
  recognitionAreaPct: number;
  identificationAreaPct: number;
  coverageByQuality: Record<string, number>;
  issues: { severity: string; description: string }[];
  recommendations: { description: string; costCategory: string; verified: boolean }[];
  criticalZoneResults: { label: string; actualQuality: string; requiredQuality: string; status: string }[];
  cameraResults: { cameraId: string; coveragePct: number }[];
}): string {
  return JSON.stringify(
    {
      totalCoverage: `${result.totalCoveragePct}%`,
      blindspot: `${result.blindspotPct}%`,
      avgQuality: result.averageWalkableQuality.toFixed(2),
      worstArea: result.worstAreaQuality,
      recognitionArea: `${result.recognitionAreaPct}%`,
      identificationArea: `${result.identificationAreaPct}%`,
      coverageByQuality: result.coverageByQuality,
      zones: result.criticalZoneResults.map((z) => ({
        name: z.label,
        required: z.requiredQuality,
        actual: z.actualQuality,
        status: z.status,
      })),
      cameras: result.cameraResults.map((c) => ({
        id: c.cameraId,
        coverage: `${c.coveragePct.toFixed(1)}%`,
      })),
      issues: result.issues.map((i) => ({
        severity: i.severity,
        description: i.description,
      })),
      recommendations: result.recommendations.map((r) => ({
        description: r.description,
        cost: r.costCategory,
        verified: r.verified,
      })),
    },
    null,
    2,
  );
}
