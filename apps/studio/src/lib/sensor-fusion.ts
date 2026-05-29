import type { CameraNode, SensorNode } from "@/schema/security-scene";

export type SensorFusionSummary = {
  totalCount: number;
  activeCount: number;
  nearestSensor: SensorNode | null;
  nearestDistanceM: number | null;
};

export type CameraMetadataFusionEvent = {
  cameraId: string;
  cameraName: string;
  status: CameraNode["status"] | null;
  clarity: CameraNode["clarity"] | null;
  nightMode: CameraNode["nightMode"] | null;
  feedMode: "normal" | "ir" | "low_light" | "thermal" | null;
  ingestMode: "paste" | "external";
  timestamp: number;
  summary: string;
};

export type CameraLiveConnectionFusionEvent = {
  cameraId: string;
  cameraName: string;
  liveConnectionStatus: "disconnected" | "connecting" | "connected" | "error" | null;
  liveSessionState: "idle" | "probing" | "connected" | "error" | null;
  liveSessionStartedAt: number | null;
  liveSessionConfirmedAt: number | null;
  liveSessionExpiresAt: number | null;
  transportSessionState: "idle" | "negotiating" | "active" | "closing" | "error" | null;
  transportSessionId: string | null;
  lastHeartbeatAt: number | null;
  protocolProfile: "onvif_device" | "rtsp_session" | "mjpeg_stream" | "http_poll" | "proxy" | null;
  liveFeedUrl: string | null;
  liveFeedLabel: string | null;
  ingestMode: "manual" | "external";
  timestamp: number;
  summary: string;
};

export type OperationalEvidenceFusionSummary = {
  sensorFusion: SensorFusionSummary;
  cameraMetadataEvent: CameraMetadataFusionEvent | null;
  cameraLiveConnectionEvent: CameraLiveConnectionFusionEvent | null;
  operationalHealth: "healthy" | "attention" | "degraded" | "offline" | "unknown";
  operationalHealthLabel: string;
  operationalHealthDetail: string;
};

export function computeSensorFusionSummary(
  cameraPosition: [number, number, number],
  sensors: SensorNode[],
): SensorFusionSummary {
  const activeCount = sensors.filter((sensor) => sensor.state === "active").length;

  if (sensors.length === 0) {
    return {
      totalCount: 0,
      activeCount,
      nearestSensor: null,
      nearestDistanceM: null,
    };
  }

  let nearestSensor: SensorNode | null = null;
  let nearestDistanceM: number | null = null;

  for (const sensor of sensors) {
    const distanceM = Math.hypot(
      cameraPosition[0] - sensor.position[0],
      cameraPosition[1] - sensor.position[1],
      cameraPosition[2] - sensor.position[2],
    );
    if (nearestSensor === null || distanceM < (nearestDistanceM ?? Number.POSITIVE_INFINITY)) {
      nearestSensor = sensor;
      nearestDistanceM = distanceM;
    }
  }

  return {
    totalCount: sensors.length,
    activeCount,
    nearestSensor,
    nearestDistanceM,
  };
}

function normalizeCameraStatus(status: CameraNode["status"] | null | undefined) {
  return status ?? null;
}

function healthToneForCamera(status: CameraNode["status"] | null, connectionStatus: CameraLiveConnectionFusionEvent["liveConnectionStatus"] | null) {
  const cameraStatus = status as string | null;
  if (connectionStatus === "error" || cameraStatus === "malfunctioning") return "offline" as const;
  if (connectionStatus === "disconnected" || cameraStatus === "off" || cameraStatus === "blocked") return "degraded" as const;
  if (cameraStatus === "dirty" || connectionStatus === "connecting") return "attention" as const;
  if (cameraStatus === "on" && connectionStatus === "connected") return "healthy" as const;
  return "unknown" as const;
}

export function computeOperationalEvidenceFusionSummary(
  camera: CameraNode,
  sensors: SensorNode[],
  cameraMetadataEvents: CameraMetadataFusionEvent[],
  cameraLiveConnectionEvents: CameraLiveConnectionFusionEvent[],
): OperationalEvidenceFusionSummary {
  const sensorFusion = computeSensorFusionSummary(camera.position, sensors);
  const cameraMetadataEvent = [...cameraMetadataEvents].reverse().find((event) => event.cameraId === camera.id) ?? null;
  const cameraLiveConnectionEvent = [...cameraLiveConnectionEvents].reverse().find((event) => event.cameraId === camera.id) ?? null;
  const metadataStatus = normalizeCameraStatus(cameraMetadataEvent?.status ?? camera.status);
  const connectionStatus = cameraLiveConnectionEvent?.liveConnectionStatus ?? camera.liveConnectionStatus ?? null;
  const health = healthToneForCamera(metadataStatus, connectionStatus);
  const operationalHealthLabel =
    health === "healthy" ? "Healthy"
      : health === "attention" ? "Attention"
        : health === "degraded" ? "Degraded"
          : health === "offline" ? "Offline"
            : "Unknown";
  const operationalHealthDetail = [
    `Metadata ${metadataStatus ?? "unknown"}`,
    `Connection ${connectionStatus ?? "unknown"}`,
    `Sensors ${sensorFusion.totalCount}`,
  ].join(" · ");

  return {
    sensorFusion,
    cameraMetadataEvent,
    cameraLiveConnectionEvent,
    operationalHealth: health,
    operationalHealthLabel,
    operationalHealthDetail,
  };
}
