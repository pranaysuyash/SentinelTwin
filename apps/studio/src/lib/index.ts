/**
 * Stable, SDK-facing Studio helpers.
 *
 * Keep this barrel curated. It is the public entrypoint for reusable Studio
 * helpers that are safe to depend on from future integrations and package
 * extraction work.
 */
export {
  applySceneOperation,
  applySceneOperations,
  type ApplyResult,
} from "./applySceneOperation";

export {
  createSceneFromFloorPlan,
  extractFloorPlan,
  getFloorPlanDiagnostics,
  normalizeFloorPlanResult,
  recalibrateFloorPlanResult,
  validateFloorPlan,
  type DoorOpening,
  type FloorPlanConfig,
  type FloorPlanDiagnostics,
  type FloorPlanResult,
  type WallSegment,
  type WindowOpening,
} from "./floor-plan-import";

export {
  parseOfflineCommand,
  type OfflineCommandAction,
  type OfflineCommandPlan,
} from "./offline-command-parser";

export {
  shareLinkOrCopy,
  type ShareLinkPayload,
  type ShareLinkStatus,
  type ShareNavigator,
} from "./share-link";
