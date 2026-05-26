import type { z } from "zod";

/**
 * A conversation message in the provider's native format.
 */
export interface ConversationMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ModelPrompt {
  system: string;
  messages: ConversationMessage[];
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

/**
 * ModelProvider — abstract interface for all AI model providers.
 *
 * Implementations: OpenAIProvider, GeminiProvider, QwenProvider.
 * Configured via AgentConfig.
 */
export interface ModelProvider {
  readonly name: string;

  /** Free-form text completion */
  complete(prompt: ModelPrompt, signal?: AbortSignal): Promise<ModelResponse>;

  /**
   * Streaming text completion.
   * Returns an async iterable of text deltas as tokens are generated.
   * The final item in the iterable may include the full accumulated text.
   */
  completeStreaming(
    prompt: ModelPrompt,
    signal?: AbortSignal,
  ): AsyncIterable<string>;

  /** Structured output: pass a Zod schema, get validated JSON back */
  completeStructured<T>(
    prompt: ModelPrompt,
    schema: z.ZodSchema<T>,
    signal?: AbortSignal,
  ): Promise<T>;
}
