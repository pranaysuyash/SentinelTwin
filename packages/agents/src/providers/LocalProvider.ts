import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";

import type { ModelPrompt, ModelProvider, ModelResponse, ToolDefinition, ToolCall } from "./ModelProvider";

function buildMessages(prompt: ModelPrompt) {
  return [
    { role: "system" as const, content: prompt.system },
    ...prompt.messages.map((msg) => ({
      role: msg.role as "system" | "user" | "assistant",
      content: msg.content,
    })),
  ];
}

export class LocalProvider implements ModelProvider {
  readonly name = "local-ollama";
  private baseUrl: string;
  private model: string;
  private ready: boolean = false;

  constructor(
    model = "llama3.2",
    baseUrl = "http://127.0.0.1:11434",
  ) {
    this.model = model;
    this.baseUrl = baseUrl;
    this.checkAvailability();
  }

  private async checkAvailability(): Promise<void> {
    try {
      const res = await fetch(`${this.baseUrl}/api/tags`, { method: "GET", signal: AbortSignal.timeout(3000) });
      this.ready = res.ok;
    } catch {
      this.ready = false;
    }
  }

  isReady(): boolean {
    return this.ready;
  }

  async waitForReady(timeoutMs = 10000): Promise<boolean> {
    const startedAt = Date.now();
    while (Date.now() - startedAt < timeoutMs) {
      await this.checkAvailability();
      if (this.ready) return true;
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
    return false;
  }

  async complete(prompt: ModelPrompt, signal?: AbortSignal): Promise<ModelResponse> {
    const body = {
      model: this.model,
      messages: buildMessages(prompt),
      stream: false,
      options: { temperature: 0.1 },
    };

    const res = await fetch(`${this.baseUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal,
    });

    if (!res.ok) {
      const err = await res.text().catch(() => "unknown");
      throw new Error(`Local/Ollama API error (${res.status}): ${err}`);
    }

    const json = (await res.json()) as { message?: { content?: string }; done?: boolean };
    return {
      content: json.message?.content ?? "",
      finishReason: json.done ? "stop" : "error",
    };
  }

  async *completeStreaming(prompt: ModelPrompt, signal?: AbortSignal): AsyncIterable<string> {
    const body = {
      model: this.model,
      messages: buildMessages(prompt),
      stream: true,
      options: { temperature: 0.1 },
    };

    const res = await fetch(`${this.baseUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal,
    });

    if (!res.ok) {
      const err = await res.text().catch(() => "unknown");
      throw new Error(`Local/Ollama API error (${res.status}): ${err}`);
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
          if (!trimmed) continue;

          try {
            const parsed = JSON.parse(trimmed);
            const content = parsed.message?.content;
            if (content) yield content;
            if (parsed.done) return;
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
    const jsonSchema = zodToJsonSchema(schema as unknown as Parameters<typeof zodToJsonSchema>[0]);
    const schemaStr = JSON.stringify(jsonSchema);

    const body = {
      model: this.model,
      messages: [
        ...buildMessages(prompt),
        { role: "system" as const, content: `You must respond with valid JSON matching this schema: ${schemaStr}` },
      ],
      stream: false,
      options: { temperature: 0.1 },
    };

    const res = await fetch(`${this.baseUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal,
    });

    if (!res.ok) {
      const err = await res.text().catch(() => "unknown");
      throw new Error(`Local/Ollama API error (${res.status}): ${err}`);
    }

    const json = (await res.json()) as { message?: { content?: string } };
    const content = json.message?.content;
    if (!content) throw new Error("Local provider returned empty content");

    const parsed = JSON.parse(content);
    return schema.parse(parsed);
  }

  async completeWithTools(
    prompt: ModelPrompt,
    tools: ToolDefinition[],
    signal?: AbortSignal,
  ): Promise<{ content: string; toolCalls: ToolCall[] }> {
    const body = {
      model: this.model,
      messages: buildMessages(prompt),
      stream: false,
      options: { temperature: 0.1 },
      tools: tools.map((tool) => ({
        type: "function",
        function: {
          name: tool.name,
          description: tool.description,
          parameters: tool.parameters,
        },
      })),
    };

    const res = await fetch(`${this.baseUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal,
    });

    if (!res.ok) {
      const err = await res.text().catch(() => "unknown");
      throw new Error(`Local/Ollama API error (${res.status}): ${err}`);
    }

    const json = (await res.json()) as { message?: { content?: string; tool_calls?: Array<{ function: { name: string; arguments: Record<string, unknown> } }> } };
    const tc = json.message?.tool_calls ?? [];
    const toolCalls: ToolCall[] = tc.map((call, idx) => ({
      id: `local_tc_${idx}`,
      name: call.function.name,
      arguments: JSON.stringify(call.function.arguments ?? {}),
    }));

    return {
      content: json.message?.content ?? "",
      toolCalls,
    };
  }
}
