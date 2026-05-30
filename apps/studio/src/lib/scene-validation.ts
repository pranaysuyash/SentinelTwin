import { SecurityScene, AnyEditableNode } from "../schema/security-scene";

export function validateSceneGeometry(scene: SecurityScene): SecurityScene {
  const next = { ...scene };

  // 1. Calculate scene bounds for camera validation
  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  for (const wall of next.walls) {
    minX = Math.min(minX, wall.start[0], wall.end[0]);
    maxX = Math.max(maxX, wall.start[0], wall.end[0]);
    minZ = Math.min(minZ, wall.start[1], wall.end[1]);
    maxZ = Math.max(maxZ, wall.start[1], wall.end[1]);
  }
  const hasBounds = minX !== Infinity;
  
  // 2. Validate Walls
  next.walls = next.walls.map(wall => {
    const dx = wall.end[0] - wall.start[0];
    const dy = wall.end[1] - wall.start[1];
    const length = Math.hypot(dx, dy);
    return {
      ...wall,
      geometryValidity: length < 0.1 ? "invalid" : "valid"
    };
  });

  // 3. Helper to check if a point is near any wall
  const isNearWall = (x: number, z: number) => {
    for (const wall of next.walls) {
      const wx1 = wall.start[0], wy1 = wall.start[1];
      const wx2 = wall.end[0], wy2 = wall.end[1];
      
      const l2 = Math.pow(wx1 - wx2, 2) + Math.pow(wy1 - wy2, 2);
      if (l2 === 0) continue;
      
      let t = ((x - wx1) * (wx2 - wx1) + (z - wy1) * (wy2 - wy1)) / l2;
      t = Math.max(0, Math.min(1, t));
      const projX = wx1 + t * (wx2 - wx1);
      const projZ = wy1 + t * (wy2 - wy1);
      
      const dist = Math.hypot(x - projX, z - projZ);
      if (dist < 0.5) return true;
    }
    return false;
  };

  // 4. Validate Doors
  next.doors = next.doors.map(door => ({
    ...door,
    geometryValidity: isNearWall(door.position[0], door.position[2]) ? "valid" : "suspect"
  }));

  // 5. Validate Windows
  next.windows = next.windows.map(window => ({
    ...window,
    geometryValidity: isNearWall(window.position[0], window.position[2]) ? "valid" : "suspect"
  }));

  // 6. Validate Cameras
  next.cameras = next.cameras.map(camera => {
    if (!hasBounds) return { ...camera, geometryValidity: "valid" };
    // Check if camera is way outside the walls
    const outOfBounds = camera.position[0] < minX - 10 || camera.position[0] > maxX + 10 ||
                        camera.position[2] < minZ - 10 || camera.position[2] > maxZ + 10;
    
    return {
      ...camera,
      geometryValidity: outOfBounds ? "suspect" : "valid"
    };
  });

  return next;
}
