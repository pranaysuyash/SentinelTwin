import { describe, expect, test } from "bun:test";

import { createSmallRetailShopScene } from "@/demo-scenes/small-retail-shop";
import { parseOfflineCommand } from "@/lib/offline-command-parser";

describe("offline-command-parser", () => {
  test("parses a natural-language camera aim toward the entry", () => {
    const scene = createSmallRetailShopScene();
    const plan = parseOfflineCommand("Move Camera 1 toward the entry", scene);

    expect(plan).not.toBeNull();
    expect(plan?.message).toContain("Aimed Camera 1 at entry");
    expect(plan?.operations).toHaveLength(1);
    expect(plan?.operations[0]).toMatchObject({
      type: "rotate_camera",
      cameraId: scene.cameras[0]?.id,
    });
  });

  test("parses quick offline utility commands without an API key", () => {
    const scene = createSmallRetailShopScene();

    const privacyPlan = parseOfflineCommand("privacy on", scene);
    expect(privacyPlan).not.toBeNull();
    expect(privacyPlan?.action).toMatchObject({
      type: "set_layer_visibility",
      layer: "privacy_zones",
      visible: true,
    });

    const reportPlan = parseOfflineCommand("open report", scene);
    expect(reportPlan).not.toBeNull();
    expect(reportPlan?.action).toMatchObject({
      type: "set_bottom_tab",
      tab: "report",
    });

    const snapshotPlan = parseOfflineCommand("save snapshot", scene);
    expect(snapshotPlan).not.toBeNull();
    expect(snapshotPlan?.action?.type).toBe("save_snapshot");
  });
});
