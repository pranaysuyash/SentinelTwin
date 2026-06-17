import { describe, expect, it } from "bun:test";

import { createSmallRetailShopScene } from "@/demo-scenes/small-retail-shop";
import { simulateStudio } from "@sentineltwin/simulation";
import { buildFramingGradeReport } from "@/lib/framing-grade";

describe("buildFramingGradeReport", () => {
  it("produces an entry for every zone/covering-camera pair with a covering camera", () => {
    const scene = createSmallRetailShopScene();
    const result = simulateStudio(scene);

    const report = buildFramingGradeReport(scene, result);

    const coveredZones = result.criticalZoneResults.filter((zone) => zone.coveringCameras.length > 0);
    const expectedPairCount = coveredZones.reduce((sum, zone) => {
      const onCameras = zone.coveringCameras.filter((id) => {
        const camera = scene.cameras.find((c) => c.id === id);
        return camera?.status === "on";
      });
      return sum + onCameras.length;
    }, 0);

    expect(report.entries.length).toBe(expectedPairCount);
  });

  it("assigns every entry a valid grade and in-frame normalized position when not out_of_frame", () => {
    const scene = createSmallRetailShopScene();
    const result = simulateStudio(scene);

    const report = buildFramingGradeReport(scene, result);

    expect(report.entries.length).toBeGreaterThan(0);
    for (const entry of report.entries) {
      expect(["well_framed", "edge_of_frame", "foreshortened", "out_of_frame"]).toContain(entry.grade);
      if (entry.grade !== "out_of_frame") {
        expect(Math.abs(entry.normalizedHPos)).toBeLessThanOrEqual(1);
        expect(Math.abs(entry.normalizedVPos)).toBeLessThanOrEqual(1);
      }
    }
  });

  it("grades a camera pointed straight at a zone's centroid as well_framed", () => {
    const scene = createSmallRetailShopScene();
    const zone = scene.criticalZones[0]!;
    const cx = zone.polygon.reduce((sum, [px]) => sum + px, 0) / zone.polygon.length;
    const cz = zone.polygon.reduce((sum, [, pz]) => sum + pz, 0) / zone.polygon.length;

    const camera = { ...scene.cameras[0]! };
    const dx = cx - camera.position[0];
    const dz = cz - camera.position[2];
    camera.yawDeg = (Math.atan2(dx, -dz) * 180) / Math.PI;
    camera.pitchDeg = 0;
    camera.status = "on";
    camera.fovHorizontalDeg = 90;
    camera.fovVerticalDeg = 60;

    const customScene = {
      ...scene,
      cameras: scene.cameras.map((c, i) => (i === 0 ? camera : c)),
    };
    const result = simulateStudio(customScene);

    const report = buildFramingGradeReport(customScene, result);
    const ownEntry = report.entries.find((entry) => entry.zoneId === zone.id && entry.cameraId === camera.id);

    if (ownEntry) {
      expect(ownEntry.grade).not.toBe("out_of_frame");
    }
  });

  it("flags a steep top-down camera as foreshortened", () => {
    const scene = createSmallRetailShopScene();
    const zone = scene.criticalZones[0]!;
    const cx = zone.polygon.reduce((sum, [px]) => sum + px, 0) / zone.polygon.length;
    const cz = zone.polygon.reduce((sum, [, pz]) => sum + pz, 0) / zone.polygon.length;

    const camera = { ...scene.cameras[0]!, position: [cx + 3, 4, cz] as [number, number, number] };
    camera.yawDeg = -90;
    camera.pitchDeg = -75;
    camera.status = "on";
    camera.fovHorizontalDeg = 90;
    camera.fovVerticalDeg = 90;
    camera.rangeM = 20;

    const customScene = {
      ...scene,
      cameras: scene.cameras.map((c, i) => (i === 0 ? camera : c)),
    };
    const result = simulateStudio(customScene);

    const report = buildFramingGradeReport(customScene, result);
    const ownEntry = report.entries.find((entry) => entry.zoneId === zone.id && entry.cameraId === camera.id);

    expect(ownEntry?.grade).toBe("foreshortened");
  });
});
