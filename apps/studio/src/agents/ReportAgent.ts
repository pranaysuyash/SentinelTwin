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
  title: z.string().min(4),
  siteName: z.string().min(2),
  generatedAt: z.number().optional(),
  executiveSummary: z.string().min(24),
  sections: z.array(
    z.object({
      title: z.string().min(2),
      content: z.string().min(8),
      type: z.enum(["text", "table", "list"]),
    }),
  ).min(1),
  recommendations: z.array(z.string().min(4)).min(1),
  assumptions: z.array(z.string().min(4)),
  limitations: z.array(z.string().min(4)),
});

const reportPromptEntry = PROMPT_REGISTRY.find((entry) => entry.id === "report_generation");
if (!reportPromptEntry) {
  throw new Error("Missing report_generation prompt registry entry.");
}
const SYSTEM_PROMPT = reportPromptEntry.systemPrompt;

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

  const report = await provider.completeStructured(prompt, reportSchema);
  return {
    ...report,
    generatedAt: Date.now(),
  };
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
      totalCoveragePct: result.totalCoveragePct,
      totalCoverageLabel: `${result.totalCoveragePct}%`,
      blindspotPct: result.blindspotPct,
      blindspotLabel: `${result.blindspotPct}%`,
      averageWalkableQuality: result.averageWalkableQuality,
      avgQualityLabel: result.averageWalkableQuality.toFixed(2),
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
