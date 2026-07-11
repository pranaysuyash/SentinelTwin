"use client";
import { UI_SURFACES } from "@/lib/studio-surface-tokens";


interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  color?: string;
}

export function StatCard({ icon, label, value, color }: StatCardProps) {
  return (
    <div className={`rounded-xl border UI_SURFACES.borderSubtle UI_SURFACES.panel p-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.02)]`}>
      <div className="flex items-center gap-2">
        <div className={color ?? "UI_SURFACES.textDimMid"}>
          {icon}
        </div>
        <div>
          <div className={`text-[13px] font-semibold font-mono ${color ?? "UI_SURFACES.textNear"}`}>{value}</div>
          <div className={`text-[8px] uppercase tracking-[0.18em] UI_SURFACES.textDimMid`}>{label}</div>
        </div>
      </div>
    </div>
  );
}
