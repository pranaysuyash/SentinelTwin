"use client";

import { HelpCircle } from "lucide-react";
import { useState } from "react";

export function ExplainBadge({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative inline-flex items-center">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex h-4 w-4 items-center justify-center rounded border border-[#2a3248] bg-[#121826] text-[#8ea2c8] hover:text-white"
        aria-label="Explain this panel"
        title="Explain this panel"
      >
        <HelpCircle className="h-3 w-3" />
      </button>
      {open ? (
        <div className="absolute right-0 top-5 z-30 w-56 rounded-md border border-[#2a3248] bg-[#0d1220] p-2 text-[10px] text-[#c9d7f0] shadow-xl">
          {text}
        </div>
      ) : null}
    </div>
  );
}
