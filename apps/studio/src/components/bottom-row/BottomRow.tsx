"use client";

import { Check, Edit3, FileText, Lightbulb, Plus, X } from "lucide-react";
import { useState } from "react";

import { useStudioStore } from "@/store/studio-store";
import { buildSecurityOutcomeModel } from "@/lib/security-outcome/security-outcome-model";
import { buildReportSummaryLines } from "@/lib/report-summary";
import type { SimulationAssumptions } from "@/schema/security-scene";
import { buildEnvironmentRows, summarizeWindowStates } from "./bottom-row-utils";

function panelTimeLabel(ts: number) {
  const d = new Date(ts);
  return `Today, ${d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}`;
}

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function BottomSection({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-[9px] font-semibold uppercase tracking-widest text-[#5a6478]">{title}</span>
        {action}
      </div>
      <div className="min-h-0 flex-1">{children}</div>
    </div>
  );
}

function SnapshotThumb({ coverage, index = 0 }: { coverage?: number; index?: number }) {
  // Geometric coverage thumbnails — solid surfaces with camera dots and grid
  const surfaces = [
    { bg: "#0b101a", dotColor: "rgba(96,165,250,0.8)", dotColor2: "rgba(125,211,252,0.7)" },
    { bg: "#0e0d14", dotColor: "rgba(52,211,153,0.8)", dotColor2: "rgba(74,222,128,0.7)" },
    { bg: "#110b0f", dotColor: "rgba(251,191,36,0.8)", dotColor2: "rgba(250,204,21,0.7)" },
    { bg: "#0a1118", dotColor: "rgba(56,189,248,0.8)", dotColor2: "rgba(34,211,238,0.7)" },
  ];
  const p = surfaces[index % surfaces.length]!;
  return (
    <div className="relative h-[52px] overflow-hidden rounded-lg border border-white/10" style={{ background: p.bg }}>
      {/* Floor grid */}
      <div className="absolute inset-0 opacity-20 [background-image:linear-gradient(rgba(255,255,255,0.06)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.06)_1px,transparent_1px)] [background-size:8px_8px]" />
      {/* Room border suggestion */}
      <div className="absolute inset-[3px] rounded border border-white/8" />
      {/* Camera dots */}
      <div className="absolute left-[7px] top-[6px] h-[7px] w-[7px] rounded-full" style={{ background: p.dotColor, boxShadow: `0 0 5px ${p.dotColor}` }} />
      <div className="absolute bottom-[7px] right-[10px] h-[7px] w-[7px] rounded-full" style={{ background: p.dotColor2, boxShadow: `0 0 5px ${p.dotColor2}` }} />
      {/* Coverage label */}
      {coverage !== undefined && (
        <div className="absolute right-1.5 top-1 text-[10px] font-bold text-white" style={{ textShadow: "0 0 6px rgba(0,0,0,0.9)" }}>
          {Math.round(coverage)}%
        </div>
      )}
    </div>
  );
}

function SnapshotsPanel() {
  const snapshots = useStudioStore((s) => s.snapshots);
  const saveSnap = useStudioStore((s) => s.saveSnapshot);
  const result = useStudioStore((s) => s.simulationResult);

  return (
    <BottomSection
      title="Snapshots"
      action={
        <button type="button"
          onClick={() => result && saveSnap(`Snapshot ${snapshots.length + 1}`)}
          className="inline-flex items-center gap-1 rounded-md border border-[#24283a] bg-[#111521] px-2 py-1 text-[8px] text-green-300 transition-colors hover:border-[#32384d] hover:text-white"
        >
          <Plus className="h-3 w-3" />
          New
        </button>
      }
    >
      <div className="flex h-full items-stretch gap-2 overflow-x-auto pb-1">
        {snapshots.map((snap, i) => (
          <div key={snap.id} className="w-[84px] flex-shrink-0 rounded-xl border border-[#1f2536] bg-[#0b0f17] p-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.02)]">
            <SnapshotThumb coverage={snap.simulation?.totalCoveragePct} index={i} />
            <div className="mt-1 text-[10px] font-medium text-[#d7deed] truncate">{snap.label}</div>
            <div className="mt-0.5 text-[8px] text-[#5e6980]">{panelTimeLabel(snap.createdAt)}</div>
          </div>
        ))}

        <button type="button" className="flex w-[96px] flex-shrink-0 flex-col items-center justify-center rounded-xl border border-[#1f2536] bg-[#0b0f17] text-[#7f8ca6] transition-colors hover:border-[#32384d] hover:text-white">
          <Plus className="h-4 w-4" />
          <span className="mt-1 text-[10px]">New Snapshot</span>
        </button>
      </div>
    </BottomSection>
  );
}

function AssumptionRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 text-[9px]">
      <span className="text-[#647089]">{label}</span>
      <span className="text-right text-[#d3dbea]">{value}</span>
    </div>
  );
}

function SegmentedControl<T extends string>({
  value, options, onChange,
}: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="inline-flex overflow-hidden rounded-md border border-[#24283a] bg-[#0b0f17]">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={`px-2 py-0.5 text-[9px] font-medium transition-colors border-r border-[#24283a] last:border-r-0 ${
            value === opt.value ? "bg-blue-600/25 text-blue-200" : "text-[#7f8aa3] hover:text-white"
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

function AssumptionsPanel() {
  const scene = useStudioStore((s) => s.scene);
  const updateAssumptions = useStudioStore((s) => s.updateAssumptions);
  const ass = scene.assumptions;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Partial<SimulationAssumptions>>({});

  const startEdit = () => {
    setDraft({
      timeOfDay: ass.timeOfDay,
      personHeightM: ass.personHeightM,
      wallHeightM: ass.wallHeightM,
      doriStandard: ass.doriStandard,
      interiorLightLevel: ass.interiorLightLevel,
      nightPenaltyMode: ass.nightPenaltyMode,
    });
    setEditing(true);
  };

  const commitEdit = () => {
    if (Object.keys(draft).length > 0) updateAssumptions(draft);
    setEditing(false);
    setDraft({});
  };

  const cancelEdit = () => { setEditing(false); setDraft({}); };

  const cur = (key: keyof SimulationAssumptions) =>
    (key in draft ? draft[key] : ass[key]) as never;

  return (
    <BottomSection
      title="Simulation Assumptions"
      action={
        editing ? (
          <div className="flex items-center gap-1">
            <button type="button"
              onClick={commitEdit}
              className="inline-flex items-center gap-1 rounded-md border border-green-600/40 bg-green-600/15 px-2 py-1 text-[8px] text-green-300 transition-colors hover:bg-green-600/25"
            >
              <Check className="h-3 w-3" />
              Save
            </button>
            <button type="button"
              onClick={cancelEdit}
              className="inline-flex items-center gap-1 rounded-md border border-[#24283a] bg-[#111521] px-2 py-1 text-[8px] text-[#6a7490] transition-colors hover:text-white"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        ) : (
          <button type="button"
            onClick={startEdit}
            className="inline-flex items-center gap-1 rounded-md border border-[#24283a] bg-[#111521] px-2 py-1 text-[8px] text-[#aab5ca] transition-colors hover:border-[#32384d] hover:text-white"
          >
            <Edit3 className="h-3 w-3" />
            Edit
          </button>
        )
      }
    >
      <div className="h-full overflow-y-auto rounded-xl border border-[#1f2536] bg-[#0b0f17] p-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.02)]">
        {editing ? (
          <div className="space-y-2 text-[9px]">
            {/* Time of Day */}
            <div className="flex items-center justify-between gap-2">
              <span className="text-[#647089]">Time of Day</span>
              <SegmentedControl
                value={cur("timeOfDay") as SimulationAssumptions["timeOfDay"]}
                options={[
                  { value: "day", label: "Day" },
                  { value: "night", label: "Night" },
                  { value: "custom", label: "Custom" },
                ]}
                onChange={(v) => setDraft((d) => ({ ...d, timeOfDay: v }))}
              />
            </div>
            {/* DORI Standard */}
            <div className="flex items-center justify-between gap-2">
              <span className="text-[#647089]">DORI Model</span>
              <SegmentedControl
                value={cur("doriStandard") as SimulationAssumptions["doriStandard"]}
                options={[
                  { value: "dori_2014", label: "DORI" },
                  { value: "oodpcvs_2025", label: "OODPCVS" },
                ]}
                onChange={(v) => setDraft((d) => ({ ...d, doriStandard: v }))}
              />
            </div>
            {/* Interior Light Level */}
            <div className="flex items-center justify-between gap-2">
              <span className="text-[#647089]">Light Level</span>
              <SegmentedControl
                value={cur("interiorLightLevel") as SimulationAssumptions["interiorLightLevel"]}
                options={[
                  { value: "dark", label: "Dark" },
                  { value: "dim", label: "Dim" },
                  { value: "normal", label: "Norm" },
                  { value: "bright", label: "Bright" },
                ]}
                onChange={(v) => setDraft((d) => ({ ...d, interiorLightLevel: v }))}
              />
            </div>
            {/* Night Penalty */}
            <div className="flex items-center justify-between gap-2">
              <span className="text-[#647089]">Night Penalty</span>
              <SegmentedControl
                value={cur("nightPenaltyMode") as SimulationAssumptions["nightPenaltyMode"]}
                options={[
                  { value: "none", label: "None" },
                  { value: "simple", label: "Simple" },
                  { value: "detailed", label: "Detail" },
                ]}
                onChange={(v) => setDraft((d) => ({ ...d, nightPenaltyMode: v }))}
              />
            </div>
            {/* Person Height */}
            <div className="flex items-center justify-between gap-2">
              <span className="text-[#647089]">Person Height</span>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  min={1.0}
                  max={2.5}
                  step={0.05}
                  value={cur("personHeightM") as number}
                  onChange={(e) => setDraft((d) => ({ ...d, personHeightM: parseFloat(e.target.value) || d.personHeightM }))}
                  className="w-16 rounded border border-[#24283a] bg-[#111521] px-1.5 py-0.5 text-right font-mono text-[9px] text-white outline-none focus-visible:ring-2 focus-visible:ring-[#60a5fa]/50"
                />
                <span className="text-[#556076]">m</span>
              </div>
            </div>
            {/* Wall Height */}
            <div className="flex items-center justify-between gap-2">
              <span className="text-[#647089]">Wall Height</span>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  min={2.0}
                  max={6.0}
                  step={0.1}
                  value={cur("wallHeightM") as number}
                  onChange={(e) => setDraft((d) => ({ ...d, wallHeightM: parseFloat(e.target.value) || d.wallHeightM }))}
                  className="w-16 rounded border border-[#24283a] bg-[#111521] px-1.5 py-0.5 text-right font-mono text-[9px] text-white outline-none focus-visible:ring-2 focus-visible:ring-[#60a5fa]/50"
                />
                <span className="text-[#556076]">m</span>
              </div>
            </div>
            <div className="pt-1 text-[8px] text-[#3a4158]">Changes apply on next simulation run.</div>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-[9px]">
            <AssumptionRow label="Quality Model" value={ass.doriStandard === "oodpcvs_2025" ? "OODPCVS 2025" : "DORI 2014"} />
            <AssumptionRow label="Lighting Model" value={capitalize(ass.interiorLightLevel)} />
            <AssumptionRow label="Night Penalty" value={capitalize(ass.nightPenaltyMode)} />
            <AssumptionRow label="Window Handling" value={summarizeWindowStates(scene)} />
            <AssumptionRow label="Person Height" value={`${ass.personHeightM} m`} />
            <AssumptionRow label="Time of Day" value={capitalize(ass.timeOfDay)} />
            <AssumptionRow label="Wall Height" value={`${ass.wallHeightM} m`} />
            <AssumptionRow label="Night Mode" value={ass.timeOfDay === "night" ? "On" : "Off"} />
          </div>
        )}
      </div>
    </BottomSection>
  );
}

function ReportBullet({ color, label, text }: { color: string; label: string; text: string }) {
  return (
    <div className="flex items-start gap-2 text-[9px] leading-relaxed">
      <span className="mt-1 h-1.5 w-1.5 rounded-full" style={{ backgroundColor: color }} />
      <span className="text-[#9eabc1]">
        <span style={{ color }} className="font-semibold">{label}: </span>
        {text}
      </span>
    </div>
  );
}

function ReportSummaryPanel() {
  const scene = useStudioStore((s) => s.scene);
  const result = useStudioStore((s) => s.simulationResult);
  const setBottomTab = useStudioStore((s) => s.setBottomTab);
  const outcome = buildSecurityOutcomeModel(scene, result, null);
  const reportSummary = buildReportSummaryLines(outcome, result, scene);

  return (
    <BottomSection
      title="Report Summary (Latest Run)"
      action={<FileText className="h-3 w-3 text-[#5a6478]" />}
    >
      <div className="flex h-full flex-col rounded-xl border border-[#1f2536] bg-[#0b0f17] p-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.02)]">
        <div className="flex-1 space-y-1.5 overflow-y-auto">
          {reportSummary ? reportSummary.map((line) => (
            <ReportBullet
              key={line.label}
              color={
                line.label === "Critical Issue"
                  ? "#ef4444"
                  : line.label === "Primary Cause"
                    ? "#f59e0b"
                    : line.label === "Impact"
                      ? "#9ca3af"
                      : "#60a5fa"
              }
              label={line.label}
              text={line.text}
            />
          )) : (
            <div className="rounded-lg border border-dashed border-[#24283a] bg-[#111521] px-2.5 py-3 text-[10px] text-[#6f7f9d]">
              Run simulation to populate the report summary.
            </div>
          )}
        </div>
        <button type="button"
          onClick={() => setBottomTab("report")}
          className="mt-2 inline-flex w-fit items-center gap-1 rounded-md border border-[#24283a] bg-[#111521] px-2 py-1 text-[8px] text-[#c7d0e4] transition-colors hover:border-[#32384d] hover:text-white"
        >
          Open Report Lite
        </button>
      </div>
    </BottomSection>
  );
}

function EnvironmentPanel() {
  const scene = useStudioStore((s) => s.scene);
  const envMode = useStudioStore((s) => s.environmentMode);
  const rows = buildEnvironmentRows(scene, envMode);

  return (
    <BottomSection title="Environment">
      <div className="rounded-xl border border-[#1f2536] bg-[#0b0f17] p-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.02)]">
        <div className="space-y-2">
          {rows.map((row) => (
            <div key={row.label} className="flex items-center gap-2 text-[9px]">
              {row.label === "Mode" ? <Lightbulb className="h-3.5 w-3.5 text-yellow-400" /> : null}
              <span className="text-[#647089]">{row.label}</span>
              <span className="ml-auto text-right text-[#d3dbea]">{row.value}</span>
            </div>
          ))}
        </div>
      </div>
    </BottomSection>
  );
}

export function BottomRow() {
  return (
    <div
      className="grid flex-shrink-0 grid-cols-4 divide-x divide-[#1e2130] border-t border-[#1e2130] bg-[#0c0f16]"
      style={{ height: 148 }}
    >
      <div className="flex overflow-hidden px-3 py-2"><SnapshotsPanel /></div>
      <div className="flex overflow-hidden px-3 py-2"><AssumptionsPanel /></div>
      <div className="flex overflow-hidden px-3 py-2"><ReportSummaryPanel /></div>
      <div className="flex overflow-hidden px-3 py-2"><EnvironmentPanel /></div>
    </div>
  );
}
