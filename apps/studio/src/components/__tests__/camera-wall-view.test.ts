import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const cameraWallPath = "./src/components/view/CameraWallView.tsx";

describe("CameraWallView", () => {
  test("surfaces live/offline counts, a layout selector, and the selected camera in the wall header", () => {
    const source = readFileSync(cameraWallPath, "utf8");

    expect(source).toContain("Active {activeCount}");
    expect(source).toContain("Offline {offlineCount}");
    expect(source).toContain("Selected {selectedCamera?.name ?? \"None\"}");
    expect(source).toContain("Best camera now");
    expect(source).toContain("4-Panel Layout");
    expect(source).toContain("6-Panel Layout");
    expect(source).toContain("Layout");
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
    expect(source).toContain("Route Context {activePath.label}");
    expect(source).toContain("Best feed");
    expect(source).toContain("simulationResult.pathResults.find");
    expect(source).toContain("visibilityByCamera");
  });
});
