import { z } from "zod";

export const doriQualitySchema = z.enum([
  "none",
  // DORI 2014 levels
  "detection",
  "observation",
  "recognition",
  "identification",
  // OODPCVS 2025 levels (IEC 62676-4:2025)
  "overview",
  "outline",
  "discern",
  "perceive",
  "characterize",
  "validate",
  "scrutinize",
]);

export const sceneSourceSchema = z.enum([
  "manual",
  "ai",
  "scan",
  "import",
  "preset",
  "demo",
]);

export const reviewStatusSchema = z.enum([
  "unreviewed",
  "accepted",
  "corrected",
  "calibrated",
  "verified",
]);

export const geometryValiditySchema = z.enum([
  "valid",
  "suspect",
  "invalid",
]);

const point3Schema = z.tuple([z.number(), z.number(), z.number()]);
const point2Schema = z.tuple([z.number(), z.number()]);

export const cameraMovementModeSchema = z.enum([
  "fixed",
  "sweep_h",
  "sweep_v",
  "preset_cycle",
  "tracking",
]);

export const cameraMotionWaypointSchema = z.object({
  yawDeg: z.number(),
  pitchDeg: z.number(),
  holdSeconds: z.number().min(0),
  easing: z.enum(["linear", "ease_in", "ease_out", "ease_in_out"]).optional(),
});

export const cameraViewMotionSchema = z.object({
  movementMode: cameraMovementModeSchema.default("fixed"),
  dwellSeconds: z.number().min(0).default(0),
  patrolRouteId: z.string().optional(),
  patrolSpeedDegPerS: z.number().positive().optional(),
  waypoints: z.array(cameraMotionWaypointSchema).default([]),
});

const ID_PREFIXES = ["wall_", "door_", "window_", "cam_", "light_", "obs_", "zone_", "privacy_", "sensor_", "comment_", "entry_", "path_", "snap_", "scene_", "sugg_", "mismatch_", "evidence_"] as const;
export type IdPrefix = (typeof ID_PREFIXES)[number];

export function generateNodeId(prefix: IdPrefix): string {
  const rand = Math.random().toString(36).substring(2, 10);
  return `${prefix}${rand}`;
}

export const collisionLayerSchema = z.object({
  visualMesh: z.boolean().default(true),
  physicsCollider: z.boolean().default(true),
  visionCollider: z.boolean().default(true),
});
export type CollisionLayer = z.infer<typeof collisionLayerSchema>;

export const wallNodeSchema = z.object({
  id: z.string().startsWith("wall_"),
  nodeType: z.literal("wall"),
  label: z.string(),
  start: point2Schema,
  end: point2Schema,
  heightM: z.number().positive(),
  thicknessM: z.number().positive(),
  material: z.enum(["solid", "glass", "grill", "partial"]),
  visionTransmission: z.number().min(0).max(1).default(0),
  source: sceneSourceSchema,
  reviewStatus: reviewStatusSchema.default("unreviewed"),
  sourceTrace: z.string().default(""),
  geometryValidity: geometryValiditySchema.default("valid"),
  collisionLayer: collisionLayerSchema.optional(),
});

export const doorAccessControlSchema = z.object({
  type: z.enum(["none", "pin", "card", "biometric", "guard_post"]).default("none"),
  /** 1 = trivial (push open), 5 = extremely difficult (biometric + guard) */
  breachDifficulty: z.number().int().min(1).max(5).default(1),
  /** Estimated seconds to defeat, used in adversarial path cost. */
  breachTimeS: z.number().positive().optional(),
});

export const doorNodeSchema = z.object({
  id: z.string().startsWith("door_"),
  nodeType: z.literal("door"),
  label: z.string(),
  position: point3Schema,
  dimensions: point3Schema,
  state: z.enum(["open", "closed", "locked", "restricted"]),
  wallId: z.string().optional(),
  accessControl: doorAccessControlSchema.optional(),
  source: sceneSourceSchema,
  reviewStatus: reviewStatusSchema.default("unreviewed"),
  sourceTrace: z.string().default(""),
  geometryValidity: geometryValiditySchema.default("valid"),
  collisionLayer: collisionLayerSchema.optional(),
});

export type DoorAccessControl = z.infer<typeof doorAccessControlSchema>;

export const windowNodeSchema = z.object({
  id: z.string().startsWith("window_"),
  nodeType: z.literal("window"),
  label: z.string(),
  position: point3Schema,
  dimensions: point3Schema,
  state: z.enum(["closed_glass", "open", "grill", "curtain", "reflective"]),
  visionTransmission: z.number().min(0).max(1),
  wallId: z.string().optional(),
  source: sceneSourceSchema,
  reviewStatus: reviewStatusSchema.default("unreviewed"),
  sourceTrace: z.string().default(""),
  geometryValidity: geometryValiditySchema.default("valid"),
  collisionLayer: collisionLayerSchema.optional(),
});

export const sceneUpdateSuggestionSchema = z.object({
  id: z.string().startsWith("sugg_"),
  type: z.enum(["adjust_yaw", "adjust_pitch", "adjust_fov", "add_obstruction", "move_obstruction"]),
  cameraId: z.string().optional(),
  description: z.string(),
  suggestedYawDeg: z.number().optional(),
  suggestedPitchDeg: z.number().optional(),
  suggestedFovHorizontalDeg: z.number().optional(),
  suggestedPosition: point3Schema.optional(),
  suggestedDimensions: point3Schema.optional(),
  reviewStatus: reviewStatusSchema.default("unreviewed"),
});

export const mismatchReportSchema = z.object({
  id: z.string().startsWith("mismatch_"),
  cameraId: z.string(),
  evidenceId: z.string(),
  severity: z.enum(["critical", "high", "medium", "low"]),
  mismatchTypes: z.array(z.enum(["angle", "fov", "obstruction", "missing_modeled_object", "other"])),
  description: z.string(),
  suggestions: z.array(sceneUpdateSuggestionSchema).default([]),
});

export const cameraEvidenceArtifactSchema = z.object({
  id: z.string().startsWith("evidence_"),
  type: z.enum(["still_image", "video", "extracted_frame", "stream_snapshot"]),
  timestamp: z.number().int().nonnegative(),
  source: sceneSourceSchema,
  url: z.string().optional(),
  cameraId: z.string(),
  binding: z.object({
    isBound: z.boolean(),
    landmarkMatches: z.array(z.object({
      scenePosition: point3Schema,
      evidencePosition2D: point2Schema,
    })).default([]),
    transformConfidence: z.number().min(0).max(1).optional(),
    verifiedAt: z.number().int().nonnegative().optional(),
  }).optional(),
});

export const cameraNodeSchema = z.object({
  id: z.string().startsWith("cam_"),
  nodeType: z.literal("camera"),
  name: z.string(),
  position: point3Schema,
  yawDeg: z.number(),
  pitchDeg: z.number(),
  rollDeg: z.number().default(0),
  mountType: z.enum(["wall", "ceiling", "pole", "corner", "desk"]),
  mountHeightM: z.number().positive(),
  fovHorizontalDeg: z.number().positive().max(180),
  fovVerticalDeg: z.number().positive().max(180),
  rangeM: z.number().positive(),
  resolutionMP: z.number().positive(),
  resolutionWidth: z.number().positive().optional(),
  resolutionHeight: z.number().positive().optional(),
  lensType: z.enum(["fixed", "varifocal", "fisheye", "panoramic"]),
  focalLengthMm: z.number().positive().optional(),
  presetId: z.string().optional(),
  viewMotion: cameraViewMotionSchema.default({ movementMode: "fixed", dwellSeconds: 0, waypoints: [] }),
  status: z.enum(["on", "off", "blocked", "dirty", "malfunctioning"]),
  nightMode: z.enum(["none", "ir", "low_light", "thermal"]),
  irRangeM: z.number().min(0),
  thermalCapable: z.boolean(),
  ptz: z.boolean(),
  clarity: z.enum(["poor", "average", "good", "excellent"]),
  liveFeedUrl: z.string().optional(),
  liveFeedLabel: z.string().optional(),
  liveConnectionMode: z.enum(["rtsp", "mjpeg", "http", "onvif", "proxy"]).optional(),
  liveConnectionStatus: z.enum(["disconnected", "connecting", "connected", "error"]).optional(),
  liveConnectionUpdatedAt: z.number().int().nonnegative().optional(),
  liveSessionId: z.string().optional(),
  liveSessionState: z.enum(["idle", "probing", "connected", "error"]).optional(),
  liveSessionStartedAt: z.number().int().nonnegative().optional(),
  liveSessionConfirmedAt: z.number().int().nonnegative().optional(),
  liveSessionExpiresAt: z.number().int().nonnegative().optional(),
  transportSessionId: z.string().optional(),
  transportSessionState: z.enum(["idle", "negotiating", "active", "closing", "error"]).optional(),
  lastHeartbeatAt: z.number().int().nonnegative().optional(),
  probeCount: z.number().int().nonnegative().optional(),
  protocolProfile: z.enum(["onvif_device", "rtsp_session", "mjpeg_stream", "http_poll", "proxy"]).optional(),
  authMode: z.enum(["none", "basic", "digest", "token", "cookie", "onvif_digest", "proxy_passthrough"]).optional(),
  authState: z.enum(["unauthenticated", "authenticating", "authenticated", "failed"]).optional(),
  authRealm: z.string().optional(),
  onvifUsername: z.string().optional(),
  onvifPassword: z.string().optional(),
  eventSubscriptionUri: z.string().optional(),
  eventSubscriptionReference: z.string().optional(),
  eventSubscriptionExpiresAt: z.number().int().nonnegative().optional(),
  ndaaCompliant: z.boolean().default(true),
  privacyMaskingEnabled: z.boolean().default(false),
  authSessionId: z.string().optional(),
  authSessionExpiresAt: z.number().int().nonnegative().optional(),
  transportResponseStatus: z.number().int().nonnegative().optional(),
  transportResponseStatusText: z.string().optional(),
  authChallengeHeader: z.string().optional(),
  authChallengeScheme: z.enum(["basic", "digest", "bearer", "token"]).optional(),
  authChallengeRealm: z.string().optional(),
  source: sceneSourceSchema,
  notes: z.string().optional(),
  tags: z.array(z.string()).default([]),
  reviewStatus: reviewStatusSchema.default("unreviewed"),
  sourceTrace: z.string().default(""),
  geometryValidity: geometryValiditySchema.default("valid"),
  collisionLayer: collisionLayerSchema.optional(),
  /** LPR (License Plate Recognition) capability. When true, lprConfig should be set. */
  lprCapable: z.boolean().default(false),
  lprConfig: z.object({
    readRangeM: z.number().positive(),
    maxSpeedKph: z.number().nonnegative(),
    mountAngle: z.enum(["front_on", "side_on", "angled"]),
  }).optional(),
});

export const securityLightNodeSchema = z.object({
  id: z.string().startsWith("light_"),
  nodeType: z.literal("security_light"),
  name: z.string(),
  lightType: z.enum([
    "ceiling",
    "wall",
    "flood",
    "street",
    "emergency",
    "ir_flood",
  ]),
  position: point3Schema,
  yawDeg: z.number().optional(),
  pitchDeg: z.number().optional(),
  status: z.enum(["on", "off", "failed"]),
  brightness: z.enum(["dim", "low", "medium", "high", "very_high"]),
  rangeM: z.number().positive(),
  coneDeg: z.number().positive().max(180).optional(),
  colorTemperatureK: z.number().positive().optional(),
  emergencyPower: z.boolean(),
  illuminatesNightCoverage: z.boolean(),
  glareRisk: z.enum(["none", "low", "medium", "high"]),
  source: sceneSourceSchema,
  reviewStatus: reviewStatusSchema.default("unreviewed"),
  sourceTrace: z.string().default(""),
  geometryValidity: geometryValiditySchema.default("valid"),
  collisionLayer: collisionLayerSchema.optional(),
});

export const obstructionNodeSchema = z.object({
  id: z.string().startsWith("obs_"),
  nodeType: z.literal("obstruction"),
  label: z.string(),
  position: point3Schema,
  rotationYDeg: z.number(),
  dimensions: point3Schema,
  material: z.enum([
    "solid",
    "glass",
    "grill",
    "mesh",
    "curtain",
    "reflective",
    "partial",
  ]),
  visionTransmission: z.number().min(0).max(1),
  glareRisk: z.boolean(),
  nightIRReflective: z.boolean(),
  movable: z.boolean(),
  movableByAI: z.boolean(),
  weightKg: z.number().positive().optional(),
  obstructionType: z.enum([
    "shelf",
    "cupboard",
    "counter",
    "pillar",
    "partition",
    "vehicle",
    "tree",
    "gate",
    "signboard",
    "storage_boxes",
    "glass_display",
    "curtain",
    "other",
  ]),
  source: sceneSourceSchema,
  reviewStatus: reviewStatusSchema.default("unreviewed"),
  sourceTrace: z.string().default(""),
  geometryValidity: geometryValiditySchema.default("valid"),
  collisionLayer: collisionLayerSchema.optional(),
});

export const criticalZoneNodeSchema = z.object({
  id: z.string().startsWith("zone_"),
  nodeType: z.literal("critical_zone"),
  label: z.string(),
  polygon: z.array(point2Schema).min(3),
  heightM: z.number().positive().default(2),
  priority: z.enum(["low", "medium", "high", "critical"]),
  requiredQuality: doriQualitySchema.exclude(["none"]),
  targetType: z.enum([
    "person_detection",
    "face_recognition",
    "face_identification",
    "vehicle_detection",
    "license_plate",
    "package_detection",
    "cash_counter_activity",
    "door_entry_exit",
    "perimeter_breach",
  ]),
  nightRequired: z.boolean(),
  redundancyRequired: z.boolean(),
  privacyZone: z.boolean().default(false),
  source: sceneSourceSchema.default("manual"),
  reviewStatus: reviewStatusSchema.default("unreviewed"),
  sourceTrace: z.string().default(""),
  geometryValidity: geometryValiditySchema.default("valid"),
});

export const privacyZoneNodeSchema = z.object({
  id: z.string().startsWith("privacy_"),
  nodeType: z.literal("privacy_zone"),
  label: z.string(),
  polygon: z.array(point2Schema).min(3),
  restriction: z.enum(["no_video", "restricted_view", "blindspot_required"]),
  regulation: z.string(),
  source: sceneSourceSchema.default("manual"),
  reviewStatus: reviewStatusSchema.default("unreviewed"),
  sourceTrace: z.string().default(""),
  geometryValidity: geometryValiditySchema.default("valid"),
});

export const commentNodeSchema = z.object({
  id: z.string().startsWith("comment_"),
  nodeType: z.literal("comment"),
  label: z.string().default("Comment"),
  position: point3Schema,
  text: z.string(),
  author: z.string().default("Operator"),
  createdAt: z.number().int().nonnegative(),
  resolved: z.boolean().default(false),
  attachedToNodeId: z.string().nullable().default(null),
  source: sceneSourceSchema.default("manual"),
  reviewStatus: reviewStatusSchema.default("unreviewed"),
  sourceTrace: z.string().default(""),
  geometryValidity: geometryValiditySchema.default("valid"),
});

export const sensorNodeSchema = z.object({
  id: z.string().startsWith("sensor_"),
  nodeType: z.literal("sensor"),
  label: z.string(),
  sensorType: z.enum([
    "motion",
    "door_contact",
    "access_reader",
    "audio",
    "vibration",
    "panic_button",
    "smoke_heat",
  ]),
  position: point3Schema,
  state: z.enum(["active", "inactive", "faulted"]).default("active"),
  coverageMode: z.enum(["detection", "trigger", "audit"]).default("detection"),
  source: sceneSourceSchema,
  reviewStatus: reviewStatusSchema.default("unreviewed"),
  sourceTrace: z.string().default(""),
  geometryValidity: geometryValiditySchema.default("valid"),
  collisionLayer: collisionLayerSchema.optional(),
  notes: z.string().optional(),
});

export const entryPointNodeSchema = z.object({
  id: z.string().startsWith("entry_"),
  nodeType: z.literal("entry_point"),
  label: z.string(),
  position: point2Schema,
  source: sceneSourceSchema.default("manual"),
  reviewStatus: reviewStatusSchema.default("unreviewed"),
  sourceTrace: z.string().default(""),
  geometryValidity: geometryValiditySchema.default("valid"),
});

export const pathPointSchema = z.object({
  position: point2Schema,
  timestamp: z.number().min(0).optional(),
  action: z.enum(["enter", "wait", "run", "crouch", "exit"]).optional(),
});

export const scenarioPathSchema = z.object({
  id: z.string().startsWith("path_"),
  nodeType: z.literal("path"),
  label: z.string(),
  actorType: z.enum(["person", "vehicle", "guard", "crowd"]),
  points: z.array(pathPointSchema).min(2),
  speedMps: z.number().positive(),
  heightM: z.number().positive(),
  widthM: z.number().positive().optional(),
  timeOfDay: z.enum(["day", "night", "dusk", "dawn"]),
  intent: z.enum(["authorized", "suspicious", "incident_replay"]),
  labelDetail: z.string().optional(),
  source: sceneSourceSchema.default("manual"),
  reviewStatus: reviewStatusSchema.default("unreviewed"),
  sourceTrace: z.string().default(""),
  geometryValidity: geometryValiditySchema.default("valid"),
});

export const simulationAssumptionsSchema = z.object({
  wallHeightM: z.number().positive(),
  personHeightM: z.number().positive(),
  vehicleHeightM: z.number().positive(),
  timeOfDay: z.enum(["day", "night", "custom"]),
  exteriorLightLux: z.number().positive().optional(),
  interiorLightLevel: z.enum(["dark", "dim", "normal", "bright"]),
  nightPenaltyMode: z.enum(["none", "simple", "detailed"]),
  /** Canonical values: "dori_2014" | "oodpcvs_2025". Legacy "simplified" and "iec62676" are normalized on parse. */
  doriStandard: z
    .enum(["simplified", "iec62676", "dori_2014", "oodpcvs_2025"])
    .transform((val): "dori_2014" | "oodpcvs_2025" => {
      if (val === "simplified" || val === "dori_2014") return "dori_2014";
      return "oodpcvs_2025";
    }),
  /** PPM thresholds for DORI 2014 mode. In OODPCVS 2025 mode, the standard-defined 7-level thresholds are used instead. */
  pixelsPerMeter: z.object({
    detection: z.number().positive(),
    observation: z.number().positive(),
    recognition: z.number().positive(),
    identification: z.number().positive(),
  }),
  showAssumptionsPanel: z.boolean(),
  /** Backlight from windows/doors behind the subject — reduces face/body contrast */
  backlightIntensity: z.enum(["none", "low", "medium", "high"]).default("none"),
  /** Glare/reflection from reflective surfaces, glass, or wet floors */
  glareIntensity: z.enum(["none", "low", "medium", "high"]).default("none"),
  /** Overexposed zones (e.g. entrance in direct sun, bright signage) */
  overexposedZones: z.boolean().default(false),
  /** OODPCVS scene complexity factor — affects Pop (probability of performance) adjustment */
  sceneComplexity: z.enum(["simple", "moderate", "complex", "cluttered"]).default("moderate"),
  /** OODPCVS operator experience level — affects Pop factor */
  operatorExperience: z.enum(["novice", "trained", "expert"]).default("trained"),
  /** OODPCVS task criticality — adds margin above threshold for higher-risk tasks */
  taskCriticality: z.enum(["low", "standard", "high", "critical"]).default("standard"),
  /** Operational scope for no-floor-plan intake and event rehearsal plans */
  operationalMode: z.enum(["permanent", "temporary_event"]).optional(),
  /** Operational assumptions that justify temporary mode and handling constraints */
  operationalContext: z.object({
    isEmergencyWindow: z.boolean().optional(),
    requiresTemporaryPerimeterLockdown: z.boolean().optional(),
    notes: z.string().optional(),
  }).optional(),
  /** Scenario envelope for temporary control events and teardown-first operating posture */
  operationalScenarioEnvelope: z.object({
    active: z.boolean(),
    profileId: z.string(),
    profileLabel: z.string(),
    scope: z.enum(["temporary_event", "temporary_perimeter", "vip_visit", "maintenance", "incident_response", "other"]),
    startAt: z.number().int().nonnegative(),
    endAt: z.number().int().nonnegative(),
    requiresTemporaryPerimeterLockdown: z.boolean().default(false),
    requiresStaffingLockdown: z.boolean().default(false),
    rollBackRequired: z.boolean().default(true),
    temporaryControls: z.array(z.string()).default([]),
    rollBackPlan: z.array(z.object({
      action: z.string(),
      description: z.string(),
      mandatory: z.boolean().default(false),
      evidenceHint: z.string().optional(),
    })).default([]),
    notes: z.array(z.string()).default([]),
  }).optional(),
});

export const zoneResultSchema = z.object({
  zoneId: z.string(),
  label: z.string(),
  targetType: criticalZoneNodeSchema.shape.targetType.optional(),
  targetProfile: z.string().optional(),
  targetSamplingMode: z.enum(["any", "all"]).optional(),
  sampleHeightsM: z.array(z.number().positive()).optional(),
  requiredQuality: doriQualitySchema.exclude(["none"]),
  actualQuality: doriQualitySchema,
  coveringCameras: z.array(z.string()),
  redundancyCameraCount: z.number().int().min(0),
  status: z.enum(["pass", "fail", "partial"]),
  failureReasons: z.array(z.string()),
  coveragePct: z.number().min(0).max(100).optional(),
});

export const cameraOfflineImpactEntrySchema = z.object({
  zoneId: z.string(),
  label: z.string(),
  beforeQuality: doriQualitySchema,
  afterQuality: doriQualitySchema,
  beforeStatus: z.enum(["pass", "fail", "partial"]),
  afterStatus: z.enum(["pass", "fail", "partial"]),
  reason: z.string(),
});

export const cameraResultSchema = z.object({
  cameraId: z.string(),
  coveragePct: z.number().min(0).max(100),
  qualityByZone: z.record(z.string(), doriQualitySchema),
  criticalZonesCovered: z.array(z.string()),
  criticalZonesFailed: z.array(z.string()),
  offlineImpact: z.array(z.string()),
  offlineImpactDetail: z.array(cameraOfflineImpactEntrySchema).optional(),
});

export const pathTimelineEventSchema = z.object({
  timeS: z.number().min(0),
  event: z.enum(["visible", "lost", "quality_change"]),
  cameraId: z.string().optional(),
  quality: doriQualitySchema.optional(),
  reason: z.string().optional(),
});

export const pathCameraVisibilitySchema = z.object({
  cameraId: z.string(),
  visibleS: z.number().min(0),
  maxQuality: doriQualitySchema,
  lostBehind: z.string().optional(),
});

export const pathVisibilityResultSchema = z.object({
  pathId: z.string(),
  totalDurationS: z.number().min(0),
  visibleDurationS: z.number().min(0),
  lostDurationS: z.number().min(0),
  visibilityByCamera: z.record(z.string(), pathCameraVisibilitySchema),
  timeline: z.array(pathTimelineEventSchema),
});

export const securityIssueSchema = z.object({
  severity: z.enum(["critical", "high", "medium", "low"]),
  category: z.enum([
    "blindspot",
    "quality_fail",
    "redundancy",
    "night",
    "privacy",
  ]),
  description: z.string(),
  affectedZones: z.array(z.string()),
  affectedCameras: z.array(z.string()),
  pathId: z.string().optional(),
});

export const qualityThresholdSchema = z.object({
  detection: z.number().positive(),
  observation: z.number().positive(),
  recognition: z.number().positive(),
  identification: z.number().positive(),
});

export const adversarialWaypointSchema = z.object({
  position: point2Schema,
  timeS: z.number().min(0),
  detectionQuality: doriQualitySchema,
  detectionProbability: z.number().min(0).max(1),
  usingCoverOf: z.string().optional(),
  exposedToCamera: z.string().optional(),
});

export const adversarialPathResultSchema = z.object({
  waypoints: z.array(adversarialWaypointSchema),
  totalExposureScore: z.number().min(0),
  totalDurationS: z.number().min(0),
  detectionQualityExposure: z.record(z.string(), z.number().min(0)),
  maxDetectionProbability: z.number().min(0).max(1),
  coverageGapsUsed: z.array(z.string()),
  camerasWithoutCoverageOnRoute: z.array(z.string()),
  criticalZonesReachableAlongRoute: z.array(z.string()),
  criticalZoneReachable: z.boolean(),
  failureReason: z.string().optional(),
  /** Doors with access control that the adversary must breach on this path. */
  accessControlBarriers: z.array(z.object({
    nodeId: z.string(),
    label: z.string(),
    controlType: z.enum(["none", "pin", "card", "biometric", "guard_post"]),
    breachDifficulty: z.number().int().min(1).max(5),
    breachTimeS: z.number().nonnegative(),
  })).default([]),
});

export const coverageCellResultSchema = z.object({
  x: z.number(),
  z: z.number(),
  quality: doriQualitySchema,
  coveringCameras: z.array(z.string()),
  blockedBy: z.array(z.string()),
  ppm: z.number().min(0),
  coverageIncluded: z.boolean(),
  privacyRestricted: z.boolean(),
  /** 0 = robust (far from threshold boundary), 1 = fragile (right on boundary). */
  fragility: z.number().min(0).max(1).optional(),
  cameraEvaluations: z
    .record(
      z.string(),
      z.object({
        quality: doriQualitySchema,
        ppm: z.number().min(0),
        probability: z.number().min(0).max(1),
        visible: z.boolean(),
        blockedBy: z.string().optional(),
        inFov: z.boolean(),
        withinRange: z.boolean(),
        distanceM: z.number().min(0),
        hAngleDeg: z.number(),
        vAngleDeg: z.number(),
        edgePenaltyMultiplier: z.number().min(0).max(1).optional(),
        clarityMultiplier: z.number().min(0).max(1).optional(),
        materialTransmission: z.number().min(0).max(1).optional(),
        glarePenalty: z.number().min(0).max(1).optional(),
        lightingPenalty: z.number().min(0).max(1).optional(),
        lightLevel: z.number().min(0).max(1).optional(),
        illuminatedBy: z.array(z.string()).optional(),
        shadowedBy: z.array(z.string()).optional(),
        finalPpmMultiplier: z.number().min(0).optional(),
        reasonCodes: z.array(z.string()),
      }),
    )
    .optional(),
});

export const blindRegionSchema = z.object({
  id: z.string(),
  cells: z.array(z.object({ x: z.number(), z: z.number() })),
  areaSqM: z.number().min(0),
  classification: z.enum(["entry_corridor", "entry_connected", "isolated"]),
  severity: z.enum(["critical", "high", "medium", "low"]),
  touchesCriticalZone: z.boolean(),
  affectedZoneIds: z.array(z.string()),
  description: z.string(),
});

export const reflectiveBounceSchema = z.object({
  reflectiveWindowCount: z.number().int().nonnegative(),
  affectedCellCount: z.number().int().nonnegative(),
  affectedCameraCount: z.number().int().nonnegative(),
});

// ── Simulation Engine Maturity Types (Thread 2b) ──
// Defined before simulationResultSchema to avoid TDZ.
// scenarioBatchResultSchema uses z.lazy() to break the circular dependency.

export const confidenceLevelSchema = z.enum(["none", "low", "medium", "high", "verified"]);

export const confidenceSourceSchema = z.enum([
  "simulation", "calibration", "operator", "footage_verified",
  "spec_sheet", "scan_reconstruction", "ai_estimate", "assumption", "unknown",
]);

export const confidenceBandSchema = z.object({
  level: confidenceLevelSchema,
  source: confidenceSourceSchema,
  reasonCodes: z.array(z.string()).default([]),
  sensitiveTo: z.array(z.string()).default([]),
});

export const simulationPerformanceEnvelopeSchema = z.object({
  samplingMode: z.enum(["default", "adaptive_area_capped"]),
  requestedCellsPerMeter: z.number().positive(),
  effectiveCellsPerMeter: z.number().positive(),
  sceneAreaSqM: z.number().positive(),
  estimatedCellCount: z.number().int().nonnegative(),
  areaCapped: z.boolean(),
});

export const calibrationCameraPresetSchema = z.object({
  name: z.string(),
  resolutionWidthPx: z.number().positive(),
  resolutionHeightPx: z.number().positive(),
  fovHorizontalDeg: z.number().positive().max(180),
  fovVerticalDeg: z.number().positive().max(180),
  rangeM: z.number().positive(),
  nightMode: z.enum(["none", "ir", "low_light", "thermal"]),
  irRangeM: z.number().min(0),
  mountTypes: z.array(z.enum(["wall", "ceiling", "pole", "corner", "desk"])),
  lensType: z.enum(["fixed", "varifocal", "fisheye", "panoramic"]),
  focalLengthMm: z.number().positive().optional(),
  source: confidenceSourceSchema,
  confidence: confidenceLevelSchema,
  notes: z.string().optional(),
  edgeFalloffFactor: z.number().min(0).max(1).optional(),
});

export const calibrationConstantsSchema = z.object({
  cameraPresets: z.record(z.string(), calibrationCameraPresetSchema).default({}),
  luxThresholds: z.object({
    bright: z.number().positive().default(50),
    normal: z.number().positive().default(10),
    dim: z.number().positive().default(3),
    dark: z.number().positive().default(0.5),
  }).default({ bright: 50, normal: 10, dim: 3, dark: 0.5 }),
  nightModeRetention: z.object({
    thermal: z.number().min(0).max(1).default(0.92),
    low_light: z.number().min(0).max(1).default(0.82),
    ir: z.number().min(0).max(1).default(0.68),
    none: z.number().min(0).max(1).default(0.12),
  }).default({ thermal: 0.92, low_light: 0.82, ir: 0.68, none: 0.12 }),
  mountTiltLimits: z.object({
    wall: z.number().default(60), ceiling: z.number().default(45),
    pole: z.number().default(55), corner: z.number().default(50), desk: z.number().default(35),
  }).default({ wall: 60, ceiling: 45, pole: 55, corner: 50, desk: 35 }),
  lensEdgeFalloff: z.object({
    fixed: z.number().min(0).max(1).default(0.42),
    varifocal: z.number().min(0).max(1).default(0.35),
    fisheye: z.number().min(0).max(1).default(0.15),
    panoramic: z.number().min(0).max(1).default(0.20),
  }).default({ fixed: 0.42, varifocal: 0.35, fisheye: 0.15, panoramic: 0.20 }),
  version: z.string().default("0.1.0"),
  notes: z.string().default("Initial calibration constants"),
});

export const sceneInputHashSchema = z.object({
  hash: z.string(),
  includeFields: z.array(z.string()),
  algo: z.string().default("v1"),
  computedAt: z.number().int().nonnegative(),
});

export const simulationProvenanceSchema = z.object({
  engineVersion: z.string(),
  calibrationVersion: z.string(),
  calibrated: z.boolean().default(false),
  computationMode: z.enum(["full", "lite", "async"]).default("full"),
  computationTimeMs: z.number().min(0).optional(),
});

export const assumptionSensitivitySchema = z.object({
  assumptionName: z.string(),
  currentValue: z.union([z.string(), z.number(), z.boolean()]),
  testValue: z.union([z.string(), z.number(), z.boolean()]),
  coverageDeltaPct: z.number(),
  qualityDelta: z.number(),
  zoneStatusChanges: z.number().int().min(0),
  sensitivity: z.enum(["critical", "high", "medium", "low", "none"]),
  affectedZones: z.array(z.string()),
  description: z.string(),
});

export const scenarioStateSchema = z.object({
  label: z.string(),
  description: z.string().default(""),
  activeCameraIds: z.array(z.string()).optional(),
  offlineCameraIds: z.array(z.string()).optional(),
  lightStatusOverrides: z.record(z.string(), z.enum(["on", "off", "failed"])).optional(),
  doorStateOverrides: z.record(z.string(), z.enum(["open", "closed", "locked", "restricted"])).optional(),
  timeOfDay: z.enum(["day", "night", "dusk", "dawn", "custom"]).optional(),
  exteriorLightLux: z.number().optional(),
  interiorLightLevel: z.enum(["dark", "dim", "normal", "bright"]).optional(),
  obstructionMovedIds: z.array(z.string()).optional(),
  relativeOrder: z.number().int().min(0).default(0),
});

export const scenarioBatchResultSchema = z.object({
  scenarioId: z.string(),
  label: z.string(),
  totalCoveragePct: z.number().min(0).max(100),
  averageWalkableQuality: z.number().min(0),
  zonePassCount: z.number().int().min(0),
  zoneTotalCount: z.number().int().min(0),
  adversarialExposureScore: z.number().min(0).optional(),
  delta: z.object({
    totalCoverageDeltaPct: z.number(),
    qualityDelta: z.number(),
    zonePassDelta: z.number(),
    adversarialExposureDelta: z.number(),
    description: z.string(),
  }).optional(),
});

export const counterfactualResultSchema = z.object({
  candidateId: z.string(),
  description: z.string(),
  fixType: z.enum([
    "move_object", "rotate_camera", "add_camera", "add_light",
    "change_fov", "change_mount", "remove_object", "adjust_zoom", "other",
  ]),
  costCategory: z.enum(["free", "low", "medium", "high"]),
  installDifficulty: z.enum(["trivial", "easy", "moderate", "difficult", "custom"]).optional(),
  estimatedCost: z.string().optional(),
  constraintsOk: z.boolean(),
  violatedConstraints: z.array(z.string()).default([]),
  simulatedTotalCoveragePct: z.number().min(0).max(100),
  simulatedWorstQuality: doriQualitySchema,
  simulatedZonePassCount: z.number().int().min(0),
  simulatedZoneTotalCount: z.number().int().min(0),
  coverageDeltaPct: z.number(),
  qualityDeltaScore: z.number(),
  zoneDelta: z.number().int(),
  adversarialExposureDelta: z.number().optional(),
  score: z.number(),
  rank: z.number().int().min(1),
  affectedNodeId: z.string().optional(),
  suggestedPosition: point3Schema.optional(),
  suggestedYawDeg: z.number().optional(),
  suggestedPitchDeg: z.number().optional(),
  suggestedFovDeg: z.number().optional(),
});

export const counterfactualSearchResultSchema = z.object({
  baselineLabel: z.string().default("current"),
  candidates: z.array(counterfactualResultSchema),
  candidateCount: z.number().int().nonnegative(),
  topRecommendationId: z.string().optional(),
  constraints: z.object({
    cameraCannotMoveIds: z.array(z.string()).default([]),
    noNewCamera: z.boolean().default(false),
    maxCostCategory: z.enum(["free", "low", "medium", "high"]).default("high"),
    noPrivacyViolation: z.boolean().default(false),
    maxChanges: z.number().int().positive().default(3),
  }).default({
    cameraCannotMoveIds: [],
    noNewCamera: false,
    maxCostCategory: "high",
    noPrivacyViolation: false,
    maxChanges: 3,
  }),
  computedAt: z.number().int().nonnegative(),
});

export const recommendationSchema = z.object({
  type: z.enum([
    "move_object",
    "rotate_camera",
    "add_camera",
    "add_light",
    "change_fov",
    "change_mount",
    "remove_object",
    "adjust_zoom",
    "other",
  ]),
  description: z.string(),
  estimatedImpact: z.string(),
  costCategory: z.enum(["free", "low", "medium", "high"]),
  verified: z.boolean(),
  affectedNodeId: z.string().optional(),
  suggestedPosition: point3Schema.optional(),
  suggestedYawDeg: z.number().optional(),
  suggestedPitchDeg: z.number().optional(),
  confidence: confidenceBandSchema.optional(),
});

export const simulationResultSchema = z.object({
  performanceEnvelope: simulationPerformanceEnvelopeSchema.optional(),
  computedAt: z.number().int().nonnegative(),
  totalCoveragePct: z.number().min(0).max(100),
  blindspotPct: z.number().min(0).max(100),
  averageWalkableQuality: z.number().min(0),
  worstAreaQuality: doriQualitySchema,
  recognitionAreaPct: z.number().min(0).max(100),
  identificationAreaPct: z.number().min(0).max(100),
  coverageByQuality: z.object({
    detection: z.number().min(0).max(100),
    observation: z.number().min(0).max(100),
    recognition: z.number().min(0).max(100),
    identification: z.number().min(0).max(100),
  }),
  coverageCells: z.array(coverageCellResultSchema),
  criticalZoneResults: z.array(zoneResultSchema),
  cameraResults: z.array(cameraResultSchema),
  pathResults: z.array(pathVisibilityResultSchema),
  issues: z.array(securityIssueSchema),
  recommendations: z.array(recommendationSchema),
  adversarialPath: adversarialPathResultSchema.optional(),
  blindRegions: z.array(blindRegionSchema).optional(),
  blindSpotFingerprint: z.object({
    fingerprint: z.string(),
    signature: z.string(),
    regionCount: z.number().int().nonnegative(),
    criticalRegionCount: z.number().int().nonnegative(),
    entryConnectedRegionCount: z.number().int().nonnegative(),
    isolatedRegionCount: z.number().int().nonnegative(),
    totalBlindAreaSqM: z.number().min(0),
    largestRegionAreaSqM: z.number().min(0),
    affectedZoneCount: z.number().int().nonnegative(),
    severityCounts: z.object({
      critical: z.number().int().nonnegative(),
      high: z.number().int().nonnegative(),
      medium: z.number().int().nonnegative(),
      low: z.number().int().nonnegative(),
    }),
    classificationCounts: z.object({
      entry_corridor: z.number().int().nonnegative(),
      entry_connected: z.number().int().nonnegative(),
      isolated: z.number().int().nonnegative(),
    }),
  }).optional(),
  reflectiveBounce: reflectiveBounceSchema.optional(),
  occlusionBlame: z.array(z.object({
    zoneId: z.string(),
    zoneLabel: z.string(),
    baselineQuality: doriQualitySchema,
    obstructions: z.array(z.object({
      obstructionId: z.string(),
      label: z.string(),
      blameFraction: z.number().min(0).max(1),
      qualityWithout: doriQualitySchema,
      qualityImprovement: z.number().min(0),
    })),
  })).optional(),
  coverageThresholds: qualityThresholdSchema.optional(),
  fragilitySummary: z.object({
    meanFragility: z.number().min(0).max(1),
    fragileCellCount: z.number().int().nonnegative(),
    robustCellCount: z.number().int().nonnegative(),
    totalCells: z.number().int().nonnegative(),
  }).optional(),
  kRobustness: z.object({
    kRobustness: z.number().int().nonnegative(),
    totalCameras: z.number().int().nonnegative(),
    criticalSets: z.array(z.object({
      k: z.number().int().positive(),
      cameraIds: z.array(z.string()),
      cameraNames: z.array(z.string()),
      exposureScore: z.number().min(0),
      waypointCount: z.number().int().nonnegative(),
    })),
    isRobust: z.boolean(),
  }).optional(),
  placementOracle: z.object({
    sampleCount: z.number().int().nonnegative(),
    templateCameraId: z.string().nullable(),
    candidateCount: z.number().int().nonnegative(),
    bestCandidate: z.object({
      position: point3Schema,
      mountType: z.enum(["wall", "ceiling"]),
      yawDeg: z.number(),
      pitchDeg: z.number(),
      templateCameraId: z.string().nullable(),
      estimatedCoverageDeltaPct: z.number(),
      estimatedRecognitionDeltaPct: z.number(),
      estimatedIdentificationDeltaPct: z.number(),
      estimatedCriticalZoneGain: z.number(),
      improvedCriticalZones: z.array(z.string()),
      privacyZoneHits: z.array(z.string()),
      score: z.number(),
    }).nullable(),
    candidates: z.array(z.object({
      position: point3Schema,
      mountType: z.enum(["wall", "ceiling"]),
      yawDeg: z.number(),
      pitchDeg: z.number(),
      templateCameraId: z.string().nullable(),
      estimatedCoverageDeltaPct: z.number(),
      estimatedRecognitionDeltaPct: z.number(),
      estimatedIdentificationDeltaPct: z.number(),
      estimatedCriticalZoneGain: z.number(),
      improvedCriticalZones: z.array(z.string()),
      privacyZoneHits: z.array(z.string()),
      score: z.number(),
    })),
  }).optional(),

  // ── Simulation Engine Maturity Fields (Thread 2b) ──

  sceneHash: sceneInputHashSchema.optional(),
  provenance: simulationProvenanceSchema.optional(),
  scenarioBatchResults: z.array(scenarioBatchResultSchema).optional(),
  counterfactualSearch: counterfactualSearchResultSchema.optional(),
  assumptionSensitivity: z.array(assumptionSensitivitySchema).optional(),
  overallConfidence: confidenceBandSchema.optional(),
  zoneConfidence: z.record(z.string(), confidenceBandSchema).optional(),
  pathConfidence: z.record(z.string(), confidenceBandSchema).optional(),
  recommendationConfidence: z.record(z.string(), confidenceBandSchema).optional(),
  crowdOcclusion: z.object({
    hour: z.number().int().min(0).max(23),
    totalAgentCount: z.number().int().nonnegative(),
    geometricCoveragePct: z.number().min(0).max(100),
    effectiveCoveragePct: z.number().min(0).max(100),
    occlusionPenaltyPct: z.number().min(0).max(100),
    chokepoints: z.array(z.object({
      x: z.number(),
      z: z.number(),
      occlusionProbability: z.number().min(0).max(1),
      qualityWithCrowd: z.string(),
    })),
    agentDensityByZone: z.record(z.string(), z.number().nonnegative()),
  }).optional(),
  perimeterIntegrity: z.object({
    fenceSegmentCount: z.number().int().nonnegative(),
    totalPerimeterM: z.number().nonnegative(),
    coveredPerimeterM: z.number().nonnegative(),
    integrityPct: z.number().min(0).max(100),
    blindGates: z.array(z.object({ gateId: z.string(), gateLabel: z.string() })),
    breachedSegments: z.array(z.object({ segmentId: z.string(), label: z.string() })),
  }).optional(),
});

// ── Temporal Simulation Types (defined before base scene schema to avoid TDZ) ──

export const timePeriodSchema = z.object({
  startHour: z.number().min(0).max(23),
  endHour: z.number().min(0).max(24),  // 24 = midnight next day
  daysOfWeek: z.array(z.number().min(0).max(6)).optional(),
});

export const lightScheduleSchema = z.object({
  lightId: z.string(),
  periods: z.array(timePeriodSchema),
});

export const occupancyPeriodSchema = z.object({
  level: z.enum(["empty", "low", "medium", "high"]),
  timeRange: timePeriodSchema,
  cameraObstructionMultiplier: z.number().min(0).max(1).default(0),
});

export const patrolScheduleSchema = z.object({
  guardId: z.string(),
  patrolRouteId: z.string(),
  intervalMinutes: z.number().positive(),
  durationMinutes: z.number().positive(),
  firstPatrolHour: z.number().min(0).max(23),
});

// ── Thread 147: NPC/Crowd Simulation ─────────────────────────────────────────

export const agentArchetypeSchema = z.object({
  archetypeId: z.string(),
  label: z.string(),
  bodyRadiusM: z.number().positive().default(0.3),
  heightM: z.number().positive().default(1.7),
  preferredZones: z.array(z.string()).default([]),
  countByHour: z.array(z.number().min(0)).length(24),
});

// ── Perimeter & Outdoor (Thread 149) ─────────────────────────────────────────

export const fenceSegmentSchema = z.object({
  id: z.string().startsWith("fence_"),
  nodeType: z.literal("fence_segment"),
  label: z.string(),
  start: point2Schema,
  end: point2Schema,
  heightM: z.number().positive().default(1.8),
  material: z.enum(["chain_link", "solid_metal", "timber", "brick", "razor_wire", "electric"]).default("chain_link"),
  visionTransmission: z.number().min(0).max(1).default(0.7),
  integrityState: z.enum(["intact", "damaged", "breached"]).default("intact"),
  climbDifficulty: z.number().int().min(1).max(5).default(2),
  source: sceneSourceSchema,
  reviewStatus: reviewStatusSchema.default("unreviewed"),
  sourceTrace: z.string().default(""),
  geometryValidity: geometryValiditySchema.default("valid"),
});

export const gateNodeSchema = z.object({
  id: z.string().startsWith("gate_"),
  nodeType: z.literal("gate_node"),
  label: z.string(),
  position: point2Schema,
  fenceSegmentId: z.string().optional(),
  gateType: z.enum(["pedestrian", "vehicle", "service"]).default("pedestrian"),
  state: z.enum(["open", "closed", "locked", "restricted"]).default("closed"),
  widthM: z.number().positive().default(1.2),
  accessControl: doorAccessControlSchema.optional(),
  hasCameraView: z.boolean().default(false),
  lprCameraId: z.string().optional(),
  source: sceneSourceSchema,
  reviewStatus: reviewStatusSchema.default("unreviewed"),
  sourceTrace: z.string().default(""),
  geometryValidity: geometryValiditySchema.default("valid"),
});

export const bollardLineSchema = z.object({
  id: z.string().startsWith("bollard_"),
  nodeType: z.literal("bollard_line"),
  label: z.string(),
  start: point2Schema,
  end: point2Schema,
  spacingM: z.number().positive().default(1.0),
  bollardType: z.enum(["fixed", "removable", "retractable"]).default("fixed"),
  protectionClass: z.enum(["standard", "pas68", "iwa14_1"]).default("standard"),
  source: sceneSourceSchema,
  reviewStatus: reviewStatusSchema.default("unreviewed"),
  sourceTrace: z.string().default(""),
  geometryValidity: geometryValiditySchema.default("valid"),
});

export type FenceSegment = z.infer<typeof fenceSegmentSchema>;
export type GateNode = z.infer<typeof gateNodeSchema>;
export type BollardLine = z.infer<typeof bollardLineSchema>;

export const crowdProfileSchema = z.object({
  id: z.string(),
  label: z.string(),
  archetypes: z.array(agentArchetypeSchema),
  enabled: z.boolean().default(true),
});

export type AgentArchetype = z.infer<typeof agentArchetypeSchema>;
export type CrowdProfile = z.infer<typeof crowdProfileSchema>;

// ── Thread 153: Event / Temporary Site Configuration ─────────────────────────

export const eventPhaseSchema = z.object({
  id: z.string(),
  label: z.string(),
  phase: z.enum(["setup", "ingress", "live", "egress", "teardown"]),
  startHour: z.number().min(0).max(23),
  endHour: z.number().min(0).max(24),
  expectedOccupancy: z.enum(["empty", "low", "medium", "high", "peak"]).default("medium"),
  crowdProfileOverrideId: z.string().optional(),
  notes: z.string().default(""),
});

export const eventConfigSchema = z.object({
  eventName: z.string(),
  eventType: z.enum([
    "concert", "trade_show", "sporting_event", "outdoor_market",
    "festival", "pop_up", "protest", "ceremony", "other",
  ]).default("other"),
  isActive: z.boolean().default(true),
  expectedPeakAttendance: z.number().int().nonnegative(),
  venueBoundaryMode: z.enum(["indoor", "outdoor", "hybrid"]).default("outdoor"),
  dateStart: z.string().optional(),
  dateEnd: z.string().optional(),
  phases: z.array(eventPhaseSchema).default([]),
  weatherRiskLevel: z.enum(["none", "low", "moderate", "high"]).default("none"),
  specialRisks: z.array(z.string()).default([]),
});

export type EventPhase = z.infer<typeof eventPhaseSchema>;
export type EventConfig = z.infer<typeof eventConfigSchema>;

// ─────────────────────────────────────────────────────────────────────────────

export const timeScheduleSchema = z.object({
  location: z.object({
    latitude: z.number(),
    longitude: z.number(),
    timezone: z.string(),
  }).optional(),
  seasonalDate: z.string().optional(),
  interiorLightSchedule: z.array(lightScheduleSchema).default([]),
  exteriorLightSchedule: z.array(lightScheduleSchema).default([]),
  doorLockSchedule: z.array(z.object({
    doorId: z.string(),
    periods: z.array(timePeriodSchema),
  })).default([]),
  occupancySchedule: z.array(occupancyPeriodSchema).default([]),
  guardPatrolSchedule: z.array(patrolScheduleSchema).default([]),
});

export const hourlySecuritySnapshotSchema = z.object({
  hour: z.number().int().min(0).max(23),
  minute: z.number().int().min(0).max(59),
  overallCoveragePct: z.number().min(0).max(100),
  /** Geometric coverage before crowd occlusion adjustment. Present when crowd profiles are active. */
  geometricCoveragePct: z.number().min(0).max(100).optional(),
  /** Number of crowd agents at this time slot. Present when crowd profiles are active. */
  crowdAgentCount: z.number().int().nonnegative().optional(),
  criticalZonePassCount: z.number().int().min(0),
  criticalZoneTotalCount: z.number().int().min(0),
  criticalZoneStatuses: z.record(z.string(), z.enum(["pass", "fail", "partial"])),
  activeCameraCount: z.number().int().min(0),
  activeLightCount: z.number().int().min(0),
  adversarialPathExposureScore: z.number().min(0),
  issues: z.array(z.string()),
  stateLabel: z.string(),
});

export const vulnerabilityWindowSchema = z.object({
  startHour: z.number().min(0).max(23),
  startMinute: z.number().min(0).max(59),
  endHour: z.number().min(0).max(24),
  endMinute: z.number().min(0).max(59),
  severity: z.enum(["high", "medium", "low"]),
  reasons: z.array(z.string()),
  criticalZonesFailing: z.array(z.string()),
  adversarialRouteAvailable: z.boolean(),
});

export const temporalAnomalyWindowSchema = z.object({
  startHour: z.number().min(0).max(23),
  startMinute: z.number().min(0).max(59),
  endHour: z.number().min(0).max(24),
  endMinute: z.number().min(0).max(59),
  severity: z.enum(["high", "medium", "low"]),
  anomalyType: z.enum(["coverage_drop", "zone_flip", "adversarial_spike", "mixed"]),
  coverageDeltaPct: z.number(),
  zonePassDelta: z.number().int(),
  exposureDelta: z.number(),
  description: z.string(),
  affectedZones: z.array(z.string()),
});

export const temporalAnomalySummarySchema = z.object({
  totalAnomalies: z.number().int().nonnegative(),
  highSeverityCount: z.number().int().nonnegative(),
  mediumSeverityCount: z.number().int().nonnegative(),
  lowSeverityCount: z.number().int().nonnegative(),
  worstCoverageDropPct: z.number(),
  worstExposureJump: z.number(),
});

export const temporalSecurityProfileSchema = z.object({
  hoursAnalyzed: z.number().default(24),
  resolutionMinutes: z.number().default(15),
  hourlySnapshots: z.array(hourlySecuritySnapshotSchema),
  peakVulnerabilityWindows: z.array(vulnerabilityWindowSchema),
  safestPeriods: z.array(timePeriodSchema),
  criticalZoneCoverageByHour: z.record(z.string(), z.array(z.number())),
  anomalyWindows: z.array(temporalAnomalyWindowSchema).default([]),
  anomalySummary: temporalAnomalySummarySchema.optional(),
  computedAt: z.number().int().nonnegative(),
});

const securitySceneBaseSchema = z.object({
  id: z.string().startsWith("scene_"),
  name: z.string(),
  createdAt: z.number().int().nonnegative(),
  updatedAt: z.number().int().nonnegative(),
  units: z.enum(["meters", "feet"]),
  dimensions: z.object({
    width: z.number().positive(),
    depth: z.number().positive(),
    height: z.number().positive(),
  }),
  walls: z.array(wallNodeSchema),
  doors: z.array(doorNodeSchema).default([]),
  windows: z.array(windowNodeSchema).default([]),
  cameras: z.array(cameraNodeSchema),
  securityLights: z.array(securityLightNodeSchema).default([]),
  obstructions: z.array(obstructionNodeSchema).default([]),
  criticalZones: z.array(criticalZoneNodeSchema).default([]),
  privacyZones: z.array(privacyZoneNodeSchema).default([]),
  sensors: z.array(sensorNodeSchema).default([]),
  comments: z.array(commentNodeSchema).default([]),
  entryPoints: z.array(entryPointNodeSchema).default([]),
  paths: z.array(scenarioPathSchema).default([]),
  evidenceArtifacts: z.array(cameraEvidenceArtifactSchema).default([]),
  mismatchReports: z.array(mismatchReportSchema).default([]),
  assumptions: simulationAssumptionsSchema,
  calibrationConstants: calibrationConstantsSchema.optional(),
  timeSchedule: timeScheduleSchema.optional(),
  eventConfig: eventConfigSchema.optional(),
  crowdProfiles: z.array(crowdProfileSchema).default([]),
  fenceSegments: z.array(fenceSegmentSchema).default([]),
  gateNodes: z.array(gateNodeSchema).default([]),
  bollardLines: z.array(bollardLineSchema).default([]),
  simulation: simulationResultSchema.optional(),
  previousSimulation: simulationResultSchema.optional(),
  temporalProfile: temporalSecurityProfileSchema.optional(),
  changeLog: z.array(z.string()).default([]),
  source: sceneSourceSchema,
  reviewStatus: reviewStatusSchema.default("unreviewed"),
  sourceTrace: z.string().default(""),
  geometryValidity: geometryValiditySchema.default("valid"),
  version: z.string(),
});

export const sceneSnapshotSchema = z.object({
  id: z.string().startsWith("snap_"),
  label: z.string(),
  createdAt: z.number().int().nonnegative(),
  scene: securitySceneBaseSchema,
  simulation: simulationResultSchema.optional(),
  notes: z.string().optional(),
});

export const securitySceneSchema = securitySceneBaseSchema.extend({
  snapshots: z.array(sceneSnapshotSchema).default([]),
  scenarios: z.array(z.string()).default([]),
});

export type DoriQuality = z.infer<typeof doriQualitySchema>;
export type WallNode = z.infer<typeof wallNodeSchema>;
export type DoorNode = z.infer<typeof doorNodeSchema>;
export type WindowNode = z.infer<typeof windowNodeSchema>;
export type CameraNode = z.infer<typeof cameraNodeSchema>;
export type SecurityLightNode = z.infer<typeof securityLightNodeSchema>;
export type ObstructionNode = z.infer<typeof obstructionNodeSchema>;
export type CriticalZoneNode = z.infer<typeof criticalZoneNodeSchema>;
export type PrivacyZoneNode = z.infer<typeof privacyZoneNodeSchema>;
export type SensorNode = z.infer<typeof sensorNodeSchema>;
export type CommentNode = z.infer<typeof commentNodeSchema>;
export type EntryPointNode = z.infer<typeof entryPointNodeSchema>;
export type CameraEvidenceArtifact = z.infer<typeof cameraEvidenceArtifactSchema>;
export type MismatchReport = z.infer<typeof mismatchReportSchema>;

export type SceneUpdateSuggestion = z.infer<typeof sceneUpdateSuggestionSchema>;
export type PathPoint = z.infer<typeof pathPointSchema>;
export type ScenarioPath = z.infer<typeof scenarioPathSchema>;
export type CameraMovementMode = z.infer<typeof cameraMovementModeSchema>;
export type CameraMotionWaypoint = z.infer<typeof cameraMotionWaypointSchema>;
export type CameraViewMotion = z.infer<typeof cameraViewMotionSchema>;
export type SimulationAssumptions = z.infer<typeof simulationAssumptionsSchema>;
export type ZoneResult = z.infer<typeof zoneResultSchema>;
export type QualityThresholds = z.infer<typeof qualityThresholdSchema>;
export type CameraOfflineImpactEntry = z.infer<typeof cameraOfflineImpactEntrySchema>;
export type CameraResult = z.infer<typeof cameraResultSchema>;
export type PathVisibilityResult = z.infer<typeof pathVisibilityResultSchema>;
export type SecurityIssue = z.infer<typeof securityIssueSchema>;
export type Recommendation = z.infer<typeof recommendationSchema>;
export type AdversarialPathResult = z.infer<typeof adversarialPathResultSchema>;
export type CoverageCellResult = z.infer<typeof coverageCellResultSchema>;
export type BlindRegionResult = z.infer<typeof blindRegionSchema>;
export type ReflectiveBounceResult = z.infer<typeof reflectiveBounceSchema>;
export type SimulationResult = z.infer<typeof simulationResultSchema>;
export type SceneSnapshot = z.infer<typeof sceneSnapshotSchema>;
export type SecurityScene = z.infer<typeof securitySceneSchema>;
export type SerializedSecurityScene = z.input<typeof securitySceneSchema>;
export type AnyNode =
  | WallNode
  | DoorNode
  | WindowNode
  | CameraNode
  | SecurityLightNode
  | SensorNode
  | ObstructionNode
  | CriticalZoneNode
  | PrivacyZoneNode
  | EntryPointNode
  | ScenarioPath
  | CommentNode
  | FenceSegment
  | GateNode
  | BollardLine;

export type AnyEditableNode = AnyNode;

export type TimePeriod = z.infer<typeof timePeriodSchema>;
export type LightSchedule = z.infer<typeof lightScheduleSchema>;
export type OccupancyPeriod = z.infer<typeof occupancyPeriodSchema>;
export type PatrolSchedule = z.infer<typeof patrolScheduleSchema>;
export type TimeSchedule = z.infer<typeof timeScheduleSchema>;
export type HourlySecuritySnapshot = z.infer<typeof hourlySecuritySnapshotSchema>;
export type VulnerabilityWindow = z.infer<typeof vulnerabilityWindowSchema>;
export type TemporalSecurityProfile = z.infer<typeof temporalSecurityProfileSchema>;
export type TemporalAnomalyWindow = z.infer<typeof temporalAnomalyWindowSchema>;
export type TemporalAnomalySummary = z.infer<typeof temporalAnomalySummarySchema>;

export type ConfidenceLevel = z.infer<typeof confidenceLevelSchema>;
export type ConfidenceSource = z.infer<typeof confidenceSourceSchema>;
export type ConfidenceBand = z.infer<typeof confidenceBandSchema>;
export type CalibrationCameraPreset = z.infer<typeof calibrationCameraPresetSchema>;
export type CalibrationConstants = z.infer<typeof calibrationConstantsSchema>;
export type SceneInputHash = z.infer<typeof sceneInputHashSchema>;
export type SimulationProvenance = z.infer<typeof simulationProvenanceSchema>;
export type AssumptionSensitivity = z.infer<typeof assumptionSensitivitySchema>;
export type ScenarioState = z.infer<typeof scenarioStateSchema>;
export type ScenarioBatchResult = z.infer<typeof scenarioBatchResultSchema>;
export type CounterfactualResult = z.infer<typeof counterfactualResultSchema>;
export type CounterfactualSearchResult = z.infer<typeof counterfactualSearchResultSchema>;

export type ReviewStatus = z.infer<typeof reviewStatusSchema>;
export type SceneSource = z.infer<typeof sceneSourceSchema>;

export function migrateSecuritySceneInput(input: unknown): unknown {
  if (!input || typeof input !== "object") return input;
  const scene = structuredClone(input) as Record<string, unknown>;
  const commentsRaw = scene.comments;
  if (!Array.isArray(commentsRaw)) return scene;

  scene.comments = commentsRaw.map((entry) => {
    if (!entry || typeof entry !== "object") return entry;
    const comment = { ...(entry as Record<string, unknown>) };
    const id = typeof comment.id === "string" ? comment.id : "";
    if (id.startsWith("cmt_")) {
      comment.id = `comment_${id.slice(4)}`;
    }
    if (typeof comment.label !== "string" || comment.label.trim().length === 0) {
      comment.label = "Comment";
    }
    if (typeof comment.author !== "string" || comment.author.trim().length === 0) {
      comment.author = "Operator";
    }
    if (typeof comment.source !== "string") {
      comment.source = "manual";
    }
    if (typeof comment.sourceTrace !== "string") {
      comment.sourceTrace = "";
    }
    if (typeof comment.geometryValidity !== "string") {
      comment.geometryValidity = "valid";
    }
    if (typeof comment.reviewStatus !== "string") {
      comment.reviewStatus = "unreviewed";
    }
    return comment;
  });
  return scene;
}

export function parseSecurityScene(input: unknown): SecurityScene {
  return securitySceneSchema.parse(migrateSecuritySceneInput(input));
}

export function safeParseSecurityScene(input: unknown) {
  return securitySceneSchema.safeParse(migrateSecuritySceneInput(input));
}

export function cloneSecurityScene(scene: SecurityScene): SecurityScene {
  return structuredClone(scene);
}

/** Lightweight clone that strips heavy non-geometry fields before deep-copying.
 *  Use when the clone is only needed for simulation (coverage, path, zone eval),
 *  avoiding the cost of copying simulation results, snapshots, changelogs, etc.
 *
 *  IMPORTANT: When new fields are added to SecurityScene, check whether they
 *  should be preserved (simulation-relevant) or stripped (non-geometry metadata).
 *  Fields NOT explicitly listed in the strip set WILL be preserved via the spread. */
export function cloneSecuritySceneSimulation(scene: SecurityScene): SecurityScene {
  const lite = {
    ...scene,
    // Stripped — non-geometry metadata, results, or heavy logs
    simulation: undefined,
    snapshots: [],
    scenarios: [],
    temporalProfile: undefined,
    changeLog: [],
    comments: [],
    evidenceArtifacts: [],
    mismatchReports: [],
    // Preserved — simulation-relevant fields (calibration, geometry, assumptions, etc.)
    //   calibrationConstants — kept (affects simulation thresholds)
    //   timeSchedule — kept (affects temporal simulation)
    //   source, sourceTrace, reviewStatus, geometryValidity — kept (affects confidence)
  };
  return structuredClone(lite);
}
