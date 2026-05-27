"use client";

import { Camera, Copy, Crosshair, Eye, Trash2 } from "lucide-react";
import { useState } from "react";

import { CameraFeedCanvas } from "@/components/inspector/CameraFeedCanvas";
import {
  Field,
  NumberInput,
  PropSelect,
  SelectInput,
  SummaryStat,
  ToggleField,
} from "@/components/inspector/inspector-controls";
import { Badge } from "@/components/shared/Badge";
import { SectionCard } from "@/components/shared/SectionCard";
import { cn } from "@/lib/cn";
import type { CameraNode, DoriQuality, SimulationAssumptions } from "@/schema/security-scene";
import { type InspectorTab, useStudioStore } from "@/store/studio-store";

// ── Constants ────────────────────────────────────────────────────────────────

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

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Compute DORI effective ranges in metres for a camera, using the scene's PPM thresholds. */
function computeDoriRanges(camera: CameraNode, scenePpm: SimulationAssumptions["pixelsPerMeter"]) {
  const resW = camera.resolutionWidth ?? (camera.resolutionMP >= 8 ? 3840 : camera.resolutionMP >= 4 ? 2688 : 1920);
  const tanHalfFov = Math.tan((camera.fovHorizontalDeg / 2) * (Math.PI / 180));
  const cap = camera.rangeM;
  const det   = Math.min(resW / (2 * scenePpm.detection      * tanHalfFov), cap);
  const obs   = Math.min(resW / (2 * scenePpm.observation    * tanHalfFov), cap);
  const recog = Math.min(resW / (2 * scenePpm.recognition    * tanHalfFov), cap);
  const ident = Math.min(resW / (2 * scenePpm.identification * tanHalfFov), cap);
  return { det, obs, recog, ident };
}

// ── Component ────────────────────────────────────────────────────────────────

export function CameraInspector() {
  const camera = useStudioStore((s) => s.getSelectedCamera());
  const scene = useStudioStore((s) => s.scene);
  const inspectorTab = useStudioStore((s) => s.inspectorTab);
  const setTab = useStudioStore((s) => s.setInspectorTab);
  const result = useStudioStore((s) => s.simulationResult);
  const updateNode = useStudioStore((s) => s.updateNode);
  const removeNode = useStudioStore((s) => s.removeNode);
  const duplicateNode = useStudioStore((s) => s.duplicateNode);
  const selectNode = useStudioStore((s) => s.selectNode);
  const addSnapshot = useStudioStore((s) => s.addSnapshot);
  const setWorkspacePreset = useStudioStore((s) => s.setWorkspacePreset);
  const setViewMode = useStudioStore((s) => s.setViewMode);
  const [viewMode, setViewModeState] = useState<CameraViewMode>("normal");
  const [viewToggles, setViewToggles] = useState<ViewToggleState>({
    overlays: true, dori: true, path: false, zones: true, timestamp: true, grid: false,
  });
  const [snapshotNote, setSnapshotNote] = useState("");

  if (!camera) return null;

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
  const resolutionKey = `${camera.resolutionMP}_${camera.resolutionWidth ?? 2688}x${camera.resolutionHeight ?? 1520}`;
  const typeKey = camera.mountType === "ceiling" ? `${camera.resolutionMP}mp_dome` : `${camera.resolutionMP}mp_bullet`;

  const updatePosition = (next: [number, number, number]) => updateNode(camera.id, { position: next });

  const updateHeight = (nextHeight: number) => {
    updateNode(camera.id, {
      mountHeightM: nextHeight,
      position: [camera.position[0], nextHeight, camera.position[2]] as [number, number, number],
    });
  };

  const aimAtZone = () => {
    if (!firstCriticalZone) return;
    const centroid = firstCriticalZone.polygon.reduce(
      (acc, [x, z]) => { acc.x += x; acc.z += z; return acc; },
      { x: 0, z: 0 },
    );
    const n = firstCriticalZone.polygon.length || 1;
    const dx = centroid.x / n - camera.position[0];
    const dz = centroid.z / n - camera.position[2];
    updateNode(camera.id, { yawDeg: Math.round(Math.atan2(dx, dz) * (180 / Math.PI)), pitchDeg: -30 });
  };

  const saveInspectionSnapshot = () => {
    const stamp = new Date().toISOString().replace("T", " ").slice(0, 19);
    const label = snapshotNote.trim().length > 0
      ? `${snapshotNote.trim()} (${stamp})`
      : `View snapshot ${stamp}`;
    addSnapshot(label, result ?? scene.simulation!);
    setSnapshotNote("");
  };

  const setViewToggle = (key: ViewToggleKey) => {
    setViewToggles((current) => ({ ...current, [key]: !current[key] }));
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
            <div className="mb-2.5">
              <CameraFeedCanvas cameraId={camera.id} />
            </div>

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

            <PropSelect
              label="Mount"
              value={camera.mountType}
              options={MOUNT_OPTIONS}
              onChange={(v) => updateNode(camera.id, { mountType: v as CameraNode["mountType"] })}
            />

            <div className="border-b border-[#181c27] py-1.5">
              <div className="mb-1.5 text-[10px] text-[#6a748b]">Position (m)</div>
              <div className="grid grid-cols-3 gap-1.5">
                <NumberInput label="X" value={camera.position[0]} step={0.1} unit="m" onChange={(value) => updatePosition([value, camera.position[1], camera.position[2]])} />
                <NumberInput label="Y" value={camera.position[1]} min={0.5} max={4} step={0.1} unit="m" onChange={updateHeight} />
                <NumberInput label="Z" value={camera.position[2]} step={0.1} unit="m" onChange={(value) => updatePosition([camera.position[0], camera.position[1], value])} />
              </div>
            </div>

            <div className="border-b border-[#181c27] py-1.5">
              <div className="mb-1.5 text-[10px] text-[#6a748b]">Rotation (°)</div>
              <div className="grid grid-cols-3 gap-1.5">
                <NumberInput label="Yaw"   value={camera.yawDeg}   min={-180} max={180} step={1} unit="°" onChange={(value) => updateNode(camera.id, { yawDeg: value })} />
                <NumberInput label="Pitch" value={camera.pitchDeg} min={-90}  max={0}   step={1} unit="°" onChange={(value) => updateNode(camera.id, { pitchDeg: value })} />
                <NumberInput label="Roll"  value={camera.rollDeg}  min={-180} max={180} step={1} unit="°" onChange={(value) => updateNode(camera.id, { rollDeg: value })} />
              </div>
            </div>

            <div className="border-b border-[#181c27] py-1.5">
              <div className="mb-1.5 flex items-center justify-between gap-3">
                <span className="text-[10px] text-[#6a748b]">FOV (Horizontal)</span>
                <span className="font-mono text-[11px] text-[#d2d9e8]">{camera.fovHorizontalDeg}°</span>
              </div>
              <input
                type="range" min={30} max={180} step={1}
                value={camera.fovHorizontalDeg}
                onChange={(e) => updateNode(camera.id, { fovHorizontalDeg: Number(e.target.value) })}
                className="w-full accent-blue-400"
              />
            </div>

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

            <PropSelect
              label="Lens"
              value={String(camera.focalLengthMm ?? 2.8)}
              options={LENS_OPTIONS}
              onChange={(v) => updateNode(camera.id, { focalLengthMm: parseFloat(v) })}
            />

            <div className="border-b border-[#181c27] py-1.5">
              <div className="mb-1.5 text-[10px] text-[#6a748b]">Height</div>
              <NumberInput label="Height" value={camera.mountHeightM} min={0.5} max={4} step={0.1} unit="m" onChange={updateHeight} />
            </div>

            <PropSelect
              label="Night Mode"
              value={camera.nightMode === "low_light" ? "low_light" : camera.nightMode}
              options={CAMERA_STATUS_OPTIONS}
              onChange={(v) => updateNode(camera.id, { nightMode: v as CameraNode["nightMode"] })}
            />

            <PropSelect
              label="Image Clarity"
              value={camera.clarity}
              options={CLARITY_OPTIONS}
              onChange={(v) => updateNode(camera.id, { clarity: v as CameraNode["clarity"] })}
            />

            <Field label="IR Range" value={camera.irRangeM > 0 ? camera.irRangeM : "None"} unit={camera.irRangeM > 0 ? "m" : undefined} />
            <Field label="PTZ" value={camera.ptz ? "Yes" : "No"} />
            <Field label="Thermal" value={camera.thermalCapable ? "Yes" : "No"} />

            {(() => {
              const dori = computeDoriRanges(camera, scene.assumptions.pixelsPerMeter);
              return (
                <div className="mt-2.5 rounded-xl border border-[#1f2536] bg-[#0b0f17] p-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.02)]">
                  <div className="mb-2 text-[9px] font-semibold uppercase tracking-[0.2em] text-[#4a5568]">DORI</div>
                  <div className="space-y-1">
                    {([
                      { label: "Detect", value: dori.det,   color: "text-orange-300" },
                      { label: "Recog",  value: dori.recog, color: "text-yellow-300" },
                      { label: "Ident",  value: dori.ident, color: "text-emerald-300" },
                    ] as const).map(({ label, value, color }) => (
                      <div key={label} className="flex items-center justify-between gap-2">
                        <span className="text-[10px] text-[#6a748b]">{label}</span>
                        <div className="flex items-center gap-1">
                          <span className={`font-mono text-[11px] font-semibold ${color}`}>{value.toFixed(1)}</span>
                          <span className="text-[8px] text-[#556076]">m</span>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-2 flex items-center justify-between border-t border-[#1f2536] pt-2">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[9px] text-[#6a748b]">Target</span>
                      <span className="rounded bg-[#131a28] px-1.5 py-0.5 text-[9px] font-medium text-[#c7d0e4]">Face</span>
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

            {(() => {
              const recs = result?.recommendations.filter((r) =>
                !r.affectedNodeId || r.affectedNodeId === camera.id,
              ) ?? [];
              if (recs.length === 0) return null;
              const COST_COLOR: Record<string, string> = {
                free: "text-green-300", low: "text-emerald-300", medium: "text-yellow-300", high: "text-red-300",
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
                          {rec.estimatedImpact && <div className="mt-0.5 text-[8px] text-[#5a6478]">{rec.estimatedImpact}</div>}
                        </div>
                        {rec.verified && <span className="ml-auto flex-shrink-0 rounded bg-green-900/30 px-1 py-0.5 text-[7px] font-semibold text-green-400">✓</span>}
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
                <SummaryStat label="Coverage"   value={camResult ? `${camResult.coveragePct.toFixed(1)}%` : "--"} accent="text-emerald-300" />
                <SummaryStat label="Zones Pass" value={camResult ? `${camResult.criticalZonesCovered.length}` : "--"} accent="text-blue-300" />
                <SummaryStat label="Zones Fail" value={camResult ? `${camResult.criticalZonesFailed.length}` : "--"} accent="text-amber-300" />
              </div>
            </SectionCard>
            <SectionCard title="Verified Notes">
              {offlineImpact.length > 0 ? (
                <div className="space-y-2">
                  {offlineImpact.map((message, index) => (
                    <div key={index} className="rounded-lg border border-amber-500/20 bg-amber-500/8 px-2 py-2 text-[10px] text-amber-200">{message}</div>
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
                trueLabel="On" falseLabel="Off"
                onChange={(value) => updateNode(camera.id, { status: value ? "on" : "off" })}
              />
              <SelectInput label="Night Mode" value={camera.nightMode === "low_light" ? "low_light" : camera.nightMode} options={[...CAMERA_STATUS_OPTIONS]} onChange={(value) => updateNode(camera.id, { nightMode: value as CameraNode["nightMode"] })} />
              <SelectInput label="Image Clarity" value={camera.clarity} options={[...CLARITY_OPTIONS]} onChange={(value) => updateNode(camera.id, { clarity: value as CameraNode["clarity"] })} />
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
                    <span className={cn("mr-1.5 inline-block h-1.5 w-1.5 rounded-full", viewToggles[toggle.key] ? "bg-cyan-300" : "bg-[#5b657a]")} />
                    {toggle.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              <SectionCard title="View Metrics">
                <div className="space-y-1">
                  <Field label="Camera"     value={camera.name} />
                  <Field label="Status"     value={camera.status === "on" ? "Online" : "Offline"} />
                  <Field label="Mode"       value={viewMode === "normal" ? "Normal" : viewMode === "ir" ? "IR (B/W)" : viewMode === "low_light" ? "Low Light" : "Thermal"} />
                  <Field label="FOV"        value={`${camera.fovHorizontalDeg}°`} />
                  <Field label="Resolution" value={`${camera.resolutionMP}MP`} />
                  <Field label="Range"      value={`${camera.rangeM}m`} />
                  {camResult ? <Field label="Coverage"              value={`${camResult.coveragePct.toFixed(1)}%`} /> : null}
                  {camResult ? <Field label="Critical zones passed" value={camResult.criticalZonesCovered.length} /> : null}
                  {camResult ? <Field label="Critical zones failed" value={camResult.criticalZonesFailed.length} /> : null}
                </div>
              </SectionCard>

              <SectionCard title="DORI Profile">
                {(() => {
                  const ranges = computeDoriRanges(camera, scene.assumptions.pixelsPerMeter);
                  const sortedZoneEntries = (Object.entries(camResult?.qualityByZone ?? {}) as [string, DoriQuality][])
                    .map(([zoneId, quality]) => ({
                      name: scene.criticalZones.find((entry) => entry.id === zoneId)?.label ?? zoneId,
                      quality,
                    }))
                    .filter((entry) => entry.quality !== undefined);
                  const doriRows = [
                    ["identification", ranges.ident, "#60a5fa"],
                    ["recognition",    ranges.recog, "#22c55e"],
                    ["observation",    ranges.obs,   "#eab308"],
                    ["detection",      ranges.det,   "#f97316"],
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
                  type="button" onClick={saveInspectionSnapshot}
                  disabled={!result && !scene.simulation}
                  className="rounded-lg border border-emerald-600/50 bg-emerald-700/10 px-2 py-1.5 text-[9px] font-medium text-emerald-200 transition-colors disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Take Snapshot
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={openInCameraWall} className="rounded-lg border border-[#24283a] bg-[#111521] px-2 py-2 text-[10px] font-medium text-[#c7d0e4] transition-colors hover:border-[#32384d] hover:text-white">
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
          const coveragePct = camResult?.coveragePct ?? 0;
          const zonesCovered = camResult?.criticalZonesCovered ?? [];
          const otherResults = (result?.cameraResults ?? []).filter((r) => r.cameraId !== camera.id);
          const nonRedundantZones = zonesCovered.filter(
            (zoneId) => !otherResults.some((o) => o.criticalZonesCovered.includes(zoneId))
          );
          const critScore = Math.min(10, Math.round((coveragePct / 12) + nonRedundantZones.length * 2));
          const critLabel = critScore >= 8 ? "Critical" : critScore >= 5 ? "Important" : "Redundant";
          const critColor = critScore >= 8 ? "text-red-400" : critScore >= 5 ? "text-amber-400" : "text-green-400";
          const critBorderColor = critScore >= 8 ? "#f87171" : critScore >= 5 ? "#fbbf24" : "#4ade80";
          const pathSegmentCount = (result?.pathResults ?? []).flatMap((pr) =>
            pr.timeline.filter((t) => t.cameraId === camera.id)
          ).length;
          const isOffline = camera.status !== "on";
          const isDirty = camera.clarity === "poor";
          const isNightDisabled = camera.nightMode === "none";
          const isSimulatingFailure = isOffline || isDirty || isNightDisabled;

          return (
            <div className="space-y-2.5">
              {camResult && (
                <div className="rounded-xl border border-[#1f2536] bg-[#0b0f17] p-2.5">
                  <div className="mb-2 text-[9px] font-semibold uppercase tracking-[0.2em] text-[#4a5568]">Camera Criticality</div>
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full border-2" style={{ borderColor: critBorderColor }}>
                      <span className={`text-[15px] font-bold ${critColor}`}>{critScore}</span>
                    </div>
                    <div>
                      <div className={`text-[12px] font-semibold ${critColor}`}>{critLabel}</div>
                      <div className="mt-0.5 text-[9px] text-[#4a5568]">
                        {coveragePct.toFixed(1)}% scene · {nonRedundantZones.length} sole-coverage zone{nonRedundantZones.length !== 1 ? "s" : ""}
                      </div>
                    </div>
                    <div className="ml-auto text-right">
                      <div className="font-mono text-[13px] font-bold text-[#c7d0e4]">{pathSegmentCount}</div>
                      <div className="text-[8px] text-[#4a5568]">path events</div>
                    </div>
                  </div>
                </div>
              )}

              <div className="rounded-xl border border-[#1f2536] bg-[#0b0f17] p-2.5">
                <div className="mb-2 text-[9px] font-semibold uppercase tracking-[0.2em] text-[#4a5568]">Simulate Failure</div>
                <div className="space-y-2">
                  {[
                    { label: "Camera Offline",       sub: "Power cut / network loss",      isActive: isOffline,       onToggle: () => updateNode(camera.id, { status: isOffline ? "on" : "off" }), activeColor: "bg-red-500/60" },
                    { label: "Dirty / Blocked Lens", sub: "Spray paint, grease, mud",       isActive: isDirty,         onToggle: () => updateNode(camera.id, { clarity: isDirty ? "good" : "poor" }), activeColor: "bg-amber-500/60" },
                    { label: "Night Vision Disabled", sub: "IR cut / low-light mode off",   isActive: isNightDisabled, onToggle: () => updateNode(camera.id, { nightMode: isNightDisabled ? "ir" : "none" }), activeColor: "bg-amber-500/60" },
                  ].map(({ label, sub, isActive, onToggle, activeColor }) => (
                    <div key={label} className="flex items-center justify-between gap-2">
                      <div>
                        <div className="text-[10px] text-[#c7d0e4]">{label}</div>
                        <div className="text-[8px] text-[#4a5568]">{sub}</div>
                      </div>
                      <button
                        type="button" onClick={onToggle}
                        className={cn("flex h-5 w-9 flex-shrink-0 items-center rounded-full px-0.5 transition-colors", isActive ? activeColor : "bg-[#2a3246]")}
                      >
                        <span className={cn("block h-4 w-4 rounded-full bg-white shadow transition-transform", isActive ? "translate-x-4" : "translate-x-0")} />
                      </button>
                    </div>
                  ))}
                </div>
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
                {!isSimulatingFailure && <div className="mt-2.5 text-[8px] text-[#3a4158]">Toggle failures above, then re-run simulation to compute impact.</div>}
              </div>

              {zonesCovered.length > 0 && (
                <div className="rounded-xl border border-[#1f2536] bg-[#0b0f17] p-2.5">
                  <div className="mb-2 text-[9px] font-semibold uppercase tracking-[0.2em] text-[#4a5568]">Zone Coverage ({zonesCovered.length})</div>
                  <div className="space-y-1">
                    {zonesCovered.map((zoneId) => {
                      const hasBackup = otherResults.some((o) => o.criticalZonesCovered.includes(zoneId));
                      const zoneName = scene.criticalZones.find((z) => z.id === zoneId)?.label ?? zoneId;
                      return (
                        <div key={zoneId} className="flex items-center justify-between gap-2">
                          <span className="truncate text-[10px] text-[#8090a8]">{zoneName}</span>
                          <span className={cn("flex-shrink-0 rounded px-1.5 py-0.5 text-[7px] font-semibold", hasBackup ? "bg-green-900/30 text-green-400" : "bg-red-900/30 text-red-400")}>
                            {hasBackup ? "Redundant" : "No Backup"}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {pathSegmentCount > 0 && (
                <div className="rounded-xl border border-[#1f2536] bg-[#0b0f17] p-2.5">
                  <div className="mb-1 text-[9px] font-semibold uppercase tracking-[0.2em] text-[#4a5568]">Adversarial Path Exposure</div>
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-[17px] font-bold text-orange-300">{pathSegmentCount}</span>
                    <span className="text-[9px] text-[#4a5568]">detection event{pathSegmentCount !== 1 ? "s" : ""} rely on this camera</span>
                  </div>
                  <div className="mt-1 text-[8px] text-[#3a4158]">If offline, {pathSegmentCount} path detection{pathSegmentCount !== 1 ? "s" : ""} would be lost.</div>
                </div>
              )}

              {offlineImpact.length > 0 && (
                <div className="rounded-xl border border-[#1f2536] bg-[#0b0f17] p-2.5">
                  <div className="mb-2 text-[9px] font-semibold uppercase tracking-[0.2em] text-[#4a5568]">Impact Notes</div>
                  <div className="space-y-1.5">
                    {offlineImpact.map((message, index) => (
                      <div key={index} className="rounded-lg border border-amber-500/20 bg-amber-500/8 px-2 py-1.5 text-[9px] text-amber-200">{message}</div>
                    ))}
                  </div>
                </div>
              )}

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
            type="button" onClick={aimAtZone} disabled={!firstCriticalZone}
            className="flex h-8 flex-1 items-center justify-center gap-1.5 rounded-lg border border-[#24283a] bg-[#111521] text-[10px] font-medium text-[#c7d0e4] transition-colors hover:border-[#32384d] hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Crosshair className="h-3 w-3" />
            Aim at Zone
          </button>
          <button
            type="button"
            onClick={() => { setTab("view"); const store = useStudioStore.getState(); store.setWorkspacePreset("coverage"); store.setViewMode("camera_view"); }}
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
            type="button" onClick={() => duplicateNode(camera.id)}
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
