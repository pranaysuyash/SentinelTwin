/**
 * Capability Registry — single source of truth for feature maturity gating.
 *
 * Every UI surface that renders an advanced feature should query this registry
 * to know whether the feature is Available, Preview, Stub, RequiresBackend,
 * RequiresIntegration, or Planned. This prevents the app from exposing
 * advanced fields as if they are operational (motto_v3 §0.11).
 *
 * @see Docs/review/PRODUCT_REVIEW_2026-07-10.md §9
 * @see apps/studio/src/lib/product-feature-status.ts (display-oriented list)
 */

// ── Types ──────────────────────────────────────────────────────────────────

export type CapabilityLevel =
  | "Available"
  | "Preview"
  | "Stub"
  | "RequiresBackend"
  | "RequiresIntegration"
  | "Planned";

export interface CapabilityEntry {
  /** Stable snake_case identifier — never rename once wired into UI. */
  id: CapabilityId;
  /** Human-readable display label. */
  label: string;
  /** Maturity level. */
  level: CapabilityLevel;
  /** Short description shown in tooltips / detail panels. */
  detail: string;
  /** Whether this capability is safe to expose in production surfaces. */
  productionReady: boolean;
}

/** Exhaustive union of all capability IDs. Add new capabilities here. */
export type CapabilityId =
  | "scan_site"
  | "ai_layout_draft"
  | "floor_plan_import"
  | "json_import"
  | "manual_builder"
  | "real_footage_verification"
  | "governance"
  | "workspace_catalog"
  | "workspace_account"
  | "guided_scan_reconstruction"
  | "reconstruction_data_model"
  | "ai_cv_adapters"
  | "reconstruction_compilation"
  | "live_camera_connection"
  | "sensor_ingest"
  | "onvif_events"
  | "incident_replay"
  | "counterfactual_planning"
  | "report_generation"
  | "compliance_templates"
  | "camera_wall_view"
  | "path_replay_animation"
  | "temporal_simulation"
  | "adversarial_path_simulation"
  | "isic_import";

// ── Registry ───────────────────────────────────────────────────────────────

const REGISTRY: Record<CapabilityId, CapabilityEntry> = {
  scan_site: {
    id: "scan_site",
    label: "Scan Site Photos",
    level: "Preview",
    detail:
      "Guided capture + manual review from phone photos. Automatic segmentation/depth is rolling out.",
    productionReady: false,
  },
  ai_layout_draft: {
    id: "ai_layout_draft",
    label: "AI Layout Draft",
    level: "Preview",
    detail:
      "Prompt-to-scene starter with model-backed output when configured.",
    productionReady: false,
  },
  floor_plan_import: {
    id: "floor_plan_import",
    label: "Floor Plan Import",
    level: "Available",
    detail:
      "Heuristic parse with calibration and detection correction before scene creation.",
    productionReady: true,
  },
  json_import: {
    id: "json_import",
    label: "Import Site Twin",
    level: "Available",
    detail: "Import a validated site twin data file. Auto-validates on load.",
    productionReady: true,
  },
  manual_builder: {
    id: "manual_builder",
    label: "Build Manually",
    level: "Available",
    detail: "Start from a blank canvas. Draw walls, place cameras, define zones.",
    productionReady: true,
  },
  real_footage_verification: {
    id: "real_footage_verification",
    label: "Verify from Footage",
    level: "Preview",
    detail:
      "Camera View verification with reference-frame upload, overlay alignment, and video frame extraction. Auto pose/FOV recovery not yet implemented.",
    productionReady: false,
  },
  governance: {
    id: "governance",
    label: "Governance Control Plane",
    level: "Preview",
    detail:
      "Role-aware publish, review, approval, rejection, and annotation controls with evidence-logged audit trails.",
    productionReady: false,
  },
  workspace_catalog: {
    id: "workspace_catalog",
    label: "Workspace Catalog",
    level: "Preview",
    detail:
      "Local workspace catalog summary with organization, owner, visibility, and surface mix.",
    productionReady: false,
  },
  workspace_account: {
    id: "workspace_account",
    label: "Workspace Account Bridge",
    level: "Preview",
    detail:
      "Derived local account summary with plan posture, soft quota, and entitlements.",
    productionReady: false,
  },
  guided_scan_reconstruction: {
    id: "guided_scan_reconstruction",
    label: "Guided Scan Reconstruction",
    level: "Preview",
    detail:
      "Guided scan assistant with auto-path hints and manual review, compiled through editable SecurityScene pipeline.",
    productionReady: false,
  },
  reconstruction_data_model: {
    id: "reconstruction_data_model",
    label: "Reconstruction Data Model",
    level: "Stub",
    detail:
      "ScanArtifact, ScanCaptureSession, and ScanCandidate types. The session object supports guided capture sequence, per-candidate bounding boxes, and confidence tracking.",
    productionReady: false,
  },
  ai_cv_adapters: {
    id: "ai_cv_adapters",
    label: "AI/CV Adapter Interfaces",
    level: "Stub",
    detail:
      "Adapter interfaces for object detection, segmentation, depth estimation, scale anchoring, multi-photo correspondence, and structural extraction.",
    productionReady: false,
  },
  reconstruction_compilation: {
    id: "reconstruction_compilation",
    label: "Reconstruction Compilation",
    level: "Preview",
    detail:
      "compileReconstructionToScene() converts accepted candidates into valid SecurityScene through SiteTwinDraft.",
    productionReady: false,
  },
  live_camera_connection: {
    id: "live_camera_connection",
    label: "Live Camera Connection",
    level: "RequiresBackend",
    detail:
      "Connect to physical cameras via RTSP/ONVIF streams. Requires backend media server.",
    productionReady: false,
  },
  sensor_ingest: {
    id: "sensor_ingest",
    label: "Sensor Ingest",
    level: "RequiresBackend",
    detail:
      "Ingest data from motion, door, glass-break, and environmental sensors. Requires backend event pipeline.",
    productionReady: false,
  },
  onvif_events: {
    id: "onvif_events",
    label: "ONVIF Event Subscriptions",
    level: "RequiresIntegration",
    detail:
      "Subscribe to ONVIF device events (motion detection, tampering, line crossing). Requires ONVIF-compliant camera hardware.",
    productionReady: false,
  },
  incident_replay: {
    id: "incident_replay",
    label: "Incident Replay",
    level: "Preview",
    detail:
      "Replay recorded incident paths through the scene to analyze detection gaps and response timing.",
    productionReady: false,
  },
  counterfactual_planning: {
    id: "counterfactual_planning",
    label: "Counterfactual Planning",
    level: "Preview",
    detail:
      "Propose and test security improvements — camera repositioning, obstruction removal, zone expansion — with before/after comparison.",
    productionReady: false,
  },
  report_generation: {
    id: "report_generation",
    label: "Report Generation",
    level: "Available",
    detail:
      "Generate PDF/JSON security reports from simulation results, evidence events, and operator annotations.",
    productionReady: true,
  },
  compliance_templates: {
    id: "compliance_templates",
    label: "Compliance Templates",
    level: "Planned",
    detail:
      "Pre-built report templates aligned with IEC 62676-4:2025, NDAA, and GDPR requirements.",
    productionReady: false,
  },
  camera_wall_view: {
    id: "camera_wall_view",
    label: "Camera Wall View",
    level: "Preview",
    detail:
      "Multi-camera grid view for monitoring and comparing live/virtual feeds side by side.",
    productionReady: false,
  },
  path_replay_animation: {
    id: "path_replay_animation",
    label: "Path Replay Animation",
    level: "Available",
    detail:
      "Animated path visualization with actor, timeline scrubbing, and detection zone highlighting.",
    productionReady: true,
  },
  temporal_simulation: {
    id: "temporal_simulation",
    label: "Temporal Simulation",
    level: "Available",
    detail:
      "24-hour temporal security profile showing coverage variation across time-of-day, lighting, and staffing conditions.",
    productionReady: true,
  },
  adversarial_path_simulation: {
    id: "adversarial_path_simulation",
    label: "Adversarial Path Simulation",
    level: "Preview",
    detail:
      "AI-generated adversarial paths that probe for coverage gaps and blindspot topology.",
    productionReady: false,
  },
  isic_import: {
    id: "isic_import",
    label: "IFC/STEP BIM Import",
    level: "Preview",
    detail:
      "Import IFC and STEP BIM models for structural geometry and storey extraction.",
    productionReady: false,
  },
};

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * Look up a single capability by ID.
 * Returns the entry or `undefined` if the ID is not in the registry.
 */
export function getCapabilityStatus(id: CapabilityId): CapabilityEntry | undefined {
  return REGISTRY[id];
}

/**
 * Look up a single capability by ID, throwing if not found.
 * Use when the caller knows the ID is valid (e.g., wired from a constant).
 */
export function requireCapability(id: CapabilityId): CapabilityEntry {
  const entry = REGISTRY[id];
  if (!entry) {
    throw new Error(`Capability "${id}" not found in registry`);
  }
  return entry;
}

/**
 * Get all capabilities at a given maturity level.
 */
export function getCapabilitiesByLevel(level: CapabilityLevel): CapabilityEntry[] {
  return Object.values(REGISTRY).filter((e) => e.level === level);
}

/**
 * Check whether a capability is production-ready.
 */
export function isProductionReady(id: CapabilityId): boolean {
  return REGISTRY[id]?.productionReady ?? false;
}

/**
 * Check whether a capability is at least the given level.
 * Level ordering: Available > Preview > Stub > RequiresBackend > RequiresIntegration > Planned.
 */
export function isAtLeast(id: CapabilityId, level: CapabilityLevel): boolean {
  const ORDER: CapabilityLevel[] = [
    "Available",
    "Preview",
    "Stub",
    "RequiresBackend",
    "RequiresIntegration",
    "Planned",
  ];
  const entry = REGISTRY[id];
  if (!entry) return false;
  return ORDER.indexOf(entry.level) <= ORDER.indexOf(level);
}

/**
 * Get all capabilities as an array (for rendering lists / dashboards).
 */
export function getAllCapabilities(): CapabilityEntry[] {
  return Object.values(REGISTRY);
}
