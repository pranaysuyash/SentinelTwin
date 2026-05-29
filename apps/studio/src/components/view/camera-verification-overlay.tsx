"use client";

import Image from "next/image";

import type { VerificationViewMode } from "@/components/view/camera-verification-utils";

export function FootageVerificationOverlay({
  imageUrl,
  mode,
  opacity,
  split,
  offsetX,
  offsetY,
  scale,
}: {
  imageUrl: string;
  mode: VerificationViewMode;
  opacity: number;
  split: number;
  offsetX: number;
  offsetY: number;
  scale: number;
}) {
  const commonStyle = {
    transform: `translate(${offsetX}px, ${offsetY}px) scale(${scale})`,
    transformOrigin: "center center",
  } as const;

  if (mode === "split") {
    return (
      <>
        <div className="pointer-events-none absolute inset-0" style={{ clipPath: `inset(0 ${100 - split}% 0 0)` }}>
          <Image
            src={imageUrl}
            alt="Reference footage frame"
            fill
            unoptimized
            sizes="100vw"
            className="object-cover"
            style={{ ...commonStyle, opacity: Math.min(0.95, Math.max(0.15, opacity + 0.05)) }}
          />
        </div>
        <div className="pointer-events-none absolute inset-y-0" style={{ left: `${split}%` }}>
          <div className="h-full w-px bg-cyan-300/80 shadow-[0_0_10px_rgba(34,211,238,0.8)]" />
        </div>
      </>
    );
  }

  return (
    <div className="pointer-events-none absolute inset-0">
      <Image
        src={imageUrl}
        alt="Reference footage frame"
        fill
        unoptimized
        sizes="100vw"
        className="object-cover"
        style={{ ...commonStyle, opacity }}
      />
    </div>
  );
}
