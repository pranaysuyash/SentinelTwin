"use client";

import { Trash2 } from "lucide-react";

import {
  Field,
  SelectInput,
  TextInput,
} from "@/components/inspector/inspector-controls";
import { SectionCard } from "@/components/shared/SectionCard";
import type { PrivacyZoneNode } from "@/schema/security-scene";
import { useStudioStore } from "@/store/studio-store";

export function PrivacyZoneInspector() {
  const selectedId = useStudioStore((s) => s.selectedNodeId);
  const scene = useStudioStore((s) => s.scene);
  const updateNode = useStudioStore((s) => s.updateNode);
  const removeNode = useStudioStore((s) => s.removeNode);

  const zone = scene.privacyZones.find((entry) => entry.id === selectedId);
  if (!zone) return null;

  return (
    <>
      <div className="border-b border-[#1e2130] px-3 py-3">
        <div className="text-[12px] font-semibold text-white">{zone.label}</div>
        <div className="text-[9px] uppercase tracking-[0.18em] text-[#556076]">Privacy Zone</div>
      </div>

      <div className="flex-1 space-y-2.5 overflow-y-auto px-3 py-3">
        <SectionCard title="Properties">
          <SelectInput
            label="Restriction"
            value={zone.restriction}
            options={[
              { value: "no_video", label: "No Video" },
              { value: "restricted_view", label: "Restricted View" },
              { value: "blindspot_required", label: "Blindspot Required" },
            ]}
            onChange={(value) => updateNode(zone.id, { restriction: value as PrivacyZoneNode["restriction"] })}
          />
          <Field label="Vertices" value={zone.polygon.length} />
          <label className="block rounded-lg border border-[#1f2536] bg-[#111521] px-2 py-1.5">
            <div className="mb-1 flex items-center justify-between gap-2">
              <span className="text-[8px] uppercase tracking-[0.16em] text-[#556076]">Regulation</span>
            </div>
            <input
              type="text"
              value={zone.regulation}
              onChange={(event) => updateNode(zone.id, { regulation: event.target.value })}
              className="w-full bg-transparent text-right font-mono text-[11px] text-[#d2d9e8] outline-none focus-visible:ring-2 focus-visible:ring-[#60a5fa]/50"
              placeholder="manual"
            />
          </label>
        </SectionCard>
      </div>

      <div className="border-t border-[#1e2130] px-3 py-3">
        <button
          type="button"
          onClick={() => removeNode(zone.id)}
          className="flex h-8 w-full items-center justify-center gap-1.5 rounded-lg border border-red-900/30 bg-red-950/15 text-[10px] font-medium text-red-400 transition-colors hover:border-red-700 hover:bg-red-950/30"
        >
          <Trash2 className="h-3 w-3" />
          Delete Privacy Zone
        </button>
      </div>
    </>
  );
}
