"use client";

import { UI_SURFACES } from "@/lib/studio-surface-tokens";

export function NorthCompass() {
  return (
    <div className={`absolute right-3 top-3 z-10 flex h-10 w-10 items-center justify-center rounded-full border UI_SURFACES.borderDark UI_SURFACES.bgDeep/90`}>
      <div className="relative">
        <span className="absolute -top-3 left-1/2 -translate-x-1/2 text-[8px] font-bold text-white">N</span>
        <div className="h-5 w-0.5 rounded-full bg-gradient-to-b from-red-500 to-transparent" />
        <div className="absolute top-0 h-5 w-0.5 rotate-180 rounded-full bg-gradient-to-b from-[#4a5568] to-transparent" />
      </div>
    </div>
  );
}
