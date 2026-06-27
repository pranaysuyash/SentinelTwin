import { cloneSecurityScene } from "@/schema/security-scene";
import {
  buildOperationalEvidenceEvent,
  compareOperationalEvidenceBranches,
  assessOperationalEvidenceMergeReadiness,
  confidenceLabel,
  kindToTitle,
  normalizeOperationalEvidenceEvents,
  mergeOperationalEvidenceBranchScenes,
  reconstructSceneFromEvidence,
  resolveOperationalEvidenceRestoreScene,
  findLatestOperationalEvidenceEventForScene,
  summarizeSceneEvidence,
  summarizeSimulationEvidence,
  type OperationalEvidenceEventInput,
  type OperationalEvidenceEvent,
} from "@/lib/operational-evidence";
import { mapOnvifSessionToEvidenceEvent } from "@/lib/onvif-event-mapper";
import type { OnvifSession } from "@/lib/onvif-client";
import {
  loadOperationalEvidenceEventsFromRaw,
  loadOperationalEvidenceJournalFromRaw,
  serializeOperationalEvidenceJournal,
} from "@/lib/operational-evidence-journal";
import {
  buildOperationalEvidenceArchive,
  createArchiveRestoreEvent,
  normalizeOperationalEvidenceArchive,
  type OperationalEvidenceArchive,
} from "@/lib/operational-evidence-archive";
import {
  createOperationalEvidenceArchiveHistoryRecord,
  normalizeOperationalEvidenceArchiveHistory,
  serializeOperationalEvidenceArchiveHistory,
  type OperationalEvidenceArchiveHistoryRecord,
} from "@/lib/operational-evidence-archive-history";
import {
  canPerformWorkspaceAction,
  createDefaultWorkspaceAccessState,
  getActiveWorkspaceMember,
  normalizeWorkspaceAccessState,
  routeWorkspaceApproval,
  type WorkspaceAccessState,
} from "@/lib/workspace-access";
import {
  normalizeWorkspaceAccountProfile,
  createDefaultWorkspaceAccountProfile,
  type WorkspaceAccountProfile,
} from "@/lib/workspace-catalog";
import {
  createDefaultWorkspaceGovernance,
  normalizeWorkspaceGovernance,
  type WorkspaceGovernanceState,
} from "@/lib/workspace-governance";

function resetWorkspaceGovernanceForDraft(governance: WorkspaceGovernanceState): WorkspaceGovernanceState {
  return {
    ...governance,
    sceneStatus: "draft" as any,
    requestedAt: null,
    requestedBy: null,
    reviewedAt: null,
    reviewedBy: null,
    publishedAt: null,
    publishedBy: null,
  };
}
import { buildSceneIntelligenceGraph } from "@/lib/scene-intelligence-graph";
import { getPresetLayoutSnapshot } from "@/lib/workspace-layouts";
import { DEFAULT_AI_ACTION_TELEMETRY_POLICY, normalizeAiActionTelemetryPolicy, type AiActionTelemetryPolicy } from "@/lib/ai-action-telemetry";
import {
  DEFAULT_AI_PROVIDER_SELECTION,
  describeAiProviderGovernance,
  normalizeAiProviderSelection,
  type AiProviderGovernanceSummary,
  type AiProviderSelection,
} from "@/agents/provider-selection";
import {
  loadModelEvalHistoryFromRaw,
  serializeModelEvalHistory,
  getCloudRequiredFixtureCount,
  summarizeModelEvalRun,
  type ModelEvalRunRecord,
  type ModelEvalSuiteResult,
} from "@/agents/model-eval";
import { buildPromptRegistrySnapshot, type PromptRegistrySnapshot, type PromptRegistryStage } from "@/agents/prompt-registry";
import type { AiActionTelemetryStage } from "@sentineltwin/agents";
export type { AiActionTelemetryStage };

const DEFAULT_LAYERS = {
  cameras: true, camera_cones: true, obstructions: true, lights: true,
  critical_zones: true, privacy_zones: true, paths: true, heatmap: true,
  grid: true, walls_floors: true, labels: true,
};

function buildPresetDockLayout(preset: any) {
  const layout = getPresetLayoutSnapshot(preset, DEFAULT_LAYERS);
  return { ...layout };
}

function createPromptRegistryHistoryRecord(
  snapshot: PromptRegistrySnapshot,
  source: string,
  note?: string | null,
): any {
  return {
    ...snapshot,
    id: `prompt_registry_${snapshot.observedAt.toString(36)}_${snapshot.registryDigest.slice(0, 8)}`,
    source,
    note: note ?? null,
  };
}
import type { SupportIngestResponse } from "@/lib/support-ingest";
import type { SupportIngestHistoryRecord } from "@/lib/support-ingest-history";
import type { SensorNode, CameraNode, SecurityScene } from "@/schema/security-scene";


const PROJECT_STORAGE_KEY = "sentineltwin_saved_projects_v2";
const AI_PROVIDER_STORAGE_KEY = "sentineltwin_ai_provider_selection";
const LOCAL_ONLY_STORAGE_KEY = "sentineltwin_local_only_mode";
const AI_TELEMETRY_POLICY_STORAGE_KEY = "sentineltwin_ai_action_telemetry_policy_v1";
const OPERATIONAL_EVIDENCE_STORAGE_KEY = "sentineltwin_operational_evidence_v1";
const MODEL_EVAL_HISTORY_STORAGE_KEY = "sentineltwin_model_eval_history_v1";
const PROMPT_REGISTRY_HISTORY_STORAGE_KEY = "sentineltwin_prompt_registry_history_v1";
const AI_PROVIDER_GOVERNANCE_HISTORY_STORAGE_KEY = "sentineltwin_ai_provider_governance_history_v1";
const AI_TELEMETRY_STORAGE_KEY = "sentineltwin_ai_action_telemetry_v1";
const EXTERNAL_LOG_STORAGE_KEY = "sentineltwin_external_log_entries_v1";
const SENSOR_EVENT_STORAGE_KEY = "sentineltwin_sensor_live_events_v1";
const CAMERA_METADATA_EVENT_STORAGE_KEY = "sentineltwin_camera_metadata_events_v1";
const CAMERA_CONNECTION_EVENT_STORAGE_KEY = "sentineltwin_camera_connection_events_v1";
const SUPPORT_INGEST_HISTORY_STORAGE_KEY = "sentineltwin_support_ingest_history_v1";
const OPERATIONAL_EVIDENCE_ARCHIVE_HISTORY_STORAGE_KEY = "sentineltwin_operational_evidence_archive_history_v1";

export type RuntimeIncidentCategory = "user_error" | "data_validation_error" | "provider_failure" | "runtime_failure" | "performance_trace";
export type RuntimeIncidentSeverity = "info" | "warning" | "error";
export type RuntimeIncident = { id: string; timestamp: number; category: RuntimeIncidentCategory; severity: RuntimeIncidentSeverity; title: string; details: string; stack?: string | null; durationMs?: number | null; source?: string | null; path?: string | null; action?: string | null; };
export type RuntimeIncidentInput = Omit<RuntimeIncident, "id" | "timestamp"> & { timestamp?: number; };

export type SensorLiveEventKind = "triggered" | "heartbeat" | "faulted" | "restored";
export type SensorLiveEventRecord = { id: string; sceneId: string; sceneName: string; sensorId: string; sensorLabel: string; sensorType: SensorNode["sensorType"]; kind: SensorLiveEventKind; details: string; timestamp: number; resultingState: SensorNode["state"] | null; nearestCameraId: string | null; nearestCameraName: string | null; nearestDistanceM: number | null; };
export type SensorLiveEventInput = Omit<SensorLiveEventRecord, "id" | "timestamp" | "resultingState" | "nearestCameraId" | "nearestCameraName" | "nearestDistanceM" | "sceneId" | "sceneName"> & { timestamp?: number; resultingState?: SensorLiveEventRecord["resultingState"]; nearestCameraId?: string | null; nearestCameraName?: string | null; nearestDistanceM?: number | null; };

export type CameraMetadataEventRecord = { id: string; sceneId: string; sceneName: string; cameraId: string; cameraName: string; previousStatus: CameraNode["status"] | null; previousClarity: CameraNode["clarity"] | null; previousNightMode: CameraNode["nightMode"] | null; previousFeedMode: "normal" | "ir" | "low_light" | "thermal" | null; previousNotes: string | null; status: CameraNode["status"] | null; clarity: CameraNode["clarity"] | null; nightMode: CameraNode["nightMode"] | null; feedMode: "normal" | "ir" | "low_light" | "thermal" | null; ingestMode: "paste" | "external"; feedUrl: string | null; feedLabel: string | null; summary: string; notes: string | null; timestamp: number; };
export type CameraMetadataEventInput = Omit<CameraMetadataEventRecord, "id" | "timestamp" | "sceneId" | "sceneName"> & { timestamp?: number; };

export type CameraLiveConnectionEventRecord = { id: string; sceneId: string; sceneName: string; cameraId: string; cameraName: string; previousLiveSessionId: string | null; previousLiveSessionState: "idle" | "probing" | "connected" | "error" | null; previousLiveSessionStartedAt: number | null; previousLiveSessionConfirmedAt: number | null; previousLiveSessionExpiresAt: number | null; previousLiveFeedUrl: string | null; previousLiveFeedLabel: string | null; previousLiveConnectionMode: "rtsp" | "mjpeg" | "http" | "onvif" | "proxy" | null; previousLiveConnectionStatus: "disconnected" | "connecting" | "connected" | "error" | null; previousAuthMode: "none" | "basic" | "digest" | "token" | "cookie" | "onvif_digest" | "proxy_passthrough" | null; previousAuthState: "unauthenticated" | "authenticating" | "authenticated" | "failed" | null; previousAuthRealm: string | null; previousAuthSessionId: string | null; previousAuthSessionExpiresAt: number | null; previousTransportResponseStatus: number | null; previousTransportResponseStatusText: string | null; previousAuthChallengeHeader: string | null; previousAuthChallengeScheme: "basic" | "digest" | "bearer" | "token" | null; previousAuthChallengeRealm: string | null; previousEventSubscriptionUri: string | null; previousEventSubscriptionReference: string | null; previousEventSubscriptionExpiresAt: number | null; liveSessionId: string | null; liveSessionState: "idle" | "probing" | "connected" | "error" | null; liveSessionStartedAt: number | null; liveSessionConfirmedAt: number | null; liveSessionExpiresAt: number | null; transportSessionId: string | null; transportSessionState: "idle" | "negotiating" | "active" | "closing" | "error" | null; transportResponseStatus: number | null; transportResponseStatusText: string | null; lastHeartbeatAt: number | null; probeCount: number; protocolProfile: "onvif_device" | "rtsp_session" | "mjpeg_stream" | "http_poll" | "proxy" | null; authMode: "none" | "basic" | "digest" | "token" | "cookie" | "onvif_digest" | "proxy_passthrough" | null; authState: "unauthenticated" | "authenticating" | "authenticated" | "failed" | null; authRealm: string | null; authSessionId: string | null; authSessionExpiresAt: number | null; authChallengeHeader: string | null; authChallengeScheme: "basic" | "digest" | "bearer" | "token" | null; authChallengeRealm: string | null; eventSubscriptionUri: string | null; eventSubscriptionReference: string | null; eventSubscriptionExpiresAt: number | null; onvifUsername?: string | null; onvifPassword?: string | null; liveFeedUrl: string | null; liveFeedLabel: string | null; liveConnectionMode: "rtsp" | "mjpeg" | "http" | "onvif" | "proxy" | null; liveConnectionStatus: "disconnected" | "connecting" | "connected" | "error" | null; ingestMode: "manual" | "external"; summary: string; notes: string | null; timestamp: number; };
export type CameraLiveConnectionEventInput = Omit<CameraLiveConnectionEventRecord, "id" | "timestamp" | "sceneId" | "sceneName" | "previousEventSubscriptionUri" | "previousEventSubscriptionReference" | "previousEventSubscriptionExpiresAt" | "onvifUsername" | "onvifPassword"> & { timestamp?: number; previousLiveSessionId?: CameraLiveConnectionEventRecord["previousLiveSessionId"]; previousLiveSessionState?: CameraLiveConnectionEventRecord["previousLiveSessionState"]; previousLiveSessionStartedAt?: CameraLiveConnectionEventRecord["previousLiveSessionStartedAt"]; previousLiveSessionConfirmedAt?: CameraLiveConnectionEventRecord["previousLiveSessionConfirmedAt"]; previousLiveSessionExpiresAt?: CameraLiveConnectionEventRecord["previousLiveSessionExpiresAt"]; previousLiveFeedUrl?: CameraLiveConnectionEventRecord["previousLiveFeedUrl"]; previousLiveFeedLabel?: CameraLiveConnectionEventRecord["previousLiveFeedLabel"]; previousLiveConnectionMode?: CameraLiveConnectionEventRecord["previousLiveConnectionMode"]; previousLiveConnectionStatus?: CameraLiveConnectionEventRecord["previousLiveConnectionStatus"]; previousAuthMode?: CameraLiveConnectionEventRecord["previousAuthMode"]; previousAuthState?: CameraLiveConnectionEventRecord["previousAuthState"]; previousAuthRealm?: CameraLiveConnectionEventRecord["previousAuthRealm"]; previousAuthSessionId?: CameraLiveConnectionEventRecord["previousAuthSessionId"]; previousAuthSessionExpiresAt?: CameraLiveConnectionEventRecord["previousAuthSessionExpiresAt"]; previousTransportResponseStatus?: CameraLiveConnectionEventRecord["previousTransportResponseStatus"]; previousTransportResponseStatusText?: CameraLiveConnectionEventRecord["previousTransportResponseStatusText"]; previousAuthChallengeHeader?: CameraLiveConnectionEventRecord["previousAuthChallengeHeader"]; previousAuthChallengeScheme?: CameraLiveConnectionEventRecord["previousAuthChallengeScheme"]; previousAuthChallengeRealm?: CameraLiveConnectionEventRecord["previousAuthChallengeRealm"]; previousEventSubscriptionUri?: CameraLiveConnectionEventRecord["previousEventSubscriptionUri"]; previousEventSubscriptionReference?: CameraLiveConnectionEventRecord["previousEventSubscriptionReference"]; previousEventSubscriptionExpiresAt?: CameraLiveConnectionEventRecord["previousEventSubscriptionExpiresAt"]; eventSubscriptionUri?: CameraLiveConnectionEventRecord["eventSubscriptionUri"]; eventSubscriptionReference?: CameraLiveConnectionEventRecord["eventSubscriptionReference"]; eventSubscriptionExpiresAt?: CameraLiveConnectionEventRecord["eventSubscriptionExpiresAt"]; onvifUsername?: CameraLiveConnectionEventRecord["onvifUsername"]; onvifPassword?: CameraLiveConnectionEventRecord["onvifPassword"]; liveSessionId?: CameraLiveConnectionEventRecord["liveSessionId"]; liveSessionState?: CameraLiveConnectionEventRecord["liveSessionState"]; liveSessionStartedAt?: CameraLiveConnectionEventRecord["liveSessionStartedAt"]; liveSessionConfirmedAt?: CameraLiveConnectionEventRecord["liveSessionConfirmedAt"]; liveSessionExpiresAt?: CameraLiveConnectionEventRecord["liveSessionExpiresAt"]; transportSessionId?: CameraLiveConnectionEventRecord["transportSessionId"]; transportSessionState?: CameraLiveConnectionEventRecord["transportSessionState"]; transportResponseStatus?: CameraLiveConnectionEventRecord["transportResponseStatus"]; transportResponseStatusText?: CameraLiveConnectionEventRecord["transportResponseStatusText"]; authChallengeHeader?: CameraLiveConnectionEventRecord["authChallengeHeader"]; authChallengeScheme?: CameraLiveConnectionEventRecord["authChallengeScheme"]; authChallengeRealm?: CameraLiveConnectionEventRecord["authChallengeRealm"]; authMode?: CameraLiveConnectionEventRecord["authMode"]; authState?: CameraLiveConnectionEventRecord["authState"]; authRealm?: CameraLiveConnectionEventRecord["authRealm"]; authSessionId?: CameraLiveConnectionEventRecord["authSessionId"]; authSessionExpiresAt?: CameraLiveConnectionEventRecord["authSessionExpiresAt"]; };

export type ExternalLogEntrySource = "paste" | "file";
export type ExternalLogEntrySeverity = "info" | "warning" | "error";
export type ExternalLogEntry = { id: string; timestamp: number; source: ExternalLogEntrySource; title: string; details: string; raw: string; lineCount: number; severity: ExternalLogEntrySeverity; };
export type ExternalLogEntryInput = Omit<ExternalLogEntry, "id" | "timestamp"> & { timestamp?: number; };

export type PromptRegistryHistorySource = "startup" | "manual" | "model_eval";
export type PromptRegistryHistoryRecord = PromptRegistrySnapshot & { id: string; source: PromptRegistryHistorySource; note?: string | null; };
export type AiProviderGovernanceHistorySource = "startup" | "selection" | "policy" | "manual" | "eval";
export type AiProviderGovernanceHistoryRecord = AiProviderGovernanceSummary & { id: string; observedAt: number; source: AiProviderGovernanceHistorySource; note?: string | null; };
export type AiActionTelemetryRecord = { id: string; stage: AiActionTelemetryStage; providerId: AiProviderSelection["providerId"]; providerLabel: string; model: string; promptId?: string | null; promptVersion?: string | null; promptTitle?: string | null; promptAgent?: string | null; promptStage?: PromptRegistryStage | null; promptOutputSchema?: string | null; localOnlyMode: boolean; cloudAvailable: boolean; timestamp: number; durationMs: number; estimatedPromptTokens: number; estimatedCompletionTokens: number; estimatedTotalTokens: number; tokenSource: "estimated" | "usage"; status: "success" | "error"; note?: string | null; };

function makeSensorLiveEventId(timestamp: number): string {
  return `sensor_live_${timestamp.toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}
function makeCameraMetadataEventId(timestamp: number): string {
  return `camera_metadata_${timestamp.toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}
function makeCameraLiveConnectionEventId(timestamp: number): string {
  return `camera_live_connection_${timestamp.toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}
function makeExternalLogId(timestamp: number): string {
  return `external_log_${timestamp.toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}
function makeAiTelemetryId(): string {
  return `ai_telemetry_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}
function makeIncidentId(timestamp: number): string {
  return `incident_${timestamp.toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function createRuntimeIncident(input: RuntimeIncidentInput): RuntimeIncident {
  const timestamp = input.timestamp ?? Date.now();
  return { ...input, id: makeIncidentId(timestamp), timestamp };
}

function clonePlain(obj: any): any {
  return JSON.parse(JSON.stringify(obj));
}

function appendChangeLog(scene: any, entry: string): any {
  const next = clonePlain(scene);
  next.changeLog = [...(next.changeLog ?? []), entry];
  return next;
}

function evidenceLogLine(evt: any): string {
  return `[${new Date(evt.timestamp).toISOString()}] ${evt.kind}: ${evt.title}`;
}

function cloneDefaultMapState(): any {
  return { minimap: { zoom: 1, pan: [0, 0] }, pathMap: { zoom: 1, pan: [0, 0] }, planView: { zoom: 1, pan: [0, 0] } };
}

function persistAiProviderSelection(selection: AiProviderSelection) {
  try { localStorage.setItem(AI_PROVIDER_STORAGE_KEY, JSON.stringify(selection)); } catch {}
}
function persistLocalOnlyMode(enabled: boolean) {
  try { localStorage.setItem(LOCAL_ONLY_STORAGE_KEY, enabled ? "true" : "false"); } catch {}
}
function persistAiTelemetryPolicy(policy: AiActionTelemetryPolicy) {
  try { localStorage.setItem(AI_TELEMETRY_POLICY_STORAGE_KEY, JSON.stringify(policy)); } catch {}
}
function persistOperationalEvidenceEvents(events: OperationalEvidenceEvent[]) {
  try {
    const raw = localStorage.getItem(OPERATIONAL_EVIDENCE_STORAGE_KEY);
    localStorage.setItem(OPERATIONAL_EVIDENCE_STORAGE_KEY, serializeOperationalEvidenceJournal(raw, events));
  } catch {}
}
function persistSensorLiveEvents(events: SensorLiveEventRecord[]) {
  try { localStorage.setItem(SENSOR_EVENT_STORAGE_KEY, JSON.stringify(events.slice(0, 60))); } catch {}
}
function persistCameraMetadataEvents(events: CameraMetadataEventRecord[]) {
  try { localStorage.setItem(CAMERA_METADATA_EVENT_STORAGE_KEY, JSON.stringify(events.slice(0, 60))); } catch {}
}
function persistCameraLiveConnectionEvents(events: CameraLiveConnectionEventRecord[]) {
  try { localStorage.setItem(CAMERA_CONNECTION_EVENT_STORAGE_KEY, JSON.stringify(events.slice(0, 60))); } catch {}
}
function persistModelEvalHistory(history: ModelEvalRunRecord[]) {
  try { localStorage.setItem(MODEL_EVAL_HISTORY_STORAGE_KEY, serializeModelEvalHistory(history)); } catch {}
}
function persistPromptRegistryHistory(history: PromptRegistryHistoryRecord[]) {
  try { localStorage.setItem(PROMPT_REGISTRY_HISTORY_STORAGE_KEY, JSON.stringify(history.slice(0, 24))); } catch {}
}
function persistAiProviderGovernanceHistory(history: AiProviderGovernanceHistoryRecord[]) {
  try { localStorage.setItem(AI_PROVIDER_GOVERNANCE_HISTORY_STORAGE_KEY, JSON.stringify(history.slice(0, 24))); } catch {}
}
function persistSupportIngestHistory(history: SupportIngestHistoryRecord[]) {
  try { localStorage.setItem(SUPPORT_INGEST_HISTORY_STORAGE_KEY, JSON.stringify(history.slice(0, 12))); } catch {}
}
function persistOperationalEvidenceArchiveHistory(history: OperationalEvidenceArchiveHistoryRecord[]) {
  try { localStorage.setItem(OPERATIONAL_EVIDENCE_ARCHIVE_HISTORY_STORAGE_KEY, serializeOperationalEvidenceArchiveHistory(history)); } catch {}
}
function persistAiActionTelemetry(records: AiActionTelemetryRecord[]) {
  try { localStorage.setItem(AI_TELEMETRY_STORAGE_KEY, JSON.stringify(records.slice(0, 50))); } catch {}
}
function persistExternalLogEntries(entries: ExternalLogEntry[]) {
  try { localStorage.setItem(EXTERNAL_LOG_STORAGE_KEY, JSON.stringify(entries.slice(0, 20))); } catch {}
}

function createAiProviderGovernanceHistoryRecord(
  selection: AiProviderSelection,
  localOnlyMode: boolean,
  source: AiProviderGovernanceHistorySource,
  note?: string | null,
): AiProviderGovernanceHistoryRecord {
  const governance = describeAiProviderGovernance(selection, localOnlyMode);
  return {
    ...governance,
    id: `ai_provider_governance_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    observedAt: Date.now(),
    source,
    note: note ?? null,
  };
}

function sanitizeTags(tags: unknown): string[] {
  if (!Array.isArray(tags)) return [];
  return [...new Set(tags.map((tag) => String(tag).trim()).filter(Boolean))].slice(0, 8);
}
function normalizeWorkspaceOrganization(value: unknown, sceneSource?: string): string {
  const trimmed = typeof value === "string" ? value.trim() : "";
  if (trimmed) return trimmed;
  if (sceneSource === "demo") return "SentinelTwin Reference";
  if (sceneSource === "preset") return "Template Library";
  return "Personal Workspace";
}
function normalizeWorkspaceOwner(value: unknown, sceneSource?: string): string {
  const trimmed = typeof value === "string" ? value.trim() : "";
  if (trimmed) return trimmed;
  if (sceneSource === "demo") return "SentinelTwin";
  return "You";
}
function normalizeWorkspaceVisibility(value: unknown, sceneSource?: string): string {
  if (value === "private" || value === "shared" || value === "published") return value;
  return sceneSource === "demo" ? "published" : "private";
}

export interface TelemetrySlice {
  runtimeIncidents: RuntimeIncident[];
  operationalEvidenceEvents: OperationalEvidenceEvent[];
  sensorEvents: SensorLiveEventRecord[];
  cameraMetadataEvents: CameraMetadataEventRecord[];
  cameraLiveConnectionEvents: CameraLiveConnectionEventRecord[];
  externalLogEntries: ExternalLogEntry[];
  supportIngestHistory: SupportIngestHistoryRecord[];
  operationalEvidenceArchiveHistory: OperationalEvidenceArchiveHistoryRecord[];
  modelEvalHistory: ModelEvalRunRecord[];
  promptRegistryHistory: PromptRegistryHistoryRecord[];
  aiProviderGovernanceHistory: AiProviderGovernanceHistoryRecord[];
  aiActionTelemetry: AiActionTelemetryRecord[];
  aiTelemetryPolicy: AiActionTelemetryPolicy;
  aiProviderSelection: AiProviderSelection;
  localOnlyMode: boolean;

  recordRuntimeIncident: (incident: RuntimeIncidentInput) => void;
  clearRuntimeIncidents: () => void;
  recordOperationalEvidenceEvent: (event: OperationalEvidenceEventInput) => void;
  clearOperationalEvidence: () => void;
  recordSensorEvent: (event: SensorLiveEventInput) => boolean;
  clearSensorEvents: () => void;
  recordCameraMetadataEvent: (event: CameraMetadataEventInput) => boolean;
  clearCameraMetadataEvents: () => void;
  recordCameraLiveConnectionEvent: (event: CameraLiveConnectionEventInput) => boolean;
  clearCameraLiveConnectionEvents: () => void;
  recordExternalLogEntry: (entry: ExternalLogEntryInput) => void;
  clearExternalLogEntries: () => void;
  recordSupportIngestResponse: (record: SupportIngestResponse & { submittedAt?: number }) => void;
  clearSupportIngestHistory: () => void;
  recordModelEvalRun: (report: ModelEvalSuiteResult) => void;
  clearModelEvalHistory: () => void;
  recordPromptRegistrySnapshot: (source?: PromptRegistryHistorySource, note?: string | null) => void;
  clearPromptRegistryHistory: () => void;
  recordAiProviderGovernanceSnapshot: (source?: AiProviderGovernanceHistorySource, note?: string | null) => void;
  clearAiProviderGovernanceHistory: () => void;
  recordAiActionTelemetry: (record: Partial<AiActionTelemetryRecord> & { timestamp?: number }) => void;
  clearAiActionTelemetry: () => void;
  setAiProviderSelection: (selection: AiProviderSelection) => void;
  setLocalOnlyMode: (enabled: boolean) => void;
  setAiTelemetryPolicy: (policy: Partial<AiActionTelemetryPolicy>) => void;
  resetAiTelemetryPolicy: () => void;
  restoreSceneFromEvidence: (eventId: string, targetBranch?: "draft" | "recovered" | "published") => boolean;
  publishCurrentScene: () => boolean;
  exportOperationalEvidenceArchive: () => OperationalEvidenceArchive;
  importOperationalEvidenceArchive: (raw: unknown, context?: any) => { success: boolean; error?: string };
}

export function createTelemetrySlice(set: any, get: any): TelemetrySlice {
  return {
    runtimeIncidents: [],
    externalLogEntries: [],
    supportIngestHistory: [],
    operationalEvidenceArchiveHistory: [],
    modelEvalHistory: [],
    promptRegistryHistory: [],
    aiProviderGovernanceHistory: [],
    aiActionTelemetry: [],
    aiTelemetryPolicy: {} as AiActionTelemetryPolicy,
    aiProviderSelection: {} as AiProviderSelection,
    localOnlyMode: false,
    operationalEvidenceEvents: [],
    sensorEvents: [],
    cameraMetadataEvents: [],
    cameraLiveConnectionEvents: [],

    recordRuntimeIncident: (incident) =>
      set((state: any) => ({
        runtimeIncidents: [...state.runtimeIncidents, createRuntimeIncident(incident)].slice(-100),
      })),

    clearRuntimeIncidents: () => set({ runtimeIncidents: [] }),

    recordOperationalEvidenceEvent: (event) => {
      set((state: any) => {
        const evidenceEvent = buildOperationalEvidenceEvent({ ...event, source: event.source });
        const nextEvents = [...state.operationalEvidenceEvents, evidenceEvent];
        persistOperationalEvidenceEvents(nextEvents);
        return { operationalEvidenceEvents: nextEvents };
      });
    },

    clearOperationalEvidence: () => {
      persistOperationalEvidenceEvents([]);
      set((state: any) => ({
        operationalEvidenceEvents: [],
        scene: { ...state.scene, changeLog: [] },
      }));
    },

    recordSensorEvent: (event) => {
      const state = get();
      const sensor = state.scene.sensors.find((entry: any) => entry.id === event.sensorId) ?? null;
      if (!sensor) return false;

      let nearestCameraId: string | null = null;
      let nearestCameraName: string | null = null;
      let nearestDistanceM: number | null = null;
      for (const camera of state.scene.cameras) {
        const distanceM = Math.hypot(
          camera.position[0] - sensor.position[0],
          camera.position[1] - sensor.position[1],
          camera.position[2] - sensor.position[2],
        );
        if (nearestDistanceM === null || distanceM < nearestDistanceM) {
          nearestDistanceM = distanceM;
          nearestCameraId = camera.id;
          nearestCameraName = camera.name;
        }
      }

      const resultingState = event.resultingState ?? (
        event.kind === "faulted" ? "faulted" : event.kind === "restored" ? "active" : sensor.state
      );
      const nextScene = event.resultingState || event.kind === "faulted" || event.kind === "restored"
        ? cloneSecurityScene(state.scene)
        : state.scene;
      if (nextScene !== state.scene) {
        nextScene.sensors = nextScene.sensors.map((entry: any) => (
          entry.id === sensor.id ? { ...entry, state: resultingState ?? entry.state } : entry
        ));
      }
      const timestamp = event.timestamp ?? Date.now();
      const nextRecord: SensorLiveEventRecord = {
        id: makeSensorLiveEventId(timestamp),
        sceneId: state.scene.id,
        sceneName: state.scene.name,
        sensorId: sensor.id,
        sensorLabel: sensor.label,
        sensorType: sensor.sensorType,
        kind: event.kind,
        details: event.details.trim() || (event.kind === "triggered" ? "Sensor trigger observed."
          : event.kind === "heartbeat" ? "Sensor heartbeat received."
            : event.kind === "faulted" ? "Sensor fault reported." : "Sensor restored."),
        timestamp,
        resultingState,
        nearestCameraId,
        nearestCameraName,
        nearestDistanceM,
      };
      const nextSensorEvents = [nextRecord, ...state.sensorEvents].slice(0, 60);
      persistSensorLiveEvents(nextSensorEvents);

      const evidenceKindMap: Record<string, string> = {
        triggered: "sensor_triggered", heartbeat: "sensor_heartbeat",
        faulted: "sensor_faulted", restored: "sensor_restored",
      };
      const evidenceEvent = buildOperationalEvidenceEvent({
        kind: evidenceKindMap[event.kind] as any,
        title: event.kind === "triggered" ? "Sensor trigger observed"
          : event.kind === "heartbeat" ? "Sensor heartbeat received"
            : event.kind === "faulted" ? "Sensor fault reported" : "Sensor restored",
        details: nextRecord.details,
        actor: "user",
        source: state.scene.source,
        sceneId: state.scene.id,
        sceneName: state.scene.name,
        revisionDepth: state.historyPast.length,
        affectedNodeIds: nearestCameraId ? [sensor.id, nearestCameraId] : [sensor.id],
        confidence: event.kind === "heartbeat" ? 0.7 : 0.92,
        branchLabel: "simulated",
        lifecycleStage: "simulated",
        beforeSummary: summarizeSceneEvidence(state.scene).detail,
        afterSummary: summarizeSceneEvidence(state.scene).detail,
        notes: [
          `Sensor ${sensor.label} (${sensor.sensorType}) recorded a ${event.kind} event.`,
          nearestCameraName ? `Nearest camera: ${nearestCameraName}.` : "No camera nearby.",
        ],
      });
      const nextEvents = [...state.operationalEvidenceEvents, evidenceEvent];
      persistOperationalEvidenceEvents(nextEvents);
      const graph = buildSceneIntelligenceGraph(nextScene, {
        simulationResult: state.simulationResult,
        revisionDepth: state.historyPast.length,
        snapshotCount: state.snapshots.length,
        operationalEvidenceEvents: nextEvents,
      });
      set({
        operationalEvidenceEvents: nextEvents,
        sensorEvents: nextSensorEvents,
        sceneIntelligenceGraph: graph,
        scene: appendChangeLog(nextScene, evidenceLogLine(evidenceEvent)),
      });
      return true;
    },

    clearSensorEvents: () => {
      const { scene, sensorEvents } = get();
      const nextSensorEvents = sensorEvents.filter((event: any) => event.sceneId !== scene.id);
      persistSensorLiveEvents(nextSensorEvents);
      set({ sensorEvents: nextSensorEvents });
    },

    recordCameraMetadataEvent: (event) => {
      const state = get();
      const camera = state.scene.cameras.find((entry: any) => entry.id === event.cameraId) ?? null;
      if (!camera) return false;
      const timestamp = event.timestamp ?? Date.now();
      const formatCameraSnapshot = (status: any, clarity: any, nightMode: any, feedMode: any) =>
        `status ${status ?? "unknown"}, clarity ${clarity ?? "unknown"}, night mode ${nightMode ?? "unknown"}, feed mode ${feedMode ?? "unknown"}`;
      const nextRecord: CameraMetadataEventRecord = {
        id: makeCameraMetadataEventId(timestamp),
        sceneId: state.scene.id, sceneName: state.scene.name,
        cameraId: camera.id, cameraName: camera.name,
        previousStatus: event.previousStatus ?? null,
        previousClarity: event.previousClarity ?? null,
        previousNightMode: event.previousNightMode ?? null,
        previousFeedMode: event.previousFeedMode ?? null,
        previousNotes: event.previousNotes?.trim() || null,
        status: event.status ?? null, clarity: event.clarity ?? null,
        nightMode: event.nightMode ?? null, feedMode: event.feedMode ?? null,
        ingestMode: event.ingestMode,
        feedUrl: event.feedUrl ?? null, feedLabel: event.feedLabel ?? null,
        summary: event.summary.trim() || `Camera metadata updated for ${camera.name}.`,
        notes: event.notes?.trim() || null, timestamp,
      };
      const nextCameraMetadataEvents = [nextRecord, ...state.cameraMetadataEvents].slice(0, 60);
      persistCameraMetadataEvents(nextCameraMetadataEvents);

      const evidenceEvent = buildOperationalEvidenceEvent({
        kind: "camera_metadata_updated",
        title: `Camera metadata updated: ${camera.name}`,
        details: nextRecord.summary, actor: "user",
        source: state.scene.source, sceneId: state.scene.id, sceneName: state.scene.name,
        revisionDepth: state.historyPast.length, affectedNodeIds: [camera.id],
        confidence: event.ingestMode === "external" ? 0.88 : 0.92,
        branchLabel: event.ingestMode === "external" ? "external-feed" : "paste",
        lifecycleStage: event.ingestMode === "external" ? "imported" : "manual",
        beforeSummary: `Before: ${formatCameraSnapshot(
          nextRecord.previousStatus ?? camera.status, nextRecord.previousClarity ?? camera.clarity,
          nextRecord.previousNightMode ?? camera.nightMode, nextRecord.previousFeedMode,
        )}.`,
        afterSummary: `After: ${formatCameraSnapshot(
          nextRecord.status ?? camera.status, nextRecord.clarity ?? camera.clarity,
          nextRecord.nightMode ?? camera.nightMode, nextRecord.feedMode,
        )}.`,
        notes: [
          `Camera metadata ingested via ${event.ingestMode}.`,
          nextRecord.feedLabel ? `Feed label: ${nextRecord.feedLabel}.` : null,
          nextRecord.feedUrl ? `Feed URL: ${nextRecord.feedUrl}.` : null,
          nextRecord.notes ? `Notes: ${nextRecord.notes}` : null,
        ].filter((v): v is string => Boolean(v)),
      });
      const nextEvents = [...state.operationalEvidenceEvents, evidenceEvent];
      persistOperationalEvidenceEvents(nextEvents);
      const graph = buildSceneIntelligenceGraph(state.scene, {
        simulationResult: state.simulationResult,
        revisionDepth: state.historyPast.length,
        snapshotCount: state.snapshots.length,
        operationalEvidenceEvents: nextEvents,
      });
      set({
        operationalEvidenceEvents: nextEvents,
        cameraMetadataEvents: nextCameraMetadataEvents,
        sceneIntelligenceGraph: graph,
        scene: appendChangeLog(state.scene, evidenceLogLine(evidenceEvent)),
      });
      return true;
    },

    clearCameraMetadataEvents: () => {
      const { scene, cameraMetadataEvents } = get();
      const nextCameraMetadataEvents = cameraMetadataEvents.filter((event: any) => event.sceneId !== scene.id);
      persistCameraMetadataEvents(nextCameraMetadataEvents);
      set({ cameraMetadataEvents: nextCameraMetadataEvents });
    },

    recordCameraLiveConnectionEvent: (event) => {
      const state = get();
      const camera = state.scene.cameras.find((entry: any) => entry.id === event.cameraId) ?? null;
      if (!camera) return false;
      const timestamp = event.timestamp ?? Date.now();
      const fmtConn = (
        url: any, label: any, mode: any, status: any,
        aState: any, aMode: any, tStatus: any, tText: any,
        cHeader: any, cScheme: any, cRealm: any,
        eUri: any, eRef: any, eExp: any,
      ) => `status ${status ?? "unknown"}, mode ${mode ?? "unknown"}, auth ${aState ?? "unknown"} via ${aMode ?? "unknown"}, feed ${url ?? "none"}${label ? ` (${label})` : ""}${tStatus != null ? `, transport ${tStatus}${tText ? ` ${tText}` : ""}` : ""}${cHeader ? `, challenge ${cHeader}` : ""}${cScheme ? `, scheme ${cScheme}` : ""}${cRealm ? `, realm ${cRealm}` : ""}${eUri ? `, events ${eUri}` : ""}${eRef ? `, ref ${eRef}` : ""}${eExp != null ? `, expires ${new Date(eExp).toLocaleTimeString()}` : ""}`;
      const nextRecord: CameraLiveConnectionEventRecord = {
        id: makeCameraLiveConnectionEventId(timestamp),
        sceneId: state.scene.id, sceneName: state.scene.name,
        cameraId: camera.id, cameraName: camera.name,
        previousLiveSessionId: event.previousLiveSessionId ?? null,
        previousLiveSessionState: event.previousLiveSessionState ?? null,
        previousLiveSessionStartedAt: event.previousLiveSessionStartedAt ?? null,
        previousLiveSessionConfirmedAt: event.previousLiveSessionConfirmedAt ?? null,
        previousLiveSessionExpiresAt: event.previousLiveSessionExpiresAt ?? null,
        previousLiveFeedUrl: event.previousLiveFeedUrl ?? null,
        previousLiveFeedLabel: event.previousLiveFeedLabel ?? null,
        previousLiveConnectionMode: event.previousLiveConnectionMode ?? null,
        previousLiveConnectionStatus: event.previousLiveConnectionStatus ?? null,
        previousAuthMode: event.previousAuthMode ?? null,
        previousAuthState: event.previousAuthState ?? null,
        previousAuthRealm: event.previousAuthRealm ?? null,
        previousAuthSessionId: event.previousAuthSessionId ?? null,
        previousAuthSessionExpiresAt: event.previousAuthSessionExpiresAt ?? null,
        previousTransportResponseStatus: event.previousTransportResponseStatus ?? null,
        previousTransportResponseStatusText: event.previousTransportResponseStatusText ?? null,
        previousAuthChallengeHeader: event.previousAuthChallengeHeader ?? null,
        previousAuthChallengeScheme: event.previousAuthChallengeScheme ?? null,
        previousAuthChallengeRealm: event.previousAuthChallengeRealm ?? null,
        previousEventSubscriptionUri: event.previousEventSubscriptionUri ?? null,
        previousEventSubscriptionReference: event.previousEventSubscriptionReference ?? null,
        previousEventSubscriptionExpiresAt: event.previousEventSubscriptionExpiresAt ?? null,
        liveSessionId: event.liveSessionId ?? null,
        liveSessionState: event.liveSessionState ?? null,
        liveSessionStartedAt: event.liveSessionStartedAt ?? null,
        liveSessionConfirmedAt: event.liveSessionConfirmedAt ?? null,
        liveSessionExpiresAt: event.liveSessionExpiresAt ?? null,
        transportSessionId: event.transportSessionId ?? null,
        transportSessionState: event.transportSessionState ?? null,
        transportResponseStatus: event.transportResponseStatus ?? null,
        transportResponseStatusText: event.transportResponseStatusText ?? null,
        lastHeartbeatAt: event.lastHeartbeatAt ?? null,
        probeCount: event.probeCount ?? 0,
        protocolProfile: event.protocolProfile ?? null,
        authMode: event.authMode ?? null, authState: event.authState ?? null,
        authRealm: event.authRealm ?? null, authSessionId: event.authSessionId ?? null,
        authSessionExpiresAt: event.authSessionExpiresAt ?? null,
        authChallengeHeader: event.authChallengeHeader ?? null,
        authChallengeScheme: event.authChallengeScheme ?? null,
        authChallengeRealm: event.authChallengeRealm ?? null,
        eventSubscriptionUri: event.eventSubscriptionUri ?? null,
        eventSubscriptionReference: event.eventSubscriptionReference ?? null,
        eventSubscriptionExpiresAt: event.eventSubscriptionExpiresAt ?? null,
        liveFeedUrl: event.liveFeedUrl ?? null, liveFeedLabel: event.liveFeedLabel ?? null,
        liveConnectionMode: event.liveConnectionMode ?? null,
        liveConnectionStatus: event.liveConnectionStatus ?? null,
        ingestMode: event.ingestMode,
        summary: event.summary.trim() || `Live camera connection updated for ${camera.name}.`,
        notes: event.notes?.trim() || null, timestamp,
        onvifUsername: event.onvifUsername || null, onvifPassword: event.onvifPassword || null,
      };
      const nextCameraLiveConnectionEvents = [nextRecord, ...state.cameraLiveConnectionEvents].slice(0, 60);
      persistCameraLiveConnectionEvents(nextCameraLiveConnectionEvents);
      const onvifEvidence = nextRecord.liveConnectionMode === "onvif" || nextRecord.protocolProfile === "onvif_device"
        ? mapOnvifSessionToEvidenceEvent({
            sessionId: nextRecord.transportSessionId ?? nextRecord.liveSessionId ?? nextRecord.id,
            address: nextRecord.eventSubscriptionReference ?? nextRecord.eventSubscriptionUri ?? nextRecord.liveFeedUrl ?? camera.name,
            state: nextRecord.liveConnectionStatus === "connected" ? "streaming"
              : nextRecord.liveConnectionStatus === "connecting" ? "authenticating"
                : nextRecord.liveConnectionStatus === "disconnected" ? "disconnected" : "error",
            responseStatus: nextRecord.transportResponseStatus,
            responseStatusText: nextRecord.transportResponseStatusText,
            authChallengeHeader: nextRecord.authChallengeHeader,
            deviceInformation: undefined,
            eventSubscriptionUri: nextRecord.eventSubscriptionUri ?? undefined,
            eventSubscriptionReference: nextRecord.eventSubscriptionReference ?? undefined,
            eventSubscriptionExpiresAt: nextRecord.eventSubscriptionExpiresAt ?? undefined,
            mediaUri: nextRecord.liveFeedUrl ?? undefined,
            lastHeartbeatAt: nextRecord.lastHeartbeatAt ?? timestamp,
          } satisfies OnvifSession, {
            cameraId: camera.id, cameraName: camera.name,
            sceneId: state.scene.id, sceneName: state.scene.name,
            revisionDepth: state.historyPast.length,
          })
        : null;
      const evidenceEvent = buildOperationalEvidenceEvent({
        ...(onvifEvidence ?? {
          kind: "camera_live_connection_updated",
          title: `Camera live connection updated: ${camera.name}`,
          details: nextRecord.summary,
          notes: [
            `Live camera binding updated via ${event.ingestMode}.`,
            nextRecord.notes ? `Notes: ${nextRecord.notes}` : null,
          ].filter((v): v is string => Boolean(v)),
        }),
        actor: "user", source: state.scene.source,
        sceneId: state.scene.id, sceneName: state.scene.name,
        revisionDepth: state.historyPast.length, affectedNodeIds: [camera.id],
        confidence: event.ingestMode === "external" ? 0.84 : 0.91,
        branchLabel: event.ingestMode === "external" ? "external-feed" : "manual-bind",
        lifecycleStage: event.ingestMode === "external" ? "imported" : "manual",
        beforeSummary: `Before: ${fmtConn(
          nextRecord.previousLiveFeedUrl, nextRecord.previousLiveFeedLabel,
          nextRecord.previousLiveConnectionMode, nextRecord.previousLiveConnectionStatus,
          nextRecord.previousAuthState, nextRecord.previousAuthMode,
          nextRecord.previousTransportResponseStatus, nextRecord.previousTransportResponseStatusText,
          nextRecord.previousAuthChallengeHeader, nextRecord.previousAuthChallengeScheme,
          nextRecord.previousAuthChallengeRealm,
          nextRecord.previousEventSubscriptionUri, nextRecord.previousEventSubscriptionReference,
          nextRecord.previousEventSubscriptionExpiresAt,
        )}.`,
        afterSummary: `After: ${fmtConn(
          nextRecord.liveFeedUrl, nextRecord.liveFeedLabel,
          nextRecord.liveConnectionMode, nextRecord.liveConnectionStatus,
          nextRecord.authState, nextRecord.authMode,
          nextRecord.transportResponseStatus, nextRecord.transportResponseStatusText,
          nextRecord.authChallengeHeader, nextRecord.authChallengeScheme,
          nextRecord.authChallengeRealm,
          nextRecord.eventSubscriptionUri, nextRecord.eventSubscriptionReference,
          nextRecord.eventSubscriptionExpiresAt,
        )}.`,
      });
      const nextEvents = [...state.operationalEvidenceEvents, evidenceEvent];
      persistOperationalEvidenceEvents(nextEvents);
      const graph = buildSceneIntelligenceGraph(state.scene, {
        simulationResult: state.simulationResult,
        revisionDepth: state.historyPast.length,
        snapshotCount: state.snapshots.length,
        operationalEvidenceEvents: nextEvents,
      });
      set({
        operationalEvidenceEvents: nextEvents,
        cameraLiveConnectionEvents: nextCameraLiveConnectionEvents,
        sceneIntelligenceGraph: graph,
        scene: appendChangeLog(state.scene, evidenceLogLine(evidenceEvent)),
      });
      return true;
    },

    clearCameraLiveConnectionEvents: () => {
      const { scene, cameraLiveConnectionEvents } = get();
      const nextCameraLiveConnectionEvents = cameraLiveConnectionEvents.filter((event: any) => event.sceneId !== scene.id);
      persistCameraLiveConnectionEvents(nextCameraLiveConnectionEvents);
      set({ cameraLiveConnectionEvents: nextCameraLiveConnectionEvents });
    },

    recordExternalLogEntry: (entry) =>
      set((state: any) => {
        const nextEntry: ExternalLogEntry = {
          id: makeExternalLogId(Date.now()),
          timestamp: entry.timestamp ?? Date.now(),
          source: entry.source,
          title: entry.title.trim() || "External log capture",
          details: entry.details.trim() || "External log capture recorded.",
          raw: entry.raw,
          lineCount: Math.max(0, Math.round(entry.lineCount)),
          severity: entry.severity,
        };
        const nextEntries = [nextEntry, ...state.externalLogEntries].slice(0, 20);
        persistExternalLogEntries(nextEntries);
        return { externalLogEntries: nextEntries };
      }),

    clearExternalLogEntries: () => {
      persistExternalLogEntries([]);
      set({ externalLogEntries: [] });
    },

    recordSupportIngestResponse: (record) =>
      set((state: any) => {
        const nextRecord: SupportIngestHistoryRecord = {
          ...record,
          submittedAt: record.submittedAt ?? Date.now(),
          storedAt: Date.now(),
        };
        const nextHistory = [nextRecord, ...state.supportIngestHistory].slice(0, 12);
        persistSupportIngestHistory(nextHistory);
        return { supportIngestHistory: nextHistory };
      }),

    clearSupportIngestHistory: () => {
      persistSupportIngestHistory([]);
      set({ supportIngestHistory: [] });
    },

    recordModelEvalRun: (report) =>
      set((state: any) => {
        const nextHistory = [summarizeModelEvalRun(report, getCloudRequiredFixtureCount(report.fixtures)), ...state.modelEvalHistory].slice(0, 12);
        persistModelEvalHistory(nextHistory);
        const nextPromptRegistryHistory = [
          createPromptRegistryHistoryRecord(report.promptRegistry, "model_eval", "Captured from model eval run."),
          ...state.promptRegistryHistory,
        ].slice(0, 24);
        persistPromptRegistryHistory(nextPromptRegistryHistory);
        return { modelEvalHistory: nextHistory, promptRegistryHistory: nextPromptRegistryHistory };
      }),

    clearModelEvalHistory: () => {
      persistModelEvalHistory([]);
      set({ modelEvalHistory: [] });
    },

    recordPromptRegistrySnapshot: (source = "manual", note = "Manually captured registry snapshot.") =>
      set((state: any) => {
        const nextHistory = [
          createPromptRegistryHistoryRecord(buildPromptRegistrySnapshot(), source, note),
          ...state.promptRegistryHistory,
        ].slice(0, 24);
        persistPromptRegistryHistory(nextHistory);
        return { promptRegistryHistory: nextHistory };
      }),

    clearPromptRegistryHistory: () => {
      persistPromptRegistryHistory([]);
      set({ promptRegistryHistory: [] });
    },

    recordAiProviderGovernanceSnapshot: (source = "manual", note = "Manually captured provider governance snapshot.") =>
      set((state: any) => {
        const nextHistory = [
          createAiProviderGovernanceHistoryRecord(state.aiProviderSelection, state.localOnlyMode, source, note),
          ...state.aiProviderGovernanceHistory,
        ].slice(0, 24);
        persistAiProviderGovernanceHistory(nextHistory);
        return { aiProviderGovernanceHistory: nextHistory };
      }),

    clearAiProviderGovernanceHistory: () => {
      persistAiProviderGovernanceHistory([]);
      set({ aiProviderGovernanceHistory: [] });
    },

    recordAiActionTelemetry: (record) =>
      set((state: any) => {
        const r = record as any;
        const nextRecord: AiActionTelemetryRecord = {
          id: makeAiTelemetryId(),
          timestamp: r.timestamp ?? Date.now(),
          stage: r.stage, providerId: r.providerId,
          providerLabel: r.providerLabel, model: r.model,
          promptId: r.promptId ?? null, promptVersion: r.promptVersion ?? null,
          promptTitle: r.promptTitle ?? null, promptAgent: r.promptAgent ?? null,
          promptStage: r.promptStage ?? null, promptOutputSchema: r.promptOutputSchema ?? null,
          localOnlyMode: r.localOnlyMode, cloudAvailable: r.cloudAvailable,
          durationMs: Math.max(0, Math.round(r.durationMs)),
          estimatedPromptTokens: Math.max(0, Math.round(r.estimatedPromptTokens)),
          estimatedCompletionTokens: Math.max(0, Math.round(r.estimatedCompletionTokens)),
          estimatedTotalTokens: Math.max(0, Math.round(r.estimatedTotalTokens)),
          tokenSource: r.tokenSource, status: r.status,
          note: r.note ?? null,
        };
        const nextTelemetry = [nextRecord, ...state.aiActionTelemetry].slice(0, 50);
        persistAiActionTelemetry(nextTelemetry);
        return { aiActionTelemetry: nextTelemetry };
      }),

    clearAiActionTelemetry: () => {
      persistAiActionTelemetry([]);
      set({ aiActionTelemetry: [] });
    },

    setAiProviderSelection: (selection) => {
      const next = normalizeAiProviderSelection(selection);
      persistAiProviderSelection(next);
      set((state: any) => {
        const nextHistory = [
          createAiProviderGovernanceHistoryRecord(next, state.localOnlyMode, "selection", "Provider selection changed from View Settings."),
          ...state.aiProviderGovernanceHistory,
        ].slice(0, 24);
        persistAiProviderGovernanceHistory(nextHistory);
        return { aiProviderSelection: next, aiProviderGovernanceHistory: nextHistory };
      });
    },

    setLocalOnlyMode: (enabled) => {
      persistLocalOnlyMode(enabled);
      set((state: any) => {
        const nextHistory = [
          createAiProviderGovernanceHistoryRecord(state.aiProviderSelection, enabled, "policy",
            enabled ? "Local-only policy enabled." : "Local-only policy disabled."),
          ...state.aiProviderGovernanceHistory,
        ].slice(0, 24);
        persistAiProviderGovernanceHistory(nextHistory);
        return { localOnlyMode: enabled, aiProviderGovernanceHistory: nextHistory };
      });
    },

    setAiTelemetryPolicy: (policy) => {
      set((state: any) => {
        const nextPolicy = normalizeAiActionTelemetryPolicy({ ...state.aiTelemetryPolicy, ...policy });
        persistAiTelemetryPolicy(nextPolicy);
        return { aiTelemetryPolicy: nextPolicy };
      });
    },

    resetAiTelemetryPolicy: () => {
      const nextPolicy = { ...DEFAULT_AI_ACTION_TELEMETRY_POLICY };
      persistAiTelemetryPolicy(nextPolicy);
      set({ aiTelemetryPolicy: nextPolicy });
    },

    restoreSceneFromEvidence: (eventId, targetBranch = "recovered") => {
      const state = get();
      const { operationalEvidenceEvents, scene, historyPast } = state;
      const sourceEvent = operationalEvidenceEvents.find((event: any) => event.id === eventId) ?? null;
      const restoredScene = resolveOperationalEvidenceRestoreScene(sourceEvent)
        ?? reconstructSceneFromEvidence(operationalEvidenceEvents, eventId);
      if (!restoredScene) return false;

      const evidenceEvent = buildOperationalEvidenceEvent({
        kind: "scene_reverted",
        title: sourceEvent ? `Restored checkpoint: ${sourceEvent.title}` : "Restored checkpoint",
        details: sourceEvent
          ? `Reopened scene state from checkpoint "${sourceEvent.title}".`
          : "Reopened scene state from the selected checkpoint.",
        actor: "user", source: restoredScene.source,
        sceneId: restoredScene.id, sceneName: restoredScene.name,
        revisionDepth: historyPast.length + 1,
        affectedNodeIds: sourceEvent?.affectedNodeIds ?? [],
        confidence: sourceEvent?.confidence ?? 0.9,
        parentEventId: sourceEvent?.id,
        branchLabel: targetBranch, lifecycleStage: targetBranch,
        beforeSummary: summarizeSceneEvidence(scene).detail,
        afterSummary: summarizeSceneEvidence(restoredScene).detail,
        sceneSnapshot: cloneSecurityScene(restoredScene),
        notes: sourceEvent
          ? [`Restored from checkpoint ${sourceEvent.id} into ${targetBranch} branch.`]
          : [`Restored into ${targetBranch} branch.`],
      });
      const nextEvents = [...operationalEvidenceEvents, evidenceEvent];
      persistOperationalEvidenceEvents(nextEvents);
      const nextGovernance: any = {
        ...resetWorkspaceGovernanceForDraft(get().workspaceGovernance),
        sceneStatus: targetBranch,
      };
      if (targetBranch === "published") {
        nextGovernance.publishedAt = Date.now();
        nextGovernance.publishedBy = get().workspaceGovernance.activeRole;
      }
      const nextScene = appendChangeLog(restoredScene, evidenceLogLine(evidenceEvent));
      const nextCameraId = restoredScene.cameras[0]?.id ?? null;
      set({
        scene: nextScene,
        snapshots: structuredClone(restoredScene.snapshots ?? []),
        simulationResult: restoredScene.simulation ?? null,
        simulationDirty: !restoredScene.simulation,
        selectedNodeId: null, selectedNodeIds: [],
        selectedCameraId: nextCameraId, activePathId: null,
        focusScenePointRequest: null, focusScenePointHighlight: null,
        mapState: cloneDefaultMapState(),
        historyPast: [...historyPast, cloneSecurityScene(scene)],
        historyFuture: [],
        sceneIntelligenceGraph: buildSceneIntelligenceGraph(restoredScene, {
          simulationResult: restoredScene.simulation ?? null,
          revisionDepth: historyPast.length + 1,
          snapshotCount: (restoredScene.snapshots ?? []).length,
        }),
        operationalEvidenceEvents: nextEvents,
        workspaceGovernance: nextGovernance,
      });
      return true;
    },

    publishCurrentScene: () => {
      const state = get();
      const { scene, historyPast, operationalEvidenceEvents, savedProjects, workspaceGovernance, workspaceAccess } = state;
      const previousEvent = findLatestOperationalEvidenceEventForScene(operationalEvidenceEvents, scene.id)
        ?? operationalEvidenceEvents.at(-1) ?? null;
      const now = Date.now();
      const accessDecision = canPerformWorkspaceAction(workspaceAccess, scene, "publish", workspaceGovernance);
      const accessRoute = routeWorkspaceApproval(scene, workspaceAccess);
      if (!accessDecision.allowed) {
        if (workspaceGovernance.sceneStatus === "review_requested") return false;
        const requestEvent = buildOperationalEvidenceEvent({
          kind: "scene_review_requested",
          title: "Publish blocked by access policy",
          details: accessDecision.reason, actor: "user",
          source: scene.source, sceneId: scene.id, sceneName: scene.name,
          revisionDepth: historyPast.length,
          affectedNodeIds: scene.cameras.map((c: any) => c.id),
          confidence: 0.88, branchLabel: "review", lifecycleStage: "review",
          parentEventId: previousEvent?.id ?? undefined,
          beforeSummary: summarizeSceneEvidence(scene).detail,
          afterSummary: summarizeSceneEvidence(scene).detail,
          notes: [
            "Publish was gated by workspace access policy and converted into a review request.",
            `Access route resolved to ${accessRoute.requiredReviewerRole.replace(/_/g, " ")}.`,
          ],
        });
        const nextEvents = [...operationalEvidenceEvents, requestEvent];
        persistOperationalEvidenceEvents(nextEvents);
        const nextGovernance: any = {
          ...workspaceGovernance,
          sceneStatus: "review_requested", requestedAt: now,
          requestedBy: workspaceGovernance.activeRole,
          reviewedAt: null, reviewedBy: null, publishedAt: null, publishedBy: null,
        };
        set({
          operationalEvidenceEvents: nextEvents, workspaceGovernance: nextGovernance,
          scene: appendChangeLog(scene, evidenceLogLine(requestEvent)),
        });
        return false;
      }

      const existingIndex = savedProjects.findIndex((record: any) => record.scene.id === scene.id);
      const nextProjects: any[] = [...savedProjects];
      if (existingIndex >= 0) {
        const existing = nextProjects[existingIndex];
        nextProjects[existingIndex] = {
          ...existing,
          scene: cloneSecurityScene(scene),
          tags: sanitizeTags([...existing.tags, "published",
            workspaceGovernance.sceneStatus === "approved" ? "approved" : "published"]),
          updatedAt: now, lastOpenedAt: now,
          workspaceOrganization: existing.workspaceOrganization,
          workspaceOwner: existing.workspaceOwner,
          workspaceVisibility: existing.workspaceVisibility,
        };
      } else {
        nextProjects.unshift({
          scene: cloneSecurityScene(scene),
          folder: "Published",
          tags: sanitizeTags([scene.source, "published",
            workspaceGovernance.sceneStatus === "approved" ? "approved" : undefined]),
          pinned: false, createdAt: now, updatedAt: now, lastOpenedAt: now,
          workspaceOrganization: normalizeWorkspaceOrganization(undefined, scene.source),
          workspaceOwner: normalizeWorkspaceOwner(undefined, scene.source),
          workspaceVisibility: normalizeWorkspaceVisibility(undefined, scene.source),
        });
      }
      try { localStorage.setItem(PROJECT_STORAGE_KEY, JSON.stringify(nextProjects)); } catch {}

      const evidenceEvent = buildOperationalEvidenceEvent({
        kind: "scene_published", title: "Scene published",
        details: "Promoted the current scene state to the published branch.",
        actor: "user", source: scene.source,
        sceneId: scene.id, sceneName: scene.name,
        revisionDepth: historyPast.length,
        affectedNodeIds: scene.cameras.map((c: any) => c.id),
        confidence: 0.98, branchLabel: "published", lifecycleStage: "published",
        parentEventId: previousEvent?.id ?? undefined, published: true,
        beforeSummary: summarizeSceneEvidence(scene).detail,
        afterSummary: summarizeSceneEvidence(scene).detail,
        sceneSnapshot: cloneSecurityScene(scene),
        notes: [
          "Published state stored as a reusable workspace checkpoint.",
          `Workspace role at publish time: ${workspaceGovernance.activeRole}.`,
          `Access route: ${accessRoute.requiredReviewerRole.replace(/_/g, " ")}.`,
        ],
      });
      const nextEvents = [...operationalEvidenceEvents, evidenceEvent];
      persistOperationalEvidenceEvents(nextEvents);
      const nextGovernance: any = {
        ...workspaceGovernance,
        sceneStatus: "published", publishedAt: now,
        publishedBy: workspaceGovernance.activeRole,
      };
      set({
        operationalEvidenceEvents: nextEvents,
        scene: appendChangeLog(scene, evidenceLogLine(evidenceEvent)),
        sceneModified: false, savedSceneName: scene.name,
        savedProjects: nextProjects, workspaceGovernance: nextGovernance,
        sceneIntelligenceGraph: buildSceneIntelligenceGraph(scene, {
          simulationResult: get().simulationResult,
          revisionDepth: historyPast.length,
          snapshotCount: get().snapshots.length,
        }),
      });
      return true;
    },

    exportOperationalEvidenceArchive: () => {
      const state = get();
      const archive = buildOperationalEvidenceArchive({
        scene: state.scene,
        simulationResult: state.simulationResult,
        sceneIntelligenceGraph: state.sceneIntelligenceGraph,
        operationalEvidenceEvents: state.operationalEvidenceEvents,
        operationalEvidenceJournal: loadOperationalEvidenceJournalFromRaw(
          typeof window === "undefined" ? null : window.localStorage.getItem(OPERATIONAL_EVIDENCE_STORAGE_KEY)
        ),
        workspaceGovernance: state.workspaceGovernance,
        workspaceAccess: state.workspaceAccess,
        workspaceAccount: state.workspaceAccount,
      });

      if (typeof window !== "undefined") {
        const historyId = archive.operationalEvidenceEvents.at(-1)?.id
          ?? `${archive.scene.id}:${archive.exportedAt}`;
        const nextHistory = [
          createOperationalEvidenceArchiveHistoryRecord(archive, "draft"),
          ...state.operationalEvidenceArchiveHistory.filter(
            (record: any) => record.historyId !== historyId
          ),
        ].slice(0, 8);
        persistOperationalEvidenceArchiveHistory(nextHistory);
        set({ operationalEvidenceArchiveHistory: nextHistory });
      }

      return archive;
    },

    importOperationalEvidenceArchive: (raw, context) => {
      const startedAt = performance.now();
      const archive = normalizeOperationalEvidenceArchive(raw);
      if (!archive) {
        get().recordRuntimeIncident({
          category: "data_validation_error", severity: "warning",
          title: "Archive import rejected",
          details: "Invalid operational evidence archive.",
          action: "import_archive", path: "/studio",
        });
        return { success: false, error: "Invalid operational evidence archive" };
      }

      const currentState = get();
      const currentHead = currentState.operationalEvidenceEvents.at(-1) ?? null;
      const archiveHead = archive.operationalEvidenceEvents.at(-1) ?? null;
      const layout = buildPresetDockLayout("edit");

      if (!currentHead || !archiveHead) {
        const restoredScene = cloneSecurityScene(archive.scene);
        const priorEvents = normalizeOperationalEvidenceEvents(archive.operationalEvidenceEvents);
        const previousEvent = priorEvents.at(-1) ?? null;
        const restoreEvent = createArchiveRestoreEvent(archive, restoredScene, previousEvent?.id, {
          archiveExportedAt: context?.archiveExportedAt,
          archiveRestoreBranch: context?.archiveRestoreBranch,
        });
        const nextEvents = [...priorEvents, restoreEvent];
        const nextCameraId = restoredScene.cameras[0]?.id ?? null;
        persistOperationalEvidenceEvents(nextEvents);
        if (archive.operationalEvidenceJournal && typeof window !== "undefined") {
          window.localStorage.setItem(OPERATIONAL_EVIDENCE_STORAGE_KEY, JSON.stringify(archive.operationalEvidenceJournal));
        }
        const nextAccess = normalizeWorkspaceAccessState(archive.workspaceAccess);
        const nextAccount = normalizeWorkspaceAccountProfile(archive.workspaceAccount, {
          primaryOrganization: restoredScene.source === "demo" ? "SentinelTwin Reference" : "Personal Workspace",
          primaryOwner: restoredScene.source === "demo" ? "SentinelTwin" : "You",
          capabilities: {
            sharedWorkspaces: restoredScene.cameras.length + restoredScene.obstructions.length + restoredScene.criticalZones.length > 0,
            publishedWorkspaces: restoredScene.source === "demo",
            archiveRecovery: true, reportExports: true, scanIntake: true, liveEvidence: false,
          },
          workspaceCount: restoredScene.snapshots.length,
        });
        const nextGovernance = {
          ...normalizeWorkspaceGovernance(archive.workspaceGovernance),
          activeRole: getActiveWorkspaceMember(nextAccess)?.role
            ?? normalizeWorkspaceGovernance(archive.workspaceGovernance).activeRole,
        };
        if (typeof window !== "undefined") {
          const archiveHistoryKey = archiveHead?.id ?? archive.scene.id;
          const nextArchiveHistory = [
            createOperationalEvidenceArchiveHistoryRecord(archive, "recovered"),
            ...get().operationalEvidenceArchiveHistory.filter(
              (record: any) => record.historyId !== archiveHistoryKey
            ),
          ].slice(0, 8);
          persistOperationalEvidenceArchiveHistory(nextArchiveHistory);
          set({ operationalEvidenceArchiveHistory: nextArchiveHistory });
        }
        const sceneWithLog = appendChangeLog(restoredScene, evidenceLogLine(restoreEvent));
        set({
          simulationResult: archive.simulationResult ? structuredClone(archive.simulationResult) : restoredScene.simulation ?? null,
          simulationDirty: !archive.simulationResult && !restoredScene.simulation,
          snapshots: structuredClone(restoredScene.snapshots ?? []),
          selectedNodeId: null, selectedNodeIds: [],
          selectedCameraId: nextCameraId, activePathId: null,
          focusScenePointRequest: null, focusScenePointHighlight: null,
          mapState: cloneDefaultMapState(), focusMode: false, previousLayout: null,
          viewMode: layout.viewMode, workspacePreset: layout.workspacePreset,
          canvasMode: layout.canvasMode,
          leftDockCollapsed: layout.leftDockCollapsed,
          rightDockCollapsed: layout.rightDockCollapsed,
          bottomDockCollapsed: layout.bottomDockCollapsed,
          leftDockSizePx: layout.leftDockSizePx,
          rightDockSizePx: layout.rightDockSizePx,
          bottomDockSizePx: layout.bottomDockSizePx,
          visibleComponents: { ...layout.visibleComponents },
          enabledAnalysisModules: { ...layout.enabledAnalysisModules },
          layerVisibility: { ...layout.layerVisibility },
          rightPanelMode: layout.rightPanelMode,
          bottomDrawerMode: layout.bottomDrawerMode,
          pinnedAnalysisModule: layout.pinnedAnalysisModule,
          overlayDensity: layout.overlayDensity,
          showDebugOverlays: layout.showDebugOverlays,
          clientDemoOptions: { ...layout.clientDemoOptions },
          bottomTab: "metrics", inspectorTab: "properties", activeTool: "select",
          historyPast: [], historyFuture: [],
          sceneIntelligenceGraph: buildSceneIntelligenceGraph(restoredScene, {
            simulationResult: archive.simulationResult ?? restoredScene.simulation ?? null,
            revisionDepth: 0,
            snapshotCount: restoredScene.snapshots.length,
          }),
          compareVisualEvidence: null, compareReportSelection: null,
          operationalEvidenceEvents: nextEvents,
          workspaceAccess: nextAccess, workspaceAccount: nextAccount,
          workspaceGovernance: nextGovernance,
          sceneModified: false, savedSceneName: restoredScene.name,
          scene: sceneWithLog,
        });
        get().recordRuntimeIncident({
          category: "performance_trace", severity: "info",
          title: "Archive restored",
          details: `Archive restored in ${Math.round(performance.now() - startedAt)} ms.`,
          durationMs: Math.round(performance.now() - startedAt),
          action: "import_archive", path: "/studio",
        });
        return { success: true };
      }

      const combinedEvents = [
        ...currentState.operationalEvidenceEvents,
        ...archive.operationalEvidenceEvents,
      ];
      const comparison = compareOperationalEvidenceBranches(
        combinedEvents, currentHead.id, archiveHead.id
      );
      const readiness = comparison ? assessOperationalEvidenceMergeReadiness(comparison) : null;
      if (!comparison || !readiness) {
        get().recordRuntimeIncident({
          category: "data_validation_error", severity: "warning",
          title: "Archive merge preflight failed",
          details: "Merge preflight could not compare the archive branch.",
          action: "import_archive", path: "/studio",
        });
        return { success: false, error: "Archive restore failed: merge preflight unavailable." };
      }

      if (readiness.status === "unrelated" || readiness.status === "fast_forward_right") {
        get().recordRuntimeIncident({
          category: "user_error", severity: "warning",
          title: "Archive restore blocked", details: readiness.recommendation,
          action: "import_archive", path: "/studio",
        });
        return { success: false, error: `Archive restore failed: ${readiness.recommendation}` };
      }

      if (readiness.status === "diverged") {
        const mergeResult = mergeOperationalEvidenceBranchScenes(comparison);
        if (!mergeResult) {
          get().recordRuntimeIncident({
            category: "runtime_failure", severity: "error",
            title: "Archive merge failed",
            details: "No common ancestor could be reconstructed.",
            action: "import_archive", path: "/studio",
          });
          return { success: false, error: "Archive merge failed: no common ancestor could be reconstructed." };
        }

        if (mergeResult.conflicts.length > 0) {
          get().recordRuntimeIncident({
            category: "user_error", severity: "warning",
            title: "Archive merge conflicts",
            details: `${mergeResult.conflicts.length} conflict${mergeResult.conflicts.length === 1 ? "" : "s"} must be resolved before applying.`,
            action: "import_archive", path: "/studio",
          });
          return { success: false, error: `Archive merge failed: ${mergeResult.conflicts.length} conflict${mergeResult.conflicts.length === 1 ? "" : "s"} must be resolved before applying.` };
        }

        const mergedScene = cloneSecurityScene(mergeResult.mergedScene);
        const currentBranchId = currentHead.branchId ?? currentState.scene.id;
        const archiveBranchId = archiveHead.branchId ?? archive.scene.id;
        const nextAccess = normalizeWorkspaceAccessState(archive.workspaceAccess);
        const nextAccount = normalizeWorkspaceAccountProfile(archive.workspaceAccount, {
          primaryOrganization: mergedScene.source === "demo" ? "SentinelTwin Reference" : "Personal Workspace",
          primaryOwner: mergedScene.source === "demo" ? "SentinelTwin" : "You",
          capabilities: {
            sharedWorkspaces: mergedScene.cameras.length + mergedScene.obstructions.length + mergedScene.criticalZones.length > 0,
            publishedWorkspaces: mergedScene.source === "demo",
            archiveRecovery: true, reportExports: true, scanIntake: true, liveEvidence: false,
          },
          workspaceCount: mergedScene.snapshots.length,
        });
        const archiveExportedAt = context?.archiveExportedAt ?? archive.exportedAt;
        const archiveRestoreBranch = context?.archiveRestoreBranch ?? "recovered";
        const mergeEvent = buildOperationalEvidenceEvent({
          kind: "scene_merged", title: "Operational archive merged",
          details: `Merged divergent branches ${currentBranchId} and ${archiveBranchId} into the current workspace.`,
          actor: "user", source: currentState.scene.source,
          sceneId: mergedScene.id, sceneName: mergedScene.name,
          revisionDepth: combinedEvents.length + 1,
          affectedNodeIds: [], confidence: 0.96,
          branchId: `${mergedScene.id}:merged`, branchLabel: "merged",
          lifecycleStage: "review", parentEventId: currentHead.id,
          beforeSummary: summarizeSceneEvidence(currentState.scene).detail,
          afterSummary: summarizeSceneEvidence(mergedScene).detail,
          previousSceneSnapshot: cloneSecurityScene(currentState.scene),
          sceneSnapshot: cloneSecurityScene(mergedScene),
          notes: [
            `Merged archive branch ${archiveBranchId} against current branch ${currentBranchId}.`,
            `Requested archive restore branch: ${archiveRestoreBranch}.`,
            `Archive export time: ${archiveExportedAt}.`,
            `Common ancestor: ${comparison.commonAncestor?.event.id ?? "unknown"}.`,
          ],
          archiveExportedAt, archiveRestoreBranch,
        });

        const nextEvents = [...combinedEvents, mergeEvent];
        persistOperationalEvidenceEvents(nextEvents);
        const nextGovernance = {
          ...resetWorkspaceGovernanceForDraft(currentState.workspaceGovernance),
          sceneStatus: "draft" as const,
          activeRole: getActiveWorkspaceMember(nextAccess)?.role
            ?? currentState.workspaceGovernance.activeRole,
        };
        if (typeof window !== "undefined") {
          const nextArchiveHistory = [
            createOperationalEvidenceArchiveHistoryRecord(archive, "draft"),
            ...get().operationalEvidenceArchiveHistory.filter(
              (record: any) => record.historyId !== archiveHead.id
            ),
          ].slice(0, 8);
          persistOperationalEvidenceArchiveHistory(nextArchiveHistory);
          set({ operationalEvidenceArchiveHistory: nextArchiveHistory });
        }
        const mergedSceneWithLog = appendChangeLog(mergedScene, evidenceLogLine(mergeEvent));
        set({
          selectedCameraId: mergedScene.cameras[0]?.id ?? null, scene: mergedSceneWithLog,
          simulationResult: null, simulationDirty: true,
          snapshots: structuredClone(mergedScene.snapshots ?? []),
          selectedNodeId: null, selectedNodeIds: [], activePathId: null,
          focusScenePointRequest: null, focusScenePointHighlight: null,
          mapState: cloneDefaultMapState(), focusMode: false, previousLayout: null,
          viewMode: layout.viewMode, workspacePreset: layout.workspacePreset,
          canvasMode: layout.canvasMode,
          leftDockCollapsed: layout.leftDockCollapsed,
          rightDockCollapsed: layout.rightDockCollapsed,
          bottomDockCollapsed: layout.bottomDockCollapsed,
          leftDockSizePx: layout.leftDockSizePx,
          rightDockSizePx: layout.rightDockSizePx,
          bottomDockSizePx: layout.bottomDockSizePx,
          visibleComponents: { ...layout.visibleComponents },
          enabledAnalysisModules: { ...layout.enabledAnalysisModules },
          layerVisibility: { ...layout.layerVisibility },
          rightPanelMode: layout.rightPanelMode,
          bottomDrawerMode: layout.bottomDrawerMode,
          pinnedAnalysisModule: layout.pinnedAnalysisModule,
          overlayDensity: layout.overlayDensity,
          showDebugOverlays: layout.showDebugOverlays,
          clientDemoOptions: { ...layout.clientDemoOptions },
          bottomTab: "metrics", inspectorTab: "properties", activeTool: "select",
          historyPast: [], historyFuture: [],
          sceneIntelligenceGraph: buildSceneIntelligenceGraph(mergedScene, {
            simulationResult: null, revisionDepth: 0, snapshotCount: mergedScene.snapshots.length,
          }),
          compareVisualEvidence: null, compareReportSelection: null,
          operationalEvidenceEvents: nextEvents,
          workspaceAccess: nextAccess, workspaceAccount: nextAccount,
          workspaceGovernance: nextGovernance,
          sceneModified: false, savedSceneName: mergedScene.name,
        });
        get().recordRuntimeIncident({
          category: "performance_trace", severity: "info",
          title: "Archive merged",
          details: `Diverged archive merged in ${Math.round(performance.now() - startedAt)} ms.`,
          durationMs: Math.round(performance.now() - startedAt),
          action: "import_archive", path: "/studio",
        });
        return { success: true };
      }

      const restoredScene = cloneSecurityScene(archive.scene);
      const nextCameraId = restoredScene.cameras[0]?.id ?? null;
      const priorEvents = normalizeOperationalEvidenceEvents(archive.operationalEvidenceEvents);
      const previousEvent = priorEvents.at(-1) ?? null;
      const restoreEvent = createArchiveRestoreEvent(archive, restoredScene, previousEvent?.id, {
        archiveExportedAt: context?.archiveExportedAt,
        archiveRestoreBranch: context?.archiveRestoreBranch,
      });
      const nextEvents = [...priorEvents, restoreEvent];
      persistOperationalEvidenceEvents(nextEvents);
      if (archive.operationalEvidenceJournal && typeof window !== "undefined"
        && (readiness.status === "same" || readiness.status === "fast_forward_left")) {
        window.localStorage.setItem(OPERATIONAL_EVIDENCE_STORAGE_KEY, JSON.stringify(archive.operationalEvidenceJournal));
      }
      const nextAccess = normalizeWorkspaceAccessState(archive.workspaceAccess);
      const nextGovernance = {
        ...normalizeWorkspaceGovernance(archive.workspaceGovernance),
        activeRole: getActiveWorkspaceMember(nextAccess)?.role
          ?? normalizeWorkspaceGovernance(archive.workspaceGovernance).activeRole,
      };
      const sceneWithLog = appendChangeLog(restoredScene, evidenceLogLine(restoreEvent));
      set({
        simulationResult: archive.simulationResult ? structuredClone(archive.simulationResult) : restoredScene.simulation ?? null,
        simulationDirty: !archive.simulationResult && !restoredScene.simulation,
        snapshots: structuredClone(restoredScene.snapshots ?? []),
        selectedNodeId: null, selectedNodeIds: [],
        selectedCameraId: nextCameraId, activePathId: null,
        focusScenePointRequest: null, focusScenePointHighlight: null,
        mapState: cloneDefaultMapState(), focusMode: false, previousLayout: null,
        viewMode: layout.viewMode, workspacePreset: layout.workspacePreset,
        canvasMode: layout.canvasMode,
        leftDockCollapsed: layout.leftDockCollapsed,
        rightDockCollapsed: layout.rightDockCollapsed,
        bottomDockCollapsed: layout.bottomDockCollapsed,
        leftDockSizePx: layout.leftDockSizePx,
        rightDockSizePx: layout.rightDockSizePx,
        bottomDockSizePx: layout.bottomDockSizePx,
        visibleComponents: { ...layout.visibleComponents },
        enabledAnalysisModules: { ...layout.enabledAnalysisModules },
        layerVisibility: { ...layout.layerVisibility },
        rightPanelMode: layout.rightPanelMode,
        bottomDrawerMode: layout.bottomDrawerMode,
        pinnedAnalysisModule: layout.pinnedAnalysisModule,
        overlayDensity: layout.overlayDensity,
        showDebugOverlays: layout.showDebugOverlays,
        clientDemoOptions: { ...layout.clientDemoOptions },
        bottomTab: "metrics", inspectorTab: "properties", activeTool: "select",
        historyPast: [], historyFuture: [],
        sceneIntelligenceGraph: buildSceneIntelligenceGraph(restoredScene, {
          simulationResult: archive.simulationResult ?? restoredScene.simulation ?? null,
          revisionDepth: 0, snapshotCount: restoredScene.snapshots.length,
        }),
        compareVisualEvidence: null, compareReportSelection: null,
        operationalEvidenceEvents: nextEvents,
        workspaceAccess: nextAccess, workspaceGovernance: nextGovernance,
        sceneModified: false, savedSceneName: restoredScene.name,
        scene: sceneWithLog,
      });
      get().recordRuntimeIncident({
        category: "performance_trace", severity: "info",
        title: "Archive restored",
        details: `Archive restored in ${Math.round(performance.now() - startedAt)} ms.`,
        durationMs: Math.round(performance.now() - startedAt),
        action: "import_archive", path: "/studio",
      });
      return { success: true };
    },
  };
}
