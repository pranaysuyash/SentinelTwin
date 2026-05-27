"use client";

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  color?: string;
}

export function StatCard({ icon, label, value, color }: StatCardProps) {
  return (
    <div className="rounded-xl border border-[#1f2536] bg-[#0b0f17] p-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.02)]">
      <div className="flex items-center gap-2">
        <div className={color ?? "text-[#556076]"}>
          {icon}
        </div>
        <div>
          <div className={`text-[13px] font-semibold font-mono ${color ?? "text-[#d7deed]"}`}>{value}</div>
          <div className="text-[8px] uppercase tracking-[0.18em] text-[#556076]">{label}</div>
        </div>
      </div>
    </div>
  );
}
