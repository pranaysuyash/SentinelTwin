export type ProductFeatureStatus = "Available" | "Preview" | "Planned";

export interface ProductFeatureEntry {
  status: ProductFeatureStatus;
  feature: string;
  detail: string;
}

export const PRODUCT_FEATURE_STATUS_LAST_VERIFIED = "2026-05-28";

export const PRODUCT_FEATURE_STATUS: ProductFeatureEntry[] = [
  {
    status: "Available",
    feature: "Launcher entry flows",
    detail: "Create/import, resume current workspace, organize projects, scan a site, and draft a scene from the front door.",
  },
  {
    status: "Available",
    feature: "Camera Studio core loop",
    detail: "Edit scene, run simulation, inspect risk, apply/revert fixes, compare/report.",
  },
  {
    status: "Available",
    feature: "Floor-plan import (prototype)",
    detail: "Heuristic parse with calibration and detection correction before scene creation.",
  },
  {
    status: "Preview",
    feature: "Scan Site (manual-assisted)",
    detail: "Photo marker workflow compiles walls, doors, cameras, obstructions, lights, zones, and optional path into canonical SecurityScene.",
  },
  {
    status: "Preview",
    feature: "AI layout draft",
    detail: "Prompt-to-scene starter with model-backed output when configured.",
  },
  {
    status: "Planned",
    feature: "Guided scan reconstruction",
    detail: "Capture-driven reconstruction pipeline is not production-implemented yet.",
  },
  {
    status: "Planned",
    feature: "Real footage verification",
    detail: "Expected-vs-actual camera validation pipeline is not implemented.",
  },
];
