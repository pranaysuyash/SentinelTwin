import type { AdversarialPathResult, CameraNode, SecurityScene } from "@/schema/security-scene";
import { gradeCameraFraming, type FramingGrade } from "@/lib/framing-grade";

/**
 * "Director's Cut" — EXPLORATION_MAP.md Thread 148.
 *
 * Given a subject's path through the scene (currently the adversarial-path
 * waypoints — D-009's Dijkstra route, the only per-time subject trajectory
 * the engine produces today), picks the camera with the best "shot" of the
 * subject at each waypoint, the way a film editor switches cameras to follow
 * a moving subject. Adjacent waypoints assigned to the same camera collapse
 * into a single "cut" segment.
 *
 * This is a pure selection function over data the engine already produces
 * (camera pose/range/status + waypoint positions) plus the framing-grade
 * projection from D-310 (`gradeCameraFraming`). No new schema, no new
 * simulation math — Rule 5 stays clean. Three intended uses (per Thread 148):
 * a sales-demo "trailer," a forensic report companion paired with the
 * adversarial path result, and guard-training material (cuts to "NO COVERAGE"
 * when the subject exits every frustum).
 */

export type DirectorsCutGrade = FramingGrade | "no_coverage";

const FRAMING_RANK: Record<FramingGrade, number> = {
  well_framed: 0,
  edge_of_frame: 1,
  foreshortened: 2,
  out_of_frame: 3,
};

export interface DirectorsCutShot {
  cameraId: string | null;
  cameraName: string | null;
  grade: DirectorsCutGrade;
}

export interface DirectorsCutSegment extends DirectorsCutShot {
  startTimeS: number;
  endTimeS: number;
  startPosition: [number, number];
}

export interface DirectorsCutSequence {
  totalDurationS: number;
  /** One shot decision per waypoint, in waypoint order. */
  shots: DirectorsCutShot[];
  /** Adjacent waypoints with the same camera/grade collapsed into cut segments. */
  segments: DirectorsCutSegment[];
  /** Total time the subject spends with no camera achieving better than out_of_frame/no_coverage. */
  noCoverageDurationS: number;
}

function pickBestCamera(
  cameras: CameraNode[],
  point: [number, number],
  targetHeightM: number,
): DirectorsCutShot {
  let best: DirectorsCutShot = { cameraId: null, cameraName: null, grade: "no_coverage" };
  let bestRank = FRAMING_RANK.out_of_frame + 1; // worse than out_of_frame
  let bestDistance = Infinity;

  for (const camera of cameras) {
    if (camera.status !== "on") continue;
    const distance = Math.hypot(point[0] - camera.position[0], point[1] - camera.position[2]);
    if (distance > camera.rangeM) continue;

    const { grade } = gradeCameraFraming(camera, point, targetHeightM);
    if (grade === "out_of_frame") continue;

    const rank = FRAMING_RANK[grade];
    if (rank < bestRank || (rank === bestRank && distance < bestDistance)) {
      best = { cameraId: camera.id, cameraName: camera.name, grade };
      bestRank = rank;
      bestDistance = distance;
    }
  }

  return best;
}

/**
 * Builds a Director's Cut sequence by selecting the best-framed camera for
 * each adversarial-path waypoint. Returns `null` if the path has no
 * waypoints (nothing to cut).
 */
export function buildDirectorsCutSequence(
  scene: SecurityScene,
  path: AdversarialPathResult,
): DirectorsCutSequence | null {
  if (path.waypoints.length === 0) return null;

  const targetHeightM = scene.assumptions.personHeightM;
  const shots = path.waypoints.map((waypoint) => pickBestCamera(scene.cameras, waypoint.position, targetHeightM));

  const segments: DirectorsCutSegment[] = [];
  let noCoverageDurationS = 0;

  for (let i = 0; i < path.waypoints.length; i++) {
    const waypoint = path.waypoints[i]!;
    const shot = shots[i]!;
    const nextTimeS = path.waypoints[i + 1]?.timeS ?? path.totalDurationS;
    const durationS = Math.max(0, nextTimeS - waypoint.timeS);

    if (shot.grade === "no_coverage" || shot.grade === "out_of_frame") {
      noCoverageDurationS += durationS;
    }

    const last = segments[segments.length - 1];
    if (last && last.cameraId === shot.cameraId && last.grade === shot.grade) {
      last.endTimeS = nextTimeS;
    } else {
      segments.push({
        ...shot,
        startTimeS: waypoint.timeS,
        endTimeS: nextTimeS,
        startPosition: waypoint.position,
      });
    }
  }

  return {
    totalDurationS: path.totalDurationS,
    shots,
    segments,
    noCoverageDurationS,
  };
}
