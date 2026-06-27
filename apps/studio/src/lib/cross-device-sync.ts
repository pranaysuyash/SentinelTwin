import type { SecurityScene } from "@/schema/security-scene";
import type { SavedProjectRecord } from "@/store/studio-store";

const SYNC_STORAGE_KEY = "sentineltwin.sync.v1";
const SYNC_CHANNEL = "sentineltwin-cross-device";

export type SyncEvent = {
  id: string;
  type: "project_updated" | "project_created" | "project_deleted" | "scene_shared" | "collaborator_added" | "collaborator_removed";
  projectId: string;
  userId: string;
  timestamp: number;
  payload: Record<string, unknown>;
};

export type CrossDeviceState = {
  lastSyncAt: number | null;
  pendingEvents: SyncEvent[];
  knownDevices: string[];
};

type BroadcastMessage = {
  type: "sync";
  events: SyncEvent[];
  deviceId: string;
  timestamp: number;
};

let deviceId: string | null = null;

function getDeviceId(): string {
  if (!deviceId) {
    deviceId = `device_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  }
  return deviceId;
}

function loadSyncState(): CrossDeviceState {
  if (typeof localStorage === "undefined") return { lastSyncAt: null, pendingEvents: [], knownDevices: [] };
  try {
    const raw = localStorage.getItem(SYNC_STORAGE_KEY);
    return raw ? JSON.parse(raw) : { lastSyncAt: null, pendingEvents: [], knownDevices: [] };
  } catch {
    return { lastSyncAt: null, pendingEvents: [], knownDevices: [] };
  }
}

function saveSyncState(state: CrossDeviceState): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(SYNC_STORAGE_KEY, JSON.stringify(state));
  } catch {}
}

export function createSyncEvent(
  type: SyncEvent["type"],
  projectId: string,
  userId: string,
  payload: Record<string, unknown> = {},
): SyncEvent {
  return {
    id: `sync_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    type,
    projectId,
    userId,
    timestamp: Date.now(),
    payload,
  };
}

export function broadcastSyncEvent(event: SyncEvent): void {
  const state = loadSyncState();
  state.pendingEvents.push(event);
  saveSyncState(state);

  if (typeof BroadcastChannel !== "undefined") {
    try {
      const channel = new BroadcastChannel(SYNC_CHANNEL);
      const message: BroadcastMessage = {
        type: "sync",
        events: [event],
        deviceId: getDeviceId(),
        timestamp: Date.now(),
      };
      channel.postMessage(message);
    } catch {}
  }
}

export function subscribeToSyncEvents(onEvent: (event: SyncEvent) => void): () => void {
  if (typeof BroadcastChannel === "undefined") return () => {};

  const channel = new BroadcastChannel(SYNC_CHANNEL);
  const handler = (message: MessageEvent) => {
    const data = message.data as BroadcastMessage;
    if (data?.type === "sync" && data.deviceId !== getDeviceId()) {
      for (const event of data.events) {
        onEvent(event);
      }
    }
  };
  channel.addEventListener("message", handler);
  return () => channel.removeEventListener("message", handler);
}

export function syncProjectToDevices(
  project: SavedProjectRecord,
  userId: string,
): void {
  const event = createSyncEvent("project_updated", project.scene.id, userId, {
    sceneId: project.scene.id,
    sceneName: project.scene.name,
    updatedAt: project.updatedAt,
  });
  broadcastSyncEvent(event);
}

export function mergeRemoteProjects(
  localProjects: SavedProjectRecord[],
  remoteProjects: SavedProjectRecord[],
): SavedProjectRecord[] {
  const merged = new Map<string, SavedProjectRecord>();
  for (const p of localProjects) merged.set(p.scene.id, p);
  for (const p of remoteProjects) {
    const existing = merged.get(p.scene.id);
    if (!existing || p.updatedAt > existing.updatedAt) {
      merged.set(p.scene.id, p);
    }
  }
  return [...merged.values()].sort((a, b) => b.updatedAt - a.updatedAt);
}
