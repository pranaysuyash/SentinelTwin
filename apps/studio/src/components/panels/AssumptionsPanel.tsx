"use client";

import { Info, Settings2 } from "lucide-react";
import { useState } from "react";

import { useStudioStore } from "@/store/studio-store";
import { UI_SURFACES } from "@/lib/studio-surface-tokens";


function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className={`flex items-center justify-between gap-3 border-b ${UI_SURFACES.borderFaint} py-2 last:border-b-0`}>
      <span className={`text-[10px] ${UI_SURFACES.textMuted2}`}>{label}</span>
      <span className={`flex items-center gap-1 text-right text-[11px] font-medium ${UI_SURFACES.textBody}`}>
        {children}
      </span>
    </div>
  );
}

const INTERIOR_LIGHT_OPTIONS = ["dark", "dim", "normal", "bright"] as const;
const NIGHT_PENALTY_OPTIONS = ["none", "simple", "detailed"] as const;
const ENV_INTENSITY_OPTIONS = ["none", "low", "medium", "high"] as const;

export function AssumptionsPanel() {
  const scene = useStudioStore((s) => s.scene);
  const updateAssumptions = useStudioStore((s) => s.updateAssumptions);
  const setBottomTab = useStudioStore((s) => s.setBottomTab);
  const [collapsed, setCollapsed] = useState(false);
  const assumptions = scene.assumptions;
  const gridResolution = `${assumptions.pixelsPerMeter.detection} / ${assumptions.pixelsPerMeter.observation}`;

  return (
    <div className={`rounded-xl border ${UI_SURFACES.borderSubtle} ${UI_SURFACES.panel} p-2.5`}>
      <button type="button"
        onClick={() => setCollapsed(!collapsed)}
        className={`mb-2 flex w-full items-center gap-1.5 text-[9px] font-semibold uppercase tracking-[0.2em] ${UI_SURFACES.textMuted}`}
      >
        <Settings2 className="h-3 w-3" />
        Simulation Assumptions
        <Info className={`ml-auto h-3 w-3 ${UI_SURFACES.textMuted}`} />
      </button>

      {!collapsed && (
        <div className="space-y-1">
          <div className={`grid grid-cols-2 gap-1.5 rounded-xl border ${UI_SURFACES.borderSubtle} ${UI_SURFACES.card} p-2`}>
            <div className={`rounded-lg border ${UI_SURFACES.borderThin} ${UI_SURFACES.panel} px-2 py-1.5`}>
              <div className={`text-[8px] uppercase tracking-[0.16em] ${UI_SURFACES.textMuted}`}>DORI Model</div>
              <div className={`mt-0.5 text-[10px] font-medium ${UI_SURFACES.textBody}`}>
                {assumptions.doriStandard === "oodpcvs_2025" ? "IEC 62676-4:2025" : "DORI 2014"}
              </div>
            </div>
            <div className={`rounded-lg border ${UI_SURFACES.borderThin} ${UI_SURFACES.panel} px-2 py-1.5`}>
              <div className={`text-[8px] uppercase tracking-[0.16em] ${UI_SURFACES.textMuted}`}>Person Height</div>
              <div className={`mt-0.5 font-mono text-[10px] font-medium ${UI_SURFACES.textBody}`}>
                {assumptions.personHeightM.toFixed(2)}m
              </div>
            </div>
            <div className={`rounded-lg border ${UI_SURFACES.borderThin} ${UI_SURFACES.panel} px-2 py-1.5`}>
              <div className={`text-[8px] uppercase tracking-[0.16em] ${UI_SURFACES.textMuted}`}>Grid Resolution</div>
              <div className={`mt-0.5 font-mono text-[10px] font-medium ${UI_SURFACES.textBody}`}>
                {gridResolution} px/m
              </div>
            </div>
            <div className={`rounded-lg border ${UI_SURFACES.borderThin} ${UI_SURFACES.panel} px-2 py-1.5`}>
              <div className={`text-[8px] uppercase tracking-[0.16em] ${UI_SURFACES.textMuted}`}>Lighting</div>
              <div className={`mt-0.5 text-[10px] font-medium capitalize ${UI_SURFACES.textBody}`}>
                {assumptions.timeOfDay === "night" ? "Night" : assumptions.timeOfDay}
              </div>
            </div>
          </div>

          <Field label="Wall Height">
            <select
              value={assumptions.wallHeightM.toString()}
              onChange={(event) => updateAssumptions({ wallHeightM: parseFloat(event.target.value) })}
              className={`rounded border ${UI_SURFACES.borderPanel} ${UI_SURFACES.card} px-1.5 py-0.5 text-[10px] ${UI_SURFACES.textBody} outline-none focus:border-blue-500/40`}
            >
              <option value="2.4">2.4m</option>
              <option value="3.0">3.0m</option>
              <option value="3.5">3.5m</option>
              <option value="4.0">4.0m</option>
              <option value="5.0">5.0m</option>
              <option value="8.0">8.0m</option>
            </select>
          </Field>

          <Field label="Person Height">
            <input
              type="number"
              min={0.5}
              max={2.5}
              step={0.05}
              value={assumptions.personHeightM}
              onChange={(event) => updateAssumptions({ personHeightM: parseFloat(event.target.value) || 1.75 })}
              className={`w-16 rounded border ${UI_SURFACES.borderPanel} ${UI_SURFACES.card} px-1.5 py-0.5 text-right font-mono text-[10px] ${UI_SURFACES.textBody} outline-none focus:border-blue-500/40`}
            />
            <span className={`text-[10px] ${UI_SURFACES.textMuted2}`}>m</span>
          </Field>
          <Field label="Vehicle Height">
            <input
              type="number"
              min={0.5}
              max={4.0}
              step={0.1}
              value={assumptions.vehicleHeightM}
              onChange={(event) => updateAssumptions({ vehicleHeightM: parseFloat(event.target.value) || 1.5 })}
              className={`w-16 rounded border ${UI_SURFACES.borderPanel} ${UI_SURFACES.card} px-1.5 py-0.5 text-right font-mono text-[10px] ${UI_SURFACES.textBody} outline-none focus:border-blue-500/40`}
            />
            <span className={`text-[10px] ${UI_SURFACES.textMuted2}`}>m</span>
          </Field>
          <Field label="Time of Day">
            <select
              value={assumptions.timeOfDay}
              onChange={(event) => updateAssumptions({ timeOfDay: event.target.value as typeof assumptions.timeOfDay })}
              className={`rounded border ${UI_SURFACES.borderPanel} ${UI_SURFACES.card} px-1.5 py-0.5 text-[10px] capitalize ${UI_SURFACES.textBody} outline-none focus:border-blue-500/40`}
            >
              <option value="day">day</option>
              <option value="night">night</option>
              <option value="custom">custom</option>
            </select>
          </Field>
          <Field label="Interior Light">
            <select
              value={assumptions.interiorLightLevel}
              onChange={(event) => updateAssumptions({ interiorLightLevel: event.target.value as typeof assumptions.interiorLightLevel })}
              className={`rounded border ${UI_SURFACES.borderPanel} ${UI_SURFACES.card} px-1.5 py-0.5 text-[10px] capitalize ${UI_SURFACES.textBody} outline-none focus:border-blue-500/40`}
            >
              {INTERIOR_LIGHT_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
          </Field>
          <Field label="Exterior Light (lux)">
            <input
              type="number"
              min={0}
              max={100000}
              step={100}
              value={assumptions.exteriorLightLux ?? 10000}
              onChange={(event) => updateAssumptions({ exteriorLightLux: parseFloat(event.target.value) || 0 })}
              className={`w-20 rounded border ${UI_SURFACES.borderPanel} ${UI_SURFACES.card} px-1.5 py-0.5 text-right font-mono text-[10px] ${UI_SURFACES.textBody} outline-none focus:border-blue-500/40`}
            />
          </Field>
          <Field label="DORI Standard">
            <select
              value={assumptions.doriStandard}
              onChange={(event) => updateAssumptions({ doriStandard: event.target.value as typeof assumptions.doriStandard })}
              className={`rounded border ${UI_SURFACES.borderPanel} ${UI_SURFACES.card} px-1.5 py-0.5 text-[10px] ${UI_SURFACES.textBody} outline-none focus:border-blue-500/40`}
            >
              <option value="oodpcvs_2025">IEC 62676-4:2025 (OODPCVS)</option>
              <option value="dori_2014">DORI 2014</option>
            </select>
          </Field>
          <Field label="Night Penalty">
            <select
              value={assumptions.nightPenaltyMode}
              onChange={(event) => updateAssumptions({ nightPenaltyMode: event.target.value as typeof assumptions.nightPenaltyMode })}
              className={`rounded border ${UI_SURFACES.borderPanel} ${UI_SURFACES.card} px-1.5 py-0.5 text-[10px] capitalize ${UI_SURFACES.textBody} outline-none focus:border-blue-500/40`}
            >
              {NIGHT_PENALTY_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
          </Field>
          <Field label="Backlight">
            <select
              value={assumptions.backlightIntensity ?? "none"}
              onChange={(event) => updateAssumptions({ backlightIntensity: event.target.value as typeof assumptions.backlightIntensity })}
              className={`rounded border ${UI_SURFACES.borderPanel} ${UI_SURFACES.card} px-1.5 py-0.5 text-[10px] capitalize ${UI_SURFACES.textBody} outline-none focus:border-blue-500/40`}
            >
              {ENV_INTENSITY_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
          </Field>
          <Field label="Glare">
            <select
              value={assumptions.glareIntensity ?? "none"}
              onChange={(event) => updateAssumptions({ glareIntensity: event.target.value as typeof assumptions.glareIntensity })}
              className={`rounded border ${UI_SURFACES.borderPanel} ${UI_SURFACES.card} px-1.5 py-0.5 text-[10px] capitalize ${UI_SURFACES.textBody} outline-none focus:border-blue-500/40`}
            >
              {ENV_INTENSITY_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
          </Field>
          <Field label="Overexposed Zones">
            <label className="relative inline-flex cursor-pointer items-center">
              <input
                type="checkbox"
                checked={assumptions.overexposedZones ?? false}
                onChange={(event) => updateAssumptions({ overexposedZones: event.target.checked })}
                className="peer sr-only"
              />
              <div className={`h-4 w-7 rounded-full border ${UI_SURFACES.borderPanel} ${UI_SURFACES.card} after:absolute after:left-[2px] after:top-[2px] after:h-3 after:w-3 after:rounded-full after:${UI_SURFACES.textMuted7} after:transition-all peer-checked:bg-blue-500/20 peer-checked:after:translate-x-full peer-checked:after:bg-blue-400`} />
            </label>
          </Field>

          {/* Pixels Per Meter thresholds */}
          <div className={`border-b ${UI_SURFACES.borderFaint} py-2 last:border-b-0`}>
            <div className={`mb-1.5 text-[10px] ${UI_SURFACES.textMuted2}`}>PPM Thresholds (px/m)</div>
            <div className="grid grid-cols-2 gap-1">
              {([
                { label: "Detection", key: "detection" as const },
                { label: "Observation", key: "observation" as const },
                { label: "Recognition", key: "recognition" as const },
                { label: "Identification", key: "identification" as const },
              ]).map(({ label, key }) => (
                <div key={key} className={`flex items-center justify-between rounded ${UI_SURFACES.card} px-2 py-1`}>
                  <span className={`text-[9px] ${UI_SURFACES.textMuted2}`}>{label}</span>
                  <input
                    type="number"
                    min={1}
                    max={1000}
                    step={1}
                    value={assumptions.pixelsPerMeter[key]}
                    onChange={(event) =>
                      updateAssumptions({
                        pixelsPerMeter: { ...assumptions.pixelsPerMeter, [key]: parseInt(event.target.value) || 25 },
                      })
                    }
                    className={`w-14 rounded border ${UI_SURFACES.borderPanel} ${UI_SURFACES.panel} px-1.5 py-0.5 text-right font-mono text-[10px] ${UI_SURFACES.textBody} outline-none focus:border-blue-500/40`}
                  />
                </div>
              ))}
            </div>
          </div>

          <button type="button"
            onClick={() => setBottomTab("assumptions")}
            className={`mt-1.5 w-full rounded-md border border-blue-500/30 bg-blue-500/10 px-2 py-1.5 text-[8px] uppercase tracking-[0.14em] text-blue-200 transition-colors hover:border-blue-400/50 ${UI_SURFACES.hoverText}`}
          >
            Open Full Assumptions Tab
          </button>
        </div>
      )}
    </div>
  );
}
