type AiRateLimitStage = "command_parse" | "counterfactual" | "report_generation" | "ai_draft";

type AiUsageRecord = {
  timestamp: number;
  stage: AiRateLimitStage;
  estimatedTokens: number;
};

type AiRateLimitDecision = {
  allowed: boolean;
  reason?: string;
  retryInMs?: number;
  remainingTokenBudget?: number;
};

type StageWindowPolicy = {
  maxRequests: number;
  windowMs: number;
};

const STAGE_POLICY: Record<AiRateLimitStage, StageWindowPolicy> = {
  command_parse: { maxRequests: 12, windowMs: 60_000 },
  counterfactual: { maxRequests: 8, windowMs: 60_000 },
  report_generation: { maxRequests: 5, windowMs: 60_000 },
  ai_draft: { maxRequests: 4, windowMs: 60_000 },
};

const TOKEN_WINDOW_MS = 60_000;
const MAX_TOKENS_PER_WINDOW = 40_000;

const STORAGE_KEY = "sentineltwin_ai_rate_limit_usage_v1";

function nowMs() {
  return Date.now();
}

function safeParseRecords(raw: string | null): AiUsageRecord[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((entry) => {
      if (!entry || typeof entry !== "object") return [];
      const candidate = entry as Partial<AiUsageRecord>;
      if (
        typeof candidate.timestamp !== "number"
        || (candidate.stage !== "command_parse"
          && candidate.stage !== "counterfactual"
          && candidate.stage !== "report_generation"
          && candidate.stage !== "ai_draft")
        || typeof candidate.estimatedTokens !== "number"
      ) {
        return [];
      }
      return [{
        timestamp: candidate.timestamp,
        stage: candidate.stage,
        estimatedTokens: Math.max(0, Math.round(candidate.estimatedTokens)),
      }];
    });
  } catch {
    return [];
  }
}

function prune(records: AiUsageRecord[], now: number): AiUsageRecord[] {
  const floor = now - Math.max(TOKEN_WINDOW_MS, ...Object.values(STAGE_POLICY).map((p) => p.windowMs));
  return records.filter((record) => record.timestamp >= floor);
}

function loadRecords(): AiUsageRecord[] {
  if (typeof window === "undefined") return [];
  const records = safeParseRecords(window.localStorage.getItem(STORAGE_KEY));
  return prune(records, nowMs());
}

function persistRecords(records: AiUsageRecord[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(records.slice(-200)));
  } catch {
    // Ignore storage quota errors.
  }
}

export function evaluateAiRateLimit(stage: AiRateLimitStage, estimatedTokens: number): AiRateLimitDecision {
  const now = nowMs();
  const records = loadRecords();
  const policy = STAGE_POLICY[stage];

  const stageWindowStart = now - policy.windowMs;
  const stageRecords = records.filter((record) => record.stage === stage && record.timestamp >= stageWindowStart);

  if (stageRecords.length >= policy.maxRequests) {
    const oldestInWindow = stageRecords[0]?.timestamp ?? now;
    const retryInMs = Math.max(0, oldestInWindow + policy.windowMs - now);
    return {
      allowed: false,
      reason: `Rate limit reached for ${stage.replace(/_/g, " ")}.`,
      retryInMs,
    };
  }

  const tokenWindowStart = now - TOKEN_WINDOW_MS;
  const tokenUsageInWindow = records
    .filter((record) => record.timestamp >= tokenWindowStart)
    .reduce((sum, record) => sum + record.estimatedTokens, 0);

  const nextTokenUsage = tokenUsageInWindow + Math.max(0, Math.round(estimatedTokens));
  if (nextTokenUsage > MAX_TOKENS_PER_WINDOW) {
    const tokenWindowRecords = records.filter((record) => record.timestamp >= tokenWindowStart);
    const oldestTokenRecord = tokenWindowRecords[0]?.timestamp ?? now;
    const retryInMs = Math.max(0, oldestTokenRecord + TOKEN_WINDOW_MS - now);
    return {
      allowed: false,
      reason: "Token budget exceeded for the rolling 60s window.",
      retryInMs,
      remainingTokenBudget: Math.max(0, MAX_TOKENS_PER_WINDOW - tokenUsageInWindow),
    };
  }

  return {
    allowed: true,
    remainingTokenBudget: Math.max(0, MAX_TOKENS_PER_WINDOW - nextTokenUsage),
  };
}

export function recordAiRateLimitUsage(stage: AiRateLimitStage, estimatedTokens: number) {
  const now = nowMs();
  const records = prune(loadRecords(), now);
  records.push({
    timestamp: now,
    stage,
    estimatedTokens: Math.max(0, Math.round(estimatedTokens)),
  });
  persistRecords(records);
}

export function formatRetryHint(retryInMs?: number) {
  if (!retryInMs || retryInMs <= 0) return "Try again shortly.";
  const seconds = Math.max(1, Math.ceil(retryInMs / 1000));
  return `Try again in ~${seconds}s.`;
}
