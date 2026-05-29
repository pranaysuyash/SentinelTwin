import { z } from "zod";

import { sensorNodeSchema } from "@/schema/security-scene";
import type { SensorLiveEventInput } from "@/store/studio-store";
import type { SensorNode } from "@/schema/security-scene";

const LiveEventSchema = z.object({
  sensorId: z.string().min(1).optional(),
  sensorLabel: z.string().min(1).optional(),
  sensorType: z.enum([
    "motion",
    "door_contact",
    "access_reader",
    "audio",
    "vibration",
    "panic_button",
    "smoke_heat",
  ]).optional(),
  kind: z.enum(["triggered", "heartbeat", "faulted", "restored"]),
  details: z.string().min(1).optional(),
  timestamp: z.number().int().nonnegative().optional(),
  resultingState: z.enum(["active", "inactive", "faulted"]).nullable().optional(),
  nearestCameraId: z.string().nullable().optional(),
  nearestCameraName: z.string().nullable().optional(),
  nearestDistanceM: z.number().nonnegative().nullable().optional(),
});

export type SensorLiveFeedParseResult = {
  events: SensorLiveEventInput[];
  errors: string[];
  sourceCount: number;
};

export const SensorLiveIngestRequestSchema = z.object({
  source: z.string().min(1).default("debug-panel"),
  sceneId: z.string().min(1).optional(),
  sceneName: z.string().min(1).optional(),
  submittedAt: z.number().int().nonnegative().optional(),
  ingestMode: z.enum(["paste", "external"]).default("paste"),
  feedUrl: z.string().url().nullable().optional(),
  feedLabel: z.string().min(1).optional(),
  raw: z.string().default(""),
  sensors: z.array(sensorNodeSchema).default([]),
}).refine((value) => value.raw.trim().length > 0 || Boolean(value.feedUrl), {
  message: "Provide pasted metadata or an external feed URL.",
  path: ["raw"],
});

export type SensorLiveIngestRequest = z.infer<typeof SensorLiveIngestRequestSchema>;
export type SensorLiveIngestResponse = SensorLiveFeedParseResult & {
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

async function resolveSensorLiveFeedPayload(request: SensorLiveIngestRequest) {
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
    throw new Error(`External sensor feed failed with HTTP ${response.status}.`);
  }

  return {
    raw: (await response.text()).trim(),
    feedUrl: request.feedUrl,
    feedLabel: request.feedLabel ?? null,
  };
}

function parseJsonCandidates(raw: string): { items: unknown[]; errors: string[] } {
  const trimmed = raw.trim();
  if (!trimmed) return { items: [], errors: [] };
  if (trimmed.startsWith("<")) return { items: [], errors: [] };

  try {
    const parsed = JSON.parse(trimmed);
    if (Array.isArray(parsed)) return { items: parsed, errors: [] };
    if (parsed && typeof parsed === "object" && Array.isArray((parsed as { events?: unknown }).events)) {
      return { items: (parsed as { events: unknown[] }).events, errors: [] };
    }
    if (parsed && typeof parsed === "object" && Array.isArray((parsed as { records?: unknown }).records)) {
      return { items: (parsed as { records: unknown[] }).records, errors: [] };
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

function normalizeSensorType(value: string | null): z.infer<typeof LiveEventSchema>["sensorType"] | null {
  if (!value) return null;
  const normalized = value.toLowerCase().replace(/[\s-]+/g, "_");
  if (normalized === "motion") return "motion";
  if (normalized === "door_contact" || normalized === "door" || normalized === "contact") return "door_contact";
  if (normalized === "access_reader" || normalized === "reader" || normalized === "badge") return "access_reader";
  if (normalized === "audio") return "audio";
  if (normalized === "vibration" || normalized === "shake") return "vibration";
  if (normalized === "panic_button" || normalized === "panic" || normalized === "duress") return "panic_button";
  if (normalized === "smoke_heat" || normalized === "smoke" || normalized === "heat") return "smoke_heat";
  return null;
}

function normalizeEventKind(value: string | null): z.infer<typeof LiveEventSchema>["kind"] | null {
  if (!value) return null;
  const normalized = value.toLowerCase().replace(/[\s-]+/g, "_");
  if (normalized === "triggered" || normalized === "alert" || normalized === "active") return "triggered";
  if (normalized === "heartbeat" || normalized === "alive" || normalized === "ping") return "heartbeat";
  if (normalized === "faulted" || normalized === "fault" || normalized === "error") return "faulted";
  if (normalized === "restored" || normalized === "recovered" || normalized === "clear") return "restored";
  return null;
}

function normalizeResultingState(value: string | null): z.infer<typeof LiveEventSchema>["resultingState"] | null {
  if (!value) return null;
  const normalized = value.toLowerCase().replace(/[\s-]+/g, "_");
  if (normalized === "active") return "active";
  if (normalized === "inactive" || normalized === "idle" || normalized === "restored") return "inactive";
  if (normalized === "faulted" || normalized === "fault" || normalized === "error") return "faulted";
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

function parseNumberValue(value: string | null): number | undefined {
  if (!value) return undefined;
  const numeric = Number(value.trim());
  return Number.isFinite(numeric) ? numeric : undefined;
}

function parseXmlCandidates(raw: string): { items: unknown[]; errors: string[] } {
  const trimmed = raw.trim();
  if (!trimmed.startsWith("<")) return { items: [], errors: [] };

  const taggedBlocks = trimmed.match(/<(?:[A-Za-z0-9_.-]+:)?(?:SensorEvent|Event|Record|Sensor|Item)\b[^>]*>[\s\S]*?<\/(?:[A-Za-z0-9_.-]+:)?(?:SensorEvent|Event|Record|Sensor|Item)>/gi);
  const blocks = taggedBlocks && taggedBlocks.length > 0 ? taggedBlocks : [trimmed];
  const items: unknown[] = [];
  const errors: string[] = [];

  for (const block of blocks) {
    const sensorId = findXmlTagText(block, ["SensorId", "SensorToken", "Token", "Id"]) ?? findXmlAttribute(block, ["sensorId", "sensor-id", "id", "token"]);
    const sensorLabel = findXmlTagText(block, ["SensorLabel", "SensorName", "Label", "Name", "Title"]) ?? findXmlAttribute(block, ["sensorLabel", "sensor-label", "name", "label", "title"]);
    const sensorType = normalizeSensorType(findXmlTagText(block, ["SensorType", "Type", "Category", "Kind"]) ?? findXmlAttribute(block, ["sensorType", "type", "category", "kind"]));
    const kind = normalizeEventKind(findXmlTagText(block, ["Kind", "EventKind", "Status", "EventType"]) ?? findXmlAttribute(block, ["kind", "eventKind", "status", "eventType"]));
    const details = findXmlTagText(block, ["Details", "Message", "Description", "Note"]) ?? findXmlAttribute(block, ["details", "message", "description", "note"]);
    const timestamp = parseTimestampValue(
      findXmlTagText(block, ["Timestamp", "Time", "ObservedAt", "DateTime", "UtcTime"])
      ?? findXmlAttribute(block, ["timestamp", "time", "observedAt", "dateTime", "utcTime"]),
    );
    const resultingState = normalizeResultingState(findXmlTagText(block, ["ResultingState", "State", "SensorState"]) ?? findXmlAttribute(block, ["resultingState", "state", "sensorState"]));
    const nearestCameraId = findXmlTagText(block, ["NearestCameraId", "CameraId", "CameraToken"]) ?? findXmlAttribute(block, ["nearestCameraId", "cameraId", "camera-id", "cameraToken"]);
    const nearestCameraName = findXmlTagText(block, ["NearestCameraName", "CameraName", "Name"]) ?? findXmlAttribute(block, ["nearestCameraName", "cameraName", "camera-name", "name"]);
    const nearestDistanceM = parseNumberValue(findXmlTagText(block, ["NearestDistanceM", "DistanceM", "DistanceMeters"]) ?? findXmlAttribute(block, ["nearestDistanceM", "distanceM", "distanceMeters"]));

    if (!sensorId && !sensorLabel && !sensorType && !kind && !details && timestamp === undefined && !resultingState && nearestCameraId === null && nearestCameraName === null && nearestDistanceM === undefined) {
      errors.push("The XML payload did not expose a usable sensor event record.");
      continue;
    }

    if (!kind) {
      errors.push("An XML sensor event could not be mapped to a supported event kind.");
      continue;
    }

    items.push({
      sensorId: sensorId ?? undefined,
      sensorLabel: sensorLabel ?? undefined,
      sensorType: sensorType ?? undefined,
      kind,
      details: details ?? undefined,
      timestamp,
      resultingState: resultingState ?? undefined,
      nearestCameraId: nearestCameraId ?? undefined,
      nearestCameraName: nearestCameraName ?? undefined,
      nearestDistanceM,
    });
  }

  return { items, errors };
}

function resolveSensor(
  candidate: z.infer<typeof LiveEventSchema>,
  sensors: SensorNode[],
): SensorNode | null {
  if (candidate.sensorId) {
    const byId = sensors.find((sensor) => sensor.id === candidate.sensorId);
    if (byId) return byId;
  }
  if (candidate.sensorLabel) {
    const byLabel = sensors.find((sensor) => sensor.label.toLowerCase() === candidate.sensorLabel?.toLowerCase());
    if (byLabel) return byLabel;
  }
  return null;
}

export function parseSensorLiveFeed(
  raw: string,
  sensors: SensorNode[],
): SensorLiveFeedParseResult {
  const jsonResult = parseJsonCandidates(raw);
  const xmlResult = jsonResult.items.length > 0 ? { items: [] as unknown[], errors: [] as string[] } : parseXmlCandidates(raw);
  const candidates = jsonResult.items.length > 0 ? jsonResult.items : xmlResult.items;
  const parseErrors = [...jsonResult.errors, ...xmlResult.errors];
  const events: SensorLiveEventInput[] = [];
  const errors: string[] = [...parseErrors];

  for (const [index, item] of candidates.entries()) {
    const parsed = LiveEventSchema.safeParse(item);
    if (!parsed.success) {
      errors.push(`Entry ${index + 1} is not a valid sensor event.`);
      continue;
    }

    const resolvedSensor = resolveSensor(parsed.data, sensors);
    if (!resolvedSensor) {
      errors.push(`Entry ${index + 1} could not be matched to a scene sensor.`);
      continue;
    }

    events.push({
      sensorId: resolvedSensor.id,
      sensorLabel: resolvedSensor.label,
      sensorType: resolvedSensor.sensorType,
      kind: parsed.data.kind,
      details: parsed.data.details?.trim() || `${resolvedSensor.label} reported a ${parsed.data.kind} event.`,
      timestamp: parsed.data.timestamp,
      resultingState: parsed.data.resultingState ?? null,
      nearestCameraId: parsed.data.nearestCameraId ?? null,
      nearestCameraName: parsed.data.nearestCameraName ?? null,
      nearestDistanceM: parsed.data.nearestDistanceM ?? null,
    });
  }

  return {
    events,
    errors,
    sourceCount: candidates.length,
  };
}

export async function summarizeSensorLiveFeed(
  request: SensorLiveIngestRequest,
): Promise<SensorLiveIngestResponse> {
  const payload = await resolveSensorLiveFeedPayload(request);
  const parsed = parseSensorLiveFeed(payload.raw, request.sensors);
  const receivedAt = new Date(request.submittedAt ?? Date.now()).toISOString();
  const feedSourceLabel = payload.feedUrl
    ? payload.feedLabel
      ? `${payload.feedLabel} (${payload.feedUrl})`
      : payload.feedUrl
    : request.source;
  const summary = parsed.events.length > 0
    ? `Imported ${parsed.events.length} sensor event${parsed.events.length === 1 ? "" : "s"} from ${parsed.sourceCount} record${parsed.sourceCount === 1 ? "" : "s"} via ${feedSourceLabel}.`
    : "No matching sensor events were found in the submitted payload.";
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
    ...parsed,
  };
}
