import type { SecurityScene, WallNode } from "@/schema/security-scene";
import { angleDegBetween, nearestPointOnWall, pathLength, pointDistance, snapPoint } from "./editor-geometry";
import type { Point2 } from "./editor-geometry";

export type SnapOptions = {
  snapEnabled: boolean;
  snapDistanceM: number;
  gridSnapM: number;
};

export type SnapProfile = {
  point: Point2;
  snappedToGrid: boolean;
  snappedToWall: boolean;
  snappedToWallEndpoint: boolean;
  wallIndex: number;
  message?: string;
};

export function makeSnapEngine(scene: SecurityScene, options: SnapOptions) {
  const walls: Array<Pick<WallNode, "start" | "end">> = scene.walls;

  const findWallEndpoint = (candidate: Point2) => {
    let nearest: { distance: number; point: Point2; index: number } | null = null;

    walls.forEach((entry, wallIndex) => {
      const candidates: Point2[] = [entry.start, entry.end];
      for (const endpoint of candidates) {
        const dist = pointDistance(candidate, endpoint);
        if (!nearest || dist < nearest.distance) {
          nearest = { distance: dist, point: endpoint, index: wallIndex };
        }
      }
    });

    if (!nearest) return null;
    if (nearest.distance > options.snapDistanceM) return null;
    return nearest;
  };

  const findWallAttachment = (candidate: Point2) => {
    const nearest = nearestPointOnWall(candidate, walls);
    const canSnap = Number.isFinite(nearest.dist) && nearest.dist <= options.snapDistanceM;
    return {
      point: canSnap ? nearest.wallPoint : candidate,
      snapped: canSnap,
      wallIndex: canSnap ? nearest.wallIndex : -1,
      message: canSnap ? "Snapped to wall" : undefined,
    };
  };

  return {
    snapToGrid(point: Point2): Point2 {
      return options.snapEnabled ? snapPoint(point, options.gridSnapM) : point;
    },

    snapForPlacement(point: Point2, snapToWalls = false): SnapProfile {
      const snappedPoint = options.snapEnabled
        ? snapPoint(point, options.gridSnapM)
        : point;
      const wallProfile = findWallAttachment(snappedPoint);

      const wallEndpoint = options.snapEnabled ? findWallEndpoint(snappedPoint) : null;
      if (wallEndpoint && wallEndpoint.distance <= options.snapDistanceM) {
        return {
          point: wallEndpoint.point,
          snappedToGrid: options.snapEnabled,
          snappedToWall: false,
          snappedToWallEndpoint: true,
          wallIndex: wallEndpoint.index,
          message: "Snapped to wall endpoint",
        };
      }

      if (snapToWalls && wallProfile.snapped) {
        return {
          point: wallProfile.point,
          snappedToGrid: options.snapEnabled,
          snappedToWall: true,
          snappedToWallEndpoint: false,
          wallIndex: wallProfile.wallIndex,
          message: wallProfile.message,
        };
      }

      return {
        point: snappedPoint,
        snappedToGrid: options.snapEnabled,
        snappedToWall: false,
        snappedToWallEndpoint: false,
        wallIndex: -1,
      };
    },

    snapToWall(point: Point2): SnapProfile {
      const wallProfile = findWallAttachment(point);
      return {
        point: wallProfile.point,
        snappedToGrid: false,
        snappedToWall: wallProfile.snapped,
        snappedToWallEndpoint: false,
        wallIndex: wallProfile.wallIndex,
        message: wallProfile.message,
      };
    },

    snapToWallEndpoint(point: Point2): SnapProfile {
      const snap = findWallEndpoint(point);
      if (!snap) {
        return {
          point,
          snappedToGrid: false,
          snappedToWall: false,
          snappedToWallEndpoint: false,
          wallIndex: -1,
        };
      }

      return {
        point: snap.point,
        snappedToGrid: false,
        snappedToWall: true,
        snappedToWallEndpoint: true,
        wallIndex: snap.index,
        message: "Snapped to wall endpoint",
      };
    },

    computeWallLength(start: Point2, end: Point2): number {
      return pointDistance(start, end);
    },

    computeSegmentLength(points: Point2[]): number {
      return pathLength(points);
    },

    segmentAngleDeg(start: Point2, end: Point2): number {
      return angleDegBetween(start, end);
    },
  };
}
