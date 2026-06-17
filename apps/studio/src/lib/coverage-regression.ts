import type { SimulationResult } from "@/schema/security-scene";
import { buildResilience, buildZoneStatus } from "@/lib/security-analytics";

/**
 * "Coverage CI" — comparative analytics over the deterministic engine output.
 *
 * Pure derivation: compares the current simulation result against a baseline
 * (typically the most recently saved snapshot's simulation), and reports
 * regressions the way a CI pipeline reports test regressions — pass/warn/fail
 * checks with explicit before/after values. No new computation: every number
 * here is read from existing `SimulationResult` fields plus the same
 * `buildZoneStatus`/`buildResilience` helpers the analytics dashboard uses.
 */

export type RegressionStatus = "pass" | "warn" | "fail";

export interface RegressionCheck {
  id: string;
  label: string;
  status: RegressionStatus;
  currentValue: string;
  baselineValue: string;
  deltaLabel: string;
}

export interface CoverageRegressionReport {
  hasBaseline: boolean;
  baselineLabel: string | null;
  baselineTimestamp: number | null;
  checks: RegressionCheck[];
  overallStatus: RegressionStatus;
}

const STATUS_RANK: Record<RegressionStatus, number> = { pass: 0, warn: 1, fail: 2 };

function worse(a: RegressionStatus, b: RegressionStatus): RegressionStatus {
  return STATUS_RANK[b] > STATUS_RANK[a] ? b : a;
}

function pctDeltaLabel(current: number, baseline: number, suffix = "%"): string {
  const delta = current - baseline;
  const sign = delta >= 0 ? "+" : "";
  return `${sign}${delta.toFixed(1)}${suffix}`;
}

function statusForDrop(deltaPct: number, warnThreshold: number, failThreshold: number): RegressionStatus {
  if (deltaPct <= -failThreshold) return "fail";
  if (deltaPct <= -warnThreshold) return "warn";
  return "pass";
}

function statusForRise(deltaPct: number, warnThreshold: number, failThreshold: number): RegressionStatus {
  if (deltaPct >= failThreshold) return "fail";
  if (deltaPct >= warnThreshold) return "warn";
  return "pass";
}

/**
 * Builds a Coverage CI report comparing `current` against `baseline`.
 * If `baseline` is null (no prior simulated snapshot exists), returns an
 * empty-but-honest report with `hasBaseline: false` and no checks.
 */
export function buildCoverageRegressionReport(
  current: SimulationResult,
  baseline: SimulationResult | null,
  baselineMeta: { label: string; timestamp: number } | null,
): CoverageRegressionReport {
  if (!baseline) {
    return {
      hasBaseline: false,
      baselineLabel: null,
      baselineTimestamp: null,
      checks: [],
      overallStatus: "pass",
    };
  }

  const checks: RegressionCheck[] = [];

  // Overall walkable coverage
  const coverageDelta = current.totalCoveragePct - baseline.totalCoveragePct;
  checks.push({
    id: "total_coverage",
    label: "Walkable Coverage",
    status: statusForDrop(coverageDelta, 1, 5),
    currentValue: `${current.totalCoveragePct.toFixed(1)}%`,
    baselineValue: `${baseline.totalCoveragePct.toFixed(1)}%`,
    deltaLabel: pctDeltaLabel(current.totalCoveragePct, baseline.totalCoveragePct),
  });

  // Blind spot area
  const blindDelta = current.blindspotPct - baseline.blindspotPct;
  checks.push({
    id: "blindspot",
    label: "Blind Area",
    status: statusForRise(blindDelta, 1, 5),
    currentValue: `${current.blindspotPct.toFixed(1)}%`,
    baselineValue: `${baseline.blindspotPct.toFixed(1)}%`,
    deltaLabel: pctDeltaLabel(current.blindspotPct, baseline.blindspotPct),
  });

  // Critical zone pass rate
  const currentZones = buildZoneStatus(current);
  const baselineZones = buildZoneStatus(baseline);
  if (currentZones.total > 0 || baselineZones.total > 0) {
    const zoneStatus: RegressionStatus =
      currentZones.fail > baselineZones.fail
        ? "fail"
        : currentZones.pass < baselineZones.pass
          ? "warn"
          : "pass";
    checks.push({
      id: "critical_zones",
      label: "Critical Zones Passing",
      status: zoneStatus,
      currentValue: `${currentZones.pass}/${currentZones.total}`,
      baselineValue: `${baselineZones.pass}/${baselineZones.total}`,
      deltaLabel: `${currentZones.pass - baselineZones.pass >= 0 ? "+" : ""}${currentZones.pass - baselineZones.pass}`,
    });
  }

  // Open issues, weighted by severity
  const currentCritical = current.issues.filter((i) => i.severity === "critical").length;
  const baselineCritical = baseline.issues.filter((i) => i.severity === "critical").length;
  const currentHigh = current.issues.filter((i) => i.severity === "high").length;
  const baselineHigh = baseline.issues.filter((i) => i.severity === "high").length;
  const issueStatus: RegressionStatus =
    currentCritical > baselineCritical
      ? "fail"
      : currentHigh > baselineHigh || current.issues.length > baseline.issues.length
        ? "warn"
        : "pass";
  checks.push({
    id: "open_issues",
    label: "Open Issues",
    status: issueStatus,
    currentValue: `${current.issues.length} (${currentCritical} critical)`,
    baselineValue: `${baseline.issues.length} (${baselineCritical} critical)`,
    deltaLabel: `${current.issues.length - baseline.issues.length >= 0 ? "+" : ""}${current.issues.length - baseline.issues.length}`,
  });

  // Resilience (k-robustness)
  const currentResilience = buildResilience(current);
  const baselineResilience = buildResilience(baseline);
  if (currentResilience.kRobustness !== null || baselineResilience.kRobustness !== null) {
    const currentK = currentResilience.kRobustness ?? 0;
    const baselineK = baselineResilience.kRobustness ?? 0;
    const resilienceStatus: RegressionStatus =
      currentResilience.isRobust === false && baselineResilience.isRobust === true
        ? "fail"
        : currentK < baselineK
          ? "warn"
          : "pass";
    checks.push({
      id: "k_robustness",
      label: "K-Robustness",
      status: resilienceStatus,
      currentValue: currentResilience.kRobustness === null ? "Not computed" : `K=${currentResilience.kRobustness}`,
      baselineValue: baselineResilience.kRobustness === null ? "Not computed" : `K=${baselineResilience.kRobustness}`,
      deltaLabel: `${currentK - baselineK >= 0 ? "+" : ""}${currentK - baselineK}`,
    });
  }

  const overallStatus = checks.reduce<RegressionStatus>((acc, check) => worse(acc, check.status), "pass");

  return {
    hasBaseline: true,
    baselineLabel: baselineMeta?.label ?? null,
    baselineTimestamp: baselineMeta?.timestamp ?? null,
    checks,
    overallStatus,
  };
}
