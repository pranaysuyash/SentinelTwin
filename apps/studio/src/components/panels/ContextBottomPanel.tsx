"use client";

import { BottomPanel } from "@/components/bottom-panel/BottomPanel";
import { BottomRow } from "@/components/bottom-row/BottomRow";
import { UI_SURFACES } from "@/lib/studio-surface-tokens";

export function ContextBottomPanel({ sizePx }: { sizePx: number }) {
  // Show BottomRow when there's enough vertical space (≥ 320px gives BottomPanel + BottomRow)
  const showSecondary = sizePx >= 320;

  return (
    <div className={`flex h-full min-h-0 flex-col overflow-hidden UI_SURFACES.panel`}>
      <div className="min-h-0 flex-1 overflow-hidden">
        <div className="flex h-full min-h-0 flex-col overflow-hidden">
          <div className={showSecondary ? "h-[180px] min-h-0 overflow-hidden" : "min-h-0 flex-1 overflow-hidden"}>
            <BottomPanel />
          </div>

          {showSecondary && (
            <div className={`flex-1 min-h-0 overflow-hidden border-t UI_SURFACES.borderPanel`}>
              <BottomRow />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
