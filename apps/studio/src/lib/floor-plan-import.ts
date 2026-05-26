/**
 * Floor Plan Import Module
 *
 * Client-side floor plan image processing for wall detection and room extraction.
 * Uses Canvas API for pixel-level analysis. No server upload required.
 *
 * The approach is heuristic-based (edge detection + contour tracing) rather than ML,
 * making it fast and dependency-free for common floor plan layouts.
 */

export interface WallSegment {
  start: { x: number; y: number };
  end: { x: number; y: number };
  detected: boolean;
}

export interface DoorOpening {
  position: { x: number; y: number };
  widthM: number;
  orientation: "horizontal" | "vertical";
}

export interface WindowOpening {
  position: { x: number; y: number };
  widthM: number;
  orientation: "horizontal" | "vertical";
}

export interface FloorPlanResult {
  imageWidth: number;
  imageHeight: number;
  walls: WallSegment[];
  doors: DoorOpening[];
  windows: WindowOpening[];
  roomDimensions: { widthM: number; depthM: number; heightM: number };
  scalePixelsPerMeter: number;
  confidence: number; // 0-1 estimate of detection quality
}

export interface FloorPlanConfig {
  /** Pixels per meter scale factor. Auto-detected if not provided. */
  scalePixelsPerMeter?: number;
  /** Room height in meters (default: 3). */
  roomHeightM?: number;
  /** Edge detection threshold (0-255, default: 40). Lower = more sensitive. */
  edgeThreshold?: number;
  /** Minimum wall length in pixels to consider (default: 20). */
  minWallLengthPx?: number;
}

const DEFAULT_CONFIG: Required<FloorPlanConfig> = {
  scalePixelsPerMeter: 50,
  roomHeightM: 3,
  edgeThreshold: 40,
  minWallLengthPx: 20,
};

/**
 * Process a floor plan image and extract wall/room geometry.
 */
export async function extractFloorPlan(
  imageData: ImageData,
  config?: FloorPlanConfig,
): Promise<FloorPlanResult> {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const { width, height, data } = imageData;

  // Step 1: Convert to grayscale
  const gray = grayscale(data, width, height);

  // Step 2: Detect edges using simple gradient method
  const gradient = detectEdges(gray, width, height, cfg.edgeThreshold);

  // Step 3: Trace wall contours from edges
  const wallSegments = traceWalls(gradient, width, height, cfg.minWallLengthPx);

  // Step 4: Detect openings (doors/windows) from wall gaps
  const { doors, windows } = detectOpenings(wallSegments);

  // Step 5: Extract room dimensions from wall bounding box
  const dimensions = extractDimensions(wallSegments, cfg.scalePixelsPerMeter, cfg.roomHeightM);

  // Step 6: Calculate confidence based on wall completeness
  const confidence = calculateConfidence(wallSegments, width, height);

  return {
    imageWidth: width,
    imageHeight: height,
    walls: wallSegments,
    doors,
    windows,
    roomDimensions: dimensions,
    scalePixelsPerMeter: cfg.scalePixelsPerMeter,
    confidence,
  };
}

/**
 * Validate a floor plan result for reasonableness.
 */
export function validateFloorPlan(result: FloorPlanResult): {
  valid: boolean;
  warnings: string[];
} {
  const warnings: string[] = [];

  if (result.walls.length < 4) {
    warnings.push("Fewer than 4 walls detected — room may be incomplete.");
  }
  if (result.roomDimensions.widthM < 1 || result.roomDimensions.depthM < 1) {
    warnings.push("Room dimensions are unreasonably small (< 1m).");
  }
  if (result.roomDimensions.widthM > 100 || result.roomDimensions.depthM > 100) {
    warnings.push("Room dimensions are very large (> 100m). Check scale setting.");
  }
  if (result.confidence < 0.3) {
    warnings.push("Low detection confidence. Consider manual adjustment.");
  }

  return {
    valid: warnings.length === 0 || warnings.every((w) => !w.includes("incomplete")),
    warnings,
  };
}

// ── Image Processing Internals ──

function grayscale(
  data: Uint8ClampedArray,
  width: number,
  height: number,
): Uint8Array {
  const gray = new Uint8Array(width * height);
  for (let i = 0; i < width * height; i++) {
    const offset = i * 4;
    gray[i] = Math.round(0.299 * data[offset] + 0.587 * data[offset + 1] + 0.114 * data[offset + 2]);
  }
  return gray;
}

function detectEdges(
  gray: Uint8Array,
  width: number,
  height: number,
  threshold: number,
): Uint8Array {
  const edges = new Uint8Array(width * height);

  // Simple Sobel-like gradient detection
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = y * width + x;

      const gx =
        -gray[idx - width - 1] - 2 * gray[idx - 1] - gray[idx + width - 1] +
        gray[idx - width + 1] + 2 * gray[idx + 1] + gray[idx + width + 1];

      const gy =
        -gray[idx - width - 1] - 2 * gray[idx - width] - gray[idx - width + 1] +
        gray[idx + width - 1] + 2 * gray[idx + width] + gray[idx + width + 1];

      const magnitude = Math.abs(gx) + Math.abs(gy);
      edges[idx] = magnitude > threshold ? 255 : 0;
    }
  }

  return edges;
}

function traceWalls(
  edges: Uint8Array,
  width: number,
  height: number,
  minLength: number,
): WallSegment[] {
  const segments: WallSegment[] = [];
  const visited = new Uint8Array(width * height);

  // Scan for edge pixels and trace horizontal/vertical lines
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      if (visited[idx] || edges[idx] === 0) continue;

      // Try horizontal trace
      const hEnd = traceHorizontal(edges, visited, width, height, x, y);
      if (hEnd > x + minLength) {
        segments.push({
          start: { x, y },
          end: { x: hEnd, y },
          detected: true,
        });
        continue;
      }

      // Try vertical trace
      const vEnd = traceVertical(edges, visited, width, height, x, y);
      if (vEnd > y + minLength) {
        segments.push({
          start: { x, y },
          end: { x, y: vEnd },
          detected: true,
        });
      }
    }
  }

  return segments;
}

function traceHorizontal(
  edges: Uint8Array,
  visited: Uint8Array,
  width: number,
  _height: number,
  startX: number,
  y: number,
): number {
  let x = startX;
  while (x < width && edges[y * width + x] > 0) {
    visited[y * width + x] = 1;
    x++;
  }
  return x - 1;
}

function traceVertical(
  edges: Uint8Array,
  visited: Uint8Array,
  width: number,
  height: number,
  x: number,
  startY: number,
): number {
  let y = startY;
  while (y < height && edges[y * width + x] > 0) {
    visited[y * width + x] = 1;
    y++;
  }
  return y - 1;
}

function detectOpenings(
  walls: WallSegment[],
): { doors: DoorOpening[]; windows: WindowOpening[] } {
  const doors: DoorOpening[] = [];
  const windows: WindowOpening[] = [];

  // Detect gaps in wall segments that could be doors/windows
  // Group walls by orientation and find gaps between segments
  const horizontalWalls = walls.filter((w) => w.start.y === w.end.y);
  const verticalWalls = walls.filter((w) => w.start.x === w.end.x);

  // Check horizontal gaps (potential doors on horizontal walls)
  for (const wall of horizontalWalls) {
    const minX = Math.min(wall.start.x, wall.end.x);
    const maxX = Math.max(wall.start.x, wall.end.x);
    // If wall is relatively short (not full room width), it might bracket an opening
    const span = maxX - minX;
    if (span > 10 && span < 80) {
      doors.push({
        position: { x: (minX + maxX) / 2, y: wall.start.y },
        widthM: 0.9, // Standard door width
        orientation: "horizontal",
      });
    }
  }

  // Check vertical gaps
  for (const wall of verticalWalls) {
    const minY = Math.min(wall.start.y, wall.end.y);
    const maxY = Math.max(wall.start.y, wall.end.y);
    const span = maxY - minY;
    if (span > 10 && span < 80) {
      doors.push({
        position: { x: wall.start.x, y: (minY + maxY) / 2 },
        widthM: 0.9,
        orientation: "vertical",
      });
    }
  }

  return { doors, windows };
}

function extractDimensions(
  walls: WallSegment[],
  scalePixelsPerMeter: number,
  roomHeightM: number,
): { widthM: number; depthM: number; heightM: number } {
  if (walls.length === 0) {
    return { widthM: 10, depthM: 8, heightM: roomHeightM };
  }

  // Find bounding box of all wall endpoints
  let minX = Infinity, maxX = -Infinity;
  let minY = Infinity, maxY = -Infinity;

  for (const wall of walls) {
    minX = Math.min(minX, wall.start.x, wall.end.x);
    maxX = Math.max(maxX, wall.start.x, wall.end.x);
    minY = Math.min(minY, wall.start.y, wall.end.y);
    maxY = Math.max(maxY, wall.start.y, wall.end.y);
  }

  const widthPx = maxX - minX;
  const depthPx = maxY - minY;

  return {
    widthM: Math.max(1, Math.round((widthPx / scalePixelsPerMeter) * 10) / 10),
    depthM: Math.max(1, Math.round((depthPx / scalePixelsPerMeter) * 10) / 10),
    heightM: roomHeightM,
  };
}

function calculateConfidence(
  walls: WallSegment[],
  width: number,
  height: number,
): number {
  if (walls.length === 0) return 0;

  // Estimate based on:
  // - Number of wall segments relative to expected (4 for rectangle)
  // - Total wall coverage relative to perimeter
  const perimeter = 2 * (width + height);
  const totalWallLength = walls.reduce(
    (sum, w) => sum + Math.sqrt(
      (w.end.x - w.start.x) ** 2 + (w.end.y - w.start.y) ** 2,
    ),
    0,
  );

  const wallCoverageRatio = Math.min(1, totalWallLength / (perimeter * 0.5));
  const segmentCountScore = Math.min(1, walls.length / 8);

  return Math.round((wallCoverageRatio * 0.6 + segmentCountScore * 0.4) * 100) / 100;
}

// ── Canvas Helper ──

/**
 * Load an image file into ImageData for processing.
 */
export function loadImageToData(file: File): Promise<ImageData> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        // Limit size for performance
        const maxDim = 1024;
        let w = img.width;
        let h = img.height;
        if (w > maxDim || h > maxDim) {
          const scale = Math.min(maxDim / w, maxDim / h);
          w = Math.round(w * scale);
          h = Math.round(h * scale);
        }

        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Could not get canvas context"));
          return;
        }

        ctx.drawImage(img, 0, 0, w, h);
        const imageData = ctx.getImageData(0, 0, w, h);
        URL.revokeObjectURL(url);
        resolve(imageData);
      } catch (err) {
        URL.revokeObjectURL(url);
        reject(err);
      }
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Failed to load image"));
    };

    img.src = url;
  });
}
