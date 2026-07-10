"use client";

import { useState, useMemo, useCallback } from "react";
import {
  Camera,
  CheckCircle2,
  Eye,
  RotateCcw,
  SlidersHorizontal,
} from "lucide-react";

import { useStudioStore } from "@/store/studio-store";
import { cn } from "@/lib/cn";
import { QUALITY_COLOR, QUALITY_ABBR } from "@/lib/quality-display";
import {
  computeLensFovTradeoff,
  generateTradeoffCurve,
  SENSOR_FORMATS,
  FOCAL_LENGTH_PRESETS,
  type SensorFormat,
  type LensFovResult,
} from "@/lib/lens-fov-tradeoff";
import type { CameraNode } from "@/schema/security-scene";
import { UI_SURFACES } from "@/lib/studio-surface-tokens";


// ── Props ─────────────────────────────────────────────────────────────────────

interface LensFovTradeoffSimulatorProps {
  camera: CameraNode;
  onClose: () => void;
}

// ── DORI Range Bar ────────────────────────────────────────────────────────────

function DoriRangeBar({
  label,
  rangeM,
  maxRange,
  rank,
}: {
  label: string;
  rangeM: number;
  maxRange: number;
  rank: number;
}) {
  const color = QUALITY_COLOR[label.toLowerCase() as keyof typeof QUALITY_COLOR] ?? "#4a5568";
  const pct = maxRange > 0 ? (rangeM / maxRange) * 100 : 0;
  const level = ["Detection", "Observation", "Recognition", "Identification"];
  const textColor = level.includes(label) ? "#c7d0e4" : "#6a748b";

  return (
    <div className="flex items-center gap-1.5">
      <span className="w-[90px] text-[9px] capitalize" style={{ color: textColor }}>{label}</span>
      <div className={`relative h-4 flex-1 rounded ${UI_SURFACES.card} overflow-hidden`}>
        <div
          className="h-full rounded transition-all duration-200"
          style={{
            width: `${pct}%`,
            background: `linear-gradient(90deg, ${color}44, ${color}88)`,
          }}
        />
      </div>
      <span className={`w-[58px] text-right font-mono text-[9px] ${UI_SURFACES.textMuted5}`}>
        {rangeM.toFixed(1)}m
      </span>
    </div>
  );
}

// ── FOV Visualization ─────────────────────────────────────────────────────────

function FovConeVisualization({
  fovDeg,
  width = 120,
  height = 80,
}: {
  fovDeg: number;
  width?: number;
  height?: number;
}) {
  const halfFovRad = (fovDeg / 2) * (Math.PI / 180);
  const armLength = Math.min(width, height * 2) * 0.35;
  const centerX = width / 2;
  const centerY = height * 0.85;

  const leftX = centerX - armLength * Math.sin(halfFovRad);
  const leftY = centerY - armLength * Math.cos(halfFovRad);
  const rightX = centerX + armLength * Math.sin(halfFovRad);
  const rightY = centerY - armLength * Math.cos(halfFovRad);

  return (
    <svg width={width} height={height} className="overflow-visible">
      {/* Cone fill */}
      <path
        d={`M${centerX},${centerY} L${leftX},${leftY} A${armLength * 0.6},${armLength * 0.6} 0 0,1 ${rightX},${rightY} Z`}
        fill="rgba(125, 211, 252, 0.12)"
        stroke="rgba(125, 211, 252, 0.5)"
        strokeWidth="1.2"
      />
      {/* Center line */}
      <line
        x1={centerX}
        y1={centerY}
        x2={centerX}
        y2={centerY - armLength * 0.6}
        stroke="rgba(125, 211, 252, 0.25)"
        strokeWidth="0.5"
        strokeDasharray="3 2"
      />
      {/* Camera icon */}
      <circle cx={centerX} cy={centerY} r="4" fill="rgba(125, 211, 252, 0.4)" />
      <text x={centerX} y={centerY + 2} textAnchor="middle" fill="#7dd3fc" fontSize="5" fontFamily="monospace">
        ◉
      </text>
      {/* FOV label */}
      <text
        x={centerX}
        y={centerY - armLength * 0.5}
        textAnchor="middle"
        fill="#7dd3fc"
        fontSize="7"
        fontFamily="monospace"
      >
        {fovDeg.toFixed(1)}°
      </text>
    </svg>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

const QUALITY_RANK_ORDER = ["detection", "observation", "recognition", "identification"] as const;

export function LensFovTradeoffSimulator({ camera, onClose }: LensFovTradeoffSimulatorProps) {
  const updateNode = useStudioStore((s) => s.updateNode);

  const [focalLength, setFocalLength] = useState(camera.focalLengthMm ?? 4);
  const [sensorFormat, setSensorFormat] = useState<SensorFormat>("1/2.7\"");
  const [targetDistance, setTargetDistance] = useState(10);
  const [resolutionMP, setResolutionMP] = useState(camera.resolutionMP);

  const result = useMemo<LensFovResult>(
    () =>
      computeLensFovTradeoff({
        focalLengthMm: focalLength,
        sensorFormat,
        resolutionMP,
        targetDistanceM: targetDistance,
      }),
    [focalLength, sensorFormat, resolutionMP, targetDistance],
  );

  const curve = useMemo(
    () => generateTradeoffCurve(sensorFormat, resolutionMP, targetDistance),
    [sensorFormat, resolutionMP, targetDistance],
  );

  // Compare with current camera settings
  const currentResult = useMemo<LensFovResult | null>(
    () =>
      camera
        ? computeLensFovTradeoff({
            focalLengthMm: camera.focalLengthMm ?? 4,
            sensorFormat,
            resolutionMP: camera.resolutionMP,
            targetDistanceM: targetDistance,
          })
        : null,
    [camera, sensorFormat, targetDistance],
  );

  const handleApply = useCallback(() => {
    updateNode(camera.id, {
      focalLengthMm: focalLength,
      fovHorizontalDeg: result.fovHorizontalDeg,
      fovVerticalDeg: result.fovVerticalDeg,
    });
    onClose();
  }, [camera.id, focalLength, result, updateNode, onClose]);

  return (
    <div className={`{rounded-xl border ${UI_SURFACES.borderPanel} ${UI_SURFACES.panel} p-3}`}>
      {/* Header */}
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={`flex h-6 w-6 items-center justify-center rounded border ${UI_SURFACES.borderThin} ${UI_SURFACES.card}`}>
            <Camera className={`h-3 w-3 ${UI_SURFACES.textAccent}`} />
          </div>
          <span className={`text-[10px] font-semibold uppercase tracking-[0.16em] ${UI_SURFACES.textAccent}`}>
            Lens / FOV Simulator
          </span>
        </div>
        <button
          type="button"
          onClick={onClose}
          className={`rounded border ${UI_SURFACES.borderThin} ${UI_SURFACES.card} px-2 py-0.5 text-[9px] ${UI_SURFACES.textMuted5} ${UI_SURFACES.hoverText} transition-colors`}
        >
          Close
        </button>
      </div>

      <div className="grid grid-cols-[1fr_1.2fr] gap-4">
        {/* Left: Controls */}
        <div className="space-y-3">
          {/* Focal Length Slider */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className={`text-[9px] font-medium ${UI_SURFACES.textMuted5}`}>Focal Length</span>
              <span className={`font-mono text-[11px] font-semibold ${UI_SURFACES.textBody}`}>{focalLength.toFixed(1)}mm</span>
            </div>
            <input
              type="range"
              min="2.8"
              max="50"
              step="0.1"
              value={focalLength}
              onChange={(e) => setFocalLength(parseFloat(e.target.value))}
              className={`w-full h-1.5 rounded-full appearance-none ${UI_SURFACES.bgPanel} accent-cyan-400 cursor-pointer`}
            />
            <div className={`mt-1 flex justify-between text-[7px] ${UI_SURFACES.textMuted}`}>
              {FOCAL_LENGTH_PRESETS.map((fl) => (
                <button
                  key={fl}
                  type="button"
                  onClick={() => setFocalLength(fl)}
                  className={cn(
                    "rounded px-1 py-0.5 transition-colors",
                    Math.abs(focalLength - fl) < 0.1
                      ? "bg-cyan-500/15 text-cyan-300"
                      : "${UI_SURFACES.textMuted} hover:${UI_SURFACES.textMuted5}",
                  )}
                >
                  {fl}mm
                </button>
              ))}
            </div>
          </div>

          {/* Sensor Format */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className={`text-[9px] font-medium ${UI_SURFACES.textMuted5}`}>Sensor Format</span>
              <span className={`text-[9px] ${UI_SURFACES.textSoftMid}`}>{sensorFormat}</span>
            </div>
            <div className="grid grid-cols-4 gap-1">
              {Object.keys(SENSOR_FORMATS).map((fmt) => (
                <button
                  key={fmt}
                  type="button"
                  onClick={() => setSensorFormat(fmt as SensorFormat)}
                  className={cn(
                    "rounded border px-1.5 py-1 text-[8px] transition-colors",
                    sensorFormat === fmt
                      ? "border-cyan-500/30 bg-cyan-500/10 text-cyan-300"
                      : "${UI_SURFACES.borderPanel} ${UI_SURFACES.textSoftMid} hover:${UI_SURFACES.borderHover}",
                  )}
                >
                  {fmt}
                </button>
              ))}
            </div>
          </div>

          {/* Resolution */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className={`text-[9px] font-medium ${UI_SURFACES.textMuted5}`}>Resolution</span>
              <span className={`font-mono text-[10px] ${UI_SURFACES.textBody}`}>{resolutionMP}MP</span>
            </div>
            <input
              type="range"
              min="1"
              max="50"
              step="1"
              value={resolutionMP}
              onChange={(e) => setResolutionMP(parseInt(e.target.value))}
              className={`w-full h-1.5 rounded-full appearance-none ${UI_SURFACES.bgPanel} accent-cyan-400 cursor-pointer`}
            />
            <div className={`mt-1 flex justify-between text-[7px] ${UI_SURFACES.textMuted}`}>
              {[1, 2, 4, 8, 12, 25, 50].map((mp) => (
                <span key={mp}>{mp}MP</span>
              ))}
            </div>
          </div>

          {/* Target Distance */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className={`text-[9px] font-medium ${UI_SURFACES.textMuted5}`}>Target Distance</span>
              <span className={`font-mono text-[10px] ${UI_SURFACES.textBody}`}>{targetDistance}m</span>
            </div>
            <input
              type="range"
              min="1"
              max="100"
              step="1"
              value={targetDistance}
              onChange={(e) => setTargetDistance(parseInt(e.target.value))}
              className={`w-full h-1.5 rounded-full appearance-none ${UI_SURFACES.bgPanel} accent-cyan-400 cursor-pointer`}
            />
          </div>

          {/* Preset buttons */}
          <button
            type="button"
            onClick={() => {
              setFocalLength(camera.focalLengthMm ?? 4);
              setResolutionMP(camera.resolutionMP);
            }}
            className={`flex w-full items-center justify-center gap-1.5 rounded border ${UI_SURFACES.borderThin} ${UI_SURFACES.card} px-2 py-1.5 text-[9px] ${UI_SURFACES.textMuted5} ${UI_SURFACES.hoverText} transition-colors`}
          >
            <RotateCcw className="h-3 w-3" />
            Reset to Camera Specs
          </button>
        </div>

        {/* Right: Visualization & Results */}
        <div className="space-y-3">
          {/* FOV Visualization */}
          <div className={`{flex justify-center rounded-lg border ${UI_SURFACES.borderPanel} ${UI_SURFACES.panelDeepAlt} p-2}`}>
            <FovConeVisualization fovDeg={result.fovHorizontalDeg} />
          </div>

          {/* Key Metrics */}
          <div className="grid grid-cols-2 gap-1.5">
            <div className={`{rounded-lg border ${UI_SURFACES.borderPanel} ${UI_SURFACES.panelDeepAlt} px-2 py-1.5}`}>
              <div className={`text-[7px] uppercase tracking-[0.16em] ${UI_SURFACES.textMuted}`}>H FOV</div>
              <div className={`font-mono text-[12px] font-bold ${UI_SURFACES.textBody}`}>
                {result.fovHorizontalDeg.toFixed(1)}°
              </div>
            </div>
            <div className={`{rounded-lg border ${UI_SURFACES.borderPanel} ${UI_SURFACES.panelDeepAlt} px-2 py-1.5}`}>
              <div className={`text-[7px] uppercase tracking-[0.16em] ${UI_SURFACES.textMuted}`}>V FOV</div>
              <div className={`font-mono text-[12px] font-bold ${UI_SURFACES.textBody}`}>
                {result.fovVerticalDeg.toFixed(1)}°
              </div>
            </div>
            <div className={`{rounded-lg border ${UI_SURFACES.borderPanel} ${UI_SURFACES.panelDeepAlt} px-2 py-1.5}`}>
              <div className={`text-[7px] uppercase tracking-[0.16em] ${UI_SURFACES.textMuted}`}>PPM @ Target</div>
              <div className={`font-mono text-[12px] font-bold ${UI_SURFACES.textBody}`}>
                {result.ppm.toFixed(1)}
              </div>
            </div>
            <div className={`{rounded-lg border ${UI_SURFACES.borderPanel} ${UI_SURFACES.panelDeepAlt} px-2 py-1.5}`}>
              <div className={`text-[7px] uppercase tracking-[0.16em] ${UI_SURFACES.textMuted}`}>Quality</div>
              <div
                className="font-mono text-[11px] font-bold capitalize"
                style={{ color: QUALITY_COLOR[result.quality as keyof typeof QUALITY_COLOR] ?? "#6a748b" }}
              >
                {QUALITY_ABBR[result.quality as keyof typeof QUALITY_ABBR] ?? result.quality}
              </div>
            </div>
          </div>

          {/* DORI Range Bars */}
          <div className={`{space-y-1 rounded-lg border ${UI_SURFACES.borderPanel} ${UI_SURFACES.panelDeepAlt} p-2}`}>
            <div className={`mb-1.5 text-[8px] font-semibold uppercase tracking-[0.16em] ${UI_SURFACES.textMuted}`}>
              DORI Reach
            </div>
            {QUALITY_RANK_ORDER.map((level, i) => {
              const range =
                level === "detection"
                  ? result.detectionRangeM
                  : level === "observation"
                    ? result.observationRangeM
                    : level === "recognition"
                      ? result.recognitionRangeM
                      : result.identificationRangeM;
              return (
                <DoriRangeBar
                  key={level}
                  label={QUALITY_ABBR[level === "detection" ? "detection" : level === "observation" ? "observation" : level === "recognition" ? "recognition" : "identification"] ?? level}
                  rangeM={range}
                  maxRange={result.detectionRangeM}
                  rank={i}
                />
              );
            })}
          </div>
        </div>
      </div>

      {/* Compare with current & Apply */}
      <div className={`{mt-3 flex items-center gap-3 border-t ${UI_SURFACES.borderPanel} pt-3}`}>
        {currentResult && (
          <div className={`{flex items-center gap-2 rounded-lg border ${UI_SURFACES.borderPanel} ${UI_SURFACES.panelDeepAlt} px-2 py-1.5 text-[8px] ${UI_SURFACES.textSoftMid}}`}>
            <SlidersHorizontal className="h-3 w-3" />
            <span>
              Current: {currentResult.fovHorizontalDeg.toFixed(1)}° / {currentResult.ppm.toFixed(0)} PPM
            </span>
            <span className={`mx-1 ${UI_SURFACES.textDim}`}>→</span>
            <span className={`${UI_SURFACES.textAccent}`}>
              Proposed: {result.fovHorizontalDeg.toFixed(1)}° / {result.ppm.toFixed(0)} PPM
            </span>
          </div>
        )}
        <button
          type="button"
          onClick={handleApply}
          className="ml-auto inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-[10px] font-semibold text-white hover:bg-emerald-500 transition-colors"
        >
          <CheckCircle2 className="h-3 w-3" />
          Apply to Camera
        </button>
      </div>

      {/* Preset curve table */}
      <details className="mt-3">
        <summary className={`cursor-pointer text-[8px] font-semibold uppercase tracking-[0.16em] ${UI_SURFACES.textMuted} hover:${UI_SURFACES.textMuted5}`}>
          Focal Length Tradeoff Table
        </summary>
        <div className="mt-1.5 overflow-x-auto">
          <table className="w-full text-[8px] border-collapse">
            <thead>
              <tr className={`{border-b ${UI_SURFACES.borderPanel}}`}>
                <th className={`px-1.5 py-1 text-left ${UI_SURFACES.textMuted}`}>Focal</th>
                <th className={`px-1.5 py-1 text-right ${UI_SURFACES.textMuted}`}>H FOV</th>
                <th className={`px-1.5 py-1 text-right ${UI_SURFACES.textMuted}`}>PPM</th>
                <th className={`px-1.5 py-1 text-right ${UI_SURFACES.textMuted}`}>Detect</th>
                <th className={`px-1.5 py-1 text-right ${UI_SURFACES.textMuted}`}>Observe</th>
                <th className={`px-1.5 py-1 text-right ${UI_SURFACES.textMuted}`}>Recognize</th>
                <th className={`px-1.5 py-1 text-right ${UI_SURFACES.textMuted}`}>Identify</th>
              </tr>
            </thead>
            <tbody>
              {curve.map((pt) => (
                <tr
                  key={pt.focalLengthMm}
                  className={cn(
                    "border-b border-[#151a26] hover:${UI_SURFACES.card} cursor-pointer",
                    Math.abs(focalLength - pt.focalLengthMm) < 0.1 ? "bg-cyan-500/5" : "",
                  )}
                  onClick={() => setFocalLength(pt.focalLengthMm)}
                >
                  <td className={`px-1.5 py-1 font-semibold ${UI_SURFACES.textBody}`}>{pt.focalLengthMm}mm</td>
                  <td className={`px-1.5 py-1 text-right ${UI_SURFACES.textMuted5}`}>{pt.fovHorizontalDeg.toFixed(1)}°</td>
                  <td className={`px-1.5 py-1 text-right font-mono ${UI_SURFACES.textBody}`}>{pt.ppm.toFixed(0)}</td>
                  <td className={`px-1.5 py-1 text-right ${UI_SURFACES.textMuted5}`}>{pt.detectionRangeM.toFixed(1)}m</td>
                  <td className={`px-1.5 py-1 text-right ${UI_SURFACES.textMuted5}`}>{pt.observationRangeM.toFixed(1)}m</td>
                  <td className={`px-1.5 py-1 text-right ${UI_SURFACES.textMuted5}`}>{pt.recognitionRangeM.toFixed(1)}m</td>
                  <td className={`px-1.5 py-1 text-right ${UI_SURFACES.textMuted5}`}>{pt.identificationRangeM.toFixed(1)}m</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
