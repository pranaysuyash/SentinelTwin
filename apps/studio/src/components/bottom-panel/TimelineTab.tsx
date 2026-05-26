"use client";

import { Play, SkipBack } from "lucide-react";
import { useStudioStore } from "@/store/studio-store";

export function TimelineTab() {
  const result = useStudioStore((s) => s.simulationResult);
  const scene  = useStudioStore((s) => s.scene);

  if (!result) {
    return (
      <div className="flex items-center justify-center h-full text-[#3a4158] text-[11px]">
        Run simulation to see timeline
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Controls */}
      <div className="flex items-center gap-2 px-3 py-1.5 border-b border-[#1e2130]">
        <button className="flex items-center justify-center w-6 h-6 rounded bg-[#1a1d26] hover:bg-[#1e2235] transition-colors">
          <SkipBack className="w-3 h-3 text-[#68738a]" />
        </button>
        <button className="flex items-center justify-center w-6 h-6 rounded bg-[#1a1d26] hover:bg-[#1e2235] transition-colors">
          <Play className="w-3 h-3 text-[#68738a]" />
        </button>
        <div className="flex-1 h-1 bg-[#1a1d26] rounded-full overflow-hidden">
          <div className="w-1/3 h-full bg-green-500/60 rounded-full" />
        </div>
        <span className="text-[9px] font-mono text-[#4a5568]">Static Preview</span>
      </div>

      {/* Path results table */}
      <div className="flex-1 overflow-y-auto px-2 py-1.5">
        {result.pathResults.length === 0 ? (
          <div className="text-center text-[#3a4158] text-[10px] py-4">No path results - add paths in the scene</div>
        ) : (
          <table className="w-full text-[10px] border-collapse">
            <thead>
              <tr className="text-[8px] text-[#3a4158] uppercase tracking-wider">
                <th className="text-left py-1 pr-3">Path</th>
                <th className="text-right py-1 pr-3">Visible</th>
                <th className="text-right py-1 pr-3">Lost</th>
                <th className="text-left py-1">Events</th>
              </tr>
            </thead>
            <tbody>
              {result.pathResults.map((pr) => {
                const path = scene.paths.find((p) => p.id === pr.pathId);
                const visiblePct = pr.totalDurationS > 0
                  ? Math.round((pr.visibleDurationS / pr.totalDurationS) * 100)
                  : 0;
                return (
                  <tr key={pr.pathId} className="border-t border-[#181b26] hover:bg-[#0d0f17]">
                    <td className="py-1.5 pr-3 text-[#8090a8]">{path?.label ?? pr.pathId}</td>
                    <td className="py-1.5 pr-3 text-right">
                      <span className={visiblePct >= 80 ? "text-green-400" : visiblePct >= 50 ? "text-yellow-400" : "text-red-400"}>
                        {visiblePct}%
                      </span>
                    </td>
                    <td className="py-1.5 pr-3 text-right text-[#8090a8]">{pr.lostDurationS.toFixed(1)}s</td>
                    <td className="py-1.5">
                      <div className="flex flex-wrap gap-1">
                        {pr.timeline.slice(0, 4).map((evt, i) => (
                          <span key={i} className={`px-1 rounded text-[8px] ${
                            evt.event === "visible" ? "bg-green-900/30 text-green-300"
                              : evt.event === "lost" ? "bg-red-900/30 text-red-300"
                              : "bg-[#1a1d26] text-[#68738a]"
                          }`}>
                            {evt.event}@{evt.timeS.toFixed(0)}s
                          </span>
                        ))}
                        {pr.timeline.length > 4 && (
                          <span className="text-[8px] text-[#3a4158]">+{pr.timeline.length - 4}</span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
