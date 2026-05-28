import { nearestPointOnWall, pointDistance } from "@/components/workspace/editing/editor-geometry";
import type { CameraNode, ObstructionNode, SecurityScene } from "@/schema/security-scene";

export type CameraMountSnapMode = "wall" | "ceiling" | "pole";

function aimTowardSceneCenter(camera: CameraNode, scene: SecurityScene) {
  const centerX = scene.dimensions.width / 2;
  const centerZ = scene.dimensions.depth / 2;
  const yawDeg = Math.atan2(centerX - camera.position[0], centerZ - camera.position[2]) * (180 / Math.PI);
  return Math.round(yawDeg);
}

function nearestPillar(scene: SecurityScene, camera: CameraNode): ObstructionNode | null {
  const pillars = scene.obstructions.filter((obstruction) => obstruction.obstructionType === "pillar" || obstruction.label.toLowerCase().includes("pillar"));
  if (pillars.length === 0) return null;
  return pillars.slice().sort((a, b) => {
    const aDist = pointDistance([camera.position[0], camera.position[2]], [a.position[0], a.position[2]]);
    const bDist = pointDistance([camera.position[0], camera.position[2]], [b.position[0], b.position[2]]);
    return aDist - bDist;
  })[0] ?? null;
}

export function snapCameraToMount(camera: CameraNode, scene: SecurityScene, mode: CameraMountSnapMode) {
  switch (mode) {
    case "wall": {
      if (scene.walls.length === 0) return null;
      const { wallPoint } = nearestPointOnWall([camera.position[0], camera.position[2]], scene.walls);
      const snappedHeight = Math.max(2.4, scene.assumptions.wallHeightM - 0.25);
      return {
        mountType: "wall" as const,
        mountHeightM: snappedHeight,
        position: [wallPoint[0], snappedHeight, wallPoint[1]] as [number, number, number],
        yawDeg: aimTowardSceneCenter(camera, scene),
        pitchDeg: Math.min(camera.pitchDeg, -20),
      };
    }
    case "ceiling": {
      const snappedHeight = Math.max(2.7, scene.assumptions.wallHeightM - 0.12);
      return {
        mountType: "ceiling" as const,
        mountHeightM: snappedHeight,
        position: [camera.position[0], snappedHeight, camera.position[2]] as [number, number, number],
        yawDeg: aimTowardSceneCenter(camera, scene),
        pitchDeg: -75,
      };
    }
    case "pole": {
      const pillar = nearestPillar(scene, camera);
      if (!pillar) return null;
      const snappedHeight = Math.min(
        Math.max(2.2, pillar.position[1] + pillar.dimensions[2] / 2 + 0.25),
        Math.max(2.2, scene.assumptions.wallHeightM - 0.25),
      );
      return {
        mountType: "pole" as const,
        mountHeightM: snappedHeight,
        position: [pillar.position[0], snappedHeight, pillar.position[2]] as [number, number, number],
        yawDeg: aimTowardSceneCenter(camera, scene),
        pitchDeg: -35,
      };
    }
    default:
      return null;
  }
}
