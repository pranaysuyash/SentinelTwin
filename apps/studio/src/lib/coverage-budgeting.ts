/**
 * Coverage Budgeting — hardware cost estimation for SentinelTwin studio.
 *
 * Derives realistic budget estimates from the existing camera presets,
 * light types, and obstruction data in a SecurityScene.
 */

import type {
  CameraNode,
  SecurityLightNode,
  ObstructionNode,
  SecurityScene,
} from "@/schema/security-scene";
import { CAMERA_PRESETS } from "@/components/workspace/camera-preset-utils";

// ── Constants ─────────────────────────────────────────────────────────────────

/** Per-mount-type labour cost for camera installation. */
export const CAMERA_INSTALLATION_RATES: Record<string, number> = {
  wall: 75,
  ceiling: 95,
  pole: 120,
  corner: 110,
  desk: 45,
};

/** Cost per metre of ethernet / coax cable. */
export const CABLE_COST_PER_METER = 3.5;

/** Hourly labour rate for installation work. */
export const LABOR_RATE_PER_HOUR = 85;

/** Default cable length (metres) assumed when positions are unknown. */
const DEFAULT_CABLE_LENGTH_M = 15;

// ── Camera cost presets (maps onto CAMERA_PRESETS by id) ─────────────────────

export interface CameraCostSpec {
  cameraCost: number;
  installationCost: number;
  mountCost: number;
  cableCost: number;
  laborHours: number;
}

/**
 * Hardware + labour estimates for each camera preset.
 * Values are mid-range commercial CCTV prices (USD, 2025).
 */
export const CAMERA_COST_MODEL: Record<string, CameraCostSpec> = {
  dome_indoor: {
    cameraCost: 180,
    installationCost: 95,
    mountCost: 25,
    cableCost: 52.5,
    laborHours: 1.5,
  },
  bullet_outdoor: {
    cameraCost: 250,
    installationCost: 75,
    mountCost: 35,
    cableCost: 70,
    laborHours: 2.0,
  },
  ptz_professional: {
    cameraCost: 850,
    installationCost: 120,
    mountCost: 80,
    cableCost: 70,
    laborHours: 3.0,
  },
  fisheye_360: {
    cameraCost: 420,
    installationCost: 95,
    mountCost: 30,
    cableCost: 52.5,
    laborHours: 2.0,
  },
  thermal_perimeter: {
    cameraCost: 2100,
    installationCost: 120,
    mountCost: 120,
    cableCost: 105,
    laborHours: 4.0,
  },
  low_light_indoor: {
    cameraCost: 320,
    installationCost: 110,
    mountCost: 30,
    cableCost: 52.5,
    laborHours: 1.8,
  },
  license_plate: {
    cameraCost: 580,
    installationCost: 75,
    mountCost: 45,
    cableCost: 52.5,
    laborHours: 2.2,
  },
  panoramic_wide: {
    cameraCost: 780,
    installationCost: 95,
    mountCost: 45,
    cableCost: 52.5,
    laborHours: 2.5,
  },
};

/** Fallback cost spec used when no preset matches a camera. */
const FALLBACK_CAMERA_COST: CameraCostSpec = {
  cameraCost: 300,
  installationCost: 85,
  mountCost: 30,
  cableCost: 52.5,
  laborHours: 1.8,
};

// ── Light cost presets ────────────────────────────────────────────────────────

export interface LightCostSpec {
  lightCost: number;
  installationCost: number;
  mountCost: number;
  cableCost: number;
  laborHours: number;
}

export const LIGHT_COST_MODEL: Record<string, LightCostSpec> = {
  ceiling: {
    lightCost: 120,
    installationCost: 65,
    mountCost: 15,
    cableCost: 35,
    laborHours: 1.0,
  },
  wall: {
    lightCost: 90,
    installationCost: 55,
    mountCost: 15,
    cableCost: 35,
    laborHours: 0.8,
  },
  flood: {
    lightCost: 180,
    installationCost: 75,
    mountCost: 40,
    cableCost: 52.5,
    laborHours: 1.5,
  },
  street: {
    lightCost: 420,
    installationCost: 120,
    mountCost: 85,
    cableCost: 70,
    laborHours: 2.5,
  },
  emergency: {
    lightCost: 260,
    installationCost: 65,
    mountCost: 20,
    cableCost: 35,
    laborHours: 1.2,
  },
  ir_flood: {
    lightCost: 340,
    installationCost: 75,
    mountCost: 35,
    cableCost: 52.5,
    laborHours: 1.5,
  },
};

const FALLBACK_LIGHT_COST: LightCostSpec = {
  lightCost: 150,
  installationCost: 65,
  mountCost: 20,
  cableCost: 35,
  laborHours: 1.0,
};

// ── Obstruction cost model ────────────────────────────────────────────────────

export interface ObstructionCostSpec {
  moveCost: number;
  removalCost: number;
  laborHours: number;
  description: string;
}

export const OBSTRUCTION_COST_MODEL: Record<string, ObstructionCostSpec> = {
  shelf:         { moveCost: 40,   removalCost: 25,  laborHours: 0.5, description: "Move shelf" },
  cupboard:      { moveCost: 80,   removalCost: 50,  laborHours: 1.0, description: "Move cupboard" },
  counter:       { moveCost: 120,  removalCost: 80,  laborHours: 1.5, description: "Relocate counter" },
  pillar:        { moveCost: 0,    removalCost: 0,   laborHours: 0,   description: "Structural pillar (not movable)" },
  partition:     { moveCost: 150,  removalCost: 100, laborHours: 2.0, description: "Move partition wall" },
  vehicle:       { moveCost: 0,    removalCost: 0,   laborHours: 0,   description: "Vehicle (assume transient)" },
  tree:          { moveCost: 200,  removalCost: 300, laborHours: 3.0, description: "Trim / relocate tree" },
  gate:          { moveCost: 100,  removalCost: 60,  laborHours: 1.5, description: "Adjust gate" },
  signboard:     { moveCost: 50,   removalCost: 30,  laborHours: 0.5, description: "Relocate signboard" },
  storage_boxes: { moveCost: 30,   removalCost: 15,  laborHours: 0.3, description: "Clear storage boxes" },
  glass_display: { moveCost: 80,   removalCost: 60,  laborHours: 1.0, description: "Move glass display" },
  curtain:       { moveCost: 20,   removalCost: 15,  laborHours: 0.3, description: "Adjust curtain" },
  other:         { moveCost: 50,   removalCost: 35,  laborHours: 0.5, description: "Move obstruction" },
};

// ── Public types ──────────────────────────────────────────────────────────────

export interface CoverageBudgetItem {
  cameraId: string;
  name: string;
  cost: number;
  installation: number;
  cabling: number;
  total: number;
  laborHours: number;
}

export interface CoverageBudgetLightItem {
  lightId: string;
  name: string;
  cost: number;
  installation: number;
  total: number;
  laborHours: number;
}

export interface OptionalCostItem {
  label: string;
  cost: number;
  description: string;
}

export interface CoverageBudget {
  hardwareCost: number;
  installationCost: number;
  cablingCost: number;
  totalCost: number;
  breakdownByCamera: CoverageBudgetItem[];
  breakdownByLight: CoverageBudgetLightItem[];
  optionalCosts: OptionalCostItem[];
  estimatedHours: number;
  confidence: "estimate" | "precise";
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Resolve a CameraCostSpec for a camera by matching its properties to presets. */
function resolveCameraCost(camera: CameraNode): CameraCostSpec {
  // Score each preset by how closely the camera matches
  let best: CameraCostSpec = FALLBACK_CAMERA_COST;
  let bestScore = 0;

  for (const preset of CAMERA_PRESETS) {
    const spec = CAMERA_COST_MODEL[preset.id];
    if (!spec) continue;

    let score = 0;
    if (camera.mountType === preset.mountType) score += 4;
    if (camera.lensType === preset.lensType) score += 3;
    if (camera.nightMode === preset.nightMode) score += 2;
    if (camera.ptz === preset.ptz) score += 2;
    const fovDelta = Math.abs(camera.fovHorizontalDeg - preset.fovHorizontalDeg);
    score += Math.max(0, 3 - Math.min(3, fovDelta / 30));
    const rangeDelta = Math.abs(camera.rangeM - preset.rangeM);
    score += Math.max(0, 2 - Math.min(2, rangeDelta / 20));
    const resolutionDelta = Math.abs(camera.resolutionMP - preset.resolutionMP);
    score += Math.max(0, 2 - Math.min(2, resolutionDelta / 4));

    if (score > bestScore) {
      bestScore = score;
      best = spec;
    }
  }

  return best;
}

/** Resolve a LightCostSpec by light type. */
function resolveLightCost(light: SecurityLightNode): LightCostSpec {
  return LIGHT_COST_MODEL[light.lightType] ?? FALLBACK_LIGHT_COST;
}

/** Estimate cable length for a position (simple Euclidean from an assumed origin). */
function estimateCableLengthM(_position: [number, number, number]): number {
  // In a real deployment this would route through a building model.
  // For now we use the default constant — can be refined later.
  return DEFAULT_CABLE_LENGTH_M;
}

/**
 * Determine whether a budget is "precise" or an "estimate".
 *
 * A budget is "precise" when every camera has a known mountType and lensType
 * (i.e. the scene has been configured beyond defaults) and there is at least
 * one simulation result to validate assumptions.
 */
function determineConfidence(
  cameras: CameraNode[],
  scene: SecurityScene,
): "estimate" | "precise" {
  if (cameras.length === 0) return "estimate";

  // All cameras must have explicit (non-default) specs
  const allSpecified = cameras.every(
    (c) =>
      c.mountType !== "ceiling" || // if it's ceiling, check it's intentional
      c.fovHorizontalDeg > 0,
  );

  // At least one simulation run confirms the scene is configured
  const hasSimulation = !!scene.simulation;
  const hasSnapshots = scene.snapshots.length > 0;

  if (allSpecified && (hasSimulation || hasSnapshots)) return "precise";
  return "estimate";
}

// ── Main budget computation ───────────────────────────────────────────────────

/**
 * Compute a full CoverageBudget from a SecurityScene.
 *
 * Walks every camera and light, resolves cost models, sums hardware,
 * installation, cabling, and optional costs for movable obstructions.
 */
export function computeBudget(scene: SecurityScene): CoverageBudget {
  const cameras = scene.cameras.filter((c) => c.status === "on");
  const lights = scene.securityLights.filter((l) => l.status === "on");
  const obstructions = scene.obstructions;

  // ── Camera breakdown ────────────────────────────────────────────────────
  const breakdownByCamera: CoverageBudgetItem[] = cameras.map((camera) => {
    const spec = resolveCameraCost(camera);
    const cableM = estimateCableLengthM(camera.position);
    const cabling = cableM * CABLE_COST_PER_METER;
    const total = spec.cameraCost + spec.installationCost + spec.mountCost + cabling;

    return {
      cameraId: camera.id,
      name: camera.name,
      cost: spec.cameraCost + spec.mountCost,
      installation: spec.installationCost,
      cabling,
      total,
      laborHours: spec.laborHours,
    };
  });

  // ── Light breakdown ──────────────────────────────────────────────────────
  const breakdownByLight: CoverageBudgetLightItem[] = lights.map((light) => {
    const spec = resolveLightCost(light);
    const total = spec.lightCost + spec.installationCost + spec.mountCost + spec.cableCost;

    return {
      lightId: light.id,
      name: light.name,
      cost: spec.lightCost + spec.mountCost,
      installation: spec.installationCost + spec.cableCost,
      total,
      laborHours: spec.laborHours,
    };
  });

  // ── Optional costs (obstruction moves) ───────────────────────────────────
  const optionalCosts: OptionalCostItem[] = [];
  for (const obs of obstructions) {
    const spec = OBSTRUCTION_COST_MODEL[obs.obstructionType] ?? OBSTRUCTION_COST_MODEL.other;

    // Movable obstructions get a "move" optional line item
    if (obs.movable && spec.moveCost > 0) {
      const existing = optionalCosts.find(
        (item) => item.label === spec.description,
      );
      if (existing) {
        existing.cost += spec.moveCost;
      } else {
        optionalCosts.push({
          label: spec.description,
          cost: spec.moveCost,
          description: `Move or adjust "${obs.label}" to improve coverage`,
        });
      }
    }
  }

  // ── Totals ───────────────────────────────────────────────────────────────
  const hardwareCost =
    breakdownByCamera.reduce((sum, c) => sum + c.cost, 0) +
    breakdownByLight.reduce((sum, l) => sum + l.cost, 0);

  const installationCost =
    breakdownByCamera.reduce((sum, c) => sum + c.installation, 0) +
    breakdownByLight.reduce((sum, l) => sum + l.installation, 0);

  const cablingCost = breakdownByCamera.reduce((sum, c) => sum + c.cabling, 0);

  const estimatedHours =
    breakdownByCamera.reduce((sum, c) => sum + c.laborHours, 0) +
    breakdownByLight.reduce((sum, l) => sum + l.laborHours, 0) +
    optionalCosts.reduce((sum, o) => {
      // Estimate 0.3 hrs per optional cost item
      return sum + (o.cost > 0 ? 0.3 : 0);
    }, 0);

  const totalCost = hardwareCost + installationCost + cablingCost;

  return {
    hardwareCost,
    installationCost,
    cablingCost,
    totalCost,
    breakdownByCamera,
    breakdownByLight,
    optionalCosts,
    estimatedHours,
    confidence: determineConfidence(cameras, scene),
  };
}
