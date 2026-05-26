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
  const [collapsed, setCollapsed] = useState(false);
  const assumptions = scene.assumptions;

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
          <Field label="Person Height">
            <span className="font-mono">{assumptions.personHeightM.toFixed(2)}m</span>
          </Field>
          <Field label="Vehicle Height">
            <span className="font-mono">{assumptions.vehicleHeightM.toFixed(2)}m</span>
          </Field>
          <Field label="Time of Day">
            <span className="capitalize">{assumptions.timeOfDay}</span>
          </Field>
          <Field label="Interior Light">
            <span className="capitalize">{assumptions.interiorLightLevel}</span>
          </Field>
          <Field label="DORI Standard">
            <span>{assumptions.doriStandard === "iec62676" ? "IEC 62676-4:2025" : "Simplified"}</span>
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

          {/* Note about editing */}
          <div className="mt-1.5 flex items-center gap-1.5 rounded-md border border-amber-500/15 bg-amber-500/8 px-2 py-1.5">
            <Info className="h-3 w-3 flex-shrink-0 text-amber-400" />
            <span className="text-[8px] leading-tight text-amber-200">
              Add assumptions editing UI in settings. These values are set per scene in the JSON schema.
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
