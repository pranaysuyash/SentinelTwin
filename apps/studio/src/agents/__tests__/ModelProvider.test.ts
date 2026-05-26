import { describe, it, expect } from "bun:test";

import { RateLimiter, TokenTracker, retryWithFallback } from "@/agents/providers/AgentConfig";

describe("RateLimiter", () => {
  it("allows requests within limit", () => {
    const limiter = new RateLimiter(5, 1000);
    for (let i = 0; i < 5; i++) {
      const result = limiter.tryAcquire(100);
      expect(result.allowed).toBe(true);
    }
  });

  it("blocks requests exceeding request limit", () => {
    const limiter = new RateLimiter(3, 10000);
    for (let i = 0; i < 3; i++) {
      limiter.tryAcquire(100);
    }
    const result = limiter.tryAcquire(100);
    expect(result.allowed).toBe(false);
    expect(result.retryAfterMs).toBeGreaterThan(0);
  });

  it("blocks requests exceeding token limit", () => {
    const limiter = new RateLimiter(10, 500);
    // First request with 400 tokens should be allowed
    let result = limiter.tryAcquire(400);
    expect(result.allowed).toBe(true);
    // Second request with 200 tokens should be denied (would exceed 500)
    result = limiter.tryAcquire(200);
    expect(result.allowed).toBe(false);
  });

  it("resets properly", () => {
    const limiter = new RateLimiter(1, 1000);
    limiter.tryAcquire(100);
    limiter.reset();
    const result = limiter.tryAcquire(100);
    expect(result.allowed).toBe(true);
  });
});

describe("TokenTracker", () => {
  it("tracks token usage correctly", () => {
    const tracker = new TokenTracker();
    tracker.track({
      modelName: "gpt-4o",
      providerName: "openai",
      timestamp: Date.now(),
      usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
    });

    const usage = tracker.getUsage();
    expect(usage.totalTokens).toBe(150);
    expect(usage.totalPromptTokens).toBe(100);
    expect(usage.totalCompletionTokens).toBe(50);
    expect(usage.callCount).toBe(1);
  });

  it("accumulates multiple calls", () => {
    const tracker = new TokenTracker();
    tracker.track({
      modelName: "gpt-4o",
      providerName: "openai",
      timestamp: Date.now(),
      usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
    });
    tracker.track({
      modelName: "gpt-4o-mini",
      providerName: "openai",
      timestamp: Date.now(),
      usage: { promptTokens: 50, completionTokens: 25, totalTokens: 75 },
    });

    const usage = tracker.getUsage();
    expect(usage.totalTokens).toBe(225);
    expect(usage.byModel["gpt-4o"]?.totalTokens).toBe(150);
    expect(usage.byModel["gpt-4o-mini"]?.totalTokens).toBe(75);
    expect(usage.byProvider["openai"]?.totalTokens).toBe(225);
  });

  it("resets correctly", () => {
    const tracker = new TokenTracker();
    tracker.track({
      modelName: "gpt-4o",
      providerName: "openai",
      timestamp: Date.now(),
      usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
    });
    tracker.reset();
    expect(tracker.getUsage().callCount).toBe(0);
    expect(tracker.getUsage().totalTokens).toBe(0);
  });
});

describe("retryWithFallback", () => {
  it("succeeds on first attempt", async () => {
    const fn = async () => "success";
    const result = await retryWithFallback(fn, { maxRetries: 3, timeoutMs: 1000 });
    expect(result).toBe("success");
  });

  it("retries on transient error and eventually succeeds", async () => {
    let attempts = 0;
    const fn = async () => {
      attempts++;
      if (attempts < 3) throw new Error("Service unavailable");
      return "success";
    };
    const result = await retryWithFallback(fn, { maxRetries: 3, timeoutMs: 1000 });
    expect(result).toBe("success");
    expect(attempts).toBe(3);
  });

  it("uses fallback after max retries", async () => {
    let attempts = 0;
    const fn = async () => {
      attempts++;
      throw new Error("Service unavailable");
    };
    const fallback = async () => "fallback result";
    const result = await retryWithFallback(fn, {
      maxRetries: 2,
      timeoutMs: 1000,
      fallback,
    });
    expect(result).toBe("fallback result");
    expect(attempts).toBe(3); // 2 retries + initial = 3 total
  });

  it("does not retry client errors (4xx)", async () => {
    const fn = async () => {
      throw new Error("401 Unauthorized");
    };
    await expect(
      retryWithFallback(fn, { maxRetries: 3, timeoutMs: 1000 }),
    ).rejects.toThrow("401 Unauthorized");
  });

  it("respects abort signal", async () => {
    const controller = new AbortController();
    controller.abort();
    const fn = async () => "success";
    await expect(
      retryWithFallback(fn, { maxRetries: 2, timeoutMs: 1000 }, controller.signal),
    ).rejects.toThrow();
  });

  it("throws on timeout", async () => {
    const fn = async () => {
      await new Promise((resolve) => setTimeout(resolve, 5000));
      return "too late";
    };
    await expect(
      retryWithFallback(fn, { maxRetries: 0, timeoutMs: 10 }),
    ).rejects.toThrow("timed out");
  });
});
