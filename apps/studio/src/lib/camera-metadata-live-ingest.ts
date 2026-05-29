import { z } from "zod";

import type { CameraNode } from "@/schema/security-scene";

const CameraMetadataRecordSchema = z.object({
  cameraId: z.string().min(1).optional(),
  cameraName: z.string().min(1).optional(),
  status: z.enum(["on", "off", "blocked", "dirty", "malfunctioning"]).optional(),
  clarity: z.enum(["poor", "average", "good", "excellent"]).optional(),
  nightMode: z.enum(["none", "ir", "low_light", "thermal"]).optional(),
  feedMode: z.enum(["normal", "ir", "low_light", "thermal"]).optional(),
  notes: z.string().min(1).optional(),
  timestamp: z.number().int().nonnegative().optional(),
});

export type CameraMetadataLiveParseResult = {
  records: Array<{
    cameraId: string;
    cameraName: string;
    status: CameraNode["status"] | null;
    clarity: CameraNode["clarity"] | null;
    nightMode: CameraNode["nightMode"] | null;
    feedMode: "normal" | "ir" | "low_light" | "thermal" | null;
    notes: string | null;
    timestamp: number;
  }>;
  errors: string[];
  sourceCount: number;
};

export const CameraMetadataIngestRequestSchema = z.object({
  source: z.string().min(1).default("camera-view"),
  ingestMode: z.enum(["paste", "external"]).default("paste"),
  feedUrl: z.string().url().nullable().optional(),
  feedLabel: z.string().min(1).optional(),
  sceneId: z.string().min(1).optional(),
  sceneName: z.string().min(1).optional(),
  submittedAt: z.number().int().nonnegative().optional(),
  raw: z.string().default(""),
  cameras: z.array(z.object({
    id: z.string().min(1),
    name: z.string().min(1),
    status: z.enum(["on", "off", "blocked", "dirty", "malfunctioning"]),
    clarity: z.enum(["poor", "average", "good", "excellent"]),
    nightMode: z.enum(["none", "ir", "low_light", "thermal"]),
  })).default([]),
}).refine((value) => value.raw.trim().length > 0 || Boolean(value.feedUrl), {
  message: "Provide pasted camera metadata or an external feed URL.",
  path: ["raw"],
});

export type CameraMetadataIngestRequest = z.infer<typeof CameraMetadataIngestRequestSchema>;

export type CameraMetadataIngestResponse = CameraMetadataLiveParseResult & {
  ok: true;
  source: string;
  ingestMode: "paste" | "external";
  receivedAt: string;
  sceneId: string | null;
  sceneName: string | null;
  feedUrl: string | null;
  feedLabel: string | null;
  summary: string;
};

function parseJsonCandidates(raw: string): { items: unknown[]; errors: string[] } {
  const trimmed = raw.trim();
  if (!trimmed) return { items: [], errors: [] };
  if (trimmed.startsWith("<")) return { items: [], errors: [] };

  try {
    const parsed = JSON.parse(trimmed);
    if (Array.isArray(parsed)) return { items: parsed, errors: [] };
    if (parsed && typeof parsed === "object" && Array.isArray((parsed as { records?: unknown }).records)) {
      return { items: (parsed as { records: unknown[] }).records, errors: [] };
    }
    if (parsed && typeof parsed === "object" && Array.isArray((parsed as { events?: unknown }).events)) {
      return { items: (parsed as { events: unknown[] }).events, errors: [] };
    }
    return { items: [parsed], errors: [] };
  } catch {
    const items: unknown[] = [];
    const errors: string[] = [];
    trimmed
      .split(/\r?\n+/)
      .map((line) => line.trim())
      .filter(Boolean)
      .forEach((line, index) => {
        try {
          items.push(JSON.parse(line));
        } catch {
          errors.push(`Line ${index + 1} is not valid JSON.`);
        }
      });
    return { items, errors };
  }
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function findXmlTagText(block: string, tagNames: string[]) {
  for (const tagName of tagNames) {
    const pattern = new RegExp(`<(?:[A-Za-z0-9_.-]+:)?${escapeRegExp(tagName)}\\b[^>]*>([\\s\\S]*?)</(?:[A-Za-z0-9_.-]+:)?${escapeRegExp(tagName)}>`, "i");
    const match = block.match(pattern);
    const value = match?.[1]?.trim();
    if (value) return value;
  }
  return null;
}

function findXmlAttribute(block: string, attributeNames: string[]) {
  for (const attributeName of attributeNames) {
    const doubleQuoted = new RegExp(`\\b${escapeRegExp(attributeName)}="([^"]+)"`, "i");
    const singleQuoted = new RegExp(`\\b${escapeRegExp(attributeName)}='([^']+)'`, "i");
    const doubleMatch = block.match(doubleQuoted)?.[1]?.trim();
    if (doubleMatch) return doubleMatch;
    const singleMatch = block.match(singleQuoted)?.[1]?.trim();
    if (singleMatch) return singleMatch;
  }
  return null;
}

function normalizeCameraStatus(value: string | null): CameraNode["status"] | null {
  if (!value) return null;
  const normalized = value.toLowerCase().replace(/[\s-]+/g, "_");
  if (normalized === "on" || normalized === "online" || normalized === "healthy" || normalized === "ok") return "on";
  if (normalized === "off" || normalized === "offline" || normalized === "disconnected") return "off";
  if (normalized === "blocked" || normalized === "restricted" || normalized === "denied") return "blocked";
  if (normalized === "dirty" || normalized === "obscured" || normalized === "dirty_lens") return "dirty";
  if (normalized === "malfunctioning" || normalized === "faulted" || normalized === "error" || normalized === "fault") return "malfunctioning";
  return null;
}

function normalizeClarity(value: string | null): CameraNode["clarity"] | null {
  if (!value) return null;
  const normalized = value.toLowerCase().replace(/[\s-]+/g, "_");
  if (normalized === "poor" || normalized === "low") return "poor";
  if (normalized === "average" || normalized === "medium") return "average";
  if (normalized === "good") return "good";
  if (normalized === "excellent" || normalized === "best") return "excellent";
  return null;
}

function normalizeNightMode(value: string | null): CameraNode["nightMode"] | null {
  if (!value) return null;
  const normalized = value.toLowerCase().replace(/[\s-]+/g, "_");
  if (normalized === "none" || normalized === "off") return "none";
  if (normalized === "ir" || normalized === "infrared") return "ir";
  if (normalized === "low_light" || normalized === "lowlight" || normalized === "night") return "low_light";
  if (normalized === "thermal") return "thermal";
  return null;
}

function normalizeFeedMode(value: string | null): "normal" | "ir" | "low_light" | "thermal" | null {
  if (!value) return null;
  const normalized = value.toLowerCase().replace(/[\s-]+/g, "_");
  if (normalized === "normal" || normalized === "day") return "normal";
  if (normalized === "ir" || normalized === "infrared") return "ir";
  if (normalized === "low_light" || normalized === "lowlight" || normalized === "night") return "low_light";
  if (normalized === "thermal") return "thermal";
  return null;
}

function parseTimestampValue(value: string | null): number | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  if (/^\d+$/.test(trimmed)) {
    const numeric = Number(trimmed);
    return Number.isFinite(numeric) ? numeric : undefined;
  }
  const parsed = Date.parse(trimmed);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function parseXmlCandidates(raw: string): { items: unknown[]; errors: string[] } {
  const trimmed = raw.trim();
  if (!trimmed.startsWith("<")) return { items: [], errors: [] };

  const taggedBlocks = trimmed.match(/<(?:[A-Za-z0-9_.-]+:)?(?:CameraMetadata|CameraStatus|CameraEvent|Metadata|Record|Event)\b[^>]*>[\s\S]*?<\/(?:[A-Za-z0-9_.-]+:)?(?:CameraMetadata|CameraStatus|CameraEvent|Metadata|Record|Event)>/gi);
  const blocks = taggedBlocks && taggedBlocks.length > 0 ? taggedBlocks : [trimmed];
  const items: unknown[] = [];
  const errors: string[] = [];

  for (const block of blocks) {
    const cameraId = findXmlTagText(block, ["CameraId", "Token", "SourceId", "Id"]) ?? findXmlAttribute(block, ["cameraId", "camera-id", "id", "token", "sourceId"]);
    const cameraName = findXmlTagText(block, ["CameraName", "DeviceName", "Name", "Label", "Title"]) ?? findXmlAttribute(block, ["cameraName", "deviceName", "name", "label", "title"]);
    const status = normalizeCameraStatus(findXmlTagText(block, ["Status", "ConnectionStatus", "HealthStatus", "State"]));
    const clarity = normalizeClarity(findXmlTagText(block, ["Clarity", "ImageClarity", "Quality"]));
    const nightMode = normalizeNightMode(findXmlTagText(block, ["NightMode", "NightVision", "LowLightMode", "Mode"]));
    const feedMode = normalizeFeedMode(findXmlTagText(block, ["FeedMode", "StreamMode", "VideoMode", "Mode"]));
    const notes = findXmlTagText(block, ["Notes", "Message", "Description", "Detail", "Summary"]);
    const timestamp = parseTimestampValue(
      findXmlTagText(block, ["Timestamp", "Time", "UtcTime", "DateTime", "ObservedAt", "LastSeen"])
      ?? findXmlAttribute(block, ["timestamp", "time", "utcTime", "dateTime", "observedAt", "lastSeen"]),
    );

    if (!cameraId && !cameraName && !status && !clarity && !nightMode && !feedMode && !notes && timestamp === undefined) {
      errors.push("The XML payload did not expose a usable camera metadata record.");
      continue;
    }

    items.push({
      cameraId: cameraId ?? undefined,
      cameraName: cameraName ?? undefined,
      status: status ?? undefined,
      clarity: clarity ?? undefined,
      nightMode: nightMode ?? undefined,
      feedMode: feedMode ?? undefined,
      notes: notes ?? undefined,
      timestamp,
    });
  }

  return { items, errors };
}

function resolveCamera(candidate: z.infer<typeof CameraMetadataRecordSchema>, cameras: CameraMetadataIngestRequest["cameras"]) {
  if (candidate.cameraId) {
    const byId = cameras.find((camera) => camera.id === candidate.cameraId);
    if (byId) return byId;
  }
  if (candidate.cameraName) {
    const byName = cameras.find((camera) => camera.name.toLowerCase() === candidate.cameraName?.toLowerCase());
    if (byName) return byName;
  }
  return null;
}

async function resolveCameraMetadataPayload(request: CameraMetadataIngestRequest) {
  const trimmedRaw = request.raw.trim();
  if (trimmedRaw.length > 0) {
    return {
      raw: trimmedRaw,
      feedUrl: request.feedUrl ?? null,
      feedLabel: request.feedLabel ?? null,
    };
  }

  if (!request.feedUrl) {
    return {
      raw: "",
      feedUrl: null,
      feedLabel: request.feedLabel ?? null,
    };
  }

  const response = await fetch(request.feedUrl, {
    method: "GET",
    headers: {
      accept: "application/json, application/x-ndjson, application/xml, text/xml, text/plain;q=0.9, */*;q=0.1",
    },
  });

  if (!response.ok) {
    throw new Error(`External camera feed failed with HTTP ${response.status}.`);
  }

  return {
    raw: (await response.text()).trim(),
    feedUrl: request.feedUrl,
    feedLabel: request.feedLabel ?? null,
  };
}

export async function summarizeCameraMetadataLiveFeed(request: CameraMetadataIngestRequest): Promise<CameraMetadataIngestResponse> {
  const payload = await resolveCameraMetadataPayload(request);
  const jsonResult = parseJsonCandidates(payload.raw);
  const xmlResult = jsonResult.items.length > 0 ? { items: [] as unknown[], errors: [] as string[] } : parseXmlCandidates(payload.raw);
  const candidates = jsonResult.items.length > 0 ? jsonResult.items : xmlResult.items;
  const parseErrors = [...jsonResult.errors, ...xmlResult.errors];
  const records: CameraMetadataLiveParseResult["records"] = [];
  const errors: string[] = [...parseErrors];

  for (const [index, item] of candidates.entries()) {
    const parsed = CameraMetadataRecordSchema.safeParse(item);
    if (!parsed.success) {
      errors.push(`Entry ${index + 1} is not a valid camera metadata record.`);
      continue;
    }

    const camera = resolveCamera(parsed.data, request.cameras);
    if (!camera) {
      errors.push(`Entry ${index + 1} could not be matched to a scene camera.`);
      continue;
    }

    records.push({
      cameraId: camera.id,
      cameraName: camera.name,
      status: parsed.data.status ?? null,
      clarity: parsed.data.clarity ?? null,
      nightMode: parsed.data.nightMode ?? null,
      feedMode: parsed.data.feedMode ?? null,
      notes: parsed.data.notes?.trim() || null,
      timestamp: parsed.data.timestamp ?? Date.now(),
    });
  }

  const receivedAt = new Date(request.submittedAt ?? Date.now()).toISOString();
  const feedSourceLabel = payload.feedUrl
    ? payload.feedLabel
      ? `${payload.feedLabel} (${payload.feedUrl})`
      : payload.feedUrl
    : request.source;
  const summary = records.length > 0
    ? `Imported ${records.length} camera metadata record${records.length === 1 ? "" : "s"} from ${candidates.length} source record${candidates.length === 1 ? "" : "s"} via ${feedSourceLabel}.`
    : "No matching camera metadata records were found in the submitted payload.";

  return {
    ok: true,
    source: request.source,
    ingestMode: request.ingestMode,
    receivedAt,
    sceneId: request.sceneId ?? null,
    sceneName: request.sceneName ?? null,
    feedUrl: payload.feedUrl,
    feedLabel: payload.feedLabel,
    summary,
    records,
    errors,
    sourceCount: candidates.length,
  };
}
