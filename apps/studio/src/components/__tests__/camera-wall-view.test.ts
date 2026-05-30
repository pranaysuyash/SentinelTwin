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
    expect(source).toContain("const pathTimeS = activePathResult && activePathResult.totalDurationS > 0");
    expect(source).toContain("Replay ${pathTimeS.toFixed(1)}s / ${activePathResult.totalDurationS.toFixed(1)}s");
    expect(source).toContain("Current Replay");
    expect(source).toContain("Actor visible now");
    expect(source).toContain("Actor lost now");
    expect(source).toContain("replayStateByCameraId");
    expect(source).toContain("event.event === \"visible\"");
    expect(source).toContain("event.event === \"lost\"");
    expect(source).toContain("event.event === \"quality_change\"");
    expect(source).toContain("simulationResult.pathResults.find");
    expect(source).toContain("cameraResultById");
    expect(source).toContain("visibilityByCamera");
  });
});
