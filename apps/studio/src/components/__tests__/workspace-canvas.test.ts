import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const workspaceCanvasPath = "/Users/pranay/Projects/SentinelTwin/apps/studio/src/components/workspace/WorkspaceCanvas.tsx";
const sharedScenePath = "/Users/pranay/Projects/SentinelTwin/apps/studio/src/components/workspace/SharedScene.tsx";

describe("WorkspaceCanvas obstruction selection", () => {
  test("makes obstruction boxes selectable and visually highlighted", () => {
    const workspaceSource = readFileSync(workspaceCanvasPath, "utf8");
    const sharedSceneSource = readFileSync(sharedScenePath, "utf8");

    expect(workspaceSource).toContain('const selected = useStudioStore((s) => s.selectedNodeId);');
    expect(workspaceSource).toContain('<SceneObstructions obstructions={scene.obstructions} selectedId={selected} />');
    expect(sharedSceneSource).toContain('const storeSelect = useStudioStore((s) => s.selectNode);');
    expect(sharedSceneSource).toContain('selectedId === obs.id');
    expect(sharedSceneSource).toContain('onClick={(e) => { e.stopPropagation(); handleSelect(obs.id); }}');
    expect(sharedSceneSource).toContain('emissive={isSelected ? "#1e3a5f" : "#000000"}');
    expect(sharedSceneSource).toContain("<lineSegments>");
  });
});
