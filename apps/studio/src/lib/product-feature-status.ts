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
    feature: "Workspace account bridge",
    detail: "Derived local account summary with plan posture, soft quota, and entitlements. Canonical org, billing, invite, and ownership-transfer semantics remain open.",
  },
  {
    status: "Preview",
    feature: "Guided scan reconstruction (legacy)",
    detail: "Guided scan assistant opens the existing scan wizard directly, keeps auto-path hints and manual review in the loop, and compiles through the same editable SecurityScene pipeline.",
  },
  {
    status: "Scaffolded",
    feature: "Reconstruction data model",
    detail: "ScanArtifact, ScanCaptureSession, and ScanCandidate types with photo roles, capture steps, scale anchors, candidate warnings, and evidence linkage. The session object supports guided capture sequence, per-candidate bounding boxes/masks/estimated positions, and confidence tracking.",
  },
  {
    status: "Preview",
    feature: "AI/CV adapter interfaces",
    detail: "Adapter interfaces for object detection, segmentation, depth estimation, scale anchoring, multi-photo correspondence, and structural extraction. 3 of 6 adapters have working stubs (detection, depth, scale anchoring). All force AI candidates through user review before compile.",
  },
  {
    status: "Preview",
    feature: "Reconstruction compilation pipeline + review UI",
    detail: "compileReconstructionToScene() converts accepted candidates into valid SecurityScene through SiteTwinDraft. ReconstructionCandidatePanel provides accept/reject/compile UI for candidates. runReconstruction() orchestrates full detection+depth+quality+compile flow. 112 tests covering data model, adapters, pipeline, and UI.",
  },
  {
    status: "Preview",
    feature: "Real footage verification",
    detail:
      "Camera View verification workflow with reference-frame upload, overlay or split alignment, video frame extraction, and manual comparison. Auto pose/FOV recovery and forensic-grade proof claims are still not implemented.",
  },
];
