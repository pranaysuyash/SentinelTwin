"use client";

import { TOOL_GHOST_COLORS, TOOL_LABELS } from "@/lib/tool-constants";
import { useStudioStore } from "@/store/studio-store";

export function ControlHintBar() {
  const activeTool = useStudioStore((s) => s.activeTool);

  if (activeTool !== "select") {
    const toolLabel = TOOL_LABELS[activeTool] ?? "Place";
    const color = TOOL_GHOST_COLORS[activeTool] ?? TOOL_GHOST_COLORS.default;
    const toolShortcut: Record<string, string> = {
      camera: "C",
      obstruction: "B",
      light: "L",
      sensor: "Y",
      wall: "W",
      zone: "Z",
      door_window: "D",
      path: "P",
      measure: "M",
      comment: "T",
    };
    return (
      <div className="absolute bottom-2 left-1/2 z-10 flex -translate-x-1/2 items-center gap-2 rounded-lg border border-[#1f2536] bg-[#0b0f17]/80 px-3 py-1">
        <span className="text-[8px]" style={{ color }}>◉ {toolLabel}</span>
        <span className="text-[8px] text-[#2a3246]">•</span>
        <span className="text-[8px] text-[#4a5568]">Click floor to place</span>
        <span className="text-[8px] text-[#2a3246]">•</span>
        <span className="text-[8px] text-[#4a5568]">Press {toolShortcut[activeTool] ?? "Esc"} or Esc to cancel</span>
      </div>
    );
  }

  return (
    <div className="absolute bottom-2 left-1/2 z-10 flex -translate-x-1/2 items-center gap-2 rounded-lg border border-[#1f2536] bg-[#0b0f17]/80 px-3 py-1">
      <span className="text-[8px] text-[#4a5568]">Left: Orbit</span>
      <span className="text-[8px] text-[#2a3246]">•</span>
      <span className="text-[8px] text-[#4a5568]">Middle: Pan</span>
      <span className="text-[8px] text-[#2a3246]">•</span>
      <span className="text-[8px] text-[#4a5568]">Right: Zoom</span>
      <span className="text-[8px] text-[#2a3246]">•</span>
      <span className="text-[8px] text-[#4a5568]">Right-click: Object actions</span>
      <span className="text-[8px] text-[#2a3246]">•</span>
      <span className="text-[8px] text-[#4a5568]">Scroll: Zoom</span>
      <span className="text-[8px] text-[#2a3246]">•</span>
      <span className="text-[8px] text-[#4a5568]">Shift+drag: Box select</span>
    </div>
  );
}
