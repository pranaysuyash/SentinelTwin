import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const workspaceCanvasPath = "/Users/pranay/Projects/SentinelTwin/apps/studio/src/components/workspace/WorkspaceCanvas.tsx";

describe("WorkspaceCanvas obstruction selection", () => {
  test("makes obstruction boxes selectable and visually highlighted", () => {
    const source = readFileSync(workspaceCanvasPath, "utf8");

    expect(source).toContain('const selectNode = useStudioStore((s) => s.selectNode);');
    expect(source).toContain('const selectedId = useStudioStore((s) => s.selectedNodeId);');
    expect(source).toContain('onClick={(e) => { e.stopPropagation(); selectNode(obs.id); }}');
    expect(source).toContain('emissive={isSelected ? "#1e3a5f" : "#000000"}');
    expect(source).toContain("<lineSegments>");
  });
});
