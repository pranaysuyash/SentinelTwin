"use client";

import { GitCompare } from "lucide-react";
import { DonutChart } from "@/components/shared/DonutChart";
import { buildSecurityOutcomeDelta } from "@/lib/security-outcome/security-outcome-model";
import { useStudioStore } from "@/store/studio-store";
import type { SimulationResult } from "@/schema/security-scene";
import { qualityToScore } from "@/simulation/dori";

// ── Coverage quality distribution mini bar ─────────────────────────────────
function QualityBar({ result }: { result: SimulationResult | undefined }) {
  if (!result) return <div className="h-3 rounded-sm bg-[#1a1d26]" />;

  const cells = result.coverageCells ?? [];
  const total = cells.length;
  if (total === 0) return <div className="h-3 rounded-sm bg-[#1a1d26]" />;

  // Use score-based buckets so it works for both DORI and OODPCVS quality names
  const Segments = [
    { minScore: 6, maxScore: 7, label: "identification", color: "#4ade80" },
    { minScore: 5, maxScore: 5, label: "recognition",    color: "#60a5fa" },
    { minScore: 3, maxScore: 4, label: "observation",    color: "#facc15" },
    { minScore: 1, maxScore: 2, label: "detection",      color: "#fb923c" },
  ] as const;
  const noneCount = cells.filter((c) => qualityToScore(c.quality) === 0).length;

  return (
    <div className="flex h-3 w-full rounded overflow-hidden gap-px">
      {Segments.map(({ minScore, maxScore, label, color }) => {
        const count = cells.filter((c) => {
          const s = qualityToScore(c.quality);
          return s >= minScore && s <= maxScore;
        }).length;
        const w = (count / total) * 100;
        if (w < 0.5) return null;
        return (
          <div
            key={label}
            className="h-full transition-all"
            style={{ width: `${w}%`, backgroundColor: color }}
            title={`${label}: ${Math.round(w)}%`}
          />
        );
      })}
      {(() => {
        const w = (noneCount / total) * 100;
        if (w < 0.5) return null;
        return (
          <div
            className="h-full transition-all"
            style={{ width: `${w}%`, backgroundColor: "#1a1d26" }}
            title={`none: ${Math.round(w)}%`}
          />
        );
      })()}
    </div>
  );
}

// ── Delta badge ─────────────────────────────────────────────────────────────
function Delta({ v, suffix = "%" }: { v: number; suffix?: string }) {
  const pos = v >= 0;
  return (
    <span className={`text-[10px] font-bold ${pos ? "text-green-400" : "text-red-400"}`}>
      {pos ? "+" : ""}{v.toFixed(1)}{suffix}
    </span>
  );
}

// ── Single metric column ────────────────────────────────────────────────────
function MetricColumn({
  label,
  beforeVal,
  afterVal,
  total,
  color,
  unit = "%",
  isPercent = true,
}: {
  label: string;
  beforeVal: number;
  afterVal: number;
  total?: number;
  color: string;
  unit?: string;
  isPercent?: boolean;
}) {
  const eff = total ?? 100;
  const delta = afterVal - beforeVal;
  const afterPct  = isPercent ? afterVal  : (eff > 0 ? (afterVal  / eff) * 100 : 0);

  return (
    <div className="flex flex-col items-center gap-1 min-w-0">
      <div className="text-[8px] uppercase tracking-[0.1em] text-[#3a4158] text-center leading-tight">
        {label}
      </div>

      <div className="relative flex items-center justify-center">
        <DonutChart value={afterPct} color={color} size={52} strokeWidth={5} />
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-[10px] font-bold text-white" style={{ transform: "rotate(90deg)" }}>
            {isPercent ? Math.round(afterVal) : afterVal}/{isPercent ? 100 : eff}
          </span>
        </div>
      </div>

      <div className="flex flex-col items-center">
        <Delta v={delta} suffix={unit} />
        <span className="text-[7px] text-[#3a4158]">
          {isPercent ? `${Math.round(beforeVal)}% → ${Math.round(afterVal)}%` : `${beforeVal} → ${afterVal}`}
        </span>
      </div>
    </div>
  );
}

export function BeforeAfterTab() {
  const snapshots = useStudioStore((s) => s.snapshots);

  if (snapshots.length < 2) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 text-center px-8">
        <GitCompare className="w-8 h-8 text-[#1e2130]" />
        <div>
          <div className="text-[11px] text-[#4a5568] font-medium">No comparison available</div>
          <div className="text-[9px] text-[#3a4158] mt-1">
            Save at least 2 snapshots to compare before/after states.
          </div>
        </div>
      </div>
    );
  }

  const before = snapshots[snapshots.length - 2]!;
  const after  = snapshots[snapshots.length - 1]!;
  const bSim   = before.simulation as SimulationResult | undefined;
  const aSim   = after.simulation  as SimulationResult | undefined;
  const outcomeDelta = buildSecurityOutcomeDelta(bSim ?? null, aSim ?? null);

  const bCov    = bSim?.totalCoveragePct ?? 0;
  const aCov    = aSim?.totalCoveragePct ?? 0;

  // Recognition & identification zone counts: cells with quality >= threshold
  const countQuality = (sim: SimulationResult | undefined, q: string) => {
    const threshold = qualityToScore(q as Parameters<typeof qualityToScore>[0]);
    return (sim?.coverageCells ?? []).filter((c) => qualityToScore(c.quality) >= threshold).length;
  };

  const bRecog  = countQuality(bSim, "recognition");
  const aRecog  = countQuality(aSim, "recognition");
  const bIdent  = countQuality(bSim, "identification");
  const aIdent  = countQuality(aSim, "identification");

  const bCritPass = bSim?.criticalZoneResults.filter((z) => z.status === "pass").length ?? 0;
  const aCritPass = aSim?.criticalZoneResults.filter((z) => z.status === "pass").length ?? 0;
  const critTotal = Math.max(
    bSim?.criticalZoneResults.length ?? 0,
    aSim?.criticalZoneResults.length ?? 0,
    1,
  );

  const totalCells = Math.max(
    (bSim?.coverageCells ?? []).length,
    (aSim?.coverageCells ?? []).length,
    1,
  );

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header strip */}
      <div className="flex items-center gap-3 px-3 py-1 border-b border-[#1e2130] flex-shrink-0">
        <span className="text-[8px] font-semibold uppercase tracking-[0.14em] text-[#4a5568]">
          Key Metrics Comparison
        </span>
        <div className="flex gap-2 ml-auto">
          <span className="text-[8px] text-[#5a6478] flex items-center gap-1">
            <span className="w-2 h-0.5 bg-[#4a5568] rounded inline-block" />
            {before.label}
          </span>
          <span className="text-[8px] text-blue-400 flex items-center gap-1">
            <span className="w-2 h-0.5 bg-blue-400 rounded inline-block" />
            {after.label}
          </span>
        </div>
      </div>

      {/* Metric donuts row */}
      <div className="flex items-start justify-around px-4 py-2 border-b border-[#1e2130] flex-shrink-0">
        <MetricColumn
          label="Total Coverage"
          beforeVal={bCov}
          afterVal={aCov}
          color="#4ade80"
        />
        <div className="w-px h-12 bg-[#1e2130] self-center" />
        <MetricColumn
          label="Recognition Cells"
          beforeVal={bRecog}
          afterVal={aRecog}
          total={totalCells}
          color="#60a5fa"
          unit=""
          isPercent={false}
        />
        <div className="w-px h-12 bg-[#1e2130] self-center" />
        <MetricColumn
          label="Identification Cells"
          beforeVal={bIdent}
          afterVal={aIdent}
          total={totalCells}
          color="#a78bfa"
          unit=""
          isPercent={false}
        />
        <div className="w-px h-12 bg-[#1e2130] self-center" />
        <MetricColumn
          label="Critical Zones"
          beforeVal={bCritPass}
          afterVal={aCritPass}
          total={critTotal}
          color="#f97316"
          unit=""
          isPercent={false}
        />
      </div>
      {outcomeDelta ? (
        <div className="border-b border-[#1e2130] px-3 py-1.5 text-[9px] text-[#8ea0bf]">
          Outcome Delta: Blindspot {Math.round((bSim?.blindspotPct ?? 0))}% {"->"} {Math.round((aSim?.blindspotPct ?? 0))}% ·
          Critical Zones {outcomeDelta.criticalZonesPassingBefore}/{outcomeDelta.criticalZonesTotal} {"->"} {outcomeDelta.criticalZonesPassingAfter}/{outcomeDelta.criticalZonesTotal}
        </div>
      ) : null}

      {/* Quality distribution bars */}
      <div className="flex-1 overflow-hidden px-3 py-2 flex gap-3 min-h-0">
        {/* Before */}
        <div className="flex-1 flex flex-col gap-1.5 min-w-0">
          <span className="text-[8px] font-medium uppercase tracking-wider text-[#3a4158]">
            {before.label} — Quality Distribution
          </span>
          <QualityBar result={bSim} />
          <div className="flex gap-2 flex-wrap">
            {[
              { q: "identification", color: "#4ade80" },
              { q: "recognition",    color: "#60a5fa" },
              { q: "observation",    color: "#facc15" },
              { q: "detection",      color: "#fb923c" },
            ].map(({ q, color }) => {
              const cnt  = countQuality(bSim, q);
              const tot  = (bSim?.coverageCells ?? []).length;
              const pct  = tot > 0 ? Math.round((cnt / tot) * 100) : 0;
              return (
                <span key={q} className="flex items-center gap-1 text-[8px] text-[#5a6478]">
                  <span className="w-1.5 h-1.5 rounded-sm" style={{ backgroundColor: color }} />
                  {q.slice(0, 5)}: {pct}%
                </span>
              );
            })}
          </div>
          {/* Mini summary stats */}
          <div className="mt-1 grid grid-cols-2 gap-x-3 gap-y-0.5 text-[8px]">
            <span className="text-[#3a4158]">Issues</span>
            <span className="text-[#8090a8]">{bSim?.issues.length ?? 0}</span>
            <span className="text-[#3a4158]">Blindspot</span>
            <span className="text-[#8090a8]">{Math.round(bSim?.blindspotPct ?? 0)}%</span>
          </div>
        </div>

        <div className="w-px bg-[#1e2130] self-stretch flex-shrink-0" />

        {/* After */}
        <div className="flex-1 flex flex-col gap-1.5 min-w-0">
          <span className="text-[8px] font-medium uppercase tracking-wider text-blue-400/70">
            {after.label} — Quality Distribution
          </span>
          <QualityBar result={aSim} />
          <div className="flex gap-2 flex-wrap">
            {[
              { q: "identification", color: "#4ade80" },
              { q: "recognition",    color: "#60a5fa" },
              { q: "observation",    color: "#facc15" },
              { q: "detection",      color: "#fb923c" },
            ].map(({ q, color }) => {
              const cnt  = countQuality(aSim, q);
              const tot  = (aSim?.coverageCells ?? []).length;
              const pct  = tot > 0 ? Math.round((cnt / tot) * 100) : 0;
              return (
                <span key={q} className="flex items-center gap-1 text-[8px] text-[#5a6478]">
                  <span className="w-1.5 h-1.5 rounded-sm" style={{ backgroundColor: color }} />
                  {q.slice(0, 5)}: {pct}%
                </span>
              );
            })}
          </div>
          <div className="mt-1 grid grid-cols-2 gap-x-3 gap-y-0.5 text-[8px]">
            <span className="text-[#3a4158]">Issues</span>
            <span className={`${(aSim?.issues.length ?? 0) < (bSim?.issues.length ?? 0) ? "text-green-400" : "text-[#8090a8]"}`}>
              {aSim?.issues.length ?? 0}
              {bSim && aSim && aSim.issues.length !== bSim.issues.length &&
                <span className="ml-1 text-[7px] text-[#4a5568]">
                  ({aSim.issues.length < bSim.issues.length ? "↓" : "↑"}{Math.abs(aSim.issues.length - bSim.issues.length)})
                </span>
              }
            </span>
            <span className="text-[#3a4158]">Blindspot</span>
            <span className={`${(aSim?.blindspotPct ?? 0) < (bSim?.blindspotPct ?? 0) ? "text-green-400" : "text-[#8090a8]"}`}>
              {Math.round(aSim?.blindspotPct ?? 0)}%
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
