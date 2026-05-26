import type { z } from "zod";
import type { ModelPrompt, ModelProvider, ModelResponse } from "./ModelProvider";

/**
 * QwenProvider — stub for Qwen2.5-VL (vision) / Qwen (reasoning).
 * Implemented later for vision-based scene understanding tasks.
 */
export class QwenProvider implements ModelProvider {
  readonly name = "qwen-2.5-vl";

  async complete(_prompt: ModelPrompt): Promise<ModelResponse> {
    throw new Error("QwenProvider not yet implemented");
  }

  async completeStructured<T>(_prompt: ModelPrompt, _schema: z.ZodSchema<T>): Promise<T> {
    throw new Error("QwenProvider not yet implemented");
  }
}
