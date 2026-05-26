"use client";

const QUALITY_LEVELS = [
  { label: "Identification", range: "250+", detail: "250+ PPM", color: "#3b82f6" },
  { label: "Recognition", range: "125-250", detail: "125-250 PPM", color: "#22c55e" },
  { label: "Observation", range: "62.5-125", detail: "62.5-125 PPM", color: "#eab308" },
  { label: "Detection", range: "25-62.5", detail: "25-62.5 PPM", color: "#f97316" },
  { label: "No Coverage", range: "<25", detail: "<25 PPM", color: "#ef4444" },
];

export function CoverageLegend() {
  return (
    <div className="absolute left-3 top-3 z-10 min-w-[182px] rounded-xl border border-[#1f2536] bg-[#0b0f17]/90 px-3 py-2.5 shadow-[0_16px_40px_rgba(0,0,0,0.28)] backdrop-blur-sm">
      <div className="mb-2 text-[9px] font-semibold uppercase tracking-[0.22em] text-[#5b667c]">
        Coverage Quality (PPM)
      </div>
      <div className="space-y-1.5">
        {QUALITY_LEVELS.map(({ label, range, detail, color }) => (
          <div key={label} className="flex items-start gap-2">
            <span className="mt-0.5 h-3 w-3 flex-shrink-0 rounded-sm" style={{ backgroundColor: color, opacity: 0.9 }} />
            <div className="min-w-0 flex-1 leading-none">
              <div className="text-[10px] text-[#c7d0e4]">{range}</div>
              <div className="mt-1 text-[8px] text-[#647089]">{label} · {detail}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
