import { describe, expect, test } from "bun:test";

import { createBlankSecurityScene } from "@/lib/scene-skeleton";
import { createCameraNode, createObstructionNode } from "@/lib/node-factory";
import { snapCameraToMount } from "@/components/inspector/camera-mount-snap";

describe("camera-mount-snap", () => {
  test("snaps cameras to wall, ceiling, and pole targets", () => {
    const scene = createBlankSecurityScene();
    scene.walls.push(
      { id: "wall_extra", nodeType: "wall", label: "Display Wall", start: [2, 0], end: [2, 8], heightM: 3, thicknessM: 0.18, material: "solid", visionTransmission: 0, source: "manual" },
    );
    const pillar = createObstructionNode([6, 0, 4], "pillar");
    pillar.dimensions = [0.6, 0.6, 2.6];
    scene.obstructions.push(pillar);
    const camera = createCameraNode([7.5, 2.8, 4.5]);

    const wallPatch = snapCameraToMount(camera, scene, "wall");
    expect(wallPatch).not.toBeNull();
    expect(wallPatch?.mountType).toBe("wall");
    expect(wallPatch?.mountHeightM).toBeGreaterThanOrEqual(2.4);

    const ceilingPatch = snapCameraToMount(camera, scene, "ceiling");
    expect(ceilingPatch).not.toBeNull();
    expect(ceilingPatch?.mountType).toBe("ceiling");
    expect(ceilingPatch?.mountHeightM).toBeGreaterThanOrEqual(2.7);
    expect(ceilingPatch?.position[1]).toBe(ceilingPatch?.mountHeightM);

    const polePatch = snapCameraToMount(camera, scene, "pole");
    expect(polePatch).not.toBeNull();
    expect(polePatch?.mountType).toBe("pole");
    expect(polePatch?.position[0]).toBeCloseTo(pillar.position[0], 5);
    expect(polePatch?.position[2]).toBeCloseTo(pillar.position[2], 5);
  });
});
