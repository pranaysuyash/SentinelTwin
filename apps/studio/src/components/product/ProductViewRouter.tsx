"use client";

import { useEffect, useRef, type ChangeEvent } from "react";

import { useProductViewStore, type ProductView } from "@/store/product-view-store";
import { useStudioStore } from "@/store/studio-store";
import StudioShell from "@/components/layout/StudioShell";
import { StudioDashboardHome } from "@/components/launcher/StudioDashboardHome";
import { SiteIntakeHub } from "@/components/site-intake/SiteIntakeHub";
import { ScanSiteWizard } from "@/components/scan-to-scene/ScanSiteWizard";
import { SceneBuilderWizard } from "@/components/scan-to-scene/SceneBuilderWizard";
import { SiteDraftReview } from "@/components/site-intake/SiteDraftReview";
import { AiLayoutDraftView } from "./AiLayoutDraftView";
import { ReferenceSitesView } from "./ReferenceSitesView";
import { SettingsView } from "./SettingsView";
import { MobileEditGate } from "@/components/shared/MobileEditGate";
import { MOBILE_EDIT_MEDIA_QUERY } from "@/lib/viewport-tiers";
import { useProductLifecycle } from "@/lib/use-product-lifecycle";
import { isStageReachable, stageLabel } from "@/lib/product-lifecycle";
import type { ProductLifecycleStage } from "@/lib/product-lifecycle";
import type { SiteIntakeSource, SiteIntakeSession } from "@/lib/site-compiler";
import type { SecurityScene } from "@/schema/security-scene";

/**
 * ProductViews that create or edit a scene. Below MOBILE_EDIT_BREAKPOINT_PX
 * these render MobileEditGate instead of the real flow. `studio` is excluded
 * here because most of its ViewModes (wall/replay/compare/report/analytics)
 * are viewing surfaces — the "map" ViewMode is gated separately inside
 * WorkspaceArea.
 */
const CREATION_PRODUCT_VIEWS = new Set<ProductView>([
  "site_intake",
  "scan_site",
  "manual_builder",
  "floor_plan_import",
  "ai_layout_draft",
  "site_draft_review",
]);

/**
 * Maps ProductView to the minimum lifecycle stage required to access it.
 * Views not in this map have no lifecycle gate (e.g. settings, reference_sites).
 * This enforces the canonical lifecycle: intake → draft → approved → simulated → reported.
 *
 * @see ~/lib/product-lifecycle.ts
 */
const LIFECYCLE_GATE: Partial<Record<ProductView, ProductLifecycleStage>> = {
  // Studio views require at least a draft (scene has content).
  studio: "draft",
  camera_operations: "draft",
  incident_review: "simulated",
  counterfactual_compare: "simulated",
  // Audit report requires at least simulated (report needs simulation data).
  audit_report: "simulated",
  // Floor plan import requires at least intake (you need a scene to import into).
  floor_plan_import: "intake",
};

/**
 * All the orchestration handlers that page.tsx provides.
 * These are functions that coordinate across store actions,
 * compile flows, approval flows, and view transitions.
 */
export type ProductViewHandlers = {
  // Workspace / Studio navigation
  openStudio: () => void;
  openCoverageWorkspace: () => void;
  openCameraWall: () => void;
  openPathReplay: () => void;
  openCompareFixes: () => void;
  openIssues: () => void;
  openReport: () => void;
  runSimulation: () => void;
  openScene: (scene?: SecurityScene) => void;
  openReferenceWorkspace: () => void;

  // Creation flows
  startDesignFlow: () => void;
  openFloorPlanFlow: () => void;
  openScanWizard: () => void;
  openGuidedScanAssistant: () => void;
  handleImportScene: () => void;

  // Compile / approval — all creation/import flows create a draft session
  // and route through SiteDraftReview. Only approveIntakeSession activates the scene.
  createDraftFromScene: (scene: SecurityScene, source: SiteIntakeSource, sourceArtifacts?: string[]) => void;
  approveIntakeSession: () => void;
  rejectIntakeSession: () => void;
  approveAndRunBaseline: () => void;

  // JSON import state
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  importError: string | null;
  handleFileChange: (event: ChangeEvent<HTMLInputElement>) => void;
};

type ProductViewRouterProps = {
  handlers: ProductViewHandlers;
};

function StudioModeRedirect({
  viewMode,
  preset,
  bottomTab,
}: {
  viewMode: import("@/store/studio-store").ViewMode;
  preset: import("@/store/studio-store").WorkspacePreset;
  bottomTab?: import("@/store/studio-store").BottomTab;
}) {
  const navigate = useProductViewStore((s) => s.navigate);

  useEffect(() => {
    const { setViewMode, setWorkspacePreset, setBottomTab } = useStudioStore.getState();
    setWorkspacePreset(preset);
    setViewMode(viewMode);
    if (bottomTab) setBottomTab(bottomTab);
    navigate("studio");
  }, [bottomTab, navigate, preset, viewMode]);

  return null;
}

/**
 * Maps ProductView to the correct full-page product surface.
 * Each view is rendered as a real page-level component, not a modal overlay.
 */
export function ProductViewRouter({ handlers }: ProductViewRouterProps) {
  const productView = useProductViewStore((s) => s.view);
  const subContext = useProductViewStore((s) => s.subContext);
  const navigate = useProductViewStore((s) => s.navigate);

  const scene = useStudioStore((s) => s.scene);
  const simulationResult = useStudioStore((s) => s.simulationResult);
  const simulationDirty = useStudioStore((s) => s.simulationDirty);
  const simulationRunning = useStudioStore((s) => s.simulationRunning);
  const savedScenes = useStudioStore((s) => s.savedScenes);
  const savedProjects = useStudioStore((s) => s.savedProjects);
  const refreshSavedScenesList = useStudioStore((s) => s.refreshSavedScenesList);

  // Boot-time: ensure saved projects are loaded from localStorage.
  // TopBar also calls this, but TopBar isn't rendered on product_home or other non-studio views.
  useEffect(() => { refreshSavedScenesList(); }, [refreshSavedScenesList]);
  const updateSavedSceneMetadata = useStudioStore((s) => s.updateSavedSceneMetadata);
  const duplicateSavedScene = useStudioStore((s) => s.duplicateSavedScene);
  const renameSavedScene = useStudioStore((s) => s.renameSavedScene);
  const siteIntakeSession = useStudioStore((s) => s.siteIntakeSession);
  const activeRole = useStudioStore((s) => s.workspaceGovernance.activeRole);
  const currentResult = simulationResult ?? scene.simulation ?? null;

  const compactViewport = useStudioStore((s) => s.compactViewport);
  const setCompactViewport = useStudioStore((s) => s.setCompactViewport);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const media = window.matchMedia(MOBILE_EDIT_MEDIA_QUERY);
    const syncCompactViewport = () => setCompactViewport(media.matches);
    syncCompactViewport();
    media.addEventListener("change", syncCompactViewport);
    return () => media.removeEventListener("change", syncCompactViewport);
  }, [setCompactViewport]);

  // Product lifecycle — derived state for ordering enforcement.
  // Prevents jumping to later stages without passing through earlier ones.
  const lifecycle = useProductLifecycle();

  // First-time user routing: if the user has no workspace and no cameras in the
  // active scene, send them to the Site Intake Hub (the canonical first
  // full-product entry screen per the design pack) instead of an empty dashboard.
  // Fires once on first mount; respects explicit navigation back to product_home.
  // Uses a ref (not state) so we don't trigger an extra render after the redirect.
  const hasRedirectedToIntakeRef = useRef(false);
  useEffect(() => {
    if (hasRedirectedToIntakeRef.current) return;
    if (productView !== "product_home") return;
    if (savedProjects.length === 0 && scene.cameras.length === 0) {
      navigate("site_intake");
      hasRedirectedToIntakeRef.current = true;
    }
  }, [productView, savedProjects, scene.cameras.length, navigate]);

  // Tracks whether SceneBuilderWizard's onBuild already fired for the
  // manual-builder branch below. Declared unconditionally (Rules of Hooks —
  // this component never unmounts between ProductView switches, so a hook
  // declared inside an `if (productView === ...)` branch changes the hook
  // count whenever the view changes and crashes React). Reset on every
  // (re-)entry into manual_builder so a second visit in the same session
  // gets a fresh flag instead of one stuck `true` from a prior build.
  const buildCompletedRef = useRef(false);
  useEffect(() => {
    if (productView === "manual_builder") buildCompletedRef.current = false;
  }, [productView]);

  const formatClock = (ts: number | null | undefined) => {
    if (!ts) return null;
    return new Intl.DateTimeFormat("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
      timeZone: "UTC",
    }).format(new Date(ts));
  };

  const currentRunLabel = (() => {
    const label = formatClock(currentResult?.computedAt);
    return label ? `Last run ${label}` : null;
  })();

  // Lifecycle gate — enforce canonical lifecycle ordering.
  // If the current view requires a lifecycle stage that hasn't been reached
  // yet, redirect to the appropriate earlier stage.
  const requiredStage = LIFECYCLE_GATE[productView];
  if (requiredStage && !isStageReachable(lifecycle.stage, requiredStage)) {
    // Determine the best redirect target based on current lifecycle stage.
    const redirectView: ProductView = lifecycle.stage === "intake"
      ? "site_intake"
      : "product_home";
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-4" style={{ background: "var(--bg)" }}>
        <div className="text-center">
          <div className="text-sm font-medium text-white">Lifecycle Stage: {lifecycle.label}</div>
          <div className="mt-1 text-xs text-[color:var(--text-muted)]">{lifecycle.reason}</div>
          <div className="mt-1 text-xs text-[color:var(--text-muted)]">
            This view requires at least a <span className="font-medium text-white">{stageLabel(requiredStage)}</span> stage.
          </div>
        </div>
        <button
          type="button"
          onClick={() => navigate(redirectView)}
          className="rounded-lg border border-white/10 px-4 py-2 text-sm text-[color:var(--text-muted)] hover:text-white"
        >
          {lifecycle.stage === "intake" ? "Start Site Intake" : "Return to Product Home"}
        </button>
      </div>
    );
  }

  // Mobile edit gate — creation/import/review flows require a tablet-or-larger
  // screen. Viewing-only surfaces (product_home, studio's viewing ViewModes,
  // reference_sites, settings) are unaffected.
  if (compactViewport && CREATION_PRODUCT_VIEWS.has(productView)) {
    return (
      <MobileEditGate
        actionLabel="Return to home"
        onAction={() => navigate("product_home")}
      />
    );
  }

  // Product Home — render the StudioDashboardHome as the product home
  if (productView === "product_home") {
    return (
      <div className="flex h-full w-full flex-col overflow-y-auto" style={{ background: "var(--bg)" }}>
        <div className="mx-auto flex w-full max-w-[1520px] flex-1 flex-col px-4 py-4 sm:px-6">
          <StudioDashboardHome
            scene={scene}
            result={currentResult}
            simulationDirty={simulationDirty}
            simulationRunning={simulationRunning}
            savedScenes={savedScenes}
            savedProjects={savedProjects}
            currentRunLabel={currentRunLabel}
            onOpenStudio={handlers.openStudio}
            onOpenCoverageWorkspace={handlers.openCoverageWorkspace}
            onOpenCameraWall={handlers.openCameraWall}
            onOpenPathReplay={handlers.openPathReplay}
            onOpenCompareFixes={handlers.openCompareFixes}
            onOpenIssues={handlers.openIssues}
            onRunSimulation={handlers.runSimulation}
            onStartProject={() => handlers.openCoverageWorkspace()}
            onOpenAdvancedWorkflows={() => navigate("site_intake")}
            onCreateScene={handlers.startDesignFlow}
            onImportFloorPlan={handlers.openFloorPlanFlow}
            onImportScene={handlers.handleImportScene}
            onScanSite={() => {
              if (!simulationDirty || window.confirm("Current workspace has unapplied changes. Continue to start scan intake?")) {
                handlers.openScanWizard();
              }
            }}
            onGuidedScanAssistant={() => {
              if (!simulationDirty || window.confirm("Current workspace has unapplied changes. Continue to open the guided scan assistant?")) {
                handlers.openGuidedScanAssistant();
              }
            }}
            onAiDraft={() => navigate("ai_layout_draft")}
            onOpenDemoScene={handlers.openReferenceWorkspace}
            onOpenReport={handlers.openReport}
            onOpenSiteIntake={() => navigate("site_intake")}
            onOpenReferenceSites={() => navigate("reference_sites")}
            onOpenSettings={() => navigate("settings")}
            onOpenScene={handlers.openScene}
            onUpdateProjectMetadata={updateSavedSceneMetadata}
            onDuplicateProject={duplicateSavedScene}
            onRenameProject={renameSavedScene}
            onOpenMode={(viewMode, preset, bottomTab) => {
              const { setViewMode, setWorkspacePreset, setBottomTab } = useStudioStore.getState();
              setWorkspacePreset(preset);
              setViewMode(viewMode);
              if (bottomTab) setBottomTab(bottomTab);
              navigate("studio");
            }}
          />
        </div>
      </div>
    );
  }

  // Site Intake — full product view
  if (productView === "site_intake") {
    return (
      <SiteIntakeHub
        onStartScan={() => {
          handlers.openScanWizard();
        }}
        onEnterStudio={() => handlers.openStudio()}
        onOpenRecentSite={(siteId) => {
          const project = savedProjects.find((entry) => entry.scene.id === siteId);
          if (project) {
            handlers.openScene(project.scene);
            return;
          }
          handlers.openStudio();
        }}
        onOpenDemo={() => {
          handlers.openReferenceWorkspace();
        }}
        onStartAiDraft={() => navigate("ai_layout_draft")}
        onImportFloorPlan={() => {
          handlers.openFloorPlanFlow();
        }}
        onImportJson={() => {
          handlers.handleImportScene();
        }}
        onBuildManually={() => {
          handlers.startDesignFlow();
        }}
        onVerifyFootage={() => {
          const { setActiveWorkflow, setActiveWorkflowStep, setViewMode, setWorkspacePreset, setCameraViewVerificationIntent, setSelectedCameraId, setBottomTab, scene } = useStudioStore.getState();
          if (scene.cameras.length === 0) {
            const { setLaunchNotice } = useStudioStore.getState();
            setLaunchNotice("Add a camera before opening the real footage verification workflow.");
            handlers.openCoverageWorkspace();
            return;
          }
          setActiveWorkflow("verify_footage");
          setActiveWorkflowStep(0);
          const targetCameraId = scene.cameras.find((c) => c.id === useStudioStore.getState().selectedCameraId)?.id ?? scene.cameras[0]?.id ?? null;
          if (targetCameraId) setSelectedCameraId(targetCameraId);
          setCameraViewVerificationIntent({ source: "other", openPanel: true });
          navigate("studio");
        }}
        onStartSecurityAudit={() => {
          const { setActiveWorkflow, setActiveWorkflowStep, scene } = useStudioStore.getState();
          setActiveWorkflow("audit");
          setActiveWorkflowStep(0);
          const { setLaunchNotice } = useStudioStore.getState();
          const coverageState = scene.simulation?.totalCoveragePct;
          setLaunchNotice(
            coverageState == null || simulationDirty
              ? "Opened current workspace for audit. Run simulation to refresh the latest security coverage before review."
              : `Opened ${scene.name} for audit (${Math.round(coverageState)}% coverage).`,
          );
          handlers.openCoverageWorkspace();
        }}
        recentSites={savedProjects.slice(0, 6).map((project) => ({
          id: project.scene.id,
          name: project.scene.name,
          updatedLabel: `Updated ${formatClock(project.updatedAt) ?? "recently"}`,
          riskLabel: !project.scene.simulation || project.scene.simulation.totalCoveragePct == null ? "Baseline Required" as const : project.scene.simulation.totalCoveragePct >= 70 ? "Low Risk" as const : project.scene.simulation.totalCoveragePct >= 40 ? "Medium Risk" as const : "High Risk" as const,
        }))}
      />
    );
  }

  // Scan Site — full product view
  if (productView === "scan_site") {
    return (
      <div className="h-full w-full overflow-hidden" style={{ background: "var(--bg)" }}>
        <ScanSiteWizard
          mode={subContext === "guided" ? "guided" : "manual"}
          onCompile={(scene) => {
            handlers.createDraftFromScene(scene, "scan");
            navigate("site_draft_review");
          }}
          onClose={() => {
            navigate("site_intake");
          }}
        />
      </div>
    );
  }

  // Manual Builder — full product view
  if (productView === "manual_builder") {
    return (
      <div className="h-full w-full overflow-hidden" style={{ background: "var(--bg)" }}>
        <SceneBuilderWizard
          onBuild={(scene) => {
            buildCompletedRef.current = true;
            handlers.openScene(scene);
          }}
          onClose={() => {
            // The wizard calls onClose immediately after onBuild — skip navigation
            // in that case since openScene already navigated to studio.
            if (!buildCompletedRef.current) navigate("site_intake");
          }}
        />
      </div>
    );
  }

  // Floor Plan Import — full product view
  if (productView === "floor_plan_import") {
    return (
      <div className="h-full w-full overflow-hidden" style={{ background: "var(--bg)" }}>
        <SceneBuilderWizard
          forceImportMethod="floor_plan"
          onBuild={(scene) => {
            handlers.createDraftFromScene(scene, "floor_plan");
            navigate("site_draft_review");
          }}
          onClose={() => {
            navigate("site_intake");
          }}
        />
      </div>
    );
  }

  // AI Layout Draft — full product view
  if (productView === "ai_layout_draft") {
    return (
      <AiLayoutDraftView
        onApplyDraft={(nextScene, source) => {
          handlers.createDraftFromScene(nextScene, source, [`AI draft: ${nextScene.name}`]);
        }}
      />
    );
  }

  // Site Draft Review — blocking review before activation
  if (productView === "site_draft_review" && siteIntakeSession) {
    return (
      <SiteDraftReview
        session={siteIntakeSession}
        onApprove={handlers.approveIntakeSession}
        onReject={() => {
          handlers.rejectIntakeSession();
          navigate("product_home");
        }}
        onEdit={() => {
          handlers.rejectIntakeSession();
          navigate("product_home");
        }}
        onRunBaselineSimulation={handlers.approveAndRunBaseline}
        activeRole={activeRole}
      />
    );
  }

  // Fallback: site_draft_review without a session
  if (productView === "site_draft_review" && !siteIntakeSession) {
    return (
      <div className="flex h-full w-full items-center justify-center" style={{ background: "var(--bg)" }}>
        <div className="text-center">
          <div className="text-sm text-[color:var(--text-muted)]">No draft session to review.</div>
          <button
            type="button"
            onClick={() => navigate("product_home")}
            className="mt-2 rounded-lg border border-white/10 px-3 py-1.5 text-xs text-[color:var(--text-muted)] hover:text-white"
          >
            Return to Product Home
          </button>
        </div>
      </div>
    );
  }

  // Studio — Security Twin Studio workspace
  if (productView === "studio") {
    return <StudioShell />;
  }

  // Camera Operations — canonical product surface routed into Studio camera modes.
  if (productView === "camera_operations") {
    if (subContext === "wall") {
      return <StudioModeRedirect viewMode="wall" preset="camera_wall" bottomTab="metrics" />;
    }
    return <StudioModeRedirect viewMode="camera_view" preset="coverage" bottomTab="metrics" />;
  }

  // Incident Review — canonical product surface routed into replay.
  if (productView === "incident_review") {
    return <StudioModeRedirect viewMode="replay" preset="replay" bottomTab="timeline" />;
  }

  // Counterfactual Compare — canonical product surface routed into compare.
  if (productView === "counterfactual_compare") {
    return <StudioModeRedirect viewMode="compare" preset="compare" bottomTab="beforeafter" />;
  }

  // Audit Report — canonical product surface routed into report mode.
  if (productView === "audit_report") {
    return <StudioModeRedirect viewMode="report" preset="report" bottomTab="report" />;
  }

  // Reference Sites — browse and load seeded reference scenes.
  if (productView === "reference_sites") {
    return <ReferenceSitesView />;
  }

  // Settings — product preferences surface.
  if (productView === "settings") {
    return <SettingsView />;
  }

  // Fallback — return to product home
  return (
    <div className="flex h-full w-full items-center justify-center" style={{ background: "var(--bg)" }}>
      <button
        type="button"
        onClick={() => navigate("product_home")}
        className="rounded-lg border border-white/10 px-4 py-2 text-sm text-[color:var(--text-muted)] hover:text-white"
      >
        Return to Product Home
      </button>
    </div>
  );
}
