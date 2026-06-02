import type { CriticalZoneNode, SecurityScene } from "@sentineltwin/core";
import { qualityToScore } from "@sentineltwin/core";

export type CriticalZoneSelectionPolicy = "requiredQuality-first" | "priority-first" | "counter-first";

export type CriticalZoneSelectionOptions = {
  /**
   * Selection policy for ordering/precedence.
   * - requiredQuality-first: higher requiredQuality first, then priority
   * - priority-first: higher criticality priority first, then requiredQuality
   * - counter-first: prefer counter/cash target zones, otherwise fallback by requiredQuality-first
   */
  policy?: CriticalZoneSelectionPolicy;

  /** Optional explicit signal overrides for counter intent detection. */
  counterTargetTypes?: readonly CriticalZoneNode["targetType"][];

  /** Optional label signals for counter intent detection. */
  counterLabelPatterns?: readonly RegExp[];
};

export type CriticalZoneSelectionDecision = {
  zoneId: string | null;
  zoneLabel: string | null;
  policy: CriticalZoneSelectionPolicy;
  candidateCount: number;
  counterCandidateCount: number;
  selectedAsCounter: boolean;
  fallbackApplied: "none" | "no-counter-match" | "no-candidates";
  rationale: string;
};

const PRIORITY_WEIGHT: Record<CriticalZoneNode["priority"], number> = {
  low: 0,
  medium: 1,
  high: 2,
  critical: 3,
} as const;

const COUNTER_MATCH_TARGET_TYPES: readonly CriticalZoneNode["targetType"][] = ["cash_counter_activity"] as const;
const COUNTER_LABEL_PATTERNS: readonly RegExp[] = [
  /\bcounter\b/i,
  /\bcash\b/i,
  /\bcheckout\b/i,
  /\btill\b/i,
  /\bpos\b/i,
  /\bpoint of sale\b/i,
  /\bregister\b/i,
];

function normalizeOptions(options: CriticalZoneSelectionOptions = {}): Required<CriticalZoneSelectionOptions> {
  const policy = options.policy ?? "requiredQuality-first";
  const counterTargetTypes = options.counterTargetTypes ?? [...COUNTER_MATCH_TARGET_TYPES];
  const counterLabelPatterns = options.counterLabelPatterns?.length
    ? options.counterLabelPatterns
    : COUNTER_LABEL_PATTERNS;

  return {
    policy,
    counterTargetTypes,
    counterLabelPatterns,
  };
}

function isCounterCriticalZone(zone: CriticalZoneNode, options: Required<CriticalZoneSelectionOptions>): boolean {
  const targetTypes = new Set<CriticalZoneNode["targetType"]>(options.counterTargetTypes);
  if (targetTypes.has(zone.targetType)) return true;

  const haystack = `${zone.label} ${zone.id}`.toLowerCase();
  return options.counterLabelPatterns.some((pattern) => pattern.test(haystack));
}

function getSortPolicy(policy: "requiredQuality-first" | "priority-first") {
  if (policy === "priority-first") {
    return (a: CriticalZoneNode, b: CriticalZoneNode) => {
      const priorityDelta = PRIORITY_WEIGHT[b.priority] - PRIORITY_WEIGHT[a.priority];
      if (priorityDelta !== 0) return priorityDelta;
      const qualityDelta = qualityToScore(b.requiredQuality) - qualityToScore(a.requiredQuality);
      if (qualityDelta !== 0) return qualityDelta;
      const labelDelta = a.label.localeCompare(b.label);
      if (labelDelta !== 0) return labelDelta;
      return a.id.localeCompare(b.id);
    };
  }

  return (a: CriticalZoneNode, b: CriticalZoneNode) => {
    const qualityDelta = qualityToScore(b.requiredQuality) - qualityToScore(a.requiredQuality);
    if (qualityDelta !== 0) return qualityDelta;
    const priorityDelta = PRIORITY_WEIGHT[b.priority] - PRIORITY_WEIGHT[a.priority];
    if (priorityDelta !== 0) return priorityDelta;
    const labelDelta = a.label.localeCompare(b.label);
    if (labelDelta !== 0) return labelDelta;
    return a.id.localeCompare(b.id);
  };
}

function sortCriticalZonesByPolicy(zones: CriticalZoneNode[], policy: "requiredQuality-first" | "priority-first") {
  return [...zones].sort(getSortPolicy(policy));
}

function pickZoneByPolicy(zones: CriticalZoneNode[], policy: "requiredQuality-first" | "priority-first"): CriticalZoneNode | null {
  if (zones.length === 0) return null;
  return sortCriticalZonesByPolicy(zones, policy)[0] ?? null;
}

function classifyCandidateZones(scene: SecurityScene, options: Required<CriticalZoneSelectionOptions>) {
  const all = scene.criticalZones ?? [];
  const counter = all.filter((zone) => isCounterCriticalZone(zone, options));
  return { all, counter };
}

function selectWithDecision(scene: SecurityScene, options: CriticalZoneSelectionOptions = {}): {
  decision: CriticalZoneSelectionDecision;
  zone: CriticalZoneNode | null;
} {
  const normalized = normalizeOptions(options);
  const { all, counter } = classifyCandidateZones(scene, normalized);

  if (all.length === 0) {
    return {
      zone: null,
      decision: {
        zoneId: null,
        zoneLabel: null,
        policy: normalized.policy,
        candidateCount: 0,
        counterCandidateCount: 0,
        selectedAsCounter: false,
        fallbackApplied: "no-candidates",
        rationale: "No critical zones were available for selection.",
      },
    };
  }

  if (normalized.policy === "counter-first" && counter.length > 0) {
    const selected = pickZoneByPolicy(counter, "requiredQuality-first");
    return {
      zone: selected,
      decision: {
        zoneId: selected?.id ?? null,
        zoneLabel: selected?.label ?? null,
        policy: normalized.policy,
        candidateCount: all.length,
        counterCandidateCount: counter.length,
        selectedAsCounter: selected !== null,
        fallbackApplied: "none",
        rationale: "Counter-first policy matched dedicated counter target intent first.",
      },
    };
  }

  const rankPolicy: "requiredQuality-first" | "priority-first" =
    normalized.policy === "priority-first" ? "priority-first" : "requiredQuality-first";
  const selected = pickZoneByPolicy(counter.length > 0 ? counter : all, rankPolicy);
  return {
    zone: selected,
    decision: {
      zoneId: selected?.id ?? null,
      zoneLabel: selected?.label ?? null,
      policy: normalized.policy,
      candidateCount: all.length,
      counterCandidateCount: counter.length,
      selectedAsCounter: selected !== null && counter.includes(selected),
      fallbackApplied: normalized.policy === "counter-first" && counter.length === 0 ? "no-counter-match" : "none",
      rationale: selected !== null
        ? "Selection followed policy-ranked candidate set."
        : "No matching counter-target zone found and no fallback zone existed.",
    },
  };
}

export function selectHighestPriorityCriticalZone(
  scene: SecurityScene,
  options: CriticalZoneSelectionOptions = {},
): CriticalZoneNode | null {
  const normalized = normalizeOptions(options);
  const rankingPolicy = normalized.policy === "priority-first" ? "priority-first" : "requiredQuality-first";
  return pickZoneByPolicy(scene.criticalZones ?? [], rankingPolicy);
}

export function selectCounterCriticalZone(
  scene: SecurityScene,
  options: CriticalZoneSelectionOptions = {},
): CriticalZoneNode | null {
  return selectWithDecision(scene, { ...options, policy: options.policy ?? "counter-first" }).zone;
}

export function selectAdversarialTargetZone(
  scene: SecurityScene,
  options: CriticalZoneSelectionOptions = {},
): CriticalZoneNode | null {
  return selectCounterCriticalZone(scene, options);
}

export function explainAdversarialTargetSelection(
  scene: SecurityScene,
  options: CriticalZoneSelectionOptions = {},
): CriticalZoneSelectionDecision {
  return selectWithDecision(scene, options).decision;
}
