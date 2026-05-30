import { useMemo } from "react";

import { MAP_COLORS } from "@/components/map/map-colors";
import { samplePathQuality, groupPathQualitySamples } from "@/components/map/path-quality";
import type { CoverageCellLike } from "@/components/map/map-geometry";
import type { PathQualityBand, PathQualitySample } from "@/components/map/path-quality";
import type { ScenarioPath } from "@/schema/security-scene";

type CoverageRibbonProps = {
  path: ScenarioPath | null;
  coverageCells: CoverageCellLike[];
  stepM?: number;
};

function formatBandLabel(band: PathQualityBand) {
  return `${band.quality.toUpperCase()} (${band.startDistanceM.toFixed(1)}-${band.endDistanceM.toFixed(1)}m)`;
}

export function CoverageRibbon({ path, coverageCells, stepM = 0.25 }: CoverageRibbonProps) {
  const samples = useMemo<PathQualitySample[]>(() => {
    if (!path) return [];
    return samplePathQuality(path, coverageCells, stepM);
  }, [path, coverageCells, stepM]);

  const bands = useMemo(() => groupPathQualitySamples(samples), [samples]);

  const totalDistance = samples.length > 1 ? samples[samples.length - 1]!.distanceM : 0;

  if (!path || totalDistance <= 0 || bands.length === 0) {
    return <div className="text-[10px] text-[#556076]">No quality samples for this path.</div>;
  }

  return (
    <div className="space-y-1">
      <div className="flex h-3 overflow-hidden rounded-full border border-[#202536] bg-[#111521]">
        {bands.map((band) => {
          const widthPct = totalDistance > 0
            ? ((band.endDistanceM - band.startDistanceM) / totalDistance) * 100
            : 0;

          return (
            <div
              key={`${band.startDistanceM}-${band.endDistanceM}`}
              className="h-full"
              style={{
                width: `${Math.max(widthPct, 1)}%`,
                backgroundColor: MAP_COLORS.quality[band.quality] ?? MAP_COLORS.quality.none,
                opacity: band.quality === "none" ? 0.82 : 0.95,
              }}
              title={
                `${formatBandLabel(band)} • cameras: ${band.coveringCameras.length > 0 ? band.coveringCameras.join(", ") : "none"}`
              }
            />
          );
        })}
      </div>
      <div className="mt-1 flex items-center justify-between text-[8px] uppercase tracking-[0.16em] text-[#556076]">
        <span>Entry</span>
        <span>{(totalDistance / path.speedMps).toFixed(1)}s total</span>
      </div>
    </div>
  );
}
