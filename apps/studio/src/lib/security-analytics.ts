import type {
  DoriQuality,
  SceneSnapshot,
  SecurityScene,
  SimulationResult,
  TemporalSecurityProfile,
} from "@/schema/security-scene";

import type { OperationalEvidenceEvent } from "@/lib/operational-evidence";

/**
 * Security Analytics model — a pure derivation over the canonical store state
 * (scene + simulation + temporal profile + evidence ledger + snapshots).
 *
 * This module must stay free of React/DOM imports so the analytics dashboard
 * stays testable headlessly and the model can later move into a worker or be
 * exported as part of a report artifact without UI coupling.
 *
 * It introduces no parallel truth: every number here is read from the
 * deterministic simulation result, the temporal engine output, or the
 * operational evidence ledger.
 */

export type AnalyticsTone = "good" | "warn" | "bad" | "neutral";

export interface AnalyticsKpi {
  id: string;
  label: string;
  value: string;
  detail: string;
  tone: AnalyticsTone;
  /** Navigation hint for the dashboard UI: which canonical surface explains this number. */
  drillTarget: { kind: "bottom_tab"; tab: string } | { kind: "view_mode"; mode: string };
}

export interface DoriDistributionBand {
  band: Exclude<DoriQuality, "none"> | "blind";
  label: string;
  pct: number;
}

export interface IssueSeverityCount {
  severity: "critical" | "high" | "medium" | "low";
  count: number;
}

export interface CameraLeaderboardEntry {
  cameraId: string;
  name: string;
  coveragePct: number;
  zonesCovered: number;
  zonesFailed: number;
  status: string;
}

export interface OcclusionOffender {
  obstructionId: string;
  label: string;
  /** Sum of blame fractions across affected zones (higher = worse). */
  totalBlame: number;
  affectedZoneCount: number;
  worstZoneLabel: string | null;
}

export interface TemporalSeriesPoint {
  hour: number;
  minute: number;
  coveragePct: number;
  /** Crowd-adjusted effective coverage at this hour. Only present when crowdProfiles are configured. */
  effectiveCoveragePct?: number;
  zonePassRate: number;
  stateLabel: string;
}

export interface TemporalAnalytics {
  series: TemporalSeriesPoint[];
  vulnerabilityCounts: { high: number; medium: number; low: number };
  anomalyCount: number;
  worstCoverageDropPct: number | null;
  worstPoint: TemporalSeriesPoint | null;
  bestPoint: TemporalSeriesPoint | null;
}

export interface CoverageTrendPoint {
  label: string;
  timestamp: number;
  coveragePct: number;
  isCurrent: boolean;
}

export interface EvidenceActivitySummary {
  totalEvents: number;
  countsByKind: { kind: string; count: number }[];
  lastEventTitle: string | null;
  lastEventTimestamp: number | null;
}

export type LiveHealthStatus = "healthy" | "degraded" | "fault";

export interface LiveHealthEntry {
  nodeId: string;
  kind: "sensor" | "camera";
  label: string;
  status: LiveHealthStatus;
  lastEventTitle: string;
  lastEventTimestamp: number;
}

export interface LiveOperationalHealthSummary {
  trackedSensors: number;
  trackedCameras: number;
  faultedSensors: number;
  degradedCameras: number;
  /** Non-healthy entries only, most recent first. */
  alerts: LiveHealthEntry[];
}

export interface ResilienceSummary {
  kRobustness: number | null;
  totalCameras: number;
  isRobust: boolean | null;
  criticalSetCount: number;
  meanFragility: number | null;
  fragileCellPct: number | null;
}

export interface PlacementSuggestionSummary {
  estimatedCoverageDeltaPct: number;
  estimatedCriticalZoneGain: number;
  mountType: "wall" | "ceiling";
  improvedCriticalZones: string[];
}

export interface BlindSpotSummary {
  regionCount: number;
  criticalRegionCount: number;
  totalBlindAreaSqM: number;
  largestRegionAreaSqM: number;
}

export interface SecurityAnalyticsModel {
  hasSimulation: boolean;
  computedAt: number | null;
  sceneName: string;
  kpis: AnalyticsKpi[];
  doriDistribution: DoriDistributionBand[];
  issueBreakdown: IssueSeverityCount[];
  zoneStatus: { pass: number; partial: number; fail: number; total: number; passRatePct: number };
  cameraLeaderboard: CameraLeaderboardEntry[];
  occlusionOffenders: OcclusionOffender[];
  resilience: ResilienceSummary;
  temporal: TemporalAnalytics | null;
  coverageTrend: CoverageTrendPoint[];
  evidenceActivity: EvidenceActivitySummary;
  liveHealth: LiveOperationalHealthSummary;
  placementSuggestion: PlacementSuggestionSummary | null;
  blindSpots: BlindSpotSummary | null;
}

export interface SecurityAnalyticsInput {
  scene: SecurityScene;
  simulationResult: SimulationResult | null;
  temporalProfile: TemporalSecurityProfile | null;
  evidenceEvents: OperationalEvidenceEvent[];
  snapshots: SceneSnapshot[];
}

const MAX_LEADERBOARD_ENTRIES = 8;
const MAX_OCCLUSION_OFFENDERS = 6;
const MAX_EVIDENCE_KINDS = 6;
const MAX_TREND_POINTS = 12;

function coverageTone(pct: number): AnalyticsTone {
  if (pct >= 85) return "good";
  if (pct >= 60) return "warn";
  return "bad";
}

function issueTone(criticalCount: number, highCount: number): AnalyticsTone {
  if (criticalCount > 0) return "bad";
  if (highCount > 0) return "warn";
  return "good";
}

function buildKpis(
  result: SimulationResult,
  zoneStatus: SecurityAnalyticsModel["zoneStatus"],
  resilience: ResilienceSummary,
  temporal: TemporalAnalytics | null,
): AnalyticsKpi[] {
  const criticalIssues = result.issues.filter((issue) => issue.severity === "critical").length;
  const highIssues = result.issues.filter((issue) => issue.severity === "high").length;

  const kpis: AnalyticsKpi[] = [
    {
      id: "coverage",
      label: "Walkable Coverage",
      value: `${result.totalCoveragePct.toFixed(1)}%`,
      detail: `${result.blindspotPct.toFixed(1)}% blind`,
      tone: coverageTone(result.totalCoveragePct),
      drillTarget: { kind: "bottom_tab", tab: "metrics" },
    },
    {
      id: "zone_pass",
      label: "Critical Zones",
      value: `${zoneStatus.pass}/${zoneStatus.total}`,
      detail: zoneStatus.total === 0 ? "No zones defined" : `${zoneStatus.passRatePct.toFixed(0)}% pass`,
      tone: zoneStatus.total === 0 ? "neutral" : zoneStatus.fail > 0 ? "bad" : zoneStatus.partial > 0 ? "warn" : "good",
      drillTarget: { kind: "bottom_tab", tab: "issues" },
    },
    {
      id: "identification",
      label: "Identification Area",
      value: `${result.identificationAreaPct.toFixed(1)}%`,
      detail: `Recognition ${result.recognitionAreaPct.toFixed(1)}%`,
      tone: result.identificationAreaPct >= 20 ? "good" : result.identificationAreaPct >= 8 ? "warn" : "neutral",
      drillTarget: { kind: "bottom_tab", tab: "metrics" },
    },
    {
      id: "open_issues",
      label: "Open Issues",
      value: `${result.issues.length}`,
      detail: `${criticalIssues} critical · ${highIssues} high`,
      tone: issueTone(criticalIssues, highIssues),
      drillTarget: { kind: "bottom_tab", tab: "issues" },
    },
  ];

  if (resilience.kRobustness !== null) {
    kpis.push({
      id: "k_robustness",
      label: "K-Robustness",
      value: `K=${resilience.kRobustness}`,
      detail: resilience.isRobust ? "Survives single failure" : `${resilience.criticalSetCount} critical failure set${resilience.criticalSetCount === 1 ? "" : "s"}`,
      tone: resilience.isRobust ? "good" : "bad",
      drillTarget: { kind: "bottom_tab", tab: "redundancy" },
    });
  }

  if (resilience.fragileCellPct !== null) {
    kpis.push({
      id: "fragility",
      label: "Coverage Fragility",
      value: `${resilience.fragileCellPct.toFixed(1)}%`,
      detail: "Cells near quality threshold",
      tone: resilience.fragileCellPct >= 30 ? "bad" : resilience.fragileCellPct >= 15 ? "warn" : "good",
      drillTarget: { kind: "bottom_tab", tab: "novel" },
    });
  }

  if (temporal) {
    const highWindows = temporal.vulnerabilityCounts.high;
    kpis.push({
      id: "vulnerability_windows",
      label: "24h Vulnerability Windows",
      value: `${highWindows + temporal.vulnerabilityCounts.medium + temporal.vulnerabilityCounts.low}`,
      detail: `${highWindows} high severity`,
      tone: highWindows > 0 ? "bad" : temporal.vulnerabilityCounts.medium > 0 ? "warn" : "good",
      drillTarget: { kind: "bottom_tab", tab: "temporal" },
    });
  }

  return kpis;
}

function buildDoriDistribution(result: SimulationResult): DoriDistributionBand[] {
  const byQuality = result.coverageByQuality;
  const covered = byQuality.detection + byQuality.observation + byQuality.recognition + byQuality.identification;
  const blind = Math.max(0, 100 - covered);
  return [
    { band: "identification", label: "Identification", pct: byQuality.identification },
    { band: "recognition", label: "Recognition", pct: byQuality.recognition },
    { band: "observation", label: "Observation", pct: byQuality.observation },
    { band: "detection", label: "Detection", pct: byQuality.detection },
    { band: "blind", label: "Blind", pct: blind },
  ];
}

export function buildZoneStatus(result: SimulationResult): SecurityAnalyticsModel["zoneStatus"] {
  let pass = 0;
  let partial = 0;
  let fail = 0;
  for (const zone of result.criticalZoneResults) {
    if (zone.status === "pass") pass += 1;
    else if (zone.status === "partial") partial += 1;
    else fail += 1;
  }
  const total = result.criticalZoneResults.length;
  return {
    pass,
    partial,
    fail,
    total,
    passRatePct: total === 0 ? 0 : (pass / total) * 100,
  };
}

function buildIssueBreakdown(result: SimulationResult): IssueSeverityCount[] {
  const severities: IssueSeverityCount["severity"][] = ["critical", "high", "medium", "low"];
  return severities.map((severity) => ({
    severity,
    count: result.issues.filter((issue) => issue.severity === severity).length,
  }));
}

function buildCameraLeaderboard(scene: SecurityScene, result: SimulationResult): CameraLeaderboardEntry[] {
  const nameById = new Map(scene.cameras.map((camera) => [camera.id, camera.name] as const));
  const statusById = new Map(scene.cameras.map((camera) => [camera.id, camera.status] as const));
  return [...result.cameraResults]
    .sort((a, b) => b.coveragePct - a.coveragePct)
    .slice(0, MAX_LEADERBOARD_ENTRIES)
    .map((camera) => ({
      cameraId: camera.cameraId,
      name: nameById.get(camera.cameraId) ?? camera.cameraId,
      coveragePct: camera.coveragePct,
      zonesCovered: camera.criticalZonesCovered.length,
      zonesFailed: camera.criticalZonesFailed.length,
      status: statusById.get(camera.cameraId) ?? "unknown",
    }));
}

function buildOcclusionOffenders(result: SimulationResult): OcclusionOffender[] {
  const byObstruction = new Map<string, OcclusionOffender>();
  const maxBlameByObstruction = new Map<string, number>();
  for (const zone of result.occlusionBlame ?? []) {
    for (const obstruction of zone.obstructions) {
      const existing = byObstruction.get(obstruction.obstructionId);
      const previousMax = maxBlameByObstruction.get(obstruction.obstructionId) ?? -1;
      if (existing) {
        existing.totalBlame += obstruction.blameFraction;
        existing.affectedZoneCount += 1;
        if (obstruction.blameFraction > previousMax) {
          existing.worstZoneLabel = zone.zoneLabel;
          maxBlameByObstruction.set(obstruction.obstructionId, obstruction.blameFraction);
        }
      } else {
        byObstruction.set(obstruction.obstructionId, {
          obstructionId: obstruction.obstructionId,
          label: obstruction.label,
          totalBlame: obstruction.blameFraction,
          affectedZoneCount: 1,
          worstZoneLabel: zone.zoneLabel,
        });
        maxBlameByObstruction.set(obstruction.obstructionId, obstruction.blameFraction);
      }
    }
  }
  return [...byObstruction.values()]
    .sort((a, b) => b.totalBlame - a.totalBlame)
    .slice(0, MAX_OCCLUSION_OFFENDERS);
}

export function buildResilience(result: SimulationResult): ResilienceSummary {
  const fragility = result.fragilitySummary ?? null;
  const robustness = result.kRobustness ?? null;
  return {
    kRobustness: robustness ? robustness.kRobustness : null,
    totalCameras: robustness ? robustness.totalCameras : result.cameraResults.length,
    isRobust: robustness ? robustness.isRobust : null,
    criticalSetCount: robustness ? robustness.criticalSets.length : 0,
    meanFragility: fragility ? fragility.meanFragility : null,
    fragileCellPct:
      fragility && fragility.totalCells > 0
        ? (fragility.fragileCellCount / fragility.totalCells) * 100
        : null,
  };
}

function buildTemporalAnalytics(
  profile: TemporalSecurityProfile | null,
): TemporalAnalytics | null {
  if (!profile || profile.hourlySnapshots.length === 0) return null;

  // overallCoveragePct is already crowd-adjusted when crowd profiles are active (temporal engine handles it).
  // geometricCoveragePct carries the pre-crowd baseline when available.
  const series: TemporalSeriesPoint[] = profile.hourlySnapshots.map((snapshot) => ({
    hour: snapshot.hour,
    minute: snapshot.minute,
    coveragePct: snapshot.geometricCoveragePct ?? snapshot.overallCoveragePct,
    effectiveCoveragePct: snapshot.geometricCoveragePct != null ? snapshot.overallCoveragePct : undefined,
    zonePassRate:
      snapshot.criticalZoneTotalCount === 0
        ? 100
        : (snapshot.criticalZonePassCount / snapshot.criticalZoneTotalCount) * 100,
    stateLabel: snapshot.stateLabel,
  }));

  let worstPoint = series[0];
  let bestPoint = series[0];
  for (const point of series) {
    if (point.coveragePct < worstPoint.coveragePct) worstPoint = point;
    if (point.coveragePct > bestPoint.coveragePct) bestPoint = point;
  }

  const vulnerabilityCounts = { high: 0, medium: 0, low: 0 };
  for (const window of profile.peakVulnerabilityWindows) {
    vulnerabilityCounts[window.severity] += 1;
  }

  return {
    series,
    vulnerabilityCounts,
    anomalyCount: profile.anomalySummary?.totalAnomalies ?? profile.anomalyWindows.length,
    worstCoverageDropPct: profile.anomalySummary?.worstCoverageDropPct ?? null,
    worstPoint,
    bestPoint,
  };
}

function buildCoverageTrend(
  snapshots: SceneSnapshot[],
  result: SimulationResult | null,
): CoverageTrendPoint[] {
  const points: CoverageTrendPoint[] = snapshots
    .filter((snapshot) => snapshot.simulation)
    .map((snapshot) => ({
      label: snapshot.label,
      timestamp: snapshot.createdAt,
      coveragePct: snapshot.simulation!.totalCoveragePct,
      isCurrent: false,
    }))
    .sort((a, b) => a.timestamp - b.timestamp);

  if (result) {
    points.push({
      label: "Current",
      timestamp: result.computedAt,
      coveragePct: result.totalCoveragePct,
      isCurrent: true,
    });
  }

  return points.slice(-MAX_TREND_POINTS);
}

function buildEvidenceActivity(events: OperationalEvidenceEvent[]): EvidenceActivitySummary {
  const countsByKind = new Map<string, number>();
  for (const event of events) {
    countsByKind.set(event.kind, (countsByKind.get(event.kind) ?? 0) + 1);
  }
  const last = events.length > 0 ? events[events.length - 1] : null;
  return {
    totalEvents: events.length,
    countsByKind: [...countsByKind.entries()]
      .map(([kind, count]) => ({ kind, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, MAX_EVIDENCE_KINDS),
    lastEventTitle: last ? last.title : null,
    lastEventTimestamp: last ? last.timestamp : null,
  };
}

const MAX_LIVE_HEALTH_ALERTS = 8;
const CAMERA_CONNECTION_FAULT_TERMS = ["error", "disconnected"];
const CAMERA_CONNECTION_DEGRADED_TERMS = ["connecting", "authenticating"];

const SENSOR_EVENT_KINDS = new Set<OperationalEvidenceEvent["kind"]>([
  "sensor_triggered",
  "sensor_heartbeat",
  "sensor_faulted",
  "sensor_restored",
]);

function classifyCameraConnectionStatus(event: OperationalEvidenceEvent): LiveHealthStatus {
  const haystack = `${event.title} ${event.afterSummary ?? ""}`.toLowerCase();
  if (CAMERA_CONNECTION_FAULT_TERMS.some((term) => haystack.includes(term))) return "fault";
  if (CAMERA_CONNECTION_DEGRADED_TERMS.some((term) => haystack.includes(term))) return "degraded";
  return "healthy";
}

/**
 * "Live fusion" — derives a live health snapshot for sensors and cameras from
 * the operational evidence ledger (sensor heartbeats/faults, camera live
 * connection updates), tracking the most recent event per node. This is the
 * "observed" half of the simulated-vs-observed picture: the simulation result
 * describes what the deterministic engine expects; this describes what the
 * live ledger has actually reported.
 */
export function buildLiveOperationalHealth(
  scene: SecurityScene,
  events: OperationalEvidenceEvent[],
): LiveOperationalHealthSummary {
  const sensorLabelById = new Map(scene.sensors.map((sensor) => [sensor.id, sensor.label] as const));
  const cameraLabelById = new Map(scene.cameras.map((camera) => [camera.id, camera.name] as const));

  const latestByNode = new Map<string, LiveHealthEntry>();

  for (const event of events) {
    if (SENSOR_EVENT_KINDS.has(event.kind)) {
      const sensorId = event.affectedNodeIds[0];
      if (!sensorId) continue;
      const existing = latestByNode.get(sensorId);
      if (existing && existing.lastEventTimestamp > event.timestamp) continue;
      latestByNode.set(sensorId, {
        nodeId: sensorId,
        kind: "sensor",
        label: sensorLabelById.get(sensorId) ?? sensorId,
        status: event.kind === "sensor_faulted" ? "fault" : "healthy",
        lastEventTitle: event.title,
        lastEventTimestamp: event.timestamp,
      });
      continue;
    }

    if (event.kind === "camera_live_connection_updated") {
      const cameraId = event.affectedNodeIds[0];
      if (!cameraId) continue;
      const existing = latestByNode.get(cameraId);
      if (existing && existing.lastEventTimestamp > event.timestamp) continue;
      latestByNode.set(cameraId, {
        nodeId: cameraId,
        kind: "camera",
        label: cameraLabelById.get(cameraId) ?? cameraId,
        status: classifyCameraConnectionStatus(event),
        lastEventTitle: event.title,
        lastEventTimestamp: event.timestamp,
      });
    }
  }

  const entries = [...latestByNode.values()];
  const trackedSensors = entries.filter((entry) => entry.kind === "sensor").length;
  const trackedCameras = entries.filter((entry) => entry.kind === "camera").length;
  const faultedSensors = entries.filter((entry) => entry.kind === "sensor" && entry.status === "fault").length;
  const degradedCameras = entries.filter((entry) => entry.kind === "camera" && entry.status !== "healthy").length;

  const alerts = entries
    .filter((entry) => entry.status !== "healthy")
    .sort((a, b) => b.lastEventTimestamp - a.lastEventTimestamp)
    .slice(0, MAX_LIVE_HEALTH_ALERTS);

  return { trackedSensors, trackedCameras, faultedSensors, degradedCameras, alerts };
}

function buildPlacementSuggestion(result: SimulationResult): PlacementSuggestionSummary | null {
  const best = result.placementOracle?.bestCandidate ?? null;
  if (!best) return null;
  return {
    estimatedCoverageDeltaPct: best.estimatedCoverageDeltaPct,
    estimatedCriticalZoneGain: best.estimatedCriticalZoneGain,
    mountType: best.mountType,
    improvedCriticalZones: best.improvedCriticalZones,
  };
}

function buildBlindSpotSummary(result: SimulationResult): BlindSpotSummary | null {
  const fingerprint = result.blindSpotFingerprint;
  if (!fingerprint) return null;
  return {
    regionCount: fingerprint.regionCount,
    criticalRegionCount: fingerprint.criticalRegionCount,
    totalBlindAreaSqM: fingerprint.totalBlindAreaSqM,
    largestRegionAreaSqM: fingerprint.largestRegionAreaSqM,
  };
}

export function buildSecurityAnalyticsModel(input: SecurityAnalyticsInput): SecurityAnalyticsModel {
  const { scene, simulationResult, temporalProfile, evidenceEvents, snapshots } = input;

  const evidenceActivity = buildEvidenceActivity(evidenceEvents);
  const temporal = buildTemporalAnalytics(temporalProfile);
  const coverageTrend = buildCoverageTrend(snapshots, simulationResult);
  const liveHealth = buildLiveOperationalHealth(scene, evidenceEvents);

  if (!simulationResult) {
    return {
      hasSimulation: false,
      computedAt: null,
      sceneName: scene.name,
      kpis: [],
      doriDistribution: [],
      issueBreakdown: [],
      zoneStatus: { pass: 0, partial: 0, fail: 0, total: 0, passRatePct: 0 },
      cameraLeaderboard: [],
      occlusionOffenders: [],
      resilience: {
        kRobustness: null,
        totalCameras: scene.cameras.length,
        isRobust: null,
        criticalSetCount: 0,
        meanFragility: null,
        fragileCellPct: null,
      },
      temporal,
      coverageTrend,
      evidenceActivity,
      liveHealth,
      placementSuggestion: null,
      blindSpots: null,
    };
  }

  const zoneStatus = buildZoneStatus(simulationResult);
  const resilience = buildResilience(simulationResult);

  return {
    hasSimulation: true,
    computedAt: simulationResult.computedAt,
    sceneName: scene.name,
    kpis: buildKpis(simulationResult, zoneStatus, resilience, temporal),
    doriDistribution: buildDoriDistribution(simulationResult),
    issueBreakdown: buildIssueBreakdown(simulationResult),
    zoneStatus,
    cameraLeaderboard: buildCameraLeaderboard(scene, simulationResult),
    occlusionOffenders: buildOcclusionOffenders(simulationResult),
    resilience,
    temporal,
    coverageTrend,
    evidenceActivity,
    liveHealth,
    placementSuggestion: buildPlacementSuggestion(simulationResult),
    blindSpots: buildBlindSpotSummary(simulationResult),
  };
}
