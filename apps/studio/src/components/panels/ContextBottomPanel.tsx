"use client";

import { BottomPanel } from "@/components/bottom-panel/BottomPanel";
import { BottomRow } from "@/components/bottom-row/BottomRow";
import { useStudioStore } from "@/store/studio-store";

export function ContextBottomPanel({ sizePx }: { sizePx: number }) {
  const workspacePreset = useStudioStore((s) => s.workspacePreset);
  const showSupportingRow = sizePx >= 336 || workspacePreset === "focus";

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-[#0c0f16]">
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="min-h-0 flex-1 overflow-hidden">
          <BottomPanel />
        </div>
        {showSupportingRow ? (
          <div className="flex-shrink-0 overflow-hidden border-t border-[#1e2130]">
            <BottomRow />
          </div>
        ) : null}
      </div>
    </div>
  );
}
