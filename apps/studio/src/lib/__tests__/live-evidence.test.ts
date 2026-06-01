import { describe, it, expect } from "vitest";
import {
  liveEvidenceEventSchema,
  bindSensorToScene,
  generateEventToSimulationUpdates,
  detectConflicts,
  LiveEvidenceTimeline,
  type LiveEvidenceEvent
} from "../live-evidence";
import type { SecurityScene, CameraNode } from "@/schema/security-scene";

const dummyScene: SecurityScene = {
  id: "scene_1",
  name: "Test Scene",
  createdAt: 0,
  updatedAt: 0,
  units: "meters",
  dimensions: { width: 10, depth: 10, height: 3 },
  walls: [],
  doors: [],
  windows: [],
  cameras: [
    {
      id: "cam_1",
      nodeType: "camera",
      name: "Front Camera",
      position: [0, 0, 0],
      yawDeg: 0,
      pitchDeg: 0,
      rollDeg: 0,
      mountType: "wall",
      mountHeightM: 2,
      fovHorizontalDeg: 90,
      fovVerticalDeg: 60,
      rangeM: 10,
      resolutionMP: 2,
      lensType: "fixed",
      status: "on",
      nightMode: "none",
      irRangeM: 0,
      thermalCapable: false,
      ptz: false,
      clarity: "good",
      ndaaCompliant: true,
      privacyMaskingEnabled: false,
      source: "manual",
      tags: [],
      reviewStatus: "unreviewed",
      sourceTrace: "",
      geometryValidity: "valid",
      viewMotion: { movementMode: "fixed", dwellSeconds: 0, waypoints: [] },
    }
  ],
  securityLights: [],
  obstructions: [],
  criticalZones: [],
  privacyZones: [],
  sensors: [
    {
      id: "sensor_1",
      nodeType: "sensor",
      label: "Front Door Motion",
      sensorType: "motion",
      position: [1, 1, 1],
      state: "active",
      coverageMode: "detection",
      source: "manual",
      reviewStatus: "unreviewed",
      sourceTrace: "",
      geometryValidity: "valid",
    }
  ],
  entryPoints: [],
  paths: [],
  assumptions: {
    wallHeightM: 3,
    personHeightM: 1.8,
    vehicleHeightM: 1.5,
    timeOfDay: "day",
    interiorLightLevel: "normal",
    nightPenaltyMode: "none",
    doriStandard: "oodpcvs_2025",
    pixelsPerMeter: { detection: 25, observation: 62.5, recognition: 125, identification: 250 },
    showAssumptionsPanel: false,
    backlightIntensity: "none",
    glareIntensity: "none",
    overexposedZones: false,
    sceneComplexity: "moderate",
    operatorExperience: "trained",
    taskCriticality: "standard",
  },
  source: "manual",
  reviewStatus: "unreviewed",
  sourceTrace: "",
  geometryValidity: "valid",
  version: "1.0",
  snapshots: [],
  scenarios: [],
  comments: [],
  evidenceArtifacts: [],
  mismatchReports: [],
  changeLog: [],
};

describe("LiveEvidence", () => {
  it("should validate a valid LiveEvidenceEvent", () => {
    const event: LiveEvidenceEvent = {
      id: "evt_1",
      source: "onvif",
      timestamp: 1600000000,
      eventType: "motion",
      boundNodeId: "cam_1",
      confidence: 0.95,
      payload: { objectClass: "person" },
      provenance: { adapter: "onvif", receivedAt: 1600000010 },
      reviewState: "unreviewed"
    };

    expect(liveEvidenceEventSchema.safeParse(event).success).toBe(true);
  });

  it("should bind sensor to scene by id", () => {
    const binding = bindSensorToScene("sensor_1", dummyScene);
    expect(binding).not.toBeNull();
    expect(binding?.nodeId).toBe("sensor_1");
  });

  it("should bind camera to scene by name", () => {
    const binding = bindSensorToScene("Front Camera", dummyScene);
    expect(binding).not.toBeNull();
    expect(binding?.nodeId).toBe("cam_1");
  });

  it("should not bind unknown sensor", () => {
    const binding = bindSensorToScene("unknown_sensor", dummyScene);
    expect(binding).toBeNull();
  });

  it("should generate simulation update for offline camera", () => {
    const event: LiveEvidenceEvent = {
      id: "evt_2",
      source: "health_check",
      timestamp: 1600000000,
      eventType: "camera_health",
      boundNodeId: "cam_1",
      confidence: 1,
      payload: { status: "offline" },
      provenance: { adapter: "internal", receivedAt: 1600000010 },
      reviewState: "unreviewed"
    };

    const update = generateEventToSimulationUpdates(event, dummyScene);
    expect(update).toEqual({
      type: "camera_status_update",
      nodeId: "cam_1",
      suggestedStatus: "off"
    });
  });

  it("should detect conflict when camera goes offline but scene says on", () => {
    const event: LiveEvidenceEvent = {
      id: "evt_3",
      source: "health_check",
      timestamp: 1600000000,
      eventType: "camera_health",
      boundNodeId: "cam_1",
      confidence: 1,
      payload: { status: "offline" },
      provenance: { adapter: "internal", receivedAt: 1600000010 },
      reviewState: "unreviewed"
    };

    const conflicts = detectConflicts(event, dummyScene);
    expect(conflicts.length).toBe(1);
    expect(conflicts[0].nodeId).toBe("cam_1");
    expect(conflicts[0].property).toBe("status");
    expect(conflicts[0].currentValue).toBe("on");
    expect(conflicts[0].suggestedValue).toBe("off");
  });

  it("timeline should order events by timestamp", () => {
    const timeline = new LiveEvidenceTimeline();
    timeline.addEvent({
      id: "evt_4",
      source: "test",
      timestamp: 100,
      eventType: "motion",
      boundNodeId: null,
      confidence: 1,
      payload: {},
      provenance: { adapter: "test", receivedAt: 100 },
      reviewState: "unreviewed"
    });
    timeline.addEvent({
      id: "evt_5",
      source: "test",
      timestamp: 50,
      eventType: "motion",
      boundNodeId: null,
      confidence: 1,
      payload: {},
      provenance: { adapter: "test", receivedAt: 50 },
      reviewState: "unreviewed"
    });

    expect(timeline.events[0].id).toBe("evt_5");
    expect(timeline.events[1].id).toBe("evt_4");

    const window = timeline.getEventsInWindow(60, 110);
    expect(window.length).toBe(1);
    expect(window[0].id).toBe("evt_4");
  });
});
