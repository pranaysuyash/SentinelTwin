import type { z } from "zod";
import type { ModelPrompt, ModelProvider, ModelResponse } from "./ModelProvider";

/**
 * GeminiProvider — stub for Gemini 2.5 Flash/Pro.
 * Implemented later when Gemini API support is added.
 */
export class GeminiProvider implements ModelProvider {
  readonly name = "gemini-2.5-flash";

  async complete(_prompt: ModelPrompt): Promise<ModelResponse> {
    throw new Error("GeminiProvider not yet implemented");
  }

  async completeStructured<T>(_prompt: ModelPrompt, _schema: z.ZodSchema<T>): Promise<T> {
    throw new Error("GeminiProvider not yet implemented");
  }
}
