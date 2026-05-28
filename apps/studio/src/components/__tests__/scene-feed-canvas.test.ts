import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const sceneFeedPath = "/Users/pranay/Projects/SentinelTwin/apps/studio/src/components/view/SceneFeedCanvas.tsx";

describe("SceneFeedCanvas camera rigs", () => {
  test("keeps wall camera rig synchronized to live camera transforms", () => {
    const source = readFileSync(sceneFeedPath, "utf8");

    expect(source).toContain("CameraRigFixed");
    expect(source).toContain("camData.id");
    expect(source).toContain("camData.position");
    expect(source).not.toContain("initialized.current");
    expect(source).toContain("selectable={false}");
    expect(source).toContain("onSelect={() => {}}");
  });
});
