import type { SecurityScene } from "@/schema/security-scene";
import { pointInPolygon } from "@/simulation/geometry";

export type GridCell = {
  id: string;
  x: number;
  z: number;
  walkable: boolean;
};

export function buildCoverageGrid(scene: SecurityScene, cellsPerMeter = 4) {
  const cells: GridCell[] = [];
  const cellSize = 1 / cellsPerMeter;
  const cols = Math.round(scene.dimensions.width * cellsPerMeter);
  const rows = Math.round(scene.dimensions.depth * cellsPerMeter);

  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      const x = col * cellSize + cellSize / 2;
      const z = row * cellSize + cellSize / 2;
      const point: [number, number] = [x, z];

      const blockedByObstruction = scene.obstructions.some((obstruction) => {
        const [width, depth] = obstruction.dimensions;
        const [ox, , oz] = obstruction.position;
        return (
          Math.abs(point[0] - ox) <= width / 2 &&
          Math.abs(point[1] - oz) <= depth / 2 &&
          obstruction.visionTransmission < 0.25
        );
      });

      const insidePrivacyZone = scene.privacyZones.some((zone) =>
        pointInPolygon(point, zone.polygon),
      );

      cells.push({
        id: `cell_${col}_${row}`,
        x,
        z,
        walkable: !blockedByObstruction && !insidePrivacyZone,
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
