import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const viewSettingsPath = "/Users/pranay/Projects/SentinelTwin/apps/studio/src/components/layout/ViewSettingsModal.tsx";

describe("ViewSettingsModal", () => {
  test("surfaces the AI provider selection alongside layout controls", () => {
    const source = readFileSync(viewSettingsPath, "utf8");

    expect(source).toContain('import { AI_PROVIDER_OPTIONS, describeAiProviderSelection, getProviderOption, normalizeAiProviderSelection } from "@/agents/provider-selection";');
    expect(source).toContain("AI Provider");
    expect(source).toContain('import { CAMERA_PRESETS } from "@/components/workspace/CameraPresetPicker";');
    expect(source).toContain("Camera Preset Library");
    expect(source).toContain("setCameraPresetId(cameraPresetId === preset.id ? null : preset.id)");
    expect(source).toContain("providerInfo.providerLabel");
    expect(source).toContain("providerInfo.cloudAvailable");
    expect(source).toContain("setAiProviderSelection(normalizeAiProviderSelection({ providerId: option.id, model: option.defaultModel }))");
    expect(source).toContain("setAiProviderSelection({ providerId: aiProviderSelection.providerId, model: event.target.value })");
  });
});
