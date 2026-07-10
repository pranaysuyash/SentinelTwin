"use client";

import { ColorInput, SelectInput, SliderInput } from "@/components/inspector/inspector-controls";
import { SectionCard } from "@/components/shared/SectionCard";
import {
  APPEARANCE_PRESETS,
  hasAppearanceOverride,
} from "@/lib/scene-appearance";
import type { AppearancePresetId, NodeAppearance } from "@/schema/security-scene";

import { UI_SURFACES } from "@/lib/studio-surface-tokens";
/**
 * Reusable "Appearance" inspector section for the cosmetic material override
 * on walls, doors, windows, and obstructions. Appearance is rendering-only:
 * it never changes simulation results (the simulation-relevant `material`
 * field is edited elsewhere in each inspector).
 */
export function NodeAppearanceSection({
  appearance,
  presetChoices,
  onChange,
  title = "Appearance",
  showTextureScale = false,
}: {
  appearance: NodeAppearance | undefined;
  presetChoices: readonly AppearancePresetId[];
  /** Called with the next appearance, or undefined to fully reset. */
  onChange: (next: NodeAppearance | undefined) => void;
  title?: string;
  /** Show the procedural texture repeat control (floor / wall surfaces). */
  showTextureScale?: boolean;
}) {
  const current: NodeAppearance = appearance ?? { preset: "default" };
  const presetSpec = APPEARANCE_PRESETS[current.preset ?? "default"]?.spec ?? {};

  const patch = (fields: Partial<NodeAppearance>) => {
    onChange({ ...current, ...fields });
  };

  return (
    <SectionCard
      title={title}
      action={
        hasAppearanceOverride(appearance) ? (
          <button
            type="button"
            onClick={() => onChange(undefined)}
            className={`rounded px-1.5 py-0.5 text-[9px] ${UI_SURFACES.textDimMid} transition-colors hover:text-[#a8b4cc]`}
            title="Reset appearance to the built-in look"
          >
            Reset
          </button>
        ) : undefined
      }
    >
      <SelectInput
        label="Finish"
        value={current.preset ?? "default"}
        options={presetChoices.map((id) => ({
          value: id,
          label: APPEARANCE_PRESETS[id]?.label ?? id,
        }))}
        onChange={(value) => patch({ preset: value as AppearancePresetId })}
      />
      <ColorInput
        label="Tint"
        value={current.color}
        onChange={(value) => patch({ color: value })}
        onClear={() => patch({ color: undefined })}
      />
      <SliderInput
        label="Roughness"
        value={Math.round((current.roughness ?? presetSpec.roughness ?? 0.8) * 100)}
        min={0}
        max={100}
        step={1}
        unit="%"
        onChange={(value) => patch({ roughness: value / 100 })}
      />
      <SliderInput
        label="Metalness"
        value={Math.round((current.metalness ?? presetSpec.metalness ?? 0) * 100)}
        min={0}
        max={100}
        step={1}
        unit="%"
        onChange={(value) => patch({ metalness: value / 100 })}
      />
      {showTextureScale ? (
        <SliderInput
          label="Texture Scale"
          value={Math.round((current.textureScale ?? 1) * 100)}
          min={25}
          max={400}
          step={25}
          unit="%"
          onChange={(value) => patch({ textureScale: value / 100 })}
        />
      ) : null}
      <div className="pt-1 text-[8px] leading-relaxed text-[#495468]">
        Visual only — coverage simulation is unaffected. Occlusion behavior is
        controlled by the Material section.
      </div>
    </SectionCard>
  );
}
