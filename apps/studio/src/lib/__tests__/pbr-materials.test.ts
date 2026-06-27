import { describe, expect, test } from "bun:test";

import {
  SELECTED_COLOR,
  SELECTED_EMISSIVE,
  SELECTED_EMISSIVE_INTENSITY,
  SELECTED_OPACITY_BOOST,
  PBR_MATERIALS,
  needsPhysicalMaterial,
  obstructionSurfaceKind,
  pbrToPhysicalMaterialProps,
  pbrToStandardMaterialProps,
  surfaceMaterial,
  surfaceMaterialWithSelection,
} from "../pbr-materials";

describe("pbr-materials library", () => {
  test("PBR_MATERIALS covers every surface kind the editor uses", () => {
    const required = [
      "floor",
      "wall",
      "wall_glass",
      "door_panel",
      "door_frame",
      "door_handle",
      "window_frame",
      "window_glass",
      "window_sill",
      "ceiling",
      "countertop",
      "cabinet_body",
      "shelf_panel",
      "shelf_board",
      "pillar_concrete",
      "display_glass",
      "partition_panel",
      "vehicle_body",
      "vehicle_cabin",
      "tree_trunk",
      "tree_canopy",
      "actor_body",
      "actor_head",
      "actor_limb",
      "actor_limb_dark",
      "camera_housing",
      "camera_lens",
      "camera_mount",
      "spotlight_housing",
      "selected",
    ];
    for (const kind of required) {
      expect(PBR_MATERIALS).toHaveProperty(kind);
    }
  });

  test("roughness and metalness are in plausible PBR bands", () => {
    for (const [kind, spec] of Object.entries(PBR_MATERIALS)) {
      expect(spec.roughness, `${kind}.roughness`).toBeGreaterThanOrEqual(0);
      expect(spec.roughness, `${kind}.roughness`).toBeLessThanOrEqual(1);
      expect(spec.metalness, `${kind}.metalness`).toBeGreaterThanOrEqual(0);
      expect(spec.metalness, `${kind}.metalness`).toBeLessThanOrEqual(1);
    }
  });

  test("metal + non-zero metalness surfaces look like metal (roughness < 0.6)", () => {
    const metalKinds = [
      "door_handle",
      "window_frame",
      "cabinet_handle",
      "vehicle_body",
      "camera_lens",
      "camera_mount",
      "spotlight_housing",
    ] as const;
    for (const kind of metalKinds) {
      expect(PBR_MATERIALS[kind].metalness, kind).toBeGreaterThanOrEqual(0.4);
      expect(PBR_MATERIALS[kind].roughness, kind).toBeLessThan(0.6);
    }
  });

  test("surfaceMaterial returns a fresh shallow copy", () => {
    const a = surfaceMaterial("wall");
    const b = surfaceMaterial("wall");
    expect(a).toEqual(b);
    expect(a).not.toBe(b);
    (a as { color: string }).color = "#000000";
    expect(b.color).toBe(PBR_MATERIALS.wall.color);
  });

  test("surfaceMaterial accepts overrides without mutating the library", () => {
    const override = surfaceMaterial("door_panel", { color: "#abcdef" });
    expect(override.color).toBe("#abcdef");
    expect(PBR_MATERIALS.door_panel.color).not.toBe("#abcdef");
  });

  test("selection overlay applies canonical SELECTED color + emissive boost", () => {
    const overlay = surfaceMaterialWithSelection("door_panel", true);
    expect(overlay.color).toBe(SELECTED_COLOR);
    expect(overlay.emissive).toBe(SELECTED_EMISSIVE);
    expect(overlay.emissiveIntensity).toBe(SELECTED_EMISSIVE_INTENSITY);
  });

  test("selection overlay preserves glass opacity and bumps it slightly", () => {
    const baseOpacity = PBR_MATERIALS.wall_glass.opacity;
    expect(baseOpacity).toBeDefined();
    const overlay = surfaceMaterialWithSelection("wall_glass", true);
    expect(overlay.color).toBe(SELECTED_COLOR);
    expect(overlay.opacity).toBeGreaterThan(baseOpacity!);
    expect(overlay.opacity).toBeLessThanOrEqual(baseOpacity! + SELECTED_OPACITY_BOOST + 1e-6);
  });

  test("non-selected surfaces are returned without modification", () => {
    const spec = surfaceMaterialWithSelection("wall", false);
    expect(spec).toEqual(PBR_MATERIALS.wall);
  });

  test("needsPhysicalMaterial detects transmission / clearcoat / reflectivity", () => {
    expect(needsPhysicalMaterial(surfaceMaterial("wall"))).toBe(false);
    expect(needsPhysicalMaterial(surfaceMaterial("wall_glass"))).toBe(true);
    expect(needsPhysicalMaterial(surfaceMaterial("camera_housing"))).toBe(true);
  });

  test("pbrToStandardMaterialProps omits physical-only fields", () => {
    const props = pbrToStandardMaterialProps(surfaceMaterial("wall"));
    expect(props).not.toHaveProperty("transmission");
    expect(props).not.toHaveProperty("clearcoat");
    expect(props.emissive).toBe("#000000");
    expect(props.emissiveIntensity).toBe(0);
  });

  test("pbrToPhysicalMaterialProps preserves physical features", () => {
    const glass = surfaceMaterial("window_glass");
    const props = pbrToPhysicalMaterialProps(glass);
    expect(props.transmission).toBe(glass.transmission);
    expect(props.ior).toBe(glass.ior);
  });

  test("obstructionSurfaceKind maps known types and returns null for unknown", () => {
    expect(obstructionSurfaceKind("shelf")).toBe("shelf_panel");
    expect(obstructionSurfaceKind("counter")).toBe("countertop");
    expect(obstructionSurfaceKind("pillar")).toBe("pillar_concrete");
    expect(obstructionSurfaceKind("glass_display")).toBe("display_glass");
    expect(obstructionSurfaceKind("vehicle")).toBe("vehicle_body");
    expect(obstructionSurfaceKind("tree")).toBe("tree_canopy");
    expect(obstructionSurfaceKind("alien_artifact")).toBe(null);
  });
});
