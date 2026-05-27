"use client";

import { qualityBadgeClasses, QUALITY_ABBR, QUALITY_LABEL } from "@/lib/quality-display";
import type { DoriQuality } from "@/schema/security-scene";

interface QualityBadgeProps {
  quality: DoriQuality;
  /** "abbr" shows 2-3 char code, "label" shows full word, "quality" shows raw value (default) */
  display?: "abbr" | "label" | "quality";
  className?: string;
}

export function QualityBadge({ quality, display = "quality", className }: QualityBadgeProps) {
  const c = qualityBadgeClasses(quality);
  const text =
    display === "abbr" ? QUALITY_ABBR[quality] :
    display === "label" ? QUALITY_LABEL[quality] :
    quality;

  return (
    <span
      className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[8px] font-semibold uppercase tracking-wider ${c.bg} ${c.text} ${className ?? ""}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${c.dot}`} />
      {text}
    </span>
  );
}
