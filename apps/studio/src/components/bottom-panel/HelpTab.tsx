"use client";

export function HelpTab() {
  return (
    <div className="h-full overflow-y-auto p-3 text-[12px] text-[#c9d5eb]">
      <div className="rounded-xl border border-[#222b3f] bg-[#0d1220] p-3">
        <div className="text-[12px] font-semibold text-white">Quick Start</div>
        <ol className="mt-2 space-y-1 text-[11px] text-[#9fb0ce]">
          <li>1. Place or select cameras in Map or Camera View.</li>
          <li>2. Press <kbd className="rounded border border-[#2a3248] bg-[#11182a] px-1">Ctrl/Cmd + Enter</kbd> to run simulation.</li>
          <li>3. Open <span className="text-[#d7e4ff]">Security Outcome</span> to review failures and fixes.</li>
          <li>4. Use <span className="text-[#d7e4ff]">Preview Fix</span> then compare before/after.</li>
        </ol>
      </div>

      <div className="mt-3 rounded-xl border border-[#222b3f] bg-[#0d1220] p-3">
        <div className="text-[12px] font-semibold text-white">Domain Terms</div>
        <div className="mt-2 space-y-1 text-[11px] text-[#9fb0ce]">
          <div><span className="text-[#d7e4ff]">DORI/OODPCVS:</span> Quality thresholds for what a camera can reliably see.</div>
          <div><span className="text-[#d7e4ff]">Fragility:</span> How close coverage is to failing with small scene changes.</div>
          <div><span className="text-[#d7e4ff]">Redundancy:</span> Whether a zone still passes when one camera goes offline.</div>
        </div>
      </div>

      <div className="mt-3 rounded-xl border border-[#222b3f] bg-[#0d1220] p-3">
        <div className="text-[12px] font-semibold text-white">Recovery Guidance</div>
        <ul className="mt-2 space-y-1 text-[11px] text-[#9fb0ce]">
          <li>• Import error: validate JSON structure and re-import.</li>
          <li>• Low night score: add light coverage or enable IR-capable camera.</li>
          <li>• Single-point failure: reorient/add backup camera for critical zone.</li>
        </ul>
      </div>
    </div>
  );
}
