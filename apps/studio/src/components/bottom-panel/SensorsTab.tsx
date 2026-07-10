"use client";

import { LocateFixed, ScanSearch, Upload } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { Badge } from "@/components/shared/Badge";
import { SectionCard } from "@/components/shared/SectionCard";
import { cn } from "@/lib/cn";
import { parseSensorLiveFeed } from "@/lib/sensor-live-ingest";
import type { SensorNode } from "@/schema/security-scene";
import { useStudioStore } from "@/store/studio-store";
import { UI_SURFACES } from "@/lib/studio-surface-tokens";


const SENSOR_TYPE_LABELS: Record<SensorNode["sensorType"], string> = {
  motion: "Motion",
  door_contact: "Door Contact",
  access_reader: "Access Reader",
  audio: "Audio",
  vibration: "Vibration",
  panic_button: "Panic Button",
  smoke_heat: "Smoke / Heat",
};

const SENSOR_STATE_STYLES: Record<SensorNode["state"], { label: string; tone: "green" | "amber" | "red" }> = {
  active: { label: "Active", tone: "green" },
  inactive: { label: "Inactive", tone: "amber" },
  faulted: { label: "Faulted", tone: "red" },
};

const SENSOR_COVERAGE_LABELS: Record<SensorNode["coverageMode"], string> = {
  detection: "Detection",
  trigger: "Trigger",
  audit: "Audit",
};

function formatDistance(distanceM: number | null) {
  if (distanceM === null) return "—";
  return `${distanceM.toFixed(1)}m`;
}

type CameraLike = { position: [number, number, number]; name: string };

function nearestCameraName(sensor: SensorNode, cameras: CameraLike[]) {
  if (cameras.length === 0) return null;
  let bestName: string | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const camera of cameras) {
    const dx = camera.position[0] - sensor.position[0];
    const dy = camera.position[1] - sensor.position[1];
    const dz = camera.position[2] - sensor.position[2];
    const distance = Math.hypot(dx, dy, dz);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestName = camera.name;
    }
  }
  return bestName;
}

export function SensorsTab() {
  const scene = useStudioStore((s) => s.scene);
  const result = useStudioStore((s) => s.simulationResult);
  const activeTool = useStudioStore((s) => s.activeTool);
  const setActiveTool = useStudioStore((s) => s.setActiveTool);
  const sensorPlacementType = useStudioStore((s) => s.sensorPlacementType);
  const setSensorPlacementType = useStudioStore((s) => s.setSensorPlacementType);
  const selectNode = useStudioStore((s) => s.selectNode);
  const selectedNodeId = useStudioStore((s) => s.selectedNodeId);
  const sceneId = useStudioStore((s) => s.scene.id);
  const allSensorEvents = useStudioStore((s) => s.sensorEvents);
  const sensorEvents = useMemo(
    () => allSensorEvents.filter((event) => event.sceneId === sceneId),
    [allSensorEvents, sceneId],
  );
  const recordSensorEvent = useStudioStore((s) => s.recordSensorEvent);
  const clearSensorEvents = useStudioStore((s) => s.clearSensorEvents);
  const updateNode = useStudioStore((s) => s.updateNode);
  const [liveFeedDraft, setLiveFeedDraft] = useState("");
  const [liveFeedStatus, setLiveFeedStatus] = useState<string | null>(null);
  const [liveFeedError, setLiveFeedError] = useState<string | null>(null);
  const [externalFeedUrl, setExternalFeedUrl] = useState("");
  const [externalFeedLabel, setExternalFeedLabel] = useState("");
  const [externalFeedStatus, setExternalFeedStatus] = useState<string | null>(null);
  const [externalFeedError, setExternalFeedError] = useState<string | null>(null);
  const [externalFeedLoading, setExternalFeedLoading] = useState(false);
  const [sensorIngestHistory, setSensorIngestHistory] = useState<Array<{
    ingestMode: "paste" | "external";
    feedUrl: string | null;
    feedLabel: string | null;
    receivedAt: string;
    summary: string;
    sceneName: string | null;
    sourceCount: number;
  }>>([]);
  const [sensorIngestHistoryLoading, setSensorIngestHistoryLoading] = useState(false);

  const activeCount = scene.sensors.filter((sensor) => sensor.state === "active").length;
  const faultedCount = scene.sensors.filter((sensor) => sensor.state === "faulted").length;
  const inactiveCount = scene.sensors.filter((sensor) => sensor.state === "inactive").length;
  const selectedSensor = scene.sensors.find((sensor) => sensor.id === selectedNodeId) ?? scene.sensors[0] ?? null;
  const recentEvents = sensorEvents.slice(0, 8);
  const eventCounts = sensorEvents.reduce<Record<"triggered" | "heartbeat" | "faulted" | "restored", number>>((acc, event) => {
    acc[event.kind] += 1;
    return acc;
  }, {
    triggered: 0,
    heartbeat: 0,
    faulted: 0,
    restored: 0,
  });

  const typeCounts = scene.sensors.reduce<Record<SensorNode["sensorType"], number>>((acc, sensor) => {
    acc[sensor.sensorType] += 1;
    return acc;
  }, {
    motion: 0,
    door_contact: 0,
    access_reader: 0,
    audio: 0,
    vibration: 0,
    panic_button: 0,
    smoke_heat: 0,
  });
  const liveFeedPreview = useMemo(
    () => parseSensorLiveFeed(liveFeedDraft, scene.sensors),
    [liveFeedDraft, scene.sensors],
  );

  useEffect(() => {
    let active = true;
    queueMicrotask(() => {
      if (active) setSensorIngestHistoryLoading(true);
    });
    void fetch("/api/sensor-ingest")
      .then(async (response) => {
        if (!response.ok) return null;
        return response.json() as Promise<{
          ok: true;
          history: Array<{
            ingestMode: "paste" | "external";
            feedUrl: string | null;
            feedLabel: string | null;
            receivedAt: string;
            summary: string;
            sceneName: string | null;
            sourceCount: number;
          }>;
        }>;
      })
      .then((payload) => {
        if (!active || !payload?.history) return;
        setSensorIngestHistory(payload.history.slice(0, 3));
      })
      .catch(() => {
        if (active) setSensorIngestHistory([]);
      })
      .finally(() => {
        if (active) setSensorIngestHistoryLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const importLiveFeed = () => {
    const parsed = parseSensorLiveFeed(liveFeedDraft, scene.sensors);
    if (parsed.events.length === 0) {
      setLiveFeedError(parsed.errors[0] ?? "Paste live sensor metadata as JSON or NDJSON first.");
      setLiveFeedStatus(null);
      return;
    }

    for (const event of parsed.events) {
      recordSensorEvent(event);
    }
    setLiveFeedError(parsed.errors[0] ?? null);
    setLiveFeedStatus(`Imported ${parsed.events.length} live sensor event${parsed.events.length === 1 ? "" : "s"} from ${parsed.sourceCount} record${parsed.sourceCount === 1 ? "" : "s"}.`);
  };

  const importExternalFeed = async () => {
    const trimmedUrl = externalFeedUrl.trim();
    if (!trimmedUrl) {
      setExternalFeedError("Paste an external feed URL first.");
      setExternalFeedStatus(null);
      return;
    }

    try {
      new URL(trimmedUrl);
    } catch {
      setExternalFeedError("External feed URL must be a valid URL.");
      setExternalFeedStatus(null);
      return;
    }

    setExternalFeedLoading(true);
    setExternalFeedError(null);
    setExternalFeedStatus(null);
    try {
      const response = await fetch("/api/sensor-ingest", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          source: "sensors-tab",
          ingestMode: "external",
          feedUrl: trimmedUrl,
          ...(externalFeedLabel.trim() ? { feedLabel: externalFeedLabel.trim() } : {}),
          sceneId: scene.id,
          sceneName: scene.name,
          submittedAt: Date.now(),
          raw: "",
          sensors: scene.sensors,
        }),
      });

      if (!response.ok) {
        throw new Error(`Sensor ingest failed with HTTP ${response.status}.`);
      }

      const payload = (await response.json()) as {
        ok: true;
        source: string;
        ingestMode: "paste" | "external";
        receivedAt: string;
        sceneId: string | null;
        sceneName: string | null;
        feedUrl: string | null;
        feedLabel: string | null;
        summary: string;
        events: Array<Parameters<typeof recordSensorEvent>[0]>;
        errors: string[];
        sourceCount: number;
        storedAt: number;
        historyCount: number;
      };

      if (payload.events.length === 0) {
        throw new Error(payload.errors[0] ?? "No matching sensor events found.");
      }

      for (const event of payload.events) {
        recordSensorEvent(event);
      }
      setExternalFeedError(payload.errors[0] ?? null);
      setExternalFeedStatus(
        `${payload.summary} Archived ${payload.historyCount} sensor ingest record${payload.historyCount === 1 ? "" : "s"} from ${payload.feedLabel ?? payload.feedUrl ?? "external feed"}.`,
      );
      setExternalFeedUrl("");
      setExternalFeedLabel("");
    } catch (error) {
      const message = error instanceof Error ? error.message : "External sensor feed import failed.";
      setExternalFeedError(message);
      setExternalFeedStatus(null);
    } finally {
      setExternalFeedLoading(false);
    }
  };

  return (
    <div className="h-full overflow-y-auto">
      <div className="space-y-3 p-3">
        <div className="rounded-xl border border-cyan-500/15 bg-cyan-500/8 p-3">
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-cyan-500/20 bg-cyan-500/10">
              <ScanSearch className="h-4 w-4 text-cyan-300" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[11px] font-semibold text-white">Sensor Fusion Entry Point</div>
              <div className="mt-1 text-[10px] leading-relaxed text-cyan-100/70">
                Sensors are now a first-class scene object: place them on the canvas, inspect them like other nodes, and track their state in the report handoff.
              </div>
            </div>
          </div>
        </div>

        <SectionCard title="Placement" truthLabel="simulated">
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-1.5">
              {(Object.keys(SENSOR_TYPE_LABELS) as SensorNode["sensorType"][]).map((sensorType) => {
                const active = sensorPlacementType === sensorType;
                return (
                  <button
                    key={sensorType}
                    type="button"
                    onClick={() => {
                      setSensorPlacementType(sensorType);
                      setActiveTool("sensor");
                    }}
                    className={cn(
                      "rounded-lg border px-2 py-1.5 text-left text-[10px] transition-colors",
                      active
                        ? "border-cyan-500/30 bg-cyan-500/12 text-cyan-200"
                        : `${UI_SURFACES.borderSubtle} ${UI_SURFACES.bgDeep} text-[#95a0b7] ${UI_SURFACES.hoverBorder} hover:${UI_SURFACES.textBody2}`,
                    )}
                  >
                    <div className="font-semibold">{SENSOR_TYPE_LABELS[sensorType]}</div>
                    <div className={`text-[8px] uppercase tracking-[0.16em] ${UI_SURFACES.textSoftMid}`}>{typeCounts[sensorType]} on scene</div>
                  </button>
                );
              })}
            </div>
            <button
              type="button"
              onClick={() => setActiveTool("sensor")}
              className={cn(
                "flex h-8 w-full items-center justify-center gap-1.5 rounded-lg border text-[10px] font-medium transition-colors",
                activeTool === "sensor"
                  ? "border-cyan-500/30 bg-cyan-500/12 text-cyan-200"
                  : `${UI_SURFACES.border} ${UI_SURFACES.card} ${UI_SURFACES.textBody} ${UI_SURFACES.hoverBorderBright} ${UI_SURFACES.hoverBgDark}`,
              )}
            >
              <LocateFixed className="h-3 w-3" />
              Place {SENSOR_TYPE_LABELS[sensorPlacementType]}
            </button>
          </div>
        </SectionCard>

        <SectionCard title="Live Signals" truthLabel="simulated">
          {selectedSensor ? (
            <div className="space-y-2">
              <div className="rounded-lg border border-cyan-500/15 bg-cyan-500/8 px-3 py-2">
                <div className="text-[10px] font-semibold text-white">{selectedSensor.label}</div>
                <div className="mt-0.5 text-[9px] uppercase tracking-[0.14em] text-cyan-100/60">
                  {SENSOR_TYPE_LABELS[selectedSensor.sensorType]} · {SENSOR_COVERAGE_LABELS[selectedSensor.coverageMode]}
                </div>
                <div className={`mt-2 grid grid-cols-2 gap-2 text-[9px] ${UI_SURFACES.textMuted3}`}>
                  <div className={`rounded-md ${UI_SURFACES.panel} px-2 py-1.5`}>
                    <div className={`uppercase tracking-[0.14em] ${UI_SURFACES.textDimMid}`}>State</div>
                    <div className="mt-0.5 font-medium text-[#d8def0]">{selectedSensor.state}</div>
                  </div>
                  <div className={`rounded-md ${UI_SURFACES.panel} px-2 py-1.5`}>
                    <div className={`uppercase tracking-[0.14em] ${UI_SURFACES.textDimMid}`}>Live feed</div>
                    <div className="mt-0.5 font-medium text-[#d8def0]">{sensorEvents.length} events</div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => recordSensorEvent({
                    sensorId: selectedSensor.id,
                    sensorLabel: selectedSensor.label,
                    sensorType: selectedSensor.sensorType,
                    kind: "triggered",
                    details: `${selectedSensor.label} observed a live trigger.`,
                    resultingState: selectedSensor.state,
                  })}
                  className="rounded-lg border border-cyan-500/25 bg-cyan-500/10 px-2 py-2 text-[10px] font-medium text-cyan-100 transition-colors hover:border-cyan-400/40 hover:bg-cyan-500/14"
                >
                  Trigger
                </button>
                <button
                  type="button"
                  onClick={() => recordSensorEvent({
                    sensorId: selectedSensor.id,
                    sensorLabel: selectedSensor.label,
                    sensorType: selectedSensor.sensorType,
                    kind: "heartbeat",
                    details: `${selectedSensor.label} sent a heartbeat.`,
                    resultingState: selectedSensor.state,
                  })}
                  className={`rounded-lg border ${UI_SURFACES.border} ${UI_SURFACES.card} px-2 py-2 text-[10px] font-medium ${UI_SURFACES.textBody2} transition-colors ${UI_SURFACES.hoverBorderBright} ${UI_SURFACES.hoverBgDark}`}
                >
                  Heartbeat
                </button>
                <button
                  type="button"
                  onClick={() => {
                    updateNode(selectedSensor.id, { state: "faulted" });
                    recordSensorEvent({
                      sensorId: selectedSensor.id,
                      sensorLabel: selectedSensor.label,
                      sensorType: selectedSensor.sensorType,
                      kind: "faulted",
                      details: `${selectedSensor.label} reported a fault.`,
                      resultingState: "faulted",
                    });
                  }}
                  className="rounded-lg border border-red-900/35 bg-red-950/15 px-2 py-2 text-[10px] font-medium text-red-300 transition-colors hover:border-red-700 hover:bg-red-950/28"
                >
                  Mark Faulted
                </button>
                <button
                  type="button"
                  onClick={() => {
                    updateNode(selectedSensor.id, { state: "active" });
                    recordSensorEvent({
                      sensorId: selectedSensor.id,
                      sensorLabel: selectedSensor.label,
                      sensorType: selectedSensor.sensorType,
                      kind: "restored",
                      details: `${selectedSensor.label} restored to active service.`,
                      resultingState: "active",
                    });
                  }}
                  className="rounded-lg border border-emerald-900/35 bg-emerald-950/15 px-2 py-2 text-[10px] font-medium text-emerald-200 transition-colors hover:border-emerald-700 hover:bg-emerald-950/28"
                >
                  Restore
                </button>
              </div>
            </div>
          ) : (
            <div className={`rounded-lg border border-dashed ${UI_SURFACES.border} ${UI_SURFACES.bgDeep} px-3 py-3 text-[10px] leading-relaxed ${UI_SURFACES.textMuted5}`}>
              Select a sensor to stage a live signal, heartbeat, or fault event.
            </div>
          )}
        </SectionCard>

        <SectionCard title="Live Event Feed" truthLabel="simulated">
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
            <div className={`rounded-lg border ${UI_SURFACES.borderSubtle} ${UI_SURFACES.panel} px-2 py-2`}>
              <div className={`text-[9px] uppercase tracking-[0.14em] ${UI_SURFACES.textDimMid}`}>Triggers</div>
              <div className="mt-1 text-[18px] font-semibold text-cyan-200">{eventCounts.triggered}</div>
            </div>
            <div className={`rounded-lg border ${UI_SURFACES.borderSubtle} ${UI_SURFACES.panel} px-2 py-2`}>
              <div className={`text-[9px] uppercase tracking-[0.14em] ${UI_SURFACES.textDimMid}`}>Heartbeats</div>
              <div className="mt-1 text-[18px] font-semibold text-blue-200">{eventCounts.heartbeat}</div>
            </div>
            <div className={`rounded-lg border ${UI_SURFACES.borderSubtle} ${UI_SURFACES.panel} px-2 py-2`}>
              <div className={`text-[9px] uppercase tracking-[0.14em] ${UI_SURFACES.textDimMid}`}>Faults</div>
              <div className="mt-1 text-[18px] font-semibold text-red-300">{eventCounts.faulted}</div>
            </div>
            <div className={`rounded-lg border ${UI_SURFACES.borderSubtle} ${UI_SURFACES.panel} px-2 py-2`}>
              <div className={`text-[9px] uppercase tracking-[0.14em] ${UI_SURFACES.textDimMid}`}>Restores</div>
              <div className="mt-1 text-[18px] font-semibold text-emerald-300">{eventCounts.restored}</div>
            </div>
          </div>

          <div className="mt-2 space-y-1.5">
            {recentEvents.length === 0 ? (
              <div className={`rounded-lg border border-dashed ${UI_SURFACES.border} ${UI_SURFACES.bgDeep} px-3 py-3 text-[10px] leading-relaxed ${UI_SURFACES.textMuted5}`}>
                No live sensor events yet. Use the live controls above to create the first evidence record.
              </div>
            ) : (
              recentEvents.map((event) => (
                <div
                  key={event.id}
                  className={cn(
                    "rounded-lg border ${UI_SURFACES.bgDeep} px-3 py-2",
                    event.kind === "faulted"
                      ? "border-red-900/35"
                      : event.kind === "restored"
                        ? "border-emerald-900/35"
                        : event.kind === "triggered"
                          ? "border-cyan-900/35"
                          : `${UI_SURFACES.borderSubtle}`,
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className={`text-[10px] font-semibold ${UI_SURFACES.textBright}`}>{event.sensorLabel}</div>
                      <div className={`text-[8px] uppercase tracking-[0.14em] ${UI_SURFACES.textSoftMid}`}>
                        {event.kind} · {SENSOR_TYPE_LABELS[event.sensorType]}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className={`text-[8px] uppercase tracking-[0.14em] ${UI_SURFACES.textDimMid}`}>
                        {new Date(event.timestamp).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                      </div>
                      <div className={`text-[9px] font-medium ${UI_SURFACES.textBody2}`}>{event.resultingState ?? "—"}</div>
                    </div>
                  </div>
                  <div className="mt-1 grid grid-cols-3 gap-1.5 text-[9px] text-[#90a0bf]">
                    <div className={`rounded-md ${UI_SURFACES.panel} px-1.5 py-1`}>
                      <div className={`text-[8px] uppercase tracking-[0.14em] ${UI_SURFACES.textDimMid}`}>Nearest Cam</div>
                      <div className="mt-0.5 truncate font-mono">{event.nearestCameraName ?? "None"}</div>
                    </div>
                    <div className={`rounded-md ${UI_SURFACES.panel} px-1.5 py-1`}>
                      <div className={`text-[8px] uppercase tracking-[0.14em] ${UI_SURFACES.textDimMid}`}>Distance</div>
                      <div className="mt-0.5 font-mono">{formatDistance(event.nearestDistanceM)}</div>
                    </div>
                    <div className={`rounded-md ${UI_SURFACES.panel} px-1.5 py-1`}>
                      <div className={`text-[8px] uppercase tracking-[0.14em] ${UI_SURFACES.textDimMid}`}>Signal</div>
                      <div className="mt-0.5 truncate">{event.details}</div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {sensorEvents.length > 0 ? (
            <div className={`mt-2 flex items-center justify-between gap-2 text-[9px] ${UI_SURFACES.textMuted5}`}>
              <span>Live evidence is now logged into the canonical operational trail.</span>
              <button
                type="button"
                onClick={clearSensorEvents}
                className={`rounded-md border ${UI_SURFACES.border} px-2 py-1 text-[9px] font-medium ${UI_SURFACES.textBody2} transition-colors ${UI_SURFACES.hoverBorderBright} hover:text-white`}
              >
                Clear current scene feed
              </button>
            </div>
          ) : null}
        </SectionCard>

        <SectionCard title="Live Metadata Intake" truthLabel="simulated">
          <div className="space-y-2">
            <div className={`rounded-lg border ${UI_SURFACES.border} ${UI_SURFACES.bgDeep} px-3 py-2 text-[10px] leading-relaxed ${UI_SURFACES.textMuted5}`}>
              Paste JSON arrays or newline-delimited JSON sensor records here. Matching sensor ids or labels are resolved into the canonical live evidence trail.
            </div>
            <textarea
              value={liveFeedDraft}
              onChange={(event) => {
                setLiveFeedDraft(event.target.value);
                setLiveFeedError(null);
                setLiveFeedStatus(null);
              }}
              rows={5}
              placeholder={`[
  {"sensorId":"sensor_1","kind":"triggered","details":"Motion detected"},
  {"sensorLabel":"Front Door","kind":"heartbeat"}
]`}
              className={`w-full rounded-lg border ${UI_SURFACES.border} ${UI_SURFACES.card} px-3 py-2 text-[10px] leading-relaxed ${UI_SURFACES.textBody2} outline-none placeholder:${UI_SURFACES.textDimMid} focus:border-cyan-400/40`}
            />
            <div className="grid gap-2 md:grid-cols-[auto_1fr]">
              <button
                type="button"
                onClick={importLiveFeed}
                className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-cyan-500/25 bg-cyan-500/10 px-3 py-2 text-[10px] font-medium text-cyan-100 transition-colors hover:border-cyan-400/40 hover:bg-cyan-500/14"
              >
                <Upload className="h-3 w-3" />
                Import Metadata Feed
              </button>
              <div className={`rounded-lg border ${UI_SURFACES.border} ${UI_SURFACES.bgDeep} px-3 py-2 text-[9px] leading-relaxed ${UI_SURFACES.textMuted3}`}>
                {liveFeedStatus ?? `Preview: ${liveFeedPreview.events.length} event${liveFeedPreview.events.length === 1 ? "" : "s"} ready, ${liveFeedPreview.errors.length} issue${liveFeedPreview.errors.length === 1 ? "" : "s"}.`}
              </div>
            </div>
            {liveFeedError ? (
              <div className="rounded-lg border border-red-900/30 bg-red-950/15 px-3 py-2 text-[9px] text-red-300">
                {liveFeedError}
              </div>
            ) : liveFeedPreview.errors.length > 0 ? (
              <div className="rounded-lg border border-amber-900/30 bg-amber-950/15 px-3 py-2 text-[9px] text-amber-200">
                {liveFeedPreview.errors[0]}
              </div>
            ) : null}
          </div>
        </SectionCard>

        <SectionCard title="External Feed Bridge" truthLabel="inferred">
          <div className="space-y-2">
            <div className={`rounded-lg border ${UI_SURFACES.border} ${UI_SURFACES.bgDeep} px-3 py-2 text-[10px] leading-relaxed ${UI_SURFACES.textMuted5}`}>
              Pull JSON or NDJSON from a live feed URL through the same ingest boundary. This is the bridge toward ONVIF, webhook, or BMS metadata without changing the scene model.
            </div>
            <div className="grid gap-2">
              <input
                type="url"
                value={externalFeedUrl}
                onChange={(event) => {
                  setExternalFeedUrl(event.target.value);
                  setExternalFeedError(null);
                  setExternalFeedStatus(null);
                }}
                placeholder="https://example.com/live-sensor-feed"
                className={`w-full rounded-lg border ${UI_SURFACES.border} ${UI_SURFACES.card} px-3 py-2 text-[10px] ${UI_SURFACES.textBody2} outline-none placeholder:${UI_SURFACES.textDimMid} focus:border-cyan-400/40`}
              />
              <input
                type="text"
                value={externalFeedLabel}
                onChange={(event) => {
                  setExternalFeedLabel(event.target.value);
                  setExternalFeedError(null);
                  setExternalFeedStatus(null);
                }}
                placeholder="Optional feed label, like ONVIF relay"
                className={`w-full rounded-lg border ${UI_SURFACES.border} ${UI_SURFACES.card} px-3 py-2 text-[10px] ${UI_SURFACES.textBody2} outline-none placeholder:${UI_SURFACES.textDimMid} focus:border-cyan-400/40`}
              />
            </div>
            <div className="grid gap-2 md:grid-cols-[auto_1fr]">
              <button
                type="button"
                onClick={() => void importExternalFeed()}
                className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-cyan-500/25 bg-cyan-500/10 px-3 py-2 text-[10px] font-medium text-cyan-100 transition-colors hover:border-cyan-400/40 hover:bg-cyan-500/14"
              >
                <Upload className="h-3 w-3" />
                {externalFeedLoading ? "Pulling Feed..." : "Pull External Feed"}
              </button>
              <div className={`rounded-lg border ${UI_SURFACES.border} ${UI_SURFACES.bgDeep} px-3 py-2 text-[9px] leading-relaxed ${UI_SURFACES.textMuted3}`}>
                {externalFeedStatus ?? "Ready to pull a live feed through the ingest route and archive the resulting evidence."}
              </div>
            </div>
            {externalFeedError ? (
              <div className="rounded-lg border border-red-900/30 bg-red-950/15 px-3 py-2 text-[9px] text-red-300">
                {externalFeedError}
              </div>
            ) : null}
          </div>
        </SectionCard>

        <SectionCard title="Ingest History" truthLabel="imported">
          <div className="space-y-2 text-[10px] text-[#9aa7c2]">
            <div className="flex items-center justify-between">
              <span className={`uppercase tracking-[0.16em] ${UI_SURFACES.textSoftMid}`}>Sensor ingest archive</span>
              <span className="text-[#7e8ca8]">
                {sensorIngestHistoryLoading ? "Loading..." : `${sensorIngestHistory.length} recent`}
              </span>
            </div>
            {sensorIngestHistory.length > 0 ? (
              <div className="space-y-1.5">
                {sensorIngestHistory.map((entry, index) => (
                  <div key={`${entry.receivedAt}:${index}`} className={`rounded-lg border ${UI_SURFACES.borderSubtle} ${UI_SURFACES.panelDeep} px-2.5 py-2`}>
                    <div className="flex items-center justify-between gap-2">
                      <div className="font-medium text-[#d7ddef]">{entry.sceneName ?? "Scene ingest"}</div>
                      <div className="text-[9px] text-[#7684a2]">{entry.sourceCount} record{entry.sourceCount === 1 ? "" : "s"}</div>
                    </div>
                    <div className={`mt-0.5 ${UI_SURFACES.textMuted3}`}>{entry.summary}</div>
                    <div className="mt-0.5 text-[9px] uppercase tracking-[0.12em] text-[#60708c]">
                      {entry.ingestMode === "external"
                        ? `External feed ${entry.feedLabel ?? entry.feedUrl ?? "source"}`
                        : "Pasted metadata feed"}
                    </div>
                    <div className="mt-0.5 text-[9px] uppercase tracking-[0.12em] text-[#60708c]">{entry.receivedAt}</div>
                  </div>
                ))}
              </div>
            ) : (
              <div className={`rounded-lg border border-dashed ${UI_SURFACES.borderSubtle} ${UI_SURFACES.panelDeep} px-2.5 py-2 text-[#7684a2]`}>
                No sensor ingest archive yet.
              </div>
            )}
          </div>
        </SectionCard>

        <div className="grid grid-cols-3 gap-2">
          <div className={`rounded-lg border ${UI_SURFACES.borderSubtle} ${UI_SURFACES.panel} px-2 py-2`}>
            <div className={`text-[9px] uppercase tracking-[0.14em] ${UI_SURFACES.textDimMid}`}>Total</div>
            <div className="mt-1 text-[18px] font-semibold text-white">{scene.sensors.length}</div>
          </div>
          <div className={`rounded-lg border ${UI_SURFACES.borderSubtle} ${UI_SURFACES.panel} px-2 py-2`}>
            <div className={`text-[9px] uppercase tracking-[0.14em] ${UI_SURFACES.textDimMid}`}>Active</div>
            <div className="mt-1 text-[18px] font-semibold text-emerald-300">{activeCount}</div>
          </div>
          <div className={`rounded-lg border ${UI_SURFACES.borderSubtle} ${UI_SURFACES.panel} px-2 py-2`}>
            <div className={`text-[9px] uppercase tracking-[0.14em] ${UI_SURFACES.textDimMid}`}>Inactive / Faulted</div>
            <div className="mt-1 text-[18px] font-semibold text-red-300">{faultedCount + inactiveCount}</div>
          </div>
        </div>

        <SectionCard title="Sensor Types" truthLabel="simulated">
          <div className="space-y-1.5">
            {(Object.keys(SENSOR_TYPE_LABELS) as SensorNode["sensorType"][]).map((sensorType) => (
              <div key={sensorType} className={`flex items-center justify-between gap-2 rounded-lg border ${UI_SURFACES.borderSubtle} ${UI_SURFACES.bgDeep} px-2 py-1.5`}>
                <div className="min-w-0">
                  <div className="truncate text-[10px] font-medium text-[#d8def0]">{SENSOR_TYPE_LABELS[sensorType]}</div>
                  <div className="text-[8px] uppercase tracking-[0.14em] text-[#5d6781]">Scene inventory</div>
                </div>
                <Badge variant="blue">{typeCounts[sensorType]}</Badge>
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard title="Sensor Inventory" truthLabel="simulated">
          <div className="space-y-2">
            {scene.sensors.length === 0 ? (
              <div className={`rounded-lg border border-dashed ${UI_SURFACES.border} ${UI_SURFACES.bgDeep} px-3 py-3 text-[10px] leading-relaxed ${UI_SURFACES.textMuted5}`}>
                No sensors placed yet. Use the placement controls above to add motion, access, or environmental sensors to the scene.
              </div>
            ) : (
              scene.sensors.map((sensor) => {
                const state = SENSOR_STATE_STYLES[sensor.state];
                const nearestCamera = nearestCameraName(sensor, scene.cameras);
                const nearestDistance = scene.cameras.length > 0
                  ? Math.min(...scene.cameras.map((camera) => {
                    const dx = camera.position[0] - sensor.position[0];
                    const dy = camera.position[1] - sensor.position[1];
                    const dz = camera.position[2] - sensor.position[2];
                    return Math.hypot(dx, dy, dz);
                  }))
                  : null;
                const isSelected = selectedNodeId === sensor.id;

                return (
                  <button
                    key={sensor.id}
                    type="button"
                    onClick={() => selectNode(sensor.id)}
                    className={cn(
                      "w-full rounded-lg border px-2.5 py-2 text-left transition-colors",
                      isSelected
                        ? "border-cyan-500/30 bg-cyan-500/10"
                        : `${UI_SURFACES.borderSubtle} ${UI_SURFACES.bgDeep} ${UI_SURFACES.hoverBorder} ${UI_SURFACES.hoverBgMuted}`,
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className={`truncate text-[10px] font-semibold ${UI_SURFACES.textBright}`}>{sensor.label}</div>
                        <div className={`text-[8px] uppercase tracking-[0.14em] ${UI_SURFACES.textSoftMid}`}>
                          {SENSOR_TYPE_LABELS[sensor.sensorType]} · {SENSOR_COVERAGE_LABELS[sensor.coverageMode]}
                        </div>
                      </div>
                      <Badge variant={state.tone}>{state.label}</Badge>
                    </div>
                    <div className="mt-2 grid grid-cols-3 gap-1.5 text-[9px] text-[#90a0bf]">
                      <div className={`rounded-md ${UI_SURFACES.panel} px-1.5 py-1`}>
                        <div className={`text-[8px] uppercase tracking-[0.14em] ${UI_SURFACES.textDimMid}`}>X/Z</div>
                        <div className="mt-0.5 font-mono">{sensor.position[0].toFixed(1)} / {sensor.position[2].toFixed(1)}</div>
                      </div>
                      <div className={`rounded-md ${UI_SURFACES.panel} px-1.5 py-1`}>
                        <div className={`text-[8px] uppercase tracking-[0.14em] ${UI_SURFACES.textDimMid}`}>Nearest Cam</div>
                        <div className="mt-0.5 truncate font-mono">{nearestCamera ?? "None"}</div>
                      </div>
                      <div className={`rounded-md ${UI_SURFACES.panel} px-1.5 py-1`}>
                        <div className={`text-[8px] uppercase tracking-[0.14em] ${UI_SURFACES.textDimMid}`}>Distance</div>
                        <div className="mt-0.5 font-mono">{formatDistance(nearestDistance)}</div>
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </SectionCard>

        {result ? (
          <div className={`rounded-lg border ${UI_SURFACES.borderSubtle} ${UI_SURFACES.bgDeep} px-3 py-2 text-[10px] leading-relaxed ${UI_SURFACES.textSoftBright}`}>
            Sensor live events now feed the operational evidence trail, and the external feed bridge can pull live JSON/NDJSON through the same ingest path before real ONVIF integration lands.
          </div>
        ) : null}
      </div>
    </div>
  );
}
