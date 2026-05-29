import { z } from "zod";

import { geometryValiditySchema, reviewStatusSchema, type SecurityScene } from "@/schema/security-scene";

type ReviewStatus = z.infer<typeof reviewStatusSchema>;
type GeometryValidity = z.infer<typeof geometryValiditySchema>;

export type SceneTruthLadderSummary = {
  nodeCount: number;
  reviewedNodeCount: number;
  verifiedNodeCount: number;
  sourceTraceCount: number;
  suspectGeometryCount: number;
  invalidGeometryCount: number;
  reviewStatusCounts: Record<ReviewStatus, number>;
  geometryValidityCounts: Record<GeometryValidity, number>;
  sourceCounts: Record<string, number>;
  reviewedCoveragePct: number;
  sourceTraceCoveragePct: number;
  geometryValidityCoveragePct: number;
  summary: string;
};

const REVIEW_STATUSES: ReviewStatus[] = ["unreviewed", "accepted", "corrected", "calibrated", "verified"];
const GEOMETRY_STATUSES: GeometryValidity[] = ["valid", "suspect", "invalid"];

function collectTruthNodes(scene: SecurityScene) {
  return [
    ...scene.walls,
    ...scene.doors,
    ...scene.windows,
    ...scene.cameras,
    ...scene.securityLights,
    ...scene.obstructions,
    ...scene.criticalZones,
    ...scene.privacyZones,
    ...scene.entryPoints,
    ...scene.paths,
    ...scene.sensors,
  ];
}

export function summarizeSceneTruthLadder(scene: SecurityScene): SceneTruthLadderSummary {
  const nodes = collectTruthNodes(scene);
  const reviewStatusCounts = Object.fromEntries(REVIEW_STATUSES.map((status) => [status, 0])) as Record<ReviewStatus, number>;
  const geometryValidityCounts = Object.fromEntries(GEOMETRY_STATUSES.map((status) => [status, 0])) as Record<GeometryValidity, number>;
  const sourceCounts: Record<string, number> = {};

  let sourceTraceCount = 0;

  for (const node of nodes) {
    reviewStatusCounts[node.reviewStatus] += 1;
    geometryValidityCounts[node.geometryValidity] += 1;
    sourceCounts[node.source] = (sourceCounts[node.source] ?? 0) + 1;
    if (node.sourceTrace.trim().length > 0) sourceTraceCount += 1;
  }

  const reviewedNodeCount =
    reviewStatusCounts.accepted
    + reviewStatusCounts.corrected
    + reviewStatusCounts.calibrated
    + reviewStatusCounts.verified;

  const verifiedNodeCount = reviewStatusCounts.verified;
  const suspectGeometryCount = geometryValidityCounts.suspect;
  const invalidGeometryCount = geometryValidityCounts.invalid;
  const nodeCount = nodes.length;
  const reviewedCoveragePct = nodeCount > 0 ? (reviewedNodeCount / nodeCount) * 100 : 0;
  const sourceTraceCoveragePct = nodeCount > 0 ? (sourceTraceCount / nodeCount) * 100 : 0;
  const geometryValidityCoveragePct = nodeCount > 0 ? (geometryValidityCounts.valid / nodeCount) * 100 : 0;
  const sourceLabel = Object.entries(sourceCounts).sort((left, right) => right[1] - left[1])[0]?.[0] ?? "manual";

  const summary = `${nodeCount} nodes · ${reviewedNodeCount} reviewed · ${verifiedNodeCount} verified · ${sourceTraceCount} traced · ${suspectGeometryCount} suspect geometry${invalidGeometryCount > 0 ? ` · ${invalidGeometryCount} invalid` : ""} · dominant source ${sourceLabel}`;

  return {
    nodeCount,
    reviewedNodeCount,
    verifiedNodeCount,
    sourceTraceCount,
    suspectGeometryCount,
    invalidGeometryCount,
    reviewStatusCounts,
    geometryValidityCounts,
    sourceCounts,
    reviewedCoveragePct,
    sourceTraceCoveragePct,
    geometryValidityCoveragePct,
    summary,
  };
}
