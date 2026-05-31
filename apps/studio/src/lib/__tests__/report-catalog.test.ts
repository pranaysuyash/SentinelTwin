import { afterEach, beforeEach, describe, expect, test } from "bun:test";

import {
  buildReportCatalogPresets,
  createReportCatalogPreset,
  loadReportCatalogState,
  persistReportCatalogState,
  removeReportCatalogPreset,
  upsertReportCatalogPreset,
} from "@/lib/report-catalog";

class MemoryStorage {
  private store = new Map<string, string>();

  getItem(key: string) {
    return this.store.get(key) ?? null;
  }

  setItem(key: string, value: string) {
    this.store.set(key, String(value));
  }

  removeItem(key: string) {
    this.store.delete(key);
  }

  clear() {
    this.store.clear();
  }
}

describe("report catalog", () => {
  const originalLocalStorage = globalThis.localStorage;
  const storage = new MemoryStorage();

  beforeEach(() => {
    storage.clear();
    Object.defineProperty(globalThis, "localStorage", {
      value: storage,
      configurable: true,
    });
  });

  afterEach(() => {
    Object.defineProperty(globalThis, "localStorage", {
      value: originalLocalStorage,
      configurable: true,
    });
  });

  test("exposes built-in presets with standards template labels", () => {
    const catalog = buildReportCatalogPresets();

    expect(catalog.some((preset) => preset.isCustom)).toBe(false);
    expect(catalog.every((preset) => preset.templateLabel.length > 0)).toBe(true);
    expect(catalog.some((preset) => preset.templateId === "oodpcvs-audit")).toBe(true);
  });

  test("persists and restores custom catalog presets", () => {
    const customPreset = createReportCatalogPreset({
      title: "Buyer Brief",
      audience: "insurer",
      visibility: "shared",
      templateId: "dori-audit",
      notes: "Focused underwriting preset",
    });

    const nextState = upsertReportCatalogPreset({ selectedPresetId: null, customPresets: [] }, customPreset);
    persistReportCatalogState(nextState);

    const restored = loadReportCatalogState();
    expect(restored.selectedPresetId).toBe(customPreset.id);
    expect(restored.customPresets).toHaveLength(1);
    expect(restored.customPresets[0].templateLabel).toContain("DORI");
    expect(restored.customPresets[0].notes).toBe("Focused underwriting preset");
  });

  test("removes custom presets and clears the selection when needed", () => {
    const customPreset = createReportCatalogPreset({
      title: "Privacy Safe Draft",
      audience: "privacy_reviewer",
      visibility: "privacy_safe",
      templateId: "oodpcvs-audit",
    });

    const nextState = removeReportCatalogPreset(
      { selectedPresetId: customPreset.id, customPresets: [customPreset] },
      customPreset.id,
    );

    expect(nextState.selectedPresetId).toBeNull();
    expect(nextState.customPresets).toHaveLength(0);
  });
});
