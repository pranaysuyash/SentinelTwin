import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

const wallViewPath = resolve(fileURLToPath(new URL(".", import.meta.url)), "../CameraWallView.tsx");
const cameraViewPath = resolve(fileURLToPath(new URL(".", import.meta.url)), "../CameraViewMode.tsx");
const pathReplayPath = resolve(fileURLToPath(new URL(".", import.meta.url)), "../PathReplayView.tsx");

function sourceContains(path: string, text: string) {
  return readFileSync(path, "utf8").includes(text);
}

describe("CameraWall dense-mode performance guard (I8)", () => {
  test("DenseModePerfGuard component is defined", () => {
    const source = readFileSync(wallViewPath, "utf8");
    expect(source).toContain("function DenseModePerfGuard");
  });

  test("DenseModePerfGuard is rendered only when effective layout is dense", () => {
    const source = readFileSync(wallViewPath, "utf8");
    // The guard must NOT appear unconditionally — only when the user
    // is in dense mode. The narrow placement also keeps the warning
    // scoped to the exact surface that's expensive.
    expect(source).toMatch(/effectiveLayout === "dense"\s*\?\s*\(\s*<DenseModePerfGuard/);
  });

  test("DenseModePerfGuard has a dismiss control so operators can clear it", () => {
    const source = readFileSync(wallViewPath, "utf8");
    expect(source).toContain("wall-dense-perf-guard");
    // The component keeps a `dismissed` state and returns null when
    // dismissed. A clickable dismiss control must exist in the
    // rendered output.
    expect(source).toMatch(/aria-label="Dismiss dense-mode performance warning for this session"/);
  });

  test("dense layout button has a stable test id for automation", () => {
    const source = readFileSync(wallViewPath, "utf8");
    expect(source).toContain("wall-layout-dense");
  });
});

describe("CameraWall adaptive DPR + PerformanceMonitor integration", () => {
  test("imports PerformanceMonitor and AdaptiveDpr from @react-three/drei", () => {
    const source = readFileSync(wallViewPath, "utf8");
    expect(source).toContain('PerformanceMonitor');
    expect(source).toContain('AdaptiveDpr');
    expect(source).toContain('from "@react-three/drei"');
  });

  test("wraps the synthetic POV canvas in PerformanceMonitor with AdaptiveDpr", () => {
    const source = readFileSync(wallViewPath, "utf8");
    // Expect a Canvas containing a PerformanceMonitor containing AdaptiveDpr.
    const perfIndex = source.indexOf("<PerformanceMonitor");
    const adaptiveIndex = source.indexOf("<AdaptiveDpr");
    const canvasIndex = source.indexOf("<Canvas");
    expect(canvasIndex).toBeGreaterThanOrEqual(0);
    expect(perfIndex).toBeGreaterThan(canvasIndex);
    expect(adaptiveIndex).toBeGreaterThan(perfIndex);
  });

  test("uses the shared adaptive DPR budget constants", () => {
    const source = readFileSync(wallViewPath, "utf8");
    expect(source).toContain('WALL_PERF_MONITOR_ITERATIONS');
    expect(source).toContain('WALL_PERF_MONITOR_MS');
    expect(source).toContain('WALL_PERF_DPR_STEP');
    expect(source).toContain('WALL_PERF_FLIPFLOPS');
    expect(source).toContain('wallPerformanceBounds');
    expect(source).toContain('computeWallTileDpr');
  });

  test("passes isDense prop through slot button into CameraFeedPanel", () => {
    const source = readFileSync(wallViewPath, "utf8");
    expect(source).toContain('isDense?: boolean;');
    expect(source).toContain('isDense={isDense}');
    expect(source).toMatch(/CameraSlotButton[\s\S]*?isDense\s*={\s*isDense\s*}/);
  });
});

describe("Single-canvas adaptive DPR integration", () => {
  test("CameraViewMode imports PerformanceMonitor and AdaptiveDpr", () => {
    expect(sourceContains(cameraViewPath, 'PerformanceMonitor')).toBe(true);
    expect(sourceContains(cameraViewPath, 'AdaptiveDpr')).toBe(true);
    expect(sourceContains(cameraViewPath, 'from "@react-three/drei"')).toBe(true);
  });

  test("CameraViewMode uses single-canvas budget constants", () => {
    const source = readFileSync(cameraViewPath, "utf8");
    expect(source).toContain('SINGLE_PERF_MONITOR_ITERATIONS');
    expect(source).toContain('SINGLE_PERF_MONITOR_MS');
    expect(source).toContain('SINGLE_PERF_DPR_STEP');
    expect(source).toContain('SINGLE_PERF_FLIPFLOPS');
    expect(source).toContain('singlePerformanceBounds');
    expect(source).toContain('computeSingleCanvasDpr');
  });

  test("CameraViewMode wraps its Canvas children in PerformanceMonitor with AdaptiveDpr", () => {
    const source = readFileSync(cameraViewPath, "utf8");
    const perfIndex = source.indexOf("<PerformanceMonitor");
    const adaptiveIndex = source.indexOf("<AdaptiveDpr");
    const canvasIndex = source.indexOf("<Canvas");
    expect(canvasIndex).toBeGreaterThanOrEqual(0);
    expect(perfIndex).toBeGreaterThan(canvasIndex);
    expect(adaptiveIndex).toBeGreaterThan(perfIndex);
  });

  test("PathReplayView imports PerformanceMonitor and AdaptiveDpr", () => {
    expect(sourceContains(pathReplayPath, 'PerformanceMonitor')).toBe(true);
    expect(sourceContains(pathReplayPath, 'AdaptiveDpr')).toBe(true);
    expect(sourceContains(pathReplayPath, 'from "@react-three/drei"')).toBe(true);
  });

  test("PathReplayView uses single-canvas budget constants", () => {
    const source = readFileSync(pathReplayPath, "utf8");
    expect(source).toContain('SINGLE_PERF_MONITOR_ITERATIONS');
    expect(source).toContain('SINGLE_PERF_MONITOR_MS');
    expect(source).toContain('SINGLE_PERF_DPR_STEP');
    expect(source).toContain('SINGLE_PERF_FLIPFLOPS');
    expect(source).toContain('singlePerformanceBounds');
    expect(source).toContain('computeSingleCanvasDpr');
  });

  test("PathReplayView wraps its Canvas children in PerformanceMonitor with AdaptiveDpr", () => {
    const source = readFileSync(pathReplayPath, "utf8");
    const perfIndex = source.indexOf("<PerformanceMonitor");
    const adaptiveIndex = source.indexOf("<AdaptiveDpr");
    const canvasIndex = source.indexOf("<Canvas");
    expect(canvasIndex).toBeGreaterThanOrEqual(0);
    expect(perfIndex).toBeGreaterThan(canvasIndex);
    expect(adaptiveIndex).toBeGreaterThan(perfIndex);
  });
});
