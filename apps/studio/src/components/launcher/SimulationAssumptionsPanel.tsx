"use client";

import { HideSectionButton } from "@/components/launcher/HideSectionButton";
import { UI_SURFACES } from "@/lib/studio-surface-tokens";

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
  pixelsPerMeter: {
    detection: number;
    observation: number;
    recognition: number;
    identification: number;
  };
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
        <div className={`text-[10px] font-bold uppercase tracking-[0.2em] UI_SURFACES.textSoftBright`}>SIMULATION ASSUMPTIONS</div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={onOpenStudio} className="text-[10px] text-sky-300 hover:text-sky-200">Edit</button>
          <HideSectionButton label="simulation assumptions" onClick={onHide} />
        </div>
      </div>
      <div className="mt-2 space-y-1.5">
        <div className="flex items-center justify-between">
          <span className={`text-[10px] UI_SURFACES.textSoftBright`}>DORI Model</span>
          <span className={`text-[10px] font-medium UI_SURFACES.textBody`}>{formatDoriStandard(sceneAssumptions.doriStandard)}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className={`text-[10px] UI_SURFACES.textSoftBright`}>Person Height</span>
          <span className={`text-[10px] font-medium UI_SURFACES.textBody`}>{sceneAssumptions.personHeightM} m</span>
        </div>
        <div className="flex items-center justify-between">
          <span className={`text-[10px] UI_SURFACES.textSoftBright`}>Lighting</span>
          <span className={`text-[10px] font-medium UI_SURFACES.textBody`}>{sceneAssumptions.timeOfDay === "night" ? "Night Mode" : sceneAssumptions.timeOfDay === "custom" ? "Custom" : "Day Mode"}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className={`text-[10px] UI_SURFACES.textSoftBright`}>Grid Resolution</span>
          <span className={`text-[10px] font-medium UI_SURFACES.textBody`}>{sceneAssumptions.pixelsPerMeter.detection} / {sceneAssumptions.pixelsPerMeter.observation} / {sceneAssumptions.pixelsPerMeter.recognition} / {sceneAssumptions.pixelsPerMeter.identification} PPM</span>
        </div>
        <div className="flex items-center justify-between">
          <span className={`text-[10px] UI_SURFACES.textSoftBright`}>Glass Handling</span>
          <span className={`text-[10px] font-medium UI_SURFACES.textBody`}>{sceneAssumptions.nightPenaltyMode === "none" ? "Standard" : "Adjusted"}</span>
        </div>
      </div>
      <button type="button" onClick={onOpenStudio} className={`mt-3 w-full text-center text-[10px] UI_SURFACES.textSoftBright hover:text-white transition-colors`}>
        View all assumptions
      </button>
    </div>
  );
}
