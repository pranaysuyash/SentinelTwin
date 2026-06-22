import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const componentPaths = [
  join(import.meta.dir, "../..", "components/view/CameraViewMode.tsx"),
  join(import.meta.dir, "../..", "components/view/CameraWallView.tsx"),
  join(import.meta.dir, "../..", "components/view/CompareView.tsx"),
  join(import.meta.dir, "../..", "components/view/PathReplayView.tsx"),
  join(import.meta.dir, "../..", "components/inspector/CameraFeedCanvas.tsx"),
  join(import.meta.dir, "../..", "components/workspace/WorkspaceCanvas.tsx"),
];

describe("three-compat shim", () => {
  test("is imported before each R3F canvas entry point", () => {
    for (const path of componentPaths) {
      const source = readFileSync(path, "utf8");
      expect(source).toContain('import "@/lib/three-compat";');
    }
  });
});
