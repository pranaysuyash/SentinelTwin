"use client";

import {
  Box,
  Camera,
  Copy,
  Crosshair,
  Eye,
  Lightbulb,
  Shield,
  Trash2,
} from "lucide-react";

import { CameraFeedCanvas } from "@/components/inspector/CameraFeedCanvas";
import { Badge } from "@/components/shared/Badge";
import { cn } from "@/lib/cn";
import type { CameraNode, ObstructionNode, SecurityLightNode } from "@/schema/security-scene";
import { type InspectorTab, useStudioStore } from "@/store/studio-store";

function Field({ label, value, unit }: { label: string; value: React.ReactNode; unit?: string }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-[#181c27] py-2 last:border-b-0 last:pb-0 first:pt-0">
      <span className="text-[10px] text-[#6a748b]">{label}</span>
      <span className="flex items-center gap-1 text-right text-[11px] font-medium text-[#d2d9e8]">
        {value}
        {unit ? <span className="text-[9px] text-[#556076]">{unit}</span> : null}
      </span>
    </div>
  );
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-[#1f2536] bg-[#0b0f17] p-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.02)]">
      <div className="mb-2 text-[9px] font-semibold uppercase tracking-[0.2em] text-[#4a5568]">{title}</div>
      {children}
    </section>
  );
}

function NumberInput({
  label,
  value,
  min,
  max,
  step = 0.1,
  unit,
  onChange,
}: {
  label: string;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  onChange: (v: number) => void;
}) {
  return (
    <label className="block rounded-lg border border-[#1f2536] bg-[#111521] px-2 py-1.5">
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="text-[8px] uppercase tracking-[0.16em] text-[#556076]">{label}</span>
        {unit ? <span className="text-[8px] text-[#556076]">{unit}</span> : null}
      </div>
      <input
        type="number"
        value={Number.isFinite(value) ? value : 0}
        min={min}
        max={max}
        step={step}
        onChange={(event) => {
          const next = Number(event.target.value);
          if (Number.isNaN(next)) return;
          onChange(next);
        }}
        className="w-full bg-transparent text-right font-mono text-[11px] text-[#d2d9e8] outline-none"
      />
    </label>
  );
}

function SliderInput({
  label,
  value,
  min = 0,
  max = 180,
  step = 1,
  unit,
  onChange,
}: {
  label: string;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  onChange: (v: number) => void;
}) {
  return (
    <div className="border-b border-[#181c27] py-2 last:border-b-0 last:pb-0 first:pt-0">
      <div className="mb-1.5 flex items-center justify-between gap-3">
        <span className="text-[10px] text-[#6a748b]">{label}</span>
        <span className="text-[11px] font-mono text-[#d2d9e8]">
          {value}
          {unit}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="w-full accent-blue-400"
      />
    </div>
  );
}

function ToggleField({
  label,
  value,
  trueLabel,
  falseLabel,
  onChange,
}: {
  label: string;
  value: boolean;
  trueLabel: string;
  falseLabel: string;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-[#181c27] py-2 last:border-b-0 last:pb-0 first:pt-0">
      <span className="text-[10px] text-[#6a748b]">{label}</span>
      <div className="inline-flex overflow-hidden rounded-md border border-[#24283a] bg-[#111521]">
        <button
          type="button"
          onClick={() => onChange(true)}
          className={cn(
            "px-2 py-1 text-[10px] font-medium transition-colors",
            value ? "bg-emerald-500/18 text-emerald-200" : "text-[#7f8aa3] hover:text-white",
          )}
        >
          {trueLabel}
        </button>
        <button
          type="button"
          onClick={() => onChange(false)}
          className={cn(
            "border-l border-[#24283a] px-2 py-1 text-[10px] font-medium transition-colors",
            !value ? "bg-red-500/15 text-red-200" : "text-[#7f8aa3] hover:text-white",
          )}
        >
          {falseLabel}
        </button>
      </div>
    </div>
  );
}

function SelectInput({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-3 border-b border-[#181c27] py-2 last:border-b-0 last:pb-0 first:pt-0">
      <span className="text-[10px] text-[#6a748b]">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="rounded-md border border-[#24283a] bg-[#111521] px-2 py-1 text-[10px] font-medium text-[#d2d9e8] outline-none transition-colors hover:border-[#32384d]"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function SummaryStat({ label, value, accent = "text-[#d2d9e8]" }: { label: string; value: string; accent?: string }) {
  return (
    <div className="rounded-lg border border-[#1f2536] bg-[#111521] px-2 py-1.5">
      <div className={cn("text-[12px] font-semibold", accent)}>{value}</div>
      <div className="mt-0.5 text-[8px] uppercase tracking-[0.16em] text-[#556076]">{label}</div>
    </div>
  );
}

const CAMERA_STATUS_OPTIONS = [
  { value: "none", label: "Off" },
  { value: "ir", label: "IR" },
  { value: "low_light", label: "Starlight" },
] as const;

const CLARITY_OPTIONS = [
  { value: "poor", label: "Poor" },
  { value: "average", label: "Average" },
  { value: "good", label: "Good" },
  { value: "excellent", label: "Clear" },
] as const;

const MOUNT_OPTIONS = [
  { value: "ceiling", label: "Ceiling" },
  { value: "wall", label: "Wall" },
  { value: "pole", label: "Pole" },
  { value: "corner", label: "Corner" },
] as const;

const RESOLUTION_OPTIONS = [
  { value: "4_2688x1520", label: "4MP (2688×1520)" },
  { value: "4_1920x1080", label: "4MP (1920×1080)" },
  { value: "2_1920x1080", label: "2MP (1920×1080)" },
  { value: "8_3840x2160", label: "8MP (3840×2160)" },
] as const;

const LENS_OPTIONS = [
  { value: "2.8", label: "Fixed 2.8mm" },
  { value: "4", label: "Fixed 4mm" },
  { value: "6", label: "Fixed 6mm" },
  { value: "8", label: "Fixed 8mm" },
] as const;

/** Inline select styled to match the inspector form */
function PropSelect({
  label, value, options, onChange,
}: {
  label: string;
  value: string;
  options: readonly { value: string; label: string }[];
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-[#181c27] py-1.5 last:border-b-0">
      <span className="text-[10px] text-[#6a748b]">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-md border border-[#24283a] bg-[#111521] px-2 py-1 text-[10px] font-medium text-[#d2d9e8] outline-none transition-colors hover:border-[#32384d]"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
    </div>
  );
}

/** Compute DORI effective ranges in metres for a camera. */
function computeDoriRanges(camera: CameraNode) {
  const resW = camera.resolutionWidth ?? (camera.resolutionMP >= 8 ? 3840 : camera.resolutionMP >= 4 ? 2688 : 1920);
  const tanHalfFov = Math.tan((camera.fovHorizontalDeg / 2) * (Math.PI / 180));
  // range = resW / (2 * ppm * tanHalfFov), capped at camera.rangeM
  const cap = camera.rangeM;
  const det  = Math.min(resW / (2 * 25  * tanHalfFov), cap);
  const recog = Math.min(resW / (2 * 125 * tanHalfFov), cap);
  const ident = Math.min(resW / (2 * 250 * tanHalfFov), cap);
  return { det, recog, ident };
}

const OBSTRUCTION_MATERIALS = [
  { value: "solid", label: "Solid" },
  { value: "glass", label: "Glass" },
  { value: "grill", label: "Grill" },
  { value: "partial", label: "Partial" },
] as const satisfies { value: ObstructionNode["material"]; label: string }[];

const VISION_TRANSMISSION: Partial<Record<ObstructionNode["material"], number>> = {
  solid: 0,
  glass: 0.9,
  grill: 0.5,
  partial: 0.3,
};

function CameraInspector() {
  const camera = useStudioStore((s) => s.getSelectedCamera());
  const scene = useStudioStore((s) => s.scene);
  const inspectorTab = useStudioStore((s) => s.inspectorTab);
  const setTab = useStudioStore((s) => s.setInspectorTab);
  const result = useStudioStore((s) => s.simulationResult);
  const updateNode = useStudioStore((s) => s.updateNode);
  const addNode = useStudioStore((s) => s.addNode);
  const removeNode = useStudioStore((s) => s.removeNode);
  const selectNode = useStudioStore((s) => s.selectNode);
  const layers = useStudioStore((s) => s.layerVisibility);
  const toggleLayer = useStudioStore((s) => s.toggleLayer);

  if (!camera) return null;

  const tabs: { id: InspectorTab; label: string }[] = [
    { id: "properties", label: "Properties" },
    { id: "view", label: "View" },
    { id: "status", label: "Status" },
    { id: "analytics", label: "Analytics" },
    { id: "failures", label: "Failures" },
  ];

  const camResult = result?.cameraResults.find((entry) => entry.cameraId === camera.id);
  const offlineImpact = camResult?.offlineImpact ?? [];
  const firstCriticalZone = scene.criticalZones[0];

  // Derive resolution key for select
  const resolutionKey = `${camera.resolutionMP}_${camera.resolutionWidth ?? 2688}x${camera.resolutionHeight ?? 1520}`;
  // Derive type key
  const typeKey = camera.mountType === "ceiling" ? `${camera.resolutionMP}mp_dome` : `${camera.resolutionMP}mp_bullet`;

  const updatePosition = (next: [number, number, number]) => {
    updateNode(camera.id, { position: next });
  };

  const updateHeight = (nextHeight: number) => {
    updateNode(camera.id, {
      mountHeightM: nextHeight,
      position: [camera.position[0], nextHeight, camera.position[2]] as [number, number, number],
    });
  };

  const aimAtZone = () => {
    if (!firstCriticalZone) return;

    const centroid = firstCriticalZone.polygon.reduce(
      (acc, [x, z]) => {
        acc.x += x;
        acc.z += z;
        return acc;
      },
      { x: 0, z: 0 },
    );

    const pointCount = firstCriticalZone.polygon.length || 1;
    const centroidX = centroid.x / pointCount;
    const centroidZ = centroid.z / pointCount;
    const dx = centroidX - camera.position[0];
    const dz = centroidZ - camera.position[2];
    const yaw = Math.atan2(dx, dz) * (180 / Math.PI);

    updateNode(camera.id, { yawDeg: Math.round(yaw), pitchDeg: -30 });
  };

  const duplicateCamera = () => {
    const duplicatedCamera: CameraNode = {
      ...camera,
      id: `cam_${Date.now().toString(36)}`,
      name: `${camera.name} Copy`,
      position: [camera.position[0] + 0.35, camera.position[1], camera.position[2] + 0.35],
      source: "manual",
    };

    addNode(duplicatedCamera);
    selectNode(duplicatedCamera.id);
  };

  return (
    <>
      <div className="border-b border-[#1e2130] px-3 py-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl border border-blue-500/20 bg-blue-500/12">
              <Camera className="h-4 w-4 text-blue-400" />
            </div>
            <div>
              <div className="text-[12px] font-semibold text-white">{camera.name}</div>
              <div className="text-[9px] uppercase tracking-[0.18em] text-[#556076]">{camera.mountType} mount · {camera.resolutionMP}MP</div>
            </div>
          </div>
          <Badge variant={camera.status === "on" ? "green" : "red"} dot>
            {camera.status === "on" ? "Active" : camera.status}
          </Badge>
        </div>
      </div>

      <div className="flex gap-1 border-b border-[#1e2130] px-2 pt-1.5">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setTab(tab.id)}
            className={cn(
              "-mb-px rounded-t-lg border-b-2 px-2 py-1.5 text-[10px] font-medium transition-colors",
              inspectorTab === tab.id
                ? "border-green-500 text-green-300"
                : "border-transparent text-[#5a647a] hover:text-[#a1abc1]",
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-2.5">
        {inspectorTab === "properties" && (
          <div>
            {/* Mini camera feed preview */}
            <div className="mb-2.5">
              <CameraFeedCanvas cameraId={camera.id} />
            </div>

            {/* Type */}
            <div className="flex items-center justify-between gap-3 border-b border-[#181c27] py-1.5">
              <span className="text-[10px] text-[#6a748b]">Type</span>
              <select
                value={typeKey}
                onChange={(e) => {
                  const [mp, shape] = e.target.value.split("_");
                  updateNode(camera.id, {
                    resolutionMP: parseInt(mp ?? "4"),
                    mountType: shape === "dome" ? "ceiling" : "wall",
                  });
                }}
                className="rounded-md border border-[#24283a] bg-[#111521] px-2 py-1 text-[10px] font-medium text-[#d2d9e8] outline-none transition-colors hover:border-[#32384d]"
              >
                <option value="4mp_dome">4MP Indoor Dome</option>
                <option value="2mp_dome">2MP Indoor Dome</option>
                <option value="4mp_bullet">4MP Bullet</option>
                <option value="2mp_bullet">2MP Bullet</option>
                <option value="8mp_dome">8MP Indoor Dome</option>
              </select>
            </div>

            {/* Mount */}
            <PropSelect
              label="Mount"
              value={camera.mountType}
              options={MOUNT_OPTIONS}
              onChange={(v) => updateNode(camera.id, { mountType: v as CameraNode["mountType"] })}
            />

            {/* Position */}
            <div className="border-b border-[#181c27] py-1.5">
              <div className="mb-1.5 text-[10px] text-[#6a748b]">Position (m)</div>
              <div className="grid grid-cols-3 gap-1.5">
                <NumberInput
                  label="X"
                  value={camera.position[0]}
                  step={0.1}
                  unit="m"
                  onChange={(value) => updatePosition([value, camera.position[1], camera.position[2]])}
                />
                <NumberInput
                  label="Y"
                  value={camera.position[1]}
                  min={0.5}
                  max={4}
                  step={0.1}
                  unit="m"
                  onChange={updateHeight}
                />
                <NumberInput
                  label="Z"
                  value={camera.position[2]}
                  step={0.1}
                  unit="m"
                  onChange={(value) => updatePosition([camera.position[0], camera.position[1], value])}
                />
              </div>
            </div>

            {/* Rotation */}
            <div className="border-b border-[#181c27] py-1.5">
              <div className="mb-1.5 text-[10px] text-[#6a748b]">Rotation (°)</div>
              <div className="grid grid-cols-3 gap-1.5">
                <NumberInput
                  label="Yaw"
                  value={camera.yawDeg}
                  min={-180}
                  max={180}
                  step={1}
                  unit="°"
                  onChange={(value) => updateNode(camera.id, { yawDeg: value })}
                />
                <NumberInput
                  label="Pitch"
                  value={camera.pitchDeg}
                  min={-90}
                  max={0}
                  step={1}
                  unit="°"
                  onChange={(value) => updateNode(camera.id, { pitchDeg: value })}
                />
                <NumberInput
                  label="Roll"
                  value={camera.rollDeg}
                  min={-180}
                  max={180}
                  step={1}
                  unit="°"
                  onChange={(value) => updateNode(camera.id, { rollDeg: value })}
                />
              </div>
            </div>

            {/* FOV Horizontal */}
            <div className="border-b border-[#181c27] py-1.5">
              <div className="mb-1.5 flex items-center justify-between gap-3">
                <span className="text-[10px] text-[#6a748b]">FOV (Horizontal)</span>
                <span className="font-mono text-[11px] text-[#d2d9e8]">{camera.fovHorizontalDeg}°</span>
              </div>
              <input
                type="range"
                min={30}
                max={180}
                step={1}
                value={camera.fovHorizontalDeg}
                onChange={(e) => updateNode(camera.id, { fovHorizontalDeg: Number(e.target.value) })}
                className="w-full accent-blue-400"
              />
            </div>

            {/* Resolution */}
            <PropSelect
              label="Resolution"
              value={RESOLUTION_OPTIONS.find((o) => o.value.startsWith(`${camera.resolutionMP}_`)) ? resolutionKey : RESOLUTION_OPTIONS[0].value}
              options={RESOLUTION_OPTIONS}
              onChange={(v) => {
                const [mp, dims] = v.split("_");
                const [w, h] = (dims ?? "2688x1520").split("x");
                updateNode(camera.id, {
                  resolutionMP: parseInt(mp ?? "4"),
                  resolutionWidth: parseInt(w ?? "2688"),
                  resolutionHeight: parseInt(h ?? "1520"),
                });
              }}
            />

            {/* Lens */}
            <PropSelect
              label="Lens"
              value={String(camera.focalLengthMm ?? 2.8)}
              options={LENS_OPTIONS}
              onChange={(v) => updateNode(camera.id, { focalLengthMm: parseFloat(v) })}
            />

            {/* Height */}
            <div className="border-b border-[#181c27] py-1.5">
              <div className="mb-1.5 text-[10px] text-[#6a748b]">Height</div>
              <NumberInput
                label="Height"
                value={camera.mountHeightM}
                min={0.5}
                max={4}
                step={0.1}
                unit="m"
                onChange={updateHeight}
              />
            </div>

            {/* Night Mode */}
            <PropSelect
              label="Night Mode"
              value={camera.nightMode === "low_light" ? "low_light" : camera.nightMode}
              options={CAMERA_STATUS_OPTIONS}
              onChange={(v) => updateNode(camera.id, { nightMode: v as CameraNode["nightMode"] })}
            />

            {/* Image Clarity */}
            <PropSelect
              label="Image Clarity"
              value={camera.clarity}
              options={CLARITY_OPTIONS}
              onChange={(v) => updateNode(camera.id, { clarity: v as CameraNode["clarity"] })}
            />

            {/* PTZ + IR + Thermal quick-read fields */}
            <Field label="IR Range" value={camera.irRangeM > 0 ? camera.irRangeM : "None"} unit={camera.irRangeM > 0 ? "m" : undefined} />
            <Field label="PTZ" value={camera.ptz ? "Yes" : "No"} />
            <Field label="Thermal" value={camera.thermalCapable ? "Yes" : "No"} />

            {/* DORI analysis section */}
            {(() => {
              const dori = computeDoriRanges(camera);
              return (
                <div className="mt-2.5 rounded-xl border border-[#1f2536] bg-[#0b0f17] p-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.02)]">
                  <div className="mb-2 text-[9px] font-semibold uppercase tracking-[0.2em] text-[#4a5568]">
                    DORI
                  </div>
                  <div className="space-y-1">
                    {(
                      [
                        { label: "Detect", value: dori.det, color: "text-orange-300" },
                        { label: "Recog", value: dori.recog, color: "text-yellow-300" },
                        { label: "Ident", value: dori.ident, color: "text-emerald-300" },
                      ] as const
                    ).map(({ label, value, color }) => (
                      <div key={label} className="flex items-center justify-between gap-2">
                        <span className="text-[10px] text-[#6a748b]">{label}</span>
                        <div className="flex items-center gap-1">
                          <span className={`font-mono text-[11px] font-semibold ${color}`}>
                            {value.toFixed(1)}
                          </span>
                          <span className="text-[8px] text-[#556076]">m</span>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-2 flex items-center justify-between border-t border-[#1f2536] pt-2">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[9px] text-[#6a748b]">Target</span>
                      <span className="rounded bg-[#131a28] px-1.5 py-0.5 text-[9px] font-medium text-[#c7d0e4]">
                        Face
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setTab("view")}
                      className="flex items-center gap-1 rounded-md border border-[#24283a] bg-[#111521] px-2 py-1 text-[9px] font-medium text-[#c7d0e4] transition-colors hover:border-[#32384d] hover:text-white"
                    >
                      Export Frame
                    </button>
                  </div>
                </div>
              );
            })()}

            {/* Recommended Next Steps — shown when simulation has camera-specific recommendations */}
            {(() => {
              const recs = result?.recommendations.filter((r) =>
                !r.affectedNodeId || r.affectedNodeId === camera.id,
              ) ?? [];
              if (recs.length === 0) return null;
              const COST_COLOR: Record<string, string> = {
                free: "text-green-300",
                low: "text-emerald-300",
                medium: "text-yellow-300",
                high: "text-red-300",
              };
              return (
                <div className="mt-2.5 rounded-xl border border-blue-500/20 bg-blue-500/5 p-2.5">
                  <div className="mb-2 flex items-center gap-1.5 text-[9px] font-semibold uppercase tracking-[0.2em] text-blue-400">
                    <span className="h-1 w-1 rounded-full bg-blue-400" />
                    Recommended Next Steps
                  </div>
                  <div className="space-y-2">
                    {recs.slice(0, 3).map((rec, i) => (
                      <div key={i} className="flex items-start gap-2">
                        <span className={`mt-0.5 flex-shrink-0 text-[7px] font-bold ${COST_COLOR[rec.costCategory] ?? "text-[#8090a8]"}`}>
                          {rec.costCategory.toUpperCase()}
                        </span>
                        <div className="min-w-0">
                          <div className="text-[9px] leading-tight text-[#c7d0e4]">{rec.description}</div>
                          {rec.estimatedImpact && (
                            <div className="mt-0.5 text-[8px] text-[#5a6478]">{rec.estimatedImpact}</div>
                          )}
                        </div>
                        {rec.verified && (
                          <span className="ml-auto flex-shrink-0 rounded bg-green-900/30 px-1 py-0.5 text-[7px] font-semibold text-green-400">✓</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}
          </div>
        )}

        {inspectorTab === "analytics" && (
          <div className="space-y-2.5">
            <SectionCard title="Coverage Performance">
              <div className="grid grid-cols-3 gap-1.5">
                <SummaryStat label="Coverage" value={camResult ? `${camResult.coveragePct.toFixed(1)}%` : "--"} accent="text-emerald-300" />
                <SummaryStat label="Zones Pass" value={camResult ? `${camResult.criticalZonesCovered.length}` : "--"} accent="text-blue-300" />
                <SummaryStat label="Zones Fail" value={camResult ? `${camResult.criticalZonesFailed.length}` : "--"} accent="text-amber-300" />
              </div>
            </SectionCard>

            <SectionCard title="Verified Notes">
              {offlineImpact.length > 0 ? (
                <div className="space-y-2">
                  {offlineImpact.map((message, index) => (
                    <div key={index} className="rounded-lg border border-amber-500/20 bg-amber-500/8 px-2 py-2 text-[10px] text-amber-200">
                      {message}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-[10px] text-[#6a748b]">No single-point failure warnings are active for this camera in the current run.</div>
              )}
            </SectionCard>
          </div>
        )}

        {inspectorTab === "status" && (
          <div className="space-y-2.5">
            <SectionCard title="Operational Status">
              <ToggleField
                label="Status"
                value={camera.status === "on"}
                trueLabel="On"
                falseLabel="Off"
                onChange={(value) => updateNode(camera.id, { status: value ? "on" : "off" })}
              />
              <SelectInput
                label="Night Mode"
                value={camera.nightMode === "low_light" ? "low_light" : camera.nightMode}
                options={[...CAMERA_STATUS_OPTIONS]}
                onChange={(value) => updateNode(camera.id, { nightMode: value as CameraNode["nightMode"] })}
              />
              <SelectInput
                label="Image Clarity"
                value={camera.clarity}
                options={[...CLARITY_OPTIONS]}
                onChange={(value) => updateNode(camera.id, { clarity: value as CameraNode["clarity"] })}
              />
              <Field label="PTZ" value={camera.ptz ? "Enabled" : "No"} />
              <Field label="Thermal" value={camera.thermalCapable ? "Capable" : "No"} />
              {camera.irRangeM > 0 ? <Field label="IR Range" value={camera.irRangeM} unit="m" /> : null}
            </SectionCard>
          </div>
        )}

        {inspectorTab === "view" && (
          <div className="space-y-2">
            <CameraFeedCanvas cameraId={camera.id} />

            {/* DORI Quality Legend */}
            <SectionCard title="Legend">
              <div className="space-y-1">
                {([
                  { label: "Identification", color: "#3b82f6", ppm: "≥250 px/m" },
                  { label: "Recognition", color: "#22c55e", ppm: "≥125 px/m" },
                  { label: "Observation", color: "#eab308", ppm: "≥62.5 px/m" },
                  { label: "Detection", color: "#f97316", ppm: "≥25 px/m" },
                  { label: "Not Covered", color: "#ef4444", ppm: "<25 px/m" },
                  { label: "Out of Range", color: "#6b7280", ppm: "—" },
                ] as const).map(({ label, color, ppm }) => (
                  <div key={label} className="flex items-center justify-between gap-2 py-0.5">
                    <div className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 flex-shrink-0 rounded-sm" style={{ backgroundColor: color }} />
                      <span className="text-[10px] text-[#c7d0e4]">{label}</span>
                    </div>
                    <span className="font-mono text-[8px] text-[#556076]">{ppm}</span>
                  </div>
                ))}
              </div>
            </SectionCard>

            {/* Camera View Settings */}
            <SectionCard title="Camera View Settings">
              {([
                { label: "Show Path Visibility", layer: "paths" },
                { label: "Show Camera Labels", layer: "labels" },
                { label: "Show Coverage Heatmap", layer: "heatmap" },
                { label: "Show Camera Cones", layer: "camera_cones" },
              ] as const).map(({ label, layer }) => {
                const isOn = layers[layer];
                return (
                  <div key={layer} className="flex items-center justify-between border-b border-[#181c27] py-1.5 last:border-b-0">
                    <span className="text-[10px] text-[#6a748b]">{label}</span>
                    <button
                      type="button"
                      onClick={() => toggleLayer(layer)}
                      className={cn(
                        "h-4 w-7 rounded-full transition-colors",
                        isOn ? "bg-emerald-500" : "bg-[#2a3246]",
                      )}
                    >
                      <span
                        className={cn(
                          "block h-3 w-3 translate-x-0.5 rounded-full bg-white transition-transform",
                          isOn ? "translate-x-3.5" : "",
                        )}
                      />
                    </button>
                  </div>
                );
              })}
            </SectionCard>

            {/* Coverage details */}
            <SectionCard title="Coverage Details">
              <Field label="FOV" value={`${camera.fovHorizontalDeg}°`} />
              <Field label="Resolution" value={`${camera.resolutionMP}MP`} />
              <Field label="Range" value={`${camera.rangeM}m`} />
              <Field label="Mode" value={scene.assumptions.timeOfDay === "night" ? "Night" : "Day"} />
              {camResult && (
                <>
                  <Field label="Coverage" value={`${camResult.coveragePct.toFixed(1)}%`} />
                  <Field label="Zones covered" value={camResult.criticalZonesCovered.length} />
                  <Field label="Zones failed" value={camResult.criticalZonesFailed.length} />
                </>
              )}
            </SectionCard>

            {/* Go to Camera View button */}
            <button
              type="button"
              onClick={() => useStudioStore.getState().setViewMode("camera_view")}
              className="mt-1 flex h-8 w-full items-center justify-center gap-1.5 rounded-lg border border-[#24283a] bg-[#111521] text-[10px] font-medium text-[#c7d0e4] transition-colors hover:border-[#32384d] hover:text-white"
            >
              Full Camera View
            </button>
          </div>
        )}

        {inspectorTab === "failures" && (
          <div className="space-y-2.5">
            <SectionCard title="Failure Simulation">
              {camResult ? (
                <div className="space-y-2">
                  <div className="rounded-lg border border-[#1f2536] bg-[#111521] p-3 text-[10px] leading-relaxed text-[#c7d0e4]">
                    {camera.name} contributes {camResult.coveragePct.toFixed(1)}% coverage in the current run and fails {camResult.criticalZonesFailed.length} critical zone(s).
                  </div>
                  {offlineImpact.length > 0 ? (
                    <div className="space-y-1.5">
                      {offlineImpact.map((message, index) => (
                        <div key={index} className="rounded-lg border border-amber-500/20 bg-amber-500/8 px-2 py-2 text-[10px] text-amber-200">
                          {message}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-lg border border-[#1f2536] bg-[#111521] p-3 text-[10px] leading-relaxed text-[#6a748b]">
                      No offline-failure impact is currently attributed to this camera in the latest simulation run.
                    </div>
                  )}
                </div>
              ) : (
                <div className="rounded-lg border border-[#1f2536] bg-[#111521] p-3 text-[10px] leading-relaxed text-[#6a748b]">
                  Run the simulation to populate camera failure analysis for this selected camera.
                </div>
              )}
            </SectionCard>
          </div>
        )}
      </div>

      <div className="space-y-2 border-t border-[#1e2130] px-3 py-3">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={aimAtZone}
            disabled={!firstCriticalZone}
            className="flex h-8 flex-1 items-center justify-center gap-1.5 rounded-lg border border-[#24283a] bg-[#111521] text-[10px] font-medium text-[#c7d0e4] transition-colors hover:border-[#32384d] hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Crosshair className="h-3 w-3" />
            Aim at Zone
          </button>
          <button
            type="button"
            onClick={() => {
              setTab("view");
              useStudioStore.getState().setViewMode("camera_view");
            }}
            className="flex h-8 flex-1 items-center justify-center gap-1.5 rounded-lg border border-[#24283a] bg-[#111521] text-[10px] font-medium text-[#c7d0e4] transition-colors hover:border-[#32384d] hover:text-white"
          >
            <Eye className="h-3 w-3" />
            Go To Camera View
          </button>
        </div>
        <div className="flex gap-2">
          <button onClick={() => removeNode(camera.id)} className="flex h-8 flex-1 items-center justify-center gap-1.5 rounded-lg border border-red-900/45 bg-red-950/15 text-[10px] font-medium text-red-300 transition-colors hover:border-red-700 hover:bg-red-950/30">
            <Trash2 className="h-3 w-3" />
            Delete Camera
          </button>
          <button
            type="button"
            onClick={duplicateCamera}
            className="flex h-8 flex-1 items-center justify-center gap-1.5 rounded-lg border border-[#24283a] bg-[#111521] text-[10px] font-medium text-[#c7d0e4] transition-colors hover:border-[#32384d] hover:text-white"
          >
            <Copy className="h-3 w-3" />
            Duplicate
          </button>
        </div>
      </div>
    </>
  );
}

function ObstructionInspector() {
  const selectedId = useStudioStore((s) => s.selectedNodeId);
  const scene = useStudioStore((s) => s.scene);
  const updateNode = useStudioStore((s) => s.updateNode);

  const obs = scene.obstructions.find((entry) => entry.id === selectedId);
  if (!obs) return null;

  return (
    <>
      <div className="border-b border-[#1e2130] px-3 py-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl border border-amber-500/20 bg-amber-500/12">
              <Box className="h-4 w-4 text-amber-400" />
            </div>
            <div>
              <div className="text-[12px] font-semibold text-white">{obs.label}</div>
              <div className="text-[9px] uppercase tracking-[0.18em] text-[#556076]">{obs.obstructionType}</div>
            </div>
          </div>
          <Badge variant={obs.movable ? "green" : "gray"} dot>
            {obs.movable ? "Movable" : "Fixed"}
          </Badge>
        </div>
      </div>

      <div className="flex-1 space-y-2.5 overflow-y-auto px-3 py-3">
        <SectionCard title="Position">
          <div className="grid grid-cols-2 gap-2">
            <NumberInput
              label="X"
              value={obs.position[0]}
              step={0.1}
              unit="m"
              onChange={(value) => updateNode(obs.id, { position: [value, obs.position[1], obs.position[2]] as [number, number, number] })}
            />
            <NumberInput
              label="Z"
              value={obs.position[2]}
              step={0.1}
              unit="m"
              onChange={(value) => updateNode(obs.id, { position: [obs.position[0], obs.position[1], value] as [number, number, number] })}
            />
          </div>
          <div className="mt-2">
            <SliderInput
              label="Rotation Y"
              value={obs.rotationYDeg}
              min={-180}
              max={180}
              unit="°"
              onChange={(value) => updateNode(obs.id, { rotationYDeg: value })}
            />
          </div>
        </SectionCard>

        <SectionCard title="Dimensions">
          <div className="grid grid-cols-3 gap-1.5">
            <NumberInput
              label="W"
              value={obs.dimensions[0]}
              min={0.1}
              step={0.1}
              unit="m"
              onChange={(value) => updateNode(obs.id, { dimensions: [value, obs.dimensions[1], obs.dimensions[2]] as [number, number, number] })}
            />
            <NumberInput
              label="H"
              value={obs.dimensions[2]}
              min={0.1}
              step={0.1}
              unit="m"
              onChange={(value) => updateNode(obs.id, { dimensions: [obs.dimensions[0], obs.dimensions[1], value] as [number, number, number] })}
            />
            <NumberInput
              label="D"
              value={obs.dimensions[1]}
              min={0.1}
              step={0.1}
              unit="m"
              onChange={(value) => updateNode(obs.id, { dimensions: [obs.dimensions[0], value, obs.dimensions[2]] as [number, number, number] })}
            />
          </div>
        </SectionCard>

        <SectionCard title="Material">
          <SelectInput
            label="Material"
            value={obs.material}
            options={[...OBSTRUCTION_MATERIALS]}
            onChange={(value) => updateNode(obs.id, {
              material: value as ObstructionNode["material"],
              visionTransmission: VISION_TRANSMISSION[value as ObstructionNode["material"]] ?? 0,
            })}
          />
          <Field label="Vision Transmission" value={`${Math.round((obs.visionTransmission ?? 0) * 100)}%`} />
          <Field label="Movable" value={obs.movable ? "Yes" : "No"} />
        </SectionCard>
      </div>

      <div className="border-t border-[#1e2130] px-3 py-3">
        <button
          type="button"
          disabled
          title="Available in Phase 3"
          className="flex h-8 w-full cursor-not-allowed items-center justify-center gap-1.5 rounded-lg border border-[#24283a] bg-[#111521] text-[10px] font-medium text-[#6f7890] opacity-70"
        >
          Test Without This Obstruction
        </button>
      </div>
    </>
  );
}

function LightInspector() {
  const selectedId = useStudioStore((s) => s.selectedNodeId);
  const scene = useStudioStore((s) => s.scene);
  const updateNode = useStudioStore((s) => s.updateNode);
  const removeNode = useStudioStore((s) => s.removeNode);

  const light = scene.securityLights.find((l) => l.id === selectedId);
  if (!light) return null;

  const statusColor = light.status === "on" ? "green" : light.status === "failed" ? "red" : "gray";

  return (
    <>
      <div className="border-b border-[#1e2130] px-3 py-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl border border-yellow-500/20 bg-yellow-500/10">
              <Lightbulb className="h-4 w-4 text-yellow-400" />
            </div>
            <div>
              <div className="text-[12px] font-semibold text-white">{light.name}</div>
              <div className="text-[9px] uppercase tracking-[0.18em] text-[#556076]">{light.lightType}</div>
            </div>
          </div>
          <Badge variant={statusColor} dot>
            {light.status}
          </Badge>
        </div>
      </div>

      <div className="flex-1 space-y-2.5 overflow-y-auto px-3 py-3">
        <SectionCard title="Position">
          <div className="grid grid-cols-2 gap-2">
            <NumberInput
              label="X"
              value={light.position[0]}
              step={0.1}
              unit="m"
              onChange={(value) => updateNode(light.id, { position: [value, light.position[1], light.position[2]] as [number, number, number] })}
            />
            <NumberInput
              label="Z"
              value={light.position[2]}
              step={0.1}
              unit="m"
              onChange={(value) => updateNode(light.id, { position: [light.position[0], light.position[1], value] as [number, number, number] })}
            />
            <NumberInput
              label="Y"
              value={light.position[1]}
              step={0.1}
              unit="m"
              onChange={(value) => updateNode(light.id, { position: [light.position[0], value, light.position[2]] as [number, number, number] })}
            />
            <NumberInput
              label="Range"
              value={light.rangeM}
              min={0.5}
              max={20}
              step={0.5}
              unit="m"
              onChange={(value) => updateNode(light.id, { rangeM: value })}
            />
          </div>
        </SectionCard>

        <SectionCard title="Light Properties">
          <SelectInput
            label="Brightness"
            value={light.brightness}
            options={[
              { value: "dim", label: "Dim" },
              { value: "low", label: "Low" },
              { value: "medium", label: "Medium" },
              { value: "high", label: "High" },
              { value: "very_high", label: "Very High" },
            ]}
            onChange={(value) => updateNode(light.id, { brightness: value as SecurityLightNode["brightness"] })}
          />
          <SelectInput
            label="Type"
            value={light.lightType}
            options={[
              { value: "ceiling", label: "Ceiling" },
              { value: "wall", label: "Wall" },
              { value: "flood", label: "Flood" },
              { value: "street", label: "Street" },
              { value: "emergency", label: "Emergency" },
              { value: "ir_flood", label: "IR Flood" },
            ]}
            onChange={(value) => updateNode(light.id, { lightType: value as SecurityLightNode["lightType"] })}
          />
          <SelectInput
            label="Status"
            value={light.status}
            options={[
              { value: "on", label: "On" },
              { value: "off", label: "Off" },
              { value: "failed", label: "Failed" },
            ]}
            onChange={(value) => updateNode(light.id, { status: value as SecurityLightNode["status"] })}
          />
        </SectionCard>
      </div>

      <div className="border-t border-[#1e2130] px-3 py-3">
        <button
          type="button"
          onClick={() => removeNode(light.id)}
          className="flex h-8 w-full items-center justify-center gap-1.5 rounded-lg border border-red-900/30 bg-red-950/20 text-[10px] font-medium text-red-400 hover:bg-red-900/30 transition-colors"
        >
          <Trash2 className="h-3 w-3" />
          Remove Light
        </button>
      </div>
    </>
  );
}

function NoSelection() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 px-5 text-center">
      <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-[#1f2536] bg-[#0b0f17] shadow-[inset_0_1px_0_rgba(255,255,255,0.02)]">
        <Shield className="h-5 w-5 text-[#434d63]" />
      </div>
      <div>
        <div className="text-[11px] font-medium text-[#95a0b7]">No object selected</div>
        <div className="mt-1 text-[9px] leading-relaxed text-[#556076]">Click a camera, zone, or obstruction in the canvas to inspect its verified properties.</div>
      </div>
    </div>
  );
}

export function InspectorPanel() {
  const selectedId = useStudioStore((s) => s.selectedNodeId);
  const scene = useStudioStore((s) => s.scene);
  const camera = scene.cameras.find((entry) => entry.id === selectedId);
  const obstruction = scene.obstructions.find((entry) => entry.id === selectedId);
  const light = scene.securityLights.find((entry) => entry.id === selectedId);

  return (
    <aside className="flex w-[304px] flex-shrink-0 flex-col overflow-hidden border-l border-[#1e2130] bg-[#0d1017]">
      <div className="flex h-8 items-center border-b border-[#1e2130] px-3 text-[9px] font-semibold uppercase tracking-[0.22em] text-[#4a5568]">
        Inspector
      </div>
      {camera ? <CameraInspector /> : obstruction ? <ObstructionInspector /> : light ? <LightInspector /> : <NoSelection />}
    </aside>
  );
}
