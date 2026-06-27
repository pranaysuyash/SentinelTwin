import type { SecurityScene } from "@/schema/security-scene";
import type { OperationalEvidenceEvent, OperationalEvidenceTimelineSummary, OperationalEvidenceCheckpointProvenance, OperationalEvidenceTimelineEntry } from "@/lib/operational-evidence";
import { buildOperationalEvidenceTimeline } from "@/lib/operational-evidence";

function resolveProvenance(
  timeline: OperationalEvidenceTimelineSummary,
  entry: OperationalEvidenceTimelineEntry | null,
): OperationalEvidenceCheckpointProvenance | null {
  if (!entry) return null;
  let sourceEntry: OperationalEvidenceTimelineEntry | null = null;
  for (let index = entry.index; index >= 0; index -= 1) {
    const candidate = timeline.entries[index];
    if (candidate?.event.sceneSnapshot) {
      sourceEntry = candidate;
      break;
    }
  }
  if (!sourceEntry) return null;
  return {
    sourceEventId: sourceEntry.event.id,
    sourceEventTitle: sourceEntry.event.title,
    sourceEventTimestamp: sourceEntry.event.timestamp,
    isExactSnapshot: sourceEntry.index === entry.index,
    derivedFromEarlierSnapshot: sourceEntry.index !== entry.index,
    sourceSnapshotDistance: sourceEntry.index === entry.index ? 0 : entry.index - sourceEntry.index,
    sourceSnapshotAgeMs: sourceEntry.index === entry.index ? 0 : Math.max(0, entry.event.timestamp - sourceEntry.event.timestamp),
  };
}

export type TemporalMemorySnapshot = {
  id: string;
  timestamp: number;
  scene: SecurityScene;
  event: OperationalEvidenceEvent;
  provenance: OperationalEvidenceCheckpointProvenance | null;
};

export type TemporalMemorySegment = {
  startEvent: OperationalEvidenceEvent;
  endEvent: OperationalEvidenceEvent | null;
  startSnapshot: TemporalMemorySnapshot;
  endSnapshot: TemporalMemorySnapshot | null;
  durationMs: number;
  eventCount: number;
  changeSummary: string[];
};

export type TemporalMemoryState = {
  snapshots: TemporalMemorySnapshot[];
  segments: TemporalMemorySegment[];
  timeline: OperationalEvidenceTimelineSummary;
  totalDurationMs: number;
  eventCount: number;
  branchLabels: string[];
};

export function buildTemporalMemory(
  events: OperationalEvidenceEvent[],
  currentScene: SecurityScene,
): TemporalMemoryState {
  const timeline = buildOperationalEvidenceTimeline(events, currentScene);
  const checkpointEvents = events.filter((e) => e.sceneSnapshot != null);

  const snapshots: TemporalMemorySnapshot[] = checkpointEvents.map((event) => {
    const entry = timeline.entries.find((e) => e.event.id === event.id) ?? null;
    return {
      id: `tms_${event.id}`,
      timestamp: event.timestamp,
      scene: event.sceneSnapshot!,
      event,
      provenance: resolveProvenance(timeline, entry),
    };
  });

  const segments: TemporalMemorySegment[] = [];
  for (let i = 0; i < snapshots.length; i++) {
    const start = snapshots[i];
    const end = snapshots[i + 1] ?? null;
    const eventsInSegment = events.filter(
      (e) => e.timestamp >= start.timestamp && (!end || e.timestamp <= end.timestamp),
    );
    const changeSummary = buildChangeSummary(start.scene, end?.scene ?? currentScene);
    segments.push({
      startEvent: start.event,
      endEvent: end?.event ?? null,
      startSnapshot: start,
      endSnapshot: end,
      durationMs: end ? end.timestamp - start.timestamp : Date.now() - start.timestamp,
      eventCount: eventsInSegment.length,
      changeSummary,
    });
  }

  const branchLabels = [...new Set(events.map((e) => e.branchLabel ?? e.lifecycleStage ?? "manual").filter(Boolean))];

  return {
    snapshots,
    segments,
    timeline,
    totalDurationMs: snapshots.length > 1 ? snapshots[snapshots.length - 1].timestamp - snapshots[0].timestamp : 0,
    eventCount: events.length,
    branchLabels,
  };
}

export function replayTemporalMemoryToTime(
  memory: TemporalMemoryState,
  targetTimestamp: number,
): TemporalMemorySnapshot | null {
  const sorted = [...memory.snapshots].sort((a, b) => b.timestamp - a.timestamp);
  return sorted.find((s) => s.timestamp <= targetTimestamp) ?? sorted[sorted.length - 1] ?? null;
}

export function getTemporalMemorySegmentAtTime(
  memory: TemporalMemoryState,
  timestamp: number,
): TemporalMemorySegment | null {
  return memory.segments.find(
    (s) => timestamp >= s.startSnapshot.timestamp && (!s.endSnapshot || timestamp <= s.endSnapshot.timestamp),
  ) ?? null;
}

function buildChangeSummary(before: SecurityScene, after: SecurityScene): string[] {
  const changes: string[] = [];
  const camDelta = after.cameras.length - before.cameras.length;
  if (camDelta !== 0) changes.push(`${camDelta > 0 ? "+" : ""}${camDelta} cameras`);
  const lightDelta = after.securityLights.length - before.securityLights.length;
  if (lightDelta !== 0) changes.push(`${lightDelta > 0 ? "+" : ""}${lightDelta} lights`);
  const obsDelta = after.obstructions.length - before.obstructions.length;
  if (obsDelta !== 0) changes.push(`${obsDelta > 0 ? "+" : ""}${obsDelta} obstructions`);
  const zoneDelta = (after.criticalZones.length + after.privacyZones.length) - (before.criticalZones.length + before.privacyZones.length);
  if (zoneDelta !== 0) changes.push(`${zoneDelta > 0 ? "+" : ""}${zoneDelta} zones`);
  const pathDelta = after.paths.length - before.paths.length;
  if (pathDelta !== 0) changes.push(`${pathDelta > 0 ? "+" : ""}${pathDelta} paths`);
  const sensorDelta = after.sensors.length - before.sensors.length;
  if (sensorDelta !== 0) changes.push(`${sensorDelta > 0 ? "+" : ""}${sensorDelta} sensors`);
  return changes;
}
