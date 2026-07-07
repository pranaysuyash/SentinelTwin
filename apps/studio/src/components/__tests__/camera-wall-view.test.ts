import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

const cameraWallPath = resolve(fileURLToPath(new URL(".", import.meta.url)), "../", "view/CameraWallView.tsx");

describe("CameraWallView", () => {
  test("surfaces live/offline counts, a layout selector, and the selected camera in the wall header", () => {
    const source = readFileSync(cameraWallPath, "utf8");

    expect(source).toContain("Active {activeCount}");
    expect(source).toContain("Offline {offlineCount}");
    expect(source).toContain("Camera Wall - Multi Camera");
    expect(source).toContain("Selected {selectedCamera?.name ?? \"None\"}");
    expect(source).toContain("Best camera now");
    expect(source).toContain("Zone Quality");
    expect(source).toContain("4 Views");
    expect(source).toContain("6 Views");
    expect(source).toContain("16 Views");
    expect(source).toContain("Auto Layout");
    expect(source).toContain("Synchronized Time");
    expect(source).toContain("Camera Wall Focus Mode");
    expect(source).toContain("Press F to exit focus");
    expect(source).toContain("toggleActiveSurfaceFocus");
    expect(source).toContain("UI_TONES.success.text");
    expect(source).toContain("TYPE_SCALE.caption.class");
    expect(source).toContain("const toggleImmersiveMode = useCallback(() => {");
    expect(source).toContain("window.addEventListener(STUDIO_SHORTCUT_EVENTS.toggleActiveSurfaceFocus, toggleImmersiveMode);");
    expect(source).toContain("Focus");
    expect(source).toContain("const CameraFeedPanel = memo(function CameraFeedPanel");
    expect(source).toContain("const pathVisibilityByCameraId = useMemo(() =>");
  });

  test("surfaces defensive route visibility context per camera tile using path results", () => {
    const source = readFileSync(cameraWallPath, "utf8");

    expect(source).toContain("Route Visibility");
    expect(source).toContain("Strong Route Visibility");
    expect(source).toContain("Partial Route Visibility");
    expect(source).toContain("Weak Route Visibility");
    expect(source).toContain("max {pathVisibility.maxQuality.toUpperCase()}");
    expect(source).toContain("covered •");
    expect(source).toContain("Route Context {activePath.label}");
    expect(source).toContain("Best feed");
    expect(source).toContain("const safePathDuration = clampPathDuration(activePathResult?.totalDurationS);");
    expect(source).toContain("const pathTimeS = safePathDuration * safeReplayProgress;");
    expect(source).toContain("Replay ${pathTimeS.toFixed(1)}s / ${safePathDuration.toFixed(1)}s");
    expect(source).toContain("const ratio = safePathDurationS > 0 ? (pathVisibility?.visibleS ?? 0) / safePathDurationS : 0;");
    expect(source).toContain("if (safePathDuration <= 0) return 0;");
    expect(source).toContain("return vis.visibleS / safePathDuration <= 0.35;");
    expect(source).toContain("Current Replay");
    expect(source).toContain("Actor visible now");
    expect(source).toContain("Actor lost now");
    expect(source).toContain("replayStateByCameraId");
    expect(source).toContain("simulationResult.pathResults.find");
    expect(source).toContain("cameraResultById");
    expect(source).toContain("visibilityByCamera");
    expect(source).toContain("--st-full-canvas-safe-top");
  });

  test("uses shared replay contract utilities and avoids local replay helper duplication", () => {
    const source = readFileSync(cameraWallPath, "utf8");

    expect(source).toContain('from "@/components/view/camera-view-utils"');
    expect(source).toContain("clampPathDuration,");
    expect(source).toContain("clampReplayProgress,");
    expect(source).toContain("orderCamerasForReplayPlayback,");
    expect(source).toContain("buildReplayStateByCameraAtTime,");
    expect(source).toContain("return orderCamerasForReplayPlayback(scene.cameras, selectedCameraId, selectedId);");
    expect(source).not.toContain("function clampReplayProgress(progress: number)");
    expect(source).not.toContain("function clampPathDuration(durationS: number | undefined)");
    expect(source).not.toContain("function buildReplayStateByCameraAtTime(");
    expect(source).toContain("const safeReplayProgress = clampReplayProgress(pathReplay.progress);");
    expect(source).toContain("const replayStateByCameraId = useMemo<Record<string, CameraReplayState | null>>(() =>");
    expect(source).toContain("buildReplayStateByCameraAtTime(activePathResult?.timeline, pathTimeS);");
  });
});
