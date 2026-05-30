"use client";

import { Copy, GitCompare } from "lucide-react";
import { useCallback, useState } from "react";
import { DonutChart } from "@/components/shared/DonutChart";
import { QualityBar } from "@/components/shared/QualityBar";
import { buildSecurityOutcomeDelta } from "@/lib/security-outcome/security-outcome-model";
import { buildCompareShareLink } from "@/lib/compare-share-link";
import { useStudioStore } from "@/store/studio-store";
import type { SimulationResult } from "@/schema/security-scene";
import { qualityToScore } from "@/simulation/dori";
import { QUALITY_COLOR } from "@/lib/quality-display";

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
  const compareVisualEvidence = useStudioStore((s) => s.compareVisualEvidence);
  const compareReportSelection = useStudioStore((s) => s.compareReportSelection);
  const setCompareReportSelection = useStudioStore((s) => s.setCompareReportSelection);
  const setViewMode = useStudioStore((s) => s.setViewMode);
  const [beforeSnapshotId, setBeforeSnapshotId] = useState<string | null>(null);
  const [afterSnapshotId, setAfterSnapshotId] = useState<string | null>(null);

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

  const validBeforeId = beforeSnapshotId && snapshots.some((snapshot) => snapshot.id === beforeSnapshotId)
    ? beforeSnapshotId
    : compareReportSelection?.snapshotAId && snapshots.some((snapshot) => snapshot.id === compareReportSelection.snapshotAId)
      ? compareReportSelection.snapshotAId
      : null;
  const validAfterId = afterSnapshotId && snapshots.some((snapshot) => snapshot.id === afterSnapshotId)
    ? afterSnapshotId
    : compareReportSelection?.snapshotBId && snapshots.some((snapshot) => snapshot.id === compareReportSelection.snapshotBId)
      ? compareReportSelection.snapshotBId
      : null;
  const seededCompareSelection = compareReportSelection?.snapshotAId === validBeforeId && compareReportSelection?.snapshotBId === validAfterId
    ? compareReportSelection
    : null;
  const before = validBeforeId ? snapshots.find((snapshot) => snapshot.id === validBeforeId) ?? null : null;
  const after = validAfterId ? snapshots.find((snapshot) => snapshot.id === validAfterId) ?? null : null;
  const bSim = before?.simulation as SimulationResult | undefined;
  const aSim = after?.simulation as SimulationResult | undefined;
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
  const compareSelectionProvenanceNote = seededCompareSelection?.provenanceNote ?? null;

  const visuals = compareVisualEvidence &&
    compareVisualEvidence.snapshotAId === (before?.id ?? "") &&
    compareVisualEvidence.snapshotBId === (after?.id ?? "") &&
    compareVisualEvidence.capturedAt >= Math.max(before?.createdAt ?? 0, after?.createdAt ?? 0)
    ? {
          beforeImageDataUrl: compareVisualEvidence.beforeImageDataUrl,
          afterImageDataUrl: compareVisualEvidence.afterImageDataUrl,
        }
    : null;
  const handleCopyCompareLink = useCallback(async () => {
    if (!before || !after) return;
    const link = buildCompareShareLink(
      window.location.origin + window.location.pathname,
      window.location.search,
      {
        compareSnapshotAId: before.id,
        compareSnapshotBId: after.id,
        compareMode: "beforeafter",
        compareProvenanceNote: compareSelectionProvenanceNote,
      },
      window.location.hash,
    );
    await navigator.clipboard.writeText(link);
  }, [before, after, compareSelectionProvenanceNote]);

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
            {before?.label ?? "Before"}
          </span>
          <span className="text-[8px] text-blue-400 flex items-center gap-1">
            <span className="w-2 h-0.5 bg-blue-400 rounded inline-block" />
            {after?.label ?? "After"}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 border-b border-[#1e2130] bg-[#0a0d14] px-3 py-2">
        <label className="flex items-center gap-2 text-[9px] uppercase tracking-[0.16em] text-[#556076]">
          <span className="min-w-[48px] text-[#9aa6bf]">Before</span>
          <select
            value={validBeforeId ?? ""}
            onChange={(event) => setBeforeSnapshotId(event.target.value)}
            className="min-w-0 flex-1 rounded-md border border-[#24283a] bg-[#111521] px-2 py-1 text-[10px] font-medium text-[#d2d9e8] outline-none"
          >
            <option value="" disabled>
              Select snapshot
            </option>
            {snapshots.map((snapshot) => (
              <option key={snapshot.id} value={snapshot.id}>
                {snapshot.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2 text-[9px] uppercase tracking-[0.16em] text-[#556076]">
          <span className="min-w-[48px] text-[#d2f5db]">After</span>
          <select
            value={validAfterId ?? ""}
            onChange={(event) => setAfterSnapshotId(event.target.value)}
            className="min-w-0 flex-1 rounded-md border border-[#24283a] bg-[#111521] px-2 py-1 text-[10px] font-medium text-[#d2d9e8] outline-none"
          >
            <option value="" disabled>
              Select snapshot
            </option>
            {snapshots.map((snapshot) => (
              <option key={snapshot.id} value={snapshot.id}>
                {snapshot.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="flex items-center justify-between gap-2 border-b border-[#1e2130] px-3 py-1.5 text-[9px] text-[#6b7894]">
        <span>
          Seeded by Scene Intelligence or the compare picker. Copy the link to share this exact before/after pair.
        </span>
        <button
          type="button"
          onClick={handleCopyCompareLink}
          disabled={!before || !after}
          className="inline-flex items-center gap-1 rounded border border-[#24283a] bg-[#111521] px-2 py-1 text-[9px] font-medium text-[#8090a8] transition-colors hover:border-[#32384d] hover:text-white disabled:opacity-40"
        >
          <Copy className="h-3 w-3" />
          Copy compare link
        </button>
      </div>
      <div className="border-b border-[#1e2130] px-3 py-1.5 text-[9px] text-[#74809a]">
        {compareSelectionProvenanceNote ? (
          <span>Compare provenance: {compareSelectionProvenanceNote}</span>
        ) : (
          <span>Scene Intelligence can seed the exact/derived checkpoint provenance for this pair.</span>
        )}
      </div>

      {!before || !after ? (
        <div className="border-b border-[#1e2130] px-3 py-2 text-[9px] text-[#6b7894]">
          Select both snapshots to populate the before/after comparison. Scene Intelligence can seed this panel with a checkpoint pair now.
        </div>
      ) : null}

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

      {/* Visual diff summary */}
      <div className="border-b border-[#1e2130] px-3 py-2">
        <div className="mb-2 flex items-center gap-2">
          <div className="text-[8px] font-semibold uppercase tracking-[0.14em] text-[#4a5568]">
            Visual Diff
          </div>
          <button
            type="button"
            onClick={() => {
              if (!before || !after) return;
              setCompareReportSelection({
                snapshotAId: before.id,
                snapshotBId: after.id,
                provenanceNote: compareSelectionProvenanceNote,
              });
              setViewMode("compare");
            }}
            disabled={!before || !after}
            className="ml-auto rounded border border-[#273246] bg-[#111521] px-2 py-1 text-[8px] font-semibold text-[#d7deed] transition-colors hover:border-sky-400/30 hover:text-white"
          >
            Open Compare View
          </button>
        </div>
        {visuals ? (
          <div className="grid grid-cols-2 gap-2">
            {[
              { label: before?.label ?? "Before", src: visuals.beforeImageDataUrl, accent: "Before" },
              { label: after?.label ?? "After", src: visuals.afterImageDataUrl, accent: "After" },
            ].map((entry) => (
              <div key={entry.accent} className="rounded-lg border border-[#1e2130] bg-[#0b0f17] p-2">
                <div className="mb-1 text-[8px] uppercase tracking-[0.14em] text-[#4a5568]">{entry.accent}: {entry.label}</div>
                <img
                  src={entry.src}
                  alt={`${entry.accent} comparison evidence`}
                  className="aspect-[4/3] w-full rounded-md border border-[#232a3d] object-cover"
                />
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-[#263048] bg-[#0b0f17] px-3 py-2 text-[9px] text-[#6b7894]">
            Capture visual evidence in Compare View to show side-by-side scene thumbnails here. The metric diff is always available, and the visual diff reuses the same compare evidence pipeline.
          </div>
        )}
      </div>

      {/* Quality distribution bars */}
      <div className="flex-1 overflow-hidden px-3 py-2 flex gap-3 min-h-0">
        {/* Before */}
        <div className="flex-1 flex flex-col gap-1.5 min-w-0">
          <span className="text-[8px] font-medium uppercase tracking-wider text-[#3a4158]">
            {before?.label ?? "Before"} — Quality Distribution
          </span>
          <QualityBar cells={bSim?.coverageCells} />
          <div className="flex gap-2 flex-wrap">
            {(["identification", "recognition", "observation", "detection"] as const).map((q) => {
              const cnt  = countQuality(bSim, q);
              const tot  = (bSim?.coverageCells ?? []).length;
              const pct  = tot > 0 ? Math.round((cnt / tot) * 100) : 0;
              return (
                <span key={q} className="flex items-center gap-1 text-[8px] text-[#5a6478]">
                  <span className="w-1.5 h-1.5 rounded-sm" style={{ backgroundColor: QUALITY_COLOR[q] }} />
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
            {after?.label ?? "After"} — Quality Distribution
          </span>
          <QualityBar cells={aSim?.coverageCells} />
          <div className="flex gap-2 flex-wrap">
            {(["identification", "recognition", "observation", "detection"] as const).map((q) => {
              const cnt  = countQuality(aSim, q);
              const tot  = (aSim?.coverageCells ?? []).length;
              const pct  = tot > 0 ? Math.round((cnt / tot) * 100) : 0;
              return (
                <span key={q} className="flex items-center gap-1 text-[8px] text-[#5a6478]">
                  <span className="w-1.5 h-1.5 rounded-sm" style={{ backgroundColor: QUALITY_COLOR[q] }} />
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
