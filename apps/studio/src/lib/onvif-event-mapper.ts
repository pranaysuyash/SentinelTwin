/**
 * onvif-event-mapper.ts
 *
 * Translates raw ONVIF WS-Notification XML envelopes into canonical
 * `OperationalEvidenceEventInput` objects so they can be pushed onto
 * the operational evidence trail.
 *
 * Design notes:
 * - No DOM APIs: this is a server-safe utility, all XML parsing uses regex.
 * - Regex helpers are kept consistent with the style in onvif-client.ts.
 * - Confidence follows the ONVIF event confidence policy:
 *     0.85 → direct hardware alarms  (MotionAlarm, DigitalInput, GlobalSceneChange)
 *     0.70 → rule-engine events       (CellMotionDetector, VehicleDetector)
 *     0.60 → unrecognised topics      (unknown mapping)
 * Note: Mapper functions are pure — they return event objects but never publish
 * them. Callers (camera-metadata-live-ingest.ts, telemetry-slice.ts) are
 * responsible for persisting and, when a server-side event bus exists, calling
 * the publish infrastructure.
 */

import type { OperationalEvidenceEventInput } from "@/lib/operational-evidence";
import type { OnvifSession } from "@/lib/onvif-client";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Parsed representation of a single `wsnt:NotificationMessage` extracted
 * from a WS-Notification SOAP envelope.
 */
export type OnvifNotification = {
  /** ONVIF topic URI, e.g. `tns1:VideoSource/MotionAlarm` */
  topic: string;
  /** Parsed notification timestamp (ms since epoch), or Date.now() if absent */
  timestamp: number;
  /** Camera / video-source token from `tt:Source/tt:SimpleItem[@Name="VideoSourceConfigurationToken"]` */
  sourceToken: string | null;
  /** Whether this is a property event (persistent state) vs a plain notification */
  isProperty: boolean;
  /** Flat key→value map from all `tt:SimpleItem` elements in `tt:Data` */
  data: Record<string, string>;
  /** The raw XML of this NotificationMessage block */
  rawXml: string;
};

// ---------------------------------------------------------------------------
// Regex-based XML helpers (consistent with onvif-client.ts approach)
// ---------------------------------------------------------------------------

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Find the inner text of an XML element (any namespace prefix, case-insensitive).
 */
function findXmlTagText(block: string, tagName: string): string | null {
  const pattern = new RegExp(
    `<(?:[A-Za-z0-9_.-]+:)?${escapeRegExp(tagName)}\\b[^>]*>([\\s\\S]*?)</(?:[A-Za-z0-9_.-]+:)?${escapeRegExp(tagName)}>`,
    "i",
  );
  return block.match(pattern)?.[1]?.trim() ?? null;
}

/**
 * Find all non-overlapping blocks matching `<ns:TagName …>…</ns:TagName>`.
 * Returns an array of the full outer-tag strings.
 */
function findAllXmlBlocks(xml: string, tagName: string): string[] {
  // Match the open tag and everything up to the matching close tag.
  // We use a non-greedy match; ONVIF messages are small so this is safe.
  const pattern = new RegExp(
    `<(?:[A-Za-z0-9_.-]+:)?${escapeRegExp(tagName)}\\b[^>]*>[\\s\\S]*?</(?:[A-Za-z0-9_.-]+:)?${escapeRegExp(tagName)}>`,
    "gi",
  );
  return xml.match(pattern) ?? [];
}

/**
 * Find an XML attribute value by name (any namespace prefix, double or single quotes).
 */
function findXmlAttribute(block: string, attributeName: string): string | null {
  const dq = new RegExp(`\\b${escapeRegExp(attributeName)}="([^"]*)"`, "i");
  const sq = new RegExp(`\\b${escapeRegExp(attributeName)}='([^']*)'`, "i");
  return block.match(dq)?.[1]?.trim() ?? block.match(sq)?.[1]?.trim() ?? null;
}

/**
 * Parse all `tt:SimpleItem` elements from a block and return a flat
 * `Name → Value` map.  Handles both quoted attribute styles.
 */
function parseSimpleItems(block: string): Record<string, string> {
  const result: Record<string, string> = {};
  // Match every <tt:SimpleItem … /> or <SimpleItem … />
  const itemPattern = /<(?:[A-Za-z0-9_.-]+:)?SimpleItem\b([^>]*?)\/>/gi;
  let match: RegExpExecArray | null;
  while ((match = itemPattern.exec(block)) !== null) {
    const attrs = match[1] ?? "";
    const name = findXmlAttribute(attrs, "Name");
    const value = findXmlAttribute(attrs, "Value");
    if (name) result[name] = value ?? "";
  }
  return result;
}

/**
 * Parse a timestamp string from an ONVIF envelope. ONVIF uses ISO-8601.
 * Falls back to `Date.now()` if absent or unparseable.
 */
function parseOnvifTimestamp(block: string): number {
  const utcTime = findXmlTagText(block, "UtcTime") ?? findXmlAttribute(block, "UtcTime");
  if (utcTime) {
    const parsed = Date.parse(utcTime);
    if (Number.isFinite(parsed)) return parsed;
  }
  return Date.now();
}

/**
 * Normalise a raw topic string, stripping XML namespace bindings and any
 * trailing slash.  E.g. `tns1:VideoSource/MotionAlarm` stays as-is;
 * a CDATA or whitespace-wrapped value is trimmed.
 */
function normaliseTopic(raw: string | null): string {
  if (!raw) return "";
  return raw.trim().replace(/\s+/g, "").replace(/\/$/, "");
}

// ---------------------------------------------------------------------------
// Public: parseOnvifNotificationXml
// ---------------------------------------------------------------------------

/**
 * Parse a SOAP envelope containing one or more `wsnt:NotificationMessage`
 * nodes and return an array of `OnvifNotification` objects.
 *
 * If the envelope contains no notification messages, an empty array is
 * returned (not an error).
 *
 * @param xml - Raw SOAP envelope string as received from an ONVIF device.
 */
export function parseOnvifNotificationXml(xml: string): OnvifNotification[] {
  const messageBlocks = findAllXmlBlocks(xml, "NotificationMessage");
  if (messageBlocks.length === 0) return [];

  return messageBlocks.map((block): OnvifNotification => {
    // Topic
    const topicRaw = findXmlTagText(block, "Topic");
    const topic = normaliseTopic(topicRaw);

    // Timestamp from the nested <tt:Message> element
    const messageBlock = findXmlTagText(block, "Message") ?? block;
    const timestamp = parseOnvifTimestamp(messageBlock);

    // isProperty attribute on <tt:Message>
    const isPropertyAttr = findXmlAttribute(messageBlock, "PropertyOperation");
    const isProperty = isPropertyAttr != null
      ? isPropertyAttr.toLowerCase() === "initialized" || isPropertyAttr.toLowerCase() === "changed"
      : false;

    // Source token: look in <tt:Source> first, then fall back to <tt:Key>
    const sourceBlock = findXmlTagText(messageBlock, "Source") ?? "";
    const sourceItems = parseSimpleItems(sourceBlock);
    const sourceToken =
      sourceItems["VideoSourceConfigurationToken"] ??
      sourceItems["VideoSourceToken"] ??
      sourceItems["Source"] ??
      findXmlTagText(block, "SubscriptionReference") ??
      null;

    // Data items from <tt:Data>
    const dataBlock = findXmlTagText(messageBlock, "Data") ?? "";
    const data = parseSimpleItems(dataBlock);

    return {
      topic,
      timestamp,
      sourceToken,
      isProperty,
      data,
      rawXml: block,
    };
  });
}

// ---------------------------------------------------------------------------
// Topic routing table
// ---------------------------------------------------------------------------

type TopicRoute = {
  kind: OperationalEvidenceEventInput["kind"];
  title: string;
  /** Base confidence before isProperty/data adjustments */
  baseConfidence: number;
};

const TOPIC_ROUTES: Array<{ prefix: string; route: TopicRoute }> = [
  {
    prefix: "tns1:VideoSource/MotionAlarm",
    route: {
      kind: "camera_live_connection_updated",
      title: "Motion Alarm",
      baseConfidence: 0.85,
    },
  },
  {
    prefix: "tns1:RuleEngine/CellMotionDetector/Motion",
    route: {
      kind: "camera_live_connection_updated",
      title: "Cell Motion Detected",
      baseConfidence: 0.7,
    },
  },
  {
    prefix: "tns1:VideoAnalytics/VehicleDetector",
    route: {
      kind: "sensor_triggered",
      title: "Vehicle Detected",
      baseConfidence: 0.7,
    },
  },
  {
    prefix: "tns1:Device/Trigger/DigitalInput",
    route: {
      kind: "sensor_triggered",
      title: "Digital Input Triggered",
      baseConfidence: 0.85,
    },
  },
  {
    prefix: "tns1:VideoSource/GlobalSceneChange",
    route: {
      kind: "camera_metadata_updated",
      title: "Global Scene Change",
      baseConfidence: 0.85,
    },
  },
];

function routeTopic(topic: string): TopicRoute {
  for (const { prefix, route } of TOPIC_ROUTES) {
    if (topic === prefix || topic.startsWith(prefix + "/")) {
      return route;
    }
  }
  // Fallback for unrecognised topics
  return {
    kind: "camera_metadata_updated",
    title: `ONVIF Event: ${topic || "Unknown"}`,
    baseConfidence: 0.6,
  };
}

// ---------------------------------------------------------------------------
// Context type (shared by both mapping functions)
// ---------------------------------------------------------------------------

export type OnvifEventContext = {
  cameraId: string;
  cameraName: string;
  sceneId: string;
  sceneName: string;
  revisionDepth: number;
};

// ---------------------------------------------------------------------------
// Public: mapOnvifNotificationToEvidenceEvent
// ---------------------------------------------------------------------------

/**
 * Map a single parsed `OnvifNotification` to an `OperationalEvidenceEventInput`
 * ready to be appended to the operational evidence trail.
 *
 * Returns `null` if the notification cannot be meaningfully mapped (e.g. an
 * empty topic with no data).
 *
 * @param notification - A parsed ONVIF notification from `parseOnvifNotificationXml`.
 * @param context      - Camera and scene identity context.
 */
export function mapOnvifNotificationToEvidenceEvent(
  notification: OnvifNotification,
  context: OnvifEventContext,
): OperationalEvidenceEventInput | null {
  if (!notification.topic && Object.keys(notification.data).length === 0) {
    return null;
  }

  const { kind, title, baseConfidence } = routeTopic(notification.topic);

  // Build a human-readable details string from the data items
  const dataEntries = Object.entries(notification.data);
  const dataDetail = dataEntries.length > 0
    ? dataEntries.map(([k, v]) => `${k}=${v}`).join(", ")
    : "No additional data";

  const sourceTokenLabel = notification.sourceToken
    ? ` (source: ${notification.sourceToken})`
    : "";

  const details = `${title} from camera "${context.cameraName}"${sourceTokenLabel}. ${dataDetail}.`;

  const afterSummary = dataEntries.length > 0
    ? dataEntries.map(([k, v]) => `${k}: ${v}`).join(" · ")
    : title;

  return {
    kind,
    title,
    details,
    afterSummary,
    actor: "system",
    source: "scan",
    sceneId: context.sceneId,
    sceneName: context.sceneName,
    timestamp: notification.timestamp,
    revisionDepth: context.revisionDepth,
    affectedNodeIds: [context.cameraId],
    confidence: baseConfidence,
    lifecycleStage: "scanned",
    notes: [`ONVIF topic: ${notification.topic || "(empty)"}`],
  };
}

// ---------------------------------------------------------------------------
// Public: mapOnvifSessionToEvidenceEvent
// ---------------------------------------------------------------------------

/**
 * Create a `camera_live_connection_updated` evidence event that reflects the
 * current state of an `OnvifSession` — suitable for emitting whenever a session
 * transitions state (connected, error, disconnected, etc.).
 *
 * @param session - The current ONVIF session object.
 * @param context - Camera and scene identity context.
 */
export function mapOnvifSessionToEvidenceEvent(
  session: OnvifSession,
  context: OnvifEventContext,
): OperationalEvidenceEventInput {
  const stateLabel = session.state === "streaming"
    ? "connected"
    : session.state === "error"
      ? "error"
      : session.state === "disconnected"
        ? "disconnected"
        : session.state;

  const title = `Camera Live Connection: ${stateLabel}`;

  const deviceParts: string[] = [];
  if (session.deviceInformation?.manufacturer) deviceParts.push(session.deviceInformation.manufacturer);
  if (session.deviceInformation?.model) deviceParts.push(session.deviceInformation.model);
  const deviceLabel = deviceParts.length > 0 ? deviceParts.join(" ") : "ONVIF device";

  const details = `ONVIF session for camera "${context.cameraName}" (${deviceLabel}) transitioned to state "${stateLabel}". HTTP ${session.responseStatus ?? "—"}.`;

  const afterSummary = [
    `state: ${stateLabel}`,
    session.responseStatus != null ? `HTTP ${session.responseStatus}` : null,
    session.eventSubscriptionUri ? "events subscribed" : null,
  ].filter(Boolean).join(" · ");

  // High confidence for a direct hardware state report; lower if it is an
  // ambiguous intermediate state.
  const confidence = session.state === "streaming" || session.state === "error" ? 0.9 : 0.75;

  return {
    kind: "camera_live_connection_updated",
    title,
    details,
    afterSummary,
    actor: "system",
    source: "scan",
    sceneId: context.sceneId,
    sceneName: context.sceneName,
    timestamp: session.lastHeartbeatAt > 0 ? session.lastHeartbeatAt : Date.now(),
    revisionDepth: context.revisionDepth,
    affectedNodeIds: [context.cameraId],
    confidence,
    lifecycleStage: "scanned",
    notes: [
      `Session: ${session.sessionId}`,
      `Address: ${session.address}`,
      session.eventSubscriptionUri ? `Event URI: ${session.eventSubscriptionUri}` : null,
    ].filter((n): n is string => n !== null),
  };
}
