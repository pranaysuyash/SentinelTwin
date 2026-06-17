import type { CameraNode, SecurityScene } from "@/schema/security-scene";

/**
 * Suggest camera placements for a newly imported scene.
 * Places one camera per door/entry point, aimed into the room interior.
 * No AI — pure geometry from wall positions.
 */
export function suggestCameraPlacements(scene: SecurityScene): CameraNode[] {
  const { width, depth, height } = scene.dimensions;
  const roomCenter: [number, number] = [width / 2, depth / 2];
  const now = Date.now();
  let seq = 0;
  const cid = () => `cam_suggested_${(now + seq++).toString(36)}`;

  const suggestions: CameraNode[] = [];

  // Find a wall-normal direction into the room
  function inwardDirection(doorPos: [number, number]): number {
    const dx = roomCenter[0] - doorPos[0];
    const dz = roomCenter[1] - doorPos[1];
    const dist = Math.hypot(dx, dz);
    if (dist < 0.01) return 0;
    // Convert to degrees: -yaw in Three.js = looking along positive Z
    return (Math.atan2(dx, dz) * 180) / Math.PI;
  }

  // 1. One camera per door, aimed into the room at 45° pitch
  const mountHeight = Math.min(height - 0.3, 2.8);
  for (const door of scene.doors) {
    const pos: [number, number, number] = [door.position[0], mountHeight, door.position[2]];
    const yaw = inwardDirection([door.position[0], door.position[2]]);
    suggestions.push({
      id: cid(),
      nodeType: "camera",
      name: `Door ${door.label.replace("Imported ", "")}`,
      position: pos,
      yawDeg: yaw,
      pitchDeg: -45,
      rollDeg: 0,
      mountType: "wall",
      mountHeightM: mountHeight,
      fovHorizontalDeg: 90,
      fovVerticalDeg: 60,
      rangeM: 15,
      resolutionMP: 4,
      resolutionWidth: 2688,
      resolutionHeight: 1520,
      lensType: "fixed",
      focalLengthMm: 4,
      status: "on",
      nightMode: "ir",
      irRangeM: 10,
      thermalCapable: false,
      ptz: false,
      clarity: "average",
      source: "import",
      reviewStatus: "unreviewed",
      sourceTrace: "heuristic-suggestion-v1",
      geometryValidity: "valid",
      ndaaCompliant: true,
      privacyMaskingEnabled: false,
      notes: "Suggested placement — adjust as needed",
      tags: ["suggested"],
      lprCapable: false,
      viewMotion: { movementMode: "fixed", dwellSeconds: 0, waypoints: [] },
    });
  }

  // 2. If no doors, place one camera at a corner aimed into the room
  if (suggestions.length === 0) {
    suggestions.push({
      id: cid(),
      nodeType: "camera",
      name: "Suggested Camera",
      position: [2, mountHeight, depth / 2],
      yawDeg: 0,
      pitchDeg: -35,
      rollDeg: 0,
      mountType: "wall",
      mountHeightM: mountHeight,
      fovHorizontalDeg: 90,
      fovVerticalDeg: 60,
      rangeM: 15,
      resolutionMP: 4,
      resolutionWidth: 2688,
      resolutionHeight: 1520,
      lensType: "fixed",
      focalLengthMm: 4,
      status: "on",
      nightMode: "ir",
      irRangeM: 10,
      thermalCapable: false,
      ptz: false,
      clarity: "average",
      source: "import",
      reviewStatus: "unreviewed",
      sourceTrace: "heuristic-suggestion-v1",
      geometryValidity: "valid",
      ndaaCompliant: true,
      privacyMaskingEnabled: false,
      notes: "Suggested placement — adjust as needed",
      tags: ["suggested"],
      lprCapable: false,
      viewMotion: { movementMode: "fixed", dwellSeconds: 0, waypoints: [] },
    });
  }

  return suggestions;
}
