"use client";

import type { DockSide } from "@/store/studio-store";

export function ResizeHandle({
  side,
  sizePx,
  onResize,
}: {
  side: DockSide;
  sizePx: number;
  onResize: (sizePx: number) => void;
}) {
  const orientationClass = side === "bottom"
    ? "left-0 right-0 top-0 h-1.5 cursor-ns-resize"
    : side === "left"
      ? "right-0 top-0 bottom-0 w-1.5 cursor-ew-resize"
      : "left-0 top-0 bottom-0 w-1.5 cursor-ew-resize";

  return (
    <button
      type="button"
    aria-label={`Resize ${side} dock`}
    onPointerDown={(event) => {
      event.preventDefault();
      const dragStart = {
        startX: event.clientX,
        startY: event.clientY,
        startSize: sizePx,
      };

      const handleMove = (moveEvent: PointerEvent) => {
        const delta = side === "bottom"
          ? dragStart.startY - moveEvent.clientY
          : side === "left"
            ? moveEvent.clientX - dragStart.startX
            : dragStart.startX - moveEvent.clientX;

        onResize(dragStart.startSize + delta);
      };

      const handleUp = () => {
        window.removeEventListener("pointermove", handleMove);
        window.removeEventListener("pointerup", handleUp);
      };

      window.addEventListener("pointermove", handleMove);
      window.addEventListener("pointerup", handleUp);
    }}
    className={`absolute z-20 rounded-full transition-colors hover:bg-blue-400/18 active:bg-blue-400/28 ${orientationClass}`}
  />
);
}
