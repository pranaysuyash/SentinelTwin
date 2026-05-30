import type { BlindRegionResult } from "@sentineltwin/core";

export interface BlindSpotFingerprintSummary {
  fingerprint: string;
  signature: string;
  regionCount: number;
  criticalRegionCount: number;
  entryConnectedRegionCount: number;
  isolatedRegionCount: number;
  totalBlindAreaSqM: number;
  largestRegionAreaSqM: number;
  affectedZoneCount: number;
  severityCounts: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  classificationCounts: {
    entry_corridor: number;
    entry_connected: number;
    isolated: number;
  };
}

function fnv1a(input: string) {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

function toHexHash(input: string) {
  return fnv1a(input).toString(16).padStart(8, "0");
}

export function computeBlindSpotFingerprint(blindRegions: BlindRegionResult[]): BlindSpotFingerprintSummary {
  const sorted = [...blindRegions].sort((a, b) => {
    if (a.severity !== b.severity) {
      const severityOrder: Record<BlindRegionResult["severity"], number> = {
        critical: 0,
        high: 1,
        medium: 2,
        low: 3,
      };
      return severityOrder[a.severity] - severityOrder[b.severity];
    }
    if (a.classification !== b.classification) {
      const classificationOrder: Record<BlindRegionResult["classification"], number> = {
        entry_corridor: 0,
        entry_connected: 1,
        isolated: 2,
      };
      return classificationOrder[a.classification] - classificationOrder[b.classification];
    }
    return b.areaSqM - a.areaSqM;
  });

  const severityCounts = {
    critical: sorted.filter((region) => region.severity === "critical").length,
    high: sorted.filter((region) => region.severity === "high").length,
    medium: sorted.filter((region) => region.severity === "medium").length,
    low: sorted.filter((region) => region.severity === "low").length,
  };

  const classificationCounts = {
    entry_corridor: sorted.filter((region) => region.classification === "entry_corridor").length,
    entry_connected: sorted.filter((region) => region.classification === "entry_connected").length,
    isolated: sorted.filter((region) => region.classification === "isolated").length,
  };

  const regionCount = sorted.length;
  const criticalRegionCount = severityCounts.critical;
  const entryConnectedRegionCount = classificationCounts.entry_corridor + classificationCounts.entry_connected;
  const isolatedRegionCount = classificationCounts.isolated;
  const totalBlindAreaSqM = Number(sorted.reduce((sum, region) => sum + region.areaSqM, 0).toFixed(1));
  const largestRegionAreaSqM = Number((sorted[0]?.areaSqM ?? 0).toFixed(1));
  const affectedZoneIds = Array.from(new Set(sorted.flatMap((region) => region.affectedZoneIds))).sort();
  const affectedZoneCount = affectedZoneIds.length;
  const signature = [
    `regions:${regionCount}`,
    `critical:${criticalRegionCount}`,
    `entry:${entryConnectedRegionCount}`,
    `isolated:${isolatedRegionCount}`,
    `area:${totalBlindAreaSqM.toFixed(1)}`,
    `largest:${largestRegionAreaSqM.toFixed(1)}`,
    `zones:${affectedZoneIds.join("|") || "none"}`,
    `severity:${severityCounts.critical},${severityCounts.high},${severityCounts.medium},${severityCounts.low}`,
    `class:${classificationCounts.entry_corridor},${classificationCounts.entry_connected},${classificationCounts.isolated}`,
  ].join(";");
  const fingerprint = `BFP-${toHexHash(signature)}`;

  return {
    fingerprint,
    signature,
    regionCount,
    criticalRegionCount,
    entryConnectedRegionCount,
    isolatedRegionCount,
    totalBlindAreaSqM,
    largestRegionAreaSqM,
    affectedZoneCount,
    severityCounts,
    classificationCounts,
  };
}
