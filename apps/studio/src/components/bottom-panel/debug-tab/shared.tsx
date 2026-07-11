"use client";

import { UI_SURFACES } from "@/lib/studio-surface-tokens";

export const OVERLAY_DENSITY_OPTIONS = [
  { value: "all", label: "All" },
  { value: "compact", label: "Compact" },
  { value: "minimal", label: "Minimal" },
] as const;

export function Section({
  title,
  icon,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className={`rounded-xl border UI_SURFACES.borderSubtle UI_SURFACES.panel p-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.02)]`}>
      <div className={`mb-2 flex items-center gap-1.5 text-[9px] font-semibold uppercase tracking-[0.18em] UI_SURFACES.textDimMid`}>
        {icon}
        {title}
      </div>
      {children}
    </div>
  );
}

export function PillButton({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-md border px-2 py-1 text-[9px] transition-colors ${
        active
          ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
          : `UI_SURFACES.borderPanel UI_SURFACES.bgDeep UI_SURFACES.textMuted5 UI_SURFACES.hoverBorder hover:text-white`
      }`}
    >
      {children}
    </button>
  );
}
