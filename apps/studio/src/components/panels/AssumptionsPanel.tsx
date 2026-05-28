"use client";

import { Info, Settings2 } from "lucide-react";
import { useState } from "react";

import { useStudioStore } from "@/store/studio-store";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-[#181c27] py-2 last:border-b-0">
      <span className="text-[10px] text-[#6a748b]">{label}</span>
      <span className="flex items-center gap-1 text-right text-[11px] font-medium text-[#d2d9e8]">
        {children}
      </span>
    </div>
  );
}

export function AssumptionsPanel() {
  const scene = useStudioStore((s) => s.scene);
  const updateAssumptions = useStudioStore((s) => s.updateAssumptions);
  const setBottomTab = useStudioStore((s) => s.setBottomTab);
  const [collapsed, setCollapsed] = useState(false);
  const assumptions = scene.assumptions;
  const gridResolution = `${assumptions.pixelsPerMeter.detection} / ${assumptions.pixelsPerMeter.observation}`;

  return (
    <div className="rounded-xl border border-[#1f2536] bg-[#0b0f17] p-2.5">
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="mb-2 flex w-full items-center gap-1.5 text-[9px] font-semibold uppercase tracking-[0.2em] text-[#4a5568]"
      >
        <Settings2 className="h-3 w-3" />
        Simulation Assumptions
        <Info className="ml-auto h-3 w-3 text-[#3a4158]" />
      </button>

      {!collapsed && (
        <div className="space-y-1">
          <div className="grid grid-cols-2 gap-1.5 rounded-xl border border-[#1f2536] bg-[#111521] p-2">
            <div className="rounded-lg border border-[#24283a] bg-[#0b0f17] px-2 py-1.5">
              <div className="text-[8px] uppercase tracking-[0.16em] text-[#556076]">DORI Model</div>
              <div className="mt-0.5 text-[10px] font-medium text-[#d2d9e8]">
                {assumptions.doriStandard === "oodpcvs_2025" ? "IEC 62676-4:2025" : "DORI 2014"}
              </div>
            </div>
            <div className="rounded-lg border border-[#24283a] bg-[#0b0f17] px-2 py-1.5">
              <div className="text-[8px] uppercase tracking-[0.16em] text-[#556076]">Person Height</div>
              <div className="mt-0.5 font-mono text-[10px] font-medium text-[#d2d9e8]">
                {assumptions.personHeightM.toFixed(2)}m
              </div>
            </div>
            <div className="rounded-lg border border-[#24283a] bg-[#0b0f17] px-2 py-1.5">
              <div className="text-[8px] uppercase tracking-[0.16em] text-[#556076]">Grid Resolution</div>
              <div className="mt-0.5 font-mono text-[10px] font-medium text-[#d2d9e8]">
                {gridResolution} px/m
              </div>
            </div>
            <div className="rounded-lg border border-[#24283a] bg-[#0b0f17] px-2 py-1.5">
              <div className="text-[8px] uppercase tracking-[0.16em] text-[#556076]">Lighting</div>
              <div className="mt-0.5 text-[10px] font-medium capitalize text-[#d2d9e8]">
                {assumptions.timeOfDay === "night" ? "Night" : assumptions.timeOfDay}
              </div>
            </div>
          </div>

          <Field label="Person Height">
            <span className="font-mono">{assumptions.personHeightM.toFixed(2)}m</span>
          </Field>
          <Field label="Vehicle Height">
            <span className="font-mono">{assumptions.vehicleHeightM.toFixed(2)}m</span>
          </Field>
          <Field label="Time of Day">
            <select
              value={assumptions.timeOfDay}
              onChange={(event) => updateAssumptions({ timeOfDay: event.target.value as typeof assumptions.timeOfDay })}
              className="rounded border border-[#1e2130] bg-[#111521] px-1.5 py-0.5 text-[10px] capitalize text-[#d2d9e8] outline-none focus:border-blue-500/40"
            >
              <option value="day">day</option>
              <option value="night">night</option>
              <option value="custom">custom</option>
            </select>
          </Field>
          <Field label="Interior Light">
            <span className="capitalize">{assumptions.interiorLightLevel}</span>
          </Field>
          <Field label="DORI Standard">
            <select
              value={assumptions.doriStandard}
              onChange={(event) => updateAssumptions({ doriStandard: event.target.value as typeof assumptions.doriStandard })}
              className="rounded border border-[#1e2130] bg-[#111521] px-1.5 py-0.5 text-[10px] text-[#d2d9e8] outline-none focus:border-blue-500/40"
            >
              <option value="oodpcvs_2025">IEC 62676-4:2025 (OODPCVS)</option>
              <option value="dori_2014">DORI 2014</option>
            </select>
          </Field>
          <Field label="Night Penalty">
            <span className="capitalize">{assumptions.nightPenaltyMode}</span>
          </Field>

          {/* Pixels Per Meter thresholds */}
          <div className="border-b border-[#181c27] py-2 last:border-b-0">
            <div className="mb-1.5 text-[10px] text-[#6a748b]">PPM Thresholds (px/m)</div>
            <div className="grid grid-cols-2 gap-1">
              {([
                { label: "Detection", key: "detection" as const },
                { label: "Observation", key: "observation" as const },
                { label: "Recognition", key: "recognition" as const },
                { label: "Identification", key: "identification" as const },
              ]).map(({ label, key }) => (
                <div key={key} className="flex items-center justify-between rounded bg-[#111521] px-2 py-1">
                  <span className="text-[9px] text-[#6a748b]">{label}</span>
                  <span className="font-mono text-[10px] text-[#d2d9e8]">
                    {assumptions.pixelsPerMeter[key]}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <button
            onClick={() => setBottomTab("assumptions")}
            className="mt-1.5 w-full rounded-md border border-blue-500/30 bg-blue-500/10 px-2 py-1.5 text-[8px] uppercase tracking-[0.14em] text-blue-200 transition-colors hover:border-blue-400/50 hover:text-white"
          >
            Edit Assumptions
          </button>
        </div>
      )}
    </div>
  );
}
