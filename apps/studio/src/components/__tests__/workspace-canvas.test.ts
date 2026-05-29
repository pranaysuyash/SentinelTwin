import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

const workspaceCanvasPath = resolve(
  fileURLToPath(new URL(".", import.meta.url)),
  "../",
  "workspace/WorkspaceCanvas.tsx",
);
const sharedScenePath = resolve(fileURLToPath(new URL(".", import.meta.url)), "../", "workspace/SharedScene.tsx");

describe("WorkspaceCanvas obstruction selection", () => {
  test("makes obstruction boxes selectable and visually highlighted", () => {
    const workspaceSource = readFileSync(workspaceCanvasPath, "utf8");
    const sharedSceneSource = readFileSync(sharedScenePath, "utf8");

    expect(workspaceSource).toContain('const selectedNodeIds = useStudioStore((s) => s.selectedNodeIds);');
    expect(workspaceSource).toContain('const visibleComponents = useStudioStore((s) => s.visibleComponents);');
    expect(workspaceSource).toContain('<SceneObstructions obstructions={scene.obstructions} selectedId={selected} onContextMenu={onObjectContextMenu} />');
    expect(workspaceSource).toContain('{visibleComponents.coverage_legend ? <CoverageLegend /> : null}');
    expect(workspaceSource).toContain('{visibleComponents.viewport_controls ? <ViewControls /> : null}');
    expect(workspaceSource).toContain('{visibleComponents.camera_preset_picker ? (');
    expect(sharedSceneSource).toContain('const storeSelect = useStudioStore((s) => s.selectNode);');
    expect(sharedSceneSource).toContain('selectedId === obs.id');
    expect(sharedSceneSource).toContain('onClick={(e) => { e.stopPropagation(); handleSelect(obs.id); }}');
    expect(sharedSceneSource).toContain('emissive={isSelected ? "#1e3a5f" : "#000000"}');
    expect(sharedSceneSource).toContain("<lineSegments>");
  });

  test("places the core scene nodes from the active tool rail", () => {
    const workspaceSource = readFileSync(workspaceCanvasPath, "utf8");

    expect(workspaceSource).toContain('if (activeTool === "camera")');
    expect(workspaceSource).toContain('const node = createCameraNode([pos[0], 2.8, pos[2]]);');
    expect(workspaceSource).toContain('if (activeTool === "obstruction")');
    expect(workspaceSource).toContain('const node = createObstructionNode([pos[0], 1, pos[2]]);');
    expect(workspaceSource).toContain('if (activeTool === "light")');
    expect(workspaceSource).toContain('const node = createSecurityLightNode([pos[0], 2.8, pos[2]]);');
    expect(workspaceSource).toContain('if (activeTool === "sensor")');
    expect(workspaceSource).toContain('const node = createSensorNode([pos[0], 1.2, pos[2]], sensorPlacementType);');
    expect(workspaceSource).toContain('if (activeTool === "wall")');
    expect(workspaceSource).toContain('const wall = createWallNode(draftWallStart, constrained, {');
    expect(workspaceSource).toContain('if (activeTool === "door_window")');
    expect(workspaceSource).toContain('const node = wantsWindow');
    expect(workspaceSource).toContain('const criticalZoneTargetType = useStudioStore((s) => s.criticalZoneTargetType);');
    expect(workspaceSource).toContain('if (activeTool === "zone")');
    expect(workspaceSource).toContain('const zone = createCriticalZoneNode(draftPolygonPoints, criticalZoneTargetType);');
    expect(workspaceSource).toContain('if (activeTool === "path")');
    expect(workspaceSource).toContain('setDraftPathPoints([...draftPathPoints, workingSnap]);');
    expect(workspaceSource).toContain('if (activeTool === "wall") {');
    expect(workspaceSource).toContain('commitDraftWall();');
  });

  test("keeps the canvas reset path imperative instead of remounting on reset", () => {
    const workspaceSource = readFileSync(workspaceCanvasPath, "utf8");

    expect(workspaceSource).toContain('const canvasViewResetTick = useStudioStore((s) => s.canvasViewResetTick);');
    expect(workspaceSource).not.toContain('key={`${canvasMode}:${canvasViewResetTick}`}');
    expect(workspaceSource).not.toContain('key={canvasMode}');
  });
});
