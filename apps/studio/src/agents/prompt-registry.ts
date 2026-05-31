import type { AiActionTelemetryStage } from "@/store/studio-store";

export type PromptRegistryStage = "command" | "counterfactual" | "report" | "draft";

export type PromptRegistryEntry = {
  id: string;
  version: string;
  title: string;
  agent: string;
  stage: PromptRegistryStage;
  outputSchema: string;
  systemPrompt: string;
  note: string;
};

export type PromptRegistrySummary = {
  total: number;
  stages: Record<PromptRegistryStage, number>;
  latestVersion: string;
  registryDigest: string;
};

export type PromptRegistrySnapshot = PromptRegistrySummary & {
  observedAt: number;
};

export type PromptRegistryLineage = {
  promptId: string;
  promptVersion: string;
  promptTitle: string;
  promptAgent: string;
  promptStage: PromptRegistryStage;
  promptOutputSchema: string;
};

export const PROMPT_REGISTRY: PromptRegistryEntry[] = [
  {
    id: "command_parse",
    version: "v1",
    title: "Command Parse",
    agent: "CommandAgent",
    stage: "command",
    outputSchema: "SceneOperation[]",
    systemPrompt: `You are SentinelTwin's command interpreter. Convert the user's natural language request into structured scene operations.

You can perform these operations:
- move_camera: Change a camera's position (x, y, z)
- rotate_camera: Change a camera's yaw (horizontal) and/or pitch (vertical) in degrees
- change_camera_fov: Change a camera's horizontal field of view (1-180 degrees)
- toggle_camera: Turn a camera on or off
- move_obstruction: Move an obstruction/shelf to a new position (x, y, z)
- resize_obstruction: Change an obstruction's dimensions (width, height, depth)
- rotate_obstruction: Rotate an obstruction horizontally
- add_obstruction: Add a new obstruction with type and position
- add_light: Add a new security light at a position
- toggle_light: Turn a light on or off
- set_time_of_day: Switch between day, night, or dusk
- save_snapshot: Save the current state with a label
- generate_report: Generate a security audit report
- run_coverage_failure_analysis: Run defensive coverage-failure route analysis
- run_adversarial: Legacy alias for coverage-failure analysis

Defensive-only policy:
- Only return operations that support authorized incident replay, coverage-failure analysis, and hardening recommendations.
- If a request asks for evasion, bypassing, or defeating security, return an empty operations array.

Output ONLY valid JSON matching the schema. Do not explain, do not add commentary.`,
    note: "Canonical structured-output prompt for natural-language scene commands.",
  },
  {
    id: "counterfactual_candidates",
    version: "v1",
    title: "Counterfactual Candidates",
    agent: "CounterfactualAgent",
    stage: "counterfactual",
    outputSchema: "CounterfactualCandidate[]",
    systemPrompt: `You are a security camera optimization expert. Given the current coverage analysis, propose 3–5 candidate fixes.

Consider only practical, low-cost changes unless the problem is severe. 
Each candidate must include:
- description: What to change and why
- operations: Array of scene operations (each operation matches the SceneOperation discriminated union)
- costCategory: free (software/configuration change), low (minor physical adjustment), medium (moves equipment), high (adds equipment)

Current problems will be provided as a list of issues from the simulation.
Output ONLY valid JSON matching the schema. Do not explain, do not add commentary.`,
    note: "Canonical structured-output prompt for remediation candidates.",
  },
  {
    id: "report_generation",
    version: "v1",
    title: "Report Generation",
    agent: "ReportAgent",
    stage: "report",
    outputSchema: "SecurityReport",
    systemPrompt: `You are a professional security audit report writer. Write a clear, factual, non-alarmist security camera coverage audit report.

Use the verified simulation data provided. Do not invent numbers. Do not claim more certainty than the data supports.
Use phrases like "estimated recognition-quality coverage" not "guaranteed recognition."

Output ONLY valid JSON matching the schema. Do not explain, do not add commentary.`,
    note: "Canonical structured-output prompt for client-facing audit reports.",
  },
  {
    id: "model_layout_draft",
    version: "v2",
    title: "Model Layout Draft",
    agent: "AI Layout Draft",
    stage: "draft",
    outputSchema: "SecurityScene blueprint",
    systemPrompt: "You generate security planning scene drafts. Return concise structured values only and follow SecurityScene schema exactly. Every generated node must set source=\"ai\", reviewStatus=\"unreviewed\", sourceTrace with a short rationale, and geometryValidity. Camera nodes must include live transport/auth fields when inferred (transportResponseStatus, authChallengeHeader, authChallengeScheme, authChallengeRealm) and keep them omitted otherwise. Keep placements inside the room and include evidenceArtifacts/mismatchReports arrays even when empty.",
    note: "Canonical structured-output prompt for model-backed SecurityScene drafting with schema-complete provenance fields.",
  },
];

const TELEMETRY_STAGE_TO_PROMPT_ID: Record<AiActionTelemetryStage, string> = {
  command_parse: "command_parse",
  counterfactual: "counterfactual_candidates",
  report_generation: "report_generation",
  ai_draft: "model_layout_draft",
};

function buildRegistryDigest(registry: PromptRegistryEntry[]) {
  return registry
    .map((entry) => [entry.id, entry.version, entry.stage, entry.title, entry.agent, entry.outputSchema].join("@"))
    .join("|");
}

export function getPromptRegistryEntry(id: string) {
  return PROMPT_REGISTRY.find((entry) => entry.id === id) ?? null;
}

export function resolvePromptRegistryLineage(stage: AiActionTelemetryStage): PromptRegistryLineage | null {
  const entry = getPromptRegistryEntry(TELEMETRY_STAGE_TO_PROMPT_ID[stage]);
  if (!entry) return null;
  return {
    promptId: entry.id,
    promptVersion: entry.version,
    promptTitle: entry.title,
    promptAgent: entry.agent,
    promptStage: entry.stage,
    promptOutputSchema: entry.outputSchema,
  };
}

export function summarizePromptRegistry(registry: PromptRegistryEntry[] = PROMPT_REGISTRY): PromptRegistrySummary {
  return {
    total: registry.length,
    stages: registry.reduce<Record<PromptRegistryStage, number>>((acc, entry) => {
      acc[entry.stage] += 1;
      return acc;
    }, { command: 0, counterfactual: 0, report: 0, draft: 0 }),
    latestVersion: registry.reduce((latest, entry) => (entry.version > latest ? entry.version : latest), "v1"),
    registryDigest: buildRegistryDigest(registry),
  };
}

export function buildPromptRegistrySnapshot(registry: PromptRegistryEntry[] = PROMPT_REGISTRY): PromptRegistrySnapshot {
  return {
    ...summarizePromptRegistry(registry),
    observedAt: Date.now(),
  };
}
