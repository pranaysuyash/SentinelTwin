import type { z } from "zod";

/**
 * A conversation message in the provider's native format.
 * Providers convert this to their own format internally.
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
 * Implementations: OpenAIProvider, GeminiProvider (stub), QwenProvider (stub).
 * Configured via AgentConfig.
 */
export interface ModelProvider {
  readonly name: string;

  /** Free-form text completion */
  complete(prompt: ModelPrompt): Promise<ModelResponse>;

  /** Structured output: pass a Zod schema, get validated JSON back */
  completeStructured<T>(
    prompt: ModelPrompt,
    schema: z.ZodSchema<T>,
  ): Promise<T>;
}
