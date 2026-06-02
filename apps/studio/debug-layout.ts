import { DEFAULT_LAYERS, getPresetLayoutSnapshot, normalizeSavedLayoutRecords, LAYOUT_STORAGE_VERSION, buildSeededLayouts } from "@/lib/workspace-layouts";

const LAYOUT_STORAGE_KEY = "sentineltwin_workspace_layouts";
const LEGACY_LAYOUT_STORAGE_KEY = "sentineltwin_saved_layouts_v1";

const memory: Record<string, string> = {};
const storage: Storage = {
  getItem: (key: string) => memory[key] ?? null,
  setItem: (key: string, value: string) => { memory[key] = value; },
  removeItem: (key: string) => { delete memory[key]; },
  clear: () => { for (const key of Object.keys(memory)) delete memory[key]; },
  key: (index: number) => Object.keys(memory)[index] ?? null,
  length: 0,
};
Object.defineProperty(globalThis, "localStorage", { value: storage, writable: true, configurable: true });

const WORKSPACE_PRESETS: string[] = ["edit","coverage","camera_wall","replay","compare","report","debug","focus"];

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function parseStoragePayload(raw: string | null): unknown {
  if (raw == null) return undefined;
  try { return JSON.parse(raw); } catch { return undefined; }
}

function normalizeStoredLayouts(raw: unknown, fallbackTime = Date.now()): any[] {
  const parsed = normalizeSavedLayoutRecords(raw);
  const normalized = parsed
    .filter((layout: any) => WORKSPACE_PRESETS.includes(layout.workspacePreset))
    .map((layout: any) => ({
      ...layout,
      schemaVersion: LAYOUT_STORAGE_VERSION,
      name: layout.name.trim(),
      createdAt: Number.isFinite(layout.createdAt) ? layout.createdAt : fallbackTime,
    }));
  return normalized.length > 0 ? normalized : buildSeededLayouts(fallbackTime);
}

function readStoredLayoutPayload(raw: unknown, fallbackTime: number): any[] {
  if (isPlainObject(raw) && raw !== null && typeof raw === "object") {
    if (Array.isArray((raw as any).layouts)) {
      return normalizeStoredLayouts((raw as any).layouts, fallbackTime);
    }
  }
  if (Array.isArray(raw)) return normalizeStoredLayouts(raw, fallbackTime);
  return buildSeededLayouts(fallbackTime);
}

function loadLayoutsFromStorageReplica(): any[] {
  const fallbackTime = Date.now();
  try {
    const legacyValue = localStorage.getItem(LEGACY_LAYOUT_STORAGE_KEY);
    const modernValue = localStorage.getItem(LAYOUT_STORAGE_KEY);
    const source = modernValue ?? legacyValue;
    const parsed = parseStoragePayload(source);
    const normalized = readStoredLayoutPayload(parsed, fallbackTime);
    const next = normalized.length > 0 ? normalized : buildSeededLayouts(fallbackTime);
    return next;
  } catch (e) {
    console.log("ERROR in loadLayoutsFromStorage:", e);
    const fallback = buildSeededLayouts(Date.now());
    return fallback;
  }
}

console.log("=== TEST via replica ===");
console.log("typeof window:", typeof window);

localStorage.setItem(LAYOUT_STORAGE_KEY, JSON.stringify([
  { id: "legacy_bad", name: "   ", workspacePreset: "coverage", viewMode: "invalid-view", leftDockCollapsed: "not-a-bool", rightDockCollapsed: 123 },
]));

console.log("localStorage has key:", localStorage.getItem(LAYOUT_STORAGE_KEY)?.slice(0, 60));

const result = loadLayoutsFromStorageReplica();
console.log("replica result count:", result.length);
console.log("replica result:", JSON.stringify(result.map((l: any) => ({ id: l.id, name: l.name }))));
console.log("has legacy_bad:", result.some((l: any) => l.id === "legacy_bad"));

localStorage.clear();
