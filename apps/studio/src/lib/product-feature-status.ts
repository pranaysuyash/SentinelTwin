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
    status: "Preview",
    feature: "Guided scan reconstruction",
    detail: "Guided scan kickoff and marker-driven reconstruction flow is available; automated multi-photo reconstruction remains in-progress.",
  },
  {
    status: "Preview",
    feature: "Real footage verification",
    detail: "Reference image/video ingest with local frame extraction, overlay/split compare, alignment estimate, and difference heat overlay.",
  },
];
