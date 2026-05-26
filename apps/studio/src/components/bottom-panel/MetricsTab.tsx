"use client";

import { useStudioStore } from "@/store/studio-store";
import { DonutChart } from "@/components/shared/DonutChart";
import { Badge } from "@/components/shared/Badge";

function MetricCard({ label, children, className = "" }: {
  label: string; children: React.ReactNode; className?: string;
}) {
  return (
    <div className={`flex flex-col items-center justify-between px-3 py-2.5 border-r border-[#1e2130] min-w-0 ${className}`}>
      <div className="text-[9px] text-[#4a5568] font-medium tracking-wide uppercase mb-2 text-center w-full">
        {label}
      </div>
      {children}
    </div>
  );
}

export function MetricsTab() {
  const result = useStudioStore((s) => s.simulationResult);
  const scene  = useStudioStore((s) => s.scene);

  if (!result) {
    return (
      <div className="flex items-center justify-center h-full text-[#3a4158] text-[11px]">
        Run simulation to see metrics
      </div>
    );
  }

  const activeCams = scene.cameras.filter((c) => c.status === "on").length;
  const offlineCams = scene.cameras.filter((c) => c.status !== "on").length;
  const zonesPass = result.criticalZoneResults.filter((z) => z.status === "pass").length;
  const zonesTotal = result.criticalZoneResults.length;

  const qualityScore = result.averageWalkableQuality;
  const qualityLabel = qualityScore >= 3 ? "RECOGNITION"
    : qualityScore >= 2 ? "OBSERVATION"
    : qualityScore >= 1 ? "DETECTION"
    : "NONE";
  const qualityColor = qualityScore >= 3 ? "#22c55e" : qualityScore >= 2 ? "#eab308" : "#f97316";

  const worstQuality = result.worstAreaQuality;
  const worstColor = worstQuality === "none" ? "#ef4444" : worstQuality === "detection" ? "#f97316" : "#eab308";
  const worstLabel = worstQuality === "none" ? "NO COVERAGE" : worstQuality.toUpperCase();

  // Find obstruction near worst area
  const hasBlockage = result.issues.some((i) => i.category === "blindspot");
  const blockageLabel = hasBlockage ? "Near Cupboard" : "—";

  // Coverage donut color: orange/detection range
  const coverageColor = result.totalCoveragePct > 80 ? "#22c55e"
    : result.totalCoveragePct > 60 ? "#f97316"
    : "#ef4444";

  return (
    <div className="grid h-full" style={{gridTemplateColumns: "repeat(7, minmax(0, 1fr))"}}>
      {/* 1: Overall Coverage */}
      <MetricCard label="Overall Coverage (Detection)">
        <DonutChart
          value={result.totalCoveragePct}
          size={72}
          strokeWidth={7}
          color={coverageColor}
          label={`${Math.round(result.totalCoveragePct)}%`}
          sublabel="Walkable Area"
        />
        <div className="mt-1 text-[9px] text-green-400 font-medium">+6% vs last run</div>
      </MetricCard>

      {/* 2: Critical Zones */}
      <MetricCard label="Critical Zones">
        <div className="text-center">
          <div className="text-[28px] font-bold text-white leading-none">
            {zonesPass}<span className="text-[16px] text-[#4a5568]">/{zonesTotal}</span>
          </div>
          <div className="text-[9px] text-[#68738a] mt-0.5">Zones Passing</div>
          {result.criticalZoneResults.map((z) => (
            <div key={z.zoneId} className="mt-2">
              <div className="text-[9px] text-[#8090a8] mb-0.5">{z.label}</div>
              <Badge variant={z.status === "pass" ? "green" : "red"}>
                {z.status === "pass" ? "PASS" : "FAILS"}
              </Badge>
            </div>
          ))}
        </div>
      </MetricCard>

      {/* 3: Cameras */}
      <MetricCard label="Cameras">
        <div className="text-center">
          <div className="text-[28px] font-bold text-white leading-none">{activeCams}</div>
          <div className="text-[9px] text-green-400 mt-0.5">Active</div>
          {offlineCams > 0 && (
            <>
              <div className="text-[18px] font-bold text-[#ef4444] mt-1 leading-none">{offlineCams}</div>
              <div className="text-[9px] text-[#ef4444] mt-0.5">Offline</div>
            </>
          )}
          {offlineCams === 0 && (
            <div className="text-[9px] text-[#4a5568] mt-1">0 Offline</div>
          )}
        </div>
      </MetricCard>

      {/* 4: Average Quality */}
      <MetricCard label="Average Quality (Walkable)">
        <DonutChart
          value={(qualityScore / 4) * 100}
          size={72}
          strokeWidth={7}
          color={qualityColor}
          label={qualityScore.toFixed(1)}
          sublabel={qualityLabel}
        />
        {scene.criticalZones[0] && (
          <div className="mt-1 text-[9px] text-[#68738a]">
            Target: <span className="text-[#c0c8da] font-semibold">
              {scene.criticalZones[0].requiredQuality.toUpperCase()}
            </span>
          </div>
        )}
      </MetricCard>

      {/* 5: Worst Area Quality */}
      <MetricCard label="Worst Area Quality">
        <div className="text-center">
          <div className="text-[28px] font-bold leading-none" style={{ color: worstColor }}>1</div>
          <div className="mt-1 text-[10px] font-bold tracking-wide" style={{ color: worstColor }}>
            {worstLabel}
          </div>
          <div className="text-[9px] text-[#68738a] mt-1">{blockageLabel}</div>
        </div>
      </MetricCard>

      {/* 6: Recognition Area */}
      <MetricCard label="Recognition Area">
        <div className="text-center">
          <div className="text-[28px] font-bold text-[#22c55e] leading-none">
            {Math.round(result.recognitionAreaPct)}%
          </div>
          <div className="text-[9px] text-[#68738a] mt-1">of Walkable Area</div>
        </div>
      </MetricCard>

      {/* 7: Identification Area */}
      <MetricCard label="Identification Area">
        <div className="text-center">
          <div className="text-[28px] font-bold text-[#3b82f6] leading-none">
            {Math.round(result.identificationAreaPct)}%
          </div>
          <div className="text-[9px] text-[#68738a] mt-1">of Walkable Area</div>
        </div>
      </MetricCard>
    </div>
  );
}
