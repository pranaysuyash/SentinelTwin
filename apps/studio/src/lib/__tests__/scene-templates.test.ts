import { describe, expect, test } from "bun:test";

import {
  SCENE_TEMPLATES,
  getTemplateById,
  getTemplatesByCategory,
} from "@/lib/scene-templates";

describe("SCENE_TEMPLATES", () => {
  test("has all 5 templates", () => {
    expect(SCENE_TEMPLATES.length).toBe(5);
  });

  test("each template has required fields", () => {
    for (const template of SCENE_TEMPLATES) {
      expect(template.id).toBeTruthy();
      expect(template.name).toBeTruthy();
      expect(template.description).toBeTruthy();
      expect(template.category).toBeTruthy();
      expect(template.suggestedDimensions.widthM).toBeGreaterThan(0);
      expect(template.suggestedDimensions.depthM).toBeGreaterThan(0);
      expect(template.suggestedDimensions.heightM).toBeGreaterThan(0);
      expect(template.suggestedCameras).toBeGreaterThan(0);
      expect(template.icon).toBeTruthy();
      expect(typeof template.create).toBe("function");
    }
  });

  test("all categories are valid", () => {
    const validCategories = ["retail", "office", "industrial", "education", "residential"];
    for (const template of SCENE_TEMPLATES) {
      expect(validCategories).toContain(template.category);
    }
  });

  test("all template IDs are unique", () => {
    const ids = SCENE_TEMPLATES.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test("all template IDs are kebab-case", () => {
    for (const template of SCENE_TEMPLATES) {
      expect(template.id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
    }
  });
});

describe("getTemplateById", () => {
  test("returns template for valid ID", () => {
    const template = getTemplateById("retail-shop");
    expect(template).toBeDefined();
    expect(template?.name).toBe("Retail Shop");
  });

  test("returns undefined for unknown ID", () => {
    const template = getTemplateById("nonexistent");
    expect(template).toBeUndefined();
  });

  test("is case-sensitive", () => {
    const template = getTemplateById("Retail-Shop");
    expect(template).toBeUndefined();
  });
});

describe("getTemplatesByCategory", () => {
  test("returns all industrial templates", () => {
    const templates = getTemplatesByCategory("industrial");
    expect(templates.length).toBeGreaterThanOrEqual(2);
    for (const t of templates) {
      expect(t.category).toBe("industrial");
    }
  });

  test("returns correct number per category", () => {
    expect(getTemplatesByCategory("retail")).toHaveLength(1);
    expect(getTemplatesByCategory("office")).toHaveLength(1);
    expect(getTemplatesByCategory("education")).toHaveLength(1);
    expect(getTemplatesByCategory("residential")).toHaveLength(0); // Not implemented yet
  });

  test("returns empty array for unknown category", () => {
    // @ts-expect-error - testing invalid category
    const templates = getTemplatesByCategory("unknown");
    expect(templates).toHaveLength(0);
  });
});

describe("template.create()", () => {
  test("retail-shop creates valid scene with defaults", () => {
    const template = getTemplateById("retail-shop")!;
    const scene = template.create();

    expect(scene.name).toBe("Retail Shop");
    expect(scene.dimensions.width).toBe(10);
    expect(scene.dimensions.depth).toBe(8);
    expect(scene.dimensions.height).toBe(3);
    // Walls: 4 perimeter walls
    expect(scene.walls.length).toBe(4);
    // Cameras: 3 (entrance + counter + back wall)
    expect(scene.cameras.length).toBe(3);
    // Doors: 1 (entry)
    expect(scene.doors.length).toBe(1);
    // Windows: 1 (storefront)
    expect(scene.windows.length).toBe(1);
    // Critical zones: 3 (entry + counter + back room)
    expect(scene.criticalZones.length).toBe(3);
    // Obstructions: 2 (counter + shelf)
    expect(scene.obstructions.length).toBe(2);
    // Security lights: 1 (main light)
    expect(scene.securityLights.length).toBe(1);
    // Entry points: 1 (front door)
    expect(scene.entryPoints.length).toBe(1);
    // Source
    expect(scene.source).toBe("manual");
  });

  test("retail-shop respects dimension overrides", () => {
    const template = getTemplateById("retail-shop")!;
    const scene = template.create({ widthM: 15, depthM: 12, heightM: 4 });

    expect(scene.dimensions.width).toBe(15);
    expect(scene.dimensions.depth).toBe(12);
    expect(scene.dimensions.height).toBe(4);
  });

  test("retail-shop camera count matches suggestion", () => {
    const template = getTemplateById("retail-shop")!;
    const scene = template.create();
    expect(scene.cameras.length).toBe(template.suggestedCameras);
  });

  test("open-office creates valid scene", () => {
    const template = getTemplateById("open-office")!;
    const scene = template.create();

    expect(scene.name).toBe("Open Office");
    expect(scene.dimensions.width).toBe(15);
    expect(scene.dimensions.depth).toBe(12);
    expect(scene.walls.length).toBe(4);
    expect(scene.cameras.length).toBe(4);
    expect(scene.doors.length).toBe(2); // Main entry + rear exit
    expect(scene.criticalZones.length).toBe(2); // Entry + server room
    expect(scene.entryPoints.length).toBe(2);
  });

  test("warehouse creates valid scene", () => {
    const template = getTemplateById("warehouse")!;
    const scene = template.create();

    expect(scene.name).toBe("Warehouse");
    expect(scene.dimensions.width).toBe(30);
    expect(scene.dimensions.depth).toBe(20);
    expect(scene.cameras.length).toBe(6);
    expect(scene.obstructions.length).toBe(4); // 4 racking rows
  });

  test("classroom creates valid scene", () => {
    const template = getTemplateById("classroom")!;
    const scene = template.create();

    expect(scene.name).toBe("Classroom");
    expect(scene.walls.length).toBe(4);
    expect(scene.cameras.length).toBe(2);
    expect(scene.windows.length).toBe(1); // East windows
  });

  test("parking-garage creates valid scene", () => {
    const template = getTemplateById("parking-garage")!;
    const scene = template.create();

    expect(scene.name).toBe("Parking Garage");
    expect(scene.doors.length).toBe(3); // Vehicle entry + exit + pedestrian
    expect(scene.cameras.length).toBe(4);
    expect(scene.obstructions.length).toBe(2); // 2 columns
  });

  test("each template has unique camera IDs", () => {
    for (const template of SCENE_TEMPLATES) {
      const scene = template.create();
      const cameraIds = scene.cameras.map((c) => c.id);
      expect(new Set(cameraIds).size).toBe(cameraIds.length);
    }
  });

  test("each template has unique obstruction IDs", () => {
    for (const template of SCENE_TEMPLATES) {
      const scene = template.create();
      const obsIds = scene.obstructions.map((o) => o.id);
      expect(new Set(obsIds).size).toBe(obsIds.length);
    }
  });

  test("scenes have valid simulation assumptions", () => {
    for (const template of SCENE_TEMPLATES) {
      const scene = template.create();
      expect(scene.assumptions.personHeightM).toBe(1.75);
      expect(scene.assumptions.wallHeightM).toBe(scene.dimensions.height);
      expect(scene.assumptions.doriStandard).toBeTruthy();
      expect(scene.assumptions.pixelsPerMeter.detection).toBeGreaterThan(0);
      expect(scene.assumptions.pixelsPerMeter.recognition).toBeGreaterThan(
        scene.assumptions.pixelsPerMeter.detection,
      );
    }
  });

  test("scenes have unique door IDs", () => {
    for (const template of SCENE_TEMPLATES) {
      const scene = template.create();
      const doorIds = scene.doors.map((d) => d.id);
      expect(new Set(doorIds).size).toBe(doorIds.length);
    }
  });

  test("scenes have unique critical zone IDs", () => {
    for (const template of SCENE_TEMPLATES) {
      const scene = template.create();
      const zoneIds = scene.criticalZones.map((z) => z.id);
      expect(new Set(zoneIds).size).toBe(zoneIds.length);
    }
  });

  test("scenes have unique entry point IDs", () => {
    for (const template of SCENE_TEMPLATES) {
      const scene = template.create();
      const entryIds = scene.entryPoints.map((e) => e.id);
      expect(new Set(entryIds).size).toBe(entryIds.length);
    }
  });
});

describe("template.assignments.align with architecture docs", () => {
  test("industrial category has 2 templates (warehouse + garage)", () => {
    // PHASE_10 docs mention warehouse (first) and parking-garage as distinct templates
    const industrial = getTemplatesByCategory("industrial");
    expect(industrial.length).toBe(2);
    const ids = industrial.map((t) => t.id);
    expect(ids).toContain("warehouse");
    expect(ids).toContain("parking-garage");
  });
});
