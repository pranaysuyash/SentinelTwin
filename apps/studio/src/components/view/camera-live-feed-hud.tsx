"use client";

import { formatCameraTag, formatTargetTypeLabel } from "@/components/view/camera-view-utils";
import type { CameraFeedMode, OverlayFlags } from "@/components/view/camera-view-chrome";
import type { OperationalEvidenceFusionSummary } from "@/lib/sensor-fusion";
import { nowTimestamp } from "@/components/view/scene-feed-canvas-utils";
import type { CameraNode, SimulationAssumptions, SecurityScene } from "@/schema/security-scene";

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
}) {
  const isActive = cam.status === "on";
  const ranges = rangeMeters(cam, ppm);
  return (
    <>
      <div className="pointer-events-none absolute inset-x-0 top-0 h-16 bg-linear-to-b from-black/80 to-transparent" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-linear-to-t from-black/85 to-transparent" />

      <div className="absolute left-3 top-3 flex items-center gap-2">
        <span className={`h-2 w-2 rounded-full ${isActive ? "bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.9)]" : "bg-red-400"}`} />
        <span className="text-[11px] font-bold uppercase tracking-wide text-white [text-shadow:0_1px_6px_rgba(0,0,0,0.9)]">
          {formatCameraTag(cam.name)}
        </span>
        <span className="text-[11px] font-bold text-white/80 [text-shadow:0_1px_6px_rgba(0,0,0,0.9)]">
          {cam.name}
        </span>
        <span className="rounded bg-emerald-500/30 px-1.5 py-0.5 text-[8px] font-semibold uppercase tracking-wide text-emerald-300">{isActive ? "Active" : "Offline"}</span>
      </div>

      <div className="absolute right-3 top-3 flex flex-col items-end gap-0.5">
        <span className="rounded bg-black/60 px-2 py-0.5 text-[8px] font-semibold text-[#93c5fd]">{cam.resolutionMP}MP · {cam.fovHorizontalDeg}°</span>
        <span className="font-mono text-[8px] text-white/70 [text-shadow:0_1px_4px_rgba(0,0,0,0.9)]">{cam.mountType.toUpperCase()}</span>
        {flags.timestamp ? <span className="font-mono text-[8px] text-white/75 [text-shadow:0_1px_4px_rgba(0,0,0,0.9)]">{nowTimestamp()}</span> : null}
      </div>

      {flags.dori ? (
        <div className="absolute right-3 top-24 flex w-48 flex-col gap-1 rounded-lg border border-[#2d3d56] bg-black/55 px-2 py-2 text-[9px] text-[#cdd6ef]">
          <div className="text-[8px] font-semibold uppercase tracking-[0.2em] text-[#87a5cf]">DORI RANGES AT TARGET</div>
          <div className="space-y-0.5">
            <div className="flex justify-between"><span>Detection</span><span className="font-mono text-[#f97316]">{ranges.detection.toFixed(1)}m</span></div>
            <div className="flex justify-between"><span>Observation</span><span className="font-mono text-[#eab308]">{ranges.observation.toFixed(1)}m</span></div>
            <div className="flex justify-between"><span>Recognition</span><span className="font-mono text-[#22c55e]">{ranges.recognition.toFixed(1)}m</span></div>
            <div className="flex justify-between"><span>Identification</span><span className="font-mono text-[#60a5fa]">{ranges.identification.toFixed(1)}m</span></div>
          </div>
          {targetType ? <div className="mt-1 border-t border-[#334563] pt-1 text-[8px] uppercase tracking-wide text-[#7a94c7]">Target: {formatTargetTypeLabel(targetType)}</div> : null}
          <div className="text-[8px] text-[#95a9cf]">Mode: {modeLabel(mode)}</div>
        </div>
      ) : null}

      <div className="absolute left-3 bottom-3 flex flex-wrap gap-2 text-[8px] text-[#95a9cf]">
        <span className="rounded border border-[#2d3d56] bg-black/45 px-2 py-1">Mode: {modeLabel(mode)}</span>
        <span className="rounded border border-[#2d3d56] bg-black/45 px-2 py-1">LIVE MODE (SIMULATED)</span>
      </div>

      {flags.path || flags.zones || flags.overlays || flags.grid ? (
        <div className="absolute left-3 top-20 flex flex-col gap-1 rounded-lg border border-[#2d3d56] bg-black/40 px-2 py-1.5 text-[8px] text-[#8ea6cc]">
          {flags.overlays ? <span>• Overlays: enabled</span> : null}
          {flags.path ? <span>• Path overlays</span> : null}
          {flags.zones ? <span>• Zone overlays</span> : null}
          {flags.grid ? <span>• Floor grid</span> : null}
        </div>
      ) : null}

      {sensorFusion.totalCount > 0 ? (
        <div className="absolute right-3 bottom-24 z-30 rounded-xl border border-cyan-400/20 bg-[#0b0f17]/92 px-3 py-2.5 shadow-[0_12px_34px_rgba(0,0,0,0.35)] backdrop-blur-sm">
          <div className="text-[8px] font-semibold uppercase tracking-[0.22em] text-cyan-300">Sensor Fusion</div>
          <div className="mt-1 text-[10px] font-semibold text-white">{sensorFusion.nearestSensorLabel}</div>
          <div className="mt-1 grid grid-cols-2 gap-x-3 gap-y-1 text-[9px] text-[#d2d9e8]">
            <div>
              <span className="text-[#6a748b]">Distance:</span>{" "}
              {sensorFusion.nearestDistanceM == null ? "—" : `${sensorFusion.nearestDistanceM.toFixed(1)}m`}
            </div>
            <div>
              <span className="text-[#6a748b]">State:</span> {sensorFusion.nearestSensorState}
            </div>
            <div>
              <span className="text-[#6a748b]">Coverage:</span> {sensorFusion.nearestSensorCoverage}
            </div>
            <div>
              <span className="text-[#6a748b]">Active:</span> {sensorFusion.activeCount} / {sensorFusion.totalCount}
            </div>
          </div>
        </div>
      ) : null}

      {sensorEvent ? (
        <div className="absolute left-3 top-20 z-30 rounded-xl border border-cyan-400/18 bg-[#0b0f17]/92 px-3 py-2.5 shadow-[0_12px_34px_rgba(0,0,0,0.35)] backdrop-blur-sm">
          <div className="text-[8px] font-semibold uppercase tracking-[0.22em] text-cyan-300">Live Sensor Event</div>
          <div className="mt-1 text-[10px] font-semibold text-white">{sensorEvent.sensorLabel}</div>
          <div className="mt-1 grid grid-cols-2 gap-x-3 gap-y-1 text-[9px] text-[#d2d9e8]">
            <div>
              <span className="text-[#6a748b]">Type:</span> {sensorEvent.kind}
            </div>
            <div>
              <span className="text-[#6a748b]">State:</span> {sensorEvent.resultingState ?? "—"}
            </div>
            <div>
              <span className="text-[#6a748b]">Camera:</span> {sensorEvent.nearestCameraName ?? "None"}
            </div>
            <div>
              <span className="text-[#6a748b]">Distance:</span>{" "}
              {sensorEvent.nearestDistanceM == null ? "—" : `${sensorEvent.nearestDistanceM.toFixed(1)}m`}
            </div>
          </div>
          <div className="mt-1 text-[8px] text-[#8ea6cc]">{sensorEvent.details}</div>
        </div>
      ) : null}

      {cameraMetadataEvent ? (
        <div className="absolute right-3 bottom-52 z-30 rounded-xl border border-emerald-400/18 bg-[#0b0f17]/92 px-3 py-2.5 shadow-[0_12px_34px_rgba(0,0,0,0.35)] backdrop-blur-sm">
          <div className="text-[8px] font-semibold uppercase tracking-[0.22em] text-emerald-300">Live Camera Metadata</div>
          <div className="mt-1 text-[10px] font-semibold text-white">{cameraMetadataEvent.cameraName}</div>
          <div className="mt-1 grid grid-cols-2 gap-x-3 gap-y-1 text-[9px] text-[#d2d9e8]">
            <div><span className="text-[#6a748b]">Status:</span> {cameraMetadataEvent.status ?? "—"}</div>
            <div><span className="text-[#6a748b]">Clarity:</span> {cameraMetadataEvent.clarity ?? "—"}</div>
            <div><span className="text-[#6a748b]">Night:</span> {cameraMetadataEvent.nightMode ?? "—"}</div>
            <div><span className="text-[#6a748b]">Mode:</span> {cameraMetadataEvent.feedMode ?? cameraMetadataEvent.ingestMode}</div>
          </div>
          <div className="mt-1 text-[8px] text-[#8ea6cc]">
            {cameraMetadataEvent.feedLabel ? `${cameraMetadataEvent.feedLabel} · ` : ""}
            {cameraMetadataEvent.summary}
          </div>
        </div>
      ) : null}

      {cameraLiveConnectionEvent ? (
        <div className="absolute right-3 bottom-80 z-30 rounded-xl border border-cyan-400/18 bg-[#0b0f17]/92 px-3 py-2.5 shadow-[0_12px_34px_rgba(0,0,0,0.35)] backdrop-blur-sm">
          <div className="text-[8px] font-semibold uppercase tracking-[0.22em] text-cyan-300">Live Camera Connection</div>
          <div className="mt-1 text-[10px] font-semibold text-white">{cameraLiveConnectionEvent.cameraName}</div>
          <div className="mt-1 grid grid-cols-2 gap-x-3 gap-y-1 text-[9px] text-[#d2d9e8]">
            <div><span className="text-[#6a748b]">Status:</span> {cameraLiveConnectionEvent.liveConnectionStatus ?? "—"}</div>
            <div><span className="text-[#6a748b]">Mode:</span> {cameraLiveConnectionEvent.liveConnectionMode ?? "—"}</div>
            <div><span className="text-[#6a748b]">Session:</span> {cameraLiveConnectionEvent.liveSessionState ?? "—"}</div>
            <div><span className="text-[#6a748b]">Session ID:</span> {cameraLiveConnectionEvent.liveSessionId ?? "—"}</div>
            <div><span className="text-[#6a748b]">Transport:</span> {cameraLiveConnectionEvent.transportSessionState ?? "—"}</div>
            <div><span className="text-[#6a748b]">Protocol:</span> {cameraLiveConnectionEvent.protocolProfile ?? "—"}</div>
            <div><span className="text-[#6a748b]">Auth:</span> {cameraLiveConnectionEvent.authState ?? "—"} · {cameraLiveConnectionEvent.authMode ?? "—"}</div>
            <div><span className="text-[#6a748b]">Auth session:</span> {cameraLiveConnectionEvent.authSessionId ?? "—"}</div>
            <div className="col-span-2"><span className="text-[#6a748b]">Feed:</span> {cameraLiveConnectionEvent.liveFeedLabel ?? cameraLiveConnectionEvent.liveFeedUrl ?? "—"}</div>
          </div>
          <div className="mt-1 grid grid-cols-2 gap-x-3 gap-y-1 text-[8px] text-[#8ea6cc]">
            <div><span className="text-[#6a748b]">Started:</span> {cameraLiveConnectionEvent.liveSessionStartedAt == null ? "—" : new Date(cameraLiveConnectionEvent.liveSessionStartedAt).toLocaleTimeString()}</div>
            <div><span className="text-[#6a748b]">Confirmed:</span> {cameraLiveConnectionEvent.liveSessionConfirmedAt == null ? "—" : new Date(cameraLiveConnectionEvent.liveSessionConfirmedAt).toLocaleTimeString()}</div>
            <div className="col-span-2"><span className="text-[#6a748b]">Expires:</span> {cameraLiveConnectionEvent.liveSessionExpiresAt == null ? "—" : new Date(cameraLiveConnectionEvent.liveSessionExpiresAt).toLocaleTimeString()}</div>
            <div className="col-span-2"><span className="text-[#6a748b]">Auth expires:</span> {cameraLiveConnectionEvent.authSessionExpiresAt == null ? "—" : new Date(cameraLiveConnectionEvent.authSessionExpiresAt).toLocaleTimeString()}</div>
            <div className="col-span-2"><span className="text-[#6a748b]">Challenge:</span> {cameraLiveConnectionEvent.authChallengeHeader ?? "—"}</div>
            <div><span className="text-[#6a748b]">Transport response:</span> {cameraLiveConnectionEvent.transportResponseStatus == null ? "—" : `${cameraLiveConnectionEvent.transportResponseStatus}${cameraLiveConnectionEvent.transportResponseStatusText ? ` ${cameraLiveConnectionEvent.transportResponseStatusText}` : ""}`}</div>
            <div><span className="text-[#6a748b]">Challenge scheme:</span> {cameraLiveConnectionEvent.authChallengeScheme ?? "—"}</div>
            <div className="col-span-2"><span className="text-[#6a748b]">Heartbeat:</span> {cameraLiveConnectionEvent.lastHeartbeatAt == null ? "—" : new Date(cameraLiveConnectionEvent.lastHeartbeatAt).toLocaleTimeString()} · probes {cameraLiveConnectionEvent.probeCount}</div>
          </div>
          <div className="mt-1 text-[8px] text-[#8ea6cc]">
            {cameraLiveConnectionEvent.ingestMode === "external" ? "External bind" : "Manual bind"} · {cameraLiveConnectionEvent.summary}
          </div>
        </div>
      ) : null}

      <CameraNoise />
      {operationalFusion && (operationalFusion.operationalHealth !== "unknown" || operationalFusion.sensorFusion.totalCount > 0 || operationalFusion.cameraMetadataEvent || operationalFusion.cameraLiveConnectionEvent) ? (
        <div className="absolute right-3 bottom-8 z-30 rounded-lg border border-[#243146] bg-[#0b0f17]/92 px-2.5 py-2 text-[8px] text-[#8ea6cc] shadow-[0_12px_24px_rgba(0,0,0,0.35)] backdrop-blur-sm">
          <div className="text-[8px] font-semibold uppercase tracking-[0.18em] text-[#7dd3fc]">Operational Evidence</div>
          <div className="mt-1 text-[9px] font-semibold text-white">{operationalFusion.operationalHealthLabel}</div>
          <div className="mt-1 text-[8px] text-[#9ab0ce]">{operationalFusion.operationalHealthDetail}</div>
        </div>
      ) : null}
    </>
  );
}
