export type ProductFeatureStatus = "Available" | "Preview" | "Planned";

export interface ProductFeatureEntry {
  status: ProductFeatureStatus;
  feature: string;
  detail: string;
}

export const PRODUCT_FEATURE_STATUS_LAST_VERIFIED = "2026-05-30";

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
    status: "Preview",
    feature: "Workspace catalog / org boundary",
    detail: "Local workspace catalog summary with organization, owner, visibility, and surface mix. Canonical org, billing, invite, and ownership-transfer semantics remain open.",
  },
  {
    status: "Preview",
    feature: "Guided scan reconstruction",
    detail: "Guided scan assistant opens the existing scan wizard directly, keeps auto-path hints and manual review in the loop, and compiles through the same editable SecurityScene pipeline. Full phone capture, segmentation, and depth reconstruction remain future work.",
  },
  {
    status: "Preview",
    feature: "Real footage verification",
    detail:
      "Camera View verification workflow with reference-frame upload, overlay or split alignment, video frame extraction, and manual comparison. Auto pose/FOV recovery and forensic-grade proof claims are still not implemented.",
  },
];
