"use client";

import { Clock, MapPin, Shield, Sun, Trash2, Users } from "lucide-react";
import { useState } from "react";

import { SectionCard } from "@/components/shared/SectionCard";
import { CrowdProfileEditor } from "@/components/inspector/CrowdProfileEditor";
import { EventConfigPanel } from "@/components/inspector/EventConfigPanel";
import type { OccupancyPeriod, PatrolSchedule, TimeSchedule } from "@/schema/security-scene";
import { useStudioStore } from "@/store/studio-store";

const OCCUPANCY_OPTIONS: Array<{ value: OccupancyPeriod["level"]; label: string; color: string }> = [
  { value: "empty",  label: "Empty",  color: "#4a5568" },
  { value: "low",    label: "Low",    color: "#60a5fa" },
  { value: "medium", label: "Medium", color: "#eab308" },
  { value: "high",   label: "High",   color: "#f97316" },
];

function HourSelect({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="flex flex-col gap-0.5">
      <span className="text-[8px] uppercase tracking-[0.16em] text-[#556076]">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="rounded border border-[#1f2536] bg-[#111521] px-2 py-1 font-mono text-[10px] text-[#d2d9e8] outline-none focus-visible:ring-2 focus-visible:ring-[#60a5fa]/50"
      >
        {Array.from({ length: 25 }, (_, h) => (
          <option key={h} value={h}>{h === 24 ? "24:00" : `${h.toString().padStart(2, "0")}:00`}</option>
        ))}
      </select>
    </label>
  );
}

function NumberField({
  label,
  value,
  unit,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  unit?: string;
  min?: number;
  max?: number;
  step?: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="flex flex-col gap-0.5">
      <span className="text-[8px] uppercase tracking-[0.16em] text-[#556076]">{label}</span>
      <div className="flex items-center gap-1">
        <input
          type="number"
          value={value}
          min={min}
          max={max}
          step={step ?? 1}
          onChange={(e) => onChange(Number(e.target.value))}
          className="w-full rounded border border-[#1f2536] bg-[#111521] px-2 py-1 font-mono text-right text-[10px] text-[#d2d9e8] outline-none focus-visible:ring-2 focus-visible:ring-[#60a5fa]/50"
        />
        {unit && <span className="text-[8px] text-[#556076]">{unit}</span>}
      </div>
    </label>
  );
}

function CoordField({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number | "";
  min: number;
  max: number;
  step: number;
  onChange: (v: number | "") => void;
}) {
  return (
    <label className="flex flex-col gap-0.5">
      <span className="text-[8px] uppercase tracking-[0.16em] text-[#556076]">{label}</span>
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        step={step}
        placeholder="—"
        onChange={(e) => onChange(e.target.value === "" ? "" : Number(e.target.value))}
        className="rounded border border-[#1f2536] bg-[#111521] px-2 py-1 font-mono text-right text-[10px] text-[#d2d9e8] outline-none focus-visible:ring-2 focus-visible:ring-[#60a5fa]/50"
      />
    </label>
  );
}

export function ScheduleEditor() {
  const scene = useStudioStore((s) => s.scene);
  const updateTimeSchedule = useStudioStore((s) => s.updateTimeSchedule);
  const ts = scene.timeSchedule;

  // ── Interior lights ──
  const intStart = ts?.interiorLightSchedule[0]?.periods[0]?.startHour ?? 6;
  const intEnd   = ts?.interiorLightSchedule[0]?.periods[0]?.endHour   ?? 22;

  function setInteriorHours(start: number, end: number) {
    updateTimeSchedule({
      interiorLightSchedule: [
        { lightId: "interior_all", periods: [{ startHour: start, endHour: end }] },
      ],
    });
  }

  // ── Exterior lights ──
  const extStart = ts?.exteriorLightSchedule[0]?.periods[0]?.startHour ?? 19;
  const extEnd   = ts?.exteriorLightSchedule[0]?.periods[0]?.endHour   ?? 6;

  function setExteriorHours(start: number, end: number) {
    updateTimeSchedule({
      exteriorLightSchedule: [
        { lightId: "exterior_all", periods: [{ startHour: start, endHour: end }] },
      ],
    });
  }

  // ── Occupancy periods ──
  const [newOccStart, setNewOccStart] = useState(8);
  const [newOccEnd,   setNewOccEnd]   = useState(18);
  const [newOccLevel, setNewOccLevel] = useState<OccupancyPeriod["level"]>("medium");
  const occupancy = ts?.occupancySchedule ?? [];

  function addOccupancyPeriod() {
    updateTimeSchedule({
      occupancySchedule: [
        ...occupancy,
        {
          level: newOccLevel,
          timeRange: { startHour: newOccStart, endHour: newOccEnd },
          cameraObstructionMultiplier: newOccLevel === "high" ? 0.25 : newOccLevel === "medium" ? 0.1 : 0,
        },
      ],
    });
  }

  function removeOccupancyPeriod(index: number) {
    updateTimeSchedule({
      occupancySchedule: occupancy.filter((_, i) => i !== index),
    });
  }

  // ── Guard patrols ──
  const [newPatrolInterval, setNewPatrolInterval] = useState(120);
  const [newPatrolDuration, setNewPatrolDuration] = useState(20);
  const [newPatrolFirstHour, setNewPatrolFirstHour] = useState(22);
  const patrols = ts?.guardPatrolSchedule ?? [];

  function addPatrol() {
    const newPatrol: PatrolSchedule = {
      guardId: `guard_${Date.now()}`,
      patrolRouteId: "main_route",
      intervalMinutes: newPatrolInterval,
      durationMinutes: newPatrolDuration,
      firstPatrolHour: newPatrolFirstHour,
    };
    updateTimeSchedule({ guardPatrolSchedule: [...patrols, newPatrol] });
  }

  function removePatrol(index: number) {
    updateTimeSchedule({ guardPatrolSchedule: patrols.filter((_, i) => i !== index) });
  }

  // ── Site location for seasonal lighting ──
  const loc = ts?.location;
  const [latVal,  setLatVal]  = useState<number | "">(loc?.latitude  ?? "");
  const [lngVal,  setLngVal]  = useState<number | "">(loc?.longitude ?? "");
  const [tzVal,   setTzVal]   = useState(loc?.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone);

  function applyLocation() {
    if (latVal === "" || lngVal === "") return;
    updateTimeSchedule({ location: { latitude: latVal, longitude: lngVal, timezone: tzVal } });
  }

  function clearLocation() {
    setLatVal("");
    setLngVal("");
    updateTimeSchedule({ location: undefined });
  }

  return (
    <div className="space-y-2.5 px-3 py-3">
      {/* ── Interior lights ── */}
      <SectionCard title="Interior Lights" icon={<Sun className="h-3 w-3" />}>
        <div className="grid grid-cols-2 gap-2">
          <HourSelect label="On from" value={intStart} onChange={(v) => setInteriorHours(v, intEnd)} />
          <HourSelect label="Off at"  value={intEnd}   onChange={(v) => setInteriorHours(intStart, v)} />
        </div>
        <p className="mt-1 text-[8px] text-[#4a5568]">
          Lights on {intStart}:00–{intEnd}:00. Affects camera IR quality outside these hours.
        </p>
      </SectionCard>

      {/* ── Exterior lights ── */}
      <SectionCard title="Exterior Lights" icon={<Sun className="h-3 w-3 text-yellow-400" />}>
        {loc && (
          <div className="mb-2 rounded border border-green-800/30 bg-green-950/20 px-2 py-1 text-[8px] text-green-300">
            Seasonal lighting active — using sunrise/sunset for {loc.latitude.toFixed(2)}°, {loc.longitude.toFixed(2)}°
          </div>
        )}
        <div className="grid grid-cols-2 gap-2">
          <HourSelect label="On from (dusk)" value={extStart} onChange={(v) => setExteriorHours(v, extEnd)} />
          <HourSelect label="Off at (dawn)"  value={extEnd}   onChange={(v) => setExteriorHours(extStart, v)} />
        </div>
        <p className="mt-1 text-[8px] text-[#4a5568]">
          Exterior lights on {extStart}:00–{extEnd === 0 ? "24:00 / 0:00" : `${extEnd}:00`}. Add site location below for seasonal sunrise/sunset.
        </p>
      </SectionCard>

      {/* ── Occupancy periods ── */}
      <SectionCard title="Occupancy Schedule" icon={<Users className="h-3 w-3" />}>
        {occupancy.length > 0 && (
          <div className="mb-2 space-y-1">
            {occupancy.map((op, i) => {
              const col = OCCUPANCY_OPTIONS.find((o) => o.value === op.level);
              return (
                <div key={i} className="flex items-center justify-between rounded border border-[#1f2536] bg-[#111521] px-2 py-1">
                  <div className="flex items-center gap-2">
                    <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: col?.color }} />
                    <span className="font-mono text-[9px] text-[#d2d9e8]">
                      {op.timeRange.startHour}:00–{op.timeRange.endHour}:00
                    </span>
                    <span className="text-[8px] uppercase tracking-wide" style={{ color: col?.color }}>
                      {op.level}
                    </span>
                  </div>
                  <button type="button" onClick={() => removeOccupancyPeriod(i)} className="text-[#4a5568] hover:text-red-400">
                    <Trash2 className="h-2.5 w-2.5" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
        <div className="grid grid-cols-3 gap-2">
          <HourSelect label="Start" value={newOccStart} onChange={setNewOccStart} />
          <HourSelect label="End"   value={newOccEnd}   onChange={setNewOccEnd} />
          <label className="flex flex-col gap-0.5">
            <span className="text-[8px] uppercase tracking-[0.16em] text-[#556076]">Level</span>
            <select
              value={newOccLevel}
              onChange={(e) => setNewOccLevel(e.target.value as OccupancyPeriod["level"])}
              className="rounded border border-[#1f2536] bg-[#111521] px-2 py-1 text-[10px] text-[#d2d9e8] outline-none"
            >
              {OCCUPANCY_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </label>
        </div>
        <button
          type="button"
          onClick={addOccupancyPeriod}
          className="mt-2 w-full rounded border border-[#1f2536] bg-[#111521] py-1 text-[9px] text-[#8090a8] hover:border-[#2a3246] hover:text-[#c7d0e4]"
        >
          + Add Period
        </button>
      </SectionCard>

      {/* ── Guard patrols ── */}
      <SectionCard title="Guard Patrols" icon={<Shield className="h-3 w-3 text-blue-400" />}>
        {patrols.length > 0 && (
          <div className="mb-2 space-y-1">
            {patrols.map((p, i) => (
              <div key={i} className="flex items-center justify-between rounded border border-[#1f2536] bg-[#111521] px-2 py-1">
                <div className="text-[9px] text-[#d2d9e8]">
                  <span className="font-mono">First at {p.firstPatrolHour}:00</span>
                  <span className="ml-2 text-[#556076]">every {p.intervalMinutes}min</span>
                  <span className="ml-2 text-[#556076]">({p.durationMinutes}min each)</span>
                </div>
                <button type="button" onClick={() => removePatrol(i)} className="text-[#4a5568] hover:text-red-400">
                  <Trash2 className="h-2.5 w-2.5" />
                </button>
              </div>
            ))}
          </div>
        )}
        <div className="grid grid-cols-3 gap-2">
          <NumberField label="Interval" value={newPatrolInterval} unit="min" min={30} onChange={setNewPatrolInterval} />
          <NumberField label="Duration" value={newPatrolDuration} unit="min" min={5}  onChange={setNewPatrolDuration} />
          <NumberField label="First at" value={newPatrolFirstHour} unit="h" min={0} max={23} onChange={setNewPatrolFirstHour} />
        </div>
        <button
          type="button"
          onClick={addPatrol}
          className="mt-2 w-full rounded border border-[#1f2536] bg-[#111521] py-1 text-[9px] text-[#8090a8] hover:border-[#2a3246] hover:text-[#c7d0e4]"
        >
          + Add Guard Round
        </button>
        <p className="mt-1 text-[8px] text-[#4a5568]">
          Guard patrols reduce adversarial path exposure during active rounds.
        </p>
      </SectionCard>

      {/* ── Site location for seasonal lighting ── */}
      <SectionCard title="Site Location" icon={<MapPin className="h-3 w-3 text-purple-400" />}>
        <div className="grid grid-cols-2 gap-2">
          <CoordField label="Latitude"  value={latVal}  min={-90}  max={90}  step={0.001} onChange={setLatVal} />
          <CoordField label="Longitude" value={lngVal}  min={-180} max={180} step={0.001} onChange={setLngVal} />
        </div>
        <label className="mt-2 flex flex-col gap-0.5">
          <span className="text-[8px] uppercase tracking-[0.16em] text-[#556076]">Timezone</span>
          <input
            type="text"
            value={tzVal}
            onChange={(e) => setTzVal(e.target.value)}
            placeholder="America/New_York"
            className="rounded border border-[#1f2536] bg-[#111521] px-2 py-1 font-mono text-[10px] text-[#d2d9e8] outline-none focus-visible:ring-2 focus-visible:ring-[#60a5fa]/50"
          />
        </label>
        <div className="mt-2 flex gap-2">
          <button
            type="button"
            onClick={applyLocation}
            disabled={latVal === "" || lngVal === ""}
            className="flex-1 rounded border border-[#2a3246] bg-[#111521] py-1 text-[9px] text-[#8090a8] hover:border-[#3a4560] hover:text-[#c7d0e4] disabled:opacity-40"
          >
            Apply
          </button>
          {loc && (
            <button
              type="button"
              onClick={clearLocation}
              className="rounded border border-red-900/30 bg-red-950/15 px-3 py-1 text-[9px] text-red-400 hover:border-red-700"
            >
              Clear
            </button>
          )}
        </div>
        <p className="mt-1 text-[8px] text-[#4a5568]">
          Enables real sunrise/sunset times for accurate exterior lighting simulation.
        </p>
      </SectionCard>

      {/* ── Crowd Profiles ── */}
      <SectionCard title="Crowd & NPC Simulation" icon={<Users className="h-3.5 w-3.5" />}>
        <CrowdProfileEditor />
      </SectionCard>

      {/* ── Event / Temporary Site ── */}
      <EventConfigPanel />

      {/* ── Clock icon hint ── */}
      <div className="flex items-center gap-1 text-[8px] text-[#3a4158]">
        <Clock className="h-2.5 w-2.5" />
        <span>Changes apply on next "Compute 24h Profile" run.</span>
      </div>
    </div>
  );
}
