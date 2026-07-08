import { describe, expect, test } from "bun:test";

import {
  UI_EXPOSURE_ORDER,
  UI_EXPOSURE_PRESETS,
  nextUiExposure,
} from "@/lib/ui-exposure";

describe("UI exposure presets", () => {
  test("cycle order covers all levels and wraps", () => {
    expect(nextUiExposure("showcase")).toBe("focused");
    expect(nextUiExposure("focused")).toBe("full");
    expect(nextUiExposure("full")).toBe("showcase");
    expect(new Set(UI_EXPOSURE_ORDER).size).toBe(3);
  });

  test("showcase is the quietest posture without removing surfaces", () => {
    const preset = UI_EXPOSURE_PRESETS.showcase;
    // Quiet: hints/compass/minimap off, all docks collapsed, labels simplified.
    expect(preset.visibleComponents.control_hint_bar).toBe(false);
    expect(preset.visibleComponents.north_compass).toBe(false);
    expect(preset.dockCollapsed).toEqual({ left: true, right: true, bottom: true });
    expect(preset.clientDemoOptions.simplifiedLabels).toBe(true);
    // Never removed: core navigation + command surfaces stay on.
    expect(preset.visibleComponents.view_mode_bar).toBe(true);
    expect(preset.visibleComponents.command_bar).toBe(true);
    expect(preset.visibleComponents.status_bar).toBe(true);
    expect(preset.visibleComponents.viewport_controls).toBe(true);
  });

  test("full pins everything open including debug lanes", () => {
    const preset = UI_EXPOSURE_PRESETS.full;
    expect(Object.values(preset.visibleComponents).every(Boolean)).toBe(true);
    expect(preset.dockCollapsed).toEqual({ left: false, right: false, bottom: false });
    expect(preset.clientDemoOptions.hideDebugModules).toBe(false);
  });

  test("focused keeps hints while defaulting side clutter closed", () => {
    const preset = UI_EXPOSURE_PRESETS.focused;
    expect(preset.visibleComponents.control_hint_bar).toBe(true);
    expect(preset.dockCollapsed.right).toBe(false);
    expect(preset.clientDemoOptions.hideDebugModules).toBe(true);
  });

  test("level switcher follows the same ambient-chrome rule as compass/hints", () => {
    // LevelSwitcher (multi-floor picker) is permanent top-left chrome even
    // for the common single-floor scene. It must be quiet in showcase and
    // available in focused/full, exactly like north_compass/control_hint_bar.
    expect(UI_EXPOSURE_PRESETS.showcase.visibleComponents.level_switcher).toBe(false);
    expect(UI_EXPOSURE_PRESETS.focused.visibleComponents.level_switcher).toBe(true);
    expect(UI_EXPOSURE_PRESETS.full.visibleComponents.level_switcher).toBe(true);
  });
});
