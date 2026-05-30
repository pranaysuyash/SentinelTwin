import {
  getReportExportPresets,
  getReportStandardTemplateProfile,
  type ReportAudience,
  type ReportExportPreset,
  type ReportStandardTemplateId,
  type ReportVisibility,
} from "@sentineltwin/report";

const REPORT_CATALOG_STORAGE_KEY = "sentineltwin.report.catalog.v1";

export interface ReportCatalogPreset extends ReportExportPreset {
  templateLabel: string;
  isCustom: boolean;
  savedAt: number;
  notes?: string;
}

export interface ReportCatalogState {
  selectedPresetId: string | null;
  customPresets: ReportCatalogPreset[];
}

export const DEFAULT_REPORT_CATALOG_STATE: ReportCatalogState = {
  selectedPresetId: null,
  customPresets: [],
};

function safeParseCatalogState(raw: string | null): ReportCatalogState {
  if (!raw) return DEFAULT_REPORT_CATALOG_STATE;
  try {
    const parsed = JSON.parse(raw) as Partial<ReportCatalogState>;
    const customPresets = Array.isArray(parsed.customPresets)
      ? parsed.customPresets
          .map((preset) => normalizeCustomPreset(preset))
          .filter((preset): preset is ReportCatalogPreset => preset != null)
      : [];
    const selectedPresetId = typeof parsed.selectedPresetId === "string" ? parsed.selectedPresetId : null;
    return { selectedPresetId, customPresets };
  } catch {
    return DEFAULT_REPORT_CATALOG_STATE;
  }
}

function normalizeCustomPreset(value: Partial<ReportCatalogPreset> | null | undefined): ReportCatalogPreset | null {
  if (!value || typeof value !== "object") return null;
  if (typeof value.id !== "string" || typeof value.title !== "string") return null;
  if (value.audience !== "operator" && value.audience !== "auditor" && value.audience !== "insurer" && value.audience !== "installer" && value.audience !== "privacy_reviewer") {
    return null;
  }
  if (value.visibility !== "internal" && value.visibility !== "shared" && value.visibility !== "privacy_safe") {
    return null;
  }
  const preset = {
    id: value.id,
    title: value.title,
    audience: value.audience,
    visibility: value.visibility,
    templateId: value.templateId ?? "general-audit",
    summary: value.summary ?? "",
    templateLabel: value.templateLabel ?? getReportStandardTemplateProfile(value.templateId ?? "general-audit").title,
    isCustom: true,
    savedAt: typeof value.savedAt === "number" ? value.savedAt : Date.now(),
    notes: typeof value.notes === "string" ? value.notes : undefined,
  } satisfies ReportCatalogPreset;
  return preset;
}

export function loadReportCatalogState(): ReportCatalogState {
  if (typeof globalThis.localStorage === "undefined") return DEFAULT_REPORT_CATALOG_STATE;
  const raw = globalThis.localStorage.getItem(REPORT_CATALOG_STORAGE_KEY);
  return safeParseCatalogState(raw);
}

export function persistReportCatalogState(state: ReportCatalogState) {
  if (typeof globalThis.localStorage === "undefined") return;
  globalThis.localStorage.setItem(REPORT_CATALOG_STORAGE_KEY, JSON.stringify(state));
}

export function buildReportCatalogPresets(customPresets: ReportCatalogPreset[] = []): ReportCatalogPreset[] {
  const builtInPresets = getReportExportPresets().map((preset) => ({
    ...preset,
    templateLabel: getReportStandardTemplateProfile(preset.templateId).title,
    isCustom: false,
    savedAt: 0,
  }));
  return [...builtInPresets, ...customPresets];
}

export function findReportCatalogPresetById(
  presets: ReportCatalogPreset[],
  presetId: string | null | undefined,
): ReportCatalogPreset | undefined {
  if (!presetId) return undefined;
  return presets.find((preset) => preset.id === presetId);
}

export function findReportCatalogPresetBySelection(
  presets: ReportCatalogPreset[],
  selection: {
    audience: ReportAudience;
    visibility: ReportVisibility;
    templateId: ReportStandardTemplateId;
  },
): ReportCatalogPreset | undefined {
  return presets.find(
    (preset) =>
      preset.audience === selection.audience
      && preset.visibility === selection.visibility
      && preset.templateId === selection.templateId,
  );
}

export function createReportCatalogPreset(input: {
  title: string;
  audience: ReportAudience;
  visibility: ReportVisibility;
  templateId: ReportStandardTemplateId;
  summary?: string;
  notes?: string;
}): ReportCatalogPreset {
  const safeSlug = input.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "custom";
  return {
    id: `custom-${safeSlug}-${Date.now()}`,
    title: input.title,
    audience: input.audience,
    visibility: input.visibility,
    templateId: input.templateId,
    summary: input.summary ?? `Custom preset for ${input.audience} / ${input.visibility}.`,
    templateLabel: getReportStandardTemplateProfile(input.templateId).title,
    isCustom: true,
    savedAt: Date.now(),
    notes: input.notes,
  };
}

export function upsertReportCatalogPreset(
  state: ReportCatalogState,
  preset: ReportCatalogPreset,
): ReportCatalogState {
  const nextPresets = state.customPresets.filter((entry) => entry.id !== preset.id);
  return {
    selectedPresetId: preset.id,
    customPresets: [preset, ...nextPresets].slice(0, 24),
  };
}

export function removeReportCatalogPreset(
  state: ReportCatalogState,
  presetId: string,
): ReportCatalogState {
  const customPresets = state.customPresets.filter((preset) => preset.id !== presetId);
  return {
    selectedPresetId: state.selectedPresetId === presetId ? null : state.selectedPresetId,
    customPresets,
  };
}
