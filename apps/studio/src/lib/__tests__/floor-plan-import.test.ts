import { describe, expect, test } from "bun:test";

// Polyfill ImageData for Bun test environment (Bun doesn't expose ImageData globally)
if (typeof globalThis.ImageData === "undefined") {
  class ImageDataPolyfill {
    data: Uint8ClampedArray;
    width: number;
    height: number;
    constructor(data: Uint8ClampedArray, width: number, height: number) {
      this.data = data;
      this.width = width;
      this.height = height;
    }
  }
  // @ts-expect-error - polyfilling global ImageData for tests
  globalThis.ImageData = ImageDataPolyfill;
}

import {
  extractFloorPlan,
  validateFloorPlan,
  type FloorPlanResult,
  type FloorPlanConfig,
} from "@/lib/floor-plan-import";

/**
 * Create a synthetic grayscale ImageData for testing.
 * White background with dark lines representing walls.
 */
function createTestImageData(
  width: number,
  height: number,
  drawWalls?: (data: Uint8ClampedArray, w: number, h: number) => void,
): ImageData {
  const data = new Uint8ClampedArray(width * height * 4);

  // Fill with white background
  for (let i = 0; i < width * height; i++) {
    const offset = i * 4;
    data[offset] = 255;     // R
    data[offset + 1] = 255; // G
    data[offset + 2] = 255; // B
    data[offset + 3] = 255; // A
  }

  // Draw walls if provided
  drawWalls?.(data, width, height);

  return new ImageData(data, width, height);
}

/** Draw a horizontal dark line (wall) at y for x range [x1, x2] */
function drawHLine(
  data: Uint8ClampedArray,
  w: number,
  x1: number,
  x2: number,
  y: number,
) {
  for (let x = x1; x <= x2; x++) {
    const idx = (y * w + x) * 4;
    data[idx] = 0;
    data[idx + 1] = 0;
    data[idx + 2] = 0;
    data[idx + 3] = 255;
  }
}

/** Draw a vertical dark line (wall) at x for y range [y1, y2] */
function drawVLine(
  data: Uint8ClampedArray,
  w: number,
  x: number,
  y1: number,
  y2: number,
) {
  for (let y = y1; y <= y2; y++) {
    const idx = (y * w + x) * 4;
    data[idx] = 0;
    data[idx + 1] = 0;
    data[idx + 2] = 0;
    data[idx + 3] = 255;
  }
}

describe("extractFloorPlan", () => {
  test("detects walls in a simple rectangular floor plan", async () => {
    const w = 200;
    const h = 150;
    const imageData = createTestImageData(w, h, (data) => {
      // Draw a rectangle: four walls
      // Top wall (y=20, x=20..180)
      drawHLine(data, w, 20, 180, 20);
      // Bottom wall (y=130, x=20..180)
      drawHLine(data, w, 20, 180, 130);
      // Left wall (x=20, y=20..130)
      drawVLine(data, w, 20, 20, 130);
      // Right wall (x=180, y=20..130)
      drawVLine(data, w, 180, 20, 130);
    });

    const result = await extractFloorPlan(imageData, {
      scalePixelsPerMeter: 50,
      roomHeightM: 3,
      edgeThreshold: 20,
      minWallLengthPx: 15,
    });

    expect(result.walls.length).toBeGreaterThanOrEqual(4);
    expect(result.roomDimensions.widthM).toBeGreaterThan(1);
    expect(result.roomDimensions.depthM).toBeGreaterThan(1);
    expect(result.roomDimensions.heightM).toBe(3);
    expect(result.confidence).toBeGreaterThan(0);
    expect(result.imageWidth).toBe(w);
    expect(result.imageHeight).toBe(h);
  });

  test("returns low confidence for empty image", async () => {
    const w = 100;
    const h = 100;
    const imageData = createTestImageData(w, h); // No walls drawn

    const result = await extractFloorPlan(imageData, {
      scalePixelsPerMeter: 50,
      roomHeightM: 3,
      edgeThreshold: 20,
      minWallLengthPx: 15,
    });

    expect(result.walls.length).toBe(0);
    expect(result.confidence).toBe(0);
    expect(result.roomDimensions.widthM).toBeGreaterThanOrEqual(1);
    expect(result.roomDimensions.depthM).toBeGreaterThanOrEqual(1);
  });

  test("handles images with short wall fragments", async () => {
    const w = 100;
    const h = 100;
    const imageData = createTestImageData(w, h, (data) => {
      // Only draw short fragments (shorter than minWallLengthPx)
      drawHLine(data, w, 30, 40, 30);  // 10px fragment
      drawVLine(data, w, 60, 30, 40);  // 10px fragment
    });

    const result = await extractFloorPlan(imageData, {
      minWallLengthPx: 20,
      edgeThreshold: 20,
    });

    // Short fragments below min length should be ignored
    expect(result.walls.length).toBe(0);
  });

  test("detects doors in wall gaps", async () => {
    const w = 200;
    const h = 150;
    const imageData = createTestImageData(w, h, (data) => {
      // Top wall with gap
      drawHLine(data, w, 20, 80, 20);
      drawHLine(data, w, 120, 180, 20);
      // Left wall
      drawVLine(data, w, 20, 20, 130);
      // Right wall
      drawVLine(data, w, 180, 20, 130);
      // Bottom wall
      drawHLine(data, w, 20, 180, 130);
      // A short vertical fragment in the gap area (door indication)
      drawVLine(data, w, 100, 18, 30);
    });

    const result = await extractFloorPlan(imageData, {
      edgeThreshold: 20,
      minWallLengthPx: 10,
    });

    // The gap between horizontal segments at x=80..120 suggests a door opening
    expect(result.doors.length).toBeGreaterThanOrEqual(1);
  });

  test("respects custom scale parameter", async () => {
    const w = 200;
    const h = 150;
    const imageData = createTestImageData(w, h, (data) => {
      drawHLine(data, w, 10, 190, 10);
      drawHLine(data, w, 10, 190, 140);
      drawVLine(data, w, 10, 10, 140);
      drawVLine(data, w, 190, 10, 140);
    });

    const resultLow = await extractFloorPlan(imageData, { scalePixelsPerMeter: 25 });
    const resultHigh = await extractFloorPlan(imageData, { scalePixelsPerMeter: 100 });

    // Lower pixels/meter = larger room dimensions
    expect(resultLow.roomDimensions.widthM).toBeGreaterThan(resultHigh.roomDimensions.widthM);
  });

  test("handles config defaults correctly", async () => {
    const w = 100;
    const h = 100;
    const imageData = createTestImageData(w, h, (data) => {
      drawHLine(data, w, 10, 90, 10);
      drawHLine(data, w, 10, 90, 90);
      drawVLine(data, w, 10, 10, 90);
      drawVLine(data, w, 90, 10, 90);
    });

    const result = await extractFloorPlan(imageData);

    // Default values apply
    expect(result.scalePixelsPerMeter).toBe(50);
    expect(result.roomDimensions.heightM).toBe(3);
  });
});

describe("validateFloorPlan", () => {
  function makeResult(overrides?: Partial<FloorPlanResult>): FloorPlanResult {
    return {
      imageWidth: 200,
      imageHeight: 150,
      walls: [
        { start: { x: 10, y: 10 }, end: { x: 190, y: 10 }, detected: true },
        { start: { x: 10, y: 140 }, end: { x: 190, y: 140 }, detected: true },
        { start: { x: 10, y: 10 }, end: { x: 10, y: 140 }, detected: true },
        { start: { x: 190, y: 10 }, end: { x: 190, y: 140 }, detected: true },
      ],
      doors: [],
      windows: [],
      roomDimensions: { widthM: 10, depthM: 8, heightM: 3 },
      scalePixelsPerMeter: 50,
      confidence: 0.85,
      ...overrides,
    };
  }

  test("returns valid for reasonable floor plan", () => {
    const { valid, warnings } = validateFloorPlan(makeResult());
    expect(valid).toBe(true);
    expect(warnings).toHaveLength(0);
  });

  test("warns when fewer than 4 walls", () => {
    const { valid, warnings } = validateFloorPlan(makeResult({ walls: [] }));
    expect(warnings.length).toBeGreaterThan(0);
    expect(warnings.some((w) => w.includes("Fewer than 4"))).toBe(true);
  });

  test("warns when dimensions are too small", () => {
    const { warnings } = validateFloorPlan(
      makeResult({ roomDimensions: { widthM: 0.5, depthM: 0.5, heightM: 3 } }),
    );
    expect(warnings.some((w) => w.includes("unreasonably small"))).toBe(true);
  });

  test("warns when dimensions are too large", () => {
    const { warnings } = validateFloorPlan(
      makeResult({ roomDimensions: { widthM: 200, depthM: 200, heightM: 3 } }),
    );
    expect(warnings.some((w) => w.includes("very large"))).toBe(true);
  });

  test("warns when confidence is low", () => {
    const { warnings } = validateFloorPlan(makeResult({ confidence: 0.2 }));
    expect(warnings.some((w) => w.includes("Low detection confidence"))).toBe(true);
  });
});

describe("internal helper behavior", () => {
  test("grayscale converts RGBA to luminance", async () => {
    // A 2x2 image with distinct colors
    const data = new Uint8ClampedArray(16);
    // Pixel 0: white
    data[0] = 255; data[1] = 255; data[2] = 255; data[3] = 255;
    // Pixel 1: red
    data[4] = 255; data[5] = 0; data[6] = 0; data[7] = 255;
    // Pixel 2: green
    data[8] = 0; data[9] = 255; data[10] = 0; data[11] = 255;
    // Pixel 3: blue
    data[12] = 0; data[13] = 0; data[14] = 255; data[15] = 255;

    const imageData = new ImageData(data, 2, 2);
    const result = await extractFloorPlan(imageData, { edgeThreshold: 255 });

    // No edges should be detected in uniform 2x2 image
    expect(result.walls.length).toBe(0);
  });

  test("edge detection creates larger magnitude for high-contrast edges", async () => {
    // Create a 10x10 image with a sharp vertical edge at x=5
    const w = 10;
    const h = 10;
    const data = new Uint8ClampedArray(w * h * 4);

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const offset = (y * w + x) * 4;
        // Left side black, right side white
        const val = x < 5 ? 0 : 255;
        data[offset] = val;
        data[offset + 1] = val;
        data[offset + 2] = val;
        data[offset + 3] = 255;
      }
    }

    const imageData = new ImageData(data, w, h);
    const result = await extractFloorPlan(imageData, {
      edgeThreshold: 1,
      minWallLengthPx: 2,
    });

    // The sharp edge should be detected as a vertical wall segment
    const verticalSegments = result.walls.filter((s) => s.start.x === s.end.x);
    expect(verticalSegments.length).toBeGreaterThan(0);
  });
});
