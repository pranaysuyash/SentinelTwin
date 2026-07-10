"use client";

import { Palette } from "lucide-react";

import {
  ColorInput,
  NumberInput,
  SliderInput,
  ToggleField,
} from "@/components/inspector/inspector-controls";
import { NodeAppearanceSection } from "@/components/inspector/NodeAppearanceSection";
import { Badge } from "@/components/shared/Badge";
import { SectionCard } from "@/components/shared/SectionCard";
import {
  FLOOR_PRESET_CHOICES,
  WALL_PRESET_CHOICES,
  resolveSceneLighting,
} from "@/lib/scene-appearance";
import type {
  EnvironmentLightingOverride,
  NodeAppearance,
  SceneAppearance,
} from "@/schema/security-scene";
import { useStudioStore } from "@/store/studio-store";
import { UI_SURFACES } from "@/lib/studio-surface-tokens";


const ENV_MODE_LABEL: Record<string, string> = {
  day: "Day",
  dusk: "Dusk",
  night: "Night",
};

/**
 * Scene-level visual customization editor (scene.sceneAppearance).
 * Shown in the inspector when no object is selected. All settings are
 * rendering-only and persist inside the SecurityScene document, so they
 * travel with export/import, snapshots, and undo/redo. Simulation results
 * are never affected (D-003).
 */
export function SceneAppearancePanel() {
  const scene = useStudioStore((s) => s.scene);
  const envMode = useStudioStore((s) => s.environmentMode);
  const updateSceneAppearance = useStudioStore((s) => s.updateSceneAppearance);

  const appearance = scene.sceneAppearance;
  const lighting = resolveSceneLighting(envMode, appearance);
  const modeOverride = appearance?.lighting?.[envMode];
  const hasModeOverride = modeOverride !== undefined && Object.keys(modeOverride).length > 0;

  const patchLighting = (fields: Partial<EnvironmentLightingOverride>) => {
    updateSceneAppearance({
      lighting: { [envMode]: { ...modeOverride, ...fields } },
    });
  };

  const patchFog = (fields: Partial<NonNullable<SceneAppearance["fog"]>>) => {
    updateSceneAppearance({
      fog: { enabled: appearance?.fog?.enabled ?? true, ...appearance?.fog, ...fields },
    });
  };

  const patchEnvironment = (fields: Partial<NonNullable<SceneAppearance["environment"]>>) => {
    updateSceneAppearance({ environment: { ...appearance?.environment, ...fields } });
  };

  const patchSurface = (surface: "floor" | "wall", next: NodeAppearance | undefined) => {
    updateSceneAppearance({ surfaces: { [surface]: next } });
  };

  return (
    <>
      <div className={`{border-b ${UI_SURFACES.borderPanel} px-3 py-3}`}>
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl border border-violet-500/20 bg-violet-500/12">
              <Palette className="h-4 w-4 text-violet-400" />
            </div>
            <div>
              <div className="text-[12px] font-semibold text-white">Scene Appearance</div>
              <div className={`text-[9px] uppercase tracking-[0.18em] ${UI_SURFACES.textDimMid}`}>
                Lighting · Materials · Environment
              </div>
            </div>
          </div>
          <Badge variant="gray">Visual only</Badge>
        </div>
        <div className={`mt-2 text-[9px] leading-relaxed ${UI_SURFACES.textDimMid}`}>
          Customizes how the scene renders. Coverage simulation is never affected.
          Select an object in the canvas to edit its own finish instead.
        </div>
      </div>

      <div className="flex-1 space-y-2.5 overflow-y-auto px-3 py-3">
        <SectionCard
          title={`Lighting — ${ENV_MODE_LABEL[envMode] ?? envMode}`}
          action={
            hasModeOverride ? (
              <button
                type="button"
                onClick={() => updateSceneAppearance({ lighting: { [envMode]: undefined } })}
                className={`rounded px-1.5 py-0.5 text-[9px] ${UI_SURFACES.textDimMid} transition-colors ${UI_SURFACES.hoverTextSoft}`}
                title={`Reset ${ENV_MODE_LABEL[envMode] ?? envMode} lighting to defaults`}
              >
                Reset
              </button>
            ) : undefined
          }
        >
          <SliderInput
            label="Ambient"
            value={Math.round(lighting.ambient * 100)}
            min={0}
            max={400}
            step={5}
            unit="%"
            onChange={(value) => patchLighting({ ambient: value / 100 })}
          />
          <SliderInput
            label="Sky Bounce"
            value={Math.round(lighting.hemisphere * 100)}
            min={0}
            max={300}
            step={5}
            unit="%"
            onChange={(value) => patchLighting({ hemisphere: value / 100 })}
          />
          <SliderInput
            label="Key Light"
            value={Math.round(lighting.directional * 100)}
            min={0}
            max={400}
            step={5}
            unit="%"
            onChange={(value) => patchLighting({ directional: value / 100 })}
          />
          <SliderInput
            label="Fill Light"
            value={Math.round(lighting.fill * 100)}
            min={0}
            max={300}
            step={5}
            unit="%"
            onChange={(value) => patchLighting({ fill: value / 100 })}
          />
          <ColorInput
            label="Key Color"
            value={modeOverride?.keyLightColor}
            placeholder={lighting.keyLightColor}
            onChange={(value) => patchLighting({ keyLightColor: value })}
            onClear={() => patchLighting({ keyLightColor: undefined })}
          />
          <ColorInput
            label="Background"
            value={modeOverride?.background}
            placeholder={lighting.background}
            onChange={(value) => patchLighting({ background: value })}
            onClear={() => patchLighting({ background: undefined })}
          />
          <ToggleField
            label="Ceiling Lights"
            value={lighting.practicalLights}
            trueLabel="On"
            falseLabel="Off"
            onChange={(value) => patchLighting({ practicalLights: value })}
          />
          {lighting.practicalLights ? (
            <SliderInput
              label="Ceiling Intensity"
              value={Math.round(lighting.practicalIntensity * 100)}
              min={0}
              max={300}
              step={10}
              unit="%"
              onChange={(value) => patchLighting({ practicalIntensity: value / 100 })}
            />
          ) : null}
          <div className="pt-1 text-[8px] leading-relaxed ${UI_SURFACES.textMuted}">
            Edits apply to the active environment mode ({ENV_MODE_LABEL[envMode] ?? envMode}).
            Switch modes in the top bar to tune the others.
          </div>
        </SectionCard>

        <SectionCard title="Atmosphere">
          <ToggleField
            label="Fog"
            value={lighting.fogEnabled}
            trueLabel="On"
            falseLabel="Off"
            onChange={(value) => patchFog({ enabled: value })}
          />
          {lighting.fogEnabled ? (
            <>
              <ColorInput
                label="Fog Color"
                value={appearance?.fog?.color}
                placeholder={lighting.fogColor}
                onChange={(value) => patchFog({ color: value })}
                onClear={() => patchFog({ color: undefined })}
              />
              <div className="grid grid-cols-2 gap-2 pt-1.5">
                <NumberInput
                  label="Fog Near"
                  value={appearance?.fog?.near ?? 12}
                  min={0}
                  step={1}
                  unit="m"
                  onChange={(value) => patchFog({ near: value })}
                />
                <NumberInput
                  label="Fog Far"
                  value={appearance?.fog?.far ?? 24}
                  min={1}
                  step={1}
                  unit="m"
                  onChange={(value) => patchFog({ far: value })}
                />
              </div>
            </>
          ) : null}
        </SectionCard>

        <SectionCard title="Environment & Shadows">
          <SliderInput
            label="Reflections (IBL)"
            value={Math.round(lighting.iblIntensityScale * 100)}
            min={0}
            max={200}
            step={5}
            unit="%"
            onChange={(value) => patchEnvironment({ iblIntensityScale: value / 100 })}
          />
          <SliderInput
            label="Exposure"
            value={Math.round((lighting.toneMappingExposure ?? 1) * 100)}
            min={20}
            max={250}
            step={5}
            unit="%"
            onChange={(value) => patchEnvironment({ toneMappingExposure: value / 100 })}
          />
          <ToggleField
            label="Shadows"
            value={lighting.shadows}
            trueLabel="On"
            falseLabel="Off"
            onChange={(value) => patchEnvironment({ shadows: value })}
          />
        </SectionCard>

        <NodeAppearanceSection
          title="Floor Material"
          appearance={appearance?.surfaces?.floor}
          presetChoices={FLOOR_PRESET_CHOICES}
          showTextureScale
          onChange={(next) => patchSurface("floor", next)}
        />

        <NodeAppearanceSection
          title="Wall Material"
          appearance={appearance?.surfaces?.wall}
          presetChoices={WALL_PRESET_CHOICES}
          showTextureScale
          onChange={(next) => patchSurface("wall", next)}
        />

        {appearance ? (
          <button
            type="button"
            onClick={() =>
              updateSceneAppearance({
                lighting: undefined,
                fog: undefined,
                environment: undefined,
                surfaces: undefined,
              })
            }
            className={`flex h-8 w-full items-center justify-center gap-1.5 rounded-lg border ${UI_SURFACES.border} ${UI_SURFACES.card} text-[10px] font-medium ${UI_SURFACES.textBody} transition-colors ${UI_SURFACES.hoverBorderBright} ${UI_SURFACES.hoverBgDark}`}
          >
            Reset All Appearance Customization
          </button>
        ) : null}
      </div>
    </>
  );
}
