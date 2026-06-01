import type { z } from "zod";

export interface ConversationMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ImageInput {
  data: string;
  mimeType: string;
}

export interface ModelPrompt {
  system: string;
  messages: ConversationMessage[];
  images?: ImageInput[];
}

export interface ModelResponse {
  content: string;
  finishReason: "stop" | "length" | "error";
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

export interface ToolCall {
  id: string;
  name: string;
  arguments: string;
}

export interface ToolCallResult {
  toolCallId: string;
  name: string;
  result: string;
}

export interface ModelProvider {
  readonly name: string;

  complete(prompt: ModelPrompt, signal?: AbortSignal): Promise<ModelResponse>;

  completeStreaming(
    prompt: ModelPrompt,
    signal?: AbortSignal,
  ): AsyncIterable<string>;

  completeStructured<T>(
    prompt: ModelPrompt,
    schema: z.ZodSchema<T>,
    signal?: AbortSignal,
  ): Promise<T>;

  completeWithTools?(
    prompt: ModelPrompt,
    tools: ToolDefinition[],
    signal?: AbortSignal,
  ): Promise<{content: string; toolCalls: ToolCall[]}>;
}
