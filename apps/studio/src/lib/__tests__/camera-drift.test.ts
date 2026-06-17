import { describe, expect, it } from "bun:test";

import { createSmallRetailShopScene } from "@/demo-scenes/small-retail-shop";
import { buildCameraDriftReport } from "@/lib/camera-drift";

describe("buildCameraDriftReport", () => {
  it("returns an empty-but-honest report with no baseline", () => {
    const scene = createSmallRetailShopScene();
    const report = buildCameraDriftReport(scene.cameras, null, null);

    expect(report.hasBaseline).toBe(false);
    expect(report.entries).toEqual([]);
  });

  it("reports no drift when cameras are unchanged", () => {
    const scene = createSmallRetailShopScene();
    const report = buildCameraDriftReport(scene.cameras, scene.cameras, { label: "Baseline", timestamp: 1000 });

    expect(report.hasBaseline).toBe(true);
    expect(report.entries).toEqual([]);
  });

  it("flags a camera moved beyond the major threshold", () => {
    const scene = createSmallRetailShopScene();
    const baselineCameras = scene.cameras.map((camera) => ({ ...camera }));
    const currentCameras = scene.cameras.map((camera, index) =>
      index === 0
        ? { ...camera, position: [camera.position[0] + 1, camera.position[1], camera.position[2]] as [number, number, number] }
        : camera,
    );

    const report = buildCameraDriftReport(currentCameras, baselineCameras, { label: "Baseline", timestamp: 1000 });

    const moved = report.entries.find((entry) => entry.kind === "moved");
    expect(moved).toBeDefined();
    expect(moved?.severity).toBe("major");
    expect(moved?.cameraId).toBe(scene.cameras[0]!.id);
  });

  it("flags a camera re-aimed beyond the major threshold", () => {
    const scene = createSmallRetailShopScene();
    const baselineCameras = scene.cameras.map((camera) => ({ ...camera }));
    const currentCameras = scene.cameras.map((camera, index) =>
      index === 0 ? { ...camera, yawDeg: camera.yawDeg + 45 } : camera,
    );

    const report = buildCameraDriftReport(currentCameras, baselineCameras, { label: "Baseline", timestamp: 1000 });

    const reaimed = report.entries.find((entry) => entry.kind === "reaimed");
    expect(reaimed).toBeDefined();
    expect(reaimed?.severity).toBe("major");
  });

  it("flags a camera that went offline since baseline as a major status change", () => {
    const scene = createSmallRetailShopScene();
    const baselineCameras = scene.cameras.map((camera) => ({ ...camera, status: "on" as const }));
    const currentCameras = scene.cameras.map((camera, index) =>
      index === 0 ? { ...camera, status: "malfunctioning" as const } : { ...camera, status: "on" as const },
    );

    const report = buildCameraDriftReport(currentCameras, baselineCameras, { label: "Baseline", timestamp: 1000 });

    const statusChange = report.entries.find((entry) => entry.kind === "status_changed");
    expect(statusChange).toBeDefined();
    expect(statusChange?.severity).toBe("major");
    expect(statusChange?.detail).toContain("on → malfunctioning");
  });

  it("flags removed and added cameras", () => {
    const scene = createSmallRetailShopScene();
    const baselineCameras = scene.cameras.map((camera) => ({ ...camera }));
    const currentCameras = scene.cameras.slice(1).map((camera) => ({ ...camera }));
    const newCamera = { ...scene.cameras[0]!, id: "cam_new_1", name: "New Camera" };
    currentCameras.push(newCamera);

    const report = buildCameraDriftReport(currentCameras, baselineCameras, { label: "Baseline", timestamp: 1000 });

    const removed = report.entries.find((entry) => entry.kind === "removed");
    const added = report.entries.find((entry) => entry.kind === "added");
    expect(removed?.cameraId).toBe(scene.cameras[0]!.id);
    expect(added?.cameraId).toBe("cam_new_1");
  });
});
