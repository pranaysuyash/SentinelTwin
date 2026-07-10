"use client";

import { Plus, Trash2, Users, MapPin } from "lucide-react";

import { useStudioStore } from "@/store/studio-store";
import type { CrowdProfile, AgentArchetype, CriticalZoneNode } from "@/schema/security-scene";
import { DEFAULT_RETAIL_ARCHETYPES } from "@sentineltwin/simulation";

import { UI_SURFACES } from "@/lib/studio-surface-tokens";
function newProfile(): CrowdProfile {
  return {
    id: `crowd_${Date.now().toString(36)}`,
    label: "New Profile",
    archetypes: [],
    enabled: true,
  };
}

function newArchetype(): AgentArchetype {
  return {
    archetypeId: `arch_${Date.now().toString(36)}`,
    label: "Person",
    bodyRadiusM: 0.3,
    heightM: 1.7,
    preferredZones: [],
    countByHour: Array(24).fill(0) as number[],
  };
}

/** Multi-select zone toggle. "All zones" is the default (empty array). */
function ZonePicker({
  zones,
  selected,
  onChange,
}: {
  zones: CriticalZoneNode[];
  selected: string[];
  onChange: (ids: string[]) => void;
}) {
  if (zones.length === 0) {
    return <p className={`text-[9px] ${UI_SURFACES.textDimMid}`}>No critical zones defined in this scene.</p>;
  }

  const toggle = (id: string) => {
    if (selected.includes(id)) {
      onChange(selected.filter((s) => s !== id));
    } else {
      onChange([...selected, id]);
    }
  };

  return (
    <div className="flex flex-wrap gap-1">
      <button
        type="button"
        onClick={() => onChange([])}
        className={`rounded px-1.5 py-0.5 text-[9px] transition-colors ${
          selected.length === 0
            ? "bg-sky-500/20 text-sky-200 ring-1 ring-sky-400/40"
            : "${UI_SURFACES.card} ${UI_SURFACES.textDimMid} ${UI_SURFACES.hoverTextSoft}"
        }`}
      >
        All zones
      </button>
      {zones.map((zone) => {
        const active = selected.includes(zone.id);
        return (
          <button
            key={zone.id}
            type="button"
            onClick={() => toggle(zone.id)}
            title={zone.id}
            className={`flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[9px] transition-colors ${
              active
                ? "bg-sky-500/20 text-sky-200 ring-1 ring-sky-400/40"
                : "${UI_SURFACES.card} ${UI_SURFACES.textDimMid} ${UI_SURFACES.hoverTextSoft}"
            }`}
          >
            <MapPin className="h-2.5 w-2.5" />
            {zone.label || zone.id}
          </button>
        );
      })}
    </div>
  );
}

function PeakHourScrubber({
  counts,
  onChange,
}: {
  counts: number[];
  onChange: (counts: number[]) => void;
}) {
  const peak = Math.max(...counts, 1);

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-end gap-px h-8">
        {counts.map((count, hour) => (
          <button
            key={hour}
            type="button"
            title={`Hour ${hour}:00 — ${count} agents. Click to edit.`}
            style={{ height: `${Math.max(4, (count / peak) * 100)}%` }}
            className="flex-1 rounded-sm bg-sky-500/40 hover:bg-sky-400/60 transition-colors"
            onClick={() => {
              const next = prompt(`Agents at ${hour}:00`, String(count));
              if (next === null) return;
              const val = Math.max(0, parseInt(next, 10) || 0);
              const updated = [...counts];
              updated[hour] = val;
              onChange(updated);
            }}
          />
        ))}
      </div>
      <div className={`flex justify-between text-[9px] ${UI_SURFACES.textDimMid}`}>
        <span>0:00</span>
        <span>12:00</span>
        <span>23:00</span>
      </div>
    </div>
  );
}

export function CrowdProfileEditor() {
  const scene = useStudioStore((s) => s.scene);
  const updateCrowdProfiles = useStudioStore((s) => s.updateCrowdProfiles);
  const criticalZones = scene.criticalZones ?? [];

  const profiles = scene.crowdProfiles ?? [];

  const addProfile = () => {
    updateCrowdProfiles([...profiles, newProfile()]);
  };

  const addRetailDefault = () => {
    const preset: CrowdProfile = {
      id: `crowd_retail_${Date.now().toString(36)}`,
      label: "Retail (Default)",
      enabled: true,
      archetypes: DEFAULT_RETAIL_ARCHETYPES.map((a) => ({ ...a, preferredZones: [] })),
    };
    updateCrowdProfiles([...profiles, preset]);
  };

  const removeProfile = (id: string) => {
    updateCrowdProfiles(profiles.filter((p) => p.id !== id));
  };

  const patchProfile = (id: string, patch: Partial<CrowdProfile>) => {
    updateCrowdProfiles(profiles.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  };

  const addArchetype = (profileId: string) => {
    updateCrowdProfiles(
      profiles.map((p) =>
        p.id === profileId ? { ...p, archetypes: [...p.archetypes, newArchetype()] } : p,
      ),
    );
  };

  const removeArchetype = (profileId: string, archetypeId: string) => {
    updateCrowdProfiles(
      profiles.map((p) =>
        p.id === profileId
          ? { ...p, archetypes: p.archetypes.filter((a) => a.archetypeId !== archetypeId) }
          : p,
      ),
    );
  };

  const patchArchetype = (profileId: string, archetypeId: string, patch: Partial<AgentArchetype>) => {
    updateCrowdProfiles(
      profiles.map((p) =>
        p.id === profileId
          ? {
              ...p,
              archetypes: p.archetypes.map((a) =>
                a.archetypeId === archetypeId ? { ...a, ...patch } : a,
              ),
            }
          : p,
      ),
    );
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Users className={`h-3.5 w-3.5 ${UI_SURFACES.textAccent}`} />
          <span className={`text-[11px] font-semibold ${UI_SURFACES.textBody3}`}>Crowd Profiles</span>
        </div>
        <div className="flex gap-1">
          <button
            type="button"
            onClick={addRetailDefault}
            className={`rounded border ${UI_SURFACES.border} px-2 py-0.5 text-[10px] ${UI_SURFACES.textSoftMuted} hover:bg-white/5`}
          >
            + Retail Preset
          </button>
          <button
            type="button"
            onClick={addProfile}
            className={`rounded border ${UI_SURFACES.border} px-2 py-0.5 text-[10px] ${UI_SURFACES.textSoftMuted} hover:bg-white/5`}
          >
            <Plus className="inline h-2.5 w-2.5" /> Add
          </button>
        </div>
      </div>

      {profiles.length === 0 && (
        <div className={`rounded-xl border border-dashed ${UI_SURFACES.border} px-3 py-4 text-center`}>
          <p className={`text-[11px] ${UI_SURFACES.textSoftDim}`}>
            No crowd profiles. Add one to model dynamic occlusion from people moving through the scene.
          </p>
        </div>
      )}

      {profiles.map((profile) => (
        <div
          key={profile.id}
          className={`rounded-xl border ${UI_SURFACES.borderSubtle} ${UI_SURFACES.panelDeep} p-3`}
        >
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={profile.label}
              onChange={(e) => patchProfile(profile.id, { label: e.target.value })}
              className={`min-w-0 flex-1 rounded border ${UI_SURFACES.borderSubtle} ${UI_SURFACES.card} px-2 py-0.5 font-mono text-[11px] ${UI_SURFACES.textBody3} outline-none focus-visible:ring-2 focus-visible:ring-[#60a5fa]/50`}
            />
            <label className={`flex items-center gap-1 text-[10px] ${UI_SURFACES.textSoftMuted}`}>
              <input
                type="checkbox"
                checked={profile.enabled}
                onChange={(e) => patchProfile(profile.id, { enabled: e.target.checked })}
                className="h-3 w-3 accent-sky-400"
              />
              enabled
            </label>
            <button
              type="button"
              onClick={() => removeProfile(profile.id)}
              className={`${UI_SURFACES.textDimMid} hover:text-rose-400`}
              title="Remove profile"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="mt-3 flex flex-col gap-2">
            {profile.archetypes.map((arch) => (
              <div key={arch.archetypeId} className={`rounded-lg border ${UI_SURFACES.borderSubtle} ${UI_SURFACES.panel} p-2`}>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={arch.label}
                    onChange={(e) =>
                      patchArchetype(profile.id, arch.archetypeId, { label: e.target.value })
                    }
                    className={`min-w-0 flex-1 rounded border ${UI_SURFACES.borderSubtle} ${UI_SURFACES.card} px-1.5 py-0.5 font-mono text-[10px] ${UI_SURFACES.textBody3} outline-none`}
                  />
                  <span className={`text-[9px] ${UI_SURFACES.textDimMid}`}>r={arch.bodyRadiusM}m</span>
                  <button
                    type="button"
                    onClick={() => removeArchetype(profile.id, arch.archetypeId)}
                    className={`${UI_SURFACES.textDimMid} hover:text-rose-400`}
                    title="Remove archetype"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
                <div className="mt-2">
                  <div className={`mb-1 text-[9px] uppercase tracking-[0.12em] ${UI_SURFACES.textDimMid}`}>
                    Agents by hour (click bar to edit)
                  </div>
                  <PeakHourScrubber
                    counts={arch.countByHour}
                    onChange={(counts) =>
                      patchArchetype(profile.id, arch.archetypeId, { countByHour: counts })
                    }
                  />
                </div>
                {criticalZones.length > 0 && (
                  <div className="mt-2">
                    <div className={`mb-1 text-[9px] uppercase tracking-[0.12em] ${UI_SURFACES.textDimMid}`}>
                      Preferred zones (empty = all)
                    </div>
                    <ZonePicker
                      zones={criticalZones}
                      selected={arch.preferredZones}
                      onChange={(ids) =>
                        patchArchetype(profile.id, arch.archetypeId, { preferredZones: ids })
                      }
                    />
                  </div>
                )}
              </div>
            ))}

            <button
              type="button"
              onClick={() => addArchetype(profile.id)}
              className={`mt-1 w-full rounded border border-dashed ${UI_SURFACES.border} py-1 text-[10px] ${UI_SURFACES.textSoftDim} hover:border-[#60a5fa]/40 ${UI_SURFACES.hoverTextSoft}`}
            >
              + Add archetype
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
