import type { SimulationAssumptions } from "@/schema/security-scene";

export function AssumptionDisclosure({ assumptions }: { assumptions: SimulationAssumptions }) {
  return (
    <section className="rounded-xl border border-[#1f2536] bg-[#0b0f17] p-3">
      <h3 className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#8ea0bf]">Evidence and Assumptions</h3>
      <div className="mt-2 text-[10px] text-[#d7deed]">
        {assumptions.doriStandard === "oodpcvs_2025" ? "OODPCVS 2025" : "DORI 2014"} · Person {assumptions.personHeightM}m · Grid {assumptions.pixelsPerMeter.detection > 0 ? "configured" : "n/a"} · Time {assumptions.timeOfDay}
      </div>
      <div className="mt-1 text-[10px] text-[#7384a5]">Simulation outputs are planning indicators under stated assumptions, not forensic guarantees.</div>
    </section>
  );
}
