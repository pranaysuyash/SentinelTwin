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

    const blindspotPlan = parseOfflineCommand("show worst blindspot", scene);
    expect(blindspotPlan).not.toBeNull();
    expect(blindspotPlan?.action).toMatchObject({
      type: "set_bottom_tab",
      tab: "issues",
    });
  });

  test("parses tilt/add obstruction/move obstruction intents", () => {
    const scene = createSmallRetailShopScene();

    const tiltPlan = parseOfflineCommand("tilt camera 1 to -20", scene);
    expect(tiltPlan).not.toBeNull();
    expect(tiltPlan?.operations[0]).toMatchObject({
      type: "rotate_camera",
      cameraId: scene.cameras[0]?.id,
      pitchDeg: -20,
    });

    const addObstructionPlan = parseOfflineCommand("add partition obstruction near counter", scene);
    expect(addObstructionPlan).not.toBeNull();
    expect(addObstructionPlan?.operations[0]).toMatchObject({
      type: "add_obstruction",
      obstructionType: "partition",
    });

    const obstructionName = scene.obstructions[0]?.label ?? "obstruction";
    const moveObstructionPlan = parseOfflineCommand(`move obstruction ${obstructionName} near entry`, scene);
    expect(moveObstructionPlan).not.toBeNull();
    expect(moveObstructionPlan?.operations[0]).toMatchObject({
      type: "move_obstruction",
      obstructionId: scene.obstructions[0]?.id,
    });
  });

  test("flags ambiguous targets instead of applying blindly", () => {
    const scene = createSmallRetailShopScene();
    scene.cameras.push({ ...scene.cameras[0], id: "cam_duplicate", name: scene.cameras[0]?.name ?? "Camera 1" });

    const plan = parseOfflineCommand("rotate camera camera 1 to 90", scene);
    expect(plan).not.toBeNull();
    expect(plan?.requiresTargetSelection).toBe(true);
    expect(plan?.operations).toHaveLength(0);
  });
});
