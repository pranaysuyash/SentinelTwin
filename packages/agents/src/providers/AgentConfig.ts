import type { ModelProvider } from "./ModelProvider";

export interface AgentConfig {
  provider: ModelProvider;
  fallbackProvider?: ModelProvider;
  maxRetries: number;
  timeoutMs: number;
  maxRequestsPerMinute: number;
  maxTokensPerMinute: number;
  modelName: string;
  temperature: number;
}

export const DEFAULT_AGENT_CONFIG: Omit<AgentConfig, "provider"> = {
  maxRetries: 3,
  timeoutMs: 30000,
  maxRequestsPerMinute: 60,
  maxTokensPerMinute: 100000,
  modelName: "gpt-4o",
  temperature: 0.1,
};

export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface TokenTrackerEntry {
  modelName: string;
  providerName: string;
  timestamp: number;
  usage: TokenUsage;
}

export class TokenTracker {
  private entries: TokenTrackerEntry[] = [];

  track(entry: TokenTrackerEntry): void {
    this.entries.push(entry);
    if (this.entries.length > 1000) {
      this.entries = this.entries.slice(-500);
    }
  }

  getUsage(): {
    totalPromptTokens: number;
    totalCompletionTokens: number;
    totalTokens: number;
    byModel: Record<string, TokenUsage>;
    byProvider: Record<string, TokenUsage>;
    callCount: number;
  } {
    const totals = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };
    const byModel: Record<string, TokenUsage> = {};
    const byProvider: Record<string, TokenUsage> = {};

    for (const entry of this.entries) {
      totals.promptTokens += entry.usage.promptTokens;
      totals.completionTokens += entry.usage.completionTokens;
      totals.totalTokens += entry.usage.totalTokens;

      byModel[entry.modelName] = byModel[entry.modelName] ?? { promptTokens: 0, completionTokens: 0, totalTokens: 0 };
      byModel[entry.modelName].promptTokens += entry.usage.promptTokens;
      byModel[entry.modelName].completionTokens += entry.usage.completionTokens;
      byModel[entry.modelName].totalTokens += entry.usage.totalTokens;

      byProvider[entry.providerName] = byProvider[entry.providerName] ?? { promptTokens: 0, completionTokens: 0, totalTokens: 0 };
      byProvider[entry.providerName].promptTokens += entry.usage.promptTokens;
      byProvider[entry.providerName].completionTokens += entry.usage.completionTokens;
      byProvider[entry.providerName].totalTokens += entry.usage.totalTokens;
    }

    return {
      totalPromptTokens: totals.promptTokens,
      totalCompletionTokens: totals.completionTokens,
      totalTokens: totals.totalTokens,
      byModel,
      byProvider,
      callCount: this.entries.length,
    };
  }

  reset(): void {
    this.entries = [];
  }
}

export const globalTokenTracker = new TokenTracker();

interface SlidingWindowEntry {
  timestamp: number;
  tokens: number;
}

export class RateLimiter {
  private windowMs: number;
  private maxRequests: number;
  private maxTokens: number;
  private entries: SlidingWindowEntry[] = [];

  constructor(maxRequests: number, maxTokens: number, windowMs = 60_000) {
    this.maxRequests = maxRequests;
    this.maxTokens = maxTokens;
    this.windowMs = windowMs;
  }

  tryAcquire(tokens: number): { allowed: boolean; retryAfterMs: number } {
    const now = Date.now();
    const cutoff = now - this.windowMs;

    this.entries = this.entries.filter((e) => e.timestamp > cutoff);

    const currentRequests = this.entries.length;
    const currentTokens = this.entries.reduce((sum, e) => sum + e.tokens, 0);

    if (currentRequests >= this.maxRequests) {
      const oldest = this.entries[0];
      const retryAfterMs = oldest ? oldest.timestamp + this.windowMs - now : this.windowMs;
      return { allowed: false, retryAfterMs: Math.max(retryAfterMs, 100) };
    }

    if (currentTokens + tokens > this.maxTokens) {
      return { allowed: false, retryAfterMs: 5000 };
    }

    this.entries.push({ timestamp: now, tokens });
    return { allowed: true, retryAfterMs: 0 };
  }

  reset(): void {
    this.entries = [];
  }
}

export async function retryWithFallback<T>(
  fn: (signal?: AbortSignal) => Promise<T>,
  config: { maxRetries: number; timeoutMs: number; fallback?: () => Promise<T> },
  signal?: AbortSignal,
): Promise<T> {
  if (signal?.aborted) {
    throw new DOMException("The operation was aborted", "AbortError");
  }

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
    try {
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`Request timed out after ${config.timeoutMs}ms`)), config.timeoutMs),
      );
      return await Promise.race([fn(signal), timeoutPromise]);
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));

      if (isClientError(lastError)) throw lastError;

      if (signal?.aborted) throw lastError;

      if (attempt === config.maxRetries) {
        if (config.fallback) {
          return config.fallback();
        }
        throw lastError;
      }

      const delay = Math.min(1000 * 2 ** attempt + Math.random() * 500, 15000);
      await sleep(delay);
    }
  }

  throw lastError ?? new Error("Retry failed");
}

function isClientError(error: Error): boolean {
  return (
    error.message.includes("401") ||
    error.message.includes("403") ||
    error.message.includes("404") ||
    error.message.includes("400") ||
    error.message.includes("invalid_request_error")
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
