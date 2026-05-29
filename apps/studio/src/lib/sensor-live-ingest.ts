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
      accept: "application/json, application/x-ndjson, text/plain;q=0.9, */*;q=0.1",
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
  const { items: candidates, errors: parseErrors } = parseJsonCandidates(raw);
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
