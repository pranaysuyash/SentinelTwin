"use client";

export type MapBounds = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type SceneSceneBounds = {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
};

export type MapProjectionConfig = {
  sceneBounds: SceneSceneBounds;
  width: number;
  height: number;
  padding?: number;
  zoom?: number;
  pan?: [number, number];
};

type InternalPan = [number, number];

function normalizeSceneBounds(bounds: SceneSceneBounds): SceneSceneBounds {
  if (bounds.minX > bounds.maxX) {
    return { ...bounds, minX: bounds.maxX, maxX: bounds.minX };
  }

  if (bounds.minY > bounds.maxY) {
    return { ...bounds, minY: bounds.maxY, maxY: bounds.minY };
  }

  const width = bounds.maxX - bounds.minX;
  const height = bounds.maxY - bounds.minY;

  const safeWidth = width === 0 ? 1 : width;
  const safeHeight = height === 0 ? 1 : height;

  return {
    minX: bounds.minX,
    minY: bounds.minY,
    maxX: bounds.minX + safeWidth,
    maxY: bounds.minY + safeHeight,
  };
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function deriveScale(
  bounds: SceneSceneBounds,
  width: number,
  height: number,
  padding: number,
): number {
  const spanX = Math.max(0.00001, bounds.maxX - bounds.minX);
  const spanY = Math.max(0.00001, bounds.maxY - bounds.minY);

  const paddedWidth = Math.max(2, width - padding * 2);
  const paddedHeight = Math.max(2, height - padding * 2);

  return Math.min(paddedWidth / spanX, paddedHeight / spanY);
}

function buildTransform(sceneBounds: SceneSceneBounds, width: number, height: number, padding: number, zoom: number) {
  const scale = deriveScale(sceneBounds, width, height, padding) * zoom;
  const spanX = sceneBounds.maxX - sceneBounds.minX;
  const spanY = sceneBounds.maxY - sceneBounds.minY;

  const mapW = spanX * scale;
  const mapH = spanY * scale;

  const baseX = (width - mapW) / 2;
  const baseY = (height - mapH) / 2;

  return { scale, baseX, baseY, mapW, mapH };
}

function sceneBoundsFromPoints(points: Array<[number, number]>): SceneSceneBounds {
  if (points.length === 0) {
    return { minX: 0, minY: 0, maxX: 1, maxY: 1 };
  }

  let minX = points[0]![0];
  let minY = points[0]![1];
  let maxX = points[0]![0];
  let maxY = points[0]![1];

  for (const [x, y] of points) {
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }

  return normalizeSceneBounds({ minX, minY, maxX, maxY });
}

export function createDefaultSceneBounds(width: number, depth: number): SceneSceneBounds {
  return normalizeSceneBounds({
    minX: 0,
    minY: 0,
    maxX: Math.max(width, 1),
    maxY: Math.max(depth, 1),
  });
}

export function inferSceneBounds(
  dimensions: { width: number; depth: number },
  extras: Array<[number, number]>,
): SceneSceneBounds {
  const base = sceneBoundsFromPoints([
    [0, 0],
    [dimensions.width, 0],
    [dimensions.width, dimensions.depth],
    [0, dimensions.depth],
    ...extras,
  ]);

  return base;
}

export interface MapProjection {
  sceneToSvg(point: [number, number]): { x: number; y: number };
  svgToScene(point: { x: number; y: number }): [number, number];
  lengthToSvg(meters: number): number;
  bounds: MapBounds;
  scale: number;
}

export class MapProjectionImpl {
  readonly sceneBounds: SceneSceneBounds;
  readonly svgWidth: number;
  readonly svgHeight: number;
  readonly padding: number;
  readonly zoom: number;
  readonly pan: InternalPan;
  readonly scale: number;
  readonly bounds: MapBounds;

  private readonly baseX: number;
  private readonly baseY: number;

  constructor(config: MapProjectionConfig) {
    const normalized = normalizeSceneBounds(config.sceneBounds);
    const width = Math.max(1, config.width);
    const height = Math.max(1, config.height);
    const padding = clamp(config.padding ?? 6, 0, Math.min(width, height) * 0.48);
    const zoom = Math.max(0.05, config.zoom ?? 1);
    const pan = config.pan ?? [0, 0];

    const transform = buildTransform(normalized, width, height, padding, zoom);

    this.sceneBounds = normalized;
    this.svgWidth = width;
    this.svgHeight = height;
    this.padding = padding;
    this.zoom = zoom;
    this.pan = [pan[0], pan[1]];
    this.scale = transform.scale;
    this.baseX = transform.baseX + pan[0];
    this.baseY = transform.baseY + pan[1];

    this.bounds = {
      x: this.baseX,
      y: this.baseY,
      width: transform.mapW,
      height: transform.mapH,
    };
  }

  sceneToSvg = (point: [number, number]) => {
    return {
      x: (point[0] - this.sceneBounds.minX) * this.scale + this.baseX,
      y: (point[1] - this.sceneBounds.minY) * this.scale + this.baseY,
    };
  };

  svgToScene = (point: { x: number; y: number }): [number, number] => {
    return [
      (point.x - this.baseX) / this.scale + this.sceneBounds.minX,
      (point.y - this.baseY) / this.scale + this.sceneBounds.minY,
    ];
  };

  lengthToSvg = (meters: number) => {
    return Math.abs(meters * this.scale);
  };

  getSceneBoundsForDebug() {
    return this.sceneBounds;
  }

  clampPan(pan: InternalPan): InternalPan {
    const minX = clamp(pan[0], this.svgWidth * -1, this.svgWidth * 2);
    const minY = clamp(pan[1], this.svgHeight * -1, this.svgHeight * 2);
    return [minX, minY];
  }

  withPan(nextPan: InternalPan) {
    return new MapProjectionImpl({
      sceneBounds: this.sceneBounds,
      width: this.svgWidth,
      height: this.svgHeight,
      padding: this.padding,
      zoom: this.zoom,
      pan: this.clampPan(nextPan),
    });
  }

  withZoom(nextZoom: number) {
    return new MapProjectionImpl({
      sceneBounds: this.sceneBounds,
      width: this.svgWidth,
      height: this.svgHeight,
      padding: this.padding,
      zoom: clamp(nextZoom, 0.05, 6),
      pan: this.pan,
    });
  }

  withFit() {
    return new MapProjectionImpl({
      sceneBounds: this.sceneBounds,
      width: this.svgWidth,
      height: this.svgHeight,
      padding: this.padding,
      zoom: 1,
      pan: [0, 0],
    });
  }

  projectToSceneDelta(deltaPx: InternalPan): InternalPan {
    return [deltaPx[0] / this.scale, deltaPx[1] / this.scale];
  }
}

export function createMapProjection(config: MapProjectionConfig): MapProjection {
  return new MapProjectionImpl(config);
}
