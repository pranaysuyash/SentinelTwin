import { nearestPointOnWall } from "@/components/workspace/editing/editor-geometry";
import type { DoorNode, SecurityScene, WindowNode } from "@/schema/security-scene";

export type DoorWindowSnapNode = DoorNode | WindowNode;

export function snapDoorWindowToWall(node: DoorWindowSnapNode, scene: SecurityScene) {
  if (scene.walls.length === 0) return null;

  const nearest = nearestPointOnWall([node.position[0], node.position[2]], scene.walls);
  if (!Number.isFinite(nearest.dist)) return null;

  const [width, height, depth] = node.dimensions;
  const nextY = node.nodeType === "window"
    ? Math.max(1.0, Math.min(node.position[1], scene.assumptions.wallHeightM - height / 2))
    : Math.max(height / 2, node.position[1]);

  return {
    position: [nearest.wallPoint[0], nextY, nearest.wallPoint[1]] as [number, number, number],
    dimensions: [width, height, depth] as [number, number, number],
  };
}
