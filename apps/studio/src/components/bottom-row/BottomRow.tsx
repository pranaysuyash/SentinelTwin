"use client";

import { Check, Edit3, FileText, Plus, Thermometer, Droplets, Wind, Sun, X } from "lucide-react";
import { useState } from "react";

import { useStudioStore } from "@/store/studio-store";
import type { SimulationAssumptions } from "@/schema/security-scene";

function panelTimeLabel(ts: number) {
  const d = new Date(ts);
  return `Today, ${d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}`;
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
  // Different heatmap patterns for variety
  const patterns = [
    { bg: "#0d1219", blob1: "radial-gradient(ellipse at 28% 32%, #f97316 0%, #ef4444 45%, transparent 72%)", blob2: "radial-gradient(ellipse at 65% 65%, #22c55e 0%, #15803d 40%, transparent 68%)", blob3: "radial-gradient(ellipse at 75% 25%, #3b82f6 0%, #1e40af 45%, transparent 65%)" },
    { bg: "#0d1219", blob1: "radial-gradient(ellipse at 50% 40%, #22c55e 0%, #16a34a 50%, transparent 75%)", blob2: "radial-gradient(ellipse at 25% 70%, #f97316 0%, #c2410c 40%, transparent 68%)", blob3: "radial-gradient(ellipse at 80% 55%, #eab308 0%, #a16207 45%, transparent 65%)" },
    { bg: "#0d1219", blob1: "radial-gradient(ellipse at 35% 50%, #3b82f6 0%, #1d4ed8 50%, transparent 75%)", blob2: "radial-gradient(ellipse at 70% 35%, #22c55e 0%, #166534 40%, transparent 68%)", blob3: "radial-gradient(ellipse at 55% 75%, #f97316 0%, #9a3412 45%, transparent 65%)" },
    { bg: "#111827", blob1: "radial-gradient(ellipse at 40% 45%, #60a5fa 0%, #1d4ed8 50%, transparent 75%)", blob2: "radial-gradient(ellipse at 20% 25%, #818cf8 0%, #4338ca 40%, transparent 68%)", blob3: "radial-gradient(ellipse at 75% 65%, #94a3b8 0%, #475569 45%, transparent 65%)" },
  ];
  const p = patterns[index % patterns.length]!;
  return (
    <div className="relative h-[52px] overflow-hidden rounded-lg border border-[#1f2536]" style={{ background: p.bg }}>
      {/* Floor grid */}
      <div className="absolute inset-0 opacity-25 [background-image:linear-gradient(rgba(255,255,255,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.08)_1px,transparent_1px)] [background-size:8px_8px]" />
      {/* Heatmap blobs */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute inset-0 opacity-55" style={{ background: p.blob1 }} />
        <div className="absolute inset-0 opacity-45" style={{ background: p.blob2 }} />
        <div className="absolute inset-0 opacity-35" style={{ background: p.blob3 }} />
      </div>
      {/* Room border suggestion */}
      <div className="absolute inset-[3px] rounded border border-white/10" />
      {/* Camera dots */}
      <div className="absolute left-[7px] top-[6px] h-[7px] w-[7px] rounded-full bg-blue-400 shadow-[0_0_5px_rgba(96,165,250,0.8)]" />
      <div className="absolute bottom-[7px] right-[10px] h-[7px] w-[7px] rounded-full bg-blue-300 shadow-[0_0_5px_rgba(147,197,253,0.7)]" />
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
        <button
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

        <button className="flex w-[88px] flex-shrink-0 flex-col items-center justify-center rounded-xl border border-[#1f2536] bg-[#0b0f17] text-[#7f8ca6] transition-colors hover:border-[#32384d] hover:text-white">
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

  const capitalize = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);

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
            <button
              onClick={commitEdit}
              className="inline-flex items-center gap-1 rounded-md border border-green-600/40 bg-green-600/15 px-2 py-1 text-[8px] text-green-300 transition-colors hover:bg-green-600/25"
            >
              <Check className="h-3 w-3" />
              Save
            </button>
            <button
              onClick={cancelEdit}
              className="inline-flex items-center gap-1 rounded-md border border-[#24283a] bg-[#111521] px-2 py-1 text-[8px] text-[#6a7490] transition-colors hover:text-white"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        ) : (
          <button
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
                  className="w-16 rounded border border-[#24283a] bg-[#111521] px-1.5 py-0.5 text-right font-mono text-[9px] text-white outline-none"
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
                  className="w-16 rounded border border-[#24283a] bg-[#111521] px-1.5 py-0.5 text-right font-mono text-[9px] text-white outline-none"
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
            <AssumptionRow label="Glass Handling" value="Partial Trans." />
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
  const result = useStudioStore((s) => s.simulationResult);
  const setBottomTab = useStudioStore((s) => s.setBottomTab);
  const zone = result?.criticalZoneResults[0];
  const criticalIssue = result?.issues.find((issue) => issue.category === "quality_fail" && issue.severity === "critical")?.description
    ?? result?.issues.find((issue) => issue.category === "quality_fail")?.description
    ?? "Critical zone is not meeting the requested quality threshold.";
  const primaryCause = result?.issues.find((issue) => issue.category === "blindspot")?.description
    ?? result?.recommendations[0]?.description
    ?? "Coverage requires a scene or camera adjustment.";
  const impact = zone
    ? `Current simulated quality for ${zone.label} is ${zone.actualQuality} against a ${zone.requiredQuality} target.`
    : "A critical zone is below the requested target quality.";
  const recommendation = result?.recommendations.length
    ? result.recommendations
      .map((rec) => `${rec.description}${rec.verified ? " (verified)" : " (not yet verified)"}`)
      .slice(0, 2)
      .join(" ")
    : "No verified recommendation is available yet.";

  return (
    <BottomSection
      title="Report Summary (Latest Run)"
      action={<FileText className="h-3 w-3 text-[#5a6478]" />}
    >
      <div className="flex h-full flex-col rounded-xl border border-[#1f2536] bg-[#0b0f17] p-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.02)]">
        <div className="flex-1 space-y-1.5 overflow-y-auto">
          <ReportBullet color="#ef4444" label="Critical Issue" text={criticalIssue} />
          <ReportBullet color="#f59e0b" label="Primary Cause" text={primaryCause} />
          <ReportBullet color="#9ca3af" label="Impact" text={impact} />
          <ReportBullet color="#60a5fa" label="Recommendation" text={recommendation} />
        </div>
        <button
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
  const envMode = useStudioStore((s) => s.environmentMode);

  const envData: Record<"day" | "night" | "dusk", { temp: string; humidity: string; weather: string; lightingLevel: string }> = {
    day: { temp: "28°C", humidity: "60%", weather: "Clear", lightingLevel: "Normal" },
    night: { temp: "22°C", humidity: "72%", weather: "Clear", lightingLevel: "Low" },
    dusk: { temp: "24°C", humidity: "66%", weather: "Clear", lightingLevel: "Dim" },
  };

  const env = envData[envMode] ?? envData.day;

  return (
    <BottomSection title="Environment">
      <div className="rounded-xl border border-[#1f2536] bg-[#0b0f17] p-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.02)]">
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-[9px]">
            <Thermometer className="h-3.5 w-3.5 text-orange-400" />
            <span className="text-[#647089]">Temp.</span>
            <span className="ml-auto text-[#d3dbea]">{env.temp}</span>
          </div>
          <div className="flex items-center gap-2 text-[9px]">
            <Droplets className="h-3.5 w-3.5 text-blue-400" />
            <span className="text-[#647089]">Humidity</span>
            <span className="ml-auto text-[#d3dbea]">{env.humidity}</span>
          </div>
          <div className="flex items-center gap-2 text-[9px]">
            <Wind className="h-3.5 w-3.5 text-[#8b96ae]" />
            <span className="text-[#647089]">Weather</span>
            <span className="ml-auto text-[#d3dbea]">{env.weather}</span>
          </div>
          <div className="flex items-center gap-2 text-[9px]">
            <Sun className="h-3.5 w-3.5 text-yellow-400" />
            <span className="text-[#647089]">Lighting Level</span>
            <span className="ml-auto text-[#d3dbea]">{env.lightingLevel}</span>
          </div>
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
