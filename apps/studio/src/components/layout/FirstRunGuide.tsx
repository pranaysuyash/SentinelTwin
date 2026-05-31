"use client";

export default function FirstRunGuide({ onClose, onOpenHelp }: { onClose: () => void; onOpenHelp: () => void }) {
  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/55 backdrop-blur-sm" onClick={onClose}>
      <div className="w-[560px] max-w-[92vw] rounded-xl border border-[#26304a] bg-[#0d111a] p-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="text-[13px] font-semibold text-white">Welcome to SentinelTwin Studio</div>
        <div className="mt-2 text-[12px] text-[#9fb0ce]">First run flow:</div>
        <ol className="mt-2 space-y-1 text-[12px] text-[#c6d3eb]">
          <li>1. Place/select cameras and assumptions.</li>
          <li>2. Run simulation with <kbd className="rounded border border-[#2a3248] bg-[#11182a] px-1">Ctrl/Cmd + Enter</kbd>.</li>
          <li>3. Open Security Outcome to review failures and causes.</li>
          <li>4. Preview Fix, compare before/after, then apply.</li>
        </ol>
        <div className="mt-3 flex items-center justify-end gap-2">
          <button type="button" onClick={onOpenHelp} className="rounded border border-[#2d3750] px-3 py-1.5 text-[11px] text-[#cfe0ff] hover:bg-[#161f31]">Open Help</button>
          <button type="button" onClick={onClose} className="rounded border border-emerald-500/35 px-3 py-1.5 text-[11px] text-emerald-300 hover:bg-emerald-500/10">Start</button>
        </div>
      </div>
    </div>
  );
}
