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
import { useState } from "react";

import { CameraFeedCanvas } from "@/components/inspector/CameraFeedCanvas";
import { Badge } from "@/components/shared/Badge";
import { cn } from "@/lib/cn";
import { pathLength } from "@/components/workspace/editing/editor-geometry";
import type {
  CameraNode,
  CriticalZoneNode,
  DoorNode,
  ObstructionNode,
  PrivacyZoneNode,
  ScenarioPath,
  SecurityLightNode,
  WallNode,
  WindowNode,
} from "@/schema/security-scene";
import { type InspectorTab, useStudioStore } from "@/store/studio-store";
import type { DoriQuality, SimulationAssumptions } from "@/schema/security-scene";

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

/** Compute DORI effective ranges in metres for a camera, using the scene's PPM thresholds. */
function computeDoriRanges(camera: CameraNode, scenePpm: SimulationAssumptions["pixelsPerMeter"]) {
  const resW = camera.resolutionWidth ?? (camera.resolutionMP >= 8 ? 3840 : camera.resolutionMP >= 4 ? 2688 : 1920);
  const tanHalfFov = Math.tan((camera.fovHorizontalDeg / 2) * (Math.PI / 180));
  // range = resW / (2 * ppm * tanHalfFov), capped at camera.rangeM
  const cap = camera.rangeM;
  const det  = Math.min(resW / (2 * scenePpm.detection  * tanHalfFov), cap);
  const obs  = Math.min(resW / (2 * scenePpm.observation * tanHalfFov), cap);
  const recog = Math.min(resW / (2 * scenePpm.recognition * tanHalfFov), cap);
  const ident = Math.min(resW / (2 * scenePpm.identification * tanHalfFov), cap);
  return { det, obs, recog, ident };
}

type CameraViewMode = "normal" | "ir" | "low_light" | "thermal";

const VIEW_MODES: Array<{ value: CameraViewMode; label: string }> = [
  { value: "normal", label: "Normal" },
  { value: "ir", label: "IR (B/W)" },
  { value: "low_light", label: "Low Light" },
  { value: "thermal", label: "Thermal" },
];

type ViewToggleKey = "overlays" | "dori" | "path" | "zones" | "timestamp" | "grid";
const VIEW_TOGGLES: Array<{ key: ViewToggleKey; label: string }> = [
  { key: "overlays", label: "Overlays" },
  { key: "dori", label: "DORI" },
  { key: "path", label: "Path" },
  { key: "zones", label: "Zones" },
  { key: "timestamp", label: "Timestamp" },
  { key: "grid", label: "Grid" },
];
type ViewToggleState = Record<ViewToggleKey, boolean>;

const QUALITY_LABEL: Record<DoriQuality, string> = {
  none: "No Signal",
  detection: "Detection",
  overview: "Overview",
  outline: "Outline",
  observation: "Observation",
  discern: "Discern",
  perceive: "Perceive",
  recognition: "Recognition",
  characterize: "Characterize",
  validate: "Validate",
  identification: "Identification",
  scrutinize: "Scrutinize",
};

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

const OBSTRUCTION_TYPE_OPTIONS = [
  { value: "shelf", label: "Shelf" },
  { value: "cupboard", label: "Cupboard" },
  { value: "counter", label: "Counter" },
  { value: "pillar", label: "Pillar" },
  { value: "vehicle", label: "Vehicle" },
  { value: "partition", label: "Partition" },
  { value: "storage_boxes", label: "Storage Boxes" },
  { value: "glass_display", label: "Glass Display" },
  { value: "tree", label: "Tree" },
  { value: "gate", label: "Gate" },
  { value: "signboard", label: "Signboard" },
  { value: "curtain", label: "Curtain" },
  { value: "other", label: "Other" },
] as const satisfies { value: ObstructionNode["obstructionType"]; label: string }[];

const OBSTRUCTION_TYPE_CONFIG: Partial<Record<
  ObstructionNode["obstructionType"],
  {
    label: string;
    dimensions: [number, number, number];
    material: ObstructionNode["material"];
    visionTransmission: number;
  }
>> = {
  shelf: { label: "Shelf", dimensions: [1.2, 0.5, 2.0], material: "solid", visionTransmission: 0 },
  cupboard: { label: "Cupboard", dimensions: [1.0, 0.6, 2.1], material: "solid", visionTransmission: 0 },
  counter: { label: "Counter", dimensions: [1.5, 0.8, 1.1], material: "solid", visionTransmission: 0 },
  pillar: { label: "Pillar", dimensions: [0.6, 0.6, 2.8], material: "solid", visionTransmission: 0 },
  vehicle: { label: "Vehicle", dimensions: [2.1, 4.2, 1.8], material: "solid", visionTransmission: 0 },
  partition: { label: "Partition", dimensions: [1.5, 0.15, 2.1], material: "partial", visionTransmission: 0.3 },
  storage_boxes: { label: "Storage Boxes", dimensions: [1.4, 0.8, 1.4], material: "solid", visionTransmission: 0 },
  glass_display: { label: "Glass Display", dimensions: [1.4, 0.6, 1.9], material: "glass", visionTransmission: 0.65 },
  tree: { label: "Tree", dimensions: [1.4, 1.4, 2.8], material: "solid", visionTransmission: 0 },
  gate: { label: "Gate", dimensions: [1.5, 0.2, 2.2], material: "partial", visionTransmission: 0.3 },
  signboard: { label: "Signboard", dimensions: [1.2, 0.1, 1.8], material: "solid", visionTransmission: 0 },
  curtain: { label: "Curtain", dimensions: [1.6, 0.05, 2.3], material: "curtain", visionTransmission: 0.2 },
  other: { label: "Obstruction", dimensions: [1.0, 0.5, 2.0], material: "solid", visionTransmission: 0 },
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
  const addSnapshot = useStudioStore((s) => s.addSnapshot);
  const setWorkspacePreset = useStudioStore((s) => s.setWorkspacePreset);
  const setViewMode = useStudioStore((s) => s.setViewMode);
  const [viewMode, setViewModeState] = useState<CameraViewMode>("normal");
  const [viewToggles, setViewToggles] = useState<ViewToggleState>({
    overlays: true,
    dori: true,
    path: false,
    zones: true,
    timestamp: true,
    grid: false,
  });
  const [snapshotNote, setSnapshotNote] = useState("");

  if (!camera) return null;

  // Count recommendations relevant to this camera
  const recCount = (result?.recommendations ?? []).filter(
    (r) => !r.affectedNodeId || r.affectedNodeId === camera.id,
  ).length;

  const tabs: { id: InspectorTab; label: string; badge?: number }[] = [
    { id: "properties", label: "Properties", badge: recCount > 0 ? recCount : undefined },
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

  const setViewToggle = (key: ViewToggleKey) => {
    setViewToggles((current) => ({ ...current, [key]: !current[key] }));
  };

  const saveInspectionSnapshot = () => {
    const stamp = new Date().toISOString().replace("T", " ").slice(0, 19);
    const label = snapshotNote.trim().length > 0 ? `${snapshotNote.trim()} (${stamp})` : `View snapshot ${stamp}`;
    addSnapshot(label, result ?? scene.simulation!);
    setSnapshotNote("");
  };

  const openInCameraWall = () => {
    setWorkspacePreset("camera_wall");
    setViewMode("wall");
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
              "-mb-px relative rounded-t-lg border-b-2 px-2 py-1.5 text-[10px] font-medium transition-colors",
              inspectorTab === tab.id
                ? "border-green-500 text-green-300"
                : "border-transparent text-[#5a647a] hover:text-[#a1abc1]",
            )}
          >
            {tab.label}
            {tab.badge !== undefined && tab.badge > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-blue-500 text-[7px] font-bold text-white">
                {tab.badge > 9 ? "9+" : tab.badge}
              </span>
            )}
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
              const dori = computeDoriRanges(camera, scene.assumptions.pixelsPerMeter);
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
          <div className="space-y-2.5">
            <div className="rounded-xl border border-[#1f2536] bg-[#0b0f17] p-2.5">
              <div className="mb-2 text-[9px] font-semibold uppercase tracking-[0.2em] text-[#4a5568]">Live Camera Feed</div>
              <CameraFeedCanvas cameraId={camera.id} />
              <div className="mt-2 flex flex-wrap gap-1">
                {VIEW_MODES.map((entry) => (
                  <button
                    key={entry.value}
                    type="button"
                    onClick={() => setViewModeState(entry.value)}
                    className={cn(
                      "rounded-md border px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.08em] transition-colors",
                      viewMode === entry.value
                        ? "border-cyan-500/80 bg-cyan-500/10 text-cyan-200"
                        : "border-[#293145] text-[#74829d] hover:text-[#c2cde3]",
                    )}
                  >
                    {entry.label}
                  </button>
                ))}
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {VIEW_TOGGLES.map((toggle) => (
                  <button
                    key={toggle.key}
                    type="button"
                    onClick={() => setViewToggle(toggle.key)}
                    className={cn(
                      "inline-flex items-center rounded-full border px-2 py-1 text-[9px] transition-colors",
                      viewToggles[toggle.key]
                        ? "border-cyan-500/60 bg-cyan-500/10 text-cyan-200"
                        : "border-[#293145] text-[#6a758e]",
                    )}
                  >
                    <span
                      className={cn(
                        "mr-1.5 inline-block h-1.5 w-1.5 rounded-full",
                        viewToggles[toggle.key] ? "bg-cyan-300" : "bg-[#5b657a]",
                      )}
                    />
                    {toggle.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              <SectionCard title="View Metrics">
                <div className="space-y-1">
                  <Field label="Camera" value={camera.name} />
                  <Field label="Status" value={camera.status === "on" ? "Online" : "Offline"} />
                  <Field label="Mode" value={viewMode === "normal" ? "Normal" : viewMode === "ir" ? "IR (B/W)" : viewMode === "low_light" ? "Low Light" : "Thermal"} />
                  <Field label="FOV" value={`${camera.fovHorizontalDeg}°`} />
                  <Field label="Resolution" value={`${camera.resolutionMP}MP`} />
                  <Field label="Range" value={`${camera.rangeM}m`} />
                  {camResult ? <Field label="Coverage" value={`${camResult.coveragePct.toFixed(1)}%`} /> : null}
                  {camResult ? <Field label="Critical zones passed" value={camResult.criticalZonesCovered.length} /> : null}
                  {camResult ? <Field label="Critical zones failed" value={camResult.criticalZonesFailed.length} /> : null}
                </div>
              </SectionCard>

              <SectionCard title="DORI Profile">
                {(() => {
                  const ranges = computeDoriRanges(camera, scene.assumptions.pixelsPerMeter);
                  const sortedZoneEntries = (Object.entries(camResult?.qualityByZone ?? {}) as [string, DoriQuality][])
                    .map(([zoneId, quality]) => {
                      const zone = scene.criticalZones.find((entry) => entry.id === zoneId);
                      return {
                        name: zone?.label ?? zoneId,
                        quality,
                      };
                    })
                    .filter((entry) => entry.quality !== undefined);

                  const doriRows = [
                    ["identification", ranges.ident, "#60a5fa"],
                    ["recognition", ranges.recog, "#22c55e"],
                    ["observation", ranges.obs, "#eab308"],
                    ["detection", ranges.det, "#f97316"],
                  ] as const;

                  return (
                    <div className="space-y-2">
                      <div className="space-y-1">
                        <div className="text-[9px] font-semibold text-[#87a5cf]">Zone quality checkpoints</div>
                        {sortedZoneEntries.length > 0 ? (
                          <div className="space-y-1">
                            {sortedZoneEntries.slice(0, 2).map((entry) => (
                              <div key={entry.name} className="rounded-md border border-[#1f2b42] bg-[#111827] px-2 py-1.5">
                                <div className="flex items-center justify-between gap-2 text-[10px]">
                                  <span className="truncate text-[#c7d0e4]">{entry.name}</span>
                                  <span className="font-semibold text-[#93c5fd]">{QUALITY_LABEL[entry.quality]}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="text-[9px] text-[#4a5568]">No active critical-zone quality samples yet.</div>
                        )}
                      </div>

                      <div className="space-y-1">
                        {doriRows.map(([label, value, color]) => (
                          <div key={label} className="flex items-center justify-between gap-2 text-[10px]">
                            <div className="flex items-center gap-2">
                              <span className="h-2 w-2 rounded-sm" style={{ backgroundColor: color }} />
                              <span className="text-[#d2d9e8] capitalize">{label}</span>
                            </div>
                            <span className="font-mono text-[10px] text-[#93a0bd]">{value.toFixed(1)}m</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}
              </SectionCard>
            </div>

            <div className="space-y-2 rounded-xl border border-[#1f2536] bg-[#0b0f17] p-2.5">
              <div className="text-[9px] font-semibold uppercase tracking-[0.2em] text-[#4a5568]">Report Snapshot</div>
              <div className="grid gap-2 md:grid-cols-[1fr_auto]">
                <input
                  value={snapshotNote}
                  onChange={(event) => setSnapshotNote(event.target.value)}
                  placeholder="e.g. before wall shift"
                  className="rounded-lg border border-[#24283a] bg-[#111521] px-2 py-1.5 text-[10px] text-[#d2d9e8] outline-none"
                />
                <button
                  type="button"
                  onClick={saveInspectionSnapshot}
                  disabled={!result && !scene.simulation}
                  className="rounded-lg border border-emerald-600/50 bg-emerald-700/10 px-2 py-1.5 text-[9px] font-medium text-emerald-200 transition-colors disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Take Snapshot
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={openInCameraWall}
                className="rounded-lg border border-[#24283a] bg-[#111521] px-2 py-2 text-[10px] font-medium text-[#c7d0e4] transition-colors hover:border-[#32384d] hover:text-white"
              >
                Open in Camera Wall
              </button>
              <button
                type="button"
                onClick={() => {
                  const store = useStudioStore.getState();
                  store.setWorkspacePreset("coverage");
                  store.setViewMode("camera_view");
                }}
                className="rounded-lg border border-[#24283a] bg-[#111521] px-2 py-2 text-[10px] font-medium text-[#c7d0e4] transition-colors hover:border-[#32384d] hover:text-white"
              >
                Enter Full Camera View
              </button>
            </div>
          </div>
        )}

        {inspectorTab === "failures" && (() => {
          // --- Criticality analysis ---
          const coveragePct = camResult?.coveragePct ?? 0;
          const zonesCovered = camResult?.criticalZonesCovered ?? [];

          // Which of this camera's zones have NO backup camera?
          const otherResults = (result?.cameraResults ?? []).filter((r) => r.cameraId !== camera.id);
          const nonRedundantZones = zonesCovered.filter(
            (zoneId) => !otherResults.some((o) => o.criticalZonesCovered.includes(zoneId))
          );

          // Criticality score 0-10: coverage contribution + non-redundant zone penalty
          const critScore = Math.min(10, Math.round((coveragePct / 12) + nonRedundantZones.length * 2));
          const critLabel = critScore >= 8 ? "Critical" : critScore >= 5 ? "Important" : "Redundant";
          const critColor = critScore >= 8 ? "text-red-400" : critScore >= 5 ? "text-amber-400" : "text-green-400";
          const critBorderColor = critScore >= 8 ? "#f87171" : critScore >= 5 ? "#fbbf24" : "#4ade80";

          // Path segments that rely on this camera
          const pathSegmentCount = (result?.pathResults ?? []).flatMap((pr) =>
            pr.timeline.filter((t) => t.cameraId === camera.id)
          ).length;

          // Failure state derived from camera props (no extra useState needed)
          const isOffline = camera.status !== "on";
          const isDirty = camera.clarity === "poor";
          const isNightDisabled = camera.nightMode === "none";
          const isSimulatingFailure = isOffline || isDirty || isNightDisabled;

          return (
            <div className="space-y-2.5">
              {/* Criticality card */}
              {camResult && (
                <div className="rounded-xl border border-[#1f2536] bg-[#0b0f17] p-2.5">
                  <div className="mb-2 text-[9px] font-semibold uppercase tracking-[0.2em] text-[#4a5568]">
                    Camera Criticality
                  </div>
                  <div className="flex items-center gap-3">
                    <div
                      className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full border-2"
                      style={{ borderColor: critBorderColor }}
                    >
                      <span className={`text-[15px] font-bold ${critColor}`}>{critScore}</span>
                    </div>
                    <div>
                      <div className={`text-[12px] font-semibold ${critColor}`}>{critLabel}</div>
                      <div className="mt-0.5 text-[9px] text-[#4a5568]">
                        {coveragePct.toFixed(1)}% scene · {nonRedundantZones.length} sole-coverage zone{nonRedundantZones.length !== 1 ? "s" : ""}
                      </div>
                    </div>
                    <div className="ml-auto text-right">
                      <div className="font-mono text-[13px] font-bold text-[#c7d0e4]">
                        {pathSegmentCount}
                      </div>
                      <div className="text-[8px] text-[#4a5568]">path events</div>
                    </div>
                  </div>
                </div>
              )}

              {/* Failure toggles */}
              <div className="rounded-xl border border-[#1f2536] bg-[#0b0f17] p-2.5">
                <div className="mb-2 text-[9px] font-semibold uppercase tracking-[0.2em] text-[#4a5568]">
                  Simulate Failure
                </div>
                <div className="space-y-2">
                  {/* Camera Offline */}
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <div className="text-[10px] text-[#c7d0e4]">Camera Offline</div>
                      <div className="text-[8px] text-[#4a5568]">Power cut / network loss</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => updateNode(camera.id, { status: isOffline ? "on" : "off" })}
                      className={cn(
                        "flex h-5 w-9 flex-shrink-0 items-center rounded-full px-0.5 transition-colors",
                        isOffline ? "bg-red-500/60" : "bg-[#2a3246]",
                      )}
                    >
                      <span
                        className={cn(
                          "block h-4 w-4 rounded-full bg-white shadow transition-transform",
                          isOffline ? "translate-x-4" : "translate-x-0",
                        )}
                      />
                    </button>
                  </div>

                  {/* Dirty / Blocked Lens */}
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <div className="text-[10px] text-[#c7d0e4]">Dirty / Blocked Lens</div>
                      <div className="text-[8px] text-[#4a5568]">Spray paint, grease, mud</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => updateNode(camera.id, { clarity: isDirty ? "good" : "poor" })}
                      className={cn(
                        "flex h-5 w-9 flex-shrink-0 items-center rounded-full px-0.5 transition-colors",
                        isDirty ? "bg-amber-500/60" : "bg-[#2a3246]",
                      )}
                    >
                      <span
                        className={cn(
                          "block h-4 w-4 rounded-full bg-white shadow transition-transform",
                          isDirty ? "translate-x-4" : "translate-x-0",
                        )}
                      />
                    </button>
                  </div>

                  {/* Night Vision Disabled */}
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <div className="text-[10px] text-[#c7d0e4]">Night Vision Disabled</div>
                      <div className="text-[8px] text-[#4a5568]">IR cut / low-light mode off</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => updateNode(camera.id, { nightMode: isNightDisabled ? "ir" : "none" })}
                      className={cn(
                        "flex h-5 w-9 flex-shrink-0 items-center rounded-full px-0.5 transition-colors",
                        isNightDisabled ? "bg-amber-500/60" : "bg-[#2a3246]",
                      )}
                    >
                      <span
                        className={cn(
                          "block h-4 w-4 rounded-full bg-white shadow transition-transform",
                          isNightDisabled ? "translate-x-4" : "translate-x-0",
                        )}
                      />
                    </button>
                  </div>
                </div>

                {/* Failure active banner */}
                {isSimulatingFailure && (
                  <div className="mt-2.5 flex items-center justify-between rounded-lg border border-amber-500/25 bg-amber-500/8 px-2 py-1.5">
                    <span className="text-[9px] text-amber-300">Failure active — re-run simulation to see impact</span>
                    <button
                      type="button"
                      onClick={() => updateNode(camera.id, { status: "on", clarity: "good", nightMode: "ir" })}
                      className="ml-2 flex-shrink-0 rounded border border-amber-500/30 px-1.5 py-0.5 text-[8px] font-medium text-amber-300 transition-colors hover:bg-amber-500/15"
                    >
                      Restore
                    </button>
                  </div>
                )}

                {!isSimulatingFailure && (
                  <div className="mt-2.5 text-[8px] text-[#3a4158]">
                    Toggle failures above, then re-run simulation to compute impact.
                  </div>
                )}
              </div>

              {/* Zone redundancy map */}
              {zonesCovered.length > 0 && (
                <div className="rounded-xl border border-[#1f2536] bg-[#0b0f17] p-2.5">
                  <div className="mb-2 text-[9px] font-semibold uppercase tracking-[0.2em] text-[#4a5568]">
                    Zone Coverage ({zonesCovered.length})
                  </div>
                  <div className="space-y-1">
                    {zonesCovered.map((zoneId) => {
                      const hasBackup = otherResults.some((o) => o.criticalZonesCovered.includes(zoneId));
                      const zoneName = scene.criticalZones.find((z) => z.id === zoneId)?.label ?? zoneId;
                      return (
                        <div key={zoneId} className="flex items-center justify-between gap-2">
                          <span className="truncate text-[10px] text-[#8090a8]">{zoneName}</span>
                          <span
                            className={cn(
                              "flex-shrink-0 rounded px-1.5 py-0.5 text-[7px] font-semibold",
                              hasBackup
                                ? "bg-green-900/30 text-green-400"
                                : "bg-red-900/30 text-red-400",
                            )}
                          >
                            {hasBackup ? "Redundant" : "No Backup"}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Path exposure */}
              {pathSegmentCount > 0 && (
                <div className="rounded-xl border border-[#1f2536] bg-[#0b0f17] p-2.5">
                  <div className="mb-1 text-[9px] font-semibold uppercase tracking-[0.2em] text-[#4a5568]">
                    Adversarial Path Exposure
                  </div>
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-[17px] font-bold text-orange-300">{pathSegmentCount}</span>
                    <span className="text-[9px] text-[#4a5568]">
                      detection event{pathSegmentCount !== 1 ? "s" : ""} rely on this camera
                    </span>
                  </div>
                  <div className="mt-1 text-[8px] text-[#3a4158]">
                    If offline, {pathSegmentCount} path detection{pathSegmentCount !== 1 ? "s" : ""} would be lost.
                  </div>
                </div>
              )}

              {/* Simulation impact messages */}
              {offlineImpact.length > 0 && (
                <div className="rounded-xl border border-[#1f2536] bg-[#0b0f17] p-2.5">
                  <div className="mb-2 text-[9px] font-semibold uppercase tracking-[0.2em] text-[#4a5568]">
                    Impact Notes
                  </div>
                  <div className="space-y-1.5">
                    {offlineImpact.map((message, index) => (
                      <div
                        key={index}
                        className="rounded-lg border border-amber-500/20 bg-amber-500/8 px-2 py-1.5 text-[9px] text-amber-200"
                      >
                        {message}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* No simulation data yet */}
              {!camResult && (
                <div className="rounded-lg border border-[#1f2536] bg-[#111521] p-3 text-[10px] leading-relaxed text-[#6a748b]">
                  Run simulation to populate failure impact analysis for this camera.
                </div>
              )}
            </div>
          );
        })()}
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
              const store = useStudioStore.getState();
              store.setWorkspacePreset("coverage");
              store.setViewMode("camera_view");
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

// ── Critical Zone Inspector ──────────────────────────────────────────────────

const TARGET_TYPE_LABELS: Record<CriticalZoneNode["targetType"], string> = {
  person_detection: "Person Detection",
  face_recognition: "Face Recognition",
  face_identification: "Face ID",
  vehicle_detection: "Vehicle Detection",
  license_plate: "License Plate",
  package_detection: "Package Detection",
  cash_counter_activity: "Cash Counter",
  door_entry_exit: "Door Entry/Exit",
  perimeter_breach: "Perimeter Breach",
};

const QUALITY_BADGE_COLORS: Record<string, string> = {
  identification: "bg-blue-900/40 text-blue-300",
  recognition:    "bg-green-900/40 text-green-300",
  observation:    "bg-yellow-900/40 text-yellow-300",
  detection:      "bg-orange-900/40 text-orange-300",
  none:           "bg-red-900/40 text-red-400",
};

function CriticalZoneInspector() {
  const selectedId = useStudioStore((s) => s.selectedNodeId);
  const scene = useStudioStore((s) => s.scene);
  const result = useStudioStore((s) => s.simulationResult);
  const updateNode = useStudioStore((s) => s.updateNode);
  const removeNode = useStudioStore((s) => s.removeNode);

  const zone = scene.criticalZones.find((z) => z.id === selectedId);
  if (!zone) return null;

  const zoneResult = result?.criticalZoneResults.find((r) => r.zoneId === zone.id);
  const coveringCameras = zoneResult?.coveringCameras ?? [];
  const isPassing = zoneResult?.status === "pass";
  const isPartial = zoneResult?.status === "partial";

  // Camera names lookup
  const camNames: Record<string, string> = {};
  for (const cam of scene.cameras) camNames[cam.id] = cam.name;

  return (
    <>
      {/* Header */}
      <div className="border-b border-[#1e2130] px-3 py-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl border border-emerald-500/20 bg-emerald-500/10">
              <Shield className="h-4 w-4 text-emerald-400" />
            </div>
            <div>
              <div className="text-[12px] font-semibold text-white">{zone.label}</div>
              <div className="text-[9px] uppercase tracking-[0.18em] text-[#556076]">
                {TARGET_TYPE_LABELS[zone.targetType]} · {zone.priority}
              </div>
            </div>
          </div>
          {zoneResult ? (
            <Badge variant={isPassing ? "green" : isPartial ? "amber" : "red"} dot>
              {isPassing ? "Pass" : isPartial ? "Partial" : "Fail"}
            </Badge>
          ) : (
            <Badge variant="gray">No run</Badge>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-3 py-2.5 space-y-2.5">
        {/* Required vs Actual */}
        <SectionCard title="DORI Quality">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] text-[#6a748b]">Required</span>
              <span className={cn("rounded px-1.5 py-0.5 text-[9px] font-semibold capitalize", QUALITY_BADGE_COLORS[zone.requiredQuality] ?? "bg-[#1f2536] text-[#8090a8]")}>
                {zone.requiredQuality}
              </span>
            </div>
            {zoneResult && (
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] text-[#6a748b]">Actual</span>
                <span className={cn("rounded px-1.5 py-0.5 text-[9px] font-semibold capitalize", QUALITY_BADGE_COLORS[zoneResult.actualQuality] ?? "bg-[#1f2536] text-[#8090a8]")}>
                  {zoneResult.actualQuality}
                </span>
              </div>
            )}
          </div>
        </SectionCard>

        {/* Zone properties — editable */}
        <SectionCard title="Properties">
          {/* Target Type */}
          <div className="flex items-center justify-between gap-2 border-b border-[#181c27] py-1.5">
            <span className="text-[10px] text-[#6a748b]">Target Type</span>
            <select
              value={zone.targetType}
              onChange={(e) => updateNode(zone.id, { targetType: e.target.value as CriticalZoneNode["targetType"] })}
              className="rounded-md border border-[#24283a] bg-[#111521] px-2 py-1 text-[9px] font-medium text-[#d2d9e8] outline-none transition-colors hover:border-[#32384d]"
            >
              {(Object.keys(TARGET_TYPE_LABELS) as CriticalZoneNode["targetType"][]).map((t) => (
                <option key={t} value={t}>{TARGET_TYPE_LABELS[t]}</option>
              ))}
            </select>
          </div>
          {/* Required Quality */}
          <div className="flex items-center justify-between gap-2 border-b border-[#181c27] py-1.5">
            <span className="text-[10px] text-[#6a748b]">Required Quality</span>
            <select
              value={zone.requiredQuality}
              onChange={(e) => updateNode(zone.id, { requiredQuality: e.target.value as CriticalZoneNode["requiredQuality"] })}
              className="rounded-md border border-[#24283a] bg-[#111521] px-2 py-1 text-[9px] font-medium text-[#d2d9e8] outline-none transition-colors hover:border-[#32384d]"
            >
              <option value="detection">Detection</option>
              <option value="observation">Observation</option>
              <option value="recognition">Recognition</option>
              <option value="identification">Identification</option>
            </select>
          </div>
          {/* Priority */}
          <div className="flex items-center justify-between gap-2 border-b border-[#181c27] py-1.5">
            <span className="text-[10px] text-[#6a748b]">Priority</span>
            <select
              value={zone.priority}
              onChange={(e) => updateNode(zone.id, { priority: e.target.value as CriticalZoneNode["priority"] })}
              className="rounded-md border border-[#24283a] bg-[#111521] px-2 py-1 text-[9px] font-medium text-[#d2d9e8] outline-none transition-colors hover:border-[#32384d]"
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="critical">Critical</option>
            </select>
          </div>
          {/* Night Required */}
          <div className="flex items-center justify-between gap-2 border-b border-[#181c27] py-1.5">
            <span className="text-[10px] text-[#6a748b]">Night Coverage Required</span>
            <button
              type="button"
              onClick={() => updateNode(zone.id, { nightRequired: !zone.nightRequired })}
              className={cn(
                "flex h-5 w-9 flex-shrink-0 items-center rounded-full px-0.5 transition-colors",
                zone.nightRequired ? "bg-blue-600/50" : "bg-[#2a3246]",
              )}
            >
              <span className={cn("block h-4 w-4 rounded-full bg-white shadow transition-transform", zone.nightRequired ? "translate-x-4" : "")} />
            </button>
          </div>
          {/* Redundancy Required */}
          <div className="flex items-center justify-between gap-2 py-1.5">
            <span className="text-[10px] text-[#6a748b]">Redundancy Required</span>
            <button
              type="button"
              onClick={() => updateNode(zone.id, { redundancyRequired: !zone.redundancyRequired })}
              className={cn(
                "flex h-5 w-9 flex-shrink-0 items-center rounded-full px-0.5 transition-colors",
                zone.redundancyRequired ? "bg-blue-600/50" : "bg-[#2a3246]",
              )}
            >
              <span className={cn("block h-4 w-4 rounded-full bg-white shadow transition-transform", zone.redundancyRequired ? "translate-x-4" : "")} />
            </button>
          </div>
        </SectionCard>

        {/* Covering cameras */}
        {coveringCameras.length > 0 && (
          <SectionCard title={`Covered By (${coveringCameras.length})`}>
            <div className="space-y-1">
              {coveringCameras.map((camId) => (
                <div key={camId} className="flex items-center gap-1.5 text-[10px] text-[#8090a8]">
                  <Camera className="h-3 w-3 flex-shrink-0 text-blue-400" />
                  {camNames[camId] ?? camId}
                </div>
              ))}
            </div>
          </SectionCard>
        )}

        {zoneResult && !isPassing && (
          <div className="rounded-xl border border-red-500/15 bg-red-500/5 p-2.5">
            <div className="mb-1 text-[9px] font-semibold uppercase tracking-[0.18em] text-red-400">Coverage Gap</div>
            <div className="text-[9px] leading-relaxed text-[#c7d0e4]">
              This zone requires <strong>{zone.requiredQuality}</strong> but is receiving <strong>{zoneResult.actualQuality}</strong>.
              {coveringCameras.length === 0
                ? " No camera currently covers this zone."
                : ` ${coveringCameras.length} camera${coveringCameras.length !== 1 ? "s" : ""} cover it, but quality is insufficient.`}
            </div>
          </div>
        )}

        {!result && (
          <div className="rounded-lg border border-[#1f2536] bg-[#111521] p-3 text-[10px] leading-relaxed text-[#6a748b]">
            Run simulation to see zone coverage results.
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="border-t border-[#1e2130] px-3 py-3">
        <button
          type="button"
          onClick={() => removeNode(zone.id)}
          className="flex h-8 w-full items-center justify-center gap-1.5 rounded-lg border border-red-900/30 bg-red-950/15 text-[10px] font-medium text-red-400 transition-colors hover:border-red-700 hover:bg-red-950/30"
        >
          <Trash2 className="h-3 w-3" />
          Delete Zone
        </button>
      </div>
    </>
  );
}

// ── Obstruction Inspector ─────────────────────────────────────────────────────

function ObstructionInspector() {
  const selectedId = useStudioStore((s) => s.selectedNodeId);
  const scene = useStudioStore((s) => s.scene);
  const updateNode = useStudioStore((s) => s.updateNode);
  const simulationResult = useStudioStore((s) => s.simulationResult);
  const counterfactualResult = useStudioStore((s) => s.counterfactualResult);
  const counterfactualObsId = useStudioStore((s) => s.counterfactualObsId);
  const runCounterfactual = useStudioStore((s) => s.runCounterfactual);
  const clearCounterfactual = useStudioStore((s) => s.clearCounterfactual);

  const obs = scene.obstructions.find((entry) => entry.id === selectedId);
  if (!obs) return null;

  const isRunningForThis = counterfactualObsId === obs.id;
  const delta = isRunningForThis && simulationResult && counterfactualResult ? {
    coverage: counterfactualResult.totalCoveragePct - simulationResult.totalCoveragePct,
    blindspot: simulationResult.blindspotPct - counterfactualResult.blindspotPct,
    recognition: counterfactualResult.recognitionAreaPct - simulationResult.recognitionAreaPct,
    zoneFlips: counterfactualResult.criticalZoneResults.filter((czr) => {
      const baseline = simulationResult.criticalZoneResults.find((b) => b.zoneId === czr.zoneId);
      return baseline && baseline.status !== "pass" && czr.status === "pass";
    }),
  } : null;

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

        <SectionCard title="Type">
          <SelectInput
            label="Subtype"
            value={obs.obstructionType}
            options={[...OBSTRUCTION_TYPE_OPTIONS]}
            onChange={(value) => {
              const config =
                OBSTRUCTION_TYPE_CONFIG[value as ObstructionNode["obstructionType"]] ?? OBSTRUCTION_TYPE_CONFIG.other!;
              updateNode(obs.id, {
                obstructionType: value as ObstructionNode["obstructionType"],
                label: config.label,
                dimensions: config.dimensions,
                material: config.material,
                visionTransmission: config.visionTransmission,
              });
            }}
          />
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

      <div className="border-t border-[#1e2130] px-3 py-3 space-y-2">
        <button
          type="button"
          onClick={() => isRunningForThis ? clearCounterfactual() : runCounterfactual(obs.id)}
          disabled={!simulationResult}
          className="flex h-8 w-full items-center justify-center gap-1.5 rounded-lg border border-blue-600/30 bg-blue-600/10 text-[10px] font-medium text-blue-300 transition-colors hover:bg-blue-600/20 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {isRunningForThis ? "Clear Test" : "Test Without This Obstruction"}
        </button>

        {delta && (
          <div className="rounded-lg border border-[#1e2130] bg-[#0a0d15] p-2.5 space-y-1.5">
            <div className="text-[9px] font-semibold uppercase tracking-widest text-[#3a4158] mb-2">
              If removed — delta vs current
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              <div className="flex flex-col items-center rounded bg-[#0d1017] p-1.5">
                <span className={`text-[13px] font-bold ${delta.coverage >= 0 ? "text-green-400" : "text-red-400"}`}>
                  {delta.coverage > 0 ? "+" : ""}{delta.coverage.toFixed(1)}%
                </span>
                <span className="text-[8px] text-[#4a5568] mt-0.5">coverage</span>
              </div>
              <div className="flex flex-col items-center rounded bg-[#0d1017] p-1.5">
                <span className={`text-[13px] font-bold ${delta.blindspot >= 0 ? "text-green-400" : "text-red-400"}`}>
                  {delta.blindspot > 0 ? "-" : "+"}{Math.abs(delta.blindspot).toFixed(1)}%
                </span>
                <span className="text-[8px] text-[#4a5568] mt-0.5">blindspot</span>
              </div>
              <div className="flex flex-col items-center rounded bg-[#0d1017] p-1.5">
                <span className={`text-[13px] font-bold ${delta.recognition >= 0 ? "text-green-400" : "text-red-400"}`}>
                  {delta.recognition > 0 ? "+" : ""}{delta.recognition.toFixed(1)}%
                </span>
                <span className="text-[8px] text-[#4a5568] mt-0.5">recognition</span>
              </div>
            </div>
            {delta.zoneFlips.length > 0 && (
              <div className="mt-1.5">
                {delta.zoneFlips.map((z) => (
                  <div key={z.zoneId} className="flex items-center gap-1.5 text-[9px]">
                    <span className="text-red-400">✗ FAIL</span>
                    <span className="text-[#4a5568]">→</span>
                    <span className="text-green-400">✓ PASS</span>
                    <span className="text-[#8090a8]">{z.label ?? z.zoneId}</span>
                  </div>
                ))}
              </div>
            )}
            {delta.zoneFlips.length === 0 && delta.coverage < 0.5 && delta.blindspot < 0.5 && (
              <div className="text-[9px] text-[#4a5568] text-center pt-1">
                Minimal impact — obstruction may not be blocking critical sightlines
              </div>
            )}
          </div>
        )}
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

function WallInspector() {
  const selectedId = useStudioStore((s) => s.selectedNodeId);
  const scene = useStudioStore((s) => s.scene);
  const updateNode = useStudioStore((s) => s.updateNode);
  const removeNode = useStudioStore((s) => s.removeNode);
  const wall = scene.walls.find((entry) => entry.id === selectedId);
  if (!wall) return null;

  const lengthM = Math.hypot(wall.end[0] - wall.start[0], wall.end[1] - wall.start[1]);

  return (
    <>
      <div className="border-b border-[#1e2130] px-3 py-3">
        <div className="text-[12px] font-semibold text-white">{wall.label}</div>
        <div className="text-[9px] uppercase tracking-[0.18em] text-[#556076]">Wall · {lengthM.toFixed(2)}m</div>
      </div>
      <div className="flex-1 space-y-2.5 overflow-y-auto px-3 py-3">
        <SectionCard title="Endpoints">
          <div className="grid grid-cols-2 gap-2">
            <NumberInput label="Start X" value={wall.start[0]} step={0.1} unit="m" onChange={(value) => updateNode(wall.id, { start: [value, wall.start[1]] })} />
            <NumberInput label="Start Z" value={wall.start[1]} step={0.1} unit="m" onChange={(value) => updateNode(wall.id, { start: [wall.start[0], value] })} />
            <NumberInput label="End X" value={wall.end[0]} step={0.1} unit="m" onChange={(value) => updateNode(wall.id, { end: [value, wall.end[1]] })} />
            <NumberInput label="End Z" value={wall.end[1]} step={0.1} unit="m" onChange={(value) => updateNode(wall.id, { end: [wall.end[0], value] })} />
          </div>
        </SectionCard>
        <SectionCard title="Material">
          <SelectInput
            label="Material"
            value={wall.material}
            options={[
              { value: "solid", label: "Solid" },
              { value: "glass", label: "Glass" },
              { value: "grill", label: "Grill" },
              { value: "partial", label: "Partial" },
            ]}
            onChange={(value) => updateNode(wall.id, { material: value as WallNode["material"] })}
          />
          <NumberInput label="Height" value={wall.heightM} min={1.2} step={0.1} unit="m" onChange={(value) => updateNode(wall.id, { heightM: value })} />
          <NumberInput label="Thickness" value={wall.thicknessM} min={0.05} step={0.01} unit="m" onChange={(value) => updateNode(wall.id, { thicknessM: value })} />
          <NumberInput label="Transmission" value={wall.visionTransmission} min={0} max={1} step={0.05} onChange={(value) => updateNode(wall.id, { visionTransmission: value })} />
        </SectionCard>
      </div>
      <div className="border-t border-[#1e2130] px-3 py-3">
        <button type="button" onClick={() => removeNode(wall.id)} className="flex h-8 w-full items-center justify-center gap-1.5 rounded-lg border border-red-900/30 bg-red-950/15 text-[10px] font-medium text-red-400 transition-colors hover:border-red-700 hover:bg-red-950/30">
          <Trash2 className="h-3 w-3" />
          Delete Wall
        </button>
      </div>
    </>
  );
}

function DoorWindowInspector({ node }: { node: DoorNode | WindowNode }) {
  const updateNode = useStudioStore((s) => s.updateNode);
  const removeNode = useStudioStore((s) => s.removeNode);
  const isWindow = node.nodeType === "window";
  const stateOptions = isWindow
    ? [
        { value: "closed_glass", label: "Closed Glass" },
        { value: "open", label: "Open" },
        { value: "grill", label: "Grill" },
        { value: "curtain", label: "Curtain" },
        { value: "reflective", label: "Reflective" },
      ]
    : [
        { value: "closed", label: "Closed" },
        { value: "open", label: "Open" },
        { value: "locked", label: "Locked" },
        { value: "restricted", label: "Restricted" },
      ];

  return (
    <>
      <div className="border-b border-[#1e2130] px-3 py-3">
        <div className="text-[12px] font-semibold text-white">{node.label}</div>
        <div className="text-[9px] uppercase tracking-[0.18em] text-[#556076]">{isWindow ? "Window" : "Door"}</div>
      </div>
      <div className="flex-1 space-y-2.5 overflow-y-auto px-3 py-3">
        <SectionCard title="Position">
          <div className="grid grid-cols-3 gap-2">
            <NumberInput label="X" value={node.position[0]} step={0.1} unit="m" onChange={(value) => updateNode(node.id, { position: [value, node.position[1], node.position[2]] })} />
            <NumberInput label="Y" value={node.position[1]} step={0.1} unit="m" onChange={(value) => updateNode(node.id, { position: [node.position[0], value, node.position[2]] })} />
            <NumberInput label="Z" value={node.position[2]} step={0.1} unit="m" onChange={(value) => updateNode(node.id, { position: [node.position[0], node.position[1], value] })} />
          </div>
        </SectionCard>
        <SectionCard title="State">
          <SelectInput label="State" value={node.state} options={stateOptions} onChange={(value) => updateNode(node.id, { state: value as DoorNode["state"] | WindowNode["state"] })} />
          {isWindow ? <NumberInput label="Transmission" value={node.visionTransmission} min={0} max={1} step={0.05} onChange={(value) => updateNode(node.id, { visionTransmission: value })} /> : null}
          <div className="grid grid-cols-3 gap-2">
            <NumberInput label="W" value={node.dimensions[0]} min={0.1} step={0.05} unit="m" onChange={(value) => updateNode(node.id, { dimensions: [value, node.dimensions[1], node.dimensions[2]] })} />
            <NumberInput label="H" value={node.dimensions[1]} min={0.1} step={0.05} unit="m" onChange={(value) => updateNode(node.id, { dimensions: [node.dimensions[0], value, node.dimensions[2]] })} />
            <NumberInput label="D" value={node.dimensions[2]} min={0.01} step={0.01} unit="m" onChange={(value) => updateNode(node.id, { dimensions: [node.dimensions[0], node.dimensions[1], value] })} />
          </div>
        </SectionCard>
      </div>
      <div className="border-t border-[#1e2130] px-3 py-3">
        <button type="button" onClick={() => removeNode(node.id)} className="flex h-8 w-full items-center justify-center gap-1.5 rounded-lg border border-red-900/30 bg-red-950/15 text-[10px] font-medium text-red-400 transition-colors hover:border-red-700 hover:bg-red-950/30">
          <Trash2 className="h-3 w-3" />
          Delete {isWindow ? "Window" : "Door"}
        </button>
      </div>
    </>
  );
}

function PathInspector() {
  const selectedId = useStudioStore((s) => s.selectedNodeId);
  const scene = useStudioStore((s) => s.scene);
  const updateNode = useStudioStore((s) => s.updateNode);
  const removeNode = useStudioStore((s) => s.removeNode);
  const path = scene.paths.find((entry) => entry.id === selectedId);
  if (!path) return null;

  const lengthM = pathLength(path.points.map((point) => point.position));
  const estimatedTimeS = lengthM / Math.max(0.1, path.speedMps);

  return (
    <>
      <div className="border-b border-[#1e2130] px-3 py-3">
        <div className="text-[12px] font-semibold text-white">{path.label}</div>
        <div className="text-[9px] uppercase tracking-[0.18em] text-[#556076]">Path · {lengthM.toFixed(2)}m · {estimatedTimeS.toFixed(1)}s</div>
      </div>
      <div className="flex-1 space-y-2.5 overflow-y-auto px-3 py-3">
        <SectionCard title="Actor">
          <SelectInput
            label="Actor Type"
            value={path.actorType}
            options={[
              { value: "person", label: "Person" },
              { value: "vehicle", label: "Vehicle" },
              { value: "guard", label: "Guard" },
              { value: "crowd", label: "Crowd" },
            ]}
            onChange={(value) => updateNode(path.id, { actorType: value as ScenarioPath["actorType"] })}
          />
          <NumberInput label="Speed" value={path.speedMps} min={0.1} step={0.1} unit="m/s" onChange={(value) => updateNode(path.id, { speedMps: value })} />
          <SelectInput
            label="Time"
            value={path.timeOfDay}
            options={[
              { value: "day", label: "Day" },
              { value: "night", label: "Night" },
              { value: "dusk", label: "Dusk" },
              { value: "dawn", label: "Dawn" },
            ]}
            onChange={(value) => updateNode(path.id, { timeOfDay: value as ScenarioPath["timeOfDay"] })}
          />
          <SelectInput
            label="Intent"
            value={path.intent}
            options={[
              { value: "authorized", label: "Authorized" },
              { value: "suspicious", label: "Unverified / Investigative" },
              { value: "incident_replay", label: "Incident Replay" },
            ]}
            onChange={(value) => updateNode(path.id, { intent: value as ScenarioPath["intent"] })}
          />
        </SectionCard>
        <SectionCard title="Metrics">
          <Field label="Length" value={lengthM.toFixed(2)} unit="m" />
          <Field label="Est. Time" value={estimatedTimeS.toFixed(1)} unit="s" />
          <Field label="Points" value={path.points.length} />
        </SectionCard>
      </div>
      <div className="border-t border-[#1e2130] px-3 py-3">
        <button type="button" onClick={() => removeNode(path.id)} className="flex h-8 w-full items-center justify-center gap-1.5 rounded-lg border border-red-900/30 bg-red-950/15 text-[10px] font-medium text-red-400 transition-colors hover:border-red-700 hover:bg-red-950/30">
          <Trash2 className="h-3 w-3" />
          Delete Path
        </button>
      </div>
    </>
  );
}

function PrivacyZoneInspector() {
  const selectedId = useStudioStore((s) => s.selectedNodeId);
  const scene = useStudioStore((s) => s.scene);
  const updateNode = useStudioStore((s) => s.updateNode);
  const removeNode = useStudioStore((s) => s.removeNode);
  const zone = scene.privacyZones.find((entry) => entry.id === selectedId);
  if (!zone) return null;

  return (
    <>
      <div className="border-b border-[#1e2130] px-3 py-3">
        <div className="text-[12px] font-semibold text-white">{zone.label}</div>
        <div className="text-[9px] uppercase tracking-[0.18em] text-[#556076]">Privacy Zone</div>
      </div>
      <div className="flex-1 space-y-2.5 overflow-y-auto px-3 py-3">
        <SectionCard title="Properties">
          <SelectInput
            label="Restriction"
            value={zone.restriction}
            options={[
              { value: "no_video", label: "No Video" },
              { value: "restricted_view", label: "Restricted View" },
              { value: "blindspot_required", label: "Blindspot Required" },
            ]}
            onChange={(value) => updateNode(zone.id, { restriction: value as PrivacyZoneNode["restriction"] })}
          />
          <Field label="Vertices" value={zone.polygon.length} />
          <label className="block rounded-lg border border-[#1f2536] bg-[#111521] px-2 py-1.5">
            <div className="mb-1 flex items-center justify-between gap-2">
              <span className="text-[8px] uppercase tracking-[0.16em] text-[#556076]">Regulation</span>
            </div>
            <input
              type="text"
              value={zone.regulation}
              onChange={(event) => updateNode(zone.id, { regulation: event.target.value })}
              className="w-full bg-transparent text-right font-mono text-[11px] text-[#d2d9e8] outline-none"
              placeholder="manual"
            />
          </label>
        </SectionCard>
      </div>
      <div className="border-t border-[#1e2130] px-3 py-3">
        <button type="button" onClick={() => removeNode(zone.id)} className="flex h-8 w-full items-center justify-center gap-1.5 rounded-lg border border-red-900/30 bg-red-950/15 text-[10px] font-medium text-red-400 transition-colors hover:border-red-700 hover:bg-red-950/30">
          <Trash2 className="h-3 w-3" />
          Delete Privacy Zone
        </button>
      </div>
    </>
  );
}

function EntryPointInspector() {
  const selectedId = useStudioStore((s) => s.selectedNodeId);
  const scene = useStudioStore((s) => s.scene);
  const updateNode = useStudioStore((s) => s.updateNode);
  const removeNode = useStudioStore((s) => s.removeNode);
  const entryPoint = scene.entryPoints.find((entry) => entry.id === selectedId);
  if (!entryPoint) return null;

  return (
    <>
      <div className="border-b border-[#1e2130] px-3 py-3">
        <div className="text-[12px] font-semibold text-white">{entryPoint.label}</div>
        <div className="text-[9px] uppercase tracking-[0.18em] text-[#556076]">Entry Point</div>
      </div>
      <div className="flex-1 space-y-2.5 overflow-y-auto px-3 py-3">
        <SectionCard title="Position">
          <div className="grid grid-cols-2 gap-2">
            <NumberInput label="X" value={entryPoint.position[0]} step={0.1} unit="m" onChange={(value) => updateNode(entryPoint.id, { position: [value, entryPoint.position[1]] })} />
            <NumberInput label="Z" value={entryPoint.position[1]} step={0.1} unit="m" onChange={(value) => updateNode(entryPoint.id, { position: [entryPoint.position[0], value] })} />
          </div>
        </SectionCard>
      </div>
      <div className="border-t border-[#1e2130] px-3 py-3">
        <button type="button" onClick={() => removeNode(entryPoint.id)} className="flex h-8 w-full items-center justify-center gap-1.5 rounded-lg border border-red-900/30 bg-red-950/15 text-[10px] font-medium text-red-400 transition-colors hover:border-red-700 hover:bg-red-950/30">
          <Trash2 className="h-3 w-3" />
          Delete Entry Point
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
        <div className="mt-1 text-[9px] leading-relaxed text-[#556076]">Click any camera, wall, door, window, zone, path, light, or obstruction in the canvas to inspect it.</div>
      </div>
    </div>
  );
}

export function InspectorPanel() {
  const selectedId = useStudioStore((s) => s.selectedNodeId);
  const scene = useStudioStore((s) => s.scene);
  const camera = scene.cameras.find((entry) => entry.id === selectedId);
  const wall = scene.walls.find((entry) => entry.id === selectedId);
  const door = scene.doors.find((entry) => entry.id === selectedId);
  const windowNode = scene.windows.find((entry) => entry.id === selectedId);
  const obstruction = scene.obstructions.find((entry) => entry.id === selectedId);
  const light = scene.securityLights.find((entry) => entry.id === selectedId);
  const zone = scene.criticalZones.find((entry) => entry.id === selectedId);
  const privacyZone = scene.privacyZones.find((entry) => entry.id === selectedId);
  const path = scene.paths.find((entry) => entry.id === selectedId);
  const entryPoint = scene.entryPoints.find((entry) => entry.id === selectedId);

  return (
    <aside className="flex w-[304px] flex-shrink-0 flex-col overflow-hidden border-l border-[#1e2130] bg-[#0d1017]">
      <div className="flex h-8 items-center border-b border-[#1e2130] px-3 text-[9px] font-semibold uppercase tracking-[0.22em] text-[#4a5568]">
        Inspector
      </div>
      {camera
        ? <CameraInspector />
        : wall
        ? <WallInspector />
        : door
        ? <DoorWindowInspector node={door} />
        : windowNode
        ? <DoorWindowInspector node={windowNode} />
        : zone
        ? <CriticalZoneInspector />
        : privacyZone
        ? <PrivacyZoneInspector />
        : path
        ? <PathInspector />
        : obstruction
        ? <ObstructionInspector />
        : light
        ? <LightInspector />
        : entryPoint
        ? <EntryPointInspector />
        : <NoSelection />}
    </aside>
  );
}
