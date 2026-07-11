import { UI_SURFACES } from "@/lib/studio-surface-tokens";

export default function StudioLoading() {
  return (
    <div className={`flex h-screen items-center justify-center UI_SURFACES.page UI_SURFACES.textSoftMuted`}>
      <div className="rounded-xl border UI_SURFACES.borderDeep UI_SURFACES.bgDeep px-4 py-3 text-[11px] uppercase tracking-[0.28em] text-sky-100">
        Loading Studio
      </div>
    </div>
  );
}
