import type { ViewMode } from "../core/layout-slice";

export type ActiveWorkflowId = "idle" | "audit" | "design" | "scan" | "floor_plan" | "ai_draft" | "verify_footage" | "report" | "reference" | "demo";

export type ProductArea =
  | "studio_home"
  | "studio_workspace"
  | "site_intake"
  | "scan_site_photos"
  | "manual_scene_builder"
  | "floor_plan_import"
  | "ai_layout_draft"
  | "site_draft_review"
  | "reports"
  | "issues"
  | "evidence";

/** Map a ProductArea to a human-readable label. */
export function formatProductArea(area: ProductArea): string {
  const labels: Record<ProductArea, string> = {
    studio_home: "Studio Home",
    studio_workspace: "Workspace",
    site_intake: "Site Intake",
    scan_site_photos: "Scan Site",
    manual_scene_builder: "Manual Builder",
    floor_plan_import: "Floor Plan Import",
    ai_layout_draft: "AI Layout Draft",
    site_draft_review: "Draft Review",
    reports: "Reports",
    issues: "Issues",
    evidence: "Evidence",
  };
  return labels[area];
}

// ── Module-level constants ──

export const WORKFLOW_STEPS: Record<ActiveWorkflowId, string[]> = {
  idle: [],
  audit: [
    "Run baseline coverage",
    "Review failures and risks",
    "Replay evidence path",
    "Apply adjustments",
    "Compare before/after",
    "Generate report",
  ],
  design: [
    "Create baseline scene",
    "Place geometry and devices",
    "Add critical zones",
    "Set assumptions",
    "Run baseline coverage",
    "Review and refine",
    "Export final scene",
  ],
  scan: [
    "Collect site photos",
    "Mark walls and entry",
    "Mark cameras, obstructions, zones",
    "Review marker quality",
    "Compile SecurityScene",
    "Run coverage simulation",
    "Export or continue",
  ],
  floor_plan: [
    "Upload floor plan",
    "Review extracted layout",
    "Place corrections",
    "Apply corrections",
    "Run coverage simulation",
    "Review and export",
  ],
  ai_draft: [
    "Draft scene from prompt",
    "Review candidate scene",
    "Compare with current scene",
    "Apply draft intentionally",
    "Run coverage simulation",
    "Continue with edits",
  ],
  verify_footage: [
    "Open footage validation",
    "Attach evidence",
    "Align frame overlays",
    "Mark confidence",
    "Save validation findings",
  ],
  report: [
    "Select scope and assumptions",
    "Review outcomes",
    "Capture recommended actions",
    "Generate final report",
    "Add assumption and limitation notes",
  ],
  reference: [
    "Load reference baseline",
    "Review scenario summary",
    "Run and compare modes",
    "Apply suggested fix sequence",
  ],
  demo: [
    "Load reference baseline",
    "Review scenario summary",
    "Run and compare modes",
    "Apply suggested fix sequence",
  ],
};

// ── Workflow Slice Interface ──

export interface WorkflowSlice {
  activeWorkflowId: ActiveWorkflowId;
  activeWorkflowStep: number;
  activeWorkflowSteps: string[];
  demoMode: boolean;
  demoStep: number;
  productArea: ProductArea;
  siteIntakeSession: any | null;

  setActiveWorkflow: (workflowId: ActiveWorkflowId, steps?: string[]) => void;
  setActiveWorkflowStep: (stepIndex: number) => void;
  clearActiveWorkflow: () => void;
  setDemoMode: (active: boolean) => void;
  setDemoStep: (step: number) => void;
  setProductArea: (area: ProductArea) => void;
  openStudioMode: (mode: ViewMode) => void;
  openSiteIntake: (selectedSource?: string) => void;
  openScanSitePhotos: (sessionId?: string) => void;
  setSiteIntakeSession: (session: any | null) => void;
}

// ── Slice creator ──

export const createWorkflowSlice = (set: any, _get: any): WorkflowSlice => ({
  activeWorkflowId: "idle",
  activeWorkflowStep: 0,
  activeWorkflowSteps: [...WORKFLOW_STEPS.idle],
  demoMode: false,
  demoStep: 0,
  productArea: "studio_home" as const,
  siteIntakeSession: null,

  setActiveWorkflow: (workflowId, steps) =>
    set({
      activeWorkflowId: workflowId,
      activeWorkflowStep: 0,
      activeWorkflowSteps: [...(steps ?? WORKFLOW_STEPS[workflowId] ?? WORKFLOW_STEPS.idle)],
    }),

  setActiveWorkflowStep: (stepIndex) =>
    set((state: any) => ({
      activeWorkflowStep: Math.max(0, Math.min(stepIndex, Math.max(0, state.activeWorkflowSteps.length - 1))),
    })),

  clearActiveWorkflow: () =>
    set({
      activeWorkflowId: "idle",
      activeWorkflowStep: 0,
      activeWorkflowSteps: [...WORKFLOW_STEPS.idle],
    }),

  setDemoMode: (active) => set({ demoMode: active }),

  setDemoStep: (step) => set({ demoStep: step }),

  setProductArea: (area) => set({ productArea: area }),

  openStudioMode: (mode) =>
    set({ productArea: "studio_workspace" as const, viewMode: mode }),

  openSiteIntake: (selectedSource) =>
    set({
      productArea: selectedSource === "scan_photos" ? ("scan_site_photos" as const) : ("site_intake" as const),
    }),

  openScanSitePhotos: (_sessionId) =>
    set({
      productArea: "scan_site_photos" as const,
    }),

  setSiteIntakeSession: (session) => set({ siteIntakeSession: session }),
});
