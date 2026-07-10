"use client";

import { Html } from "@react-three/drei";
import { UI_SURFACES } from "@/lib/studio-surface-tokens";

export function CanvasLoadingOverlay({ label = "Loading scene" }: { label?: string }) {
  return (
    <Html center>
      <div className={`rounded-xl border ${UI_SURFACES.borderDark} ${UI_SURFACES.panel}/90 px-4 py-3 shadow-[0_8px_28px_rgba(0,0,0,0.42)]`}>
        <div className="flex flex-col items-center gap-2.5">
          {/* Animated scanline pattern */}
          <div className={`relative h-8 w-16 overflow-hidden rounded-md border ${UI_SURFACES.borderDark} ${UI_SURFACES.panel}`}>
            <div
              className="absolute inset-0 opacity-30"
              style={{
                backgroundImage:
                  "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(96,165,250,0.15) 2px, rgba(96,165,250,0.15) 4px)",
                animation: "scanline-scroll 1.5s linear infinite",
              }}
            />
            {/* Pulsing dot */}
            <div className="absolute left-1/2 top-1/2 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-sky-300 shadow-[0_0_6px_rgba(125,211,252,0.5)]" />
          </div>
          <span className="text-[10px] font-medium tracking-[0.06em] ${UI_SURFACES.textBody2}">{label}</span>
        </div>
      </div>
      <style>{`
        @keyframes scanline-scroll {
          0% { transform: translateY(0); }
          100% { transform: translateY(-8px); }
        }
      `}</style>
    </Html>
  );
}
