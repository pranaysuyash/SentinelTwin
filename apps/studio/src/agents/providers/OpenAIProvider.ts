import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";

import type { ConversationMessage, ModelPrompt, ModelProvider, ModelResponse } from "./ModelProvider";

function buildOpenAiMessages(prompt: ModelPrompt) {
  return [
    { role: "system" as const, content: prompt.system },
    ...prompt.messages.map((msg) => ({
      role: msg.role as "system" | "user" | "assistant",
      content: msg.content,
    })),
  ];
}

/**
 * OpenAIProvider — uses GPT-4o with Structured Outputs for reliable JSON.
 *
 * Reads OPENAI_API_KEY or NEXT_PUBLIC_OPENAI_API_KEY from environment.
 */
export class OpenAIProvider implements ModelProvider {
  readonly name = "openai-gpt4o";
  private apiKey: string;
  private baseUrl = "https://api.openai.com/v1";

  constructor() {
    this.apiKey =
      typeof process !== "undefined"
        ? (process.env.OPENAI_API_KEY ?? process.env.NEXT_PUBLIC_OPENAI_API_KEY ?? "")
        : "";
    if (!this.apiKey) {
      console.warn("[OpenAIProvider] No OPENAI_API_KEY set — AI commands will fail at runtime.");
    }
  }

  async complete(prompt: ModelPrompt): Promise<ModelResponse> {
    const body = {
      model: "gpt-4o",
      messages: buildOpenAiMessages(prompt),
      temperature: 0.1,
    };

    const res = await fetch(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${this.apiKey}` },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const err = await res.text().catch(() => "unknown");
      throw new Error(`OpenAI API error (${res.status}): ${err}`);
    }

    const json = await res.json();
    const choice = json.choices?.[0];
    return {
      content: choice?.message?.content ?? "",
      finishReason: choice?.finish_reason === "stop" ? "stop" : "error",
      usage: json.usage
        ? {
            promptTokens: json.usage.prompt_tokens,
            completionTokens: json.usage.completion_tokens,
            totalTokens: json.usage.total_tokens,
          }
        : undefined,
    };
  }

  async completeStructured<T>(prompt: ModelPrompt, schema: z.ZodSchema<T>): Promise<T> {
    // Build JSON schema from Zod using the robust zod-to-json-schema library
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const zodJson = zodToJsonSchema(schema as any);

    // OpenAI expects the schema under `schema` with `additionalProperties: false`
    // at every object level. Ensure strict mode compatibility.
    const jsonSchema = ensureStrictMode(zodJson);

    const body = {
      model: "gpt-4o",
      messages: buildOpenAiMessages(prompt),
      temperature: 0.1,
      response_format: {
        type: "json_schema" as const,
        json_schema: {
          name: "structured_output",
          strict: true,
          schema: jsonSchema,
        },
      },
    };

    const res = await fetch(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${this.apiKey}` },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const err = await res.text().catch(() => "unknown");
      throw new Error(`OpenAI API error (${res.status}): ${err}`);
    }

    const json = await res.json();
    const content = json.choices?.[0]?.message?.content;
    if (!content) throw new Error("OpenAI returned empty content");

    const parsed = JSON.parse(content);
    return schema.parse(parsed);
  }
}

/**
 * Recursively ensure the JSON schema is compatible with OpenAI's strict mode:
 * - Every object must have `additionalProperties: false`
 * - String enum schemas must use only `enum` (no `type`)
 */
function ensureStrictMode(schema: Record<string, unknown>): Record<string, unknown> {
  if (!schema || typeof schema !== "object") return schema;

  const result: Record<string, unknown> = { ...schema };

  // OpenAI strict mode requires additionalProperties: false on all objects
  if (result.type === "object" && result.properties) {
    result.additionalProperties = false;
  }

  // Recursively process nested schemas
  if (result.properties && typeof result.properties === "object" && !Array.isArray(result.properties)) {
    const props: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(result.properties as Record<string, unknown>)) {
      props[key] = ensureStrictMode(value as Record<string, unknown>);
    }
    result.properties = props;
  }

  // Process items (array elements)
  if (result.items && typeof result.items === "object") {
    result.items = ensureStrictMode(result.items as Record<string, unknown>);
  }

  // Process oneOf / anyOf / allOf
  for (const key of ["oneOf", "anyOf", "allOf"] as const) {
    if (Array.isArray(result[key])) {
      result[key] = (result[key] as Record<string, unknown>[]).map((item) =>
        ensureStrictMode(item),
      );
    }
  }

  return result;
}
