import type { DoriQuality, ScenarioPath } from "@/schema/security-scene";

import type { CoverageCellLike, Point2 } from "@sentineltwin/simulation";
export { obstacleRectPoints, polygonToSvgPoints } from "./map-geometry";

export type PathQualitySample = import("@sentineltwin/simulation").PathQualitySample;
export type PathQualityBand = import("@sentineltwin/simulation").PathQualityBand;

import {
  groupPathQualitySamples as groupPathQualitySamplesImpl,
  pathLengthM as pathLengthMImpl,
  pointOnPathAtProgress as pointOnPathAtProgressImpl,
  samplePathQuality as samplePathQualityImpl,
} from "@sentineltwin/simulation";

export const pathLengthM = pathLengthMImpl;
export const pointOnPathAtProgress = pointOnPathAtProgressImpl;
export const samplePathQuality = samplePathQualityImpl;
export const groupPathQualitySamples = groupPathQualitySamplesImpl;
