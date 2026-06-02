"use client";

import { HideSectionButton } from "@/components/launcher/HideSectionButton";

function formatDoriStandard(standard: "dori_2014" | "oodpcvs_2025" | "simplified" | (string & {})) {
  if (standard === "oodpcvs_2025") return "OODPCVS (7-level)";
  if (standard === "dori_2014") return "DORI 2014 (4-level)";
  if (standard === "simplified") return "Simplified PPM";
  return "Simplified PPM";
}

type SceneAssumptions = {
  doriStandard: string;
  personHeightM: number;
  timeOfDay: string;
  nightPenaltyMode: string;
};

export type SimulationAssumptionsPanelProps = {
  sceneAssumptions: SceneAssumptions;
  onOpenStudio: () => void;
  onHide: () => void;
};

export function SimulationAssumptionsPanel({
  sceneAssumptions,
  onOpenStudio,
  onHide,
}: SimulationAssumptionsPanelProps) {
  return (
    <div className="rounded-[16px] border border-[color:var(--st-border)] bg-[color:var(--st-panel)] p-3">
      <div className="flex items-center justify-between">
        <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#8b96ab]">SIMULATION ASSUMPTIONS</div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={onOpenStudio} className="text-[10px] text-sky-300 hover:text-sky-200">Edit</button>
          <HideSectionButton label="simulation assumptions" onClick={onHide} />
        </div>
      </div>
      <div className="mt-2 space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-[#8b96ab]">DORI Model</span>
          <span className="text-[10px] font-medium text-[#c5cde0]">{formatDoriStandard(sceneAssumptions.doriStandard)}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-[#8b96ab]">Person Height</span>
          <span className="text-[10px] font-medium text-[#c5cde0]">{sceneAssumptions.personHeightM} m</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-[#8b96ab]">Lighting</span>
          <span className="text-[10px] font-medium text-[#c5cde0]">{sceneAssumptions.timeOfDay === "night" ? "Night Mode" : sceneAssumptions.timeOfDay === "custom" ? "Custom" : "Day Mode"}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-[#8b96ab]">Grid Resolution</span>
          <span className="text-[10px] font-medium text-[#c5cde0]">0.25 m</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-[#8b96ab]">Glass Handling</span>
          <span className="text-[10px] font-medium text-[#c5cde0]">{sceneAssumptions.nightPenaltyMode === "none" ? "Standard" : "Adjusted"}</span>
        </div>
      </div>
      <button type="button" onClick={onOpenStudio} className="mt-3 w-full text-center text-[10px] text-[#8b96ab] hover:text-white transition-colors">
        View all assumptions
      </button>
    </div>
  );
}
