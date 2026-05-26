import { z } from "zod";

import type { ModelPrompt, ModelProvider, ModelResponse } from "./ModelProvider";

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
 * Supports streaming, retry, and abort signals.
 */
export class OpenAIProvider implements ModelProvider {
  readonly name = "openai-gpt4o";
  private apiKey: string;
  private baseUrl = "https://api.openai.com/v1";
  /** Default model, overridable via agent config */
  private model: string;

  constructor(model = "gpt-4o") {
    this.model = model;
    this.apiKey =
      typeof process !== "undefined"
        ? (process.env.OPENAI_API_KEY ?? process.env.NEXT_PUBLIC_OPENAI_API_KEY ?? "")
        : "";
    if (!this.apiKey) {
      console.warn("[OpenAIProvider] No OPENAI_API_KEY set — AI commands will fail at runtime.");
    }
  }

  async complete(prompt: ModelPrompt, signal?: AbortSignal): Promise<ModelResponse> {
    const body = {
      model: this.model,
      messages: buildOpenAiMessages(prompt),
      temperature: 0.1,
    };

    const res = await fetch(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${this.apiKey}` },
      body: JSON.stringify(body),
      signal,
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

  async *completeStreaming(prompt: ModelPrompt, signal?: AbortSignal): AsyncIterable<string> {
    const body = {
      model: this.model,
      messages: buildOpenAiMessages(prompt),
      temperature: 0.1,
      stream: true,
    };

    const res = await fetch(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${this.apiKey}` },
      body: JSON.stringify(body),
      signal,
    });

    if (!res.ok) {
      const err = await res.text().catch(() => "unknown");
      throw new Error(`OpenAI API error (${res.status}): ${err}`);
    }

    const reader = res.body?.getReader();
    if (!reader) throw new Error("No response body for streaming");

    const decoder = new TextDecoder();
    let buffer = "";

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith("data: ")) continue;
          const data = trimmed.slice(6);
          if (data === "[DONE]") return;

          try {
            const parsed = JSON.parse(data);
            const delta = parsed.choices?.[0]?.delta?.content;
            if (delta) yield delta;
          } catch {
            // Skip malformed JSON chunks
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  async completeStructured<T>(prompt: ModelPrompt, schema: z.ZodSchema<T>, signal?: AbortSignal): Promise<T> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const zodJson = z.toJSONSchema(schema as any);
    const jsonSchema = ensureStrictMode(zodJson);

    const body = {
      model: this.model,
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
      signal,
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
 * Recursively ensure the JSON schema is compatible with OpenAI's strict mode.
 */
function ensureStrictMode(schema: Record<string, unknown>): Record<string, unknown> {
  if (!schema || typeof schema !== "object") return schema;

  const result: Record<string, unknown> = { ...schema };

  if (result.type === "object" && result.properties) {
    result.additionalProperties = false;
  }

  if (result.properties && typeof result.properties === "object" && !Array.isArray(result.properties)) {
    const props: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(result.properties as Record<string, unknown>)) {
      props[key] = ensureStrictMode(value as Record<string, unknown>);
    }
    result.properties = props;
  }

  if (result.items && typeof result.items === "object") {
    result.items = ensureStrictMode(result.items as Record<string, unknown>);
  }

  for (const key of ["oneOf", "anyOf", "allOf"] as const) {
    if (Array.isArray(result[key])) {
      result[key] = (result[key] as Record<string, unknown>[]).map((item) =>
        ensureStrictMode(item),
      );
    }
  }

  return result;
}
