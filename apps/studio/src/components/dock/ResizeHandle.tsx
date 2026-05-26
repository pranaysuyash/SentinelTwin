"use client";

import { useEffect, useRef } from "react";

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
  const dragRef = useRef<{
    startX: number;
    startY: number;
    startSize: number;
  } | null>(null);

  useEffect(() => {
    if (!dragRef.current) return;

    const handleMove = (event: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag) return;

      const delta = side === "bottom"
        ? drag.startY - event.clientY
        : side === "left"
          ? event.clientX - drag.startX
          : drag.startX - event.clientX;

      onResize(drag.startSize + delta);
    };

    const handleUp = () => {
      dragRef.current = null;
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
    };

    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);

    return () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
    };
  }, [onResize, side]);

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
        dragRef.current = {
          startX: event.clientX,
          startY: event.clientY,
          startSize: sizePx,
        };
      }}
      className={`absolute z-20 rounded-full transition-colors hover:bg-blue-400/18 active:bg-blue-400/28 ${orientationClass}`}
    />
  );
}
