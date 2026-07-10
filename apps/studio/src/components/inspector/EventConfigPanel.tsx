"use client";

import { Plus, Trash2, CalendarDays } from "lucide-react";
import { useMemo } from "react";

import {
  NumberInput,
  SelectInput,
  TextInput,
  ToggleField,
} from "@/components/inspector/inspector-controls";
import { SectionCard } from "@/components/shared/SectionCard";
import type { EventConfig, EventPhase } from "@/schema/security-scene";
import { useStudioStore } from "@/store/studio-store";

import { UI_SURFACES } from "@/lib/studio-surface-tokens";
const EVENT_TYPES: { value: EventConfig["eventType"]; label: string }[] = [
  { value: "concert", label: "Concert" },
  { value: "trade_show", label: "Trade Show" },
  { value: "sporting_event", label: "Sporting Event" },
  { value: "outdoor_market", label: "Outdoor Market" },
  { value: "festival", label: "Festival" },
  { value: "pop_up", label: "Pop-Up" },
  { value: "protest", label: "Protest / March" },
  { value: "ceremony", label: "Ceremony" },
  { value: "other", label: "Other" },
];

const PHASE_TYPES: { value: EventPhase["phase"]; label: string }[] = [
  { value: "setup", label: "Setup" },
  { value: "ingress", label: "Ingress" },
  { value: "live", label: "Live" },
  { value: "egress", label: "Egress" },
  { value: "teardown", label: "Teardown" },
];

const OCCUPANCY_OPTIONS: { value: NonNullable<EventPhase["expectedOccupancy"]>; label: string }[] = [
  { value: "empty", label: "Empty" },
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "peak", label: "Peak" },
];

function makeDefaultConfig(): EventConfig {
  return {
    eventName: "Untitled Event",
    eventType: "other",
    isActive: true,
    expectedPeakAttendance: 500,
    venueBoundaryMode: "outdoor",
    phases: [
      { id: "phase_setup", label: "Setup", phase: "setup", startHour: 6, endHour: 10, expectedOccupancy: "low", notes: "" },
      { id: "phase_ingress", label: "Ingress", phase: "ingress", startHour: 10, endHour: 12, expectedOccupancy: "high", notes: "" },
      { id: "phase_live", label: "Live Event", phase: "live", startHour: 12, endHour: 18, expectedOccupancy: "peak", notes: "" },
      { id: "phase_egress", label: "Egress", phase: "egress", startHour: 18, endHour: 20, expectedOccupancy: "high", notes: "" },
      { id: "phase_teardown", label: "Teardown", phase: "teardown", startHour: 20, endHour: 23, expectedOccupancy: "low", notes: "" },
    ],
    weatherRiskLevel: "none",
    specialRisks: [],
  };
}

export function EventConfigPanel() {
  const scene = useStudioStore((s) => s.scene);
  const updateEventConfig = useStudioStore((s) => s.updateEventConfig);

  const config = scene.eventConfig;

  const phaseTimeline = useMemo(() => {
    if (!config?.phases.length) return null;
    return config.phases
      .slice()
      .sort((a, b) => a.startHour - b.startHour);
  }, [config?.phases]);

  if (!config) {
    return (
      <SectionCard title="Event / Temporary Site" icon={<CalendarDays className="h-3.5 w-3.5" />}>
        <div className="text-[10px] text-[#6b7891]">
          No event configured. Enable this to model time-bounded deployments with lifecycle phases (setup → live → teardown).
        </div>
        <button
          type="button"
          onClick={() => updateEventConfig(makeDefaultConfig())}
          className="mt-2 flex w-full items-center justify-center gap-1.5 rounded border border-emerald-800/40 bg-emerald-950/20 px-3 py-1.5 text-[11px] text-emerald-300 transition hover:bg-emerald-950/40"
        >
          <Plus size={11} />
          Enable Event Mode
        </button>
      </SectionCard>
    );
  }

  const updateConfig = (patch: Partial<EventConfig>) => {
    updateEventConfig({ ...config, ...patch });
  };

  const updatePhase = (phaseId: string, patch: Partial<EventPhase>) => {
    updateConfig({
      phases: config.phases.map((p) => (p.id === phaseId ? { ...p, ...patch } : p)),
    });
  };

  const addPhase = () => {
    const id = `phase_${Date.now().toString(36)}`;
    updateConfig({
      phases: [...config.phases, {
        id,
        label: "New Phase",
        phase: "live",
        startHour: 12,
        endHour: 14,
        expectedOccupancy: "medium",
        notes: "",
      }],
    });
  };

  const removePhase = (phaseId: string) => {
    updateConfig({ phases: config.phases.filter((p) => p.id !== phaseId) });
  };

  return (
    <div className="space-y-2.5">
      <SectionCard title="Event Configuration" icon={<CalendarDays className="h-3.5 w-3.5" />}>
        <TextInput label="Event Name" value={config.eventName} onChange={(v) => updateConfig({ eventName: v })} />
        <SelectInput
          label="Event Type"
          value={config.eventType}
          options={EVENT_TYPES}
          onChange={(v) => updateConfig({ eventType: v as EventConfig["eventType"] })}
        />
        <NumberInput label="Peak Attendance" value={config.expectedPeakAttendance} min={0} step={50} onChange={(v) => updateConfig({ expectedPeakAttendance: Math.round(v) })} />
        <SelectInput
          label="Venue Boundary"
          value={config.venueBoundaryMode}
          options={[
            { value: "indoor", label: "Indoor" },
            { value: "outdoor", label: "Outdoor" },
            { value: "hybrid", label: "Hybrid" },
          ]}
          onChange={(v) => updateConfig({ venueBoundaryMode: v as EventConfig["venueBoundaryMode"] })}
        />
        <SelectInput
          label="Weather Risk"
          value={config.weatherRiskLevel}
          options={[
            { value: "none", label: "None" },
            { value: "low", label: "Low" },
            { value: "moderate", label: "Moderate" },
            { value: "high", label: "High" },
          ]}
          onChange={(v) => updateConfig({ weatherRiskLevel: v as EventConfig["weatherRiskLevel"] })}
        />
        <ToggleField
          label="Event Active"
          value={config.isActive}
          trueLabel="Active"
          falseLabel="Inactive"
          onChange={(v) => updateConfig({ isActive: v })}
        />
      </SectionCard>

      <SectionCard
        title="Lifecycle Phases"
        action={
          <button
            type="button"
            onClick={addPhase}
            className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[9px] text-emerald-300 transition hover:bg-emerald-900/20"
          >
            <Plus size={10} /> Add
          </button>
        }
      >
        {phaseTimeline && phaseTimeline.length > 0 ? (
          <div className="space-y-2">
            {phaseTimeline.map((phase) => (
              <div key={phase.id} className="rounded border border-[#1e2536] bg-[#0a0e18] p-2">
                <div className="mb-1.5 flex items-center justify-between">
                  <div className={`text-[10px] font-semibold ${UI_SURFACES.textBody}`}>{phase.label}</div>
                  <button
                    type="button"
                    onClick={() => removePhase(phase.id)}
                    className="text-red-400/60 transition hover:text-red-400"
                  >
                    <Trash2 size={10} />
                  </button>
                </div>
                <TextInput label="Label" value={phase.label} onChange={(v) => updatePhase(phase.id, { label: v })} />
                <SelectInput
                  label="Phase"
                  value={phase.phase}
                  options={PHASE_TYPES}
                  onChange={(v) => updatePhase(phase.id, { phase: v as EventPhase["phase"] })}
                />
                <div className="grid grid-cols-2 gap-2">
                  <NumberInput label="Start Hour" value={phase.startHour} min={0} max={23} step={1} onChange={(v) => updatePhase(phase.id, { startHour: Math.round(v) })} />
                  <NumberInput label="End Hour" value={phase.endHour} min={0} max={24} step={1} onChange={(v) => updatePhase(phase.id, { endHour: Math.round(v) })} />
                </div>
                <SelectInput
                  label="Expected Occupancy"
                  value={phase.expectedOccupancy}
                  options={OCCUPANCY_OPTIONS}
                  onChange={(v) => updatePhase(phase.id, { expectedOccupancy: v as EventPhase["expectedOccupancy"] })}
                />
              </div>
            ))}
          </div>
        ) : (
          <div className={`text-[10px] ${UI_SURFACES.textDimMid}`}>No phases defined.</div>
        )}
      </SectionCard>

      <button
        type="button"
        onClick={() => updateEventConfig(undefined)}
        className="flex w-full items-center justify-center gap-1.5 rounded border border-red-900/40 bg-red-950/20 px-3 py-1.5 text-[11px] text-red-400 transition hover:bg-red-950/40"
      >
        <Trash2 size={11} />
        Disable Event Mode
      </button>
    </div>
  );
}
