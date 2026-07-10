"use client";

import { TOOL_GHOST_COLORS, TOOL_LABELS } from "@/lib/tool-constants";
import { useStudioStore } from "@/store/studio-store";

import { UI_SURFACES } from "@/lib/studio-surface-tokens";
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
      <div className={`absolute bottom-2 left-1/2 z-10 flex -translate-x-1/2 items-center gap-2 rounded-lg border ${UI_SURFACES.borderSubtle} ${UI_SURFACES.panel}/80 px-3 py-1`}>
        <span className="text-[8px]" style={{ color }}>◉ {toolLabel}</span>
        <span className={`text-[8px] ${UI_SURFACES.textDim}`}>•</span>
        <span className={`text-[8px] ${UI_SURFACES.textMuted}`}>Click floor to place</span>
        <span className={`text-[8px] ${UI_SURFACES.textDim}`}>•</span>
        <span className={`text-[8px] ${UI_SURFACES.textMuted}`}>Press {toolShortcut[activeTool] ?? "Esc"} or Esc to cancel</span>
      </div>
    );
  }

  return (
    <div className={`absolute bottom-2 left-1/2 z-10 flex -translate-x-1/2 items-center gap-2 rounded-lg border ${UI_SURFACES.borderSubtle} ${UI_SURFACES.panel}/80 px-3 py-1`}>
      <span className={`text-[8px] ${UI_SURFACES.textMuted}`}>Left: Orbit</span>
      <span className={`text-[8px] ${UI_SURFACES.textDim}`}>•</span>
      <span className={`text-[8px] ${UI_SURFACES.textMuted}`}>Middle: Pan</span>
      <span className={`text-[8px] ${UI_SURFACES.textDim}`}>•</span>
      <span className={`text-[8px] ${UI_SURFACES.textMuted}`}>Right: Zoom</span>
      <span className={`text-[8px] ${UI_SURFACES.textDim}`}>•</span>
      <span className={`text-[8px] ${UI_SURFACES.textMuted}`}>Right-click: Object actions</span>
      <span className={`text-[8px] ${UI_SURFACES.textDim}`}>•</span>
      <span className={`text-[8px] ${UI_SURFACES.textMuted}`}>Scroll: Zoom</span>
      <span className={`text-[8px] ${UI_SURFACES.textDim}`}>•</span>
      <span className={`text-[8px] ${UI_SURFACES.textMuted}`}>Shift+drag: Box select</span>
    </div>
  );
}
