export type ProductFeatureStatus = "Available" | "Preview" | "Planned";

export interface ProductFeatureEntry {
  status: ProductFeatureStatus;
  feature: string;
  detail: string;
}

export const PRODUCT_FEATURE_STATUS_LAST_VERIFIED = "2026-05-29";

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
    detail: "Manual photo marking compiles walls, doors, cameras, obstructions, lights, zones, and optional path into an editable SecurityScene. AI segmentation/depth is not implemented yet.",
  },
  {
    status: "Preview",
    feature: "AI layout draft",
    detail: "Prompt-to-scene starter with model-backed output when configured.",
  },
  {
    status: "Preview",
    feature: "Governance control plane",
    detail: "Role-aware publish, review, approval, rejection, and annotation controls with evidence-logged audit trails.",
  },
  {
    status: "Planned",
    feature: "Guided scan reconstruction",
    detail: "Future: guided phone capture, segmentation, depth, and multi-photo reconstruction that can plug into the same editable SecurityScene pipeline.",
  },
  {
    status: "Preview",
    feature: "Real footage verification",
    detail: "Reference image/video ingest with multi-frame candidate extraction, auto best-frame scoring, saved snapshot evidence lineage, deterministic auto-align assist, reference scale calibration, alignment provenance tags, overlay/split compare, alignment estimate, and difference heat overlay.",
  },
];
