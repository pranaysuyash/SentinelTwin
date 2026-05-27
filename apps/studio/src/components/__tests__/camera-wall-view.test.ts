import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const cameraWallPath = "/Users/pranay/Projects/SentinelTwin/apps/studio/src/components/view/CameraWallView.tsx";

describe("CameraWallView", () => {
  test("surfaces live/offline counts, a layout selector, and the selected camera in the wall header", () => {
    const source = readFileSync(cameraWallPath, "utf8");

    expect(source).toContain("Active {activeCount}");
    expect(source).toContain("Offline {offlineCount}");
    expect(source).toContain("Selected {selectedCamera?.name ?? \"None\"}");
    expect(source).toContain("4 Views");
    expect(source).toContain("6 Views");
    expect(source).toContain("Layout");
  });
});
