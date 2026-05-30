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
});

export const doorNodeSchema = z.object({
  id: z.string().startsWith("door_"),
  nodeType: z.literal("door"),
  label: z.string(),
  position: point3Schema,
  dimensions: point3Schema,
  state: z.enum(["open", "closed", "locked", "restricted"]),
  source: sceneSourceSchema,
  reviewStatus: reviewStatusSchema.default("unreviewed"),
  sourceTrace: z.string().default(""),
  geometryValidity: geometryValiditySchema.default("valid"),
});

export const windowNodeSchema = z.object({
  id: z.string().startsWith("window_"),
  nodeType: z.literal("window"),
  label: z.string(),
  position: point3Schema,
  dimensions: point3Schema,
  state: z.enum(["closed_glass", "open", "grill", "curtain", "reflective"]),
  visionTransmission: z.number().min(0).max(1),
  source: sceneSourceSchema,
  reviewStatus: reviewStatusSchema.default("unreviewed"),
  sourceTrace: z.string().default(""),
  geometryValidity: geometryValiditySchema.default("valid"),
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

export const recommendationSchema = z.object({
  type: z.enum([
    "move_object",
    "rotate_camera",
    "add_camera",
    "add_light",
    "change_fov",
    "other",
  ]),
  description: z.string(),
  estimatedImpact: z.string(),
  costCategory: z.enum(["free", "low", "medium", "high"]),
  verified: z.boolean(),
  // Apply-fix support: node to act on and suggested transform
  affectedNodeId: z.string().optional(),
  suggestedPosition: point3Schema.optional(),
  suggestedYawDeg: z.number().optional(),
  suggestedPitchDeg: z.number().optional(),
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

export const simulationResultSchema = z.object({
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

export const timeScheduleSchema = z.object({
  location: z.object({
    latitude: z.number(),
    longitude: z.number(),
    timezone: z.string(),
  }).optional(),
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
  entryPoints: z.array(entryPointNodeSchema).default([]),
  paths: z.array(scenarioPathSchema).default([]),
  assumptions: simulationAssumptionsSchema,
  timeSchedule: timeScheduleSchema.optional(),
  simulation: simulationResultSchema.optional(),
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
export type EntryPointNode = z.infer<typeof entryPointNodeSchema>;
export type PathPoint = z.infer<typeof pathPointSchema>;
export type ScenarioPath = z.infer<typeof scenarioPathSchema>;
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
export type AnyEditableNode =
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
  | ScenarioPath;

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

export function parseSecurityScene(input: unknown): SecurityScene {
  return securitySceneSchema.parse(input);
}

export function safeParseSecurityScene(input: unknown) {
  return securitySceneSchema.safeParse(input);
}

export function cloneSecurityScene(scene: SecurityScene): SecurityScene {
  return structuredClone(scene);
}
