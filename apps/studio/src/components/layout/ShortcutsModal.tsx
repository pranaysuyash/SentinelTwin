"use client";

export default function ShortcutsModal({ onClose }: { onClose: () => void }) {
  const shortcuts = [
    { keys: "⌘ + N", action: "New Scene" },
    { keys: "⌘ + S", action: "Save Scene" },
    { keys: "⌘ + O", action: "Open / Import Scene" },
    { keys: "⌘ + Enter", action: "Run Simulation" },
    { keys: "Enter", action: "Complete wall / path / zone" },
    { keys: "Delete", action: "Remove selected objects" },
    { keys: "← → ↑ ↓", action: "Nudge selected objects" },
    { keys: "1 – 7", action: "Switch View Mode (Map, Camera, Wall, Replay, Compare, Report Lite, Analytics)" },
    { keys: "V", action: "Select tool" },
    { keys: "C", action: "Place Camera tool" },
    { keys: "B", action: "Place Obstruction tool" },
    { keys: "L", action: "Place Light tool" },
    { keys: "Y", action: "Place Sensor tool" },
    { keys: "P", action: "Place Path tool" },
    { keys: "Z", action: "Place Zone tool" },
    { keys: "D", action: "Place Door/Window tool" },
    { keys: "W", action: "Place Wall tool" },
    { keys: "M", action: "Measure tool" },
    { keys: "T", action: "Comment tool" },
    { keys: "R", action: "Open Report Lite" },
    { keys: "N", action: "Toggle Night Mode" },
    { keys: "F", action: "Toggle Focus Mode" },
    { keys: "S", action: "Save Snapshot" },
    { keys: "Esc", action: "Select tool / Cancel placement" },
    { keys: "?", action: "Toggle this shortcuts panel" },
  ];

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-[420px] rounded-xl border border-[#1f2536] bg-[#0d1017] p-4 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 text-[11px] font-semibold text-white">Keyboard Shortcuts</div>
        <div className="space-y-2">
          {shortcuts.map(({ keys, action }) => (
            <div key={keys} className="flex items-center justify-between">
              <span className="text-[10px] text-[#8090a8]">{action}</span>
              <kbd className="rounded border border-[#24283a] bg-[#111521] px-2 py-0.5 font-mono text-[10px] text-[#c7d0e4]">
                {keys}
              </kbd>
            </div>
          ))}
        </div>
        <p className="mt-3 text-[9px] text-[#4a5568]">Press <kbd className="rounded border border-[#24283a] bg-[#111521] px-1 font-mono text-[9px]">?</kbd> or click anywhere to close.</p>
      </div>
    </div>
  );
}
