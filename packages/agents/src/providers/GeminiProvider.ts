import { z } from "zod";

import type { ModelPrompt, ModelProvider, ModelResponse, ToolDefinition, ToolCall } from "./ModelProvider";

export class GeminiProvider implements ModelProvider {
  readonly name = "gemini-2.5-flash";
  private apiKey: string;
  private model: string;

  constructor(model = "gemini-2.5-flash") {
    this.model = model;
    this.apiKey =
      typeof process !== "undefined"
        ? (process.env.GEMINI_API_KEY ?? process.env.NEXT_PUBLIC_GEMINI_API_KEY ?? "")
        : "";
    if (!this.apiKey) {
      console.warn("[GeminiProvider] No GEMINI_API_KEY set — Gemini calls will fail at runtime.");
    }
  }

  async complete(prompt: ModelPrompt, signal?: AbortSignal): Promise<ModelResponse> {
    const body = {
      contents: this.buildGeminiContents(prompt),
      systemInstruction: { role: "user", parts: [{ text: prompt.system }] },
      generationConfig: { temperature: 0.1, maxOutputTokens: 4096 },
    };

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal,
      },
    );

    if (!res.ok) {
      const err = await res.text().catch(() => "unknown");
      throw new Error(`Gemini API error (${res.status}): ${err}`);
    }

    const json = (await res.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> }; finishReason?: string }>;
      usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number; totalTokenCount?: number };
    };
    const candidate = json.candidates?.[0];
    const text = candidate?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";

    return {
      content: text,
      finishReason: candidate?.finishReason === "STOP" ? "stop" : "error",
      usage: json.usageMetadata
        ? {
            promptTokens: json.usageMetadata.promptTokenCount ?? 0,
            completionTokens: json.usageMetadata.candidatesTokenCount ?? 0,
            totalTokens: json.usageMetadata.totalTokenCount ?? 0,
          }
        : undefined,
    };
  }

  async *completeStreaming(prompt: ModelPrompt, signal?: AbortSignal): AsyncIterable<string> {
    const body = {
      contents: this.buildGeminiContents(prompt),
      systemInstruction: { role: "user", parts: [{ text: prompt.system }] },
      generationConfig: { temperature: 0.1, maxOutputTokens: 4096 },
    };

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:streamGenerateContent?alt=sse&key=${this.apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal,
      },
    );

    if (!res.ok) {
      const err = await res.text().catch(() => "unknown");
      throw new Error(`Gemini API error (${res.status}): ${err}`);
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
            const text = parsed.candidates?.[0]?.content?.parts?.[0]?.text;
            if (text) yield text;
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
    const body = {
      contents: this.buildGeminiContents(prompt),
      systemInstruction: { role: "user", parts: [{ text: prompt.system }] },
      generationConfig: { temperature: 0.1, maxOutputTokens: 4096, responseMimeType: "application/json" },
    };

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal,
      },
    );

    if (!res.ok) {
      const err = await res.text().catch(() => "unknown");
      throw new Error(`Gemini API error (${res.status}): ${err}`);
    }

    const json = (await res.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    const text = json.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
    if (!text) throw new Error("Gemini returned empty content");

    const parsed = JSON.parse(text);
    return schema.parse(parsed);
  }

  async completeWithTools(
    prompt: ModelPrompt,
    tools: ToolDefinition[],
    signal?: AbortSignal,
  ): Promise<{ content: string; toolCalls: ToolCall[] }> {
    const toolsBody = tools.map((tool) => ({
      functionDeclarations: [{
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters,
      }],
    }));

    const body = {
      contents: this.buildGeminiContents(prompt),
      systemInstruction: { role: "user", parts: [{ text: prompt.system }] },
      tools: toolsBody,
      generationConfig: { temperature: 0.1, maxOutputTokens: 4096 },
    };

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal,
      },
    );

    if (!res.ok) {
      const err = await res.text().catch(() => "unknown");
      throw new Error(`Gemini API error (${res.status}): ${err}`);
    }

    const json = (await res.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string; functionCall?: { name: string; args: Record<string, unknown> } }> }; finishReason?: string }>;
    };
    const candidate = json.candidates?.[0];
    const text = candidate?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
    const fnCalls = (candidate?.content?.parts ?? []).filter((p): p is typeof p & { functionCall: NonNullable<typeof p.functionCall> } => !!p.functionCall);

    const toolCalls: ToolCall[] = fnCalls.map((part, idx) => ({
      id: `fc_${idx}`,
      name: part.functionCall.name,
      arguments: JSON.stringify(part.functionCall.args ?? {}),
    }));

    return { content: text, toolCalls };
  }

  private buildGeminiContents(prompt: ModelPrompt): { role: string; parts: { text: string }[] }[] {
    return prompt.messages.map((msg) => ({
      role: msg.role === "assistant" ? "model" : "user",
      parts: [{ text: msg.content }],
    }));
  }
}
