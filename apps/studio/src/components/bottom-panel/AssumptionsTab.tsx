"use client";

import { Info } from "lucide-react";
import { useStudioStore } from "@/store/studio-store";
import type { SimulationAssumptions, DoriQuality } from "@/schema/security-scene";
import { OODPCVS_THRESHOLDS } from "@sentineltwin/core";

const DORI_PRESETS: Record<SimulationAssumptions["doriStandard"], SimulationAssumptions["pixelsPerMeter"]> = {
  dori_2014: { detection: 25, observation: 62.5, recognition: 125, identification: 250 },
  oodpcvs_2025: { detection: 25, observation: 62.5, recognition: 125, identification: 250 },
};

const OODPCVS_DISPLAY_THRESHOLDS: { level: DoriQuality; ppm: number }[] = [
  { level: "overview", ppm: OODPCVS_THRESHOLDS.overview },
  { level: "outline", ppm: OODPCVS_THRESHOLDS.outline },
  { level: "discern", ppm: OODPCVS_THRESHOLDS.discern },
  { level: "perceive", ppm: OODPCVS_THRESHOLDS.perceive },
  { level: "characterize", ppm: OODPCVS_THRESHOLDS.characterize },
  { level: "validate", ppm: OODPCVS_THRESHOLDS.validate },
  { level: "scrutinize", ppm: OODPCVS_THRESHOLDS.scrutinize },
];

const FIELD_LABEL: Record<string, string> = {
  wallHeightM: "Wall Height (m)",
  personHeightM: "Person Height (m)",
  vehicleHeightM: "Vehicle Height (m)",
  exteriorLightLux: "Exterior Light (lux)",
};

export function AssumptionsTab() {
  const assumptions = useStudioStore((s) => s.scene.assumptions);
  const updateAssumptions = useStudioStore((s) => s.updateAssumptions);

  const update = <K extends keyof SimulationAssumptions>(key: K, val: SimulationAssumptions[K]) =>
    updateAssumptions({ [key]: val });

  const setDoriStandard = (std: SimulationAssumptions["doriStandard"]) => {
    updateAssumptions({ doriStandard: std, pixelsPerMeter: DORI_PRESETS[std] });
  };

  return (
    <div className="h-full overflow-y-auto">
      <div className="p-2 space-y-3">

        {/* Disclaimer */}
        <div className="flex gap-2 p-2 rounded-lg bg-blue-950/30 border border-blue-800/30">
          <Info className="w-3.5 h-3.5 text-blue-400 flex-shrink-0 mt-0.5" />
          <p className="text-[9px] text-blue-300/80 leading-relaxed">
            These are planning estimates, not legal or forensic guarantees. Actual camera performance
            depends on lens quality, sensor size, IR range, compression, and environmental conditions.
          </p>
        </div>

        {/* Time of Day */}
        <div>
          <div className="text-[9px] font-semibold text-[#3a4158] uppercase tracking-widest mb-1.5">Time of Day</div>
          <div className="flex gap-1">
            {(["day", "night", "custom"] as const).map((t) => (
              <button type="button"
                key={t}
                onClick={() => update("timeOfDay", t)}
                className={`flex-1 py-1 text-[10px] rounded transition-colors capitalize ${
                  assumptions.timeOfDay === t
                    ? "bg-blue-600/30 border border-blue-500/40 text-blue-300"
                    : "bg-[#0d0f17] border border-[#1e2130] text-[#59637a] hover:text-[#9da8c0]"
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        {/* Interior Light Level */}
        <div>
          <div className="text-[9px] font-semibold text-[#3a4158] uppercase tracking-widest mb-1.5">Interior Light</div>
          <div className="flex gap-1">
            {(["dark", "dim", "normal", "bright"] as const).map((lvl) => (
              <button type="button"
                key={lvl}
                onClick={() => update("interiorLightLevel", lvl)}
                className={`flex-1 py-1 text-[9px] rounded transition-colors capitalize ${
                  assumptions.interiorLightLevel === lvl
                    ? "bg-amber-600/30 border border-amber-500/40 text-amber-300"
                    : "bg-[#0d0f17] border border-[#1e2130] text-[#59637a] hover:text-[#9da8c0]"
                }`}
              >
                {lvl}
              </button>
            ))}
          </div>
        </div>

        {/* Quality Standard */}
        <div>
          <div className="text-[9px] font-semibold text-[#3a4158] uppercase tracking-widest mb-1.5">Coverage Standard</div>
          <div className="flex gap-1">
            {(["dori_2014", "oodpcvs_2025"] as const).map((std) => (
              <button type="button"
                key={std}
                onClick={() => setDoriStandard(std)}
                className={`flex-1 py-1 text-[9px] rounded transition-colors ${
                  assumptions.doriStandard === std
                    ? "bg-green-600/30 border border-green-500/40 text-green-300"
                    : "bg-[#0d0f17] border border-[#1e2130] text-[#59637a] hover:text-[#9da8c0]"
                }`}
              >
                {std === "dori_2014" ? "DORI 2014" : "IEC 62676-4:2025 (OODPCVS)"}
              </button>
            ))}
          </div>
        </div>

        {/* PPM Thresholds */}
        <div>
          <div className="text-[9px] font-semibold text-[#3a4158] uppercase tracking-widest mb-1.5">
            {assumptions.doriStandard === "oodpcvs_2025" ? "Quality Thresholds (px/m)" : "Quality Thresholds (px/m)"}
          </div>
          {assumptions.doriStandard === "oodpcvs_2025" ? (
            <div className="grid grid-cols-4 gap-1">
              <div className="col-span-4 text-[8px] text-[#4a5568] mb-1">Standard-defined IEC 62676-4:2025 (7 levels)</div>
              {OODPCVS_DISPLAY_THRESHOLDS.map(({ level, ppm }) => (
                <div key={level} className="text-center">
                  <div className="text-[8px] text-[#4a5568] capitalize mb-0.5">{level}</div>
                  <div className="text-[10px] font-mono font-semibold text-[#c0c8da] bg-[#0d0f17] border border-[#1e2130] rounded px-1 py-0.5">
                    {ppm}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-4 gap-1">
              {(["detection", "observation", "recognition", "identification"] as const).map((level) => (
                <div key={level} className="text-center">
                  <div className="text-[8px] text-[#4a5568] capitalize mb-0.5">{level}</div>
                  <div className="text-[10px] font-mono font-semibold text-[#c0c8da] bg-[#0d0f17] border border-[#1e2130] rounded px-1 py-0.5">
                    {assumptions.pixelsPerMeter[level]}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Night Penalty */}
        <div>
          <div className="text-[9px] font-semibold text-[#3a4158] uppercase tracking-widest mb-1.5">Night Penalty Mode</div>
          <div className="flex gap-1">
            {(["none", "simple", "detailed"] as const).map((mode) => (
              <button type="button"
                key={mode}
                onClick={() => update("nightPenaltyMode", mode)}
                className={`flex-1 py-1 text-[9px] rounded transition-colors capitalize ${
                  assumptions.nightPenaltyMode === mode
                    ? "bg-purple-600/30 border border-purple-500/40 text-purple-300"
                    : "bg-[#0d0f17] border border-[#1e2130] text-[#59637a] hover:text-[#9da8c0]"
                }`}
              >
                {mode}
              </button>
            ))}
          </div>
        </div>

        {/* Numeric fields */}
        <div>
          <div className="text-[9px] font-semibold text-[#3a4158] uppercase tracking-widest mb-1.5">Scene Parameters</div>
          <div className="grid grid-cols-2 gap-2">
            {(["wallHeightM", "personHeightM", "vehicleHeightM"] as const).map((field) => (
              <label key={field} className="flex flex-col gap-0.5">
                <span className="text-[8px] text-[#4a5568]">{FIELD_LABEL[field]}</span>
                <input
                  type="number"
                  step="0.1"
                  min="0.1"
                  value={assumptions[field]}
                  onChange={(e) => {
                    const v = parseFloat(e.target.value);
                    if (!isNaN(v) && v > 0) update(field, v as SimulationAssumptions[typeof field]);
                  }}
                  className="w-full bg-[#0d0f17] border border-[#1e2130] rounded px-1.5 py-0.5 text-[10px] font-mono text-[#c0c8da] focus:outline-none focus:border-blue-500/50"
                />
              </label>
            ))}
            {assumptions.timeOfDay !== "day" && (
              <label className="flex flex-col gap-0.5">
                <span className="text-[8px] text-[#4a5568]">{FIELD_LABEL.exteriorLightLux}</span>
                <input
                  type="number"
                  step="1"
                  min="0"
                  value={assumptions.exteriorLightLux ?? 0}
                  onChange={(e) => {
                    const v = parseFloat(e.target.value);
                    if (!isNaN(v) && v >= 0) update("exteriorLightLux", v);
                  }}
                  className="w-full bg-[#0d0f17] border border-[#1e2130] rounded px-1.5 py-0.5 text-[10px] font-mono text-[#c0c8da] focus:outline-none focus:border-blue-500/50"
                />
              </label>
            )}
          </div>
        </div>

        {/* Environmental Effects */}
        <div>
          <div className="text-[9px] font-semibold text-[#3a4158] uppercase tracking-widest mb-1.5">Environmental Effects</div>
          <div className="grid grid-cols-2 gap-2">
            <label className="flex flex-col gap-0.5">
              <span className="text-[8px] text-[#4a5568]">Backlight</span>
              <select
                value={assumptions.backlightIntensity ?? "none"}
                onChange={(e) => update("backlightIntensity", e.target.value as typeof assumptions.backlightIntensity)}
                className="w-full rounded border border-[#1e2130] bg-[#0d0f17] px-1.5 py-0.5 text-[10px] capitalize text-[#c0c8da] outline-none focus:border-blue-500/40"
              >
                <option value="none">None</option>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </label>
            <label className="flex flex-col gap-0.5">
              <span className="text-[8px] text-[#4a5568]">Glare</span>
              <select
                value={assumptions.glareIntensity ?? "none"}
                onChange={(e) => update("glareIntensity", e.target.value as typeof assumptions.glareIntensity)}
                className="w-full rounded border border-[#1e2130] bg-[#0d0f17] px-1.5 py-0.5 text-[10px] capitalize text-[#c0c8da] outline-none focus:border-blue-500/40"
              >
                <option value="none">None</option>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </label>
            <label className="flex items-center gap-2 col-span-2 rounded border border-[#1e2130] bg-[#0d0f17] px-2 py-1.5">
              <span className="text-[8px] text-[#4a5568]">Overexposed Zones</span>
              <input
                type="checkbox"
                checked={assumptions.overexposedZones ?? false}
                onChange={(e) => update("overexposedZones", e.target.checked)}
                className="ml-auto h-3.5 w-3.5 accent-blue-500"
              />
            </label>
          </div>
        </div>

      </div>
    </div>
  );
}
