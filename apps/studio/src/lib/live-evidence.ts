import { z } from "zod";
import type { SecurityScene } from "@/schema/security-scene";

export const liveEvidenceEventSchema = z.object({
  id: z.string(),
  source: z.string(),
  timestamp: z.number().int(),
  eventType: z.enum(["motion", "door_open", "door_forced", "glass_break", "camera_health", "analytics_alert", "access_granted", "access_denied"]),
  boundNodeId: z.string().nullable(),
  confidence: z.number().min(0).max(1),
  payload: z.record(z.string(), z.unknown()),
  provenance: z.object({
    adapter: z.string(),
    rawEventId: z.string().optional(),
    receivedAt: z.number().int(),
  }),
  reviewState: z.enum(["unreviewed", "confirmed", "dismissed"]).default("unreviewed")
});

export type LiveEvidenceEvent = z.infer<typeof liveEvidenceEventSchema>;

export const cameraHealthEventPayloadSchema = z.object({
  status: z.enum(["offline", "dirty", "blurred", "tampered", "healthy"]),
  detail: z.string().optional()
});

export type CameraHealthEventPayload = z.infer<typeof cameraHealthEventPayloadSchema>;

export const incidentBundleSchema = z.object({
  id: z.string(),
  title: z.string(),
  createdAt: z.number().int(),
  events: z.array(z.string()),
  primaryNodeId: z.string().optional(),
  status: z.enum(["open", "investigating", "resolved", "false_alarm"]),
  narrative: z.string().optional(),
});

export type IncidentBundle = z.infer<typeof incidentBundleSchema>;

export type SensorBinding = {
  sensorId: string;
  nodeId: string;
  confidence: number;
};

export interface EvidenceIngestAdapter {
  name: string;
  normalize(rawPayload: unknown): LiveEvidenceEvent[];
}

export type ReviewableConflict = {
  id: string;
  eventId: string;
  nodeId: string;
  property: string;
  currentValue: unknown;
  suggestedValue: unknown;
  reason: string;
};

export function bindSensorToScene(sensorId: string, scene: SecurityScene): SensorBinding | null {
  const node = scene.sensors.find(s => s.id === sensorId || s.label === sensorId) ||
               scene.cameras.find(c => c.id === sensorId || c.name === sensorId) ||
               scene.doors.find(d => d.id === sensorId || d.label === sensorId);

  if (node) {
    return { sensorId, nodeId: node.id, confidence: 1.0 };
  }

  return null;
}

export function generateEventToSimulationUpdates(event: LiveEvidenceEvent, scene: SecurityScene) {
  if (event.eventType === "camera_health" && event.boundNodeId) {
    const payload = cameraHealthEventPayloadSchema.safeParse(event.payload);
    if (payload.success && payload.data.status === "offline") {
       return {
         type: "camera_status_update",
         nodeId: event.boundNodeId,
         suggestedStatus: "off"
       };
    }
  }
  return null;
}

export function detectConflicts(event: LiveEvidenceEvent, scene: SecurityScene): ReviewableConflict[] {
  const conflicts: ReviewableConflict[] = [];
  if (event.eventType === "camera_health" && event.boundNodeId) {
    const payload = cameraHealthEventPayloadSchema.safeParse(event.payload);
    if (payload.success) {
      const camera = scene.cameras.find(c => c.id === event.boundNodeId);
      if (camera) {
        if (payload.data.status === "offline" && camera.status === "on") {
          conflicts.push({
            id: `conflict_${Date.now()}_${event.id}`,
            eventId: event.id,
            nodeId: camera.id,
            property: "status",
            currentValue: camera.status,
            suggestedValue: "off",
            reason: "Live evidence indicates camera is offline but scene assumes it is on."
          });
        }
      }
    }
  }
  return conflicts;
}

export class LiveEvidenceTimeline {
  events: LiveEvidenceEvent[] = [];

  addEvent(event: LiveEvidenceEvent) {
    this.events.push(event);
    this.events.sort((a, b) => a.timestamp - b.timestamp);
  }

  getEventsInWindow(startTime: number, endTime: number): LiveEvidenceEvent[] {
    return this.events.filter(e => e.timestamp >= startTime && e.timestamp <= endTime);
  }
}
