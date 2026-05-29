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
      accept: "application/json, application/x-ndjson, text/plain;q=0.9, */*;q=0.1",
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
  const { items: candidates, errors: parseErrors } = parseJsonCandidates(payload.raw);
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
