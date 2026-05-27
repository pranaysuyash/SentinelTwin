import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";

import type { ModelPrompt, ModelProvider, ModelResponse } from "./ModelProvider";

function buildMessages(prompt: ModelPrompt) {
  return [
    { role: "system" as const, content: prompt.system },
    ...prompt.messages.map((msg) => ({
      role: msg.role as "system" | "user" | "assistant",
      content: msg.content,
    })),
  ];
}

/**
 * QwenProvider — uses Qwen2.5-VL or Qwen2.5 via OpenAI-compatible API.
 * Uses the Together AI or Alibaba Cloud endpoint, or a self-hosted vLLM server.
 * Default endpoint: Together AI (serves Qwen2.5-VL-72B).
 */
export class QwenProvider implements ModelProvider {
  readonly name = "qwen-2.5-vl";
  private apiKey: string;
  private baseUrl: string;
  private model: string;

  constructor(
    model = "Qwen/Qwen2.5-VL-72B-Instruct-Turbo",
    baseUrl = "https://api.together.xyz/v1",
  ) {
    this.model = model;
    this.baseUrl = baseUrl;
    this.apiKey =
      typeof process !== "undefined"
        ? (process.env.TOGETHER_API_KEY ?? process.env.NEXT_PUBLIC_TOGETHER_API_KEY ?? process.env.QWEN_API_KEY ?? "")
        : "";
    if (!this.apiKey) {
      console.warn("[QwenProvider] No TOGETHER_API_KEY or QWEN_API_KEY set — Qwen calls will fail at runtime.");
    }
  }

  async complete(prompt: ModelPrompt, signal?: AbortSignal): Promise<ModelResponse> {
    const body = {
      model: this.model,
      messages: buildMessages(prompt),
      temperature: 0.1,
      max_tokens: 4096,
    };

    const res = await fetch(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${this.apiKey}` },
      body: JSON.stringify(body),
      signal,
    });

    if (!res.ok) {
      const err = await res.text().catch(() => "unknown");
      throw new Error(`Qwen API error (${res.status}): ${err}`);
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
      messages: buildMessages(prompt),
      temperature: 0.1,
      max_tokens: 4096,
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
      throw new Error(`Qwen API error (${res.status}): ${err}`);
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
            // Skip malformed chunks
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  async completeStructured<T>(prompt: ModelPrompt, schema: z.ZodSchema<T>, signal?: AbortSignal): Promise<T> {
    // Use JSON mode (most OpenAI-compatible endpoints support it)
    const jsonSchema = zodToJsonSchema(schema as unknown as Parameters<typeof zodToJsonSchema>[0]);
    const schemaStr = JSON.stringify(jsonSchema);

    const body = {
      model: this.model,
      messages: [
        ...buildMessages(prompt),
        { role: "system" as const, content: `You must respond with valid JSON matching this schema: ${schemaStr}` },
      ],
      temperature: 0.1,
      max_tokens: 4096,
      response_format: { type: "json_object" },
    };

    const res = await fetch(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${this.apiKey}` },
      body: JSON.stringify(body),
      signal,
    });

    if (!res.ok) {
      const err = await res.text().catch(() => "unknown");
      throw new Error(`Qwen API error (${res.status}): ${err}`);
    }

    const json = await res.json();
    const content = json.choices?.[0]?.message?.content;
    if (!content) throw new Error("Qwen returned empty content");

    const parsed = JSON.parse(content);
    return schema.parse(parsed);
  }
}
