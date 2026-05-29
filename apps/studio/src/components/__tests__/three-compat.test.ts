import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const componentPaths = [
  "./src/components/view/CameraViewMode.tsx",
  "./src/components/view/CameraWallView.tsx",
  "./src/components/view/CompareView.tsx",
  "./src/components/view/PathReplayView.tsx",
  "./src/components/inspector/CameraFeedCanvas.tsx",
  "./src/components/workspace/WorkspaceCanvas.tsx",
];

describe("three-compat shim", () => {
  test("is imported before each R3F canvas entry point", () => {
    for (const path of componentPaths) {
      const source = readFileSync(path, "utf8");
      expect(source).toContain('import "@/lib/three-compat";');
    }
  });
});
