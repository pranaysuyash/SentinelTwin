import type { SensorNode } from "@/schema/security-scene";

export type SensorFusionSummary = {
  totalCount: number;
  activeCount: number;
  nearestSensor: SensorNode | null;
  nearestDistanceM: number | null;
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
