import { UI_SURFACES } from "@/lib/studio-surface-tokens";

export default function StudioLoading() {
  return (
    <div className={`flex h-screen items-center justify-center bg-[#030611] ${UI_SURFACES.textSoftMuted}`}>
      <div className="rounded-xl border border-[#1f2a3d] bg-[#0b1020] px-4 py-3 text-[11px] uppercase tracking-[0.28em] text-sky-100">
        Loading Studio
      </div>
    </div>
  );
}
