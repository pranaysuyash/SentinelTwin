"use client";

import { ArrowLeft, Camera, ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { formatTargetTypeLabel } from "@/components/view/camera-view-utils";
import type { CameraNode, SecurityScene } from "@/schema/security-scene";

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
    return <div className="pointer-events-none absolute inset-0 bg-[#0a1330]/40" />;
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
  return (
    <div className="absolute left-3 top-3 z-30 flex items-center gap-2 rounded-xl border border-[#263246] bg-[#0b0f17]/90 px-3 py-2 backdrop-blur-sm">
      <div className="flex items-center gap-2">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg border border-emerald-500/20 bg-emerald-500/10 text-emerald-300">
          <Camera className="h-3.5 w-3.5" />
        </div>
        <div className="leading-tight">
          <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#7dd3fc]">Camera View</div>
          <div className="text-[11px] font-medium text-white">{camera.name}</div>
        </div>
      </div>

      <div className="flex items-center gap-1 rounded-lg border border-[#27364e] bg-black/40 p-1">
        <button
          type="button"
          onClick={onPrevious}
          disabled={index <= 0}
          className="flex h-7 w-7 items-center justify-center rounded-md text-[#8ea5cc] transition-colors hover:text-white disabled:cursor-not-allowed disabled:opacity-35"
          aria-label="Previous camera"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
        </button>
        <select
          value={camera.id}
          onChange={(event) => onSelect(event.target.value)}
          className="min-w-44 rounded-md border border-[#27364e] bg-[#111521] px-2 py-1 text-[10px] text-[#c7d0e4]"
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
          className="flex h-7 w-7 items-center justify-center rounded-md text-[#8ea5cc] transition-colors hover:text-white disabled:cursor-not-allowed disabled:opacity-35"
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
  return (
    <div className="absolute left-3 bottom-24 z-30 rounded-xl border border-[#243146] bg-[#0b0f17]/92 px-3 py-2.5 shadow-[0_12px_34px_rgba(0,0,0,0.35)] backdrop-blur-sm">
      <div className="text-[8px] font-semibold uppercase tracking-[0.22em] text-[#7dd3fc]">LIVE MODE (Simulated)</div>
      <div className="mt-1 space-y-0.5 text-[10px] text-[#d2d9e8]">
        <div>
          <span className="text-[#6a748b]">Actor:</span> Tracked replay path
        </div>
        <div>
          <span className="text-[#6a748b]">Time:</span> {timeS.toFixed(1)}s
        </div>
        <div className="max-w-55 truncate">
          <span className="text-[#6a748b]">Path:</span> {pathLabel}
        </div>
        {progressPct != null ? (
          <div>
            <span className="text-[#6a748b]">Complete:</span> {Math.max(0, Math.min(100, Math.round(progressPct * 100)))}%
          </div>
        ) : null}
        <div>
          <span className="text-[#6a748b]">Speed:</span> {speed.toFixed(1)}x
        </div>
        {qualityLabel ? (
          <div>
            <span className="text-[#6a748b]">Quality:</span> {qualityLabel}
          </div>
        ) : null}
        {segmentLabel ? (
          <div className="max-w-55 truncate">
            <span className="text-[#6a748b]">Segment:</span> {segmentLabel}
          </div>
        ) : null}
      </div>
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
    <div className="absolute left-3 bottom-3 z-30 rounded-xl border border-[#243146] bg-[#0b0f17]/92 px-3 py-2 backdrop-blur-sm">
      <div className="text-[8px] uppercase tracking-[0.18em] text-[#7dd3fc]">Path Visibility</div>
      <div className="mt-1 text-[10px] text-[#d2d9e8]">{cameraName}</div>
      <div className={`mt-1 text-[10px] font-semibold ${statusColor}`}>{status}</div>
      <div className="mt-1 text-[9px] text-[#9ab0ce]">{pct}% visible • best quality: {maxQuality.toUpperCase()}</div>
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
}) {
  const statusLabel =
    zoneStatus === "pass" ? "PASSES"
      : zoneStatus === "partial" ? "PARTIAL"
        : zoneStatus === "fail" ? "FAILS"
          : "UNKNOWN";

  return (
    <div className="absolute right-3 top-24 z-30 w-56 rounded-xl border border-[#243146] bg-[#0b0f17]/92 px-3 py-2.5 shadow-[0_12px_34px_rgba(0,0,0,0.35)] backdrop-blur-sm">
      <div className="text-[8px] font-semibold uppercase tracking-[0.22em] text-[#7dd3fc]">DORI OVERLAY</div>
      <div className="mt-1 text-[10px] font-semibold text-white">{zoneLabel}</div>
      <div className="mt-1 text-[8px] uppercase tracking-[0.16em] text-[#8ea5cc]">
        {requiredQuality.toUpperCase()} REQUIRED · {statusLabel}
      </div>
      <div className="mt-1 border-t border-[#334563] pt-1 text-[8px] uppercase tracking-wide text-[#7a94c7]">
        Target: {formatTargetTypeLabel(targetType)}
      </div>
      <div className="mt-2 space-y-1.5 text-[10px] text-[#d2d9e8]">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[#6a748b]">Current Quality</span>
          <span className="rounded bg-[#152034] px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-[#93c5fd]">
            {currentQuality}
          </span>
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="text-[#6a748b]">Required</span>
          <span className="rounded bg-[#152034] px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-[#c7d0e4]">
            {requiredQuality}
          </span>
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="text-[#6a748b]">Best Camera</span>
          <span className="truncate text-right font-medium text-[#c7d0e4]">{bestCameraName}</span>
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="text-[#6a748b]">Distance</span>
          <span className="font-mono text-[#c7d0e4]">{distanceM.toFixed(1)}m</span>
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="text-[#6a748b]">Angle</span>
          <span className="font-mono text-[#c7d0e4]">{angleDeg.toFixed(0)}°</span>
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="text-[#6a748b]">Lighting</span>
          <span className="text-[#c7d0e4]">{lightingLabel}</span>
        </div>
      </div>
      <div className="mt-2 rounded-lg border border-[#1f2b42] bg-[#111521] px-2 py-1.5 text-[9px] text-[#8b96ab]">
        Why this quality: {reasonLine}
      </div>
      <div className="mt-2 rounded-lg border border-[#1f2b42] bg-[#111521] px-2 py-1.5 text-[9px] text-[#8b96ab]">
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
}: {
  mode: CameraFeedMode;
  onModeChange: (value: CameraFeedMode) => void;
  flags: OverlayFlags;
  onFlagsChange: (next: OverlayFlags) => void;
  onBackToMap: () => void;
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

  return (
    <div className="absolute inset-x-3 bottom-3 z-30 flex items-end gap-1.5">
      <div className="flex rounded-md border border-[#27364e] bg-black/55 p-1">
        {viewModes.map((entry) => (
          <button
            key={entry.value}
            type="button"
            onClick={() => onModeChange(entry.value)}
            className={`rounded px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.08em] transition-colors ${
              mode === entry.value
                ? "bg-emerald-500/25 text-emerald-200"
                : "text-[#8ea5cc] hover:text-white"
            }`}
          >
            {entry.label}
          </button>
        ))}
      </div>

      <div className="inline-flex rounded-md border border-[#27364e] bg-black/55 text-[8px]">
        <button
          type="button"
          onClick={() => onFlagsChange({ ...flags, overlays: !flags.overlays })}
          className={`rounded-l-md px-2 py-1 font-medium ${flags.overlays ? "bg-blue-900/35 text-blue-200" : "text-[#8ea5cc]"}`}
        >
          OVERLAYS {flags.overlays ? "✓" : ""}
        </button>
        <button
          type="button"
          onClick={() => onFlagsChange({ ...flags, dori: !flags.dori })}
          className={`border-l border-[#27364e] px-2 py-1 font-medium ${flags.dori ? "bg-blue-900/35 text-blue-200" : "text-[#8ea5cc]"}`}
        >
          DORI {flags.dori ? "✓" : ""}
        </button>
        <button
          type="button"
          onClick={() => onFlagsChange({ ...flags, path: !flags.path })}
          className={`border-l border-[#27364e] px-2 py-1 font-medium ${flags.path ? "bg-blue-900/35 text-blue-200" : "text-[#8ea5cc]"}`}
        >
          PATH {flags.path ? "✓" : ""}
        </button>
        <button
          type="button"
          onClick={() => onFlagsChange({ ...flags, zones: !flags.zones })}
          className={`border-l border-[#27364e] px-2 py-1 font-medium ${flags.zones ? "bg-blue-900/35 text-blue-200" : "text-[#8ea5cc]"}`}
        >
          ZONES {flags.zones ? "✓" : ""}
        </button>
        <button
          type="button"
          onClick={() => onFlagsChange({ ...flags, timestamp: !flags.timestamp })}
          className={`border-l border-[#27364e] px-2 py-1 font-medium ${flags.timestamp ? "bg-blue-900/35 text-blue-200" : "text-[#8ea5cc]"}`}
        >
          TIMESTAMP {flags.timestamp ? "✓" : ""}
        </button>
        <button
          type="button"
          onClick={() => onFlagsChange({ ...flags, grid: !flags.grid })}
          className={`border-l border-[#27364e] px-2 py-1 font-medium ${flags.grid ? "bg-blue-900/35 text-blue-200" : "text-[#8ea5cc]"}`}
        >
          GRID {flags.grid ? "✓" : ""}
        </button>
        <div ref={moreRef} className="relative border-l border-[#27364e]">
          <button
            type="button"
            onClick={() => setMoreOpen((open) => !open)}
            className={`px-2 py-1 font-medium transition-colors ${moreOpen ? "bg-blue-900/35 text-blue-200" : "text-[#8ea5cc]"}`}
          >
            MORE
          </button>
          {moreOpen ? (
            <div className="absolute bottom-full left-0 mb-1.5 w-44 rounded-lg border border-[#27364e] bg-[#0b0f17]/96 p-1.5 shadow-[0_12px_24px_rgba(0,0,0,0.35)] backdrop-blur-sm">
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
                className="w-full rounded-md px-2 py-1.5 text-left text-[9px] font-medium text-[#c7d0e4] transition-colors hover:bg-[#1a2233]"
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
                className="w-full rounded-md px-2 py-1.5 text-left text-[9px] font-medium text-[#c7d0e4] transition-colors hover:bg-[#1a2233]"
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
                className="w-full rounded-md px-2 py-1.5 text-left text-[9px] font-medium text-[#c7d0e4] transition-colors hover:bg-[#1a2233]"
              >
                Inspection preset
              </button>
            </div>
          ) : null}
        </div>
        <button
          type="button"
          onClick={onBackToMap}
          className="border-l border-[#27364e] rounded-r-md px-2 py-1 font-medium text-[#8ea5cc] transition-colors hover:text-white"
        >
          <ArrowLeft className="inline-block h-3 w-3" /> Back to Map View
        </button>
      </div>
    </div>
  );
}
