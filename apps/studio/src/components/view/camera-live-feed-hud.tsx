"use client";

import { formatCameraTag, formatTargetTypeLabel } from "@/components/view/camera-view-utils";
import type { CameraFeedMode, OverlayFlags } from "@/components/view/camera-view-chrome";
import type { OperationalEvidenceFusionSummary } from "@/lib/sensor-fusion";
import { nowTimestamp } from "@/components/view/scene-feed-canvas-utils";
import type { CameraNode, SimulationAssumptions, SecurityScene } from "@/schema/security-scene";
import { QUALITY_TEXT_COLOR } from "@/lib/quality-display";

import { UI_SURFACES } from "@/lib/studio-surface-tokens";
type SensorFusionSummary = {
  totalCount: number;
  activeCount: number;
  nearestSensorLabel: string;
  nearestSensorState: string;
  nearestSensorCoverage: string;
  nearestDistanceM: number | null;
};

type SensorEvent = {
  sensorLabel: string;
  kind: string;
  resultingState: string | null;
  nearestCameraName: string | null;
  nearestDistanceM: number | null;
  timestamp: number;
  details: string;
} | null;

type CameraMetadataEvent = {
  cameraName: string;
  status: string | null;
  clarity: string | null;
  nightMode: string | null;
  feedMode: string | null;
  ingestMode: "paste" | "external";
  feedLabel: string | null;
  feedUrl: string | null;
  summary: string;
  notes: string | null;
  timestamp: number;
} | null;

type CameraLiveConnectionEvent = {
  cameraName: string;
  liveFeedUrl: string | null;
  liveFeedLabel: string | null;
  liveSessionId: string | null;
  liveSessionState: "idle" | "probing" | "connected" | "error" | null;
  liveSessionStartedAt: number | null;
  liveSessionConfirmedAt: number | null;
  liveSessionExpiresAt: number | null;
  transportSessionId: string | null;
  transportSessionState: "idle" | "negotiating" | "active" | "closing" | "error" | null;
  lastHeartbeatAt: number | null;
  probeCount: number;
  protocolProfile: "onvif_device" | "rtsp_session" | "mjpeg_stream" | "http_poll" | "proxy" | null;
  authMode: "none" | "basic" | "digest" | "token" | "cookie" | "onvif_digest" | "proxy_passthrough" | null;
  authState: "unauthenticated" | "authenticating" | "authenticated" | "failed" | null;
  authRealm: string | null;
  authSessionId: string | null;
  authSessionExpiresAt: number | null;
  transportResponseStatus: number | null;
  transportResponseStatusText: string | null;
  authChallengeHeader: string | null;
  authChallengeScheme: "basic" | "digest" | "bearer" | "token" | null;
  authChallengeRealm: string | null;
  eventSubscriptionUri: string | null;
  eventSubscriptionReference: string | null;
  eventSubscriptionExpiresAt: number | null;
  liveConnectionMode: "rtsp" | "mjpeg" | "http" | "onvif" | "proxy" | null;
  liveConnectionStatus: "disconnected" | "connecting" | "connected" | "error" | null;
  ingestMode: "manual" | "external";
  summary: string;
  notes: string | null;
  timestamp: number;
} | null;

function rangeMeters(camera: CameraNode, ppm: SimulationAssumptions["pixelsPerMeter"]) {
  const width = camera.resolutionWidth ?? (camera.resolutionMP >= 8 ? 3840 : camera.resolutionMP >= 4 ? 2688 : 1920);
  const tanHalfFov = Math.tan((camera.fovHorizontalDeg / 2) * (Math.PI / 180));
  return {
    detection: Math.min(width / (2 * ppm.detection * tanHalfFov), camera.rangeM),
    observation: Math.min(width / (2 * ppm.observation * tanHalfFov), camera.rangeM),
    recognition: Math.min(width / (2 * ppm.recognition * tanHalfFov), camera.rangeM),
    identification: Math.min(width / (2 * ppm.identification * tanHalfFov), camera.rangeM),
  };
}

function modeLabel(mode: CameraFeedMode) {
  return mode === "normal" ? "Normal" : mode === "ir_bw" ? "IR (B/W)" : mode === "low_light" ? "Low Light" : "Thermal";
}

function CameraNoise() {
  return (
    <div
      className="pointer-events-none absolute inset-0"
      style={{
        backgroundImage:
          "repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(0,0,0,0.04) 3px, rgba(0,0,0,0.04) 4px)",
      }}
    />
  );
}

export function LiveFeedHUD({
  camera: cam,
  mode,
  flags,
  ppm,
  targetType,
  sensorFusion,
  sensorEvent,
  cameraMetadataEvent,
  cameraLiveConnectionEvent,
  operationalFusion,
  simulationAssumptions,
  leftAddons,
  rightAddons,
}: {
  camera: CameraNode;
  mode: CameraFeedMode;
  flags: OverlayFlags;
  ppm: SimulationAssumptions["pixelsPerMeter"];
  targetType?: SecurityScene["criticalZones"][number]["targetType"];
  sensorFusion: SensorFusionSummary;
  sensorEvent: SensorEvent;
  cameraMetadataEvent: CameraMetadataEvent;
  cameraLiveConnectionEvent: CameraLiveConnectionEvent;
  operationalFusion: OperationalEvidenceFusionSummary | null;
  simulationAssumptions: SimulationAssumptions;
  leftAddons?: React.ReactNode;
  rightAddons?: React.ReactNode;
}) {
  const ranges = rangeMeters(cam, ppm);
  const realismFlags = [
    simulationAssumptions.timeOfDay !== "day" ? `Light: ${simulationAssumptions.timeOfDay}` : null,
    simulationAssumptions.backlightIntensity !== "none" ? `Backlight: ${simulationAssumptions.backlightIntensity}` : null,
    simulationAssumptions.glareIntensity !== "none" ? `Glare: ${simulationAssumptions.glareIntensity}` : null,
    simulationAssumptions.overexposedZones ? "Overexposure risk" : null,
  ].filter((entry): entry is string => Boolean(entry));

  return (
    <>
      <div className="pointer-events-none absolute inset-x-0 top-0 h-16 bg-linear-to-b from-black/80 to-transparent" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-linear-to-t from-black/85 to-transparent" />

      {/* Top-Right Spec Badge */}
      <div className="absolute right-3 top-3 z-30 flex flex-col items-end gap-0.5 pointer-events-auto">
        <span className={`rounded border ${UI_SURFACES.border} ${UI_SURFACES.panel}/90 px-2 py-0.5 text-[9px] font-semibold text-[#93c5fd] shadow-sm`}>
          {cam.resolutionMP}MP · {cam.fovHorizontalDeg}°
        </span>
        <span className="font-mono text-[8px] text-white/70 [text-shadow:0_1px_4px_rgba(0,0,0,0.9)]">
          {cam.mountType.toUpperCase()}
        </span>
        {flags.timestamp ? (
          <span className="font-mono text-[8px] text-white/75 [text-shadow:0_1px_4px_rgba(0,0,0,0.9)]">
            {nowTimestamp()}
          </span>
        ) : null}
      </div>

      {/* Left Sidebar Stack */}
      <div className="absolute left-3 top-16 z-30 flex w-64 max-h-[calc(100vh-13rem)] flex-col gap-2.5 overflow-y-auto pointer-events-none pr-1 scrollbar-none">
        <div className="flex flex-wrap gap-1.5 pointer-events-auto">
          <span className={`rounded-md border ${UI_SURFACES.borderElevated} ${UI_SURFACES.panel}/90 px-2 py-1 text-[8px] font-semibold ${UI_SURFACES.textMuted3} shadow-sm`}>
            Mode: {modeLabel(mode)}
          </span>
          <span className={`rounded-md border ${UI_SURFACES.borderElevated} ${UI_SURFACES.panel}/90 px-2 py-1 text-[8px] font-semibold ${UI_SURFACES.textMuted3} shadow-sm`}>
            LIVE (SIMULATED)
          </span>
        </div>

        {leftAddons}

        {sensorEvent ? (
          <div className={`pointer-events-auto rounded-xl border border-cyan-400/20 ${UI_SURFACES.panel}/92 px-3 py-2.5 shadow-[0_12px_34px_rgba(0,0,0,0.35)]`}>
            <div className="text-[8px] font-semibold uppercase tracking-[0.22em] text-cyan-300">Live Sensor Event</div>
            <div className="mt-1 text-[10px] font-semibold text-white">{sensorEvent.sensorLabel}</div>
            <div className={`mt-1 grid grid-cols-2 gap-x-3 gap-y-1 text-[9px] ${UI_SURFACES.textBody2}`}>
              <div>
                <span className={`${UI_SURFACES.textSoftMid}`}>Type:</span> {sensorEvent.kind}
              </div>
              <div>
                <span className={`${UI_SURFACES.textSoftMid}`}>State:</span> {sensorEvent.resultingState ?? "—"}
              </div>
              <div>
                <span className={`${UI_SURFACES.textSoftMid}`}>Camera:</span> {sensorEvent.nearestCameraName ?? "None"}
              </div>
              <div>
                <span className={`${UI_SURFACES.textSoftMid}`}>Distance:</span>{" "}
                {sensorEvent.nearestDistanceM == null ? "—" : `${sensorEvent.nearestDistanceM.toFixed(1)}m`}
              </div>
            </div>
            <div className={`mt-1 text-[8px] ${UI_SURFACES.textMuted3}`}>{sensorEvent.details}</div>
          </div>
        ) : null}

        {realismFlags.length > 0 ? (
          <div className={`pointer-events-auto rounded-xl border border-amber-400/20 ${UI_SURFACES.panel}/92 px-3 py-2 text-[8px] text-amber-100 shadow-sm`}>
            <div className="font-semibold uppercase tracking-[0.16em] text-amber-200">Feed realism model</div>
            <div className="mt-1 flex flex-wrap gap-1">
              {realismFlags.map((flag) => (
                <span key={flag} className="rounded border border-amber-300/20 bg-amber-500/12 px-1.5 py-0.5">
                  {flag}
                </span>
              ))}
            </div>
          </div>
        ) : null}

        {flags.path || flags.zones || flags.overlays || flags.grid ? (
          <div className={`pointer-events-auto flex flex-col gap-1 rounded-xl border ${UI_SURFACES.borderElevated} ${UI_SURFACES.panel}/90 px-3 py-2 text-[8px] ${UI_SURFACES.textMuted3} shadow-sm`}>
            <div className={`font-semibold uppercase tracking-[0.16em] ${UI_SURFACES.textAccent}`}>Active Overlays</div>
            {flags.overlays ? <span>• Overlays: enabled</span> : null}
            {flags.path ? <span>• Path overlays</span> : null}
            {flags.zones ? <span>• Zone overlays</span> : null}
            {flags.grid ? <span>• Floor grid</span> : null}
          </div>
        ) : null}
      </div>

      {/* Right Sidebar Stack */}
      <div className="absolute right-3 top-16 z-30 flex w-72 max-h-[calc(100vh-13rem)] flex-col gap-2.5 overflow-y-auto pointer-events-none pl-1 scrollbar-none">
        {flags.dori ? (
          <div className={`pointer-events-auto flex flex-col gap-1 rounded-xl border ${UI_SURFACES.borderElevated} ${UI_SURFACES.panel}/92 px-3 py-2.5 text-[9px] ${UI_SURFACES.textBody2} shadow-sm`}>
            <div className="text-[8px] font-semibold uppercase tracking-[0.2em] ${UI_SURFACES.textMuted3}">DORI RANGES AT TARGET</div>
            <div className="space-y-0.5 mt-1">
              <div className="flex justify-between"><span>Detection</span><span className={"font-mono " + QUALITY_TEXT_COLOR.detection}>{ranges.detection.toFixed(1)}m</span></div>
              <div className="flex justify-between"><span>Observation</span><span className={"font-mono " + QUALITY_TEXT_COLOR.observation}>{ranges.observation.toFixed(1)}m</span></div>
              <div className="flex justify-between"><span>Recognition</span><span className={"font-mono " + QUALITY_TEXT_COLOR.recognition}>{ranges.recognition.toFixed(1)}m</span></div>
              <div className="flex justify-between"><span>Identification</span><span className={"font-mono " + QUALITY_TEXT_COLOR.identification}>{ranges.identification.toFixed(1)}m</span></div>
            </div>
            {targetType ? <div className="mt-1 border-t ${UI_SURFACES.borderElevated} pt-1 text-[8px] uppercase tracking-wide text-[#7a94c7]">Target: {formatTargetTypeLabel(targetType)}</div> : null}
            <div className="text-[8px] ${UI_SURFACES.textMuted3}">Mode: {modeLabel(mode)}</div>
          </div>
        ) : null}

        {rightAddons}

        {sensorFusion.totalCount > 0 ? (
          <div className={`pointer-events-auto rounded-xl border border-cyan-400/20 ${UI_SURFACES.panel}/92 px-3 py-2.5 shadow-[0_12px_34px_rgba(0,0,0,0.35)]`}>
            <div className="text-[8px] font-semibold uppercase tracking-[0.22em] text-cyan-300">Sensor Fusion</div>
            <div className="mt-1 text-[10px] font-semibold text-white">{sensorFusion.nearestSensorLabel}</div>
            <div className={`mt-1 grid grid-cols-2 gap-x-3 gap-y-1 text-[9px] ${UI_SURFACES.textBody2}`}>
              <div>
                <span className={`${UI_SURFACES.textSoftMid}`}>Distance:</span>{" "}
                {sensorFusion.nearestDistanceM == null ? "—" : `${sensorFusion.nearestDistanceM.toFixed(1)}m`}
              </div>
              <div>
                <span className={`${UI_SURFACES.textSoftMid}`}>State:</span> {sensorFusion.nearestSensorState}
              </div>
              <div>
                <span className={`${UI_SURFACES.textSoftMid}`}>Coverage:</span> {sensorFusion.nearestSensorCoverage}
              </div>
              <div>
                <span className={`${UI_SURFACES.textSoftMid}`}>Active:</span> {sensorFusion.activeCount} / {sensorFusion.totalCount}
              </div>
            </div>
          </div>
        ) : null}

        {cameraMetadataEvent ? (
          <div className={`pointer-events-auto rounded-xl border border-emerald-400/18 ${UI_SURFACES.panel}/92 px-3 py-2.5 shadow-[0_12px_34px_rgba(0,0,0,0.35)]`}>
            <div className="text-[8px] font-semibold uppercase tracking-[0.22em] text-emerald-300">Live Camera Metadata</div>
            <div className="mt-1 text-[10px] font-semibold text-white">{cameraMetadataEvent.cameraName}</div>
            <div className={`mt-1 grid grid-cols-2 gap-x-3 gap-y-1 text-[9px] ${UI_SURFACES.textBody2}`}>
              <div><span className={`${UI_SURFACES.textSoftMid}`}>Status:</span> {cameraMetadataEvent.status ?? "—"}</div>
              <div><span className={`${UI_SURFACES.textSoftMid}`}>Clarity:</span> {cameraMetadataEvent.clarity ?? "—"}</div>
              <div><span className={`${UI_SURFACES.textSoftMid}`}>Night:</span> {cameraMetadataEvent.nightMode ?? "—"}</div>
              <div><span className={`${UI_SURFACES.textSoftMid}`}>Mode:</span> {cameraMetadataEvent.feedMode ?? cameraMetadataEvent.ingestMode}</div>
            </div>
            <div className={`mt-1 text-[8px] ${UI_SURFACES.textMuted3}`}>
              {cameraMetadataEvent.feedLabel ? `${cameraMetadataEvent.feedLabel} · ` : ""}
              {cameraMetadataEvent.summary}
            </div>
          </div>
        ) : null}

        {cameraLiveConnectionEvent ? (
          <div className={`pointer-events-auto rounded-xl border border-cyan-400/18 ${UI_SURFACES.panel}/92 px-3 py-2.5 shadow-[0_12px_34px_rgba(0,0,0,0.35)]`}>
            <div className="text-[8px] font-semibold uppercase tracking-[0.22em] text-cyan-300">Live Camera Connection</div>
            <div className="mt-1 text-[10px] font-semibold text-white">{cameraLiveConnectionEvent.cameraName}</div>
            <div className={`mt-1 grid grid-cols-2 gap-x-3 gap-y-1 text-[9px] ${UI_SURFACES.textBody2}`}>
              <div><span className={`${UI_SURFACES.textSoftMid}`}>Status:</span> {cameraLiveConnectionEvent.liveConnectionStatus ?? "—"}</div>
              <div><span className={`${UI_SURFACES.textSoftMid}`}>Mode:</span> {cameraLiveConnectionEvent.liveConnectionMode ?? "—"}</div>
              <div><span className={`${UI_SURFACES.textSoftMid}`}>Session:</span> {cameraLiveConnectionEvent.liveSessionState ?? "—"}</div>
              <div><span className={`${UI_SURFACES.textSoftMid}`}>Session ID:</span> {cameraLiveConnectionEvent.liveSessionId ?? "—"}</div>
              <div><span className={`${UI_SURFACES.textSoftMid}`}>Transport:</span> {cameraLiveConnectionEvent.transportSessionState ?? "—"}</div>
              <div><span className={`${UI_SURFACES.textSoftMid}`}>Protocol:</span> {cameraLiveConnectionEvent.protocolProfile ?? "—"}</div>
              <div><span className={`${UI_SURFACES.textSoftMid}`}>Auth:</span> {cameraLiveConnectionEvent.authState ?? "—"} · {cameraLiveConnectionEvent.authMode ?? "—"}</div>
              <div><span className={`${UI_SURFACES.textSoftMid}`}>Auth session:</span> {cameraLiveConnectionEvent.authSessionId ?? "—"}</div>
              <div className="col-span-2"><span className={`${UI_SURFACES.textSoftMid}`}>Feed:</span> {cameraLiveConnectionEvent.liveFeedLabel ?? cameraLiveConnectionEvent.liveFeedUrl ?? "—"}</div>
            </div>
            <div className={`mt-1 grid grid-cols-2 gap-x-3 gap-y-1 text-[8px] ${UI_SURFACES.textMuted3}`}>
              <div><span className={`${UI_SURFACES.textSoftMid}`}>Started:</span> {cameraLiveConnectionEvent.liveSessionStartedAt == null ? "—" : new Date(cameraLiveConnectionEvent.liveSessionStartedAt).toLocaleTimeString()}</div>
              <div><span className={`${UI_SURFACES.textSoftMid}`}>Confirmed:</span> {cameraLiveConnectionEvent.liveSessionConfirmedAt == null ? "—" : new Date(cameraLiveConnectionEvent.liveSessionConfirmedAt).toLocaleTimeString()}</div>
              <div className="col-span-2"><span className={`${UI_SURFACES.textSoftMid}`}>Expires:</span> {cameraLiveConnectionEvent.liveSessionExpiresAt == null ? "—" : new Date(cameraLiveConnectionEvent.liveSessionExpiresAt).toLocaleTimeString()}</div>
              <div className="col-span-2"><span className={`${UI_SURFACES.textSoftMid}`}>Auth expires:</span> {cameraLiveConnectionEvent.authSessionExpiresAt == null ? "—" : new Date(cameraLiveConnectionEvent.authSessionExpiresAt).toLocaleTimeString()}</div>
              <div className="col-span-2"><span className={`${UI_SURFACES.textSoftMid}`}>Challenge:</span> {cameraLiveConnectionEvent.authChallengeHeader ?? "—"}</div>
              <div><span className={`${UI_SURFACES.textSoftMid}`}>Events:</span> {cameraLiveConnectionEvent.eventSubscriptionUri ?? "—"}</div>
              <div><span className={`${UI_SURFACES.textSoftMid}`}>Transport response:</span> {cameraLiveConnectionEvent.transportResponseStatus == null ? "—" : `${cameraLiveConnectionEvent.transportResponseStatus}${cameraLiveConnectionEvent.transportResponseStatusText ? ` ${cameraLiveConnectionEvent.transportResponseStatusText}` : ""}`}</div>
              <div><span className={`${UI_SURFACES.textSoftMid}`}>Event ref:</span> {cameraLiveConnectionEvent.eventSubscriptionReference ?? "—"}</div>
              <div><span className={`${UI_SURFACES.textSoftMid}`}>Challenge scheme:</span> {cameraLiveConnectionEvent.authChallengeScheme ?? "—"}</div>
              <div className="col-span-2"><span className={`${UI_SURFACES.textSoftMid}`}>Event expiry:</span> {cameraLiveConnectionEvent.eventSubscriptionExpiresAt == null ? "—" : new Date(cameraLiveConnectionEvent.eventSubscriptionExpiresAt).toLocaleTimeString()}</div>
              <div className="col-span-2"><span className={`${UI_SURFACES.textSoftMid}`}>Heartbeat:</span> {cameraLiveConnectionEvent.lastHeartbeatAt == null ? "—" : new Date(cameraLiveConnectionEvent.lastHeartbeatAt).toLocaleTimeString()} · probes {cameraLiveConnectionEvent.probeCount}</div>
            </div>
            <div className={`mt-1 text-[8px] ${UI_SURFACES.textMuted3}`}>
              {cameraLiveConnectionEvent.ingestMode === "external" ? "External bind" : "Manual bind"} · {cameraLiveConnectionEvent.summary}
            </div>
          </div>
        ) : null}

        <CameraNoise />
        {operationalFusion && (operationalFusion.operationalHealth !== "unknown" || operationalFusion.sensorFusion.totalCount > 0 || operationalFusion.cameraMetadataEvent || operationalFusion.cameraLiveConnectionEvent) ? (
          <div className={`pointer-events-auto rounded-xl border ${UI_SURFACES.border} ${UI_SURFACES.panel}/92 px-3 py-2 text-[8px] ${UI_SURFACES.textMuted3} shadow-sm`}>
            <div className={`text-[8px] font-semibold uppercase tracking-[0.18em] ${UI_SURFACES.textAccent}`}>Operational Evidence</div>
            <div className="mt-1 text-[9px] font-semibold text-white">{operationalFusion.operationalHealthLabel}</div>
            <div className={`mt-1 text-[8px] ${UI_SURFACES.textMuted4}`}>{operationalFusion.operationalHealthDetail}</div>
          </div>
        ) : null}
      </div>
    </>
  );
}
