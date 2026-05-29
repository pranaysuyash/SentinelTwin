import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const leftPanelPath = "./src/components/left-panel/LeftPanel.tsx";

describe("LeftPanel", () => {
  test("exposes the sensor placement tool in the core authoring rail", () => {
    const source = readFileSync(leftPanelPath, "utf8");

    expect(source).toContain('id: "sensor"');
    expect(source).toContain('label: "Sensor"');
    expect(source).toContain("ScanSearch");
    expect(source).toContain('key: "Y"');
    expect(source).toContain("Scene Tools");
    expect(source).toContain('collapsed={collapsedSections.snapping}');
    expect(source).toContain('summary={editor.snapEnabled ? "On" : "Off"}');
    expect(source).toContain('Enable snapping');
    expect(source).toContain('Grid size');
  });
});
