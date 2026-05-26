import { z } from "zod";

import type { ModelPrompt, ModelProvider, ModelResponse } from "./ModelProvider";

/**
 * GeminiProvider — full implementation for Gemini 2.5 Flash/Pro.
 * Uses the Gemini REST API with generateContent endpoint.
 * Supports streaming via SSE and structured output via response_mime_type.
 */
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

    const json = await res.json();
    const candidate = json.candidates?.[0];
    const text = candidate?.content?.parts?.map((p: { text?: string }) => p.text ?? "").join("") ?? "";

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

    const json = await res.json();
    const text = json.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text ?? "").join("") ?? "";
    if (!text) throw new Error("Gemini returned empty content");

    const parsed = JSON.parse(text);
    return schema.parse(parsed);
  }

  private buildGeminiContents(prompt: ModelPrompt): { role: string; parts: { text: string }[] }[] {
    return prompt.messages.map((msg) => ({
      role: msg.role === "assistant" ? "model" : "user",
      parts: [{ text: msg.content }],
    }));
  }
}
