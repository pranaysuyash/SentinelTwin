"use client";

import { Camera, Edit3, FileText, Plus, Thermometer, Droplets, Wind, Sun } from "lucide-react";

import { useStudioStore } from "@/store/studio-store";
import type { DoriQuality } from "@/schema/security-scene";

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

const QUALITY_LABELS: Record<DoriQuality, string> = {
  identification: "Identification (250 PPM)",
  recognition: "Recognition (125 PPM)",
  observation: "Observation (62.5 PPM)",
  detection: "Detection (25 PPM)",
  none: "None",
};

function AssumptionRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 text-[9px]">
      <span className="text-[#647089]">{label}</span>
      <span className="text-right text-[#d3dbea]">{value}</span>
    </div>
  );
}

function AssumptionsPanel() {
  const scene = useStudioStore((s) => s.scene);
  const ass = scene.assumptions;
  const capitalize = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);

  return (
    <BottomSection
      title="Simulation Assumptions"
      action={
        <button className="inline-flex items-center gap-1 rounded-md border border-[#24283a] bg-[#111521] px-2 py-1 text-[8px] text-[#aab5ca] transition-colors hover:border-[#32384d] hover:text-white">
          <Edit3 className="h-3 w-3" />
          Edit Assumptions
        </button>
      }
    >
      <div className="rounded-xl border border-[#1f2536] bg-[#0b0f17] p-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.02)]">
        <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-[9px]">
          <AssumptionRow label="DORI Model" value={ass.doriStandard === "simplified" ? "Simplified PPM" : ass.doriStandard} />
          <AssumptionRow label="Lighting Model" value="Simplified" />
          <AssumptionRow label="PPM Thresholds" value="25 / 62.5 / 125 / 250" />
          <AssumptionRow label="Glass Handling" value="Partial Transmission" />
          <AssumptionRow label="Person Height" value={`${ass.personHeightM} m`} />
          <AssumptionRow label="Time of Day" value={capitalize(ass.timeOfDay)} />
          <AssumptionRow label="Wall Height" value={`${ass.wallHeightM} m`} />
          <AssumptionRow label="Night Mode" value={ass.timeOfDay === "night" ? "On" : "Off"} />
        </div>
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
  const zone = result?.criticalZoneResults[0];
  const criticalIssue = result?.issues.find((issue) => issue.category === "quality_fail" && issue.severity === "critical")?.description
    ?? "Cash Counter is not meeting Recognition requirement.";
  const primaryCause = result?.issues.find((issue) => issue.category === "blindspot")
    ? "Cupboard obstructs Camera 1 view. Distance too far for recognition from Camera 2."
    : result?.recommendations[0]?.description
      ?? "Cupboard obstructs Camera 1 view. Distance too far for recognition from Camera 2.";
  const impact = zone
    ? `Subject can be observed but not recognized at the ${zone.label.toLowerCase()}.`
    : "Subject can be observed but not recognized at the counter.";
  const recommendation = result?.recommendations.length
    ? `${result.recommendations[0]?.description} ${result.recommendations[1]?.description ?? ""}`.trim()
    : "Move cupboard or adjust Camera 2, consider higher resolution or reposition.";

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
        <button className="mt-2 inline-flex w-fit items-center gap-1 rounded-md border border-[#24283a] bg-[#111521] px-2 py-1 text-[8px] text-[#c7d0e4] transition-colors hover:border-[#32384d] hover:text-white">
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
