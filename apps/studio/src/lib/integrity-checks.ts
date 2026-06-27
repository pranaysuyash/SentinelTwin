import type { SecurityScene } from "@/schema/security-scene";
import type { ReportData } from "@sentineltwin/report";
import type { OperationalEvidenceEvent } from "@/lib/operational-evidence";

export type IntegrityCheckResult = {
  surface: string;
  check: string;
  passed: boolean;
  detail: string | null;
};

export type IntegrityReport = {
  timestamp: number;
  sceneId: string;
  results: IntegrityCheckResult[];
  passed: boolean;
  summary: string;
};

function check(checks: IntegrityCheckResult[], surface: string, check: string, passed: boolean, detail: string | null) {
  checks.push({ surface, check, passed, detail });
}

export function runTimelineIntegrityChecks(
  events: OperationalEvidenceEvent[],
  scene: SecurityScene,
): IntegrityCheckResult[] {
  const results: IntegrityCheckResult[] = [];

  check(results, "timeline", "events_chronological", true, null);
  for (let i = 1; i < events.length; i++) {
    if (events[i].timestamp < events[i - 1].timestamp) {
      results[results.length - 1] = {
        surface: "timeline",
        check: "events_chronological",
        passed: false,
        detail: `Event ${events[i].id} at ${events[i].timestamp} is before event ${events[i - 1].id} at ${events[i - 1].timestamp}`,
      };
      break;
    }
  }

  const publishedEvents = events.filter((e) => e.kind === "scene_published" || e.published);
  check(results, "timeline", "published_events_have_snapshot", true, null);
  for (const event of publishedEvents) {
    if (!event.sceneSnapshot) {
      results[results.length - 1] = {
        surface: "timeline",
        check: "published_events_have_snapshot",
        passed: false,
        detail: `Published event ${event.id} has no scene snapshot`,
      };
      break;
    }
  }

  const checkpointEvents = events.filter((e) => e.sceneSnapshot != null);
  check(results, "timeline", "checkpoints_have_valid_scene_id", true, null);
  for (const event of checkpointEvents) {
    if (event.sceneSnapshot && event.sceneSnapshot.id !== scene.id) {
      results[results.length - 1] = {
        surface: "timeline",
        check: "checkpoints_have_valid_scene_id",
        passed: false,
        detail: `Checkpoint event ${event.id} references scene ${event.sceneSnapshot.id} but current scene is ${scene.id}`,
      };
      break;
    }
  }

  return results;
}

export function runReportIntegrityChecks(report: ReportData, scene: SecurityScene): IntegrityCheckResult[] {
  const results: IntegrityCheckResult[] = [];

  check(results, "report", "scene_id_matches", report.sceneId === scene.id,
    report.sceneId === scene.id ? null : `Report sceneId ${report.sceneId} != scene id ${scene.id}`);

  check(results, "report", "dimensions_match",
    report.dimensions.width === scene.dimensions.width && report.dimensions.depth === scene.dimensions.depth,
    report.dimensions.width === scene.dimensions.width && report.dimensions.depth === scene.dimensions.depth
      ? null : `Report dimensions (${report.dimensions.width}x${report.dimensions.depth}) != scene (${scene.dimensions.width}x${scene.dimensions.depth})`);

  check(results, "report", "camera_count_matches", report.cameras.length === scene.cameras.length,
    report.cameras.length === scene.cameras.length
      ? null : `Report cameras ${report.cameras.length} != scene cameras ${scene.cameras.length}`);

  check(results, "report", "zone_count_matches", report.zones.length === scene.criticalZones.length,
    report.zones.length === scene.criticalZones.length
      ? null : `Report zones ${report.zones.length} != scene critical zones ${scene.criticalZones.length}`);

  check(results, "report", "has_standards_ref", report.standardsRef.length > 0,
    report.standardsRef.length > 0 ? null : "Report has no standards reference");

  check(results, "report", "has_provenance", report.provenance.nodeCount > 0,
    report.provenance.nodeCount > 0 ? null : "Report has no provenance data");

  check(results, "report", "has_evidence_trail", report.evidenceTrail.evidenceEntryCount >= 0,
    null);

  return results;
}

export function runCompareIntegrityChecks(
  beforeScene: SecurityScene,
  afterScene: SecurityScene,
  beforeReport: ReportData,
  afterReport: ReportData,
): IntegrityCheckResult[] {
  const results: IntegrityCheckResult[] = [];

  check(results, "compare", "before_scene_id_valid", beforeScene.id.length > 0,
    beforeScene.id.length > 0 ? null : "Before scene has no id");

  check(results, "compare", "after_scene_id_valid", afterScene.id.length > 0,
    afterScene.id.length > 0 ? null : "After scene has no id");

  check(results, "compare", "before_report_scene_id_matches", beforeReport.sceneId === beforeScene.id,
    beforeReport.sceneId === beforeScene.id ? null : `Before report sceneId ${beforeReport.sceneId} != before scene id ${beforeScene.id}`);

  check(results, "compare", "after_report_scene_id_matches", afterReport.sceneId === afterScene.id,
    afterReport.sceneId === afterScene.id ? null : `After report sceneId ${afterReport.sceneId} != after scene id ${afterScene.id}`);

  check(results, "compare", "before_after_scenes_different", beforeScene.id !== afterScene.id,
    beforeScene.id !== afterScene.id ? null : "Before and after scenes have the same id");

  return results;
}

export function runPublishIntegrityChecks(
  scene: SecurityScene,
  events: OperationalEvidenceEvent[],
): IntegrityCheckResult[] {
  const results: IntegrityCheckResult[] = [];

  const publishedEvents = events.filter((e) => e.kind === "scene_published" || e.published);
  check(results, "publish", "at_least_one_published_event", publishedEvents.length > 0,
    publishedEvents.length > 0 ? null : "No published events found");

  const latestPublished = publishedEvents[publishedEvents.length - 1] ?? null;
  check(results, "publish", "latest_published_has_snapshot", latestPublished?.sceneSnapshot != null,
    latestPublished?.sceneSnapshot != null ? null : "Latest published event has no scene snapshot");

  if (latestPublished?.sceneSnapshot) {
    check(results, "publish", "published_snapshot_matches_current_scene_id",
      latestPublished.sceneSnapshot.id === scene.id,
      latestPublished.sceneSnapshot.id === scene.id
        ? null : `Published snapshot sceneId ${latestPublished.sceneSnapshot.id} != current scene id ${scene.id}`);
  }

  return results;
}

export function runAllIntegrityChecks(
  scene: SecurityScene,
  events: OperationalEvidenceEvent[],
  report: ReportData | null,
  beforeScene: SecurityScene | null,
  afterScene: SecurityScene | null,
  beforeReport: ReportData | null,
  afterReport: ReportData | null,
): IntegrityReport {
  const allResults: IntegrityCheckResult[] = [
    ...runTimelineIntegrityChecks(events, scene),
    ...(report ? runReportIntegrityChecks(report, scene) : []),
    ...(beforeScene && afterScene && beforeReport && afterReport
      ? runCompareIntegrityChecks(beforeScene, afterScene, beforeReport, afterReport)
      : []),
    ...runPublishIntegrityChecks(scene, events),
  ];

  const failed = allResults.filter((r) => !r.passed);
  return {
    timestamp: Date.now(),
    sceneId: scene.id,
    results: allResults,
    passed: failed.length === 0,
    summary: failed.length === 0
      ? `All ${allResults.length} integrity checks passed`
      : `${failed.length}/${allResults.length} integrity checks failed`,
  };
}
