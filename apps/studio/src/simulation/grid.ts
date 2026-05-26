import type { SecurityScene } from "@/schema/security-scene";
import { pointInPolygon } from "@/simulation/geometry";

export type GridCell = {
  id: string;
  x: number;
  z: number;
  walkable: boolean;
  coverageIncluded: boolean;
  privacyRestricted: boolean;
};

function isPointInsideOrientedRectangle(
  point: [number, number],
  center: [number, number],
  width: number,
  depth: number,
  rotationDeg: number,
) {
  const [px, pz] = point;
  const [cx, cz] = center;
  const halfWidth = width / 2;
  const halfDepth = depth / 2;

  const dx = px - cx;
  const dz = pz - cz;
  const radians = (rotationDeg * Math.PI) / 180;
  const cosR = Math.cos(-radians);
  const sinR = Math.sin(-radians);

  const localX = dx * cosR - dz * sinR;
  const localZ = dx * sinR + dz * cosR;

  return (
    Math.abs(localX) <= halfWidth &&
    Math.abs(localZ) <= halfDepth
  );
}

export function buildCoverageGrid(scene: SecurityScene, cellsPerMeter = 4) {
  const cells: GridCell[] = [];
  const cellSize = 1 / cellsPerMeter;
  const cols = Math.round(scene.dimensions.width * cellsPerMeter);
  const rows = Math.round(scene.dimensions.depth * cellsPerMeter);

  const isInsideClosedDoor = (point: [number, number]) =>
    scene.doors.some((door) => {
      const doorState = String(door.state);
      if (doorState === "open") return false;

      const [width, , thickness] = door.dimensions;
      const [dx, , dz] = door.position;
      const halfWidth = width / 2;
      const halfDepth = Math.max(thickness, 0.08) / 2;

      return (
        Math.abs(point[0] - dx) <= halfWidth &&
        Math.abs(point[1] - dz) <= halfDepth
      );
    });

  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      const x = col * cellSize + cellSize / 2;
      const z = row * cellSize + cellSize / 2;
      const point: [number, number] = [x, z];

      const blockedByObstruction = scene.obstructions.some((obstruction) => {
        const [width, , depth] = obstruction.dimensions;
        const [ox, , oz] = obstruction.position;
        if (obstruction.visionTransmission >= 0.25) return false;
        return isPointInsideOrientedRectangle(
          point,
          [ox, oz],
          Math.max(width, 0.01),
          Math.max(depth, 0.01),
          obstruction.rotationYDeg,
        );
      });

      const privacyRestricted = scene.privacyZones.some((zone) =>
        pointInPolygon(point, zone.polygon),
      );

      const walkable = !blockedByObstruction && !isInsideClosedDoor(point);

      cells.push({
        id: `cell_${col}_${row}`,
        x,
        z,
        walkable,
        coverageIncluded: walkable && !privacyRestricted,
        privacyRestricted,
      });
    }
  }

  return {
    cells,
    cols,
    rows,
    cellSize,
  };
}
