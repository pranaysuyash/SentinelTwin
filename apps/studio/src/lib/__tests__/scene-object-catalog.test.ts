import { describe, expect, it } from "bun:test";

import { OBSTRUCTION_PRESETS, CUSTOM_OBSTRUCTION_PRESET_ID } from "@/lib/obstruction-presets";
import { SCENE_OBJECT_LAYERS, getSceneObjectLayerCounts } from "@/lib/scene-object-catalog";

describe("scene object catalog", () => {
  it("organizes the object graph into structural, security fixture, and fit-out layers", () => {
    expect(SCENE_OBJECT_LAYERS.map((layer) => layer.id)).toEqual([
      "structural",
      "security_fixture",
      "fit_out",
    ]);
  });

  it("keeps the fit-out layer aligned with the live obstruction preset library", () => {
    const fitOutLayer = SCENE_OBJECT_LAYERS.find((layer) => layer.id === "fit_out");
    expect(fitOutLayer).toBeTruthy();
    expect(fitOutLayer?.liveExamples).toEqual(
      OBSTRUCTION_PRESETS.filter((preset) => preset.id !== CUSTOM_OBSTRUCTION_PRESET_ID).map((preset) => preset.label),
    );
  });

  it("exposes layer-level add paths that map to the existing canonical tools", () => {
    const structural = SCENE_OBJECT_LAYERS.find((layer) => layer.id === "structural");
    const securityFixture = SCENE_OBJECT_LAYERS.find((layer) => layer.id === "security_fixture");
    const fitOut = SCENE_OBJECT_LAYERS.find((layer) => layer.id === "fit_out");

    expect(structural?.addPath).toContain("Wall tool");
    expect(structural?.addPath).toContain("Door-Window tool");
    expect(securityFixture?.addPath).toContain("Camera tool");
    expect(securityFixture?.addPath).toContain("Light tool");
    expect(securityFixture?.addPath).toContain("Sensor tool");
    expect(fitOut?.addPath).toBe("Obstruction tool");
  });

  it("reports live object counts for the current catalog layers", () => {
    expect(getSceneObjectLayerCounts()).toEqual({
      structural: 3,
      securityFixture: 3,
      fitOut: OBSTRUCTION_PRESETS.filter((preset) => preset.id !== CUSTOM_OBSTRUCTION_PRESET_ID).length,
    });
  });
});

