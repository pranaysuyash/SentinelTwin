import type { SecurityOutcomeModel } from "@/lib/security-outcome/security-outcome-model";
import type { SimulationResult } from "@/schema/security-scene";

export function PathOutcomeReview({
  pathOutcome,
  pathResults,
}: {
  pathOutcome: SecurityOutcomeModel["pathOutcome"];
  pathResults: SimulationResult["pathResults"];
}) {
  const result = pathOutcome ?? null;
  return (
    <section className="rounded-xl border border-[#1f2536] bg-[#0b0f17] p-3">
      <h3 className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#8ea0bf]">Path / Incident Replay Outcome</h3>
      {!result ? <div className="mt-2 text-[10px] text-[#7384a5]">Select a path to inspect visibility and loss windows.</div> : null}
      {result ? (
        <div className="mt-2 text-[10px] text-[#d7deed]">
          {result.pathLabel}: duration {result.totalDurationS.toFixed(1)}s, visible {result.visibleDurationS.toFixed(1)}s, lost {result.lostDurationS.toFixed(1)}s
        </div>
      ) : null}
      {pathResults.length > 0 ? <div className="mt-1 text-[10px] text-[#7384a5]">Defensive coverage-failure analysis only; no evasion guidance.</div> : null}
    </section>
  );
}
