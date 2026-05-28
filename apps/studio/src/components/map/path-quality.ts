import type { DoriQuality, ScenarioPath } from "@/schema/security-scene";

import type { CoverageCellLike, Point2 } from "@/simulation/path-quality";
export { obstacleRectPoints, polygonToSvgPoints } from "./map-geometry";

export type PathQualitySample = import("@/simulation/path-quality").PathQualitySample;
export type PathQualityBand = import("@/simulation/path-quality").PathQualityBand;

import {
  groupPathQualitySamples as groupPathQualitySamplesImpl,
  pathLengthM as pathLengthMImpl,
  pointOnPathAtProgress as pointOnPathAtProgressImpl,
  samplePathQuality as samplePathQualityImpl,
} from "@/simulation/path-quality";

export const pathLengthM = pathLengthMImpl;
export const pointOnPathAtProgress = pointOnPathAtProgressImpl;
export const samplePathQuality = samplePathQualityImpl;
export const groupPathQualitySamples = groupPathQualitySamplesImpl;
