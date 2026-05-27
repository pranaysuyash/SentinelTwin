"use client";

import { useCallback, useRef, useState } from "react";

import { parseCommand, type SceneContextSummary } from "@/agents/CommandAgent";
import { proposeCounterfactuals, type CounterfactualCandidate } from "@/agents/CounterfactualAgent";
import { OpenAIProvider } from "@/agents/providers/OpenAIProvider";
import { generateReport, buildSimulationSummary } from "@/agents/ReportAgent";
import type { SceneOperation } from "@/schema/SceneOperation";
import { applySceneOperation } from "@/lib/applySceneOperation";
import { createSecurityLightNode } from "@/lib/node-factory";
import { useStudioStore } from "@/store/studio-store";
import { simulateStudio } from "@/simulation/simulate-studio";

const provider = new OpenAIProvider();

export type AiCommandStatus =
  | { state: "idle" }
  | { state: "parsing" }
  | { state: "applying"; descriptions: string[] }
  | { state: "error"; message: string }
  | { state: "success"; message: string };

function buildSceneContext(): SceneContextSummary {
  const scene = useStudioStore.getState().scene;
  return {
    cameraNames: scene.cameras.map((c) => c.name),
    obstructionLabels: scene.obstructions.map((o) => o.label),
    lightNames: scene.securityLights.map((l) => l.name),
    zoneLabels: scene.criticalZones.map((z) => z.label),
    activeCameraCount: scene.cameras.filter((c) => c.status === "on").length,
    currentTimeOfDay: scene.assumptions.timeOfDay,
    dimensions: {
      width: scene.dimensions.width,
      depth: scene.dimensions.depth,
      height: scene.dimensions.height,
    },
  };
}

export function useAiCommand() {
  const [status, setStatus] = useState<AiCommandStatus>({ state: "idle" });
  const dismissRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const setStatusSafe = useCallback((newStatus: AiCommandStatus) => {
    // Clear any pending auto-dismiss when status changes
    if (dismissRef.current) {
      clearTimeout(dismissRef.current);
      dismissRef.current = null;
    }
    setStatus(newStatus);
  }, []);

  const autoDismiss = useCallback(() => {
    dismissRef.current = setTimeout(() => {
      setStatus({ state: "idle" });
      dismissRef.current = null;
    }, 4000);
  }, [setStatus]);

  const executeCommand = useCallback(async (userText: string) => {
    if (!userText.trim()) return;

    const { apiKeyAvailable } = checkApiKey();
    if (!apiKeyAvailable) {
      setStatusSafe({ state: "error", message: "OpenAI API key not configured. Set OPENAI_API_KEY or NEXT_PUBLIC_OPENAI_API_KEY in your environment." });
      return;
    }

    // Check for special internal commands first
    if (userText.startsWith("/")) {
      handleInternalCommand(userText);
      return;
    }

    setStatusSafe({ state: "parsing" });

    try {
      const context = buildSceneContext();
      const operations = await parseCommand(userText, context, provider);

      if (operations.length === 0) {
        setStatusSafe({ state: "error", message: "Could not parse that as a valid scene operation." });
        return;
      }

      setStatusSafe({ state: "applying", descriptions: operations.map((op) => op.type) });

      // Apply operations by mutating the scene directly through the store
      const store = useStudioStore.getState();
      const scene = store.scene;

      for (const op of operations) {
        switch (op.type) {
          case "move_camera": {
            const cam = scene.cameras.find((c) => c.id === op.cameraId);
            if (cam) cam.position = op.newPosition;
            break;
          }
          case "rotate_camera": {
            const cam = scene.cameras.find((c) => c.id === op.cameraId);
            if (cam) {
              cam.yawDeg = op.yawDeg;
              if (op.pitchDeg !== undefined) cam.pitchDeg = op.pitchDeg;
            }
            break;
          }
          case "change_camera_fov": {
            const cam = scene.cameras.find((c) => c.id === op.cameraId);
            if (cam) cam.fovHorizontalDeg = op.fovHorizontalDeg;
            break;
          }
          case "toggle_camera": {
            const cam = scene.cameras.find((c) => c.id === op.cameraId);
            if (cam) cam.status = op.status;
            break;
          }
          case "move_obstruction": {
            const obs = scene.obstructions.find((o) => o.id === op.obstructionId);
            if (obs) obs.position = op.newPosition;
            break;
          }
          case "resize_obstruction": {
            const obs = scene.obstructions.find((o) => o.id === op.obstructionId);
            if (obs) obs.dimensions = op.newDimensions;
            break;
          }
          case "rotate_obstruction": {
            const obs = scene.obstructions.find((o) => o.id === op.obstructionId);
            if (obs) obs.rotationYDeg = op.rotationYDeg;
            break;
          }
          case "add_light": {
            const light = createSecurityLightNode(op.position);
            if (op.name) light.name = op.name;
            if (op.lightType) light.lightType = op.lightType;
            if (op.brightness) light.brightness = op.brightness;
            scene.securityLights.push(light);
            break;
          }
          case "toggle_light": {
            const light = scene.securityLights.find((l) => l.id === op.lightId);
            if (light) light.status = op.status;
            break;
          }
          case "set_time_of_day":
            store.setEnvironmentMode(op.timeOfDay);
            // assumptions.timeOfDay uses "custom" instead of "dusk"
            scene.assumptions.timeOfDay = op.timeOfDay === "dusk" ? "custom" : op.timeOfDay;
            break;
          case "save_snapshot":
            store.saveSnapshot(op.label);
            break;
          case "generate_report":
            store.setBottomTab("report");
            break;
          case "run_adversarial":
          case "run_coverage_failure_analysis":
            store.setActiveTool("path");
            break;
          default:
            break;
        }
      }

      // Mark scene dirty and trigger recompute
      scene.updatedAt = Date.now();
      store.markDirty();

      const descriptions = operations.map((op) => {
        switch (op.type) {
          case "move_camera": return `Moved camera`;
          case "rotate_camera": return `Rotated camera`;
          case "change_camera_fov": return `Changed FOV`;
          case "toggle_camera": return op.status === "on" ? `Turned on camera` : `Turned off camera`;
          case "move_obstruction": return `Moved obstruction`;
          case "resize_obstruction": return `Resized obstruction`;
          case "rotate_obstruction": return `Rotated obstruction`;
          case "add_light": return `Added light`;
          case "toggle_light": return `Toggled light`;
          case "set_time_of_day": return `Set to ${op.timeOfDay}`;
          case "save_snapshot": return `Saved "${op.label}"`;
          case "generate_report": return `Generated report`;
          case "run_adversarial":
          case "run_coverage_failure_analysis":
            return "Running coverage-failure analysis";
          default: return op.type;
        }
      });

      setStatusSafe({
        state: "success",
        message: descriptions.join(" • "),
      });

      autoDismiss();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      setStatusSafe({ state: "error", message });
    }
  }, [setStatusSafe, autoDismiss]);

  const runCounterfactuals = useCallback(async (constraints: string[], onCandidates: (candidates: CounterfactualCandidate[]) => void) => {
    const { apiKeyAvailable } = checkApiKey();
    if (!apiKeyAvailable) {
      setStatus({ state: "error", message: "OpenAI API key not configured." });
      return;
    }

    setStatus({ state: "parsing" });

    try {
      const store = useStudioStore.getState();
      const scene = store.scene;
      const sim = store.simulationResult;

      if (!sim) {
        setStatus({ state: "error", message: "Run simulation first before proposing fixes." });
        return;
      }

      const issuesSummary = sim.issues.map((i) => `[${i.severity}] ${i.description}`).join("\n");
      const sceneSummary = [
        `Cameras: ${scene.cameras.map((c) => c.name).join(", ")}`,
        `Obstructions: ${scene.obstructions.map((o) => o.label).join(", ")}`,
        `Zones: ${scene.criticalZones.map((z) => z.label).join(", ")}`,
        `Time: ${scene.assumptions.timeOfDay}`,
      ].join(" | ");

      const candidates = await proposeCounterfactuals(issuesSummary, sceneSummary, constraints, provider);

      // Verify each candidate by simulating
      const verified = candidates.map((candidate) => {
        try {
          const testScene = structuredClone(scene);
          const ops = candidate.operations as unknown as SceneOperation[];
          for (const op of ops) {
            applySceneOperation(testScene, op);
          }
          const testResult = simulateStudio(testScene);

          const delta = {
            totalCoveragePctDelta: Number((testResult.totalCoveragePct - sim.totalCoveragePct).toFixed(1)),
            blindspotPctDelta: Number((testResult.blindspotPct - sim.blindspotPct).toFixed(1)),
            criticalZoneStatusChanges: testResult.criticalZoneResults
              .map((z, i) => {
                const prev = sim.criticalZoneResults[i];
                if (prev && prev.status !== z.status) return `${z.label}: ${prev.status} → ${z.status}`;
                return null;
              })
              .filter((s): s is string => s !== null),
            worstIssueResolved: testResult.issues.filter((i) => i.severity === "critical").length < sim.issues.filter((i) => i.severity === "critical").length,
          };

          return {
            ...candidate,
            verifiedDelta: delta,
          };
        } catch {
          return { ...candidate, verifiedDelta: undefined };
        }
      });

      const ranked = verified
        .filter((c) => c.verifiedDelta)
        .sort((a, b) => (b.verifiedDelta?.totalCoveragePctDelta ?? 0) - (a.verifiedDelta?.totalCoveragePctDelta ?? 0))
        .map((c, i) => ({ ...c, rank: i + 1 }));

      onCandidates(ranked);
      setStatus({
        state: "success",
        message: `Found ${ranked.length} verified fix candidates`,
      });

      setTimeout(() => setStatus({ state: "idle" }), 4000);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      setStatus({ state: "error", message });
    }
  }, []);

  const runReportGeneration = useCallback(async () => {
    const { apiKeyAvailable } = checkApiKey();
    if (!apiKeyAvailable) {
      setStatus({ state: "error", message: "OpenAI API key not configured." });
      return null;
    }

    setStatus({ state: "parsing" });

    try {
      const store = useStudioStore.getState();
      const sim = store.simulationResult;
      if (!sim) {
        setStatus({ state: "error", message: "Run simulation first." });
        return null;
      }

      const simData = buildSimulationSummary(sim);
      const sceneSummary = `Site: ${store.scene.name}, ${store.scene.dimensions.width}m × ${store.scene.dimensions.depth}m, ${store.scene.cameras.length} cameras`;

      const report = await generateReport(simData, sceneSummary, provider);
      setStatus({ state: "success", message: "Report generated" });
      setTimeout(() => setStatus({ state: "idle" }), 4000);
      return report;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      setStatus({ state: "error", message });
      return null;
    }
  }, []);

  const dismissError = useCallback(() => setStatusSafe({ state: "idle" }), [setStatusSafe]);

  return { status, executeCommand, runCounterfactuals, runReportGeneration, dismissError };
}

function handleInternalCommand(text: string) {
  const store = useStudioStore.getState();
  switch (text.toLowerCase()) {
    case "/night":
    case "/nightmode":
      store.setEnvironmentMode("night");
      break;
    case "/day":
    case "/daymode":
      store.setEnvironmentMode("day");
      break;
    case "/report":
      store.setBottomTab("report");
      break;
    case "/snapshot":
      store.saveSnapshot(`Snapshot ${new Date().toLocaleTimeString()}`);
      break;
    case "/simulate":
    case "/run":
      store.setSimulationRunning(true);
      setTimeout(() => {
        const result = simulateStudio(store.scene);
        store.setSimulationResult(result, 0);
      }, 50);
      break;
    default:
      break;
  }
}

function checkApiKey() {
  const key = typeof process !== "undefined"
    ? (process.env.OPENAI_API_KEY ?? process.env.NEXT_PUBLIC_OPENAI_API_KEY)
    : "";
  return { apiKeyAvailable: Boolean(key) };
}
