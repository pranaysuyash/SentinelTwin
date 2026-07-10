"use client";

import { cn } from "@/lib/cn";
import { qualityToScore } from "@sentineltwin/core";
import type { DoriQuality } from "@/schema/security-scene";
import { UI_SURFACES } from "@/lib/studio-surface-tokens";

interface QualitySegment {
  minScore: number;
  maxScore: number;
  label: string;
  color: string;
}

const DEFAULT_SEGMENTS: QualitySegment[] = [
  { minScore: 6, maxScore: 7, label: "identification", color: "#4ade80" },
  { minScore: 5, maxScore: 5, label: "recognition", color: "#60a5fa" },
  { minScore: 3, maxScore: 4, label: "observation", color: "#facc15" },
  { minScore: 1, maxScore: 2, label: "detection", color: "#fb923c" },
];

export interface CellQuality {
  quality: DoriQuality;
}

export interface QualityBarProps {
  cells?: CellQuality[];
  segments?: QualitySegment[];
  className?: string;
}

export function QualityBar({ cells, segments = DEFAULT_SEGMENTS, className }: QualityBarProps) {
  if (!cells || cells.length === 0) {
    return <div className={cn("h-3 rounded-sm ${UI_SURFACES.chip}", className)} />;
  }

  const total = cells.length;

  return (
    <div className={cn("flex h-3 w-full gap-px overflow-hidden rounded", className)}>
      {segments.map(({ minScore, maxScore, label, color }) => {
        const count = cells.filter((c) => {
          const s = qualityToScore(c.quality);
          return s >= minScore && s <= maxScore;
        }).length;
        const w = (count / total) * 100;
        if (w < 0.5) return null;
        return (
          <div
            key={label}
            className="h-full transition-[width]"
            style={{ width: `${w}%`, backgroundColor: color }}
            title={`${label}: ${Math.round(w)}%`}
          />
        );
      })}
      {(() => {
        const noneCount = cells.filter((c) => qualityToScore(c.quality) === 0).length;
        const w = (noneCount / total) * 100;
        if (w < 0.5) return null;
        return (
          <div
            className="h-full transition-[width]"
            style={{ width: `${w}%`, backgroundColor: "#1a1d26" }}
            title={`none: ${Math.round(w)}%`}
          />
        );
      })()}
    </div>
  );
}
