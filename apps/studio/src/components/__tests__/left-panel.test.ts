import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const leftPanelPath = "./src/components/left-panel/LeftPanel.tsx";

describe("LeftPanel", () => {
  test("uses a full-width dock shell with collapsible subpanels", () => {
    const source = readFileSync(leftPanelPath, "utf8");

    expect(source).toContain("flex h-full min-w-0 flex-1 flex-col");
    expect(source).toContain("const [collapsedSections, setCollapsedSections]");
    expect(source).toContain("Scene Tools");
    expect(source).toContain("Scene Layers");
    expect(source).toContain("Mini-Map");
    expect(source).toContain("Toolbar hidden to favor canvas space.");
    expect(source).toContain("Layer visibility hidden. Selected layers still drive the canvas.");
    expect(source).toContain("Minimap hidden. Expand only when navigating the scene.");
  });
});
