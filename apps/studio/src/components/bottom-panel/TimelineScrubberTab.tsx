import React, { useState } from "react";
import { useStudioStore } from "@/store/studio-store";
import { History, Play, RotateCcw, Clock } from "lucide-react";
import { SurfaceButton } from "@/components/shared/SurfaceButton";
import { reconstructSceneFromEvidence } from "@/lib/operational-evidence";

export function TimelineScrubberTab() {
  const { operationalEvidenceEvents, setScene } = useStudioStore();
  const [scrubIndex, setScrubIndex] = useState(operationalEvidenceEvents.length - 1);

  if (operationalEvidenceEvents.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-[11px] text-[#6a748b]">
        No operational evidence history available.
      </div>
    );
  }

  const handleScrub = (index: number) => {
    setScrubIndex(index);
  };

  const handleRestore = () => {
    const event = operationalEvidenceEvents[scrubIndex];
    if (!event) return;
    
    if (confirm(`Restore scene to state at: ${event.title}?`)) {
      const reconstructed = reconstructSceneFromEvidence(operationalEvidenceEvents, event.id);
      if (reconstructed) {
        setScene(reconstructed);
      }
    }
  };

  const currentEvent = operationalEvidenceEvents[scrubIndex];

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-[#1e2130] p-3">
        <div className="flex items-center gap-2">
          <History className="h-4 w-4 text-emerald-500" />
          <span className="text-[11px] font-semibold text-white">Temporal Operational Twin (Timeline Scrubber)</span>
        </div>
        <SurfaceButton onClick={handleRestore} disabled={scrubIndex === operationalEvidenceEvents.length - 1}>
          <RotateCcw className="h-3.5 w-3.5 mr-1" />
          Restore to this Point
        </SurfaceButton>
      </div>

      <div className="flex-1 p-4 flex flex-col gap-4 overflow-y-auto">
        <div className="bg-[#111521] border border-[#24283a] rounded-lg p-4 relative">
          <div className="mb-4 flex justify-between text-[10px] text-[#6a748b]">
            <span>Start</span>
            <span>Now</span>
          </div>
          
          <input
            type="range"
            min={0}
            max={operationalEvidenceEvents.length - 1}
            value={scrubIndex}
            onChange={(e) => handleScrub(parseInt(e.target.value))}
            className="w-full accent-emerald-500 bg-[#1e2130] rounded-full appearance-none h-1.5 cursor-pointer"
          />
          
          <div className="mt-4 pt-4 border-t border-[#1e2130] grid grid-cols-2 gap-4">
            <div>
              <div className="text-[9px] uppercase tracking-wider text-[#6a748b] mb-1">Scrubbed Event</div>
              <div className="text-[12px] font-medium text-white">{currentEvent?.title || "Unknown Event"}</div>
              <div className="text-[10px] text-[#8192b0] mt-1 flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {currentEvent ? new Date(currentEvent.timestamp).toLocaleString() : ""}
              </div>
            </div>
            <div>
              <div className="text-[9px] uppercase tracking-wider text-[#6a748b] mb-1">Details</div>
              <div className="text-[11px] text-[#c7d0e4]">{currentEvent?.details || "No details"}</div>
              <div className="text-[10px] text-[#5d6880] mt-1">Affected Nodes: {currentEvent?.affectedNodeIds.length || 0}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
