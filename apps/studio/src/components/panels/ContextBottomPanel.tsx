"use client";

import { BottomPanel } from "@/components/bottom-panel/BottomPanel";
import { BottomRow } from "@/components/bottom-row/BottomRow";

export function ContextBottomPanel({ sizePx }: { sizePx: number }) {
  // Show BottomRow when there's enough vertical space (≥ 320px gives BottomPanel + BottomRow)
  const showSecondary = sizePx >= 320;

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-[#0c0f16]">
      <div className="min-h-0 flex-1 overflow-hidden">
        <div className="flex h-full min-h-0 flex-col overflow-hidden">
          <div className={showSecondary ? "h-[180px] min-h-0 overflow-hidden" : "min-h-0 flex-1 overflow-hidden"}>
            <BottomPanel />
          </div>

          {showSecondary && (
            <div className="flex-1 min-h-0 overflow-hidden border-t border-[#1e2130]">
              <BottomRow />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
