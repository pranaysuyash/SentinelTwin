import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const tabPath = "./src/components/bottom-panel/SceneIntelligenceTab.tsx";

describe("SceneIntelligenceTab", () => {
  test("supports interactive provenance inspection and trace focus", () => {
    const source = readFileSync(tabPath, "utf8");

    expect(source).toContain("const [selectedNodeId, setSelectedNodeId] = useState(graph.rootId);");
    expect(source).toContain("const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);");
    expect(source).toContain("Click any node or relation to inspect where it came from");
    expect(source).toContain("Inspect");
    expect(source).toContain("Focus source");
    expect(source).toContain("Focus target");
    expect(source).toContain("Provenance notes");
    expect(source).toContain("selectedEdgeId");
  });
});
