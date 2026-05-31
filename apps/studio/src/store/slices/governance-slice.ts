import type { StateCreator } from "zustand";
import {
  type BranchAction,
  type BranchRecord,
  createBranchRecord,
  transitionBranch,
} from "@/lib/branch-lifecycle";
import {
  canPerformWorkspaceAction,
  createDefaultWorkspaceAccessState,
  getActiveWorkspaceMember,
  normalizeWorkspaceAccessState,
  routeWorkspaceApproval,
  type WorkspaceAccessState,
} from "@/lib/workspace-access";
import { summarizeWorkspaceMembershipDrift } from "@/lib/workspace-membership-routing";
import {
  normalizeWorkspaceAccountProfile,
  createDefaultWorkspaceAccountProfile,
  type WorkspaceAccountProfile,
} from "@/lib/workspace-catalog";
import {
  createDefaultWorkspaceGovernance,
  normalizeWorkspaceGovernance,
  type WorkspaceApprovalMode,
  type WorkspaceGovernanceState,
  type WorkspaceRole,
  type WorkspaceSceneStatus,
} from "@/lib/workspace-governance";

function resetWorkspaceGovernanceForDraft(governance: WorkspaceGovernanceState): WorkspaceGovernanceState {
  return {
    ...governance,
    sceneStatus: "draft" as WorkspaceSceneStatus,
    requestedAt: null,
    requestedBy: null,
    reviewedAt: null,
    reviewedBy: null,
    publishedAt: null,
    publishedBy: null,
  };
}
import { getOrganizationManager } from "@/lib/organization-store";
import { guardVisibilityChange, guardWorkspaceCountQuota } from "@/lib/entitlement-guards";
import type { OrganizationList, Organization } from "@/schema/organization";
import {
  buildOperationalEvidenceEvent,
  compareOperationalEvidenceBranches,
  assessOperationalEvidenceMergeReadiness,
  confidenceLabel,
  findLatestOperationalEvidenceEventForScene,
  mergeOperationalEvidenceBranchScenes,
  normalizeOperationalEvidenceEvents,
  reconstructSceneFromEvidence,
  resolveOperationalEvidenceRestoreScene,
  summarizeSceneEvidence,
  summarizeSimulationEvidence,
  type OperationalEvidenceEvent,
  type OperationalEvidenceEventInput,
} from "@/lib/operational-evidence";
import {
  type ReportCatalogState,
  type ReportCatalogPreset,
  loadReportCatalogState,
  persistReportCatalogState,
  createReportCatalogPreset,
  upsertReportCatalogPreset,
  removeReportCatalogPreset,
} from "@/lib/report-catalog";
import { buildSceneIntelligenceGraph, type SceneIntelligenceGraph } from "@/lib/scene-intelligence-graph";
import {
  createDefaultEnabledAnalysisModules,
  createDefaultVisibleComponents,
  getPresetLayoutSnapshot,
  isWorkspaceLayoutModified,
  PRESET_VIEW_MODES,
  PRESET_CANVAS_MODES,
  PRESET_RIGHT_PANEL_MODES,
  PRESET_BOTTOM_DRAWER_MODES,
  PRESET_PINNED_MODULES,
  PRESET_LAYOUT_SIZES,
  type WorkspaceLayoutSnapshot,
} from "@/lib/workspace-layouts";
import {
  cloneSecurityScene,
  safeParseSecurityScene,
  type SecurityScene,
  type AnyEditableNode,
  type CameraNode,
  type SceneSnapshot,
  type SimulationResult,
} from "@/schema/security-scene";
import {
  buildOperationalEvidenceArchive,
  createArchiveRestoreEvent,
  normalizeOperationalEvidenceArchive,
} from "@/lib/operational-evidence-archive";
import {
  createOperationalEvidenceArchiveHistoryRecord,
  normalizeOperationalEvidenceArchiveHistory,
  serializeOperationalEvidenceArchiveHistory,
} from "@/lib/operational-evidence-archive-history";
import { computeTemporalProfile } from "@sentineltwin/simulation";
import { createBlankSecurityScene } from "@/lib/scene-skeleton";
import { validateSceneGeometry } from "@/lib/scene-validation";
import type { ArchiveHandoffRequest } from "@/lib/archive-handoff-link";
import {
  loadModelEvalHistoryFromRaw,
  serializeModelEvalHistory,
  summarizeModelEvalRun,
  type ModelEvalRunRecord,
  type ModelEvalSuiteResult,
} from "@/agents/model-eval";
import { buildPromptRegistrySnapshot, type PromptRegistrySnapshot } from "@/agents/prompt-registry";
import { simulateStudio } from "@sentineltwin/simulation";
import type { ArchiveRestoreEventContext } from "@/lib/operational-evidence-archive";

const PROJECT_STORAGE_KEY = "sentineltwin_saved_projects_v2";
const LEGACY_SCENE_STORAGE_KEY = "sentineltwin_saved_scenes";
const LAYOUT_STORAGE_KEY = "sentineltwin_workspace_layouts";
const LEGACY_LAYOUT_STORAGE_KEY = "sentineltwin_saved_layouts_v1";
const WORKSPACE_GOVERNANCE_STORAGE_KEY = "sentineltwin_workspace_governance_v1";
const WORKSPACE_ACCESS_STORAGE_KEY = "sentineltwin_workspace_access_v1";
const WORKSPACE_ACCOUNT_STORAGE_KEY = "sentineltwin_workspace_account_v1";
const FIX_SANDBOX_STORAGE_KEY = "sentineltwin_fix_sandbox_v1";
const OPERATIONAL_EVIDENCE_STORAGE_KEY = "sentineltwin_operational_evidence_v1";

function buildPresetDockLayout(preset: any) {
  const layout = getPresetLayoutSnapshot(preset, DEFAULT_LAYERS);
  return { ...layout };
}

function persistWorkspaceGovernance(governance: WorkspaceGovernanceState) {
  try { localStorage.setItem(WORKSPACE_GOVERNANCE_STORAGE_KEY, JSON.stringify(governance)); } catch {}
}
function persistWorkspaceAccess(access: WorkspaceAccessState) {
  try { localStorage.setItem(WORKSPACE_ACCESS_STORAGE_KEY, JSON.stringify(access)); } catch {}
}
function persistWorkspaceAccount(account: WorkspaceAccountProfile) {
  try { localStorage.setItem(WORKSPACE_ACCOUNT_STORAGE_KEY, JSON.stringify(account)); } catch {}
}
function persistSavedProjects(projects: any[]) {
  try { localStorage.setItem(PROJECT_STORAGE_KEY, JSON.stringify(projects)); } catch {}
}
function persistSavedLayouts(layouts: any[]) {
  try { localStorage.setItem(LAYOUT_STORAGE_KEY, JSON.stringify(layouts)); } catch {}
}
function persistOperationalEvidenceEvents(events: OperationalEvidenceEvent[]) {
  try { localStorage.setItem(OPERATIONAL_EVIDENCE_STORAGE_KEY, JSON.stringify(events)); } catch {}
}

function clonePlain(obj: any): any {
  return JSON.parse(JSON.stringify(obj));
}

function appendChangeLog(scene: any, entry: string): any {
  const next = clonePlain(scene);
  next.changeLog = [...(next.changeLog ?? []), entry];
  return next;
}

function evidenceLogLine(event: any): string {
  return `[${new Date(event.timestamp).toISOString()}] ${event.kind}: ${event.title}`;
}

function cloneDefaultMapState(): any {
  return { minimap: { zoom: 1, pan: [0, 0] }, pathMap: { zoom: 1, pan: [0, 0] } };
}

function buildGraphState(scene: any, simulationResult: any, revisionDepth: number, snapshotCount: number, events?: any): any {
  return buildSceneIntelligenceGraph(scene, {
    simulationResult,
    revisionDepth,
    snapshotCount,
    operationalEvidenceEvents: events,
  });
}

function createDraftBranchRecord(id: string, label: string, authorId: string): BranchRecord {
  const now = Date.now();
  return { id, label, state: "draft", createdAt: now, updatedAt: now, authorId };
}

const DEFAULT_LAYERS = {
  cameras: true, camera_cones: true, obstructions: true, lights: true,
  critical_zones: true, privacy_zones: true, paths: true, heatmap: true,
  grid: true, walls_floors: true, labels: true,
};

function buildLayoutStatePatch(layout: any): any {
  return {
    viewMode: layout.viewMode,
    workspacePreset: layout.workspacePreset,
    canvasMode: layout.canvasMode,
    leftDockCollapsed: layout.leftDockCollapsed,
    rightDockCollapsed: layout.rightDockCollapsed,
    bottomDockCollapsed: layout.bottomDockCollapsed,
    leftDockSizePx: layout.leftDockSizePx,
    rightDockSizePx: layout.rightDockSizePx,
    bottomDockSizePx: layout.bottomDockSizePx,
    visibleComponents: { ...layout.visibleComponents },
    enabledAnalysisModules: { ...layout.enabledAnalysisModules },
    rightPanelMode: layout.rightPanelMode,
    bottomDrawerMode: layout.bottomDrawerMode,
    pinnedAnalysisModule: layout.pinnedAnalysisModule,
    overlayDensity: layout.overlayDensity,
    showDebugOverlays: layout.showDebugOverlays,
    clientDemoOptions: { ...layout.clientDemoOptions },
    layerVisibility: { ...layout.layerVisibility },
  };
}

function cloneSceneWithChangeLog(scene: SecurityScene, changeLog: string[]) {
  const next = cloneSecurityScene(scene);
  next.changeLog = changeLog;
  return next;
}

function cloneSceneWithAppendedChangeLog(scene: SecurityScene, entry: string) {
  return cloneSceneWithChangeLog(scene, [...scene.changeLog, entry]);
}

export interface GovernanceSlice {
  activeBranch: string;
  branchScenes: Record<string, SecurityScene>;
  branchLifecycleState: Record<string, BranchRecord>;
  workspaceGovernance: WorkspaceGovernanceState;
  workspaceAccess: WorkspaceAccessState;
  workspaceAccount: WorkspaceAccountProfile;
  organizations: OrganizationList;
  activeOrganizationId: string | null;
  reportCatalog: ReportCatalogState;

  savedScenes: SecurityScene[];
  savedProjects: any[];

  compareVisualEvidence: any;
  compareReportSelection: any;
  compareOrbitSync: boolean;
  compareOrbitCameraState: { position: [number, number, number] | null; target: [number, number, number] | null; };

  cameraViewVerificationIntent: any;
  cameraVerificationSnapshots: Record<string, any[]>;

  launchNotice: string | null;
  timelineFocusRequest: any;
  archiveHandoffRequest: ArchiveHandoffRequest | null;

  fixSandboxActive: boolean;
  fixSandboxBaselineScene: SecurityScene | null;
  fixSandboxDraftScene: SecurityScene | null;
  fixSandboxDiff: { camerasChanged: number; zonesAffected: number; needsRecompute: boolean; };

  savedLayouts: any[];

  createDraftBranch: (branchName: string) => void;
  switchBranch: (branchName: string) => void;
  submitForReview: (branchName: string, note?: string) => void;
  approveBranch: (branchName: string, note?: string) => void;
  rejectBranch: (branchName: string, note?: string) => void;
  updateBranchLifecycle: (branchId: string, action: BranchAction, actorId?: string) => void;

  setWorkspaceRole: (role: WorkspaceRole) => void;
  setWorkspaceApprovalMode: (mode: WorkspaceApprovalMode) => void;
  setWorkspaceActiveMember: (memberId: string) => boolean;
  setWorkspaceAccessMode: (mode: WorkspaceAccessState["policy"]["mode"]) => boolean;
  syncWorkspaceMembershipSnapshot: (snapshot: { workspaceAccessState: WorkspaceAccessState; workspaceGovernanceState: WorkspaceGovernanceState }) => boolean;
  setWorkspaceAccountProfile: (patch: Partial<WorkspaceAccountProfile>) => void;
  resetWorkspaceAccountProfile: () => void;

  setActiveOrganization: (id: string | null) => void;
  addOrganization: (name: string, plan?: Organization["plan"]) => OrganizationList[number] | null;
  updateOrganization: (id: string, patch: Partial<Pick<OrganizationList[number], "name" | "plan">>) => boolean;
  removeOrganization: (id: string) => boolean;
  refreshOrganizations: () => void;

  addReportCatalogPreset: (input: any) => void;
  updateReportCatalogPreset: (preset: ReportCatalogPreset) => void;
  removeReportCatalogPreset: (presetId: string) => void;
  setReportCatalogSelectedPresetId: (presetId: string | null) => void;

  requestSceneReview: (note?: string) => boolean;
  approveSceneReview: (note?: string) => boolean;
  rejectSceneReview: (note?: string) => boolean;
  addSceneAnnotation: (note: string) => boolean;

  setScene: (scene: SecurityScene) => void;
  createNewScene: () => void;
  saveSceneToStorage: () => void;
  loadScenesFromStorage: () => SecurityScene[];
  refreshSavedScenesList: () => void;
  deleteSavedScene: (sceneId: string) => void;
  updateSavedSceneMetadata: (sceneId: string, patch: any) => void;
  duplicateSavedScene: (sceneId: string) => any;
  renameSavedScene: (sceneId: string, nextName: string) => any;
  getSceneStorageKey: () => string;

  setCompareVisualEvidence: (evidence: any) => void;
  setCompareReportSelection: (selection: any) => void;
  setCompareOrbitSync: (sync: boolean) => void;
  setCompareOrbitCameraState: (state: any) => void;

  setCameraViewVerificationIntent: (intent: any) => void;
  upsertCameraVerificationSnapshot: (cameraId: string, snapshot: any) => void;
  removeCameraVerificationSnapshot: (cameraId: string, snapshotId: string) => void;

  setLaunchNotice: (notice: string | null) => void;
  setTimelineFocusRequest: (request: any) => void;
  setArchiveHandoffRequest: (request: ArchiveHandoffRequest | null) => void;

  enterFixSandbox: () => void;
  exitFixSandbox: () => void;
  applyFixSandbox: () => void;

  refreshSavedLayoutsList: () => void;
  saveCurrentLayoutAs: (name: string) => any;
  applySavedLayout: (layoutId: string) => void;
  deleteSavedLayout: (layoutId: string) => void;
}

export function createGovernanceSlice(set: any, get: any): GovernanceSlice {
  const initialAccess = createDefaultWorkspaceAccessState();
  const initialGovernance = createDefaultWorkspaceGovernance();
  const initialAccount = createDefaultWorkspaceAccountProfile({
    primaryOrganization: "Personal Workspace",
    primaryOwner: "You",
    capabilities: { sharedWorkspaces: false, publishedWorkspaces: false, archiveRecovery: false, reportExports: false, scanIntake: false, liveEvidence: false },
    workspaceCount: 0,
  });

  return {
    activeBranch: "main",
    branchScenes: {},
    branchLifecycleState: {},
    workspaceGovernance: initialGovernance,
    workspaceAccess: initialAccess,
    workspaceAccount: initialAccount,
    organizations: [],
    activeOrganizationId: null,
    reportCatalog: loadReportCatalogState(),

    savedScenes: [],
    savedProjects: [],

    compareVisualEvidence: null,
    compareReportSelection: null,
    compareOrbitSync: false,
    compareOrbitCameraState: { position: null, target: null },

    cameraViewVerificationIntent: null,
    cameraVerificationSnapshots: {},

    launchNotice: null,
    timelineFocusRequest: null,
    archiveHandoffRequest: null,

    fixSandboxActive: false,
    fixSandboxBaselineScene: null,
    fixSandboxDraftScene: null,
    fixSandboxDiff: { camerasChanged: 0, zonesAffected: 0, needsRecompute: true },

    savedLayouts: [],

    addReportCatalogPreset: (input) => set((state: any) => {
      const preset = createReportCatalogPreset(input);
      const nextState = upsertReportCatalogPreset(state.reportCatalog, preset);
      persistReportCatalogState(nextState);
      return { reportCatalog: nextState };
    }),

    updateReportCatalogPreset: (preset) => set((state: any) => {
      const nextState = upsertReportCatalogPreset(state.reportCatalog, preset);
      persistReportCatalogState(nextState);
      return { reportCatalog: nextState };
    }),

    removeReportCatalogPreset: (presetId) => set((state: any) => {
      const nextState = removeReportCatalogPreset(state.reportCatalog, presetId);
      persistReportCatalogState(nextState);
      return { reportCatalog: nextState };
    }),

    setReportCatalogSelectedPresetId: (presetId) => set((state: any) => {
      const nextState = { ...state.reportCatalog, selectedPresetId: presetId };
      persistReportCatalogState(nextState);
      return { reportCatalog: nextState };
    }),

    updateBranchLifecycle: (branchId, action, actorId = "user") => set((state: any) => {
      const existing = state.branchLifecycleState[branchId];
      const record = existing ?? createDraftBranchRecord(branchId, branchId, actorId);
      try {
        const next = transitionBranch(record, action, actorId);
        return { branchLifecycleState: { ...state.branchLifecycleState, [branchId]: next } };
      } catch {
        return state;
      }
    }),

    createDraftBranch: (branchName) => set((state: any) => {
      if (state.branchScenes[branchName]) return state;
      return {
        activeBranch: branchName,
        branchScenes: { ...state.branchScenes, [branchName]: cloneSecurityScene(state.scene) },
      };
    }),

    switchBranch: (branchName) => set((state: any) => {
      const branchScene = state.branchScenes[branchName];
      if (!branchScene) return state;
      return { activeBranch: branchName, scene: cloneSecurityScene(branchScene) };
    }),

    submitForReview: (_branchName, _note) => set((state: any) => state),

    approveBranch: (branchName, _note) => set((state: any) => {
      const branchScene = state.branchScenes[branchName];
      if (!branchScene) return state;
      const mergedScene = cloneSecurityScene(branchScene);
      return {
        scene: mergedScene,
        branchScenes: { ...state.branchScenes, main: cloneSecurityScene(mergedScene) },
        activeBranch: "main",
      };
    }),

    rejectBranch: (branchName, _note) => set((state: any) => {
      const { [branchName]: _, ...remainingBranches } = state.branchScenes;
      return {
        branchScenes: remainingBranches,
        activeBranch: state.activeBranch === branchName ? "main" : state.activeBranch,
        scene: state.activeBranch === branchName && state.branchScenes.main
          ? cloneSecurityScene(state.branchScenes.main)
          : state.scene,
      };
    }),

    setWorkspaceRole: (role) => {
      const { scene, operationalEvidenceEvents, workspaceGovernance, workspaceAccess, historyPast } = get();
      if (workspaceGovernance.activeRole === role) return;
      const evidenceEvent = buildOperationalEvidenceEvent({
        kind: "governance_role_changed",
        title: "Workspace role changed",
        details: `Role changed from ${workspaceGovernance.activeRole} to ${role}.`,
        actor: "user", source: scene.source, sceneId: scene.id, sceneName: scene.name,
        revisionDepth: historyPast.length, affectedNodeIds: [],
        confidence: 0.9, branchLabel: "review", lifecycleStage: "review",
        beforeSummary: summarizeSceneEvidence(scene).detail,
        afterSummary: summarizeSceneEvidence(scene).detail,
        notes: [`Active role changed from ${workspaceGovernance.activeRole} to ${role}.`],
      });
      const nextEvents = [...operationalEvidenceEvents, evidenceEvent];
      persistOperationalEvidenceEvents(nextEvents);
      const nextGovernance = { ...workspaceGovernance, activeRole: role };
      const nextAccess = {
        ...workspaceAccess,
        members: workspaceAccess.members.map((member: any) =>
          member.id === workspaceAccess.activeMemberId ? { ...member, role } : member
        ),
      };
      persistWorkspaceAccess(nextAccess);
      persistWorkspaceGovernance(nextGovernance);
      set({
        operationalEvidenceEvents: nextEvents, workspaceAccess: nextAccess,
        workspaceGovernance: nextGovernance,
        scene: appendChangeLog(scene, evidenceLogLine(evidenceEvent)),
      });
    },

    setWorkspaceApprovalMode: (mode) => {
      const { scene, operationalEvidenceEvents, workspaceGovernance, historyPast } = get();
      if (workspaceGovernance.approvalMode === mode) return;
      const evidenceEvent = buildOperationalEvidenceEvent({
        kind: "governance_policy_changed",
        title: "Workspace approval policy changed",
        details: `Approval mode changed from ${workspaceGovernance.approvalMode} to ${mode}.`,
        actor: "user", source: scene.source, sceneId: scene.id, sceneName: scene.name,
        revisionDepth: historyPast.length, affectedNodeIds: [],
        confidence: 0.9, branchLabel: "review", lifecycleStage: "review",
        beforeSummary: summarizeSceneEvidence(scene).detail,
        afterSummary: summarizeSceneEvidence(scene).detail,
        notes: [`Approval mode changed from ${workspaceGovernance.approvalMode} to ${mode}.`],
      });
      const nextEvents = [...operationalEvidenceEvents, evidenceEvent];
      persistOperationalEvidenceEvents(nextEvents);
      const nextGovernance = { ...workspaceGovernance, approvalMode: mode };
      persistWorkspaceGovernance(nextGovernance);
      set({
        operationalEvidenceEvents: nextEvents, workspaceGovernance: nextGovernance,
        scene: appendChangeLog(scene, evidenceLogLine(evidenceEvent)),
      });
    },

    setWorkspaceActiveMember: (memberId) => {
      const { scene, operationalEvidenceEvents, workspaceAccess, workspaceGovernance, historyPast } = get();
      const member = workspaceAccess.members.find((entry: any) => entry.id === memberId) ?? null;
      if (!member || member.id === workspaceAccess.activeMemberId) return false;
      const evidenceEvent = buildOperationalEvidenceEvent({
        kind: "workspace_member_selected",
        title: "Workspace member selected",
        details: `Active workspace member changed to ${member.displayName} (${member.role}).`,
        actor: "user", source: scene.source, sceneId: scene.id, sceneName: scene.name,
        revisionDepth: historyPast.length, affectedNodeIds: [],
        confidence: 0.9, branchLabel: "review", lifecycleStage: "review",
        beforeSummary: summarizeSceneEvidence(scene).detail,
        afterSummary: summarizeSceneEvidence(scene).detail,
        notes: [`Active workspace member set to ${member.displayName}.`],
      });
      const nextEvents = [...operationalEvidenceEvents, evidenceEvent];
      persistOperationalEvidenceEvents(nextEvents);
      const nextAccess = { ...workspaceAccess, activeMemberId: member.id };
      const nextGovernance = { ...workspaceGovernance, activeRole: member.role };
      persistWorkspaceAccess(nextAccess);
      persistWorkspaceGovernance(nextGovernance);
      set({
        operationalEvidenceEvents: nextEvents, workspaceAccess: nextAccess,
        workspaceGovernance: nextGovernance,
        scene: appendChangeLog(scene, evidenceLogLine(evidenceEvent)),
      });
      return true;
    },

    setWorkspaceAccessMode: (mode) => {
      const { scene, operationalEvidenceEvents, workspaceAccess, historyPast } = get();
      if (workspaceAccess.policy.mode === mode) return false;
      const evidenceEvent = buildOperationalEvidenceEvent({
        kind: "workspace_access_policy_changed",
        title: "Workspace access policy changed",
        details: `Workspace access mode changed from ${workspaceAccess.policy.mode} to ${mode}.`,
        actor: "user", source: scene.source, sceneId: scene.id, sceneName: scene.name,
        revisionDepth: historyPast.length, affectedNodeIds: [],
        confidence: 0.9, branchLabel: "review", lifecycleStage: "review",
        beforeSummary: summarizeSceneEvidence(scene).detail,
        afterSummary: summarizeSceneEvidence(scene).detail,
        notes: [`Workspace access mode changed from ${workspaceAccess.policy.mode} to ${mode}.`],
      });
      const nextEvents = [...operationalEvidenceEvents, evidenceEvent];
      persistOperationalEvidenceEvents(nextEvents);
      const nextAccess = { ...workspaceAccess, policy: { ...workspaceAccess.policy, mode } };
      persistWorkspaceAccess(nextAccess);
      set({
        operationalEvidenceEvents: nextEvents, workspaceAccess: nextAccess,
        scene: appendChangeLog(scene, evidenceLogLine(evidenceEvent)),
      });
      return true;
    },

    syncWorkspaceMembershipSnapshot: ({ workspaceAccessState, workspaceGovernanceState }) => {
      const { scene, operationalEvidenceEvents, workspaceAccess, workspaceGovernance, historyPast } = get();
      const nextAccess = normalizeWorkspaceAccessState(workspaceAccessState);
      const nextGovernance = normalizeWorkspaceGovernance(workspaceGovernanceState);
      const drift = summarizeWorkspaceMembershipDrift(workspaceAccess, nextAccess);
      if (!drift.activeMemberChanged && !drift.teamSizeChanged && !drift.policyChanged
        && workspaceGovernance.activeRole === nextGovernance.activeRole
        && workspaceGovernance.approvalMode === nextGovernance.approvalMode
        && workspaceGovernance.sceneStatus === nextGovernance.sceneStatus) {
        return false;
      }
      const evidenceEvent = buildOperationalEvidenceEvent({
        kind: "workspace_membership_synced",
        title: "Workspace membership snapshot synced",
        details: `Workspace identity reconciled against the latest archived snapshot. Active member ${drift.activeMemberChanged ? "changed" : "matched"}, team size ${drift.teamSizeChanged ? "changed" : "matched"}, policy ${drift.policyChanged ? "changed" : "matched"}.`,
        actor: "user", source: scene.source, sceneId: scene.id, sceneName: scene.name,
        revisionDepth: historyPast.length, affectedNodeIds: [],
        confidence: 0.95, branchLabel: "review", lifecycleStage: "review",
        beforeSummary: summarizeSceneEvidence(scene).detail,
        afterSummary: summarizeSceneEvidence(scene).detail,
        notes: ["Workspace membership synced from archived snapshot.",
          `Active member: ${nextAccess.activeMemberId}.`, `Policy mode: ${nextAccess.policy.mode}.`],
      });
      const nextEvents = [...operationalEvidenceEvents, evidenceEvent];
      persistOperationalEvidenceEvents(nextEvents);
      const nextWorkspaceGovernance = {
        ...workspaceGovernance, ...nextGovernance, activeRole: nextGovernance.activeRole,
      };
      persistWorkspaceAccess(nextAccess);
      persistWorkspaceGovernance(nextWorkspaceGovernance);
      set({
        operationalEvidenceEvents: nextEvents, workspaceAccess: nextAccess,
        workspaceGovernance: nextWorkspaceGovernance,
        scene: appendChangeLog(scene, evidenceLogLine(evidenceEvent)),
      });
      return true;
    },

    setWorkspaceAccountProfile: (patch) => {
      const { workspaceAccount, savedProjects } = get();
      const summary = {
        primaryOrganization: savedProjects[0]?.workspaceOrganization ?? workspaceAccount.accountName,
        primaryOwner: savedProjects[0]?.workspaceOwner ?? workspaceAccount.ownerName,
        capabilities: {
          sharedWorkspaces: savedProjects.some((p: any) => p.workspaceVisibility === "shared"),
          publishedWorkspaces: savedProjects.some((p: any) => p.workspaceVisibility === "published"),
          archiveRecovery: savedProjects.length > 0,
          reportExports: savedProjects.length > 0,
          scanIntake: savedProjects.length > 0,
          liveEvidence: savedProjects.length > 0,
        },
        workspaceCount: savedProjects.length,
      };
      const nextAccount = normalizeWorkspaceAccountProfile({ ...workspaceAccount, ...patch }, summary);
      persistWorkspaceAccount(nextAccount);
      set({ workspaceAccount: nextAccount });
    },

    resetWorkspaceAccountProfile: () => {
      const { savedProjects } = get();
      const summary = {
        primaryOrganization: savedProjects[0]?.workspaceOrganization ?? "Personal Workspace",
        primaryOwner: savedProjects[0]?.workspaceOwner ?? "You",
        capabilities: {
          sharedWorkspaces: savedProjects.some((p: any) => p.workspaceVisibility === "shared"),
          publishedWorkspaces: savedProjects.some((p: any) => p.workspaceVisibility === "published"),
          archiveRecovery: savedProjects.length > 0,
          reportExports: savedProjects.length > 0,
          scanIntake: savedProjects.length > 0,
          liveEvidence: savedProjects.length > 0,
        },
        workspaceCount: savedProjects.length,
      };
      const nextAccount = createDefaultWorkspaceAccountProfile(summary);
      persistWorkspaceAccount(nextAccount);
      set({ workspaceAccount: nextAccount });
    },

    requestSceneReview: (note = "") => {
      const { scene, operationalEvidenceEvents, workspaceGovernance, workspaceAccess, historyPast } = get();
      const trimmed = note.trim();
      const accessRoute = routeWorkspaceApproval(scene, workspaceAccess);
      const evidenceEvent = buildOperationalEvidenceEvent({
        kind: "scene_review_requested",
        title: "Review requested",
        details: trimmed || `Requested scene review before publish. Routing to ${accessRoute.requiredReviewerRole.replace(/_/g, " ")}.`,
        actor: "user", source: scene.source, sceneId: scene.id, sceneName: scene.name,
        revisionDepth: historyPast.length,
        affectedNodeIds: scene.cameras.map((c: any) => c.id),
        confidence: 0.9, branchLabel: "review", lifecycleStage: "review",
        beforeSummary: summarizeSceneEvidence(scene).detail,
        afterSummary: summarizeSceneEvidence(scene).detail,
        notes: trimmed
          ? [trimmed, `Review route: ${accessRoute.requiredReviewerRole.replace(/_/g, " ")}.`]
          : [`Review route: ${accessRoute.requiredReviewerRole.replace(/_/g, " ")}.`],
      });
      const nextEvents = [...operationalEvidenceEvents, evidenceEvent];
      persistOperationalEvidenceEvents(nextEvents);
      const nextGovernance: any = {
        ...workspaceGovernance, sceneStatus: "review_requested",
        requestedAt: Date.now(), requestedBy: workspaceGovernance.activeRole,
        reviewedAt: null, reviewedBy: null,
      };
      persistWorkspaceGovernance(nextGovernance);
      set({
        operationalEvidenceEvents: nextEvents, workspaceGovernance: nextGovernance,
        scene: appendChangeLog(scene, evidenceLogLine(evidenceEvent)),
      });
      return true;
    },

    approveSceneReview: (note = "") => {
      const { scene, operationalEvidenceEvents, workspaceGovernance, workspaceAccess, historyPast } = get();
      if (!canPerformWorkspaceAction(workspaceAccess, scene, "approve", workspaceGovernance).allowed) return false;
      const trimmed = note.trim();
      const evidenceEvent = buildOperationalEvidenceEvent({
        kind: "scene_review_approved",
        title: "Review approved",
        details: trimmed || "Scene review approved for publish.",
        actor: "user", source: scene.source, sceneId: scene.id, sceneName: scene.name,
        revisionDepth: historyPast.length,
        affectedNodeIds: scene.cameras.map((c: any) => c.id),
        confidence: 0.95, branchLabel: "review", lifecycleStage: "review",
        beforeSummary: summarizeSceneEvidence(scene).detail,
        afterSummary: summarizeSceneEvidence(scene).detail,
        notes: trimmed ? [trimmed] : undefined,
      });
      const nextEvents = [...operationalEvidenceEvents, evidenceEvent];
      persistOperationalEvidenceEvents(nextEvents);
      const nextGovernance: any = {
        ...workspaceGovernance, sceneStatus: "approved",
        reviewedAt: Date.now(), reviewedBy: workspaceGovernance.activeRole,
      };
      persistWorkspaceGovernance(nextGovernance);
      set({
        operationalEvidenceEvents: nextEvents, workspaceGovernance: nextGovernance,
        scene: appendChangeLog(scene, evidenceLogLine(evidenceEvent)),
      });
      return true;
    },

    rejectSceneReview: (note = "") => {
      const { scene, operationalEvidenceEvents, workspaceGovernance, workspaceAccess, historyPast } = get();
      if (!canPerformWorkspaceAction(workspaceAccess, scene, "reject", workspaceGovernance).allowed) return false;
      const trimmed = note.trim();
      const evidenceEvent = buildOperationalEvidenceEvent({
        kind: "scene_review_rejected",
        title: "Review rejected",
        details: trimmed || "Scene review rejected and returned for revision.",
        actor: "user", source: scene.source, sceneId: scene.id, sceneName: scene.name,
        revisionDepth: historyPast.length,
        affectedNodeIds: scene.cameras.map((c: any) => c.id),
        confidence: 0.95, branchLabel: "review", lifecycleStage: "review",
        beforeSummary: summarizeSceneEvidence(scene).detail,
        afterSummary: summarizeSceneEvidence(scene).detail,
        notes: trimmed ? [trimmed] : undefined,
      });
      const nextEvents = [...operationalEvidenceEvents, evidenceEvent];
      persistOperationalEvidenceEvents(nextEvents);
      const nextGovernance: any = {
        ...workspaceGovernance, sceneStatus: "rejected",
        reviewedAt: Date.now(), reviewedBy: workspaceGovernance.activeRole,
      };
      persistWorkspaceGovernance(nextGovernance);
      set({
        operationalEvidenceEvents: nextEvents, workspaceGovernance: nextGovernance,
        scene: appendChangeLog(scene, evidenceLogLine(evidenceEvent)),
      });
      return true;
    },

    addSceneAnnotation: (note) => {
      const trimmed = note.trim();
      if (!trimmed) return false;
      const { scene, operationalEvidenceEvents, workspaceGovernance, historyPast } = get();
      const evidenceEvent = buildOperationalEvidenceEvent({
        kind: "scene_comment_added",
        title: "Review annotation added",
        details: trimmed, actor: "user",
        source: scene.source, sceneId: scene.id, sceneName: scene.name,
        revisionDepth: historyPast.length, affectedNodeIds: [],
        confidence: 0.92, branchLabel: "review", lifecycleStage: "review",
        beforeSummary: summarizeSceneEvidence(scene).detail,
        afterSummary: summarizeSceneEvidence(scene).detail,
        notes: [trimmed],
      });
      const nextEvents = [...operationalEvidenceEvents, evidenceEvent];
      persistOperationalEvidenceEvents(nextEvents);
      const nextGovernance = {
        ...workspaceGovernance,
        reviewNotes: [...workspaceGovernance.reviewNotes, trimmed].slice(-12),
      };
      persistWorkspaceGovernance(nextGovernance);
      set({
        operationalEvidenceEvents: nextEvents, workspaceGovernance: nextGovernance,
        scene: appendChangeLog(scene, evidenceLogLine(evidenceEvent)),
      });
      return true;
    },

    setActiveOrganization: (id) => {
      const result = getOrganizationManager().setActiveOrganization(id);
      if (result.success) set({ activeOrganizationId: id });
    },

    addOrganization: (name, plan) => {
      const org = getOrganizationManager().addOrganization(name, "local-user", plan ?? "free");
      set({
        organizations: getOrganizationManager().getOrganizations(),
        activeOrganizationId: getOrganizationManager().getActiveOrganizationId(),
      });
      return org;
    },

    updateOrganization: (id, patch) => {
      const result = getOrganizationManager().updateOrganization(id, patch);
      if (result.success) set({ organizations: getOrganizationManager().getOrganizations() });
      return result.success;
    },

    removeOrganization: (id) => {
      const result = getOrganizationManager().removeOrganization(id);
      if (result.success) {
        set({
          organizations: getOrganizationManager().getOrganizations(),
          activeOrganizationId: getOrganizationManager().getActiveOrganizationId(),
        });
      }
      return result.success;
    },

    refreshOrganizations: () => {
      set({
        organizations: getOrganizationManager().getOrganizations(),
        activeOrganizationId: getOrganizationManager().getActiveOrganizationId(),
      });
    },

    setScene: (scene) => {
      const nextScene = cloneSecurityScene(scene);
      const nextCameraId = nextScene.cameras[0]?.id ?? null;
      const layout = buildPresetDockLayout("edit");
      const evidenceEvent = buildOperationalEvidenceEvent({
        kind: scene.source === "import" ? "scene_imported"
          : scene.source === "scan" ? "scan_compiled"
            : scene.source === "ai" ? "draft_applied"
              : scene.source === "manual" ? "scene_created" : "scene_initialized",
        title: `Scene loaded: ${nextScene.name || "Untitled Scene"}`,
        details: `Opened ${nextScene.name || "Untitled Scene"} from ${nextScene.source}.`,
        actor: "system", source: nextScene.source,
        sceneId: nextScene.id, sceneName: nextScene.name,
        revisionDepth: 0, affectedNodeIds: [],
        confidence: 0.9, afterSummary: summarizeSceneEvidence(nextScene).detail,
        sceneSnapshot: cloneSecurityScene(nextScene),
      });
      const nextEvents = [evidenceEvent];
      persistOperationalEvidenceEvents(nextEvents);
      const nextGovernance = resetWorkspaceGovernanceForDraft(get().workspaceGovernance);
      persistWorkspaceGovernance(nextGovernance);
      set(buildSceneReplacementPatch(nextScene, layout, nextEvents, nextGovernance, nextCameraId, (nextScene.snapshots ?? []).length, {
        bottomTab: "metrics", inspectorTab: "properties", activeTool: "select",
      }));
    },

    createNewScene: () => {
      const blank = createBlankSecurityScene();
      const nextCameraId = blank.cameras[0]?.id ?? null;
      const layout = buildPresetDockLayout("edit");
      const evidenceEvent = buildOperationalEvidenceEvent({
        kind: "scene_created",
        title: "Blank scene created",
        details: "Started a new blank SecurityScene in Studio.",
        actor: "system", source: blank.source,
        sceneId: blank.id, sceneName: blank.name,
        revisionDepth: 0, affectedNodeIds: [],
        confidence: 0.95, afterSummary: summarizeSceneEvidence(blank).detail,
        sceneSnapshot: cloneSecurityScene(blank),
      });
      const nextEvents = [evidenceEvent];
      persistOperationalEvidenceEvents(nextEvents);
      const nextGovernance = resetWorkspaceGovernanceForDraft(get().workspaceGovernance);
      persistWorkspaceGovernance(nextGovernance);
      set({
        ...buildSceneReplacementPatch(blank, layout, nextEvents, nextGovernance, nextCameraId, 0, {
          bottomTab: "metrics", inspectorTab: "properties", activeTool: "select",
        }),
        compareVisualEvidence: null, compareReportSelection: null,
        operationalEvidenceEvents: nextEvents,
        workspaceGovernance: nextGovernance,
      });
    },

    saveSceneToStorage: () => {
      const scene = get().scene;
      const projects = loadProjectsFromStorage();
      const idx = projects.findIndex((r: any) => r.scene.id === scene.id);
      const cloned = cloneSecurityScene(scene);
      const now = Date.now();
      if (idx >= 0) {
        const existing = projects[idx];
        projects[idx] = { ...existing, scene: cloned, updatedAt: now };
      } else {
        projects.push({
          scene: cloned, folder: "Unsorted",
          tags: [scene.source === "demo" ? "demo" : scene.source === "manual" ? "manual" : "workspace"],
          pinned: false,
          workspaceOrganization: "Personal Workspace",
          workspaceOwner: "You",
          workspaceVisibility: "private",
          createdAt: now, updatedAt: now, lastOpenedAt: null,
        });
      }
      persistSavedProjects(projects);
      get().refreshSavedScenesList();
    },

    loadScenesFromStorage: () => {
      return loadProjectsFromStorage().map((record: any) => record.scene);
    },

    refreshSavedScenesList: () => {
      const savedProjects = loadProjectsFromStorage();
      set({ savedProjects, savedScenes: savedProjects.map((r: any) => r.scene) });
    },

    deleteSavedScene: (sceneId) => {
      const projects = loadProjectsFromStorage().filter((r: any) => r.scene.id !== sceneId);
      persistSavedProjects(projects);
      get().refreshSavedScenesList();
    },

    updateSavedSceneMetadata: (sceneId, patch) => {
      const projects = loadProjectsFromStorage();
      const idx = projects.findIndex((r: any) => r.scene.id === sceneId);
      if (idx < 0) return;
      if (patch.workspaceVisibility !== undefined) {
        const guard = guardVisibilityChange(projects[idx].workspaceVisibility, patch.workspaceVisibility);
        if (!guard.allowed) { console.warn(`Entitlement guard rejected visibility change: ${guard.reason}`); return; }
      }
      projects[idx] = { ...projects[idx], ...patch, updatedAt: Date.now() };
      persistSavedProjects(projects);
      get().refreshSavedScenesList();
    },

    duplicateSavedScene: (sceneId) => {
      const projects = loadProjectsFromStorage();
      const source = projects.find((r: any) => r.scene.id === sceneId);
      if (!source) {
        get().recordRuntimeIncident({
          category: "user_error", severity: "warning",
          title: "Duplicate failed", details: "Source scene not found.",
          action: "duplicate_scene", path: "/studio",
        });
        return null;
      }
      const quotaGuard = guardWorkspaceCountQuota(projects.length);
      if (!quotaGuard.allowed) {
        get().recordRuntimeIncident({
          category: "user_error", severity: "warning",
          title: quotaGuard.reason ?? "Duplicate failed",
          details: "Workspace quota exceeded.",
          action: "duplicate_scene", path: "/studio",
        });
        return null;
      }
      const now = Date.now();
      const existingIds = new Set(projects.map((r: any) => r.scene.id));
      const existingNames = new Set(projects.map((r: any) => r.scene.name));
      const duplicateScene = cloneSecurityScene(source.scene);
      duplicateScene.id = makeDuplicateSceneId(source.scene.id, existingIds);
      duplicateScene.name = makeDuplicateSceneName(source.scene.name, existingNames);
      duplicateScene.source = "manual";
      duplicateScene.createdAt = now;
      duplicateScene.updatedAt = now;
      const duplicateRecord = {
        scene: duplicateScene, folder: source.folder,
        tags: [...new Set([...source.tags, "copy"])].slice(0, 8),
        pinned: false,
        workspaceOrganization: source.workspaceOrganization,
        workspaceOwner: source.workspaceOwner,
        workspaceVisibility: source.workspaceVisibility,
        createdAt: now, updatedAt: now, lastOpenedAt: null,
      };
      persistSavedProjects([duplicateRecord, ...projects]);
      get().refreshSavedScenesList();
      return duplicateRecord;
    },

    renameSavedScene: (sceneId, nextName) => {
      const trimmed = nextName.trim();
      if (!trimmed) return null;
      const projects = loadProjectsFromStorage();
      const idx = projects.findIndex((r: any) => r.scene.id === sceneId);
      if (idx < 0) return null;
      if (projects[idx].scene.source === "demo") return null;
      const existingNames = new Set(projects.filter((_: any, i: number) => i !== idx).map((r: any) => r.scene.name));
      const record = projects[idx];
      const scene = cloneSecurityScene(record.scene);
      scene.name = existingNames.has(trimmed) ? makeDuplicateSceneName(trimmed, existingNames) : trimmed;
      scene.updatedAt = Date.now();
      const nextRecord = { ...record, scene, updatedAt: Date.now() };
      projects[idx] = nextRecord;
      persistSavedProjects(projects);
      get().refreshSavedScenesList();
      return nextRecord;
    },

    getSceneStorageKey: () => PROJECT_STORAGE_KEY,

    setCompareVisualEvidence: (compareVisualEvidence) => set({ compareVisualEvidence }),
    setCompareReportSelection: (compareReportSelection) => set({ compareReportSelection }),
    setCompareOrbitSync: (compareOrbitSync) => set({ compareOrbitSync }),
    setCompareOrbitCameraState: (compareOrbitCameraState) => set({ compareOrbitCameraState }),

    setCameraViewVerificationIntent: (cameraViewVerificationIntent) => set({ cameraViewVerificationIntent }),

    upsertCameraVerificationSnapshot: (cameraId, snapshot) =>
      set((state: any) => {
        const existing = state.cameraVerificationSnapshots[cameraId] ?? [];
        const idx = existing.findIndex((entry: any) => entry.id === snapshot.id);
        const next = idx >= 0
          ? existing.map((entry: any, i: number) => (i === idx ? snapshot : entry))
          : [snapshot, ...existing].slice(0, 20);
        return { cameraVerificationSnapshots: { ...state.cameraVerificationSnapshots, [cameraId]: next } };
      }),

    removeCameraVerificationSnapshot: (cameraId, snapshotId) =>
      set((state: any) => {
        const existing = state.cameraVerificationSnapshots[cameraId] ?? [];
        return {
          cameraVerificationSnapshots: {
            ...state.cameraVerificationSnapshots,
            [cameraId]: existing.filter((entry: any) => entry.id !== snapshotId),
          },
        };
      }),

    setLaunchNotice: (launchNotice) => set({ launchNotice }),
    setTimelineFocusRequest: (timelineFocusRequest) => set({ timelineFocusRequest }),
    setArchiveHandoffRequest: (archiveHandoffRequest) => set({ archiveHandoffRequest }),

    enterFixSandbox: () => {
      const { scene } = get();
      const baselineClone = cloneSecurityScene(scene);
      const draftClone = cloneSecurityScene(scene);
      set({
        fixSandboxActive: true, fixSandboxBaselineScene: baselineClone,
        fixSandboxDraftScene: draftClone,
        fixSandboxDiff: { camerasChanged: 0, zonesAffected: 0, needsRecompute: true },
      });
      persistFixSandboxState(true, baselineClone, draftClone);
    },

    exitFixSandbox: () => {
      const { fixSandboxBaselineScene } = get();
      set({
        fixSandboxActive: false, fixSandboxBaselineScene: null,
        fixSandboxDraftScene: null,
        fixSandboxDiff: { camerasChanged: 0, zonesAffected: 0, needsRecompute: true },
      });
      persistFixSandboxState(false, null, null);
      if (fixSandboxBaselineScene) {
        get().setScene(cloneSecurityScene(fixSandboxBaselineScene));
      }
    },

    applyFixSandbox: () => {
      const { fixSandboxDraftScene, scene, simulationResult, snapshots } = get();
      if (!fixSandboxDraftScene) return;
      const appliedScene = cloneSecurityScene(fixSandboxDraftScene);
      const snapshotLabel = `Fix sandbox applied ${new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}`;
      const appliedSnapshot: SceneSnapshot = {
        id: `snap_${Date.now().toString(36)}`, label: snapshotLabel,
        createdAt: Date.now(), scene: cloneSecurityScene(appliedScene),
        simulation: simulationResult ?? undefined,
      };
      const nextSnapshots = [...snapshots, appliedSnapshot];
      appliedScene.snapshots = nextSnapshots;
      const evidenceEvent = buildOperationalEvidenceEvent({
        kind: "scene_updated",
        title: "Fix sandbox applied",
        details: "Draft changes from fix sandbox committed to the scene.",
        actor: "user", source: appliedScene.source,
        sceneId: appliedScene.id, sceneName: appliedScene.name,
        revisionDepth: get().historyPast.length, affectedNodeIds: [],
        confidence: 0.92,
        beforeSummary: summarizeSceneEvidence(scene).detail,
        afterSummary: summarizeSceneEvidence(appliedScene).detail,
        sceneSnapshot: cloneSecurityScene(appliedScene),
        notes: [snapshotLabel],
      });
      const nextEvents = [...get().operationalEvidenceEvents, evidenceEvent];
      persistOperationalEvidenceEvents(nextEvents);
      set({
        fixSandboxActive: false, fixSandboxBaselineScene: null,
        fixSandboxDraftScene: null,
        fixSandboxDiff: { camerasChanged: 0, zonesAffected: 0, needsRecompute: true },
        snapshots: nextSnapshots, simulationDirty: true,
        operationalEvidenceEvents: nextEvents,
        sceneIntelligenceGraph: buildGraphState(appliedScene, simulationResult, get().historyPast.length, nextSnapshots.length),
        scene: appendChangeLog(appliedScene, evidenceLogLine(evidenceEvent)),
      });
      persistFixSandboxState(false, null, null);
      setTimeout(() => { get().runSimulation(); }, 50);
    },

    refreshSavedLayoutsList: () => {
      const savedLayouts = loadLayoutsFromStorage();
      set({ savedLayouts });
    },

    saveCurrentLayoutAs: (name) => {
      const trimmed = name.trim();
      if (!trimmed) return null;
      const state = get();
      const next: any = {
        id: `layout_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
        name: trimmed,
        viewMode: state.viewMode, canvasMode: state.canvasMode,
        workspacePreset: state.workspacePreset,
        leftDockCollapsed: state.leftDockCollapsed,
        rightDockCollapsed: state.rightDockCollapsed,
        bottomDockCollapsed: state.bottomDockCollapsed,
        leftDockSizePx: state.leftDockSizePx,
        rightDockSizePx: state.rightDockSizePx,
        bottomDockSizePx: state.bottomDockSizePx,
        visibleComponents: { ...state.visibleComponents },
        enabledAnalysisModules: { ...state.enabledAnalysisModules },
        rightPanelMode: state.rightPanelMode,
        bottomDrawerMode: state.bottomDrawerMode,
        pinnedAnalysisModule: state.pinnedAnalysisModule,
        layerVisibility: { ...state.layerVisibility },
        overlayDensity: state.overlayDensity,
        showDebugOverlays: state.showDebugOverlays,
        clientDemoOptions: { ...state.clientDemoOptions },
        createdAt: Date.now(),
      };
      const savedLayouts = [next, ...state.savedLayouts.filter((l: any) => l.id !== next.id)];
      persistSavedLayouts(savedLayouts);
      set({ savedLayouts });
      return next;
    },

    applySavedLayout: (layoutId) => {
      const layout = get().savedLayouts.find((entry: any) => entry.id === layoutId);
      if (!layout) return;
      const patch = buildLayoutStatePatch(layout);
      const bottomTab = layout.pinnedAnalysisModule && layout.enabledAnalysisModules[layout.pinnedAnalysisModule]
        ? layout.pinnedAnalysisModule : viewModeToBottomTab(layout.viewMode);
      set({
        ...patch, focusMode: layout.workspacePreset === "focus",
        previousLayout: null, layerVisibility: { ...layout.layerVisibility },
        bottomTab,
      });
    },

    deleteSavedLayout: (layoutId) => {
      const savedLayouts = get().savedLayouts.filter((layout: any) => layout.id !== layoutId);
      persistSavedLayouts(savedLayouts);
      set({ savedLayouts });
    },
  };
}

function viewModeToBottomTab(mode: string): string {
  switch (mode) {
    case "replay":
    case "camera_view": return "timeline";
    case "compare": return "beforeafter";
    case "report": return "report";
    default: return "metrics";
  }
}

function makeDuplicateSceneId(sceneId: string, existingIds: Set<string>) {
  let candidate = `${sceneId}-copy`;
  let suffix = 2;
  while (existingIds.has(candidate)) {
    candidate = `${sceneId}-copy-${suffix}`;
    suffix += 1;
  }
  return candidate;
}

function makeDuplicateSceneName(name: string, existingNames: Set<string>) {
  const base = name.trim() || "Untitled Scene";
  let candidate = `${base} Copy`;
  let suffix = 2;
  while (existingNames.has(candidate)) {
    candidate = `${base} Copy ${suffix}`;
    suffix += 1;
  }
  return candidate;
}

function buildSceneReplacementPatch(
  nextScene: SecurityScene, layout: any, nextEvents: OperationalEvidenceEvent[],
  nextGovernance: WorkspaceGovernanceState, nextCameraId: string | null,
  snapshotCount: number, overrides?: any,
): any {
  return {
    ...buildLayoutStatePatch(layout),
    scene: cloneSceneWithAppendedChangeLog(nextScene, evidenceLogLine(nextEvents[0])),
    snapshots: [], simulationResult: null, simulationDirty: true,
    selectedNodeId: null, selectedNodeIds: [],
    selectedCameraId: nextCameraId, activePathId: null,
    focusScenePointRequest: null, focusScenePointHighlight: null,
    mapState: cloneDefaultMapState(), focusMode: false, previousLayout: null,
    bottomTab: overrides?.bottomTab ?? "metrics",
    inspectorTab: overrides?.inspectorTab ?? "properties",
    activeTool: overrides?.activeTool ?? "select",
    editor: {
      editorMode: "idle", draftWallStart: undefined,
      draftPolygonPoints: [], draftPathPoints: [],
      hoverPoint: undefined, feedbackMessage: null,
      snapEnabled: true, snapDistanceM: 0.25, gridSnapM: 0.5,
      selectedHandle: undefined,
    },
    historyPast: [], historyFuture: [],
    sceneIntelligenceGraph: buildGraphState(nextScene, null, 0, snapshotCount, nextEvents),
    operationalEvidenceEvents: nextEvents,
    workspaceGovernance: nextGovernance,
  };
}

function loadProjectsFromStorage(): any[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(PROJECT_STORAGE_KEY);
    if (raw) return JSON.parse(raw);
    const legacyRaw = localStorage.getItem(LEGACY_SCENE_STORAGE_KEY);
    if (!legacyRaw) return [];
    const legacy = JSON.parse(legacyRaw);
    if (!Array.isArray(legacy)) return [];
    return legacy.map((scene: any) => {
      const parsed = safeParseSecurityScene(scene);
      if (!parsed.success) return null;
      return {
        scene: cloneSecurityScene(parsed.data), folder: "Unsorted",
        tags: [], pinned: false,
        workspaceOrganization: "Personal Workspace",
        workspaceOwner: "You",
        workspaceVisibility: "private",
        createdAt: parsed.data.createdAt ?? Date.now(),
        updatedAt: parsed.data.updatedAt ?? Date.now(),
        lastOpenedAt: null,
      };
    }).filter(Boolean);
  } catch { return []; }
}

function loadLayoutsFromStorage(): any[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(LAYOUT_STORAGE_KEY);
    const source = raw ?? localStorage.getItem(LEGACY_LAYOUT_STORAGE_KEY);
    if (!source) return [];
    return JSON.parse(source);
  } catch { return []; }
}

function persistFixSandboxState(active: boolean, baseline: SecurityScene | null, draft: SecurityScene | null) {
  try {
    if (!active || !baseline || !draft) {
      localStorage.removeItem(FIX_SANDBOX_STORAGE_KEY);
      return;
    }
    localStorage.setItem(FIX_SANDBOX_STORAGE_KEY, JSON.stringify({
      fixSandboxActive: true, fixSandboxBaselineScene: baseline, fixSandboxDraftScene: draft,
    }));
  } catch {}
}
