"use client";

import { ArrowLeft, Camera, ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { formatCameraTag, formatTargetTypeLabel } from "@/components/view/camera-view-utils";
import type { CameraNode, SecurityScene } from "@/schema/security-scene";

import { UI_SURFACES } from "@/lib/studio-surface-tokens";
export type CameraFeedMode = "normal" | "ir_bw" | "low_light" | "thermal";

export type OverlayFlags = {
  overlays: boolean;
  dori: boolean;
  path: boolean;
  zones: boolean;
  timestamp: boolean;
  grid: boolean;
};

export function CameraModeFilter({ mode }: { mode: CameraFeedMode }) {
  if (mode === "ir_bw") {
    return (
      <div
        className="pointer-events-none absolute inset-0 opacity-30"
        style={{
          background: "linear-gradient(170deg, rgba(232,244,255,0.12), rgba(0,0,0,0.24))",
          mixBlendMode: "soft-light",
        }}
      />
    );
  }

  if (mode === "low_light") {
    return <div className="pointer-events-none absolute inset-0 UI_SURFACES.card/40" />;
  }

  if (mode === "thermal") {
    return (
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background: "linear-gradient(180deg, rgba(173,239,255,0.08), rgba(17,24,39,0.4))",
          filter: "sepia(0.15)",
          mixBlendMode: "color-dodge",
        }}
      />
    );
  }

  return null;
}

export function CameraHeader({
  camera,
  index,
  total,
  cameras,
  onPrevious,
  onNext,
  onSelect,
}: {
  camera: CameraNode;
  index: number;
  total: number;
  cameras: CameraNode[];
  onPrevious: () => void;
  onNext: () => void;
  onSelect: (id: string) => void;
}) {
  const isActive = camera.status === "on";
  return (
    <div className={`absolute left-3 top-3 z-30 flex items-center gap-3 rounded-xl border UI_SURFACES.border UI_SURFACES.panel/90 px-3 py-2 shadow-[0_8px_24px_rgba(0,0,0,0.4)]`}>
      <div className="flex items-center gap-2">
        <span className={`h-2 w-2 rounded-full ${isActive ? "bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.9)]" : "bg-red-400"}`} />
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] font-bold uppercase tracking-wide text-white">
            {formatCameraTag(camera.name)}
          </span>
          <span className="text-[11px] font-medium text-white/80">
            {camera.name}
          </span>
          <span className="rounded bg-emerald-500/20 px-1.5 py-0.5 text-[8px] font-semibold uppercase tracking-wide text-emerald-300">
            {isActive ? "Active" : "Offline"}
          </span>
        </div>
      </div>

      <div className="h-4 w-px UI_SURFACES.border" />

      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={onPrevious}
          disabled={index <= 0}
          className={`flex h-6 w-6 items-center justify-center rounded-md UI_SURFACES.textMuted3 transition-colors hover:bg-white/10 UI_SURFACES.hoverText disabled:cursor-not-allowed disabled:opacity-35`}
          aria-label="Previous camera"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
        </button>
        <select
          value={camera.id}
          onChange={(event) => onSelect(event.target.value)}
          className={`min-w-44 rounded-md border UI_SURFACES.borderStrong UI_SURFACES.card px-2 py-1 text-[10px] UI_SURFACES.textBody outline-none focus:border-sky-500`}
          aria-label="Select camera"
        >
          {cameras.map((entry) => (
            <option key={entry.id} value={entry.id}>
              {entry.name}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={onNext}
          disabled={index >= total - 1}
          className={`flex h-6 w-6 items-center justify-center rounded-md UI_SURFACES.textMuted3 transition-colors hover:bg-white/10 UI_SURFACES.hoverText disabled:cursor-not-allowed disabled:opacity-35`}
          aria-label="Next camera"
        >
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

export function ReplayStatusOverlay({
  pathLabel,
  timeS,
  speed,
  qualityLabel,
  segmentLabel,
  progressPct,
}: {
  pathLabel: string;
  timeS: number;
  speed: number;
  qualityLabel?: string;
  segmentLabel?: string;
  progressPct?: number;
}) {
  const qualityToken = qualityLabel?.toLowerCase() ?? "none";
  const risk = qualityToken.includes("identification") || qualityToken.includes("scrutinize") || qualityToken.includes("validate")
    ? { label: "Low", className: "text-emerald-300" }
    : qualityToken.includes("recognition") || qualityToken.includes("characterize") || qualityToken.includes("perceive")
      ? { label: "Moderate", className: "text-amber-300" }
      : qualityToken.includes("none")
        ? { label: "Critical", className: "text-rose-300" }
        : { label: "High", className: "text-orange-300" };

  return (
    <div className={`absolute left-1/2 top-3 z-30 -translate-x-1/2 flex items-center gap-3 rounded-xl border UI_SURFACES.border UI_SURFACES.panel/92 px-3.5 py-2 shadow-[0_12px_34px_rgba(0,0,0,0.45)] text-[10px] UI_SURFACES.textBody2`}>
      <div className="flex items-center gap-1.5">
        <span className="h-2 w-2 rounded-full bg-sky-400 animate-pulse" />
        <span className={`text-[9px] font-bold uppercase tracking-[0.16em] UI_SURFACES.textAccent`}>LIVE REPLAY</span>
      </div>
      <div className="h-3 w-px UI_SURFACES.border" />
      <div className="max-w-48 truncate">
        <span className={`UI_SURFACES.textSoftMid`}>Path:</span> <span className="font-medium text-white">{pathLabel}</span>
      </div>
      <div className="h-3 w-px UI_SURFACES.border" />
      <div>
        <span className={`UI_SURFACES.textSoftMid`}>Time:</span> <span className="font-mono text-white">{timeS.toFixed(1)}s</span>
      </div>
      <div>
        <span className={`UI_SURFACES.textSoftMid`}>Speed:</span> <span className="font-mono">{speed.toFixed(1)}x</span>
      </div>
      {progressPct != null ? (
        <div>
          <span className={`UI_SURFACES.textSoftMid`}>Progress:</span> <span className="font-mono">{Math.max(0, Math.min(100, Math.round(progressPct * 100)))}%</span>
        </div>
      ) : null}
      {qualityLabel ? (
        <>
          <div className="h-3 w-px UI_SURFACES.border" />
          <div>
            <span className={`UI_SURFACES.textSoftMid`}>Quality:</span> <span className="font-semibold text-white">{qualityLabel}</span>
          </div>
        </>
      ) : null}
      <div className="h-3 w-px UI_SURFACES.border" />
      <div>
        <span className={`UI_SURFACES.textSoftMid`}>Risk:</span> <span className={`font-semibold ${risk.className}`}>{risk.label}</span>
      </div>
      {segmentLabel ? (
        <>
          <div className="h-3 w-px UI_SURFACES.border" />
          <div className={`max-w-44 truncate text-[9px] UI_SURFACES.textMuted3`}>
            {segmentLabel}
          </div>
        </>
      ) : null}
    </div>
  );
}

export function CameraPathVisibilityOverlay({
  cameraName,
  visibleSeconds,
  totalSeconds,
  maxQuality,
}: {
  cameraName: string;
  visibleSeconds: number;
  totalSeconds: number;
  maxQuality: string;
}) {
  const ratio = totalSeconds > 0 ? visibleSeconds / totalSeconds : 0;
  const pct = Math.round(ratio * 100);
  const status = ratio > 0.7 ? "Strong Coverage" : ratio > 0.35 ? "Partial Coverage" : "Weak Coverage";
  const statusColor = ratio > 0.7 ? "text-emerald-300" : ratio > 0.35 ? "text-amber-300" : "text-red-300";

  return (
    <div className={`pointer-events-auto rounded-xl border UI_SURFACES.border UI_SURFACES.panel/92 px-3 py-2 shadow-sm`}>
      <div className={`text-[8px] font-semibold uppercase tracking-[0.18em] UI_SURFACES.textAccent`}>Path Visibility</div>
      <div className="mt-1 text-[10px] font-medium text-white">{cameraName}</div>
      <div className={`mt-0.5 text-[10px] font-semibold ${statusColor}`}>{status}</div>
      <div className={`mt-1 text-[9px] UI_SURFACES.textMuted4`}>{pct}% visible • best quality: {maxQuality.toUpperCase()}</div>
    </div>
  );
}

export function DoriInsightCard({
  camera,
  zoneLabel,
  targetType,
  currentQuality,
  requiredQuality,
  zoneStatus,
  bestCameraName,
  distanceM,
  angleDeg,
  lightingLabel,
  reasonLine,
  replayTimeS,
}: {
  camera: CameraNode;
  zoneLabel: string;
  targetType: SecurityScene["criticalZones"][number]["targetType"];
  currentQuality: string;
  requiredQuality: string;
  zoneStatus: "pass" | "partial" | "fail" | "unknown";
  bestCameraName: string;
  distanceM: number;
  angleDeg: number;
  lightingLabel: string;
  reasonLine: string;
  replayTimeS?: number;
}) {
  const statusLabel =
    zoneStatus === "pass" ? "PASSES"
      : zoneStatus === "partial" ? "PARTIAL"
        : zoneStatus === "fail" ? "FAILS"
          : "UNKNOWN";

  return (
    <div className={`pointer-events-auto w-full rounded-xl border UI_SURFACES.border UI_SURFACES.panel/92 px-3 py-2.5 shadow-sm`}>
      <div className={`text-[8px] font-semibold uppercase tracking-[0.22em] UI_SURFACES.textAccent`}>DORI OVERLAY</div>
      <div className="mt-1 text-[10px] font-semibold text-white">{zoneLabel}</div>
      <div className={`mt-1 text-[8px] uppercase tracking-[0.16em] UI_SURFACES.textMuted3`}>
        {requiredQuality.toUpperCase()} REQUIRED · {statusLabel}
      </div>
      <div className="mt-1 border-t UI_SURFACES.borderElevated pt-1 text-[8px] uppercase tracking-wide UI_SURFACES.textBlueDim">
        Target: {formatTargetTypeLabel(targetType)}
      </div>
      <div className={`mt-2 space-y-1.5 text-[10px] UI_SURFACES.textBody2`}>
        <div className="flex items-center justify-between gap-2">
          <span className={`UI_SURFACES.textSoftMid`}>Current Quality</span>
          <span className="rounded UI_SURFACES.hoverBg px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide UI_SURFACES.textInfoLight">
            {currentQuality}
          </span>
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className={`UI_SURFACES.textSoftMid`}>Required</span>
          <span className={`rounded UI_SURFACES.hoverBg px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide UI_SURFACES.textBody`}>
            {requiredQuality}
          </span>
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className={`UI_SURFACES.textSoftMid`}>Best Camera</span>
          <span className={`truncate text-right font-medium UI_SURFACES.textBody`}>{bestCameraName}</span>
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className={`UI_SURFACES.textSoftMid`}>Distance</span>
          <span className={`font-mono UI_SURFACES.textBody`}>{distanceM.toFixed(1)}m</span>
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className={`UI_SURFACES.textSoftMid`}>Angle</span>
          <span className={`font-mono UI_SURFACES.textBody`}>{angleDeg.toFixed(0)}°</span>
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className={`UI_SURFACES.textSoftMid`}>Lighting</span>
          <span className={`UI_SURFACES.textBody`}>{lightingLabel}</span>
        </div>
        {replayTimeS != null ? (
          <div className="flex items-center justify-between gap-2">
            <span className={`UI_SURFACES.textSoftMid`}>Replay Time</span>
            <span className={`font-mono UI_SURFACES.textBody`}>{replayTimeS.toFixed(1)}s</span>
          </div>
        ) : null}
      </div>
      <div className={`mt-2 rounded-lg border UI_SURFACES.borderDeep UI_SURFACES.card px-2 py-1.5 text-[9px] UI_SURFACES.textSoftBright`}>
        Why this quality: {reasonLine}
      </div>
      <div className={`mt-2 rounded-lg border UI_SURFACES.borderDeep UI_SURFACES.card px-2 py-1.5 text-[9px] UI_SURFACES.textSoftBright`}>
        {camera.name} is being used to inspect the current coverage scenario.
      </div>
    </div>
  );
}

export function BottomControlStrip({
  mode,
  onModeChange,
  flags,
  onFlagsChange,
  onBackToMap,
  immersiveMode,
  onToggleImmersive,
}: {
  mode: CameraFeedMode;
  onModeChange: (value: CameraFeedMode) => void;
  flags: OverlayFlags;
  onFlagsChange: (next: OverlayFlags) => void;
  onBackToMap: () => void;
  immersiveMode?: boolean;
  onToggleImmersive?: () => void;
}) {
  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement | null>(null);
  const viewModes: Array<{ value: CameraFeedMode; label: string }> = [
    { value: "normal", label: "Normal" },
    { value: "ir_bw", label: "IR (B/W)" },
    { value: "low_light", label: "Low Light" },
    { value: "thermal", label: "Thermal" },
  ];

  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      if (!moreRef.current) return;
      if (event.target instanceof Node && !moreRef.current.contains(event.target)) {
        setMoreOpen(false);
      }
    };

    window.addEventListener("pointerdown", onPointerDown);
    return () => window.removeEventListener("pointerdown", onPointerDown);
  }, []);

  if (immersiveMode) {
    return (
      <div className="absolute inset-x-3 bottom-3 z-30 flex items-center justify-between gap-1.5">
        <div className={`flex rounded-md border UI_SURFACES.borderStrong bg-black/60 px-1 py-1 text-[8px]`}>
          <span className={`flex items-center gap-1 rounded-md px-2 py-1 UI_SURFACES.textMuted3`}>
            <span>Feed mode:</span>
            <span className={`font-semibold uppercase UI_SURFACES.textBody`}>{mode === "ir_bw" ? "IR" : mode === "low_light" ? "Low Light" : mode === "thermal" ? "Thermal" : "Normal"}</span>
          </span>
        </div>
        <div className={`inline-flex rounded-md border UI_SURFACES.borderStrong bg-black/60 text-[8px]`}>
          <button
            type="button"
            onClick={onBackToMap}
            className={`rounded-l-md border-r UI_SURFACES.borderStrong px-2 py-1 font-medium UI_SURFACES.textMuted3 transition-colors UI_SURFACES.hoverText`}
          >
            <ArrowLeft className="inline-block h-3 w-3" /> Map View
          </button>
          <button
            type="button"
            onClick={onToggleImmersive}
            className={`rounded-r-md px-2 py-1 font-medium text-emerald-200 transition-colors UI_SURFACES.hoverText`}
          >
            Exit Focus
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="absolute inset-x-3 bottom-3 z-30 flex items-end gap-1.5">
      <div className={`flex rounded-md border UI_SURFACES.borderStrong bg-black/55 p-1`}>
        {viewModes.map((entry) => (
          <button
            key={entry.value}
            type="button"
            onClick={() => onModeChange(entry.value)}
            className={`rounded px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.08em] transition-colors ${
              mode === entry.value
                ? "bg-emerald-500/25 text-emerald-200"
                : "UI_SURFACES.textMuted3 UI_SURFACES.hoverText"
            }`}
          >
            {entry.label}
          </button>
        ))}
      </div>

      <div className={`inline-flex rounded-md border UI_SURFACES.borderStrong bg-black/55 text-[8px]`}>
        <button
          type="button"
          onClick={() => onFlagsChange({ ...flags, overlays: !flags.overlays })}
          className={`rounded-l-md px-2 py-1 font-medium ${flags.overlays ? "bg-blue-900/35 text-blue-200" : "UI_SURFACES.textMuted3"}`}
        >
          OVERLAYS {flags.overlays ? "✓" : ""}
        </button>
        <button
          type="button"
          onClick={() => onFlagsChange({ ...flags, dori: !flags.dori })}
          className={`border-l UI_SURFACES.borderStrong px-2 py-1 font-medium ${flags.dori ? "bg-blue-900/35 text-blue-200" : "UI_SURFACES.textMuted3"}`}
        >
          DORI {flags.dori ? "✓" : ""}
        </button>
        <button
          type="button"
          onClick={() => onFlagsChange({ ...flags, path: !flags.path })}
          className={`border-l UI_SURFACES.borderStrong px-2 py-1 font-medium ${flags.path ? "bg-blue-900/35 text-blue-200" : "UI_SURFACES.textMuted3"}`}
        >
          PATH {flags.path ? "✓" : ""}
        </button>
        <button
          type="button"
          onClick={() => onFlagsChange({ ...flags, zones: !flags.zones })}
          className={`border-l UI_SURFACES.borderStrong px-2 py-1 font-medium ${flags.zones ? "bg-blue-900/35 text-blue-200" : "UI_SURFACES.textMuted3"}`}
        >
          ZONES {flags.zones ? "✓" : ""}
        </button>
        <button
          type="button"
          onClick={() => onFlagsChange({ ...flags, timestamp: !flags.timestamp })}
          className={`border-l UI_SURFACES.borderStrong px-2 py-1 font-medium ${flags.timestamp ? "bg-blue-900/35 text-blue-200" : "UI_SURFACES.textMuted3"}`}
        >
          TIMESTAMP {flags.timestamp ? "✓" : ""}
        </button>
        <button
          type="button"
          onClick={() => onFlagsChange({ ...flags, grid: !flags.grid })}
          className={`border-l UI_SURFACES.borderStrong px-2 py-1 font-medium ${flags.grid ? "bg-blue-900/35 text-blue-200" : "UI_SURFACES.textMuted3"}`}
        >
          GRID {flags.grid ? "✓" : ""}
        </button>
        <div ref={moreRef} className={`relative border-l UI_SURFACES.borderStrong`}>
          <button
            type="button"
            onClick={() => setMoreOpen((open) => !open)}
            className={`px-2 py-1 font-medium transition-colors ${moreOpen ? "bg-blue-900/35 text-blue-200" : "UI_SURFACES.textMuted3"}`}
          >
            MORE
          </button>
          {moreOpen ? (
            <div className={`absolute bottom-full left-0 mb-1.5 w-44 rounded-lg border UI_SURFACES.borderStrong UI_SURFACES.panel/96 p-1.5 shadow-[0_12px_24px_rgba(0,0,0,0.35)]`}>
              <button
                type="button"
                onClick={() => {
                  onFlagsChange({
                    overlays: true,
                    dori: true,
                    path: true,
                    zones: true,
                    timestamp: true,
                    grid: false,
                  });
                  setMoreOpen(false);
                }}
                className={`w-full rounded-md px-2 py-1.5 text-left text-[9px] font-medium UI_SURFACES.textBody transition-colors UI_SURFACES.hoverBg`}
              >
                Show replay essentials
              </button>
              <button
                type="button"
                onClick={() => {
                  onFlagsChange({
                    overlays: true,
                    dori: false,
                    path: false,
                    zones: false,
                    timestamp: false,
                    grid: false,
                  });
                  setMoreOpen(false);
                }}
                className={`w-full rounded-md px-2 py-1.5 text-left text-[9px] font-medium UI_SURFACES.textBody transition-colors UI_SURFACES.hoverBg`}
              >
                Minimal camera feed
              </button>
              <button
                type="button"
                onClick={() => {
                  onFlagsChange({
                    overlays: true,
                    dori: true,
                    path: false,
                    zones: true,
                    timestamp: true,
                    grid: false,
                  });
                  setMoreOpen(false);
                }}
                className={`w-full rounded-md px-2 py-1.5 text-left text-[9px] font-medium UI_SURFACES.textBody transition-colors UI_SURFACES.hoverBg`}
              >
                Inspection preset
              </button>
            </div>
          ) : null}
        </div>
        <button
          type="button"
          onClick={onToggleImmersive}
          className={`border-l UI_SURFACES.borderStrong px-2 py-1 font-medium UI_SURFACES.textMuted3 transition-colors UI_SURFACES.hoverText`}
        >
          Focus
        </button>
        <button
          type="button"
          onClick={onBackToMap}
          className={`border-l UI_SURFACES.borderStrong rounded-r-md px-2 py-1 font-medium UI_SURFACES.textMuted3 transition-colors UI_SURFACES.hoverText`}
        >
          <ArrowLeft className="inline-block h-3 w-3" /> Back to Map View
        </button>
      </div>
      <div className={`rounded-md border UI_SURFACES.borderStrong bg-black/55 px-2 py-1.5 text-[8px] uppercase tracking-[0.08em] UI_SURFACES.textMuted3`}>
        <div className={`font-semibold UI_SURFACES.textBody`}>Timeline / Path Replay</div>
        <div className="mt-0.5 flex flex-wrap items-center gap-1 text-[7px]">
          <span className={`rounded border UI_SURFACES.borderElevated UI_SURFACES.card px-1 py-0.5`}>Events</span>
          <span className={`rounded border UI_SURFACES.borderElevated UI_SURFACES.card px-1 py-0.5`}>Quality Over Time</span>
          <span className={`rounded border UI_SURFACES.borderElevated UI_SURFACES.card px-1 py-0.5`}>Camera Wall Preview</span>
          <span className={`rounded border UI_SURFACES.borderElevated UI_SURFACES.card px-1 py-0.5`}>Scenario / Path</span>
        </div>
      </div>
    </div>
  );
}
