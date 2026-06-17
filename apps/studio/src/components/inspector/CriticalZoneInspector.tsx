"use client";

import { Camera, Shield, Trash2 } from "lucide-react";

import { NumberInput, TextInput } from "@/components/inspector/inspector-controls";
import { Badge } from "@/components/shared/Badge";
import { SectionCard } from "@/components/shared/SectionCard";
import { cn } from "@/lib/cn";
import { getTargetRequirementInfo } from "@/lib/target-quality-requirements";
import type { CriticalZoneNode } from "@/schema/security-scene";
import { useStudioStore } from "@/store/studio-store";

const TARGET_TYPE_LABELS: Record<CriticalZoneNode["targetType"], string> = {
  person_detection: "Person Detection",
  face_recognition: "Face Recognition",
  face_identification: "Face ID",
  vehicle_detection: "Vehicle Detection",
  license_plate: "License Plate",
  package_detection: "Package Detection",
  cash_counter_activity: "Cash Counter",
  door_entry_exit: "Door Entry/Exit",
  perimeter_breach: "Perimeter Breach",
};

const QUALITY_BADGE_COLORS: Record<string, string> = {
  identification: "bg-blue-900/40 text-blue-300",
  recognition:    "bg-green-900/40 text-green-300",
  observation:    "bg-yellow-900/40 text-yellow-300",
  detection:      "bg-orange-900/40 text-orange-300",
  none:           "bg-red-900/40 text-red-400",
};

export function CriticalZoneInspector() {
  const selectedId = useStudioStore((s) => s.selectedNodeId);
  const scene = useStudioStore((s) => s.scene);
  const result = useStudioStore((s) => s.simulationResult);
  const updateNode = useStudioStore((s) => s.updateNode);
  const removeNode = useStudioStore((s) => s.removeNode);

  const zone = scene.criticalZones.find((z) => z.id === selectedId);
  if (!zone) return null;

  const zoneResult = result?.criticalZoneResults.find((r) => r.zoneId === zone.id);
  const coveringCameras = zoneResult?.coveringCameras ?? [];
  const isPassing = zoneResult?.status === "pass";
  const isPartial = zoneResult?.status === "partial";
  const camNames: Record<string, string> = Object.fromEntries(scene.cameras.map((c) => [c.id, c.name]));
  const targetRequirement = getTargetRequirementInfo(zone.targetType);

  return (
    <>
      <div className="border-b border-[#1e2130] px-3 py-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl border border-emerald-500/20 bg-emerald-500/10">
              <Shield className="h-4 w-4 text-emerald-400" />
            </div>
            <div>
              <div className="text-[12px] font-semibold text-white">{zone.label}</div>
              <div className="text-[9px] uppercase tracking-[0.18em] text-[#556076]">
                {TARGET_TYPE_LABELS[zone.targetType]} · {zone.priority}
              </div>
            </div>
          </div>
          {zoneResult ? (
            <Badge variant={isPassing ? "green" : isPartial ? "amber" : "red"} dot>
              {isPassing ? "Pass" : isPartial ? "Partial" : "Fail"}
            </Badge>
          ) : (
            <Badge variant="gray">No run</Badge>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-2.5 space-y-2.5">
        <TextInput
          label="Name"
          value={zone.label}
          onChange={(value) => updateNode(zone.id, { label: value })}
        />

        <SectionCard title="Evidence Quality" helpText="Shows the required and measured camera evidence level for this zone. A pass means the current simulation meets the zone target under the active assumptions." helpTitle="Evidence quality help">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] text-[#6a748b]">Required</span>
              <span className={cn("rounded px-1.5 py-0.5 text-[9px] font-semibold capitalize", QUALITY_BADGE_COLORS[zone.requiredQuality] ?? "bg-[#1f2536] text-[#8090a8]")}>
                {zone.requiredQuality}
              </span>
            </div>
            {zoneResult && (
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] text-[#6a748b]">Actual</span>
                <span className={cn("rounded px-1.5 py-0.5 text-[9px] font-semibold capitalize", QUALITY_BADGE_COLORS[zoneResult.actualQuality] ?? "bg-[#1f2536] text-[#8090a8]")}>
                  {zoneResult.actualQuality}
                </span>
              </div>
            )}
          </div>
        </SectionCard>

        <SectionCard title="Properties" helpText="Set what this zone needs operationally: the target type, required evidence quality, priority, night requirement, and redundancy requirement." helpTitle="Zone properties help">
          <div className="flex items-center justify-between gap-2 border-b border-[#181c27] py-1.5">
            <span className="text-[10px] text-[#6a748b]">Target Type</span>
            <select
              value={zone.targetType}
              onChange={(e) => updateNode(zone.id, { targetType: e.target.value as CriticalZoneNode["targetType"] })}
              className="rounded-md border border-[#24283a] bg-[#111521] px-2 py-1 text-[9px] font-medium text-[#d2d9e8] outline-none focus-visible:ring-2 focus-visible:ring-[#60a5fa]/50 transition-colors hover:border-[#32384d]"
            >
              {(Object.keys(TARGET_TYPE_LABELS) as CriticalZoneNode["targetType"][]).map((t) => (
                <option key={t} value={t}>{TARGET_TYPE_LABELS[t]}</option>
              ))}
            </select>
          </div>
          <div className="flex items-center justify-between gap-2 border-b border-[#181c27] py-1.5">
            <span className="text-[10px] text-[#6a748b]">Required Quality</span>
            <select
              value={zone.requiredQuality}
              onChange={(e) => updateNode(zone.id, { requiredQuality: e.target.value as CriticalZoneNode["requiredQuality"] })}
              className="rounded-md border border-[#24283a] bg-[#111521] px-2 py-1 text-[9px] font-medium text-[#d2d9e8] outline-none focus-visible:ring-2 focus-visible:ring-[#60a5fa]/50 transition-colors hover:border-[#32384d]"
            >
              <option value="detection">Detection</option>
              <option value="observation">Observation</option>
              <option value="recognition">Recognition</option>
              <option value="identification">Identification</option>
            </select>
          </div>
          <div className="flex items-center justify-between gap-2 border-b border-[#181c27] py-1.5">
            <span className="text-[10px] text-[#6a748b]">Priority</span>
            <select
              value={zone.priority}
              onChange={(e) => updateNode(zone.id, { priority: e.target.value as CriticalZoneNode["priority"] })}
              className="rounded-md border border-[#24283a] bg-[#111521] px-2 py-1 text-[9px] font-medium text-[#d2d9e8] outline-none focus-visible:ring-2 focus-visible:ring-[#60a5fa]/50 transition-colors hover:border-[#32384d]"
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="critical">Critical</option>
            </select>
          </div>
          {[
            { label: "Night Coverage Required", value: zone.nightRequired, key: "nightRequired" as const },
            { label: "Redundancy Required", value: zone.redundancyRequired, key: "redundancyRequired" as const },
          ].map(({ label, value, key }) => (
            <div key={key} className="flex items-center justify-between gap-2 border-b border-[#181c27] py-1.5 last:border-0">
              <span className="text-[10px] text-[#6a748b]">{label}</span>
              <button
                type="button"
                onClick={() => updateNode(zone.id, { [key]: !value })}
                className={cn("flex h-5 w-9 flex-shrink-0 items-center rounded-full px-0.5 transition-colors", value ? "bg-blue-600/50" : "bg-[#2a3246]")}
              >
                <span className={cn("block h-4 w-4 rounded-full bg-white shadow transition-transform", value ? "translate-x-4" : "")} />
              </button>
            </div>
          ))}
          <div className="pt-1.5">
            <NumberInput
              label="Height"
              value={zone.heightM}
              min={0.5}
              step={0.1}
              unit="m"
              onChange={(value) => updateNode(zone.id, { heightM: value })}
            />
          </div>
        </SectionCard>

        <SectionCard title="Target Requirement" helpText="Explains the default evidence quality SentinelTwin expects for this type of zone, plus the detail threshold used by the simulation." helpTitle="Target requirement help">
          <div className="space-y-1.5 text-[10px] text-[#c7d0e4]">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[#6a748b]">Default quality</span>
              <span className={cn("rounded px-1.5 py-0.5 text-[9px] font-semibold capitalize", QUALITY_BADGE_COLORS[targetRequirement.defaultRequiredQuality] ?? "bg-[#1f2536] text-[#8090a8]")}>
                {targetRequirement.defaultRequiredQuality}
              </span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-[#6a748b]">PPM threshold</span>
              <span className="rounded px-1.5 py-0.5 text-[9px] font-semibold capitalize bg-[#1f2536] text-[#d2d9e8]">
                {targetRequirement.ppmThreshold}
              </span>
            </div>
            <div className="rounded-md border border-[#181c27] bg-[#0f141f] px-2 py-1.5 text-[9px] leading-relaxed text-[#8b96ab]">
              {targetRequirement.rationale}
            </div>
            {zone.requiredQuality !== targetRequirement.defaultRequiredQuality ? (
              <div className="rounded-md border border-amber-500/20 bg-amber-500/8 px-2 py-1.5 text-[9px] leading-relaxed text-amber-100">
                This zone overrides the default with <strong>{zone.requiredQuality}</strong>.
              </div>
            ) : (
              <div className="rounded-md border border-emerald-500/20 bg-emerald-500/8 px-2 py-1.5 text-[9px] leading-relaxed text-emerald-100">
                This zone uses the default target quality for its target type.
              </div>
            )}
          </div>
        </SectionCard>

        {coveringCameras.length > 0 && (
          <SectionCard title={`Covered By (${coveringCameras.length})`}>
            <div className="space-y-1">
              {coveringCameras.map((camId) => (
                <div key={camId} className="flex items-center gap-1.5 text-[10px] text-[#8090a8]">
                  <Camera className="h-3 w-3 flex-shrink-0 text-blue-400" />
                  {camNames[camId] ?? camId}
                </div>
              ))}
            </div>
          </SectionCard>
        )}

        {zoneResult && !isPassing && (
          <div className="rounded-xl border border-red-500/15 bg-red-500/5 p-2.5">
            <div className="mb-1 text-[9px] font-semibold uppercase tracking-[0.18em] text-red-400">Coverage Gap</div>
            <div className="text-[9px] leading-relaxed text-[#c7d0e4]">
              This zone requires <strong>{zone.requiredQuality}</strong> but is receiving <strong>{zoneResult.actualQuality}</strong>.
              {coveringCameras.length === 0
                ? " No camera currently covers this zone."
                : ` ${coveringCameras.length} camera${coveringCameras.length !== 1 ? "s" : ""} cover it, but quality is insufficient.`}
            </div>
          </div>
        )}

        {!result && (
          <div className="rounded-lg border border-[#1f2536] bg-[#111521] p-3 text-[10px] leading-relaxed text-[#6a748b]">
            Run simulation to see zone coverage results.
          </div>
        )}
      </div>

      <div className="border-t border-[#1e2130] px-3 py-3">
        <button
          type="button"
          onClick={() => removeNode(zone.id)}
          className="flex h-8 w-full items-center justify-center gap-1.5 rounded-lg border border-red-900/30 bg-red-950/15 text-[10px] font-medium text-red-400 transition-colors hover:border-red-700 hover:bg-red-950/30"
        >
          <Trash2 className="h-3 w-3" />
          Delete Zone
        </button>
      </div>
    </>
  );
}
