# D-022: Multi-Sensor Data Model Scope

**Status:** Resolved
**Date:** 2026-07-04

## Decision

The multi-sensor data model is **scoped to the existing `SensorNode` type** for V1. No new sensor sub-types are added. The current model supports:

- **Motion sensors** (`motion`) — PIR/detection zone
- **Glass break sensors** (`glass_break`) — acoustic detection
- **Contact sensors** (`contact`) — door/window magnetic contact
- **Environmental sensors** (`environmental`) — temperature, humidity, smoke
- **Pressure sensors** (`pressure`) — floor/mat pressure
- **Vibration sensors** (`vibration`) — structural vibration

## Rationale

1. **The existing type covers the use cases.** All six sensor types are already defined in `SensorNode.sensorType` and used in simulation (coverage impact, sensor fusion, operational evidence).
2. **No new sensor types needed for V1.** The product's core loop (edit scene → simulate coverage → inspect impact) does not require radar, LiDAR, or acoustic imaging sensors.
3. **Extensible by design.** The `sensorType` enum can be extended without schema migration. Adding new types is a one-line change.
4. **Sensor fusion is already implemented.** `computeOperationalEvidenceFusionSummary` in `sensor-fusion.ts` handles all six types.

## Implications

- V1 freeze is unblocked for the sensor data model.
- New sensor types (radar, LiDAR, acoustic) are V2 scope.
- The `SensorNode` schema is stable and will not change for V1.
