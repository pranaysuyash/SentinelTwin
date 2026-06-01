export type AiActionTelemetryStage = "command_parse" | "counterfactual" | "report_generation" | "ai_draft";

export type AgentRole = "command" | "report" | "counterfactual" | "coordinator" | "scene_understanding";

export interface AgentTask {
  id: string;
  role: AgentRole;
  input: string;
  context?: Record<string, unknown>;
}

export interface AgentResult {
  taskId: string;
  role: AgentRole;
  output: string;
  structured?: Record<string, unknown>;
  error?: string;
  usage?: { promptTokens: number; completionTokens: number };
}
