import type {
  AnyEditableNode,
  ScenarioPath,
  SecurityScene,
} from "@/schema/security-scene";

export type Bounds2D = {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
};

export function normalizeBounds(a: [number, number], b: [number, number]): Bounds2D {
  return {
    minX: Math.min(a[0], b[0]),
    maxX: Math.max(a[0], b[0]),
    minZ: Math.min(a[1], b[1]),
    maxZ: Math.max(a[1], b[1]),
  };
}

function inflateBounds(bounds: Bounds2D, padding: number): Bounds2D {
  return {
    minX: bounds.minX - padding,
    maxX: bounds.maxX + padding,
    minZ: bounds.minZ - padding,
    maxZ: bounds.maxZ + padding,
  };
}

function boundsFromPoint(point: [number, number], padding: number): Bounds2D {
  return inflateBounds({ minX: point[0], maxX: point[0], minZ: point[1], maxZ: point[1] }, padding);
}

function boundsFromPolygon(points: [number, number][]): Bounds2D | null {
  if (points.length === 0) return null;
  const xs = points.map(([x]) => x);
  const zs = points.map(([, z]) => z);
  return {
    minX: Math.min(...xs),
    maxX: Math.max(...xs),
    minZ: Math.min(...zs),
    maxZ: Math.max(...zs),
  };
}

function boundsFromPath(path: ScenarioPath): Bounds2D | null {
  const points = path.points.map((point) => point.position);
  if (points.length === 0) return null;
  return boundsFromPolygon(points);
}

export function getNodeSelectionBounds(node: AnyEditableNode): Bounds2D | null {
  if (node.nodeType === "camera") {
    return boundsFromPoint([node.position[0], node.position[2]], 0.5);
  }

  if (node.nodeType === "security_light") {
    return boundsFromPoint([node.position[0], node.position[2]], 0.45);
  }

  if (node.nodeType === "obstruction") {
    const [width, depth] = node.dimensions;
    return boundsFromPoint([node.position[0], node.position[2]], Math.max(width, depth) / 2 + 0.25);
  }

  if (node.nodeType === "wall") {
    return normalizeBounds(node.start, node.end);
  }

  if (node.nodeType === "critical_zone" || node.nodeType === "privacy_zone") {
    return boundsFromPolygon(node.polygon);
  }

  if (node.nodeType === "path") {
    return boundsFromPath(node);
  }

  if (node.nodeType === "door" || node.nodeType === "window") {
    return boundsFromPoint([node.position[0], node.position[2]], 0.6);
  }

  if (node.nodeType === "entry_point") {
    return boundsFromPoint([node.position[0], node.position[1]], 0.35);
  }

  return null;
}

export function boundsIntersect(a: Bounds2D, b: Bounds2D): boolean {
  return !(a.maxX < b.minX || a.minX > b.maxX || a.maxZ < b.minZ || a.minZ > b.maxZ);
}

export function getSceneSelectionIds(scene: SecurityScene, bounds: Bounds2D): string[] {
  const nodes: AnyEditableNode[] = [
    ...scene.walls,
    ...scene.doors,
    ...scene.windows,
    ...scene.cameras,
    ...scene.securityLights,
    ...scene.obstructions,
    ...scene.criticalZones,
    ...scene.privacyZones,
    ...scene.entryPoints,
    ...scene.paths,
  ];

  return nodes
    .filter((node) => {
      const nodeBounds = getNodeSelectionBounds(node);
      return nodeBounds ? boundsIntersect(nodeBounds, bounds) : false;
    })
    .map((node) => node.id);
}
